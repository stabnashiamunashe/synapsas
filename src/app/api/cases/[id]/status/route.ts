import { prisma } from "@/lib/prisma";
import { notFound, ok, parseBody, withAuth } from "@/lib/api";
import { caseStatusChangeSchema } from "@/lib/validators";
import { clientInfo } from "@/lib/security";
import { caseInclude, caseScope, changeCaseStatus, serializeCase } from "@/lib/cases";

/** Move a case between columns. Body: { status, version, reason? }. 409 when the version is stale. */
export const POST = withAuth(async (req, { params, user }) => {
  const scope = await caseScope(user);
  const exists = await prisma.case.findFirst({ where: { id: params.id, orgId: user.orgId, ...scope }, select: { id: true } });
  if (!exists) throw notFound();
  const { status, version, reason } = await parseBody(req, caseStatusChangeSchema);
  await changeCaseStatus(user.orgId, params.id, status, version, user, reason, clientInfo(req));
  const full = await prisma.case.findUnique({ where: { id: params.id }, include: caseInclude });
  return ok(serializeCase(full!));
});
