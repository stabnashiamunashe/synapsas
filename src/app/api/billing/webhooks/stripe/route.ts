import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import * as stripe from "@/lib/billing/stripe";
import { CURRENCY, failInvoice, nextInvoiceNumber, periodFor, settleInvoice, type Cycle } from "@/lib/billing";
import { audit } from "@/lib/notify";
import { GRACE_DAYS } from "@/lib/plans";
import { toJson } from "@/lib/json";

/**
 * Stripe webhook. Handles one-off checkout payments, recurring subscription invoices, failures and cancellations.
 * Register: <APP_URL>/api/billing/webhooks/stripe with events checkout.session.completed, invoice.paid,
 * invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted.
 */
export async function POST(req: Request) {
  if (!stripe.configured()) return NextResponse.json({ ok: false, error: "Stripe not configured" }, { status: 400 });
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  let event: Stripe.Event;
  try {
    event = stripe.parseEvent(raw, sig);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Invalid signature: ${(e as Error).message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const number = s.client_reference_id || s.metadata?.invoiceNumber;
        const inv = number ? await prisma.invoice.findUnique({ where: { number } }) : null;
        if (inv) {
          if (s.customer || s.subscription) {
            await prisma.organization.update({
              where: { id: inv.orgId },
              data: { providerCustomerId: typeof s.customer === "string" ? s.customer : s.customer?.id, providerSubscriptionId: typeof s.subscription === "string" ? s.subscription : s.subscription?.id || undefined, billingProvider: "stripe" },
            });
          }
          if (s.payment_status === "paid" || s.mode === "subscription") await settleInvoice(inv.id, { providerRef: s.id, via: "stripe-checkout" });
        }
        break;
      }
      case "invoice.paid": {
        // Recurring renewal: create a local invoice record for the period and activate it.
        const si = event.data.object as Stripe.Invoice;
        const customerId = typeof si.customer === "string" ? si.customer : si.customer?.id;
        const org = customerId ? await prisma.organization.findFirst({ where: { providerCustomerId: customerId } }) : null;
        if (org && si.billing_reason !== "subscription_create") {
          const cycle = (org.billingCycle as Cycle) || "monthly";
          const { periodStart, periodEnd } = periodFor(cycle, org.planRenewsAt && org.planRenewsAt > new Date() ? org.planRenewsAt : new Date());
          const local = await prisma.invoice.create({
            data: { orgId: org.id, number: await nextInvoiceNumber(), plan: org.plan, cycle, amountCents: si.amount_paid ?? 0, currency: (si.currency || CURRENCY).toUpperCase(), status: "PENDING", provider: "stripe", providerRef: si.id, periodStart, periodEnd, description: "Subscription renewal (Stripe)", meta: toJson({ stripeInvoice: si.id }) },
          });
          await settleInvoice(local.id, { providerRef: si.id, via: "stripe-renewal" });
        }
        break;
      }
      case "invoice.payment_failed": {
        const si = event.data.object as Stripe.Invoice;
        const customerId = typeof si.customer === "string" ? si.customer : si.customer?.id;
        const org = customerId ? await prisma.organization.findFirst({ where: { providerCustomerId: customerId } }) : null;
        if (org) {
          await prisma.organization.update({ where: { id: org.id }, data: { planStatus: "PAST_DUE", graceEndsAt: new Date(Date.now() + GRACE_DAYS * 86400000) } });
          const pending = await prisma.invoice.findFirst({ where: { orgId: org.id, status: "PENDING", provider: "stripe" } });
          if (pending) await failInvoice(pending.id, "card payment failed");
          await audit(org.id, null, "billing.past_due", "Organization", org.id, { via: "stripe" });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const org = await prisma.organization.findFirst({ where: { providerSubscriptionId: sub.id } });
        if (org) {
          if (event.type === "customer.subscription.deleted" || sub.status === "canceled") {
            await prisma.organization.update({ where: { id: org.id }, data: { planStatus: "CANCELLED", cancelAtPeriodEnd: false } });
            await audit(org.id, null, "billing.cancelled", "Organization", org.id, { via: "stripe" });
          } else {
            await prisma.organization.update({ where: { id: org.id }, data: { cancelAtPeriodEnd: !!sub.cancel_at_period_end } });
          }
        }
        break;
      }
    }
  } catch (e) {
    console.error("stripe webhook", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, received: event.type });
}
