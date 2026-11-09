/**
 * WhatsApp chatbot content (additive, safe on an existing ZimStat database): sample headline statistics, the release
 * calendar, surveys in the field with a field-staff register, and the enquiry categories the bot lists. Figures are
 * SAMPLE VALUES to be replaced under Settings → Chatbot content before the public pilot.
 *
 *   npx tsx prisma/seed-chatbot.ts
 *   docker compose --profile seed run --rm seed npx tsx prisma/seed-chatbot.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const inDays = (n: number) => { const x = new Date(); x.setDate(x.getDate() + n); x.setHours(10, 0, 0, 0); return x; };
const ODP = "https://data.zimstat.co.zw";

export async function applyChatbotSeed(orgId: string) {
  let added = 0;
  const depts = await prisma.department.findMany({ where: { orgId }, select: { id: true, code: true, name: true } });
  const dept = (code: string) => depts.find((d) => d.code === code) || depts[0];

  // enquiry categories the bot offers (option 5 and the live-chat topics)
  const cats: [string, string, number, string, string, string][] = [
    ["General enquiry", "DG", 48, "LOW", "info", "Questions about ZIMSTAT, its publications and services."],
    ["Data quality concern", "PCS", 120, "MEDIUM", "data", "A figure or table that looks wrong, inconsistent or out of date."],
    ["Website or ODP 2.0 problem", "ICT", 24, "HIGH", "laptop", "The website or Open Data Portal is down, broken or missing a dataset."],
    ["Compliment or suggestion", "DG", 72, "LOW", "megaphone", "Feedback and ideas to improve ZIMSTAT services."],
    ["Field officer verification concern", "PCS", 24, "HIGH", "shield", "Someone claiming to be a ZIMSTAT enumerator who is not on the register or behaved improperly."],
  ];
  for (const [name, code, sla, priority, icon, description] of cats) {
    const d = dept(code);
    if (!d) continue;
    const exists = await prisma.caseCategory.findFirst({ where: { orgId, name } });
    if (!exists) { await prisma.caseCategory.create({ data: { orgId, name, departmentId: d.id, defaultSlaHours: sla, defaultPriority: priority, icon, description, isPublic: true } }); added++; }
  }

  if (!(await prisma.statIndicator.count({ where: { orgId } }))) {
    const rows: [string, string, string, string, string, string][] = [
      ["CPI", "Month-on-month inflation", "0.9%", "September 2026", "2026-10-15", `${ODP}/indicator/cpi-mom`],
      ["CPI", "Year-on-year inflation", "3.1%", "September 2026", "2026-10-15", `${ODP}/indicator/cpi-yoy`],
      ["CPI", "CPI index (Jan 2025 = 100)", "118.4", "September 2026", "2026-10-15", `${ODP}/indicator/cpi-index`],
      ["GDP", "Real GDP growth", "5.2%", "2025 (annual)", "2026-06-30", `${ODP}/indicator/gdp-growth`],
      ["GDP", "GDP at current prices", "US$ 44.4 billion", "2025", "2026-06-30", `${ODP}/indicator/gdp-current`],
      ["POP", "Total population (2022 Census)", "15 178 957", "Census night, April 2022", "2022-07-26", `${ODP}/census-2022`],
      ["POP", "Population projection", "16.3 million", "Mid-2026", "2026-03-31", `${ODP}/indicator/population-projection`],
      ["LAB", "Unemployment rate (strict)", "21.0%", "Q2 2026", "2026-09-30", `${ODP}/indicator/unemployment`],
      ["LAB", "Labour force participation rate", "45.6%", "Q2 2026", "2026-09-30", `${ODP}/indicator/lfpr`],
      ["TRADE", "Merchandise exports", "US$ 740 million", "September 2026", "2026-10-28", `${ODP}/indicator/exports`],
      ["TRADE", "Merchandise imports", "US$ 810 million", "September 2026", "2026-10-28", `${ODP}/indicator/imports`],
      ["AGRI", "Maize production estimate", "2.3 million tonnes", "2025/26 season", "2026-05-15", `${ODP}/indicator/maize`],
      ["HEALTH", "Under-five mortality rate", "56 per 1 000 live births", "ZDHS 2023-24", "2025-02-20", `${ODP}/zdhs-2023`],
    ];
    for (const [i, [topic, name, value, period, releaseDate, url]] of rows.entries()) {
      await prisma.statIndicator.create({ data: { orgId, topic, name, value, period, releaseDate: new Date(releaseDate), url, sortOrder: i, note: "Sample figure for the demo; replace under Settings → Chatbot content." } }); added++;
    }
  }

  if (!(await prisma.statRelease.count({ where: { orgId } }))) {
    const rel: [string, string, number, string][] = [
      ["Consumer Price Index, October 2026", "CPI", 6, "Monthly CPI and inflation rates"],
      ["Merchandise trade statistics, October 2026", "TRADE", 19, "Exports, imports and trade balance"],
      ["Quarterly Labour Force Survey, Q3 2026", "LAB", 27, "Employment, unemployment and informality"],
      ["Quarterly GDP estimates, Q3 2026", "GDP", 41, "Production and expenditure estimates"],
      ["Consumer Price Index, November 2026", "CPI", 36, "Monthly CPI and inflation rates"],
      ["Crop and livestock assessment, second round", "AGRI", 55, "Planted area and production estimates"],
    ];
    for (const [title, topic, days, summary] of rel) { await prisma.statRelease.create({ data: { orgId, title, topic, scheduledAt: inDays(days), summary, url: `${ODP}/releases` } }); added++; }
  }

  if (!(await prisma.survey.count({ where: { orgId } }))) {
    const zdhs = await prisma.survey.create({ data: { orgId, code: "ZDHS-2026", name: "Zimbabwe Demographic and Health Survey 2026", areas: "All ten provinces, sampled enumeration areas", startsOn: inDays(-40), endsOn: inDays(80), description: "Household interviews on health, fertility, nutrition and child survival. Takes about 45 minutes. Enumerators carry a ZIMSTAT badge and an introduction letter; participation is voluntary and answers are confidential. No payment is ever requested." } });
    const mics = await prisma.survey.create({ data: { orgId, code: "LFS-Q4-2026", name: "Quarterly Labour Force Survey, Q4 2026", areas: "Nationwide, sampled households", startsOn: inDays(-10), endsOn: inDays(50), description: "Questions about work, job search and earnings for every household member aged 15 and above. About 30 minutes." } });
    await prisma.survey.create({ data: { orgId, code: "AGRI-CLA-2026", name: "Crop and Livestock Assessment 2025/26", areas: "Rural districts", startsOn: inDays(-120), endsOn: inDays(-20), isActive: false, description: "Completed." } });
    const officers: [string, string, string, string, string][] = [
      ["ZS-ENU-1042", "Tariro Moyo", "Enumerator", zdhs.id, "Harare Province, Epworth and Chitungwiza"],
      ["ZS-ENU-1043", "Kudzai Ncube", "Enumerator", zdhs.id, "Bulawayo Province"],
      ["ZS-SUP-0217", "Farai Dube", "Field supervisor", zdhs.id, "Manicaland Province, Mutare and Chipinge"],
      ["ZS-ENU-2088", "Nyasha Chirwa", "Enumerator", mics.id, "Midlands Province, Gweru and Kwekwe"],
      ["ZS-ENU-2089", "Blessing Sibanda", "Listing officer", mics.id, "Matabeleland North, Hwange"],
    ];
    for (const [badgeNo, name, role, surveyId, area] of officers) { await prisma.fieldOfficer.create({ data: { orgId, badgeNo, name, role, surveyId, area, validFrom: inDays(-60), validTo: inDays(90) } }); added++; }
    await prisma.fieldOfficer.create({ data: { orgId, badgeNo: "ZS-ENU-0931", name: "Tendai Gumbo", role: "Enumerator", area: "Mashonaland East", validFrom: inDays(-400), validTo: inDays(-200), isActive: false } }); added++;
  }

  // point the bot at the right categories if nothing is configured yet
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
  const settings = JSON.parse(org?.settings || "{}") as { cases?: { whatsapp?: Record<string, unknown> } };
  const wa = settings.cases?.whatsapp || {};
  if (!wa.dataRequestCategoryId || !wa.verificationCategoryId) {
    const all = await prisma.caseCategory.findMany({ where: { orgId }, select: { id: true, name: true } });
    const find = (re: RegExp) => all.find((c) => re.test(c.name))?.id;
    settings.cases = { ...(settings.cases || {}), whatsapp: { odpUrl: ODP, ...wa, dataRequestCategoryId: wa.dataRequestCategoryId || find(/statistical data request|data request/i), verificationCategoryId: wa.verificationCategoryId || find(/field officer verification/i), liveChatCategoryId: wa.liveChatCategoryId || null, greeting: wa.greeting || "Welcome to ZIMSTAT, the Zimbabwe National Statistics Agency. How can we help you today?" } };
    await prisma.organization.update({ where: { id: orgId }, data: { settings: JSON.stringify(settings) } });
  }
  return added;
}

if (require.main === module) {
  (async () => {
    const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
    if (!org) throw new Error("No organisation found. Run the main seed first.");
    const n = await applyChatbotSeed(org.id);
    console.log(`Chatbot content for ${org.name}: ${n} records added.`);
  })().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
}
