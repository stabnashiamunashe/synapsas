import { prisma } from "@/lib/prisma";
import { forbidden, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { commentSchema } from "@/lib/validators";
import { hasRole } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const GET = withAuth(async (_req, { params, user }) => {
  const r = await prisma.request.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!r) throw notFound();
  const comments = await prisma.comment.findMany({
    where: { requestId: r.id },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  return ok(comments);
});

export const POST = withAuth(async (req, { params, user }) => {
  const r = await prisma.request.findFirst({
    where: { id: params.id, orgId: user.orgId },
    include: { approvals: { select: { approverId: true } } },
  });
  if (!r) throw notFound();
  const involved = r.requesterId === user.id || r.approvals.some((a) => a.approverId === user.id);
  if (!involved && !hasRole(user, "MANAGER")) throw forbidden();
  const body = await parseBody(req, commentSchema);
  const c = await prisma.comment.create({
    data: { requestId: r.id, userId: user.id, body: body.body },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  // Notify everyone involved except the author.
  const audience = Array.from(new Set([r.requesterId, ...r.approvals.map((a) => a.approverId)])).filter((id) => id !== user.id);
  await notify(user.orgId, audience, {
    title: `New comment on ${r.referenceNo}`,
    body: `${user.name}: ${body.body.slice(0, 120)}`,
    link: `/app/requests/${r.id}`,
    type: "COMMENT",
  });
  return ok(c, { status: 201 });
});
