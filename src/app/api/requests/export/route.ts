import { prisma } from "@/lib/prisma";
import { getQuery, withAuth } from "@/lib/api";
import { parseJson } from "@/lib/json";
import { hasRole } from "@/lib/auth";

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/** CSV export of requests (optionally filtered by templateId / status). Includes form data columns. */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const templateId = q.get("templateId") || undefined;
  const status = q.get("status") || undefined;
  const rows = await prisma.request.findMany({
    where: {
      orgId: user.orgId,
      ...(templateId ? { templateId } : {}),
      ...(status ? { status } : {}),
      ...(hasRole(user, "MANAGER") ? {} : { requesterId: user.id }),
    },
    include: { requester: { select: { name: true, email: true } }, template: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const dataKeys = new Set<string>();
  const parsed = rows.map((r) => {
    const d = parseJson<Record<string, unknown>>(r.data, {});
    Object.keys(d).forEach((k) => dataKeys.add(k));
    return { r, d };
  });
  const keys = Array.from(dataKeys);
  const header = ["Reference", "Title", "Workflow", "Status", "Priority", "Requester", "Email", "Submitted", "Completed", ...keys];
  const lines = [header.map(csvCell).join(",")];
  for (const { r, d } of parsed) {
    lines.push(
      [
        r.referenceNo, r.title, r.template.name, r.status, r.priority, r.requester.name, r.requester.email,
        r.submittedAt?.toISOString() || "", r.completedAt?.toISOString() || "",
        ...keys.map((k) => d[k]),
      ].map(csvCell).join(","),
    );
  }
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="requests-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
