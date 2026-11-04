import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { licenceTypeSchema, serializeType, typeInclude } from "../route";

export const PATCH = withAuth(async (req, { params, user }) => {
  const t = await prisma.licenceType.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!t) throw notFound();
  const body = await parseBody(req, licenceTypeSchema.partial());
  if (body.code && body.code !== t.code && (await prisma.licenceType.findUnique({ where: { orgId_code: { orgId: user.orgId, code: body.code } } }))) throw badRequest("A licence type with that code already exists");
  const { fields, officeFields, kinds, requirements, departmentId, ...rest } = body;
  const updated = await prisma.licenceType.update({
    where: { id: t.id },
    data: {
      ...rest,
      departmentId: departmentId === undefined ? undefined : departmentId || null,
      requirements: requirements === undefined ? undefined : requirements,
      fields: fields === undefined ? undefined : (fields as Prisma.InputJsonValue),
      officeFields: officeFields === undefined ? undefined : (officeFields as Prisma.InputJsonValue),
      kinds: kinds === undefined ? undefined : kinds,
    },
    include: typeInclude,
  });
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
