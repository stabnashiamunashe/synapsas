import { prisma } from "@/lib/prisma";
import { notFound, ok, parseBody, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { vehicleSchema } from "../route";

export const PATCH = withAuth(async (req, { params, user }) => {
  const v = await prisma.vehicle.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!v) throw notFound();
  const body = await parseBody(req, vehicleSchema.partial());
  const updated = await prisma.vehicle.update({ where: { id: v.id }, data: { ...body, registration: body.registration ? body.registration.toUpperCase().trim() : undefined, departmentId: body.departmentId === undefined ? undefined : body.departmentId || null } });
  await audit(user.orgId, user.id, "vehicle.updated", "Vehicle", v.id, { fields: Object.keys(body) });
  return ok(updated);
}, "MANAGER");

export const DELETE = withAuth(async (_req, { params, user }) => {
  const v = await prisma.vehicle.findFirst({ where: { id: params.id, orgId: user.orgId }, include: { _count: { select: { trips: true } } } });
  if (!v) throw notFound();
  if (v._count.trips) await prisma.vehicle.update({ where: { id: v.id }, data: { status: "RETIRED" } });
  else await prisma.vehicle.delete({ where: { id: v.id } });
  await audit(user.orgId, user.id, "vehicle.retired", "Vehicle", v.id, { registration: v.registration });
  return ok({ id: v.id });
}, "ADMIN");
