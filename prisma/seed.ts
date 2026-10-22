/* Demo data: one white-labelled tenant with departments, people, three workflows and a few requests. */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const j = (v: unknown) => JSON.stringify(v);

async function main() {
  const existing = await prisma.organization.findUnique({ where: { slug: "acme" } });
  if (existing) {
    console.log("Demo org already exists, skipping seed.");
    return;
  }
  const pw = await bcrypt.hash("Password123!", 10);

  const org = await prisma.organization.create({
    data: {
      name: "Acme Limited",
      slug: "acme",
      plan: "BUSINESS",
      planStatus: "ACTIVE",
      planRenewsAt: new Date(Date.now() + 30 * 86400000),
      billingProvider: "manual",
      billingEmail: "owner@acme.test",
      onboardingCompletedAt: new Date(),
      branding: j({ productName: "Acme Approvals", primaryColor: "#1f3a5f", sidebarTheme: "dark", loginTagline: "Approvals, simplified.", footerText: "© Acme Limited", hideVendorBranding: false, borderRadius: 2 }),
      settings: j({ currency: "USD", timezone: "Africa/Harare", requireCommentOnReject: true, allowSelfApproval: false, emailNotifications: true }),
    },
  });

  const mk = (email: string, name: string, role: string, jobTitle: string) =>
    prisma.user.create({ data: { orgId: org.id, email, name, role, jobTitle, passwordHash: pw } });

  const owner = await mk("owner@acme.test", "Olivia Owner", "OWNER", "Chief Executive");
  const cfo = await mk("cfo@acme.test", "Frank Finance", "ADMIN", "Chief Financial Officer");
  const opsHead = await mk("ops.head@acme.test", "Hannah Head", "MANAGER", "Head of Operations");
  const manager = await mk("manager@acme.test", "Mike Manager", "MANAGER", "Operations Manager");
  const procurement = await mk("procurement@acme.test", "Priya Procurement", "MANAGER", "Procurement Lead");
  const legal = await mk("legal@acme.test", "Lena Legal", "MANAGER", "Legal Counsel");
  const member = await mk("member@acme.test", "Sam Staff", "MEMBER", "Operations Officer");
  const member2 = await mk("jane@acme.test", "Jane Junior", "MEMBER", "Sales Executive");

  const ops = await prisma.department.create({ data: { orgId: org.id, name: "Operations", code: "OPS", headUserId: opsHead.id } });
  const fin = await prisma.department.create({ data: { orgId: org.id, name: "Finance", code: "FIN", headUserId: cfo.id } });
  const sales = await prisma.department.create({ data: { orgId: org.id, name: "Sales", code: "SAL", headUserId: manager.id } });
  await prisma.department.create({ data: { orgId: org.id, name: "Legal", code: "LEG", headUserId: legal.id } });

  await prisma.user.update({ where: { id: member.id }, data: { departmentId: ops.id, managerId: manager.id } });
  await prisma.user.update({ where: { id: manager.id }, data: { departmentId: ops.id, managerId: opsHead.id } });
  await prisma.user.update({ where: { id: opsHead.id }, data: { departmentId: ops.id, managerId: owner.id } });
  await prisma.user.update({ where: { id: member2.id }, data: { departmentId: sales.id, managerId: manager.id } });
  await prisma.user.update({ where: { id: cfo.id }, data: { departmentId: fin.id, managerId: owner.id } });
  await prisma.user.update({ where: { id: procurement.id }, data: { departmentId: ops.id, managerId: opsHead.id } });

  const memo = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "Internal memo", category: "MEMO", prefix: "MEMO", icon: "📝", color: "#722ed1", createdById: owner.id,
      description: "Circulate an internal memo. Approved by your line manager, then the department head if marked confidential.",
      fields: j([
        { key: "to", label: "To", type: "text", required: true, width: "half" },
        { key: "subject", label: "Subject", type: "text", required: true, width: "half" },
        { key: "body", label: "Memo body", type: "richtext", required: true, width: "full" },
        { key: "effectiveDate", label: "Effective date", type: "date", width: "half" },
        { key: "confidential", label: "Confidential", type: "checkbox", width: "half" },
      ]),
      levels: j([
        { id: "l1", order: 1, name: "Line manager review", approverType: "REQUESTER_MANAGER", mode: "ANY", slaHours: 24, allowDelegate: true, allowReturn: true, skipIfRequester: true, fallbackUserId: opsHead.id },
        { id: "l2", order: 2, name: "Department head sign-off", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true, skipIfRequester: true, condition: { field: "confidential", op: "eq", value: "true" }, fallbackUserId: owner.id },
      ]),
      settings: j({ titleTemplate: "Memo: {{subject}}", allowAttachments: true, allowRequesterCancel: true }),
    },
  });

  const pr = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "Purchase requisition", category: "REQUISITION", prefix: "PR", icon: "🛒", color: "#13c2c2", createdById: owner.id,
      description: "Request goods or services with line items. Routed to your manager, procurement, and the CFO when the total is $5,000 or more.",
      fields: j([
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
        { key: "justification", label: "Justification for sole supplier", type: "textarea", width: "full", visibleWhen: { field: "supplier", op: "notEmpty" } },
      ]),
      levels: j([
        { id: "l1", order: 1, name: "Line manager approval", approverType: "REQUESTER_MANAGER", mode: "ANY", slaHours: 24, allowDelegate: true, allowReturn: true, skipIfRequester: true, fallbackUserId: opsHead.id, escalateToUserId: opsHead.id },
        { id: "l2", order: 2, name: "Procurement review", approverType: "USER", approverUserIds: [procurement.id], mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true, description: "Check supplier, pricing and budget line." },
        { id: "l3", order: 3, name: "CFO approval (≥ $5,000)", approverType: "USER", approverUserIds: [cfo.id], mode: "ANY", slaHours: 72, allowDelegate: true, allowReturn: true, requireComment: true, condition: { field: "itemsTotal", op: "gte", value: 5000 } },
      ]),
      settings: j({ titleTemplate: "PR: {{purpose}}", allowAttachments: true, dueInDays: 7, allowRequesterCancel: true, notifyRequesterOnEachLevel: true }),
    },
  });

  const doc = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "Document approval", category: "DOCUMENT", prefix: "DOC", icon: "📄", color: "#fa8c16", createdById: owner.id,
      description: "Approve policies, contracts and reports. A reviewer chosen on the form reviews first; legal and the CEO sign off. All reviewers must approve.",
      fields: j([
        { key: "documentTitle", label: "Document title", type: "text", required: true, width: "half" },
        { key: "documentType", label: "Document type", type: "select", options: ["Policy", "Contract", "Report", "Procedure", "Other"], required: true, width: "half" },
        { key: "summary", label: "Summary of changes", type: "textarea", required: true, width: "full" },
        { key: "reviewer", label: "Technical reviewer", type: "user", required: true, width: "half" },
        { key: "owningDepartment", label: "Owning department", type: "department", required: true, width: "half" },
        { key: "attachment", label: "Document file", type: "file", width: "full", helpText: "Attach the document before submitting." },
      ]),
      levels: j([
        { id: "l1", order: 1, name: "Technical review", approverType: "FIELD_USER", fieldKey: "reviewer", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true },
        { id: "l2", order: 2, name: "Owning department head", approverType: "FIELD_DEPARTMENT_HEAD", fieldKey: "owningDepartment", mode: "ANY", slaHours: 48, allowReturn: true, skipIfRequester: true },
        { id: "l3", order: 3, name: "Legal & executive sign-off", approverType: "USER", approverUserIds: [legal.id, owner.id], mode: "ALL", slaHours: 96, allowDelegate: false, allowReturn: true, condition: { field: "documentType", op: "in", value: "Policy,Contract" } },
      ]),
      settings: j({ titleTemplate: "{{documentType}}: {{documentTitle}}", allowAttachments: true, requireAttachment: false, allowRequesterCancel: false }),
    },
  });

  // Requests. We insert directly so the demo has history; the snapshot mirrors the template.
  const snap = async (t: { id: string }) => {
    const x = await prisma.workflowTemplate.findUnique({ where: { id: t.id } });
    return j({ name: x!.name, category: x!.category, fields: JSON.parse(x!.fields), levels: JSON.parse(x!.levels), settings: JSON.parse(x!.settings), version: 1 });
  };
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);

  // 1. Approved memo (non-confidential: only level 1 ran)
  const r1 = await prisma.request.create({
    data: {
      orgId: org.id, templateId: memo.id, referenceNo: "MEMO-2026-0001", title: "Memo: Office closure on public holiday", requesterId: member.id, status: "APPROVED", priority: "NORMAL",
      currentLevel: 1, activeLevels: j([1]), templateSnapshot: await snap(memo), submittedAt: hoursAgo(70), completedAt: hoursAgo(60), createdAt: hoursAgo(71),
      data: j({ to: "All staff", subject: "Office closure on public holiday", body: "Please note the office will be closed on Monday.", effectiveDate: "2026-09-14", confidential: false, priority: "NORMAL" }),
    },
  });
  await prisma.requestApproval.create({ data: { requestId: r1.id, levelOrder: 1, levelName: "Line manager review", approverId: manager.id, status: "APPROVED", comment: "Fine by me.", actedAt: hoursAgo(60), createdAt: hoursAgo(70) } });
  await prisma.comment.create({ data: { requestId: r1.id, userId: manager.id, isSystem: true, body: 'Mike Manager approved at level "Line manager review". Comment: Fine by me.', createdAt: hoursAgo(60) } });

  // 2. Pending requisition at level 2 (procurement), total >= 5000 so CFO will follow
  const items = [
    { description: "Dell Latitude laptops", quantity: 4, unitPrice: 1450, total: 5800 },
    { description: "Docking stations", quantity: 4, unitPrice: 180, total: 720 },
  ];
  const r2 = await prisma.request.create({
    data: {
      orgId: org.id, templateId: pr.id, referenceNo: "PR-2026-0001", title: "PR: Laptops for new operations hires", requesterId: member.id, status: "PENDING", priority: "HIGH",
      currentLevel: 2, activeLevels: j([1, 2, 3]), templateSnapshot: await snap(pr), submittedAt: hoursAgo(30), createdAt: hoursAgo(31), dueAt: new Date(Date.now() + 5 * 86400000),
      data: j({ purpose: "Laptops for new operations hires", neededBy: "2026-09-30", costCentre: "Operations", items, itemsTotal: 6520, supplier: "TechSupply Ltd", justification: "Existing framework agreement.", priority: "HIGH" }),
    },
  });
  await prisma.requestApproval.create({ data: { requestId: r2.id, levelOrder: 1, levelName: "Line manager approval", approverId: manager.id, status: "APPROVED", comment: "Budgeted in Q3.", actedAt: hoursAgo(26), createdAt: hoursAgo(30) } });
  await prisma.requestApproval.create({ data: { requestId: r2.id, levelOrder: 2, levelName: "Procurement review", approverId: procurement.id, status: "PENDING", dueAt: hoursAgo(26 - 48), createdAt: hoursAgo(26) } });
  await prisma.comment.create({ data: { requestId: r2.id, userId: manager.id, isSystem: true, body: 'Mike Manager approved at level "Line manager approval". Comment: Budgeted in Q3.', createdAt: hoursAgo(26) } });
  await prisma.notification.create({ data: { orgId: org.id, userId: procurement.id, title: "Approval needed: PR-2026-0001", body: "PR: Laptops for new operations hires is waiting for your approval (Procurement review).", link: `/app/requests/${r2.id}`, type: "APPROVAL" } });

  // 3. Pending requisition at level 1 for the manager, small amount (CFO level will be skipped)
  const r3 = await prisma.request.create({
    data: {
      orgId: org.id, templateId: pr.id, referenceNo: "PR-2026-0002", title: "PR: Stationery restock", requesterId: member2.id, status: "PENDING", priority: "LOW",
      currentLevel: 1, activeLevels: j([1, 2]), templateSnapshot: await snap(pr), submittedAt: hoursAgo(50), createdAt: hoursAgo(50), dueAt: new Date(Date.now() + 6 * 86400000),
      data: j({ purpose: "Stationery restock", costCentre: "Sales", items: [{ description: "A4 paper (box)", quantity: 10, unitPrice: 32, total: 320 }, { description: "Toner cartridges", quantity: 3, unitPrice: 95, total: 285 }], itemsTotal: 605, priority: "LOW" }),
    },
  });
  await prisma.requestApproval.create({ data: { requestId: r3.id, levelOrder: 1, levelName: "Line manager approval", approverId: manager.id, status: "PENDING", dueAt: hoursAgo(26), createdAt: hoursAgo(50) } });
  await prisma.notification.create({ data: { orgId: org.id, userId: manager.id, title: "Approval needed: PR-2026-0002", body: "PR: Stationery restock is waiting for your approval.", link: `/app/requests/${r3.id}`, type: "APPROVAL" } });

  // 4. Rejected memo
  const r4 = await prisma.request.create({
    data: {
      orgId: org.id, templateId: memo.id, referenceNo: "MEMO-2026-0002", title: "Memo: Proposed change to shift pattern", requesterId: member2.id, status: "REJECTED", priority: "NORMAL",
      currentLevel: 1, activeLevels: j([1, 2]), templateSnapshot: await snap(memo), submittedAt: hoursAgo(120), completedAt: hoursAgo(100), createdAt: hoursAgo(121),
      data: j({ to: "Operations team", subject: "Proposed change to shift pattern", body: "Proposal to move to 4-day shifts.", confidential: true, priority: "NORMAL" }),
    },
  });
  await prisma.requestApproval.create({ data: { requestId: r4.id, levelOrder: 1, levelName: "Line manager review", approverId: manager.id, status: "REJECTED", comment: "Needs HR consultation first.", actedAt: hoursAgo(100), createdAt: hoursAgo(120) } });

  // 5. Draft document approval
  await prisma.request.create({
    data: {
      orgId: org.id, templateId: doc.id, referenceNo: "DOC-2026-0001", title: "Policy: Remote work policy v2", requesterId: manager.id, status: "DRAFT", priority: "NORMAL", createdAt: hoursAgo(5),
      data: j({ documentTitle: "Remote work policy v2", documentType: "Policy", summary: "Clarifies equipment allowance and core hours.", reviewer: opsHead.id, owningDepartment: ops.id }),
    },
  });

  await prisma.workflowTemplate.update({ where: { id: memo.id }, data: { counter: 2 } });
  await prisma.workflowTemplate.update({ where: { id: pr.id }, data: { counter: 2 } });
  await prisma.workflowTemplate.update({ where: { id: doc.id }, data: { counter: 1 } });

  await prisma.auditLog.createMany({
    data: [
      { orgId: org.id, userId: owner.id, action: "org.created", entityType: "Organization", entityId: org.id, meta: j({ slug: "acme" }) },
      { orgId: org.id, userId: owner.id, action: "template.created", entityType: "WorkflowTemplate", entityId: pr.id, meta: j({ name: "Purchase requisition" }) },
      { orgId: org.id, userId: member.id, action: "request.submitted", entityType: "Request", entityId: r2.id, meta: j({ referenceNo: "PR-2026-0001" }) },
      { orgId: org.id, userId: manager.id, action: "request.approve", entityType: "Request", entityId: r2.id, meta: j({ level: 1 }) },
    ],
  });

  console.log("Seeded demo workspace 'acme'. Logins (password: Password123!):");
  for (const u of [owner, cfo, opsHead, manager, procurement, legal, member, member2]) console.log(`  ${u.email.padEnd(24)} ${u.role.padEnd(8)} ${u.name}`);
}

main().finally(() => prisma.$disconnect());
