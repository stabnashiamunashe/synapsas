import { prisma } from "@/lib/prisma";
import { notFound, ok, parseBody, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { parseJson, toJson } from "@/lib/json";
import { audit } from "@/lib/notify";
import { noticeSchema } from "../route";

/** Notice with acknowledgement progress (administrators see who has and has not acknowledged). */
export const GET = withAuth(async (_req, { params, user }) => {
  const n = await prisma.notice.findFirst({ where: { id: params.id, orgId: user.orgId }, include: { createdBy: { select: { name: true } }, acks: { include: { user: { select: { id: true, name: true, department: { select: { name: true } } } } }, orderBy: { ackAt: "desc" } } } });
  if (!n) throw notFound();
  const depts = parseJson<string[]>(n.departmentIds, []), roles = parseJson<string[]>(n.roles, []);
  let pending: { id: string; name: string; department: string }[] = [];
  let audienceCount = 0;
  if (hasRole(user, "ADMIN")) {
    const audience = await prisma.user.findMany({ where: { orgId: user.orgId, isActive: true, ...(depts.length ? { departmentId: { in: depts } } : {}), ...(roles.length ? { role: { in: roles } } : {}) }, select: { id: true, name: true, department: { select: { name: true } } } });
    audienceCount = audience.length;
    const acked = new Set(n.acks.map((a) => a.userId));
    pending = audience.filter((u) => !acked.has(u.id)).map((u) => ({ id: u.id, name: u.name, department: u.department?.name || "" }));
  }
  return ok({ ...n, departmentIds: depts, roles, acknowledged: n.acks.some((a) => a.userId === user.id), audienceCount, pending, acks: hasRole(user, "ADMIN") ? n.acks : [] });
});

export const PATCH = withAuth(async (req, { params, user }) => {
  const n = await prisma.notice.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!n) throw notFound();
  const body = await parseBody(req, noticeSchema.partial());
  const updated = await prisma.notice.update({ where: { id: n.id }, data: { title: body.title, body: body.body, kind: body.kind, ...(body.departmentIds ? { departmentIds: toJson(body.departmentIds) } : {}), ...(body.roles ? { roles: toJson(body.roles) } : {}), requiresAck: body.requiresAck, pinned: body.pinned, linkUrl: body.linkUrl === undefined ? undefined : body.linkUrl || null, ...(body.publish === true && !n.publishedAt ? { publishedAt: new Date() } : {}), ...(body.publish === false ? { publishedAt: null } : {}), ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}) } });
  await audit(user.orgId, user.id, "notice.updated", "Notice", n.id, { fields: Object.keys(body) });
  return ok(updated);
}, "ADMIN");

export const DELETE = withAuth(async (_req, { params, user }) => {
  const n = await prisma.notice.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!n) throw notFound();
  await prisma.notice.delete({ where: { id: n.id } });
  await audit(user.orgId, user.id, "notice.deleted", "Notice", n.id, { title: n.title });
  return ok({ id: n.id });
}, "ADMIN");
