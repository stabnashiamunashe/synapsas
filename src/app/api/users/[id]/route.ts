import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { userUpdateSchema } from "@/lib/validators";
import { hashPassword, hasRole } from "@/lib/auth";
import { audit } from "@/lib/notify";
import { clientInfo } from "@/lib/security";
import { userSelect } from "@/lib/userSelect";
import { hydrate, parseJson, toJson } from "@/lib/json";
import type { NotificationPrefs } from "@/lib/types";

export const GET = withAuth(async (_req, { params, user }) => {
  const u = await prisma.user.findFirst({ where: { id: params.id, orgId: user.orgId }, select: userSelect });
  if (!u) throw notFound();
  return ok(hydrate(u, ["prefs"]));
});

export const PATCH = withAuth(async (req, { params, user }) => {
  const target = await prisma.user.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!target) throw notFound();
  const body = await parseBody(req, userUpdateSchema);
  const self = target.id === user.id;
  const isAdmin = hasRole(user, "ADMIN");
  if (!self && !isAdmin) throw forbidden();
  // Members may only edit their own profile fields and preferences.
  if (!isAdmin) {
    body.role = undefined;
    body.isActive = undefined;
    body.departmentId = undefined;
    body.managerId = undefined;
    body.email = undefined;
  }
  // Own password changes must go through /api/auth/password/change (requires the current password).
  if (self && body.password) throw badRequest("Use the change-password form for your own password");
  if (body.role === "OWNER" && user.role !== "OWNER") throw forbidden("Only an owner can grant ownership");
  if (target.role === "OWNER" && user.role !== "OWNER") throw forbidden("Only an owner can modify an owner");
  if (body.managerId === target.id) throw badRequest("A user cannot be their own manager");

  const prefs = body.prefs ? { ...parseJson<NotificationPrefs>(target.prefs, {}), ...body.prefs } : undefined;
  const adminReset = !!body.password && !self;
  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      name: body.name,
      email: body.email?.toLowerCase(),
      role: body.role,
      jobTitle: body.jobTitle,
      avatarUrl: body.avatarUrl,
      departmentId: body.departmentId === undefined ? undefined : body.departmentId || null,
      managerId: body.managerId === undefined ? undefined : body.managerId || null,
      isActive: body.isActive,
      ...(prefs ? { prefs: toJson(prefs) } : {}),
      // Admin reset: temporary password, must be changed, all existing sessions revoked, lock cleared.
      ...(adminReset
        ? { passwordHash: await hashPassword(body.password!), forcePasswordChange: true, sessionVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null }
        : {}),
      // Deactivating also revokes sessions immediately.
      ...(body.isActive === false ? { sessionVersion: { increment: 1 } } : {}),
    },
    select: userSelect,
  });
  const keys = Object.keys(body).filter((k) => k !== "password");
  await audit(user.orgId, user.id, adminReset ? "user.password_reset_by_admin" : "user.updated", "User", target.id, { keys }, clientInfo(req));
  return ok(hydrate(updated, ["prefs"]));
});

/** Unlock a locked account (admin). */
export const POST = withAuth(async (req, { params, user }) => {
  const target = await prisma.user.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!target) throw notFound();
  await prisma.user.update({ where: { id: target.id }, data: { failedLogins: 0, lockedUntil: null } });
  await audit(user.orgId, user.id, "user.unlocked", "User", target.id, {}, clientInfo(req));
  return ok({ id: target.id, unlocked: true });
}, "ADMIN");

/** Deactivate (soft delete). Hard deletes are avoided so approval history stays intact. */
export const DELETE = withAuth(async (req, { params, user }) => {
  const target = await prisma.user.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!target) throw notFound();
  if (target.id === user.id) throw badRequest("You cannot deactivate yourself");
  if (target.role === "OWNER") throw forbidden("Owners cannot be deactivated");
  await prisma.user.update({ where: { id: target.id }, data: { isActive: false, sessionVersion: { increment: 1 } } });
  await audit(user.orgId, user.id, "user.deactivated", "User", target.id, {}, clientInfo(req));
  return ok({ id: target.id, isActive: false });
}, "ADMIN");
