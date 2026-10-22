import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { prisma } from "./prisma";
import type { Role, SessionUser } from "./types";

export { ROLE_RANK, hasRole } from "./roles";

const COOKIE = "wf_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export interface SessionClaims extends SessionUser {
  /** session version at issue time; compared with User.sessionVersion on every authenticated request */
  sv: number;
}

export async function signSession(user: SessionClaims, hours = 8) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${hours}h`)
    .sign(secret());
}

export async function setSessionCookie(user: SessionClaims, hours = 8) {
  const token = await signSession(user, hours);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: hours * 3600,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE, "", { path: "/", maxAge: 0 });
}

/** Issue a session for a user row, using the org's configured session length. */
export async function issueSessionFor(user: { id: string; orgId: string; role: string; email: string; name: string; sessionVersion: number }) {
  const org = await prisma.organization.findUnique({ where: { id: user.orgId }, select: { settings: true } });
  let hours = 8;
  try {
    const s = JSON.parse(org?.settings || "{}");
    if (typeof s.sessionHours === "number" && s.sessionHours >= 1 && s.sessionHours <= 168) hours = s.sessionHours;
  } catch {
    /* defaults */
  }
  await setSessionCookie(
    { id: user.id, orgId: user.orgId, role: user.role as Role, email: user.email, name: user.name, sv: user.sessionVersion },
    hours,
  );
}

/** Short-lived token that proves the password step passed and a 2FA code is still needed. */
export async function signTwoFactorChallenge(userId: string) {
  return new SignJWT({ uid: userId, purpose: "2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret());
}
export async function readTwoFactorChallenge(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.purpose === "2fa" ? (payload.uid as string) : null;
  } catch {
    return null;
  }
}

/** Returns the cookie session (claims only, no DB). */
export async function getSession(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.id) return null;
    return {
      id: payload.id as string,
      orgId: payload.orgId as string,
      role: payload.role as Role,
      email: payload.email as string,
      name: payload.name as string,
      sv: (payload.sv as number) ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Cookie session validated against the database: user still active, session not revoked,
 * role taken from the DB (so role changes apply immediately).
 */
export async function getVerifiedSession(): Promise<SessionUser | null> {
  const s = await getSession();
  if (!s) return null;
  const u = await prisma.user.findUnique({
    where: { id: s.id },
    select: { id: true, orgId: true, role: true, email: true, name: true, isActive: true, sessionVersion: true },
  });
  if (!u || !u.isActive || u.sessionVersion !== s.sv) return null;
  return { id: u.id, orgId: u.orgId, role: u.role as Role, email: u.email, name: u.name };
}

/** Session resolved either from the verified cookie or from an `Authorization: Bearer <api key>` header. */
export async function getSessionOrApiKey(): Promise<(SessionUser & { viaApiKey?: boolean }) | null> {
  const s = await getVerifiedSession();
  if (s) return s;
  const h = await headers();
  const auth = h.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const raw = auth.slice(7).trim();
  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(raw) } });
  if (!key || key.revokedAt) return null;
  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  const owner = await prisma.user.findFirst({ where: { orgId: key.orgId, role: "OWNER" }, orderBy: { createdAt: "asc" } });
  if (!owner) return null;
  return { id: owner.id, orgId: key.orgId, role: "ADMIN", email: `apikey:${key.prefix}`, name: `API key: ${key.name}`, viaApiKey: true };
}

export function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}
