import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { getSessionOrApiKey, hasRole } from "./auth";
import { sameOrigin } from "./security";
import { orgEntitlements } from "./billing";
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

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ ok: false, error: error.message, details: error.details }, { status: error.status });
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

/** Routes that stay writable while a workspace is locked for non-payment. */
const BILLING_SAFE = ["/api/billing/", "/api/auth/", "/api/notifications", "/api/onboarding"];

/**
 * Wrap a route handler: resolves params, requires a verified session (or API key), enforces a minimum role,
 * rejects cross-site mutations for cookie sessions, blocks writes when the workspace is locked for
 * non-payment (HTTP 402), and maps errors to JSON.
 */
export function withAuth(handler: Handler, minRole: Role = "MEMBER") {
  return async (req: Request, ctx: Ctx) => {
    try {
      const user = await getSessionOrApiKey();
      if (!user) throw new ApiError(401, "Not authenticated");
      if (!user.viaApiKey && !sameOrigin(req)) throw forbidden("Cross-site request blocked");
      if (!hasRole(user, minRole)) throw forbidden("Insufficient permissions");
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase());
      if (mutating && !BILLING_SAFE.some((p) => new URL(req.url).pathname.startsWith(p))) {
        const ent = await orgEntitlements(user.orgId);
        if (ent.locked) throw new ApiError(402, "This workspace is read-only until its outstanding invoice is paid. Go to Settings → Plan & billing.");
      }
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
