/*
 * ZimStat (Zimbabwe National Statistics Agency) single-organisation seed.
 * Creates the agency, its sections, demo officers, and the four workflows modelled on the Agency's paper forms:
 *   1. Application for Field Duty and Travelling & Subsistence Advance
 *   2. Travelling and Subsistence Expense Claim Form
 *   3. Application for Leave (Public Service form, Second Schedule s.34)
 *   4. Application for Annual Leave (off days, 12-day entitlement)
 * All names here are fictional. Password for every demo account: Password123!
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const j = (v: unknown) => JSON.stringify(v);

async function main() {
  const existing = await prisma.organization.findUnique({ where: { slug: "zimstat" } });
  if (existing) {
    console.log("ZimStat organisation already exists, skipping seed.");
    return;
  }
  const pw = await bcrypt.hash("Password123!", 10);

  const org = await prisma.organization.create({
    data: {
      name: "Zimbabwe National Statistics Agency",
      slug: "zimstat",
      plan: "ENTERPRISE",
      planStatus: "ACTIVE",
      onboardingCompletedAt: new Date(),
      billingEmail: "ict@zimstat.co.zw",
      branding: j({
        productName: "ZimStat Approvals", primaryColor: "#1414D2", sidebarTheme: "light", borderRadius: 8,
        logoUrl: "/brand/zimstat-logo.png", loginTagline: "Travelling & subsistence, leave and internal approvals",
        footerText: "© Zimbabwe National Statistics Agency · 20th Floor, Kaguvi Building, Harare", hideVendorBranding: true, supportEmail: "ict@zimstat.co.zw",
      }),
      settings: j({ currency: "USD", timezone: "Africa/Harare", requireCommentOnReject: true, allowSelfApproval: false, emailNotifications: true, annualLeaveDays: 12, sessionHours: 8, lockoutThreshold: 5 }),
    },
  });

  const mk = (email: string, name: string, role: string, jobTitle: string) =>
    prisma.user.create({ data: { orgId: org.id, email, name, role, jobTitle, passwordHash: pw, emailVerifiedAt: new Date() } });

  // --- People (fictional) ---
  const ict = await mk("ict.admin@zimstat.co.zw", "Tendai Moyo", "OWNER", "ICT Systems Administrator");
  const dg = await mk("dg@zimstat.co.zw", "Dr. Rufaro Chikwanha", "ADMIN", "Director General");
  const dirFinance = await mk("director.finance@zimstat.co.zw", "Nyasha Dube", "ADMIN", "Director, Finance & Administration");
  const accountant = await mk("accountant@zimstat.co.zw", "Farai Ncube", "MANAGER", "Accountant");
  const cashier = await mk("finance.officer@zimstat.co.zw", "Rudo Mutasa", "MEMBER", "Finance Officer (Advances)");
  const hrHead = await mk("hr.head@zimstat.co.zw", "Chipo Mlambo", "MANAGER", "Head of Human Resources");
  const registry = await mk("registry@zimstat.co.zw", "Blessing Sibanda", "MEMBER", "Registry Clerk");
  const auditor = await mk("internal.audit@zimstat.co.zw", "Tapiwa Gumbo", "MANAGER", "Internal Auditor");
  const ictHead = await mk("ict.head@zimstat.co.zw", "Kudzai Mhlanga", "MANAGER", "Head of ICT Section");
  const surveysHead = await mk("surveys.head@zimstat.co.zw", "Tariro Chigumba", "MANAGER", "Head of Population Census & Surveys Division");
  const supervisor = await mk("field.supervisor@zimstat.co.zw", "Munyaradzi Zvobgo", "MANAGER", "Field Supervisor / Team Leader");
  const officer1 = await mk("l.officer@zimstat.co.zw", "Leonard Officer", "MEMBER", "Statistical Officer (ICT)");
  const officer2 = await mk("p.officer@zimstat.co.zw", "Pamela Officer", "MEMBER", "Enumerator Supervisor (Surveys)");

  // --- Sections / divisions (the "Section" on the T&S form; head = Head of Section) ---
  const dept = (name: string, code: string, headUserId: string) => prisma.department.create({ data: { orgId: org.id, name, code, headUserId } });
  const directorate = await dept("Office of the Director General", "DG", dg.id);
  const finance = await dept("Finance Section", "FIN", dirFinance.id);
  const hr = await dept("Human Resources & Administration (Registry)", "HRA", hrHead.id);
  const audit = await dept("Internal Audit", "AUD", auditor.id);
  const ictSec = await dept("ICT Section", "ICT", ictHead.id);
  const surveys = await dept("Population Census & Surveys Division", "PCS", surveysHead.id);

  const place = (id: string, departmentId: string, managerId?: string) => prisma.user.update({ where: { id }, data: { departmentId, managerId } });
  await place(dg.id, directorate.id);
  await place(dirFinance.id, finance.id, dg.id);
  await place(accountant.id, finance.id, dirFinance.id);
  await place(cashier.id, finance.id, accountant.id);
  await place(hrHead.id, hr.id, dg.id);
  await place(registry.id, hr.id, hrHead.id);
  await place(auditor.id, audit.id, dg.id);
  await place(ictHead.id, ictSec.id, dg.id);
  await place(ict.id, ictSec.id, ictHead.id);
  await place(officer1.id, ictSec.id, ictHead.id);
  await place(surveysHead.id, surveys.id, dg.id);
  await place(supervisor.id, surveys.id, surveysHead.id);
  await place(officer2.id, surveys.id, supervisor.id);

  // --- Projects / surveys (the "Cost to be borne by" and Project columns on the forms) ---
  const project = (code: string, name: string, description: string, budgetAmount: number, ownerUserId: string) =>
    prisma.project.create({ data: { orgId: org.id, code, name, description, budgetAmount, currency: "USD", status: "ACTIVE", ownerUserId, startsAt: new Date("2025-01-01") } });
  const zdhs = await project("ZDHS", "Zimbabwe Demographic and Health Survey", "Funded by USAID. Field work, report finalisation and dissemination.", 250000, surveysHead.id);
  const mics = await project("MICS", "Multiple Indicator Cluster Survey", "Funded by UNICEF. Field supervision and data collection.", 180000, surveysHead.id);
  await project("GVT-OPS", "Government operations (Treasury)", "Recurrent, Treasury-funded travel and subsistence.", 120000, dirFinance.id);

  // --- Workflows ---
  const COST_CENTRES = ["ZDHS (USAID)", "MICS (UNICEF)", "Government / Treasury", "Census", "Other donor"];
  const RATES = { bb: 70, supplementary: 20, lunch: 15, dinner: 15, fieldDuty: 10 };

  // 1. Application for Field Duty and Travelling & Subsistence Advance
  const tsAdvance = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "T&S Advance Application", category: "EXPENSE", prefix: "TSA", icon: "🧳", color: "#1414D2", createdById: ict.id,
      description: "Application for Field Duty and Travelling & Subsistence Advance. Recommended by the Head of Section, certified by Finance, approved by the Director General / Head of Division.",
      fields: j([
        { key: "h1", label: "Section A — Basic information", type: "heading", width: "full" },
        { key: "ecNumber", label: "E.C. / I.D. number", type: "text", required: true, width: "third", placeholder: "e.g. 6118542N" },
        { key: "salaryGrade", label: "Salary grade", type: "text", required: true, width: "third" },
        { key: "section", label: "Section", type: "department", required: true, width: "third", helpText: "The section you are attached to" },
        { key: "destination", label: "Travel to (destination)", type: "text", required: true, width: "half", placeholder: "e.g. Kadoma" },
        { key: "period", label: "Period of travel", type: "daterange", required: true, width: "half" },
        { key: "purpose", label: "Purpose of journey", type: "textarea", required: true, width: "full", placeholder: "e.g. ZDHS report finalisation" },
        { key: "costBorneBy", label: "Cost to be borne by", type: "select", options: COST_CENTRES, required: true, width: "half", helpText: "Funder or vote the advance is charged to. Also choose the matching project above." },
        { key: "h2", label: "Section B — Breakdown of allowance", type: "heading", width: "full" },
        { key: "breakdown", label: "Allowances requested", type: "table", required: true, minRows: 1, totalColumn: "total", width: "full", columns: [
          { key: "item", label: "Item", type: "select", options: ["Bed & Breakfast", "Supplementary", "Lunch", "Dinner", "Field duty", "Other expenses"], required: true, width: 170 },
          { key: "unit", label: "Nights / days", type: "select", options: ["Nights", "Days", "Item"], required: true, width: 110 },
          { key: "number", label: "No.", type: "number", required: true, width: 80 },
          { key: "rate", label: "Rate (USD)", type: "currency", required: true, width: 110 },
          { key: "total", label: "Total (USD)", type: "computed", formula: "number * rate", sum: true, width: 120 },
        ], helpText: `Standard rates: Bed & Breakfast ${RATES.bb}/night, Supplementary ${RATES.supplementary}/day, Lunch ${RATES.lunch}, Dinner ${RATES.dinner}, Field duty ${RATES.fieldDuty}/day.` },
        { key: "h3", label: "Section C — Declaration by applicant", type: "heading", width: "full" },
        { key: "declaration", label: "I undertake to clear this advance by production of receipts, claim form, air tickets and to pay back any remaining balance immediately on my return. I understand that should I fail to clear this advance within 10 days after my return, the Finance Section shall recover it from my salary and/or other immediate payments in terms of the Agency's policies.", type: "checkbox", required: true, width: "full" },
      ]),
      levels: j([
        { id: "l1", order: 1, name: "Recommended by Head of Section", description: "Recommend / not recommend the application.", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 24, allowDelegate: true, allowReturn: true, skipIfRequester: true, fallbackUserId: dg.id },
        { id: "l2", order: 2, name: "Finance Section certification", description: "Certify the officer's advance account balance (state the balance in your comment).", approverType: "DEPARTMENT", departmentId: finance.id, minRole: "MEMBER", mode: "ANY", slaHours: 48, allowDelegate: false, allowReturn: true, requireComment: true, returnTo: 1 },
        { id: "l3", order: 3, name: "Advance approval — Director General / Head of Division", description: "On the basis of the certification above the advance is approved / not approved.", approverType: "USER", approverUserIds: [dg.id, dirFinance.id], mode: "ANY", slaHours: 72, allowDelegate: true, allowReturn: true, requireComment: false },
        { id: "l4", order: 4, name: "Disbursement by Finance", description: "Pay out the advance and record it against the officer's advance account.", approverType: "DEPARTMENT", departmentId: finance.id, minRole: "MEMBER", mode: "ANY", slaHours: 72, allowDelegate: false, allowReturn: false },
      ]),
      settings: j({ titleTemplate: "T&S advance: {{destination}}", allowAttachments: true, allowRequesterCancel: true, costField: "breakdownTotal", requireProject: true, dueInDays: 7 }),
    },
  });

  // 2. Travelling and Subsistence Expense Claim Form
  const tsClaim = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "T&S Expense Claim", category: "EXPENSE", prefix: "TSC", icon: "🧾", color: "#D7262D", createdById: ict.id,
      description: "Travelling and Subsistence Expense Claim. Certified by the Supervisor/Team Leader, checked and passed for payment by Finance, examined by Internal Audit.",
      fields: j([
        { key: "h1", label: "Claimant", type: "heading", width: "full" },
        { key: "ecNumber", label: "E.C. / I.D. number", type: "text", required: true, width: "third" },
        { key: "vendorNumber", label: "Vendor number", type: "text", width: "third" },
        { key: "cellPhone", label: "Cell phone number", type: "text", required: true, width: "third" },
        { key: "physicalAddress", label: "Physical address", type: "text", required: true, width: "full" },
        { key: "stationedAt", label: "Stationed at", type: "text", required: true, width: "half", defaultValue: "Head Office" },
        { key: "period", label: "Period covered by claim", type: "daterange", required: true, width: "half" },
        { key: "campingEquipment", label: "Camping equipment", type: "select", options: ["Not been with camping equipment", "Been with camping equipment"], required: true, width: "half" },
        { key: "fundedBy", label: "Cost centre / funder", type: "select", options: COST_CENTRES, required: true, width: "half" },
        { key: "h2", label: "Journeys and subsistence (one row per day)", type: "heading", width: "full" },
        { key: "itinerary", label: "Daily itinerary", type: "table", required: true, minRows: 1, totalColumn: "total", width: "full", columns: [
          { key: "date", label: "Date", type: "date", required: true, width: 120 },
          { key: "route", label: "Place from / to", type: "text", required: true, width: 160 },
          { key: "depart", label: "Dep.", type: "text", width: 70 },
          { key: "arrive", label: "Arr.", type: "text", width: 70 },
          { key: "days", label: "Days/hrs", type: "number", width: 80 },
          { key: "fieldDuty", label: "Field duty", type: "currency", width: 100 },
          { key: "breakfast", label: "Breakfast", type: "currency", width: 100 },
          { key: "lunch", label: "Lunch", type: "currency", width: 90 },
          { key: "dinner", label: "Dinner", type: "currency", width: 90 },
          { key: "accommodation", label: "Accommodation", type: "currency", width: 120 },
          { key: "transport", label: "Transport", type: "currency", width: 100 },
          { key: "supplementary", label: "Supplementary", type: "currency", width: 120 },
          { key: "other", label: "Other (toll, visa…)", type: "currency", width: 120 },
          { key: "total", label: "Total", type: "computed", formula: "fieldDuty + breakfast + lunch + dinner + accommodation + transport + supplementary + other", sum: true, width: 110 },
          { key: "accommodationType", label: "Accommodation", type: "select", options: ["GVT", "Private", "Hotel", "Field camp"], width: 120 },
        ], helpText: "State the purpose of each journey, mode of transport other than own vehicle, and class of accommodation in the Purpose field below." },
        { key: "purpose", label: "Purpose of the journey(s), mode of transport and class of accommodation", type: "textarea", required: true, width: "full" },
        { key: "h3", label: "Use of own vehicle", type: "heading", width: "full" },
        { key: "ownVehicle", label: "Own vehicle used", type: "checkbox", width: "third" },
        { key: "vehicleReg", label: "Vehicle registration number", type: "text", width: "third", visibleWhen: { field: "ownVehicle", op: "eq", value: true } },
        { key: "vehicleKm", label: "Distance (km)", type: "number", width: "third", visibleWhen: { field: "ownVehicle", op: "eq", value: true } },
        { key: "vehicleRate", label: "Rate per km (USD)", type: "currency", width: "third", visibleWhen: { field: "ownVehicle", op: "eq", value: true } },
        { key: "vehicleAllowance", label: "Allowance for use of own vehicle (km × rate, USD)", type: "currency", width: "third", visibleWhen: { field: "ownVehicle", op: "eq", value: true } },
        { key: "h4", label: "Advances received in respect of this claim", type: "heading", width: "full" },
        { key: "advances", label: "Advances received", type: "table", minRows: 0, totalColumn: "amount", width: "full", columns: [
          { key: "date", label: "Date", type: "date", width: 130 },
          { key: "where", label: "Where received", type: "text", width: 200 },
          { key: "reference", label: "Advance reference (TSA-…)", type: "text", width: 160 },
          { key: "amount", label: "Amount (USD)", type: "currency", required: true, sum: true, width: 130 },
        ] },
        { key: "otherExpenses", label: "Other expenses not listed above (USD)", type: "currency", width: "half" },
        { key: "certify", label: "I certify that the journeys stated were undertaken for the purposes stated and that this is a true claim for allowances and refunds payable to me in terms of the ZIMSTAT (Travelling and Subsistence) Regulations.", type: "checkbox", required: true, width: "full" },
      ]),
      levels: j([
        { id: "c1", order: 1, name: "Certified correct — Supervisor / Team Leader", description: "Certify that the journeys stated were undertaken for the purposes stated.", approverType: "REQUESTER_MANAGER", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true, skipIfRequester: true },
        { id: "c2", order: 2, name: "Checked / certified not previously paid — Accounts", description: "Check arithmetic, receipts, advances deducted and that the claim has not been paid before. Enter the appropriation (cost centre, GL, project) in your comment.", approverType: "DEPARTMENT", departmentId: finance.id, minRole: "MEMBER", mode: "ANY", slaHours: 72, allowReturn: true, requireComment: true, returnTo: 1 },
        { id: "c3", order: 3, name: "Passed for payment — Accountant / Deputy Director", approverType: "USER", approverUserIds: [accountant.id, dirFinance.id], mode: "ANY", slaHours: 72, allowDelegate: true, allowReturn: true, requireComment: true },
        { id: "c4", order: 4, name: "Examined — Internal Audit", description: "Post-payment examination. Comment on any exceptions.", approverType: "DEPARTMENT", departmentId: audit.id, minRole: "MEMBER", mode: "ANY", slaHours: 168, allowDelegate: false, allowReturn: true, returnTo: 2 },
      ]),
      settings: j({ titleTemplate: "T&S claim: {{period}}", allowAttachments: true, requireAttachment: true, allowRequesterCancel: true, costField: "itineraryTotal", requireProject: true, dueInDays: 14 }),
    },
  });

  // 3. Application for Leave (Public Service form)
  const leave = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "Application for Leave", category: "LEAVE", prefix: "LV", icon: "📋", color: "#2F855A", createdById: ict.id,
      description: "Public Service Application for Leave (Second Schedule, s.34): vacation, sick, annual, special, without pay, urgent private affairs. Recommended by the supervisor, approved by the Head of Section, recorded by Registry.",
      fields: j([
        { key: "employeeCode", label: "Employee code number", type: "text", required: true, width: "third", helpText: "If the E.C. number or check digit is incorrect the form is rejected." },
        { key: "checkDigit", label: "Check digit", type: "text", required: true, width: "third" },
        { key: "station", label: "Station", type: "text", required: true, width: "third", defaultValue: "Head Office, Harare" },
        { key: "leaveType", label: "Type of leave", type: "select", options: ["Vacation", "Sick", "Annual", "Special", "Without pay", "Urgent private affairs"], required: true, width: "half" },
        { key: "dates", label: "From / to (inclusive)", type: "daterange", required: true, width: "half" },
        { key: "daysRequired", label: "Number of days", type: "number", required: true, min: 0.5, width: "third", helpText: "Working days. Sick leave over three consecutive working days requires a medical certificate (attach it)." },
        { key: "advanceOfSalary", label: "Advance of salary requested", type: "checkbox", width: "third", helpText: "Applications for advances of salary must reach the Salary Service Bureau at least six weeks before the leave starts." },
        { key: "advanceMonths", label: "Number of months' advance", type: "number", width: "third", visibleWhen: { field: "advanceOfSalary", op: "eq", value: true } },
        { key: "vacatingAccommodation", label: "I will be vacating Government accommodation", type: "checkbox", width: "half" },
        { key: "accommodationDates", label: "Accommodation vacated from / to", type: "daterange", width: "half", visibleWhen: { field: "vacatingAccommodation", op: "eq", value: true } },
        { key: "amended", label: "Amended / cancelled form (state original dates)", type: "text", width: "full", placeholder: "AMENDED/CANCELLED. ORIGINAL DATES WERE … TO …" },
        { key: "notes", label: "Handover notes / contact while away", type: "textarea", width: "full" },
      ]),
      levels: j([
        { id: "v1", order: 1, name: "Recommended — Supervisor", approverType: "REQUESTER_MANAGER", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true, skipIfRequester: true },
        { id: "v2", order: 2, name: "Approved — Head of Section / Office", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 72, allowDelegate: true, allowReturn: true, skipIfRequester: true, fallbackUserId: hrHead.id },
        { id: "v3", order: 3, name: "Recorded and filed — Registry / HR", description: "Record the leave, update the leave register and file the form.", approverType: "DEPARTMENT", departmentId: hr.id, minRole: "MEMBER", mode: "ANY", slaHours: 72, allowDelegate: false, allowReturn: false },
      ]),
      settings: j({ titleTemplate: "{{leaveType}} leave: {{daysRequired}} days", allowAttachments: true, allowRequesterCancel: true, costField: "none" }),
    },
  });

  // 4. Application for Annual Leave (off days)
  const annual = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "Application for Annual Leave (off days)", category: "LEAVE", prefix: "AL", icon: "🌴", color: "#F0A020", createdById: ict.id,
      description: "Annual leave / off days against the 12-day yearly entitlement. Recommended by the supervisor, approved by the Head of Office, recorded and filed by Registry/Admin. The officer's balance is shown on the request.",
      fields: j([
        { key: "leaveType", label: "Type", type: "select", options: ["Annual (off days)"], required: true, width: "third", defaultValue: "Annual (off days)" },
        { key: "daysRequired", label: "Number of days required", type: "number", required: true, min: 0.5, width: "third" },
        { key: "dates", label: "On / from — to (both dates inclusive)", type: "daterange", required: true, width: "third" },
        { key: "notes", label: "Notes", type: "textarea", width: "full", helpText: "N.B. If annual leave is taken in conjunction with vacation leave, any Saturday, Sunday or public holiday falling within the leave period must be included. If more than six working days are taken at any one time the above days must also be included." },
      ]),
      levels: j([
        { id: "a1", order: 1, name: "Recommended — Supervisor", approverType: "REQUESTER_MANAGER", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true, skipIfRequester: true },
        { id: "a2", order: 2, name: "Approved — Head of Office", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 72, allowDelegate: true, allowReturn: true, skipIfRequester: true, fallbackUserId: hrHead.id },
        { id: "a3", order: 3, name: "Recorded and filed — Registry / Admin", description: "Update the officer's leave record. The balance note is sent to the officer automatically.", approverType: "DEPARTMENT", departmentId: hr.id, minRole: "MEMBER", mode: "ANY", slaHours: 72, allowDelegate: false, allowReturn: false },
      ]),
      settings: j({ titleTemplate: "Annual leave: {{daysRequired}} days", allowAttachments: false, allowRequesterCancel: true, costField: "none" }),
    },
  });

  // 5. Internal memo (general purpose)
  const memo = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "Internal memo", category: "MEMO", prefix: "MEMO", icon: "📝", color: "#722ed1", createdById: ict.id,
      description: "Circulate an internal memo for approval by the Head of Section, and by the Director General when marked for the Directorate.",
      fields: j([
        { key: "to", label: "To", type: "text", required: true, width: "half" },
        { key: "subject", label: "Subject", type: "text", required: true, width: "half" },
        { key: "body", label: "Memo", type: "richtext", required: true, width: "full" },
        { key: "forDirectorate", label: "Requires Director General's approval", type: "checkbox", width: "half" },
      ]),
      levels: j([
        { id: "m1", order: 1, name: "Head of Section", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true, skipIfRequester: true, fallbackUserId: dg.id },
        { id: "m2", order: 2, name: "Director General", approverType: "USER", approverUserIds: [dg.id], mode: "ANY", slaHours: 72, allowDelegate: true, allowReturn: true, condition: { field: "forDirectorate", op: "eq", value: true } },
      ]),
      settings: j({ titleTemplate: "Memo: {{subject}}", allowAttachments: true, costField: "none" }),
    },
  });

  // --- Sample history so the dashboard is not empty ---
  const snap = async (t: { id: string }) => {
    const x = await prisma.workflowTemplate.findUnique({ where: { id: t.id } });
    return j({ name: x!.name, category: x!.category, fields: JSON.parse(x!.fields), levels: JSON.parse(x!.levels), settings: JSON.parse(x!.settings), version: 1 });
  };
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);
  const year = new Date().getFullYear();

  // Approved T&S advance (ZDHS report finalisation, Kadoma)
  const breakdown = [
    { item: "Bed & Breakfast", unit: "Nights", number: 8, rate: 70, total: 560 },
    { item: "Supplementary", unit: "Days", number: 8, rate: 20, total: 160 },
    { item: "Lunch", unit: "Days", number: 2, rate: 15, total: 30 },
    { item: "Dinner", unit: "Days", number: 8, rate: 15, total: 120 },
  ];
  const r1 = await prisma.request.create({
    data: {
      orgId: org.id, templateId: tsAdvance.id, referenceNo: `TSA-${year}-0001`, title: "T&S advance: Kadoma", requesterId: officer1.id, status: "APPROVED", priority: "NORMAL",
      projectId: zdhs.id, costAmount: 870, currentLevel: 4, activeLevels: j([1, 2, 3, 4]), templateSnapshot: await snap(tsAdvance), submittedAt: hoursAgo(200), completedAt: hoursAgo(120), createdAt: hoursAgo(201),
      data: j({ ecNumber: "0000000X", salaryGrade: "D3", section: ictSec.id, destination: "Kadoma", period: ["2025-03-20", "2025-03-27"], purpose: "ZDHS report finalisation", costBorneBy: "ZDHS (USAID)", breakdown, breakdownTotal: 870, declaration: true, priority: "NORMAL" }),
    },
  });
  for (const [lvl, name, who, h, comment] of [
    [1, "Recommended by Head of Section", ictHead.id, 190, "Recommended."],
    [2, "Finance Section certification", cashier.id, 170, "Advance account balance: USD 0.00. Certified."],
    [3, "Advance approval — Director General / Head of Division", dg.id, 150, "Approved."],
    [4, "Disbursement by Finance", cashier.id, 120, "Paid by EFT, ref ADV-0391."],
  ] as const) {
    await prisma.requestApproval.create({ data: { requestId: r1.id, levelOrder: lvl, levelName: name, approverId: who, status: "APPROVED", comment, actedAt: hoursAgo(h), createdAt: hoursAgo(h + 5) } });
  }

  // Pending T&S claim at Accounts (MICS supervision)
  const itinerary = [
    { date: "2025-10-20", route: "Harare – Chinhoyi", days: 1, breakfast: 0, lunch: 25, dinner: 75, supplementary: 3, total: 103, accommodationType: "GVT" },
    { date: "2025-10-21", route: "Chinhoyi – Karoi", days: 1, breakfast: 20, lunch: 25, dinner: 75, supplementary: 3, total: 123, accommodationType: "GVT" },
    { date: "2025-10-22", route: "Karoi", days: 1, breakfast: 20, lunch: 25, dinner: 75, supplementary: 3, total: 123, accommodationType: "Private" },
    { date: "2025-10-23", route: "Karoi – Harare", days: 1, breakfast: 20, lunch: 0, dinner: 0, supplementary: 3, total: 23, accommodationType: "Private" },
  ];
  const r2 = await prisma.request.create({
    data: {
      orgId: org.id, templateId: tsClaim.id, referenceNo: `TSC-${year}-0001`, title: "T&S claim: MICS supervision, Mashonaland West", requesterId: officer2.id, status: "PENDING", priority: "NORMAL",
      projectId: mics.id, costAmount: 372, currentLevel: 2, activeLevels: j([1, 2, 3, 4]), templateSnapshot: await snap(tsClaim), submittedAt: hoursAgo(40), createdAt: hoursAgo(41), dueAt: new Date(Date.now() + 10 * 86400000),
      data: j({ ecNumber: "0000001Y", cellPhone: "0770 000 000", physicalAddress: "12 Example Road, Harare", stationedAt: "Head Office", period: ["2025-10-20", "2025-10-23"], campingEquipment: "Not been with camping equipment", fundedBy: "MICS (UNICEF)", itinerary, itineraryTotal: 372, purpose: "MICS supervision. Travel by Agency vehicle. Government and private accommodation.", ownVehicle: false, advances: [], advancesTotal: 0, certify: true, priority: "NORMAL" }),
    },
  });
  await prisma.requestApproval.create({ data: { requestId: r2.id, levelOrder: 1, levelName: "Certified correct — Supervisor / Team Leader", approverId: supervisor.id, status: "APPROVED", comment: "Journeys undertaken as stated.", actedAt: hoursAgo(30), createdAt: hoursAgo(40) } });
  for (const who of [dirFinance.id, accountant.id, cashier.id]) {
    await prisma.requestApproval.create({ data: { requestId: r2.id, levelOrder: 2, levelName: "Checked / certified not previously paid — Accounts", approverId: who, status: "PENDING", dueAt: new Date(Date.now() + 42 * 3600000), createdAt: hoursAgo(30) } });
    await prisma.notification.create({ data: { orgId: org.id, userId: who, title: `Approval needed: TSC-${year}-0001`, body: "T&S claim: MICS supervision is waiting for Accounts (checked / not previously paid).", link: `/app/requests/${r2.id}`, type: "APPROVAL" } });
  }

  // Approved annual leave (3 days) so the balance shows 9 remaining
  const r3 = await prisma.request.create({
    data: {
      orgId: org.id, templateId: annual.id, referenceNo: `AL-${year}-0001`, title: "Annual leave: 3 days", requesterId: officer1.id, status: "APPROVED", priority: "NORMAL",
      currentLevel: 3, activeLevels: j([1, 2, 3]), templateSnapshot: await snap(annual), submittedAt: hoursAgo(500), completedAt: hoursAgo(450), createdAt: hoursAgo(501),
      data: j({ leaveType: "Annual (off days)", daysRequired: 3, dates: [`${year}-02-10`, `${year}-02-12`], notes: "", priority: "NORMAL" }),
    },
  });
  await prisma.requestApproval.create({ data: { requestId: r3.id, levelOrder: 1, levelName: "Recommended — Supervisor", approverId: ictHead.id, status: "APPROVED", actedAt: hoursAgo(490), createdAt: hoursAgo(500) } });
  await prisma.requestApproval.create({ data: { requestId: r3.id, levelOrder: 2, levelName: "Approved — Head of Office", approverId: ictHead.id, status: "APPROVED", actedAt: hoursAgo(480), createdAt: hoursAgo(490) } });
  await prisma.requestApproval.create({ data: { requestId: r3.id, levelOrder: 3, levelName: "Recorded and filed — Registry / Admin", approverId: registry.id, status: "APPROVED", comment: "Recorded. Balance 9 days.", actedAt: hoursAgo(450), createdAt: hoursAgo(480) } });

  // Pending leave application at the supervisor
  const r4 = await prisma.request.create({
    data: {
      orgId: org.id, templateId: leave.id, referenceNo: `LV-${year}-0001`, title: "Vacation leave: 10 days", requesterId: officer2.id, status: "PENDING", priority: "NORMAL",
      currentLevel: 1, activeLevels: j([1, 2, 3]), templateSnapshot: await snap(leave), submittedAt: hoursAgo(6), createdAt: hoursAgo(6),
      data: j({ employeeCode: "0000001", checkDigit: "7", station: "Head Office, Harare", leaveType: "Vacation", dates: [`${year}-12-15`, `${year}-12-26`], daysRequired: 10, advanceOfSalary: false, vacatingAccommodation: false, notes: "Contactable on cell.", priority: "NORMAL" }),
    },
  });
  await prisma.requestApproval.create({ data: { requestId: r4.id, levelOrder: 1, levelName: "Recommended — Supervisor", approverId: supervisor.id, status: "PENDING", dueAt: new Date(Date.now() + 42 * 3600000), createdAt: hoursAgo(6) } });
  await prisma.notification.create({ data: { orgId: org.id, userId: supervisor.id, title: `Approval needed: LV-${year}-0001`, body: "Vacation leave: 10 days is waiting for your recommendation.", link: `/app/requests/${r4.id}`, type: "APPROVAL" } });

  await prisma.workflowTemplate.update({ where: { id: tsAdvance.id }, data: { counter: 1 } });
  await prisma.workflowTemplate.update({ where: { id: tsClaim.id }, data: { counter: 1 } });
  await prisma.workflowTemplate.update({ where: { id: annual.id }, data: { counter: 1 } });
  await prisma.workflowTemplate.update({ where: { id: leave.id }, data: { counter: 1 } });
  void memo;

  await prisma.auditLog.createMany({
    data: [
      { orgId: org.id, userId: ict.id, action: "org.created", entityType: "Organization", entityId: org.id, meta: j({ slug: "zimstat" }) },
      { orgId: org.id, userId: ict.id, action: "template.created", entityType: "WorkflowTemplate", entityId: tsAdvance.id, meta: j({ name: "T&S Advance Application" }) },
      { orgId: org.id, userId: ict.id, action: "template.created", entityType: "WorkflowTemplate", entityId: tsClaim.id, meta: j({ name: "T&S Expense Claim" }) },
    ],
  });

  console.log("Seeded ZimStat organisation. Logins (password: Password123!):");
  for (const u of [ict, dg, dirFinance, accountant, cashier, hrHead, registry, auditor, ictHead, surveysHead, supervisor, officer1, officer2]) {
    console.log(`  ${u.email.padEnd(34)} ${u.role.padEnd(8)} ${u.name} — ${u.jobTitle}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
