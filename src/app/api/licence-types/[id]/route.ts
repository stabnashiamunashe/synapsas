import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { licenceTypeSchema, serializeType, typeInclude } from "../route";

export const PATCH = withAuth(async (req, { params, user }) => {
  const t = await prisma.licenceType.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!t) throw notFound();
  const body = await parseBody(req, licenceTypeSchema.partial());
  if (body.code && body.code !== t.code && (await prisma.licenceType.findUnique({ where: { orgId_code: { orgId: user.orgId, code: body.code } } }))) throw badRequest("A licence type with that code already exists");
  const updated = await prisma.licenceType.update({ where: { id: t.id }, data: { ...body, departmentId: body.departmentId === undefined ? undefined : body.departmentId || null, requirements: body.requirements === undefined ? undefined : body.requirements }, include: typeInclude });
  await audit(user.orgId, user.id, "licenceType.updated", "LicenceType", t.id, { fields: Object.keys(body) });
  return ok(serializeType(updated));
}, "ADMIN");

/** Deleting a type that has licences deactivates it instead, so history stays intact. */
export const DELETE = withAuth(async (_req, { params, user }) => {
  const t = await prisma.licenceType.findFirst({ where: { id: params.id, orgId: user.orgId }, include: { _count: { select: { licences: true } } } });
  if (!t) throw notFound();
  if (t._count.licences) {
    await prisma.licenceType.update({ where: { id: t.id }, data: { isActive: false } });
    await audit(user.orgId, user.id, "licenceType.deactivated", "LicenceType", t.id, { code: t.code });
    return ok({ deactivated: true });
  }
  await prisma.licenceType.delete({ where: { id: t.id } });
  await audit(user.orgId, user.id, "licenceType.deleted", "LicenceType", t.id, { code: t.code });
  return ok({ deleted: true });
}, "ADMIN");
