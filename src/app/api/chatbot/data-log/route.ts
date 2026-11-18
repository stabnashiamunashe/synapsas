import { prisma } from "@/lib/prisma";
import { getQuery, ok, paging, withAuth } from "@/lib/api";
import { DATA_LOG_KINDS, DATA_LOG_LABELS, maskPhone, type DataLogKind } from "@/lib/whatsapp/desk";
import { topicLabel } from "@/lib/whatsapp/i18n";
import type { Prisma } from "@prisma/client";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/**
 * The log of data the bot handed out or was asked for. Filters: kind, topic, from, to (YYYY-MM-DD), q (title or
 * reference); paged. The summary (totals by kind and topic, most requested items) covers the same filters.
 * `format=csv` downloads the filtered rows. Managers and up.
 */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const { skip, take, page, pageSize } = paging(req, 50);
  const kind = q.get("kind") || "";
  const topic = q.get("topic") || "";
  const from = q.get("from") ? new Date(`${q.get("from")}T00:00:00`) : null;
  const to = q.get("to") ? new Date(`${q.get("to")}T23:59:59.999`) : null;
  const search = (q.get("q") || "").trim();
  const where: Prisma.ChatbotDataLogWhereInput = {
    orgId: user.orgId,
    ...((DATA_LOG_KINDS as readonly string[]).includes(kind) ? { kind } : {}),
    ...(topic ? { topic } : {}),
    ...(from || to ? { createdAt: { ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}), ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}) } } : {}),
    ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { ref: { contains: search, mode: "insensitive" as const } }] } : {}),
  };
  if (q.get("format") === "csv") {
    const rows = await prisma.chatbotDataLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 20000 });
    const head = ["When", "Kind", "Area / topic", "Item", "Reference", "Format", "Number"];
    const lines = rows.map((r) => [r.createdAt.toISOString(), DATA_LOG_LABELS[r.kind as DataLogKind] || r.kind, r.topic ? topicLabel(r.topic, "en") : "", r.title, r.ref, r.format, maskPhone(r.phone)].map(esc).join(","));
    return new Response([head.map(esc).join(","), ...lines].join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="chatbot-data-log-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
  }
  const [items, total, byKind, byTopic, top] = await Promise.all([
    prisma.chatbotDataLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.chatbotDataLog.count({ where }),
    prisma.chatbotDataLog.groupBy({ by: ["kind"], where, _count: { _all: true } }),
    prisma.chatbotDataLog.groupBy({ by: ["topic"], where: { ...where, topic: { not: null } }, _count: { _all: true }, orderBy: { _count: { topic: "desc" } }, take: 10 }),
    prisma.chatbotDataLog.groupBy({ by: ["kind", "title"], where, _count: { _all: true }, orderBy: { _count: { title: "desc" } }, take: 10 }),
  ]);
  return ok({
    items: items.map((r) => ({ ...r, phone: maskPhone(r.phone), kindLabel: DATA_LOG_LABELS[r.kind as DataLogKind] || r.kind, topicName: r.topic ? topicLabel(r.topic, "en") : null })),
    total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    summary: {
      byKind: DATA_LOG_KINDS.map((k) => ({ kind: k, label: DATA_LOG_LABELS[k], count: byKind.find((x) => x.kind === k)?._count._all || 0 })),
      byTopic: byTopic.map((x) => ({ topic: x.topic || "", name: topicLabel(x.topic || "", "en"), count: x._count._all })),
      top: top.map((x) => ({ kind: x.kind, label: DATA_LOG_LABELS[x.kind as DataLogKind] || x.kind, title: x.title, count: x._count._all })),
    },
  });
}, "MANAGER");
