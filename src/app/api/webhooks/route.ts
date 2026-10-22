import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, parseBody, withAuth } from "@/lib/api";
import { webhookSchema } from "@/lib/validators";
import { limitsFor } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import { audit } from "@/lib/notify";
import { hydrate, toJson } from "@/lib/json";

export const GET = withAuth(async (_req, { user }) => {
  const hooks = await prisma.webhook.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: "desc" } });
  return ok(hooks.map((h) => hydrate(h, ["events"])));
}, "ADMIN");

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, webhookSchema);
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  if (!limitsFor(effectivePlan(org!)).webhooks) throw badRequest("Webhooks require the Business plan or higher");
  const hook = await prisma.webhook.create({
    data: { orgId: user.orgId, url: body.url, events: toJson(body.events), secret: `whsec_${nanoid(32)}`, isActive: body.isActive ?? true },
  });
  await audit(user.orgId, user.id, "webhook.created", "Webhook", hook.id, { url: body.url });
  return ok(hydrate(hook, ["events"]), { status: 201 });
}, "ADMIN");
