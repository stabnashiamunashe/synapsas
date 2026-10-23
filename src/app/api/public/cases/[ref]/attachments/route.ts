import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { ApiError, ok, withPublic } from "@/lib/api";
import { clientInfo, constantTimeEqual, rateLimit } from "@/lib/security";
import { extensionOf, safeMimeFor, validateUpload } from "@/lib/uploads";
import { uploadToken } from "../../route";

const PUBLIC_MAX_MB = 8;
const PUBLIC_EXT = ["jpg", "jpeg", "png", "webp", "pdf"];

/** Photos for a just-submitted public report. Needs the upload token returned on creation (valid 30 minutes). */
export const POST = withPublic(async (req, { params }) => {
  const ctx = clientInfo(req);
  const rl = rateLimit(`public-upload:${ctx.ip}`, 20, 60 * 60 * 1000);
  if (!rl.ok) throw new ApiError(429, "Too many uploads. Try again later.");
  const ref = decodeURIComponent(params.ref || "").trim().toUpperCase();
  const c = await prisma.case.findUnique({ where: { referenceNo: ref }, include: { _count: { select: { attachments: true } } } });
  if (!c) throw new ApiError(404, "No case found with that reference");
  const token = req.headers.get("x-upload-token") || "";
  if (!token || !constantTimeEqual(token, uploadToken(c.id, c.createdAt)) || Date.now() - c.createdAt.getTime() > 30 * 60_000) throw new ApiError(403, "Upload window has closed");
  const form = await req.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File).slice(0, 3);
  if (!files.length) throw new ApiError(400, "No file provided");
  if (c._count.attachments + files.length > 5) throw new ApiError(400, "At most 5 photos per report");
  const dir = path.resolve(process.env.UPLOAD_DIR || "./uploads", c.orgId, "cases");
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
    created.push(await prisma.caseAttachment.create({ data: { caseId: c.id, uploadedBy: c.reporterName, fileName: file.name.slice(0, 200), mimeType: safeMimeFor(file.name), size: file.size, storagePath: path.join(/*turbopackIgnore: true*/ c.orgId, "cases", storageName), isPublic: true, stage: "INTAKE" }, select: { id: true, fileName: true, size: true } }));
  }
  return ok(created, { status: 201 });
});
