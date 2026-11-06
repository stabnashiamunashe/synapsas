// Client-safe constants for the records management (registry) module: file plan and correspondence register.

export const DIRECTIONS = ["IN", "OUT"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const DOC_TYPES = ["LETTER", "EMAIL", "MEMO", "INVOICE", "NOTICE", "COURT", "TENDER", "REPORT", "APPLICATION", "OTHER"] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const DOC_TYPE_LABELS: Record<DocType, string> = {
  LETTER: "Letter", EMAIL: "Email", MEMO: "Memorandum", INVOICE: "Invoice / statement", NOTICE: "Notice / circular", COURT: "Court process / legal",
  TENDER: "Tender / quotation", REPORT: "Report", APPLICATION: "Application / form", OTHER: "Other",
};

export const METHODS = ["HAND", "POST", "REGISTERED_POST", "EMAIL", "COURIER", "FAX", "WHATSAPP"] as const;
export type Method = (typeof METHODS)[number];
export const METHOD_LABELS: Record<Method, string> = { HAND: "By hand", POST: "Post", REGISTERED_POST: "Registered post", EMAIL: "Email", COURIER: "Courier", FAX: "Fax", WHATSAPP: "WhatsApp" };

/** Incoming mail: received at registry → routed to a department / action officer → being actioned → replied → placed on file. */
export const IN_STATUSES = ["RECEIVED", "ROUTED", "IN_PROGRESS", "REPLIED", "FILED"] as const;
/** Outgoing mail: drafted / signed → dispatched → acknowledged by the recipient → placed on file. */
export const OUT_STATUSES = ["DRAFT", "DISPATCHED", "ACKNOWLEDGED", "FILED"] as const;
export type RecordStatus = (typeof IN_STATUSES)[number] | (typeof OUT_STATUSES)[number];
export const RECORD_STATUSES: RecordStatus[] = [...IN_STATUSES, ...OUT_STATUSES];

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  RECEIVED: "Received", ROUTED: "Routed", IN_PROGRESS: "Being actioned", REPLIED: "Replied", FILED: "Filed",
  DRAFT: "Awaiting dispatch", DISPATCHED: "Dispatched", ACKNOWLEDGED: "Acknowledged",
};
/** Fixed status tones (see StatusTag): grey = new/inactive, blue = in hand, amber = waiting, green = done. */
export const RECORD_STATUS_TONE: Record<RecordStatus, "grey" | "blue" | "amber" | "green" | "teal" | "purple"> = {
  RECEIVED: "grey", ROUTED: "blue", IN_PROGRESS: "amber", REPLIED: "green", FILED: "grey",
  DRAFT: "amber", DISPATCHED: "teal", ACKNOWLEDGED: "green",
};
/** Statuses where nobody owes an action any more. */
export const RECORD_DONE: RecordStatus[] = ["REPLIED", "FILED", "DISPATCHED", "ACKNOWLEDGED"];

export const FILE_SERIES = ["Administration", "Council & Committees", "Finance", "Human Resources", "Legal", "Engineering & Works", "Health & Environment", "Housing & Community", "Licensing", "Procurement", "Audit", "ICT"] as const;

export const EVENT_LABELS: Record<string, string> = {
  REGISTERED: "Registered", ROUTED: "Routed", REASSIGNED: "Reassigned", STARTED: "Action started", REPLIED: "Reply sent", DISPATCHED: "Dispatched", ACKNOWLEDGED: "Acknowledged by recipient",
  FILED: "Placed on file", REOPENED: "Reopened", NOTE: "Note", DOCUMENT: "Document attached", EDITED: "Details edited",
};

export interface RecordsSettings {
  /** registry number prefix, defaults to the licensing / cases prefix */
  prefix?: string;
  /** users who act as registry clerks (may register, route and file for the whole council) in addition to managers */
  clerkIds?: string[];
  /** default working days allowed for a reply to incoming mail */
  replyDays?: number;
}
