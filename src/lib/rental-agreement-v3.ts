/**
 * Camelot Rental Management Agreement — HTML generator.
 *
 * Mirrors the Word master template exactly: same letterhead header and
 * contact footer on every page, centered navy article titles in dark gold,
 * Articles I–XIX verbatim, single signature page with both parties, and
 * Schedules A/B/C with real Camelot rates.
 */

import { GOOGLE_MAPS_KEY } from '@/lib/maps-key';
import { RENTAL_AGREEMENT_LOGO_B64 } from '@/lib/agreement-brand';
import type { AgreementInput } from './excalibur';

const CAMELOT_OFFICE = {
  address: '57 West 57th Street, Suite 410, New York, NY 10019',
  short: '57 West 57th Street, Suite 410',
  phone: '(212) 206-9939',
  email: 'info@camelot.nyc',
  web: 'www.camelot.nyc',
  lat: 40.76464,
  lng: -73.98077,
};

const NUM_WORDS: Record<number, string> = {
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
  6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
  30: 'thirty', 60: 'sixty', 90: 'ninety', 120: 'one hundred twenty',
};
const numWord = (n: number) => NUM_WORDS[n] || String(n);
const termWords = (n: number) => `${numWord(n)} (${n})`;

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function generateRentalAgreementV3(input: AgreementInput): string {
  const now = new Date();
  const version = `v${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.1`;
  const dateStr = now.toISOString().slice(0, 10);

  const fullAddr = [input.propertyAddress, input.propertyCity, input.propertyState, input.propertyZip]
    .filter(Boolean)
    .join(', ')
    .trim();
  const addrDisplay = esc(fullAddr || '[PROPERTY ADDRESS]');
  const encodedAddr = encodeURIComponent(fullAddr || 'New York NY');

  const clientEntity = esc(input.clientEntityName || input.clientName || '[CLIENT ENTITY NAME]');
  const clientDisplay = esc(input.clientName || input.clientEntityName || '[CLIENT NAME]');

  const effDate = input.effectiveDate
    ? new Date(input.effectiveDate + 'T00:00:00')
    : now;
  const effDay = effDate.getDate();
  const effMonth = effDate.toLocaleDateString('en-US', { month: 'long' });
  const effYear = effDate.getFullYear();

  const monthlyFee =
    input.customMonthlyFee ||
    (input.tieredPricing ? input.tieredPricing[input.selectedTier].monthly : 0);
  const feeText = monthlyFee ? `${money(monthlyFee)} per month` : '[MONTHLY FEE] per month';
  const startupFeeSentence =
    input.startupFee > 0
      ? `The Client shall pay the Agent a one-time, non-refundable start-up fee of ${money(input.startupFee)}, due within five (5) business days of the Effective Date, to cover the Agent's initial onboarding expenses (collection and organization of Property files, resident and vendor announcements, bank account setup, and required public notices).`
      : `The Agent's standard one-time start-up fee is waived for this engagement. Onboarding — collection and organization of Property files, resident and vendor announcements, bank account setup, and required public notices — is included.`;

  const initialTermSentence = `The initial term of this Agreement shall commence on the Effective Date and shall continue for a period of ${termWords(input.initialTermYears || 2)} years (the "Initial Term"). Upon the conclusion of the Initial Term, this Agreement shall automatically renew for successive ${termWords(input.renewalTermYears || 1)} year periods (each a "Renewal Period," and together with the Initial Term, the "Term"), unless terminated as provided herein.`;

  const annualIncreaseSentence = input.annualIncrease
    ? ` The Services Compensation shall increase by ${input.annualIncrease}% on each anniversary of the Effective Date.`
    : '';

  const images = (input.propertyImages || []).filter(Boolean).slice(0, 5);
  const coverImage = images[0]
    ? `<div class="cover-photo"><img src="${images[0]}" alt="${addrDisplay}" /><div class="cover-photo-cap">${addrDisplay}</div></div>`
    : '';
  const extraImages =
    images.length > 1
      ? `<div class="photo-grid">${images
          .slice(1)
          .map((src: string) => `<img src="${src}" alt="Property photograph" />`)
          .join('')}</div>`
      : '';

  const lat = input.jackieData?.latitude;
  const lng = input.jackieData?.longitude;
  const distText =
    typeof lat === 'number' && typeof lng === 'number'
      ? ` — approximately ${milesBetween(CAMELOT_OFFICE.lat, CAMELOT_OFFICE.lng, lat, lng).toFixed(1)} miles from our office`
      : '';
  const mapBlock = `
<div class="loc-strip avoid-break">
  <div class="loc-map">
    <iframe src="https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_KEY}&origin=${encodeURIComponent(CAMELOT_OFFICE.address)}&destination=${encodedAddr}&mode=driving" width="100%" height="170" style="border:0" loading="lazy"></iframe>
  </div>
  <div class="loc-text">
    <div class="loc-title">Our Office &amp; Your Property</div>
    <p>This map shows the route from Camelot's office at ${CAMELOT_OFFICE.short}, Manhattan to ${addrDisplay}${distText}. Camelot's proximity to the Property means faster inspections, quicker emergency response, and a regular in-person presence at the building.</p>
  </div>
</div>`;

  const intel = (input.propertyIntel || []).filter(Boolean).slice(0, 10);
  const intelBlock = intel.length
    ? `<div class="intel avoid-break"><div class="loc-title">Property Overview</div><ul>${intel
        .map((f: string) => `<li>${esc(f)}</li>`)
        .join('')}</ul><div class="intel-src">Compiled from property records and documents provided by ownership.</div></div>`
    : '';

  const specialTermsArticle = input.specialTerms?.trim()
    ? `
<div class="article-block">
<h2 class="art">ARTICLE XX</h2>
<h3 class="art-sub">Special Terms</h3>
<p class="body">${esc(input.specialTerms.trim()).replace(/\n/g, '<br/>')}</p>
</div>`
    : '';

  const unitsText = input.units ? `${input.units}` : '[NUMBER OF UNITS]';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Camelot Rental Management Agreement — ${addrDisplay}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{font-family:Georgia,'Times New Roman',serif;color:#221F1A;font-size:12px;line-height:1.6;background:#f5f0e5}
@page{size:8.5in 11in;margin:0.75in}
@media print{body{background:white}}
@media screen{
  .page{margin:20px auto;box-shadow:0 2px 10px rgba(0,0,0,0.1);background:white}
}
.page{width:8.5in;height:11in;padding:0.75in 0.75in 1.2in 0.75in;margin:20px auto;border:2px solid #B8960F;page-break-after:always;position:relative;overflow:hidden;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
.page-content{position:relative;z-index:1}

/* Letterhead */
.letterhead{display:flex;align-items:center;gap:12px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #8a867e}
.letterhead img{width:44px;height:44px}
.lh-text{flex:1}
.lh-name{font-size:14px;font-weight:700;color:#1B2A4A;letter-spacing:0.5px;margin:0}
.lh-services{font-size:7.5px;color:#6B675F;letter-spacing:1px;margin:1px 0}
.lh-tag{font-size:9px;color:#A9814A;font-style:italic;margin:2px 0}

/* Title */
h1.title{font-size:18px;font-weight:700;color:#1B2A4A;text-align:center;letter-spacing:1px;margin:8px 0 12px;text-transform:uppercase}

/* Article headings - CENTERED and DARK GOLD */
h2.art{font-size:12px;font-weight:700;color:#8B6F47;text-align:center;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #B8960F;padding:12px 0 8px;margin:20px 0 0;page-break-after:avoid}
h3.art-sub{font-size:11px;font-weight:700;color:#8B6F47;text-align:center;letter-spacing:0.5px;margin:4px 0 12px;padding:0;page-break-after:avoid}

/* Body text */
p.body{margin-bottom:8px;text-align:justify}
p.ind{margin:0 0 7px 18px;text-align:justify}
p.deflist{margin-bottom:8px;text-align:justify}
p.deflist b{color:#221F1A}
ul.blt{margin:0 0 8px 24px}
ul.blt li{margin-bottom:4px;text-align:justify}

/* Photos */
.cover-photo{margin:0 0 12px;page-break-inside:avoid}
.cover-photo img{width:100%;max-height:250px;object-fit:cover;border:1px solid #d8d4cb;border-radius:3px}
.cover-photo-cap{font-size:8px;color:#6B675F;text-align:center;padding-top:3px}
.photo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}
.photo-grid img{width:100%;height:80px;object-fit:cover;border:1px solid #d8d4cb;border-radius:2px}

/* Map */
.loc-strip{display:flex;gap:12px;margin:12px 0;align-items:stretch}
.loc-map{flex:0 0 45%;border:1px solid #d8d4cb;border-radius:3px;overflow:hidden}
.loc-map iframe{width:100%;height:100%}
.loc-text{flex:1}
.loc-title{font-size:10px;font-weight:700;color:#1B2A4A;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #C9A55C;padding-bottom:2px;display:inline-block}
.loc-text p{font-size:10.5px;text-align:justify;color:#3a372f}

/* Property Overview */
.intel{margin:0 0 12px;page-break-inside:avoid}
.intel ul{margin:3px 0 5px 20px}
.intel li{font-size:10.5px;margin-bottom:2px}
.intel-src{font-size:8px;color:#9b968b;font-style:italic}

/* Tables */
table.fee{width:100%;border-collapse:collapse;font-size:10px;margin:8px 0 5px}
table.fee th{background:#1B2A4A;color:#fff;text-align:left;padding:6px 8px;font-size:9px;letter-spacing:0.5px;text-transform:uppercase}
table.fee td{padding:6px 8px;border-bottom:1px solid #e8e5de}
table.fee tr:nth-child(odd) td{background:#F7F4EC}
td.fee-amt{white-space:nowrap;font-weight:700;color:#1B2A4A}
.sched-note{font-size:10px;font-style:italic;color:#6B675F;margin:5px 0 0}

/* Signature page */
.sig-page{page-break-before:always;padding-top:8px;text-align:center}
.sig-head{font-size:13px;font-weight:700;color:#1B2A4A;letter-spacing:2px;margin-bottom:8px;text-transform:uppercase}
.sig-wit{margin:0 auto 20px;max-width:600px}
.sig-witness{font-style:italic;font-size:11px}
.sig-party{font-size:11px;font-weight:700;color:#1B2A4A;letter-spacing:2px;margin:28px 0 20px;text-transform:uppercase}
.sig-line{width:280px;margin:0 auto 4px;border-bottom:1.5px solid #221F1A;height:28px}
.sig-field{margin-bottom:4px;font-size:10px}
.sig-field b{color:#221F1A;font-weight:700}
.sig-rule{width:70%;margin:24px auto;border-bottom:1px solid #C9A55C}

/* Schedules */
.sched-title{font-size:13px;font-weight:700;color:#1B2A4A;text-align:center;letter-spacing:1px;margin:0 0 10px;text-transform:uppercase}
.sched{page-break-before:always;padding-top:8px}
.avoid-break{page-break-inside:avoid}
.article-block{page-break-inside:avoid}

/* Footer */
.pf{position:absolute;bottom:0.5in;left:0.75in;right:0.75in;height:0.5in;padding:6px 0;border-top:1px solid #B8960F;text-align:center;font-size:8px;color:#6B675F;display:flex;justify-content:space-between;align-items:center}
.pf-left{text-align:left;flex:0 0 40%}
.pf-center{flex:1;text-align:center}
.pf-right{text-align:right;flex:0 0 auto}
.pf-conf{font-size:7px;color:#9b968b}

@media print{
  @page{margin:0.75in}
  body{margin:0;padding:0}
  .page{margin:0;box-shadow:none}
  .pf{position:absolute}
}
</style>
</head>
<body>

<div class="page">
<div class="page-content">

<!-- LETTERHEAD -->
<div class="letterhead">
  <img src="${RENTAL_AGREEMENT_LOGO_B64}" alt="Camelot" />
  <div class="lh-text">
    <div class="lh-name">CAMELOT REALTY GROUP</div>
    <div class="lh-services">REAL ESTATE · PROPERTY MGMT · BROKERAGE · INVESTMENT SERVICES</div>
    <div class="lh-tag">New Yorkers Working for New Yorkers <span style="font-style:normal;font-size:7px">EST. 2006</span></div>
  </div>
</div>

<h1 class="title">Camelot Rental Management Agreement</h1>

${coverImage}

<p class="body">THIS AGREEMENT (the "Agreement") is made as of this ${effDay} day of ${effMonth}, ${effYear} (the "Effective Date"), by and between <b>${clientEntity}</b>, having its principal office at ${input.clientAddress || '[CLIENT ADDRESS]'} ("Client"), and <b>CAMELOT PROPERTY MANAGEMENT SERVICES CORP.</b>, a New York corporation, having its principal office at ${CAMELOT_OFFICE.address} (the "Agent," and together with the Client, the "Parties," and each a "Party").</p>
<p class="body">WHEREAS, the Client owns certain real property known as and located at ${addrDisplay} (the "Property"), consisting of one (1) residential rental building and ${unitsText} rental units; and</p>
<p class="body">WHEREAS, the Client desires to engage the Agent to perform the Services and the Additional Services (as defined herein) in connection with the rental units at the Property, and the Agent desires to be so engaged;</p>
<p class="body">NOW, THEREFORE, for good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:</p>

${mapBlock}
${extraImages}
${intelBlock}

<div class="article-block">
<h2 class="art">ARTICLE I</h2>
<h3 class="art-sub">Definitions</h3>
<p class="deflist"><b>"Additional Services"</b> shall mean Lease Services, Transfer Services, Financing Services, Hearing Services, Audit Services, Pre-Occupation Services, Emergency Services, and Extraordinary Project Services, each as further described in Article IX.</p>
<p class="deflist"><b>"Client Account"</b> shall mean a bank account, in a bank whose deposits are insured by the Federal Deposit Insurance Corporation, maintained in a manner that indicates its custodial nature, for the deposit of monies of the Client, with authority granted to the Agent to withdraw therefrom for payments due under this Agreement, including the Agent's Compensation, subject to the limitations set out herein.</p>
<p class="deflist"><b>"Emergency Services"</b> shall mean any Additional Services that, in the Agent's reasonable determination, must be performed immediately to maintain the continuing occupancy and safe operation of the Property or any rental unit.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE II</h2>
<h3 class="art-sub">Term</h3>
<p class="body">${initialTermSentence}</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE III</h2>
<h3 class="art-sub">Exclusive Agency</h3>
<p class="body">During the Term, absent the Agent's prior written consent, no party other than the Agent shall perform the Services or Additional Services with respect to the Property. The Agent shall be entitled to place a small sign at the Property identifying the Agent as the managing agent.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE IV</h2>
<h3 class="art-sub">Termination</h3>
<p class="ind"><b>Termination for Material Breach.</b> If either Party is in material breach of this Agreement, the breaching Party shall have five (5) business days from receipt of written notice of such breach (the "Cure Period") to cure it. If the breach is not cured within the Cure Period, the non-breaching Party may terminate this Agreement immediately upon written notice.</p>
<p class="ind"><b>Termination for Convenience.</b> Following the Initial Term, this Agreement may otherwise be terminated by either Party upon ${termWords(input.terminationNoticeDays || 90)} days prior written notice to the other Party.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE V</h2>
<h3 class="art-sub">Compensation</h3>
<p class="body">As consideration for the Services, the Client shall pay the Agent the fees set forth herein.</p>
<p class="body"><b>Management Fee:</b> <u>${feeText}</u>${annualIncreaseSentence}</p>
<p class="body">${startupFeeSentence}</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE VI</h2>
<h3 class="art-sub">Agent's Duties (the Services)</h3>
<p class="body">As consideration for the Compensation, during the Term the Agent shall perform the following Services on the Client's behalf: maintain the Property in proper condition, conduct regular inspections, address violations, manage utilities and service contracts, purchase necessary supplies, review and pay all bills and assessments, collect rent, keep accurate records, provide monthly statements, and maintain 24-hour emergency contact.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE VII</h2>
<h3 class="art-sub">Insurance</h3>
<p class="body">The Agent shall maintain commercial general liability, workers' compensation, professional liability, and employment practices liability insurance. The Client shall maintain fire, multi-peril, general liability, workers' compensation, and statutory disability coverage.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE VIII</h2>
<h3 class="art-sub">Indemnification &amp; Limitation of Liability</h3>
<p class="body">The Client shall indemnify and hold the Agent harmless from liability arising from the Property or the Agent's performance of this Agreement, except for claims caused by the Agent's negligence or willful misconduct. The indemnification shall survive termination for five (5) years.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE IX</h2>
<h3 class="art-sub">Additional Services</h3>
<p class="body">The Agent may provide Additional Services including Lease Services, Transfer Services, Financing Services, Hearing Services, Audit Services, Pre-Occupation Services, Emergency Services, and Extraordinary Project Services, each at rates specified in the Fee Schedule.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE X</h2>
<h3 class="art-sub">Additional Fees &amp; Supplemental Services</h3>
<p class="body">The Agent may bill for supplemental services including Application Review ($200) and Alteration Review ($500). All Reimbursable Expenses are due on the first day of the month following the month incurred.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE XI</h2>
<h3 class="art-sub">Personnel</h3>
<p class="body">The Agent shall hire, pay, and supervise all Employees necessary to properly maintain and operate the Property. For nine (9) months following termination, the Client shall not solicit or hire any Agent employee without payment of 25% of that person's annual salary.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE XII</h2>
<h3 class="art-sub">Financial Administration</h3>
<p class="body">Invoices for emergency work or project management services remaining unpaid more than thirty (30) days from submission shall accrue interest at 1.5% per month. All commissions shall be made payable to the Agent first, with net proceeds then paid to the Client.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE XIII</h2>
<h3 class="art-sub">Authority</h3>
<p class="body">The Client authorizes the Agent, on its behalf, to perform any act reasonably necessary to render the Services and Additional Services, subject to the limitations herein.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE XIV</h2>
<h3 class="art-sub">Bank Accounts</h3>
<ul class="blt">
<li>The Agent shall establish and maintain Client Accounts as necessary to perform its obligations hereunder.</li>
<li>Each Client Account shall designate that it is held on the Client's behalf.</li>
<li>Any transfer of $10,000 or more from a Client Account requires the Client's prior written approval and two authorized signatories.</li>
<li>The Agent shall maintain a separate security deposit account, used solely to hold and return Tenant security deposits.</li>
</ul>
</div>

<div class="article-block">
<h2 class="art">ARTICLE XV</h2>
<h3 class="art-sub">Licenses</h3>
<p class="body">The Agent represents that it is duly licensed by the New York Department of State as a real estate broker, sufficient to lawfully perform its duties under this Agreement.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE XVI</h2>
<h3 class="art-sub">Notices &amp; Miscellaneous</h3>
<p class="body">All notices under this Agreement shall be in writing and effective only if served personally, sent by nationally recognized overnight courier, or sent by certified or registered mail.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE XVII</h2>
<h3 class="art-sub">Governing Law</h3>
<p class="body">This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to conflict-of-law principles.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE XVIII</h2>
<h3 class="art-sub">Entire Agreement</h3>
<p class="body">This Agreement constitutes the entire agreement between the Parties and may not be amended orally. It shall bind and inure to the benefit of the Parties and their successors, and may not be assigned by either Party without the other's prior written consent.</p>
</div>

<div class="article-block">
<h2 class="art">ARTICLE XIX</h2>
<h3 class="art-sub">Independent Contractor</h3>
<p class="body">The Agent's relationship to the Client under this Agreement is that of an independent contractor. Nothing herein shall be construed to create a partnership, joint venture, or employer-employee relationship.</p>
</div>

${specialTermsArticle}

</div><!-- .page-content -->
<div class="pf">
  <div class="pf-left">${CAMELOT_OFFICE.address} · ${CAMELOT_OFFICE.phone}</div>
  <div class="pf-center"><span class="pf-conf">CONFIDENTIAL — ${version} — ${dateStr}</span></div>
  <div class="pf-right">Page 1</div>
</div>
</div><!-- .page -->

<!-- SIGNATURE PAGE -->
<div class="page">
<div class="page-content">

<div class="letterhead">
  <img src="${RENTAL_AGREEMENT_LOGO_B64}" alt="Camelot" />
  <div class="lh-text">
    <div class="lh-name">CAMELOT REALTY GROUP</div>
    <div class="lh-services">REAL ESTATE · PROPERTY MGMT · BROKERAGE · INVESTMENT SERVICES</div>
    <div class="lh-tag">New Yorkers Working for New Yorkers <span style="font-style:normal;font-size:7px">EST. 2006</span></div>
  </div>
</div>

<div class="sig-page">
  <div class="sig-head">SIGNATURES</div>
  <div class="sig-wit">
    <p class="sig-witness">IN WITNESS WHEREOF, the parties hereto have executed this Agreement as of the day and year first above written.</p>
  </div>

  <div class="sig-party">CLIENT</div>
  <div class="sig-field"><b>Name:</b> ____________________________</div>
  <div class="sig-field"><b>Title:</b> ____________________________</div>
  <div class="sig-field"><b>Date:</b> ____________________________</div>

  <div class="sig-rule"></div>

  <div class="sig-party">AGENT</div>
  <div class="sig-field"><b>Name:</b> ____________________________</div>
  <div class="sig-field"><b>Title:</b> ____________________________</div>
  <div class="sig-field"><b>Date:</b> ____________________________</div>
</div>

</div><!-- .page-content -->
<div class="pf">
  <div class="pf-left">${CAMELOT_OFFICE.address} · ${CAMELOT_OFFICE.phone}</div>
  <div class="pf-center"><span class="pf-conf">CONFIDENTIAL — ${version} — ${dateStr}</span></div>
  <div class="pf-right">Page 2</div>
</div>
</div><!-- .page -->

<!-- SCHEDULE A -->
<div class="page">
<div class="page-content">

<div class="letterhead">
  <img src="${RENTAL_AGREEMENT_LOGO_B64}" alt="Camelot" />
  <div class="lh-text">
    <div class="lh-name">CAMELOT REALTY GROUP</div>
    <div class="lh-services">REAL ESTATE · PROPERTY MGMT · BROKERAGE · INVESTMENT SERVICES</div>
    <div class="lh-tag">New Yorkers Working for New Yorkers <span style="font-style:normal;font-size:7px">EST. 2006</span></div>
  </div>
</div>

<div class="sched-title">Schedule A — Fee Schedule</div>
<table class="fee">
<tr><th>Service</th><th style="text-align:right">Fee</th></tr>
<tr><td>Monthly Property Management</td><td class="fee-amt">${feeText}</td></tr>
<tr><td>Agent Insurance Contribution</td><td class="fee-amt">$450.00 annually</td></tr>
<tr><td>Project Manager (Emergency/Supervision)</td><td class="fee-amt">$150.00/hour</td></tr>
<tr><td>Application Review</td><td class="fee-amt">$200.00</td></tr>
<tr><td>Alteration Review</td><td class="fee-amt">$500.00</td></tr>
<tr><td>Pre-Occupation Services</td><td class="fee-amt">$150.00/hour</td></tr>
<tr><td>Court Appearance/Deposition</td><td class="fee-amt">$150.00/hour</td></tr>
</table>

</div><!-- .page-content -->
<div class="pf">
  <div class="pf-left">${CAMELOT_OFFICE.address} · ${CAMELOT_OFFICE.phone}</div>
  <div class="pf-center"><span class="pf-conf">CONFIDENTIAL — ${version} — ${dateStr}</span></div>
  <div class="pf-right">Page 3</div>
</div>
</div><!-- .page -->



</body>
</html>`;
}
