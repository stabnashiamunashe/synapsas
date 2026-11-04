import { prisma } from "@/lib/prisma";
import { ok, withPublic } from "@/lib/api";

/** Public licence check: members of the public or enforcement officers enter a licence number and see whether it is valid. */
export const GET = withPublic(async (req) => {
  const no = new URL(req.url).searchParams.get("no")?.trim();
  if (!no || no.length < 4 || no.length > 40) return ok(null);
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!org) return ok(null);
  const l = await prisma.licence.findFirst({ where: { orgId: org.id, licenceNo: no.toUpperCase() }, include: { type: { select: { name: true, category: true } } } });
  if (!l) return ok(null);
  const expired = !!l.expiresAt && l.expiresAt < new Date();
  const valid = l.status === "ISSUED" && !expired;
  return ok({
    licenceNo: l.licenceNo, type: l.type.name, category: l.type.category, holder: l.tradingName || l.applicantName, premises: [l.standNumber ? `Stand ${l.standNumber}` : null, l.ward ? `Ward ${l.ward}` : null].filter(Boolean).join(", ") || null,
    status: valid ? "VALID" : l.status === "ISSUED" && expired ? "EXPIRED" : l.status, issuedAt: l.issuedAt, expiresAt: l.expiresAt,
  });
});
