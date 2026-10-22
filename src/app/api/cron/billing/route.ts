import { NextResponse } from "next/server";
import { billingSweep } from "@/lib/billing";

/**
 * Billing lifecycle job: expire trials, flag lapsed subscriptions, lock after grace, poll pending Paynow payments.
 * Schedule hourly:  Authorization: Bearer $CRON_SECRET
 */
async function run(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET || "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  return NextResponse.json({ ok: true, data: await billingSweep() });
}
export const GET = run;
export const POST = run;
