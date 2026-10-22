import { prisma } from "@/lib/prisma";
import { notFound, ok, withAuth } from "@/lib/api";

export const POST = withAuth(async (_req, { params, user }) => {
  const n = await prisma.notification.findFirst({ where: { id: params.id, userId: user.id } });
  if (!n) throw notFound();
  const updated = await prisma.notification.update({ where: { id: n.id }, data: { readAt: n.readAt ?? new Date() } });
  return ok(updated);
});
