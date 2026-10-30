import { forbidden, getQuery, ok, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { advanceBalance } from "@/lib/advances";

/** Outstanding advances for an officer (own, or any officer for managers and above). Shown on T&S forms for Finance. */
export const GET = withAuth(async (req, { user }) => {
  const userId = getQuery(req).get("userId") || user.id;
  if (userId !== user.id && !hasRole(user, "MANAGER")) throw forbidden();
  return ok(await advanceBalance(user.orgId, userId));
});
