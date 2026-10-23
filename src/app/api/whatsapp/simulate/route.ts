import { z } from "zod";
import { ok, parseBody, withAuth } from "@/lib/api";
import { logMessage, normalizePhone } from "@/lib/whatsapp/client";
import { handleInbound, type Inbound } from "@/lib/whatsapp/bot";

const schema = z.object({
  phone: z.string().min(6).max(20),
  name: z.string().max(80).optional(),
  input: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("text"), text: z.string().min(1).max(4000) }),
    z.object({ kind: z.literal("button"), id: z.string(), title: z.string().optional() }),
    z.object({ kind: z.literal("list"), id: z.string(), title: z.string().optional() }),
    z.object({ kind: z.literal("location"), latitude: z.number(), longitude: z.number(), name: z.string().optional(), address: z.string().optional() }),
  ]),
});

/** In-app sandbox: runs the real conversation engine without calling Meta. Replies are returned as structured messages. */
export const POST = withAuth(async (req, { user }) => {
  const { phone, name, input } = await parseBody(req, schema);
  const p = normalizePhone(phone);
  await logMessage({ orgId: user.orgId, phone: p, direction: "IN", kind: `sim-${input.kind}`, body: input.kind === "text" ? input.text : input.kind === "location" ? `location ${input.latitude},${input.longitude}` : `[${input.title || input.id}]`, status: "simulated" });
  const replies = await handleInbound(user.orgId, p, name || "Sandbox user", input as Inbound, { simulate: true });
  return ok({ replies });
}, "ADMIN");
