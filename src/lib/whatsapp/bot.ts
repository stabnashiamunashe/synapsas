// WhatsApp chatbot for the public: language choice, then six services (latest statistics, data requests, enumerator
// and survey verification, release calendar and alerts, enquiries and complaints, live chat with an officer), plus
// tracking of references. Menus are lists and buttons; free text is only used for the answers that need it.
// State is kept per phone in WhatsAppSession (24-hour drafts). Anything that needs staff action becomes a service-desk
// case (DR-, VR-, TK- prefixes) so one dashboard tracks every WhatsApp submission and pushes status back here.
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { prisma } from "../prisma";
import { parseJson, toJson } from "../json";
import { caseSettings, createCase, type CaseSettingsFull } from "../cases";
import { CASE_STATUS_LABELS, type CaseStatus } from "../caseTypes";
import { notify } from "../notify";
import type { OrgSettings } from "../types";
import { extensionOf, safeMimeFor, validateUpload } from "../uploads";
import { describe, downloadMedia, logMessage, normalizePhone, sendWhatsApp, type WaOutgoing } from "./client";
import { exportFilename, type DocSource } from "./documents";
import { LANG_LABELS, LANGS, STAT_TOPICS, isLang, t, topicLabel, type Lang } from "./i18n";

export type Inbound =
  | { kind: "text"; text: string }
  | { kind: "button"; id: string; title?: string }
  | { kind: "list"; id: string; title?: string }
  | { kind: "location"; latitude: number; longitude: number; name?: string; address?: string }
  | { kind: "media"; mediaId: string; mimeType: string; fileName: string; caption?: string }
  | { kind: "other" };

type Step = "IDLE" | "LANG" | "MENU" | "EXIT_CONFIRM" | "STATS_TOPIC" | "STATS_IND" | "STATS_AFTER" | "STATS_FILES" | "FLOW" | "FLOW_SUMMARY" | "FLOW_EDIT" | "VR_KIND" | "VR_BADGE" | "VR_FOUND" | "VR_SURVEY" | "REL_TOPICS" | "REL_FREQ" | "CHAT_TOPIC" | "CHAT" | "TRACK" | "RATE";
type FlowKey = "DR" | "VR" | "TK";
type Media = { mediaId: string; mimeType: string; fileName: string; simulated?: boolean };
type Answers = Record<string, unknown>;
type Draft = { flow: FlowKey; qi: number; answers: Answers };
type Data = {
  lang?: Lang; flow?: FlowKey; qi?: number; answers?: Answers; tries?: number; editing?: boolean; draft?: Draft;
  topic?: string; indicatorId?: string; topics?: string[]; badge?: string; trackCaseId?: string; rateCaseId?: string; chatCaseId?: string; chatRef?: string; chatAcked?: boolean; prevStep?: Step;
};

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const B = {
  STATS: "m_stats", DATA: "m_data", VERIFY: "m_verify", ALERTS: "m_alerts", ENQUIRY: "m_enquiry", CHAT: "m_chat", TRACK: "m_track", RESUME: "m_resume",
  MENU: "go_menu", CANCEL: "go_cancel", BACK: "nav_back", SKIP: "nav_skip", SUBMIT: "flow_submit", EDIT: "flow_edit", YES: "yes", NO: "no", OFFICER: "go_officer", DISCARD: "exit_discard", CONTINUE: "exit_continue",
  ANOTHER: "stats_another", GET_ALERTS: "stats_alerts", FILES: "stats_files", XLSX: "file_xlsx", PDF: "file_pdf", ALLX: "file_all", VR_OFFICER: "vr_officer", VR_SURVEY: "vr_survey", VR_MATCH: "vr_match", VR_CONCERN: "vr_concern", VR_RETRY: "vr_retry",
  REL_DONE: "rel_done", REL_EVERY: "rel_every", REL_MONTHLY: "rel_monthly", CHAT_LOG: "chat_log", ANON: "tk_anon", RATE: "rate_", LANG: "lang_",
};

type Ctx = { orgId: string; phone: string; lang: Lang; profileName: string | null; settings: CaseSettingsFull; org: OrgSettings; data: Data; simulate: boolean };
type Option = { id: string; title: string; description?: string };
type Q = {
  key: string; label: string; kind: "text" | "list" | "buttons" | "media" | "place";
  ask: (c: Ctx) => string;
  options?: (c: Ctx) => Promise<Option[]> | Option[];
  validate?: (text: string, c: Ctx) => string | null; // i18n key of the error
  optional?: boolean;
  skipLabel?: string; // i18n key for a custom skip button (e.g. Stay anonymous)
  when?: (a: Answers, c: Ctx) => boolean;
};
type Flow = { key: FlowKey; questions: Q[]; submit: (c: Ctx, a: Answers) => Promise<WaOutgoing[]> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const YEARS = /^(19|20)\d{2}(\s*(-|–|to)\s*(19|20)\d{2})?$/i;
const DATE = /^(\d{4}-\d{2}-\d{2}|today|nhasi|lamuhla)$/i;
const REF = /^(?:status\s+)?([A-Z]{2,6}-\d{4}-\d{3,6})$/i;

const opt = (c: Ctx, ids: string[]): Option[] => ids.map((id) => ({ id, title: t(c.lang, `opt_${id}`) }));
const topicOptions = (c: Ctx): Option[] => STAT_TOPICS.map((x) => ({ id: x.key, title: x[c.lang] || x.en }));
const publicCategories = async (c: Ctx): Promise<Option[]> => {
  const cats = await prisma.caseCategory.findMany({ where: { orgId: c.orgId, isActive: true, isPublic: true }, orderBy: { name: "asc" }, select: { id: true, name: true, description: true }, take: 9 });
  return cats.map((x) => ({ id: x.id, title: x.name, description: (x.description || "").slice(0, 72) }));
};
const isComplaint = async (a: Answers) => { if (!a.category) return false; const cat = await prisma.caseCategory.findUnique({ where: { id: String(a.category) }, select: { name: true } }); return /complain/i.test(cat?.name || ""); };

// ------------------------------------------------------------------------------------------------------------------
// Flows that end in a service-desk case
// ------------------------------------------------------------------------------------------------------------------
const FLOWS: Record<FlowKey, Flow> = {
  DR: {
    key: "DR",
    questions: [
      { key: "requesterType", label: "f_requesterType", kind: "list", ask: (c) => t(c.lang, "dr_type"), options: (c) => opt(c, ["individual", "student", "gov", "partner", "company", "media"]) },
      { key: "name", label: "f_name", kind: "text", ask: (c) => t(c.lang, "dr_name"), validate: (s) => (s.trim().length < 3 ? "unknown" : null) },
      { key: "org", label: "f_org", kind: "text", ask: (c) => t(c.lang, "dr_org") },
      { key: "email", label: "f_email", kind: "text", ask: (c) => t(c.lang, "dr_email"), validate: (s) => (EMAIL.test(s.trim()) ? null : "dr_email_bad") },
      { key: "topic", label: "f_topic", kind: "list", ask: (c) => t(c.lang, "dr_topic"), options: topicOptions },
      { key: "description", label: "f_description", kind: "text", ask: (c) => t(c.lang, "dr_desc"), validate: (s) => (s.trim().length < 20 ? "dr_desc_short" : null) },
      { key: "geo", label: "f_geo", kind: "list", ask: (c) => t(c.lang, "dr_geo"), options: (c) => opt(c, ["national", "province", "district", "ward", "other"]) },
      { key: "period", label: "f_period", kind: "text", ask: (c) => t(c.lang, "dr_period"), validate: (s) => (YEARS.test(s.trim()) ? null : "dr_period_bad") },
      { key: "format", label: "f_format", kind: "list", ask: (c) => t(c.lang, "dr_format"), options: () => ["Excel", "CSV", "PDF table", "SDMX"].map((x) => ({ id: x, title: x })) },
      { key: "purpose", label: "f_purpose", kind: "list", ask: (c) => t(c.lang, "dr_purpose"), options: (c) => opt(c, ["research", "policy", "business", "story", "other"]) },
      { key: "document", label: "f_document", kind: "media", ask: (c) => t(c.lang, "dr_doc"), optional: true },
      { key: "consent", label: "dr_consent", kind: "buttons", ask: (c) => t(c.lang, "dr_consent"), options: (c) => [{ id: B.YES, title: t(c.lang, "btn_yes") }, { id: B.NO, title: t(c.lang, "btn_no") }] },
    ],
    submit: async (c, a) => {
      const category = await pickCategory(c, c.settings.whatsapp?.dataRequestCategoryId, /data request|statistical data/i);
      const lines = ["Data request submitted on WhatsApp.", "", `Requester type: ${t("en", `opt_${a.requesterType}`)}`, `Organisation: ${a.org || "none"}`, `Subject area: ${topicLabel(String(a.topic), "en")}`, `Geographic level: ${t("en", `opt_${a.geo}`)}`, `Period: ${a.period}`, `Preferred format: ${a.format}`, `Purpose: ${t("en", `opt_${a.purpose}`)}`, "", `Data needed:`, String(a.description), "", `Consent to data-use terms: yes (${new Date().toISOString().slice(0, 10)})`, `Language: ${LANG_LABELS[c.lang]}`];
      const cs = await createCase(c.orgId, {
        title: `Data request: ${String(a.description).split(/[.\n]/)[0].slice(0, 100)}`, description: lines.join("\n"), categoryId: category?.id || null, priority: "MEDIUM", source: "WHATSAPP",
        reporterName: String(a.name).slice(0, 120), reporterPhone: `+${c.phone}`, reporterEmail: String(a.email).trim(), customFields: { channel: "whatsapp", ...a, document: undefined }, referencePrefix: "DR",
      }, null);
      await attachMedia(c, cs.id, cs.referenceNo, [a.document as Media | undefined]);
      return [{ type: "buttons", header: "ZIMSTAT", body: t(c.lang, "dr_done", { ref: cs.referenceNo }), buttons: [{ id: B.TRACK, title: t(c.lang, "m_track") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] }];
    },
  },
  VR: {
    key: "VR",
    questions: [
      { key: "location", label: "f_location", kind: "place", ask: (c) => t(c.lang, "vr_loc"), validate: (s) => (s.trim().length < 3 ? "unknown" : null) },
      { key: "date", label: "f_date", kind: "text", ask: (c) => t(c.lang, "vr_date"), validate: (s) => (DATE.test(s.trim()) ? null : "vr_date_bad") },
      { key: "details", label: "f_details", kind: "text", ask: (c) => t(c.lang, "vr_desc"), validate: (s) => (s.trim().length < 10 ? "dr_desc_short" : null) },
      { key: "photo", label: "f_photo", kind: "media", ask: (c) => t(c.lang, "vr_photo"), optional: true },
    ],
    submit: async (c, a) => {
      const category = await pickCategory(c, c.settings.whatsapp?.verificationCategoryId, /verif|field|enumerator|complaint/i);
      const date = /today|nhasi|lamuhla/i.test(String(a.date)) ? new Date().toISOString().slice(0, 10) : String(a.date);
      const lines = ["Field verification concern reported on WhatsApp.", "", `Badge ID given: ${a.badge || "not given"}`, `Register check: ${a.officerFound ? "ID found; member of public disputes the match" : "no active officer with this ID"}`, `Date of incident: ${date}`, `Location: ${a.location}`, "", "What happened:", String(a.details), "", `Language: ${LANG_LABELS[c.lang]}`];
      const cs = await createCase(c.orgId, {
        title: `Field officer concern: badge ${a.badge || "unknown"} (${String(a.location).slice(0, 60)})`, description: lines.join("\n"), categoryId: category?.id || null, priority: "HIGH", source: "WHATSAPP",
        reporterName: c.profileName || "WhatsApp user", reporterPhone: `+${c.phone}`, locationAddress: String(a.location).slice(0, 500), latitude: (a.latitude as number) ?? null, longitude: (a.longitude as number) ?? null,
        customFields: { channel: "whatsapp", badge: a.badge, date, officerFound: !!a.officerFound }, referencePrefix: "VR",
      }, null);
      await attachMedia(c, cs.id, cs.referenceNo, [a.photo as Media | undefined]);
      return [{ type: "buttons", header: "ZIMSTAT", body: t(c.lang, "vr_done", { ref: cs.referenceNo }), buttons: [{ id: B.TRACK, title: t(c.lang, "m_track") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] }];
    },
  },
  TK: {
    key: "TK",
    questions: [
      { key: "category", label: "f_category", kind: "list", ask: (c) => t(c.lang, "tk_cat"), options: publicCategories },
      { key: "name", label: "f_name", kind: "text", ask: (c) => t(c.lang, "tk_name"), optional: true, skipLabel: "tk_anon", validate: (s) => (s.trim().length < 2 ? "unknown" : null) },
      { key: "email", label: "f_email", kind: "text", ask: (c) => t(c.lang, "tk_email"), optional: true, validate: (s) => (EMAIL.test(s.trim()) ? null : "dr_email_bad") },
      { key: "details", label: "f_details", kind: "text", ask: (c) => t(c.lang, "tk_desc"), validate: (s) => (s.trim().length < 10 ? "dr_desc_short" : null) },
      { key: "attachment", label: "f_attachment", kind: "media", ask: (c) => t(c.lang, "tk_attach"), optional: true },
    ],
    submit: async (c, a) => {
      const cat = await prisma.caseCategory.findFirst({ where: { id: String(a.category), orgId: c.orgId }, include: { department: { select: { name: true } } } });
      if (await isComplaint(a) && !a.name) return [{ type: "buttons", body: t(c.lang, "tk_name_required"), buttons: [{ id: B.EDIT, title: t(c.lang, "btn_edit") }, { id: B.CANCEL, title: t(c.lang, "btn_cancel") }] }];
      const lines = [`${a.liveChat ? "Question logged after hours from the live-chat option." : "Enquiry submitted on WhatsApp."}`, "", String(a.details), "", `Language: ${LANG_LABELS[c.lang]}`];
      const cs = await createCase(c.orgId, {
        title: String(a.details).split(/[.\n]/)[0].slice(0, 120) || cat?.name || "WhatsApp enquiry", description: lines.join("\n"), categoryId: cat?.id || null, source: "WHATSAPP",
        reporterName: a.name ? String(a.name).slice(0, 120) : "Anonymous (WhatsApp)", reporterPhone: `+${c.phone}`, reporterEmail: a.email ? String(a.email).trim() : null, customFields: { channel: "whatsapp" }, referencePrefix: "TK",
      }, null);
      await attachMedia(c, cs.id, cs.referenceNo, [a.attachment as Media | undefined]);
      return [{ type: "buttons", header: "ZIMSTAT", body: t(c.lang, "tk_done", { ref: cs.referenceNo, dept: cat?.department.name || "the service desk" }), buttons: [{ id: B.TRACK, title: t(c.lang, "m_track") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] }];
    },
  },
};

async function pickCategory(c: Ctx, configuredId: string | null | undefined, fallback: RegExp) {
  if (configuredId) { const cat = await prisma.caseCategory.findFirst({ where: { id: configuredId, orgId: c.orgId, isActive: true } }); if (cat) return cat; }
  const cats = await prisma.caseCategory.findMany({ where: { orgId: c.orgId, isActive: true }, orderBy: { name: "asc" } });
  return cats.find((x) => fallback.test(x.name)) || cats.find((x) => x.isPublic) || cats[0] || null;
}

const MIME_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx", "text/csv": "csv" };

/** Store photos / documents sent during a flow against the case (downloaded from Meta by media id; sandbox media is only noted). */
async function attachMedia(c: Ctx, caseId: string, referenceNo: string, items: (Media | undefined)[]) {
  for (const m of items) {
    if (!m) continue;
    const note = async (text: string) => prisma.caseComment.create({ data: { caseId, authorName: "WhatsApp", body: text, isInternal: true } });
    if (m.simulated || c.simulate) { await note(`Attachment sent on WhatsApp (sandbox, not stored): ${m.fileName}`); continue; }
    const got = await downloadMedia(m.mediaId);
    if (!got) { await note(`Attachment ${m.fileName} could not be downloaded from WhatsApp.`); continue; }
    let name = m.fileName.slice(0, 180);
    const wantExt = MIME_EXT[got.mimeType] || MIME_EXT[m.mimeType];
    if (wantExt && extensionOf(name) !== wantExt) name = `${name.replace(/\.[A-Za-z0-9]+$/, "")}.${wantExt}`;
    const problem = validateUpload(name, got.mimeType, got.bytes);
    if (problem) { await note(`Attachment ${name} rejected: ${problem}`); continue; }
    const dir = path.resolve(process.env.UPLOAD_DIR || "./uploads", c.orgId, "cases");
    await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
    const storageName = `${nanoid(24)}.${extensionOf(name)}`;
    await writeFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, storageName), got.bytes, { mode: 0o600 });
    await prisma.caseAttachment.create({ data: { caseId, uploadedBy: `${c.profileName || "Reporter"} (WhatsApp)`, fileName: name, mimeType: safeMimeFor(name), size: got.bytes.length, storagePath: path.join(/*turbopackIgnore: true*/ c.orgId, "cases", storageName), isPublic: true, stage: "INTAKE" } });
  }
  await logMessage({ orgId: c.orgId, phone: c.phone, direction: "IN", kind: "system", body: `Case ${referenceNo} created`, status: "received", caseId });
}

// ------------------------------------------------------------------------------------------------------------------
// Menus and helpers
// ------------------------------------------------------------------------------------------------------------------
const nav = (c: Ctx, extra: { id: string; title: string }[] = []): { id: string; title: string }[] => [...extra, { id: B.BACK, title: t(c.lang, "btn_back") }, { id: B.CANCEL, title: t(c.lang, "btn_cancel") }].slice(0, 3);

function langPrompt(): WaOutgoing {
  return { type: "buttons", header: "ZIMSTAT", body: `${t("en", "lang_prompt")}\n\n1 English · 2 ChiShona · 3 isiNdebele`, buttons: LANGS.map((l) => ({ id: `${B.LANG}${l}`, title: LANG_LABELS[l] })) };
}

function mainMenu(c: Ctx): WaOutgoing {
  const disabled = new Set(c.settings.whatsapp?.disabledOptions || []);
  const all: (Option | false | undefined)[] = [
    !disabled.has("stats") && { id: B.STATS, title: t(c.lang, "m_stats"), description: t(c.lang, "m_stats_d") },
    !disabled.has("data") && { id: B.DATA, title: t(c.lang, "m_data"), description: t(c.lang, "m_data_d") },
    !disabled.has("verify") && { id: B.VERIFY, title: t(c.lang, "m_verify"), description: t(c.lang, "m_verify_d") },
    !disabled.has("alerts") && { id: B.ALERTS, title: t(c.lang, "m_alerts"), description: t(c.lang, "m_alerts_d") },
    !disabled.has("enquiry") && { id: B.ENQUIRY, title: t(c.lang, "m_enquiry"), description: t(c.lang, "m_enquiry_d") },
    !disabled.has("chat") && { id: B.CHAT, title: t(c.lang, "m_chat"), description: t(c.lang, "m_chat_d") },
    { id: B.TRACK, title: t(c.lang, "m_track"), description: t(c.lang, "m_track_d") },
    c.data.draft && { id: B.RESUME, title: t(c.lang, "btn_continue"), description: `${c.data.draft.flow}: ${t(c.lang, "btn_continue").toLowerCase()}` },
  ];
  const rows = all.filter((r): r is Option => !!r);
  const greeting = c.lang === "en" ? c.settings.whatsapp?.greeting || "Welcome to ZIMSTAT. How can we help you today?" : t(c.lang, "menu_body");
  return { type: "list", header: t(c.lang, "menu_header"), body: greeting, button: t(c.lang, "menu_button"), footer: t(c.lang, "menu_footer"), sections: [{ rows }] };
}

const statusLine = (c: Ctx, k: { referenceNo: string; title: string; status: string; slaDueAt: Date | null; resolvedAt: Date | null }) =>
  `*${k.referenceNo}* · ${CASE_STATUS_LABELS[k.status as CaseStatus] || k.status}\n${k.title}${k.resolvedAt ? `\n${t(c.lang, "track_resolved")} ${k.resolvedAt.toDateString()}` : k.slaDueAt ? `\n${t(c.lang, "track_target")} ${k.slaDueAt.toDateString()}` : ""}`;

async function trackList(c: Ctx): Promise<WaOutgoing> {
  const cases = await prisma.case.findMany({ where: { orgId: c.orgId, reporterPhone: { endsWith: c.phone.slice(-9) } }, orderBy: { createdAt: "desc" }, take: 9, select: { id: true, referenceNo: true, title: true, status: true } });
  if (!cases.length) return { type: "buttons", body: t(c.lang, "track_none"), buttons: [{ id: B.MENU, title: t(c.lang, "btn_menu") }] };
  return { type: "list", header: t(c.lang, "m_track"), body: t(c.lang, "track_pick"), button: t(c.lang, "menu_button"), sections: [{ rows: cases.map((k) => ({ id: `case_${k.id}`, title: k.referenceNo, description: `${CASE_STATUS_LABELS[k.status as CaseStatus] || k.status} · ${k.title}`.slice(0, 72) })) }] };
}

function officeHours(org: OrgSettings) {
  const start = org.workingHoursStart ?? 8, end = org.workingHoursEnd ?? 16.5, days = org.workingDays || [1, 2, 3, 4, 5];
  const tz = org.timezone || "Africa/Harare";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", minute: "numeric", weekday: "short", hour12: false }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0) + Number(parts.find((p) => p.type === "minute")?.value || 0) / 60;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value || "");
  const fmt = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const sorted = [...days].sort();
  const label = `${dayNames[sorted[0]]} to ${dayNames[sorted[sorted.length - 1]]}, ${fmt(start)} to ${fmt(end)}`;
  return { open: days.includes(wd) && hour >= start && hour < end, label };
}

// ------------------------------------------------------------------------------------------------------------------
// Entry point
// ------------------------------------------------------------------------------------------------------------------
/** Process one inbound message and return the replies. Never throws: any failure resets to the menu. */
export async function handleInbound(orgId: string, rawPhone: string, profileName: string | null, input: Inbound, opts: { simulate?: boolean } = {}): Promise<WaOutgoing[]> {
  const phone = normalizePhone(rawPhone);
  const settings = await caseSettings(orgId);
  const wa = settings.whatsapp || {};
  const orgRow = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
  const org = parseJson<OrgSettings>(orgRow?.settings || "{}", {});
  const replies: WaOutgoing[] = [];
  const say = (...ms: WaOutgoing[]) => { replies.push(...ms); };
  let phoneForFlush = phone;
  try {
    if (wa.enabled === false) { say({ type: "text", text: wa.helpText || "WhatsApp services are not available at the moment. Please use the website or call the office." }); return await flush(); }
    let session = await prisma.whatsAppSession.findUnique({ where: { phone } });
    if (!session) session = await prisma.whatsAppSession.create({ data: { orgId, phone, profileName, step: "IDLE", data: "{}" } });
    let data = parseJson<Data>(session.data, {});
    if (Date.now() - session.lastInteractionAt.getTime() > SESSION_TTL_MS && session.step !== "IDLE") { data = { lang: data.lang }; session = await setStep(phone, "IDLE", data); }
    let step = session.step as Step;
    const lang: Lang = data.lang && isLang(data.lang) ? data.lang : "en";
    const c: Ctx = { orgId, phone, lang, profileName, settings, org, data, simulate: !!opts.simulate };
    phoneForFlush = phone;
    const save = async (s: Step, d: Data = data) => { d.lang = d.lang || data.lang; session = await setStep(phone, s, d, profileName); step = s; data = d; c.data = d; };
    const toMenu = async (keep: Partial<Data> = {}) => { await save("MENU", { lang: c.lang, draft: data.draft, ...keep }); say(mainMenu(c)); };

    const id = input.kind === "button" || input.kind === "list" ? input.id : "";
    const text = input.kind === "text" ? input.text.trim() : "";
    const lower = text.toLowerCase();
    const inFlow = step === "FLOW" || step === "FLOW_SUMMARY" || step === "FLOW_EDIT";

    // ---- global commands ----
    if (id.startsWith(B.LANG) || (step === "LANG" && /^[123]$/.test(lower))) {
      const l = id ? id.slice(B.LANG.length) : LANGS[Number(lower) - 1];
      if (isLang(l)) { c.lang = l; await save("MENU", { ...data, lang: l }); say(mainMenu(c)); return await flush(); }
    }
    if (!data.lang && step !== "LANG") { await save("LANG", { ...data }); say(langPrompt()); return await flush(); }
    if (["language", "mutauro", "ulimi"].includes(lower)) { await save("LANG", data); say(langPrompt()); return await flush(); }
    if (id === B.CANCEL || ["cancel", "stop", "kanzura", "khansela"].includes(lower)) { if (step === "CHAT" && data.chatRef) say({ type: "text", text: t(c.lang, "chat_ended", { ref: data.chatRef }) }); say({ type: "text", text: t(c.lang, "cancelled") }); await toMenu({ draft: undefined }); return await flush(); }
    if (lower === "stop alerts" || lower === "stop") {
      const sub = await prisma.statSubscription.findUnique({ where: { orgId_phone: { orgId, phone } } });
      if (sub?.isActive) { await prisma.statSubscription.update({ where: { id: sub.id }, data: { isActive: false } }); say({ type: "text", text: t(c.lang, "rel_stopped") }); } else say({ type: "text", text: t(c.lang, "rel_none_active") });
      return await flush();
    }
    if (lower === "delete my data") {
      const category = await pickCategory(c, wa.erasureCategoryId, /general|enquir|complaint/i);
      const cs = await createCase(orgId, { title: "Data erasure request (WhatsApp)", description: `The user of this WhatsApp number asked for their personal data to be deleted (Cyber and Data Protection Act). Remove stored details once open requests are closed and confirm on WhatsApp.`, categoryId: category?.id || null, priority: "MEDIUM", source: "WHATSAPP", reporterName: profileName || "WhatsApp user", reporterPhone: `+${phone}`, customFields: { channel: "whatsapp", erasure: true }, referencePrefix: "TK" }, null);
      say({ type: "text", text: t(c.lang, "erasure_done", { ref: cs.referenceNo }) });
      return await flush();
    }
    if (id === B.MENU || ["menu", "0", "hi", "hello", "start", "mhoro", "salibonani", "sawubona"].includes(lower)) {
      if (step === "CHAT" && data.chatRef) say({ type: "text", text: t(c.lang, "chat_ended", { ref: data.chatRef }) });
      const draft = inFlow && data.flow ? { flow: data.flow, qi: data.qi || 0, answers: data.answers || {} } : data.draft;
      await toMenu({ draft }); return await flush();
    }
    if (lower === "exit" || lower === "bye") {
      if (inFlow || step === "CHAT") { await save("EXIT_CONFIRM", { ...data, prevStep: step }); say({ type: "buttons", body: t(c.lang, "exit_confirm"), buttons: [{ id: B.DISCARD, title: t(c.lang, "btn_discard") }, { id: B.CONTINUE, title: t(c.lang, "btn_continue") }] }); }
      else { say({ type: "text", text: t(c.lang, "goodbye") }); await save("IDLE", { lang: c.lang }); }
      return await flush();
    }
    if (id === B.OFFICER) { await save("CHAT_TOPIC", { lang: c.lang, draft: data.draft }); say(await categoryPrompt(c, "chat_topic")); return await flush(); }
    if (id === B.TRACK || /^(my requests|status)$/.test(lower)) { await save("TRACK", { lang: c.lang, draft: data.draft }); say(await trackList(c)); return await flush(); }
    const refMatch = REF.exec(text);
    if (refMatch && step !== "VR_BADGE") {
      const k = await prisma.case.findFirst({ where: { referenceNo: refMatch[1].toUpperCase(), orgId }, include: { comments: { where: { isInternal: false }, orderBy: { createdAt: "desc" }, take: 2 } } });
      say(k ? { type: "buttons", body: `${statusLine(c, k)}${k.comments.length ? `\n\n${t(c.lang, "track_latest")}:\n${k.comments.map((m) => `• ${m.body.slice(0, 200)}`).join("\n")}` : ""}`, buttons: [{ id: B.TRACK, title: t(c.lang, "btn_other") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] } : { type: "buttons", body: t(c.lang, "track_notfound", { ref: refMatch[1].toUpperCase() }), buttons: [{ id: B.TRACK, title: t(c.lang, "btn_other") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] });
      return await flush();
    }

    switch (step) {
      case "IDLE":
      case "LANG":
        if (!data.lang) { await save("LANG", data); say(langPrompt()); break; }
        await toMenu(); break;

      case "EXIT_CONFIRM":
        if (id === B.DISCARD) { say({ type: "text", text: t(c.lang, "goodbye") }); await save("IDLE", { lang: c.lang }); }
        else { const back = data.prevStep || "MENU"; await save(back, { ...data, prevStep: undefined }); if (back === "FLOW") say(...(await askCurrent(c))); else if (back === "CHAT") say({ type: "text", text: t(c.lang, "chat_msg_sent") }); else say(mainMenu(c)); }
        break;

      case "MENU":
        if (id === B.STATS) { await save("STATS_TOPIC", { lang: c.lang, draft: data.draft }); say(await statsTopics(c)); }
        else if (id === B.DATA) { say({ type: "text", text: t(c.lang, "dr_intro", { url: wa.odpUrl || "https://data.zimstat.co.zw" }) }); await startFlow(c, "DR", {}); }
        else if (id === B.VERIFY) { await save("VR_KIND", { lang: c.lang, draft: data.draft }); say({ type: "list", header: t(c.lang, "m_verify"), body: t(c.lang, "vr_kind"), button: t(c.lang, "menu_button"), sections: [{ rows: [{ id: B.VR_OFFICER, title: t(c.lang, "vr_officer"), description: t(c.lang, "vr_officer_d") }, { id: B.VR_SURVEY, title: t(c.lang, "vr_survey"), description: t(c.lang, "vr_survey_d") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] }] }); }
        else if (id === B.ALERTS) { say(await releaseCalendar(c)); await save("REL_TOPICS", { lang: c.lang, draft: data.draft, topics: [] }); say(topicsPicker(c, [])); }
        else if (id === B.ENQUIRY) await startFlow(c, "TK", {});
        else if (id === B.CHAT) { await save("CHAT_TOPIC", { lang: c.lang, draft: data.draft }); say(await categoryPrompt(c, "chat_topic")); }
        else if (id === B.RESUME && data.draft) { const d = data.draft; await save("FLOW", { lang: c.lang, flow: d.flow, qi: d.qi, answers: d.answers, tries: 0 }); say(...(await askCurrent(c))); }
        else if (wa.helpText && lower === "help") say({ type: "text", text: wa.helpText });
        else say(mainMenu(c));
        break;

      // ---- 1. latest statistics ----
      case "STATS_TOPIC":
        if (id === B.BACK) { await toMenu(); break; }
        if (id.startsWith("topic_")) { const topic = id.slice(6); await save("STATS_IND", { ...data, topic }); say(await indicatorList(c, topic)); }
        else say(await statsTopics(c));
        break;
      case "STATS_IND": {
        if (id === B.BACK) { await save("STATS_TOPIC", data); say(await statsTopics(c)); break; }
        if (id === B.FILES) { await save("STATS_FILES", data); say(await filesMenu(c, data.topic || "")); break; }
        const ind = id.startsWith("ind_") ? await prisma.statIndicator.findFirst({ where: { id: id.slice(4), orgId, isActive: true } }) : null;
        if (!ind) { say(await indicatorList(c, data.topic || "")); break; }
        await save("STATS_AFTER", { ...data, indicatorId: ind.id });
        const body = [`*${ind.name}*: ${ind.value}`, ind.period ? `${t(c.lang, "stats_period")}: ${ind.period}` : "", ind.releaseDate ? `${t(c.lang, "stats_released")}: ${ind.releaseDate.toISOString().slice(0, 10)}` : "", ind.note || "", ind.url ? `\n${t(c.lang, "stats_odp")}: ${ind.url}` : wa.odpUrl ? `\n${t(c.lang, "stats_odp")}: ${wa.odpUrl}` : ""].filter(Boolean).join("\n");
        say({ type: "text", text: body });
        say(afterMenu(c));
        break;
      }
      case "STATS_AFTER":
        if (id === B.ANOTHER || id === B.BACK) { await save("STATS_IND", data); say(await indicatorList(c, data.topic || "")); }
        else if (id === B.FILES) { await save("STATS_FILES", data); say(await filesMenu(c, data.topic || "")); }
        else if (id === B.GET_ALERTS && data.topic) { await subscribe(c, [data.topic], undefined); say({ type: "buttons", body: t(c.lang, "alerts_added", { topic: topicLabel(data.topic, c.lang) }), buttons: [{ id: B.ANOTHER, title: t(c.lang, "btn_another") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] }); }
        else say(afterMenu(c));
        break;
      case "STATS_FILES": {
        const topic = data.topic || "";
        if (id === B.BACK) { await save("STATS_IND", data); say(await indicatorList(c, topic)); break; }
        const file = await fileMessage(c, topic, id);
        if (!file) { say(await filesMenu(c, topic)); break; }
        await save("STATS_AFTER", data);
        say(file, afterMenu(c));
        break;
      }

      // ---- 2, 3 (concern), 5: question flows ----
      case "FLOW": await onFlowAnswer(c, input, id, text, save); break;
      case "FLOW_SUMMARY":
        if (id === B.SUBMIT) { const flow = FLOWS[data.flow!]; const out = await flow.submit(c, data.answers || {}); if (out.some((m) => m.type === "buttons" && m.buttons.some((b) => b.id === B.EDIT))) { say(...out); break; } await save("MENU", { lang: c.lang }); say(...out); }
        else if (id === B.EDIT) { await save("FLOW_EDIT", data); say(editPicker(c)); }
        else if (id === B.BACK) { const qs = applicable(c); await save("FLOW", { ...data, qi: Math.max(0, qs.length - 1), editing: false }); say(...(await askCurrent(c))); }
        else say(await summary(c));
        break;
      case "FLOW_EDIT":
        if (id.startsWith("edit_")) { const qi = applicable(c).findIndex((q) => q.key === id.slice(5)); if (qi >= 0) { await save("FLOW", { ...data, qi, editing: true, tries: 0 }); say(...(await askCurrent(c))); break; } }
        if (id === B.BACK) { await save("FLOW_SUMMARY", data); say(await summary(c)); break; }
        say(editPicker(c));
        break;

      // ---- 3. verification ----
      case "VR_KIND":
        if (id === B.VR_OFFICER) { await save("VR_BADGE", data); say({ type: "buttons", header: t(c.lang, "vr_officer"), body: t(c.lang, "vr_badge"), buttons: nav(c) }); }
        else if (id === B.VR_SURVEY) {
          const surveys = await prisma.survey.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, take: 9 });
          if (!surveys.length) { say({ type: "buttons", body: t(c.lang, "vr_no_surveys"), buttons: [{ id: B.VR_OFFICER, title: t(c.lang, "vr_officer") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] }); break; }
          await save("VR_SURVEY", data);
          say({ type: "list", header: t(c.lang, "vr_surveys"), body: t(c.lang, "vr_survey_d"), button: t(c.lang, "menu_button"), sections: [{ rows: [...surveys.map((s) => ({ id: `survey_${s.id}`, title: s.name, description: `${s.code}${s.areas ? ` · ${s.areas}` : ""}`.slice(0, 72) })), { id: B.BACK, title: t(c.lang, "btn_back") }] }] });
        } else if (id === B.BACK) await toMenu();
        else say(mainMenu(c));
        break;
      case "VR_BADGE": {
        if (id === B.BACK) { await save("VR_KIND", data); say({ type: "list", header: t(c.lang, "m_verify"), body: t(c.lang, "vr_kind"), button: t(c.lang, "menu_button"), sections: [{ rows: [{ id: B.VR_OFFICER, title: t(c.lang, "vr_officer"), description: t(c.lang, "vr_officer_d") }, { id: B.VR_SURVEY, title: t(c.lang, "vr_survey"), description: t(c.lang, "vr_survey_d") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] }] }); break; }
        if (!text || text.length < 2) { say({ type: "buttons", body: t(c.lang, "vr_badge"), buttons: nav(c) }); break; }
        const badge = text.toUpperCase().replace(/\s+/g, "");
        const now = new Date();
        const officer = await prisma.fieldOfficer.findFirst({ where: { orgId, badgeNo: badge, isActive: true, OR: [{ validFrom: null }, { validFrom: { lte: now } }], AND: [{ OR: [{ validTo: null }, { validTo: { gte: now } }] }] }, include: { survey: { select: { name: true, isActive: true } } } });
        await save("VR_FOUND", { ...data, badge, answers: { badge, officerFound: !!officer } });
        if (officer) say({ type: "buttons", body: t(c.lang, "vr_found", { name: officer.name, role: officer.role || "Enumerator", survey: officer.survey?.name || "—", area: officer.area || "—" }), buttons: [{ id: B.VR_MATCH, title: t(c.lang, "vr_match") }, { id: B.VR_CONCERN, title: t(c.lang, "vr_concern") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] });
        else say({ type: "buttons", body: t(c.lang, "vr_notfound"), buttons: [{ id: B.VR_CONCERN, title: t(c.lang, "vr_concern") }, { id: B.VR_RETRY, title: t(c.lang, "btn_back") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] });
        break;
      }
      case "VR_FOUND":
        if (id === B.VR_MATCH) { say({ type: "buttons", body: t(c.lang, "vr_thanks"), buttons: [{ id: B.MENU, title: t(c.lang, "btn_menu") }] }); await save("MENU", { lang: c.lang, draft: data.draft }); }
        else if (id === B.VR_CONCERN) await startFlow(c, "VR", data.answers || { badge: data.badge });
        else if (id === B.VR_RETRY || id === B.BACK) { await save("VR_BADGE", data); say({ type: "buttons", body: t(c.lang, "vr_badge"), buttons: nav(c) }); }
        else say({ type: "buttons", body: t(c.lang, "unknown"), buttons: [{ id: B.VR_CONCERN, title: t(c.lang, "vr_concern") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] });
        break;
      case "VR_SURVEY": {
        if (id === B.BACK) { await save("VR_KIND", data); say(mainMenu(c)); break; }
        const s = id.startsWith("survey_") ? await prisma.survey.findFirst({ where: { id: id.slice(7), orgId } }) : null;
        if (!s) { say(mainMenu(c)); await save("MENU", data); break; }
        const period = [s.startsOn?.toISOString().slice(0, 10), s.endsOn?.toISOString().slice(0, 10)].filter(Boolean).join(" to ") || "—";
        say({ type: "buttons", body: t(c.lang, "vr_survey_info", { name: s.name, code: s.code, period, areas: s.areas || "—", description: s.description || "" }).slice(0, 1024), buttons: [{ id: B.VR_OFFICER, title: t(c.lang, "vr_officer") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] });
        await save("VR_KIND", data);
        break;
      }

      // ---- 4. release calendar and alerts ----
      case "REL_TOPICS": {
        const chosen = data.topics || [];
        if (id === B.REL_DONE) { if (!chosen.length) { say({ type: "text", text: t(c.lang, "rel_pick_one") }); say(topicsPicker(c, chosen)); break; } await save("REL_FREQ", data); say({ type: "buttons", body: `${t(c.lang, "rel_selected", { topics: chosen.map((k) => topicLabel(k, c.lang)).join(", ") })}\n\n${t(c.lang, "rel_freq")}`, buttons: [{ id: B.REL_EVERY, title: t(c.lang, "rel_every") }, { id: B.REL_MONTHLY, title: t(c.lang, "rel_monthly") }, { id: B.CANCEL, title: t(c.lang, "btn_cancel") }] }); break; }
        if (id.startsWith("topic_")) { const k = id.slice(6); const next = chosen.includes(k) ? chosen.filter((x) => x !== k) : [...chosen, k]; await save("REL_TOPICS", { ...data, topics: next }); say(topicsPicker(c, next)); break; }
        say(topicsPicker(c, chosen));
        break;
      }
      case "REL_FREQ":
        if (id === B.REL_EVERY || id === B.REL_MONTHLY) {
          const freq = id === B.REL_EVERY ? "EVERY" : "MONTHLY";
          await subscribe(c, data.topics || [], freq);
          say({ type: "buttons", body: t(c.lang, "rel_done", { topics: (data.topics || []).map((k) => topicLabel(k, c.lang)).join(", "), freq: t(c.lang, freq === "EVERY" ? "rel_every" : "rel_monthly") }), buttons: [{ id: B.MENU, title: t(c.lang, "btn_menu") }] });
          await save("MENU", { lang: c.lang, draft: data.draft });
        } else { say({ type: "buttons", body: t(c.lang, "rel_freq"), buttons: [{ id: B.REL_EVERY, title: t(c.lang, "rel_every") }, { id: B.REL_MONTHLY, title: t(c.lang, "rel_monthly") }, { id: B.CANCEL, title: t(c.lang, "btn_cancel") }] }); }
        break;

      // ---- 6. live chat ----
      case "CHAT_TOPIC": {
        if (id === B.BACK) { await toMenu(); break; }
        if (id === B.CHAT_LOG) { await startFlow(c, "TK", { category: data.topic, liveChat: true }); break; }
        if (!id.startsWith("cat_")) { say(await categoryPrompt(c, "chat_topic")); break; }
        const cat = await prisma.caseCategory.findFirst({ where: { id: id.slice(4), orgId, isActive: true }, include: { department: { select: { name: true, headUserId: true } } } });
        if (!cat) { say(await categoryPrompt(c, "chat_topic")); break; }
        const hours = officeHours(org);
        if (!hours.open) { await save("CHAT_TOPIC", { ...data, topic: cat.id }); say({ type: "buttons", body: t(c.lang, "chat_closed_hours", { hours: wa.officeHoursNote || hours.label }), buttons: [{ id: B.CHAT_LOG, title: t(c.lang, "chat_log") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] }); break; }
        const recent = await prisma.whatsAppMessage.findMany({ where: { phone, createdAt: { gte: new Date(Date.now() - 3600_000) } }, orderBy: { createdAt: "desc" }, take: 12 });
        const transcriptText = recent.reverse().map((m) => `${m.direction === "IN" ? "User" : "Bot"}: ${m.body.slice(0, 160)}`).join("\n");
        const liveCat = wa.liveChatCategoryId ? await prisma.caseCategory.findFirst({ where: { id: wa.liveChatCategoryId, orgId, isActive: true } }) : null;
        const cs = await createCase(orgId, { title: `Live chat: ${cat.name}`, description: `Live WhatsApp chat requested (${cat.name}). Reply with a public update; it is delivered to the user on WhatsApp. The user's messages arrive as public comments.\n\nConversation so far:\n${transcriptText}`, categoryId: (liveCat || cat).id, priority: "HIGH", source: "WHATSAPP", reporterName: profileName || "WhatsApp user", reporterPhone: `+${phone}`, customFields: { channel: "whatsapp", liveChat: true, language: c.lang }, referencePrefix: "TK" }, null);
        await logMessage({ orgId, phone, direction: "IN", kind: "system", body: `Case ${cs.referenceNo} created (live chat)`, status: "received", caseId: cs.id });
        await save("CHAT", { lang: c.lang, chatCaseId: cs.id, chatRef: cs.referenceNo, draft: data.draft });
        say({ type: "text", text: t(c.lang, "chat_open", { ref: cs.referenceNo }) });
        break;
      }
      case "CHAT": {
        const cs = data.chatCaseId ? await prisma.case.findFirst({ where: { id: data.chatCaseId, orgId } }) : null;
        if (!cs) { await toMenu(); break; }
        if (input.kind === "media") { await attachMedia(c, cs.id, cs.referenceNo, [{ mediaId: input.mediaId, mimeType: input.mimeType, fileName: input.fileName }]); }
        const body = input.kind === "text" ? text : input.kind === "media" ? `[${input.fileName}]${input.caption ? ` ${input.caption}` : ""}` : input.kind === "location" ? `Location: ${input.latitude},${input.longitude}` : "";
        if (!body) { say({ type: "text", text: t(c.lang, "unknown") }); break; }
        await prisma.caseComment.create({ data: { caseId: cs.id, authorName: `${cs.reporterName} (WhatsApp)`, body, isInternal: false } });
        await prisma.case.update({ where: { id: cs.id }, data: { lastActivityAt: new Date() } });
        const who = cs.assigneeId ? [cs.assigneeId] : cs.departmentId ? [(await prisma.department.findUnique({ where: { id: cs.departmentId }, select: { headUserId: true } }))?.headUserId || ""] : [];
        if (who.filter(Boolean).length) await notify(orgId, who.filter(Boolean), { title: `WhatsApp chat ${cs.referenceNo}`, body: body.slice(0, 200), link: `/app/cases?open=${cs.id}`, type: "COMMENT" });
        if (!data.chatAcked) { say({ type: "text", text: t(c.lang, "chat_msg_sent") }); await save("CHAT", { ...data, chatAcked: true }); }
        break;
      }

      // ---- tracking and rating ----
      case "TRACK":
        if (id.startsWith("case_")) {
          const k = await prisma.case.findFirst({ where: { id: id.slice(5), orgId, reporterPhone: { endsWith: phone.slice(-9) } }, include: { comments: { where: { isInternal: false }, orderBy: { createdAt: "desc" }, take: 2 } } });
          if (!k) { say(await trackList(c)); break; }
          const updates = k.comments.map((m) => `• ${m.body.slice(0, 200)}`).join("\n");
          const canRate = ["RESOLVED", "CLOSED"].includes(k.status) && !k.rating;
          await save("TRACK", { ...data, trackCaseId: k.id });
          say({ type: "buttons", body: `${statusLine(c, k)}${updates ? `\n\n${t(c.lang, "track_latest")}:\n${updates}` : ""}`, buttons: [...(canRate ? [{ id: `${B.RATE}${k.id}`, title: t(c.lang, "btn_rate") }] : []), { id: B.TRACK, title: t(c.lang, "btn_other") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] });
        } else if (id.startsWith(B.RATE)) {
          await save("RATE", { ...data, rateCaseId: id.slice(B.RATE.length) });
          say({ type: "list", header: t(c.lang, "rate_header"), body: t(c.lang, "rate_body"), button: t(c.lang, "menu_button"), sections: [{ rows: [5, 4, 3, 2, 1].map((n) => ({ id: `stars_${n}`, title: `${"★".repeat(n)}${"☆".repeat(5 - n)}`, description: ["", "Very poor", "Poor", "Fair", "Good", "Excellent"][n] })) }] });
        } else say(await trackList(c));
        break;
      case "RATE": {
        const m = /^stars_(\d)$/.exec(id);
        if (!m || !data.rateCaseId) { await toMenu(); break; }
        const k = await prisma.case.findFirst({ where: { id: data.rateCaseId, orgId, reporterPhone: { endsWith: phone.slice(-9) } } });
        if (k) await prisma.case.update({ where: { id: k.id }, data: { rating: Number(m[1]), feedback: "Rated via WhatsApp" } });
        await save("MENU", { lang: c.lang, draft: data.draft });
        say({ type: "buttons", body: t(c.lang, "rate_thanks"), buttons: [{ id: B.TRACK, title: t(c.lang, "btn_other") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] });
        break;
      }
    }
  } catch (e) {
    console.error("[whatsapp] bot error", e);
    try { await setStep(phone, "MENU", { lang: "en" }); } catch { /* ignore */ }
    replies.length = 0;
    say({ type: "text", text: t("en", "error") });
    say(langPrompt());
  }
  return await flush();

  async function flush() {
    for (const m of replies) await sendWhatsApp(phoneForFlush, m, { orgId, simulate: opts.simulate });
    return replies;
  }

  // ---------------- flow engine ----------------
  function applicable(c: Ctx): Q[] { const a = c.data.answers || {}; return FLOWS[c.data.flow!].questions.filter((q) => !q.when || q.when(a, c)); }
  async function startFlow(c: Ctx, flow: FlowKey, answers: Answers) {
    await setStepCtx(c, "FLOW", { lang: c.lang, flow, qi: 0, answers, tries: 0 });
    say(...(await askCurrent(c)));
  }
  async function setStepCtx(c: Ctx, s: Step, d: Data) { d.lang = d.lang || c.lang; await setStep(c.phone, s, d, c.profileName); c.data = d; }
  async function askCurrent(c: Ctx): Promise<WaOutgoing[]> {
    const qs = applicable(c);
    const q = qs[c.data.qi || 0];
    if (!q) { await setStepCtx(c, "FLOW_SUMMARY", c.data); return [await summary(c)]; }
    const body = `${q.ask(c)}${c.data.tries ? "" : ""}`;
    if (q.kind === "list") {
      const options = (await q.options!(c)).slice(0, 9).map((o) => ({ id: `ans_${o.id}`, title: o.title, description: o.description }));
      return [{ type: "list", body, button: t(c.lang, "menu_button"), footer: t(c.lang, "menu_footer"), sections: [{ rows: [...options, { id: B.BACK, title: t(c.lang, "btn_back") }] }] }];
    }
    if (q.kind === "buttons") { const options = (await q.options!(c)).slice(0, 2).map((o) => ({ id: `ans_${o.id}`, title: o.title })); return [{ type: "buttons", body, buttons: [...options, { id: B.BACK, title: t(c.lang, "btn_back") }] }]; }
    const extra = q.optional ? [{ id: B.SKIP, title: t(c.lang, q.skipLabel || "btn_skip") }] : [];
    const msgs: WaOutgoing[] = [];
    if (q.kind === "place") msgs.push({ type: "location_request", body });
    msgs.push({ type: "buttons", body: q.kind === "place" ? t(c.lang, "or_type_place") : body, buttons: nav(c, extra) });
    return msgs;
  }
  async function onFlowAnswer(c: Ctx, input: Inbound, id: string, text: string, save: (s: Step, d?: Data) => Promise<void>) {
    const qs = applicable(c);
    const qi = c.data.qi || 0;
    const q = qs[qi];
    if (!q) { await save("FLOW_SUMMARY", c.data); say(await summary(c)); return; }
    const answers = { ...(c.data.answers || {}) };
    const goBack = async () => { if (c.data.editing) { await save("FLOW_SUMMARY", { ...c.data, editing: false }); say(await summary(c)); } else if (qi === 0) { await save("MENU", { lang: c.lang, draft: c.data.draft }); say(mainMenu(c)); } else { await save("FLOW", { ...c.data, qi: qi - 1, tries: 0 }); say(...(await askCurrent(c))); } };
    if (id === B.BACK || ["back", "dzokera", "buyela"].includes(text.toLowerCase())) { await goBack(); return; }
    let value: unknown;
    let error: string | null = null;
    if (id === B.SKIP && q.optional) value = null;
    else if (q.kind === "list" || q.kind === "buttons") {
      if (!id.startsWith("ans_")) { say(...(await askCurrent(c))); return; }
      value = id.slice(4);
      if (q.key === "consent" && value === B.NO) { say({ type: "text", text: t(c.lang, "dr_consent_no") }); await save("MENU", { lang: c.lang }); say(mainMenu(c)); return; }
      const ids = (await q.options!(c)).map((o) => o.id);
      if (!ids.includes(String(value))) error = "unknown";
    } else if (q.kind === "media") {
      if (input.kind === "media") value = { mediaId: input.mediaId, mimeType: input.mimeType, fileName: input.fileName, simulated: c.simulate } satisfies Media;
      else if (text && q.optional) value = null; // typed something instead of sending a file: treat as skip
      else error = "unknown";
    } else if (q.kind === "place") {
      if (input.kind === "location") { value = [input.name, input.address].filter(Boolean).join(", ") || `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}`; answers.latitude = input.latitude; answers.longitude = input.longitude; }
      else if (text) { error = q.validate?.(text, c) || null; value = text.slice(0, 500); }
      else error = "unknown";
    } else {
      if (!text) error = "unknown";
      else { error = q.validate?.(text, c) || null; value = /^none$/i.test(text) && q.key === "org" ? null : text.slice(0, 4000); }
    }
    if (error) {
      const tries = (c.data.tries || 0) + 1;
      await save("FLOW", { ...c.data, tries });
      if (tries >= 3) { say({ type: "buttons", body: `${t(c.lang, error)}\n\n${t(c.lang, "too_many_tries")}`, buttons: [{ id: B.OFFICER, title: t(c.lang, "btn_officer") }, ...nav(c).slice(0, 2)] }); return; }
      say({ type: "text", text: t(c.lang, error) });
      say(...(await askCurrent(c)));
      return;
    }
    answers[q.key] = value;
    if (c.data.editing) { await save("FLOW_SUMMARY", { ...c.data, answers, editing: false, tries: 0 }); say(await summary(c)); return; }
    await save("FLOW", { ...c.data, answers, qi: qi + 1, tries: 0 });
    say(...(await askCurrent(c)));
  }
  async function displayValue(c: Ctx, q: Q, v: unknown): Promise<string> {
    if (v === null || v === undefined || v === "") return t(c.lang, q.optional ? "skipped" : "none");
    if (q.kind === "media") return `${t(c.lang, "attached")}: ${(v as Media).fileName}`;
    if (q.kind === "list" || q.kind === "buttons") { const o = (await q.options!(c)).find((x) => x.id === String(v)); return o?.title || String(v); }
    return String(v);
  }
  async function summary(c: Ctx): Promise<WaOutgoing> {
    const a = c.data.answers || {};
    const lines: string[] = [];
    for (const q of applicable(c)) { if (q.key === "consent") continue; lines.push(`*${t(c.lang, q.label)}:* ${(await displayValue(c, q, a[q.key])).slice(0, 160)}`); }
    return { type: "buttons", header: t(c.lang, "summary_header"), body: lines.join("\n").slice(0, 1024), buttons: [{ id: B.SUBMIT, title: t(c.lang, "btn_submit") }, { id: B.EDIT, title: t(c.lang, "btn_edit") }, { id: B.CANCEL, title: t(c.lang, "btn_cancel") }] };
  }
  function editPicker(c: Ctx): WaOutgoing {
    const a = c.data.answers || {};
    const rows = applicable(c).filter((q) => q.key !== "consent").slice(0, 9).map((q) => ({ id: `edit_${q.key}`, title: t(c.lang, q.label), description: String(a[q.key] && typeof a[q.key] === "object" ? (a[q.key] as Media).fileName : a[q.key] ?? "—").slice(0, 72) }));
    return { type: "list", body: t(c.lang, "summary_edit"), button: t(c.lang, "menu_button"), sections: [{ rows: [...rows, { id: B.BACK, title: t(c.lang, "btn_back") }] }] };
  }

  // ---------------- look-ups ----------------
  async function statsTopics(c: Ctx): Promise<WaOutgoing> {
    const have = await prisma.statIndicator.groupBy({ by: ["topic"], where: { orgId: c.orgId, isActive: true } });
    const keys = new Set(have.map((h) => h.topic));
    const rows = STAT_TOPICS.filter((x) => keys.size === 0 || keys.has(x.key)).map((x) => ({ id: `topic_${x.key}`, title: x[c.lang] || x.en }));
    return { type: "list", header: t(c.lang, "stats_header"), body: t(c.lang, "stats_topic"), button: t(c.lang, "menu_button"), sections: [{ rows: [...rows, { id: B.BACK, title: t(c.lang, "btn_back") }] }] };
  }
  async function indicatorList(c: Ctx, topic: string): Promise<WaOutgoing> {
    const list = await prisma.statIndicator.findMany({ where: { orgId: c.orgId, topic, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], take: 9 });
    if (!list.length) return { type: "buttons", body: t(c.lang, "stats_none"), buttons: [{ id: B.BACK, title: t(c.lang, "btn_back") }, { id: B.OFFICER, title: t(c.lang, "btn_officer") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] };
    return { type: "list", header: topicLabel(topic, c.lang).slice(0, 60), body: t(c.lang, "stats_ind"), button: t(c.lang, "menu_button"), sections: [{ rows: [...list.map((i) => ({ id: `ind_${i.id}`, title: i.name, description: `${i.value}${i.period ? ` · ${i.period}` : ""}`.slice(0, 72) })), { id: B.FILES, title: t(c.lang, "stats_files"), description: t(c.lang, "stats_files_d") }, { id: B.BACK, title: t(c.lang, "btn_back") }] }] };
  }
  function afterMenu(c: Ctx): WaOutgoing {
    return { type: "list", body: t(c.lang, "stats_after"), button: t(c.lang, "menu_button"), sections: [{ rows: [{ id: B.ANOTHER, title: t(c.lang, "btn_another") }, { id: B.FILES, title: t(c.lang, "stats_files"), description: t(c.lang, "stats_files_d") }, { id: B.GET_ALERTS, title: t(c.lang, "btn_alerts") }, { id: B.MENU, title: t(c.lang, "btn_menu") }] }] };
  }
  /** Excel and PDF tables generated from the topic's indicators, plus publications uploaded for the topic (or for all topics). */
  async function filesMenu(c: Ctx, topic: string): Promise<WaOutgoing> {
    const docs = await prisma.statDocument.findMany({ where: { orgId: c.orgId, isActive: true, OR: [{ topic }, { topic: "ALL" }] }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 6 });
    const label = topicLabel(topic, c.lang);
    const size = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
    const rows: Option[] = [
      { id: B.XLSX, title: t(c.lang, "fx_xlsx"), description: t(c.lang, "fx_xlsx_d", { topic: label }) },
      { id: B.PDF, title: t(c.lang, "fx_pdf"), description: t(c.lang, "fx_pdf_d", { topic: label }) },
      ...docs.map((d) => ({ id: `doc_${d.id}`, title: d.title, description: [d.period, extensionOf(d.fileName).toUpperCase(), size(d.size)].filter(Boolean).join(" · ") })),
      { id: B.ALLX, title: t(c.lang, "fx_all"), description: t(c.lang, "fx_all_d") },
      { id: B.BACK, title: t(c.lang, "btn_back") },
    ];
    return { type: "list", header: label.slice(0, 60), body: t(c.lang, "stats_files_body"), button: t(c.lang, "menu_button"), sections: [{ rows }] };
  }
  /** Build the document message for a files-menu choice; the bytes are produced when the message is sent. */
  async function fileMessage(c: Ctx, topic: string, id: string): Promise<WaOutgoing | null> {
    const wa = c.settings.whatsapp || {};
    const orgName = (await prisma.organization.findUnique({ where: { id: c.orgId }, select: { name: true } }))?.name || "";
    const fallback = t(c.lang, "fx_failed", { url: wa.odpUrl || process.env.APP_URL || "" });
    const mk = (source: DocSource, filename: string, caption: string): WaOutgoing => ({ type: "document", filename, caption, source, fallback });
    if (id === B.XLSX || id === B.PDF || id === B.ALLX) {
      const format = id === B.PDF ? "pdf" : "xlsx";
      const tp = id === B.ALLX ? "ALL" : topic;
      const label = id === B.ALLX ? t(c.lang, "stats_header") : topicLabel(topic, c.lang);
      return mk({ kind: "export", orgId: c.orgId, topic: tp, format, lang: c.lang }, exportFilename(orgName, tp, format), t(c.lang, "fx_caption", { topic: label, org: orgName, date: new Date().toISOString().slice(0, 10) }));
    }
    if (id.startsWith("doc_")) {
      const d = await prisma.statDocument.findFirst({ where: { id: id.slice(4), orgId: c.orgId, isActive: true } });
      if (!d) return null;
      await prisma.statDocument.update({ where: { id: d.id }, data: { sentCount: { increment: 1 } } });
      return mk({ kind: "stored", documentId: d.id }, d.fileName, t(c.lang, "fx_doc_caption", { title: d.title, org: orgName }));
    }
    return null;
  }
  async function releaseCalendar(c: Ctx): Promise<WaOutgoing> {
    const next = await prisma.statRelease.findMany({ where: { orgId: c.orgId, publishedAt: null, scheduledAt: { gte: new Date(Date.now() - 86400_000) } }, orderBy: { scheduledAt: "asc" }, take: 5 });
    const body = next.length ? `*${t(c.lang, "rel_header")}*\n${t(c.lang, "rel_next")}\n${next.map((r) => `• ${r.scheduledAt.toISOString().slice(0, 10)} · ${r.title}`).join("\n")}` : t(c.lang, "rel_none");
    return { type: "text", text: body };
  }
  function topicsPicker(c: Ctx, chosen: string[]): WaOutgoing {
    const rows = STAT_TOPICS.map((x) => ({ id: `topic_${x.key}`, title: `${chosen.includes(x.key) ? "✅ " : ""}${x[c.lang] || x.en}` }));
    return { type: "list", header: t(c.lang, "m_alerts").slice(0, 60), body: `${t(c.lang, "rel_topics")}${chosen.length ? `\n\n${t(c.lang, "rel_selected", { topics: chosen.map((k) => topicLabel(k, c.lang)).join(", ") })}` : ""}`, button: t(c.lang, "menu_button"), sections: [{ rows: [...rows, { id: B.REL_DONE, title: `✔ ${t(c.lang, "btn_done")}` }, { id: B.CANCEL, title: t(c.lang, "btn_cancel") }] }] };
  }
  async function subscribe(c: Ctx, topics: string[], frequency: string | undefined) {
    const existing = await prisma.statSubscription.findUnique({ where: { orgId_phone: { orgId: c.orgId, phone: c.phone } } });
    const merged = Array.from(new Set([...(existing && existing.isActive ? parseJson<string[]>(existing.topics, []) : []), ...topics]));
    if (existing) await prisma.statSubscription.update({ where: { id: existing.id }, data: { topics: toJson(merged), frequency: frequency || existing.frequency, language: c.lang, isActive: true } });
    else await prisma.statSubscription.create({ data: { orgId: c.orgId, phone: c.phone, topics: toJson(merged), frequency: frequency || "EVERY", language: c.lang } });
  }
  async function categoryPrompt(c: Ctx, bodyKey: string): Promise<WaOutgoing> {
    const cats = await publicCategories(c);
    return { type: "list", header: t(c.lang, "m_chat").slice(0, 60), body: t(c.lang, bodyKey), button: t(c.lang, "menu_button"), sections: [{ rows: [...cats.map((x) => ({ id: `cat_${x.id}`, title: x.title, description: x.description })), { id: B.BACK, title: t(c.lang, "btn_back") }] }] };
  }
}

async function setStep(phone: string, step: Step, data: Data, profileName?: string | null) {
  return prisma.whatsAppSession.update({ where: { phone }, data: { step, data: toJson(data), lastInteractionAt: new Date(), ...(profileName ? { profileName } : {}) } });
}

export const transcript = describe;
