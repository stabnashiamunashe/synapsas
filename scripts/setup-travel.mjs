// Demo setup: Travel & Subsistence workflow (line manager -> department head -> head office) + a travel project.
const BASE = process.env.BASE || "http://localhost:53003";
let cookie = "";
async function call(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}) }, body: opts.json ? JSON.stringify(opts.json) : undefined });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${body?.error} ${JSON.stringify(body?.details || "")}`);
  return body.data;
}
await call("/api/auth/login", { method: "POST", json: { email: "owner@acme.test", password: "Password123!" } });
const users = await call("/api/users");
const cfo = users.find((u) => u.email === "cfo@acme.test");
const owner = users.find((u) => u.email === "owner@acme.test");

// "Head office" = CFO or CEO, either may sign (ANY)
const existing = (await call("/api/templates")).find((t) => t.prefix === "TS");
const payload = {
  name: "Travel & subsistence", category: "EXPENSE", prefix: "TS", icon: "✈️", color: "#0ea5e9",
  description: "Request approval and a cash advance for business travel. Line manager, then department head, then head office.",
  fields: [
    { key: "destination", label: "Destination", type: "text", required: true, width: "half", placeholder: "Bulawayo" },
    { key: "dates", label: "Travel dates", type: "daterange", required: true, width: "half" },
    { key: "purpose", label: "Purpose of travel", type: "textarea", required: true, width: "full", placeholder: "Who you are meeting and why" },
    { key: "transport", label: "Mode of transport", type: "select", options: ["Company vehicle", "Own vehicle", "Hired car", "Bus", "Air"], required: true, width: "third" },
    { key: "nights", label: "Nights away", type: "number", min: 0, width: "third" },
    { key: "costCentre", label: "Cost centre", type: "select", options: ["Operations", "Sales", "IT", "HR", "Finance"], required: true, width: "third" },
    { key: "estimate", label: "Estimated costs", type: "table", required: true, minRows: 1, totalColumn: "amount", width: "full", columns: [
      { key: "item", label: "Item", type: "select", options: ["Accommodation", "Per diem", "Fuel", "Fares", "Airtime", "Other"], required: true, width: 160 },
      { key: "detail", label: "Detail", type: "text" },
      { key: "qty", label: "Qty / days", type: "number", required: true, width: 100 },
      { key: "rate", label: "Rate", type: "currency", required: true, width: 120 },
      { key: "amount", label: "Amount", type: "computed", formula: "qty * rate", sum: true, width: 130 },
    ] },
    { key: "advance", label: "Cash advance required", type: "checkbox", width: "half", placeholder: "Pay the estimate as an advance before travel" },
    { key: "notes", label: "Notes for approvers", type: "textarea", width: "full" },
  ],
  levels: [
    { id: "ts1", order: 1, name: "Line manager approval", description: "Confirm the trip is needed and the dates work for the team.", approverType: "REQUESTER_MANAGER", mode: "ANY", slaHours: 24, allowDelegate: true, allowReturn: true, skipIfRequester: true, fallbackUserId: owner.id },
    { id: "ts2", order: 2, name: "Department head approval", description: "Confirm budget availability in the department.", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true, skipIfRequester: true, returnTo: 1, fallbackUserId: owner.id },
    { id: "ts3", order: 3, name: "Head office approval", description: "Final sign-off and release of the advance.", approverType: "USER", approverUserIds: [cfo.id, owner.id], mode: "ANY", slaHours: 72, allowDelegate: true, allowReturn: true, requireComment: true },
  ],
  settings: { titleTemplate: "T&S: {{destination}}", allowAttachments: true, dueInDays: 5, notifyRequesterOnEachLevel: true, allowRequesterCancel: true, costField: "estimateTotal", defaultPriority: "NORMAL" },
  isActive: true,
};
const t = existing ? await call(`/api/templates/${existing.id}`, { method: "PUT", json: payload }) : await call("/api/templates", { method: "POST", json: payload });
console.log("workflow", t.id, t.name, "levels:", t.levels.map((l) => l.name).join(" -> "), "cost field:", t.settings.costField);

const projects = await call("/api/projects?all=1");
let p = projects.find((x) => x.code === "FIELD-OPS");
if (!p) p = await call("/api/projects", { method: "POST", json: { code: "FIELD-OPS", name: "Field operations 2026", budgetAmount: 20000, currency: "USD", ownerUserId: users.find((u) => u.email === "ops.head@acme.test")?.id, description: "Site visits, audits and client meetings outside Harare." } });
console.log("project", p.code, p.name, "budget", p.budgetAmount);
console.log("TEMPLATE_ID=" + t.id); console.log("PROJECT_ID=" + p.id);
