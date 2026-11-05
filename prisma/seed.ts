/*
 * Municipality of Chitungwiza (local authority edition) single-organisation seed.
 * Creates the council, its departments, demo officers, the licensing schedule with sample licences, and the
 * workflows modelled on the Public Service / council paper forms:
 *   1. Application for Field Duty and Travelling & Subsistence Advance
 *   2. Travelling and Subsistence Expense Claim Form
 *   3. Application for Leave (Public Service form, Second Schedule s.34)
 *   4. Application for Annual Leave (off days, 12-day entitlement)
 * All names here are fictional. Password for every demo account: Password123!
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { applyLicenceForms } from "./seed-licence-forms";

const prisma = new PrismaClient();
const j = (v: unknown) => JSON.stringify(v);

const HOLIDAY_YEAR = new Date().getFullYear();
const HOLIDAYS = [
  [`${HOLIDAY_YEAR}-01-01`, "New Year's Day"], [`${HOLIDAY_YEAR}-02-21`, "Robert Gabriel Mugabe National Youth Day"], [`${HOLIDAY_YEAR}-04-18`, "Independence Day"],
  [`${HOLIDAY_YEAR}-05-01`, "Workers' Day"], [`${HOLIDAY_YEAR}-05-25`, "Africa Day"], [`${HOLIDAY_YEAR}-08-11`, "Heroes' Day"], [`${HOLIDAY_YEAR}-08-12`, "Defence Forces Day"],
  [`${HOLIDAY_YEAR}-12-22`, "Unity Day"], [`${HOLIDAY_YEAR}-12-25`, "Christmas Day"], [`${HOLIDAY_YEAR}-12-26`, "Boxing Day"],
].map(([date, name]) => ({ date, name }));

async function main() {
  const existing = await prisma.organization.findUnique({ where: { slug: "chitungwiza" } });
  if (existing) {
    console.log("Municipality of Chitungwiza organisation already exists, skipping seed.");
    return;
  }
  const pw = await bcrypt.hash("Password123!", 10);

  const org = await prisma.organization.create({
    data: {
      name: "Municipality of Chitungwiza",
      slug: "chitungwiza",
      plan: "ENTERPRISE",
      planStatus: "ACTIVE",
      onboardingCompletedAt: new Date(),
      billingEmail: "ict@chitungwiza.co.zw",
      branding: j({
        productName: "Municipality of Chitungwiza", primaryColor: "#B5491A", sidebarTheme: "dark", borderRadius: 0,
        logoUrl: "/brand/chitungwiza-logo.png", loginTagline: "Pamberi Nemushandira Pamwe · approvals, licensing and service desk",
        footerText: "© Municipality of Chitungwiza · Town House, Zengeza", hideVendorBranding: true, supportEmail: "ict@chitungwiza.co.zw",
      }),
      settings: j({ currency: "USD", timezone: "Africa/Harare", licensing: { prefix: "CMC", portal: true }, cases: { prefix: "CMC" }, requireCommentOnReject: true, allowSelfApproval: false, emailNotifications: true, annualLeaveDays: 12, sessionHours: 8, lockoutThreshold: 5, publicHolidays: HOLIDAYS }),
    },
  });

  const mk = (email: string, name: string, role: string, jobTitle: string) =>
    prisma.user.create({ data: { orgId: org.id, email, name, role, jobTitle, passwordHash: pw, emailVerifiedAt: new Date() } });

  // --- People (fictional) ---
  const ict = await mk("ict.admin@chitungwiza.co.zw", "Tendai Moyo", "OWNER", "ICT Systems Administrator");
  const dg = await mk("secretary@chitungwiza.co.zw", "Rufaro Chikwanha", "ADMIN", "Town Clerk");
  const dirFinance = await mk("treasurer@chitungwiza.co.zw", "Nyasha Dube", "ADMIN", "Treasurer");
  const accountant = await mk("accountant@chitungwiza.co.zw", "Farai Ncube", "MANAGER", "Accountant");
  const cashier = await mk("cashier@chitungwiza.co.zw", "Rudo Mutasa", "MEMBER", "Revenue Officer (Cashier)");
  const hrHead = await mk("admin.officer@chitungwiza.co.zw", "Chipo Mlambo", "MANAGER", "Administration & Human Resources Officer");
  const registry = await mk("registry@chitungwiza.co.zw", "Blessing Sibanda", "MEMBER", "Registry Clerk");
  const auditor = await mk("internal.audit@chitungwiza.co.zw", "Tapiwa Gumbo", "MANAGER", "Internal Auditor");
  const ictHead = await mk("ict.head@chitungwiza.co.zw", "Kudzai Mhlanga", "MANAGER", "ICT Manager");
  const surveysHead = await mk("engineer@chitungwiza.co.zw", "Tariro Chigumba", "MANAGER", "Director of Engineering & Works");
  const supervisor = await mk("works.supervisor@chitungwiza.co.zw", "Munyaradzi Zvobgo", "MANAGER", "Works Supervisor");
  const officer1 = await mk("l.officer@chitungwiza.co.zw", "Leonard Officer", "MEMBER", "ICT Technician");
  const healthHead = await mk("health.officer@chitungwiza.co.zw", "Tsitsi Marimo", "MANAGER", "Environmental Health Officer (Head of Health, Housing & Community Services)");
  const licensing = await mk("licensing@chitungwiza.co.zw", "Simbarashe Chawira", "MEMBER", "Licensing Officer");
  const inspector = await mk("inspector@chitungwiza.co.zw", "Grace Mapfumo", "MEMBER", "Health Inspector");
  const officer2 = await mk("p.officer@chitungwiza.co.zw", "Pamela Officer", "MEMBER", "Roads Foreman (Engineering)");

  // --- Departments (the "Section" on the T&S form; head = Head of Department) ---
  const dept = (name: string, code: string, headUserId: string) => prisma.department.create({ data: { orgId: org.id, name, code, headUserId } });
  const directorate = await dept("Town Clerk's Office", "TC", dg.id);
  const finance = await dept("Finance (Treasury)", "FIN", dirFinance.id);
  const hr = await dept("Administration & Human Resources", "ADM", hrHead.id);
  const audit = await dept("Internal Audit", "AUD", auditor.id);
  const ictSec = await dept("ICT Unit", "ICT", ictHead.id);
  const health = await dept("Health, Housing & Community Services", "HHS", healthHead.id);
  const surveys = await dept("Engineering & Works", "ENG", surveysHead.id);

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
  await place(healthHead.id, health.id, dg.id);
  await place(licensing.id, health.id, healthHead.id);
  await place(inspector.id, health.id, healthHead.id);

  // --- Projects / budget votes (the "Cost to be borne by" and Project columns on the forms) ---
  const project = (code: string, name: string, description: string, budgetAmount: number, ownerUserId: string) =>
    prisma.project.create({ data: { orgId: org.id, code, name, description, budgetAmount, currency: "USD", status: "ACTIVE", ownerUserId, startsAt: new Date("2025-01-01") } });
  const zdhs = await project("ROADS", "Road rehabilitation programme", "Devolution funds. Resurfacing, pothole patching and storm drains, wards 1–25.", 250000, surveysHead.id);
  const mics = await project("WATER", "Water & sewer reticulation", "Bulk water, reservoir and sewer line upgrades (St Mary's, Seke Unit L, Zengeza 4).", 180000, surveysHead.id);
  await project("RATES", "Recurrent operations (rates & levies)", "Recurrent travel, subsistence and operations funded from rates, levies and licence fees.", 120000, dirFinance.id);

  // --- Workflows ---
  const COST_CENTRES = ["Devolution funds", "Rates & levies (recurrent)", "Licensing & permits revenue", "Donor / partner", "Other"];
  const RATES = { bb: 70, supplementary: 20, lunch: 15, dinner: 15, fieldDuty: 10 };

  // 1. Application for Field Duty and Travelling & Subsistence Advance
  const tsAdvance = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "T&S Advance Application", category: "EXPENSE", prefix: "TSA", icon: "travel", color: "#1414D2", createdById: ict.id,
      description: "Application for Field Duty and Travelling & Subsistence Advance. Recommended by the Head of Department, certified by Finance, approved by the Town Clerk / Head of Department.",
      fields: j([
        { key: "h1", label: "Section A — Basic information", type: "heading", width: "full" },
        { key: "ecNumber", label: "E.C. / I.D. number", type: "text", required: true, width: "third", placeholder: "e.g. 6118542N" },
        { key: "salaryGrade", label: "Salary grade", type: "text", required: true, width: "third" },
        { key: "section", label: "Department", type: "department", required: true, width: "third", helpText: "The department you are attached to" },
        { key: "destination", label: "Travel to (destination)", type: "text", required: true, width: "half", placeholder: "e.g. Harare" },
        { key: "period", label: "Period of travel", type: "daterange", required: true, width: "half" },
        { key: "purpose", label: "Purpose of journey", type: "textarea", required: true, width: "full", placeholder: "e.g. Ministry of Local Government devolution reporting workshop" },
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
        { key: "declaration", label: "I undertake to clear this advance by production of receipts, claim form, air tickets and to pay back any remaining balance immediately on my return. I understand that should I fail to clear this advance within 10 days after my return, the Finance Department shall recover it from my salary and/or other immediate payments in terms of the Council's policies.", type: "checkbox", required: true, width: "full" },
      ]),
      levels: j([
        { id: "l1", order: 1, name: "Recommended by Head of Department", description: "Recommend / not recommend the application.", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 24, allowDelegate: true, allowReturn: true, skipIfRequester: true, fallbackUserId: dg.id },
        { id: "l2", order: 2, name: "Finance Department certification", description: "Certify the officer's advance account balance (state the balance in your comment).", approverType: "DEPARTMENT", departmentId: finance.id, minRole: "MEMBER", mode: "ANY", slaHours: 48, allowDelegate: false, allowReturn: true, requireComment: true, returnTo: 1 },
        { id: "l3", order: 3, name: "Advance approval — Town Clerk / Head of Department", description: "On the basis of the certification above the advance is approved / not approved.", approverType: "USER", approverUserIds: [dg.id, dirFinance.id], mode: "ANY", slaHours: 72, allowDelegate: true, allowReturn: true, requireComment: false },
        { id: "l4", order: 4, name: "Disbursement by Finance", description: "Pay out the advance and record it against the officer's advance account.", approverType: "DEPARTMENT", departmentId: finance.id, minRole: "MEMBER", mode: "ANY", slaHours: 72, allowDelegate: false, allowReturn: false },
      ]),
      settings: j({ titleTemplate: "T&S advance: {{destination}}", allowAttachments: true, allowRequesterCancel: true, costField: "breakdownTotal", requireProject: true, dueInDays: 7, advances: "open" }),
    },
  });

  // 2. Travelling and Subsistence Expense Claim Form
  const tsClaim = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "T&S Expense Claim", category: "EXPENSE", prefix: "TSC", icon: "receipt", color: "#D7262D", createdById: ict.id,
      description: "Travelling and Subsistence Expense Claim. Certified by the Supervisor/Team Leader, checked and passed for payment by Finance, examined by Internal Audit.",
      fields: j([
        { key: "h1", label: "Claimant", type: "heading", width: "full" },
        { key: "ecNumber", label: "E.C. / I.D. number", type: "text", required: true, width: "third" },
        { key: "vendorNumber", label: "Vendor number", type: "text", width: "third" },
        { key: "cellPhone", label: "Cell phone number", type: "text", required: true, width: "third" },
        { key: "physicalAddress", label: "Physical address", type: "text", required: true, width: "full" },
        { key: "stationedAt", label: "Stationed at", type: "text", required: true, width: "half", defaultValue: "Town House" },
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
        { key: "certify", label: "I certify that the journeys stated were undertaken for the purposes stated and that this is a true claim for allowances and refunds payable to me in terms of the Council's Travelling and Subsistence Regulations.", type: "checkbox", required: true, width: "full" },
      ]),
      levels: j([
        { id: "c1", order: 1, name: "Certified correct — Supervisor / Team Leader", description: "Certify that the journeys stated were undertaken for the purposes stated.", approverType: "REQUESTER_MANAGER", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true, skipIfRequester: true },
        { id: "c2", order: 2, name: "Checked / certified not previously paid — Accounts", description: "Check arithmetic, receipts, advances deducted and that the claim has not been paid before. Enter the appropriation (cost centre, GL, project) in your comment.", approverType: "DEPARTMENT", departmentId: finance.id, minRole: "MEMBER", mode: "ANY", slaHours: 72, allowReturn: true, requireComment: true, returnTo: 1 },
        { id: "c3", order: 3, name: "Passed for payment — Accountant / Deputy Director", approverType: "USER", approverUserIds: [accountant.id, dirFinance.id], mode: "ANY", slaHours: 72, allowDelegate: true, allowReturn: true, requireComment: true },
        { id: "c4", order: 4, name: "Examined — Internal Audit", description: "Post-payment examination. Comment on any exceptions.", approverType: "DEPARTMENT", departmentId: audit.id, minRole: "MEMBER", mode: "ANY", slaHours: 168, allowDelegate: false, allowReturn: true, returnTo: 2 },
      ]),
      settings: j({ titleTemplate: "T&S claim: {{period}}", allowAttachments: true, requireAttachment: true, allowRequesterCancel: true, costField: "itineraryTotal", requireProject: true, dueInDays: 14, advances: "clear" }),
    },
  });

  // 3. Application for Leave (Public Service form)
  const leave = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "Application for Leave", category: "LEAVE", prefix: "LV", icon: "clipboard", color: "#2F855A", createdById: ict.id,
      description: "Public Service Application for Leave (Second Schedule, s.34): vacation, sick, annual, special, without pay, urgent private affairs. Recommended by the supervisor, approved by the Head of Department, recorded by Registry.",
      fields: j([
        { key: "employeeCode", label: "Employee code number", type: "text", required: true, width: "third", helpText: "If the E.C. number or check digit is incorrect the form is rejected." },
        { key: "checkDigit", label: "Check digit", type: "text", required: true, width: "third" },
        { key: "station", label: "Station", type: "text", required: true, width: "third", defaultValue: "Town House, Zengeza" },
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
        { id: "v2", order: 2, name: "Approved — Head of Department / Office", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 72, allowDelegate: true, allowReturn: true, skipIfRequester: true, fallbackUserId: hrHead.id },
        { id: "v3", order: 3, name: "Recorded and filed — Registry / HR", description: "Record the leave, update the leave register and file the form.", approverType: "DEPARTMENT", departmentId: hr.id, minRole: "MEMBER", mode: "ANY", slaHours: 72, allowDelegate: false, allowReturn: false },
      ]),
      settings: j({ titleTemplate: "{{leaveType}} leave: {{daysRequired}} days", allowAttachments: true, allowRequesterCancel: true, costField: "none" }),
    },
  });

  // 4. Application for Annual Leave (off days)
  const annual = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "Application for Annual Leave (off days)", category: "LEAVE", prefix: "AL", icon: "leave", color: "#F0A020", createdById: ict.id,
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
      orgId: org.id, name: "Internal memo", category: "MEMO", prefix: "MEMO", icon: "memo", color: "#722ed1", createdById: ict.id,
      description: "Circulate an internal memo for approval by the Head of Department, and by the Town Clerk when marked for the Directorate.",
      fields: j([
        { key: "to", label: "To", type: "text", required: true, width: "half" },
        { key: "subject", label: "Subject", type: "text", required: true, width: "half" },
        { key: "body", label: "Memo", type: "richtext", required: true, width: "full" },
        { key: "forDirectorate", label: "Requires Town Clerk's approval", type: "checkbox", width: "half" },
      ]),
      levels: j([
        { id: "m1", order: 1, name: "Head of Department", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 48, allowDelegate: true, allowReturn: true, skipIfRequester: true, fallbackUserId: dg.id },
        { id: "m2", order: 2, name: "Town Clerk", approverType: "USER", approverUserIds: [dg.id], mode: "ANY", slaHours: 72, allowDelegate: true, allowReturn: true, condition: { field: "forDirectorate", op: "eq", value: true } },
      ]),
      settings: j({ titleTemplate: "Memo: {{subject}}", allowAttachments: true, costField: "none" }),
    },
  });

  // 6. Vehicle request (fleet): approved requests become trip bookings for the transport office
  const vehicleReq = await prisma.workflowTemplate.create({
    data: {
      orgId: org.id, name: "Vehicle request", category: "OTHER", prefix: "VR", icon: "vehicle", color: "#0e7490", createdById: ict.id,
      description: "Request an Council vehicle for official travel. Approved by the Head of Department, then the transport office assigns a vehicle and driver on the Fleet page.",
      fields: j([
        { key: "destination", label: "Destination", type: "text", required: true, width: "half" },
        { key: "dates", label: "Travel dates (from – to)", type: "daterange", required: true, width: "half" },
        { key: "purpose", label: "Purpose of travel", type: "textarea", required: true, width: "full" },
        { key: "passengers", label: "Number of passengers (incl. driver)", type: "number", required: true, min: 1, max: 60, width: "half" },
        { key: "needsDriver", label: "Driver required", type: "checkbox", width: "half" },
        { key: "equipment", label: "Equipment / load to carry", type: "text", width: "full" },
      ]),
      levels: j([
        { id: "v1", order: 1, name: "Approved — Head of Department", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 24, allowDelegate: true, allowReturn: true, skipIfRequester: true, fallbackUserId: dg.id },
        { id: "v2", order: 2, name: "Vehicle availability confirmed — Administration (transport)", description: "Confirm a vehicle can be made available; the booking is created automatically on approval.", approverType: "DEPARTMENT", departmentId: hr.id, minRole: "MEMBER", mode: "ANY", slaHours: 24, allowDelegate: false, allowReturn: true },
      ]),
      settings: j({ titleTemplate: "Vehicle: {{destination}}", allowAttachments: true, allowRequesterCancel: true, costField: "none", requireProject: false, createsTrip: true }),
    },
  });

  // --- Sample history so the dashboard is not empty ---
  const snap = async (t: { id: string }) => {
    const x = await prisma.workflowTemplate.findUnique({ where: { id: t.id } });
    return j({ name: x!.name, category: x!.category, fields: JSON.parse(x!.fields), levels: JSON.parse(x!.levels), settings: JSON.parse(x!.settings), version: 1 });
  };
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);
  const year = new Date().getFullYear();

  // Approved T&S advance (Ministry of Local Government devolution reporting workshop, Harare)
  const breakdown = [
    { item: "Bed & Breakfast", unit: "Nights", number: 8, rate: 70, total: 560 },
    { item: "Supplementary", unit: "Days", number: 8, rate: 20, total: 160 },
    { item: "Lunch", unit: "Days", number: 2, rate: 15, total: 30 },
    { item: "Dinner", unit: "Days", number: 8, rate: 15, total: 120 },
  ];
  const r1 = await prisma.request.create({
    data: {
      orgId: org.id, templateId: tsAdvance.id, referenceNo: `TSA-${year}-0001`, title: "T&S advance: Harare", requesterId: officer1.id, status: "APPROVED", priority: "NORMAL",
      projectId: zdhs.id, costAmount: 870, currentLevel: 4, activeLevels: j([1, 2, 3, 4]), templateSnapshot: await snap(tsAdvance), submittedAt: hoursAgo(200), completedAt: hoursAgo(120), createdAt: hoursAgo(201),
      data: j({ ecNumber: "0000000X", salaryGrade: "D3", section: ictSec.id, destination: "Harare", period: ["2025-03-20", "2025-03-27"], purpose: "Ministry of Local Government devolution reporting workshop", costBorneBy: "Devolution funds", breakdown, breakdownTotal: 870, declaration: true, priority: "NORMAL" }),
    },
  });
  for (const [lvl, name, who, h, comment] of [
    [1, "Recommended by Head of Department", ictHead.id, 190, "Recommended."],
    [2, "Finance Department certification", cashier.id, 170, "Advance account balance: USD 0.00. Certified."],
    [3, "Advance approval — Town Clerk / Head of Department", dg.id, 150, "Approved."],
    [4, "Disbursement by Finance", cashier.id, 120, "Paid by EFT, ref ADV-0391."],
  ] as const) {
    await prisma.requestApproval.create({ data: { requestId: r1.id, levelOrder: lvl, levelName: name, approverId: who, status: "APPROVED", comment, actedAt: hoursAgo(h), createdAt: hoursAgo(h + 5) } });
  }

  // Pending T&S claim at Accounts (ZINWA meeting)
  const itinerary = [
    { date: "2025-10-20", route: "Chitungwiza – Harare", days: 1, breakfast: 0, lunch: 25, dinner: 75, supplementary: 3, total: 103, accommodationType: "GVT" },
    { date: "2025-10-21", route: "Marondera", days: 1, breakfast: 20, lunch: 25, dinner: 75, supplementary: 3, total: 123, accommodationType: "GVT" },
    { date: "2025-10-22", route: "Marondera", days: 1, breakfast: 20, lunch: 25, dinner: 75, supplementary: 3, total: 123, accommodationType: "Private" },
    { date: "2025-10-23", route: "Harare – Chitungwiza", days: 1, breakfast: 20, lunch: 0, dinner: 0, supplementary: 3, total: 23, accommodationType: "Private" },
  ];
  const r2 = await prisma.request.create({
    data: {
      orgId: org.id, templateId: tsClaim.id, referenceNo: `TSC-${year}-0001`, title: "T&S claim: ZINWA bulk water meeting, Marondera", requesterId: officer2.id, status: "PENDING", priority: "NORMAL",
      projectId: mics.id, costAmount: 372, currentLevel: 2, activeLevels: j([1, 2, 3, 4]), templateSnapshot: await snap(tsClaim), submittedAt: hoursAgo(40), createdAt: hoursAgo(41), dueAt: new Date(Date.now() + 10 * 86400000),
      data: j({ ecNumber: "0000001Y", cellPhone: "0770 000 000", physicalAddress: "12 Example Road, Zengeza 4", stationedAt: "Town House", period: ["2025-10-20", "2025-10-23"], campingEquipment: "Not been with camping equipment", fundedBy: "Rates & levies (recurrent)", itinerary, itineraryTotal: 372, purpose: "MICS supervision. Travel by Council vehicle. Government and private accommodation.", ownVehicle: false, advances: [], advancesTotal: 0, certify: true, priority: "NORMAL" }),
    },
  });
  await prisma.requestApproval.create({ data: { requestId: r2.id, levelOrder: 1, levelName: "Certified correct — Supervisor / Team Leader", approverId: supervisor.id, status: "APPROVED", comment: "Journeys undertaken as stated.", actedAt: hoursAgo(30), createdAt: hoursAgo(40) } });
  for (const who of [dirFinance.id, accountant.id, cashier.id]) {
    await prisma.requestApproval.create({ data: { requestId: r2.id, levelOrder: 2, levelName: "Checked / certified not previously paid — Accounts", approverId: who, status: "PENDING", dueAt: new Date(Date.now() + 42 * 3600000), createdAt: hoursAgo(30) } });
    await prisma.notification.create({ data: { orgId: org.id, userId: who, title: `Approval needed: TSC-${year}-0001`, body: "T&S claim: ZINWA bulk water meeting is waiting for Accounts (checked / not previously paid).", link: `/app/requests/${r2.id}`, type: "APPROVAL" } });
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
      data: j({ employeeCode: "0000001", checkDigit: "7", station: "Town House, Zengeza", leaveType: "Vacation", dates: [`${year}-12-15`, `${year}-12-26`], daysRequired: 10, advanceOfSalary: false, vacatingAccommodation: false, notes: "Contactable on cell.", priority: "NORMAL" }),
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
      { orgId: org.id, userId: ict.id, action: "org.created", entityType: "Organization", entityId: org.id, meta: j({ slug: "chitungwiza" }) },
      { orgId: org.id, userId: ict.id, action: "template.created", entityType: "WorkflowTemplate", entityId: tsAdvance.id, meta: j({ name: "T&S Advance Application" }) },
      { orgId: org.id, userId: ict.id, action: "template.created", entityType: "WorkflowTemplate", entityId: tsClaim.id, meta: j({ name: "T&S Expense Claim" }) },
    ],
  });

  // --- Service desk: categories with SLAs and a few cases ---
  const cat = (name: string, departmentId: string, defaultSlaHours: number, defaultPriority: string, icon: string, description: string, isPublic = true) =>
    prisma.caseCategory.create({ data: { orgId: org.id, name, departmentId, defaultSlaHours, defaultPriority, icon, description, isPublic } });
  const catData = await cat("Water & sewer fault", surveys.id, 24, "HIGH", "building", "Burst pipes, no water, sewer blockages and overflows.");
  const catPublication = await cat("Roads & street lighting", surveys.id, 72, "MEDIUM", "vehicle", "Potholes, storm drains, street lights and road signs.");
  const catRefuse = await cat("Refuse collection", health.id, 48, "MEDIUM", "cart", "Missed collections, illegal dumping and bin requests.");
  const catLicence = await cat("Licensing & permits query", health.id, 72, "LOW", "document", "Questions about shop, liquor, hawker and building licences.");
  const catIct = await cat("ICT support", ictSec.id, 24, "HIGH", "laptop", "Email, network, laptop, printer, system access.", false);
  const catSystem = await cat("System access / password", ictSec.id, 8, "HIGH", "lock", "Account creation, password reset, access to applications.", false);
  const catFacilities = await cat("Facilities & office maintenance", hr.id, 72, "MEDIUM", "building", "Lifts, lights, plumbing, furniture, office equipment.", false);
  const catComplaint = await cat("Complaint about service", directorate.id, 48, "HIGH", "megaphone", "Complaints about a council service, officer or contractor.");
  const catPayment = await cat("Rates & billing query", finance.id, 72, "MEDIUM", "payment", "Rates statements, payment plans, receipts and refunds.");

  const mkCase = async (d: { ref: string; title: string; description: string; category: { id: string; departmentId: string; defaultSlaHours: number }; status: string; priority: string; assigneeId?: string | null; reporterName: string; reporterPhone?: string; reporterEmail?: string; reporterUserId?: string | null; source: string; location?: string; office?: string; ageHours: number; resolvedHoursAgo?: number; projectId?: string | null }) => {
    const created = hoursAgo(d.ageHours);
    const c = await prisma.case.create({
      data: {
        orgId: org.id, referenceNo: d.ref, title: d.title, description: d.description, status: d.status, priority: d.priority, departmentId: d.category.departmentId, categoryId: d.category.id,
        assigneeId: d.assigneeId ?? null, projectId: d.projectId ?? null, reporterName: d.reporterName, reporterPhone: d.reporterPhone, reporterEmail: d.reporterEmail, reporterUserId: d.reporterUserId ?? null, source: d.source,
        locationAddress: d.location, office: d.office, slaHours: d.category.defaultSlaHours, slaDueAt: new Date(created.getTime() + d.category.defaultSlaHours * 3600000), createdAt: created, lastActivityAt: created,
        resolvedAt: d.resolvedHoursAgo !== undefined ? hoursAgo(d.resolvedHoursAgo) : null,
        events: { create: [{ fromStatus: null, toStatus: d.assigneeId ? "ASSIGNED" : "TRIAGED", changedByName: d.reporterUserId ? d.reporterName : `${d.reporterName} (reporter)`, reason: `Logged via ${d.source.toLowerCase().replace("_", " ")}`, createdAt: created }] },
      },
    });
    return c;
  };
  const c1 = await mkCase({ ref: `CMC-${year}-0001`, title: "Burst water pipe flooding Seke Road", description: "Water has been running down Seke Road since 05:00 near stand 1120, Zengeza 4; the road is becoming impassable.", category: catData, status: "IN_PROGRESS", priority: "MEDIUM", assigneeId: officer2.id, reporterName: "Tinashe Researcher", reporterPhone: "0771 000 111", reporterEmail: "tinashe@example.org", source: "PUBLIC", location: "Seke Road, St Mary's", ageHours: 30 });
  await prisma.caseEvent.create({ data: { caseId: c1.id, fromStatus: "ASSIGNED", toStatus: "IN_PROGRESS", changedById: officer2.id, changedByName: officer2.name, reason: "Works team dispatched", createdAt: hoursAgo(20) } });
  await prisma.caseComment.create({ data: { caseId: c1.id, userId: officer2.id, authorName: officer2.name, body: "A works team has isolated the valve; the pipe will be replaced today and the road reinstated by Friday.", isInternal: false, createdAt: hoursAgo(20) } });
  const c2 = await mkCase({ ref: `CMC-${year}-0002`, title: "Laptop will not connect to the office Wi-Fi", description: "Since Monday morning the Dell Latitude cannot see CHIT-STAFF. Other devices connect fine.", category: catIct, status: "ASSIGNED", priority: "HIGH", assigneeId: officer1.id, reporterName: "Pamela Officer", reporterEmail: "p.officer@chitungwiza.co.zw", reporterUserId: officer2.id, source: "STAFF", office: "Town House, Engineering wing", ageHours: 28 });
  await mkCase({ ref: `CMC-${year}-0003`, title: "Password reset for the HR system", description: "Locked out after three attempts.", category: catSystem, status: "RESOLVED", priority: "HIGH", assigneeId: officer1.id, reporterName: "Blessing Sibanda", reporterEmail: "registry@chitungwiza.co.zw", reporterUserId: registry.id, source: "STAFF", ageHours: 50, resolvedHoursAgo: 47 });
  await mkCase({ ref: `CMC-${year}-0004`, title: "Town House borehole pump not running", description: "The borehole feeding the Town House tanks has not pumped since yesterday afternoon; the tanks are nearly empty.", category: catFacilities, status: "TRIAGED", priority: "MEDIUM", reporterName: "Kudzai Mhlanga", reporterEmail: "ict.head@chitungwiza.co.zw", reporterUserId: ictHead.id, source: "WALK_IN", location: "Town House, Zengeza", ageHours: 80 });
  await mkCase({ ref: `CMC-${year}-0005`, title: "Refuse not collected for three weeks, Zengeza 4 ward 6", description: "Residents of Mukarati Close report no collection for three weeks; bins are overflowing and dumping has started on the open stand.", category: catRefuse, status: "ASSIGNED", priority: "HIGH", assigneeId: supervisor.id, reporterName: "Rutendo Resident", reporterPhone: "0773 222 333", source: "PHONE", location: "Zengeza 4, Ward 6", ageHours: 6, projectId: mics.id });
  void catPublication; void catPayment; void catLicence;

  // --- Advances ledger: the approved TSA opened an advance that is now overdue (travel ended months ago, no claim yet) ---
  const adv1 = await prisma.advance.create({
    data: { orgId: org.id, userId: officer1.id, requestId: r1.id, referenceNo: `TSA-${year}-0001`, amount: 870, clearedAmount: 0, currency: "USD", status: "OPEN", disbursedAt: hoursAgo(120), travelEndsAt: new Date("2025-03-27"), dueAt: new Date("2025-04-06"), notes: "Paid by EFT, ref ADV-0391." },
  });
  await prisma.notification.create({ data: { orgId: org.id, userId: officer1.id, title: `Advance TSA-${year}-0001 is overdue`, body: "USD 870.00 outstanding. Submit the T&S Expense Claim with receipts, or the amount is recovered from salary.", link: "/app/advances", type: "WARNING" } });
  void adv1;

  // --- Notice board ---
  const notice = (data: { title: string; body: string; kind: string; requiresAck?: boolean; pinned?: boolean; departmentIds?: string[]; hoursOld: number }) =>
    prisma.notice.create({ data: { orgId: org.id, title: data.title, body: data.body, kind: data.kind, requiresAck: !!data.requiresAck, pinned: !!data.pinned, departmentIds: j(data.departmentIds || []), roles: j([]), publishedAt: hoursAgo(data.hoursOld), createdAt: hoursAgo(data.hoursOld), createdById: data.kind === "POLICY" ? dirFinance.id : dg.id } });
  const n1 = await notice({ kind: "CIRCULAR", pinned: true, requiresAck: true, hoursOld: 72, title: `Circular 3/${year}: Clearance of T&S advances within 10 days`, body: "All officers are reminded that Travelling and Subsistence advances must be cleared within ten (10) working days of return from duty, by submitting the T&S Expense Claim form with original receipts to the Finance Department.\n\nWith effect from 1 November, outstanding advances older than 30 days will be recovered from salary in terms of Treasury Instruction 1206, and no further advance will be approved for an officer with an uncleared account.\n\nHeads of Section are requested to ensure compliance within their sections.\n\nTown Clerk" });
  await notice({ kind: "POLICY", requiresAck: true, hoursOld: 240, title: "ICT Acceptable Use and Equipment Policy (rev. 2)", body: "1. Council laptops, tablets and GPS devices are issued to named officers and recorded in the asset register. The officer is responsible for the equipment until it is returned to the ICT store.\n2. Loss or damage must be reported through the service desk within 24 hours.\n3. Personal software and unlicensed media may not be installed on Agency devices.\n4. Survey data must be synchronised to the Council server daily and never stored on personal devices.\n\nPlease acknowledge that you have read and understood this policy." });
  await notice({ kind: "ANNOUNCEMENT", hoursOld: 20, title: "Works teams: vehicle allocation for Monday's road patching deployment", body: "Field teams deploying on Monday will collect allocated vehicles from the Town House car park from 07:00. Team leaders must sign the trip log and record the odometer reading before departure. Fuel cards are issued by the Administration office.", departmentIds: [surveys.id] });
  await notice({ kind: "MEMO", hoursOld: 6, title: "Half-day closure: Friday staff wellness programme", body: "Town House will close at 12:30 on Friday for the staff wellness programme at the sports club. Essential services (service desk, cashier) remain on duty until 14:00." });
  await prisma.noticeAck.createMany({ data: [{ noticeId: n1.id, userId: ictHead.id, ackAt: hoursAgo(60) }, { noticeId: n1.id, userId: officer2.id, ackAt: hoursAgo(40) }, { noticeId: n1.id, userId: cashier.id, ackAt: hoursAgo(70) }] });

  // --- Asset register ---
  const asset = async (data: { tag: string; category: string; make: string; model: string; serial: string; status?: string; assignedToId?: string; departmentId: string; location?: string; purchaseDate: string; purchaseCost: number; warrantyUntil?: string; notes?: string }) =>
    prisma.asset.create({ data: { orgId: org.id, tag: data.tag, category: data.category, make: data.make, model: data.model, serial: data.serial, status: data.status || (data.assignedToId ? "ISSUED" : "IN_STORE"), assignedToId: data.assignedToId || null, departmentId: data.departmentId, location: data.location, purchaseDate: new Date(data.purchaseDate), purchaseCost: data.purchaseCost, warrantyUntil: data.warrantyUntil ? new Date(data.warrantyUntil) : null, notes: data.notes,
      events: { create: [{ kind: "CREATED", actorId: ict.id, note: "Added to the register", createdAt: hoursAgo(2000) }, ...(data.assignedToId ? [{ kind: "ISSUED", actorId: ict.id, toUserId: data.assignedToId, note: "Issued with charger and bag", createdAt: hoursAgo(1900) }] : []), ...(data.status === "IN_REPAIR" ? [{ kind: "REPAIR", actorId: officer1.id, note: "Wi-Fi adapter fault; sent to supplier under warranty", createdAt: hoursAgo(26) }] : [])] } } });
  const a1 = await asset({ tag: "CMC/ICT/0041", category: "Laptop", make: "Dell", model: "Latitude 5540", serial: "7KQ2P93", assignedToId: officer2.id, departmentId: surveys.id, location: "Town House, Engineering wing", purchaseDate: "2024-08-12", purchaseCost: 1450, warrantyUntil: `${year + 1}-08-12`, status: "IN_REPAIR" });
  await asset({ tag: "CMC/ICT/0042", category: "Laptop", make: "HP", model: "ProBook 450 G9", serial: "5CD3281XYZ", assignedToId: officer1.id, departmentId: ictSec.id, location: "Town House, ICT office", purchaseDate: "2024-08-12", purchaseCost: 1320, warrantyUntil: `${year + 1}-08-12` });
  await asset({ tag: "CMC/ICT/0043", category: "Laptop", make: "HP", model: "ProBook 450 G9", serial: "5CD3281ABC", departmentId: ictSec.id, location: "ICT store", purchaseDate: "2024-08-12", purchaseCost: 1320, warrantyUntil: `${year + 1}-08-12`, notes: "Spare for field deployments." });
  for (let i = 1; i <= 4; i++) await asset({ tag: `CMC/ENG/GPS-${String(i).padStart(2, "0")}`, category: "GPS / PDA", make: "Garmin", model: "eTrex 32x", serial: `GRM32X-${1000 + i}`, assignedToId: i <= 2 ? supervisor.id : undefined, departmentId: surveys.id, location: i <= 2 ? "Field (MICS)" : "Surveys store", purchaseDate: "2023-03-01", purchaseCost: 310 });
  await asset({ tag: "CMC/ICT/PRN-07", category: "Printer", make: "Kyocera", model: "ECOSYS M3655idn", serial: "VKY7342201", departmentId: finance.id, location: "Finance Department, Room 214", purchaseDate: "2022-11-20", purchaseCost: 980, status: "IN_STORE" });
  await asset({ tag: "CMC/ICT/TAB-115", category: "Tablet", make: "Samsung", model: "Galaxy Tab A9", serial: "R52W40ABCDE", assignedToId: officer2.id, departmentId: surveys.id, location: "Field (water works)", purchaseDate: `${year}-01-15`, purchaseCost: 240, warrantyUntil: `${year + 1}-01-15` });
  await prisma.case.update({ where: { id: c2.id }, data: { assetId: a1.id } });

  // --- Fleet ---
  const vehicle = (registration: string, make: string, model: string, type: string, odometer: number, status = "AVAILABLE", departmentId?: string, notes?: string) =>
    prisma.vehicle.create({ data: { orgId: org.id, registration, make, model, type, odometer, status, departmentId: departmentId || null, notes } });
  const v1 = await vehicle("AEE 4471", "Toyota", "Hilux 2.8 GD-6", "Double cab", 84210, "AVAILABLE", surveys.id);
  const v2 = await vehicle("AEE 4472", "Toyota", "Hilux 2.8 GD-6", "Double cab", 91530, "AVAILABLE", surveys.id);
  const v3 = await vehicle("AEE 3310", "Toyota", "Land Cruiser 79", "SUV / 4x4", 143880, "MAINTENANCE", undefined, "Clutch replacement at the council workshop, due back Thursday.");
  const v4 = await vehicle("AEE 2208", "Nissan", "NP300 Hardbody", "Single cab", 167400, "AVAILABLE", hr.id, "Town House runner.");
  void v3; void v4;
  const d = (days: number, hour = 7) => { const x = new Date(); x.setDate(x.getDate() + days); x.setHours(hour, 0, 0, 0); return x; };
  // approved vehicle request → trip waiting for assignment
  const r5 = await prisma.request.create({
    data: {
      orgId: org.id, templateId: vehicleReq.id, referenceNo: `VR-${year}-0001`, title: "Vehicle: Seke Unit L and St Mary's (sewer inspection)", requesterId: officer2.id, status: "APPROVED", priority: "NORMAL",
      projectId: mics.id, currentLevel: 2, activeLevels: j([1, 2]), templateSnapshot: await snap(vehicleReq), submittedAt: hoursAgo(30), completedAt: hoursAgo(4), createdAt: hoursAgo(31),
      data: j({ destination: "Seke Unit L and St Mary's", dates: [d(3).toISOString().slice(0, 10), d(6).toISOString().slice(0, 10)], purpose: "Sewer line inspection, Seke Unit L and St Mary's.", passengers: 4, needsDriver: true, equipment: "4 tablets, 2 GPS units, camping kit", priority: "NORMAL" }),
    },
  });
  await prisma.requestApproval.create({ data: { requestId: r5.id, levelOrder: 1, levelName: "Approved — Head of Department", approverId: surveysHead.id, status: "APPROVED", comment: "Approved.", actedAt: hoursAgo(20), createdAt: hoursAgo(30) } });
  await prisma.requestApproval.create({ data: { requestId: r5.id, levelOrder: 2, levelName: "Vehicle availability confirmed — Administration (transport)", approverId: registry.id, status: "APPROVED", comment: "Hilux available.", actedAt: hoursAgo(4), createdAt: hoursAgo(20) } });
  await prisma.vehicleTrip.create({ data: { orgId: org.id, requestId: r5.id, requesterId: officer2.id, projectId: mics.id, purpose: "Sewer line inspection, Seke Unit L and St Mary's.", destination: "Seke Unit L and St Mary's", passengers: 4, startsAt: d(3), endsAt: d(6, 18), status: "PLANNED" } });
  await prisma.notification.create({ data: { orgId: org.id, userId: hrHead.id, title: `Vehicle needed: VR-${year}-0001`, body: "Seke Unit L and St Mary's, 4 passengers. Assign a vehicle and driver.", link: "/app/fleet", type: "APPROVAL" } });
  // assigned trip tomorrow and a completed trip last week
  await prisma.vehicleTrip.create({ data: { orgId: org.id, requesterId: officer1.id, driverUserId: registry.id, vehicleId: v1.id, projectId: zdhs.id, purpose: "Road condition survey, wards 7–9", destination: "Harare", passengers: 3, startsAt: d(1), endsAt: d(1, 18), status: "ASSIGNED" } });
  await prisma.vehicleTrip.create({ data: { orgId: org.id, requesterId: supervisor.id, driverUserId: supervisor.id, vehicleId: v2.id, projectId: mics.id, purpose: "Sewer blockage repair, St Mary's", destination: "St Mary's", passengers: 4, startsAt: d(-6), endsAt: d(-4, 17), status: "COMPLETED", odometerStart: 91010, odometerEnd: 91530, fuelLitres: 58.5, notes: "Rear left tyre slow puncture; repaired in Chegutu." } });
  await prisma.workflowTemplate.update({ where: { id: vehicleReq.id }, data: { counter: 1 } });


  // --- Licensing: the council's licence schedule and a register with every stage represented ---
  const lt = (code: string, name: string, category: string, fee: number, validityMonths: number, requiresInspection: boolean, departmentId: string, requirements: string[], description: string) =>
    prisma.licenceType.create({ data: { orgId: org.id, code, name, category, fee, currency: "USD", validityMonths, requiresInspection, departmentId, requirements, description } });
  const ID_DOCS = ["Certified copy of national ID or company registration (CR14)", "Proof of stand ownership or signed lease", "Passport photo of applicant"];
  const ltShop = await lt("SHP", "Shop licence", "Trading", 150, 12, true, health.id, [...ID_DOCS, "ZIMRA tax clearance (ITF 263)", "Health inspection report"], "General dealer, grocery, hardware, clothing and other retail premises. Renewable annually.");
  const ltLiquor = await lt("LIQ", "Liquor licence (bottle store / bar)", "Liquor", 400, 12, true, health.id, [...ID_DOCS, "Police clearance", "Liquor Licensing Board approval", "Fire certificate"], "Sale of liquor for consumption on or off the premises, subject to the Liquor Act and council by-laws.");
  const ltHawker = await lt("HWK", "Hawker / vendor permit", "Hawkers & markets", 25, 6, false, health.id, ["Copy of national ID", "Passport photo", "Medical certificate (food vendors)"], "Street vending and market stalls at designated sites. Six-month permit.");
  const ltFood = await lt("FHP", "Food handling / restaurant certificate", "Health & food", 120, 12, true, health.id, [...ID_DOCS, "Medical certificates for all food handlers", "Pest control contract"], "Restaurants, takeaways, butcheries, bakeries and tuckshops preparing or selling food.");
  const ltBuild = await lt("BLD", "Building plan approval", "Building & planning", 250, 24, true, surveys.id, ["Three sets of building plans signed by a registered draughtsman", "Title deed or offer letter", "Structural engineer's certificate (double storey)", "Rates clearance"], "Approval of residential and commercial building plans; valid for 24 months from approval.");
  const ltKombi = await lt("TPT", "Commuter omnibus rank permit", "Transport", 180, 12, false, hr.id, ["Vehicle registration book", "Route authority (Ministry of Transport)", "Certificate of fitness", "Driver's defensive driving certificate"], "Use of council ranks by commuter omnibuses on approved routes.");
  const ltBill = await lt("ADV", "Billboard / signage permit", "Land & property", 300, 12, true, surveys.id, ["Site plan and artwork", "Structural certificate for free-standing boards", "Landowner consent"], "Advertising boards, shop signs and banners on or visible from public land.");
  const ltCreche = await lt("ECD", "Crèche / early childhood centre registration", "Health & food", 100, 12, true, health.id, [...ID_DOCS, "Ministry of Primary & Secondary Education registration", "Fire certificate", "Police clearance for staff"], "Registration of crèches and ECD centres; annual health and safety inspection.");
  void ltKombi; void ltBill; void ltCreche;
  await applyLicenceForms(org.id); // paper forms: Shop Licence Act, Registration of Premises, General Application

  type LicSeed = { ref: number; type: { id: string; fee: unknown; validityMonths: number }; status: string; applicant: string; trading?: string; idNo?: string; phone: string; stand: string; address: string; ward: string; activity: string; priority?: string; officerId?: string; inspectorId?: string; docsReceived?: number; docsTotal?: number; ageDays: number; issuedDaysAgo?: number; validityMonths?: number; paid?: boolean; receipt?: string; outcome?: string; conditions?: string; decision?: string; licenceNo?: string; source?: string };
  const mkLic = async (d: LicSeed) => {
    const created = new Date(Date.now() - d.ageDays * 86400000);
    const reqs = ((await prisma.licenceType.findUnique({ where: { id: d.type.id } }))!.requirements as string[]) || [];
    const docs = reqs.map((name, i) => ({ name, received: i < (d.docsReceived ?? reqs.length) }));
    const issuedAt = d.issuedDaysAgo !== undefined ? new Date(Date.now() - d.issuedDaysAgo * 86400000) : null;
    const expiresAt = issuedAt ? new Date(new Date(issuedAt).setMonth(issuedAt.getMonth() + (d.validityMonths ?? d.type.validityMonths))) : null;
    const events: { kind: string; fromStatus?: string | null; toStatus?: string | null; actorId?: string | null; note?: string | null; createdAt: Date }[] = [{ kind: "SUBMITTED", toStatus: "SUBMITTED", actorId: d.source ? null : d.officerId || licensing.id, note: d.source === "WHATSAPP" ? "Applied via WhatsApp" : d.source === "PUBLIC" ? "Applied on the public portal" : "Application received", createdAt: created }];
    const step = (kind: string, from: string, to: string | null, daysAfter: number, note: string, actorId: string | null = d.officerId || licensing.id) => events.push({ kind, fromStatus: from, toStatus: to, actorId, note, createdAt: new Date(created.getTime() + daysAfter * 86400000) });
    if (!["SUBMITTED", "CANCELLED"].includes(d.status)) step("REVIEW", "SUBMITTED", "UNDER_REVIEW", 1, "Documents checked");
    if (d.inspectorId && d.status !== "UNDER_REVIEW") step("INSPECTION_SCHEDULED", "UNDER_REVIEW", "INSPECTION", 2, `Inspection by ${(await prisma.user.findUnique({ where: { id: d.inspectorId } }))!.name}`);
    if (d.outcome) step("INSPECTED", "INSPECTION", "UNDER_REVIEW", 4, d.outcome === "PASS" ? "Inspection passed" : d.outcome === "FAIL" ? "Inspection failed: no fire extinguishers, storage area unhygienic" : `Inspection passed with conditions: ${d.conditions}`, d.inspectorId);
    if (["APPROVED", "ISSUED", "EXPIRED", "SUSPENDED", "REVOKED"].includes(d.status)) step("APPROVED", "UNDER_REVIEW", "APPROVED", 5, d.decision || "Approved subject to payment of the prescribed fee", healthHead.id);
    if (d.status === "REJECTED") step("REJECTED", "UNDER_REVIEW", "REJECTED", 5, d.decision || "Rejected", healthHead.id);
    if (d.paid) step("PAID", "APPROVED", null, 6, `Receipt ${d.receipt}`, cashier.id);
    if (["ISSUED", "EXPIRED", "SUSPENDED", "REVOKED"].includes(d.status)) step("ISSUED", "APPROVED", "ISSUED", 7, `Licence ${d.licenceNo} valid to ${expiresAt!.toISOString().slice(0, 10)}`, healthHead.id);
    if (d.status === "EXPIRED") step("EXPIRED", "ISSUED", "EXPIRED", d.ageDays - 2, "Validity period ended", null);
    if (d.status === "SUSPENDED") step("SUSPENDED", "ISSUED", "SUSPENDED", d.ageDays - 5, d.decision || "Suspended pending compliance", healthHead.id);
    if (d.status === "REVOKED") step("REVOKED", "ISSUED", "REVOKED", d.ageDays - 5, d.decision || "Revoked", healthHead.id);
    const paidAt = d.paid ? new Date(created.getTime() + 6 * 86400000) : null;
    return prisma.licence.create({ data: {
      orgId: org.id, typeId: d.type.id, referenceNo: `LA-${year}-${String(d.ref).padStart(4, "0")}`, licenceNo: d.licenceNo || null, status: d.status, source: d.source || "STAFF", applicantName: d.applicant, tradingName: d.trading || null, idNumber: d.idNo || null, phone: d.phone, email: null,
      standNumber: d.stand, address: d.address, ward: d.ward, activity: d.activity, priority: d.priority || "MEDIUM", feeAmount: d.type.fee as number, currency: "USD", paidAt, receiptNo: d.paid ? d.receipt : null, officerId: d.officerId || licensing.id,
      inspectorId: d.inspectorId || null, inspectionDue: d.inspectorId && !d.outcome ? new Date(created.getTime() + 7 * 86400000) : null, inspectedAt: d.outcome ? new Date(created.getTime() + 4 * 86400000) : null, inspectionOutcome: d.outcome || null,
      inspectionNotes: d.outcome === "FAIL" ? "No fire extinguishers; storage area unhygienic; re-inspect after remedial work." : null, conditions: d.conditions || null, decisionNote: d.decision || null,
      issuedAt: issuedAt, expiresAt, documents: docs, submittedAt: created, createdAt: created, updatedAt: new Date(created.getTime() + Math.min(d.ageDays, 7) * 86400000),
      events: { create: events },
    } });
  };
  const lic1 = await mkLic({ ref: 1, type: ltShop, status: "ISSUED", applicant: "Memory Chikomo", trading: "Zengeza Fresh Grocers", idNo: "63-1234567A42", phone: "0772 100 200", stand: "1120 Zengeza 4", address: "Shop 3, Zengeza 4 shopping centre", ward: "6", activity: "Retail of groceries and household goods; 3 employees; trading 06:30–20:00", officerId: licensing.id, inspectorId: inspector.id, outcome: "PASS", paid: true, receipt: "RC-004412", ageDays: 320, issuedDaysAgo: 313, licenceNo: `CMC/SHP/${year - 1}/0041` });
  await mkLic({ ref: 2, type: ltLiquor, status: "ISSUED", applicant: "Tonderai Mupfumi", trading: "Mupfumi Bottle Store", idNo: "63-2234567B42", phone: "0712 300 400", stand: "88 Seke Road", address: "88 Seke Road, St Mary's", ward: "3", activity: "Off-premises liquor sales; no consumption on site; 10:00–22:00", priority: "HIGH", officerId: licensing.id, inspectorId: inspector.id, outcome: "CONDITIONAL", conditions: "No sale to persons under 18; music below 65 dB after 21:00; CCTV at the counter", paid: true, receipt: "RC-004420", ageDays: 350, issuedDaysAgo: 343, licenceNo: `CMC/LIQ/${year - 1}/0012` });
  await mkLic({ ref: 3, type: ltFood, status: "ISSUED", applicant: "Chiedza Nyoni", trading: "Nyoni's Kitchen", phone: "0778 555 111", stand: "14 St Mary's Business Centre", address: "St Mary's shops", ward: "9", activity: "Takeaway and sit-down meals; 6 food handlers", officerId: licensing.id, inspectorId: inspector.id, outcome: "PASS", paid: true, receipt: "RC-004431", ageDays: 200, issuedDaysAgo: 193, licenceNo: `CMC/FHP/${year}/0007` });
  await mkLic({ ref: 4, type: ltHawker, status: "EXPIRED", applicant: "Josephine Dzvairo", phone: "0773 222 333", stand: "Chikwanha rank market, bay 17", address: "Chikwanha rank market", ward: "1", activity: "Fruit and vegetable vending", officerId: licensing.id, paid: true, receipt: "RC-003988", ageDays: 240, issuedDaysAgo: 233, validityMonths: 6, licenceNo: `CMC/HWK/${year - 1}/0203` });
  await mkLic({ ref: 5, type: ltShop, status: "SUSPENDED", applicant: "Peter Gwaze", trading: "Gwaze Hardware", idNo: "63-3334567C42", phone: "0774 444 555", stand: "202 Seke Unit L", address: "Seke Unit L shopping centre, unit 2", ward: "8", activity: "Hardware and building materials retail", priority: "HIGH", officerId: licensing.id, inspectorId: inspector.id, outcome: "PASS", paid: true, receipt: "RC-004102", ageDays: 280, issuedDaysAgo: 273, licenceNo: `CMC/SHP/${year - 1}/0033`, decision: "Suspended: trading outside licensed premises (pavement storage of cement) despite two warnings. Reinstate on compliance." });
  await mkLic({ ref: 6, type: ltBuild, status: "APPROVED", applicant: "Rutendo Mavhunga", idNo: "63-4434567D42", phone: "0775 666 777", stand: "4471 Unit N", address: "4471 Unit N, Seke", ward: "11", activity: "Double-storey residential dwelling, 4 bedrooms, 310 m²", officerId: licensing.id, inspectorId: officer2.id, outcome: "PASS", decision: "Plans comply with the local development plan and building by-laws. Approved.", ageDays: 18 });
  await mkLic({ ref: 7, type: ltLiquor, status: "INSPECTION", applicant: "Kudakwashe Moyo", trading: "Club 263", idNo: "63-5534567E42", phone: "0776 888 999", stand: "9 Chitungwiza Industrial Park", address: "9 Chitungwiza Industrial Park, Unit B", ward: "2", activity: "Bar with on-premises consumption; live music Fridays and Saturdays", priority: "HIGH", officerId: licensing.id, inspectorId: inspector.id, docsReceived: 5, ageDays: 6 });
  await mkLic({ ref: 8, type: ltShop, status: "UNDER_REVIEW", applicant: "Tatenda Chirwa", trading: "Chirwa Pharmacy", idNo: "63-6634567F42", phone: "0777 101 202", stand: "35 Zengeza 4", address: "Zengeza 4 shopping centre, shop 12", ward: "6", activity: "Retail pharmacy (MCAZ licence attached)", officerId: licensing.id, inspectorId: inspector.id, outcome: "FAIL", docsReceived: 4, ageDays: 9, source: "PUBLIC" });
  await mkLic({ ref: 9, type: ltFood, status: "SUBMITTED", applicant: "Blessing Tapfuma", trading: "Tapfuma Butchery", phone: "0778 303 404", stand: "61 Seke Road", address: "61 Seke Road", ward: "3", activity: "Butchery and braai packs; cold room on site", officerId: licensing.id, docsReceived: 2, ageDays: 1, source: "WHATSAPP" });
  await mkLic({ ref: 10, type: ltHawker, status: "SUBMITTED", applicant: "Shamiso Bere", phone: "0779 505 606", stand: "Chikwanha rank market, bay 22", address: "Chikwanha rank market", ward: "1", activity: "Airtime, snacks and cold drinks", priority: "LOW", officerId: licensing.id, docsReceived: 3, ageDays: 0, source: "PUBLIC" });
  await mkLic({ ref: 11, type: ltShop, status: "REJECTED", applicant: "Innocent Zhou", trading: "Zhou Scrap Metal", phone: "0771 707 808", stand: "77 St Mary's", address: "77 St Mary's (residential stand)", ward: "9", activity: "Scrap metal collection and storage", officerId: licensing.id, inspectorId: inspector.id, outcome: "FAIL", decision: "Rejected: scrap storage is not a permitted use on a residential stand (local development plan zone R2). Apply for an industrial stand.", ageDays: 40 });
  // a licence expiring within 30 days so the dashboard warning shows
  await mkLic({ ref: 12, type: ltFood, status: "ISSUED", applicant: "Farai Chimedza", trading: "Chimedza Bakery", phone: "0772 909 010", stand: "5 Chitungwiza Industrial Park", address: "5 Chitungwiza Industrial Park", ward: "2", activity: "Bakery and confectionery; wholesale and retail", officerId: licensing.id, inspectorId: inspector.id, outcome: "PASS", paid: true, receipt: "RC-003901", ageDays: 352, issuedDaysAgo: 345, licenceNo: `CMC/FHP/${year - 1}/0019` });
  await prisma.licenceType.update({ where: { id: ltShop.id }, data: { counter: 41 } });
  await prisma.licenceType.update({ where: { id: ltLiquor.id }, data: { counter: 12 } });
  await prisma.licenceType.update({ where: { id: ltFood.id }, data: { counter: 19 } });
  await prisma.licenceType.update({ where: { id: ltHawker.id }, data: { counter: 203 } });
  await prisma.notification.create({ data: { orgId: org.id, userId: healthHead.id, title: `Licence application awaiting approval: LA-${year}-0006`, body: "Building plan approval for 4471 Unit N passed inspection.", link: `/app/licences?open=${lic1.id}`, type: "APPROVAL" } });

  console.log("Seeded Municipality of Chitungwiza. Logins (password: Password123!):");
  for (const u of [ict, dg, dirFinance, accountant, cashier, hrHead, registry, auditor, ictHead, surveysHead, supervisor, officer1, officer2, healthHead, licensing, inspector]) {
    console.log(`  ${u.email.padEnd(34)} ${u.role.padEnd(8)} ${u.name} — ${u.jobTitle}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
