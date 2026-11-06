import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, ok, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { recordScope, registryAccess } from "@/lib/records";
import { MAX_FILE_MB, extensionOf, safeMimeFor, validateUpload } from "@/lib/uploads";

/** Scans of the document and its enclosures: multipart "file" (multiple) with an optional "label" (Original, Enclosure, Reply, Delivery note). */
export const POST = withAuth(async (req, { params, user }) => {
  const access = await registryAccess(user);
  const r = await prisma.correspondence.findFirst({ where: { id: params.id, orgId: user.orgId, AND: [recordScope(user, access)] }, select: { id: true, referenceNo: true, assignedToId: true, registeredById: true, _count: { select: { attachments: true } } } });
  if (!r) throw notFound();
  if (!access.canRegister && r.assignedToId !== user.id && r.registeredById !== user.id) throw forbidden("This item is not routed to you");
  const form = await req.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  const label = String(form.get("label") || "").slice(0, 120) || null;
  if (!files.length) throw badRequest("No file provided");
  if (r._count.attachments + files.length > 30) throw badRequest("At most 30 documents per register entry");
  const dir = path.resolve(process.env.UPLOAD_DIR || "./uploads", user.orgId, "records");
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const created = [];
  for (const file of files) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) throw badRequest(`${file.name} exceeds ${MAX_FILE_MB} MB`);
    const bytes = Buffer.from(await file.arrayBuffer());
    const problem = validateUpload(file.name, file.type, bytes);
    if (problem) throw badRequest(problem);
    const storageName = `${nanoid(24)}.${extensionOf(file.name)}`;
    await writeFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, storageName), bytes, { mode: 0o600 });
    created.push(await prisma.correspondenceAttachment.create({ data: { recordId: r.id, uploadedById: user.id, label, fileName: file.name.slice(0, 200), mimeType: safeMimeFor(file.name), size: file.size, storagePath: path.join(/*turbopackIgnore: true*/ user.orgId, "records", storageName) } }));
  }
  await prisma.correspondenceEvent.create({ data: { recordId: r.id, kind: "DOCUMENT", actorId: user.id, note: `${created.length} scan${created.length === 1 ? "" : "s"} attached${label ? ` (${label})` : ""}: ${created.map((c) => c.fileName).join(", ")}` } });
  await audit(user.orgId, user.id, "record.document_added", "Correspondence", r.id, { referenceNo: r.referenceNo, count: created.length, label });
  return ok(created, { status: 201 });
});
