// Shared domain types used by both the API and the UI.

export type Role = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER";
export const ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "MEMBER"];

export type Plan = "FREE" | "STARTER" | "BUSINESS" | "ENTERPRISE";

export type RequestStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"
  | "CANCELLED";

export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"
  | "SKIPPED"
  | "DELEGATED"
  | "ESCALATED";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type TemplateCategory =
  | "MEMO"
  | "REQUISITION"
  | "DOCUMENT"
  | "LEAVE"
  | "EXPENSE"
  | "CUSTOM";

export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "currency"
  | "date"
  | "daterange"
  | "select"
  | "multiselect"
  | "checkbox"
  | "user"
  | "department"
  | "file"
  | "table"
  | "heading"
  | "divider";

export type ColumnType =
  | "text"
  | "number"
  | "currency"
  | "select"
  | "date"
  | "checkbox"
  | "computed";

export interface TableColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  options?: string[];
  required?: boolean;
  width?: number;
  /** For computed columns: expression over other column keys, e.g. "quantity * unitPrice" */
  formula?: string;
  /** Show a sum of this column in the footer */
  sum?: boolean;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  width?: "full" | "half" | "third";
  defaultValue?: unknown;
  min?: number;
  max?: number;
  /** table fields */
  columns?: TableColumnDef[];
  minRows?: number;
  maxRows?: number;
  /** if set, the sum of this column is written to the form value `${key}Total` */
  totalColumn?: string;
  /** show only when another field matches */
  visibleWhen?: Condition;
}

export type ConditionOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains"
  | "empty"
  | "notEmpty";

export interface Condition {
  field: string; // form field key, `${tableKey}Total`, or "priority"
  op: ConditionOp;
  value?: unknown;
}

export type ApproverType =
  | "USER" // one or more specific users
  | "ROLE" // everyone with a role (optionally limited to requester's department)
  | "DEPARTMENT_HEAD" // head of the requester's department
  | "REQUESTER_MANAGER" // requester's line manager
  | "FIELD_USER" // user chosen in a form field of type "user"
  | "FIELD_DEPARTMENT_HEAD"; // head of department chosen in a "department" field

export interface LevelDef {
  id: string;
  order: number;
  name: string;
  description?: string;
  approverType: ApproverType;
  approverUserIds?: string[];
  approverRole?: Role;
  restrictToRequesterDepartment?: boolean;
  fieldKey?: string;
  /** ANY = first approver decides, ALL = every approver must approve */
  mode: "ANY" | "ALL";
  slaHours?: number;
  /** Only run this level when the condition holds (e.g. amount >= 5000) */
  condition?: Condition;
  allowDelegate?: boolean;
  allowReturn?: boolean;
  skipIfRequester?: boolean;
  requireComment?: boolean;
  escalateToUserId?: string;
  /** Fallback approver if no approver could be resolved (e.g. no manager set) */
  fallbackUserId?: string;
  /**
   * Loop-back target when an approver returns the request for changes:
   * "REQUESTER" (default) sends it back to the requester as RETURNED; a level order re-runs that earlier level.
   */
  returnTo?: "REQUESTER" | number;
}

export interface TemplateSettings {
  allowAttachments?: boolean;
  requireAttachment?: boolean;
  allowRequesterCancel?: boolean;
  notifyRequesterOnEachLevel?: boolean;
  titleTemplate?: string; // e.g. "Purchase requisition for {{department}}"
  requesterRoles?: Role[]; // who may raise this type
  defaultPriority?: Priority;
  dueInDays?: number;
  autoApproveIfNoLevels?: boolean;
  /** Data key whose value is the request's cost (e.g. "itemsTotal" or a currency field). "none" disables; unset = auto-detect. */
  costField?: string;
  /** Requester must pick a project before submitting. */
  requireProject?: boolean;
}

export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "CLOSED" | "ARCHIVED";

export interface BrandingSettings {
  productName?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  sidebarTheme?: "light" | "dark";
  loginTagline?: string;
  loginBackgroundUrl?: string;
  supportEmail?: string;
  hideVendorBranding?: boolean;
  footerText?: string;
  borderRadius?: number;
}

export interface OrgSettings {
  timezone?: string;
  currency?: string;
  dateFormat?: string;
  workingHoursStart?: number;
  workingHoursEnd?: number;
  workingDays?: number[];
  requireCommentOnReject?: boolean;
  allowSelfApproval?: boolean;
  emailNotifications?: boolean;
  /** security */
  require2faForAdmins?: boolean;
  sessionHours?: number;
  lockoutThreshold?: number;
}

export interface NotificationPrefs {
  approvalsInApp?: boolean;
  commentsInApp?: boolean;
  statusInApp?: boolean;
  /** immediate email per event (default on); security alerts are always sent */
  approvalsEmail?: boolean;
  commentsEmail?: boolean;
  statusEmail?: boolean;
  /** when set, per-event emails are replaced by a periodic summary */
  emailDigest?: "none" | "daily" | "weekly";
}

export interface SessionUser {
  id: string;
  orgId: string;
  role: Role;
  email: string;
  name: string;
}

export interface TemplateSnapshot {
  name: string;
  category: TemplateCategory;
  fields: FieldDef[];
  levels: LevelDef[];
  settings: TemplateSettings;
  version: number;
}

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: "default",
  PENDING: "processing",
  APPROVED: "success",
  REJECTED: "error",
  RETURNED: "warning",
  CANCELLED: "default",
  SKIPPED: "default",
  DELEGATED: "purple",
  ESCALATED: "volcano",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: "default",
  NORMAL: "blue",
  HIGH: "orange",
  URGENT: "red",
};

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  MEMO: "Memo",
  REQUISITION: "Requisition",
  DOCUMENT: "Document approval",
  LEAVE: "Leave",
  EXPENSE: "Expense claim",
  CUSTOM: "Custom",
};
