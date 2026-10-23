import { prisma } from "@/lib/prisma";
import { ApiError, forbidden, ok, parseBody, withAuth } from "@/lib/api";
import { changePasswordSchema } from "@/lib/validators";
import { hashPassword, issueSessionFor, verifyPassword } from "@/lib/auth";
import { assertStrongPassword, clientInfo, rateLimit } from "@/lib/security";
import { audit } from "@/lib/notify";
import { sendPasswordChangedAlert } from "@/lib/emails";

/** Change own password (re-authentication required). Revokes every other session and re-issues this one. */
export const POST = withAuth(async (req, { user }) => {
  if (user.viaApiKey) throw forbidden("Not available to API keys");
  const rl = rateLimit(`pwchange:${user.id}`, 5, 15 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many attempts. Try again later.");
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);
  const u = await prisma.user.findUnique({ where: { id: user.id } });
  if (!u) throw forbidden();
  if (!(await verifyPassword(currentPassword, u.passwordHash))) {
    await audit(u.orgId, u.id, "auth.password_change_failed", "User", u.id, {}, clientInfo(req));
    throw forbidden("Current password is incorrect");
  }
  if (await verifyPassword(newPassword, u.passwordHash)) throw new ApiError(422, "New password must differ from the current one");
  const problems = await assertStrongPassword(newPassword, [u.name, u.email.split("@")[0]]);
  if (problems.length) throw new ApiError(422, "Password is too weak", problems.map((p) => ({ path: "newPassword", message: p })));
  const updated = await prisma.user.update({
    where: { id: u.id },
    data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date(), forcePasswordChange: false, sessionVersion: { increment: 1 } },
  });
  const ctx = clientInfo(req);
  await audit(u.orgId, u.id, "auth.password_changed", "User", u.id, {}, ctx);
  void sendPasswordChangedAlert(u, ctx, "change");
  await issueSessionFor(updated);
  return ok({ changed: true });
});
