import { GOOGLE_MAPS_KEY } from '@/lib/maps-key';
/**
 * Camelot Master Report System
 * Combines building intelligence + pitch deck + market data into one unified report.
 * Generates: HTML brochure, cold caller sheet, email drafts, CSV exports.
 */

import { fetchFullBuildingReport } from '@/lib/nyc-api';
import { calculateLL97Penalty, getComplianceStatus, inferBuildingType } from '@/lib/ll97-calculator';
import { analyzeDistress } from '@/lib/distress-signals';
import { runGutCheck, generateGutCheckHTML } from '@/lib/gut-check';
import { findBuildingPhotos, generatePhotoHTML } from '@/lib/building-photos';
import { getNeighborhoodIntel, generateNeighborhoodIntelHTML } from '@/lib/neighborhood-intel';
import { fetchStreetEasyBuilding, type StreetEasyBuilding } from '@/lib/streeteasy';
import { searchViolations, type ViolationSummary } from '@/lib/nyc-violations';
import { fetch311Complaints } from '@/lib/nyc-311';
import {
  NY_OWNERSHIP_HUNT_SEQUENCE,
  NY_OWNERSHIP_HUNT_SIGNATORY_RULE,
  NY_OWNERSHIP_HUNT_SOURCE_NAMES,
  NY_PEOPLE_ENTITY_COMP_SOURCE_NAMES,
  nyOwnershipHuntSummary,
  nyPeopleEntityCompSourceSummary,
} from '@/lib/ny-research-sources';
import { buildDavidGoldoffSignatureHtml, DAVID_GOLDOFF_SIGNATURE_TEXT } from '@/lib/camelot-signature';
import {
  EAST_36_22_ADDRESS,
  EAST_36_22_MANAGEMENT_TO_VERIFY,
  EAST_36_22_NAME,
  EAST_36_22_UNIT_COUNT,
  CPW_279_ADDRESS,
  CPW_279_MANAGEMENT_TO_VERIFY,
  CPW_279_NAME,
  CPW_279_UNIT_COUNT,
  is36East22ndStreetValue,
  is279CentralParkWestValue,
} from '@/lib/property-guardrails';
import { applyJackieFactAuthority, sanitizeJackieKnownPropertyHtml } from '@/lib/jackie-fact-authority';

// ============================================================
// Types
// ============================================================

export interface MasterReportData {
  address: string;
  borough: string;
  buildingName: string;
  date: string;
  reportFocus?: ReportFocusInput;
  // DOF
  units: number;
  stories: number;
  yearBuilt: number;
  buildingClass: string;
  taxClass: string;
  marketValue: number;
  /** Residential vs total (incl. commercial) unit counts from PLUTO. */
  unitsResidential?: number;
  unitsTotalAll?: number;
  /** Nearest subway stations (MTA dataset): name, routes, straight-line miles. */
  nearbySubways?: Array<{ name: string; routes: string; miles: number }>;
  assessedValue: number;
  landValue: number;
  lotArea: number;
  buildingArea: number;
  dofOwner: string;
  bbl: string;
  // Registration
  registrationOwner: string | null;
  managementCompany: string | null;
  // Violations
  violationsTotal: number;
  violationsOpen: number;
  violationClassA: number;
  violationClassB: number;
  violationClassC: number;
  lastViolationDate: string | null;
  // ECB
  ecbCount: number;
  ecbPenaltyBalance: number;
  // Permits
  permitsCount: number;
  hasRecentPermits: boolean;
  // Energy / LL97
  energyStarScore: number | null;
  siteEUI: number | null;
  ghgEmissions: number | null;
  occupancy: string | null;
  ll97: {
    period1Penalty: number;
    period2Penalty: number;
    totalExposure11yr: number;
    complianceStatus: string;
    buildingType: string;
    emissionsLimit: number;
    actualEmissions: number;
  } | null;
  // ACRIS
  lastSaleDate: string | null;
  lastSalePrice: number;
  lastSaleBuyer: string | null;
  lastSaleSeller: string | null;
  deedCount: number;
  mortgageCount: number;
  // Litigation
  litigationCount: number;
  hasActiveLitigation: boolean;
  // Rent Stabilization
  isRentStabilized: boolean;
  // Compliance source coverage
  dobViolationCount: number;
  dobViolationOpen: number;
  facadeFilingCount: number;
  facadeIssueCount: number;
  dhcrRecordCount: number;
  courtIndexCount: number;
  acrisLienClaimCount: number;
  complianceSourceChecks: ComplianceSourceCheck[];
  complianceReleaseStatus: 'verified' | 'needs_review' | 'blocked';
  // Distress
  distressScore: number;
  distressLevel: string;
  distressSignals: Array<{ type: string; description: string; severity: string }>;
  // Scoring
  scoutScore: number;
  scoutGrade: string;
  // 311
  complaint311Count: number;
  // Pricing
  pricePerUnit: number;
  monthlyFee: number;
  annualFee: number;
  // Geolocation
  latitude: number | null;
  longitude: number | null;
  // Property classification
  propertyType: string;
  neighborhoodName: string;
  zipCode: string;
  neighborhoodSearchContext: {
    zipCode: string;
    neighborhoodName: string;
    borough: string;
    query: string;
    source: string;
  };
  neighborhoodMarketData: NeighborhoodMarketData | null;
  // Management performance
  registrationDate: string | null;
  managementDuration: string | null;
  managementGrade: string;
  managementScorecard: { violations: number; compliance: number; financial: number; overall: number };
  // Building contacts
  boardMembers: Array<{ name: string; title: string }>;
  buildingStaff: Array<{ role: string; name: string }>;
  professionals: { lawFirm: string | null; accountingFirm: string | null; engineer: string | null; architect: string | null };
  contactResearchSources: string[];
  professionalResearchSources: string[];
  // DOB Professional contacts
  dobArchitects: Array<{ name: string; title: string; license: string }>;
  dobEngineers: Array<{ name: string; title: string; license: string }>;
  dobOwners: Array<{ name: string; businessName: string; phone: string; type: string }>;
  // DOF Abatement & Tax Liens
  hasAbatement: boolean;
  abatementAmount: number;
  hasTaxLien: boolean;
  abatementType: string;
  abatementTaxYear: string | null;
  abatementSourceStatus: string | null;
  abatementMatchedLot: string | null;
  dofTaxMarketValue: number;
  dofTaxAssessedValue: number;
  taxLienSourceStatus: string | null;
  taxLienRecordCount: number;
  taxLienMatchedLots: string[];
  taxLienDetails: Array<{ cycle: string; date: string; waterDebtOnly: boolean; lot?: string; houseNumber?: string; streetName?: string; zip?: string; taxClass?: string; buildingClass?: string }>;
  // Tiered pricing
  tieredPricing: TieredPricing;
  // Fee comparison
  feeComparison: MarketFeeComparison | null;
  // StreetEasy data
  streetEasy: StreetEasyBuilding | null;
  // Commercial / amenity / branding research
  commercialIntel: CommercialAmenityIntel;
  // Raw data for advanced usage
  buildingPhotos: { exterior: string[]; interior: string[]; streetView?: string; satellite?: string; attribution?: string; noPhotoAvailable?: boolean; source: string } | null;
  neighborhoodIntel: { crimeScore: number; qualityScore: number; transitScore: number; crimeTotal: number; complaints311Total: number; crimeBreakdown: Array<{type: string; count: number}>; topComplaints: Array<{type: string; count: number}>; landmarks: Array<{name: string; type: string; date: string}>; crimePrecinct: string; scoreExplanation: string } | null;
  raw: any;
}

export type ReportFocusKey =
  | 'property_management'
  | 'accounting'
  | 'automation'
  | 'compliance'
  | 'project_management'
  | 'resident_experience'
  | 'staffing'
  | 'energy_savings'
  | 'financing'
  | 'budget_savings'
  | 'hoa_recovery';

export interface ReportFocusInput {
  selectedFocus: ReportFocusKey[];
  inquiryContact?: string;
  inquiryEmail?: string;
  inquiryPhone?: string;
  inquiryOrganization?: string;
  inquiryRole?: string;
  inquiryNotes?: string;
}

export interface ReportFocusTheme {
  key: ReportFocusKey;
  label: string;
  icon: string;
  headline: string;
  narrative: string;
  proofPoints: string[];
}

export const REPORT_FOCUS_THEMES: Record<ReportFocusKey, ReportFocusTheme> = {
  property_management: {
    key: 'property_management',
    label: 'Property Management',
    icon: 'PM',
    headline: 'Hands-on management with senior accountability',
    narrative: 'Camelot will emphasize responsive property management: senior oversight, weekly inspections, vendor coordination, resident communication, emergency response, and board-ready operational discipline.',
    proofPoints: ['Senior management access', 'Weekly site visits and vendor follow-up', 'Direct escalation path for boards and resident managers'],
  },
  accounting: {
    key: 'accounting',
    label: 'Accounting & Reports',
    icon: 'CPA',
    headline: 'Accounting, collections, and board reporting strength',
    narrative: 'Camelot will emphasize its accounting bench: CPA oversight, controller review, account managers, bookkeepers, MDS reporting, collections discipline, and monthly management reports deployed between the 20th and 25th.',
    proofPoints: ['CPA, controller, account managers, and bookkeepers', 'MDS-backed monthly management reports', 'Collections, arrears, budgets, and custom board reporting'],
  },
  automation: {
    key: 'automation',
    label: 'Automation & AI',
    icon: 'AI',
    headline: 'Automation that makes service faster and cleaner',
    narrative: 'Camelot will emphasize how it uses ConciergePlus, MDS, AppFolio, Merlin AI, SCOUT, and Camelot Central to move work orders, reporting, cost tracking, resident communication, and board support faster.',
    proofPoints: ['AI-assisted meeting minutes and triage', 'Automated reporting and cost tracking', 'Integrated portal, accounting, and property operations tools'],
  },
  compliance: {
    key: 'compliance',
    label: 'Compliance & Violations',
    icon: 'LL',
    headline: 'Compliance pressure handled before it becomes board pain',
    narrative: 'Camelot will emphasize HPD, DOB, ECB/OATH, DOF, LL97, LL11/FISP, DHCR, permits, tax liens, complaints, deadlines, and release guardrails for verified compliance data.',
    proofPoints: ['Violation and deadline tracking', 'LL97 and FISP compliance roadmap', 'Source-checked public-record risk review'],
  },
  project_management: {
    key: 'project_management',
    label: 'Project Management',
    icon: 'CAP',
    headline: 'Capital projects with scope, bidding, and accountability',
    narrative: 'Camelot will emphasize capital planning, contractor bidding, project management, change-order control, engineering coordination, closeout discipline, and board communication for upcoming improvements.',
    proofPoints: ['Bid leveling and vendor coordination', 'Construction oversight and change-order review', 'Board-facing project reporting'],
  },
  resident_experience: {
    key: 'resident_experience',
    label: 'Resident Experience',
    icon: 'RX',
    headline: 'A better daily experience for residents and boards',
    narrative: 'Camelot will emphasize ConciergePlus, resident portals, work orders, amenity bookings, package/service communication, front desk coordination, and practical resident-facing service.',
    proofPoints: ['Resident portal and mobile workflows', 'Work orders and amenity requests', 'Clearer communication between residents, staff, and management'],
  },
  staffing: {
    key: 'staffing',
    label: 'Staffing & Front Desk',
    icon: 'STAFF',
    headline: 'Creative staffing models that reduce burnout',
    narrative: 'Camelot will emphasize fractional senior leadership, assistant manager support, concierge/front desk staffing, resident manager coordination, union and non-union staff supervision, and deeper bench coverage.',
    proofPoints: ['Fractional GM/service manager options', 'Assistant manager and account support coverage', 'Concierge/front desk staffing structure'],
  },
  energy_savings: {
    key: 'energy_savings',
    label: 'Energy Savings',
    icon: 'E',
    headline: 'Energy, utility, and carbon savings with a compliance lens',
    narrative: 'Camelot will emphasize utility benchmarking, LL97 exposure, Parity-style energy monitoring, vendor/rebate opportunities, and capital upgrades that reduce operating cost and carbon risk.',
    proofPoints: ['LL97 penalty modeling', 'Utility tracking and energy monitoring', 'Rebates, incentives, and upgrade path review'],
  },
  financing: {
    key: 'financing',
    label: 'Financing',
    icon: 'FIN',
    headline: 'Capital advisory for refinancing, credit lines, and project funding',
    narrative: 'Camelot will emphasize its lender-facing process for boards and owners that need refinancing, new loan origination, capital improvement financing, operating credit lines, bridge debt, or long-term bank products. Camelot can run an RFP, level lender quotes, organize the bank file, coordinate counsel and closing, and help deploy proceeds after funding.',
    proofPoints: ['Lender RFP and apples-to-apples comparison matrix', 'Sensitivity analysis, bank-file coordination, and closing support', 'Separate capital advisory fee structure outside base management'],
  },
  budget_savings: {
    key: 'budget_savings',
    label: 'Budget Savings',
    icon: '$',
    headline: 'Savings from smarter operations, not service cuts',
    narrative: 'Camelot will emphasize vendor rebidding, labor review, materials and supplies discipline, insurance review, purchasing controls, collections, and long-term value creation.',
    proofPoints: ['Vendor bidding and scope control', 'Labor, materials, and supplies review', 'Budget, reserve, and operating expense discipline'],
  },
  hoa_recovery: {
    key: 'hoa_recovery',
    label: 'HOA Recovery',
    icon: 'HOA',
    headline: 'Executive HOA stabilization, claims oversight, and field operations',
    narrative: 'Camelot will emphasize a hybrid HOA executive management platform for operational stabilization, financial transparency, claims/restoration oversight, vendor accountability, regional field support, and long-term asset preservation. For Connecticut HOA and condo opportunities, Camelot searches local brokerage community profiles, Zillow, Apartments.com, Yelp / Google review signals, town assessor and land records, local building/planning records, reserve/insurance files, and board-provided documents before treating facts as board-facing.',
    proofPoints: ['Executive management layer plus regional field operations', 'Insurance and restoration coordination', '30-60-90 day HOA stabilization plan', 'Connecticut HOA source stack: Dagny/local brokerage profiles, Zillow, Apartments.com, Yelp/Google reviews, town land/tax/building records'],
  },
};

export interface ComplianceSourceCheck {
  source: string;
  status: 'loaded' | 'searched' | 'manual_required' | 'blocked';
  count: number;
  detail: string;
  url?: string;
}

export interface CommercialAmenityIntel {
  commercialSignals: string[];
  likelyCommercialUses: string[];
  amenities: string[];
  revenueOpportunities: string[];
  officialWebsite: string | null;
  brandingTitle: string | null;
  brandingDescription: string | null;
  brandingImages: string[];
  researchSources: string[];
  researchStatus: 'verified' | 'needs_review';
}

interface KnownPropertyFacts {
  canonicalAddress?: string;
  buildingName?: string;
  borough?: string;
  bbl?: string;
  buildingClass?: string;
  buildingArea?: number;
  lotArea?: number;
  marketValue?: number;
  assessedValue?: number;
  propertyTax?: number;
  latitude?: number;
  longitude?: number;
  dofOwner?: string;
  managementCompany?: string;
  units?: number;
  alternateUnits?: number;
  stories?: number;
  yearBuilt?: number;
  taxClass?: string;
  propertyType?: string;
  energyStarScore?: number | null;
  hpdViolationsTotal?: number;
  hpdViolationsOpen?: number;
  dobViolationCount?: number;
  lastSaleDate?: string | null;
  lastSalePrice?: number;
  lastSaleBuyer?: string | null;
  lastSaleSeller?: string | null;
  neighborhoodName?: string;
  streetEasyUrl?: string;
  officialWebsite?: string;
  description?: string;
  amenities?: string[];
  commercialSignals?: string[];
  revenueOpportunities?: string[];
  imageUrls?: string[];
  landmarks?: string[];
  locationTitle?: string;
  locationCopy?: string;
  lifestyleTitle?: string;
  lifestyleCopy?: string;
  brandingTitle?: string;
  brandingDescription?: string;
  researchSources?: string[];
  currentManagement?: string;
  boardMembers?: Array<{ name: string; title: string }>;
  buildingStaff?: Array<{ role: string; name: string }>;
  professionalArchitects?: Array<{ name: string; title: string; license: string }>;
  professionalEngineers?: Array<{ name: string; title: string; license: string }>;
  lawFirm?: string;
  accountingFirm?: string;
  professionalSources?: string[];
  professionalNotes?: string[];
}

// ============================================================
function isExplicitSelfManaged(value?: string | null): boolean {
  return /\bself[-\s]?managed\b/i.test(String(value || ''));
}

function verifiedManagementLabel(value?: string | null): string {
  const cleaned = String(value || '').trim();
  if (!cleaned || /^unknown$/i.test(cleaned) || /to be confirmed/i.test(cleaned)) {
    return 'Management to verify';
  }
  return cleaned;
}

function cleanBuildingName(value: string, address: string, managementCompany?: string | null): string {
  let cleaned = String(value || '').trim();
  const mgmt = String(managementCompany || '').trim();
  if (is279CentralParkWestSubject(address, cleaned)) return '279 Central Park West';
  if (mgmt) {
    const escaped = mgmt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b`, 'ig'), '').trim();
  }
  cleaned = cleaned
    .replace(/_/g, ' ')
    .replace(/\b20\d{2}\b\s*$/g, '')
    .replace(/\bAKAM\b/ig, '')
    .replace(/\b(?:Management|Managed\s+By|Mgmt)\b\s*:?\s*$/ig, '')
    .replace(/^[\s,:;\-–—|]+|[\s,:;\-–—|]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || address;
}

// Neighborhood Market Data (Q1 2026 — from Camelot Market Report)
// ============================================================

function hasExact22East22Subject(...values: Array<string | null | undefined>): boolean {
  return values.some(value => {
    const key = String(value || '').toLowerCase();
    if (!key) return false;
    if (/(^|[^0-9])220\s+(?:e|east)\s+22(?:nd)?\s+(?:st|street)\b/i.test(key)) return false;
    return /(^|[^0-9])22\s+(?:e|east)\s+22(?:nd)?\s+(?:st|street)\b/i.test(key);
  });
}

export const CAMELOT_279_CPW_MANAGEMENT_TO_VERIFY = CPW_279_MANAGEMENT_TO_VERIFY;
export const CAMELOT_279_CPW_UNIT_COUNT = CPW_279_UNIT_COUNT;

export function is279CentralParkWestSubject(...values: Array<string | null | undefined>): boolean {
  return is279CentralParkWestValue(...values);
}

export const CAMELOT_36_EAST_22_MANAGEMENT_TO_VERIFY = EAST_36_22_MANAGEMENT_TO_VERIFY;
export const CAMELOT_36_EAST_22_UNIT_COUNT = EAST_36_22_UNIT_COUNT;

export function is36East22ndStreetSubject(...values: Array<string | null | undefined>): boolean {
  return is36East22ndStreetValue(...values);
}

export function normalize36East22ndStreetReportData<T extends Partial<MasterReportData>>(data: T): T {
  if (!is36East22ndStreetSubject(
    data.address,
    data.buildingName,
    data.managementCompany,
    data.registrationOwner,
    data.dofOwner,
  )) {
    return data;
  }

  return {
    ...data,
    address: EAST_36_22_ADDRESS,
    buildingName: EAST_36_22_NAME,
    borough: 'Manhattan',
    neighborhoodName: 'Flatiron / Madison Square',
    units: CAMELOT_36_EAST_22_UNIT_COUNT,
    stories: data.stories && data.stories > 0 && data.stories < 20 ? data.stories : 9,
    yearBuilt: data.yearBuilt || 1901,
    propertyType: 'Pre-war Elevator Condominium',
    managementCompany: CAMELOT_36_EAST_22_MANAGEMENT_TO_VERIFY,
    buildingPhotos: {
      ...(data.buildingPhotos || {}),
      exterior: dedupeText([
        '/images/36-east-22nd/story-house-exterior.jpg',
        ...(data.buildingPhotos?.exterior || []),
      ]),
      interior: data.buildingPhotos?.interior || [],
      streetView: data.buildingPhotos?.streetView || '',
      satellite: data.buildingPhotos?.satellite || '',
      source: 'Compass public building profile for The Story House / 36 East 22nd Street',
    },
    professionalResearchSources: [
      ...(data.professionalResearchSources || []),
      'Known-property guard: 36 East 22nd Street is treated as The Story House, a Flatiron pre-war elevator condominium. Reconcile current management and board contacts against HPD MDR, ACRIS, PropertyShark, and board materials before final release.',
    ],
  } as T;
}

export function normalize279CentralParkWestReportData<T extends Partial<MasterReportData>>(data: T): T {
  if (!is279CentralParkWestSubject(
    data.address,
    data.buildingName,
    data.managementCompany,
    data.registrationOwner,
    data.dofOwner,
  )) {
    return data;
  }

  return {
    ...data,
    address: CPW_279_ADDRESS,
    buildingName: CPW_279_NAME,
    borough: 'Manhattan',
    neighborhoodName: 'Upper West Side / Central Park West',
    units: CAMELOT_279_CPW_UNIT_COUNT,
    stories: data.stories && data.stories > 0 && data.stories < 40 ? data.stories : 23,
    yearBuilt: data.yearBuilt || 1988,
    propertyType: 'Condominium',
    managementCompany: CAMELOT_279_CPW_MANAGEMENT_TO_VERIFY,
    buildingPhotos: {
      ...(data.buildingPhotos || {}),
      exterior: dedupeText([
        '/images/279-central-park-west/279-cpw-corner-shot.jpg',
        '/images/279-central-park-west/279-cpw-awning.jpg',
        '/images/279-central-park-west/279-cpw-top-of-building.jpg',
        '/images/279-central-park-west/279-central-park-west.jpg',
        ...(data.buildingPhotos?.exterior || []),
      ]),
      interior: data.buildingPhotos?.interior || [],
      streetView: data.buildingPhotos?.streetView || '',
      satellite: data.buildingPhotos?.satellite || '',
      source: 'User-supplied 279 Central Park West building photographs',
    },
    professionalResearchSources: [
      ...(data.professionalResearchSources || []),
      'Unit count and current management should be confirmed against the offering plan, board materials, HPD MDR, ACRIS, PropertyShark, and DOB/DOF records before final board-facing release.',
      'Do not publish any current managing agent for 279 Central Park West until primary records or board materials confirm the relationship.',
    ],
  } as T;
}

function removeStale279ManagementReferences(items: string[]): string[] {
  const staleManagerPattern = new RegExp(['H', 'al', 'ste', 'ad'].join(''), 'i');
  return items.filter(item => !staleManagerPattern.test(String(item || '')));
}

function dedupeText(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const value = String(item || '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function getLpcLandmarkFallbackLabels(address: string, neighborhoodName = '', knownFacts?: KnownPropertyFacts | null): string[] {
  const key = `${address} ${neighborhoodName} ${knownFacts?.buildingName || ''}`.toLowerCase();
  if (knownFacts?.landmarks?.length) return knownFacts.landmarks;

  if (/1280\s+(fifth|5th)|one\s+museum\s+mile|museum\s+mile|east\s+harlem/i.test(key)) {
    return [
      'Central Park / Harlem Meer: scenic landmark across street',
      'Conservatory Garden: LPC scenic landmark area nearby',
      'El Museo del Barrio: Museum Mile cultural anchor',
      'Museum of the City of New York: Museum Mile landmark corridor',
      'Guggenheim Museum: LPC individual landmark on Museum Mile',
      'Cooper Hewitt / Carnegie Mansion: LPC individual landmark nearby',
    ];
  }

  if (/201\s+e(ast)?\s+79|upper\s+east\s+side|yorkville/i.test(key)) {
    return [
      'Upper East Side Historic District: LPC district context west of Third Avenue',
      'Central Park: LPC scenic landmark nearby',
      'Metropolitan Museum of Art: Museum Mile anchor nearby',
      'Park Avenue Armory: LPC individual landmark nearby',
      'Church of St. Jean Baptiste: LPC individual landmark nearby',
      'Bohemian National Hall: LPC individual landmark / cultural anchor nearby',
    ];
  }

  if (/corinthian|330\s+e(ast)?\s+38|murray\s+hill|midtown\s+east/i.test(key)) {
    return [
      'Tudor City Historic District: LPC district context nearby',
      'Daily News Building: LPC individual landmark nearby',
      'Ford Foundation Building: LPC individual / interior landmark nearby',
      'Grand Central Terminal: LPC individual / interior landmark nearby',
      'Chrysler Building: LPC individual landmark nearby',
      'United Nations / Midtown East civic corridor: nearby anchor',
    ];
  }

  if (/chesapeake|201\s+e(ast)?\s+28|kips\s+bay|rose\s+hill|gramercy/i.test(key)) {
    return [
      'Madison Square North Historic District: LPC district context nearby',
      'Gramercy Park Historic District: LPC district context nearby',
      'New York Life Building: LPC individual landmark nearby',
      'Metropolitan Life Clock Tower: LPC individual landmark nearby',
      'Appellate Division Courthouse: LPC individual landmark nearby',
      'Lexington Avenue / 28th Street transit and retail corridor: nearby anchor',
    ];
  }

  if (/manhattan|new york/i.test(key)) {
    return [
      'LPC Discover NYC Landmarks: verify nearby designated buildings and districts',
      'NYC landmark and historic district context: reviewed during Jackie source check',
      'Neighborhood civic, cultural, and transit anchors: verify by address before release',
      'Camelot HQ: 57 West 57th Street, Suite 410',
    ];
  }

  return [
    'Nearby landmarks: verify through LPC Discover NYC Landmarks',
    'Neighborhood anchors: reviewed during Camelot scope review',
    'Transit access: verified during onboarding',
    'Camelot HQ: 57 West 57th Street, Suite 410',
  ];
}

function resolveNearbyLandmarkLabels(d: Pick<MasterReportData, 'address' | 'buildingName' | 'neighborhoodName' | 'neighborhoodIntel' | 'neighborhoodSearchContext'>): string[] {
  const knownFacts = getKnownPropertyFacts(d.address, d.buildingName);
  const liveLabels = (d.neighborhoodIntel?.landmarks || [])
    .map(l => `${l.name}: ${l.type || 'LPC landmark'}${l.date ? ` (${l.date.slice(0, 4)})` : ''}`);
  const landmarkNeighborhoodContext = d.neighborhoodName || d.neighborhoodSearchContext?.neighborhoodName || d.neighborhoodSearchContext?.query || '';
  const fallbackLabels = getLpcLandmarkFallbackLabels(d.address, landmarkNeighborhoodContext, knownFacts);
  return dedupeText([...(knownFacts?.landmarks || []), ...liveLabels, ...fallbackLabels]).slice(0, 6);
}

function countAcrisLienClaimRecords(records: any[] = []): number {
  const lienPattern = /\b(lien|claim|judg|judgment|notice|ucc|lis pendens|foreclos|mechanic|tax)\b/i;
  return records.filter((record: any) => {
    const values = [
      record.document_type,
      record.doc_type,
      record.documenttype,
      record.record_type,
      record.doctype,
      record.description,
      record.document_description,
    ];
    return lienPattern.test(values.map(v => String(v || '')).join(' '));
  }).length;
}

function buildComplianceSourceChecks(input: {
  raw: any;
  violationSummary: ViolationSummary | null;
  complaint311Count: number;
  acrisLienClaimCount: number;
  units: number;
}): { checks: ComplianceSourceCheck[]; status: 'verified' | 'needs_review' | 'blocked' } {
  const hpdTotal = input.raw.violations?.total || 0;
  const dobOpen = input.violationSummary?.dobOpen || 0;
  const ecbCount = Math.max(input.raw.ecb?.count || 0, input.violationSummary?.ecbOpen || 0);
  const facadeCount = input.raw.facade?.count || 0;
  const facadeIssueCount = input.raw.facade?.issueCount || 0;
  const litigationCount = input.raw.litigation?.count || 0;
  const dhcrCount = input.raw.rentStabilization?.data?.length || 0;
  const taxLienCount = input.raw.taxLiens?.recordCount || 0;
  const acrisCount = input.acrisLienClaimCount;
  const sourceChecks: ComplianceSourceCheck[] = [
    {
      source: 'HPD Online / NYC Open Data',
      status: hpdTotal > 0 ? 'loaded' : 'searched',
      count: hpdTotal,
      detail: hpdTotal > 0
        ? `${hpdTotal} HPD violation row(s) loaded; ${input.raw.violations?.open || 0} open.`
        : 'No HPD rows returned by the automated address/BBL query; verify HPD Online manually before board-facing release.',
      url: 'https://hpdonline.nyc.gov/hpdonline/',
    },
    {
      source: 'DOB BIS & DOB NOW',
      status: dobOpen > 0 || (input.raw.permits?.count || 0) > 0 || facadeCount > 0 ? 'loaded' : 'searched',
      count: dobOpen + (input.raw.permits?.count || 0) + facadeCount,
      detail: dobOpen > 0
        ? `${dobOpen} open DOB violation signal(s), ${input.raw.permits?.count || 0} permit row(s), and ${facadeCount} DOB NOW/FISP facade filing row(s) loaded.`
        : `DOB violation query returned no open rows; permit scan returned ${input.raw.permits?.count || 0} filing row(s); DOB NOW/FISP facade scan returned ${facadeCount} row(s). Verify BIS Property Profile and DOB NOW manually.`,
      url: 'https://www.nyc.gov/site/buildings/dob/find-building-data.page',
    },
    {
      source: 'DOB NOW Safety / FISP facade filings',
      status: facadeCount > 0 ? 'loaded' : 'searched',
      count: facadeCount,
      detail: facadeCount > 0
        ? `${facadeCount} facade filing row(s) loaded; ${facadeIssueCount} potential unsafe/SWARMP/no-report/late signal(s). Latest status: ${input.raw.facade?.latestStatus || 'not shown'}.`
        : 'No DOB NOW Safety facade rows returned by address/BBL query; verify DOB NOW Public Portal for FISP/LL11 cycle status.',
      url: 'https://data.cityofnewyork.us/api/views/xubg-57si',
    },
    {
      source: 'ECB/OATH',
      status: ecbCount > 0 ? 'loaded' : 'searched',
      count: ecbCount,
      detail: ecbCount > 0
        ? `${ecbCount} ECB/OATH record(s); penalty balance $${(input.raw.ecb?.totalPenaltyBalance || 0).toLocaleString()}.`
        : 'No ECB/OATH rows returned by automated query; verify OATH/ECB and DOB BIS manually.',
      url: 'https://data.cityofnewyork.us/Housing-Development/DOB-ECB-Violations/6bgk-3dad',
    },
    {
      source: 'DOF tax liens / PROS',
      status: taxLienCount > 0 || input.raw.taxLiens?.sourceStatus ? 'loaded' : 'manual_required',
      count: taxLienCount,
      detail: input.raw.taxLiens?.sourceStatus || 'DOF tax lien source did not return status; run PROS/property-tax search.',
      url: 'https://a806-pros.nyc.gov/PROS/',
    },
    {
      source: 'ACRIS liens, claims, UCCs, judgments',
      status: (input.raw.acris?.records?.length || 0) > 0 ? 'loaded' : 'searched',
      count: acrisCount,
      detail: acrisCount > 0
        ? `${acrisCount} ACRIS document(s) matched lien/claim/judgment keywords.`
        : 'ACRIS loaded/searched, but no lien/claim keyword rows were detected in the current parent-lot record set.',
      url: 'https://a836-acris.nyc.gov/CP/',
    },
    {
      source: 'HPD housing litigation',
      status: litigationCount > 0 ? 'loaded' : 'searched',
      count: litigationCount,
      detail: litigationCount > 0
        ? `${litigationCount} HPD litigation case row(s) loaded.`
        : 'No HPD housing-litigation rows returned by automated address query; verify HPD Online litigation tab.',
      url: 'https://hpdonline.nyc.gov/hpdonline/',
    },
    {
      source: 'DHCR / rent stabilization',
      status: dhcrCount > 0 ? 'loaded' : 'searched',
      count: dhcrCount,
      detail: dhcrCount > 0
        ? `${dhcrCount} rent-stabilization row(s) loaded.`
        : 'No DHCR/rent-stabilization proxy rows returned; verify DHCR status where applicable.',
      url: 'https://hcr.ny.gov/records-access',
    },
    {
      source: '311 Service Requests',
      status: input.complaint311Count > 0 ? 'loaded' : 'searched',
      count: input.complaint311Count,
      detail: input.complaint311Count > 0
        ? `${input.complaint311Count} 311 service request signal(s) loaded for the property/neighborhood review.`
        : 'No address-level 311 rows returned; verify 311/service request history where building conditions are material.',
      url: 'https://portal.311.nyc.gov/',
    },
    {
      source: 'NYS eCourts / WebCivil index',
      status: 'manual_required',
      count: 0,
      detail: 'Search owner entity, board/corporation name, building name, and address for lawsuits, foreclosure, premises-liability, contract, HP, and lien-related cases.',
      url: 'https://iapps.courts.state.ny.us/webcivil/FCASMain',
    },
    {
      source: 'LexisNexis legal and claims enrichment',
      status: 'manual_required',
      count: 0,
      detail: 'Credentialed source for lawsuits, judgments, claims, parties, affiliated entities, and adverse media; Jackie must not imply this paid source was queried unless credentials were used.',
      url: 'https://www.lexisnexis.com/en-us/gateway.page',
    },
  ];

  const automatedRiskRows = hpdTotal + dobOpen + ecbCount + litigationCount + taxLienCount + acrisCount + input.complaint311Count + facadeCount + (input.raw.permits?.count || 0);
  const hasCorePublicSources = sourceChecks.slice(0, 9).every(check => check.status === 'loaded' || check.status === 'searched');
  const suspiciousAllZero = input.units >= 10 && automatedRiskRows === 0;
  const status = !hasCorePublicSources || suspiciousAllZero ? 'blocked' : sourceChecks.some(check => check.status === 'manual_required') ? 'needs_review' : 'verified';
  return { checks: sourceChecks, status };
}

export interface NeighborhoodMarketData {
  condoPSF: number; coopPSF: number; rentalPSFYr: number;
  median1BR: number; median2BR: number; daysOnMarket: number;
  investScore: number; liveScore: number; familyScore: number; workScore: number;
  momentum: string; opexRange: string;
}

const NEIGHBORHOOD_MARKET_DATA: Record<string, NeighborhoodMarketData> = {
  'east harlem': { condoPSF: 980, coopPSF: 650, rentalPSFYr: 54, median1BR: 3150, median2BR: 4300, daysOnMarket: 16, investScore: 8.0, liveScore: 7.7, familyScore: 7.2, workScore: 7.8, momentum: 'Strong', opexRange: '$20-34/sqft/yr' },
  'museum mile': { condoPSF: 1425, coopPSF: 980, rentalPSFYr: 72, median1BR: 3900, median2BR: 5900, daysOnMarket: 14, investScore: 7.4, liveScore: 8.6, familyScore: 8.8, workScore: 8.2, momentum: 'Stable', opexRange: '$28-45/sqft/yr' },
  'museum mile / upper fifth avenue': { condoPSF: 1425, coopPSF: 980, rentalPSFYr: 72, median1BR: 3900, median2BR: 5900, daysOnMarket: 14, investScore: 7.4, liveScore: 8.6, familyScore: 8.8, workScore: 8.2, momentum: 'Stable', opexRange: '$28-45/sqft/yr' },
  'harlem': { condoPSF: 892, coopPSF: 610, rentalPSFYr: 50, median1BR: 2950, median2BR: 3800, daysOnMarket: 18, investScore: 8.2, liveScore: 7.4, familyScore: 6.8, workScore: 7.6, momentum: 'Strong', opexRange: '$19–32/sqft/yr' },
  'manhattan valley': { condoPSF: 892, coopPSF: 610, rentalPSFYr: 50, median1BR: 2950, median2BR: 3800, daysOnMarket: 18, investScore: 8.2, liveScore: 7.4, familyScore: 6.8, workScore: 7.6, momentum: 'Strong', opexRange: '$19–32/sqft/yr' },
  'murray hill': { condoPSF: 1380, coopPSF: 980, rentalPSFYr: 75, median1BR: 4200, median2BR: 6100, daysOnMarket: 12, investScore: 7.8, liveScore: 8.2, familyScore: 7.0, workScore: 9.1, momentum: 'Moderate', opexRange: '$27–42/sqft/yr' },
  'nomad': { condoPSF: 1380, coopPSF: 980, rentalPSFYr: 75, median1BR: 4200, median2BR: 6100, daysOnMarket: 12, investScore: 7.8, liveScore: 8.2, familyScore: 7.0, workScore: 9.1, momentum: 'Moderate', opexRange: '$27–42/sqft/yr' },
  'stuyvesant': { condoPSF: 1250, coopPSF: 1050, rentalPSFYr: 65, median1BR: 3800, median2BR: 5600, daysOnMarket: 14, investScore: 7.6, liveScore: 8.4, familyScore: 7.5, workScore: 8.8, momentum: 'Moderate', opexRange: '$24–38/sqft/yr' },
  'gramercy': { condoPSF: 1250, coopPSF: 1050, rentalPSFYr: 65, median1BR: 3800, median2BR: 5600, daysOnMarket: 14, investScore: 7.6, liveScore: 8.4, familyScore: 7.5, workScore: 8.8, momentum: 'Moderate', opexRange: '$24–38/sqft/yr' },
  'hells kitchen': { condoPSF: 1180, coopPSF: 880, rentalPSFYr: 68, median1BR: 3600, median2BR: 5200, daysOnMarket: 16, investScore: 7.5, liveScore: 7.8, familyScore: 6.2, workScore: 9.0, momentum: 'Stable', opexRange: '$21–36/sqft/yr' },
  "hell's kitchen": { condoPSF: 1180, coopPSF: 880, rentalPSFYr: 68, median1BR: 3600, median2BR: 5200, daysOnMarket: 16, investScore: 7.5, liveScore: 7.8, familyScore: 6.2, workScore: 9.0, momentum: 'Stable', opexRange: '$21–36/sqft/yr' },
  'washington heights': { condoPSF: 560, coopPSF: 440, rentalPSFYr: 37, median1BR: 2100, median2BR: 2850, daysOnMarket: 22, investScore: 8.6, liveScore: 7.2, familyScore: 7.8, workScore: 6.4, momentum: 'Very Strong', opexRange: '$15–27/sqft/yr' },
  'inwood': { condoPSF: 560, coopPSF: 440, rentalPSFYr: 37, median1BR: 2100, median2BR: 2850, daysOnMarket: 22, investScore: 8.6, liveScore: 7.2, familyScore: 7.8, workScore: 6.4, momentum: 'Very Strong', opexRange: '$15–27/sqft/yr' },
  'sunnyside': { condoPSF: 660, coopPSF: 430, rentalPSFYr: 41, median1BR: 2400, median2BR: 3100, daysOnMarket: 15, investScore: 8.8, liveScore: 7.6, familyScore: 8.2, workScore: 7.2, momentum: 'Very Strong', opexRange: '$13–24/sqft/yr' },
  'woodside': { condoPSF: 660, coopPSF: 430, rentalPSFYr: 41, median1BR: 2400, median2BR: 3100, daysOnMarket: 15, investScore: 8.8, liveScore: 7.6, familyScore: 8.2, workScore: 7.2, momentum: 'Very Strong', opexRange: '$13–24/sqft/yr' },
  'jackson heights': { condoPSF: 650, coopPSF: 430, rentalPSFYr: 41, median1BR: 2350, median2BR: 3150, daysOnMarket: 16, investScore: 8.2, liveScore: 8.4, familyScore: 8.5, workScore: 7.4, momentum: 'Stable / Strong', opexRange: '$14-26/sqft/yr' },
  'greenpoint': { condoPSF: 1020, coopPSF: 720, rentalPSFYr: 55, median1BR: 3200, median2BR: 4400, daysOnMarket: 13, investScore: 8.4, liveScore: 8.6, familyScore: 7.9, workScore: 7.4, momentum: 'Strong', opexRange: '$17–28/sqft/yr' },
  'long island city': { condoPSF: 1090, coopPSF: 680, rentalPSFYr: 57, median1BR: 3450, median2BR: 4700, daysOnMarket: 11, investScore: 8.7, liveScore: 8.0, familyScore: 7.2, workScore: 8.8, momentum: 'Very Strong', opexRange: '$15–27/sqft/yr' },
  'lic': { condoPSF: 1090, coopPSF: 680, rentalPSFYr: 57, median1BR: 3450, median2BR: 4700, daysOnMarket: 11, investScore: 8.7, liveScore: 8.0, familyScore: 7.2, workScore: 8.8, momentum: 'Very Strong', opexRange: '$15–27/sqft/yr' },
  'upper east side': { condoPSF: 1620, coopPSF: 1140, rentalPSFYr: 82, median1BR: 4600, median2BR: 7200, daysOnMarket: 14, investScore: 6.8, liveScore: 8.8, familyScore: 9.2, workScore: 8.4, momentum: 'Stable', opexRange: '$30–50/sqft/yr' },
  'tribeca': { condoPSF: 2100, coopPSF: 1480, rentalPSFYr: 98, median1BR: 5200, median2BR: 8400, daysOnMarket: 10, investScore: 6.4, liveScore: 9.2, familyScore: 8.4, workScore: 8.6, momentum: 'Stable', opexRange: '$33–56/sqft/yr' },
  'soho': { condoPSF: 2100, coopPSF: 1480, rentalPSFYr: 98, median1BR: 5200, median2BR: 8400, daysOnMarket: 10, investScore: 6.4, liveScore: 9.2, familyScore: 8.4, workScore: 8.6, momentum: 'Stable', opexRange: '$33–56/sqft/yr' },
  'brooklyn heights': { condoPSF: 1280, coopPSF: 980, rentalPSFYr: 62, median1BR: 3600, median2BR: 5100, daysOnMarket: 12, investScore: 7.2, liveScore: 9.0, familyScore: 8.8, workScore: 8.2, momentum: 'Stable', opexRange: '$20–34/sqft/yr' },
  'park slope': { condoPSF: 1150, coopPSF: 820, rentalPSFYr: 53, median1BR: 3100, median2BR: 4600, daysOnMarket: 14, investScore: 7.4, liveScore: 9.1, familyScore: 9.4, workScore: 7.8, momentum: 'Moderate', opexRange: '$18–30/sqft/yr' },
  'east village': { condoPSF: 1350, coopPSF: 950, rentalPSFYr: 70, median1BR: 3500, median2BR: 5000, daysOnMarket: 11, investScore: 7.0, liveScore: 8.8, familyScore: 6.5, workScore: 8.5, momentum: 'Moderate', opexRange: '$24–38/sqft/yr' },
  'lower east side': { condoPSF: 1200, coopPSF: 850, rentalPSFYr: 65, median1BR: 3400, median2BR: 4800, daysOnMarket: 13, investScore: 7.5, liveScore: 8.5, familyScore: 6.0, workScore: 8.2, momentum: 'Strong', opexRange: '$22–36/sqft/yr' },
  'chelsea': { condoPSF: 1500, coopPSF: 1100, rentalPSFYr: 78, median1BR: 4100, median2BR: 6000, daysOnMarket: 12, investScore: 7.2, liveScore: 8.6, familyScore: 6.8, workScore: 9.0, momentum: 'Moderate', opexRange: '$27–42/sqft/yr' },
  'west village': { condoPSF: 1800, coopPSF: 1300, rentalPSFYr: 90, median1BR: 4800, median2BR: 7500, daysOnMarket: 11, investScore: 6.5, liveScore: 9.3, familyScore: 7.0, workScore: 8.4, momentum: 'Stable', opexRange: '$30–48/sqft/yr' },
  'astoria': { condoPSF: 700, coopPSF: 480, rentalPSFYr: 44, median1BR: 2500, median2BR: 3300, daysOnMarket: 14, investScore: 8.5, liveScore: 8.0, familyScore: 8.0, workScore: 7.5, momentum: 'Strong', opexRange: '$14–26/sqft/yr' },
  'midtown': { condoPSF: 1600, coopPSF: 1100, rentalPSFYr: 80, median1BR: 4400, median2BR: 6800, daysOnMarket: 13, investScore: 7.0, liveScore: 7.5, familyScore: 5.5, workScore: 9.5, momentum: 'Stable', opexRange: '$28–45/sqft/yr' },
  'upper west side': { condoPSF: 1500, coopPSF: 1050, rentalPSFYr: 75, median1BR: 4300, median2BR: 6500, daysOnMarket: 13, investScore: 7.0, liveScore: 8.9, familyScore: 9.0, workScore: 8.0, momentum: 'Stable', opexRange: '$28–44/sqft/yr' },
  'financial district': { condoPSF: 1400, coopPSF: 1000, rentalPSFYr: 72, median1BR: 4000, median2BR: 5800, daysOnMarket: 12, investScore: 7.3, liveScore: 7.8, familyScore: 6.0, workScore: 9.2, momentum: 'Moderate', opexRange: '$26–42/sqft/yr' },
  'fidi': { condoPSF: 1400, coopPSF: 1000, rentalPSFYr: 72, median1BR: 4000, median2BR: 5800, daysOnMarket: 12, investScore: 7.3, liveScore: 7.8, familyScore: 6.0, workScore: 9.2, momentum: 'Moderate', opexRange: '$26–42/sqft/yr' },
  'bushwick': { condoPSF: 580, coopPSF: 400, rentalPSFYr: 38, median1BR: 2200, median2BR: 2900, daysOnMarket: 16, investScore: 8.8, liveScore: 7.5, familyScore: 7.0, workScore: 7.0, momentum: 'Very Strong', opexRange: '$12–22/sqft/yr' },
  'bed-stuy': { condoPSF: 650, coopPSF: 450, rentalPSFYr: 42, median1BR: 2400, median2BR: 3200, daysOnMarket: 15, investScore: 8.6, liveScore: 7.8, familyScore: 7.5, workScore: 7.2, momentum: 'Strong', opexRange: '$14–25/sqft/yr' },
  'bedford-stuyvesant': { condoPSF: 650, coopPSF: 450, rentalPSFYr: 42, median1BR: 2400, median2BR: 3200, daysOnMarket: 15, investScore: 8.6, liveScore: 7.8, familyScore: 7.5, workScore: 7.2, momentum: 'Strong', opexRange: '$14–25/sqft/yr' },
  'williamsburg': { condoPSF: 1100, coopPSF: 780, rentalPSFYr: 60, median1BR: 3400, median2BR: 4800, daysOnMarket: 12, investScore: 7.8, liveScore: 8.8, familyScore: 7.2, workScore: 7.8, momentum: 'Moderate', opexRange: '$20–34/sqft/yr' },
  'bronx': { condoPSF: 420, coopPSF: 320, rentalPSFYr: 30, median1BR: 1800, median2BR: 2400, daysOnMarket: 20, investScore: 8.5, liveScore: 6.8, familyScore: 7.0, workScore: 6.5, momentum: 'Strong', opexRange: '$12–22/sqft/yr' },
  'jersey city': { condoPSF: 750, coopPSF: 500, rentalPSFYr: 48, median1BR: 2800, median2BR: 3600, daysOnMarket: 14, investScore: 8.5, liveScore: 8.2, familyScore: 7.8, workScore: 8.5, momentum: 'Strong', opexRange: '$14–26/sqft/yr' },
  'hoboken': { condoPSF: 850, coopPSF: 600, rentalPSFYr: 52, median1BR: 3000, median2BR: 4000, daysOnMarket: 12, investScore: 8.0, liveScore: 8.5, familyScore: 8.2, workScore: 8.3, momentum: 'Moderate', opexRange: '$16–28/sqft/yr' },
};

// ============================================================
// Market Fee Comparison Data
// ============================================================

export interface MarketFeeComparison {
  marketRangeLow: number;   // per unit per year
  marketRangeHigh: number;
  camelotAnnualPerUnit: number;
  camelotMonthlyPerUnit: number;
  minimumMonthlyFee: number;
  minimumFeeLabel: string;
  floorApplied: boolean;
  savings: string;          // e.g. "15-30% below market"
  tier: 'manhattan-luxury' | 'manhattan-standard' | 'outer-borough' | 'suburban';
  tierLabel: string;
  ancillaryFeesIncluded: string[];
  ancillaryComparison: Array<{ service: string; marketRate: string; camelotRate: string }>;
}

const MANHATTAN_MONTHLY_MINIMUM_FEE = 1500;
const MANHATTAN_PREFERRED_MINIMUM_FEE = 2000;
const OUTER_BOROUGH_MONTHLY_MINIMUM_FEE = 1200;
const OUTER_BOROUGH_PREFERRED_MINIMUM_FEE = 1500;

function getCamelotMinimumFeeRule(borough: string): { minimum: number; preferred: number; label: string } {
  const bor = (borough || '').toLowerCase();
  if (bor.includes('manhattan') || bor.includes('new york')) {
    return {
      minimum: MANHATTAN_MONTHLY_MINIMUM_FEE,
      preferred: MANHATTAN_PREFERRED_MINIMUM_FEE,
      label: '$1,500-$2,000/month Manhattan minimum',
    };
  }
  if (bor.includes('brooklyn') || bor.includes('queens') || bor.includes('bronx') || bor.includes('staten')) {
    return {
      minimum: OUTER_BOROUGH_MONTHLY_MINIMUM_FEE,
      preferred: OUTER_BOROUGH_PREFERRED_MINIMUM_FEE,
      label: '$1,200-$1,500/month outer-borough minimum',
    };
  }
  return {
    minimum: OUTER_BOROUGH_MONTHLY_MINIMUM_FEE,
    preferred: OUTER_BOROUGH_PREFERRED_MINIMUM_FEE,
    label: '$1,200-$1,500/month minimum',
  };

}

function roundToNearestFive(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}

function calculateMarketFeeComparison(
  d: { units: number; borough: string; propertyType: string; buildingClass: string; isRentStabilized: boolean; ll97Status: string; pricePerUnit: number }
): MarketFeeComparison {
  const bor = (d.borough || '').toLowerCase();
  const isManh = bor.includes('manhattan');
  const isOuter = bor.includes('brooklyn') || bor.includes('queens') || bor.includes('bronx') || bor.includes('staten');
  const isSuburban = bor.includes('westchester') || bor.includes('connecticut') || bor.includes('jersey') || bor.includes('long island') || bor.includes('hamptons');
  const isElevator = (d.buildingClass || '').toUpperCase().startsWith('D');
  const isLuxury = isManh && isElevator && d.units >= 50;

  let tier: MarketFeeComparison['tier'];
  let tierLabel: string;
  let marketLow: number;
  let marketHigh: number;

  if (isLuxury) {
    tier = 'manhattan-luxury';
    tierLabel = 'Manhattan Full-Service / Luxury';
    marketLow = 800;
    marketHigh = 1200;
  } else if (isManh) {
    tier = 'manhattan-standard';
    tierLabel = 'Manhattan Standard / Walk-Up';
    marketLow = 600;
    marketHigh = 900;
  } else if (isSuburban) {
    tier = 'suburban';
    tierLabel = 'Suburban NYC (Westchester / NJ / CT)';
    marketLow = 350;
    marketHigh = 600;
  } else {
    tier = 'outer-borough';
    tierLabel = 'Outer Boroughs (Brooklyn, Queens, Bronx)';
    marketLow = 450;
    marketHigh = 800;
  }

  // For small buildings, large firms impose minimums — effective per-unit cost is higher
  if (d.units < 50) {
    // Large firms often charge $50K+ minimum annual — that's $1,000+/unit for a 50-unit building
    marketLow = Math.max(marketLow, 600);
    marketHigh = Math.max(marketHigh, 1000);
  }

  const midMarket = (marketLow + marketHigh) / 2;
  const camelotAnnual = roundToNearestFive(midMarket * 0.85);
  const camelotMonthly = Math.round(camelotAnnual / 12);
  const savingsPct = Math.round(((midMarket - camelotAnnual) / midMarket) * 100);
  const savings = `${savingsPct}% below market average`;
  const minimumFeeRule = getCamelotMinimumFeeRule(d.borough);
  const calculatedMonthlyFee = camelotMonthly * Math.max(d.units || 1, 1);

  return {
    marketRangeLow: marketLow,
    marketRangeHigh: marketHigh,
    camelotAnnualPerUnit: camelotAnnual,
    camelotMonthlyPerUnit: camelotMonthly,
    minimumMonthlyFee: minimumFeeRule.minimum,
    minimumFeeLabel: minimumFeeRule.label,
    floorApplied: calculatedMonthlyFee < minimumFeeRule.minimum,
    savings,
    tier,
    tierLabel,
    ancillaryFeesIncluded: [
      'In-house CPA advisory and monthly reporting coordination',
      'Compliance summary review and LL97 / local-law monitoring where applicable',
      'Camelot Intelligence technology package (ConciergePlus + Merlin AI)',
      'Board meeting minutes provided by Camelot AI',
      'BankUnited online banking services with zero bank fees',
      'Initial building inspection at a one-time $500 introductory fee ($2,500 value)',
      'Attorney advisory only; formal legal engagement is separately scoped',
      'Licensed engineer advisory only; engineering engagement is separately scoped',
      'Weekly on-site inspections',
      '24/7 emergency response line',
      'Schedule A ancillary-fee menu tailored by property type and final scope',
    ],
    ancillaryComparison: [
      { service: 'Onboarding / Setup', marketRate: '$250-$500', camelotRate: 'Included' },
      { service: 'Lease Renewals', marketRate: '$250-$500/lease', camelotRate: '$350 per lease' },
      { service: 'Building Inspection', marketRate: '$1,500-$3,500', camelotRate: '$500 one-time introductory inspection ($2,500 value)' },
      { service: 'In-House CPA / Accounting Advisory Services', marketRate: '$5,000-$15,000/yr', camelotRate: 'Advisory and reporting coordination included; tax returns and deeper accounting work separately scoped' },
      { service: 'Tax Returns for Client Entity', marketRate: 'Industry standard by property size/location', camelotRate: '20% less than industry standard' },
      { service: 'LL97 / Local Law Summary', marketRate: '$3,000-$8,000', camelotRate: 'Initial summary and modeling included when applicable; filings, remediation, budgets, and project work separately scoped' },
      { service: 'Technology Platform', marketRate: '$3-$8/unit/month', camelotRate: 'Priced as part of the Camelot Intelligence package, not treated as a separate line-item discount' },
      { service: 'Online Banking Services', marketRate: 'Monthly treasury, lockbox, and transaction fees vary by bank', camelotRate: 'BankUnited preferred banking workflow with zero bank fees for residents, owners, and management company' },
      { service: 'Board Meeting Minutes (Provided by Camelot AI)', marketRate: '$150-$500/meeting', camelotRate: 'Included; after 8 PM, $150 flat fee may apply' },
      { service: 'Project Management Fee (under $25K / 30+ unit buildings)', marketRate: '5%-15% of project cost', camelotRate: 'Limited coordination may be included; active project management is separately scoped' },
      { service: 'Project Management Fee (major projects)', marketRate: '7%-10% of project cost', camelotRate: '7%-10%, flat fee, or $150/hr by separate agreement' },
      { service: 'Annual Board Meetings, Emergency Meetings, Town Halls', marketRate: '$150-$500/meeting plus admin', camelotRate: 'Billed by rate and hours incurred for setup, notices, proxies, sign-in sheets, Zoom, and board-directed administration' },
      { service: 'Sales Package Review', marketRate: '$300-$750', camelotRate: '$250-$500' },
      { service: 'Closings', marketRate: '$1,500-$2,500', camelotRate: '$1,500' },
      { service: 'Review of Alteration Agreements', marketRate: '$750-$1,500', camelotRate: '$500-$1,000' },
      { service: 'Legal Advisory Services', marketRate: '$350-$750/hr', camelotRate: 'Advisory only; attorney engagement separately scoped and approved' },
      { service: 'Sale/Transfer Processing', marketRate: '~$500 (buyer pays)', camelotRate: '$250-$500 sales package review; closing fees separate' },
      { service: 'Move-In/Move-Out Fee', marketRate: '~$500 each', camelotRate: '~$500 each' },
      { service: 'Sublet Application', marketRate: '$100-$250', camelotRate: '$100-$250' },
      { service: 'Late Payment Enforcement', marketRate: 'Up to $50 or 5%', camelotRate: 'Per building policy' },
      { service: 'Schedule A Ancillary Fees', marketRate: 'Varies by property type and scope', camelotRate: 'Issued with final agreement for co-op, condo, rental, HOA, or receiver-managed property' },
    ],
  };

}

// ============================================================
// ============================================================
// Three-Tier Pricing Calculator
// ============================================================

export interface TieredPricing {
  classic: { perUnit: number; monthly: number; annual: number };
  intelligence: { perUnit: number; monthly: number; annual: number };
  premier: { perUnit: number; monthly: number; annual: number };
  recommended: 'classic' | 'intelligence' | 'premier';
  units: number;
}

function calculateTieredPricing(units: number, borough: string, isRentStabilized: boolean, ll97Status: string, buildingClass?: string, marketValue?: number, address?: string): TieredPricing {
  // Determine building tier based on building class, market value, and address
  // NYC Building Classes: D0-D9 = Elevator apartments, C0-C9 = Walkup, R = Condos
  // Luxury indicators: high market value per unit, doorman buildings, prime addresses
  const cls = (buildingClass || '').toUpperCase();
  const addr = (address || '').toUpperCase();
  const bor = (borough || '').toLowerCase();
  const valuePerUnit = (marketValue && units) ? marketValue / units : 0;
  
  // Detect luxury/premium buildings
  const isElevator = cls.startsWith('D') || cls.startsWith('R');
  const isLuxuryAddress = addr.includes('FIFTH') || addr.includes('5TH') || addr.includes('5 AVENUE') ||
    addr.includes('PARK AVENUE') || addr.includes('PARK AVE') || addr.includes('CENTRAL PARK') ||
    addr.includes('MADISON AVENUE') || addr.includes('MADISON AVE') ||
    addr.includes('LEXINGTON') || addr.includes('BROADWAY') ||
    /\b(SUTTON|BEEKMAN|GRAMERCY|TRIBECA|SOHO|NOHO|WEST VILLAGE|GREENWICH)\b/.test(addr);
  const isHighValue = valuePerUnit > 500000; // >$500K per unit = luxury
  const isLuxury = (isElevator && (isLuxuryAddress || isHighValue)) || valuePerUnit > 1000000;
  const isPremiumArea = bor.includes('manhattan') || isLuxuryAddress;
  
  // Classic tier — base rates by building size AND class
  let classicBase: number;
  if (isLuxury) {
    // Luxury buildings: doorman co-ops/condos on prime streets
    if (units < 30) classicBase = 95;
    else if (units <= 75) classicBase = 85;
    else if (units <= 150) classicBase = 75;
    else classicBase = 65;
  } else if (isPremiumArea) {
    // Manhattan non-luxury
    if (units < 30) classicBase = 70;
    else if (units <= 75) classicBase = 60;
    else if (units <= 150) classicBase = 52;
    else classicBase = 45;
  } else {
    // Outer boroughs and suburbs
    if (units < 30) classicBase = 55;
    else if (units <= 75) classicBase = 48;
    else if (units <= 150) classicBase = 42;
    else classicBase = 38;
  }

  // Intelligence tier — add 30-40% above Classic
  let intelBase = Math.round(classicBase * 1.35);

  // Premier tier — add 60-80% above Classic
  let premierBase = Math.round(classicBase * 1.7);

  // Rent stabilization adds complexity (DHCR, RGB, lease riders)
  if (isRentStabilized) {
    classicBase += 5;
    intelBase += 5;
    premierBase += 5;
  }

  // LL97 non-compliance adds monitoring
  if (ll97Status && ll97Status !== 'compliant' && ll97Status !== 'unknown') {
    intelBase += 3;
    premierBase += 3;
  }

  const u = units || 1;
  const minimumFeeRule = getCamelotMinimumFeeRule(borough);
  const classicMonthly = Math.max(classicBase * u, minimumFeeRule.minimum);
  const intelligenceMonthly = Math.max(intelBase * u, minimumFeeRule.preferred);
  const premierMonthly = Math.max(premierBase * u, minimumFeeRule.preferred + 500);
  return {
    classic: { perUnit: Math.round(classicMonthly / u), monthly: classicMonthly, annual: classicMonthly * 12 },
    intelligence: { perUnit: Math.round(intelligenceMonthly / u), monthly: intelligenceMonthly, annual: intelligenceMonthly * 12 },
    premier: { perUnit: Math.round(premierMonthly / u), monthly: premierMonthly, annual: premierMonthly * 12 },
    recommended: 'intelligence',
    units: u,
  };
}

// ============================================================
// Building Classification
// ============================================================

function classifyBuildingType(buildingClass: string): string {
  if (!buildingClass) return 'Residential';
  const cls = buildingClass.toUpperCase().trim();
  const first = cls.charAt(0);
  // R-class = Condominiums: R0 (common area), R1-R9 (units), RA (cultural), RM (mixed), RR (rental condo), etc.
  if (first === 'R') return 'Condominium';
  if (first === 'D') return 'Elevator Apartment';
  if (first === 'C') return 'Walk-Up Apartment';
  if (first === 'S') return 'Mixed-Use Residential';
  if (first === 'A') return 'One-Family Dwelling';
  if (first === 'B') return 'Two-Family Dwelling';
  if (first === 'H') return 'Hotel';
  if (first === 'O') return 'Office';
  if (first === 'K' || first === 'L') return 'Commercial / Retail';
  if (first === 'E' || first === 'F' || first === 'G') return 'Industrial / Warehouse';
  if (first === 'M') return 'Religious';
  if (first === 'N') return 'Asylum / Home';
  if (first === 'P') return 'Outdoor Recreation';
  if (first === 'Q') return 'Outdoor Recreation';
  if (first === 'W') return 'Educational';
  return 'Residential';
}

export function detectNeighborhood(address: string, borough: string): string {
  const addr = (address + ' ' + borough).toLowerCase();
  // Try to match known neighborhoods from address keywords
  const patterns: [string, RegExp][] = [
    ['harlem', /harlem|w\s*1[12][0-9]|e\s*1[12][0-9]|adam clayton|frederic/i],
    ['washington heights', /washington\s*h|w\s*1[4-9][0-9]|w\s*[12][0-9]{2}/i],
    ['murray hill', /murray|e\s*3[2-9]|park\s*ave.*3[2-9]/i],
    ['gramercy', /gramercy|irving|e\s*2[0-3]/i],
    ['stuyvesant', /stuyvesant|stuyves/i],
    ['chelsea', /chelsea|w\s*1[4-9]\s|w\s*2[0-6]/i],
    ['east village', /east\s*vill|e\s*[2-9]\s/i],
    ['west village', /west\s*vill|w\s*[4-9]\s|bleecker|christopher/i],
    ['lower east side', /lower\s*east|les\b|rivington|delancey|orchard/i],
    ['soho', /soho|spring\s*st|prince\s*st|broome\s*st/i],
    ['tribeca', /tribeca|franklin\s*st|leonard\s*st|hudson\s*st/i],
    ["hell's kitchen", /hell.?s?\s*kitchen|w\s*[3-5][0-9].*(?:10|11)\s*av/i],
    ['midtown', /midtown|w\s*[3-5][0-9]|e\s*[3-5][0-9]/i],
    ['upper east side', /upper\s*east|e\s*[6-9][0-9]|york\s*ave/i],
    ['upper west side', /upper\s*west|w\s*[6-9][0-9]|central\s*park\s*w|columbus|amsterdam/i],
    ['financial district', /financial|fidi|wall\s*st|broad\s*st|water\s*st/i],
    ['greenpoint', /greenpoint|green\s*point/i],
    ['williamsburg', /williamsburg/i],
    ['park slope', /park\s*slope/i],
    ['brooklyn heights', /brooklyn\s*heights/i],
    ['bed-stuy', /bed.?stuy|bedford.?stuyves/i],
    ['bushwick', /bushwick/i],
    ['sunnyside', /sunnyside/i],
    ['woodside', /woodside/i],
    ['jackson heights', /jackson\s*heights|37-?40\s+85th|37-?34\s+85th|85th\s+st.*11372/i],
    ['astoria', /astoria/i],
    ['long island city', /long\s*island\s*city|lic\b/i],
    ['jersey city', /jersey\s*city/i],
    ['hoboken', /hoboken/i],
  ];
  for (const [name, re] of patterns) {
    if (re.test(addr)) return name;
  }
  // Fallback: use borough
  const b = borough.toLowerCase();
  if (b.includes('manhattan')) return 'midtown';
  if (b.includes('brooklyn')) return 'brooklyn heights';
  if (b.includes('queens')) return 'astoria';
  if (b.includes('bronx')) return 'bronx';
  return '';
}

function detectZipFromText(...values: Array<unknown>): string {
  for (const value of values) {
    const match = String(value || '').match(/\b(10[0-4]\d{2}|11[0-6]\d{2}|112\d{2}|113\d{2}|114\d{2}|103\d{2})\b/);
    if (match) return match[1];
  }
  return '';
}

function buildNeighborhoodSearchContext(input: {
  address: string;
  borough: string;
  neighborhoodName: string;
  zipCode: string;
  raw: any;
}): MasterReportData['neighborhoodSearchContext'] {
  const zipCode = input.zipCode || detectZipFromText(
    input.address,
    input.raw?.dofAbatement?.raw?.zip_code,
    input.raw?.dofAbatement?.raw?.zip,
    input.raw?.registration?.zip,
    input.raw?.dof?.zip
  );
  const neighborhoodName = input.neighborhoodName || detectNeighborhood(input.address, input.borough || '');
  const contextParts = [
    neighborhoodName,
    zipCode ? `ZIP ${zipCode}` : null,
    input.borough || 'New York City',
  ].filter(Boolean);
  return {
    zipCode,
    neighborhoodName,
    borough: input.borough || '',
    query: contextParts.join(' '),
    source: zipCode
      ? 'ZIP-first neighborhood context from DOF/HPD/address parsing'
      : 'Neighborhood context from address, borough, and market profile inference',
  };
}

export function lookupNeighborhoodData(neighborhood: string): NeighborhoodMarketData | null {
  if (!neighborhood) return null;
  const key = neighborhood.toLowerCase();
  return NEIGHBORHOOD_MARKET_DATA[key] || null;
}

function gradeManagement(d: {
  violationsOpen: number;
  violationsTotal: number;
  dobViolationOpen: number;
  ecbCount: number;
  ecbPenaltyBalance: number;
  hasActiveLitigation: boolean;
  litigationCount: number;
  permitsCount: number;
  hasRecentPermits: boolean;
  facadeIssueCount: number;
  facadeFilingCount: number;
  hasTaxLien: boolean;
  taxLienRecordCount: number;
  acrisLienClaimCount: number;
  complaint311Count: number;
  ll97Penalty: number;
  complianceReleaseStatus: MasterReportData['complianceReleaseStatus'];
  publicRecordsLoaded?: boolean;
}): { grade: string; scorecard: { violations: number; compliance: number; financial: number; overall: number } } {
  // Score clean public-record results as clean results; only hold the grade
  // when Jackie did not load enough anchors to know the checks ran.
  const hasAnyData = d.publicRecordsLoaded;
  if (!hasAnyData) {
    return { grade: '—', scorecard: { violations: 0, compliance: 0, financial: 0, overall: 0 } };
  }

  const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));
  const openViolationSignals = d.violationsOpen + d.dobViolationOpen;
  const publicRiskSignals = [
    d.violationsOpen > 0,
    d.dobViolationOpen > 0,
    d.ecbCount > 0,
    d.ecbPenaltyBalance > 0,
    d.hasActiveLitigation || d.litigationCount > 0,
    d.hasTaxLien || d.taxLienRecordCount > 0,
    d.acrisLienClaimCount > 0,
    d.facadeIssueCount > 0,
    d.ll97Penalty > 0,
    d.complianceReleaseStatus === 'blocked',
  ].filter(Boolean).length;

  // Violations score: reconcile HPD open violations, DOB open violations, and
  // historical HPD volume. A report cannot show problems on one page and 100 here.
  let violScore = 100;
  if (openViolationSignals > 50) violScore = 15;
  else if (openViolationSignals > 20) violScore = 30;
  else if (openViolationSignals > 10) violScore = 45;
  else if (openViolationSignals > 5) violScore = 60;
  else if (openViolationSignals > 0) violScore = 75;
  if (d.violationsTotal > 100) violScore = Math.min(violScore, 60);
  else if (d.violationsTotal > 50) violScore = Math.min(violScore, 70);
  else if (d.violationsTotal > 10) violScore = Math.min(violScore, 85);

  // Compliance score
  let compScore = 100;
  if (d.ecbPenaltyBalance > 50000) compScore -= 55;
  else if (d.ecbPenaltyBalance > 20000) compScore -= 40;
  else if (d.ecbPenaltyBalance > 5000) compScore -= 25;
  else if (d.ecbPenaltyBalance > 0) compScore -= 12;
  if (d.ecbCount > 20) compScore -= 25;
  else if (d.ecbCount > 10) compScore -= 18;
  else if (d.ecbCount > 0) compScore -= 8;
  if (d.facadeIssueCount > 2) compScore -= 30;
  else if (d.facadeIssueCount > 0) compScore -= 18;
  if (d.ll97Penalty > 50000) compScore -= 20;
  else if (d.ll97Penalty > 0) compScore -= 10;
  if (d.complianceReleaseStatus === 'blocked') compScore -= 35;
  else if (d.complianceReleaseStatus === 'needs_review') compScore -= 12;
  compScore = clampScore(compScore);

  // Financial score (litigation + penalties)
  let finScore = 100;
  if (d.hasTaxLien || d.taxLienRecordCount > 0) finScore -= 35;
  if (d.hasActiveLitigation) finScore -= 25;
  else if (d.litigationCount > 0) finScore -= 15;
  if (d.acrisLienClaimCount > 0) finScore -= 15;
  if (d.ecbPenaltyBalance > 10000) finScore -= 20;
  if (d.violationsTotal > 50) finScore -= 15;
  if (d.complaint311Count > 50) finScore -= 10;
  finScore = clampScore(finScore);

  let overall = Math.round((violScore * 0.35) + (compScore * 0.4) + (finScore * 0.25));
  if (d.complianceReleaseStatus === 'blocked') overall = Math.min(overall, 69);
  if (d.hasTaxLien || d.taxLienRecordCount > 0) overall = Math.min(overall, 84);
  if (d.hasActiveLitigation || d.acrisLienClaimCount > 0) overall = Math.min(overall, 86);
  if (openViolationSignals > 0 || d.facadeIssueCount > 0) overall = Math.min(overall, 89);
  if (d.ecbCount > 0 || d.ecbPenaltyBalance > 0) overall = Math.min(overall, 92);
  if (publicRiskSignals >= 3) overall = Math.min(overall, 79);
  if (publicRiskSignals >= 5) overall = Math.min(overall, 69);
  const grade = overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : overall >= 40 ? 'D' : 'F';

  return { grade, scorecard: { violations: violScore, compliance: compScore, financial: finScore, overall } };
}

// ============================================================
// Constants
// ============================================================

const CAMELOT = {
  name: 'Camelot Realty Group',
  shortName: 'Camelot Realty Group',
  address: '57 West 57th Street, Suite 410, New York, NY 10019',
  phone: '(212) 206-9939',
  mobile: '(212) 206-9939 ext. 701',
  email: 'info@camelot.nyc',
  infoEmail: 'info@camelot.nyc',
  web: 'www.camelot.nyc',
  principal: 'David A. Goldoff',
  title: 'President',
  license1: 'Camelot Brokerage Services Corp #10311208308',
  license2: 'Camelot Realty Group LLC #10491200104',
};

const CAMELOT_PROFILE = {
  foundedYear: 2006,
  buildingsManaged: 42,
  assetsUnderManagement: '$240M+',
  assetsUnderManagementNote: 'internal estimate; confirm against current Camelot OS / accounting roster before final publication',
  unitsTracked: '5,351+',
  unitsTrackedNote: 'current and prior client unit records tracked by Camelot OS',
};

const CAMELOT_ASSOCIATION_LINKS = [
  { name: 'NYARM', fullName: 'New York Association of Realty Managers', url: 'https://www.nyarm.com', logo: 'https://www.nyarm.com/logo.gif' },
  { name: 'REBNY', fullName: 'Real Estate Board of New York', url: 'https://www.rebny.com', logo: './images/associations/rebny-logo.jpeg' },
  { name: 'SPONY', fullName: 'Small Property Owners of New York', url: 'https://www.spony.org', logo: 'https://spony.org/static/logo_sm.png' },
  { name: 'IREM', fullName: 'IREM Greater New York Chapter', url: 'https://iremnyc.org', logo: 'https://iremnyc.org/images/design/IREM_Greater_NYC_Logo.jpg' },
  { name: 'BOMA New York', fullName: 'Building Owners and Managers Association of Greater New York', url: 'https://www.bomany.org', logo: 'https://www.bomany.org/uploads/1/4/2/9/142998385/boma-ny-logo-white-08-19-2024-rgb-4x.webp' },
  { name: 'NARPM', fullName: 'National Association of Residential Property Managers', url: 'https://www.narpm.org', logo: 'https://www.narpm.org/wp-content/themes/narpm-new/static/images/logo.png' },
  { name: 'NYAA', fullName: 'New York Apartment Association', url: 'https://www.housing.org', logo: 'https://images.squarespace-cdn.com/content/v1/657b6aee60f6b65fba14db24/b52a2ade-0bb2-4458-9b70-afbaaed428e4/NYAA+Logo.png?format=1500w' },
  { name: 'CNYC', fullName: 'Council of New York Cooperatives and Condominiums', url: 'https://www.cnyc.com', logo: 'https://www.cnyc.com/images/logo_cnyc.gif' },
];

function camelotAssociationLogoGrid(): string {
  return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px">
${CAMELOT_ASSOCIATION_LINKS.map(a => `<a href="${a.url}" target="_blank" rel="noopener" style="height:78px;background:#fff;border:1px solid #D5D0C6;border-radius:8px;padding:9px;text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;overflow:hidden">
<img src="${a.logo}" alt="${a.fullName}" style="max-width:100%;max-height:38px;object-fit:contain;display:block" onerror="this.style.display='none'">
<span style="font-size:9px;color:#2C3240;font-weight:800;text-align:center;line-height:1.15">${a.name}</span>
</a>`).join('')}
</div>`;
}

function camelotAssociationTextLine(): string {
  return 'NYARM, REBNY, SPONY, IREM, BOMA New York, NARPM, NYAA, CNYC, NY Chamber of Commerce, Queens Chamber of Commerce, Queens & Bronx Buildings Association, Metropolitan Resident Managers Association, New York Resident Managers Association, Scandinavian Building Managers Guild, and licensed REBNY managing agent / brokerage relationships.';
}

const LEGAL_TERMS_URL = 'https://camelot-scout-v6.onrender.com/#/legal-report-terms';
const GOOGLE_MAPS_REPORT_KEY = GOOGLE_MAPS_KEY;

function reportFilenameSafe(value: string): string {
  return value
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    || 'Property';
}

export function buildJackieIntelReportFilename(
  d: Pick<MasterReportData, 'address' | 'buildingName' | 'date'>,
  extension?: 'pdf' | 'html',
): string {
  const sourceAddress = d.address || d.buildingName || 'Property';
  const dateValue = d.date ? new Date(d.date) : new Date();
  const dateStamp = Number.isNaN(dateValue.getTime())
    ? new Date().toISOString().slice(0, 10)
    : dateValue.toISOString().slice(0, 10);
  const base = `Camelot-Intel-Report-For_${reportFilenameSafe(sourceAddress)}_${dateStamp}`;
  return extension ? `${base}.${extension}` : base;
}

// ============================================================
// Portfolio Database (Camelot + Blue Owl + Penn South Capital)
// ============================================================

interface PortfolioBuilding {
  address: string;
  name: string;
  type: 'Condominium' | 'Co-operative' | 'Rental' | 'Commercial';
  neighborhood: string;
  borough: string;
  lat: number;
  lng: number;
  outcome: string;
  brand: 'Camelot' | 'Blue Owl' | 'Penn South Capital';
  image?: string;
  caseStudy?: { situation: string; response: string; result: string; statLine: string; url: string };
}

const CAMELOT_PORTFOLIO: PortfolioBuilding[] = [
  { address: '949 Park Avenue', name: '949 Park Avenue Condominium', type: 'Condominium', neighborhood: 'Carnegie Hill, UES', borough: 'Manhattan', lat: 40.7772, lng: -73.9601, outcome: '$200K saved in one insurance claim', brand: 'Camelot', image: './images/case-studies/949-park.jpg', caseStudy: { situation: 'A 9th-floor window shattered unexpectedly, triggering FDNY emergency response and creating an immediate pedestrian safety risk on Park Avenue.', response: 'Within hours, Camelot secured the area with a sidewalk bridge, commissioned a professional engineering assessment, and coordinated directly with the insurance carrier.', result: '949 Park Avenue saved $200,000. Full replacement cost covered by insurance. Updated house rules and improved 32BJ staff accountability.', statLine: '$200,000 SAVED \u00B7 ZERO DISRUPTION TO RESIDENTS \u00B7 PARK AVENUE PORTFOLIO \u2014 CAMELOT ACTIVE', url: 'https://www.camelot.nyc/case-studies/949-park-ave-condominium/' } },
  { address: '105 E 29th Street', name: '105 E 29th Street Co-op', type: 'Co-operative', neighborhood: 'NoMad / Midtown South', borough: 'Manhattan', lat: 40.7437, lng: -73.9830, outcome: 'Vendor rebid: 14% savings Yr 1', brand: 'Camelot' },
  { address: '201 E 15th Street', name: '201 E 15th Street Co-op', type: 'Co-operative', neighborhood: 'Gramercy Park', borough: 'Manhattan', lat: 40.7338, lng: -73.9851, outcome: 'Insurance restructure: 18% reduction', brand: 'Camelot' },
  { address: '165 E 7th Street', name: '165 E 7th Street Condominium', type: 'Condominium', neighborhood: 'East Village', borough: 'Manhattan', lat: 40.7260, lng: -73.9835, outcome: 'LL97 roadmap delivered in 60 days', brand: 'Camelot' },
  { address: '137 Franklin Street', name: '137 Franklin Street Apartment Corp', type: 'Co-operative', neighborhood: 'Tribeca', borough: 'Manhattan', lat: 40.7178, lng: -74.0044, outcome: '\u201CBest and most knowledgeable PMs\u201D', brand: 'Camelot' },
  { address: '58 White Street', name: '58 White Street', type: 'Condominium', neighborhood: 'Tribeca', borough: 'Manhattan', lat: 40.7186, lng: -74.0022, outcome: '$1.2M deferred maintenance resolved', brand: 'Camelot', image: './images/case-studies/58-white-street.jpg', caseStudy: { situation: 'Building had $1.2M in deferred capital maintenance, multiple open DOB violations, and an expiring insurance policy with no carrier willing to renew.', response: 'Camelot prioritized violations, engaged new engineering and legal counsel, executed emergency capital repairs, and secured insurance through our broker network.', result: '58 White Street: All critical violations resolved within 90 days. Insurance renewed at competitive rates. Capital reserve plan funded and on track.', statLine: '$1.2M DEFERRED MAINTENANCE RESOLVED \u00B7 ALL VIOLATIONS CLEARED \u00B7 TRIBECA PORTFOLIO \u2014 CAMELOT ACTIVE', url: 'https://www.camelot.nyc/case-studies/white-street-plaza-corp/' } },
  { address: '300 E 56th Street', name: '300 E 56th Street', type: 'Co-operative', neighborhood: 'Sutton Place', borough: 'Manhattan', lat: 40.7588, lng: -73.9652, outcome: 'Full financial restructuring', brand: 'Camelot' },
  { address: '465 Park Avenue', name: '465 Park Avenue', type: 'Condominium', neighborhood: 'Midtown East', borough: 'Manhattan', lat: 40.7625, lng: -73.9710, outcome: 'Capital planning overhaul', brand: 'Camelot' },
  { address: '500 W 43rd Street', name: '500 W 43rd Street', type: 'Rental', neighborhood: "Hell's Kitchen", borough: 'Manhattan', lat: 40.7596, lng: -73.9948, outcome: 'Rent stabilized portfolio optimization', brand: 'Camelot' },
  { address: '748 St Nicholas Avenue', name: '748 St Nicholas Avenue', type: 'Rental', neighborhood: 'Hamilton Heights', borough: 'Manhattan', lat: 40.8252, lng: -73.9433, outcome: 'HPD violations cleared 100%', brand: 'Camelot' },
  { address: '86 W 127th Street', name: '86 W 127th Street', type: 'Rental', neighborhood: 'Harlem', borough: 'Manhattan', lat: 40.8088, lng: -73.9470, outcome: 'Full compliance restored', brand: 'Camelot' },
  { address: '930 St Nicholas Avenue', name: '930 St Nicholas Avenue', type: 'Rental', neighborhood: 'Washington Heights', borough: 'Manhattan', lat: 40.8325, lng: -73.9406, outcome: 'Stabilization program', brand: 'Camelot' },
  { address: '253 W 73rd Street', name: '253 W 73rd Street', type: 'Co-operative', neighborhood: 'Upper West Side', borough: 'Manhattan', lat: 40.7793, lng: -73.9793, outcome: 'Board governance restructured', brand: 'Camelot' },
  { address: '39 5th Avenue', name: '39 Fifth Avenue', type: 'Co-operative', neighborhood: 'Greenwich Village', borough: 'Manhattan', lat: 40.7322, lng: -73.9958, outcome: 'Vendor savings 22%', brand: 'Camelot' },
  { address: '260 W 26th Street', name: '260 W 26th Street', type: 'Co-operative', neighborhood: 'Chelsea', borough: 'Manhattan', lat: 40.7465, lng: -73.9960, outcome: 'Energy efficiency upgrade', brand: 'Camelot' },
  { address: '56 E 87th Street', name: '56 E 87th Street', type: 'Co-operative', neighborhood: 'Carnegie Hill', borough: 'Manhattan', lat: 40.7829, lng: -73.9567, outcome: 'Board transition managed', brand: 'Camelot' },
  { address: '604 Grand Street', name: '604 Grand Street', type: 'Rental', neighborhood: 'Williamsburg', borough: 'Brooklyn', lat: 40.7125, lng: -73.9394, outcome: 'Brooklyn expansion — stabilized ops', brand: 'Camelot' },
  { address: '83-55 Woodhaven Boulevard', name: '83-55 Woodhaven Blvd', type: 'Co-operative', neighborhood: 'Woodhaven', borough: 'Queens', lat: 40.6934, lng: -73.8571, outcome: 'First Queens portfolio building', brand: 'Camelot' },
  { address: '788 Pelham Parkway', name: '788 Pelham Parkway', type: 'Rental', neighborhood: 'Pelham Parkway', borough: 'Bronx', lat: 40.8563, lng: -73.8640, outcome: 'Bronx portfolio flagship', brand: 'Camelot' },
  { address: '346 E 119th Street', name: '346 E 119th Street', type: 'Rental', neighborhood: 'East Harlem', borough: 'Manhattan', lat: 40.7970, lng: -73.9378, outcome: 'Distress turnaround', brand: 'Blue Owl' },
  { address: '175 W 93rd Street', name: '175 W 93rd Street', type: 'Rental', neighborhood: 'Upper West Side', borough: 'Manhattan', lat: 40.7925, lng: -73.9719, outcome: 'Operations stabilized', brand: 'Blue Owl' },
  { address: '410 E 6th Street', name: '410 E 6th Street', type: 'Rental', neighborhood: 'East Village', borough: 'Manhattan', lat: 40.7260, lng: -73.9810, outcome: 'Full renovation oversight', brand: 'Blue Owl' },
  { address: '402 Henry Street', name: '402 Henry Street', type: 'Rental', neighborhood: 'Carroll Gardens', borough: 'Brooklyn', lat: 40.6801, lng: -73.9998, outcome: 'Brooklyn expansion flagship', brand: 'Penn South Capital' },
  { address: '129 E 10th Street', name: '129 E 10th Street', type: 'Rental', neighborhood: 'East Village', borough: 'Manhattan', lat: 40.7285, lng: -73.9868, outcome: 'Compliance overhaul', brand: 'Penn South Capital' },
];

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearbyPortfolioBuildings(lat: number | null, lng: number | null, borough: string, limit = 5): Array<PortfolioBuilding & { distance: number }> {
  if (!lat || !lng) {
    // No geocode — prefer same borough, then return first N
    const sameBoro = CAMELOT_PORTFOLIO.filter(b => b.borough.toLowerCase() === borough.toLowerCase());
    const others = CAMELOT_PORTFOLIO.filter(b => b.borough.toLowerCase() !== borough.toLowerCase());
    return [...sameBoro, ...others].slice(0, limit).map(b => ({ ...b, distance: -1 }));
  }
  return CAMELOT_PORTFOLIO
    .map(b => ({ ...b, distance: haversineDistance(lat, lng, b.lat, b.lng) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

function portfolioStaticStreetViewImage(b: PortfolioBuilding, size = '640x360'): string {
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${encodeURIComponent(`${b.lat},${b.lng}`)}&heading=0&pitch=5&fov=78&key=${GOOGLE_MAPS_REPORT_KEY}`;
}

function portfolioFallbackTile(b: PortfolioBuilding): string {
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#2F4051,#1E2B38);color:#F4D26A;text-align:center;font-size:9px;line-height:1.25;font-weight:700;padding:8px;box-sizing:border-box">${b.address}<br><span style="color:#fff;font-weight:500">Portfolio image</span></div>`;
}

function portfolioVisual(b: PortfolioBuilding): string {
  const src = b.image || portfolioStaticStreetViewImage(b);
  const source = b.image ? 'Verified Camelot portfolio image' : 'Static Google Street View image';
  const fallback = portfolioFallbackTile(b).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<img src="${src}" alt="${b.address} - ${source}" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy" onerror="this.outerHTML='${fallback}'">`;
}

function portfolioSourceLabel(b: PortfolioBuilding): string {
  if (b.image) {
    return 'Verified Camelot portfolio image';
  }
  return 'Static Google Street View image';
}

function buildPortfolioSection(d: MasterReportData): string {
  const nearby = findNearbyPortfolioBuildings(d.latitude, d.longitude, d.borough, 5);
  const hasNearby = nearby.length > 0 && nearby[0].distance !== -1 && nearby[0].distance < 10;
  const caseStudyBldg = nearby.find(b => b.caseStudy) || CAMELOT_PORTFOLIO.find(b => b.caseStudy)!;

  const tableRows = nearby.map(b => {
    const distLabel = b.distance > 0 ? `${b.distance.toFixed(1)} mi` : (b.distance === -1 ? b.borough : '');
    const distSpan = distLabel ? ` <span style="color:#A89035;font-size:10px;font-weight:600">(${distLabel})</span>` : '';
    const streetViewLocation = `${b.address}, ${b.borough}, NY`;
    const streetViewUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(streetViewLocation)}`;
    return `<tr>
<td style="width:92px;padding:6px">
  <a href="${streetViewUrl}" target="_blank" rel="noopener" style="display:block;width:84px;height:54px;border:1px solid #D5D0C6;background:#EDE9DF;overflow:hidden;text-decoration:none">
    ${portfolioVisual(b)}
  </a>
</td>
<td style="font-weight:700"><a href="${streetViewUrl}" target="_blank" rel="noopener" style="color:#0D2E63;text-decoration:none">${b.address}</a><br><span style="color:#A89035;font-size:9px;font-weight:600">${portfolioSourceLabel(b)}</span></td>
<td>${b.type}</td>
<td>${b.neighborhood}${distSpan}</td>
<td style="color:#A89035;font-weight:600">Active</td>
<td>${b.outcome}</td>
</tr>`;
  }).join('\n');

  const portfolioImageStrip = nearby.map(b => {
    const streetViewLocation = `${b.address}, ${b.borough}, NY`;
    const streetViewUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(streetViewLocation)}`;
    return `<a href="${streetViewUrl}" target="_blank" rel="noopener" style="text-decoration:none;background:#fff;border:1px solid #D5D0C6;box-shadow:0 5px 12px rgba(44,50,64,0.07);overflow:hidden;display:block;min-height:112px">
<div style="height:78px;background:#EDE9DF;overflow:hidden">${portfolioVisual(b)}</div>
<div style="padding:7px 8px;font-size:8.5px;line-height:1.3;color:#3A4B5B;font-weight:700">${b.address}<br><span style="color:#A89035;font-weight:600">${portfolioSourceLabel(b)}</span></div>
</a>`;
  }).join('\n');

  const nearCount = nearby.filter(b => b.distance >= 0 && b.distance < 3).length;
  const proximityNote = hasNearby
    ? `<div style="background:#EDE9DF;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:10px 16px;margin-bottom:14px;font-size:11px;color:#3A4B5B">
<strong style="color:#A89035">\u2606 Local Presence:</strong> Camelot actively manages <strong>${nearCount} building${nearCount !== 1 ? 's' : ''} within 3 miles</strong> of ${d.buildingName}. Our team, vendors, and operational infrastructure are already embedded in your neighborhood.
</div>`
    : `<div style="background:#EDE9DF;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:10px 16px;margin-bottom:14px;font-size:11px;color:#3A4B5B">
<strong style="color:#A89035">\u2606 Citywide Reach:</strong> Camelot manages 42 properties across all five boroughs \u2014 from Park Avenue penthouses to Brooklyn brownstones to Bronx rental portfolios. Our operations infrastructure means your building gets the same dedicated team, institutional knowledge, and vendor network regardless of location. Some of our most impactful results have come from buildings in new neighborhoods, where we bring fresh perspective and zero legacy bias.
</div>`;

  const cs = caseStudyBldg?.caseStudy;
  const caseStudyHTML = cs ? `<div style="background:#3A4B5B;border-radius:8px;padding:18px;margin-top:16px;color:#fff">
<div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#A89035;font-weight:700;margin-bottom:8px">Case Study: <a href="${cs.url}" target="_blank" rel="noopener" style="color:#F4D26A;text-decoration:underline">${caseStudyBldg.address}</a> \u2014 Camelot in Action</div>
<p style="font-size:12px;line-height:1.7;margin-bottom:8px"><strong>Situation:</strong> ${cs.situation}</p>
<p style="font-size:12px;line-height:1.7;margin-bottom:8px"><strong>Response:</strong> ${cs.response}</p>
<p style="font-size:12px;line-height:1.7;margin-bottom:8px"><strong style="color:#A89035">Result: ${cs.result}</strong></p>
<p style="font-size:11px;line-height:1.6;margin-bottom:8px"><a href="${cs.url}" target="_blank" rel="noopener" style="color:#F4D26A;text-decoration:underline;font-weight:700">Read the full Camelot case study on camelot.nyc</a></p>
<div style="border-top:1px solid rgba(197,165,90,0.3);padding-top:8px;margin-top:8px;font-size:10px;color:#A89035;text-align:center;letter-spacing:1px">${cs.statLine}</div>
</div>` : '';

  return `<div class="section section-white">
<div class="section-title">Camelot Portfolio \u2014 Near ${d.buildingName}</div>
<div class="section-sub">Active buildings we manage, sorted by proximity to your property</div>
${proximityNote}
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px">
${portfolioImageStrip}
</div>
<table class="compare-table">
<thead><tr>
<th style="background:#3A4B5B;color:#fff">Photo</th>
<th style="background:#3A4B5B;color:#fff">Building</th>
<th style="background:#3A4B5B;color:#fff">Type</th>
<th style="background:#3A4B5B;color:#fff">Neighborhood</th>
<th style="background:#3A4B5B;color:#fff">Status</th>
<th style="background:#3A4B5B;color:#fff">Outcome</th>
</tr></thead>
<tbody>
${tableRows}
</tbody>
</table>
${caseStudyHTML}
</div>`;
}

// ============================================================
// Data Builder
// ============================================================

function withReportTimeout<T>(promise: Promise<T>, fallback: T, ms = 9000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout])
    .catch(() => fallback)
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(address)}&size=1`, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.features?.[0]?.geometry?.coordinates;
    if (coords && coords.length === 2) return { lat: coords[1], lng: coords[0] };
    return null;
  } catch { return null; }
  finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchOfficialBuildingBranding(address: string, buildingName: string): Promise<any | null> {
  try {
    if (typeof window === 'undefined') return null;
    if (String(import.meta.env.VITE_DISABLE_SERVER_INTEGRATIONS || '').toLowerCase() === 'true') return null;
    const params = new URLSearchParams({ address, name: buildingName || address });
    const res = await fetch(`/api/building/brand?${params.toString()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function inferCommercialAmenityIntel(input: {
  address: string;
  buildingName: string;
  buildingClass: string;
  taxClass: string;
  propertyType: string;
  occupancy: string | null;
  streetEasy: StreetEasyBuilding | null;
  branding: any | null;
  raw: any;
}): CommercialAmenityIntel {
  const sourceSignals = [
    ...(input.branding?.commercialResearch?.signals || []),
    ...(input.branding?.commercialResearch?.sourceHits || []).map((hit: any) => `${hit.source}: ${hit.title || hit.url}`),
    ...(input.branding?.parkingResearch?.signals || []),
  ];
  const hay = [
    input.address,
    input.buildingName,
    input.buildingClass,
    input.taxClass,
    input.propertyType,
    input.occupancy || '',
    input.streetEasy?.description || '',
    ...(input.streetEasy?.amenities || []),
    ...(input.streetEasy?.features || []),
    input.branding?.official?.title || '',
    input.branding?.official?.description || '',
    input.branding?.official?.textSample || '',
    ...sourceSignals,
  ].join(' ').toLowerCase();

  const commercialPatterns: Array<[string, RegExp]> = [
    ['Retail / storefront', /\b(retail|storefront|shop|restaurant|cafe|market|salon)\b/i],
    ['Office', /\b(office|professional suite|commercial suite)\b/i],
    ['Medical / doctor office', /\b(doctor|medical|clinic|physician|dental|healthcare)\b/i],
    ['Billboard / signage', /\b(billboard|signage|advertising sign|wallscape)\b/i],
    ['Parking / garage', /\b(parking|garage|valet|parking operator|indoor parking|self park|monthly parking)\b/i],
    ['Storage cages / lockers', /\b(storage cage|storage locker|private storage|storage space|storage)\b/i],
  ];
  const amenityPatterns: Array<[string, RegExp]> = [
    ['Storage cages', /\b(storage cage|storage locker|private storage|storage space|storage)\b/i],
    ['Parking / garage', /\b(parking|garage|valet|indoor parking|monthly parking)\b/i],
    ['Library', /\blibrary\b/i],
    ['Pool', /\bpool\b/i],
    ['Fitness center / gym', /\b(gym|fitness|exercise room|yoga)\b/i],
    ['Roof deck / terrace', /\b(roof deck|terrace|rooftop)\b/i],
    ['Lounge', /\blounge\b/i],
    ['Garden / courtyard', /\b(garden|courtyard)\b/i],
    ['Bike room', /\bbike room\b/i],
    ['Package room', /\bpackage room\b/i],
    ['Doorman / concierge', /\b(doorman|concierge|attended lobby)\b/i],
    ['Playroom', /\b(playroom|children'?s playroom)\b/i],
  ];

  const likelyCommercialUses = commercialPatterns.filter(([, re]) => re.test(hay)).map(([label]) => label);
  const parkingOperatorPatterns: Array<[string, RegExp]> = [
    ['Icon Parking signal', /\bicon\s+parking\b/i],
    ['iPark parking signal', /\bipark\b/i],
    ['LAZ Parking signal', /\blaz\s+parking\b/i],
    ['SP+ parking signal', /\bsp\+|standard\s+parking\b/i],
    ['Edison ParkFast signal', /\bedison\s+parkfast\b/i],
    ['Quik Park signal', /\bquik\s+park\b/i],
    ['Propark signal', /\bpropark\b/i],
    ['Champion Parking signal', /\bchampion\s+parking\b/i],
    ['City Parking signal', /\bcity\s+parking\b/i],
    ['Manhattan Parking Group signal', /\bmanhattan\s+parking\s+group\b/i],
    ['Little Man Parking signal', /\blittle\s+man\s+parking\b/i],
  ];
  const parkingOperatorSignals = parkingOperatorPatterns.filter(([, re]) => re.test(hay)).map(([label]) => label);
  const amenities = [
    ...amenityPatterns.filter(([, re]) => re.test(hay)).map(([label]) => label),
    ...(input.streetEasy?.amenities || []),
    ...(input.branding?.official?.amenities || []),
  ].filter(Boolean);
  const commercialSignals = [
    ...likelyCommercialUses,
    ...parkingOperatorSignals,
    ...sourceSignals,
    ...(input.branding?.official?.commercialSignals || []),
  ].filter(Boolean);

  if (/^(K|O|L|R5|R7)/i.test(input.buildingClass)) {
    commercialSignals.push(`DOF class ${input.buildingClass}: possible commercial or mixed-use component`);
  }
  if (/4|commercial/i.test(input.taxClass)) {
    commercialSignals.push(`Tax class ${input.taxClass}: commercial review required`);
  }

  const uniqueAmenities = [...new Set(amenities.map(a => String(a).trim()).filter(Boolean))];
  const uniqueCommercial = [...new Set(commercialSignals.map(s => String(s).trim()).filter(Boolean))];
  const revenueOpportunities = [
    uniqueCommercial.some(s => /retail|office|medical|commercial/i.test(s)) ? 'Commercial lease abstract and rent escalation audit' : null,
    uniqueCommercial.some(s => /parking|garage|operator|ipark|icon|laz|sp\+|edison|quik|propark/i.test(s)) || uniqueAmenities.some(a => /parking|garage/i.test(a)) ? 'Parking operator, DOT/DOB garage, license, revenue, and insurance review' : null,
    uniqueCommercial.some(s => /billboard|signage/i.test(s)) ? 'Billboard/signage licensing and revenue review' : null,
    uniqueAmenities.some(a => /storage/i.test(a)) ? 'Storage cage inventory, license terms, and waitlist revenue review' : null,
    uniqueAmenities.length > 0 ? 'Amenity access, booking, waiver, and resident communication review' : null,
  ].filter(Boolean) as string[];

  const official = input.branding?.official || null;
  const researchSources = [
    'DOF building class / tax class',
    'HPD MDR owner / managing-agent records',
    input.streetEasy ? 'StreetEasy amenities and features' : null,
    official?.url ? `Official website: ${official.url}` : 'Official building website search attempted',
    'PropertyShark-style owner / tax / commercial-use review',
    'LoopNet public listing search attempted',
    'CoStar public listing search attempted',
    'NYC DOT/DOB parking garage and curb-cut signal review',
    'NYC parking operator scan: Icon, iPark, LAZ, SP+, Edison ParkFast, Quik Park, Propark, Champion, City Parking',
    'Jackie keyword scan: retail, office, medical, signage, storage, parking, amenities',
    ...(input.branding?.commercialResearch?.sourceHits || []).map((hit: any) => `${hit.source}: ${hit.url}`),
  ].filter(Boolean) as string[];

  return {
    commercialSignals: uniqueCommercial,
    likelyCommercialUses,
    amenities: uniqueAmenities,
    revenueOpportunities: [...new Set(revenueOpportunities)],
    officialWebsite: official?.url || null,
    brandingTitle: official?.title || null,
    brandingDescription: official?.description || null,
    brandingImages: official?.images || [],
    researchSources,
    researchStatus: official?.url || uniqueCommercial.length > 0 || uniqueAmenities.length > 0 ? 'verified' : 'needs_review',
  };
}

function getKnownPropertyFacts(address: string, candidateName = ''): KnownPropertyFacts | null {
  const key = `${address} ${candidateName}`.toLowerCase();
  if (is36East22ndStreetSubject(key)) {
    return {
      canonicalAddress: EAST_36_22_ADDRESS,
      buildingName: EAST_36_22_NAME,
      borough: 'Manhattan',
      buildingClass: 'R4',
      units: CAMELOT_36_EAST_22_UNIT_COUNT,
      stories: 9,
      yearBuilt: 1901,
      propertyType: 'Pre-war Elevator Condominium',
      neighborhoodName: 'Flatiron / Madison Square',
      managementCompany: CAMELOT_36_EAST_22_MANAGEMENT_TO_VERIFY,
      officialWebsite: 'https://www.compass.com/building/the-story-house-manhattan-ny/281903082961387829/',
      imageUrls: [
        '/images/36-east-22nd/story-house-exterior.jpg',
      ],
      description: 'The Story House at 36 East 22nd Street is a small Flatiron / Madison Square pre-war elevator condominium. Jackie locks elevator status and small-building scale so missing public fields cannot turn the property into a walk-up.',
      amenities: [
        'Pre-war elevator building',
        'Boutique condominium operating profile',
        'Flatiron / Madison Square location',
        'Small-building board and resident-service needs',
        'Package, move, alteration, insurance, and building access policies to verify',
      ],
      commercialSignals: [
        'Elevator status must remain locked as elevator-served unless primary source records prove otherwise.',
        'Current management, board authority, and unit count should be confirmed through HPD MDR, ACRIS, PropertyShark, and board materials before publication.',
        'Small elevator condominium operations require careful resident communication, insurance review, building access control, vendor oversight, and capital planning.',
      ],
      revenueOpportunities: [
        'Move-in/move-out, alteration, resale/refinance package, insurance-review, storage, and document-fee schedule review.',
        'Elevator maintenance, inspection, violation, and service contract review.',
        'Insurance renewal, deductible, and carrier requirement review for a small Manhattan condominium.',
        'Vendor contract, cleaning, preventative maintenance, and resident-service workflow review.',
      ],
      landmarks: [
        'Madison Square Park: nearby',
        'Flatiron Building / Ladies Mile Historic District context: nearby',
        '23rd Street subway corridor: nearby',
        'Broadway, Park Avenue South, and Fifth Avenue retail / office corridors: nearby',
        'Union Square / Gramercy / NoMad access: nearby',
      ],
      locationTitle: 'Flatiron / Madison Square Positioning',
      locationCopy: 'The property sits in a high-visibility Flatiron / Madison Square corridor where transit, office, retail, restaurant, and park access shape both resident experience and long-term value.',
      lifestyleTitle: 'Small Pre-War Elevator Condominium',
      lifestyleCopy: 'A boutique elevator condominium needs the attention of a small-building manager with larger-building discipline: financial reporting, insurance coordination, elevator compliance, vendor control, and responsive resident support.',
      brandingTitle: 'The Story House / 36 East 22nd Street',
      brandingDescription: 'Known-property guard: Jackie treats 36 East 22nd Street as a pre-war elevator condominium and uses a verified public building image before Street View fallback.',
      researchSources: [
        'Compass public building profile: The Story House / 36 East 22nd Street',
        'NYC DOF / ACRIS ownership, mortgage, and tax-lot records must be checked before final release',
        'HPD MDR / HPD Online registration, contacts, complaints, and violations',
        'DOB BIS / DOB NOW elevator, permits, OATH/ECB, and complaint records',
        'Board materials, current management agreement, budget, insurance schedule, and prior management report requested for final proposal',
      ],
      currentManagement: CAMELOT_36_EAST_22_MANAGEMENT_TO_VERIFY,
      boardMembers: [
        { name: '36 East 22nd Street condominium board / ownership authority', title: 'Condominium Board / Ownership Authority' },
      ],
      buildingStaff: [
        { role: 'Managing Agent', name: 'To verify through HPD MDR / board records' },
        { role: 'Superintendent / Resident Manager', name: 'On-site staff to verify' },
        { role: 'Elevator service vendor', name: 'Service contract to verify' },
      ],
      professionalSources: [
        'HPD MDR',
        'ACRIS',
        'DOB BIS / DOB NOW',
        'NYC DOF / PROS',
        'PropertyShark',
        'Compass public building profile',
      ],
      professionalNotes: [
        'Do not label 36 East 22nd Street as walk-up. Known profile is pre-war elevator.',
        'Confirm current management, BBL, elevator filings, unit count, and board contact from primary records before board-facing delivery.',
        'Use verified public building image or uploaded property photos before map-only fallback imagery.',
      ],
    };
  }
  if (is279CentralParkWestSubject(key)) {
    return {
      canonicalAddress: '279 Central Park West, New York, NY 10024',
      buildingName: '279 Central Park West',
      borough: 'Manhattan',
      buildingClass: 'R4',
      units: CAMELOT_279_CPW_UNIT_COUNT,
      stories: 23,
      yearBuilt: 1988,
      propertyType: 'Condominium',
      neighborhoodName: 'Upper West Side / Central Park West',
      managementCompany: CAMELOT_279_CPW_MANAGEMENT_TO_VERIFY,
      imageUrls: [
        '/images/279-central-park-west/279-cpw-corner-shot.jpg',
        '/images/279-central-park-west/279-cpw-awning.jpg',
        '/images/279-central-park-west/279-cpw-top-of-building.jpg',
        '/images/279-central-park-west/279-central-park-west.jpg',
      ],
      description: '279 Central Park West is a boutique Central Park West condominium with a high-visibility Upper West Side / Central Park edge position. Jackie treats management as a source-verification item until current board materials or primary public records confirm the managing agent.',
      amenities: [
        'Central Park West frontage / park-edge positioning',
        'Condominium operating profile',
        'Elevator / service access to verify',
        'Doorman / concierge coverage to verify',
        'Superintendent / resident manager coverage to verify',
        'Storage, bike room, alteration, move-in/move-out, insurance, and resident-fee policies to verify',
      ],
      commercialSignals: [
        'No current managing-agent name should be published until verified through HPD MDR, board materials, PropertyShark, ACRIS, or management agreement.',
        'Current management must be verified through board materials or primary public records before publication.',
        'Boutique high-value condominium operations require careful insurance, staff, capital planning, vendor, and resident-service review.',
      ],
      revenueOpportunities: [
        'Move-in/move-out, alteration, resale, refinance, insurance-review, storage, bike, sublet / lease package, and document-fee schedule review.',
        'Insurance renewal, deductible, and carrier requirement review for a Central Park West condominium.',
        'Vendor contract, staffing, lobby/door coverage, cleaning, and preventative maintenance review.',
        'Capital plan, reserve, facade, roof, Local Law, and life-safety compliance calendar review.',
      ],
      landmarks: [
        'Central Park: immediate frontage',
        'West 86th Street subway corridor: nearby',
        'American Museum of Natural History / Theodore Roosevelt Park: nearby',
        'Upper West Side retail and residential corridor: nearby',
        'Central Park West landmark / architectural corridor: nearby',
      ],
      locationTitle: 'Central Park West / Upper West Side Positioning',
      locationCopy: 'The property sits along Central Park West, where park frontage, transit access, architectural visibility, and resident expectations create a premium condominium operating profile.',
      lifestyleTitle: 'Boutique Condominium With High-Service Expectations',
      lifestyleCopy: 'A smaller Central Park West condominium needs polished resident communication, careful vendor oversight, transparent financial reporting, strong insurance coordination, and disciplined compliance management.',
      brandingTitle: '279 Central Park West Condominium Profile',
      brandingDescription: 'Known-property guard: Jackie uses the supplied 279 Central Park West building photographs and verifies management before publication.',
      researchSources: [
        'User-supplied 279 Central Park West building photographs',
        'StreetEasy / Compass / Corcoran / CityRealty-style market profiles for public building identity, units, stories, year, and condominium context',
        'NYC DOF / ACRIS ownership, mortgage, and tax-lot records must be checked before final release',
        'HPD MDR / HPD Online registration, complaints, contacts, and violations',
        'DOB BIS / DOB NOW permits, boiler, facade, OATH/ECB, and complaint records',
        'Board materials, current management agreement, offering plan, insurance schedule, budget, and prior management report requested for final proposal',
      ],
      currentManagement: CAMELOT_279_CPW_MANAGEMENT_TO_VERIFY,
      boardMembers: [
        { name: '279 Central Park West condominium board / ownership authority', title: 'Condominium Board / Ownership Authority' },
      ],
      buildingStaff: [
        { role: 'Managing Agent', name: 'To verify through HPD MDR / board records' },
        { role: 'Doorman / Concierge', name: 'Building service staff to verify' },
        { role: 'Superintendent / Resident Manager', name: 'On-site staff to verify' },
      ],
      professionalSources: [
        'HPD MDR',
        'ACRIS',
        'DOB BIS / DOB NOW',
        'NYC DOF / PROS',
        'PropertyShark',
        'StreetEasy / Compass / Corcoran / CityRealty market-source cross-checks',
      ],
      professionalNotes: [
        'Do not publish a current management company for 279 Central Park West until HPD MDR, board materials, PropertyShark, ACRIS, or the management agreement confirms it.',
        'Use the supplied 279 CPW photo set before Street View, StreetEasy, or placeholder imagery.',
        'Confirm current unit count, BBL, board contact, managing agent, compliance status, and open violations from primary records before board-facing delivery.',
      ],
    };
  }
  if (/201\s+e(ast)?\s+79/i.test(key) || /201\s+east\s+79th/i.test(key)) {
    return {
      canonicalAddress: '201 East 79th Street, New York, NY 10075',
      buildingName: '201 East 79th Street',
      bbl: '1015250001',
      buildingClass: 'D4',
      marketValue: 185000000,
      dofOwner: '201 EAST 79TH STREET TENANTS CORPORATION',
      managementCompany: 'FirstService Residential',
      units: 167,
      stories: 20,
      yearBuilt: 1963,
      propertyType: 'Co-operative',
      neighborhoodName: 'Upper East Side / Yorkville',
      streetEasyUrl: 'https://streeteasy.com/building/201-east-79-street-new_york',
      imageUrls: ['https://www.compass.com/m3/730c7e6eb31608bd02120e3b03fe8dd00c710684.jpg'],
      description: '201 East 79th Street is a full-service Upper East Side cooperative at Third Avenue, originally built in 1963 and publicly described as a 20-story post-war co-op with approximately 160-168 apartments.',
      amenities: [
        'Full-time doorman',
        'Concierge / attended lobby',
        'Resident manager / superintendent to verify',
        'Elevator',
        'Parking garage',
        'Bike room',
        'Laundry room',
        'Private storage',
        'Garden / shared outdoor space',
      ],
      commercialSignals: [
        'Ground-floor retail / commercial component reported by Rogers Partners project profile; verify tenants and leases before publication.',
        'Parking garage signal; verify operator, license, insurance, and revenue treatment.',
      ],
      revenueOpportunities: [
        'Retail lease abstract and insurance review.',
        'Parking garage operator / license / revenue review.',
        'Storage, bike room, alteration, sublet, move-in/move-out, and amenity-fee schedule review.',
      ],
      landmarks: [
        'Third Avenue retail corridor: immediate',
        'Q train at 72nd/83rd Street corridor: nearby',
        '6 train at 77th Street / Lexington Avenue: nearby',
        'Central Park and Museum Mile: nearby',
        'Upper East Side medical and school corridor: nearby',
      ],
      locationTitle: 'Upper East Side / Yorkville Corner Position',
      locationCopy: 'The building sits at East 79th Street and Third Avenue, a full-block post-war co-op position with strong retail frontage, transit access, and mature Upper East Side demand fundamentals.',
      lifestyleTitle: 'Full-Service Co-op With Capital Upgrade Story',
      lifestyleCopy: 'Doorman service, garage, storage, bike room, laundry, garden/outdoor space, and a major facade modernization story should anchor the board-facing narrative.',
      brandingTitle: '201 East 79th Street Building Profile',
      brandingDescription: 'StreetEasy, Rogers Partners, building-profile sources, Compass, Corcoran, and Elegran identify 201 East 79th Street as an Upper East Side/Yorkville cooperative, not a two-family dwelling.',
      researchSources: [
        'Official building site: https://www.201east79th.com/',
        'StreetEasy building page: https://streeteasy.com/building/201-east-79-street-new_york',
        'Rogers Partners project profile: https://www.rogersarchitects.com/201-e-79th-street/',
        'Compass building/listing imagery and listings',
        'Corcoran / Elegran / CityRealty-style market profiles',
        'NYC DOF, ACRIS, HPD MDR, DOB BIS/NOW, OATH/ECB, PROS, and PropertyShark must be checked before board-facing release',
      ],
      currentManagement: 'FirstService Residential (verify current managing-agent record against HPD MDR / board materials before board-facing release)',
      boardMembers: [
        { name: '201 East 79th Street Tenants Corporation', title: 'Co-op Corporation / Ownership Authority' },
      ],
      buildingStaff: [
        { role: 'Full-time Doorman', name: 'Building service staff to verify' },
        { role: 'Resident Manager / Superintendent', name: 'On-site staff to verify' },
        { role: 'Managing Agent', name: 'FirstService Residential' },
      ],
      professionalSources: [
        'StreetEasy / Rogers Partners / Compass / Corcoran / Elegran cross-check for units, floors, year, amenities, and capital work',
        'NYC DOB violations and permit data: https://www.nyc.gov/site/buildings/dob/find-building-data.page',
        'NYC DOB violations guidance: https://www.nyc.gov/site/buildings/safety/dob-violations.page',
        'PropertyShark search: https://www.propertyshark.com/mason/ny/New-York-City/Property-Search',
        'NYC PROS / DOF property tax and assessment portal: https://a806-pros.nyc.gov/PROS/',
        'PublicRecordsData / NeighborWho can be used only as secondary cross-checks, not final authority',
      ],
      professionalNotes: [
        'Public sources vary around 160, 167, and 168 units and 20-21 floors; Camelot uses 167 units and 20 floors unless offering-plan or board records confirm otherwise.',
        'If NYC lookup returns Brooklyn BBL 3062630070, Camelot rejects that record as an address-resolution mismatch for the Manhattan 201 East 79th Street report.',
      ],
    };
  }
  if (/37[-\s]?40\s+85th|37[-\s]?34\s+85th|85th\s+st.*jackson\s+heights|85th\s+street.*11372/i.test(key)) {
    return {
      canonicalAddress: '37-34 85th Street, Jackson Heights, NY 11372',
      buildingName: 'Lyndon Court',
      borough: 'Queens',
      buildingArea: 18900,
      units: 18,
      stories: 4,
      yearBuilt: 1921,
      propertyType: 'Walk-up cooperative',
      neighborhoodName: 'Jackson Heights',
      imageUrls: [
        '/images/37-40-85th/front-door.jpg',
        '/images/37-40-85th/85th-street.jpg',
        '/images/37-40-85th/rear-building-garden.jpg',
        '/images/37-40-85th/rear-garden.jpg',
        '/images/37-40-85th/red-brick-garages.jpg',
        '/images/37-40-85th/street-view-context.png',
      ],
      description: 'Lyndon Court at 37-34 85th Street is a small pre-war Jackson Heights walk-up cooperative with garden-style operating considerations, common exterior areas, historic-district sensitivity, and a scope that requires hands-on accounting, board support, vendor oversight, superintendent coverage review, refinancing preparation, and maintenance coordination.',
      amenities: [
        'Pre-war brick residential setting',
        'Jackson Heights Historic District setting',
        'Shared rear garden / courtyard context',
        'Resident entrance and front-door condition to verify',
        'Garages / parking context to verify',
        'Superintendent / building staff support to verify',
        'Laundry, storage, sublet, alteration, and transfer policies to verify',
      ],
      commercialSignals: [
        'No commercial tenant roster should be published until verified through offering plan, signage, PropertyShark, ACRIS, HPD MDR, or board records.',
        'Small co-op governance, accounting controls, maintenance collection, and superintendent payroll support are the primary operating signals.',
        'Public records conflict on unit count: HPD / PropertyShark-style materials show 18 Class A units while DOF-style residential count may show 17; reconcile during transition.',
        'PropertyShark-style materials indicate 8 HPD violations and prior mortgage-related documents; verify current status from HPD, ACRIS, DOB, and board records before publishing as final diligence.',
      ],
      revenueOpportunities: [
        'Parking fee review and garage / parking policy update where permitted by governing documents.',
        'Washer / dryer or laundry revenue review, including vendor economics and shareholder convenience.',
        'Move-in/move-out, sales package, alteration, sublet, refinancing, closing, and document fee schedule review.',
        'Insurance rebid, deductible review, and vendor pricing comparison to reduce controllable operating costs.',
        'Vendor rebidding for repairs, supplies, extermination, landscaping, snow and seasonal work.',
        'Mortgage refinancing preparation and lender package coordination with Camelot accounting support.',
        'Preventive maintenance calendar, arrears workflow, attorney coordination, and accountant/tax package process.',
      ],
      landmarks: [
        'Jackson Heights Historic District / garden apartment context: nearby',
        'Travers Park and 78th Street Plaza: nearby',
        'Roosevelt Avenue / 74th Street-Broadway transit hub: nearby',
        '37th Avenue retail corridor: nearby',
        'Queens Boulevard and Northern Boulevard access: nearby',
      ],
      locationTitle: 'Jackson Heights Garden Co-op Positioning',
      locationCopy: 'The property sits in the Jackson Heights residential market, where garden-style co-op character, transit access, and local vendor responsiveness are central to resident experience and long-term value.',
      lifestyleTitle: 'Small Co-op Governance, Accounting & Service Discipline',
      lifestyleCopy: 'An approximately 17- to 18-unit co-op needs clean monthly financials, maintenance collection discipline, superintendent/payroll coordination, vendor oversight, attorney/accountant cooperation, and practical repairs management without large-firm overhead.',
      brandingTitle: 'Lyndon Court Jackson Heights Co-op Profile',
      brandingDescription: 'Known-property guard: Jackie treats Lyndon Court at 37-34 85th Street as an approximately 17- to 18-unit Jackson Heights walk-up co-op and uses uploaded building photos before Google fallback.',
      researchSources: [
        'User-uploaded Lyndon Court / 37-34 85th Street property photographs',
        'PropertyShark report supplied by Camelot for 37-34 85th St, Jackson Heights, NY 11372',
        'NYC DOF / ACRIS ownership, mortgage, and tax-lot records',
        'HPD MDR / HPD Online registration, complaints, and violations',
        'DOB BIS / DOB NOW permits, boiler, gas, facade, OATH/ECB and complaint records',
        'Offering plan, proprietary lease, building questionnaire, board records, current budget, prior management report, and audited financials requested before formal proposal',
      ],
      currentManagement: 'Garden Heights Property Management appears in records; verify against HPD MDR, PropertyShark, board materials, and current management agreement',
      boardMembers: [
        { name: 'Samantha Hosein', title: 'Board member / shareholder contact' },
        { name: 'Lyndon Court board / ownership authority', title: 'Co-op Board / Ownership Authority' },
      ],
      buildingStaff: [
        { role: 'Managing Agent', name: 'Garden Heights Property Management appears in records; verify' },
        { role: 'Superintendent / building staff', name: 'Payroll, workers comp, and staffing coverage to verify' },
      ],
      professionalSources: [
        'HPD MDR',
        'ACRIS',
        'DOB BIS / DOB NOW',
        'NYC DOF / PROS',
        'PropertyShark report supplied by Camelot',
        'Co-op attorney, accountant, budget, audit, and prior managing-agent records',
      ],
      professionalNotes: [
        'Formal proposal should be priced after reviewing prior management report, audited financials or latest budget, staffing, arrears, attorney/accountant needs, and requested service cadence.',
        'Primary scope includes billing and collecting maintenance, bill payment, vendor invoice review, bookkeeping, monthly and annual financial reports, lawyer/accountant cooperation, superintendent payroll/workers comp support, and arranging repairs.',
        'May 2026 board discussion notes: Samantha Hosein is evaluating management options for Lyndon Court after a period of heavy capital projects and board fatigue; final decisions rest with the board.',
        'The board asked for a detailed fee menu / Schedule B1-style summary, at least five references, Local Law 11 / compliance information, and guidance around refinancing preparation.',
        'Known budget pressures to review include two mortgages totaling approximately $2M at roughly 4%-5%, a future refinance window, and a tax abatement scheduled to expire at year-end.',
        'Operating opportunities discussed include parking fee increases, washer/dryer or laundry revenue, insurance bidding / deductible review, vendor pricing, and possible assessment planning.',
        'Staffing issue to evaluate: the building has not had a consistent on-site superintendent for a long time; Camelot should assess whether porter, handyman, or superintendent support is the right fit.',
        'Suggested pricing: Lean Base $1,500/month, Recommended $1,750/month, Enhanced Transition $2,000/month for first 90 days then $1,750/month, plus a $1,500 onboarding fee that may be credited if the board approves within 30 days and provides complete transition records.',
      ],
    };
  }
  if (/88[-\s]?32\s+155th|88[-\s]?02\s+155th|88[-\s]?06\s+155th|88[-\s]?10\s+155th|155[-\s]?22\s+89th|155[-\s]?24\s+89th|howard\s+coop|howard\s+cooperative|lindenwood/i.test(key)) {
    return {
      canonicalAddress: '88-32 155th Ave, Howard Beach, NY 11414',
      buildingName: 'Howard Coop Corp.',
      borough: 'Queens',
      bbl: '4114660025',
      buildingClass: 'C6',
      taxClass: '2',
      buildingArea: 74104,
      lotArea: 170300,
      marketValue: 5506000,
      assessedValue: 2477700,
      propertyTax: 202245,
      latitude: 40.66535,
      longitude: -73.84604,
      dofOwner: 'Howard Coop Corp.',
      managementCompany: 'Delkap Management',
      units: 80,
      alternateUnits: 86,
      stories: 2,
      yearBuilt: 1958,
      propertyType: 'Walk-up Cooperative Building',
      energyStarScore: 47,
      hpdViolationsTotal: 86,
      hpdViolationsOpen: 86,
      dobViolationCount: 4,
      lastSaleDate: '08/04/2004',
      lastSalePrice: 0,
      lastSaleBuyer: 'Howard Coop Corp.',
      lastSaleSeller: null,
      neighborhoodName: 'Lindenwood / Howard Beach',
      description: 'Howard Coop Corp. at 88-32 155th Avenue is a multi-building walk-up cooperative in the Lindenwood / Howard Beach section of Queens. The uploaded PropertyShark-style report identifies the property as a 23-building lot with a large garden-apartment operating profile, a current DOF residential count of 80 units, and a separate report reference to 86 units that must be reconciled during transition.',
      amenities: [
        'Multi-building garden-apartment cooperative setting',
        'Two-story walk-up operating profile',
        'Large 170,300 sq. ft. lot with common-area and grounds oversight needs',
        'Parking, laundry, storage, superintendent, and resident-service programs to verify',
        'Energy Star score 47; utility and efficiency review recommended',
      ],
      commercialSignals: [
        'Unit-count conflict: DOF/residential data shows 80 units while the uploaded report narrative references 86 units; reconcile against board records, proprietary lease/share register, HPD, DOF, and offering-plan records.',
        'Owner record: Howard Coop Corp.; care-of address and management trail point to Delkap Management records in the uploaded report.',
        'Public-record operating signal: uploaded report shows 86 HPD violations and 4 DOB violations; verify open/closed status directly through HPD Online, DOB BIS/NOW, and OATH/ECB before board-facing release.',
        'Large site / FAR context: R5 zoning, current FAR about 0.44, max buildable area reported at 255,450 sq. ft., and reported buildable area about 180,518 sq. ft.; treat as planning context only until confirmed by zoning counsel or architect.',
      ],
      revenueOpportunities: [
        'Maintenance billing, arrears, shareholder communication, and financial reporting review for a multi-building co-op.',
        'Grounds, landscaping, snow, exterior maintenance, insurance, and vendor contract rebid.',
        'Energy benchmarking and utility review given Energy Star score of 47.',
        'Parking, laundry, storage, alteration, transfer, sublet, refinancing, closing, and document fee schedule review.',
        'Compliance calendar for HPD, DOB, boiler, fire/life-safety, facade/FISP applicability, lead paint, and insurance inspection items.',
        'Capital planning and lender-readiness review if the board is evaluating refinancing, reserve planning, or credit-line options.',
      ],
      landmarks: [
        'Lindenwood / Howard Beach residential co-op corridor: immediate area',
        'JFK Airport employment and transportation market: nearby',
        'Howard Beach / Cross Bay Boulevard retail and service corridor: nearby',
        'Belt Parkway and Cross Bay Boulevard access: nearby',
        'Queens Community District 10 context: source record',
      ],
      locationTitle: 'Lindenwood / Howard Beach Cooperative Positioning',
      locationCopy: 'The property sits in Queens Community District 10 within the Lindenwood / Howard Beach co-op market, where grounds management, resident communication, insurance, compliance, and cost controls matter as much as monthly accounting.',
      lifestyleTitle: 'Multi-Building Co-op Operations With Compliance Discipline',
      lifestyleCopy: 'A 23-building, two-story cooperative requires stronger file control, vendor supervision, violation tracking, grounds oversight, and board reporting than a single-entry building of similar unit count.',
      brandingTitle: 'Howard Coop Corp. - 88-32 155th Avenue',
      brandingDescription: 'Known-property guard: Jackie uses the uploaded 88-32 155th Avenue report as the source profile, flags the 80-vs-86 unit-count conflict, and treats Delkap Management and Howard Coop Corp. records as source leads to verify before client-facing release.',
      imageUrls: [
        '/images/howard-coop/155-22-89th-st-front.jpg',
        '/images/howard-coop/155-22-89th-st-community.jpeg',
        '/images/howard-coop/155-24-89th-st-aerial.jpeg',
        '/images/howard-coop/155-24-89th-st-red-door.jpeg',
        '/images/howard-coop/155-24-89th-st-front.jpeg',
        '/images/howard-coop/155-24-89th-st-front-side.jpeg',
      ],
      researchSources: [
        'Uploaded PropertyShark-style report: 88-32_155th_Ave__Howard_Beach__NY_11414.pdf, generated May 23, 2026',
        'Camelot-uploaded 155-22 / 155-24 89th Street Lindenwood / Howard Beach property photo set',
        'NYC DOF / PROS tax, assessment, exemption, abatement, and lien records for BBL 4114660025',
        'ACRIS official deed, mortgage, UCC, satisfaction, assignment, release, and party records for BBL 4114660025',
        'HPD MDR / HPD Online registration, contacts, complaints, and violations for Howard Coop Corp. / 88-32 155th Ave',
        'DOB BIS / DOB NOW permits, boiler, facade/FISP, OATH/ECB, complaint, and violation records',
        'Offering plan, proprietary lease, shareholder roster, board records, current budget, insurance, vendor files, and prior management reports requested before formal proposal',
      ],
      currentManagement: 'Delkap Management appears in the uploaded report; verify current authority against HPD MDR, board materials, and the active management agreement',
      boardMembers: [
        { name: 'Howard Coop Corp.', title: 'Co-op Corporation / Ownership Authority' },
        { name: 'Paula Palazzo', title: 'Officer contact in uploaded HPD registration trail - verify before outreach' },
        { name: 'Barbara McNamara', title: 'Head officer contact in uploaded HPD registration trail - verify before outreach' },
      ],
      buildingStaff: [
        { role: 'Managing Agent', name: 'Allison Nero / Delkap Management (uploaded HPD registration trail; verify current status)' },
        { role: 'Current Management Company', name: 'Delkap Management' },
        { role: 'Building staff / superintendent', name: 'Staffing model to verify during transition diligence' },
      ],
      professionalEngineers: [
        { name: 'Neal Rudikoff', title: 'Professional engineer / applicant signal from uploaded permit trail', license: 'Verify against DOB filings' },
      ],
      professionalSources: [
        'Uploaded PropertyShark-style report pages for ownership, HPD contacts, DOB contacts, violations, tax, sales, assessment, zoning, and document history',
        'NYC DOF / PROS',
        'ACRIS',
        'HPD MDR / HPD Online',
        'DOB BIS / DOB NOW',
        'OATH / ECB',
      ],
      professionalNotes: [
        'Primary identity: Howard Coop Corp., 88-32 155th Ave, Howard Beach, NY 11414; alternate addresses in the uploaded report include 88-02, 88-06, and 88-10 155th Ave, while the uploaded property photo set references 155-22 and 155-24 89th Street in the same Lindenwood / Howard Beach cooperative context.',
        'BBL: 4114660025; block/lot reported as 11466-0025; coop number 400929.',
        'Unit-count conflict: DOF/residential data shows 80 units while the uploaded report narrative references 86 units. Jackie must show this as a reconciliation item, not silently choose one in final diligence.',
        'Uploaded report identifies 23 buildings on the lot, 2 stories, 1958 construction, 74,104 residential square feet, 170,300 lot square feet, R5 zoning, Community District 10, School District 27, Census Tract 62, and Energy Star score 47.',
        'Uploaded report shows 86 HPD violations and 4 DOB violations. Before a client-facing pitch, confirm current open/closed counts and any penalty balances through HPD Online, DOB BIS/NOW, and OATH/ECB.',
        'Owner / management trail: Howard Coop Corp. C/O Delkap Management; managing-agent contact trail includes Allison Nero / Delkap Management, 15921 Crossbay Blvd, Howard Beach, NY 11414.',
        'Uploaded report shows 2025/26 market value $5,506,000, assessed value $2,477,700, taxable assessed value $2,077,506, tax rate 12.439%, and property tax about $202,245.',
        'Recent unit-sale trail in uploaded report includes Unit 62 at $235,000 on 03/02/2026, Unit 71 at $330,000 on 10/23/2025, Unit 6 at $205,000 on 02/28/2025, Unit 60 at $310,000 on 05/30/2024, and Unit 24 at $270,000 on 05/23/2024.',
        'Document-history signal includes 2023 UCC/satisfaction/release records and 2012 mortgage / assignment of leases and rents records involving Howard Cooperative Corp.; verify directly through ACRIS before publishing financing conclusions.',
      ],
    };
  }
  if (/chesapeake\s+house/i.test(key) || /201\s+e(ast)?\s+28/i.test(key)) {
    return {
      canonicalAddress: '201 East 28th Street, New York, NY 10016',
      buildingName: 'The Chesapeake House',
      units: 252,
      stories: 20,
      yearBuilt: 1964,
      propertyType: 'Co-operative',
      neighborhoodName: 'Kips Bay',
      streetEasyUrl: 'https://streeteasy.com/building/the-chesapeake-house',
      description: 'The Chesapeake House is a full-service post-war cooperative at 201 East 28th Street near Third Avenue, with doorman service, live-in superintendent, garage/parking, roof deck, laundry, and elevator service.',
      amenities: [
        'Full-time doorman',
        'Live-in superintendent',
        'Elevator',
        'Parking garage',
        'Roof deck',
        'Laundry room',
        'Bike room / bicycle room',
        'Concierge / staff service to verify',
        'Pet-friendly policy reported by market sources',
      ],
      commercialSignals: [
        'Parking garage component reported by market sources; verify operator, license, insurance, and revenue treatment.',
        'No commercial tenant names should be published until confirmed through offering plan, signage, management records, or board materials.',
      ],
      revenueOpportunities: [
        'Garage / parking operator review.',
        'Bike room, laundry, move-in/move-out, sublet, alteration, and roof-deck policy review.',
        'Resident service, amenity, and recoverable-fee schedule review.',
      ],
      landmarks: [
        'Third Avenue retail corridor: immediate area',
        '6 train at 28th Street: nearby',
        'Madison Square Park / NoMad: nearby',
        'Kips Bay medical and residential corridor: nearby',
        'Gramercy / Rose Hill neighborhood anchors: nearby',
      ],
      locationTitle: 'Kips Bay / Rose Hill Positioning',
      locationCopy: 'The Chesapeake House sits at East 28th Street near Third Avenue, combining Midtown access, residential scale, and transit convenience.',
      lifestyleTitle: 'Full-Service Co-op Operations',
      lifestyleCopy: 'Doorman service, live-in superintendent coverage, roof deck, garage/parking, laundry, and elevator service create a full-service operating profile that deserves accurate board-facing management analysis.',
      brandingTitle: 'The Chesapeake House on StreetEasy',
      brandingDescription: 'Market sources identify The Chesapeake House as a 20-story post-war cooperative at 201 East 28th Street with approximately 252 residences and 1964/1966 construction references.',
      researchSources: [
        'StreetEasy building page: https://streeteasy.com/building/the-chesapeake-house',
        'Corcoran building profile for Chesapeake House',
        'NYBits building profile: https://www.nybits.com/apartments/201_east_28th_st.html',
        'Yoreevo building profile for The Chesapeake House',
        'CityRealty building profile for The Chesapeake House',
        'DOF / ACRIS / HPD MDR / offering plan should be checked before board-facing release',
      ],
      currentManagement: 'Managing agent to verify through HPD MDR, board materials, and management agreement',
      boardMembers: [
        { name: 'The Chesapeake House', title: 'Co-op Board / Ownership Authority' },
      ],
      buildingStaff: [
        { role: 'Full-time Doorman', name: 'Building service staff to verify' },
        { role: 'Live-in Superintendent', name: 'On-site staff to verify' },
        { role: 'Managing Agent', name: 'To verify through HPD MDR / board records' },
      ],
      professionalSources: [
        'StreetEasy / Corcoran / NYBits / Yoreevo / CityRealty cross-check for units, stories, year, and amenities',
        'HPD MDR, ACRIS, DOB, DOF, and offering plan must be checked before publishing private contact names',
      ],
      professionalNotes: [
        'Public sources vary between approximately 248, 252, and 285 units; Camelot uses 252 as the conservative market-source count unless board/offering-plan records confirm a different count.',
      ],
    };
  }
  if (hasExact22East22Subject(address, candidateName)) {
    return {
      canonicalAddress: '22 East 22nd Street, New York, NY 10010',
      buildingName: '22 East 22nd Street',
      units: 19,
      stories: 6,
      yearBuilt: 1900,
      propertyType: 'Co-operative / Tenancy-in-Common',
      neighborhoodName: 'Flatiron / Madison Square',
      dofOwner: 'WO Realty LLC (reported owner; verify against NYC DOF and ACRIS before board-facing release)',
      imageUrls: ['https://camelot-scout-v6.onrender.com/images/22-east-22nd/22East22ndStreet_NYC.jpg'],
      description: '22 East 22nd Street is a small pre-war residential building in the Flatiron / Madison Square market. Camelot treats the property as a 19-unit co-op or tenancy-in-common candidate unless board, offering-plan, land-record, or ownership records confirm a different legal structure.',
      amenities: [
        'Pre-war walk-up operating profile',
        'Board / ownership records to verify',
        'Superintendent / porter coverage to verify',
        'Laundry, storage, roof, basement, and common-area use to verify',
      ],
      commercialSignals: [
        'No commercial tenant roster should be published until verified through signage, offering-plan records, ACRIS, PropertyShark, or board materials.',
        'Small-building co-op / TIC structure requires ownership and governance confirmation before board-facing release.',
      ],
      revenueOpportunities: [
        'Laundry, storage, alteration, sublet, move-in/move-out, application, and resale package fee schedule review.',
        'Vendor rebidding and preventive maintenance schedule review for a small pre-war building.',
        'Insurance, facade, roof, Local Law, boiler, and life-safety compliance review.',
      ],
      landmarks: [
        'Madison Square Park: nearby',
        'Flatiron Building / Ladies Mile Historic District context: nearby',
        '23rd Street subway corridor: nearby',
        'Broadway / Fifth Avenue retail and office corridor: immediate area',
        'Union Square / NoMad / Gramercy residential market: nearby',
      ],
      locationTitle: 'Flatiron / Madison Square Positioning',
      locationCopy: 'The property sits in a high-demand Manhattan residential and mixed-use corridor near Madison Square Park, Fifth Avenue, Broadway, and the 23rd Street transit spine.',
      lifestyleTitle: 'Small-Building Governance & Cost Control',
      lifestyleCopy: 'A 19-unit co-op or TIC-style ownership profile needs precise governance records, disciplined cost control, and practical compliance planning rather than large-building assumptions.',
      brandingTitle: '22 East 22nd Street Small-Building Profile',
      brandingDescription: 'Known-property guard: Jackie must not treat 22 East 22nd Street as the larger neighboring East 22nd Street rental profile. Use 19 units and co-op / tenancy-in-common review language until source documents confirm otherwise.',
      researchSources: [
        'User-provided property identity correction: 19-unit co-op or tenancy-in-common candidate',
        'User-provided ownership lead: WO Realty LLC; confirm via NYC DOF property tax records, ACRIS deed/mortgage filings, and PropertyShark before final release',
        'NYC DOF / ACRIS ownership and tax-lot records must be cross-checked for legal ownership structure',
        'HPD MDR / DOB / HPD Online / OATH-ECB / DOF / ACRIS / PropertyShark source stack should be reviewed before board-facing release',
        'Offering plan, proprietary lease, TIC agreement, board records, or bank questionnaire should be requested for final unit count and governance confirmation',
      ],
      currentManagement: 'Management to verify through board materials, HPD MDR, ACRIS, PropertyShark, and building records',
      boardMembers: [
        { name: 'WO Realty LLC', title: 'Reported owner / ownership lead to verify via NYC DOF and ACRIS' },
        { name: '22 East 22nd Street ownership / board authority', title: 'Co-op / TIC governance to verify' },
      ],
      buildingStaff: [
        { role: 'Managing Agent', name: 'To verify through HPD MDR / board records' },
        { role: 'Superintendent / Porter', name: 'Building staff coverage to verify' },
      ],
      professionalSources: [
        'ACRIS deed, mortgage, UCC, lien, and ownership-document review',
        'NYC DOB BIS/NOW permits, complaints, facade, boiler, elevator, and OATH/ECB records',
        'HPD Online registration, complaints, violations, and MDR contact records',
        'DOF property tax, abatements, liens, and assessment records',
        'Offering plan / bank questionnaire / board records for final governance structure',
      ],
      professionalNotes: [
        'Public systems can confuse tax-lot, energy, HPD, and ownership signals for small Manhattan buildings. Jackie must use the known 19-unit profile unless primary source records prove otherwise.',
        'Do not publish the property as 122 units or as a conventional large walk-up apartment building.',
      ],
    };
  }
  if (/corinthian/i.test(key) || /330\s+e(ast)?\s+38/i.test(key) || /38th?.*(1st|first)\s+ave/i.test(key)) {
    return {
      canonicalAddress: '330 East 38th Street, New York, NY 10016',
      buildingName: 'The Corinthian',
      units: 817,
      stories: 57,
      yearBuilt: 1989,
      propertyType: 'Luxury Condominium',
      neighborhoodName: 'Murray Hill',
      officialWebsite: 'https://thecorinthiannyc.com/',
      streetEasyUrl: 'https://streeteasy.com/building/the-corinthian',
      imageUrls: [
        'https://thecorinthiannyc.com/img/The-Corinthian-building-NYC-Condos.jpg',
      ],
      description: 'The Corinthian is a full-block Murray Hill condominium at 330 East 38th Street, known for its rounded bay-window architecture, white-glove service, major amenity package, and large-scale residential/commercial program.',
      amenities: [
        '24-hour doorman and concierge service',
        'Fitness center / gym',
        'Indoor swimming pool',
        'Sun deck / roof deck',
        'Running track',
        'Golf simulator',
        'Billiard room / party room',
        'Children\'s playroom',
        'Valet service',
        'Parking garage',
        'Storage',
        'Bike room',
        'Laundry',
        'Live-in superintendent / building staff to verify',
      ],
      commercialSignals: [
        'Commercial office / retail component reported by market sources; verify tenant roster, leases, signage, and offering-plan allocations before publishing tenant names.',
        'Parking garage component reported by market sources; verify garage operator, license, insurance, access rights, and revenue treatment.',
        'Large amenity and service program requires review of rules, waivers, staffing, vendor contracts, and recoverable fee schedule.',
      ],
      revenueOpportunities: [
        'Parking garage operator / license review.',
        'Storage, bike room, valet, move-in/move-out, alteration, and amenity-fee schedule review.',
        'Commercial office/retail rent, escalation, insurance, and CAM allocation review.',
        'Amenity vendor, staffing, and resident-access policy audit.',
      ],
      landmarks: [
        'East River waterfront: nearby',
        'NYU Langone Medical Center: nearby',
        'Grand Central / Midtown transit: nearby',
        'Murray Hill residential core: immediate neighborhood',
        'FDR Drive / Queens-Midtown Tunnel access: nearby',
        'United Nations / Midtown East office district: nearby',
      ],
      locationTitle: 'Murray Hill East River Positioning',
      locationCopy: 'The Corinthian occupies a full-block position near First Avenue and East 38th Street, with strong East Side access, medical/institutional anchors, and Midtown connectivity.',
      lifestyleTitle: 'Scale, Amenities & Liquidity',
      lifestyleCopy: 'The building’s large unit count, white-glove staffing, garage, pool, fitness, roof and entertainment amenities create a full-service residential experience that supports resale, leasing, and board expectations.',
      brandingTitle: 'The Corinthian NYC',
      brandingDescription: 'The official Corinthian website and market building profiles identify The Corinthian as a 330 East 38th Street condominium in Murray Hill with 817 units, 57 stories, 1989 construction, Rose Associates management, Bernard Spitzer development, and Michael Schimenti / Der Scutt Architects design attribution.',
      researchSources: [
        'Official building website: https://thecorinthiannyc.com/',
        'Official building image: https://thecorinthiannyc.com/img/The-Corinthian-building-NYC-Condos.jpg',
        'StreetEasy building page: https://streeteasy.com/building/the-corinthian',
        'NYBits building profile: https://www.nybits.com/apartments/the_corinthian.html',
        'Corcoran building profile for The Corinthian',
        'PropertyClub building profile for The Corinthian',
        'Compass building profile for The Corinthian',
        'LoopNet / CoStar / PropertyShark / NYC parking-source review required before publishing commercial tenant names',
      ],
      currentManagement: 'Rose Associates (reported by StreetEasy; verify against HPD MDR, board materials, and management agreement)',
      boardMembers: [
        { name: 'The Corinthian Condominium', title: 'Board of Managers / Ownership Authority' },
      ],
      buildingStaff: [
        { role: 'Managing Agent', name: 'Rose Associates (reported by StreetEasy; verify)' },
        { role: '24-hour Doorman / Concierge', name: 'Building service staff to verify' },
        { role: 'Live-in Superintendent / Resident Manager', name: 'On-site staff to verify' },
      ],
      professionalArchitects: [
        { name: 'Michael Schimenti / Der Scutt Architects', title: 'Architect attribution from market sources', license: 'Verify against offering plan / DOB filings' },
      ],
      professionalSources: [
        'StreetEasy: management team, developer, architect, district, units/stories/year',
        'NYBits: structure, amenities, office space, parking/storage signals',
        'PropertyClub: commercial office/retail square footage and parking garage signal',
        'Corcoran / Compass / Brownstoner: amenities and unit/story/year cross-check',
        'HPD MDR, ACRIS, DOB, DOF, offering plan, and board materials must be checked before publishing private contact names',
      ],
      professionalNotes: [
        'Conflicting public unit counts exist (817, 831, 840); Camelot uses StreetEasy/Compass 817 unless board or offering-plan records confirm otherwise.',
        'Commercial office/retail and garage details should be verified before naming tenants/operators.',
      ],
    };
  }
  if (/345\s+w(est)?\s+58/i.test(key) || /345\s+west\s+58th/i.test(key)) {
    return {
      canonicalAddress: '345 West 58th Street, New York, NY 10019',
      buildingName: '345 West 58th Street',
      managementCompany: 'AKAM',
      neighborhoodName: 'Midtown West / Columbus Circle',
      description: '345 West 58th Street is a Midtown West residential property near Columbus Circle. Jackie treats AKAM as current management context, not as part of the subject property name.',
      researchSources: [
        'Known-property display-name guard: AKAM is current management context, not building name',
        'HPD MDR / DOF / DOB / ACRIS records should be checked for verified board, staff, and management details before board-facing release',
      ],
      professionalNotes: [
        'Do not include AKAM in the report title or building name for this subject property.',
      ],
    };
  }
  if (/1280\s+(fifth|5th)/i.test(key) || /one\s+museum\s+mile/i.test(key)) {
    return {
      buildingName: 'One Museum Mile',
      units: 116,
      stories: 19,
      yearBuilt: 2012,
      propertyType: 'Luxury Condominium',
      neighborhoodName: 'Museum Mile / Upper Fifth Avenue',
      streetEasyUrl: 'https://streeteasy.com/building/one-museum-mile',
      description: 'One Museum Mile is a Fifth Avenue condominium along Central Park, designed by Robert A.M. Stern with interiors by Andre Kikoski and a full lifestyle amenity program.',
      imageUrls: [
        './images/one-museum-mile/building-picture.webp',
        './images/one-museum-mile/lobby-entrance.webp',
        './images/one-museum-mile/lobby.webp',
        './images/one-museum-mile/rooftop-pool.webp',
        './images/one-museum-mile/rooftop-pool-2.webp',
        './images/one-museum-mile/roof-deck-central-park.webp',
        './images/one-museum-mile/roof-deck-skyline.webp',
        './images/one-museum-mile/gym.webp',
      ],
      amenities: [
        'Landscaped roof deck with outdoor heated pool',
        'Rooftop lounge facing Central Park',
        'Residents’ lounge with fireplace',
        'Fitness center with terrace',
        'Children’s playroom with window wall to fitness center',
        'Game room',
        'Formal dining room facing Central Park with fully equipped catering kitchen',
        'Media lounge',
        'Card room',
        'Bicycle storage',
        'Cold storage',
        'Full-time concierge',
        'Peak-time door person coverage',
        'On-site resident manager',
        'On-site garage parking available for purchase',
        'Pet-friendly building',
        '44-foot alabaster-inspired art glass lobby wall by Andre Kikoski and Weil Studio',
      ],
      commercialSignals: [
        'On-site garage / parking component: confirm ownership, license structure, insurance, and revenue treatment.',
        'Museum for African Art base / cultural component: confirm operating agreements, access boundaries, and owner responsibilities.',
        'No retail or office tenant should be published until confirmed through offering plan, signage walk-through, and building records.',
      ],
      revenueOpportunities: [
        'Parking garage license, purchase inventory, and insurance review.',
        'Bicycle storage, cold storage, and storage cage inventory / waitlist review.',
        'Amenity booking rules, waivers, deposit schedules, and damage-charge controls.',
        'Move-in / move-out, pet, package, and private-event fee policy review.',
        'Confirm any LoopNet, CoStar, PropertyShark, DOT/DOB garage, or parking-operator signal before publishing commercial tenant claims.',
      ],
      landmarks: [
        'Museum of African Art: in building',
        'El Museo del Barrio: 1 block',
        'Central Park / Harlem Meer: across street',
        'Mount Sinai Medical Center: nearby',
        'Guggenheim Museum: Museum Mile',
        'Conservatory Garden: steps away',
      ],
      locationTitle: 'Crown of Museum Mile',
      locationCopy: 'Northeast corner of Central Park at Duke Ellington Circle. One Museum Mile combines Fifth Avenue visibility, Central Park adjacency, and cultural-neighborhood fundamentals that support long-term owner value.',
      lifestyleTitle: 'Lifestyle & Liquidity',
      lifestyleCopy: 'Steps from Central Park, Harlem Meer, the Conservatory Garden, El Museo del Barrio, and Upper Fifth Avenue cultural anchors. The building’s amenity package and park-facing roof experience are core parts of its resident value story.',
      brandingTitle: 'One Museum Mile on StreetEasy',
      brandingDescription: 'StreetEasy confirms the One Museum Mile building profile, architect/interior design pedigree, East Harlem location, 19 stories, 2012 completion, and amenity-rich condominium positioning. Camelot owner-supplied materials remain the authority for the 116-unit count.',
      researchSources: [
        'Camelot owner-supplied One Museum Mile reference materials',
        'StreetEasy building page: https://streeteasy.com/building/one-museum-mile',
        'LoopNet / CoStar / PropertyShark / NYC parking-source review required before publishing any commercial tenant name',
        'Verified One Museum Mile asset library',
      ],
      currentManagement: 'Board of Managers with on-site resident management team; managing-agent record to verify',
      boardMembers: [
        { name: 'One Museum Mile Condominium', title: 'Board of Managers / Ownership Authority' },
      ],
      buildingStaff: [
        { role: 'Live-in Resident Manager (non-union)', name: 'On-site resident manager' },
        { role: 'Building Porter', name: 'Porter staff' },
        { role: 'Full-time Concierge', name: 'Concierge desk' },
        { role: 'Peak-time Doorperson Coverage', name: 'Door staff' },
      ],
      professionalArchitects: [
        { name: 'Robert A.M. Stern Architects / SLCE', title: 'Design Architect / Architect of Record', license: 'Source: building profile / offering materials' },
        { name: 'Andre Kikoski Architect', title: 'Interior Architect', license: 'Source: building profile / offering materials' },
      ],
      professionalEngineers: [
        { name: 'Michael Gervasi', title: 'Professional Engineer (DOB fire alarm filing)', license: '082938' },
      ],
      professionalSources: [
        'DOB BIS / NYC Open Data permit applicants',
        'ACRIS condominium records and party data',
        'NYC Department of Finance property records, condo/coop abatement records, and RPIE/assessment context',
        'Attorney General offering plans and amendments',
        'Bank questionnaires / lender questionnaires',
        'Domecile building profile and fee/management data',
        'ECB/OATH compliance records',
        'PropertyShark ownership and professional verification',
      ],
      professionalNotes: [
        'Board and staff structure confirmed from owner-supplied Jackie notes; individual names require board/building verification before publication.',
        'Current managing-agent company should be confirmed through HPD MDR, PropertyShark, offering-plan records, or direct board confirmation.',
      ],
    };
  }
  return null;
}

function splitPropertyImages(imageUrls: string[] = []): { exterior: string[]; interior: string[] } {
  const interiorPattern = /\b(lobby|entrance|gym|fitness|pool|roof|deck|lounge|playroom|game|dining|media|card|amenity|interior|terrace)\b/i;
  const exteriorPattern = /\b(building|exterior|facade|street|front|elevation)\b/i;
  const exterior: string[] = [];
  const interior: string[] = [];

  for (const url of imageUrls) {
    if (!url) continue;
    const key = decodeURIComponent(url).replace(/[-_]/g, ' ');
    if (interiorPattern.test(key) && !exteriorPattern.test(key)) interior.push(url);
    else exterior.push(url);
  }

  return {
    exterior: exterior.length ? exterior : imageUrls.slice(0, 1),
    interior: interior.length ? interior : imageUrls.filter(url => !exterior.includes(url)),
  };
}

function buildSubjectStreetViewUrl(d: Pick<MasterReportData, 'address' | 'latitude' | 'longitude'>): string {
  const location = d.latitude && d.longitude
    ? `${d.latitude},${d.longitude}`
    : d.address;
  return `https://maps.googleapis.com/maps/api/streetview?size=900x650&location=${encodeURIComponent(location)}&fov=85&key=${GOOGLE_MAPS_REPORT_KEY}`;
}

function uniqueImageUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  return urls
    .map(url => String(url || '').trim())
    .filter(url => {
      if (!url || seen.has(url)) return false;
      if (/undefined|null|\[object Object\]/i.test(url)) return false;
      seen.add(url);
      return true;
    });
}

function subjectImageOnError(fallbackUrl: string, label: string): string {
  return subjectImageOnErrorChain([fallbackUrl], label);
}

function subjectImageOnErrorChain(fallbackUrls: string[], label: string): string {
  const cleanLabel = String(label ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
  const chain = JSON.stringify(uniqueImageUrls(fallbackUrls)).replace(/"/g, '&quot;');
  return `const q=${chain};const i=Number(this.dataset.fallbackIndex||0);if(i<q.length){this.dataset.fallbackIndex=String(i+1);this.src=q[i]}else{this.parentElement.innerHTML='<div style=&quot;height:100%;display:flex;align-items:center;justify-content:center;background:#EDE9DF;color:#3A4B5B;text-align:center;padding:18px;font-size:12px;font-weight:700;line-height:1.45&quot;>${cleanLabel}<br><span style=&quot;color:#A89035;font-size:10px;text-transform:uppercase;letter-spacing:0.8px&quot;>Photo fallback unavailable</span></div>'}`;
}

function buildSubjectImageCandidates(d: MasterReportData): string[] {
  // Only real, address-matched photo sources belong here. commercialIntel.brandingImages
  // and streetEasy.photos are deliberately excluded: brandingImages are marketing photos
  // for whatever business occupies the building (this is what caused a report for 257
  // Water Street to show Mark Joseph Steakhouse's dining room as "the subject property"),
  // and streetEasy.photos come from a scraper that's blocked/legally risky and shouldn't
  // be trusted as a photo source. Google Street View is included only via
  // d.buildingPhotos.streetView, which building-photos.ts already computed as an AIMED,
  // last-resort shot of the building itself -- never a raw, unaimed Street View URL.
  return uniqueImageUrls([
    ...(d.buildingPhotos?.exterior || []),
    ...(d.buildingPhotos?.interior || []),
    d.buildingPhotos?.streetView,
  ]);
}

function renderSubjectImage(d: MasterReportData, options: { height?: number; alt?: string } = {}): string {
  const candidates = buildSubjectImageCandidates(d);
  const height = options.height ? ` style="height:${options.height}px"` : '';
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
  const alt = escape(options.alt || d.buildingName);
  if (!candidates.length) {
    // Honest empty state -- never silently fabricate or reach for an
    // unaimed Street View shot here. Matches the placeholder treatment
    // used elsewhere once building-photos.ts reports noPhotoAvailable.
    return `<div class="deck-photo"${height} style="display:flex;align-items:center;justify-content:center;background:#EDE9DF;color:#3A4B5B;text-align:center;padding:18px;font-size:12px;font-weight:700;line-height:1.45">No exterior photo available for ${alt}<br><span style="color:#A89035;font-size:10px;text-transform:uppercase;letter-spacing:0.8px">${escape(d.buildingPhotos?.attribution || '')}</span></div>`;
  }
  const first = candidates[0];
  const rest = candidates.slice(1);
  const sourceLabel = d.buildingPhotos?.source || 'Google Places';
  return `<div class="deck-photo"${height}><img src="${first}" alt="${alt}" data-fallback-index="0" data-image-source="${escape(sourceLabel)}" onerror="${subjectImageOnErrorChain(rest, d.buildingName)}"></div>`;
}

function renderPropertyPhotoGallery(d: MasterReportData, options: { limit?: number; height?: number; columns?: number } = {}): string {
  const photos = uniqueImageUrls([
    ...(d.buildingPhotos?.exterior || []),
    ...(d.buildingPhotos?.interior || []),
  ]).slice(0, options.limit || 12);
  if (photos.length <= 1) return '';
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
  const columns = Math.min(options.columns || (photos.length > 8 ? 4 : 3), photos.length);
  const height = options.height || 92;
  return `<div style="display:grid;grid-template-columns:repeat(${columns},1fr);gap:7px;margin-bottom:12px">
${photos.map((url, index) => `<div style="border-radius:6px;overflow:hidden;height:${height}px;border:1px solid #D5D0C6;background:#EDE9DF"><img src="${escape(url)}" alt="${escape(d.buildingName)} property photo ${index + 1}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none'"></div>`).join('\n')}
</div>`;
}

function renderSubjectPhotoStrip(d: MasterReportData, options: { limit?: number; height?: number; caption?: string } = {}): string {
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
  const photos = buildSubjectImageCandidates(d).slice(0, options.limit || 3);
  if (!photos.length) return '';
  const height = options.height || 118;
  return `<div style="display:grid;grid-template-columns:repeat(${Math.min(photos.length, options.limit || 3)},1fr);gap:10px;margin:10px 0 18px">
${photos.map((url, index) => `<div style="height:${height}px;border:1px solid #D5D0C6;background:#EDE9DF;overflow:hidden;border-radius:6px;box-shadow:0 4px 10px rgba(44,50,64,0.08)"><img src="${escape(url)}" alt="${escape(d.buildingName)} visual ${index + 1}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none'"></div>`).join('\n')}
${options.caption ? `<div style="grid-column:1/-1;font-size:8.5px;color:#888;text-transform:uppercase;letter-spacing:0.8px;text-align:right">${escape(options.caption)}</div>` : ''}
</div>`;
}

/**
 * Pre-built deal reports (Hills of Monroe, Three Horizons East) are one-off
 * client packages with hardcoded data. They must ONLY trigger on an exact
 * match for that specific deal (or an explicit proposalMode) — never on a
 * broad geography match — so every other address gets live data.
 */
function isHoaExecutiveRecoveryOpportunity(address: string, borough?: string): boolean {
  return /hills\s+of\s+monroe|carlos\s+capria|645\s+main\s+st(reet)?,?\s+monroe/i.test(`${address} ${borough || ''}`);
}

function isHoaExecutiveRecoveryReport(d: MasterReportData): boolean {
  return d.raw?.proposalMode === 'hoa_executive_recovery' || isHoaExecutiveRecoveryOpportunity(`${d.address} ${d.buildingName}`, d.borough);
}

function isThreeHorizonsEast(address: string, borough?: string): boolean {
  return /three\s+horizons|12500\s+(ne|northeast)?\s*15th/i.test(`${address} ${borough || ''}`);
}

function isFloridaReceivershipReport(d: MasterReportData): boolean {
  return d.raw?.proposalMode === 'florida_receivership_takeover' || isThreeHorizonsEast(`${d.address} ${d.buildingName}`, d.borough);
}

function buildHoaExecutiveRecoveryReport(address: string): MasterReportData {
  const units = 186;
  const pricePerUnit = 34;
  const monthlyFee = 6250;
  const annualFee = monthlyFee * 12;
  const hillsCommunityImage = 'https://cdn.dagnysrealestate.com/communities/the-hills-of-monroe-monroe-ct/the-hills-of-monroe-monroe-ct-condominium-4952-w1900.webp';
  const hillsWindgateImage = 'https://cdn.dagnysrealestate.com/homes-for-sale/24161220/t_condo-202-windgate-circle-monroe-ct-0-009d.jpeg';
  const hillsKensingtonImage = 'https://cdn.dagnysrealestate.com/homes-for-sale/24160370/t_townhome-condo-5-kensington-road-monroe-ct-0-5ed6.jpeg';
  const hillsWindgate208Image = 'https://cdn.dagnysrealestate.com/homes-for-sale/24159458/t_condo-208-windgate-circle-monroe-ct-0-13f5.jpeg';
  const hillsSourceLinks = [
    'https://dagnysrealestate.com/the-hills-of-monroe-monroe-ct-condos',
    'https://www.zillow.com/b/208-windgate-cir-monroe-ct-5ZZ2qM/',
    'https://www.apartments.com/condos/hills-of-monroe-monroe-ct/',
    'https://www.yelp.com/biz/hills-of-monroe-monroe',
    'https://www.makingcthome.com/monroe/monroe-condos-for-sale/',
  ];
  const tieredPricing: TieredPricing = {
    classic: { perUnit: 29, monthly: 5400, annual: 64800 },
    intelligence: { perUnit: pricePerUnit, monthly: monthlyFee, annual: annualFee },
    premier: { perUnit: 46, monthly: 8500, annual: 102000 },
    recommended: 'intelligence',
    units,
  };
  const feeComparison: MarketFeeComparison = {
    marketRangeLow: 450,
    marketRangeHigh: 750,
    camelotAnnualPerUnit: pricePerUnit * 12,
    camelotMonthlyPerUnit: pricePerUnit,
    minimumMonthlyFee: 4500,
    minimumFeeLabel: '$4,500-$7,500/month HOA executive management range',
    floorApplied: false,
    savings: 'Premium hybrid model priced below traditional large-firm overhead',
    tier: 'suburban',
    tierLabel: 'Connecticut HOA / Executive Community Operations',
    ancillaryFeesIncluded: ['Monthly executive reporting', 'Board support', 'Vendor accountability dashboard', 'Insurance restoration coordination framework'],
    ancillaryComparison: [
      { service: 'Local Field Operations Retainer', marketRate: '$1,500-$3,500/mo', camelotRate: 'Scoped after budget, claim file, and inspection cadence review' },
      { service: 'Hourly Field / Facilities Support', marketRate: '$95-$175/hr', camelotRate: '$95-$150/hr, plus approved travel/admin where applicable' },
      { service: 'Claims / Restoration Oversight', marketRate: 'Separate consulting fee', camelotRate: 'Separate project agreement; can include selected board meeting attendance' },
      { service: 'Capital Project Coordination', marketRate: 'Hourly or % of project', camelotRate: '$150/hr or agreed fixed/project fee' },
    ],
  };
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const canonicalHoaAddress = '645 Main Street, Monroe, CT 06468';
  return {
    address: /hills of monroe|monroe|645 main/i.test(address || '') ? canonicalHoaAddress : (address || canonicalHoaAddress),
    borough: 'Connecticut',
    buildingName: 'Hills of Monroe Condominium',
    date: today,
    reportFocus: {
      selectedFocus: ['hoa_recovery', 'project_management', 'accounting', 'automation'],
      inquiryContact: 'Carlos Capria',
      inquiryOrganization: 'Hills of Monroe Condominium',
      inquiryRole: 'Primary Contact',
      inquiryNotes: 'Major winter-related loss event involving ice damage; focus on executive HOA management, insurance restoration oversight, field operations, board support, financial organization, vendor accountability, and long-term asset preservation. Core management, accounting, reporting, resident portal, automation, governance support, and board support are ready to propose; local on-site project/facilities support should be scoped separately after reviewing rent roll, current budget, financials, claim documents, vendor contracts, and desired site-visit cadence.',
    },
    units,
    stories: 2,
    yearBuilt: 1987,
    buildingClass: 'HOA',
    taxClass: 'HOA',
    marketValue: 0,
    assessedValue: 0,
    landValue: 0,
    lotArea: 0,
    buildingArea: 0,
    dofOwner: 'Hills of Monroe Condominium Association (legal name / agent to verify)',
    bbl: 'Connecticut HOA - Monroe land/assessor records replace parcel profile',
    registrationOwner: 'Hills of Monroe Condominium Association (to verify via Connecticut Secretary of the State)',
    managementCompany: 'Current HOA management / local facilities model to verify; historical CMG public reporting noted',
    violationsTotal: 0,
    violationsOpen: 0,
    violationClassA: 0,
    violationClassB: 0,
    violationClassC: 0,
    lastViolationDate: null,
    ecbCount: 0,
    ecbPenaltyBalance: 0,
    permitsCount: 1,
    hasRecentPermits: true,
    energyStarScore: null,
    siteEUI: null,
    ghgEmissions: null,
    occupancy: 'HOA community',
    ll97: null,
    lastSaleDate: null,
    lastSalePrice: 0,
    lastSaleBuyer: null,
    lastSaleSeller: null,
    deedCount: 0,
    mortgageCount: 0,
    litigationCount: 0,
    hasActiveLitigation: false,
    isRentStabilized: false,
    dobViolationCount: 0,
    dobViolationOpen: 0,
    facadeFilingCount: 0,
    facadeIssueCount: 0,
    dhcrRecordCount: 0,
    courtIndexCount: 0,
    acrisLienClaimCount: 0,
    complianceSourceChecks: [
      { source: 'Connecticut Secretary of the State business/entity search path', status: 'manual_required', count: 0, detail: 'Pull exact legal name, registered agent, principal office, mailing address, annual reports, and filing history from the Connecticut state business system.' },
      { source: 'Monroe Town Clerk land records / declaration / maps search path', status: 'manual_required', count: 0, detail: 'Pull recorded declaration, amendments, condominium maps/plans, notices, and any recorded liens by Hills of Monroe, Windgate Circle, Kensington Road, Fairmount Drive, and Map 69 / Block 13.' },
      { source: 'Monroe Assessor / Vision Government Solutions unit/APN search path', status: 'manual_required', count: 0, detail: 'Verify the 186-unit count, unit identifiers, assessor records, tax/assessment roll, and APN examples for Windgate and Kensington units.' },
      { source: 'Monroe municipal building / fire marshal / public-record request path', status: 'manual_required', count: 0, detail: 'Use town building, fire marshal, and municipal files for permits, inspections, drainage, roof/ice, storm-damage, and engineering correspondence.' },
      { source: 'CT condo resale/budget/source package request path', status: 'manual_required', count: 0, detail: 'Request current operating budget, prior-year actuals, reserve study, insurance dec pages, claim file, declaration/bylaws/rules, vendor list, and special-assessment history from the board/current manager.' },
      { source: 'Hills of Monroe public market/listing source stack', status: 'loaded', count: 12, detail: 'Dagny, Houlihan Lawrence, Zillow, Redfin, Apartments.com, Good Living CT, MapQuest, and similar listing sources support unit count, amenities, street network, year-built range, common-charge evidence, and imagery.' },
      { source: 'Patch 2011 ice-dam public report', status: 'loaded', count: 1, detail: 'Public reporting identified 139 units damaged, roof-snow-removal spend, and special-assessment discussion; treat as a verified historical operating-risk signal.' },
      { source: 'Advanced Asphalt filing lead / primary-record follow-up', status: 'manual_required', count: 1, detail: 'Secondary record trail reported a $26,519.59 filing involving Hills of Monroe Association and Consolidated Management Group; confirm with official land, court, or UCC records before board-facing diligence conclusions.' },
      { source: 'Insurance claim documentation', status: 'manual_required', count: 0, detail: 'Carrier, adjuster, restoration, scope, estimate, timeline, settlement, vendor, and board-communication records still need to be collected.' },
      { source: 'HOA proposal brief', status: 'loaded', count: 1, detail: 'User-provided Hills of Monroe operating context loaded as proposal brief.' },
    ],
    complianceReleaseStatus: 'needs_review',
    distressScore: 42,
    distressLevel: 'recovery opportunity',
    distressSignals: [
      { type: 'Winter loss event', description: 'Ice damage created restoration, communication, vendor, insurance, and potential special-assessment coordination needs', severity: 'medium' },
      { type: 'Historical weather-loss public record', description: 'Public reporting from 2011 described 139 damaged units and a $1,000-$2,000 per-owner special assessment discussion', severity: 'medium' },
      { type: 'Board workload', description: 'Community requires executive-level board support and organized operating cadence', severity: 'medium' },
    ],
    scoutScore: 68,
    scoutGrade: 'B',
    complaint311Count: 0,
    pricePerUnit,
    monthlyFee,
    annualFee,
    latitude: 41.3326,
    longitude: -73.2073,
    propertyType: 'Condo / HOA Community',
    neighborhoodName: 'Monroe, Connecticut',
    zipCode: '06468',
    neighborhoodSearchContext: { zipCode: '06468', neighborhoodName: 'Monroe, Connecticut', borough: 'Connecticut', query: 'Monroe CT HOA community management winter storm restoration insurance claims', source: 'User-provided HOA proposal brief + regional context' },
    neighborhoodMarketData: null,
    registrationDate: null,
    managementDuration: null,
    managementGrade: 'Review',
    managementScorecard: { violations: 80, compliance: 70, financial: 72, overall: 74 },
    boardMembers: [{ name: 'Carlos Capria', title: 'Primary Contact' }],
    buildingStaff: [{ role: 'Regional facilities support', name: 'To be structured during transition' }],
    professionals: { lawFirm: null, accountingFirm: null, engineer: null, architect: null },
    contactResearchSources: ['User-provided primary contact: Carlos Capria', 'Connecticut Secretary of the State business/entity search path', 'Monroe Town Clerk land records / declaration / maps search path', 'Board roster to be confirmed during transition'],
    professionalResearchSources: ['Insurance, public adjuster, engineering, restoration, and reserve-study professionals to be collected during onboarding', 'Monroe municipal building / fire marshal / public-record request path', 'CT condo resale/budget/source package request path'],
    dobArchitects: [],
    dobEngineers: [],
    dobOwners: [],
    hasAbatement: false,
    abatementAmount: 0,
    hasTaxLien: false,
    abatementType: 'Not applicable - Connecticut HOA proposal',
    abatementTaxYear: null,
    abatementSourceStatus: 'not_applicable',
    abatementMatchedLot: null,
    dofTaxMarketValue: 0,
    dofTaxAssessedValue: 0,
    taxLienSourceStatus: 'not_applicable',
    taxLienRecordCount: 0,
    taxLienMatchedLots: [],
    taxLienDetails: [],
    tieredPricing,
    feeComparison,
    streetEasy: null,
    commercialIntel: {
      commercialSignals: ['HOA common-area operations', 'Insurance restoration coordination', 'Local project / facilities coordinator need to scope', 'Regional facilities oversight'],
      likelyCommercialUses: [],
      amenities: ['Gated community setting', 'Pool', 'Paddle tennis', 'Clubhouse', 'Guest parking', 'One-car attached garages', 'Patios with wooded views', 'Central air / city water context', 'Common roads / drives', 'Landscape and seasonal maintenance areas', 'Storm-exposed exterior envelope components'],
      revenueOpportunities: ['Vendor rebidding', 'Insurance recovery discipline', 'Preventive maintenance scheduling', 'Reserve planning', 'Amenity rules and maintenance-cost review', 'Guest parking and common-area policy review', 'Use operating savings to offset local field/project management labor where practical'],
      officialWebsite: null,
      brandingTitle: 'Hills of Monroe Condominium',
      brandingDescription: 'Townhouse and detached-home HOA community in Monroe, CT, with gated setting, pool, paddle tennis, clubhouse, guest parking, and wooded residential context.',
      brandingImages: [hillsCommunityImage, hillsWindgateImage, hillsKensingtonImage, hillsWindgate208Image],
      researchSources: [
        'Connecticut Secretary of the State business/entity search path',
        'Monroe Town Clerk land records / declaration / maps search path',
        'Monroe Assessor / Vision Government Solutions unit/APN search path',
        'Monroe municipal building / fire marshal / public-record request path',
        'CT condo resale/budget/source package request path',
        'Hills of Monroe public market/listing source stack',
        'Patch 2011 ice-dam public report',
        'Advanced Asphalt filing lead / primary-record follow-up',
        'Dagny Real Estate Hills of Monroe public profile',
        'Houlihan Lawrence Hills of Monroe unit references',
        'Zillow The Hills of Monroe community references',
        'Redfin Hills of Monroe property-history reference',
        'Apartments.com Hills of Monroe condo search',
        'Good Living CT active inventory reference',
        'MapQuest 645 Main Street location reference',
        'User-provided HOA proposal brief',
        'Camelot insurance/restoration operating experience',
      ],
      researchStatus: 'verified',
    },
    buildingPhotos: { exterior: [hillsCommunityImage, hillsWindgateImage, hillsKensingtonImage, hillsWindgate208Image], interior: [], streetView: '', satellite: '', source: 'Dagny Real Estate public Hills of Monroe profile and listing image feed' },
    neighborhoodIntel: {
      crimeScore: 0,
      qualityScore: 80,
      transitScore: 45,
      crimeTotal: 0,
      complaints311Total: 0,
      crimeBreakdown: [],
      topComplaints: [],
      landmarks: [
        { name: 'Monroe, Connecticut', type: 'Regional community context', date: 'Current' },
        { name: 'Fairfield County operating market', type: 'Regional management context', date: 'Current' },
      ],
      crimePrecinct: '',
      scoreExplanation: 'Connecticut HOA context; local police/community scoring should use Monroe and Fairfield County sources.',
    },
    raw: {
      proposalMode: 'hoa_executive_recovery',
      primaryContact: 'Carlos Capria',
      preparedBy: 'Camelot Property Management Services Corp.',
      projectTitle: 'Camelot HOA Executive Management & Recovery Services Proposal',
      lossEvent: 'Major winter-related loss event involving ice damage affecting portions of the community',
      unitCountStatus: 'source_backed_verify_with_hoa_roster',
      localFieldSupportStrategy: {
        status: 'scope_after_board_discovery',
        rationale: 'Camelot can confidently lead executive management, accounting, reporting, automation, governance support, and board communication now; the local on-site field layer should be priced after confirming visit frequency, active projects, resident interface needs, contractor load, and travel/local staffing availability.',
        pricingOptions: [
          'Option A: Core executive management only, with field support billed hourly as needed',
          'Option B: Core executive management plus limited monthly field retainer for several site visits',
          'Option C: Core executive management plus project-specific facilities/project manager for restoration or capital work',
        ],
        discoveryNeeded: ['Rent roll', 'Current operating budget', 'Most recent financials', 'Audited financials', 'Insurance claim files', 'Vendor contracts', 'Open project list', 'Board meeting cadence', 'Expected monthly site visits'],
      },
      yearBuiltRange: '1987-1994 public profile range; Dagny narrative also references 1988-1990 construction timing',
      hoaCommunityFacts: {
        unitTypes: ['Townhouse', 'Single-family detached'],
        bedrooms: ['1 bedroom', '2 bedrooms', '3 bedrooms'],
        communityFeatures: ['Gated community', 'Quiet wooded cul-de-sac setting'],
        amenities: ['Pool', 'Paddle tennis', 'Clubhouse', 'Guest parking'],
        streets: ['Windgate Circle', 'Kensington Road', 'Ivy Lane'],
        homeFeatures: ['Vaulted ceilings', 'Fireplaces', 'Patios / wooded views', 'Walk-in closets', 'Central air', 'City water', 'Main-floor washer/dryer', 'One-car attached garage'],
        sizeRanges: ['1BR / 1BA: approx. 900-1,200 SF', '2BR / 2.5BA: approx. 1,360-1,985 SF'],
        unitCountEvidence: '186 units appears across public listing/profile sources including Homes.com, Realtor.com, Zillow, Compass, Redfin, and William Raveis listing data; final HOA roster should confirm before contract.',
      },
      publicRecordDiligence: {
        communityEntranceAddress: '645 Main Street, Monroe, CT 06468 appears in MLS/MapQuest wayfinding; not yet proven as formal corporate or mailing address.',
        corporateAddressStatus: 'Exact legal entity, registered agent, principal office, and mailing address must be verified through Connecticut Secretary of the State records.',
        unitCountFinding: '186 units is the strongest public indicator across current listing/public-record pages; declaration and condo plans should confirm the legal unit schedule.',
        apnExamples: ['MNRO M:069 B:013 L:00-HM00202E', 'M:069 B:013 L:00-MH000012'],
        commonChargeEvidence: ['$359/month HOA for a current one-bedroom Windgate unit', '$757/month HOA for a larger Kensington townhouse', '$227/month historical HOA for a 2013 Windgate listing'],
        missingDocuments: ['Recorded declaration', 'Declaration amendments', 'Condominium maps/plans', 'Schedule A / Schedule B budget pages', 'Current operating budget', 'Reserve study', 'Insurance dec pages', 'Open claim file'],
        ctFoiRule: 'Connecticut FOIA applies to public agencies such as the town clerk, assessor, building department, and fire marshal; it does not ordinarily compel a private condominium association to produce internal records.',
      },
      dagnyMarketSnapshot: {
        activeListings: [
          { address: '202 Windgate Circle, Monroe', price: 335000, type: 'Ranch condo', beds: 1, baths: 1, sqft: 983, yearBuilt: 1987, source: 'Dagny / SmartMLS listing display, listed March 25, 2026' },
          { address: '5 Kensington Road, Monroe', price: 510000, type: 'Townhouse condo', beds: 2, baths: 3, sqft: 2028, yearBuilt: 1989, source: 'Dagny / SmartMLS listing display, listed March 17, 2026' },
        ],
        recentSalesSummary: 'Dagny displayed 11 homes sold in the past 12 months.',
        latestSales: [
          { address: '208 Windgate Circle, Monroe', price: 380000, daysOnMarket: 43, saleToListRatio: '101%', beds: 1, baths: 2, sqft: 1279, yearBuilt: 1987, soldDate: 'May 1, 2026' },
          { address: '208 Windgate Circle, Monroe', price: 389000, daysOnMarket: 37, saleToListRatio: '100%', beds: 1, baths: 2, sqft: 1279, yearBuilt: 1987, soldDate: 'April 1, 2026' },
          { address: '302 Fairmount Drive, Monroe', price: 389900, daysOnMarket: 78, saleToListRatio: '100%', beds: 2, baths: 2, sqft: 1317, yearBuilt: 1988, soldDate: 'December 5, 2025' },
        ],
      },
      ctHoaSourceSkill: {
        currentSubjectSources: hillsSourceLinks,
        futureCtSearchPattern: [
          'Local brokerage / community profile pages for facts, amenities, photos, and street names',
          'Zillow building/community pages for market image and listing context',
          'Apartments.com condo/community search for rental and amenity context',
          'Yelp and Google reviews for resident sentiment signals, never as sole factual proof',
          'Town assessor, tax collector, land records, planning/zoning, inland wetlands, building department, and HOA/reserve/insurance files for official verification',
        ],
      },
    },
  };
}

function buildFloridaReceivershipReport(address: string): MasterReportData {
  const units = 89;
  const monthlyFee = 0;
  const annualFee = 0;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const canonicalAddress = '12500 NE 15th Avenue, North Miami, FL 33161';
  const threeHorizonsImageBase = 'https://camelot-scout-v6.onrender.com/images/three-horizons-east';
  const verifiedPropertyImages = [
    `${threeHorizonsImageBase}/aerial-overview.jpg`,
    `${threeHorizonsImageBase}/three-horizons-east-condominium.webp`,
    `${threeHorizonsImageBase}/front-entrance.jpg`,
    `${threeHorizonsImageBase}/front-side.jpg`,
    `${threeHorizonsImageBase}/side-image.jpg`,
    `${threeHorizonsImageBase}/gate-entrance.jpg`,
    `${threeHorizonsImageBase}/building-sign.jpg`,
    `${threeHorizonsImageBase}/shared-pool-clubhouse.jpg`,
    `${threeHorizonsImageBase}/pool.jpg`,
    `${threeHorizonsImageBase}/lobby.jpg`,
    `${threeHorizonsImageBase}/hallways.jpg`,
    `${threeHorizonsImageBase}/front-entrance-doors.jpg`,
  ];
  const verifiedExteriorImages = verifiedPropertyImages.slice(0, 9);
  const verifiedInteriorImages = verifiedPropertyImages.slice(9);
  const streetView = `https://maps.googleapis.com/maps/api/streetview?size=1200x700&location=${encodeURIComponent(canonicalAddress)}&fov=82&key=${GOOGLE_MAPS_REPORT_KEY}`;
  const mapImage = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(canonicalAddress)}&zoom=16&size=1200x700&maptype=roadmap&markers=color:red%7C${encodeURIComponent(canonicalAddress)}&key=${GOOGLE_MAPS_REPORT_KEY}`;
  const floridaSources: ComplianceSourceCheck[] = [
    {
      source: 'Miami-Dade Property Appraiser',
      status: 'manual_required',
      count: 0,
      detail: 'Verify parcel folio, legal description, assessed value, tax roll, owner/association name, building area, 89-unit profile, six-story configuration, and 1972 construction details for the subject condominium.',
      url: 'https://www.miamidade.gov/pa/property_search.asp',
    },
    {
      source: 'Miami-Dade Clerk of Courts - Civil / receivership docket',
      status: 'manual_required',
      count: 0,
      detail: 'Pull the receivership case docket, receiver appointment order, active motions, party list, claims, liens, and deadlines before any external release.',
      url: 'https://www2.miamidadeclerk.gov/ocs/',
    },
    {
      source: 'Miami-Dade Official Records / Recorder',
      status: 'manual_required',
      count: 0,
      detail: 'Search recorded deeds, liens, notices, claims of lien, association documents, mortgages, judgments, lis pendens, and receiver-related recorded instruments.',
      url: 'https://www2.miamidadeclerk.gov/OfficialRecords/',
    },
    {
      source: 'City of North Miami Building Department',
      status: 'manual_required',
      count: 0,
      detail: 'Verify open permits, unsafe-structure items, code cases, inspection history, building recertification status, and any local enforcement orders.',
      url: 'https://www.northmiamifl.gov/',
    },
    {
      source: 'Miami-Dade Building Permits / Enforcement',
      status: 'manual_required',
      count: 0,
      detail: 'Cross-check county permit records, contractor history, building-card data, inspection status, enforcement, and closeout requirements.',
      url: 'https://www.miamidade.gov/permits/',
    },
    {
      source: 'Florida DBPR Condominium / Association records',
      status: 'manual_required',
      count: 0,
      detail: 'Confirm association identity, annual report/financial filing status where available, complaints, arbitration, and condominium governance records.',
      url: 'https://www.myfloridalicense.com/',
    },
    {
      source: 'Florida Division of Corporations - Sunbiz',
      status: 'manual_required',
      count: 0,
      detail: 'Verify corporate entity name, registered agent, officers/directors, annual reports, status, and mailing address.',
      url: 'https://search.sunbiz.org/',
    },
    {
      source: 'Miami-Dade Tax Collector',
      status: 'manual_required',
      count: 0,
      detail: 'Review taxes, delinquency, certificates, tax deed risk, and account status by folio once confirmed.',
      url: 'https://www.miamidade.gov/global/service.page?Mduid_service=ser1499797469847186',
    },
    {
      source: 'FEMA Flood Map Service Center',
      status: 'manual_required',
      count: 0,
      detail: 'Confirm flood-zone status, insurance implications, coastal/storm exposure, and any mitigation work relevant to takeover budgeting.',
      url: 'https://msc.fema.gov/portal/home',
    },
    {
      source: 'User-provided receivership engagement facts',
      status: 'loaded',
      count: 1,
      detail: 'Camelot is working with past board members, board counsel, the court-appointed receiver, unit owners, a licensed CAM operator through an affiliate partnership, engineers, contractors, and service providers to stabilize operations and restore the property.',
    },
  ];
  const tieredPricing: TieredPricing = {
    classic: { perUnit: 0, monthly: 0, annual: 0 },
    intelligence: { perUnit: 0, monthly: monthlyFee, annual: annualFee },
    premier: { perUnit: 0, monthly: 0, annual: 0 },
    recommended: 'intelligence',
    units,
  };
  return {
    address: canonicalAddress,
    borough: 'North Miami, Florida',
    buildingName: 'Three Horizons East Condominium',
    date: today,
    reportFocus: {
      selectedFocus: ['hoa_recovery', 'property_management', 'accounting', 'automation', 'compliance', 'project_management'],
      inquiryOrganization: 'Three Horizons East Condominium',
      inquiryNotes: 'Florida receivership takeover. Camelot is coordinating with past board members, board attorney, the court-appointed receiver, unit owners, a licensed CAM operator affiliate partner, engineers, contractors, consultants, and service providers. Three Horizons East is Camelot’s first North Miami management engagement and a strategic South Florida expansion platform. The report must use Florida, Miami-Dade, and North Miami source paths only.',
    },
    units,
    stories: 6,
    yearBuilt: 1972,
    buildingClass: 'Established Florida condominium - Miami-Dade folio and building records to verify',
    taxClass: 'Miami-Dade condominium - verify',
    marketValue: 0,
    assessedValue: 0,
    landValue: 0,
    lotArea: 0,
    buildingArea: 0,
    dofOwner: 'Three Horizons East Condominium Association / Receiver authority to verify',
    bbl: 'Miami-Dade folio to verify',
    registrationOwner: 'Three Horizons East Condominium Association / Receiver authority to verify',
    managementCompany: 'Camelot receivership property management takeover and stabilization platform',
    violationsTotal: 0,
    violationsOpen: 0,
    violationClassA: 0,
    violationClassB: 0,
    violationClassC: 0,
    lastViolationDate: null,
    ecbCount: 0,
    ecbPenaltyBalance: 0,
    permitsCount: 0,
    hasRecentPermits: false,
    energyStarScore: null,
    siteEUI: null,
    ghgEmissions: null,
    occupancy: 'Condominium receivership',
    ll97: null,
    lastSaleDate: null,
    lastSalePrice: 0,
    lastSaleBuyer: null,
    lastSaleSeller: null,
    deedCount: 0,
    mortgageCount: 0,
    litigationCount: 1,
    hasActiveLitigation: true,
    isRentStabilized: false,
    dobViolationCount: 0,
    dobViolationOpen: 0,
    facadeFilingCount: 0,
    facadeIssueCount: 0,
    dhcrRecordCount: 0,
    courtIndexCount: 1,
    acrisLienClaimCount: 0,
    complianceSourceChecks: floridaSources,
    complianceReleaseStatus: 'needs_review',
    distressScore: 78,
    distressLevel: 'receivership takeover',
    distressSignals: [
      { type: 'Receivership', description: 'Property is in receivership and requires immediate operating control, court-aware reporting, owner communication, and coordinated stabilization for an established 89-unit, six-story condominium community.', severity: 'high' },
      { type: 'Budget recovery', description: 'Camelot must help develop a sound operating budget, strengthen collections, improve checks and controls, and bring the association into the black.', severity: 'high' },
      { type: '40-year certification and life-safety compliance', description: 'Building recertification, fire sprinklers, fire monitoring, insurance requirements, and all applicable local compliance items must be organized and driven to completion.', severity: 'high' },
      { type: 'Capital improvement and refinance path', description: 'Repairs, maintenance, capital work, engineering, GC coordination, insurance compliance, and project management support the path toward refinancing out of a high-interest short-term bridge loan into more traditional debt.', severity: 'high' },
      { type: 'Managing-agent scope', description: 'Camelot is positioned as the managing-agent platform, supported by a licensed Florida CAM operator affiliate where required, with receiver/court authority, unit-owner ledgers, lock-box collections, notices, accounting controls, maintenance oversight, and vendor coordination built into the operating plan.', severity: 'high' },
      { type: 'Florida source verification', description: 'Miami-Dade, North Miami, Florida DBPR, Sunbiz, clerk, tax, flood, insurance, and association records must replace non-Florida source paths.', severity: 'high' },
    ],
    scoutScore: 78,
    scoutGrade: 'A',
    complaint311Count: 0,
    pricePerUnit: 0,
    monthlyFee,
    annualFee,
    latitude: 25.8926,
    longitude: -80.1705,
    propertyType: 'Florida Condominium / Receivership',
    neighborhoodName: 'North Miami, Miami-Dade County',
    zipCode: '33161',
    neighborhoodSearchContext: {
      zipCode: '33161',
      neighborhoodName: 'North Miami, Miami-Dade County',
      borough: 'Florida',
      query: 'Three Horizons East Condominium 12500 NE 15th Avenue North Miami FL 33161 receivership condominium',
      source: 'Florida jurisdiction profile: Miami-Dade, North Miami, Florida DBPR, Sunbiz, court, tax, flood, and association records',
    },
    neighborhoodMarketData: null,
    registrationDate: null,
    managementDuration: 'Receivership takeover - active transition',
    managementGrade: 'Review',
    managementScorecard: { violations: 60, compliance: 58, financial: 55, overall: 58 },
    boardMembers: [{ name: 'Court-appointed receiver / association authority', title: 'Receivership authority to verify through Miami-Dade Clerk docket' }],
    buildingStaff: [
      { role: 'Receiver property management company', name: 'Camelot' },
      { role: 'Licensed CAM operator affiliate partner', name: 'Florida CAM compliance and local association operations support' },
      { role: 'Receiver / board counsel / past board coordination', name: 'Court and association stakeholders' },
      { role: 'Local North Miami field support', name: 'Property managers, engineers, GC, maintenance, cleaning, guard service, and project consultants to be staffed and coordinated by Camelot' },
    ],
    professionals: { lawFirm: null, accountingFirm: null, engineer: null, architect: null },
    contactResearchSources: [
      'Miami-Dade Clerk of Courts receivership docket',
      'Miami-Dade Official Records / Recorder',
      'Florida DBPR condominium / association records',
      'Florida Division of Corporations - Sunbiz',
      'Receiver transition files and court orders',
      'Past board, board counsel, receiver, unit owner, and consultant transition files',
    ],
    professionalResearchSources: [
      'Receiver counsel and court filings',
      'Miami-Dade Clerk of Courts case docket',
      'City of North Miami Building Department',
      'Miami-Dade permit records',
      'Florida DBPR association records',
      'Insurance, engineering, restoration, and vendor files collected during takeover',
    ],
    dobArchitects: [],
    dobEngineers: [],
    dobOwners: [],
    hasAbatement: false,
    abatementAmount: 0,
    hasTaxLien: false,
    abatementType: 'Florida condominium tax/assessment workflow',
    abatementTaxYear: null,
    abatementSourceStatus: 'florida_source_required',
    abatementMatchedLot: null,
    dofTaxMarketValue: 0,
    dofTaxAssessedValue: 0,
    taxLienSourceStatus: 'Miami-Dade Tax Collector and Official Records search required',
    taxLienRecordCount: 0,
    taxLienMatchedLots: [],
    taxLienDetails: [],
    tieredPricing,
    feeComparison: null,
    streetEasy: null,
    commercialIntel: {
      commercialSignals: ['Receivership operations', 'Condominium association control transition', 'Florida court-aware management', 'Licensed CAM operator affiliate partnership', 'Vendor and contract turnover review', 'Insurance, life-safety, 40-year certification, and restoration review'],
      likelyCommercialUses: [],
      amenities: ['Gated access', 'Swimming pool', 'Fitness facilities to verify', 'Clubhouse / recreation areas', 'Elevator access', 'Parking', 'Common outdoor spaces', 'Condominium common areas to inspect', 'Fire sprinkler and fire monitoring systems to verify', 'Insurance and building-condition files to collect', 'Staffing, cleaning, guard service, maintenance, project management, engineering, and GC support to coordinate'],
      revenueOpportunities: ['Vendor rebidding', 'Insurance claim and reserve coordination', 'Collections and arrears process cleanup', 'Lock-box collections and unit-owner ledger discipline', 'Monthly billing and delinquency notice workflow', 'Budget recovery and cash-control review', 'Capital improvement planning', 'Receivership reporting cadence', 'Refinance-readiness support once compliance needs are met'],
      officialWebsite: null,
      brandingTitle: 'Three Horizons East Condominium',
      brandingDescription: 'Three Horizons East is an established 89-unit, six-story North Miami condominium built in 1972. Camelot’s engagement is positioned as both a receivership stabilization mandate and the company’s first North Miami management platform.',
      brandingImages: [...verifiedPropertyImages, streetView, mapImage],
      researchSources: [
        'Miami-Dade Property Appraiser',
        'Miami-Dade Clerk of Courts - Civil / receivership docket',
        'Miami-Dade Official Records / Recorder',
        'City of North Miami Building Department',
        'Miami-Dade Building Permits / Enforcement',
        'Florida DBPR condominium / association records',
        'Florida Division of Corporations - Sunbiz',
        'Miami-Dade Tax Collector',
        'FEMA Flood Map Service Center',
        'North Miami local market and neighborhood services review',
        'Property amenity and resident-experience review',
        'Receiver transition files',
        'Past board, board attorney, receiver, unit owner, engineer, GC, insurance, and consultant records',
      ],
      researchStatus: 'verified',
    },
    buildingPhotos: {
      exterior: [...verifiedExteriorImages, streetView, mapImage],
      interior: verifiedInteriorImages,
      streetView,
      satellite: `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_REPORT_KEY}&q=${encodeURIComponent(canonicalAddress)}&zoom=17&maptype=satellite`,
      source: 'Verified uploaded Three Horizons East property photo set plus Google Maps fallback',
    },
    neighborhoodIntel: {
      crimeScore: 0,
      qualityScore: 68,
      transitScore: 58,
      crimeTotal: 0,
      complaints311Total: 0,
      crimeBreakdown: [],
      topComplaints: [],
      landmarks: [
        { name: 'North Miami', type: 'Miami-Dade municipality', date: 'Current' },
        { name: 'NE 125th Street / Biscayne corridor', type: 'Local access and service corridor', date: 'Current' },
        { name: 'Miami-Dade County', type: 'County records and court jurisdiction', date: 'Current' },
      ],
      crimePrecinct: '',
      scoreExplanation: 'Florida report mode; neighborhood and public-safety context should be verified through North Miami Police, Miami-Dade open records, municipal records, and local market sources.',
    },
    raw: {
      proposalMode: 'florida_receivership_takeover',
      state: 'FL',
      county: 'Miami-Dade',
      city: 'North Miami',
      subjectProperty: 'Three Horizons East Condominium',
      noNySources: true,
      receivership: {
        status: 'In receivership',
        currentManagement: 'Camelot receivership property management takeover and stabilization platform',
        strategicExpansion: 'Camelot’s first North Miami management engagement and South Florida expansion platform',
        agreementScope: [
          'Camelot serves as the managing-agent platform for the property, subject to receiver authority and applicable court orders',
          'Florida community-association management functions are coordinated through a duly licensed Florida CAM operator affiliate where required by law',
          'Camelot back-office support includes owner ledger updates, notice mailing/support, accounting coordination, reporting, collections workflow, and document organization',
          'Monthly billing, common charges, assessments, rents, and other charges are handled through operating-account and lock-box procedures as directed by the receiver/client',
          'Delinquency notices, legal referrals, foreclosure-support notices, and collection proceedings are coordinated only with proper receiver/client authorization and counsel',
          'Maintenance oversight includes common-area cleanliness, building systems, elevator, electrical, plumbing, HVAC, masonry, decor, repairs, alterations, and capital work coordination',
          'Camelot coordinates board/receiver meetings, owner communications, vendor documentation, insurance requirements, and transition materials during the receivership period',
        ],
        immediatePriorities: [
          'Court order and receiver authority file',
          'Operating budget, banking, collections, payables, and checks and controls',
          'Vendor contract and insurance certificate review',
          '40-year certification, building department, code, permit, fire sprinkler, fire monitoring, and life-safety review',
          'Resident communication and emergency escalation protocol',
          'Photo documentation and site-condition baseline',
          'Budget, arrears, AP, payroll/vendor, and reserve file audit',
          'Capital improvements, repairs, maintenance, engineering, GC, project management, and consultant coordination',
          'Insurance inspection requirement review and refinance-readiness plan for a future traditional mortgage',
          'North Miami local staffing base: property management, maintenance, cleaning, guard service, engineers, service providers, and contractors',
          'Licensed CAM operator affiliate partnership for Florida condominium operations and compliance support',
        ],
      },
      floridaSourceStack: floridaSources.map(source => source.source),
    },
  };
}

/**
 * Normalize a user-typed address for display: "125 walker street, new york, ny"
 * → "125 Walker Street, New York, NY". Leaves numerics/ordinals (57th, 37-34)
 * untouched and uppercases NY/NYC.
 */
function titleCaseAddress(value: string): string {
  if (!value) return value;
  return value.split(/\s+/).map((word) => {
    if (/^\d/.test(word)) return word;
    const bare = word.replace(/[^a-zA-Z]/g, '');
    if (/^(ny|nyc|usa|llc|corp)$/i.test(bare)) return word.toUpperCase();
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

export async function buildMasterReport(address: string, borough?: string): Promise<MasterReportData> {
  if (isThreeHorizonsEast(address, borough)) {
    return buildFloridaReceivershipReport(address);
  }

  if (isHoaExecutiveRecoveryOpportunity(address, borough)) {
    return buildHoaExecutiveRecoveryReport(address);
  }

  const preKnownFacts = getKnownPropertyFacts(address);
  const isLocked22East22 = preKnownFacts?.canonicalAddress === '22 East 22nd Street, New York, NY 10010';
  const lookupAddress = preKnownFacts?.canonicalAddress || address;
  const lookupBorough = preKnownFacts?.borough || borough;
  const [raw, geo, buildingPhotos, streetEasy] = await Promise.all([
    withReportTimeout(fetchFullBuildingReport(lookupAddress, lookupBorough), {} as Awaited<ReturnType<typeof fetchFullBuildingReport>>, 18000),
    withReportTimeout(geocodeAddress(lookupAddress + (lookupBorough ? ', ' + lookupBorough + ', New York' : ', New York, NY')), null, 6000),
    withReportTimeout(findBuildingPhotos(lookupAddress, lookupAddress).catch(() => null), null, 6000),
    withReportTimeout(fetchStreetEasyBuilding(lookupAddress, lookupBorough).catch(() => null), null, 3000),
  ]);

  // Fetch neighborhood intelligence (crime, 311, landmarks)
  // Determine precinct and ZIP from raw DOF/HPD/address data. ZIP is retained
  // as a reusable context anchor when exact address-level records are weak.
  const rawDof = raw.dof ? (raw as any).raw?.dof : null;
  const zip = detectZipFromText(
    (raw as any).dofAbatement?.raw?.zip_code,
    (raw as any).dofAbatement?.raw?.zip,
    (raw as any).registration?.zip,
    (raw as any).dof?.zip,
    lookupAddress,
    address
  ) || (raw as any)?.resolvedZip || '';
  const precinct = '';
  const neighborhoodIntel = (zip || precinct) ? await getNeighborhoodIntel(
    precinct || '0', zip || '10001',
    geo?.lat, geo?.lng
  ).catch(() => null) : null;

  const dof = raw.dof;
  const knownFacts = isLocked22East22
    ? preKnownFacts
    : getKnownPropertyFacts(lookupAddress, streetEasy?.name || raw.energy?.propertyName || '') || preKnownFacts;
  const reportAddress = titleCaseAddress(knownFacts?.canonicalAddress || lookupAddress);
  const effectiveBorough = knownFacts?.borough || lookupBorough || (raw as any)?.resolvedBorough || '';

  // Reconcile unit count across sources. DOF/PLUTO can return a tax-lot or
  // partial-building count, so a tiny DOF value must not block stronger signals.
  const unitCandidates = [
    { source: 'known facts', value: knownFacts?.units || 0, trusted: true },
    { source: 'StreetEasy / market profile', value: streetEasy?.units || 0, trusted: true },
    { source: 'DOF co-op/condo abatement units', value: Number.parseInt(String(raw.dofAbatement?.raw?.units || ''), 10) || 0, trusted: true },
    { source: 'DOF co-op apartments', value: Number.parseInt(String(raw.dofAbatement?.raw?.coop_apts || ''), 10) || 0, trusted: true },
    { source: 'DOB dwelling units', value: Number(raw.dobUnits) || 0, trusted: true },
    { source: 'Energy benchmarking units', value: Number.parseInt(String((raw as any).energy?.number_of_units || ''), 10) || 0, trusted: true },
    { source: 'DOF / PLUTO units', value: dof?.units || 0, trusted: false },
    { source: 'building-area estimate', value: dof?.buildingArea && dof.buildingArea > 75000 ? Math.round(dof.buildingArea / 850) : 0, trusted: false },
  ].filter(c => Number.isFinite(c.value) && c.value > 0);

  const trustedUnitCandidates = unitCandidates.filter(c => c.trusted);
  const strongestTrustedUnits = trustedUnitCandidates.reduce((max, c) => Math.max(max, c.value), 0);
  const strongestAnyUnits = unitCandidates.reduce((max, c) => Math.max(max, c.value), 0);
  const dofUnits = dof?.units || 0;
  let units = dofUnits || strongestTrustedUnits || strongestAnyUnits || 0;
  if (knownFacts?.units) {
    units = knownFacts.units;
  } else if (strongestTrustedUnits >= 50 && (!dofUnits || dofUnits <= 5 || strongestTrustedUnits >= dofUnits * 2)) {
    units = strongestTrustedUnits;
  } else if (strongestAnyUnits >= 50 && (!dofUnits || dofUnits <= 5 || strongestAnyUnits >= dofUnits * 2)) {
    units = strongestAnyUnits;
  } else if (!units && dof?.buildingArea && dof.buildingArea > 2000) {
    units = Math.round(dof.buildingArea / 850);
  }
  const unitSourceSummary = unitCandidates.map(c => `${c.source}: ${c.value}`).join(' | ');

  // Cascade stories from DOF → DOB → StreetEasy
  let stories = dof?.stories || 0;
  if (!stories && raw.dobStories) stories = raw.dobStories;
  if (!stories && streetEasy?.stories) stories = streetEasy.stories;
  if (knownFacts?.stories) stories = knownFacts.stories;

  const gfa = dof?.buildingArea || 0;

  // LL97 Calculation
  let ll97Data: MasterReportData['ll97'] = null;
  if (raw.energy && gfa > 0) {
    const bldgType = inferBuildingType(dof?.buildingClass || '');
    const ll97Input = {
      address: reportAddress,
      buildingType: bldgType as any,
      grossFloorArea: gfa,
      siteEUI: raw.energy.siteEUI || undefined,
      totalEmissions: raw.energy.ghgEmissions || undefined,
      energyStarScore: raw.energy.energyStarScore || undefined,
    };
    const penalty = calculateLL97Penalty(ll97Input);
    const status = getComplianceStatus(ll97Input);
    ll97Data = {
      period1Penalty: penalty.annualPenalty,
      period2Penalty: status.period2?.annualPenalty || 0,
      totalExposure11yr: (penalty.annualPenalty * 6) + ((status.period2?.annualPenalty || 0) * 5),
      complianceStatus: (status.worstStatus ?? penalty.complianceStatus ?? 'unknown') as string,
      buildingType: bldgType || 'multifamily_housing',
      emissionsLimit: penalty.emissionsLimitPerSqFt,
      actualEmissions: penalty.estimatedActualEmissions,
    };
  }

  // Distress
  const distressReport = analyzeDistress({
    acrisData: raw.acris || null,
    dofData: dof ? {
      assessedValue: dof.assessedValue,
      marketValue: dof.marketValue,
      taxClass: dof.taxClass,
      units: dof.units,
      stories: dof.stories,
    } : null,
    violations: raw.violations ? {
      total: raw.violations.total,
      open: raw.violations.open,
      items: raw.violations.items,
    } : null,
    ecbData: raw.ecb ? {
      violations: raw.ecb.violations,
      totalPenaltyBalance: raw.ecb.totalPenaltyBalance,
    } : null,
    litigation: raw.litigation ? {
      cases: raw.litigation.cases,
      hasActive: raw.litigation.hasActive,
    } : null,
  });

  // Violation class breakdown
  const items = raw.violations?.items || [];
  const classA = items.filter((v: any) => v.class === 'A').length;
  const classB = items.filter((v: any) => v.class === 'B').length;
  const classC = items.filter((v: any) => v.class === 'C').length;

  // Pricing
  // Price per unit — use the tiered pricing intelligence tier as the default displayed fee
  // This gets recalculated properly in calculateTieredPricing with building class, value, and address awareness
  const effectiveBuildingClass = knownFacts?.buildingClass || dof?.buildingClass || '';
  const effectiveMarketValue = knownFacts?.marketValue || dof?.marketValue || 0;
  const tier = calculateTieredPricing(units || 1, effectiveBorough, raw.rentStabilization?.isStabilized || false, ll97Data?.complianceStatus || 'unknown', effectiveBuildingClass, effectiveMarketValue, reportAddress);
  const feeComparison = calculateMarketFeeComparison({
    units: units || 1,
    borough: effectiveBorough,
    propertyType: knownFacts?.propertyType || classifyBuildingType(effectiveBuildingClass),
    buildingClass: effectiveBuildingClass,
    isRentStabilized: raw.rentStabilization?.isStabilized || false,
    ll97Status: ll97Data?.complianceStatus || 'unknown',
    pricePerUnit: tier.intelligence.perUnit,
  });
  // Jackie now uses Camelot Intelligence as the recommended starting package.
  // Market comparison remains context, but proposal pricing must come from the
  // Intelligence tier so the deck, proposal, agreement, and pricing matrix agree.
  const pricePerUnit = tier.intelligence.perUnit;
  const monthlyFee = tier.intelligence.monthly;
  const annualFee = tier.intelligence.annual;
  feeComparison.camelotMonthlyPerUnit = pricePerUnit;
  feeComparison.camelotAnnualPerUnit = pricePerUnit * 12;
  feeComparison.floorApplied = monthlyFee === getCamelotMinimumFeeRule(effectiveBorough).preferred;

  // Scout scoring (simplified)
  let score = 0;
  const violTotal = raw.violations?.total || 0;
  if (violTotal > 50) score += 30; else if (violTotal > 20) score += 22; else if (violTotal > 10) score += 15; else if (violTotal > 0) score += 8;
  if (units >= 100) score += 20; else if (units >= 50) score += 16; else if (units >= 30) score += 12; else if (units >= 10) score += 8;
  const mgmt = (raw.registration?.managementCompany || '').toLowerCase();
  if (!mgmt || mgmt === 'unknown') score += 20; else score += 10;
  if (raw.ecb?.totalPenaltyBalance > 10000) score += 10; else if (raw.ecb?.count > 0) score += 5;
  if (raw.litigation?.hasActive) score += 15;
  if (raw.rentStabilization?.isStabilized) score += 5;
  const grade = score >= 75 ? 'A' : score >= 50 ? 'B' : 'C';

  // ---------------------------------------------------------------------------
  // Derive a sensible building name.
  // The LL84 energy benchmarking `property_name` often contains the management
  // company name rather than the actual building name, so we
  // can't blindly trust it. We only use it when it looks like a real building
  // name — i.e. it contains a number (street address) or known building-name
  // keywords, and does NOT match the management company already on file.
  // ---------------------------------------------------------------------------
  function deriveBuildingName(addr: string, data: any): string {
    // Highest authority: the legal entity on the PLUTO tax roll when it names
    // the building itself (e.g. "LIBERTY VIEW CONDOMINIUM"). LL84 energy
    // registrations are filed by owners/sponsors and often carry the
    // sponsor's brand ("Milstein 99 Battery Place") rather than the
    // building's actual name.
    const plutoOwner = String(data.dof?.owner || '').trim();
    if (/\b(condominium|condo association|co-?op(erative)?|owners corp|tenants corp|apartment corp)\b/i.test(plutoOwner)) {
      return titleCaseAddress(plutoOwner);
    }
    const energyName = (data.energy?.propertyName || '').trim();
    if (!energyName) return addr;

    const normalizeAddressKey = (value: string) => value
      .toLowerCase()
      .replace(/\b(east)\b/g, 'e')
      .replace(/\b(west)\b/g, 'w')
      .replace(/\b(north)\b/g, 'n')
      .replace(/\b(south)\b/g, 's')
      .replace(/\b(street)\b/g, 'st')
      .replace(/\b(avenue)\b/g, 'ave')
      .replace(/\b(road)\b/g, 'rd')
      .replace(/\b(place)\b/g, 'pl')
      .replace(/\b(boulevard)\b/g, 'blvd')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    const extractAddressLikePhrases = (value: string) =>
      [...value.matchAll(/\b\d{1,5}\s+(?:east|e|west|w|north|n|south|s)?\s*[a-z0-9]+(?:st|nd|rd|th)?\s+(?:street|st|avenue|ave|road|rd|place|pl|boulevard|blvd|drive|dr|lane|ln|parkway|pkwy)\b/gi)]
        .map(match => normalizeAddressKey(match[0]));
    const subjectAddressKey = normalizeAddressKey(addr);
    const foreignAddressPhrases = extractAddressLikePhrases(energyName).filter(phrase => !subjectAddressKey.includes(phrase));
    if (foreignAddressPhrases.length) return addr;

    const mgmtCo = (data.registration?.managementCompany || '').trim().toLowerCase();
    const ownerName = (data.registration?.owner || '').trim().toLowerCase();
    const dofOwnerName = (data.dof?.owner || '').trim().toLowerCase();
    const nameLower = energyName.toLowerCase();

    // Reject if it matches the management company or owner name
    if (mgmtCo && (nameLower.includes(mgmtCo) || mgmtCo.includes(nameLower))) return addr;
    if (ownerName && (nameLower.includes(ownerName) || ownerName.includes(nameLower))) return addr;
    if (dofOwnerName && (nameLower.includes(dofOwnerName) || dofOwnerName.includes(nameLower))) return addr;

    // Reject common management/company suffixes that indicate it's a company, not a building
    const companyPatterns = /\b(management|mgmt|realty|properties|property\s+group|associates|llc|corp|inc|holdings|advisors|capital|group|services)\b/i;
    if (companyPatterns.test(energyName)) return addr;

    // Accept if it contains a street number or well-known building name patterns
    const looksLikeBuilding = /\d/.test(energyName) || /\b(tower|towers|plaza|house|court|terrace|gardens|hall|manor|place|park|residence|residences)\b/i.test(energyName);
    if (looksLikeBuilding) return energyName;

    // If it's very short (single word) and doesn't look like a building, prefer address
    if (energyName.split(/\s+/).length <= 2 && !looksLikeBuilding) return addr;

    // Default: use the energy name if it passed all rejection filters
    return energyName;
  }

  const derivedBuildingName = knownFacts?.buildingName || deriveBuildingName(reportAddress, raw);
  const buildingName = is279CentralParkWestSubject(reportAddress, derivedBuildingName, raw.energy?.propertyName, raw.registration?.managementCompany)
    ? '279 Central Park West'
    : cleanBuildingName(derivedBuildingName, reportAddress, knownFacts?.managementCompany || raw.registration?.managementCompany);
  // City building class outranks StreetEasy's scraped guess; and a building
  // with 7+ stories or 60+ units can never be a "walk-up" (see 99 Battery
  // Place: 28 floors, 293 units, mislabeled walk-up by a scrape).
  const cityPropertyType = dof?.buildingClass ? classifyBuildingType(dof.buildingClass) : '';
  let propertyType = knownFacts?.propertyType || cityPropertyType || streetEasy?.buildingType || 'Residential';
  if (/walk-?up/i.test(propertyType) && ((dof?.stories || 0) >= 7 || (dof?.units || 0) >= 60)) {
    propertyType = 'Elevator Apartment';
  }
  const brandingResearch = await fetchOfficialBuildingBranding(reportAddress, buildingName).catch(() => null);
  let commercialIntel = inferCommercialAmenityIntel({
    address: reportAddress,
    buildingName,
    buildingClass: knownFacts?.buildingClass || dof?.buildingClass || '',
    taxClass: dof?.taxClass || '',
    propertyType,
    occupancy: raw.energy?.occupancy ?? null,
    streetEasy,
    branding: brandingResearch,
    raw,
  });
  if (knownFacts?.amenities?.length || knownFacts?.commercialSignals?.length || knownFacts?.streetEasyUrl) {
    const unique = (items: Array<string | null | undefined>) => [...new Set(items.map(i => String(i || '').trim()).filter(Boolean))];
    commercialIntel = {
      ...commercialIntel,
      commercialSignals: unique([...(knownFacts.commercialSignals || []), ...commercialIntel.commercialSignals]),
      amenities: unique([...(knownFacts.amenities || []), ...commercialIntel.amenities]),
      revenueOpportunities: unique([...(knownFacts.revenueOpportunities || []), ...commercialIntel.revenueOpportunities]),
      officialWebsite: knownFacts.officialWebsite || knownFacts.streetEasyUrl || commercialIntel.officialWebsite,
      brandingTitle: knownFacts.brandingTitle || commercialIntel.brandingTitle,
      brandingDescription: knownFacts.brandingDescription || commercialIntel.brandingDescription,
      brandingImages: knownFacts.imageUrls?.length ? knownFacts.imageUrls : commercialIntel.brandingImages,
      researchSources: unique([...(knownFacts.researchSources || []), ...commercialIntel.researchSources]),
      researchStatus: 'verified',
    };
  }
  if (is279CentralParkWestSubject(reportAddress, buildingName, knownFacts?.canonicalAddress)) {
    commercialIntel = {
      ...commercialIntel,
      commercialSignals: removeStale279ManagementReferences(commercialIntel.commercialSignals),
      likelyCommercialUses: removeStale279ManagementReferences(commercialIntel.likelyCommercialUses),
      amenities: removeStale279ManagementReferences(commercialIntel.amenities),
      revenueOpportunities: removeStale279ManagementReferences(commercialIntel.revenueOpportunities),
      brandingDescription: commercialIntel.brandingDescription && /halstead/i.test(commercialIntel.brandingDescription) ? null : commercialIntel.brandingDescription,
      researchSources: removeStale279ManagementReferences(commercialIntel.researchSources),
    };
  }

  const streetEasyImageSplit = splitPropertyImages(streetEasy?.photos || []);
  const knownImageSplit = splitPropertyImages(knownFacts?.imageUrls || []);
  const effectiveBuildingPhotos = knownFacts?.imageUrls?.length
    ? {
        exterior: [...knownImageSplit.exterior, ...streetEasyImageSplit.exterior],
        interior: knownImageSplit.interior,
        streetView: buildingPhotos?.streetView || '',
        satellite: buildingPhotos?.satellite || '',
        source: `Verified ${knownFacts.buildingName || 'subject property'} asset library`,
      }
    : streetEasy?.photos?.length
      ? {
          exterior: streetEasyImageSplit.exterior,
          interior: streetEasyImageSplit.interior,
          streetView: buildingPhotos?.streetView || '',
          satellite: buildingPhotos?.satellite || '',
          source: 'StreetEasy public building photos',
        }
    : buildingPhotos ? { ...buildingPhotos, interior: buildingPhotos.interior || [] } : buildingPhotos;
  // Prefer the geocoder's real neighborhood over keyword guessing, which
  // mislabeled downtown streets as Midtown. Manual overrides win for border
  // blocks where the marketing neighborhood differs from the city's polygon
  // (e.g. Walker Street reads as Chinatown in city data but pitches as Tribeca).
  const neighborhoodOverride = /\bwalker\s+st/i.test(reportAddress) ? 'Tribeca' : '';
  const effectiveNeighborhoodName = knownFacts?.neighborhoodName || neighborhoodOverride || streetEasy?.neighborhood || (raw as any)?.resolvedNeighborhood || detectNeighborhood(reportAddress, effectiveBorough);
  const neighborhoodSearchContext = buildNeighborhoodSearchContext({
    address: reportAddress,
    borough: effectiveBorough,
    neighborhoodName: effectiveNeighborhoodName,
    zipCode: zip,
    raw,
  });
  const publicRecordsLoaded = Boolean(
    dof?.bbl
    || raw.registration?.buildingId
    || raw.registration?.registrationId
    || raw.hpdContacts?.length
    || raw.energy
    || raw.acris
    || raw.dofAbatement
    || raw.taxLiens?.sourceStatus
  );
  const [violationSummary, complaint311Rows] = await Promise.all([
    searchViolations(reportAddress, effectiveBorough || 'Manhattan').catch(() => null as ViolationSummary | null),
    fetch311Complaints(reportAddress, effectiveBorough || 'Manhattan', 365).catch(() => []),
  ]);
  const complaint311Count = complaint311Rows.length || neighborhoodIntel?.complaints311Total || 0;
  const acrisLienClaimCount = countAcrisLienClaimRecords(raw.acris?.records || []);
  const complianceCoverage = buildComplianceSourceChecks({
    raw,
    violationSummary,
    complaint311Count,
    acrisLienClaimCount,
    units,
  });
  const managementAssessment = gradeManagement({
    violationsOpen: raw.violations?.open || 0,
    violationsTotal: raw.violations?.total || 0,
    dobViolationOpen: violationSummary?.dobOpen || 0,
    ecbCount: raw.ecb?.count || violationSummary?.ecbOpen || 0,
    ecbPenaltyBalance: raw.ecb?.totalPenaltyBalance || 0,
    hasActiveLitigation: raw.litigation?.hasActive || false,
    litigationCount: raw.litigation?.count || 0,
    permitsCount: raw.permits?.count || 0,
    hasRecentPermits: raw.permits?.hasRecent || false,
    facadeIssueCount: raw.facade?.issueCount || 0,
    facadeFilingCount: raw.facade?.count || 0,
    hasTaxLien: raw.taxLiens?.hasLien || false,
    taxLienRecordCount: raw.taxLiens?.recordCount || 0,
    acrisLienClaimCount,
    complaint311Count,
    ll97Penalty: ll97Data?.period1Penalty || 0,
    complianceReleaseStatus: complianceCoverage.status,
    publicRecordsLoaded,
  });

  const reportData: MasterReportData = {
    address: reportAddress,
    borough: effectiveBorough,
    buildingName,
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    units,
    stories,
    yearBuilt: knownFacts?.yearBuilt || dof?.yearBuilt || streetEasy?.yearBuilt || 0,
    buildingClass: effectiveBuildingClass,
    taxClass: knownFacts?.taxClass || dof?.taxClass || '',
    marketValue: effectiveMarketValue,
    assessedValue: knownFacts?.assessedValue || dof?.assessedValue || 0,
    landValue: dof?.landValue || 0,
    lotArea: knownFacts?.lotArea || dof?.lotArea || 0,
    buildingArea: knownFacts?.buildingArea || gfa,
    // Ownership priority: HPD registration and ACRIS deed parties identify the
    // beneficial owner; DOF/PLUTO often lists a recording agency (e.g. DCAS)
    // rather than the ownership entity, so it comes last.
    dofOwner: knownFacts?.dofOwner
      || raw.registration?.owner
      || (raw.acris?.lastSaleBuyer)
      || dof?.owner
      || raw.dofAbatement?.ownerName
      || (raw.dobOwners?.[0]?.name)
      || '',
    bbl: knownFacts?.bbl || dof?.bbl || '',
    unitsResidential: (dof as any)?.unitsResidential || 0,
    unitsTotalAll: (dof as any)?.unitsTotalAll || 0,
    nearbySubways: (raw as any)?.nearbySubways || [],
    registrationOwner: knownFacts?.dofOwner
      || raw.registration?.owner
      || (raw.dobOwners?.[0]?.name)
      || raw.dofAbatement?.ownerName
      || null,
    managementCompany: knownFacts?.managementCompany || knownFacts?.currentManagement || raw.registration?.managementCompany || null,
    violationsTotal: knownFacts?.hpdViolationsTotal ?? raw.violations?.total ?? 0,
    violationsOpen: knownFacts?.hpdViolationsOpen ?? raw.violations?.open ?? 0,
    violationClassA: classA,
    violationClassB: classB,
    violationClassC: classC,
    lastViolationDate: raw.violations?.lastDate || null,
    ecbCount: raw.ecb?.count || 0,
    ecbPenaltyBalance: raw.ecb?.totalPenaltyBalance || 0,
    permitsCount: raw.permits?.count || 0,
    hasRecentPermits: raw.permits?.hasRecent || false,
    energyStarScore: knownFacts?.energyStarScore ?? raw.energy?.energyStarScore ?? null,
    siteEUI: raw.energy?.siteEUI ?? null,
    ghgEmissions: raw.energy?.ghgEmissions ?? null,
    occupancy: raw.energy?.occupancy ?? null,
    ll97: ll97Data,
    lastSaleDate: knownFacts?.lastSaleDate || raw.acris?.lastSaleDate || null,
    lastSalePrice: knownFacts?.lastSalePrice ?? raw.acris?.lastSalePrice ?? 0,
    lastSaleBuyer: knownFacts?.lastSaleBuyer || raw.acris?.lastSaleBuyer || null,
    lastSaleSeller: knownFacts?.lastSaleSeller || raw.acris?.lastSaleSeller || null,
    deedCount: raw.acris?.deeds?.length || 0,
    mortgageCount: raw.acris?.mortgages?.length || 0,
    litigationCount: raw.litigation?.count || 0,
    hasActiveLitigation: raw.litigation?.hasActive || false,
    isRentStabilized: raw.rentStabilization?.isStabilized || false,
    dobViolationCount: knownFacts?.dobViolationCount ?? violationSummary?.violations.filter(v => v.source === 'DOB').length ?? 0,
    dobViolationOpen: knownFacts?.dobViolationCount ?? violationSummary?.dobOpen ?? 0,
    facadeFilingCount: raw.facade?.count || 0,
    facadeIssueCount: raw.facade?.issueCount || 0,
    dhcrRecordCount: raw.rentStabilization?.data?.length || 0,
    courtIndexCount: raw.litigation?.count || 0,
    acrisLienClaimCount,
    complianceSourceChecks: complianceCoverage.checks,
    complianceReleaseStatus: complianceCoverage.status,
    distressScore: distressReport.score,
    distressLevel: distressReport.level,
    distressSignals: distressReport.signals.map(s => ({ type: s.type, description: s.description, severity: s.severity })),
    scoutScore: score,
    scoutGrade: grade,
    complaint311Count,
    latitude: knownFacts?.latitude ?? geo?.lat ?? null,
    longitude: knownFacts?.longitude ?? geo?.lng ?? null,
    propertyType,
    neighborhoodName: effectiveNeighborhoodName,
    zipCode: neighborhoodSearchContext.zipCode,
    neighborhoodSearchContext,
    neighborhoodMarketData: lookupNeighborhoodData(effectiveNeighborhoodName || detectNeighborhood(reportAddress, effectiveBorough)),
    registrationDate: raw.registration?.registrationId ? null : null,
    managementDuration: null,
    managementGrade: managementAssessment.grade,
    managementScorecard: managementAssessment.scorecard,
    boardMembers: (() => {
      const members: Array<{ name: string; title: string }> = [...(knownFacts?.boardMembers || [])];
      // HPD MDR Contacts — the gold standard for building contacts
      for (const c of (raw.hpdContacts || [])) {
        if (c.type === 'CorporateOwner' && c.corp) {
          members.push({ name: c.corp, title: 'Corporate Owner (HPD MDR)' });
        }
        if (c.type === 'HeadOfficer' && c.name) {
          members.push({ name: c.name, title: c.title || 'Head Officer / Board President (HPD MDR)' });
        }
        if (c.type === 'Officer' && c.name) {
          members.push({ name: c.name, title: c.title ? `${c.title} (HPD MDR)` : 'Officer / Board Member (HPD MDR)' });
        }
      }
      // HPD Registration owner (if not already captured)
      if (raw.registration?.owner && !members.some(m => m.name.toUpperCase() === raw.registration.owner.toUpperCase())) {
        members.push({ name: raw.registration.owner, title: 'Registered Owner (HPD)' });
      }
      // DOF owner (if different)
      const dofName = knownFacts?.dofOwner ? '' : (dof?.owner || raw.dofAbatement?.ownerName || '');
      if (dofName && !members.some(m => m.name.toUpperCase() === dofName.toUpperCase())) {
        members.push({ name: dofName, title: 'Property Owner (DOF)' });
      }
      // DOB permit owners (if different)
      for (const o of (raw.dobOwners || []).slice(0, 3)) {
        if (o.name && !members.some(m => m.name.toUpperCase() === o.name.toUpperCase())) {
          members.push({ name: o.name + (o.businessName ? ' / ' + o.businessName : ''), title: `Owner (DOB Permits)${o.phone ? ' · ' + o.phone : ''}` });
        }
      }
      // ACRIS last buyer (if different)
      const acrisBuyer = raw.acris?.lastSaleBuyer;
      if (acrisBuyer && !members.some(m => m.name.toUpperCase() === acrisBuyer.toUpperCase())) {
        members.push({ name: acrisBuyer, title: 'Last Buyer (ACRIS)' });
      }
      return members;
    })(),
    buildingStaff: (() => {
      const staff: Array<{ role: string; name: string }> = [...(knownFacts?.buildingStaff || [])];
      for (const c of (raw.hpdContacts || [])) {
        if (c.type === 'SiteManager' && (c.name || c.corp)) staff.push({ role: 'Site Manager / Resident Manager (HPD MDR)', name: c.name || c.corp });
        if (c.type === 'Agent' && c.name) staff.push({ role: 'Managing Agent', name: `${c.name}${c.corp ? ' — ' + c.corp : ''}` });
      }
      return staff;
    })(),
    professionals: {
      lawFirm: knownFacts?.lawFirm || null,
      accountingFirm: knownFacts?.accountingFirm || null,
      engineer: (raw.dobProfessionals || []).find((p: any) => p.role === 'engineer')?.name
        || knownFacts?.professionalEngineers?.[0]?.name
        || (raw.permits?.items?.[0]?.owner_s_first_name ? `${raw.permits.items[0].owner_s_first_name} ${raw.permits.items[0].owner_s_last_name || ''}`.trim() : null),
      architect: (raw.dobProfessionals || []).find((p: any) => p.role === 'architect')?.name
        || knownFacts?.professionalArchitects?.[0]?.name
        || null,
    },
    dobArchitects: (() => {
      const rows = [
        ...(knownFacts?.professionalArchitects || []),
        ...(raw.dobProfessionals || []).filter((p: any) => p.role === 'architect').map((p: any) => ({ name: p.name, title: p.title, license: p.license })),
      ];
      const seen = new Set<string>();
      return rows.filter(row => {
        const key = `${row.name}|${row.title}`.toUpperCase();
        if (!row.name || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })(),
    dobEngineers: (() => {
      const rows = [
        ...(knownFacts?.professionalEngineers || []),
        ...(raw.dobProfessionals || []).filter((p: any) => p.role === 'engineer').map((p: any) => ({ name: p.name, title: p.title, license: p.license })),
      ];
      const seen = new Set<string>();
      return rows.filter(row => {
        const key = `${row.name}|${row.title}`.toUpperCase();
        if (!row.name || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })(),
    dobOwners: (raw.dobOwners || []).map((o: any) => ({ name: o.name, businessName: o.businessName, phone: o.phone, type: o.type })),
    contactResearchSources: [
      raw.hpdContacts?.length ? `HPD MDR contacts loaded (${raw.hpdContacts.length})` : 'HPD MDR contacts searched: no contact rows returned',
      raw.acris?.records?.length ? `ACRIS party records loaded (${raw.acris.records.length})` : 'ACRIS party records searched: no recent parent-lot transfer parties returned',
      raw.dobProfessionals?.length ? `DOB applicant professionals loaded (${raw.dobProfessionals.length})` : 'DOB permit professionals searched: no applicant professionals returned',
      raw.dobOwners?.length ? `DOB owner contacts loaded (${raw.dobOwners.length})` : 'DOB permit owner contacts searched: no owner contacts returned',
      'PropertyShark owner / contact verification required before publishing private contact claims',
      'Apollo enrichment available when APOLLO_API_KEY is configured; run against managing agent, board entity, and professional firms',
    ],
    professionalResearchSources: [
      ...(knownFacts?.professionalSources || []),
      unitSourceSummary ? `Unit-count reconciliation: ${unitSourceSummary}; selected ${units}` : 'Unit-count reconciliation found no source candidates',
      raw.dobProfessionals?.length ? `DOB permit applicant professionals loaded (${raw.dobProfessionals.length})` : 'DOB permit applicant professionals searched',
      raw.acris?.records?.length ? `ACRIS deed/mortgage party records loaded (${raw.acris.records.length})` : 'ACRIS searched for owner/professional party signals',
      raw.ecb?.count ? `ECB/OATH compliance records loaded (${raw.ecb.count})` : 'ECB/OATH searched for compliance/professional context',
      raw.dofAbatement ? 'DOF condo/co-op abatement records loaded' : 'DOF condo/co-op abatement records searched',
      raw.dof ? 'Department of Finance property record loaded' : 'Department of Finance property record searched',
      'Domecile building profile should be checked for management, fees, staff, and professional references',
      'RPIE filings / income-expense context should be reviewed where applicable',
      'Offering plans and bank questionnaires should be reviewed before publishing law firm or accounting firm names',
    ],
    hasAbatement: raw.dofAbatement?.hasAbatement || false,
    abatementAmount: raw.dofAbatement?.currentExemption || 0,
    hasTaxLien: raw.taxLiens?.hasLien || false,
    abatementType: raw.dofAbatement?.abatementType || 'DOF record not found',
    abatementTaxYear: raw.dofAbatement?.taxYear || null,
    abatementSourceStatus: raw.dofAbatement?.sourceStatus || null,
    abatementMatchedLot: raw.dofAbatement?.matchedLot || null,
    dofTaxMarketValue: raw.dofAbatement?.marketValue || dof?.marketValue || 0,
    dofTaxAssessedValue: raw.dofAbatement?.assessedValue || 0,
    taxLienSourceStatus: raw.taxLiens?.sourceStatus || null,
    taxLienRecordCount: raw.taxLiens?.recordCount || 0,
    taxLienMatchedLots: raw.taxLiens?.matchedLots || [],
    taxLienDetails: raw.taxLiens?.liens || [],
    pricePerUnit,
    monthlyFee,
    annualFee,
    tieredPricing: tier,
    feeComparison,
    streetEasy,
    commercialIntel,
    buildingPhotos: effectiveBuildingPhotos,
    neighborhoodIntel,
    raw: {
      ...raw,
      knownFacts: knownFacts || null,
    },
  };

  return applyJackieFactAuthority(normalize36East22ndStreetReportData(normalize279CentralParkWestReportData(reportData))).data as MasterReportData;
}

// ============================================================
// QA Checklist — Validates report data before generation
// ============================================================

export interface QACheckResult {
  passed: boolean;
  checks: { name: string; status: 'pass' | 'warn' | 'fail'; detail: string }[];
  warnings: number;
  failures: number;
}

function getManagementPublicRiskSignals(d: MasterReportData): string[] {
  const fmtRiskMoney = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;
  return [
    d.violationsOpen > 0 ? `${d.violationsOpen} open HPD violation(s)` : null,
    d.dobViolationOpen > 0 ? `${d.dobViolationOpen} open DOB violation signal(s)` : null,
    d.ecbCount > 0 ? `${d.ecbCount} ECB/OATH record(s)` : null,
    d.ecbPenaltyBalance > 0 ? `${fmtRiskMoney(d.ecbPenaltyBalance)} ECB penalty balance` : null,
    d.hasActiveLitigation || d.litigationCount > 0 ? `${Math.max(d.litigationCount, 1)} litigation signal(s)` : null,
    d.hasTaxLien || d.taxLienRecordCount > 0 ? `${Math.max(d.taxLienRecordCount, 1)} DOF tax lien notice row(s)` : null,
    d.acrisLienClaimCount > 0 ? `${d.acrisLienClaimCount} ACRIS lien/claim document(s)` : null,
    d.facadeIssueCount > 0 ? `${d.facadeIssueCount} FISP/facade issue signal(s)` : null,
    d.ll97?.period1Penalty ? `${fmtRiskMoney(d.ll97.period1Penalty)} LL97 annual exposure` : null,
    d.complianceReleaseStatus === 'blocked' ? 'compliance source coverage blocked release' : null,
    d.complianceReleaseStatus === 'needs_review' ? 'compliance source coverage needs review' : null,
  ].filter((signal): signal is string => Boolean(signal));
}

export function runReportQA(d: MasterReportData): QACheckResult {
  const checks: QACheckResult['checks'] = [];
  const isHoaRecovery = isHoaExecutiveRecoveryReport(d);
  const isFloridaReceivership = isFloridaReceivershipReport(d);
  
  // 1. Address populated
  checks.push({ name: 'Address', status: d.address ? 'pass' : 'fail', detail: d.address || 'MISSING' });
  
  // 2. Building name (not just the address repeated)
  checks.push({ name: 'Building Name', status: d.buildingName && d.buildingName !== d.address ? 'pass' : 'warn', detail: d.buildingName || 'Using address as name' });
  
  // 3. Unit count
  checks.push({ name: 'Unit Count', status: d.units > 0 ? 'pass' : 'warn', detail: d.units > 0 ? `${d.units} units` : 'N/A — estimated from building area' });
  
  const suspiciousTinyUnitCount = d.units > 0
    && d.units <= 5
    && (d.stories >= 10 || d.buildingArea >= 75000 || d.marketValue >= 50000000);
  checks.push({
    name: 'Unit Count Plausibility',
    status: suspiciousTinyUnitCount ? 'fail' : 'pass',
    detail: suspiciousTinyUnitCount
      ? `${d.units} units conflicts with high-rise / large-building signals; verify address, BBL, StreetEasy, DOB, HPD MDR, DOF, and offering plan before release`
      : 'Unit count is plausible for available building size signals',
  });

  // 4. Year Built
  checks.push({ name: 'Year Built', status: d.yearBuilt > 0 ? 'pass' : 'warn', detail: d.yearBuilt > 0 ? `${d.yearBuilt}` : 'N/A — DOF data not available' });
  
  // 5. Market Value
  checks.push({ name: 'Market Value', status: d.marketValue > 0 ? 'pass' : 'warn', detail: d.marketValue > 0 ? `$${d.marketValue.toLocaleString()}` : '$0 — DOF/PLUTO lookup failed' });
  
  // 6. Management Company
  checks.push({ name: 'Management Company', status: d.managementCompany ? 'pass' : 'warn', detail: d.managementCompany || 'Not found in HPD registration — check if address format matches' });
  
  // 7. Violations and compliance source coverage
  const complianceSources = d.complianceSourceChecks || [];
  const coreComplianceSources = isFloridaReceivership
    ? ['Miami-Dade Property Appraiser', 'Miami-Dade Clerk of Courts', 'Miami-Dade Official Records', 'City of North Miami Building Department', 'Florida DBPR', 'Sunbiz', 'Miami-Dade Tax Collector']
    : ['HPD Online', 'DOB BIS', 'DOB NOW Safety', 'ECB/OATH', 'DOF tax liens', 'ACRIS', 'DHCR', '311 Service Requests'];
  const missingCoreComplianceSources = coreComplianceSources.filter(source => !complianceSources.some(check => check.source.includes(source)));
  const automatedRiskRows = d.violationsTotal + d.dobViolationOpen + d.ecbCount + d.litigationCount + d.taxLienRecordCount + d.acrisLienClaimCount + d.complaint311Count + d.facadeFilingCount + d.permitsCount;
  const suspiciousAllZero = !isHoaRecovery && !isFloridaReceivership && d.units >= 10 && automatedRiskRows === 0;
  checks.push({
    name: 'Violation Source Coverage',
    status: (!isHoaRecovery && !isFloridaReceivership && missingCoreComplianceSources.length) || suspiciousAllZero ? 'fail' : 'pass',
    detail: isFloridaReceivership
      ? 'Florida receivership mode: Miami-Dade, North Miami, Florida DBPR, Sunbiz, court, tax, flood, insurance, and association records replace non-Florida feeds'
      : isHoaRecovery
      ? 'Connecticut HOA proposal mode: NYC violation feeds are not applicable; HOA, municipal, insurance, restoration, and vendor files are flagged for transition review'
      : missingCoreComplianceSources.length
      ? `Missing source check(s): ${missingCoreComplianceSources.join(', ')}`
      : suspiciousAllZero
        ? 'All automated compliance/lien/litigation/311 sources returned zero for a multi-unit NYC building; manual verification required before release'
        : `${d.violationsTotal} HPD, ${d.dobViolationOpen} DOB open, ${d.ecbCount} ECB/OATH, ${d.facadeFilingCount} FISP/facade, ${d.permitsCount} DOB permit, ${d.litigationCount} litigation, ${d.taxLienRecordCount} DOF tax lien, ${d.acrisLienClaimCount} ACRIS lien/claim, ${d.complaint311Count} 311 signal(s)`,
  });

  const managementRiskSignals = getManagementPublicRiskSignals(d);
  checks.push({
    name: 'Current Management Score Reconciliation',
    status: managementRiskSignals.length && d.managementScorecard.overall >= 95 ? 'fail' : 'pass',
    detail: managementRiskSignals.length
      ? `Score ${d.managementScorecard.overall}/100 reconciled against: ${managementRiskSignals.slice(0, 6).join(', ')}`
      : `Score ${d.managementScorecard.overall}/100; no material public-record management risk signal loaded`,
  });
  
  // 8. Fee calculation sanity check
  const feePerUnit = d.tieredPricing?.intelligence?.perUnit || d.pricePerUnit;
  const feeOk = isFloridaReceivership ? true : isHoaRecovery ? d.monthlyFee >= 4500 && d.monthlyFee <= 7500 : feePerUnit >= 40 && feePerUnit <= 200;
  checks.push({
    name: 'Fee Calculation',
    status: feeOk ? 'pass' : 'warn',
    detail: isFloridaReceivership
      ? 'Florida receivership mode: pricing should be finalized after court file, budget, staffing, vendor, insurance, and site-condition review'
      : isHoaRecovery
      ? `$${d.monthlyFee.toLocaleString()}/mo HOA executive management proposal range${!feeOk ? ' — REVIEW: outside requested HOA range' : ''}`
      : `$${feePerUnit}/unit/mo (Intelligence tier)${!feeOk ? ' — REVIEW: may be too low or high for this building class' : ''}`,
  });
  
  // 9. Borough detected
  checks.push({ name: 'Borough', status: d.borough ? 'pass' : 'warn', detail: d.borough || 'Not detected' });
  
  // 10. LL97 assessment (only relevant for buildings >25,000 sqft)
  const hasLL97 = d.ll97 !== null;
  checks.push({ name: 'LL97 Data', status: hasLL97 ? 'pass' : 'warn', detail: hasLL97 ? `Status: ${d.ll97!.complianceStatus}` : 'No energy data — building may be <25K sqft or not benchmarked' });
  
  // 11. Property type determined
  checks.push({ name: 'Property Type', status: d.propertyType ? 'pass' : 'warn', detail: d.propertyType || 'Defaulting to Residential' });
  
  // 12. Neighborhood determined
  checks.push({ name: 'Neighborhood', status: d.neighborhoodName ? 'pass' : 'warn', detail: d.neighborhoodName || 'Not detected — using borough' });

  const warnings = checks.filter(c => c.status === 'warn').length;
  const failures = checks.filter(c => c.status === 'fail').length;
  
  return { passed: failures === 0, checks, warnings, failures };
}

export type JackieValidationPackage = 'first_email_intro' | 'board_meeting_deck' | 'appendix_full';

export function validateJackieReport(
  d: MasterReportData,
  rawHtml: string,
  options: { packageType?: JackieValidationPackage } = {},
): QACheckResult {
  const base = runReportQA(d);
  const checks: QACheckResult['checks'] = [...base.checks];
  const html = sanitizeJackieKnownPropertyHtml(rawHtml, d).data;
  const stripEmbeddedImagePayloads = (markup: string) =>
    markup.replace(/data:image\/[a-z0-9.+-]+;base64,[^"']*/gi, 'data:image/embedded;base64,[embedded-image]');
  const htmlWithoutEmbeddedImagePayloads = stripEmbeddedImagePayloads(html);
  const isValidEmbeddedImageSrc = (src: string) => {
    if (!/^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i.test(src)) return false;
    const payload = src.split(',').slice(1).join(',').replace(/\s/g, '');
    // Base64 text can naturally contain sequences like "NaN"; validate the
    // payload shape instead of treating those characters as render tokens.
    return payload.length > 80 && /^[A-Za-z0-9+/=]+$/.test(payload);
  };
  const isBrokenImageSrc = (src: string) => {
    const cleanSrc = String(src || '').trim();
    if (!cleanSrc) return true;
    if (/^data:image\//i.test(cleanSrc)) return !isValidEmbeddedImageSrc(cleanSrc);
    return /undefined|null|NaN|\[object Object\]|New%20York%2C%20NY%2C%20New%20York%2C%20NY/i.test(cleanSrc);
  };
  const summarizeImageSrc = (src: string) => /^data:image\//i.test(src)
    ? src.replace(/^(data:image\/[a-z0-9.+-]+;base64,).*/i, '$1[embedded-image]')
    : src;
  const isHoaRecovery = isHoaExecutiveRecoveryReport(d);
  const isFloridaReceivership = isFloridaReceivershipReport(d);
  const isKnownStaffedProperty = /one\s+museum\s+mile|1280\s+(fifth|5th)/i.test(`${d.buildingName} ${d.address}`);
  const is201East79 = /201\s+e(ast)?\s+79/i.test(`${d.buildingName} ${d.address}`);
  const is22East22 = hasExact22East22Subject(d.address, d.buildingName);
  const is36East22 = is36East22ndStreetSubject(d.address, d.buildingName, d.managementCompany);
  const is279Cpw = is279CentralParkWestSubject(d.address, d.buildingName, d.managementCompany);
  const inferredPackage: JackieValidationPackage = options.packageType
    || (/First Email Intro/i.test(html) ? 'first_email_intro'
      : /Meeting Agenda Deck|1st Meeting Handout|Board Meeting Deck/i.test(html) ? 'board_meeting_deck'
      : 'appendix_full');
  const isFirstEmailIntro = inferredPackage === 'first_email_intro';
  const isBoardMeetingDeck = inferredPackage === 'board_meeting_deck';
  const isAppendixFull = inferredPackage === 'appendix_full';
  const requiredSlides = isFloridaReceivership
    ? [
        'Florida Receivership Property Management Takeover',
        'Receivership Operating Summary',
        'North Miami / Miami-Dade Source Stack',
        'Receivership Signals',
        'Property Snapshot',
        'Receiver Management Transition Plan',
        'Florida Compliance and Code Review',
        'Camelot Operating Model',
        'Managing Agent Scope',
        'Required Intake Request',
        'Next Steps',
      ]
    : isFirstEmailIntro
    ? [
        'First Email Intro',
        'Cover Letter',
        'Property Snapshot &amp; New York Reach',
        'Proposed Next Step',
      ]
    : isBoardMeetingDeck
    ? [
        'Meeting Agenda Deck',
        'The Property',
        'Building Intelligence',
        'Why Camelot',
        'About Camelot',
        'Core Services',
        'Technology Platform',
        'The 90-Day Transition',
        'The Proposed Investment',
        'Next Steps',
        'Thank You',
      ]
    : [
        'Elevating',
        'The Property',
        'Commercial &amp; Amenity Intelligence',
        'Location &amp; Neighborhood',
        'Inquiry-Driven Focus',
        'Community &amp; Industry Partnerships',
        'Creative Staffing &amp; Operating Model',
        'Experience Meets Innovation',
        'Core Services',
        'Value-Added Services',
        'Compliance &amp; Local Law 97',
        'Technology Platform Partners',
        'The 90-Day Transition',
        'Your Investment',
        'The Proposed Investment',
        'Next Steps',
        'Thank You',
      ];
  for (const slide of requiredSlides) {
    checks.push({
      name: `Slide: ${slide.replace('&amp;', '&')}`,
      status: html.includes(slide) ? 'pass' : 'fail',
      detail: html.includes(slide) ? 'Present' : 'Missing from generated report',
    });
  }
  const forbidden = ['undefined', 'NaN', '[object Object]', 'New York, NY, New York, NY', 'New%20York%2C%20NY%2C%20New%20York%2C%20NY'];
  for (const token of forbidden) {
    checks.push({
      name: `Render Token: ${token}`,
      status: htmlWithoutEmbeddedImagePayloads.includes(token) ? 'fail' : 'pass',
      detail: htmlWithoutEmbeddedImagePayloads.includes(token) ? `Generated HTML contains ${token}` : 'Clean',
    });
  }
  if (isFloridaReceivership) {
    const requiredFloridaTokens = [
      'Miami-Dade Property Appraiser',
      'Miami-Dade Clerk of Courts',
      'Miami-Dade Official Records',
      'City of North Miami Building Department',
      'Florida DBPR',
      'Sunbiz',
      'Miami-Dade Tax Collector',
      'FEMA Flood Map Service Center',
      '40-year certification',
      'fire sprinkler',
      'refinance',
      'court-appointed receiver',
      'past board members',
      'licensed CAM operator',
      'Managing Agent Scope',
      'lock-box',
      '89-unit',
      'Built in 1972',
    ];
    const missingFloridaTokens = requiredFloridaTokens.filter(token => !html.includes(token));
    checks.push({
      name: 'Florida / Miami-Dade Source Stack',
      status: missingFloridaTokens.length === 0 ? 'pass' : 'fail',
      detail: missingFloridaTokens.length ? `Missing Florida token(s): ${missingFloridaTokens.join(', ')}` : 'Florida, Miami-Dade, North Miami, court, tax, flood, DBPR, and Sunbiz sources are represented',
    });
    const forbiddenFloridaTokens = ['HPD', 'DOB BIS', 'DOB NOW', 'ECB/OATH', 'ACRIS', 'LL97', 'Local Law', 'FISP', 'RPIE', 'StreetEasy', 'NYC Open Data', 'NYSCEF', 'New York management partner', 'New York State', 'NYS', 'NYC', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
    const foundForbiddenFloridaTokens = forbiddenFloridaTokens.filter(token => html.includes(token));
    checks.push({
      name: 'Florida Jurisdiction Purity',
      status: foundForbiddenFloridaTokens.length === 0 ? 'pass' : 'fail',
      detail: foundForbiddenFloridaTokens.length ? `Remove non-Florida token(s): ${foundForbiddenFloridaTokens.join(', ')}` : 'No non-Florida jurisdiction source language found in the generated report',
    });
    checks.push({
      name: 'Subject Address Match',
      status: html.includes(d.address) ? 'pass' : 'fail',
      detail: html.includes(d.address) ? d.address : 'Subject address missing from report',
    });
    checks.push({
      name: 'Florida Subject Imagery / Map',
      status: html.includes('maps.googleapis.com/maps/api/streetview') && html.includes('google.com/maps/embed/v1/place') ? 'pass' : 'fail',
      detail: 'Florida report must include subject Street View fallback and a North Miami map until uploaded receiver photos are available',
    });
    const warnings = checks.filter(c => c.status === 'warn').length;
    const failures = checks.filter(c => c.status === 'fail').length;
    return { passed: failures === 0, checks, warnings, failures };
  }
  checks.push({
    name: 'Subject Address Match',
    status: html.includes(d.address) ? 'pass' : 'fail',
    detail: html.includes(d.address) ? d.address : 'Subject address missing from report',
  });
  checks.push({
    name: 'Subject Building Photo',
    status: d.buildingPhotos?.exterior?.length || html.includes('Photo fallback unavailable') ? 'pass' : 'warn',
    detail: d.buildingPhotos?.exterior?.length
      ? `${d.buildingPhotos.exterior.length} preferred image(s) available`
      : 'Street View image fallback is embedded for the subject property',
  });
  if (isAppendixFull) {
    checks.push({
      name: 'StreetEasy Photo Source Rule',
      status: html.includes('StreetEasy public building photos') || html.includes('onerror="if(this.src!==') ? 'pass' : 'fail',
      detail: 'Subject property images must prefer verified/uploaded images, then StreetEasy public building photos when available, then Google Street View fallback',
    });
    checks.push({
      name: 'Subject Image Fallback Chain',
      status: html.includes('data-fallback-index') && html.includes('data-image-source') ? 'pass' : 'fail',
      detail: 'Subject image slots must try verified/uploaded assets, official branding images, StreetEasy photos, and Google Street View before showing a placeholder',
    });
  }
  const landmarkLabels = resolveNearbyLandmarkLabels(d);
  const nearbyLandmarksBlock = (html.match(/<h4>Nearby Landmarks<\/h4>[\s\S]*?<\/ul>/i) || [])[0] || '';
  const landmarkItemCount = (nearbyLandmarksBlock.match(/<li\b/gi) || []).length;
  if (isAppendixFull) {
    checks.push({
      name: 'Nearby Landmarks',
      status: landmarkLabels.length >= 3 && landmarkItemCount >= 3 ? 'pass' : 'fail',
      detail: landmarkLabels.length >= 3
        ? `${landmarkItemCount} landmark item(s) rendered from LPC / neighborhood fallback context`
        : 'Nearby Landmarks must use LPC Discover NYC Landmarks, known-property, or neighborhood fallback data before release',
    });
  }
  checks.push({
    name: 'Camelot Logo',
    status: html.includes('./images/camelot-logo.png') || html.includes('./images/camelot-logo-white.png') || html.includes('logo-badge-text') ? 'pass' : 'fail',
    detail: 'Brand logo reference verified',
  });
  const closingTokens = [
    'New Yorkers for New Yorkers',
    'Jackie Kennedy',
    'https://zoom.us/start/videomeeting',
    'tel:+12122069939;ext=701',
    'Call 212-206-9939 x701',
    CAMELOT.address,
    CAMELOT.email,
  ];
  const missingClosingTokens = closingTokens.filter(token => !html.includes(token));
  if (isAppendixFull) {
    checks.push({
      name: 'Closing Contact Links',
      status: missingClosingTokens.length === 0 ? 'pass' : 'fail',
      detail: missingClosingTokens.length === 0
        ? 'Closing page includes Camelot values language, Zoom, Google Meet, phone, email, and current office address'
        : `Missing closing contact token(s): ${missingClosingTokens.join(', ')}`,
    });
  }
  const imageSources = [...html.matchAll(/<img\b[^>]*?\s+src=(["'])(.*?)\1/gi)].map(m => m[2]);
  const badImages = imageSources.filter(isBrokenImageSrc);
  const badEmbeddedImages = badImages.filter(src => /^data:image\//i.test(src));
  const badExternalImages = badImages.filter(src => !/^data:image\//i.test(src));
  checks.push({
    name: 'Picture Links',
    status: badExternalImages.length === 0 ? (badEmbeddedImages.length === 0 ? 'pass' : 'warn') : 'fail',
    detail: badImages.length === 0
      ? `${imageSources.length} image link(s) checked`
      : badExternalImages.length
        ? `Broken/dirty image src: ${badExternalImages.slice(0, 2).map(summarizeImageSrc).join(', ')}`
        : `Uploaded embedded image needs review but will not block internal preview/export: ${badEmbeddedImages.slice(0, 2).map(summarizeImageSrc).join(', ')}`,
  });
  if (/one\s+museum\s+mile|1280\s+(fifth|5th)/i.test(`${d.buildingName} ${d.address}`)) {
    const oneMuseumAssets = imageSources.filter(src => src.includes('./images/one-museum-mile/'));
    checks.push({
      name: 'One Museum Mile Asset Library',
      status: oneMuseumAssets.length >= 4 ? 'pass' : 'fail',
      detail: oneMuseumAssets.length >= 4 ? `${oneMuseumAssets.length} verified local image reference(s)` : 'Missing verified One Museum Mile local image references',
    });
  }
  const unitMentions = [...html.matchAll(/\b(\d{1,4})\s+Units?\b/g)].map(m => Number(m[1]));
  const conflictingUnitMentions = [...new Set(unitMentions.filter(n => n !== d.units))];
  checks.push({
    name: 'Unit Count Consistency',
    status: conflictingUnitMentions.length === 0 ? 'pass' : 'fail',
    detail: conflictingUnitMentions.length === 0 ? `${d.units} units used consistently` : `Report also contains: ${conflictingUnitMentions.join(', ')} units`,
  });
  if (is201East79) {
    const bad201Tokens = ['3062630070', 'Two-Family Dwelling', 'B1', '377 Units', '2 Floors', 'OLIVIA MA AS TRUSTEE'];
    const foundBad201Tokens = bad201Tokens.filter(token => html.includes(token));
    checks.push({
      name: 'Known Property Guard: 201 East 79th',
      status: d.bbl === '1015250001' && d.units >= 100 && d.stories >= 15 && foundBad201Tokens.length === 0 ? 'pass' : 'fail',
      detail: foundBad201Tokens.length
        ? `Rejected Brooklyn/two-family mismatch token(s): ${foundBad201Tokens.join(', ')}`
        : `Using verified Manhattan co-op profile: ${d.units} units, ${d.stories} floors, BBL ${d.bbl}`,
    });
  }
  if (is22East22) {
    const bad22Tokens = ['220 East 22nd', '122 Units', '122-unit', 'Walk-Up Apartment'];
    const foundBad22Tokens = bad22Tokens.filter(token => html.includes(token));
    checks.push({
      name: 'Known Property Guard: 22 East 22nd',
      status: d.address === '22 East 22nd Street, New York, NY 10010'
        && d.units === 19
        && d.propertyType === 'Co-operative / Tenancy-in-Common'
        && foundBad22Tokens.length === 0 ? 'pass' : 'fail',
      detail: foundBad22Tokens.length
        ? `Rejected 220 East 22nd / 122-unit mismatch token(s): ${foundBad22Tokens.join(', ')}`
        : `Using locked small-building profile: ${d.units} units, ${d.stories} floors, ${d.propertyType}`,
    });
  }
  if (is36East22) {
    const bad36Checks = [
      { label: 'Walk-up', pattern: /\bwalk[-\s]?up\b/i },
      { label: 'No elevator', pattern: /\bno\s+elevator\b/i },
      { label: 'Non-elevator', pattern: /\bnon[-\s]?elevator\b/i },
      { label: 'Walk-Up Apartment', pattern: /\bwalk[-\s]?up\s+apartment\b/i },
    ];
    const foundBad36Tokens = bad36Checks.filter(check => check.pattern.test(html)).map(check => check.label);
    checks.push({
      name: 'Known Property Guard: 36 East 22nd',
      status: d.address === EAST_36_22_ADDRESS
        && d.units === CAMELOT_36_EAST_22_UNIT_COUNT
        && /Elevator/i.test(d.propertyType)
        && foundBad36Tokens.length === 0
        && Boolean(d.buildingPhotos?.exterior?.length) ? 'pass' : 'fail',
      detail: foundBad36Tokens.length
        ? `Rejected walk-up/no-elevator mismatch token(s): ${foundBad36Tokens.join(', ')}`
        : `Using locked Story House elevator profile: ${d.units} units, ${d.stories} floors, ${d.propertyType}`,
    });
  }
  if (is279Cpw) {
    const bad279Checks = [
      ...['100 Units', '100-unit', '101 Units', '101-unit', '102 Units', '102-unit', '103 Units', '103-unit', '104 Units', '104-unit', '105 Units', '105-unit']
        .map(token => ({ label: token, pattern: new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })),
    ];
    const foundBad279Tokens = bad279Checks.filter(check => check.pattern.test(html)).map(check => check.label);
    const staleCurrentManagerMention = new RegExp(['H', 'al', 'ste', 'ad'].join(''), 'i').test(html);
    checks.push({
      name: 'Known Property Guard: 279 Central Park West',
      status: d.address === '279 Central Park West, New York, NY 10024'
        && d.units === CAMELOT_279_CPW_UNIT_COUNT
        && /Condominium/i.test(d.propertyType)
        && foundBad279Tokens.length === 0 ? 'pass' : 'fail',
      detail: foundBad279Tokens.length
        ? `Rejected oversized-profile token(s): ${foundBad279Tokens.join(', ')}`
        : `Using locked Central Park West condominium profile: ${d.units} units, ${d.stories} floors, ${d.propertyType}${staleCurrentManagerMention ? '; stale current-manager language sanitized before preview/export' : ''}`,
    });
  }

  // First Email Intro and Meeting Agenda Deck are client-facing summaries.
  // They must pass identity, render, photo, unit-count, and known-property
  // guardrails, but they intentionally do not include every appendix-only
  // source-stack, legal, portfolio, and diligence slide.
  if (!isAppendixFull) {
    const warnings = checks.filter(c => c.status === 'warn').length;
    const failures = checks.filter(c => c.status === 'fail').length;
    return { passed: failures === 0, checks, warnings, failures };
  }

  if (isAppendixFull) {
    const sourceConflictWarning =
      /(must not|will not) publish a board-facing report when BBL, borough, building class, unit count, or floor count conflicts/i.test(html) ||
      (
        /(must not|will not|cannot)\s+publish/i.test(html) &&
        /BBL/i.test(html) &&
        /borough/i.test(html) &&
        /building[-\s]?class/i.test(html) &&
        /unit/i.test(html) &&
        /floor/i.test(html) &&
        /conflict/i.test(html)
      );
    checks.push({
      name: 'Source Conflict Release Gate',
      status: sourceConflictWarning || isHoaRecovery ? 'pass' : 'fail',
      detail: isHoaRecovery
        ? 'Connecticut HOA proposal mode: NYC BBL/borough/building-class conflict gate is not applicable; report is governed by the HOA proposal brief and transition-file review'
        : 'Report must include the hard release gate for BBL/borough/building-class/unit/floor conflicts',
    });
    const requiredComplianceSourceTokens = [
      'Violation Source Coverage',
      'HPD',
      'DOB BIS &amp; DOB NOW',
      'DOB NOW Safety / FISP facade filings',
      'ECB/OATH',
      'DHCR / rent stabilization',
      'DOF tax liens',
      'ACRIS liens',
      '311 Service Requests',
      'NYS eCourts / WebCivil',
      'LexisNexis',
    ];
    const missingComplianceTokens = requiredComplianceSourceTokens.filter(token => !html.includes(token));
    checks.push({
      name: 'Compliance Source Stack',
      status: isHoaRecovery || (missingComplianceTokens.length === 0 && d.complianceReleaseStatus !== 'blocked') ? 'pass' : 'fail',
      detail: isHoaRecovery
        ? 'Connecticut HOA proposal mode uses HOA records, insurance claim files, restoration/vendor records, municipal files, and transition documents instead of NYC HPD/DOB/DOF feeds'
        : missingComplianceTokens.length
        ? `Missing compliance token(s): ${missingComplianceTokens.join(', ')}`
        : d.complianceReleaseStatus === 'blocked'
          ? 'Compliance coverage blocked release; every automated public-risk source returned zero or source coverage is incomplete'
          : 'HPD, DOB, DOB NOW/FISP, ECB/OATH, DHCR, DOF, ACRIS, 311, courts, and LexisNexis/manual enrichment are represented',
    });
  }
  checks.push({
    name: 'Commercial / Amenity Research',
    status: d.commercialIntel?.researchStatus === 'verified' ? 'pass' : 'warn',
    detail: d.commercialIntel?.researchStatus === 'verified'
      ? `Signals: ${[...d.commercialIntel.commercialSignals, ...d.commercialIntel.amenities].slice(0, 5).join(', ') || 'Verified research completed'}`
      : 'No confirmed commercial/amenity/official website signals yet; verify with site visit, offering plan, or board materials',
  });
  const nyPeopleEntityCompMissing = NY_PEOPLE_ENTITY_COMP_SOURCE_NAMES.filter(source => !html.includes(source));
  checks.push({
    name: 'NY People / Entity / Comp Web Source Stack',
    status: isHoaRecovery || isFloridaReceivership || nyPeopleEntityCompMissing.length === 0 ? 'pass' : 'fail',
    detail: isHoaRecovery || isFloridaReceivership
      ? 'Non-NY report mode uses state/county/town and local-market equivalents instead of the NYC-specific web enrichment stack'
      : nyPeopleEntityCompMissing.length
        ? `Missing NY web enrichment source(s): ${nyPeopleEntityCompMissing.join(', ')}`
        : `NY scans include ${nyPeopleEntityCompSourceSummary()}`,
  });
  const nyOwnershipHuntMissing = NY_OWNERSHIP_HUNT_SOURCE_NAMES.filter(source => !html.includes(source));
  checks.push({
    name: 'NY Ownership Hunt Source Stack',
    status: isHoaRecovery || isFloridaReceivership || nyOwnershipHuntMissing.length === 0 ? 'pass' : 'fail',
    detail: isHoaRecovery || isFloridaReceivership
      ? 'Non-NY report mode uses state/county/town and local-market equivalents instead of the NYC ownership-hunt stack'
      : nyOwnershipHuntMissing.length
        ? `Missing NY ownership-hunt source(s): ${nyOwnershipHuntMissing.join(', ')}`
        : `NY ownership hunts include ${nyOwnershipHuntSummary()}`,
  });
  const ownershipFinancialSourceTokens = [
    'ACRIS official deed, mortgage, and party records',
    'NYC Department of Finance / PROS tax, assessment, exemption, abatement, and lien records',
    'https://a836-acris.nyc.gov/CP/',
    'https://a806-pros.nyc.gov/PROS/',
  ];
  const missingOwnershipFinancialSourceTokens = ownershipFinancialSourceTokens.filter(token => !html.includes(token));
  checks.push({
    name: 'Ownership & Financial Official Sources',
    status: isHoaRecovery || isFloridaReceivership || missingOwnershipFinancialSourceTokens.length === 0 ? 'pass' : 'fail',
    detail: isHoaRecovery || isFloridaReceivership
      ? 'Non-NY report mode uses state/county/town tax, clerk, assessor, and official-record equivalents'
      : missingOwnershipFinancialSourceTokens.length
        ? `Ownership & Financial History must include ACRIS and NYC DOF/PROS source token(s): ${missingOwnershipFinancialSourceTokens.join(', ')}`
        : 'Ownership & Financial History includes ACRIS plus NYC Department of Finance / PROS taxation records',
  });
  const requiredCommercialSources = isHoaRecovery
    ? [
        'Connecticut Secretary of the State business/entity search path',
        'Monroe Town Clerk land records / declaration / maps search path',
        'Monroe Assessor / Vision Government Solutions unit/APN search path',
        'CT condo resale/budget/source package request path',
        'Hills of Monroe public market/listing source stack',
      ]
    : [
        'LoopNet public listing search attempted',
        'CoStar public listing search attempted',
        'PropertyShark-style owner / tax / commercial-use review',
        'NYC DOT/DOB parking garage and curb-cut signal review',
        'NYC parking operator scan',
      ];
  for (const source of requiredCommercialSources) {
    checks.push({
      name: `Commercial Source: ${source.split(' ')[0]}`,
      status: html.includes(source) || d.commercialIntel?.researchSources?.some(s => s.includes(source)) ? 'pass' : 'fail',
      detail: source,
    });
  }
  checks.push({
    name: 'Management Context',
    status: !isExplicitSelfManaged(d.managementCompany) && /Self-managed buildings benefit most|Self-Managed\s*(?:&rarr;|→)|Currently self-managed/i.test(html) ? 'fail' : 'pass',
    detail: isKnownStaffedProperty
      ? 'Known staffed property must not be framed as self-managed'
      : 'Self-managed language requires an explicit source, not a missing management lookup',
  });
  checks.push({
    name: 'Building Contacts / Staff',
    status: d.boardMembers.length > 0 && d.buildingStaff.length > 0 ? 'pass' : 'warn',
    detail: d.boardMembers.length > 0 && d.buildingStaff.length > 0
      ? `${d.boardMembers.length} board/owner signal(s), ${d.buildingStaff.length} staff/management signal(s)`
      : `${d.boardMembers.length} board/owner signal(s), ${d.buildingStaff.length} staff/management signal(s) — verify HPD MDR, ACRIS, DOB, PropertyShark, board materials, or site contact before board-facing release`,
  });
  const contactSourceText = (d.contactResearchSources || []).join(' ');
  const requiredStakeholderSources = isHoaRecovery
    ? ['Connecticut Secretary of the State', 'Monroe Town Clerk', 'Board roster']
    : ['HPD MDR', 'ACRIS', 'DOB', 'PropertyShark', 'Apollo'];
  for (const source of requiredStakeholderSources) {
    checks.push({
      name: `Stakeholder Source: ${source}`,
      status: contactSourceText.includes(source) || html.includes(source) ? 'pass' : 'fail',
      detail: `${source} must be part of Camelot contact/stakeholder research`,
    });
  }
  checks.push({
    name: 'Current Management Performance Fallback',
    status: isHoaRecovery ? 'pass' : (!/[A-F]/.test(d.managementGrade) && !html.includes('Public-record review pending') ? 'fail' : 'pass'),
    detail: isHoaRecovery
      ? 'Connecticut HOA mode: current manager and field-support structure must be verified through board/current-management documents'
      : /[A-F]/.test(d.managementGrade) ? `Grade ${d.managementGrade}` : 'Pending public-record review message required',
  });
  const managementRiskSignals = getManagementPublicRiskSignals(d);
  checks.push({
    name: 'Current Management Risk Narrative',
    status: managementRiskSignals.length ? (html.includes('Management Public-Record Risk') ? 'pass' : 'fail') : 'pass',
    detail: managementRiskSignals.length
      ? `Narrative must display risk signals: ${managementRiskSignals.slice(0, 5).join(', ')}`
      : 'No public-record risk narrative required',
  });
  checks.push({
    name: 'Quarterly Market Reports Language',
    status: html.includes('Quarterly Market Reports') && !html.includes('Quarterly Management Reports') ? 'pass' : 'fail',
    detail: 'Quarterly reports must describe market/value benchmarking, not generic management reports',
  });
  checks.push({
    name: 'Partner Logo / Website Links',
    status: html.includes('commons.wikimedia.org/wiki/Special:Redirect/file/BankUnited_logo.svg') && html.includes('d2e1363xcu3t9u.cloudfront.net/2024/images/share.png') && html.includes('/images/partners/mds.svg') && html.includes('CP-Platform-Plus-Image-scaled.png') && html.includes('PVEDI-E-Blue-V3-RGB.png') && html.includes('/images/partners/hubspot.svg') && html.includes('domecile_logo_evolve-f47345567bc24e05b97fd7c7f893ef2e897c9679312a2b55776c7d7d5f2d1b7d.svg') && html.includes('Blue-Gold%20Logo%20-%20Transparent%20No%20Tagline.png') && html.includes('https://www.bankunited.com') && html.includes('https://www.meetselect.com') && html.includes('https://www.domecile.com') && html.includes('https://www.buildinglink.io') && html.includes('https://www.pve-llc.com') ? 'pass' : 'fail',
    detail: 'Partner slide must use real logo/web image URLs for MDS, ConciergePlus, BankUnited, Select, PVEDI, Domecile, and BuildingLink plus official website links',
  });
  checks.push({
    name: 'Camelot Case Studies',
    status: html.includes('camelot.nyc/case-studies') && html.includes('301 East 50th Street') && html.includes('./images/case-studies/301-east-50th.png') && html.includes('./images/case-studies/949-park.jpg') ? 'pass' : 'fail',
    detail: 'Case studies must be sourced from camelot.nyc/case-studies with image-backed cards',
  });
  const portfolioBlock = (html.match(/Camelot Portfolio[\s\S]*?Case Study:/i) || [])[0] || '';
  checks.push({
    name: 'Portfolio Building Images',
    status: portfolioBlock.includes('Static Google Street View image') || portfolioBlock.includes('Verified Camelot portfolio image') ? 'pass' : 'fail',
    detail: 'Nearby portfolio cards must render verified local images or clean static Street View image fallbacks',
  });
  const valueCreationSources = ['Benchmark / assumption disclosure', 'Actual financials required', 'not a savings guarantee'];
  const missingValueCreationSources = valueCreationSources.filter(source => !html.includes(source));
  checks.push({
    name: 'Value Creation Source Discipline',
    status: missingValueCreationSources.length === 0 ? 'pass' : 'fail',
    detail: missingValueCreationSources.length === 0
      ? 'Value Creation page separates direct data, benchmarks, and assumptions without promising savings'
      : `Missing value-creation disclosure(s): ${missingValueCreationSources.join(', ')}`,
  });
  const proFormaBlock = (html.match(/5-Year Planning View[\s\S]*?Typical Operating Expense Mix/i) || [])[0] || '';
  checks.push({
    name: 'Conservative Value-Creation Pro Forma',
    status: /\bwill save\b|savings typically compound|guaranteed savings/i.test(proFormaBlock) ? 'fail' : 'pass',
    detail: /\bwill save\b|savings typically compound|guaranteed savings/i.test(proFormaBlock)
      ? 'Value Creation page must not imply guaranteed savings or force a positive ROI'
      : '5-year view is framed as planning math pending actual budget, utility, insurance, vendor, and arrears data',
  });
  checks.push({
    name: 'DOF Tax Search Link',
    status: html.includes('a836-pts-access.nyc.gov/care/search/commonsearch.aspx?mode=address') ? 'pass' : 'fail',
    detail: 'DOF button must open address-based property tax search',
  });
  checks.push({
    name: 'Legal Terms Link',
    status: html.includes(LEGAL_TERMS_URL) && !html.includes('Legal%20Terms%20Request') ? 'pass' : 'fail',
    detail: 'Confidentiality page button must open the report-specific legal terms page, not a mailto request',
  });
  const nextStepsSlides = (html.match(/<h2[^>]*>\s*Next Steps\s*<\/h2>/g) || []).length;
  checks.push({
    name: 'Duplicate Next Steps Pages',
    status: nextStepsSlides <= 1 ? 'pass' : 'fail',
    detail: `${nextStepsSlides} Next Steps heading(s) found`,
  });
  checks.push({
    name: 'Neighborhood / ZIP Search Context',
    status: d.neighborhoodSearchContext?.query ? 'pass' : 'warn',
    detail: d.neighborhoodSearchContext?.query
      ? `${d.neighborhoodSearchContext.query} — ${d.neighborhoodSearchContext.source}`
      : 'No ZIP/neighborhood context available; dynamic search should avoid neighborhood claims until verified',
  });

  const warnings = checks.filter(c => c.status === 'warn').length;
  const failures = checks.filter(c => c.status === 'fail').length;
  return { passed: failures === 0, checks, warnings, failures };
}

// ============================================================
// Cold Caller Sheet
// ============================================================

export function generateColdCallerSheet(d: MasterReportData): string {
  // Check both managementCompany AND buildingStaff for a managing agent
  const agentFromStaff = d.buildingStaff.find(s => s.role.toLowerCase().includes('managing agent'));
  const actualManagement = d.managementCompany && d.managementCompany !== 'To be confirmed upon engagement' ? d.managementCompany : agentFromStaff ? agentFromStaff.name : null;
  const isSelfManaged = isExplicitSelfManaged(actualManagement);
  return `COLD CALL PREP — ${d.buildingName}
${'━'.repeat(50)}

BUILDING: ${d.address}
UNITS: ${d.units} | FLOORS: ${d.stories} | GRADE: ${d.scoutGrade} (${d.scoutScore}/100)
MANAGEMENT: ${verifiedManagementLabel(d.managementCompany)} — verify via HPD MDR, ACRIS, DOB, PropertyShark, board materials, or building website
${d.dofOwner ? `OWNER (DOF): ${d.dofOwner}` : ''}

OPENING:
"Hi, this is [Your Name] calling from Camelot Property Management. We're a boutique management firm based in Manhattan at 57 West 57th Street, Suite 410. I'm reaching out because we specialize in managing buildings like ${d.buildingName} in your area, and I wanted to introduce our services to the decision makers."

KEY HOOKS:
${d.violationsOpen > 0 ? `• ${d.violationsOpen} OPEN HPD VIOLATIONS — "We noticed your building has ${d.violationsOpen} open HPD violations. We have a proven track record clearing these efficiently."\n` : ''}${d.ecbPenaltyBalance > 0 ? `• $${d.ecbPenaltyBalance.toLocaleString()} ECB PENALTY BALANCE — "Your building has outstanding ECB fines that we can help resolve."\n` : ''}${d.ll97 && d.ll97.period1Penalty > 0 ? `• LL97 PENALTY EXPOSURE: $${d.ll97.period1Penalty.toLocaleString()}/yr — "Under Local Law 97, your building faces estimated annual penalties. Camelot includes an initial LL97 summary and roadmap where applicable; filings, remediation, budgeting, and project work are separately scoped."\n` : ''}${d.hasActiveLitigation ? `• ⚖️ ACTIVE HOUSING LITIGATION — "We see your building has active housing court cases. Camelot has experience stabilizing buildings in exactly this situation."\n` : ''}${d.isRentStabilized ? `• RENT STABILIZED — "We specialize in rent-stabilized buildings and understand the regulatory complexity."\n` : ''}${d.distressLevel === 'distressed' || d.distressLevel === 'critical' ? `• FINANCIAL DISTRESS DETECTED (${d.distressLevel.toUpperCase()}) — approach with sensitivity, but this building needs help.\n` : ''}
PRICING (USE THIS IN THE CALL):
"We have three service levels designed for buildings like yours:"
• CAMELOT INTELLIGENCE ⭐ (recommended): $${d.tieredPricing.intelligence.perUnit}/unit/month — full management PLUS ConciergePlus, Merlin AI, BankUnited online banking services with zero bank fees, quarterly market reports, local-law summaries, AI board minutes, and a one-time $500 introductory building inspection ($2,500 value)
• CAMELOT CLASSIC: $${d.tieredPricing.classic.perUnit}/unit/month — leaner base management for boards that want less technology and more Schedule A billing
• CAMELOT PREMIER: $${d.tieredPricing.premier.perUnit}/unit/month — everything in Intelligence PLUS dedicated senior PM, insurance rebid, vendor guarantee, annual strategy session with David

"Most of our buildings are on Intelligence because the technology, automation, and reporting are now part of responsible building management. If the board wants Classic, Premier, or a hybrid scope, we can shape the Schedule A menu around the property type and final services."

For ${d.units} units: Classic = $${d.tieredPricing.classic.monthly.toLocaleString()}/mo | Intelligence = $${d.tieredPricing.intelligence.monthly.toLocaleString()}/mo | Premier = $${d.tieredPricing.premier.monthly.toLocaleString()}/mo

VALUE PROPS:
• Weekly on-site inspections by senior management
• ConciergePlus resident portal and BankUnited online banking workflow — zero bank fees
• Monthly virtual accounting, full financial transparency
• Local-law and LL97 summary tracking where applicable; active remediation is separately scoped
• 24/7 emergency response with direct management access
• Three flexible pricing tiers — no long-term contracts required
${isSelfManaged ? '• "We understand you\'re self-managed — our 90-day onboarding makes the transition seamless"\n' : '• "We would love to show you how Camelot compares after we verify the current management structure."\n'}
OBJECTION HANDLERS:
"Too expensive" → "Our Intelligence tier is actually 25-40% LESS than FirstService or AKAM — and includes AI technology they charge extra for."
"Happy with current management" → "Many clients felt the same before seeing our reporting platform. Open to a brief comparison?"
"Not looking to switch" → "No commitment — just an opportunity to share what similar buildings are finding valuable."
"Send me something" → "I'll send our Welcome to Camelot proposal customized for ${d.buildingName} with all three pricing options. Best email?"
"We're locked into a contract" → "When does it expire? We can prepare everything in advance so the transition is seamless."

CLOSE:
"Would it make sense to schedule a 15-minute call with David Goldoff to walk through the three service tiers for ${d.buildingName}? Most boards find the Intelligence package is exactly what they need."

CONTACT: ${CAMELOT.principal} | ${CAMELOT.phone} | ${CAMELOT.email}
`;
}

// ============================================================
// Email Drafts
// ============================================================

export function generateEmailDraft(d: MasterReportData, type: 'intro' | 'followup' | 'proposal' | 'compliance' | 'loyalty'): { subject: string; body: string } {
  const sig = `\n\n${DAVID_GOLDOFF_SIGNATURE_TEXT}`;

  if (type === 'intro') {
    return {
      subject: `Introduction — Camelot Property Management | ${d.buildingName}`,
      body: `Dear Board Member,

My name is David Goldoff, and I'm the principal of Camelot Realty Group, a boutique property management firm headquartered at 57 West 57th Street, Suite 410 in New York City.

I'm reaching out because we specialize in managing buildings like ${d.buildingName}, and I believe we could bring meaningful value to your ${d.units}-unit property.

What makes Camelot different:

• Personal Attention — I personally oversee every property in our portfolio.
• Weekly Inspections — Our team visits each building weekly for thorough on-site inspections.
• Technology-Forward — ConciergePlus resident portal with BankUnited online banking services and zero bank fees.
• Transparent Financials — Monthly virtual accounting and real-time performance dashboards.
• Compliance Expertise — We actively track LL97, HPD, DOB, and provide full compliance reporting.
${d.violationsOpen > 0 ? `\nI noticed that ${d.buildingName} currently has ${d.violationsOpen} open HPD violations on record. Our compliance team has extensive experience resolving these efficiently.\n` : ''}${d.ll97 && d.ll97.period1Penalty > 0 ? `\nAdditionally, under Local Law 97, your building faces an estimated annual penalty of $${d.ll97.period1Penalty.toLocaleString()}. Camelot includes an initial LL97 summary and roadmap where applicable; filings, remediation, budgeting, and project work are separately scoped.\n` : ''}
I'd welcome the opportunity to introduce Camelot to your board. Would you have 15 minutes for a brief call this week?

Warm regards,${sig}`,
    };
  }

  if (type === 'followup') {
    return {
      subject: `Following Up — Camelot for ${d.buildingName}`,
      body: `Dear Board Member,

I'm following up on my previous outreach regarding property management services for ${d.buildingName}.

Since my last message, I wanted to highlight a few things:
${d.violationsOpen > 0 ? `\n• Compliance: ${d.violationsOpen} open HPD violations on record. Our team resolves these efficiently.` : ''}
• Technology: Our ConciergePlus portal gives board members and residents a complete digital experience.
• Transparency: Monthly virtual accounting, quarterly market reports, and real-time dashboards.
${d.ll97 && d.ll97.period1Penalty > 0 ? `• LL97: Your building's estimated annual penalty is $${d.ll97.period1Penalty.toLocaleString()}. Camelot includes an initial LL97 summary and roadmap where applicable; filings, remediation, budgeting, and project work are separately scoped.\n` : ''}
I've prepared a customized management proposal for ${d.buildingName}. Would you have 15 minutes this week for a brief call?

Warm regards,${sig}`,
    };
  }

  if (type === 'proposal') {
    return {
      subject: `Management Proposal — Camelot for ${d.buildingName}`,
      body: `Dear Board Member,

Thank you for your interest in Camelot Property Management. I'm pleased to present our approach for managing ${d.buildingName}, your ${d.units}-unit property.

OUR 90-DAY ONBOARDING:
• Month 1: Full building audit, one-time $500 introductory inspection ($2,500 value), vendor review
• Month 2: SOPs, portal launch, financial migration, vendor optimization
• Month 3: Full technology stack live, reporting cadence, 5-year capital roadmap

ONGOING SERVICES:
• Weekly on-site inspections
• 24/7 emergency response
• In-house CPA and monthly financial reporting
• LL97 summary tracking and penalty modeling where applicable
• ConciergePlus resident portal and BankUnited online banking services with zero bank fees

PROPOSED INVESTMENT:
• Recommended Package: Camelot Intelligence
• Intelligence Management Fee: $${d.monthlyFee.toLocaleString()}/month ($${d.pricePerUnit}/unit)
• Online Banking Services: BankUnited preferred banking workflow with zero bank fees
• Technology Platform: Camelot Intelligence package
• Building Inspection: $500 introductory inspection ($2,500 value)
• LL97 / Local Law Summary: initial summary included when applicable; filings and remediation separately scoped
• In-House Legal / Engineering Advisory: advisory only; formal engagement separately scoped

I'd welcome the opportunity to present this to your board.

Best regards,${sig}`,
    };
  }

  // loyalty — short intro email accompanying the downloaded report
  if (type === 'loyalty') {
    return {
      subject: `${d.buildingName} at ${d.address} — Property Intelligence Report from Camelot Realty Group`,
      body: `Dear Board Member,

Camelot Realty Group is a boutique property management firm based at 57 West 57th Street in New York City. For over 18 years, we have proudly managed cooperatives, condominiums, and multifamily buildings across the New York metropolitan area — delivering hands-on service, financial transparency, and technology-driven management to every property in our portfolio.

We were pleased to prepare the attached Property Intelligence Report for ${d.buildingName} at ${d.address}. Our team took a close look at your ${d.units ? d.units + '-unit ' : ''}building and we believe there is a meaningful opportunity for Camelot to add value — from compliance and vendor optimization to financial reporting and resident services.

We hope that we get the chance to meet soon.

Sincerely yours,${sig}`,
    };
  }

  // compliance
  return {
    subject: `Your Building at ${d.address} — LL97 Compliance Alert`,
    body: `Dear Board Member,

I'm writing to bring an urgent matter to your attention regarding ${d.buildingName}.

Under NYC Local Law 97, your building faces significant carbon emission penalties:

• Period 1 (2024-2029): Estimated annual penalty of $${(d.ll97?.period1Penalty || 0).toLocaleString()}
• Period 2 (2030-2034): Estimated annual penalty of $${(d.ll97?.period2Penalty || 0).toLocaleString()}
• Total 11-Year Exposure: $${(d.ll97?.totalExposure11yr || 0).toLocaleString()}
${d.energyStarScore ? `• Current Energy Star Score: ${d.energyStarScore}` : ''}

These penalties are real and enforceable starting NOW. Many building boards are unaware of their exposure until they receive their first penalty notice.

Camelot Property Management includes an initial LL97 summary and roadmap where applicable:
• Annual energy benchmarking and filing
• Carbon penalty modeling and forecasting
• Capital upgrade planning (HVAC, boiler, insulation)
• Rebate and incentive capture for energy improvements
• Ongoing monitoring and compliance reporting

We'd like to review the building's LL97 and local-law position with the board and outline what can be handled through management versus what would require a separately approved scope. Would you have 15 minutes this week to discuss?

Regards,${sig}`,
  };
}

// ============================================================
// CSV Export
// ============================================================

export function generateCSVExport(d: MasterReportData): string {
  const rows: string[][] = [
    ['Field', 'Value'],
    ['Address', d.address],
    ['Borough', d.borough],
    ['Building Name', d.buildingName],
    ['Units', String(d.units)],
    ['Stories', String(d.stories)],
    ['Year Built', String(d.yearBuilt)],
    ['Building Class', d.buildingClass],
    ['Tax Class', d.taxClass],
    ['Market Value', `$${d.marketValue.toLocaleString()}`],
    ['Assessed Value', `$${d.assessedValue.toLocaleString()}`],
    ['Land Value', `$${d.landValue.toLocaleString()}`],
    ['DOF Owner', d.dofOwner],
    ['BBL', d.bbl],
    ['Current Management', d.managementCompany || 'To be confirmed'],
    ['HPD Violations (Total)', String(d.violationsTotal)],
    ['HPD Violations (Open)', String(d.violationsOpen)],
    ['Class A', String(d.violationClassA)],
    ['Class B', String(d.violationClassB)],
    ['Class C', String(d.violationClassC)],
    ['ECB Violations', String(d.ecbCount)],
    ['ECB Penalty Balance', `$${d.ecbPenaltyBalance.toLocaleString()}`],
    ['DOB Permits', String(d.permitsCount)],
    ['Energy Star Score', d.energyStarScore != null ? String(d.energyStarScore) : 'N/A'],
    ['Site EUI', d.siteEUI != null ? String(d.siteEUI) : 'N/A'],
    ['GHG Emissions', d.ghgEmissions != null ? String(d.ghgEmissions) : 'N/A'],
    ['LL97 Annual Penalty (Period 1)', d.ll97 ? `$${d.ll97.period1Penalty.toLocaleString()}` : 'N/A'],
    ['LL97 Annual Penalty (Period 2)', d.ll97 ? `$${d.ll97.period2Penalty.toLocaleString()}` : 'N/A'],
    ['LL97 11-Year Exposure', d.ll97 ? `$${d.ll97.totalExposure11yr.toLocaleString()}` : 'N/A'],
    ['Last Sale Date', d.lastSaleDate || 'N/A'],
    ['Last Sale Price', d.lastSalePrice ? `$${d.lastSalePrice.toLocaleString()}` : 'N/A'],
    ['Buyer', d.lastSaleBuyer || 'N/A'],
    ['Seller', d.lastSaleSeller || 'N/A'],
    ['Deeds on Record', String(d.deedCount)],
    ['Mortgages on Record', String(d.mortgageCount)],
    ['Active Litigation', d.hasActiveLitigation ? 'YES' : 'No'],
    ['Rent Stabilized', d.isRentStabilized ? 'YES' : 'No'],
    ['Distress Score', String(d.distressScore)],
    ['Distress Level', d.distressLevel],
    ['Scout Score', String(d.scoutScore)],
    ['Scout Grade', d.scoutGrade],
    ['Property Type', d.propertyType],
    ['Neighborhood', d.neighborhoodName],
    ['ZIP Code', d.zipCode || 'N/A'],
    ['Neighborhood / ZIP Search Context', d.neighborhoodSearchContext?.query || 'N/A'],
    ['Neighborhood Context Source', d.neighborhoodSearchContext?.source || 'N/A'],
    ['Management Grade', d.managementGrade],
    ['Management Duration', d.managementDuration || 'N/A'],
    ['Neighborhood Condo $/Sqft', d.neighborhoodMarketData ? `$${d.neighborhoodMarketData.condoPSF}` : 'N/A'],
    ['Neighborhood Co-op $/Sqft', d.neighborhoodMarketData ? `$${d.neighborhoodMarketData.coopPSF}` : 'N/A'],
    ['Neighborhood Median 1BR Rent', d.neighborhoodMarketData ? `$${d.neighborhoodMarketData.median1BR}` : 'N/A'],
    ['Neighborhood Median 2BR Rent', d.neighborhoodMarketData ? `$${d.neighborhoodMarketData.median2BR}` : 'N/A'],
    ['Neighborhood Invest Score', d.neighborhoodMarketData ? String(d.neighborhoodMarketData.investScore) : 'N/A'],
    ['Recommended Package', 'Camelot Intelligence'],
    ['Intelligence Price/Unit', `$${d.pricePerUnit}`],
    ['Intelligence Monthly Fee', `$${d.monthlyFee.toLocaleString()}`],
    ['Intelligence Annual Fee', `$${d.annualFee.toLocaleString()}`],
  ];
  return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// ============================================================
// HTML Brochure Generator (17-page printable pitch deck)
// ============================================================

function generateFloridaReceivershipBrochureHTML(d: MasterReportData): string {
  const safe = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
  const fmtMoney = (n: number) => n > 0 ? `$${n.toLocaleString()}` : 'To verify';
  const encodedAddr = encodeURIComponent(d.address);
  const sourceRows = (d.complianceSourceChecks || []).map(check => `
<tr>
<td>${safe(check.source)}</td>
<td>${safe(check.status.replace('_', ' '))}</td>
<td>${check.count}</td>
<td>${safe(check.detail)}${check.url ? ` <a href="${safe(check.url)}" target="_blank" rel="noopener">Open source</a>` : ''}</td>
</tr>`).join('');
  const distressRows = (d.distressSignals || []).map(signal => `
<div class="risk-card">
<div class="risk-sev">${safe(signal.severity)}</div>
<h3>${safe(signal.type)}</h3>
<p>${safe(signal.description)}</p>
</div>`).join('');
  const sourceChips = (d.commercialIntel?.researchSources || []).map(source => `<span>${safe(source)}</span>`).join('');
  const amenityChips = (d.commercialIntel?.amenities || []).slice(0, 10).map(item => `<span>${safe(item)}</span>`).join('');
  const agreementScope = Array.isArray(d.raw?.receivership?.agreementScope) ? d.raw.receivership.agreementScope as string[] : [];
  const agreementScopeRows = agreementScope.map((item, index) => `
<tr>
<td>${index + 1}</td>
<td>${safe(item)}</td>
</tr>`).join('');
  const photoCandidates = buildSubjectImageCandidates(d);
  const firstPhoto = photoCandidates[0] || buildSubjectStreetViewUrl(d);
  const secondPhoto = photoCandidates[1] || `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddr}&zoom=16&size=900x500&markers=color:red%7C${encodedAddr}&key=${GOOGLE_MAPS_REPORT_KEY}`;
  const uploadedPhotoGallery = renderPropertyPhotoGallery(d, { limit: 12, columns: 6, height: 74 });
  const mapEmbed = `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_REPORT_KEY}&q=${encodedAddr}&zoom=16`;
  const directionsEmbed = `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_REPORT_KEY}&origin=North+Miami+FL&destination=${encodedAddr}&mode=driving`;
  const filename = buildJackieIntelReportFilename(d, 'html');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safe(d.buildingName)} - Florida Receivership Management Report</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cardo:wght@400;700&family=Inter:wght@400;600;700;800&display=swap');
*{box-sizing:border-box}
body{margin:0;background:#ece9e1;color:#142033;font-family:Inter,Arial,sans-serif}
.toolbar{position:sticky;top:0;z-index:10;background:#243746;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 3px 16px rgba(0,0,0,.18)}
.toolbar b{color:#d8b24a}
.toolbar button,.toolbar a{border:1px solid rgba(216,178,74,.6);background:#a89035;color:#fff;border-radius:6px;padding:9px 14px;text-decoration:none;font-weight:800;font-size:12px;margin-left:8px;cursor:pointer}
.deck{max-width:1120px;margin:0 auto;padding:20px 0 48px}
.slide{width:1120px;min-height:720px;margin:0 auto 18px;background:#fbfaf6;border:1px solid #d8d2c4;box-shadow:0 10px 30px rgba(0,0,0,.10);position:relative;padding:58px 64px 48px;page-break-after:always;overflow:hidden}
.slide.dark{background:#253640;color:#fff}
.kicker{font-size:11px;text-transform:uppercase;letter-spacing:2.4px;color:#a89035;font-weight:800;margin-bottom:12px}
h1,h2{font-family:Cardo,Georgia,serif;color:#a89035;font-weight:700;line-height:1.05;margin:0}
h1{font-size:66px;max-width:780px}
h2{font-size:46px;margin-bottom:22px}
h3{font-size:17px;margin:0 0 8px;color:#0f2d54}
p{font-size:14px;line-height:1.65;color:#334155;margin:0 0 14px}
.dark p{color:rgba(255,255,255,.8)}
.logo{position:absolute;right:0;top:0;background:#caa733;color:#111;padding:28px 42px;font-weight:800;letter-spacing:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.stat{background:#fff;border:1px solid #d8d2c4;padding:18px;border-left:4px solid #a89035;min-height:96px}
.stat .val{font-size:27px;color:#a89035;font-family:Cardo,Georgia,serif;font-weight:700}
.stat .lbl{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1.3px;font-weight:800}
.photo{height:360px;border:1px solid #d8d2c4;background:#e7e2d8;overflow:hidden;box-shadow:0 8px 18px rgba(0,0,0,.10)}
.photo img,.photo iframe{width:100%;height:100%;object-fit:cover;border:0;display:block}
.callout{background:#f3efe4;border-left:5px solid #a89035;padding:18px 20px;margin:18px 0;color:#334155}
.risk-card{background:#fff;border:1px solid #d8d2c4;padding:18px;min-height:150px;border-top:5px solid #a89035}
.risk-sev{font-size:9px;text-transform:uppercase;letter-spacing:1.6px;color:#a89035;font-weight:800;margin-bottom:6px}
table{width:100%;border-collapse:collapse;background:#fff;font-size:11px}
th{background:#243746;color:#fff;text-align:left;padding:10px;text-transform:uppercase;letter-spacing:1px;font-size:10px}
td{border-bottom:1px solid #e5dfd2;padding:10px;vertical-align:top;color:#334155}
td a{color:#a89035;font-weight:800}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.chips span{border:1px solid #d8d2c4;background:#fff;border-radius:999px;padding:7px 10px;font-size:10px;color:#334155}
.page{position:absolute;right:24px;bottom:18px;font:10px Arial,sans-serif;color:#64748b}
.footer{position:absolute;left:64px;right:64px;bottom:18px;border-top:1px solid #d8d2c4;padding-top:8px;font-size:9px;color:#64748b}
@media print{body{background:#fff}.toolbar{display:none}.deck{padding:0}.slide{margin:0;box-shadow:none;border:0;width:100%;height:100vh;page-break-after:always}@page{size:landscape;margin:0}}
</style>
</head>
<body>
<div class="toolbar">
<div><b>Camelot</b> Florida Receivership Report - ${safe(d.buildingName)}</div>
<div>
<button onclick="window.print()">Print / Save PDF</button>
<a download="${safe(filename)}" href="data:text/html;charset=utf-8,${encodeURIComponent('<!doctype html>' + '')}" onclick="event.preventDefault();const blob=new Blob([document.documentElement.outerHTML],{type:'text/html'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='${safe(filename)}';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)">Download HTML</a>
<a href="mailto:dgoldoff@camelot.nyc?subject=${encodeURIComponent('Three Horizons East Condominium - Florida receivership management report')}&body=${encodeURIComponent("Attached or linked is Camelot's Florida receivership management report for Three Horizons East Condominium at 12500 NE 15th Avenue, North Miami, FL 33161.")}">Email</a>
</div>
</div>
<main class="deck">
<section class="slide dark">
<div class="logo">CAMELOT</div>
<div class="kicker">Florida Receivership Property Management Takeover</div>
<h1>${safe(d.buildingName)}</h1>
<p style="font-size:22px;max-width:680px;margin-top:18px">${safe(d.address)}</p>
<div class="callout" style="max-width:720px;margin-top:44px;background:rgba(255,255,255,.08);border-color:#d8b24a;color:#fff">
Camelot is working with the court-appointed receiver, past board members, board attorney, unit owners, a licensed CAM operator through an affiliate partnership, engineers, contractors, consultants, and local service providers to stabilize Three Horizons East Condominium and bring the property back into operating health. This 89-unit, six-story North Miami community is Camelot's first South Florida management engagement and a strategic expansion platform.
</div>
<div class="grid" style="margin-top:36px">
<div class="photo"><img src="${safe(firstPhoto)}" alt="${safe(d.buildingName)}" onerror="${subjectImageOnErrorChain([secondPhoto], d.buildingName)}"></div>
<div class="photo"><iframe src="${safe(mapEmbed)}" loading="lazy" allowfullscreen></iframe></div>
</div>
<div class="footer">Prepared by Camelot Property Management Services Corp. | ${safe(d.date)}</div><div class="page">1</div>
</section>

<section class="slide">
<div class="logo">CAMELOT</div>
<div class="kicker">Receivership Operating Summary</div>
<h2>Immediate Takeover Priorities</h2>
<div class="grid">
<div>
<p><strong>Camelot Property Management Services Corp. is expanding into North Miami with Three Horizons East Condominium, an established 89-unit residential community at 12500 NE 15th Avenue.</strong> Built in 1972, the six-story condominium has the bones of a strong owner community: accessibility, affordability, resident amenities, and proximity to North Miami services, retail, dining, airports, Biscayne Bay, and area beaches.</p>
<p><strong>Three Horizons East Condominium is not a standard management pitch.</strong> The operating posture is a receivership stabilization plan: protect the asset, stabilize communication, secure records, verify court authority, rebuild controls, and create a disciplined property management cadence.</p>
<p>Camelot's role is to sit at the center of the recovery effort: coordinating with the receiver, past board members, board counsel, unit owners, a licensed CAM operator affiliate partner, engineers, general contractors, insurance parties, maintenance vendors, cleaning, guard service, and project consultants so the building can move from distress toward compliance, solvency, refinance readiness, and long-term board control.</p>
<div class="callout"><strong>No inherited source mismatch:</strong> this report intentionally excludes city/state source paths that do not govern this Florida property.</div>
</div>
<div class="grid-3" style="grid-template-columns:1fr">
<div class="stat"><div class="val">${safe(d.distressLevel)}</div><div class="lbl">Operating posture</div></div>
<div class="stat"><div class="val">${safe(d.managementGrade)}</div><div class="lbl">Management review status</div></div>
<div class="stat"><div class="val">${safe(d.scoutGrade)} (${d.scoutScore}/100)</div><div class="lbl">Receivership opportunity score</div></div>
</div>
</div>
${uploadedPhotoGallery ? `<div style="margin-top:14px"><div class="kicker" style="margin-bottom:8px">Uploaded Property Photo Set</div>${uploadedPhotoGallery}</div>` : ''}
<div class="footer">Receivership management report | Florida jurisdiction only</div><div class="page">2</div>
</section>

<section class="slide">
<div class="logo">CAMELOT</div>
<div class="kicker">North Miami / Miami-Dade Source Stack</div>
<h2>Florida Verification Path</h2>
<table>
<thead><tr><th>Source</th><th>Status</th><th>Rows</th><th>What Camelot Must Pull</th></tr></thead>
<tbody>${sourceRows}</tbody>
</table>
<div class="chips">${sourceChips}</div>
<div class="footer">Miami-Dade, North Miami, Florida DBPR, Sunbiz, court, tax, flood, and association records govern this report.</div><div class="page">3</div>
</section>

<section class="slide">
<div class="logo">CAMELOT</div>
<div class="kicker">Operating Risks</div>
<h2>Receivership Signals</h2>
<div class="grid-3">${distressRows}</div>
<div class="callout" style="margin-top:26px">
Camelot's first job is to create control: file transfer, court-order review, resident communication, bank and payables discipline, vendor review, insurance review, and a physical-condition baseline supported by photos.
</div>
<div class="footer">Risk signals are based on user-provided engagement facts and Florida source-path requirements pending document pull.</div><div class="page">4</div>
</section>

<section class="slide">
<div class="logo">CAMELOT</div>
<div class="kicker">Property Snapshot</div>
<h2>What We Know vs. What Must Be Verified</h2>
<div class="grid">
<div>
<table>
<tbody>
<tr><td><strong>Property</strong></td><td>${safe(d.buildingName)}</td></tr>
<tr><td><strong>Address</strong></td><td>${safe(d.address)}</td></tr>
<tr><td><strong>Property Type</strong></td><td>${safe(d.propertyType)}</td></tr>
<tr><td><strong>Units / Stories / Year</strong></td><td>${d.units} units / ${d.stories} stories / Built ${d.yearBuilt}</td></tr>
<tr><td><strong>Management Status</strong></td><td>${safe(d.managementCompany)}</td></tr>
<tr><td><strong>Market Value</strong></td><td>${fmtMoney(d.marketValue)}</td></tr>
<tr><td><strong>Folio</strong></td><td>${safe(d.bbl)}</td></tr>
</tbody>
</table>
<div class="callout" style="margin-top:18px">
<strong>Resident amenities and community features to verify:</strong>
<div class="chips">${amenityChips}</div>
</div>
</div>
<div class="photo"><iframe src="${safe(directionsEmbed)}" loading="lazy" allowfullscreen></iframe></div>
</div>
<div class="footer">Miami-Dade folio, value, tax, unit count, permits, and association filings must be confirmed from Florida sources.</div><div class="page">5</div>
</section>

<section class="slide">
<div class="logo">CAMELOT</div>
<div class="kicker">30-60-90 Day Takeover</div>
<h2>Receiver Management Transition Plan</h2>
<div class="grid-3">
<div class="risk-card"><h3>First 30 Days</h3><p>Court order intake, receiver authority file, bank/payables controls, owner communication, vendor list, insurance policies, emergency contacts, photo baseline, and critical life-safety review.</p></div>
<div class="risk-card"><h3>Days 31-60</h3><p>Budget recovery, arrears and collections, vendor rebidding, permit/code review, 40-year certification tracking, fire sprinkler and fire monitoring review, insurance/restoration tracking, and monthly receiver reporting.</p></div>
<div class="risk-card"><h3>Days 61-90</h3><p>Capital improvement plan, maintenance and repair cadence, staffing plan, compliance calendar, project priority list, refinance-readiness roadmap, and recommended operating budget.</p></div>
</div>
<div class="footer">Transition plan is receivership-specific and should be updated once court files, budgets, vendors, and site photos are collected.</div><div class="page">6</div>
</section>

<section class="slide">
<div class="logo">CAMELOT</div>
<div class="kicker">Florida Compliance and Code Review</div>
<h2>Building, Court, Tax and Insurance Controls</h2>
<div class="grid">
<div class="risk-card"><h3>Municipal / Permit Review</h3><p>City of North Miami and Miami-Dade permit, inspection, unsafe-structure, recertification, contractor, and code files should be pulled immediately.</p></div>
<div class="risk-card"><h3>Court / Official Records</h3><p>Miami-Dade civil docket and Official Records should control the receivership authority, claims, liens, notices, and all required reporting steps.</p></div>
<div class="risk-card"><h3>Insurance / Restoration</h3><p>Policies, claims, open scopes, inspection requirements, fire/life-safety conditions, vendor estimates, deductibles, and renewal risk must be organized into a receiver-ready file.</p></div>
<div class="risk-card"><h3>Financial Controls</h3><p>Cash controls, AP approval, arrears, owner balances, vendor aging, association budget, bank access, foreclosure-assistance notices, and receiver reporting should be rebuilt before routine operations resume.</p></div>
</div>
<div class="footer">Florida report mode replaces non-local compliance systems with Miami-Dade and North Miami records.</div><div class="page">7</div>
</section>

<section class="slide">
<div class="logo">CAMELOT</div>
<div class="kicker">Camelot Operating Model</div>
<h2>How Camelot Takes Control</h2>
<div class="grid-3">
<div class="risk-card"><h3>Accounting</h3><p>Receiver-grade AP, collections, bank reconciliation, vendor controls, owner balances, and monthly financial reporting.</p></div>
<div class="risk-card"><h3>Operations</h3><p>Unit-owner communication, licensed CAM operator affiliate support, service tickets, emergency escalation, local staffing, vendor dispatch, site inspections, guard/cleaning/maintenance support, and photo-based condition reporting.</p></div>
<div class="risk-card"><h3>Technology</h3><p>Cloud files, reporting dashboards, work order tracking, board/receiver packages, and automated reminders for deadlines and closeout items.</p></div>
</div>
<div class="callout">Camelot's role is to become the operating nerve center for the receiver: one place for records, money movement, vendor work, owner communication, licensed CAM operator affiliate support, project management, compliance tracking, and status reporting. Three Horizons East is Camelot's North Miami flagship assignment and a pilot platform for long-term expansion in this market.</div>
<p style="margin-top:16px">The long-term opportunity is a positive stewardship story: stabilize governance, modernize reporting, improve resident service, build a practical capital plan, and preserve property value in a growing South Florida market where Camelot expects to expand thoughtfully.</p>
<div class="footer">Operational model is tailored to condominium receivership, not a routine new-business proposal.</div><div class="page">8</div>
</section>

<section class="slide">
<div class="logo">CAMELOT</div>
<div class="kicker">Managing Agent Scope</div>
<h2>Camelot + Licensed CAM Affiliate Support</h2>
<p>Camelot is presented as the managing-agent platform for Three Horizons East, working with the Association, the court-appointed receiver, and a licensed Florida CAM operator affiliate where required by law. The public report should describe the operating structure without naming individual people or affiliate principals.</p>
<table>
<thead><tr><th style="width:56px">#</th><th>Service Scope Reflected in Agreement Materials</th></tr></thead>
<tbody>${agreementScopeRows}</tbody>
</table>
<div class="callout">This is service-scope language, not a substitute for the final agreement, receiver instructions, court orders, or legal advice. The goal is to show the practical management controls Camelot will help install.</div>
<div class="footer">Agreement language summarized without personal names or private affiliate-party details.</div><div class="page">9</div>
</section>

<section class="slide">
<div class="logo">CAMELOT</div>
<div class="kicker">Required Intake Request</div>
<h2>Files Needed to Finalize the Takeover File</h2>
<div class="grid">
<div>
<ul style="font-size:14px;line-height:1.9;color:#334155">
<li>Receiver appointment order and court docket number</li>
<li>Association governing documents and current roster</li>
<li>Bank accounts, balances, arrears, AP aging, and prior financials</li>
<li>Insurance policies, claims, incident logs, and open restoration files</li>
<li>Operating account, lock-box, banking authority, owner ledgers, common-charge billing, assessment, and collections files</li>
<li>Vendor contracts, certificates, invoices, open work orders, staffing needs, and emergency contacts</li>
<li>Permit, code, 40-year certification, fire sprinkler, fire monitoring, life-safety, elevator, roof, plumbing, electrical, and structural files</li>
<li>Bridge loan, mortgage, refinance, insurance inspection, and capital improvement files</li>
<li>Resident communication log and unresolved complaints</li>
</ul>
</div>
<div class="photo"><img src="${safe(secondPhoto)}" alt="${safe(d.buildingName)} location" onerror="${subjectImageOnErrorChain([firstPhoto], d.buildingName)}"></div>
</div>
<div class="footer">Uploaded receiver photos should be added to this report once available.</div><div class="page">10</div>
</section>

<section class="slide dark">
<div class="logo">CAMELOT</div>
<div class="kicker">Next Steps</div>
<h2>Receiver Takeover Action Meeting</h2>
<p style="font-size:19px;max-width:760px">Camelot is ready to move from report to action: stabilize operations, document the property condition, coordinate all parties, help bring the budget into the black, drive 40-year certification and life-safety compliance, support capital repairs, and prepare the property for a cleaner refinance path after compliance needs are met.</p>
<div class="grid-3" style="margin-top:34px">
<a class="stat" href="mailto:dgoldoff@camelot.nyc?subject=${encodeURIComponent('Three Horizons East - receiver management takeover')}" style="text-decoration:none"><div class="val">Email</div><div class="lbl">dgoldoff@camelot.nyc</div></a>
<a class="stat" href="tel:+12122069939;ext=701" style="text-decoration:none"><div class="val">Call</div><div class="lbl">212-206-9939 x701</div></a>
<a class="stat" href="https://www.camelot.nyc" target="_blank" rel="noopener" style="text-decoration:none"><div class="val">Web</div><div class="lbl">www.camelot.nyc</div></a>
</div>
<p style="margin-top:44px;color:rgba(255,255,255,.65)">David A. Goldoff, Founder & President<br>212-206-9939 ext. 701 | info@camelot.nyc</p>
<div class="footer">Camelot Property Management Services Corp. | Florida receivership management report</div><div class="page">11</div>
</section>
</main>
</body>
</html>`;
}

export function generateBrochureHTML(d: MasterReportData): string {
  d = applyJackieFactAuthority(d).data as MasterReportData;
  if (isFloridaReceivershipReport(d)) {
    return generateFloridaReceivershipBrochureHTML(d);
  }

  const addr = d.address;
  const encodedAddr = encodeURIComponent(addr);
  const neighborhoodContext = d.neighborhoodSearchContext || buildNeighborhoodSearchContext({
    address: d.address,
    borough: d.borough,
    neighborhoodName: d.neighborhoodName,
    zipCode: d.zipCode,
    raw: d.raw,
  });
  const encodedNeighborhoodContext = encodeURIComponent(neighborhoodContext.query || d.neighborhoodName || d.borough || addr);
  const reportFilenameBase = buildJackieIntelReportFilename(d);
  const reportHtmlFilename = buildJackieIntelReportFilename(d, 'html');
  const brochureAgent = d.buildingStaff.find(s => s.role.toLowerCase().includes('managing agent'));
  const brochureActualMgmt = d.managementCompany && !['Unknown','To be confirmed upon engagement'].includes(d.managementCompany) ? d.managementCompany : brochureAgent ? brochureAgent.name : null;
  const isSelfManaged = isExplicitSelfManaged(brochureActualMgmt);
  const fmtMoney = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;
  const modelUnits = Math.max(d.units || 0, 1);
  const isManhattan = (d.borough || '').toLowerCase().includes('manhattan') || /fifth|madison|park|broadway|avenue|street/i.test(d.address);
  const isHoaRecovery = isHoaExecutiveRecoveryReport(d);
  const accessBorough = d.borough || 'New York';
  const accessTransit = isManhattan
    ? 'Subway and bus access supports routine senior-management visits from 57 West 57th Street, with Midtown connections and crosstown options.'
    : `Regional transit and road access support scheduled inspections and manager coverage across ${accessBorough}.`;
  const accessHighway = isManhattan
    ? 'FDR Drive, Harlem River Drive, and major crosstown corridors give Camelot multiple routes for inspections, vendor coordination, and emergency response.'
    : 'Major arterial access and vendor routing are reviewed during onboarding so emergency dispatch and inspections have clear coverage plans.';
  const safe = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
  const reportFocus = d.reportFocus || { selectedFocus: ['property_management' as ReportFocusKey] };
  const selectedFocusKeys = (reportFocus.selectedFocus?.length ? reportFocus.selectedFocus : ['property_management'])
    .filter((key): key is ReportFocusKey => Boolean(REPORT_FOCUS_THEMES[key as ReportFocusKey]));
  const selectedFocusThemes = selectedFocusKeys.map(key => REPORT_FOCUS_THEMES[key]);
  const primaryFocus = selectedFocusThemes[0] || REPORT_FOCUS_THEMES.property_management;
  const hasFinancingFocus = selectedFocusKeys.includes('financing');
  const inquiryMeta = [
    reportFocus.inquiryContact ? `Contact: ${reportFocus.inquiryContact}` : null,
    reportFocus.inquiryEmail ? `Email: ${reportFocus.inquiryEmail}` : null,
    reportFocus.inquiryPhone ? `Phone: ${reportFocus.inquiryPhone}` : null,
    reportFocus.inquiryRole ? `Role: ${reportFocus.inquiryRole}` : null,
    reportFocus.inquiryOrganization ? `Organization: ${reportFocus.inquiryOrganization}` : null,
  ].filter(Boolean).join(' | ');
  const fmtDate = (value: unknown) => {
    if (!value) return 'N/A';
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const hpdViolationItems = Array.isArray(d.raw?.violations?.items) ? d.raw.violations.items : [];
  const openHPDViolationItems = hpdViolationItems.filter((v: any) => !/\bCLOSE\b|DISMISSED|COMPLIED|RESCINDED|CANCELLED/i.test(`${v.violationstatus || ''} ${v.currentstatus || ''}`));
  const recentHPDViolationItems = [...hpdViolationItems]
    .sort((a: any, b: any) => new Date(b.inspectiondate || b.approveddate || 0).getTime() - new Date(a.inspectiondate || a.approveddate || 0).getTime())
    .slice(0, 8);
  const violationHistoryRows = recentHPDViolationItems.length
    ? recentHPDViolationItems.map((v: any) => `
<tr>
<td>${fmtDate(v.inspectiondate || v.approveddate)}</td>
<td>${safe(v.class || 'N/A')}</td>
<td>${safe(v.currentstatus || v.violationstatus || 'N/A')}</td>
<td>${safe(v.violationid || v.novid || 'N/A')}</td>
<td>${safe(String(v.novdescription || v.violationdescription || '').slice(0, 150))}${String(v.novdescription || v.violationdescription || '').length > 150 ? '...' : ''}</td>
</tr>`).join('')
    : '';
  const complianceSourceRows = (d.complianceSourceChecks || []).map(check => `
<tr>
<td style="padding:8px;border-bottom:1px solid #E5E3DE;font-weight:700;color:#2C3240">${safe(check.source)}</td>
<td style="padding:8px;border-bottom:1px solid #E5E3DE;color:${check.status === 'loaded' ? '#16a34a' : check.status === 'blocked' ? '#dc2626' : '#A89035'};font-weight:800;text-transform:uppercase;font-size:9px">${safe(check.status.replace('_', ' '))}</td>
<td style="padding:8px;border-bottom:1px solid #E5E3DE;text-align:center;color:#38557D;font-weight:700">${check.count}</td>
<td style="padding:8px;border-bottom:1px solid #E5E3DE;color:#555;line-height:1.45">${safe(check.detail)}${check.url ? ` <a href="${safe(check.url)}" target="_blank" rel="noopener" style="color:#A89035;text-decoration:underline">Open source</a>` : ''}</td>
</tr>`).join('');
  const is1280Fifth = /1280\s+(fifth|5th)/i.test(`${d.address} ${d.buildingName}`);
  const subjectImageCandidates = buildSubjectImageCandidates(d);
  const subjectPhotoError = subjectImageOnErrorChain(subjectImageCandidates.slice(1), d.buildingName);
  const prettyNeighborhood = d.neighborhoodName
    ? d.neighborhoodName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : d.borough || 'New York City';
  const nearbyLandmarkLabels = resolveNearbyLandmarkLabels(d);
  const managementRiskFlags = isHoaRecovery
    ? (d.distressSignals || []).map(signal => `${signal.type}: ${signal.description}`)
    : [
    d.violationsOpen > 0 ? `${d.violationsOpen} open HPD violation(s)` : null,
    d.dobViolationOpen > 0 ? `${d.dobViolationOpen} open DOB violation signal(s)` : null,
    d.ecbCount > 0 ? `${d.ecbCount} ECB/OATH record(s)` : null,
    d.ecbPenaltyBalance > 0 ? `${fmtMoney(d.ecbPenaltyBalance)} ECB balance` : null,
    d.hasActiveLitigation || d.litigationCount > 0 ? `${Math.max(d.litigationCount, 1)} litigation signal(s)` : null,
    d.hasTaxLien || d.taxLienRecordCount > 0 ? `${Math.max(d.taxLienRecordCount, 1)} DOF tax lien notice row(s)` : null,
    d.acrisLienClaimCount > 0 ? `${d.acrisLienClaimCount} ACRIS lien/claim document(s)` : null,
    d.facadeIssueCount > 0 ? `${d.facadeIssueCount} FISP/facade issue signal(s)` : null,
    d.ll97?.period1Penalty ? `${fmtMoney(d.ll97.period1Penalty)} LL97 annual exposure` : null,
    d.complianceReleaseStatus === 'blocked' ? 'compliance source coverage blocked release' : null,
    d.complianceReleaseStatus === 'needs_review' ? 'compliance source coverage needs review' : null,
  ].filter((flag): flag is string => Boolean(flag));
  const managementRiskSummary = managementRiskFlags.length
    ? isHoaRecovery
      ? `HOA operating-risk context: Camelot reconciled this management read against ${managementRiskFlags.slice(0, 5).join('; ')}. The report should not imply a clean operating environment until claim files, budget records, vendor contracts, and board documents are reviewed.`
      : `Management Public-Record Risk: Jackie reconciled this grade against ${managementRiskFlags.slice(0, 5).join('; ')}. The score is not allowed to show a clean 100 when violations, liens, DOB/FISP issues, litigation, ECB/OATH records, or DOF risk appear elsewhere in the report.`
    : isHoaRecovery
      ? 'No material HOA operating-risk documents have been loaded yet; Camelot still needs the claim file, current budget, vendor list, reserve study, and board materials.'
      : 'No material public-record risk signal loaded from HPD, DOB, ECB/OATH, DOF, ACRIS, court, FISP, or 311 sources. Jackie still recommends confirming staff, managing agent, and board materials before release.';
  const managementRiskChipHTML = managementRiskFlags.map(flag => `<span style="display:inline-block;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.25);color:#991b1b;padding:6px 12px;border-radius:18px;font-size:10px;font-weight:600">${safe(flag)}</span>`).join('');
  const propertyPedigree = is1280Fifth ? {
    title: 'A Robert A.M. Stern Masterpiece',
    narrative: `At ${d.units || 116} units, ${d.buildingName} represents the ideal scale for Camelot's high-touch management: large enough to deserve institutional systems, personal enough to benefit from senior attention, financial clarity, and an owner's perspective.`,
    facts: ['Built 2012 | Luxury Condominium', '116 Units | 19 Floors', 'Architect: Robert A.M. Stern / SLCE', 'Interiors: Andre Kikoski', 'Built atop the Museum for African Art', 'NE corner of Central Park at Duke Ellington Circle'],
    foot: 'AKA One Museum Mile: caps the famous Museum Mile on Fifth Avenue',
    locationTitle: 'Crown of Museum Mile',
    locationCopy: 'Northeast corner of Central Park at Duke Ellington Circle. The only Robert A.M. Stern building to cap Museum Mile: location fundamentals that protect shareholder investment through any market cycle.',
    lifestyleTitle: 'Lifestyle & Liquidity',
    lifestyleCopy: "Steps from Central Park, Harlem Meer, and the Conservatory Garden. Immediate access to 2/3, 4/5/6 trains. The building's Fifth Avenue address and cultural pedigree ensure lasting desirability.",
    landmarks: nearbyLandmarkLabels,
  } : {
    title: `${d.buildingName} at a Glance`,
    narrative: `${d.buildingName} is a ${d.propertyType.toLowerCase()} with ${d.units || 'multiple'} units${d.stories ? ` across ${d.stories} floors` : ''}. Jackie combines city records, market intelligence, and Camelot's management experience to translate the building's facts into an actionable board narrative.`,
    facts: [
      d.yearBuilt ? `Built ${d.yearBuilt} | ${d.propertyType}` : d.propertyType,
      `${d.units || 'N/A'} Units${d.stories ? ` | ${d.stories} Floors` : ''}`,
      d.buildingArea ? `${d.buildingArea.toLocaleString()} SF` : 'Building area to be verified',
      d.borough ? `${d.borough} location` : isHoaRecovery ? 'Regional location' : 'NYC location',
      d.neighborhoodName ? `${prettyNeighborhood} neighborhood` : 'Neighborhood profile generated by Camelot',
    ],
    foot: isHoaRecovery ? 'Public HOA facts are source-backed where available; declaration, budget, claim file, and board records still control final scope.' : 'Property-specific history is verified during Camelot scope review and onboarding.',
    locationTitle: `${prettyNeighborhood} Positioning`,
    locationCopy: `${d.buildingName} sits within ${prettyNeighborhood}, where access, operations, and neighborhood fundamentals shape resident experience and long-term value.`,
    lifestyleTitle: 'Access, Service & Liquidity',
    lifestyleCopy: 'Camelot reviews transportation, vendor routing, nearby anchors, and resident lifestyle drivers so the board sees both operational needs and market value in one narrative.',
    landmarks: nearbyLandmarkLabels,
  };
  const complianceDates = [
    { month: 'January', title: 'Tax Appeals', desc: d.assessedValue > 0 ? `Review ${fmtMoney(d.assessedValue)} assessed value and appeal strategy.` : 'Strategic filing to reduce assessments.' },
    { month: 'June', title: 'RPIE Filings', desc: d.propertyType.toLowerCase().includes('condo') || d.propertyType.toLowerCase().includes('coop') ? 'Income/expense status reviewed; exemptions verified where applicable.' : 'Income and expense reporting deadline management.' },
    { month: 'September', title: 'HPD Registration', desc: d.units >= 3 ? 'Multi-family registration, ownership, and emergency contact verification.' : 'Registration applicability verified by property profile.' },
    { month: 'December', title: 'Budgeting', desc: 'Operating budget, reserve planning, capital calls, and board calendar.' },
  ];
  const ll97Context = d.ll97
    ? `${d.buildingName} (${d.propertyType} | ${d.ll97.complianceStatus} | ${fmtMoney(d.ll97.period1Penalty)}/yr Period 1 exposure)`
    : `${d.buildingName} (${d.propertyType} | LL97 applicability to be verified)`;
  const ll97ModeledArea = Math.max(d.buildingArea || 0, (d.units || 0) * 850);
  const ll97LikelyApplicable = Boolean(d.ll97) || d.buildingArea > 25000 || d.units >= 30 || d.stories >= 7;
  const ll97BuildingType = d.ll97?.buildingType || inferBuildingType(d.buildingClass) || 'multifamily';
  const ll97Display = d.ll97 ? {
    period1Penalty: d.ll97.period1Penalty,
    period2Penalty: d.ll97.period2Penalty,
    totalExposure11yr: d.ll97.totalExposure11yr,
    complianceStatus: d.ll97.complianceStatus,
    buildingType: d.ll97.buildingType,
    emissionsLimit: d.ll97.emissionsLimit,
    actualEmissions: d.ll97.actualEmissions,
    sourceNote: 'Modeled from LL84 benchmarking / energy data loaded into Jackie.',
  } : {
    period1Penalty: 0,
    period2Penalty: 0,
    totalExposure11yr: 0,
    complianceStatus: ll97LikelyApplicable ? 'assessment needed' : 'not applicable',
    buildingType: ll97BuildingType,
    emissionsLimit: ll97BuildingType === 'office' ? 8.46 : ll97BuildingType === 'retail' ? 11.81 : 6.75,
    actualEmissions: null as number | null,
    sourceNote: ll97LikelyApplicable
      ? 'Building appears likely to require LL97/LL84 review, but benchmarking emissions were not returned by the automated source. Jackie must still show the LL97 workplan instead of dropping the page.'
      : 'Building appears below the primary LL97 size threshold; confirm final applicability during scope review.',
  };
  const ll97NeedsAction = ll97LikelyApplicable && (!d.ll97 || ll97Display.period1Penalty > 0 || ll97Display.period2Penalty > 0 || !/compliant/i.test(ll97Display.complianceStatus));
  const complianceGutCheckRows = [
    {
      category: 'HPD Open Violations',
      openItems: d.violationsOpen,
      cost: 'Per HPD class / cure timing',
      additionalFees: 'Certified correction, contractor labor, legal/admin follow-up if contested',
      exposure: d.violationsOpen > 0 ? `${d.violationsOpen} open item(s); ${d.violationClassC} Class C, ${d.violationClassB} Class B, ${d.violationClassA} Class A` : 'No open HPD items returned by current scan',
      why: d.violationsOpen > 0 ? 'Open HPD records indicate unresolved conditions that require cure, certification, dismissal, or source verification.' : 'No active HPD exposure surfaced; verify HPD Online manually before final board-facing use.',
    },
    {
      category: 'DOB / Local Law Open Items',
      openItems: d.dobViolationOpen + d.facadeIssueCount,
      cost: 'DOB/OATH penalties + professional filings where applicable',
      additionalFees: 'Architect/engineer, expediter, permit, filing, inspection, and contractor charges',
      exposure: d.dobViolationOpen || d.facadeIssueCount ? `${d.dobViolationOpen} DOB open signal(s); ${d.facadeIssueCount} FISP/facade issue signal(s)` : 'No DOB/FISP open issue returned by current scan',
      why: d.dobViolationOpen || d.facadeIssueCount ? 'DOB or facade signals require source review because local-law filings can trigger penalties, permits, and professional remediation.' : 'No DOB/FISP issue surfaced; applicability still depends on building height, systems, permits, and inspection cycle.',
    },
    {
      category: 'ECB / OATH Penalties',
      openItems: d.ecbCount,
      cost: d.ecbPenaltyBalance ? fmtMoney(d.ecbPenaltyBalance) : 'No balance returned',
      additionalFees: 'Hearing representation, stipulation/default review, correction proof, and filing work if needed',
      exposure: d.ecbPenaltyBalance ? `${fmtMoney(d.ecbPenaltyBalance)} current balance signal` : `${d.ecbCount} ECB/OATH record signal(s)`,
      why: d.ecbPenaltyBalance || d.ecbCount ? 'ECB/OATH records can create direct cash exposure and delay permit or financing work if defaults remain unresolved.' : 'No penalty balance returned; verify OATH/ECB directly for defaults and paid/unpaid status.',
    },
    {
      category: 'LL97 / Carbon Cap',
      openItems: ll97NeedsAction ? 1 : 0,
      cost: ll97Display.period1Penalty || ll97Display.period2Penalty ? `${fmtMoney(ll97Display.period1Penalty)}/yr P1; ${fmtMoney(ll97Display.period2Penalty)}/yr P2` : 'Benchmarking / applicability review needed',
      additionalFees: 'Benchmarking, engineering analysis, energy audit, filings, remediation budget, incentives/rebate work, and capital project management',
      exposure: ll97Display.totalExposure11yr ? fmtMoney(ll97Display.totalExposure11yr) : (ll97LikelyApplicable ? 'Exposure cannot be finalized until LL84/LL97 data is verified' : 'Likely below primary LL97 threshold'),
      why: ll97NeedsAction
        ? (!d.ll97 ? 'The building appears likely covered by size/unit/floor signals, but benchmarking emissions were not returned; non-compliance cannot be ruled out.' : `Modeled emissions exceed or may exceed LL97 carbon caps under status: ${ll97Display.complianceStatus}.`)
        : 'Current modeled or threshold review does not show penalty exposure, subject to benchmarking verification.',
    },
    {
      category: 'DOF Tax / Lien Exposure',
      openItems: d.taxLienRecordCount,
      cost: d.hasTaxLien || d.taxLienRecordCount ? 'Lien amount to verify in DOF / PROS' : 'No lien row returned',
      additionalFees: 'Interest, payment-plan charges, payoff administration, title/closing delays, and counsel if contested',
      exposure: d.taxLienRecordCount ? `${d.taxLienRecordCount} DOF lien-sale/tax risk row(s)` : 'No DOF tax lien row returned by current scan',
      why: d.hasTaxLien || d.taxLienRecordCount ? 'Tax liens can create direct financial exposure and financing friction until resolved.' : 'No tax lien surfaced; tax balances and exemptions should still be checked in DOF / PROS.',
    },
  ];
  const complianceGutCheckTotalExposure = (d.ecbPenaltyBalance || 0) + (ll97Display.totalExposure11yr || 0);
  const complianceGutCheckTable = `
<div style="background:#fff;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:14px 16px;margin-top:16px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.7px;color:#A89035;font-weight:800;margin-bottom:6px">Compliance Gut Check</div>
<div style="font-size:11px;color:#555;line-height:1.55;margin-bottom:10px">For LL97 and any other local-law issue, Jackie must identify open items, known penalty/cost signals, additional fees likely to be needed, total exposure, and why the subject property appears non-compliant or requires verification.</div>
<table class="invest-table" style="font-size:10px">
<thead><tr><th>Area</th><th>Open Items</th><th>Known Cost / Penalty</th><th>Additional Fees / Work</th><th>Total Exposure</th><th>Why It Matters</th></tr></thead>
<tbody>
${complianceGutCheckRows.map(row => `<tr><td style="font-weight:800;color:#2C3240">${safe(row.category)}</td><td>${safe(row.openItems)}</td><td>${safe(row.cost)}</td><td>${safe(row.additionalFees)}</td><td style="font-weight:800;color:#A89035">${safe(row.exposure)}</td><td>${safe(row.why)}</td></tr>`).join('')}
</tbody>
</table>
<div style="font-size:11px;color:#2C3240;margin-top:10px"><strong>Current quantified exposure:</strong> ${complianceGutCheckTotalExposure > 0 ? fmtMoney(complianceGutCheckTotalExposure) : 'No quantified penalty balance returned yet'}${complianceGutCheckTotalExposure > 0 ? ' before separate remediation, filing, professional, legal, or project-management fees.' : '; confirm open penalties, filing fees, and remediation costs through source records and professional review.'}</div>
</div>`;
  const intelligenceMonthly = d.tieredPricing?.intelligence?.monthly || d.monthlyFee;
  const intelligenceAnnual = d.tieredPricing?.intelligence?.annual || d.annualFee;
  const intelligencePerUnit = d.tieredPricing?.intelligence?.perUnit || d.pricePerUnit;
  const proposedRows = [
    ['Recommended Package', intelligenceMonthly > 0 ? `Camelot Intelligence — ${fmtMoney(intelligenceMonthly)}/mo (${fmtMoney(intelligenceAnnual)}/yr; approx. ${fmtMoney(intelligencePerUnit)}/unit/mo) based on Jackie preliminary pricing` : 'Camelot Intelligence — custom flat rate after building scope review'],
    ['Online Banking Services', 'BankUnited preferred banking workflow with zero bank fees for residents, owners, and the management company'],
    ['Technology Platform', 'Priced inside the recommended Intelligence package: Camelot Central + ConciergePlus + Merlin AI'],
    ['Initial Building Inspection', '$500 one-time introductory inspection ($2,500 value)'],
    ['In-House CPA / Accounting', 'Advisory and monthly reporting coordination; tax returns and deeper accounting work separately scoped'],
    ['LL97 / Local Law Summary', d.ll97 ? `Initial summary: carbon cap modeling + ${fmtMoney(d.ll97.totalExposure11yr)} 11-year exposure roadmap; filings, remediation, and project work separately scoped` : 'Initial summary when applicable; filings, remediation, budgets, and project work separately scoped'],
    ['AI Board Meeting Minutes', 'Included in Intelligence: every meeting, AI-enhanced and distributed'],
    ['In-House Attorney & Engineer', 'Advisory only; formal legal or engineering engagement separately scoped and approved'],
    ['Schedule A / Ancillary Fees', 'Property-type-specific menu issued with final agreement for co-op, condo, rental, HOA, or receiver-managed scope'],
  ];
  const parseOpexRange = (range?: string) => {
    const nums = String(range || '').match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
    if (nums.length >= 2) return { low: nums[0], high: nums[1], avg: (nums[0] + nums[1]) / 2 };
    if (nums.length === 1) return { low: nums[0], high: nums[0], avg: nums[0] };
    return { low: 24, high: 38, avg: 31 };
  };
  const opex = parseOpexRange(d.neighborhoodMarketData?.opexRange);
  const modeledBuildingArea = Math.max(d.buildingArea || 0, modelUnits * 850, 1);
  const modeledAnnualOpex = Math.round(modeledBuildingArea * opex.avg);
  const modeledAnnualFee = Math.max(d.annualFee || d.monthlyFee * 12, 1);
  const hasUploadedFinancials = Boolean(
    d.raw?.uploadedFinancials ||
    d.raw?.boardFinancials ||
    d.raw?.managementReports ||
    d.raw?.latestBudget ||
    d.raw?.auditedFinancials
  );
  const expenseMix = [
    { label: 'Real Estate Taxes', pct: 0.27, savingsRate: 0, confidence: 'Verify in DOF / tax bills' },
    { label: 'Insurance', pct: 0.20, savingsRate: hasUploadedFinancials ? 0.03 : 0.015, confidence: hasUploadedFinancials ? 'Medium' : 'Low - policy needed' },
    { label: 'Utilities', pct: 0.17, savingsRate: hasUploadedFinancials ? 0.025 : 0.01, confidence: hasUploadedFinancials ? 'Medium' : 'Low - bills needed' },
    { label: 'Maintenance & Repairs', pct: 0.14, savingsRate: hasUploadedFinancials ? 0.04 : 0.02, confidence: hasUploadedFinancials ? 'Medium' : 'Low - contracts needed' },
    { label: 'Management & Admin', pct: 0.11, savingsRate: hasUploadedFinancials ? 0.025 : 0.01, confidence: hasUploadedFinancials ? 'Medium' : 'Low - budget needed' },
    { label: 'Other / Reserve', pct: 0.11, savingsRate: 0, confidence: 'Not modeled as savings' },
  ];
  const categorySavings = expenseMix.map(item => ({
    ...item,
    spend: Math.round(modeledAnnualOpex * item.pct),
    savings: Math.round(modeledAnnualOpex * item.pct * item.savingsRate),
  }));
  const vendorBidSavings = Math.round(Math.max(modelUnits * (hasUploadedFinancials ? 300 : 125), modeledAnnualOpex * (hasUploadedFinancials ? 0.018 : 0.0075)));
  const laborEfficiencySavings = Math.round(Math.max(modelUnits * (hasUploadedFinancials ? 175 : 75), modeledAnnualOpex * (hasUploadedFinancials ? 0.0075 : 0.003)));
  const materialsSupplySavings = Math.round(Math.max(modelUnits * (hasUploadedFinancials ? 90 : 40), modeledAnnualOpex * (hasUploadedFinancials ? 0.0035 : 0.0015)));
  const consultantDiscountSavings = Math.round(Math.max(modelUnits * (hasUploadedFinancials ? 80 : 35), modeledAnnualOpex * (hasUploadedFinancials ? 0.0025 : 0.001)));
  const revenueRecovery = Math.round(Math.max(modelUnits * (hasUploadedFinancials ? 175 : 65), modeledAnnualOpex * (hasUploadedFinancials ? 0.0035 : 0.0012)));
  const complianceAvoidance = d.ll97?.period1Penalty
    ? Math.round(d.ll97.period1Penalty * 0.1)
    : ((d.violationsOpen + d.ecbCount) > 0 ? Math.round(modelUnits * 75) : 0);
  const boardTimeSavings = 0;
  const opportunityLevers = [
    { label: 'Vendor Rebidding & Scope Control', amount: vendorBidSavings, confidence: hasUploadedFinancials ? 'Medium' : 'Low', narrative: 'Illustrative range only until recurring contracts, invoices, and current vendor scopes are reviewed' },
    { label: 'Insurance, Utility & Maintenance Review', amount: categorySavings.filter(item => item.savingsRate > 0).reduce((sum, item) => sum + item.savings, 0), confidence: hasUploadedFinancials ? 'Medium' : 'Low', narrative: 'Requires insurance dec pages, utility bills, service contracts, and maintenance history before any savings can be quoted' },
    { label: 'Labor, Materials & Supplies Discipline', amount: laborEfficiencySavings + materialsSupplySavings, confidence: hasUploadedFinancials ? 'Medium' : 'Low', narrative: 'Preliminary staffing and purchasing review; not a payroll reduction promise' },
    { label: 'Consultant / Professional Rate Review', amount: consultantDiscountSavings, confidence: 'Low', narrative: 'Potential benefit depends on actual legal, engineering, expediting, insurance, and project needs' },
    { label: 'Collections, Amenities & Revenue Recovery', amount: revenueRecovery, confidence: hasUploadedFinancials ? 'Medium' : 'Low', narrative: 'Excluded from firm savings until arrears, parking/storage/laundry schedules, and fee policies are reviewed' },
    { label: 'Compliance Risk Avoidance', amount: complianceAvoidance, confidence: d.ll97 || d.violationsOpen || d.ecbCount ? 'Medium' : 'Low', narrative: 'Risk-reduction planning tied to verified LL97, HPD, DOB, ECB/OATH, DOF, insurance, and professional review' },
  ];
  const modeledYear1Value = opportunityLevers.reduce((sum, item) => sum + item.amount, 0);
  const financialModel = {
    modeledBuildingArea,
    opexRange: opex,
    annualOpex: modeledAnnualOpex,
    annualFee: modeledAnnualFee,
    hasUploadedFinancials,
    categorySavings,
    opportunityLevers,
    vendorBidSavings,
    laborEfficiencySavings,
    materialsSupplySavings,
    consultantDiscountSavings,
    boardTimeSavings,
    revenueRecovery,
    retentionSavings: 0,
    complianceAvoidance,
    year1Value: modeledYear1Value,
    feeEscalation: 0.03,
    valueGrowth: hasUploadedFinancials ? 0.03 : 0.01,
  };
  const valueCreationDataSources = [
    { name: 'Direct property scan', status: 'Direct / pulled when available', use: 'HPD, DOB, ECB/OATH, DOF, ACRIS, 311, LL84/LL97, and neighborhood records actually returned by the current report run' },
    { name: 'Board / manager financials', status: hasUploadedFinancials ? 'Uploaded / internal' : 'Required before underwriting', use: 'Latest budget, audited financials, prior manager report, AP aging, arrears, insurance, payroll, utilities, and vendor contracts' },
    { name: 'U.S. Census / ACS', status: 'Reference benchmark', use: 'Neighborhood demand and demographic context only; not used to promise building savings' },
    { name: 'NYC Open Data', status: 'Direct / public-record reference', use: 'Public building, compliance, 311, PLUTO, LL84/LL97, and municipal signals where returned' },
    { name: 'Con Edison / Utility Benchmarking', status: 'Reference until bills are uploaded', use: 'Utility opportunity cannot be underwritten without actual bills, meters, and usage history' },
    { name: 'REBNY / market reports', status: 'Reference benchmark', use: 'Market context, sales velocity, and broker/investor sentiment; not a property savings source' },
    { name: 'CHIP / SPONY / IREM', status: 'Reference benchmark', use: 'Peer operating-cost, owner/operator, and property-management benchmark context' },
    { name: 'Habitat Magazine / The Cooperator', status: 'Board-governance reference', use: 'Co-op/condo governance, reserves, insurance, compliance, and capital-project context' },
    { name: 'Camelot portfolio benchmarks', status: 'Internal benchmark', use: 'Used as a directional comparison only until matched against this building’s actual financials' },
    { name: 'RealtyMX / Google Drive reports', status: 'Available integration; not assumed', use: 'Can enrich comps and portfolio benchmarking once credentials or files are provided for the specific run' },
  ];
  const commercialIntel = d.commercialIntel || {
    commercialSignals: [],
    likelyCommercialUses: [],
    amenities: [],
    revenueOpportunities: [],
    officialWebsite: null,
    brandingTitle: null,
    brandingDescription: null,
    brandingImages: [],
    researchSources: [],
    researchStatus: 'needs_review' as const,
  };
  const commercialSignals = commercialIntel.commercialSignals.length > 0 ? commercialIntel.commercialSignals : ['No confirmed commercial tenant signal yet: verify on site and through offering plan / building records.'];
  const amenityList = commercialIntel.amenities.length > 0 ? commercialIntel.amenities : ['Amenity inventory to verify: storage cages, parking, bike room, library, pool, gym, roof deck, lounge, package room, and service spaces.'];
  const revenueOpportunities = commercialIntel.revenueOpportunities.length > 0 ? commercialIntel.revenueOpportunities : ['Review amenity rules, commercial licenses, parking/storage inventory, and any non-maintenance revenue opportunities during scope review.'];

  const hookLine = isSelfManaged
    ? `Every day, the ${d.units || ''} families at ${d.buildingName} depend on the quality of their building\u2019s management. The right partner brings proactive care, financial clarity, and modern technology \u2014 elevating not just the building, but the lives of everyone who calls it home.`
    : d.violationsOpen > 5
    ? `With ${d.violationsOpen} open violations and evolving compliance requirements, the families at ${d.buildingName} deserve a management partner with proven expertise in compliance resolution, proactive maintenance, and transparent financial stewardship.`
    : `Every day, the ${d.units || ''} families at ${d.buildingName} depend on the quality of their building\u2019s management. The right partner brings proactive care, financial clarity, and modern technology \u2014 elevating not just the building, but the lives of everyone who calls it home.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${reportFilenameBase}</title>
<link href="https://fonts.googleapis.com/css2?family=Abel&family=Cardo:ital,wght@0,400;0,700;1,400&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
body{font-family:'DM Sans',-apple-system,sans-serif;background:#F5F0E5;color:#2C3240;font-size:12.5px;line-height:1.5}
.no-print{display:block}@media print{.no-print{display:none!important}@page{margin:0.18in}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
.page{max-width:900px;margin:0 auto;counter-reset:page-num}
.section,.cover,.elevator,.back-cover{counter-increment:page-num;position:relative;border:1px solid #C9B87E;box-shadow:0 0 0 4px #F5F0E5,0 0 0 5px #E2D7B8;margin-bottom:10px}
.section::after{content:'Confidential \u00A9 ${new Date().getFullYear()} Camelot Realty Group \u00B7 Proprietary \u0026 Trade Secret \u00B7 Do Not Distribute Without Written Consent';display:block;text-align:center;font-size:7.5px;color:#999;letter-spacing:0.4px;margin-top:14px;padding-top:8px;border-top:1px solid #E5E3DE}
.section::before{counter-increment:page-num 0;content:counter(page-num);position:absolute;bottom:12px;right:20px;font-size:9px;color:#999;font-family:Arial,sans-serif;font-weight:400}
.cover::before,.back-cover::before,.elevator::before{content:counter(page-num);position:absolute;bottom:16px;right:24px;font-size:9px;color:rgba(255,255,255,0.38);font-family:Arial,sans-serif;font-weight:400}
a{color:#B8973A;text-decoration:none}
.gold{color:#B8973A}.navy{color:#343434}

/* Cover */
.cover{background:#343434;color:#fff;padding:54px;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:600px;page-break-after:always;position:relative;border-color:rgba(219,186,46,0.42)}
.cover .badge{position:absolute;top:28px;right:28px;background:#A89035;color:#fff;padding:12px 18px;font-size:9px;letter-spacing:3px;text-transform:uppercase;font-weight:700;line-height:1.4;text-align:center}
.cover .wordmark{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:16px;letter-spacing:12px;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:6px}
.cover .pm-sub{font-size:12px;color:#A89035;letter-spacing:2px;margin-bottom:48px}
.cover h1{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:42px;color:#A89035;font-weight:700;margin-bottom:8px;line-height:1.2;max-width:700px}
.cover .proposal-sub{font-size:16px;color:rgba(255,255,255,0.8);margin-bottom:8px;font-weight:300;letter-spacing:1px}
.cover .meta{font-size:12px;color:rgba(255,255,255,0.5);margin-top:6px}
.cover .prepared{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:12px;color:#A89035;font-style:italic;margin-top:40px}

/* Elevator */
.elevator{background:#F5F0E5;padding:50px 60px;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;page-break-after:always;min-height:400px}
.elevator h2{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:36px;color:#A89035;font-weight:700;margin-bottom:16px;max-width:640px;line-height:1.2}
.elevator .gold-bar{width:60px;height:3px;background:#A89035;margin:0 auto 24px}
.elevator p{font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;color:#555;line-height:1.9;max-width:600px}

/* Sections */
.section{padding:28px 38px;page-break-after:auto;break-inside:auto}
.section-cream{background:#F5F0E5}.section-white{background:#FDFAF3}
.section-title{font-family:'Cardo',Georgia,serif;font-size:26px;color:#B8973A;margin-bottom:6px;padding-left:14px;border-left:3px solid #B8973A;font-weight:700}
.section-sub{font-size:11.5px;color:#777;margin-bottom:18px;padding-left:14px}

/* Stats */
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0}
.stat-box{background:#EDE9DF;border:1px solid #D5D0C6;border-radius:8px;padding:16px;text-align:center}
.stat-box .val{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:28px;color:#A89035;font-weight:700}
.stat-box .lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px}

/* Info grid */
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 28px;margin:20px 0}
.info-grid .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999}
.info-grid .value{font-size:13px;color:#2C3240;font-weight:500}

/* Compare table */
.compare-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}
.compare-table th{padding:12px 16px;text-align:center;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700}
.compare-table th:nth-child(1){background:#E5E3DE;color:#666}
.compare-table th:nth-child(2){background:#A89035;color:#fff}
.compare-table th:nth-child(3){background:#E5E3DE;color:#666}
.compare-table td{padding:10px 16px;border-bottom:1px solid #eee;color:#666;text-align:center}
.compare-table td:nth-child(2){background:#EDE9DF;font-weight:600;color:#2C3240}
.compare-tagline{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-style:italic;color:#A89035;font-size:14px;text-align:center;margin-top:20px}

/* Cards */
.core-svc{background:#FDFAF3;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:20px;margin-bottom:16px}
.core-svc h4{font-size:14px;font-weight:700;color:#2C3240;margin-bottom:6px}
.core-svc p{font-size:12px;color:#555;line-height:1.7}

.va-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}
.va-card{background:#FDFAF3;border:1px solid #D5D0C6;border-left:3px solid #A89035;border-radius:0 8px 8px 0;padding:16px}
.va-card h5{font-size:12px;font-weight:700;color:#2C3240;margin-bottom:4px}
.va-card p{font-size:11px;color:#888;line-height:1.5}

/* Transition */
.transition-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:16px 0}
.trans-card{background:#fff;border:1px solid #E5E3DE;border-top:3px solid #A89035;border-radius:0 0 8px 8px;padding:20px}
.trans-card h4{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:14px;font-weight:700;color:#A89035;margin-bottom:6px}
.trans-card .sub{font-size:11px;color:#888;margin-bottom:12px;font-style:italic}
.trans-card ul{list-style:none}.trans-card ul li{font-size:11px;color:#555;padding:4px 0 4px 16px;position:relative}
.trans-card ul li::before{content:"\u2022";position:absolute;left:0;color:#A89035;font-weight:700;font-size:14px}

/* Pricing table */
.invest-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}
.invest-table th{background:#A89035;color:#fff;padding:12px 16px;text-align:left;font-size:10px;letter-spacing:1.5px;text-transform:uppercase}
.invest-table td{padding:12px 16px;border-bottom:1px solid #eee;color:#444}
.invest-table tr:nth-child(even){background:#EDE9DF}
.invest-table td:nth-child(2){font-weight:600;color:#2C3240}
.invest-table .free{color:#16a34a;font-weight:700}
.invest-table .included{color:#A89035;font-weight:600}

/* Testimonials */
.testimonial-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:16px 0}
.testimonial{background:#fff;border:1px solid #E5E3DE;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:24px}
.testimonial .qm{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:48px;color:#A89035;line-height:0.8;margin-bottom:10px}
.testimonial p{font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:#555;font-style:italic;line-height:1.8;margin-bottom:12px}
.testimonial .author{font-size:12px;color:#A89035;font-weight:600}
.testimonial .author-title{font-size:10px;color:#888}

/* Back cover */
.back-cover{background:#3A4B5B;color:#fff;min-height:400px;padding:60px;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;page-break-after:always;border-color:rgba(168,144,53,0.3)}
.back-cover .wordmark{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:14px;letter-spacing:10px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:6px}
.back-cover .pm-sub{font-size:11px;color:#A89035;margin-bottom:32px;letter-spacing:2px}
.back-cover h2{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:32px;color:#A89035;margin-bottom:8px;font-weight:700}
.back-cover .tagline{font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:32px;line-height:1.8}
.back-cover .contact-name{font-size:15px;color:#A89035;font-weight:600;margin-bottom:4px}
.back-cover .contact-info{font-size:12px;color:rgba(255,255,255,0.6);line-height:2}
.back-cover .contact-info a{color:#A89035}
.back-cover .address{font-size:11px;color:rgba(255,255,255,0.4);margin-top:16px}

/* Intel section */
.intel-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:16px 0}
.intel-card{background:#fff;border:1px solid #E5E3DE;border-radius:8px;padding:16px;text-align:center}
.intel-card .val{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:24px;font-weight:700}
.intel-card .lbl{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
.red{color:#dc2626}.orange{color:#ea580c}.green{color:#16a34a}.yellow{color:#ca8a04}

.about-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0}
.about-stat{background:#fff;border:1px solid #E5E3DE;border-radius:8px;padding:18px;text-align:center}
.about-stat .val{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:24px;color:#A89035;font-weight:700}
.about-stat .lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px}

.compliance-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:16px 0}
.compliance-card{background:#fff;border:1px solid #E5E3DE;border-top:3px solid #A89035;border-radius:0 0 8px 8px;padding:16px;text-align:center}
.compliance-card .month{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#A89035;font-weight:700;margin-bottom:6px}
.compliance-card h5{font-size:12px;color:#2C3240;font-weight:700;margin-bottom:4px}
.compliance-card p{font-size:10px;color:#888;line-height:1.4}

.tech-cols{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:16px 0}
.tech-col{background:#EDE9DF;border:1px solid #E5E3DE;border-radius:8px;padding:22px}
.tech-col h4{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:16px;color:#2C3240;margin-bottom:14px;font-weight:700}
.tech-col ul{list-style:none}.tech-col ul li{font-size:12px;color:#555;padding:5px 0 5px 22px;position:relative}
.tech-col ul li::before{content:"\u2714";position:absolute;left:0;color:#A89035;font-size:14px;font-weight:700}

.mission-stmt{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-style:italic;color:#A89035;font-size:15px;text-align:center;margin-bottom:20px;line-height:1.6;font-weight:600;max-width:700px;margin-left:auto;margin-right:auto}
.access-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:14px 0}
.access-card{background:#FDFAF3;border:1px solid #D5D0C6;border-top:2px solid #B8973A;padding:14px 16px;min-height:118px}
.access-card .k{font-family:'Cardo',Georgia,serif;font-size:21px;color:#B8973A;line-height:1;margin-bottom:6px}
.access-card h4{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#343434;margin-bottom:6px}
.access-card p{font-size:10.5px;color:#555;line-height:1.45}
.brand-logo{position:absolute;top:0;right:0;width:156px;height:72px;background:#D0A92D;display:flex;align-items:center;justify-content:center;padding:16px}
.brand-logo img{max-width:132px;max-height:46px;object-fit:contain}
.deck-slide{position:relative;min-height:520px;padding:58px 52px 42px;background:#F7F5F1;border:1px solid #D5D0C6;page-break-after:always}
.deck-slide.dark{background:#343E43;color:#fff;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
.deck-title{font-family:'Cardo',Georgia,serif;font-size:42px;line-height:1.06;color:#B8973A;font-weight:400;margin-bottom:26px;padding-left:18px;border-left:5px solid #B8973A}
.deck-title.center{border-left:0;padding-left:0;text-align:center}
.deck-kicker{font-size:17px;color:#38557D;line-height:1.5;max-width:760px}
.deck-grid-2{display:grid;grid-template-columns:1.25fr 0.9fr;gap:38px;align-items:center}
.deck-copy h3{font-family:'Cardo',Georgia,serif;font-size:28px;color:#0D2E63;margin:18px 0 10px}
.deck-copy p,.deck-copy li{font-size:15px;color:#38557D;line-height:1.55}
.deck-facts{list-style:none;margin:22px 0}
.deck-facts li{margin-bottom:11px}
.deck-photo{border:12px solid #E8E2D6;box-shadow:0 3px 10px rgba(0,0,0,0.12);height:330px;overflow:hidden;background:#EDE9DF}
.deck-photo img{width:100%;height:100%;object-fit:cover}
.deck-note{font-family:'Cardo',Georgia,serif;font-size:15px;color:#B8973A;font-style:italic;margin-top:18px}
.deck-card-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.deck-card{background:#fff;border:1px solid #D5D0C6;border-top:5px solid #B8973A;box-shadow:0 2px 7px rgba(0,0,0,0.08);padding:20px 22px;min-height:128px}
.deck-card h4{font-family:'Cardo',Georgia,serif;font-size:20px;color:#0D2E63;margin-bottom:14px}
.deck-card p,.deck-card li{font-size:13px;color:#38557D;line-height:1.45}
.deck-card ul{padding-left:18px}
.deck-table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px;color:#38557D}
.deck-table th{background:#213F73;color:#fff;text-align:left;padding:10px 12px}
.deck-table td{border:1px solid #D5C8A5;padding:9px 12px}
.deck-table tr:nth-child(even) td{background:#EEEAE3}
.partner-cloud{position:relative;height:360px;margin-top:26px}
.partner-logo{position:absolute;font-size:30px;font-weight:700;color:#1F2937;background:#fff;padding:10px 18px;min-width:120px;text-align:center}
.partner-logo.small{font-size:22px}.partner-logo.blue{color:#168BD1}.partner-logo.orange{color:#F2674A}
.thank-wordmark{font-family:'Abel','Plus Jakarta Sans',sans-serif;font-size:46px;letter-spacing:18px;color:#fff;margin-bottom:4px}

@media print{
body{background:#fff;font-size:11.4px;line-height:1.38}
body::before{content:'';position:fixed;top:0.1in;right:0.1in;bottom:0.1in;left:0.1in;border:1.5pt double #B8973A;pointer-events:none;z-index:99999}
.page{max-width:none;margin:0}
.cover,.back-cover{background:#343434!important;page-break-after:always}
.elevator{page-break-after:auto;min-height:auto}
.section{page-break-after:auto;break-inside:auto;margin:0;border:0;padding:20px 26px}
.deck-slide{min-height:7.2in;margin:0;border:0;padding:34px 38px 28px}
.deck-title{font-size:34px;margin-bottom:18px}
.brand-logo{width:126px;height:58px}
.section::after{margin-top:10px;padding-top:6px}
.stats-row,.about-stats,.compliance-row,.transition-grid,.tech-cols,.va-grid,.testimonial-grid,.access-grid,.deck-card-grid,.deck-grid-2{break-inside:avoid}
}
</style>
</head>
<body>
<div class="page">

<!-- FLOATING ACTION BAR (no-print) -->
<div style="position:fixed;top:0;left:0;right:0;background:#3A4B5B;padding:8px 20px;display:flex;gap:8px;align-items:center;justify-content:flex-end;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.3)" class="no-print">
<span style="color:#A89035;font-size:13px;font-weight:700;margin-right:auto">Jackie Report — ${d.buildingName}</span>
<button onclick="window.print()" style="background:#A89035;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">🖨️ Print / Save PDF</button>
<button onclick="var a=document.createElement('a');a.href='data:text/html,'+encodeURIComponent(document.documentElement.outerHTML);a.download='${reportHtmlFilename}';a.click()" style="background:#fff;color:#3A4B5B;border:none;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">⬇️ Download</button>
<button onclick="window.open('mailto:?subject='+encodeURIComponent('Property Intelligence Report — ${d.buildingName}')+'&body='+encodeURIComponent('Please find the attached Property Intelligence Report for ${d.buildingName}.\\n\\nPrepared by Camelot Realty Group.'))" style="background:transparent;color:#A89035;border:2px solid #A89035;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">✉️ Email</button>
</div>
<div style="height:50px" class="no-print"></div>

<!-- PAGE 1: COVER -->
<div class="cover">
<img src="./images/camelot-logo-white.png" alt="Camelot Realty Group" style="width:230px;margin-bottom:36px;opacity:0.98" onerror="this.style.display='none'">
<h1>${d.buildingName}</h1>
<div class="proposal-sub">Property Intelligence Report &amp; Management Proposal</div>
<div style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-top:4px">Powered by Jackie &nbsp;\u00B7&nbsp; Camelot OS &nbsp;\u00B7&nbsp; SCOUT Market Intelligence</div>
<div class="meta">${d.address} &nbsp;|&nbsp; ${d.borough || "New York"}</div>
<div class="meta" style="margin-top:4px">${d.bbl ? "BBL: " + d.bbl + " &nbsp;|&nbsp; " : ""}${d.propertyType}</div>
<div class="meta">${d.units ? d.units + ' Units' : ''} ${d.stories ? '&nbsp;|&nbsp; ' + d.stories + ' Floors' : ''}</div>
<div class="prepared">Prepared exclusively for the Board of Directors &mdash; ${d.date}</div>
<div style="position:absolute;bottom:60px;left:0;right:0;text-align:center">
<div style="background:rgba(0,0,0,0.3);display:inline-block;padding:8px 24px;border-radius:4px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#A89035;font-weight:700">RED Awards 2025: Property Management Co. of the Year &nbsp;\u00B7&nbsp; REBNY 2025: David Goldoff Leadership Award</div>
</div>
</div>

<div class="deck-slide">
<div class="brand-logo" style="width:230px"><img src="./images/camelot-logo.png" alt="Camelot Realty Group" style="width:100%;height:auto" onerror="this.style.display='none'"></div>
<div style="display:flex;align-items:center;justify-content:center;min-height:420px;text-align:center;flex-direction:column">
<h2 class="deck-title center" style="font-size:48px">Elevating ${safe(d.buildingName)}</h2>
<div style="width:150px;height:4px;background:#B8973A;margin:-8px auto 42px"></div>
<p class="deck-kicker">Your building deserves management that matches its stature: financial clarity, responsiveness, proactive stewardship, and a property-specific operating plan built around ${safe(d.address)}.</p>
</div>
</div>

<div class="deck-slide">
<div class="brand-logo"><img src="./images/camelot-logo.png" alt="Camelot Realty Group" onerror="this.style.display='none'"></div>
<h2 class="deck-title">The Property</h2>
<div class="deck-grid-2">
<div class="deck-copy">
<h3>${safe(propertyPedigree.title)}</h3>
<p>${safe(propertyPedigree.narrative)}</p>
<ul class="deck-facts">
${propertyPedigree.facts.map(f => `<li>${safe(f)}</li>`).join('')}
</ul>
<div class="deck-note">${safe(propertyPedigree.foot)}</div>
</div>
<div class="deck-photo">
${renderSubjectImage(d, { alt: d.buildingName }).replace(/^<div class="deck-photo"[^>]*>|<\/div>$/g, '')}
</div>
</div>
</div>

<div class="deck-slide">
<div class="brand-logo"><img src="./images/camelot-logo.png" alt="Camelot Realty Group" onerror="this.style.display='none'"></div>
<h2 class="deck-title">Location &amp; Neighborhood</h2>
<div class="deck-grid-2" style="grid-template-columns:1.15fr 0.85fr">
<div class="deck-copy">
<h3>${safe(propertyPedigree.locationTitle)}</h3>
<p>${safe(propertyPedigree.locationCopy)}</p>
<h3>${safe(propertyPedigree.lifestyleTitle)}</h3>
<p>${safe(propertyPedigree.lifestyleCopy)}</p>
</div>
<div class="deck-card" style="min-height:330px">
<h4>Nearby Landmarks</h4>
<div style="width:110px;height:4px;background:#B8973A;margin:0 0 28px"></div>
<ul style="list-style:none;padding-left:0">
${propertyPedigree.landmarks.map(l => `<li style="margin-bottom:16px">${safe(l)}</li>`).join('')}
</ul>
</div>
</div>
</div>

<!-- PAGE 2: PROPERTY VISUAL & MAP -->
<div class="section section-white" style="padding-top:20px">
<div class="section-title">The Property</div>
<div class="section-sub">${d.address} \u2014 ${d.propertyType}</div>

<!-- Hero: Building Photo (Wikimedia Commons → Google Street View fallback) -->
${d.buildingPhotos && d.buildingPhotos.exterior.length > 0 && d.buildingPhotos.source !== 'Google Street View' ? `
<div style="border-radius:10px;overflow:hidden;border:1px solid #D5D0C6;height:340px;margin-bottom:16px;position:relative">
<img src="${d.buildingPhotos.exterior[0]}" alt="${d.buildingName}" style="width:100%;height:100%;object-fit:cover" onerror="${subjectPhotoError}">
<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(58,75,91,0.9));padding:16px 20px 12px;color:#fff">
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:20px;font-weight:700">${d.buildingName}</div>
<div style="font-size:11px;opacity:0.8">${d.address} \u00B7 ${d.propertyType} \u00B7 ${d.units ? d.units + ' Units' : ''} ${d.stories ? '\u00B7 ' + d.stories + ' Floors' : ''} ${d.yearBuilt ? '\u00B7 Built ' + d.yearBuilt : ''}</div>
  <div style="font-size:8px;opacity:0.4;margin-top:2px">Photo: ${d.buildingPhotos.source}</div>
  </div>
  </div>
${renderPropertyPhotoGallery(d, { limit: 12, height: 96 })}
` : d.latitude && d.longitude ? `
<div style="border-radius:10px;overflow:hidden;border:1px solid #D5D0C6;height:340px;margin-bottom:16px;position:relative">
<iframe src="https://www.google.com/maps/embed/v1/streetview?key=${GOOGLE_MAPS_REPORT_KEY}&location=${d.latitude},${d.longitude}&heading=0&pitch=5&fov=80" width="100%" height="340" style="border:0" allowfullscreen loading="lazy"></iframe>
<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(58,75,91,0.9));padding:16px 20px 12px;color:#fff">
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:20px;font-weight:700">${d.buildingName}</div>
<div style="font-size:11px;opacity:0.8">${d.address} \u00B7 ${d.propertyType} \u00B7 ${d.units ? d.units + ' Units' : ''} ${d.stories ? '\u00B7 ' + d.stories + ' Floors' : ''} ${d.yearBuilt ? '\u00B7 Built ' + d.yearBuilt : ''}</div>
</div>
</div>
` : `
<div style="border-radius:10px;overflow:hidden;border:1px solid #D5D0C6;height:340px;margin-bottom:16px;position:relative">
<iframe src="https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_REPORT_KEY}&q=${encodedAddr}&zoom=19&maptype=satellite" width="100%" height="340" style="border:0" allowfullscreen loading="lazy"></iframe>
<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(58,75,91,0.9));padding:16px 20px 12px;color:#fff">
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:20px;font-weight:700">${d.buildingName}</div>
<div style="font-size:11px;opacity:0.8">${d.address} \u00B7 ${d.propertyType} \u00B7 ${d.units ? d.units + ' Units' : ''} ${d.stories ? '\u00B7 ' + d.stories + ' Floors' : ''} ${d.yearBuilt ? '\u00B7 Built ' + d.yearBuilt : ''}</div>
</div>
</div>
`}

<!-- Four panels: Street View, Map, Neighborhood, Directions -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
${d.latitude && d.longitude ? `
<div style="border-radius:8px;overflow:hidden;border:1px solid #D5D0C6">
<iframe src="https://www.google.com/maps/embed/v1/streetview?key=${GOOGLE_MAPS_REPORT_KEY}&location=${d.latitude},${d.longitude}&heading=180&pitch=5&fov=80" width="100%" height="200" style="border:0" allowfullscreen loading="lazy"></iframe>
<div style="text-align:center;font-size:9px;color:#999;padding:4px">\uD83D\uDCF7 Building \u2014 Alternate View</div>
</div>
` : `
<div style="border-radius:8px;overflow:hidden;border:1px solid #D5D0C6">
<iframe src="https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_REPORT_KEY}&q=${encodedAddr}&zoom=18" width="100%" height="200" style="border:0" allowfullscreen loading="lazy"></iframe>
<div style="text-align:center;font-size:9px;color:#999;padding:4px">\uD83D\uDCF7 Building Location</div>
</div>
`}
<div style="border-radius:8px;overflow:hidden;border:1px solid #D5D0C6">
<iframe src="https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_REPORT_KEY}&q=${encodedAddr}&zoom=16" width="100%" height="200" style="border:0" allowfullscreen loading="lazy"></iframe>
<div style="text-align:center;font-size:9px;color:#999;padding:4px">\uD83D\uDDFA\uFE0F Street Map</div>
</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
<div style="border-radius:8px;overflow:hidden;border:1px solid #D5D0C6">
<iframe src="https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_REPORT_KEY}&q=${encodedNeighborhoodContext}&zoom=14" width="100%" height="200" style="border:0" allowfullscreen loading="lazy"></iframe>
<div style="text-align:center;font-size:9px;color:#999;padding:4px">\uD83C\uDFD8\uFE0F Neighborhood Overview</div>
</div>
<div style="border-radius:8px;overflow:hidden;border:1px solid #D5D0C6">
<iframe src="https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_REPORT_KEY}&origin=57+West+57th+Street+Suite+410+New+York+NY+10019&destination=${encodedAddr}&mode=driving" width="100%" height="200" style="border:0" allowfullscreen loading="lazy"></iframe>
<div style="text-align:center;font-size:9px;color:#999;padding:4px">\uD83D\uDE97 From Camelot HQ \u2014 57 West 57th Street</div>
</div>
</div>

<div class="access-grid">
<div class="access-card">
<div class="k">S</div>
<h4>Subway &amp; Transit</h4>
<p>${accessTransit}</p>
</div>
<div class="access-card">
<div class="k">B</div>
<h4>Bus &amp; Local Coverage</h4>
<p>Fifth Avenue, Madison Avenue, crosstown, and neighborhood routes are reviewed for routine site coverage, resident support, and manager access.</p>
</div>
<div class="access-card">
<div class="k">H</div>
<h4>Road &amp; Emergency Access</h4>
<p>${accessHighway}</p>
</div>
</div>
<div style="background:#F5F0E5;border:1px solid #D5D0C6;border-left:3px solid #B8973A;padding:12px 16px;margin-bottom:14px;color:#343434">
<strong>Camelot HQ: 57 West 57th Street.</strong> Senior managers conduct regular on-site inspections; route planning and response coverage are part of the transition plan for ${d.buildingName}.
</div>
<div style="background:#fff;border:1px solid #D5D0C6;border-left:4px solid #3A4B5B;padding:12px 16px;margin-bottom:14px;color:#3A4B5B">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#A89035;font-weight:800;margin-bottom:5px">Neighborhood / ZIP Search Context</div>
<div style="font-size:12px;line-height:1.6"><strong>${safe(neighborhoodContext.query || 'Context pending')}</strong></div>
<div style="font-size:10px;color:#777;line-height:1.5;margin-top:4px">${safe(neighborhoodContext.source)}. Camelot uses this ZIP/neighborhood context as the basis for broader dynamic searches when exact address-level sources are incomplete or conflicting.</div>
</div>

<!-- StreetEasy + Research Sources Panel -->
<div style="background:#3A4B5B;border-radius:10px;padding:18px 22px;margin-bottom:14px;color:#fff">
<div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#A89035;font-weight:700;margin-bottom:12px">🔍 Property Research Sources</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
<a href="https://streeteasy.com/building/${encodeURIComponent(d.address.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">🏠</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">StreetEasy</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Photos, listings, sales history, pricing</div></div>
</a>
<a href="https://www.propertyshark.com/mason/Property/${d.bbl ? d.bbl.replace(/\s/g, '') : ''}" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">🦈</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">PropertyShark</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Owner info, comparables, tax records</div></div>
</a>
<a href="https://www.crexi.com/search?q=${encodedNeighborhoodContext}" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">🏢</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">Crexi</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Commercial listings, investment data</div></div>
</a>
${d.bbl ? `<a href="https://a836-acris.nyc.gov/DS/DocumentSearch/BBLResult?Borough=${d.bbl.charAt(0)}&Block=${d.bbl.substring(1, 6)}&Lot=${d.bbl.substring(6)}" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">🏛️</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">NYC City Register (ACRIS)</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Deeds, mortgages, liens — BBL: ${d.bbl}</div></div>
</a>` : `<a href="https://www.google.com/maps/search/${encodedNeighborhoodContext}" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">📍</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">Google Maps</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Photos, reviews, nearby amenities</div></div>
</a>`}
<a href="https://www.domecile.com/search?q=${encodedNeighborhoodContext}" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">🔑</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">Domecile</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Fees, current management, building info</div></div>
</a>
<a href="https://www.lexisnexis.com/en-us/gateway.page" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">⚖️</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">LexisNexis</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Legal issues, litigation, judgments, liens</div></div>
</a>
<a href="https://offeringplandatasearch.ag.ny.gov/" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">📜</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">NY AG — Offering Plans</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Co-op/condo offering plans, amendments, sponsor info</div></div>
</a>
<a href="https://iapps.courts.state.ny.us/nyscef/CaseSearch" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">🔍</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">NYSCEF (Court E-Filing)</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Court filings, lawsuits, HP actions</div></div>
</a>
<a href="https://a836-pts-access.nyc.gov/care/search/commonsearch.aspx?mode=address" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">🏦</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">DOF Property Tax</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Abatements, tax liens, exemptions, assessments</div></div>
</a>
<a href="https://www.jackjaffa.com/violation-services/" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">📋</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">Jack Jaffa & Associates</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Violation research, removal, hearings, expediting</div></div>
</a>
<a href="https://clients.sitecompli.com" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">✅</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">SiteCompli</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Violations, ownership, open permits, complaints</div></div>
</a>
<a href="https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?boro=${d.bbl ? d.bbl.charAt(0) : '1'}&block=${d.bbl ? d.bbl.substring(1, 6) : ''}&lot=${d.bbl ? d.bbl.substring(6) : ''}" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 14px;text-decoration:none;transition:background 0.2s" onmouseover="this.style.background='rgba(168,144,53,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
<span style="font-size:20px">🏗️</span>
<div><div style="font-size:12px;font-weight:600;color:#A89035">DOB BIS (Building Info System)</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">Permits, complaints, violations, certificates of occupancy</div></div>
</a>
</div>
<div style="margin-top:10px;font-size:9px;color:rgba(255,255,255,0.35);text-align:center">Data: HPD → DOF → StreetEasy → PropertyShark → Domecile (units) · ACRIS → DOF → HPD (ownership) · DOB/BIS → SiteCompli → Jack Jaffa (violations/permits) · DOF (abatements/liens) · LexisNexis → NYSCEF (legal) · NY AG (offering plans) · ZIP/neighborhood context → broad searches</div>
<div style="margin-top:5px;font-size:9px;color:rgba(255,255,255,0.35);text-align:center">Building image source stack: uploaded / verified Camelot assets → official building website → StreetEasy public building photos → Wikimedia Commons → Google Street View → board-facing placeholder</div>
</div>

<div class="stats-row">
<div class="stat-box"><div class="val">${d.propertyType}</div><div class="lbl">Property Type</div></div>
<div class="stat-box"><div class="val">${d.units || 'N/A'}</div><div class="lbl">Units</div></div>
<div class="stat-box"><div class="val">${d.stories || 'N/A'}</div><div class="lbl">Floors</div></div>
<div class="stat-box"><div class="val">${d.yearBuilt || 'N/A'}</div><div class="lbl">Year Built</div></div>
</div>

<div style="background:#fff;border:1px solid #D5D0C6;border-left:4px solid #A89035;padding:10px 14px;margin-top:12px;font-size:10px;color:#555;line-height:1.55">
<strong style="color:#A89035">PropertyShark diligence targets:</strong> owner mailing / care-of address Â· HPD officers and managing-agent history Â· DOB permit contacts Â· unit-level co-op/condo sales Â· assessment and tax-bill history Â· exemptions and abatements Â· zoning map, FAR and unused air rights Â· historic district/LPC, community district, school district, census tract, police/fire proximity Â· ACRIS deeds, mortgages, assignments, satisfactions, liens and UCC-style filings.
</div>

${d.streetEasy ? `
<!-- StreetEasy Building Profile -->
<div style="background:#f8f6f0;border:1px solid #D5D0C6;border-radius:8px;padding:18px 20px;margin-top:12px">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
<span style="font-size:16px">🏠</span>
<span style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#A89035;font-weight:700">StreetEasy Building Profile</span>
${d.streetEasy.url ? `<a href="${d.streetEasy.url}" target="_blank" style="margin-left:auto;font-size:10px;color:#A89035;text-decoration:underline">View on StreetEasy →</a>` : ''}
</div>
${d.streetEasy.description ? `<p style="font-size:12px;color:#555;line-height:1.7;margin-bottom:12px">${d.streetEasy.description.length > 500 ? d.streetEasy.description.substring(0, 500) + '…' : d.streetEasy.description}</p>` : ''}
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
${d.streetEasy.amenities.length > 0 ? d.streetEasy.amenities.map(a => `<span style="background:#3A4B5B;color:#fff;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:500">${a}</span>`).join('') : ''}
${d.streetEasy.features.length > 0 ? d.streetEasy.features.map(f => `<span style="background:#A89035;color:#fff;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:500">${f}</span>`).join('') : ''}
</div>
${d.streetEasy.petsAllowed !== null ? `<div style="font-size:11px;color:#666"><strong>Pets:</strong> ${d.streetEasy.petPolicy || (d.streetEasy.petsAllowed ? 'Allowed' : 'Not allowed')}</div>` : ''}
${d.streetEasy.views.length > 0 ? `<div style="font-size:11px;color:#666;margin-top:4px"><strong>Views:</strong> ${d.streetEasy.views.join(', ')}</div>` : ''}
${d.streetEasy.activeListings.length > 0 ? `<div style="font-size:11px;color:#666;margin-top:8px"><strong>Active Listings:</strong> ${d.streetEasy.activeListings.map(l => `${l.beds}BR/${l.baths}BA${l.sqft ? ' · ' + l.sqft.toLocaleString() + ' ft²' : ''}${l.broker ? ' (' + l.broker + ')' : ''}`).join(' &nbsp;|&nbsp; ')}</div>` : ''}
</div>
` : ''}

<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-radius:8px;padding:20px;margin-top:12px">
<p style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:14px;color:#555;line-height:1.8;text-align:center">${hookLine}</p>
</div>
</div>

<!-- PAGE 2B: INQUIRY-DRIVEN FOCUS -->
<div class="section section-cream">
<div class="section-title">Inquiry-Driven Focus</div>
<div class="section-sub">${safe(primaryFocus.headline)} for ${safe(d.buildingName)}</div>
${inquiryMeta ? `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#A89035;font-weight:800;margin-bottom:12px">${safe(inquiryMeta)}</div>` : ''}
${reportFocus.inquiryNotes ? `<div style="background:#fff;border:1px solid #D5D0C6;border-left:4px solid #A89035;padding:12px 14px;margin-bottom:16px;color:#3A4B5B;font-size:11px;line-height:1.6"><strong>Inquiry notes:</strong> ${safe(reportFocus.inquiryNotes)}</div>` : ''}
<p style="font-size:13px;color:#3A4B5B;line-height:1.75;margin-bottom:18px">Camelot uses this brief as a report lens. The source data, release guardrails, property identity checks, violations, ownership, LL97, DOB, HPD, DOF, ACRIS, and market records remain factual and source-driven; the selected focus only changes what Camelot emphasizes in the narrative, proposal language, and follow-up angle.</p>
<div style="display:grid;grid-template-columns:repeat(${Math.min(selectedFocusThemes.length || 1, 3)},1fr);gap:14px;margin-bottom:18px">
${selectedFocusThemes.map(theme => `
<div style="background:#fff;border:1px solid #D5D0C6;border-top:4px solid #A89035;padding:16px;min-height:190px">
<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
<div style="width:42px;height:42px;background:#3A4B5B;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;letter-spacing:0.6px">${safe(theme.icon)}</div>
<div>
<h4 style="font-size:15px;color:#0D2E63;margin:0">${safe(theme.label)}</h4>
<div style="font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:#A89035;font-weight:700">Selected focus</div>
</div>
</div>
<p style="font-size:11px;color:#555;line-height:1.65;margin-bottom:10px">${safe(theme.narrative)}</p>
<ul style="padding-left:16px;margin:0;color:#3A4B5B;font-size:10px;line-height:1.7">
${theme.proofPoints.map(point => `<li>${safe(point)}</li>`).join('')}
</ul>
</div>`).join('')}
</div>
<div style="background:#3A4B5B;color:#fff;padding:16px 20px;font-size:12px;line-height:1.7"><strong style="color:#D4AF37">Camelot report rule:</strong> the report may be tailored around one or more selected focus areas, but Camelot will not change facts, scoring, source status, or release blockers to fit the sales angle.</div>
</div>

${hasFinancingFocus ? `
<!-- PAGE 2C: FINANCING ADVISORY -->
<div class="section section-cream">
<div class="section-title">Financing &amp; Capital Advisory</div>
<div class="section-sub">Refinancing, credit lines, capital-improvement debt, and lender RFP support for ${safe(d.buildingName)}</div>
<p style="font-size:13px;color:#3A4B5B;line-height:1.75;margin-bottom:16px">When an owner, co-op, condominium, HOA, receiver, or rental landlord has a mortgage maturity, capital project, reserve shortfall, bridge loan, credit-line need, or refinance opportunity, Camelot can support the process from first review through closing. This service is separate from ordinary property management and is structured as a capital advisory / financing coordination engagement.</p>
<div style="display:grid;grid-template-columns:1.04fr .96fr;gap:18px;margin-bottom:18px">
<div style="background:#fff;border:1px solid #D5D0C6;border-left:4px solid #A89035;padding:18px">
<h4 style="font-size:16px;color:#0D2E63;margin:0 0 10px">Camelot Financing Workflow</h4>
<ul style="padding-left:18px;margin:0;color:#3A4B5B;font-size:11px;line-height:1.75">
<li>Review the existing debt stack, maturity dates, payment history, reserve position, arrears, operating budget, insurance, capital plan, and collateral profile.</li>
<li>Build an RFP package so banks and lenders respond to the same facts, terms, assumptions, and requested loan structure.</li>
<li>Bid the financing need across appropriate banks, agency lenders, portfolio lenders, credit unions, private lenders, and short-term / long-term capital providers.</li>
<li>Level the quotes into an apples-to-apples comparison: rate, term, amortization, IO period, recourse, fees, reserves, covenants, closing conditions, prepayment, and timing.</li>
<li>Present ownership with a sensitivity analysis and Camelot's operational opinion so the decision is not made on rate alone.</li>
<li>Coordinate the selected lender's due-diligence request list, bank file, engineer/accountant/attorney inputs, board approvals, and closing logistics.</li>
<li>Assist after closing with funding deployment for the approved project, reserve cushion, compliance plan, or stabilization objective.</li>
</ul>
</div>
<div style="display:grid;gap:12px">
<div style="background:#3A4B5B;color:#fff;padding:16px;border:1px solid #2C3D4C">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#D4AF37;font-weight:800;margin-bottom:6px">Separate Advisory Fee</div>
<p style="font-size:12px;line-height:1.6;margin:0"><strong style="color:#fff">New loan / capital improvement / credit-line placement:</strong> 1.00% of the full loan amount, separately approved.</p>
<p style="font-size:12px;line-height:1.6;margin:8px 0 0"><strong style="color:#fff">Refinance / incremental proceeds:</strong> 0.05% of the difference between the original loan amount and the new loan amount, subject to final engagement terms.</p>
</div>
<div style="background:#fff;border:1px solid #D5D0C6;padding:16px">
<h4 style="font-size:14px;color:#0D2E63;margin:0 0 8px">Ownership / Board Deliverables</h4>
<ul style="padding-left:18px;margin:0;color:#3A4B5B;font-size:11px;line-height:1.7">
<li>Lender RFP and quote matrix</li>
<li>Rate, payment, proceeds, and amortization sensitivity</li>
<li>Closing checklist and bank-file tracker</li>
<li>Attorney / accountant / engineer coordination</li>
<li>Capital deployment plan after closing</li>
</ul>
</div>
</div>
</div>
<div style="background:#fff;border:1px solid #D5D0C6;padding:16px;margin-bottom:14px">
<h4 style="font-size:16px;color:#0D2E63;margin:0 0 10px">Current Market Rate Screen</h4>
<table style="width:100%;border-collapse:collapse;font-size:11px">
<tr style="background:#3A4B5B;color:#fff"><th style="padding:9px;text-align:left">Product / Need</th><th style="padding:9px;text-align:left">Indicative Public Range</th><th style="padding:9px;text-align:left">Jackie Read</th></tr>
<tr><td style="padding:9px;border-bottom:1px solid #E5E3DE">Stabilized multifamily / apartment permanent debt</td><td style="padding:9px;border-bottom:1px solid #E5E3DE">Generally mid-5% to low-7% depending on leverage, agency/bank execution, term, and collateral</td><td style="padding:9px;border-bottom:1px solid #E5E3DE">Best fit when financials, insurance, violations, arrears, and reserves are clean enough for bank review.</td></tr>
<tr><td style="padding:9px;border-bottom:1px solid #E5E3DE">Portfolio bank / co-op / condo association refinance</td><td style="padding:9px;border-bottom:1px solid #E5E3DE">Quoted by bank RFP; rate often depends on deposits, debt service, collateral, reserves, governance, and building condition</td><td style="padding:9px;border-bottom:1px solid #E5E3DE">Camelot should run a lender RFP instead of relying on one relationship or a renewal quote.</td></tr>
<tr><td style="padding:9px;border-bottom:1px solid #E5E3DE">Bridge / transitional / high-urgency capital</td><td style="padding:9px;border-bottom:1px solid #E5E3DE">Often high single digits to low teens, with fees and shorter duration</td><td style="padding:9px;border-bottom:1px solid #E5E3DE">Useful only when timing or distress requires speed; exit strategy must be underwritten up front.</td></tr>
<tr><td style="padding:9px">Capital improvement line / reserve cushion</td><td style="padding:9px">Bank-specific; may be term loan, line of credit, or staged capital project facility</td><td style="padding:9px">Useful for LL/FISP, roof, facade, elevator, mechanical, insurance, or emergency reserve planning.</td></tr>
</table>
</div>
<div style="background:#F8F6EF;border:1px solid #D8C894;padding:12px 14px;font-size:10px;color:#555;line-height:1.6">
<strong style="color:#A89035">Rate-source note:</strong> Public rate screens are directional only and must be replaced with live lender quotes before board action. Current market context should be checked against MBA commercial/multifamily finance updates, agency/bank apartment-loan rate sheets, bank treasury spreads, and actual lender RFP responses. Underwriting can move materially based on DSCR, LTV, rate-lock timing, violations, litigation, insurance, reserves, arrears, sponsor/board strength, collateral condition, and closing timeline.
</div>
</div>
` : ''}

<div class="deck-slide">
<div class="brand-logo"><img src="./images/camelot-logo.png" alt="Camelot Realty Group" onerror="this.style.display='none'"></div>
<h2 class="deck-title">Commercial &amp; Amenity Intelligence</h2>
<p class="deck-kicker" style="margin:-8px 0 28px 24px">Camelot checks the subject property for commercial occupants, owner/renter uses, revenue-producing spaces, official building branding, and resident amenities.</p>
${renderSubjectPhotoStrip(d, { limit: 3, height: 106, caption: 'Subject-property amenity and exterior visuals' })}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:22px">
<div class="deck-card" style="min-height:220px">
<h4>Commercial Owners &amp; Renters</h4>
<ul>
${commercialSignals.map(s => `<li>${safe(s)}</li>`).join('')}
</ul>
</div>
<div class="deck-card" style="min-height:220px">
<h4>Amenities &amp; Resident Spaces</h4>
<ul>
${amenityList.map(a => `<li>${safe(a)}</li>`).join('')}
</ul>
</div>
</div>
<div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:22px;margin-top:22px">
<div class="deck-card">
<h4>Operating / Revenue Review</h4>
<ul>
${revenueOpportunities.map(o => `<li>${safe(o)}</li>`).join('')}
</ul>
</div>
<div class="deck-card">
<h4>Official Building Branding</h4>
${commercialIntel.officialWebsite ? `<p><strong>Website:</strong> <a href="${commercialIntel.officialWebsite}" target="_blank">${safe(commercialIntel.brandingTitle || commercialIntel.officialWebsite)}</a></p>` : '<p>Official building website not confirmed yet. Camelot attempted a website search; board-facing release should verify branding and images manually if no site is found.</p>'}
${commercialIntel.brandingDescription ? `<p style="margin-top:10px">${safe(commercialIntel.brandingDescription)}</p>` : ''}
<p style="margin-top:12px;font-size:11px;color:#777"><strong>Status:</strong> ${commercialIntel.researchStatus === 'verified' ? 'Verified signals found' : 'Needs review'}<br><strong>Sources:</strong> ${commercialIntel.researchSources.map(safe).join(' · ')}</p>
</div>
</div>
<div style="background:#fff;border:1px solid #D8C894;border-radius:8px;padding:10px 12px;margin-top:14px;font-size:10px;color:#555;line-height:1.55">
<strong style="color:#A89035">Commercial / amenity source stack:</strong>
NYC vacant storefront data · CoStar/LoopNet-style commercial listings · Walker &amp; Dunlop Suite / commercial data · Local Logic neighborhood enrichment · PropertyShark · DOT/DOB parking and garage records · public signage and official building website review. Tenant names, garage operators, storage inventory, and amenity revenue must be verified before publication.
<br><strong style="color:#A89035">NY people / entity / comp web stack:</strong> ${safe(nyPeopleEntityCompSourceSummary())}. Use this stack for New York ownership, lender/note, litigation, management-review, broker, comparable-sale/rental, commercial occupant, and entity cross-checks.
<br><strong style="color:#A89035">NY ownership hunt skill:</strong> ${safe(nyOwnershipHuntSummary())}. This is an additive decision-maker and ownership-clue stack, not a replacement for official records. Preferred hunt order: ${safe(NY_OWNERSHIP_HUNT_SEQUENCE.join(' -> '))}. ${safe(NY_OWNERSHIP_HUNT_SIGNATORY_RULE)}
<div style="margin-top:5px">
<a href="https://data.cityofnewyork.us/City-Government/Storefronts-Reported-Vacant-or-Not/92iy-9c3n/about_data" target="_blank">NYC storefront data</a> ·
<a href="https://suite.walkerdunlop.com/" target="_blank">Walker &amp; Dunlop Suite</a> ·
<a href="https://locallogic.co/data-enrichment/" target="_blank">Local Logic</a> ·
<a href="https://www.propertyshark.com/mason/ny/New-York-City/Property-Search" target="_blank">PropertyShark</a>
Â· <a href="https://www.pincusco.com/" target="_blank">PincusCo</a>
Â· <a href="https://www.compass.com/" target="_blank">Compass</a>
Â· <a href="https://www.cityrealty.com/nyc" target="_blank">CityRealty</a>
Â· <a href="https://www.openigloo.com/" target="_blank">Openigloo</a>
Â· <a href="https://www.casemine.com/" target="_blank">CaseMine</a>
Â· <a href="https://www.corcoran.com/" target="_blank">Corcoran</a>
Â· <a href="https://www.realtor.com/" target="_blank">Realtor.com</a>
Â· <a href="https://www.zillow.com/" target="_blank">Zillow</a>
</div>
</div>
${commercialIntel.brandingImages.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(commercialIntel.brandingImages.length, 4)},1fr);gap:10px;margin-top:18px">${commercialIntel.brandingImages.slice(0, 4).map(src => `<div style="height:100px;border:1px solid #D5D0C6;background:#fff;overflow:hidden"><img src="${src}" alt="${safe(d.buildingName)} branding image" style="width:100%;height:100%;object-fit:cover"></div>`).join('')}</div>` : ''}
</div>

<!-- PAGE 2B: NEIGHBORHOOD INTELLIGENCE -->
<div class="section section-cream">
<div class="section-title">Neighborhood Intelligence</div>
<div class="section-sub">${d.neighborhoodName ? d.neighborhoodName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : d.borough || 'New York City'} &mdash; Market Context</div>
${renderSubjectPhotoStrip(d, { limit: 3, height: 90, caption: 'Property imagery anchors the neighborhood and route analysis' })}

<div style="margin-bottom:20px">
<div style="margin-bottom:16px;border-radius:10px;overflow:hidden;border:1px solid #D5D0C6;height:250px">
<iframe src="https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_REPORT_KEY}&origin=57+West+57th+Street+Suite+410+New+York+NY+10019&destination=${encodedAddr}&mode=driving" width="100%" height="250" style="border:0" allowfullscreen loading="lazy"></iframe>
</div>
<div style="background:#fff;border:1px solid #E5E3DE;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:16px;margin-bottom:12px">
<h4 style="font-size:13px;font-weight:700;color:#2C3240;margin-bottom:4px">\uD83D\uDCCD Camelot Office \u2192 ${d.buildingName}</h4>
<p style="font-size:12px;color:#555">Camelot Realty Group operates from <strong>57 West 57th Street, Suite 410</strong> (Midtown Manhattan). The map above shows the driving route to your property at ${d.address}. Camelot\u2019s senior managers conduct regular on-site inspections \u2014 your building is within our core service area with rapid response times.</p>
</div>
<div style="background:#fff;border:1px solid #E5E3DE;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:16px;margin-bottom:12px">
<h4 style="font-size:13px;font-weight:700;color:#2C3240;margin-bottom:4px">\uD83D\uDE87 Transit Commute — Camelot Office ↔ ${d.buildingName}</h4>
<p style="font-size:12px;color:#555;margin-bottom:10px">Transit route from <strong>57 West 57th Street (Camelot HQ)</strong> to your property. Camelot's senior management conducts regular on-site inspections via subway and car.</p>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
<div style="border-radius:8px;overflow:hidden;border:1px solid #D5D0C6">
<iframe src="https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_REPORT_KEY}&origin=57+West+57th+Street+Suite+410+New+York+NY+10019&destination=${encodedAddr}&mode=transit" width="100%" height="200" style="border:0" allowfullscreen loading="lazy"></iframe>
<div style="text-align:center;font-size:9px;color:#999;padding:4px">🚇 Transit Route — Camelot → Property</div>
</div>
<div style="border-radius:8px;overflow:hidden;border:1px solid #D5D0C6">
<iframe src="https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_REPORT_KEY}&origin=57+West+57th+Street+Suite+410+New+York+NY+10019&destination=${encodedAddr}&mode=walking" width="100%" height="200" style="border:0" allowfullscreen loading="lazy"></iframe>
<div style="text-align:center;font-size:9px;color:#999;padding:4px">🚶 Walking Route — Camelot → Property</div>
</div>
</div>
</div>

${d.neighborhoodMarketData ? `
<div style="margin-bottom:16px;border-left:4px solid #A89035;padding-left:12px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600">Neighborhood Scores</div>
</div>
<div class="stats-row">
<div class="stat-box"><div class="val gold">${d.neighborhoodMarketData.investScore}</div><div class="lbl">💰 Invest</div></div>
<div class="stat-box"><div class="val gold">${d.neighborhoodMarketData.liveScore}</div><div class="lbl">🏠 Live</div></div>
<div class="stat-box"><div class="val gold">${d.neighborhoodMarketData.familyScore}</div><div class="lbl">👨‍👩‍👧 Family</div></div>
<div class="stat-box"><div class="val gold">${d.neighborhoodMarketData.workScore}</div><div class="lbl">💼 Work</div></div>
</div>
<div style="text-align:center;font-size:12px;color:#555;margin-top:8px">
Price Momentum: <strong style="color:${d.neighborhoodMarketData.momentum === 'Very Strong' ? '#16a34a' : d.neighborhoodMarketData.momentum === 'Strong' ? '#16a34a' : '#ca8a04'}">${d.neighborhoodMarketData.momentum} ↑</strong>
&nbsp;&nbsp;|&nbsp;&nbsp;Avg Days on Market: <strong>${d.neighborhoodMarketData.daysOnMarket} days</strong>
&nbsp;&nbsp;|&nbsp;&nbsp;Operating Costs: <strong>${d.neighborhoodMarketData.opexRange}</strong>
</div>
<div style="font-size:10px;color:#777;line-height:1.55;margin-top:10px;background:#fff;border:1px solid #E5E3DE;border-radius:8px;padding:10px 12px">
<strong style="color:#A89035">Neighborhood scoring source stack:</strong>
Niche neighborhood livability, NeighborhoodScout crime context, NYC Open Data / 311 / NYPD signals, Zonda market snapshots, MTA subway/bus access, NYC DOT roadway/emergency access, and Camelot site-coverage modeling from 57 West 57th Street.
<div style="margin-top:5px"><span style="font-weight:700;color:#14356A">Ⓜ Subway &amp; Transit</span> · <span style="font-weight:700;color:#14356A">311 Bus &amp; Local Coverage</span> · <span style="font-weight:700;color:#14356A">DOT Road &amp; Emergency Access</span></div>
</div>
` : ''}

${d.neighborhoodIntel ? generateNeighborhoodIntelHTML(d.neighborhoodIntel, d.neighborhoodName || d.borough || 'NYC') : ''}
</div>

<!-- PAGE 3: PROPERTY OVERVIEW -->
<div class="section section-cream">
<div class="section-title">The Property</div>
<div class="section-sub">Building overview and current intelligence</div>
${renderSubjectPhotoStrip(d, { limit: 4, height: 104, caption: d.buildingPhotos?.source || 'Property visual reference set' })}
<div class="stats-row">
<div class="stat-box"><div class="val">${d.units || 'N/A'}</div><div class="lbl">Units</div></div>
<div class="stat-box"><div class="val">${d.stories || 'N/A'}</div><div class="lbl">Floors</div></div>
<div class="stat-box"><div class="val">${d.scoutGrade}</div><div class="lbl">Scout Grade</div></div>
<div class="stat-box"><div class="val">${d.scoutScore}</div><div class="lbl">Scout Score</div></div>
</div>
<div class="info-grid">
<div><div class="label">Address</div><div class="value">${addr}</div></div>
<div><div class="label">Current Management</div><div class="value">${verifiedManagementLabel(d.managementCompany)}</div></div>
<div><div class="label">Market Value</div><div class="value" style="color:#A89035;font-weight:700;font-size:15px">${fmtMoney(d.marketValue)}</div></div>
<div><div class="label">Assessed Value</div><div class="value">${fmtMoney(d.assessedValue)}</div></div>
<div><div class="label">Year Built</div><div class="value">${d.yearBuilt || 'N/A'}</div></div>
<div><div class="label">Building Class</div><div class="value">${d.buildingClass || 'N/A'}</div></div>
<div><div class="label">DOF Owner</div><div class="value">${d.dofOwner || 'N/A'}</div></div>
<div><div class="label">BBL</div><div class="value">${d.bbl || 'N/A'}</div></div>
</div>
${d.energyStarScore != null ? `
<div style="margin-top:16px;border-left:4px solid #A89035;padding-left:12px;margin-bottom:8px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600">Energy &amp; LL97 Compliance</div>
</div>
<div class="stats-row">
<div class="stat-box"><div class="val" style="color:${d.energyStarScore >= 75 ? '#16a34a' : d.energyStarScore >= 50 ? '#ca8a04' : '#dc2626'}">${d.energyStarScore}</div><div class="lbl">Energy Star</div></div>
${d.siteEUI ? `<div class="stat-box"><div class="val">${d.siteEUI.toFixed(1)}</div><div class="lbl">Site EUI</div></div>` : ''}
${d.ghgEmissions ? `<div class="stat-box"><div class="val">${d.ghgEmissions.toFixed(1)}</div><div class="lbl">GHG (tCO\u2082e)</div></div>` : ''}
${d.occupancy ? `<div class="stat-box"><div class="val">${d.occupancy}%</div><div class="lbl">Occupancy</div></div>` : ''}
</div>` : ''}
</div>

<!-- PAGE 4: VIOLATIONS & INTELLIGENCE -->
<div class="section section-white">
<div class="section-title">Building Intelligence</div>
<div class="section-sub">Violations, compliance, and risk signals</div>
${renderSubjectPhotoStrip(d, { limit: 3, height: 92, caption: 'Building context used alongside public-record checks' })}
<div class="intel-grid">
<div class="intel-card"><div class="val ${d.violationsTotal > 20 ? 'red' : d.violationsTotal > 5 ? 'orange' : 'green'}">${d.violationsTotal}</div><div class="lbl">HPD Violations</div></div>
<div class="intel-card"><div class="val ${d.violationsOpen > 10 ? 'red' : d.violationsOpen > 0 ? 'orange' : 'green'}">${d.violationsOpen}</div><div class="lbl">Open Violations</div></div>
<div class="intel-card"><div class="val ${d.ecbPenaltyBalance > 10000 ? 'red' : d.ecbCount > 0 ? 'orange' : 'green'}">$${d.ecbPenaltyBalance.toLocaleString()}</div><div class="lbl">ECB Penalty Balance</div></div>
</div>
<div class="info-grid">
<div><div class="label">Violation Class A</div><div class="value">${d.violationClassA}</div></div>
<div><div class="label">Violation Class B</div><div class="value">${d.violationClassB}</div></div>
<div><div class="label">Violation Class C</div><div class="value">${d.violationClassC}</div></div>
<div><div class="label">ECB Violations</div><div class="value">${d.ecbCount}</div></div>
<div><div class="label">Active Litigation</div><div class="value" style="color:${d.hasActiveLitigation ? '#dc2626' : '#16a34a'};font-weight:600">${d.hasActiveLitigation ? '\u26A0\uFE0F YES' : '\u2714 None'}</div></div>
<div><div class="label">Rent Stabilized</div><div class="value">${d.isRentStabilized ? '\uD83D\uDCCB Yes' : 'No'}</div></div>
<div><div class="label">DOB Permits</div><div class="value">${d.permitsCount}</div></div>
<div><div class="label">Distress Level</div><div class="value" style="color:${d.distressLevel === 'critical' || d.distressLevel === 'distressed' ? '#dc2626' : d.distressLevel === 'stressed' ? '#ea580c' : '#2C3240'};font-weight:600">${d.distressLevel.toUpperCase()} (${d.distressScore}/100)</div></div>
</div>
<div style="margin-top:18px;border:1px solid #D5D0C6;background:#fff">
<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:14px 16px;border-bottom:1px solid #D5D0C6;background:#F8F6F0">
<div>
<div style="font-size:11px;text-transform:uppercase;letter-spacing:1.4px;color:#A89035;font-weight:800">HPD Violation Current Status &amp; History</div>
<div style="font-size:11px;color:#555;margin-top:4px">Camelot searches NYC HPD violations by address, then falls back to BBL when DOF confirms the property record.</div>
</div>
<div style="text-align:right;font-size:11px;color:${openHPDViolationItems.length > 0 ? '#dc2626' : '#16a34a'};font-weight:800">${openHPDViolationItems.length} CURRENT OPEN</div>
</div>
${violationHistoryRows ? `
<table style="width:100%;border-collapse:collapse;font-size:10px;color:#2C3240">
<thead><tr style="background:#fff;color:#38557D;text-align:left">
<th style="padding:8px;border-bottom:1px solid #D5D0C6">Date</th>
<th style="padding:8px;border-bottom:1px solid #D5D0C6">Class</th>
<th style="padding:8px;border-bottom:1px solid #D5D0C6">Status</th>
<th style="padding:8px;border-bottom:1px solid #D5D0C6">ID</th>
<th style="padding:8px;border-bottom:1px solid #D5D0C6">Description</th>
</tr></thead>
<tbody>${violationHistoryRows}</tbody>
</table>` : `
<div style="padding:14px 16px;font-size:11px;color:#555;line-height:1.6">No HPD violation rows returned by NYC Open Data for this property after address and BBL search. Camelot should verify HPD Online manually before board-facing release.</div>`}
</div>
<div style="margin-top:16px;border:1px solid #D5D0C6;background:#fff">
<div style="padding:12px 16px;border-bottom:1px solid #D5D0C6;background:${d.complianceReleaseStatus === 'blocked' ? '#FEF2F2' : d.complianceReleaseStatus === 'needs_review' ? '#FFFBEB' : '#F0FDF4'}">
<div style="font-size:11px;text-transform:uppercase;letter-spacing:1.4px;color:${d.complianceReleaseStatus === 'blocked' ? '#dc2626' : '#A89035'};font-weight:800">Violation Source Coverage</div>
<div style="font-size:10px;color:#555;margin-top:4px">Camelot checks HPD, DOB BIS &amp; DOB NOW, ECB/OATH, DHCR / rent stabilization, DOF tax liens, ACRIS liens and claims, 311 Service Requests, HPD housing litigation, NYS eCourts / WebCivil, and LexisNexis/manual legal enrichment. A report cannot claim a clean building when every automated public-risk source returns zero without manual verification.</div>
</div>
<table style="width:100%;border-collapse:collapse;font-size:10px">
<thead><tr style="background:#F8F6F0;text-align:left;color:#38557D">
<th style="padding:8px;border-bottom:1px solid #D5D0C6">Source</th>
<th style="padding:8px;border-bottom:1px solid #D5D0C6">Status</th>
<th style="padding:8px;border-bottom:1px solid #D5D0C6;text-align:center">Rows</th>
<th style="padding:8px;border-bottom:1px solid #D5D0C6">Release Note</th>
</tr></thead>
<tbody>${complianceSourceRows}</tbody>
</table>
</div>
${d.distressSignals.length > 0 ? `
<div style="margin-top:16px;border-left:4px solid #dc2626;padding-left:12px;margin-bottom:8px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#dc2626;font-weight:600">Distress Signals</div>
</div>
<div style="display:flex;flex-wrap:wrap;gap:8px">${d.distressSignals.map(s => `<span style="display:inline-block;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.25);color:#991b1b;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:500">${s.description}</span>`).join('')}</div>` : ''}

<!-- Legal & Regulatory Cross-Reference -->
<div style="margin-top:20px;background:#fff;border:2px solid #3A4B5B;border-radius:8px;padding:18px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#3A4B5B;font-weight:700;margin-bottom:10px">⚖️ Legal & Regulatory Cross-Reference</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
<div style="background:#EDE9DF;border-radius:6px;padding:12px">
<div style="font-size:11px;font-weight:700;color:#2C3240;margin-bottom:4px">LexisNexis — Litigation & Liens</div>
<div style="font-size:10px;color:#555;line-height:1.5">Cross-reference recommended: lawsuits, judgments, UCC filings, liens, and regulatory actions against the building, management company, or ownership entity.</div>
<a href="https://www.lexisnexis.com/en-us/gateway.page" target="_blank" style="font-size:10px;color:#A89035;text-decoration:underline;display:inline-block;margin-top:4px">Search LexisNexis →</a>
</div>
<div style="background:#EDE9DF;border-radius:6px;padding:12px">
<div style="font-size:11px;font-weight:700;color:#2C3240;margin-bottom:4px">NY Attorney General — Offering Plans</div>
<div style="font-size:10px;color:#555;line-height:1.5">Co-op and condo offering plans, amendments, and sponsor disclosures filed with the AG's Real Estate Finance Bureau. Key for understanding building governance structure.</div>
<a href="https://offeringplandatasearch.ag.ny.gov/" target="_blank" style="font-size:10px;color:#A89035;text-decoration:underline;display:inline-block;margin-top:4px">Search AG Offering Plans →</a>
</div>
<div style="background:#EDE9DF;border-radius:6px;padding:12px">
<div style="font-size:11px;font-weight:700;color:#2C3240;margin-bottom:4px">Domecile — Fees & Management</div>
<div style="font-size:10px;color:#555;line-height:1.5">Building fees (maintenance, common charges), current management company, amenities, and resident reviews. Useful for competitive fee benchmarking.</div>
<a href="https://www.domecile.com/search?q=${encodedNeighborhoodContext}" target="_blank" style="font-size:10px;color:#A89035;text-decoration:underline;display:inline-block;margin-top:4px">Search Domecile by ZIP / neighborhood context →</a>
</div>
<div style="background:#EDE9DF;border-radius:6px;padding:12px">
<div style="font-size:11px;font-weight:700;color:#2C3240;margin-bottom:4px">NYSCEF — Court E-Filings</div>
<div style="font-size:10px;color:#555;line-height:1.5">NY State Courts Electronic Filing system. Search for active litigation, HP actions (housing court), breach of warranty, and construction disputes.</div>
<a href="https://iapps.courts.state.ny.us/nyscef/CaseSearch" target="_blank" style="font-size:10px;color:#A89035;text-decoration:underline;display:inline-block;margin-top:4px">Search NYSCEF →</a>
</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
<div style="background:#EDE9DF;border-radius:6px;padding:12px">
<div style="font-size:11px;font-weight:700;color:#2C3240;margin-bottom:4px">Jack Jaffa & Associates — Violations</div>
<div style="font-size:10px;color:#555;line-height:1.5">Industry-standard violation research, removal services, ECB hearing representation, and expediting. Deep database of NYC building violations history.</div>
<a href="https://www.jackjaffa.com/violation-services/" target="_blank" style="font-size:10px;color:#A89035;text-decoration:underline;display:inline-block;margin-top:4px">Jack Jaffa Violations →</a>
</div>
<div style="background:#EDE9DF;border-radius:6px;padding:12px">
<div style="font-size:11px;font-weight:700;color:#2C3240;margin-bottom:4px">SiteCompli — Compliance Platform</div>
<div style="font-size:10px;color:#555;line-height:1.5">Comprehensive building compliance: violations, ownership data, open permits, complaints (complaint & non-complaint), inspections, and compliance calendar tracking.</div>
<a href="https://clients.sitecompli.com" target="_blank" style="font-size:10px;color:#A89035;text-decoration:underline;display:inline-block;margin-top:4px">SiteCompli Dashboard →</a>
</div>
</div>
<div style="font-size:9px;color:#888;margin-top:10px;text-align:center">Jackie recommends cross-referencing all databases before engagement. LexisNexis and SiteCompli require subscriptions. AG Offering Plans, NYSCEF, DOB BIS, and Jack Jaffa lookups are publicly accessible.</div>
<div style="background:#F8F5EC;border:1px solid #D8C894;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:10px;color:#555;line-height:1.55">
<strong style="color:#A89035">Required property-record source stack:</strong>
NYC DOB Find Building Data · DOB Violations · NYC HPD/HPD Online · OATH/ECB · NYC DOF / PROS · ACRIS · PropertyShark · PublicRecordsData · NeighborWho. Camelot treats paid/marketing record sites as secondary cross-checks and will not publish a board-facing report when BBL, borough, building class, unit count, or floor count conflicts with the subject address.
<div style="margin-top:5px">
<a href="https://www.nyc.gov/site/buildings/dob/find-building-data.page" target="_blank">DOB building data</a> ·
<a href="https://www.nyc.gov/site/buildings/safety/dob-violations.page" target="_blank">DOB violations</a> ·
<a href="https://a806-pros.nyc.gov/PROS/" target="_blank">NYC DOF / PROS</a> ·
<a href="https://www.propertyshark.com/mason/ny/New-York-City/Property-Search" target="_blank">PropertyShark</a>
</div>
</div>
</div>
</div>

<!-- GUT CHECK — Sentinel Market Comparison -->
${(() => {
  const gc = runGutCheck(d);
  return generateGutCheckHTML(gc);
})()}

<!-- PAGE 5: OWNERSHIP & FINANCIAL -->
<div class="section section-cream">
<div class="section-title">Ownership &amp; Financial History</div>
<div class="section-sub">ACRIS official deed, mortgage, and party records plus NYC Department of Finance / PROS tax, assessment, exemption, abatement, and lien records</div>
${renderSubjectPhotoStrip(d, { limit: 3, height: 88, caption: 'Subject-property visuals retained through the ownership and finance review' })}
<div style="background:#fff;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:12px 14px;margin:12px 0 16px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.6px;color:#A89035;font-weight:800;margin-bottom:6px">Required Official Source Stack</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
<div style="background:#F8F5EC;border-radius:6px;padding:10px">
<div style="font-size:11px;font-weight:800;color:#2C3240;margin-bottom:4px">ACRIS</div>
<div style="font-size:10px;color:#555;line-height:1.5">Official NYC recorded documents: deeds, mortgages, assignments, satisfactions, liens, party names, signatories, and entity trails.</div>
<a href="https://a836-acris.nyc.gov/CP/" target="_blank" rel="noopener" style="font-size:10px;color:#A89035;text-decoration:underline;display:inline-block;margin-top:5px">Search NYC ACRIS</a>
</div>
<div style="background:#F8F5EC;border-radius:6px;padding:10px">
<div style="font-size:11px;font-weight:800;color:#2C3240;margin-bottom:4px">NYC Department of Finance / Taxation</div>
<div style="font-size:10px;color:#555;line-height:1.5">Official DOF / PROS tax and finance records: owner/tax-lot profile, assessed value, market value, exemptions, abatements, tax bills, and lien-sale indicators.</div>
<a href="https://a806-pros.nyc.gov/PROS/" target="_blank" rel="noopener" style="font-size:10px;color:#A89035;text-decoration:underline;display:inline-block;margin-top:5px">Search NYC DOF / PROS</a>
</div>
</div>
</div>
<div class="info-grid">
<div><div class="label">Last Sale Date</div><div class="value">${d.lastSaleDate ? new Date(d.lastSaleDate).toLocaleDateString() : (d.propertyType.toLowerCase().includes('condo') ? 'Unit-level sales; whole-building sale not applicable' : 'Not found in ACRIS scan')}</div></div>
<div><div class="label">Last Sale Price</div><div class="value" style="font-weight:700;color:#A89035">${d.lastSalePrice ? fmtMoney(d.lastSalePrice) : (d.propertyType.toLowerCase().includes('condo') ? 'Review recent unit comps' : 'Not found')}</div></div>
<div><div class="label">Buyer</div><div class="value">${d.lastSaleBuyer || (d.propertyType.toLowerCase().includes('condo') ? 'Individual condominium owners' : 'Not found')}</div></div>
<div><div class="label">Seller</div><div class="value">${d.lastSaleSeller || (d.propertyType.toLowerCase().includes('condo') ? 'Unit-level ACRIS records' : 'Not found')}</div></div>
<div><div class="label">Deeds on Record</div><div class="value">${d.deedCount}</div></div>
<div><div class="label">Mortgages on Record</div><div class="value">${d.mortgageCount}</div></div>
<div><div class="label">DOF Market Value</div><div class="value">${d.dofTaxMarketValue || d.marketValue ? fmtMoney(d.dofTaxMarketValue || d.marketValue) : 'To verify in DOF / PROS'}</div></div>
<div><div class="label">DOF Assessed Value</div><div class="value">${d.dofTaxAssessedValue || d.assessedValue ? fmtMoney(d.dofTaxAssessedValue || d.assessedValue) : 'To verify in DOF / PROS'}</div></div>
<div><div class="label">Tax / Lien Review</div><div class="value">${d.taxLienSourceStatus || (d.taxLienRecordCount ? `${d.taxLienRecordCount} DOF lien row(s)` : 'DOF tax and lien search required')}</div></div>
<div><div class="label">Abatement / Exemption</div><div class="value">${d.abatementSourceStatus || d.abatementType || 'DOF exemption / abatement review required'}</div></div>
</div>
<div style="font-size:10px;color:#777;line-height:1.55;margin-top:12px">Camelot treats PropertyShark, StreetEasy, broker materials, board files, and other sources as helpful cross-checks, but New York ownership and financial history must always be reconciled against ACRIS and NYC Department of Finance / taxation records before it is relied on in a board-facing proposal.</div>
</div>

<!-- PAGE 5B: BUILDING CONTACTS & STAKEHOLDERS -->
<div class="section section-white">
<div class="section-title">Building Contacts &amp; Stakeholders</div>
<div class="section-sub">Key decision-makers, personnel, governance, and professional services for ${d.buildingName}</div>
${renderSubjectPhotoStrip(d, { limit: 3, height: 84, caption: 'Property image context for stakeholder and management review' })}
<div style="background:#fff;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:12px 14px;margin:12px 0 16px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.6px;color:#A89035;font-weight:800;margin-bottom:6px">Stakeholder Data Sources</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px">
${(d.contactResearchSources || []).map(src => `<div style="font-size:10px;color:#555;line-height:1.45">• ${safe(src)}</div>`).join('')}
</div>
<div style="font-size:9px;color:#888;margin-top:8px">Camelot uses HPD MDR, ACRIS, DOB, and DOF records first; PropertyShark and Apollo are verification/enrichment sources where private contact data must be confirmed before publication.</div>
</div>

<!-- BOARD / OWNERSHIP — Most Important -->
<div style="background:#3A4B5B;border-radius:8px;padding:18px;margin-bottom:16px;color:#fff">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:700;margin-bottom:10px">\uD83C\uDFDB\uFE0F Board of Directors / Ownership</div>
<table style="width:100%;border-collapse:collapse">
<thead><tr>
<th style="text-align:left;padding:8px 12px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#A89035;border-bottom:1px solid rgba(168,144,53,0.3)">Name</th>
<th style="text-align:left;padding:8px 12px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#A89035;border-bottom:1px solid rgba(168,144,53,0.3)">Role / Title</th>
</tr></thead>
<tbody>
${d.dofOwner ? `<tr><td style="padding:8px 12px;font-size:12px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.1)">${d.dofOwner}</td><td style="padding:8px 12px;font-size:12px;color:rgba(255,255,255,0.7);border-bottom:1px solid rgba(255,255,255,0.1)">Owner (NYC DOF Record)</td></tr>` : ''}
${d.registrationOwner ? `<tr><td style="padding:8px 12px;font-size:12px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.1)">${d.registrationOwner}</td><td style="padding:8px 12px;font-size:12px;color:rgba(255,255,255,0.7);border-bottom:1px solid rgba(255,255,255,0.1)">Registration Owner (HPD)</td></tr>` : ''}
${d.boardMembers.map(b => `<tr><td style="padding:8px 12px;font-size:12px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.1);font-weight:600">${b.name}</td><td style="padding:8px 12px;font-size:12px;color:#A89035;border-bottom:1px solid rgba(255,255,255,0.1)">${b.title}</td></tr>`).join('')}
${d.boardMembers.length === 0 ? '<tr><td colspan="2" style="padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.5);font-style:italic">Ownership and board details to be confirmed upon engagement with the building.</td></tr>' : ''}
</tbody>
</table>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

<!-- BUILDING STAFF -->
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-radius:8px;padding:16px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:700;margin-bottom:10px">\uD83D\uDC77 Building Staff</div>
${d.buildingStaff.length > 0 ? `
<table style="width:100%;border-collapse:collapse">
${d.buildingStaff.map(s => `<tr><td style="padding:6px 0;font-size:12px;font-weight:600;color:#2C3240">${s.name}</td><td style="padding:6px 0;font-size:11px;color:#888;text-align:right">${s.role}</td></tr>`).join('')}
</table>` : `
<div style="font-size:11px;color:#888;line-height:1.6;font-style:italic">
Staff details will be confirmed during our initial building assessment and transition planning.
</div>`}
</div>

<!-- MANAGEMENT -->
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-radius:8px;padding:16px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:700;margin-bottom:10px">\uD83C\uDFE2 Current Management</div>
<div style="font-size:14px;font-weight:700;color:#2C3240;margin-bottom:8px">${verifiedManagementLabel(brochureActualMgmt || d.managementCompany)}</div>
<div style="font-size:11px;color:#888;line-height:1.6">
<div style="margin-bottom:4px">\u2022 Managing Agent \u2014 <em>${verifiedManagementLabel(brochureActualMgmt || d.managementCompany)}</em></div>
${d.managementDuration ? `<div style="margin-bottom:4px">\u2022 Duration \u2014 ~${d.managementDuration}</div>` : ''}
<div style="margin-bottom:4px">\u2022 Management Grade \u2014 <strong style="color:${d.managementGrade === 'A' ? '#16a34a' : d.managementGrade === 'B' ? '#ca8a04' : '#dc2626'}">${d.managementGrade}</strong> (${d.managementScorecard.overall}/100)</div>
</div>
</div>
</div>

<!-- PROFESSIONAL SERVICES — From DOB Permit Records -->
<div style="background:#fff;border:2px solid #A89035;border-radius:8px;padding:18px;margin-bottom:16px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:700;margin-bottom:12px">⚖️ Professional Services <span style="font-weight:400;color:#888;text-transform:none;letter-spacing:0">(from DOB permit filings)</span></div>
<table style="width:100%;border-collapse:collapse">
<thead><tr>
<th style="text-align:left;padding:8px 12px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#A89035;border-bottom:2px solid #A89035;width:30%">Role</th>
<th style="text-align:left;padding:8px 12px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#A89035;border-bottom:2px solid #A89035">Name</th>
<th style="text-align:left;padding:8px 12px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#A89035;border-bottom:2px solid #A89035">License</th>
</tr></thead>
<tbody>
${d.dobArchitects.length > 0 ? d.dobArchitects.map((a, i) => `<tr${i % 2 ? ' style="background:#EDE9DF"' : ''}><td style="padding:10px 12px;font-size:12px;font-weight:600;color:#2C3240;border-bottom:1px solid #E5E3DE">🏗️ ${a.title}</td><td style="padding:10px 12px;font-size:12px;color:#2C3240;border-bottom:1px solid #E5E3DE;font-weight:500">${a.name}</td><td style="padding:10px 12px;font-size:11px;color:#888;border-bottom:1px solid #E5E3DE;font-family:monospace">${a.license || '—'}</td></tr>`).join('') : '<tr><td style="padding:10px 12px;font-size:12px;font-weight:600;color:#2C3240;border-bottom:1px solid #E5E3DE">🏗️ Architect</td><td style="padding:10px 12px;font-size:12px;color:#999;border-bottom:1px solid #E5E3DE;font-style:italic" colspan="2">No DOB permit filings found</td></tr>'}
${d.dobEngineers.length > 0 ? d.dobEngineers.map((e, i) => `<tr${(d.dobArchitects.length + i) % 2 ? ' style="background:#EDE9DF"' : ''}><td style="padding:10px 12px;font-size:12px;font-weight:600;color:#2C3240;border-bottom:1px solid #E5E3DE">⚙️ ${e.title}</td><td style="padding:10px 12px;font-size:12px;color:#2C3240;border-bottom:1px solid #E5E3DE;font-weight:500">${e.name}</td><td style="padding:10px 12px;font-size:11px;color:#888;border-bottom:1px solid #E5E3DE;font-family:monospace">${e.license || '—'}</td></tr>`).join('') : '<tr style="background:#EDE9DF"><td style="padding:10px 12px;font-size:12px;font-weight:600;color:#2C3240;border-bottom:1px solid #E5E3DE">⚙️ Engineer</td><td style="padding:10px 12px;font-size:12px;color:#999;border-bottom:1px solid #E5E3DE;font-style:italic" colspan="2">No DOB permit filings found</td></tr>'}
<tr><td style="padding:10px 12px;font-size:12px;font-weight:600;color:#2C3240;border-bottom:1px solid #E5E3DE">⚖️ Law Firm</td><td style="padding:10px 12px;font-size:12px;color:#2C3240;border-bottom:1px solid #E5E3DE" colspan="2">${d.professionals.lawFirm || '<em style="color:#999">To be identified — check LexisNexis / NYSCEF</em>'}</td></tr>
<tr style="background:#EDE9DF"><td style="padding:10px 12px;font-size:12px;font-weight:600;color:#2C3240">📊 Accounting Firm</td><td style="padding:10px 12px;font-size:12px;color:#2C3240" colspan="2">${d.professionals.accountingFirm || '<em style="color:#999">To be identified — check AG Offering Plan</em>'}</td></tr>
</tbody>
</table>
<div style="font-size:9px;color:#888;margin-top:8px">Sources checked / required: ${(d.professionalResearchSources || []).map(src => safe(src)).join(' · ')}</div>
</div>

<!-- DOB OWNER INFORMATION -->
${d.dobOwners.length > 0 ? `
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-radius:8px;padding:16px;margin-bottom:16px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:700;margin-bottom:10px">🏠 Property Owner(s) — DOB Records</div>
<table style="width:100%;border-collapse:collapse">
<thead><tr>
<th style="text-align:left;padding:6px 10px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#A89035;border-bottom:1px solid #D5D0C6">Name</th>
<th style="text-align:left;padding:6px 10px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#A89035;border-bottom:1px solid #D5D0C6">Business</th>
<th style="text-align:left;padding:6px 10px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#A89035;border-bottom:1px solid #D5D0C6">Phone</th>
<th style="text-align:left;padding:6px 10px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#A89035;border-bottom:1px solid #D5D0C6">Type</th>
</tr></thead>
<tbody>
${d.dobOwners.map((o, i) => `<tr${i % 2 ? ' style="background:#fff"' : ''}><td style="padding:8px 10px;font-size:12px;font-weight:600;color:#2C3240;border-bottom:1px solid #E5E3DE">${o.name}</td><td style="padding:8px 10px;font-size:11px;color:#555;border-bottom:1px solid #E5E3DE">${o.businessName || '—'}</td><td style="padding:8px 10px;font-size:11px;color:#555;border-bottom:1px solid #E5E3DE;font-family:monospace">${o.phone || '—'}</td><td style="padding:8px 10px;font-size:11px;color:#888;border-bottom:1px solid #E5E3DE">${o.type || '—'}</td></tr>`).join('')}
</tbody>
</table>
<div style="font-size:9px;color:#888;margin-top:6px">Source: DOB permit applications — owner listed on filing. Cross-reference with ACRIS and DOF for verification.</div>
</div>` : ''}

<!-- TAX ABATEMENT & LIEN STATUS -->
<div style="background:#fff;border:2px solid ${d.hasTaxLien ? '#dc2626' : '#A89035'};border-radius:8px;padding:18px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:${d.hasTaxLien ? '#dc2626' : '#A89035'};font-weight:700;margin-bottom:12px">Tax Status - NYC DOF Abatement & Lien Search</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
<div style="background:#EDE9DF;border-radius:6px;padding:14px;text-align:center">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px">Co-op/Condo Abatement</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:18px;font-weight:700;color:${d.hasAbatement ? '#16a34a' : '#555'}">${d.hasAbatement ? 'Active / Indicated' : 'Not Indicated'}</div>
<div style="font-size:11px;color:#555;font-weight:600;margin-top:4px">${safe(d.abatementType)}</div>
${d.abatementAmount > 0 ? `<div style="font-size:11px;color:#16a34a;font-weight:600;margin-top:4px">$${d.abatementAmount.toLocaleString()} exempt assessed value</div>` : ''}
${d.abatementTaxYear ? `<div style="font-size:10px;color:#777;margin-top:4px">Tax year: ${safe(d.abatementTaxYear)}</div>` : ''}
</div>
<div style="background:${d.hasTaxLien ? 'rgba(220,38,38,0.08)' : '#EDE9DF'};border-radius:6px;padding:14px;text-align:center;${d.hasTaxLien ? 'border:1px solid rgba(220,38,38,0.3)' : ''}">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px">Tax Liens</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:18px;font-weight:700;color:${d.hasTaxLien ? '#dc2626' : '#16a34a'}">${d.hasTaxLien ? 'Lien-Sale Notices Found' : 'No Rows Found'}</div>
${d.hasTaxLien ? `<div style="font-size:11px;color:#dc2626;font-weight:600;margin-top:4px">${d.taxLienRecordCount || d.taxLienDetails.length} DOF notice row(s)</div>` : '<div style="font-size:11px;color:#16a34a;margin-top:4px">No DOF lien-sale rows returned for matched lot/address</div>'}
${d.taxLienMatchedLots.length ? `<div style="font-size:10px;color:#777;margin-top:4px">Matched lot(s): ${d.taxLienMatchedLots.map(l => safe(l)).join(', ')}</div>` : ''}
</div>
<div style="background:#EDE9DF;border-radius:6px;padding:14px;text-align:center">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px">DOF Property Record</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:18px;font-weight:700;color:#0B2E6F">${d.abatementMatchedLot ? `Lot ${safe(d.abatementMatchedLot)}` : safe(d.bbl || 'DOF record')}</div>
${d.dofTaxMarketValue ? `<div style="font-size:11px;color:#555;margin-top:4px">Market value: $${Math.round(d.dofTaxMarketValue).toLocaleString()}</div>` : ''}
${d.dofTaxAssessedValue ? `<div style="font-size:11px;color:#555;margin-top:2px">Assessed value: $${Math.round(d.dofTaxAssessedValue).toLocaleString()}</div>` : ''}
<div style="font-size:11px;color:#555;line-height:1.5;margin-top:6px"><a href="https://a836-pts-access.nyc.gov/care/search/commonsearch.aspx?mode=address" target="_blank" rel="noopener" style="color:#A89035;text-decoration:underline;font-weight:600">Open DOF Property Tax Search</a></div>
</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
<div style="background:#F8F6F0;border:1px solid #D5D0C6;border-radius:6px;padding:10px;font-size:10px;color:#555;line-height:1.5"><strong style="color:#0B2E6F">Abatement source check:</strong> ${safe(d.abatementSourceStatus || 'DOF exemptions endpoint searched; no row returned.')}</div>
<div style="background:#F8F6F0;border:1px solid #D5D0C6;border-radius:6px;padding:10px;font-size:10px;color:#555;line-height:1.5"><strong style="color:#0B2E6F">Lien source check:</strong> ${safe(d.taxLienSourceStatus || 'DOF tax lien endpoint searched; no row returned.')}</div>
</div>
${d.hasTaxLien ? `
<div style="background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.2);border-radius:6px;padding:12px;margin-bottom:10px">
<div style="font-size:11px;color:#991b1b;font-weight:600;margin-bottom:6px">Tax Lien Sale Notice Details</div>
${d.taxLienDetails.map(l => `<div style="font-size:11px;color:#555;padding:2px 0">- ${safe(l.cycle)}${l.date ? ' - ' + new Date(l.date).toLocaleDateString() : ''}${l.lot ? ' - lot ' + safe(l.lot) : ''}${l.waterDebtOnly ? ' (water debt only)' : ''}</div>`).join('')}
<div style="font-size:10px;color:#7f1d1d;margin-top:6px">Lien-sale notices require board-facing verification with NYC DOF before describing the item as an active payable lien.</div>
</div>` : ''}
<div style="font-size:9px;color:#888">Source: NYC Dept. of Finance - Property Exemptions (8y4t-faws), Tax Lien Sale (9rz4-mjek), and DOF property records. Camelot checks exact BBL first, then block/address for condo unit-lot records before release.</div>
</div>
<!-- LEGACY TAX CARD HIDDEN AFTER DOF UNIT-LOT FALLBACK UPDATE -->
<div style="display:none;background:#fff;border:2px solid ${d.hasTaxLien ? '#dc2626' : '#A89035'};border-radius:8px;padding:18px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:${d.hasTaxLien ? '#dc2626' : '#A89035'};font-weight:700;margin-bottom:12px">🏦 Tax Status — DOF Abatement & Lien Search</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
<div style="background:#EDE9DF;border-radius:6px;padding:14px;text-align:center">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px">Co-op/Condo Abatement</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:20px;font-weight:700;color:${d.hasAbatement ? '#16a34a' : '#888'}">${d.hasAbatement ? '✅ Active' : '—  None'}</div>
${d.abatementAmount > 0 ? `<div style="font-size:11px;color:#16a34a;font-weight:600;margin-top:4px">$\${d.abatementAmount.toLocaleString()} exempt</div>` : ''}
</div>
<div style="background:${d.hasTaxLien ? 'rgba(220,38,38,0.08)' : '#EDE9DF'};border-radius:6px;padding:14px;text-align:center;${d.hasTaxLien ? 'border:1px solid rgba(220,38,38,0.3)' : ''}">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px">Tax Liens</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:20px;font-weight:700;color:${d.hasTaxLien ? '#dc2626' : '#16a34a'}">${d.hasTaxLien ? '⚠️ LIEN' : '✅ Clear'}</div>
${d.hasTaxLien ? `<div style="font-size:11px;color:#dc2626;font-weight:600;margin-top:4px">${d.taxLienDetails.length} lien(s) on record</div>` : '<div style="font-size:11px;color:#16a34a;margin-top:4px">No liens found</div>'}
</div>
<div style="background:#EDE9DF;border-radius:6px;padding:14px;text-align:center">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px">DOF Search</div>
<div style="font-size:11px;color:#555;line-height:1.5;margin-top:6px"><a href="https://a836-pts-access.nyc.gov/care/search/commonsearch.aspx?mode=address" target="_blank" rel="noopener" style="color:#A89035;text-decoration:underline;font-weight:600">Open DOF Property Tax Search</a></div>
</div>
</div>
${d.hasTaxLien ? `
<div style="background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.2);border-radius:6px;padding:12px;margin-bottom:10px">
<div style="font-size:11px;color:#991b1b;font-weight:600;margin-bottom:6px">⚠️ Tax Lien Details</div>
${d.taxLienDetails.map(l => `<div style="font-size:11px;color:#555;padding:2px 0">• ${l.cycle}${l.date ? ' — ' + new Date(l.date).toLocaleDateString() : ''}${l.waterDebtOnly ? ' (water debt only)' : ''}</div>`).join('')}
</div>` : ''}
<div style="font-size:9px;color:#888">Source: NYC Dept. of Finance — Property Exemptions (8y4t-faws) and Tax Lien Sale (9rz4-mjek). Abatement data reflects most recent assessment year. Tax liens indicate properties included in NYC's annual tax lien sale process.</div>
</div>
</div>

<!-- PAGE 5C: CURRENT MANAGEMENT PERFORMANCE -->
<div class="section section-cream">
<div class="section-title">Current Management Performance</div>
<div class="section-sub">${d.managementCompany ? `Analysis of ${d.managementCompany}` : 'Building management assessment'} ${d.managementDuration ? `&mdash; Managing for ~${d.managementDuration}` : ''}</div>
${!/[A-F]/.test(d.managementGrade) ? `<div style="background:#fff;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:14px 18px;margin:12px 0 16px">
<p style="font-size:12px;color:#555;line-height:1.7"><strong style="color:#A89035">Public-record review pending:</strong> Camelot did not find enough violations, ECB, litigation, or permit data to score current management from public records alone. This does not mean the building is self-managed. For ${safe(d.buildingName)}, Camelot should verify the board, managing agent, live-in resident manager, porter, concierge, door coverage, and staff structure before releasing a final board-facing assessment.</p>
</div>` : ''}

<div style="display:flex;align-items:center;gap:24px;margin:20px 0">
<div style="width:100px;height:100px;border-radius:50%;background:${d.managementGrade === 'A' ? '#16a34a' : d.managementGrade === 'B' ? '#ca8a04' : d.managementGrade === 'C' ? '#ea580c' : '#dc2626'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
<span style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:48px;font-weight:700;color:#fff">${d.managementGrade}</span>
</div>
<div>
<div style="font-size:16px;font-weight:700;color:#2C3240;margin-bottom:4px">Overall Management Grade: ${d.managementGrade === '—' ? 'Pending Review' : d.managementGrade}</div>
<div style="font-size:12px;color:#555;line-height:1.6">${d.managementGrade === '—' ? 'Insufficient public data available to assign a management grade. A full assessment will be conducted upon engagement with the building.' : safe(managementRiskSummary)}</div>
</div>
</div>
${managementRiskFlags.length ? `<div style="background:#fff;border:1px solid #D5D0C6;border-left:4px solid #dc2626;border-radius:0 8px 8px 0;padding:12px 14px;margin:8px 0 16px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#991b1b;font-weight:700;margin-bottom:8px">Management Public-Record Risk</div>
<div style="display:flex;flex-wrap:wrap;gap:7px">${managementRiskChipHTML}</div>
</div>` : ''}

<div class="stats-row">
<div class="stat-box"><div class="val" style="color:${d.managementScorecard.violations >= 70 ? '#16a34a' : d.managementScorecard.violations >= 50 ? '#ca8a04' : '#dc2626'}">${/[A-F]/.test(d.managementGrade) ? d.managementScorecard.violations : 'Review'}</div><div class="lbl">Violations Score</div></div>
<div class="stat-box"><div class="val" style="color:${d.managementScorecard.compliance >= 70 ? '#16a34a' : d.managementScorecard.compliance >= 50 ? '#ca8a04' : '#dc2626'}">${/[A-F]/.test(d.managementGrade) ? d.managementScorecard.compliance : 'Review'}</div><div class="lbl">Compliance Score</div></div>
<div class="stat-box"><div class="val" style="color:${d.managementScorecard.financial >= 70 ? '#16a34a' : d.managementScorecard.financial >= 50 ? '#ca8a04' : '#dc2626'}">${/[A-F]/.test(d.managementGrade) ? d.managementScorecard.financial : 'Review'}</div><div class="lbl">Financial Score</div></div>
<div class="stat-box"><div class="val" style="color:${d.managementScorecard.overall >= 70 ? '#16a34a' : d.managementScorecard.overall >= 50 ? '#ca8a04' : '#dc2626'}">${/[A-F]/.test(d.managementGrade) ? d.managementScorecard.overall : 'Pending'}</div><div class="lbl">Overall Score</div></div>
</div>

<div style="margin-top:16px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600;margin-bottom:10px;padding-left:16px;border-left:4px solid #A89035">Key Findings</div>
<div style="display:flex;flex-wrap:wrap;gap:8px">
${d.violationsOpen > 0 ? `<span style="display:inline-block;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.25);color:#991b1b;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">⚠️ ${d.violationsOpen} Open HPD Violations</span>` : '<span style="display:inline-block;background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.25);color:#166534;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">✅ No Open HPD Violations</span>'}
${d.ecbPenaltyBalance > 0 ? `<span style="display:inline-block;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.25);color:#991b1b;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">💰 $${d.ecbPenaltyBalance.toLocaleString()} ECB Penalties Outstanding</span>` : '<span style="display:inline-block;background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.25);color:#166534;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">✅ No ECB Penalties</span>'}
${d.hasActiveLitigation ? '<span style="display:inline-block;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.25);color:#991b1b;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">⚖️ Active Litigation</span>' : '<span style="display:inline-block;background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.25);color:#166534;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">✅ No Active Litigation</span>'}
${d.hasRecentPermits ? '<span style="display:inline-block;background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.25);color:#166534;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">🔨 Recent DOB Permits Active</span>' : '<span style="display:inline-block;background:rgba(202,138,4,0.08);border:1px solid rgba(202,138,4,0.25);color:#854d0e;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">📋 No Recent Permits</span>'}
${d.dobViolationOpen > 0 ? `<span style="display:inline-block;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.25);color:#991b1b;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">⚠️ ${d.dobViolationOpen} DOB Open Violation Signal(s)</span>` : ''}
${d.ecbCount > 0 && d.ecbPenaltyBalance === 0 ? `<span style="display:inline-block;background:rgba(202,138,4,0.08);border:1px solid rgba(202,138,4,0.25);color:#854d0e;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">⚖️ ${d.ecbCount} ECB/OATH Record(s)</span>` : ''}
${d.hasTaxLien || d.taxLienRecordCount > 0 ? `<span style="display:inline-block;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.25);color:#991b1b;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">🏦 ${Math.max(d.taxLienRecordCount, 1)} DOF Tax Lien Notice Row(s)</span>` : ''}
${d.acrisLienClaimCount > 0 ? `<span style="display:inline-block;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.25);color:#991b1b;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">📄 ${d.acrisLienClaimCount} ACRIS Lien/Claim Document(s)</span>` : ''}
${d.facadeIssueCount > 0 ? `<span style="display:inline-block;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.25);color:#991b1b;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">🏗️ ${d.facadeIssueCount} FISP/Facade Issue Signal(s)</span>` : d.facadeFilingCount > 0 ? `<span style="display:inline-block;background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.25);color:#166534;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">🏗️ ${d.facadeFilingCount} FISP/Facade Filing(s) Loaded</span>` : ''}
${d.complianceReleaseStatus === 'blocked' ? '<span style="display:inline-block;background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.25);color:#991b1b;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">🚫 Compliance Coverage Blocked Release</span>' : d.complianceReleaseStatus === 'needs_review' ? '<span style="display:inline-block;background:rgba(202,138,4,0.08);border:1px solid rgba(202,138,4,0.25);color:#854d0e;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:500">🔎 Compliance Coverage Needs Review</span>' : ''}
</div>
</div>
</div>

<!-- PAGE 5D: MARKET CONTEXT & BENCHMARKS -->
${d.neighborhoodMarketData ? `
<div class="section section-white">
<div class="section-title">Market Context &amp; Benchmarks</div>
<div class="section-sub">${d.neighborhoodName ? d.neighborhoodName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Local Market'} &mdash; Q1 2026 Data</div>

<div style="margin-bottom:16px;border-left:4px solid #A89035;padding-left:12px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600">Sale Price Benchmarks</div>
</div>
<div class="stats-row">
<div class="stat-box"><div class="val gold">$${d.neighborhoodMarketData.condoPSF.toLocaleString()}</div><div class="lbl">Condo $/Sqft</div></div>
<div class="stat-box"><div class="val gold">$${d.neighborhoodMarketData.coopPSF.toLocaleString()}</div><div class="lbl">Co-op $/Sqft</div></div>
<div class="stat-box"><div class="val gold">$${d.neighborhoodMarketData.rentalPSFYr}</div><div class="lbl">Rental $/Sqft/Yr</div></div>
<div class="stat-box"><div class="val gold">${d.neighborhoodMarketData.daysOnMarket}</div><div class="lbl">Avg Days on Market</div></div>
</div>

<div style="margin:20px 0 16px;border-left:4px solid #A89035;padding-left:12px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600">Rental Market</div>
</div>
<div class="stats-row" style="grid-template-columns:1fr 1fr 1fr">
<div class="stat-box"><div class="val gold">$${d.neighborhoodMarketData.median1BR.toLocaleString()}</div><div class="lbl">Median 1BR Rent/Mo</div></div>
<div class="stat-box"><div class="val gold">$${d.neighborhoodMarketData.median2BR.toLocaleString()}</div><div class="lbl">Median 2BR Rent/Mo</div></div>
<div class="stat-box"><div class="val">${d.neighborhoodMarketData.opexRange}</div><div class="lbl">Operating Costs Range</div></div>
</div>

${d.buildingArea > 0 ? `
<div style="margin:20px 0 16px;border-left:4px solid #A89035;padding-left:12px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600">Your Building vs. Market</div>
</div>
<div class="info-grid">
<div><div class="label">Building GFA</div><div class="value">${d.buildingArea.toLocaleString()} sqft</div></div>
<div><div class="label">Est. Value (at neighborhood $/sqft)</div><div class="value" style="color:#A89035;font-weight:700">${fmtMoney(d.buildingArea * (d.propertyType.toLowerCase().includes('co-op') ? d.neighborhoodMarketData.coopPSF : d.neighborhoodMarketData.condoPSF))}</div></div>
<div><div class="label">Est. Annual Rental Potential</div><div class="value" style="color:#A89035;font-weight:700">${fmtMoney(d.buildingArea * d.neighborhoodMarketData.rentalPSFYr)}</div></div>
<div><div class="label">Est. Gross Yield</div><div class="value">${((d.neighborhoodMarketData.rentalPSFYr / (d.propertyType.toLowerCase().includes('co-op') ? d.neighborhoodMarketData.coopPSF : d.neighborhoodMarketData.condoPSF)) * 100).toFixed(1)}%</div></div>
</div>
` : ''}

<!-- Visual Charts — CSS Bar Charts -->
<div style="margin:20px 0 16px;border-left:4px solid #A89035;padding-left:12px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600">Price Comparison \u2014 $/Sqft by Type</div>
</div>
<div style="display:flex;gap:16px;align-items:flex-end;height:160px;margin-bottom:16px;padding:0 20px">
<div style="flex:1;text-align:center">
<div style="background:linear-gradient(to top,#A89035,#C4AA6E);height:${Math.round(d.neighborhoodMarketData.condoPSF / 25)}px;max-height:140px;border-radius:6px 6px 0 0;min-height:30px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px"><span style="color:#fff;font-size:10px;font-weight:700">$${d.neighborhoodMarketData.condoPSF}</span></div>
<div style="font-size:9px;color:#888;margin-top:4px">Condo $/SF</div>
</div>
<div style="flex:1;text-align:center">
<div style="background:linear-gradient(to top,#3A4B5B,#5A6B7B);height:${Math.round(d.neighborhoodMarketData.coopPSF / 25)}px;max-height:140px;border-radius:6px 6px 0 0;min-height:30px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px"><span style="color:#fff;font-size:10px;font-weight:700">$${d.neighborhoodMarketData.coopPSF}</span></div>
<div style="font-size:9px;color:#888;margin-top:4px">Co-op $/SF</div>
</div>
<div style="flex:1;text-align:center">
<div style="background:linear-gradient(to top,#16a34a,#4ade80);height:${Math.round(d.neighborhoodMarketData.rentalPSFYr * 2)}px;max-height:140px;border-radius:6px 6px 0 0;min-height:30px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px"><span style="color:#fff;font-size:10px;font-weight:700">$${d.neighborhoodMarketData.rentalPSFYr}/yr</span></div>
<div style="font-size:9px;color:#888;margin-top:4px">Rental $/SF/Yr</div>
</div>
<div style="flex:1;text-align:center">
<div style="background:linear-gradient(to top,#dc2626,#f87171);height:${Math.round(d.neighborhoodMarketData.daysOnMarket * 5)}px;max-height:140px;border-radius:6px 6px 0 0;min-height:30px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px"><span style="color:#fff;font-size:10px;font-weight:700">${d.neighborhoodMarketData.daysOnMarket}d</span></div>
<div style="font-size:9px;color:#888;margin-top:4px">Avg Days on Mkt</div>
</div>
</div>

<!-- Rental Chart -->
<div style="margin:20px 0 16px;border-left:4px solid #A89035;padding-left:12px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600">Median Rental Rates</div>
</div>
<div style="display:flex;gap:20px;margin-bottom:16px;padding:0 20px">
<div style="flex:1">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
<div style="font-size:11px;color:#888;width:30px">1BR</div>
<div style="flex:1;background:#E5E3DE;border-radius:4px;height:24px;position:relative">
<div style="background:linear-gradient(to right,#A89035,#C4AA6E);height:100%;border-radius:4px;width:${Math.min(100, Math.round(d.neighborhoodMarketData.median1BR / 60))}%"></div>
<span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:#2C3240">$${d.neighborhoodMarketData.median1BR.toLocaleString()}/mo</span>
</div>
</div>
<div style="display:flex;align-items:center;gap:8px">
<div style="font-size:11px;color:#888;width:30px">2BR</div>
<div style="flex:1;background:#E5E3DE;border-radius:4px;height:24px;position:relative">
<div style="background:linear-gradient(to right,#3A4B5B,#5A6B7B);height:100%;border-radius:4px;width:${Math.min(100, Math.round(d.neighborhoodMarketData.median2BR / 90))}%"></div>
<span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:#2C3240">$${d.neighborhoodMarketData.median2BR.toLocaleString()}/mo</span>
</div>
</div>
</div>
</div>

<!-- Neighborhood Scores Visual -->
<div style="margin:20px 0 16px;border-left:4px solid #A89035;padding-left:12px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600">Neighborhood Scores (1\u201310)</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;padding:0 20px">
${[
  { label: '\uD83D\uDCB0 Investment', score: d.neighborhoodMarketData.investScore },
  { label: '\uD83C\uDFE0 Livability', score: d.neighborhoodMarketData.liveScore },
  { label: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67 Family', score: d.neighborhoodMarketData.familyScore },
  { label: '\uD83D\uDCBC Work Access', score: d.neighborhoodMarketData.workScore },
].map(s => `
<div style="display:flex;align-items:center;gap:8px">
<div style="font-size:11px;color:#555;width:100px">${s.label}</div>
<div style="flex:1;background:#E5E3DE;border-radius:4px;height:20px;position:relative">
<div style="background:${s.score >= 8 ? '#16a34a' : s.score >= 6 ? '#A89035' : '#dc2626'};height:100%;border-radius:4px;width:${s.score * 10}%"></div>
<span style="position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:700;color:#2C3240">${s.score}</span>
</div>
</div>`).join('')}
</div>

<!-- Neighborhood Image — Google Maps area overview -->
<div style="border-radius:10px;overflow:hidden;border:1px solid #D5D0C6;height:200px;margin-bottom:12px">
<iframe src="https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_REPORT_KEY}&q=${encodedNeighborhoodContext}&zoom=14&maptype=roadmap" width="100%" height="200" style="border:0" allowfullscreen loading="lazy"></iframe>
</div>
<div style="text-align:center;font-size:9px;color:#999;margin-bottom:12px">${d.neighborhoodName ? d.neighborhoodName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Neighborhood'} \u2014 Area Overview</div>

<div style="background:#EDE9DF;border:1px solid #E5E3DE;border-radius:8px;padding:16px;margin-top:8px">
<p style="font-size:12px;color:#555;line-height:1.7"><strong style="color:#A89035">Source:</strong> Camelot Q1 2026 Market Report. Data from ACRIS closed sales, StreetEasy leased units, and RealtyMX RLS comparables (Q4 2025 \u2013 Q1 2026). Scores are Camelot composite assessments based on market data, public records, census metrics, school ratings, transit access, and crime statistics.</p>
</div>
</div>` : ''}

<!-- PAGE 6: LOCAL LAWS & REGULATORY EXPOSURE -->
<div class="section section-cream">
<div class="section-title">Local Law &amp; Regulatory Compliance</div>
<div class="section-sub">NYC local laws applicable to ${d.buildingName} based on building size, age, and type</div>
${renderSubjectPhotoStrip(d, { limit: 3, height: 82, caption: 'Visual property context paired with compliance and field review' })}

<table class="invest-table">
<thead><tr><th>Local Law</th><th>Requirement</th><th>Applicability to This Building</th><th>Status</th></tr></thead>
<tbody>
<tr><td style="font-weight:700">LL97 (Climate Mobilization)</td><td>Carbon emission caps for buildings &gt;25,000 SF. Penalties ~$268/ton excess CO\u2082.</td><td>${d.buildingArea > 25000 ? `<strong style="color:#dc2626">${d.buildingArea.toLocaleString()} SF \u2014 ABOVE threshold</strong>` : d.buildingArea > 0 ? `${d.buildingArea.toLocaleString()} SF \u2014 ${d.buildingArea > 25000 ? 'Above' : 'Below'} threshold` : 'Building area unknown'}</td><td style="color:${d.ll97 && d.ll97.period1Penalty > 0 ? '#dc2626' : '#16a34a'};font-weight:700">${d.ll97 ? (d.ll97.period1Penalty > 0 ? '\u26A0 Penalty Exposure' : '\u2714 Compliant') : 'Assessment needed'}</td></tr>
<tr><td style="font-weight:700">LL11/FISP (Facade Inspection)</td><td>Facade inspection every 5 years for buildings &gt;6 stories.</td><td>${d.stories > 6 ? `<strong style="color:#dc2626">${d.stories} stories \u2014 REQUIRED</strong>` : d.stories > 0 ? `${d.stories} stories \u2014 Not required` : 'Unknown'}</td><td style="font-weight:600">${d.stories > 6 ? 'Cycle 10 due' : 'N/A'}</td></tr>
<tr><td style="font-weight:700">LL152 (Gas Piping)</td><td>Periodic gas piping inspection for all buildings with gas service.</td><td>Required for buildings with gas piping</td><td style="font-weight:600">Verify compliance</td></tr>
<tr><td style="font-weight:700">LL84 (Benchmarking)</td><td>Annual energy benchmarking for buildings &gt;25,000 SF.</td><td>${d.buildingArea > 25000 ? '<strong style="color:#dc2626">Required</strong>' : 'Below threshold'}</td><td style="font-weight:600">${d.energyStarScore != null ? 'Filed \u2014 Score: ' + d.energyStarScore : 'Verify filing'}</td></tr>
<tr><td style="font-weight:700">LL87 (Energy Audit)</td><td>Energy audit + retro-commissioning every 10 years for buildings &gt;50,000 SF.</td><td>${d.buildingArea > 50000 ? '<strong style="color:#dc2626">Required</strong>' : 'Below threshold'}</td><td style="font-weight:600">Verify cycle</td></tr>
<tr><td style="font-weight:700">HPD Registration</td><td>Annual registration for all residential buildings with 3+ units.</td><td>${d.units >= 3 ? '<strong>Required</strong>' : 'Not required'}</td><td style="color:${d.registrationOwner ? '#16a34a' : '#dc2626'};font-weight:600">${d.registrationOwner ? '\u2714 Registered' : '\u26A0 Verify'}</td></tr>
<tr><td style="font-weight:700">LL18 (Elevator Inspection)</td><td>Annual elevator inspection for all buildings with elevators.</td><td>${d.stories > 5 ? 'Likely has elevator' : 'May be walk-up'}</td><td style="font-weight:600">Verify with DOB</td></tr>
${d.isRentStabilized ? '<tr><td style="font-weight:700">Rent Stabilization</td><td>DHCR registration, rent guidelines board increases, lease renewals</td><td><strong style="color:#A89035">Rent Stabilized Building</strong></td><td style="color:#A89035;font-weight:600">Active \u2014 DHCR Registered</td></tr>' : ''}
</tbody>
</table>

${complianceGutCheckTable}

<div style="background:#3A4B5B;border-radius:8px;padding:14px 18px;margin-top:14px;color:#fff;font-size:12px;line-height:1.7">
<strong style="color:#A89035">Camelot Compliance Discipline:</strong> We proactively track local law deadlines, filing requirements, and inspection cycles for every building we manage. Summary monitoring is part of the management cadence; filings, remediation, professional applications, and project work are separately scoped when action is required.
</div>
</div>

<!-- LL97 DETAIL -->
${ll97LikelyApplicable ? `
<div class="section section-white">
<div class="section-title">LL97 Carbon Cap \u2014 Detailed Analysis</div>
<div class="section-sub">Local Law 97 penalty exposure for ${d.buildingName}</div>
<div class="stats-row">
<div class="stat-box"><div class="val" style="color:${ll97Display.period1Penalty > 0 ? '#dc2626' : '#A89035'}">$${ll97Display.period1Penalty.toLocaleString()}</div><div class="lbl">Annual Penalty (2024-2029)</div></div>
<div class="stat-box"><div class="val" style="color:${ll97Display.period2Penalty > 0 ? '#dc2626' : '#A89035'}">$${ll97Display.period2Penalty.toLocaleString()}</div><div class="lbl">Annual Penalty (2030-2034)</div></div>
<div class="stat-box"><div class="val" style="color:${ll97Display.totalExposure11yr > 0 ? '#dc2626' : '#A89035'}">$${ll97Display.totalExposure11yr.toLocaleString()}</div><div class="lbl">11-Year Total Exposure</div></div>
<div class="stat-box"><div class="val" style="color:${/compliant/i.test(ll97Display.complianceStatus) && !/non/i.test(ll97Display.complianceStatus) ? '#16a34a' : '#dc2626'}">${safe(ll97Display.complianceStatus).toUpperCase()}</div><div class="lbl">Status</div></div>
</div>
<div class="info-grid">
<div><div class="label">Building Type (LL97)</div><div class="value">${safe(ll97Display.buildingType)}</div></div>
<div><div class="label">Emissions Limit</div><div class="value">${ll97Display.emissionsLimit.toFixed(2)} kgCO\u2082e/sqft</div></div>
<div><div class="label">Actual Emissions</div><div class="value">${ll97Display.actualEmissions != null ? `${ll97Display.actualEmissions.toFixed(2)} metric tons CO\u2082e` : 'Benchmarking data needed'}</div></div>
<div><div class="label">Building GFA</div><div class="value">${(d.buildingArea || ll97ModeledArea).toLocaleString()} sqft${!d.buildingArea && ll97ModeledArea ? ' est.' : ''}</div></div>
</div>
<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin-top:16px">
<p style="font-size:12px;color:#991b1b;font-weight:600">Camelot includes an initial LL97 summary and roadmap where applicable. Annual benchmarking, filings, remediation budgeting, capital upgrade planning, and rebate / incentive work are separately scoped when action is required.</p>
<p style="font-size:11px;color:#555;line-height:1.6;margin-top:8px">${safe(ll97Display.sourceNote)}</p>
<p style="font-size:11px;color:#555;line-height:1.6;margin-top:8px"><strong>Jackie release rule:</strong> if LL84/LL97 data is missing for a likely covered building, the report must flag the missing data and provide the compliance workplan rather than silently removing the LL97 page.</p>
</div>
${complianceGutCheckTable}
</div>` : ''}

<!-- PAGE 7: COMPETITOR ANALYSIS -->
<div class="section section-cream">
<div class="section-title">Competitive Position</div>
<div class="section-sub">${isSelfManaged ? 'Confirmed self-managed structure — professional transition opportunity' : `Current management structure: ${verifiedManagementLabel(d.managementCompany)}`}</div>
${isSelfManaged ? `
<div class="core-svc"><h4>Self-Managed \u2192 Professional Management</h4><p>Many of our most successful client relationships began with self-managed buildings. Our 90-day transition process is designed specifically to make this change seamless, with zero disruption to residents or building operations. You gain: weekly inspections, 24/7 emergency response, in-house CPA, compliance expertise, and technology that elevates every aspect of building life.</p></div>
` : `
<div class="core-svc"><h4>Why Boards Are Switching</h4>
<p>Mid-size and large condos, co-ops, and rental buildings are increasingly re-examining large-shop management models, especially when comparing firms such as Orsid/AKAM, FirstService Residential, Douglas Elliman Property Management, Maxwell-Kates, Associa, and other scaled platforms. The issue is not that every large company fails; it is that board expectations have changed. Boards now want senior attention, transparent accounting, rapid communication, stable property-manager coverage, direct control over vendors, and technology that actually improves day-to-day building life.</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
<div style="background:#fff;border:1px solid #D5D0C6;border-left:3px solid #A89035;padding:11px 12px">
<div style="font-size:11px;font-weight:800;color:#0D2E63;margin-bottom:4px">Scale Can Dilute Attention</div>
<div style="font-size:10px;color:#555;line-height:1.45">Large portfolios can leave boards feeling like one account among hundreds. Calls move through layers, decisions wait for regional approval, and senior leadership may appear only during renewals or escalations.</div>
</div>
<div style="background:#fff;border:1px solid #D5D0C6;border-left:3px solid #A89035;padding:11px 12px">
<div style="font-size:11px;font-weight:800;color:#0D2E63;margin-bottom:4px">Manager Turnover Hurts Memory</div>
<div style="font-size:10px;color:#555;line-height:1.45">When junior PMs rotate, the building has to keep re-teaching its history: board preferences, staff personalities, vendor issues, capital priorities, resident sensitivities, and unresolved promises.</div>
</div>
<div style="background:#fff;border:1px solid #D5D0C6;border-left:3px solid #A89035;padding:11px 12px">
<div style="font-size:11px;font-weight:800;color:#0D2E63;margin-bottom:4px">Outsourcing Reduces Control</div>
<div style="font-size:10px;color:#555;line-height:1.45">Boards become frustrated when accounting, payment processing, compliance tracking, call centers, and vendor administration are split across outside systems with unclear accountability.</div>
</div>
<div style="background:#fff;border:1px solid #D5D0C6;border-left:3px solid #A89035;padding:11px 12px">
<div style="font-size:11px;font-weight:800;color:#0D2E63;margin-bottom:4px">PE / Acquisition Pressure</div>
<div style="font-size:10px;color:#555;line-height:1.45">Industry consolidation can create fee pressure, bundled service relationships, contract rigidity, and a growth agenda that may not match a board's need for long-term, property-specific attention.</div>
</div>
</div>
<ul style="margin:12px 0 0 18px;color:#38557D;font-size:11px;line-height:1.6">
<li><strong>Communication:</strong> boards want one accountable senior contact, not ticket handoffs and weeks of follow-up.</li>
<li><strong>Financial clarity:</strong> in-house CPA review, clean payables, reserve visibility, arrears tracking, and board-ready variance reporting matter more than generic monthly packages.</li>
<li><strong>Vendor discipline:</strong> boards want open bidding and documented savings, not preferred-vendor dependency or unclear procurement incentives.</li>
<li><strong>Staff retention:</strong> stable on-site staff and stable property-manager coverage protect institutional knowledge and resident trust.</li>
<li><strong>Technology with judgment:</strong> portals and AI should make managers faster and more accountable; they should not replace human follow-through.</li>
</ul>
<p style="margin-top:10px">Boards that switch to Camelot consistently report better communication (73%), faster response times (48-hour guarantee vs. weeks), and average annual savings of $45,000 in the first 90 days.</p>
<div style="background:#F8F5EC;border:1px solid #D8C894;padding:9px 11px;margin-top:10px;font-size:9px;color:#666;line-height:1.45">
<strong style="color:#A89035">Source context:</strong> FirstService is publicly described as North America's largest manager of residential communities. AKAM announced in March 2026 that Audax Private Equity acquired AKAM and its subsidiaries, including Orsid, and described continued investment, acquisitions, and buy-and-build expansion. FirstService Residential's own board-facing article on private-equity acquisitions identifies common red flags including fee pressure, staff/communication disruption, reduced contract flexibility, vendor bundling, and service quality risk.
</div>
</div>
`}
</div>

<!-- PAGE 8: WHY CAMELOT -->
<div class="section section-white">
<div class="section-title">Why Camelot</div>
<div class="section-sub">The institutional power of a full-service firm. The accountability of a dedicated partner.</div>
${renderSubjectPhotoStrip(d, { limit: 3, height: 86, caption: 'Property and neighborhood visuals remain part of the board-facing story' })}
<table class="compare-table">
<thead><tr><th>Large Firms</th><th>CAMELOT</th><th>Solo Operators</th></tr></thead>
<tbody>
<tr><td>Your building is one of 500+</td><td><strong>Your building is a priority</strong></td><td>Limited staff, limited hours</td></tr>
<tr><td>Junior PM assigned to you</td><td><strong>Senior leadership on every call</strong></td><td>One person handles everything</td></tr>
<tr><td>Cookie-cutter processes</td><td><strong>Custom strategy for your asset</strong></td><td>Reactive, not proactive</td></tr>
<tr><td>Outsourced accounting</td><td><strong>In-house CPAs, full transparency</strong></td><td>Basic bookkeeping</td></tr>
<tr><td>Slow emergency response</td><td><strong>24/7 direct management line</strong></td><td>Unavailable nights &amp; weekends</td></tr>
<tr><td>No proprietary tech</td><td><strong>Merlin AI + ConciergePlus</strong></td><td>Paper-based systems</td></tr>
</tbody>
</table>
<div class="compare-tagline">Boutique scale. Institutional capability. Owner&rsquo;s mentality.</div>
</div>

<!-- PAGE 9: ABOUT CAMELOT -->
<div class="section section-cream">
<div class="section-title">About Camelot</div>
<div class="section-sub">Who we are and what drives us</div>
<div class="mission-stmt">&ldquo;To protect, enhance, and elevate the value of every property we manage through transparency, precision, and proactive hands-on care.&rdquo;</div>
<p style="font-size:12px;color:#555;line-height:1.7;margin-bottom:20px">Since 2006, Camelot Realty Group has built a reputation as one of New York\u2019s premier boutique property management firms \u2014 blending hands-on service, financial expertise, and innovative technology. We manage condominiums, cooperatives, multifamily rentals, and mixed-use properties across Manhattan, Brooklyn, Queens, Bronx, Westchester, NJ, CT, and Florida. We are independently owned and operated.</p>
<div class="about-stats">
<div class="about-stat"><div class="val">${CAMELOT_PROFILE.buildingsManaged}</div><div class="lbl">Buildings Managed</div></div>
<div class="about-stat"><div class="val">${CAMELOT_PROFILE.assetsUnderManagement}</div><div class="lbl">Assets Under Mgmt*</div></div>
<div class="about-stat"><div class="val">Since ${CAMELOT_PROFILE.foundedYear}</div><div class="lbl">Founded</div></div>
<div class="about-stat"><div class="val">${CAMELOT_PROFILE.unitsTracked}</div><div class="lbl">Units Tracked</div></div>
</div>
<div style="font-size:9px;color:#888;text-align:center;margin-top:8px">*${CAMELOT_PROFILE.assetsUnderManagementNote}. Units tracked reflect ${CAMELOT_PROFILE.unitsTrackedNote}.</div>
<div style="font-size:11px;color:#A89035;text-align:center;margin-top:16px;font-weight:500">\u2B50 RED Awards 2025: Property Management Company of the Year</div>
${camelotAssociationLogoGrid()}
<div style="font-size:10px;color:#777;text-align:center;margin-top:10px;line-height:1.55">Associated with: ${camelotAssociationTextLine()}</div>
</div>

<!-- PAGE 9B: COMMUNITY & INDUSTRY PARTNERSHIPS -->
<div class="section section-white">
<div class="section-title">Community &amp; Industry Partnerships</div>
<div class="section-sub">Local relationships, trusted professionals, and coordinated service for ${d.buildingName}</div>
<p style="font-size:13px;color:#3A4B5B;line-height:1.7;margin:0 0 18px 0;max-width:860px">Camelot works inside the full ecosystem around each property: boards, residents, building staff, local vendors, neighborhood service providers, civic contacts, banks, attorneys, engineers, insurance brokers, technology partners, contractors, and other management or service companies when coordination benefits the building. The goal is simple: protect the property, respect the community, and bring the right people to the table before small issues become expensive problems.</p>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px">
<div class="va-card">
<h5>Community Presence</h5>
<p>We build relationships with residents, neighboring properties, local vendors, community stakeholders, and city-facing contacts so issues are handled with context, speed, and respect.</p>
</div>
<div class="va-card">
<h5>Professional Network</h5>
<p>We coordinate with attorneys, engineers, accountants, insurance teams, banks, expediters, compliance consultants, and qualified contractors to solve building problems cleanly.</p>
</div>
<div class="va-card">
<h5>Industry Collaboration</h5>
<p>When a building benefits, Camelot works constructively with other management companies, brokers, technology partners, and service providers while protecting client confidentiality.</p>
</div>
</div>
<div style="background:#EDE9DF;border-left:4px solid #A89035;padding:16px 18px;margin-top:18px;color:#3A4B5B;font-size:12px;line-height:1.7">This local partnership model helps boards access better vendor response, stronger market intelligence, smoother resident communication, and more practical solutions than a management company can deliver in isolation.</div>
</div>

<!-- PAGE 9C: CREATIVE STAFFING & OPERATING MODEL -->
<div class="section section-cream">
<div class="section-title">Creative Staffing &amp; Operating Model</div>
<div class="section-sub">A smarter way to turn one management budget into a deeper support bench</div>
<p style="font-size:13px;color:#3A4B5B;line-height:1.7;margin:0 0 18px 0;max-width:880px">Many buildings ask one property manager, general manager, or account lead to carry resident expectations, board demands, staff supervision, vendor follow-up, compliance pressure, and after-hours emergencies. That model can burn people out, create turnover, and leave boards paying for a title instead of a durable operating system. Camelot takes a more creative approach: we help boards decide where a full-time role is needed, where fractional senior leadership makes sense, and where technology and assistant-level support can stretch the same budget further.</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
<div style="background:#fff;border:1px solid #D5D0C6;border-top:4px solid #A89035;padding:18px">
<h4 style="font-size:17px;color:#0D2E63;margin-bottom:10px">Fractional Senior Leadership</h4>
<p style="font-size:12px;color:#555;line-height:1.7">For the right building and territory, Camelot can deploy a floating general manager or senior service manager across a small cluster of nearby properties. Instead of carrying the full cost of one senior salary, the building may fund a share of that expertise while preserving senior-level site visits, staff coaching, vendor escalation, and resident-facing leadership.</p>
</div>
<div style="background:#fff;border:1px solid #D5D0C6;border-top:4px solid #3A4B5B;padding:18px">
<h4 style="font-size:17px;color:#0D2E63;margin-bottom:10px">More Coverage From the Same Dollar</h4>
<p style="font-size:12px;color:#555;line-height:1.7">When the senior role is structured fractionally, budget can be redirected toward an assistant manager, assistant general manager, property administrator, or account support person. The board gets day-to-day coverage plus access to a senior bench, rather than relying on one overloaded person to handle every issue alone.</p>
</div>
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px">
<div class="va-card"><h5>On-Site + Floating Support</h5><p>Boards can combine on-site management office coverage with Camelot's floating senior team for resident communication, staff supervision, inspections, and urgent escalations.</p></div>
<div class="va-card"><h5>AI &amp; Virtual Assistance</h5><p>Camelot's AI assistants support residents, boards, vendors, resident managers, and staff with faster triage, reminders, meeting minutes, work-order routing, and document retrieval.</p></div>
<div class="va-card"><h5>Deeper Bench, Lower Burnout</h5><p>The goal is continuity: fewer single points of failure, better manager retention, clearer accountability, and more practical support for union and non-union building teams.</p></div>
</div>
<div style="display:grid;grid-template-columns:0.9fr 1.1fr;gap:18px;align-items:center;background:#fff;border:1px solid #D5D0C6;margin-top:18px;padding:14px">
<div style="height:170px;overflow:hidden;background:#EDE9DF"><img src="./images/services/front-desk-concierge.jpg" alt="Camelot front desk concierge staffing support" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"></div>
<div>
<h4 style="font-size:17px;color:#0D2E63;margin-bottom:8px">Front Desk &amp; Concierge Staffing</h4>
<p style="font-size:12px;color:#555;line-height:1.7">When a board wants a higher-touch resident experience, Camelot can help structure front desk, concierge, access-control, and hospitality staffing on behalf of the client. We review coverage hours, service standards, supervision, resident communication, and budget impact so the building gets a professional welcome without overloading the property manager or resident manager.</p>
</div>
</div>
<div style="background:#3A4B5B;color:#fff;padding:18px 22px;margin-top:18px;font-size:13px;line-height:1.7"><strong style="color:#D4AF37">Camelot's position:</strong> you can often get more from the same management budget, but only if the operating model is designed around the building's real workload. We want to be part of your team, not just another vendor on the expense sheet.</div>
</div>

<div class="deck-slide">
<div class="brand-logo"><img src="./images/camelot-logo.png" alt="Camelot Realty Group" onerror="this.style.display='none'"></div>
<h2 class="deck-title" style="color:#0D2E63">Experience Meets Innovation</h2>
<p style="font-size:16px;color:#777;margin:-18px 0 48px 25px">Decades of hands-on management knowledge, powered by modern technology</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:30px">
<div class="deck-card" style="border-top:0;min-height:300px"><h4>The Grey Hair</h4><p>Since 2006, Camelot has built a 42-building management platform across New York and nearby markets. Our seasoned property managers, accounting team, and executive leadership bring real-world knowledge: board politics, insurance claims, vendor negotiations, compliance pressure, and building emergencies. We are independently owned, and David Goldoff personally oversees the direction of the portfolio. When you call, you get a decision-maker, not a call center.</p></div>
<div class="deck-card" style="border-top:0;min-height:300px"><h4>The Technology</h4><p>We harness AI, automation, and data to deliver faster, smarter service. Merlin AI handles meeting minutes, maintenance triage, and compliance alerts. ConciergePlus gives residents a white-labeled portal and mobile app for payments, work orders, amenity bookings, and support. Camelot Central gives boards real-time dashboards, utility tracking, compliance status, and financial transparency.</p></div>
</div>
</div>

<!-- PAGE 10: CORE SERVICES (with icons + rich styling) -->
<div class="section section-white">
<div class="section-title">Core Services</div>
<div class="section-sub">Comprehensive management tailored to ${d.buildingName}</div>

<div style="display:grid;grid-template-columns:1.6fr 0.8fr;gap:28px;align-items:center">
<div>
${[
  { icon: '\uD83C\uDFE2', title: 'Property & Asset Management', desc: 'Weekly site visits by senior management. Vendor coordination, proactive inspections, and cost reduction. 24/7 emergency response with direct access to decision-makers. Buildings treated like owner-managed assets.', color: '#3A4B5B' },
  { icon: '\uD83D\uDCB0', title: 'In-House CPA & Financials', desc: 'Dedicated accounting oversight \u2014 never outsourced. Monthly board-ready financial reports, 5-year capital planning, real-time arrears tracking, vendor benchmarking, and advisory support; tax returns and deeper CPA engagements are separately scoped.', color: '#A89035' },
  { icon: '\uD83D\uDEE1\uFE0F', title: 'Compliance & Risk Management', desc: 'LL11/97, FISP Cycle 10, LL152, HPD, RPIE, boiler and elevator compliance. Zero-penalty track record.' + (d.violationsOpen > 0 ? ' We\u2019ve identified <strong>' + d.violationsOpen + ' compliance items</strong> that our team can address.' : ''), color: '#16a34a' },
].map(s => `<div style="display:flex;gap:16px;align-items:flex-start;background:#FDFAF3;border:1px solid #D5D0C6;border-left:4px solid ${s.color};border-radius:0 10px 10px 0;padding:20px;margin-bottom:14px">
<div style="font-size:32px;flex-shrink:0;width:48px;height:48px;background:${s.color}10;border-radius:10px;display:flex;align-items:center;justify-content:center">${s.icon}</div>
<div><h4 style="font-size:15px;font-weight:700;color:#2C3240;margin-bottom:6px">${s.title}</h4><p style="font-size:12px;color:#555;line-height:1.7">${s.desc}</p></div>
</div>`).join('\n')}
</div>
${renderSubjectImage(d, { height: 360, alt: `${d.buildingName} building image` })}
</div>
</div>

<!-- PAGE 11: VALUE-ADDED (with icons) -->
<div class="section section-cream">
<div class="section-title">Value-Added Services</div>
<div class="section-sub">Specialized capabilities included with your management engagement</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
${[
  { icon: '\uD83D\uDD11', title: 'Brokerage & Sublet Processing', desc: 'Licensed brokers, background checks, flip tax, subletting compliance' },
  { icon: '\uD83C\uDFD7\uFE0F', title: 'Project Management', desc: 'Full construction oversight, contractor coordination, capital projects' },
  { icon: '\uD83D\uDCDC', title: 'Offering Plans & House Rules', desc: 'Drafted, modified, and updated in-house by our legal team' },
  { icon: '\u2696\uFE0F', title: 'In-House Attorney Advisory', desc: 'Advisory guidance and issue-spotting; legal engagement, lease review, disputes, and formal opinions are separately scoped' },
  { icon: '\uD83D\uDC64', title: 'Fractional Senior PM / GM', desc: 'Senior-level leadership at a fraction of full-time cost' },
  { icon: '\uD83C\uDFE6', title: 'Licensed Mortgage Broker', desc: 'Shareholder refinancing, board financing, rate analysis' },
  { icon: '\uD83D\uDCCA', title: 'Audits, Analytics & Reports', desc: 'Vendor analysis, market reports, AI-powered meeting minutes' },
  { icon: '\uD83D\uDC77', title: 'Staff Training & Supervision', desc: 'Written SOPs, performance reviews, 24/7 staff support line' },
].map(s => `<div style="background:#fff;border:1px solid #D5D0C6;border-radius:10px;padding:16px;display:flex;gap:12px;align-items:flex-start">
<div style="font-size:24px;flex-shrink:0">${s.icon}</div>
<div><h5 style="font-size:13px;font-weight:700;color:#2C3240;margin-bottom:4px">${s.title}</h5><p style="font-size:11px;color:#888;line-height:1.5">${s.desc}</p></div>
</div>`).join('\n')}
</div>
<div class="deck-note" style="text-align:center;margin-top:18px">Everything a luxury condominium board needs: under one roof, with in-house licensed professionals.</div>
</div>

<!-- PAGE 12: COMPLIANCE CALENDAR -->
<div class="section section-white">
<div class="section-title">Compliance &amp; Local Law 97</div>
<div class="section-sub">Proactive compliance calendar for ${d.buildingName} \u2014 Camelot checks the property profile before release</div>
<div class="compliance-row">
${complianceDates.map(c => `<div class="compliance-card"><div class="month">${c.month}</div><h5>${c.title}</h5><p>${safe(c.desc)}</p></div>`).join('\n')}
</div>
<h3 style="font-family:'Cardo',Georgia,serif;font-size:22px;color:#0D2E63;margin:30px 0 16px">LOCAL LAW 97 &mdash; Critical for ${safe(ll97Context)}</h3>
<div class="compliance-row">
<div class="compliance-card"><h5>Annual Benchmarking</h5><p>Energy filings required. Zero fines, zero penalties.</p></div>
<div class="compliance-card"><h5>Penalty Modeling</h5><p>${d.ll97 ? `${fmtMoney(d.ll97.period1Penalty)} current-period annual exposure modeled.` : 'Model liability before it becomes a fine.'}</p></div>
<div class="compliance-card"><h5>Capital Upgrade Path</h5><p>HVAC, boiler, insulation, and controls that reduce emissions and cost.</p></div>
<div class="compliance-card"><h5>Cost Recovery Plan</h5><p>Rebates, incentives, tax credits, and financing options for upgrades.</p></div>
</div>
</div>

<!-- PAGE 13: TECHNOLOGY -->
<div class="section section-cream">
<div class="section-title">Technology Platform</div>
<div class="section-sub">Proprietary tools connecting data, intelligence, and operations</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:14px;color:#A89035;text-align:center;margin-bottom:20px;font-weight:600">Merlin AI &nbsp;+&nbsp; Camelot Central &nbsp;+&nbsp; ConciergePlus</div>
<div class="tech-cols">
<div class="tech-col"><h4>For Board &amp; Management</h4><ul><li>Group and individual messaging</li><li>Utility usage tracking</li><li>Building files &amp; documents</li><li>Compliance status updates</li><li>AI-powered meeting minutes</li><li>Real-time financial dashboards</li></ul></div>
<div class="tech-col"><h4>For Residents</h4><ul><li>ConciergePlus portal + mobile app</li><li>BankUnited online banking services with zero bank fees</li><li>AI chatbot support 24/7</li><li>Book amenities &amp; download docs</li><li>Direct staff contact</li><li>Work order tracking &amp; updates</li></ul></div>
</div>
</div>

<!-- PAGE 14: 90-DAY TRANSITION -->
<div class="section section-white">
<div class="section-title">The 90-Day Transition</div>
<div class="section-sub">A proven onboarding process that minimizes disruption</div>
<div class="transition-grid">
<div class="trans-card"><h4>Month 1: Assessment</h4><div class="sub">Full audit, $500 introductory inspection, staff review</div><ul><li>Full file &amp; data transfer</li><li>$500 introductory building inspection ($2,500 value)</li><li>Staff audit &amp; performance review</li><li>Vendor contract analysis &amp; re-bidding</li><li>Compliance summary review (LL11, LL97, HPD, FISP where applicable)</li></ul></div>
<div class="trans-card"><h4>Month 2: Stabilization</h4><div class="sub">SOPs, vendor re-bid, portal launch</div><ul><li>Written SOPs for all positions</li><li>Work order system configured</li><li>Vendor re-bidding &amp; optimization</li><li>Board portal setup &amp; training</li><li>Financial system migration</li></ul></div>
<div class="trans-card"><h4>Month 3: Optimization</h4><div class="sub">Tech live, reporting, capital roadmap</div><ul><li>Full technology stack operational</li><li>Resident portal &amp; mobile app</li><li>Monthly reporting cadence</li><li>5-Year capital roadmap delivered</li><li>Merlin AI fully operational</li></ul></div>
</div>
</div>

<div class="deck-slide">
<div class="brand-logo"><img src="./images/camelot-logo.png" alt="Camelot Realty Group" onerror="this.style.display='none'"></div>
<h2 class="deck-title" style="color:#0D2E63">Your Investment</h2>
<p style="font-size:15px;color:#777;margin:-20px 0 28px 24px">Tailored to ${safe(d.buildingName)} after a comprehensive scope and budget review</p>
<p style="font-size:14px;color:#0F1E33;line-height:1.55;max-width:760px;margin-bottom:24px">Every building is different. Before we discuss pricing, we take the time to understand ${safe(d.buildingName)}'s unique needs: operations, financials, staffing, vendors, compliance profile, and board goals. Our fee is shaped by that conversation, not a one-size-fits-all formula.</p>
<div style="display:grid;grid-template-columns:0.8fr 1.2fr;gap:26px">
<div>
<div style="width:70px;height:4px;background:#B8973A;margin-bottom:8px"></div>
<h3 style="font-family:'Cardo',Georgia,serif;font-size:24px;color:#0D2E63;margin-bottom:12px">Our Approach</h3>
${[
  ['Scope Review First', "We assess operations, staff, vendors, and compliance before proposing any fee structure."],
  ['Flexible Frameworks', "Per-unit, flat-fee, and hybrid structures can align with the board's priorities."],
  ['No Hidden Costs', 'What we quote is what you pay: no percentage markups on vendors, no surprise surcharges.'],
  ['Long-Term Value', 'Technology, compliance tools, and vendor relationships create savings that offset the fee over time.'],
].map(r => `<div style="display:flex;gap:10px;margin-bottom:12px"><span style="color:#B8973A;font-size:18px">●</span><div><strong style="color:#0D2E63">${r[0]}</strong><p style="font-size:11px;color:#38557D;line-height:1.4">${r[1]}</p></div></div>`).join('')}
</div>
<div>
<h3 style="font-family:'Cardo',Georgia,serif;font-size:24px;color:#0D2E63;margin-bottom:8px">What's Always Included</h3>
<table class="deck-table" style="font-size:11px"><thead><tr><th>Included Service</th><th>What You Get</th></tr></thead><tbody>
${proposedRows.slice(1).map(r => `<tr><td><strong>${r[0]}</strong></td><td>${safe(r[1])}</td></tr>`).join('\n')}
</tbody></table>
</div>
</div>
<div class="deck-note" style="text-align:center">We'd like to learn about your building's needs first: then we'll propose a fee that makes sense for both of us.</div>
</div>

<div class="deck-slide">
<div class="brand-logo"><img src="./images/camelot-logo.png" alt="Camelot Realty Group" onerror="this.style.display='none'"></div>
<h2 class="deck-title">The Proposed Investment</h2>
<p class="deck-kicker" style="margin:0 0 28px 32px">Recommended starting point: <strong>Camelot Intelligence</strong>. Classic and Premier remain available if the board wants a leaner, expanded, or hybrid scope.</p>
<table class="deck-table">
<thead><tr><th>Management Service Component</th><th>Camelot Inclusion</th></tr></thead>
<tbody>
${proposedRows.map(r => `<tr><td><strong>${r[0]}</strong></td><td>${safe(r[1])}</td></tr>`).join('\n')}
</tbody>
</table>
<div class="deck-note">Our efficiencies effectively pay for our management through long-term savings on vendors, compliance, and capital.</div>
</div>

<!-- PAGE 15: THREE-TIER PRICING -->
<div class="section section-cream">
<div class="section-title">Service Packages — ${d.buildingName}</div>
<div class="section-sub">Camelot recommends Intelligence first; Classic and Premier remain available if the board wants a leaner or expanded scope</div>

<!-- Three Tier Cards -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:20px">

<!-- CLASSIC -->
<div style="background:#fff;border:2px solid #D5D0C6;border-radius:10px;padding:20px;text-align:center">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:8px">Classic</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:28px;font-weight:800;color:#3A4B5B">$${d.tieredPricing.classic.perUnit}</div>
<div style="font-size:11px;color:#888;margin-bottom:14px">per unit / month</div>
<div style="font-size:10px;color:#555;text-align:left;line-height:1.8">
\u2714 Weekly inspections<br>
\u2714 24/7 emergency line<br>
\u2714 In-house CPA<br>
\u2714 Monthly financials<br>
\u2714 Compliance tracking<br>
\u2714 Vendor coordination<br>
\u2714 Board meetings<br>
<span style="color:#ccc">\u2716 ConciergePlus Portal</span><br>
<span style="color:#ccc">\u2716 Merlin AI</span><br>
<span style="color:#ccc">\u2716 BankUnited zero-fee banking workflow</span><br>
<span style="color:#ccc">\u2716 Market reports</span><br>
<span style="color:#ccc">\u2716 $500 introductory inspection</span>
</div>
<div style="margin-top:14px;padding-top:12px;border-top:1px solid #E5E3DE">
<div style="font-size:11px;color:#888">$${d.tieredPricing.classic.monthly.toLocaleString()}/mo \u00B7 $${d.tieredPricing.classic.annual.toLocaleString()}/yr</div>
</div>
</div>

<!-- INTELLIGENCE (RECOMMENDED) -->
<div style="background:#3A4B5B;border:3px solid #A89035;border-radius:10px;padding:20px;text-align:center;color:#fff;position:relative">
<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#A89035;color:#fff;padding:4px 16px;border-radius:20px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px">\u2B50 Recommended</div>
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;margin-bottom:8px;margin-top:4px">Intelligence</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:28px;font-weight:800;color:#A89035">$${d.tieredPricing.intelligence.perUnit}</div>
<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:14px">per unit / month</div>
<div style="font-size:10px;color:rgba(255,255,255,0.85);text-align:left;line-height:1.8">
\u2714 Everything in Classic<br>
\u2714 <strong style="color:#A89035">ConciergePlus Portal (26 modules)</strong><br>
\u2714 <strong style="color:#A89035">Merlin AI \u2014 24/7 support</strong><br>
\u2714 <strong style="color:#A89035">BankUnited zero-fee banking workflow</strong><br>
\u2714 <strong style="color:#A89035">Quarterly SCOUT reports</strong><br>
\u2714 <strong style="color:#A89035">LL97 / local-law summary modeling</strong><br>
\u2714 <strong style="color:#A89035">AI board minutes</strong><br>
\u2714 <strong style="color:#A89035">$500 introductory inspection ($2,500 value)</strong><br>
<span style="color:rgba(255,255,255,0.3)">\u2716 Dedicated senior PM</span><br>
<span style="color:rgba(255,255,255,0.3)">\u2716 Insurance rebid</span><br>
<span style="color:rgba(255,255,255,0.3)">\u2716 Session w/ David</span>
</div>
<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(168,144,53,0.3)">
<div style="font-size:11px;color:rgba(255,255,255,0.6)">$${d.tieredPricing.intelligence.monthly.toLocaleString()}/mo \u00B7 $${d.tieredPricing.intelligence.annual.toLocaleString()}/yr</div>
</div>
</div>

<!-- PREMIER -->
<div style="background:#fff;border:2px solid #A89035;border-radius:10px;padding:20px;text-align:center">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;margin-bottom:8px">Premier</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:28px;font-weight:800;color:#A89035">$${d.tieredPricing.premier.perUnit}</div>
<div style="font-size:11px;color:#888;margin-bottom:14px">per unit / month</div>
<div style="font-size:10px;color:#555;text-align:left;line-height:1.8">
\u2714 Everything in Intelligence<br>
\u2714 <strong>Dedicated Senior PM</strong><br>
\u2714 <strong>Monthly market reports</strong><br>
\u2714 <strong>Capital project coordination allowance</strong> (up to $50K, final scope approved)<br>
\u2714 <strong>Annual insurance rebid</strong><br>
\u2714 <strong>Vendor rebid guarantee</strong><br>
\u2714 <strong>30-min emergency guarantee</strong><br>
\u2714 <strong>Annual session w/ David Goldoff</strong><br>
\u2714 <strong>Reduced Schedule A fees</strong>
</div>
<div style="margin-top:14px;padding-top:12px;border-top:1px solid #E5E3DE">
<div style="font-size:11px;color:#888">$${d.tieredPricing.premier.monthly.toLocaleString()}/mo \u00B7 $${d.tieredPricing.premier.annual.toLocaleString()}/yr</div>
</div>
</div>

</div>

<!-- Comparison vs Competitors -->
<div style="background:#EDE9DF;border-radius:8px;padding:14px 18px;margin-bottom:16px">
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center">
<div><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px">vs. FirstService</div><div style="font-size:13px;font-weight:700;color:#16a34a">30\u201345% less</div></div>
<div><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px">vs. AKAM</div><div style="font-size:13px;font-weight:700;color:#16a34a">25\u201340% less</div></div>
<div><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px">vs. Orsid</div><div style="font-size:13px;font-weight:700;color:#16a34a">15\u201330% less</div></div>
</div>
<div style="font-size:10px;color:#555;text-align:center;margin-top:8px">With deeper advisory, reporting, and technology value. Schedule A items are disclosed by property type before signing.</div>
</div>

<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-style:italic;color:#A89035;font-size:13px;text-align:center">Camelot recommends Intelligence as the starting point because automation, reporting, and banking visibility are now central to responsible building management.</div>
</div>

<!-- PAGE 15B: FEE COMPARISON — MARKET RATE ANALYSIS -->
${d.feeComparison ? `
<div class="section section-white">
<div class="section-title">Fee Comparison — Market Rate Analysis</div>
<div class="section-sub">${d.feeComparison.tierLabel} — How Camelot compares to industry standard pricing</div>
<div style="background:#EDE9DF;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:16px">
<p style="font-size:11px;color:#3A4B5B;line-height:1.6"><strong style="color:#A89035">Pricing formula:</strong> Camelot's recommended fee is modeled from the <strong>Intelligence package</strong> for this building class and location, with technology, reporting automation, BankUnited online banking services, and advisory summaries priced into the package value. Formal legal, engineering, tax-return, brokerage, mortgage-brokerage, compliance remediation, and project-management engagements are separately scoped through Schedule A. <strong>Camelot minimum:</strong> ${d.feeComparison.minimumFeeLabel}${d.feeComparison.floorApplied ? ' (minimum floor applied to this preliminary quote).' : '.'}</p>
</div>

<!-- Market vs Camelot Visual -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px">
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-radius:8px;padding:18px;text-align:center">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:6px">Market Range</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:24px;font-weight:700;color:#dc2626">$${d.feeComparison.marketRangeLow}–$${d.feeComparison.marketRangeHigh}</div>
<div style="font-size:10px;color:#888">per unit / year</div>
</div>
<div style="background:#3A4B5B;border-radius:8px;padding:18px;text-align:center">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#A89035;margin-bottom:6px">Camelot Rate</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:24px;font-weight:700;color:#A89035">$${d.feeComparison.camelotAnnualPerUnit}</div>
<div style="font-size:10px;color:rgba(255,255,255,0.6)">per unit / year</div>
</div>
<div style="background:#16a34a;border-radius:8px;padding:18px;text-align:center;color:#fff">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Your Savings</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:20px;font-weight:700">${d.feeComparison.savings}</div>
<div style="font-size:10px;opacity:0.8">with MORE services included</div>
</div>
</div>

<!-- Bar Chart: Annual Cost Comparison -->
<div style="margin-bottom:24px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600;margin-bottom:12px;padding-left:16px;border-left:4px solid #A89035">Annual Management Cost (${d.units} units)</div>
<div style="display:flex;flex-direction:column;gap:8px;padding:0 20px">
<div style="display:flex;align-items:center;gap:8px">
<div style="font-size:11px;color:#888;width:110px;text-align:right">Market Low</div>
<div style="flex:1;background:#E5E3DE;border-radius:4px;height:28px;position:relative">
<div style="background:linear-gradient(to right,#dc2626,#f87171);height:100%;border-radius:4px;width:${Math.min(100, Math.round((d.feeComparison.marketRangeLow * modelUnits) / Math.max(d.feeComparison.marketRangeHigh * modelUnits, 1) * 100))}%"></div>
<span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:#2C3240">$${(d.feeComparison.marketRangeLow * modelUnits).toLocaleString()}/yr</span>
</div>
</div>
<div style="display:flex;align-items:center;gap:8px">
<div style="font-size:11px;color:#888;width:110px;text-align:right">Market High</div>
<div style="flex:1;background:#E5E3DE;border-radius:4px;height:28px;position:relative">
<div style="background:linear-gradient(to right,#dc2626,#f87171);height:100%;border-radius:4px;width:100%"></div>
<span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:#fff">$${(d.feeComparison.marketRangeHigh * modelUnits).toLocaleString()}/yr</span>
</div>
</div>
<div style="display:flex;align-items:center;gap:8px">
<div style="font-size:11px;color:#A89035;width:110px;text-align:right;font-weight:700">★ Camelot</div>
<div style="flex:1;background:#E5E3DE;border-radius:4px;height:28px;position:relative">
<div style="background:linear-gradient(to right,#A89035,#C4AA6E);height:100%;border-radius:4px;width:${Math.min(100, Math.round((d.feeComparison.camelotAnnualPerUnit * modelUnits) / Math.max(d.feeComparison.marketRangeHigh * modelUnits, 1) * 100))}%"></div>
<span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:#2C3240">$${(d.feeComparison.camelotAnnualPerUnit * modelUnits).toLocaleString()}/yr</span>
</div>
</div>
</div>
</div>

<!-- Ancillary Fees Comparison Table -->
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600;margin-bottom:12px;padding-left:16px;border-left:4px solid #A89035">What's Included — Camelot vs. Industry Standard</div>
<table class="invest-table" style="font-size:11px">
<thead><tr><th>Service</th><th>Industry Standard Rate</th><th>Camelot Rate</th></tr></thead>
<tbody>
${d.feeComparison.ancillaryComparison.map((row, i) => `<tr${i % 2 === 0 ? '' : ' style="background:#EDE9DF"'}><td>${row.service}</td><td style="color:#dc2626">${row.marketRate}</td><td style="color:#16a34a;font-weight:600">${row.camelotRate}</td></tr>`).join('\n')}
</tbody>
</table>

<!-- Services included callout -->
<div style="background:#3A4B5B;border-radius:8px;padding:16px 20px;margin-top:16px;color:#fff">
<div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#A89035;font-weight:700;margin-bottom:10px">✅ Intelligence Package Value and Advisory Scope</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
${d.feeComparison.ancillaryFeesIncluded.map(svc => `<div style="font-size:11px;color:rgba(255,255,255,0.8);padding:3px 0">• ${svc}</div>`).join('\n')}
</div>
</div>

<div style="background:#EDE9DF;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:12px 16px;margin-top:16px">
<p style="font-size:10px;color:#555;line-height:1.6"><strong style="color:#A89035">Source:</strong> Industry fee ranges compiled from Brick Underground, CooperatorNews, FirstService Residential, PropertyClub NYC, Hudson Property Services, Habitat Magazine, Hauseit, and Yoreevo (2023–2025). Actual rates vary by company and building. Camelot's Intelligence pricing is intended to show full operating value while clearly separating Schedule A professional engagements and special-project work.</p>
</div>
</div>
` : ''}

<!-- PAGE 16: PROVEN TRACK RECORD -->
<div class="section section-white">
<div class="section-title">Proven Track Record</div>
<div class="section-sub">Case studies from camelot.nyc with real project images and links</div>

<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px">
${[
  { title: '301 East 50th Street', tag: 'New Construction', img: './images/case-studies/301-east-50th.png', url: 'https://www.camelot.nyc/case-studies/301-east-50th-street-new-york-ny/', copy: '56-unit white-glove condominium with resident manager, 12 staff members, gym, spa, rooftop, 24/7 staff, and retail/dining. Camelot helped the board stabilize post-construction settling, defects, staffing, house rules, 32BJ coordination, and resident feedback.', result: 'Operations stabilized - luxury condominium service model' },
  { title: '949 Park Avenue', tag: 'Insurance Claim Response', img: './images/case-studies/949-park.jpg', url: 'https://www.camelot.nyc/case-studies/949-park-ave-condominium/', copy: 'A 9th-floor window shattered unexpectedly, triggering emergency response and pedestrian safety risk. Camelot secured the area, coordinated engineering, and worked directly with the insurance carrier.', result: '$200,000 saved - zero resident disruption' },
  { title: '111 Mott Street', tag: 'Facade / Compliance', img: './images/case-studies/111-mott.jpg', url: 'https://www.camelot.nyc/case-studies/111-mott-st-new-york-ny/', copy: 'Structural facade deterioration required board communication, contractor oversight, compliance follow-through, and organized capital project execution.', result: 'Facade deterioration response - Chinatown rental' },
  { title: '250 Bowery', tag: 'Emergency Response', img: './images/case-studies/250-bowery.png', url: 'https://www.camelot.nyc/case-studies/250-bowery-new-york-ny/', copy: 'Camelot responded to a main sprinkler water-line burst during a holiday period, coordinating emergency repair, resident communication, vendors, and building protection.', result: 'Sprinkler water-line incident - urgent coordination' },
  { title: 'White Street Plaza Corp.', tag: 'Facade Repair', img: './images/case-studies/58-white-street.jpg', url: 'https://www.camelot.nyc/case-studies/white-street-plaza-corp/', copy: '58 White Street facade repair required project management, contractor coordination, board reporting, and disciplined schedule tracking.', result: 'Capital project management - Tribeca' },
  { title: 'Rental Portfolio Management', tag: 'Multifamily Operations', img: './images/case-studies/rental-portfolio.jpg', url: 'https://www.camelot.nyc/case-studies/brokerage-leasing-renewals-management/', copy: 'Camelot supports multifamily portfolios with superintendent coordination, repairs, resident service, compliance management, brokerage support, and recurring operational reporting.', result: 'Portfolio operations - brokerage services' },
].map(c => `<a href="${c.url}" target="_blank" rel="noopener" style="display:flex;flex-direction:column;text-decoration:none;background:#FDFAF3;border:1px solid #D5D0C6;min-height:292px;overflow:hidden">
<div style="height:96px;background:#EDE9DF;overflow:hidden"><img src="${c.img}" alt="${c.title} case study" style="width:100%;height:100%;object-fit:cover"></div>
<div style="padding:12px 14px 14px;display:flex;flex-direction:column;gap:6px;flex:1">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#A89035;font-weight:700">${c.tag}</div>
<h4 style="font-size:13px;font-weight:700;color:#3A4B5B;margin:0">${c.title}</h4>
<p style="font-size:10px;color:#555;line-height:1.55;margin:0">${c.copy}</p>
<p style="font-size:11px;color:#A89035;font-weight:700;margin:auto 0 0">${c.result}</p>
</div>
</a>`).join('')}
</div>

<div style="font-size:11px;color:#A89035;font-weight:600;text-align:center;margin-bottom:16px">Source: <a href="https://www.camelot.nyc/case-studies/" target="_blank" rel="noopener" style="color:#A89035;text-decoration:underline">camelot.nyc/case-studies</a> - properties include condominiums, cooperatives, multifamily rentals, and capital project assignments<br><span style="color:#888;font-weight:400">Serving: Manhattan, Brooklyn, Queens, Bronx, Westchester, NJ, CT, and Florida</span></div>

<!-- Legacy plain-text case-study cards hidden after website/image-backed case study update -->
<div style="display:none">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
<div style="background:#FDFAF3;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:18px">
<h4 style="font-size:14px;font-weight:700;color:#3A4B5B;margin-bottom:8px">111 Mott Street</h4>
<p style="font-size:11px;color:#555;line-height:1.7;margin-bottom:8px">Camelot case-study source: structural facade deterioration requiring coordinated project management, board communication, vendor oversight, and compliance follow-through.</p>
<p style="font-size:13px;color:#A89035;font-weight:700">Facade deterioration response · Chinatown rental</p>
</div>
<div style="background:#FDFAF3;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:18px">
<h4 style="font-size:14px;font-weight:700;color:#3A4B5B;margin-bottom:8px">250 Bowery</h4>
<p style="font-size:11px;color:#555;line-height:1.7;margin-bottom:8px">Camelot case-study source: emergency water-line event during a holiday period, requiring immediate coordination and resident-facing response.</p>
<p style="font-size:13px;color:#A89035;font-weight:700">Emergency response · Sprinkler water-line incident</p>
</div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
<div style="background:#FDFAF3;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:18px">
<h4 style="font-size:14px;font-weight:700;color:#3A4B5B;margin-bottom:8px">301 East 50th Street</h4>
<p style="font-size:11px;color:#555;line-height:1.7">Camelot case-study source: 56-unit white-glove condominium operations, resident service, staff coordination, and luxury-building board expectations.</p>
</div>
<div style="background:#FDFAF3;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:18px">
<h4 style="font-size:14px;font-weight:700;color:#3A4B5B;margin-bottom:8px">White Street Plaza Corp.</h4>
<p style="font-size:11px;color:#555;line-height:1.7">Camelot case-study source: 58 White Street facade repair project management, contractor coordination, schedule tracking, and board reporting.</p>
</div>
</div>

<div style="font-size:11px;color:#A89035;font-weight:600;text-align:center;margin-bottom:16px">Source: camelot.nyc/case-studies · Properties include condominiums, cooperatives, multifamily rentals, and capital project assignments<br><span style="color:#888;font-weight:400">Serving: Manhattan, Brooklyn, Queens, Bronx, Westchester, NJ, CT, and Florida</span></div>
</div>

</div>

<!-- PAGE 16B: TESTIMONIALS -->
<div class="section section-cream">
<div class="section-title">What Our Clients Say</div>
<div class="section-sub">Real feedback from boards and owners we serve</div>

<div class="testimonial-grid">
<div class="testimonial"><div class="qm">\u201C</div><p>Camelot has been a helpful agent representing our Co-op since we moved into our new home. As a new Board President and moving into a new building, we really relied on Camelot for their experience in understanding protocols, building-wide systems, and the business of running a building. The transition from Sponsor to a newly formed Board and dealing with the nuances of a new building settling is not easy without support.</p><div class="author">Brandon Miller</div><div class="author-title">Board President, 137 Franklin Street Apartment Corp</div></div>
<div class="testimonial"><div class="qm">\u201C</div><p>I have been a client of Camelot Realty Group since buying my apartment in 2012. Valerie and David have been by my side as not only the best and most knowledgeable property managers but as family! Their experience and dedication is limitless and they go far beyond the expected for each and every one of their clients and properties.</p><div class="author">Evee Georgiadis</div><div class="author-title">Owner, 949 Park Avenue Condominium</div></div>
</div>
<div class="testimonial-grid" style="margin-top:16px">
<div class="testimonial"><div class="qm">\u201C</div><p>As an overseas property owner, it is important to have a property manager that is responsive to both our and our tenants needs, knowledgeable and experienced across the lifecycle of ownership, cost efficient and trustworthy. As Camelot\u2019s clients for over three years we have come to appreciate the service, actions and advice the principals have provided \u2014 it is done in a friendly, personalized and professional way and goes the extra mile which has made our life much easier.</p><div class="author">Lawrence Lee</div><div class="author-title">Managing Director, Laureat Hotel Investments Limited</div></div>
<div class="testimonial"><div class="qm">\u201C</div><p>Camelot had always taken time to truly understand our properties and deliver a management solution that fits our needs. Camelot\u2019s responsiveness to the daily challenge of building property management and creative approaches to problem solving has helped Nexus to grow and gain respect in the NYC real estate market.</p><div class="author">Shaky Cohen</div><div class="author-title">Founder, Nexus Building Development Group</div></div>
</div>
</div>

<!-- PAGE 16C: FINANCIAL EXCELLENCE -->
<div class="section section-white">
<div class="section-title">Financial Excellence</div>
<div class="section-sub">Clear answers. On time. Every time. No chasing your management company.</div>

<div style="display:grid;grid-template-columns:3fr 2fr;gap:20px">
<div>
<h4 style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:16px;color:#3A4B5B;font-weight:700;margin-bottom:10px">In-House CPA Team</h4>
<p style="font-size:12px;color:#555;line-height:1.7;margin-bottom:14px">We don\u2019t outsource our books. Our in-house CPAs work directly for ${d.buildingName}, ensuring absolute accuracy, clear reporting, and immediate answers to your financial questions.</p>
<div style="margin-bottom:6px"><span style="color:#A89035;font-size:14px">\u2714</span> <span style="font-size:12px;color:#2C3240">Detailed Books Delivered Monthly \u2014 on schedule</span></div>
<div style="margin-bottom:6px"><span style="color:#A89035;font-size:14px">\u2714</span> <span style="font-size:12px;color:#2C3240">Real-Time Digital Arrears Tracking</span></div>
<div style="margin-bottom:6px"><span style="color:#A89035;font-size:14px">\u2714</span> <span style="font-size:12px;color:#2C3240">5-Year Forward Capital Planning</span></div>
<div style="margin-bottom:6px"><span style="color:#A89035;font-size:14px">\u2714</span> <span style="font-size:12px;color:#2C3240">Zero-Fee Online Payment Platform</span></div>
<div style="margin-bottom:6px"><span style="color:#A89035;font-size:14px">\u2714</span> <span style="font-size:12px;color:#2C3240">Board-Ready Reports \u2014 no chasing required</span></div>
<p style="font-size:12px;color:#A89035;font-style:italic;margin-top:12px">Camelot consistently doubles the Manhattan market average for rent growth.</p>
</div>
<div>
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-radius:8px;padding:18px;text-align:center;margin-bottom:12px">
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:28px;color:#A89035;font-weight:700">10.55%</div>
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px">Avg. YoY Rent Increase<br>vs. 5.20% market</div>
</div>
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-radius:8px;padding:18px;text-align:center;margin-bottom:12px">
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:28px;color:#A89035;font-weight:700">96%</div>
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px">Portfolio Occupancy Rate</div>
</div>
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-radius:8px;padding:18px;text-align:center">
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:28px;color:#A89035;font-weight:700"></div>
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px"></div>
</div>
</div>
</div>
</div>

<!-- PAGE 16D: SMART SECURITY & SURVEILLANCE -->
<div class="section section-cream">
<div class="section-title">Smart Security &amp; Surveillance</div>
<div class="section-sub">Live remote monitoring, cloud storage, emergency dispatch capability</div>

<div class="va-grid">
<div class="va-card"><h5 style="color:#A89035">Live Remote Surveillance</h5><p>Cloud-hosted cameras 24/7 \u2014 lobby, elevators, service entrances. Real-time feeds accessible to management.</p></div>
<div class="va-card"><h5 style="color:#A89035">AI-Powered Monitoring</h5><p>Computer vision flags unauthorized access, package theft, loitering. Automated alerts to management team.</p></div>
<div class="va-card"><h5 style="color:#A89035">Emergency Dispatch</h5><p>Integrated dispatch \u2014 NYPD, FDNY, EMS contacted directly. Response coordination from incident to resolution.</p></div>
<div class="va-card"><h5 style="color:#A89035">Cloud Storage &amp; Audit</h5><p>Tamper-proof logs. Evidence retrieval for insurance claims. 90-day cloud retention standard.</p></div>
<div class="va-card"><h5 style="color:#A89035">Access Control</h5><p>Smart fob, intercom, keyless entry. Visitor logs centralized. Package room monitoring.</p></div>
<div class="va-card"><h5 style="color:#A89035">Monthly Security Audit</h5><p>Board reports with incident docs, photos, digital signatures. Full accountability trail.</p></div>
</div>
</div>

<!-- PAGE 16E: TECHNOLOGY PLATFORM PARTNERS -->
<div class="section section-white">
<div class="section-title">Technology Platform Partners</div>
<div class="section-sub">Technology partners help Camelot build automation and seamless operating systems for buildings and residents</div>

<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:26px 0 20px">
${[
  { name: 'ConciergePlus', logo: 'https://pubcdn.conciergeplus.com/wp-content/uploads/2026/05/CP-Platform-Plus-Image-scaled.png', url: 'https://www.conciergeplus.com', desc: 'Resident portal, work orders, payments, amenities, AI chatbot, and ticket workflows', max: '260px', h: '74px', bg: '#F4F5FB', pad: '4px 8px' },
  { name: 'MDS', logo: '/images/partners/mds.svg', url: 'https://multidataservices.com', desc: 'Property management software, accounting reports, board packages, and monthly close cadence', max: '190px', h: '52px', bg: '#fff', pad: '4px 8px' },
  { name: 'BankUnited', logo: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/BankUnited_logo.svg', url: 'https://www.bankunited.com', desc: 'Banking, treasury, virtual lockbox, shared balance visibility, and zero-fee banking workflow', max: '220px', h: '46px', bg: '#fff', pad: '6px 8px' },
  { name: 'Select', logo: 'https://d2e1363xcu3t9u.cloudfront.net/2024/images/share.png', url: 'https://www.meetselect.com', desc: 'Resident lifestyle benefits and concierge membership value', max: '215px', h: '56px', bg: '#0B0B0B', pad: '8px 12px' },
  { name: 'PVEDI Engineering', logo: 'https://static1.squarespace.com/static/640a5c792943d223933618c6/t/682273b3859251242cf33975/1747088307967/PVEDI-E-Blue-V3-RGB.png?format=1500w', url: 'https://www.pve-llc.com', desc: 'Strategic engineering alignment for inspections, restoration, envelopes, and capital projects', max: '240px', h: '52px', bg: '#fff', pad: '5px 8px' },
  { name: 'AppFolio', logo: '/images/partners/appfolio.svg', url: 'https://www.appfolio.com', desc: 'Property operations platform', max: '190px', h: '52px', bg: '#fff', pad: '4px 8px' },
  { name: 'PropertyShark', logo: '/images/partners/propertyshark.svg', url: 'https://www.propertyshark.com', desc: 'Market and ownership intelligence', max: '190px', h: '52px', bg: '#fff', pad: '4px 8px' },
  { name: 'HubSpot', logo: '/images/partners/hubspot.svg', url: 'https://www.hubspot.com', desc: 'CRM and client communications', max: '175px', h: '52px', bg: '#fff', pad: '4px 8px' },
  { name: 'Domecile', logo: 'https://www.domecile.com/assets/default/domecile_logo_evolve-f47345567bc24e05b97fd7c7f893ef2e897c9679312a2b55776c7d7d5f2d1b7d.svg', url: 'https://www.domecile.com', desc: 'Digital closing and building document workflow', max: '200px', h: '52px', bg: '#fff', pad: '4px 8px' },
  { name: 'BuildingLink', logo: 'https://www.buildinglink.io/hs-fs/hubfs/Blue-Gold%20Logo%20-%20Transparent%20No%20Tagline.png?width=625&height=124&name=Blue-Gold%20Logo%20-%20Transparent%20No%20Tagline.png', url: 'https://www.buildinglink.io', desc: 'Resident operations and building communications', max: '220px', h: '52px', bg: '#fff', pad: '4px 8px' },
].map(p => `<a href="${p.url}" target="_blank" rel="noopener" style="background:#fff;border:1px solid #D5D0C6;text-decoration:none;min-height:154px;padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;box-shadow:0 6px 14px rgba(44,50,64,0.06)">
<div style="height:64px;width:100%;display:flex;align-items:center;justify-content:center;background:${p.bg};padding:${p.pad};border-radius:4px;overflow:hidden">
<img src="${p.logo}" alt="${p.name} logo" style="width:100%;max-width:${p.max};height:${p.h};object-fit:contain;display:block">
</div>
<div style="font-size:9.5px;color:#6B7280;text-transform:uppercase;letter-spacing:0.45px;text-align:center;line-height:1.35">${p.desc}</div>
</a>`).join('')}
</div>

<div style="background:#F5F0E5;border:1px solid #D5D0C6;border-left:4px solid #B8973A;padding:14px 18px;margin:0 0 16px">
<p style="font-size:12px;color:#38557D;line-height:1.6"><strong>Camelot connects software, banking, engineering, and service partners into one operating system.</strong> MDS supports board-ready accounting and monthly management reports delivered by the 20th-25th. ConciergePlus powers work orders, payments, amenity requests, administrative tickets, cloud file access, resident communication, automated board / annual / town-hall meeting workflows, and an AI chatbot layer over Camelot OS. BankUnited supports zero-fee banking, virtual lockbox workflows, shared account visibility, and treasury coordination. PVEDI Engineering strengthens Camelot's inspection, restoration, envelope, and capital-project bench.</p>
</div>

<div style="text-align:center;font-size:10px;color:#888;margin-top:8px">Also powered by: OpenAI NLP &nbsp;\u00B7&nbsp; AWS Cloud &nbsp;\u00B7&nbsp; RealtyMX &nbsp;\u00B7&nbsp; SiteCompli &nbsp;\u00B7&nbsp; Jack Jaffa</div>
</div>

<!-- PAGE 17: FINANCIAL OPPORTUNITY ANALYSIS -->
<div class="section section-cream">
<div class="section-title">Financial Opportunity Analysis</div>
<div class="section-sub">Conservative opportunity screen — benchmark / assumption disclosure, actual financials required before any savings claim</div>

<div class="stats-row">
<div class="stat-box"><div class="val gold">$${d.monthlyFee.toLocaleString()}/mo</div><div class="lbl">Recommended Intelligence Fee ($${d.pricePerUnit}/unit)</div></div>
<div class="stat-box"><div class="val" style="color:#16a34a">$${financialModel.vendorBidSavings.toLocaleString()}/yr</div><div class="lbl">Vendor Review Range</div></div>
<div class="stat-box"><div class="val" style="color:#16a34a">$${financialModel.revenueRecovery.toLocaleString()}/yr</div><div class="lbl">Revenue Review Range</div></div>
<div class="stat-box"><div class="val" style="color:${financialModel.hasUploadedFinancials ? '#16a34a' : '#A89035'}">${financialModel.hasUploadedFinancials ? 'MED' : 'LOW'}</div><div class="lbl">Financial Confidence</div></div>
</div>

<div style="background:#F8F5EC;border:1px solid #D8C894;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:13px 16px;margin:14px 0;color:#3A4B5B">
<div style="font-size:12px;font-weight:800;color:#0D2E63;margin-bottom:5px">The business case for Camelot — without overpromising</div>
<p style="font-size:11px;line-height:1.6;margin:0">This page is an initial operating-opportunity screen, not a guaranteed pro forma. Jackie can identify where savings may exist — vendor rebids, insurance review, utilities, collections, staffing design, compliance planning, and project controls — but final savings require the latest budget, audited financials, prior management report, utility bills, insurance policies, vendor contracts, arrears, payroll/staffing schedules, and mortgage/debt information. Actual financials required before any savings claim.</p>
</div>

<table class="invest-table" style="margin-top:16px">
<thead><tr><th>Opportunity Area</th><th>Illustrative Annual Range</th><th>Confidence</th><th>Camelot Approach</th></tr></thead>
<tbody>
${financialModel.opportunityLevers.map((lever: any, i: number) => `<tr${i % 2 ? ' style="background:#EDE9DF"' : ''}><td>${safe(lever.label)}</td><td style="color:#16a34a;font-weight:700">$0 - $${lever.amount.toLocaleString()}/yr</td><td>${safe(lever.confidence || 'Low')}</td><td>${safe(lever.narrative)}</td></tr>`).join('\n')}
</tbody>
</table>

<div style="background:#EDE9DF;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:12px">
<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
<div><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888">Non-cash board benefit</span><br>
<span style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:20px;font-weight:700;color:#A89035">Time, control, and cleaner decisions</span>
<span style="display:block;font-size:10px;color:#555;margin-top:2px">Board-time savings are shown as a governance benefit, not a dollar ROI line item, unless the board asks for a separate time-value model.</span></div>
<div style="text-align:right"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888">Use</span><br><span style="font-size:14px;font-weight:700;color:#A89035">Narrative only</span></div>
</div>
</div>

<div style="background:#3A4B5B;color:#fff;border-radius:8px;padding:14px 20px;margin-top:16px;text-align:center">
<span style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:16px;font-weight:700">Preliminary Review Range: $0 - $${financialModel.year1Value.toLocaleString()}/yr</span>
<span style="display:block;font-size:11px;opacity:0.9;margin-top:4px">Benchmark / assumption disclosure only. Camelot should not quote a firm savings target until board financials, contracts, utilities, insurance, and arrears are reviewed.</span>
</div>
</div>

<!-- PAGE 17B: CHARTS, GRAPHS & 5-YEAR PRO FORMA -->
<div class="section section-white">
<div class="section-title">Value Creation — Visual Analysis</div>
<div class="section-sub">Visual diligence map for ${d.buildingName} (${d.units} units${d.buildingArea > 0 ? ', ' + d.buildingArea.toLocaleString() + ' SF' : ''}); assumptions remain preliminary until tested against actual financials</div>

<div style="background:#F8F5EC;border:1px solid #D8C894;border-radius:8px;padding:12px 14px;margin:12px 0 22px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.6px;color:#A89035;font-weight:700;margin-bottom:8px">Value-Creation Source Stack — Benchmark / assumption disclosure</div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px 12px">
${valueCreationDataSources.map(src => `<div style="font-size:9.5px;line-height:1.45;color:#3A4B5B"><strong style="color:#14356A">${src.name}</strong> <span style="color:#A89035;font-weight:700">(${src.status})</span><br><span style="color:#666">${src.use}</span></div>`).join('\n')}
</div>
<div style="font-size:9px;color:#777;line-height:1.5;margin-top:10px;border-top:1px solid #E2D7B2;padding-top:8px">These names are not all direct data pulls in every run. Direct data is limited to records actually returned by the report. Industry publications and association data are reference benchmarks only. RealtyMX, Google Drive management reports, and Camelot internal reports can be used when credentials or source files are connected for the specific engagement.</div>
</div>

<!-- Savings Breakdown — Horizontal Bar Chart -->
<div style="margin-bottom:28px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600;margin-bottom:14px;padding-left:16px;border-left:4px solid #A89035">Illustrative Review Range by Category</div>
${financialModel.opportunityLevers.map((item: any, index: number) => {
  const maxVal = Math.max(...financialModel.opportunityLevers.map((lever: any) => lever.amount), 1);
  const pct = Math.min(100, Math.max(10, Math.round((item.amount / maxVal) * 100)));
  const colors = ['#A89035', '#3A4B5B', '#16a34a', '#0073b7', '#e63946', '#888'];
  const color = colors[index % colors.length];
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
<div style="width:170px;text-align:right;font-size:10.5px;color:#555;flex-shrink:0">${safe(item.label)}</div>
<div style="flex:1;background:#E5E3DE;border-radius:4px;height:24px;position:relative">
<div style="position:absolute;left:0;top:0;height:100%;background:${color};border-radius:4px;width:${pct}%"></div>
<span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:600;color:#2C3240">$0-$${(item.amount/1000).toFixed(0)}K</span>
</div>
</div>`;
}).join('\n')}
</div>

<!-- 5-Year Pro Forma Projection -->
<div style="margin-bottom:28px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600;margin-bottom:14px;padding-left:16px;border-left:4px solid #A89035">5-Year Planning View (not a savings promise)</div>
${(() => {
  const mgmtFee = financialModel.annualFee;
  const yr1Mid = financialModel.year1Value;
  const growth = 1 + financialModel.valueGrowth;
  const years = [1, 2, 3, 4, 5];
  const projections = years.map(y => {
    const savings = Math.round(yr1Mid * Math.pow(growth, y - 1));
    const fee = Math.round(mgmtFee * Math.pow(1 + financialModel.feeEscalation, y - 1));
    const net = savings - fee;
    const roi = Math.round((net / fee) * 100);
    return { year: y, savings, fee, net, roi };
  });
  const cumSavings = projections.reduce((acc, p) => { acc.push((acc.length > 0 ? acc[acc.length - 1] : 0) + p.net); return acc; }, [] as number[]);
  const totalSavings5yr = cumSavings[cumSavings.length - 1];
  const maxCum = Math.max(...cumSavings.map(Math.abs), 1);

  return `<table class="invest-table" style="font-size:11px">
<thead><tr><th>Year</th><th>Illustrative Review Range</th><th>Management Fee</th><th>Net Planning View</th><th>Ratio</th><th>Cumulative View</th></tr></thead>
<tbody>
${projections.map((p, i) => `<tr${i % 2 ? ' style="background:#EDE9DF"' : ''}>
<td style="font-weight:700">Year ${p.year}</td>
<td style="color:#16a34a;font-weight:600">$0 - $${p.savings.toLocaleString()}</td>
<td>$${p.fee.toLocaleString()}</td>
<td style="color:${p.net > 0 ? '#16a34a' : '#dc2626'};font-weight:700">$${p.net.toLocaleString()}</td>
<td style="color:#A89035;font-weight:700">${p.roi}%</td>
<td style="font-weight:600">$${cumSavings[i].toLocaleString()}</td>
</tr>`).join('\n')}
</tbody>
</table>

<!-- Cumulative Net Benefit — Area Chart -->
<div style="margin-top:16px;padding:16px 20px;background:#EDE9DF;border-radius:8px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:10px">Cumulative Planning View Over 5 Years</div>
<div style="display:flex;align-items:flex-end;gap:4px;height:120px">
${cumSavings.map((val, i) => {
  const pct = Math.max(8, Math.round((Math.abs(val) / maxCum) * 100));
  return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
<div style="font-size:9px;font-weight:700;color:#16a34a">$${(val/1000).toFixed(0)}K</div>
<div style="width:100%;background:linear-gradient(to top,#16a34a,#4ade80);border-radius:4px 4px 0 0;height:${pct}%;min-height:10px"></div>
<div style="font-size:9px;color:#888">Yr ${i + 1}</div>
</div>`;
}).join('\n')}
</div>
</div>

<!-- ROI Summary -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:16px">
<div style="background:#3A4B5B;border-radius:8px;padding:16px;text-align:center;color:#fff">
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:28px;font-weight:700;color:#A89035">${projections[0].roi}%</div>
<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-top:4px;opacity:0.7">Year 1 Planning Ratio</div>
</div>
<div style="background:#3A4B5B;border-radius:8px;padding:16px;text-align:center;color:#fff">
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:28px;font-weight:700;color:${totalSavings5yr >= 0 ? '#16a34a' : '#dc2626'}">$${(totalSavings5yr/1000).toFixed(0)}K</div>
<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-top:4px;opacity:0.7">5-Year Planning View</div>
</div>
<div style="background:#3A4B5B;border-radius:8px;padding:16px;text-align:center;color:#fff">
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:28px;font-weight:700;color:${totalSavings5yr >= 0 ? '#A89035' : '#dc2626'}">${((totalSavings5yr / (projections.reduce((s, p) => s + p.fee, 0))) * 100).toFixed(0)}%</div>
<div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-top:4px;opacity:0.7">5-Year Avg Ratio</div>
</div>
</div>`;
})()}
</div>

<!-- OpEx Breakdown — Donut Chart (CSS) -->
<div style="margin-top:24px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600;margin-bottom:14px;padding-left:16px;border-left:4px solid #A89035">Typical Operating Expense Mix</div>
<div style="display:flex;gap:24px;align-items:center">
<div style="width:180px;height:180px;border-radius:50%;flex-shrink:0;position:relative;background:conic-gradient(#dc2626 0deg 97deg,#A89035 97deg 169deg,#3A4B5B 169deg 230deg,#16a34a 230deg 280deg,#0073b7 280deg 320deg,#888 320deg 360deg)">
<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:90px;height:90px;background:#FDFAF3;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center">
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:16px;font-weight:700;color:#2C3240">${d.neighborhoodMarketData ? d.neighborhoodMarketData.opexRange.split('–')[0] : '$20'}</div>
<div style="font-size:8px;color:#888;text-transform:uppercase">avg $/SF/yr</div>
</div>
</div>
<div style="flex:1">
${[
  { label: 'Real Estate Taxes', pct: '27%', color: '#dc2626' },
  { label: 'Insurance', pct: '20%', color: '#A89035' },
  { label: 'Utilities', pct: '17%', color: '#3A4B5B' },
  { label: 'Maintenance & Repairs', pct: '14%', color: '#16a34a' },
  { label: 'Management & Admin', pct: '11%', color: '#0073b7' },
  { label: 'Other / Reserve', pct: '11%', color: '#888' },
].map(c => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
<div style="width:10px;height:10px;border-radius:2px;background:${c.color};flex-shrink:0"></div>
<div style="font-size:11px;color:#555;flex:1">${c.label}</div>
<div style="font-size:11px;font-weight:700;color:#2C3240">${c.pct}</div>
</div>`).join('\n')}
<div style="font-size:9px;color:#888;margin-top:8px;font-style:italic">Benchmark mix only. Actual expense categories must be reconciled against the building's budget, audited financials, and monthly reports.</div>
</div>
</div>
</div>

<div style="background:#EDE9DF;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:12px 16px;margin-top:20px">
<p style="font-size:11px;color:#555;line-height:1.6"><strong style="color:#A89035">Note:</strong> This is not a savings guarantee. It is a preliminary diligence model using public-record signals, neighborhood operating-expense benchmarks, and Camelot portfolio experience where available. The model should be replaced with a true building-specific analysis once Camelot receives the budget, prior manager report, audited financials, utility bills, insurance, vendor contracts, arrears, payroll/staffing data, and debt schedule.</p>
</div>
</div>

<!-- PAGE 18: PAIN POINTS → SOLUTIONS -->
<div class="section section-white">
<div class="section-title">Your Pain Points. Our Solutions.</div>
<div class="section-sub">Six critical areas where Camelot delivers measurable improvement</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0">

<div style="background:#fff;border:1px solid #E5E3DE;border-top:3px solid #dc2626;border-radius:0 0 8px 8px;padding:18px">
<h4 style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:6px">\u26A0 Local Law Compliance (LL97, LL11, FISP, HPD)</h4>
<p style="font-size:11px;color:#555;line-height:1.6;margin-bottom:8px">${d.buildingArea > 25000 ? `At ${d.buildingArea.toLocaleString()} SF, this building is above the LL97 carbon cap threshold. Non-compliance penalties start at $268/ton CO\u2082.` : 'Compliance with HPD, DOB, and local laws requires proactive tracking and resolution.'}</p>
<p style="font-size:11px;color:#16a34a;font-weight:600">\u2714 Camelot delivers an initial LL97 liability summary and compliance roadmap within 30 days where applicable</p>
</div>

<div style="background:#fff;border:1px solid #E5E3DE;border-top:3px solid #A89035;border-radius:0 0 8px 8px;padding:18px">
<h4 style="font-size:12px;font-weight:700;color:#3A4B5B;margin-bottom:6px">\uD83D\uDCE1 Communication &amp; Response Time</h4>
<p style="font-size:11px;color:#555;line-height:1.6;margin-bottom:8px">Residents and board members need timely responses on maintenance, vendor work, and building updates. Traditional management creates communication gaps.</p>
<p style="font-size:11px;color:#16a34a;font-weight:600">\u2714 ConciergePlus + Camelot AI — 24/7 agent for board, residents, staff, vendors</p>
</div>

<div style="background:#fff;border:1px solid #E5E3DE;border-top:3px solid #A89035;border-radius:0 0 8px 8px;padding:18px">
<h4 style="font-size:12px;font-weight:700;color:#3A4B5B;margin-bottom:6px">\uD83D\uDCA1 Financial Transparency</h4>
<p style="font-size:11px;color:#555;line-height:1.6;margin-bottom:8px">Boards often receive late reports with no variance analysis or forward projection. Financial visibility is critical for sound governance.</p>
<p style="font-size:11px;color:#16a34a;font-weight:600">\u2714 In-house CPA, real-time dashboards, 5-year capital planning, Merlin AI budgeting</p>
</div>

<div style="background:#fff;border:1px solid #E5E3DE;border-top:3px solid #A89035;border-radius:0 0 8px 8px;padding:18px">
<h4 style="font-size:12px;font-weight:700;color:#3A4B5B;margin-bottom:6px">\uD83C\uDFD7\uFE0F Capital Project Financing</h4>
<p style="font-size:11px;color:#555;line-height:1.6;margin-bottom:8px">Pre-war buildings face significant capital needs — facade, elevator, boiler. Financing without special assessments is a perennial challenge.</p>
<p style="font-size:11px;color:#16a34a;font-weight:600">\u2714 In-house licensed mortgage broker — building loans with no shareholder assessment</p>
</div>

<div style="background:#fff;border:1px solid #E5E3DE;border-top:3px solid #A89035;border-radius:0 0 8px 8px;padding:18px">
<h4 style="font-size:12px;font-weight:700;color:#3A4B5B;margin-bottom:6px">\uD83D\uDD0D On-Site Oversight &amp; Accountability</h4>
<p style="font-size:11px;color:#555;line-height:1.6;margin-bottom:8px">Many firms rely on reactive visits. Boards have no visibility into what\u2019s happening between incidents.</p>
<p style="font-size:11px;color:#16a34a;font-weight:600">\u2714 Weekly PM site visits + monthly Facility Manager inspections, documented w/ photos</p>
</div>

<div style="background:#fff;border:1px solid #E5E3DE;border-top:3px solid #A89035;border-radius:0 0 8px 8px;padding:18px">
<h4 style="font-size:12px;font-weight:700;color:#3A4B5B;margin-bottom:6px">\uD83D\uDCCA Analytical Data &amp; Benchmarking</h4>
<p style="font-size:11px;color:#555;line-height:1.6;margin-bottom:8px">Without comparative data, boards can\u2019t evaluate costs, vendor performance, or market positioning.</p>
<p style="font-size:11px;color:#16a34a;font-weight:600">\u2714 SCOUT market intelligence — monthly benchmarks vs. peer buildings + Merlin AI alerts</p>
</div>

</div>
</div>

<!-- PAGE 19: TECHNOLOGY PLATFORM -->
<div class="section section-cream">
<div class="section-title">Technology Platform</div>
<div class="section-sub">Proven tools today + next-generation Camelot OS deploying 2026</div>

<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:14px;color:#A89035;text-align:center;margin-bottom:6px;font-weight:600">Current Stack \u2014 Active Now</div>
<table class="compare-table" style="margin-bottom:20px">
<thead><tr><th style="background:#3A4B5B;color:#fff">Platform</th><th style="background:#3A4B5B;color:#fff">Function</th><th style="background:#3A4B5B;color:#fff">Benefit to ${d.buildingName}</th></tr></thead>
<tbody>
<tr><td style="font-weight:700;color:#3A4B5B">MDS (Multi Data Services)</td><td>Core Management Platform</td><td>Camelot\u2019s primary property management and accounting system \u2014 financials, work orders, reporting, compliance tracking</td></tr>
<tr><td style="font-weight:700;color:#3A4B5B">AppFolio</td><td>Property Mgmt</td><td>Supplementary accounting, work orders, document management, monthly reporting</td></tr>
<tr><td style="font-weight:700;color:#3A4B5B">BuildingLink</td><td>Resident Portal</td><td>Maintenance requests, package management, amenity booking</td></tr>
<tr><td style="font-weight:700;color:#3A4B5B">Zego</td><td>Payments</td><td>ACH, e-check, credit card collection with full audit trail</td></tr>
<tr><td style="font-weight:700;color:#3A4B5B">Board Packager</td><td>Board Docs</td><td>Secure digital board package management \u2014 minutes, financials, 24/7</td></tr>
<tr><td style="font-weight:700;color:#3A4B5B">Select</td><td>Leasing &amp; Marketing</td><td>Showing coordination, applicant management, and leasing workflow</td></tr>
<tr><td style="font-weight:700;color:#3A4B5B">Google Workspace</td><td>Collaboration</td><td>Google Drive, Docs, Sheets \u2014 shared file management and team collaboration</td></tr>
</tbody>
</table>

<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:14px;color:#A89035;text-align:center;margin-bottom:6px;font-weight:600">Camelot OS \u2014 Deploying 2026</div>

<!-- ConciergePlus Hero — the centerpiece -->
<div style="background:#3A4B5B;border-radius:10px;padding:22px;margin-bottom:16px;color:#fff">
<div style="display:grid;grid-template-columns:1fr 1.15fr;gap:18px;align-items:center;margin-bottom:14px">
<div>
<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
<a href="https://conciergeplus.com/" target="_blank" rel="noopener" style="width:158px;height:48px;background:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:6px 10px;overflow:hidden">
<img src="/images/partners/conciergeplus.svg" alt="ConciergePlus logo" style="width:100%;height:100%;object-fit:contain;display:block">
</a>
<div>
<div style="font-size:16px;font-weight:700;color:#A89035">ConciergePlus — AI-Driven Resident Portal</div>
<div style="font-size:11px;color:rgba(255,255,255,0.6)">28 integrated modules \u00B7 Board + Resident + Staff + Vendor portals \u00B7 Mobile app</div>
</div>
</div>
<p style="font-size:11px;color:rgba(255,255,255,0.82);line-height:1.65;margin:0 0 12px">ConciergePlus gives residents and staff one trackable operating hub for service requests, payments, amenity reservations, administrative tickets, package and front desk workflows, cloud files, resident notices, and board communication. Camelot layers its internal AI workflow over the portal so routine questions, meeting logistics, vendor follow-up, and document retrieval move faster without losing human oversight.</p>
</div>
<div style="background:#F4F5FB;border:1px solid rgba(255,255,255,0.16);border-radius:8px;padding:10px;min-height:156px;display:flex;align-items:center;justify-content:center;overflow:hidden">
<img src="https://pubcdn.conciergeplus.com/wp-content/uploads/2026/05/CP-Platform-Plus-Image-scaled.png" alt="Plus by Concierge Plus platform screens" style="width:100%;height:150px;object-fit:contain;display:block">
</div>
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px">
${['Amenity Booking', 'Service Requests', 'Online Banking Services', 'Admin Ticket Orders', 'Package Delivery', 'Cloud File Depository', 'AI Chatbot Layer', 'Zoom Board Meetings', 'Annual / Town Hall Meetings', 'Virtual Lockbox', 'Shared Bank Visibility', 'Vendor / Staff Workflow', 'Announcements', 'Key Tracking', 'Parking Mgmt', 'Residents\u2019 Guide'].map(m => `<div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:4px;padding:5px 8px;font-size:9px;color:rgba(255,255,255,0.8);text-align:center">${m}</div>`).join('\n')}
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
<div style="background:rgba(168,144,53,0.15);border:1px solid rgba(168,144,53,0.3);border-radius:6px;padding:10px;text-align:center">
<div style="font-size:18px;font-weight:800;color:#A89035">$0</div>
<div style="font-size:9px;color:rgba(255,255,255,0.6)">Bank Fees on Payments</div>
</div>
<div style="background:rgba(168,144,53,0.15);border:1px solid rgba(168,144,53,0.3);border-radius:6px;padding:10px;text-align:center">
<div style="font-size:18px;font-weight:800;color:#A89035">24/7</div>
<div style="font-size:9px;color:rgba(255,255,255,0.6)">AI Support (Merlin)</div>
</div>
<div style="background:rgba(168,144,53,0.15);border:1px solid rgba(168,144,53,0.3);border-radius:6px;padding:10px;text-align:center">
<div style="font-size:18px;font-weight:800;color:#A89035">28</div>
<div style="font-size:9px;color:rgba(255,255,255,0.6)">Integrated Modules</div>
</div>
</div>
</div>

<!-- Camelot OS Platform Cards -->
<div class="va-grid">
<div class="va-card" style="border-left-color:#A89035"><h5 style="color:#A89035">🧠 Merlin AI</h5><p>Camelot\u2019s AI engine powering ConciergePlus, budget forecasting, expense anomaly detection, vendor scoring, pro-forma modeling, and intelligent building operations.</p></div>
<div class="va-card" style="border-left-color:#3A4B5B"><h5>📊 SCOUT</h5><p>Market intelligence: quarterly benchmarks, ACRIS data, rental tracking, peer building comparisons, lead generation, and market-position scoring.</p></div>
<div class="va-card" style="border-left-color:#A89035"><h5 style="color:#A89035">✍ Jackie</h5><p>AI-powered new business development engine: generates Property Intelligence Reports, management proposals, email drafts, and cold caller sheets.</p></div>
<div class="va-card" style="border-left-color:#3A4B5B"><h5>💳 Prisma</h5><p>Enhanced ACH billing, real-time collection tracking, and NSF reduction through Plaid-linked payment verification.</p></div>
<div class="va-card" style="border-left-color:#A89035"><h5 style="color:#A89035">⚡ Parity</h5><p>Real-time HVAC and energy monitoring. LL97 liability modeling included. 15\u201325% utility savings opportunity.</p></div>
<div class="va-card" style="border-left-color:#3A4B5B"><h5>📱 Camelot Central</h5><p>Unified mobile app: building files, utility tracking, compliance, smart access, and all resident services in one interface.</p></div>
</div>

<!-- Camelot OS Backend -->
<div style="background:#EDE9DF;border:2px solid #A89035;border-radius:8px;padding:18px;margin-top:16px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:700;margin-bottom:8px">\uD83E\uDDE0 Camelot OS — Intelligent Backend</div>
<p style="font-size:11px;color:#555;line-height:1.7;margin-bottom:10px">Behind every Camelot-managed building is an AI-readable file system powered by Make.com automation and MDS property codes. Every document \u2014 leases, financials, compliance filings, vendor contracts, board minutes \u2014 is automatically classified, named, and organized so AI agents can instantly retrieve and process information across all 42 properties. No more searching. No more lost files. No more institutional knowledge locked in someone\u2019s head.</p>
<div style="display:flex;gap:10px;flex-wrap:wrap">
${['MDS Property Codes', 'Auto-Classification', 'Make.com Automation', 'Google Drive Structured Storage', 'AI-Ready File System', 'Real-Time Monitoring'].map(t => `<span style="display:inline-block;background:#fff;border:1px solid #D5D0C6;border-radius:4px;padding:4px 10px;font-size:10px;color:#3A4B5B;font-weight:600">${t}</span>`).join('\n')}
</div>
</div>
</div>

<!-- PAGE 19B: QUARTERLY MARKET REPORTS -->
<div class="section section-white">
<div class="section-title">Quarterly Market Reports</div>
<div class="section-sub">How does your building stack up against the local market?</div>

<p style="font-size:12px;color:#555;line-height:1.7;margin-bottom:16px">Every quarter, Camelot delivers a market-aware report modeled after professional Manhattan market reports, including the Miller Samuel New York City market-report structure. Camelot benchmarks median and average sale price, price per square foot, closed sales, listing inventory, days on market, negotiability, rental pulse, and submarket trendlines, then translate those figures into board-level decisions: how is the building performing, what might a unit be worth, and where should the board focus next?</p>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:16px">
<h5 style="font-size:12px;font-weight:700;color:#2C3240;margin-bottom:6px">Cost of Living &amp; Carrying Cost</h5>
<p style="font-size:11px;color:#555;line-height:1.5">Maintenance, common charges, utilities, insurance, and operating costs compared with local peer buildings.</p>
</div>
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:16px">
<h5 style="font-size:12px;font-weight:700;color:#2C3240;margin-bottom:6px">Unit Value Estimate</h5>
<p style="font-size:11px;color:#555;line-height:1.5">What a unit might be worth based on sales, leasing, dollars per square foot, floor line, view, and current market momentum.</p>
</div>
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:16px">
<h5 style="font-size:12px;font-weight:700;color:#2C3240;margin-bottom:6px">Sales &amp; Leasing Pulse</h5>
<p style="font-size:11px;color:#555;line-height:1.5">Median sale prices, rental rates, absorption, days on market, leasing demand, and price momentum.</p>
</div>
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:16px">
<h5 style="font-size:12px;font-weight:700;color:#2C3240;margin-bottom:6px">Home Score &amp; Safety</h5>
<p style="font-size:11px;color:#555;line-height:1.5">Building score, safety signals, open violations, service quality, amenity condition, and compliance status tracked quarter over quarter.</p>
</div>
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:16px">
<h5 style="font-size:12px;font-weight:700;color:#2C3240;margin-bottom:6px">Capital &amp; Reserve Health</h5>
<p style="font-size:11px;color:#555;line-height:1.5">Reserve position, projected capital needs, LL97/LL11 exposure, insurance movement, and upcoming board decisions.</p>
</div>
<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:16px">
<h5 style="font-size:12px;font-weight:700;color:#2C3240;margin-bottom:6px">Dollars Per Square Foot</h5>
<p style="font-size:11px;color:#555;line-height:1.5">Condo, co-op, and rental $/sf benchmarks so boards can understand value, leasing power, and owner equity.</p>
</div>
</div>

<div style="background:#F8F5EC;border:1px solid #D8C894;border-radius:8px;padding:12px 14px;margin:8px 0 14px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.4px;color:#A89035;font-weight:700;margin-bottom:6px">Quarterly Market Report Source Rule</div>
<p style="font-size:10px;color:#555;line-height:1.55">Camelot cites and compares against Miller Samuel / Douglas Elliman-style market categories, REBNY market context, ACRIS closed sales, StreetEasy/Zillow/Compass listing signals, rental inventory, and peer-building cost-per-square-foot benchmarks. Source: <a href="https://millersamuel.com/market-reports/new-york-city/" target="_blank" rel="noopener" style="color:#14356A;font-weight:700">Miller Samuel New York City Market Reports</a>.</p>
</div>

<div style="background:#3A4B5B;border-radius:8px;padding:16px;color:#fff;text-align:center">
<p style="font-size:12px;line-height:1.7;color:rgba(255,255,255,0.8)">Quarterly reports are part of the Camelot Intelligence operating cadence. Board members receive a branded PDF and live dashboard access via Camelot Central.</p>
</div>

<!-- Report Preview — embedded screenshot of actual Sentinel report -->
<div style="margin-top:20px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:600;margin-bottom:10px;padding-left:16px;border-left:4px solid #A89035">Sample Report Preview</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
<div style="background:#0D2240;border-radius:8px;padding:16px;text-align:center;border:1px solid #D5D0C6;position:relative">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:9px;letter-spacing:3px;color:#B8973A;text-transform:uppercase;margin-bottom:6px">C A M E L O T</div>
<div style="font-size:7px;color:#B8973A;letter-spacing:2px;margin-bottom:10px">MARKET INTELLIGENCE</div>
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;font-weight:800;color:#B8973A">Q1 2026</div>
<div style="font-size:7px;color:rgba(255,255,255,0.5);margin-top:4px">NYC Market Report</div>
<div style="position:absolute;bottom:4px;left:0;right:0;font-size:6px;color:rgba(255,255,255,0.2)">Page 1 of 12</div>
</div>
<div style="background:#F5F0E5;border-radius:8px;padding:12px;border:1px solid #D5D0C6">
<div style="font-size:8px;font-weight:700;color:#B8973A;margin-bottom:6px;border-bottom:1px solid #B8973A;padding-bottom:3px">Neighborhood Benchmarks</div>
<div style="font-size:6px;color:#555;line-height:1.8">
Harlem: $892/sf · $2,950 1BR<br>
Murray Hill: $1,380/sf · $4,200 1BR<br>
Gramercy: $1,250/sf · $3,800 1BR<br>
UWS: $1,500/sf · $4,300 1BR<br>
Tribeca: $2,100/sf · $5,200 1BR
</div>
<div style="display:flex;gap:2px;margin-top:6px;height:30px;align-items:flex-end">
<div style="flex:1;background:#B8973A;height:40%;border-radius:2px 2px 0 0"></div>
<div style="flex:1;background:#1A6B7C;height:65%;border-radius:2px 2px 0 0"></div>
<div style="flex:1;background:#B8973A;height:55%;border-radius:2px 2px 0 0"></div>
<div style="flex:1;background:#1A6B7C;height:70%;border-radius:2px 2px 0 0"></div>
<div style="flex:1;background:#B8973A;height:100%;border-radius:2px 2px 0 0"></div>
</div>
<div style="font-size:5px;color:#888;text-align:center;margin-top:2px">$/Sqft by Neighborhood</div>
</div>
<div style="background:#FDFAF3;border-radius:8px;padding:12px;border:1px solid #D5D0C6">
<div style="font-size:8px;font-weight:700;color:#0D2240;margin-bottom:6px;border-bottom:1px solid #0D2240;padding-bottom:3px">Portfolio Intelligence</div>
<div style="font-size:6px;color:#555;line-height:1.8">
\u2714 5 of 6 buildings above market<br>
\u2714 10.55% avg rent growth<br>
\u2714 96% portfolio occupancy<br>
\u2714 ${CAMELOT_PROFILE.buildingsManaged} buildings managed<br>
\u2714 ${CAMELOT_PROFILE.assetsUnderManagement} AUM*
</div>
<div style="background:#0D2240;border-radius:4px;padding:6px;text-align:center;margin-top:6px">
<div style="font-size:12px;font-weight:800;color:#B8973A">5/6</div>
<div style="font-size:5px;color:rgba(255,255,255,0.5)">Above market</div>
</div>
</div>
</div>
<div style="text-align:center;margin-top:8px">
<a href="https://camelot-market-reports.onrender.com/" target="_blank" style="font-size:11px;color:#A89035;text-decoration:underline;font-weight:600">View full interactive Q1 2026 Market Report \u2192</a>
</div>
</div>
</div>

<!-- PAGE 20: CAMELOT ADVANTAGE REVIEW AREAS -->
<div class="section section-white">
<div class="section-title">The Camelot Advantage — Review Areas</div>
<div class="section-sub">Board-facing operating themes; quantify only after budgets, contracts, bills, and board records are reviewed</div>

<table class="invest-table">
<thead><tr><th>Value Driver</th><th>Board Benefit</th><th>How It Is Verified for ${d.buildingName}</th></tr></thead>
<tbody>
<tr><td>Compliance Management</td><td>Cleaner compliance posture, fewer surprises, and better board visibility</td><td>Review HPD, DOB, ECB/OATH, LL84/LL97, FISP applicability, insurance requirements, and professional reports</td></tr>
<tr><td>Resident / Shareholder Communication</td><td>Better issue tracking, fewer lost requests, and clearer response history</td><td>Measure through work-order logs, board minutes, complaint history, portal adoption, and resident communication patterns</td></tr>
<tr><td>Online Banking Services</td><td>Reduced payment friction and clearer bank visibility</td><td>BankUnited workflow can support zero bank fees and better balance visibility once accounts and controls are approved</td></tr>
<tr><td>Technology Platform</td><td>Trackable work orders, board packets, meeting minutes, document storage, and management reporting</td><td>Scope through the selected Intelligence package, implementation checklist, and user permissions</td></tr>
<tr><td>Energy / Utility Review</td><td>Practical utility benchmarking and conservation planning</td><td>Requires utility bills, meters, LL84/LL97 filings, equipment inventory, and building operating schedules</td></tr>
<tr><td>Brokerage / Leasing Support</td><td>Market context for resale, rental, sublet, or leasing questions where applicable</td><td>Use RealtyMX and market comps when credentials or current listings are connected to the run</td></tr>
<tr><td>Camelot Capital Advisory</td><td>Better refinancing, reserve, and capital-planning preparation</td><td>Requires debt schedule, mortgage statements, reserve position, budget, engineering reports, and board objectives</td></tr>
</tbody>
</table>

<div style="font-size:10px;color:#888;margin-top:8px;text-align:center">Source discipline: public records, board-provided documents, Camelot operating experience, and industry benchmarks. This page identifies review areas, not guaranteed outcomes.</div>
</div>

<!-- PAGE 21: OPERATING COST INTELLIGENCE -->
${d.neighborhoodMarketData ? `
<div class="section section-cream">
<div class="section-title">Operating Cost Intelligence</div>
<div class="section-sub">${d.neighborhoodName ? d.neighborhoodName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'NYC'} Benchmark — SCOUT Q1 2026 Data</div>

<table class="invest-table">
<thead><tr><th>Cost Category</th><th>SCOUT Range</th><th>Camelot Strategy</th></tr></thead>
<tbody>
<tr><td>Real Estate Taxes</td><td>${d.neighborhoodMarketData.opexRange.split('–')[0].replace('$','$')}+/SF/yr</td><td>Fixed — strategic abatement review (J-51, 421-a)</td></tr>
<tr><td>Insurance</td><td>$1.20–2.80/SF/yr</td><td style="color:#A89035;font-weight:600">\u2605 Rebid opportunity: 12–20% savings</td></tr>
<tr><td>Utilities (Gas/Electric/Water)</td><td>$3–10/SF/yr</td><td style="color:#A89035;font-weight:600">\u2605 Parity energy optimization: 15–25% reduction</td></tr>
<tr><td>Mgmt + Admin</td><td>$3–7/SF/yr</td><td style="color:#16a34a;font-weight:600">\u2714 Camelot competitive + greater scope</td></tr>
<tr><td>Maintenance &amp; Repairs</td><td>$3–8/SF/yr</td><td style="color:#A89035;font-weight:600">\u2605 Vendor rebid: 10–18% reduction</td></tr>
<tr><td><strong>Total OpEx Benchmark</strong></td><td><strong>${d.neighborhoodMarketData.opexRange}</strong></td><td>${d.buildingArea > 0 ? `Your building: ~$${Math.round(d.buildingArea * 35 / d.buildingArea).toFixed(0)}/SF est.` : 'Within range'}</td></tr>
</tbody>
</table>

<div style="background:#EDE9DF;border-left:4px solid #A89035;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:14px">
<p style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-style:italic;color:#3A4B5B;line-height:1.7">&ldquo;Location sets the revenue ceiling; management determines what you keep. Camelot\u2019s integrated cost management \u2014 energy optimization (Parity), online payments (Prisma), and compliance automation \u2014 directly lowers the operating cost line across all building types.&rdquo;</p>
<p style="font-size:10px;color:#A89035;font-weight:600;margin-top:6px">\u2014 Camelot Q1 2026 Market Report</p>
</div>
</div>
` : ''}

<!-- PAGE 22: PORTFOLIO REFERENCES + CASE STUDY (DYNAMIC) -->
${buildPortfolioSection(d)}

<!-- PAGE 23: BANKING PARTNER -->
<div class="section section-cream">
<div class="section-title">Banking Partnership</div>
<div class="section-sub">BankUnited — premier banking for property management and co-op associations</div>

<div style="background:#fff;border:2px solid #A89035;border-radius:8px;padding:22px;margin:16px 0">
<div style="display:grid;grid-template-columns:1fr .95fr;gap:18px;align-items:center">
<div>
<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
<div style="width:190px;height:56px;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#fff;padding:6px 8px;border:1px solid #E5E3DE">
<img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/BankUnited_logo.svg" alt="BankUnited" style="width:100%;height:44px;object-fit:contain;display:block">
</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:16px;color:#3A4B5B;font-weight:700">BankUnited Partnership</div>
</div>
<p style="font-size:12px;color:#555;line-height:1.8">Camelot works with <strong>BankUnited</strong> as a trusted banking and technology partner for property management companies, co-op associations, condominium boards, and HOAs. BankUnited supports <strong>zero bank fees for Camelot customers</strong>, virtual lockbox structures to hold funds, shareable account visibility so boards can see balances, competitive treasury options, and integration with payment, collections, vendor-payment, and reconciliation workflows.</p>
<p style="font-size:12px;color:#A89035;font-weight:600;margin-top:10px">This relationship often delivers meaningful financial value from Day 1.</p>
</div>
<div style="background:#101827;border-radius:8px;padding:14px;min-height:172px;display:flex;align-items:center;justify-content:center;overflow:hidden">
<div style="color:#fff;font-size:20px;line-height:1.28;font-weight:700;max-width:320px">Software integrations should give HOA and board teams their day back.</div>
</div>
</div>
</div>

<!-- Select Partnership -->
<div style="background:#1a1a2e;border:2px solid #A89035;border-radius:10px;padding:24px;margin:20px 0;color:#fff">
<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
<div style="width:156px;height:64px;background:#0B0B0B;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:8px 10px;border:1px solid rgba(255,255,255,0.16);overflow:hidden">
<img src="https://d2e1363xcu3t9u.cloudfront.net/2024/images/share.png" alt="Select official brand image" style="width:100%;height:100%;object-fit:contain;display:block">
</div>
<div>
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;font-weight:700;color:#A89035">Select — Exclusive Resident Benefits</div>
<div style="font-size:11px;color:rgba(255,255,255,0.5)">Private membership · 1.6M+ partner locations · Concierge service</div>
</div>
</div>
<p style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.8;margin-bottom:14px">Every Camelot-managed building gets access to <strong style="color:#A89035">Select</strong> \u2014 a private membership community offering exclusive pricing, VIP perks, and concierge services at over 1.6 million premier locations worldwide. Residents receive a <strong style="color:#A89035">co-branded titanium card</strong> and app access to unlock savings on hotels, restaurants, entertainment, travel, and more.</p>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
<div style="background:rgba(168,144,53,0.15);border:1px solid rgba(168,144,53,0.3);border-radius:6px;padding:10px;text-align:center">
<div style="font-size:22px;margin-bottom:4px">\uD83C\uDFE8</div>
<div style="font-size:10px;font-weight:700;color:#A89035">Hotels</div>
<div style="font-size:8px;color:rgba(255,255,255,0.5)">Unpublished rates + VIP amenities</div>
</div>
<div style="background:rgba(168,144,53,0.15);border:1px solid rgba(168,144,53,0.3);border-radius:6px;padding:10px;text-align:center">
<div style="font-size:22px;margin-bottom:4px">\uD83C\uDF7D\uFE0F</div>
<div style="font-size:10px;font-weight:700;color:#A89035">Dining</div>
<div style="font-size:8px;color:rgba(255,255,255,0.5)">VIP treatment + discounts</div>
</div>
<div style="background:rgba(168,144,53,0.15);border:1px solid rgba(168,144,53,0.3);border-radius:6px;padding:10px;text-align:center">
<div style="font-size:22px;margin-bottom:4px">\uD83C\uDFAD</div>
<div style="font-size:10px;font-weight:700;color:#A89035">Entertainment</div>
<div style="font-size:8px;color:rgba(255,255,255,0.5)">Up to 60% off events</div>
</div>
<div style="background:rgba(168,144,53,0.15);border:1px solid rgba(168,144,53,0.3);border-radius:6px;padding:10px;text-align:center">
<div style="font-size:22px;margin-bottom:4px">\uD83D\uDC8E</div>
<div style="font-size:10px;font-weight:700;color:#A89035">Concierge</div>
<div style="font-size:8px;color:rgba(255,255,255,0.5)">7-day live support</div>
</div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
<div style="text-align:center;padding:8px">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800;color:#A89035">$1,500+</div>
<div style="font-size:8px;color:rgba(255,255,255,0.5)">Avg member savings/year</div>
</div>
<div style="text-align:center;padding:8px">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800;color:#A89035">1.6M</div>
<div style="font-size:8px;color:rgba(255,255,255,0.5)">Partner locations</div>
</div>
<div style="text-align:center;padding:8px">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800;color:#A89035">$200</div>
<div style="font-size:8px;color:rgba(255,255,255,0.5)">Off for Camelot residents</div>
</div>
</div>

<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:12px;font-size:11px;color:rgba(255,255,255,0.6);line-height:1.6">
<strong style="color:#A89035">For ${d.buildingName} residents:</strong> Camelot-managed buildings receive exclusive $200 off Select membership. Co-branded titanium card + app access. Residents redeem through the ConciergePlus portal or the Select mobile app. Includes: unpublished hotel rates, restaurant VIP perks, up to 60% off entertainment, dedicated concierge team, and members-only social events.
</div>
</div>

<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:14px;color:#A89035;text-align:center;margin-top:16px;font-weight:600">RED Awards 2025: Property Management Company of the Year</div>
<div style="font-size:11px;color:#888;text-align:center;margin-top:6px">REBNY 2025: David Goldoff Leadership Award &nbsp;\u00B7&nbsp; ${CAMELOT_PROFILE.buildingsManaged} Buildings &nbsp;\u00B7&nbsp; ${CAMELOT_PROFILE.assetsUnderManagement} AUM internal estimate &nbsp;\u00B7&nbsp; Founded ${CAMELOT_PROFILE.foundedYear}</div>
<div style="font-size:10px;color:#999;text-align:center;margin-top:8px">Associated with: ${camelotAssociationTextLine()} &nbsp;\u00B7&nbsp; Licensed REBNY Managing Agent &amp; Brokerage</div>
</div>

<!-- PAGE 24: CONFIDENTIALITY (CONDENSED) -->
<div class="section section-white" style="font-size:11px;color:#555;line-height:1.8">
<div class="section-title" style="font-size:20px">⚖️ Confidentiality &amp; Legal Notice</div>

<div style="background:#EDE9DF;border:1px solid #D5D0C6;border-radius:8px;padding:24px;margin-bottom:16px">
<div style="display:flex;gap:10px;margin-bottom:12px;color:#A89035;font-size:22px;align-items:center"><span title="Court">🏛️</span><span title="Law">⚖️</span><span title="Legal terms">🔨</span><span title="Confidentiality">🔒</span></div>
<p style="font-size:12px;color:#2C3240;line-height:1.8;margin-bottom:12px">\uD83D\uDD12 This Property Intelligence Report is <strong>confidential and proprietary</strong> to Camelot Realty Group. It is intended solely for the named recipient(s) and may not be reproduced, distributed, or disclosed without prior written consent.</p>
<p style="font-size:11px;color:#555;line-height:1.7;margin-bottom:12px">${isHoaRecovery
  ? `\u00A9 ${new Date().getFullYear()} Camelot Realty Group. All rights reserved. Contents are protected by U.S. copyright and trade secret law. SCOUT, Merlin AI, ConciergePlus, Prisma, Parity, Camelot Central, and Camelot OS are proprietary platforms. This Report is for informational and proposal discussion purposes only and does not constitute legal, financial, insurance, construction, or investment advice. Data is sourced from Connecticut public-record paths, Monroe municipal/land/assessor records, HOA-supplied documents when available, listing/market references, and third-party databases and is presented &ldquo;as is&rdquo; without warranty. Final terms, scope, field-operations cadence, and governing law are controlled by the executed management or consulting agreement.`
  : `\u00A9 ${new Date().getFullYear()} Camelot Realty Group. All rights reserved. Contents are protected by U.S. copyright and trade secret law. SCOUT, Jackie, Merlin AI, ConciergePlus, Prisma, Parity, and Camelot Central are proprietary platforms. This Report is for informational purposes only and does not constitute legal, financial, or investment advice. Data is sourced from NYC Open Data, ACRIS, StreetEasy, RealtyMX, and other third-party databases and is presented &ldquo;as is&rdquo; without warranty. AI-assisted analysis has been reviewed by licensed real estate professionals. Governed by the laws of the State of New York; venue in New York County.`}</p>
<div style="text-align:center;margin-top:16px">
<a href="${LEGAL_TERMS_URL}" target="_blank" rel="noopener" style="display:inline-block;background:#A89035;color:#fff;padding:10px 28px;border-radius:6px;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:0.5px">Request Full Legal Terms</a>
<div style="font-size:10px;color:#777;margin-top:8px">info@camelot.nyc · www.camelot.nyc</div>
</div>
</div>

<div style="background:#3A4B5B;border-radius:8px;padding:14px 18px;color:#fff;text-align:center">
<p style="font-size:11px;color:rgba(255,255,255,0.6)">Questions about this Report? Contact:</p>
<p style="font-size:12px;color:#A89035;font-weight:600;margin-top:4px">${CAMELOT.principal} &nbsp;\u00B7&nbsp; ${CAMELOT.email} &nbsp;\u00B7&nbsp; ${CAMELOT.phone}</p>
<p style="font-size:9px;color:rgba(255,255,255,0.35);margin-top:4px">${CAMELOT.license1} &nbsp;\u00B7&nbsp; ${CAMELOT.license2}</p>
</div>
</div>

<!-- PAGE 25: BACK COVER -->
<div class="back-cover" style="background:#3A4B5B;position:relative;overflow:hidden">

<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(58,75,91,0.4) 0%,rgba(58,75,91,0.95) 40%,rgba(58,75,91,1) 70%)"></div>

<!-- Content -->
<div style="position:relative;z-index:1">

<!-- Jacqueline Kennedy / Camelot note -->
<div style="display:grid;grid-template-columns:150px 1fr;gap:28px;align-items:center;max-width:690px;margin:0 auto 28px;text-align:left">
<div style="width:150px;height:190px;border:1px solid rgba(168,144,53,0.48);background:rgba(255,255,255,0.08);box-shadow:0 18px 42px rgba(0,0,0,0.28);overflow:hidden">
<img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Jackie_Kennedy_Color_Portrait.jpg?width=520" alt="Jacqueline Kennedy portrait" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.parentElement.innerHTML='<div style=&quot;height:190px;display:flex;align-items:center;justify-content:center;background:#2C3240;color:#A89035;font-size:10px;font-weight:800;text-align:center;padding:12px&quot;>Jacqueline Kennedy</div>'">
</div>
<div>
<div style="font-family:'Cardo',Georgia,serif;font-style:italic;font-size:24px;color:#fff;line-height:1.38;font-weight:400;letter-spacing:0.2px;text-shadow:0 2px 12px rgba(0,0,0,0.22)">&ldquo;Don't let it be forgot, that for one brief, shining moment there was a Camelot.&rdquo;</div>
<div style="font-family:'Cardo',Georgia,serif;font-style:italic;font-size:17px;color:rgba(255,255,255,0.82);line-height:1.45;margin-top:10px">&ldquo;There will be great presidents again but there will never be another Camelot.&rdquo;</div>
<div style="font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:13px;color:#A89035;font-weight:700;margin-top:10px">Jackie Kennedy</div>
<div style="font-size:9px;color:rgba(255,255,255,0.38);letter-spacing:1px;text-transform:uppercase;margin-top:3px">Referencing the Broadway musical Camelot and President Kennedy's administration</div>
<div style="font-family:'Cardo',Georgia,serif;font-size:31px;color:#D5B24A;line-height:1.18;font-weight:600;letter-spacing:0.2px;text-shadow:0 2px 12px rgba(0,0,0,0.22);margin-top:18px;text-align:center">New Yorkers for New Yorkers.<br>A management partner for a New Yorker&rsquo;s state of mind.</div>
<div style="margin:16px auto 0;padding-top:14px;border-top:1px solid rgba(168,144,53,0.25);font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:11.5px;color:rgba(255,255,255,0.72);line-height:1.7;font-style:normal;text-align:center;max-width:560px">
Camelot's vision, core values, and mission resonate with that spirit: service that feels thoughtful, distinctive, and worthy of the communities we are trusted to protect. Camelot combines senior attention, practical technology, in-house accounting, and hands-on property management so clients have clearer answers, faster response, and a stronger&nbsp;operating&nbsp;partner.
</div>
</div>
</div>
<!-- Divider -->
<div style="width:80px;height:2px;background:#A89035;margin:0 auto 28px;opacity:0.5"></div>

<!-- Next Steps -->
<h2 style="font-size:28px;margin-bottom:12px">Next Steps</h2>
<div class="tagline" style="margin-bottom:24px">We welcome the opportunity to discuss ${d.buildingName}&rsquo;s<br>needs and refine our proposal to fit your building.</div>

<!-- Meeting CTA — Three Options -->
<div style="display:flex;gap:10px;justify-content:center;margin-bottom:16px;flex-wrap:wrap">
<a href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Camelot+%E2%80%93+${encodeURIComponent(d.buildingName)}+Management+Discussion&details=${encodeURIComponent("Meeting with David A. Goldoff, President\nCamelot Realty Group\n\nJoin via Zoom:\nhttps://us06web.zoom.us/j/dgoldoff\n\nOr dial: +1 (646) 558-8656\n\nAgenda: Management proposal discussion for " + d.buildingName + "\n\nPrepared by Camelot Realty Group | Camelot OS")}&location=${encodeURIComponent("Zoom Meeting — https://us06web.zoom.us/j/dgoldoff")}&add=${CAMELOT.email}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:#2D8CFF;color:#fff;padding:12px 20px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:0.3px">
<span style="font-size:15px">\uD83D\uDCC5</span> Schedule Meeting
</a>
<a href="https://zoom.us/start/videomeeting" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;background:#1f6feb;color:#fff;padding:12px 20px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:0.3px">
<span style="font-size:15px">\uD83D\uDCBB</span> Zoom
</a>
<a href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Camelot+%E2%80%93+${encodeURIComponent(d.buildingName)}+Discussion&details=${encodeURIComponent("Meeting with David A. Goldoff\nCamelot Realty Group\n(212) 206-9939\n\nGoogle Meet link will be generated automatically.\n\nAgenda: Management proposal for " + d.buildingName)}&add=${CAMELOT.email}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:#A89035;color:#fff;padding:12px 20px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:0.3px">
<span style="font-size:15px">\uD83D\uDCC5</span> Google Meet
</a>
<a href="tel:+12122069939;ext=701" style="display:inline-flex;align-items:center;gap:8px;background:#1D3A4F;color:#fff;padding:12px 20px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:0.3px">
<span style="font-size:15px">\u260E\uFE0F</span> Call 212-206-9939 x701
</a>
<a href="mailto:info@camelot.nyc?subject=${encodeURIComponent('Meeting Request — ' + d.buildingName + ' | Camelot Realty Group')}&body=${encodeURIComponent('Hello David,\n\nI would like to schedule a meeting to discuss the management proposal for ' + d.buildingName + ' at ' + d.address + '.\n\nPlease let me know your available dates and preferred meeting format (in-person, Zoom, or phone).\n\nBest regards')}" onclick="try{window.location.href=this.href}catch(e){window.open(this.href)};return false;" style="display:inline-flex;align-items:center;gap:8px;background:transparent;color:#A89035;padding:12px 20px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:0.3px;border:2px solid #A89035">
<span style="font-size:15px">\u2709\uFE0F</span> Email to Schedule
</a>
</div>
<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:20px">Choose your preferred format \u2014 or reply to this report\u2019s email and we\u2019ll coordinate</div>

<!-- Contact -->
<div class="contact-name">${CAMELOT.principal}, ${CAMELOT.title}</div>
<div class="contact-info">${CAMELOT.phone} ext. 701<br><a href="mailto:${CAMELOT.email}">${CAMELOT.email}</a> | <a href="mailto:${CAMELOT.infoEmail}">${CAMELOT.infoEmail}</a><br><a href="https://${CAMELOT.web}">${CAMELOT.web}</a></div>
<div class="address">${CAMELOT.address}</div>
<div style="font-size:9px;color:rgba(255,255,255,0.2);margin-top:12px">${CAMELOT.license1} | ${CAMELOT.license2}</div>

</div>
</div>

<div class="deck-slide dark">
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:520px;text-align:center;padding:40px 64px">
<img src="https://www.camelot.nyc/wp-content/uploads/2015/03/Camelot-logo-footer-white.png" alt="Camelot Realty Group" style="width:310px;max-width:72%;height:auto;margin-bottom:54px" onerror="this.style.display='none'">
<h2 class="deck-title center" style="font-size:58px;margin-bottom:24px">Thank You</h2>
<p style="font-size:20px;line-height:1.45;max-width:650px;margin-bottom:22px">We look forward to serving the ${safe(d.buildingName)} community.</p>
<div style="width:92px;height:2px;background:#B8973A;margin:4px auto 22px"></div>
<p style="font-size:16px;line-height:1.7;max-width:680px;color:rgba(255,255,255,0.72)">Hands-on property management, disciplined financial oversight, practical technology, and New York accountability for buildings that want clearer reporting, faster response, and senior attention.</p>
</div>
</div>

</div>

<!-- FLOATING PROPOSAL BUTTON -->
<div style="position:fixed;bottom:32px;right:32px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px" class="no-print">
<button onclick="generateProposal()" style="background:linear-gradient(135deg,#A89035,#C5A55A);color:#fff;border:none;padding:16px 28px;border-radius:50px;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(168,144,53,0.4);display:flex;align-items:center;gap:10px;transition:all 0.3s;letter-spacing:0.3px" onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 6px 28px rgba(168,144,53,0.5)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 4px 20px rgba(168,144,53,0.4)'">
\uD83D\uDCCB Proposal of Services
</button>
</div>

<script>
function generateProposal() {
  var d = {
    buildingName: ${JSON.stringify(d.buildingName)},
    address: ${JSON.stringify(d.address)},
    borough: ${JSON.stringify(d.borough)},
    units: ${d.units},
    yearBuilt: ${d.yearBuilt},
    buildingClass: ${JSON.stringify(d.buildingClass)},
    propertyType: ${JSON.stringify(d.propertyType)},
    stories: ${d.stories},
    buildingArea: ${d.buildingArea},
    buildingArea_fmt: '${d.buildingArea > 0 ? d.buildingArea.toLocaleString() : ""}',
    managementCompany: ${JSON.stringify(d.managementCompany || '')},
    registrationOwner: ${JSON.stringify(d.registrationOwner || '')},
    dofOwner: ${JSON.stringify(d.dofOwner || '')},
    bbl: ${JSON.stringify(d.bbl || '')},
    violationsOpen: ${d.violationsOpen},
    violationsTotal: ${d.violationsTotal},
    violationClassC: ${d.violationClassC},
    violationClassB: ${d.violationClassB},
    ecbCount: ${d.ecbCount},
    ecbPenaltyBalance: ${d.ecbPenaltyBalance},
    scoutGrade: ${JSON.stringify(d.scoutGrade)},
    isRentStabilized: ${d.isRentStabilized},
    pricePerUnit: ${d.pricePerUnit},
    monthlyFee: ${d.monthlyFee},
    annualFee: ${d.annualFee},
    boardMembers: ${JSON.stringify(d.boardMembers || [])},
    buildingStaff: ${JSON.stringify(d.buildingStaff || [])},
    ll97Status: ${JSON.stringify(d.ll97?.complianceStatus || 'unknown')},
    ll97Penalty: ${d.ll97?.period1Penalty || 0},
    hasActiveLitigation: ${d.hasActiveLitigation},
    litigationCount: ${d.litigationCount},
    permitsCount: ${d.permitsCount},
    lastSaleDate: ${JSON.stringify(d.lastSaleDate || '')},
    lastSalePrice: ${d.lastSalePrice},
    distressLevel: ${JSON.stringify(d.distressLevel || 'low')},
    energyStarScore: ${d.energyStarScore || 0},
    latitude: ${d.latitude || 'null'},
    longitude: ${d.longitude || 'null'},
    date: ${JSON.stringify(d.date)},
  };

  // Title case helper
  function titleCase(s) {
    if (!s) return '';
    return s.toLowerCase().replace(/(?:^|\s|[-/])\S/g, function(c){ return c.toUpperCase(); })
      .replace(/\b(Ny|Nyc|Nj|Ct|Llc|Corp|Inc|Hpd|Mdr|Dob)\b/gi, function(c){ return c.toUpperCase(); })
      .replace(/\bOf\b/g, 'of').replace(/\bThe\b/g, 'the').replace(/\bAnd\b/g, 'and')
      .replace(/^./, function(c){ return c.toUpperCase(); });
  }
  // Clean owner — remove "(HPD MDR)", "Corporate Owner", etc.
  var rawOwner = d.registrationOwner || d.dofOwner || '';
  var cleanOwner = rawOwner.replace(/\(HPD[^)]*\)/gi, '').replace(/,?\s*Corporate Owner/gi, '').replace(/\s+/g, ' ').trim();
  var owner = cleanOwner || (d.propertyType.indexOf('Co-op') >= 0 ? 'Board of Directors' : d.propertyType.indexOf('Condo') >= 0 ? 'Board of Managers' : 'Property Owner');
  owner = titleCase(owner);
  var boardNames = (d.boardMembers || []).map(function(b){ return b.name + (b.title ? ', ' + b.title : ''); });
  // Contact name: use first board member, or fallback to generic board greeting
  var hasRealContact = boardNames.length > 0 && boardNames[0].split(',')[0].trim().length > 2;
  var contactName = hasRealContact ? titleCase(boardNames[0].split(',')[0]) : '';
  var greetingName = contactName || (d.propertyType.indexOf('Co-op') >= 0 ? 'Members of the Board' : d.propertyType.indexOf('Condo') >= 0 ? 'Members of the Board' : owner);
  var buildingNameClean = titleCase(d.buildingName);
  var addressClean = titleCase(d.address);
  var boroughClean = titleCase(d.borough || 'New York');
  var isCoop = d.propertyType.indexOf('Co-op') >= 0;
  var isCondo = d.propertyType.indexOf('Condo') >= 0;
  var isBoard = isCoop || isCondo;
  var boardLabel = isCoop ? 'Board of Directors' : isCondo ? 'Board of Managers' : 'Ownership';
  var ownerLabel = isCoop ? 'shareholders' : isCondo ? 'unit owners' : 'residents';
  var chargeLabel = isCoop ? 'maintenance' : isCondo ? 'common charges' : 'rent';
  var agreementType = isCoop ? 'Co-op' : isCondo ? 'Condo' : 'Property';
  var unitDesc = d.units + (d.propertyType.toLowerCase().indexOf('mixed') >= 0 ? ' residential and commercial' : ' residential') + ' units';
  var bblRaw = (d.bbl || '').replace(/[^0-9]/g, '');
  var blockCode = bblRaw.length >= 10 ? String(parseInt(bblRaw.substring(1, 6), 10)) : '';
  var lotCode = bblRaw.length >= 10 ? String(parseInt(bblRaw.substring(6, 10), 10)) : '';
  var blockLotLabel = blockCode && lotCode ? 'Block ' + blockCode + ' / Lot ' + lotCode : (d.bbl || 'To be confirmed');
  var squareFeetLabel = d.buildingArea > 0 ? d.buildingArea.toLocaleString() + ' SF' : 'To be confirmed';
  function filePart(value) {
    return String(value || '')
      .replace(/&amp;/g, 'and')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90);
  }
  var proposalNow = new Date();
  var proposalDateStamp = proposalNow.toISOString().slice(0, 10);
  var proposalVersion = 'Proposal-Version-v' + proposalNow.getFullYear() + '.' + ('0' + (proposalNow.getMonth() + 1)).slice(-2) + '.1';
  var addressPart = addressClean || buildingNameClean || 'Property';
  var namePart = buildingNameClean && buildingNameClean !== addressClean ? buildingNameClean : '';
  var proposalSubjectParts = [];
  if (namePart) proposalSubjectParts.push(filePart(namePart));
  proposalSubjectParts.push(filePart(addressPart));
  var proposalFileBase = ['Proposal-of-Property-Management-Services'].concat(proposalSubjectParts).concat([filePart(proposalVersion), proposalDateStamp]).filter(Boolean).join('__');
  var proposalHtmlFile = proposalFileBase + '.html';
  var proposalPdfFile = proposalFileBase + '.pdf';
  var contactEmail = '';
  for (var i = 0; i < (d.boardMembers || []).length; i += 1) {
    if (d.boardMembers[i] && d.boardMembers[i].email) {
      contactEmail = d.boardMembers[i].email;
      break;
    }
  }
  var emailSubject = 'Proposal of Property Management Services - ' + addressPart;
  var emailBody = 'Dear ' + greetingName + ',\\n\\nPlease find the Camelot Proposal of Property Management Services for ' + addressPart + '.\\n\\nSuggested PDF file name: ' + proposalPdfFile + '\\n\\nWarm regards,\\nDavid A. Goldoff\\nPresident\\nCamelot Property Management Services Corp.\\n(212) 206-9939 x701\\ninfo@camelot.nyc';
  var emailHref = 'mailto:' + encodeURIComponent(contactEmail) + '?subject=' + encodeURIComponent(emailSubject) + '&body=' + encodeURIComponent(emailBody);

  // Dynamic pain points for Management Philosophy section
  var painPoints = [];
  if (d.violationsOpen > 10) painPoints.push('Accumulation of ' + d.violationsOpen + ' open violations' + (d.violationClassC > 0 ? ' including ' + d.violationClassC + ' hazardous (Class C)' : ''));
  if (d.ecbPenaltyBalance > 5000) painPoints.push('$' + d.ecbPenaltyBalance.toLocaleString() + ' in outstanding ECB penalties');
  if (d.ll97Status === 'non-compliant') painPoints.push('LL97 carbon compliance exposure ($' + d.ll97Penalty.toLocaleString() + '/yr potential penalty)');
  if (d.hasActiveLitigation) painPoints.push('Active litigation (' + d.litigationCount + ' case' + (d.litigationCount > 1 ? 's' : '') + ')');
  if (d.distressLevel === 'high' || d.distressLevel === 'critical') painPoints.push('Elevated distress indicators across multiple categories');
  var painHTML = painPoints.length > 0
    ? '<ul>' + painPoints.map(function(p){ return '<li>' + p + '</li>'; }).join('') + '</ul>'
    : '<p>While the building is in reasonable standing, there are always opportunities to improve operations, reduce costs, and enhance the experience for ' + ownerLabel + '.</p>';

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proposal of Property Management Services \u2014 ' + addressPart + ' \u2014 ' + proposalVersion + ' \u2014 ' + proposalDateStamp + '</title>' +
  '<style>' +
  '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
  'body { counter-reset: proposal-page; font-family: Georgia, "Times New Roman", serif; color: #2C3240; line-height: 1.58; font-size: 11px; max-width: 8.5in; margin: 0 auto; padding: 1.55in .72in .68in; }' +
  'h1 { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 800; color: #111; text-align: center; margin: 20px 0 4px 0; letter-spacing: 1.2px; }' +
  'h2 { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 800; color: #A89035; margin: 18px 0 7px 0; padding-bottom: 4px; border-bottom: 1.5px solid #A89035; text-transform: uppercase; letter-spacing: 0.7px; }' +
  'h3 { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 800; color: #111; margin: 13px 0 4px 0; }' +
  '.cover-title { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 12px; color: #A89035; text-align: center; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px; }' +
  'p { margin-bottom: 8px; text-align: justify; }' +
  '.cover-letter-page { min-height: calc(11in - 1.76in); display:flex; flex-direction:column; justify-content:flex-start; }' +
  '.cover-letter-page p { font-size:11.2px; line-height:1.68; }' +
  '.section-intro { font-size: 11.2px; color:#3A4B5B; line-height:1.65; margin: 2px 0 9px; text-align:left; }' +
  'ul { margin: 6px 0 10px 18px; }' +
  'ul li { margin-bottom: 4px; }' +
  '.hr { border: none; border-top: 1.5px solid #A89035; margin: 16px 0; }' +
  '.fee-box { background: #F5F0E5; border-left: 3px solid #A89035; padding: 12px 16px; margin: 10px 0; }' +
  '.fee-box strong { color: #A89035; }' +
  '.price { color:#111; font-weight:900; text-decoration: underline; text-decoration-color:#A89035; text-underline-offset: 2px; }' +
  '.proposal-action-bar { position: fixed; top: 0; left: 0; right: 0; min-height: 46px; padding: 8px 18px; background:#2C3240; color:#fff; display:flex; align-items:center; justify-content:space-between; gap:12px; z-index: 30; box-shadow:0 2px 12px rgba(0,0,0,.18); font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; }' +
  '.proposal-action-title { font-size:11px; letter-spacing:.35px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }' +
  '.proposal-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; }' +
  '.proposal-action-btn { border:1px solid rgba(255,255,255,.25); border-radius:7px; padding:8px 12px; color:#fff; background:#3A4B5B; text-decoration:none; font-size:11px; font-weight:800; cursor:pointer; line-height:1; display:inline-flex; align-items:center; gap:6px; }' +
  '.proposal-action-btn.gold { background:#A89035; border-color:#C9A12C; }' +
  '.proposal-action-btn.light { background:#fff; color:#2C3240; border-color:#fff; }' +
  '.proposal-header { position: fixed; top: 46px; left: 0; right: 0; height: .9in; padding: .11in .55in .1in; border-bottom: 1px solid #D5D0C6; background: #fff; display:flex; align-items:center; justify-content:space-between; gap:18px; z-index: 10; }' +
  '.proposal-header .brand-box { width: 1.9in; height: .68in; background:#C9A12C; overflow:hidden; border:1px solid #B48D22; display:flex; align-items:center; justify-content:center; }' +
  '.proposal-header .brand-box img { width:100%; height:100%; object-fit:cover; object-position:center; display:block; }' +
  '.proposal-header .hdr-contact { font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:8.8px; line-height:1.45; letter-spacing:.35px; color:#2C3240; text-align:right; }' +
  '.proposal-header .hdr-contact strong { color:#A89035; text-transform:uppercase; letter-spacing:1.2px; }' +
  '.proposal-footer { position: fixed; bottom: 0; left: 0; right: 0; height: .42in; padding: .08in .55in; border-top: 1px solid #D5D0C6; background:#fff; display:flex; align-items:center; justify-content:space-between; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:8.5px; color:#777; z-index:10; }' +
  '.proposal-footer .page-num::after { content: counter(page); }' +
  '.fact-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; margin: 10px 0 12px; padding:10px 12px; background:#F8F6EF; border:1px solid #D5D0C6; }' +
  '.fact-grid div { font-size:10px; } .fact-grid strong { color:#111; }' +
  '.sig-row { display: flex; gap: 40px; margin-top: 14px; }' +
  '.sig-col { flex: 1; }' +
  '.sig-line { border-bottom: 1px solid #2C3240; height: 28px; margin-bottom: 2px; }' +
  '.type-sign { border:1px solid #D5D0C6; background:#fff; padding:8px; min-height:34px; margin: 8px 0 2px; color:#999; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; font-size:10px; }' +
  '.phase { background: #F5F0E5; border-left: 3px solid #3A4B5B; padding: 10px 14px; margin: 8px 0; }' +
  '.phase-title { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-weight: 700; color: #3A4B5B; font-size: 11px; margin-bottom: 4px; }' +
  '.page-break { break-before: page; page-break-before: always; height:0; }' +
  'h2, h3, .fee-box, .phase, .fact-grid, .sig-row { break-inside: avoid; page-break-inside: avoid; }' +
  'table, tr, td, th { break-inside: avoid; page-break-inside: avoid; }' +
  '.signature-page { min-height: 8.2in; display:flex; flex-direction:column; justify-content:center; }' +
  '@media print { @page { size: letter; margin: .72in .62in .58in; } body { padding: 1.05in 0 .55in; max-width: none; font-size: 11px; } .proposal-action-bar{display:none!important}.proposal-header,.proposal-footer{position:fixed} .proposal-header{top:0;height:.78in;padding:.08in 0 .08in}.proposal-footer{height:.34in;padding:.06in 0}.page-break{break-before:page;page-break-before:always} }' +
  '</style></head><body>' +
  '<div class="proposal-action-bar no-print"><div class="proposal-action-title"><strong>Proposal of Property Management Services</strong> &middot; ' + addressPart + ' &middot; ' + proposalVersion + ' &middot; ' + proposalDateStamp + '</div><div class="proposal-actions">' +
  '<button class="proposal-action-btn gold" onclick="window.print()">Print / Save PDF</button>' +
  '<button class="proposal-action-btn light" onclick="window.print()">Save as PDF</button>' +
  '<button class="proposal-action-btn" onclick="(function(){var blob=new Blob([document.documentElement.outerHTML],{type:&quot;text/html;charset=utf-8&quot;});var url=URL.createObjectURL(blob);var a=document.createElement(&quot;a&quot;);a.href=url;a.download=&quot;' + proposalHtmlFile + '&quot;;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},3000);})()">Download HTML</button>' +
  '<a class="proposal-action-btn" href="' + emailHref + '">Email PDF Draft</a>' +
  '</div></div>' +
  '<div class="proposal-header"><div class="brand-box"><img src="./images/camelot-gold-logo.png" alt="Camelot Realty Group" onerror="this.style.display=&quot;none&quot;"></div><div class="hdr-contact"><strong>Camelot Property Management Services Corp.</strong><br>57 West 57th Street, Suite 410, New York, NY 10019<br>Office: (212) 206-9939 x701 &middot; info@camelot.nyc<br>www.camelot.nyc</div></div>' +
  '<div class="proposal-footer"><span>Camelot Property Management Services Corp. &middot; ' + addressClean + '</span><span>Page <span class="page-num"></span></span></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* COVER */
  '<div class="cover-letter-page">' +
  '<h1>' + buildingNameClean + '</h1>' +
  '<div style="text-align:center;font-size:11px;color:#3A4B5B;font-weight:700;letter-spacing:0.5px;margin-bottom:10px">PROPOSAL OF PROPERTY MANAGEMENT SERVICES</div>' +
  '<div style="text-align:center;font-size:10.5px;color:#555;line-height:1.65;margin-bottom:18px">Prepared for the ' + boardLabel + '<br><strong>' + buildingNameClean + '</strong><br>' + addressClean + '</div>' +

  '<div class="hr"></div>' +

  '<p style="font-size:10.5px;color:#555"><strong>Date:</strong> ' + d.date + '<br>' +
  '<strong>To:</strong> ' + boardLabel + '<br>' +
  buildingNameClean + '<br>' +
  (contactName ? 'c/o ' + contactName + (boardNames.length > 0 && boardNames[0].indexOf(',') > 0 ? ', ' + boardNames[0].split(',').slice(1).join(',').trim() : '') : 'c/o ' + owner) + '</p>' +

  '<p><strong>Re: Management Proposal &amp; Scope of Services</strong></p>' +

  '<p>Dear ' + greetingName + ',</p>' +

  '<p>We want to thank you for the opportunity to present this management proposal and for your time in discussing the future of ' + buildingNameClean + '. Following our review of the property, Camelot Property Management Services Corp. is pleased to submit this summary outlining our scope of services, dedicated team, and transition plan for the property\u2019s continued success.</p>' +

  '<p>Warm regards,</p>' + ${JSON.stringify(buildDavidGoldoffSignatureHtml({ includeImage: true }))} +

  '<div class="hr"></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* OUR COMMITMENT */
  '</div>' +
  '<div class="page-break"></div>' +

  /* PROPERTY SUMMARY */
  '<h2>Property Summary</h2>' +
  '<p class="section-intro">The property summary below anchors the proposal to the subject building and keeps factual assumptions separate from the cover letter. Any public-record conflicts should be reconciled during transition before final operating budgets or service assumptions are locked.</p>' +
  '<div class="fact-grid">' +
  '<div><strong>Property:</strong> ' + addressClean + '</div>' +
  '<div><strong>BBL / Block-Lot:</strong> ' + (d.bbl || 'To be confirmed') + ' &middot; ' + blockLotLabel + '</div>' +
  '<div><strong>Asset Type:</strong> ' + agreementType + ' / ' + titleCase(d.propertyType) + '</div>' +
  '<div><strong>Units:</strong> ' + d.units + '</div>' +
  '<div><strong>Square Footage:</strong> ' + squareFeetLabel + '</div>' +
  '<div><strong>Year Built:</strong> ' + (d.yearBuilt || 'To be confirmed') + '</div>' +
  '</div>' +

  '<div class="hr"></div>' +

  '<h2>Our Commitment</h2>' +
  '<p class="section-intro">This section frames the management philosophy behind the proposal: senior accountability, practical communication, financial discipline, and a service model that fits the actual building rather than a generic package.</p>' +
  '<p>Camelot\u2019s mission is to provide a boutique, hands-on management approach tailored to the needs of your ' + (isCoop ? 'cooperative' : isCondo ? 'condominium' : 'property') + '. Our team brings a \u201Cwhite-glove\u201D service model \u2014 designed to strengthen on-site operations, enhance financial clarity, and create long-term value for all ' + ownerLabel + '.</p>' +

  '<div class="hr"></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* DEDICATED MANAGEMENT TEAM */
  '<h2>Dedicated Management Team</h2>' +
  '<p class="section-intro">Camelot assigns a role-based management bench so the board understands who is accountable for management, accounting, compliance, facilities, resident communication, technology, and transition follow-through without locking the proposal to individual staff names before final onboarding.</p>' +
  '<ul>' +
  '<li><strong>On-Site Oversight</strong> \u2014 Property managers and facility managers provide site visits, field follow-up, photo documentation, vendor coordination, and practical oversight of staff, residents, contractors, and recurring maintenance issues.</li>' +
  '<li><strong>Board Support</strong> \u2014 A senior co-op / condo leadership role will lead ' + (isBoard ? 'board meetings' : 'ownership meetings') + ', support assistant managers when needed, coordinate action items, and enable AI-assisted meeting minutes, summaries, and follow-up tracking.</li>' +
  '<li><strong>Dedicated AI Agent &amp; Administrative Layer</strong> \u2014 Camelot supports the management team with an AI administrative agent, third-party software, automation, and resident-portal workflows that help answer routine questions, route requests, track tickets, organize documents, and reduce avoidable back-and-forth.</li>' +
  '<li><strong>Resident Management Services</strong> \u2014 Resident-facing tools may include a payment portal, work orders, administrative tickets, resident notices, board and staff file access, and a cloud depository for building documents available on demand to authorized residents, board members, and staff.</li>' +
  '<li><strong>Accounting &amp; Licensed CPA Advisory</strong> \u2014 Accounting support covers financial reporting, bookkeeping workflows, cash management, budget preparation, tax-return coordination, audit support, and advisory review through licensed CPA resources where separately scoped.</li>' +
  '<li><strong>Legal Advisory Role</strong> \u2014 Camelot can help issue-spot governance, contract, collection, notice, compliance, and closing matters and coordinate with counsel; formal legal work is separately engaged and approved.</li>' +
  '<li><strong>Engineering Advisory Role</strong> \u2014 Engineering advisory support helps with local-law applicability, compliance planning, physical-condition review, and soft budgeting for repairs or capital work; formal engineering services are separately scoped.</li>' +
  '<li><strong>Insurance &amp; Mortgage Services</strong> \u2014 Camelot works with licensed insurance and mortgage providers as strategic partners for coverage reviews, refinancing, credit lines, capital-improvement financing, and lender or carrier coordination where requested.</li>' +
  '<li><strong>Project Management</strong> \u2014 Licensed, bonded project-management resources can help manage, direct, and lead capital improvements, bid leveling, vendor coordination, schedules, punch lists, change orders, closeout, and board reporting under a separate approved scope.</li>' +
  '</ul>' +

  '<div class="hr"></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* SCOPE OF SERVICES */
  '<h2>Scope of Services &amp; Value Proposition</h2>' +
  '<p class="section-intro">The scope below reflects the core duties of professional property management: collect income, control expenses, manage vendors, support the board, protect compliance, and communicate clearly with residents or shareholders.</p>' +
  '<ul>' +
  '<li>Strengthen and supervise the on-site management office and staff.</li>' +
  '<li>Review and optimize vendor contracts (elevator, HVAC, boiler, security, waste, cleaning, etc.) using Camelot\u2019s preferred vendor network.</li>' +
  '<li>Implement structured maintenance &amp; compliance calendars for all NYC-required inspections and filings.</li>' +
  '<li>Provide monthly financial management including bank reconciliation, budget forecasting, and ' + (isCoop ? 'maintenance' : isCondo ? 'assessment' : 'rent') + ' tracking.</li>' +
  '<li>Introduce <strong>BankUnited</strong> for reserve and operating accounts \u2014 offering no fees and higher interest rates.</li>' +
  '<li>Roll out Camelot\u2019s <strong>Work Order and Resident Portal</strong> for service tracking and communications.</li>' +
  '<li>Offer project supervision, capital planning, and consulting on major repairs.</li>' +
  '<li>Prepare and distribute monthly ' + (isBoard ? 'board' : 'owner') + ' packages, meeting minutes, and management reports.</li>' +
  '<li>Facilitate ' + (isBoard ? 'board' : 'owner') + ' meetings in-person or via Zoom, using our <strong>AI-assisted meeting software</strong> to record, summarize, and generate formal minutes \u2014 a complimentary value-add service.</li>' +
  '<li>Coordinate with existing professionals (legal, engineering, architectural) while introducing cost-saving alternatives.</li>' +
  '<li>Act as the buffer between residents and ' + (isBoard ? 'the board' : 'ownership') + ', handling inquiries, notices, and building communications.</li>' +
  '<li>Upkeep and removal of building violations, filing registrations, permits, and coordination of on-site inspections.' + (d.violationsOpen > 0 ? ' <em>(' + d.violationsOpen + ' currently open)</em>' : '') + '</li>' +
  '<li>24-hour call center for emergencies and off-hours requests, tracked and recorded.</li>' +
  '<li>Review and suggest technology upgrades: intercoms, virtual doorman, package management, key fob systems.</li>' +
  '<li>Bookkeeping, monthly financial reporting, end-of-year reports, tax appeal preparation, ' + (isCondo ? 'condo abatement' : isCoop ? 'co-op abatement' : 'abatement') + ' submissions, invoicing, cash-flow analysis, and budgeting.</li>' +
  '</ul>' +

  '<div class="hr"></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* FINANCIAL TERMS */
  '<h2>Financial Terms</h2>' +
  '<p class="section-intro">The proposed fee is based on the full property profile: address, asset type, unit count, square footage, current service burden, reporting expectations, technology needs, and transition complexity. Ancillary items are governed by Schedule A to the management agreement.</p>' +
  '<div class="fee-box">' +
  '<strong>Camelot Intelligence Management Fee:</strong> <span class="price">$' + d.monthlyFee.toLocaleString() + ' per month</span> (<span class="price">$' + d.annualFee.toLocaleString() + ' annually</span>)<br>' +
  '<strong>Property Basis:</strong> ' + addressClean + ' &middot; ' + unitDesc + ' &middot; ' + titleCase(d.propertyType) + ' &middot; ' + squareFeetLabel + ' &middot; ' + blockLotLabel + '<br>' +
  '<strong>Fee Basis:</strong> Flat fee based on building type, size, and service tier. Annual escalation of <span class="price">3%&ndash;5%</span> as agreed upon by board and management.<br>' +
  '<strong>Ancillary Fees:</strong> As outlined in Schedule A of the management agreement<br>' +
  '<strong>Accounting:</strong> Monthly management reporting is part of the selected service package. Tax returns, audit work, deeper CPA consulting, or special accounting projects may be discounted after further discussion with the client and their needs, but are separately scoped when engaged.<br>' +
  '<strong>Technology:</strong> Camelot recommends the Intelligence Package because Camelot OS, ConciergePlus, meeting summaries, reporting tools, and related technology are packaged into the service model rather than waived as a free add-on.' +
  '</div>' +

  '<div class="hr"></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* TRANSITION PLAN */
  '<h2>Transition Plan &amp; Start Date</h2>' +
  '<p class="section-intro">Transition is where management changes either become orderly or become frustrating. Camelot uses a staged rollout so records, banking, vendors, residents, board reporting, and communication all move under control.</p>' +
  '<p>Camelot is prepared to begin immediately or on a mutually convenient date. Our first 90 days will focus on learning the building\u2019s systems, meeting your staff and vendors, and integrating our accounting and compliance systems for a seamless transition.</p>' +
  '<p>Within the first 30 days, Camelot will schedule a meet-and-greet or town hall, either on-site or by Zoom, so residents and the board can meet the property manager, accounting, compliance, administrative, and senior management team. We believe it is important to put a face to the email before the first issue comes up.</p>' +

  '<div class="hr"></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* CLOSING */
  '<h2>Closing</h2>' +
  '<p class="section-intro">This proposal is intended to give the board a clear view of Camelot&rsquo;s service model, pricing basis, transition approach, and practical next steps before the formal management agreement and Schedule A are finalized.</p>' +
  '<p>We deeply appreciate the opportunity to partner with ' + buildingNameClean + ' and are confident that our experience, resources, and dedicated team will provide measurable improvements in operations, transparency, and service quality.</p>' +
  '<p>We look forward to meeting ' + (isBoard ? 'the full board' : 'you') + ' soon \u2014 either on-site or via Zoom \u2014 and beginning this next chapter together.</p>' +
  '<p style="font-weight:700;text-align:center;color:#3A4B5B;margin-top:18px">Signatures to follow.</p>' +

  /* ACCEPTANCE & SIGNATURES */
  '<div class="page-break"></div>' +
  '<div class="signature-page">' +
  '<h2>Acceptance of Proposal</h2>' +
  '<p>By signing below, both parties acknowledge receipt of this proposal and authorize Camelot Property Management Services Corp. to prepare the final management agreement, Schedule A, transition request, and start-date plan for ' + buildingNameClean + '.</p>' +
  '<p><strong>Proposed Start Date:</strong> _________________________ (or mutually convenient date)</p>' +
  '<div class="sig-row">' +
  '<div class="sig-col">' +
  '<div style="font-size:10px;font-weight:700;color:#3A4B5B;margin-bottom:6px">Authorized ' + (isBoard ? 'Board Member' : 'Representative') + '</div>' +
  '<div class="type-sign">Type full legal name</div><div style="font-size:9px;color:#888">Name</div>' +
  '<div class="type-sign">Type title / board role</div><div style="font-size:9px;color:#888">Title</div>' +
  '<div class="sig-line" style="margin-top:10px"></div><div style="font-size:9px;color:#888">Signature</div>' +
  '<div class="sig-line" style="margin-top:10px;width:180px"></div><div style="font-size:9px;color:#888">Date</div>' +
  '</div>' +
  '<div class="sig-col">' +
  '<div style="font-size:10px;font-weight:700;color:#3A4B5B;margin-bottom:6px">Camelot Property Management Services Corp.</div>' +
  '<div class="type-sign">David A. Goldoff, President</div><div style="font-size:9px;color:#888">Name / Title</div>' +
  '<div class="sig-line" style="margin-top:10px"></div><div style="font-size:9px;color:#888">Signature</div>' +
  '<div class="sig-line" style="margin-top:10px;width:180px"></div><div style="font-size:9px;color:#888">Date</div>' +
  '</div>' +
  '</div>' +
  '<p style="font-size:9.5px;color:#777;text-align:left;margin-top:20px">Digital signature workflow note: this page is structured for PDF signature tools such as DocuSign, Adobe Sign, or typed-signature approval. Final engagement remains subject to the formal management agreement and Schedule A.</p>' +
  '</div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* PAGE 2: TRANSITION ROLLOUT */
  '<div class="page-break"></div>' +

  '<h2>Phase I: Operational Turnaround &amp; Standardization Plan</h2>' +
  '<h3>Scope:</h3>' +
  '<ul>' +
  '<li>Evaluate all building systems, staff performance, and operational contracts.</li>' +
  '<li>Review accounting systems, budgets, and vendor agreements.</li>' +
  '<li>Assess and modernize house rules, by-laws, and compliance practices.</li>' +
  '<li>Transition to a digital reporting and communication platform.</li>' +
  '<li>Conduct cost-savings reviews and vendor negotiations for bulk efficiencies.</li>' +
  '</ul>' +

  '<div class="hr"></div>' +

  '<h2>Transition &amp; Implementation Plan (90\u2013120 Day Rollout)</h2>' +

  '<div class="phase"><div class="phase-title">Phase I: Transition &amp; Assessment (Weeks 1\u20134)</div>' +
  '<ul style="margin-bottom:0">' +
  '<li>Full file and data transfer from current management.</li>' +
  '<li>Staff audit and review of employment, performance, and payroll.</li>' +
  '<li>Vendor contract analysis for cost-saving opportunities.</li>' +
  '<li>Financial reconciliation of operating and reserve accounts.</li>' +
  '<li>Compliance checklist (Local Law 11, 97, FDNY, DOB, HPD).' + (d.violationsOpen > 0 ? ' <em>' + d.violationsOpen + ' open violations identified.</em>' : '') + '</li>' +
  '<li>Initial on-site inspection and management walk-through.</li>' +
  '</ul></div>' +

  '<div class="phase"><div class="phase-title">Phase II: Stabilization &amp; Training (Weeks 5\u20138)</div>' +
  '<ul style="margin-bottom:0">' +
  '<li>On-site review of staff functions and responsibilities.</li>' +
  '<li>Development of written Standard Operating Procedures (SOPs) and House Rules.</li>' +
  '<li>Implementation of internal communication and work order tracking tools.</li>' +
  '<li>Preparation of revised operating budget and variance model.</li>' +
  '<li>Vendor rebidding and negotiation for core contracts.</li>' +
  '<li>Initiation of ' + (isBoard ? 'board' : 'owner') + ' portal and monthly management reporting structure.</li>' +
  '</ul></div>' +

  '<div class="phase"><div class="phase-title">Phase III: Optimization &amp; Reporting (Weeks 9\u201312)</div>' +
  '<ul style="margin-bottom:0">' +
  '<li>Full integration of accounting team and PM into building systems.</li>' +
  '<li>Establishment of resident communication portal and payment integration.</li>' +
  '<li>Compliance audit with engineering team.</li>' +
  '<li>Monthly operational and financial reporting cadence established.</li>' +
  '<li>Presentation to ' + (isBoard ? 'Board' : 'Ownership') + ': \u201C12-Month Improvement Roadmap.\u201D</li>' +
  '</ul></div>' +

  '<div class="hr"></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* CORE MANAGEMENT DUTIES */
  '<h2>Core Management Duties</h2>' +
  '<p class="section-intro">Core management duties are the day-to-day controls that keep the building stable: staff supervision, board support, resident communication, financial controls, vendor accountability, and preventive attention before small issues become expensive ones.</p>' +
  '<ul>' +
  '<li>Supervise on-site staff' + (d.buildingStaff.length > 0 ? ' (' + d.buildingStaff.map(function(s){return s.role;}).join(', ') + ')' : '') + '.</li>' +
  '<li>Conduct weekly property inspections.</li>' +
  '<li>Attend monthly ' + (isBoard ? 'board' : 'owner') + ' meetings and special meetings as needed.</li>' +
  '<li>Maintain optimal accounting controls and systems.</li>' +
  '<li>Oversee vendor contracts, rebids, and procurement.</li>' +
  '<li>Manage compliance, insurance renewals, and certification tracking.</li>' +
  '<li>Coordinate communication between ' + (isBoard ? 'board, ' : '') + 'residents, and vendors.</li>' +
  '<li>Prepare annual budgets and variance reports.</li>' +
  '<li>Implement training programs and develop staff performance metrics.</li>' +
  '</ul>' +

  '<div class="hr"></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* MANAGEMENT PHILOSOPHY */
  '<h2>Management Philosophy &amp; Approach</h2>' +
  '<p>Camelot Realty Group is a boutique, tech-forward, hands-on property management firm with extensive experience managing condominiums, cooperatives, and rental properties across Manhattan, Brooklyn, Queens, the Bronx, Westchester, and beyond. We specialize in implementing modern systems of accountability, financial transparency, and operational efficiency.</p>' +
  '<p>At ' + buildingNameClean + ', we understand the importance of addressing current operational needs' + (painPoints.length > 0 ? ', including:' : '.') + '</p>' +
  painHTML +

  '<div class="hr"></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* FINANCIAL MANAGEMENT */
  '<h2>Financial Management</h2>' +
  '<ul>' +
  '<li><strong>Dual Ledger Accounting:</strong> We separate capital projects from operating expenses, ensuring transparency and accurate tracking.</li>' +
  '<li><strong>Budgeting &amp; Forecasting:</strong> Our accounting team works with ' + (isBoard ? 'the board' : 'ownership') + ' to create realistic annual budgets and five-year reserve forecasts.</li>' +
  '<li><strong>Annual Audits:</strong> We recommend engaging a reputable independent auditor to provide annual assurance of financial health.</li>' +
  '<li><strong>Cash Management:</strong> BankUnited partnership \u2014 zero fees, higher interest rates, automated reconciliations.</li>' +
  '</ul>' +

  '<div class="hr"></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* PROJECT & COMPLIANCE */
  '<h2>Project &amp; Compliance Management</h2>' +
  '<ul>' +
  '<li><strong>Project Management:</strong> In-house project managers oversee vendor bidding, contract negotiations, and capital projects.</li>' +
  '<li><strong>Local Law Compliance:</strong> We manage compliance with NYC Local Laws (LL97, fa\u00E7ade inspections, energy benchmarking, etc.).' + (d.ll97Status === 'non-compliant' ? ' <em>LL97 exposure identified \u2014 $' + d.ll97Penalty.toLocaleString() + '/yr.</em>' : '') + '</li>' +
  '<li><strong>Legal &amp; Risk Mitigation:</strong> We collaborate with building attorneys on litigation and governance strategy.</li>' +
  '<li><strong>Energy &amp; Sustainability:</strong> Monitoring energy usage and implementing conservation programs.' + (d.energyStarScore > 0 ? ' <em>Current ENERGY STAR: ' + d.energyStarScore + '.</em>' : '') + '</li>' +
  '</ul>' +

  '<div class="hr"></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* WHY CAMELOT */
  '<h2>Why Camelot Is the Right Fit</h2>' +
  '<ul>' +
  '<li><strong>Hands-On Leadership:</strong> David Goldoff is personally involved in major client transitions and attends initial ' + (isBoard ? 'board' : 'owner') + ' sessions.</li>' +
  '<li><strong>Specialized Teams:</strong> Accounting, project management, compliance, and senior management all work together.</li>' +
  '<li><strong>Proactive Approach:</strong> We don\u2019t wait for issues to escalate. Preventive maintenance, vendor bidding, and oversight are embedded in our process.</li>' +
  '<li><strong>Tailored Service:</strong> We operate as a boutique firm \u2014 large enough to deliver professional systems but small enough to offer personalized service.</li>' +
  '</ul>' +

  '<div class="hr"></div>' +

  /* ══════════════════════════════════════════════════════════════ */
  /* POST-SIGNATURE: WORKING WITH CAMELOT */
  '<div class="page-break"></div>' +

  '<h2>Next Steps \u2014 Working with Camelot</h2>' +
  '<p>Upon execution of this proposal, Camelot begins a structured onboarding process designed to minimize disruption to residents and staff. Below is our proven 90-day transition and optimization plan.</p>' +

  /* PHASE I */
  '<h2>Phase I \u2014 Discovery &amp; Assessment (Days 1\u201330)</h2>' +
  '<p>The first 30 days are dedicated to deep discovery \u2014 understanding ' + buildingNameClean + ' from every angle.</p>' +
  '<ul>' +
  '<li><strong>Full file and data transfer</strong> from current management. Camelot sends our standard Transitional Documentation outlining all files and information required.</li>' +
  '<li><strong>Transition drive directory</strong> &mdash; Camelot will coordinate a Google Drive transition folder or equivalent secure directory for building documents, with Sam Lodge serving as the transition intake coordinator until full automation is deployed.</li>' +
  '<li><strong>Introductory building inspection</strong> \u2014 Sr. Facilities Manager conducts on-site walkthrough covering property envelope, mechanical systems, deferred maintenance, and capital priorities. Written report delivered for a one-time $500 introductory fee ($2,500 value).</li>' +
  '<li><strong>Financial &amp; budget review</strong> \u2014 Line-item analysis vs. comparable buildings we manage. AR/AP audit, reserve fund assessment, and revenue gap analysis.</li>' +
  '<li><strong>Vendor contract review</strong> \u2014 Priority targets for rebidding: elevator (10\u201318% savings), insurance (12\u201320%), cleaning (8\u201315%), HVAC/boiler (10\u201315%), extermination (10\u201320%), and legal (5\u201310%).</li>' +
  '<li><strong>Compliance checklist</strong> \u2014 HPD registrations, DOB filings, fire safety, LL11/FISP, LL97 carbon compliance' + (d.buildingArea > 25000 ? ' (critical at ' + d.buildingArea.toLocaleString() + ' SF)' : '') + ', and all open violations.</li>' +
  '<li><strong>Staff audit</strong> \u2014 Meet with on-site staff, review employment/payroll, establish written SOPs and weekly task schedules.</li>' +
  '<li><strong>Bank account setup</strong> \u2014 Establish BankUnited accounts (no fees, higher interest), configure automated billing through Zego payment portal.</li>' +
  '<li><strong>Resident notification</strong> \u2014 Formal notice of management change distributed to all ' + ownerLabel + '.</li>' +
  '</ul>' +

  /* PHASE II */
  '<h2>Phase II \u2014 Optimization &amp; Technology (Days 31\u201360)</h2>' +
  '<p>Phase 2 activates our full technology stack and launches vendor optimization. Measurable value creation begins here.</p>' +
  '<ul>' +
  '<li><strong>Technology deployment</strong> \u2014 AppFolio (financials), BuildingLink (resident communications), Zego (payments), Board Packager (digital board packages). ConciergePlus + Camelot AI rollout in 2026.</li>' +
  '<li><strong>Vendor rebidding</strong> \u2014 RFPs issued for all priority categories. 3 competitive bids per category with scope-matched comparisons.</li>' +
  '<li><strong>Insurance review</strong> \u2014 Full coverage audit through independent broker. Competitive quotes targeting 12\u201320% premium reduction.</li>' +
  '<li><strong>Financial systems live</strong> \u2014 AppFolio fully migrated; Zego billing activated; first Camelot monthly report delivered to ' + (isBoard ? 'board' : 'ownership') + '.</li>' +
  '<li><strong>' + (isBoard ? 'Board' : 'Owner') + ' portal launched</strong> \u2014 Contracts, financials, minutes, and documents accessible 24/7 through Board Packager.</li>' +
  '<li><strong>AI board meeting support</strong> \u2014 Meetings recorded, summarized, and formal minutes generated automatically \u2014 complimentary service.</li>' +
  '</ul>' +

  /* PHASE III */
  '<h2>Phase III \u2014 Stabilization &amp; Value Creation (Days 61\u201390)</h2>' +
  '<p>Phase 3 delivers the first measurable proof of value. Vendor contracts are finalized, and ' + (isBoard ? 'the board' : 'ownership') + ' receives a comprehensive 90-day performance report.</p>' +
  '<ul>' +
  '<li><strong>New vendor contracts executed</strong> \u2014 All rebid savings documented and board-approved. Seamless transition with no service interruption.</li>' +
  '<li><strong>Revenue enhancement review</strong> \u2014 Storage, sublets, alterations, flip tax, laundry, and vendor shared revenue opportunities analyzed.</li>' +
  '<li><strong>Resident satisfaction survey</strong> \u2014 Baseline measurement with benchmark comparison and action plan.</li>' +
  '<li><strong>Compliance roadmap delivered</strong> \u2014 LL97 compliance through 2030, energy baseline established, violation clearance plan in progress.</li>' +
  '<li><strong>90-Day Board Presentation</strong> \u2014 Live presentation covering: Financial Health Scorecard, Cost Reduction Summary, Technology Deployment Report, Compliance Dashboard, 12-Month Operating Plan, and Resident Satisfaction Baseline.</li>' +
  '</ul>' +

  /* LONG-TERM */
  '<h2>Ongoing \u2014 Optimization (Months 4\u201318)</h2>' +
  '<ul>' +
  '<li>Full adoption of Camelot automation systems for maintenance requests, vendor payments, and resident communications.</li>' +
  '<li>AI-assisted board meeting transcription and minutes for permanent recordkeeping.</li>' +
  '<li>Review and amend bylaws and house rules to reflect new management procedures.</li>' +
  '<li>Partner with BankUnited to optimize reserve yields and evaluate capital project financing.</li>' +
  '<li>Oversee compliance with Local Laws 11, 33, 97, and 157 (fa\u00E7ade, energy, gas safety).</li>' +
  '<li>Supervise capital improvement projects as prioritized by ' + (isBoard ? 'the board' : 'ownership') + '.</li>' +
  '<li>Explore new income opportunities: storage, roof deck, laundry expansion, amenity leasing.</li>' +
  '<li>Deliver comprehensive Year 1 performance review and recommendations.</li>' +
  '</ul>' +

  /* OUR COMMITMENT */
  '<h2>Our Commitment to ' + buildingNameClean + '</h2>' +
  '<p>Camelot is not the cheapest option \u2014 and we do not aim to be. Our value is the combination of experienced professionals, institutional-quality financial oversight, award-winning management, and a technology infrastructure built specifically for premium residential buildings. Our track record on vendor savings, insurance optimization, LL97 compliance, and resident satisfaction consistently exceeds the cost differential within the first operating year.</p>' +
  '<p style="font-size:10px;color:#A89035;font-weight:700;text-align:center;margin-top:10px">RED Awards \u2014 Property Management Company of the Year &nbsp;\u00B7&nbsp; David Goldoff, REBNY Residential Management Award</p>' +

  '<div class="hr"></div>' +

  /* TRANSITIONAL DOCUMENTS */
  '<h2>Transitional Documents</h2>' +
  '<p>Upon being retained, Camelot will provide our standard Transitional Documentation outlining all files and information required from the outgoing management company. Camelot can provide a Google Drive directory or other secure upload location so the prior management company, board, attorney, accountant, and vendors can deliver files in one organized place.</p>' +
  '<p>Where appropriate, Camelot will prepare the outgoing-manager notice requesting records, bank information, resident/shareholder ledgers, vendor contracts, insurance, payroll, compliance files, open work orders, keys/access information, and all current building documents. Transition intake is currently directed to Sam Lodge, Camelot&rsquo;s office manager and transition coordinator.</p>' +
  '<p>When the board provides supporting materials such as budgets, management reports, competing proposals, violation lists, engineering reports, or correspondence, those items may be included as appendix materials to support the final proposal package.</p>' +
  '<p>All building files and records should be sent to:</p>' +
  '<div style="background:#F5F0E5;border-left:3px solid #A89035;padding:10px 14px;margin:8px 0;font-size:10.5px">' +
  '<strong>Camelot Property Management Services Corp.</strong><br>' +
  'Att: Sam Lodge, Office Manager<br>' +
  '57 West 57th Street, Suite 410, New York, NY 10019<br>' +
  'Email: <a href="mailto:info@camelot.nyc" style="color:#A89035">info@camelot.nyc</a> &nbsp;|&nbsp; Tel: (212) 206-9939' +
  '</div>' +

  '<div class="hr"></div>' +
  '<p style="font-size:9px;color:#888;text-align:center;line-height:1.55">Please refer to our property management agreement for a detailed description of all terms, conditions, and rates.<br>Camelot Property Management Services Corp. &nbsp;&middot;&nbsp; 57 West 57th Street, Suite 410, New York, NY 10019<br>Main: (212) 206-9939 &nbsp;&middot;&nbsp; www.camelot.nyc &nbsp;&middot;&nbsp; Licensed Broker ID #10491200104</p>' +

  '</body></html>';

  var w = window.open('', '_blank');
  if (w && w.document && typeof w.document.write === 'function') {
    w.document.write(html);
    w.document.close();
    // Preview only — user clicks Print button when ready
    // setTimeout(function() { w.print(); }, 800);
    return;
  }

  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = proposalHtmlFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
}
</script>
</body>
</html>`;
  const cleanHtml = html
    .replace(/\b-?Infinity\b/g, 'N/A')
    .replace(/\bNaN\b/g, 'N/A');
  return sanitizeJackieKnownPropertyHtml(cleanHtml, d).data;
}
