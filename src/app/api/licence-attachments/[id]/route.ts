import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { notFound, withAuth } from "@/lib/api";
import { contentDisposition, inlineAllowed, safeMimeFor } from "@/lib/uploads";

/** Download a document uploaded with a licence application (staff only). */
export const GET = withAuth(async (req, { params, user }) => {
  const a = await prisma.licenceAttachment.findFirst({ where: { id: params.id, licence: { orgId: user.orgId } } });
  if (!a) throw notFound();
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");
  const abs = path.resolve(root, a.storagePath);
  if (!abs.startsWith(root)) throw notFound();
  const buf = await readFile(/*turbopackIgnore: true*/ abs);
  const inline = new URL(req.url).searchParams.get("inline") === "1" && inlineAllowed(a.fileName);
  return new Response(new Uint8Array(buf), { headers: { "content-type": safeMimeFor(a.fileName), "content-disposition": contentDisposition(inline ? "inline" : "attachment", a.fileName), "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
});
