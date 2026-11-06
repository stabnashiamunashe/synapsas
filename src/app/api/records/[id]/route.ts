import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { audit, notify } from "@/lib/notify";
import { recordDetailInclude, recordInclude, recordScope, recordStakeholders, registryAccess, serializeRecord } from "@/lib/records";
import { RECORD_DONE } from "@/lib/recordTypes";
import type { SessionUser } from "@/lib/types";
import { recordSchema } from "../route";

const d = (v: string | null | undefined) => (v ? new Date(v) : null);
const done = (status: string) => RECORD_DONE.includes(status as (typeof RECORD_DONE)[number]);

async function load(id: string, user: SessionUser) {
  const access = await registryAccess(user);
  const r = await prisma.correspondence.findFirst({ where: { id, orgId: user.orgId, AND: [recordScope(user, access)] } });
  if (!r) throw notFound();
  return { r, access };
}

export const GET = withAuth(async (_req, { params, user }) => {
  const { r } = await load(params.id, user);
  const full = await prisma.correspondence.findUnique({ where: { id: r.id }, include: recordDetailInclude });
  return ok(serializeRecord(full!));
});

/** Edit the register entry (registry / managers, or the officer who registered an outgoing draft). */
export const PATCH = withAuth(async (req, { params, user }) => {
  const { r, access } = await load(params.id, user);
  if (!access.canRegister && !(r.registeredById === user.id && r.status === "DRAFT")) throw forbidden("Only the registry or a manager can edit a register entry");
  const body = await parseBody(req, recordSchema.omit({ direction: true, dispatched: true, replyToId: true }).partial());
  if (body.fileId && !(await prisma.recordFile.findFirst({ where: { id: body.fileId, orgId: user.orgId }, select: { id: true } }))) throw badRequest("File not found");
  const opt = <T,>(v: T | null | undefined) => (v === undefined ? undefined : v || null);
  const date = (v: string | null | undefined) => (v === undefined ? undefined : d(v));
  const updated = await prisma.correspondence.update({
    where: { id: r.id },
    data: {
      docType: body.docType, subject: body.subject, summary: opt(body.summary), party: body.party, contactName: opt(body.contactName), contactDetails: opt(body.contactDetails), theirRef: opt(body.theirRef), letterDate: date(body.letterDate), dateLogged: body.dateLogged ? new Date(body.dateLogged) : undefined,
      method: body.method, priority: body.priority, confidential: body.confidential, pages: body.pages === undefined ? undefined : body.pages, enclosures: opt(body.enclosures), actionRequired: opt(body.actionRequired), actionDue: date(body.actionDue), fileId: opt(body.fileId), relatedRef: opt(body.relatedRef),
      dispatchedById: opt(body.dispatchedById), trackingNo: opt(body.trackingNo), signedBy: opt(body.signedBy),
      events: { create: { kind: "EDITED", actorId: user.id, note: `Changed: ${Object.keys(body).join(", ")}` } },
    },
    include: recordInclude,
  });
  await audit(user.orgId, user.id, "record.updated", "Correspondence", r.id, { referenceNo: r.referenceNo, fields: Object.keys(body) });
  return ok(serializeRecord(updated));
});

const actionSchema = z.object({
  action: z.enum(["route", "start", "dispatch", "acknowledge", "file", "reopen", "note", "extend"]),
  departmentId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  actionRequired: z.string().max(255).optional().nullable(),
  actionDue: z.string().optional().nullable(),
  fileId: z.string().optional().nullable(),
  dispatchedById: z.string().max(120).optional().nullable(),
  trackingNo: z.string().max(80).optional().nullable(),
  dateLogged: z.string().optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

/**
 * Lifecycle actions. Incoming: route (to a department and/or action officer), start, extend (new action date), file, reopen.
 * Outgoing: dispatch, acknowledge, file, reopen. Replies are registered as outgoing items with replyToId (POST /api/records).
 */
export const POST = withAuth(async (req, { params, user }) => {
  const { r, access } = await load(params.id, user);
  const body = await parseBody(req, actionSchema);
  const isOwner = r.assignedToId === user.id || r.registeredById === user.id || access.headOfIds.includes(r.departmentId || "");
  const registryOnly = ["route", "file", "reopen", "extend"];
  if (registryOnly.includes(body.action) && !access.canRegister && !(body.action === "route" && isOwner)) throw forbidden("Only the registry or a manager can do that");
  if (!access.canRegister && !isOwner && body.action !== "note") throw forbidden("This item is not routed to you");
  const ev = (kind: string, toStatus: string | null, note?: string | null, toUserId?: string | null) => ({ kind, actorId: user.id, fromStatus: r.status, toStatus, note: note || null, toUserId: toUserId || null });
  let data: Record<string, unknown> = {};
  let event: ReturnType<typeof ev>;
  let notifyIds: string[] = [];
  let title = "";
  switch (body.action) {
    case "route": {
      if (r.direction !== "IN") throw badRequest("Only incoming mail is routed");
      if (!body.departmentId && !body.assignedToId) throw badRequest("Choose a department or an action officer");
      let departmentId = body.departmentId || r.departmentId || null;
      if (body.assignedToId) {
        const u = await prisma.user.findFirst({ where: { id: body.assignedToId, orgId: user.orgId, isActive: true }, select: { id: true, departmentId: true } });
        if (!u) throw badRequest("Action officer not found");
        if (!body.departmentId && u.departmentId) departmentId = u.departmentId;
      }
      const reroute = !!(r.assignedToId || r.departmentId);
      const assignedToId = body.assignedToId === undefined ? r.assignedToId : body.assignedToId || null;
      data = { status: done(r.status) ? r.status : "ROUTED", departmentId, assignedToId, actionRequired: body.actionRequired ?? r.actionRequired, actionDue: body.actionDue ? new Date(body.actionDue) : r.actionDue };
      event = ev(reroute ? "REASSIGNED" : "ROUTED", data.status as string, body.note || body.actionRequired || null, body.assignedToId || null);
      notifyIds = await recordStakeholders({ assignedToId, departmentId });
      title = `Correspondence routed to you: ${r.referenceNo}`;
      break;
    }
    case "start":
      if (r.direction !== "IN" || !["RECEIVED", "ROUTED"].includes(r.status)) throw badRequest("This item is not awaiting action");
      data = { status: "IN_PROGRESS", assignedToId: r.assignedToId || user.id };
      event = ev("STARTED", "IN_PROGRESS", body.note);
      break;
    case "extend":
      if (!body.actionDue) throw badRequest("Choose the new action date");
      data = { actionDue: new Date(body.actionDue) };
      event = ev("NOTE", null, `Action date moved to ${body.actionDue}${body.note ? `: ${body.note}` : ""}`);
      notifyIds = await recordStakeholders(r);
      title = `New action date for ${r.referenceNo}`;
      break;
    case "dispatch": {
      if (r.direction !== "OUT" || r.status !== "DRAFT") throw badRequest("Only outgoing mail awaiting dispatch can be dispatched");
      data = { status: "DISPATCHED", dateLogged: body.dateLogged ? new Date(body.dateLogged) : new Date(), dispatchedById: body.dispatchedById || r.dispatchedById, trackingNo: body.trackingNo || r.trackingNo };
      event = ev("DISPATCHED", "DISPATCHED", [body.dispatchedById ? `by ${body.dispatchedById}` : "", body.trackingNo ? `tracking ${body.trackingNo}` : "", body.note || ""].filter(Boolean).join(" · ") || null);
      if (r.replyToId) {
        const orig = await prisma.correspondence.findUnique({ where: { id: r.replyToId } });
        if (orig && !done(orig.status)) await prisma.correspondence.update({ where: { id: orig.id }, data: { status: "REPLIED", repliedAt: new Date(), events: { create: { kind: "REPLIED", actorId: user.id, fromStatus: orig.status, toStatus: "REPLIED", note: `Reply ${r.referenceNo} dispatched` } } } });
      }
      break;
    }
    case "acknowledge":
      if (r.direction !== "OUT" || r.status !== "DISPATCHED") throw badRequest("Only dispatched mail can be acknowledged");
      data = { status: "ACKNOWLEDGED" };
      event = ev("ACKNOWLEDGED", "ACKNOWLEDGED", body.note);
      break;
    case "file": {
      if (r.status === "FILED") throw badRequest("Already filed");
      if (r.direction === "OUT" && r.status === "DRAFT") throw badRequest("Dispatch the letter before filing it, or edit the entry if it was never sent");
      const fileId = body.fileId || r.fileId;
      if (!fileId) throw badRequest("Choose the file this item is placed on");
      const f = await prisma.recordFile.findFirst({ where: { id: fileId, orgId: user.orgId } });
      if (!f) throw badRequest("File not found");
      if (f.status === "CLOSED") throw badRequest(`File ${f.fileNo} is closed; reopen it or choose another file`);
      data = { status: "FILED", fileId, filedAt: new Date() };
      event = ev("FILED", "FILED", `Placed on file ${f.fileNo} ${f.title}${body.note ? ` · ${body.note}` : ""}`);
      break;
    }
    case "reopen":
      if (!done(r.status)) throw badRequest("This item is still open");
      data = { status: r.direction === "IN" ? (r.assignedToId ? "ROUTED" : "RECEIVED") : "DISPATCHED", filedAt: null, actionDue: body.actionDue ? new Date(body.actionDue) : r.actionDue };
      event = ev("REOPENED", data.status as string, body.note);
      notifyIds = await recordStakeholders(r);
      title = `Correspondence reopened: ${r.referenceNo}`;
      break;
    case "note":
    default:
      if (!body.note?.trim()) throw badRequest("Write the note");
      event = ev("NOTE", null, body.note.trim());
  }
  const updated = await prisma.correspondence.update({ where: { id: r.id }, data: { ...data, events: { create: event } }, include: recordDetailInclude });
  notifyIds = notifyIds.filter((id) => id !== user.id);
  if (notifyIds.length) await notify(user.orgId, notifyIds, { title, body: `${r.subject} (${r.direction === "IN" ? "from" : "to"} ${r.party}).${updated.actionRequired ? ` Action: ${updated.actionRequired}.` : ""}${updated.actionDue ? ` Due ${updated.actionDue.toISOString().slice(0, 10)}.` : ""}`, link: `/app/records?open=${r.id}`, type: body.action === "route" ? "APPROVAL" : "INFO" });
  await audit(user.orgId, user.id, `record.${body.action}`, "Correspondence", r.id, { referenceNo: r.referenceNo, status: updated.status, assignedToId: updated.assignedToId });
  return ok(serializeRecord(updated));
});
