import { prisma } from "@/lib/prisma";
import { ok, withAuth } from "@/lib/api";
import { DATA_LOG_KINDS, DATA_REQUEST_WHERE, LIVE_CHAT_WHERE } from "@/lib/whatsapp/desk";
import { topicLabel } from "@/lib/whatsapp/i18n";

/** Numbers for the WhatsApp desk overview: conversations, traffic, live chats, data requests and what the bot handed out. */
export const GET = withAuth(async (_req, { user }) => {
  const orgId = user.orgId;
  const day = new Date(Date.now() - 86400_000);
  const week = new Date(Date.now() - 7 * 86400_000);
  const [convDay, convWeek, msgIn, msgOut, failed, chatsWaiting, chatsActive, drPending, drApproved, drDelivered, drDeclined, handedWeek, byKind, byTopic, recentCases, subscribers] = await Promise.all([
    prisma.whatsAppSession.count({ where: { orgId, lastInteractionAt: { gte: day } } }),
    prisma.whatsAppSession.count({ where: { orgId, lastInteractionAt: { gte: week } } }),
    prisma.whatsAppMessage.count({ where: { orgId, direction: "IN", createdAt: { gte: week } } }),
    prisma.whatsAppMessage.count({ where: { orgId, direction: "OUT", createdAt: { gte: week } } }),
    prisma.whatsAppMessage.count({ where: { orgId, direction: "OUT", status: "failed", createdAt: { gte: week } } }),
    prisma.case.count({ where: { orgId, ...LIVE_CHAT_WHERE, status: { in: ["NEW", "TRIAGED", "ASSIGNED"] } } }),
    prisma.case.count({ where: { orgId, ...LIVE_CHAT_WHERE, status: { in: ["IN_PROGRESS", "ON_HOLD", "REOPENED"] } } }),
    prisma.case.count({ where: { orgId, ...DATA_REQUEST_WHERE, status: { in: ["NEW", "TRIAGED", "ASSIGNED", "REOPENED"] } } }),
    prisma.case.count({ where: { orgId, ...DATA_REQUEST_WHERE, status: { in: ["IN_PROGRESS", "ON_HOLD"] } } }),
    prisma.case.count({ where: { orgId, ...DATA_REQUEST_WHERE, status: { in: ["RESOLVED", "CLOSED"] } } }),
    prisma.case.count({ where: { orgId, ...DATA_REQUEST_WHERE, status: "REJECTED" } }),
    prisma.chatbotDataLog.count({ where: { orgId, createdAt: { gte: week } } }),
    prisma.chatbotDataLog.groupBy({ by: ["kind"], where: { orgId, createdAt: { gte: week } }, _count: { _all: true } }),
    prisma.chatbotDataLog.groupBy({ by: ["topic"], where: { orgId, createdAt: { gte: week }, topic: { not: null } }, _count: { _all: true }, orderBy: { _count: { topic: "desc" } }, take: 6 }),
    prisma.case.findMany({ where: { orgId, source: "WHATSAPP" }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, referenceNo: true, title: true, status: true, createdAt: true, reporterName: true } }),
    prisma.statSubscription.count({ where: { orgId, isActive: true } }),
  ]);
  return ok({
    conversations: { day: convDay, week: convWeek },
    messages: { in: msgIn, out: msgOut, failed },
    chats: { waiting: chatsWaiting, active: chatsActive },
    dataRequests: { pending: drPending, approved: drApproved, delivered: drDelivered, declined: drDeclined },
    handedOut: {
      week: handedWeek,
      byKind: Object.fromEntries(DATA_LOG_KINDS.map((k) => [k, byKind.find((x) => x.kind === k)?._count._all || 0])),
      byTopic: byTopic.map((x) => ({ topic: x.topic || "", name: topicLabel(x.topic || "", "en"), count: x._count._all })),
    },
    recentCases, subscribers,
  });
});
