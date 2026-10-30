import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { audit, notify } from "@/lib/notify";
import { assetInclude, assetSchema, serializeAsset } from "../route";

export const GET = withAuth(async (_req, { params, user }) => {
  const a = await prisma.asset.findFirst({ where: { id: params.id, orgId: user.orgId }, include: { ...assetInclude, events: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } }, cases: { select: { id: true, referenceNo: true, title: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 } } });
  if (!a) throw notFound();
  return ok(serializeAsset(a));
});

export const PATCH = withAuth(async (req, { params, user }) => {
  const a = await prisma.asset.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!a) throw notFound();
  const body = await parseBody(req, assetSchema.partial());
  if (body.tag && body.tag !== a.tag && (await prisma.asset.findUnique({ where: { orgId_tag: { orgId: user.orgId, tag: body.tag } } }))) throw badRequest("An asset with that tag already exists");
  const updated = await prisma.asset.update({ where: { id: a.id }, data: { tag: body.tag, category: body.category, make: body.make, model: body.model, serial: body.serial, departmentId: body.departmentId === undefined ? undefined : body.departmentId || null, location: body.location, purchaseDate: body.purchaseDate === undefined ? undefined : body.purchaseDate ? new Date(body.purchaseDate) : null, purchaseCost: body.purchaseCost === undefined ? undefined : body.purchaseCost, warrantyUntil: body.warrantyUntil === undefined ? undefined : body.warrantyUntil ? new Date(body.warrantyUntil) : null, notes: body.notes }, include: assetInclude });
  await audit(user.orgId, user.id, "asset.updated", "Asset", a.id, { fields: Object.keys(body) });
  return ok(serializeAsset(updated));
}, "MANAGER");

const eventSchema = z.object({ kind: z.enum(["ISSUED", "RETURNED", "REPAIR", "REPAIRED", "LOST", "DISPOSED", "NOTE"]), toUserId: z.string().optional().nullable(), note: z.string().max(2000).optional().nullable() });

/** Movements: issue to an officer, return to store, send for repair, mark repaired / lost / disposed, or add a note. */
export const POST = withAuth(async (req, { params, user }) => {
  const a = await prisma.asset.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!a) throw notFound();
  const body = await parseBody(req, eventSchema);
  const next: Record<string, { status?: string; assignedToId?: string | null }> = {
    ISSUED: { status: "ISSUED", assignedToId: body.toUserId || null }, RETURNED: { status: "IN_STORE", assignedToId: null }, REPAIR: { status: "IN_REPAIR" }, REPAIRED: { status: a.assignedToId ? "ISSUED" : "IN_STORE" }, LOST: { status: "LOST" }, DISPOSED: { status: "DISPOSED", assignedToId: null }, NOTE: {},
  };
  if (body.kind === "ISSUED" && !body.toUserId) throw badRequest("Choose who the asset is issued to");
  if (body.kind === "ISSUED") {
    const u = await prisma.user.findFirst({ where: { id: body.toUserId!, orgId: user.orgId, isActive: true } });
    if (!u) throw badRequest("Officer not found");
  }
  const updated = await prisma.asset.update({ where: { id: a.id }, data: { ...next[body.kind], events: { create: { kind: body.kind, actorId: user.id, toUserId: body.toUserId || null, note: body.note || null } } }, include: assetInclude });
  if (body.kind === "ISSUED" && body.toUserId && body.toUserId !== user.id) await notify(user.orgId, [body.toUserId], { title: `Equipment issued to you: ${a.tag}`, body: `${a.category}${a.make ? ` ${a.make}` : ""}${a.model ? ` ${a.model}` : ""}. Keep it safe and report faults through the service desk.`, link: `/app/assets?mine=1`, type: "INFO" });
  await audit(user.orgId, user.id, `asset.${body.kind.toLowerCase()}`, "Asset", a.id, { tag: a.tag, toUserId: body.toUserId });
  return ok(serializeAsset(updated));
}, "MANAGER");
