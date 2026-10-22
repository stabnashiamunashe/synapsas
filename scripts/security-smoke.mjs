import { TOTP, Secret } from "otpauth";
const BASE = "http://localhost:3000";
let cookie = "";
async function call(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}), ...(opts.headers || {}) }, body: opts.json ? JSON.stringify(opts.json) : undefined });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  let body = null; try { body = await res.json(); } catch {}
  return { status: res.status, body };
}
const log = (label, r) => console.log(label.padEnd(34), r.status, JSON.stringify(r.body?.data ?? r.body?.error ?? "").slice(0, 110));

// 1. Lockout: 5 wrong passwords for jane -> 423 on 6th
for (let i = 1; i <= 5; i++) { const r = await call("/api/auth/login", { method: "POST", json: { email: "jane@acme.test", password: "wrong-pass-" + i } }); if (i === 5) log("5th wrong password", r); }
log("login while locked", await call("/api/auth/login", { method: "POST", json: { email: "jane@acme.test", password: "Password123!" } }));

// 2. Owner unlocks jane
cookie = "";
log("owner login", await call("/api/auth/login", { method: "POST", json: { email: "owner@acme.test", password: "Password123!" } }));
const users = await call("/api/users?all=1"); const jane = users.body.data.find(u => u.email === "jane@acme.test");
log("owner unlock jane", await call(`/api/users/${jane.id}`, { method: "POST" }));
log("csrf: cross-site POST blocked", await call("/api/notifications", { method: "POST", headers: { origin: "https://evil.example" } }));

// 3. Jane enrols 2FA
cookie = "";
log("jane login (no 2fa)", await call("/api/auth/login", { method: "POST", json: { email: "jane@acme.test", password: "Password123!" } }));
const setup = await call("/api/auth/2fa/setup", { method: "POST" }); log("2fa setup", setup);
const totp = new TOTP({ secret: Secret.fromBase32(setup.body.data.secret), digits: 6, period: 30 });
const enable = await call("/api/auth/2fa/enable", { method: "POST", json: { code: totp.generate() } }); log("2fa enable", { status: enable.status, body: { data: { backupCodes: enable.body.data.backupCodes.length } } });
const backup = enable.body.data.backupCodes[0];
log("logout", await call("/api/auth/logout", { method: "POST" }));

// 4. Login now requires 2FA; wrong code rejected; TOTP accepted; backup code accepted once
cookie = "";
const step1 = await call("/api/auth/login", { method: "POST", json: { email: "jane@acme.test", password: "Password123!" } }); log("login -> challenge", { status: step1.status, body: { data: { twoFactorRequired: step1.body.data.twoFactorRequired } } });
log("wrong code", await call("/api/auth/2fa/verify", { method: "POST", json: { challenge: step1.body.data.challenge, code: "000000" } }));
log("totp code", await call("/api/auth/2fa/verify", { method: "POST", json: { challenge: step1.body.data.challenge, code: totp.generate() } }));
const me = await call("/api/auth/me"); log("me.twoFactorEnabled", { status: me.status, body: { data: { twoFactorEnabled: me.body.data.user.twoFactorEnabled, backupCodesLeft: me.body.data.user.backupCodesLeft } } });

// 5. Sign out everywhere invalidates old cookie
const oldCookie = cookie;
log("revoke sessions", await call("/api/auth/sessions/revoke", { method: "POST" }));
const newCookie = cookie; cookie = oldCookie;
log("old cookie rejected", await call("/api/auth/me"));
cookie = newCookie; log("new cookie works", { status: (await call("/api/auth/me")).status, body: {} });

// 6. Backup code login, then weak password rejected on change
cookie = "";
const s2 = await call("/api/auth/login", { method: "POST", json: { email: "jane@acme.test", password: "Password123!" } });
log("backup code login", await call("/api/auth/2fa/verify", { method: "POST", json: { challenge: s2.body.data.challenge, code: backup } }));
log("weak password rejected", await call("/api/auth/password/change", { method: "POST", json: { currentPassword: "Password123!", newPassword: "password" } }));
log("disable 2fa (cleanup)", await call("/api/auth/2fa/disable", { method: "POST", json: { password: "Password123!", code: totp.generate() } }));

// 7. Forgot password always 200
cookie = "";
log("forgot (unknown email)", await call("/api/auth/password/forgot", { method: "POST", json: { email: "nobody@acme.test" } }));
