// Button-and-list driven WhatsApp conversation. The only free-text step is the description of the issue; everything
// else is a reply button, a list pick or a shared location. State is kept per phone in WhatsAppSession.
import { prisma } from "../prisma";
import { parseJson, toJson } from "../json";
import { caseSettings, createCase } from "../cases";
import { CASE_STATUS_LABELS, type CaseStatus } from "../caseTypes";
import { describe, logMessage, normalizePhone, sendWhatsApp, type WaOutgoing } from "./client";

export type Inbound =
  | { kind: "text"; text: string }
  | { kind: "button"; id: string; title?: string }
  | { kind: "list"; id: string; title?: string }
  | { kind: "location"; latitude: number; longitude: number; name?: string; address?: string }
  | { kind: "other" };

type Step = "IDLE" | "MENU" | "CATEGORY" | "DESCRIBE" | "LOCATION" | "NAME" | "CONFIRM" | "TRACK" | "RATE";
type Data = { categoryId?: string; categoryName?: string; description?: string; latitude?: number; longitude?: number; locationAddress?: string; name?: string; trackCaseId?: string; rateCaseId?: string; page?: number };

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const B = {
  REPORT: "menu_report", TRACK: "menu_track", HELP: "menu_help", MENU: "go_menu", CANCEL: "go_cancel",
  LOC_SKIP: "loc_skip", NAME_OK: "name_ok", NAME_ANON: "name_anon", CONFIRM: "confirm_yes", MORE: "cat_more", RATE: "rate_", BACK: "track_back",
};

const menu = (greeting: string): WaOutgoing => ({ type: "buttons", header: "Main menu", body: greeting, buttons: [{ id: B.REPORT, title: "Report an issue" }, { id: B.TRACK, title: "Track a report" }, { id: B.HELP, title: "Help" }] });

async function categoryList(orgId: string, page: number): Promise<WaOutgoing> {
  const cats = await prisma.caseCategory.findMany({ where: { orgId, isActive: true, isPublic: true }, orderBy: { name: "asc" }, select: { id: true, name: true, description: true, defaultSlaHours: true } });
  const pageSize = 9;
  const slice = cats.slice(page * pageSize, page * pageSize + pageSize);
  const rows = slice.map((c) => ({ id: `cat_${c.id}`, title: c.name, description: (c.description || `${c.defaultSlaHours}h target`).slice(0, 72) }));
  if (cats.length > (page + 1) * pageSize) rows.push({ id: B.MORE, title: "More categories…", description: "" });
  return { type: "list", header: "What is it about?", body: "Pick the category that fits best.", button: "Choose", sections: [{ rows }], footer: "Reply Cancel at any time" };
}

const statusLine = (c: { referenceNo: string; title: string; status: string; slaDueAt: Date | null; resolvedAt: Date | null }) =>
  `*${c.referenceNo}* · ${CASE_STATUS_LABELS[c.status as CaseStatus] || c.status}\n${c.title}${c.resolvedAt ? `\nResolved ${c.resolvedAt.toDateString()}` : c.slaDueAt ? `\nTarget ${c.slaDueAt.toDateString()}` : ""}`;

/**
 * Process one inbound message and return the replies. `send` decides whether replies go to Meta or only into the log
 * (simulator). Never throws: any failure resets the session and answers with the menu.
 */
export async function handleInbound(orgId: string, rawPhone: string, profileName: string | null, input: Inbound, opts: { simulate?: boolean } = {}): Promise<WaOutgoing[]> {
  const phone = normalizePhone(rawPhone);
  const settings = await caseSettings(orgId);
  const wa = settings.whatsapp || {};
  const greeting = wa.greeting || "Welcome to ZimStat. How can we help you today?";
  const replies: WaOutgoing[] = [];
  const say = (m: WaOutgoing) => replies.push(m);
  try {
    if (wa.enabled === false) {
      say({ type: "text", text: wa.helpText || "WhatsApp reporting is not available at the moment. Please use the website or call the office." });
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

    // global commands
    if (id === B.CANCEL || ["cancel", "stop", "exit"].includes(lower)) { await save("MENU", {}); say({ type: "text", text: "Cancelled." }); say(menu(greeting)); return await flush(); }
    if (id === B.MENU || ["menu", "hi", "hello", "start", "mhoro", "salibonani"].includes(lower)) { await save("MENU", {}); say(menu(greeting)); return await flush(); }

    switch (step) {
      case "IDLE":
        await save("MENU", {});
        say(menu(greeting));
        break;

      case "MENU":
        if (id === B.REPORT) { await save("CATEGORY", { page: 0 }); say(await categoryList(orgId, 0)); }
        else if (id === B.TRACK) { say(await trackList(orgId, phone)); await save("TRACK", {}); }
        else if (id === B.HELP) { say({ type: "buttons", body: wa.helpText || `${settings.contactEmail ? `Email ${settings.contactEmail}. ` : ""}${settings.contactPhone ? `Call ${settings.contactPhone}. ` : ""}Use the buttons below to report or track an issue.`, buttons: [{ id: B.REPORT, title: "Report an issue" }, { id: B.TRACK, title: "Track a report" }] }); }
        else say(menu(greeting));
        break;

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
          say({ type: "buttons", header: "Report received", body: `Your reference is *${c.referenceNo}*. Our target is to attend to it within ${c.slaHours} hours. We will message you here when it progresses.`, buttons: [{ id: B.TRACK, title: "Track a report" }, { id: B.MENU, title: "Main menu" }] });
        }
        break;

      case "TRACK":
        if (id.startsWith("case_")) {
          const c = await prisma.case.findFirst({ where: { id: id.slice(5), orgId, reporterPhone: { endsWith: phone.slice(-9) } }, include: { comments: { where: { isInternal: false }, orderBy: { createdAt: "desc" }, take: 2 } } });
          if (!c) { say(await trackList(orgId, phone)); break; }
          const updates = c.comments.map((m) => `• ${m.body.slice(0, 200)}`).join("\n");
          const canRate = ["RESOLVED", "CLOSED"].includes(c.status) && !c.rating;
          await save("TRACK", { ...data, trackCaseId: c.id });
          say({ type: "buttons", body: `${statusLine(c)}${updates ? `\n\nLatest updates:\n${updates}` : ""}`, buttons: [...(canRate ? [{ id: `${B.RATE}${c.id}`, title: "Rate the service" }] : []), { id: B.TRACK, title: "Other reports" }, { id: B.MENU, title: "Main menu" }] });
        } else if (id.startsWith(B.RATE)) {
          await save("RATE", { ...data, rateCaseId: id.slice(B.RATE.length) });
          say({ type: "list", header: "Rate the service", body: "How satisfied are you with how this was handled?", button: "Choose", sections: [{ rows: [5, 4, 3, 2, 1].map((n) => ({ id: `stars_${n}`, title: `${"★".repeat(n)}${"☆".repeat(5 - n)}`, description: ["", "Very poor", "Poor", "Fair", "Good", "Excellent"][n] })) }] });
        } else if (id === B.TRACK || id === B.BACK) { say(await trackList(orgId, phone)); }
        else if (/^[A-Z0-9]{1,6}-\d{4}-\d{4,6}$/i.test(text)) {
          const c = await prisma.case.findFirst({ where: { referenceNo: text.toUpperCase(), orgId } });
          say(c ? { type: "buttons", body: statusLine(c), buttons: [{ id: B.TRACK, title: "My reports" }, { id: B.MENU, title: "Main menu" }] } : { type: "buttons", body: "No report found with that reference.", buttons: [{ id: B.TRACK, title: "My reports" }, { id: B.MENU, title: "Main menu" }] });
        } else say(await trackList(orgId, phone));
        break;

      case "RATE": {
        const m = /^stars_(\d)$/.exec(id);
        if (!m || !data.rateCaseId) { say(menu(greeting)); await save("MENU", {}); break; }
        const c = await prisma.case.findFirst({ where: { id: data.rateCaseId, orgId, reporterPhone: { endsWith: phone.slice(-9) } } });
        if (c) await prisma.case.update({ where: { id: c.id }, data: { rating: Number(m[1]), feedback: "Rated via WhatsApp" } });
        await save("MENU", {});
        say({ type: "buttons", body: "Thank you for your feedback.", buttons: [{ id: B.TRACK, title: "Track a report" }, { id: B.MENU, title: "Main menu" }] });
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
  if (!cases.length) return { type: "buttons", body: "We have no reports from this number yet. You can also type a reference number (e.g. ZS-2026-0001).", buttons: [{ id: B.REPORT, title: "Report an issue" }, { id: B.MENU, title: "Main menu" }] };
  return { type: "list", header: "Your reports", body: "Choose a report to see its progress, or type a reference number.", button: "My reports", sections: [{ rows: cases.map((c) => ({ id: `case_${c.id}`, title: c.referenceNo, description: `${CASE_STATUS_LABELS[c.status as CaseStatus] || c.status} · ${c.title}`.slice(0, 72) })) }] };
}

export const transcript = describe;
