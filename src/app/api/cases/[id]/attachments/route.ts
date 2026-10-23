import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, withAuth } from "@/lib/api";
import { audit } from "@/lib/notify";
import { caseScope } from "@/lib/cases";
import { MAX_FILE_MB, extensionOf, safeMimeFor, validateUpload } from "@/lib/uploads";

export const GET = withAuth(async (_req, { params, user }) => {
  const scope = await caseScope(user);
  const c = await prisma.case.findFirst({ where: { id: params.id, orgId: user.orgId, ...scope }, select: { id: true } });
  if (!c) throw notFound();
  return ok(await prisma.caseAttachment.findMany({ where: { caseId: c.id }, orderBy: { createdAt: "asc" } }));
});

/** multipart "file" (multiple), optional "stage" and "isPublic". Same allowlist and magic-byte checks as request attachments. */
export const POST = withAuth(async (req, { params, user }) => {
  const scope = await caseScope(user);
  const c = await prisma.case.findFirst({ where: { id: params.id, orgId: user.orgId, ...scope }, select: { id: true, orgId: true, referenceNo: true } });
  if (!c) throw notFound();
  const form = await req.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) throw badRequest("No file provided");
  const stage = ["INTAKE", "IN_PROGRESS", "COMPLETION_PROOF"].includes(String(form.get("stage"))) ? String(form.get("stage")) : "IN_PROGRESS";
  const isPublic = String(form.get("isPublic") ?? "true") !== "false";
  const count = await prisma.caseAttachment.count({ where: { caseId: c.id } });
  if (count + files.length > 25) throw badRequest("Too many files on this case (max 25)");
  const dir = path.resolve(process.env.UPLOAD_DIR || "./uploads", user.orgId, "cases");
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const created = [];
  for (const file of files) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) throw badRequest(`${file.name} exceeds ${MAX_FILE_MB} MB`);
    const bytes = Buffer.from(await file.arrayBuffer());
    const problem = validateUpload(file.name, file.type, bytes);
    if (problem) throw badRequest(problem);
    const storageName = `${nanoid(24)}.${extensionOf(file.name)}`;
    await writeFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, storageName), bytes, { mode: 0o600 });
    created.push(await prisma.caseAttachment.create({ data: { caseId: c.id, uploadedById: user.id, uploadedBy: user.name, fileName: file.name.slice(0, 200), mimeType: safeMimeFor(file.name), size: file.size, storagePath: path.join(/*turbopackIgnore: true*/ user.orgId, "cases", storageName), isPublic, stage } }));
  }
  await prisma.case.update({ where: { id: c.id }, data: { lastActivityAt: new Date() } });
  await audit(c.orgId, user.id, "case.attachment_added", "Case", c.id, { count: created.length, stage });
  return ok(created, { status: 201 });
});
