import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { notifyReleaseSubscribers } from "@/lib/whatsapp/notify";
import { SCHEMAS, kindOf } from "../route";

const d = (v: string | null | undefined) => (v === undefined ? undefined : v ? new Date(v) : null);
const opt = <T,>(v: T | null | undefined) => (v === undefined ? undefined : v || null);

export const PATCH = withAuth(async (req, { params, user }) => {
  const kind = kindOf(params.kind);
  const orgId = user.orgId, id = params.id;
  switch (kind) {
    case "indicators": {
      const cur = await prisma.statIndicator.findFirst({ where: { id, orgId } }); if (!cur) throw notFound();
      const b = await parseBody(req, SCHEMAS.indicators.partial());
      const r = await prisma.statIndicator.update({ where: { id }, data: { topic: b.topic, name: b.name, value: b.value, period: opt(b.period), releaseDate: d(b.releaseDate), url: opt(b.url), note: opt(b.note), sortOrder: b.sortOrder, isActive: b.isActive, updatedById: user.id } });
      await audit(orgId, user.id, "chatbot.indicator_updated", "StatIndicator", id, { name: r.name, value: r.value }); return ok(r);
    }
    case "releases": {
      const cur = await prisma.statRelease.findFirst({ where: { id, orgId } }); if (!cur) throw notFound();
      const b = await parseBody(req, SCHEMAS.releases.partial().extend({ action: SCHEMAS.releases.shape.title.optional() }));
      if (b.action === "publish") {
        if (cur.publishedAt && cur.notifiedAt) throw badRequest("This release has already been published and subscribers alerted");
        const sent = await notifyReleaseSubscribers({ ...cur });
        const r = await prisma.statRelease.update({ where: { id }, data: { publishedAt: cur.publishedAt || new Date(), notifiedAt: new Date() } });
        await audit(orgId, user.id, "chatbot.release_published", "StatRelease", id, { title: r.title, sent });
        return ok({ ...r, sent });
      }
      const r = await prisma.statRelease.update({ where: { id }, data: { title: b.title, topic: b.topic, scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : undefined, url: opt(b.url), summary: opt(b.summary) } });
      await audit(orgId, user.id, "chatbot.release_updated", "StatRelease", id, { title: r.title }); return ok(r);
    }
    case "subscriptions": {
      const cur = await prisma.statSubscription.findFirst({ where: { id, orgId } }); if (!cur) throw notFound();
      const b = await parseBody(req, SCHEMAS.subscriptions);
      const r = await prisma.statSubscription.update({ where: { id }, data: { isActive: b.isActive } });
      await audit(orgId, user.id, "chatbot.subscription_updated", "StatSubscription", id, { isActive: r.isActive }); return ok({ ...r, phone: r.phone.replace(/\d(?=\d{3})/g, "•") });
    }
    case "surveys": {
      const cur = await prisma.survey.findFirst({ where: { id, orgId } }); if (!cur) throw notFound();
      const b = await parseBody(req, SCHEMAS.surveys.partial());
      if (b.code && b.code !== cur.code && (await prisma.survey.findUnique({ where: { orgId_code: { orgId, code: b.code } } }))) throw badRequest("A survey with that code already exists");
      const r = await prisma.survey.update({ where: { id }, data: { code: b.code, name: b.name, description: opt(b.description), areas: opt(b.areas), startsOn: d(b.startsOn), endsOn: d(b.endsOn), isActive: b.isActive } });
      await audit(orgId, user.id, "chatbot.survey_updated", "Survey", id, { code: r.code }); return ok(r);
    }
    case "officers": {
      const cur = await prisma.fieldOfficer.findFirst({ where: { id, orgId } }); if (!cur) throw notFound();
      const b = await parseBody(req, SCHEMAS.officers.partial());
      const badgeNo = b.badgeNo?.toUpperCase().replace(/\s+/g, "");
      if (badgeNo && badgeNo !== cur.badgeNo && (await prisma.fieldOfficer.findUnique({ where: { orgId_badgeNo: { orgId, badgeNo } } }))) throw badRequest("An officer with that badge number already exists");
      const r = await prisma.fieldOfficer.update({ where: { id }, data: { badgeNo, name: b.name, role: opt(b.role), surveyId: opt(b.surveyId), area: opt(b.area), validFrom: d(b.validFrom), validTo: d(b.validTo), isActive: b.isActive } });
      await audit(orgId, user.id, "chatbot.officer_updated", "FieldOfficer", id, { badgeNo: r.badgeNo, isActive: r.isActive }); return ok(r);
    }
  }
}, "MANAGER");

export const DELETE = withAuth(async (_req, { params, user }) => {
  const kind = kindOf(params.kind);
  const orgId = user.orgId, id = params.id;
  const where = { id, orgId };
  switch (kind) {
    case "indicators": if (!(await prisma.statIndicator.findFirst({ where }))) throw notFound(); await prisma.statIndicator.delete({ where: { id } }); break;
    case "releases": if (!(await prisma.statRelease.findFirst({ where }))) throw notFound(); await prisma.statRelease.delete({ where: { id } }); break;
    case "subscriptions": if (!(await prisma.statSubscription.findFirst({ where }))) throw notFound(); await prisma.statSubscription.delete({ where: { id } }); break;
    case "surveys": if (!(await prisma.survey.findFirst({ where }))) throw notFound(); await prisma.survey.delete({ where: { id } }); break;
    case "officers": if (!(await prisma.fieldOfficer.findFirst({ where }))) throw notFound(); await prisma.fieldOfficer.delete({ where: { id } }); break;
  }
  await audit(orgId, user.id, `chatbot.${kind.slice(0, -1)}_deleted`, kind, id, {});
  return ok({ id });
}, "MANAGER");
