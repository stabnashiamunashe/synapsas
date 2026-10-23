import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, ok, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { limitsFor } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import { audit } from "@/lib/notify";
import { MAX_FILE_MB, extensionOf, safeMimeFor, validateUpload } from "@/lib/uploads";

export const GET = withAuth(async (_req, { params, user }) => {
  const r = await prisma.request.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!r) throw notFound();
  const list = await prisma.attachment.findMany({
    where: { requestId: r.id },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return ok(list);
});

/**
 * multipart/form-data upload: field name "file" (multiple allowed). Stored on local disk under UPLOAD_DIR with a
 * random name (the original name is kept in the database only). Type allowlist + magic-byte check in lib/uploads.
 */
export const POST = withAuth(async (req, { params, user }) => {
  const r = await prisma.request.findFirst({
    where: { id: params.id, orgId: user.orgId },
    include: { approvals: { select: { approverId: true } } },
  });
  if (!r) throw notFound();
  const involved = r.requesterId === user.id || r.approvals.some((a) => a.approverId === user.id);
  if (!involved && !hasRole(user, "ADMIN")) throw forbidden();
  if (!["DRAFT", "RETURNED", "PENDING"].includes(r.status)) throw forbidden("Files cannot be added to a completed request");

  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  const limits = limitsFor(effectivePlan(org!));
  const used = await prisma.attachment.aggregate({ where: { request: { orgId: user.orgId } }, _sum: { size: true } });
  const count = await prisma.attachment.count({ where: { requestId: r.id } });

  const form = await req.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) throw badRequest("No file provided");
  if (files.length > 10 || count + files.length > 25) throw badRequest("Too many files on this request (max 25)");
  const dir = path.resolve(process.env.UPLOAD_DIR || "./uploads", user.orgId);
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });

  let usedBytes = used._sum.size || 0;
  const created = [];
  for (const file of files) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) throw badRequest(`${file.name} exceeds ${MAX_FILE_MB} MB`);
    if (usedBytes + file.size > limits.storageMb * 1024 * 1024) throw badRequest("Storage limit reached for your plan.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const problem = validateUpload(file.name, file.type, bytes);
    if (problem) throw badRequest(problem);
    const storageName = `${nanoid(24)}.${extensionOf(file.name)}`;
    const target = path.join(dir, storageName);
    if (!target.startsWith(dir + path.sep)) throw badRequest("Invalid file name");
    await writeFile(/*turbopackIgnore: true*/ target, bytes, { mode: 0o600 });
    const a = await prisma.attachment.create({
      data: {
        requestId: r.id,
        uploadedById: user.id,
        fileName: file.name.slice(0, 200),
        mimeType: safeMimeFor(file.name),
        size: file.size,
        storagePath: path.join(user.orgId, storageName),
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    usedBytes += file.size;
    created.push(a);
  }
  await audit(user.orgId, user.id, "request.attachment_added", "Request", r.id, { count: created.length, names: created.map((c) => c.fileName) });
  return ok(created, { status: 201 });
});
