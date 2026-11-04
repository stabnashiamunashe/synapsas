// Client-safe constants for the licensing module (local authority licences and permits).

export const LICENCE_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "INSPECTION", "APPROVED", "ISSUED", "REJECTED", "EXPIRED", "SUSPENDED", "REVOKED", "CANCELLED"] as const;
export type LicenceStatus = (typeof LICENCE_STATUSES)[number];

export const LICENCE_STATUS_LABELS: Record<LicenceStatus, string> = {
  SUBMITTED: "Submitted", UNDER_REVIEW: "Under review", INSPECTION: "Inspection", APPROVED: "Approved, awaiting payment", ISSUED: "Issued",
  REJECTED: "Rejected", EXPIRED: "Expired", SUSPENDED: "Suspended", REVOKED: "Revoked", CANCELLED: "Cancelled",
};

/** Which StatusTag palette each status uses (see src/components/StatusTag.tsx). */
export const LICENCE_STATUS_TONE: Record<LicenceStatus, string> = {
  SUBMITTED: "grey", UNDER_REVIEW: "blue", INSPECTION: "purple", APPROVED: "teal", ISSUED: "green",
  REJECTED: "red", EXPIRED: "amber", SUSPENDED: "orange", REVOKED: "red", CANCELLED: "grey",
};

/** Statuses that still need an officer's action. */
export const LICENCE_OPEN: LicenceStatus[] = ["SUBMITTED", "UNDER_REVIEW", "INSPECTION", "APPROVED"];
/** Statuses that count as a live licence. */
export const LICENCE_LIVE: LicenceStatus[] = ["ISSUED"];

export const LICENCE_ACTIONS = ["review", "schedule_inspection", "record_inspection", "approve", "reject", "pay", "issue", "renew", "suspend", "reinstate", "revoke", "cancel", "note", "document"] as const;
export type LicenceAction = (typeof LICENCE_ACTIONS)[number];

export const LICENCE_ACTION_LABELS: Record<LicenceAction, string> = {
  review: "Start review", schedule_inspection: "Schedule inspection", record_inspection: "Record inspection result", approve: "Approve", reject: "Reject",
  pay: "Record payment", issue: "Issue licence", renew: "Renew", suspend: "Suspend", reinstate: "Reinstate", revoke: "Revoke", cancel: "Cancel application", note: "Add note", document: "Update documents",
};

/** Actions available from each status (administrators may also cancel at any open stage). */
export const LICENCE_TRANSITIONS: Record<LicenceStatus, LicenceAction[]> = {
  SUBMITTED: ["review", "schedule_inspection", "approve", "reject", "cancel", "note", "document"],
  UNDER_REVIEW: ["schedule_inspection", "approve", "reject", "cancel", "note", "document"],
  INSPECTION: ["record_inspection", "reject", "cancel", "note", "document"],
  APPROVED: ["pay", "issue", "reject", "cancel", "note", "document"],
  ISSUED: ["renew", "suspend", "revoke", "note"],
  EXPIRED: ["renew", "note"],
  SUSPENDED: ["reinstate", "revoke", "note"],
  REJECTED: ["note"],
  REVOKED: ["note"],
  CANCELLED: ["note"],
};

export const LICENCE_CATEGORIES = ["Trading", "Liquor", "Health & food", "Building & planning", "Transport", "Land & property", "Hawkers & markets", "Other"] as const;

export const LICENCE_EVENT_LABELS: Record<string, string> = {
  SUBMITTED: "Application received", REVIEW: "Review started", INSPECTION_SCHEDULED: "Inspection scheduled", INSPECTED: "Inspection recorded", APPROVED: "Approved",
  REJECTED: "Rejected", PAID: "Fee paid", ISSUED: "Licence issued", RENEWED: "Renewal application created", SUSPENDED: "Suspended", REINSTATED: "Reinstated", REVOKED: "Revoked",
  EXPIRED: "Expired", CANCELLED: "Cancelled", NOTE: "Note", DOCUMENT: "Documents updated", UPDATED: "Details updated",
};

export function daysUntil(d: string | Date | null | undefined) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
