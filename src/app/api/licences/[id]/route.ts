import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { audit, notify } from "@/lib/notify";
import { hasRole } from "@/lib/auth";
import { parseJson } from "@/lib/json";
import { addMonths, isLicenceStatus, licenceInclude, nextLicenceNumber, nextLicenceReference, notifyApplicant, serializeLicence } from "@/lib/licensing";
import { LICENCE_ACTIONS, LICENCE_STATUS_LABELS, LICENCE_TRANSITIONS } from "@/lib/licenceTypes";
import { licenceSchema } from "../route";

const detailInclude = { ...licenceInclude, events: { orderBy: { createdAt: "desc" as const }, include: { actor: { select: { name: true } } } }, renewedFrom: { select: { id: true, referenceNo: true, licenceNo: true } }, renewals: { select: { id: true, referenceNo: true, licenceNo: true, status: true } }, attachments: { select: { id: true, label: true, fileName: true, size: true, createdAt: true, uploadedBy: true }, orderBy: { createdAt: "asc" as const } } };

export const GET = withAuth(async (_req, { params, user }) => {
  const l = await prisma.licence.findFirst({ where: { id: params.id, orgId: user.orgId }, include: detailInclude });
  if (!l) throw notFound();
  return ok(serializeLicence(l));
});

/** Edit applicant details, priority, handling officer or the document checklist. */
export const PATCH = withAuth(async (req, { params, user }) => {
  const l = await prisma.licence.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!l) throw notFound();
  const body = await parseBody(req, licenceSchema.omit({ typeId: true, renewedFromId: true }).partial());
  if (body.officerId !== undefined && !hasRole(user, "MANAGER")) delete body.officerId;
  const updated = await prisma.licence.update({ where: { id: l.id }, data: { ...body, email: body.email === "" ? null : body.email, officerId: body.officerId === undefined ? undefined : body.officerId || null, documents: body.documents === undefined ? undefined : body.documents, events: { create: { kind: body.documents && Object.keys(body).length === 1 ? "DOCUMENT" : "UPDATED", actorId: user.id, note: body.documents && Object.keys(body).length === 1 ? `${body.documents.filter((d) => d.received).length} of ${body.documents.length} documents received` : `Updated ${Object.keys(body).join(", ")}` } } }, include: detailInclude });
  await audit(user.orgId, user.id, "licence.updated", "Licence", l.id, { fields: Object.keys(body) });
  return ok(serializeLicence(updated));
});

const actionSchema = z.object({
  action: z.enum(LICENCE_ACTIONS),
  note: z.string().max(5000).optional().nullable(),
  inspectorId: z.string().optional().nullable(),
  inspectionDue: z.string().optional().nullable(),
  outcome: z.enum(["PASS", "FAIL", "CONDITIONAL"]).optional(),
  conditions: z.string().max(5000).optional().nullable(),
  receiptNo: z.string().max(60).optional().nullable(),
  amount: z.number().min(0).optional(),
  paidAt: z.string().optional().nullable(),
  issuedAt: z.string().optional().nullable(),
  validityMonths: z.number().int().min(1).max(600).optional(),
  documents: z.array(z.object({ name: z.string().min(1).max(200), received: z.boolean() })).max(40).optional(),
});

/**
 * Workflow actions. Officers (members) may review, schedule and record inspections, record payment and add notes;
 * approving, rejecting, issuing, suspending and revoking need a manager; cancelling an open application needs a manager too.
 */
export const POST = withAuth(async (req, { params, user }) => {
  const l = await prisma.licence.findFirst({ where: { id: params.id, orgId: user.orgId }, include: { type: true } });
  if (!l) throw notFound();
  const body = await parseBody(req, actionSchema);
  if (!isLicenceStatus(l.status)) throw badRequest("Unknown status");
  if (!LICENCE_TRANSITIONS[l.status].includes(body.action)) throw badRequest(`"${body.action.replace(/_/g, " ")}" is not available while the application is ${LICENCE_STATUS_LABELS[l.status].toLowerCase()}`);
  const managerOnly = ["approve", "reject", "issue", "suspend", "reinstate", "revoke", "cancel"];
  if (managerOnly.includes(body.action) && !hasRole(user, "MANAGER")) throw forbidden("Only a manager or administrator can do that");

  const data: Record<string, unknown> = {};
  let kind = "NOTE";
  let toStatus: string | null = null;
  let note = body.note || null;
  const notifyIds: string[] = [];
  let notifyText: { title: string; body: string; type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "APPROVAL" } | null = null;

  switch (body.action) {
    case "review": kind = "REVIEW"; toStatus = "UNDER_REVIEW"; if (!l.officerId) data.officerId = user.id; break;
    case "schedule_inspection": {
      if (!body.inspectorId) throw badRequest("Choose an inspector");
      const insp = await prisma.user.findFirst({ where: { id: body.inspectorId, orgId: user.orgId, isActive: true } });
      if (!insp) throw badRequest("Inspector not found");
      kind = "INSPECTION_SCHEDULED"; toStatus = "INSPECTION";
      data.inspectorId = insp.id; data.inspectionDue = body.inspectionDue ? new Date(body.inspectionDue) : new Date(Date.now() + 5 * 86400000);
      note = note || `Inspection by ${insp.name}${body.inspectionDue ? ` due ${body.inspectionDue}` : ""}`;
      if (insp.id !== user.id) { notifyIds.push(insp.id); notifyText = { title: `Inspection assigned: ${l.referenceNo}`, body: `${l.type.name} at ${l.address || l.standNumber || "the stated premises"} for ${l.tradingName || l.applicantName}.`, type: "APPROVAL" }; }
      break;
    }
    case "record_inspection": {
      if (!body.outcome) throw badRequest("Choose the inspection outcome");
      if (l.inspectorId && l.inspectorId !== user.id && !hasRole(user, "MANAGER")) throw forbidden("Only the assigned inspector or a manager can record the result");
      kind = "INSPECTED"; data.inspectedAt = new Date(); data.inspectionOutcome = body.outcome; data.inspectionNotes = body.note || null;
      if (body.outcome === "FAIL") { toStatus = "UNDER_REVIEW"; } else { toStatus = "UNDER_REVIEW"; if (body.outcome === "CONDITIONAL" && body.conditions) data.conditions = body.conditions; }
      note = `Inspection ${body.outcome === "PASS" ? "passed" : body.outcome === "FAIL" ? "failed" : "passed with conditions"}${body.note ? `: ${body.note}` : ""}`;
      break;
    }
    case "approve": {
      if (l.type.requiresInspection && !l.inspectedAt && !hasRole(user, "ADMIN")) throw badRequest("This licence type requires an inspection before approval");
      if (l.inspectionOutcome === "FAIL") throw badRequest("The last inspection failed. Schedule a re-inspection or reject the application");
      kind = "APPROVED"; toStatus = "APPROVED"; data.decisionNote = body.note || null; if (body.conditions) data.conditions = body.conditions;
      note = note || "Approved subject to payment of the prescribed fee";
      break;
    }
    case "reject": if (!body.note) throw badRequest("Give the reason for rejection"); kind = "REJECTED"; toStatus = "REJECTED"; data.decisionNote = body.note; break;
    case "pay": {
      if (!body.receiptNo) throw badRequest("Enter the receipt number");
      kind = "PAID"; data.paidAt = body.paidAt ? new Date(body.paidAt) : new Date(); data.receiptNo = body.receiptNo; if (body.amount !== undefined) data.feeAmount = body.amount;
      note = `Receipt ${body.receiptNo}${body.amount !== undefined ? ` · ${l.currency} ${body.amount.toFixed(2)}` : ""}`;
      break;
    }
    case "issue": {
      if (!l.paidAt && !body.receiptNo) throw badRequest("Record the fee payment first (or enter the receipt number here)");
      const org = await prisma.organization.findUnique({ where: { id: user.orgId }, select: { settings: true } });
      const prefix = parseJson<{ licensing?: { prefix?: string } }>(org?.settings, {}).licensing?.prefix || "RLB";
      const issuedAt = body.issuedAt ? new Date(body.issuedAt) : new Date();
      const months = body.validityMonths || l.type.validityMonths;
      kind = "ISSUED"; toStatus = "ISSUED";
      data.licenceNo = l.licenceNo || (await nextLicenceNumber(l.type.id, prefix));
      data.issuedAt = issuedAt; data.expiresAt = addMonths(issuedAt, months);
      if (!l.paidAt) { data.paidAt = issuedAt; data.receiptNo = body.receiptNo; }
      if (body.conditions) data.conditions = body.conditions;
      note = `Licence ${data.licenceNo} valid ${issuedAt.toISOString().slice(0, 10)} to ${(data.expiresAt as Date).toISOString().slice(0, 10)}`;
      break;
    }
    case "renew": {
      // a renewal is a new application linked to this licence; the old one stays on record
      const referenceNo = await nextLicenceReference(user.orgId);
      const n = await prisma.licence.create({
        data: { orgId: user.orgId, typeId: l.typeId, referenceNo, status: "SUBMITTED", applicantName: l.applicantName, tradingName: l.tradingName, idNumber: l.idNumber, phone: l.phone, email: l.email, standNumber: l.standNumber, address: l.address, ward: l.ward, activity: l.activity, priority: l.priority, feeAmount: l.type.fee, currency: l.type.currency, officerId: l.officerId || user.id, documents: ((l.type.requirements as string[]) || []).map((name) => ({ name, received: false })), renewedFromId: l.id,
          events: { create: { kind: "SUBMITTED", toStatus: "SUBMITTED", actorId: user.id, note: `Renewal of ${l.licenceNo || l.referenceNo}` } } },
      });
      await prisma.licenceEvent.create({ data: { licenceId: l.id, kind: "RENEWED", actorId: user.id, note: `Renewal application ${referenceNo} opened` } });
      await audit(user.orgId, user.id, "licence.renewal", "Licence", n.id, { from: l.referenceNo, referenceNo });
      const full = await prisma.licence.findUnique({ where: { id: n.id }, include: detailInclude });
      return ok({ ...serializeLicence(full!), renewalOf: l.id }, { status: 201 });
    }
    case "suspend": if (!body.note) throw badRequest("Give the reason for suspension"); kind = "SUSPENDED"; toStatus = "SUSPENDED"; break;
    case "reinstate": kind = "REINSTATED"; toStatus = l.expiresAt && l.expiresAt < new Date() ? "EXPIRED" : "ISSUED"; break;
    case "revoke": if (!body.note) throw badRequest("Give the reason for revocation"); kind = "REVOKED"; toStatus = "REVOKED"; break;
    case "cancel": kind = "CANCELLED"; toStatus = "CANCELLED"; break;
    case "document": if (!body.documents) throw badRequest("Nothing to update"); kind = "DOCUMENT"; data.documents = body.documents; note = `${body.documents.filter((d) => d.received).length} of ${body.documents.length} documents received`; break;
    case "note": if (!body.note) throw badRequest("Write a note"); break;
  }

  const updated = await prisma.licence.update({ where: { id: l.id }, data: { ...data, ...(toStatus ? { status: toStatus } : {}), events: { create: { kind, fromStatus: toStatus ? l.status : null, toStatus, actorId: user.id, note } } }, include: detailInclude });
  if (notifyText && notifyIds.length) await notify(user.orgId, notifyIds, { ...notifyText, link: `/app/licences?open=${l.id}` });
  if (toStatus && ["APPROVED", "ISSUED", "REJECTED", "SUSPENDED", "REVOKED"].includes(toStatus) && l.officerId && l.officerId !== user.id) {
    await notify(user.orgId, [l.officerId], { title: `${l.referenceNo}: ${LICENCE_STATUS_LABELS[toStatus as keyof typeof LICENCE_STATUS_LABELS]}`, body: `${l.type.name} for ${l.tradingName || l.applicantName}${note ? ` · ${note}` : ""}`, link: `/app/licences?open=${l.id}`, type: toStatus === "ISSUED" || toStatus === "APPROVED" ? "SUCCESS" : "WARNING" });
  }
  const applicantKind: Record<string, "inspection" | "approved" | "issued" | "rejected" | "suspended" | "revoked"> = { INSPECTION: "inspection", APPROVED: "approved", ISSUED: "issued", REJECTED: "rejected", SUSPENDED: "suspended", REVOKED: "revoked" };
  if (toStatus && applicantKind[toStatus]) void notifyApplicant(updated, applicantKind[toStatus], toStatus === "APPROVED" ? (body.conditions || null) : note);
  await audit(user.orgId, user.id, `licence.${body.action}`, "Licence", l.id, { referenceNo: l.referenceNo, from: l.status, to: toStatus });
  return ok(serializeLicence(updated));
});
