// Every transactional email the product sends, in one place. Templates escape all dynamic values.
import { prisma } from "./prisma";
import { appUrl, escapeHtml, renderEmail, sendMail, type MailBrand } from "./mailer";
import { parseJson } from "./json";
import type { BrandingSettings } from "./types";

async function brandFor(orgId?: string | null): Promise<{ brand: MailBrand; orgName: string; slug: string }> {
  if (!orgId) return { brand: {}, orgName: process.env.NEXT_PUBLIC_APP_NAME || "ZimStat Approvals", slug: "" };
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, slug: true, branding: true } });
  const b = parseJson<BrandingSettings>(org?.branding || "{}", {});
  return {
    brand: { productName: b.productName || org?.name, primaryColor: b.primaryColor, logoUrl: b.logoUrl, footerText: b.footerText, supportEmail: b.supportEmail },
    orgName: org?.name || "",
    slug: org?.slug || "",
  };
}

const when = (d = new Date()) => d.toUTCString();
const e = escapeHtml;

/* ---------- account lifecycle ---------- */

export async function sendVerificationEmail(user: { id: string; email: string; name: string; orgId: string }, token: string) {
  const { brand, orgName } = await brandFor(user.orgId);
  const url = `${appUrl()}/verify-email/${encodeURIComponent(token)}`;
  const { html, text } = renderEmail({
    brand,
    title: "Confirm your email address",
    intro: `Hi ${e(user.name)}, welcome to ${e(orgName)}.`,
    paragraphs: ["Confirm this is your email address to finish setting up your account. The link is valid for 24 hours."],
    cta: { label: "Confirm email", url },
    footerNote: "If you did not create this account, you can ignore this email.",
  });
  await sendMail({ to: user.email, subject: `Confirm your email for ${orgName}`, html, text, category: "security", orgId: user.orgId });
}

export async function sendPasswordResetEmail(user: { email: string; name: string; orgId: string }, link: string, ctx: { ip: string; userAgent: string }) {
  const { brand, orgName } = await brandFor(user.orgId);
  const { html, text } = renderEmail({
    brand,
    title: "Reset your password",
    intro: `Hi ${e(user.name)}, we received a request to reset the password for your ${e(orgName)} account.`,
    paragraphs: [`The link below works once and expires in 60 minutes. Requested from ${e(ctx.ip)} on ${e(when())}.`],
    cta: { label: "Choose a new password", url: link },
    footerNote: "If you did not request this, no action is needed: your password has not changed. Consider enabling two-factor authentication under Profile → Security.",
  });
  await sendMail({ to: user.email, subject: `Reset your ${orgName} password`, html, text, category: "security", orgId: user.orgId });
}

export async function sendInvitationEmail(inv: { email: string; role: string; orgId: string }, link: string, invitedBy?: string | null) {
  const { brand, orgName } = await brandFor(inv.orgId);
  const { html, text } = renderEmail({
    brand,
    title: `You have been invited to ${e(orgName)}`,
    intro: invitedBy ? `${e(invitedBy)} has invited you to join ${e(orgName)} as ${e(inv.role.toLowerCase())}.` : `You have been invited to join ${e(orgName)} as ${e(inv.role.toLowerCase())}.`,
    paragraphs: ["Accept the invitation to set your password and sign in. The link is valid for 7 days and can be used once."],
    cta: { label: "Accept invitation", url: link },
    footerNote: "If you were not expecting this invitation, you can ignore this email.",
  });
  await sendMail({ to: inv.email, subject: `Invitation to join ${orgName}`, html, text, category: "invitation", orgId: inv.orgId });
}

export async function sendTemporaryPasswordEmail(user: { email: string; name: string; orgId: string }, temporaryPassword: string, slug: string) {
  const { brand, orgName } = await brandFor(user.orgId);
  const url = `${appUrl()}/login?org=${encodeURIComponent(slug)}`;
  const { html, text } = renderEmail({
    brand,
    title: "Your account is ready",
    intro: `Hi ${e(user.name)}, an administrator created an account for you at ${e(orgName)}.`,
    paragraphs: [`Sign in with your email address and this temporary password, which you must change immediately:`, `<code style="font:15px Consolas,monospace;background:#f3f4f6;padding:4px 8px;border-radius:4px">${e(temporaryPassword)}</code>`],
    cta: { label: "Sign in", url },
    footerNote: "For your security the temporary password works once. If you did not expect this email, contact your administrator.",
  });
  await sendMail({ to: user.email, subject: `Your ${orgName} account`, html, text, category: "security", orgId: user.orgId });
}

/* ---------- security alerts (ASVS 2.2.3 / 2.5.5: notify on credential changes and new sign-ins) ---------- */

type SecUser = { email: string; name: string; orgId: string };
type Ctx = { ip: string; userAgent: string; device?: string };

async function securityAlert(user: SecUser, subject: string, title: string, paragraphs: string[], note?: string) {
  const { brand } = await brandFor(user.orgId);
  const { html, text } = renderEmail({ brand, title, intro: `Hi ${e(user.name)},`, paragraphs, cta: { label: "Review security settings", url: `${appUrl()}/app/profile?tab=security` }, footerNote: note });
  await sendMail({ to: user.email, subject, html, text, category: "security", orgId: user.orgId });
}

export const sendNewDeviceAlert = (u: SecUser, ctx: Ctx) =>
  securityAlert(u, "New sign-in to your account", "New sign-in detected",
    [`Your account was just used to sign in from a device we have not seen before.`, `<b>Device:</b> ${e(ctx.device || "unknown")}<br><b>IP address:</b> ${e(ctx.ip)}<br><b>Time:</b> ${e(when())}`],
    "If this was you, no action is needed. If not, change your password now and sign out of all sessions from Profile → Security.");

export const sendPasswordChangedAlert = (u: SecUser, ctx: Ctx, via: "change" | "reset" | "admin") =>
  securityAlert(u, "Your password was changed", "Password changed",
    [via === "admin" ? "An administrator set a new temporary password on your account." : `Your password was ${via === "reset" ? "reset" : "changed"} successfully. All other sessions have been signed out.`, `<b>IP address:</b> ${e(ctx.ip)}<br><b>Time:</b> ${e(when())}`],
    "If you did not do this, use “Forgot password?” immediately and contact your administrator.");

export const sendTwoFactorAlert = (u: SecUser, ctx: Ctx, enabled: boolean) =>
  securityAlert(u, enabled ? "Two-factor authentication enabled" : "Two-factor authentication disabled", enabled ? "Two-factor authentication is on" : "Two-factor authentication was turned off",
    [enabled ? "An authenticator app is now required at every sign-in. Keep your backup codes somewhere safe." : "Your account no longer requires a second factor at sign-in.", `<b>IP address:</b> ${e(ctx.ip)}<br><b>Time:</b> ${e(when())}`],
    enabled ? undefined : "If you did not do this, change your password and re-enable two-factor authentication now.");

export const sendBackupCodeUsedAlert = (u: SecUser, ctx: Ctx, remaining: number) =>
  securityAlert(u, "A backup code was used to sign in", "Backup code used",
    [`One of your two-factor backup codes was used to sign in. You have <b>${remaining}</b> left.`, `<b>IP address:</b> ${e(ctx.ip)}<br><b>Time:</b> ${e(when())}`],
    "If this was not you, change your password and regenerate your backup codes.");

export const sendAccountLockedAlert = (u: SecUser, ctx: Ctx, minutes: number) =>
  securityAlert(u, "Your account was temporarily locked", "Too many failed sign-in attempts",
    [`Your account was locked for ${minutes} minutes after repeated failed sign-in attempts.`, `<b>IP address:</b> ${e(ctx.ip)}<br><b>Time:</b> ${e(when())}`],
    "If this was not you, someone may be trying to guess your password. Consider changing it and enabling two-factor authentication.");

/* ---------- workflow notifications ---------- */

export async function sendNotificationEmail(user: { email: string; name: string; orgId: string }, n: { title: string; body?: string | null; link?: string | null }) {
  const { brand, orgName } = await brandFor(user.orgId);
  const { html, text } = renderEmail({
    brand,
    title: n.title,
    intro: `Hi ${e(user.name)},`,
    paragraphs: n.body ? [e(n.body)] : [],
    cta: n.link ? { label: "Open in " + (brand.productName || orgName), url: `${appUrl()}${n.link.startsWith("/") ? n.link : "/app"}` } : null,
    footerNote: "You receive this because of your notification settings (Profile → Notifications).",
  });
  await sendMail({ to: user.email, subject: `[${brand.productName || orgName}] ${n.title}`, html, text, category: "notification", orgId: user.orgId });
}

export async function sendDigestEmail(user: { email: string; name: string; orgId: string }, items: { title: string; body?: string | null; link?: string | null; createdAt: Date }[], period: "daily" | "weekly") {
  const { brand, orgName } = await brandFor(user.orgId);
  const rows = items.slice(0, 50).map((i) => `• ${e(i.title)}${i.link ? ` — <a href="${e(appUrl() + i.link)}">open</a>` : ""}`);
  const { html, text } = renderEmail({
    brand,
    title: `Your ${period} summary`,
    intro: `Hi ${e(user.name)}, here is what happened in ${e(brand.productName || orgName)} since your last digest.`,
    paragraphs: rows.length ? rows : ["Nothing new."],
    cta: { label: "Open inbox", url: `${appUrl()}/app/inbox` },
  });
  await sendMail({ to: user.email, subject: `[${brand.productName || orgName}] ${period === "daily" ? "Daily" : "Weekly"} summary`, html, text, category: "digest", orgId: user.orgId });
}
