import { prisma } from "@/lib/prisma";
import { getQuery, ok, withPublic } from "@/lib/api";
import { parseJson } from "@/lib/json";
import type { BrandingSettings } from "@/lib/types";

/** Public branding lookup for the login page: by ?slug= or by the request Host (custom domain). */
export const GET = withPublic(async (req) => {
  const q = getQuery(req);
  const slug = q.get("slug");
  const host = req.headers.get("host")?.split(":")[0];
  const org =
    (slug ? await prisma.organization.findUnique({ where: { slug } }) : null) ||
    (host ? await prisma.organization.findFirst({ where: { customDomain: host } }) : null) ||
    (await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } })); // single-organisation edition
  if (!org) return ok(null);
  const branding = parseJson<BrandingSettings>(org.branding, {});
  return ok({ name: org.name, slug: org.slug, branding });
});
