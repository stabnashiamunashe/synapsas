// Application-layer encryption for secrets at rest (TOTP seeds). AES-256-GCM with a key derived from AUTH_SECRET
// via HKDF, so rotating AUTH_SECRET invalidates sessions AND requires re-enrolling 2FA (documented in SECURITY.md).
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function key(): Buffer {
  const secret = process.env.AUTH_SECRET || "dev-secret-change-me";
  return Buffer.from(hkdfSync("sha256", secret, "synapsas-field-encryption", "totp-secret", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64url");
}

/** Accepts both encrypted values and legacy plaintext (migrated lazily on next 2FA change). */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export const isEncrypted = (v: string | null | undefined) => !!v && v.startsWith(PREFIX);
