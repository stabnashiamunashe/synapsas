import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, ok, parseBody, withAuth } from "@/lib/api";
import { twoFactorEnableSchema } from "@/lib/validators";
import { verifyTotp } from "@/lib/totp";
import { generateBackupCodes, clientInfo, rateLimit } from "@/lib/security";
import { audit } from "@/lib/notify";
import { toJson } from "@/lib/json";
import { sendTwoFactorAlert } from "@/lib/emails";

/** Finish enrolment by proving the authenticator works. Returns backup codes once. */
export const POST = withAuth(async (req, { user }) => {
  if (user.viaApiKey) throw forbidden("Not available to API keys");
  const rl = rateLimit(`2fa-enable:${user.id}`, 10, 10 * 60 * 1000);
  if (!rl.ok) throw badRequest("Too many attempts. Try again later.");
  const { code } = await parseBody(req, twoFactorEnableSchema);
  const u = await prisma.user.findUnique({ where: { id: user.id } });
  if (!u?.twoFactorSecret) throw badRequest("Start 2FA setup first");
  const res = verifyTotp(u.twoFactorSecret, code, null);
  if (!res.ok) throw badRequest("That code is not valid. Check the time on your device and try again.");
  const { codes, hashes } = generateBackupCodes();
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, twoFactorLastStep: res.step, backupCodes: toJson(hashes) } });
  const ctx = clientInfo(req);
  await audit(user.orgId, user.id, "auth.2fa_enabled", "User", user.id, {}, ctx);
  void sendTwoFactorAlert(u, ctx, true);
  return ok({ enabled: true, backupCodes: codes });
});
