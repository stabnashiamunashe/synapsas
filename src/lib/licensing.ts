/**
 * Licensing module (local authority): applications for trading, liquor, health, building and other licences,
 * inspections, approval, fee payment, issue, renewal, suspension and revocation. Expiry is handled by a sweep
 * from the cron endpoint, which also reminds holders 30 days before a licence lapses.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { audit, notify } from "./notify";
import { LICENCE_LIVE, type LicenceStatus } from "./licenceTypes";

export const licenceInclude = {
  type: { select: { id: true, code: true, name: true, category: true, validityMonths: true, requiresInspection: true, departmentId: true } },
  officer: { select: { id: true, name: true } },
  inspector: { select: { id: true, name: true } },
} as const;

export function serializeLicence<T extends { feeAmount: Prisma.Decimal }>(l: T) {
  return { ...l, feeAmount: Number(l.feeAmount) };
}

/** Application reference LA-2026-0001 (per organisation, per year). */
export async function nextLicenceReference(orgId: string) {
  const year = new Date().getFullYear();
  const p = `LA-${year}-`;
  const last = await prisma.licence.findFirst({ where: { orgId, referenceNo: { startsWith: p } }, orderBy: { referenceNo: "desc" }, select: { referenceNo: true } });
  const seq = last ? Number(last.referenceNo.slice(p.length)) + 1 : 1;
  return `${p}${String(seq).padStart(4, "0")}`;
}

/** Issued licence number RLB/SHP/2026/0001: council prefix, type code, year, sequence per type. */
export async function nextLicenceNumber(typeId: string, prefix: string) {
  const t = await prisma.licenceType.update({ where: { id: typeId }, data: { counter: { increment: 1 } }, select: { code: true, counter: true } });
  return `${prefix}/${t.code}/${new Date().getFullYear()}/${String(t.counter).padStart(4, "0")}`;
}

export function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

/** Officers who should hear about a licence: the handling officer, the inspector and the owning department head. */
async function stakeholders(l: { orgId: string; officerId: string | null; inspectorId: string | null; type: { departmentId: string | null } }) {
  const ids = new Set<string>();
  if (l.officerId) ids.add(l.officerId);
  if (l.inspectorId) ids.add(l.inspectorId);
  if (l.type.departmentId) {
    const d = await prisma.department.findUnique({ where: { id: l.type.departmentId }, select: { headUserId: true } });
    if (d?.headUserId) ids.add(d.headUserId);
  }
  return [...ids];
}

/**
 * Nightly sweep: mark lapsed licences EXPIRED and warn stakeholders 30 days before expiry.
 * Returns counts for the cron response.
 */
export async function licenceExpirySweep() {
  const now = new Date();
  const lapsed = await prisma.licence.findMany({ where: { status: { in: LICENCE_LIVE as unknown as string[] }, expiresAt: { lt: now } }, include: { type: { select: { departmentId: true, name: true } } } });
  for (const l of lapsed) {
    await prisma.licence.update({ where: { id: l.id }, data: { status: "EXPIRED", events: { create: { kind: "EXPIRED", fromStatus: l.status, toStatus: "EXPIRED", note: "Validity period ended" } } } });
    const who = await stakeholders(l);
    if (who.length) await notify(l.orgId, who, { title: `Licence expired: ${l.licenceNo || l.referenceNo}`, body: `${l.type.name} for ${l.tradingName || l.applicantName} expired on ${l.expiresAt!.toISOString().slice(0, 10)}. Follow up on renewal or enforcement.`, link: `/app/licences?open=${l.id}`, type: "WARNING" });
    await audit(l.orgId, null, "licence.expired", "Licence", l.id, { licenceNo: l.licenceNo });
  }
  const soon = new Date(now.getTime() + 30 * 86400000);
  const expiring = await prisma.licence.findMany({ where: { status: "ISSUED", expiresAt: { gte: now, lte: soon }, events: { none: { kind: "NOTE", note: { startsWith: "Expiry reminder" }, createdAt: { gte: new Date(now.getTime() - 7 * 86400000) } } } }, include: { type: { select: { departmentId: true, name: true } } } });
  for (const l of expiring) {
    const days = Math.ceil((l.expiresAt!.getTime() - now.getTime()) / 86400000);
    await prisma.licenceEvent.create({ data: { licenceId: l.id, kind: "NOTE", note: `Expiry reminder sent (${days} days left)` } });
    const who = await stakeholders(l);
    if (who.length) await notify(l.orgId, who, { title: `Licence expires in ${days} days: ${l.licenceNo}`, body: `${l.type.name} for ${l.tradingName || l.applicantName}. Contact the holder about renewal.`, link: `/app/licences?open=${l.id}`, type: "INFO" });
  }
  return { expired: lapsed.length, reminded: expiring.length };
}

export function isLicenceStatus(s: string): s is LicenceStatus {
  return ["SUBMITTED", "UNDER_REVIEW", "INSPECTION", "APPROVED", "ISSUED", "REJECTED", "EXPIRED", "SUSPENDED", "REVOKED", "CANCELLED"].includes(s);
}
