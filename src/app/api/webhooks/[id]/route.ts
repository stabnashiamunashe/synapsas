import { prisma } from "@/lib/prisma";
import { notFound, ok, parseBody, withAuth } from "@/lib/api";
import { webhookSchema } from "@/lib/validators";
import { audit } from "@/lib/notify";
import { hydrate, toJson } from "@/lib/json";

export const PATCH = withAuth(async (req, { params, user }) => {
  const hook = await prisma.webhook.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!hook) throw notFound();
  const body = await parseBody(req, webhookSchema.partial());
  const updated = await prisma.webhook.update({
    where: { id: hook.id },
    data: { url: body.url, isActive: body.isActive, ...(body.events ? { events: toJson(body.events) } : {}) },
  });
  await audit(user.orgId, user.id, "webhook.updated", "Webhook", hook.id);
  return ok(hydrate(updated, ["events"]));
}, "ADMIN");

export const DELETE = withAuth(async (_req, { params, user }) => {
  const hook = await prisma.webhook.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!hook) throw notFound();
  await prisma.webhook.delete({ where: { id: hook.id } });
  await audit(user.orgId, user.id, "webhook.deleted", "Webhook", hook.id, { url: hook.url });
  return ok({ id: hook.id });
}, "ADMIN");
