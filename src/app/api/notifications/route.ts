import { prisma } from "@/lib/prisma";
import { getQuery, ok, withAuth } from "@/lib/api";

export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const unreadOnly = q.get("unread") === "1";
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return ok({ items, unread });
});

/** Mark all as read. */
export const POST = withAuth(async (_req, { user }) => {
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return ok({ unread: 0 });
});
