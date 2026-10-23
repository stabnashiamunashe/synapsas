// Renders a Markdown document (with relative ![alt](images/x.png) images) to a branded A4 PDF via Chrome.
//   node scripts/build-pdf.mjs docs/manual/manual.md docs/manual/ZimStat-Approvals-User-Manual.pdf "User Manual" "subtitle"
import { chromium } from "playwright-core";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const [, , input, output, coverTitle = "Document", coverSub = ""] = process.argv;
if (!input || !output) { console.error("usage: node scripts/build-pdf.mjs <input.md> <output.pdf> [title] [subtitle]"); process.exit(1); }
const ROOT = path.dirname(path.resolve(input));
const md = readFileSync(input, "utf8");
const PHONE = /mobile|phone/i;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}
function image(alt, src) {
  const file = path.resolve(ROOT, src);
  if (!existsSync(file)) return `<p class="missing">[missing image: ${esc(src)}]</p>`;
  const data = readFileSync(file).toString("base64");
  const ext = path.extname(file).slice(1) || "png";
  return `<figure class="${PHONE.test(src) ? "phone" : ""}"><img src="data:image/${ext};base64,${data}" alt="${esc(alt)}"><figcaption>${esc(alt)}</figcaption></figure>`;
}

const lines = md.split(/\r?\n/);
let html = "", i = 0; const toc = [];
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
while (i < lines.length) {
  const l = lines[i];
  if (!l.trim()) { i++; continue; }
  let m;
  if ((m = l.match(/^(#{1,4}) (.*)$/))) {
    const lvl = m[1].length, text = m[2], id = slug(text);
    if (lvl === 2) toc.push({ id, text });
    html += `<h${lvl} id="${id}">${inline(text)}</h${lvl}>\n`; i++; continue;
  }
  if ((m = l.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) { html += image(m[1], m[2]); i++; continue; }
  if (/^---+$/.test(l)) { html += "<hr>\n"; i++; continue; }
  if (/^```/.test(l)) {
    const buf = []; i++;
    while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
    i++; html += `<pre>${esc(buf.join("\n"))}</pre>\n`; continue;
  }
  if (/^\|/.test(l)) {
    const rows = [];
    while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
    const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const head = cells(rows[0]); const body = rows.slice(2);
    html += "<table><thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
      body.map((r) => "<tr>" + cells(r).map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table>\n";
    continue;
  }
  if (/^(\d+\.|-) /.test(l)) {
    const ordered = /^\d+\./.test(l); const items = [];
    while (i < lines.length && /^(\d+\.|-) /.test(lines[i])) { items.push(lines[i].replace(/^(\d+\.|-) /, "")); i++; }
    html += `<${ordered ? "ol" : "ul"}>` + items.map((t) => `<li>${inline(t)}</li>`).join("") + `</${ordered ? "ol" : "ul"}>\n`;
    continue;
  }
  const para = [];
  while (i < lines.length && lines[i].trim() && !/^(#{1,4} |!\[|\||---|- |\d+\. |```)/.test(lines[i])) { para.push(lines[i]); i++; }
  html += `<p>${inline(para.join(" "))}</p>\n`;
}

const logoFile = path.resolve("public/brand/zimstat-logo.png");
const logo = existsSync(logoFile) ? readFileSync(logoFile).toString("base64") : "";
const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const tocHtml = toc.length > 3 ? `<nav class="toc"><h2>Contents</h2><ol>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.text.replace(/^\d+\.\s*/, ""))}</a></li>`).join("")}</ol></nav>` : "";
const cover = `<section class="cover">${logo ? `<img src="data:image/png;base64,${logo}" alt="ZimStat">` : ""}<h1>${esc(coverTitle)}</h1><p class="sub">${esc(coverSub)}</p><p class="meta">Zimbabwe National Statistics Agency · ${today}</p></section>`;
// drop a leading H1 + byline from the markdown (the cover carries them)
const bodyHtml = html.replace(/^<h1[^>]*>.*?<\/h1>\n(<p>[^<]{0,120}<\/p>\n)?/, "");

const page = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(coverTitle)}</title><style>
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Inter, Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1f2933; margin: 0; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; page-break-after: always; border-left: 8px solid #1414D2; padding-left: 14mm; }
  .cover img { width: 60mm; margin-bottom: 16mm; }
  .cover h1 { font-size: 32pt; color: #1414D2; margin: 0 0 6mm; border: 0; }
  .cover .sub { font-size: 13pt; color: #5f6b7a; max-width: 120mm; margin: 0 0 18mm; }
  .cover .meta { color: #5f6b7a; font-size: 10pt; }
  .toc { page-break-after: always; } .toc h2 { border: 0; }
  .toc ol { columns: 2; column-gap: 12mm; padding-left: 18px; } .toc li { break-inside: avoid; margin: 2px 0; } .toc a { color: #1f2933; text-decoration: none; }
  h1 { font-size: 22pt; color: #1414D2; }
  h2 { font-size: 17pt; color: #1414D2; margin: 0 0 6mm; padding-bottom: 2mm; border-bottom: 2px solid #1414D2; page-break-before: always; page-break-after: avoid; }
  h3 { font-size: 12.5pt; color: #1414D2; margin: 7mm 0 2mm; page-break-after: avoid; }
  h4 { font-size: 11pt; margin: 5mm 0 1.5mm; page-break-after: avoid; }
  p { margin: 0 0 3mm; } ul, ol { margin: 0 0 3mm; padding-left: 18px; } li { margin-bottom: 1mm; }
  code { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; background: #f3f4f6; padding: 0 3px; border-radius: 3px; }
  pre { font-family: Consolas, "Courier New", monospace; font-size: 9pt; background: #f3f4f6; padding: 8px 10px; border-radius: 4px; white-space: pre-wrap; }
  table { border-collapse: collapse; width: 100%; margin: 2mm 0 4mm; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #d9dde3; padding: 4px 7px; vertical-align: top; text-align: left; } th { background: #eceeff; color: #1414D2; }
  figure { margin: 3mm 0 5mm; page-break-inside: avoid; text-align: center; }
  figure img { max-width: 100%; max-height: 160mm; border: 1px solid #d9dde3; border-radius: 4px; } figure.phone img { max-width: 60mm; }
  figcaption { font-size: 9pt; color: #5f6b7a; margin-top: 1.5mm; }
  hr { border: 0; border-top: 1px solid #d9dde3; margin: 6mm 0; } .missing { color: #c53030; }
</style></head><body>${cover}${tocHtml}${bodyHtml}</body></html>`;

const browser = await chromium.launch({ channel: "chrome" });
const p = await browser.newPage();
await p.setContent(page, { waitUntil: "load" });
await p.pdf({
  path: output, format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: `<div style="font-size:8px;color:#8a94a6;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>${esc(coverTitle)} · ZimStat Approvals</span><span class="date"></span></div>`,
  footerTemplate: `<div style="font-size:8px;color:#8a94a6;width:100%;padding:0 16mm;text-align:center">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
});
await browser.close();
writeFileSync(output.replace(/\.pdf$/, ".html"), page);
console.log("done ->", output);
