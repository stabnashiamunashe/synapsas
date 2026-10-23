import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { webhookSchema } from "@/lib/validators";
import { audit, isSafeWebhookUrl } from "@/lib/notify";
import { hydrate, toJson } from "@/lib/json";

export const PATCH = withAuth(async (req, { params, user }) => {
  const hook = await prisma.webhook.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!hook) throw notFound();
  const body = await parseBody(req, webhookSchema.partial());
  if (body.url && !isSafeWebhookUrl(body.url)) throw badRequest("Webhook URL must be a public https:// address");
  const updated = await prisma.webhook.update({
    where: { id: hook.id },
    data: { url: body.url, isActive: body.isActive, ...(body.events ? { events: toJson(body.events) } : {}) },
  });
  await audit(user.orgId, user.id, "webhook.updated", "Webhook", hook.id);
  return ok({ ...hydrate(updated, ["events"]), secret: undefined });
}, "ADMIN");

/** Rotate the signing secret. The new secret is returned once. */
export const POST = withAuth(async (_req, { params, user }) => {
  const hook = await prisma.webhook.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!hook) throw notFound();
  const updated = await prisma.webhook.update({ where: { id: hook.id }, data: { secret: `whsec_${nanoid(40)}` } });
  await audit(user.orgId, user.id, "webhook.secret_rotated", "Webhook", hook.id);
  return ok({ id: updated.id, secret: updated.secret });
}, "ADMIN");

export const DELETE = withAuth(async (_req, { params, user }) => {
  const hook = await prisma.webhook.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!hook) throw notFound();
  await prisma.webhook.delete({ where: { id: hook.id } });
  await audit(user.orgId, user.id, "webhook.deleted", "Webhook", hook.id, { url: hook.url });
  return ok({ id: hook.id });
}, "ADMIN");
