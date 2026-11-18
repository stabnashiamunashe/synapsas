/**
 * Clean install: the Agency and one administrator account, nothing else. No demo officers, requests, cases or figures.
 *
 *   ADMIN_EMAIL     administrator sign-in (default ict.admin@zimstat.co.zw)
 *   ADMIN_NAME      display name (default "System Administrator")
 *   ADMIN_PASSWORD  initial password; when it is not set a random one is generated and printed ONCE
 *   ADMIN_RESET_PASSWORD=1   also reset the password of an existing administrator to ADMIN_PASSWORD
 *
 * Safe to run on every deploy (scripts/deploy-docker.sh does): it creates what is missing and never deletes or
 * overwrites anything else. Demo data stays available separately: `npx tsx prisma/seed.ts`.
 *
 *   npx tsx prisma/seed-admin.ts
 *   docker compose --profile seed run --rm seed          (the default seed command)
 */
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const j = (v: unknown) => JSON.stringify(v);

const ORG_SLUG = process.env.ORG_SLUG || "zimstat";
const ORG_NAME = process.env.ORG_NAME || "Zimbabwe National Statistics Agency";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "ict.admin@zimstat.co.zw").trim().toLowerCase();
const ADMIN_NAME = process.env.ADMIN_NAME || "System Administrator";
const ODP = "https://zimstat.opendataforafrica.org";
const SDG = "https://sdg-zimstat.github.io/";

const year = new Date().getFullYear();
const HOLIDAYS = [
  [`${year}-01-01`, "New Year's Day"], [`${year}-02-21`, "Robert Gabriel Mugabe National Youth Day"], [`${year}-04-18`, "Independence Day"],
  [`${year}-05-01`, "Workers' Day"], [`${year}-05-25`, "Africa Day"], [`${year}-08-11`, "Heroes' Day"], [`${year}-08-12`, "Defence Forces Day"],
  [`${year}-12-22`, "Unity Day"], [`${year}-12-25`, "Christmas Day"], [`${year}-12-26`, "Boxing Day"],
].map(([date, name]) => ({ date, name }));

/** 16 characters from an unambiguous alphabet; meets the password policy (length, upper, lower, digit, symbol). */
function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  let s = "";
  for (let i = 0; i < 14; i++) s += alphabet[bytes[i] % alphabet.length];
  return `${s.slice(0, 7)}-${s.slice(7)}!`;
}

async function main() {
  let org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: ORG_NAME, slug: ORG_SLUG, plan: "ENTERPRISE", planStatus: "ACTIVE", onboardingCompletedAt: new Date(), billingEmail: ADMIN_EMAIL,
        branding: j({
          productName: process.env.NEXT_PUBLIC_APP_NAME || "ZimStat Approvals", primaryColor: "#1414D2", sidebarTheme: "dark", borderRadius: 0,
          logoUrl: "/brand/zimstat-logo.png", loginTagline: "Travelling & subsistence, leave and internal approvals",
          footerText: "© Zimbabwe National Statistics Agency · 20th Floor, Kaguvi Building, Harare", hideVendorBranding: true, supportEmail: ADMIN_EMAIL,
        }),
        settings: j({
          currency: "USD", timezone: "Africa/Harare", requireCommentOnReject: true, allowSelfApproval: false, emailNotifications: true, annualLeaveDays: 12, sessionHours: 8, lockoutThreshold: 5, publicHolidays: HOLIDAYS,
          cases: { prefix: "ZS", whatsapp: { odpUrl: ODP, sdgUrl: SDG, greeting: "Welcome to ZIMSTAT, the Zimbabwe National Statistics Agency. How can we help you today?" } },
        }),
      },
    });
    console.log(`Organisation created: ${org.name} (${org.slug})`);
  } else {
    console.log(`Organisation exists: ${org.name} (${org.slug})`);
  }

  const existing = await prisma.user.findUnique({ where: { orgId_email: { orgId: org.id, email: ADMIN_EMAIL } } });
  const given = process.env.ADMIN_PASSWORD?.trim();
  if (existing) {
    if (process.env.ADMIN_RESET_PASSWORD === "1" && given) {
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: await bcrypt.hash(given, 10), forcePasswordChange: true, failedLogins: 0, lockedUntil: null, sessionVersion: { increment: 1 } } });
      console.log(`Administrator ${ADMIN_EMAIL}: password reset (must be changed at next sign-in).`);
    } else {
      console.log(`Administrator exists: ${ADMIN_EMAIL} (${existing.role}${existing.isActive ? "" : ", INACTIVE"}).`);
    }
    return;
  }
  const password = given || generatePassword();
  await prisma.user.create({ data: { orgId: org.id, email: ADMIN_EMAIL, name: ADMIN_NAME, role: "OWNER", jobTitle: "System Administrator", passwordHash: await bcrypt.hash(password, 10), emailVerifiedAt: new Date(), forcePasswordChange: true } });
  console.log(`Administrator created: ${ADMIN_EMAIL} (OWNER). The password must be changed at first sign-in.`);
  if (!given) console.log(`Generated password (shown once, not stored anywhere else): ${password}`);
  const users = await prisma.user.count({ where: { orgId: org.id } });
  console.log(`Accounts in ${org.name}: ${users}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
