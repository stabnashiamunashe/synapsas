import { prisma } from "@/lib/prisma";
import { getQuery, ok, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

/** Advances ledger. Officers see their own; managers their section; Finance/administrators everything. */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const where: Prisma.AdvanceWhereInput = { orgId: user.orgId };
  if (!hasRole(user, "ADMIN")) {
    const me = await prisma.user.findUnique({ where: { id: user.id }, select: { departmentId: true, department: { select: { code: true, name: true } }, headOf: { select: { id: true } } } });
    const finance = me?.department?.code === "FIN" || /finance/i.test(me?.department?.name || "");
    if (!finance) {
      if (user.role === "MANAGER") where.officer = { OR: [{ departmentId: { in: [...(me?.headOf.map((d) => d.id) || []), ...(me?.departmentId ? [me.departmentId] : [])] } }, { id: user.id }] };
      else where.userId = user.id;
    }
  }
  if (q.get("userId")) where.userId = q.get("userId")!;
  if (q.get("status")) where.status = { in: q.get("status")!.split(",") };
  if (q.get("overdue") === "1") { where.status = { in: ["OPEN", "PARTIALLY_CLEARED"] }; where.dueAt = { lt: new Date() }; }
  const list = await prisma.advance.findMany({ where, include: { officer: { select: { id: true, name: true, department: { select: { name: true } } } }, request: { select: { id: true, title: true, projectId: true, project: { select: { code: true } } } }, clearances: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } } } } }, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 500 });
  const now = Date.now();
  const items = list.map((a) => ({ ...a, amount: Number(a.amount), clearedAmount: Number(a.clearedAmount), outstanding: Number(a.amount) - Number(a.clearedAmount), overdue: ["OPEN", "PARTIALLY_CLEARED"].includes(a.status) && a.dueAt.getTime() < now, daysOverdue: Math.max(0, Math.floor((now - a.dueAt.getTime()) / 86400_000)), clearances: a.clearances.map((c) => ({ ...c, amount: Number(c.amount) })) }));
  const open = items.filter((a) => ["OPEN", "PARTIALLY_CLEARED"].includes(a.status));
  return ok({ items, summary: { openCount: open.length, outstanding: open.reduce((s, a) => s + a.outstanding, 0), overdueCount: open.filter((a) => a.overdue).length, overdueAmount: open.filter((a) => a.overdue).reduce((s, a) => s + a.outstanding, 0) }, canClear: hasRole(user, "ADMIN") || !!(where.userId === undefined && where.officer === undefined) });
});
