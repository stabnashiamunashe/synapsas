import { prisma } from "@/lib/prisma";
import { getQuery, ok, withAuth } from "@/lib/api";
import { parseJson } from "@/lib/json";
import type { TemplateSnapshot } from "@/lib/types";

/** Analytics: volume by month, status mix, per-template turnaround, slowest levels, top approvers. */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const days = Math.min(365, Math.max(7, Number(q.get("days") || 90)));
  const since = new Date(Date.now() - days * 86400000);
  const orgId = user.orgId;

  const requests = await prisma.request.findMany({
    where: { orgId, createdAt: { gte: since } },
    select: { id: true, templateId: true, status: true, createdAt: true, submittedAt: true, completedAt: true, templateSnapshot: true },
  });
  const approvals = await prisma.requestApproval.findMany({
    where: { request: { orgId, createdAt: { gte: since } }, status: { in: ["APPROVED", "REJECTED", "RETURNED"] } },
    select: { approverId: true, levelName: true, levelOrder: true, createdAt: true, actedAt: true, status: true, requestId: true },
  });
  const templates = await prisma.workflowTemplate.findMany({ where: { orgId }, select: { id: true, name: true, color: true } });
  const users = await prisma.user.findMany({ where: { orgId }, select: { id: true, name: true } });
  const tname = new Map(templates.map((t) => [t.id, t]));
  const uname = new Map(users.map((u) => [u.id, u.name]));

  // Volume by month
  const byMonth = new Map<string, { month: string; created: number; approved: number; rejected: number }>();
  for (const r of requests) {
    const key = r.createdAt.toISOString().slice(0, 7);
    const row = byMonth.get(key) || { month: key, created: 0, approved: 0, rejected: 0 };
    row.created++;
    if (r.status === "APPROVED") row.approved++;
    if (r.status === "REJECTED") row.rejected++;
    byMonth.set(key, row);
  }

  // Per template stats
  const perTemplate = new Map<string, { templateId: string; name: string; color?: string | null; total: number; approved: number; rejected: number; pending: number; hours: number[] }>();
  for (const r of requests) {
    const row = perTemplate.get(r.templateId) || { templateId: r.templateId, name: tname.get(r.templateId)?.name || "?", color: tname.get(r.templateId)?.color, total: 0, approved: 0, rejected: 0, pending: 0, hours: [] };
    row.total++;
    if (r.status === "APPROVED") row.approved++;
    if (r.status === "REJECTED") row.rejected++;
    if (r.status === "PENDING") row.pending++;
    if (r.submittedAt && r.completedAt) row.hours.push((r.completedAt.getTime() - r.submittedAt.getTime()) / 3600000);
    perTemplate.set(r.templateId, row);
  }

  // Slowest levels (avg hours from step creation to action)
  const levelStats = new Map<string, { level: string; count: number; totalHours: number; template: string }>();
  const snapByReq = new Map(requests.map((r) => [r.id, parseJson<TemplateSnapshot>(r.templateSnapshot, { name: "?" } as TemplateSnapshot)]));
  for (const a of approvals) {
    if (!a.actedAt) continue;
    const key = `${snapByReq.get(a.requestId)?.name || "?"} · ${a.levelName}`;
    const row = levelStats.get(key) || { level: a.levelName, template: snapByReq.get(a.requestId)?.name || "?", count: 0, totalHours: 0 };
    row.count++;
    row.totalHours += (a.actedAt.getTime() - a.createdAt.getTime()) / 3600000;
    levelStats.set(key, row);
  }

  // Approver leaderboard
  const approverStats = new Map<string, { userId: string; name: string; actions: number; approved: number; rejected: number; totalHours: number }>();
  for (const a of approvals) {
    const row = approverStats.get(a.approverId) || { userId: a.approverId, name: uname.get(a.approverId) || "?", actions: 0, approved: 0, rejected: 0, totalHours: 0 };
    row.actions++;
    if (a.status === "APPROVED") row.approved++;
    if (a.status === "REJECTED") row.rejected++;
    if (a.actedAt) row.totalHours += (a.actedAt.getTime() - a.createdAt.getTime()) / 3600000;
    approverStats.set(a.approverId, row);
  }

  const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
  return ok({
    days,
    totals: {
      created: requests.length,
      approved: requests.filter((r) => r.status === "APPROVED").length,
      rejected: requests.filter((r) => r.status === "REJECTED").length,
      pending: requests.filter((r) => r.status === "PENDING").length,
      avgTurnaroundHours: avg(requests.filter((r) => r.submittedAt && r.completedAt).map((r) => (r.completedAt!.getTime() - r.submittedAt!.getTime()) / 3600000)),
    },
    byMonth: Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
    byStatus: ["DRAFT", "PENDING", "APPROVED", "REJECTED", "RETURNED", "CANCELLED"].map((s) => ({ status: s, count: requests.filter((r) => r.status === s).length })),
    perTemplate: Array.from(perTemplate.values()).map((t) => ({ ...t, avgHours: avg(t.hours), hours: undefined })),
    slowestLevels: Array.from(levelStats.values()).map((l) => ({ ...l, avgHours: Math.round((l.totalHours / l.count) * 10) / 10 })).sort((a, b) => b.avgHours - a.avgHours).slice(0, 8),
    approvers: Array.from(approverStats.values()).map((a) => ({ ...a, avgHours: Math.round((a.totalHours / a.actions) * 10) / 10 })).sort((a, b) => b.actions - a.actions).slice(0, 10),
  });
}, "MANAGER");
