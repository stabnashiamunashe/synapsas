import { Secret, TOTP } from "otpauth";

const ISSUER = process.env.NEXT_PUBLIC_APP_NAME || "FlowDesk";

export function newTotpSecret() {
  return new Secret({ size: 20 }).base32;
}

export function totpUri(secret: string, label: string, issuer = ISSUER) {
  return new TOTP({ issuer, label, secret: Secret.fromBase32(secret), digits: 6, period: 30 }).toString();
}

/** Accepts the current code and one step either side to absorb clock drift. */
export function verifyTotp(secret: string, code: string) {
  const totp = new TOTP({ issuer: ISSUER, secret: Secret.fromBase32(secret), digits: 6, period: 30 });
  const delta = totp.validate({ token: code.replace(/\s+/g, ""), window: 1 });
  return delta !== null;
}
