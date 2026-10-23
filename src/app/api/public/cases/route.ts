import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { publicCaseSchema } from "@/lib/validators";
import { clientInfo, rateLimit } from "@/lib/security";
import { caseSettings, createCase, findPotentialDuplicates } from "@/lib/cases";

/** Short-lived token that lets the reporter attach photos right after submitting (no account needed). */
export function uploadToken(caseId: string, createdAt: Date) {
  return createHmac("sha256", process.env.AUTH_SECRET || "dev-secret-change-me").update(`${caseId}:${createdAt.getTime()}`).digest("base64url");
}

/**
 * Anonymous public report. 10 per hour per IP, honeypot field, categories limited to public ones.
 * Returns the reference number, a tracking URL, an upload token (valid 30 minutes) and any likely duplicates.
 */
export const POST = withPublic(async (req) => {
  const ctx = clientInfo(req);
  const rl = rateLimit(`public-case:${ctx.ip}`, 10, 60 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many reports from this network. Please try again later.");
  const body = await parseBody(req, publicCaseSchema);
  if (body.website) return ok({ referenceNo: "OK" }); // bot filled the honeypot: pretend success
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new ApiError(503, "Portal unavailable");
  const settings = await caseSettings(org.id);
  if (!settings.publicPortal) throw new ApiError(403, "Public reporting is switched off");
  if (!body.reporterPhone && !body.reporterEmail) throw new ApiError(422, "Give a phone number or an email address so we can update you", [{ path: "reporterPhone", message: "Phone or email required" }]);
  if (body.categoryId) {
    const cat = await prisma.caseCategory.findFirst({ where: { id: body.categoryId, orgId: org.id, isActive: true, isPublic: true } });
    if (!cat) throw new ApiError(400, "Choose a valid category");
  }
  const duplicates = await findPotentialDuplicates(org.id, body);
  const c = await createCase(org.id, { ...body, reporterEmail: body.reporterEmail || null, source: "PUBLIC" }, null, ctx);
  return ok({ id: c.id, referenceNo: c.referenceNo, status: c.status, slaHours: c.slaHours, slaDueAt: c.slaDueAt, trackUrl: `/track/${encodeURIComponent(c.referenceNo)}`, uploadToken: uploadToken(c.id, c.createdAt), duplicates }, { status: 201 });
});
