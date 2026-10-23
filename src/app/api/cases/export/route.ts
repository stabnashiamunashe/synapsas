import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { caseScope } from "@/lib/cases";
import { slaState } from "@/lib/caseTypes";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export const GET = withAuth(async (_req, { user }) => {
  const scope = await caseScope(user);
  const rows = await prisma.case.findMany({ where: { orgId: user.orgId, ...scope }, include: { department: { select: { name: true } }, category: { select: { name: true } }, assignee: { select: { name: true } }, project: { select: { code: true } } }, orderBy: { createdAt: "desc" }, take: 5000 });
  const head = ["Reference", "Title", "Status", "Priority", "Section", "Category", "Assignee", "Project", "Reporter", "Phone", "Email", "Source", "Location", "Office", "SLA hours", "SLA due", "SLA breached", "Created", "Resolved", "Closed", "Rating"];
  const lines = rows.map((c) => [c.referenceNo, c.title, c.status, c.priority, c.department?.name, c.category?.name, c.assignee?.name, c.project?.code, c.reporterName, c.reporterPhone, c.reporterEmail, c.source, c.locationAddress, c.office, c.slaHours, c.slaDueAt?.toISOString(), slaState(c.slaDueAt, c.status).breached ? "yes" : "no", c.createdAt.toISOString(), c.resolvedAt?.toISOString(), c.closedAt?.toISOString(), c.rating].map(esc).join(","));
  return new Response([head.map(esc).join(","), ...lines].join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="cases-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}, "MANAGER");
