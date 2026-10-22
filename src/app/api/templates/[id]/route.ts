import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { templateSchema } from "@/lib/validators";
import { hydrate, toJson } from "@/lib/json";
import { audit } from "@/lib/notify";
import { validateFieldKeys, validateLevels } from "@/lib/templateUtils";

export const GET = withAuth(async (_req, { params, user }) => {
  const t = await prisma.workflowTemplate.findFirst({
    where: { id: params.id, orgId: user.orgId },
    include: { _count: { select: { requests: true } } },
  });
  if (!t) throw notFound();
  return ok(hydrate(t, ["fields", "levels", "settings"]));
});

export const PUT = withAuth(async (req, { params, user }) => {
  const t = await prisma.workflowTemplate.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!t) throw notFound();
  const body = await parseBody(req, templateSchema);
  validateLevels(body.levels);
  validateFieldKeys(body.fields);
  const updated = await prisma.workflowTemplate.update({
    where: { id: t.id },
    data: {
      name: body.name,
      description: body.description,
      category: body.category,
      icon: body.icon,
      color: body.color,
      prefix: body.prefix,
      fields: toJson(body.fields),
      levels: toJson(body.levels.map((l, i) => ({ ...l, order: i + 1 }))),
      settings: toJson(body.settings),
      isActive: body.isActive ?? t.isActive,
      version: { increment: 1 },
    },
  });
  await audit(user.orgId, user.id, "template.updated", "WorkflowTemplate", t.id, { version: updated.version });
  return ok(hydrate(updated, ["fields", "levels", "settings"]));
}, "ADMIN");

export const PATCH = withAuth(async (req, { params, user }) => {
  const t = await prisma.workflowTemplate.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!t) throw notFound();
  const body = (await req.json()) as { isActive?: boolean };
  const updated = await prisma.workflowTemplate.update({ where: { id: t.id }, data: { isActive: !!body.isActive } });
  await audit(user.orgId, user.id, body.isActive ? "template.activated" : "template.deactivated", "WorkflowTemplate", t.id);
  return ok(hydrate(updated, ["fields", "levels", "settings"]));
}, "ADMIN");

export const DELETE = withAuth(async (_req, { params, user }) => {
  const t = await prisma.workflowTemplate.findFirst({
    where: { id: params.id, orgId: user.orgId },
    include: { _count: { select: { requests: true } } },
  });
  if (!t) throw notFound();
  if (t._count.requests > 0) throw badRequest("This workflow has requests. Deactivate it instead of deleting.");
  await prisma.workflowTemplate.delete({ where: { id: t.id } });
  await audit(user.orgId, user.id, "template.deleted", "WorkflowTemplate", t.id, { name: t.name });
  return ok({ id: t.id });
}, "ADMIN");
