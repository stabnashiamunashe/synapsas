// Stripe adapter: one-off Checkout per invoice (card), optional recurring subscription via price IDs, webhooks.
// Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, optional STRIPE_PRICE_<PLAN>_<MONTHLY|YEARLY> for true subscriptions.
import Stripe from "stripe";

let client: Stripe | null = null;
export function configured() {
  return !!process.env.STRIPE_SECRET_KEY;
}
function sdk() {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion });
  return client;
}

function priceIdFor(plan: string, cycle: string) {
  return process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`] || null;
}

export async function createCheckout(o: {
  invoiceNumber: string; description: string; amountCents: number; currency: string; customerEmail?: string; customerId?: string;
  orgId: string; plan: string; cycle: string; appUrl: string;
}) {
  const s = sdk();
  const priceId = priceIdFor(o.plan, o.cycle);
  const session = await s.checkout.sessions.create({
    mode: priceId ? "subscription" : "payment",
    ...(o.customerId ? { customer: o.customerId } : { customer_email: o.customerEmail }),
    client_reference_id: o.invoiceNumber,
    metadata: { orgId: o.orgId, plan: o.plan, cycle: o.cycle, invoiceNumber: o.invoiceNumber },
    line_items: priceId
      ? [{ price: priceId, quantity: 1 }]
      : [{ quantity: 1, price_data: { currency: o.currency.toLowerCase(), unit_amount: o.amountCents, product_data: { name: o.description } } }],
    ...(priceId ? { subscription_data: { metadata: { orgId: o.orgId, plan: o.plan, cycle: o.cycle } } } : {}),
    success_url: `${o.appUrl}/app/settings/billing?paid=1&invoice=${o.invoiceNumber}`,
    cancel_url: `${o.appUrl}/app/settings/billing?cancelled=1`,
    allow_promotion_codes: true,
  });
  return { id: session.id, url: session.url || "" };
}

export async function portalUrl(customerId: string, appUrl: string) {
  const s = sdk();
  const p = await s.billingPortal.sessions.create({ customer: customerId, return_url: `${appUrl}/app/settings/billing` });
  return p.url;
}

export async function cancelAtPeriodEnd(subscriptionId: string) {
  await sdk().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

/** Parse and verify a webhook payload. */
export function parseEvent(rawBody: string, signature: string) {
  return sdk().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET || "");
}
