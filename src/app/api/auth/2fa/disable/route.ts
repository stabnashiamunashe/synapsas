import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, ok, parseBody, withAuth } from "@/lib/api";
import { twoFactorDisableSchema } from "@/lib/validators";
import { verifyPassword } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { clientInfo, hashBackupCode, rateLimit } from "@/lib/security";
import { audit } from "@/lib/notify";
import { parseJson } from "@/lib/json";
import { sendTwoFactorAlert } from "@/lib/emails";

/** Disabling requires the password AND a current code (or backup code). Blocked when the workspace mandates 2FA for the role. */
export const POST = withAuth(async (req, { user }) => {
  if (user.viaApiKey) throw forbidden("Not available to API keys");
  const rl = rateLimit(`2fa-disable:${user.id}`, 5, 15 * 60 * 1000);
  if (!rl.ok) throw badRequest("Too many attempts. Try again later.");
  const { password, code } = await parseBody(req, twoFactorDisableSchema);
  const u = await prisma.user.findUnique({ where: { id: user.id }, include: { org: { select: { settings: true } } } });
  if (!u) throw badRequest("User missing");
  const ctx = clientInfo(req);
  if (!(await verifyPassword(password, u.passwordHash))) {
    await audit(u.orgId, u.id, "auth.2fa_disable_failed", "User", u.id, {}, ctx);
    throw forbidden("Password is incorrect");
  }
  const okCode =
    (u.twoFactorSecret && verifyTotp(u.twoFactorSecret, code, u.twoFactorLastStep).ok) ||
    parseJson<string[]>(u.backupCodes, []).includes(hashBackupCode(code));
  if (!okCode) throw forbidden("Code is not valid");
  const settings = parseJson<{ require2faForAdmins?: boolean }>(u.org.settings, {});
  if (settings.require2faForAdmins && ["OWNER", "ADMIN"].includes(u.role)) throw forbidden("Your workspace requires two-factor authentication for administrators");
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorLastStep: null, backupCodes: "[]" } });
  await audit(user.orgId, user.id, "auth.2fa_disabled", "User", user.id, {}, ctx);
  void sendTwoFactorAlert(u, ctx, false);
  return ok({ enabled: false });
});
