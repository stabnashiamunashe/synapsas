import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, getQuery, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { MAX_FILE_MB, extensionOf, safeMimeFor, validateUpload } from "@/lib/uploads";
import { STAT_TOPICS } from "@/lib/whatsapp/i18n";

/**
 * Content the WhatsApp chatbot answers from, one resource per `kind`:
 *   indicators     headline statistics (topic → indicator → latest value, period, release date, ODP link)
 *   releases       advance release calendar; publishing one alerts subscribers (see [id] route)
 *   subscriptions  WhatsApp numbers subscribed to release alerts (read-only here; DELETE unsubscribes)
 *   surveys        surveys currently in the field
 *   officers       the field-staff register (badge number → name, survey, area, validity)
 *   documents      publications and tables (PDF, Excel, CSV, Word) the bot sends as WhatsApp attachments, per topic or for all topics
 */
export const KINDS = ["indicators", "releases", "subscriptions", "surveys", "officers", "documents"] as const;
export type Kind = (typeof KINDS)[number];
const topicKeys = STAT_TOPICS.map((t) => t.key) as [string, ...string[]];
const docTopicKeys = [...topicKeys, "ALL"] as [string, ...string[]];
const DOC_EXTENSIONS = ["pdf", "xlsx", "xls", "csv", "docx"];
const d = (v: string | null | undefined) => (v ? new Date(v) : null);

export const SCHEMAS = {
  indicators: z.object({ topic: z.enum(topicKeys), name: z.string().min(2).max(80), value: z.string().min(1).max(80), period: z.string().max(60).optional().nullable(), releaseDate: z.string().optional().nullable(), url: z.string().max(500).optional().nullable(), note: z.string().max(255).optional().nullable(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() }),
  releases: z.object({ title: z.string().min(2).max(160), topic: z.enum(topicKeys), scheduledAt: z.string().min(4), url: z.string().max(500).optional().nullable(), summary: z.string().max(500).optional().nullable() }),
  subscriptions: z.object({ isActive: z.boolean().optional() }),
  surveys: z.object({ code: z.string().min(2).max(24), name: z.string().min(2).max(160), description: z.string().max(5000).optional().nullable(), areas: z.string().max(255).optional().nullable(), startsOn: z.string().optional().nullable(), endsOn: z.string().optional().nullable(), isActive: z.boolean().optional() }),
  documents: z.object({ topic: z.enum(docTopicKeys), title: z.string().min(2).max(120), description: z.string().max(255).optional().nullable(), period: z.string().max(60).optional().nullable(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() }),
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
    case "documents": return ok(await prisma.statDocument.findMany({ where: { orgId, ...(q.get("topic") ? { topic: q.get("topic")! } : {}) }, orderBy: [{ topic: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }] }));
    case "officers": return ok(await prisma.fieldOfficer.findMany({ where: { orgId, ...(q.get("q") ? { OR: [{ badgeNo: { contains: q.get("q")! } }, { name: { contains: q.get("q")! } }] } : {}) }, orderBy: [{ isActive: "desc" }, { badgeNo: "asc" }], include: { survey: { select: { id: true, name: true, code: true } } }, take: 1000 }));
  }
});

/** multipart: file (one), topic, title, period?, description?. Stored under UPLOAD_DIR/{org}/chatbot with the usual allowlist and magic-byte checks. */
async function createDocument(req: Request, user: { id: string; orgId: string }) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("No file provided");
  const meta = SCHEMAS.documents.parse({ topic: String(form.get("topic") || ""), title: String(form.get("title") || file.name.replace(/\.[^.]+$/, "")), description: String(form.get("description") || "") || null, period: String(form.get("period") || "") || null, isActive: String(form.get("isActive") ?? "true") !== "false" });
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw badRequest(`${file.name} exceeds ${MAX_FILE_MB} MB`);
  if (!DOC_EXTENSIONS.includes(extensionOf(file.name))) throw badRequest(`Only ${DOC_EXTENSIONS.map((e) => `.${e}`).join(", ")} files can be sent on WhatsApp here`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const problem = validateUpload(file.name, file.type, bytes);
  if (problem) throw badRequest(problem);
  const dir = path.resolve(process.env.UPLOAD_DIR || "./uploads", user.orgId, "chatbot");
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const storageName = `${nanoid(24)}.${extensionOf(file.name)}`;
  await writeFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, storageName), bytes, { mode: 0o600 });
  const r = await prisma.statDocument.create({ data: { orgId: user.orgId, topic: meta.topic, title: meta.title, description: meta.description || null, period: meta.period || null, fileName: file.name.slice(0, 200), mimeType: safeMimeFor(file.name), size: file.size, storagePath: path.join(/*turbopackIgnore: true*/ user.orgId, "chatbot", storageName), isActive: meta.isActive ?? true, uploadedById: user.id } });
  await audit(user.orgId, user.id, "chatbot.document_uploaded", "StatDocument", r.id, { title: r.title, fileName: r.fileName, size: r.size });
  return ok(r, { status: 201 });
}

export const POST = withAuth(async (req, { params, user }) => {
  const kind = kindOf(params.kind);
  const orgId = user.orgId;
  if (kind === "documents") return createDocument(req, user);
  switch (kind) {
    case "indicators": { const b = await parseBody(req, SCHEMAS.indicators); const r = await prisma.statIndicator.create({ data: { orgId, topic: b.topic, name: b.name, value: b.value, period: b.period || null, releaseDate: d(b.releaseDate), url: b.url || null, note: b.note || null, sortOrder: b.sortOrder ?? 0, isActive: b.isActive ?? true, updatedById: user.id } }); await audit(orgId, user.id, "chatbot.indicator_created", "StatIndicator", r.id, { name: r.name }); return ok(r, { status: 201 }); }
    case "releases": { const b = await parseBody(req, SCHEMAS.releases); const r = await prisma.statRelease.create({ data: { orgId, title: b.title, topic: b.topic, scheduledAt: new Date(b.scheduledAt), url: b.url || null, summary: b.summary || null } }); await audit(orgId, user.id, "chatbot.release_created", "StatRelease", r.id, { title: r.title }); return ok(r, { status: 201 }); }
    case "surveys": { const b = await parseBody(req, SCHEMAS.surveys); if (await prisma.survey.findUnique({ where: { orgId_code: { orgId, code: b.code } } })) throw badRequest("A survey with that code already exists"); const r = await prisma.survey.create({ data: { orgId, code: b.code, name: b.name, description: b.description || null, areas: b.areas || null, startsOn: d(b.startsOn), endsOn: d(b.endsOn), isActive: b.isActive ?? true } }); await audit(orgId, user.id, "chatbot.survey_created", "Survey", r.id, { code: r.code }); return ok(r, { status: 201 }); }
    case "officers": { const b = await parseBody(req, SCHEMAS.officers); const badgeNo = b.badgeNo.toUpperCase().replace(/\s+/g, ""); if (await prisma.fieldOfficer.findUnique({ where: { orgId_badgeNo: { orgId, badgeNo } } })) throw badRequest("An officer with that badge number already exists"); const r = await prisma.fieldOfficer.create({ data: { orgId, badgeNo, name: b.name, role: b.role || null, surveyId: b.surveyId || null, area: b.area || null, validFrom: d(b.validFrom), validTo: d(b.validTo), isActive: b.isActive ?? true } }); await audit(orgId, user.id, "chatbot.officer_created", "FieldOfficer", r.id, { badgeNo }); return ok(r, { status: 201 }); }
    default: throw badRequest("Subscriptions are created by the public on WhatsApp");
  }
}, "MANAGER");
