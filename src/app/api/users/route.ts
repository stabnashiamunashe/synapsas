import { prisma } from "@/lib/prisma";
import { badRequest, getQuery, ok, parseBody, withAuth } from "@/lib/api";
import { userCreateSchema } from "@/lib/validators";
import { hashPassword } from "@/lib/auth";
import { limitsFor, withinLimit } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import { audit } from "@/lib/notify";
import { clientInfo, randomToken } from "@/lib/security";
import { userSelect } from "@/lib/userSelect";

export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const search = q.get("q") || undefined;
  const includeInactive = q.get("all") === "1";
  const users = await prisma.user.findMany({
    where: {
      orgId: user.orgId,
      ...(includeInactive ? {} : { isActive: true }),
      ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
    },
    select: userSelect,
    orderBy: { name: "asc" },
  });
  return ok(users);
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, userCreateSchema);
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  const count = await prisma.user.count({ where: { orgId: user.orgId, isActive: true } });
  if (!withinLimit(limitsFor(effectivePlan(org!)).users, count)) throw badRequest("User limit reached for your plan. Upgrade to add more people.");
  if (body.role === "OWNER" && user.role !== "OWNER") throw badRequest("Only an owner can create another owner");
  const email = body.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { orgId_email: { orgId: user.orgId, email } } });
  if (exists) throw badRequest("A user with that email already exists");
  // Admin-set passwords are temporary: the user must change it at first sign-in.
  const tempPassword = body.password || `Tmp-${randomToken(9)}1a`;
  const created = await prisma.user.create({
    data: {
      orgId: user.orgId,
      email,
      name: body.name,
      role: body.role,
      jobTitle: body.jobTitle,
      departmentId: body.departmentId || null,
      managerId: body.managerId || null,
      passwordHash: await hashPassword(tempPassword),
      forcePasswordChange: true,
    },
    select: userSelect,
  });
  await audit(user.orgId, user.id, "user.created", "User", created.id, { email, role: body.role }, clientInfo(req));
  // Returned once so the admin can hand it over; it is never stored in plain text.
  return ok({ ...created, temporaryPassword: body.password ? undefined : tempPassword }, { status: 201 });
}, "ADMIN");
