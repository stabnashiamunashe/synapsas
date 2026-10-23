import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { issueSessionFor } from "@/lib/auth";
import { audit } from "@/lib/notify";
import { clientInfo, rateLimit } from "@/lib/security";
import { completeEmailVerification, startEmailVerification } from "@/lib/verification";

/** POST { token } → marks the address verified and signs the user in. */
export const POST = withPublic(async (req) => {
  const ctx = clientInfo(req);
  const rl = rateLimit(`verify:${ctx.ip}`, 20, 10 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many attempts. Try again later.");
  const { token } = await parseBody(req, z.object({ token: z.string().min(20).max(128) }));
  const user = await completeEmailVerification(token);
  if (!user) throw new ApiError(400, "This confirmation link is invalid or has expired. Request a new one from the sign-in page.");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), lastLoginIp: ctx.ip } });
  await audit(user.orgId, user.id, "auth.email_verified", "User", user.id, {}, ctx);
  await audit(user.orgId, user.id, "auth.login", "User", user.id, { via: "email_verification" }, ctx);
  await issueSessionFor(user);
  return ok({ verified: true, orgSlug: user.org.slug });
});

/** PUT { email, slug? } → re-sends the confirmation. Always 200 (no account enumeration). */
export const PUT = withPublic(async (req) => {
  const ctx = clientInfo(req);
  const { email, slug } = await parseBody(req, z.object({ email: z.string().email(), slug: z.string().optional() }));
  const rl = rateLimit(`verify-resend:${email.toLowerCase()}`, 3, 15 * 60 * 1000);
  const rlIp = rateLimit(`verify-resend:ip:${ctx.ip}`, 10, 15 * 60 * 1000);
  if (!rl.ok || !rlIp.ok) return ok({ sent: true });
  const users = await prisma.user.findMany({ where: { email: email.toLowerCase(), isActive: true, emailVerifiedAt: null, ...(slug ? { org: { slug } } : {}) } });
  for (const u of users) {
    await startEmailVerification(u);
    await audit(u.orgId, u.id, "auth.verification_resent", "User", u.id, {}, ctx);
  }
  return ok({ sent: true });
});
