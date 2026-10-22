import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, parseBody, withAuth } from "@/lib/api";
import { inviteSchema } from "@/lib/validators";
import { limitsFor, withinLimit } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import { audit } from "@/lib/notify";

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, inviteSchema);
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  const count = await prisma.user.count({ where: { orgId: user.orgId, isActive: true } });
  if (!withinLimit(limitsFor(effectivePlan(org!)).users, count)) throw badRequest("User limit reached for your plan.");
  const email = body.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { orgId_email: { orgId: user.orgId, email } } });
  if (exists) throw badRequest("That person is already a member");
  const inv = await prisma.invitation.create({
    data: {
      orgId: user.orgId,
      email,
      role: body.role,
      departmentId: body.departmentId || null,
      token: nanoid(32),
      invitedById: user.id,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  await audit(user.orgId, user.id, "user.invited", "Invitation", inv.id, { email, role: body.role });
  const base = process.env.APP_URL || "http://localhost:3000";
  // Email provider hook: send `${base}/invite/${inv.token}` to the invitee.
  return ok({ ...inv, link: `${base}/invite/${inv.token}` }, { status: 201 });
}, "ADMIN");
