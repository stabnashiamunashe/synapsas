// Project cost aggregation check against a running dev server. Uses the Acme demo workspace.
const BASE = process.env.BASE || "http://localhost:53003";
const jar = {};
async function call(who, path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { "content-type": "application/json", origin: BASE, ...(jar[who] ? { cookie: jar[who] } : {}) }, body: opts.json ? JSON.stringify(opts.json) : undefined });
  const sc = res.headers.get("set-cookie"); if (sc) jar[who] = sc.split(";")[0];
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${body?.error} ${JSON.stringify(body?.details || "")}`);
  return body.data;
}
const login = (w, e) => call(w, "/api/auth/login", { method: "POST", json: { email: e, password: "Password123!" } });
const log = (l, v) => console.log(l.padEnd(42), typeof v === "string" ? v : JSON.stringify(v));
await login("owner", "owner@acme.test"); await login("member", "member@acme.test"); await login("manager", "manager@acme.test"); await login("proc", "procurement@acme.test"); await login("cfo", "cfo@acme.test");

const code = "FITOUT-" + Date.now().toString(36).toUpperCase().slice(-4);
const proj = await call("owner", "/api/projects", { method: "POST", json: { code, name: "Head office fit-out", budgetAmount: 10000, currency: "USD" } });
log("project created", [proj.code, proj.summary.budget, proj.summary.requests]);

const templates = await call("owner", "/api/templates?active=1");
const pr = templates.find((t) => t.category === "REQUISITION");
const raise = async (desc, qty, price, submit = true) =>
  call("member", "/api/requests", { method: "POST", json: { templateId: pr.id, projectId: proj.id, priority: "NORMAL", submit, data: { purpose: desc, costCentre: "Operations", items: [{ description: desc, quantity: qty, unitPrice: price }] } } });

const r1 = await raise("Desks", 10, 450);            // 4500 -> manager + procurement (CFO skipped, < 5000)
const r2 = await raise("Chairs", 20, 320);           // 6400 -> manager + procurement + CFO
const r3 = await raise("Paint (draft)", 5, 80, false); // 400 draft
log("costs recorded", [r1.costAmount ?? r1.data?.itemsTotal, r2.costAmount, r3.status]);
let d = await call("owner", `/api/projects/${proj.id}`);
log("after raising: pending/draft/approved", [d.summary.pending, d.summary.draft, d.summary.approved, "remainingAfterPending", d.summary.remainingAfterPending]);

// approve r1 fully
await call("manager", `/api/requests/${r1.id}/action`, { method: "POST", json: { action: "APPROVE" } });
await call("proc", `/api/requests/${r1.id}/action`, { method: "POST", json: { action: "APPROVE" } });
// approve r2 through manager + procurement, CFO rejects
await call("manager", `/api/requests/${r2.id}/action`, { method: "POST", json: { action: "APPROVE" } });
await call("proc", `/api/requests/${r2.id}/action`, { method: "POST", json: { action: "APPROVE" } });
await call("cfo", `/api/requests/${r2.id}/action`, { method: "POST", json: { action: "REJECT", comment: "Over budget this quarter" } });
d = await call("owner", `/api/projects/${proj.id}`);
log("after decisions: approved/rejected/pending", [d.summary.approved, d.summary.rejected, d.summary.pending]);
log("budget / remaining / utilisation", [d.summary.budget, d.summary.remaining, Math.round(d.summary.utilisation * 100) + "%"]);
log("by workflow", d.byTemplate.map((t) => `${t.name}: ${t.count} req, approved ${t.approved}`));
log("by month", d.byMonth);
log("requests on project", d.requests.map((r) => `${r.referenceNo} ${r.status} ${r.costAmount}`));

// list filter + CSV
const list = await call("owner", `/api/requests?projectId=${proj.id}&scope=all`);
log("requests filtered by project", list.total);
const csv = await fetch(`${BASE}/api/projects/${proj.id}/export`, { headers: { cookie: jar.owner, origin: BASE } }).then((r) => r.text());
log("csv tail", csv.trim().split("\n").slice(-3).join(" | "));

// closed project rejects new requests; requireProject enforced
await call("owner", `/api/projects/${proj.id}`, { method: "PATCH", json: { status: "CLOSED" } });
try { await raise("Late item", 1, 10); log("closed project accepted request", "FAIL"); } catch (e) { log("closed project blocks request", e.message.split("->")[1].trim().slice(0, 70)); }
const summary = await call("owner", "/api/projects?all=1");
log("projects list includes closed", summary.some((p) => p.id === proj.id && p.status === "CLOSED"));
