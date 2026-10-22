import { prisma } from "@/lib/prisma";
import { ApiError, forbidden, ok, parseBody, withAuth } from "@/lib/api";
import { changePasswordSchema } from "@/lib/validators";
import { hashPassword, issueSessionFor, verifyPassword } from "@/lib/auth";
import { clientInfo, passwordProblems } from "@/lib/security";
import { audit } from "@/lib/notify";

/** Change own password. Revokes every other session and re-issues this one. */
export const POST = withAuth(async (req, { user }) => {
  if (user.viaApiKey) throw forbidden("Not available to API keys");
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);
  const u = await prisma.user.findUnique({ where: { id: user.id } });
  if (!u) throw forbidden();
  if (!(await verifyPassword(currentPassword, u.passwordHash))) throw forbidden("Current password is incorrect");
  if (await verifyPassword(newPassword, u.passwordHash)) throw new ApiError(422, "New password must differ from the current one");
  const problems = passwordProblems(newPassword, [u.name, u.email.split("@")[0]]);
  if (problems.length) throw new ApiError(422, "Password is too weak", problems.map((p) => ({ path: "newPassword", message: p })));
  const updated = await prisma.user.update({
    where: { id: u.id },
    data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date(), forcePasswordChange: false, sessionVersion: { increment: 1 } },
  });
  await audit(u.orgId, u.id, "auth.password_changed", "User", u.id, {}, clientInfo(req));
  await issueSessionFor(updated);
  return ok({ changed: true });
});
