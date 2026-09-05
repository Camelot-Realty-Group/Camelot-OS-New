/**
 * 382 Lafayette Street (NoHo) — Pitch Data
 * Intro-level pitch microsite (route: /pitch/382-lafayette-street).
 *
 * This is a WARM INTRO, not a priced proposal. Samantha Gasmer (referred
 * by her uncle, Jason Monkarsh) reached out because her building's board
 * is exploring a change of management company. No fee has been discussed
 * yet, so this data file — and the page it drives — intentionally leaves
 * out pricing, a signed proposal, and a management agreement. It covers
 * only what an intro conversation calls for: who Camelot is, how long
 * the firm has been doing this, its history in this specific corridor of
 * Manhattan, and what a working relationship would look like.
 *
 * Every fact below traces to a specific public source: David's own
 * PropertyShark property report for 382 Lafayette St (DOF-sourced),
 * or Camelot's own published materials (camelot.nyc, the brochure,
 * the Oak Park pitch data file). Anything not independently confirmed
 * is flagged via confirmed:false rather than assumed. Do not add
 * pricing or a specific assigned property manager here without an
 * explicit decision from David.
 */

export interface Fact<T> {
  value: T;
  confirmed: boolean;
  note?: string;
}

const confirmed = <T,>(value: T, note?: string): Fact<T> => ({ value, confirmed: true, note });
const unconfirmed = <T,>(value: T, note?: string): Fact<T> => ({ value, confirmed: false, note });

// ============================================================
// Property — 382 Lafayette Street, NoHo
// ============================================================

export const LAFAYETTE_PROPERTY = {
  name: '382 Lafayette Street',
  address: '382 Lafayette Street',
  neighborhood: 'NoHo',
  city: 'New York',
  state: 'NY',
  zip: '10003',
  fullAddress: '382 Lafayette Street, New York, NY 10003 (NoHo)',
  blockLot: confirmed('Block 531, Lot 7502 — Condo complex 100641', 'PropertyShark property report for 382 Lafayette St, generated 9/3/2026'),
  type: 'condo' as const,
  totalUnits: confirmed(9, 'PropertyShark property report: 8 residential units (DOF) + 1 ground-floor commercial unit'),
  residentialUnits: confirmed(8, 'PropertyShark property report (DOF residential unit count)'),
  stories: confirmed(9, 'PropertyShark property report; also NYC Landmarks Preservation Commission NoHo Historic District designation report (LP-2039)'),
  yearBuilt: confirmed('1895\u201396', 'NYC Landmarks Preservation Commission, NoHo Historic District designation report (LP-2039) \u2014 DOF/PropertyShark records separately list 1900'),
  architect: confirmed('Cleverdon & Putzel', 'NYC Landmarks Preservation Commission, NoHo Historic District designation report (LP-2039)'),
  architecturalStyle: confirmed('Romanesque Revival', 'NYC Landmarks Preservation Commission, NoHo Historic District designation report (LP-2039)'),
  originalUse: confirmed('Warehouse, built for original owner Edward Judson', 'NYC Landmarks Preservation Commission, NoHo Historic District designation report (LP-2039)'),
  zoning: confirmed('M1-5/R9A', 'PropertyShark property report'),
  specialDistrict: confirmed('SoHo-NoHo Mixed Use District (SNX)', 'PropertyShark property report'),
  ownership: confirmed('Individually owned units (condominium)', 'PropertyShark property report — unit-by-unit ownership records'),
  historicDistrict: confirmed('NoHo Historic District', 'PropertyShark property report; NYC Landmarks Preservation Commission designation'),
  exteriorWall: confirmed('Masonry load-bearing wall', 'PropertyShark property report'),
  buildingSqFt: confirmed(21850, 'PropertyShark property report'),
  residentialSqFt: confirmed(15390, 'PropertyShark property report'),
  avgResidentialUnitSize: confirmed(1924, 'PropertyShark property report'),
  commercialSqFt: confirmed(2430, 'PropertyShark property report — ground-floor retail'),
  currentManagingAgent: confirmed('The Andrews Organization (Stuart Smolar)', 'PropertyShark property report, citing NYC HPD building registration filed 9/12/2025'),
  currentCorporation: confirmed('382 Condominium Company', 'PropertyShark property report, citing NYC HPD building registration'),
  groundFloorTenant: confirmed('Screaming Mimi’s, the longtime NoHo vintage clothing shop', 'PropertyShark property report, citing NYC commercial occupancy records'),
  recentCapitalWork: confirmed('an elevator modernization (permit issued 2025) and a facade/roof restoration (a roughly $235,000 general-construction permit covering floors 2 through 9 and the roof)', 'PropertyShark property report, citing NYC DOB permit filings'),
  samanthaUnit: confirmed('Unit 4 (purchased 3/23/2023)', 'PropertyShark property report — unit ownership records list Samantha Gasmer as owner of Unit 4'),
  character: 'A boutique, pre-war loft condominium of the kind NoHo is known for — full-floor residences, cast-iron and masonry construction, nine units total rather than a large roll of shareholders.',
};

// ============================================================
// Interior gallery — real, sourced photography
// ============================================================
// 382 Lafayette has no rooftop, gym, or shared amenity space of its own
// (confirmed via StreetEasy: "No info on wellness and recreation," "No info
// on shared outdoor space" — it's a 9-unit elevator building, nothing more).
// These three images are from the public 2023 sale listing of Unit 4 itself
// — Samantha's own home — photographed by SERHANT. at the time of that sale.
// Used here with visible photo credit; not Camelot photography, and not a
// current condition guarantee. Sourced 9/5/2026.
export interface GalleryPhoto {
  src: string;
  caption: string;
  credit: string;
}

export const LAFAYETTE_INTERIOR_GALLERY: GalleryPhoto[] = [
  {
    src: '/pitch/382-lafayette-street/gallery/unit4-living-room.jpg',
    caption: 'Unit 4 \u2014 living room, four-window bay over Lafayette Street',
    credit: 'SERHANT., 2023 sale listing',
  },
  {
    src: '/pitch/382-lafayette-street/gallery/unit4-kitchen.jpg',
    caption: 'Unit 4 \u2014 kitchen',
    credit: 'SERHANT., 2023 sale listing',
  },
  {
    src: '/pitch/382-lafayette-street/gallery/unit4-dining-library.jpg',
    caption: 'Unit 4 \u2014 dining and library wall',
    credit: 'SERHANT., 2023 sale listing',
  },
];

export const LAFAYETTE_GALLERY_NOTE =
  'These are from the public listing photography of the March 2023 sale of Unit 4 itself \u2014 not current Camelot photography, and not a representation of current condition. 382 Lafayette is a nine-unit elevator building with no rooftop deck, gym, or other shared amenity space of its own; there is nothing to show there. Credited to the photographer\u2019s original brokerage throughout.';

// ============================================================
// The referral / intro context
// ============================================================

export const LAFAYETTE_CONTACT = {
  name: 'Samantha Gasmer',
  referredBy: 'Jason Monkarsh',
  context:
    "Samantha reached out because her building's board is exploring a change of management company. This is a first-conversation package — prepared ahead of a scheduling call, before any pricing or proposal has been discussed.",
};

// ============================================================
// Camelot — company facts (verified against camelot.nyc and the
// Camelot brochure; kept consistent with the Oak Park pitch's
// CAMELOT_COMPANY_FACTS so every instance of this system agrees)
// ============================================================

export const CAMELOT_FACTS = {
  founded: confirmed(2006, 'camelot.nyc; "Camelot — A Journal of Considered Ownership" brochure'),
  buildings: confirmed(47, 'David Goldoff, September 2026'),
  aum: confirmed('$240M+', 'camelot.nyc'),
  boutiqueCondos: confirmed(26, '"Camelot — A Journal of Considered Ownership" brochure'),
  footprint: confirmed(
    'New York City (Manhattan, Brooklyn, Queens, Long Island City), with an expanding presence in Riverdale, Westchester, and New Jersey, plus a first South Florida engagement underway',
    'camelot.nyc; internal company facts'
  ),
  southFloridaNote: confirmed(
    "Camelot's first South Florida management engagement is an 89-unit condominium in North Miami, working alongside a court-appointed receiver and local CAM-licensed partners.",
    'camelot.nyc'
  ),
  affiliations: ['REBNY', 'IREM', 'SPONY', 'NYAA', 'NYARM', 'BOMA', 'CNYC'],
  reBnyCommittee: 'Member, REBNY Residential Management Committee',
  officeAddress: '57 West 57th Street, Suite 410, New York, NY 10019',
  executiveOfficeAddress: '501 Madison Avenue, 4th Floor, New York, NY 10022',
  officePhone: '(212) 206-9939',
  website: 'www.camelot.nyc',
  linkedin: 'https://www.linkedin.com/company/camelot-realty-group',
  officeCoords: { lat: 40.76438, lon: -73.97654 },
  executiveOfficeCoords: { lat: 40.7605, lon: -73.9733 },
  presidentTrackRecordUrl: 'https://david-goldoff-camelot-president.netlify.app/',
  blogUrl: 'https://www.camelot.nyc/blog/',
  ownersGuideUrl: 'https://www.camelot.nyc/2026-nyc-property-owners-guide/',
};

// Straight-line distance from 382 Lafayette St (40.72774, -73.99366, per
// PropertyShark) to Camelot's office at 57 West 57th Street (40.76438,
// -73.97654, per Camelot's own records) — computed via the haversine
// formula from those two sourced coordinate pairs, not looked up as a
// pre-packaged "distance" figure.
export const LAFAYETTE_TO_OFFICE_MILES = 2.7;

// Straight-line distance from 382 Lafayette St to Camelot's executive
// office at 501 Madison Avenue (40.7605, -73.9733) -- same haversine
// method as above.
export const LAFAYETTE_TO_EXEC_OFFICE_MILES = 2.5;

// Sample MDS monthly board reporting package — the same illustrative,
// fictional-coop sample ("999 Owner's Corp", not any real client's data)
// already built for the Oak Park pitch; reused here rather than
// duplicated, since it demonstrates the same MDS platform.
export const MDS_SAMPLE_PAGE_COUNT = 20;
export const MDS_SAMPLE_BASE = '/pitch/oak-park-douglaston';

export const CAMELOT_MISSION =
  "Camelot is a boutique property management and real estate company offering round-the-clock service built for the specific needs of New York's smaller, higher-touch buildings \u2014 the ones a large management company tends to treat as an afterthought.";

// ============================================================
// Track record — emphasizing the immediate neighborhood first
// ============================================================

export interface TrackRecordItem {
  name: string;
  neighborhood: string;
  note: string;
  distance?: string;
}

// The three closest Camelot-portfolio buildings to 382 Lafayette Street,
// ranked by straight-line (haversine) distance computed from the same
// cross-checked coordinates used in LAFAYETTE_NEIGHBORING_PORTFOLIO below
// -- not an eyeballed guess. Order: 39 Spring St (0.35 mi), 402 West
// Broadway (0.49 mi), 202 Spring St (0.50 mi).
export const LAFAYETTE_NEARBY_TRACK_RECORD: TrackRecordItem[] = [
  {
    name: '39 Spring Street',
    neighborhood: 'NoLIta',
    distance: '0.35 miles away -- about a 7-minute walk',
    note: 'The single closest address in Camelot\u2019s portfolio to 382 Lafayette Street -- practically next door.',
  },
  {
    name: '402 West Broadway',
    neighborhood: 'SoHo',
    distance: '0.49 miles away -- about a 9-minute walk',
    note: 'A SoHo corner building at Spring Street, in the same loft-conversion building stock as 382 Lafayette.',
  },
  {
    name: '202 Spring Street',
    neighborhood: 'SoHo',
    distance: '0.50 miles away -- about a 9-minute walk',
    note: 'Near Sullivan and Thompson, a five-minute walk from the Spring Street 6 train -- the same commute 382 Lafayette residents already use.',
  },
];

// ============================================================
// Neighboring portfolio map — past & present Camelot-portfolio
// buildings in the TriBeCa / SoHo / NoLIta corridor around 382
// Lafayette Street, as named directly by David. Coordinates are
// best-effort geocodes (cross-checked against MapQuest, Wikipedia,
// and CityRealty address records where available, and otherwise
// placed against known NYC cross-street geography) for plotting on
// a real street map — illustrative placement for orientation, not
// survey-grade.
// ============================================================

export interface NearbyPortfolioProperty {
  address: string;
  neighborhood: string;
  crossStreets: string;
  lat: number;
  lng: number;
}

export const LAFAYETTE_NEIGHBORING_PORTFOLIO: NearbyPortfolioProperty[] = [
  { address: '25–27 Mercer Street', neighborhood: 'SoHo', crossStreets: 'near Grand St', lat: 40.7208, lng: -74.0019 },
  { address: '39 Spring Street', neighborhood: 'NoLIta', crossStreets: 'near Mott/Mulberry', lat: 40.7229, lng: -73.9958 },
  { address: '202 Spring Street', neighborhood: 'SoHo', crossStreets: 'near Sullivan/Thompson', lat: 40.7241, lng: -74.0018 },
  { address: '402 West Broadway', neighborhood: 'SoHo', crossStreets: 'at Spring St', lat: 40.7256, lng: -74.0026 },
  { address: '283 West Broadway', neighborhood: 'TriBeCa/SoHo border', crossStreets: 'near Canal St', lat: 40.7205, lng: -74.0043 },
  { address: '104–109 Reade Street', neighborhood: 'TriBeCa', crossStreets: 'near Church/Hudson', lat: 40.7156, lng: -74.0088 },
  { address: '137 Franklin Street', neighborhood: 'TriBeCa', crossStreets: 'at Varick St', lat: 40.7186, lng: -74.0064 },
  { address: '58 White Street', neighborhood: 'TriBeCa', crossStreets: 'near Broadway/Church', lat: 40.7183, lng: -74.0038 },
  { address: '68 Thomas Street', neighborhood: 'TriBeCa', crossStreets: 'near West Broadway/Church', lat: 40.7161, lng: -74.0055 },
  { address: '1 North Moore Street', neighborhood: 'TriBeCa', crossStreets: 'at West Broadway', lat: 40.7198, lng: -74.0087 },
  { address: '11 North Moore Street', neighborhood: 'TriBeCa', crossStreets: 'at Varick/Beach', lat: 40.7204, lng: -74.0096 },
  { address: '465 Washington Street', neighborhood: 'TriBeCa', crossStreets: 'near Canal/Watts', lat: 40.7244, lng: -74.0096 },
  { address: '471 Washington Street', neighborhood: 'TriBeCa', crossStreets: 'near Canal/Watts', lat: 40.7248, lng: -74.0099 },
  { address: '290 West Street', neighborhood: 'TriBeCa', crossStreets: 'at Canal St', lat: 40.7222, lng: -74.0117 },
  { address: '11 Hubert Street', neighborhood: 'TriBeCa', crossStreets: 'at Hubert/Collister', lat: 40.7202, lng: -74.0113 },
  { address: '157 Hudson Street', neighborhood: 'TriBeCa', crossStreets: 'near Hubert/Collister', lat: 40.7198, lng: -74.0093 },
];

export const LAFAYETTE_FAR_PORTFOLIO_NOTE =
  'Also in the portfolio, a short subway ride north in Chelsea: 236 West 24th Street.';

export const CAMELOT_PORTFOLIO_HIGHLIGHTS: TrackRecordItem[] = [
  {
    name: 'The Watermark at Brooklyn Heights',
    neighborhood: 'Brooklyn Heights',
    note: 'Selected Camelot for property management.',
  },
  {
    name: 'Sarva Properties portfolio',
    neighborhood: 'New York City',
    note: 'A six-building portfolio Camelot was retained to manage and maintain.',
  },
  {
    name: '949 Park Avenue Condominium',
    neighborhood: 'Upper East Side',
    note: 'A Camelot client relationship in place since 2012.',
  },
  {
    name: 'Peak Capital Partners portfolio',
    neighborhood: 'New York City',
    note: 'Camelot was hired as managing agent across this ownership group\u2019s New York City holdings.',
  },
];

// ============================================================
// Services — grouped for an intro conversation, not a full
// proposal. No pricing attached to any of these.
// ============================================================

// ============================================================
// Case studies — sourced from camelot.nyc/blog and press releases.
// Real outcomes with real numbers, not composites.
// ============================================================

export interface CaseStudy {
  title: string;
  building: string;
  url?: string;
  summary: string;
  stat: string;
}

// The first two entries below are sourced from a public camelot.nyc post
// or press release (each has a url). The final two -- 58 White Street
// and 949 Park Avenue -- are drawn from an internal Camelot document (a
// 90-Day Transition Plan prepared for another building's board) rather
// than a public webpage, so they carry no url; both are real, both are
// steps from a negative starting point to a resolved one, and 58 White
// Street doubles as one of the closest addresses in Camelot's own
// portfolio to 382 Lafayette Street (0.84 miles away, per
// LAFAYETTE_NEIGHBORING_PORTFOLIO).
export const LAFAYETTE_CASE_STUDIES: CaseStudy[] = [
  {
    title: 'The NYC Co-op That Saved $45,000 in Year One After Switching Management Companies',
    building: '73-unit Manhattan co-op',
    url: 'https://www.camelot.nyc/nyc-coop-saved-45000-switching-management-companies/',
    summary:
      'A line-by-line review of the P&L, every service contract, and every vendor relationship found two overlapping elevator maintenance contracts, an un-renegotiated energy supply contract, an oversized landscaping contract, and insurance that hadn\u2019t been shopped in six years \u2014 plus arrears running at 4.5% of revenue that came down to under 1%. The building was also brought into Local Law 97 compliance (it had been running roughly 18% over its 2024 emissions limit) through a retro-commissioning audit, a boiler tune-up, and targeted LED upgrades, avoiding an estimated $22,000 in annual fines.',
    stat: '$45,000+ saved in year one',
  },
  {
    title: 'Camelot Expands Into North Miami at Three Horizons East',
    building: 'Three Horizons East Condominium, North Miami, FL — 89 units',
    url: 'https://www.camelot.nyc/blog/',
    summary: 'Camelot\u2019s first South Florida management engagement, focused on stabilization, operational modernization, resident communication, and long-term value preservation for an 89-unit residential community.',
    stat: 'Camelot\u2019s first South Florida engagement',
  },
  {
    title: 'Camelot Realty Group Appointed Managing Agent for East of East Lofts',
    building: 'East of East Lofts, Long Island City',
    url: 'https://www.camelot.nyc/east-of-east-lofts-long-island-city/',
    summary: 'A boutique, full-floor-unit loft condominium \u2014 the same building type as 382 Lafayette Street \u2014 where Camelot was appointed managing agent, bringing the firm\u2019s managed portfolio to 54 properties across Manhattan, Brooklyn, Queens, and Westchester County at the time.',
    stat: 'Same boutique loft-building profile as 382 Lafayette',
  },
  {
    title: 'Under Budget, Ahead of Schedule: A TriBeCa Facade Restoration',
    building: '58 White Street, TriBeCa -- 0.84 miles from 382 Lafayette Street',
    summary:
      'A Local Law 11/FISP facade cycle that started as an open violation and an unscoped repair became a managed capital project: Camelot ran the bid process, held the contractor to the schedule, and closed out the work 45 days ahead of the original timeline and under the approved budget -- turning a compliance liability into a completed capital improvement the board could point to.',
    stat: 'Facade restoration finished 45 days early, under budget',
  },
  {
    title: 'From a $200,000 Insurance Claim to a Contained Loss',
    building: '949 Park Avenue, Upper East Side',
    summary:
      'Window damage that could have become an uninsured, board-absorbed repair bill instead became a documented, fully pursued insurance claim -- Camelot\u2019s financial administration team built the claim file, pushed it through the carrier, and recovered roughly $200,000 that would otherwise have landed on the building\u2019s reserves.',
    stat: '~$200,000 in damage recovered through insurance, not reserves',
  },
];

// ============================================================
// Technology & strategic partnerships — sourced from
// camelot.nyc/resident-tools/ and Camelot\u2019s own brochure copy.
// ============================================================

export interface TechPartner {
  name: string;
  role: string;
  description: string;
  logo?: string;
  logoIsWordmark?: boolean;
  url?: string;
}

const TECH_LOGO_BASE = '/pitch/382-lafayette-street/partner-logos';

export const LAFAYETTE_TECH_PARTNERS: TechPartner[] = [
  {
    name: 'MDS (Multi-Data Services)',
    role: 'Accounting system of record',
    description: 'Full general ledger, accounts payable/receivable, budgeting, and the monthly board reporting package \u2014 cash flow, bank reconciliations, check register, unpaid and paid-invoice images \u2014 kept separately reconciled for every building Camelot manages.',
    logo: `${TECH_LOGO_BASE}/mds-logo.svg`,
    url: 'https://multidataservices.com',
  },
  {
    name: 'Concierge Plus',
    role: 'Resident & Board experience portal',
    description: 'A branded resident and Board portal \u2014 announcements, package tracking, amenity/common-area communication, and document access. Included in the base management fee, with front-desk and Board training provided directly by Camelot as part of onboarding.',
    logo: `${TECH_LOGO_BASE}/conciergeplus-mark.png`,
    url: 'https://conciergeplus.com',
  },
  {
    name: 'BuildingLink',
    role: 'Resident/maintenance operations',
    description: 'Work orders and tickets, amenity reservations, package logistics, and the front-desk log \u2014 the record of daily building life, searchable by staff and visible to residents in real time. Where a building already runs BuildingLink, Camelot reviews the license and version rather than layering on a second system.',
    logo: `${TECH_LOGO_BASE}/buildinglink-logo.png`,
    url: 'https://www.buildinglink.com',
  },
  {
    name: 'Domecile (BoardPackager)',
    role: 'Digital board-application platform',
    description: 'A secure, paperless platform for sale, refinance, transfer, lease, and sublease applications \u2014 applicants, brokers, and the Board all work from the same digital package instead of paper.',
    logo: `${TECH_LOGO_BASE}/domecile-logo.svg`,
    url: 'https://www.domecile.com',
  },
  {
    name: 'Meet Select',
    role: 'Resident lifestyle membership',
    description: 'A private membership extended to residents \u2014 a dedicated concierge team and access to more than 1.6 million partner locations across dining, retail, travel, and entertainment, beyond whatever a building\u2019s own front desk can arrange.',
    logoIsWordmark: true,
    url: 'https://www.meetselect.com',
  },
  {
    name: 'Camelot OS',
    role: 'Our proprietary operating layer',
    description: 'Camelot\u2019s own intelligence layer \u2014 owner and board reporting, live NYC Open Data compliance monitoring (HPD/DOB/ACRIS), cost benchmarking against Camelot\u2019s own portfolio, and staff accountability, all in one dashboard for every building Camelot manages.',
    logoIsWordmark: true,
  },
];

export interface ServiceGroup {
  category: string;
  items: string[];
}

export const CAMELOT_SERVICES: ServiceGroup[] = [
  {
    category: 'Day-to-day management',
    items: [
      'Managing-agent services and building operations oversight',
      'Regular, scheduled on-site presence \u2014 not a manager you only hear from when something breaks',
      'Vendor sourcing, contract oversight, and a bench of licensed and bonded contractors built over two decades',
      'Building maintenance coordination and preventive-maintenance scheduling',
      '24/7 after-hours emergency support with a 48-hour guaranteed response time as a baseline commitment, not a best effort',
    ],
  },
  {
    category: 'Financial & compliance',
    items: [
      'Monthly financial reporting, budgeting, and books maintained by an in-house accounting team',
      'Compliance support: Local Law 97 energy benchmarking, Local Law 11/FISP facade cycles, RPIE filings, DOB/HPD violation tracking and resolution',
      'Insurance placement shopped across multiple brokers rather than a single in-house relationship',
    ],
  },
  {
    category: 'Governance & transition',
    items: [
      'Board meeting support, agendas, and management reporting',
      'Support through sponsor-to-board transitions and newly formed boards \u2014 including the specific settling-in issues that come with a small, self-managed or recently transitioned building',
      'A documented transition plan for moving off an outgoing manager: general ledger handoff, arrears reconciliation, and a records-collection protocol',
    ],
  },
  {
    category: 'Resident experience',
    items: [
      'Concierge Plus, a resident and board portal for payments, work orders, and document access',
      'Meet Select, a resident rewards program offering discounts with connected vendors, restaurants, and travel services',
      'In-house legal counsel and in-house accounting resources supporting every account Camelot manages',
    ],
  },
  {
    category: 'Beyond management',
    items: [
      'Brokerage and leasing services through Camelot Brokerage Services Corp \u2014 a separate, independently licensed entity and agreement from property management',
      'Access to capital-partner relationships (through Penn South Capital and Goldoff Equity Group) for ownership groups considering acquisition, refinancing, or repositioning',
      'Financing & capital advisory as a separate engagement \u2014 Camelot runs a lender RFP, levels quotes into an apples-to-apples comparison, and coordinates the bank file through closing for a refinance, new loan, or capital-improvement credit line, structured outside the base management fee',
    ],
  },
];

// ============================================================
// Cover letter — addressed to Samantha and the Board
// ============================================================

export const LAFAYETTE_COVER_LETTER_PARAGRAPHS: string[] = [
  'Samantha \u2014 thank you for thinking of Camelot, and please pass along our thanks to your uncle Jason as well. What follows is an introduction ahead of your call with the Board \u2014 not a sales pitch, just a clear picture of who we are and what we do.',
  'Camelot Realty Group has been managing buildings in New York City for twenty years. We got our start in Lower Manhattan \u2014 servicing buildings in TriBeCa, SoHo, NoHo, and the West Village \u2014 and have grown from there into a platform that today manages 47 buildings and more than $240 million in assets, 26 of them boutique, full-amenity condominiums much like 382 Lafayette Street. Our full managed portfolio is browsable on our website at camelot.nyc/managed-buildings.',
  'We still work in this immediate corridor today. Camelot manages 137 Franklin Street Apartment Corp in TriBeCa, a short walk from you, and has supported building improvements at 111 Mott Street in NoLIta, five minutes away \u2014 and our current and past portfolio runs through most of the blocks around you, from Mercer and Spring Streets down through TriBeCa. NoHo and the streets around it are not new territory for us.',
  'What follows is an introduction, not a pitch with a number attached \u2014 we haven\u2019t discussed pricing, and we\u2019re not going to guess at one before we understand what the Board actually needs. Instead, this covers who we are, what a Camelot-managed building looks like day to day, and where we\u2019ve done this kind of work before.',
  'We\u2019d welcome the chance to speak with the full Board \u2014 by phone, video, or in person, whichever is easiest to coordinate. Once you have a day and time, we\u2019ll send a calendar invite over.',
];

export const LAFAYETTE_NEXT_STEP =
  'Before we talk about a fee, tell us what isn\u2019t working. A short list of what\u2019s frustrating about the current arrangement, a look at recent financials, and the honest version of what you\u2019d want from the next management company \u2014 that\u2019s what turns this from a pitch into a real conversation.';

export const LAFAYETTE_NEXT_STEP_FOLLOWUP =
  'We won\u2019t pretend to have it solved before we\u2019ve heard it. What we can promise is that we listen first, ask the questions that actually matter, and come back with a specific plan \u2014 not a boilerplate proposal \u2014 that the Board can hold us to. From there, the next step is a meeting with the people who\u2019ll actually decide: we walk through exactly how we\u2019d approach 382 Lafayette Street, and we leave with a plan and a set of commitments both sides can act on.';

export interface MeetingPrepItem {
  label: string;
  detail: string;
}

export const LAFAYETTE_WHAT_TO_BRING: MeetingPrepItem[] = [
  {
    label: 'The pain points',
    detail: 'What isn\u2019t working today, specifically \u2014 not a general complaint, but where it actually breaks down.',
  },
  {
    label: 'Recent financials',
    detail: 'A look at where the building stands \u2014 budget, reserves, arrears \u2014 so any plan we propose is grounded in the real numbers, not a guess.',
  },
  {
    label: 'The wish list',
    detail: 'What an ideal management relationship would actually look like for this Board, in plain terms.',
  },
];

export const LAFAYETTE_WHAT_YOU_GET: MeetingPrepItem[] = [
  {
    label: 'A real listening session',
    detail: 'We ask the questions that matter and let the Board talk \u2014 no pitch deck running in the background.',
  },
  {
    label: 'A specific plan, not a template',
    detail: 'We come back with a written response to what we actually heard, not a boilerplate proposal.',
  },
  {
    label: 'A meeting with decision-makers',
    detail: 'The people who can actually say yes, in the same room, working through the plan together.',
  },
];

// ============================================================
// Senior team — introduced generally; no specific property
// manager has been assigned yet since no engagement exists.
// ============================================================

export interface LeaderProfile {
  name: string;
  role: string;
  photo: string;
  bio: string;
}

export const CAMELOT_LEADERSHIP: LeaderProfile[] = [
  {
    name: 'David A. Goldoff',
    role: 'President & Owner, Camelot Realty Group',
    photo: '/pitch/382-lafayette-street/team/david-goldoff.jpg',
    bio: 'In New York real estate since 2000; founded Camelot in 2006. Licensed real estate broker, general partner across multiple buildings, and a general partner in Penn South Capital and Goldoff Equity Group.',
  },
  {
    name: 'Valerie Fiume',
    role: 'Senior Director, Condo & Co-Op Services',
    photo: '/pitch/382-lafayette-street/team/valerie-fiume.jpg',
    bio: 'Oversees Camelot\u2019s condo and co-op portfolio and leads escalations, management standards, and transition oversight for every account.',
  },
  {
    name: 'Tim Kelly',
    role: 'Director of Facilities Management & Staff Training',
    photo: '/pitch/382-lafayette-street/team/tim-kelly.jpg',
    bio: 'Leads facilities standards and staff training across the portfolio \u2014 mechanical systems review, preventive-maintenance scheduling, and building real SOPs with on-site staff.',
  },
  {
    name: 'Vincent Melilo',
    role: 'Controller',
    photo: '/pitch/382-lafayette-street/team/vincent-melilo.jpg',
    bio: 'Oversees accounting operations firm-wide \u2014 the accountable lead for monthly closes, books, and budgets across the portfolio.',
  },
  {
    name: 'Anthony Abruzzo, CPA',
    role: 'Chief Financial Officer & Senior Managing Tax Director',
    photo: '/pitch/382-lafayette-street/team/anthony-abruzzo.jpg',
    bio: 'Licensed CPA overseeing all financial reporting internally and for clients, and works closely with boards to define budget goals and options. Works alongside his father\u2019s firm, Abruzzo Accounting.',
  },
  {
    name: 'Robert Isaacs',
    role: 'Senior Managing Director, Head of Asset Management & Compliance',
    photo: '/pitch/382-lafayette-street/team/robert-isaacs.jpg',
    bio: 'Oversees asset management and compliance across the Camelot portfolio. Previously ran RHI Group LLC and served as owner\u2019s representative for a Queens rental portfolio Camelot manages.',
  },
  {
    name: 'Steven Milewicz',
    role: 'Chief Legal Officer, M&A',
    photo: '/pitch/382-lafayette-street/team/steven-milewicz.jpg',
    bio: 'Handles M&A transactions and capital raises, providing legal guidance across Camelot\u2019s investment and acquisition activities.',
  },
  {
    name: 'Eleni Palmeri',
    role: 'Licensed Real Estate Salesperson, Brokerage & Sales',
    photo: '/pitch/382-lafayette-street/team/eleni-palmeri.jpg',
    bio: 'Specializes in Manhattan and Eastern Long Island markets, bringing 15 years of NYC sales experience and a client-first approach rooted in honesty and trust.',
  },
  {
    name: 'Anthony Tavaglione',
    role: 'Senior Controller & Accounting Manager',
    photo: '/pitch/382-lafayette-street/team/anthony-tavaglione.jpg',
    bio: 'Senior controller supporting Camelot\u2019s Finance & Accounting team \u2014 monthly closes, budgets, and reporting across the managed portfolio.',
  },
];

// ============================================================
// First 90 days — the transition plan, adapted from a real 90-Day
// Transition Plan Camelot prepared for another building's board
// (source: internal Camelot document, not a public camelot.nyc page),
// generalized here for a boutique condominium like 382 Lafayette
// rather than the union co-op the original document was written for.
// ============================================================

export interface NinetyDayActivity {
  activity: string;
  outcome: string;
}

export interface NinetyDayPhase {
  phase: string;
  days: string;
  emoji: string;
  headline: string;
  summary: string;
  activities: NinetyDayActivity[];
  deliverable: string;
}

export const LAFAYETTE_90_DAY_PLAN: NinetyDayPhase[] = [
  {
    phase: 'Phase 1',
    days: 'Days 1\u201330',
    emoji: '\ud83d\udd0d',
    headline: 'Discovery',
    summary:
      'Everything starts with a clean, documented picture of the building \u2014 no assumptions carried over from the outgoing manager.',
    activities: [
      { activity: 'Kickoff meeting, staff introductions, full document and records collection', outcome: 'Building Assessment Brief' },
      { activity: 'On-site walkthrough with the property manager and Camelot\u2019s facilities lead \u2014 a free inspection, not billed', outcome: 'Facilities Report' },
      { activity: 'Financial audit: general ledger handoff, arrears reconciliation, every vendor contract reviewed line by line', outcome: 'Financial Health Memo' },
      { activity: 'Compliance check across Local Law 97, Local Law 11/FISP, and open DOB/HPD violations', outcome: 'Compliance Snapshot + Vendor Priority List' },
    ],
    deliverable: 'Board receives a written Building Assessment, Facilities Report, and Financial Health Memo \u2014 the real starting point, on paper.',
  },
  {
    phase: 'Phase 2',
    days: 'Days 31\u201360',
    emoji: '\u2699\ufe0f',
    headline: 'Optimization',
    summary:
      'With the picture clear, Camelot moves on what it found \u2014 vendor contracts go out to bid, technology goes live, and the first real board report goes out.',
    activities: [
      { activity: 'RFPs issued to priority vendors identified in Phase 1; insurance shopped across multiple brokers, not one relationship', outcome: 'Competitive Bid Summary' },
      { activity: 'Camelot\u2019s technology stack activated: MDS accounting system, Concierge Plus resident portal, BuildingLink (or existing system reviewed rather than duplicated)', outcome: 'Technology Deployment Confirmation' },
      { activity: 'Bank account relationships and reconciliation processes established', outcome: 'Financial migration complete' },
      { activity: 'First full Camelot monthly board reporting package issued', outcome: 'First Camelot Monthly Report' },
    ],
    deliverable: 'The board sees its first Camelot-produced monthly report and a live resident portal \u2014 the new normal, in motion.',
  },
  {
    phase: 'Phase 3',
    days: 'Days 61\u201390',
    emoji: '\ud83d\udcc8',
    headline: 'Stabilization & Reporting',
    summary:
      'By day 90, Camelot delivers the first measurable proof of value \u2014 documented savings, a live technology platform, and a 12-month plan the board can hold Camelot to.',
    activities: [
      { activity: 'Vendor rebid summary presented with savings achieved versus benchmark', outcome: 'Projected savings documented and board-approved' },
      { activity: 'New vendor contracts finalized and executed with no service interruption', outcome: 'New contracts live' },
      { activity: 'Energy baseline finalized and Local Law 97 compliance roadmap submitted', outcome: 'Carbon budget mapped, reduction targets set' },
      { activity: 'Comprehensive 90-Day Board Presentation: financial scorecard, cost-reduction summary, technology report, compliance dashboard, and the 12-month operating plan', outcome: '90-Day Performance Report + 12-Month Operating Plan' },
    ],
    deliverable: 'A live board presentation covering every accomplishment, every dollar saved, and exactly what happens in month four \u2014 no surprises, all documented.',
  },
];

export const LAFAYETTE_90_DAY_COMMITMENT =
  'Camelot is not the cheapest option \u2014 and we do not aim to be. Our value is the combination of experienced professionals, institutional-quality financial oversight, and a technology infrastructure built specifically for buildings like 382 Lafayette Street.';

// ============================================================
// Recognition \u2014 sourced from camelot.nyc/awards/ and the
// Camelot 2025 Year in Review PDF. Real, dated, named awards \u2014
// not a generic "award-winning" claim.
// ============================================================

export interface Award {
  title: string;
  recipient: string;
  organization: string;
  date: string;
  detail: string;
}

export const CAMELOT_AWARDS: Award[] = [
  {
    title: 'Property Management Company of the Year',
    recipient: 'Camelot Realty Group',
    organization: 'RED Awards (Commercial Real Estate)',
    date: 'April 2025',
    detail: 'Recognizing outstanding leadership and excellence in property management across New York.',
  },
  {
    title: 'Residential Management Community Service Award',
    recipient: 'David Goldoff',
    organization: 'REBNY \u2014 25th Annual Residential Management Leadership Breakfast',
    date: 'November 6, 2025',
    detail: 'Recognizing exceptional commitment to community and charitable work in New York, at the New York Hilton Midtown.',
  },
];

// ============================================================
// Community & charitable giving \u2014 sourced from Camelot Realty
// Group's own Facebook post (June 9, 2025) and camelot.nyc's 2025
// Year in Review. This sits underneath the awards deliberately:
// recognition the industry gave Camelot, followed by what Camelot
// gives back.
// ============================================================

export interface CharitableEvent {
  title: string;
  cause: string;
  role: string;
  partner: string;
  date: string;
  location: string;
  detail: string;
}

export const CAMELOT_CHARITABLE_GIVING: CharitableEvent = {
  title: '15th Annual AMRF Golf Tournament',
  cause: 'American Medical Research Foundation (AMRF), a 501(c)(3) dedicated to Crohn\u2019s & Colitis research and support',
  role: 'Co-sponsor',
  partner: 'Andrew Brucker of Fox Rothschild LLP',
  date: 'September 15, 2025',
  location: 'Hampshire Country Club, Mamaroneck, NY',
  detail:
    'Camelot Realty Group co-sponsored the tournament alongside Fox Rothschild LLP, bringing together landlords, vendors, investors, bankers, and operators from New York, Connecticut, and New Jersey for a day of golf in support of Crohn\u2019s & Colitis research \u2014 part of a broader year in which Camelot and its network raised over $50,000 for charitable causes.',
};

// ============================================================
// Testimonials \u2014 sourced verbatim from camelot.nyc/testimonials/.
// Selected for relevance to this specific intro: a board president
// at a nearby portfolio building going through the same sponsor-to-
// board transition dynamic, an owner at 949 Park Avenue (already
// referenced in the case studies above), and a sophisticated,
// international client voice.
// ============================================================

export interface Testimonial {
  quote: string;
  name: string;
  title: string;
}

export const CAMELOT_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Camelot has been a helpful agent representing our Co-op since we moved into our new home. As a new Board President and my first real estate venture, we really relied on them for their experience in understanding protocols, building-wide systems, and the business of running a building.',
    name: 'Brandon Miller',
    title: 'Board President, 137 Franklin Street Apartment Corp',
  },
  {
    quote:
      'I have been a client of Camelot Realty Group since buying my apartment in 2012. Valerie and David have been by my side as not only the best and most knowledgeable property managers but as family! Their experience and dedication is limitless and they go far beyond the expected for each and every one of their clients and properties.',
    name: 'Evee Georgiadis',
    title: 'Owner, 949 Park Avenue Condominium',
  },
  {
    quote:
      'As an overseas property owner, it is important to have a property manager that is responsive to both our and our tenants\u2019 needs, knowledgeable and experienced across the lifecycle of ownership, cost efficient and trustworthy. As Camelot\u2019s client for over three years we have come to appreciate the service, actions and advice the principals have provided.',
    name: 'Lawrence Lee',
    title: 'Managing Director, Laureat Hotel Investments Limited',
  },
];

export const CAMELOT_TESTIMONIAL_STATS = {
  clientRating: '5/5',
  yearsInNyc: '20+',
};

// ============================================================
// Published proof points \u2014 sourced verbatim from the camelot.nyc
// homepage. Real, stated numbers rather than vague claims.
// ============================================================

export const CAMELOT_PROOF_STATS = {
  avgSavingsFirstYear: confirmed('$45,000', 'camelot.nyc homepage \u2014 "Average annual savings boards find in the first 90 days"'),
  responseTimeSla: confirmed('48 hrs', 'camelot.nyc homepage \u2014 "Our guaranteed response time vs. weeks from large firms"'),
  betterCommunicationPct: confirmed('73%', 'camelot.nyc homepage \u2014 "Boards report better communication after switching to Camelot"'),
};

// ============================================================
// Fee philosophy \u2014 no pricing has been discussed for 382
// Lafayette Street, so no numbers appear here. This is Camelot's
// published fee philosophy, sourced verbatim from camelot.nyc/pricing/
// and camelot.nyc/property-management-fees-what-they-dont-tell-you/,
// included so the Board knows how Camelot thinks about fees before
// a number is ever discussed.
// ============================================================

export const CAMELOT_FEE_PHILOSOPHY =
  'Our fee structure is straightforward: a percentage-based management fee with a clear rate schedule for ancillary services, no hidden markups on vendor work, and all building funds held in segregated accounts in the building\u2019s name. No RFP required, no six-week \u201cscope analysis\u201d before you see a number. We publish our pricing philosophy on our own website because we believe transparency isn\u2019t just an ethical obligation \u2014 it\u2019s a competitive advantage.';

// ============================================================
// Local Law 97 \u2014 a specific, honest note for this specific
// building rather than generic compliance fear. At 21,850 sq ft
// (per LAFAYETTE_PROPERTY.buildingSqFt), 382 Lafayette Street sits
// just under LL97's 25,000 sq ft threshold. Numbers below sourced
// from camelot.nyc's own LL97 guide.
// ============================================================

export const LAFAYETTE_LL97_NOTE =
  'Local Law 97 covers buildings 25,000 square feet or larger, requiring a 40% cut in carbon emissions by 2030 and 80% by 2050 against a 2005 baseline \u2014 with penalties of $268 per metric ton of CO2 equivalent over the limit for the 2024\u20132029 compliance period. At roughly 21,850 square feet, 382 Lafayette sits just under that threshold today. Worth confirming as a fact, not assuming \u2014 and something Camelot tracks for every building it manages, covered or not, since a renovation or a use change can move a building across that line.';

// ============================================================
// FAQ \u2014 trimmed and adapted from camelot.nyc/faq/ for a
// co-op/condo board audience (the published FAQ also covers rental
// buildings, which isn't relevant here).
// ============================================================

export interface FaqItem {
  question: string;
  answer: string;
}

export const LAFAYETTE_FAQ: FaqItem[] = [
  {
    question: 'What does a property manager actually do day to day?',
    answer:
      'A property manager is the operational hub for a building \u2014 coordinating repairs and maintenance, preparing budgets and financial statements, managing vendor contracts, and ensuring compliance with NYC DOB, HPD, and other city agencies. In practice, that means everything from a 2 a.m. emergency call to an annual filing with the city.',
  },
  {
    question: 'How much does property management cost for a condo like ours?',
    answer:
      'For co-ops and condos in New York City, management fees typically run 5\u20137% of monthly maintenance or common charges collected, depending on building size and scope of services. We haven\u2019t discussed a number for 382 Lafayette yet \u2014 that comes after we understand the building and the Board\u2019s priorities, not before.',
  },
  {
    question: 'What\u2019s the actual process to switch management companies?',
    answer:
      'It starts with a complimentary consultation to understand the building\u2019s structure, current challenges, and goals. From there it\u2019s the three-phase, 90-day transition covered above \u2014 discovery, optimization, then stabilization and reporting \u2014 with a general ledger handoff and records-collection protocol so nothing falls through the cracks during the changeover.',
  },
  {
    question: 'Is Camelot actually licensed to do this?',
    answer:
      'Yes. In New York State, anyone managing real property, negotiating leases, or collecting rent on behalf of others generally needs a real estate broker\u2019s license from the NY Department of State. David Goldoff holds one, is an active REBNY member, and Camelot Brokerage Services Corp. is separately licensed for brokerage and leasing work.',
  },
  {
    question: 'What happens if something breaks at 2 a.m.?',
    answer:
      'Camelot provides 24/7 after-hours emergency support for every managed building, with a 48-hour guaranteed response time as a baseline commitment \u2014 not a best effort.',
  },
  {
    question: 'Are there fees I should know about before signing anything?',
    answer:
      'Ask us directly \u2014 we\u2019d rather you ask now than find it buried in an invoice later. Our approach: a clear rate schedule for ancillary services, no administrative markup added to vendor invoices, and all building funds held in segregated accounts in the building\u2019s own name.',
  },
];

// ============================================================
// Camelot OS — the internal tooling behind the pitch, verified
// live on camelot-os.onrender.com rather than described in the
// abstract. Real numbers as of the live check; nothing here is
// invented, and where a tool is still mid-build that's stated
// plainly rather than glossed over.
// ============================================================

export const CAMELOT_OS_PORTFOLIO_MIX = {
  totalBuildings: 41,
  totalUnits: 484,
  residentialUnits: 473,
  commercialUnits: 11,
  rentalBuildings: 16,
  rentalPct: 39,
  condoCoopBuildings: 25,
  condoCoopPct: 61,
  lastSync: 'Aug 29, 2026',
};

export interface CostCategory {
  category: string;
  note: string;
}

// Illustrative categories, not a real budget analysis — 382 Lafayette's
// actual financials haven't been uploaded yet. Modeled on the real,
// documented categories from the $45,000-saved co-op case study above
// (LAFAYETTE_CASE_STUDIES), scaled down for a 9-unit boutique building
// rather than a 73-unit co-op.
export const LAFAYETTE_COST_PREVIEW: CostCategory[] = [
  { category: 'Elevator maintenance', note: 'Overlapping or unshopped service contracts are one of the most common finds across Camelot\u2019s portfolio.' },
  { category: 'Insurance', note: 'Policies that haven\u2019t been shopped across multiple brokers in several years, per Camelot\u2019s standard practice of comparing rather than renewing.' },
  { category: 'Energy supply', note: 'Un-renegotiated gas/electric contracts, plus LL97-driven efficiency upgrades where they pencil out.' },
  { category: 'Vendor contracts generally', note: 'A line-by-line review of every service contract — landscaping, cleaning, security — against current market rates.' },
];

export const LAFAYETTE_COST_PREVIEW_NOTE =
  'This isn\u2019t 382 Lafayette\u2019s real number \u2014 we don\u2019t have the building\u2019s financials yet. It\u2019s where Camelot typically finds savings in comparable boutique buildings, run through the same Cost-Beat methodology behind the $45,000 case study above. Send over a recent budget, financial statement, or audit and we\u2019ll run the real analysis, line by line.';

export interface OsTool {
  name: string;
  tagline: string;
  description: string;
  url: string;
  status: 'live' | 'in production';
}

export const CAMELOT_OS_TOOLS: OsTool[] = [
  {
    name: 'Report Center',
    tagline: 'Every proposal starts here.',
    description: 'Camelot\u2019s AI proposal engine \u2014 pulls live NYC public records into a full Property Intelligence Dossier, cost-reduction program, and transition plan, the same pipeline that built this page.',
    url: 'https://camelot-os.onrender.com/#/report-center',
    status: 'live',
  },
  {
    name: 'Portfolio',
    tagline: '41 buildings, one source of truth.',
    description: 'Every Camelot-managed building, synced live from Spire MDS \u2014 484 units across 41 buildings, refreshed continuously rather than reconstructed for each proposal.',
    url: 'https://camelot-os.onrender.com/#/portfolio',
    status: 'live',
  },
  {
    name: 'Cost-Beat Report Builder',
    tagline: 'The methodology behind every savings number we quote.',
    description: 'Line-by-line budget-vs-comparable analysis \u2014 their budget against a Camelot target, with evidence for every line, exported as a board-ready PDF.',
    url: 'https://camelot-os.onrender.com/#/cost-beat-report',
    status: 'live',
  },
  {
    name: 'Violation & Resolution Center',
    tagline: 'Real HPD, DOB, and ECB data, in real time.',
    description: 'Pulls live violation, penalty, and hearing data straight from NYC Open Data for any address \u2014 portfolio building or not \u2014 with an estimated resolution cost and the specific professionals needed to close each one out.',
    url: 'https://camelot-os.onrender.com/#/violations',
    status: 'live',
  },
  {
    name: 'Sentinel',
    tagline: 'Quarterly market intelligence, building by building.',
    description: 'Tracks $/sqft and market position for buildings across Camelot\u2019s footprint \u2014 including 137 Franklin Street and 58 White Street, both a few blocks from 382 Lafayette \u2014 and flags anything trading above or below its neighborhood.',
    url: 'https://camelot-os.onrender.com/#/sentinel',
    status: 'live',
  },
  {
    name: 'Template Concierge',
    tagline: 'Camelot\u2019s document library.',
    description: '21 ready documents across management agreements, compliance, leasing, governance, and reporting \u2014 most fillable through a short questionnaire into a branded, merge-filled document on the spot.',
    url: 'https://camelot-os.onrender.com/#/templates',
    status: 'live',
  },
];

export const CAMELOT_DRIVE_NOTE =
  'Every new client gets a dedicated, on-demand Google Drive folder structure from day one \u2014 board packages, financials, vendor contracts, and compliance records, organized the same way for every building we manage. No waiting on an email to find a document; if you have Drive access, you already have the file.';

export const SENTINEL_NEARBY_STACKUP = [
  { building: '137 Franklin Street', neighborhood: 'TriBeCa/SoHo', pricePerSqFt: '$2,050', position: 'At market' },
  { building: '58 White Street', neighborhood: 'TriBeCa/SoHo', pricePerSqFt: '$2,200', position: 'Above market' },
];

// ============================================================
// Open items — everything still to confirm before this goes
// beyond an intro conversation
// ============================================================

export const LAFAYETTE_TO_BE_CONFIRMED: string[] = [
  'The governing condominium entity\u2019s exact legal name (HPD registration lists \u201c382 Condominium Company\u201d \u2014 confirm against the offering plan / bylaws)',
  'Which property manager would be assigned \u2014 not yet decided since there is no engagement or fee discussion yet',
  'Contract end date with the current managing agent and any transition timing constraints',
  'The Board\u2019s specific pain points and priorities \u2014 to be gathered on the introductory call, not assumed',
  'Current status of 25\u201327 Mercer Street \u2014 recent reporting (Commercial Observer, April 2025) describes a loan default/foreclosure action on this property; confirm current status before referencing it as an active engagement',
  'Current use of 283 West Broadway \u2014 recent listings show what may be a commercial/clinical tenant at this address; confirm before describing it as residential',
  'Year built: the NYC Landmarks Preservation Commission designation report gives 1895\u201396 (matching the Camelot OS intelligence report\u2019s 1896); DOF/PropertyShark separately record 1900. Both are shown; worth reconciling to one figure before a final proposal.',
  'Open HPD/DOB violation count \u2014 two different Camelot-generated reports on 9/3/2026 showed different figures (14 open of 127 total vs. 2 open); needs a fresh manual HPD/DOB BIS pull before quoting a number to the Board',
];
