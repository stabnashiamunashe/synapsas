import { prisma } from "@/lib/prisma";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validators";
import { clientInfo, randomToken, rateLimit, sha256 } from "@/lib/security";
import { audit } from "@/lib/notify";

/**
 * Always responds 200 so it cannot be used to enumerate accounts.
 * The reset link is handed to the email hook; in development it is printed to the server log.
 */
export const POST = withPublic(async (req) => {
  const { email, slug } = await parseBody(req, forgotPasswordSchema);
  const info = clientInfo(req);
  const rl = rateLimit(`forgot:${info.ip}`, 5, 15 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many requests. Try again later.");

  const users = await prisma.user.findMany({
    where: { email: email.toLowerCase(), isActive: true, ...(slug ? { org: { slug } } : {}) },
    include: { org: { select: { slug: true, name: true } } },
  });
  const base = process.env.APP_URL || "http://localhost:3000";
  for (const u of users) {
    const token = randomToken(32);
    await prisma.passwordReset.create({
      data: { userId: u.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const link = `${base}/reset-password/${token}`;
    // Email provider hook: send `link` to u.email. Never return it in the response.
    if (process.env.NODE_ENV !== "production" || process.env.EMAIL_DEBUG === "1") {
      console.log(`[password-reset] ${u.email} (${u.org.slug}): ${link}`);
    }
    await audit(u.orgId, u.id, "auth.password_reset_requested", "User", u.id, {}, info);
  }
  return ok({ sent: true });
});
