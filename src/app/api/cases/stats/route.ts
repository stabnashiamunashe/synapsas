import { prisma } from "@/lib/prisma";
import { ok, withAuth } from "@/lib/api";
import { caseScope } from "@/lib/cases";
import { CASE_DONE, CASE_PRIORITIES, CASE_STATUSES } from "@/lib/caseTypes";

/** Service desk analytics: KPIs, breakdowns by status/priority/source/section, 14-day trend. Scoped by role. */
export const GET = withAuth(async (_req, { user }) => {
  const scope = await caseScope(user);
  const where = { orgId: user.orgId, ...scope };
  const now = new Date();
  const since = new Date(now.getTime() - 13 * 86400_000);
  since.setHours(0, 0, 0, 0);
  const [total, byStatus, byPriority, bySource, byDept, breached, resolved, recent, ratings] = await Promise.all([
    prisma.case.count({ where }),
    prisma.case.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.case.groupBy({ by: ["priority"], where, _count: { _all: true } }),
    prisma.case.groupBy({ by: ["source"], where, _count: { _all: true } }),
    prisma.case.groupBy({ by: ["departmentId", "status"], where, _count: { _all: true } }),
    prisma.case.count({ where: { ...where, slaDueAt: { lt: now }, status: { notIn: CASE_DONE } } }),
    prisma.case.findMany({ where: { ...where, resolvedAt: { not: null } }, select: { createdAt: true, resolvedAt: true }, take: 2000, orderBy: { resolvedAt: "desc" } }),
    prisma.case.findMany({ where: { ...where, OR: [{ createdAt: { gte: since } }, { resolvedAt: { gte: since } }] }, select: { createdAt: true, resolvedAt: true } }),
    prisma.case.aggregate({ where: { ...where, rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } }),
  ]);
  const depts = await prisma.department.findMany({ where: { orgId: user.orgId }, select: { id: true, name: true, code: true } });
  const deptRows = depts.map((d) => {
    const rows = byDept.filter((r) => r.departmentId === d.id);
    const t = rows.reduce((s, r) => s + r._count._all, 0);
    const done = rows.filter((r) => CASE_DONE.includes(r.status as never)).reduce((s, r) => s + r._count._all, 0);
    return { id: d.id, name: d.name, code: d.code, total: t, open: t - done, resolved: done };
  }).filter((d) => d.total > 0);
  const resolvedCount = byStatus.filter((s) => ["RESOLVED", "CLOSED"].includes(s.status)).reduce((s, r) => s + r._count._all, 0);
  const avgHours = resolved.length ? resolved.reduce((s, r) => s + (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3600_000, 0) / resolved.length : null;
  const days: { date: string; created: number; resolved: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since.getTime() + i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, created: recent.filter((r) => r.createdAt.toISOString().slice(0, 10) === key).length, resolved: recent.filter((r) => r.resolvedAt && r.resolvedAt.toISOString().slice(0, 10) === key).length });
  }
  return ok({
    total, open: total - byStatus.filter((s) => CASE_DONE.includes(s.status as never)).reduce((s, r) => s + r._count._all, 0), resolved: resolvedCount,
    resolutionRatePct: total ? Math.round((resolvedCount / total) * 100) : 0, slaBreached: breached, avgResolutionHours: avgHours === null ? null : Math.round(avgHours * 10) / 10,
    avgRating: ratings._avg.rating ? Math.round(ratings._avg.rating * 10) / 10 : null, ratings: ratings._count.rating,
    byStatus: Object.fromEntries(CASE_STATUSES.map((s) => [s, byStatus.find((r) => r.status === s)?._count._all || 0])),
    byPriority: Object.fromEntries(CASE_PRIORITIES.map((p) => [p, byPriority.find((r) => r.priority === p)?._count._all || 0])),
    bySource: Object.fromEntries(bySource.map((r) => [r.source, r._count._all])),
    byDepartment: deptRows, trend: days,
  });
});
