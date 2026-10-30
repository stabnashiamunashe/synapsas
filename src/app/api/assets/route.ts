import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, getQuery, ok, parseBody, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { hasRole } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export const assetSchema = z.object({
  tag: z.string().min(1).max(64),
  category: z.string().min(1).max(64),
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  serial: z.string().max(120).optional().nullable(),
  status: z.enum(["IN_STORE", "ISSUED", "IN_REPAIR", "LOST", "DISPOSED"]).optional(),
  assignedToId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchaseCost: z.number().min(0).optional().nullable(),
  warrantyUntil: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const assetInclude = { assignedTo: { select: { id: true, name: true } }, department: { select: { id: true, name: true, code: true } }, _count: { select: { cases: true } } } as const;
export const serializeAsset = <T extends { purchaseCost: Prisma.Decimal | null }>(a: T) => ({ ...a, purchaseCost: a.purchaseCost === null ? null : Number(a.purchaseCost) });

/** Asset register. ?mine=1 lists the equipment issued to me; ?q= searches tag, serial, make, model. ?format=csv exports. */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const where: Prisma.AssetWhereInput = { orgId: user.orgId };
  if (q.get("mine") === "1" || !hasRole(user, "MANAGER")) where.assignedToId = user.id; // officers only see what is issued to them
  if (q.get("status")) where.status = { in: q.get("status")!.split(",") };
  if (q.get("category")) where.category = q.get("category")!;
  if (q.get("departmentId")) where.departmentId = q.get("departmentId")!;
  if (q.get("assignedToId")) where.assignedToId = q.get("assignedToId")!;
  const s = q.get("q")?.trim();
  if (s) where.OR = [{ tag: { contains: s } }, { serial: { contains: s } }, { make: { contains: s } }, { model: { contains: s } }, { assignedTo: { name: { contains: s } } }];
  const list = await prisma.asset.findMany({ where, include: assetInclude, orderBy: [{ category: "asc" }, { tag: "asc" }], take: 2000 });
  if (q.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Tag", "Category", "Make", "Model", "Serial", "Status", "Assigned to", "Section", "Location", "Purchased", "Cost", "Warranty until"];
    const body = list.map((a) => [a.tag, a.category, a.make, a.model, a.serial, a.status, a.assignedTo?.name, a.department?.name, a.location, a.purchaseDate?.toISOString().slice(0, 10), a.purchaseCost ? Number(a.purchaseCost) : "", a.warrantyUntil?.toISOString().slice(0, 10)].map(esc).join(","));
    return new Response([head.map(esc).join(","), ...body].join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="assets-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
  }
  const counts = await prisma.asset.groupBy({ by: ["status"], where: { orgId: user.orgId }, _count: { _all: true } });
  return ok({ items: list.map(serializeAsset), counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) });
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, assetSchema);
  const exists = await prisma.asset.findUnique({ where: { orgId_tag: { orgId: user.orgId, tag: body.tag } } });
  if (exists) throw badRequest("An asset with that tag already exists");
  const a = await prisma.asset.create({
    data: { orgId: user.orgId, tag: body.tag, category: body.category, make: body.make, model: body.model, serial: body.serial, status: body.assignedToId ? "ISSUED" : body.status || "IN_STORE", assignedToId: body.assignedToId || null, departmentId: body.departmentId || null, location: body.location, purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null, purchaseCost: body.purchaseCost ?? null, warrantyUntil: body.warrantyUntil ? new Date(body.warrantyUntil) : null, notes: body.notes,
      events: { create: [{ kind: "CREATED", actorId: user.id, note: "Added to the register" }, ...(body.assignedToId ? [{ kind: "ISSUED", actorId: user.id, toUserId: body.assignedToId, note: "Issued on registration" }] : [])] } },
    include: assetInclude,
  });
  await audit(user.orgId, user.id, "asset.created", "Asset", a.id, { tag: a.tag, category: a.category });
  return ok(serializeAsset(a), { status: 201 });
}, "MANAGER");
