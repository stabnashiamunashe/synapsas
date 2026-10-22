import { prisma } from "@/lib/prisma";
import { hashPassword, issueSessionFor } from "@/lib/auth";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { acceptInviteSchema } from "@/lib/validators";
import { audit } from "@/lib/notify";
import { hydrate } from "@/lib/json";
import { clientInfo } from "@/lib/security";

async function loadInvite(token: string) {
  const inv = await prisma.invitation.findUnique({ where: { token }, include: { org: true } });
  if (!inv) throw new ApiError(404, "Invitation not found");
  if (inv.acceptedAt) throw new ApiError(410, "Invitation already used");
  if (inv.expiresAt < new Date()) throw new ApiError(410, "Invitation expired");
  return inv;
}

export const GET = withPublic(async (_req, { params }) => {
  const inv = await loadInvite(params.token);
  const org = hydrate(inv.org, ["branding"]);
  return ok({ email: inv.email, role: inv.role, org: { name: org.name, slug: org.slug, branding: org.branding } });
});

export const POST = withPublic(async (req, { params }) => {
  const inv = await loadInvite(params.token);
  const body = await parseBody(req, acceptInviteSchema);
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
    },
  });
  await prisma.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
  await audit(inv.orgId, user.id, "user.joined", "User", user.id, { via: "invitation" }, clientInfo(req));
  await issueSessionFor(user);
  return ok({ userId: user.id });
});
