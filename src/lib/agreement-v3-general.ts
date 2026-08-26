/**
 * Camelot Management Agreement — HTML generator for Condominium, Cooperative,
 * Office, Retail, and New Construction asset classes.
 *
 * This mirrors the exact house design already shipped for the Rental
 * Management Agreement (see rental-agreement-v3.ts): same letterhead header
 * and contact footer on every page, centered dark-gold article titles,
 * Georgia serif headings, Articles I–XIX (plus optional XX) verbatim, a
 * single signature page with both parties, and Schedules A/B/C with real
 * Camelot rates — with content substituted per asset class (condo Board of
 * Managers / Common Charges language, co-op Board of Directors / Maintenance
 * / Proprietary Lease language, office & retail commercial lease / CAM
 * language) sourced from the same legal text used elsewhere in Excalibur.
 */

import { GOOGLE_MAPS_KEY } from '@/lib/maps-key';
import { RENTAL_AGREEMENT_LOGO_B64 } from '@/lib/agreement-brand';
import type { AgreementInput, AssetClass } from './excalibur';

const CAMELOT_OFFICE = {
  address: '57 West 57th Street, Suite 410, New York, NY 10019',
  short: '57 West 57th Street, Suite 410',
  phone: '(212) 206-9939',
  email: 'info@camelot.nyc',
  web: 'www.camelot.nyc',
  lat: 40.76464,
  lng: -73.98077,
};

export const HEADING_FONT = "Georgia,'Times New Roman',serif";
export const DARK_GOLD = '#8B6F47';
export const GOLD_RULE = '#B8960F';
export const BODY_FONT = "Arial,Helvetica,sans-serif";
export const BODY_BLACK = '#000000';
export const COVER_TITLE_FONT = "'HGMaruGothicMPRO','HGMaruGothicM PRO',Georgia,serif";
export const COVER_TITLE_COLOR = '#2F5597';

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

function boroughFromZip(zip: string): string {
  const p3 = (zip || '').trim().slice(0, 3);
  if (['100', '101', '102'].includes(p3)) return 'Manhattan';
  if (p3 === '103') return 'Staten Island';
  if (p3 === '104') return 'Bronx';
  if (p3 === '112') return 'Brooklyn';
  if (['110', '111', '113', '114', '116'].includes(p3)) return 'Queens';
  return '';
}

// ---- Per asset-class content ----

const NORMALIZED: Record<AssetClass, 'condo' | 'coop' | 'office'> = {
  rental: 'condo', // unused — rental routes to rental-agreement-v3.ts
  'single-tenant': 'condo', // unused — single-tenant routes to rental-agreement-v3.ts
  condo: 'condo',
  'new-construction': 'condo',
  coop: 'coop',
  office: 'office',
  retail: 'office',
};

const DOC_TYPE_LABEL: Record<AssetClass, string> = {
  rental: 'Residential Rental Property Management Agreement',
  'single-tenant': 'Individual Unit Management Agreement',
  condo: 'Condominium Management Agreement',
  'new-construction': 'New Construction Condominium Management Agreement',
  coop: 'Cooperative Management Agreement',
  office: 'Commercial Office Management Agreement',
  retail: 'Retail Property Management Agreement',
};

const RECITAL_UNIT_DESCRIPTION: Record<'condo' | 'coop' | 'office', string> = {
  condo:
    'condominium units governed by a Declaration and By-Laws filed with the New York State Attorney General\u2019s office pursuant to Article 9-B of the New York Real Property Law (the "Condominium Act")',
  coop:
    'cooperative apartment units, ownership of which is evidenced by shares of stock in the cooperative corporation and a proprietary lease',
  office: 'office/commercial units subject to commercial lease agreements',
};

const GOVERNING_BODY: Record<'condo' | 'coop' | 'office', string> = {
  condo: 'Board of Managers',
  coop: 'Board of Directors',
  office: 'ownership',
};

function article(num: string, title: string, body: string) {
  return `
<div class="article-block">
<h2 class="art">ARTICLE ${num}</h2>
<h3 class="art-sub">${title}</h3>
${body}
</div>`;
}

function articleIDefinitions(kind: 'condo' | 'coop' | 'office'): string {
  const base = `
<p class="deflist"><b>"Additional Services"</b> shall mean Lease Services, Transfer Services, Financing Services, Hearing Services, Audit Services, Pre-Occupation Services, Emergency Services, and Extraordinary Project Services, each as further described in Article IX.</p>
<p class="deflist"><b>"Client Account"</b> shall mean a bank account, in a bank whose deposits are insured by the Federal Deposit Insurance Corporation, maintained in a manner that indicates its custodial nature, for the deposit of monies of the Client, with authority granted to the Agent to withdraw therefrom for payments due under this Agreement, including the Agent's Compensation, subject to the limitations set out herein.</p>
<p class="deflist"><b>"Emergency Services"</b> shall mean any Additional Services that, in the Agent's reasonable determination, must be performed immediately to maintain the continuing occupancy and safe operation of the Property.</p>
<p class="deflist"><b>"Employees"</b> shall mean all persons employed or otherwise engaged as necessary to properly maintain and operate the Property.</p>
<p class="deflist"><b>"Reimbursable Expenses"</b> shall mean all reasonable out-of-pocket expenses incurred by the Agent in connection with the Services and the Additional Services, including but not limited to messenger, postage, photocopying, printing, scanning, and online-payment processing expenses.</p>
<p class="deflist"><b>"Services"</b> shall mean the duties of the Agent set forth in Article VI, but not including the Additional Services.</p>
<p class="deflist"><b>"Union Contract"</b> shall mean any contract setting forth the Client's obligations to a union representing the Employees, if applicable.</p>`;

  const extra: Record<'condo' | 'coop' | 'office', string> = {
    condo: `
<p class="deflist"><b>"Board of Managers"</b> shall mean the governing body of the Condominium as established by the Declaration and By-Laws.</p>
<p class="deflist"><b>"Common Charges"</b> shall mean the monthly charges assessed to each unit owner for the maintenance, repair, and operation of the common elements of the Condominium.</p>
<p class="deflist"><b>"Common Elements"</b> shall mean the portions of the Condominium property designated for common use by all unit owners as defined in the Declaration.</p>
<p class="deflist"><b>"Declaration"</b> shall mean the Declaration of Condominium establishing the Property as a condominium under the New York Condominium Act (RPL Article 9-B).</p>
<p class="deflist"><b>"Offering Plan"</b> shall mean the plan filed with the New York State Attorney General's office pursuant to the Martin Act and General Business Law Article 23-A.</p>
<p class="deflist"><b>"Alteration Agreement"</b> shall mean the agreement required for any unit owner renovation, establishing insurance, indemnification, and construction management requirements.</p>`,
    coop: `
<p class="deflist"><b>"Board of Directors"</b> shall mean the governing body of the Cooperative Corporation.</p>
<p class="deflist"><b>"Maintenance"</b> shall mean the monthly charges assessed to each shareholder based on share allocation for the operation, maintenance, and underlying mortgage obligations of the Cooperative.</p>
<p class="deflist"><b>"Proprietary Lease"</b> shall mean the lease agreement between the Cooperative Corporation and each shareholder granting occupancy rights to a specific apartment.</p>
<p class="deflist"><b>"Share Certificate"</b> shall mean the stock certificate evidencing a shareholder's ownership interest in the Cooperative Corporation.</p>
<p class="deflist"><b>"Flip Tax"</b> shall mean the transfer fee payable to the Cooperative Corporation upon the sale or transfer of shares, as set forth in the Proprietary Lease or House Rules.</p>
<p class="deflist"><b>"Sublet Policy"</b> shall mean the Cooperative's rules governing subletting of apartments by shareholders, including any sublet fees, duration limits, and board approval requirements.</p>
<p class="deflist"><b>"Recognition Agreement"</b> shall mean the agreement between the Cooperative Corporation and a shareholder's lender acknowledging the lender's security interest in the shares and proprietary lease.</p>`,
    office: `
<p class="deflist"><b>"CAM Charges"</b> shall mean Common Area Maintenance charges allocated to tenants on a pro rata basis based on their proportionate share of rentable square footage.</p>
<p class="deflist"><b>"Tenant Improvement Allowance" (TI)</b> shall mean any landlord contribution toward the build-out or improvement of a commercial tenant's space.</p>
<p class="deflist"><b>"NNN" or "Triple Net"</b> shall mean a lease structure in which the tenant pays base rent plus its proportionate share of real estate taxes, insurance, and CAM charges.</p>
<p class="deflist"><b>"Lease Escalation"</b> shall mean contractual rent increases, whether fixed, indexed to CPI, or based on operating expense pass-throughs.</p>
<p class="deflist"><b>"Certificate of Occupancy" (CO)</b> shall mean the document issued by the NYC Department of Buildings certifying that the premises comply with applicable building codes and are authorized for the intended use.</p>`,
  };

  return article('I', 'Definitions', base + extra[kind]);
}

function articleVIDutiesExtra(kind: 'condo' | 'coop' | 'office'): string {
  const extra: Record<'condo' | 'coop' | 'office', string> = {
    condo: `
<p class="ind"><b>Board of Managers Support.</b> Agent shall attend and prepare agendas for all regular and special meetings of the Board of Managers, prepare and distribute meeting minutes, maintain the Condominium's corporate records, coordinate annual unit owner meetings, and assist in the preparation and distribution of the annual budget and common charge statements in compliance with RPL Article 9-B.</p>
<p class="ind"><b>Common Charge Administration.</b> Agent shall calculate, bill, and collect monthly common charges from all unit owners. Agent shall maintain individual unit owner ledgers, pursue arrears through written notices and, with Board authorization, initiate lien filings per RPL &sect;339-z. Agent shall prepare and distribute annual financial statements and operating budgets in compliance with the By-Laws and Condominium Act.</p>
<p class="ind"><b>Alteration Agreement Administration.</b> Agent shall process all unit owner alteration applications, verify insurance requirements (including contractor general liability, workers' compensation, and excess coverage naming the Condominium as additional insured), coordinate Board review and approval, monitor construction progress, and ensure compliance with DOB permit requirements and the building's alteration policy.</p>
<p class="ind"><b>Offering Plan &amp; Regulatory Compliance.</b> Agent shall maintain awareness of the building's Offering Plan and any amendments, ensure compliance with the Martin Act and General Business Law Article 23-A, coordinate with the Attorney General's office on required filings, and advise the Board on sponsor obligations, reserve fund requirements per RPL &sect;339-mm, and common element maintenance responsibilities.</p>
<p class="ind"><b>Resale &amp; Transfer Processing.</b> Agent shall process unit resale applications, coordinate board waiver of right of first refusal (if applicable), prepare closing documentation, calculate and collect any transfer fees, and ensure compliance with the By-Laws and Offering Plan provisions governing unit transfers. Agent shall collect an application processing fee per Schedule A.</p>`,
    coop: `
<p class="ind"><b>Board of Directors Support.</b> Agent shall attend and prepare agendas for all regular and special meetings of the Board of Directors, prepare and distribute meeting minutes, maintain the Cooperative Corporation's corporate records, coordinate annual shareholder meetings, assist in proxy solicitation, and prepare and distribute the annual budget and maintenance schedule.</p>
<p class="ind"><b>Maintenance Administration.</b> Agent shall calculate, bill, and collect monthly maintenance charges from all shareholders based on their share allocation. Agent shall maintain individual shareholder ledgers, pursue arrears through written notices and, with Board authorization, initiate holdover proceedings. Agent shall prepare and distribute annual financial statements, operating budgets, and Form 1098 statements to shareholders.</p>
<p class="ind"><b>Stock Transfer &amp; Proprietary Lease Administration.</b> Agent shall process all applications for the purchase, sale, or transfer of shares and proprietary leases, including credit and background checks, financial statement review, board interview coordination, preparation of stock transfer documents, collection of flip tax, issuance of new share certificates, and execution of amended proprietary leases. Agent shall maintain the stock ledger and ensure compliance with the Certificate of Incorporation, By-Laws, and applicable securities exemptions.</p>
<p class="ind"><b>Sublet &amp; Alteration Administration.</b> Agent shall process all sublet applications in accordance with the Cooperative's Sublet Policy, including applicant screening, collection of sublet fees, monitoring sublet duration limits, and ensuring compliance with the Proprietary Lease. Agent shall also process alteration applications, verify insurance requirements, and monitor construction per the building's alteration policy.</p>
<p class="ind"><b>Recognition Agreement Processing.</b> Agent shall coordinate the preparation and execution of recognition agreements for shareholder financing, liaise with lenders and their counsel, and collect the recognition agreement processing fee per Schedule A.</p>
<p class="ind"><b>Underlying Mortgage &amp; Tax Coordination.</b> Agent shall monitor the Cooperative Corporation's underlying mortgage obligations, coordinate refinancing as directed by the Board, prepare RPIE filings, monitor real estate tax assessments, and advise the Board on J-51 or other applicable tax abatement programs.</p>`,
    office: `
<p class="ind"><b>Commercial Lease Administration.</b> Agent shall administer all commercial lease agreements, including rent billing and collection, CAM charge calculation and reconciliation, operating expense pass-through computation, lease escalation tracking, tenant improvement coordination, and compliance with lease covenants. Agent shall maintain a lease abstract for each tenant and provide the Client with quarterly lease expiration reports.</p>
<p class="ind"><b>CAM Charge Administration.</b> Agent shall calculate each tenant's proportionate share of Common Area Maintenance charges, prepare and distribute annual CAM estimates and year-end reconciliations, maintain supporting documentation, and handle tenant disputes regarding CAM allocations in compliance with applicable lease provisions.</p>
<p class="ind"><b>Tenant Improvement Coordination.</b> Agent shall coordinate tenant improvement build-outs, including contractor selection and oversight, TI allowance tracking and disbursement, DOB permit coordination, certificate of occupancy verification, and punch list management.</p>
<p class="ind"><b>Commercial Insurance &amp; Compliance.</b> Agent shall procure and maintain commercial property insurance, commercial general liability, umbrella, and environmental liability coverage as appropriate, and ensure compliance with all commercial building codes, fire safety regulations, ADA accessibility requirements, and applicable Local Laws.</p>
<p class="ind"><b>Leasing Support.</b> Agent shall support the Client's leasing efforts by preparing vacant space for showing, coordinating with leasing brokers, reviewing prospective tenant financials, negotiating lease terms as authorized, and managing the lease execution process.</p>`,
  };
  return extra[kind];
}

function scheduleAExtraRows(kind: 'condo' | 'coop' | 'office'): string {
  const rows: Record<'condo' | 'coop' | 'office', string> = {
    condo: `
<tr><td>Unit Resale Application Processing</td><td class="fee-amt">$500.00 per application</td></tr>
<tr><td>Alteration Application Processing</td><td class="fee-amt">$500.00 per application</td></tr>
<tr><td>Estoppel Certificate</td><td class="fee-amt">$250.00 per certificate</td></tr>
<tr><td>Reserve Fund Study Coordination</td><td class="fee-amt">$1,500.00 flat</td></tr>
<tr><td>Offering Plan Amendment Coordination</td><td class="fee-amt">$150.00 per hour</td></tr>`,
    coop: `
<tr><td>Share Transfer / Sale Application</td><td class="fee-amt">$500.00 per application</td></tr>
<tr><td>Sublet Application Processing</td><td class="fee-amt">$350.00 per application</td></tr>
<tr><td>Recognition Agreement Processing</td><td class="fee-amt">$300.00 per agreement</td></tr>
<tr><td>Stock Certificate Issuance</td><td class="fee-amt">$200.00 per certificate</td></tr>
<tr><td>Proprietary Lease Amendment</td><td class="fee-amt">$150.00 per hour</td></tr>`,
    office: `
<tr><td>Commercial Lease Negotiation</td><td class="fee-amt">$250.00 per hour</td></tr>
<tr><td>Leasing Commission (New Tenant)</td><td class="fee-amt">Per lease terms, typically 4&ndash;6% of aggregate rent</td></tr>
<tr><td>Leasing Commission (Renewal)</td><td class="fee-amt">Per lease terms, typically 2&ndash;3% of aggregate rent</td></tr>
<tr><td>Tenant Improvement Coordination</td><td class="fee-amt">5% of TI cost</td></tr>
<tr><td>ADA Compliance Review</td><td class="fee-amt">$150.00 per hour</td></tr>`,
  };
  return rows[kind];
}

export function generateAgreementV3General(input: AgreementInput): string {
  const kind = NORMALIZED[input.assetClass];
  const docTypeLabel = DOC_TYPE_LABEL[input.assetClass];
  const recitalUnits = RECITAL_UNIT_DESCRIPTION[kind];
  const governingBody = GOVERNING_BODY[kind];

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

  const effDate = input.effectiveDate ? new Date(input.effectiveDate + 'T00:00:00') : now;
  const effDay = effDate.getDate();
  const effMonth = effDate.toLocaleDateString('en-US', { month: 'long' });
  const effYear = effDate.getFullYear();
  const effDateLong = `${effMonth} ${effDay}, ${effYear}`;

  const monthlyFee =
    input.customMonthlyFee ||
    (input.tieredPricing ? input.tieredPricing[input.selectedTier].monthly : 0);
  const feeText = monthlyFee ? `${money(monthlyFee)} per month` : '[MONTHLY FEE] per month';
  const startupFeeSentence =
    input.startupFee > 0
      ? `The Client shall pay the Agent a one-time, non-refundable start-up fee of ${money(input.startupFee)}, due within five (5) business days of the Effective Date, to cover the Agent's initial onboarding expenses.`
      : `The Agent's standard one-time start-up fee is waived for this engagement. Onboarding is included.`;

  const initialTermSentence = `The initial term of this Agreement shall commence on the Effective Date and shall continue for a period of ${termWords(input.initialTermYears || 2)} years (the "Initial Term"). Upon the conclusion of the Initial Term, this Agreement shall automatically renew for successive ${termWords(input.renewalTermYears || 1)} year periods (each a "Renewal Period," and together with the Initial Term, the "Term"), unless terminated as provided herein.`;

  const annualIncreaseSentence = input.annualIncrease
    ? ` The Services Compensation shall increase by ${input.annualIncrease}% on each anniversary of the Effective Date.`
    : '';

  const images = (input.propertyImages || []).filter(Boolean).slice(0, 5);
  const coverPhotoSrc = images[0] || '';
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

  const unitsText = input.units ? `${input.units}` : '[NUMBER OF UNITS]';

  const neighborhoodName = input.jackieData?.neighborhoodName || '';
  const boroughName = input.jackieData?.borough || boroughFromZip(input.propertyZip) || '';
  const blockLotText = input.blockLot || '';
  const metaParts: string[] = [];
  if (neighborhoodName) metaParts.push(`<span class="meta-item"><b>Neighborhood:</b> ${esc(neighborhoodName)}</span>`);
  if (boroughName) metaParts.push(`<span class="meta-item"><b>Borough:</b> ${esc(boroughName)}</span>`);
  if (blockLotText) metaParts.push(`<span class="meta-item"><b>Block &amp; Lot:</b> ${esc(blockLotText)}</span>`);
  const coverMetaLine = metaParts.length ? `<p class="cover-meta">${metaParts.join('')}</p>` : '';

  const coverAddrLine1 = esc(input.propertyAddress || '[PROPERTY ADDRESS]');
  const coverAddrLine2 = esc(
    [input.propertyCity, input.propertyState].filter(Boolean).join(', ') +
      (input.propertyZip ? ` ${input.propertyZip}` : '')
  );

  // ---- Articles ----
  const articleI = articleIDefinitions(kind);

  const articleII = article('II', 'Term', `<p class="body">${initialTermSentence}</p>`);

  const articleIII = article('III', 'Exclusive Agency', `<p class="body">During the Term, absent the Agent's prior written consent, no party other than the Agent shall perform the Services or Additional Services with respect to the Property. The Agent shall be entitled to place a small sign at the Property identifying the Agent as the managing agent.</p>`);

  const articleIV = article('IV', 'Termination', `
<p class="ind"><b>Termination for Material Breach.</b> If either Party is in material breach of this Agreement, the breaching Party shall have five (5) business days from receipt of written notice of such breach (the "Cure Period") to cure it. If the breach is not cured within the Cure Period, the non-breaching Party may terminate this Agreement immediately upon written notice.</p>
<p class="ind"><b>Termination for Insolvency or Incapacity.</b> Either Party may terminate this Agreement immediately upon written notice if the other Party becomes insolvent, files or becomes subject to a bankruptcy petition, makes a general assignment for the benefit of creditors, or has a receiver or trustee appointed for it or a material portion of its property.</p>
<p class="ind"><b>Termination for Convenience.</b> Following the Initial Term, this Agreement may otherwise be terminated by either Party upon ${termWords(input.terminationNoticeDays || 90)} days prior written notice to the other Party.</p>
<p class="ind"><b>Effect of Termination.</b> Upon termination, the Parties shall account to each other for all uncompleted business, and the Agent shall promptly deliver to the Client all funds and property belonging to the Client then in the Agent's possession (less an amount reasonably necessary to pay then-accrued and payable expenses). No new business may be undertaken after notice of termination except transitional matters.</p>`);

  const articleV = article('V', 'Compensation', `
<p class="ind"><b>Payment for Services.</b> As consideration for the Services, the Client shall pay the Agent, during the Term, the management fee set forth below (the "Services Compensation").</p>
<p class="body"><b>Management Fee:</b> <u>${feeText}</u>${annualIncreaseSentence}</p>
<p class="ind">The Agent may invoice the Client within ten (10) business days of each month-end for Services Compensation due. Services Compensation shall be due and payable upon the Client's receipt of such invoice.</p>
<p class="ind"><b>Monthly Reporting, Tax and Accounting Services.</b> Monthly reporting and accounting services — including bank reconciliations, income statements, and balance sheets — are included in the Services Compensation. This does not include preparation of tax returns, which shall be separately charged.</p>
<p class="ind"><b>Payment for Additional Services.</b> As consideration for the Additional Services, the Client shall pay the Agent the fees set forth in Article IX and the attached Fee Schedule (the "Additional Services Compensation," and together with the Services Compensation, the "Compensation"). The Agent shall invoice the Client for Additional Services Compensation not less than once per calendar quarter.</p>
<p class="ind"><b>Payment Instructions.</b> All Compensation shall be paid within five (5) business days of the later of (i) the date it becomes due and payable, and (ii) the date the Agent provides the Client an invoice, where required (the "Payment Instructions").</p>
<p class="ind"><b>Start-Up Fee.</b> ${startupFeeSentence}</p>`);

  const articleVI_a = article('VI', "Agent's Duties (the Services)", `
<p class="body">As consideration for the Compensation, during the Term the Agent shall perform the following Services on the Client's behalf:</p>
<p class="ind"><b>Regular Repairs and Maintenance.</b> The Agent shall maintain the Property in a condition deemed advisable by the Client, at the Client's expense from the Client Accounts, including the cleanliness and operability of the Property's interior, exterior, mechanical, electrical, and plumbing systems, and elevators. Repairs or alterations exceeding $5,000 shall require the Client's prior written consent, not to be unreasonably withheld.</p>
<p class="ind"><b>Inspection Visits.</b> The Agent shall conduct inspections of the Property as it deems necessary, not to exceed two per month or twelve in any six-month period.</p>
<p class="ind"><b>Violations.</b> The Agent shall recommend, and upon the Client's approval cause, remediation of any violations issued by a governmental authority with jurisdiction over the Property. The Agent shall promptly notify the Client of any violation received. Remediation costs shall be paid from the Client Account and are not subject to the Payment Instructions.</p>
<p class="ind"><b>Utilities and Service Contracts.</b> The Agent shall enter into, maintain, or renew contracts for electricity, gas, water treatment, elevator, telephone, window cleaning, rubbish removal, security, extermination, and architectural/engineering services necessary for Property operations. Contracts exceeding a two-year term or $10,000 in cumulative annual payments require the Client's prior written authorization.</p>
<p class="ind"><b>Supplies.</b> The Agent shall purchase all supplies necessary to maintain and operate the Property, at market rate and acceptable quality, paid from the Client Accounts. Supplies shall carry a combined 20% markup (10% overhead, 10% profit), billed monthly.</p>`);

  const articleVI_b = article('VI', "Agent's Duties (the Services), continued", `
${articleVIDutiesExtra(kind)}
<p class="ind"><b>Owner/${governingBody} Communications.</b> The Agent shall provide the Client with regular updates on Property operations and, upon reasonable request, make Agent personnel available to meet with the Client to discuss Property performance.</p>
<p class="ind"><b>Storage.</b> The Agent shall provide secure off-premises storage for the Client's Property files at the Client's expense, paid from the Client Accounts.</p>
<p class="ind"><b>Monthly Reports.</b> The Agent shall render monthly statements to the Client of collections and disbursements, reconciled Client Account balances, and a schedule of accounts payable, delivered no later than the 20th of each month.</p>
<p class="ind"><b>Books and Records.</b> The Agent shall maintain orderly corporate books, checkbooks, records, insurance policies, leases, correspondence, receipted bills, cancelled checks, and bank statements relating to the Property, and shall furnish records reasonably required by the Client's accountants for tax filings.</p>
<p class="ind"><b>Emergency Contact.</b> The Agent shall maintain a 24-hour telephone line for reporting of, and prompt response to, emergency conditions at the Property.</p>`);

  const articleVII = article('VII', 'Insurance', `
<p class="ind"><b>Agent's Insurance Coverage.</b> The Agent shall maintain, at its own expense, commercial general liability insurance with limits acceptable to the Client (but not less than $1,000,000 per occurrence), workers' compensation and employer's liability insurance, professional liability (errors and omissions) insurance, employment practices liability insurance, and cyber liability insurance. The Client shall pay the Agent an annual fee of $450 toward the premium for the Agent Insurance Policies. This Article shall survive termination of this Agreement.</p>
<p class="ind"><b>Client Insurance Requirements.</b> The Agent shall assist the Client in securing, at the Client's expense from the Client Accounts, appropriate coverage for the Property as requested by the Client, procured from a broker of good standing. The Client shall separately maintain: (i) a fidelity bond or employee dishonesty coverage of not less than $1,000,000; (ii) Directors and Officers Liability coverage of not less than $1,000,000, with a Managing Agent rider; (iii) Umbrella Liability coverage of not less than $10,000,000; and (iv) statutory New York workers' compensation and disability benefits coverage.</p>`);

  const articleVIII = article('VIII', 'Indemnification &amp; Limitation of Liability', `
<p class="ind"><b>Client Indemnification.</b> The Client shall indemnify and hold the Agent harmless from and against any liability, damages, costs, and expenses (including reasonable attorneys' fees) arising from injury to any person or property in connection with the Property, unless caused by the Agent's own negligence, willful misconduct, or material breach of this Agreement.</p>
<p class="ind"><b>Exclusions.</b> The Agent shall not be liable for theft, fraud, cyber incidents, employment disputes, property damage, or third-party negligence, except to the extent caused by the Agent's own negligence or willful misconduct, or for any claim exceeding the limits of the insurance maintained under Article VII.</p>
<p class="ind"><b>Survival.</b> The indemnification obligations of this Article shall survive termination of this Agreement for a period of five (5) years.</p>`);

  const articleIX = article('IX', 'Additional Services', `
<p class="ind"><b>Additional Services Process.</b> If the Agent determines Additional Services are necessary and they were not otherwise requested by the Client, the Agent shall provide written notice describing the proposed Additional Services in reasonable detail. If the Client does not object within five (5) business days of receipt, or otherwise approves such Additional Services, the Agent shall perform them at the Compensation rates set forth herein.</p>
<p class="ind"><b>Financing Services.</b> For any mortgage, refinancing, or credit line for which the Agent serves as broker, the Client shall pay the Agent (i) 1% of the first $1,000,000 of financing, plus (ii) 0.5% of any amount above $1,000,000.</p>
<p class="ind"><b>Hearing Services.</b> For any civil, criminal, arbitration, mediation, environmental, or other hearing at which Agent personnel appear on the Client's behalf, the Client shall pay the Agent $150 per hour, including travel time.</p>
<p class="ind"><b>Emergency Services.</b> The Agent shall maintain personnel at the Property during the rendering of any Emergency Service and shall be paid $150 per hour, payable immediately, from the Client Accounts to the extent not covered by insurance.</p>
<p class="ind"><b>Extraordinary Project Services.</b> For any construction project requiring immediate or short-notice commencement, the Agent shall manage the project for a fee of 20% of project cost, paid from the Client Accounts to the extent not covered by insurance.</p>`);

  const articleX = article('X', 'Additional Fees &amp; Supplemental Services', `
<p class="ind"><b>Reimbursable Expenses.</b> The Agent shall be reimbursed for all Reimbursable Expenses, due on the first day of the month following the month incurred, in accordance with the Payment Instructions.</p>
<p class="ind"><b>Additional Client Fees.</b> At the Client's request, and subject to the Payment Instructions, the Agent will also, for a fee: (i) process and file Forms 1098/1099 ($25 per form); (ii) prepare and file the Real Property Income and Expense (RPIE) form ($400 per filing); (iii) establish and maintain Client Accounts; and (iv) administer Employee payroll, with full reimbursement of payroll service fees where paid by the Agent on the Client's behalf.</p>
<p class="ind"><b>Ancillary Fee Sheet.</b> Except as set forth above, the Parties shall be governed by the Ancillary Fee Sheet attached to this Agreement.</p>`);

  const articleXI = article('XI', 'Personnel', `
<p class="ind"><b>Hiring and Supervision.</b> The Agent shall hire, pay, and supervise all Employees necessary to properly maintain and operate the Property, and may discharge Employees with the Client's prior approval. Upon termination of this Agreement, the Agent may reassign Employees to other properties it manages.</p>
<p class="ind"><b>Non-Solicitation.</b> For nine (9) months following termination of this Agreement, the Client shall not solicit, induce, or hire any person who is or was an Employee of the Agent, unless the Client pays the Agent 25% of that person's annual salary as a lump sum.</p>`);

  const articleXII = article('XII', 'Financial Administration', `
<p class="ind"><b>Late Payment Interest.</b> Invoices for emergency work or project management services remaining unpaid more than thirty (30) days from submission shall accrue interest at 1.5% per month, compounded monthly, until paid in full.</p>
<p class="ind"><b>Document Management and Retention.</b> The Agent shall use commercially reasonable efforts to scan and digitally store Client-provided documents. The Agent shall retain electronic copies for seven (7) years from receipt, after which it may securely dispose of records absent written instruction otherwise.</p>
<p class="ind"><b>Limitation of Liability for Documents.</b> The Agent's liability for loss, destruction, misplacement, or corruption of documents shall not exceed $10,000 in the aggregate per occurrence, except in cases of willful misconduct or fraud.</p>`);

  const articleXIII = article('XIII', 'Authority', `<p class="body">The Client authorizes the Agent, on its behalf, to perform any act reasonably necessary to render the Services and Additional Services, subject to the limitations herein. The Agent shall not be obligated to advance funds on the Client's behalf except from funds held or provided for that purpose; if the Agent voluntarily advances such funds, the Client shall reimburse the Agent on demand.</p>`);

  const articleXIV = article('XIV', 'Bank Accounts', `
<ul class="blt">
<li>The Agent shall establish and maintain Client Accounts as necessary to perform its obligations hereunder.</li>
<li>Each Client Account shall designate that it is held on the Client's behalf.</li>
<li>Any transfer of $10,000 or more from a Client Account requires the Client's prior written approval and two authorized signatories.</li>
<li>Upon request, the Agent shall provide the Client an account agreement covering the Client Accounts, in form reasonably satisfactory to the Client.</li>
<li>Upon request, the Agent shall inform the Client of the balances held in the Client Accounts.</li>
</ul>`);

  const articleXV = article('XV', 'Licenses', `<p class="body">The Agent represents that it is duly licensed by the New York Department of State as a real estate broker, sufficient to lawfully perform its duties under this Agreement.</p>`);

  const articleXVI = article('XVI', 'Notices &amp; Miscellaneous', `<p class="body">All notices under this Agreement shall be in writing and effective only if (i) served personally, (ii) sent by nationally recognized overnight courier, or (iii) sent by certified or registered mail, addressed to the recipient's address first written above. The Agent affirms it has no relationship or affiliation with the Client.</p>`);

  const articleXVII = article('XVII', 'Governing Law', `<p class="body">This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to conflict-of-law principles.</p>`);

  const articleXVIII = article('XVIII', 'Entire Agreement', `<p class="body">This Agreement constitutes the entire agreement between the Parties and may not be amended orally. It shall bind and inure to the benefit of the Parties and their successors, and may not be assigned by either Party without the other's prior written consent.</p>`);

  const articleXIX = article('XIX', 'Independent Contractor', `<p class="body">The Agent's relationship to the Client under this Agreement is that of an independent contractor. Nothing herein shall be construed to create a partnership, joint venture, or employer-employee relationship. Neither the Agent nor its employees are eligible for benefits the Client makes available to its own employees, and the Agent is solely responsible for its own tax filings and payments arising from fees paid under this Agreement.</p>`);

  const articleXX = input.specialTerms?.trim()
    ? article('XX', 'Special Terms', `<p class="body">${esc(input.specialTerms.trim()).replace(/\n/g, '<br/>')}</p>`)
    : '';

  // ---- Page shell ----
  let pageCounter = 0;
  const totalPagesPlaceholder = '__TOTAL_PAGES__';
  const pageWrap = (bodyHtml: string, opts?: { scheduleTitle?: string; noLetterhead?: boolean }) => {
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
    <div class="lh-tag">New Yorkers Working for New Yorkers <span style="font-style:normal;font-size:7pt">EST. 2006</span></div>
  </div>
</div>`}

${opts?.scheduleTitle ? `<div class="sched-title">${opts.scheduleTitle}</div>` : ''}
${bodyHtml}

</div><!-- .page-content -->
<div class="pf">
  <div class="pf-left">${CAMELOT_OFFICE.address} &middot; ${CAMELOT_OFFICE.phone}</div>
  <div class="pf-center">CONFIDENTIAL &mdash; ${version} &mdash; ${dateStr}</div>
  <div class="pf-right">Page ${n} of ${totalPagesPlaceholder}</div>
</div>
</div><!-- .page -->`;
  };

  const coverPage = pageWrap(`
<div class="cover-wrap">
  <h1 class="cover-addr">${coverAddrLine1}</h1>
  <h2 class="cover-citystate">${coverAddrLine2}</h2>

  ${coverPhotoSrc ? `<div class="cover-photo-box"><img src="${coverPhotoSrc}" alt="${addrDisplay}" /></div>` : ''}

  ${coverMetaLine}

  <p class="cover-doctype">${docTypeLabel}</p>
  <p class="cover-dateprep">Date: ${effDateLong}&nbsp;&nbsp;&nbsp;Prepared for: ${clientEntity}</p>
  <p class="cover-version">Version 01.</p>
</div>
`);

  const preamblePage = pageWrap(`
<p class="body">THIS AGREEMENT (the "Agreement") is made as of this ${effDay} day of ${effMonth}, ${effYear} (the "Effective Date"), by and between <b>${clientEntity}</b>, having its principal office at ${input.clientAddress || '[CLIENT ADDRESS]'} ("Client"), and <b>CAMELOT PROPERTY MANAGEMENT SERVICES CORP.</b>, a New York corporation, having its principal office at ${CAMELOT_OFFICE.address} (the "Agent," and together with the Client, the "Parties," and each a "Party").</p>
<p class="body">WHEREAS, the Client owns certain real property known as and located at ${addrDisplay} (the "Property"), consisting of ${unitsText} ${recitalUnits}; and</p>
<p class="body">WHEREAS, the Client desires to engage the Agent to perform the Services and the Additional Services (as defined herein) in connection with the Property, and the Agent desires to be so engaged;</p>
<p class="body">NOW, THEREFORE, for good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:</p>

${mapBlock}
${extraImages}
${intelBlock}
`);

  const articlePage2 = pageWrap(`${articleI}`);
  const articlePage3 = pageWrap(`${articleII}${articleIII}`);
  const articlePage4 = pageWrap(`${articleIV}`);
  const articlePage5 = pageWrap(`${articleV}`);
  const articlePage6 = pageWrap(`${articleVI_a}`);
  const articlePage7 = pageWrap(`${articleVI_b}`);
  const articlePage8 = pageWrap(`${articleVII}`);
  const articlePage9 = pageWrap(`${articleVIII}`);
  const articlePage10 = pageWrap(`${articleIX}`);
  const articlePage11 = pageWrap(`${articleX}`);
  const articlePage12 = pageWrap(`${articleXI}${articleXII}`);
  const articlePage13 = pageWrap(`${articleXIII}${articleXIV}${articleXV}`);
  const articlePage14 = pageWrap(`${articleXVI}${articleXVII}${articleXVIII}${articleXIX}${articleXX}`);

  const signaturePage = pageWrap(`
<div class="sig-page">
  <div class="sig-head">SIGNATURES</div>
  <div class="sig-wit">
    <p class="sig-witness">IN WITNESS WHEREOF, the parties hereto have executed this Agreement as of the day and year first above written.</p>
  </div>

  <div class="sig-party">CLIENT</div>
  <p class="sig-entity">
    <b>${clientEntity}</b>${input.clientAddress ? `<br/>${esc(input.clientAddress)}` : ''}${input.clientPhone ? `<br/>${esc(input.clientPhone)}` : ''}${input.clientEmail ? `<br/>${esc(input.clientEmail)}` : ''}
  </p>
  <div class="sig-field"><b>By (Signature):</b> ____________________________</div>
  <div class="sig-field"><b>Name:</b> ____________________________</div>
  <div class="sig-field"><b>Title:</b> ____________________________</div>
  <div class="sig-field"><b>Date:</b> ____________________________</div>

  <div class="sig-rule"></div>

  <div class="sig-party">AGENT</div>
  <p class="sig-entity">
    <b>CAMELOT PROPERTY MANAGEMENT SERVICES CORP.</b>, a New York corporation<br/>${esc(CAMELOT_OFFICE.address)}<br/>${esc(CAMELOT_OFFICE.phone)}
  </p>
  <div class="sig-field"><b>By (Signature):</b> ____________________________</div>
  <div class="sig-field"><b>Name:</b> ____________________________</div>
  <div class="sig-field"><b>Title:</b> ____________________________</div>
  <div class="sig-field"><b>Date:</b> ____________________________</div>
</div>
`);

  const scheduleAPage = pageWrap(`
<table class="fee">
<tr><th>Service</th><th style="text-align:right">Fee</th></tr>
<tr><td>Monthly Property Management</td><td class="fee-amt">${feeText}</td></tr>
<tr><td>Property/Project Manager (Emergency or Supervision Services)</td><td class="fee-amt">$150.00 per hour</td></tr>
<tr><td>Travel</td><td class="fee-amt">Billed by receipt</td></tr>
<tr><td>Sales &amp; Leasing</td><td class="fee-amt">Per separate brokerage agreement</td></tr>
<tr><td>Agent Insurance Contribution</td><td class="fee-amt">$450.00 annually</td></tr>
<tr><td>Cleaning, Ordinary Repairs &amp; Maintenance</td><td class="fee-amt">$50.00 per hour</td></tr>
<tr><td>Extraordinary Repairs (over $5,000 per repair)</td><td class="fee-amt">Project manager rate + 20% markup</td></tr>
<tr><td>Supplies &amp; Material Markups</td><td class="fee-amt">10% overhead + 10% profit, billed monthly</td></tr>
<tr><td>Court Appearance or Deposition</td><td class="fee-amt">$150.00 per hour</td></tr>
<tr><td>RPIE Filing (Real Property Income &amp; Expense)</td><td class="fee-amt">$400 per filing</td></tr>
${scheduleAExtraRows(kind)}
</table>
<p class="sched-note">These fees are one-time or occurrence-based, applied as needed by the Client.</p>
`, { scheduleTitle: 'Schedule A &mdash; Fee Schedule' });

  const scheduleBPage = pageWrap(`
<table class="fee">
<tr><th>Service</th><th style="text-align:right">Fee</th></tr>
<tr><td>Alteration Fee</td><td class="fee-amt">$500.00</td></tr>
<tr><td>Tax Abatement / Rebate Program Filing</td><td class="fee-amt">$200 per building filing</td></tr>
<tr><td>Audit Review and Assistance</td><td class="fee-amt">$150.00 per hour</td></tr>
<tr><td>Tax Forms 1098 / 1099</td><td class="fee-amt">$25 per form filed</td></tr>
<tr><td>Monthly Administrative Fee (copies, messenger, mailings, data filings, cloud &amp; physical storage)</td><td class="fee-amt">$200.00 per month</td></tr>
<tr><td>Bank &amp; Insurance Questionnaire Fee</td><td class="fee-amt">$200.00</td></tr>
</table>
`, { scheduleTitle: 'Schedule B &mdash; Ancillary Fee Sheet' });

  const scheduleCPage = pageWrap(`
<p class="body">For the Client's information, Camelot Property Management Services Corp. DBA Camelot Realty Group carries the following lines of insurance as a company. This summary is provided for general informational purposes only &mdash; it is not a Certificate of Insurance and does not modify, replace, or expand any actual policy. A formal Certificate of Insurance is available upon request.</p>
<table class="fee">
<tr><th>Coverage</th><th style="text-align:right">Limit</th></tr>
<tr><td>Professional Liability (Errors &amp; Omissions)</td><td class="fee-amt">$1,000,000 each claim / $1,000,000 aggregate</td></tr>
<tr><td>Employment Practices Liability (EPLI)</td><td class="fee-amt">$1,000,000 maximum limit of liability</td></tr>
<tr><td>General Liability (Businessowners Policy)</td><td class="fee-amt">$1,000,000 each occurrence / $2,000,000 aggregate</td></tr>
<tr><td>Fidelity / Employee Dishonesty Bond</td><td class="fee-amt">$1,000,000</td></tr>
<tr><td>Cyber Liability</td><td class="fee-amt">$1,000,000 aggregate</td></tr>
</table>
<p class="sched-note">Current policy numbers, carriers, and term dates are available on request and should be confirmed with the broker before this exhibit is circulated externally.</p>
`, { scheduleTitle: "Schedule C &mdash; Camelot's Insurance Coverage" });

  const allPages = [
    coverPage,
    preamblePage,
    articlePage2,
    articlePage3,
    articlePage4,
    articlePage5,
    articlePage6,
    articlePage7,
    articlePage8,
    articlePage9,
    articlePage10,
    articlePage11,
    articlePage12,
    articlePage13,
    articlePage14,
    signaturePage,
    scheduleAPage,
    scheduleBPage,
    scheduleCPage,
  ].join('\n');

  const finalHtml = allPages.replace(new RegExp(totalPagesPlaceholder, 'g'), String(pageCounter));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Camelot ${docTypeLabel} — ${addrDisplay}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{font-family:${BODY_FONT};color:${BODY_BLACK};font-size:9pt;line-height:1.55;background:#f5f0e5}
@page{size:8.5in 11in;margin:0.75in}
@media print{body{background:white}}
@media screen{
  .page{margin:20px auto;box-shadow:0 2px 10px rgba(0,0,0,0.1);background:white}
}
.page{width:8.5in;min-height:11in;padding:0.75in 0.75in 1.1in 0.75in;margin:20px auto;border:2px solid ${GOLD_RULE};page-break-after:always;position:relative;background:white}
.page-content{position:relative;z-index:1}

.letterhead{display:flex;align-items:center;gap:12px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #8a867e}
.letterhead img{width:44px;height:44px}
.lh-text{flex:1}
.lh-name{font-size:14px;font-weight:700;color:#1B2A4A;letter-spacing:0.5px;margin:0}
.lh-services{font-size:7.5px;color:#6B675F;letter-spacing:1px;margin:1px 0}
.lh-tag{font-size:9px;color:#A9814A;font-style:italic;margin:2px 0}

.cover-wrap{text-align:center;padding-top:18pt}
h1.cover-addr{font-family:${COVER_TITLE_FONT};color:${COVER_TITLE_COLOR};font-size:18pt;font-weight:400;margin:0 0 4pt;line-height:1.25}
h2.cover-citystate{font-family:${COVER_TITLE_FONT};color:${COVER_TITLE_COLOR};font-size:16pt;font-weight:400;margin:0 0 18pt;line-height:1.25}
.cover-photo-box{margin:0 auto 16pt;width:4.5in;height:3.5in;border:1px solid #000;overflow:hidden}
.cover-photo-box img{width:100%;height:100%;object-fit:cover;display:block}
p.cover-meta{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};font-weight:400;margin:0 0 20pt}
.meta-item{margin:0 10pt}
.meta-item b{font-weight:700}
p.cover-doctype{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};font-weight:400;margin:0 0 4pt}
p.cover-dateprep{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};font-weight:400;margin:0 0 14pt}
p.cover-version{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};font-weight:400;margin:0}

h2.art{font-family:${HEADING_FONT};font-size:12pt;font-weight:700;color:${DARK_GOLD};text-align:center;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1.5pt solid ${GOLD_RULE};padding:12pt 0 6pt;margin:20pt 0 0;page-break-after:avoid}
h3.art-sub{font-family:${HEADING_FONT};font-size:11pt;font-weight:700;color:${DARK_GOLD};text-align:center;letter-spacing:0.5px;margin:6pt 0 10pt;padding:0;page-break-after:avoid}
.page-content > .article-block:first-of-type > h2.art{margin-top:64pt}

p.body{font-family:${BODY_FONT};font-size:9pt;font-weight:400;color:${BODY_BLACK};margin-bottom:8pt;text-align:justify}
p.ind{font-family:${BODY_FONT};font-size:9pt;font-weight:400;color:${BODY_BLACK};margin:0 0 7pt 18pt;text-align:justify}
p.deflist{font-family:${BODY_FONT};font-size:9pt;font-weight:400;color:${BODY_BLACK};margin-bottom:8pt;text-align:justify}
p.deflist b{font-weight:700;color:${BODY_BLACK}}
ul.blt{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};margin:0 0 8pt 24px}
ul.blt li{margin-bottom:4pt;text-align:justify}

.loc-strip{display:flex;gap:12px;margin:12px 0;align-items:stretch}
.loc-map{flex:0 0 45%;border:1px solid #d8d4cb;border-radius:3px;overflow:hidden}
.loc-map iframe{width:100%;height:100%}
.loc-text{flex:1}
.loc-title{font-family:${HEADING_FONT};font-size:10pt;font-weight:700;color:#1B2A4A;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4pt;border-bottom:1px solid #C9A55C;padding-bottom:2pt;display:inline-block}
.loc-text p{font-family:${BODY_FONT};font-size:9pt;text-align:justify;color:${BODY_BLACK}}

.intel{margin:0 0 12px;page-break-inside:avoid}
.intel ul{margin:3px 0 5px 20px}
.intel li{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};margin-bottom:2pt}
.intel-src{font-family:${BODY_FONT};font-size:8pt;color:#9b968b;font-style:italic}

.photo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}
.photo-grid img{width:100%;height:80px;object-fit:cover;border:1px solid #d8d4cb;border-radius:2px}

table.fee{width:100%;border-collapse:collapse;font-family:${BODY_FONT};font-size:9pt;margin:8pt 0 5pt}
table.fee th{background:#1B2A4A;color:#fff;text-align:left;padding:6pt 8pt;font-size:8.5pt;letter-spacing:0.5px;text-transform:uppercase}
table.fee td{padding:6pt 8pt;border-bottom:1px solid #e8e5de;font-weight:400}
table.fee tr:nth-child(odd) td{background:#F7F4EC}
td.fee-amt{white-space:nowrap;font-weight:700;color:#1B2A4A}
.sched-note{font-family:${BODY_FONT};font-size:8.5pt;font-style:italic;color:#6B675F;margin:5pt 0 0}

.sig-page{padding-top:8px;text-align:center}
.sig-head{font-family:${HEADING_FONT};font-size:13pt;font-weight:700;color:#1B2A4A;letter-spacing:2px;margin-bottom:8pt;text-transform:uppercase}
.sig-wit{margin:0 auto 20px;max-width:600px}
.sig-witness{font-family:${BODY_FONT};font-style:italic;font-size:9pt}
.sig-party{font-family:${HEADING_FONT};font-size:11pt;font-weight:700;color:#1B2A4A;letter-spacing:2px;margin:28px 0 10px;text-transform:uppercase}
.sig-entity{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};max-width:520px;margin:0 auto 16px;text-align:center}
.sig-entity b{font-weight:700}
.sig-field{font-family:${BODY_FONT};margin-bottom:10px;font-size:9pt}
.sig-field b{color:${BODY_BLACK};font-weight:700}
.sig-rule{width:70%;margin:24px auto;border-bottom:1px solid #C9A55C}

.sched-title{font-family:${HEADING_FONT};font-size:13pt;font-weight:700;color:#1B2A4A;text-align:center;letter-spacing:1px;margin:0 0 10pt;text-transform:uppercase}
.avoid-break{page-break-inside:avoid}
.article-block{page-break-inside:avoid}

.pf{margin-top:16px;padding-top:6px;border-top:1px solid ${GOLD_RULE};text-align:center;font-family:${BODY_FONT};font-size:8pt;color:${BODY_BLACK};display:flex;justify-content:space-between;align-items:center}
.pf-left{text-align:left;flex:0 0 50%}
.pf-center{flex:1;text-align:center}
.pf-right{text-align:right;flex:0 0 auto;white-space:nowrap}

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
