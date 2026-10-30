// Fleet: vehicles and trips. A trip is created when a "Vehicle request" workflow is approved; the transport officer
// then assigns a vehicle and driver, with overlap checks against other trips and maintenance.
import { prisma } from "./prisma";
import { parseJson } from "./json";
import { ApiError } from "./api";
import { audit, notify } from "./notify";
import type { TemplateSettings } from "./types";

export async function onTripRequestApproved(requestId: string) {
  const r = await prisma.request.findUnique({ where: { id: requestId }, include: { template: { select: { settings: true } } } });
  if (!r) return;
  const snap = parseJson<{ settings?: TemplateSettings }>(r.templateSnapshot, {});
  const creates = snap.settings?.createsTrip ?? parseJson<TemplateSettings>(r.template.settings, {}).createsTrip;
  if (!creates) return;
  if (await prisma.vehicleTrip.findFirst({ where: { requestId: r.id } })) return;
  const d = parseJson<Record<string, unknown>>(r.data, {});
  const dates = Array.isArray(d.dates) ? (d.dates as string[]) : [];
  const startsAt = dates[0] ? new Date(dates[0]) : new Date();
  const endsAt = dates[1] ? new Date(`${dates[1]}T23:59:00`) : startsAt;
  const trip = await prisma.vehicleTrip.create({
    data: {
      orgId: r.orgId, requestId: r.id, requesterId: r.requesterId, projectId: r.projectId,
      purpose: String(d.purpose || r.title).slice(0, 500), destination: String(d.destination || "").slice(0, 255) || "Not stated",
      passengers: Math.max(1, Number(d.passengers) || 1), startsAt, endsAt, status: "PLANNED",
    },
  });
  const transport = await prisma.department.findFirst({ where: { orgId: r.orgId, OR: [{ code: "TRN" }, { name: { contains: "Transport" } }, { code: "HRA" }] }, select: { headUserId: true, members: { select: { id: true }, where: { isActive: true } } } });
  const audience = [transport?.headUserId, ...(transport?.members.map((m) => m.id) || [])].filter((x): x is string => !!x);
  if (audience.length) await notify(r.orgId, audience, { title: `Vehicle needed: ${r.referenceNo}`, body: `${trip.destination}, ${startsAt.toDateString()} to ${endsAt.toDateString()}. Assign a vehicle and driver.`, link: `/app/fleet`, type: "APPROVAL" });
  await audit(r.orgId, null, "trip.created", "VehicleTrip", trip.id, { referenceNo: r.referenceNo });
}

/** Vehicles free for the whole window: not retired/maintenance and no overlapping assigned/ongoing trip. */
export async function availableVehicles(orgId: string, startsAt: Date, endsAt: Date, excludeTripId?: string) {
  const busy = await prisma.vehicleTrip.findMany({ where: { orgId, vehicleId: { not: null }, status: { in: ["ASSIGNED", "ONGOING"] }, startsAt: { lte: endsAt }, endsAt: { gte: startsAt }, ...(excludeTripId ? { id: { not: excludeTripId } } : {}) }, select: { vehicleId: true } });
  const busyIds = new Set(busy.map((b) => b.vehicleId!));
  const vehicles = await prisma.vehicle.findMany({ where: { orgId, status: { in: ["AVAILABLE", "IN_USE"] } }, orderBy: { registration: "asc" } });
  return vehicles.map((v) => ({ ...v, free: !busyIds.has(v.id) }));
}

export async function assignTrip(orgId: string, tripId: string, vehicleId: string, driverUserId: string | null, actorId: string) {
  const trip = await prisma.vehicleTrip.findFirst({ where: { id: tripId, orgId } });
  if (!trip) throw new ApiError(404, "Trip not found");
  if (["COMPLETED", "CANCELLED"].includes(trip.status)) throw new ApiError(400, "This trip is closed");
  const v = await prisma.vehicle.findFirst({ where: { id: vehicleId, orgId } });
  if (!v || !["AVAILABLE", "IN_USE"].includes(v.status)) throw new ApiError(400, "Vehicle is not available");
  const clash = await prisma.vehicleTrip.findFirst({ where: { orgId, vehicleId, id: { not: trip.id }, status: { in: ["ASSIGNED", "ONGOING"] }, startsAt: { lte: trip.endsAt }, endsAt: { gte: trip.startsAt } }, select: { id: true, destination: true, startsAt: true } });
  if (clash) throw new ApiError(409, `${v.registration} is already booked for ${clash.destination} on ${clash.startsAt.toDateString()}`);
  if (driverUserId) {
    const dclash = await prisma.vehicleTrip.findFirst({ where: { orgId, driverUserId, id: { not: trip.id }, status: { in: ["ASSIGNED", "ONGOING"] }, startsAt: { lte: trip.endsAt }, endsAt: { gte: trip.startsAt } }, select: { destination: true } });
    if (dclash) throw new ApiError(409, `That driver is already on a trip to ${dclash.destination} in that period`);
  }
  const updated = await prisma.vehicleTrip.update({ where: { id: trip.id }, data: { vehicleId, driverUserId, status: "ASSIGNED" } });
  await notify(orgId, [trip.requesterId, driverUserId].filter((x): x is string => !!x && x !== actorId), { title: `Vehicle assigned: ${v.registration}`, body: `${trip.destination}, ${trip.startsAt.toDateString()}${driverUserId ? ", driver assigned" : ""}.`, link: `/app/fleet`, type: "STATUS" });
  await audit(orgId, actorId, "trip.assigned", "VehicleTrip", trip.id, { vehicle: v.registration, driverUserId });
  return updated;
}
