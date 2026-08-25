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
  openItem: 'Juil specifically asked for the assigned property manager\'s name, current portfolio/unit load, and backup coverage — do not present a final package without this confirmed.',
};

// ============================================================
// Team
// ============================================================

export interface PitchTeamMember {
  role: string;
  person: Fact<string>;
  commitment: string;
}

export const OAK_PARK_TEAM: PitchTeamMember[] = [
  {
    role: 'Property Manager',
    person: unconfirmed('To be assigned', 'Confirm whether Dominic Martorana is the account lead, property manager, or executive advisor for this account before any board-facing document is finalized'),
    commitment: 'On site at least weekly, ~2-hour minimum visit, superintendent/staff check-in, common-area walk, written site report',
  },
  {
    role: 'Senior Director, Condo & Co-op Services',
    person: confirmed('Valerie Ann Fiume'),
    commitment: 'Executive board support, escalation, management standards, transition oversight',
  },
  {
    role: 'Facilities Manager',
    person: confirmed('Tim Kelly'),
    commitment: 'Monthly facilities review during the first 60 days, quarterly thereafter, plus issue-driven visits; staff coaching, SOP buildout, preventive-maintenance schedules',
  },
  {
    role: 'Accounting Manager',
    person: unconfirmed('To be assigned'),
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
    role: 'Executive Oversight',
    person: confirmed('David A. Goldoff, Founder & President'),
    commitment: 'Personally participates in transition, budget review, and early-stage cost analysis',
  },
];

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
  'SELECT (meetselect.com) is an optional resident lifestyle add-on. Not to be promised as included until a community-level commercial arrangement is confirmed.',
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

export const OAK_PARK_TO_BE_CONFIRMED: string[] = [
  'Official unit counts — Condominium I, Condominium II, and total community (currently working figures of 121 / 92 / 213)',
  'Assigned property manager\'s name, current portfolio/unit load, and backup coverage',
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
