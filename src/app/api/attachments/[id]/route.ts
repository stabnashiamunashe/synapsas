import { readFile, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound, ok, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { audit } from "@/lib/notify";

export const GET = withAuth(async (_req, { params, user }) => {
  const a = await prisma.attachment.findFirst({
    where: { id: params.id, request: { orgId: user.orgId } },
    include: { request: { include: { approvals: { select: { approverId: true } } } } },
  });
  if (!a) throw notFound();
  const involved = a.request.requesterId === user.id || a.request.approvals.some((x) => x.approverId === user.id);
  if (!involved && !hasRole(user, "MANAGER")) throw forbidden();
  const abs = path.resolve(process.env.UPLOAD_DIR || "./uploads", a.storagePath);
  const buf = await readFile(/*turbopackIgnore: true*/ abs);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": a.mimeType,
      "content-disposition": `inline; filename="${encodeURIComponent(a.fileName)}"`,
      "content-length": String(a.size),
    },
  });
});

export const DELETE = withAuth(async (_req, { params, user }) => {
  const a = await prisma.attachment.findFirst({ where: { id: params.id, request: { orgId: user.orgId } }, include: { request: true } });
  if (!a) throw notFound();
  const canDelete = a.uploadedById === user.id || hasRole(user, "ADMIN");
  if (!canDelete) throw forbidden();
  if (!["DRAFT", "RETURNED", "PENDING"].includes(a.request.status)) throw forbidden("Cannot remove files from a completed request");
  await prisma.attachment.delete({ where: { id: a.id } });
  try {
    await unlink(/*turbopackIgnore: true*/ path.resolve(process.env.UPLOAD_DIR || "./uploads", a.storagePath));
  } catch {
    /* file already gone */
  }
  await audit(user.orgId, user.id, "request.attachment_removed", "Request", a.requestId, { fileName: a.fileName });
  return ok({ id: a.id });
});
