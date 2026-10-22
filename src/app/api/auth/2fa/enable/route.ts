import { prisma } from "@/lib/prisma";
import { badRequest, ok, parseBody, withAuth } from "@/lib/api";
import { twoFactorEnableSchema } from "@/lib/validators";
import { verifyTotp } from "@/lib/totp";
import { generateBackupCodes, clientInfo } from "@/lib/security";
import { audit } from "@/lib/notify";
import { toJson } from "@/lib/json";

/** Finish enrolment by proving the authenticator works. Returns backup codes once. */
export const POST = withAuth(async (req, { user }) => {
  const { code } = await parseBody(req, twoFactorEnableSchema);
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { twoFactorSecret: true, twoFactorEnabled: true } });
  if (!u?.twoFactorSecret) throw badRequest("Start 2FA setup first");
  if (!verifyTotp(u.twoFactorSecret, code)) throw badRequest("That code is not valid. Check the time on your device and try again.");
  const { codes, hashes } = generateBackupCodes();
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, backupCodes: toJson(hashes) } });
  await audit(user.orgId, user.id, "auth.2fa_enabled", "User", user.id, {}, clientInfo(req));
  return ok({ enabled: true, backupCodes: codes });
});
