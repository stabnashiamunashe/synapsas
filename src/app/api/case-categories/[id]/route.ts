import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { caseCategorySchema } from "@/lib/validators";
import { audit } from "@/lib/notify";

export const PATCH = withAuth(async (req, { params, user }) => {
  const cat = await prisma.caseCategory.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!cat) throw notFound();
  const body = await parseBody(req, caseCategorySchema.partial());
  if (body.departmentId) {
    const dept = await prisma.department.findFirst({ where: { id: body.departmentId, orgId: user.orgId } });
    if (!dept) throw badRequest("Section not found");
  }
  const updated = await prisma.caseCategory.update({ where: { id: cat.id }, data: body });
  await audit(user.orgId, user.id, "case_category.updated", "CaseCategory", cat.id, { fields: Object.keys(body) });
  return ok(updated);
}, "ADMIN");

/** Deactivate (cases keep their category); hard delete only when unused. */
export const DELETE = withAuth(async (_req, { params, user }) => {
  const cat = await prisma.caseCategory.findFirst({ where: { id: params.id, orgId: user.orgId }, include: { _count: { select: { cases: true } } } });
  if (!cat) throw notFound();
  if (cat._count.cases) await prisma.caseCategory.update({ where: { id: cat.id }, data: { isActive: false } });
  else await prisma.caseCategory.delete({ where: { id: cat.id } });
  await audit(user.orgId, user.id, "case_category.deleted", "CaseCategory", cat.id, { name: cat.name, deactivated: !!cat._count.cases });
  return ok({ id: cat.id });
}, "ADMIN");
