// Server-side helpers for the WhatsApp desk (/app/chatbot): the log of data the bot hands out, live chats handled by
// officers in the portal, and decisions on data requests. The bot records here; the desk API reads and acts.
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { parseJson } from "../json";
import { ApiError, badRequest, notFound } from "../api";
import { audit } from "../notify";
import { sendCaseUpdateEmail } from "../emails";
import { CASE_DONE, type CaseStatus } from "../caseTypes";
import type { SessionUser } from "../types";
import { inSessionWindow, normalizePhone, sendWhatsApp, waConfig } from "./client";
import { notifyReporterWhatsApp } from "./notify";
import { t, topicLabel } from "./i18n";

/** Where a data request stands: pending (nobody decided), approved (being prepared), delivered, declined. */
export const DR_BUCKETS = {
  pending: ["NEW", "TRIAGED", "ASSIGNED", "REOPENED"], approved: ["IN_PROGRESS", "ON_HOLD"], delivered: ["RESOLVED", "CLOSED"], declined: ["REJECTED"],
} as const;
export type DrBucket = keyof typeof DR_BUCKETS;
export const bucketOf = (status: string): DrBucket => (Object.keys(DR_BUCKETS) as DrBucket[]).find((b) => (DR_BUCKETS[b] as readonly string[]).includes(status)) || "pending";

const optLabel = (v: unknown) => (v ? t("en", `opt_${v}`) : "");

/** The answers the person gave on WhatsApp, in plain words, plus the decision taken on the desk. */
export function describeRequest(customFields: string) {
  const a = parseJson<Record<string, unknown>>(customFields, {});
  return {
    requesterType: optLabel(a.requesterType), organisation: String(a.org || ""), email: String(a.email || ""), topic: a.topic ? topicLabel(String(a.topic), "en") : "", topicKey: String(a.topic || ""),
    geo: optLabel(a.geo), period: String(a.period || ""), format: String(a.format || ""), purpose: optLabel(a.purpose), description: String(a.description || ""),
    decision: (a.decision as { status: string; by: string; at: string; note: string | null } | undefined) || null,
  };
}

export const DATA_LOG_KINDS = ["indicator", "dataset", "link", "export", "document", "request"] as const;
export type DataLogKind = (typeof DATA_LOG_KINDS)[number];
export const DATA_LOG_LABELS: Record<DataLogKind, string> = {
  indicator: "Headline figure", dataset: "Portal dataset", link: "Portal link", export: "Excel/PDF table", document: "Publication", request: "Data request",
};

/** Record what the bot handed out (or what was asked for). Never throws: a logging failure must not break the conversation. */
export async function logData(orgId: string, phone: string, e: { kind: DataLogKind; topic?: string | null; title: string; ref?: string | null; format?: string | null; caseId?: string | null }) {
  try {
    await prisma.chatbotDataLog.create({ data: { orgId, phone: normalizePhone(phone), kind: e.kind, topic: e.topic || null, title: e.title.slice(0, 255), ref: e.ref ? e.ref.slice(0, 160) : null, format: e.format || null, caseId: e.caseId || null } });
  } catch (err) {
    console.error("[chatbot] data log failed", err);
  }
}

export const maskPhone = (p: string) => p.replace(/\d(?=\d{3})/g, "•");

/** Live chats are the TK cases opened from option 6 (customFields.liveChat); data requests are the DR- cases from option 2. */
export const LIVE_CHAT_WHERE: Prisma.CaseWhereInput = { source: "WHATSAPP", customFields: { contains: '"liveChat":true', mode: "insensitive" as const } };
export const DATA_REQUEST_WHERE: Prisma.CaseWhereInput = { referenceNo: { startsWith: "DR-" } };

/**
 * Deliver a plain message to the person on WhatsApp. Inside the 24-hour window (or when Meta is not configured, so the
 * attempt is at least logged for the sandbox) it is sent as text; outside it the case-update template is used.
 */
export async function pushToReporter(c: { id: string; orgId: string; referenceNo: string; title: string; status: string; slaHours: number; reporterPhone: string | null; source: string }, text: string) {
  if (!c.reporterPhone) return false;
  const phone = normalizePhone(c.reporterPhone);
  if (!waConfig().configured || (await inSessionWindow(phone))) return sendWhatsApp(phone, { type: "text", text }, { orgId: c.orgId, caseId: c.id });
  await notifyReporterWhatsApp(c, "status", text);
  return true;
}

export type DataRequestAction = "approve" | "decline" | "deliver";

/** Approve, decline or mark a data request as delivered; the requester is told on WhatsApp (and by email when given). */
export async function decideDataRequest(orgId: string, caseId: string, action: DataRequestAction, note: string | undefined, actor: SessionUser, ctx?: { ip?: string; userAgent?: string }) {
  const c = await prisma.case.findFirst({ where: { id: caseId, orgId, ...DATA_REQUEST_WHERE } });
  if (!c) throw notFound("Data request not found");
  const clean = (note || "").trim();
  if (action === "decline" && !clean) throw badRequest("Give the requester the reason");
  if (action === "deliver" && CASE_DONE.includes(c.status as CaseStatus) && c.status !== "RESOLVED") throw badRequest("This request was declined; reopen it first");
  const to: CaseStatus = action === "approve" ? "IN_PROGRESS" : action === "decline" ? "REJECTED" : "RESOLVED";
  const label = action === "approve" ? "Approved" : action === "decline" ? "Declined" : "Delivered";
  const cf = parseJson<Record<string, unknown>>(c.customFields, {});
  cf.decision = { status: label.toUpperCase(), by: actor.name, at: new Date().toISOString(), note: clean || null };
  const text = action === "approve"
    ? `*${c.referenceNo}*: your data request has been approved and is being prepared.${clean ? `\n${clean}` : ""}`
    : action === "decline"
      ? `*${c.referenceNo}*: your data request could not be approved.\n${clean}`
      : `*${c.referenceNo}*: your data request has been completed.${clean ? `\n${clean}` : "\nThe data has been sent to the email address you gave."}`;
  const now = new Date();
  const updated = await prisma.case.update({
    where: { id: c.id },
    data: {
      status: to, version: { increment: 1 }, lastActivityAt: now, assigneeId: c.assigneeId || actor.id, customFields: JSON.stringify(cf),
      ...(to === "RESOLVED" ? { resolvedAt: now } : {}),
      events: { create: { fromStatus: c.status, toStatus: to, changedById: actor.id, changedByName: actor.name, reason: `${label}${clean ? `: ${clean}` : ""}` } },
      comments: { create: { userId: actor.id, authorName: actor.name, body: text, isInternal: false } },
    },
  });
  if (c.reporterEmail) void sendCaseUpdateEmail({ email: c.reporterEmail, name: c.reporterName, orgId }, updated, "status", text);
  void pushToReporter(updated, text);
  await audit(orgId, actor.id, `data_request.${action}`, "Case", c.id, { referenceNo: c.referenceNo, note: clean || undefined }, ctx);
  return updated;
}

export type LiveChatAction = "accept" | "reply" | "end";

/** Officer actions on a live chat: take it, answer (delivered to WhatsApp at once), or end it (the person is sent back to the menu). */
export async function liveChatAction(orgId: string, caseId: string, action: LiveChatAction, text: string | undefined, actor: SessionUser, ctx?: { ip?: string; userAgent?: string }) {
  const c = await prisma.case.findFirst({ where: { id: caseId, orgId, ...LIVE_CHAT_WHERE } });
  if (!c) throw notFound("Chat not found");
  const done = CASE_DONE.includes(c.status as CaseStatus);
  const body = (text || "").trim();
  const now = new Date();
  if (action === "reply") {
    if (!body) throw badRequest("Type a reply first");
    if (done) throw new ApiError(400, "This chat has ended");
    await prisma.case.update({ where: { id: c.id }, data: { lastActivityAt: now, assigneeId: c.assigneeId || actor.id, ...(["NEW", "TRIAGED", "ASSIGNED"].includes(c.status) ? { status: "IN_PROGRESS", version: { increment: 1 }, events: { create: { fromStatus: c.status, toStatus: "IN_PROGRESS", changedById: actor.id, changedByName: actor.name, reason: "Officer joined the chat" } } } : {}), comments: { create: { userId: actor.id, authorName: actor.name, body, isInternal: false } } } });
    const sent = await pushToReporter(c, body);
    return { sent };
  }
  if (action === "accept") {
    if (done) throw new ApiError(400, "This chat has ended");
    await prisma.case.update({ where: { id: c.id }, data: { assigneeId: actor.id, status: "IN_PROGRESS", version: { increment: 1 }, lastActivityAt: now, events: { create: { fromStatus: c.status, toStatus: "IN_PROGRESS", changedById: actor.id, changedByName: actor.name, reason: "Accepted the chat" } } } });
    await pushToReporter(c, `You are now chatting with ${actor.name} from ZIMSTAT. Type your question.`);
    await audit(orgId, actor.id, "live_chat.accept", "Case", c.id, { referenceNo: c.referenceNo }, ctx);
    return { sent: true };
  }
  // end
  if (!done) await prisma.case.update({ where: { id: c.id }, data: { status: "RESOLVED", resolvedAt: now, version: { increment: 1 }, lastActivityAt: now, assigneeId: c.assigneeId || actor.id, events: { create: { fromStatus: c.status, toStatus: "RESOLVED", changedById: actor.id, changedByName: actor.name, reason: body ? `Chat ended: ${body}` : "Chat ended by the officer" } }, ...(body ? { comments: { create: { userId: actor.id, authorName: actor.name, body, isInternal: false } } } : {}) } });
  if (c.reporterPhone) {
    const phone = normalizePhone(c.reporterPhone);
    const session = await prisma.whatsAppSession.findUnique({ where: { phone } });
    if (session && session.step === "CHAT") await prisma.whatsAppSession.update({ where: { phone }, data: { step: "MENU", data: "{}" } });
    await pushToReporter(c, `${body ? `${body}\n\n` : ""}Chat ended. Your conversation is saved under *${c.referenceNo}*. Type *menu* for the services.`);
  }
  await audit(orgId, actor.id, "live_chat.end", "Case", c.id, { referenceNo: c.referenceNo }, ctx);
  return { sent: true };
}
