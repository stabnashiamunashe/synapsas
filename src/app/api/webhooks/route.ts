import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, parseBody, withAuth } from "@/lib/api";
import { webhookSchema } from "@/lib/validators";
import { limitsFor } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import { audit, isSafeWebhookUrl } from "@/lib/notify";
import { hydrate, toJson } from "@/lib/json";

const mask = (secret: string) => `${secret.slice(0, 10)}…${secret.slice(-4)}`;

/** Secrets are shown once at creation; listings only carry a masked hint. */
export const GET = withAuth(async (_req, { user }) => {
  const hooks = await prisma.webhook.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: "desc" } });
  return ok(hooks.map((h) => ({ ...hydrate(h, ["events"]), secret: undefined, secretHint: mask(h.secret) })));
}, "ADMIN");

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, webhookSchema);
  if (!isSafeWebhookUrl(body.url)) throw badRequest("Webhook URL must be a public https:// address");
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  if (!limitsFor(effectivePlan(org!)).webhooks) throw badRequest("Webhooks require the Business plan or higher");
  const hook = await prisma.webhook.create({
    data: { orgId: user.orgId, url: body.url, events: toJson(body.events), secret: `whsec_${nanoid(40)}`, isActive: body.isActive ?? true },
  });
  await audit(user.orgId, user.id, "webhook.created", "Webhook", hook.id, { url: body.url });
  return ok({ ...hydrate(hook, ["events"]), secretHint: mask(hook.secret) }, { status: 201 });
}, "ADMIN");
