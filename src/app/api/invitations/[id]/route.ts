import { prisma } from "@/lib/prisma";
import { notFound, ok, withAuth } from "@/lib/api";

export const DELETE = withAuth(async (_req, { params, user }) => {
  const inv = await prisma.invitation.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!inv) throw notFound();
  await prisma.invitation.delete({ where: { id: inv.id } });
  return ok({ id: inv.id });
}, "ADMIN");
