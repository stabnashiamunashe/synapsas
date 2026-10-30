// Advances ledger: every officer's T&S advance account. An advance opens when a request whose workflow has
// `settings.advances === "open"` is approved (the TSA form) and is cleared by claims (`settings.advances === "clear"`,
// the TSC form, via its "Advances received" table), cash refunds, salary recovery or write-off.
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseJson } from "./json";
import { audit, notify } from "./notify";
import type { TemplateSettings } from "./types";

export const CLEARANCE_DAYS = 10;
export type AdvanceStatus = "OPEN" | "PARTIALLY_CLEARED" | "CLEARED" | "RECOVERED" | "WRITTEN_OFF";

type Snap = { settings?: TemplateSettings & { advances?: "open" | "clear" }; fields?: unknown };

const dec = (v: unknown) => new Prisma.Decimal(Number(v) || 0);

/** Called by the engine when a request reaches APPROVED. */
export async function onRequestApproved(requestId: string) {
  const r = await prisma.request.findUnique({ where: { id: requestId }, include: { template: { select: { settings: true } } } });
  if (!r) return;
  const snap = parseJson<Snap>(r.templateSnapshot, {});
  const mode = snap.settings?.advances || parseJson<Snap["settings"]>(r.template.settings, {})?.advances;
  if (mode === "open") await openAdvance(r);
  if (mode === "clear") await clearFromClaim(r);
}

async function openAdvance(r: { id: string; orgId: string; requesterId: string; referenceNo: string; costAmount: Prisma.Decimal | null; data: string }) {
  const amount = r.costAmount ? Number(r.costAmount) : 0;
  if (amount <= 0) return;
  const data = parseJson<Record<string, unknown>>(r.data, {});
  const period = Array.isArray(data.period) ? (data.period as string[]) : null;
  const travelEnds = period?.[1] ? new Date(period[1]) : null;
  const base = travelEnds && !isNaN(travelEnds.getTime()) ? travelEnds : new Date();
  const dueAt = new Date(base.getTime() + CLEARANCE_DAYS * 86400_000);
  const existing = await prisma.advance.findUnique({ where: { requestId: r.id } });
  if (existing) return;
  const adv = await prisma.advance.create({ data: { orgId: r.orgId, userId: r.requesterId, requestId: r.id, referenceNo: r.referenceNo, amount: dec(amount), currency: "USD", travelEndsAt: travelEnds, dueAt } });
  await notify(r.orgId, [r.requesterId], { title: `Advance ${r.referenceNo} opened on your account`, body: `USD ${amount.toFixed(2)} to be cleared by ${dueAt.toDateString()} with a claim form and receipts.`, link: `/app/advances`, type: "INFO" });
  await audit(r.orgId, null, "advance.opened", "Advance", adv.id, { referenceNo: r.referenceNo, amount });
}

/** A claim's "Advances received" rows name the advance references they settle. */
async function clearFromClaim(r: { id: string; orgId: string; requesterId: string; referenceNo: string; data: string; costAmount: Prisma.Decimal | null }) {
  const data = parseJson<{ advances?: { reference?: string; amount?: number }[] }>(r.data, {});
  const rows = (data.advances || []).filter((a) => a.reference);
  const refs = rows.map((a) => String(a.reference).trim().toUpperCase());
  const advances = refs.length
    ? await prisma.advance.findMany({ where: { orgId: r.orgId, referenceNo: { in: refs }, status: { in: ["OPEN", "PARTIALLY_CLEARED"] } } })
    : await prisma.advance.findMany({ where: { orgId: r.orgId, userId: r.requesterId, status: { in: ["OPEN", "PARTIALLY_CLEARED"] } }, orderBy: { disbursedAt: "asc" } });
  // Without explicit rows, the claim total settles the officer's oldest open advances in order.
  let pool = refs.length ? 0 : Number(r.costAmount || 0);
  for (const adv of advances) {
    const outstanding = Number(adv.amount) - Number(adv.clearedAmount);
    const row = rows.find((a) => String(a.reference).trim().toUpperCase() === adv.referenceNo);
    const amt = refs.length ? Math.min(outstanding, Number(row?.amount) || outstanding) : Math.min(outstanding, pool);
    if (amt <= 0) continue;
    pool -= amt;
    await applyClearance(adv.id, { kind: "CLAIM", amount: amt, requestId: r.id, note: `Claim ${r.referenceNo}` }, null);
  }
}

export async function applyClearance(advanceId: string, c: { kind: "CLAIM" | "CASH_REFUND" | "SALARY_RECOVERY" | "WRITE_OFF"; amount: number; requestId?: string | null; note?: string | null }, actorId: string | null) {
  const adv = await prisma.advance.findUnique({ where: { id: advanceId } });
  if (!adv) return null;
  const outstanding = Number(adv.amount) - Number(adv.clearedAmount);
  const amount = Math.min(Math.max(0, c.amount), outstanding);
  if (amount <= 0) return adv;
  const cleared = Number(adv.clearedAmount) + amount;
  const done = cleared >= Number(adv.amount) - 0.005;
  const status: AdvanceStatus = done ? (c.kind === "SALARY_RECOVERY" ? "RECOVERED" : c.kind === "WRITE_OFF" ? "WRITTEN_OFF" : "CLEARED") : "PARTIALLY_CLEARED";
  const updated = await prisma.advance.update({
    where: { id: adv.id },
    data: { clearedAmount: dec(cleared), status, clearedAt: done ? new Date() : null, clearances: { create: { kind: c.kind, amount: dec(amount), requestId: c.requestId || null, note: c.note || null, createdById: actorId } } },
  });
  await audit(adv.orgId, actorId, "advance.cleared", "Advance", adv.id, { kind: c.kind, amount, status });
  if (done) await notify(adv.orgId, [adv.userId], { title: `Advance ${adv.referenceNo} cleared`, body: `Your advance account is settled for this trip.`, link: `/app/advances`, type: "SUCCESS" });
  return updated;
}

/** Outstanding balance for an officer: what Finance certifies on the TSA form. */
export async function advanceBalance(orgId: string, userId: string) {
  const open = await prisma.advance.findMany({ where: { orgId, userId, status: { in: ["OPEN", "PARTIALLY_CLEARED"] } }, orderBy: { dueAt: "asc" }, select: { id: true, referenceNo: true, amount: true, clearedAmount: true, dueAt: true, status: true, disbursedAt: true } });
  const now = Date.now();
  const items = open.map((a) => ({ ...a, amount: Number(a.amount), clearedAmount: Number(a.clearedAmount), outstanding: Number(a.amount) - Number(a.clearedAmount), overdue: a.dueAt.getTime() < now }));
  return { outstanding: items.reduce((s, a) => s + a.outstanding, 0), count: items.length, overdue: items.filter((a) => a.overdue).length, items };
}

/** Cron: remind officers (and the Finance section head) about overdue advances once every 3 days. */
export async function advanceReminderSweep() {
  const now = new Date();
  const due = await prisma.advance.findMany({ where: { status: { in: ["OPEN", "PARTIALLY_CLEARED"] }, dueAt: { lt: now }, OR: [{ remindedAt: null }, { remindedAt: { lt: new Date(now.getTime() - 3 * 86400_000) } }] }, include: { officer: { select: { id: true, name: true, departmentId: true } } } });
  let reminded = 0;
  for (const a of due) {
    const outstanding = Number(a.amount) - Number(a.clearedAmount);
    const daysLate = Math.floor((now.getTime() - a.dueAt.getTime()) / 86400_000);
    const finance = await prisma.department.findFirst({ where: { orgId: a.orgId, OR: [{ code: "FIN" }, { name: { contains: "Finance" } }] }, select: { headUserId: true } });
    await notify(a.orgId, [a.userId, finance?.headUserId].filter((x): x is string => !!x), { title: `Advance ${a.referenceNo} overdue by ${daysLate} day${daysLate === 1 ? "" : "s"}`, body: `USD ${outstanding.toFixed(2)} outstanding for ${a.officer.name}. Submit the claim form with receipts, or the amount is recovered from salary.`, link: `/app/advances`, type: "WARNING" });
    await prisma.advance.update({ where: { id: a.id }, data: { remindedAt: now } });
    reminded++;
  }
  return { reminded };
}
