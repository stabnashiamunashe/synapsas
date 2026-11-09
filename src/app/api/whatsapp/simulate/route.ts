import { z } from "zod";
import { ok, parseBody, withAuth } from "@/lib/api";
import { clipForWhatsApp, logMessage, normalizePhone } from "@/lib/whatsapp/client";
import { handleInbound, type Inbound } from "@/lib/whatsapp/bot";
import { documentUrl } from "@/lib/whatsapp/documents";

const schema = z.object({
  phone: z.string().min(6).max(20),
  name: z.string().max(80).optional(),
  input: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("text"), text: z.string().min(1).max(4000) }),
    z.object({ kind: z.literal("button"), id: z.string(), title: z.string().optional() }),
    z.object({ kind: z.literal("list"), id: z.string(), title: z.string().optional() }),
    z.object({ kind: z.literal("location"), latitude: z.number(), longitude: z.number(), name: z.string().optional(), address: z.string().optional() }),
    z.object({ kind: z.literal("media"), fileName: z.string().min(1).max(200), mimeType: z.string().max(100).default("application/pdf"), caption: z.string().max(500).optional() }),
  ]),
});

/** In-app sandbox: runs the real conversation engine without calling Meta. Replies are returned as structured messages. Sandbox attachments are noted on the case but not stored. */
export const POST = withAuth(async (req, { user }) => {
  const { phone, name, input } = await parseBody(req, schema);
  const p = normalizePhone(phone);
  const shown = input.kind === "text" ? input.text : input.kind === "location" ? `location ${input.latitude},${input.longitude}` : input.kind === "media" ? `[file: ${input.fileName}]` : `[${input.title || input.id}]`;
  await logMessage({ orgId: user.orgId, phone: p, direction: "IN", kind: `sim-${input.kind}`, body: shown, status: "simulated" });
  const inbound: Inbound = input.kind === "media" ? { kind: "media", mediaId: `sandbox-${Date.now()}`, mimeType: input.mimeType, fileName: input.fileName, caption: input.caption } : (input as Inbound);
  const replies = await handleInbound(user.orgId, p, name || "Sandbox user", inbound, { simulate: true });
  // documents are not uploaded to Meta in the sandbox; link to the in-app route that serves the same bytes
  return ok({ replies: replies.map(clipForWhatsApp).map((r) => (r.type === "document" && r.source ? { ...r, source: undefined, fallback: undefined, url: documentUrl(r.source) } : r)) });
}, "ADMIN");
