import { prisma } from "@/lib/prisma";
import { ok, withAuth } from "@/lib/api";

/** Pending invitations. Links are never listed again after creation; use "Resend" to issue a new one. */
export const GET = withAuth(async (_req, { user }) => {
  const list = await prisma.invitation.findMany({
    where: { orgId: user.orgId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, departmentId: true, expiresAt: true, createdAt: true, invitedById: true },
  });
  return ok(list);
}, "ADMIN");
