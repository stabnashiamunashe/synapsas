// Transactional email: SMTP via nodemailer, branded templates, outbox with retry.
//
// Configure with SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_SECURE and MAIL_FROM.
// Without SMTP_HOST the app still records every message in the outbox (status FAILED, "SMTP not configured")
// and prints a one-line summary to the server log, so nothing silently disappears.
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "./prisma";

export const mailConfigured = () => !!process.env.SMTP_HOST;

let transporter: Transporter | null = null;
function transport(): Transporter | null {
  if (!mailConfigured()) return null;
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    requireTLS: process.env.SMTP_REQUIRE_TLS !== "false", // STARTTLS mandatory on 587 unless explicitly disabled
    connectionTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { minVersion: "TLSv1.2" },
  });
  return transporter;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface MailBrand { productName?: string; primaryColor?: string; logoUrl?: string | null; footerText?: string | null; supportEmail?: string | null }

const DEFAULT_BRAND: Required<Pick<MailBrand, "productName" | "primaryColor">> = {
  productName: process.env.NEXT_PUBLIC_APP_NAME || "ZimStat Approvals",
  primaryColor: "#003B32",
};

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Branded, table-based HTML that renders in Outlook/Gmail. All user-supplied strings must already be escaped. */
export function renderEmail(opts: {
  brand?: MailBrand;
  title: string;
  intro?: string;
  paragraphs?: string[]; // already-escaped HTML fragments
  cta?: { label: string; url: string } | null;
  footerNote?: string;
}) {
  const b = { ...DEFAULT_BRAND, ...(opts.brand || {}) };
  const name = escapeHtml(b.productName || DEFAULT_BRAND.productName);
  const color = /^#[0-9a-fA-F]{6}$/.test(b.primaryColor || "") ? b.primaryColor! : DEFAULT_BRAND.primaryColor;
  const logo = b.logoUrl && /^https:\/\//.test(b.logoUrl) ? `<img src="${escapeHtml(b.logoUrl)}" alt="${name}" height="32" style="height:32px;display:block">` : `<span style="font:700 18px Arial,sans-serif;color:${color}">${name}</span>`;
  const paras = (opts.paragraphs || []).map((p) => `<p style="margin:0 0 14px;font:15px/1.55 Arial,sans-serif;color:#1f2933">${p}</p>`).join("");
  const cta = opts.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0"><tr><td style="background:${color};border-radius:6px"><a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;padding:12px 22px;font:700 15px Arial,sans-serif;color:#ffffff;text-decoration:none">${escapeHtml(opts.cta.label)}</a></td></tr></table><p style="margin:0 0 14px;font:12px/1.5 Arial,sans-serif;color:#5f6b7a">If the button does not work, copy this link into your browser:<br><a href="${escapeHtml(opts.cta.url)}" style="color:${color};word-break:break-all">${escapeHtml(opts.cta.url)}</a></p>`
    : "";
  const footer = escapeHtml(b.footerText || `${b.productName} · This is an automated message, please do not reply.`);
  const support = b.supportEmail ? `<br>Need help? <a href="mailto:${escapeHtml(b.supportEmail)}" style="color:#5f6b7a">${escapeHtml(b.supportEmail)}</a>` : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e5e8ec;border-radius:8px">
<tr><td style="padding:22px 28px;border-bottom:1px solid #e5e8ec">${logo}</td></tr>
<tr><td style="padding:26px 28px 8px">
<h1 style="margin:0 0 14px;font:700 20px/1.3 Arial,sans-serif;color:#111827">${escapeHtml(opts.title)}</h1>
${opts.intro ? `<p style="margin:0 0 14px;font:15px/1.55 Arial,sans-serif;color:#1f2933">${opts.intro}</p>` : ""}
${paras}${cta}
${opts.footerNote ? `<p style="margin:0 0 14px;font:13px/1.5 Arial,sans-serif;color:#5f6b7a">${opts.footerNote}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #e5e8ec;font:12px/1.5 Arial,sans-serif;color:#8a94a6">${footer}${support}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [opts.title, "", stripTags(opts.intro || ""), ...(opts.paragraphs || []).map(stripTags), opts.cta ? `${opts.cta.label}: ${opts.cta.url}` : "", opts.footerNote ? stripTags(opts.footerNote) : "", "", stripTags(footer)]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
  return { html, text };
}

const stripTags = (s: string) =>
  s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export type MailCategory = "security" | "notification" | "invitation" | "billing" | "digest";

/**
 * Record in the outbox, then try to deliver immediately. Failures are retried by /api/cron/email with backoff.
 * Never throws: email must not break the business action that triggered it.
 */
export async function sendMail(opts: { to: string; subject: string; html: string; text: string; category: MailCategory; orgId?: string | null }) {
  const row = await prisma.emailOutbox.create({
    data: { orgId: opts.orgId ?? null, toEmail: opts.to, subject: opts.subject.slice(0, 500), html: opts.html, text: opts.text, category: opts.category },
  });
  await deliver(row.id).catch(() => undefined);
  return row.id;
}

const BACKOFF_MIN = [1, 5, 15, 60, 240]; // minutes between attempts

export async function deliver(id: string): Promise<boolean> {
  const row = await prisma.emailOutbox.findUnique({ where: { id } });
  if (!row || row.status === "SENT") return !!row;
  const t = transport();
  const from = process.env.MAIL_FROM || `${DEFAULT_BRAND.productName} <no-reply@localhost>`;
  if (!t) {
    console.log(`[email:not-configured] to=${row.toEmail} subject="${row.subject}"`);
    await prisma.emailOutbox.update({
      where: { id },
      data: { status: "FAILED", attempts: { increment: 1 }, lastError: "SMTP not configured (set SMTP_HOST)", nextAttemptAt: new Date(Date.now() + 60 * 60_000) },
    });
    return false;
  }
  try {
    const info = await t.sendMail({
      from,
      to: row.toEmail,
      subject: row.subject,
      html: row.html,
      text: row.text,
      headers: { "X-Auto-Response-Suppress": "All", "Auto-Submitted": "auto-generated", "X-Entity-Category": row.category },
    });
    await prisma.emailOutbox.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, providerId: info.messageId?.slice(0, 190) || null, lastError: null } });
    return true;
  } catch (e) {
    const attempts = row.attempts + 1;
    const wait = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)];
    await prisma.emailOutbox.update({
      where: { id },
      data: { status: attempts >= 6 ? "FAILED" : "PENDING", attempts, lastError: String((e as Error)?.message || e).slice(0, 2000), nextAttemptAt: new Date(Date.now() + wait * 60_000) },
    });
    console.error(`[email] delivery failed (attempt ${attempts}) to=${row.toEmail}: ${(e as Error)?.message}`);
    return false;
  }
}

/** Retry pending messages whose backoff has elapsed. Called by the cron endpoint. */
export async function drainOutbox(limit = 50) {
  const due = await prisma.emailOutbox.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let sent = 0;
  for (const d of due) if (await deliver(d.id)) sent++;
  return { attempted: due.length, sent };
}

/** Verify SMTP credentials (used by the settings page "Send test email"). */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  const t = transport();
  if (!t) return { ok: false, error: "SMTP_HOST is not set" };
  try {
    await t.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}
