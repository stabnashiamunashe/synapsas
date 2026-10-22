import { prisma } from "@/lib/prisma";
import { ok, paging, withAuth } from "@/lib/api";
import { hydrate } from "@/lib/json";
import { auditWhere } from "@/lib/auditQuery";

export const GET = withAuth(async (req, { user }) => {
  const { page, pageSize, skip, take } = paging(req, 50);
  const where = auditWhere(req, user.orgId);
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  return ok({ total, page, pageSize, items: items.map((i) => hydrate(i, ["meta"])) });
}, "ADMIN");
