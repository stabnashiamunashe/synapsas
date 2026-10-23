// Captures the screenshots used by the ZimStat user manual from a running dev server seeded with prisma/seed.ts.
//   BASE=http://localhost:3000 node scripts/capture-manual.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
import path from "path";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = path.resolve("docs/manual/images");
mkdirSync(OUT, { recursive: true });
const PASS = "Password123!";

const browser = await chromium.launch({ channel: "chrome" });
async function ctx(email, viewport = { width: 1366, height: 900 }) {
  const c = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (email) {
    const r = await c.request.post(`${BASE}/api/auth/login`, { data: { email, password: PASS }, headers: { origin: BASE } });
    if (!r.ok()) throw new Error(`login ${email} -> ${r.status()} ${await r.text()}`);
  }
  return c;
}
async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForSelector(".ant-skeleton", { state: "detached", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
}
async function shot(page, name, { full = false, clip } = {}) {
  await settle(page);
  if (full) {
    await page.addStyleTag({ content: ".ant-layout-header{position:static!important}.ant-layout-sider{position:absolute!important;top:0!important;height:100%!important;min-height:100vh}.ant-layout{position:relative}" });
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full, clip });
  console.log("captured", name);
}
const byText = (page, sel, text) => page.locator(sel, { hasText: text }).first();
const api = async (c, p) => (await c.request.get(`${BASE}${p}`, { headers: { origin: BASE } })).json();

// ---- public pages ----
{
  const c = await ctx(null);
  const p = await c.newPage();
  await p.goto(`${BASE}/login`); await shot(p, "01-login");
  await p.goto(`${BASE}/report`); await shot(p, "02-report", { full: true });
  const ref = (await api(c, "/api/public/portal")) ? "ZS-2026-0001" : "";
  await p.goto(`${BASE}/track/${ref}`); await shot(p, "03-track", { full: true });
  await c.close();
}

// ---- administrator (ICT) ----
{
  const c = await ctx("ict.admin@zimstat.co.zw");
  const p = await c.newPage();
  const templates = (await api(c, "/api/templates?all=1")).data;
  const tsa = templates.find((t) => t.prefix === "TSA");
  const reqs = (await api(c, "/api/requests?scope=all&pageSize=50")).data.items;
  const approved = reqs.find((r) => r.referenceNo.startsWith("TSA-")) || reqs[0];
  const leave = reqs.find((r) => r.referenceNo.startsWith("AL-")) || reqs[0];
  const projects = (await api(c, "/api/projects?all=1")).data;
  const zdhs = projects.find((x) => x.code === "ZDHS") || projects[0];

  await p.goto(`${BASE}/app`); await shot(p, "04-dashboard", { full: true });
  await p.goto(`${BASE}/app/requests`); await shot(p, "10-requests-list");
  await p.goto(`${BASE}/app/requests/${approved.id}`); await shot(p, "11-request-approved", { full: true });
  await p.goto(`${BASE}/app/requests/${leave.id}`); await shot(p, "12-leave-balance", { full: true });
  await p.goto(`${BASE}/app/projects`); await shot(p, "13-projects");
  await p.goto(`${BASE}/app/projects/${zdhs.id}`); await shot(p, "14-project-detail", { full: true });
  await p.goto(`${BASE}/app/templates`); await shot(p, "15-workflows");
  await p.goto(`${BASE}/app/templates/${tsa.id}`); await shot(p, "16-builder-fields", { full: true });
  await byText(p, ".ant-tabs-tab-btn", "canvas").click(); await p.waitForTimeout(800); await shot(p, "17-builder-canvas");
  await p.locator(".react-flow__node-level").nth(1).click(); await p.waitForSelector(".ant-drawer-open"); await p.waitForTimeout(500); await shot(p, "18-level-settings");
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  // service desk
  await p.goto(`${BASE}/app/cases`); await shot(p, "20-cases-board");
  await p.locator(".ant-segmented-item", { hasText: "Table" }).click(); await p.waitForTimeout(800); await shot(p, "21-cases-table");
  await p.locator(".ant-segmented-item", { hasText: "Board" }).click(); await p.waitForTimeout(800);
  const cases = (await api(c, "/api/cases?pageSize=5")).data.items;
  const openCase = cases.find((x) => x.status === "IN_PROGRESS") || cases[0];
  await p.goto(`${BASE}/app/cases?open=${openCase.id}`); await p.waitForSelector(".ant-drawer-open"); await p.waitForTimeout(1200); await shot(p, "22-case-drawer");
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  await p.goto(`${BASE}/app/cases/new`); await shot(p, "23-case-new", { full: true });
  await p.goto(`${BASE}/app/cases/categories`); await shot(p, "24-case-categories");
  // people, sections, settings
  await p.goto(`${BASE}/app/users`); await shot(p, "30-people");
  await p.goto(`${BASE}/app/departments`); await shot(p, "31-sections");
  await p.goto(`${BASE}/app/notifications`); await shot(p, "32-notifications");
  await p.goto(`${BASE}/app/settings/delegations`); await shot(p, "33-out-of-office");
  await p.goto(`${BASE}/app/reports`); await shot(p, "34-reports", { full: true });
  await p.goto(`${BASE}/app/audit`); await shot(p, "35-audit");
  await p.goto(`${BASE}/app/settings/branding`); await shot(p, "40-settings-branding", { full: true });
  await p.goto(`${BASE}/app/settings/organization`); await shot(p, "41-settings-organisation", { full: true });
  await p.goto(`${BASE}/app/settings/service-desk`); await shot(p, "42-settings-service-desk", { full: true });
  await p.goto(`${BASE}/app/settings/whatsapp`); await settle(p);
  await p.locator("button", { hasText: /^Send$/ }).click(); await p.waitForTimeout(1500);
  await byText(p, "button", "Report an issue").click(); await p.waitForTimeout(1500);
  await shot(p, "43-settings-whatsapp", { full: true });
  await p.goto(`${BASE}/app/settings/api`); await shot(p, "44-settings-api");
  await p.goto(`${BASE}/app/profile?tab=security`); await shot(p, "45-profile-security");
  await c.close();
}

// ---- officer: raising a T&S advance ----
{
  const c = await ctx("l.officer@zimstat.co.zw");
  const p = await c.newPage();
  const tsa = (await api(c, "/api/templates?active=1")).data.find((t) => t.prefix === "TSA");
  const zdhs = (await api(c, "/api/projects")).data.find((x) => x.code === "ZDHS");
  await p.goto(`${BASE}/app/requests/new`); await shot(p, "05-new-request-pick");
  await p.goto(`${BASE}/app/requests/new?template=${tsa.id}&project=${zdhs.id}`); await settle(p);
  await p.fill("input[placeholder='e.g. 6118542N']", "0000000X");
  await p.fill("input[placeholder='e.g. Kadoma']", "Mutare");
  await p.fill("textarea[placeholder='e.g. ZDHS report finalisation']", "ZDHS data quality review, Manicaland province.");
  await byText(p, "button", "Add row").click(); await p.waitForTimeout(300);
  await shot(p, "06-new-request-form", { full: true });
  await c.close();
}

// ---- section head: inbox and decision ----
{
  const c = await ctx("field.supervisor@zimstat.co.zw");
  const p = await c.newPage();
  await p.goto(`${BASE}/app/inbox`); await shot(p, "07-inbox");
  const inbox = (await api(c, "/api/inbox")).data;
  if (inbox.length) {
    await p.goto(`${BASE}/app/requests/${inbox[0].request.id}`); await shot(p, "08-request-decision", { full: true });
    await byText(p, "button", "Approve").first().click(); await p.waitForSelector(".ant-modal"); await p.waitForTimeout(400);
    await shot(p, "09-approve-modal");
    await p.keyboard.press("Escape");
  }
  await c.close();
}

// ---- mobile ----
{
  const c = await ctx("ict.admin@zimstat.co.zw", { width: 390, height: 844 });
  const p = await c.newPage();
  await p.goto(`${BASE}/app/cases`); await settle(p);
  await p.click("button[aria-label='Open navigation']"); await p.waitForTimeout(500);
  await shot(p, "50-mobile-nav");
  await c.close();
}

await browser.close();
console.log("done ->", OUT);
