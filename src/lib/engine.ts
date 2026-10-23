// Workflow engine: level resolution, submission, approve/reject/return/delegate, escalation.
import { prisma } from "./prisma";
import { parseJson, toJson } from "./json";
import { evaluateCondition, normaliseFormData, renderTemplate } from "./formula";
import { extractCost } from "./cost";
import { audit, dispatchWebhooks, notify } from "./notify";
import { ApiError, badRequest, forbidden } from "./api";
import type {
  FieldDef,
  LevelDef,
  OrgSettings,
  TemplateSettings,
  TemplateSnapshot,
} from "./types";

type RequestWithRels = NonNullable<Awaited<ReturnType<typeof loadRequest>>>;

export async function loadRequest(id: string, orgId: string) {
  return prisma.request.findFirst({
    where: { id, orgId },
    include: {
      requester: { include: { department: true, manager: true } },
      template: true,
      project: { select: { id: true, code: true, name: true } },
      approvals: { include: { approver: true }, orderBy: [{ levelOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
}

function snapshotOf(r: RequestWithRels): TemplateSnapshot {
  return parseJson<TemplateSnapshot>(r.templateSnapshot, {
    name: r.template.name,
    category: r.template.category as TemplateSnapshot["category"],
    fields: parseJson<FieldDef[]>(r.template.fields, []),
    levels: parseJson<LevelDef[]>(r.template.levels, []),
    settings: parseJson<TemplateSettings>(r.template.settings, {}),
    version: r.template.version,
  });
}

/** Substitute approvers who have an active out-of-office delegation. */
async function applyDelegations(orgId: string, userIds: string[]) {
  if (!userIds.length) return userIds;
  const now = new Date();
  const dels = await prisma.delegation.findMany({
    where: { orgId, isActive: true, fromUserId: { in: userIds }, startsAt: { lte: now }, endsAt: { gte: now } },
  });
  const map = new Map(dels.map((d) => [d.fromUserId, d.toUserId]));
  return Array.from(new Set(userIds.map((u) => map.get(u) ?? u)));
}

/** Resolve the concrete approver user ids for a level. */
export async function resolveApprovers(
  level: LevelDef,
  r: RequestWithRels,
  data: Record<string, unknown>,
): Promise<string[]> {
  const orgId = r.orgId;
  let ids: string[] = [];
  switch (level.approverType) {
    case "USER":
      ids = level.approverUserIds || [];
      break;
    case "ROLE": {
      const users = await prisma.user.findMany({
        where: {
          orgId,
          isActive: true,
          role: level.approverRole || "MANAGER",
          ...(level.restrictToRequesterDepartment && r.requester.departmentId
            ? { departmentId: r.requester.departmentId }
            : {}),
        },
        select: { id: true },
      });
      ids = users.map((u) => u.id);
      break;
    }
    case "DEPARTMENT_HEAD":
      ids = r.requester.department?.headUserId ? [r.requester.department.headUserId] : [];
      break;
    case "REQUESTER_MANAGER":
      ids = r.requester.managerId ? [r.requester.managerId] : [];
      break;
    case "FIELD_USER": {
      const v = level.fieldKey ? data[level.fieldKey] : null;
      ids = Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
      break;
    }
    case "FIELD_DEPARTMENT_HEAD": {
      const deptId = level.fieldKey ? String(data[level.fieldKey] || "") : "";
      if (deptId) {
        const d = await prisma.department.findFirst({ where: { id: deptId, orgId } });
        ids = d?.headUserId ? [d.headUserId] : [];
      }
      break;
    }
    case "DEPARTMENT": {
      if (level.departmentId) {
        const rank: Record<string, number> = { MEMBER: 0, MANAGER: 1, ADMIN: 2, OWNER: 3 };
        const members = await prisma.user.findMany({ where: { orgId, isActive: true, departmentId: level.departmentId }, select: { id: true, role: true } });
        const min = rank[level.minRole || "MEMBER"] ?? 0;
        ids = members.filter((m) => (rank[m.role] ?? 0) >= min).map((m) => m.id);
      }
      break;
    }
  }
  // Only active users in this org.
  if (ids.length) {
    const valid = await prisma.user.findMany({
      where: { orgId, isActive: true, id: { in: ids } },
      select: { id: true },
    });
    ids = valid.map((u) => u.id);
  }
  if (level.skipIfRequester) ids = ids.filter((id) => id !== r.requesterId);
  if (!ids.length && level.fallbackUserId) ids = [level.fallbackUserId];
  return applyDelegations(orgId, ids);
}

/** Determine which level orders apply to this request after evaluating conditions. */
export function applicableLevels(levels: LevelDef[], data: Record<string, unknown>) {
  return [...levels]
    .sort((a, b) => a.order - b.order)
    .filter((l) => evaluateCondition(l.condition, data))
    .map((l) => l.order);
}

async function startLevel(r: RequestWithRels, levelOrder: number) {
  const snap = snapshotOf(r);
  const level = snap.levels.find((l) => l.order === levelOrder);
  if (!level) throw new ApiError(500, `Level ${levelOrder} not found in snapshot`);
  const data = parseJson<Record<string, unknown>>(r.data, {});
  const approvers = await resolveApprovers(level, r, data);
  if (!approvers.length) {
    // Nobody can approve this level: auto-skip with a system comment so nothing gets stuck.
    await prisma.comment.create({
      data: {
        requestId: r.id,
        userId: r.requesterId,
        isSystem: true,
        body: `Level "${level.name}" was skipped automatically: no approver could be resolved.`,
      },
    });
    return advance(r.id, r.orgId, levelOrder);
  }
  const dueAt = level.slaHours ? new Date(Date.now() + level.slaHours * 3600 * 1000) : null;
  await prisma.requestApproval.createMany({
    data: approvers.map((approverId) => ({
      requestId: r.id,
      levelOrder,
      levelName: level.name,
      approverId,
      dueAt,
    })),
  });
  await prisma.request.update({ where: { id: r.id }, data: { currentLevel: levelOrder, status: "PENDING" } });
  await notify(r.orgId, approvers, {
    title: `Approval needed: ${r.referenceNo}`,
    body: `${r.title} is waiting for your approval (${level.name}).`,
    link: `/app/requests/${r.id}`,
    type: "APPROVAL",
  });
  if (snap.settings.notifyRequesterOnEachLevel) {
    await notify(r.orgId, [r.requesterId], {
      title: `${r.referenceNo} moved to ${level.name}`,
      link: `/app/requests/${r.id}`,
    });
  }
}

/** Move to the next applicable level after `afterLevel`, or complete the request. */
async function advance(requestId: string, orgId: string, afterLevel: number) {
  const r = await loadRequest(requestId, orgId);
  if (!r) return;
  const active = parseJson<number[]>(r.activeLevels, []);
  const next = active.find((o) => o > afterLevel);
  if (next === undefined) {
    await prisma.request.update({
      where: { id: r.id },
      data: { status: "APPROVED", completedAt: new Date(), currentLevel: afterLevel },
    });
    await notify(orgId, [r.requesterId], {
      title: `${r.referenceNo} approved`,
      body: `${r.title} has completed all approval levels.`,
      link: `/app/requests/${r.id}`,
      type: "SUCCESS",
    });
    await dispatchWebhooks(orgId, "request.approved", publicRequest(r));
    return;
  }
  await dispatchWebhooks(orgId, "request.level_advanced", { ...publicRequest(r), level: next });
  await startLevel(r, next);
}

export function publicRequest(r: RequestWithRels) {
  return {
    id: r.id,
    referenceNo: r.referenceNo,
    title: r.title,
    status: r.status,
    priority: r.priority,
    templateId: r.templateId,
    requester: { id: r.requester.id, name: r.requester.name, email: r.requester.email },
    currentLevel: r.currentLevel,
    data: parseJson(r.data, {}),
    submittedAt: r.submittedAt,
    completedAt: r.completedAt,
  };
}

export async function nextReferenceNo(templateId: string) {
  const t = await prisma.workflowTemplate.update({
    where: { id: templateId },
    data: { counter: { increment: 1 } },
  });
  const year = new Date().getFullYear();
  return `${t.prefix}-${year}-${String(t.counter).padStart(4, "0")}`;
}

/** Validate required fields against the template definition. */
export function validateFormData(fields: FieldDef[], data: Record<string, unknown>) {
  const errors: { path: string; message: string }[] = [];
  for (const f of fields) {
    if (["heading", "divider"].includes(f.type)) continue;
    if (f.visibleWhen && !evaluateCondition(f.visibleWhen, data)) continue;
    const v = data[f.key];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (f.required && empty) errors.push({ path: f.key, message: `${f.label} is required` });
    if (f.type === "table" && Array.isArray(v)) {
      if (f.minRows && v.length < f.minRows)
        errors.push({ path: f.key, message: `${f.label} needs at least ${f.minRows} row(s)` });
      for (const [i, row] of (v as Record<string, unknown>[]).entries()) {
        for (const c of f.columns || []) {
          if (c.required && c.type !== "computed") {
            const cv = row[c.key];
            if (cv === undefined || cv === null || cv === "")
              errors.push({ path: `${f.key}.${i}.${c.key}`, message: `Row ${i + 1}: ${c.label} is required` });
          }
        }
      }
    }
    if ((f.type === "number" || f.type === "currency") && !empty) {
      const n = Number(v);
      if (f.min !== undefined && n < f.min) errors.push({ path: f.key, message: `${f.label} must be ≥ ${f.min}` });
      if (f.max !== undefined && n > f.max) errors.push({ path: f.key, message: `${f.label} must be ≤ ${f.max}` });
    }
  }
  return errors;
}

/** Submit a draft (or resubmit a returned request). */
export async function submitRequest(requestId: string, orgId: string, actorId: string) {
  const r = await loadRequest(requestId, orgId);
  if (!r) throw new ApiError(404, "Request not found");
  if (r.requesterId !== actorId) throw forbidden("Only the requester can submit");
  if (!["DRAFT", "RETURNED"].includes(r.status)) throw badRequest(`Cannot submit a ${r.status} request`);

  const fields = parseJson<FieldDef[]>(r.template.fields, []);
  const levels = parseJson<LevelDef[]>(r.template.levels, []);
  const settings = parseJson<TemplateSettings>(r.template.settings, {});
  const data = normaliseFormData(fields, parseJson<Record<string, unknown>>(r.data, {}));
  data.priority = r.priority;

  const errors = validateFormData(fields, data);
  if (errors.length) throw new ApiError(422, "Please complete the form", errors);
  if (settings.requireAttachment) {
    const count = await prisma.attachment.count({ where: { requestId } });
    if (!count) throw new ApiError(422, "An attachment is required", [{ path: "attachments", message: "Attach at least one file" }]);
  }
  if (settings.requireProject && !r.projectId) {
    throw new ApiError(422, "A project is required", [{ path: "projectId", message: "Choose the project this request belongs to" }]);
  }
  const costAmount = extractCost(fields, settings, data);

  const snapshot: TemplateSnapshot = {
    name: r.template.name,
    category: r.template.category as TemplateSnapshot["category"],
    fields,
    levels,
    settings,
    version: r.template.version,
  };
  const active = applicableLevels(levels, data);
  const title = settings.titleTemplate ? renderTemplate(settings.titleTemplate, data) || r.title : r.title;
  const dueAt = settings.dueInDays ? new Date(Date.now() + settings.dueInDays * 86400000) : r.dueAt;

  // Clear any old pending steps from a previous cycle (resubmission after return).
  await prisma.requestApproval.updateMany({
    where: { requestId, status: "PENDING" },
    data: { status: "SKIPPED" },
  });

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: {
      data: toJson(data),
      title,
      templateSnapshot: toJson(snapshot),
      activeLevels: toJson(active),
      submittedAt: new Date(),
      completedAt: null,
      dueAt,
      status: "PENDING",
      currentLevel: 0,
      costAmount,
    },
  });
  await audit(orgId, actorId, r.status === "RETURNED" ? "request.resubmitted" : "request.submitted", "Request", requestId, { referenceNo: r.referenceNo, costAmount });
  const fresh = (await loadRequest(requestId, orgId))!;
  await dispatchWebhooks(orgId, "request.submitted", publicRequest(fresh));

  if (!active.length) {
    if (settings.autoApproveIfNoLevels !== false) {
      await advance(requestId, orgId, 0);
    }
    return updated;
  }
  await startLevel(fresh, active[0]);
  return prisma.request.findUnique({ where: { id: requestId } });
}

export type ActionKind = "APPROVE" | "REJECT" | "RETURN" | "DELEGATE";

/** Perform an approver action on the current level. */
export async function actOnRequest(
  requestId: string,
  orgId: string,
  actorId: string,
  action: ActionKind,
  comment?: string,
  delegateToId?: string,
) {
  const r = await loadRequest(requestId, orgId);
  if (!r) throw new ApiError(404, "Request not found");
  if (r.status !== "PENDING") throw badRequest(`Request is ${r.status}, no action possible`);
  const snap = snapshotOf(r);
  const level = snap.levels.find((l) => l.order === r.currentLevel);
  if (!level) throw new ApiError(500, "Current level missing");
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const orgSettings = parseJson<OrgSettings>(org?.settings, {});

  const step = r.approvals.find(
    (a) => a.levelOrder === r.currentLevel && a.status === "PENDING" && a.approverId === actorId,
  );
  if (!step) throw forbidden("You have no pending approval on this request");
  if (r.requesterId === actorId && !orgSettings.allowSelfApproval)
    throw forbidden("Self-approval is disabled for this organisation");

  const needsComment =
    (action === "REJECT" && (orgSettings.requireCommentOnReject ?? true)) ||
    action === "RETURN" ||
    (action === "APPROVE" && level.requireComment);
  if (needsComment && !comment?.trim()) throw badRequest("A comment is required for this action");

  const now = new Date();
  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  const actorName = actor?.name || "Approver";

  if (action === "DELEGATE") {
    if (!level.allowDelegate) throw forbidden("Delegation is not allowed at this level");
    if (!delegateToId) throw badRequest("Choose who to delegate to");
    const target = await prisma.user.findFirst({ where: { id: delegateToId, orgId, isActive: true } });
    if (!target) throw badRequest("Delegate not found");
    await prisma.requestApproval.update({
      where: { id: step.id },
      data: { status: "DELEGATED", comment, actedAt: now, delegatedToId: delegateToId },
    });
    await prisma.requestApproval.create({
      data: {
        requestId,
        levelOrder: step.levelOrder,
        levelName: step.levelName,
        approverId: delegateToId,
        dueAt: step.dueAt,
      },
    });
    await prisma.comment.create({
      data: { requestId, userId: actorId, isSystem: true, body: `${actorName} delegated approval to ${target.name}.${comment ? " " + comment : ""}` },
    });
    await notify(orgId, [delegateToId], {
      title: `Delegated to you: ${r.referenceNo}`,
      body: `${actorName} asked you to review ${r.title}.`,
      link: `/app/requests/${r.id}`,
      type: "APPROVAL",
    });
    await audit(orgId, actorId, "request.delegated", "Request", requestId, { to: delegateToId, level: level.order });
    return loadRequest(requestId, orgId);
  }

  const statusMap = { APPROVE: "APPROVED", REJECT: "REJECTED", RETURN: "RETURNED" } as const;
  await prisma.requestApproval.update({
    where: { id: step.id },
    data: { status: statusMap[action], comment, actedAt: now },
  });
  await prisma.comment.create({
    data: {
      requestId,
      userId: actorId,
      isSystem: true,
      body: `${actorName} ${action === "APPROVE" ? "approved" : action === "REJECT" ? "rejected" : "returned"} at level "${level.name}".${comment ? " Comment: " + comment : ""}`,
    },
  });
  await audit(orgId, actorId, `request.${action.toLowerCase()}`, "Request", requestId, { level: level.order });

  if (action === "RETURN" && level.allowReturn === false) throw forbidden("Return is not allowed at this level");

  // Loop-back: a return that re-runs an earlier level instead of going back to the requester.
  const activeOrders = parseJson<number[]>(r.activeLevels, []);
  const loopTarget = action === "RETURN" && typeof level.returnTo === "number" && level.returnTo < level.order && activeOrders.includes(level.returnTo) ? level.returnTo : null;
  if (loopTarget !== null) {
    const target = snap.levels.find((l) => l.order === loopTarget)!;
    await prisma.requestApproval.updateMany({
      where: { requestId, levelOrder: r.currentLevel, status: "PENDING" },
      data: { status: "SKIPPED" },
    });
    await prisma.comment.create({
      data: { requestId, userId: actorId, isSystem: true, body: `Sent back to level ${target.order} "${target.name}" for another look.` },
    });
    await notify(orgId, [r.requesterId], {
      title: `${r.referenceNo} looped back to ${target.name}`,
      body: comment,
      link: `/app/requests/${r.id}`,
      type: "WARNING",
    });
    const fresh = (await loadRequest(requestId, orgId))!;
    await startLevel(fresh, loopTarget);
    await dispatchWebhooks(orgId, "request.level_advanced", { ...publicRequest(fresh), level: loopTarget, loopBack: true });
    return loadRequest(requestId, orgId);
  }

  if (action === "REJECT" || action === "RETURN") {
    await prisma.requestApproval.updateMany({
      where: { requestId, levelOrder: r.currentLevel, status: "PENDING" },
      data: { status: "SKIPPED" },
    });
    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: action === "REJECT" ? "REJECTED" : "RETURNED",
        completedAt: action === "REJECT" ? now : null,
      },
    });
    await notify(orgId, [r.requesterId], {
      title: `${r.referenceNo} ${action === "REJECT" ? "rejected" : "returned for changes"}`,
      body: comment,
      link: `/app/requests/${r.id}`,
      type: action === "REJECT" ? "ERROR" : "WARNING",
    });
    const fresh = (await loadRequest(requestId, orgId))!;
    await dispatchWebhooks(orgId, action === "REJECT" ? "request.rejected" : "request.returned", publicRequest(fresh));
    return fresh;
  }

  // APPROVE: check whether the level is complete.
  const pendingSameLevel = await prisma.requestApproval.count({
    where: { requestId, levelOrder: r.currentLevel, status: "PENDING" },
  });
  const levelDone = level.mode === "ANY" || pendingSameLevel === 0;
  if (levelDone) {
    if (level.mode === "ANY" && pendingSameLevel > 0) {
      await prisma.requestApproval.updateMany({
        where: { requestId, levelOrder: r.currentLevel, status: "PENDING" },
        data: { status: "SKIPPED" },
      });
    }
    await advance(requestId, orgId, r.currentLevel);
  }
  return loadRequest(requestId, orgId);
}

export async function cancelRequest(requestId: string, orgId: string, actorId: string, isAdmin: boolean) {
  const r = await loadRequest(requestId, orgId);
  if (!r) throw new ApiError(404, "Request not found");
  if (!["DRAFT", "PENDING", "RETURNED"].includes(r.status)) throw badRequest(`Cannot cancel a ${r.status} request`);
  const snap = snapshotOf(r);
  if (r.requesterId !== actorId && !isAdmin) throw forbidden("Only the requester or an admin can cancel");
  if (r.requesterId === actorId && r.status === "PENDING" && snap.settings.allowRequesterCancel === false && !isAdmin)
    throw forbidden("Cancelling after submission is disabled for this workflow");
  await prisma.requestApproval.updateMany({ where: { requestId, status: "PENDING" }, data: { status: "SKIPPED" } });
  await prisma.request.update({ where: { id: requestId }, data: { status: "CANCELLED", completedAt: new Date() } });
  await audit(orgId, actorId, "request.cancelled", "Request", requestId);
  const pendingApprovers = r.approvals.filter((a) => a.status === "PENDING").map((a) => a.approverId);
  await notify(orgId, pendingApprovers, { title: `${r.referenceNo} was cancelled`, link: `/app/requests/${r.id}` });
  await dispatchWebhooks(orgId, "request.cancelled", publicRequest(r));
  return loadRequest(requestId, orgId);
}

/** Escalate overdue pending steps: notify approver + escalation contact, add escalation contact as approver. */
export async function escalateOverdue(orgId?: string) {
  const now = new Date();
  const overdue = await prisma.requestApproval.findMany({
    where: { status: "PENDING", dueAt: { lt: now }, ...(orgId ? { request: { orgId } } : {}) },
    include: { request: true },
  });
  let escalated = 0;
  for (const step of overdue) {
    const snap = parseJson<TemplateSnapshot>(step.request.templateSnapshot, { levels: [] } as unknown as TemplateSnapshot);
    const level = snap.levels.find((l) => l.order === step.levelOrder);
    const oid = step.request.orgId;
    await notify(oid, [step.approverId], {
      title: `Overdue: ${step.request.referenceNo}`,
      body: `Your approval for "${step.request.title}" is past its SLA.`,
      link: `/app/requests/${step.requestId}`,
      type: "WARNING",
    });
    if (level?.escalateToUserId && level.escalateToUserId !== step.approverId) {
      const exists = await prisma.requestApproval.findFirst({
        where: { requestId: step.requestId, levelOrder: step.levelOrder, approverId: level.escalateToUserId, status: "PENDING" },
      });
      if (!exists) {
        await prisma.requestApproval.update({ where: { id: step.id }, data: { status: "ESCALATED", actedAt: now } });
        await prisma.requestApproval.create({
          data: {
            requestId: step.requestId,
            levelOrder: step.levelOrder,
            levelName: step.levelName,
            approverId: level.escalateToUserId,
          },
        });
        await prisma.comment.create({
          data: { requestId: step.requestId, userId: step.approverId, isSystem: true, body: `Level "${step.levelName}" escalated after SLA breach.` },
        });
        await notify(oid, [level.escalateToUserId], {
          title: `Escalated to you: ${step.request.referenceNo}`,
          body: `"${step.request.title}" breached its SLA at ${step.levelName}.`,
          link: `/app/requests/${step.requestId}`,
          type: "APPROVAL",
        });
        await audit(oid, null, "request.escalated", "Request", step.requestId, { level: step.levelOrder });
        const fresh = await loadRequest(step.requestId, oid);
        if (fresh) await dispatchWebhooks(oid, "request.escalated", publicRequest(fresh));
        escalated++;
      }
    } else {
      // Avoid re-notifying every run: push the due date forward by a day.
      await prisma.requestApproval.update({ where: { id: step.id }, data: { dueAt: new Date(now.getTime() + 86400000) } });
    }
  }
  return { checked: overdue.length, escalated };
}
