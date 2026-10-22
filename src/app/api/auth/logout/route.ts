import { clearSessionCookie, getSession } from "@/lib/auth";
import { ok, withPublic } from "@/lib/api";
import { audit } from "@/lib/notify";
import { clientInfo } from "@/lib/security";

export const POST = withPublic(async (req) => {
  const s = await getSession();
  if (s) await audit(s.orgId, s.id, "auth.logout", "User", s.id, {}, clientInfo(req));
  await clearSessionCookie();
  return ok({ loggedOut: true });
});
