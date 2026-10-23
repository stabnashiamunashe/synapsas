import { prisma } from "@/lib/prisma";
import { forbidden, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { caseUpdateSchema } from "@/lib/validators";
import { clientInfo } from "@/lib/security";
import { hasRole } from "@/lib/auth";
import { caseInclude, caseScope, caseSettings, serializeCase, updateCase } from "@/lib/cases";

export const GET = withAuth(async (_req, { params, user }) => {
  const scope = await caseScope(user);
  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: user.orgId, ...scope },
    include: {
      ...caseInclude,
      reporter: { select: { id: true, name: true, email: true } },
      duplicateOf: { select: { id: true, referenceNo: true, title: true } },
      duplicates: { select: { id: true, referenceNo: true, title: true } },
      events: { orderBy: { createdAt: "asc" } },
      comments: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) throw notFound();
  const settings = await caseSettings(user.orgId);
  return ok({ ...serializeCase(c, settings.slaWarningHours), canEditRouting: hasRole(user, "MANAGER"), canLinkDuplicate: hasRole(user, "MANAGER") });
});

/** Edit fields (status has its own endpoint). Requires `version` for optimistic concurrency. */
export const PATCH = withAuth(async (req, { params, user }) => {
  const scope = await caseScope(user);
  const exists = await prisma.case.findFirst({ where: { id: params.id, orgId: user.orgId, ...scope }, select: { id: true } });
  if (!exists) throw notFound();
  const { version, ...patch } = await parseBody(req, caseUpdateSchema);
  if (!hasRole(user, "MANAGER") && (patch.assigneeId !== undefined || patch.departmentId !== undefined || patch.slaHours !== undefined)) throw forbidden("Only section heads and administrators can reassign or re-route cases");
  await updateCase(user.orgId, params.id, patch, version, user, clientInfo(req));
  const full = await prisma.case.findUnique({ where: { id: params.id }, include: caseInclude });
  return ok(serializeCase(full!));
});
