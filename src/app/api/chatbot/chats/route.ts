import { prisma } from "@/lib/prisma";
import { getQuery, ok, withAuth } from "@/lib/api";
import { caseScope } from "@/lib/cases";
import { CASE_DONE } from "@/lib/caseTypes";
import { LIVE_CHAT_WHERE, maskPhone } from "@/lib/whatsapp/desk";

/**
 * Live chats from option 6 ("Talk to an officer"): open ones by default (`?status=ended` for the history). Officers see
 * the chats assigned to them or their section, administrators all of them. Each row carries the last message so the
 * list reads like a chat inbox.
 */
export const GET = withAuth(async (req, { user }) => {
  const scope = await caseScope(user);
  const ended = getQuery(req).get("status") === "ended";
  const items = await prisma.case.findMany({
    where: { orgId: user.orgId, ...scope, ...LIVE_CHAT_WHERE, status: ended ? { in: CASE_DONE } : { notIn: CASE_DONE } },
    orderBy: { lastActivityAt: "desc" }, take: 200,
    include: { assignee: { select: { id: true, name: true, avatarUrl: true } }, category: { select: { id: true, name: true } }, comments: { where: { isInternal: false }, orderBy: { createdAt: "desc" }, take: 1, select: { body: true, authorName: true, userId: true, createdAt: true } }, _count: { select: { comments: true } } },
  });
  return ok(items.map((c) => ({
    id: c.id, referenceNo: c.referenceNo, title: c.title, status: c.status, priority: c.priority, reporterName: c.reporterName, phone: c.reporterPhone ? maskPhone(c.reporterPhone) : null,
    assignee: c.assignee, category: c.category, createdAt: c.createdAt, lastActivityAt: c.lastActivityAt, resolvedAt: c.resolvedAt, messages: c._count.comments,
    last: c.comments[0] ? { body: c.comments[0].body, fromOfficer: !!c.comments[0].userId, authorName: c.comments[0].authorName, createdAt: c.comments[0].createdAt } : null,
    // nobody has answered yet
    waiting: !CASE_DONE.includes(c.status as (typeof CASE_DONE)[number]) && !(c.comments[0] && c.comments[0].userId),
    mine: c.assigneeId === user.id,
  })));
});
