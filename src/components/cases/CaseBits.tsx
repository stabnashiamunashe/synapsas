"use client";

import { Tag, Tooltip } from "antd";
import { ClockCircleOutlined, WarningOutlined } from "@ant-design/icons";
import { CASE_PRIORITY_COLORS, CASE_PRIORITY_LABELS, CASE_STATUS_COLORS, CASE_STATUS_LABELS, type CasePriority, type CaseStatus } from "@/lib/caseTypes";

export interface CaseListItem {
  id: string; referenceNo: string; title: string; description?: string; status: CaseStatus; priority: CasePriority; version: number;
  departmentId?: string | null; categoryId?: string | null; assigneeId?: string | null; projectId?: string | null;
  department?: { id: string; name: string; code?: string | null } | null; category?: { id: string; name: string; icon?: string | null } | null;
  assignee?: { id: string; name: string; avatarUrl?: string | null } | null; project?: { id: string; code: string; name: string } | null;
  reporterName: string; reporterPhone?: string | null; reporterEmail?: string | null; reporterUserId?: string | null; source: string;
  locationAddress?: string | null; latitude?: number | null; longitude?: number | null; office?: string | null;
  slaHours: number; slaDueAt?: string | null; slaBreached: boolean; slaWarning: boolean; slaHoursRemaining: number | null;
  resolvedAt?: string | null; closedAt?: string | null; rating?: number | null; feedback?: string | null; isDuplicate: boolean; duplicateOfId?: string | null;
  customFields: Record<string, unknown>; createdAt: string; updatedAt: string; lastActivityAt: string;
  _count?: { comments: number; attachments: number };
}

export function StatusPill({ status }: { status: CaseStatus }) {
  const c = CASE_STATUS_COLORS[status] || "#7A8B99";
  return <Tag style={{ background: `${c}1a`, color: c, borderColor: `${c}55`, borderRadius: 999, fontWeight: 600, marginInlineEnd: 0 }}>{CASE_STATUS_LABELS[status] || status}</Tag>;
}

export function PriorityDot({ priority, withLabel }: { priority: CasePriority; withLabel?: boolean }) {
  const c = CASE_PRIORITY_COLORS[priority] || "#E2A33D";
  return (
    <Tooltip title={`${CASE_PRIORITY_LABELS[priority] || priority} priority`}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5f6b7a" }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: c, display: "inline-block" }} />{withLabel ? CASE_PRIORITY_LABELS[priority] : null}
      </span>
    </Tooltip>
  );
}

export function SlaBadge({ c, compact }: { c: Pick<CaseListItem, "slaBreached" | "slaWarning" | "slaHoursRemaining" | "slaDueAt">; compact?: boolean }) {
  if (!c.slaDueAt) return null;
  if (c.slaBreached) return <Tag color="red" icon={<WarningOutlined />} style={{ marginInlineEnd: 0, borderRadius: 6 }}>{compact ? "SLA" : `SLA breached ${Math.abs(Math.round(c.slaHoursRemaining || 0))}h ago`}</Tag>;
  if (c.slaWarning) return <Tag color="orange" icon={<ClockCircleOutlined />} style={{ marginInlineEnd: 0, borderRadius: 6 }}>{compact ? `${Math.round(c.slaHoursRemaining || 0)}h` : `${Math.round(c.slaHoursRemaining || 0)}h left`}</Tag>;
  if (c.slaHoursRemaining === null) return null;
  return compact ? null : <Tag style={{ marginInlineEnd: 0, borderRadius: 6 }} icon={<ClockCircleOutlined />}>{Math.round(c.slaHoursRemaining)}h left</Tag>;
}
