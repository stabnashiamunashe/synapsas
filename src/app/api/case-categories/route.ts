import { prisma } from "@/lib/prisma";
import { badRequest, ok, parseBody, withAuth } from "@/lib/api";
import { caseCategorySchema } from "@/lib/validators";
import { audit } from "@/lib/notify";

export const GET = withAuth(async (_req, { user }) => {
  const list = await prisma.caseCategory.findMany({ where: { orgId: user.orgId }, include: { department: { select: { id: true, name: true, code: true } }, _count: { select: { cases: true } } }, orderBy: [{ department: { name: "asc" } }, { name: "asc" }] });
  return ok(list);
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, caseCategorySchema);
  const dept = await prisma.department.findFirst({ where: { id: body.departmentId, orgId: user.orgId } });
  if (!dept) throw badRequest("Section not found");
  const cat = await prisma.caseCategory.create({ data: { orgId: user.orgId, ...body, defaultPriority: body.defaultPriority || "MEDIUM", defaultSlaHours: body.defaultSlaHours ?? 72 } });
  await audit(user.orgId, user.id, "case_category.created", "CaseCategory", cat.id, { name: cat.name });
  return ok(cat, { status: 201 });
}, "ADMIN");
