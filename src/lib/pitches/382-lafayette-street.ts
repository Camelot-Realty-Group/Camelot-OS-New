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
 * Every fact below traces to a specific public source (NYC public
 * property records via RegWatch, StreetEasy, CityRealty, Compass) or to
 * Camelot's own published materials (camelot.nyc, the "Camelot — A
 * Journal of Considered Ownership" brochure, the Oak Park pitch data
 * file). Anything not independently confirmed is flagged via
 * `confirmed: false` rather than assumed. Do not add pricing or a
 * specific assigned property manager here without an explicit decision
 * from David — this is intentionally a pre-pricing, pre-assignment intro.
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
  bbl: confirmed('1-00531-1105', 'NYC public property records via RegWatch'),
  type: 'condo' as const,
  totalUnits: unconfirmed(9, 'NYC public property records cite 9 units; individual listing sources (StreetEasy, Zillow) cite 8 or 7 residences — small boutique buildings sometimes combine or subdivide units over time. Confirm the current unit count and governing entity name directly with the Board.'),
  stories: confirmed(9, 'NYC public property records; StreetEasy; Compass listing data'),
  yearBuilt: confirmed(1896, 'NYC public property records (StreetEasy and CityRealty list the building as completed in 1900 — pre-war construction records for this era commonly show a small variance between filed and completed dates)'),
  zoning: confirmed('M1-5/R9A', 'NYC public property records via RegWatch'),
  ownership: confirmed('Individually owned units (condominium)', 'NYC public property records; multiple unit-level condominium sales on StreetEasy/Compass confirm condo form of ownership'),
  historicDistrict: confirmed('NoHo Historic District', 'NYC Landmarks Preservation Commission NoHo Historic District designation report'),
  character: 'A boutique, pre-war loft condominium of the kind NoHo is known for — full-floor and duplex residences, cast-iron and masonry construction, a handful of owners rather than a large roll of shareholders.',
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
  founderInRealEstateSince: confirmed(2000, '"Camelot — A Journal of Considered Ownership" brochure — David Goldoff\u2019s own real estate career began in 2000, alongside his father Barry Goldoff and uncle Robert; he founded Camelot Realty Group itself in 2006'),
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
};

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
  'Samantha \u2014 thank you for thinking of Camelot, and please pass along our thanks to your uncle Jason as well. We\u2019re glad to put together something useful for you and the rest of the Board ahead of a call.',
  'A little about us: David Goldoff has been in New York real estate since 2000, working alongside his father Barry Goldoff and uncle Robert, identical twins who had been owning, developing, and operating buildings since the 1980s. He founded Camelot Realty Group in 2006 and has built it into a platform that today manages 41 buildings and more than $240 million in assets \u2014 26 of them boutique, full-amenity condominiums much like 382 Lafayette Street.',
  'We already work in your neighborhood. Camelot manages 137 Franklin Street Apartment Corp in TriBeCa, a short walk from you, and has supported building improvements at 111 Mott Street in NoLIta, five minutes away. We also manage East of East Lofts in Long Island City \u2014 a boutique, full-floor-unit condominium built much like yours. NoHo and the streets around it are not new territory for us.',
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
  'Exact unit count and the governing condominium entity\u2019s legal name (public sources show minor variance \u2014 confirm against the offering plan / bylaws)',
  'Which property manager would be assigned \u2014 not yet decided since there is no engagement or fee discussion yet',
  'Current management company, contract end date, and any transition timing constraints',
  'The Board\u2019s specific pain points and priorities \u2014 to be gathered on the introductory call, not assumed',
];
