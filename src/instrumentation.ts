/**
 * Runs once when the server starts. In production, refuses to boot with insecure configuration
 * (default secrets, short keys, non-HTTPS public URL) so a misconfigured deployment fails loudly.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const problems: string[] = [];
  const prod = process.env.NODE_ENV === "production";
  const secret = process.env.AUTH_SECRET || "";
  if (prod) {
    if (!secret || secret.length < 32 || /change-me|dev-secret|example/i.test(secret)) problems.push("AUTH_SECRET must be a random string of at least 32 characters");
    const pk = process.env.PLATFORM_ADMIN_KEY || "";
    if (pk && (pk.length < 24 || /change-me/i.test(pk))) problems.push("PLATFORM_ADMIN_KEY must be a random string of at least 24 characters (or unset to disable the platform console)");
    const cron = process.env.CRON_SECRET || "";
    if (cron && (cron.length < 16 || /dev-cron|change-me/i.test(cron))) problems.push("CRON_SECRET must be a random string of at least 16 characters");
    const url = process.env.APP_URL || "";
    if (!/^https:\/\//.test(url)) problems.push("APP_URL must be the public https:// address (used in emails and cookies)");
    if (!process.env.SMTP_HOST) console.warn("[startup] SMTP_HOST is not set: emails are queued in the outbox but not delivered; email verification is disabled.");
    if (process.env.BILLING_PROVIDER === "stripe" && !process.env.STRIPE_WEBHOOK_SECRET) problems.push("STRIPE_WEBHOOK_SECRET is required when BILLING_PROVIDER=stripe");
  }
  if (problems.length) {
    console.error("[startup] Refusing to start with insecure configuration:\n - " + problems.join("\n - "));
    process.exit(1);
  }
}
