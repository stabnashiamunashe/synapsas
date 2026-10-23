"use client";

import { Col, Input, InputNumber, Row, Select, Space, Switch, Tag, Typography } from "antd";
import type { ApproverType, FieldDef, LevelDef, Role } from "@/lib/types";
import { useApi } from "@/lib/client";
import { ConditionEditor } from "./ConditionEditor";

export const APPROVER_TYPES: { value: ApproverType; label: string; hint: string; short: string }[] = [
  { value: "REQUESTER_MANAGER", label: "Requester's line manager", short: "Line manager", hint: "Uses the manager set on the requester's profile." },
  { value: "DEPARTMENT_HEAD", label: "Requester's department head", short: "Dept. head", hint: "Uses the head of the requester's department." },
  { value: "USER", label: "Specific user(s)", short: "Named users", hint: "Pick one or more named approvers." },
  { value: "ROLE", label: "Anyone with a role", short: "By role", hint: "e.g. every Manager, optionally only in the requester's department." },
  { value: "FIELD_USER", label: "Person chosen on the form", short: "From form", hint: "Requires a 'Person picker' field." },
  { value: "FIELD_DEPARTMENT_HEAD", label: "Head of section chosen on the form", short: "Section head (form)", hint: "Requires a 'Department picker' field." },
  { value: "DEPARTMENT", label: "Any officer in a named section", short: "Section", hint: "e.g. Finance Section certifies, Registry records and files, Internal Audit examines. Any member of the section can act (or all of them, in ALL mode)." },
];

export type DepartmentOption = { id: string; name: string; code?: string | null };

export type UserOption = { id: string; name: string; email?: string; role: Role };

/** Settings for one approval level. Used by the list editor and the canvas drawer. */
export function LevelSettingsForm({ level: l, fields, users, levels = [], onChange: update }: {
  level: LevelDef; fields: FieldDef[]; users?: UserOption[]; levels?: LevelDef[]; onChange: (patch: Partial<LevelDef>) => void;
}) {
  const earlier = levels.filter((x) => x.order < l.order).sort((a, b) => a.order - b.order);
  const userFields = fields.filter((f) => f.type === "user");
  const deptFields = fields.filter((f) => f.type === "department");
  const userOptions = (users || []).map((u) => ({ value: u.id, label: `${u.name} · ${u.role.toLowerCase()}` }));
  const { data: departments } = useApi<DepartmentOption[]>(l.approverType === "DEPARTMENT" ? "/api/departments" : null);
  return (
    <Row gutter={12}>
      <Col xs={24} md={12}><label className="muted">Name</label><Input value={l.name} onChange={(e) => update({ name: e.target.value })} /></Col>
      <Col xs={24} md={12}><label className="muted">Instructions for approver</label><Input value={l.description || ""} onChange={(e) => update({ description: e.target.value })} /></Col>
      <Col span={24} style={{ marginTop: 10 }}>
        <label className="muted">Who approves</label>
        <Select style={{ width: "100%" }} value={l.approverType} onChange={(approverType) => update({ approverType })} options={APPROVER_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{APPROVER_TYPES.find((t) => t.value === l.approverType)?.hint}</Typography.Text>
      </Col>
      {l.approverType === "USER" && (
        <Col span={24} style={{ marginTop: 10 }}><label className="muted">Approvers</label><Select mode="multiple" showSearch optionFilterProp="label" style={{ width: "100%" }} value={l.approverUserIds || []} onChange={(approverUserIds) => update({ approverUserIds })} options={userOptions} /></Col>
      )}
      {l.approverType === "ROLE" && (
        <>
          <Col xs={24} md={12} style={{ marginTop: 10 }}><label className="muted">Role</label><Select style={{ width: "100%" }} value={l.approverRole} onChange={(approverRole) => update({ approverRole })} options={["OWNER", "ADMIN", "MANAGER", "MEMBER"].map((r) => ({ value: r, label: r }))} /></Col>
          <Col xs={24} md={12} style={{ marginTop: 26 }}><Switch size="small" checked={!!l.restrictToRequesterDepartment} onChange={(v) => update({ restrictToRequesterDepartment: v })} /> Only in requester&apos;s department</Col>
        </>
      )}
      {l.approverType === "FIELD_USER" && (
        <Col span={24} style={{ marginTop: 10 }}><label className="muted">Form field</label><Select style={{ width: "100%" }} value={l.fieldKey} onChange={(fieldKey) => update({ fieldKey })} options={userFields.map((f) => ({ value: f.key, label: f.label }))} notFoundContent="Add a Person picker field first" /></Col>
      )}
      {l.approverType === "FIELD_DEPARTMENT_HEAD" && (
        <Col span={24} style={{ marginTop: 10 }}><label className="muted">Form field</label><Select style={{ width: "100%" }} value={l.fieldKey} onChange={(fieldKey) => update({ fieldKey })} options={deptFields.map((f) => ({ value: f.key, label: f.label }))} notFoundContent="Add a Department picker field first" /></Col>
      )}
      {l.approverType === "DEPARTMENT" && (
        <>
          <Col xs={24} md={14} style={{ marginTop: 10 }}><label className="muted">Section / department</label><Select showSearch optionFilterProp="label" style={{ width: "100%" }} value={l.departmentId || undefined} onChange={(departmentId) => update({ departmentId })} options={(departments || []).map((d) => ({ value: d.id, label: d.code ? `${d.name} (${d.code})` : d.name }))} placeholder="Choose a section" /></Col>
          <Col xs={24} md={10} style={{ marginTop: 10 }}><label className="muted">Minimum role in that section</label><Select style={{ width: "100%" }} value={l.minRole || "MEMBER"} onChange={(minRole) => update({ minRole })} options={["MEMBER", "MANAGER", "ADMIN", "OWNER"].map((r) => ({ value: r, label: r === "MEMBER" ? "Any officer" : `${r.charAt(0)}${r.slice(1).toLowerCase()} or above` }))} /></Col>
        </>
      )}
      <Col xs={24} md={12} style={{ marginTop: 10 }}>
        <label className="muted">Approval mode</label>
        <Select style={{ width: "100%" }} value={l.mode} onChange={(mode) => update({ mode })} options={[{ value: "ANY", label: "Any one approver decides" }, { value: "ALL", label: "All approvers must approve" }]} />
      </Col>
      <Col xs={24} md={12} style={{ marginTop: 10 }}>
        <label className="muted">SLA (hours, blank = none)</label>
        <InputNumber style={{ width: "100%" }} min={0} value={l.slaHours ?? undefined} onChange={(v) => update({ slaHours: v ?? undefined })} />
      </Col>
      <Col xs={24} md={12} style={{ marginTop: 10 }}>
        <label className="muted">Escalate to (after SLA breach)</label>
        <Select allowClear showSearch optionFilterProp="label" style={{ width: "100%" }} value={l.escalateToUserId || undefined} onChange={(escalateToUserId) => update({ escalateToUserId: escalateToUserId || undefined })} options={userOptions} />
      </Col>
      <Col xs={24} md={12} style={{ marginTop: 10 }}>
        <label className="muted">Fallback approver (if none resolved)</label>
        <Select allowClear showSearch optionFilterProp="label" style={{ width: "100%" }} value={l.fallbackUserId || undefined} onChange={(fallbackUserId) => update({ fallbackUserId: fallbackUserId || undefined })} options={userOptions} />
      </Col>
      <Col xs={24} md={12} style={{ marginTop: 10 }}>
        <label className="muted">When returned for changes, send it to</label>
        <Select style={{ width: "100%" }} value={typeof l.returnTo === "number" ? l.returnTo : "REQUESTER"} disabled={l.allowReturn === false}
          onChange={(v) => update({ returnTo: v === "REQUESTER" ? undefined : Number(v) })}
          options={[{ value: "REQUESTER", label: "The requester (edit and resubmit)" }, ...earlier.map((e) => ({ value: e.order, label: `Loop back to level ${e.order}: ${e.name}` }))]} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>A loop-back re-runs the earlier level without the requester editing the form.</Typography.Text>
      </Col>
      <Col span={24} style={{ marginTop: 14 }}>
        <Space size="large" wrap>
          <span><Switch size="small" checked={l.allowDelegate !== false} onChange={(allowDelegate) => update({ allowDelegate })} /> Allow delegate</span>
          <span><Switch size="small" checked={l.allowReturn !== false} onChange={(allowReturn) => update({ allowReturn })} /> Allow return</span>
          <span><Switch size="small" checked={!!l.skipIfRequester} onChange={(skipIfRequester) => update({ skipIfRequester })} /> Skip if approver is requester</span>
          <span><Switch size="small" checked={!!l.requireComment} onChange={(requireComment) => update({ requireComment })} /> Require comment on approve</span>
        </Space>
      </Col>
      <Col span={24} style={{ marginTop: 14 }}>
        <Tag color="blue">Conditional level</Tag>
        <div style={{ marginTop: 6 }}><ConditionEditor fields={fields} value={l.condition || null} onChange={(condition) => update({ condition: condition || undefined })} /></div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Example: run this level only when <span className="mono">itemsTotal ≥ 5000</span>. Levels whose condition is false are skipped.</Typography.Text>
      </Col>
    </Row>
  );
}

const DEPT_NAMES = new Map<string, string>();
/** Called by pages that know the departments so diagrams can name sections. */
export function registerDepartmentNames(list: { id: string; name: string }[] | undefined) {
  for (const d of list || []) DEPT_NAMES.set(d.id, d.name);
}
const departmentName = (id?: string) => (id ? DEPT_NAMES.get(id) : undefined);

/** One-line description of who a level routes to, for diagrams and cards. */
export function describeApprover(l: LevelDef, users?: UserOption[]) {
  switch (l.approverType) {
    case "USER": {
      const names = (l.approverUserIds || []).map((id) => users?.find((u) => u.id === id)?.name || "user");
      return names.length ? names.join(", ") : "No approver set";
    }
    case "ROLE": return `Every ${(l.approverRole || "MANAGER").toLowerCase()}${l.restrictToRequesterDepartment ? " in requester's dept." : ""}`;
    case "DEPARTMENT_HEAD": return "Requester's department head";
    case "REQUESTER_MANAGER": return "Requester's line manager";
    case "FIELD_USER": return `Person from field "${l.fieldKey || "?"}"`;
    case "FIELD_DEPARTMENT_HEAD": return `Head of section from field "${l.fieldKey || "?"}"`;
    case "DEPARTMENT": return `${l.minRole && l.minRole !== "MEMBER" ? `${l.minRole.charAt(0)}${l.minRole.slice(1).toLowerCase()}s in` : "Any officer in"} ${departmentName(l.departmentId) || "the section"}`;
    default: return "";
  }
}

export function describeCondition(l: LevelDef) {
  if (!l.condition?.field) return null;
  const opText: Record<string, string> = { eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", in: "in", contains: "contains", empty: "is empty", notEmpty: "is set" };
  const v = l.condition.value === undefined || l.condition.value === null || l.condition.value === "" ? "" : ` ${String(l.condition.value)}`;
  return `${l.condition.field} ${opText[l.condition.op] || l.condition.op}${v}`;
}
