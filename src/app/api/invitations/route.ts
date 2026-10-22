import { prisma } from "@/lib/prisma";
import { ok, withAuth } from "@/lib/api";

export const GET = withAuth(async (_req, { user }) => {
  const list = await prisma.invitation.findMany({
    where: { orgId: user.orgId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const base = process.env.APP_URL || "http://localhost:3000";
  return ok(list.map((i) => ({ ...i, link: `${base}/invite/${i.token}` })));
}, "ADMIN");
