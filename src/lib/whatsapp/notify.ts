// Outbound case notifications on WhatsApp. Business-initiated messages must use approved templates, so this sends
// WHATSAPP_TEMPLATE_CASE_CREATED / WHATSAPP_TEMPLATE_CASE_UPDATE when they are configured, and otherwise does nothing.
// Reporters who used WhatsApp always get updates; others only when "notify all reporters" is switched on.
import { prisma } from "../prisma";
import { parseJson } from "../json";
import { CASE_STATUS_LABELS, type CaseSettings, type CaseStatus } from "../caseTypes";
import { sendWhatsApp, waConfig } from "./client";

type C = { id: string; orgId: string; referenceNo: string; title: string; status: string; slaHours: number; reporterPhone: string | null; source: string };

export async function notifyReporterWhatsApp(c: C, kind: "created" | "status", note?: string) {
  try {
    const cfg = waConfig();
    if (!cfg.configured || !c.reporterPhone) return;
    const org = await prisma.organization.findUnique({ where: { id: c.orgId }, select: { settings: true } });
    const wa = parseJson<{ cases?: CaseSettings }>(org?.settings || "{}", {}).cases?.whatsapp || {};
    if (wa.enabled === false) return;
    if (c.source !== "WHATSAPP" && !wa.notifyAllReporters) return;
    const name = kind === "created" ? cfg.templates.caseCreated : cfg.templates.caseUpdate;
    if (!name) return;
    const status = CASE_STATUS_LABELS[c.status as CaseStatus] || c.status;
    const params = kind === "created" ? [c.referenceNo, c.title.slice(0, 100), String(c.slaHours)] : [c.referenceNo, status, (note || c.title).slice(0, 200)];
    await sendWhatsApp(c.reporterPhone, { type: "template", name, language: cfg.templates.language, bodyParams: params, urlButtonParam: encodeURIComponent(c.referenceNo) }, { orgId: c.orgId, caseId: c.id });
  } catch (e) {
    console.error("[whatsapp] notify failed", e);
  }
}
