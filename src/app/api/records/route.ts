import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, getQuery, ok, parseBody, withAuth } from "@/lib/api";
import { audit, notify } from "@/lib/notify";
import { nextRecordReference, recordInclude, recordScope, recordStakeholders, registryAccess, serializeRecord } from "@/lib/records";
import { DIRECTIONS, DOC_TYPES, METHODS, RECORD_DONE } from "@/lib/recordTypes";

export const recordSchema = z.object({
  direction: z.enum(DIRECTIONS),
  docType: z.enum(DOC_TYPES).optional(),
  subject: z.string().min(3).max(255),
  summary: z.string().max(5000).optional().nullable(),
  party: z.string().min(2).max(200),
  contactName: z.string().max(120).optional().nullable(),
  contactDetails: z.string().max(200).optional().nullable(),
  theirRef: z.string().max(80).optional().nullable(),
  letterDate: z.string().optional().nullable(),
  dateLogged: z.string().optional().nullable(),
  method: z.enum(METHODS).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  confidential: z.boolean().optional(),
  pages: z.number().int().min(0).max(10000).optional().nullable(),
  enclosures: z.string().max(255).optional().nullable(),
  actionRequired: z.string().max(255).optional().nullable(),
  actionDue: z.string().optional().nullable(),
  fileId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  replyToId: z.string().optional().nullable(),
  relatedRef: z.string().max(60).optional().nullable(),
  dispatchedById: z.string().max(120).optional().nullable(),
  trackingNo: z.string().max(80).optional().nullable(),
  signedBy: z.string().max(120).optional().nullable(),
  /** OUT only: register as already dispatched (default) or as a draft awaiting dispatch */
  dispatched: z.boolean().optional(),
});

const d = (v: string | null | undefined) => (v ? new Date(v) : null);

/**
 * Correspondence register. Filters: direction=IN|OUT, status=A,B, scope=mine|dept|open|overdue, q=, fileId=, departmentId=, assignedToId=,
 * docType=, from=/to= (dateLogged). ?format=csv exports the filtered list. Also returns counts for the dashboard tiles and the caller's access.
 */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const access = await registryAccess(user);
  const and: Prisma.CorrespondenceWhereInput[] = [recordScope(user, access)];
  const where: Prisma.CorrespondenceWhereInput = { orgId: user.orgId, AND: and };
  if (q.get("direction") === "IN" || q.get("direction") === "OUT") where.direction = q.get("direction")!;
  if (q.get("status")) where.status = { in: q.get("status")!.split(",") };
  if (q.get("fileId")) where.fileId = q.get("fileId")!;
  if (q.get("departmentId")) where.departmentId = q.get("departmentId")!;
  if (q.get("assignedToId")) where.assignedToId = q.get("assignedToId")!;
  if (q.get("docType")) where.docType = q.get("docType")!;
  if (q.get("from")) and.push({ dateLogged: { gte: new Date(q.get("from")!) } });
  if (q.get("to")) and.push({ dateLogged: { lte: new Date(q.get("to")! + "T23:59:59") } });
  const scope = q.get("scope");
  if (scope === "mine") and.push({ OR: [{ assignedToId: user.id }, { registeredById: user.id, status: "DRAFT" }] });
  if (scope === "dept" && access.departmentId) and.push({ departmentId: access.departmentId });
  if (scope === "open") where.status = { notIn: [...RECORD_DONE] };
  if (scope === "overdue") and.push({ actionDue: { lt: new Date() }, status: { notIn: [...RECORD_DONE] } });
  const s = q.get("q")?.trim();
  if (s) and.push({ OR: [{ referenceNo: { contains: s } }, { subject: { contains: s } }, { party: { contains: s } }, { theirRef: { contains: s } }, { contactName: { contains: s } }, { relatedRef: { contains: s } }, { file: { fileNo: { contains: s } } }] });
  const list = await prisma.correspondence.findMany({ where, include: recordInclude, orderBy: [{ dateLogged: "desc" }, { referenceNo: "desc" }], take: 2000 });
  if (q.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Registry no", "Direction", "Type", "Date", "Letter date", "From / to", "Contact", "Their ref", "Subject", "File", "Department", "Action officer", "Status", "Action due", "Method", "Related ref", "Confidential"];
    const body = list.map((r) => [r.referenceNo, r.direction === "IN" ? "Incoming" : "Outgoing", r.docType, r.dateLogged.toISOString().slice(0, 10), r.letterDate?.toISOString().slice(0, 10), r.party, r.contactName, r.theirRef, r.subject, r.file?.fileNo, r.department?.name, r.assignedTo?.name, r.status, r.actionDue?.toISOString().slice(0, 10), r.method, r.relatedRef, r.confidential ? "yes" : ""].map(esc).join(","));
    return new Response([head.map(esc).join(","), ...body].join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="correspondence-register-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
  }
  const visible: Prisma.CorrespondenceWhereInput = { orgId: user.orgId, AND: [recordScope(user, access)] };
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [byStatus, overdue, mine, receivedMonth, dispatchedMonth] = await Promise.all([
    prisma.correspondence.groupBy({ by: ["direction", "status"], where: visible, _count: { _all: true } }),
    prisma.correspondence.count({ where: { ...visible, actionDue: { lt: now }, status: { notIn: [...RECORD_DONE] } } }),
    prisma.correspondence.count({ where: { orgId: user.orgId, assignedToId: user.id, status: { notIn: [...RECORD_DONE] } } }),
    prisma.correspondence.count({ where: { ...visible, direction: "IN", dateLogged: { gte: monthStart } } }),
    prisma.correspondence.count({ where: { ...visible, direction: "OUT", status: { not: "DRAFT" }, dateLogged: { gte: monthStart } } }),
  ]);
  const counts: Record<string, number> = { overdue, mine, receivedMonth, dispatchedMonth };
  for (const c of byStatus) counts[`${c.direction}_${c.status}`] = c._count._all;
  return ok({ items: list.map(serializeRecord), counts, access: { canRegister: access.canRegister, isClerk: access.isClerk, departmentId: access.departmentId } });
});

/** Register a new item of incoming or outgoing correspondence. Registry clerks and managers register anything; other officers may register outgoing mail from their department. */
export const POST = withAuth(async (req, { user }) => {
  const access = await registryAccess(user);
  const body = await parseBody(req, recordSchema);
  if (!access.canRegister && body.direction === "IN") throw forbidden("Only the registry or a manager can register incoming mail");
  if (body.assignedToId && !(await prisma.user.findFirst({ where: { id: body.assignedToId, orgId: user.orgId, isActive: true }, select: { id: true } }))) throw badRequest("Action officer not found");
  if (body.fileId && !(await prisma.recordFile.findFirst({ where: { id: body.fileId, orgId: user.orgId }, select: { id: true } }))) throw badRequest("File not found");
  const replyTo = body.replyToId ? await prisma.correspondence.findFirst({ where: { id: body.replyToId, orgId: user.orgId, direction: "IN" } }) : null;
  if (body.replyToId && !replyTo) throw badRequest("The incoming item this replies to was not found");
  const referenceNo = await nextRecordReference(user.orgId, body.direction, access.settings.prefix);
  const dispatched = body.direction === "OUT" ? body.dispatched !== false : false;
  const status = body.direction === "IN" ? (body.assignedToId || body.departmentId ? "ROUTED" : "RECEIVED") : dispatched ? "DISPATCHED" : "DRAFT";
  const actionDue = body.direction === "IN" ? d(body.actionDue) || new Date(Date.now() + access.settings.replyDays * 86400000) : d(body.actionDue);
  const departmentId = body.departmentId || (body.direction === "OUT" ? access.departmentId : null) || null;
  const method = (body.method || "HAND").toLowerCase().replace("_", " ");
  const events: Prisma.CorrespondenceEventCreateWithoutRecordInput[] = [{ kind: "REGISTERED", actor: { connect: { id: user.id } }, toStatus: status, note: body.direction === "IN" ? `Received ${method} from ${body.party}` : dispatched ? `Dispatched ${method} to ${body.party}` : `Registered for dispatch to ${body.party}` }];
  if (body.direction === "IN" && (body.assignedToId || departmentId)) events.push({ kind: "ROUTED", actor: { connect: { id: user.id } }, toUserId: body.assignedToId || null, note: body.actionRequired || null });
  const r = await prisma.correspondence.create({
    data: {
      orgId: user.orgId, referenceNo, direction: body.direction, docType: body.docType || "LETTER", subject: body.subject, summary: body.summary || null, party: body.party, contactName: body.contactName || null, contactDetails: body.contactDetails || null,
      theirRef: body.theirRef || null, letterDate: d(body.letterDate), dateLogged: d(body.dateLogged) || new Date(), method: body.method || "HAND", status, priority: body.priority || "MEDIUM", confidential: body.confidential ?? false, pages: body.pages ?? null, enclosures: body.enclosures || null,
      actionRequired: body.actionRequired || null, actionDue, fileId: body.fileId || replyTo?.fileId || null, departmentId, assignedToId: body.assignedToId || null, registeredById: user.id, replyToId: replyTo?.id || null, relatedRef: body.relatedRef || null,
      dispatchedById: body.dispatchedById || null, trackingNo: body.trackingNo || null, signedBy: body.signedBy || null, events: { create: events },
    },
    include: recordInclude,
  });
  if (replyTo && dispatched && !RECORD_DONE.includes(replyTo.status as (typeof RECORD_DONE)[number])) {
    await prisma.correspondence.update({ where: { id: replyTo.id }, data: { status: "REPLIED", repliedAt: new Date(), events: { create: { kind: "REPLIED", actorId: user.id, fromStatus: replyTo.status, toStatus: "REPLIED", note: `Reply ${referenceNo} dispatched` } } } });
  }
  if (body.direction === "IN") {
    const who = (await recordStakeholders(r)).filter((id) => id !== user.id);
    if (who.length) await notify(user.orgId, who, { title: `Correspondence routed to you: ${referenceNo}`, body: `${body.subject} (from ${body.party}).${body.actionRequired ? ` Action: ${body.actionRequired}.` : ""}${actionDue ? ` Due ${actionDue.toISOString().slice(0, 10)}.` : ""}`, link: `/app/records?open=${r.id}`, type: "APPROVAL" });
  }
  await audit(user.orgId, user.id, "record.registered", "Correspondence", r.id, { referenceNo, direction: body.direction, party: body.party, confidential: r.confidential });
  return ok(serializeRecord(r), { status: 201 });
});
