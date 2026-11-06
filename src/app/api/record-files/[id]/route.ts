import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { recordInclude, recordScope, registryAccess, serializeRecord } from "@/lib/records";
import { RECORD_DONE } from "@/lib/recordTypes";
import { fileInclude, fileSchema } from "../route";

/** A file with the correspondence placed on it (only the items the caller may see). */
export const GET = withAuth(async (_req, { params, user }) => {
  const access = await registryAccess(user);
  const f = await prisma.recordFile.findFirst({ where: { id: params.id, orgId: user.orgId }, include: { ...fileInclude, records: { where: recordScope(user, access), include: recordInclude, orderBy: { dateLogged: "desc" }, take: 200 } } });
  if (!f) throw notFound();
  return ok({ ...f, records: f.records.map(serializeRecord) });
});

/** Edit, close (status CLOSED, stamps closedAt) or reopen a file. */
export const PATCH = withAuth(async (req, { params, user }) => {
  const access = await registryAccess(user);
  if (!access.canRegister) throw forbidden("Only the registry or a manager can change the file plan");
  const f = await prisma.recordFile.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!f) throw notFound();
  const body = await parseBody(req, fileSchema.partial());
  const fileNo = body.fileNo?.toUpperCase();
  if (fileNo && fileNo !== f.fileNo && (await prisma.recordFile.findUnique({ where: { orgId_fileNo: { orgId: user.orgId, fileNo } } }))) throw badRequest("A file with that number already exists");
  const closing = body.status === "CLOSED" && f.status !== "CLOSED";
  const reopening = body.status === "OPEN" && f.status !== "OPEN";
  if (closing) {
    const open = await prisma.correspondence.count({ where: { fileId: f.id, status: { notIn: [...RECORD_DONE] } } });
    if (open) throw badRequest(`${open} item${open === 1 ? " is" : "s are"} still open on this file; file or move them first`);
  }
  const opt = <T,>(v: T | null | undefined) => (v === undefined ? undefined : v || null);
  const updated = await prisma.recordFile.update({ where: { id: f.id }, data: { fileNo, title: body.title, series: body.series, description: opt(body.description), departmentId: opt(body.departmentId), retentionYears: body.retentionYears === undefined ? undefined : body.retentionYears, location: opt(body.location), confidential: body.confidential, status: body.status, closedAt: closing ? new Date() : reopening ? null : undefined }, include: fileInclude });
  await audit(user.orgId, user.id, closing ? "recordFile.closed" : reopening ? "recordFile.reopened" : "recordFile.updated", "RecordFile", f.id, { fileNo: updated.fileNo, fields: Object.keys(body) });
  return ok(updated);
});

/** Delete a file that has never had anything placed on it; otherwise close it instead. */
export const DELETE = withAuth(async (_req, { params, user }) => {
  const f = await prisma.recordFile.findFirst({ where: { id: params.id, orgId: user.orgId }, include: { _count: { select: { records: true } } } });
  if (!f) throw notFound();
  if (f._count.records) throw badRequest("This file has correspondence on it. Close it instead of deleting it.");
  await prisma.recordFile.delete({ where: { id: f.id } });
  await audit(user.orgId, user.id, "recordFile.deleted", "RecordFile", f.id, { fileNo: f.fileNo });
  return ok({ id: f.id });
}, "ADMIN");
