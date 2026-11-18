import { prisma } from "@/lib/prisma";
import { getQuery, ok, withAuth } from "@/lib/api";
import { caseScope } from "@/lib/cases";
import { hasRole } from "@/lib/roles";
import { DATA_REQUEST_WHERE, DR_BUCKETS, bucketOf, describeRequest, maskPhone, type DrBucket } from "@/lib/whatsapp/desk";
import type { Prisma } from "@prisma/client";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/**
 * Data requests lodged through the chatbot (DR- cases), newest first. `status` = pending | approved | delivered |
 * declined | all; `q` searches reference, title, requester and organisation. `format=csv` downloads the list.
 */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const scope = await caseScope(user);
  const bucket = (q.get("status") || "pending") as DrBucket | "all";
  const search = (q.get("q") || "").trim();
  const where: Prisma.CaseWhereInput = {
    orgId: user.orgId, ...scope, ...DATA_REQUEST_WHERE,
    ...(bucket !== "all" && DR_BUCKETS[bucket] ? { status: { in: [...DR_BUCKETS[bucket]] } } : {}),
    ...(search ? { OR: [{ referenceNo: { contains: search, mode: "insensitive" as const } }, { title: { contains: search, mode: "insensitive" as const } }, { reporterName: { contains: search, mode: "insensitive" as const } }, { description: { contains: search, mode: "insensitive" as const } }] } : {}),
  };
  const [items, counts] = await Promise.all([
    prisma.case.findMany({ where, orderBy: { createdAt: "desc" }, take: q.get("format") === "csv" ? 5000 : 500, include: { assignee: { select: { id: true, name: true } }, category: { select: { id: true, name: true } }, _count: { select: { attachments: true, comments: true } } } }),
    prisma.case.groupBy({ by: ["status"], where: { orgId: user.orgId, ...scope, ...DATA_REQUEST_WHERE }, _count: { _all: true } }),
  ]);
  const rows = items.map((c) => ({
    id: c.id, referenceNo: c.referenceNo, title: c.title, status: c.status, bucket: bucketOf(c.status), priority: c.priority, reporterName: c.reporterName, reporterEmail: c.reporterEmail, phone: c.reporterPhone ? maskPhone(c.reporterPhone) : null,
    assignee: c.assignee, category: c.category, attachments: c._count.attachments, comments: c._count.comments, createdAt: c.createdAt, resolvedAt: c.resolvedAt, slaDueAt: c.slaDueAt, version: c.version,
    request: describeRequest(c.customFields),
  }));
  if (q.get("format") === "csv") {
    if (!hasRole(user, "MANAGER")) return ok(rows);
    const head = ["Reference", "Lodged", "Status", "Requester", "Type", "Organisation", "Email", "Phone", "Subject area", "Geographic level", "Period", "Format", "Purpose", "Data needed", "Decision", "Decided by", "Decided at", "Note", "Assignee"];
    const lines = rows.map((r) => [r.referenceNo, r.createdAt.toISOString(), r.bucket, r.reporterName, r.request.requesterType, r.request.organisation, r.reporterEmail, r.phone, r.request.topic, r.request.geo, r.request.period, r.request.format, r.request.purpose, r.request.description, r.request.decision?.status, r.request.decision?.by, r.request.decision?.at, r.request.decision?.note, r.assignee?.name].map(esc).join(","));
    return new Response([head.map(esc).join(","), ...lines].join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="data-requests-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
  }
  const byBucket: Record<DrBucket, number> = { pending: 0, approved: 0, delivered: 0, declined: 0 };
  for (const c of counts) byBucket[bucketOf(c.status)] += c._count._all;
  return ok({ items: rows, counts: byBucket, canDecide: hasRole(user, "MANAGER") });
});
