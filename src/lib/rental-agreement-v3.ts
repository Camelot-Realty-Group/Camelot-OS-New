/**
 * Camelot Rental Management Agreement — HTML generator.
 *
 * Mirrors the Word master template exactly: same letterhead header and
 * contact footer on every page, centered dark-gold article titles,
 * Articles I–XIX (plus optional XX) verbatim, single signature page with
 * both parties, and Schedules A/B/C with real Camelot rates.
 *
 * IMPORTANT: every logical page is its own `.page` div with NO fixed
 * height / overflow:hidden — that combination silently clips content in
 * both screen and print rendering. Pages use `min-height` only, so any
 * page whose content runs long simply continues onto an extra physical
 * page instead of disappearing.
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

  const unitsText = input.units ? `${input.units}` : '[NUMBER OF UNITS]';

  // ---- Article content, chunked into page-sized groups so nothing relies
  // ---- on a single oversized div (which is what silently ate the pages). ----

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
<p class="ind"><b>Compensation Deductions.</b> To the extent Client Accounts are adequately funded, the Agent may deduct Compensation directly from Client Accounts in accordance with the Payment Instructions.</p>`);

  const articleVI = article('VI', "Agent's Duties (the Services)", `<p class="body">As consideration for the Compensation, during the Term the Agent shall perform the following Services on the Client's behalf: maintain the Property in proper condition, conduct regular inspections, address violations, manage utilities and service contracts, purchase necessary supplies, review and pay all bills and assessments, collect rent, keep accurate records, provide monthly statements, and maintain 24-hour emergency contact.</p>
<p class="ind"><b>Violations.</b> The Agent shall recommend, and upon the Client's approval cause, remediation of any violations issued by a governmental authority with jurisdiction over the Property.</p>
<p class="ind"><b>Books and Records.</b> The Agent shall maintain orderly corporate books, checkbooks, rent records, insurance policies, leases, correspondence, receipted bills, cancelled checks, and other records relating to the Property, and shall make such records available to the Client upon reasonable request.</p>`);

  const articleVII = article('VII', 'Insurance', `<p class="ind"><b>Agent's Insurance.</b> The Agent shall maintain commercial general liability, workers' compensation, professional liability, and employment practices liability insurance.</p>
<p class="ind"><b>Client's Insurance.</b> The Client shall maintain fire, multi-peril, general liability, workers' compensation, and statutory disability coverage on the Property, and shall name the Agent as an additional insured where reasonably required.</p>`);

  const articleVIII = article('VIII', 'Indemnification &amp; Limitation of Liability', `
<p class="ind"><b>Client Indemnification.</b> The Client shall indemnify and hold the Agent harmless from and against (a) any liability, claim, or expense arising from the Property or the Agent's performance of this Agreement, except for claims caused by the Agent's negligence or willful misconduct, and (b) reasonable attorneys' fees incurred in defending any such claim. The indemnification obligations under this Article shall survive termination of this Agreement for five (5) years.</p>
<p class="ind"><b>Limitation of Liability.</b> In no event shall the Agent be liable to the Client for consequential, incidental, special, or punitive damages, and the Agent's aggregate liability under this Agreement shall not exceed the Services Compensation paid to the Agent during the twelve (12) months preceding the claim.</p>`);

  const articleIX = article('IX', 'Additional Services', `<p class="body">The Agent may provide Additional Services including Lease Services, Transfer Services, Financing Services, Hearing Services, Audit Services, Pre-Occupation Services, Emergency Services, and Extraordinary Project Services, each at rates specified in the Fee Schedule.</p>
<p class="ind"><b>Transfer Services.</b> For any transfer of leasehold managed by the Agent, including in connection with an eviction, the Client shall pay the Agent a transfer fee per the Fee Schedule.</p>
<p class="ind"><b>Emergency Services.</b> The Agent shall respond to Emergency Services requests on a 24-hour basis and may incur reasonable Reimbursable Expenses in doing so, which shall be billed to the Client in accordance with the Payment Instructions.</p>`);

  const articleX = article('X', 'Additional Fees &amp; Supplemental Services', `<p class="body">The Agent may bill for supplemental services including Application Review ($200) and Alteration Review ($500). All Reimbursable Expenses are due on the first day of the month following the month incurred.</p>
<p class="ind"><b>Additional Client Fees.</b> At the Client's request, and subject to the Payment Instructions, the Agent will also, for a fee: (i) process and file Forms 1098/1099 ($25 per form filed); (ii) prepare emergency site plans ($175.00); and (iii) complete bank and insurance questionnaires ($200.00).</p>`);

  const articleXI = article('XI', 'Personnel', `<p class="body">The Agent shall hire, pay, and supervise all Employees necessary to properly maintain and operate the Property. For nine (9) months following termination, the Client shall not solicit or hire any Agent employee without payment of 25% of that person's annual salary.</p>
<p class="ind"><b>Hiring and Supervision.</b> The Agent shall have sole authority to hire, discharge, and supervise Employees, subject to any applicable Union Contract.</p>`);

  const articleXII = article('XII', 'Financial Administration', `<p class="body">Invoices for emergency work or project management services remaining unpaid more than thirty (30) days from submission shall accrue interest at 1.5% per month. All commissions shall be made payable to the Agent first, with net proceeds then paid to the Client.</p>`);

  const articleXIII = article('XIII', 'Authority', `<p class="body">The Client authorizes the Agent, on its behalf, to perform any act reasonably necessary to render the Services and Additional Services, subject to the limitations herein.</p>`);

  const articleXIV = article('XIV', 'Bank Accounts', `
<ul class="blt">
<li>The Agent shall establish and maintain Client Accounts as necessary to perform its obligations hereunder.</li>
<li>Each Client Account shall designate that it is held on the Client's behalf.</li>
<li>Any transfer of $10,000 or more from a Client Account requires the Client's prior written approval and two authorized signatories.</li>
<li>The Agent shall maintain a separate security deposit account, used solely to hold and return Tenant security deposits.</li>
</ul>`);

  const articleXV = article('XV', 'Licenses', `<p class="body">The Agent represents that it is duly licensed by the New York Department of State as a real estate broker, sufficient to lawfully perform its duties under this Agreement.</p>`);

  const articleXVI = article('XVI', 'Notices &amp; Miscellaneous', `<p class="body">All notices under this Agreement shall be in writing and effective only if served personally, sent by nationally recognized overnight courier, or sent by certified or registered mail, to the address of the applicable Party set forth herein, or such substitute address by notice given in accordance with this Article; a change of address is effective only upon actual receipt. The Agent affirms it has no relationship with any party to this Agreement other than as expressly set forth herein.</p>`);

  const articleXVII = article('XVII', 'Governing Law', `<p class="body">This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to conflict-of-law principles.</p>`);

  const articleXVIII = article('XVIII', 'Entire Agreement', `<p class="body">This Agreement constitutes the entire agreement between the Parties and may not be amended orally. It shall bind and inure to the benefit of the Parties and their successors, and may not be assigned by either Party without the other's prior written consent.</p>`);

  const articleXIX = article('XIX', 'Independent Contractor', `<p class="body">The Agent's relationship to the Client under this Agreement is that of an independent contractor. Except as set forth herein, the Agent is not authorized to act on the Client's behalf or represent otherwise to any third party. Neither the Agent nor its employees are eligible for benefits the Client makes available to its own employees; the Client will not withhold or contribute to social security, unemployment, or disability insurance on the Agent's behalf; and the Agent is solely responsible for its own tax filings and payments arising from fees paid under this Agreement. Nothing herein shall be construed to create a partnership, joint venture, or employer-employee relationship.</p>`);

  const articleXX = input.specialTerms?.trim()
    ? article('XX', 'Special Terms', `<p class="body">${esc(input.specialTerms.trim()).replace(/\n/g, '<br/>')}</p>`)
    : '';

  // ---- Page shell helper: identical letterhead + gold border + footer on every page ----
  let pageCounter = 0;
  const totalPagesPlaceholder = '__TOTAL_PAGES__';
  const pageWrap = (bodyHtml: string, opts?: { signature?: boolean; scheduleTitle?: string }) => {
    pageCounter += 1;
    const n = pageCounter;
    return `
<div class="page">
<div class="page-content">

<div class="letterhead">
  <img src="${RENTAL_AGREEMENT_LOGO_B64}" alt="Camelot" />
  <div class="lh-text">
    <div class="lh-name">CAMELOT REALTY GROUP</div>
    <div class="lh-services">REAL ESTATE &middot; PROPERTY MGMT &middot; BROKERAGE &middot; INVESTMENT SERVICES</div>
    <div class="lh-tag">New Yorkers Working for New Yorkers <span style="font-style:normal;font-size:7px">EST. 2006</span></div>
  </div>
</div>

${opts?.scheduleTitle ? `<div class="sched-title">${opts.scheduleTitle}</div>` : ''}
${bodyHtml}

</div><!-- .page-content -->
<div class="pf">
  <div class="pf-left">${CAMELOT_OFFICE.address} &middot; ${CAMELOT_OFFICE.phone}</div>
  <div class="pf-center"><span class="pf-conf">CONFIDENTIAL &mdash; ${version} &mdash; ${dateStr}</span></div>
  <div class="pf-right">Page ${n} of ${totalPagesPlaceholder}</div>
</div>
</div><!-- .page -->`;
  };

  // ---- Page 1: cover ----
  const coverPage = pageWrap(`
<h1 class="title">Camelot Rental Management Agreement</h1>

${coverImage}

<p class="body">THIS AGREEMENT (the "Agreement") is made as of this ${effDay} day of ${effMonth}, ${effYear} (the "Effective Date"), by and between <b>${clientEntity}</b>, having its principal office at ${input.clientAddress || '[CLIENT ADDRESS]'} ("Client"), and <b>CAMELOT PROPERTY MANAGEMENT SERVICES CORP.</b>, a New York corporation, having its principal office at ${CAMELOT_OFFICE.address} (the "Agent," and together with the Client, the "Parties," and each a "Party").</p>
<p class="body">WHEREAS, the Client owns certain real property known as and located at ${addrDisplay} (the "Property"), consisting of one (1) residential rental building and ${unitsText} rental units; and</p>
<p class="body">WHEREAS, the Client desires to engage the Agent to perform the Services and the Additional Services (as defined herein) in connection with the rental units at the Property, and the Agent desires to be so engaged;</p>
<p class="body">NOW, THEREFORE, for good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:</p>

${mapBlock}
${extraImages}
${intelBlock}
`);

  // ---- Article pages, grouped so no single page is overloaded ----
  const articlePage2 = pageWrap(`${articleI}${articleII}${articleIII}`);
  const articlePage3 = pageWrap(`${articleIV}${articleV}`);
  const articlePage4 = pageWrap(`${articleVI}${articleVII}${articleVIII}`);
  const articlePage5 = pageWrap(`${articleIX}${articleX}${articleXI}`);
  const articlePage6 = pageWrap(`${articleXII}${articleXIII}${articleXIV}`);
  const articlePage7 = pageWrap(`${articleXV}${articleXVI}${articleXVII}`);
  const articlePage8 = pageWrap(`${articleXVIII}${articleXIX}${articleXX}`);

  // ---- Signature page ----
  const signaturePage = pageWrap(`
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
`, { signature: true });

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
<tr><td>Alteration Review</td><td class="fee-amt">$500.00, or 10% of alterations over $5,000</td></tr>
</table>
<p class="sched-note">Rates above apply to Additional Services referenced in Article IX and Article X. All fees are subject to the Payment Instructions in Article V.</p>
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
    articlePage2,
    articlePage3,
    articlePage4,
    articlePage5,
    articlePage6,
    articlePage7,
    articlePage8,
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
body{font-family:Georgia,'Times New Roman',serif;color:#221F1A;font-size:12px;line-height:1.6;background:#f5f0e5}
@page{size:8.5in 11in;margin:0.75in}
@media print{body{background:white}}
@media screen{
  .page{margin:20px auto;box-shadow:0 2px 10px rgba(0,0,0,0.1);background:white}
}
.page{width:8.5in;min-height:11in;padding:0.75in 0.75in 1.1in 0.75in;margin:20px auto;border:2px solid #B8960F;page-break-after:always;position:relative;background:white}
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
.sig-page{padding-top:8px;text-align:center}
.sig-head{font-size:13px;font-weight:700;color:#1B2A4A;letter-spacing:2px;margin-bottom:8px;text-transform:uppercase}
.sig-wit{margin:0 auto 20px;max-width:600px}
.sig-witness{font-style:italic;font-size:11px}
.sig-party{font-size:11px;font-weight:700;color:#1B2A4A;letter-spacing:2px;margin:28px 0 20px;text-transform:uppercase}
.sig-field{margin-bottom:10px;font-size:11px}
.sig-field b{color:#221F1A;font-weight:700}
.sig-rule{width:70%;margin:24px auto;border-bottom:1px solid #C9A55C}

/* Schedules */
.sched-title{font-size:13px;font-weight:700;color:#1B2A4A;text-align:center;letter-spacing:1px;margin:0 0 10px;text-transform:uppercase}
.avoid-break{page-break-inside:avoid}
.article-block{page-break-inside:avoid}

/* Footer */
.pf{margin-top:16px;padding-top:6px;border-top:1px solid #B8960F;text-align:center;font-size:8px;color:#6B675F;display:flex;justify-content:space-between;align-items:center}
.pf-left{text-align:left;flex:0 0 50%}
.pf-center{flex:1;text-align:center}
.pf-right{text-align:right;flex:0 0 auto;white-space:nowrap}
.pf-conf{font-size:7px;color:#9b968b}

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
