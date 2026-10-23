import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, getQuery, ok, parseBody, withAuth } from "@/lib/api";
import { sendWhatsApp, waConfig } from "@/lib/whatsapp/client";
import { audit } from "@/lib/notify";

/** Connection status, template names, webhook details and recent traffic for the settings page. */
export const GET = withAuth(async (req, { user }) => {
  const cfg = waConfig();
  const q = getQuery(req);
  const since = new Date(Date.now() - 7 * 86400_000);
  const [messages, sent, failed, sessions, cases] = await Promise.all([
    prisma.whatsAppMessage.findMany({ where: { OR: [{ orgId: user.orgId }, { orgId: null }], ...(q.get("phone") ? { phone: { endsWith: q.get("phone")!.replace(/\D/g, "").slice(-9) } } : {}) }, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.whatsAppMessage.count({ where: { orgId: user.orgId, direction: "OUT", status: { in: ["sent", "delivered", "read"] }, createdAt: { gte: since } } }),
    prisma.whatsAppMessage.count({ where: { orgId: user.orgId, direction: "OUT", status: "failed", createdAt: { gte: since } } }),
    prisma.whatsAppSession.count({ where: { orgId: user.orgId, lastInteractionAt: { gte: since } } }),
    prisma.case.count({ where: { orgId: user.orgId, source: "WHATSAPP", createdAt: { gte: since } } }),
  ]);
  const base = (process.env.APP_URL || "").replace(/\/$/, "");
  return ok({
    configured: cfg.configured,
    phoneNumberId: cfg.phoneNumberId ? `…${cfg.phoneNumberId.slice(-4)}` : null,
    tokenSet: !!cfg.accessToken, appSecretSet: !!cfg.appSecret, verifyTokenSet: !!cfg.verifyToken,
    apiVersion: cfg.apiVersion, templates: cfg.templates,
    webhookUrl: `${base || "https://<your-host>"}/api/whatsapp/webhook`,
    last7days: { sent, failed, conversations: sessions, cases },
    messages,
  });
}, "ADMIN");

/** Send a test message to a number (text inside a 24-hour session, or the "case received" template). */
export const POST = withAuth(async (req, { user }) => {
  const { to, mode } = await parseBody(req, z.object({ to: z.string().min(6).max(20), mode: z.enum(["text", "template"]).default("text") }));
  const cfg = waConfig();
  if (!cfg.configured) throw badRequest("WhatsApp is not configured on the server (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)");
  const sent = mode === "template"
    ? await sendWhatsApp(to, { type: "template", name: cfg.templates.caseCreated || "hello_world", language: cfg.templates.caseCreated ? cfg.templates.language : "en_US", bodyParams: cfg.templates.caseCreated ? ["ZS-TEST-0001", "Test message from settings", "24"] : [], urlButtonParam: cfg.templates.caseCreated ? "ZS-TEST-0001" : undefined }, { orgId: user.orgId })
    : await sendWhatsApp(to, { type: "buttons", header: "Test", body: `Hello from ${process.env.NEXT_PUBLIC_APP_NAME || "ZimStat Approvals"}. Buttons are working.`, buttons: [{ id: "go_menu", title: "Main menu" }] }, { orgId: user.orgId });
  await audit(user.orgId, user.id, "whatsapp.test_sent", "Organization", user.orgId, { to: to.replace(/\d(?=\d{3})/g, "•"), mode, sent });
  if (!sent) throw badRequest("Meta rejected the message; see the message log for the error.");
  return ok({ sent });
}, "ADMIN");
