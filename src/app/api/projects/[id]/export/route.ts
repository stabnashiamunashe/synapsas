import { prisma } from "@/lib/prisma";
import { notFound, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { clientInfo } from "@/lib/security";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** CSV of every request on a project with its cost, for finance reconciliation. */
export const GET = withAuth(async (req, { params, user }) => {
  const p = await prisma.project.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!p) throw notFound();
  const rows = await prisma.request.findMany({
    where: { projectId: p.id },
    orderBy: { createdAt: "asc" },
    include: { requester: { select: { name: true, email: true } }, template: { select: { name: true } } },
  });
  const lines = [["Project", "Reference", "Title", "Workflow", "Status", "Priority", "Requester", "Email", "Cost", "Currency", "Created", "Submitted", "Completed"].map(cell).join(",")];
  let total = 0, approved = 0;
  for (const r of rows) {
    const amount = r.costAmount == null ? "" : Number(r.costAmount);
    if (typeof amount === "number") { total += amount; if (r.status === "APPROVED") approved += amount; }
    lines.push([p.code, r.referenceNo, r.title, r.template.name, r.status, r.priority, r.requester.name, r.requester.email, amount, p.currency, r.createdAt.toISOString(), r.submittedAt?.toISOString() || "", r.completedAt?.toISOString() || ""].map(cell).join(","));
  }
  lines.push("");
  lines.push([`Approved total`, approved.toFixed(2), p.currency].map(cell).join(","));
  lines.push([`All requests total`, total.toFixed(2), p.currency].map(cell).join(","));
  if (p.budgetAmount != null) lines.push([`Budget`, Number(p.budgetAmount).toFixed(2), p.currency].map(cell).join(","));
  await audit(user.orgId, user.id, "project.exported", "Project", p.id, { rows: rows.length }, clientInfo(req));
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="project-${p.code}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
});
