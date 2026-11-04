import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, ok, parseBody, withPublic } from "@/lib/api";
import { parseJson } from "@/lib/json";
import { clientInfo, rateLimit } from "@/lib/security";
import { createLicenceApplication, licenceUploadToken, serializeLicence } from "@/lib/licensing";
import { APPLICATION_KINDS } from "@/lib/licenceTypes";

export const publicLicenceSchema = z.object({
  typeId: z.string().min(1),
  applicationKind: z.enum(APPLICATION_KINDS).optional(),
  applicantName: z.string().min(2).max(160),
  tradingName: z.string().max(160).optional().nullable(),
  idNumber: z.string().max(40).optional().nullable(),
  phone: z.string().min(6).max(40),
  email: z.string().email().max(160).optional().or(z.literal("")).nullable(),
  standNumber: z.string().max(60).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  ward: z.string().max(40).optional().nullable(),
  activity: z.string().min(5).max(5000),
  data: z.record(z.string(), z.unknown()).optional(),
  declaration: z.literal(true),
  website: z.string().max(0).optional(), // honeypot
});

/**
 * Citizen application from the public portal. 10 per hour per IP, honeypot field. The applicant gets a reference
 * number, a tracking URL and an upload token for supporting documents (no account needed).
 */
export const POST = withPublic(async (req) => {
  const ctx = clientInfo(req);
  const rl = rateLimit(`public-licence:${ctx.ip}`, 10, 60 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many applications from this network. Please try again later.");
  const body = await parseBody(req, publicLicenceSchema);
  if (body.website) return ok({ referenceNo: "OK" });
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new ApiError(503, "Portal unavailable");
  if (parseJson<{ licensing?: { portal?: boolean } }>(org.settings, {}).licensing?.portal === false) throw new ApiError(403, "Online applications are switched off");
  const type = await prisma.licenceType.findFirst({ where: { id: body.typeId, orgId: org.id, isActive: true } });
  if (!type) throw new ApiError(400, "Choose a valid licence type");
  // keep only answers to the fields the type actually has (office-use answers are never accepted from the public)
  const allowed = new Set(((type.fields as { key: string }[]) || []).map((f) => f.key));
  const data = Object.fromEntries(Object.entries(body.data || {}).filter(([k]) => allowed.has(k) || k.endsWith("Total")));
  const l = await createLicenceApplication(org.id, { ...body, data, email: body.email || null, priority: "MEDIUM" }, { actorId: null, source: "PUBLIC" });
  const s = serializeLicence(l);
  return ok({ id: s.id, referenceNo: s.referenceNo, status: s.status, fee: s.feeAmount, currency: s.currency, requirements: (type.requirements as string[]) || [], requiresInspection: type.requiresInspection, trackUrl: `/verify?ref=${encodeURIComponent(s.referenceNo)}`, uploadToken: licenceUploadToken(s.id, s.createdAt) }, { status: 201 });
});
