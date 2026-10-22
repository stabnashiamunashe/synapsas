import { prisma } from "@/lib/prisma";
import { ok, withAuth } from "@/lib/api";
import { newTotpSecret, totpUri } from "@/lib/totp";

/** Start enrolment: store a pending secret and return the otpauth URL for a QR code. */
export const POST = withAuth(async (_req, { user }) => {
  const secret = newTotpSecret();
  const org = await prisma.organization.findUnique({ where: { id: user.orgId }, select: { name: true } });
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
  return ok({ secret, uri: totpUri(secret, `${user.email} (${org?.name || "workspace"})`) });
});
