import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { projectSchema } from "@/lib/validators";
import { audit } from "@/lib/notify";
import { clientInfo } from "@/lib/security";
import { projectCostSummary, serializeProject } from "@/lib/projects";

const include = { owner: { select: { id: true, name: true } }, _count: { select: { requests: true } } };

/** Project with cost summary, breakdowns by workflow and month, and its requests. */
export const GET = withAuth(async (_req, { params, user }) => {
  const p = await prisma.project.findFirst({ where: { id: params.id, orgId: user.orgId }, include });
  if (!p) throw notFound();
  const [summary, requests] = await Promise.all([
    projectCostSummary(p.id, p.budgetAmount),
    prisma.request.findMany({
      where: { projectId: p.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, referenceNo: true, title: true, status: true, priority: true, costAmount: true, createdAt: true, submittedAt: true, completedAt: true,
        requester: { select: { id: true, name: true } }, template: { select: { id: true, name: true, color: true, category: true } },
      },
    }),
  ]);
  const num = (v: unknown) => (v == null ? null : Number(v));
  const byTemplate = new Map<string, { templateId: string; name: string; color?: string | null; count: number; approved: number; pending: number; other: number }>();
  const byMonth = new Map<string, { month: string; approved: number; pending: number; count: number }>();
  for (const r of requests) {
    const amount = num(r.costAmount) || 0;
    const t = byTemplate.get(r.template.id) || { templateId: r.template.id, name: r.template.name, color: r.template.color, count: 0, approved: 0, pending: 0, other: 0 };
    t.count++;
    if (r.status === "APPROVED") t.approved += amount; else if (r.status === "PENDING") t.pending += amount; else t.other += amount;
    byTemplate.set(r.template.id, t);
    const key = (r.completedAt || r.submittedAt || r.createdAt).toISOString().slice(0, 7);
    const m = byMonth.get(key) || { month: key, approved: 0, pending: 0, count: 0 };
    m.count++;
    if (r.status === "APPROVED") m.approved += amount; else if (r.status === "PENDING") m.pending += amount;
    byMonth.set(key, m);
  }
  return ok({
    ...serializeProject(p),
    summary,
    byTemplate: Array.from(byTemplate.values()).sort((a, b) => b.approved - a.approved),
    byMonth: Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
    requests: requests.map((r) => ({ ...r, costAmount: num(r.costAmount) })),
  });
});

export const PATCH = withAuth(async (req, { params, user }) => {
  const p = await prisma.project.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!p) throw notFound();
  const body = await parseBody(req, projectSchema.partial());
  if (body.code && body.code !== p.code) {
    const dup = await prisma.project.findUnique({ where: { orgId_code: { orgId: user.orgId, code: body.code } } });
    if (dup) throw badRequest(`Project code ${body.code} is already in use`);
  }
  const updated = await prisma.project.update({
    where: { id: p.id },
    data: {
      code: body.code, name: body.name, description: body.description, status: body.status, currency: body.currency,
      ...(body.budgetAmount !== undefined ? { budgetAmount: body.budgetAmount } : {}),
      ...(body.ownerUserId !== undefined ? { ownerUserId: body.ownerUserId || null } : {}),
      ...(body.departmentId !== undefined ? { departmentId: body.departmentId || null } : {}),
      ...(body.startsAt !== undefined ? { startsAt: body.startsAt ? new Date(body.startsAt) : null } : {}),
      ...(body.endsAt !== undefined ? { endsAt: body.endsAt ? new Date(body.endsAt) : null } : {}),
    },
    include,
  });
  await audit(user.orgId, user.id, "project.updated", "Project", p.id, { keys: Object.keys(body) }, clientInfo(req));
  return ok({ ...serializeProject(updated), summary: await projectCostSummary(p.id, updated.budgetAmount) });
}, "MANAGER");

/** Archive (requests keep their link). Hard delete only when the project has no requests. */
export const DELETE = withAuth(async (req, { params, user }) => {
  const p = await prisma.project.findFirst({ where: { id: params.id, orgId: user.orgId }, include: { _count: { select: { requests: true } } } });
  if (!p) throw notFound();
  if (p._count.requests > 0) {
    await prisma.project.update({ where: { id: p.id }, data: { status: "ARCHIVED" } });
    await audit(user.orgId, user.id, "project.archived", "Project", p.id, { code: p.code }, clientInfo(req));
    return ok({ id: p.id, archived: true });
  }
  await prisma.project.delete({ where: { id: p.id } });
  await audit(user.orgId, user.id, "project.deleted", "Project", p.id, { code: p.code }, clientInfo(req));
  return ok({ id: p.id, deleted: true });
}, "ADMIN");
