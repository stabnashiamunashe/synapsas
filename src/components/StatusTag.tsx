"use client";

const STATUS_PILL: Record<string, { cls: string; label: string }> = {
  DRAFT: { cls: "pill-grey", label: "Draft" },
  PENDING: { cls: "pill-orange", label: "Pending review" },
  APPROVED: { cls: "pill-green", label: "Approved" },
  REJECTED: { cls: "pill-red", label: "Rejected" },
  RETURNED: { cls: "pill-amber", label: "Returned" },
  CANCELLED: { cls: "pill-grey", label: "Cancelled" },
  SKIPPED: { cls: "pill-grey", label: "Skipped" },
  DELEGATED: { cls: "pill-purple", label: "Delegated" },
  ESCALATED: { cls: "pill-red", label: "Escalated" },
  ACTIVE: { cls: "pill-green", label: "Active" },
  TRIALING: { cls: "pill-blue", label: "Trial" },
  PAST_DUE: { cls: "pill-red", label: "Past due" },
  EXPIRED: { cls: "pill-amber", label: "Expired" },
  PAID: { cls: "pill-green", label: "Paid" },
  FAILED: { cls: "pill-red", label: "Failed" },
  VOID: { cls: "pill-grey", label: "Void" },
  ON_HOLD: { cls: "pill-amber", label: "On hold" },
  CLOSED: { cls: "pill-blue", label: "Closed" },
  ARCHIVED: { cls: "pill-grey", label: "Archived" },
};

/** Soft tinted pill with a status dot, matching the dashboard design language. */
export function StatusTag({ status }: { status: string }) {
  const s = STATUS_PILL[status] || { cls: "pill-grey", label: status.replace(/_/g, " ").toLowerCase() };
  return <span className={`pill ${s.cls}`}>{s.label}</span>;
}

const PRIORITY_PILL: Record<string, string> = { LOW: "pill-grey", NORMAL: "pill-blue", HIGH: "pill-orange", URGENT: "pill-red" };

export function PriorityTag({ priority }: { priority: string }) {
  return <span className={`pill pill-plain ${PRIORITY_PILL[priority] || "pill-grey"}`}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</span>;
}
