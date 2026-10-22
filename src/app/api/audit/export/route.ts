import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { auditWhere } from "@/lib/auditQuery";
import { audit } from "@/lib/notify";
import { clientInfo } from "@/lib/security";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** CSV export of the audit log with the same filters as the list. Exporting is itself audited. */
export const GET = withAuth(async (req, { user }) => {
  const where = auditWhere(req, user.orgId);
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20000,
    include: { user: { select: { name: true, email: true } } },
  });
  const lines = [["When", "Actor", "Email", "Action", "Entity", "Entity ID", "IP", "User agent", "Details"].map(cell).join(",")];
  for (const r of rows) {
    lines.push([r.createdAt.toISOString(), r.user?.name || "system", r.user?.email || "", r.action, r.entityType, r.entityId || "", r.ip || "", r.userAgent || "", r.meta].map(cell).join(","));
  }
  await audit(user.orgId, user.id, "audit.exported", "AuditLog", null, { rows: rows.length }, clientInfo(req));
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}, "ADMIN");
