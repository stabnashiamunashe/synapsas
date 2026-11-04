import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { ApiError, ok, withPublic } from "@/lib/api";
import { clientInfo, constantTimeEqual, rateLimit } from "@/lib/security";
import { extensionOf, safeMimeFor, validateUpload } from "@/lib/uploads";
import { licenceUploadToken } from "@/lib/licensing";

const PUBLIC_MAX_MB = 8;
const PUBLIC_EXT = ["jpg", "jpeg", "png", "webp", "pdf"];

/**
 * Supporting documents for an application. Needs the upload token returned on creation or by the tracking lookup
 * (which already proved the applicant knows the phone number or email on the application). Up to 15 files.
 * An optional `label` names the required document each file satisfies, which ticks it on the officer's checklist.
 */
export const POST = withPublic(async (req, { params }) => {
  const ctx = clientInfo(req);
  const rl = rateLimit(`public-licence-upload:${ctx.ip}`, 40, 60 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many uploads. Try again later.");
  const ref = decodeURIComponent(params.ref || "").trim().toUpperCase();
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const l = org ? await prisma.licence.findFirst({ where: { orgId: org.id, referenceNo: ref }, include: { _count: { select: { attachments: true } } } }) : null;
  if (!l) throw new ApiError(404, "No application found with that reference");
  const token = req.headers.get("x-upload-token") || "";
  if (!token || !constantTimeEqual(token, licenceUploadToken(l.id, l.createdAt))) throw new ApiError(403, "Not allowed to add documents to this application");
  if (["ISSUED", "REJECTED", "REVOKED", "CANCELLED", "EXPIRED"].includes(l.status)) throw new ApiError(400, "This application is closed; documents can no longer be added");
  const form = await req.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File).slice(0, 5);
  const label = String(form.get("label") || "").slice(0, 200) || null;
  if (!files.length) throw new ApiError(400, "No file provided");
  if (l._count.attachments + files.length > 15) throw new ApiError(400, "At most 15 documents per application");
  const dir = path.resolve(process.env.UPLOAD_DIR || "./uploads", l.orgId, "licences");
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const created = [];
  for (const file of files) {
    if (file.size > PUBLIC_MAX_MB * 1024 * 1024) throw new ApiError(400, `${file.name} exceeds ${PUBLIC_MAX_MB} MB`);
    if (!PUBLIC_EXT.includes(extensionOf(file.name))) throw new ApiError(400, "Only photos (JPG, PNG, WebP) or PDF files are accepted");
    const bytes = Buffer.from(await file.arrayBuffer());
    const problem = validateUpload(file.name, file.type, bytes);
    if (problem) throw new ApiError(400, problem);
    const storageName = `${nanoid(24)}.${extensionOf(file.name)}`;
    await writeFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, storageName), bytes, { mode: 0o600 });
    created.push(await prisma.licenceAttachment.create({ data: { licenceId: l.id, uploadedBy: l.applicantName, label, fileName: file.name.slice(0, 200), mimeType: safeMimeFor(file.name), size: file.size, storagePath: path.join(/*turbopackIgnore: true*/ l.orgId, "licences", storageName) }, select: { id: true, label: true, fileName: true, size: true } }));
  }
  // tick the matching requirement on the officer's checklist and record it
  const docs = ((l.documents as { name: string; received: boolean }[]) || []).map((d) => (label && d.name === label ? { ...d, received: true } : d));
  await prisma.licence.update({ where: { id: l.id }, data: { documents: docs, events: { create: { kind: "DOCUMENT", note: `${created.length} document${created.length === 1 ? "" : "s"} uploaded by the applicant${label ? ` (${label})` : ""}` } } } });
  return ok(created, { status: 201 });
});
