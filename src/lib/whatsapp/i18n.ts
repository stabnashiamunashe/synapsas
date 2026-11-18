// Fixed chatbot texts. The bot runs in English only for now; the `Lang` type and `t()` are kept so other languages
// can be added later by adding a dictionary and a label. Free-text answers are accepted in any language.

export const LANGS = ["en"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABELS: Record<Lang, string> = { en: "English" };

/** Statistical topics shared by the statistics, data-request and alerts flows (keys are stored in the database). */
/**
 * Statistics taxonomy, mirroring the Open Data Portal catalogue: four areas, each with topics. `odp` lists the portal
 * category ids whose datasets the bot offers under the topic; `short` is the label used where WhatsApp allows 24 characters.
 */
export const STAT_GROUPS = [
  { key: "MAC", en: "Macroeconomics" },
  { key: "DS", en: "Demographic & Social" },
  { key: "PROD", en: "Production" },
  { key: "SDG", en: "SDGs" },
] as const;
export type GroupKey = (typeof STAT_GROUPS)[number]["key"];
export type StatTopic = { key: string; group: GroupKey; en: string; short?: Partial<Record<Lang, string>>; odp: readonly string[] };
export const STAT_TOPICS: readonly StatTopic[] = [
  { key: "NA", group: "MAC", en: "National Accounts", odp: ["MAC_NA_Q", "MAC_NA_A"] },
  { key: "ET", group: "MAC", en: "External Trade", odp: ["MAC_ET"] },
  { key: "LB", group: "MAC", en: "Labour Statistics", odp: ["MAC_LB"] },
  { key: "PI", group: "MAC", en: "Price Indices", odp: ["MAC_PI"] },
  { key: "PV", group: "MAC", en: "Poverty Statistics", odp: ["MAC_PV"] },
  { key: "PC", group: "DS", en: "Population Census", odp: ["DS_PC"] },
  { key: "GE", group: "DS", en: "Gender", odp: ["DS_GE"] },
  { key: "ED", group: "DS", en: "Education", odp: ["DS_ED"] },
  { key: "CU", group: "DS", en: "Culture", odp: ["DS_CU"] },
  { key: "PR", group: "DS", en: "Prison", odp: ["DS_PR"] },
  { key: "CR", group: "DS", en: "Crime", odp: ["DS_CR"] },
  { key: "VS", group: "DS", en: "Vital", odp: ["DS_VS"] },
  { key: "MG", group: "DS", en: "Migration", odp: ["DS_MG"] },
  { key: "HS", group: "DS", en: "Health Statistics", odp: ["DS_HS"] },
  { key: "AG", group: "PROD", en: "Agriculture", odp: ["PROD_AG"] },
  { key: "EC", group: "PROD", en: "Economic Census", odp: ["PROD_EC"] },
  { key: "EN", group: "PROD", en: "Energy", odp: ["PROD_EN"] },
  { key: "EV", group: "PROD", en: "Environment", odp: ["PROD_EV"] },
  { key: "IN", group: "PROD", en: "Industrial", odp: ["PROD_IN"] },
  { key: "ICT", group: "PROD", en: "ICT", odp: ["PROD_ICT"] },
  { key: "TR", group: "PROD", en: "Transport and Infrastructure", short: { en: "Transport" }, odp: ["PROD_TR"] },
  { key: "TO", group: "PROD", en: "Tourism", odp: ["PROD_TO"] },
  { key: "SDG", group: "SDG", en: "Sustainable Development Goals", short: { en: "SDG indicators" }, odp: ["GOAL_ALL", "SDG"] },
];
export type TopicKey = string;
/** Topic keys used before the taxonomy followed the portal (figures saved under them still show under the new topic). */
export const LEGACY_TOPICS: Record<string, string> = { CPI: "PI", GDP: "NA", POP: "PC", LAB: "LB", TRADE: "ET", AGRI: "AG", HEALTH: "HS" };
export const normalizeTopic = (key: string) => LEGACY_TOPICS[key] || key;
/** The key plus any legacy keys that map to it, for database lookups. */
export const topicAliases = (key: string) => [key, ...Object.entries(LEGACY_TOPICS).filter(([, v]) => v === key).map(([k]) => k)];
export const groupOf = (key: string): GroupKey | undefined => STAT_TOPICS.find((x) => x.key === normalizeTopic(key))?.group || STAT_GROUPS.find((g) => g.key === key)?.key;
export const topicsInGroup = (group: string) => STAT_TOPICS.filter((x) => x.group === group);
/** Label for a topic, an area or a legacy key; `short` picks the 24-character form used in WhatsApp list rows. */
export const topicLabel = (key: string, lang: Lang, short = false) => {
  const k = normalizeTopic(key);
  const tp = STAT_TOPICS.find((x) => x.key === k);
  if (tp) return (short && tp.short?.[lang]) || tp[lang] || tp.en;
  const g = STAT_GROUPS.find((x) => x.key === k);
  return g ? g[lang] || g.en : key;
};

type Dict = Record<string, string>;

const en: Dict = {
  menu_header: "ZIMSTAT services", menu_body: "How can we help you today?",
  menu_button: "Choose a service",
  menu_footer: "Type menu, back, cancel or exit at any time",
  m_stats: "Latest statistics", m_stats_d: "Macroeconomics, population, production, SDGs",
  m_data: "Request data or a table", m_data_d: "Custom tables, tabulations, microdata",
  m_verify: "Verify officer or survey", m_verify_d: "Check a ZIMSTAT badge or a survey visit",
  m_alerts: "Releases and alerts", m_alerts_d: "Upcoming releases; subscribe to alerts",
  m_enquiry: "Enquiries and complaints", m_enquiry_d: "Questions, feedback, complaints",
  m_chat: "Talk to an officer", m_chat_d: "Live chat during office hours",
  m_track: "My requests and status", m_track_d: "Check a DR, VR or TK reference",
  btn_menu: "Main menu", btn_cancel: "Cancel", btn_back: "Back", btn_skip: "Skip", btn_submit: "Submit", btn_edit: "Edit an answer", btn_yes: "Yes", btn_no: "No",
  btn_another: "Another indicator", btn_alerts: "Get alerts", btn_officer: "Talk to an officer", btn_done: "Done", btn_continue: "Continue", btn_discard: "Discard and exit", btn_rate: "Rate the service", btn_other: "Other requests",
  cancelled: "Cancelled. Nothing was saved.",
  goodbye: "Goodbye. Type *hi* whenever you need ZIMSTAT again.",
  exit_confirm: "You have an unsent draft. Discard it and exit?",
  unknown: "Sorry, I did not understand that. Use the buttons, or type *menu*.",
  error: "Sorry, something went wrong on our side. Let's start again.",
  disabled: "This service is not available yet. Please choose another option.",
  too_many_tries: "That still does not look right. Would you like to talk to an officer instead?",
  help_default: "Use the menu to get the latest statistics, request data, verify a field officer, subscribe to release alerts, log an enquiry or talk to an officer.",
  // statistics
  stats_header: "Latest statistics", stats_topic: "Choose a topic.", stats_ind: "Choose an indicator.", stats_none: "No figures are loaded for this topic yet. Please try another topic or ask an officer.",
  stats_period: "Reference period", stats_released: "Released", stats_odp: "More on the Open Data Portal", stats_after: "What would you like next?",
  // files the bot sends (Excel/PDF tables generated from the indicators, and uploaded publications)
  stats_files: "Download Excel or PDF", stats_files_d: "Tables of these figures and published reports", stats_files_body: "Choose a file. It will be sent here as an attachment you can open or forward.",
  fx_xlsx: "Excel table", fx_xlsx_d: "Latest {topic} figures (.xlsx)", fx_pdf: "PDF table", fx_pdf_d: "Latest {topic} figures (.pdf)", fx_all: "All topics (Excel)", fx_all_d: "Every headline figure in one workbook",
  fx_caption: "{topic} – latest headline figures from {org}, generated {date}.", fx_doc_caption: "{title} ({org})", fx_failed: "Sorry, the file could not be sent right now. Please try again later or download it from {url}.",
  fx_generated: "Generated", fx_topic: "Topic", fx_indicator: "Indicator", fx_value: "Latest value", fx_note: "Note", fx_source: "Source",
  // areas and the Open Data Portal datasets offered under each topic
  stats_group: "Choose an area.", g_MAC_d: "GDP, trade, labour, prices, poverty", g_DS_d: "Census, health, education, vital, migration", g_PROD_d: "Agriculture, industry, ICT, energy, tourism", g_SDG_d: "SDG indicators and the SDG portal",
  stats_topic_in: "Choose a topic under {group}.", stats_topic_empty: "No headline figures are loaded for this topic yet, but the data files below are available.",
  odp_row: "Data from the portal", odp_row_d: "CSV, Excel or chart from the Open Data Portal",
  odp_pick: "Choose a dataset from the Open Data Portal. You can receive it as a CSV file, an Excel workbook or a chart image.", odp_none: "The Open Data Portal has no datasets under this topic yet.",
  odp_more: "More on the portal", odp_more_d: "{n} datasets under this topic online", odp_more_text: "All datasets for this topic on the Open Data Portal:\n{url}",
  odp_fmt_body: "Updated {date}. How would you like it?", odp_csv: "CSV file", odp_csv_d: "All figures; opens in Excel or any spreadsheet", odp_xlsx: "Excel workbook", odp_xlsx_d: "Formatted table with an About sheet", odp_png: "Chart image", odp_png_d: "Picture of the main series over time",
  odp_link: "Open on the portal", odp_link_d: "Browse, filter and download online", odp_link_text: "Open this dataset on the Open Data Portal:\n{url}", odp_again: "Anything else from this dataset?", odp_another: "Another dataset",
  odp_failed: "Sorry, that dataset could not be fetched from the Open Data Portal right now. You can open it here: {url}", odp_updated: "Updated", odp_source: "Source", odp_chart_footer: "Source: ZIMSTAT Open Data Portal · {url} · {date}",
  sdg_intro: "Zimbabwe's SDG indicators are published on the SDG portal: {url}\n\nThe SDG figures and datasets available here are listed below.",
  alerts_added: "You will be notified here when new {topic} figures are released. Type *stop alerts* at any time to opt out.",
  // data requests
  dr_intro: "Published data is free on the Open Data Portal: {url}\n\nUse this form for custom tables, unpublished tabulations or microdata. You will get a DR reference and status updates here.",
  dr_type: "Who is requesting the data?", dr_name: "Your full name?", dr_org: "Your organisation? (type *none* if not applicable)", dr_email: "Your email address for the reply?",
  dr_email_bad: "That does not look like an email address. Please try again, e.g. name@example.com.",
  dr_topic: "Subject area?", dr_desc: "Describe the data you need: variables, breakdowns and tables (at least 20 characters).", dr_desc_short: "Please give a little more detail (at least 20 characters).",
  dr_geo: "Geographic level?", dr_period: "Period covered? Type the start and end year, e.g. 2015-2024.", dr_period_bad: "Please type years like 2015-2024 (or a single year such as 2022).",
  dr_format: "Preferred format?", dr_purpose: "Purpose of use?", dr_doc: "If a supporting document is required (e.g. an institutional letter for microdata), send it now as a PDF or photo. Otherwise tap Skip.",
  dr_consent: "I agree to ZIMSTAT's data use terms and to my details being stored for this request.", dr_consent_no: "Without consent we cannot process the request. Nothing was saved.",
  dr_done: "Your data request has been received. Reference: *{ref}*. Expected response: within the service-standard period. We will message you here as it progresses.",
  opt_individual: "Individual", opt_student: "Student or academic", opt_gov: "Govt ministry or agency", opt_partner: "Development partner/NGO", opt_company: "Private company", opt_media: "Media",
  opt_national: "National", opt_province: "Province", opt_district: "District", opt_ward: "Ward", opt_other: "Other",
  opt_research: "Research or thesis", opt_policy: "Policy or planning", opt_business: "Business", opt_story: "Media story",
  summary_header: "Please check your answers", summary_edit: "Which answer do you want to change?",
  // verification
  vr_kind: "What would you like to verify?", vr_officer: "Verify a field officer", vr_officer_d: "Check the ID number on a ZIMSTAT badge", vr_survey: "Verify a survey", vr_survey_d: "Is this survey genuine and what will be asked?",
  vr_badge: "Type the officer's ID number exactly as printed on the ZIMSTAT badge.",
  vr_found: "*Verified ZIMSTAT field officer*\nName: {name}\nRole: {role}\nSurvey: {survey}\nArea: {area}\n\nPlease check that these match the badge and the person in front of you.",
  vr_match: "Matches the badge", vr_concern: "Report a concern", vr_thanks: "Thank you. The visit is genuine. Our officers carry a ZIMSTAT badge and never ask for money or bank details.",
  vr_notfound: "No active ZIMSTAT field officer has that ID. Please do not share personal information with this person. Would you like to report it?",
  vr_surveys: "Surveys currently in the field", vr_no_surveys: "No surveys are in the field at the moment.", vr_survey_info: "*{name}* ({code})\nPeriod: {period}\nAreas: {areas}\n\n{description}",
  vr_loc: "Where did this happen? Type the province, district and ward, or share your location.", vr_date: "When did it happen? Type the date as YYYY-MM-DD, or *today*.", vr_date_bad: "Please type the date as YYYY-MM-DD (e.g. 2026-11-09), or *today*.",
  vr_desc: "Describe what happened and the person involved (at least 10 characters).", vr_photo: "Send a photo of the badge or the person if you have one, or tap Skip.",
  vr_done: "Thank you. Your report *{ref}* has been sent to Field Operations. We will message you here once it has been looked into.",
  // release calendar and alerts
  rel_header: "Release calendar", rel_next: "Next scheduled releases:", rel_none: "No releases are scheduled at the moment.",
  rel_topics: "Which topics would you like alerts for? Pick one at a time, then tap *Done*.", rel_selected: "Selected so far: {topics}", rel_freq: "How often would you like to hear from us?",
  rel_every: "Every release", rel_monthly: "Monthly summary", rel_done: "Subscribed to {topics} ({freq}). Type *stop alerts* at any time to opt out.",
  rel_stopped: "Alerts stopped. You will no longer receive release notifications.", rel_none_active: "You have no active alerts.", rel_pick_one: "Pick at least one topic, or tap Cancel.",
  // enquiries and tickets
  tk_cat: "What is it about?", tk_name: "Your name? (or tap Stay anonymous)", tk_anon: "Stay anonymous", tk_name_required: "For a complaint that needs a reply we need your name.",
  tk_email: "Your email address so we can reply? (or tap Skip)", tk_desc: "Describe your enquiry, feedback or complaint in one message.", tk_attach: "Send a screenshot or document if it helps, or tap Skip.",
  tk_done: "Your ticket *{ref}* has been logged and routed to {dept}. We will message you here when it is assigned, answered and closed.",
  // live chat
  chat_topic: "What is your question about?",
  chat_open: "You are now connected to the ZIMSTAT service desk (reference *{ref}*). Type your question; the next available officer will reply here. Type *menu* to end the chat.",
  chat_closed_hours: "Our officers are available {hours}. Would you like to log your question as a ticket? An officer will reply when the office opens.",
  chat_log: "Log as a ticket", chat_msg_sent: "Sent to the officer. You can keep typing; replies arrive here.", chat_ended: "Chat ended. Your conversation is saved under *{ref}*.",
  // tracking
  track_none: "We have no requests from this number yet. You can also type a reference such as DR-2026-0001.", track_pick: "Choose a request to see its status, or type a reference number.",
  track_notfound: "No request found with reference {ref}.", track_latest: "Latest updates", track_target: "Target", track_resolved: "Resolved",
  rate_header: "Rate the service", rate_body: "How satisfied are you with how this was handled?", rate_thanks: "Thank you for your feedback.",
  erasure_done: "Your request to delete your data has been logged as *{ref}*. We will confirm here once it is done.",
  // field labels for summaries
  f_requesterType: "Requester", f_name: "Name", f_org: "Organisation", f_email: "Email", f_topic: "Subject area", f_description: "Data needed", f_geo: "Geographic level", f_period: "Period", f_format: "Format", f_purpose: "Purpose", f_document: "Document",
  f_location: "Location", f_date: "Date", f_photo: "Photo", f_category: "Category", f_attachment: "Attachment", f_badge: "Badge ID", f_details: "Details",
  none: "none", skipped: "not provided", attached: "attached", or_type_place: "Or type the place:",
};


const DICTS: Record<Lang, Dict> = { en };

/** Translate a key, falling back to English, and fill {placeholders}. */
export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  let s = DICTS[lang]?.[key] ?? en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export const isLang = (v: string): v is Lang => (LANGS as readonly string[]).includes(v);
