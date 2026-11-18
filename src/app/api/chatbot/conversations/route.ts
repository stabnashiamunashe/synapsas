import { prisma } from "@/lib/prisma";
import { getQuery, ok, withAuth } from "@/lib/api";
import { maskPhone } from "@/lib/whatsapp/desk";

/**
 * Every WhatsApp conversation the bot has had: one row per number (session), with the step the person is at, the last
 * message and how many cases they lodged. `q` matches the last digits of the number or the profile name. Managers and up.
 */
export const GET = withAuth(async (req, { user }) => {
  const orgId = user.orgId;
  const q = (getQuery(req).get("q") || "").trim();
  const digits = q.replace(/\D/g, "");
  const sessions = await prisma.whatsAppSession.findMany({
    where: { orgId, ...(q ? { OR: [...(digits ? [{ phone: { endsWith: digits } }] : []), { profileName: { contains: q, mode: "insensitive" as const } }] } : {}) },
    orderBy: { lastInteractionAt: "desc" }, take: 300,
  });
  const phones = sessions.map((s) => s.phone);
  const [messages, cases, logs] = await Promise.all([
    phones.length ? prisma.whatsAppMessage.findMany({ where: { phone: { in: phones } }, orderBy: { createdAt: "desc" }, take: 3000, select: { phone: true, body: true, direction: true, createdAt: true } }) : [],
    prisma.case.findMany({ where: { orgId, source: "WHATSAPP" }, select: { reporterPhone: true, status: true } }),
    phones.length ? prisma.chatbotDataLog.groupBy({ by: ["phone"], where: { orgId, phone: { in: phones } }, _count: { _all: true } }) : [],
  ]);
  const last = new Map<string, { body: string; direction: string; createdAt: Date }>();
  const counts = new Map<string, number>();
  for (const m of messages) {
    if (!last.has(m.phone)) last.set(m.phone, { body: m.body, direction: m.direction, createdAt: m.createdAt });
    counts.set(m.phone, (counts.get(m.phone) || 0) + 1);
  }
  const caseCount = new Map<string, { total: number; open: number }>();
  for (const c of cases) {
    const key = (c.reporterPhone || "").replace(/\D/g, "");
    const cur = caseCount.get(key) || { total: 0, open: 0 };
    cur.total++; if (!["RESOLVED", "CLOSED", "REJECTED"].includes(c.status)) cur.open++;
    caseCount.set(key, cur);
  }
  const handed = new Map(logs.map((l) => [l.phone, l._count._all]));
  return ok(sessions.map((s) => ({
    id: s.id, phone: maskPhone(s.phone), profileName: s.profileName, step: s.step, lastInteractionAt: s.lastInteractionAt, createdAt: s.createdAt,
    last: last.get(s.phone) || null, messages: counts.get(s.phone) || 0, cases: caseCount.get(s.phone) || { total: 0, open: 0 }, handedOut: handed.get(s.phone) || 0,
  })));
}, "MANAGER");
