/**
 * Camelot Rental Management Agreement — HTML generator.
 *
 * Mirrors the Word master template exactly: title cover page (property
 * address as the headline), same letterhead header and contact footer on
 * every page, centered dark-gold article titles, Articles I–XIX (plus
 * optional XX) verbatim, single signature page with both parties, and
 * Schedules A/B/C with real Camelot rates.
 *
 * Typography contract (per house style):
 *  - Cover title (property address):    HGMaruGothicMPRO, Blue Accent 1
 *    Darker 25% (#2F5597), 18pt, centered.
 *  - Cover subtitle (city/state/zip):   same family/color, 16pt.
 *  - Body text everywhere (Heading 3+): Arial, 9pt, not bold.
 *  - Article heading ("ARTICLE N"):     Georgia, 12pt, dark gold (#8B6F47),
 *    centered, border line beneath (Heading 1 equivalent).
 *  - Section title (e.g. "Definitions"): Georgia, dark gold, centered
 *    (Heading 2 equivalent), sits directly under the Article border line.
 *  - Footer (every page):               Arial, 8pt, standard black —
 *    "{office address+phone}   CONFIDENTIAL — {version} — {date}   Page N of M".
 *
 * IMPORTANT: every logical page is its own `.page` div with NO fixed
 * height / overflow:hidden — that combination silently clips content in
 * both screen and print rendering. Pages use `min-height` only, and are
 * split generously (one Article or a couple of short Articles per page)
 * so no single page's content ever needs to overflow its own div.
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

// Cover-title typeface + house colors, shared by HTML and (eventually) the
// native docx/pdf exporters so all three stay in lockstep.
export const COVER_TITLE_FONT = "'HGMaruGothicMPRO','HGMaruGothicM PRO',Georgia,serif";
export const COVER_TITLE_COLOR = '#2F5597'; // Blue, Accent 1, Darker 25%
export const HEADING_FONT = "Georgia,'Times New Roman',serif";
export const DARK_GOLD = '#8B6F47';
export const GOLD_RULE = '#B8960F';
export const BODY_FONT = "Arial,Helvetica,sans-serif";
export const BODY_BLACK = '#000000';

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

// Rough NYC ZIP-prefix → borough fallback, only used when Jackie/PLUTO data
// hasn't supplied a real borough for the property.
function boroughFromZip(zip: string): string {
  const p3 = (zip || '').trim().slice(0, 3);
  if (['100', '101', '102'].includes(p3)) return 'Manhattan';
  if (p3 === '103') return 'Staten Island';
  if (p3 === '104') return 'Bronx';
  if (p3 === '112') return 'Brooklyn';
  if (['110', '111', '113', '114', '116'].includes(p3)) return 'Queens';
  return '';
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

  const effDate = input.effectiveDate
    ? new Date(input.effectiveDate + 'T00:00:00')
    : now;
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
      ? `The Client shall pay the Agent a one-time, non-refundable start-up fee of ${money(input.startupFee)}, due within five (5) business days of the Effective Date, to cover the Agent's initial onboarding expenses (collection and organization of Property files, resident and vendor announcements, bank account setup, and required public notices).`
      : `The Agent's standard one-time start-up fee is waived for this engagement. Onboarding — collection and organization of Property files, resident and vendor announcements, bank account setup, and required public notices — is included.`;

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

  // ---- Cover-page identity strip: Neighborhood / Borough / Block & Lot ----
  const neighborhoodName = input.jackieData?.neighborhoodName || '';
  const boroughName = input.jackieData?.borough || boroughFromZip(input.propertyZip) || '';
  const blockLotText = input.blockLot || '';
  const metaParts: string[] = [];
  if (neighborhoodName) metaParts.push(`<span class="meta-item"><b>Neighborhood:</b> ${esc(neighborhoodName)}</span>`);
  if (boroughName) metaParts.push(`<span class="meta-item"><b>Borough:</b> ${esc(boroughName)}</span>`);
  if (blockLotText) metaParts.push(`<span class="meta-item"><b>Block &amp; Lot:</b> ${esc(blockLotText)}</span>`);
  const coverMetaLine = metaParts.length ? `<p class="cover-meta">${metaParts.join('')}</p>` : '';

  // Cover title splits the street line from the city/state/zip line, each
  // with its own point size per the house style.
  const coverAddrLine1 = esc(input.propertyAddress || '[PROPERTY ADDRESS]');
  const coverAddrLine2 = esc(
    [input.propertyCity, input.propertyState].filter(Boolean).join(', ') +
      (input.propertyZip ? ` ${input.propertyZip}` : '')
  );

  // ---- Article content, fully detailed (matching approved template language) ----

  const article = (num: string, title: string, body: string) => `
<div class="article-block">
<h2 class="art">ARTICLE ${num}</h2>
<h3 class="art-sub">${title}</h3>
${body}
</div>`;

  const articleI = article('I', 'Definitions', `
<p class="deflist"><b>"Additional Services"</b> shall mean Lease Services, Transfer Services, Financing Services, Hearing Services, Audit Services, Pre-Occupation Services, Emergency Services, and Extraordinary Project Services, each as further described in Article IX.</p>
<p class="deflist"><b>"Client Account"</b> shall mean a bank account, in a bank whose deposits are insured by the Federal Deposit Insurance Corporation, maintained in a manner that indicates its custodial nature, for the deposit of monies of the Client, with authority granted to the Agent to withdraw therefrom for payments due under this Agreement, including the Agent's Compensation, subject to the limitations set out herein.</p>
<p class="deflist"><b>"Emergency Services"</b> shall mean any Additional Services that, in the Agent's reasonable determination, must be performed immediately to maintain the continuing occupancy and safe operation of the Property or any rental unit.</p>
<p class="deflist"><b>"Employees"</b> shall mean all persons employed or otherwise engaged as necessary to properly maintain and operate the Property.</p>
<p class="deflist"><b>"Lease Rate"</b> shall mean the annual rate of rent charged to a Tenant.</p>
<p class="deflist"><b>"Reimbursable Expenses"</b> shall mean all reasonable out-of-pocket expenses incurred by the Agent in connection with the Services and the Additional Services, including but not limited to messenger, postage, photocopying, printing, scanning, and online-payment processing expenses.</p>
<p class="deflist"><b>"Rental Unit(s)" or "Unit(s)"</b> shall mean the individual dwelling unit(s) comprising the Property.</p>
<p class="deflist"><b>"Services"</b> shall mean the duties of the Agent set forth in Article VI, but not including the Additional Services.</p>
<p class="deflist"><b>"Tenant(s)"</b> shall mean the tenant(s) and sub-tenant(s) lawfully occupying a Unit under a lease or sublease.</p>
<p class="deflist"><b>"Union Contract"</b> shall mean any contract setting forth the Client's obligations to a union representing the Employees, if applicable.</p>`);

  const articleII = article('II', 'Term', `<p class="body">${initialTermSentence}</p>`);

  const articleIII = article('III', 'Exclusive Agency', `<p class="body">During the Term, absent the Agent's prior written consent, no party other than the Agent shall perform the Services or Additional Services with respect to the Property. The Agent shall be entitled to place a small sign at the Property identifying the Agent as the managing agent.</p>`);

  const articleIV = article('IV', 'Termination', `
<p class="ind"><b>Termination for Material Breach.</b> If either Party is in material breach of this Agreement, the breaching Party shall have five (5) business days from receipt of written notice of such breach (the "Cure Period") to cure it. If the breach is not cured within the Cure Period, the non-breaching Party may terminate this Agreement immediately upon written notice.</p>
<p class="ind"><b>Termination for Insolvency or Incapacity.</b> Either Party may terminate this Agreement immediately upon written notice if the other Party (i) is enjoined, prohibited, or otherwise unable to perform its obligations hereunder; (ii) voluntarily files or becomes subject to a petition under any chapter of Title 11 of the United States Code; (iii) makes a general assignment for the benefit of creditors; (iv) admits in writing its inability to pay debts as they mature; (v) has a receiver or trustee appointed for it or a material portion of its property; (vi) files a petition seeking reorganization, bankruptcy, insolvency, or similar relief; or (vii) takes any corporate action in furtherance of any of the foregoing.</p>
<p class="ind"><b>Termination for Convenience.</b> Following the Initial Term, this Agreement may otherwise be terminated by either Party upon ${termWords(input.terminationNoticeDays || 90)} days prior written notice to the other Party.</p>
<p class="ind"><b>Effect of Termination.</b> Upon termination, the Parties shall account to each other for all uncompleted business, and the Agent shall promptly deliver to the Client all funds and property belonging to the Client, including trust accounts, investments, cancelled checks, bank statements and records, rent rolls, bills, ledgers, correspondence, leases, and other records relating to the Property then in the Agent's possession (less an amount reasonably necessary to pay then-accrued and payable expenses). No new business may be undertaken after notice of termination except transitional matters and the transfer of Property files. The Agent may continue rendering Services, Additional Services, and Emergency Services in accordance with this Agreement through the effective date of termination.</p>
<p class="ind">Because termination gives rise to costs that are difficult to estimate precisely, upon termination the Agent shall be entitled to retain the Services Compensation already paid for the month in which termination occurs and, if unpaid, such Services Compensation shall remain due and payable. Termination shall have no effect on any Additional Services Compensation that is then due and payable.</p>`);

  const articleV = article('V', 'Compensation', `
<p class="ind"><b>Payment for Services.</b> As consideration for the Services, the Client shall pay the Agent, during the Term, the management fee set forth below (the "Services Compensation").</p>
<p class="body"><b>Management Fee:</b> <u>${feeText}</u>${annualIncreaseSentence}</p>
<p class="ind">The Agent may invoice the Client within ten (10) business days of each month-end for Services Compensation due. Services Compensation shall be due and payable upon the Client's receipt of such invoice.</p>
<p class="ind"><b>Monthly Reporting, Tax and Accounting Services.</b> Monthly reporting and accounting services — including bank reconciliations, income statements, and balance sheets, and any special reports reasonably requested by lenders or investors — are included in the Services Compensation. This does not include preparation of tax returns, which shall be separately charged. The Agent shall ensure real estate taxes are timely paid to the extent Client Accounts are adequately funded, and shall promptly notify the Client if funding is insufficient; the Agent has no obligation to advance funds for tax payments.</p>
<p class="ind"><b>Payment for Additional Services.</b> As consideration for the Additional Services, the Client shall pay the Agent the fees set forth in Article IX and the attached Fee Schedule (the "Additional Services Compensation," and together with the Services Compensation, the "Compensation"). The Agent shall invoice the Client for Additional Services Compensation not less than once per calendar quarter.</p>
<p class="ind"><b>Payment Instructions.</b> All Compensation shall be paid within five (5) business days of the later of (i) the date it becomes due and payable, and (ii) the date the Agent provides the Client an invoice, where required (the "Payment Instructions").</p>
<p class="ind"><b>Start-Up Fee.</b> ${startupFeeSentence}</p>
<p class="ind"><b>Compensation Deductions.</b> On the first day of each month, the Agent may withdraw from the Client Accounts an amount not exceeding the Compensation due for the prior month (a "Compensation Deduction"), subject to the Payment Instructions. If a Compensation Deduction is less than the Compensation then due (a "Compensation Deficiency"), the Client shall pay the Agent the amount of such deficiency in accordance with the Payment Instructions.</p>`);

  const articleVI_a = article('VI', "Agent's Duties (the Services)", `
<p class="body">As consideration for the Compensation, during the Term the Agent shall perform the following Services on the Client's behalf:</p>
<p class="ind"><b>Regular Repairs and Maintenance.</b> The Agent shall maintain the Property in a condition deemed advisable by the Client, at the Client's expense from the Client Accounts, including the cleanliness and operability of the Property's interior, exterior, mechanical, electrical, and plumbing systems, and elevators. Repairs or alterations exceeding $5,000 shall require the Client's prior written consent, not to be unreasonably withheld.</p>
<p class="ind"><b>Inspection Visits.</b> The Agent shall conduct inspections of the Property as it deems necessary, not to exceed two per month or twelve in any six-month period.</p>
<p class="ind"><b>Violations.</b> The Agent shall recommend, and upon the Client's approval cause, remediation of any violations issued by a governmental authority with jurisdiction over the Property. Where prompt compliance is necessary to avoid exposure to penalty, fine, forfeiture, or injury to persons or property, remediation shall be treated as an Emergency Service. The Agent shall promptly notify the Client of any violation received. Remediation costs shall be paid from the Client Account and are not subject to the Payment Instructions.</p>
<p class="ind"><b>Utilities and Service Contracts.</b> The Agent shall enter into, maintain, or renew contracts for electricity, gas, water treatment, elevator, telephone, window cleaning, rubbish removal, security, extermination, and architectural/engineering services necessary for Property operations. Contracts exceeding a two-year term or $10,000 in cumulative annual payments require the Client's prior written authorization.</p>
<p class="ind"><b>Supplies.</b> The Agent shall purchase all supplies necessary to maintain and operate the Property, at market rate and acceptable quality, paid from the Client Accounts. Purchases shall be made in the Client's name. Supplies shall carry a combined 20% markup (10% overhead, 10% profit), billed monthly.</p>`);

  const articleVI_b = article('VI', "Agent's Duties (the Services), continued", `
<p class="ind"><b>Corporate Expenses and Payments.</b> The Agent shall review and verify all bills for services, work, and supplies, and shall pay or cause to be paid from the Client Accounts all such bills, mortgage interest and amortization, water and sewer charges, assessments, and real estate taxes as they become due.</p>
<p class="ind"><b>Rent Collection and Legal Proceedings.</b> The Agent shall bill Tenants for rent and other charges and use best efforts to collect such amounts, including serving notices to quit when instructed by the Client. When directed by the Client, the Agent may retain counsel and institute proceedings, in the Client's name, to collect rent or recover possession, provided no suit or summary proceeding shall be instituted absent the Client's prior written authorization. The Agent shall cooperate with the Client's attorneys on all related filings and proceedings.</p>
<p class="ind"><b>Owner Communications.</b> The Agent shall provide the Client with regular updates on Property operations and, upon reasonable request, make Agent personnel available to meet with the Client to discuss Property performance.</p>
<p class="ind"><b>Storage.</b> The Agent shall provide secure off-premises storage for the Client's Property files at the Client's expense, paid from the Client Accounts.</p>
<p class="ind"><b>Tenant Complaints.</b> The Agent shall address reasonable Tenant complaints. If the Agent deems a complaint unreasonable, it shall advise the Client in writing of the complaint and the basis for that determination.</p>
<p class="ind"><b>Monthly Reports.</b> The Agent shall render monthly statements to the Client of collections and disbursements, reconciled Client Account balances, and a schedule of accounts payable, including copies of paid bills and vouchers, delivered no later than the 20th of each month.</p>
<p class="ind"><b>Books and Records.</b> The Agent shall maintain orderly corporate books, checkbooks, rent records, insurance policies, leases, correspondence, receipted bills, cancelled checks, and bank statements relating to the Property. The Agent shall further: (i) furnish records reasonably required by the Client's accountants for tax filings; (ii) prepare and file required unemployment, withholding, and social security filings relating to Employees; and (iii) cooperate with the Client's accountants on annual audits and with the Client's attorneys on any assessment-correction filings.</p>
<p class="ind"><b>Emergency Contact.</b> The Agent shall maintain a 24-hour telephone line for reporting of, and prompt response to, emergency conditions at the Property.</p>`);

  const articleVII = article('VII', 'Insurance', `
<p class="ind"><b>Agent's Insurance Coverage.</b> The Agent shall maintain, at its own expense, commercial general liability insurance with limits acceptable to the Client (but not less than $1,000,000 per occurrence), workers' compensation and employer's liability insurance, professional liability (errors and omissions) insurance, employment practices liability insurance, and cyber liability insurance, as further summarized in the attached Insurance Coverage Summary (the "Agent Insurance Policies"). The Client shall pay the Agent an annual fee of $450 toward the premium for the Agent Insurance Policies. Except for workers' compensation, the Agent shall name the Client as an insured party on each such policy and shall provide the Client with a certificate evidencing coverage prior to the policy's commencement. This Article shall survive termination of this Agreement.</p>
<p class="ind"><b>Client Insurance Requirements.</b> The Agent shall assist the Client in securing, at the Client's expense from the Client Accounts, appropriate coverage for the Property, Employees, and Tenants as requested by the Client, including fire, multi-peril, renters', plate glass, boiler, water damage, general liability, workers' compensation, employer's liability, and disability coverage, procured from a broker of good standing (the "Client Insurance Policies"). The Client shall separately maintain: (i) a fidelity bond or employee dishonesty coverage of not less than $1,000,000; (ii) Directors and Officers Liability coverage of not less than $1,000,000, with a Managing Agent rider; (iii) Umbrella Liability coverage of not less than $10,000,000, providing excess coverage over the Directors and Officers limits; and (iv) statutory New York workers' compensation and disability benefits coverage.</p>
<p class="ind"><b>Move-In and Move-Out.</b> The Agent shall, with the Client's cooperation, provide written notice to Tenants moving into or out of a Unit of the procedures and fees applicable to such transition.</p>`);

  const articleVIII = article('VIII', 'Indemnification &amp; Limitation of Liability', `
<p class="ind"><b>Client Indemnification.</b> The Client shall indemnify and hold the Agent harmless from and against (a) any liability, damages, costs, and expenses (including reasonable attorneys' fees) arising from injury to any person or property in connection with the Property, unless caused by the Agent's own negligence, willful misconduct, or material breach of this Agreement, and (b) any liability, damages, penalties, costs, and expenses arising from acts the Agent performed pursuant to this Agreement or the Client's instructions — provided the Agent promptly notifies the Client of any such claim, cooperates fully with the Client and its counsel, and provides related documents, evidence, and witnesses within its control.</p>
<p class="ind"><b>Exclusions.</b> The Agent shall not be liable for theft, fraud, cyber incidents, employment disputes, property damage, or third-party negligence, except to the extent caused by the Agent's own negligence or willful misconduct, or for any claim exceeding the limits of the insurance maintained under Article VII.</p>
<p class="ind"><b>Survival.</b> The indemnification obligations of this Article shall survive termination of this Agreement for a period of five (5) years.</p>
<p class="ind"><b>Fidelity Bond.</b> If requested by the Client, at the Client's expense, the Agent shall procure a fidelity bond, issued by a bonding company authorized to do business in New York, holding the Client harmless from loss caused by larceny, embezzlement, forgery, misappropriation, or other dishonest or fraudulent acts by the Agent or its officers or employees. The Agent represents that it maintains fidelity coverage of $1,000,000 and shall name the Client as an additional insured under such coverage.</p>`);

  const articleIX = article('IX', 'Additional Services', `
<p class="ind"><b>Additional Services Process.</b> If the Agent determines Additional Services are necessary and they were not otherwise requested by the Client, the Agent shall provide written notice describing the proposed Additional Services in reasonable detail (an "Additional Services Notice"). If the Client does not object within five (5) business days of receipt (the "Rejection Period"), or otherwise approves or requests such Additional Services, the Agent shall perform them at the Compensation rates set forth herein. If the Client objects within the Rejection Period, the Parties shall negotiate in good faith; if no agreement is reached, the Agent may, at its discretion, terminate this Agreement upon written notice.</p>
<p class="ind"><b>Lease Services.</b> During the Term, the Agent shall have the exclusive right to render leasing services for all Units, per a separate brokerage agreement. Lease Rates shall not decrease by more than 3% year-over-year absent the Client's prior written approval. On any lease renewal, the Client shall pay the Agent 15% of the increase between the renewed and prior annual rent, due upon the first month of the renewed occupancy.</p>
<p class="ind"><b>Transfer Services.</b> For any transfer of leasehold managed by the Agent, including in connection with an eviction, the Client shall pay the Agent a transfer fee per the attached Fee Schedule, due on the first day of the month following the month such service was rendered.</p>
<p class="ind"><b>Financing Services.</b> For any mortgage, refinancing, or credit line for which the Agent serves as broker, the Client shall pay the Agent (i) 1% of the first $1,000,000 of financing, plus (ii) 0.5% of any amount above $1,000,000. Where the Agent provides supporting documentation but does not serve as broker, the Client shall pay the Agent 0.33% of the total financing amount.</p>
<p class="ind"><b>Hearing Services.</b> For any civil, criminal, arbitration, mediation, environmental, or other hearing at which Agent personnel appear on the Client's behalf, the Client shall pay the Agent $150 per hour, including travel time.</p>
<p class="ind"><b>Audit Services.</b> For any Client-organized audit managed by the Agent, the Client shall pay the Agent $150 per hour.</p>
<p class="ind"><b>Pre-Occupation Services.</b> For services rendered prior to a Unit's occupancy, the Client shall pay the Agent $150 per hour.</p>
<p class="ind"><b>Emergency Services.</b> The Agent shall maintain personnel at the Property during the rendering of any Emergency Service and shall be paid $150 per hour, payable immediately, from the Client Accounts to the extent not covered by insurance. The Agent shall maintain a roster of vetted emergency contractors (plumbers, electricians, HVAC technicians) and solicit standard rates from each. The Agent may cease Emergency Services upon the Client's written notice, and may, at its discretion, terminate this Agreement upon such notice.</p>
<p class="ind"><b>Extraordinary Project Services.</b> For any construction project requiring immediate or short-notice commencement, the Agent shall manage the project for a fee of 20% of project cost, due on the first day of the month following the month such services were rendered, paid from the Client Accounts to the extent not covered by insurance. Extraordinary Project Services shall be treated as Emergency Services for purposes of this Agreement.</p>`);

  const articleX = article('X', 'Additional Fees &amp; Supplemental Services', `
<p class="ind"><b>Supplemental Fees.</b> Separately from the Compensation, the Agent may bill and collect from a lease applicant an Application Review fee of $200 (or the maximum amount permissible under applicable law), and from a Tenant requesting alterations, an Alteration Review fee of $500 (together, the "Supplemental Services"). The Agent has the sole right to perform and approve Supplemental Services; if the Client engages a third party without the Agent's written consent, the Client shall pay the Agent the fees it would otherwise have earned.</p>
<p class="ind"><b>Reimbursable Expenses.</b> The Agent shall be reimbursed for all Reimbursable Expenses, due on the first day of the month following the month incurred, in accordance with the Payment Instructions.</p>
<p class="ind"><b>Additional Client Fees.</b> At the Client's request, and subject to the Payment Instructions, the Agent will also, for a fee: (i) process and file Forms 1098/1099 ($25 per form); (ii) prepare and file the Real Property Income and Expense (RPIE) form or RPIE-Exception form ($400 per filing, with tax certiorari proceedings retained by and coordinated through the Client's own counsel); (iii) process applications for applicable tax abatement or rebate programs and administer distribution of any rebate; (iv) establish and maintain Client Accounts; and (v) administer Employee payroll, with full reimbursement of payroll service fees where paid by the Agent on the Client's behalf.</p>
<p class="ind"><b>Client Responsibility for Third-Party Fees.</b> Any bank lockbox, online-payment, or similar fees incurred in connection with the Client's title to the Property shall be paid directly from the Client's operating account, and the Agent shall have no obligation to perform services beyond the Services absent a separate written agreement.</p>
<p class="ind"><b>Ancillary Fee Sheet.</b> Except as set forth above, the Parties shall be governed by the Ancillary Fee Sheet attached to this Agreement.</p>`);

  const articleXI = article('XI', 'Personnel', `
<p class="ind"><b>Hiring and Supervision.</b> The Agent shall hire, pay, and supervise all Employees necessary to properly maintain and operate the Property, and may discharge Employees with the Client's prior approval. The Agent shall perform these duties consistent with the Client's obligations under any applicable Union Contract. Upon termination of this Agreement, the Agent may reassign Employees to other properties it manages.</p>
<p class="ind"><b>Non-Solicitation.</b> For nine (9) months following termination of this Agreement, the Client shall not solicit, induce, or hire any person who is or was an Employee of the Agent, unless (i) such person has not been reassigned by the Agent within four (4) weeks of termination, or (ii) the Client pays the Agent 25% of that person's annual salary as a lump sum. Within ten (10) days of termination, the Agent shall furnish the Client a list of Employees covered by this provision.</p>`);

  const articleXII = article('XII', 'Financial Administration', `
<p class="ind"><b>Late Payment Interest.</b> Invoices for emergency work or project management services remaining unpaid more than thirty (30) days from submission shall accrue interest at 1.5% per month, compounded monthly, until paid in full.</p>
<p class="ind"><b>Commission Handling.</b> All commissions, including brokerage commissions, shall be made payable to the Agent first. Net proceeds, after deduction of fees or expenses owed the Agent, shall then be paid to the Client in accordance with the Payment Instructions. The Agent's fees for related services shall be separately invoiced under this Agreement.</p>
<p class="ind"><b>Document Management and Retention.</b> The Agent shall use commercially reasonable efforts to scan and digitally store Client-provided documents and is not obligated to retain physical copies after scanning, absent written instruction otherwise. The Client acknowledges that documents are accepted "as-is," without a duty to verify historical completeness. The Agent shall retain electronic copies for seven (7) years from receipt, after which it may securely dispose of records absent written instruction otherwise. Unless the Client directs otherwise in writing within thirty (30) days of the Agent's receipt of physical documents, the Agent may securely dispose of them following digital archiving.</p>
<p class="ind"><b>Limitation of Liability for Documents.</b> The Agent's liability for loss, destruction, misplacement, or corruption of documents shall not exceed $10,000 in the aggregate per occurrence, except in cases of willful misconduct or fraud. The Client shall indemnify and hold the Agent harmless from claims arising from the loss or unavailability of any document, unless caused by the Agent's willful misconduct or gross negligence.</p>`);

  const articleXIII = article('XIII', 'Authority', `<p class="body">The Client authorizes the Agent, on its behalf, to perform any act reasonably necessary to render the Services and Additional Services, subject to the limitations herein. Obligations and expenses so incurred shall be at the Client's expense, except for the Agent's own overhead expenses. The Agent shall not be obligated to advance funds on the Client's behalf except from funds held or provided for that purpose; if the Agent voluntarily advances such funds, the Client shall reimburse the Agent on demand.</p>`);

  const articleXIV = article('XIV', 'Bank Accounts', `
<ul class="blt">
<li>The Agent shall establish and maintain Client Accounts as necessary to perform its obligations hereunder.</li>
<li>Each Client Account shall designate that it is held on the Client's behalf.</li>
<li>Any transfer of $10,000 or more from a Client Account requires the Client's prior written approval and two authorized signatories.</li>
<li>Upon request, the Agent shall provide the Client an account agreement covering the Client Accounts, in form reasonably satisfactory to the Client.</li>
<li>Upon request, the Agent shall inform the Client of the balances held in the Client Accounts.</li>
<li>The Agent shall maintain a separate security deposit account, used solely to hold and return Tenant security deposits.</li>
</ul>`);

  const articleXV = article('XV', 'Licenses', `<p class="body">The Agent represents that it is duly licensed by the New York Department of State as a real estate broker, sufficient to lawfully perform its duties under this Agreement.</p>`);

  const articleXVI = article('XVI', 'Notices &amp; Miscellaneous', `<p class="body">All notices under this Agreement shall be in writing and effective only if (i) served personally, (ii) sent by nationally recognized overnight courier, or (iii) sent by certified or registered mail, addressed to the recipient's address first written above. Either Party may designate a substitute address by notice given in accordance with this Article; a change of address is effective only upon actual receipt. The Agent affirms it has no relationship or affiliation with the Client.</p>`);

  const articleXVII = article('XVII', 'Governing Law', `<p class="body">This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to conflict-of-law principles.</p>`);

  const articleXVIII = article('XVIII', 'Entire Agreement', `<p class="body">This Agreement constitutes the entire agreement between the Parties and may not be amended orally. It shall bind and inure to the benefit of the Parties and their successors, and may not be assigned by either Party without the other's prior written consent.</p>`);

  const articleXIX = article('XIX', 'Independent Contractor', `<p class="body">The Agent's relationship to the Client under this Agreement is that of an independent contractor. Nothing herein shall be construed to create a partnership, joint venture, or employer-employee relationship. Except as set forth herein, the Agent is not authorized to act on the Client's behalf or represent otherwise to any third party. Neither the Agent nor its employees are eligible for benefits the Client makes available to its own employees; the Client will not withhold or contribute to social security, unemployment, or disability insurance on the Agent's behalf; and the Agent is solely responsible for its own tax filings and payments arising from fees paid under this Agreement.</p>`);

  const articleXX = input.specialTerms?.trim()
    ? article('XX', 'Special Terms', `<p class="body">${esc(input.specialTerms.trim()).replace(/\n/g, '<br/>')}</p>`)
    : '';

  // ---- Page shell helper: identical letterhead + gold border + footer on every page ----
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

  // ---- Page 1: title cover page (property photo + address headline) ----
  const coverPage = pageWrap(`
<div class="cover-wrap">
  <h1 class="cover-addr">${coverAddrLine1}</h1>
  <h2 class="cover-citystate">${coverAddrLine2}</h2>

  ${coverPhotoSrc ? `<div class="cover-photo-box"><img src="${coverPhotoSrc}" alt="${addrDisplay}" /></div>` : ''}

  ${coverMetaLine}

  <p class="cover-doctype">Residential Rental Property Management Agreement</p>
  <p class="cover-dateprep">Date: ${effDateLong}&nbsp;&nbsp;&nbsp;Prepared for: ${clientEntity}</p>
  <p class="cover-version">Version 01.</p>
</div>
`);

  // ---- Page 2: legal preamble + map + property overview ----
  const preamblePage = pageWrap(`
<p class="body">THIS AGREEMENT (the "Agreement") is made as of this ${effDay} day of ${effMonth}, ${effYear} (the "Effective Date"), by and between <b>${clientEntity}</b>, having its principal office at ${input.clientAddress || '[CLIENT ADDRESS]'} ("Client"), and <b>CAMELOT PROPERTY MANAGEMENT SERVICES CORP.</b>, a New York corporation, having its principal office at ${CAMELOT_OFFICE.address} (the "Agent," and together with the Client, the "Parties," and each a "Party").</p>
<p class="body">WHEREAS, the Client owns certain real property known as and located at ${addrDisplay} (the "Property"), consisting of one (1) residential rental building and ${unitsText} rental units; and</p>
<p class="body">WHEREAS, the Client desires to engage the Agent to perform the Services and the Additional Services (as defined herein) in connection with the rental units at the Property, and the Agent desires to be so engaged;</p>
<p class="body">NOW, THEREFORE, for good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:</p>

${mapBlock}
${extraImages}
${intelBlock}
`);

  // ---- Article pages, generously split so no page overflows its own div ----
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

  // ---- Signature page ----
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

  // ---- Schedule A — Fee Schedule ----
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
<tr><td>Locksmith</td><td class="fee-amt">$150.00 per hour + materials + 20% markup</td></tr>
<tr><td>Supplies &amp; Material Markups</td><td class="fee-amt">10% overhead + 10% profit, billed monthly</td></tr>
<tr><td>Pre-Occupation Services</td><td class="fee-amt">$150.00 per hour</td></tr>
<tr><td>Court Appearance or Deposition</td><td class="fee-amt">$150.00 per hour</td></tr>
<tr><td>Application Review</td><td class="fee-amt">$200.00 per application</td></tr>
<tr><td>RPIE Filing (Real Property Income &amp; Expense)</td><td class="fee-amt">$400 per filing</td></tr>
<tr><td>Rent Registration Filing (per building)</td><td class="fee-amt">$500.00 per building, per year</td></tr>
<tr><td>Boiler Inspection Filing &amp; Administration (DOB/FDNY)</td><td class="fee-amt">Required filing fees at cost</td></tr>
<tr><td>Elevator Inspection Filing &amp; Administration (DOB)</td><td class="fee-amt">Required filing fees at cost</td></tr>
</table>
<p class="sched-note">These fees are one-time or occurrence-based, applied as needed by the Client.</p>
`, { scheduleTitle: 'Schedule A &mdash; Fee Schedule' });

  // ---- Schedule B — Ancillary Fee Sheet ----
  const scheduleBPage = pageWrap(`
<table class="fee">
<tr><th>Service</th><th style="text-align:right">Fee</th></tr>
<tr><td>Alteration Fee</td><td class="fee-amt">$500.00</td></tr>
<tr><td>Tax Abatement / Rebate Program Filing</td><td class="fee-amt">$200 per building filing</td></tr>
<tr><td>Audit Review and Assistance</td><td class="fee-amt">$150.00 per hour</td></tr>
<tr><td>Tax Forms 1098 / 1099</td><td class="fee-amt">$25 per form filed</td></tr>
<tr><td>Monthly Administrative Fee (copies, messenger, mailings, data filings, cloud &amp; physical storage)</td><td class="fee-amt">$200.00 per month</td></tr>
<tr><td>Alteration Agreement Review and Submittal</td><td class="fee-amt">$500, or 10% of alterations over $5,000</td></tr>
<tr><td>Sales or Rental Package Review</td><td class="fee-amt">$500 per package</td></tr>
<tr><td>HPD Filing Fee</td><td class="fee-amt">$50.00 (once per year)</td></tr>
<tr><td>Emergency Site Plan Creation &amp; Submittal</td><td class="fee-amt">$175.00</td></tr>
<tr><td>Bank &amp; Insurance Questionnaire Fee</td><td class="fee-amt">$200.00</td></tr>
</table>
`, { scheduleTitle: 'Schedule B &mdash; Ancillary Fee Sheet' });

  // ---- Schedule C — Camelot's Insurance Coverage ----
  const scheduleCPage = pageWrap(`
<p class="body">For the Client's information, Camelot Property Management Services Corp. DBA Camelot Realty Group carries the following lines of insurance as a company. This summary is provided for general informational purposes only &mdash; it is not a Certificate of Insurance and does not modify, replace, or expand any actual policy. All coverage remains subject to the full terms, conditions, exclusions, and limits of the underlying policies. A formal Certificate of Insurance is available upon request.</p>
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
<title>Camelot Rental Management Agreement — ${addrDisplay}</title>
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

/* Letterhead (unchanged house mark, appears on every page) */
.letterhead{display:flex;align-items:center;gap:12px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #8a867e}
.letterhead img{width:44px;height:44px}
.lh-text{flex:1}
.lh-name{font-size:14px;font-weight:700;color:#1B2A4A;letter-spacing:0.5px;margin:0}
.lh-services{font-size:7.5px;color:#6B675F;letter-spacing:1px;margin:1px 0}
.lh-tag{font-size:9px;color:#A9814A;font-style:italic;margin:2px 0}

/* Cover page: address is the headline, HGMaruGothicMPRO / blue accent1 darker25% */
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

/* Article headings — Heading 1 (ARTICLE N): Georgia, 12pt, dark gold, border line beneath.
   Section title — Heading 2 (e.g. "Definitions"): Georgia, dark gold, centered. */
h2.art{font-family:${HEADING_FONT};font-size:12pt;font-weight:700;color:${DARK_GOLD};text-align:center;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1.5pt solid ${GOLD_RULE};padding:12pt 0 6pt;margin:20pt 0 0;page-break-after:avoid}
h3.art-sub{font-family:${HEADING_FONT};font-size:11pt;font-weight:700;color:${DARK_GOLD};text-align:center;letter-spacing:0.5px;margin:6pt 0 10pt;padding:0;page-break-after:avoid}
/* The first article heading on a page shouldn't hug the letterhead — give
   it real breathing room so it reads as centered between header and
   footer rather than pinned to the top. Only the first article-block on
   each page gets the extra push; a second/third stacked article on the
   same page keeps the tighter 20pt spacing above. */
.page-content > .article-block:first-of-type > h2.art{margin-top:64pt}

/* Body text — Arial, 9pt, not bold, everywhere below Heading 2 */
p.body{font-family:${BODY_FONT};font-size:9pt;font-weight:400;color:${BODY_BLACK};margin-bottom:8pt;text-align:justify}
p.ind{font-family:${BODY_FONT};font-size:9pt;font-weight:400;color:${BODY_BLACK};margin:0 0 7pt 18pt;text-align:justify}
p.deflist{font-family:${BODY_FONT};font-size:9pt;font-weight:400;color:${BODY_BLACK};margin-bottom:8pt;text-align:justify}
p.deflist b{font-weight:700;color:${BODY_BLACK}}
ul.blt{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};margin:0 0 8pt 24px}
ul.blt li{margin-bottom:4pt;text-align:justify}

/* Map (preamble page) */
.loc-strip{display:flex;gap:12px;margin:12px 0;align-items:stretch}
.loc-map{flex:0 0 45%;border:1px solid #d8d4cb;border-radius:3px;overflow:hidden}
.loc-map iframe{width:100%;height:100%}
.loc-text{flex:1}
.loc-title{font-family:${HEADING_FONT};font-size:10pt;font-weight:700;color:#1B2A4A;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4pt;border-bottom:1px solid #C9A55C;padding-bottom:2pt;display:inline-block}
.loc-text p{font-family:${BODY_FONT};font-size:9pt;text-align:justify;color:${BODY_BLACK}}

/* Property Overview */
.intel{margin:0 0 12px;page-break-inside:avoid}
.intel ul{margin:3px 0 5px 20px}
.intel li{font-family:${BODY_FONT};font-size:9pt;color:${BODY_BLACK};margin-bottom:2pt}
.intel-src{font-family:${BODY_FONT};font-size:8pt;color:#9b968b;font-style:italic}

.photo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}
.photo-grid img{width:100%;height:80px;object-fit:cover;border:1px solid #d8d4cb;border-radius:2px}

/* Tables */
table.fee{width:100%;border-collapse:collapse;font-family:${BODY_FONT};font-size:9pt;margin:8pt 0 5pt}
table.fee th{background:#1B2A4A;color:#fff;text-align:left;padding:6pt 8pt;font-size:8.5pt;letter-spacing:0.5px;text-transform:uppercase}
table.fee td{padding:6pt 8pt;border-bottom:1px solid #e8e5de;font-weight:400}
table.fee tr:nth-child(odd) td{background:#F7F4EC}
td.fee-amt{white-space:nowrap;font-weight:700;color:#1B2A4A}
.sched-note{font-family:${BODY_FONT};font-size:8.5pt;font-style:italic;color:#6B675F;margin:5pt 0 0}

/* Signature page */
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

/* Schedules */
.sched-title{font-family:${HEADING_FONT};font-size:13pt;font-weight:700;color:#1B2A4A;text-align:center;letter-spacing:1px;margin:0 0 10pt;text-transform:uppercase}
.avoid-break{page-break-inside:avoid}
.article-block{page-break-inside:avoid}

/* Footer — Arial, 8pt, standard black, on every page */
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
