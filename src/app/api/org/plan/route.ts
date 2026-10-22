import { ApiError, withAuth } from "@/lib/api";

/** Plan changes go through checkout now; this endpoint only exists so old clients get a clear message. */
export const POST = withAuth(async () => {
  throw new ApiError(410, "Plan changes are made through Settings → Plan & billing (POST /api/billing/checkout).");
}, "OWNER");
