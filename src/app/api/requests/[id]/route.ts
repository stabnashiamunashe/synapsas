import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { updateRequestSchema } from "@/lib/validators";
import { hydrate, parseJson, toJson } from "@/lib/json";
import { cancelRequest, loadRequest } from "@/lib/engine";
import { normaliseFormData } from "@/lib/formula";
import { extractCost } from "@/lib/cost";
import { assertProject } from "@/lib/projects";
import type { TemplateSettings } from "@/lib/types";
import { hasRole } from "@/lib/auth";
import { audit } from "@/lib/notify";
import type { FieldDef } from "@/lib/types";

export const GET = withAuth(async (_req, { params, user }) => {
  const r = await loadRequest(params.id, user.orgId);
  if (!r) throw notFound();
  const involved = r.requesterId === user.id || r.approvals.some((a) => a.approverId === user.id);
  if (!involved && !hasRole(user, "MANAGER")) throw forbidden();
  const [comments, attachments] = await Promise.all([
    prisma.comment.findMany({
      where: { requestId: r.id },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.attachment.findMany({
      where: { requestId: r.id },
      include: { uploadedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const myPending = r.approvals.find((a) => a.approverId === user.id && a.status === "PENDING" && a.levelOrder === r.currentLevel);
  const { passwordHash: _p, ...requester } = r.requester;
  void _p;
  return ok({
    ...hydrate(r, ["data", "activeLevels", "templateSnapshot"]),
    costAmount: r.costAmount == null ? null : Number(r.costAmount),
    project: r.project ? { id: r.project.id, code: r.project.code, name: r.project.name } : null,
    requester: { ...requester, manager: r.requester.manager ? { id: r.requester.manager.id, name: r.requester.manager.name } : null },
    template: hydrate(r.template, ["fields", "levels", "settings"]),
    approvals: r.approvals.map((a) => ({ ...a, approver: { id: a.approver.id, name: a.approver.name, email: a.approver.email, avatarUrl: a.approver.avatarUrl } })),
    comments,
    attachments,
    permissions: {
      canAct: !!myPending,
      canEdit: r.requesterId === user.id && ["DRAFT", "RETURNED"].includes(r.status),
      canSubmit: r.requesterId === user.id && ["DRAFT", "RETURNED"].includes(r.status),
      canCancel: ["DRAFT", "PENDING", "RETURNED"].includes(r.status) && (r.requesterId === user.id || hasRole(user, "ADMIN")),
      isAdmin: hasRole(user, "ADMIN"),
    },
  });
});

export const PATCH = withAuth(async (req, { params, user }) => {
  const r = await loadRequest(params.id, user.orgId);
  if (!r) throw notFound();
  if (r.requesterId !== user.id && !hasRole(user, "ADMIN")) throw forbidden();
  if (!["DRAFT", "RETURNED"].includes(r.status)) throw badRequest("Only drafts or returned requests can be edited");
  const body = await parseBody(req, updateRequestSchema);
  const fields = parseJson<FieldDef[]>(r.template.fields, []);
  const settings = parseJson<TemplateSettings>(r.template.settings, {});
  const nextData = body.data ? normaliseFormData(fields, body.data) : null;
  const updated = await prisma.request.update({
    where: { id: r.id },
    data: {
      title: body.title,
      priority: body.priority,
      ...(body.projectId !== undefined ? { projectId: await assertProject(user.orgId, body.projectId) } : {}),
      ...(nextData ? { data: toJson(nextData), costAmount: extractCost(fields, settings, nextData) } : {}),
    },
  });
  await audit(user.orgId, user.id, "request.updated", "Request", r.id);
  return ok(hydrate(updated, ["data", "activeLevels", "templateSnapshot"]));
});

export const DELETE = withAuth(async (_req, { params, user }) => {
  const r = await loadRequest(params.id, user.orgId);
  if (!r) throw notFound();
  if (r.status === "DRAFT" && (r.requesterId === user.id || hasRole(user, "ADMIN"))) {
    await prisma.request.delete({ where: { id: r.id } });
    await audit(user.orgId, user.id, "request.deleted", "Request", r.id, { referenceNo: r.referenceNo });
    return ok({ id: r.id, deleted: true });
  }
  const res = await cancelRequest(r.id, user.orgId, user.id, hasRole(user, "ADMIN"));
  return ok(hydrate(res!, ["data", "activeLevels", "templateSnapshot"]));
});
