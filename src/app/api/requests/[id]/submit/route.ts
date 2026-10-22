import { ok, withAuth } from "@/lib/api";
import { submitRequest, loadRequest } from "@/lib/engine";
import { hydrate } from "@/lib/json";

export const POST = withAuth(async (_req, { params, user }) => {
  await submitRequest(params.id, user.orgId, user.id);
  const r = await loadRequest(params.id, user.orgId);
  return ok(hydrate(r!, ["data", "activeLevels", "templateSnapshot"]));
});
