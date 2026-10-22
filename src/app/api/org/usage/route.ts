import { prisma } from "@/lib/prisma";
import { ok, withAuth } from "@/lib/api";
import { limitsFor, PLANS } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";

export const GET = withAuth(async (_req, { user }) => {
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [users, templates, requestsThisMonth, storage] = await Promise.all([
    prisma.user.count({ where: { orgId: user.orgId, isActive: true } }),
    prisma.workflowTemplate.count({ where: { orgId: user.orgId } }),
    prisma.request.count({ where: { orgId: user.orgId, createdAt: { gte: monthStart } } }),
    prisma.attachment.aggregate({ where: { request: { orgId: user.orgId } }, _sum: { size: true } }),
  ]);
  return ok({
    plan: org!.plan,
    planRenewsAt: org!.planRenewsAt,
    limits: limitsFor(effectivePlan(org!)),
    usage: {
      users,
      templates,
      requestsThisMonth,
      storageMb: Math.round(((storage._sum.size || 0) / (1024 * 1024)) * 100) / 100,
    },
    plans: PLANS,
  });
});
