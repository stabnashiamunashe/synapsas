import { badRequest, getQuery, withAuth } from "@/lib/api";
import { fileResponse } from "@/lib/uploads";
import { resolveDocument, type ExportFormat } from "@/lib/whatsapp/documents";
import { STAT_TOPICS, isLang, type Lang } from "@/lib/whatsapp/i18n";

/**
 * The Excel/PDF table the chatbot sends for a topic, generated from the current indicators.
 * `?topic=CPI|...|ALL&format=xlsx|pdf&lang=en|sn|nd`. Used by the sandbox preview and by staff to check what goes out.
 */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const topic = q.get("topic") || "ALL";
  if (topic !== "ALL" && !STAT_TOPICS.some((x) => x.key === topic)) throw badRequest("Unknown topic");
  const format: ExportFormat = q.get("format") === "pdf" ? "pdf" : "xlsx";
  const lang: Lang = isLang(q.get("lang") || "") ? (q.get("lang") as Lang) : "en";
  const file = await resolveDocument({ kind: "export", orgId: user.orgId, topic, format, lang });
  if (!file) throw badRequest("Nothing to export");
  return fileResponse(file.bytes, file.filename, { inline: q.get("inline") === "1", mimeType: file.mimeType });
});
