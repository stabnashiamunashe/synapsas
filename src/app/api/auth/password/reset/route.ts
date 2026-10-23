import { prisma } from "@/lib/prisma";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validators";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { assertStrongPassword, clientInfo, sha256 } from "@/lib/security";
import { audit } from "@/lib/notify";
import { sendPasswordChangedAlert } from "@/lib/emails";

export const POST = withPublic(async (req) => {
  const { token, password } = await parseBody(req, resetPasswordSchema);
  const pr = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!pr || pr.usedAt || pr.expiresAt < new Date() || !pr.user.isActive) throw new ApiError(400, "This reset link is invalid or has expired");
  const problems = await assertStrongPassword(password, [pr.user.name, pr.user.email.split("@")[0]]);
  if (problems.length) throw new ApiError(422, "Password is too weak", problems.map((p) => ({ path: "password", message: p })));
  if (await verifyPassword(password, pr.user.passwordHash)) throw new ApiError(422, "New password must differ from the current one");
  const ctx = clientInfo(req);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: pr.userId },
      data: {
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date(),
        forcePasswordChange: false,
        failedLogins: 0,
        lockedUntil: null,
        emailVerifiedAt: pr.user.emailVerifiedAt ?? new Date(), // completing a reset proves mailbox ownership
        sessionVersion: { increment: 1 }, // sign out everywhere
      },
    }),
    prisma.passwordReset.update({ where: { id: pr.id }, data: { usedAt: new Date() } }),
    prisma.passwordReset.deleteMany({ where: { userId: pr.userId, usedAt: null, id: { not: pr.id } } }),
  ]);
  await audit(pr.user.orgId, pr.userId, "auth.password_reset", "User", pr.userId, {}, ctx);
  void sendPasswordChangedAlert(pr.user, ctx, "reset");
  return ok({ reset: true });
});
