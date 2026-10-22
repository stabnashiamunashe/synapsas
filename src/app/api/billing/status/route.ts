import { prisma } from "@/lib/prisma";
import { ok, withAuth } from "@/lib/api";
import { PLANS, TRIAL_DAYS, YEARLY_MONTHS } from "@/lib/plans";
import { CURRENCY, entitlementsFor, providerReady } from "@/lib/billing";
import { parseJson } from "@/lib/json";

/** Everything the billing page needs: entitlements, usage, provider, open invoice, plans. */
export const GET = withAuth(async (_req, { user }) => {
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  if (!org) return ok(null);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [users, templates, requestsThisMonth, storage, openInvoice] = await Promise.all([
    prisma.user.count({ where: { orgId: org.id, isActive: true } }),
    prisma.workflowTemplate.count({ where: { orgId: org.id } }),
    prisma.request.count({ where: { orgId: org.id, createdAt: { gte: monthStart } } }),
    prisma.attachment.aggregate({ where: { request: { orgId: org.id } }, _sum: { size: true } }),
    prisma.invoice.findFirst({ where: { orgId: org.id, status: "PENDING" }, orderBy: { createdAt: "desc" } }),
  ]);
  const ent = entitlementsFor(org);
  const usage = { users, templates, requestsThisMonth, storageMb: Math.round(((storage._sum.size || 0) / (1024 * 1024)) * 100) / 100 };
  const over = {
    users: ent.limits.users !== -1 && users > ent.limits.users,
    templates: ent.limits.templates !== -1 && templates > ent.limits.templates,
    requests: ent.limits.requestsPerMonth !== -1 && requestsThisMonth >= ent.limits.requestsPerMonth,
  };
  return ok({
    entitlements: ent,
    subscription: {
      plan: org.plan, status: org.planStatus, cycle: org.billingCycle, renewsAt: org.planRenewsAt, trialEndsAt: org.trialEndsAt, graceEndsAt: org.graceEndsAt,
      cancelAtPeriodEnd: org.cancelAtPeriodEnd, provider: org.billingProvider, billingEmail: org.billingEmail, hasPortal: !!org.providerCustomerId && org.billingProvider === "stripe",
    },
    usage, over,
    openInvoice: openInvoice ? { ...openInvoice, meta: parseJson(openInvoice.meta, {}) } : null,
    provider: providerReady(),
    currency: CURRENCY,
    plans: PLANS,
    pricing: { yearlyMonths: YEARLY_MONTHS, trialDays: TRIAL_DAYS },
  });
});
