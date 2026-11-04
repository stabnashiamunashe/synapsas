import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, getQuery, ok, parseBody, withAuth } from "@/lib/api";
import { audit, notify } from "@/lib/notify";
import { hasRole } from "@/lib/auth";
import { licenceInclude, nextLicenceReference, serializeLicence } from "@/lib/licensing";
import { LICENCE_OPEN, LICENCE_STATUSES } from "@/lib/licenceTypes";

export const licenceSchema = z.object({
  typeId: z.string().min(1),
  applicantName: z.string().min(2).max(160),
  tradingName: z.string().max(160).optional().nullable(),
  idNumber: z.string().max(40).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(160).optional().nullable().or(z.literal("")),
  standNumber: z.string().max(60).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  ward: z.string().max(40).optional().nullable(),
  activity: z.string().max(5000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  officerId: z.string().optional().nullable(),
  documents: z.array(z.object({ name: z.string().min(1).max(200), received: z.boolean() })).max(40).optional(),
  renewedFromId: z.string().optional().nullable(),
});

/**
 * Licence register. Filters: status (comma list), typeId, category, ward, q (applicant, trading name, stand, licence no.),
 * expiring=30 (issued licences lapsing within N days), mine=1 (handled or to be inspected by me). ?format=csv exports.
 */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const where: Prisma.LicenceWhereInput = { orgId: user.orgId };
  if (q.get("status")) where.status = { in: q.get("status")!.split(",").filter((s) => (LICENCE_STATUSES as readonly string[]).includes(s)) };
  if (q.get("open") === "1") where.status = { in: [...LICENCE_OPEN] };
  if (q.get("typeId")) where.typeId = q.get("typeId")!;
  if (q.get("category")) where.type = { category: q.get("category")! };
  if (q.get("ward")) where.ward = q.get("ward")!;
  if (q.get("mine") === "1") where.OR = [{ officerId: user.id }, { inspectorId: user.id }];
  const expiring = Number(q.get("expiring"));
  if (expiring) { where.status = "ISSUED"; where.expiresAt = { gte: new Date(), lte: new Date(Date.now() + expiring * 86400000) }; }
  const s = q.get("q")?.trim();
  if (s) where.AND = [{ OR: [{ applicantName: { contains: s } }, { tradingName: { contains: s } }, { standNumber: { contains: s } }, { licenceNo: { contains: s } }, { referenceNo: { contains: s } }, { phone: { contains: s } }] }];
  const list = await prisma.licence.findMany({ where, include: licenceInclude, orderBy: [{ updatedAt: "desc" }], take: 2000 });
  if (q.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Reference", "Licence no.", "Type", "Category", "Applicant", "Trading name", "Stand", "Ward", "Status", "Priority", "Fee", "Paid", "Receipt", "Issued", "Expires", "Officer"];
    const body = list.map((l) => [l.referenceNo, l.licenceNo, l.type.name, l.type.category, l.applicantName, l.tradingName, l.standNumber, l.ward, l.status, l.priority, Number(l.feeAmount), l.paidAt?.toISOString().slice(0, 10), l.receiptNo, l.issuedAt?.toISOString().slice(0, 10), l.expiresAt?.toISOString().slice(0, 10), l.officer?.name].map(esc).join(","));
    return new Response([head.map(esc).join(","), ...body].join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="licences-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
  }
  const [counts, expiringSoon, revenue] = await Promise.all([
    prisma.licence.groupBy({ by: ["status"], where: { orgId: user.orgId }, _count: { _all: true } }),
    prisma.licence.count({ where: { orgId: user.orgId, status: "ISSUED", expiresAt: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) } } }),
    prisma.licence.aggregate({ where: { orgId: user.orgId, paidAt: { gte: new Date(new Date().getFullYear(), 0, 1) } }, _sum: { feeAmount: true } }),
  ]);
  return ok({ items: list.map(serializeLicence), counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])), expiringSoon, revenueYtd: Number(revenue._sum.feeAmount || 0) });
});

/** Log a new application (walk-in or received by post). The fee and document checklist come from the licence type. */
export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, licenceSchema);
  const type = await prisma.licenceType.findFirst({ where: { id: body.typeId, orgId: user.orgId, isActive: true } });
  if (!type) throw badRequest("Choose a licence type");
  const required = (type.requirements as string[]) || [];
  const documents = body.documents?.length ? body.documents : required.map((name) => ({ name, received: false }));
  const officerId = hasRole(user, "MANAGER") ? body.officerId || user.id : user.id;
  const referenceNo = await nextLicenceReference(user.orgId);
  const l = await prisma.licence.create({
    data: {
      orgId: user.orgId, typeId: type.id, referenceNo, status: "SUBMITTED", applicantName: body.applicantName, tradingName: body.tradingName || null, idNumber: body.idNumber || null, phone: body.phone || null, email: body.email || null,
      standNumber: body.standNumber || null, address: body.address || null, ward: body.ward || null, activity: body.activity || null, priority: body.priority || "MEDIUM", feeAmount: type.fee, currency: type.currency,
      officerId, documents, renewedFromId: body.renewedFromId || null,
      events: { create: { kind: "SUBMITTED", toStatus: "SUBMITTED", actorId: user.id, note: body.renewedFromId ? "Renewal application" : "Application received" } },
    },
    include: licenceInclude,
  });
  if (type.departmentId) {
    const d = await prisma.department.findUnique({ where: { id: type.departmentId }, select: { headUserId: true } });
    if (d?.headUserId && d.headUserId !== user.id) await notify(user.orgId, [d.headUserId], { title: `New licence application: ${referenceNo}`, body: `${type.name} for ${body.tradingName || body.applicantName}.`, link: `/app/licences?open=${l.id}`, type: "INFO" });
  }
  await audit(user.orgId, user.id, "licence.submitted", "Licence", l.id, { referenceNo, type: type.code });
  return ok(serializeLicence(l), { status: 201 });
});
