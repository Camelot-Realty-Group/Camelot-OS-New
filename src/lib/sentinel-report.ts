import { GOOGLE_MAPS_KEY } from '@/lib/maps-key';
/**
 * Sentinel — Camelot Quarterly Market Intelligence Report Generator
 * 
 * DATA SOURCES (live):
 * - ACRIS: Closed sales data via NYC Open Data API
 * - NYC DOF: Property assessments, valuations
 * - StreetEasy: Scraped median rents, days on market, recent sales
 * 
 * DATA SOURCES (manual input / CSV):
 * - RealtyMX: CSV export → parse for rental velocity, DOM by price band
 * - OneKey MLS: Requires broker RETS feed credentials
 * - REBNY RLS: Requires member access credentials
 */

import {
  NY_OWNERSHIP_HUNT_SOURCE_STACK,
  NY_PEOPLE_ENTITY_COMP_SOURCE_STACK,
  nyOwnershipHuntSummary,
  nyPeopleEntityCompSourceSummary,
} from '@/lib/ny-research-sources';

// ============================================================
// Types
// ============================================================

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

export interface SentinelInput {
  quarter: typeof QUARTERS[number];
  year: number;
  insight1: string; // Building Performance
  insight2: string; // Rental Velocity
  insight3: string; // Rate Sensitivity
  insight4: string; // Rent vs. Buy
  insight5: string; // Neighborhood Value Spectrum
  subjectAddress?: string;
  subjectBorough?: 'Manhattan' | 'Brooklyn' | 'Queens' | 'Bronx' | 'Staten Island' | 'Westchester / Riverdale' | 'New Jersey' | 'Connecticut' | 'Florida' | '';
  subjectAssetClass?: 'Co-op / Condo' | 'Rental' | 'Mixed-Use' | 'HOA / Condo Community' | 'Land / Development' | 'Commercial' | '';
  subjectUnits?: string;
  subjectUnionStatus?: 'Unknown' | 'Union' | 'Non-union' | 'Mixed' | '';
  subjectServiceLevel?: 'Standard / Walk-Up' | 'Elevator' | 'Full-Service / Doorman' | 'Luxury / Amenity' | 'HOA / Field Operations' | '';
  subjectAmenities?: string;
  realtyMxEnabled?: boolean;
}

export const DEFAULT_SENTINEL_INPUT: SentinelInput = {
  quarter: 'Q1',
  year: 2026,
  insight1: '5 of 6 tracked buildings beat their neighborhood median $/sqft',
  insight2: 'Sub-$3,500/mo 1-BRs clearing in under 14 days — demand outpacing supply',
  insight3: 'Every 50bps rate drop unlocks 8–10% more buying power',
  insight4: 'Break-even: 20 yrs in Sunnyside, 38+ yrs in Tribeca',
  insight5: '$/sqft ranges from $660 (Sunnyside) to $2,100 (Tribeca/SoHo)',
  subjectAddress: '',
  subjectBorough: 'Manhattan',
  subjectAssetClass: 'Co-op / Condo',
  subjectUnits: '',
  subjectUnionStatus: 'Unknown',
  subjectServiceLevel: 'Standard / Walk-Up',
  subjectAmenities: '',
  realtyMxEnabled: false,
};

// ============================================================
// Neighborhood Data (from SCOUT — updated quarterly)
// ============================================================

export interface NeighborhoodBenchmark {
  name: string;
  condoPSF: number;
  coopPSF: number;
  medianRent1BR: number;
  medianRent2BR: number;
  daysOnMarket: number;
  investScore: number;
  liveScore: number;
  familyScore: number;
  workScore: number;
  momentum: string;
  opexRange: string;
  yoyChange: number; // % change year over year
}

export const NEIGHBORHOODS: NeighborhoodBenchmark[] = [
  { name: 'East Harlem', condoPSF: 980, coopPSF: 650, medianRent1BR: 3150, medianRent2BR: 4300, daysOnMarket: 16, investScore: 8.0, liveScore: 7.7, familyScore: 7.2, workScore: 7.8, momentum: 'Strong', opexRange: '$20-34', yoyChange: 3.0 },
  { name: 'Upper East Side', condoPSF: 1620, coopPSF: 1140, medianRent1BR: 4600, medianRent2BR: 7200, daysOnMarket: 14, investScore: 6.8, liveScore: 8.8, familyScore: 9.2, workScore: 8.4, momentum: 'Stable', opexRange: '$30–50', yoyChange: 2.1 },
  { name: 'Upper West Side', condoPSF: 1500, coopPSF: 1050, medianRent1BR: 4300, medianRent2BR: 6500, daysOnMarket: 13, investScore: 7.0, liveScore: 8.9, familyScore: 9.0, workScore: 8.0, momentum: 'Stable', opexRange: '$28–44', yoyChange: 1.8 },
  { name: 'Midtown', condoPSF: 1600, coopPSF: 1100, medianRent1BR: 4400, medianRent2BR: 6800, daysOnMarket: 13, investScore: 7.0, liveScore: 7.5, familyScore: 5.5, workScore: 9.5, momentum: 'Stable', opexRange: '$28–45', yoyChange: 1.5 },
  { name: 'Chelsea', condoPSF: 1500, coopPSF: 1100, medianRent1BR: 4100, medianRent2BR: 6000, daysOnMarket: 12, investScore: 7.2, liveScore: 8.6, familyScore: 6.8, workScore: 9.0, momentum: 'Moderate', opexRange: '$27–42', yoyChange: 2.3 },
  { name: 'West Village', condoPSF: 1800, coopPSF: 1300, medianRent1BR: 4800, medianRent2BR: 7500, daysOnMarket: 11, investScore: 6.5, liveScore: 9.3, familyScore: 7.0, workScore: 8.4, momentum: 'Stable', opexRange: '$30–48', yoyChange: 1.2 },
  { name: 'East Village / LES', condoPSF: 1275, coopPSF: 900, medianRent1BR: 3450, medianRent2BR: 4900, daysOnMarket: 12, investScore: 7.3, liveScore: 8.7, familyScore: 6.3, workScore: 8.4, momentum: 'Strong', opexRange: '$23–37', yoyChange: 3.1 },
  { name: 'Tribeca / SoHo', condoPSF: 2100, coopPSF: 1480, medianRent1BR: 5200, medianRent2BR: 8400, daysOnMarket: 10, investScore: 6.4, liveScore: 9.2, familyScore: 8.4, workScore: 8.6, momentum: 'Stable', opexRange: '$33–56', yoyChange: 0.8 },
  { name: 'Brooklyn Heights', condoPSF: 1280, coopPSF: 980, medianRent1BR: 3600, medianRent2BR: 5100, daysOnMarket: 12, investScore: 7.2, liveScore: 9.0, familyScore: 8.8, workScore: 8.2, momentum: 'Stable', opexRange: '$20–34', yoyChange: 2.0 },
  { name: 'Park Slope', condoPSF: 1150, coopPSF: 820, medianRent1BR: 3100, medianRent2BR: 4600, daysOnMarket: 14, investScore: 7.4, liveScore: 9.1, familyScore: 9.4, workScore: 7.8, momentum: 'Moderate', opexRange: '$18–30', yoyChange: 1.6 },
  { name: 'Greenpoint / Williamsburg', condoPSF: 1060, coopPSF: 750, medianRent1BR: 3300, medianRent2BR: 4600, daysOnMarket: 13, investScore: 8.1, liveScore: 8.7, familyScore: 7.6, workScore: 7.6, momentum: 'Strong', opexRange: '$19–31', yoyChange: 3.5 },
  { name: 'Long Island City', condoPSF: 1090, coopPSF: 680, medianRent1BR: 3450, medianRent2BR: 4700, daysOnMarket: 11, investScore: 8.7, liveScore: 8.0, familyScore: 7.2, workScore: 8.8, momentum: 'Very Strong', opexRange: '$15–27', yoyChange: 4.2 },
  { name: 'Sunnyside / Woodside', condoPSF: 660, coopPSF: 430, medianRent1BR: 2400, medianRent2BR: 3100, daysOnMarket: 15, investScore: 8.8, liveScore: 7.6, familyScore: 8.2, workScore: 7.2, momentum: 'Very Strong', opexRange: '$13–24', yoyChange: 5.1 },
];

// ============================================================
// Tracked Buildings (Camelot Portfolio)
// ============================================================

export interface TrackedBuilding {
  name: string;
  address: string;
  neighborhood: string;
  units: number;
  type: string;
  camelotPSF: number;
  neighborhoodPSF: number;
  performance: string;
}

export const TRACKED_BUILDINGS: TrackedBuilding[] = [
  // Confirmed portfolio buildings with verified data
  { name: '949 Park Avenue', address: '949 Park Ave', neighborhood: 'Upper East Side', units: 12, type: 'Condo', camelotPSF: 1750, neighborhoodPSF: 1620, performance: 'Above' },
  { name: '105 E 29th Street', address: '105 E 29th St', neighborhood: 'Midtown', units: 45, type: 'Co-op', camelotPSF: 1180, neighborhoodPSF: 1100, performance: 'Above' },
  { name: '201 E 15th Street', address: '201 E 15th St', neighborhood: 'East Village / LES', units: 32, type: 'Co-op', camelotPSF: 1350, neighborhoodPSF: 1275, performance: 'Above' },
  { name: '165 E 71st Street', address: '165 E 71st St', neighborhood: 'Upper East Side', units: 18, type: 'Condo', camelotPSF: 1690, neighborhoodPSF: 1620, performance: 'Above' },
  { name: '137 Franklin Street', address: '137 Franklin St', neighborhood: 'Tribeca / SoHo', units: 8, type: 'Co-op', camelotPSF: 2050, neighborhoodPSF: 2100, performance: 'At Market' },
  { name: '58 White Street', address: '58 White St', neighborhood: 'Tribeca / SoHo', units: 10, type: 'Co-op', camelotPSF: 2200, neighborhoodPSF: 2100, performance: 'Above' },
];

// ============================================================
// Sentinel v2 - Address-Driven Market Intelligence Rules
// ============================================================

export interface UnitMixBenchmark {
  unitType: string;
  expectedDOM: string;
  rentalSweetSpot: string;
  saleSweetSpot: string;
  slowerMarketSignal: string;
  scoutRead: string;
}

export const SENTINEL_UNIT_MIX_BENCHMARKS: UnitMixBenchmark[] = [
  { unitType: 'Studio', expectedDOM: '10-24 days', rentalSweetSpot: '$2,400-$3,500/mo', saleSweetSpot: '$575K-$850K', slowerMarketSignal: 'Softens fastest when priced above entry-level buyer/renter budgets.', scoutRead: 'Best as affordability inventory; pricing discipline matters more than finish level.' },
  { unitType: '1 Bedroom', expectedDOM: '12-30 days', rentalSweetSpot: '$3,100-$4,800/mo', saleSweetSpot: '$700K-$1.25M', slowerMarketSignal: 'Longer exposure once monthly carry exceeds a comparable rental by too much.', scoutRead: 'Deepest demand pool in Manhattan, Queens, and prime Brooklyn.' },
  { unitType: '2 Bedroom', expectedDOM: '18-45 days', rentalSweetSpot: '$4,500-$7,800/mo', saleSweetSpot: '$1.15M-$2.2M', slowerMarketSignal: 'Pauses when family buyers compare school district, maintenance, and financing limits.', scoutRead: 'Strongest board-facing value signal for livability and resale liquidity.' },
  { unitType: '3 Bedroom', expectedDOM: '35-75 days', rentalSweetSpot: '$7,500-$13,500/mo', saleSweetSpot: '$2.0M-$4.5M', slowerMarketSignal: 'Highly finish-sensitive; buyers punish awkward layouts or high monthly common charges.', scoutRead: 'Needs sharper comp selection and buyer narrative.' },
  { unitType: '4 Bedroom+', expectedDOM: '60-120+ days', rentalSweetSpot: '$12,000+/mo', saleSweetSpot: '$3.5M+', slowerMarketSignal: 'Luxury inventory can sit when price misses by even 5-8%.', scoutRead: 'High upside but thinner buyer pool; use quarterly luxury comps.' },
  { unitType: 'Duplex / Unique', expectedDOM: '45-120+ days', rentalSweetSpot: 'Market-specific', saleSweetSpot: 'Layout-specific', slowerMarketSignal: 'Unique layouts need visual proof, renovation logic, and a very tight comp set.', scoutRead: 'Good for storytelling; dangerous for generic averages.' },
];

export interface DefaultSignal {
  category: string;
  source: string;
  whatSentinelChecks: string;
  clientUse: string;
}

export const SENTINEL_FORECLOSURE_DEFAULT_SIGNALS: DefaultSignal[] = [
  { category: 'Foreclosure / Lis Pendens', source: 'ACRIS document search, county clerk, PropertyShark-style foreclosure records', whatSentinelChecks: 'Notices of pendency, referee deeds, foreclosure filings, and distressed transfer patterns.', clientUse: 'Flags pressure around sponsors, owners, or nearby comparable buildings.' },
  { category: 'Mortgage Maturity / Default Risk', source: 'ACRIS mortgages and assignments, DOF tax balances, lender notices when available', whatSentinelChecks: 'High-rate refinance exposure, recent assignments, unpaid taxes, and old debt nearing maturity.', clientUse: 'Helps identify default risk, acquisition opportunities, and board/vendor payment stress.' },
  { category: 'Tax / Water Lien Exposure', source: 'NYC DOF lien sale datasets and property tax portals; local equivalents outside NYC', whatSentinelChecks: 'Tax liens, water/sewer arrears, and lienable municipal charges.', clientUse: 'Converts public-record risk into an operations and collections talking point.' },
  { category: 'Unit-Level Market Stress', source: 'StreetEasy, Zillow, RealtyMX, MLS/RLS exports', whatSentinelChecks: 'Repeated price cuts, long DOM, relists, concessions, and stale rental listings.', clientUse: 'Shows which unit types are missing the market and why.' },
];

export interface NewConstructionBenchmark {
  market: string;
  salesPipeline: string;
  rentalPipeline: string;
  landPSFRange: string;
  scoutRead: string;
}

export const SENTINEL_NEW_CONSTRUCTION_BENCHMARKS: NewConstructionBenchmark[] = [
  { market: 'Harlem / Upper Manhattan', salesPipeline: 'Selective condo demand; buyer value-sensitive.', rentalPipeline: 'Strong rental demand near transit and institutional anchors.', landPSFRange: '$175-$450/BSF guide range', scoutRead: 'Best opportunities are operating turnarounds, tax appeals, and under-managed condo/coop boards.' },
  { market: 'Upper East / Upper West Side', salesPipeline: 'Liquid but quality-sensitive resale market.', rentalPipeline: 'High-income renters support premium 1BR/2BR pricing.', landPSFRange: '$500-$1,200+/BSF guide range', scoutRead: 'Management quality protects value because monthly charges and service expectations are high.' },
  { market: 'Midtown / Chelsea / Flatiron', salesPipeline: 'Mixed office-return and luxury demand signals.', rentalPipeline: 'Strong furnished and executive rental demand.', landPSFRange: '$650-$1,500+/BSF guide range', scoutRead: 'Good for mixed-use, amenity, and hospitality-adjacent repositioning narratives.' },
  { market: 'Lower Manhattan / Tribeca / SoHo', salesPipeline: 'Premium but thinner buyer pool at high price points.', rentalPipeline: 'Luxury rentals strong when product is polished.', landPSFRange: '$900-$2,000+/BSF guide range', scoutRead: 'Highest upside, highest execution risk; comps must be exact.' },
  { market: 'Brooklyn Core', salesPipeline: 'Deep buyer demand but rate-sensitive.', rentalPipeline: 'Strong absorption near transit and lifestyle corridors.', landPSFRange: '$250-$900/BSF guide range', scoutRead: 'Unit mix and taxes drive the story more than borough averages.' },
  { market: 'Queens Core / LIC / Astoria / Sunnyside', salesPipeline: 'Value and transit-driven buyer demand.', rentalPipeline: 'Very strong rental absorption for studios and 1BRs.', landPSFRange: '$150-$650/BSF guide range', scoutRead: 'Sweet spot for Camelot local-presence and growth narrative.' },
  { market: 'Bronx / Riverdale / Westchester', salesPipeline: 'More price-sensitive and carrying-cost aware.', rentalPipeline: 'Stable for well-located, well-managed properties.', landPSFRange: '$60-$350/BSF guide range', scoutRead: 'Management fee discipline and operations savings matter heavily.' },
];

export interface ManagementFeeBenchmark {
  market: string;
  assetClass: string;
  baseFeeRange: string;
  perUnitRange: string;
  unionImpact: string;
  amenityImpact: string;
  scoutRead: string;
}

export const SENTINEL_MANAGEMENT_FEE_BENCHMARKS: ManagementFeeBenchmark[] = [
  { market: 'Manhattan', assetClass: 'Large full-service co-op / condo', baseFeeRange: '$50K-$100K+ annual minimum at larger firms', perUnitRange: '$800-$1,200+/unit/year', unionImpact: '+10-25% complexity for 32BJ staffing, benefits, grievance, and coverage administration', amenityImpact: '+5-15% when pools, garages, gyms, roof decks, package rooms, or concierge services require active oversight', scoutRead: 'Camelot should price 15% below comparable large-firm base management when scope is comparable, subject to minimum fee discipline.' },
  { market: 'Manhattan', assetClass: 'Small/mid-size walk-up co-op / condo', baseFeeRange: '$1,500-$2,000/mo Camelot minimum guidance', perUnitRange: '$600-$900/unit/year', unionImpact: 'Usually limited unless staff exists', amenityImpact: 'Modest unless there is elevator, roof, storage, or live-in super scope', scoutRead: 'Avoid underpricing small buildings; the minimum protects service quality.' },
  { market: 'Brooklyn / Queens / Bronx / Staten Island', assetClass: 'Outer-borough co-op / condo', baseFeeRange: '$1,200-$1,500/mo Camelot minimum guidance', perUnitRange: '$300-$800/unit/year', unionImpact: '+10-20% when staffed/unionized', amenityImpact: '+5-12% for amenities and high communication volume', scoutRead: 'Good Camelot value zone where high-touch service can beat large-firm response time.' },
  { market: 'Riverdale / Southern Westchester', assetClass: 'Co-op / condo / HOA', baseFeeRange: '$1,200-$2,500/mo depending service level', perUnitRange: '$300-$650/unit/year', unionImpact: '+10-20% for staff-heavy communities', amenityImpact: '+8-18% for pool, clubhouse, roads, snow, and field coordination', scoutRead: 'Separate back-office management from local field operations or project retainers.' },
  { market: 'NYC / surrounding rental', assetClass: 'Multifamily rental', baseFeeRange: '5-12% of collected rent or flat monthly per-unit fee', perUnitRange: '$150-$300/unit/month where flat-fee model applies', unionImpact: 'Payroll and compliance complexity can justify higher base fee', amenityImpact: 'Amenities and leasing velocity add reporting and coordination burden', scoutRead: 'Compare fee to rent roll, vacancy risk, and leasing/admin extras.' },
];

export const SENTINEL_EXPANSION_SOURCE_STACK = [
  'RealtyMX API/CSV: rental inventory, price changes, DOM, unit mix, broker notes, and listing velocity',
  'StreetEasy Data Dashboard and building pages: monthly rent/sale medians, inventory, days on market, and building imagery',
  'Zillow/Apartments.com/Redfin: supplemental listing images, rental/sale ranges, active inventory, and unit mix proof',
  'ACRIS/County Clerk: sales, mortgages, mortgage assignments, lis pendens, referee deeds, liens, and distressed transfers',
  'NYC DOF/PROS and lien datasets: assessed value, tax bills, liens, abatements, and property tax balances',
  'NYC DCP PLUTO/MapPLUTO: lot area, zoning, land use, year built, FAR, and land/development context',
  'DOB/DOB NOW/HPD/OATH-ECB or state/local equivalents: permits, violations, complaints, facade/elevator/boiler/local-law risk',
  'Miller Samuel, REBNY, OneKey/RLS, and market reports: quarterly narrative, absorption, luxury trends, and brokerage context',
  'PropertyShark-style sources: ownership, foreclosure, tax map, zoning, liens, and comparable sales cross-check',
  ...NY_PEOPLE_ENTITY_COMP_SOURCE_STACK,
  ...NY_OWNERSHIP_HUNT_SOURCE_STACK.map(({ source, bestUseCase }) => `${source}: ${bestUseCase}`),
];

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanFilename(value: string): string {
  return value.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'Subject-Building';
}

export function buildSentinelMarketFilename(input: SentinelInput, extension: 'html' | 'pdf' = 'html'): string {
  const address = cleanFilename(input.subjectAddress || 'Subject-Building');
  const date = new Date().toISOString().slice(0, 10);
  return `Camelot-Sentinel-Market-Stack-${address}-${date}.${extension}`;
}

export function inferSentinelNeighborhood(input: SentinelInput): NeighborhoodBenchmark {
  const text = `${input.subjectAddress || ''} ${input.subjectBorough || ''}`.toLowerCase();
  if (text.includes('harlem') || text.includes('fifth avenue') || text.includes('5th avenue') || text.includes('10029')) return NEIGHBORHOODS.find(n => n.name === 'East Harlem')!;
  if (text.includes('79') || text.includes('park avenue') || text.includes('madison') || text.includes('yorkville') || text.includes('upper east')) return NEIGHBORHOODS.find(n => n.name === 'Upper East Side')!;
  if (text.includes('upper west') || text.includes('73') || text.includes('93')) return NEIGHBORHOODS.find(n => n.name === 'Upper West Side')!;
  if (text.includes('tribeca') || text.includes('soho') || text.includes('white street') || text.includes('franklin')) return NEIGHBORHOODS.find(n => n.name === 'Tribeca / SoHo')!;
  if (text.includes('chelsea') || text.includes('flatiron')) return NEIGHBORHOODS.find(n => n.name === 'Chelsea')!;
  if (text.includes('brooklyn heights')) return NEIGHBORHOODS.find(n => n.name === 'Brooklyn Heights')!;
  if (text.includes('park slope')) return NEIGHBORHOODS.find(n => n.name === 'Park Slope')!;
  if (text.includes('williamsburg') || text.includes('greenpoint')) return NEIGHBORHOODS.find(n => n.name === 'Greenpoint / Williamsburg')!;
  if (text.includes('lic') || text.includes('long island city')) return NEIGHBORHOODS.find(n => n.name === 'Long Island City')!;
  if (text.includes('sunnyside') || text.includes('woodside') || text.includes('jackson heights') || text.includes('astoria') || text.includes('queens')) return NEIGHBORHOODS.find(n => n.name === 'Sunnyside / Woodside')!;
  if (text.includes('midtown') || text.includes('57') || text.includes('38')) return NEIGHBORHOODS.find(n => n.name === 'Midtown')!;
  return NEIGHBORHOODS.find(n => n.name === 'Upper East Side')!;
}

function getFeeBenchmark(input: SentinelInput): ManagementFeeBenchmark {
  const market = input.subjectBorough || '';
  const asset = input.subjectAssetClass || '';
  if (market.includes('Westchester') || market.includes('Connecticut') || asset.includes('HOA')) return SENTINEL_MANAGEMENT_FEE_BENCHMARKS[3];
  if (asset.includes('Rental')) return SENTINEL_MANAGEMENT_FEE_BENCHMARKS[4];
  if (market === 'Manhattan' && (input.subjectServiceLevel || '').includes('Full')) return SENTINEL_MANAGEMENT_FEE_BENCHMARKS[0];
  if (market === 'Manhattan') return SENTINEL_MANAGEMENT_FEE_BENCHMARKS[1];
  return SENTINEL_MANAGEMENT_FEE_BENCHMARKS[2];
}

function subjectProsCons(input: SentinelInput, hood: NeighborhoodBenchmark): { pros: string[]; cons: string[] } {
  const service = input.subjectServiceLevel || '';
  const amenities = (input.subjectAmenities || '').trim();
  const units = Number.parseInt(input.subjectUnits || '', 10);
  const pros = [
    `${hood.name} benchmark shows ${hood.momentum.toLowerCase()} momentum and ${hood.daysOnMarket}-day average market exposure.`,
    `Current neighborhood rent guides: 1BR around $${hood.medianRent1BR.toLocaleString()} and 2BR around $${hood.medianRent2BR.toLocaleString()}.`,
    service.includes('Luxury') || amenities ? 'Amenities create a stronger resident-retention story when fees and operations are managed tightly.' : 'Lower-service buildings can compete on value when management is responsive and reporting is clean.',
  ];
  const cons = [
    `Operating-cost range of ${hood.opexRange}/SF/year needs benchmarking against actual budget and payroll/vendor load.`,
    'Foreclosure, mortgage maturity, tax lien, and stale-listing signals must be cross-checked before presenting value conclusions.',
    Number.isFinite(units) && units < 30 ? 'Small buildings can be fee-sensitive; minimum management pricing should be protected with a tight scope.' : 'Larger buildings need unit-mix, amenity, staffing, and compliance detail before pricing can be final.',
  ];
  return { pros, cons };
}

export function generateSubjectMarketReport(input: SentinelInput): string {
  const hood = inferSentinelNeighborhood(input);
  const fee = getFeeBenchmark(input);
  const { pros, cons } = subjectProsCons(input, hood);
  const address = escapeHtml(input.subjectAddress || 'Subject building');
  const borough = escapeHtml(input.subjectBorough || 'Market to verify');
  const assetClass = escapeHtml(input.subjectAssetClass || 'Asset class to verify');
  const units = escapeHtml(input.subjectUnits || 'To verify');
  const amenities = escapeHtml(input.subjectAmenities || 'To verify through listing, website, offering plan, and board package');
  const union = escapeHtml(input.subjectUnionStatus || 'Unknown');
  const service = escapeHtml(input.subjectServiceLevel || 'To verify');
  const generated = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const realtyMxStatus = input.realtyMxEnabled
    ? 'RealtyMX API-ready: Sentinel should enrich the next run with live listing velocity and unit-mix data.'
    : 'RealtyMX API-ready: add the API key as VITE_REALTYMX_API_KEY or provide a CSV export to replace guide ranges with live inventory.';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sentinel Market Stack - ${address}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef1f4;color:#172033;font-family:Arial,Helvetica,sans-serif;line-height:1.45}.page{width:1120px;margin:0 auto;background:#fbfaf6}.slide{min-height:720px;padding:46px 58px;border:1px solid #d8d0bd;page-break-after:always;position:relative;background:#fbfaf6}.dark{background:#263542;color:#fff}.kicker{color:#b3912f;text-transform:uppercase;letter-spacing:2.5px;font-size:12px;font-weight:700}.brand{position:absolute;right:46px;top:32px;background:#c5a43a;color:#111;padding:20px 30px;letter-spacing:8px;font-size:17px}.title{font-family:Georgia,serif;color:#b3912f;font-size:48px;line-height:1.05;margin:24px 0 14px}.dark .title{color:#d7b84e}.subtitle{font-size:19px;max-width:760px}.grid{display:grid;gap:18px}.cols2{grid-template-columns:1fr 1fr}.cols3{grid-template-columns:repeat(3,1fr)}.cols4{grid-template-columns:repeat(4,1fr)}.card{background:#fff;border:1px solid #d8d0bd;border-radius:10px;padding:18px;box-shadow:0 10px 24px rgba(0,0,0,.05)}.dark .card{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}h2{font-family:Georgia,serif;color:#b3912f;font-size:34px;margin:0 0 18px;border-left:5px solid #b3912f;padding-left:14px}h3{margin:0 0 9px;color:#0b1d3b;font-size:17px}.dark h3{color:#fff}.metric{font-size:28px;color:#b3912f;font-weight:800}.label{font-size:10px;text-transform:uppercase;letter-spacing:1.3px;color:#667085}table{width:100%;border-collapse:collapse;font-size:12px;background:#fff}th{background:#304557;color:#fff;padding:10px;text-align:left;text-transform:uppercase;font-size:10px;letter-spacing:1px}td{padding:10px;border-bottom:1px solid #e5dfd2;vertical-align:top}tr:nth-child(even){background:#f3efe7}.pill{display:inline-block;border:1px solid #d8d0bd;border-radius:999px;padding:6px 10px;margin:4px 6px 4px 0;background:#fff;font-size:12px}.source{font-size:10px;color:#6b7280;position:absolute;bottom:22px;left:58px;right:58px;border-top:1px solid #ddd4c0;padding-top:8px}.num{position:absolute;right:28px;bottom:18px;font-size:11px;color:#6b7280}.bar{height:8px;background:#e7e9ee;border-radius:99px;overflow:hidden}.bar span{display:block;height:100%;background:linear-gradient(90deg,#b3912f,#304557)}ul{padding-left:18px}li{margin:7px 0}@media print{@page{size:letter landscape;margin:.2in}body{background:#fff}.page{width:auto}.slide{break-after:page;page-break-after:always;min-height:7.1in;padding:34px 42px}.brand{top:20px;right:32px}.source{left:42px;right:42px}}
</style>
</head>
<body>
<main class="page">
<section class="slide dark">
  <div class="brand">CAMELOT</div>
  <div class="kicker">Sentinel Market Intelligence</div>
  <h1 class="title">${address}</h1>
  <p class="subtitle">Market stack-up, unit-mix velocity, foreclosure/default watch, new-construction context, and management-fee benchmark for ${borough}.</p>
  <div class="grid cols4" style="margin-top:42px">
    <div class="card"><div class="metric">${assetClass}</div><div class="label">Asset Class</div></div>
    <div class="card"><div class="metric">${units}</div><div class="label">Units</div></div>
    <div class="card"><div class="metric">${hood.name}</div><div class="label">Matched Market</div></div>
    <div class="card"><div class="metric">${hood.momentum}</div><div class="label">Momentum</div></div>
  </div>
  <p style="margin-top:34px;color:#d8dee7;font-size:14px">${realtyMxStatus}</p>
  <div class="source">Generated ${generated}. Sources: RealtyMX API/CSV, StreetEasy, Zillow, ACRIS, DOF, PLUTO, DOB/HPD/OATH-ECB, Miller Samuel/REBNY-style market reports, PropertyShark-style foreclosure and ownership checks, NY people/entity/comp stack: ${nyPeopleEntityCompSourceSummary()}, and additive NY ownership hunt skill: ${nyOwnershipHuntSummary()}.</div>
  <div class="num">1</div>
</section>

<section class="slide">
  <div class="brand">CAMELOT</div>
  <h2>Market Stack-Up</h2>
  <div class="grid cols4">
    <div class="card"><div class="metric">$${hood.condoPSF.toLocaleString()}</div><div class="label">Condo $/SF Guide</div></div>
    <div class="card"><div class="metric">$${hood.coopPSF.toLocaleString()}</div><div class="label">Co-op $/SF Guide</div></div>
    <div class="card"><div class="metric">$${hood.medianRent1BR.toLocaleString()}</div><div class="label">Median 1BR Rent</div></div>
    <div class="card"><div class="metric">${hood.daysOnMarket}d</div><div class="label">Avg Market Exposure</div></div>
  </div>
  <div class="grid cols2" style="margin-top:22px">
    <div class="card"><h3>Pros Sentinel Can Use</h3><ul>${pros.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div>
    <div class="card"><h3>Cons / Questions to Verify</h3><ul>${cons.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul></div>
  </div>
  <div class="card" style="margin-top:18px">
    <h3>Subject Service Read</h3>
    <p><strong>Service level:</strong> ${service} &nbsp; <strong>Union status:</strong> ${union} &nbsp; <strong>Amenities:</strong> ${amenities}</p>
  </div>
  <div class="source">Stack-up is a guide until live listing inventory, closed comps, building financials, and actual unit mix are loaded.</div>
  <div class="num">2</div>
</section>

<section class="slide">
  <div class="brand">CAMELOT</div>
  <h2>Unit Mix Velocity</h2>
  <table>
    <thead><tr><th>Unit Type</th><th>Expected DOM</th><th>Rental Sweet Spot</th><th>Sale Sweet Spot</th><th>Slower Market Signal</th><th>Sentinel Read</th></tr></thead>
    <tbody>${SENTINEL_UNIT_MIX_BENCHMARKS.map(row => `<tr><td><strong>${row.unitType}</strong></td><td>${row.expectedDOM}</td><td>${row.rentalSweetSpot}</td><td>${row.saleSweetSpot}</td><td>${row.slowerMarketSignal}</td><td>${row.scoutRead}</td></tr>`).join('')}</tbody>
  </table>
  <div class="card" style="margin-top:16px">
    <h3>What Sentinel Should Calculate With RealtyMX</h3>
    <p>For each unit type, Sentinel should compare active price, last price change, days listed, concession language, floor/location, and building amenities against the neighborhood range. The output should identify the fastest-clearing price band and which units are stale because price, layout, carrying cost, or seasonality is off.</p>
  </div>
  <div class="source">Primary data path: RealtyMX API/CSV, StreetEasy, Zillow, Apartments.com, MLS/RLS exports.</div>
  <div class="num">3</div>
</section>

<section class="slide">
  <div class="brand">CAMELOT</div>
  <h2>Default, Foreclosure & Distress Watch</h2>
  <div class="grid cols2">
    ${SENTINEL_FORECLOSURE_DEFAULT_SIGNALS.map(row => `<div class="card"><h3>${row.category}</h3><p><strong>Sources:</strong> ${row.source}</p><p><strong>Checks:</strong> ${row.whatSentinelChecks}</p><p><strong>Use:</strong> ${row.clientUse}</p></div>`).join('')}
  </div>
  <div class="card" style="margin-top:18px;border-left:5px solid #b3912f">
    <h3>Release Rule</h3>
    <p>Sentinel should not say a market is clean just because one source is empty. It should state which sources were checked, which were unavailable, and whether the conclusion is confirmed, partial, or needs manual verification.</p>
  </div>
  <div class="source">Core public-record sources: ACRIS/county clerk, DOF/tax portals, court/lis pendens records, PropertyShark-style foreclosure checks.</div>
  <div class="num">4</div>
</section>

<section class="slide">
  <div class="brand">CAMELOT</div>
  <h2>New Construction & Land Context</h2>
  <table>
    <thead><tr><th>Market</th><th>Sales Pipeline</th><th>Rental Pipeline</th><th>Land $/BSF Guide</th><th>Sentinel Read</th></tr></thead>
    <tbody>${SENTINEL_NEW_CONSTRUCTION_BENCHMARKS.map(row => `<tr><td><strong>${row.market}</strong></td><td>${row.salesPipeline}</td><td>${row.rentalPipeline}</td><td>${row.landPSFRange}</td><td>${row.scoutRead}</td></tr>`).join('')}</tbody>
  </table>
  <div class="source">Land values are guide ranges and must be refined with PLUTO zoning/FAR, recent ACRIS land trades, DOB new-building permits, and broker/developer comps.</div>
  <div class="num">5</div>
</section>

<section class="slide">
  <div class="brand">CAMELOT</div>
  <h2>Management Fee Benchmark</h2>
  <div class="grid cols2">
    <div class="card">
      <h3>Matched Fee Market</h3>
      <p><strong>${fee.market}</strong> - ${fee.assetClass}</p>
      <p><span class="pill">Base: ${fee.baseFeeRange}</span><span class="pill">Per-unit: ${fee.perUnitRange}</span></p>
      <p><strong>Union impact:</strong> ${fee.unionImpact}</p>
      <p><strong>Amenity impact:</strong> ${fee.amenityImpact}</p>
    </div>
    <div class="card">
      <h3>Camelot Pricing Position</h3>
      <p>${fee.scoutRead}</p>
      <div class="bar" style="margin:18px 0"><span style="width:85%"></span></div>
      <p><strong>Rule:</strong> Camelot should compare against the relevant competitor market rate, then target a base-management fee approximately 15% below comparable large-firm pricing while preserving minimum fee rules and separating ancillary/project services.</p>
    </div>
  </div>
  <table style="margin-top:18px">
    <thead><tr><th>Benchmark</th><th>Rule</th></tr></thead>
    <tbody>${SENTINEL_MANAGEMENT_FEE_BENCHMARKS.map(row => `<tr><td><strong>${row.market}</strong><br>${row.assetClass}</td><td>${row.baseFeeRange}; ${row.perUnitRange}. ${row.scoutRead}</td></tr>`).join('')}</tbody>
  </table>
  <div class="source">Fee guide based on uploaded Camelot fee-structure document and market ranges; formal proposals require budget, prior management report, audited financials, service expectations, staffing, and amenity scope.</div>
  <div class="num">6</div>
</section>

<section class="slide dark">
  <div class="brand">CAMELOT</div>
  <h2 style="color:#d7b84e">Source Checklist</h2>
  <div class="grid cols2">
    ${SENTINEL_EXPANSION_SOURCE_STACK.map(source => `<div class="card">${escapeHtml(source)}</div>`).join('')}
  </div>
  <p style="margin-top:22px;color:#d8dee7">Sentinel's job is to turn market data into a practical board or owner conversation: value, velocity, risk, pricing, and where Camelot can create operational leverage.</p>
  <div class="source" style="color:#c9d2dc">Camelot Realty Group - 57 West 57th Street, Suite 410, New York, NY 10019 - info@camelot.nyc - www.camelot.nyc</div>
  <div class="num" style="color:#c9d2dc">7</div>
</section>
</main>
</body>
</html>`;
}

// ============================================================
// Rate Scenario Data
// ============================================================

interface RateScenario {
  label: string;
  rate: number;
  monthlyPayment: number; // on $500K loan
  buyingPower: number; // total purchase price affordable at $4K/mo
}

const RATE_SCENARIOS: RateScenario[] = [
  { label: 'Current', rate: 6.75, monthlyPayment: 3243, buyingPower: 616000 },
  { label: '-50bps', rate: 6.25, monthlyPayment: 3079, buyingPower: 650000 },
  { label: '-100bps', rate: 5.75, monthlyPayment: 2918, buyingPower: 686000 },
  { label: '-150bps', rate: 5.25, monthlyPayment: 2761, buyingPower: 724000 },
];

// ============================================================
// Report Generator
// ============================================================

export function generateSentinelReport(input: SentinelInput): string {
  const { quarter, year } = input;
  const periodMap: Record<string, string> = { Q1: 'January–March', Q2: 'April–June', Q3: 'July–September', Q4: 'October–December' };
  const period = periodMap[quarter];
  const publishDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const timestamp = new Date().toISOString();
  const buildingsAbove = TRACKED_BUILDINGS.filter(b => b.performance === 'Above').length;

  const minPSF = Math.min(...NEIGHBORHOODS.map(n => n.condoPSF));
  const maxPSF = Math.max(...NEIGHBORHOODS.map(n => n.condoPSF));
  const minNeighborhood = NEIGHBORHOODS.find(n => n.condoPSF === minPSF)!;
  const maxNeighborhood = NEIGHBORHOODS.find(n => n.condoPSF === maxPSF)!;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Camelot ${quarter} ${year} Market Intelligence Report</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#F5F0E5;color:#2C3240;font-size:13px;line-height:1.6}
.page{max-width:900px;margin:0 auto}
h1,h2,h3{font-family:'Plus Jakarta Sans',sans-serif}
.section{padding:36px 50px;page-break-after:always;border:1px solid #D5D0C6;margin-bottom:8px;position:relative}
.section-cream{background:#F5F0E5}.section-white{background:#FDFAF3}
.section-title{font-size:24px;color:#A89035;margin-bottom:6px;padding-left:16px;border-left:4px solid #A89035;font-weight:700}
.section-sub{font-size:12px;color:#888;margin-bottom:24px;padding-left:16px}
.cover{background:#0D2240;color:#fff;padding:60px;text-align:center;min-height:600px;display:flex;flex-direction:column;justify-content:center;align-items:center;page-break-after:always;border:3px solid #B8973A;margin-bottom:8px}
.stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:20px 0}
.stat-box{background:#EDE9DF;border:1px solid #D5D0C6;border-radius:8px;padding:16px;text-align:center}
.stat-box .val{font-family:'Plus Jakarta Sans',sans-serif;font-size:24px;color:#B8973A;font-weight:700}
.stat-box .lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}
th{background:#B8973A;color:#fff;padding:10px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px}
td{padding:10px 14px;border-bottom:1px solid #E5E3DE}
tr:nth-child(even){background:#EDE9DF}
.insight-card{background:#fff;border:1px solid #D5D0C6;border-left:4px solid #B8973A;border-radius:0 8px 8px 0;padding:18px;margin-bottom:14px}
.insight-card h4{font-size:13px;font-weight:700;color:#0D2240;margin-bottom:6px}
.insight-card p{font-size:12px;color:#555;line-height:1.6}
.bar-chart{display:flex;align-items:flex-end;gap:6px;height:160px;margin:16px 0;padding:0 10px}
.bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.bar-col .bar{width:100%;border-radius:4px 4px 0 0;min-height:8px}
.bar-col .val{font-size:9px;font-weight:700;color:#0D2240}
.bar-col .lbl{font-size:8px;color:#888;text-align:center}
.footer{text-align:center;font-size:8px;color:#999;padding-top:8px;border-top:1px solid #E5E3DE;margin-top:16px}
@media print{@page{margin:0.15in}body{background:#fff}.cover{background:#0D2240!important}}
</style>
</head>
<body>
<div class="page">

<!-- COVER -->
<div class="cover">
<img src="./images/camelot-logo-white.png" alt="Camelot" style="width:120px;margin-bottom:24px;opacity:0.9" onerror="this.style.display='none'">
<div style="font-size:14px;letter-spacing:10px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:8px">C A M E L O T</div>
<div style="font-size:12px;color:#B8973A;letter-spacing:3px;margin-bottom:40px">MARKET INTELLIGENCE</div>
<h1 style="font-size:42px;color:#B8973A;font-weight:800;margin-bottom:8px">${quarter} ${year}</h1>
<div style="font-size:18px;color:rgba(255,255,255,0.8);margin-bottom:4px">NYC Market Intelligence Report</div>
<div style="font-size:13px;color:rgba(255,255,255,0.5)">${period} ${year}</div>
<div style="width:60px;height:2px;background:#B8973A;margin:30px auto"></div>
<div style="font-size:11px;color:rgba(255,255,255,0.4);line-height:2">
Published ${publishDate}<br>
Camelot Realty Group · 57 West 57th Street, Suite 410 · New York, NY 10019<br>
SCOUT Market Intelligence · Sentinel Engine
</div>
<div style="position:absolute;bottom:20px;font-size:8px;color:rgba(255,255,255,0.2)">
Data Sources: ACRIS (live) · NYC DOF (live) · StreetEasy · RealtyMX · OneKey MLS · REBNY RLS
</div>
</div>

<!-- FIVE INSIGHTS -->
<div class="section section-white">
<div class="section-title">${quarter} ${year} Key Insights</div>
<div class="section-sub">Five data-driven takeaways from the NYC market this quarter</div>

<div class="insight-card">
<h4>🏢 1. Building Performance</h4>
<p>${input.insight1 || `${buildingsAbove} of ${TRACKED_BUILDINGS.length} Camelot-tracked buildings beat their neighborhood median $/sqft`}</p>
</div>
<div class="insight-card">
<h4>⚡ 2. Rental Velocity</h4>
<p>${input.insight2 || 'Sub-$3,500/mo 1-BRs clearing in under 14 days — demand outpacing supply across core Manhattan and Brooklyn'}</p>
</div>
<div class="insight-card">
<h4>📊 3. Rate Sensitivity</h4>
<p>${input.insight3 || 'Every 50bps rate drop unlocks 8–10% more buying power — current 30-year fixed at 6.75%'}</p>
</div>
<div class="insight-card">
<h4>🏠 4. Rent vs. Buy</h4>
<p>${input.insight4 || 'Break-even horizon: ~20 years in Sunnyside/Woodside, 38+ years in Tribeca/SoHo at current rates'}</p>
</div>
<div class="insight-card">
<h4>📍 5. Neighborhood Value Spectrum</h4>
<p>${input.insight5 || `Condo $/sqft ranges from $${minPSF} (${minNeighborhood.name}) to $${maxPSF} (${maxNeighborhood.name})`}</p>
</div>
</div>

<!-- NEIGHBORHOOD BENCHMARKS -->
<div class="section section-cream">
<div class="section-title">Neighborhood Benchmarks</div>
<div class="section-sub">12 core neighborhoods — sale prices, rents, and market dynamics</div>

<table>
<thead><tr>
<th>Neighborhood</th><th>Condo $/SF</th><th>Co-op $/SF</th><th>Median 1BR</th><th>Median 2BR</th><th>DOM</th><th>YoY</th><th>Momentum</th>
</tr></thead>
<tbody>
${NEIGHBORHOODS.map(n => `<tr>
<td style="font-weight:600">${n.name}</td>
<td>$${n.condoPSF.toLocaleString()}</td>
<td>$${n.coopPSF.toLocaleString()}</td>
<td>$${n.medianRent1BR.toLocaleString()}</td>
<td>$${n.medianRent2BR.toLocaleString()}</td>
<td>${n.daysOnMarket}d</td>
<td style="color:${n.yoyChange > 3 ? '#16a34a' : n.yoyChange > 0 ? '#B8973A' : '#dc2626'};font-weight:600">${n.yoyChange > 0 ? '+' : ''}${n.yoyChange}%</td>
<td style="font-weight:500;color:${n.momentum === 'Very Strong' || n.momentum === 'Strong' ? '#16a34a' : '#B8973A'}">${n.momentum}</td>
</tr>`).join('\n')}
</tbody>
</table>

<!-- Price Bar Chart -->
<div style="margin-top:20px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#B8973A;font-weight:600;padding-left:16px;border-left:4px solid #B8973A;margin-bottom:12px">Condo $/Sqft by Neighborhood</div>
<div class="bar-chart">
${NEIGHBORHOODS.map(n => {
  const pct = Math.round((n.condoPSF / maxPSF) * 100);
  return `<div class="bar-col">
<div class="val">$${n.condoPSF}</div>
<div class="bar" style="height:${pct}%;background:linear-gradient(to top,#B8973A,${n.yoyChange > 3 ? '#16a34a' : '#1A6B7C'})"></div>
<div class="lbl">${n.name.split('/')[0].split(' ').slice(0,2).join(' ')}</div>
</div>`;
}).join('\n')}
</div>
</div>

<!-- RATE SCENARIO -->
<div class="section section-white">
<div class="section-title">Mortgage Rate Sensitivity Analysis</div>
<div class="section-sub">How rate changes affect buying power — 30-year fixed, 20% down on $500K loan</div>

<table>
<thead><tr><th>Scenario</th><th>Rate</th><th>Monthly Payment</th><th>Buying Power</th><th>vs. Current</th></tr></thead>
<tbody>
${RATE_SCENARIOS.map((r, i) => `<tr>
<td style="font-weight:${i === 0 ? '700' : '400'}">${r.label}</td>
<td style="font-weight:700;color:#0D2240">${r.rate}%</td>
<td>$${r.monthlyPayment.toLocaleString()}</td>
<td style="color:#B8973A;font-weight:700">$${r.buyingPower.toLocaleString()}</td>
<td style="color:${i === 0 ? '#888' : '#16a34a'};font-weight:600">${i === 0 ? '—' : '+$' + (r.buyingPower - RATE_SCENARIOS[0].buyingPower).toLocaleString() + ' (+' + Math.round(((r.buyingPower - RATE_SCENARIOS[0].buyingPower) / RATE_SCENARIOS[0].buyingPower) * 100) + '%)'}</td>
</tr>`).join('\n')}
</tbody>
</table>

<!-- Buying Power Bar Chart -->
<div style="margin-top:20px;display:flex;gap:12px;align-items:flex-end;height:120px">
${RATE_SCENARIOS.map((r, i) => {
  const pct = Math.round((r.buyingPower / RATE_SCENARIOS[RATE_SCENARIOS.length-1].buyingPower) * 100);
  return `<div style="flex:1;text-align:center">
<div style="font-size:10px;font-weight:700;color:${i === 0 ? '#0D2240' : '#16a34a'};margin-bottom:4px">$${(r.buyingPower/1000).toFixed(0)}K</div>
<div style="height:${pct}%;background:${i === 0 ? '#0D2240' : '#B8973A'};border-radius:4px 4px 0 0;min-height:20px"></div>
<div style="font-size:9px;color:#888;margin-top:4px">${r.label}<br>${r.rate}%</div>
</div>`;
}).join('\n')}
</div>
</div>

<!-- PORTFOLIO INTELLIGENCE -->
<div class="section section-cream">
<div class="section-title">Camelot Portfolio Intelligence</div>
<div class="section-sub">How Camelot-managed buildings perform vs. their neighborhoods</div>

<table>
<thead><tr><th>Building</th><th>Type</th><th>Units</th><th>Neighborhood</th><th>Camelot $/SF</th><th>Neighborhood $/SF</th><th>Performance</th></tr></thead>
<tbody>
${TRACKED_BUILDINGS.map(b => `<tr>
<td style="font-weight:600">${b.name}</td>
<td>${b.type}</td>
<td>${b.units}</td>
<td>${b.neighborhood}</td>
<td style="color:#B8973A;font-weight:700">$${b.camelotPSF.toLocaleString()}</td>
<td>$${b.neighborhoodPSF.toLocaleString()}</td>
<td style="color:${b.performance === 'Above' ? '#16a34a' : '#B8973A'};font-weight:700">${b.performance === 'Above' ? '▲ Above' : '● At Market'}</td>
</tr>`).join('\n')}
</tbody>
</table>

<div style="background:#0D2240;border-radius:8px;padding:16px;color:#fff;text-align:center;margin-top:16px">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:24px;font-weight:800;color:#B8973A">${buildingsAbove} of ${TRACKED_BUILDINGS.length}</div>
<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px">Camelot buildings performing above neighborhood median</div>
</div>
</div>

<!-- NEIGHBORHOOD SCORES -->
<div class="section section-white">
<div class="section-title">Neighborhood Scores</div>
<div class="section-sub">Composite ratings: Investment · Livability · Family · Work Access (1–10 scale)</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
${NEIGHBORHOODS.map(n => `<div style="background:#EDE9DF;border-radius:8px;padding:14px;display:flex;justify-content:space-between;align-items:center">
<div style="font-weight:600;font-size:12px">${n.name}</div>
<div style="display:flex;gap:8px;font-size:10px">
<span title="Investment" style="color:#B8973A;font-weight:700">💰${n.investScore}</span>
<span title="Livability" style="color:#1A6B7C;font-weight:700">🏠${n.liveScore}</span>
<span title="Family" style="color:#16a34a;font-weight:700">👨‍👩‍👧${n.familyScore}</span>
<span title="Work" style="color:#0D2240;font-weight:700">💼${n.workScore}</span>
</div>
</div>`).join('\n')}
</div>

<div style="text-align:center;font-size:10px;color:#888;margin-top:12px">
OpEx ranges: ${NEIGHBORHOODS.map(n => `${n.name.split('/')[0].split(' ').slice(0,2).join(' ')}: ${n.opexRange}/SF/yr`).join(' · ')}
</div>
</div>

<!-- CAMELOT PERFORMANCE -->
<div class="section section-cream">
<div class="section-title">Camelot by the Numbers</div>
<div class="section-sub">Portfolio-wide performance metrics — ${quarter} ${year}</div>

<div class="stat-row">
<div class="stat-box"><div class="val">10.55%</div><div class="lbl">Avg YoY Rent Growth</div></div>
<div class="stat-box"><div class="val">5.20%</div><div class="lbl">Market Average</div></div>
<div class="stat-box"><div class="val">96%</div><div class="lbl">Portfolio Occupancy</div></div>
<div class="stat-box"><div class="val">42</div><div class="lbl">Buildings Managed</div></div>
</div>
<div class="stat-row" style="grid-template-columns:1fr 1fr 1fr">
<div class="stat-box"><div class="val">$240M+</div><div class="lbl">Assets Under Management</div></div>
<div class="stat-box"><div class="val">18+</div><div class="lbl">Years in Business</div></div>
<div class="stat-box"><div class="val">5,351+</div><div class="lbl">Units Tracked (SCOUT)</div></div>
</div>

<div style="background:#0D2240;border-radius:8px;padding:18px;color:#fff;text-align:center;margin-top:16px">
<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:8px">Complimentary quarterly market intelligence for all Camelot-managed properties</div>
<div style="font-size:14px;color:#B8973A;font-weight:700">Camelot Realty Group · 57 West 57th Street · (212) 206-9939 · camelot.nyc</div>
</div>

<div class="footer">
Data Sources: ACRIS (live API) · NYC DOF (live API) · StreetEasy · RealtyMX · OneKey MLS · REBNY RLS<br>
${quarter} ${year} · Published ${publishDate} · Generated ${timestamp.split('T')[0]} · Sentinel Engine · Camelot OS<br>
© ${year} Camelot Realty Group · Confidential · All Rights Reserved
</div>
</div>

</div>
</body>
</html>`;
}

// ============================================================
// Per-Building Client Report Generator
// ============================================================

export function generateBuildingReport(building: TrackedBuilding, input: SentinelInput): string {
  const { quarter, year } = input;
  const periodMap: Record<string, string> = { Q1: 'January–March', Q2: 'April–June', Q3: 'July–September', Q4: 'October–December' };
  const period = periodMap[quarter];
  const publishDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const timestamp = new Date().toISOString();

  // Find matching neighborhood data
  const hood = NEIGHBORHOODS.find(n => n.name === building.neighborhood) || NEIGHBORHOODS[0];
  const psfDiff = building.camelotPSF - building.neighborhoodPSF;
  const psfPct = ((psfDiff / building.neighborhoodPSF) * 100).toFixed(1);
  const isAbove = psfDiff > 0;
  const encodedAddr = encodeURIComponent(building.address + ', New York, NY');
  const estValue = building.camelotPSF * (building.units * 850); // rough avg unit size
  const annualRentalPotential = hood.medianRent1BR * 12 * building.units;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${building.name} — ${quarter} ${year} Market Report | Camelot Realty Group</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#F5F0E5;color:#2C3240;font-size:13px;line-height:1.6}
.page{max-width:900px;margin:0 auto}
h1,h2,h3{font-family:'Plus Jakarta Sans',sans-serif}
.section{padding:36px 50px;page-break-after:always;border:1px solid #D5D0C6;margin-bottom:8px}
.section-title{font-size:24px;color:#B8973A;margin-bottom:6px;padding-left:16px;border-left:4px solid #B8973A;font-weight:700}
.section-sub{font-size:12px;color:#888;margin-bottom:24px;padding-left:16px}
.cover{background:#0D2240;color:#fff;padding:60px;text-align:center;min-height:500px;display:flex;flex-direction:column;justify-content:center;align-items:center;page-break-after:always;border:3px solid #B8973A;margin-bottom:8px}
.stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:20px 0}
.stat-box{background:#EDE9DF;border:1px solid #D5D0C6;border-radius:8px;padding:16px;text-align:center}
.stat-box .val{font-family:'Plus Jakarta Sans',sans-serif;font-size:24px;color:#B8973A;font-weight:700}
.stat-box .lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}
th{background:#B8973A;color:#fff;padding:10px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px}
td{padding:10px 14px;border-bottom:1px solid #E5E3DE}
tr:nth-child(even){background:#EDE9DF}
@media print{@page{margin:0.15in}body{background:#fff}.cover{background:#0D2240!important}}
</style>
</head>
<body>
<div class="page">

<!-- COVER -->
<div class="cover">
<img src="./images/camelot-logo-white.png" alt="Camelot" style="width:100px;margin-bottom:20px;opacity:0.9" onerror="this.style.display='none'">
<div style="font-size:12px;letter-spacing:8px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:30px">C A M E L O T</div>
<div style="font-size:14px;color:#B8973A;letter-spacing:3px;margin-bottom:20px">MARKET INTELLIGENCE</div>
<h1 style="font-size:36px;color:#B8973A;font-weight:800;margin-bottom:8px">${building.name}</h1>
<div style="font-size:16px;color:rgba(255,255,255,0.8);margin-bottom:4px">${quarter} ${year} Quarterly Market Report</div>
<div style="font-size:13px;color:rgba(255,255,255,0.5)">${period} ${year} · ${building.neighborhood}</div>
<div style="width:60px;height:2px;background:#B8973A;margin:24px auto"></div>
<div style="font-size:11px;color:rgba(255,255,255,0.4)">
Prepared exclusively for the Board of ${building.name}<br>
Complimentary quarterly report from Camelot Realty Group
</div>
</div>

<!-- PROPERTY OVERVIEW -->
<div class="section" style="background:#FDFAF3">
<div class="section-title">Your Property</div>
<div class="section-sub">${building.address}, New York, NY · ${building.type} · ${building.units} Units</div>

<!-- Street View -->
<div style="border-radius:8px;overflow:hidden;border:1px solid #D5D0C6;height:250px;margin-bottom:16px">
<iframe src="https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${encodedAddr}&zoom=18&maptype=satellite" width="100%" height="250" style="border:0" allowfullscreen loading="lazy"></iframe>
</div>

<div class="stat-row">
<div class="stat-box"><div class="val">${building.units}</div><div class="lbl">Units</div></div>
<div class="stat-box"><div class="val">${building.type}</div><div class="lbl">Building Type</div></div>
<div class="stat-box"><div class="val">${building.neighborhood}</div><div class="lbl">Neighborhood</div></div>
<div class="stat-box"><div class="val" style="color:${isAbove ? '#16a34a' : '#B8973A'}">${isAbove ? '▲' : '●'} ${building.performance}</div><div class="lbl">vs. Market</div></div>
</div>
</div>

<!-- YOUR BUILDING vs MARKET -->
<div class="section" style="background:#F5F0E5">
<div class="section-title">Your Building vs. ${building.neighborhood}</div>
<div class="section-sub">How ${building.name} compares to neighborhood benchmarks — ${quarter} ${year}</div>

<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px">
<div style="background:#0D2240;border-radius:8px;padding:18px;text-align:center;color:#fff">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#B8973A;margin-bottom:6px">Your Building</div>
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:28px;font-weight:800;color:#B8973A">$${building.camelotPSF.toLocaleString()}</div>
<div style="font-size:10px;color:rgba(255,255,255,0.6)">per sqft</div>
</div>
<div style="background:#EDE9DF;border-radius:8px;padding:18px;text-align:center">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:6px">Neighborhood Median</div>
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:28px;font-weight:800;color:#2C3240">$${building.neighborhoodPSF.toLocaleString()}</div>
<div style="font-size:10px;color:#888">per sqft</div>
</div>
<div style="background:${isAbove ? '#16a34a' : '#B8973A'};border-radius:8px;padding:18px;text-align:center;color:#fff">
<div style="font-size:9px;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Difference</div>
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:28px;font-weight:800">${isAbove ? '+' : ''}${psfPct}%</div>
<div style="font-size:10px;opacity:0.8">${isAbove ? 'Above market' : 'At market'}</div>
</div>
</div>

<!-- Neighborhood Benchmarks -->
<table>
<thead><tr><th>Metric</th><th>${building.name}</th><th>${building.neighborhood} Avg</th><th>vs. Market</th></tr></thead>
<tbody>
<tr><td style="font-weight:600">$/Sqft (${building.type.includes('Co') ? 'Co-op' : 'Condo'})</td><td style="color:#B8973A;font-weight:700">$${building.camelotPSF.toLocaleString()}</td><td>$${building.neighborhoodPSF.toLocaleString()}</td><td style="color:${isAbove ? '#16a34a' : '#B8973A'};font-weight:700">${isAbove ? '+' : ''}${psfPct}%</td></tr>
<tr><td style="font-weight:600">Median 1BR Rent</td><td style="color:#B8973A;font-weight:700">$${hood.medianRent1BR.toLocaleString()}</td><td>$${hood.medianRent1BR.toLocaleString()}</td><td>Benchmark</td></tr>
<tr><td style="font-weight:600">Median 2BR Rent</td><td style="color:#B8973A;font-weight:700">$${hood.medianRent2BR.toLocaleString()}</td><td>$${hood.medianRent2BR.toLocaleString()}</td><td>Benchmark</td></tr>
<tr><td style="font-weight:600">Avg Days on Market</td><td>${hood.daysOnMarket} days</td><td>${hood.daysOnMarket} days</td><td>Benchmark</td></tr>
<tr><td style="font-weight:600">YoY Price Change</td><td style="color:${hood.yoyChange > 0 ? '#16a34a' : '#dc2626'};font-weight:700">${hood.yoyChange > 0 ? '+' : ''}${hood.yoyChange}%</td><td>${hood.yoyChange > 0 ? '+' : ''}${hood.yoyChange}%</td><td>${hood.momentum}</td></tr>
<tr><td style="font-weight:600">Operating Costs</td><td>${hood.opexRange}/SF/yr</td><td>${hood.opexRange}/SF/yr</td><td>Range</td></tr>
</tbody>
</table>

<!-- Estimated Value -->
<div style="background:#0D2240;border-radius:8px;padding:16px;color:#fff;text-align:center;margin-top:16px">
<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#B8973A;margin-bottom:8px">Estimated Portfolio Metrics</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
<div><div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800;color:#B8973A">$${(estValue / 1e6).toFixed(1)}M</div><div style="font-size:9px;color:rgba(255,255,255,0.6)">Est. Building Value</div></div>
<div><div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800;color:#B8973A">$${(annualRentalPotential / 1e6).toFixed(2)}M</div><div style="font-size:9px;color:rgba(255,255,255,0.6)">Annual Rental Potential</div></div>
<div><div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800;color:#B8973A">${((annualRentalPotential / estValue) * 100).toFixed(1)}%</div><div style="font-size:9px;color:rgba(255,255,255,0.6)">Est. Gross Yield</div></div>
</div>
</div>
</div>

<!-- NEIGHBORHOOD SCORES -->
<div class="section" style="background:#FDFAF3">
<div class="section-title">${building.neighborhood} — Neighborhood Scores</div>
<div class="section-sub">Composite ratings for your neighborhood (1–10 scale)</div>

<div class="stat-row">
<div class="stat-box"><div class="val" style="color:#B8973A">${hood.investScore}</div><div class="lbl">💰 Investment</div></div>
<div class="stat-box"><div class="val" style="color:#1A6B7C">${hood.liveScore}</div><div class="lbl">🏠 Livability</div></div>
<div class="stat-box"><div class="val" style="color:#16a34a">${hood.familyScore}</div><div class="lbl">👨‍👩‍👧 Family</div></div>
<div class="stat-box"><div class="val" style="color:#0D2240">${hood.workScore}</div><div class="lbl">💼 Work Access</div></div>
</div>

<div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
<div style="background:#EDE9DF;border-radius:8px;padding:14px">
<div style="font-size:11px;font-weight:700;color:#2C3240;margin-bottom:4px">Price Momentum</div>
<div style="font-size:20px;font-weight:800;color:${hood.momentum === 'Very Strong' || hood.momentum === 'Strong' ? '#16a34a' : '#B8973A'}">${hood.momentum} ↑</div>
</div>
<div style="background:#EDE9DF;border-radius:8px;padding:14px">
<div style="font-size:11px;font-weight:700;color:#2C3240;margin-bottom:4px">Operating Cost Range</div>
<div style="font-size:20px;font-weight:800;color:#0D2240">${hood.opexRange}</div>
<div style="font-size:10px;color:#888">per sqft / year</div>
</div>
</div>
</div>

<!-- CAMELOT NOTE -->
<div class="section" style="background:#F5F0E5">
<div class="section-title">From Your Management Team</div>
<div class="section-sub">A note from Camelot Realty Group</div>

<div style="background:#0D2240;border-radius:8px;padding:24px;color:#fff;margin-bottom:16px">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;line-height:1.8;color:rgba(255,255,255,0.85)">
${building.name} continues to ${isAbove ? 'outperform' : 'track with'} the ${building.neighborhood} market at <strong style="color:#B8973A">$${building.camelotPSF}/sqft</strong> — ${isAbove ? psfPct + '% above' : 'at'} the neighborhood median of $${building.neighborhoodPSF}/sqft. This performance reflects the building's strong governance, proactive maintenance, and the financial discipline of the board and management team working together.
</div>
<div style="margin-top:16px;font-size:12px;color:#B8973A;font-weight:600">
Camelot Realty Group · 57 West 57th Street, Suite 410 · (212) 206-9939 · camelot.nyc
</div>
</div>

<div style="text-align:center;font-size:10px;color:#888;margin-top:12px">
Data Sources: ACRIS (live) · NYC DOF (live) · StreetEasy · RealtyMX · REBNY RLS<br>
${quarter} ${year} · Published ${publishDate} · Generated ${timestamp.split('T')[0]} · Sentinel Engine · Camelot OS<br>
© ${year} Camelot Realty Group · Confidential — Prepared exclusively for the Board of ${building.name}
</div>
</div>

</div>
</body>
</html>`;
}
