import { prisma } from "@/lib/prisma";
import { notFound, withAuth } from "@/lib/api";
import { parseJson } from "@/lib/json";
import { escapeHtml } from "@/lib/mailer";
import type { BrandingSettings } from "@/lib/types";

const fmt = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

/** Printable licence certificate (HTML; use the browser's print dialog for PDF). Only issued, suspended or expired licences have one. */
export const GET = withAuth(async (_req, { params, user }) => {
  const l = await prisma.licence.findFirst({ where: { id: params.id, orgId: user.orgId }, include: { type: true, org: { select: { name: true, branding: true } } } });
  if (!l || !l.licenceNo) throw notFound("This application has not been issued a licence yet");
  const b = parseJson<BrandingSettings>(l.org.branding, {});
  const colour = b.primaryColor || "#B5491A";
  const logo = b.logoUrl ? `<img src="${escapeHtml(b.logoUrl)}" alt="" style="height:96px">` : "";
  const status = l.status === "ISSUED" ? (l.expiresAt && l.expiresAt < new Date() ? "EXPIRED" : "VALID") : l.status;
  const e = (v: unknown) => escapeHtml(String(v ?? ""));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${e(l.licenceNo)}</title>
<style>
  body{font:14px/1.5 'IBM Plex Sans',Arial,sans-serif;color:#161616;margin:0;background:#f4f4f4}
  .sheet{max-width:820px;margin:24px auto;background:#fff;padding:48px 56px;border-top:10px solid ${colour};position:relative}
  h1{font-size:26px;font-weight:600;margin:4px 0 0;letter-spacing:.5px;color:${colour}}
  .sub{color:#525252;font-size:13px;letter-spacing:.32px;text-transform:uppercase}
  .no{font:600 18px 'IBM Plex Mono',Consolas,monospace;margin-top:8px}
  table{width:100%;border-collapse:collapse;margin-top:28px}
  td{padding:10px 12px;border-bottom:1px solid #e0e0e0;vertical-align:top}
  td:first-child{width:220px;color:#525252}
  .stamp{position:absolute;right:56px;top:140px;border:3px solid ${status === "VALID" ? "#24a148" : "#da1e28"};color:${status === "VALID" ? "#24a148" : "#da1e28"};padding:6px 14px;font-weight:600;letter-spacing:2px;transform:rotate(-8deg)}
  .sig{display:flex;gap:48px;margin-top:56px}.sig div{flex:1;border-top:1px solid #161616;padding-top:6px;font-size:12px;color:#525252}
  .foot{margin-top:40px;font-size:11px;color:#6f6f6f}
  @media print{body{background:#fff}.sheet{margin:0;max-width:none}.noprint{display:none}}
</style></head><body>
<div class="noprint" style="text-align:center;padding:12px"><button onclick="window.print()" style="padding:8px 16px;border:1px solid #161616;background:#fff;cursor:pointer">Print / save as PDF</button></div>
<div class="sheet">
  <div style="display:flex;gap:24px;align-items:center">${logo}<div><div class="sub">${e(l.org.name)}</div><h1>${e(l.type.name)}</h1><div class="sub">${e(l.type.category)} licence · issued under the Urban Councils Act [Chapter 29:15] and council by-laws</div><div class="no">${e(l.licenceNo)}</div></div></div>
  <div class="stamp">${e(status)}</div>
  <table>
    <tr><td>Licensee</td><td><b>${e(l.applicantName)}</b>${l.idNumber ? ` · ID ${e(l.idNumber)}` : ""}</td></tr>
    ${l.tradingName ? `<tr><td>Trading as</td><td>${e(l.tradingName)}</td></tr>` : ""}
    <tr><td>Premises</td><td>${e([l.standNumber ? `Stand ${l.standNumber}` : "", l.address, l.ward ? `Ward ${l.ward}` : ""].filter(Boolean).join(", "))}</td></tr>
    ${l.activity ? `<tr><td>Licensed activity</td><td>${e(l.activity)}</td></tr>` : ""}
    <tr><td>Valid from</td><td>${fmt(l.issuedAt)}</td></tr>
    <tr><td>Valid until</td><td><b>${fmt(l.expiresAt)}</b></td></tr>
    <tr><td>Fee paid</td><td>${e(l.currency)} ${Number(l.feeAmount).toFixed(2)}${l.receiptNo ? ` · receipt ${e(l.receiptNo)}` : ""}${l.paidAt ? ` · ${fmt(l.paidAt)}` : ""}</td></tr>
    ${l.conditions ? `<tr><td>Conditions</td><td>${e(l.conditions).replace(/\n/g, "<br>")}</td></tr>` : ""}
    <tr><td>Application reference</td><td>${e(l.referenceNo)}</td></tr>
  </table>
  <div class="sig"><div>Licensing officer</div><div>Town Clerk / authorised officer</div><div>Official stamp</div></div>
  <div class="foot">This licence is not transferable and must be displayed at the licensed premises. It may be suspended or revoked for breach of its conditions or of council by-laws. Verify this licence at ${e(process.env.NEXT_PUBLIC_APP_URL || "")}/verify using the licence number.${b.footerText ? ` ${e(b.footerText)}` : ""}</div>
</div></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
});
