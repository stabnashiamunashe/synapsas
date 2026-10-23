import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logMessage, normalizePhone, recordStatus, verifyWebhookSignature, waConfig } from "@/lib/whatsapp/client";
import { handleInbound, type Inbound } from "@/lib/whatsapp/bot";
import { rateLimit } from "@/lib/security";

/** Meta webhook verification handshake. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const cfg = waConfig();
  if (q.get("hub.mode") === "subscribe" && cfg.verifyToken && q.get("hub.verify_token") === cfg.verifyToken) {
    return new Response(q.get("hub.challenge") || "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

type WaWebhook = {
  entry?: { changes?: { value?: {
    metadata?: { phone_number_id?: string };
    contacts?: { wa_id: string; profile?: { name?: string } }[];
    messages?: { id: string; from: string; type: string; timestamp?: string; text?: { body: string }; interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } }; button?: { payload?: string; text?: string }; location?: { latitude: number; longitude: number; name?: string; address?: string } }[];
    statuses?: { id: string; status: string; errors?: { title?: string; message?: string }[] }[];
  } }[] }[];
};

/**
 * Inbound messages and delivery statuses. Always answers 200 quickly (Meta retries otherwise) and never lets a
 * processing error escape. Signature is checked with the app secret; duplicate deliveries are ignored by message id.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });
  let payload: WaWebhook;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  const cfg = waConfig();
  try {
    const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!org) return NextResponse.json({ ok: true });
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const v = change.value;
        if (!v) continue;
        if (cfg.phoneNumberId && v.metadata?.phone_number_id && v.metadata.phone_number_id !== cfg.phoneNumberId) continue;
        for (const s of v.statuses || []) await recordStatus(s.id, s.status, s.errors?.[0]?.message);
        for (const m of v.messages || []) {
          const phone = normalizePhone(m.from);
          if (!rateLimit(`wa:${phone}`, 40, 10 * 60_000).ok) continue;
          const dup = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: m.id }, select: { id: true } });
          if (dup) continue;
          const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name || null;
          const input = toInbound(m);
          await logMessage({ orgId: org.id, phone, direction: "IN", kind: m.type, body: inboundText(m, input), status: "received", waMessageId: m.id });
          await handleInbound(org.id, phone, name, input);
        }
      }
    }
  } catch (e) {
    console.error("[whatsapp] webhook error", e);
  }
  return NextResponse.json({ ok: true });
}

type M = NonNullable<NonNullable<NonNullable<NonNullable<WaWebhook["entry"]>[number]["changes"]>[number]["value"]>["messages"]>[number];
function toInbound(m: M): Inbound {
  if (m.type === "text" && m.text) return { kind: "text", text: m.text.body };
  if (m.type === "interactive" && m.interactive?.button_reply) return { kind: "button", id: m.interactive.button_reply.id, title: m.interactive.button_reply.title };
  if (m.type === "interactive" && m.interactive?.list_reply) return { kind: "list", id: m.interactive.list_reply.id, title: m.interactive.list_reply.title };
  if (m.type === "button" && m.button) return { kind: "button", id: m.button.payload || m.button.text || "", title: m.button.text };
  if (m.type === "location" && m.location) return { kind: "location", latitude: m.location.latitude, longitude: m.location.longitude, name: m.location.name, address: m.location.address };
  return { kind: "other" };
}
function inboundText(m: M, i: Inbound) {
  if (i.kind === "text") return i.text;
  if (i.kind === "button" || i.kind === "list") return `[${i.title || i.id}]`;
  if (i.kind === "location") return `location ${i.latitude},${i.longitude}${i.address ? ` ${i.address}` : ""}`;
  return `(${m.type})`;
}
