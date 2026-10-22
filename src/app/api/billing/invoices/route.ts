import { prisma } from "@/lib/prisma";
import { ok, withAuth } from "@/lib/api";
import { parseJson } from "@/lib/json";
import * as paynow from "@/lib/billing/paynow";
import { failInvoice, settleInvoice } from "@/lib/billing";

/** Invoice history. Pending Paynow invoices are polled on read so the page reflects a just-completed payment. */
export const GET = withAuth(async (_req, { user }) => {
  const pending = await prisma.invoice.findMany({ where: { orgId: user.orgId, status: "PENDING", provider: "paynow", pollUrl: { not: null } } });
  for (const inv of pending) {
    const st = await paynow.poll(inv.pollUrl!).catch(() => null);
    if (st?.paid) await settleInvoice(inv.id, { providerRef: st.reference, via: "paynow-poll" });
    else if (st?.failed) await failInvoice(inv.id, st.status);
  }
  const list = await prisma.invoice.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: "desc" }, take: 100 });
  return ok(list.map((i) => ({ ...i, meta: parseJson(i.meta, {}) })));
}, "ADMIN");
