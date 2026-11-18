import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/roles";
import { audit } from "@/lib/notify";
import { maskPhone } from "@/lib/whatsapp/desk";
import { inSessionWindow, sendWhatsApp, waConfig } from "@/lib/whatsapp/client";
import { topicLabel } from "@/lib/whatsapp/i18n";

async function session(id: string, orgId: string) {
  const s = await prisma.whatsAppSession.findFirst({ where: { id, orgId } });
  if (!s) throw notFound("Conversation not found");
  return s;
}

/** One conversation: the transcript, the cases this number lodged, its alert subscription and the data it was given. */
export const GET = withAuth(async (_req, { params, user }) => {
  const s = await session(params.id, user.orgId);
  const tail = s.phone.slice(-9);
  const [messages, cases, subscription, handedOut] = await Promise.all([
    prisma.whatsAppMessage.findMany({ where: { phone: s.phone }, orderBy: { createdAt: "asc" }, take: 400, select: { id: true, direction: true, kind: true, body: true, status: true, error: true, caseId: true, createdAt: true } }),
    prisma.case.findMany({ where: { orgId: user.orgId, reporterPhone: { endsWith: tail } }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, referenceNo: true, title: true, status: true, createdAt: true, customFields: true } }),
    prisma.statSubscription.findUnique({ where: { orgId_phone: { orgId: user.orgId, phone: s.phone } } }),
    prisma.chatbotDataLog.findMany({ where: { orgId: user.orgId, phone: s.phone }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return ok({
    id: s.id, phone: maskPhone(s.phone), phoneFull: hasRole(user, "ADMIN") ? `+${s.phone}` : null, profileName: s.profileName, step: s.step, lastInteractionAt: s.lastInteractionAt, createdAt: s.createdAt,
    inWindow: await inSessionWindow(s.phone), configured: waConfig().configured,
    messages, cases: cases.map((c) => ({ ...c, liveChat: c.customFields.includes('"liveChat":true'), customFields: undefined })),
    subscription: subscription ? { topics: JSON.parse(subscription.topics || "[]").map((k: string) => topicLabel(k, "en")), frequency: subscription.frequency, isActive: subscription.isActive, createdAt: subscription.createdAt } : null,
    handedOut: handedOut.map((h) => ({ ...h, topicName: h.topic ? topicLabel(h.topic, "en") : null })),
  });
}, "MANAGER");

/** Send a plain message to this number (allowed inside the 24-hour window; otherwise Meta needs a template). */
export const POST = withAuth(async (req, { params, user }) => {
  const s = await session(params.id, user.orgId);
  const { text } = await parseBody(req, z.object({ text: z.string().min(1).max(4000) }));
  if (waConfig().configured && !(await inSessionWindow(s.phone))) throw badRequest("This person last wrote more than 24 hours ago; WhatsApp only allows approved templates now. Wait for their next message.");
  const sent = await sendWhatsApp(s.phone, { type: "text", text: text.trim() }, { orgId: user.orgId });
  await audit(user.orgId, user.id, "whatsapp.desk_message", "Organization", user.orgId, { to: maskPhone(s.phone), sent });
  return ok({ sent });
}, "MANAGER");
