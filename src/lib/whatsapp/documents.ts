// Files the chatbot sends as WhatsApp document messages: tables of the headline figures generated on demand
// (Excel and PDF) and publications staff upload per topic under Settings → Chatbot content.
import { readFile } from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "../prisma";
import { safeMimeFor } from "../uploads";
import { STAT_TOPICS, t, topicLabel, type Lang } from "./i18n";

export type ExportFormat = "xlsx" | "pdf";
/** Where the bytes of a document message come from; resolved only when the message is actually sent. */
export type DocSource =
  | { kind: "stored"; documentId: string }
  | { kind: "export"; orgId: string; topic: string; format: ExportFormat; lang: Lang };
export type DocFile = { bytes: Buffer; mimeType: string; filename: string };

const MIME: Record<ExportFormat, string> = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf" };
// short organisation prefix for file names: the name itself when short, otherwise its initials (Zimbabwe National Statistics Agency → ZNSA)
const slug = (s: string) => {
  const words = s.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!words.length) return "statistics";
  return s.length <= 16 ? words.join("-") : words.filter((w) => /^[A-Z0-9]/.test(w) && !/^(of|and|the|for)$/i.test(w)).map((w) => w[0].toUpperCase()).join("") || words[0];
};
const today = () => new Date().toISOString().slice(0, 10);
// pdf-lib's standard fonts only know WinAnsi: drop anything outside it rather than throwing mid-render
const ansi = (s: string) => s.replace(/→/g, "->").replace(/[^ -~ -ÿ–—‘’“”•…€]/g, "");

export function exportFilename(orgName: string, topic: string, format: ExportFormat) {
  return `${slug(orgName)}-${topic}-headline-statistics-${today()}.${format}`;
}

async function rows(orgId: string, topic: string) {
  return prisma.statIndicator.findMany({ where: { orgId, isActive: true, ...(topic === "ALL" ? {} : { topic }) }, orderBy: [{ topic: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
}
async function orgName(orgId: string) {
  return (await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }))?.name || "Statistics";
}
const date = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** One worksheet: topic, indicator, latest value, reference period, release date, note, source link. */
export async function buildIndicatorsXlsx(orgId: string, topic: string, lang: Lang): Promise<DocFile> {
  const [list, org] = await Promise.all([rows(orgId, topic), orgName(orgId)]);
  const title = topic === "ALL" ? t(lang, "stats_header") : topicLabel(topic, lang);
  const wb = new ExcelJS.Workbook();
  wb.creator = org; wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = `${org} — ${title}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.mergeCells("A2:G2");
  ws.getCell("A2").value = `${t(lang, "fx_generated")} ${today()}`;
  ws.getCell("A2").font = { italic: true, color: { argb: "FF666666" } };
  const header = [t(lang, "fx_topic"), t(lang, "fx_indicator"), t(lang, "fx_value"), t(lang, "stats_period"), t(lang, "stats_released"), t(lang, "fx_note"), t(lang, "fx_source")];
  const h = ws.addRow([]); // spacer (row 3)
  void h;
  const hr = ws.addRow(header);
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } }; cell.alignment = { vertical: "middle", wrapText: true }; });
  for (const i of list) {
    const r = ws.addRow([topicLabel(i.topic, lang), i.name, i.value, i.period || "", date(i.releaseDate), i.note || "", i.url || ""]);
    if (i.url) r.getCell(7).value = { text: i.url, hyperlink: i.url }; r.getCell(7).font = { color: { argb: "FF0F62FE" }, underline: true };
  }
  [22, 40, 20, 22, 14, 44, 44].forEach((w, idx) => { ws.getColumn(idx + 1).width = w; });
  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + Math.max(list.length, 1), column: header.length } };
  const bytes = Buffer.from(await wb.xlsx.writeBuffer());
  return { bytes, mimeType: MIME.xlsx, filename: exportFilename(org, topic, "xlsx") };
}

/** A4 portrait table, paged, with the generation date and the source line in the footer. */
export async function buildIndicatorsPdf(orgId: string, topic: string, lang: Lang, odpUrl?: string | null): Promise<DocFile> {
  const [list, org] = await Promise.all([rows(orgId, topic), orgName(orgId)]);
  const title = topic === "ALL" ? t(lang, "stats_header") : topicLabel(topic, lang);
  const doc = await PDFDocument.create();
  doc.setTitle(`${org} — ${title}`); doc.setAuthor(org); doc.setCreationDate(new Date());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 40;
  const cols = [{ key: "name", w: 175, label: t(lang, "fx_indicator") }, { key: "value", w: 105, label: t(lang, "fx_value") }, { key: "period", w: 105, label: t(lang, "stats_period") }, { key: "date", w: 58, label: t(lang, "stats_released") }, { key: "topic", w: 72, label: t(lang, "fx_topic") }];
  const navy = rgb(0.12, 0.31, 0.47), grey = rgb(0.45, 0.45, 0.45), line = rgb(0.85, 0.85, 0.85);
  // word-wrap into lines no wider than w at the given size
  const wrap = (s: string, w: number, size: number, f = font) => {
    const words = ansi(s).split(/\s+/).filter(Boolean); const out: string[] = []; let cur = "";
    for (const word of words) { const next = cur ? `${cur} ${word}` : word; if (f.widthOfTextAtSize(next, size) <= w) cur = next; else { if (cur) out.push(cur); cur = word; while (f.widthOfTextAtSize(cur, size) > w && cur.length > 1) { let n = cur.length; while (n > 1 && f.widthOfTextAtSize(cur.slice(0, n), size) > w) n--; out.push(cur.slice(0, n)); cur = cur.slice(n); } } }
    if (cur) out.push(cur); return out.length ? out : [""];
  };
  let page = doc.addPage([W, H]); let y = H - M; let pageNo = 1;
  const footer = () => {
    page.drawText(ansi(`${t(lang, "fx_generated")} ${today()} · ${org}${odpUrl ? ` · ${odpUrl}` : ""}`), { x: M, y: 22, size: 8, font, color: grey });
    page.drawText(String(pageNo), { x: W - M - 10, y: 22, size: 8, font, color: grey });
  };
  const headerRow = () => {
    let x = M; page.drawRectangle({ x: M, y: y - 16, width: W - 2 * M, height: 18, color: navy });
    for (const c of cols) { page.drawText(ansi(c.label), { x: x + 4, y: y - 11, size: 8.5, font: bold, color: rgb(1, 1, 1) }); x += c.w; }
    y -= 22;
  };
  const newPage = () => { footer(); page = doc.addPage([W, H]); pageNo++; y = H - M; headerRow(); };
  page.drawText(ansi(org), { x: M, y: y - 14, size: 16, font: bold, color: navy }); y -= 20;
  page.drawText(ansi(title), { x: M, y: y - 12, size: 12, font: bold }); y -= 16;
  page.drawText(ansi(`${t(lang, "fx_generated")} ${today()}`), { x: M, y: y - 10, size: 9, font, color: grey }); y -= 22;
  headerRow();
  if (!list.length) { page.drawText(ansi(t(lang, "stats_none")), { x: M, y: y - 10, size: 10, font }); y -= 16; }
  for (const i of list) {
    const cells: Record<string, string[]> = { name: wrap(i.name, cols[0].w - 8, 9), value: wrap(i.value, cols[1].w - 8, 9, bold), period: wrap(i.period || "", cols[2].w - 8, 9), date: [date(i.releaseDate)], topic: wrap(topicLabel(i.topic, lang), cols[4].w - 8, 7.5) };
    const noteLines = i.note ? wrap(i.note, W - 2 * M - 8, 7.5) : [];
    const lines = Math.max(...Object.values(cells).map((l) => l.length));
    const rowH = lines * 11 + noteLines.length * 9.5 + 8;
    if (y - rowH < 40) newPage();
    let x = M;
    for (const c of cols) { const ls = cells[c.key]; ls.forEach((ln, k) => page.drawText(ln, { x: x + 4, y: y - 10 - k * 11, size: c.key === "topic" ? 7.5 : 9, font: c.key === "value" ? bold : font, color: c.key === "topic" ? grey : rgb(0, 0, 0) })); x += c.w; }
    noteLines.forEach((ln, k) => page.drawText(ln, { x: M + 4, y: y - 10 - lines * 11 - k * 9.5, size: 7.5, font, color: grey }));
    y -= rowH;
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.5, color: line });
  }
  footer();
  const bytes = Buffer.from(await doc.save());
  return { bytes, mimeType: MIME.pdf, filename: exportFilename(org, topic, "pdf") };
}

/** Read an uploaded publication from UPLOAD_DIR (path confined to the uploads root). */
export async function readStoredDocument(documentId: string): Promise<(DocFile & { id: string; orgId: string }) | null> {
  const d = await prisma.statDocument.findUnique({ where: { id: documentId } });
  if (!d) return null;
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");
  const abs = path.resolve(root, d.storagePath);
  if (!abs.startsWith(root + path.sep)) return null;
  try {
    const bytes = await readFile(/*turbopackIgnore: true*/ abs);
    return { id: d.id, orgId: d.orgId, bytes, mimeType: safeMimeFor(d.fileName), filename: d.fileName };
  } catch (e) { console.error("[whatsapp] stored document unreadable", d.id, e); return null; }
}

/** Resolve a document source to bytes (used when sending for real; the sandbox links to the download routes instead). */
export async function resolveDocument(src: DocSource): Promise<DocFile | null> {
  if (src.kind === "stored") return readStoredDocument(src.documentId);
  if (!STAT_TOPICS.some((x) => x.key === src.topic) && src.topic !== "ALL") return null;
  if (src.format === "xlsx") return buildIndicatorsXlsx(src.orgId, src.topic, src.lang);
  const org = await prisma.organization.findUnique({ where: { id: src.orgId }, select: { settings: true } });
  const odpUrl = (JSON.parse(org?.settings || "{}") as { cases?: { whatsapp?: { odpUrl?: string } } }).cases?.whatsapp?.odpUrl || null;
  return buildIndicatorsPdf(src.orgId, src.topic, src.lang, odpUrl);
}

/** In-app URL that serves the same bytes (sandbox preview and staff downloads). */
export function documentUrl(src: DocSource) {
  return src.kind === "stored" ? `/api/chatbot/documents/${src.documentId}/download` : `/api/chatbot/export?topic=${encodeURIComponent(src.topic)}&format=${src.format}&lang=${src.lang}`;
}
