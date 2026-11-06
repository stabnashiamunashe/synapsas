import { readFile, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound, ok, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { recordScope, registryAccess } from "@/lib/records";
import { contentDisposition, inlineAllowed, safeMimeFor } from "@/lib/uploads";

/** Download (or preview with ?inline=1) a scan attached to a register entry; same visibility as the entry itself. */
export const GET = withAuth(async (req, { params, user }) => {
  const access = await registryAccess(user);
  const a = await prisma.correspondenceAttachment.findFirst({ where: { id: params.id, record: { orgId: user.orgId, AND: [recordScope(user, access)] } } });
  if (!a) throw notFound();
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");
  const abs = path.resolve(root, a.storagePath);
  if (!abs.startsWith(root)) throw notFound();
  const buf = await readFile(/*turbopackIgnore: true*/ abs);
  const inline = new URL(req.url).searchParams.get("inline") === "1" && inlineAllowed(a.fileName);
  return new Response(new Uint8Array(buf), { headers: { "content-type": safeMimeFor(a.fileName), "content-disposition": contentDisposition(inline ? "inline" : "attachment", a.fileName), "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
});

/** Remove a wrongly attached scan (registry / managers only); the removal stays in the timeline and the audit log. */
export const DELETE = withAuth(async (_req, { params, user }) => {
  const access = await registryAccess(user);
  if (!access.canRegister) throw forbidden("Only the registry or a manager can remove a scan");
  const a = await prisma.correspondenceAttachment.findFirst({ where: { id: params.id, record: { orgId: user.orgId } }, include: { record: { select: { id: true, referenceNo: true } } } });
  if (!a) throw notFound();
  await prisma.correspondenceAttachment.delete({ where: { id: a.id } });
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");
  const abs = path.resolve(root, a.storagePath);
  if (abs.startsWith(root)) await unlink(/*turbopackIgnore: true*/ abs).catch(() => undefined);
  await prisma.correspondenceEvent.create({ data: { recordId: a.record.id, kind: "NOTE", actorId: user.id, note: `Scan removed: ${a.fileName}` } });
  await audit(user.orgId, user.id, "record.document_removed", "Correspondence", a.record.id, { referenceNo: a.record.referenceNo, fileName: a.fileName });
  return ok({ id: a.id });
});
