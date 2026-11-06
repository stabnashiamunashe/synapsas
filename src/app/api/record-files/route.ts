import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, getQuery, ok, parseBody, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { registryAccess } from "@/lib/records";

export const fileSchema = z.object({
  fileNo: z.string().min(1).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9/.\-]*$/, "Use letters, digits, / . and - only, e.g. ADM/3/2"),
  title: z.string().min(2).max(200),
  series: z.string().min(1).max(80),
  description: z.string().max(5000).optional().nullable(),
  departmentId: z.string().optional().nullable(),
  retentionYears: z.number().int().min(0).max(200).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  confidential: z.boolean().optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});

export const fileInclude = { department: { select: { id: true, name: true, code: true } }, _count: { select: { records: true } } } as const;

/** File plan. ?all=1 includes closed files; ?q= searches number, title and description; ?series= / ?departmentId= filter. */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const where: Prisma.RecordFileWhereInput = { orgId: user.orgId };
  if (q.get("all") !== "1") where.status = "OPEN";
  if (q.get("series")) where.series = q.get("series")!;
  if (q.get("departmentId")) where.departmentId = q.get("departmentId")!;
  const s = q.get("q")?.trim();
  if (s) where.OR = [{ fileNo: { contains: s } }, { title: { contains: s } }, { description: { contains: s } }];
  const list = await prisma.recordFile.findMany({ where, include: fileInclude, orderBy: [{ series: "asc" }, { fileNo: "asc" }], take: 2000 });
  const last = await prisma.correspondence.groupBy({ by: ["fileId"], where: { orgId: user.orgId, fileId: { in: list.map((f) => f.id) } }, _max: { dateLogged: true } });
  const lastBy = Object.fromEntries(last.map((l) => [l.fileId || "", l._max.dateLogged]));
  return ok(list.map((f) => ({ ...f, lastActivityAt: lastBy[f.id] || null })));
});

/** Open a new file in the plan (registry clerks and managers). */
export const POST = withAuth(async (req, { user }) => {
  const access = await registryAccess(user);
  if (!access.canRegister) throw forbidden("Only the registry or a manager can open files");
  const body = await parseBody(req, fileSchema);
  const fileNo = body.fileNo.toUpperCase();
  if (await prisma.recordFile.findUnique({ where: { orgId_fileNo: { orgId: user.orgId, fileNo } } })) throw badRequest("A file with that number already exists");
  const f = await prisma.recordFile.create({ data: { orgId: user.orgId, fileNo, title: body.title, series: body.series, description: body.description || null, departmentId: body.departmentId || null, retentionYears: body.retentionYears ?? null, location: body.location || null, confidential: body.confidential ?? false }, include: fileInclude });
  await audit(user.orgId, user.id, "recordFile.opened", "RecordFile", f.id, { fileNo: f.fileNo, title: f.title });
  return ok({ ...f, lastActivityAt: null }, { status: 201 });
});
