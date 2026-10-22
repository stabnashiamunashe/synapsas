import { prisma } from "@/lib/prisma";
import { forbidden, notFound, ok, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { audit } from "@/lib/notify";

export const DELETE = withAuth(async (_req, { params, user }) => {
  const d = await prisma.delegation.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!d) throw notFound();
  if (d.fromUserId !== user.id && !hasRole(user, "ADMIN")) throw forbidden();
  await prisma.delegation.update({ where: { id: d.id }, data: { isActive: false } });
  await audit(user.orgId, user.id, "delegation.ended", "Delegation", d.id);
  return ok({ id: d.id, isActive: false });
});
