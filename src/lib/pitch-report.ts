import { GOOGLE_MAPS_KEY } from '@/lib/maps-key';
/**
 * Camelot OS - External Pitch Deck (Slide Format)
 * Matches the 155-24 89th Street reference deck design exactly.
 * 16:9 widescreen slides, charcoal cover, cream content, gold accents.
 * 
 * All data is 100% dynamic - pulled live from NYC APIs per address.
 */

import {
  CAMELOT_279_CPW_MANAGEMENT_TO_VERIFY,
  normalize279CentralParkWestReportData,
  normalize36East22ndStreetReportData,
  is36East22ndStreetSubject,
  type MasterReportData,
} from './camelot-report';
import { DAVID_GOLDOFF_SIGNATURE_IMAGE, DAVID_GOLDOFF_SIGNATURE_TEXT } from './camelot-signature';
import { applyJackieFactAuthority, sanitizeJackieKnownPropertyHtml } from './jackie-fact-authority';

export type JackieReportPackage = 'first_email_intro' | 'board_meeting_deck' | 'appendix_full';

export const JACKIE_REPORT_PACKAGES: Array<{ key: JackieReportPackage; label: string; pages: string; description: string }> = [
  { key: 'first_email_intro', label: 'First Email Intro', pages: '6-8 pages', description: 'Short board-safe teaser for first outreach.' },
  { key: 'board_meeting_deck', label: '1st Meeting Handout', pages: '15 pages', description: 'Main presentation for first board/ownership meetings.' },
  { key: 'appendix_full', label: 'Appendix: Full Jackie Report', pages: 'Full appendix', description: 'Complete source-backed internal and diligence packet.' },
];

const CAMELOT_EXECUTIVE_TEAM = [
  { name: 'David Goldoff', title: 'Founder & President', note: 'Owner-minded leadership, client relationships, compliance strategy', photo: 'https://www.camelot.nyc/wp-content/uploads/2026/03/david_headshot.jpg' },
  { name: 'Valerie Ann Fiume', title: 'Director of Co-Ops & Condos / Vice President', note: 'Board operations, resident relations, property management execution', photo: 'https://camelot.realtymx.com/images/agents/4.jpg' },
  { name: 'Dominic Martiano', title: 'Vice President of Operations', note: 'Building operations, staffing, vendor performance, service delivery', photo: '' },
  { name: 'Dion', title: 'Vice President of Management', note: 'Portfolio management, board partnership, day-to-day execution', photo: '' },
  { name: 'Michael', title: 'Vice President, Controller & Financial Services', note: 'Controller-level oversight, financial services, reporting discipline', photo: '' },
  { name: 'Anthony Abruzzo, CPA', title: 'Chief Financial Officer, Senior Managing Tax Director', note: 'Financial controls, tax, reporting, accounting oversight', photo: 'https://camelot.realtymx.com/images/agents/12.jpg' },
  { name: 'Steven Milewicz', title: 'Chief Legal Officer, M&A', note: 'Legal guidance, transactions, acquisitions, governance support', photo: '/images/team/steven-milewicz.jpeg' },
  { name: 'Robert Isaacs', title: 'Senior Managing Director, Asset Management & Compliance', note: 'Asset management, compliance, risk and operating standards', photo: '/images/team/robert-isaacs.jpg' },
  { name: 'Anthony Tavaglione', title: 'Senior Controller & Accounting Manager', note: 'Controller-level reporting, accounting workflows, monthly close support', photo: 'https://www.camelot.nyc/wp-content/uploads/2026/03/anthony_tavaglione.jpg' },
  { name: 'Tim Kelly', title: 'Senior Facility Manager', note: 'Facilities, field operations, staff/vendor coordination', photo: 'https://camelot.realtymx.com/images/agents/50.jpg' },
  { name: 'Eleni Palmeri', title: 'Licensed Real Estate Salesperson', note: 'Sales, leasing, resident-facing market support', photo: 'https://www.camelot.nyc/wp-content/uploads/2026/03/eleni-palmeri-headshot.jpg' },
  { name: 'Jan Cohen', title: 'Expeditor and Registered Real Estate Agent', note: 'Permits, filings, agency follow-up, expediting support', photo: 'https://www.camelot.nyc/wp-content/uploads/2026/03/jan_cohen.jpg' },
];

const CAMELOT_TEAM_SOURCE = 'https://www.camelot.nyc/company-roster/';
const CAMELOT_OUR_TEAM_SOURCE = 'https://www.camelot.nyc/our-team/';
const CAMELOT_CONTACT_NAME = 'David Goldoff';
const CAMELOT_CONTACT_TITLE = 'Founder & President';
const CAMELOT_CONTACT_EMAIL = 'info@camelot.nyc';
const CAMELOT_GENERAL_EMAIL = 'dgoldoff@camelot.nyc';
const CAMELOT_PHONE = '212-206-9939 ext. 701';
const CAMELOT_WEBSITE = 'www.camelot.nyc';
const CAMELOT_OFFICE_ADDRESS = '57 West 57th Street, Suite 410, New York, NY 10019';
const CAMELOT_JACQUELINE_QUOTE = "";
const CAMELOT_PROFILE = {
  foundedYear: 2006,
  buildingsManaged: 42,
  assetsUnderManagement: '$240M+',
  assetsUnderManagementNote: 'internal estimate to confirm against current Camelot OS / accounting roster',
  unitsTracked: '5,351+',
};

function davidGoldoffClientSignatureHtml(): string {
  // Compact block: the previous 250px signature + 14px top margin pushed the
  // company line past the letter card's max-height, clipping the sign-off.
  return `<div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:12px;color:#1a2744;line-height:1.3"><strong>Sincerely yours,</strong><div style="margin-top:6px"><img src="${DAVID_GOLDOFF_SIGNATURE_IMAGE}" alt="David Goldoff signature" style="display:block;width:200px;max-width:52%;height:auto;margin:0 0 4px 0"><div style="font-size:13px;font-weight:800">David A. Goldoff</div><div style="font-size:11px;color:#333">President, Camelot Property Management Services Corp.</div></div></div>`;
}

function preparedForBlock(d: MasterReportData): string {
  const focus = d.reportFocus;
  const name = String(focus?.inquiryContact || focus?.inquiryOrganization || '').trim();
  const role = String(focus?.inquiryRole || '').trim();
  const email = String(focus?.inquiryEmail || '').trim();
  const phone = String(focus?.inquiryPhone || '').trim();
  // Keep it simple and human: a known contact, a known ownership entity, or
  // just "the Ownership of {address}" — never a data-source label like
  // "Property Owner (DOF)".
  const entity = ownerEntityName(d);
  const preparedFor = name || (entity ? `the Ownership of ${entity}` : `the Ownership of ${d.buildingName || d.address}`);
  const contactParts = [role, email, phone].filter(Boolean);
  return `<div style="margin-top:8px;font-size:12px;color:rgba(255,255,255,.68);line-height:1.45"><strong style="color:#F4D26A">Prepared for:</strong> ${escapeHtml(preparedFor)}${contactParts.length ? ` &middot; ${contactParts.map(escapeHtml).join(' &middot; ')}` : ''}</div>`;
}
const CAMELOT_ASSOCIATIONS = [
  { name: 'NYARM', fullName: 'New York Association of Realty Managers', url: 'https://www.nyarm.com', logo: 'https://www.nyarm.com/logo.gif' },
  { name: 'REBNY', fullName: 'Real Estate Board of New York', url: 'https://www.rebny.com', logo: '/images/associations/rebny-logo.jpeg' },
  { name: 'SPONY', fullName: 'Small Property Owners of New York', url: 'https://www.spony.org', logo: 'https://spony.org/static/logo_sm.png' },
  { name: 'IREM', fullName: 'IREM Greater New York Chapter', url: 'https://iremnyc.org', logo: 'https://iremnyc.org/images/design/IREM_Greater_NYC_Logo.jpg' },
  { name: 'BOMA', fullName: 'BOMA New York', url: 'https://www.bomany.org', logo: 'https://www.bomany.org/uploads/1/4/2/9/142998385/boma-ny-logo-white-08-19-2024-rgb-4x.webp' },
  { name: 'NARPM', fullName: 'National Association of Residential Property Managers', url: 'https://www.narpm.org', logo: 'https://www.narpm.org/wp-content/themes/narpm-new/static/images/logo.png' },
  { name: 'NYAA', fullName: 'New York Apartment Association', url: 'https://www.housing.org', logo: 'https://images.squarespace-cdn.com/content/v1/657b6aee60f6b65fba14db24/b52a2ade-0bb2-4458-9b70-afbaaed428e4/NYAA+Logo.png?format=1500w' },
  { name: 'CNYC', fullName: 'Council of New York Cooperatives and Condominiums', url: 'https://www.cnyc.com', logo: 'https://www.cnyc.com/images/logo_cnyc.gif' },
];
function camelotAssociationLogoGrid(height = 72): string {
  return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${CAMELOT_ASSOCIATIONS.map(a => `<a href="${a.url}" target="_blank" rel="noopener" style="height:${height}px;background:#fff;border:1px solid rgba(184,151,58,.28);border-radius:8px;padding:8px;text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;overflow:hidden"><img src="${a.logo}" alt="${a.fullName}" style="max-width:100%;max-height:${Math.max(28, height - 32)}px;object-fit:contain" onerror="this.style.display='none'"><span style="font-size:8px;color:#1a2744;font-weight:900;text-align:center">${a.name}</span></a>`).join('')}</div>`;
}
const JACKIE_INTELLIGENT_REPORT_NOTE = 'This is an intelligent property introduction developed through Camelot OS. It is designed to be more property-specific, source-aware, and useful than a standard generic introduction.';
const CONCIERGE_PLUS_PRODUCT_SOURCE = 'https://conciergeplus.com/product-suite/';
const CONCIERGE_PLUS_PLATFORM_IMAGE = 'https://pubcdn.conciergeplus.com/wp-content/uploads/2026/05/CP-Platform-Plus-Image-scaled.png';
const CONCIERGE_PLUS_LOGO_IMAGE = 'https://pubcdn.conciergeplus.com/wp-content/uploads/2026/05/PLUS-Logo-01-1024x501.png';
const MDS_LOGO_IMAGE = '/images/partners/mds.svg';
const MDS_SAMPLE_FINANCIAL_REPORT_IMAGE = '/images/partners/mds-sample-financial-report.png';
const BANKUNITED_LOGO_IMAGE = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/BankUnited_logo.svg';
const SELECT_BRAND_IMAGE = 'https://d2e1363xcu3t9u.cloudfront.net/2024/images/share.png';
const PVEDI_LOGO_IMAGE = 'https://static1.squarespace.com/static/640a5c792943d223933618c6/t/682273b3859251242cf33975/1747088307967/PVEDI-E-Blue-V3-RGB.png?format=1500w';
const HOA_ARCHITECTURE_IMAGE = 'https://cdn.dagnysrealestate.com/communities/the-hills-of-monroe-monroe-ct/the-hills-of-monroe-monroe-ct-condominium-4952-w1900.webp';
const HOA_WINDGATE_IMAGE = 'https://cdn.dagnysrealestate.com/homes-for-sale/24161220/t_condo-202-windgate-circle-monroe-ct-0-009d.jpeg';
const HOA_KENSINGTON_IMAGE = 'https://cdn.dagnysrealestate.com/homes-for-sale/24160370/t_townhome-condo-5-kensington-road-monroe-ct-0-5ed6.jpeg';
const HOA_WINTER_IMAGE = 'https://images.unsplash.com/photo-1517299321609-52687d1bc55a?auto=format&fit=crop&w=1600&q=80';
const HOA_INFRASTRUCTURE_IMAGE = 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1600&q=80';
const HOA_DASHBOARD_IMAGE = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80';

const MDS_REPORT_PROOF_POINTS = [
  'Balance Sheet',
  'Income Statement with Budget',
  'Bank Reconciliation',
  'Cash Disbursements Journal',
  'Aged Delinquency Report',
  'Charges & Collections',
  'Paid Invoice Images',
  'Monthly board package cadence: 20th-25th',
];

const ONBOARDING_CHECKLIST = [
  '48-hour bank account: with your tax ID and articles of incorporation, the account is open in the association / entity\u2019s name within 48 hours',
  'Resident roster loaded \u2014 names, numbers, emails \u2014 portal and notices live within the first two weeks',
  'Written transition document issued to the exiting manager; our transition agent runs the checklist with their team',
  'First-30-days data download: service contracts, insurance policies, vendor agreements, governing documents, payroll, common charges / rents / arrears',
  'Resident meet-and-greet \u2014 wine & cheese at the building or a Zoom \u2014 so everyone knows who we are',
  'Vendor walk-throughs on site, and every city agency (HPD, DOB, DOF) renoticed to send all notices to Camelot',
  'Full site inspection with an exterior visual report \u2014 issues you may not be aware of, documented with photos',
  '90-day audit gut-check: what we accomplished, the first board-ready financial package, and an ownership agenda session',
];

const STANDARD_AGREEMENT_PROOF_POINTS = [
  'Custom flat management fee after scope review',
  'Annual escalation discussed and mutually agreed with the board',
  'Additional services are separated from base management compensation',
  'Closing, sublet, alteration, refinance and application services may be charged to the applicable unit owner where permitted',
  'Emergency and special-assignment support can be billed by rate and scope when outside basic services',
];

const PROPERTYSHARK_DILIGENCE_FIELDS = [
  'Owner mailing address / care-of management address',
  'HPD officers, registered owner, managing agent, and prior contact history',
  'DOB permit contacts: owners, applicants, architects, engineers, plumbers, electricians',
  'Unit-level co-op / condo sales and comparable price-per-square-foot signals',
  'Assessment history, current tax bill, tentative tax bill, abatements, and exemptions',
  'Zoning district, zoning map, FAR, max buildable area, and unused air-rights estimate',
  'Historic district / LPC status plus community district, school district, census tract, police and fire proximity',
  'ACRIS document history: deeds, mortgages, satisfactions, assignments, liens, and UCC-style filings',
];

function isHoaExecutiveOpportunity(d: MasterReportData): boolean {
  return d.reportFocus?.selectedFocus?.includes('hoa_recovery') || d.raw?.proposalMode === 'hoa_executive_recovery' || /hills\s+of\s+monroe|monroe,\s*ct|homeowners association|hoa/i.test(`${d.buildingName} ${d.address} ${d.propertyType}`);
}

function isJacksonHeights85th(d: MasterReportData): boolean {
  return /37[-\s]?40\s+85th|37[-\s]?34\s+85th|85th\s+st.*jackson\s+heights|85th\s+street.*11372/i.test(`${d.buildingName || ''} ${d.address || ''}`);
}

function is279CentralParkWestReport(d: Pick<MasterReportData, 'address' | 'buildingName' | 'managementCompany'>): boolean {
  const key = `${d.address || ''} ${d.buildingName || ''} ${d.managementCompany || ''}`.toLowerCase();
  return /(^|[^0-9])279\b/.test(key) && (/\bcpw\b/.test(key) || /\bcentral\s+park\s+w(?:est)?\.?\b/.test(key));
}

function normalizePitchReportData(d: MasterReportData): MasterReportData {
  let normalized = d;
  if (is36East22ndStreetSubject(d.address, d.buildingName, d.managementCompany)) {
    normalized = normalize36East22ndStreetReportData(d);
  } else if (is279CentralParkWestReport(d)) {
    normalized = normalize279CentralParkWestReportData({
      ...d,
      managementCompany: CAMELOT_279_CPW_MANAGEMENT_TO_VERIFY,
    });
  }
  return applyJackieFactAuthority(normalized).data as MasterReportData;
}

const JACKSON_85TH_SCOPE_INCLUDED = [
  'Bill for and collect maintenance, assessments, shareholder charges, and approved building fees',
  'Review, code, and pay mortgage obligations, co-op bills, recurring expenses, and vendor invoices',
  'Bookkeeping plus monthly and annual financial reports for board review',
  'Coordinate with the co-op attorney on collections, governance, notices, and legal follow-up',
  'Coordinate with the co-op accountant on tax return, audit, and year-end package preparation',
  'Manage superintendent / staff payroll, workers comp coordination, and coverage evaluation',
  'Arrange maintenance, repairs, vendor walkthroughs, emergency response, and board updates',
];

const JACKSON_85TH_SEPARATE_SCOPE = [
  'Underlying mortgage refinancing preparation and lender package support after financial review',
  'Local Law 11 / FISP, DOB, HPD, OATH/ECB, boiler, fire-safety, and insurance compliance roadmap',
  'Insurance rebid and deductible review to test controllable savings',
  'Parking, laundry / washer-dryer, move-in/out, sublet, alteration, sale, closing, and document fee schedule review',
  'Project-management scope for capital work, major repairs, or board-approved special assignments',
  'At least five reference contacts supplied under separate cover after permission is confirmed',
];

const JACKSON_85TH_TRANSITION_STEPS: Array<[string, string[]]> = [
  ['Days 1-5', ['Collect prior management report, latest budget, audit, bank statements, mortgage statements, arrears, vendor contracts, insurance, house rules, shareholder roster, minutes, and open legal/compliance files.', 'Confirm board authority, banking workflow, emergency contacts, superintendent coverage, and current management transition timing.']],
  ['Days 6-10', ['Set up the financial baseline: cash position, recurring income, recurring payables, mortgage payment schedule, arrears, reserve position, insurance cost, and vendor spend.', 'Begin insurance, mortgage, tax-abatement, and vendor-cost review so pricing and savings opportunities are tied to real documents.']],
  ['Days 11-20', ['Perform building walkthrough and operations review: common areas, garden/courtyard, roof/basement/mechanicals as access allows, repair rhythm, vendor control, and resident communication.', 'Set up board communication, monthly reporting calendar, AP approvals, emergency process, maintenance request workflow, and practical staffing review.']],
  ['Days 21-30', ['Deliver a board transition memo with fee menu, Schedule B1-style inclusions/exclusions, refinance prep checklist, reference package, vendor priorities, and compliance roadmap.', 'Hold a board meet-and-greet by Zoom or in person to align scope before final contract execution.']],
];

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
}

function clientRecipientLabel(d: MasterReportData): string {
  const type = `${d.propertyType || ''} ${d.buildingClass || ''}`.toLowerCase();
  if (/co-?op|cooperative|condo|condominium|c6|c8|r4/.test(type)) return 'Board Members';
  if (/rental|multifamily|landlord|walk-up|walk up|d[0-9]/.test(type)) return 'Landlord';
  return 'Board and Ownership Team';
}

function ownerEntityName(d: MasterReportData): string {
  const name = String((d as any).registrationOwner || (d as any).dofOwner || '').trim();
  if (!name || /department|dcas|city of new york|housing authority|nycha|state of new york/i.test(name)) return '';
  return name.replace(/\s+/g, ' ');
}

function isGovernmentOwned(d: MasterReportData): boolean {
  return /department|dcas|city of new york|housing authority|nycha|state of new york/i.test(String((d as any).registrationOwner || (d as any).dofOwner || ''));
}

/** Data-aware greeting: never "Dear Landlord" unless we actually know it's a rental. */
function recipientGreeting(d: MasterReportData): string {
  const entity = ownerEntityName(d);
  const type = `${d.propertyType || ''} ${d.buildingClass || ''}`.toLowerCase();
  if (isGovernmentOwned(d)) return 'Dear Facilities and Asset Management Team';
  if (/co-?op|cooperative/.test(type)) return entity ? `Dear Board of Directors of ${entity}` : 'Dear Board of Directors';
  if (/condo/.test(type)) return entity ? `Dear Board of Managers of ${entity}` : 'Dear Members of the Condominium Board';
  if (entity) return `Dear Ownership of ${entity}`;
  return `Dear Ownership of ${d.address}`;
}

function bblLabel(d: MasterReportData): string {
  const raw = String(d.bbl || '').replace(/\D/g, '');
  if (raw.length < 10) return d.bbl ? String(d.bbl) : 'To verify';
  return `Block ${parseInt(raw.slice(1, 6), 10)} / Lot ${parseInt(raw.slice(6, 10), 10)} (BBL ${raw.slice(0, 10)})`;
}

function unitsBreakdownLabel(d: MasterReportData): string {
  const res = Number((d as any).unitsResidential || 0);
  const tot = Number((d as any).unitsTotalAll || 0);
  if (res && tot && tot > res) return `${res} residential + ${tot - res} commercial/other = ${tot} total`;
  return fmtN(d.units);
}

function coverLetterParagraphs(d: MasterReportData): string {
  const building = d.buildingName || d.address;
  if (isJacksonHeights85th(d)) {
    return `<div style="font-family:'Cormorant Garamond',Georgia,serif;color:#1a2744;font-size:15px;line-height:1.38"><p style="margin-bottom:10px"><strong style="font-family:'Plus Jakarta Sans',sans-serif;font-size:13px">Dear Samantha Hosein and Board Members,</strong> thank you for taking the time to speak with Valerie, Vincent, and the Camelot team about <strong>${escapeHtml(building)}</strong>. We understand this is a small Jackson Heights co-op with a shared garden, recent capital-project fatigue, rising cost pressure, mortgage and tax-abatement considerations, and a need for more consistent vendor, superintendent, accounting, and board support.</p><p style="margin-bottom:10px">Before we set a formal proposal or management agreement, Camelot would like to review the most recent financial report, management report, audit, operating budget, mortgage statements, insurance information, vendor list, and any Local Law 11 / compliance files. With your permission, those records let us quantify a fee structure that is fair to the building, identify refinancing and savings opportunities, and separate base management from items that should be billed separately or paid by the applicable shareholder.</p><p style="margin-bottom:12px">Our goal is to make the transition feel organized instead of burdensome: cleaner monthly reporting, responsive maintenance coordination, attorney and accountant cooperation, insurance and vendor review, superintendent coverage evaluation, and practical guidance for refinancing preparation. We would welcome a board meet-and-greet by Zoom or in person and will provide references and a Schedule A / Schedule B1-style fee menu for board review.</p>${davidGoldoffClientSignatureHtml()}</div>`;
  }
  const greeting = recipientGreeting(d);
  return `<div style="font-family:'Cormorant Garamond',Georgia,serif;color:#1a2744;font-size:15px;line-height:1.38"><p style="margin-bottom:10px"><strong style="font-family:'Plus Jakarta Sans',sans-serif;font-size:13px">${escapeHtml(greeting)},</strong> thank you for taking a moment with this. It is about <strong>${escapeHtml(building)}</strong> &mdash; and about introducing the team we would like you to consider for its management. Camelot Property Management has managed New York buildings since <strong>2006</strong>: independently owned, New York-based, and staffed by New Yorkers who manage New York buildings for a living.</p><p style="margin-bottom:10px">What sets us apart is the combination. On one side, a deep bench of well-trained property managers and in-house accounting professionals who navigate New York City compliance, local law, and the daily realities of running a building here. On the other, serious automation and AI that speeds up the work, protects the property, controls costs, and surfaces new revenue opportunities. We are connected across the city's industry organizations &mdash; NYARM, REBNY, IREM, BOMA New York, and CNYC among them &mdash; and we manage buildings in your area.</p><p style="margin-bottom:12px">The pages that follow are a live sample of the visibility our platform gives every client: what the city's public records say about your building today, and what we would do with that information on your behalf. We would welcome a Zoom, a phone call, or a meet-and-greet at your building &mdash; whichever is easiest for you.</p>${davidGoldoffClientSignatureHtml()}</div>`;
}

function fmt$(n: number): string {
  if (!n) return 'N/A';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + Math.round(n).toLocaleString();
  return '$' + n.toFixed(0);
}

function fmtN(n: number | null | undefined): string {
  if (!n) return 'N/A';
  return n.toLocaleString();
}

function roundToNearest50(n: number): number {
  return Math.round(n / 50) * 50;
}

function managementStatusLabel(d: MasterReportData): string {
  const mgmt = String(d.managementCompany || '').trim();
  if (mgmt && !/to verify|management to verify|unknown|n\/a/i.test(mgmt)) return mgmt;
  return 'Management to verify through HPD MDR, PropertyShark, board materials, and building records';
}

function isOuterBorough(d: MasterReportData): boolean {
  return /queens|brooklyn|bronx|staten/i.test(`${d.borough || ''} ${d.neighborhoodName || ''} ${d.address || ''}`);
}

function estimateScopedMonthlyFee(d: MasterReportData): number {
  const units = Math.max(d.units || 1, 1);
  const minimum = isOuterBorough(d) ? 1500 : 2000;
  const assumedMonthlyCharges = isOuterBorough(d) ? 900 : 1250;
  const budgetBasedMonthly = (units * assumedMonthlyCharges * 12 * 0.06) / 12;
  const marketBasedMonthly = d.tieredPricing?.intelligence?.monthly || d.monthlyFee || 0;
  const scopeAdd = /co-?op|cooperative|condo|condominium/i.test(`${d.propertyType || ''}`) ? 350 : 0;
  return roundToNearest50(Math.max(minimum, budgetBasedMonthly, marketBasedMonthly) + scopeAdd);
}

function scopedFeeLabel(d: MasterReportData): string {
  if (isJacksonHeights85th(d)) {
    return '$1,750/mo recommended ($21,000/yr) - options from $1,500-$2,000/mo';
  }
  const monthly = estimateScopedMonthlyFee(d);
  return `${fmt$(monthly)}/mo (${fmt$(monthly * 12)}/yr)`;
}

function inferBuildingDescription(d: MasterReportData): string {
  const parts: string[] = [];
  if (d.units) parts.push(`${d.units} Units`);
  if (d.propertyType) parts.push(d.propertyType);
  else if (d.isRentStabilized) parts.push('Rent Stabilized');
  if (d.yearBuilt) parts.push(`Est. ${d.yearBuilt}`);
  return parts.join('  |  ') || 'Residential Property';
}

function neighborhoodName(d: MasterReportData): string {
  if (!d.neighborhoodName) return d.borough ? d.borough.charAt(0).toUpperCase() + d.borough.slice(1) : 'New York';
  return d.neighborhoodName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function cleanFileNamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function externalDeckCss(): string {
  return `
  @page { size: 13.333in 7.5in; margin: 0; }
  @media print {
    html, body { width:13.333in !important; min-width:13.333in !important; margin:0 !important; padding:0 !important; overflow:visible !important; background:#fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .deck-action-bar { display:none !important; }
    .slide { width:13.333in !important; height:7.49in !important; min-height:7.49in !important; max-height:7.49in !important; margin:0 !important; padding:0 !important; box-shadow:none !important; overflow:hidden !important; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; }
    .slide:last-child { page-break-after: auto; break-after: auto; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { counter-reset: slide; }
  body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; color: #1a1f36; font-size: 16px; line-height: 1.6; background: #e0e0e0; }
  .deck-action-bar { position:sticky;top:0;z-index:50;background:#34444f;color:#fff;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,.18); }
  .deck-action-bar button, .deck-action-bar a { border:0;border-radius:8px;padding:9px 14px;font-size:12px;font-weight:800;text-decoration:none;cursor:pointer;margin-left:8px; }
  .deck-action-bar .gold { background:#B8973A;color:#fff; }
  .deck-action-bar .white { background:#fff;color:#34444f; }
  .deck-action-bar .outline { background:transparent;color:#F4D26A;border:1px solid #B8973A; }
  .slide { width: 1280px; height: 720px; margin: 20px auto; position: relative; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); background:#FAF8F5; counter-increment: slide; }
  .slide::after { content: counter(slide); position:absolute; right:24px; bottom:16px; font-family: Arial, sans-serif; font-size:10px; color:#7d8490; z-index:9; }
  .slide-dark { background: #34444f; color: #fff; }
  .pad { padding: 54px 64px; }
  .logo-badge { position: absolute; top: 0; right: 0; width: 166px; height: 96px; background: #B8973A; display: flex; align-items: center; justify-content: center; z-index: 4; }
  .logo-badge img { width: 136px; max-height: 62px; object-fit: contain; }
  .logo-badge-text { color:#111827;font-size:15px;font-weight:800;letter-spacing:5px;text-align:center;line-height:1.3; }
  .logo-badge-sub { display:block;font-size:7px;letter-spacing:3px;font-weight:500;margin-top:2px; }
  .section-title { font-family:'Cormorant Garamond',Georgia,serif;font-size:48px;font-style:italic;font-weight:600;color:#B8973A;line-height:1.05;border-left:5px solid #B8973A;padding-left:20px;margin-bottom:22px; }
  .sub-heading { font-size:22px;font-weight:800;color:#1a2744;margin-bottom:10px; }
  .body-text { font-size:16px;color:#4a5568;line-height:1.7; }
  .small { font-size:12px;color:#6b7280;line-height:1.55; }
  .gold-card { border:1px solid rgba(184,151,58,0.38);border-left:4px solid #B8973A;background:#fff;padding:18px 20px;border-radius:8px;box-shadow:0 12px 28px rgba(26,31,54,0.07); }
  .visual-card { border:1px solid rgba(184,151,58,0.32);background:#fff;border-radius:8px;box-shadow:0 12px 28px rgba(26,31,54,0.08);overflow:hidden; }
  .image-frame { height:260px;background:#EDE9DF;overflow:hidden;position:relative; }
  .image-frame img, .image-frame iframe { width:100%;height:100%;object-fit:cover;display:block;border:0; }
  .image-caption { padding:9px 12px;font-size:10px;color:#6b7280;border-top:1px solid #eee; }
  .article-wrap { font-size:15px;line-height:1.72;color:#263449; }
  .article-wrap p { margin-bottom:13px; }
  .article-float { width:42%;float:right;margin:0 0 14px 22px;border:1px solid rgba(184,151,58,.34);border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 14px 30px rgba(26,31,54,.10); }
  .article-float.left { float:left;margin:0 22px 14px 0; }
  .article-float img { width:100%;height:220px;object-fit:cover;display:block; }
  .article-wrap:after { content:"";display:block;clear:both; }
  .context-photo-chip { position:absolute;right:42px;bottom:42px;width:230px;height:132px;border:1px solid rgba(184,151,58,.42);border-radius:8px;overflow:hidden;background:#EDE9DF;box-shadow:0 14px 32px rgba(26,31,54,.16);z-index:3; }
  .context-photo-chip img { width:100%;height:100%;object-fit:cover;display:block; }
  .context-photo-chip-label { position:absolute;left:0;right:0;bottom:0;background:linear-gradient(0deg,rgba(26,39,68,.88),rgba(26,39,68,.24));color:#F4D26A;font-size:9px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;padding:18px 10px 8px;text-align:center; }
  .stat-box { background:#fff;border:1px solid rgba(184,151,58,0.25);border-radius:10px;padding:18px;text-align:center;box-shadow:0 12px 28px rgba(26,31,54,0.07); }
  .stat-val { font-family:'Cormorant Garamond',Georgia,serif;font-size:38px;font-weight:700;color:#B8973A;line-height:1; }
  .stat-label { font-size:12px;color:#6b7280;margin-top:5px;text-transform:uppercase;letter-spacing:.8px; }
  .check { display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;color:#1a2744;font-size:14px;line-height:1.45; }
  .check span { width:22px;height:22px;border-radius:50%;background:#B8973A;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0; }
  .mini-bar { height:10px;border-radius:999px;background:#E5E7EB;overflow:hidden;margin-top:7px; }
  .mini-bar span { display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#B8973A,#34444f); }
  .icon-tile { width:42px;height:42px;border-radius:10px;background:#F4EFE2;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0; }
  .source-note { position:absolute;bottom:18px;left:64px;right:64px;border-top:1px solid rgba(184,151,58,.25);padding-top:9px;font-size:9px;color:#8a8174; }
  table { width:100%;border-collapse:collapse; }
  th { background:#1a2744;color:#B8973A;padding:10px 14px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1px; }
  td { padding:9px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#344054;vertical-align:top; }
  `;
}

function deckShell(title: string, slides: string): string {
  const safeTitle = escapeHtml(title);
  const encodedSubject = encodeURIComponent(title);
  const encodedBody = encodeURIComponent(`Please find the Camelot introduction report for review.\n\n${DAVID_GOLDOFF_SIGNATURE_TEXT}`);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${safeTitle}</title><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,500;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"><style>${externalDeckCss()}</style></head><body><div class="deck-action-bar"><div style="font-size:13px;font-weight:900;color:#F4D26A">${safeTitle}</div><div><button class="gold" onclick="setTimeout(function(){window.focus();window.print()},150)">Print / Save PDF</button><button class="white" onclick="var blob=new Blob([document.documentElement.outerHTML],{type:'text/html;charset=utf-8'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=document.title.replace(/[^a-zA-Z0-9]+/g,'-')+'.html';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);a.remove()},1000)">Download HTML</button><a class="outline" href="mailto:info@camelot.nyc?cc=dgoldoff@camelot.nyc&subject=${encodedSubject}&body=${encodedBody}">Email</a></div></div>${slides}</body></html>`;
}

function logoBadge(): string {
  return `<div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>`;
}

function streetViewImage(d: MasterReportData, size = '900x600'): string {
  const location = d.latitude && d.longitude ? `${d.latitude},${d.longitude}` : `${d.address}, New York, NY`;
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${encodeURIComponent(location)}&fov=85&key=${GOOGLE_MAPS_KEY}`;
}

function streetViewEmbedUrl(d: MasterReportData, heading = 0): string {
  const location = d.latitude && d.longitude ? `${d.latitude},${d.longitude}` : `${d.address}, New York, NY`;
  return `https://www.google.com/maps/embed/v1/streetview?key=${GOOGLE_MAPS_KEY}&location=${encodeURIComponent(location)}&heading=${heading}&pitch=5&fov=80`;
}

function directionsEmbedUrl(d: MasterReportData, mode: 'driving' | 'transit' = 'driving'): string {
  return `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_KEY}&origin=57+West+57th+Street+Suite+410+New+York+NY+10019&destination=${encodeURIComponent(d.address)}&mode=${mode}`;
}

/** Street portion of the address only: "125 Walker Street, New York, NY" → "125 Walker Street". */
function streetLine(address: string): string {
  return String(address || '').split(',')[0].trim();
}

function placeEmbedUrl(d: MasterReportData): string {
  const query = d.latitude && d.longitude ? `${d.latitude},${d.longitude}` : `${d.address}, New York, NY`;
  return `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${encodeURIComponent(query)}&zoom=16`;
}

function nearbyServicesEmbedUrl(d: MasterReportData): string {
  const query = `restaurants grocery pharmacy transit services near ${d.address || d.buildingName || 'New York NY'}`;
  return `https://www.google.com/maps/embed/v1/search?key=${GOOGLE_MAPS_KEY}&q=${encodeURIComponent(query)}&zoom=15`;
}

function bestExteriorImage(d: MasterReportData): string {
  return d.buildingPhotos?.exterior?.[0] || d.buildingPhotos?.interior?.[0] || d.commercialIntel?.brandingImages?.[0] || d.streetEasy?.photos?.[0] || streetViewImage(d);
}

function propertyPhotoStack(d: MasterReportData): string[] {
  const seen = new Set<string>();
  return [
    ...(d.buildingPhotos?.exterior || []),
    ...(d.buildingPhotos?.interior || []),
    ...(d.commercialIntel?.brandingImages || []),
    ...(d.streetEasy?.photos || []),
  ].map(url => String(url || '').trim()).filter(url => {
    if (!url || seen.has(url)) return false;
    if (/undefined|null|\[object Object\]/i.test(url)) return false;
    seen.add(url);
    return true;
  });
}

function propertyPhotoGallery(d: MasterReportData, limit = 12): string {
  const photos = propertyPhotoStack(d).slice(0, limit);
  if (photos.length <= 1) return '';
  return `<div class="visual-card" style="padding:10px"><div style="font-size:10px;color:#B8973A;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:7px">Uploaded Property Photos</div><div style="display:grid;grid-template-columns:repeat(${Math.min(4, photos.length)},1fr);gap:6px">${photos.map((url, index) => `<div style="height:58px;border:1px solid rgba(184,151,58,.24);border-radius:5px;overflow:hidden;background:#EDE9DF"><img src="${escapeHtml(url)}" alt="${escapeHtml(d.buildingName || d.address)} property photo ${index + 1}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none'"></div>`).join('')}</div></div>`;
}

function staticMapImage(d: MasterReportData, size = '640x360'): string {
  const destination = d.latitude && d.longitude ? `${d.latitude},${d.longitude}` : `${d.address}, New York, NY`;
  return `https://maps.googleapis.com/maps/api/staticmap?size=${size}&scale=2&maptype=roadmap&markers=color:gold%7Clabel:C%7C57+West+57th+Street+Suite+410+New+York+NY+10019&markers=color:red%7Clabel:P%7C${encodeURIComponent(destination)}&path=color:0x34444fff%7Cweight:4%7C57+West+57th+Street+Suite+410+New+York+NY+10019%7C${encodeURIComponent(destination)}&key=${GOOGLE_MAPS_KEY}`;
}

function neighborhoodMapImage(d: MasterReportData, size = '640x360'): string {
  const destination = d.latitude && d.longitude ? `${d.latitude},${d.longitude}` : `${d.address}, New York, NY`;
  return `https://maps.googleapis.com/maps/api/staticmap?size=${size}&scale=2&maptype=roadmap&zoom=14&markers=color:red%7Clabel:P%7C${encodeURIComponent(destination)}&key=${GOOGLE_MAPS_KEY}`;
}

function rotatingPropertyImage(d: MasterReportData, index = 0): string {
  const photos = propertyPhotoStack(d);
  if (photos.length) return photos[index % photos.length];
  const fallbacks = [bestExteriorImage(d), neighborhoodMapImage(d), staticMapImage(d), streetViewImage(d)];
  return fallbacks[index % fallbacks.length];
}

function imageCard(src: string, alt: string, caption: string, height = 260): string {
  const safeAlt = escapeHtml(alt);
  return `<div class="visual-card"><div class="image-frame" style="height:${height}px"><img src="${src}" alt="${safeAlt}" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=&quot;height:100%;display:flex;align-items:center;justify-content:center;background:#34444f;color:#B8973A;font-size:12px;font-weight:800;text-align:center;padding:16px&quot;>${safeAlt}</div>'"></div><div class="image-caption">${caption}</div></div>`;
}

function contextualImageCard(d: MasterReportData, index: number, caption: string, height = 220): string {
  const photos = propertyPhotoStack(d);
  if (photos.length) {
    return imageCard(photos[index % photos.length], `${d.buildingName || d.address} property photo ${index + 1}`, caption, height);
  }
  // No discovered/uploaded photos: show the interactive Street View embed of
  // the property itself. Unlike the Static image APIs (which need a
  // billing-enabled Maps key and previously failed into a dark placeholder
  // reading "contextual image N"), the Embed API renders real street-level
  // imagery of the address with the shared key.
  const heading = (index * 90) % 360;
  return iframeCard(streetViewEmbedUrl(d, heading), `${d.buildingName || d.address} street view (angle ${heading}\u00B0)`, caption, height);
}

/** Satellite close-up pinned on the property lot — the "3D site" view. */
function siteSatelliteEmbedUrl(d: MasterReportData): string {
  const q = d.latitude && d.longitude ? `${d.latitude},${d.longitude}` : `${d.address}, New York, NY`;
  return `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${encodeURIComponent(q)}&zoom=18&maptype=satellite`;
}

function articleImageFloat(d: MasterReportData, index: number, caption: string, side: 'left' | 'right' = 'right', height = 220): string {
  const src = rotatingPropertyImage(d, index);
  const sideClass = side === 'left' ? ' left' : '';
  return `<figure class="article-float${sideClass}"><img src="${src}" alt="${escapeHtml(d.buildingName || d.address)} editorial report image ${index + 1}" style="height:${height}px" onerror="this.parentElement.style.display='none'"><figcaption class="image-caption">${escapeHtml(caption)}</figcaption></figure>`;
}

function localServicesCard(d: MasterReportData, height = 220): string {
  return iframeCard(siteSatelliteEmbedUrl(d), 'Property site satellite view', `Satellite close-up — ${d.buildingName || d.address} site location`, height);
}

function everyOtherPageVisualChip(d: MasterReportData, index: number, label = 'Property / Neighborhood Context'): string {
  const src = rotatingPropertyImage(d, index);
  return `<div class="context-photo-chip"><img src="${src}" alt="${escapeHtml(d.buildingName || d.address)} visual context ${index + 1}" onerror="this.parentElement.style.display='none'"><div class="context-photo-chip-label">${escapeHtml(label)}</div></div>`;
}

function enrichEveryOtherDeckPage(slides: string, d: MasterReportData): string {
  let visualIndex = 0;
  const parts = slides.split(/(?=<div class="slide\b)/g);
  return parts.map((part, index) => {
    if (!part.startsWith('<div class="slide')) return part;
    const slideNumber = index + 1;
    const alreadyHasVisual = /<img\b|<iframe\b|class="context-photo-chip"|class="photo-frame"|class="visual-card"|class="image-frame"/i.test(part);
    if (slideNumber > 1 && !alreadyHasVisual) {
      return part.replace(/<\/div>\s*$/s, `${everyOtherPageVisualChip(d, visualIndex++, 'Property / Neighborhood')}\n</div>`);
    }
    return part;
  }).join('');
}

function propertyImageCard(d: MasterReportData, caption: string, height = 392): string {
  const first = bestExteriorImage(d);
  const safeAlt = escapeHtml(d.buildingName || d.address);
  const iframe = `<iframe src=&quot;${streetViewEmbedUrl(d)}&quot; title=&quot;${safeAlt} street view&quot; allowfullscreen loading=&quot;lazy&quot;></iframe>`;
  return `<div class="visual-card"><div class="image-frame" style="height:${height}px"><img src="${first}" alt="${safeAlt}" onerror="this.style.display='none';this.parentElement.innerHTML='${iframe}'"></div><div class="image-caption">${caption}</div></div>`;
}

function iframeCard(src: string, title: string, caption: string, height = 260): string {
  const safeTitle = escapeHtml(title);
  return `<div class="visual-card"><div class="image-frame" style="height:${height}px"><iframe src="${src}" title="${safeTitle}" allowfullscreen loading="lazy"></iframe></div><div class="image-caption">${caption}</div></div>`;
}

function closestSubwayPanel(d: MasterReportData, exact22East22 = false): string {
  const stops = exact22East22
    ? [
        ['23 Street Station', 'N / R / W', 'Broadway & East 23rd Street', 'approx. 0.2 mi'],
        ['23 Street Station', '6', 'Park Avenue South & East 23rd Street', 'approx. 0.3 mi'],
        ['23 Street Station', 'F / M', 'Sixth Avenue & West 23rd Street', 'approx. 0.5 mi'],
      ]
    : [
        ['Nearest transit', 'Verify', 'Confirm against MTA / Google Maps during final review', 'nearby'],
        ['Vendor routing', 'Street access', 'Useful for site visits, inspections, and emergency response', 'context'],
        ['Resident access', 'Neighborhood mobility', 'Important for value and resident experience', 'context'],
      ];
  const query = exact22East22 ? '23 Street Station N R W Broadway East 23rd Street New York NY' : `${d.address} nearest subway`;
  return `<div class="gold-card" style="padding:16px 18px;height:100%"><div class="sub-heading" style="font-size:18px;margin-bottom:8px">Closest Subway Access</div><p class="body-text" style="font-size:12px;line-height:1.45;margin-bottom:10px">Transit access helps frame resident convenience, vendor routing, and day-to-day operating practicality.</p><div style="height:150px;border:1px solid rgba(184,151,58,.32);border-radius:8px;overflow:hidden;background:#EDE9DF;margin-bottom:10px">${rawIframeFrame(`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${encodeURIComponent(query)}&zoom=16`, 'Closest subway map')}</div>${stops.map(([name, train, location, distance]) => `<div style="display:grid;grid-template-columns:70px 1fr;gap:9px;align-items:start;border-top:1px solid rgba(184,151,58,.18);padding-top:8px;margin-top:8px"><div style="background:#34444f;color:#F4D26A;border-radius:999px;text-align:center;font-size:11px;font-weight:900;padding:5px 7px">${train}</div><div><div style="font-size:12px;font-weight:900;color:#1a2744">${name} <span style="color:#B8973A">(${distance})</span></div><div style="font-size:11px;line-height:1.35;color:#4a5568">${location}</div></div></div>`).join('')}</div>`;
}

function rawIframeFrame(src: string, title: string): string {
  return `<iframe src="${src}" title="${escapeHtml(title)}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" style="width:100%;height:100%;border:0;display:block"></iframe>`;
}

function landmarkLabels(d: MasterReportData): string[] {
  const live = (d.neighborhoodIntel?.landmarks || []).map(l => `${l.name}${l.type ? ` | ${l.type}` : ''}`);
  const known = (d.raw?.knownFacts?.landmarks || d.raw?.known?.landmarks || []) as string[];
  const fallback = [
    `${neighborhoodName(d)} neighborhood context`,
    'Camelot HQ - 57 West 57th Street',
    'NYC transit and vendor-routing access',
    'LPC / neighborhood landmark review',
  ];
  return Array.from(new Set([...known, ...live, ...fallback])).slice(0, 5);
}

function jackson85thScopeSlide(d: MasterReportData): string {
  return `<div class="slide slide-cream"><div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div><div class="pad"><div class="section-title">Scope From the Board Discussion</div><p class="body-text" style="margin-bottom:14px">Based on the discussion with Samantha, Camelot should treat this as a small co-op transition proposal: clear base management, transparent add-ons, and a fee menu that the board can actually understand.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div class="gold-card"><div class="sub-heading" style="font-size:18px">Base Management Scope</div>${JACKSON_85TH_SCOPE_INCLUDED.map(item => `<div class="check-item" style="font-size:12px;line-height:1.35;margin-bottom:7px"><div class="check-icon">&#10003;</div>${item}</div>`).join('')}</div><div class="gold-card"><div class="sub-heading" style="font-size:18px">Separate / Confirmed After Records Review</div>${JACKSON_85TH_SEPARATE_SCOPE.map(item => `<div class="check-item" style="font-size:12px;line-height:1.35;margin-bottom:7px"><div class="check-icon">&#10003;</div>${item}</div>`).join('')}</div></div><div class="source-note">Sources: May 2026 Camelot / Samantha call notes, Camelot fee structure guide, standard management agreement / Schedule B1 framework, and requested board follow-up materials.</div></div></div>`;
}

function jackson85thWhatWeHeardSlide(): string {
  const items = [
    ['Small Co-op Fit', 'The board wants to know Camelot can right-size service for a small cooperative without forcing a large-firm process onto residents.'],
    ['Cost Pressure', 'Mortgage/refinancing preparation, rising operating costs, tax-abatement changes, insurance, and maintenance planning all need clearer financial support.'],
    ['Transition Fear', 'The board has lived through capital-project fatigue and needs a transition that feels orderly, not like more work for volunteers.'],
    ['Local Manager Tradeoff', 'The current hyper-local manager may feel affordable and familiar, but the board is questioning whether the building needs a deeper bench, better reporting, and stronger coordination.'],
    ['Staffing & Vendors', 'Superintendent / porter / handyman coverage, vendor pricing, parking, laundry, and day-to-day repair coordination all need a practical review.'],
    ['References & Clarity', 'Samantha asked for clear services, terms, fees, Schedule A / B1-style items, references, Local Law 11 support, and refinancing guidance.'],
  ];
  return `<div class="slide slide-cream"><div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div><div class="pad"><div class="section-title">What We Heard</div><p class="body-text" style="margin-bottom:14px">This proposal should answer the board's real question: can Camelot bring more structure and depth without creating chaos or unnecessary cost?</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${items.map(([title, copy]) => `<div class="gold-card" style="padding:15px 16px;min-height:112px"><div style="font-size:16px;font-weight:800;color:#1a2744;margin-bottom:5px">${title}</div><div style="font-size:12px;color:#4a5568;line-height:1.45">${copy}</div></div>`).join('')}</div><div class="source-note">Source: May 2026 Camelot / Samantha management interview notes.</div></div></div>`;
}

function jackson85thPricingOptionsSlide(): string {
  const rows = [
    ['Lean Base', '$1,500/mo', 'Basic management with limited included meetings and heavier Schedule A billing for special work.'],
    ['Recommended', '$1,750/mo', 'Balanced full-service small co-op management for accounting, vendor coordination, board support, and transition discipline.'],
    ['Enhanced Transition', '$2,000/mo for first 90 days, then $1,750/mo', 'Best if records are messy, vendor files are incomplete, or the board wants deeper onboarding.'],
  ];
  return `<div class="slide slide-cream"><div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div><div class="pad"><div class="section-title">Proposed Fee &amp; Terms</div><p class="body-text" style="margin-bottom:14px">Small co-ops should not be priced by unit count alone. The fee must reflect real management time: accounting, meetings, collections, vendors, refinancing prep, compliance, superintendent coverage, shareholder questions, and emergencies.</p><table class="fee-table"><tr><th>Option</th><th>Fee</th><th>Best Use</th></tr>${rows.map(([name, fee, use]) => `<tr><td><strong>${name}</strong></td><td class="gold">${fee}</td><td>${use}</td></tr>`).join('')}</table><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px"><div class="gold-card" style="padding:12px"><strong>Onboarding</strong><br><span class="small">$1,500 one-time; may be credited if approved within 30 days with complete records.</span></div><div class="gold-card" style="padding:12px"><strong>Term</strong><br><span class="small">Initial 1-year term.</span></div><div class="gold-card" style="padding:12px"><strong>Escalation</strong><br><span class="small">3%-5% annually.</span></div><div class="gold-card" style="padding:12px"><strong>Termination</strong><br><span class="small">After first 90 days, either party may terminate on 60 days' written notice.</span></div></div><div class="source-note">Fee logic: Queens small co-op market range plus small-building monthly minimum and service-burden adjustment.</div></div></div>`;
}

function jackson85thFinancialContextSlide(d: MasterReportData): string {
  const items = [
    ['Mortgage Review', 'The conversation flagged approximately $2M of mortgage obligations, while PropertyShark-style title history also shows prior mortgage-related documents around $850,000 and $1,500,000. Camelot should request current statements and maturity dates before advising the board.'],
    ['Tax Abatement', 'A tax abatement expiration was flagged as a future budget pressure. The proposal should model what that means before recommending maintenance increases or assessments.'],
    ['Income Levers', 'Parking, laundry / washer-dryer revenue, fee schedules, and possible assessments should be reviewed against governing documents and shareholder tolerance.'],
    ['Cost Levers', 'Insurance rebidding, deductible strategy, vendor pricing, preventive maintenance, and superintendent coverage are the controllable cost areas to test first.'],
  ];
  return `<div class="slide slide-cream"><div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div><div class="pad"><div class="section-title">Budget, Refinancing &amp; Savings Workstream</div><div style="display:grid;grid-template-columns:.92fr 1.08fr;gap:18px"><div>${propertyImageCard(d, 'Lyndon Court / 37-34 85th Street exterior or front entrance', 410)}</div><div style="display:grid;gap:10px">${items.map(([title, copy]) => `<div class="gold-card" style="padding:14px 16px"><div style="font-size:16px;font-weight:800;color:#1a2744;margin-bottom:4px">${title}</div><div style="font-size:12px;color:#4a5568;line-height:1.45">${copy}</div></div>`).join('')}</div></div><div class="source-note">Pricing should be finalized only after reviewing latest budget, audit, prior management report, mortgage statements, tax information, arrears, insurance, vendor contracts, and requested staffing cadence.</div></div></div>`;
}

function jackson85thThirtyDaySlide(): string {
  return `<div class="slide slide-cream"><div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div><div class="pad"><div class="section-title">30-Day Transition Plan</div><p class="body-text" style="margin-bottom:14px">The first month should make the board feel the difference: organized files, visible money controls, clear vendor ownership, and a real plan for superintendent coverage and refinancing preparation.</p><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${JACKSON_85TH_TRANSITION_STEPS.map(([title, bullets]) => `<div class="gold-card" style="min-height:375px;padding:15px 14px"><div class="sub-heading" style="font-size:17px">${title}</div>${(bullets as string[]).map(item => `<div class="check-item" style="font-size:12px;line-height:1.35;margin-bottom:9px"><div class="check-icon">&#10003;</div>${item}</div>`).join('')}</div>`).join('')}</div><div class="source-note">Transition begins after board authorization, executed agreement, prior-manager records, bank setup, and board-approved resident/vendor communication.</div></div></div>`;
}

function jackson85thReferencesSlide(): string {
  const refs = [
    'Small co-op reference with similar board-service needs',
    'Queens / outer-borough residential reference',
    'Accounting and monthly reporting reference',
    'Capital project / Local Law compliance reference',
    'Responsive transition / communication reference',
  ];
  return `<div class="slide slide-cream"><div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div><div class="pad"><div class="section-title">References &amp; Follow-Up Package</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:18px"><div class="gold-card"><div class="sub-heading">Reference Contacts to Provide</div>${refs.map(item => `<div class="check-item"><div class="check-icon">&#10003;</div>${item}</div>`).join('')}<p class="small" style="margin-top:12px">Camelot should provide names, buildings, emails / phone numbers, and permission-confirmed reference contacts under separate cover.</p></div><div class="gold-card"><div class="sub-heading">Materials Samantha Requested</div>${['AI-generated meeting notes', 'Standard management agreement', 'Schedule B1 / fee menu: included vs separately billed', 'Local Law 11 and related compliance forms', 'Refinancing preparation guidance from accounting team', 'Written proposal that can be shared with the board'].map(item => `<div class="check-item"><div class="check-icon">&#10003;</div>${item}</div>`).join('')}</div></div><div class="source-note">Source: May 2026 call action items and board follow-up request.</div></div></div>`;
}

function jackson85thMissingDocumentsSlide(): string {
  const docs = [
    'Most recent monthly financial statement, current annual budget, latest management report, and arrears report',
    'Mortgage statements, maturity dates, tax-abatement details, insurance policies, premiums, and deductibles',
    'Vendor list, current contracts, superintendent / porter agreement, payroll details, workers comp, and emergency contacts',
    'Laundry, parking, storage, move-in/out, sale, sublet, alteration, refinancing, and document fee schedules',
    'HPD registration, DOB / ECB / HPD violation list, Local Law 11 / FISP materials if applicable, recent capital-project summary',
    'House rules, bylaws, proprietary lease, shareholder list, board meeting schedule, and current communication process',
  ];
  return `<div class="slide slide-cream"><div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div><div class="pad"><div class="section-title">Documents Needed Before Final Proposal</div><p class="body-text" style="margin-bottom:14px">Camelot can give the board a preliminary range now, but the final proposal and management agreement should be tied to the building's actual budget, records, staffing burden, compliance status, and requested meeting cadence.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${docs.map(item => `<div class="gold-card" style="padding:14px 16px;min-height:104px"><div class="check-item" style="font-size:12px;line-height:1.42"><div class="check-icon">&#10003;</div>${item}</div></div>`).join('')}</div><div class="source-note">Document request list for Samantha and the Lyndon Court board.</div></div></div>`;
}

function bullets(items: string[]): string {
  return items.map(item => `<div class="check"><span>&#10003;</span><div>${item}</div></div>`).join('');
}

function jackson85thTwoColumnSlide(title: string, intro: string, leftTitle: string, leftItems: string[], rightTitle: string, rightItems: string[], source = 'Prepared from Camelot call notes, PropertyShark materials, and Camelot management standards.'): string {
  return `<div class="slide slide-cream">${logoBadge()}<div class="pad"><div class="section-title">${title}</div><p class="body-text" style="margin-bottom:18px">${intro}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:18px"><div class="gold-card"><div class="sub-heading">${leftTitle}</div>${bullets(leftItems)}</div><div class="gold-card"><div class="sub-heading">${rightTitle}</div>${bullets(rightItems)}</div></div><div class="source-note">${source}</div></div></div>`;
}

function generateJackson85thBoardDeck(d: MasterReportData): string {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = 'Camelot Board Meeting Deck - Lyndon Court';
  const snapshotRows = [
    ['Property', 'Lyndon Court'],
    ['Address', '37-34 85th Street, Jackson Heights, NY 11372'],
    ['Type', 'Walk-up cooperative'],
    ['Units', 'HPD / PropertyShark-style sources show 18; DOF-style residential count may show 17; reconcile during transition'],
    ['Built / Stories', '1921 / 4 stories'],
    ['Historic Context', 'Jackson Heights Historic District'],
    ['Current Management', 'Garden Heights Property Management appears in records; verify'],
    ['Initial HPD Signal', 'PropertyShark materials show 8 HPD violations; verify current open/closed status'],
  ];
  const slides = `
<div class="slide slide-dark"><div style="position:absolute;inset:0;opacity:.42"><img src="${bestExteriorImage(d)}" alt="Lyndon Court" style="width:100%;height:100%;object-fit:cover"></div><div style="position:absolute;inset:0;background:linear-gradient(105deg,rgba(34,47,58,.98),rgba(34,47,58,.68))"></div><div class="pad" style="position:relative;z-index:2">${logoBadge()}<div style="height:100%;display:flex;flex-direction:column;justify-content:center;max-width:800px"><div class="eyebrow">Board Meeting Deck - Camelot Property Management</div><h1 class="hero-title">Lyndon Court</h1><p style="font-size:24px;color:rgba(255,255,255,.88);line-height:1.4;margin:16px 0 8px">37-34 85th Street, Jackson Heights, NY 11372</p><p style="font-size:17px;color:rgba(255,255,255,.72)">A practical management proposal for a historic Jackson Heights cooperative.</p><div style="display:flex;gap:18px;margin-top:34px"><div><div class="stat-val">17-18</div><div class="stat-label" style="color:rgba(255,255,255,.65)">Units to reconcile</div></div><div><div class="stat-val">4</div><div class="stat-label" style="color:rgba(255,255,255,.65)">Stories</div></div><div><div class="stat-val">1921</div><div class="stat-label" style="color:rgba(255,255,255,.65)">Built</div></div></div></div><div class="source-note" style="color:rgba(255,255,255,.5);border-color:rgba(255,255,255,.18)">Prepared for Samantha Hosein and the Lyndon Court Board - ${today}</div></div></div>
<div class="slide slide-cream">${logoBadge()}<div class="pad"><div class="section-title">Executive Letter</div><div class="gold-card" style="padding:30px 38px;max-width:900px"><p class="body-text" style="margin-bottom:14px">Dear Samantha Hosein and Board Members, thank you for taking the time to speak with Valerie, Vincent, and the Camelot team about Lyndon Court. We understand this is a small Jackson Heights co-op with recent capital-project fatigue, rising cost pressure, mortgage and tax-abatement considerations, and a need for more consistent vendor, superintendent, accounting, and board support.</p><p class="body-text" style="margin-bottom:14px">Before setting a formal proposal or management agreement, Camelot would like to review the latest financials, budget, management report, mortgage statements, insurance, vendor list, and compliance files. Those records let us quantify a fair fee structure and separate base management from items that should be billed by Schedule A / Schedule B1-style scope.</p>${davidGoldoffClientSignatureHtml()}</div><div class="source-note">Client-facing cover letter prepared from the May 2026 management interview notes.</div></div></div>
<div class="slide slide-cream">${logoBadge()}<div class="pad"><div class="section-title">Property Snapshot</div><div style="display:grid;grid-template-columns:.95fr 1.05fr;gap:18px"><div class="gold-card"><table>${snapshotRows.map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join('')}</table></div><div>${propertyImageCard(d, 'Uploaded Lyndon Court property image', 255)}${propertyPhotoGallery(d, 8)}</div></div><div class="source-note">Certain public records conflict on unit count; Camelot will reconcile HPD, DOF, PropertyShark, corporate records, proprietary lease, and board records during transition.</div></div></div>
${jackson85thWhatWeHeardSlide()}
${jackson85thTwoColumnSlide('Camelot Positioning', 'The winning answer is not that Camelot is bigger. The answer is that Lyndon Court gets senior attention with better accounting, vendor discipline, compliance tracking, and transition control.', 'Boutique Attention', ['Senior-led management for small buildings', 'Board-safe communication and practical meeting cadence', 'Local Queens familiarity with Manhattan-level reporting discipline'], 'Deeper Bench', ['Accounting, collections, attorney and accountant coordination', 'Vendor, insurance, staffing, and compliance oversight', 'Technology used where useful, not forced onto residents'])}
${jackson85thScopeSlide(d)}
${jackson85thTwoColumnSlide('Accounting & Reporting', 'The board should see clean money movement and plain-English monthly reporting, not a pile of disconnected statements.', 'Monthly Financial Package', ['Balance sheet', 'Income statement with budget comparison', 'Cash disbursements and AP register', 'Bank reconciliation and arrears report'], 'Board Support', ['Budget variance comments', 'Action-item management report', 'Audit and tax package coordination', 'Mortgage/refinance readiness support'])}
${jackson85thTwoColumnSlide('Compliance & Risk Management', 'Compliance should be calendarized and source-backed. Camelot will not overstate obligations before records are verified.', 'Initial Source Stack', ['HPD registration and violation review', 'DOB BIS / DOB NOW and ECB/OATH review', 'Insurance certificates and vendor licensing', 'Fire-safety, lead-paint, boiler, and notices as applicable'], 'Historic Building Sensitivity', ['Jackson Heights Historic District context', 'Exterior work reviewed with LPC sensitivity if applicable', 'Local Law 11 / FISP only if verified as applicable', 'Open items tracked in a board-facing calendar'])}
${jackson85thTwoColumnSlide('Maintenance, Vendors & Superintendent Review', 'Camelot will not recommend staffing just to add cost. The goal is to evaluate what Lyndon Court actually needs.', 'Coverage Questions', ['Cleaning and garbage/recycling cadence', 'Snow and seasonal support', 'Minor repair and handyman needs', 'Emergency access and response protocol'], 'Vendor Control', ['COIs, W-9s, contracts, and scope review', 'Preferred-vendor pricing where useful', 'Repair logs and photo-backed updates', 'Board approval workflow for larger work'])}
${jackson85thFinancialContextSlide(d)}
${jackson85thTwoColumnSlide('Technology & Communication', 'The technology plan should make board work easier without overwhelming shareholders.', 'Resident / Shareholder Flow', ['Maintenance request intake and tracking', 'Email and phone escalation paths', 'Board packet and action log', 'Document repository for building records'], 'Board Visibility', ['Monthly reporting calendar', 'AP approval controls', 'Vendor tracker', 'Compliance and renewal calendar'])}
${jackson85thThirtyDaySlide()}
${jackson85thTwoColumnSlide('90-Day Stabilization Plan', 'After the first month, Camelot should move from intake to measurable operating stabilization.', 'Operational Reviews', ['Vendor review and insurance review', 'Budget and reserve review', 'Staffing / superintendent recommendation', 'Arrears and collections workflow'], 'Board Deliverables', ['Compliance calendar', 'Mortgage/refinance coordination checklist', 'Resident/shareholder communication improvements', '90-day priority plan'])}
${jackson85thPricingOptionsSlide()}
<div class="slide slide-cream">${logoBadge()}<div class="pad"><div class="section-title">Next Steps</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:18px"><div class="gold-card"><div class="sub-heading">Close the Information Gap</div>${bullets(['Board reviews this proposal and fee structure', 'Camelot receives latest financials, budget, management report, insurance, mortgage, vendor, and superintendent materials', 'Camelot prepares final proposal, agreement, and Schedule A / B1 fee menu'])}</div><div class="gold-card"><div class="sub-heading">Meet and Decide</div>${bullets(['Schedule a 30-minute board Zoom or in-person meet-and-greet', 'Confirm expectations, meeting cadence, transition date, and references', 'Begin 30-day onboarding after signed agreement and bank/accounting setup'])}</div></div><div style="margin-top:16px">${iframeCard(directionsEmbedUrl(d), 'Camelot route to Lyndon Court', 'Camelot HQ to Lyndon Court route context', 210)}</div><div class="source-note">References available under separate cover after permission is confirmed.</div></div></div>`;
  return deckShell(title, slides);
}

function intelligenceSourceCards(): string {
  const sources = [
    { icon: 'ðŸ›', title: 'NYC Records', copy: 'HPD, DOB, DOF, ECB/OATH, ACRIS, LL84/LL97' },
    { icon: 'ðŸ—º', title: 'Location Intelligence', copy: 'Maps, transit, route timing, landmarks, neighborhood context' },
    { icon: 'ðŸ“Š', title: 'Market Intelligence', copy: `StreetEasy, PropertyShark, ${PROPERTYSHARK_DILIGENCE_FIELDS[3]}, tax bills, FAR / air rights, market comps` },
    { icon: 'ðŸ¤', title: 'Camelot Records', copy: 'Portfolio outcomes, vendor history, accounting cadence, onboarding playbooks' },
  ];
  return sources.map(s => `<div class="gold-card" style="display:flex;gap:12px;align-items:flex-start;min-height:104px"><div class="icon-tile">${s.icon}</div><div><div style="font-size:14px;font-weight:800;color:#1a2744">${s.title}</div><div class="small">${s.copy}</div></div></div>`).join('');
}

function compactIntelligenceSources(): string {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">${intelligenceSourceCards().replace(/min-height:104px/g, 'min-height:74px').replace(/font-size:14px/g, 'font-size:12px')}</div>`;
}

function responseChart(d: MasterReportData): string {
  const rows = [
    ['Senior manager dispatch', 85, 'same day triage'],
    ['Vendor coordination', 75, '24-48 hour scope review'],
    ['Board reporting cadence', 92, 'monthly package by 20th-25th'],
    ['Compliance tracking', 88, 'calendar + source checks'],
  ];
  return `<div class="visual-card" style="padding:18px"><div class="sub-heading" style="font-size:18px">What Boards Care About</div>${rows.map(([label, pct, note]) => `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#1a2744;font-weight:800"><span>${label}</span><span style="color:#B8973A">${note}</span></div><div class="mini-bar"><span style="width:${pct}%"></span></div></div>`).join('')}<div class="small" style="margin-top:12px">Applied to ${d.buildingName || d.address}: proximity, data quality, response process, and reporting consistency are made visible instead of assumed.</div></div>`;
}

function localGrowthCopy(d: MasterReportData): string {
  const area = `${d.address || ''} ${d.buildingName || ''} ${d.neighborhoodName || ''} ${d.borough || ''}`.toLowerCase();
  if (/queens|jackson heights|astoria|sunnyside|long island city|lic|austin street|forest hills/.test(area)) {
    return 'Camelot is already active in and around Queens, with properties and assets in Sunnyside, on Austin Street, and in Long Island City. We are actively growing in this market, which means your building benefits from local vendor knowledge, nearby field coverage, and a team that understands the neighborhood.';
  }
  return `Camelot manages ${CAMELOT_PROFILE.buildingsManaged} buildings across New York-area neighborhoods and continues to grow around well-run co-op, condo, and rental communities like ${d.buildingName || d.address}.`;
}

function camelotOnePageSlide(d: MasterReportData): string {
  const proofChips = [
    ['CPA', 'In-house accounting and monthly board packages'],
    ['LAW', 'Attorney-led advisory and governance support'],
    ['BROKER', 'Licensed broker, operating since 2006'],
    ['NY', 'NYC, Riverdale, Westchester, NJ'],
  ];
  return `<div class="slide"><div class="pad" style="padding:48px 64px 46px">${logoBadge()}<div class="section-title" style="margin-bottom:18px">Camelot In One Page</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px"><div class="stat-box" style="padding:14px 18px"><div class="stat-val" style="font-size:34px">${CAMELOT_PROFILE.buildingsManaged}</div><div class="stat-label">Buildings</div></div><div class="stat-box" style="padding:14px 18px"><div class="stat-val" style="font-size:34px">${CAMELOT_PROFILE.assetsUnderManagement}</div><div class="stat-label">AUM*</div></div><div class="stat-box" style="padding:14px 18px"><div class="stat-val" style="font-size:34px">${CAMELOT_PROFILE.foundedYear}</div><div class="stat-label">Founded</div></div><div class="stat-box" style="padding:14px 18px"><div class="stat-val" style="font-size:34px">${CAMELOT_PROFILE.unitsTracked}</div><div class="stat-label">Units Tracked</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start"><div class="gold-card" style="min-height:328px;padding:18px 20px"><div class="sub-heading" style="font-size:20px;margin-bottom:8px">New Yorkers Servicing New Yorkers</div><p class="body-text" style="font-size:15px;line-height:1.55;margin-bottom:10px">Camelot is independent, hands-on, and built for boards that want senior attention, clean reporting, faster response, and a management partner that thinks like an owner.</p><p class="body-text" style="font-size:14px;line-height:1.5;margin-bottom:10px">We service co-ops, condos, and rental buildings across NYC, the five boroughs, Riverdale, Westchester, and New Jersey, supported by in-house accounting, legal leadership, brokerage expertise, and practical automation.</p><p class="small" style="font-size:12px;line-height:1.45;margin-bottom:12px;color:#3A4B5B"><strong style="color:#B8973A">Local growth:</strong> ${localGrowthCopy(d)}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${proofChips.map(([label, copy]) => `<div style="border:1px solid rgba(184,151,58,.34);border-radius:8px;padding:10px 12px;background:#FAF8F5;min-height:68px"><div style="font-size:11px;color:#B8973A;font-weight:900;letter-spacing:1px;margin-bottom:4px">${label}</div><div class="small" style="line-height:1.35;color:#1a2744">${copy}</div></div>`).join('')}</div></div><div>${responseChart(d)}<div style="margin-top:10px">${camelotAssociationLogoGrid(58)}</div></div></div><div class="source-note">Sources: ${CAMELOT_OUR_TEAM_SOURCE} | ${CAMELOT_TEAM_SOURCE} | Camelot sample report package | NYC Open Data | Google Maps. *${CAMELOT_PROFILE.assetsUnderManagementNote}.</div></div></div>`;
}

function executiveTeamSlide(): string {
  return `<div class="slide slide-cream">${logoBadge()}<div class="pad" style="padding:42px 58px 46px"><div class="section-title" style="margin-bottom:14px">Executive Team</div><p class="body-text" style="font-size:14px;margin-bottom:14px">Camelot's board-facing team combines ownership perspective, property operations, accounting, compliance, legal, brokerage, and facility oversight.</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${CAMELOT_EXECUTIVE_TEAM.map(member => `<div class="gold-card" style="min-height:128px;display:flex;gap:12px;align-items:flex-start;padding:13px 14px;margin-bottom:0"><div style="width:58px;height:58px;border-radius:10px;overflow:hidden;background:#1a2744;color:#B8973A;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;flex:0 0 58px">${member.photo ? `<img src="${member.photo}" alt="${member.name}" style="width:100%;height:100%;object-fit:cover;object-position:center 18%" onerror="this.outerHTML='${member.name.split(' ').map(w => w[0]).slice(0,2).join('')}'">` : member.name.split(' ').map(w => w[0]).slice(0,2).join('')}</div><div><div style="font-size:15px;font-weight:900;color:#1a2744;line-height:1.15">${member.name}</div><div style="font-size:9.5px;color:#B8973A;font-weight:900;text-transform:uppercase;letter-spacing:.45px;margin:4px 0">${member.title}</div><div style="font-size:11px;color:#4a5568;line-height:1.38">${member.note}</div></div></div>`).join('')}</div></div></div>`;
}

function residentPortalSlide(d: MasterReportData): string {
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Resident Portal &amp; Automation</div><div style="display:grid;grid-template-columns:1fr .95fr;gap:28px;align-items:center"><div><div class="sub-heading">Plus by Concierge Plus</div><p class="body-text" style="margin-bottom:16px">Plus brings property operations into one connected system: residents, management, payments, communication, service requests, administrative tickets, documents, amenity booking, packages, meeting logistics, and AI support.</p><div class="gold-card"><div class="check"><span>&#10003;</span><div>Residents can book amenities, submit maintenance requests, pay fees, track packages, and stay connected from one mobile-friendly platform.</div></div><div class="check"><span>&#10003;</span><div>Management gains cleaner visibility across work orders, administrative ticket orders, resident communications, board tasks, and vendor follow-up.</div></div><div class="check"><span>&#10003;</span><div>Boards can add automated Zoom board meetings, annual meetings, town halls, cloud file access, and a chatbot layer over Camelot OS without overwhelming residents.</div></div></div></div><div><img src="${CONCIERGE_PLUS_LOGO_IMAGE}" alt="Plus by Concierge Plus" style="width:100%;height:110px;object-fit:contain;margin-bottom:18px"><img src="${CONCIERGE_PLUS_PLATFORM_IMAGE}" alt="Concierge Plus product suite" style="width:100%;height:340px;object-fit:contain"></div></div><div class="source-note">Source: ${CONCIERGE_PLUS_PRODUCT_SOURCE}</div></div></div>`;
}

function mdsAccountingSlide(): string {
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Accounting &amp; Reporting Proof</div><p class="body-text" style="margin-bottom:16px">Camelot's accounting package is built around board-ready monthly reporting, MDS workflows, clean backup, in-house CPA oversight, and a predictable reporting cadence.</p><div style="display:grid;grid-template-columns:.95fr 1.05fr;gap:18px"><div class="gold-card"><div style="height:58px;margin-bottom:12px"><img src="${MDS_LOGO_IMAGE}" alt="MDS property management software" style="max-width:230px;height:58px;object-fit:contain"></div><div class="sub-heading" style="font-size:20px">Monthly Package Includes</div>${MDS_REPORT_PROOF_POINTS.map(item => `<div class="check"><span>&#10003;</span><div>${item}</div></div>`).join('')}<div class="check"><span>&#10003;</span><div>In-house CPA, controller, account managers, and bookkeepers supporting tax returns, collections, budgets, and custom board reports.</div></div></div><div><div class="visual-card" style="padding:18px;margin-bottom:14px"><div class="sub-heading" style="font-size:18px">Reporting Cadence</div>${[['Close + reconciliation', 80], ['Board package QA', 88], ['Management report delivery by 20th-25th', 96], ['Follow-up action list', 76]].map(([label, pct]) => `<div style="margin-bottom:13px"><div style="font-size:12px;font-weight:800;color:#1a2744">${label}</div><div class="mini-bar"><span style="width:${pct}%"></span></div></div>`).join('')}</div><div class="gold-card"><div class="sub-heading" style="font-size:18px">Why It Matters</div><p class="small">Boards should not chase basic financial answers. Camelot can deliver recurring financials, budget comparisons, arrears tracking, disbursement backup, paid-invoice images, and accounting advisory so meetings focus on decisions instead of missing data.</p></div></div></div><div class="source-note">Sources: MDS sample report packages uploaded by Camelot | monthly reporting cadence supplied by Camelot.</div></div></div>`;
}

function onboardingChecklistSlide(d: MasterReportData): string {
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Onboarding Checklist</div><p class="body-text" style="margin-bottom:16px">Full onboarding can begin immediately. With your tax ID and articles of incorporation we open the entity\u2019s bank account within 48 hours; with the resident roster we are operational inside two weeks \u2014 and a written transition document drives an orderly handoff with your exiting manager from day one.</p><div style="display:grid;grid-template-columns:1fr .9fr;gap:18px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${ONBOARDING_CHECKLIST.map((item, idx) => `<div class="gold-card" style="padding:13px 14px"><div style="font-size:11px;color:#B8973A;font-weight:900;letter-spacing:1px;margin-bottom:3px">STEP ${idx + 1}</div><div style="font-size:13px;font-weight:800;color:#1a2744;line-height:1.35">${item}</div></div>`).join('')}</div><div style="display:grid;gap:10px"><div class="visual-card" style="padding:12px">${contextualImageCard(d, 2, 'Subject property or neighborhood image used to anchor transition planning', 142)}</div><div class="visual-card" style="padding:18px"><div class="sub-heading" style="font-size:20px">90-Day Transition Rhythm</div>${[['Month 1 \u2014 Files, Banking, Data Download', 34], ['Month 2 \u2014 Residents, Vendors, City Agencies', 67], ['Month 3 \u2014 Inspection, Audit Gut-Check, Agenda', 100]].map(([label, pct]) => `<div style="margin:12px 0"><div style="font-size:13px;font-weight:900;color:#1a2744">${label}</div><div class="mini-bar" style="height:12px"><span style="width:${pct}%"></span></div></div>`).join('')}<div class="small">By day 90: accounts live, records in-house, residents met, vendors toured, agencies renoticed, a full site inspection delivered, and a written account of what we accomplished \u2014 then we sit down with ownership to set the agenda together.</div></div></div></div><div class="source-note">Sources: Camelot transition procedures, rental portfolio transition case-study workflow, and Jackie 90-day onboarding model.</div></div></div>`;
}

function standardAgreementSlide(): string {
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Agreement &amp; Fee Structure</div><p class="body-text" style="margin-bottom:18px">The board-facing proposal should be simple, but backed by a clean agreement structure.</p><div style="display:grid;grid-template-columns:1.05fr .95fr;gap:18px"><div class="gold-card"><div class="sub-heading" style="font-size:20px">Agreement Principles</div>${STANDARD_AGREEMENT_PROOF_POINTS.map(item => `<div class="check"><span>&#10003;</span><div>${item}</div></div>`).join('')}</div><div class="gold-card"><div class="sub-heading" style="font-size:20px">Pricing Position</div><p class="body-text">Camelot should remain transparent on the core management fee, show value against the market, and keep non-core additional services clearly separated so the board understands what is included and what is charged by scope, unit event, or hourly rate.</p></div></div><div class="source-note">Source: Camelot condo/co-op management agreement and proposed rate-sheet template supplied by Camelot.</div></div></div>`;
}

function hoaCoverLetter(d: MasterReportData): string {
  const contact = d.reportFocus?.inquiryContact || 'Carlos Capria';
  const contactMeta = [
    d.reportFocus?.inquiryRole,
    d.reportFocus?.inquiryOrganization,
    d.reportFocus?.inquiryEmail,
    d.reportFocus?.inquiryPhone,
  ].filter(Boolean).map(item => escapeHtml(String(item))).join(' | ');
  return `<div style="font-family:'Cormorant Garamond',Georgia,serif;color:#1a2744;font-size:17px;line-height:1.56">${contactMeta ? `<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;color:#B8973A;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px">${contactMeta}</div>` : ''}<p style="margin-bottom:13px"><strong style="font-family:'Plus Jakarta Sans',sans-serif;font-size:13px">Dear ${escapeHtml(contact)},</strong> thank you for the opportunity to introduce Camelot Property Management Services Corp. to the Hills of Monroe Condominium. We understand the community is navigating the operational pressure that follows a winter-related loss event, including insurance coordination, restoration oversight, vendor accountability, board communication, and the need for a more organized operating cadence.</p><p style="margin-bottom:13px">Camelot can support the board with financial organization, monthly reporting, budgeting, board support, vendor tracking, insurance-file coordination, resident communication systems, and a modern portal workflow through tools such as Concierge Plus and MDS. For the on-site project management and facilities layer, we recommend treating that as a scoped local field-operations component tied to the board's actual workload and inspection cadence.</p><p style="margin-bottom:20px">With your permission, projected fees for our services would be quantified after we review the association's available financial materials, such as the prior property manager report, last audited financials, or most recent budget. Those records help us identify strengths, weaknesses, cost pressures, and practical savings opportunities so we can shape a meaningful budget and an economical solution for both sides before presenting a formal proposal and contract.</p>${davidGoldoffClientSignatureHtml()}</div>`;
}

function hoaBulletList(items: string[]): string {
  return items.map(item => `<div class="check"><span>&#10003;</span><div>${item}</div></div>`).join('');
}

function hoaLayerCard(title: string, copy: string, icon: string): string {
  return `<div class="gold-card" style="min-height:132px"><div style="display:flex;gap:12px;align-items:flex-start"><div class="icon-tile">${icon}</div><div><div class="sub-heading" style="font-size:17px;margin-bottom:5px">${title}</div><p class="small">${copy}</p></div></div></div>`;
}

function hoaExecutiveSummarySlide(d: MasterReportData): string {
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Executive Summary</div><div style="display:grid;grid-template-columns:1fr .92fr;gap:20px;align-items:stretch"><div><div class="gold-card" style="margin-bottom:12px"><div class="sub-heading">What This Deck Is</div><p class="body-text" style="font-size:14px;line-height:1.55">This is a board-meeting pitch deck, not a final management agreement or binding proposal. It is meant to introduce Camelot, frame the likely operating issues at Hills of Monroe Condominium, and outline how we would help the board think through management, financial reporting, field support, claim coordination, technology, and pricing.</p></div><div class="gold-card"><div class="sub-heading">An Executive Operating Partner</div><p class="body-text" style="font-size:14px;line-height:1.55">Camelot is not simply a bookkeeping management company. For Hills of Monroe, Camelot would operate as an executive operational partner: organizing financial reporting, stabilizing communication, coordinating vendors, tracking restoration work, supporting the board, and preserving the community's long-term asset value.</p><p class="small" style="margin-top:10px">A formal proposal of services, fee schedule, and management agreement would follow after reviewing financials, budgets, claim documents, staffing expectations, and field-operations cadence.</p></div></div><div>${iframeCard(placeEmbedUrl(d), 'Hills of Monroe location map', 'Community location context for board discussion', 360)}<div class="gold-card" style="margin-top:12px;padding:12px 14px"><div class="sub-heading" style="font-size:16px;margin-bottom:6px">Discussion Focus</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${['Financial visibility', 'Claims oversight', 'Local field support', 'Vendor accountability'].map(item => `<div style="font-size:12px;font-weight:800;color:#1a2744;background:#FAF8F5;border:1px solid rgba(184,151,58,.25);border-radius:6px;padding:7px 9px">${item}</div>`).join('')}</div></div></div></div><div class="source-note">Board-meeting discussion deck prepared by Camelot Property Management Services Corp.; formal proposal and contract terms to follow after diligence.</div></div></div>`;
}

function hoaModelSlide(): string {
  const layers = [
    ['Executive Management Layer', 'Senior oversight, board advisory, decision logs, escalation control, and owner-minded accountability.', 'GM'],
    ['Financial Operations Layer', 'Budgeting, AP, collections, reserves, variance review, banking coordination, and monthly executive reports.', '$'],
    ['Regional Field Operations Layer', 'Weekly or biweekly inspections, photo reporting, vendor walkthroughs, and storm preparation monitoring.', 'OPS'],
    ['Vendor & Claims Coordination Layer', 'Restoration timelines, contractor accountability, public adjuster collaboration, documentation, and budget tracking.', 'PM'],
    ['Technology & Reporting Layer', 'Cloud files, dashboards, work orders, board packets, AI-assisted summaries, and resident communication systems.', 'AI'],
  ];
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Camelot Hybrid Management Model</div><p class="body-text" style="margin-bottom:16px">The model gives the HOA executive leadership, clean financial controls, local eyes on the property, and modern reporting without forcing the community into a one-size-fits-all large-firm structure.</p><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">${layers.map(([title, copy, icon]) => hoaLayerCard(title, copy, icon)).join('')}</div><div class="source-note">Hybrid management structure prepared for Hills of Monroe Condominium.</div></div></div>`;
}

function hoaOperationalAssessmentSlide(): string {
  const needs = ['Seasonal weather exposure and snow/ice risk', 'Roofing, drainage, and exterior envelope review', 'Insurance claim coordination and documentation control', 'Vendor management and contractor accountability', 'Resident communication during restoration work', 'Reserve planning and deferred maintenance risk', 'Board workload reduction and decision support', 'Long-term operating calendar and capital roadmap'];
  const facts = [
    ['Unit types', 'Townhouse and single-family detached homes'],
    ['Bedrooms', '1, 2, and 3 bedroom homes'],
    ['Built', '1987-1994 public profile range'],
    ['Community features', 'Gated setting, quiet wooded cul-de-sac context'],
    ['Amenities', 'Pool, paddle tennis, clubhouse, guest parking'],
    ['Known streets', 'Windgate Circle, Kensington Road, Ivy Lane'],
  ];
  const market = [
    ['Active listings', '2 homes for sale: 202 Windgate Circle at $335,000 and 5 Kensington Road at $510,000'],
    ['Recent activity', '11 homes sold in the past 12 months'],
    ['Latest sales', '208 Windgate Circle sold at $380,000 and $389,000; 302 Fairmount Drive sold at $389,900'],
    ['Sale pace', 'Recent examples showed 37-78 days on market and 100-101% sale-to-list ratios'],
  ];
  return `<div class="slide"><div class="pad" style="padding:46px 64px">${logoBadge()}<div class="section-title" style="margin-bottom:16px">Understanding Hills of Monroe</div><div style="display:grid;grid-template-columns:.88fr 1.12fr;gap:16px"><div style="display:grid;gap:10px">${imageCard(HOA_ARCHITECTURE_IMAGE, 'Hills of Monroe community exterior', 'Public community image sourced from Dagny\'s Real Estate profile', 230)}${imageCard(HOA_WINDGATE_IMAGE, 'Windgate Circle listing image', 'Subject-area condominium image from Dagny\'s public listing feed', 150)}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="gold-card" style="padding:13px 15px"><div class="sub-heading" style="font-size:17px">Community Snapshot</div><table>${facts.map(([label, value]) => `<tr><td style="font-weight:800;color:#1a2744;padding:5px 6px;font-size:11px">${label}</td><td style="padding:5px 6px;font-size:11px">${value}</td></tr>`).join('')}</table></div><div class="gold-card" style="padding:13px 15px"><div class="sub-heading" style="font-size:17px">Current Market Signals</div><table>${market.map(([label, value]) => `<tr><td style="font-weight:800;color:#1a2744;padding:5px 6px;font-size:11px">${label}</td><td style="padding:5px 6px;font-size:11px">${value}</td></tr>`).join('')}</table></div><div class="gold-card" style="grid-column:1 / span 2;padding:13px 15px"><div class="sub-heading" style="font-size:18px">Operational Assessment</div><p class="body-text" style="font-size:13px;line-height:1.45;margin-bottom:8px">The community's immediate need is stabilization: clear records, visible timelines, accountable vendors, consistent board communication, and a recovery plan that turns a loss event into a more professional operating platform.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">${needs.map(item => `<div class="check" style="font-size:12px;margin-bottom:6px"><span style="width:18px;height:18px;font-size:10px">&#10003;</span><div>${item}</div></div>`).join('')}</div></div></div></div><div class="source-note">Sources: Dagny's Real Estate Hills of Monroe profile, SmartMLS listing references displayed by Dagny, Zillow/Apartments.com/Yelp/local CT condo search stack, and user-provided HOA operating brief.</div></div></div>`;
}

function hoaFailuresSlide(): string {
  const rows = [
    ['Reactive management', 'Create a 30-60-90 operating command center and board-facing action log'],
    ['Poor communication', 'Weekly executive summaries during active restoration and monthly board packets after stabilization'],
    ['Weak vendor oversight', 'Bid leveling, scope review, COI tracking, timeline control, and photo documentation'],
    ['Inconsistent reporting', 'Standard monthly financial and operational dashboard cadence'],
    ['Poor claims management', 'Public adjuster collaboration, damage documentation, budget tracking, and resident updates'],
  ];
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Common HOA Management Failures</div><div style="display:grid;grid-template-columns:1fr .34fr;gap:16px;align-items:stretch"><div><table><thead><tr><th>Traditional Failure</th><th>Camelot Response</th></tr></thead><tbody>${rows.map(([a, b]) => `<tr><td><strong>${a}</strong></td><td>${b}</td></tr>`).join('')}</tbody></table><div class="gold-card" style="margin-top:16px"><p class="body-text" style="font-size:15px">The goal is not to overwhelm the community with bureaucracy. The goal is to make the important work visible, assignable, measurable, and calm.</p></div></div><div style="display:grid;gap:10px">${[['COMMS', 'Communication cadence'], ['VENDOR', 'Vendor accountability'], ['BOARD', 'Decision support'], ['FILES', 'Document control']].map(([icon, copy]) => `<div class="visual-card" style="padding:16px;text-align:center;display:flex;flex-direction:column;justify-content:center"><div style="width:54px;height:54px;border-radius:16px;background:#34444f;color:#B8973A;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;letter-spacing:.7px">${icon}</div><div style="font-size:13px;font-weight:900;color:#1a2744">${copy}</div></div>`).join('')}</div></div><div class="source-note">Prepared for HOA board discussion.</div></div></div>`;
}

function hoaFieldOpsSlide(): string {
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Local Field &amp; Project Management Support</div><div style="display:grid;grid-template-columns:1fr .92fr;gap:22px"><div><div class="gold-card" style="margin-bottom:12px"><div class="sub-heading">What This Layer Solves</div>${hoaBulletList(['On-site condition checks several times per month or as needed', 'Project manager / facilities coordinator for contractor follow-up', 'Subcontractor walkthroughs, punch lists, and photo documentation', 'Resident and board escalation support tied to active work', 'Attendance at selected board meetings when field issues require explanation', 'Board-ready summary of open items, blockers, vendor accountability, and next actions'])}</div><div class="gold-card" style="background:#34444f;color:#fff"><div class="sub-heading" style="color:#B8973A">Recommended Positioning</div><p class="small" style="color:rgba(255,255,255,.86)">Camelot should present this as a scoped add-on, not an assumed all-inclusive promise. The board can choose a retainer, hourly site visits, or a project-specific field coordinator once the budget, claim files, service expectations, and inspection cadence are clear.</p></div></div>${imageCard(HOA_KENSINGTON_IMAGE, 'Kensington Road community reference', 'Local site support keeps contractor work, resident issues, and board reporting connected to executive oversight', 430)}</div><div class="source-note">Regional field scope to be finalized after reviewing rent roll, budget, financials, claim documents, vendor contracts, and board expectations. Community imagery sourced from Dagny's public CT condo listing feed.</div></div></div>`;
}

function hoaClaimsSlide(): string {
  const steps = ['Loss intake and file organization', 'Damage photo/document control', 'Public adjuster and carrier coordination', 'Restoration scope and vendor tracking', 'Timeline, budget, and change-order control', 'Resident and board communication cadence', 'Closeout package, warranties, and lessons learned'];
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Insurance &amp; Restoration Oversight</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-top:16px">${steps.map((step, idx) => `<div class="gold-card" style="min-height:205px;padding:14px 10px"><div class="stat-val" style="font-size:28px">${idx + 1}</div><div style="font-size:12px;font-weight:900;color:#1a2744;line-height:1.32;margin-top:8px">${step}</div></div>`).join('')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px"><div class="gold-card"><div class="sub-heading" style="font-size:18px">Separate-Cover Scope</div><p class="small">Claims and restoration oversight should be scoped separately from base management. The board should set expectations around documentation, carrier response, public-adjuster strategy, contractor timing, approvals, and reporting cadence.</p></div><div class="gold-card"><div class="sub-heading" style="font-size:18px">Carrier Strategy</div><p class="small">Insurance carriers often resist paying full claim value, and certain claim activity can affect renewal posture. Camelot works with the board and trusted public adjusters, including Eastern Public Adjusters where appropriate, to approach claims carefully, document leverage, and pursue the strongest recoverable outcome.</p></div></div><div class="source-note">Claims workflow based on Camelot restoration experience; claim advocacy and public-adjuster work to be handled under separate cover where applicable.</div></div></div>`;
}

function hoaTechnologySlide(): string {
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Technology &amp; Reporting</div><div style="display:grid;grid-template-columns:.95fr 1.05fr;gap:22px"><div class="gold-card"><div class="sub-heading">Reporting Stack</div>${hoaBulletList(['MDS accounting reports and monthly board package cadence', 'ConciergePlus resident portal for service requests, payments, amenities, files, and administrative tickets', 'BankUnited banking workflow with zero-fee customer banking, lockbox, and balance visibility', 'Cloud-based document management', 'Vendor tracking and open-item logs', 'Inspection photos and work order workflows', 'AI-assisted operational summaries'])}</div><div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px"><div class="visual-card" style="height:98px;display:flex;align-items:center;justify-content:center"><img src="${MDS_LOGO_IMAGE}" alt="MDS" style="max-width:210px;max-height:64px;object-fit:contain"></div><div class="visual-card" style="height:98px;display:flex;align-items:center;justify-content:center"><img src="${BANKUNITED_LOGO_IMAGE}" alt="BankUnited" style="max-width:210px;max-height:56px;object-fit:contain"></div><div class="visual-card" style="height:98px;display:flex;align-items:center;justify-content:center"><img src="${SELECT_BRAND_IMAGE}" alt="Select" style="max-width:210px;max-height:64px;object-fit:contain;background:#000;padding:8px;border-radius:4px"></div><div class="visual-card" style="height:98px;display:flex;align-items:center;justify-content:center"><img src="${PVEDI_LOGO_IMAGE}" alt="PVEDI Engineering" style="max-width:230px;max-height:64px;object-fit:contain"></div></div><img src="${CONCIERGE_PLUS_PLATFORM_IMAGE}" alt="ConciergePlus product suite" style="width:100%;height:245px;object-fit:contain"></div></div><div class="source-note">Technology stack customized to board needs and association records. Sources: MDS, ConciergePlus, BankUnited, Select, and PVEDI official partner materials.</div></div></div>`;
}

function hoaFinancialSlide(): string {
  const services = [
    ['AP', 'Accounts payable and invoice controls'],
    ['AR', 'Collections and delinquency tracking'],
    ['BUD', 'Budget preparation and variance analysis'],
    ['RES', 'Reserve coordination and capital planning'],
    ['BNK', 'Banking coordination and reconciliation'],
    ['RPT', 'Monthly executive reports by the 20th-25th'],
    ['AUD', 'Audit coordination and CPA review'],
    ['CLM', 'Insurance proceeds and claim-cost tracking'],
  ];
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Financial Management Services</div><div style="display:grid;grid-template-columns:.92fr 1.08fr;gap:18px;align-items:stretch"><div><div class="gold-card" style="margin-bottom:12px"><div style="height:44px;margin-bottom:8px"><img src="${MDS_LOGO_IMAGE}" alt="MDS property management software" style="max-width:190px;height:44px;object-fit:contain"></div><div class="sub-heading" style="font-size:20px">Board-Ready Financial Control</div><p class="small" style="margin-bottom:10px">Camelot uses MDS reporting workflows, in-house CPA/accounting oversight, and a recurring monthly close cadence so the board can see cash, claims, payables, receivables, reserves, and variance issues without chasing the basics.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${services.map(([icon, label]) => `<div style="display:flex;gap:8px;align-items:flex-start;background:#FAF8F5;border:1px solid rgba(184,151,58,.22);border-radius:7px;padding:8px"><div style="width:32px;height:32px;border-radius:8px;background:#34444f;color:#B8973A;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;letter-spacing:.5px;flex-shrink:0">${icon}</div><div style="font-size:11px;line-height:1.35;font-weight:750;color:#1a2744">${label}</div></div>`).join('')}</div></div><div class="gold-card" style="padding:13px 15px"><div class="sub-heading" style="font-size:18px">Financial Controls</div><p class="small">AP controls, budget and reserve visibility, claim-cost tracking, and board reporting cadence are handled as part of one monthly financial operating rhythm.</p></div></div><div class="visual-card" style="padding:14px;background:linear-gradient(135deg,#fff,#F4EFE2)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div><div class="sub-heading" style="font-size:18px;margin-bottom:2px">Sample Monthly Report</div><div class="small">Illustrative MDS cash-flow report package page</div></div><div style="font-size:11px;font-weight:900;color:#B8973A;letter-spacing:1.4px">MDS REPORTING</div></div><div style="height:418px;border:1px solid rgba(26,31,54,.22);background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="${MDS_SAMPLE_FINANCIAL_REPORT_IMAGE}" alt="MDS sample financial cash flow report" style="width:100%;height:100%;object-fit:contain"></div></div></div><div class="source-note">Financial scope based on monthly executive HOA reporting model. Image source: uploaded MDS Property Management Software sample report package.</div></div></div>`;
}

function hoaTransitionSlide(): string {
  const cols = [
    ['30 Days: Assessment', ['Document collection', 'Vendor and contract review', 'Financial and banking review', 'Insurance claim file review', 'Initial operational assessment']],
    ['60 Days: Stabilization', ['Reporting implementation', 'Project coordination systems', 'Board communication cadence', 'Vendor oversight rhythm', 'Resident issue process']],
    ['90 Days: Optimization', ['Strategic planning', 'Reserve review', 'Operating calendar', 'Capital planning roadmap', 'Performance review']],
  ] as const;
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">30-60-90 Day Transition Plan</div><p class="body-text" style="font-size:14px;margin-bottom:14px">This transition begins after signing, deposit, banking setup, contact transfer, and board authorization to access association records.</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">${cols.map(([title, items]) => `<div class="gold-card" style="min-height:360px"><div class="sub-heading">${title}</div>${hoaBulletList([...items])}</div>`).join('')}</div><div class="source-note">Transition plan begins post-signing and after management handoff authority, bank account setup, owner/resident contacts, and prior-manager records are received.</div></div></div>`;
}

function hoaServiceStructureSlide(): string {
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Proposed Service Structure</div><p class="body-text" style="font-size:14px;margin-bottom:12px">These figures are planning estimates, not final contract pricing. Once Camelot receives financials, budgets, claim material, service expectations, and vendor/staff data, we can produce a concise proposal of services and formal management agreement with rate sheet.</p><table><thead><tr><th>Service Component</th><th>Illustrative Structure</th><th>Purpose</th></tr></thead><tbody><tr><td><strong>Core Executive Management</strong></td><td>$4,500-$7,500/month</td><td>Financial oversight, monthly reporting, board support, resident portal workflow, vendor tracking, budget discipline</td></tr><tr><td><strong>Local Field Operations Retainer</strong></td><td>$1,500-$3,500/month</td><td>Set number of monthly site visits, photo reports, vendor walkthroughs, storm prep, resident/service issue escalation</td></tr><tr><td><strong>Hourly Field / Facilities Support</strong></td><td>$95-$150/hour, plus approved travel/admin where applicable</td><td>Flexible option when inspection frequency is not yet known; useful during the first 60-90 days</td></tr><tr><td><strong>Project &amp; Claims Oversight</strong></td><td>Separate consulting/project fee</td><td>Claim files, restoration timeline, contractor accountability, punch lists, documentation, board reporting</td></tr><tr><td><strong>Capital Project Coordination</strong></td><td>Hourly, fixed, or percentage-based</td><td>Bid leveling, scope management, change-order review, closeout, selected board meeting attendance</td></tr></tbody></table><p class="small" style="margin-top:12px">Recommended approach: start with core executive management plus an hourly or limited-retainer field layer until the actual workload is known.</p><div class="source-note">Illustrative fee ranges supplied by Camelot for HOA proposal discussion; final rates depend on financial review, local staffing availability, and agreed field cadence.</div></div></div>`;
}

function hoaChecklistSlide(): string {
  const tools = [
    ['FILE', 'Assessment Checklist', ['Insurance claim file', 'Vendor contracts and COIs', 'Open restoration items', 'Reserve study and capital list']],
    ['ASK', 'Board Interview Questions', ['What is most urgent?', 'Where is communication breaking down?', 'Which vendors are underperforming?', 'What does success look like in 90 days?']],
    ['SITE', 'Inspection Template', ['Area inspected', 'Photo evidence', 'Risk level', 'Responsible vendor', 'Next action and due date']],
    ['BID', 'Vendor Workflow', ['Scope', 'Bid', 'COI', 'Schedule', 'Progress photos', 'Invoice approval', 'Closeout']],
  ];
  const workflow = [
    ['1', 'Collect', 'Files, insurance, vendors, financials'],
    ['2', 'Diagnose', 'Risk, scope, priority, owner'],
    ['3', 'Assign', 'Vendor, due date, board approval'],
    ['4', 'Report', 'Photo proof, costs, blockers, next action'],
  ];
  return `<div class="slide"><div class="pad" style="padding:46px 64px">${logoBadge()}<div class="section-title" style="margin-bottom:16px">Operational Tools</div><div style="display:grid;grid-template-columns:1.08fr .92fr;gap:16px;align-items:stretch"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${tools.map(([icon, title, items]) => `<div class="gold-card" style="padding:12px 14px;min-height:174px"><div style="display:flex;gap:9px;align-items:center;margin-bottom:6px"><div style="width:38px;height:38px;border-radius:10px;background:#34444f;color:#B8973A;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;letter-spacing:.6px">${icon}</div><div class="sub-heading" style="font-size:16px;margin:0">${title}</div></div>${(items as string[]).map(item => `<div class="check" style="font-size:11px;line-height:1.25;margin-bottom:5px"><span style="width:17px;height:17px;font-size:9px">&#10003;</span><div>${item}</div></div>`).join('')}</div>`).join('')}</div><div><div class="visual-card" style="padding:14px;margin-bottom:10px;background:linear-gradient(135deg,#34444f,#1a2744);color:#fff"><div class="sub-heading" style="font-size:18px;color:#B8973A;margin-bottom:6px">Operating Command Center</div><p class="small" style="color:rgba(255,255,255,.84);margin-bottom:9px">Each tool turns board concerns into assigned work: visible files, clear questions, photo-backed inspections, vendor accountability, and executive summaries.</p><div style="display:grid;gap:7px">${workflow.map(([num, title, copy]) => `<div style="display:flex;gap:9px;align-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(184,151,58,.32);border-radius:8px;padding:8px"><div style="width:30px;height:30px;border-radius:50%;background:#B8973A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900">${num}</div><div><div style="font-size:12px;font-weight:900;color:#fff">${title}</div><div style="font-size:10px;color:rgba(255,255,255,.72)">${copy}</div></div></div>`).join('')}</div></div><div class="visual-card" style="padding:12px"><div class="sub-heading" style="font-size:15px;margin-bottom:7px">Outputs the Board Receives</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">${['Action log', 'Photo report', 'Vendor tracker', 'Claims tracker', 'Board packet', 'Closeout file'].map(item => `<div style="border:1px solid rgba(184,151,58,.28);background:#FAF8F5;border-radius:7px;padding:8px 9px;font-size:11px;font-weight:800;color:#1a2744">${item}</div>`).join('')}</div></div></div></div><div class="source-note">Additional deliverables: one-page sheet, service menu, Why Camelot page, claims workflow, vendor workflow, cover letter.</div></div></div>`;
}

function hoaWhyCamelotSlide(): string {
  return `<div class="slide"><div class="pad">${logoBadge()}<div class="section-title">Why Camelot</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div class="gold-card">${hoaBulletList(['Boutique attention with institutional systems', 'Executive oversight and responsive leadership', 'Financial discipline and monthly reporting', 'Claims/restoration coordination experience', 'Technology-enabled operations'])}</div><div class="gold-card">${hoaBulletList(['Vendor accountability', 'Regional scalability', 'Long-term asset preservation', 'Board support without unnecessary complexity', 'Calm operating cadence during stressful events'])}</div></div><div class="gold-card" style="margin-top:18px;background:#34444f;color:#fff"><p style="font-size:19px;line-height:1.55;color:#fff">Camelot combines executive-level financial and operational oversight with localized field operations support, allowing communities to benefit from institutional-quality management systems without the overhead of traditional large-scale property management firms.</p></div><div class="source-note">Positioning statement prepared for Hills of Monroe Condominium.</div></div></div>`;
}

function hoaClosingSlide(d: MasterReportData): string {
  return `<div class="slide slide-dark"><div class="pad">${logoBadge()}<div style="height:100%;display:flex;flex-direction:column;justify-content:center;text-align:center;max-width:980px;margin:0 auto"><div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:56px;font-style:italic;color:#B8973A;margin-bottom:16px">A Calmer Operating Platform</div><p style="font-size:21px;line-height:1.55;color:rgba(255,255,255,.86);margin-bottom:28px">Camelot would welcome the opportunity to help Hills of Monroe Condominium stabilize operations, organize the recovery process, support the board, and preserve the community's long-term value.</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:24px"><a href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Camelot+HOA+Management+Discussion+-+Hills+of+Monroe&details=${encodeURIComponent('Discussion with Carlos Capria and Hills of Monroe Condominium regarding Camelot HOA Executive Management & Recovery Services Proposal.')}&add=${CAMELOT_CONTACT_EMAIL}" target="_blank" style="background:#B8973A;color:#fff;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:12px;font-weight:700">Google Meet</a><a href="https://zoom.us/start/videomeeting" target="_blank" rel="noopener" style="background:#2D8CFF;color:#fff;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:12px;font-weight:700">Zoom</a><a href="tel:+12122069939;ext=701" style="background:#fff;color:#314655;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:12px;font-weight:700">Call 212-206-9939 x701</a></div><div style="font-size:15px;color:rgba(255,255,255,.82);line-height:1.9"><strong style="color:#B8973A">${CAMELOT_CONTACT_NAME}, ${CAMELOT_CONTACT_TITLE}</strong><br>${CAMELOT_PHONE}<br>${CAMELOT_CONTACT_EMAIL} | ${CAMELOT_GENERAL_EMAIL}<br>${CAMELOT_WEBSITE}<br>${CAMELOT_OFFICE_ADDRESS}</div></div></div></div>`;
}

function hoaSubjectHeroImage(d: MasterReportData): string {
  return d.buildingPhotos?.exterior?.[0]
    || d.commercialIntel?.brandingImages?.[0]
    || d.streetEasy?.photos?.[0]
    || HOA_ARCHITECTURE_IMAGE;
}

function generateHoaFirstEmailIntroReport(d: MasterReportData): string {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const heroImage = hoaSubjectHeroImage(d);
  const slides = `
<div class="slide slide-dark"><div style="position:absolute;inset:0"><img src="${heroImage}" alt="${escapeHtml(d.buildingName || d.address)} subject community exterior" style="width:100%;height:100%;object-fit:cover;opacity:.42" onerror="this.src='${HOA_ARCHITECTURE_IMAGE}'"></div><div style="position:absolute;inset:0;background:linear-gradient(105deg,rgba(10,16,24,.98),rgba(34,47,58,.82),rgba(34,47,58,.32))"></div><div class="pad" style="position:relative;z-index:3">${logoBadge()}<div style="height:100%;display:flex;flex-direction:column;justify-content:center;max-width:760px"><div style="font-size:13px;color:#B8973A;text-transform:uppercase;letter-spacing:2.5px;font-weight:800">Camelot HOA Executive Management &amp; Recovery Services Proposal</div><h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:68px;line-height:.95;color:#F4D26A;font-style:italic;margin:12px 0">Hills of Monroe Condominium</h1><p style="font-size:21px;color:rgba(255,255,255,.86);line-height:1.55">Executive management, community operations, claims oversight, and long-term asset preservation.</p><p style="font-size:12px;color:rgba(255,255,255,.58);margin-top:28px">Prepared for Carlos Capria - Prepared by Camelot Property Management Services Corp. - ${today}</p></div></div></div>
<div class="slide"><div class="pad" style="padding:56px 86px">${logoBadge()}<div class="section-title" style="margin-bottom:20px">Cover Letter</div><div style="max-width:900px;background:#fff;border:1px solid rgba(184,151,58,.38);border-left:5px solid #B8973A;border-radius:6px;padding:34px 42px;box-shadow:0 14px 28px rgba(26,31,54,.06)">${hoaCoverLetter(d)}</div><div class="source-note">Prepared by Camelot Property Management Services Corp. for Hills of Monroe Condominium.</div></div></div>
${hoaExecutiveSummarySlide(d)}
${hoaOperationalAssessmentSlide()}
${hoaModelSlide()}
${hoaFieldOpsSlide()}
${hoaClaimsSlide()}
${hoaClosingSlide(d)}`;
  return deckShell('Camelot HOA Executive Management Proposal - Hills of Monroe Condominium', slides);
}

function generateHoaBoardMeetingDeck(d: MasterReportData): string {
  const heroImage = hoaSubjectHeroImage(d);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const slides = `
<div class="slide slide-dark"><div style="position:absolute;inset:0"><img src="${heroImage}" alt="${escapeHtml(d.buildingName || d.address)} subject community exterior" style="width:100%;height:100%;object-fit:cover;opacity:.38" onerror="this.src='${HOA_ARCHITECTURE_IMAGE}'"></div><div style="position:absolute;inset:0;background:linear-gradient(105deg,rgba(10,16,24,.98),rgba(34,47,58,.86),rgba(34,47,58,.38))"></div><div class="pad" style="position:relative;z-index:3">${logoBadge()}<div style="height:100%;display:flex;flex-direction:column;justify-content:center;max-width:850px"><div style="font-size:13px;color:#B8973A;text-transform:uppercase;letter-spacing:2.5px;font-weight:800">Camelot Property Management Services Corp.</div><h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:64px;line-height:.96;color:#F4D26A;font-style:italic;margin:12px 0">Hills of Monroe Condominium</h1><p style="font-size:21px;color:rgba(255,255,255,.86);line-height:1.55">Board Meeting Pitch Deck: Executive Management, Community Operations, Field Support, Financial Reporting, and Recovery Coordination</p><div style="margin-top:26px;display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:720px"><div style="border-left:3px solid #B8973A;background:rgba(255,255,255,.08);padding:10px 12px"><div style="font-size:10px;color:#B8973A;text-transform:uppercase;letter-spacing:1.4px;font-weight:900">Prepared For</div><div style="font-size:14px;color:#fff;font-weight:800">Carlos Capria, Board President</div><div style="font-size:12px;color:rgba(255,255,255,.72)">Hills of Monroe Condominium</div></div><div style="border-left:3px solid #B8973A;background:rgba(255,255,255,.08);padding:10px 12px"><div style="font-size:10px;color:#B8973A;text-transform:uppercase;letter-spacing:1.4px;font-weight:900">Prepared By</div><div style="font-size:14px;color:#fff;font-weight:800">Camelot Property Management Services Corp.</div><div style="font-size:12px;color:rgba(255,255,255,.72)">${today}</div></div></div></div></div></div>
<div class="slide"><div class="pad" style="padding:56px 86px">${logoBadge()}<div class="section-title" style="margin-bottom:20px">Cover Letter</div><div style="max-width:900px;background:#fff;border:1px solid rgba(184,151,58,.38);border-left:5px solid #B8973A;border-radius:6px;padding:34px 42px;box-shadow:0 14px 28px rgba(26,31,54,.06)">${hoaCoverLetter(d)}</div><div class="source-note">Prepared by Camelot Property Management Services Corp. for Carlos Capria and the Hills of Monroe Condominium board.</div></div></div>
${hoaExecutiveSummarySlide(d)}
<div class="slide"><div class="pad" style="padding:46px 64px">${logoBadge()}<div class="section-title" style="margin-bottom:16px">About Camelot</div><div style="display:grid;grid-template-columns:.92fr 1.08fr;gap:16px"><div><div class="gold-card" style="margin-bottom:12px"><div class="sub-heading">Track Record &amp; Reach</div>${hoaBulletList([`Founded in ${CAMELOT_PROFILE.foundedYear} and built as a hands-on boutique operator`, `${CAMELOT_PROFILE.buildingsManaged} buildings under management; ${CAMELOT_PROFILE.assetsUnderManagement} AUM (${CAMELOT_PROFILE.assetsUnderManagementNote})`, `Current and prior Camelot OS records track ${CAMELOT_PROFILE.unitsTracked} units across active and historical client work`, 'Experience across co-ops, condos, rentals, mixed-use assets, and board-led communities', 'Current service footprint: NYC, the five boroughs, Riverdale, Westchester, New Jersey, virtual operations, Florida / northern Miami, South Carolina, and soon Connecticut'])}</div><div class="gold-card"><div class="sub-heading">Operating Bench</div>${hoaBulletList(['Licensed REBNY Managing Agent & Brokerage', 'In-house CPA and accounting leadership', 'Attorney-led governance and contract review support', 'Brokerage, compliance, facilities, project-management, and technology resources', 'MDS, ConciergePlus, BankUnited, Select, and PVEDI partner ecosystem'])}</div></div><div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px"><img src="/images/case-studies/949-park.jpg" alt="949 Park Avenue" style="width:100%;height:145px;object-fit:cover;border-radius:8px;border:1px solid rgba(184,151,58,.32)"><img src="/images/case-studies/301-east-50th.png" alt="301 East 50th Street" style="width:100%;height:145px;object-fit:cover;border-radius:8px;border:1px solid rgba(184,151,58,.32)"><img src="/images/case-studies/rental-portfolio.jpg" alt="Camelot rental portfolio" style="width:100%;height:145px;object-fit:cover;border-radius:8px;border:1px solid rgba(184,151,58,.32)"><img src="/images/one-museum-mile/building-picture.webp" alt="One Museum Mile" style="width:100%;height:145px;object-fit:cover;border-radius:8px;border:1px solid rgba(184,151,58,.32)"></div><div class="gold-card" style="padding:12px 14px"><p class="small">Camelot combines senior attention, financial discipline, real property-management experience, and practical technology so boards get a management partner that can operate locally, report clearly, and coordinate work across multiple disciplines.</p></div><div style="margin-top:10px">${camelotAssociationLogoGrid(54)}</div></div></div><div class="source-note">Sources: Camelot company roster, team pages, case-study imagery, Camelot operating materials, and association public websites.</div></div></div>
${hoaOperationalAssessmentSlide()}
${hoaFailuresSlide()}
${hoaModelSlide()}
${hoaFieldOpsSlide()}
${hoaClaimsSlide()}
${hoaTechnologySlide()}
${hoaFinancialSlide()}
${hoaTransitionSlide()}
${hoaServiceStructureSlide()}
${hoaChecklistSlide()}
${hoaWhyCamelotSlide()}
${hoaClosingSlide(d)}`;
  return deckShell('Camelot HOA Board Meeting Deck - Hills of Monroe Condominium', slides);
}

export function generateFirstEmailIntroReport(d: MasterReportData): string {
  d = normalizePitchReportData(d);
  if (isHoaExecutiveOpportunity(d)) return generateHoaFirstEmailIntroReport(d);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const subjectImage = bestExteriorImage(d);
  const hasRisks = d.violationsOpen > 0 || d.ecbPenaltyBalance > 0 || Boolean(d.ll97?.period1Penalty);
  const landmarks = landmarkLabels(d);
  const slides = `
<div class="slide slide-dark"><div style="position:absolute;inset:0;background:#1f303d"><img src="${subjectImage}" alt="${escapeHtml(d.buildingName || d.address)} subject property image" style="width:100%;height:100%;object-fit:cover;opacity:.56" onerror="this.style.display='none'"></div><div style="position:absolute;inset:0;background:linear-gradient(105deg,rgba(34,47,58,.98) 0%,rgba(34,47,58,.74) 48%,rgba(34,47,58,.34) 100%)"></div><div style="position:absolute;right:62px;bottom:58px;width:410px;z-index:2"><div style="font-size:9px;font-weight:900;letter-spacing:1.2px;color:#F4D26A;text-transform:uppercase;margin-bottom:4px">The Property &mdash; ${escapeHtml(streetLine(d.address))}</div><div style="height:215px;border:1px solid rgba(244,210,106,.55);box-shadow:0 18px 40px rgba(0,0,0,.28);overflow:hidden;background:#111;margin-bottom:10px">${rawIframeFrame(streetViewEmbedUrl(d), `${d.address} building facade`)}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><div style="font-size:9px;font-weight:900;letter-spacing:1.2px;color:#F4D26A;text-transform:uppercase;margin-bottom:4px">Location &mdash; ${neighborhoodName(d)}</div><div style="height:130px;border:1px solid rgba(244,210,106,.55);box-shadow:0 18px 40px rgba(0,0,0,.28);overflow:hidden;background:#111">${rawIframeFrame(placeEmbedUrl(d), `${neighborhoodName(d)} location map`)}</div></div><div><div style="font-size:9px;font-weight:900;letter-spacing:1.2px;color:#F4D26A;text-transform:uppercase;margin-bottom:4px">From Camelot HQ &mdash; Transit</div><div style="height:130px;border:1px solid rgba(244,210,106,.55);box-shadow:0 18px 40px rgba(0,0,0,.28);overflow:hidden;background:#111">${rawIframeFrame(directionsEmbedUrl(d, 'transit'), 'Subway route from Camelot HQ, 57 West 57th Street')}</div></div></div></div><div class="pad" style="position:relative;z-index:3">${logoBadge()}<div style="height:100%;display:flex;flex-direction:column;justify-content:center;max-width:720px"><div style="font-size:13px;color:#B8973A;text-transform:uppercase;letter-spacing:2.5px;font-weight:800">First Email Intro - Camelot Property Management</div><h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:68px;line-height:.95;color:#F4D26A;font-style:italic;margin:12px 0 4px">${escapeHtml(d.buildingName || streetLine(d.address))}</h1><div style="font-size:19px;color:rgba(255,255,255,.78);font-weight:600;margin-bottom:14px">New York, NY${d.zipCode ? ` ${d.zipCode}` : ''} &nbsp;&middot;&nbsp; ${neighborhoodName(d)}</div><p style="font-size:20px;color:rgba(255,255,255,.84);line-height:1.55">New Yorkers managing New York buildings since 2006 &mdash; a short introduction to what our people and our platform can do for ${escapeHtml(d.buildingName || streetLine(d.address))}.</p><div style="margin-top:18px;max-width:620px;border-left:3px solid #B8973A;padding:10px 14px;background:rgba(255,255,255,.08);font-size:11px;color:rgba(255,255,255,.76);line-height:1.55">${JACKIE_INTELLIGENT_REPORT_NOTE}</div><div style="margin-top:22px"><div style="font-size:15px;color:rgba(255,255,255,.88);font-weight:700">${escapeHtml(d.address)}${d.zipCode ? ` &middot; ${d.zipCode}` : ''}</div><div style="font-size:12px;color:rgba(255,255,255,.62);margin-top:3px">${neighborhoodName(d)}${d.borough ? ` &middot; ${d.borough.charAt(0).toUpperCase() + d.borough.slice(1)}` : ''} &middot; ${today}</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${[d.propertyType || null, unitsBreakdownLabel(d), bblLabel(d), d.yearBuilt ? `Built ${d.yearBuilt}` : null].filter(Boolean).map(chip => `<span style="font-size:10.5px;font-weight:800;color:#F4D26A;border:1px solid rgba(244,210,106,.45);border-radius:999px;padding:3px 10px;background:rgba(0,0,0,.25)">${chip}</span>`).join('')}</div></div>${preparedForBlock(d)}</div></div></div>
<div class="slide"><div class="pad" style="padding:38px 64px 40px">${logoBadge()}<div class="section-title" style="margin-bottom:12px">Cover Letter</div><div style="display:grid;grid-template-columns:1.14fr .86fr;gap:16px;align-items:stretch"><div class="article-wrap" style="background:#fff;border:1px solid rgba(184,151,58,.38);border-left:5px solid #B8973A;border-radius:6px;padding:21px 28px;box-shadow:0 14px 28px rgba(26,31,54,.06);max-height:548px;overflow:hidden">${articleImageFloat(d, 1, 'Property-specific visual context', 'right', 178)}${coverLetterParagraphs(d)}</div><div style="display:grid;gap:10px">${contextualImageCard(d, 2, `Street-level view — ${d.address}`, 254)}${localServicesCard(d, 208)}</div></div><div class="source-note">Prepared by Camelot Property Management for ${d.buildingName || d.address} - ${today}</div></div></div>
<div class="slide"><div class="pad" style="padding:40px 64px">${logoBadge()}<div class="section-title" style="margin-bottom:13px">Property Snapshot &amp; New York Reach</div><div style="display:grid;grid-template-columns:.9fr 1.1fr;gap:15px"><div><div class="gold-card" style="margin-bottom:8px;padding:12px 14px"><div class="sub-heading">Property Snapshot</div><table style="font-size:12px"><tr><td>Owner / Entity</td><td>${escapeHtml(ownerEntityName(d) || String((d as any).dofOwner || '') || 'To verify (HPD / ACRIS)')}</td></tr><tr><td>Type</td><td>${d.propertyType || 'Residential'}</td></tr><tr><td>Units</td><td>${unitsBreakdownLabel(d)}</td></tr><tr><td>Stories / Built</td><td>${d.stories ? `${d.stories} stories` : 'Stories: verify'} &middot; ${d.yearBuilt || 'year: verify'}</td></tr><tr><td>Block / Lot</td><td>${bblLabel(d)}</td></tr><tr><td>Neighborhood</td><td>${neighborhoodName(d)}</td></tr><tr><td>Current Management</td><td>${d.managementCompany ? `${escapeHtml(d.managementCompany)} <span style="font-size:10px;color:#888">(HPD registration &mdash; verify)</span>` : 'To verify &mdash; HPD / DOB / PropertyShark'}</td></tr></table></div><div class="gold-card" style="margin-bottom:8px;padding:12px 14px"><div class="sub-heading">Talking Points for Our First Conversation</div><p class="body-text" style="font-size:12.5px;line-height:1.45">${hasRisks ? `When we speak, we would walk you through what the public record shows today &mdash; ${d.violationsOpen} open HPD violation(s), ${fmt$(d.ecbPenaltyBalance)} in ECB penalty balance, and ${d.ll97?.period1Penalty ? fmt$(d.ll97.period1Penalty) + ' in modeled LL97 exposure' : 'LL97 status to confirm'} &mdash; and exactly how we monitor, resolve, and prevent items like these for the buildings we manage.` : `Your building's public record is comparatively clean. When we speak, we would talk about keeping it that way while tightening financial reporting, vendor pricing, and resident service &mdash; and where we typically find savings and new revenue.`} This page is a sample of the day-one visibility our platform gives ownership.</p></div><div class="gold-card" style="padding:9px 12px"><div class="sub-heading" style="font-size:14px;margin-bottom:4px">Nearby Context</div>${landmarks.slice(0, 2).map(l => `<div class="check" style="font-size:11.5px;margin-bottom:5px"><span>&#10003;</span><div>${l}</div></div>`).join('')}</div></div><div style="display:grid;grid-template-columns:1fr;gap:8px">${propertyImageCard(d, `${d.buildingName || d.address} &mdash; street-level property view`, 150)}${propertyPhotoGallery(d, 4)}${iframeCard(siteSatelliteEmbedUrl(d), 'Property site satellite view', `Satellite close-up &mdash; ${d.buildingName || d.address} site location`, 106)}</div></div><div class="source-note">Sources: Google Maps route, neighborhood context, Camelot property intelligence, and uploaded/verified property assets.</div></div></div>
${camelotOnePageSlide(d)}
${mdsAccountingSlide()}
${residentPortalSlide(d)}
${onboardingChecklistSlide(d)}
<div class="slide slide-dark"><div style="position:absolute;inset:0"><img src="${rotatingPropertyImage(d, 3)}" alt="${escapeHtml(d.buildingName || d.address)} closing visual context" style="width:100%;height:100%;object-fit:cover;opacity:.26" onerror="this.style.display='none'"></div><div style="position:absolute;inset:0;background:linear-gradient(105deg,rgba(34,47,58,.98),rgba(34,47,58,.9),rgba(34,47,58,.68))"></div><div class="pad" style="position:relative;z-index:3">${logoBadge()}<div style="height:100%;display:flex;flex-direction:column;justify-content:center;text-align:center;max-width:980px;margin:0 auto"><div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:48px;font-style:italic;color:#B8973A;margin-bottom:14px">Proposed Next Step</div><p style="font-size:20px;line-height:1.55;color:rgba(255,255,255,.86);margin-bottom:24px">We would welcome the opportunity to meet with the board, ownership, or decision-makers for ${d.buildingName || d.address}.</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px"><div class="gold-card" style="background:rgba(255,255,255,.96);text-align:left"><div class="sub-heading" style="font-size:18px">Zoom or Google Meet</div><p class="small">Best for a quick first screen share, report review, and Q&amp;A.</p></div><div class="gold-card" style="background:rgba(255,255,255,.96);text-align:left"><div class="sub-heading" style="font-size:18px">Phone Call</div><p class="small">A focused 15-minute call to confirm priorities and timing.</p></div><div class="gold-card" style="background:rgba(255,255,255,.96);text-align:left"><div class="sub-heading" style="font-size:18px">In-Person Meeting</div><p class="small">Camelot can meet near the building or at our New York office.</p></div></div><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:6px auto 22px"><a href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Camelot+Management+Discussion+-+${encodeURIComponent(d.buildingName || d.address)}&details=${encodeURIComponent('Please generate a Google Meet link for this Camelot management discussion.\n\nSubject property: ' + (d.buildingName || d.address))}&add=${CAMELOT_CONTACT_EMAIL}" target="_blank" style="background:#B8973A;color:#fff;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:12px;font-weight:700">Google Meet</a><a href="https://zoom.us/start/videomeeting" target="_blank" rel="noopener" style="background:#2D8CFF;color:#fff;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:12px;font-weight:700">Zoom</a><a href="tel:+12122069939;ext=701" style="background:#fff;color:#314655;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:12px;font-weight:700">Call 212-206-9939 x701</a></div><div style="font-size:15px;color:rgba(255,255,255,.82);line-height:1.9"><strong style="color:#B8973A">${CAMELOT_CONTACT_NAME}, ${CAMELOT_CONTACT_TITLE}</strong><br>${CAMELOT_PHONE}<br>${CAMELOT_CONTACT_EMAIL} | ${CAMELOT_GENERAL_EMAIL}<br>${CAMELOT_WEBSITE}<br>${CAMELOT_OFFICE_ADDRESS}</div></div></div></div>`;
  const html = deckShell(`Camelot First Email Intro - ${d.buildingName || d.address}`, enrichEveryOtherDeckPage(slides, d));
  return sanitizeJackieKnownPropertyHtml(html, d).data;
}

export function generateBoardMeetingDeck(d: MasterReportData): string {
  d = normalizePitchReportData(d);
  if (isHoaExecutiveOpportunity(d)) return generateHoaBoardMeetingDeck(d);
  if (isJacksonHeights85th(d)) return generateJackson85thBoardDeck(d);
  const base = generatePitchReport(d);
  const insert = `${executiveTeamSlide()}`;
  const exact22East22 = /\b22\s+e(?:ast)?\.?\s+22(?:nd)?\s+(?:st|street)\b/i.test(`${d.address} ${d.buildingName || ''}`) && !/\b220\s+e(?:ast)?\.?\s+22(?:nd)?\s+(?:st|street)\b/i.test(`${d.address}`);
  const html = base
    .replace(/<!-- SLIDE 1: Cover[\s\S]*?<!-- SLIDE 2:/, `${meetingDeckCoverSlide(d)}\n\n<!-- SLIDE 2:`)
    .replace('<!-- SLIDE 13: Next Steps (Dark) -->', `${insert}\n<!-- SLIDE 13: Next Steps (Dark) -->`)
    .replace(/REALTY GROUP/g, 'PROPERTY MANAGEMENT')
    .replace(/Property Intelligence Report/g, 'Meeting Agenda Deck')
    .replace('<!-- SLIDE 14: Thank You (Dark) -->', '<!-- SLIDE 15: Thank You (Dark) -->')
    .replace(exact22East22 ? /220 East 22nd Street_2022|220 East 22nd Street|220 E 22nd St/g : /$a/, exact22East22 ? '22 East 22nd Street' : '');
  return sanitizeJackieKnownPropertyHtml(html, d).data;
}

function meetingDeckCoverSlide(d: MasterReportData): string {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const exact22East22 = /\b22\s+e(?:ast)?\.?\s+22(?:nd)?\s+(?:st|street)\b/i.test(`${d.address} ${d.buildingName || ''}`) && !/\b220\s+e(?:ast)?\.?\s+22(?:nd)?\s+(?:st|street)\b/i.test(`${d.address} ${d.buildingName || ''}`);
  const displayName = exact22East22 ? '22 East 22nd Street' : (d.buildingName || d.address);
  const displayAddress = exact22East22 ? '22 East 22nd Street, New York, NY 10010' : d.address;
  const displayHood = exact22East22 ? 'Flatiron / Madison Square' : neighborhoodName(d);
  const displayBoro = exact22East22 ? 'Manhattan' : (d.borough ? d.borough.charAt(0).toUpperCase() + d.borough.slice(1) : 'New York');
  const propertyType = exact22East22 ? 'Co-op / TIC' : (d.propertyType || 'Residential');
  // Access can never default to "Walk-up": tall or large buildings are
  // elevator buildings by definition, and 150+ unit buildings in this market
  // are full-service (doorman, staffed, live-in resident manager).
  const isTallOrLarge = (d.stories || 0) >= 7 || (d.units || 0) >= 60;
  const access = /elevator/i.test(d.propertyType || '') || isTallOrLarge
    ? ((d.units || 0) >= 150 ? 'Full-Service Elevator' : 'Elevator')
    : ((d.stories || 0) > 0 && (d.stories || 0) <= 6 ? 'Walk-up' : 'Verify');
  const use = /mixed|commercial|retail/i.test(`${d.propertyType || ''} ${(d.commercialIntel?.likelyCommercialUses || []).join(' ')}`) ? 'Mixed-use' : 'Residential';
  const image = bestExteriorImage(d);
  const stats = [
    ['Units', d.units ? fmtN(d.units) : 'Verify'],
    ['Stories', d.stories ? fmtN(d.stories) : 'Verify'],
    ['Open', fmtN(d.violationsOpen || 0)],
    ['Year Built', d.yearBuilt ? String(d.yearBuilt) : 'Verify'],
    ['Type', propertyType],
    ['Access', access],
    ['Use', use],
  ];
  return `<!-- SLIDE 1: Cover (Meeting Agenda Deck) -->
<div class="slide slide-dark cover-slide" style="background:linear-gradient(110deg, rgba(20,31,43,0.96) 0%, rgba(20,31,43,0.86) 50%, rgba(20,31,43,0.42) 100%), url('${image}') center/cover no-repeat; background-size:cover;">
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">PROPERTY MANAGEMENT</span></div></div>
  <div style="display:flex;height:100%">
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:70px 42px 68px 64px">
      <div style="font-size:13px;color:rgba(255,255,255,0.58);text-transform:uppercase;letter-spacing:3px;margin-bottom:12px">Meeting Agenda Deck</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:52px;color:#B8973A;font-style:italic;font-weight:600;margin-bottom:12px;line-height:1.04">${displayName}</div>
      <div style="font-size:18px;color:rgba(255,255,255,0.82);margin-bottom:7px">${displayAddress}</div>
      <div style="font-size:15px;color:rgba(255,255,255,0.64);margin-bottom:24px">${displayHood} - ${displayBoro}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.58);text-transform:uppercase;letter-spacing:1.8px;margin-bottom:6px">Prepared for ${(() => { const f = d.reportFocus; const names = [f?.inquiryContact, f?.inquiryOrganization].filter(Boolean).map(String).join(', '); return names ? `${escapeHtml(names)} and the ${clientRecipientLabel(d)}` : clientRecipientLabel(d); })()} - ${today}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.36);letter-spacing:1.2px;margin-bottom:28px">Prepared with Camelot OS &mdash; data-driven, produced with human + AI assistance</div>
      <div style="display:flex;gap:22px;flex-wrap:wrap;max-width:760px">
        ${stats.map(([label, value]) => `<div style="min-width:74px"><div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:${String(value).length > 8 ? '21px' : '34px'};font-weight:600;color:#B8973A;line-height:1">${value}</div><div style="font-size:9px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:1px;margin-top:7px">${label}</div></div>`).join('')}
      </div>
    </div>
    <div style="flex:0 0 450px;display:flex;align-items:center;justify-content:center;padding:44px 52px 44px 0">
      <div class="photo-frame"><img src="${image}" style="width:400px;height:500px;object-fit:cover;display:block" /></div>
    </div>
  </div>
  <div style="position:absolute;bottom:20px;left:60px;right:60px;font-size:11px;color:rgba(255,255,255,0.38);border-top:1px solid rgba(255,255,255,0.1);padding-top:12px">
    Prepared exclusively for the ownership and board of ${displayName} - ${today} - Camelot Property Management - 57 West 57th Street, Suite 410, NYC - (212) 206-9939 x701
  </div>
</div>`;
}

export function generateJackieReportPackage(d: MasterReportData, reportPackage: JackieReportPackage): string {
  if (reportPackage === 'first_email_intro') return generateFirstEmailIntroReport(d);
  if (reportPackage === 'board_meeting_deck') return generateBoardMeetingDeck(d);
  return '';
}

export function buildJackiePackageFilename(d: MasterReportData, reportPackage: JackieReportPackage, extension = 'html'): string {
  d = normalizePitchReportData(d);
  const client = cleanFileNamePart(d.buildingName || d.address || 'Client');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const suffix = reportPackage === 'first_email_intro'
    ? 'CamelotEmailIntro'
    : reportPackage === 'board_meeting_deck'
      ? 'CamelotFirstMeetingHandout'
      : 'CamelotFullJackieAppendix';
  return `${client}_${suffix}__${dateStamp}.${extension}`;
}

/**
 * Generate a widescreen pitch deck matching Camelot's reference design.
 * Opens in browser as printable slides (Ctrl+P - Save as PDF).
 */
export function generatePitchReport(d: MasterReportData): string {
  d = normalizePitchReportData(d);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const hood = neighborhoodName(d);
  const boroDisplay = d.borough ? d.borough.charAt(0).toUpperCase() + d.borough.slice(1) : 'New York';
  const bldgDesc = inferBuildingDescription(d);
  const hasViolations = d.violationsTotal > 0;
  const hasLL97 = d.ll97 && d.ll97.period1Penalty > 0;
  const mgmt = managementStatusLabel(d);
  const exact22East22 = /\b22\s+e(?:ast)?\.?\s+22(?:nd)?\s+(?:st|street)\b/i.test(`${d.address} ${d.buildingName || ''}`) && !/\b220\s+e(?:ast)?\.?\s+22(?:nd)?\s+(?:st|street)\b/i.test(`${d.address} ${d.buildingName || ''}`);
  const displayName = exact22East22 ? '22 East 22nd Street' : (d.buildingName || d.address);
  const displayAddress = exact22East22 ? '22 East 22nd Street, New York, NY 10010' : d.address;
  const displayHood = exact22East22 ? 'Flatiron / Madison Square' : hood;
  const displayBoro = exact22East22 ? 'Manhattan' : boroDisplay;
  const ownerLabel = exact22East22 ? 'WO Realty LLC' : (d.dofOwner || 'To verify against DOF / ACRIS');
  const accessLabel = /elevator/i.test(d.propertyType || '') || (d.stories || 0) >= 7 || (d.units || 0) >= 60
    ? ((d.units || 0) >= 150 ? 'Full-Service Elevator' : 'Elevator')
    : ((d.stories || 0) > 0 && (d.stories || 0) <= 6 ? 'Walk-up' : 'Verify');
  const useLabel = /mixed|commercial|retail/i.test(`${d.propertyType || ''} ${(d.commercialIntel?.likelyCommercialUses || []).join(' ')}`) ? 'Mixed-use' : 'Residential';
  const ecbPenaltyLabel = d.ecbPenaltyBalance > 0 ? fmt$(d.ecbPenaltyBalance) : 'To verify';
  const ll97StatusLabel = hasLL97 ? `${fmt$(d.ll97!.period1Penalty)}/yr modeled` : 'Verify / monitor';
  const ll97ExposureNote = hasLL97
    ? `Modeled annual exposure of ${fmt$(d.ll97!.period1Penalty)} and 11-year exposure of ${fmt$(d.ll97!.totalExposure11yr)}. This is a planning model, not a confirmed city invoice.`
    : 'Benchmarking, carbon-cap status, and any filed penalties should be verified before final proposal release.';
  
  // Street view URLs
  // Use address-based Street View (no geocode dependency)
  const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x500&location=${encodeURIComponent(d.address + ', New York, NY')}&fov=90&key=${GOOGLE_MAPS_KEY}`;
  const reportPhotoStack = propertyPhotoStack(d);
  const exteriorImage = reportPhotoStack[0] || svUrl;
  const alternateSvUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x500&location=${encodeURIComponent(displayAddress)}&heading=115&fov=90&key=${GOOGLE_MAPS_KEY}`;
  const interiorImage = reportPhotoStack.find((src, idx) => idx > 0 && src !== exteriorImage) || alternateSvUrl;
  const subjectImage = exteriorImage;
  const factCards = [
    { label: 'Units', value: d.units ? fmtN(d.units) : 'Verify' },
    { label: 'Stories', value: d.stories ? fmtN(d.stories) : 'Verify' },
    { label: 'Built', value: d.yearBuilt ? String(d.yearBuilt) : 'Verify' },
    { label: 'Type', value: d.propertyType || 'Residential' },
    { label: 'Access', value: accessLabel },
    { label: 'Use', value: useLabel },
  ];
  const amenityHighlights = (d.commercialIntel?.amenities || []).slice(0, 8);
  const sourceLine = d.commercialIntel?.researchSources?.slice(0, 3).join(' | ') || 'NYC public records and market-source review';

  // Dynamic pain points for "A Fresh Set of Eyes" slide
  const hookLines: string[] = [];
  if (d.violationsOpen > 0) hookLines.push(`${d.violationsOpen} open HPD violations that need attention`);
  if (hasLL97) hookLines.push(`LL97 carbon penalty exposure starting 2030`);
  if (d.ecbPenaltyBalance > 0) hookLines.push(`${fmt$(d.ecbPenaltyBalance)} in outstanding ECB penalties`);
  if (d.permitsCount > 3) hookLines.push(`${d.permitsCount} active capital projects requiring oversight`);
  
  const hookText = hookLines.length > 0
    ? `${d.buildingName || d.address} deserves a partner that brings renewed energy, proactive capital planning, and the hands-on attention your community needs - with accounting oversight, legal issue-spotting, and engineering advisory available through the right scope.`
    : `${d.buildingName || d.address} deserves a management partner that combines boutique attention with institutional-grade financial and compliance services - with accounting oversight, legal issue-spotting, and engineering advisory available through the right scope.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Camelot - Management Proposal - ${d.buildingName || d.address}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,500;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: 13.333in 7.5in; margin: 0; }
  @media print {
    html, body { width:13.333in !important; min-width:13.333in !important; margin:0 !important; padding:0 !important; overflow:visible !important; background:#fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .slide { width:13.333in !important; height:7.49in !important; min-height:7.49in !important; max-height:7.49in !important; margin:0 !important; padding:0 !important; box-shadow:none !important; overflow:hidden !important; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; }
    .slide:last-child { page-break-after: auto; break-after: auto; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; color: #1a1f36; font-size: 16px; line-height: 1.6; background: #e0e0e0; counter-reset: slide; }
  
  .slide { width: 1280px; height: 720px; margin: 20px auto; position: relative; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
  .slide { counter-increment: slide; }
  .slide:not(.cover-slide)::before { content: 'Camelot Property Management  |  57 West 57th Street, Suite 410, New York, NY 10019  |  (212) 206-9939 x701  |  info@camelot.nyc'; position:absolute; left:58px; bottom:14px; font-size:9px; color:#7b8491; z-index:6; }
  .slide:not(.cover-slide)::after { content: counter(slide); position:absolute; right:26px; bottom:14px; font-size:10px; color:#1a2744; z-index:6; }
  .slide-dark:not(.cover-slide)::before { color:rgba(255,255,255,.52); }
  .slide-dark:not(.cover-slide)::after { color:rgba(255,255,255,.75); }
  .slide-cream { background: radial-gradient(circle at top right, rgba(184,151,58,0.10), transparent 34%), #FAF8F5; }
  .slide-dark { background: #34444f; color: #fff; }
  
  /* Camelot logo badge - top right */
  .logo-badge { position: absolute; top: 0; right: 0; width: 156px; height: 92px; background: #B8973A; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 28px rgba(0,0,0,0.14); z-index: 4; }
  .logo-badge img { width: 132px; max-height: 58px; object-fit: contain; }
  .logo-badge-text { color: #fff; font-family: 'Plus Jakarta Sans'; font-size: 15px; font-weight: 700; letter-spacing: 5px; text-align: center; line-height: 1.3; text-shadow:0 1px 1px rgba(0,0,0,.25); }
  .logo-badge-sub { font-size: 7px; letter-spacing: 2px; font-weight: 500; display: block; margin-top: 2px; }
  
  /* Section title with gold left bar */
  .section-title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 46px; font-weight: 600; font-style: italic; color: #B8973A; padding-left: 20px; border-left: 5px solid #B8973A; line-height: 1.05; margin-bottom: 24px; }
  
  /* Navy bold subheading */
  .sub-heading { font-family: 'Plus Jakarta Sans'; font-size: 22px; font-weight: 700; color: #1a2744; margin-bottom: 12px; }
  
  /* Body text */
  .body-text { font-size: 16px; color: #4a5568; line-height: 1.7; }
  .body-italic { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; color: #B8973A; font-size: 17px; }
  
  /* Gold-bordered cards */
  .gold-card { border: 1px solid rgba(184,151,58,0.45); border-left: 4px solid #B8973A; background: rgba(255,255,255,0.92); padding: 20px 24px; border-radius: 8px; margin-bottom: 12px; box-shadow: 0 14px 32px rgba(26,31,54,0.08); }
  
  /* Stat boxes */
  .stat-box { background: rgba(255,255,255,0.94); border: 1px solid rgba(184,151,58,0.25); border-radius: 10px; padding: 20px; text-align: center; box-shadow: 0 12px 28px rgba(26,31,54,0.07); }
  .stat-val { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 40px; font-weight: 600; color: #B8973A; }
  .stat-label { font-size: 13px; color: #6b7280; margin-top: 4px; }
  
  /* Check items */
  .check-item { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 16px; color: #1a2744; }
  .check-icon { width: 24px; height: 24px; background: #B8973A; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; flex-shrink: 0; }
  
  /* Comparison table */
  .cmp-table { width: 100%; border-collapse: collapse; }
  .cmp-table th { padding: 12px 20px; font-size: 16px; font-weight: 700; text-align: center; }
  .cmp-table th.cml { background: #B8973A; color: #fff; }
  .cmp-table th.other { background: #f3f4f6; color: #6b7280; border:1px solid rgba(184,151,58,0.55); }
  .cmp-table td { padding: 10px 20px; border-bottom: 1px solid #e5e7eb; font-size: 15px; }
  .cmp-table td.cml { background: #fefdf5; font-weight: 600; color: #1a2744; }
  .cmp-table td.other { color: #6b7280; border-left:1px solid rgba(184,151,58,0.28); border-right:1px solid rgba(184,151,58,0.28); }
  
  /* Quote card */
  .quote-card { border-left: 4px solid #B8973A; background: #fff; padding: 24px 28px; margin-bottom: 16px; }
  .quote-mark { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 48px; color: #B8973A; line-height: 0.5; }
  .quote-text { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-size: 18px; color: #4a5568; line-height: 1.6; margin: 12px 0; }
  .quote-author { font-weight: 700; color: #B8973A; font-size: 15px; }
  .quote-role { color: #6b7280; font-size: 13px; }
  
  /* Fee table */
  .fee-table { width: 100%; border-collapse: collapse; }
  .fee-table th { background: #1a2744; color: #B8973A; padding: 9px 18px; text-align: left; font-size: 13px; }
  .fee-table td { padding: 8px 18px; border-bottom: 1px solid #e5e7eb; font-size: 13.5px; line-height:1.35; }
  .fee-table td.gold { color: #B8973A; font-weight: 600; }
  
  /* Timeline phases */
  .phase-card { background: #fff; border: 1px solid #e5e7eb; border-top: 4px solid #B8973A; padding: 20px; }
  .phase-title { font-size: 18px; font-weight: 700; color: #1a2744; margin-bottom: 8px; }
  .phase-sub { font-size: 13px; color: #6b7280; margin-bottom: 12px; }
  .phase-items { font-size: 14px; color: #4a5568; line-height: 1.8; }
  
  .pad { padding: 46px 58px 42px; }
  .pad-top { padding-top: 50px; }
  .eyebrow { font-size: 12px; color: #B8973A; text-transform: uppercase; letter-spacing: 2.5px; font-weight: 800; margin-bottom: 10px; }
  .hero-title { font-family:'Cormorant Garamond',Georgia,serif; font-size: 62px; color:#F4D26A; font-style: italic; font-weight: 700; line-height: 0.98; max-width: 620px; }
  .hero-card { background: rgba(10,18,30,0.46); border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; padding: 18px 20px; }
  .pill { display:inline-flex; align-items:center; border:1px solid rgba(184,151,58,0.45); background:rgba(184,151,58,0.10); color:#1a2744; border-radius:999px; padding:7px 11px; font-size:12px; font-weight:700; margin:0 8px 8px 0; }
  .photo-frame { position:relative; border-radius:18px; overflow:hidden; box-shadow:0 22px 48px rgba(0,0,0,0.28); border:1px solid rgba(184,151,58,0.55); }
  .photo-frame:after { content:''; position:absolute; inset:0; box-shadow:inset 0 0 0 1px rgba(255,255,255,0.14); pointer-events:none; }
  .context-photo-chip { position:absolute;right:42px;bottom:42px;width:230px;height:132px;border:1px solid rgba(184,151,58,.42);border-radius:8px;overflow:hidden;background:#EDE9DF;box-shadow:0 14px 32px rgba(26,31,54,.16);z-index:3; }
  .context-photo-chip img { width:100%;height:100%;object-fit:cover;display:block; }
  .context-photo-chip-label { position:absolute;left:0;right:0;bottom:0;background:linear-gradient(0deg,rgba(26,39,68,.88),rgba(26,39,68,.24));color:#F4D26A;font-size:9px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;padding:18px 10px 8px;text-align:center; }
</style>
</head>
<body>

<!-- SLIDE 1: Cover (Dark with Street View background) -->
<div class="slide slide-dark" style="background:linear-gradient(110deg, rgba(20,31,43,0.96) 0%, rgba(20,31,43,0.88) 48%, rgba(20,31,43,0.54) 100%), url('${subjectImage}') center/cover no-repeat; background-size:cover;">
  <div class="logo-badge"><img src="./images/camelot-logo.png" alt="Camelot Realty Group" onerror="this.style.display='none';this.parentElement.innerHTML='<div class=&quot;logo-badge-text&quot;>CAMELOT<span class=&quot;logo-badge-sub&quot;>REALTY GROUP</span></div>'"></div>
  <div style="display:flex;height:100%">
    <!-- Left side: text -->
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:68px 40px 62px 64px">
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:42px;letter-spacing:10px;font-weight:400;margin-bottom:4px">C A M E L O T</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:#B8973A;font-style:italic;margin-bottom:50px">Property Management</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:3px;margin-bottom:10px">Property Intelligence Report</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:44px;color:#B8973A;font-style:italic;font-weight:600;margin-bottom:12px;line-height:1.15">${d.buildingName || d.address}</div>
      <div style="font-size:16px;color:rgba(255,255,255,0.7);margin-bottom:40px">${d.address} - ${hood} - ${boroDisplay}</div>
      <div style="display:flex;gap:28px">
        <div><div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;font-weight:600;color:#B8973A">${d.units || '-'}</div><div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px">Units</div></div>
        <div><div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;font-weight:600;color:#B8973A">${d.violationsTotal}</div><div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px">HPD Violations</div></div>
        <div><div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;font-weight:600;color:${d.violationsOpen > 0 ? '#ef4444' : '#B8973A'}">${d.violationsOpen}</div><div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px">Open</div></div>
        <div><div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;font-weight:600;color:#B8973A">${d.yearBuilt || '-'}</div><div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px">Year Built</div></div>
        ${d.marketValue ? `<div><div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;font-weight:600;color:#B8973A">${fmt$(d.marketValue)}</div><div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px">Market Value</div></div>` : ''}
      </div>
    </div>
    <!-- Right side: building photo -->
    <div style="flex:0 0 440px;display:flex;align-items:center;justify-content:center;padding:40px 50px 40px 0">
      <div class="photo-frame"><img src="${subjectImage}" style="width:400px;height:500px;object-fit:cover;display:block" onerror="this.src='${svUrl}'" /></div>
    </div>
  </div>
  <div style="position:absolute;bottom:20px;left:60px;right:60px;font-size:11px;color:rgba(255,255,255,0.35);border-top:1px solid rgba(255,255,255,0.1);padding-top:12px">
    Prepared exclusively for the ownership and board of ${d.buildingName || d.address} - ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} - Camelot Realty Group - 57 West 57th Street, Suite 410, NYC - (212) 206-9939 - Powered by Camelot OS
  </div>
</div>

<!-- SLIDE 2: A Fresh Set of Eyes -->
<div class="slide slide-cream">
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;padding:80px 120px">
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:52px;font-style:italic;color:#B8973A;margin-bottom:20px">A Fresh Set of Eyes</div>
    <div style="width:60px;height:3px;background:#B8973A;margin-bottom:30px"></div>
    <div style="font-size:18px;color:#4a5568;line-height:1.8;max-width:900px">${hookText}</div>
  </div>
  ${everyOtherPageVisualChip(d, 1, 'Property / Neighborhood')}
</div>

<!-- SLIDE 3: The Property -->
<div class="slide slide-cream">
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div class="pad">
    <div class="section-title">The Property</div>
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:16px">
      ${factCards.map(card => `<div class="stat-box" style="padding:12px 14px;text-align:left;min-height:92px"><div class="stat-label" style="font-size:11px">${card.label}</div><div class="stat-val" style="font-size:24px;line-height:1.12;word-break:normal;overflow-wrap:anywhere">${card.value}</div></div>`).join('')}
    </div>
    <div style="display:flex;gap:28px">
      <div style="flex:1">
        <div class="sub-heading">${displayName}</div>
        <div class="body-text" style="font-size:13.5px;line-height:1.48;margin-bottom:10px">
          ${d.units ? `At ${d.units} units, ${displayName} is a strong fit for Camelot's high-touch management: small enough for direct board attention and large enough to benefit from disciplined financial, vendor, and compliance systems.` : `${displayName} is well-suited for Camelot's hands-on management approach: personal attention supported by institutional-grade reporting and compliance controls.`}
        </div>
        <div style="font-size:12.5px;color:#4a5568;line-height:1.75">
          <div><strong>Built / Type:</strong> ${d.yearBuilt ? `c. ${d.yearBuilt}` : 'To verify'} | ${d.propertyType || 'Residential'}${d.stories ? ` | ${d.stories} stories` : ''}</div>
          <div><strong>Scale / Area:</strong> ${d.units ? `${d.units} units` : 'Unit count to verify'} | ${displayHood}</div>
          <div><strong>Current Management:</strong> ${mgmt}</div>
          <div><strong>Value / Assessment:</strong> ${d.marketValue ? `Market value ${fmt$(d.marketValue)}` : 'Market value to verify'}${d.assessedValue ? ` | Assessed ${fmt$(d.assessedValue)}` : ''}</div>
          <div><strong>Owner:</strong> ${ownerLabel}</div>
        </div>
        ${d.isRentStabilized ? `<div class="body-italic" style="margin-top:12px">Rent stabilized - Camelot has deep DHCR & RGB expertise</div>` : ''}
      </div>
      <div style="flex:0 0 420px">
        ${closestSubwayPanel(d, exact22East22)}
      </div>
    </div>
  </div>
</div>

<!-- SLIDE 4: Building Intelligence (Dynamic Data) -->
<div class="slide slide-cream">
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div class="pad">
    <div class="section-title">Building Intelligence</div>
    <div style="font-size:14px;color:#6b7280;margin-bottom:20px">Live data from NYC HPD, DOB, DOF, ACRIS & Energy Star - ${today}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;margin-bottom:24px">
      <div class="stat-box"><div class="stat-val">${d.violationsTotal}</div><div class="stat-label">Total HPD Violations</div></div>
      <div class="stat-box"><div class="stat-val" style="${d.violationsOpen > 10 ? 'color:#dc2626' : ''}">${d.violationsOpen}</div><div class="stat-label">Open Violations</div></div>
      <div class="stat-box"><div class="stat-val" style="font-size:30px">${ecbPenaltyLabel}</div><div class="stat-label">DOB / ECB Penalties</div></div>
      <div class="stat-box"><div class="stat-val" style="font-size:26px">${ll97StatusLabel}</div><div class="stat-label">LL97 Planning Status</div></div>
    </div>
    ${hasViolations ? `
    <div style="display:flex;gap:20px;margin-bottom:16px">
      ${d.violationClassC ? `<div style="flex:${d.violationClassC};background:#dc2626;color:#fff;padding:8px 12px;text-align:center;border-radius:4px;font-size:13px;font-weight:600">${d.violationClassC} Class C - Critical</div>` : ''}
      ${d.violationClassB ? `<div style="flex:${d.violationClassB};background:#f59e0b;color:#fff;padding:8px 12px;text-align:center;border-radius:4px;font-size:13px;font-weight:600">${d.violationClassB} Class B - Hazardous</div>` : ''}
      ${d.violationClassA ? `<div style="flex:${d.violationClassA};background:#3b82f6;color:#fff;padding:8px 12px;text-align:center;border-radius:4px;font-size:13px;font-weight:600">${d.violationClassA} Class A</div>` : ''}
    </div>` : ''}
    ${hasLL97 ? `
    <div style="background:#fefdf5;border:1px solid #B8973A;border-radius:4px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
      <div><strong style="color:#92400e">LL97 Carbon Penalty Exposure</strong><br><span style="font-size:14px;color:#78350f">${ll97ExposureNote}</span></div>
      <div style="text-align:right"><div style="font-size:28px;font-weight:700;color:#dc2626">${fmt$(d.ll97!.period1Penalty)}<span style="font-size:14px;color:#6b7280">/year</span></div><div style="font-size:12px;color:#6b7280">11-Year Exposure: ${fmt$(d.ll97!.totalExposure11yr)}</div></div>
    </div>` : ''}
  </div>
</div>

<!-- SLIDE 5: Why Camelot (Comparison Table) -->
<div class="slide slide-cream">
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div class="pad">
    <div class="section-title">Why Camelot</div>
    <div style="font-size:17px;font-weight:700;color:#1a2744;margin-bottom:20px">The institutional power of a full-service firm. The accountability of a dedicated partner.</div>
    <table class="cmp-table">
      <tr><th class="other">Large Firms</th><th class="cml">Camelot</th><th class="other">Solo Operators</th></tr>
      <tr><td class="other">Your building is one of 500+</td><td class="cml">Your building is a priority</td><td class="other">Limited staff, limited hours</td></tr>
      <tr><td class="other">Same PM for decades, no fresh ideas</td><td class="cml">Fresh set of eyes, proactive strategy</td><td class="other">One person handles everything</td></tr>
      <tr><td class="other">Slow response, layers of bureaucracy</td><td class="cml">Direct access to senior leadership</td><td class="other">Unavailable nights & weekends</td></tr>
      <tr><td class="other">No capital improvement planning</td><td class="cml">Capital roadmap + financing guidance</td><td class="other">Reactive, not proactive</td></tr>
      <tr><td class="other">Outsourced accounting, no legal/eng</td><td class="cml">In-house CPAs + free attorney + engineer</td><td class="other">Basic bookkeeping, no advisors</td></tr>
      <tr><td class="other">No proprietary tech</td><td class="cml">Merlin AI + Camelot OS + ConciergePlus</td><td class="other">Paper-based systems</td></tr>
    </table>
    <div class="body-italic" style="margin-top:16px">Boutique scale. Institutional capability. Owner's mentality.</div>
  </div>
</div>

<!-- SLIDE 6: About Camelot -->
<div class="slide slide-cream">
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div class="pad">
    <div class="section-title">About Camelot</div>
    <div style="font-size:17px;font-weight:700;color:#1a2744;margin-bottom:8px">Our mission is simple: to protect, enhance, and elevate the value of every property we manage through transparency, precision, and proactive hands-on care.</div>
    <div class="body-text" style="margin-bottom:24px">Since 2006, Camelot Realty Group has built a reputation as one of New York's premier boutique property management firms - blending hands-on service, financial expertise, and innovative technology to deliver exceptional results.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:20px;margin-bottom:20px">
      <div class="stat-box"><div class="stat-val">${CAMELOT_PROFILE.buildingsManaged}</div><div class="stat-label">Buildings Managed</div></div>
      <div class="stat-box"><div class="stat-val">${CAMELOT_PROFILE.assetsUnderManagement}</div><div class="stat-label">Assets Under Management*</div></div>
      <div class="stat-box"><div class="stat-val">Since ${CAMELOT_PROFILE.foundedYear}</div><div class="stat-label">Founded</div></div>
      <div class="stat-box"><div class="stat-val">${CAMELOT_PROFILE.unitsTracked}</div><div class="stat-label">Units Tracked</div></div>
    </div>
    <div style="font-size:14px;color:#B8973A;margin-bottom:4px">RED Awards 2025: Property Management Company of the Year  |  REBNY 2025: David Goldoff Leadership Award</div>
    <div style="font-size:13px;color:#6b7280">New Yorkers servicing New Yorkers, with coverage and relationships across Manhattan, Queens, Brooklyn, the Bronx, Westchester, New Jersey, and South Florida, including Midtown Manhattan, Long Island City, and Florham Park.</div>
    <div style="margin-top:18px">${camelotAssociationLogoGrid(62)}</div>
    <div style="font-size:10px;color:#8a8f98;margin-top:8px">*${CAMELOT_PROFILE.assetsUnderManagementNote}. Licensed REBNY Managing Agent &amp; Brokerage; associated with NYARM, SPONY, IREM, BOMA, NARPM, NYAA, CNYC, chambers of commerce, Queens Bronx Buildings Association, and major resident manager associations.</div>
  </div>
</div>

<!-- SLIDE 7: Core Services -->
<div class="slide slide-cream">
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div class="pad">
    <div class="section-title">Core Services</div>
    <div class="body-text" style="margin-bottom:20px">Comprehensive management with ${d.propertyType ? d.propertyType.toLowerCase() : 'residential'} expertise and hands-on capital project oversight.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="gold-card"><div class="sub-heading" style="font-size:17px">Property & Asset Management</div><div style="font-size:14px;color:#4a5568">Site visits, vendor coordination, maintenance and repair arranging, superintendent support, board communication, and practical owner-style oversight.</div></div>
      <div class="gold-card"><div class="sub-heading" style="font-size:17px">In-House CPA & Financials</div><div style="font-size:14px;color:#4a5568">Billing and collection of maintenance, vendor invoice review and payment, monthly and annual financial reports, budget support, and accountant/audit coordination.</div></div>
      <div class="gold-card"><div class="sub-heading" style="font-size:17px">Compliance & Risk Management</div><div style="font-size:14px;color:#4a5568">HPD, DOB, OATH/ECB, boiler, gas, fire safety, insurance, lead paint, LL97 screening, and attorney coordination with clear calendars and accountability.</div></div>
      <div class="gold-card"><div class="sub-heading" style="font-size:17px">Value-Added Team</div><div style="font-size:14px;color:#4a5568">Affiliated engineering guidance, bonded contractor relationships, insurance brokerage coordination, shared-revenue ideas, and technology through Camelot OS, MDS, and ConciergePlus.</div></div>
    </div>
  </div>
</div>

<!-- SLIDE 8: Compliance & Local Laws -->
<div class="slide slide-cream">
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div class="pad" style="padding:38px 58px 42px">
    <div class="section-title" style="font-size:42px;margin-bottom:16px">Compliance & Local Law Review</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="stat-box" style="padding:13px"><div style="font-weight:700;color:#1a2744;font-size:13px;margin-bottom:4px">TAX / DOF</div><div style="font-size:12px;color:#B8973A;font-weight:600">RPIE, abatements, tax review</div><div style="font-size:11px;color:#6b7280;margin-top:4px">Assessments and filing calendar.</div></div>
      <div class="stat-box" style="padding:13px"><div style="font-weight:700;color:#1a2744;font-size:13px;margin-bottom:4px">HPD / MDR</div><div style="font-size:12px;color:#B8973A;font-weight:600">Registration + violations</div><div style="font-size:11px;color:#6b7280;margin-top:4px">Open items and correction path.</div></div>
      <div class="stat-box" style="padding:13px"><div style="font-weight:700;color:#1a2744;font-size:13px;margin-bottom:4px">DOB / OATH</div><div style="font-size:12px;color:#B8973A;font-weight:600">Permits, ECB, safety</div><div style="font-size:11px;color:#6b7280;margin-top:4px">Penalty and hearing gut check.</div></div>
      <div class="stat-box" style="padding:13px"><div style="font-weight:700;color:#1a2744;font-size:13px;margin-bottom:4px">ENERGY / LOCAL LAWS</div><div style="font-size:12px;color:#B8973A;font-weight:600">LL97, LL84, LL152, FISP</div><div style="font-size:11px;color:#6b7280;margin-top:4px">Applicability verified by size/use.</div></div>
    </div>
    <div>
    <div class="sub-heading" style="font-size:18px;margin-bottom:10px">Building-Specific Compliance Needs - ${displayName}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${hasLL97 ? `<div class="gold-card" style="padding:13px 15px"><strong>LL97 Energy Planning</strong><br><span style="font-size:12px;color:#4a5568">${ll97ExposureNote}</span></div>` : ''}
      ${d.violationsOpen > 0 ? `<div class="gold-card" style="padding:13px 15px"><strong>Violation Resolution</strong><br><span style="font-size:12px;color:#4a5568">${d.violationsOpen} open violation(s) to triage, correct, certify, or contest with proper vendors and records.</span></div>` : ''}
      ${d.permitsCount > 0 ? `<div class="gold-card" style="padding:13px 15px"><strong>Capital Project Oversight</strong><br><span style="font-size:12px;color:#4a5568">${d.permitsCount} active DOB permit(s). Project management, vendor bidding, and timeline control should be scoped.</span></div>` : ''}
      <div class="gold-card" style="padding:13px 15px"><strong>Local Law Applicability</strong><br><span style="font-size:12px;color:#4a5568">HPD MDR, DOB BIS/NOW, OATH/ECB, LL152 gas piping, boiler/elevator applicability, fire safety, lead-paint rules, insurance inspections, FISP, LL84, and LL97 are verified against building size and use.</span></div>
    </div>
    <div class="gold-card" style="margin-top:12px;padding:12px 14px">
      <div class="sub-heading" style="font-size:16px;margin-bottom:8px">Compliance Gut Check</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        <div><div style="font-size:10px;color:#8a7a4d;text-transform:uppercase;font-weight:800">Open Violations</div><div style="font-size:18px;font-weight:900;color:${d.violationsOpen > 0 ? '#dc2626' : '#1a2744'}">${d.violationsOpen}</div><div style="font-size:11px;color:#6b7280">${d.violationClassC} Class C / ${d.violationClassB} Class B</div></div>
        <div><div style="font-size:10px;color:#8a7a4d;text-transform:uppercase;font-weight:800">Known Penalty</div><div style="font-size:18px;font-weight:900;color:${d.ecbPenaltyBalance > 0 ? '#dc2626' : '#1a2744'}">${fmt$(d.ecbPenaltyBalance || 0)}</div><div style="font-size:11px;color:#6b7280">ECB/OATH balance signal</div></div>
        <div><div style="font-size:10px;color:#8a7a4d;text-transform:uppercase;font-weight:800">LL97 Exposure</div><div style="font-size:18px;font-weight:900;color:${d.ll97?.totalExposure11yr ? '#dc2626' : '#1a2744'}">${d.ll97?.totalExposure11yr ? fmt$(d.ll97.totalExposure11yr) : 'Verify'}</div><div style="font-size:11px;color:#6b7280">Carbon cap / benchmarking review</div></div>
        <div><div style="font-size:10px;color:#8a7a4d;text-transform:uppercase;font-weight:800">Why Non-Compliant</div><div style="font-size:12px;line-height:1.35;color:#4a5568">${d.violationsOpen > 0 || d.dobViolationOpen > 0 || d.ecbPenaltyBalance > 0 || hasLL97 ? 'Open records, penalty balances, or modeled LL97 exposure require source-backed remediation.' : 'No quantified issue surfaced; confirm source records before final release.'}</div></div>
      </div>
      <div style="font-size:11px;color:#6b7280;margin-top:8px">Additional fees may include filings, engineering, legal, expediting, contractor remediation, hearings, project management, and board-approved capital work.</div>
    </div>
  </div>
</div>
</div>

<!-- SLIDE 9: Technology Platform -->
<div class="slide slide-cream">
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div class="pad">
    <div class="section-title">Technology Platform</div>
    <div class="body-text" style="margin-bottom:20px">MDS + ConciergePlus + BankUnited + Merlin AI + Camelot OS - modern tools that respect your ${d.isRentStabilized ? "tenants'" : "shareholders'"} preferences and give the board cleaner control.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div class="gold-card" style="padding:24px">
        <div class="sub-heading">For Board & Management</div>
        <div class="check-item"><div class="check-icon">&#10003;</div> MDS monthly reports delivered by the 20th-25th</div>
        <div class="check-item"><div class="check-icon">&#10003;</div> Virtual lockbox and shared bank balance visibility</div>
        <div class="check-item"><div class="check-icon">&#10003;</div> Cloud file depository and building files access</div>
        <div class="check-item"><div class="check-icon">&#10003;</div> Compliance status updates</div>
        <div class="check-item"><div class="check-icon">&#10003;</div> AI-powered board, annual, and town-hall meeting support</div>
      </div>
      <div class="gold-card" style="padding:24px">
        <div class="sub-heading">For Residents</div>
        <div class="check-item"><div class="check-icon">&#10003;</div> ConciergePlus portal + mobile app</div>
        <div class="check-item"><div class="check-icon">&#10003;</div> BankUnited online banking services - zero bank fees</div>
        <div class="check-item"><div class="check-icon">&#10003;</div> Work orders, amenity requests, and administrative tickets</div>
        <div class="check-item"><div class="check-icon">&#10003;</div> AI chatbot support layered over Camelot OS</div>
        <div class="check-item"><div class="check-icon">&#10003;</div> Traditional paper statements still supported</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:16px;align-items:center">
      ${[
        [MDS_LOGO_IMAGE, 'MDS'],
        [CONCIERGE_PLUS_PLATFORM_IMAGE, 'ConciergePlus'],
        [BANKUNITED_LOGO_IMAGE, 'BankUnited'],
        [SELECT_BRAND_IMAGE, 'Select'],
        [PVEDI_LOGO_IMAGE, 'PVEDI Engineering'],
      ].map(([src, alt]) => `<div style="height:72px;background:#fff;border:1px solid rgba(184,151,58,.28);border-radius:8px;display:flex;align-items:center;justify-content:center;padding:8px;overflow:hidden"><img src="${src}" alt="${alt}" style="max-width:100%;max-height:58px;object-fit:contain"></div>`).join('')}
    </div>
    <div style="font-size:12px;color:#6b7280;margin-top:12px">Powered by: OpenAI NLP  |  AWS Cloud  |  MDS  |  ConciergePlus  |  BankUnited  |  PVEDI Engineering  |  HubSpot CRM  |  PropertyShark</div>
  </div>
</div>

<!-- SLIDE 10: 90-Day Transition -->
<div class="slide slide-cream">
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div class="pad" style="padding:42px 58px 42px">
    <div class="section-title">The 90-Day Transition</div>
    <div style="display:grid;grid-template-columns:1fr 44px 1fr 44px 1fr;gap:12px;align-items:stretch;margin-bottom:18px">
      <div class="phase-card" style="padding:16px"><div class="phase-title">Month 1: Assessment</div><div class="phase-sub">Files, money, residents, staff, vendors, and compliance get organized.</div><div class="phase-items">File transfer<br>Introductory inspection<br>Staff and vendor review<br>Financial baseline</div></div>
      <div style="display:flex;align-items:center;justify-content:center;color:#B8973A;font-size:34px;font-weight:900">→</div>
      <div class="phase-card" style="padding:16px"><div class="phase-title">Month 2: Stabilization</div><div class="phase-sub">Camelot becomes visible to the board, residents, vendors, and agencies.</div><div class="phase-items">SOPs and work orders<br>Board portal and cadence<br>Vendor rebids<br>Meet-and-greet / Zoom town hall</div></div>
      <div style="display:flex;align-items:center;justify-content:center;color:#B8973A;font-size:34px;font-weight:900">→</div>
      <div class="phase-card" style="padding:16px"><div class="phase-title">Month 3: Optimization</div><div class="phase-sub">The building moves from intake to measurable operating improvement.</div><div class="phase-items">Capital plan<br>Cost-saving priorities<br>Resident communication rhythm<br>Quarterly board review</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
      ${['Cleaner reporting', 'Lower avoidable costs', 'Better resident experience', 'Board-ready priorities'].map((item, idx) => `<div class="gold-card" style="padding:14px;margin:0;text-align:center"><div style="width:34px;height:34px;border-radius:50%;background:#B8973A;color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;font-weight:900">${idx + 1}</div><div style="font-size:13px;font-weight:900;color:#1a2744">${item}</div></div>`).join('')}
    </div>
  </div>
  ${everyOtherPageVisualChip(d, 2, 'Transition Context')}
</div>

<!-- SLIDE 11: Proposed Investment -->
<div class="slide slide-cream">
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div class="pad">
    <div class="section-title">The Path to a Fair Number</div>
    <div class="body-text" style="margin-bottom:14px">We don't quote a building we haven't studied. Before we put a management fee in writing, we ask to review &mdash; with your permission &mdash; the <strong>prior manager's report, your latest operating budget, last audited financials, staffing structure, and arrears</strong>. Those materials let us run our formulas honestly and arrive at a number where you're satisfied and we're satisfied: an equitable agreement, not a guess.</div>
    <div class="body-text" style="margin-bottom:18px">For context only: full-service buildings of this caliber typically pay in the range of <strong>$1,000&ndash;$1,500 per unit per year</strong> in base management (market figures &mdash; to be verified against your actual scope). Our recommended platform is <strong>Camelot Intelligence</strong> &mdash; standard management on steroids: automation, templates, document depository, resident portal, and the Camelot OS system. Classic and Premier remain available for a leaner or expanded scope.</div>
    <table class="fee-table">
      <tr><th>Management Service Component</th><th>Camelot Inclusion</th></tr>
      <tr><td><strong>Recommended Package</strong><br><span style="font-size:12px;color:#6b7280">Fee quoted after review of prior management report, latest budget, audited financials, staffing, arrears, and requested scope.</span></td><td class="gold">Camelot Intelligence &mdash; full-suite service for a full-suite building; fee proposed with your financials in hand</td></tr>
      <tr><td><strong>Online Banking Services</strong></td><td class="gold">BankUnited preferred banking workflow with zero bank fees</td></tr>
      <tr><td><strong>Technology Platform</strong></td><td>Priced inside the recommended Intelligence package - Camelot OS + ConciergePlus + Merlin AI</td></tr>
      <tr><td><strong>Initial Building Inspection</strong></td><td class="gold">$500 introductory inspection ($2,500 value)</td></tr>
      <tr><td><strong>In-House CPA / Accounting</strong></td><td>Advisory and reporting coordination; tax returns and deeper accounting work separately scoped</td></tr>
      <tr><td><strong>Capital Project Management</strong></td><td>Initial coordination only; active project management separately scoped</td></tr>
      <tr><td><strong>AI Board Meeting Minutes</strong></td><td>Included - annual meeting, AI-enhanced</td></tr>
      <tr><td><strong>In-House Attorney & Engineer</strong></td><td>Advisory only; formal legal or engineering engagement separately scoped</td></tr>
      <tr><td><strong>Schedule A / Ancillary Fees</strong></td><td>Property-type-specific menu issued with final agreement and scope</td></tr>
    </table>
    <div class="body-italic" style="margin-top:16px">Our efficiencies effectively pay for our management through long-term savings on vendors, compliance, and capital.</div>
  </div>
</div>

<!-- SLIDE 12: What Our Clients Say -->
<div class="slide slide-cream">
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div class="pad">
    <div class="section-title">What Our Clients Say</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px">
      <div class="quote-card">
        <div class="quote-mark">&ldquo;</div>
        <div class="quote-text" style="font-size:15px">Camelot has been a helpful agent representing our Co-op since we moved into our new home. We really relied on them for their experience in understanding protocols, building-wide systems, and the business of running a building.</div>
        <div class="quote-author">Brandon Miller</div>
        <div class="quote-role">Board President, 137 Franklin Street Apartment Corp</div>
      </div>
      <div class="quote-card">
        <div class="quote-mark">&ldquo;</div>
        <div class="quote-text" style="font-size:15px">Valerie and David have been by my side as not only the best and most knowledgeable property managers but as family. Their experience and dedication is limitless and they go far beyond the expected.</div>
        <div class="quote-author">Evee Georgiadis</div>
        <div class="quote-role">Owner, 949 Park Avenue Condominium</div>
      </div>
      <div class="quote-card">
        <div class="quote-mark">&ldquo;</div>
        <div class="quote-text" style="font-size:15px">As an overseas property owner, it is important to have a property manager that is responsive, knowledgeable, cost efficient, and trustworthy. Camelot's service and advice made our life much easier.</div>
        <div class="quote-author">Lawrence Lee</div>
        <div class="quote-role">Managing Director, Laureat Hotel Investments Limited</div>
      </div>
      <div class="quote-card">
        <div class="quote-mark">&ldquo;</div>
        <div class="quote-text" style="font-size:15px">Camelot has taken time to truly understand our properties and deliver a management solution that fits our needs. Their responsiveness and creative problem solving helped us grow.</div>
        <div class="quote-author">Shaky Cohen</div>
        <div class="quote-role">Founder, Nexus Building Development Group</div>
      </div>
    </div>
  </div>
</div>

<!-- SLIDE 13: Next Steps (Dark) -->
<div class="slide slide-dark">
  <div style="position:absolute;inset:0"><img src="${rotatingPropertyImage(d, 3)}" alt="${escapeHtml(displayName)} neighborhood context" style="width:100%;height:100%;object-fit:cover;opacity:.22" onerror="this.style.display='none'"></div>
  <div style="position:absolute;inset:0;background:rgba(52,68,79,.86)"></div>
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;padding:60px;position:relative;z-index:2">
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:52px;font-style:italic;color:#B8973A;margin-bottom:24px">Next Steps</div>
    <div style="font-size:18px;color:rgba(255,255,255,0.8);margin-bottom:40px">We welcome the opportunity to visit the property<br>and walk through our scope of work and proposed fee.</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:20px;color:#B8973A;margin-bottom:16px">David Goldoff, Founder & President</div>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:18px">
      <a href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Camelot+Management+Discussion+-+${encodeURIComponent(d.buildingName || d.address)}&details=${encodeURIComponent('Please generate a Google Meet link for this Camelot management discussion.\n\nSubject property: ' + (d.buildingName || d.address))}&add=${CAMELOT_CONTACT_EMAIL}" target="_blank" style="background:#B8973A;color:#fff;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:12px;font-weight:700">Google Meet</a>
      <a href="https://zoom.us/start/videomeeting" target="_blank" rel="noopener" style="background:#2D8CFF;color:#fff;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:12px;font-weight:700">Zoom</a>
      <a href="tel:+12122069939;ext=701" style="background:#fff;color:#314655;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:12px;font-weight:700">Call 212-206-9939 x701</a>
    </div>
    <div style="font-size:16px;color:rgba(255,255,255,0.7);line-height:2">
      212-206-9939 ext. 701  |  212-206-9939 ext. 701<br>
      info@camelot.nyc<br>
      www.camelot.nyc<br>
      57 West 57th Street, Suite 410, New York, NY 10019
    </div>
  </div>
</div>

<!-- SLIDE 14: Thank You (Dark) -->
<div class="slide slide-dark">
  <div style="position:absolute;inset:0"><img src="${neighborhoodMapImage(d, '1280x720')}" alt="${escapeHtml(displayName)} neighborhood map" style="width:100%;height:100%;object-fit:cover;opacity:.18" onerror="this.style.display='none'"></div>
  <div style="position:absolute;inset:0;background:rgba(52,68,79,.88)"></div>
  <div class="logo-badge"><div class="logo-badge-text">CAMELOT<span class="logo-badge-sub">REALTY GROUP</span></div></div>
  <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;padding:60px;position:relative;z-index:2">
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:52px;letter-spacing:12px;font-weight:400;margin-bottom:6px">C A M E L O T</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;color:#B8973A;font-style:italic;margin-bottom:50px">Property Management</div>
    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:52px;font-style:italic;color:#B8973A;margin-bottom:20px">Thank You</div>
    <div style="font-size:18px;color:rgba(255,255,255,0.7)">We look forward to serving<br>the ${d.buildingName || d.address} community</div>
  </div>
</div>

</body>
</html>`;
}

/**
 * Generate a cover email template for the pitch report
 */
export function generatePitchEmail(d: MasterReportData): string {
  const hasIssues = d.violationsOpen > 0 || (d.ll97 && d.ll97.period1Penalty > 0) || d.ecbPenaltyBalance > 0;
  
  return `Subject: ${d.buildingName || d.address} - Management Proposal from Camelot Realty Group

Dear Board Members,

My name is David Goldoff, and I'm the founder and president of Camelot Realty Group. I'm reaching out because we recently completed a comprehensive analysis of ${d.buildingName || d.address} at ${d.address}, and I wanted to share what we found.

${hasIssues ? `Our analysis identified several areas that may warrant attention, including ${d.violationsOpen > 0 ? d.violationsOpen + ' open HPD violations' : ''}${d.ll97 && d.ll97.period1Penalty > 0 ? (d.violationsOpen > 0 ? ' and ' : '') + 'LL97 compliance exposure of ' + (d.ll97.period1Penalty > 0 ? '$' + Math.round(d.ll97.period1Penalty).toLocaleString() + '/year starting 2030' : 'pending assessment') : ''}. The attached Property Intelligence Report provides the full details.` : `Your building appears to be well-maintained, and I've attached a Property Intelligence Report with our analysis. Even well-run buildings can benefit from Camelot's technology-driven management approach and institutional-grade compliance services.`}

I'd welcome the opportunity to discuss how Camelot can serve ${d.buildingName || d.address}. We offer a complimentary building inspection ($2,500 value) at no cost and no obligation - our way of demonstrating value upfront.

Would you have 15 minutes this week for a brief conversation?

Best regards,

${DAVID_GOLDOFF_SIGNATURE_TEXT}`;
}