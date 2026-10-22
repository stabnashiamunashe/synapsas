import { ApiError, ok, parseBody, withAuth } from "@/lib/api";
import { checkoutSchema } from "@/lib/validators";
import { startCheckout } from "@/lib/billing";
import { parseJson } from "@/lib/json";

/** Owner starts a subscription purchase: returns a checkout URL (Stripe / Paynow web), or instructions (mobile money / bank transfer). */
export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, checkoutSchema);
  const appUrl = process.env.APP_URL || new URL(req.url).origin;
  try {
    const { invoice, checkoutUrl, instructions } = await startCheckout({ orgId: user.orgId, userId: user.id, plan: body.plan, cycle: body.cycle, method: body.method, phone: body.phone, appUrl });
    return ok({ invoice: { ...invoice, meta: parseJson(invoice.meta, {}) }, checkoutUrl, instructions });
  } catch (e) {
    throw new ApiError(400, (e as Error).message);
  }
}, "OWNER");
