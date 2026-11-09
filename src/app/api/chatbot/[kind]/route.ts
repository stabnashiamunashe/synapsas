import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, getQuery, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { STAT_TOPICS } from "@/lib/whatsapp/i18n";

/**
 * Content the WhatsApp chatbot answers from, one resource per `kind`:
 *   indicators     headline statistics (topic → indicator → latest value, period, release date, ODP link)
 *   releases       advance release calendar; publishing one alerts subscribers (see [id] route)
 *   subscriptions  WhatsApp numbers subscribed to release alerts (read-only here; DELETE unsubscribes)
 *   surveys        surveys currently in the field
 *   officers       the field-staff register (badge number → name, survey, area, validity)
 */
export const KINDS = ["indicators", "releases", "subscriptions", "surveys", "officers"] as const;
export type Kind = (typeof KINDS)[number];
const topicKeys = STAT_TOPICS.map((t) => t.key) as [string, ...string[]];
const d = (v: string | null | undefined) => (v ? new Date(v) : null);

export const SCHEMAS = {
  indicators: z.object({ topic: z.enum(topicKeys), name: z.string().min(2).max(80), value: z.string().min(1).max(80), period: z.string().max(60).optional().nullable(), releaseDate: z.string().optional().nullable(), url: z.string().max(500).optional().nullable(), note: z.string().max(255).optional().nullable(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() }),
  releases: z.object({ title: z.string().min(2).max(160), topic: z.enum(topicKeys), scheduledAt: z.string().min(4), url: z.string().max(500).optional().nullable(), summary: z.string().max(500).optional().nullable() }),
  subscriptions: z.object({ isActive: z.boolean().optional() }),
  surveys: z.object({ code: z.string().min(2).max(24), name: z.string().min(2).max(160), description: z.string().max(5000).optional().nullable(), areas: z.string().max(255).optional().nullable(), startsOn: z.string().optional().nullable(), endsOn: z.string().optional().nullable(), isActive: z.boolean().optional() }),
  officers: z.object({ badgeNo: z.string().min(2).max(32), name: z.string().min(2).max(120), role: z.string().max(60).optional().nullable(), surveyId: z.string().optional().nullable(), area: z.string().max(160).optional().nullable(), validFrom: z.string().optional().nullable(), validTo: z.string().optional().nullable(), isActive: z.boolean().optional() }),
} as const;

export function kindOf(k: string): Kind { if (!(KINDS as readonly string[]).includes(k)) throw notFound(); return k as Kind; }

export const GET = withAuth(async (req, { params, user }) => {
  const kind = kindOf(params.kind);
  const q = getQuery(req);
  const orgId = user.orgId;
  switch (kind) {
    case "indicators": return ok(await prisma.statIndicator.findMany({ where: { orgId, ...(q.get("topic") ? { topic: q.get("topic")! } : {}) }, orderBy: [{ topic: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }));
    case "releases": return ok(await prisma.statRelease.findMany({ where: { orgId }, orderBy: { scheduledAt: q.get("past") === "1" ? "desc" : "asc" }, take: 200 }));
    case "subscriptions": { const list = await prisma.statSubscription.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 500 }); return ok(list.map((s) => ({ ...s, phone: s.phone.replace(/\d(?=\d{3})/g, "•") }))); }
    case "surveys": return ok(await prisma.survey.findMany({ where: { orgId }, orderBy: [{ isActive: "desc" }, { name: "asc" }], include: { _count: { select: { officers: true } } } }));
    case "officers": return ok(await prisma.fieldOfficer.findMany({ where: { orgId, ...(q.get("q") ? { OR: [{ badgeNo: { contains: q.get("q")! } }, { name: { contains: q.get("q")! } }] } : {}) }, orderBy: [{ isActive: "desc" }, { badgeNo: "asc" }], include: { survey: { select: { id: true, name: true, code: true } } }, take: 1000 }));
  }
});

export const POST = withAuth(async (req, { params, user }) => {
  const kind = kindOf(params.kind);
  const orgId = user.orgId;
  switch (kind) {
    case "indicators": { const b = await parseBody(req, SCHEMAS.indicators); const r = await prisma.statIndicator.create({ data: { orgId, topic: b.topic, name: b.name, value: b.value, period: b.period || null, releaseDate: d(b.releaseDate), url: b.url || null, note: b.note || null, sortOrder: b.sortOrder ?? 0, isActive: b.isActive ?? true, updatedById: user.id } }); await audit(orgId, user.id, "chatbot.indicator_created", "StatIndicator", r.id, { name: r.name }); return ok(r, { status: 201 }); }
    case "releases": { const b = await parseBody(req, SCHEMAS.releases); const r = await prisma.statRelease.create({ data: { orgId, title: b.title, topic: b.topic, scheduledAt: new Date(b.scheduledAt), url: b.url || null, summary: b.summary || null } }); await audit(orgId, user.id, "chatbot.release_created", "StatRelease", r.id, { title: r.title }); return ok(r, { status: 201 }); }
    case "surveys": { const b = await parseBody(req, SCHEMAS.surveys); if (await prisma.survey.findUnique({ where: { orgId_code: { orgId, code: b.code } } })) throw badRequest("A survey with that code already exists"); const r = await prisma.survey.create({ data: { orgId, code: b.code, name: b.name, description: b.description || null, areas: b.areas || null, startsOn: d(b.startsOn), endsOn: d(b.endsOn), isActive: b.isActive ?? true } }); await audit(orgId, user.id, "chatbot.survey_created", "Survey", r.id, { code: r.code }); return ok(r, { status: 201 }); }
    case "officers": { const b = await parseBody(req, SCHEMAS.officers); const badgeNo = b.badgeNo.toUpperCase().replace(/\s+/g, ""); if (await prisma.fieldOfficer.findUnique({ where: { orgId_badgeNo: { orgId, badgeNo } } })) throw badRequest("An officer with that badge number already exists"); const r = await prisma.fieldOfficer.create({ data: { orgId, badgeNo, name: b.name, role: b.role || null, surveyId: b.surveyId || null, area: b.area || null, validFrom: d(b.validFrom), validTo: d(b.validTo), isActive: b.isActive ?? true } }); await audit(orgId, user.id, "chatbot.officer_created", "FieldOfficer", r.id, { badgeNo }); return ok(r, { status: 201 }); }
    default: throw badRequest("Subscriptions are created by the public on WhatsApp");
  }
}, "MANAGER");
