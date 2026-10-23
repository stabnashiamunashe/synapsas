// Service desk engine (ported from the local-council issue tracker): reference numbers, SLA, least-busy
// assignment, duplicate detection, status transitions with optimistic concurrency, notifications.
import { prisma } from "./prisma";
import { parseJson } from "./json";
import { audit, notify } from "./notify";
import { ApiError } from "./api";
import { hasRole } from "./roles";
import { sendCaseUpdateEmail } from "./emails";
import { CASE_DONE, CASE_TRANSITIONS, DEFAULT_CASE_SETTINGS, slaState, type CasePriority, type CaseSettings, type CaseStatus } from "./caseTypes";
import type { OrgSettings, Role, SessionUser } from "./types";

export type CaseSettingsFull = typeof DEFAULT_CASE_SETTINGS & CaseSettings;

export async function caseSettings(orgId: string): Promise<CaseSettingsFull> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
  const s = parseJson<OrgSettings & { cases?: CaseSettings }>(org?.settings || "{}", {});
  return { ...DEFAULT_CASE_SETTINGS, ...(s.cases || {}) };
}

/** {PREFIX}-{year}-{seq 4 digits}; sequence restarts every year; retried on a unique-key collision. */
export async function nextCaseReference(orgId: string, prefix: string) {
  const year = new Date().getFullYear();
  const p = `${prefix.toUpperCase()}-${year}-`;
  const last = await prisma.case.findFirst({ where: { orgId, referenceNo: { startsWith: p } }, orderBy: { referenceNo: "desc" }, select: { referenceNo: true } });
  const seq = last ? Number(last.referenceNo.slice(p.length)) + 1 : 1;
  return `${p}${String(seq).padStart(4, "0")}`;
}

/** Active delegation = out of office; the delegate is the backup agent. */
async function outOfOffice(orgId: string, userIds: string[]) {
  const now = new Date();
  const rows = await prisma.delegation.findMany({ where: { orgId, fromUserId: { in: userIds }, isActive: true, startsAt: { lte: now }, endsAt: { gte: now } }, select: { fromUserId: true, toUserId: true } });
  return new Map(rows.map((r) => [r.fromUserId, r.toUserId]));
}

/**
 * Least-busy active member of the section (open cases + 100 if out of office). Falls back to the section's
 * default assignee, then its head, then any active admin.
 */
export async function findLeastBusyAgent(orgId: string, departmentId: string | null | undefined, exclude: string[] = []) {
  if (departmentId) {
    const members = await prisma.user.findMany({ where: { orgId, isActive: true, departmentId, id: { notIn: exclude } }, select: { id: true, role: true } });
    const agents = members.filter((m) => m.role === "MEMBER" || m.role === "MANAGER");
    if (agents.length) {
      const counts = await prisma.case.groupBy({ by: ["assigneeId"], where: { orgId, assigneeId: { in: agents.map((a) => a.id) }, status: { notIn: CASE_DONE } }, _count: { _all: true } });
      const open = new Map(counts.map((c) => [c.assigneeId, c._count._all]));
      const ooo = await outOfOffice(orgId, agents.map((a) => a.id));
      const ranked = agents
        .map((a) => ({ id: a.id, weight: (open.get(a.id) || 0) + (ooo.has(a.id) ? 100 : 0), role: a.role }))
        // prefer officers over the section head when equally loaded
        .sort((a, b) => a.weight - b.weight || (a.role === "MEMBER" ? -1 : 1));
      const chosen = ranked[0];
      const backup = ooo.get(chosen.id);
      if (backup) {
        const b = await prisma.user.findFirst({ where: { id: backup, orgId, isActive: true }, select: { id: true } });
        if (b) return b.id;
      }
      return chosen.id;
    }
    const dept = await prisma.department.findFirst({ where: { id: departmentId, orgId }, select: { defaultAssigneeId: true, headUserId: true } });
    for (const cand of [dept?.defaultAssigneeId, dept?.headUserId]) {
      if (cand && !exclude.includes(cand)) {
        const u = await prisma.user.findFirst({ where: { id: cand, orgId, isActive: true }, select: { id: true } });
        if (u) return u.id;
      }
    }
  }
  const admin = await prisma.user.findFirst({ where: { orgId, isActive: true, role: { in: ["ADMIN", "OWNER"] }, id: { notIn: exclude } }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return admin?.id || null;
}

export interface DuplicateCandidate { id: string; referenceNo: string; title: string; status: string; createdAt: Date; locationAddress: string | null; reason: string }

/** Advisory duplicate check: same category/section within 14 days, matching address, nearby coordinates (<250 m) or similar title. */
export async function findPotentialDuplicates(orgId: string, input: { categoryId?: string | null; departmentId?: string | null; locationAddress?: string | null; title?: string | null; latitude?: number | null; longitude?: number | null }): Promise<DuplicateCandidate[]> {
  const cutoff = new Date(Date.now() - 14 * 86400_000);
  const candidates = await prisma.case.findMany({
    where: {
      orgId, createdAt: { gte: cutoff }, status: { notIn: ["CLOSED", "REJECTED"] },
      ...(input.categoryId ? { categoryId: input.categoryId } : input.departmentId ? { departmentId: input.departmentId } : {}),
    },
    orderBy: { createdAt: "desc" }, take: 40,
    select: { id: true, referenceNo: true, title: true, status: true, createdAt: true, locationAddress: true, latitude: true, longitude: true, categoryId: true },
  });
  const addr = (input.locationAddress || "").trim().toLowerCase();
  const title = (input.title || "").trim().toLowerCase();
  const out: DuplicateCandidate[] = [];
  for (const c of candidates) {
    const reasons: string[] = [];
    if (input.categoryId && c.categoryId === input.categoryId) reasons.push("Same category");
    let located = false;
    if (addr.length >= 4 && c.locationAddress && c.locationAddress.toLowerCase().includes(addr)) { reasons.push("Matching location"); located = true; }
    if (!located && input.latitude && input.longitude && c.latitude && c.longitude) {
      const dLat = (input.latitude - c.latitude) * 111_000;
      const dLon = (input.longitude - c.longitude) * 111_000 * Math.cos((input.latitude * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      if (dist < 250) { reasons.push(`Nearby (${Math.round(dist)} m)`); located = true; }
    }
    if (title.length > 4 && (c.title.toLowerCase().includes(title) || title.includes(c.title.toLowerCase()))) reasons.push("Similar title");
    // "same category" alone is too weak to flag; require a location or title match as well
    if (reasons.length && (located || reasons.includes("Similar title"))) out.push({ id: c.id, referenceNo: c.referenceNo, title: c.title, status: c.status, createdAt: c.createdAt, locationAddress: c.locationAddress, reason: reasons.join(" & ") });
  }
  return out.slice(0, 5);
}

export interface CreateCaseInput {
  title: string; description: string; categoryId?: string | null; departmentId?: string | null; priority?: CasePriority | null; projectId?: string | null;
  reporterName: string; reporterPhone?: string | null; reporterEmail?: string | null; reporterUserId?: string | null; source?: string;
  locationAddress?: string | null; latitude?: number | null; longitude?: number | null; office?: string | null; customFields?: Record<string, unknown>;
}

export async function createCase(orgId: string, input: CreateCaseInput, actor: { id: string; name: string } | null, ctx?: { ip?: string; userAgent?: string }) {
  const settings = await caseSettings(orgId);
  const category = input.categoryId ? await prisma.caseCategory.findFirst({ where: { id: input.categoryId, orgId } }) : null;
  if (input.categoryId && !category) throw new ApiError(400, "Category not found");
  const departmentId = category?.departmentId || input.departmentId || null;
  if (departmentId) {
    const d = await prisma.department.findFirst({ where: { id: departmentId, orgId }, select: { id: true } });
    if (!d) throw new ApiError(400, "Section not found");
  }
  if (category && !category.isActive) throw new ApiError(400, "That category is not accepting reports");
  const slaHours = category?.defaultSlaHours ?? 72;
  const priority = (input.priority || (category?.defaultPriority as CasePriority) || "MEDIUM") as CasePriority;
  let assigneeId: string | null = null;
  let status: CaseStatus = "NEW";
  if (departmentId) {
    if (settings.autoAssign && !settings.requireTriage) assigneeId = await findLeastBusyAgent(orgId, departmentId);
    status = assigneeId && !settings.requireTriage ? "ASSIGNED" : "TRIAGED";
  }
  const source = input.source || (actor ? "STAFF" : "PUBLIC");
  for (let attempt = 0; attempt < 3; attempt++) {
    const referenceNo = await nextCaseReference(orgId, settings.prefix);
    try {
      const c = await prisma.case.create({
        data: {
          orgId, referenceNo, title: input.title.slice(0, 255), description: input.description, status, priority,
          departmentId, categoryId: category?.id || null, assigneeId, projectId: input.projectId || null,
          reporterName: input.reporterName.slice(0, 255), reporterPhone: input.reporterPhone || null, reporterEmail: input.reporterEmail?.toLowerCase() || null, reporterUserId: input.reporterUserId || null,
          source, locationAddress: input.locationAddress || null, latitude: input.latitude ?? null, longitude: input.longitude ?? null, office: input.office || null,
          slaHours, slaDueAt: new Date(Date.now() + slaHours * 3600_000), customFields: JSON.stringify(input.customFields || {}),
          events: { create: { fromStatus: null, toStatus: status, changedById: actor?.id || null, changedByName: actor?.name || `${input.reporterName} (reporter)`, reason: `Logged via ${source.toLowerCase().replace("_", " ")}` } },
        },
      });
      if (assigneeId) await notify(orgId, [assigneeId], { title: `New case assigned: ${referenceNo}`, body: c.title, link: `/app/cases?open=${c.id}`, type: "APPROVAL" });
      else if (departmentId) {
        const head = await prisma.department.findUnique({ where: { id: departmentId }, select: { headUserId: true } });
        if (head?.headUserId) await notify(orgId, [head.headUserId], { title: `New case for triage: ${referenceNo}`, body: c.title, link: `/app/cases?open=${c.id}`, type: "APPROVAL" });
      }
      await audit(orgId, actor?.id || null, "case.created", "Case", c.id, { referenceNo, source, status }, ctx);
      if (c.reporterEmail) void sendCaseUpdateEmail({ email: c.reporterEmail, name: c.reporterName, orgId }, c, "created");
      return c;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002" && attempt < 2) continue; // reference collision under concurrency
      throw e;
    }
  }
  throw new ApiError(500, "Could not allocate a case reference");
}

/** Change status with optimistic concurrency. Admins may jump between any columns; others follow the state machine. */
export async function changeCaseStatus(orgId: string, caseId: string, to: CaseStatus, version: number, actor: SessionUser, reason?: string | null, ctx?: { ip?: string; userAgent?: string }) {
  const c = await prisma.case.findFirst({ where: { id: caseId, orgId } });
  if (!c) throw new ApiError(404, "Case not found");
  if (c.version !== version) throw new ApiError(409, "This case was updated by someone else. Refresh and try again.");
  const settings = await caseSettings(orgId);
  const from = c.status as CaseStatus;
  if (from !== to && !hasRole(actor, "ADMIN") && !CASE_TRANSITIONS[from]?.includes(to)) throw new ApiError(400, `A ${from.toLowerCase().replace("_", " ")} case cannot move straight to ${to.toLowerCase().replace("_", " ")}`);
  if (settings.requireTransitionReason && !reason?.trim()) throw new ApiError(422, "A reason is required for status changes");
  const now = new Date();
  const updated = await prisma.case.update({
    where: { id: c.id },
    data: {
      status: to, version: { increment: 1 }, lastActivityAt: now,
      ...(to === "RESOLVED" ? { resolvedAt: now } : {}),
      ...(to === "CLOSED" ? { closedAt: now } : {}),
      ...(to === "REOPENED" ? { resolvedAt: null, closedAt: null, slaDueAt: new Date(now.getTime() + c.slaHours * 3600_000), slaWarnedAt: null, slaBreachedAt: null } : {}),
      events: { create: { fromStatus: from, toStatus: to, changedById: actor.id, changedByName: actor.name, reason: reason || null } },
    },
  });
  if (c.assigneeId && c.assigneeId !== actor.id) await notify(orgId, [c.assigneeId], { title: `${c.referenceNo} is now ${to.toLowerCase().replace("_", " ")}`, body: `${actor.name}${reason ? `: ${reason}` : ""}`, link: `/app/cases?open=${c.id}`, type: "STATUS" });
  if (c.reporterUserId && c.reporterUserId !== actor.id) await notify(orgId, [c.reporterUserId], { title: `${c.referenceNo} is now ${to.toLowerCase().replace("_", " ")}`, body: c.title, link: `/app/cases?open=${c.id}`, type: "STATUS" });
  if (c.reporterEmail && ["IN_PROGRESS", "RESOLVED", "REJECTED", "CLOSED"].includes(to)) void sendCaseUpdateEmail({ email: c.reporterEmail, name: c.reporterName, orgId }, updated, "status", reason || undefined);
  await audit(orgId, actor.id, "case.status", "Case", c.id, { from, to, reason }, ctx);
  return updated;
}

/** Edit fields (not status). Reassignment is recorded in the timeline and notified. */
export async function updateCase(orgId: string, caseId: string, patch: Partial<Pick<CreateCaseInput, "title" | "description" | "priority" | "categoryId" | "departmentId" | "projectId" | "locationAddress" | "office" | "latitude" | "longitude" | "customFields">> & { assigneeId?: string | null; slaHours?: number }, version: number, actor: SessionUser, ctx?: { ip?: string; userAgent?: string }) {
  const c = await prisma.case.findFirst({ where: { id: caseId, orgId } });
  if (!c) throw new ApiError(404, "Case not found");
  if (c.version !== version) throw new ApiError(409, "This case was updated by someone else. Refresh and try again.");
  let departmentId = patch.departmentId === undefined ? c.departmentId : patch.departmentId;
  let categoryId = patch.categoryId === undefined ? c.categoryId : patch.categoryId;
  if (categoryId && categoryId !== c.categoryId) {
    const cat = await prisma.caseCategory.findFirst({ where: { id: categoryId, orgId } });
    if (!cat) throw new ApiError(400, "Category not found");
    departmentId = cat.departmentId;
  }
  if (departmentId && departmentId !== c.departmentId && categoryId) {
    const cat = await prisma.caseCategory.findFirst({ where: { id: categoryId, orgId }, select: { departmentId: true } });
    if (cat && cat.departmentId !== departmentId) categoryId = null; // category belongs to another section
  }
  if (patch.assigneeId) {
    const u = await prisma.user.findFirst({ where: { id: patch.assigneeId, orgId, isActive: true }, select: { id: true } });
    if (!u) throw new ApiError(400, "Assignee not found");
  }
  const reassigned = patch.assigneeId !== undefined && patch.assigneeId !== c.assigneeId;
  const slaHours = patch.slaHours ?? c.slaHours;
  const updated = await prisma.case.update({
    where: { id: c.id },
    data: {
      title: patch.title?.slice(0, 255), description: patch.description, priority: patch.priority || undefined, projectId: patch.projectId === undefined ? undefined : patch.projectId,
      departmentId, categoryId, assigneeId: patch.assigneeId === undefined ? undefined : patch.assigneeId,
      locationAddress: patch.locationAddress === undefined ? undefined : patch.locationAddress, office: patch.office === undefined ? undefined : patch.office,
      latitude: patch.latitude === undefined ? undefined : patch.latitude, longitude: patch.longitude === undefined ? undefined : patch.longitude,
      slaHours, slaDueAt: patch.slaHours !== undefined ? new Date(c.createdAt.getTime() + slaHours * 3600_000) : undefined,
      customFields: patch.customFields ? JSON.stringify(patch.customFields) : undefined,
      version: { increment: 1 }, lastActivityAt: new Date(),
      ...(reassigned && patch.assigneeId && ["NEW", "TRIAGED"].includes(c.status) ? { status: "ASSIGNED" } : {}),
      ...(reassigned ? { events: { create: { fromStatus: c.status, toStatus: patch.assigneeId && ["NEW", "TRIAGED"].includes(c.status) ? "ASSIGNED" : c.status, changedById: actor.id, changedByName: actor.name, reason: patch.assigneeId ? `Assigned to ${(await prisma.user.findUnique({ where: { id: patch.assigneeId }, select: { name: true } }))?.name}` : "Unassigned" } } } : {}),
    },
  });
  if (reassigned && patch.assigneeId && patch.assigneeId !== actor.id) await notify(orgId, [patch.assigneeId], { title: `Case assigned to you: ${c.referenceNo}`, body: c.title, link: `/app/cases?open=${c.id}`, type: "APPROVAL" });
  await audit(orgId, actor.id, "case.updated", "Case", c.id, { fields: Object.keys(patch) }, ctx);
  return updated;
}

export async function linkDuplicate(orgId: string, caseId: string, originalId: string, actor: SessionUser) {
  if (caseId === originalId) throw new ApiError(400, "A case cannot duplicate itself");
  const [c, o] = await Promise.all([prisma.case.findFirst({ where: { id: caseId, orgId } }), prisma.case.findFirst({ where: { id: originalId, orgId } })]);
  if (!c || !o) throw new ApiError(404, "Case not found");
  const updated = await prisma.case.update({
    where: { id: c.id },
    data: { isDuplicate: true, duplicateOfId: o.id, status: "REJECTED", version: { increment: 1 }, lastActivityAt: new Date(), events: { create: { fromStatus: c.status, toStatus: "REJECTED", changedById: actor.id, changedByName: actor.name, reason: `Marked as duplicate of ${o.referenceNo}` } } },
  });
  await audit(orgId, actor.id, "case.duplicate_linked", "Case", c.id, { of: o.referenceNo });
  if (c.reporterEmail) void sendCaseUpdateEmail({ email: c.reporterEmail, name: c.reporterName, orgId }, updated, "status", `This report duplicates ${o.referenceNo}, which is already being handled.`);
  return updated;
}

/** When a staff member is deactivated, hand their open cases to the least-busy colleague. */
export async function reassignCasesOnDeactivation(orgId: string, userId: string, actorName: string) {
  const open = await prisma.case.findMany({ where: { orgId, assigneeId: userId, status: { notIn: CASE_DONE } } });
  let moved = 0;
  for (const c of open) {
    const next = await findLeastBusyAgent(orgId, c.departmentId, [userId]);
    await prisma.case.update({
      where: { id: c.id },
      data: { assigneeId: next, version: { increment: 1 }, events: { create: { fromStatus: c.status, toStatus: c.status, changedByName: actorName, reason: next ? "Reassigned automatically: previous assignee deactivated" : "Previous assignee deactivated; back in the queue" } } },
    });
    if (next) await notify(orgId, [next], { title: `Case reassigned to you: ${c.referenceNo}`, body: c.title, link: `/app/cases?open=${c.id}`, type: "APPROVAL" });
    moved++;
  }
  return moved;
}

/** Cron: raise SLA warnings and breach escalations once per case. */
export async function caseSlaSweep() {
  const now = new Date();
  const orgs = await prisma.organization.findMany({ select: { id: true, settings: true } });
  let warned = 0, breached = 0;
  for (const org of orgs) {
    const settings = { ...DEFAULT_CASE_SETTINGS, ...(parseJson<{ cases?: CaseSettings }>(org.settings, {}).cases || {}) };
    const open = await prisma.case.findMany({ where: { orgId: org.id, status: { notIn: CASE_DONE }, slaDueAt: { not: null } }, select: { id: true, referenceNo: true, title: true, slaDueAt: true, slaWarnedAt: true, slaBreachedAt: true, assigneeId: true, departmentId: true, status: true } });
    for (const c of open) {
      const st = slaState(c.slaDueAt, c.status, settings.slaWarningHours);
      if (st.breached && !c.slaBreachedAt) {
        const head = c.departmentId ? (await prisma.department.findUnique({ where: { id: c.departmentId }, select: { headUserId: true } }))?.headUserId : null;
        await notify(org.id, [c.assigneeId, head].filter((x): x is string => !!x), { title: `SLA breached: ${c.referenceNo}`, body: c.title, link: `/app/cases?open=${c.id}`, type: "ERROR" });
        await prisma.case.update({ where: { id: c.id }, data: { slaBreachedAt: now, events: { create: { fromStatus: c.status, toStatus: c.status, changedByName: "System", reason: "SLA breached; escalated to the section head" } } } });
        breached++;
      } else if (st.warning && !c.slaWarnedAt && !c.slaBreachedAt) {
        if (c.assigneeId) await notify(org.id, [c.assigneeId], { title: `SLA due soon: ${c.referenceNo}`, body: `${Math.max(0, Math.round(st.hoursRemaining || 0))} hours left`, link: `/app/cases?open=${c.id}`, type: "WARNING" });
        await prisma.case.update({ where: { id: c.id }, data: { slaWarnedAt: now } });
        warned++;
      }
    }
  }
  return { warned, breached };
}

/** Role scope for listing/reading: OWNER/ADMIN everything; MANAGER their section (as head or member); MEMBER assigned or reported by them. */
export async function caseScope(user: SessionUser) {
  if (hasRole(user, "ADMIN")) return {};
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { departmentId: true, headOf: { select: { id: true } } } });
  const depts = [...(u?.headOf.map((d) => d.id) || []), ...(u?.departmentId ? [u.departmentId] : [])];
  if (user.role === "MANAGER") return { OR: [{ departmentId: { in: depts } }, { assigneeId: user.id }, { reporterUserId: user.id }] };
  return { OR: [{ assigneeId: user.id }, { reporterUserId: user.id }] };
}

export const caseInclude = {
  department: { select: { id: true, name: true, code: true } },
  category: { select: { id: true, name: true, icon: true } },
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  project: { select: { id: true, code: true, name: true } },
  _count: { select: { comments: true, attachments: true } },
} as const;

export function serializeCase<T extends { slaDueAt: Date | null; status: string; customFields: string }>(c: T, warningHours = 24) {
  const sla = slaState(c.slaDueAt, c.status, warningHours);
  return { ...c, customFields: parseJson<Record<string, unknown>>(c.customFields, {}), slaBreached: sla.breached, slaWarning: sla.warning, slaHoursRemaining: sla.hoursRemaining };
}

export const roleRank: Record<Role, number> = { MEMBER: 0, MANAGER: 1, ADMIN: 2, OWNER: 3 };
