import { prisma } from "@/lib/prisma";
import { notFound, ok, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { resendInvitation } from "@/lib/invitations";

export const DELETE = withAuth(async (_req, { params, user }) => {
  const inv = await prisma.invitation.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!inv) throw notFound();
  await prisma.invitation.delete({ where: { id: inv.id } });
  await audit(user.orgId, user.id, "user.invite_revoked", "Invitation", inv.id, { email: inv.email });
  return ok({ id: inv.id });
}, "ADMIN");

/** Resend: rotates the token (old link dies), extends expiry, emails the invitee, returns the new link once. */
export const POST = withAuth(async (_req, { params, user }) => {
  const res = await resendInvitation(params.id, user.orgId, user);
  if (!res) throw notFound();
  await audit(user.orgId, user.id, "user.invite_resent", "Invitation", res.invitation.id, { email: res.invitation.email, emailed: res.emailed });
  return ok({ id: res.invitation.id, link: res.link, emailed: res.emailed, expiresAt: res.invitation.expiresAt });
}, "ADMIN");
