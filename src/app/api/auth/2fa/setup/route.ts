import { prisma } from "@/lib/prisma";
import { forbidden, ok, withAuth } from "@/lib/api";
import { newTotpSecret, storeTotpSecret, totpUri } from "@/lib/totp";

/** Start enrolment: store a pending (encrypted) secret and return the otpauth URL for a QR code. The secret is shown once. */
export const POST = withAuth(async (_req, { user }) => {
  if (user.viaApiKey) throw forbidden("Not available to API keys");
  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { twoFactorEnabled: true } });
  if (current?.twoFactorEnabled) throw forbidden("Two-factor authentication is already enabled. Disable it first to re-enrol.");
  const secret = newTotpSecret();
  const org = await prisma.organization.findUnique({ where: { id: user.orgId }, select: { name: true } });
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: storeTotpSecret(secret), twoFactorEnabled: false, twoFactorLastStep: null } });
  return ok({ secret, uri: totpUri(secret, `${user.email} (${org?.name || "workspace"})`) });
});
