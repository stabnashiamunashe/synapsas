import { prisma } from "@/lib/prisma";
import { badRequest, ok, parseBody, withAuth } from "@/lib/api";
import { inviteSchema } from "@/lib/validators";
import { limitsFor, withinLimit } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import { audit } from "@/lib/notify";
import { createInvitation } from "@/lib/invitations";

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, inviteSchema);
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  const count = await prisma.user.count({ where: { orgId: user.orgId, isActive: true } });
  if (!withinLimit(limitsFor(effectivePlan(org!)).users, count)) throw badRequest("User limit reached for your plan.");
  const email = body.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { orgId_email: { orgId: user.orgId, email } } });
  if (exists) throw badRequest("That person is already a member");
  const { invitation, link, emailed } = await createInvitation({ orgId: user.orgId, email, role: body.role, departmentId: body.departmentId || null, invitedBy: user });
  await audit(user.orgId, user.id, "user.invited", "Invitation", invitation.id, { email, role: body.role, emailed });
  // The raw link is returned exactly once (for admins who hand it over manually); only its hash is stored.
  return ok({ ...invitation, tokenHash: undefined, link, emailed }, { status: 201 });
}, "ADMIN");
