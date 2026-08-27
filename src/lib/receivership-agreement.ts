// Receivership Property Management Agreement generator.
//
// Produces the same page/letterhead/footer/typography contract as
// rental-agreement-v3.ts (article-block, h2.art, h3.art-sub, p.body, p.ind,
// sig-page, table.fee, etc.) so the existing dual Word/PDF export pipeline
// (agreement-docx-export.ts + pdf-generator.ts) works on this template
// without any changes.
//
// The bulk legal text lives in receivership-agreement-content.ts (auto-
// generated from the uploaded template docx) as a set of pre-paginated HTML
// chunks with %%TOKEN%% merge fields. This file supplies the cover page,
// recitals, signature page, and the token values, then stitches everything
// together into pages.

import { RENTAL_AGREEMENT_LOGO_B64 } from '@/lib/agreement-brand';
import {
  COVER_TITLE_FONT,
  COVER_TITLE_COLOR,
  HEADING_FONT,
  DARK_GOLD,
  GOLD_RULE,
  BODY_FONT,
  BODY_BLACK,
} from '@/lib/rental-agreement-v3';
import { RECEIVERSHIP_INTRO_HTML, RECEIVERSHIP_PAGE_CHUNKS } from '@/lib/receivership-agreement-content';

const CAMELOT_OFFICE = {
  address: '57 West 57th Street, Suite 410, New York, NY 10019',
  phone: '(212) 206-9939',
};

export interface ReceivershipAgreementInput {
  // Property
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  propertyImage?: string; // data URI, optional cover photo

  // Parties
  managerEntityName: string;
  managerEntityState: string; // e.g. "New York corporation"
  ownerEntityName: string; // e.g. "Sylvan Receiver Services, LLC"
  ownerEntityState: string; // e.g. "Maryland"
  specialServicerName: string;
  trusteeName: string;
  certificateSeries: string;

  // Dates
  commencementDate: string; // yyyy-mm-dd from a date input

  // Compensation
  managementFeeText: string; // free text, e.g. "5% of Total Revenues" or "$3,600 per month"

  // Notices — Owner
  ownerNoticeName: string;
  ownerNoticeAddress1: string;
  ownerNoticeAddress2: string;
  ownerNoticeAttention: string;
  ownerNoticePhone: string;
  ownerNoticeEmail: string;
  ownerNoticeCopyTo: string; // free text block, optional ("With a Copy to:")

  // Notices — Manager (defaults to Camelot)
  managerNoticeName: string;
  managerNoticeAddress1: string;
  managerNoticeAddress2: string;
  managerNoticeAttention: string;
  managerNoticePhone: string;
  managerNoticeEmail: string;

  // Misc
  wireInstructionsTo: string;
  preparedFor: string;
}

export const DEFAULT_RECEIVERSHIP_INPUT: ReceivershipAgreementInput = {
  propertyAddress: '',
  propertyCity: '',
  propertyState: 'NY',
  propertyZip: '',
  propertyImage: undefined,

  managerEntityName: 'Camelot Property Management Services Corp.',
  managerEntityState: 'New York corporation',
  ownerEntityName: '',
  ownerEntityState: '',
  specialServicerName: '',
  trusteeName: '',
  certificateSeries: '',

  commencementDate: '',

  managementFeeText: '',

  ownerNoticeName: '',
  ownerNoticeAddress1: '',
  ownerNoticeAddress2: '',
  ownerNoticeAttention: '',
  ownerNoticePhone: '',
  ownerNoticeEmail: '',
  ownerNoticeCopyTo: '',

  managerNoticeName: 'Camelot Property Management Services Corp.',
  managerNoticeAddress1: '57 West 57th Street, Suite 410',
  managerNoticeAddress2: 'New York, NY 10019',
  managerNoticeAttention: 'David A. Goldoff',
  managerNoticePhone: '(212) 206-9939',
  managerNoticeEmail: 'dgoldoff@camelot.nyc',

  wireInstructionsTo: '',
  preparedFor: '',
};

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function blankOr(s: string, fallback: string): string {
  const t = (s || '').trim();
  return t ? esc(t) : fallback;
}

function formatDateLong(iso: string): string {
  if (!iso) return '____________________________';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return esc(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function generateReceivershipAgreement(input: ReceivershipAgreementInput): string {
  const addrLine1 = input.propertyAddress || '[PROPERTY ADDRESS]';
  const addrLine2 = [input.propertyCity, input.propertyState].filter(Boolean).join(', ') + (input.propertyZip ? ` ${input.propertyZip}` : '');
  const addrFull = [input.propertyAddress, input.propertyCity, input.propertyState].filter(Boolean).join(', ') + (input.propertyZip ? ` ${input.propertyZip}` : '');
  const effDateLong = formatDateLong(new Date().toISOString().slice(0, 10));
  const commencementLong = formatDateLong(input.commencementDate);

  const UNDERLINE = '____________________________';

  const tokens: Record<string, string> = {
    MANAGER_NAME: blankOr(input.managerEntityName, 'Camelot Property Management Services Corp.'),
    MANAGER_STATE: blankOr(input.managerEntityState, 'New York corporation'),
    OWNER_NAME: blankOr(input.ownerEntityName, UNDERLINE),
    OWNER_STATE: blankOr(input.ownerEntityState, UNDERLINE),
    SPECIAL_SERVICER_NAME: blankOr(input.specialServicerName, UNDERLINE),
    TRUSTEE_NAME: blankOr(input.trusteeName, UNDERLINE),
    CERTIFICATE_SERIES: blankOr(input.certificateSeries, UNDERLINE),
    PROPERTY_ADDRESS_FULL: blankOr(addrFull, '[PROPERTY ADDRESS]'),
    MANAGEMENT_FEE_TEXT: blankOr(input.managementFeeText, UNDERLINE),

    OWNER_NOTICE_NAME: blankOr(input.ownerNoticeName, 'c/o ___________________________'),
    OWNER_NOTICE_ADDR1: blankOr(input.ownerNoticeAddress1, UNDERLINE),
    OWNER_NOTICE_ADDR2: blankOr(input.ownerNoticeAddress2, ''),
    OWNER_NOTICE_ATTN: blankOr(input.ownerNoticeAttention, UNDERLINE),
    OWNER_NOTICE_PHONE: blankOr(input.ownerNoticePhone, UNDERLINE),
    OWNER_NOTICE_EMAIL: blankOr(input.ownerNoticeEmail, UNDERLINE),
    OWNER_NOTICE_COPY_BLOCK: input.ownerNoticeCopyTo?.trim()
      ? `<p class="body"><b>With a Copy to:</b></p><p class="ind">${esc(input.ownerNoticeCopyTo).replace(/\n/g, '<br/>')}</p>`
      : '',

    MGR_NOTICE_NAME: blankOr(input.managerNoticeName, 'Camelot Property Management Services Corp.'),
    MGR_NOTICE_ADDR1: blankOr(input.managerNoticeAddress1, '57 West 57th Street, Suite 410'),
    MGR_NOTICE_ADDR2: blankOr(input.managerNoticeAddress2, 'New York, NY 10019'),
    MGR_NOTICE_ATTN: blankOr(input.managerNoticeAttention, 'David A. Goldoff'),
    MGR_NOTICE_PHONE: blankOr(input.managerNoticePhone, '(212) 206-9939'),
    MGR_NOTICE_EMAIL: blankOr(input.managerNoticeEmail, 'dgoldoff@camelot.nyc'),

    WIRE_INSTRUCTIONS_TO: blankOr(input.wireInstructionsTo, UNDERLINE),
  };

  const applyTokens = (html: string): string => {
    let out = html;
    for (const [key, val] of Object.entries(tokens)) {
      out = out.split(`%%${key}%%`).join(val);
    }
    return out;
  };

  let pageCounter = 0;
  const totalPagesPlaceholder = '__TOTAL_PAGES__';
  const version = `v${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}.1`;
  const dateStr = new Date().toISOString().slice(0, 10);

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
  <div class="pf-line">${CAMELOT_OFFICE.address} &middot; ${CAMELOT_OFFICE.phone}</div>
  <div class="pf-line">CONFIDENTIAL &mdash; ${version} &mdash; ${dateStr} &middot; Page ${n} of ${totalPagesPlaceholder}</div>
</div>
</div><!-- .page -->`;
  };

  // ---- Page 1: cover ----
  const coverPage = pageWrap(`
<div class="cover-wrap">
  <h1 class="cover-addr">${esc(addrLine1)}</h1>
  <h2 class="cover-citystate">${esc(addrLine2)}</h2>
  ${input.propertyImage ? `<div class="cover-photo-box"><img src="${input.propertyImage}" alt="${esc(addrLine1)}" /></div>` : ''}
  <p class="cover-doctype">Receivership Property Management Agreement</p>
  <p class="cover-dateprep">Date: ${effDateLong}${input.preparedFor ? `&nbsp;&nbsp;&nbsp;Prepared for: ${esc(input.preparedFor)}` : ''}</p>
  <p class="cover-version">Version 01.</p>
</div>
`);

  // ---- Page 2: intro / recitals ----
  const recitalsPage = pageWrap(applyTokens(RECEIVERSHIP_INTRO_HTML));

  // ---- Body pages, one per pre-chunked section ----
  const bodyPages = RECEIVERSHIP_PAGE_CHUNKS.map((chunk) => {
    const html = `<div class="article-block">\n${chunk.titleHtml}\n${chunk.subtitleHtml}\n${chunk.body}\n</div>`;
    return pageWrap(applyTokens(html));
  }).join('\n');

  // ---- Signature page ----
  const signaturePage = pageWrap(`
<div class="sig-page">
  <div class="sig-head">SIGNATURES</div>
  <div class="sig-wit">
    <p class="sig-witness">IN WITNESS WHEREOF, the parties hereto have duly executed and delivered this Agreement effective as of the Commencement Date.</p>
  </div>

  <div class="sig-party">OWNER</div>
  <p class="body">${tokens.OWNER_NAME}, a ${tokens.OWNER_STATE} limited liability company</p>
  <p class="body">By: ${tokens.TRUSTEE_NAME}, as Trustee for the registered holders of ${tokens.CERTIFICATE_SERIES} (the &#8220;Trust&#8221;), sole member/manager</p>
  <p class="body">By: ${tokens.SPECIAL_SERVICER_NAME}, solely in its capacity as Special Servicer to the Trust</p>
  <div class="sig-field"><b>Name:</b> ____________________________</div>
  <div class="sig-field"><b>Title:</b> ____________________________</div>
  <div class="sig-field"><b>Date:</b> ____________________________</div>
  <div class="sig-field"><b>Commencement Date (to be filled by Owner):</b> ${input.commencementDate ? esc(commencementLong) : '____________________________'}</div>

  <div class="sig-rule"></div>

  <div class="sig-party">MANAGER</div>
  <p class="body">${tokens.MANAGER_NAME}, a ${tokens.MANAGER_STATE}</p>
  <div class="sig-field"><b>Name:</b> ____________________________</div>
  <div class="sig-field"><b>Title:</b> ____________________________</div>
  <div class="sig-field"><b>Date:</b> ____________________________</div>
</div>
`);

  const allPages = [coverPage, recitalsPage, bodyPages, signaturePage].join('\n');
  const finalHtml = allPages.replace(new RegExp(totalPagesPlaceholder, 'g'), String(pageCounter));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Camelot Receivership Property Management Agreement — ${esc(addrLine1)}</title>
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
.letterhead img{width:34px;height:34px;flex:0 0 34px}
.lh-text{flex:1;margin-left:2px}
.lh-name{font-size:13px;font-weight:700;color:#162B5E;letter-spacing:0.3px;margin:0}
.lh-services{font-size:6.5px;color:#6B7280;letter-spacing:1px;margin:2px 0 0}
.lh-tag{font-size:8px;color:#A9814A;font-style:italic;margin:2px 0 0}

.cover-wrap{text-align:center;padding-top:120pt}
h1.cover-addr{font-family:${COVER_TITLE_FONT};color:${COVER_TITLE_COLOR};font-size:18pt;font-weight:400;margin:0 0 4pt;line-height:1.25}
h2.cover-citystate{font-family:${COVER_TITLE_FONT};color:${COVER_TITLE_COLOR};font-size:16pt;font-weight:400;margin:0 0 18pt;line-height:1.25}
.cover-photo-box{margin:0 auto 16pt;width:4.5in;height:3.5in;border:1px solid #000;overflow:hidden}
.cover-photo-box img{width:100%;height:100%;object-fit:cover;display:block}
p.cover-meta{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};font-weight:400;margin:0 0 20pt}
p.cover-doctype{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};font-weight:400;margin:0 0 4pt}
p.cover-dateprep{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};font-weight:400;margin:0 0 14pt}
p.cover-version{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};font-weight:400;margin:0}

h2.art{font-family:${HEADING_FONT};font-size:12pt;font-weight:700;color:${DARK_GOLD};text-align:center;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1.5pt solid ${GOLD_RULE};padding:12pt 0 6pt;margin:20pt 0 0;page-break-after:avoid}
h3.art-sub{font-family:${HEADING_FONT};font-size:11pt;font-weight:700;color:${DARK_GOLD};text-align:center;letter-spacing:0.5px;margin:6pt 0 10pt;padding:0;page-break-after:avoid}
.page-content > .article-block:first-of-type > h2.art{margin-top:120pt}
.page-content > p.body:first-of-type{margin-top:64pt}

p.body{font-family:${BODY_FONT};font-size:9pt;font-weight:400;color:${BODY_BLACK};margin-bottom:8pt;text-align:justify}
p.ind{font-family:${BODY_FONT};font-size:9pt;font-weight:400;color:${BODY_BLACK};margin:0 0 7pt 18pt;text-align:justify}
p.deflist{font-family:${BODY_FONT};font-size:9pt;font-weight:400;color:${BODY_BLACK};margin-bottom:8pt;text-align:justify}
p.deflist b{font-weight:700;color:${BODY_BLACK}}

table.fee{width:100%;border-collapse:collapse;font-family:${BODY_FONT};font-size:9pt;margin:8pt 0 5pt}
table.fee th{background:#1B2A4A;color:#fff;text-align:left;padding:6pt 8pt;font-size:8.5pt;letter-spacing:0.5px;text-transform:uppercase}
table.fee td{padding:6pt 8pt;border-bottom:1px solid #e8e5de;font-weight:400}
table.fee tr:nth-child(odd) td{background:#F7F4EC}
td.fee-amt{white-space:nowrap;font-weight:700;color:#1B2A4A}
td.ins-sub{padding-left:18pt;font-style:italic;color:#6B675F}

.sig-page{padding-top:80pt;text-align:center}
.sig-head{font-family:${HEADING_FONT};font-size:13pt;font-weight:700;color:#1B2A4A;letter-spacing:2px;margin-bottom:8pt;text-transform:uppercase}
.sig-wit{margin:0 auto 20px;max-width:600px}
.sig-witness{font-family:${BODY_FONT};font-style:italic;font-size:9pt}
.sig-party{font-family:${HEADING_FONT};font-size:11pt;font-weight:700;color:#1B2A4A;letter-spacing:2px;margin:28px 0 20px;text-transform:uppercase}
.sig-field{font-family:${BODY_FONT};margin-bottom:10px;font-size:9pt}
.sig-field b{color:${BODY_BLACK};font-weight:700}
.sig-rule{width:70%;margin:24px auto;border-bottom:1px solid #C9A55C}

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
