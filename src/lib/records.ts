// Records management (registry): server helpers shared by the correspondence and file-plan routes.
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseJson } from "./json";
import { hasRole } from "./roles";
import { audit, notify } from "./notify";
import { RECORD_DONE, type RecordsSettings } from "./recordTypes";
import type { OrgSettings, SessionUser } from "./types";

export const recordInclude = {
  file: { select: { id: true, fileNo: true, title: true } },
  department: { select: { id: true, name: true, code: true } },
  assignedTo: { select: { id: true, name: true } },
  registeredBy: { select: { id: true, name: true } },
  replyTo: { select: { id: true, referenceNo: true, subject: true } },
  _count: { select: { attachments: true, replies: true } },
} as const;

export const recordDetailInclude = {
  ...recordInclude,
  replies: { select: { id: true, referenceNo: true, subject: true, status: true, dateLogged: true }, orderBy: { createdAt: "asc" as const } },
  events: { orderBy: { createdAt: "desc" as const }, include: { actor: { select: { name: true } } } },
  attachments: { orderBy: { createdAt: "asc" as const }, include: { uploader: { select: { name: true } } } },
} as const;

type OrgSettingsWithRecords = OrgSettings & { records?: RecordsSettings; licensing?: { prefix?: string } };

export async function recordsSettings(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
  const s = parseJson<OrgSettingsWithRecords>(org?.settings, {});
  return { prefix: s.records?.prefix || s.licensing?.prefix || s.cases?.prefix || "REG", clerkIds: s.records?.clerkIds || [], replyDays: s.records?.replyDays ?? 7 };
}

/** Who may register, route and file correspondence for the whole council: managers and above, plus the configured registry clerks. */
export async function registryAccess(user: SessionUser) {
  const settings = await recordsSettings(user.orgId);
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { departmentId: true, headOf: { select: { id: true } } } });
  const isClerk = settings.clerkIds.includes(user.id);
  const isManager = hasRole(user, "MANAGER");
  return { settings, isClerk, isManager, canRegister: isClerk || isManager, departmentId: me?.departmentId || null, headOfIds: (me?.headOf || []).map((d) => d.id) };
}

/**
 * Visibility: clerks, managers and administrators see the whole register (confidential items only if they are clerks,
 * administrators, the action officer, or head of the receiving department). Other officers see what is routed to them,
 * what they registered, and the non-confidential mail of their own department.
 */
export function recordScope(user: SessionUser, access: Awaited<ReturnType<typeof registryAccess>>): Prisma.CorrespondenceWhereInput {
  const personal: Prisma.CorrespondenceWhereInput[] = [{ assignedToId: user.id }, { registeredById: user.id }];
  if (access.headOfIds.length) personal.push({ departmentId: { in: access.headOfIds } });
  if (access.isClerk || hasRole(user, "ADMIN")) return {};
  if (access.isManager) return { OR: [{ confidential: false }, ...personal] };
  const own: Prisma.CorrespondenceWhereInput[] = [...personal];
  if (access.departmentId) own.push({ departmentId: access.departmentId, confidential: false });
  return { OR: own };
}

/** Registry number CMC/IN/2026/0001 or CMC/OUT/2026/0001: council prefix, direction, year, sequence per year. */
export async function nextRecordReference(orgId: string, direction: "IN" | "OUT", prefix: string) {
  const p = `${prefix}/${direction}/${new Date().getFullYear()}/`;
  const last = await prisma.correspondence.findFirst({ where: { orgId, referenceNo: { startsWith: p } }, orderBy: { referenceNo: "desc" }, select: { referenceNo: true } });
  const seq = last ? Number(last.referenceNo.slice(p.length)) + 1 : 1;
  return `${p}${String(seq).padStart(4, "0")}`;
}

export function isOverdue(r: { status: string; actionDue: Date | null }) {
  return !!r.actionDue && r.actionDue < new Date() && !RECORD_DONE.includes(r.status as (typeof RECORD_DONE)[number]);
}

export const serializeRecord = <T extends { status: string; actionDue: Date | null }>(r: T) => ({ ...r, overdue: isOverdue(r) });

/** Officers who should hear about a record: the action officer and the head of the department it is routed to. */
export async function recordStakeholders(r: { assignedToId: string | null; departmentId: string | null }) {
  const ids = new Set<string>();
  if (r.assignedToId) ids.add(r.assignedToId);
  if (r.departmentId) {
    const d = await prisma.department.findUnique({ where: { id: r.departmentId }, select: { headUserId: true } });
    if (d?.headUserId) ids.add(d.headUserId);
  }
  return [...ids];
}

/** Daily sweep (cron): remind action officers once about incoming mail whose reply date has passed. */
export async function recordsOverdueSweep() {
  const now = new Date();
  const overdue = await prisma.correspondence.findMany({
    where: { direction: "IN", actionDue: { lt: now }, status: { notIn: [...RECORD_DONE] }, events: { none: { kind: "NOTE", note: { startsWith: "Overdue reminder" }, createdAt: { gte: new Date(now.getTime() - 3 * 86400000) } } } },
    select: { id: true, orgId: true, referenceNo: true, subject: true, party: true, actionDue: true, assignedToId: true, departmentId: true },
  });
  for (const r of overdue) {
    const who = await recordStakeholders(r);
    const days = Math.floor((now.getTime() - r.actionDue!.getTime()) / 86400000);
    if (who.length) await notify(r.orgId, who, { title: `Reply overdue: ${r.referenceNo}`, body: `"${r.subject}" from ${r.party} was due ${days} day${days === 1 ? "" : "s"} ago. Reply or ask registry to extend the date.`, link: `/app/records?open=${r.id}`, type: "WARNING" });
    await prisma.correspondenceEvent.create({ data: { recordId: r.id, kind: "NOTE", note: `Overdue reminder sent (${days} day${days === 1 ? "" : "s"} past the action date)` } });
    await audit(r.orgId, null, "record.overdue_reminder", "Correspondence", r.id, { referenceNo: r.referenceNo, days });
  }
  return overdue.length;
}
