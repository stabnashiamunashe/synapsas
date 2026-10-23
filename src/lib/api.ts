import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { getSessionOrApiKey, hasRole } from "./auth";
import { clientInfo, rateLimit, sameOrigin } from "./security";
import type { Role, SessionUser } from "./types";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (msg = "Not found") => new ApiError(404, msg);
export const forbidden = (msg = "Forbidden") => new ApiError(403, msg);
export const badRequest = (msg = "Bad request", details?: unknown) => new ApiError(400, msg, details);

/** API responses are never cacheable by shared caches (they are per-user, ASVS 8.3.1). */
const NO_STORE = { "cache-control": "no-store, max-age=0", pragma: "no-cache" };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, { ...init, headers: { ...NO_STORE, ...(init?.headers || {}) } });
}

/** Generic per-IP throttle for public endpoints and per-principal throttle for authenticated ones. */
function throttle(req: Request, key: string, limit: number, windowMs: number) {
  const r = rateLimit(key, limit, windowMs);
  if (!r.ok) throw new ApiError(429, `Too many requests. Try again in ${r.retryAfterSec} seconds.`);
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    const headers: Record<string, string> = { ...NO_STORE };
    if (error.status === 429) headers["retry-after"] = String((error.message.match(/(\d+) seconds/) || [, "60"])[1]);
    return NextResponse.json({ ok: false, error: error.message, details: error.details }, { status: error.status, headers });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }
  // Log full detail server-side; never leak driver/DB internals to the client.
  console.error(error);
  return NextResponse.json({ ok: false, error: "Something went wrong on the server. Please try again." }, { status: 500 });
}

type Ctx = { params: Promise<Record<string, string>> };
export type AuthedUser = SessionUser & { viaApiKey?: boolean };
type Handler = (req: Request, ctx: { params: Record<string, string>; user: AuthedUser }) => Promise<Response>;

/**
 * Wrap a route handler: resolves params, requires a verified session (or API key), enforces a minimum role,
 * rejects cross-site mutations for cookie sessions, and maps errors to JSON.
 */
export function withAuth(handler: Handler, minRole: Role = "MEMBER") {
  return async (req: Request, ctx: Ctx) => {
    try {
      const user = await getSessionOrApiKey();
      if (!user) {
        throttle(req, `anon:${clientInfo(req).ip}`, 120, 60_000);
        throw new ApiError(401, "Not authenticated");
      }
      if (!user.viaApiKey && !sameOrigin(req)) throw forbidden("Cross-site request blocked");
      if (!hasRole(user, minRole)) throw forbidden("Insufficient permissions");
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase());
      // Per-principal throttle: 600 requests/min for sessions, 300/min for API keys.
      throttle(req, `user:${user.viaApiKey ? user.apiKeyId : user.id}`, user.viaApiKey ? 300 : 600, 60_000);
      if (user.viaApiKey && mutating && !(user.scopes || []).includes("write")) throw forbidden("This API key is read-only");
      const params = ctx?.params ? await ctx.params : {};
      return await handler(req, { params, user });
    } catch (e) {
      return fail(e);
    }
  };
}

/** Wrap a public route handler (no auth) with CSRF origin check and error mapping. */
export function withPublic(handler: (req: Request, ctx: { params: Record<string, string> }) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      if (!sameOrigin(req)) throw forbidden("Cross-site request blocked");
      // Public endpoints (sign-in, registration, password reset, invitations): 60 requests/min per IP on top of per-route limits.
      throttle(req, `public:${clientInfo(req).ip}`, 60, 60_000);
      const params = ctx?.params ? await ctx.params : {};
      return await handler(req, { params });
    } catch (e) {
      return fail(e);
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Invalid JSON body");
  }
  return schema.parse(json);
}

export function getQuery(req: Request) {
  return new URL(req.url).searchParams;
}

export function paging(req: Request, defaultSize = 20) {
  const q = getQuery(req);
  const page = Math.max(1, Number(q.get("page") || 1));
  const pageSize = Math.min(200, Math.max(1, Number(q.get("pageSize") || defaultSize)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
