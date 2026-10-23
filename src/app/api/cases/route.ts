import { prisma } from "@/lib/prisma";
import { getQuery, ok, paging, parseBody, withAuth } from "@/lib/api";
import { caseCreateSchema } from "@/lib/validators";
import { clientInfo } from "@/lib/security";
import { caseInclude, caseScope, caseSettings, createCase, serializeCase } from "@/lib/cases";
import { CASE_STATUSES } from "@/lib/caseTypes";
import type { Prisma } from "@prisma/client";

/**
 * List cases. Filters: status (CSV), priority (CSV), departmentId, categoryId, assigneeId, projectId, q, slaBreached=1,
 * mine=1, source; pagination page/pageSize (max 200). Returns counts per status for the board header.
 */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const { skip, take, page, pageSize } = paging(req, 50);
  const settings = await caseSettings(user.orgId);
  const scope = await caseScope(user);
  const where: Prisma.CaseWhereInput = { orgId: user.orgId, ...scope };
  const csv = (k: string) => (q.get(k) || "").split(",").map((s) => s.trim()).filter(Boolean);
  const statuses = csv("status").filter((s) => (CASE_STATUSES as readonly string[]).includes(s));
  if (statuses.length) where.status = { in: statuses };
  const priorities = csv("priority");
  if (priorities.length) where.priority = { in: priorities };
  if (q.get("departmentId")) where.departmentId = q.get("departmentId")!;
  if (q.get("categoryId")) where.categoryId = q.get("categoryId")!;
  if (q.get("assigneeId")) where.assigneeId = q.get("assigneeId") === "none" ? null : q.get("assigneeId")!;
  if (q.get("projectId")) where.projectId = q.get("projectId")!;
  if (q.get("source")) where.source = q.get("source")!;
  if (q.get("mine") === "1") where.OR = [{ assigneeId: user.id }, { reporterUserId: user.id }];
  if (q.get("slaBreached") === "1") { where.slaDueAt = { lt: new Date() }; where.status = { notIn: ["RESOLVED", "CLOSED", "REJECTED"], ...(statuses.length ? { in: statuses } : {}) }; }
  const search = q.get("q")?.trim();
  if (search) {
    where.AND = [{ OR: [{ referenceNo: { contains: search } }, { title: { contains: search } }, { description: { contains: search } }, { reporterName: { contains: search } }, { reporterPhone: { contains: search } }, { locationAddress: { contains: search } }] }];
  }
  const [items, total, counts, breached] = await Promise.all([
    prisma.case.findMany({ where, include: caseInclude, orderBy: [{ createdAt: "desc" }], skip, take }),
    prisma.case.count({ where }),
    prisma.case.groupBy({ by: ["status"], where: { orgId: user.orgId, ...scope }, _count: { _all: true } }),
    prisma.case.count({ where: { orgId: user.orgId, ...scope, slaDueAt: { lt: new Date() }, status: { notIn: ["RESOLVED", "CLOSED", "REJECTED"] } } }),
  ]);
  const countsByStatus = Object.fromEntries(CASE_STATUSES.map((s) => [s, 0]));
  for (const c of counts) countsByStatus[c.status] = c._count._all;
  return ok({ items: items.map((c) => serializeCase(c, settings.slaWarningHours)), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), countsByStatus, slaBreachedCount: breached, settings });
});

/** Staff intake (phone, walk-in, email or own report). */
export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, caseCreateSchema);
  const c = await createCase(user.orgId, { ...body, reporterEmail: body.reporterEmail || null, reporterUserId: body.reporterEmail && body.reporterEmail.toLowerCase() === user.email ? user.id : body.source === "STAFF" || !body.source ? user.id : null, source: body.source || "STAFF" }, user, clientInfo(req));
  const full = await prisma.case.findUnique({ where: { id: c.id }, include: caseInclude });
  return ok(serializeCase(full!), { status: 201 });
});
