import { readFile, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { forbidden, getQuery, notFound, ok, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { audit } from "@/lib/notify";
import { contentDisposition, inlineAllowed, safeMimeFor } from "@/lib/uploads";

/**
 * Download. Served with nosniff, a sandboxed CSP and `attachment` disposition by default; `?inline=1` is honoured
 * only for images and PDF. Access: requester, any approver on the request, or MANAGER+.
 */
export const GET = withAuth(async (req, { params, user }) => {
  const a = await prisma.attachment.findFirst({
    where: { id: params.id, request: { orgId: user.orgId } },
    include: { request: { include: { approvals: { select: { approverId: true } } } } },
  });
  if (!a) throw notFound();
  const involved = a.request.requesterId === user.id || a.request.approvals.some((x) => x.approverId === user.id);
  if (!involved && !hasRole(user, "MANAGER")) throw forbidden();
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");
  const abs = path.resolve(root, a.storagePath);
  if (!abs.startsWith(root + path.sep)) throw notFound();
  const buf = await readFile(/*turbopackIgnore: true*/ abs);
  const inline = getQuery(req).get("inline") === "1" && inlineAllowed(a.fileName);
  await audit(user.orgId, user.id, "request.attachment_downloaded", "Request", a.requestId, { fileName: a.fileName });
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": safeMimeFor(a.fileName),
      "content-disposition": contentDisposition(inline ? "inline" : "attachment", a.fileName),
      "content-length": String(buf.length),
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
      "cache-control": "private, no-store",
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
