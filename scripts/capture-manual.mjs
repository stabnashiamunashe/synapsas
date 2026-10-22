// Captures the screenshots used by the user manual from a running dev server.
//   BASE=http://localhost:53003 node scripts/capture-manual.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";
import path from "path";

const BASE = process.env.BASE || "http://localhost:53003";
const OUT = path.resolve("docs/manual/images");
mkdirSync(OUT, { recursive: true });
const PASS = "Password123!";

const browser = await chromium.launch({ channel: "chrome" });
async function ctx(email, viewport = { width: 1366, height: 900 }) {
  const c = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (email) {
    const r = await c.request.post(`${BASE}/api/auth/login`, { data: { email, password: PASS }, headers: { origin: BASE } });
    if (!r.ok()) throw new Error(`login ${email} -> ${r.status()}`);
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
    // Sticky header/sidebar paint mid-page in full-page captures; pin them for the shot.
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
  await p.goto(`${BASE}/`); await shot(p, "01-landing");
  await p.goto(`${BASE}/login?org=acme`); await shot(p, "02-login");
  await p.goto(`${BASE}/register`); await shot(p, "03-register");
  await c.close();
}

// ---- owner ----
{
  const c = await ctx("owner@acme.test");
  const p = await c.newPage();
  const templates = (await api(c, "/api/templates?all=1")).data;
  const ts = templates.find((t) => t.prefix === "TS");
  const projects = (await api(c, "/api/projects?all=1")).data;
  const fieldOps = projects.find((x) => x.code === "FIELD-OPS");
  const reqs = (await api(c, "/api/requests?scope=all&pageSize=50")).data.items;
  const tsReq = reqs.find((r) => r.referenceNo.startsWith("TS-") && r.status === "APPROVED") || reqs[0];

  await p.goto(`${BASE}/app/onboarding`); await shot(p, "04-onboarding");
  await p.goto(`${BASE}/app`); await shot(p, "05-dashboard", { full: true });
  await p.goto(`${BASE}/app/requests`); await shot(p, "11-requests-list");
  await p.goto(`${BASE}/app/requests/${tsReq.id}`); await shot(p, "10-request-approved", { full: true });
  await p.goto(`${BASE}/app/projects`); await shot(p, "12-projects");
  await p.goto(`${BASE}/app/projects/${fieldOps.id}`); await shot(p, "13-project-detail", { full: true });
  await p.goto(`${BASE}/app/templates`); await shot(p, "14-workflows");
  await byText(p, "button", "Quick create").click(); await p.waitForSelector(".ant-modal"); await shot(p, "15-quick-create");
  await p.keyboard.press("Escape");
  await p.goto(`${BASE}/app/templates/${ts.id}`); await shot(p, "16-builder-fields", { full: true });
  await byText(p, ".ant-tabs-tab-btn", "canvas").click(); await p.waitForTimeout(800); await shot(p, "17-builder-canvas");
  await p.locator(".react-flow__node-level").nth(1).click(); await p.waitForSelector(".ant-drawer-open"); await p.waitForTimeout(500); await shot(p, "18-level-settings");
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  await byText(p, ".ant-tabs-tab-btn", "Rules").click(); await p.waitForTimeout(500); await shot(p, "19-builder-rules", { full: true });
  await byText(p, ".ant-tabs-tab-btn", "Preview").click(); await p.waitForTimeout(500); await shot(p, "20-builder-preview", { full: true });
  await p.goto(`${BASE}/app/users`); await shot(p, "21-people");
  await p.goto(`${BASE}/app/departments`); await shot(p, "22-departments");
  await p.goto(`${BASE}/app/notifications`); await shot(p, "23-notifications");
  await p.goto(`${BASE}/app/settings/delegations`); await shot(p, "24-out-of-office");
  await p.goto(`${BASE}/app/reports`); await shot(p, "25-reports", { full: true });
  await p.goto(`${BASE}/app/audit`); await shot(p, "26-audit");
  await p.goto(`${BASE}/app/settings/branding`); await shot(p, "27-settings-branding", { full: true });
  await p.goto(`${BASE}/app/settings/organization`); await shot(p, "28-settings-organisation", { full: true });
  await p.goto(`${BASE}/app/settings/billing`); await shot(p, "29-settings-billing", { full: true });
  await p.goto(`${BASE}/app/settings/api`); await shot(p, "30-settings-api");
  await p.goto(`${BASE}/app/profile`); await shot(p, "31-profile");
  await p.goto(`${BASE}/app/profile?tab=security`); await shot(p, "32-profile-security");
  await p.goto(`${BASE}/app/profile?tab=notifications`); await shot(p, "33-profile-notifications");
  await c.close();
}

// ---- member: raising a request ----
{
  const c = await ctx("member@acme.test");
  const p = await c.newPage();
  const ts = (await api(c, "/api/templates?active=1")).data.find((t) => t.prefix === "TS");
  const fieldOps = (await api(c, "/api/projects")).data.find((x) => x.code === "FIELD-OPS");
  await p.goto(`${BASE}/app/requests/new`); await shot(p, "06-new-request-pick");
  await p.goto(`${BASE}/app/requests/new?template=${ts.id}&project=${fieldOps.id}`);
  await settle(p);
  await p.fill("input[placeholder='Bulawayo']", "Mutare");
  await p.fill("textarea[placeholder='Who you are meeting and why']", "Quarterly stock count at the Mutare warehouse.");
  await byText(p, "button", "Add row").click(); await p.waitForTimeout(300);
  const row = p.locator("tr.ant-table-row").first();
  await row.locator("input[role=spinbutton]").nth(0).fill("2");
  await row.locator("input[role=spinbutton]").nth(1).fill("85");
  await p.keyboard.press("Tab");
  await shot(p, "07-new-request-form", { full: true });
  await c.close();
}

// ---- manager: inbox and decision ----
{
  const c = await ctx("manager@acme.test");
  const p = await c.newPage();
  await p.goto(`${BASE}/app/inbox`); await shot(p, "08-inbox");
  const inbox = (await api(c, "/api/inbox")).data;
  if (inbox.length) {
    await p.goto(`${BASE}/app/requests/${inbox[0].request.id}`); await shot(p, "09-request-decision", { full: true });
    await byText(p, "button", "Approve").first().click(); await p.waitForSelector(".ant-modal"); await p.waitForTimeout(400);
    await shot(p, "09b-approve-modal");
    await p.keyboard.press("Escape");
  }
  await c.close();
}

// ---- platform console ----
{
  const c = await ctx(null);
  const p = await c.newPage();
  await p.goto(`${BASE}/platform`); await settle(p);
  await p.fill("input[type=password]", process.env.PLATFORM_ADMIN_KEY || "change-me-platform-admin-key");
  await byText(p, "button", "Load workspaces").click(); await p.waitForTimeout(1500);
  await shot(p, "34-platform-console");
  await c.close();
}

// ---- mobile ----
{
  const c = await ctx("owner@acme.test", { width: 390, height: 844 });
  const p = await c.newPage();
  await p.goto(`${BASE}/app`); await settle(p);
  await p.click("button[aria-label='Open navigation']"); await p.waitForTimeout(500);
  await shot(p, "35-mobile-nav");
  await c.close();
}

await browser.close();
console.log("done ->", OUT);
