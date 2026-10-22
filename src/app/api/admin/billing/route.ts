import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { entitlementsFor, settleInvoice, billingSweep } from "@/lib/billing";
import { audit } from "@/lib/notify";
import { parseJson } from "@/lib/json";

/**
 * Platform-operator API (the SaaS vendor, not tenant admins). Protected by PLATFORM_ADMIN_KEY.
 *   GET  → all workspaces with billing state + open invoices
 *   POST { action: "markPaid", invoiceId, reference }      confirm a bank transfer / manual payment
 *   POST { action: "setPlan", orgId, plan, status, months } comp / override a workspace
 *   POST { action: "sweep" }                                run the lifecycle job now
 */
function authorised(req: Request) {
  const key = process.env.PLATFORM_ADMIN_KEY || "";
  const given = req.headers.get("x-platform-key") || (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
  return !!key && given === key;
}

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, requests: true } }, invoices: { where: { status: { in: ["PENDING", "FAILED"] } }, orderBy: { createdAt: "desc" } } },
  });
  return NextResponse.json({
    ok: true,
    data: orgs.map((o) => ({
      id: o.id, name: o.name, slug: o.slug, plan: o.plan, planStatus: o.planStatus, cycle: o.billingCycle, renewsAt: o.planRenewsAt, trialEndsAt: o.trialEndsAt,
      graceEndsAt: o.graceEndsAt, provider: o.billingProvider, billingEmail: o.billingEmail, createdAt: o.createdAt, users: o._count.users, requests: o._count.requests,
      entitlements: entitlementsFor(o), openInvoices: o.invoices.map((i) => ({ ...i, meta: parseJson(i.meta, {}) })),
    })),
  });
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("markPaid"), invoiceId: z.string(), reference: z.string().max(120).optional() }),
  z.object({ action: z.literal("setPlan"), orgId: z.string(), plan: z.enum(["FREE", "STARTER", "BUSINESS", "ENTERPRISE"]), status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED", "FREE"]), months: z.number().int().min(0).max(36).optional() }),
  z.object({ action: z.literal("sweep") }),
]);

export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  const b = parsed.data;
  if (b.action === "markPaid") {
    const inv = await settleInvoice(b.invoiceId, { providerRef: b.reference, actorId: null, via: "platform-admin" });
    return NextResponse.json({ ok: true, data: inv });
  }
  if (b.action === "setPlan") {
    const renews = b.months ? new Date(Date.now() + b.months * 30 * 86400000) : undefined;
    const org = await prisma.organization.update({
      where: { id: b.orgId },
      data: { plan: b.plan, planStatus: b.status, ...(renews ? { planRenewsAt: renews } : {}), graceEndsAt: null, ...(b.status !== "TRIALING" ? { trialEndsAt: null } : {}) },
    });
    await audit(org.id, null, "billing.plan_overridden", "Organization", org.id, { plan: b.plan, status: b.status, months: b.months, via: "platform-admin" });
    return NextResponse.json({ ok: true, data: { id: org.id, plan: org.plan, planStatus: org.planStatus, planRenewsAt: org.planRenewsAt } });
  }
  return NextResponse.json({ ok: true, data: await billingSweep() });
}
