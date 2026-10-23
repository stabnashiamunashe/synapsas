import { prisma } from "@/lib/prisma";
import { issueSessionFor, signTwoFactorChallenge, verifyPassword } from "@/lib/auth";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { loginSchema } from "@/lib/validators";
import { audit } from "@/lib/notify";
import { clientInfo, deviceLabel, rateLimit } from "@/lib/security";
import { parseJson } from "@/lib/json";
import { mailConfigured } from "@/lib/mailer";
import { sendAccountLockedAlert, sendNewDeviceAlert } from "@/lib/emails";
import { emailVerificationRequired } from "@/lib/verification";
import type { OrgSettings } from "@/lib/types";

const LOCK_MINUTES = 15;
// bcrypt hash of a random string, used so unknown emails cost the same time as known ones.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8Zt0Q7bC4E4y1pPq9FzJ7e3c9G8ZQ2";

/**
 * Password step of sign-in (OWASP ASVS V2.2 / V2.7).
 * - IP + email rate limiting (10 attempts / 10 min per IP+email, 60 / 10 min per IP)
 * - account lockout after N failed attempts (org configurable, default 5) for 15 minutes, with an email alert
 * - constant-shape error messages and constant-time password comparison (never reveal whether the email exists)
 * - unverified self-registered accounts are blocked until the email is confirmed (when email is configured)
 * - if 2FA is enabled, returns a short-lived challenge instead of a session
 * - new device / IP sign-ins trigger an email alert
 */
export const POST = withPublic(async (req) => {
  const body = await parseBody(req, loginSchema);
  const { ip, userAgent } = clientInfo(req);
  const email = body.email.toLowerCase();

  const perIp = rateLimit(`login:ip:${ip}`, 60, 10 * 60 * 1000);
  const perPair = rateLimit(`login:pair:${ip}:${email}`, 10, 10 * 60 * 1000);
  if (!perIp.ok || !perPair.ok) {
    throw new ApiError(429, `Too many sign-in attempts. Try again in ${Math.max(perIp.retryAfterSec, perPair.retryAfterSec)} seconds.`);
  }

  const users = await prisma.user.findMany({
    where: { email, isActive: true, ...(body.slug ? { org: { slug: body.slug } } : {}) },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });

  const invalid = () => new ApiError(401, "Invalid email or password");

  if (!users.length) {
    await verifyPassword(body.password, DUMMY_HASH);
    throw invalid();
  }

  let matched: (typeof users)[number] | null = null;
  for (const u of users) {
    if (u.lockedUntil && u.lockedUntil > new Date()) {
      const mins = Math.ceil((u.lockedUntil.getTime() - Date.now()) / 60000);
      await audit(u.orgId, u.id, "auth.login_blocked", "User", u.id, { reason: "locked" }, { ip, userAgent });
      throw new ApiError(423, `Account temporarily locked after too many failed attempts. Try again in ${mins} minute(s).`);
    }
    if (await verifyPassword(body.password, u.passwordHash)) {
      matched = u;
      break;
    }
  }

  if (!matched) {
    for (const u of users) {
      const settings = parseJson<OrgSettings>(u.org.settings, {});
      const threshold = settings.lockoutThreshold ?? 5;
      const failed = u.failedLogins + 1;
      const lock = failed >= threshold;
      await prisma.user.update({
        where: { id: u.id },
        data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null },
      });
      await audit(u.orgId, u.id, lock ? "auth.locked" : "auth.login_failed", "User", u.id, { attempt: failed }, { ip, userAgent });
      if (lock) void sendAccountLockedAlert(u, { ip, userAgent }, LOCK_MINUTES);
    }
    throw invalid();
  }

  if (!matched.emailVerifiedAt && emailVerificationRequired()) {
    await audit(matched.orgId, matched.id, "auth.login_blocked", "User", matched.id, { reason: "email_unverified" }, { ip, userAgent });
    throw new ApiError(403, "Please confirm your email address first. Check your inbox for the confirmation link, or request a new one.", { code: "EMAIL_UNVERIFIED" });
  }

  if (matched.twoFactorEnabled && matched.twoFactorSecret) {
    const challenge = await signTwoFactorChallenge(matched.id);
    await audit(matched.orgId, matched.id, "auth.2fa_challenge", "User", matched.id, {}, { ip, userAgent });
    return ok({ twoFactorRequired: true, challenge });
  }

  await completeLogin(matched, { ip, userAgent });
  return ok({ userId: matched.id, orgSlug: matched.org.slug, workspaces: users.length, forcePasswordChange: matched.forcePasswordChange });
});

/** Shared by the password-only and 2FA paths: records the login, alerts on a new device, issues the cookie. */
export async function completeLogin(
  u: { id: string; orgId: string; role: string; email: string; name: string; sessionVersion: number; lastLoginIp: string | null; lastLoginAt: Date | null },
  ctx: { ip: string; userAgent: string },
  meta: Record<string, unknown> = {},
) {
  const newDevice = !!u.lastLoginAt && u.lastLoginIp !== ctx.ip;
  await prisma.user.update({
    where: { id: u.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ctx.ip, failedLogins: 0, lockedUntil: null },
  });
  await audit(u.orgId, u.id, "auth.login", "User", u.id, { ...meta, newDevice }, ctx);
  if (newDevice && mailConfigured()) void sendNewDeviceAlert(u, { ...ctx, device: deviceLabel(ctx.userAgent) });
  await issueSessionFor(u);
}
