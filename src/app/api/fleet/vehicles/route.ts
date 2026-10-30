import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, getQuery, ok, parseBody, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { availableVehicles } from "@/lib/fleet";

export const vehicleSchema = z.object({
  registration: z.string().min(2).max(32),
  make: z.string().max(80).optional().nullable(),
  model: z.string().max(80).optional().nullable(),
  type: z.string().max(40).optional(),
  status: z.enum(["AVAILABLE", "IN_USE", "MAINTENANCE", "RETIRED"]).optional(),
  odometer: z.number().int().min(0).optional(),
  departmentId: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

/** Vehicles; with ?from=&to= each carries `free` for that window. */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  if (q.get("from") && q.get("to")) return ok(await availableVehicles(user.orgId, new Date(q.get("from")!), new Date(q.get("to")!), q.get("excludeTripId") || undefined));
  const list = await prisma.vehicle.findMany({ where: { orgId: user.orgId }, include: { department: { select: { id: true, name: true } }, trips: { where: { status: { in: ["ASSIGNED", "ONGOING"] }, endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 1, select: { id: true, destination: true, startsAt: true, endsAt: true, status: true } } }, orderBy: { registration: "asc" } });
  return ok(list.map((v) => ({ ...v, nextTrip: v.trips[0] || null, trips: undefined })));
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, vehicleSchema);
  const reg = body.registration.toUpperCase().replace(/\s+/g, " ").trim();
  if (await prisma.vehicle.findUnique({ where: { orgId_registration: { orgId: user.orgId, registration: reg } } })) throw badRequest("That registration is already on the fleet list");
  const v = await prisma.vehicle.create({ data: { orgId: user.orgId, registration: reg, make: body.make, model: body.model, type: body.type || "Double cab", status: body.status || "AVAILABLE", odometer: body.odometer || 0, departmentId: body.departmentId || null, notes: body.notes } });
  await audit(user.orgId, user.id, "vehicle.created", "Vehicle", v.id, { registration: reg });
  return ok(v, { status: 201 });
}, "MANAGER");
