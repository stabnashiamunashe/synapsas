// Email-address verification for self-registered accounts (ASVS 2.1 / 2.5.x: proof of ownership before use).
import { prisma } from "./prisma";
import { randomToken, sha256 } from "./security";
import { mailConfigured } from "./mailer";
import { sendVerificationEmail } from "./emails";

const TTL_HOURS = 24;

/** Enforced whenever email can actually be delivered; REQUIRE_EMAIL_VERIFICATION=0 turns it off, =1 forces it on. */
export function emailVerificationRequired() {
  const flag = process.env.REQUIRE_EMAIL_VERIFICATION;
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return mailConfigured();
}

/** Issue a fresh single-use token (invalidating earlier ones) and email it. */
export async function startEmailVerification(user: { id: string; email: string; name: string; orgId: string }) {
  const token = randomToken(32);
  await prisma.$transaction([
    prisma.emailToken.deleteMany({ where: { userId: user.id, purpose: "verify_email", usedAt: null } }),
    prisma.emailToken.create({ data: { userId: user.id, purpose: "verify_email", tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_HOURS * 3600_000) } }),
  ]);
  await sendVerificationEmail(user, token);
  if (process.env.NODE_ENV !== "production") console.log(`[verify-email] ${user.email}: ${process.env.APP_URL || "http://localhost:3000"}/verify-email/${token}`);
}

/** Consume a token. Returns the user or null. */
export async function completeEmailVerification(token: string) {
  const row = await prisma.emailToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.purpose !== "verify_email" || row.usedAt || row.expiresAt < new Date()) return null;
  const user = await prisma.user.findUnique({ where: { id: row.userId }, include: { org: { select: { slug: true } } } });
  if (!user || !user.isActive) return null;
  await prisma.$transaction([
    prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() } }),
  ]);
  return user;
}
