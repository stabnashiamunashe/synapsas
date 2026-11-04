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

/** What the applicant is asking for (the "type of application" box on the Shop Licence Act form). */
export const APPLICATION_KINDS = ["NEW", "RENEWAL", "EXTENSION", "REMOVAL", "ALTERATION", "CHANGE_OF_OWNERSHIP"] as const;
export type ApplicationKind = (typeof APPLICATION_KINDS)[number];
export const APPLICATION_KIND_LABELS: Record<ApplicationKind, string> = {
  NEW: "New licence", RENEWAL: "Renewal", EXTENSION: "Extend a trade or business from licensed premises", REMOVAL: "Remove a trade or business from licensed premises",
  ALTERATION: "Removal or alteration of a condition", CHANGE_OF_OWNERSHIP: "Change of ownership",
};

export const PAYMENT_METHODS = ["CASH", "ECOCASH", "BANK_TRANSFER", "POS", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { CASH: "Cash at the cashier", ECOCASH: "EcoCash / mobile money", BANK_TRANSFER: "Bank transfer / RTGS", POS: "Card (POS)", OTHER: "Other" };
export const PAYMENT_STATUS_LABELS: Record<string, string> = { PENDING: "Awaiting confirmation", CONFIRMED: "Confirmed", REJECTED: "Not accepted" };

export const LICENCE_ACTIONS = ["review", "schedule_inspection", "record_inspection", "approve", "reject", "pay", "confirm_payment", "reject_payment", "issue", "renew", "suspend", "reinstate", "revoke", "cancel", "note", "document", "office"] as const;
export type LicenceAction = (typeof LICENCE_ACTIONS)[number];

export const LICENCE_ACTION_LABELS: Record<LicenceAction, string> = {
  review: "Start review", schedule_inspection: "Schedule inspection", record_inspection: "Record inspection result", approve: "Approve", reject: "Reject",
  pay: "Record payment", confirm_payment: "Confirm payment", reject_payment: "Reject payment", issue: "Issue licence", renew: "Renew", suspend: "Suspend", reinstate: "Reinstate", revoke: "Revoke",
  cancel: "Cancel application", note: "Add note", document: "Update documents", office: "Office use",
};

/** Actions available from each status (administrators may also cancel at any open stage). */
export const LICENCE_TRANSITIONS: Record<LicenceStatus, LicenceAction[]> = {
  SUBMITTED: ["review", "schedule_inspection", "approve", "reject", "cancel", "note", "document", "office"],
  UNDER_REVIEW: ["schedule_inspection", "approve", "reject", "cancel", "note", "document", "office"],
  INSPECTION: ["record_inspection", "reject", "cancel", "note", "document", "office"],
  APPROVED: ["pay", "confirm_payment", "reject_payment", "issue", "reject", "cancel", "note", "document", "office"],
  ISSUED: ["renew", "suspend", "revoke", "note", "office"],
  EXPIRED: ["renew", "note", "office"],
  SUSPENDED: ["reinstate", "revoke", "note", "office"],
  REJECTED: ["note", "office"],
  REVOKED: ["note", "office"],
  CANCELLED: ["note", "office"],
};

export const LICENCE_CATEGORIES = ["Trading", "Liquor", "Health & food", "Building & planning", "Transport", "Land & property", "Hawkers & markets", "Other"] as const;

export const LICENCE_EVENT_LABELS: Record<string, string> = {
  SUBMITTED: "Application received", REVIEW: "Review started", INSPECTION_SCHEDULED: "Inspection scheduled", INSPECTED: "Inspection recorded", APPROVED: "Approved",
  REJECTED: "Rejected", PAYMENT_SUBMITTED: "Payment details submitted", PAID: "Payment recorded", PAYMENT_CONFIRMED: "Payment confirmed", PAYMENT_REJECTED: "Payment not accepted", ISSUED: "Licence issued",
  RENEWED: "Renewal application created", SUSPENDED: "Suspended", REINSTATED: "Reinstated", REVOKED: "Revoked",
  EXPIRED: "Expired", CANCELLED: "Cancelled", NOTE: "Note", DOCUMENT: "Documents updated", UPDATED: "Details updated", OFFICE: "Office-use section updated",
};

export function daysUntil(d: string | Date | null | undefined) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
