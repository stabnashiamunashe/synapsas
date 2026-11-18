import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { caseScope } from "@/lib/cases";
import { clientInfo } from "@/lib/security";
import { hasRole } from "@/lib/roles";
import { DATA_REQUEST_WHERE, bucketOf, decideDataRequest, describeRequest, maskPhone } from "@/lib/whatsapp/desk";

/** One data request in full: the answers, attachments, the conversation with the requester and the timeline. */
export const GET = withAuth(async (_req, { params, user }) => {
  const scope = await caseScope(user);
  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: user.orgId, ...scope, ...DATA_REQUEST_WHERE },
    include: {
      assignee: { select: { id: true, name: true } }, category: { select: { id: true, name: true } }, department: { select: { id: true, name: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true } } } }, attachments: { orderBy: { createdAt: "asc" } }, events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) throw notFound("Data request not found");
  return ok({
    id: c.id, referenceNo: c.referenceNo, title: c.title, description: c.description, status: c.status, bucket: bucketOf(c.status), priority: c.priority, version: c.version,
    reporterName: c.reporterName, reporterEmail: c.reporterEmail, phone: c.reporterPhone ? maskPhone(c.reporterPhone) : null, assignee: c.assignee, category: c.category, department: c.department,
    createdAt: c.createdAt, resolvedAt: c.resolvedAt, slaDueAt: c.slaDueAt, request: describeRequest(c.customFields),
    comments: c.comments.map((m) => ({ id: m.id, body: m.body, isInternal: m.isInternal, fromStaff: !!m.userId, authorName: m.authorName, createdAt: m.createdAt })),
    attachments: c.attachments.map((a) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, size: a.size, createdAt: a.createdAt })),
    events: c.events.map((e) => ({ id: e.id, fromStatus: e.fromStatus, toStatus: e.toStatus, changedByName: e.changedByName, reason: e.reason, createdAt: e.createdAt })),
    canDecide: hasRole(user, "MANAGER"),
  });
});

/** Decide: `approve` (being prepared), `decline` (reason required) or `deliver` (data sent). The requester is told on WhatsApp and by email. */
export const POST = withAuth(async (req, { params, user }) => {
  if (!hasRole(user, "MANAGER")) throw forbidden("Only section heads and administrators decide on data requests");
  const scope = await caseScope(user);
  const exists = await prisma.case.findFirst({ where: { id: params.id, orgId: user.orgId, ...scope, ...DATA_REQUEST_WHERE }, select: { id: true } });
  if (!exists) throw notFound("Data request not found");
  const { action, note } = await parseBody(req, z.object({ action: z.enum(["approve", "decline", "deliver"]), note: z.string().max(2000).optional() }));
  const updated = await decideDataRequest(user.orgId, params.id, action, note, user, clientInfo(req));
  return ok({ id: updated.id, status: updated.status, bucket: bucketOf(updated.status) });
});
