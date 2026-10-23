import { prisma } from "@/lib/prisma";
import { badRequest, ok, parseBody, withAuth } from "@/lib/api";
import { departmentSchema } from "@/lib/validators";
import { audit } from "@/lib/notify";

export const GET = withAuth(async (_req, { user }) => {
  const list = await prisma.department.findMany({
    where: { orgId: user.orgId },
    include: { head: { select: { id: true, name: true } }, defaultAssignee: { select: { id: true, name: true } }, _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });
  return ok(list);
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, departmentSchema);
  const exists = await prisma.department.findUnique({ where: { orgId_name: { orgId: user.orgId, name: body.name } } });
  if (exists) throw badRequest("Department already exists");
  const d = await prisma.department.create({
    data: { orgId: user.orgId, name: body.name, code: body.code, headUserId: body.headUserId || null },
    include: { head: { select: { id: true, name: true } }, _count: { select: { members: true } } },
  });
  await audit(user.orgId, user.id, "department.created", "Department", d.id, { name: d.name });
  return ok(d, { status: 201 });
}, "ADMIN");
