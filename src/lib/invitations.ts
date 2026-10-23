import { prisma } from "./prisma";
import { randomToken, sha256 } from "./security";
import { mailConfigured } from "./mailer";
import { sendInvitationEmail } from "./emails";

const TTL_DAYS = 7;
const base = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Create (or replace) an invitation: random token, hashed at rest, emailed when SMTP is configured. */
export async function createInvitation(opts: { orgId: string; email: string; role: string; departmentId: string | null; invitedBy: { id: string; name: string } }) {
  const token = randomToken(32);
  await prisma.invitation.deleteMany({ where: { orgId: opts.orgId, email: opts.email, acceptedAt: null } });
  const invitation = await prisma.invitation.create({
    data: {
      orgId: opts.orgId,
      email: opts.email,
      role: opts.role,
      departmentId: opts.departmentId,
      tokenHash: sha256(token),
      invitedById: opts.invitedBy.id,
      expiresAt: new Date(Date.now() + TTL_DAYS * 86400000),
    },
  });
  const link = `${base()}/invite/${token}`;
  const emailed = mailConfigured();
  await sendInvitationEmail(invitation, link, opts.invitedBy.name);
  return { invitation, link, emailed };
}

/** Issue a new token for an existing pending invitation (old link stops working). */
export async function resendInvitation(id: string, orgId: string, by: { id: string; name: string }) {
  const inv = await prisma.invitation.findFirst({ where: { id, orgId, acceptedAt: null } });
  if (!inv) return null;
  const token = randomToken(32);
  const updated = await prisma.invitation.update({ where: { id: inv.id }, data: { tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_DAYS * 86400000), invitedById: by.id } });
  const link = `${base()}/invite/${token}`;
  await sendInvitationEmail(updated, link, by.name);
  return { invitation: updated, link, emailed: mailConfigured() };
}

export async function findInvitationByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return prisma.invitation.findUnique({ where: { tokenHash: sha256(token) }, include: { org: true } });
}
