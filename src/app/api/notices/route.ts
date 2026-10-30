import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getQuery, ok, parseBody, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { parseJson, toJson } from "@/lib/json";
import { audit, notify } from "@/lib/notify";

export const noticeSchema = z.object({
  title: z.string().min(3).max(255),
  body: z.string().min(1).max(50000),
  kind: z.enum(["CIRCULAR", "POLICY", "ANNOUNCEMENT", "MEMO"]).default("CIRCULAR"),
  departmentIds: z.array(z.string()).default([]),
  roles: z.array(z.enum(["OWNER", "ADMIN", "MANAGER", "MEMBER"])).default([]),
  requiresAck: z.boolean().default(false),
  pinned: z.boolean().default(false),
  linkUrl: z.string().url().max(1000).optional().nullable().or(z.literal("")),
  publish: z.boolean().default(true),
  expiresAt: z.string().datetime().optional().nullable(),
});

/** Notices visible to me (audience by section and role), with my acknowledgement state. ?all=1 lists everything for administrators. */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { departmentId: true } });
  const all = q.get("all") === "1" && hasRole(user, "ADMIN");
  const now = new Date();
  const list = await prisma.notice.findMany({
    where: { orgId: user.orgId, ...(all ? {} : { publishedAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }) },
    include: { createdBy: { select: { name: true } }, acks: { where: { userId: user.id }, select: { ackAt: true } }, _count: { select: { acks: true } } },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    take: 200,
  });
  const visible = list.filter((n) => {
    if (all) return true;
    const depts = parseJson<string[]>(n.departmentIds, []);
    const roles = parseJson<string[]>(n.roles, []);
    return (depts.length === 0 || (me?.departmentId && depts.includes(me.departmentId))) && (roles.length === 0 || roles.includes(user.role));
  });
  return ok(visible.map((n) => ({ ...n, departmentIds: parseJson<string[]>(n.departmentIds, []), roles: parseJson<string[]>(n.roles, []), acknowledged: n.acks.length > 0, ackAt: n.acks[0]?.ackAt || null, ackCount: n._count.acks, acks: undefined })));
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, noticeSchema);
  const n = await prisma.notice.create({ data: { orgId: user.orgId, title: body.title, body: body.body, kind: body.kind, departmentIds: toJson(body.departmentIds), roles: toJson(body.roles), requiresAck: body.requiresAck, pinned: body.pinned, linkUrl: body.linkUrl || null, publishedAt: body.publish ? new Date() : null, expiresAt: body.expiresAt ? new Date(body.expiresAt) : null, createdById: user.id } });
  if (body.publish) {
    const audience = await prisma.user.findMany({ where: { orgId: user.orgId, isActive: true, ...(body.departmentIds.length ? { departmentId: { in: body.departmentIds } } : {}), ...(body.roles.length ? { role: { in: body.roles } } : {}) }, select: { id: true } });
    await notify(user.orgId, audience.map((u) => u.id), { title: `${body.kind === "POLICY" ? "Policy" : body.kind === "ANNOUNCEMENT" ? "Announcement" : body.kind === "MEMO" ? "Memo" : "Circular"}: ${body.title}`, body: body.requiresAck ? "Please read and acknowledge." : body.body.slice(0, 160), link: `/app/notices?open=${n.id}`, type: "INFO" });
  }
  await audit(user.orgId, user.id, "notice.created", "Notice", n.id, { title: n.title, published: body.publish });
  return ok(n, { status: 201 });
}, "ADMIN");
