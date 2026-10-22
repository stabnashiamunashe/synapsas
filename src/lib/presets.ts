// Server-safe workflow presets used by onboarding (no UI imports).
import type { FieldDef, LevelDef, TemplateCategory, TemplateSettings } from "./types";

export interface Preset {
  name: string; prefix: string; icon?: string; color?: string; description: string;
  fields: FieldDef[]; levels: LevelDef[]; settings: TemplateSettings;
}

export const PRESETS: Partial<Record<TemplateCategory, Preset>> = {
  MEMO: {
    name: "Internal memo", prefix: "MEMO", icon: "📝", color: "#722ed1",
    description: "Circulate an internal memo. Reviewed by the line manager, then the department head when marked confidential.",
    fields: [
      { key: "to", label: "To", type: "text", required: true, width: "half" },
      { key: "subject", label: "Subject", type: "text", required: true, width: "half" },
      { key: "body", label: "Memo body", type: "richtext", required: true, width: "full" },
      { key: "effectiveDate", label: "Effective date", type: "date", width: "half" },
      { key: "confidential", label: "Confidential", type: "checkbox", width: "half" },
    ],
    levels: [
      { id: "m1", order: 1, name: "Line manager review", approverType: "REQUESTER_MANAGER", mode: "ANY", slaHours: 24, allowDelegate: true, allowReturn: true, skipIfRequester: true },
      { id: "m2", order: 2, name: "Department head sign-off", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true, skipIfRequester: true, condition: { field: "confidential", op: "eq", value: "true" } },
    ],
    settings: { titleTemplate: "Memo: {{subject}}", allowAttachments: true, allowRequesterCancel: true },
  },
  REQUISITION: {
    name: "Purchase requisition", prefix: "PR", icon: "🛒", color: "#13c2c2",
    description: "Request goods or services with line items. Manager, then department head; the CFO-style level runs only above a threshold.",
    fields: [
      { key: "purpose", label: "Purpose", type: "textarea", required: true, width: "full" },
      { key: "neededBy", label: "Needed by", type: "date", width: "half" },
      { key: "costCentre", label: "Cost centre", type: "select", options: ["Operations", "Sales", "IT", "HR", "Finance"], required: true, width: "half" },
      { key: "items", label: "Items", type: "table", required: true, minRows: 1, totalColumn: "total", width: "full", columns: [
        { key: "description", label: "Description", type: "text", required: true },
        { key: "quantity", label: "Qty", type: "number", required: true, width: 90 },
        { key: "unitPrice", label: "Unit price", type: "currency", required: true, width: 130 },
        { key: "total", label: "Total", type: "computed", formula: "quantity * unitPrice", sum: true, width: 130 },
      ] },
      { key: "supplier", label: "Preferred supplier", type: "text", width: "half" },
    ],
    levels: [
      { id: "p1", order: 1, name: "Line manager approval", approverType: "REQUESTER_MANAGER", mode: "ANY", slaHours: 24, allowDelegate: true, allowReturn: true, skipIfRequester: true },
      { id: "p2", order: 2, name: "Department head approval", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true, skipIfRequester: true },
      { id: "p3", order: 3, name: "Executive approval (≥ 5,000)", approverType: "ROLE", approverRole: "ADMIN", mode: "ANY", slaHours: 72, allowDelegate: true, allowReturn: true, requireComment: true, condition: { field: "itemsTotal", op: "gte", value: 5000 } },
    ],
    settings: { titleTemplate: "PR: {{purpose}}", allowAttachments: true, dueInDays: 7, allowRequesterCancel: true, notifyRequesterOnEachLevel: true },
  },
  DOCUMENT: {
    name: "Document approval", prefix: "DOC", icon: "📄", color: "#fa8c16",
    description: "Approve policies, contracts and reports. A reviewer chosen on the form goes first, then the department head, then an admin for policies and contracts.",
    fields: [
      { key: "documentTitle", label: "Document title", type: "text", required: true, width: "half" },
      { key: "documentType", label: "Document type", type: "select", options: ["Policy", "Contract", "Report", "Procedure", "Other"], required: true, width: "half" },
      { key: "summary", label: "Summary of changes", type: "textarea", required: true, width: "full" },
      { key: "reviewer", label: "Reviewer", type: "user", required: true, width: "half" },
      { key: "attachment", label: "Document file", type: "file", width: "half", helpText: "Attach the document before submitting." },
    ],
    levels: [
      { id: "d1", order: 1, name: "Technical review", approverType: "FIELD_USER", fieldKey: "reviewer", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true },
      { id: "d2", order: 2, name: "Department head", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 48, allowReturn: true, skipIfRequester: true },
      { id: "d3", order: 3, name: "Executive sign-off", approverType: "ROLE", approverRole: "ADMIN", mode: "ANY", slaHours: 96, allowReturn: true, condition: { field: "documentType", op: "in", value: "Policy,Contract" } },
    ],
    settings: { titleTemplate: "{{documentType}}: {{documentTitle}}", allowAttachments: true },
  },
  LEAVE: {
    name: "Leave request", prefix: "LV", icon: "🌴", color: "#52c41a",
    description: "Annual, sick or unpaid leave. Line manager approves; HR is notified through the department head level.",
    fields: [
      { key: "leaveType", label: "Leave type", type: "select", options: ["Annual", "Sick", "Unpaid", "Compassionate", "Study"], required: true, width: "half" },
      { key: "dates", label: "Dates", type: "daterange", required: true, width: "half" },
      { key: "reason", label: "Reason / handover notes", type: "textarea", width: "full" },
    ],
    levels: [
      { id: "l1", order: 1, name: "Line manager approval", approverType: "REQUESTER_MANAGER", mode: "ANY", slaHours: 24, allowDelegate: true, allowReturn: true, skipIfRequester: true },
    ],
    settings: { titleTemplate: "{{leaveType}} leave", allowAttachments: true, allowRequesterCancel: true },
  },
  EXPENSE: {
    name: "Expense claim", prefix: "EXP", icon: "🧾", color: "#eb2f96",
    description: "Reimbursement claims with itemised expenses and receipts.",
    fields: [
      { key: "purpose", label: "Purpose", type: "text", required: true, width: "full" },
      { key: "lines", label: "Expenses", type: "table", required: true, minRows: 1, totalColumn: "amount", width: "full", columns: [
        { key: "date", label: "Date", type: "date", required: true, width: 130 },
        { key: "category", label: "Category", type: "select", options: ["Travel", "Meals", "Accommodation", "Supplies", "Other"], required: true, width: 140 },
        { key: "description", label: "Description", type: "text", required: true },
        { key: "amount", label: "Amount", type: "currency", required: true, sum: true, width: 130 },
      ] },
    ],
    levels: [
      { id: "e1", order: 1, name: "Line manager approval", approverType: "REQUESTER_MANAGER", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true, skipIfRequester: true },
      { id: "e2", order: 2, name: "Finance check", approverType: "ROLE", approverRole: "ADMIN", mode: "ANY", slaHours: 72, allowReturn: true, returnTo: 1 },
    ],
    settings: { titleTemplate: "Expense: {{purpose}}", allowAttachments: true, requireAttachment: true },
  },
};
