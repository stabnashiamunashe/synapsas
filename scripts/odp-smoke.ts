/**
 * Smoke test for the Open Data Portal integration outside the web server: lists the datasets per topic and writes
 * one dataset as CSV, Excel and a chart PNG to the given folder.
 *
 *   npx tsx scripts/odp-smoke.ts [out-dir] [dataset-id]
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { STAT_TOPICS } from "../src/lib/whatsapp/i18n";
import { DEFAULT_ODP, datasetsForTopic, fetchTable, getCatalog, odpFilename, pickSeries, tableToCsv, tableToXlsx } from "../src/lib/whatsapp/odp";

(async () => {
  const out = process.argv[2] || path.join(process.cwd(), "tmp-odp");
  await mkdir(out, { recursive: true });
  const base = process.env.ODP_URL || DEFAULT_ODP;
  const cat = await getCatalog(base);
  console.log(`catalogue: ${cat ? `${cat.datasets.size} datasets, node ${cat.nodeCode}` : "unreachable"}`);
  for (const tp of STAT_TOPICS) {
    const ds = await datasetsForTopic(base, tp.key);
    console.log(`  ${tp.group.padEnd(5)} ${tp.key.padEnd(4)} ${tp.en.padEnd(30)} ${String(ds.length).padStart(3)}  ${ds[0] ? `${ds[0].title.slice(0, 50)} (${ds[0].lastUpdate?.slice(0, 10)})` : ""}`);
  }
  const id = process.argv[3] || (await datasetsForTopic(base, "NA"))[0]?.id;
  if (!id) return;
  const t0 = Date.now();
  const table = await fetchTable(base, id);
  if (!table) { console.log("dataset not found"); return; }
  console.log(`\n${table.title}\n  ${table.rows.length} rows × ${table.columns.length} columns in ${Date.now() - t0} ms; constants: ${table.constants.map(([k, v]) => `${k}=${v}`).join(", ")}\n  columns: ${table.columns.join(" | ")}\n  first row: ${JSON.stringify(table.rows[0])}\n  series: ${table.series.length}, charted: ${pickSeries(table).map((s) => `${s.label} (${s.points.length})`).join("; ")}`);
  await writeFile(path.join(out, odpFilename(id, "csv")), tableToCsv(table));
  await writeFile(path.join(out, odpFilename(id, "xlsx")), await tableToXlsx(table));
  const { renderLineChart } = await import("../src/lib/whatsapp/odpChart");
  const png = await renderLineChart({ title: table.title, subtitle: table.constants.map(([k, v]) => `${k}: ${v}`).join(" · "), series: pickSeries(table), footer: `Source: ZIMSTAT Open Data Portal · ${table.url}` });
  await writeFile(path.join(out, odpFilename(id, "png")), png);
  console.log(`\nwritten to ${out}: csv ${tableToCsv(table).length} B, png ${png.length} B`);
})().catch((e) => { console.error(e); process.exit(1); });
