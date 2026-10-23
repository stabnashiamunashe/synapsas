// Daily / weekly notification digests for users who opted out of per-event email.
import { prisma } from "./prisma";
import { parseJson } from "./json";
import { sendDigestEmail } from "./emails";
import type { NotificationPrefs } from "./types";

/**
 * Daily digests go out once per calendar day after 06:00 UTC; weekly ones on Mondays.
 * Idempotent: a user is skipped when a digest was already sent in the current period (tracked in EmailOutbox).
 */
export async function sendDigests(now = new Date()) {
  if (now.getUTCHours() < 6) return { sent: 0, skipped: "before 06:00 UTC" };
  const users = await prisma.user.findMany({
    where: { isActive: true, OR: [{ prefs: { contains: '"emailDigest":"daily"' } }, { prefs: { contains: '"emailDigest":"weekly"' } }] },
    select: { id: true, email: true, name: true, orgId: true, prefs: true },
  });
  let sent = 0;
  for (const u of users) {
    const period = parseJson<NotificationPrefs>(u.prefs, {}).emailDigest;
    if (period !== "daily" && period !== "weekly") continue;
    if (period === "weekly" && now.getUTCDay() !== 1) continue;
    const since = new Date(now.getTime() - (period === "daily" ? 1 : 7) * 86400_000);
    const already = await prisma.emailOutbox.findFirst({ where: { toEmail: u.email, category: "digest", createdAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) } }, select: { id: true } });
    if (already) continue;
    const items = await prisma.notification.findMany({ where: { userId: u.id, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 50 });
    if (!items.length) continue;
    await sendDigestEmail(u, items, period);
    sent++;
  }
  return { sent };
}
