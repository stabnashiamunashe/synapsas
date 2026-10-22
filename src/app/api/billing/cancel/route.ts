import { ApiError, ok, withAuth } from "@/lib/api";
import { cancelSubscription } from "@/lib/billing";

/** Cancel at the end of the current paid period. Access continues until then. */
export const POST = withAuth(async (_req, { user }) => {
  try {
    await cancelSubscription(user.orgId, user.id);
    return ok({ cancelAtPeriodEnd: true });
  } catch (e) {
    throw new ApiError(400, (e as Error).message);
  }
}, "OWNER");
