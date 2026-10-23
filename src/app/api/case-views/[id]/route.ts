import { prisma } from "@/lib/prisma";
import { notFound, ok, withAuth } from "@/lib/api";

export const DELETE = withAuth(async (_req, { params, user }) => {
  const v = await prisma.savedView.findFirst({ where: { id: params.id, userId: user.id } });
  if (!v) throw notFound();
  await prisma.savedView.delete({ where: { id: v.id } });
  return ok({ id: v.id });
});
