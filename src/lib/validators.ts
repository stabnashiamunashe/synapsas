import { z } from "zod";
import { passwordProblems } from "./security";

export const roleSchema = z.enum(["OWNER", "ADMIN", "MANAGER", "MEMBER"]);
export const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
export const categorySchema = z.enum(["MEMO", "REQUISITION", "DOCUMENT", "LEAVE", "EXPENSE", "CUSTOM"]);

/** Strong password: policy enforced server-side regardless of client validation. */
export const passwordSchema = z
  .string()
  .max(128)
  .superRefine((pw, ctx) => {
    for (const p of passwordProblems(pw)) ctx.addIssue({ code: "custom", message: p });
  });

export const registerSchema = z.object({
  orgName: z.string().min(2).max(80),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  slug: z.string().optional(),
});

export const twoFactorVerifySchema = z.object({
  challenge: z.string().min(10),
  code: z.string().min(6).max(12),
});

export const twoFactorEnableSchema = z.object({ code: z.string().min(6).max(8) });
export const twoFactorDisableSchema = z.object({ password: z.string().min(1), code: z.string().min(6).max(12) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: z.string().email(), slug: z.string().optional() });
export const resetPasswordSchema = z.object({ token: z.string().min(10), password: passwordSchema });

export const conditionSchema = z
  .object({
    field: z.string(),
    op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains", "empty", "notEmpty"]),
    value: z.unknown().optional(),
  })
  .nullable()
  .optional();

export const columnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "currency", "select", "date", "checkbox", "computed"]),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  width: z.number().optional(),
  formula: z.string().optional(),
  sum: z.boolean().optional(),
});

export const fieldSchema = z.object({
  key: z.string().min(1).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Key must be an identifier"),
  label: z.string().min(1),
  type: z.enum([
    "text", "textarea", "richtext", "number", "currency", "date", "daterange", "select",
    "multiselect", "checkbox", "user", "department", "file", "table", "heading", "divider",
  ]),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.array(z.string()).optional(),
  width: z.enum(["full", "half", "third"]).optional(),
  defaultValue: z.unknown().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  columns: z.array(columnSchema).optional(),
  minRows: z.number().optional(),
  maxRows: z.number().optional(),
  totalColumn: z.string().optional(),
  visibleWhen: conditionSchema,
});

export const levelSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  approverType: z.enum(["USER", "ROLE", "DEPARTMENT_HEAD", "REQUESTER_MANAGER", "FIELD_USER", "FIELD_DEPARTMENT_HEAD", "DEPARTMENT"]),
  approverUserIds: z.array(z.string()).optional(),
  approverRole: roleSchema.optional(),
  restrictToRequesterDepartment: z.boolean().optional(),
  fieldKey: z.string().optional(),
  departmentId: z.string().optional().nullable(),
  minRole: roleSchema.optional(),
  mode: z.enum(["ANY", "ALL"]).default("ANY"),
  slaHours: z.number().min(0).optional().nullable(),
  condition: conditionSchema,
  allowDelegate: z.boolean().optional(),
  allowReturn: z.boolean().optional(),
  skipIfRequester: z.boolean().optional(),
  requireComment: z.boolean().optional(),
  escalateToUserId: z.string().optional().nullable(),
  fallbackUserId: z.string().optional().nullable(),
  returnTo: z.union([z.literal("REQUESTER"), z.number().int().min(1)]).optional().nullable(),
});

export const templateSettingsSchema = z.object({
  allowAttachments: z.boolean().optional(),
  requireAttachment: z.boolean().optional(),
  allowRequesterCancel: z.boolean().optional(),
  notifyRequesterOnEachLevel: z.boolean().optional(),
  titleTemplate: z.string().optional(),
  requesterRoles: z.array(roleSchema).optional(),
  defaultPriority: prioritySchema.optional(),
  dueInDays: z.number().optional().nullable(),
  autoApproveIfNoLevels: z.boolean().optional(),
  costField: z.string().max(80).optional().nullable(),
  requireProject: z.boolean().optional(),
});

export const templateSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  category: categorySchema.default("CUSTOM"),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  prefix: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/, "Uppercase letters/numbers"),
  fields: z.array(fieldSchema).default([]),
  levels: z.array(levelSchema).default([]),
  settings: templateSettingsSchema.default({}),
  isActive: z.boolean().optional(),
});

export const createRequestSchema = z.object({
  templateId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  priority: prioritySchema.optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  submit: z.boolean().optional(),
});

export const updateRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  projectId: z.string().optional().nullable(),
  priority: prioritySchema.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const actionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "RETURN", "DELEGATE"]),
  comment: z.string().max(2000).optional(),
  delegateToId: z.string().optional(),
});

export const commentSchema = z.object({ body: z.string().min(1).max(4000) });

export const prefsSchema = z.object({
  approvalsInApp: z.boolean().optional(),
  commentsInApp: z.boolean().optional(),
  statusInApp: z.boolean().optional(),
  emailDigest: z.enum(["none", "daily", "weekly"]).optional(),
});

export const userCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: passwordSchema.optional(),
  role: roleSchema.default("MEMBER"),
  jobTitle: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
});

export const userUpdateSchema = userCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
  avatarUrl: z.string().optional().nullable(),
  prefs: prefsSchema.optional(),
});

export const inviteSchema = z.object({
  email: z.string().email(),
  role: roleSchema.default("MEMBER"),
  departmentId: z.string().optional().nullable(),
});

export const acceptInviteSchema = z.object({
  name: z.string().min(2),
  password: passwordSchema,
});

export const departmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional().nullable(),
  headUserId: z.string().optional().nullable(),
  defaultAssigneeId: z.string().optional().nullable(),
});

export const brandingSchema = z.object({
  productName: z.string().max(60).optional(),
  logoUrl: z.string().max(2000).optional(),
  faviconUrl: z.string().max(2000).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sidebarTheme: z.enum(["light", "dark"]).optional(),
  loginTagline: z.string().max(200).optional(),
  loginBackgroundUrl: z.string().max(2000).optional(),
  supportEmail: z.string().email().optional().or(z.literal("")),
  hideVendorBranding: z.boolean().optional(),
  footerText: z.string().max(200).optional(),
  borderRadius: z.number().min(0).max(24).optional(),
});

export const orgSettingsSchema = z.object({
  cases: z.lazy(() => caseSettingsSchema).optional(),
  timezone: z.string().optional(),
  currency: z.string().max(5).optional(),
  dateFormat: z.string().optional(),
  workingHoursStart: z.number().optional(),
  workingHoursEnd: z.number().optional(),
  workingDays: z.array(z.number()).optional(),
  requireCommentOnReject: z.boolean().optional(),
  allowSelfApproval: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  // security
  require2faForAdmins: z.boolean().optional(),
  sessionHours: z.number().min(1).max(168).optional(),
  lockoutThreshold: z.number().min(3).max(20).optional(),
  annualLeaveDays: z.number().min(0).max(60).optional(),
});

export const orgUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  customDomain: z.string().max(120).optional().nullable(),
  branding: brandingSchema.optional(),
  settings: orgSettingsSchema.optional(),
});

export const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).default([]),
  isActive: z.boolean().optional(),
});

export const checkoutSchema = z.object({
  plan: z.enum(["STARTER", "BUSINESS", "ENTERPRISE"]),
  cycle: z.enum(["monthly", "yearly"]).default("monthly"),
  method: z.enum(["card", "mobile"]).optional(),
  phone: z.string().min(9).max(15).optional(),
});

export const onboardingSchema = z.object({
  orgName: z.string().min(2).max(80).optional(),
  currency: z.string().max(5).optional(),
  timezone: z.string().max(60).optional(),
  billingEmail: z.string().email().optional(),
  invites: z.array(z.object({ email: z.string().email(), role: roleSchema.default("MEMBER") })).max(20).default([]),
  presets: z.array(categorySchema).default([]),
});

export const projectSchema = z.object({
  code: z.string().min(2).max(24).regex(/^[A-Z0-9][A-Z0-9-]*$/, "Uppercase letters, numbers and dashes"),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["ACTIVE", "ON_HOLD", "CLOSED", "ARCHIVED"]).optional(),
  budgetAmount: z.number().min(0).optional().nullable(),
  currency: z.string().max(5).optional(),
  ownerUserId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
});

export const delegationSchema = z.object({
  toUserId: z.string().min(1),
  fromUserId: z.string().optional(),
  reason: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
});

// ---------- service desk (cases) ----------
export const casePrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const caseStatusSchema = z.enum(["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED", "REOPENED", "REJECTED"]);

export const caseCreateSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().min(5).max(20000),
  categoryId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  priority: casePrioritySchema.optional().nullable(),
  projectId: z.string().optional().nullable(),
  reporterName: z.string().min(2).max(255),
  reporterPhone: z.string().max(50).optional().nullable(),
  reporterEmail: z.string().email().optional().nullable().or(z.literal("")),
  source: z.enum(["STAFF", "PUBLIC", "PHONE", "WALK_IN", "EMAIL", "WHATSAPP"]).optional(),
  locationAddress: z.string().max(500).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  office: z.string().max(100).optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const caseUpdateSchema = z.object({
  version: z.number().int().min(1),
  title: z.string().min(3).max(255).optional(),
  description: z.string().min(5).max(20000).optional(),
  priority: casePrioritySchema.optional(),
  categoryId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  locationAddress: z.string().max(500).optional().nullable(),
  office: z.string().max(100).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  slaHours: z.number().int().min(1).max(24 * 90).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const caseStatusChangeSchema = z.object({ version: z.number().int().min(1), status: caseStatusSchema, reason: z.string().max(2000).optional().nullable() });
export const caseCommentSchema = z.object({ body: z.string().min(1).max(10000), isInternal: z.boolean().optional() });
export const caseCategorySchema = z.object({
  name: z.string().min(2).max(150),
  departmentId: z.string().min(1),
  description: z.string().max(2000).optional().nullable(),
  defaultPriority: casePrioritySchema.optional(),
  defaultSlaHours: z.number().int().min(1).max(24 * 90).optional(),
  icon: z.string().max(10).optional().nullable(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export const savedViewSchema = z.object({ name: z.string().min(1).max(100), filters: z.record(z.string(), z.unknown()), isDefault: z.boolean().optional() });
export const caseRatingSchema = z.object({ rating: z.number().int().min(1).max(5), feedback: z.string().max(2000).optional().nullable(), reporterContact: z.string().min(3).max(255) });
export const publicCaseSchema = caseCreateSchema.pick({ title: true, description: true, categoryId: true, reporterName: true, reporterPhone: true, reporterEmail: true, locationAddress: true, latitude: true, longitude: true, office: true }).extend({
  website: z.string().max(0).optional(), // honeypot
});
export const caseSettingsSchema = z.object({
  prefix: z.string().regex(/^[A-Z0-9]{1,6}$/).optional(),
  autoAssign: z.boolean().optional(),
  requireTriage: z.boolean().optional(),
  requireTransitionReason: z.boolean().optional(),
  slaWarningHours: z.number().int().min(1).max(168).optional(),
  publicPortal: z.boolean().optional(),
  portalHeading: z.string().max(255).optional(),
  portalSubtext: z.string().max(1000).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional(),
  announcement: z.string().max(1000).optional(),
  announcementActive: z.boolean().optional(),
  defaultView: z.enum(["board", "table"]).optional(),
  boardColumns: z.array(caseStatusSchema).min(2).optional(),
  whatsapp: z.object({ enabled: z.boolean().optional(), greeting: z.string().max(500).optional(), notifyAllReporters: z.boolean().optional(), helpText: z.string().max(1000).optional() }).optional(),
});
