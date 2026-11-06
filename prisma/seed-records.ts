/**
 * Records management (registry) sample data: a starter file plan and a correspondence register with every stage
 * represented. Idempotent: does nothing when the organisation already has files. Also makes the registry clerk
 * (registry@… / job title containing "Registry") a registry clerk in the organisation settings.
 *
 *   npx tsx prisma/seed-records.ts
 *   docker compose --profile seed run --rm seed npx tsx prisma/seed-records.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const daysAgo = (d: number, hour = 9) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(hour, 0, 0, 0); return x; };
const inDays = (d: number) => daysAgo(-d, 16);

export async function applyRecordsSeed(orgId: string) {
  if (await prisma.recordFile.count({ where: { orgId } })) return 0;
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organisation not found");
  const settings = JSON.parse(org.settings || "{}") as { records?: { clerkIds?: string[]; prefix?: string; replyDays?: number }; licensing?: { prefix?: string }; cases?: { prefix?: string } };
  const prefix = settings.records?.prefix || settings.licensing?.prefix || settings.cases?.prefix || "REG";
  const users = await prisma.user.findMany({ where: { orgId }, select: { id: true, email: true, jobTitle: true, departmentId: true, role: true } });
  const depts = await prisma.department.findMany({ where: { orgId }, select: { id: true, code: true, headUserId: true } });
  const dept = (code: string) => depts.find((d) => d.code === code);
  const by = (needle: string) => users.find((u) => u.email.startsWith(needle + "@")) || users.find((u) => (u.jobTitle || "").toLowerCase().includes(needle)) || null;
  const clerk = by("registry") || users.find((u) => u.role === "ADMIN") || users[0];
  const townClerk = by("secretary") || users.find((u) => u.role === "ADMIN") || users[0];
  const treasurer = by("treasurer") || townClerk;
  const accountant = by("accountant") || treasurer;
  const engineer = by("engineer") || townClerk;
  const health = by("health.officer") || townClerk;
  const hr = by("admin.officer") || townClerk;
  const auditor = by("internal.audit") || townClerk;
  const ictHead = by("ict.head") || townClerk;
  const legalDept = dept("TC") || depts[0];

  if (!settings.records?.clerkIds?.length) {
    await prisma.organization.update({ where: { id: orgId }, data: { settings: JSON.stringify({ ...settings, records: { ...(settings.records || {}), clerkIds: [clerk.id], replyDays: 7 } }) } });
  }

  // --- file plan ---
  const file = (fileNo: string, series: string, title: string, description: string, deptCode: string | null, location: string, retentionYears: number, confidential = false) =>
    prisma.recordFile.create({ data: { orgId, fileNo, series, title, description, departmentId: deptCode ? dept(deptCode)?.id || null : null, location, retentionYears, confidential, openedAt: daysAgo(400) } });
  const fMinistry = await file("ADM/1/1", "Administration", "Ministry of Local Government and Public Works: general correspondence", "Circulars, directives and returns to and from the parent ministry. Budget approvals go on FIN/2/1.", "TC", "Registry, cabinet 1, shelf A", 10);
  const fResidents = await file("ADM/4/2", "Administration", "Residents' associations and petitions", "Correspondence with residents' associations, ratepayers and petitions addressed to Council.", "TC", "Registry, cabinet 1, shelf C", 7);
  const fBudget = await file("FIN/2/1", "Finance", "Budget: approvals, supplementary budgets and returns", "Annual and supplementary budget submissions, ministry approvals and quarterly returns.", "FIN", "Finance, strongroom cabinet 2", 20);
  const fCreditors = await file("FIN/5/3", "Finance", "Creditors: utilities (ZESA, ZINWA, TelOne)", "Invoices, statements and payment plans with utility providers.", "FIN", "Finance, cabinet 6, shelf B", 7);
  const fAudit = await file("AUD/1/1", "Audit", "Office of the Auditor-General: management letters and responses", "Audit queries, management letters and the council's responses.", "AUD", "Internal Audit office, cabinet 1", 15, true);
  const fLegal = await file("LEG/3/1", "Legal", "Litigation and legal opinions", "Summonses, court orders, letters of demand and opinions from council's lawyers.", "TC", "Town Clerk's office, safe", 20, true);
  const fWater = await file("ENG/2/4", "Engineering & Works", "Water and sewer: ZINWA and Harare bulk supply", "Bulk water supply agreements, pumping schedules and sewer reticulation correspondence.", "ENG", "Engineering, cabinet 3, shelf A", 15);
  const fHealth = await file("HLT/1/2", "Health & Environment", "Ministry of Health and Child Care: clinics and public health", "Clinic staffing, drug supplies, outbreak notices and public health directives.", "HHS", "Health office, cabinet 2", 10);
  const fTenders = await file("PRC/1/1", "Procurement", "Tenders and quotations received", "Bid documents, PRAZ correspondence and award letters.", "FIN", "Procurement office, cabinet 1", 10);
  const fHr = await file("HR/6/1", "Human Resources", "Pensions, NSSA and medical aid", "LAPF and NSSA returns, medical aid correspondence and queries.", "ADM", "HR office, cabinet 4", 10);
  await file("ADM/9/1", "Administration", "General enquiries and miscellaneous", "Anything that does not yet have a file of its own; review quarterly and open proper files.", null, "Registry, cabinet 2, shelf D", 3);

  // --- correspondence ---
  let inSeq = 0, outSeq = 0;
  const year = new Date().getFullYear();
  type Ev = { kind: string; fromStatus?: string | null; toStatus?: string | null; actorId?: string | null; toUserId?: string | null; note?: string | null; daysAgo: number };
  const mk = async (d: {
    direction: "IN" | "OUT"; docType?: string; subject: string; summary?: string; party: string; contactName?: string; contactDetails?: string; theirRef?: string; letterAgeDays?: number; ageDays: number; method?: string;
    status: string; priority?: string; confidential?: boolean; pages?: number; enclosures?: string; actionRequired?: string; dueInDays?: number | null; fileId?: string | null; deptCode?: string | null; assignedToId?: string | null;
    replyToId?: string | null; relatedRef?: string; dispatchedById?: string; trackingNo?: string; signedBy?: string; events: Ev[];
  }) => {
    const seq = d.direction === "IN" ? ++inSeq : ++outSeq;
    const created = daysAgo(d.ageDays);
    const due = d.direction === "IN" ? (d.dueInDays === null ? null : d.dueInDays !== undefined ? inDays(d.dueInDays) : new Date(created.getTime() + 7 * 86400000)) : d.dueInDays != null ? inDays(d.dueInDays) : null;
    const done = ["REPLIED", "FILED", "DISPATCHED", "ACKNOWLEDGED"].includes(d.status);
    return prisma.correspondence.create({
      data: {
        orgId, referenceNo: `${prefix}/${d.direction}/${year}/${String(seq).padStart(4, "0")}`, direction: d.direction, docType: d.docType || "LETTER", subject: d.subject, summary: d.summary || null, party: d.party, contactName: d.contactName || null, contactDetails: d.contactDetails || null,
        theirRef: d.theirRef || null, letterDate: daysAgo(d.ageDays + (d.letterAgeDays ?? 3)), dateLogged: created, method: d.method || (d.direction === "IN" ? "HAND" : "POST"), status: d.status, priority: d.priority || "MEDIUM", confidential: !!d.confidential, pages: d.pages ?? null, enclosures: d.enclosures || null,
        actionRequired: d.actionRequired || null, actionDue: due, fileId: d.fileId ?? null, departmentId: d.deptCode ? dept(d.deptCode)?.id || null : null, assignedToId: d.assignedToId ?? null, registeredById: clerk.id, replyToId: d.replyToId ?? null, relatedRef: d.relatedRef || null,
        dispatchedById: d.dispatchedById || null, trackingNo: d.trackingNo || null, signedBy: d.signedBy || null, filedAt: d.status === "FILED" ? daysAgo(Math.max(0, d.ageDays - 5)) : null, repliedAt: d.status === "REPLIED" ? daysAgo(Math.max(0, d.ageDays - 4)) : null,
        createdAt: created, updatedAt: done ? daysAgo(Math.max(0, d.ageDays - 5)) : created,
        events: { create: d.events.map((e) => ({ kind: e.kind, fromStatus: e.fromStatus ?? null, toStatus: e.toStatus ?? null, actorId: e.actorId === undefined ? clerk.id : e.actorId, toUserId: e.toUserId ?? null, note: e.note ?? null, createdAt: daysAgo(e.daysAgo, 9 + (d.events.indexOf(e) % 6)) })) },
      },
    });
  };
  const reg = (ageDays: number, toStatus: string, note: string): Ev => ({ kind: "REGISTERED", toStatus, note, daysAgo: ageDays });
  const routed = (ageDays: number, toUserId: string | null, note: string): Ev => ({ kind: "ROUTED", fromStatus: "RECEIVED", toStatus: "ROUTED", toUserId, note, daysAgo: ageDays });

  // Incoming: awaiting routing
  await mk({ direction: "IN", docType: "LETTER", ageDays: 0, letterAgeDays: 2, method: "HAND", status: "RECEIVED", priority: "HIGH", pages: 3, enclosures: "Schedule of arrears (2 pages)", subject: "Final demand: outstanding electricity account for Town House and clinics", party: "ZESA Holdings (ZETDC), Chitungwiza Depot", contactName: "Credit Control", contactDetails: "chitungwiza.credit@zetdc.co.zw", theirRef: "ZETDC/CC/CHIT/2217", fileId: fCreditors.id, dueInDays: 7,
    events: [reg(0, "RECEIVED", "Received by hand from ZESA Holdings (ZETDC), Chitungwiza Depot")] });
  await mk({ direction: "IN", docType: "EMAIL", ageDays: 0, letterAgeDays: 0, method: "EMAIL", status: "RECEIVED", pages: 1, subject: "Request for Council's input into the Chitungwiza master plan review workshop", party: "Department of Spatial Planning and Development", contactName: "Director", contactDetails: "spatialplanning@mlgpw.gov.zw", theirRef: "DSPD/CHIT/MP/4", fileId: fMinistry.id, dueInDays: 10,
    events: [reg(0, "RECEIVED", "Received by email from Department of Spatial Planning and Development")] });

  // Incoming: routed, including one overdue
  await mk({ direction: "IN", docType: "LETTER", ageDays: 2, letterAgeDays: 4, method: "REGISTERED_POST", status: "ROUTED", priority: "HIGH", pages: 4, subject: "Approval of the 2026 supplementary budget: conditions", party: "Ministry of Local Government and Public Works", contactName: "Permanent Secretary", contactDetails: "P. Bag 7706, Causeway, Harare", theirRef: "MLGPW/LA/CHIT/3/2026", fileId: fBudget.id, deptCode: "FIN", assignedToId: treasurer.id, actionRequired: "Table the conditions before Finance Committee and prepare the ministry return", dueInDays: 5,
    events: [reg(2, "RECEIVED", "Received registered post from Ministry of Local Government and Public Works"), routed(2, treasurer.id, "Table the conditions before Finance Committee and prepare the ministry return")] });
  const inAudit = await mk({ direction: "IN", docType: "LETTER", ageDays: 16, letterAgeDays: 5, method: "COURIER", status: "ROUTED", priority: "CRITICAL", confidential: true, pages: 11, enclosures: "Draft management letter", subject: "Draft management letter: 2025 financial statements audit", party: "Office of the Auditor-General", contactName: "Director of Audits (Local Authorities)", contactDetails: "oag@auditorgeneral.gov.zw", theirRef: "OAG/LA/CHIT/2025/ML", fileId: fAudit.id, deptCode: "AUD", assignedToId: auditor.id, actionRequired: "Coordinate management responses from Finance and Engineering; reply within 14 days", dueInDays: -2,
    events: [reg(16, "RECEIVED", "Received by courier from Office of the Auditor-General"), routed(16, auditor.id, "Coordinate management responses from Finance and Engineering; reply within 14 days"), { kind: "NOTE", note: "Finance responses received; Engineering responses on fleet and fuel still outstanding", daysAgo: 6, actorId: auditor.id }] });
  await mk({ direction: "IN", docType: "COURT", ageDays: 4, letterAgeDays: 1, method: "HAND", status: "ROUTED", priority: "CRITICAL", confidential: true, pages: 6, subject: "Summons: Chikwanha v Municipality of Chitungwiza (pothole damage claim, HC 2231/26)", party: "Mutamangira & Associates, Legal Practitioners", contactName: "T. Mutamangira", contactDetails: "+263 242 700 123", theirRef: "TM/CH/0412", fileId: fLegal.id, deptCode: "TC", assignedToId: townClerk.id, actionRequired: "Instruct council's lawyers to enter appearance to defend; obtain Engineering report on the road section", dueInDays: 6,
    events: [reg(4, "RECEIVED", "Served by hand by Mutamangira & Associates, Legal Practitioners"), routed(4, townClerk.id, "Instruct council's lawyers to enter appearance to defend")] });

  // Incoming: being actioned
  await mk({ direction: "IN", docType: "LETTER", ageDays: 7, letterAgeDays: 2, method: "HAND", status: "IN_PROGRESS", priority: "HIGH", pages: 2, enclosures: "Petition with 412 signatures", subject: "Petition: burst sewer and raw sewage flowing in Unit L, Seke", party: "Chitungwiza Residents Trust", contactName: "A. Mukarati (Chairperson)", contactDetails: "0772 555 010", fileId: fResidents.id, deptCode: "ENG", assignedToId: engineer.id, actionRequired: "Inspect, programme repairs and draft a reply for the Town Clerk's signature", dueInDays: 3, relatedRef: `${prefix}-0002`,
    events: [reg(7, "RECEIVED", "Received by hand from Chitungwiza Residents Trust"), routed(7, engineer.id, "Inspect, programme repairs and draft a reply for the Town Clerk's signature"), { kind: "STARTED", fromStatus: "ROUTED", toStatus: "IN_PROGRESS", actorId: engineer.id, note: "Site inspected; crew scheduled for Monday", daysAgo: 5 }] });

  // Incoming replied, with the linked outgoing reply (dispatched)
  const inWater = await mk({ direction: "IN", docType: "LETTER", ageDays: 20, letterAgeDays: 3, method: "POST", status: "REPLIED", pages: 2, subject: "Proposed revision of bulk water tariff and pumping schedule", party: "Zimbabwe National Water Authority (ZINWA)", contactName: "Catchment Manager, Manyame", contactDetails: "manyame@zinwa.co.zw", theirRef: "ZINWA/MAN/CHIT/88", fileId: fWater.id, deptCode: "ENG", assignedToId: engineer.id, actionRequired: "Prepare council's position on the tariff and the 18-hour pumping schedule", dueInDays: -8,
    events: [reg(20, "RECEIVED", "Received by post from Zimbabwe National Water Authority (ZINWA)"), routed(20, engineer.id, "Prepare council's position on the tariff and pumping schedule"), { kind: "STARTED", fromStatus: "ROUTED", toStatus: "IN_PROGRESS", actorId: engineer.id, daysAgo: 18 }, { kind: "REPLIED", fromStatus: "IN_PROGRESS", toStatus: "REPLIED", note: `Reply ${prefix}/OUT/${year}/0001 dispatched`, daysAgo: 13 }] });
  await mk({ direction: "OUT", docType: "LETTER", ageDays: 13, letterAgeDays: 0, method: "COURIER", status: "DISPATCHED", pages: 3, enclosures: "Pumping schedule proposal", subject: "Re: Proposed revision of bulk water tariff and pumping schedule", party: "Zimbabwe National Water Authority (ZINWA)", contactName: "Catchment Manager, Manyame", theirRef: "ZINWA/MAN/CHIT/88", fileId: fWater.id, deptCode: "ENG", replyToId: inWater.id, signedBy: "Town Clerk", dispatchedById: "Swift courier, waybill SW-118822", trackingNo: "SW-118822",
    events: [reg(13, "DISPATCHED", "Dispatched by courier to Zimbabwe National Water Authority (ZINWA)")] });

  // Incoming filed
  await mk({ direction: "IN", docType: "NOTICE", ageDays: 30, letterAgeDays: 6, method: "EMAIL", status: "FILED", pages: 5, subject: "Circular 2 of 2026: submission of quarterly devolution fund returns", party: "Ministry of Local Government and Public Works", contactName: "Director, Urban Local Authorities", theirRef: "MLGPW/ULA/CIRC/2/2026", fileId: fMinistry.id, deptCode: "FIN", assignedToId: accountant.id, actionRequired: "Note the new return format; circulate to Finance", dueInDays: -20,
    events: [reg(30, "RECEIVED", "Received by email from Ministry of Local Government and Public Works"), routed(30, accountant.id, "Note the new return format; circulate to Finance"), { kind: "FILED", fromStatus: "ROUTED", toStatus: "FILED", note: "Placed on file ADM/1/1 Ministry of Local Government and Public Works: general correspondence · noted, no reply needed", daysAgo: 25 }] });
  await mk({ direction: "IN", docType: "INVOICE", ageDays: 24, letterAgeDays: 2, method: "HAND", status: "FILED", pages: 1, subject: "Statement of account: bulk water supply, September", party: "Zimbabwe National Water Authority (ZINWA)", theirRef: "INV-77231", fileId: fCreditors.id, deptCode: "FIN", assignedToId: accountant.id, actionRequired: "Reconcile against meter readings and process for payment", dueInDays: -14, relatedRef: "PV-2026-0931",
    events: [reg(24, "RECEIVED", "Received by hand from Zimbabwe National Water Authority (ZINWA)"), routed(24, accountant.id, "Reconcile against meter readings and process for payment"), { kind: "FILED", fromStatus: "ROUTED", toStatus: "FILED", actorId: accountant.id, note: "Placed on file FIN/5/3 Creditors: utilities · paid, PV-2026-0931", daysAgo: 19 }] });
  await mk({ direction: "IN", docType: "TENDER", ageDays: 9, letterAgeDays: 0, method: "HAND", status: "ROUTED", pages: 40, enclosures: "Bid bond, company profile", subject: "Bid: supply and delivery of water treatment chemicals (tender CMC/ENG/04/2026)", party: "Chemplex Corporation (Pvt) Ltd", contactName: "Tenders Office", contactDetails: "tenders@chemplex.co.zw", fileId: fTenders.id, deptCode: "FIN", assignedToId: accountant.id, actionRequired: "Hold sealed until the opening session on the closing date", dueInDays: 12,
    events: [reg(9, "RECEIVED", "Received by hand (sealed) from Chemplex Corporation (Pvt) Ltd"), routed(9, accountant.id, "Hold sealed until the opening session")] });
  await mk({ direction: "IN", docType: "LETTER", ageDays: 3, letterAgeDays: 4, method: "POST", status: "ROUTED", pages: 2, subject: "Cholera preparedness: request for clinic readiness report", party: "Ministry of Health and Child Care, Provincial Medical Director (Harare Metropolitan)", theirRef: "PMD/HRE/EPR/19", fileId: fHealth.id, deptCode: "HHS", assignedToId: health.id, actionRequired: "Compile readiness report for all four clinics", dueInDays: 4,
    events: [reg(3, "RECEIVED", "Received by post from the Provincial Medical Director"), routed(3, health.id, "Compile readiness report for all four clinics")] });

  // Outgoing: awaiting dispatch, dispatched, acknowledged, filed
  await mk({ direction: "OUT", docType: "LETTER", ageDays: 1, method: "HAND", status: "DRAFT", priority: "HIGH", pages: 2, subject: "Response to summons HC 2231/26: instruction to enter appearance to defend", party: "Gill, Godlonton & Gerrans, Legal Practitioners", contactName: "Council's lawyers", confidential: true, fileId: fLegal.id, deptCode: "TC", signedBy: "Town Clerk",
    events: [reg(1, "DRAFT", "Registered for dispatch to Gill, Godlonton & Gerrans, Legal Practitioners; awaiting the Town Clerk's signature")] });
  await mk({ direction: "OUT", docType: "LETTER", ageDays: 6, method: "EMAIL", status: "DISPATCHED", pages: 1, subject: "Nomination of council representatives to the Manyame catchment council", party: "Zimbabwe National Water Authority (ZINWA)", theirRef: "ZINWA/MAN/CC/3", fileId: fWater.id, deptCode: "ENG", signedBy: "Town Clerk",
    events: [reg(6, "DISPATCHED", "Dispatched by email to Zimbabwe National Water Authority (ZINWA)")] });
  await mk({ direction: "OUT", docType: "REPORT", ageDays: 15, method: "COURIER", status: "ACKNOWLEDGED", pages: 28, enclosures: "Signed financial statements, bank confirmations", subject: "Management responses to the 2025 audit queries (first batch: Finance)", party: "Office of the Auditor-General", contactName: "Director of Audits (Local Authorities)", confidential: true, fileId: fAudit.id, deptCode: "AUD", replyToId: inAudit.id, signedBy: "Town Clerk", dispatchedById: "Swift courier", trackingNo: "SW-119004",
    events: [reg(15, "DISPATCHED", "Dispatched by courier to Office of the Auditor-General"), { kind: "ACKNOWLEDGED", fromStatus: "DISPATCHED", toStatus: "ACKNOWLEDGED", actorId: auditor.id, note: "Receipt acknowledged by the OAG registry, 12:40", daysAgo: 13 }] });
  await mk({ direction: "OUT", docType: "LETTER", ageDays: 35, method: "POST", status: "FILED", pages: 2, subject: "Submission of the 2026 supplementary budget for approval", party: "Ministry of Local Government and Public Works", contactName: "Permanent Secretary", fileId: fBudget.id, deptCode: "FIN", signedBy: "Town Clerk and Treasurer", relatedRef: "Council resolution 14/2026",
    events: [reg(35, "DISPATCHED", "Dispatched by post to Ministry of Local Government and Public Works"), { kind: "FILED", fromStatus: "DISPATCHED", toStatus: "FILED", note: "Placed on file FIN/2/1 Budget: approvals, supplementary budgets and returns", daysAgo: 30 }] });
  await mk({ direction: "OUT", docType: "LETTER", ageDays: 8, method: "HAND", status: "DISPATCHED", pages: 1, subject: "Confirmation of pension contributions remitted, July to September", party: "Local Authorities Pension Fund (LAPF)", contactName: "Contributions Section", fileId: fHr.id, deptCode: "ADM", signedBy: "Administration & Human Resources Officer", dispatchedById: "Council messenger",
    events: [reg(8, "DISPATCHED", "Dispatched by hand to Local Authorities Pension Fund (LAPF)", )] });
  void hr; void ictHead; void legalDept;

  // a notification so the Treasurer's inbox shows the routed letter
  await prisma.notification.create({ data: { orgId, userId: treasurer.id, title: `Correspondence routed to you: ${prefix}/IN/${year}/0003`, body: "Approval of the 2026 supplementary budget: conditions (from Ministry of Local Government and Public Works). Action: Table the conditions before Finance Committee and prepare the ministry return.", link: "/app/records", type: "APPROVAL" } });
  return inSeq + outSeq;
}

if (require.main === module) {
  (async () => {
    const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
    if (!org) throw new Error("No organisation found. Run the main seed first.");
    const n = await applyRecordsSeed(org.id);
    console.log(n ? `Seeded the file plan and ${n} register entries for ${org.name}.` : `${org.name} already has a file plan; nothing added.`);
  })().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
}
