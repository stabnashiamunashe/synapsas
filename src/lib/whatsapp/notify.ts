// Outbound case notifications on WhatsApp. Business-initiated messages must use approved templates, so this sends
// WHATSAPP_TEMPLATE_CASE_CREATED / WHATSAPP_TEMPLATE_CASE_UPDATE when they are configured, and otherwise does nothing.
// Reporters who used WhatsApp always get updates; others only when "notify all reporters" is switched on.
import { prisma } from "../prisma";
import { parseJson } from "../json";
import { CASE_STATUS_LABELS, type CaseSettings, type CaseStatus } from "../caseTypes";
import { inSessionWindow, sendWhatsApp, waConfig } from "./client";
import { LANG_LABELS, topicLabel, type Lang } from "./i18n";

type C = { id: string; orgId: string; referenceNo: string; title: string; status: string; slaHours: number; reporterPhone: string | null; source: string };

export async function notifyReporterWhatsApp(c: C, kind: "created" | "status", note?: string) {
  try {
    const cfg = waConfig();
    if (!cfg.configured || !c.reporterPhone) return;
    const org = await prisma.organization.findUnique({ where: { id: c.orgId }, select: { settings: true } });
    const wa = parseJson<{ cases?: CaseSettings }>(org?.settings || "{}", {}).cases?.whatsapp || {};
    if (wa.enabled === false) return;
    if (c.source !== "WHATSAPP" && !wa.notifyAllReporters) return;
    if (kind === "created" && c.source === "WHATSAPP") return; // the chatbot already confirmed the reference in the conversation
    const status = CASE_STATUS_LABELS[c.status as CaseStatus] || c.status;
    // Inside the 24-hour customer-service window a plain message is allowed, so officer replies and status changes reach
    // the person even before templates are approved; outside it Meta requires a template.
    if (await inSessionWindow(c.reporterPhone)) {
      const text = kind === "created" ? `*${c.referenceNo}* logged: ${c.title.slice(0, 200)}` : note ? `*${c.referenceNo}*\n${note.slice(0, 900)}` : `*${c.referenceNo}*: ${status}`;
      await sendWhatsApp(c.reporterPhone, { type: "text", text }, { orgId: c.orgId, caseId: c.id });
      return;
    }
    const name = kind === "created" ? cfg.templates.caseCreated : cfg.templates.caseUpdate;
    if (!name) return;
    const params = kind === "created" ? [c.referenceNo, c.title.slice(0, 100), String(c.slaHours)] : [c.referenceNo, status, (note || c.title).slice(0, 200)];
    await sendWhatsApp(c.reporterPhone, { type: "template", name, language: cfg.templates.language, bodyParams: params, urlButtonParam: encodeURIComponent(c.referenceNo) }, { orgId: c.orgId, caseId: c.id });
  } catch (e) {
    console.error("[whatsapp] notify failed", e);
  }
}

type Release = { id: string; orgId: string; title: string; topic: string; url: string | null; summary: string | null };

/**
 * Tell subscribers that a release is out. Subscribers who messaged us in the last 24 hours get a plain message; the rest
 * get the WHATSAPP_TEMPLATE_RELEASE template ({{1}} title, {{2}} topic, {{3}} summary or link) when it is configured.
 * Monthly-summary subscribers are skipped here; they are covered by the monthly digest. Returns how many were messaged.
 */
export async function notifyReleaseSubscribers(r: Release, opts: { simulate?: boolean } = {}) {
  const cfg = waConfig();
  const subs = await prisma.statSubscription.findMany({ where: { orgId: r.orgId, isActive: true, frequency: "EVERY" } });
  let sent = 0;
  for (const s of subs) {
    const topics = parseJson<string[]>(s.topics, []);
    if (topics.length && !topics.includes(r.topic)) continue;
    const lang = (["en", "sn", "nd"].includes(s.language) ? s.language : "en") as Lang;
    const line = `*${r.title}* (${topicLabel(r.topic, lang)})${r.summary ? `\n${r.summary}` : ""}${r.url ? `\n${r.url}` : ""}`;
    let ok = false;
    if (opts.simulate || (await inSessionWindow(s.phone))) ok = await sendWhatsApp(s.phone, { type: "text", text: line }, { orgId: r.orgId, simulate: opts.simulate });
    else if (cfg.templates.releaseAlert) ok = await sendWhatsApp(s.phone, { type: "template", name: cfg.templates.releaseAlert, language: cfg.templates.language, bodyParams: [r.title.slice(0, 100), topicLabel(r.topic, lang), (r.summary || r.url || LANG_LABELS[lang]).slice(0, 200)] }, { orgId: r.orgId });
    if (ok) { sent++; await prisma.statSubscription.update({ where: { id: s.id }, data: { lastSentAt: new Date() } }); }
  }
  return sent;
}
