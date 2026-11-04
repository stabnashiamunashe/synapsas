import { prisma } from "@/lib/prisma";
import { ok, withPublic } from "@/lib/api";
import { parseJson } from "@/lib/json";
import { publicFields } from "@/lib/licensing";
import type { BrandingSettings } from "@/lib/types";

/** Public licensing catalogue for the /apply page: active licence types with fees, validity, required documents and their application forms. */
export const GET = withPublic(async () => {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) return ok(null);
  const branding = parseJson<BrandingSettings>(org.branding, {});
  const settings = parseJson<{ licensing?: { portal?: boolean; prefix?: string; intro?: string; paymentInstructions?: string } }>(org.settings, {});
  const enabled = settings.licensing?.portal !== false;
  const types = enabled
    ? await prisma.licenceType.findMany({ where: { orgId: org.id, isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, code: true, name: true, category: true, description: true, fee: true, currency: true, validityMonths: true, requiresInspection: true, requirements: true, formTitle: true, legalBasis: true, instructions: true, fields: true, kinds: true, department: { select: { name: true } } } })
    : [];
  return ok({
    orgName: org.name, enabled,
    branding: { productName: branding.productName, logoUrl: branding.logoUrl, primaryColor: branding.primaryColor, footerText: branding.footerText },
    intro: settings.licensing?.intro || "Apply for council licences and permits online. You receive a reference number to track progress, and you can upload supporting documents here or bring them to the licensing office.",
    paymentInstructions: settings.licensing?.paymentInstructions || "Pay at the council cashier (Civic Centre), by EcoCash or by bank transfer, quoting your application reference. Then submit the payment reference on the tracking page or on WhatsApp so Finance can confirm it.",
    types: types.map((t) => ({ ...t, fee: Number(t.fee), requirements: (t.requirements as string[]) || [], fields: publicFields(t.fields), kinds: (t.kinds as string[]) || ["NEW"] })),
  });
});
