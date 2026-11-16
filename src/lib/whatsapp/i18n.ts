// Fixed chatbot texts in English, ChiShona and isiNdebele. Free-text answers are accepted in any language.
// The Shona and Ndebele strings are first drafts for ZIMSTAT's language officers to review; anything missing falls back to English.

export const LANGS = ["en", "sn", "nd"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABELS: Record<Lang, string> = { en: "English", sn: "ChiShona", nd: "isiNdebele" };

/** Statistical topics shared by the statistics, data-request and alerts flows (keys are stored in the database). */
/**
 * Statistics taxonomy, mirroring the Open Data Portal catalogue: four areas, each with topics. `odp` lists the portal
 * category ids whose datasets the bot offers under the topic; `short` is the label used where WhatsApp allows 24 characters.
 */
export const STAT_GROUPS = [
  { key: "MAC", en: "Macroeconomics", sn: "Hupfumi hwenyika", nd: "Umnotho welizwe" },
  { key: "DS", en: "Demographic & Social", sn: "Vanhu nemagariro", nd: "Abantu lenhlalakahle" },
  { key: "PROD", en: "Production", sn: "Kugadzira nekurima", nd: "Ukukhiqiza" },
  { key: "SDG", en: "SDGs", sn: "SDGs", nd: "SDGs" },
] as const;
export type GroupKey = (typeof STAT_GROUPS)[number]["key"];
export type StatTopic = { key: string; group: GroupKey; en: string; sn: string; nd: string; short?: Partial<Record<Lang, string>>; odp: readonly string[] };
export const STAT_TOPICS: readonly StatTopic[] = [
  { key: "NA", group: "MAC", en: "National Accounts", sn: "Hupfumi hwenyika (GDP)", nd: "Umnotho welizwe (GDP)", odp: ["MAC_NA_Q", "MAC_NA_A"] },
  { key: "ET", group: "MAC", en: "External Trade", sn: "Kutengeserana nedzimwe nyika", nd: "Ukuthengiselana lamanye amazwe", short: { sn: "Kutengeserana kunze", nd: "Ukuthengiselana" }, odp: ["MAC_ET"] },
  { key: "LB", group: "MAC", en: "Labour Statistics", sn: "Basa nemabasa", nd: "Abasebenzi lemisebenzi", odp: ["MAC_LB"] },
  { key: "PI", group: "MAC", en: "Price Indices", sn: "Mitengo (CPI)", nd: "Amanani (CPI)", odp: ["MAC_PI"] },
  { key: "PV", group: "MAC", en: "Poverty Statistics", sn: "Hurombo", nd: "Ubuyanga", odp: ["MAC_PV"] },
  { key: "PC", group: "DS", en: "Population Census", sn: "Senzasi yevanhu", nd: "Ukubalwa kwabantu", odp: ["DS_PC"] },
  { key: "GE", group: "DS", en: "Gender", sn: "Zvemadzimai nevarume", nd: "Ubulili", odp: ["DS_GE"] },
  { key: "ED", group: "DS", en: "Education", sn: "Dzidzo", nd: "Imfundo", odp: ["DS_ED"] },
  { key: "CU", group: "DS", en: "Culture", sn: "Tsika nemagariro", nd: "Amasiko", odp: ["DS_CU"] },
  { key: "PR", group: "DS", en: "Prison", sn: "Majeri", nd: "Amajele", odp: ["DS_PR"] },
  { key: "CR", group: "DS", en: "Crime", sn: "Mhosva", nd: "Ubugebengu", odp: ["DS_CR"] },
  { key: "VS", group: "DS", en: "Vital", sn: "Kuzvarwa nekufa", nd: "Ukuzalwa lokufa", odp: ["DS_VS"] },
  { key: "MG", group: "DS", en: "Migration", sn: "Kutama", nd: "Ukuthutha", odp: ["DS_MG"] },
  { key: "HS", group: "DS", en: "Health Statistics", sn: "Hutano", nd: "Ezempilakahle", odp: ["DS_HS"] },
  { key: "AG", group: "PROD", en: "Agriculture", sn: "Kurima", nd: "Ezolimo", odp: ["PROD_AG"] },
  { key: "EC", group: "PROD", en: "Economic Census", sn: "Senzasi yehupfumi", nd: "Ukubalwa komnotho", odp: ["PROD_EC"] },
  { key: "EN", group: "PROD", en: "Energy", sn: "Simba nemagetsi", nd: "Amandla lagetsi", odp: ["PROD_EN"] },
  { key: "EV", group: "PROD", en: "Environment", sn: "Zvakatipoteredza", nd: "Imvelo", odp: ["PROD_EV"] },
  { key: "IN", group: "PROD", en: "Industrial", sn: "Maindasitiri", nd: "Imboni", odp: ["PROD_IN"] },
  { key: "ICT", group: "PROD", en: "ICT", sn: "ICT", nd: "ICT", odp: ["PROD_ICT"] },
  { key: "TR", group: "PROD", en: "Transport and Infrastructure", sn: "Zvekufambisa nezvivakwa", nd: "Ezokuthutha lezakhiwo", short: { en: "Transport" }, odp: ["PROD_TR"] },
  { key: "TO", group: "PROD", en: "Tourism", sn: "Vashanyi", nd: "Ezokuvakatsha", odp: ["PROD_TO"] },
  { key: "SDG", group: "SDG", en: "Sustainable Development Goals", sn: "Zvinangwa zveSDG", nd: "Izinhloso ze-SDG", short: { en: "SDG indicators" }, odp: ["GOAL_ALL", "SDG"] },
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
  lang_prompt: "Welcome to ZIMSTAT, the Zimbabwe National Statistics Agency. Please choose a language.",
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
  btn_another: "Another indicator", btn_alerts: "Get alerts", btn_officer: "Talk to an officer", btn_done: "Done", btn_continue: "Continue", btn_discard: "Discard and exit", btn_rate: "Rate the service", btn_other: "Other requests", btn_language: "Language",
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

const sn: Dict = {
  lang_prompt: "Mauya kuZIMSTAT, Zimbabwe National Statistics Agency. Sarudzai mutauro.",
  menu_header: "Masevhisi eZIMSTAT", menu_body: "Tingakubatsirei sei nhasi?", menu_button: "Sarudzai sevhisi", menu_footer: "Nyorai menu, back, cancel kana exit chero nguva",
  m_stats: "Manhamba matsva", m_stats_d: "Hupfumi, vanhu, kugadzira, SDGs",
  m_data: "Kumbirai data", m_data_d: "Matafura akagadzirirwa imi, microdata",
  m_verify: "Simbisai mushandi/sevhei", m_verify_d: "Tarisai bheji reZIMSTAT kana sevhei",
  m_alerts: "Kalenda nemayambiro", m_alerts_d: "Zvichaburitswa; nyoresai mayambiro",
  m_enquiry: "Mibvunzo nezvichemo", m_enquiry_d: "Mibvunzo, mazano, zvichemo",
  m_chat: "Taurai nemushandi", m_chat_d: "Chat panguva dzebasa",
  m_track: "Zvikumbiro zvangu", m_track_d: "Tarisai nhamba yeDR, VR kana TK",
  btn_menu: "Menyu huru", btn_cancel: "Kanzura", btn_back: "Dzokera", btn_skip: "Darika", btn_submit: "Tumira", btn_edit: "Gadzirisa mhinduro", btn_yes: "Hongu", btn_no: "Kwete",
  btn_another: "Imwe nhamba", btn_alerts: "Ndiyeuchidzei", btn_officer: "Taurai nemushandi", btn_done: "Zvapera", btn_continue: "Enderera", btn_discard: "Rasa ubude", btn_rate: "Yerai sevhisi", btn_other: "Zvimwe zvikumbiro", btn_language: "Mutauro",
  cancelled: "Zvakanzurwa. Hapana chakachengetwa.", goodbye: "Chisarai. Nyorai *hi* pamunoda ZIMSTAT zvakare.",
  exit_confirm: "Mune zvamusati matumira. Zvirasei mubude?", unknown: "Ndine urombo, handina kunzwisisa. Shandisai mabhatani, kana nyorai *menu*.",
  error: "Ndine urombo, pane chakanganisika kwatiri. Ngatitangei zvakare.", disabled: "Sevhisi iyi haisati yavapo. Sarudzai imwe.",
  too_many_tries: "Izvi hazvisi kuita. Mungade kutaura nemushandi here?",
  stats_header: "Zvemanhamba zvichangoburwa", stats_topic: "Sarudzai musoro.", stats_ind: "Sarudzai chiratidzo.", stats_none: "Hapasati pane manhamba emusoro uyu. Edzai umwe musoro kana bvunzai mushandi.",
  stats_period: "Nguva", stats_released: "Yakaburitswa", stats_odp: "Zvimwe paOpen Data Portal", stats_after: "Munoda chii zvino?",
  stats_files: "Tora Excel kana PDF", stats_files_d: "Matafura emanhamba aya nemabhuku akaburitswa", stats_files_body: "Sarudzai faira. Richatumirwa pano sechinyorwa chamunogona kuvhura kana kutumira.",
  fx_xlsx: "Tafura yeExcel", fx_xlsx_d: "Manhamba matsva e{topic} (.xlsx)", fx_pdf: "Tafura yePDF", fx_pdf_d: "Manhamba matsva e{topic} (.pdf)", fx_all: "Misoro yose (Excel)", fx_all_d: "Manhamba ose mubhuku rimwe",
  fx_caption: "{topic} – manhamba matsva kubva ku{org}, yagadzirwa {date}.", fx_doc_caption: "{title} ({org})", fx_failed: "Ndine urombo, faira harina kukwanisa kutumirwa izvozvi. Edzai zvakare gare gare kana muritore pa{url}.",
  fx_generated: "Yagadzirwa", fx_topic: "Musoro", fx_indicator: "Chiratidzo", fx_value: "Nhamba yazvino", fx_note: "Tsananguro", fx_source: "Kwayabva",
  stats_group: "Sarudzai chikamu.", g_MAC_d: "GDP, kutengeserana, basa, mitengo, hurombo", g_DS_d: "Senzasi, hutano, dzidzo, kuzvarwa, kutama", g_PROD_d: "Kurima, maindasitiri, ICT, simba, vashanyi", g_SDG_d: "Zviratidzo zveSDG nesaiti yeSDG",
  stats_topic_in: "Sarudzai musoro pasi pe{group}.", stats_topic_empty: "Hapasati pane manhamba makuru emusoro uyu, asi mafaira edata ari pazasi aripo.",
  odp_row: "Data kubva papotari", odp_row_d: "CSV, Excel kana chati kubva paOpen Data Portal",
  odp_pick: "Sarudzai dataset kubva paOpen Data Portal. Munogona kuigamuchira sefaira reCSV, bhuku reExcel kana mufananidzo wechati.", odp_none: "Open Data Portal haisati yaine madataset emusoro uyu.",
  odp_more: "Zvimwe papotari", odp_more_d: "Madataset {n} emusoro uyu pamhepo", odp_more_text: "Madataset ese emusoro uyu paOpen Data Portal:\n{url}",
  odp_fmt_body: "Yakagadziridzwa {date}. Munoida sei?", odp_csv: "Faira reCSV", odp_csv_d: "Manhamba ese; rinovhurika muExcel", odp_xlsx: "Bhuku reExcel", odp_xlsx_d: "Tafura yakarongwa ine peji reAbout", odp_png: "Mufananidzo wechati", odp_png_d: "Chati yemanhamba makuru nenguva",
  odp_link: "Vhurai papotari", odp_link_d: "Tarisai, sefai uye dhaunirodhai pamhepo", odp_link_text: "Vhurai dataset iyi paOpen Data Portal:\n{url}", odp_again: "Pane chimwe chamunoda kubva padataset iyi?", odp_another: "Imwe dataset",
  odp_failed: "Tine urombo, dataset iyi haina kukwanisa kutorwa paOpen Data Portal izvozvi. Munogona kuivhura pano: {url}", odp_updated: "Yakagadziridzwa", odp_source: "Kwayabva", odp_chart_footer: "Kwayabva: ZIMSTAT Open Data Portal · {url} · {date}",
  sdg_intro: "Zviratidzo zveSDG zveZimbabwe zvinoburitswa pasaiti yeSDG: {url}\n\nManhamba nemadataset eSDG aripo pano ari pazasi.",
  alerts_added: "Tichakuzivisai pano kana manhamba matsva e{topic} aburitswa. Nyorai *stop alerts* kuti mumire.",
  dr_intro: "Data yakaburitswa inowanikwa pachena paOpen Data Portal: {url}\n\nShandisai fomu iyi kumatafura akagadzirirwa imi kana microdata. Muchawana nhamba yeDR nemashoko ezvinenge zvichiitika pano.",
  dr_type: "Ndiani ari kukumbira data?", dr_name: "Zita renyu rizere?", dr_org: "Sangano renyu? (nyorai *none* kana risipo)", dr_email: "Email yenyu yekupindura?",
  dr_email_bad: "Iyo haisi email. Edzai zvakare, semuenzaniso name@example.com.", dr_topic: "Musoro wedata?", dr_desc: "Tsanangurai data yamunoda (mavara anopfuura 20).", dr_desc_short: "Wedzerai tsananguro (mavara anopfuura 20).",
  dr_geo: "Nzvimbo?", dr_period: "Makore api? Nyorai gore rekutanga nerekupedzisira, semuenzaniso 2015-2024.", dr_period_bad: "Nyorai makore se 2015-2024 (kana gore rimwe se 2022).",
  dr_format: "Fomati yamunoda?", dr_purpose: "Chinangwa?", dr_doc: "Kana pachidiwa gwaro rinotsigira (semuenzaniso tsamba yesangano), ritumirei zvino sePDF kana mufananidzo. Kana zvisina, dzvanyai Darika.",
  dr_consent: "Ndinobvuma mitemo yeZIMSTAT yekushandisa data uye kuti ruzivo rwangu ruchengetwe pachikumbiro ichi.", dr_consent_no: "Pasina mvumo hatikwanise kuenderera. Hapana chakachengetwa.",
  dr_done: "Chikumbiro chenyu chegashirwa. Nhamba: *{ref}*. Tichakuzivisai pano zvichifamba.",
  summary_header: "Tarisai mhinduro dzenyu", summary_edit: "Munoda kugadzirisa mhinduro ipi?",
  vr_kind: "Munoda kusimbisa chii?", vr_officer: "Simbisai mushandi", vr_officer_d: "Tarisai nhamba yebheji reZIMSTAT", vr_survey: "Simbisai sevhei", vr_survey_d: "Sevhei iyi ndeyechokwadi here?",
  vr_badge: "Nyorai nhamba yemushandi sezvakanyorwa pabheji reZIMSTAT.", vr_match: "Zvakafanana nebheji", vr_concern: "Mhan'arai", vr_thanks: "Tinotenda. Mushandi uyu ndewechokwadi. Vashandi vedu havakumbire mari kana ruzivo rwebhangi.",
  vr_notfound: "Hapana mushandi weZIMSTAT ane nhamba iyi. Musapa munhu uyu ruzivo rwenyu. Munoda kumhan'ara here?",
  vr_surveys: "Masevhei ari kuitwa", vr_no_surveys: "Hapana sevhei iri kuitwa parizvino.",
  vr_loc: "Zvakaitikira kupi? Nyorai dunhu, district newadhi, kana tumirai nzvimbo yenyu.", vr_date: "Zvakaitika riini? Nyorai zuva se YYYY-MM-DD, kana *today*.", vr_date_bad: "Nyorai zuva se YYYY-MM-DD, kana *today*.",
  vr_desc: "Tsanangurai zvakaitika nemunhu wacho.", vr_photo: "Tumirai mufananidzo webheji kana wemunhu kana munawo, kana dzvanyai Darika.",
  vr_done: "Tinotenda. Mhan'aro yenyu *{ref}* yatumirwa kuField Operations. Tichakuzivisai pano.",
  rel_header: "Kalenda yekuburitsa", rel_next: "Zvichaburitswa:", rel_none: "Hapana zvakarongwa parizvino.",
  rel_topics: "Munoda mayambiro emisoro ipi? Sarudzai imwe neimwe, mozodzvanya *Zvapera*.", rel_selected: "Zvasarudzwa: {topics}", rel_freq: "Kangani?",
  rel_every: "Pakuburitswa kwese", rel_monthly: "Pfupiso yemwedzi", rel_done: "Manyoresa: {topics} ({freq}). Nyorai *stop alerts* kuti mumire.",
  rel_stopped: "Mayambiro amiswa.", rel_none_active: "Hamuna mayambiro.", rel_pick_one: "Sarudzai musoro mumwe chete kana kupfuura.",
  tk_cat: "Ndezvei?", tk_name: "Zita renyu? (kana dzvanyai Usapa zita)", tk_anon: "Usapa zita", tk_name_required: "Pachichemo chinoda mhinduro tinoda zita renyu.",
  tk_email: "Email yenyu kuti tipindure? (kana dzvanyai Darika)", tk_desc: "Tsanangurai mubvunzo, zano kana chichemo chenyu.", tk_attach: "Tumirai mufananidzo kana gwaro kana zvichibatsira, kana dzvanyai Darika.",
  tk_done: "Tikiti renyu *{ref}* ranyorwa rikatumirwa ku{dept}. Tichakuzivisai pano.",
  chat_topic: "Mubvunzo wenyu ndewei?", chat_open: "Mabatanidzwa neService desk yeZIMSTAT (nhamba *{ref}*). Nyorai mubvunzo wenyu; mushandi achapindura pano. Nyorai *menu* kupedza.",
  chat_closed_hours: "Vashandi vedu vanowanikwa {hours}. Munoda kuti mubvunzo wenyu unyorwe setikiti here?", chat_log: "Nyorai setikiti", chat_msg_sent: "Zvatumirwa kumushandi.", chat_ended: "Chat yapera. Zvakachengetwa pasi pe*{ref}*.",
  track_none: "Hatina zvikumbiro kubva panhamba iyi. Munogona kunyora nhamba se DR-2026-0001.", track_pick: "Sarudzai chikumbiro, kana nyorai nhamba.", track_notfound: "Hapana chikumbiro chine nhamba {ref}.",
  track_latest: "Zvichangoitika", track_target: "Chinangwa", track_resolved: "Zvagadziriswa",
  rate_header: "Yerai sevhisi", rate_body: "Magutsikana zvakadii?", rate_thanks: "Tinotenda nemaonero enyu.",
  erasure_done: "Chikumbiro chenyu chekudzima ruzivo chanyorwa se *{ref}*.",
  none: "hapana", skipped: "hazvina kupiwa", attached: "zvatumirwa", or_type_place: "Kana nyorai nzvimbo:",
};

const nd: Dict = {
  lang_prompt: "Siyalemukela kuZIMSTAT, Zimbabwe National Statistics Agency. Khetha ulimi.",
  menu_header: "Izinsiza zeZIMSTAT", menu_body: "Singakusiza njani lamuhla?", menu_button: "Khetha insiza", menu_footer: "Bhala menu, back, cancel loba exit loba nini",
  m_stats: "Izibalo zakamuva", m_stats_d: "Umnotho, abantu, ukukhiqiza, SDGs",
  m_data: "Cela idatha", m_data_d: "Amathebula akho, i-microdata",
  m_verify: "Qinisekisa isikhulu", m_verify_d: "Hlola ibheji leZIMSTAT loba isaveyi",
  m_alerts: "Ikhalenda lezaziso", m_alerts_d: "Okuzakhutshwa; bhalisa izaziso",
  m_enquiry: "Imibuzo lezikhalazo", m_enquiry_d: "Imibuzo, imibono, izikhalazo",
  m_chat: "Khuluma lesikhulu", m_chat_d: "Ingxoxo ngesikhathi somsebenzi",
  m_track: "Izicelo zami", m_track_d: "Hlola inombolo ye-DR, VR loba TK",
  btn_menu: "Imenyu enkulu", btn_cancel: "Khansela", btn_back: "Buyela", btn_skip: "Yeqa", btn_submit: "Thumela", btn_edit: "Lungisa impendulo", btn_yes: "Yebo", btn_no: "Hatshi",
  btn_another: "Esinye isibalo", btn_alerts: "Ngazise", btn_officer: "Khuluma lesikhulu", btn_done: "Kuphelile", btn_continue: "Qhubeka", btn_discard: "Lahla uphume", btn_rate: "Linganisa insiza", btn_other: "Ezinye izicelo", btn_language: "Ulimi",
  cancelled: "Kukhanselwe. Akulalutho olugciniweyo.", goodbye: "Sala kuhle. Bhala *hi* nxa ufuna iZIMSTAT futhi.",
  exit_confirm: "Ulokungakathunyelwa. Kulahle uphume?", unknown: "Uxolo, angizwisisanga. Sebenzisa amabhathini, loba bhala *menu*.",
  error: "Uxolo, kube lephutha kithi. Asiqale futhi.", disabled: "Le nsiza ayikatholakali. Khetha enye.",
  too_many_tries: "Lokhu kulokhu kungalungi. Ungathanda ukukhuluma lesikhulu?",
  stats_header: "Izibalo zakamuva", stats_topic: "Khetha isihloko.", stats_ind: "Khetha isibalo.", stats_none: "Akulazibalo zalesi sihloko okwakhathesi. Zama esinye isihloko loba ubuze isikhulu.",
  stats_period: "Isikhathi", stats_released: "Kukhutshwe", stats_odp: "Okunye ku-Open Data Portal", stats_after: "Ufuna ini okulandelayo?",
  stats_files: "Thatha i-Excel loba PDF", stats_files_d: "Amathebula alezi zibalo lemibiko ekhutshiweyo", stats_files_body: "Khetha ifayili. Izathunyelwa lapha njengesinamathiselo ongasivula loba usidlulisele.",
  fx_xlsx: "Ithebula le-Excel", fx_xlsx_d: "Izibalo zakamuva ze{topic} (.xlsx)", fx_pdf: "Ithebula le-PDF", fx_pdf_d: "Izibalo zakamuva ze{topic} (.pdf)", fx_all: "Zonke izihloko (Excel)", fx_all_d: "Zonke izibalo encwadini eyodwa",
  fx_caption: "{topic} – izibalo zakamuva ezivela ku-{org}, kwenziwe {date}.", fx_doc_caption: "{title} ({org})", fx_failed: "Uxolo, ifayili ayithunyelwanga khathesi. Zama futhi muva loba uyithathe ku-{url}.",
  fx_generated: "Kwenziwe", fx_topic: "Isihloko", fx_indicator: "Isibalo", fx_value: "Inani lakamuva", fx_note: "Inothi", fx_source: "Umthombo",
  stats_group: "Khetha isigaba.", g_MAC_d: "I-GDP, ukuthengiselana, imisebenzi, amanani, ubuyanga", g_DS_d: "Ukubalwa, impilakahle, imfundo, ukuzalwa, ukuthutha", g_PROD_d: "Ezolimo, imboni, i-ICT, amandla, ezokuvakatsha", g_SDG_d: "Izibalo ze-SDG lesiza se-SDG",
  stats_topic_in: "Khetha isihloko ngaphansi kwe-{group}.", stats_topic_empty: "Akulazibalo ezinkulu zalesi sihloko okwakhathesi, kodwa amafayili edatha angezansi ayatholakala.",
  odp_row: "Idatha evela kuphothali", odp_row_d: "I-CSV, i-Excel loba ishathi evela ku-Open Data Portal",
  odp_pick: "Khetha i-dataset ku-Open Data Portal. Ungayithola njengefayili le-CSV, ibhuku le-Excel loba umfanekiso weshathi.", odp_none: "I-Open Data Portal kayikabi lama-dataset alesi sihloko.",
  odp_more: "Okunye kuphothali", odp_more_d: "Ama-dataset angu-{n} alesi sihloko ku-inthanethi", odp_more_text: "Wonke ama-dataset alesi sihloko ku-Open Data Portal:\n{url}",
  odp_fmt_body: "Kuvuselelwe {date}. Ufuna ini?", odp_csv: "Ifayili le-CSV", odp_csv_d: "Zonke izibalo; livuleka ku-Excel", odp_xlsx: "Ibhuku le-Excel", odp_xlsx_d: "Ithebula elilungisiweyo lekhasi le-About", odp_png: "Umfanekiso weshathi", odp_png_d: "Ishathi yezibalo ezinkulu ngesikhathi",
  odp_link: "Vula kuphothali", odp_link_d: "Bona, hlunga njalo ulande ku-inthanethi", odp_link_text: "Vula le dataset ku-Open Data Portal:\n{url}", odp_again: "Kukhona okunye okufunayo kule dataset?", odp_another: "Enye i-dataset",
  odp_failed: "Uxolo, le dataset ayitholakalanga ku-Open Data Portal khathesi. Ungayivula lapha: {url}", odp_updated: "Kuvuselelwe", odp_source: "Umthombo", odp_chart_footer: "Umthombo: ZIMSTAT Open Data Portal · {url} · {date}",
  sdg_intro: "Izibalo ze-SDG zeZimbabwe zikhutshwa kusiza se-SDG: {url}\n\nIzibalo lama-dataset e-SDG atholakala lapha kungezansi.",
  alerts_added: "Uzakwaziswa lapha nxa izibalo ezintsha ze{topic} zikhutshwa. Bhala *stop alerts* ukuma.",
  dr_intro: "Idatha ekhutshiweyo itholakala mahala ku-Open Data Portal: {url}\n\nSebenzisa leli fomu emathebuleni akho loba i-microdata. Uzathola inombolo ye-DR lezaziso lapha.",
  dr_type: "Ngubani ocela idatha?", dr_name: "Ibizo lakho eligcweleyo?", dr_org: "Inhlanganiso yakho? (bhala *none* nxa ingekho)", dr_email: "I-imeyili yakho yempendulo?",
  dr_email_bad: "Lokho akusi imeyili. Zama futhi, isibonelo name@example.com.", dr_topic: "Isihloko sedatha?", dr_desc: "Chaza idatha oyifunayo (okungenani izinhlamvu ezingu-20).", dr_desc_short: "Chaza kabanzi (okungenani izinhlamvu ezingu-20).",
  dr_geo: "Indawo?", dr_period: "Iminyaka? Bhala umnyaka wokuqala lowokucina, isibonelo 2015-2024.", dr_period_bad: "Bhala iminyaka njenge 2015-2024 (loba umnyaka owodwa njenge 2022).",
  dr_format: "Ifomethi oyifunayo?", dr_purpose: "Injongo?", dr_doc: "Nxa kudingeka umbhalo osekelayo (isibonelo incwadi yenhlanganiso), uthumele khathesi njenge-PDF loba isithombe. Nxa kungenjalo cindezela Yeqa.",
  dr_consent: "Ngiyavuma imithetho yeZIMSTAT yokusetshenziswa kwedatha lokuthi imininingwane yami igcinwe kulesi sicelo.", dr_consent_no: "Ngaphandle kwemvumo asingeke siqhubeke. Akulalutho olugciniweyo.",
  dr_done: "Isicelo sakho sedatha samukelwe. Inombolo: *{ref}*. Sizakwazisa lapha njengoba siqhubeka.",
  summary_header: "Hlola izimpendulo zakho", summary_edit: "Ufuna ukulungisa yiphi impendulo?",
  vr_kind: "Ufuna ukuqinisekisa ini?", vr_officer: "Qinisekisa isikhulu", vr_officer_d: "Hlola inombolo yebheji leZIMSTAT", vr_survey: "Qinisekisa isaveyi", vr_survey_d: "Le saveyi iqotho na?",
  vr_badge: "Bhala inombolo yesikhulu njengoba ibhalwe ebhejini leZIMSTAT.", vr_match: "Kuyafana lebheji", vr_concern: "Bika ukukhathazeka", vr_thanks: "Siyabonga. Lesi sikhulu siqotho. Izikhulu zethu azicela imali loba imininingwane yebhanga.",
  vr_notfound: "Akulasikhulu seZIMSTAT esilale nombolo. Unganiki lo muntu imininingwane yakho. Ufuna ukukubika?",
  vr_surveys: "Amasaveyi aqhubekayo", vr_no_surveys: "Akulasaveyi eqhubekayo okwakhathesi.",
  vr_loc: "Kwenzakale ngaphi? Bhala isifunda, isigaba lewadi, loba uthumele indawo yakho.", vr_date: "Kwenzakale nini? Bhala usuku njenge YYYY-MM-DD, loba *today*.", vr_date_bad: "Bhala usuku njenge YYYY-MM-DD, loba *today*.",
  vr_desc: "Chaza okwenzakeleyo lomuntu obandakanyekayo.", vr_photo: "Thumela isithombe sebheji loba somuntu nxa ulaso, loba cindezela Yeqa.",
  vr_done: "Siyabonga. Umbiko wakho *{ref}* uthunyelwe kuField Operations. Sizakwazisa lapha.",
  rel_header: "Ikhalenda lokukhutshwa", rel_next: "Okuzakhutshwa:", rel_none: "Akulalutho oluhleliweyo okwakhathesi.",
  rel_topics: "Ufuna izaziso zaziphi izihloko? Khetha esinye ngesikhathi, ubusucindezela *Kuphelile*.", rel_selected: "Okukhethiweyo: {topics}", rel_freq: "Kangaki?",
  rel_every: "Ekukhutshweni konke", rel_monthly: "Isifinqo senyanga", rel_done: "Ubhalisile: {topics} ({freq}). Bhala *stop alerts* ukuma.",
  rel_stopped: "Izaziso zimisiwe.", rel_none_active: "Awulazaziso.", rel_pick_one: "Khetha okungenani isihloko esisodwa.",
  tk_cat: "Kumayelana lani?", tk_name: "Ibizo lakho? (loba cindezela Hlala ungaziwa)", tk_anon: "Hlala ungaziwa", tk_name_required: "Esikhalazweni esidinga impendulo sidinga ibizo lakho.",
  tk_email: "I-imeyili yakho ukuze siphendule? (loba cindezela Yeqa)", tk_desc: "Chaza umbuzo, umbono loba isikhalazo sakho.", tk_attach: "Thumela isithombe loba umbhalo nxa kusiza, loba cindezela Yeqa.",
  tk_done: "Ithikithi lakho *{ref}* libhaliwe lathunyelwa ku{dept}. Sizakwazisa lapha.",
  chat_topic: "Umbuzo wakho umayelana lani?", chat_open: "Usuxhunywe le-service desk yeZIMSTAT (inombolo *{ref}*). Bhala umbuzo wakho; isikhulu sizaphendula lapha. Bhala *menu* ukuqeda.",
  chat_closed_hours: "Izikhulu zethu zitholakala {hours}. Ufuna umbuzo wakho ubhalwe njengethikithi?", chat_log: "Bhala njengethikithi", chat_msg_sent: "Kuthunyelwe esikhulwini.", chat_ended: "Ingxoxo iphelile. Igcinwe ngaphansi kwe*{ref}*.",
  track_none: "Asilazicelo ezivela kule nombolo. Ungabhala inombolo njenge DR-2026-0001.", track_pick: "Khetha isicelo, loba bhala inombolo.", track_notfound: "Akulasicelo esilenombolo {ref}.",
  track_latest: "Okwakamuva", track_target: "Umgomo", track_resolved: "Kulungisiwe",
  rate_header: "Linganisa insiza", rate_body: "Weneliseke kangakanani?", rate_thanks: "Siyabonga ngombono wakho.",
  erasure_done: "Isicelo sakho sokucitsha imininingwane sibhalwe njenge *{ref}*.",
  none: "akukho", skipped: "akunikwanga", attached: "kuthunyelwe", or_type_place: "Loba bhala indawo:",
};

const DICTS: Record<Lang, Dict> = { en, sn, nd };

/** Translate a key, falling back to English, and fill {placeholders}. */
export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  let s = DICTS[lang]?.[key] ?? en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export const isLang = (v: string): v is Lang => (LANGS as readonly string[]).includes(v);
