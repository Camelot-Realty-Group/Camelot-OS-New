/**
 * Proposal Generation Engine
 * Generates structured proposal data from Building records for PDF rendering.
 */

import type { Building, Contact } from '@/types';

// ============================================================
// Company Constants
// ============================================================

export const CAMELOT_INFO = {
  name: 'Camelot Realty Group',
  address: '57 West 57th Street, Suite 410, New York, NY 10019',
  phone: '(212) 206-9939',
  website: 'www.camelot.nyc',
  licenses: [
    { entity: 'Camelot Brokerage Services Corp', number: '#10311208308' },
    { entity: 'Camelot Realty Group LLC', number: '#10491200104' },
  ],
  portfolio: {
    buildings: '42',
    sqft: '1.2M',
    description: '42-building portfolio across Manhattan, Brooklyn, Queens, Bronx, NJ, CT & Florida',
  },
};

export const COMPETITIVE_ADVANTAGES = [
  {
    title: 'Proven Portfolio',
    description: `Currently managing ${CAMELOT_INFO.portfolio.buildings} buildings and ${CAMELOT_INFO.portfolio.sqft} sq ft of residential and commercial property across all five boroughs.`,
  },
  {
    title: 'Technology-Driven Operations',
    description:
      'Proprietary building intelligence platform with real-time violation monitoring, automated compliance tracking, and resident communication via ConciergePlus.',
  },
  {
    title: 'Personal Attention',
    description:
      'Unlike large firms where your building is one of thousands, our principals personally oversee every property. Weekly on-site inspections are standard, not optional.',
  },
  {
    title: 'Financial Transparency',
    description:
      'Real-time budget tracking, monthly board reporting with full financials, zero hidden bank fees. Your money works for your building.',
  },
  {
    title: 'Vendor Network',
    description:
      '20+ years of cultivated vendor relationships deliver better pricing and faster response times for maintenance, capital projects, and emergency repairs.',
  },
  {
    title: 'Compliance Expertise',
    description:
      'Proactive violation resolution, Local Law 97 energy compliance planning, DOB permit management, and regulatory reporting — keeping your building ahead of deadlines.',
  },
];

// ============================================================
// Pricing Logic
// ============================================================

export interface PricingBreakdown {
  baseRate: number;
  baseRateLabel: string;
  packageName: string;
  rentStabilizedSurcharge: number;
  ll97Surcharge: number;
  totalPerUnit: number;
  totalMonthly: number;
  totalAnnual: number;
  units: number;
}

export function calculatePricing(
  units: number,
  options?: { rentStabilized?: boolean; ll97Services?: boolean }
): PricingBreakdown {
  let baseRate: number;
  let baseRateLabel: string;

  if (units < 30) {
    baseRate = 79;
    baseRateLabel = 'Small-building minimum / Intelligence';
  } else if (units <= 75) {
    baseRate = 58;
    baseRateLabel = 'Mid-size Intelligence';
  } else if (units <= 150) {
    baseRate = 48;
    baseRateLabel = 'Large-building Intelligence';
  } else {
    baseRate = 40;
    baseRateLabel = 'Portfolio Intelligence';
  }

  const rentStabilizedSurcharge = options?.rentStabilized ? 5 : 0;
  const ll97Surcharge = options?.ll97Services ? 3 : 0;
  const totalPerUnit = baseRate + rentStabilizedSurcharge + ll97Surcharge;
  const calculatedMonthly = totalPerUnit * units;
  const totalMonthly = units < 30 ? Math.max(calculatedMonthly, 1500) : calculatedMonthly;
  const totalAnnual = totalMonthly * 12;

  return {
    baseRate,
    baseRateLabel,
    packageName: 'Camelot Intelligence Package (Recommended)',
    rentStabilizedSurcharge,
    ll97Surcharge,
    totalPerUnit,
    totalMonthly,
    totalAnnual,
    units,
  };
}

// ============================================================
// Service Catalog
// ============================================================

export interface ServiceItem {
  name: string;
  description: string;
  included: boolean;
}

export interface AncillaryFeeItem {
  service: string;
  fee: string;
  notes: string;
  billedTo: 'Association' | 'Individual';
}

export const STANDARD_SERVICES: ServiceItem[] = [
  { name: 'Property Management', description: 'Day-to-day building operations, staff oversight, vendor management', included: true },
  { name: 'Financial Management', description: 'Budgeting, accounts payable/receivable, monthly board reporting', included: true },
  { name: 'Violation Resolution', description: 'HPD, DOB, and ECB violation tracking, resolution, and dismissal', included: true },
  { name: 'Maintenance Coordination', description: 'Work order management, preventive maintenance scheduling', included: true },
  { name: 'Resident Communication', description: 'ConciergePlus portal, package tracking, announcements', included: true },
  { name: 'Insurance Administration', description: 'Policy review, claims management, certificate tracking', included: true },
  { name: 'Capital Planning', description: 'Reserve fund analysis, project management, contractor procurement', included: true },
  { name: 'Compliance & Reporting', description: 'Annual filings, Local Law compliance, DHCR submissions', included: true },
];

export const PREMIUM_SERVICES: ServiceItem[] = [
  { name: 'LL97 Energy Compliance', description: 'Carbon emissions tracking, retrofit planning, penalty avoidance strategy', included: false },
  { name: 'Rent Stabilization Admin', description: 'DHCR filings, MCI applications, rent roll management', included: false },
  { name: 'Construction Management', description: 'Major capital project oversight, bid solicitation, schedule management', included: false },
  { name: 'Legal Coordination', description: 'Attorney liaison for building-related legal matters', included: false },
];

export const ASSOCIATION_ANCILLARY_FEES: AncillaryFeeItem[] = [
  {
    service: 'Client account establishment',
    fee: '$250 per account',
    notes: 'Bank/account setup, opening control file, and onboarding coordination.',
    billedTo: 'Association',
  },
  {
    service: 'RPIE / RPIE exception filing',
    fee: '$400 per filing',
    notes: 'Preparation support and submission coordination when applicable.',
    billedTo: 'Association',
  },
  {
    service: '1098 / 1099 processing',
    fee: '$25 per form',
    notes: 'Year-end form preparation and administrative processing.',
    billedTo: 'Association',
  },
  {
    service: 'Energy benchmarking / LL84-LL97 annual filing',
    fee: '$250 per year',
    notes: 'Annual data coordination and filing support; remediation work separately scoped.',
    billedTo: 'Association',
  },
  {
    service: 'Violation research and filing',
    fee: '$95 per violation',
    notes: 'Administrative tracking, filing, and dismissal package coordination.',
    billedTo: 'Association',
  },
  {
    service: 'Administrative hearings / agency appearances',
    fee: '$150 per hour',
    notes: 'DOB, HPD, ECB/OATH, or similar agency support when requested.',
    billedTo: 'Association',
  },
  {
    service: 'Construction / capital project supervision',
    fee: '10% of project cost',
    notes: 'Bid coordination, contractor follow-up, invoice review, and progress reporting.',
    billedTo: 'Association',
  },
  {
    service: 'Insurance administration',
    fee: '$450 per year',
    notes: 'Certificate tracking, policy coordination, claim file support, and renewal follow-up.',
    billedTo: 'Association',
  },
  {
    service: 'Mortgage / lender coordination',
    fee: '$150-$200 per hour',
    notes: 'Bank, accountant, attorney, and board coordination for refinancing or lender requests.',
    billedTo: 'Association',
  },
  {
    service: 'After-hours or special board meetings',
    fee: '$250 per meeting',
    notes: 'Meetings outside the agreed management cadence or standard business hours.',
    billedTo: 'Association',
  },
];

export const INDIVIDUAL_ANCILLARY_FEES: AncillaryFeeItem[] = [
  {
    service: 'Lease application processing',
    fee: '$200 per application',
    notes: 'Applicant intake, package review, and administrative processing.',
    billedTo: 'Individual',
  },
  {
    service: 'Move-in coordination',
    fee: '$150 per move',
    notes: 'Move scheduling, insurance review, building access, and elevator/common-area coordination.',
    billedTo: 'Individual',
  },
  {
    service: 'Move-out coordination',
    fee: '$150 per move',
    notes: 'Move scheduling, insurance review, building access, and closeout coordination.',
    billedTo: 'Individual',
  },
  {
    service: 'Lease renewal processing',
    fee: '$350 per renewal',
    notes: 'Renewal package administration and management review.',
    billedTo: 'Individual',
  },
  {
    service: 'Sublease / assignment review',
    fee: '$500 per application',
    notes: 'Board package processing and administrative review support.',
    billedTo: 'Individual',
  },
  {
    service: 'Condo resale / waiver package',
    fee: '$500 per package',
    notes: 'Application package preparation, coordination, and document handling.',
    billedTo: 'Individual',
  },
  {
    service: 'Alteration application review',
    fee: '$500 per application',
    notes: 'Administrative review, insurance/license tracking, and agreement coordination.',
    billedTo: 'Individual',
  },
  {
    service: 'Estoppel certificate',
    fee: '$250 per certificate',
    notes: 'Account status research and certificate preparation.',
    billedTo: 'Individual',
  },
  {
    service: 'Co-op transfer / sale package',
    fee: '$500 per package',
    notes: 'Shareholder transfer package processing and board coordination.',
    billedTo: 'Individual',
  },
  {
    service: 'Recognition agreement processing',
    fee: '$300 per agreement',
    notes: 'Lender recognition agreement intake, review routing, and execution coordination.',
    billedTo: 'Individual',
  },
  {
    service: 'Stock certificate / proprietary lease processing',
    fee: '$200 per item',
    notes: 'Administrative preparation and delivery coordination where applicable.',
    billedTo: 'Individual',
  },
  {
    service: 'Year-end tax package',
    fee: '$150 per package',
    notes: 'Unit/shareholder tax-support package when requested outside standard reporting.',
    billedTo: 'Individual',
  },
];

// ============================================================
// Proposal Data Structure
// ============================================================

export interface ProposalSection {
  id: string;
  title: string;
  enabled: boolean;
}

export const DEFAULT_SECTIONS: ProposalSection[] = [
  { id: 'executive_summary', title: 'Executive Summary', enabled: true },
  { id: 'building_analysis', title: 'Building Analysis', enabled: true },
  { id: 'management_assessment', title: 'Current Management Assessment', enabled: true },
  { id: 'services_overview', title: 'Camelot Services Overview', enabled: true },
  { id: 'pricing', title: 'Pricing Estimate', enabled: true },
  { id: 'ancillary_fees', title: 'Schedule A / Ancillary Fees', enabled: true },
  { id: 'why_camelot', title: 'Why Camelot', enabled: true },
  { id: 'next_steps', title: 'Next Steps', enabled: true },
];

export interface ProposalAttachmentRecord {
  type: 'proposal_pdf' | 'jackie_report' | 'board_deck' | 'source_packet' | 'other';
  label: string;
  status: 'generated' | 'available' | 'pending' | 'attached';
  generatedAt?: string;
}

export interface ProposalData {
  // Meta
  generatedAt: string;
  proposalNumber: string;
  generatedBy: string;
  sentTo?: string;
  preparedFor: string;
  archiveFolder: string;
  // Optional custom cover-letter body paragraphs, in order. When omitted,
  // ProposalPDF renders its standard boilerplate cover letter instead.
  coverLetterParagraphs?: string[];

  // Building
  buildingAddress: string;
  buildingName?: string;
  buildingType: string;
  borough?: string;
  neighborhood?: string;
  units: number;
  yearBuilt?: number;
  stories?: number;
  buildingClass?: string;

  // Contact
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Analysis
  violationsCount: number;
  openViolationsCount: number;
  lastViolationDate?: string;
  energyStarScore?: number;
  siteEUI?: number;
  ghgEmissions?: number;
  currentManagement?: string;
  dofOwner?: string;
  marketValue?: number;
  assessedValue?: number;

  // Scoring
  score: number;
  grade: string;
  signals: string[];

  // Sections
  sections: ProposalSection[];

  // Pricing
  pricing: PricingBreakdown;

  // Services
  standardServices: ServiceItem[];
  premiumServices: ServiceItem[];
  associationAncillaryFees: AncillaryFeeItem[];
  individualAncillaryFees: AncillaryFeeItem[];
  attachments: ProposalAttachmentRecord[];

  // Company
  company: typeof CAMELOT_INFO;
  advantages: typeof COMPETITIVE_ADVANTAGES;
}

// ============================================================
// Proposal Options
// ============================================================

export interface ProposalOptions {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  rentStabilized?: boolean;
  ll97Services?: boolean;
  sections?: ProposalSection[];
  customPricingPerUnit?: number;
  generatedBy?: string;
  attachments?: ProposalAttachmentRecord[];
  coverLetterParagraphs?: string[];
}

// ============================================================
// Generator
// ============================================================

function generateProposalNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `CML-${y}${m}${d}-${seq}`;
}

function isCoopLike(type?: string): boolean {
  return /co-?op|cooperative|tenancy/i.test(type || '');
}

function defaultPreparedFor(building: Building, contactName?: string): string {
  if (contactName?.trim()) return contactName.trim();
  return isCoopLike(building.type) ? 'the Shareholders' : 'the Board of Directors';
}

export function generateProposalData(
  building: Building,
  options?: ProposalOptions
): ProposalData {
  const units = building.units || 1;

  // Determine if rent stabilized or LL97 applies based on building data or options
  const rentStabilized = options?.rentStabilized ?? (building.type === 'rental' && units >= 6);
  const ll97Services =
    options?.ll97Services ??
    (building.energy_star_score != null && building.energy_star_score < 50);

  const pricing = options?.customPricingPerUnit
    ? {
        baseRate: options.customPricingPerUnit,
        baseRateLabel: 'Custom Intelligence',
        packageName: 'Camelot Intelligence Package (Recommended)',
        rentStabilizedSurcharge: rentStabilized ? 5 : 0,
        ll97Surcharge: ll97Services ? 3 : 0,
        totalPerUnit:
          options.customPricingPerUnit + (rentStabilized ? 5 : 0) + (ll97Services ? 3 : 0),
        totalMonthly:
          (options.customPricingPerUnit + (rentStabilized ? 5 : 0) + (ll97Services ? 3 : 0)) *
          units,
        totalAnnual:
          (options.customPricingPerUnit + (rentStabilized ? 5 : 0) + (ll97Services ? 3 : 0)) *
          units *
          12,
        units,
      }
    : calculatePricing(units, { rentStabilized, ll97Services });

  // Build premium services with correct "included" flags
  const premiumServices = PREMIUM_SERVICES.map((s) => ({
    ...s,
    included:
      (s.name === 'LL97 Energy Compliance' && ll97Services) ||
      (s.name === 'Rent Stabilization Admin' && rentStabilized) ||
      s.included,
  }));

  // Pick first suitable contact if none provided
  const contact: Contact | undefined =
    options?.contactName
      ? undefined
      : building.contacts?.find((c) => c.email) ?? building.contacts?.[0];

  const sections = options?.sections ?? DEFAULT_SECTIONS;
  const generatedAt = new Date().toISOString();
  const proposalNumber = generateProposalNumber();
  const contactName = options?.contactName ?? contact?.name;
  const contactEmail = options?.contactEmail ?? contact?.email;
  const contactPhone = options?.contactPhone ?? contact?.phone;
  const archiveFolder = building.address.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const preparedFor = defaultPreparedFor(building, contactName);

  return {
    generatedAt,
    proposalNumber,
    generatedBy: options?.generatedBy || 'Camelot OS Proposal Builder',
    sentTo: contactEmail || contactName || 'To be confirmed',
    preparedFor,
    archiveFolder,
    coverLetterParagraphs: options?.coverLetterParagraphs,

    buildingAddress: building.address,
    buildingName: building.name,
    buildingType: building.type,
    borough: building.borough,
    neighborhood: building.region,
    units,
    yearBuilt: building.year_built,
    stories: building.stories,
    buildingClass: building.building_class,

    contactName,
    contactEmail,
    contactPhone,

    violationsCount: building.violations_count ?? 0,
    openViolationsCount: building.open_violations_count ?? 0,
    lastViolationDate: building.last_violation_date,
    energyStarScore: building.energy_star_score,
    siteEUI: building.site_eui,
    ghgEmissions: building.ghg_emissions,
    currentManagement: building.current_management,
    dofOwner: building.dof_owner,
    marketValue: building.market_value,
    assessedValue: building.assessed_value,

    score: building.score,
    grade: building.grade,
    signals: building.signals ?? [],

    sections,
    pricing,

    standardServices: [...STANDARD_SERVICES],
    premiumServices,
    associationAncillaryFees: [...ASSOCIATION_ANCILLARY_FEES],
    individualAncillaryFees: [...INDIVIDUAL_ANCILLARY_FEES],
    attachments:
      options?.attachments ??
      [
        { type: 'proposal_pdf', label: 'Property management proposal PDF', status: 'generated', generatedAt },
        { type: 'jackie_report', label: 'Jackie report / diligence support packet', status: 'pending' },
      ],

    company: CAMELOT_INFO,
    advantages: COMPETITIVE_ADVANTAGES,
  };
}
