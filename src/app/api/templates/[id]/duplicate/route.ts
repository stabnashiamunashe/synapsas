import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, withAuth } from "@/lib/api";
import { hydrate } from "@/lib/json";
import { limitsFor, withinLimit } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import { audit } from "@/lib/notify";

export const POST = withAuth(async (_req, { params, user }) => {
  const t = await prisma.workflowTemplate.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!t) throw notFound();
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  const count = await prisma.workflowTemplate.count({ where: { orgId: user.orgId } });
  if (!withinLimit(limitsFor(effectivePlan(org!)).templates, count)) throw badRequest("Workflow limit reached for your plan.");
  const copy = await prisma.workflowTemplate.create({
    data: {
      orgId: t.orgId,
      name: `${t.name} (copy)`,
      description: t.description,
      category: t.category,
      icon: t.icon,
      color: t.color,
      prefix: t.prefix,
      fields: t.fields,
      levels: t.levels,
      settings: t.settings,
      isActive: false,
      createdById: user.id,
    },
  });
  await audit(user.orgId, user.id, "template.duplicated", "WorkflowTemplate", copy.id, { from: t.id });
  return ok(hydrate(copy, ["fields", "levels", "settings"]), { status: 201 });
}, "ADMIN");
