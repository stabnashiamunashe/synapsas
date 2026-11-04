"use client";

import { Tooltip } from "antd";
import { LICENCE_STATUS_LABELS, LICENCE_STATUS_TONE } from "@/lib/licenceTypes";

export type Tone = "green" | "orange" | "red" | "grey" | "blue" | "purple" | "amber" | "teal" | "cyan" | "magenta";

/**
 * Fixed status colours used everywhere (tables, drawers, dashboards, public pages). Branding cannot override them so
 * a colour always means the same thing: green = done/valid, blue = in hand, amber = waiting, orange = on hold/suspended,
 * red = failed/overdue/revoked, purple = inspection/delegation, teal = approved pending a formality, grey = inactive.
 */
export const STATUS_PILL: Record<string, { tone: Tone; label: string }> = {
  // requests and approval steps
  DRAFT: { tone: "grey", label: "Draft" }, PENDING: { tone: "amber", label: "Pending review" }, APPROVED: { tone: "green", label: "Approved" }, REJECTED: { tone: "red", label: "Rejected" },
  RETURNED: { tone: "orange", label: "Returned" }, CANCELLED: { tone: "grey", label: "Cancelled" }, SKIPPED: { tone: "grey", label: "Skipped" }, DELEGATED: { tone: "purple", label: "Delegated" }, ESCALATED: { tone: "red", label: "Escalated" },
  // service desk cases
  NEW: { tone: "grey", label: "New" }, TRIAGED: { tone: "purple", label: "Triaged" }, ASSIGNED: { tone: "blue", label: "Assigned" }, IN_PROGRESS: { tone: "amber", label: "In progress" }, ON_HOLD: { tone: "orange", label: "On hold" },
  RESOLVED: { tone: "green", label: "Resolved" }, CLOSED: { tone: "grey", label: "Closed" }, REOPENED: { tone: "magenta", label: "Reopened" },
  // advances ledger
  OPEN: { tone: "amber", label: "Open" }, PARTIALLY_CLEARED: { tone: "blue", label: "Partly cleared" }, CLEARED: { tone: "green", label: "Cleared" }, RECOVERED: { tone: "purple", label: "Recovered from salary" }, WRITTEN_OFF: { tone: "grey", label: "Written off" }, OVERDUE: { tone: "red", label: "Overdue" },
  // asset register
  IN_STORE: { tone: "grey", label: "In store" }, ISSUED_ASSET: { tone: "blue", label: "Issued" }, IN_REPAIR: { tone: "amber", label: "In repair" }, LOST: { tone: "red", label: "Lost" }, DISPOSED: { tone: "grey", label: "Disposed" },
  // fleet
  AVAILABLE: { tone: "green", label: "Available" }, IN_USE: { tone: "blue", label: "On a trip" }, MAINTENANCE: { tone: "amber", label: "Maintenance" }, RETIRED: { tone: "grey", label: "Retired" },
  PLANNED: { tone: "amber", label: "Needs vehicle" }, ONGOING: { tone: "purple", label: "On the road" }, COMPLETED: { tone: "green", label: "Completed" },
  // notices, projects, accounts, misc
  PUBLISHED: { tone: "green", label: "Published" }, ACTIVE: { tone: "green", label: "Active" }, INACTIVE: { tone: "grey", label: "Inactive" }, ARCHIVED: { tone: "grey", label: "Archived" }, PAID: { tone: "green", label: "Paid" }, UNPAID: { tone: "amber", label: "Unpaid" },
  FAILED: { tone: "red", label: "Failed" }, VOID: { tone: "grey", label: "Void" }, VALID: { tone: "green", label: "Valid" }, EXPIRED: { tone: "amber", label: "Expired" }, SUSPENDED: { tone: "orange", label: "Suspended" }, REVOKED: { tone: "red", label: "Revoked" },
  TRIALING: { tone: "blue", label: "Trial" }, PAST_DUE: { tone: "red", label: "Past due" },
  // inspections
  PASS: { tone: "green", label: "Passed" }, FAIL: { tone: "red", label: "Failed" }, CONDITIONAL: { tone: "amber", label: "Passed with conditions" },
};
for (const s of Object.keys(LICENCE_STATUS_TONE) as (keyof typeof LICENCE_STATUS_TONE)[]) {
  if (!STATUS_PILL[s] || ["ISSUED", "UNDER_REVIEW", "INSPECTION", "SUBMITTED"].includes(s)) STATUS_PILL[s] = { tone: LICENCE_STATUS_TONE[s] as Tone, label: LICENCE_STATUS_LABELS[s] };
}

/** Tinted pill with a status dot. `labels` lets a module override wording. */
export function StatusTag({ status, labels, title }: { status: string; labels?: Record<string, string>; title?: string }) {
  const s = STATUS_PILL[status] || { tone: "grey" as Tone, label: status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) };
  const el = <span className={`pill pill-${s.tone}`}>{labels?.[status] || s.label}</span>;
  return title ? <Tooltip title={title}>{el}</Tooltip> : el;
}

/** Priority scale shared by requests (LOW/NORMAL/HIGH/URGENT) and cases/licences (LOW/MEDIUM/HIGH/CRITICAL). */
export const PRIORITY: Record<string, { tone: Tone; color: string; label: string; rank: number }> = {
  LOW: { tone: "green", color: "#24a148", label: "Low", rank: 0 },
  NORMAL: { tone: "blue", color: "#0f62fe", label: "Normal", rank: 1 },
  MEDIUM: { tone: "blue", color: "#0f62fe", label: "Medium", rank: 1 },
  HIGH: { tone: "orange", color: "#ff832b", label: "High", rank: 2 },
  URGENT: { tone: "red", color: "#da1e28", label: "Urgent", rank: 3 },
  CRITICAL: { tone: "red", color: "#da1e28", label: "Critical", rank: 3 },
};

export function PriorityTag({ priority, compact }: { priority: string; compact?: boolean }) {
  const p = PRIORITY[priority] || { tone: "grey" as Tone, color: "#8d8d8d", label: priority, rank: 0 };
  if (compact) return <Tooltip title={`${p.label} priority`}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 999, background: p.color, verticalAlign: "middle" }} /></Tooltip>;
  return <span className={`pill pill-${p.tone}`} title={`${p.label} priority`}>{p.label}</span>;
}
