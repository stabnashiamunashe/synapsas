import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { audit } from "@/lib/notify";
import { assignTrip } from "@/lib/fleet";
import { tripInclude } from "../route";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), vehicleId: z.string().min(1), driverUserId: z.string().optional().nullable() }),
  z.object({ action: z.literal("start"), odometerStart: z.number().int().min(0) }),
  z.object({ action: z.literal("complete"), odometerEnd: z.number().int().min(0), fuelLitres: z.number().min(0).optional().nullable(), notes: z.string().max(2000).optional().nullable() }),
  z.object({ action: z.literal("cancel"), notes: z.string().max(2000).optional().nullable() }),
]);

/** Trip lifecycle: assign (transport office) → start (driver/office, odometer) → complete (odometer, fuel) or cancel. */
export const POST = withAuth(async (req, { params, user }) => {
  const t = await prisma.vehicleTrip.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!t) throw notFound();
  const body = await parseBody(req, schema);
  const office = hasRole(user, "MANAGER");
  const isDriver = t.driverUserId === user.id;
  let updated;
  switch (body.action) {
    case "assign":
      if (!office) throw forbidden("Only the transport office can assign vehicles");
      await assignTrip(user.orgId, t.id, body.vehicleId, body.driverUserId || null, user.id);
      break;
    case "start":
      if (!office && !isDriver) throw forbidden();
      if (t.status !== "ASSIGNED" || !t.vehicleId) throw badRequest("Assign a vehicle first");
      updated = await prisma.vehicleTrip.update({ where: { id: t.id }, data: { status: "ONGOING", odometerStart: body.odometerStart } });
      await prisma.vehicle.update({ where: { id: t.vehicleId }, data: { status: "IN_USE", odometer: body.odometerStart } });
      break;
    case "complete":
      if (!office && !isDriver) throw forbidden();
      if (!["ASSIGNED", "ONGOING"].includes(t.status) || !t.vehicleId) throw badRequest("Trip is not in progress");
      if (t.odometerStart !== null && body.odometerEnd < t.odometerStart) throw badRequest("End odometer cannot be lower than the start reading");
      updated = await prisma.vehicleTrip.update({ where: { id: t.id }, data: { status: "COMPLETED", odometerEnd: body.odometerEnd, fuelLitres: body.fuelLitres ?? null, notes: body.notes ?? undefined } });
      await prisma.vehicle.update({ where: { id: t.vehicleId }, data: { status: "AVAILABLE", odometer: body.odometerEnd } });
      break;
    case "cancel":
      if (!office && t.requesterId !== user.id) throw forbidden();
      if (["COMPLETED"].includes(t.status)) throw badRequest("Completed trips cannot be cancelled");
      updated = await prisma.vehicleTrip.update({ where: { id: t.id }, data: { status: "CANCELLED", notes: body.notes ?? undefined } });
      if (t.vehicleId && t.status === "ONGOING") await prisma.vehicle.update({ where: { id: t.vehicleId }, data: { status: "AVAILABLE" } });
      break;
  }
  await audit(user.orgId, user.id, `trip.${body.action}`, "VehicleTrip", t.id, {});
  const full = await prisma.vehicleTrip.findUnique({ where: { id: t.id }, include: tripInclude });
  void updated;
  return ok({ ...full, fuelLitres: full?.fuelLitres === null || full?.fuelLitres === undefined ? null : Number(full.fuelLitres) });
});
