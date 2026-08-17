/**
 * Camelot Rental Management Agreement — HTML generator.
 *
 * Mirrors the Word master template
 * (Camelot Template Library / Property Management Agreements /
 * Camelot_Rental_Management_Agreement_Template.docx) exactly: same letterhead
 * header and contact footer on every page, same left-aligned navy article
 * headings with a gold rule, same article structure (I–XIX), same wording,
 * bullets, and hierarchy, same single signature page with both parties, and
 * the same Schedules A/B/C fee tables.
 *
 * Additions the page supplies on top of the template:
 *  - Optional property photographs (first = cover image; none = no image block)
 *  - One small map showing how far Camelot's office is from the property
 *  - Optional "Property Overview" facts parsed from uploaded documents
 */

import { GOOGLE_MAPS_KEY } from '@/lib/maps-key';
import { RENTAL_AGREEMENT_LOGO_B64 } from '@/lib/agreement-brand';
import type { AgreementInput } from './excalibur';

const CAMELOT_OFFICE = {
  address: '57 West 57th Street, Suite 410, New York, NY 10019',
  short: '57 West 57th Street, Suite 410',
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

/** Straight-line miles between two coordinates (haversine). */
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

function feeRow(label: string, fee: string): string {
  return `<tr><td>${label}</td><td class="fee-amt">${fee}</td></tr>`;
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

  // ------------------------------------------------------------------
  // Optional property photographs — first image is the cover. If no
  // images were uploaded there is no image block at all.
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // One small map — how far Camelot's office is from the property.
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Optional facts parsed from uploaded documents (PropertyShark, rent
  // rolls, offering materials, etc.).
  // ------------------------------------------------------------------
  const intel = (input.propertyIntel || []).filter(Boolean).slice(0, 10);
  const intelBlock = intel.length
    ? `<div class="intel avoid-break"><div class="loc-title">Property Overview</div><ul>${intel
        .map((f: string) => `<li>${esc(f)}</li>`)
        .join('')}</ul><div class="intel-src">Compiled from property records and documents provided by ownership.</div></div>`
    : '';

  const specialTermsArticle = input.specialTerms?.trim()
    ? `
<h2 class="art">ARTICLE XX — Special Terms</h2>
<p class="body">${esc(input.specialTerms.trim()).replace(/\n/g, '<br/>')}</p>`
    : '';

  const unitsText = input.units ? `${input.units}` : '[NUMBER OF UNITS]';

  // ==================================================================
  // HTML
  // ==================================================================
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Camelot Rental Management Agreement — ${addrDisplay}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,'Times New Roman',serif;color:#221F1A;font-size:12.5px;line-height:1.65;background:#fff}
.doc-table{width:100%;border-collapse:collapse}
.doc-table>thead>tr>td,.doc-table>tbody>tr>td,.doc-table>tfoot>tr>td{padding:0;border:0}
.sheet{max-width:760px;margin:0 auto;padding:0 8px}

/* Letterhead — repeated at the top of every printed page via <thead> */
.letterhead{display:flex;align-items:center;gap:14px;max-width:760px;margin:0 auto;padding:14px 8px 8px}
.letterhead img{width:52px;height:52px;flex:none}
.lh-name{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:17px;font-weight:700;color:#1B2A4A;letter-spacing:1px}
.lh-services{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:8.5px;color:#6B675F;letter-spacing:1.5px;margin-top:2px}
.lh-tag{font-size:10.5px;color:#A9814A;font-style:italic;margin-top:2px}
.lh-tag .est{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-style:normal;color:#221F1A;font-size:8.5px;letter-spacing:1px}
.lh-rule{max-width:760px;margin:0 auto 14px;border-bottom:1px solid #8a867e;padding-top:2px}

/* Contact footer — repeated at the bottom of every printed page */
.pagefoot{max-width:760px;margin:18px auto 0;padding:6px 8px 12px;border-top:1px solid #b7b3aa;text-align:center;font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:9px;color:#6B675F}
.pagefoot .conf{margin-top:3px;font-size:8px;letter-spacing:0.5px}
.pagefoot .conf b{color:#A9814A}

h1.title{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:22px;font-weight:700;color:#1B2A4A;text-align:center;letter-spacing:1px;margin:2px 0 14px;text-transform:uppercase}
h2.art{font-size:15.5px;font-weight:700;color:#1B2A4A;text-align:left;border-bottom:2px solid #C9A55C;padding-bottom:4px;margin:24px 0 12px;page-break-after:avoid}
h3.sub{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:700;color:#1B2A4A;margin:13px 0 5px;page-break-after:avoid}
p.body{margin-bottom:9px;text-align:justify}
p.ind{margin:0 0 8px 18px;text-align:justify}
p.deflist{margin-bottom:9px;text-align:justify}
p.deflist b{color:#221F1A}
ul.blt{margin:0 0 9px 26px}
ul.blt li{margin-bottom:5px;text-align:justify}

.cover-photo{margin:0 0 14px;page-break-inside:avoid}
.cover-photo img{width:100%;max-height:290px;object-fit:cover;border:1px solid #d8d4cb;border-radius:4px;display:block}
.cover-photo-cap{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:9.5px;color:#6B675F;text-align:center;padding-top:4px}
.photo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 4px}
.photo-grid img{width:100%;height:92px;object-fit:cover;border:1px solid #d8d4cb;border-radius:3px}

.loc-strip{display:flex;gap:14px;margin:14px 0;align-items:stretch}
.loc-map{flex:0 0 46%;border:1px solid #d8d4cb;border-radius:4px;overflow:hidden}
.loc-text{flex:1}
.loc-title{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;color:#1B2A4A;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:5px;border-bottom:1px solid #C9A55C;padding-bottom:3px;display:inline-block}
.loc-text p{font-size:11.5px;text-align:justify;color:#3a372f}
.intel{margin:0 0 14px}
.intel ul{margin:4px 0 6px 22px}
.intel li{font-size:11.5px;margin-bottom:3px}
.intel-src{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:9px;color:#9b968b;font-style:italic}

table.fee{width:100%;border-collapse:collapse;font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:10.5px;margin:10px 0 6px}
table.fee th{background:#1B2A4A;color:#fff;text-align:left;padding:7px 10px;font-size:9.5px;letter-spacing:1px;text-transform:uppercase}
table.fee td{padding:7px 10px;border-bottom:1px solid #e8e5de;vertical-align:top}
table.fee tr:nth-child(odd) td{background:#F7F4EC}
td.fee-amt{white-space:nowrap;font-weight:700;color:#1B2A4A}
.sched-note{font-size:11px;font-style:italic;color:#6B675F;margin:6px 0 0}

.sig-page{page-break-before:always;padding-top:8px;text-align:center}
.sig-head{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:700;color:#1B2A4A;letter-spacing:3px;margin-bottom:10px}
.sig-wit{margin:0 auto 26px;max-width:600px}
.sig-party{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:12px;font-weight:700;color:#1B2A4A;letter-spacing:3px;margin:34px 0 26px}
.sig-line{width:330px;margin:0 auto 26px;border-bottom:1.5px solid #221F1A;height:34px}
.sig-field{margin-bottom:5px}
.sig-field b{color:#221F1A}
.sig-rule{width:70%;margin:30px auto;border-bottom:1px solid #C9A55C}

.sched-title{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:700;color:#1B2A4A;text-align:center;letter-spacing:1px;margin:0 0 12px;text-transform:uppercase}
.sched{page-break-before:always;padding-top:8px}
.avoid-break{page-break-inside:avoid}
.art-block{page-break-inside:avoid}

@media print{
  @page{size:letter;margin:0.42in 0.55in}
  body{font-size:11.5px}
  .doc-table>thead{display:table-header-group}
  .doc-table>tfoot{display:table-footer-group}
  .pf-fixed{position:fixed;bottom:0;left:0;right:0}
  a{color:inherit;text-decoration:none}
}
@media screen{
  .tfoot-spacer{display:none}
}
</style>
</head>
<body>

<table class="doc-table">
<thead><tr><td>
  <div class="letterhead">
    <img src="${RENTAL_AGREEMENT_LOGO_B64}" alt="Camelot Realty Group" />
    <div>
      <div class="lh-name">CAMELOT REALTY GROUP</div>
      <div class="lh-services">REAL ESTATE&nbsp;&nbsp;·&nbsp;&nbsp;PROPERTY MGMT&nbsp;&nbsp;·&nbsp;&nbsp;BROKERAGE&nbsp;&nbsp;·&nbsp;&nbsp;INVESTMENT SERVICES</div>
      <div class="lh-tag">New Yorkers Working for New Yorkers&nbsp;&nbsp;<span class="est">EST. 2006</span></div>
    </div>
  </div>
  <div class="lh-rule"></div>
</td></tr></thead>
<tfoot><tr><td><div class="tfoot-spacer" style="height:52px">&nbsp;</div></td></tr></tfoot>
<tbody><tr><td>
<div class="sheet">

<h1 class="title">Camelot Rental Management Agreement</h1>

${coverImage}

<p class="body">THIS AGREEMENT (the "Agreement") is made as of this ${effDay} day of ${effMonth}, ${effYear} (the "Effective Date"), by and between ${clientEntity}, having its principal office at [CLIENT ADDRESS] ("Client"), and CAMELOT PROPERTY MANAGEMENT SERVICES CORP., a New York corporation, having its principal office at ${CAMELOT_OFFICE.address} (the "Agent," and together with the Client, the "Parties," and each a "Party").</p>
<p class="body">WHEREAS, the Client owns certain real property known as and located at ${addrDisplay} (the "Property"), consisting of one (1) residential rental building and ${unitsText} rental units; and</p>
<p class="body">WHEREAS, the Client desires to engage the Agent to perform the Services and the Additional Services (as defined herein) in connection with the rental units at the Property, and the Agent desires to be so engaged;</p>
<p class="body">NOW, THEREFORE, for good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:</p>

${mapBlock}
${extraImages}
${intelBlock}

<h2 class="art">ARTICLE I — Definitions</h2>
<p class="deflist"><b>"Additional Services"</b>&nbsp; shall mean Lease Services, Transfer Services, Financing Services, Hearing Services, Audit Services, Pre-Occupation Services, Emergency Services, and Extraordinary Project Services, each as further described in Article IX.</p>
<p class="deflist"><b>"Client Account"</b>&nbsp; shall mean a bank account, in a bank whose deposits are insured by the Federal Deposit Insurance Corporation, maintained in a manner that indicates its custodial nature, for the deposit of monies of the Client, with authority granted to the Agent to withdraw therefrom for payments due under this Agreement, including the Agent's Compensation, subject to the limitations set out herein.</p>
<p class="deflist"><b>"Emergency Services"</b>&nbsp; shall mean any Additional Services that, in the Agent's reasonable determination, must be performed immediately to maintain the continuing occupancy and safe operation of the Property or any rental unit.</p>
<p class="deflist"><b>"Employees"</b>&nbsp; shall mean all persons employed or otherwise engaged as necessary to properly maintain and operate the Property.</p>
<p class="deflist"><b>"Lease Rate"</b>&nbsp; shall mean the annual rate of rent charged to a Tenant.</p>
<p class="deflist"><b>"Reimbursable Expenses"</b>&nbsp; shall mean all reasonable out-of-pocket expenses incurred by the Agent in connection with the Services and the Additional Services, including but not limited to messenger, postage, photocopying, printing, scanning, and online-payment processing expenses.</p>
<p class="deflist"><b>"Rental Unit(s)" or "Unit(s)"</b>&nbsp; shall mean the individual dwelling unit(s) comprising the Property.</p>
<p class="deflist"><b>"Services"</b>&nbsp; shall mean the duties of the Agent set forth in Article VI, but not including the Additional Services.</p>
<p class="deflist"><b>"Tenant(s)"</b>&nbsp; shall mean the tenant(s) and sub-tenant(s) lawfully occupying a Unit under a lease or sublease.</p>
<p class="deflist"><b>"Union Contract"</b>&nbsp; shall mean any contract setting forth the Client's obligations to a union representing the Employees, if applicable.</p>

<h2 class="art">ARTICLE II — Term</h2>
<p class="body">${initialTermSentence}</p>

<h2 class="art">ARTICLE III — Exclusive Agency</h2>
<p class="body">During the Term, absent the Agent's prior written consent, no party other than the Agent shall perform the Services or Additional Services with respect to the Property. The Agent shall be entitled to place a small sign at the Property identifying the Agent as the managing agent.</p>

<h2 class="art">ARTICLE IV — Termination</h2>
<div class="art-block">
<h3 class="sub">Termination for Material Breach</h3>
<p class="ind">If either Party is in material breach of this Agreement, the breaching Party shall have five (5) business days from receipt of written notice of such breach (the "Cure Period") to cure it. If the breach is not cured within the Cure Period, the non-breaching Party may terminate this Agreement immediately upon written notice.</p>
</div>
<div class="art-block">
<h3 class="sub">Termination for Insolvency or Incapacity</h3>
<p class="ind">Either Party may terminate this Agreement immediately upon written notice if the other Party (i) is enjoined, prohibited, or otherwise unable to perform its obligations hereunder; (ii) voluntarily files or becomes subject to a petition under any chapter of Title 11 of the United States Code; (iii) makes a general assignment for the benefit of creditors; (iv) admits in writing its inability to pay debts as they mature; (v) has a receiver or trustee appointed for it or a material portion of its property; (vi) files a petition seeking reorganization, bankruptcy, insolvency, or similar relief; or (vii) takes any corporate action in furtherance of any of the foregoing.</p>
</div>
<div class="art-block">
<h3 class="sub">Termination for Convenience</h3>
<p class="ind">Following the Initial Term, this Agreement may otherwise be terminated by either Party upon ${termWords(input.terminationNoticeDays || 90)} days prior written notice to the other Party.</p>
</div>
<div class="art-block">
<h3 class="sub">Effect of Termination</h3>
<p class="ind">Upon termination, the Parties shall account to each other for all uncompleted business, and the Agent shall promptly deliver to the Client all funds and property belonging to the Client, including trust accounts, investments, cancelled checks, bank statements and records, rent rolls, bills, ledgers, correspondence, leases, and other records relating to the Property then in the Agent's possession (less an amount reasonably necessary to pay then-accrued and payable expenses). No new business may be undertaken after notice of termination except transitional matters and the transfer of Property files. The Agent may continue rendering Services, Additional Services, and Emergency Services in accordance with this Agreement through the effective date of termination.</p>
<p class="ind">Because termination gives rise to costs that are difficult to estimate precisely, upon termination the Agent shall be entitled to retain the Services Compensation already paid for the month in which termination occurs and, if unpaid, such Services Compensation shall remain due and payable. Termination shall have no effect on any Additional Services Compensation that is then due and payable.</p>
</div>

<h2 class="art">ARTICLE V — Compensation</h2>
<div class="art-block">
<h3 class="sub">Payment for Services</h3>
<p class="ind">As consideration for the Services, the Client shall pay the Agent, during the Term, a management fee of ${feeText} (the "Services Compensation").${annualIncreaseSentence} The Agent may invoice the Client within ten (10) business days of each month-end for Services Compensation due. Services Compensation shall be due and payable upon the Client's receipt of such invoice.</p>
</div>
<div class="art-block">
<h3 class="sub">Monthly Reporting, Tax and Accounting Services</h3>
<p class="ind">Monthly reporting and accounting services — including bank reconciliations, income statements, and balance sheets, and any special reports reasonably requested by lenders or investors — are included in the Services Compensation. This does not include preparation of tax returns, which shall be separately charged. The Agent shall ensure real estate taxes are timely paid to the extent Client Accounts are adequately funded, and shall promptly notify the Client if funding is insufficient; the Agent has no obligation to advance funds for tax payments.</p>
</div>
<div class="art-block">
<h3 class="sub">Payment for Additional Services</h3>
<p class="ind">As consideration for the Additional Services, the Client shall pay the Agent the fees set forth in Article IX and the attached Fee Schedule (the "Additional Services Compensation," and together with the Services Compensation, the "Compensation"). The Agent shall invoice the Client for Additional Services Compensation not less than once per calendar quarter.</p>
</div>
<div class="art-block">
<h3 class="sub">Payment Instructions</h3>
<p class="ind">All Compensation shall be paid within five (5) business days of the later of (i) the date it becomes due and payable, and (ii) the date the Agent provides the Client an invoice, where required (the "Payment Instructions").</p>
</div>
<div class="art-block">
<h3 class="sub">Start-Up Fee</h3>
<p class="ind">${startupFeeSentence}</p>
</div>
<div class="art-block">
<h3 class="sub">Compensation Deductions</h3>
<p class="ind">On the first day of each month, the Agent may withdraw from the Client Accounts an amount not exceeding the Compensation due for the prior month (a "Compensation Deduction"), subject to the Payment Instructions. If a Compensation Deduction is less than the Compensation then due (a "Compensation Deficiency"), the Client shall pay the Agent the amount of such deficiency in accordance with the Payment Instructions.</p>
</div>

<h2 class="art">ARTICLE VI — Agent's Duties (the Services)</h2>
<p class="body">As consideration for the Compensation, during the Term the Agent shall perform the following Services on the Client's behalf:</p>
<div class="art-block"><h3 class="sub">Regular Repairs and Maintenance</h3>
<p class="ind">The Agent shall maintain the Property in a condition deemed advisable by the Client, at the Client's expense from the Client Accounts, including the cleanliness and operability of the Property's interior, exterior, mechanical, electrical, and plumbing systems, and elevators. Repairs or alterations exceeding $5,000 shall require the Client's prior written consent, not to be unreasonably withheld.</p></div>
<div class="art-block"><h3 class="sub">Inspection Visits</h3>
<p class="ind">The Agent shall conduct inspections of the Property as it deems necessary, not to exceed two per month or twelve in any six-month period.</p></div>
<div class="art-block"><h3 class="sub">Violations</h3>
<p class="ind">The Agent shall recommend, and upon the Client's approval cause, remediation of any violations issued by a governmental authority with jurisdiction over the Property. Where prompt compliance is necessary to avoid exposure to penalty, fine, forfeiture, or injury to persons or property, remediation shall be treated as an Emergency Service. The Agent shall promptly notify the Client of any violation received. Remediation costs shall be paid from the Client Account and are not subject to the Payment Instructions.</p></div>
<div class="art-block"><h3 class="sub">Utilities and Service Contracts</h3>
<p class="ind">The Agent shall enter into, maintain, or renew contracts for electricity, gas, water treatment, elevator, telephone, window cleaning, rubbish removal, security, extermination, and architectural/engineering services necessary for Property operations. Contracts exceeding a two-year term or $10,000 in cumulative annual payments require the Client's prior written authorization.</p></div>
<div class="art-block"><h3 class="sub">Supplies</h3>
<p class="ind">The Agent shall purchase all supplies necessary to maintain and operate the Property, at market rate and acceptable quality, paid from the Client Accounts. Purchases shall be made in the Client's name. Supplies shall carry a combined 20% markup (10% overhead, 10% profit), billed monthly.</p></div>
<div class="art-block"><h3 class="sub">Corporate Expenses and Payments</h3>
<p class="ind">The Agent shall review and verify all bills for services, work, and supplies, and shall pay or cause to be paid from the Client Accounts all such bills, mortgage interest and amortization, water and sewer charges, assessments, and real estate taxes as they become due.</p></div>
<div class="art-block"><h3 class="sub">Rent Collection and Legal Proceedings</h3>
<p class="ind">The Agent shall bill Tenants for rent and other charges and use best efforts to collect such amounts, including serving notices to quit when instructed by the Client. When directed by the Client, the Agent may retain counsel and institute proceedings, in the Client's name, to collect rent or recover possession, provided no suit or summary proceeding shall be instituted absent the Client's prior written authorization. The Agent shall cooperate with the Client's attorneys on all related filings and proceedings.</p></div>
<div class="art-block"><h3 class="sub">Owner Communications</h3>
<p class="ind">The Agent shall provide the Client with regular updates on Property operations and, upon reasonable request, make Agent personnel available to meet with the Client to discuss Property performance.</p></div>
<div class="art-block"><h3 class="sub">Storage</h3>
<p class="ind">The Agent shall provide secure off-premises storage for the Client's Property files at the Client's expense, paid from the Client Accounts.</p></div>
<div class="art-block"><h3 class="sub">Tenant Complaints</h3>
<p class="ind">The Agent shall address reasonable Tenant complaints. If the Agent deems a complaint unreasonable, it shall advise the Client in writing of the complaint and the basis for that determination.</p></div>
<div class="art-block"><h3 class="sub">Monthly Reports</h3>
<p class="ind">The Agent shall render monthly statements to the Client of collections and disbursements, reconciled Client Account balances, and a schedule of accounts payable, including copies of paid bills and vouchers, delivered no later than the 20th of each month.</p></div>
<div class="art-block"><h3 class="sub">Books and Records</h3>
<p class="ind">The Agent shall maintain orderly corporate books, checkbooks, rent records, insurance policies, leases, correspondence, receipted bills, cancelled checks, and bank statements relating to the Property. The Agent shall further: (i) furnish records reasonably required by the Client's accountants for tax filings; (ii) prepare and file required unemployment, withholding, and social security filings relating to Employees; and (iii) cooperate with the Client's accountants on annual audits and with the Client's attorneys on any assessment-correction filings.</p></div>
<div class="art-block"><h3 class="sub">Emergency Contact</h3>
<p class="ind">The Agent shall maintain a 24-hour telephone line for reporting of, and prompt response to, emergency conditions at the Property.</p></div>

<h2 class="art">ARTICLE VII — Insurance</h2>
<div class="art-block"><h3 class="sub">Agent's Insurance Coverage</h3>
<p class="ind">The Agent shall maintain, at its own expense, commercial general liability insurance with limits acceptable to the Client (but not less than $1,000,000 per occurrence), workers' compensation and employer's liability insurance, professional liability (errors and omissions) insurance, employment practices liability insurance, and cyber liability insurance, as further summarized in the attached Insurance Coverage Summary (the "Agent Insurance Policies"). The Client shall pay the Agent an annual fee of $450 toward the premium for the Agent Insurance Policies. Except for workers' compensation, the Agent shall name the Client as an insured party on each such policy and shall provide the Client with a certificate evidencing coverage prior to the policy's commencement. This Article shall survive termination of this Agreement.</p></div>
<div class="art-block"><h3 class="sub">Client Insurance Requirements</h3>
<p class="ind">The Agent shall assist the Client in securing, at the Client's expense from the Client Accounts, appropriate coverage for the Property, Employees, and Tenants as requested by the Client, including fire, multi-peril, renters', plate glass, boiler, water damage, general liability, workers' compensation, employer's liability, and disability coverage, procured from a broker of good standing (the "Client Insurance Policies"). The Client shall separately maintain: (i) a fidelity bond or employee dishonesty coverage of not less than $1,000,000; (ii) Directors and Officers Liability coverage of not less than $1,000,000, with a Managing Agent rider; (iii) Umbrella Liability coverage of not less than $10,000,000, providing excess coverage over the Directors and Officers limits; and (iv) statutory New York workers' compensation and disability benefits coverage.</p></div>
<div class="art-block"><h3 class="sub">Move-In and Move-Out</h3>
<p class="ind">The Agent shall, with the Client's cooperation, provide written notice to Tenants moving into or out of a Unit of the procedures and fees applicable to such transition.</p></div>

<h2 class="art">ARTICLE VIII — Indemnification &amp; Limitation of Liability</h2>
<div class="art-block"><h3 class="sub">Client Indemnification</h3>
<p class="ind">The Client shall indemnify and hold the Agent harmless from and against (a) any liability, damages, costs, and expenses (including reasonable attorneys' fees) arising from injury to any person or property in connection with the Property, unless caused by the Agent's own negligence, willful misconduct, or material breach of this Agreement, and (b) any liability, damages, penalties, costs, and expenses arising from acts the Agent performed pursuant to this Agreement or the Client's instructions — provided the Agent promptly notifies the Client of any such claim, cooperates fully with the Client and its counsel, and provides related documents, evidence, and witnesses within its control.</p></div>
<div class="art-block"><h3 class="sub">Exclusions</h3>
<p class="ind">The Agent shall not be liable for theft, fraud, cyber incidents, employment disputes, property damage, or third-party negligence, except to the extent caused by the Agent's own negligence or willful misconduct, or for any claim exceeding the limits of the insurance maintained under Article VII.</p></div>
<div class="art-block"><h3 class="sub">Survival</h3>
<p class="ind">The indemnification obligations of this Article shall survive termination of this Agreement for a period of five (5) years.</p></div>
<div class="art-block"><h3 class="sub">Fidelity Bond</h3>
<p class="ind">If requested by the Client, at the Client's expense, the Agent shall procure a fidelity bond, issued by a bonding company authorized to do business in New York, holding the Client harmless from loss caused by larceny, embezzlement, forgery, misappropriation, or other dishonest or fraudulent acts by the Agent or its officers or employees. The Agent represents that it maintains fidelity coverage of $1,000,000 and shall name the Client as an additional insured under such coverage.</p></div>

<h2 class="art">ARTICLE IX — Additional Services</h2>
<div class="art-block"><h3 class="sub">Additional Services Process</h3>
<p class="ind">If the Agent determines Additional Services are necessary and they were not otherwise requested by the Client, the Agent shall provide written notice describing the proposed Additional Services in reasonable detail (an "Additional Services Notice"). If the Client does not object within five (5) business days of receipt (the "Rejection Period"), or otherwise approves or requests such Additional Services, the Agent shall perform them at the Compensation rates set forth herein. If the Client objects within the Rejection Period, the Parties shall negotiate in good faith; if no agreement is reached, the Agent may, at its discretion, terminate this Agreement upon written notice.</p></div>
<div class="art-block"><h3 class="sub">Lease Services</h3>
<p class="ind">During the Term, the Agent shall have the exclusive right to render leasing services for all Units, per a separate brokerage agreement. Lease Rates shall not decrease by more than 3% year-over-year absent the Client's prior written approval. On any lease renewal, the Client shall pay the Agent 15% of the increase between the renewed and prior annual rent, due upon the first month of the renewed occupancy.</p></div>
<div class="art-block"><h3 class="sub">Transfer Services</h3>
<p class="ind">For any transfer of leasehold managed by the Agent, including in connection with an eviction, the Client shall pay the Agent a transfer fee per the attached Fee Schedule, due on the first day of the month following the month such service was rendered.</p></div>
<div class="art-block"><h3 class="sub">Financing Services</h3>
<p class="ind">For any mortgage, refinancing, or credit line for which the Agent serves as broker, the Client shall pay the Agent (i) 1% of the first $1,000,000 of financing, plus (ii) 0.5% of any amount above $1,000,000. Where the Agent provides supporting documentation but does not serve as broker, the Client shall pay the Agent 0.33% of the total financing amount.</p></div>
<div class="art-block"><h3 class="sub">Hearing Services</h3>
<p class="ind">For any civil, criminal, arbitration, mediation, environmental, or other hearing at which Agent personnel appear on the Client's behalf, the Client shall pay the Agent $150 per hour, including travel time.</p></div>
<div class="art-block"><h3 class="sub">Audit Services</h3>
<p class="ind">For any Client-organized audit managed by the Agent, the Client shall pay the Agent $150 per hour.</p></div>
<div class="art-block"><h3 class="sub">Pre-Occupation Services</h3>
<p class="ind">For services rendered prior to a Unit's occupancy, the Client shall pay the Agent $150 per hour.</p></div>
<div class="art-block"><h3 class="sub">Emergency Services</h3>
<p class="ind">The Agent shall maintain personnel at the Property during the rendering of any Emergency Service and shall be paid $150 per hour, payable immediately, from the Client Accounts to the extent not covered by insurance. The Agent shall maintain a roster of vetted emergency contractors (plumbers, electricians, HVAC technicians) and solicit standard rates from each. The Agent may cease Emergency Services upon the Client's written notice, and may, at its discretion, terminate this Agreement upon such notice.</p></div>
<div class="art-block"><h3 class="sub">Extraordinary Project Services</h3>
<p class="ind">For any construction project requiring immediate or short-notice commencement, the Agent shall manage the project for a fee of 20% of project cost, due on the first day of the month following the month such services were rendered, paid from the Client Accounts to the extent not covered by insurance. Extraordinary Project Services shall be treated as Emergency Services for purposes of this Agreement.</p></div>

<h2 class="art">ARTICLE X — Additional Fees &amp; Supplemental Services</h2>
<div class="art-block"><h3 class="sub">Supplemental Fees</h3>
<p class="ind">Separately from the Compensation, the Agent may bill and collect from a lease applicant an Application Review fee of $200 (or the maximum amount permissible under applicable law), and from a Tenant requesting alterations, an Alteration Review fee of $500 (together, the "Supplemental Services"). The Agent has the sole right to perform and approve Supplemental Services; if the Client engages a third party without the Agent's written consent, the Client shall pay the Agent the fees it would otherwise have earned.</p></div>
<div class="art-block"><h3 class="sub">Reimbursable Expenses</h3>
<p class="ind">The Agent shall be reimbursed for all Reimbursable Expenses, due on the first day of the month following the month incurred, in accordance with the Payment Instructions.</p></div>
<div class="art-block"><h3 class="sub">Additional Client Fees</h3>
<p class="ind">At the Client's request, and subject to the Payment Instructions, the Agent will also, for a fee: (i) process and file Forms 1098/1099 ($25 per form); (ii) prepare and file the Real Property Income and Expense (RPIE) form or RPIE-Exception form ($400 per filing, with tax certiorari proceedings retained by and coordinated through the Client's own counsel); (iii) process applications for applicable tax abatement or rebate programs and administer distribution of any rebate; (iv) establish and maintain Client Accounts; and (v) administer Employee payroll, with full reimbursement of payroll service fees where paid by the Agent on the Client's behalf.</p></div>
<div class="art-block"><h3 class="sub">Client Responsibility for Third-Party Fees</h3>
<p class="ind">Any bank lockbox, online-payment, or similar fees incurred in connection with the Client's title to the Property shall be paid directly from the Client's operating account, and the Agent shall have no obligation to perform services beyond the Services absent a separate written agreement.</p></div>
<div class="art-block"><h3 class="sub">Ancillary Fee Sheet</h3>
<p class="ind">Except as set forth above, the Parties shall be governed by the Ancillary Fee Sheet attached to this Agreement.</p></div>

<h2 class="art">ARTICLE XI — Personnel</h2>
<div class="art-block"><h3 class="sub">Hiring and Supervision</h3>
<p class="ind">The Agent shall hire, pay, and supervise all Employees necessary to properly maintain and operate the Property, and may discharge Employees with the Client's prior approval. The Agent shall perform these duties consistent with the Client's obligations under any applicable Union Contract. Upon termination of this Agreement, the Agent may reassign Employees to other properties it manages.</p></div>
<div class="art-block"><h3 class="sub">Non-Solicitation</h3>
<p class="ind">For nine (9) months following termination of this Agreement, the Client shall not solicit, induce, or hire any person who is or was an Employee of the Agent, unless (i) such person has not been reassigned by the Agent within four (4) weeks of termination, or (ii) the Client pays the Agent 25% of that person's annual salary as a lump sum. Within ten (10) days of termination, the Agent shall furnish the Client a list of Employees covered by this provision.</p></div>

<h2 class="art">ARTICLE XII — Financial Administration</h2>
<div class="art-block"><h3 class="sub">Late Payment Interest</h3>
<p class="ind">Invoices for emergency work or project management services remaining unpaid more than thirty (30) days from submission shall accrue interest at 1.5% per month, compounded monthly, until paid in full.</p></div>
<div class="art-block"><h3 class="sub">Commission Handling</h3>
<p class="ind">All commissions, including brokerage commissions, shall be made payable to the Agent first. Net proceeds, after deduction of fees or expenses owed the Agent, shall then be paid to the Client in accordance with the Payment Instructions. The Agent's fees for related services shall be separately invoiced under this Agreement.</p></div>
<div class="art-block"><h3 class="sub">Document Management and Retention</h3>
<p class="ind">The Agent shall use commercially reasonable efforts to scan and digitally store Client-provided documents and is not obligated to retain physical copies after scanning, absent written instruction otherwise. The Client acknowledges that documents are accepted "as-is," without a duty to verify historical completeness. The Agent shall retain electronic copies for seven (7) years from receipt, after which it may securely dispose of records absent written instruction otherwise. Unless the Client directs otherwise in writing within thirty (30) days of the Agent's receipt of physical documents, the Agent may securely dispose of them following digital archiving.</p></div>
<div class="art-block"><h3 class="sub">Limitation of Liability for Documents</h3>
<p class="ind">The Agent's liability for loss, destruction, misplacement, or corruption of documents shall not exceed $10,000 in the aggregate per occurrence, except in cases of willful misconduct or fraud. The Client shall indemnify and hold the Agent harmless from claims arising from the loss or unavailability of any document, unless caused by the Agent's willful misconduct or gross negligence.</p></div>

<h2 class="art">ARTICLE XIII — Authority</h2>
<p class="body">The Client authorizes the Agent, on its behalf, to perform any act reasonably necessary to render the Services and Additional Services, subject to the limitations herein. Obligations and expenses so incurred shall be at the Client's expense, except for the Agent's own overhead expenses. The Agent shall not be obligated to advance funds on the Client's behalf except from funds held or provided for that purpose; if the Agent voluntarily advances such funds, the Client shall reimburse the Agent on demand.</p>

<h2 class="art">ARTICLE XIV — Bank Accounts</h2>
<ul class="blt">
<li>The Agent shall establish and maintain Client Accounts as necessary to perform its obligations hereunder.</li>
<li>Each Client Account shall designate that it is held on the Client's behalf.</li>
<li>Any transfer of $10,000 or more from a Client Account requires the Client's prior written approval and two authorized signatories.</li>
<li>Upon request, the Agent shall provide the Client an account agreement covering the Client Accounts, in form reasonably satisfactory to the Client.</li>
<li>Upon request, the Agent shall inform the Client of the balances held in the Client Accounts.</li>
<li>The Agent shall maintain a separate security deposit account, used solely to hold and return Tenant security deposits.</li>
</ul>

<h2 class="art">ARTICLE XV — Licenses</h2>
<p class="body">The Agent represents that it is duly licensed by the New York Department of State as a real estate broker, sufficient to lawfully perform its duties under this Agreement.</p>

<h2 class="art">ARTICLE XVI — Notices &amp; Miscellaneous</h2>
<p class="body">All notices under this Agreement shall be in writing and effective only if (i) served personally, (ii) sent by nationally recognized overnight courier, or (iii) sent by certified or registered mail, addressed to the recipient's address first written above. Either Party may designate a substitute address by notice given in accordance with this Article; a change of address is effective only upon actual receipt. The Agent affirms it has no relationship or affiliation with the Client.</p>

<h2 class="art">ARTICLE XVII — Governing Law</h2>
<p class="body">This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to conflict-of-law principles.</p>

<h2 class="art">ARTICLE XVIII — Entire Agreement</h2>
<p class="body">This Agreement constitutes the entire agreement between the Parties and may not be amended orally. It shall bind and inure to the benefit of the Parties and their successors, and may not be assigned by either Party without the other's prior written consent.</p>

<h2 class="art">ARTICLE XIX — Independent Contractor</h2>
<p class="body">The Agent's relationship to the Client under this Agreement is that of an independent contractor. Nothing herein shall be construed to create a partnership, joint venture, or employer-employee relationship. Except as set forth herein, the Agent is not authorized to act on the Client's behalf or represent otherwise to any third party. Neither the Agent nor its employees are eligible for benefits the Client makes available to its own employees; the Client will not withhold or contribute to social security, unemployment, or disability insurance on the Agent's behalf; and the Agent is solely responsible for its own tax filings and payments arising from fees paid under this Agreement.</p>
${specialTermsArticle}

<!-- SIGNATURE PAGE — one page, both parties together -->
<div class="sig-page">
  <div class="sig-head">SIGNATURES</div>
  <p class="body sig-wit" style="text-align:center">IN WITNESS WHEREOF, the Parties hereto have executed this Agreement as of the day and year first above written.</p>

  <div class="sig-party">CLIENT</div>
  <div class="sig-line"></div>
  <div class="sig-field"><b>By:</b>&nbsp; ${clientEntity}</div>
  <div class="sig-field"><b>Name:</b>&nbsp; ${clientDisplay !== clientEntity ? clientDisplay : '____________________________'}</div>
  <div class="sig-field"><b>Title:</b>&nbsp; ____________________________</div>
  <div class="sig-field"><b>Date:</b>&nbsp; ____________________________</div>

  <div class="sig-rule"></div>

  <div class="sig-party">AGENT</div>
  <div class="sig-line"></div>
  <div class="sig-field"><b>By:</b>&nbsp; Camelot Property Management Services Corp.</div>
  <div class="sig-field"><b>Name:</b>&nbsp; David A. Goldoff</div>
  <div class="sig-field"><b>Title:</b>&nbsp; President</div>
  <div class="sig-field"><b>Date:</b>&nbsp; ____________________________</div>
</div>

<!-- SCHEDULE A -->
<div class="sched">
<div class="sched-title">Schedule A — Fee Schedule</div>
<table class="fee">
<tr><th>Service</th><th style="text-align:right">Fee</th></tr>
${[
  feeRow('Property/Project Manager (Emergency or Supervision Services)', '$150.00 per hour'),
  feeRow('Travel', 'Billed by receipt'),
  feeRow('Sales &amp; Leasing', 'Per separate brokerage agreement'),
  feeRow('Agent Insurance Contribution', '$450.00 annually'),
  feeRow('Cleaning, Ordinary Repairs &amp; Maintenance', '$50.00 per hour'),
  feeRow('Extraordinary Repairs (over $5,000 per repair)', 'Project manager rate + 20% markup'),
  feeRow('Locksmith', '$150.00 per hour + materials + 20% markup'),
  feeRow('Supplies &amp; Material Markups', '10% overhead + 10% profit, billed monthly'),
  feeRow('Pre-Occupation Services', '$150.00 per hour'),
  feeRow('Court Appearance or Deposition', '$150.00 per hour'),
  feeRow('Application Review', '$200.00 per application'),
  feeRow('RPIE Filing (Real Property Income &amp; Expense)', '$400 per filing'),
  feeRow('Rent Registration Filing (per building)', '$500.00 per building, per year'),
  feeRow('Boiler Inspection Filing &amp; Administration (DOB/FDNY)', 'Required filing fees at cost'),
  feeRow('Elevator Inspection Filing &amp; Administration (DOB)', 'Required filing fees at cost'),
].join('')}
</table>
<p class="sched-note">These fees are one-time or occurrence-based, applied as needed by the Client.</p>
</div>

<!-- SCHEDULE B -->
<div class="sched">
<div class="sched-title">Schedule B — Ancillary Fee Sheet</div>
<table class="fee">
<tr><th>Service</th><th style="text-align:right">Fee</th></tr>
${[
  feeRow('Alteration Fee', '$500.00'),
  feeRow('Tax Abatement / Rebate Program Filing', '$200 per building filing'),
  feeRow('Audit Review and Assistance', '$150.00 per hour'),
  feeRow('Tax Forms 1098 / 1099', '$25 per form filed'),
  feeRow('Monthly Administrative Fee (copies, messenger, mailings, data filings, cloud &amp; physical storage)', '$200.00 per month'),
  feeRow('Alteration Agreement Review and Submittal', '$500, or 10% of alterations over $5,000'),
  feeRow('Sales or Rental Package Review', '$500 per package'),
  feeRow('HPD Filing Fee', '$50.00 (once per year)'),
  feeRow('Emergency Site Plan Creation &amp; Submittal', '$175.00'),
  feeRow('Bank &amp; Insurance Questionnaire Fee', '$200.00'),
].join('')}
</table>
</div>

<!-- SCHEDULE C -->
<div class="sched">
<div class="sched-title">Schedule C — Camelot's Insurance Coverage</div>
<p class="body">For the Client's information, Camelot Property Management Services Corp. DBA Camelot Realty Group carries the following lines of insurance as a company. This summary is provided for general informational purposes only — it is not a Certificate of Insurance and does not modify, replace, or expand any actual policy. All coverage remains subject to the full terms, conditions, exclusions, and limits of the underlying policies. A formal Certificate of Insurance is available upon request.</p>
<table class="fee">
<tr><th>Coverage</th><th style="text-align:right">Limit</th></tr>
${[
  feeRow('Professional Liability (Errors &amp; Omissions)', '$1,000,000 each claim / $1,000,000 aggregate'),
  feeRow('Employment Practices Liability (EPLI)', '$1,000,000 maximum limit of liability'),
  feeRow('General Liability (Businessowners Policy)', '$1,000,000 each occurrence / $2,000,000 aggregate'),
  feeRow('Fidelity / Employee Dishonesty Bond', '$1,000,000'),
  feeRow('Cyber Liability', '$1,000,000 aggregate'),
].join('')}
</table>
<p class="sched-note">Current policy numbers, carriers, and term dates are available on request and should be confirmed with the broker before this exhibit is circulated externally.</p>
</div>

</div>
</td></tr></tbody>
</table>

<div class="pagefoot pf-fixed">
  ${CAMELOT_OFFICE.address}&nbsp;&nbsp;·&nbsp;&nbsp;(212) 206-9939&nbsp;&nbsp;·&nbsp;&nbsp;info@camelot.nyc&nbsp;&nbsp;·&nbsp;&nbsp;www.camelot.nyc
  <div class="conf">CONFIDENTIAL — PREPARED EXCLUSIVELY FOR <b>${clientEntity.toUpperCase()}</b>&nbsp;&nbsp;·&nbsp;&nbsp;${version}&nbsp;&nbsp;·&nbsp;&nbsp;${dateStr}</div>
</div>

</body>
</html>`;
}
