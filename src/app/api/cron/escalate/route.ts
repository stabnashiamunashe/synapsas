import { NextResponse } from "next/server";
import { escalateOverdue } from "@/lib/engine";
import { caseSlaSweep } from "@/lib/cases";

/**
 * SLA escalation job. Call from a scheduler (Vercel Cron, GitHub Actions, cron) with
 *   Authorization: Bearer $CRON_SECRET
 * or hit it manually from the Settings → Organisation page.
 */
async function run(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
  const result = await escalateOverdue();
  const cases = await caseSlaSweep();
  return NextResponse.json({ ok: true, data: { ...result, cases } });
}

export const GET = run;
export const POST = run;
