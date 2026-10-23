import { prisma } from "@/lib/prisma";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { caseRatingSchema } from "@/lib/validators";
import { clientInfo, rateLimit } from "@/lib/security";
import { audit } from "@/lib/notify";

/** Reporter satisfaction rating (1–5) once the case is resolved or closed. The reporter proves identity with the phone or email they reported with. */
export const POST = withPublic(async (req, { params }) => {
  const ctx = clientInfo(req);
  const rl = rateLimit(`rate:${ctx.ip}`, 10, 60 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many attempts. Try again later.");
  const ref = decodeURIComponent(params.ref || "").trim().toUpperCase();
  const { rating, feedback, reporterContact } = await parseBody(req, caseRatingSchema);
  const c = await prisma.case.findUnique({ where: { referenceNo: ref } });
  if (!c) throw new ApiError(404, "No case found with that reference");
  const contact = reporterContact.trim().toLowerCase().replace(/\s+/g, "");
  const matches = [c.reporterEmail?.toLowerCase(), c.reporterPhone?.replace(/\s+/g, "")].filter(Boolean).includes(contact);
  if (!matches) throw new ApiError(403, "That contact does not match the one on the report");
  if (!["RESOLVED", "CLOSED"].includes(c.status)) throw new ApiError(400, "You can rate a report once it has been resolved");
  await prisma.case.update({ where: { id: c.id }, data: { rating, feedback: feedback || null } });
  await audit(c.orgId, null, "case.rated", "Case", c.id, { rating }, ctx);
  return ok({ rated: true });
});
