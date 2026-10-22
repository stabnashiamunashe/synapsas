import { prisma } from "@/lib/prisma";
import { ok, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { hydrate } from "@/lib/json";

export const GET = withAuth(async (_req, { user }) => {
  const orgId = user.orgId;
  const scopeMine = !hasRole(user, "MANAGER");
  const base = scopeMine ? { orgId, requesterId: user.id } : { orgId };
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [pendingMine, myRequests, pendingAll, approvedMonth, rejectedMonth, overdue, recent, byStatus, byTemplate, completed] =
    await Promise.all([
      prisma.requestApproval.count({ where: { approverId: user.id, status: "PENDING", request: { status: "PENDING" } } }),
      prisma.request.count({ where: { orgId, requesterId: user.id, status: { notIn: ["CANCELLED"] } } }),
      prisma.request.count({ where: { ...base, status: "PENDING" } }),
      prisma.request.count({ where: { ...base, status: "APPROVED", completedAt: { gte: monthStart } } }),
      prisma.request.count({ where: { ...base, status: "REJECTED", completedAt: { gte: monthStart } } }),
      prisma.requestApproval.count({ where: { status: "PENDING", dueAt: { lt: new Date() }, request: { ...base, status: "PENDING" } } }),
      prisma.request.findMany({
        where: base,
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: {
          requester: { select: { id: true, name: true, avatarUrl: true } },
          template: { select: { id: true, name: true, category: true, color: true } },
        },
      }),
      prisma.request.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
      prisma.request.groupBy({ by: ["templateId"], where: { ...base, createdAt: { gte: monthStart } }, _count: { _all: true } }),
      prisma.request.findMany({
        where: { ...base, status: "APPROVED", submittedAt: { not: null }, completedAt: { gte: weekAgo } },
        select: { submittedAt: true, completedAt: true },
      }),
    ]);

  const templates = await prisma.workflowTemplate.findMany({ where: { orgId }, select: { id: true, name: true, color: true } });
  const tmap = new Map(templates.map((t) => [t.id, t]));
  const avgHours = completed.length
    ? completed.reduce((acc, r) => acc + (r.completedAt!.getTime() - r.submittedAt!.getTime()) / 3600000, 0) / completed.length
    : null;

  return ok({
    cards: { pendingMine, myRequests, pendingAll, approvedMonth, rejectedMonth, overdue, avgHours: avgHours ? Math.round(avgHours * 10) / 10 : null },
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    byTemplate: byTemplate.map((t) => ({ templateId: t.templateId, name: tmap.get(t.templateId)?.name || "?", color: tmap.get(t.templateId)?.color, count: t._count._all })),
    recent: recent.map((r) => ({ ...hydrate(r, ["data"]), templateSnapshot: undefined, activeLevels: undefined })),
  });
});
