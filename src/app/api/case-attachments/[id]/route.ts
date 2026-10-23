import { readFile, unlink } from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { forbidden, getQuery, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { audit } from "@/lib/notify";
import { caseScope } from "@/lib/cases";
import { contentDisposition, inlineAllowed, safeMimeFor } from "@/lib/uploads";

async function load(id: string, user: Parameters<typeof caseScope>[0]) {
  const scope = await caseScope(user);
  const a = await prisma.caseAttachment.findFirst({ where: { id, case: { orgId: user.orgId, ...scope } }, include: { case: { select: { id: true, orgId: true } } } });
  if (!a) throw notFound();
  return a;
}

export const GET = withAuth(async (req, { params, user }) => {
  const a = await load(params.id, user);
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");
  const abs = path.resolve(root, a.storagePath);
  if (!abs.startsWith(root + path.sep)) throw notFound();
  const buf = await readFile(/*turbopackIgnore: true*/ abs);
  const inline = getQuery(req).get("inline") === "1" && inlineAllowed(a.fileName);
  return new Response(new Uint8Array(buf), {
    headers: { "content-type": safeMimeFor(a.fileName), "content-disposition": contentDisposition(inline ? "inline" : "attachment", a.fileName), "content-length": String(buf.length), "x-content-type-options": "nosniff", "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'", "cache-control": "private, no-store" },
  });
});

/** Toggle public visibility (shown on the tracking page) or stage. */
export const PATCH = withAuth(async (req, { params, user }) => {
  const a = await load(params.id, user);
  const body = await parseBody(req, z.object({ isPublic: z.boolean().optional(), stage: z.enum(["INTAKE", "IN_PROGRESS", "COMPLETION_PROOF"]).optional() }));
  return ok(await prisma.caseAttachment.update({ where: { id: a.id }, data: body }));
});

export const DELETE = withAuth(async (_req, { params, user }) => {
  const a = await load(params.id, user);
  if (a.uploadedById !== user.id && !hasRole(user, "MANAGER")) throw forbidden();
  await prisma.caseAttachment.delete({ where: { id: a.id } });
  try { await unlink(/*turbopackIgnore: true*/ path.resolve(process.env.UPLOAD_DIR || "./uploads", a.storagePath)); } catch { /* already gone */ }
  await audit(a.case.orgId, user.id, "case.attachment_removed", "Case", a.case.id, { fileName: a.fileName });
  return ok({ id: a.id });
});
