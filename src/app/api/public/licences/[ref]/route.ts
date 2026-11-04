import { prisma } from "@/lib/prisma";
import { ApiError, ok, withPublic } from "@/lib/api";
import { clientInfo, rateLimit } from "@/lib/security";
import { phoneTail, publicLicenceView } from "@/lib/licensing";

/**
 * Track an application: reference number plus the phone number (or email) given on the application.
 * Returns status, next step, document checklist, uploaded files, a public timeline and an upload token.
 */
export const GET = withPublic(async (req, { params }) => {
  const ctx = clientInfo(req);
  const rl = rateLimit(`public-licence-track:${ctx.ip}`, 60, 60 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many lookups. Please try again later.");
  const ref = decodeURIComponent(params.ref || "").trim().toUpperCase();
  const q = new URL(req.url).searchParams;
  const phone = phoneTail(q.get("phone"));
  const email = (q.get("email") || "").trim().toLowerCase();
  if (!phone && !email) throw new ApiError(400, "Enter the phone number or email address used on the application");
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const l = org ? await prisma.licence.findFirst({ where: { orgId: org.id, OR: [{ referenceNo: ref }, { licenceNo: ref }] }, include: { type: { select: { name: true, category: true, requirements: true } }, events: { orderBy: { createdAt: "asc" } }, attachments: { select: { id: true, label: true, fileName: true, size: true, createdAt: true }, orderBy: { createdAt: "asc" } } } }) : null;
  const matches = l && ((phone.length >= 7 && phoneTail(l.phone) === phone) || (email && l.email?.toLowerCase() === email));
  if (!l || !matches) throw new ApiError(404, "No application found for that reference and contact detail");
  return ok(publicLicenceView(l));
});
