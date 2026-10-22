import { prisma } from "@/lib/prisma";
import { ApiError, ok, withAuth } from "@/lib/api";
import * as stripe from "@/lib/billing/stripe";

/** Stripe customer portal (update card, download receipts). Only for Stripe-billed workspaces. */
export const POST = withAuth(async (req, { user }) => {
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  if (!org?.providerCustomerId || org.billingProvider !== "stripe") throw new ApiError(400, "No card-billing customer on file");
  const appUrl = process.env.APP_URL || new URL(req.url).origin;
  return ok({ url: await stripe.portalUrl(org.providerCustomerId, appUrl) });
}, "OWNER");
