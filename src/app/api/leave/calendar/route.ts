import { prisma } from "@/lib/prisma";
import { getQuery, ok, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { parseJson } from "@/lib/json";
import type { OrgSettings } from "@/lib/types";

/**
 * Leave calendar: approved and pending leave (requests under LEAVE workflows) overlapping a month, plus public holidays.
 * Officers see their section; managers and administrators can filter any section.
 */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const [y, m] = (q.get("month") || new Date().toISOString().slice(0, 7)).split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)), to = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { departmentId: true, headOf: { select: { id: true } } } });
  let departmentId = q.get("departmentId") || null;
  if (!hasRole(user, "MANAGER") && !departmentId) departmentId = me?.departmentId || null;
  const [org, requests] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user.orgId }, select: { settings: true } }),
    prisma.request.findMany({
      where: { orgId: user.orgId, status: { in: ["PENDING", "APPROVED"] }, template: { category: "LEAVE" }, ...(departmentId ? { requester: { departmentId } } : {}) },
      select: { id: true, referenceNo: true, status: true, data: true, requester: { select: { id: true, name: true, department: { select: { id: true, name: true, code: true } } } } },
      orderBy: { submittedAt: "desc" }, take: 2000,
    }),
  ]);
  const entries = [];
  for (const r of requests) {
    const d = parseJson<Record<string, unknown>>(r.data, {});
    const dates = Array.isArray(d.dates) ? (d.dates as string[]) : null;
    if (!dates || !dates[0]) continue;
    const s = new Date(dates[0]), e = new Date(dates[1] || dates[0]);
    if (isNaN(s.getTime()) || e < from || s > to) continue;
    entries.push({ id: r.id, referenceNo: r.referenceNo, status: r.status, leaveType: String(d.leaveType || "Leave"), days: Number(d.daysRequired) || null, from: dates[0], to: dates[1] || dates[0], user: r.requester, department: r.requester.department });
  }
  const settings = parseJson<OrgSettings>(org?.settings || "{}", {});
  const holidays = (settings.publicHolidays || []).filter((h) => h.date.startsWith(`${y}-${String(m).padStart(2, "0")}`));
  return ok({ month: `${y}-${String(m).padStart(2, "0")}`, entries, holidays, allHolidays: settings.publicHolidays || [], canSeeAll: hasRole(user, "MANAGER"), myDepartmentId: me?.departmentId || null });
});
