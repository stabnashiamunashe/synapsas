import { prisma } from "@/lib/prisma";
import { ok, withPublic } from "@/lib/api";
import { parseJson } from "@/lib/json";
import type { BrandingSettings } from "@/lib/types";

/** Public licensing catalogue for the /apply page: active licence types with fees, validity and required documents. */
export const GET = withPublic(async () => {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) return ok(null);
  const branding = parseJson<BrandingSettings>(org.branding, {});
  const settings = parseJson<{ licensing?: { portal?: boolean; prefix?: string; intro?: string } }>(org.settings, {});
  const enabled = settings.licensing?.portal !== false;
  const types = enabled
    ? await prisma.licenceType.findMany({ where: { orgId: org.id, isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, code: true, name: true, category: true, description: true, fee: true, currency: true, validityMonths: true, requiresInspection: true, requirements: true, department: { select: { name: true } } } })
    : [];
  return ok({
    orgName: org.name, enabled,
    branding: { productName: branding.productName, logoUrl: branding.logoUrl, primaryColor: branding.primaryColor, footerText: branding.footerText },
    intro: settings.licensing?.intro || "Apply for council licences and permits online. You receive a reference number to track progress, and you can upload supporting documents here or bring them to the licensing office.",
    types: types.map((t) => ({ ...t, fee: Number(t.fee), requirements: (t.requirements as string[]) || [] })),
  });
});
