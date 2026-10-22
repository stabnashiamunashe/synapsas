// Billing core: entitlements (what a workspace may do right now), invoices, provider dispatch, lifecycle transitions.
import { prisma } from "../prisma";
import { GRACE_DAYS, PLANS, TRIAL_DAYS, TRIAL_PLAN, YEARLY_MONTHS, limitsFor, type PlanLimits } from "../plans";
import type { Plan } from "../types";
import { audit, notify } from "../notify";
import { toJson } from "../json";
import * as stripe from "./stripe";
import * as paynow from "./paynow";

export type BillingProvider = "stripe" | "paynow" | "manual";
export type PlanStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | "FREE";
export type Cycle = "monthly" | "yearly";

export const CURRENCY = process.env.BILLING_CURRENCY || "USD";

export function providerName(): BillingProvider {
  const p = (process.env.BILLING_PROVIDER || "manual").toLowerCase();
  return p === "stripe" || p === "paynow" ? p : "manual";
}

export function providerReady(): { provider: BillingProvider; ready: boolean; reason?: string } {
  const provider = providerName();
  if (provider === "stripe") return { provider, ready: stripe.configured(), reason: stripe.configured() ? undefined : "Stripe keys are not configured" };
  if (provider === "paynow") return { provider, ready: paynow.configured(), reason: paynow.configured() ? undefined : "Paynow integration keys are not configured" };
  return { provider, ready: true };
}

export type OrgBilling = {
  plan: string; planStatus: string; trialEndsAt: Date | null; planRenewsAt: Date | null; graceEndsAt: Date | null; cancelAtPeriodEnd?: boolean;
};

export interface Entitlements {
  /** the plan whose limits apply right now */
  plan: Plan;
  /** the plan the workspace subscribed to / is trialing (may differ while locked) */
  subscribedPlan: Plan;
  status: PlanStatus;
  /** true when the workspace is read-only until payment */
  locked: boolean;
  trialDaysLeft: number | null;
  graceDaysLeft: number | null;
  renewsAt: Date | null;
  limits: PlanLimits;
  banner: { level: "info" | "warning" | "error"; text: string } | null;
}

const days = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 86400000);

/** Pure function: derive what the workspace may do from its stored billing state. */
export function entitlementsFor(org: OrgBilling): Entitlements {
  const now = new Date();
  const subscribed = (org.plan in PLANS ? org.plan : "FREE") as Plan;
  const status = (org.planStatus || "FREE") as PlanStatus;
  const base = { subscribedPlan: subscribed, renewsAt: org.planRenewsAt, trialDaysLeft: null as number | null, graceDaysLeft: null as number | null, locked: false, banner: null as Entitlements["banner"] };

  if (status === "TRIALING") {
    if (org.trialEndsAt && org.trialEndsAt > now) {
      const left = days(org.trialEndsAt);
      return { ...base, plan: subscribed, status, trialDaysLeft: left, limits: limitsFor(subscribed), banner: left <= 5 ? { level: "warning", text: `Your ${PLANS[subscribed].name} trial ends in ${left} day${left === 1 ? "" : "s"}. Choose a plan to keep your team, workflows and history.` } : null };
    }
    // Trial over and never paid: FREE limits, not locked.
    return { ...base, plan: "FREE", status: "EXPIRED", limits: limitsFor("FREE"), banner: { level: "warning", text: "Your trial has ended. You are on the Free plan; anything above its limits is paused until you subscribe." } };
  }
  if (status === "ACTIVE") {
    const b = org.cancelAtPeriodEnd && org.planRenewsAt ? { level: "info" as const, text: `Your subscription ends on ${org.planRenewsAt.toLocaleDateString()}.` } : null;
    return { ...base, plan: subscribed, status, limits: limitsFor(subscribed), banner: b };
  }
  if (status === "PAST_DUE") {
    const graceLeft = org.graceEndsAt ? days(org.graceEndsAt) : 0;
    if (org.graceEndsAt && org.graceEndsAt > now) {
      return { ...base, plan: subscribed, status, graceDaysLeft: graceLeft, limits: limitsFor(subscribed), banner: { level: "error", text: `Payment failed. Update your payment to keep access; the workspace becomes read-only in ${graceLeft} day${graceLeft === 1 ? "" : "s"}.` } };
    }
    return { ...base, plan: "FREE", status, locked: true, graceDaysLeft: 0, limits: limitsFor("FREE"), banner: { level: "error", text: "This workspace is read-only until the outstanding invoice is paid." } };
  }
  if (status === "CANCELLED" || status === "EXPIRED") {
    return { ...base, plan: "FREE", status, limits: limitsFor("FREE"), banner: { level: "warning", text: "Your subscription has ended. You are on the Free plan." } };
  }
  return { ...base, plan: "FREE", status: "FREE", limits: limitsFor("FREE"), banner: null };
}

/** Effective plan key for limit checks (drop-in for `org.plan`). */
export function effectivePlan(org: OrgBilling): Plan {
  return entitlementsFor(org).plan;
}

export const billingSelect = { plan: true, planStatus: true, trialEndsAt: true, planRenewsAt: true, graceEndsAt: true, cancelAtPeriodEnd: true } as const;

export async function orgEntitlements(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: billingSelect });
  return org ? entitlementsFor(org) : entitlementsFor({ plan: "FREE", planStatus: "FREE", trialEndsAt: null, planRenewsAt: null, graceEndsAt: null });
}

/** Start the signup trial. */
export function trialDefaults() {
  return { plan: TRIAL_PLAN, planStatus: "TRIALING", trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000) };
}

export function priceCents(plan: Plan, cycle: Cycle) {
  const monthly = PLANS[plan].priceMonthly;
  return Math.round((cycle === "yearly" ? monthly * YEARLY_MONTHS : monthly) * 100);
}

export function periodFor(cycle: Cycle, from = new Date()) {
  const end = new Date(from);
  if (cycle === "yearly") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return { periodStart: from, periodEnd: end };
}

export async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({ where: { number: { startsWith: `INV-${year}-` } } });
  return `INV-${year}-${String(count + 1).padStart(6, "0")}`;
}

/**
 * Create an invoice and a payment link for it with the configured provider.
 * Returns the invoice plus where to send the user (checkout URL or bank instructions).
 */
export async function startCheckout(opts: { orgId: string; userId: string; plan: Plan; cycle: Cycle; method?: "card" | "mobile"; phone?: string; appUrl: string }) {
  const { orgId, plan, cycle } = opts;
  if (plan === "FREE") throw new Error("Free plan needs no checkout");
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Workspace missing");
  const { provider, ready, reason } = providerReady();
  if (!ready) throw new Error(reason || "Billing is not configured");

  // Void older unpaid invoices for this org so only one checkout is open.
  await prisma.invoice.updateMany({ where: { orgId, status: "PENDING" }, data: { status: "VOID" } });

  const amountCents = priceCents(plan, cycle);
  const { periodStart, periodEnd } = periodFor(cycle);
  const number = await nextInvoiceNumber();
  const description = `${PLANS[plan].name} plan · ${cycle === "yearly" ? "12 months" : "1 month"} · ${org.name}`;
  const invoice = await prisma.invoice.create({
    data: { orgId, number, plan, cycle, amountCents, currency: CURRENCY, provider, periodStart, periodEnd, description, dueAt: new Date(Date.now() + 7 * 86400000) },
  });

  let checkoutUrl: string | null = null;
  let instructions: string | null = null;
  let pollUrl: string | null = null;
  let providerRef: string | null = null;

  if (provider === "stripe") {
    const s = await stripe.createCheckout({ invoiceNumber: number, description, amountCents, currency: CURRENCY, customerEmail: org.billingEmail || undefined, customerId: org.providerCustomerId || undefined, orgId, plan, cycle, appUrl: opts.appUrl });
    checkoutUrl = s.url; providerRef = s.id;
  } else if (provider === "paynow") {
    const p = await paynow.initiate({ reference: number, amount: amountCents / 100, description, email: org.billingEmail || "", resultUrl: `${opts.appUrl}/api/billing/paynow/result`, returnUrl: `${opts.appUrl}/app/settings/billing?invoice=${number}`, method: opts.method === "mobile" ? "mobile" : "web", phone: opts.phone });
    checkoutUrl = p.browserUrl || null; pollUrl = p.pollUrl; providerRef = p.pollUrl; instructions = p.instructions || null;
  } else {
    instructions = manualInstructions(number, amountCents);
  }

  const updated = await prisma.invoice.update({ where: { id: invoice.id }, data: { checkoutUrl, pollUrl, providerRef, meta: toJson({ instructions }) } });
  await audit(orgId, opts.userId, "billing.checkout_started", "Invoice", invoice.id, { plan, cycle, provider, amountCents });
  return { invoice: updated, checkoutUrl, instructions };
}

export function manualInstructions(invoiceNumber: string, amountCents: number) {
  const bank = process.env.BILLING_BANK_DETAILS || "Bank transfer details are not configured. Contact support.";
  return `Pay ${CURRENCY} ${(amountCents / 100).toFixed(2)} by bank transfer using reference ${invoiceNumber}. ${bank} Access is activated as soon as the payment is confirmed.`;
}

/** Mark an invoice paid and activate the subscription period it covers. Idempotent. */
export async function settleInvoice(invoiceId: string, opts: { providerRef?: string; actorId?: string | null; via: string }) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { org: true } });
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "PAID") return inv;
  const now = new Date();
  // If the org is still inside a paid period, extend from its end rather than from today.
  const from = inv.org.planStatus === "ACTIVE" && inv.org.planRenewsAt && inv.org.planRenewsAt > now ? inv.org.planRenewsAt : now;
  const { periodStart, periodEnd } = periodFor(inv.cycle as Cycle, from);
  await prisma.$transaction([
    prisma.invoice.update({ where: { id: inv.id }, data: { status: "PAID", paidAt: now, providerRef: opts.providerRef ?? inv.providerRef, periodStart, periodEnd } }),
    prisma.organization.update({
      where: { id: inv.orgId },
      data: { plan: inv.plan, planStatus: "ACTIVE", planRenewsAt: periodEnd, billingCycle: inv.cycle, graceEndsAt: null, trialEndsAt: null, cancelAtPeriodEnd: false, billingProvider: inv.provider },
    }),
  ]);
  await audit(inv.orgId, opts.actorId ?? null, "billing.invoice_paid", "Invoice", inv.id, { number: inv.number, plan: inv.plan, via: opts.via });
  const owners = await prisma.user.findMany({ where: { orgId: inv.orgId, role: { in: ["OWNER", "ADMIN"] }, isActive: true }, select: { id: true } });
  await notify(inv.orgId, owners.map((o) => o.id), { title: `Payment received · ${inv.number}`, body: `${PLANS[inv.plan as Plan].name} plan active until ${periodEnd.toLocaleDateString()}.`, link: "/app/settings/billing", type: "SUCCESS" });
  return prisma.invoice.findUnique({ where: { id: inv.id } });
}

export async function failInvoice(invoiceId: string, reason: string) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv || inv.status === "PAID") return;
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: "FAILED", meta: toJson({ reason }) } });
  await audit(inv.orgId, null, "billing.payment_failed", "Invoice", inv.id, { reason });
}

/** Cancel at period end (keeps access until then). */
export async function cancelSubscription(orgId: string, actorId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Workspace missing");
  if (org.billingProvider === "stripe" && org.providerSubscriptionId) await stripe.cancelAtPeriodEnd(org.providerSubscriptionId);
  await prisma.organization.update({ where: { id: orgId }, data: { cancelAtPeriodEnd: true } });
  await audit(orgId, actorId, "billing.cancel_scheduled", "Organization", orgId, { at: org.planRenewsAt });
}

/**
 * Lifecycle sweep (run from the billing cron):
 * - trials past their end → EXPIRED (Free limits)
 * - ACTIVE periods that ended → PAST_DUE with a grace window (or CANCELLED if cancellation was scheduled)
 * - PAST_DUE past grace → stays PAST_DUE but entitlements lock the workspace (read-only)
 * - pending Paynow invoices are polled
 */
export async function billingSweep() {
  const now = new Date();
  const out = { trialsExpired: 0, pastDue: 0, cancelled: 0, polled: 0, paid: 0 };

  const trials = await prisma.organization.findMany({ where: { planStatus: "TRIALING", trialEndsAt: { lt: now } }, select: { id: true } });
  for (const o of trials) {
    await prisma.organization.update({ where: { id: o.id }, data: { planStatus: "EXPIRED" } });
    const owners = await prisma.user.findMany({ where: { orgId: o.id, role: "OWNER" }, select: { id: true } });
    await notify(o.id, owners.map((u) => u.id), { title: "Your trial has ended", body: "Choose a plan to keep everything above the Free limits.", link: "/app/settings/billing", type: "WARNING" });
    await audit(o.id, null, "billing.trial_expired", "Organization", o.id);
    out.trialsExpired++;
  }

  const lapsed = await prisma.organization.findMany({ where: { planStatus: "ACTIVE", planRenewsAt: { lt: now } } });
  for (const o of lapsed) {
    if (o.cancelAtPeriodEnd) {
      await prisma.organization.update({ where: { id: o.id }, data: { planStatus: "CANCELLED", cancelAtPeriodEnd: false } });
      await audit(o.id, null, "billing.cancelled", "Organization", o.id);
      out.cancelled++;
      continue;
    }
    // Stripe renews subscriptions itself and tells us via webhook; only non-Stripe orgs need a renewal invoice here.
    await prisma.organization.update({ where: { id: o.id }, data: { planStatus: "PAST_DUE", graceEndsAt: new Date(now.getTime() + GRACE_DAYS * 86400000) } });
    if (o.billingProvider !== "stripe") {
      const open = await prisma.invoice.findFirst({ where: { orgId: o.id, status: "PENDING" } });
      if (!open) {
        const number = await nextInvoiceNumber();
        const cycle = (o.billingCycle as Cycle) || "monthly";
        const { periodStart, periodEnd } = periodFor(cycle, o.planRenewsAt || now);
        await prisma.invoice.create({
          data: { orgId: o.id, number, plan: o.plan, cycle, amountCents: priceCents(o.plan as Plan, cycle), currency: CURRENCY, provider: (o.billingProvider as BillingProvider) || providerName(), periodStart, periodEnd, description: `${PLANS[o.plan as Plan].name} plan renewal`, dueAt: new Date(now.getTime() + GRACE_DAYS * 86400000), meta: toJson({ instructions: manualInstructions(number, priceCents(o.plan as Plan, cycle)) }) },
        });
      }
    }
    const owners = await prisma.user.findMany({ where: { orgId: o.id, role: { in: ["OWNER", "ADMIN"] } }, select: { id: true } });
    await notify(o.id, owners.map((u) => u.id), { title: "Subscription renewal due", body: `Pay within ${GRACE_DAYS} days to avoid the workspace becoming read-only.`, link: "/app/settings/billing", type: "ERROR" });
    await audit(o.id, null, "billing.past_due", "Organization", o.id);
    out.pastDue++;
  }

  if (providerName() === "paynow") {
    const pending = await prisma.invoice.findMany({ where: { provider: "paynow", status: "PENDING", pollUrl: { not: null } } });
    for (const inv of pending) {
      out.polled++;
      const st = await paynow.poll(inv.pollUrl!).catch(() => null);
      if (st?.paid) { await settleInvoice(inv.id, { providerRef: st.reference, via: "paynow-poll" }); out.paid++; }
      else if (st?.failed) await failInvoice(inv.id, st.status);
    }
  }
  return out;
}
