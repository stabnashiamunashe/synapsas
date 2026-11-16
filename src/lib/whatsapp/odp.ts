// The ZIMSTAT Open Data Portal (an Istat "Data Browser" instance): the bot reads its catalogue to list the datasets
// under each topic, and fetches a dataset as SDMX-JSON to send it on WhatsApp as a CSV file, an Excel workbook or a
// chart image. Nothing is stored locally; the catalogue is cached in memory for half an hour.
import ExcelJS from "exceljs";
import { STAT_TOPICS, t, type Lang } from "./i18n";

export const DEFAULT_ODP = "https://zimstat.opendataforafrica.org";
const NODE = process.env.ODP_NODE_ID || "1";
const CATALOG_TTL_MS = 30 * 60_000;
const FETCH_TIMEOUT_MS = 45_000;
const MAX_BYTES = 30 * 1024 * 1024; // refuse to parse anything bigger (the bot sends the portal link instead)
const MAX_ROWS = 100_000;
export const MAX_LIST = 8; // dataset rows the bot lists per topic (WhatsApp allows 10 rows incl. navigation)

/** Origin of the portal from the organisation's ODP setting; the public ZIMSTAT portal when the setting is blank. */
export function odpBase(odpUrl?: string | null) {
  try { return new URL(odpUrl || "").origin; } catch { return DEFAULT_ODP; }
}

export type OdpDataset = { id: string; title: string; lastUpdate: string | null; path: string[] };
type Category = { id: string; label: string; path: string[]; datasets: OdpDataset[] };
export type Catalog = { nodeCode: string; categories: Map<string, Category>; datasets: Map<string, OdpDataset> };

const ID_RE = /^[A-Za-z0-9_.,@-]{3,120}$/;
const cache = new Map<string, { at: number; cat: Catalog | null; pending?: Promise<Catalog | null> }>();

async function fetchBytes(url: string, init?: RequestInit): Promise<Buffer> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: "application/json", "user-agent": "ZIMSTAT-WhatsApp-bot", ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`ODP ${res.status} for ${url}`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_BYTES) throw new Error(`ODP response too large (${len} bytes)`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`ODP response too large (${buf.length} bytes)`);
  return buf;
}
const fetchJson = async <T,>(url: string, init?: RequestInit) => JSON.parse((await fetchBytes(url, init)).toString("utf8")) as T;

type RawCategory = { id: string; label: string; childrenCategories?: RawCategory[]; datasetIdentifiers?: string[] };
type RawCatalog = { categoryGroups?: { categories?: RawCategory[] }[]; datasetMap?: Record<string, { title?: string; lastUpdate?: string }> };

async function loadCatalog(base: string): Promise<Catalog> {
  const [raw, node] = await Promise.all([
    fetchJson<RawCatalog>(`${base}/api/Core/nodes/${NODE}/catalog`),
    fetchJson<{ code?: string }>(`${base}/api/Core/nodes/${NODE}`).catch(() => ({ code: "zw1" })),
  ]);
  const categories = new Map<string, Category>();
  const datasets = new Map<string, OdpDataset>();
  const walk = (c: RawCategory, parents: string[]) => {
    const path = [...parents, c.id];
    const own: OdpDataset[] = [];
    for (const id of c.datasetIdentifiers || []) {
      if (!ID_RE.test(id)) continue;
      const meta = raw.datasetMap?.[id] || {};
      const d = datasets.get(id) || { id, title: (meta.title || id).trim(), lastUpdate: meta.lastUpdate || null, path };
      datasets.set(id, d); own.push(d);
    }
    const cat: Category = { id: c.id, label: c.label, path, datasets: own };
    categories.set(c.id, cat);
    for (const ch of c.childrenCategories || []) { walk(ch, path); cat.datasets.push(...(categories.get(ch.id)?.datasets || [])); }
  };
  for (const g of raw.categoryGroups || []) for (const c of g.categories || []) walk(c, []);
  return { nodeCode: (node.code || "zw1").toLowerCase(), categories, datasets };
}

/** The portal catalogue (cached). Returns null when the portal cannot be reached and nothing is cached. */
export async function getCatalog(base: string): Promise<Catalog | null> {
  const hit = cache.get(base);
  if (hit && Date.now() - hit.at < CATALOG_TTL_MS && hit.cat) return hit.cat;
  if (hit?.pending) return hit.pending;
  const pending = loadCatalog(base)
    .then((cat) => { cache.set(base, { at: Date.now(), cat }); return cat; })
    .catch((e) => { const cause = (e as { cause?: { code?: string; message?: string } }).cause; console.error("[odp] catalogue unavailable", (e as Error).message, cause?.code || "", cause?.message || ""); cache.set(base, { at: Date.now() - CATALOG_TTL_MS + 60_000, cat: hit?.cat || null }); return hit?.cat || null; });
  cache.set(base, { at: hit?.at || 0, cat: hit?.cat || null, pending });
  return pending;
}

const byRecent = (a: OdpDataset, b: OdpDataset) => (b.lastUpdate || "").localeCompare(a.lastUpdate || "") || a.title.localeCompare(b.title);

/** Datasets the portal files under a bot topic (its mapped categories and their children), newest first. */
export async function datasetsForTopic(base: string, topic: string): Promise<OdpDataset[]> {
  const cat = await getCatalog(base);
  const spec = STAT_TOPICS.find((x) => x.key === topic);
  if (!cat || !spec) return [];
  const seen = new Set<string>();
  const out: OdpDataset[] = [];
  for (const cid of spec.odp) for (const d of cat.categories.get(cid)?.datasets || []) if (!seen.has(d.id)) { seen.add(d.id); out.push(d); }
  return out.sort(byRecent);
}
export async function findDataset(base: string, id: string): Promise<OdpDataset | null> {
  if (!ID_RE.test(id)) return null;
  return (await getCatalog(base))?.datasets.get(id) || null;
}
/** Portal pages for a dataset and for a topic's first category (the portal is in English only). */
export const datasetPage = (base: string, cat: Catalog, d: OdpDataset) => `${base}/#/en/${cat.nodeCode}/categories/${d.path.join("/")}/${d.id}`;
export async function datasetUrl(base: string, d: OdpDataset) { const cat = await getCatalog(base); return cat ? datasetPage(base, cat, d) : base; }
export async function topicPage(base: string, topic: string): Promise<string> {
  const cat = await getCatalog(base);
  const spec = STAT_TOPICS.find((x) => x.key === topic);
  const c = spec?.odp.map((id) => cat?.categories.get(id)).find(Boolean);
  return c && cat ? `${base}/#/en/${cat.nodeCode}/categories/${c.path.join("/")}` : base;
}

// ---------------- dataset data ----------------
type SdmxValue = { id: string; name?: string };
type SdmxDim = { id: string; name?: string; values: SdmxValue[] };
type SdmxJson = {
  data: {
    structure: { name?: string; dimensions: { series?: SdmxDim[]; observation: SdmxDim[] }; attributes?: { observation?: { id: string; name?: string; values: SdmxValue[] }[] } };
    dataSets: { series?: Record<string, { observations: Record<string, (string | number | null)[]> }>; observations?: Record<string, (string | number | null)[]> }[];
  };
};
export type Series = { label: string; points: [string, number][] };
export type Table = {
  id: string; title: string; lastUpdate: string | null; url: string;
  columns: string[]; rows: (string | number | null)[][];
  /** dimensions that take a single value in this dataset, e.g. Reference area: Zimbabwe */
  constants: [string, string][];
  series: Series[];
};

const label = (v?: SdmxValue) => (v ? (v.name || v.id).trim() : "");
const num = (v: unknown): number | null => { if (typeof v === "number") return Number.isFinite(v) ? v : null; const n = Number(String(v ?? "").replace(/,/g, "")); return String(v ?? "").trim() !== "" && Number.isFinite(n) ? n : null; };

/** Fetch the whole dataset and turn it into a flat table (varying dimensions as columns, constant ones listed once). */
export async function fetchTable(base: string, id: string): Promise<Table | null> {
  const cat = await getCatalog(base);
  const d = cat?.datasets.get(id);
  if (!cat || !d) return null;
  const json = await fetchJson<SdmxJson>(`${base}/api/Core/nodes/${NODE}/datasets/${id}/download/jsondata`, { method: "POST", headers: { "content-type": "application/json" }, body: "[]" });
  const st = json.data.structure;
  const sdims = st.dimensions.series || [];
  const odims = st.dimensions.observation || [];
  const timeIdx = Math.max(0, odims.findIndex((x) => x.id === "TIME_PERIOD"));
  const statusIdx = (st.attributes?.observation || []).findIndex((a) => a.id === "OBS_STATUS");
  const statusVals = statusIdx >= 0 ? st.attributes!.observation![statusIdx].values : [];
  const ds = json.data.dataSets[0] || {};
  const seriesEntries = Object.entries(ds.series || (ds.observations ? { "": { observations: ds.observations } } : {}));

  // which series dimensions actually vary across the series present
  const used = sdims.map(() => new Set<number>());
  for (const [key] of seriesEntries) key.split(":").forEach((p, i) => { if (p !== "" && used[i]) used[i].add(Number(p)); });
  const varying = sdims.map((_, i) => i).filter((i) => used[i].size > 1);
  const constants: [string, string][] = sdims.map((dim, i) => [i, dim] as const).filter(([i]) => used[i].size === 1).map(([i, dim]) => [dim.name || dim.id, label(dim.values[[...used[i]][0]])]);

  const columns = [...varying.map((i) => sdims[i].name || sdims[i].id), ...odims.map((o) => o.name || o.id), "Value", ...(statusIdx >= 0 ? ["Status"] : [])];
  const rows: (string | number | null)[][] = [];
  const series: Series[] = [];
  const timeKey = (obsKey: string) => { const parts = obsKey.split(":"); return odims[timeIdx]?.values[Number(parts[timeIdx] || parts[0])]?.id || obsKey; };
  for (const [key, s] of seriesEntries) {
    const parts = key.split(":").map(Number);
    const dimLabels = varying.map((i) => label(sdims[i].values[parts[i]]));
    const obs = Object.entries(s.observations || {}).sort((a, b) => timeKey(a[0]).localeCompare(timeKey(b[0])));
    const points: [string, number][] = [];
    for (const [ok, arr] of obs) {
      const okParts = ok.split(":").map(Number);
      const oLabels = odims.map((o, j) => label(o.values[okParts[j] ?? okParts[0]]));
      const raw = arr?.[0];
      const n = num(raw);
      const status = statusIdx >= 0 ? label(statusVals[Number(arr?.[statusIdx + 1] ?? -1)]) : null;
      rows.push([...dimLabels, ...oLabels, n ?? (raw == null || raw === "-" ? null : String(raw)), ...(statusIdx >= 0 ? [status || null] : [])]);
      if (n !== null) points.push([odims[timeIdx]?.values[okParts[timeIdx] ?? okParts[0]]?.id || oLabels[timeIdx] || ok, n]);
      if (rows.length >= MAX_ROWS) break;
    }
    series.push({ label: dimLabels.join(" · ") || st.name || d.title, points });
    if (rows.length >= MAX_ROWS) break;
  }
  return { id, title: (st.name || d.title).trim(), lastUpdate: d.lastUpdate, url: datasetPage(base, cat, d), columns, rows, constants, series };
}

/** Up to six series for the chart: those whose codes look like totals first, then the first ones listed. */
export function pickSeries(table: Table, max = 6): Series[] {
  const total = /(total|all items|all sectors|national|both sexes|_t\b|zimbabwe)/i;
  const scored = table.series.filter((s) => s.points.length >= 2).map((s, i) => ({ s, i, score: (s.label.match(total) || []).length }));
  const best = Math.max(0, ...scored.map((x) => x.score));
  const first = scored.filter((x) => x.score === best).map((x) => x.s);
  const rest = scored.filter((x) => x.score !== best).map((x) => x.s);
  return [...first, ...rest].slice(0, max);
}

const today = () => new Date().toISOString().slice(0, 10);
const shortId = (id: string) => (id.split(",")[1] || id).replace(/[^A-Za-z0-9_-]+/g, "_");
const csvCell = (v: string | number | null) => { if (v == null) return ""; const s = String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s; };

export type OdpFormat = "csv" | "xlsx" | "png";
export const ODP_MIME: Record<OdpFormat, string> = { csv: "text/csv; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", png: "image/png" };
export const odpFilename = (id: string, format: OdpFormat) => `ZIMSTAT-${shortId(id)}-${today()}.${format}`;

export function tableToCsv(table: Table): Buffer {
  const lines = [table.columns.map(csvCell).join(","), ...table.rows.map((r) => r.map(csvCell).join(","))];
  return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8");
}

export async function tableToXlsx(table: Table): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ZIMSTAT Open Data Portal"; wb.created = new Date();
  const ws = wb.addWorksheet("Data");
  const n = table.columns.length;
  const last = String.fromCharCode(64 + Math.min(n, 26));
  ws.mergeCells(`A1:${last}1`); ws.getCell("A1").value = table.title; ws.getCell("A1").font = { bold: true, size: 14 };
  ws.mergeCells(`A2:${last}2`); ws.getCell("A2").value = `${table.constants.map(([k, v]) => `${k}: ${v}`).join(" · ")}`.slice(0, 250); ws.getCell("A2").font = { italic: true, color: { argb: "FF666666" } };
  ws.addRow([]);
  const hr = ws.addRow(table.columns);
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } }; });
  for (const r of table.rows) ws.addRow(r);
  table.columns.forEach((c, i) => { ws.getColumn(i + 1).width = Math.min(48, Math.max(12, c.length + 2, ...table.rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2))); });
  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + Math.max(table.rows.length, 1), column: n } };
  const about = wb.addWorksheet("About");
  about.getColumn(1).width = 22; about.getColumn(2).width = 90;
  about.addRows([["Dataset", table.title], ["Identifier", table.id], ["Last updated", table.lastUpdate ? table.lastUpdate.slice(0, 10) : ""], ["Source", table.url], ["Generated", today()], [], ...table.constants]);
  about.getCell("B4").value = { text: table.url, hyperlink: table.url };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** One-paragraph caption sent with the file: title, fixed dimensions, update date and the portal link. */
export function captionFor(table: Table, lang: Lang) {
  const consts = table.constants.slice(0, 4).map(([k, v]) => `${k}: ${v}`).join("\n");
  return [`*${table.title}*`, consts, `${t(lang, "odp_updated")}: ${table.lastUpdate ? table.lastUpdate.slice(0, 10) : "—"}`, `${t(lang, "odp_source")}: ${table.url}`].filter(Boolean).join("\n").slice(0, 1024);
}
