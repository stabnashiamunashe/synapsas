import { prisma } from "@/lib/prisma";
import { ok, withPublic } from "@/lib/api";
import { parseJson } from "@/lib/json";
import { caseSettings } from "@/lib/cases";
import type { BrandingSettings } from "@/lib/types";

/** Public portal configuration: branding, contact details, announcement and the categories the public may report under. */
export const GET = withPublic(async () => {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) return ok(null);
  const settings = await caseSettings(org.id);
  const branding = parseJson<BrandingSettings>(org.branding, {});
  const categories = settings.publicPortal
    ? await prisma.caseCategory.findMany({ where: { orgId: org.id, isActive: true, isPublic: true }, select: { id: true, name: true, description: true, icon: true, defaultSlaHours: true, department: { select: { name: true } } }, orderBy: { name: "asc" } })
    : [];
  return ok({
    orgName: org.name,
    branding: { productName: branding.productName, logoUrl: branding.logoUrl, primaryColor: branding.primaryColor, footerText: branding.footerText },
    enabled: settings.publicPortal,
    heading: settings.portalHeading || `Report an issue or request a service from ${org.name}`,
    subtext: settings.portalSubtext || "Log a request, then track its progress with the reference number you receive.",
    contactEmail: settings.contactEmail || branding.supportEmail || null,
    contactPhone: settings.contactPhone || null,
    announcement: settings.announcementActive ? settings.announcement || null : null,
    categories,
  });
});
