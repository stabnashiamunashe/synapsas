import { prisma } from "@/lib/prisma";
import { notFound, ok, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";

/** "I have read and understood": records the acknowledgement once per person. */
export const POST = withAuth(async (_req, { params, user }) => {
  const n = await prisma.notice.findFirst({ where: { id: params.id, orgId: user.orgId, publishedAt: { not: null } } });
  if (!n) throw notFound();
  const ack = await prisma.noticeAck.upsert({ where: { noticeId_userId: { noticeId: n.id, userId: user.id } }, update: {}, create: { noticeId: n.id, userId: user.id } });
  await audit(user.orgId, user.id, "notice.acknowledged", "Notice", n.id, { title: n.title });
  return ok(ack);
});
