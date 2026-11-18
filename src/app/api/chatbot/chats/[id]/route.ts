import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notFound, ok, parseBody, withAuth } from "@/lib/api";
import { caseScope } from "@/lib/cases";
import { clientInfo } from "@/lib/security";
import { CASE_DONE } from "@/lib/caseTypes";
import { LIVE_CHAT_WHERE, liveChatAction, maskPhone } from "@/lib/whatsapp/desk";

/** One live chat: the messages both ways (public comments), internal notes, attachments and the timeline. */
export const GET = withAuth(async (_req, { params, user }) => {
  const scope = await caseScope(user);
  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: user.orgId, ...scope, ...LIVE_CHAT_WHERE },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } }, category: { select: { id: true, name: true } }, department: { select: { id: true, name: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      attachments: { orderBy: { createdAt: "asc" } }, events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) throw notFound("Chat not found");
  const session = c.reporterPhone ? await prisma.whatsAppSession.findUnique({ where: { phone: c.reporterPhone.replace(/\D/g, "") }, select: { id: true, step: true, lastInteractionAt: true } }) : null;
  return ok({
    id: c.id, referenceNo: c.referenceNo, title: c.title, description: c.description, status: c.status, priority: c.priority, version: c.version, reporterName: c.reporterName, phone: c.reporterPhone ? maskPhone(c.reporterPhone) : null,
    assignee: c.assignee, category: c.category, department: c.department, createdAt: c.createdAt, lastActivityAt: c.lastActivityAt, resolvedAt: c.resolvedAt,
    ended: CASE_DONE.includes(c.status as (typeof CASE_DONE)[number]), mine: c.assigneeId === user.id,
    // the person is still inside the chat step of the bot (their messages come straight here)
    personInChat: session?.step === "CHAT", sessionId: session?.id || null,
    messages: c.comments.map((m) => ({ id: m.id, body: m.body, isInternal: m.isInternal, fromOfficer: !!m.userId, authorName: m.authorName, user: m.user, createdAt: m.createdAt })),
    attachments: c.attachments.map((a) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, size: a.size, createdAt: a.createdAt })),
    events: c.events.map((e) => ({ id: e.id, fromStatus: e.fromStatus, toStatus: e.toStatus, changedByName: e.changedByName, reason: e.reason, createdAt: e.createdAt })),
  });
});

/** Officer actions: `accept` (take the chat), `reply` (text delivered to WhatsApp at once), `end` (close it; the person returns to the menu). */
export const POST = withAuth(async (req, { params, user }) => {
  const scope = await caseScope(user);
  const exists = await prisma.case.findFirst({ where: { id: params.id, orgId: user.orgId, ...scope, ...LIVE_CHAT_WHERE }, select: { id: true } });
  if (!exists) throw notFound("Chat not found");
  const { action, text } = await parseBody(req, z.object({ action: z.enum(["accept", "reply", "end"]), text: z.string().max(4000).optional() }));
  return ok(await liveChatAction(user.orgId, params.id, action, text, user, clientInfo(req)));
});
