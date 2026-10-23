// Security helpers aligned with OWASP ASVS 4.0 (V2 authentication, V3 session, V4 access control, V13 API).
// password policy (2.1), breached-password check (2.1.7), request fingerprinting, rate limiting (2.2.1),
// CSRF defence for cookie sessions (4.2.2), token helpers (3.2 / 2.5).
import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
  description: "At least 12 characters. Mix upper and lower case letters with a number. Not a common or previously breached password.",
};

// Most common passwords that still pass the composition rules (normalised to lower case).
const COMMON = new Set([
  "password123", "password1234", "password12345", "passw0rd1234", "welcome123!", "welcome12345", "qwerty12345", "qwerty123456",
  "admin12345", "admin123456", "letmein12345", "changeme123", "changeme1234", "iloveyou1234", "football1234", "sunshine1234",
  "princess1234", "monkey123456", "dragon123456", "baseball1234", "superman1234", "trustno1trustno1", "summer2024!", "summer2025!",
  "winter2024!", "winter2025!", "spring2025!", "autumn2025!", "january2025!", "company2025!", "synapsas123!", "synapsas2025!",
]);

export function passwordProblems(pw: string, context: string[] = []): string[] {
  const problems: string[] = [];
  if (pw.length < PASSWORD_POLICY.minLength) problems.push(`Use at least ${PASSWORD_POLICY.minLength} characters`);
  if (pw.length > PASSWORD_POLICY.maxLength) problems.push(`Use at most ${PASSWORD_POLICY.maxLength} characters`);
  if (!/[a-z]/.test(pw)) problems.push("Add a lower-case letter");
  if (!/[A-Z]/.test(pw)) problems.push("Add an upper-case letter");
  if (!/[0-9]/.test(pw)) problems.push("Add a number");
  if (COMMON.has(pw.toLowerCase())) problems.push("That password is too common");
  if (/^(.)\1+$/.test(pw) || /^(0123456789|1234567890|abcdefghij|qwertyuiop)/i.test(pw)) problems.push("Avoid repeated or sequential characters");
  for (const c of context) {
    if (c && c.length >= 4 && pw.toLowerCase().includes(c.toLowerCase())) {
      problems.push("Do not include your name or email in the password");
      break;
    }
  }
  return problems;
}

/**
 * Have I Been Pwned range check (k-anonymity: only the first 5 hex chars of the SHA-1 leave the server).
 * Fails open on network errors so an outage never blocks sign-up; set HIBP_CHECK=0 to disable.
 */
export async function isBreachedPassword(pw: string): Promise<boolean> {
  if (process.env.HIBP_CHECK === "0") return false;
  const sha1 = createHash("sha1").update(pw).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5), suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Synapsas-password-check" },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hash, count] = line.trim().split(":");
      if (hash === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Full policy check used by every password-setting route. */
export async function assertStrongPassword(pw: string, context: string[] = []): Promise<string[]> {
  const problems = passwordProblems(pw, context);
  if (!problems.length && (await isBreachedPassword(pw))) problems.push("That password has appeared in a known data breach. Choose a different one.");
  return problems;
}

export function clientInfo(req: Request) {
  const h = req.headers;
  // Behind nginx/Caddy the first X-Forwarded-For hop is the client; TRUST_PROXY=0 ignores forwarded headers entirely.
  const trustProxy = process.env.TRUST_PROXY !== "0";
  const ip =
    (trustProxy && (h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || h.get("cf-connecting-ip"))) || "local";
  const userAgent = (h.get("user-agent") || "").slice(0, 500);
  return { ip: ip.slice(0, 64), userAgent };
}

// --- Sliding-window rate limiter (per process). Put Redis behind this for multi-instance deployments. ---
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number; remaining: number } {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    const retryAfterSec = Math.ceil((arr[0] + windowMs - now) / 1000);
    buckets.set(key, arr);
    return { ok: false, retryAfterSec, remaining: 0 };
  }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 20000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return { ok: true, retryAfterSec: 0, remaining: limit - arr.length };
}

/**
 * CSRF defence for cookie sessions (ASVS 4.2.2): mutating requests must come from our own origin.
 * Checks Sec-Fetch-Site first (sent by every modern browser), then Origin, then Referer.
 */
export function sameOrigin(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) return false;
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return false;
  const check = (v: string | null) => {
    if (!v) return false;
    try {
      return new URL(v).host === host;
    } catch {
      return false;
    }
  };
  if (origin) return check(origin);
  if (referer) return check(referer);
  // No Origin/Referer/Sec-Fetch-Site at all: browsers always send one for cross-site POSTs, so this is non-browser tooling.
  return true;
}

/** Only allow same-site relative paths for post-login redirects (no protocol-relative or absolute URLs). */
export function safeRedirectPath(next: string | null | undefined, fallback = "/app"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\r\n]/.test(next)) return fallback;
  return next;
}

export function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function constantTimeEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** 10 human-friendly backup codes like "K7PD-3QWX". Returns plain codes and their hashes. */
export function generateBackupCodes(count = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const b = randomBytes(8);
    let s = "";
    for (let j = 0; j < 8; j++) s += alphabet[b[j] % alphabet.length];
    codes.push(`${s.slice(0, 4)}-${s.slice(4)}`);
  }
  return { codes, hashes: codes.map((c) => sha256(c.replace("-", "").toUpperCase())) };
}

export function hashBackupCode(code: string) {
  return sha256(code.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
}

/** Coarse device fingerprint for "new sign-in" alerts: browser family + OS, never the full UA. */
export function deviceLabel(userAgent: string) {
  const ua = userAgent || "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Unknown browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "unknown OS";
  return `${browser} on ${os}`;
}
