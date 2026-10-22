import { ok, withAuth } from "@/lib/api";
import { cancelRequest } from "@/lib/engine";
import { hydrate } from "@/lib/json";
import { hasRole } from "@/lib/auth";

export const POST = withAuth(async (_req, { params, user }) => {
  const r = await cancelRequest(params.id, user.orgId, user.id, hasRole(user, "ADMIN"));
  return ok(hydrate(r!, ["data", "activeLevels", "templateSnapshot"]));
});
