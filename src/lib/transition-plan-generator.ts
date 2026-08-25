/**
 * Transition Plan document generator — branded HTML for a specific pitch,
 * exported via the same downloadAsPDF() pipeline used elsewhere in the app.
 *
 * Deliberately avoids <input> elements (see excalibur.ts fix history: native
 * form controls are not reliably rasterized by html2canvas and can produce a
 * blank capture) and does not @import external fonts inside the PDF-render
 * iframe for the same reason.
 *
 * Content follows Camelot's own internal Transitional Procedures checklist
 * categories (Mortgage, Insurance, Legal, Accounting, Payroll, Shareholder/
 * Unit Owner records) but is rendered under the CURRENT office letterhead —
 * the source internal document still shows a retired address (477 Madison
 * Avenue) and should be updated company-wide; this generator intentionally
 * does not reproduce that address.
 */

import { CAMELOT } from '@/lib/excalibur';

export interface TransitionPlanInput {
  clientName: string;
  propertyAddress: string;
  entities: string[];
  phases: { label: string; dayRange: string; actions: string[] }[];
  checklistCategories: { category: string; items: string[] }[];
}

export function generateTransitionPlanHtml(input: TransitionPlanInput): string {
  const timestamp = new Date().toISOString().split('T')[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Transition Plan — ${input.clientName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#2C3240;font-size:12px;line-height:1.7;background:#fff}
@media print{@page{margin:0.6in 0.75in;size:letter}body{font-size:11px}}
.page{max-width:750px;margin:0 auto;padding:40px 0}
.letterhead{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #A89035;padding-bottom:12px;margin-bottom:24px}
.letterhead .brand{font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:20px;font-weight:800;color:#3A4B5B;letter-spacing:1px}
.letterhead .contact{text-align:right;font-size:9px;color:#888;line-height:1.5}
.cover{text-align:center;padding:60px 0 40px}
.cover h1{font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:26px;color:#3A4B5B;margin-bottom:8px}
.cover .gold{color:#A89035;font-weight:700}
.cover .sub{font-size:13px;color:#666;margin-top:6px}
.article{margin-bottom:22px;page-break-inside:avoid}
.article-title{font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;font-size:15px;color:#A89035;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #A89035}
.article-sub{font-size:12px;font-weight:700;color:#3A4B5B;margin:10px 0 4px}
.article ul{margin:0 0 8px 20px}
.article li{margin-bottom:4px}
.checklist-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}
.checklist-box{background:#F7F5EF;border:1px solid #E5E0D2;border-radius:6px;padding:14px 16px}
.checklist-box h4{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#A89035;font-weight:700;margin-bottom:8px}
.checklist-box ul{margin:0 0 0 16px;font-size:11px}
.checklist-box li{margin-bottom:3px}
.footer{text-align:center;font-size:9px;color:#999;padding-top:10px;border-top:1px solid #E5E3DE;margin-top:24px}
</style>
</head>
<body>
<div class="page">

<div class="letterhead">
<div>
<div class="brand">CAMELOT</div>
<div style="font-size:9px;color:#888;letter-spacing:2px;text-transform:uppercase">Realty Group</div>
</div>
<div class="contact">
${CAMELOT.address}<br>
${CAMELOT.phone} · ${CAMELOT.web}
</div>
</div>

<div class="cover">
<h1>Transition Plan</h1>
<div class="gold">${input.clientName}</div>
<div class="sub">${input.propertyAddress}</div>
<div class="sub" style="margin-top:16px;color:#999">Prepared ${timestamp}</div>
</div>

<div class="article">
<div class="article-title">How This Works</div>
<p>Camelot Property Management Services Corp. uses this Transition Guide to move a property between management companies without losing records, continuity, or institutional knowledge. Both the outgoing and incoming firms name one contact person to serve as liaison for the duration of the transition.</p>
<div class="article-sub">Timeframes</div>
<ul>
<li><strong>Immediately upon receipt of the termination/engagement letter:</strong> items marked time-sensitive below, plus a transfer letter to the payroll agent authorizing the transfer of accounts and payroll records.</li>
<li><strong>Five to ten days before the actual transition:</strong> the balance of documents and records, plus available cash balances (cash in the account less outstanding checks, payroll reserve, authorized mortgage payment, and an appropriate reserve fund).</li>
<li><strong>Within 45 days:</strong> final bank reconciliation, final cash balance, final month's management statement, and any outstanding payments. Camelot prepares a report to the Board on any documents still missing, attached to the transition minutes.</li>
</ul>
</div>

${input.phases.map((phase) => `
<div class="article">
<div class="article-title">${phase.label} <span style="color:#3A4B5B;font-weight:400;font-size:12px">(${phase.dayRange})</span></div>
<ul>
${phase.actions.map((a) => `<li>${a}</li>`).join('\n')}
</ul>
</div>
`).join('\n')}

<div class="article">
<div class="article-title">Records &amp; Files Checklist</div>
<p>Files are kept in and turned over in good order, labeled by category. This checklist reflects Camelot's standard transitional-records categories.</p>
<div class="checklist-grid">
${input.checklistCategories.map((cat) => `
<div class="checklist-box">
<h4>${cat.category}</h4>
<ul>${cat.items.map((item) => `<li>${item}</li>`).join('')}</ul>
</div>
`).join('\n')}
</div>
</div>

<div class="footer">
${CAMELOT.name} · ${CAMELOT.address} · ${CAMELOT.phone} · Confidential — Prepared for ${input.propertyAddress}
</div>

</div>
</body>
</html>`;
}
