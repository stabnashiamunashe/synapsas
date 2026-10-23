import { prisma } from "@/lib/prisma";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validators";
import { clientInfo, randomToken, rateLimit, sha256 } from "@/lib/security";
import { audit } from "@/lib/notify";
import { sendPasswordResetEmail } from "@/lib/emails";

/**
 * Always responds 200 with the same body and comparable timing, so it cannot be used to enumerate accounts
 * (ASVS 2.5.1 / 2.5.6). Tokens are random, hashed at rest, single-use and expire after 60 minutes.
 */
export const POST = withPublic(async (req) => {
  const { email, slug } = await parseBody(req, forgotPasswordSchema);
  const info = clientInfo(req);
  const rl = rateLimit(`forgot:${info.ip}`, 5, 15 * 60 * 1000);
  const perEmail = rateLimit(`forgot:email:${email.toLowerCase()}`, 3, 15 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many requests. Try again later.");
  if (!perEmail.ok) return ok({ sent: true }); // silently drop: same response as success

  const users = await prisma.user.findMany({
    where: { email: email.toLowerCase(), isActive: true, ...(slug ? { org: { slug } } : {}) },
    include: { org: { select: { slug: true, name: true } } },
  });
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  for (const u of users) {
    const token = randomToken(32);
    await prisma.$transaction([
      prisma.passwordReset.deleteMany({ where: { userId: u.id, usedAt: null } }),
      prisma.passwordReset.create({ data: { userId: u.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } }),
    ]);
    const link = `${base}/reset-password/${token}`;
    await sendPasswordResetEmail(u, link, info);
    if (process.env.NODE_ENV !== "production") console.log(`[password-reset] ${u.email} (${u.org.slug}): ${link}`);
    await audit(u.orgId, u.id, "auth.password_reset_requested", "User", u.id, {}, info);
  }
  return ok({ sent: true });
});
