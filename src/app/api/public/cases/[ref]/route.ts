import { prisma } from "@/lib/prisma";
import { ApiError, ok, withPublic } from "@/lib/api";
import { clientInfo, rateLimit } from "@/lib/security";
import { slaState } from "@/lib/caseTypes";

/** Public tracking by reference number: status, timeline, public updates and public attachments. No personal data is returned. */
export const GET = withPublic(async (req, { params }) => {
  const ctx = clientInfo(req);
  const rl = rateLimit(`track:${ctx.ip}`, 60, 10 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many lookups. Try again shortly.");
  const ref = decodeURIComponent(params.ref || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{1,6}-\d{4}-\d{4,6}$/.test(ref)) throw new ApiError(404, "No case found with that reference");
  const c = await prisma.case.findUnique({
    where: { referenceNo: ref },
    include: {
      department: { select: { name: true } }, category: { select: { name: true } }, duplicateOf: { select: { referenceNo: true } },
      events: { orderBy: { createdAt: "asc" }, select: { fromStatus: true, toStatus: true, reason: true, createdAt: true } },
      comments: { where: { isInternal: false }, orderBy: { createdAt: "asc" }, select: { id: true, authorName: true, body: true, createdAt: true } },
      attachments: { where: { isPublic: true }, select: { id: true, fileName: true, mimeType: true, size: true, stage: true, createdAt: true } },
    },
  });
  if (!c) throw new ApiError(404, "No case found with that reference");
  const sla = slaState(c.slaDueAt, c.status);
  return ok({
    referenceNo: c.referenceNo, title: c.title, description: c.description, status: c.status, priority: c.priority,
    category: c.category?.name || null, department: c.department?.name || null, locationAddress: c.locationAddress, office: c.office,
    createdAt: c.createdAt, updatedAt: c.lastActivityAt, slaDueAt: c.slaDueAt, slaBreached: sla.breached, resolvedAt: c.resolvedAt, closedAt: c.closedAt,
    duplicateOf: c.duplicateOf?.referenceNo || null, rating: c.rating, canRate: ["RESOLVED", "CLOSED"].includes(c.status),
    timeline: c.events, updates: c.comments, attachments: c.attachments,
  });
});
