import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getQuery, ok, parseBody, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { audit } from "@/lib/notify";
import type { Prisma } from "@prisma/client";

export const tripInclude = { vehicle: { select: { id: true, registration: true, make: true, model: true } }, driver: { select: { id: true, name: true } }, requester: { select: { id: true, name: true, department: { select: { name: true } } } }, project: { select: { id: true, code: true } }, request: { select: { id: true, referenceNo: true } } } as const;

/** Trips (bookings). Officers see their own; managers and above see all. Filters: status (CSV), vehicleId, from, to. */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const where: Prisma.VehicleTripWhereInput = { orgId: user.orgId };
  if (!hasRole(user, "MANAGER")) where.OR = [{ requesterId: user.id }, { driverUserId: user.id }];
  if (q.get("status")) where.status = { in: q.get("status")!.split(",") };
  if (q.get("vehicleId")) where.vehicleId = q.get("vehicleId")!;
  if (q.get("from")) where.endsAt = { gte: new Date(q.get("from")!) };
  if (q.get("to")) where.startsAt = { lte: new Date(q.get("to")!) };
  const list = await prisma.vehicleTrip.findMany({ where, include: tripInclude, orderBy: { startsAt: "desc" }, take: 500 });
  return ok(list.map((t) => ({ ...t, fuelLitres: t.fuelLitres === null ? null : Number(t.fuelLitres) })));
});

const schema = z.object({ destination: z.string().min(2).max(255), purpose: z.string().min(2).max(500), startsAt: z.string().datetime(), endsAt: z.string().datetime(), passengers: z.number().int().min(1).max(60).optional(), projectId: z.string().optional().nullable(), requesterId: z.string().optional() });

/** Direct booking by the transport office (no approval form), e.g. a standing arrangement. */
export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, schema);
  const t = await prisma.vehicleTrip.create({ data: { orgId: user.orgId, requesterId: body.requesterId || user.id, destination: body.destination, purpose: body.purpose, startsAt: new Date(body.startsAt), endsAt: new Date(body.endsAt), passengers: body.passengers || 1, projectId: body.projectId || null }, include: tripInclude });
  await audit(user.orgId, user.id, "trip.created", "VehicleTrip", t.id, { destination: t.destination, direct: true });
  return ok(t, { status: 201 });
}, "MANAGER");
