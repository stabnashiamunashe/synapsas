import { prisma } from "@/lib/prisma";
import { notFound, ok, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";

export const DELETE = withAuth(async (_req, { params, user }) => {
  const key = await prisma.apiKey.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!key) throw notFound();
  await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
  await audit(user.orgId, user.id, "apikey.revoked", "ApiKey", key.id, { name: key.name });
  return ok({ id: key.id, revoked: true });
}, "ADMIN");
