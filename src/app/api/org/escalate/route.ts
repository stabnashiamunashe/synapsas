import { ok, withAuth } from "@/lib/api";
import { escalateOverdue } from "@/lib/engine";

/** Admin-triggered SLA sweep for this organisation only. */
export const POST = withAuth(async (_req, { user }) => {
  return ok(await escalateOverdue(user.orgId));
}, "ADMIN");
