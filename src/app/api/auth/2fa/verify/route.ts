import { prisma } from "@/lib/prisma";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { twoFactorVerifySchema } from "@/lib/validators";
import { readTwoFactorChallenge } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { clientInfo, hashBackupCode, rateLimit } from "@/lib/security";
import { audit } from "@/lib/notify";
import { parseJson, toJson } from "@/lib/json";
import { sendBackupCodeUsedAlert } from "@/lib/emails";
import { completeLogin } from "../../login/route";

/** Second step of sign-in: authenticator code (replay-protected) or a one-time backup code. */
export const POST = withPublic(async (req) => {
  const { challenge, code } = await parseBody(req, twoFactorVerifySchema);
  const { ip, userAgent } = clientInfo(req);
  const uid = await readTwoFactorChallenge(challenge);
  if (!uid) throw new ApiError(401, "Sign-in challenge expired. Please enter your password again.");
  const rl = rateLimit(`2fa:${uid}`, 8, 5 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many code attempts. Start again in a few minutes.");

  const u = await prisma.user.findUnique({ where: { id: uid }, include: { org: true } });
  if (!u || !u.isActive || !u.twoFactorEnabled || !u.twoFactorSecret) throw new ApiError(401, "Two-factor not available");

  let via: "totp" | "backup" | null = null;
  let remaining = 0;
  const totp = verifyTotp(u.twoFactorSecret, code, u.twoFactorLastStep);
  if (totp.ok) {
    via = "totp";
    await prisma.user.update({ where: { id: u.id }, data: { twoFactorLastStep: totp.step } });
  } else {
    const hashes = parseJson<string[]>(u.backupCodes, []);
    const h = hashBackupCode(code);
    if (hashes.includes(h)) {
      via = "backup";
      const left = hashes.filter((x) => x !== h);
      remaining = left.length;
      await prisma.user.update({ where: { id: u.id }, data: { backupCodes: toJson(left) } });
    }
  }
  if (!via) {
    await audit(u.orgId, u.id, "auth.2fa_failed", "User", u.id, {}, { ip, userAgent });
    throw new ApiError(401, "That code is not valid");
  }
  if (via === "backup") void sendBackupCodeUsedAlert(u, { ip, userAgent }, remaining);
  await completeLogin(u, { ip, userAgent }, { via });
  return ok({ userId: u.id, orgSlug: u.org.slug, forcePasswordChange: u.forcePasswordChange, usedBackupCode: via === "backup", backupCodesLeft: remaining });
});
