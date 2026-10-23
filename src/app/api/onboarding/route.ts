import { prisma } from "@/lib/prisma";
import { createInvitation } from "@/lib/invitations";
import { ok, parseBody, withAuth } from "@/lib/api";
import { onboardingSchema } from "@/lib/validators";
import { parseJson, toJson } from "@/lib/json";
import { audit } from "@/lib/notify";
import { PRESETS } from "@/lib/presets";
import { limitsFor, withinLimit } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import type { OrgSettings } from "@/lib/types";

export const GET = withAuth(async (_req, { user }) => {
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  const [users, templates] = await Promise.all([
    prisma.user.count({ where: { orgId: user.orgId } }),
    prisma.workflowTemplate.count({ where: { orgId: user.orgId } }),
  ]);
  return ok({ completed: !!org?.onboardingCompletedAt, users, templates, org: { name: org?.name, settings: parseJson(org?.settings, {}), billingEmail: org?.billingEmail } });
});

/** Completes onboarding in one call: org details, team invitations, workflow presets. */
export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, onboardingSchema);
  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  if (!org) return ok(null);
  const settings = { ...parseJson<OrgSettings>(org.settings, {}), ...(body.currency ? { currency: body.currency } : {}), ...(body.timezone ? { timezone: body.timezone } : {}) };
  const limits = limitsFor(effectivePlan(org));

  const invites: { email: string; link: string }[] = [];
  const existing = await prisma.user.count({ where: { orgId: org.id, isActive: true } });
  for (const [i, inv] of body.invites.entries()) {
    if (!withinLimit(limits.users, existing + i)) break;
    const email = inv.email.toLowerCase();
    const dup = await prisma.user.findUnique({ where: { orgId_email: { orgId: org.id, email } } });
    if (dup) continue;
    const { link } = await createInvitation({ orgId: org.id, email, role: inv.role, departmentId: null, invitedBy: user });
    invites.push({ email, link });
  }

  const created: string[] = [];
  const count = await prisma.workflowTemplate.count({ where: { orgId: org.id } });
  for (const [i, cat] of body.presets.entries()) {
    const p = PRESETS[cat];
    if (!p || !withinLimit(limits.templates, count + i)) continue;
    const exists = await prisma.workflowTemplate.findFirst({ where: { orgId: org.id, category: cat } });
    if (exists) continue;
    const t = await prisma.workflowTemplate.create({
      data: { orgId: org.id, name: p.name!, category: cat, prefix: p.prefix!, icon: p.icon, color: p.color, description: p.description, fields: toJson(p.fields), levels: toJson(p.levels), settings: toJson(p.settings), createdById: user.id },
    });
    created.push(t.name);
  }

  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: { name: body.orgName || org.name, settings: toJson(settings), billingEmail: body.billingEmail || org.billingEmail, onboardingCompletedAt: new Date() },
  });
  await audit(org.id, user.id, "org.onboarded", "Organization", org.id, { invites: invites.length, presets: created });
  return ok({ completed: true, invites, created, name: updated.name });
}, "OWNER");
