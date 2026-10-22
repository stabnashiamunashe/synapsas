import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, getQuery, ok, paging, parseBody, withAuth } from "@/lib/api";
import { createRequestSchema } from "@/lib/validators";
import { hydrate, parseJson, toJson } from "@/lib/json";
import { nextReferenceNo, submitRequest } from "@/lib/engine";
import { normaliseFormData, renderTemplate } from "@/lib/formula";
import { extractCost } from "@/lib/cost";
import { assertProject } from "@/lib/projects";
import { limitsFor, withinLimit } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import { audit } from "@/lib/notify";
import { hasRole } from "@/lib/auth";
import type { FieldDef, Role, TemplateSettings } from "@/lib/types";

export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const { page, pageSize, skip, take } = paging(req);
  const status = q.get("status");
  const templateId = q.get("templateId");
  const projectId = q.get("projectId");
  const scope = q.get("scope") || (hasRole(user, "MANAGER") ? "all" : "mine"); // mine | all | involved
  const search = q.get("q");
  const from = q.get("from");
  const to = q.get("to");

  const where = {
    orgId: user.orgId,
    ...(status ? { status: { in: status.split(",") } } : {}),
    ...(templateId ? { templateId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(scope === "mine" ? { requesterId: user.id } : {}),
    ...(scope === "involved" ? { OR: [{ requesterId: user.id }, { approvals: { some: { approverId: user.id } } }] } : {}),
    ...(search ? { OR: [{ title: { contains: search } }, { referenceNo: { contains: search } }] } : {}),
    ...(from || to
      ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };
  // Members can only list their own or involved requests.
  if (!hasRole(user, "MANAGER") && scope === "all") {
    Object.assign(where, { OR: [{ requesterId: user.id }, { approvals: { some: { approverId: user.id } } }] });
  }

  const [total, rows] = await Promise.all([
    prisma.request.count({ where }),
    prisma.request.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { id: true, name: true, email: true, avatarUrl: true } },
        template: { select: { id: true, name: true, category: true, icon: true, color: true } },
        project: { select: { id: true, code: true, name: true } },
        approvals: { where: { status: "PENDING" }, include: { approver: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  return ok({
    total,
    page,
    pageSize,
    items: rows.map((r) => ({
      ...hydrate(r, ["data", "activeLevels"]),
      costAmount: r.costAmount == null ? null : Number(r.costAmount),
      templateSnapshot: undefined,
      pendingWith: r.approvals.map((a) => a.approver),
    })),
  });
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, createRequestSchema);
  const template = await prisma.workflowTemplate.findFirst({ where: { id: body.templateId, orgId: user.orgId, isActive: true } });
  if (!template) throw badRequest("Workflow not found or inactive");
  const settings = parseJson<TemplateSettings>(template.settings, {});
  if (settings.requesterRoles?.length && !settings.requesterRoles.includes(user.role as Role))
    throw forbidden("Your role cannot raise this type of request");

  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthly = await prisma.request.count({ where: { orgId: user.orgId, createdAt: { gte: monthStart } } });
  if (!withinLimit(limitsFor(effectivePlan(org!)).requestsPerMonth, monthly)) throw badRequest("Monthly request limit reached for your plan.");

  const fields = parseJson<FieldDef[]>(template.fields, []);
  const data = normaliseFormData(fields, body.data);
  const title =
    body.title?.trim() ||
    (settings.titleTemplate ? renderTemplate(settings.titleTemplate, data) : "") ||
    `${template.name} request`;
  const projectId = await assertProject(user.orgId, body.projectId);
  const referenceNo = await nextReferenceNo(template.id);
  const created = await prisma.request.create({
    data: {
      orgId: user.orgId,
      templateId: template.id,
      referenceNo,
      title,
      requesterId: user.id,
      priority: body.priority || settings.defaultPriority || "NORMAL",
      projectId,
      costAmount: extractCost(fields, settings, data),
      data: toJson(data),
      status: "DRAFT",
    },
  });
  await audit(user.orgId, user.id, "request.created", "Request", created.id, { referenceNo });
  if (body.submit) {
    await submitRequest(created.id, user.orgId, user.id);
  }
  const fresh = await prisma.request.findUnique({ where: { id: created.id } });
  return ok({ ...hydrate(fresh!, ["data", "activeLevels", "templateSnapshot"]), costAmount: fresh!.costAmount == null ? null : Number(fresh!.costAmount) }, { status: 201 });
});
