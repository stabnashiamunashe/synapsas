import { prisma } from "@/lib/prisma";
import { badRequest, getQuery, ok, parseBody, withAuth } from "@/lib/api";
import { templateSchema } from "@/lib/validators";
import { hydrate, toJson } from "@/lib/json";
import { limitsFor, withinLimit } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import { audit } from "@/lib/notify";
import { validateFieldKeys, validateLevels } from "@/lib/templateUtils";

export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const activeOnly = q.get("active") === "1";
  const list = await prisma.workflowTemplate.findMany({
    where: { orgId: user.orgId, ...(activeOnly ? { isActive: true } : {}) },
    include: { _count: { select: { requests: true } } },
    orderBy: { name: "asc" },
  });
  return ok(list.map((t) => hydrate(t, ["fields", "levels", "settings"])));
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, templateSchema);
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  const count = await prisma.workflowTemplate.count({ where: { orgId: user.orgId } });
  if (!withinLimit(limitsFor(effectivePlan(org!)).templates, count)) throw badRequest("Workflow limit reached for your plan.");
  validateLevels(body.levels);
  validateFieldKeys(body.fields);
  const t = await prisma.workflowTemplate.create({
    data: {
      orgId: user.orgId,
      name: body.name,
      description: body.description,
      category: body.category,
      icon: body.icon,
      color: body.color,
      prefix: body.prefix,
      fields: toJson(body.fields),
      levels: toJson(body.levels.map((l, i) => ({ ...l, order: i + 1 }))),
      settings: toJson(body.settings),
      isActive: body.isActive ?? true,
      createdById: user.id,
    },
  });
  await audit(user.orgId, user.id, "template.created", "WorkflowTemplate", t.id, { name: t.name });
  return ok(hydrate(t, ["fields", "levels", "settings"]), { status: 201 });
}, "ADMIN");

