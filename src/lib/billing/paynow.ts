// Paynow (Zimbabwe) integration: web checkout and EcoCash/OneMoney mobile payments.
// Docs: https://developers.paynow.co.zw  — set PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY.
import { createHash } from "crypto";

const INIT_URL = "https://www.paynow.co.zw/interface/initiatetransaction";
const INIT_MOBILE_URL = "https://www.paynow.co.zw/interface/remotetransaction";

export function configured() {
  return !!(process.env.PAYNOW_INTEGRATION_ID && process.env.PAYNOW_INTEGRATION_KEY);
}

function hashOf(values: Record<string, string>) {
  // Paynow hash: SHA512 of all values (in order sent) concatenated, followed by the integration key, upper-cased hex.
  const key = process.env.PAYNOW_INTEGRATION_KEY || "";
  const concat = Object.values(values).join("") + key;
  return createHash("sha512").update(concat, "utf8").digest("hex").toUpperCase();
}

function parseResponse(text: string) {
  const out: Record<string, string> = {};
  for (const part of text.split("&")) {
    const [k, v] = part.split("=");
    if (k) out[decodeURIComponent(k).toLowerCase()] = decodeURIComponent((v || "").replace(/\+/g, " "));
  }
  return out;
}

export async function initiate(opts: {
  reference: string; amount: number; description: string; email: string; resultUrl: string; returnUrl: string; method: "web" | "mobile"; phone?: string;
}) {
  if (!configured()) throw new Error("Paynow is not configured");
  const fields: Record<string, string> = {
    id: process.env.PAYNOW_INTEGRATION_ID!,
    reference: opts.reference,
    amount: opts.amount.toFixed(2),
    additionalinfo: opts.description,
    returnurl: opts.returnUrl,
    resulturl: opts.resultUrl,
    authemail: opts.email || "billing@example.com",
    status: "Message",
  };
  if (opts.method === "mobile") {
    if (!opts.phone) throw new Error("Mobile number is required for mobile money");
    fields.phone = opts.phone;
    fields.method = "ecocash";
  }
  fields.hash = hashOf(fields);
  const res = await fetch(opts.method === "mobile" ? INIT_MOBILE_URL : INIT_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(15000),
  });
  const data = parseResponse(await res.text());
  if ((data.status || "").toLowerCase() !== "ok") throw new Error(data.error || "Paynow rejected the transaction");
  return { browserUrl: data.browserurl as string | undefined, pollUrl: data.pollurl as string, instructions: data.instructions as string | undefined };
}

export async function poll(pollUrl: string) {
  const res = await fetch(pollUrl, { method: "POST", signal: AbortSignal.timeout(15000) });
  const data = parseResponse(await res.text());
  const status = (data.status || "").toLowerCase();
  return {
    status,
    paid: status === "paid" || status === "awaiting delivery" || status === "delivered",
    failed: status === "cancelled" || status === "failed" || status === "disputed" || status === "refunded",
    reference: data.paynowreference as string | undefined,
    amount: data.amount ? Number(data.amount) : undefined,
  };
}

/** Verify a result-URL callback's hash before trusting it. */
export function verifyCallback(body: Record<string, string>) {
  const { hash, ...rest } = body;
  if (!hash) return false;
  return hashOf(rest) === hash.toUpperCase();
}
