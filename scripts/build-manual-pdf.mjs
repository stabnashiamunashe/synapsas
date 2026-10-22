// Renders docs/manual/manual.md (+ docs/manual/images) to docs/manual/Synapsas-User-Manual.pdf
//   node scripts/build-manual-pdf.mjs
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const ROOT = path.resolve("docs/manual");
const md = readFileSync(path.join(ROOT, "manual.md"), "utf8");

// Doc blob id -> screenshot file
const BLOBS = {
  "6e594d4d-600e": "01-landing", "2a32c278-236c": "02-login", "7dfad85d-f27f": "03-register", "0c586c48-27d9": "04-onboarding",
  "27921eb3-807a": "05-dashboard", "0fe6164c-1e09": "06-new-request-pick", "e2efb59f-1e2b": "07-new-request-form", "240dacfd-a721": "08-inbox",
  "396d8985-59f4": "09-request-decision", "6edfdfa7-8b6a": "09b-approve-modal", "dfa5ebbd-f4cd": "10-request-approved", "7517967a-49d8": "11-requests-list",
  "81556257-5cec": "12-projects", "2e3966e4-fdb9": "13-project-detail", "4dcbbe3c-b261": "14-workflows", "21351d6d-6ec8": "15-quick-create",
  "7398dbc7-2e4d": "16-builder-fields", "d1e5cdb8-cc4b": "17-builder-canvas", "3778065a-2f75": "18-level-settings", "bc3496a6-6549": "19-builder-rules",
  "d8684aa1-2bf0": "20-builder-preview", "5677e195-12f6": "21-people", "7c9bc8fb-8064": "22-departments", "f3ae0345-5356": "23-notifications",
  "2584a7f0-aa72": "24-out-of-office", "0d469682-9fb4": "25-reports", "60707356-fc69": "26-audit", "7b144b87-4fb4": "27-settings-branding",
  "55971429-451e": "28-settings-organisation", "26e74863-ac9b": "29-settings-billing", "8fdea8ae-4dbd": "30-settings-api", "43b983db-4514": "31-profile",
  "c267a659-a012": "32-profile-security", "279faaf0-afd1": "33-profile-notifications", "5fd9fd11-2311": "34-platform-console", "46263d21-0a0b": "35-mobile-nav",
};
const PHONE = new Set(["35-mobile-nav"]);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}
function image(alt, ref) {
  const id = ref.replace(/^blob\//, "");
  const file = BLOBS[id];
  if (!file) return `<p class="missing">[image: ${esc(alt)}]</p>`;
  const data = readFileSync(path.join(ROOT, "images", `${file}.png`)).toString("base64");
  return `<figure class="${PHONE.has(file) ? "phone" : ""}"><img src="data:image/png;base64,${data}" alt="${esc(alt)}"><figcaption>${esc(alt)}</figcaption></figure>`;
}

const lines = md.split(/\r?\n/);
let html = "", i = 0, toc = [];
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
while (i < lines.length) {
  const l = lines[i];
  if (!l.trim()) { i++; continue; }
  let m;
  if ((m = l.match(/^(#{1,4}) (.*)$/))) {
    const lvl = m[1].length, text = m[2];
    const id = slug(text);
    if (lvl === 2) toc.push({ id, text });
    html += `<h${lvl} id="${id}">${inline(text)}</h${lvl}>\n`; i++; continue;
  }
  if ((m = l.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) { html += image(m[1], m[2]); i++; continue; }
  if (/^---+$/.test(l)) { html += "<hr>\n"; i++; continue; }
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
  while (i < lines.length && lines[i].trim() && !/^(#{1,4} |!\[|\||---|- |\d+\. )/.test(lines[i])) { para.push(lines[i]); i++; }
  html += `<p>${inline(para.join(" "))}</p>\n`;
}

const logo = readFileSync(path.resolve("public/images/Synapsas Transparent Black.png")).toString("base64");
const tocHtml = `<nav class="toc"><h2>Contents</h2><ol>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.text.replace(/^\d+\.\s*/, ""))}</a></li>`).join("")}</ol></nav>`;
const cover = `<section class="cover"><img src="data:image/png;base64,${logo}" alt="Synapsas"><h1>User Manual</h1><p class="sub">Configurable approval workflows for memos, requisitions, travel claims and document sign-off</p><p class="meta">Version 1.0 · 6 October 2026<br>Prepared by Munashe Nzira</p></section>`;

const page = `<!doctype html><html><head><meta charset="utf-8"><title>Synapsas User Manual</title><style>
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Inter, Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1f2933; margin: 0; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; page-break-after: always; border-left: 8px solid #003B32; padding-left: 14mm; }
  .cover img { width: 70mm; margin-bottom: 18mm; }
  .cover h1 { font-size: 34pt; color: #003B32; margin: 0 0 6mm; border: 0; }
  .cover .sub { font-size: 13pt; color: #5f6b7a; max-width: 120mm; margin: 0 0 20mm; }
  .cover .meta { color: #5f6b7a; font-size: 10pt; }
  .toc { page-break-after: always; }
  .toc h2 { border: 0; }
  .toc ol { columns: 2; column-gap: 12mm; padding-left: 18px; }
  .toc li { break-inside: avoid; margin: 2px 0; }
  .toc a { color: #1f2933; text-decoration: none; }
  h1 { font-size: 22pt; color: #003B32; }
  h2 { font-size: 17pt; color: #003B32; margin: 0 0 6mm; padding-bottom: 2mm; border-bottom: 2px solid #003B32; page-break-before: always; page-break-after: avoid; }
  h3 { font-size: 12.5pt; color: #003B32; margin: 7mm 0 2mm; page-break-after: avoid; }
  h4 { font-size: 11pt; margin: 5mm 0 1.5mm; page-break-after: avoid; }
  p { margin: 0 0 3mm; }
  ul, ol { margin: 0 0 3mm; padding-left: 18px; }
  li { margin-bottom: 1mm; }
  code { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; background: #f3f4f6; padding: 0 3px; border-radius: 3px; }
  table { border-collapse: collapse; width: 100%; margin: 2mm 0 4mm; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #d9dde3; padding: 4px 7px; vertical-align: top; text-align: left; }
  th { background: #eef4f2; color: #003B32; }
  figure { margin: 3mm 0 5mm; page-break-inside: avoid; text-align: center; }
  figure img { max-width: 100%; max-height: 165mm; border: 1px solid #d9dde3; border-radius: 4px; }
  figure.phone img { max-width: 60mm; }
  figcaption { font-size: 9pt; color: #5f6b7a; margin-top: 1.5mm; }
  hr { border: 0; border-top: 1px solid #d9dde3; margin: 6mm 0; }
  .missing { color: #c53030; }
</style></head><body>${cover}${tocHtml}${html.replace(/<h1[^>]*>.*?<\/h1>\n<p>6 October 2026[^<]*<\/p>\n/, "")}</body></html>`;

writeFileSync(path.join(ROOT, "manual.html"), page);
const browser = await chromium.launch({ channel: "chrome" });
const p = await browser.newPage();
await p.setContent(page, { waitUntil: "load" });
await p.pdf({
  path: path.join(ROOT, "Synapsas-User-Manual.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: `<div style="font-size:8px;color:#8a94a6;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>Synapsas User Manual</span><span class="date"></span></div>`,
  footerTemplate: `<div style="font-size:8px;color:#8a94a6;width:100%;padding:0 16mm;text-align:center">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
});
await browser.close();
console.log("done ->", path.join(ROOT, "Synapsas-User-Manual.pdf"));
