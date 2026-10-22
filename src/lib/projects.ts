// Projects: group requests so spend can be aggregated and tracked against a budget.
import { prisma } from "./prisma";
import { badRequest } from "./api";

/** Validate a projectId belongs to the org and is open for new requests. Returns null for "no project". */
export async function assertProject(orgId: string, projectId: string | null | undefined) {
  if (!projectId) return null;
  const p = await prisma.project.findFirst({ where: { id: projectId, orgId }, select: { id: true, status: true, code: true } });
  if (!p) throw badRequest("Project not found");
  if (p.status === "CLOSED" || p.status === "ARCHIVED") throw badRequest(`Project ${p.code} is ${p.status.toLowerCase()} and no longer accepts requests`);
  return p.id;
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

export interface ProjectCostSummary {
  requests: number;
  approved: number;   // sum of costAmount for APPROVED requests (committed spend)
  pending: number;    // PENDING (in approval)
  draft: number;      // DRAFT + RETURNED
  rejected: number;   // REJECTED + CANCELLED
  committed: number;  // approved + pending
  budget: number | null;
  remaining: number | null;     // budget - approved
  remainingAfterPending: number | null;
  utilisation: number | null;   // approved / budget (0..1+)
  byStatus: Record<string, { count: number; amount: number }>;
}

/** Aggregate costs of every request on a project, grouped by status. */
export async function projectCostSummary(projectId: string, budgetAmount: unknown): Promise<ProjectCostSummary> {
  const rows = await prisma.request.groupBy({ by: ["status"], where: { projectId }, _sum: { costAmount: true }, _count: { _all: true } });
  const byStatus: Record<string, { count: number; amount: number }> = {};
  let requests = 0;
  for (const r of rows) {
    byStatus[r.status] = { count: r._count._all, amount: num(r._sum.costAmount) };
    requests += r._count._all;
  }
  const amt = (s: string) => byStatus[s]?.amount || 0;
  const approved = amt("APPROVED");
  const pending = amt("PENDING");
  const draft = amt("DRAFT") + amt("RETURNED");
  const rejected = amt("REJECTED") + amt("CANCELLED");
  const budget = budgetAmount == null ? null : num(budgetAmount);
  return {
    requests, approved, pending, draft, rejected, committed: approved + pending, budget,
    remaining: budget == null ? null : budget - approved,
    remainingAfterPending: budget == null ? null : budget - approved - pending,
    utilisation: budget ? approved / budget : null,
    byStatus,
  };
}

/** Summaries for many projects in two queries (list page). */
export async function projectSummaries(projectIds: string[], budgets: Map<string, unknown>) {
  if (!projectIds.length) return new Map<string, ProjectCostSummary>();
  const rows = await prisma.request.groupBy({ by: ["projectId", "status"], where: { projectId: { in: projectIds } }, _sum: { costAmount: true }, _count: { _all: true } });
  const out = new Map<string, ProjectCostSummary>();
  for (const id of projectIds) {
    const budget = budgets.get(id) == null ? null : num(budgets.get(id));
    const byStatus: Record<string, { count: number; amount: number }> = {};
    let requests = 0;
    for (const r of rows.filter((x) => x.projectId === id)) {
      byStatus[r.status] = { count: r._count._all, amount: num(r._sum.costAmount) };
      requests += r._count._all;
    }
    const amt = (s: string) => byStatus[s]?.amount || 0;
    const approved = amt("APPROVED"), pending = amt("PENDING");
    out.set(id, {
      requests, approved, pending, draft: amt("DRAFT") + amt("RETURNED"), rejected: amt("REJECTED") + amt("CANCELLED"), committed: approved + pending, budget,
      remaining: budget == null ? null : budget - approved, remainingAfterPending: budget == null ? null : budget - approved - pending, utilisation: budget ? approved / budget : null, byStatus,
    });
  }
  return out;
}

export function serializeProject<T extends { budgetAmount: unknown }>(p: T) {
  return { ...p, budgetAmount: p.budgetAmount == null ? null : Number(p.budgetAmount) };
}
