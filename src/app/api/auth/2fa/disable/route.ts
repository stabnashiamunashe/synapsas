import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, ok, parseBody, withAuth } from "@/lib/api";
import { twoFactorDisableSchema } from "@/lib/validators";
import { verifyPassword } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { clientInfo, hashBackupCode } from "@/lib/security";
import { audit } from "@/lib/notify";
import { parseJson } from "@/lib/json";

/** Disabling requires the password AND a current code (or backup code). */
export const POST = withAuth(async (req, { user }) => {
  const { password, code } = await parseBody(req, twoFactorDisableSchema);
  const u = await prisma.user.findUnique({ where: { id: user.id } });
  if (!u) throw badRequest("User missing");
  if (!(await verifyPassword(password, u.passwordHash))) throw forbidden("Password is incorrect");
  const okCode =
    (u.twoFactorSecret && verifyTotp(u.twoFactorSecret, code)) ||
    parseJson<string[]>(u.backupCodes, []).includes(hashBackupCode(code));
  if (!okCode) throw forbidden("Code is not valid");
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null, backupCodes: "[]" } });
  await audit(user.orgId, user.id, "auth.2fa_disabled", "User", user.id, {}, clientInfo(req));
  return ok({ enabled: false });
});
