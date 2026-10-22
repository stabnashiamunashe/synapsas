import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as paynow from "@/lib/billing/paynow";
import { failInvoice, settleInvoice } from "@/lib/billing";

/** Paynow "result URL": Paynow POSTs the transaction status here. We verify the hash, then re-poll before trusting it. */
export async function POST(req: Request) {
  const text = await req.text();
  const body: Record<string, string> = {};
  for (const part of text.split("&")) {
    const [k, v] = part.split("=");
    if (k) body[decodeURIComponent(k).toLowerCase()] = decodeURIComponent((v || "").replace(/\+/g, " "));
  }
  if (!paynow.verifyCallback(body)) return NextResponse.json({ ok: false, error: "bad hash" }, { status: 400 });
  const inv = await prisma.invoice.findUnique({ where: { number: body.reference || "" } });
  if (!inv) return NextResponse.json({ ok: false, error: "unknown reference" }, { status: 404 });
  if (inv.pollUrl) {
    const st = await paynow.poll(inv.pollUrl).catch(() => null);
    if (st?.paid) await settleInvoice(inv.id, { providerRef: st.reference, via: "paynow-result" });
    else if (st?.failed) await failInvoice(inv.id, st.status);
  }
  return NextResponse.json({ ok: true });
}
