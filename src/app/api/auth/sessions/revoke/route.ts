import { prisma } from "@/lib/prisma";
import { forbidden, ok, withAuth } from "@/lib/api";
import { issueSessionFor } from "@/lib/auth";
import { clientInfo } from "@/lib/security";
import { audit } from "@/lib/notify";

/** "Sign out everywhere": bumps the session version so every other cookie is rejected, keeps this one. */
export const POST = withAuth(async (req, { user }) => {
  if (user.viaApiKey) throw forbidden("Not available to API keys");
  const updated = await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await audit(user.orgId, user.id, "auth.sessions_revoked", "User", user.id, {}, clientInfo(req));
  await issueSessionFor(updated);
  return ok({ revoked: true });
});
