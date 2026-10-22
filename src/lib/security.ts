// Security helpers: password policy, request fingerprinting, in-memory rate limiting, CSRF origin checks.
import { createHash, randomBytes } from "crypto";

export const PASSWORD_POLICY = {
  minLength: 10,
  description: "At least 10 characters with upper and lower case letters and a number.",
};

const COMMON = new Set(["password123", "password1234", "welcome123!", "qwerty12345", "admin12345", "letmein123", "changeme123"]);

export function passwordProblems(pw: string, context: string[] = []): string[] {
  const problems: string[] = [];
  if (pw.length < PASSWORD_POLICY.minLength) problems.push(`Use at least ${PASSWORD_POLICY.minLength} characters`);
  if (!/[a-z]/.test(pw)) problems.push("Add a lower-case letter");
  if (!/[A-Z]/.test(pw)) problems.push("Add an upper-case letter");
  if (!/[0-9]/.test(pw)) problems.push("Add a number");
  if (COMMON.has(pw.toLowerCase())) problems.push("That password is too common");
  for (const c of context) {
    if (c && c.length >= 4 && pw.toLowerCase().includes(c.toLowerCase())) {
      problems.push("Do not include your name or email in the password");
      break;
    }
  }
  return problems;
}

export function clientInfo(req: Request) {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "local";
  const userAgent = (h.get("user-agent") || "").slice(0, 500);
  return { ip, userAgent };
}

// --- Sliding-window rate limiter (per process). Put Redis behind this for multi-instance deployments. ---
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    const retryAfterSec = Math.ceil((arr[0] + windowMs - now) / 1000);
    buckets.set(key, arr);
    return { ok: false, retryAfterSec };
  }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return { ok: true, retryAfterSec: 0 };
}

/** CSRF defence for cookie sessions: mutating requests must come from our own origin. */
export function sameOrigin(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
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
  // No Origin/Referer at all: browsers always send one for cross-site POSTs, so treat as same-origin tooling (curl).
  return true;
}

export function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
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
