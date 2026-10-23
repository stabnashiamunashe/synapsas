import { Secret, TOTP } from "otpauth";
import { decryptSecret, encryptSecret } from "./crypto";

const ISSUER = process.env.NEXT_PUBLIC_APP_NAME || "ZimStat Approvals";
const PERIOD = 30;

export function newTotpSecret() {
  return new Secret({ size: 20 }).base32;
}

export function totpUri(secret: string, label: string, issuer = ISSUER) {
  return new TOTP({ issuer, label, secret: Secret.fromBase32(secret), digits: 6, period: PERIOD }).toString();
}

/** Secrets are stored encrypted (AES-256-GCM); plaintext legacy rows are still readable. */
export const storeTotpSecret = (plain: string) => encryptSecret(plain);
export const loadTotpSecret = (stored: string) => decryptSecret(stored);

/**
 * Validate a code with ±1 step tolerance and return the time-step it matched, or null.
 * Callers persist the step and reject any code whose step is <= the last accepted one (replay guard, ASVS 2.8.4).
 */
export function verifyTotp(storedSecret: string, code: string, lastStep?: number | null): { ok: boolean; step: number | null } {
  const totp = new TOTP({ issuer: ISSUER, secret: Secret.fromBase32(loadTotpSecret(storedSecret)), digits: 6, period: PERIOD });
  const delta = totp.validate({ token: code.replace(/\s+/g, ""), window: 1 });
  if (delta === null) return { ok: false, step: null };
  const step = Math.floor(Date.now() / 1000 / PERIOD) + delta;
  if (typeof lastStep === "number" && step <= lastStep) return { ok: false, step: null };
  return { ok: true, step };
}
