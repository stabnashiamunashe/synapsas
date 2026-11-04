/**
 * Licensing module (local authority): applications for trading, liquor, health, building and other licences,
 * inspections, approval, fee payment, issue, renewal, suspension and revocation. Applications arrive over the
 * counter (staff), from the public portal (/apply) or from the WhatsApp bot; all three go through
 * createLicenceApplication so numbering, checklists and notifications are identical. Expiry is handled by a sweep
 * from the cron endpoint, which also reminds holders 30 days before a licence lapses.
 */
import { createHmac } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { audit, notify } from "./notify";
import { parseJson } from "./json";
import { escapeHtml, mailConfigured, renderEmail, sendMail, appUrl, type MailBrand } from "./mailer";
import { sendWhatsApp, waConfig } from "./whatsapp/client";
import { LICENCE_LIVE, LICENCE_STATUS_LABELS, type LicenceStatus } from "./licenceTypes";
import type { BrandingSettings } from "./types";

export const licenceInclude = {
  type: { select: { id: true, code: true, name: true, category: true, validityMonths: true, requiresInspection: true, departmentId: true } },
  officer: { select: { id: true, name: true } },
  inspector: { select: { id: true, name: true } },
  _count: { select: { attachments: true } },
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

/** Token that lets an applicant upload documents and track the application without an account. */
export function licenceUploadToken(id: string, createdAt: Date) {
  return createHmac("sha256", process.env.AUTH_SECRET || "dev-secret-change-me").update(`licence:${id}:${createdAt.getTime()}`).digest("base64url");
}

export const phoneTail = (p: string | null | undefined) => (p || "").replace(/\D/g, "").slice(-9);

export interface NewApplication {
  typeId: string; applicantName: string; tradingName?: string | null; idNumber?: string | null; phone?: string | null; email?: string | null;
  standNumber?: string | null; address?: string | null; ward?: string | null; activity?: string | null; priority?: string;
  officerId?: string | null; documents?: { name: string; received: boolean }[]; renewedFromId?: string | null;
}

/** One entry point for counter, portal and WhatsApp applications. */
export async function createLicenceApplication(orgId: string, input: NewApplication, opts: { actorId: string | null; source: "STAFF" | "PUBLIC" | "WHATSAPP" }) {
  const type = await prisma.licenceType.findFirst({ where: { id: input.typeId, orgId, isActive: true } });
  if (!type) throw new Error("Choose a licence type");
  const required = (type.requirements as string[]) || [];
  const documents = input.documents?.length ? input.documents : required.map((name) => ({ name, received: false }));
  const referenceNo = await nextLicenceReference(orgId);
  // portal and WhatsApp applications go to the owning department's head until an officer picks them up
  let officerId = input.officerId || opts.actorId || null;
  if (!officerId && type.departmentId) officerId = (await prisma.department.findUnique({ where: { id: type.departmentId }, select: { headUserId: true } }))?.headUserId || null;
  const l = await prisma.licence.create({
    data: {
      orgId, typeId: type.id, referenceNo, status: "SUBMITTED", source: opts.source, applicantName: input.applicantName, tradingName: input.tradingName || null, idNumber: input.idNumber || null, phone: input.phone || null, email: input.email || null,
      standNumber: input.standNumber || null, address: input.address || null, ward: input.ward || null, activity: input.activity || null, priority: input.priority || "MEDIUM", feeAmount: type.fee, currency: type.currency,
      officerId, documents, renewedFromId: input.renewedFromId || null,
      events: { create: { kind: "SUBMITTED", toStatus: "SUBMITTED", actorId: opts.actorId, note: input.renewedFromId ? "Renewal application" : opts.source === "PUBLIC" ? "Applied on the public portal" : opts.source === "WHATSAPP" ? "Applied via WhatsApp" : "Application received at the counter" } },
    },
    include: licenceInclude,
  });
  const notifyIds = new Set<string>();
  if (officerId && officerId !== opts.actorId) notifyIds.add(officerId);
  if (type.departmentId) {
    const d = await prisma.department.findUnique({ where: { id: type.departmentId }, select: { headUserId: true } });
    if (d?.headUserId && d.headUserId !== opts.actorId) notifyIds.add(d.headUserId);
  }
  if (notifyIds.size) await notify(orgId, [...notifyIds], { title: `New licence application: ${referenceNo}`, body: `${type.name} for ${input.tradingName || input.applicantName}${opts.source === "STAFF" ? "" : ` (${opts.source === "PUBLIC" ? "public portal" : "WhatsApp"})`}.`, link: `/app/licences?open=${l.id}`, type: "INFO" });
  await audit(orgId, opts.actorId, "licence.submitted", "Licence", l.id, { referenceNo, type: type.code, source: opts.source });
  void notifyApplicant(l, "received");
  return l;
}

type ApplicantLicence = { id: string; orgId: string; referenceNo: string; licenceNo: string | null; status: string; source: string; phone: string | null; email: string | null; applicantName: string; tradingName: string | null; feeAmount: Prisma.Decimal | number; currency: string; expiresAt: Date | null; inspectionDue?: Date | null; type: { name: string } };

/**
 * Tell the applicant what happened. WhatsApp: a template when the Business API is configured (business-initiated
 * messages must use approved templates), otherwise a plain message recorded as "simulated" so it shows in the sandbox.
 * Email when an address was given and SMTP is configured. Never throws.
 */
export async function notifyApplicant(l: ApplicantLicence, kind: "received" | "inspection" | "approved" | "issued" | "rejected" | "suspended" | "revoked" | "documents", note?: string | null) {
  try {
    const fee = `${l.currency} ${Number(l.feeAmount).toFixed(2)}`;
    const who = l.tradingName || l.applicantName;
    const text: Record<typeof kind, string> = {
      received: `Your application ${l.referenceNo} for a ${l.type.name} (${who}) has been received. Fee: ${fee}, payable once approved. Track it at ${appUrl()}/verify with your reference and phone number.`,
      inspection: `${l.referenceNo}: an inspection of the premises has been scheduled${l.inspectionDue ? ` for ${l.inspectionDue.toDateString()}` : ""}. Please have the premises and your documents ready.`,
      approved: `${l.referenceNo}: your ${l.type.name} has been approved. Please pay ${fee} at the council cashier (reference ${l.referenceNo}) so the licence can be issued.${note ? ` Conditions: ${note}` : ""}`,
      issued: `${l.referenceNo}: licence ${l.licenceNo} has been issued${l.expiresAt ? ` and is valid until ${l.expiresAt.toDateString()}` : ""}. Collect the certificate from the licensing office.`,
      rejected: `${l.referenceNo}: your application was not approved.${note ? ` Reason: ${note}` : ""} Contact the licensing office if you wish to query the decision.`,
      suspended: `Licence ${l.licenceNo || l.referenceNo} has been suspended.${note ? ` Reason: ${note}` : ""} Trading under it must stop until it is reinstated.`,
      revoked: `Licence ${l.licenceNo || l.referenceNo} has been revoked.${note ? ` Reason: ${note}` : ""}`,
      documents: `${l.referenceNo}: ${note || "documents are still outstanding"}. Upload them at ${appUrl()}/verify or bring them to the licensing office.`,
    };
    if (l.phone) {
      const cfg = waConfig();
      const wantsWhatsApp = l.source === "WHATSAPP";
      if (wantsWhatsApp || cfg.configured) {
        const template = process.env.WHATSAPP_TEMPLATE_LICENCE_UPDATE || cfg.templates.caseUpdate;
        if (cfg.configured && template) await sendWhatsApp(l.phone, { type: "template", name: template, language: cfg.templates.language, bodyParams: [l.referenceNo, LICENCE_STATUS_LABELS[l.status as LicenceStatus] || l.status, text[kind].slice(0, 200)], urlButtonParam: encodeURIComponent(l.referenceNo) }, { orgId: l.orgId });
        else if (wantsWhatsApp) await sendWhatsApp(l.phone, { type: "text", text: text[kind] }, { orgId: l.orgId, simulate: !cfg.configured });
      }
    }
    if (l.email && mailConfigured()) {
      const org = await prisma.organization.findUnique({ where: { id: l.orgId }, select: { name: true, branding: true } });
      const b = parseJson<BrandingSettings>(org?.branding, {});
      const brand: MailBrand = { productName: b.productName || org?.name, primaryColor: b.primaryColor, logoUrl: b.logoUrl, footerText: b.footerText, supportEmail: b.supportEmail };
      const title = `${l.type.name}: ${LICENCE_STATUS_LABELS[l.status as LicenceStatus] || l.status}`;
      const mail = renderEmail({ brand, title, intro: `Application ${l.referenceNo}`, paragraphs: [escapeHtml(text[kind])], cta: { label: "Track the application", url: `${appUrl()}/verify` } });
      await sendMail({ to: l.email, subject: `${l.referenceNo} · ${title}`, html: mail.html, text: mail.text || text[kind], category: "notification", orgId: l.orgId });
    }
  } catch (e) {
    console.error("[licensing] applicant notification failed", e);
  }
}

/** What an applicant may see when tracking with reference + phone/email (no internal notes, no officer names). */
export function publicLicenceView(l: { id: string; createdAt: Date; referenceNo: string; licenceNo: string | null; status: string; applicantName: string; tradingName: string | null; standNumber: string | null; ward: string | null; feeAmount: Prisma.Decimal; currency: string; paidAt: Date | null; receiptNo: string | null; issuedAt: Date | null; expiresAt: Date | null; inspectionDue: Date | null; inspectedAt: Date | null; inspectionOutcome: string | null; conditions: string | null; decisionNote: string | null; documents: unknown; submittedAt: Date; type: { name: string; category: string; requirements: unknown }; events: { kind: string; toStatus: string | null; note: string | null; createdAt: Date }[]; attachments: { id: string; label: string | null; fileName: string; size: number; createdAt: Date }[] }) {
  const publicKinds = ["SUBMITTED", "REVIEW", "INSPECTION_SCHEDULED", "INSPECTED", "APPROVED", "REJECTED", "PAID", "ISSUED", "RENEWED", "SUSPENDED", "REINSTATED", "REVOKED", "EXPIRED", "CANCELLED"];
  const next: Record<string, string> = {
    SUBMITTED: "The licensing office will check your application and documents.",
    UNDER_REVIEW: "Your application is being reviewed. Make sure all required documents have been supplied.",
    INSPECTION: "An inspection of the premises is scheduled. Have the premises and documents ready.",
    APPROVED: `Approved. Pay the fee of ${l.currency} ${Number(l.feeAmount).toFixed(2)} at the council cashier quoting ${l.referenceNo}; the licence is issued once payment is receipted.`,
    ISSUED: "Your licence has been issued. Collect the certificate from the licensing office and display it at the premises.",
    REJECTED: "The application was not approved. Contact the licensing office if you wish to query the decision.",
    EXPIRED: "This licence has expired. Apply for a renewal.",
    SUSPENDED: "The licence is suspended. Contact the licensing office about the conditions for reinstatement.",
    REVOKED: "The licence has been revoked.",
    CANCELLED: "The application was cancelled.",
  };
  return {
    referenceNo: l.referenceNo, licenceNo: l.licenceNo, status: l.status, statusLabel: LICENCE_STATUS_LABELS[l.status as LicenceStatus] || l.status, nextStep: next[l.status] || "",
    type: l.type.name, category: l.type.category, applicant: l.applicantName, tradingName: l.tradingName, premises: [l.standNumber ? `Stand ${l.standNumber}` : null, l.ward ? `Ward ${l.ward}` : null].filter(Boolean).join(", ") || null,
    fee: Number(l.feeAmount), currency: l.currency, paidAt: l.paidAt, receiptNo: l.receiptNo, issuedAt: l.issuedAt, expiresAt: l.expiresAt, inspectionDue: l.inspectionDue, inspectedAt: l.inspectedAt,
    inspectionOutcome: l.inspectionOutcome, conditions: l.conditions, decisionNote: l.status === "REJECTED" ? l.decisionNote : null, submittedAt: l.submittedAt,
    documents: (l.documents as { name: string; received: boolean }[]) || [], attachments: l.attachments,
    timeline: l.events.filter((e) => publicKinds.includes(e.kind)).map((e) => ({ kind: e.kind, toStatus: e.toStatus, note: e.kind === "REJECTED" || e.kind === "APPROVED" || e.kind === "ISSUED" || e.kind === "PAID" || e.kind === "INSPECTION_SCHEDULED" ? e.note : null, createdAt: e.createdAt })),
    uploadToken: licenceUploadToken(l.id, l.createdAt),
  };
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
 * Nightly sweep: mark lapsed licences EXPIRED and warn stakeholders (and the holder) 30 days before expiry.
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
    if (l.phone && l.source === "WHATSAPP") await sendWhatsApp(l.phone, { type: "text", text: `Reminder: licence ${l.licenceNo} (${l.type.name}) expires in ${days} days. Apply for renewal on WhatsApp or at ${appUrl()}/apply.` }, { orgId: l.orgId, simulate: !waConfig().configured }).catch(() => undefined);
  }
  return { expired: lapsed.length, reminded: expiring.length };
}

export function isLicenceStatus(s: string): s is LicenceStatus {
  return ["SUBMITTED", "UNDER_REVIEW", "INSPECTION", "APPROVED", "ISSUED", "REJECTED", "EXPIRED", "SUSPENDED", "REVOKED", "CANCELLED"].includes(s);
}
