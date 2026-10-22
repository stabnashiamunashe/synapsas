import { createHmac } from "crypto";
import { prisma } from "./prisma";
import { parseJson, toJson } from "./json";
import type { NotificationPrefs } from "./types";

type NotifyPayload = { title: string; body?: string; link?: string; type?: string };

/** Map a notification type to the user preference that controls it. */
function allowedByPrefs(type: string, prefs: NotificationPrefs) {
  if (type === "APPROVAL") return prefs.approvalsInApp !== false;
  if (type === "COMMENT") return prefs.commentsInApp !== false;
  if (["SUCCESS", "ERROR", "WARNING", "STATUS"].includes(type)) return prefs.statusInApp !== false;
  return true;
}

export async function notify(orgId: string, userIds: string[], payload: NotifyPayload) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return;
  const type = payload.type || "INFO";
  const users = await prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, prefs: true, email: true } });
  const recipients = users.filter((u) => allowedByPrefs(type, parseJson<NotificationPrefs>(u.prefs, {})));
  if (!recipients.length) return;
  await prisma.notification.createMany({
    data: recipients.map((u) => ({ orgId, userId: u.id, title: payload.title, body: payload.body, link: payload.link, type })),
  });
  // Email delivery hook: plug in a provider (Resend, SES, SMTP) here and honour `prefs.emailDigest`.
  if (process.env.EMAIL_DEBUG === "1") console.log("[email]", recipients.map((u) => u.email), payload.title);
}

export interface AuditCtx {
  ip?: string;
  userAgent?: string;
}

export async function audit(
  orgId: string,
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  meta: Record<string, unknown> = {},
  ctx: AuditCtx = {},
) {
  await prisma.auditLog.create({
    data: {
      orgId,
      userId,
      action,
      entityType,
      entityId: entityId ?? null,
      meta: toJson(meta),
      ip: ctx.ip?.slice(0, 64) ?? null,
      userAgent: ctx.userAgent?.slice(0, 500) ?? null,
    },
  });
}

export type WebhookEvent =
  | "request.submitted"
  | "request.approved"
  | "request.rejected"
  | "request.returned"
  | "request.cancelled"
  | "request.level_advanced"
  | "request.escalated";

/** Fire-and-forget webhook dispatch with HMAC-SHA256 signature header. */
export async function dispatchWebhooks(orgId: string, event: WebhookEvent, data: unknown) {
  const hooks = await prisma.webhook.findMany({ where: { orgId, isActive: true } });
  const body = JSON.stringify({ event, data, sentAt: new Date().toISOString() });
  await Promise.all(
    hooks
      .filter((h) => {
        const events = parseJson<string[]>(h.events, []);
        return events.length === 0 || events.includes(event) || events.includes("*");
      })
      .map(async (h) => {
        const sig = createHmac("sha256", h.secret).update(body).digest("hex");
        try {
          const res = await fetch(h.url, {
            method: "POST",
            headers: { "content-type": "application/json", "x-webhook-event": event, "x-webhook-signature": sig },
            body,
            signal: AbortSignal.timeout(5000),
          });
          await prisma.webhook.update({ where: { id: h.id }, data: { lastStatus: res.status, lastFiredAt: new Date() } });
        } catch {
          await prisma.webhook.update({ where: { id: h.id }, data: { lastStatus: 0, lastFiredAt: new Date() } });
        }
      }),
  );
}
