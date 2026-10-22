import { prisma } from "@/lib/prisma";
import { issueSessionFor, signTwoFactorChallenge, verifyPassword } from "@/lib/auth";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { loginSchema } from "@/lib/validators";
import { audit } from "@/lib/notify";
import { clientInfo, rateLimit } from "@/lib/security";
import { parseJson } from "@/lib/json";
import type { OrgSettings } from "@/lib/types";

const LOCK_MINUTES = 15;

/**
 * Password step of sign-in.
 * - IP + email rate limiting (10 attempts / 10 min per IP+email, 60 / 10 min per IP)
 * - account lockout after N failed attempts (org configurable, default 5) for 15 minutes
 * - constant-shape error messages (never reveal whether the email exists)
 * - if 2FA is enabled, returns a short-lived challenge instead of a session
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
    // Burn the same time as a real bcrypt compare so timing does not reveal account existence.
    await verifyPassword(body.password, "$2a$12$CwTycUXWue0Thq9StjUM0uJ8Zt0Q7bC4E4y1pPq9FzJ7e3c9G8ZQ2");
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
    // Record the failure against every matching workspace account for this email.
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
    }
    throw invalid();
  }

  if (matched.twoFactorEnabled && matched.twoFactorSecret) {
    const challenge = await signTwoFactorChallenge(matched.id);
    await audit(matched.orgId, matched.id, "auth.2fa_challenge", "User", matched.id, {}, { ip, userAgent });
    return ok({ twoFactorRequired: true, challenge });
  }

  await prisma.user.update({
    where: { id: matched.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip, failedLogins: 0, lockedUntil: null },
  });
  await audit(matched.orgId, matched.id, "auth.login", "User", matched.id, {}, { ip, userAgent });
  await issueSessionFor(matched);
  return ok({ userId: matched.id, orgSlug: matched.org.slug, workspaces: users.length, forcePasswordChange: matched.forcePasswordChange });
});
