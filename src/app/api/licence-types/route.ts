import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, parseBody, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { fieldSchema } from "@/lib/validators";
import { APPLICATION_KINDS } from "@/lib/licenceTypes";

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
  /** the application form, same field schema as workflow templates */
  formTitle: z.string().max(200).optional().nullable(),
  legalBasis: z.string().max(200).optional().nullable(),
  instructions: z.string().max(5000).optional().nullable(),
  fields: z.array(fieldSchema).max(120).optional(),
  officeFields: z.array(fieldSchema).max(60).optional(),
  kinds: z.array(z.enum(APPLICATION_KINDS)).min(1).optional(),
});

export const typeInclude = { department: { select: { id: true, name: true, code: true } }, _count: { select: { licences: true } } } as const;
export const serializeType = <T extends { fee: unknown }>(t: T) => ({ ...t, fee: Number(t.fee) });

/** Licence catalogue: the kinds of licence and permit the council issues, with fees, validity, document requirements and their application forms. */
export const GET = withAuth(async (req, { user }) => {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const list = await prisma.licenceType.findMany({ where: { orgId: user.orgId, ...(all ? {} : { isActive: true }) }, include: typeInclude, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return ok(list.map(serializeType));
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, licenceTypeSchema);
  if (await prisma.licenceType.findUnique({ where: { orgId_code: { orgId: user.orgId, code: body.code } } })) throw badRequest("A licence type with that code already exists");
  const t = await prisma.licenceType.create({ data: { orgId: user.orgId, code: body.code, name: body.name, category: body.category, description: body.description, fee: body.fee, currency: body.currency || "USD", validityMonths: body.validityMonths, requiresInspection: body.requiresInspection ?? true, requirements: body.requirements || [], departmentId: body.departmentId || null, isActive: body.isActive ?? true, formTitle: body.formTitle || null, legalBasis: body.legalBasis || null, instructions: body.instructions || null, fields: (body.fields || []) as unknown as Prisma.InputJsonValue, officeFields: (body.officeFields || []) as unknown as Prisma.InputJsonValue, kinds: body.kinds || ["NEW", "RENEWAL"] }, include: typeInclude });
  await audit(user.orgId, user.id, "licenceType.created", "LicenceType", t.id, { code: t.code, name: t.name });
  return ok(serializeType(t), { status: 201 });
}, "ADMIN");
