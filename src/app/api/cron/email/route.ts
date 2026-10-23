import { NextResponse } from "next/server";
import { drainOutbox } from "@/lib/mailer";
import { sendDigests } from "@/lib/digest";
import { constantTimeEqual } from "@/lib/security";

/**
 * Email jobs: retries failed deliveries from the outbox and sends daily/weekly digests.
 * Schedule every 5 minutes:  curl -H "Authorization: Bearer $CRON_SECRET" https://host/api/cron/email
 */
async function run(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET || "";
  if (!secret || !constantTimeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }
  const outbox = await drainOutbox();
  const digests = await sendDigests();
  return NextResponse.json({ ok: true, data: { outbox, digests } }, { headers: { "cache-control": "no-store" } });
}

export const GET = run;
export const POST = run;
