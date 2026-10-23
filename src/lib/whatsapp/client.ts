// Meta WhatsApp Business Cloud API client. Every call is best-effort: failures are logged to WhatsAppMessage and
// swallowed, so a missing token, an expired token or a Meta outage never breaks case handling.
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "../prisma";

export interface WaConfig {
  configured: boolean;
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  apiVersion: string;
  templates: { caseCreated: string; caseUpdate: string; language: string };
}

export function waConfig(): WaConfig {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  return {
    configured: !!accessToken && !!phoneNumberId,
    phoneNumberId,
    accessToken,
    appSecret: process.env.WHATSAPP_APP_SECRET || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
    templates: {
      caseCreated: process.env.WHATSAPP_TEMPLATE_CASE_CREATED || "",
      caseUpdate: process.env.WHATSAPP_TEMPLATE_CASE_UPDATE || "",
      language: process.env.WHATSAPP_TEMPLATE_LANG || "en",
    },
  };
}

/** Meta signs webhook bodies with HMAC-SHA256 of the raw body using the app secret. */
export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const { appSecret } = waConfig();
  if (!appSecret) return process.env.NODE_ENV !== "production"; // in dev, allow unsigned (simulator, tunnels)
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice(7);
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** E.164 digits only (Meta's wa_id format). */
export const normalizePhone = (p: string) => p.replace(/[^\d]/g, "");

// ---------- message shapes (subset of the Cloud API) ----------
export type WaButton = { id: string; title: string };
export type WaListRow = { id: string; title: string; description?: string };
export type WaOutgoing =
  | { type: "text"; text: string }
  | { type: "buttons"; body: string; buttons: WaButton[]; header?: string; footer?: string }
  | { type: "list"; body: string; button: string; sections: { title?: string; rows: WaListRow[] }[]; header?: string; footer?: string }
  | { type: "location_request"; body: string }
  | { type: "template"; name: string; language: string; bodyParams: string[]; urlButtonParam?: string };

/** Serialise to the Graph API payload. Titles are clipped to WhatsApp's limits (buttons 20 chars, rows 24/72). */
export function toPayload(to: string, m: WaOutgoing): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };
  switch (m.type) {
    case "text":
      return { ...base, type: "text", text: { preview_url: false, body: m.text.slice(0, 4096) } };
    case "buttons":
      return {
        ...base, type: "interactive",
        interactive: {
          type: "button",
          ...(m.header ? { header: { type: "text", text: m.header.slice(0, 60) } } : {}),
          body: { text: m.body.slice(0, 1024) },
          ...(m.footer ? { footer: { text: m.footer.slice(0, 60) } } : {}),
          action: { buttons: m.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) } })) },
        },
      };
    case "list":
      return {
        ...base, type: "interactive",
        interactive: {
          type: "list",
          ...(m.header ? { header: { type: "text", text: m.header.slice(0, 60) } } : {}),
          body: { text: m.body.slice(0, 1024) },
          ...(m.footer ? { footer: { text: m.footer.slice(0, 60) } } : {}),
          action: { button: m.button.slice(0, 20), sections: m.sections.slice(0, 10).map((s) => ({ ...(s.title ? { title: s.title.slice(0, 24) } : {}), rows: s.rows.slice(0, 10).map((r) => ({ id: r.id.slice(0, 200), title: r.title.slice(0, 24), ...(r.description ? { description: r.description.slice(0, 72) } : {}) })) })) },
        },
      };
    case "location_request":
      return { ...base, type: "interactive", interactive: { type: "location_request_message", body: { text: m.body.slice(0, 1024) }, action: { name: "send_location" } } };
    case "template": {
      const components: unknown[] = [];
      if (m.bodyParams.length) components.push({ type: "body", parameters: m.bodyParams.map((t) => ({ type: "text", text: t.slice(0, 1024) })) });
      if (m.urlButtonParam) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: m.urlButtonParam }] });
      return { ...base, type: "template", template: { name: m.name, language: { code: m.language }, components } };
    }
  }
}

/** Human-readable transcript line for the log and the simulator. */
export function describe(m: WaOutgoing): string {
  switch (m.type) {
    case "text": return m.text;
    case "buttons": return `${m.header ? `*${m.header}*\n` : ""}${m.body}\n[${m.buttons.map((b) => b.title).join("] [")}]`;
    case "list": return `${m.header ? `*${m.header}*\n` : ""}${m.body}\n(${m.button}) ${m.sections.flatMap((s) => s.rows.map((r) => `• ${r.title}`)).join("  ")}`;
    case "location_request": return `${m.body}\n[Send location]`;
    case "template": return `template ${m.name}(${m.bodyParams.join(", ")})`;
  }
}

async function log(data: { orgId?: string | null; phone: string; direction: "IN" | "OUT"; kind: string; body: string; status: string; error?: string | null; waMessageId?: string | null; caseId?: string | null }) {
  try {
    await prisma.whatsAppMessage.create({ data: { orgId: data.orgId ?? null, phone: data.phone, direction: data.direction, kind: data.kind, body: data.body.slice(0, 60000), status: data.status, error: data.error ?? null, waMessageId: data.waMessageId ?? null, caseId: data.caseId ?? null } });
  } catch (e) {
    console.error("[whatsapp] log failed", e);
  }
}
export const logMessage = log;

/**
 * Send one message. Never throws. Returns true when Meta accepted it.
 * `simulate` skips the network call and records the message as "simulated" (used by the in-app sandbox).
 */
export async function sendWhatsApp(to: string, m: WaOutgoing, opts: { orgId?: string | null; caseId?: string | null; simulate?: boolean } = {}): Promise<boolean> {
  const cfg = waConfig();
  const phone = normalizePhone(to);
  const body = describe(m);
  if (opts.simulate) {
    await log({ orgId: opts.orgId, phone, direction: "OUT", kind: m.type, body, status: "simulated", caseId: opts.caseId });
    return true;
  }
  if (!cfg.configured) {
    await log({ orgId: opts.orgId, phone, direction: "OUT", kind: m.type, body, status: "skipped", error: "WhatsApp not configured", caseId: opts.caseId });
    return false;
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(toPayload(phone, m)),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (!res.ok) {
      await log({ orgId: opts.orgId, phone, direction: "OUT", kind: m.type, body, status: "failed", error: `${res.status} ${json.error?.message || ""}`.trim(), caseId: opts.caseId });
      console.error(`[whatsapp] send failed ${res.status}: ${json.error?.message}`);
      return false;
    }
    await log({ orgId: opts.orgId, phone, direction: "OUT", kind: m.type, body, status: "sent", waMessageId: json.messages?.[0]?.id || null, caseId: opts.caseId });
    return true;
  } catch (e) {
    await log({ orgId: opts.orgId, phone, direction: "OUT", kind: m.type, body, status: "failed", error: String((e as Error)?.message || e), caseId: opts.caseId });
    console.error("[whatsapp] send error", e);
    return false;
  }
}

/** Mark delivered/read from status webhooks. */
export async function recordStatus(waMessageId: string, status: string, error?: string) {
  try {
    await prisma.whatsAppMessage.updateMany({ where: { waMessageId }, data: { status, ...(error ? { error } : {}) } });
  } catch { /* ignore */ }
}
