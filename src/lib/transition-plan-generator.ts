/**
 * Transition Plan document generator — branded HTML for a specific pitch,
 * exported via the same downloadAsPDF() pipeline used elsewhere in the app.
 *
 * Rebuilt to match the same house design as the Management Agreement and
 * Proposal (see agreement-v3-general.ts / rental-agreement-v3.ts): a
 * repeating letterhead + gold-bordered page + footer on every physical
 * page, centered dark-gold Georgia serif headings pushed clear of the
 * header, and running "Page N of M" numbering.
 *
 * Deliberately avoids <input> elements (see excalibur.ts fix history: native
 * form controls are not reliably rasterized by html2canvas and can produce a
 * blank capture) and does not @import external fonts inside the PDF-render
 * iframe for the same reason.
 *
 * Content follows Camelot's own internal Transitional Procedures checklist
 * categories (Mortgage, Insurance, Legal, Accounting, Payroll, Shareholder/
 * Unit Owner records) under the current office letterhead.
 */

import { CAMELOT } from '@/lib/excalibur';
import { RENTAL_AGREEMENT_LOGO_B64 } from '@/lib/agreement-brand';

const HEADING_FONT = "Georgia,'Times New Roman',serif";
const DARK_GOLD = '#8B6F47';
const GOLD_RULE = '#B8960F';
const BODY_FONT = 'Arial,Helvetica,sans-serif';
const BODY_BLACK = '#000000';
const NAVY = '#1B2A4A';
const COVER_TITLE_FONT = "'HGMaruGothicMPRO','HGMaruGothicM PRO',Georgia,serif";
const COVER_TITLE_COLOR = '#2F5597';

export interface TransitionPlanInput {
  clientName: string;
  propertyAddress: string;
  entities: string[];
  phases: { label: string; dayRange: string; actions: string[] }[];
  checklistCategories: { category: string; items: string[] }[];
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export function generateTransitionPlanHtml(input: TransitionPlanInput): string {
  const now = new Date();
  const version = `v${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.1`;
  const dateStr = now.toISOString().slice(0, 10);
  const dateLong = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const article = (title: string, body: string) => `
<div class="article-block">
<h2 class="art">${esc(title)}</h2>
${body}
</div>`;

  let pageCounter = 0;
  const totalPagesPlaceholder = '__TOTAL_PAGES__';
  const pageWrap = (bodyHtml: string, opts?: { noLetterhead?: boolean }) => {
    pageCounter += 1;
    const n = pageCounter;
    return `
<div class="page">
<div class="page-content">

${opts?.noLetterhead ? '' : `<div class="letterhead">
  <img src="${RENTAL_AGREEMENT_LOGO_B64}" alt="Camelot" />
  <div class="lh-text">
    <div class="lh-name">CAMELOT REALTY GROUP</div>
    <div class="lh-services">REAL ESTATE &middot; PROPERTY MGMT &middot; BROKERAGE &middot; INVESTMENT SERVICES</div>
    <div class="lh-tag">New Yorkers Working for New Yorkers <span style="font-style:normal">EST. 2006</span></div>
  </div>
</div>`}

${bodyHtml}

</div><!-- .page-content -->
<div class="pf">
  <div class="pf-line">${esc(CAMELOT.address)} &middot; ${esc(CAMELOT.phone)} &middot; info@camelot.nyc &middot; www.camelot.nyc</div>
  <div class="pf-line">CONFIDENTIAL &mdash; ${version} &mdash; ${dateStr} &middot; Page ${n} of ${totalPagesPlaceholder}</div>
</div>
</div><!-- .page -->`;
  };

  const coverPage = pageWrap(`
<div class="cover-wrap">
  <h1 class="cover-title">Transition Plan</h1>
  <h2 class="cover-client">${esc(input.clientName)}</h2>
  <p class="cover-addr">${esc(input.propertyAddress)}</p>
  <p class="cover-meta">Prepared ${dateLong}</p>
</div>
`);

  const howThisWorksPage = pageWrap(article('How This Works', `
<p class="body">Camelot Property Management Services Corp. uses this Transition Guide to move a property between management companies without losing records, continuity, or institutional knowledge. Both the outgoing and incoming firms name one contact person to serve as liaison for the duration of the transition.</p>
<h3 class="art-sub">Timeframes</h3>
<ul class="blt">
<li><b>Immediately upon receipt of the termination/engagement letter:</b> items marked time-sensitive below, plus a transfer letter to the payroll agent authorizing the transfer of accounts and payroll records.</li>
<li><b>Five to ten days before the actual transition:</b> the balance of documents and records, plus available cash balances (cash in the account less outstanding checks, payroll reserve, authorized mortgage payment, and an appropriate reserve fund).</li>
<li><b>Within 45 days:</b> final bank reconciliation, final cash balance, final month's management statement, and any outstanding payments. Camelot prepares a report to the Board on any documents still missing, attached to the transition minutes.</li>
</ul>
`));

  const phasePages = input.phases
    .map((phase) =>
      pageWrap(
        article(
          `${phase.label} (${phase.dayRange})`,
          `<ul class="blt">${phase.actions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`
        )
      )
    )
    .join('\n');

  const checklistBody = `
<p class="body">Files are kept in and turned over in good order, labeled by category. This checklist reflects Camelot's standard transitional-records categories.</p>
<div class="checklist-grid">
${input.checklistCategories
  .map(
    (cat) => `
<div class="checklist-box">
  <div class="checklist-title">${esc(cat.category)}</div>
  <ul>${cat.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
</div>`
  )
  .join('')}
</div>`;
  const checklistPage = pageWrap(article('Records &amp; Files Checklist', checklistBody));

  const allPages = [coverPage, howThisWorksPage, phasePages, checklistPage].join('\n');
  const finalHtml = allPages.replace(new RegExp(totalPagesPlaceholder, 'g'), String(pageCounter));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transition Plan — ${esc(input.clientName)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{font-family:${BODY_FONT};color:${BODY_BLACK};font-size:9pt;line-height:1.55;background:#f5f0e5}
@page{size:8.5in 11in;margin:0.75in}
@media print{body{background:white}}
@media screen{
  .page{margin:20px auto;box-shadow:0 2px 10px rgba(0,0,0,0.1);background:white}
}
.page{width:8.5in;min-height:11in;padding:0.75in 0.75in 1.1in 0.75in;margin:20px auto;page-break-after:always;position:relative;background:white}
.page-content{position:relative;z-index:1;padding-top:6pt}

.letterhead{display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #D9D2C2}
.letterhead img{width:34px;height:34px;max-width:34px;max-height:34px;object-fit:contain;flex:0 0 34px}
.lh-text{flex:1;margin-left:2px}
.lh-name{font-size:13px;font-weight:700;color:#162B5E;letter-spacing:0.3px;margin:0}
.lh-services{font-size:6.5px;color:#6B7280;letter-spacing:1px;margin:2px 0 0}
.lh-tag{font-size:8px;color:#A9814A;font-style:italic;margin:2px 0 0}

.cover-wrap{text-align:center;padding-top:120pt}
h1.cover-title{font-family:${COVER_TITLE_FONT};color:${COVER_TITLE_COLOR};font-size:24pt;font-weight:400;margin:0 0 10pt}
h2.cover-client{font-family:${COVER_TITLE_FONT};color:${COVER_TITLE_COLOR};font-size:15pt;font-weight:400;margin:0 0 6pt}
p.cover-addr{font-family:${BODY_FONT};font-size:10pt;color:${BODY_BLACK};margin:0 0 24pt}
p.cover-meta{font-family:${BODY_FONT};font-size:9pt;color:#6B675F;margin:0}

h2.art{font-family:${HEADING_FONT};font-size:13pt;font-weight:700;color:${DARK_GOLD};text-align:center;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1.5pt solid ${GOLD_RULE};padding:12pt 0 6pt;margin:20pt 0 12pt;page-break-after:avoid}
h3.art-sub{font-family:${HEADING_FONT};font-size:11pt;font-weight:700;color:${DARK_GOLD};text-align:center;letter-spacing:0.5px;margin:14pt 0 8pt;page-break-after:avoid}
.page-content > .article-block:first-of-type > h2.art{margin-top:120pt}

p.body{font-family:${BODY_FONT};font-size:9.5pt;font-weight:400;color:${BODY_BLACK};margin-bottom:10pt;text-align:justify}
ul.blt{font-family:${BODY_FONT};font-size:9.5pt;color:${BODY_BLACK};margin:0 0 10pt 22px}
ul.blt li{margin-bottom:6pt;text-align:justify;line-height:1.5}
ul.blt b{color:${NAVY}}

.checklist-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12pt}
.checklist-box{border-left:2px solid ${GOLD_RULE};padding-left:12px}
.checklist-title{font-family:${HEADING_FONT};font-size:9.5pt;font-weight:700;color:${NAVY};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6pt}
.checklist-box ul{margin:0 0 0 14px;font-size:8.5pt;color:${BODY_BLACK}}
.checklist-box li{margin-bottom:4pt;line-height:1.4}

.article-block{page-break-inside:avoid}

.pf{margin-top:16px;padding-top:6px;border-top:1px solid #D9D2C2;text-align:center;font-family:${BODY_FONT};font-size:7pt;color:#6B7280}
.pf-line{text-align:center;margin:1pt 0}

@media print{
  @page{margin:0.75in}
  body{margin:0;padding:0}
  .page{margin:0;box-shadow:none}
}
</style>
</head>
<body>
${finalHtml}
</body>
</html>`;
}
