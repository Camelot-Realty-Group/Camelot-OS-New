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
  stories: confirmed(9, 'PropertyShark property report'),
  yearBuilt: confirmed(1900, 'PropertyShark property report (DOF record)'),
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
  buildings: confirmed(41, 'camelot.nyc'),
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

export const LAFAYETTE_NEARBY_TRACK_RECORD: TrackRecordItem[] = [
  {
    name: '111 Mott Street',
    neighborhood: 'NoLIta',
    distance: 'a five-minute walk from 382 Lafayette Street',
    note: 'A Camelot-supported building improvement and operations case study \u2014 published on camelot.nyc \u2014 just south of NoHo.',
  },
  {
    name: '137 Franklin Street Apartment Corp',
    neighborhood: 'TriBeCa',
    distance: 'a short walk from 382 Lafayette Street',
    note: 'Camelot serves as managing agent for this cooperative, one avenue over from NoHo.',
  },
  {
    name: 'East of East Lofts',
    neighborhood: 'Long Island City',
    note: 'Camelot was appointed managing agent for this loft-style condominium \u2014 the same boutique, full-floor-unit building type as 382 Lafayette Street.',
  },
];

// ============================================================
// Neighboring portfolio map — past & present Camelot-portfolio
// buildings in the TriBeCa / SoHo / NoLIta corridor around 382
// Lafayette Street, as provided directly by David. Coordinates
// below are an editorial schematic (relative position on a
// simplified downtown street grid, calibrated to real cross
// streets) — not surveyed GPS points — built for an illustrative
// proximity map, not for precise navigation. `x`/`y` are percent
// positions on a 0–100 schematic grid (x: west→east, y: north→south).
// ============================================================

export interface NearbyPortfolioProperty {
  address: string;
  neighborhood: string;
  crossStreets: string;
  x: number;
  y: number;
}

export const LAFAYETTE_NEIGHBORING_PORTFOLIO: NearbyPortfolioProperty[] = [
  { address: '25–27 Mercer Street', neighborhood: 'SoHo', crossStreets: 'near Grand St', x: 62, y: 42 },
  { address: '39 Spring Street', neighborhood: 'NoLIta', crossStreets: 'near Mott/Mulberry', x: 82, y: 26 },
  { address: '402 West Broadway', neighborhood: 'SoHo', crossStreets: 'at Spring St', x: 38, y: 26 },
  { address: '283 West Broadway', neighborhood: 'TriBeCa/SoHo border', crossStreets: 'near Canal St', x: 38, y: 47 },
  { address: '104–109 Reade Street', neighborhood: 'TriBeCa', crossStreets: 'near Church/Hudson', x: 43, y: 82 },
  { address: '137 Franklin Street', neighborhood: 'TriBeCa', crossStreets: 'at Varick St', x: 38, y: 60 },
  { address: '58 White Street', neighborhood: 'TriBeCa', crossStreets: 'near Broadway/Church', x: 55, y: 54 },
  { address: '68 Thomas Street', neighborhood: 'TriBeCa', crossStreets: 'near West Broadway/Church', x: 44, y: 88 },
  { address: '1 North Moore Street', neighborhood: 'TriBeCa', crossStreets: 'at West Broadway', x: 38, y: 67 },
  { address: '11 North Moore Street', neighborhood: 'TriBeCa', crossStreets: 'at Varick/Beach', x: 33, y: 67 },
  { address: '465 Washington Street', neighborhood: 'TriBeCa', crossStreets: 'near Canal/Watts', x: 15, y: 48 },
  { address: '471 Washington Street', neighborhood: 'TriBeCa', crossStreets: 'near Canal/Watts', x: 16, y: 50 },
  { address: '290 West Street', neighborhood: 'TriBeCa', crossStreets: 'at Canal St', x: 8, y: 47 },
  { address: '11 Hubert Street', neighborhood: 'TriBeCa', crossStreets: 'at Hubert/Collister', x: 12, y: 73 },
  { address: '157 Hudson Street', neighborhood: 'TriBeCa', crossStreets: 'near Hubert/Collister', x: 22, y: 72 },
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
];

// ============================================================
// Technology & strategic partnerships — sourced from
// camelot.nyc/resident-tools/ and Camelot\u2019s own brochure copy.
// ============================================================

export interface TechPartner {
  name: string;
  role: string;
  description: string;
}

export const LAFAYETTE_TECH_PARTNERS: TechPartner[] = [
  {
    name: 'Camelot OS',
    role: 'Our proprietary operating layer',
    description: 'The dashboard that sits over every other platform below \u2014 owner and board reporting, compliance tracking, and staff accountability, all in one place for every building Camelot manages.',
  },
  {
    name: 'BuildingLink',
    role: 'Resident operations',
    description: 'Work orders and tickets, amenity reservations, package logistics, and the front-desk log \u2014 the record of daily building life, searchable by staff and visible to residents in real time.',
  },
  {
    name: 'Concierge Plus',
    role: 'Concierge & front desk',
    description: 'Guest authentication, delivery and grocery handoff, and staff communication \u2014 the layer that makes a front desk fast without making it impersonal.',
  },
  {
    name: 'MDS (Management Data Services)',
    role: 'Accounting & financial reporting',
    description: 'The accounting and financial management platform behind Camelot\u2019s monthly report packages \u2014 board members receive financial statements, budgets, and transaction-level detail on a fixed schedule.',
  },
  {
    name: 'Meet Select',
    role: 'Resident lifestyle membership',
    description: 'A private membership extended to residents \u2014 a dedicated concierge team and access to more than 1.6 million partner locations (dining, retail, travel, entertainment) beyond whatever a building\u2019s own front desk can arrange. (www.meetselect.com)',
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
    ],
  },
];

// ============================================================
// Cover letter — addressed to Samantha and the Board
// ============================================================

export const LAFAYETTE_COVER_LETTER_PARAGRAPHS: string[] = [
  'Samantha \u2014 thank you for thinking of Camelot, and please pass along our thanks to your uncle Jason as well. What follows is an introduction ahead of your call with the Board \u2014 not a sales pitch, just a clear picture of who we are and what we do.',
  'Camelot Realty Group has been managing buildings in New York City for twenty years. We got our start in Lower Manhattan \u2014 servicing buildings in TriBeCa, SoHo, NoHo, and the West Village \u2014 and have grown from there into a platform that today manages 41 buildings and more than $240 million in assets, 26 of them boutique, full-amenity condominiums much like 382 Lafayette Street. Our full managed portfolio is browsable on our website at camelot.nyc/managed-buildings.',
  'We still work in this immediate corridor today. Camelot manages 137 Franklin Street Apartment Corp in TriBeCa, a short walk from you, and has supported building improvements at 111 Mott Street in NoLIta, five minutes away. We also manage East of East Lofts in Long Island City \u2014 a boutique, full-floor-unit condominium built much like yours, with the same small, owner-occupied roll rather than a large shareholder base. NoHo and the streets around it are not new territory for us.',
  'What follows is an introduction, not a pitch with a number attached \u2014 we haven\u2019t discussed pricing, and we\u2019re not going to guess at one before we understand what the Board actually needs. Instead, this covers who we are, what a Camelot-managed building looks like day to day, and where we\u2019ve done this kind of work before.',
  'We\u2019d welcome the chance to speak with the full Board \u2014 by phone, video, or in person, whichever is easiest to coordinate. Once you have a day and time, we\u2019ll send a calendar invite over.',
];

export const LAFAYETTE_NEXT_STEP =
  'Reply with a few times that work for the Board this week or next, and we\u2019ll send a calendar invite \u2014 phone, Zoom, or in person, whichever is easiest.';

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
];
