// Client-safe constants for the service desk (cases) module.
export const CASE_STATUSES = ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED", "REOPENED", "REJECTED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export const CASE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];
export const CASE_SOURCES = ["STAFF", "PUBLIC", "PHONE", "WALK_IN", "EMAIL"] as const;
export type CaseSource = (typeof CASE_SOURCES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  NEW: "New", TRIAGED: "Triaged", ASSIGNED: "Assigned", IN_PROGRESS: "In progress", ON_HOLD: "On hold",
  RESOLVED: "Resolved", CLOSED: "Closed", REOPENED: "Reopened", REJECTED: "Rejected",
};
/** Fixed status colours (branding cannot override them). */
export const CASE_STATUS_COLORS: Record<CaseStatus, string> = {
  NEW: "#7A8B99", TRIAGED: "#5B5FC7", ASSIGNED: "#2F6FED", IN_PROGRESS: "#E2A33D", ON_HOLD: "#C97B36",
  RESOLVED: "#2E9E6D", CLOSED: "#4B5563", REOPENED: "#D65A5A", REJECTED: "#C6433B",
};
export const CASE_PRIORITY_COLORS: Record<CasePriority, string> = { LOW: "#2E9E6D", MEDIUM: "#E2A33D", HIGH: "#E0672B", CRITICAL: "#C6433B" };
export const CASE_PRIORITY_LABELS: Record<CasePriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical" };
export const CASE_SOURCE_LABELS: Record<CaseSource, string> = { STAFF: "Staff", PUBLIC: "Public portal", PHONE: "Phone", WALK_IN: "Walk-in", EMAIL: "Email" };

/** Statuses that count as closed for workload and SLA purposes. */
export const CASE_DONE: CaseStatus[] = ["RESOLVED", "CLOSED", "REJECTED"];

/**
 * State machine (the stricter one from the local-council architecture doc). Administrators may additionally move
 * a case between any two columns; the transition is always recorded in the timeline.
 */
export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  NEW: ["TRIAGED", "ASSIGNED", "REJECTED"],
  TRIAGED: ["ASSIGNED", "IN_PROGRESS", "ON_HOLD", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "ON_HOLD", "RESOLVED", "REJECTED"],
  IN_PROGRESS: ["RESOLVED", "ON_HOLD", "ASSIGNED", "REJECTED"],
  ON_HOLD: ["IN_PROGRESS", "ASSIGNED", "RESOLVED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["ASSIGNED", "IN_PROGRESS", "RESOLVED"],
  REJECTED: ["REOPENED"],
};

export interface CaseSettings {
  /** reference prefix, e.g. ZS → ZS-2026-0001 */
  prefix?: string;
  autoAssign?: boolean;
  requireTriage?: boolean;
  requireTransitionReason?: boolean;
  /** hours before the SLA due date at which a warning is raised */
  slaWarningHours?: number;
  publicPortal?: boolean;
  portalHeading?: string;
  portalSubtext?: string;
  contactEmail?: string;
  contactPhone?: string;
  announcement?: string;
  announcementActive?: boolean;
  defaultView?: "board" | "table";
  boardColumns?: CaseStatus[];
}

export const DEFAULT_CASE_SETTINGS: Required<Pick<CaseSettings, "prefix" | "autoAssign" | "requireTriage" | "requireTransitionReason" | "slaWarningHours" | "publicPortal" | "defaultView" | "boardColumns">> = {
  prefix: "ZS",
  autoAssign: true,
  requireTriage: false,
  requireTransitionReason: false,
  slaWarningHours: 24,
  publicPortal: true,
  defaultView: "board",
  boardColumns: [...CASE_STATUSES],
};

export function slaState(slaDueAt: string | Date | null | undefined, status: string, warningHours = 24) {
  if (!slaDueAt || CASE_DONE.includes(status as CaseStatus)) return { breached: false, warning: false, hoursRemaining: null as number | null };
  const diff = (new Date(slaDueAt).getTime() - Date.now()) / 3600_000;
  return { breached: diff <= 0, warning: diff > 0 && diff <= warningHours, hoursRemaining: Math.round(diff * 10) / 10 };
}
