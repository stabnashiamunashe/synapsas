import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, ok, parseBody, withAuth } from "@/lib/api";
import { delegationSchema } from "@/lib/validators";
import { hasRole } from "@/lib/auth";
import { audit, notify } from "@/lib/notify";

const include = { from: { select: { id: true, name: true } }, to: { select: { id: true, name: true } } };

export const GET = withAuth(async (_req, { user }) => {
  const list = await prisma.delegation.findMany({
    where: { orgId: user.orgId, ...(hasRole(user, "ADMIN") ? {} : { OR: [{ fromUserId: user.id }, { toUserId: user.id }] }) },
    include,
    orderBy: { startsAt: "desc" },
  });
  return ok(list);
});

/** Out-of-office delegation: approvals routed to `fromUserId` go to `toUserId` while active. */
export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, delegationSchema);
  const fromUserId = body.fromUserId && hasRole(user, "ADMIN") ? body.fromUserId : user.id;
  if (fromUserId === body.toUserId) throw badRequest("Cannot delegate to yourself");
  if (body.fromUserId && body.fromUserId !== user.id && !hasRole(user, "ADMIN")) throw forbidden();
  const target = await prisma.user.findFirst({ where: { id: body.toUserId, orgId: user.orgId, isActive: true } });
  if (!target) throw badRequest("Delegate not found");
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (endsAt <= startsAt) throw badRequest("End must be after start");
  const d = await prisma.delegation.create({
    data: { orgId: user.orgId, fromUserId, toUserId: body.toUserId, reason: body.reason, startsAt, endsAt },
    include,
  });
  await audit(user.orgId, user.id, "delegation.created", "Delegation", d.id, { to: body.toUserId });
  await notify(user.orgId, [body.toUserId], {
    title: "You have been set as a delegate",
    body: `${d.from.name} delegated their approvals to you from ${startsAt.toDateString()} to ${endsAt.toDateString()}.`,
    link: "/app/settings/delegations",
  });
  return ok(d, { status: 201 });
});
