// List-and-button driven WhatsApp conversation for the service desk (report / track an issue) and licensing
// (apply for a licence / check an application). Free text is only used where a description, name or address is
// needed. State is kept per phone in WhatsAppSession.
import { prisma } from "../prisma";
import { parseJson, toJson } from "../json";
import { caseSettings, createCase } from "../cases";
import { CASE_STATUS_LABELS, type CaseStatus } from "../caseTypes";
import { LICENCE_STATUS_LABELS, type LicenceStatus } from "../licenceTypes";
import { createLicenceApplication, notifyApplicant, paymentState, phoneTail, recordLicencePayment } from "../licensing";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "../licenceTypes";
import { describe, logMessage, normalizePhone, sendWhatsApp, type WaOutgoing } from "./client";

export type Inbound =
  | { kind: "text"; text: string }
  | { kind: "button"; id: string; title?: string }
  | { kind: "list"; id: string; title?: string }
  | { kind: "location"; latitude: number; longitude: number; name?: string; address?: string }
  | { kind: "other" };

type Step = "IDLE" | "MENU" | "CATEGORY" | "DESCRIBE" | "LOCATION" | "NAME" | "CONFIRM" | "TRACK" | "RATE"
  | "LIC_TYPE" | "LIC_NAME" | "LIC_TRADING" | "LIC_PREMISES" | "LIC_WARD" | "LIC_ACTIVITY" | "LIC_CONFIRM" | "LIC_TRACK" | "LIC_PAY_METHOD" | "LIC_PAY_REF";
type Data = {
  categoryId?: string; categoryName?: string; description?: string; latitude?: number; longitude?: number; locationAddress?: string; name?: string; trackCaseId?: string; rateCaseId?: string; page?: number;
  licTypeId?: string; licTypeName?: string; licFee?: string; licRequirements?: string[]; licRequiresInspection?: boolean; applicant?: string; trading?: string; premises?: string; ward?: string; activity?: string; payLicId?: string; payMethod?: string; payAmount?: number;
};

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const B = {
  REPORT: "menu_report", TRACK: "menu_track", HELP: "menu_help", MENU: "go_menu", CANCEL: "go_cancel", APPLY: "menu_apply", LIC_TRACK: "menu_lictrack",
  LOC_SKIP: "loc_skip", NAME_OK: "name_ok", NAME_ANON: "name_anon", CONFIRM: "confirm_yes", MORE: "cat_more", RATE: "rate_", BACK: "track_back",
  TRADING_SKIP: "trading_skip", WARD_SKIP: "ward_skip", LIC_CONFIRM: "lic_confirm", PAY: "licpay_",
};

const menu = (greeting: string): WaOutgoing => ({
  type: "list", header: "Main menu", body: greeting, button: "Choose",
  sections: [
    { title: "Service desk", rows: [{ id: B.REPORT, title: "Report an issue", description: "Water, roads, refuse, complaints" }, { id: B.TRACK, title: "Track a report", description: "Progress of your reports" }] },
    { title: "Licences & permits", rows: [{ id: B.APPLY, title: "Apply for a licence", description: "Shop, liquor, hawker, food, building and more" }, { id: B.LIC_TRACK, title: "My licence applications", description: "Status, fees due, licence numbers" }] },
    { title: "More", rows: [{ id: B.HELP, title: "Help", description: "Contact details and office hours" }] },
  ],
});
const backToMenu = { id: B.MENU, title: "Main menu" };

async function categoryList(orgId: string, page: number): Promise<WaOutgoing> {
  const cats = await prisma.caseCategory.findMany({ where: { orgId, isActive: true, isPublic: true }, orderBy: { name: "asc" }, select: { id: true, name: true, description: true, defaultSlaHours: true } });
  const pageSize = 9;
  const slice = cats.slice(page * pageSize, page * pageSize + pageSize);
  const rows = slice.map((c) => ({ id: `cat_${c.id}`, title: c.name, description: (c.description || `${c.defaultSlaHours}h target`).slice(0, 72) }));
  if (cats.length > (page + 1) * pageSize) rows.push({ id: B.MORE, title: "More categories…", description: "" });
  return { type: "list", header: "What is it about?", body: "Pick the category that fits best.", button: "Choose", sections: [{ rows }], footer: "Reply Cancel at any time" };
}

async function licenceTypeList(orgId: string, page: number): Promise<WaOutgoing> {
  const types = await prisma.licenceType.findMany({ where: { orgId, isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, name: true, fee: true, currency: true, validityMonths: true } });
  const pageSize = 9;
  const slice = types.slice(page * pageSize, page * pageSize + pageSize);
  const rows = slice.map((t) => ({ id: `lt_${t.id}`, title: t.name.slice(0, 24), description: `${t.currency} ${Number(t.fee).toFixed(2)} · ${t.validityMonths} months`.slice(0, 72) }));
  if (types.length > (page + 1) * pageSize) rows.push({ id: B.MORE, title: "More licences…", description: "" });
  return { type: "list", header: "Which licence?", body: "Choose the licence or permit you are applying for. Fees are payable only once the application is approved.", button: "Choose", sections: [{ rows }], footer: "Reply Cancel at any time" };
}

const statusLine = (c: { referenceNo: string; title: string; status: string; slaDueAt: Date | null; resolvedAt: Date | null }) =>
  `*${c.referenceNo}* · ${CASE_STATUS_LABELS[c.status as CaseStatus] || c.status}\n${c.title}${c.resolvedAt ? `\nResolved ${c.resolvedAt.toDateString()}` : c.slaDueAt ? `\nTarget ${c.slaDueAt.toDateString()}` : ""}`;

type LicForBot = { id: string; referenceNo: string; licenceNo: string | null; status: string; feeAmount: unknown; currency: string; paidAt: Date | null; expiresAt: Date | null; inspectionDue: Date | null; decisionNote: string | null; type: { name: string }; documents: unknown; payments: { amount: unknown; status: string }[] };
const feeDue = (l: LicForBot) => { const p = paymentState({ feeAmount: Number(l.feeAmount), payments: l.payments.map((x) => ({ amount: Number(x.amount), status: x.status })) }); return { ...p, canPay: l.status === "APPROVED" && !p.settled && p.pending === 0 }; };
const licenceLine = (l: LicForBot) => {
  const docs = (l.documents as { name: string; received: boolean }[]) || [];
  const missing = docs.filter((d) => !d.received).map((d) => d.name);
  const lines = [`*${l.licenceNo || l.referenceNo}* · ${LICENCE_STATUS_LABELS[l.status as LicenceStatus] || l.status}`, l.type.name];
  const pay = feeDue(l);
  if (l.status === "APPROVED" && pay.settled) lines.push("Payment confirmed. The licence is being issued.");
  else if (l.status === "APPROVED" && pay.pending > 0) lines.push(`Payment of ${l.currency} ${pay.pending.toFixed(2)} reported, awaiting confirmation by Finance.`);
  else if (l.status === "APPROVED") lines.push(`Fee due: ${l.currency} ${pay.outstanding.toFixed(2)} — pay at the council cashier, by EcoCash or bank transfer quoting ${l.referenceNo}, then tap *I have paid* to send the reference.`);
  if (l.status === "INSPECTION" && l.inspectionDue) lines.push(`Inspection due by ${l.inspectionDue.toDateString()}.`);
  if (l.status === "ISSUED" && l.expiresAt) lines.push(`Valid until ${l.expiresAt.toDateString()}.`);
  if (l.status === "REJECTED" && l.decisionNote) lines.push(`Reason: ${l.decisionNote.slice(0, 300)}`);
  if (["SUBMITTED", "UNDER_REVIEW", "INSPECTION"].includes(l.status) && missing.length) lines.push(`Documents still needed: ${missing.join("; ")}.`);
  return lines.join("\n");
};

/**
 * Process one inbound message and return the replies. `send` decides whether replies go to Meta or only into the log
 * (simulator). Never throws: any failure resets the session and answers with the menu.
 */
export async function handleInbound(orgId: string, rawPhone: string, profileName: string | null, input: Inbound, opts: { simulate?: boolean } = {}): Promise<WaOutgoing[]> {
  const phone = normalizePhone(rawPhone);
  const settings = await caseSettings(orgId);
  const wa = settings.whatsapp || {};
  const greeting = wa.greeting || "Welcome to the Municipality of Chitungwiza. How can we help you today?";
  const replies: WaOutgoing[] = [];
  const say = (m: WaOutgoing) => replies.push(m);
  try {
    if (wa.enabled === false) {
      say({ type: "text", text: wa.helpText || "WhatsApp services are not available at the moment. Please use the website or call the office." });
      return await flush();
    }
    let session = await prisma.whatsAppSession.findUnique({ where: { phone } });
    if (!session) session = await prisma.whatsAppSession.create({ data: { orgId, phone, profileName, step: "IDLE", data: "{}" } });
    if (Date.now() - session.lastInteractionAt.getTime() > SESSION_TTL_MS && session.step !== "IDLE") session = await setStep(phone, "IDLE", {});
    let step = session.step as Step;
    let data = parseJson<Data>(session.data, {});
    const save = async (s: Step, d: Data = data) => { session = await setStep(phone, s, d, profileName); step = s; data = d; };

    const id = input.kind === "button" || input.kind === "list" ? input.id : "";
    const text = input.kind === "text" ? input.text.trim() : "";
    const lower = text.toLowerCase();

    // global commands and shortcuts
    if (id === B.CANCEL || ["cancel", "stop", "exit"].includes(lower)) { await save("MENU", {}); say({ type: "text", text: "Cancelled." }); say(menu(greeting)); return await flush(); }
    if (id === B.MENU || ["menu", "hi", "hello", "start", "mhoro", "salibonani"].includes(lower)) { await save("MENU", {}); say(menu(greeting)); return await flush(); }
    if (id === B.APPLY || ["licence", "license", "apply", "permit"].includes(lower)) { await save("LIC_TYPE", { page: 0 }); say(await licenceTypeList(orgId, 0)); return await flush(); }
    if (id === B.LIC_TRACK || ["my licences", "my licenses", "licence status"].includes(lower)) { say(await licenceList(orgId, phone)); await save("LIC_TRACK", {}); return await flush(); }

    switch (step) {
      case "IDLE":
        await save("MENU", {});
        say(menu(greeting));
        break;

      case "MENU":
        if (id === B.REPORT) { await save("CATEGORY", { page: 0 }); say(await categoryList(orgId, 0)); }
        else if (id === B.TRACK) { say(await trackList(orgId, phone)); await save("TRACK", {}); }
        else if (id === B.HELP) { say({ type: "buttons", body: wa.helpText || `${settings.contactEmail ? `Email ${settings.contactEmail}. ` : ""}${settings.contactPhone ? `Call ${settings.contactPhone}. ` : ""}Use the menu to report an issue, track a report, or apply for a licence.`, buttons: [{ id: B.REPORT, title: "Report an issue" }, { id: B.APPLY, title: "Apply for a licence" }, backToMenu] }); }
        else say(menu(greeting));
        break;

      // ---------------- service desk ----------------
      case "CATEGORY":
        if (id === B.MORE) { const page = (data.page || 0) + 1; await save("CATEGORY", { ...data, page }); say(await categoryList(orgId, page)); }
        else if (id.startsWith("cat_")) {
          const cat = await prisma.caseCategory.findFirst({ where: { id: id.slice(4), orgId, isActive: true, isPublic: true } });
          if (!cat) { say(await categoryList(orgId, 0)); break; }
          await save("DESCRIBE", { categoryId: cat.id, categoryName: cat.name });
          say({ type: "buttons", header: cat.name, body: "In one message, describe the issue or request (what, where and since when).", buttons: [{ id: B.CANCEL, title: "Cancel" }] });
        } else say(await categoryList(orgId, data.page || 0));
        break;

      case "DESCRIBE":
        if (text.length < 5) { say({ type: "buttons", body: "Please type a short description of the issue (at least a few words).", buttons: [{ id: B.CANCEL, title: "Cancel" }] }); break; }
        await save("LOCATION", { ...data, description: text.slice(0, 4000) });
        say({ type: "location_request", body: "Where is it? Share your location, or tap Skip." });
        say({ type: "buttons", body: "No location to share?", buttons: [{ id: B.LOC_SKIP, title: "Skip" }, { id: B.CANCEL, title: "Cancel" }] });
        break;

      case "LOCATION":
        if (input.kind === "location") data = { ...data, latitude: input.latitude, longitude: input.longitude, locationAddress: [input.name, input.address].filter(Boolean).join(", ") || undefined };
        else if (id !== B.LOC_SKIP && text) data = { ...data, locationAddress: text.slice(0, 500) };
        else if (id !== B.LOC_SKIP) { say({ type: "buttons", body: "Share your location, type the place, or tap Skip.", buttons: [{ id: B.LOC_SKIP, title: "Skip" }, { id: B.CANCEL, title: "Cancel" }] }); break; }
        await save("NAME", data);
        say({ type: "buttons", body: profileName ? `Report as *${profileName}*?` : "Please tell us your name, or continue anonymously.", buttons: [...(profileName ? [{ id: B.NAME_OK, title: `Yes, ${profileName}`.slice(0, 20) }] : []), { id: B.NAME_ANON, title: "Stay anonymous" }, { id: B.CANCEL, title: "Cancel" }] });
        break;

      case "NAME": {
        if (id === B.NAME_OK) data = { ...data, name: profileName || "WhatsApp user" };
        else if (id === B.NAME_ANON) data = { ...data, name: "Anonymous (WhatsApp)" };
        else if (text) data = { ...data, name: text.slice(0, 120) };
        else { say({ type: "buttons", body: "Type your name or choose an option.", buttons: [{ id: B.NAME_ANON, title: "Stay anonymous" }, { id: B.CANCEL, title: "Cancel" }] }); break; }
        await save("CONFIRM", data);
        say({ type: "buttons", header: "Confirm your report", body: `*Category:* ${data.categoryName}\n*Details:* ${data.description}\n*Location:* ${data.locationAddress || (data.latitude ? "shared" : "not given")}\n*Name:* ${data.name}`, buttons: [{ id: B.CONFIRM, title: "Submit" }, { id: B.CANCEL, title: "Cancel" }] });
        break;
      }

      case "CONFIRM":
        if (id !== B.CONFIRM) { say({ type: "buttons", body: "Submit this report?", buttons: [{ id: B.CONFIRM, title: "Submit" }, { id: B.CANCEL, title: "Cancel" }] }); break; }
        {
          const c = await createCase(orgId, {
            title: (data.description || "").split(/[.\n]/)[0].slice(0, 120) || data.categoryName || "WhatsApp report",
            description: data.description || "", categoryId: data.categoryId, reporterName: data.name || "WhatsApp user", reporterPhone: `+${phone}`,
            source: "WHATSAPP", locationAddress: data.locationAddress || null, latitude: data.latitude ?? null, longitude: data.longitude ?? null,
          }, null);
          await logMessage({ orgId, phone, direction: "IN", kind: "system", body: `Case ${c.referenceNo} created`, status: "received", caseId: c.id });
          await save("MENU", {});
          say({ type: "buttons", header: "Report received", body: `Your reference is *${c.referenceNo}*. Our target is to attend to it within ${c.slaHours} hours. We will message you here when it progresses.`, buttons: [{ id: B.TRACK, title: "Track a report" }, backToMenu] });
        }
        break;

      case "TRACK":
        if (id.startsWith("case_")) {
          const c = await prisma.case.findFirst({ where: { id: id.slice(5), orgId, reporterPhone: { endsWith: phone.slice(-9) } }, include: { comments: { where: { isInternal: false }, orderBy: { createdAt: "desc" }, take: 2 } } });
          if (!c) { say(await trackList(orgId, phone)); break; }
          const updates = c.comments.map((m) => `• ${m.body.slice(0, 200)}`).join("\n");
          const canRate = ["RESOLVED", "CLOSED"].includes(c.status) && !c.rating;
          await save("TRACK", { ...data, trackCaseId: c.id });
          say({ type: "buttons", body: `${statusLine(c)}${updates ? `\n\nLatest updates:\n${updates}` : ""}`, buttons: [...(canRate ? [{ id: `${B.RATE}${c.id}`, title: "Rate the service" }] : []), { id: B.TRACK, title: "Other reports" }, backToMenu] });
        } else if (id.startsWith(B.RATE)) {
          await save("RATE", { ...data, rateCaseId: id.slice(B.RATE.length) });
          say({ type: "list", header: "Rate the service", body: "How satisfied are you with how this was handled?", button: "Choose", sections: [{ rows: [5, 4, 3, 2, 1].map((n) => ({ id: `stars_${n}`, title: `${"★".repeat(n)}${"☆".repeat(5 - n)}`, description: ["", "Very poor", "Poor", "Fair", "Good", "Excellent"][n] })) }] });
        } else if (id === B.TRACK || id === B.BACK) { say(await trackList(orgId, phone)); }
        else if (/^[A-Z0-9]{1,6}-\d{4}-\d{4,6}$/i.test(text)) {
          const c = await prisma.case.findFirst({ where: { referenceNo: text.toUpperCase(), orgId } });
          say(c ? { type: "buttons", body: statusLine(c), buttons: [{ id: B.TRACK, title: "My reports" }, backToMenu] } : { type: "buttons", body: "No report found with that reference.", buttons: [{ id: B.TRACK, title: "My reports" }, backToMenu] });
        } else say(await trackList(orgId, phone));
        break;

      case "RATE": {
        const m = /^stars_(\d)$/.exec(id);
        if (!m || !data.rateCaseId) { say(menu(greeting)); await save("MENU", {}); break; }
        const c = await prisma.case.findFirst({ where: { id: data.rateCaseId, orgId, reporterPhone: { endsWith: phone.slice(-9) } } });
        if (c) await prisma.case.update({ where: { id: c.id }, data: { rating: Number(m[1]), feedback: "Rated via WhatsApp" } });
        await save("MENU", {});
        say({ type: "buttons", body: "Thank you for your feedback.", buttons: [{ id: B.TRACK, title: "Track a report" }, backToMenu] });
        break;
      }

      // ---------------- licensing ----------------
      case "LIC_TYPE":
        if (id === B.MORE) { const page = (data.page || 0) + 1; await save("LIC_TYPE", { ...data, page }); say(await licenceTypeList(orgId, page)); }
        else if (id.startsWith("lt_")) {
          const t = await prisma.licenceType.findFirst({ where: { id: id.slice(3), orgId, isActive: true } });
          if (!t) { say(await licenceTypeList(orgId, 0)); break; }
          const reqs = (t.requirements as string[]) || [];
          await save("LIC_NAME", { licTypeId: t.id, licTypeName: t.name, licFee: `${t.currency} ${Number(t.fee).toFixed(2)}`, licRequirements: reqs, licRequiresInspection: t.requiresInspection });
          say({ type: "text", text: `*${t.name}*\nFee ${t.currency} ${Number(t.fee).toFixed(2)}, valid ${t.validityMonths} months.${t.requiresInspection ? " The premises are inspected before approval." : ""}${reqs.length ? `\n\nYou will need:\n${reqs.map((r) => `• ${r}`).join("\n")}` : ""}` });
          say({ type: "buttons", body: profileName ? `Apply in the name *${profileName}*? Or type the full name of the applicant (as on the national ID or company registration).` : "Type the full name of the applicant (as on the national ID or company registration).", buttons: [...(profileName ? [{ id: B.NAME_OK, title: `Yes, ${profileName}`.slice(0, 20) }] : []), { id: B.CANCEL, title: "Cancel" }] });
        } else say(await licenceTypeList(orgId, data.page || 0));
        break;

      case "LIC_NAME":
        if (id === B.NAME_OK) data = { ...data, applicant: profileName || "WhatsApp applicant" };
        else if (text.length >= 2) data = { ...data, applicant: text.slice(0, 160) };
        else { say({ type: "buttons", body: "Please type the full name of the applicant.", buttons: [{ id: B.CANCEL, title: "Cancel" }] }); break; }
        await save("LIC_TRADING", data);
        say({ type: "buttons", body: "What is the trading name of the business? (Tap Skip if it trades under your own name.)", buttons: [{ id: B.TRADING_SKIP, title: "Skip" }, { id: B.CANCEL, title: "Cancel" }] });
        break;

      case "LIC_TRADING":
        if (id === B.TRADING_SKIP) data = { ...data, trading: undefined };
        else if (text) data = { ...data, trading: text.slice(0, 160) };
        else { say({ type: "buttons", body: "Type the trading name or tap Skip.", buttons: [{ id: B.TRADING_SKIP, title: "Skip" }, { id: B.CANCEL, title: "Cancel" }] }); break; }
        await save("LIC_PREMISES", data);
        say({ type: "buttons", body: "Where are the premises? Give the stand number and address (e.g. Stand 1120 Zengeza 4, Shop 3).", buttons: [{ id: B.CANCEL, title: "Cancel" }] });
        break;

      case "LIC_PREMISES":
        if (text.length < 3) { say({ type: "buttons", body: "Please type the stand number and address of the premises.", buttons: [{ id: B.CANCEL, title: "Cancel" }] }); break; }
        await save("LIC_WARD", { ...data, premises: text.slice(0, 255) });
        say({ type: "list", header: "Which ward?", body: "Choose the ward the premises are in, or skip.", button: "Ward", sections: [{ rows: [...Array.from({ length: 9 }, (_, i) => ({ id: `ward_${i + 1}`, title: `Ward ${i + 1}` })), { id: B.WARD_SKIP, title: "Not sure / other" }] }] });
        break;

      case "LIC_WARD":
        if (id.startsWith("ward_")) data = { ...data, ward: id.slice(5) };
        else if (id === B.WARD_SKIP) data = { ...data, ward: undefined };
        else if (/^\d{1,2}$/.test(text)) data = { ...data, ward: text };
        else { say({ type: "buttons", body: "Choose a ward from the list, type the ward number, or skip.", buttons: [{ id: B.WARD_SKIP, title: "Skip" }, { id: B.CANCEL, title: "Cancel" }] }); break; }
        await save("LIC_ACTIVITY", data);
        say({ type: "buttons", body: "Describe the business or purpose in one message (what you sell or do, trading hours, number of employees).", buttons: [{ id: B.CANCEL, title: "Cancel" }] });
        break;

      case "LIC_ACTIVITY":
        if (text.length < 5) { say({ type: "buttons", body: "Please describe the business in a few words.", buttons: [{ id: B.CANCEL, title: "Cancel" }] }); break; }
        await save("LIC_CONFIRM", { ...data, activity: text.slice(0, 4000) });
        say({ type: "buttons", header: "Confirm your application", body: `*Licence:* ${data.licTypeName} (${data.licFee})\n*Applicant:* ${data.applicant}${data.trading ? `\n*Trading as:* ${data.trading}` : ""}\n*Premises:* ${data.premises}${data.ward ? `, Ward ${data.ward}` : ""}\n*Business:* ${text.slice(0, 300)}\n\nBy submitting you declare that the information is true and that you will comply with council by-laws.`, buttons: [{ id: B.LIC_CONFIRM, title: "Submit" }, { id: B.CANCEL, title: "Cancel" }] });
        break;

      case "LIC_CONFIRM":
        if (id !== B.LIC_CONFIRM) { say({ type: "buttons", body: "Submit this application?", buttons: [{ id: B.LIC_CONFIRM, title: "Submit" }, { id: B.CANCEL, title: "Cancel" }] }); break; }
        {
          if (!data.licTypeId || !data.applicant) { await save("LIC_TYPE", { page: 0 }); say(await licenceTypeList(orgId, 0)); break; }
          const stand = /^(?:stand\s*)?([A-Za-z0-9/-]+)/i.exec(data.premises || "")?.[1] || null;
          const l = await createLicenceApplication(orgId, { typeId: data.licTypeId, applicantName: data.applicant, tradingName: data.trading || null, phone: `+${phone}`, standNumber: stand, address: data.premises || null, ward: data.ward || null, activity: data.activity || null }, { actorId: null, source: "WHATSAPP" });
          await logMessage({ orgId, phone, direction: "IN", kind: "system", body: `Licence application ${l.referenceNo} created`, status: "received" });
          const reqs = data.licRequirements || [];
          const fee = data.licFee;
          const inspected = !!data.licRequiresInspection;
          await save("MENU", {});
          say({ type: "buttons", header: "Application received", body: `Your reference is *${l.referenceNo}*.${reqs.length ? `\n\nPlease bring these documents to the licensing office at the Town House, or upload them at ${process.env.APP_URL || ""}/verify using this reference and your phone number:\n${reqs.map((r) => `• ${r}`).join("\n")}` : ""}${inspected ? "\n\nAn officer will contact you to inspect the premises." : ""}\n\nThe fee of ${fee} is payable at the cashier once the application is approved. We will message you here at each step.`, buttons: [{ id: B.LIC_TRACK, title: "My applications" }, backToMenu] });
        }
        break;

      case "LIC_TRACK":
        if (id.startsWith(B.PAY)) {
          const l = await prisma.licence.findFirst({ where: { id: id.slice(B.PAY.length), orgId }, include: { type: { select: { name: true } }, payments: { select: { amount: true, status: true } } } });
          if (!l || phoneTail(l.phone) !== phone.slice(-9) || !feeDue(l).canPay) { say(await licenceList(orgId, phone)); break; }
          await save("LIC_PAY_METHOD", { payLicId: l.id, payAmount: feeDue(l).outstanding });
          say({ type: "list", header: "How did you pay?", body: `${l.referenceNo}: fee ${l.currency} ${feeDue(l).outstanding.toFixed(2)}. Choose the payment method.`, button: "Method", sections: [{ rows: (["ECOCASH", "BANK_TRANSFER", "CASH", "POS", "OTHER"] as PaymentMethod[]).map((m) => ({ id: `pm_${m}`, title: PAYMENT_METHOD_LABELS[m].slice(0, 24) })) }], footer: "Reply Cancel to go back" });
        } else if (id.startsWith("lic_")) {
          const l = await prisma.licence.findFirst({ where: { id: id.slice(4), orgId }, include: { type: { select: { name: true } }, payments: { select: { amount: true, status: true } } } });
          if (!l || phoneTail(l.phone) !== phone.slice(-9)) { say(await licenceList(orgId, phone)); break; }
          say({ type: "buttons", body: licenceLine(l), buttons: [...(feeDue(l).canPay ? [{ id: `${B.PAY}${l.id}`, title: "I have paid" }] : []), { id: B.LIC_TRACK, title: "My applications" }, backToMenu] });
        } else if (/^(LA-\d{4}-\d{4,6}|[A-Z]{2,6}\/[A-Z0-9]{2,8}\/\d{4}\/\d{4,6})$/i.test(text)) {
          const l = await prisma.licence.findFirst({ where: { orgId, OR: [{ referenceNo: text.toUpperCase() }, { licenceNo: text.toUpperCase() }] }, include: { type: { select: { name: true } }, payments: { select: { amount: true, status: true } } } });
          say(l && phoneTail(l.phone) === phone.slice(-9) ? { type: "buttons", body: licenceLine(l), buttons: [...(feeDue(l).canPay ? [{ id: `${B.PAY}${l.id}`, title: "I have paid" }] : []), { id: B.LIC_TRACK, title: "My applications" }, backToMenu] } : { type: "buttons", body: "No application from this number with that reference.", buttons: [{ id: B.LIC_TRACK, title: "My applications" }, backToMenu] });
        } else say(await licenceList(orgId, phone));
        break;

      case "LIC_PAY_METHOD":
        if (!id.startsWith("pm_")) { say({ type: "buttons", body: "Choose the payment method from the list, or cancel.", buttons: [{ id: B.CANCEL, title: "Cancel" }] }); break; }
        await save("LIC_PAY_REF", { ...data, payMethod: id.slice(3) });
        say({ type: "buttons", body: data.payMethod === "CASH" || id === "pm_CASH" ? "Type the receipt number from the cashier." : "Type the transaction reference (for EcoCash, the confirmation code in the SMS; for a bank transfer, the reference on the proof of payment).", buttons: [{ id: B.CANCEL, title: "Cancel" }] });
        break;

      case "LIC_PAY_REF": {
        if (text.length < 3) { say({ type: "buttons", body: "Please type the receipt number or transaction reference.", buttons: [{ id: B.CANCEL, title: "Cancel" }] }); break; }
        const l = await prisma.licence.findFirst({ where: { id: data.payLicId || "", orgId }, include: { type: { select: { name: true, departmentId: true } }, payments: { select: { amount: true, status: true } } } });
        if (!l || phoneTail(l.phone) !== phone.slice(-9)) { await save("MENU", {}); say(menu(greeting)); break; }
        await recordLicencePayment(l, { amount: data.payAmount || feeDue(l).outstanding, method: (data.payMethod || "OTHER") as PaymentMethod, reference: text.slice(0, 80), payerName: l.applicantName }, { id: null, name: l.applicantName });
        await save("MENU", {});
        say({ type: "buttons", header: "Payment details received", body: `Thank you. Finance will match reference *${text.slice(0, 80)}* against the cashbook and confirm. We will message you here, and the licence is then issued.`, buttons: [{ id: B.LIC_TRACK, title: "My applications" }, backToMenu] });
        void notifyApplicant(l, "payment_received");
        break;
      }
    }
  } catch (e) {
    console.error("[whatsapp] bot error", e);
    try { await setStep(phone, "MENU", {}); } catch { /* ignore */ }
    replies.length = 0;
    say({ type: "text", text: "Sorry, something went wrong on our side. Let's start again." });
    say(menu(greeting));
  }
  return await flush();

  async function flush() {
    for (const m of replies) await sendWhatsApp(phone, m, { orgId, simulate: opts.simulate });
    return replies;
  }
}

async function setStep(phone: string, step: Step, data: Data, profileName?: string | null) {
  return prisma.whatsAppSession.update({ where: { phone }, data: { step, data: toJson(data), lastInteractionAt: new Date(), ...(profileName ? { profileName } : {}) } });
}

async function trackList(orgId: string, phone: string): Promise<WaOutgoing> {
  const cases = await prisma.case.findMany({ where: { orgId, reporterPhone: { endsWith: phone.slice(-9) } }, orderBy: { createdAt: "desc" }, take: 9, select: { id: true, referenceNo: true, title: true, status: true } });
  if (!cases.length) return { type: "buttons", body: "We have no reports from this number yet. You can also type a reference number (e.g. CMC-2026-0001).", buttons: [{ id: B.REPORT, title: "Report an issue" }, backToMenu] };
  return { type: "list", header: "Your reports", body: "Choose a report to see its progress, or type a reference number.", button: "My reports", sections: [{ rows: cases.map((c) => ({ id: `case_${c.id}`, title: c.referenceNo, description: `${CASE_STATUS_LABELS[c.status as CaseStatus] || c.status} · ${c.title}`.slice(0, 72) })) }] };
}

async function licenceList(orgId: string, phone: string): Promise<WaOutgoing> {
  const list = await prisma.licence.findMany({ where: { orgId, phone: { endsWith: phone.slice(-9) } }, orderBy: { createdAt: "desc" }, take: 9, include: { type: { select: { name: true } } } });
  if (!list.length) return { type: "buttons", body: "We have no licence applications from this number yet. You can also type an application reference (e.g. LA-2026-0001) or a licence number.", buttons: [{ id: B.APPLY, title: "Apply for a licence" }, backToMenu] };
  return { type: "list", header: "Your licence applications", body: "Choose one to see its status, or type a reference number.", button: "My applications", sections: [{ rows: list.map((l) => ({ id: `lic_${l.id}`, title: (l.licenceNo || l.referenceNo).slice(0, 24), description: `${LICENCE_STATUS_LABELS[l.status as LicenceStatus] || l.status} · ${l.type.name}`.slice(0, 72) })) }] };
}

export const transcript = describe;
