import { prisma } from "@/lib/prisma";
import { badRequest, ok, parseBody, withAuth } from "@/lib/api";
import { orgUpdateSchema } from "@/lib/validators";
import { hydrate, parseJson, toJson } from "@/lib/json";
import { limitsFor } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import { audit } from "@/lib/notify";
import type { BrandingSettings, OrgSettings } from "@/lib/types";

export const GET = withAuth(async (_req, { user }) => {
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  return ok({ ...hydrate(org!, ["branding", "settings"]), limits: limitsFor(effectivePlan(org!)) });
});

export const PATCH = withAuth(async (req, { user }) => {
  const body = await parseBody(req, orgUpdateSchema);
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  if (!org) throw badRequest("Organisation missing");
  const limits = limitsFor(effectivePlan(org));
  if (body.customDomain && !limits.customDomain) throw badRequest("Custom domains require the Business plan or higher");
  if (body.branding && !limits.whiteLabel) {
    // Free plan may only change the product name and colour.
    const { productName, primaryColor } = body.branding;
    body.branding = { productName, primaryColor };
  }
  const branding = { ...parseJson<BrandingSettings>(org.branding, {}), ...(body.branding || {}) };
  const settings = { ...parseJson<OrgSettings>(org.settings, {}), ...(body.settings || {}) };
  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: {
      name: body.name ?? org.name,
      customDomain: body.customDomain === undefined ? org.customDomain : body.customDomain || null,
      branding: toJson(branding),
      settings: toJson(settings),
    },
  });
  await audit(org.id, user.id, "org.updated", "Organization", org.id, { keys: Object.keys(body) });
  return ok({ ...hydrate(updated, ["branding", "settings"]), limits });
}, "ADMIN");
