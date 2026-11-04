import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, parseBody, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";

export const licenceTypeSchema = z.object({
  code: z.string().min(2).max(16).regex(/^[A-Z0-9]+$/, "Use capital letters and digits only"),
  name: z.string().min(2).max(120),
  category: z.string().min(1).max(64),
  description: z.string().max(5000).optional().nullable(),
  fee: z.number().min(0),
  currency: z.string().max(8).optional(),
  validityMonths: z.number().int().min(1).max(600),
  requiresInspection: z.boolean().optional(),
  requirements: z.array(z.string().min(1).max(200)).max(40).optional(),
  departmentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const typeInclude = { department: { select: { id: true, name: true, code: true } }, _count: { select: { licences: true } } } as const;
export const serializeType = <T extends { fee: unknown }>(t: T) => ({ ...t, fee: Number(t.fee) });

/** Licence catalogue: the kinds of licence and permit the council issues, with fees, validity and document requirements. */
export const GET = withAuth(async (req, { user }) => {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const list = await prisma.licenceType.findMany({ where: { orgId: user.orgId, ...(all ? {} : { isActive: true }) }, include: typeInclude, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return ok(list.map(serializeType));
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, licenceTypeSchema);
  if (await prisma.licenceType.findUnique({ where: { orgId_code: { orgId: user.orgId, code: body.code } } })) throw badRequest("A licence type with that code already exists");
  const t = await prisma.licenceType.create({ data: { orgId: user.orgId, code: body.code, name: body.name, category: body.category, description: body.description, fee: body.fee, currency: body.currency || "USD", validityMonths: body.validityMonths, requiresInspection: body.requiresInspection ?? true, requirements: body.requirements || [], departmentId: body.departmentId || null, isActive: body.isActive ?? true }, include: typeInclude });
  await audit(user.orgId, user.id, "licenceType.created", "LicenceType", t.id, { code: t.code, name: t.name });
  return ok(serializeType(t), { status: 201 });
}, "ADMIN");
