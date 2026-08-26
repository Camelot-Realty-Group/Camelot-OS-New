/**
 * Oak Park at Douglaston — Pitch Data (Template #1 for the reusable
 * Camelot pitch-microsite pattern: /pitch/:slug).
 *
 * Single source of truth. The public microsite page, the Proposal PDF
 * (via proposal-generator.ts / ProposalPDF.tsx), and the three
 * Management Agreements (via excalibur.ts, one per legal entity) all
 * read from this object so a fact never has to be edited in more than
 * one place.
 *
 * Every fact below traces back to client-supplied Oak Park documents
 * (brochure creative brief, board proposal v2, HOA/condo management
 * agreement v2, proposal template) or a specific verified public
 * source (PropertyShark, an MLS listing for a unit in the community).
 * Anything not yet confirmed is flagged explicitly via `confirmed:
 * false` — never silently assumed. See `toBeConfirmed` for the running
 * list that must be resolved before a final package goes to the Boards.
 */

import type { AgreementInput } from '@/lib/excalibur';
import type { Building } from '@/types';

// ============================================================
// Confirmed / unconfirmed value wrapper
// ============================================================

export interface Fact<T> {
  value: T;
  confirmed: boolean;
  note?: string;
}

const confirmed = <T,>(value: T, note?: string): Fact<T> => ({ value, confirmed: true, note });
const unconfirmed = <T,>(value: T, note?: string): Fact<T> => ({ value, confirmed: false, note });

// ============================================================
// Property
// ============================================================

export interface PitchEntity {
  key: 'condo-1' | 'condo-2' | 'uoa';
  legalName: string;
  shortLabel: string;
  units: Fact<number>;
  monthlyFeePerUnit: number;
  monthlyFeeTotal: Fact<number>;
}

export const OAK_PARK_ENTITIES: PitchEntity[] = [
  {
    key: 'condo-1',
    legalName: 'Oak Park at Douglaston Condominium I',
    shortLabel: 'Condominium I',
    units: unconfirmed(121, 'Working count — confirm against offering plan / owner ledger'),
    monthlyFeePerUnit: 70,
    monthlyFeeTotal: unconfirmed(8470, '$70/unit × 121 working units'),
  },
  {
    key: 'condo-2',
    legalName: 'Oak Park at Douglaston Condominium II',
    shortLabel: 'Condominium II',
    units: unconfirmed(92, 'Working count — confirm against offering plan / owner ledger'),
    monthlyFeePerUnit: 70,
    monthlyFeeTotal: unconfirmed(6440, '$70/unit × 92 working units'),
  },
  {
    key: 'uoa',
    legalName: 'Oak Park at Douglaston Unit Owners Association',
    shortLabel: 'Unit Owners Association (UOA)',
    units: unconfirmed(213, 'All units across both condominiums — confirm against governing documents'),
    monthlyFeePerUnit: 15,
    monthlyFeeTotal: unconfirmed(3195, '$15/unit × 213 total working units'),
  },
];

export const OAK_PARK_PROPERTY = {
  name: 'Oak Park at Douglaston',
  address: '239-12 Oak Park Dr',
  city: 'Douglaston',
  state: 'NY',
  zip: '11362',
  fullAddress: '239-12 Oak Park Dr, Douglaston, NY 11362',
  blockLot: 'Block 08310, Lot 7501',
  type: 'condo' as const,
  totalUnits: unconfirmed(213, 'Condo I (121) + Condo II (92) — confirm against offering plans and owner ledgers'),
  yearBuilt: unconfirmed(1995, 'PropertyShark parcel record cites 1995; an MLS listing for a unit in the community (240-17 Oak Park Dr, Unit 73A) cites 1992 — communities built in phases can have different years by section. Confirm final figure against offering plans.'),
  buildingCount: confirmed(12, 'PropertyShark'),
  stories: confirmed(2, 'PropertyShark'),
  lotSqFt: confirmed(182725, 'PropertyShark'),
  zoning: confirmed('R4', 'PropertyShark'),
  dobViolations: confirmed(5, 'PropertyShark, as of Aug 25 2026 report — verify current status before citing to the Boards'),
  hpdViolations: confirmed(2, 'PropertyShark, as of Aug 25 2026 report — verify current status before citing to the Boards'),
  incumbentManager: unconfirmed('RY Management', 'Client-supplied; a "decades-long relationship" and possible sponsor affiliation were mentioned — treat as internal intelligence only, never state as verified public fact, never use as an attack line externally'),
  amenities: [
    'Outdoor pool with pool house / clubhouse',
    'Tennis court(s)',
    'Fenced multi-sport court (basketball hoop, court markings)',
    'Shared fitness center (cardio, free weights, cable machine)',
    'Spa / hot tub',
    'Gated community with on-site parking',
  ],
};

// ============================================================
// Real market comp (unit-level, from an actual MLS listing)
// ============================================================

export const OAK_PARK_MARKET_COMP = {
  unitLabel: '240-17 Oak Park Dr, Unit 73A',
  beds: 3,
  fullBaths: 3,
  sqFt: 1576,
  garageSpaces: 1,
  stories: 3,
  heating: 'Hot air, natural gas',
  fenced: true,
  daysOnMarket: 69,
  annualTaxes: 9854,
  priceFiguresObserved: [968888, 945000, 930000, 929000],
  // Owner-paid common charge — NOT the Camelot management fee. Keep separate
  // in every rendering; never present alongside the $85/unit management fee
  // as if they were the same line item.
  hoaMonthlyCommonCharge: 897,
  hoaCommonChargeIncludes: [
    'Common area maintenance',
    'Exterior maintenance',
    'Grounds care',
    'Pool service',
    'Snow removal',
    'Recreation facilities',
    'Security',
    'Spa / hot tub',
    'Tennis courts',
  ],
};

// ============================================================
// What the Boards told Camelot is missing
// ============================================================

export const OAK_PARK_PAIN_POINTS: string[] = [
  'A property manager physically on-site weekly, checking in with the superintendent and visually inspecting grounds, common areas, and facilities',
  'Monthly financial and management reports that arrive consistently on a fixed date',
  'Active arrears follow-up — an aging report, documented collection actions, escalation to counsel under Board policy',
  'A facilities professional reviewing mechanical systems, training staff, and building SOPs and checklists',
  'Real cost benchmarking against a portfolio, with vendor rebids where there is a credible savings case',
  'Better communication between managing agent, Boards, superintendent, residents, and vendors',
  'A transition team that captures the full ledger, owner data, arrears, contracts, notices, physical files, and institutional knowledge — not just a name change on the invoice',
];

export const OAK_PARK_BOARD_CONTACTS = {
  namedContacts: ['Judy', 'Tony', 'Juil'],
  openItem: 'Juil asked for the assigned property manager\'s name — Nicholas Shapiro is Camelot\'s working assignment for the on-site role (see Team, below), with final confirmation of the account lead/PM structure and backup coverage tracked as an open item ahead of signing.',
};

// ============================================================
// Team
// ============================================================

export interface PitchTeamMember {
  role: string;
  person: Fact<string>;
  commitment: string;
  photo?: string;
  bio?: string;
}

export const OAK_PARK_TEAM: PitchTeamMember[] = [
  {
    role: 'Property Manager',
    person: confirmed('Nicholas Shapiro'),
    photo: '/pitch/oak-park-douglaston/team/nicholas-shapiro.jpg',
    bio: 'Nicholas is Oak Park\u2019s assigned, day-to-day property manager \u2014 the direct point of contact for the Board, the superintendent, and residents.',
    commitment: 'On site at least weekly, ~2-hour minimum visit, superintendent/staff check-in, common-area walk, written site report — with real time in the first weeks set aside to get to know the staff, the Board, and residents by name, not just by unit number.',
  },
  {
    role: 'Senior Director, Condo & Co-Op Services',
    person: confirmed('Valerie Fiume'),
    photo: '/pitch/oak-park-douglaston/team/valerie-fiume.jpg',
    bio: 'Valerie oversees Camelot\u2019s condo and co-op portfolio and steps in directly on escalations, management standards, and transition oversight.',
    commitment: 'Executive board support, escalation, management standards, transition oversight',
  },
  {
    role: 'Director of Facilities Management & Staff Training',
    person: confirmed('Tim Kelly'),
    photo: '/pitch/oak-park-douglaston/team/tim-kelly.jpg',
    bio: 'Tim leads facilities standards and staff training across the portfolio \u2014 mechanical systems review, preventive-maintenance scheduling, and building real SOPs with on-site staff.',
    commitment: 'In writing: Tim visits the property periodically, more frequently in the first 60 days, to get to know the staff, the Board, and the community in person — monthly facilities review during that window, then quarterly, plus issue-driven visits. He also serves as a direct liaison between the on-site property manager and Camelot\'s office, so facilities issues do not stall waiting on a single point of contact; staff coaching, SOP buildout, and preventive-maintenance schedules throughout.',
  },
  {
    role: 'Controller',
    person: confirmed('Vincent Melilo'),
    photo: '/pitch/oak-park-douglaston/team/vincent-melilo.jpg',
    bio: 'Vincent oversees accounting operations firm-wide \u2014 the accountable lead for three separate monthly closes, books, and budgets across all three Oak Park entities.',
    commitment: 'Three separate monthly closes, books, and budgets across all three entities under one accountable lead',
  },
  {
    role: 'CPA Access',
    person: confirmed('In-house CPA'),
    commitment: 'Accounting escalation, coordination with Oak Park\'s existing auditor',
  },
  {
    role: 'Legal Knowledge Base',
    person: confirmed('In-house attorney resource'),
    commitment: 'Issue-spotting and coordination with Oak Park\'s existing counsel; separate representation if required',
  },
  {
    role: 'President',
    person: confirmed('David A. Goldoff'),
    photo: '/pitch/oak-park-douglaston/team/david-goldoff.jpg',
    bio: 'David founded Camelot and personally participates in transitions, budget review, and early-stage cost analysis on every new account.',
    commitment: 'Personally participates in transition, budget review, and early-stage cost analysis',
  },
];

export const OAK_PARK_ROSTER_URL = 'https://www.camelot.nyc/company-roster/';
export const OAK_PARK_MARKETING_NOTE =
  'Camelot\u2019s in-house marketing team is also available to help Oak Park refresh and maintain the Association\u2019s own website \u2014 a service we\u2019re glad to extend beyond the core management scope.';

// ============================================================
// Transition plan (60–90 days)
// ============================================================

export interface TransitionPhase {
  label: string;
  dayRange: string;
  actions: string[];
}

export const OAK_PARK_TRANSITION_PLAN: TransitionPhase[] = [
  {
    label: 'Records, accounts & onboarding',
    dayRange: 'Days 0–30',
    actions: [
      'Confirm the three legal entities, unit ownership records, budgets, bank accounts, contracts, employees, insurance, vendors, arrears, litigation, and compliance status',
      'Obtain full GL / trial balance / reconciliations / owner balances per entity',
      'Establish a payment cutoff date',
      'Collect governing documents, board minutes, contracts, employee/insurance/legal files, and physical keys/access',
      'Log an Incomplete Records / Deficiency Log for anything missing',
    ],
  },
  {
    label: 'Site rhythm & resident onboarding',
    dayRange: 'Days 31–60',
    actions: [
      'Begin the weekly on-site visit rhythm',
      'Staff and SOP training',
      'Resident onboarding: welcome communication, portal registration, new payment instructions',
      'Camelot welcome event / meet-and-greet with the PM, Valerie, Tim, and David where practical',
      'Facilities and mechanical review',
      'Budget and vendor benchmark review',
    ],
  },
  {
    label: 'First reporting cycle & 90-day brief',
    dayRange: 'Days 61–90',
    actions: [
      'First fully reconciled monthly reporting cycle closes',
      'Arrears action plan in place',
      'Contract rebids where a credible savings case exists',
      'Compliance/violation status verified',
      'Oak Park 60-Day Property & Operations Brief delivered to the Boards: visual/maintenance/mechanical/grounds/staffing/compliance observations, cost-reduction opportunities, SOP recommendations, priority capital items',
    ],
  },
];

// ============================================================
// Technology
// ============================================================

export const OAK_PARK_TECH_STACK = [
  { name: 'MDS', role: 'Accounting system of record' },
  { name: 'Concierge Plus', role: 'Resident and Board experience portal, branded for the community' },
  { name: 'Camelot OS', role: 'Automation, workflow, cost-benchmarking, and reporting-QA intelligence layer' },
];

export const OAK_PARK_TECH_NOTES = [
  'BuildingLink may continue temporarily during a controlled transition only — running two resident platforms indefinitely is not the plan.',
];

// ============================================================
// Ancillary rate sheet (fixed Year 1)
// ============================================================

export const OAK_PARK_ANCILLARY_FEES = [
  { service: 'Additional Board/owner meeting', fee: '$150 each after the first included monthly meeting' },
  { service: 'Extraordinary after-hours emergency management', fee: '$225/hour + authorized expenses' },
  { service: 'Capital project administration under $25,000', fee: 'Included (routine coordination only)' },
  { service: 'Capital project management $25,000–$100,000', fee: '5% of approved hard costs' },
  { service: 'Capital project management over $100,000', fee: '3–5% negotiated, written not-to-exceed budget' },
  { service: 'Sale/lease-sublet application processing', fee: '$500/application' },
  { service: 'Lender/condo questionnaire', fee: '$350 standard, $550 rush' },
  { service: 'Move administrative coordination', fee: '$250' },
  { service: 'Extraordinary records/litigation support', fee: '$200/hour' },
  { service: 'Optional shared-savings program', fee: '30% of verified first-year realized net hard-dollar savings — only under a separate written agreement' },
];

// ============================================================
// Pricing summary (working basis — community-wide)
// ============================================================

export const OAK_PARK_PRICING = {
  recommendedPerUnit: 85,
  floorPerUnit: 75,
  ceilingPerUnit: 100,
  escalatorPct: 3,
  escalatorStartsAfterYear: 1,
  includedMeetingsPerMonth: 1,
  additionalMeetingFee: 150,
  totalMonthly: unconfirmed(18105, '$70/unit to applicable condo + $15/unit UOA, at the working 213-unit count'),
  totalAnnual: unconfirmed(217260),
};

// ============================================================
// Do-not-guess checklist
// ============================================================

// ============================================================
// Live compliance snapshot (Camelot OS Building Intelligence
// Report, generated 2026-08-25, report ID B0684016 — NYC Open Data
// pulled live via HPD/DOB/ACRIS/OATH/DHCR). This supersedes the
// earlier PropertyShark-derived violation counts noted elsewhere as
// the more current, Camelot-generated source. The two disagree
// (PropertyShark: 5 DOB + 2 HPD; this live pull: 3 HPD total / 2 open,
// 0 DOB permits on file, 0 ECB) — flagged, not silently reconciled.
// ============================================================

export const OAK_PARK_COMPLIANCE_SNAPSHOT = {
  reportDate: 'August 25, 2026',
  reportId: 'B0684016',
  hpdViolationsTotal: 3,
  hpdViolationsOpen: 2,
  hpdClassC: 2,
  lastInspection: 'Oct 1, 2025',
  ecbViolations: 0,
  dobPermitsOnFile: 0,
  housingLitigationCases: 0,
  rentStabilized: false,
  acrisTransactions: 0,
  annualViolationTrend: [
    { year: 2022, count: 0 },
    { year: 2023, count: 0 },
    { year: 2024, count: 0 },
    { year: 2025, count: 3 },
    { year: 2026, count: 0 },
  ],
  recentViolations: [
    { date: 'Oct 1, 2025', cls: 'I', status: 'Info NOV sent out', apt: '—', description: 'Owner failed to file a valid registration statement with HPD as required by Adm. Code §27-2107' },
    { date: 'Sep 30, 2025', cls: 'C', status: 'NOV sent out', apt: 'B', description: 'Provide an adequate supply of gas to the fixtures at range in the entire apartment' },
    { date: 'Sep 30, 2025', cls: 'C', status: 'Violation closed', apt: 'B', description: 'Provide hot water at all hot water fixtures in the entire apartment, 2nd story' },
  ],
  riskFactor: '2 open Class C (Immediately Hazardous) violations require urgent attention — 24-hour cure period.',
  disclaimer: 'Generated from publicly available NYC Open Data sources (HPD, DOF, DOB, ACRIS, OATH) for informational purposes only. Camelot Realty Group does not guarantee completeness or accuracy. Not legal, financial, or professional advice — verify critical data points independently.',
};

// ============================================================
// Cover letter — board meeting + property walk-through held today
// ============================================================

export const OAK_PARK_COVER_LETTER_PARAGRAPHS: string[] = [
  "Dear Members of the Oak Park Board, thank you for the time today, and for the walking tour of the property. We listened, and we heard you — the specific, day-to-day things this community needs and isn't consistently getting. We appreciated the chance to get to know you, and we would welcome the opportunity to earn your business.",
  "That is why we've built this as a virtual pitch deck rather than a static handout: a single site the Board can review together, come back to, and share amongst yourselves, alongside the downloadable proposal, agreements, and transition documents referenced throughout. It's also, frankly, meant to show you something about how we work — the speed and reliability that comes from pairing real property-management experience with the technology and software described on the pages that follow.",
  "What follows reflects today's visit: our management scope, recommended Intelligence package, transition process, fee structure, and Schedule A / ancillary fee menu, built around what we saw and what the Board described, not a generic template.",
  "To finish pricing this around Oak Park's actual needs rather than guesswork, we'd ask for copies of the Association's offering plan, the latest approved budget, and the most recent management report — along with the current financials, insurance summary, and vendor list referenced below.",
];

// ============================================================
// Accounting, technology & software providers
// ============================================================

export interface SoftwareProvider {
  name: string;
  role: string;
  description: string;
  logo?: string;
  logoIsWordmark?: boolean;
  url?: string;
}

const LOGO_BASE = '/pitch/oak-park-douglaston/partner-logos';

export const OAK_PARK_SOFTWARE_PROVIDERS: SoftwareProvider[] = [
  {
    name: 'MDS (Multi-Data Services)',
    role: 'Accounting system of record',
    description: 'Full general ledger, accounts payable/receivable, budgeting, and the monthly board reporting package (cash flow, bank reconciliations, check register, unpaid invoices, paid-invoice images) for all three Oak Park entities, kept separately reconciled.',
    logo: `${LOGO_BASE}/mds-logo.svg`,
    url: 'https://multidataservices.com',
  },
  {
    name: 'Concierge Plus',
    role: 'Resident & Board experience portal',
    description: 'Branded resident and Board portal — announcements, package tracking, amenity/common-area communication, and document access. Included in the base management fee, no separate license cost to the community, with full front-desk and Board training provided directly by Camelot as part of the launch.',
    logo: `${LOGO_BASE}/conciergeplus-mark.png`,
    url: 'https://conciergeplus.com',
  },
  {
    name: 'BuildingLink',
    role: 'Resident/maintenance operations (existing)',
    description: 'If Oak Park already runs BuildingLink, Camelot will review the current license/version, consolidate to a single active instance rather than running parallel systems, and confirm the community is on the latest supported version before deciding whether to continue it long-term alongside Concierge Plus or transition off it.',
    logo: `${LOGO_BASE}/buildinglink-logo.png`,
    url: 'https://www.buildinglink.com',
  },
  {
    name: 'Domecile (BoardPackager)',
    role: 'Digital board-application platform',
    description: 'A secure, paperless platform for sale, refinance, transfer, lease, and sublease applications — applicants, brokers, and the Board all work from the same digital package instead of paper. Used for the sale/lease-sublet application processing and lender questionnaire items on the ancillary fee schedule.',
    logo: `${LOGO_BASE}/domecile-logo.svg`,
    url: 'https://www.domecile.com',
  },
  {
    name: 'Camelot OS',
    role: 'Automation & compliance-monitoring layer',
    description: 'Camelot\'s own intelligence layer — live NYC Open Data monitoring (HPD/DOB/ACRIS/OATH), cost benchmarking against Camelot\'s portfolio, and reporting-QA tooling. The Building Intelligence Report referenced in the Compliance Snapshot below is generated by this system.',
    logoIsWordmark: true,
  },
];

export const OAK_PARK_SELECT_PARTNERSHIP = {
  partnerName: 'SELECT',
  partnerUrl: 'https://www.meetselect.com',
  whatTheyDo: 'SELECT is a private membership and concierge platform, not a credit card — it layers exclusive savings on top of however a resident already pays, by app, by website, or with a physical membership card. Members get 15–40% off (or complimentary drinks) at premier restaurants, up to 60% off hotel rates at properties worldwide, and preferred pricing with brands like Caraway, Brooks Brothers, and Tumi, plus a live concierge for bookings and reservations.',
  offer: 'One month of SELECT complimentary for Oak Park residents as a value-added welcome benefit through Camelot\'s strategic partnership — introduced during the transition period, at no cost to the community or unit owners for that first month.',
  disclosure: 'This is a value-added resident perk, not a promised permanent inclusion — continuing SELECT beyond the complimentary month would be a separate, clearly disclosed commercial arrangement between the community and SELECT, not a Camelot management fee.',
};

// ============================================================
// Revenue growth — the three-phase plan (transition, then expense
// review, then new income streams), plus the Domecile-specific detail
// on fees the community already controls but may not be fully
// capturing today. Fee figures are Domecile's own published examples
// (domecile.com building fee schedules; boardpackager.freshdesk.com) —
// illustrative ranges, not an Oak Park-specific quote.
// ============================================================

export interface RevenuePhase {
  phase: string;
  dayRange: string;
  title: string;
  description: string;
}

export const OAK_PARK_REVENUE_PLAN: RevenuePhase[] = [
  {
    phase: 'Phase 1',
    dayRange: 'Transition',
    title: 'Capture everything in the handoff',
    description: 'Before anything is renegotiated or added, the transition itself protects revenue that is already the community\'s — open application and sublet fees, pending closings, and in-progress packages are inventoried so nothing is lost or double-charged between the outgoing and incoming managing agent.',
  },
  {
    phase: 'Phase 2',
    dayRange: 'Days 31–60',
    title: 'Review operating expenses, then cut',
    description: 'Every vendor contract is benchmarked against Camelot\'s portfolio (see Cost Optimization, above); where a credible savings case exists, we rebid — the expense side is tightened before we talk about new income, not instead of it.',
  },
  {
    phase: 'Phase 3',
    dayRange: 'Day 60+',
    title: 'Turn on income the community already controls',
    description: 'Once the books and vendor base are clean, we turn to revenue the governing documents already allow but that often goes uncollected or under-collected — starting with Domecile, below.',
  },
];

export const OAK_PARK_DOMECILE_REVENUE = {
  intro: 'Domecile is listed above as the digital board-application platform — but every purchase, sale, refinance, sublease, or transfer package that runs through it is also a fee-collection point the Board already controls. Camelot\'s job in Phase 3 is making sure those fees are actually set at a fair market level and actually collected, not lost to a manual, paper-based process.',
  streams: [
    {
      title: 'Application & processing fees',
      description: 'Buyer, tenant, and shareholder application/processing fees on Domecile-listed buildings commonly run $350–$800+ per package, set by the Board and remitted directly to the building or its management — not to Domecile.',
    },
    {
      title: 'Sublet fees',
      description: 'Where the governing documents permit subletting, sublet fees are commonly structured as 15–25% of the unit\'s annual maintenance or rent — sometimes escalating in later years — a recurring revenue line many boards under-price or under-enforce today.',
    },
    {
      title: 'Building admin & transfer fees',
      description: 'Boards can layer a separate building application/admin fee on top of standard processing fees — and flip-tax / transfer-fee schedules — for every closing, distinct from Domecile\'s own digital submission charge.',
    },
    {
      title: 'Digital enforcement, not manual chasing',
      description: 'Because fees are authorized and collected inside the platform before a package can move forward, the community stops chasing a buyer\'s attorney for a check that never arrives.',
    },
  ],
  source: 'Domecile published building fee schedules (domecile.com) and BoardPackager fee documentation (boardpackager.freshdesk.com); figures are illustrative industry ranges, not an Oak Park-specific quote — actual fees are set by the Board.',
};

export interface EquipmentRequest {
  item: string;
  purpose: string;
}

export const OAK_PARK_EQUIPMENT_REQUESTS: EquipmentRequest[] = [
  { item: 'Lockbox at the clubhouse', purpose: 'Secure drop point for keys, packages, and physical documents at the amenity building.' },
  { item: 'Check scanner at the front desk', purpose: 'Same-day remote deposit of resident checks instead of manual bank runs — faster posting, fewer lost/delayed payments.' },
  { item: 'Printer at the front desk', purpose: 'On-site printing of compliance signage, Board notices, and resident correspondence without routing through the management office for every page.' },
  { item: 'Dedicated computer at the front desk', purpose: 'Runs Concierge Plus and the check-scanner software so front-desk staff can assist the management office directly — posting deposits, printing notices — without needing office-side access.' },
  { item: 'Front-desk staff training', purpose: 'Camelot trains front-desk staff on compliance signage/notice procedures and check deposit handling so routine tasks do not bottleneck through the property manager.' },
];

// ============================================================
// Transition plan — records/files checklist (from Camelot's internal
// Transitional Procedures categories; rendered under the current
// office letterhead — the source internal PDF still shows a retired
// office address and should be corrected company-wide separately)
// ============================================================

export const OAK_PARK_TRANSITION_CHECKLIST: { category: string; items: string[] }[] = [
  { category: 'Mortgage', items: ['Payment book / monthly payments', 'Name and address of lender', 'Closing binder'] },
  { category: 'Insurance', items: ['Original policies / schedule', 'Insurance broker contact', 'Pending claims'] },
  { category: 'Legal', items: ['Corporate / certiorari records', 'Pending legal matters', 'Corporate stock book / seal / certificate of incorporation', 'Engineering survey / deed / title policy', 'Board minutes', 'By-laws / house rules / offering plans & amendments'] },
  { category: 'Accounting', items: ['Name/address form', 'Federal/state/sales tax returns', 'Audited annual reports / budget', '1098 information', 'RPIE/RPT filings', 'Block/lot/assessed valuation', 'Real estate tax / water bill', 'NYC real property tax abatement filings'] },
  { category: 'Payroll', items: ['Employee earnings records', 'Union wage contract, Forms 940 & 941', 'Unemployment insurance returns'] },
  { category: 'Unit Owners', items: ['Rent roll (maintenance/common charges)', 'Collections/arrears report', 'Payment history / delinquent owners', 'Alternate address listing', 'Unit owner files', 'List of mortgages/lenders for each unit'] },
];

// ============================================================
// Testimonials & references — handled as a request-access statement.
// Camelot's on-file developer/brokerage reference list contains named
// individuals' personal contact information and is brokerage-context,
// not condo/co-op management references — not appropriate to publish
// on a public board-facing page. Direct management references are
// available on request through David directly.
// ============================================================

// ============================================================
// Testimonials — sourced verbatim from the Camelot — A Journal of
// Considered Ownership brochure (camelot-whiteglove), selected for
// relevance to a multi-entity condo Board audience.
// ============================================================

export interface Testimonial {
  quote: string;
  name: string;
  description: string;
}

export const OAK_PARK_TESTIMONIALS: Testimonial[] = [
  {
    quote: 'What stands out most is their ability to adapt to different property needs while staying highly organized. They\u2019ve made ownership far less stressful and far more streamlined.',
    name: 'AOD Family Office',
    description: 'Two Buildings & a Parking Garage',
  },
  {
    quote: 'Their team brings consistency, strong operational oversight, and a proactive management style that has helped us improve tenant satisfaction while keeping day-to-day operations running smoothly.',
    name: 'Peak Capital Partners',
    description: '70+ Multifamily & Mixed-Use Properties, Tri-State Area',
  },
  {
    quote: 'They are organized, highly responsive, and have done an outstanding job balancing property performance with quality tenant service.',
    name: 'The Mactaggart Family Office',
    description: '13-Building Portfolio, Chinatown & Park Slope',
  },
  {
    quote: 'Their communication is clear, their follow-through is dependable, and they approach every issue with professionalism.',
    name: 'The Sarva Family Office Portfolio',
    description: 'Six-Family Building',
  },
  {
    quote: 'They are quick to respond, easy to work with, and consistently professional in how they manage both tenant concerns and property needs. It gives me real confidence knowing my building is in capable hands.',
    name: 'Ron Masseroni',
    description: 'Landlord, 748 East 9th Street',
  },
  {
    quote: 'They handle the details thoroughly, communicate well, and stay ahead of issues before they become bigger problems. Their experience and steady oversight have made a noticeable difference.',
    name: 'James Barrell',
    description: 'Landlord, 50 Lispenard Street & 300 West 11th Street',
  },
  {
    quote: 'Their team is attentive, responsive, and committed to maintaining a high standard across every aspect of management. I value their reliability and the peace of mind they bring.',
    name: 'Fabrice Lecomte',
    description: 'Landlord, 43 East 63rd Street & 410 East 50th Street',
  },
];

// ============================================================
// Annual operating calendar — the seasonal/compliance/preventive-
// maintenance calendar Camelot builds with each Board.
// ============================================================

export interface CalendarTrack {
  track: string;
  description: string;
  examples: string[];
}

export const OAK_PARK_ANNUAL_CALENDAR: CalendarTrack[] = [
  {
    track: 'Seasonal changeovers',
    description: 'The recurring physical-plant switches every garden-style community has to hit on time, every year.',
    examples: ['Pool and pool-house opening/closing dates', 'Irrigation start-up and winterization', 'HVAC seasonal changeover and filter service', 'Snow/ice vendor activation and de-icing supply stock', 'Leaf removal and landscaping transition windows'],
  },
  {
    track: 'Turnovers',
    description: 'The predictable unit-to-unit handoffs that go smoother with a standing checklist instead of a scramble.',
    examples: ['Move-in / move-out scheduling and elevator or loading-dock booking (if applicable)', 'Unit inspection and punch-list turnaround', 'Key/fob/access-control reissuance', 'Welcome packet and Concierge Plus account setup'],
  },
  {
    track: 'Compliance deadlines',
    description: 'The filings and notices that carry real penalties if a date is missed — tracked before they become urgent.',
    examples: ['HPD registration renewal', 'Local Law 97 (NYC benchmarking/emissions) annual reporting', 'Local Law 152 gas-piping periodic inspection windows', 'DHCR filings, if any units are regulated', 'Insurance certificate renewals and COI tracking'],
  },
  {
    track: 'Preventive maintenance',
    description: 'Scheduled, not reactive — the difference between a capital plan and a string of emergencies.',
    examples: ['Boiler and mechanical-system service intervals', 'Roof, gutter, and drainage inspections', 'Façade and common-area walk-throughs', 'Life-safety system testing (fire alarm, sprinkler, if applicable)'],
  },
  {
    track: 'Required annual submittals & inspections',
    description: 'The paperwork and third-party inspections that must happen every year regardless of what else is going on.',
    examples: ['Annual boiler inspection report filing', 'Elevator inspection/certification (if applicable)', 'Backflow preventer testing', 'Annual audited financial statement and tax filings', 'Reserve study review cadence'],
  },
];

export const OAK_PARK_ANNUAL_CALENDAR_INTRO =
  'Every community Camelot manages gets a working annual calendar built WITH the Board, not handed to it — the dates that matter across five tracks: seasonal changeovers, unit turnovers, compliance deadlines, preventive maintenance, and the required annual submittals and inspections. It\u2019s reviewed and adjusted with the Board each year, so nothing depends on any one person\u2019s memory.';

export const OAK_PARK_REFERENCES_NOTE =
  'Direct references from current condo and co-op boards Camelot manages are available on request — contact David Goldoff directly and we will connect you with Board leadership at comparable communities.';

// ============================================================
// Queens portfolio presence — sourced from "Camelot Realty Group
// — Managed Buildings (1).xlsx" (Google Drive, modified 2026-08-11).
// Coordinates geocoded via OpenStreetMap Nominatim; distances are
// straight-line (haversine) miles from Oak Park at Douglaston, not
// drive time. Two entities share one address (43-33 48th Street) —
// likely co-located/phased ownership at the same site, listed
// separately here because they are separate managed entities on the
// roster.
// ============================================================

export interface QueensPortfolioBuilding {
  entity: string;
  address: string;
  units: number;
  type: string;
  lat: number;
  lon: number;
  distanceMiles: number;
}

export const OAK_PARK_COORDS = { lat: 40.7463877, lon: -73.7346726 };

export const OAK_PARK_QUEENS_PORTFOLIO: QueensPortfolioBuilding[] = [
  { entity: '83-55 Austin Property Associates', address: '83-55 Austin Street, Kew Gardens, NY 11415', units: 45, type: 'Rental — Residential', lat: 40.7113897, lon: -73.8316761, distanceMiles: 5.6 },
  { entity: '61st 39th Avenue, LLC', address: '61-05 to 61-09 39th Avenue, Woodside, NY 11377', units: 39, type: 'Condo — Residential', lat: 40.7472411, lon: -73.9023935, distanceMiles: 8.8 },
  { entity: 'Vrachnos Associates', address: '41-28 55th Street, Woodside, NY 11377', units: 26, type: 'Rental — Residential', lat: 40.7445835, lon: -73.9099417, distanceMiles: 9.2 },
  { entity: '48th Woodside Associates', address: '43-33 48th Street, Woodside, NY 11377', units: 20, type: 'Rental — Residential', lat: 40.7436479, lon: -73.9163596, distanceMiles: 9.5 },
  { entity: 'The Sunnyside Bliss Condominium', address: '43-33 48th Street, Woodside, NY 11377', units: 60, type: 'Condo — Residential (85 parking spaces)', lat: 40.7436479, lon: -73.9163596, distanceMiles: 9.5 },
  { entity: 'East of East Condo Corp', address: '13-10 Jackson Avenue, Long Island City, NY 11101', units: 13, type: 'Condo — Residential', lat: 40.7478865, lon: -73.9404366, distanceMiles: 10.8 },
];

export const OAK_PARK_QUEENS_PORTFOLIO_NOTE =
  'Camelot manages six properties across Queens today \u2014 190 units spanning Kew Gardens, Woodside, and Long Island City \u2014 alongside an active Manhattan and Brooklyn portfolio. These are straight-line distances, not a claim of hyper-local coverage in Douglaston specifically; we\u2019re showing where we actually operate in the borough today.';

export const OAK_PARK_TO_BE_CONFIRMED: string[] = [
  'Official unit counts — Condominium I, Condominium II, and total community (currently working figures of 121 / 92 / 213)',
  'Final assignment and title for the account lead / property manager role — including current portfolio and unit load, and backup coverage — to be confirmed directly with the Board before this proposal is finalized',
  'Fidelity/E&O insurance certificates and verified coverage limits',
  'Three direct Board references, ideally from multi-board/garden-style management experience',
  'Latest approved budgets and monthly management reports from the Boards or outgoing management',
  'UOA allocation percentage and mechanics per the governing documents (beyond the working $15/unit assumption)',
  'Final property year-built figure (1995 per PropertyShark parcel record vs. 1992 per an MLS listing for a specific unit)',
];

// ============================================================
// Camelot company facts (used across sections)
// ============================================================

export const CAMELOT_COMPANY_FACTS = {
  founded: 2006,
  buildings: 42,
  aum: '$240M+',
  footprint: 'Active in NYC\u2019s five boroughs plus Riverdale, Westchester, and New Jersey',
  affiliations: ['REBNY', 'IREM', 'SPONY', 'NYAA', 'NYARM', 'BOMA', 'CNYC'],
  officeAddress: '57 West 57th Street, Suite 410, New York, NY 10019',
  officePhone: '(212) 206-9939',
};

// ============================================================
// Helpers: build inputs for the existing Proposal + Agreement engines
// ============================================================

/**
 * A synthetic Building record representing the Oak Park community as a
 * whole, for the existing proposal-generator.ts / ProposalPDF pipeline
 * (src/pages/Proposals.tsx uses this same shape). Community-wide figures
 * only — the three entity-specific Management Agreements below carry the
 * per-entity unit counts and fee splits.
 */
export function oakParkAsBuilding(): Building {
  const now = new Date().toISOString();
  return {
    id: 'oak-park-douglaston-pitch',
    address: OAK_PARK_PROPERTY.fullAddress,
    name: OAK_PARK_PROPERTY.name,
    borough: 'Queens',
    region: 'Douglaston / Little Neck',
    units: OAK_PARK_PROPERTY.totalUnits.value,
    type: 'condo',
    year_built: OAK_PARK_PROPERTY.yearBuilt.value,
    stories: OAK_PARK_PROPERTY.stories.value,
    grade: 'A',
    score: 0,
    signals: [],
    contacts: [],
    enriched_data: {},
    current_management: OAK_PARK_PROPERTY.incumbentManager.value,
    status: 'active',
    tags: ['pitch', 'oak-park-douglaston'],
    pipeline_stage: 'proposal',
    violations_count: OAK_PARK_PROPERTY.dobViolations.value + OAK_PARK_PROPERTY.hpdViolations.value,
    open_violations_count: OAK_PARK_PROPERTY.dobViolations.value,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Builds an AgreementInput (the exact shape src/pages/Agreements.tsx /
 * src/lib/excalibur.ts expects) for one Oak Park legal entity, so the
 * "Download Management Agreement" action on the pitch page reuses the
 * same generateAgreement() function and document design standard as
 * every other Camelot agreement.
 */
export function oakParkAgreementInputFor(entityKey: PitchEntity['key']): AgreementInput {
  const entity = OAK_PARK_ENTITIES.find((e) => e.key === entityKey);
  if (!entity) throw new Error(`Unknown Oak Park entity: ${entityKey}`);

  return {
    assetClass: 'condo',
    clientName: entity.shortLabel,
    clientEntityName: entity.legalName,
    clientAddress: OAK_PARK_PROPERTY.fullAddress,
    clientPhone: '',
    clientEmail: '',
    propertyAddress: OAK_PARK_PROPERTY.address,
    propertyCity: OAK_PARK_PROPERTY.city,
    propertyState: OAK_PARK_PROPERTY.state,
    propertyZip: OAK_PARK_PROPERTY.zip,
    units: entity.units.value,
    blockLot: OAK_PARK_PROPERTY.blockLot,
    isRentStabilized: false,
    isUnion: false,
    buildingType: `${entity.shortLabel} \u00b7 ${entity.units.value} Units (working count, subject to confirmation)`,
    effectiveDate: new Date().toISOString().slice(0, 10),
    initialTermYears: 1,
    renewalTermYears: 1,
    terminationNoticeDays: 90,
    annualIncrease: OAK_PARK_PRICING.escalatorPct,
    selectedTier: 'intelligence',
    customMonthlyFee: entity.monthlyFeeTotal.value,
    startupFee: 0,
    specialTerms:
      'One regular Board meeting per month included across the community (a joint/consecutive session counts as one); ' +
      `each additional separate Board meeting is $${OAK_PARK_PRICING.additionalMeetingFee}. ` +
      'Ancillary services billed per the Schedule B rate sheet, never bundled into the base management fee. ' +
      'Unit counts and fee allocation shown are working figures subject to confirmation against offering plans, ' +
      'owner ledgers, and outgoing management records prior to execution.',
    propertyImages: [],
    propertyIntel: [
      `${OAK_PARK_PROPERTY.buildingCount.value} buildings on a ${OAK_PARK_PROPERTY.lotSqFt.value.toLocaleString()} sq ft lot, ${OAK_PARK_PROPERTY.zoning.value} zoning (PropertyShark)`,
      `${OAK_PARK_PROPERTY.dobViolations.value} DOB violations, ${OAK_PARK_PROPERTY.hpdViolations.value} HPD violations on file as of the most recent report — verify current status before execution`,
    ],
    jackieData: null,
    tieredPricing: null,
  };
}
