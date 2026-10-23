import { prisma } from "@/lib/prisma";
import { forbidden, getQuery, ok, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { parseJson } from "@/lib/json";
import type { OrgSettings } from "@/lib/types";

/**
 * Annual leave balance for the calendar year: entitlement (org setting, default 12 days as on the ZimStat
 * "Application for Annual Leave" form) minus days on approved leave requests, plus days still pending.
 * Counts requests whose template category is LEAVE and whose form carries `daysRequired` (or `days`).
 */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const userId = q.get("userId") || user.id;
  const year = Number(q.get("year")) || new Date().getFullYear();
  if (userId !== user.id && !hasRole(user, "MANAGER")) throw forbidden();
  const [org, target, requests] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user.orgId }, select: { settings: true } }),
    prisma.user.findFirst({ where: { id: userId, orgId: user.orgId }, select: { id: true, name: true } }),
    prisma.request.findMany({
      where: {
        orgId: user.orgId,
        requesterId: userId,
        status: { in: ["APPROVED", "PENDING"] },
        template: { category: "LEAVE" },
        submittedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
      select: { id: true, referenceNo: true, status: true, data: true, title: true, submittedAt: true },
      orderBy: { submittedAt: "desc" },
    }),
  ]);
  if (!target) throw forbidden();
  const entitlement = parseJson<OrgSettings>(org?.settings || "{}", {}).annualLeaveDays ?? 12;
  const days = (r: { data: string }) => {
    const d = parseJson<Record<string, unknown>>(r.data, {});
    const raw = d.daysRequired ?? d.days ?? d.numberOfDays;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  // Only annual/vacation-type leave counts against the 12-day entitlement; sick, special and unpaid leave do not.
  const annual = requests.filter((r) => {
    const t = String(parseJson<Record<string, unknown>>(r.data, {}).leaveType || "Annual").toLowerCase();
    return t.includes("annual") || t.includes("vacation") || t.includes("off");
  });
  const taken = annual.filter((r) => r.status === "APPROVED").reduce((s, r) => s + days(r), 0);
  const pending = annual.filter((r) => r.status === "PENDING").reduce((s, r) => s + days(r), 0);
  return ok({
    userId: target.id,
    name: target.name,
    year,
    entitlement,
    taken,
    pending,
    remaining: Math.max(0, entitlement - taken),
    availableAfterPending: Math.max(0, entitlement - taken - pending),
    requests: annual.map((r) => ({ id: r.id, referenceNo: r.referenceNo, title: r.title, status: r.status, days: days(r), submittedAt: r.submittedAt })),
  });
});
