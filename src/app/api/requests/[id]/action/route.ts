import { ok, parseBody, withAuth } from "@/lib/api";
import { actionSchema } from "@/lib/validators";
import { actOnRequest } from "@/lib/engine";
import { hydrate } from "@/lib/json";

export const POST = withAuth(async (req, { params, user }) => {
  const body = await parseBody(req, actionSchema);
  const r = await actOnRequest(params.id, user.orgId, user.id, body.action, body.comment, body.delegateToId);
  return ok(hydrate(r!, ["data", "activeLevels", "templateSnapshot"]));
});
