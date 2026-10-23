import { prisma } from "@/lib/prisma";
import { notFound, ok, parseBody, withAuth } from "@/lib/api";
import { caseCommentSchema } from "@/lib/validators";
import { audit, notify } from "@/lib/notify";
import { caseScope } from "@/lib/cases";
import { sendCaseUpdateEmail } from "@/lib/emails";

export const GET = withAuth(async (_req, { params, user }) => {
  const scope = await caseScope(user);
  const c = await prisma.case.findFirst({ where: { id: params.id, orgId: user.orgId, ...scope }, select: { id: true } });
  if (!c) throw notFound();
  const list = await prisma.caseComment.findMany({ where: { caseId: c.id }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, avatarUrl: true } } } });
  return ok(list);
});

/** Internal note (staff only) or public update (also emailed to the reporter). */
export const POST = withAuth(async (req, { params, user }) => {
  const scope = await caseScope(user);
  const c = await prisma.case.findFirst({ where: { id: params.id, orgId: user.orgId, ...scope } });
  if (!c) throw notFound();
  const { body, isInternal } = await parseBody(req, caseCommentSchema);
  const comment = await prisma.caseComment.create({ data: { caseId: c.id, userId: user.id, authorName: user.name, body, isInternal: !!isInternal }, include: { user: { select: { id: true, name: true, avatarUrl: true } } } });
  await prisma.case.update({ where: { id: c.id }, data: { lastActivityAt: new Date() } });
  const audience = [c.assigneeId, c.reporterUserId].filter((x): x is string => !!x && x !== user.id);
  if (audience.length) await notify(c.orgId, isInternal ? audience.filter((a) => a !== c.reporterUserId) : audience, { title: `${isInternal ? "Note" : "Update"} on ${c.referenceNo}`, body: body.slice(0, 200), link: `/app/cases?open=${c.id}`, type: "COMMENT" });
  if (!isInternal && c.reporterEmail) void sendCaseUpdateEmail({ email: c.reporterEmail, name: c.reporterName, orgId: c.orgId }, c, "status", body);
  await audit(c.orgId, user.id, isInternal ? "case.note" : "case.reply", "Case", c.id, {});
  return ok(comment, { status: 201 });
});
