import { createHmac } from "crypto";
import { prisma } from "./prisma";
import { parseJson, toJson } from "./json";
import { sendNotificationEmail } from "./emails";
import type { NotificationPrefs, OrgSettings } from "./types";

type NotifyPayload = { title: string; body?: string; link?: string; type?: string };

/** Map a notification type to the user preference that controls it. */
function allowedByPrefs(type: string, prefs: NotificationPrefs) {
  if (type === "APPROVAL") return prefs.approvalsInApp !== false;
  if (type === "COMMENT") return prefs.commentsInApp !== false;
  if (["SUCCESS", "ERROR", "WARNING", "STATUS"].includes(type)) return prefs.statusInApp !== false;
  return true;
}

/** Immediate email for this event? Off when the user chose a digest or disabled that category. */
function emailAllowed(type: string, prefs: NotificationPrefs) {
  if (prefs.emailDigest && prefs.emailDigest !== "none") return false;
  if (type === "APPROVAL") return prefs.approvalsEmail !== false;
  if (type === "COMMENT") return prefs.commentsEmail !== false;
  if (["SUCCESS", "ERROR", "WARNING", "STATUS"].includes(type)) return prefs.statusEmail !== false;
  return true;
}

export async function notify(orgId: string, userIds: string[], payload: NotifyPayload) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return;
  const type = payload.type || "INFO";
  const [users, org] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, prefs: true, email: true, name: true } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } }),
  ]);
  const recipients = users.filter((u) => allowedByPrefs(type, parseJson<NotificationPrefs>(u.prefs, {})));
  if (!recipients.length) return;
  await prisma.notification.createMany({
    data: recipients.map((u) => ({ orgId, userId: u.id, title: payload.title, body: payload.body, link: payload.link, type })),
  });
  const orgEmails = parseJson<OrgSettings>(org?.settings || "{}", {}).emailNotifications !== false;
  if (!orgEmails) return;
  await Promise.all(
    recipients
      .filter((u) => emailAllowed(type, parseJson<NotificationPrefs>(u.prefs, {})))
      .map((u) => sendNotificationEmail({ email: u.email, name: u.name, orgId }, payload).catch((e) => console.error("[notify] email failed", e))),
  );
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

/** Block webhook targets that point into private networks (SSRF, ASVS 12.6.1). */
export function isSafeWebhookUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && process.env.NODE_ENV !== "production")) return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    if (host === "::1" || host.startsWith("[::1]") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
    return true;
  } catch {
    return false;
  }
}

/** Fire-and-forget webhook dispatch with HMAC-SHA256 signature + timestamp headers (replay-resistant). */
export async function dispatchWebhooks(orgId: string, event: WebhookEvent, data: unknown) {
  const hooks = await prisma.webhook.findMany({ where: { orgId, isActive: true } });
  const sentAt = new Date().toISOString();
  const body = JSON.stringify({ event, data, sentAt });
  const ts = String(Math.floor(Date.now() / 1000));
  await Promise.all(
    hooks
      .filter((h) => {
        const events = parseJson<string[]>(h.events, []);
        return (events.length === 0 || events.includes(event) || events.includes("*")) && isSafeWebhookUrl(h.url);
      })
      .map(async (h) => {
        const sig = createHmac("sha256", h.secret).update(`${ts}.${body}`).digest("hex");
        const legacy = createHmac("sha256", h.secret).update(body).digest("hex");
        try {
          const res = await fetch(h.url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "user-agent": "ZimStat-Approvals-Webhooks/1.0",
              "x-webhook-event": event,
              "x-webhook-timestamp": ts,
              "x-webhook-signature": `t=${ts},v1=${sig}`,
              "x-webhook-signature-legacy": legacy,
            },
            body,
            redirect: "manual",
            signal: AbortSignal.timeout(5000),
          });
          await prisma.webhook.update({ where: { id: h.id }, data: { lastStatus: res.status, lastFiredAt: new Date() } });
        } catch {
          await prisma.webhook.update({ where: { id: h.id }, data: { lastStatus: 0, lastFiredAt: new Date() } });
        }
      }),
  );
}
