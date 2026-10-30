/**
 * Additive seed for the resource modules (advances ledger, notice board, asset register, fleet, public holidays).
 * Safe to run against an existing ZimStat database: it only adds what is missing and never deletes.
 *
 *   npx tsx prisma/seed-modules.ts          (local)
 *   docker compose --profile seed run --rm seed npx tsx prisma/seed-modules.ts   (VM)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const j = (v: unknown) => JSON.stringify(v);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);
const year = new Date().getFullYear();
const HOLIDAYS = [
  [`${year}-01-01`, "New Year's Day"], [`${year}-02-21`, "Robert Gabriel Mugabe National Youth Day"], [`${year}-04-18`, "Independence Day"],
  [`${year}-05-01`, "Workers' Day"], [`${year}-05-25`, "Africa Day"], [`${year}-08-11`, "Heroes' Day"], [`${year}-08-12`, "Defence Forces Day"],
  [`${year}-12-22`, "Unity Day"], [`${year}-12-25`, "Christmas Day"], [`${year}-12-26`, "Boxing Day"],
].map(([date, name]) => ({ date, name }));

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: "zimstat" } }) || (await prisma.organization.findFirst());
  if (!org) throw new Error("No organisation found. Run the main seed first (npm run db:seed).");
  const users = await prisma.user.findMany({ where: { orgId: org.id } });
  const byEmail = (e: string) => users.find((u) => u.email === e) || users[0];
  const ict = byEmail("ict.admin@zimstat.co.zw"), dg = byEmail("dg@zimstat.co.zw"), dirFinance = byEmail("director.finance@zimstat.co.zw"), cashier = byEmail("finance.officer@zimstat.co.zw");
  const hrHead = byEmail("hr.head@zimstat.co.zw"), registry = byEmail("registry@zimstat.co.zw"), ictHead = byEmail("ict.head@zimstat.co.zw"), surveysHead = byEmail("surveys.head@zimstat.co.zw");
  const supervisor = byEmail("field.supervisor@zimstat.co.zw"), officer1 = byEmail("l.officer@zimstat.co.zw"), officer2 = byEmail("p.officer@zimstat.co.zw");
  const depts = await prisma.department.findMany({ where: { orgId: org.id } });
  const dept = (code: string) => depts.find((d) => d.code === code) || depts[0];
  const finance = dept("FIN"), hr = dept("HRA"), ictSec = dept("ICT"), surveys = dept("PCS");
  const projects = await prisma.project.findMany({ where: { orgId: org.id } });
  const proj = (code: string) => projects.find((p) => p.code === code) || null;
  const zdhs = proj("ZDHS"), mics = proj("MICS");

  // 1. Organisation settings: public holidays
  const settings = JSON.parse(org.settings || "{}");
  if (!settings.publicHolidays?.length) {
    await prisma.organization.update({ where: { id: org.id }, data: { settings: j({ ...settings, publicHolidays: HOLIDAYS }) } });
    console.log("Added public holidays");
  }

  // 2. Link the T&S workflows to the advances ledger
  for (const [prefix, mode] of [["TSA", "open"], ["TSC", "clear"]] as const) {
    const t = await prisma.workflowTemplate.findFirst({ where: { orgId: org.id, prefix } });
    if (!t) continue;
    const s = JSON.parse(t.settings || "{}");
    if (s.advances !== mode) { await prisma.workflowTemplate.update({ where: { id: t.id }, data: { settings: j({ ...s, advances: mode }) } }); console.log(`Linked ${prefix} to advances (${mode})`); }
  }

  // 3. Vehicle request workflow
  let vehicleReq = await prisma.workflowTemplate.findFirst({ where: { orgId: org.id, prefix: "VR" } });
  if (!vehicleReq) {
    vehicleReq = await prisma.workflowTemplate.create({
      data: {
        orgId: org.id, name: "Vehicle request", category: "OTHER", prefix: "VR", icon: "🚙", color: "#0e7490", createdById: ict.id,
        description: "Request an Agency vehicle for official travel. Approved by the Head of Section, then the transport office assigns a vehicle and driver on the Fleet page.",
        fields: j([
          { key: "destination", label: "Destination", type: "text", required: true, width: "half" },
          { key: "dates", label: "Travel dates (from – to)", type: "daterange", required: true, width: "half" },
          { key: "purpose", label: "Purpose of travel", type: "textarea", required: true, width: "full" },
          { key: "passengers", label: "Number of passengers (incl. driver)", type: "number", required: true, min: 1, max: 60, width: "half" },
          { key: "needsDriver", label: "Driver required", type: "checkbox", width: "half" },
          { key: "equipment", label: "Equipment / load to carry", type: "text", width: "full" },
        ]),
        levels: j([
          { id: "v1", order: 1, name: "Approved — Head of Section", approverType: "DEPARTMENT_HEAD", mode: "ANY", slaHours: 24, allowDelegate: true, allowReturn: true, skipIfRequester: true, fallbackUserId: dg.id },
          { id: "v2", order: 2, name: "Vehicle availability confirmed — Administration (transport)", description: "Confirm a vehicle can be made available; the booking is created automatically on approval.", approverType: "DEPARTMENT", departmentId: hr.id, minRole: "MEMBER", mode: "ANY", slaHours: 24, allowDelegate: false, allowReturn: true },
        ]),
        settings: j({ titleTemplate: "Vehicle: {{destination}}", allowAttachments: true, allowRequesterCancel: true, costField: "none", requireProject: false, createsTrip: true }),
      },
    });
    console.log("Created Vehicle request workflow");
  }

  // 4. Advances ledger: open an (overdue) advance for the seeded approved TSA
  const tsa = await prisma.request.findFirst({ where: { orgId: org.id, referenceNo: { startsWith: "TSA-" }, status: "APPROVED" }, orderBy: { createdAt: "asc" } });
  if (tsa && !(await prisma.advance.findUnique({ where: { requestId: tsa.id } }))) {
    const data = JSON.parse(tsa.data || "{}");
    const ends = Array.isArray(data.period) && data.period[1] ? new Date(data.period[1]) : hoursAgo(24 * 40);
    await prisma.advance.create({ data: { orgId: org.id, userId: tsa.requesterId, requestId: tsa.id, referenceNo: tsa.referenceNo, amount: tsa.costAmount || 870, clearedAmount: 0, currency: "USD", status: "OPEN", disbursedAt: tsa.completedAt || hoursAgo(120), travelEndsAt: ends, dueAt: new Date(ends.getTime() + 10 * 86400000), notes: "Paid by EFT, ref ADV-0391." } });
    await prisma.notification.create({ data: { orgId: org.id, userId: tsa.requesterId, title: `Advance ${tsa.referenceNo} is overdue`, body: `USD ${Number(tsa.costAmount || 870).toFixed(2)} outstanding. Submit the T&S Expense Claim with receipts, or the amount is recovered from salary.`, link: "/app/advances", type: "WARNING" } });
    console.log(`Opened advance ${tsa.referenceNo}`);
  }

  // 5. Notice board
  if ((await prisma.notice.count({ where: { orgId: org.id } })) === 0) {
    const notice = (data: { title: string; body: string; kind: string; requiresAck?: boolean; pinned?: boolean; departmentIds?: string[]; hoursOld: number }) =>
      prisma.notice.create({ data: { orgId: org.id, title: data.title, body: data.body, kind: data.kind, requiresAck: !!data.requiresAck, pinned: !!data.pinned, departmentIds: j(data.departmentIds || []), roles: j([]), publishedAt: hoursAgo(data.hoursOld), createdAt: hoursAgo(data.hoursOld), createdById: data.kind === "POLICY" ? dirFinance.id : dg.id } });
    const n1 = await notice({ kind: "CIRCULAR", pinned: true, requiresAck: true, hoursOld: 72, title: `Circular 3/${year}: Clearance of T&S advances within 10 days`, body: "All officers are reminded that Travelling and Subsistence advances must be cleared within ten (10) working days of return from duty, by submitting the T&S Expense Claim form with original receipts to the Finance Section.\n\nWith effect from 1 November, outstanding advances older than 30 days will be recovered from salary in terms of Treasury Instruction 1206, and no further advance will be approved for an officer with an uncleared account.\n\nHeads of Section are requested to ensure compliance within their sections.\n\nDirector General" });
    await notice({ kind: "POLICY", requiresAck: true, hoursOld: 240, title: "ICT Acceptable Use and Equipment Policy (rev. 2)", body: "1. Agency laptops, tablets and GPS devices are issued to named officers and recorded in the asset register. The officer is responsible for the equipment until it is returned to the ICT store.\n2. Loss or damage must be reported through the service desk within 24 hours.\n3. Personal software and unlicensed media may not be installed on Agency devices.\n4. Survey data must be synchronised to the Agency server daily and never stored on personal devices.\n\nPlease acknowledge that you have read and understood this policy." });
    await notice({ kind: "ANNOUNCEMENT", hoursOld: 20, title: "MICS field teams: vehicle allocation for Mashonaland West deployment", body: "Field teams deploying on Monday will collect allocated vehicles from the Head Office car park from 07:00. Team leaders must sign the trip log and record the odometer reading before departure. Fuel cards are issued by the Administration office.", departmentIds: [surveys.id] });
    await notice({ kind: "MEMO", hoursOld: 6, title: "Half-day closure: Friday staff wellness programme", body: "Head Office will close at 12:30 on Friday for the staff wellness programme at the sports club. Essential services (service desk, cashier) remain on duty until 14:00." });
    await prisma.noticeAck.createMany({ data: [{ noticeId: n1.id, userId: ictHead.id, ackAt: hoursAgo(60) }, { noticeId: n1.id, userId: officer2.id, ackAt: hoursAgo(40) }, { noticeId: n1.id, userId: cashier.id, ackAt: hoursAgo(70) }] });
    console.log("Created 4 notices");
  }

  // 6. Asset register
  if ((await prisma.asset.count({ where: { orgId: org.id } })) === 0) {
    const asset = (data: { tag: string; category: string; make: string; model: string; serial: string; status?: string; assignedToId?: string; departmentId: string; location?: string; purchaseDate: string; purchaseCost: number; warrantyUntil?: string; notes?: string }) =>
      prisma.asset.create({ data: { orgId: org.id, tag: data.tag, category: data.category, make: data.make, model: data.model, serial: data.serial, status: data.status || (data.assignedToId ? "ISSUED" : "IN_STORE"), assignedToId: data.assignedToId || null, departmentId: data.departmentId, location: data.location, purchaseDate: new Date(data.purchaseDate), purchaseCost: data.purchaseCost, warrantyUntil: data.warrantyUntil ? new Date(data.warrantyUntil) : null, notes: data.notes,
        events: { create: [{ kind: "CREATED", actorId: ict.id, note: "Added to the register", createdAt: hoursAgo(2000) }, ...(data.assignedToId ? [{ kind: "ISSUED", actorId: ict.id, toUserId: data.assignedToId, note: "Issued with charger and bag", createdAt: hoursAgo(1900) }] : []), ...(data.status === "IN_REPAIR" ? [{ kind: "REPAIR", actorId: officer1.id, note: "Wi-Fi adapter fault; sent to supplier under warranty", createdAt: hoursAgo(26) }] : [])] } } });
    const a1 = await asset({ tag: "ZS/ICT/0041", category: "Laptop", make: "Dell", model: "Latitude 5540", serial: "7KQ2P93", assignedToId: officer2.id, departmentId: surveys.id, location: "Head Office, 7th floor", purchaseDate: "2024-08-12", purchaseCost: 1450, warrantyUntil: `${year + 1}-08-12`, status: "IN_REPAIR" });
    await asset({ tag: "ZS/ICT/0042", category: "Laptop", make: "HP", model: "ProBook 450 G9", serial: "5CD3281XYZ", assignedToId: officer1.id, departmentId: ictSec.id, location: "Head Office, 5th floor", purchaseDate: "2024-08-12", purchaseCost: 1320, warrantyUntil: `${year + 1}-08-12` });
    await asset({ tag: "ZS/ICT/0043", category: "Laptop", make: "HP", model: "ProBook 450 G9", serial: "5CD3281ABC", departmentId: ictSec.id, location: "ICT store", purchaseDate: "2024-08-12", purchaseCost: 1320, warrantyUntil: `${year + 1}-08-12`, notes: "Spare for field deployments." });
    for (let i = 1; i <= 4; i++) await asset({ tag: `ZS/PCS/GPS-${String(i).padStart(2, "0")}`, category: "GPS / PDA", make: "Garmin", model: "eTrex 32x", serial: `GRM32X-${1000 + i}`, assignedToId: i <= 2 ? supervisor.id : undefined, departmentId: surveys.id, location: i <= 2 ? "Field (MICS)" : "Surveys store", purchaseDate: "2023-03-01", purchaseCost: 310 });
    await asset({ tag: "ZS/ICT/PRN-07", category: "Printer", make: "Kyocera", model: "ECOSYS M3655idn", serial: "VKY7342201", departmentId: finance.id, location: "Finance Section, Room 214", purchaseDate: "2022-11-20", purchaseCost: 980 });
    await asset({ tag: "ZS/ICT/TAB-115", category: "Tablet", make: "Samsung", model: "Galaxy Tab A9", serial: "R52W40ABCDE", assignedToId: officer2.id, departmentId: surveys.id, location: "Field (MICS)", purchaseDate: `${year}-01-15`, purchaseCost: 240, warrantyUntil: `${year + 1}-01-15` });
    const wifiCase = await prisma.case.findFirst({ where: { orgId: org.id, title: { contains: "Wi-Fi" } } });
    if (wifiCase) await prisma.case.update({ where: { id: wifiCase.id }, data: { assetId: a1.id } });
    console.log("Created 10 assets");
  }

  // 7. Fleet
  if ((await prisma.vehicle.count({ where: { orgId: org.id } })) === 0) {
    const vehicle = (registration: string, make: string, model: string, type: string, odometer: number, status = "AVAILABLE", departmentId?: string, notes?: string) =>
      prisma.vehicle.create({ data: { orgId: org.id, registration, make, model, type, odometer, status, departmentId: departmentId || null, notes } });
    const v1 = await vehicle("GZ 4471", "Toyota", "Hilux 2.8 GD-6", "Double cab", 84210, "AVAILABLE", surveys.id);
    const v2 = await vehicle("GZ 4472", "Toyota", "Hilux 2.8 GD-6", "Double cab", 91530, "AVAILABLE", surveys.id);
    await vehicle("GZ 3310", "Toyota", "Land Cruiser 79", "SUV / 4x4", 143880, "MAINTENANCE", undefined, "Clutch replacement at CMED, due back Thursday.");
    await vehicle("GZ 2208", "Nissan", "NP300 Hardbody", "Single cab", 167400, "AVAILABLE", hr.id, "Head Office runner.");
    const d = (days: number, hour = 7) => { const x = new Date(); x.setDate(x.getDate() + days); x.setHours(hour, 0, 0, 0); return x; };
    const snapshot = j({ name: vehicleReq.name, category: vehicleReq.category, fields: JSON.parse(vehicleReq.fields), levels: JSON.parse(vehicleReq.levels), settings: JSON.parse(vehicleReq.settings), version: vehicleReq.version });
    const counter = await prisma.request.count({ where: { templateId: vehicleReq.id } });
    const ref = `VR-${year}-${String(counter + 1).padStart(4, "0")}`;
    const r5 = await prisma.request.create({
      data: {
        orgId: org.id, templateId: vehicleReq.id, referenceNo: ref, title: "Vehicle: Chinhoyi and Karoi (MICS supervision)", requesterId: officer2.id, status: "APPROVED", priority: "NORMAL",
        projectId: mics?.id || null, currentLevel: 2, activeLevels: j([1, 2]), templateSnapshot: snapshot, submittedAt: hoursAgo(30), completedAt: hoursAgo(4), createdAt: hoursAgo(31),
        data: j({ destination: "Chinhoyi and Karoi", dates: [d(3).toISOString().slice(0, 10), d(6).toISOString().slice(0, 10)], purpose: "MICS field supervision, Mashonaland West clusters 14–19.", passengers: 4, needsDriver: true, equipment: "4 tablets, 2 GPS units, camping kit", priority: "NORMAL" }),
      },
    });
    await prisma.requestApproval.create({ data: { requestId: r5.id, levelOrder: 1, levelName: "Approved — Head of Section", approverId: surveysHead.id, status: "APPROVED", comment: "Approved.", actedAt: hoursAgo(20), createdAt: hoursAgo(30) } });
    await prisma.requestApproval.create({ data: { requestId: r5.id, levelOrder: 2, levelName: "Vehicle availability confirmed — Administration (transport)", approverId: registry.id, status: "APPROVED", comment: "Hilux available.", actedAt: hoursAgo(4), createdAt: hoursAgo(20) } });
    await prisma.vehicleTrip.create({ data: { orgId: org.id, requestId: r5.id, requesterId: officer2.id, projectId: mics?.id || null, purpose: "MICS field supervision, Mashonaland West clusters 14–19.", destination: "Chinhoyi and Karoi", passengers: 4, startsAt: d(3), endsAt: d(6, 18), status: "PLANNED" } });
    await prisma.notification.create({ data: { orgId: org.id, userId: hrHead.id, title: `Vehicle needed: ${ref}`, body: "Chinhoyi and Karoi, 4 passengers. Assign a vehicle and driver.", link: "/app/fleet", type: "APPROVAL" } });
    await prisma.vehicleTrip.create({ data: { orgId: org.id, requesterId: officer1.id, driverUserId: registry.id, vehicleId: v1.id, projectId: zdhs?.id || null, purpose: "ZDHS dissemination workshop set-up", destination: "Kadoma", passengers: 3, startsAt: d(1), endsAt: d(1, 18), status: "ASSIGNED" } });
    await prisma.vehicleTrip.create({ data: { orgId: org.id, requesterId: supervisor.id, driverUserId: supervisor.id, vehicleId: v2.id, projectId: mics?.id || null, purpose: "MICS cluster 11 enumeration", destination: "Chegutu", passengers: 4, startsAt: d(-6), endsAt: d(-4, 17), status: "COMPLETED", odometerStart: 91010, odometerEnd: 91530, fuelLitres: 58.5, notes: "Rear left tyre slow puncture; repaired in Chegutu." } });
    await prisma.workflowTemplate.update({ where: { id: vehicleReq.id }, data: { counter: counter + 1 } });
    console.log("Created 4 vehicles and 3 trips");
  }
  console.log("Module seed complete.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
