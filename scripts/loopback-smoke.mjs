const BASE = "http://localhost:3000";
const jar = {};
async function call(who, path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { "content-type": "application/json", origin: BASE, ...(jar[who] ? { cookie: jar[who] } : {}) }, body: opts.json ? JSON.stringify(opts.json) : undefined });
  const sc = res.headers.get("set-cookie"); if (sc) jar[who] = sc.split(";")[0];
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${body?.error} ${JSON.stringify(body?.details || "")}`);
  return body.data;
}
const login = (who, email) => call(who, "/api/auth/login", { method: "POST", json: { email, password: "Password123!" } });
await login("owner", "owner@acme.test"); await login("member", "member@acme.test"); await login("manager", "manager@acme.test"); await login("head", "ops.head@acme.test");

// 1. Owner creates a two-stage workflow; stage 2 loops back to stage 1 on return.
const t = await call("owner", "/api/templates", { method: "POST", json: {
  name: "Loopback test", category: "MEMO", prefix: "LOOP",
  fields: [{ key: "subject", label: "Subject", type: "text", required: true }],
  levels: [
    { id: "a", order: 1, name: "Manager check", approverType: "REQUESTER_MANAGER", mode: "ANY", allowReturn: true },
    { id: "b", order: 2, name: "Head sign-off", approverType: "DEPARTMENT_HEAD", mode: "ANY", allowReturn: true, returnTo: 1 },
  ], settings: {},
}});
console.log("template created", t.id, "level2.returnTo =", t.levels[1].returnTo);

// 2. Member submits; manager approves; head returns -> should loop back to level 1 (still PENDING).
const r = await call("member", "/api/requests", { method: "POST", json: { templateId: t.id, title: "Loop me", data: { subject: "Loop me" }, submit: true } });
console.log("submitted", r.referenceNo, "status", r.status, "level", r.currentLevel);
await call("manager", `/api/requests/${r.id}/action`, { method: "POST", json: { action: "APPROVE", comment: "ok" } });
let d = await call("head", `/api/requests/${r.id}`); console.log("after manager approve -> level", d.currentLevel, d.status);
await call("head", `/api/requests/${r.id}/action`, { method: "POST", json: { action: "RETURN", comment: "Please re-check the numbers" } });
d = await call("manager", `/api/requests/${r.id}`);
console.log("after head RETURN -> level", d.currentLevel, "status", d.status, "| manager can act again:", d.permissions.canAct);
console.log("history:", d.approvals.map(a => `L${a.levelOrder} ${a.approver.name}: ${a.status}`).join(" | "));
console.log("system comments:", d.comments.filter(c => c.isSystem).map(c => c.body).join(" || "));

// 3. Manager approves again, head approves -> APPROVED.
await call("manager", `/api/requests/${r.id}/action`, { method: "POST", json: { action: "APPROVE" } });
await call("head", `/api/requests/${r.id}/action`, { method: "POST", json: { action: "APPROVE" } });
d = await call("owner", `/api/requests/${r.id}`); console.log("final status:", d.status);

// 4. Validation: a loop to a later level is rejected.
try { await call("owner", `/api/templates/${t.id}`, { method: "PUT", json: { ...t, levels: [{ ...t.levels[0], returnTo: 2 }, t.levels[1]] } }); console.log("VALIDATION FAILED TO REJECT"); }
catch (e) { console.log("forward loop rejected:", e.message.split("->")[1].trim()); }
