import { getQuery, notFound, withAuth } from "@/lib/api";
import { fileResponse } from "@/lib/uploads";
import { readStoredDocument } from "@/lib/whatsapp/documents";

/** Download an uploaded chatbot publication (`/api/chatbot/documents/{id}/download`, `?inline=1` for PDF preview). */
export const GET = withAuth(async (req, { params, user }) => {
  if (params.kind !== "documents") throw notFound();
  const file = await readStoredDocument(params.id);
  if (!file || file.orgId !== user.orgId) throw notFound();
  return fileResponse(file.bytes, file.filename, { inline: getQuery(req).get("inline") === "1", mimeType: file.mimeType });
});
