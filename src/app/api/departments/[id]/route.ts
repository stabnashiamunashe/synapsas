import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { departmentSchema } from "@/lib/validators";
import { audit } from "@/lib/notify";

export const PATCH = withAuth(async (req, { params, user }) => {
  const d = await prisma.department.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!d) throw notFound();
  const body = await parseBody(req, departmentSchema.partial());
  const updated = await prisma.department.update({
    where: { id: d.id },
    data: { name: body.name, code: body.code, headUserId: body.headUserId === undefined ? undefined : body.headUserId || null, defaultAssigneeId: body.defaultAssigneeId === undefined ? undefined : body.defaultAssigneeId || null },
    include: { head: { select: { id: true, name: true } }, defaultAssignee: { select: { id: true, name: true } }, _count: { select: { members: true } } },
  });
  await audit(user.orgId, user.id, "department.updated", "Department", d.id);
  return ok(updated);
}, "ADMIN");

export const DELETE = withAuth(async (_req, { params, user }) => {
  const d = await prisma.department.findFirst({ where: { id: params.id, orgId: user.orgId }, include: { _count: { select: { members: true } } } });
  if (!d) throw notFound();
  if (d._count.members > 0) throw badRequest("Move members out of this department first");
  await prisma.department.delete({ where: { id: d.id } });
  await audit(user.orgId, user.id, "department.deleted", "Department", d.id, { name: d.name });
  return ok({ id: d.id });
}, "ADMIN");
