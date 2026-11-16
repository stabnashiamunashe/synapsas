import { badRequest, getQuery, ok, withAuth } from "@/lib/api";
import { caseSettings } from "@/lib/cases";
import { fileResponse } from "@/lib/uploads";
import { buildOdpFile } from "@/lib/whatsapp/documents";
import { STAT_TOPICS, isLang, topicLabel, type Lang } from "@/lib/whatsapp/i18n";
import { datasetsForTopic, findDataset, getCatalog, odpBase, topicPage, type OdpFormat } from "@/lib/whatsapp/odp";

/**
 * Open Data Portal datasets as the chatbot sees them.
 *   GET /api/chatbot/odp                                  → per topic: the datasets the portal files under it
 *   GET /api/chatbot/odp?dataset=ZW1,DF_CPI_ZWG,1.0&format=csv|xlsx|png&lang=en[&inline=1] → the file the bot sends
 */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const base = odpBase((await caseSettings(user.orgId)).whatsapp?.odpUrl);
  const dataset = q.get("dataset");
  if (dataset) {
    const format = q.get("format") as OdpFormat;
    if (!["csv", "xlsx", "png"].includes(format)) throw badRequest("format must be csv, xlsx or png");
    if (!(await findDataset(base, dataset))) throw badRequest("Unknown dataset");
    const lang: Lang = isLang(q.get("lang") || "") ? (q.get("lang") as Lang) : "en";
    const file = await buildOdpFile(base, dataset, format, lang);
    if (!file) throw badRequest("The dataset could not be fetched from the Open Data Portal");
    return fileResponse(file.bytes, file.filename, { inline: q.get("inline") === "1" || format === "png", mimeType: file.mimeType });
  }
  const catalog = await getCatalog(base);
  const topics = await Promise.all(STAT_TOPICS.map(async (t) => {
    const datasets = await datasetsForTopic(base, t.key);
    return { key: t.key, group: t.group, name: topicLabel(t.key, "en"), categories: t.odp.filter((id) => catalog?.categories.has(id)), count: datasets.length, newest: datasets[0]?.lastUpdate || null, page: datasets.length ? await topicPage(base, t.key) : null, datasets: datasets.slice(0, 12).map((d) => ({ id: d.id, title: d.title, lastUpdate: d.lastUpdate })) };
  }));
  return ok({ base, reachable: !!catalog, datasetCount: catalog?.datasets.size || 0, topics });
});
