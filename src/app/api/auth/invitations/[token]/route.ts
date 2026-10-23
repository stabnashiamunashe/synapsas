import { prisma } from "@/lib/prisma";
import { hashPassword, issueSessionFor } from "@/lib/auth";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { acceptInviteSchema } from "@/lib/validators";
import { audit } from "@/lib/notify";
import { hydrate } from "@/lib/json";
import { assertStrongPassword, clientInfo, rateLimit } from "@/lib/security";
import { findInvitationByToken } from "@/lib/invitations";

async function loadInvite(token: string, ip: string) {
  const rl = rateLimit(`invite:${ip}`, 30, 10 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many attempts. Try again later.");
  const inv = await findInvitationByToken(token);
  if (!inv) throw new ApiError(404, "Invitation not found");
  if (inv.acceptedAt) throw new ApiError(410, "Invitation already used");
  if (inv.expiresAt < new Date()) throw new ApiError(410, "Invitation expired");
  return inv;
}

export const GET = withPublic(async (req, { params }) => {
  const inv = await loadInvite(params.token, clientInfo(req).ip);
  const org = hydrate(inv.org, ["branding"]);
  return ok({ email: inv.email, role: inv.role, org: { name: org.name, slug: org.slug, branding: org.branding } });
});

export const POST = withPublic(async (req, { params }) => {
  const ctx = clientInfo(req);
  const inv = await loadInvite(params.token, ctx.ip);
  const body = await parseBody(req, acceptInviteSchema);
  const problems = await assertStrongPassword(body.password, [body.name, inv.email.split("@")[0]]);
  if (problems.length) throw new ApiError(422, "Password is too weak", problems.map((p) => ({ path: "password", message: p })));
  const existing = await prisma.user.findUnique({ where: { orgId_email: { orgId: inv.orgId, email: inv.email } } });
  if (existing) throw new ApiError(409, "A user with this email already exists in the workspace");
  const user = await prisma.user.create({
    data: {
      orgId: inv.orgId,
      email: inv.email,
      name: body.name,
      passwordHash: await hashPassword(body.password),
      role: inv.role,
      departmentId: inv.departmentId,
      lastLoginAt: new Date(),
      lastLoginIp: ctx.ip,
      emailVerifiedAt: new Date(), // the link arrived in this mailbox
    },
  });
  await prisma.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
  await audit(inv.orgId, user.id, "user.joined", "User", user.id, { via: "invitation" }, ctx);
  await issueSessionFor(user);
  return ok({ userId: user.id });
});
