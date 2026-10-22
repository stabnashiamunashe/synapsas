// End-to-end billing check against a running dev server (manual provider). Creates a throwaway workspace.
import { PrismaClient } from "@prisma/client";
const BASE = "http://localhost:3000", KEY = process.env.PLATFORM_ADMIN_KEY || "change-me-platform-admin-key", CRON = process.env.CRON_SECRET || "dev-cron-secret";
const prisma = new PrismaClient();
let cookie = "";
async function call(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}), ...(opts.headers || {}) }, body: opts.json ? JSON.stringify(opts.json) : undefined });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  return { status: res.status, body: await res.json().catch(() => null) };
}
const log = (l, v) => console.log(l.padEnd(40), typeof v === "string" ? v : JSON.stringify(v));
const slug = "smoke" + Date.now().toString(36);

// 1. Register -> trial
let r = await call("/api/auth/register", { method: "POST", json: { orgName: "Smoke Co", slug, name: "Sam Smoke", email: `sam@${slug}.test`, password: "StrongPass123x" } });
log("register", r.status);
let me = (await call("/api/auth/me")).body.data;
log("trial status / plan / days / onboarding", [me.billing.status, me.billing.plan, me.billing.trialDaysLeft, me.onboarding.completed]);

// 2. Onboarding completes with presets + invites
r = await call("/api/onboarding", { method: "POST", json: { orgName: "Smoke Co Ltd", currency: "USD", invites: [{ email: `bob@${slug}.test`, role: "MANAGER" }], presets: ["REQUISITION", "MEMO"] } });
log("onboarding", [r.status, r.body.data.created, r.body.data.invites.length]);

// 3. Checkout (manual) -> pending invoice with bank instructions
r = await call("/api/billing/checkout", { method: "POST", json: { plan: "STARTER", cycle: "yearly" } });
const inv = r.body.data.invoice; log("checkout invoice", [r.status, inv.number, inv.amountCents / 100, inv.status, !!r.body.data.instructions]);
r = await call("/api/billing/status"); log("status shows open invoice", [r.body.data.openInvoice?.number, r.body.data.entitlements.status]);

// 4. Operator marks paid -> ACTIVE on STARTER
r = await call("/api/admin/billing", { method: "POST", headers: { "x-platform-key": KEY }, json: { action: "markPaid", invoiceId: inv.id, reference: "BANK-123" } });
log("operator markPaid", [r.status, r.body.data?.status]);
me = (await call("/api/auth/me")).body.data; log("now", [me.billing.status, me.billing.plan, me.billing.renewsAt?.slice(0, 10)]);

// 5. Simulate lapse past grace -> locked (writes 402, reads OK)
const org = await prisma.organization.findUnique({ where: { slug } });
await prisma.organization.update({ where: { id: org.id }, data: { planStatus: "PAST_DUE", graceEndsAt: new Date(Date.now() - 86400000) } });
me = (await call("/api/auth/me")).body.data; log("locked?", [me.billing.status, me.billing.locked, me.billing.plan]);
r = await call("/api/departments", { method: "POST", json: { name: "Ops" } }); log("write while locked", [r.status, r.body?.error?.slice(0, 60)]);
r = await call("/api/departments"); log("read while locked", r.status);
r = await call("/api/billing/checkout", { method: "POST", json: { plan: "STARTER", cycle: "monthly" } }); log("checkout allowed while locked", r.status);
r = await call("/api/admin/billing", { method: "POST", headers: { "x-platform-key": KEY }, json: { action: "markPaid", invoiceId: r.body.data.invoice.id } });
me = (await call("/api/auth/me")).body.data; log("after paying", [me.billing.status, me.billing.locked]);
r = await call("/api/departments", { method: "POST", json: { name: "Ops" } }); log("write after paying", r.status);

// 6. Cron: expired trial -> EXPIRED (Free limits); lapsed ACTIVE -> PAST_DUE + renewal invoice
await prisma.organization.update({ where: { id: org.id }, data: { planStatus: "TRIALING", trialEndsAt: new Date(Date.now() - 1000) } });
r = await call("/api/cron/billing", { method: "POST", headers: { authorization: `Bearer ${CRON}` } }); log("sweep (trial expiry)", r.body.data);
me = (await call("/api/auth/me")).body.data; log("after trial expiry", [me.billing.status, me.billing.plan, me.billing.limits.users]);
await prisma.organization.update({ where: { id: org.id }, data: { plan: "BUSINESS", planStatus: "ACTIVE", planRenewsAt: new Date(Date.now() - 1000), billingProvider: "manual" } });
r = await call("/api/cron/billing", { method: "POST", headers: { authorization: `Bearer ${CRON}` } }); log("sweep (renewal due)", r.body.data);
r = await call("/api/billing/status"); log("renewal invoice raised", [r.body.data.entitlements.status, r.body.data.entitlements.graceDaysLeft, r.body.data.openInvoice?.number]);
log("bad platform key", (await call("/api/admin/billing", { headers: { "x-platform-key": "nope" } })).status);

// cleanup
await prisma.organization.delete({ where: { id: org.id } });
await prisma.$disconnect();
console.log("cleanup done");
