import { prisma } from "@/lib/prisma";
import { getQuery, ok, withAuth } from "@/lib/api";
import { parseJson } from "@/lib/json";
import type { OrgSettings } from "@/lib/types";

/** Leave register: per-officer balances for the year (managers: own section; administrators: everyone). CSV with ?format=csv. */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const year = Number(q.get("year")) || new Date().getFullYear();
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { departmentId: true, headOf: { select: { id: true } } } });
  const depts = [...(me?.headOf.map((d) => d.id) || []), ...(me?.departmentId ? [me.departmentId] : [])];
  const scope = user.role === "MANAGER" ? { departmentId: { in: depts } } : {};
  if (q.get("departmentId")) Object.assign(scope, { departmentId: q.get("departmentId") });
  const [org, users, requests] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user.orgId }, select: { settings: true } }),
    prisma.user.findMany({ where: { orgId: user.orgId, isActive: true, ...scope }, select: { id: true, name: true, jobTitle: true, department: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.request.findMany({ where: { orgId: user.orgId, status: { in: ["APPROVED", "PENDING"] }, template: { category: "LEAVE" }, submittedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }, select: { requesterId: true, status: true, data: true } }),
  ]);
  const entitlement = parseJson<OrgSettings>(org?.settings || "{}", {}).annualLeaveDays ?? 12;
  const rows = users.map((u) => {
    const mine = requests.filter((r) => r.requesterId === u.id).map((r) => ({ status: r.status, d: parseJson<Record<string, unknown>>(r.data, {}) }));
    const days = (x: Record<string, unknown>) => Number(x.daysRequired ?? x.days) || 0;
    const annual = (x: Record<string, unknown>) => /annual|vacation|off/i.test(String(x.leaveType || "Annual"));
    const taken = mine.filter((r) => r.status === "APPROVED" && annual(r.d)).reduce((s, r) => s + days(r.d), 0);
    const pending = mine.filter((r) => r.status === "PENDING" && annual(r.d)).reduce((s, r) => s + days(r.d), 0);
    const sick = mine.filter((r) => r.status === "APPROVED" && /sick/i.test(String(r.d.leaveType))).reduce((s, r) => s + days(r.d), 0);
    const other = mine.filter((r) => r.status === "APPROVED" && !annual(r.d) && !/sick/i.test(String(r.d.leaveType))).reduce((s, r) => s + days(r.d), 0);
    return { id: u.id, name: u.name, jobTitle: u.jobTitle, department: u.department?.name || "", entitlement, taken, pending, remaining: Math.max(0, entitlement - taken), sick, other };
  });
  if (q.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Name", "Position", "Section", "Entitlement", "Annual taken", "Pending", "Remaining", "Sick", "Other"];
    const body = rows.map((r) => [r.name, r.jobTitle, r.department, r.entitlement, r.taken, r.pending, r.remaining, r.sick, r.other].map(esc).join(","));
    return new Response([head.map(esc).join(","), ...body].join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="leave-register-${year}.csv"`, "cache-control": "no-store" } });
  }
  return ok({ year, entitlement, rows });
}, "MANAGER");
