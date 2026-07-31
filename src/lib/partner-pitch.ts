/**
 * partner-pitch.ts — Professional Partner Pitch Decks
 *
 * Firm-level decks (not building-specific) aimed at the professionals who
 * serve condo/co-op boards and rental landlords: law firms, accounting
 * firms, audit practices, commercial brokerages, and receivers/lenders.
 *
 * DESIGN LANGUAGE (David, July 31 2026): Esquire / Vogue / Robb Report /
 * Architectural Digest. Magazine-cover opener, serif italic display type,
 * hairline rules, drop caps, pull quotes, editorial charts, real maps of the
 * office and coverage area, and embedded thumbnails of actual Camelot
 * deliverables (modeled on the real MDS monthly package pulled from Drive).
 * Every visual is self-contained CSS or licensed Google Maps — no scraped
 * imagery, no fabricated statistics; charts show playbook targets and are
 * labeled as such.
 *
 * Case studies are audience-matched. Engagement history supplied by David
 * Goldoff; confirm client-identifying details before external distribution.
 */
import { DAVID_GOLDOFF_SIGNATURE_TEXT } from './camelot-signature';
import { GOOGLE_MAPS_KEY } from './maps-key';

export type PartnerAudience = 'law' | 'accounting' | 'audit' | 'brokerage' | 'receivership';

export const PARTNER_AUDIENCES: Array<{ key: PartnerAudience; label: string; description: string }> = [
  { key: 'law', label: 'Law Firms', description: 'Real estate, co-op/condo, and landlord-tenant practices' },
  { key: 'accounting', label: 'Accounting Firms', description: 'Firms preparing financials and taxes for boards and landlords' },
  { key: 'audit', label: 'Audit Practices', description: 'Auditors of condo, co-op, and HOA financial statements' },
  { key: 'brokerage', label: 'Commercial Brokerages', description: 'Investment-sales brokers selling multifamily, mixed-use, rental, and office buildings to landlords — including 1031 and overseas buyers' },
  { key: 'receivership', label: 'Receivers, Lenders & Auctions', description: 'Receiverships, bankruptcies, lender takeovers, and auction dispositions needing an operator on short notice' },
];

const AUDIENCE_COPY: Record<PartnerAudience, {
  title: string;
  hook: string;
  coverLines: string[];
  howWeHelp: string[];
  whatWeAsk: string[];
}> = {
  law: {
    title: 'A Management Partner Your Clients Will Thank You For',
    hook: 'Your practice lives inside co-op and condo boards: governance, compliance, sponsor disagreements that turn into construction litigation, and managers who stop responding. The underlying problem is usually management, not law. Camelot is the operator you can put behind your advice — and when your firm recommends us, your firm stays on with the client.',
    coverLines: ['The Governance Issue', 'Sponsor disputes, documented', 'Why counsel keeps the client'],
    howWeHelp: [
      'Litigation support done right: organized records, responsive staff, and clean financial exhibits when your matters need them',
      'Sponsor disputes and construction-defect matters backed by field documentation — inspections, photo records, vendor histories, and cost tracking your case can stand on',
      'Violation and agency workstreams coordinated with counsel — HPD, DOB, ECB/OATH — so legal strategy and field response move together',
      'Governance hygiene: board minutes, notices, elections, and house-rule enforcement that reduce the disputes that become retainers nobody enjoys',
      'A responsible transfer path when your client needs to exit a failing management relationship — we run the transition, you protect the client',
    ],
    whatWeAsk: [
      'Keep us in mind when a client complains about their manager',
      'Introduce us when a receivership, sponsor transition, or new association needs an operator',
      'Co-host a board-education breakfast with us — your compliance update, our operations update',
    ],
  },
  accounting: {
    title: 'Clean Books Start With Clean Management',
    hook: 'Every accountant who serves boards knows the pain: late records, unreconciled accounts, missing invoices, and a manager who goes quiet in March. Camelot was built by people who refuse to run buildings that way — and when your firm recommends us, your firm stays on with the client.',
    coverLines: ['The Year-End Issue', 'Records that arrive complete', 'Presenting to boards, together'],
    howWeHelp: [
      'Controller-level in-house accounting: monthly closes, AP with board approval workflows, and reconciliations your staff can rely on',
      'Year-end packages delivered complete and on time — general ledger, bank statements, invoices, arrears schedules — before you ask, for tax returns, bookkeeping review, and audits',
      'Audit corrections and recategorizations handled with your team, not against it: when a line item should be classified differently, our controllers make the change, document it, and keep the chart consistent going forward',
      'Joint board presentations: bring your partner, we bring ours — accountant and manager presenting the year together lands better than either alone',
      'Budget-to-actual discipline boards can read, so your advisory conversations start from real numbers',
    ],
    whatWeAsk: [
      'When a mutual client’s records arrive late or messy every year, tell them there’s a better way to run the building',
      'Refer boards shopping for management to a firm that will make your engagement easier, not harder',
      'Share your close calendar with us — we align our monthly reporting to your deadlines',
    ],
  },
  audit: {
    title: 'The Management Company Auditors Prefer',
    hook: 'Audit quality depends on management quality. Camelot’s controls — segregation of duties, board-approved disbursements, documented reserves activity — are designed so your fieldwork finds order, not chaos.',
    coverLines: ['The Fieldwork Issue', 'PBC lists, returned complete', 'Comparatives that behave'],
    howWeHelp: [
      'PBC lists returned complete: confirmations, statements, contracts, insurance, reserve activity, and arrears detail in one organized delivery',
      'Consistent chart of accounts and closing discipline across the portfolio, so comparatives behave',
      'Direct access to our controller team during fieldwork — questions answered same-day, in writing',
      'Findings taken seriously: management-letter items get owners, deadlines, and follow-through you can verify next season',
    ],
    whatWeAsk: [
      'When management deficiencies keep surfacing at a client, the board deserves to know operators like us exist',
      'Introduce us to associations whose audits are hard because their management is weak',
      'Tell us what a great management company looks like from the auditor’s chair — we build to that standard',
    ],
  },
  brokerage: {
    title: 'Your Buyers Need an Operator. Your Deals Need Real Numbers.',
    hook: 'You sell multifamily, mixed-use, and rental buildings to landlords — local, 1031-exchange, and overseas investors alike. Camelot has managed New York rental property since 2006, and we make your deals easier on both sides: an operator your buyer can hand the keys to on day one, and management economics that help the deal pencil.',
    coverLines: ['The Deal-Flow Issue', 'Day-one takeover, delivered', 'Numbers that help deals pencil'],
    howWeHelp: [
      'Day-one takeover for your buyers — banking, rent roll, DHCR registrations, vendor contracts, and staff onboarding handled, including for 1031 and foreign investors who need a fully delegated operator',
      'Rental income upside through our in-house brokerage arm: unit turns, lease-ups, renewals, and market-rent positioning that raise the building’s income line',
      'Expense reduction your one-building buyer cannot get alone: our portfolio vendor leverage cuts plumbing, HVAC, electrical, fire safety, boiler, energy, and elevator costs',
      'AI + automation across operations — rent collection, arrears follow-up, repairs and maintenance, leases, renewals, move-ins/move-outs, and resident retention — on AppFolio or MDS, with owner reporting landlords actually read',
      'Full regulatory coverage: rent-stabilized, rent-controlled, and market-rate portfolios; DHCR/RGB compliance, registrations, and local-law calendar management',
    ],
    whatWeAsk: [
      'Introduce us to your buyer at contract — a management plan in place before closing makes your deal smoother and your client stickier',
      'Bring us your transition properties: estates, receiverships, bankruptcies, and buildings whose management is the reason they’re trading',
      'Let us pre-underwrite operating costs for your setups and OMs — real management numbers instead of pro-forma guesses',
    ],
  },
  receivership: {
    title: 'An Operator for Properties in Transition',
    hook: 'Receiverships, bankruptcies, lender takeovers, and auction dispositions need a manager who can take the keys on short notice, secure the cash, stabilize the residents, and report like a fiduciary. That is work Camelot has done in New York since 2006.',
    coverLines: ['The Transition Issue', 'Keys taken on short notice', 'Reporting a court can read'],
    howWeHelp: [
      'Rapid intake: banking and cash controls secured, rent roll verified, vendors triaged, and site secured within days of appointment',
      'Fiduciary-grade monthly reporting — balance sheet, income statement, bank reconciliations, cash disbursements journal, and charge & collection analysis — court- and lender-ready',
      'Collections stabilized: arrears workflows, payment plans, and DHCR-compliant handling of stabilized and controlled tenancies',
      'Compliance triage: HPD, DOB, ECB/OATH violations mapped and prioritized so penalties stop compounding during the hold period',
      'Disposition support: clean records, verified financials, and an operating story that helps the asset trade at its best number',
    ],
    whatWeAsk: [
      'Add Camelot to your receiver and lender operator lists — we can mobilize on short notice across the five boroughs and the tri-state area',
      'Call us before the auction: we’ll underwrite the management picture so bidders know what the building really costs to run',
      'Introduce us to trustees and workout teams that need court-ready reporting from day one',
    ],
  },
};

// ---------------------------------------------------------------------------
// Case studies — audience-matched. Engagement history supplied by David
// Goldoff (July 2026); confirm client-identifying details before external use.
// ---------------------------------------------------------------------------

const LAW_CASE_STUDIES: Array<{ title: string; body: string }> = [
  {
    title: 'Sponsor-transition co-op — counsel kept, chaos contained',
    body: 'A downtown co-op mid-fight with its sponsor over construction defects. Camelot delivered the field record counsel needed — inspections, photo logs, vendor histories, cost tracking — while stabilizing operations so the board could litigate from strength instead of distraction.',
  },
  {
    title: 'Governance rebuild after a board dispute',
    body: 'A divided board, contested election, and house rules nobody enforced. Camelot re-papered the governance calendar — minutes, notices, elections run to the letter — and the disputes that had been generating retainers nobody enjoyed simply stopped arriving.',
  },
  {
    title: 'Exit from a failing manager, executed cleanly',
    body: 'When counsel advised a client to leave a non-responsive management firm, Camelot ran the 30-day transition: records demanded and received, banking rebuilt, agencies renoticed — the attorney protected the client; we did the heavy lifting.',
  },
];

const ACCOUNTING_CASE_STUDIES: Array<{ title: string; body: string }> = [
  {
    title: 'The March miracle, retired',
    body: 'A co-op whose prior manager delivered records in shoeboxes every tax season. First year with Camelot: general ledger, bank statements, invoice backup, and arrears schedules delivered complete before the accountant asked. The engagement letter got easier to price.',
  },
  {
    title: 'Recategorization, done with the CPA — not to them',
    body: 'An auditor flagged misclassified capital items. Camelot’s controllers made the corrections, documented the rationale, and locked the chart of accounts so the same finding never resurfaced. Comparatives have behaved ever since.',
  },
  {
    title: 'Presenting the year, together',
    body: 'Board annual meeting, accountant and Camelot manager presenting side by side: the CPA walked the financials, we walked the operations behind the numbers. The board renewed both firms on the spot.',
  },
];

const AUDIT_CASE_STUDIES: Array<{ title: string; body: string }> = [
  {
    title: 'PBC list returned in one delivery',
    body: 'Confirmations, statements, contracts, insurance, reserve activity, arrears detail — one organized package, delivered before fieldwork began. The audit finished early; the management letter was one page.',
  },
  {
    title: 'Management-letter items with owners and deadlines',
    body: 'Prior-year findings had been ritually ignored. Camelot assigned each item an owner and a date, closed them on schedule, and handed the auditor the evidence trail the following season.',
  },
  {
    title: 'A portfolio whose comparatives behave',
    body: 'Consistent chart of accounts and monthly closing discipline across every Camelot building — so when the auditor lands, the numbers line up year over year without archaeology.',
  },
];

const RENTAL_CASE_STUDIES: Array<{ title: string; body: string }> = [
  {
    title: 'Peak Capital — Manhattan rental portfolio',
    body: 'Camelot managed the Peak Capital rental portfolio: day-to-day operations, collections, unit turns, vendor management, and owner reporting for an institutional-minded investor group — the full operating layer between the asset and its returns.',
  },
  {
    title: 'MacTaggart Group — London-based investor, ~13 NYC buildings',
    body: 'For a UK investor with a New York base, Camelot ran a portfolio of roughly thirteen rental buildings spanning Chinatown / Lower Manhattan and prime Brooklyn — Park Slope, Brooklyn Heights, Cobble Hill, and surrounding neighborhoods — proving the delegated-operator model overseas owners need.',
  },
  {
    title: 'Village rentals — East 9th, West 11th & beyond',
    body: 'Walk-up and elevator rental buildings in the East and West Village (748 East 9th Street, 300 West 11th Street among them): rent-stabilized and market-rate units side by side, DHCR registrations current, and monthly owner packages on MDS/AppFolio that landlords actually read.',
  },
];

const caseStudiesFor = (audience: PartnerAudience) => {
  if (audience === 'brokerage' || audience === 'receivership') return RENTAL_CASE_STUDIES;
  if (audience === 'law') return LAW_CASE_STUDIES;
  if (audience === 'accounting') return ACCOUNTING_CASE_STUDIES;
  return AUDIT_CASE_STUDIES;
};

const MARKETS = 'New York City’s five boroughs, Westchester, Long Island, New Jersey, and Connecticut';

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Optional personalization for a partner deck — the specific firm and contact. */
export interface PartnerFirmInfo {
  firmName?: string;
  contactName?: string;
}

export function buildPartnerPitchFilename(audience: PartnerAudience, extension = 'pdf', firm?: PartnerFirmInfo): string {
  const label = audience === 'law' ? 'Law-Firms'
    : audience === 'accounting' ? 'Accounting-Firms'
    : audience === 'audit' ? 'Audit-Practices'
    : audience === 'brokerage' ? 'Commercial-Brokerages'
    : 'Receivers-Lenders-Auctions';
  const date = new Date().toISOString().slice(0, 10);
  const firmSlug = (firm?.firmName || '').trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return firmSlug
    ? `Camelot-Partner-Pitch-${firmSlug}_${date}.${extension}`
    : `Camelot-Partner-Pitch-${label}_${date}.${extension}`;
}

export function partnerAudienceLabel(audience: PartnerAudience): string {
  return PARTNER_AUDIENCES.find(a => a.key === audience)?.label || 'Professional Partners';
}

// ---------------------------------------------------------------------------
// Editorial components (self-contained CSS art — no scraped imagery)
// ---------------------------------------------------------------------------

/** Mini mock-covers of real Camelot deliverables, embedded as thumbnails. */
function deliverableThumbnails(): string {
  return `<div class="thumb-row">
    <div class="thumb">
      <div class="thumb-doc thumb-mds">
        <div class="thumb-mds-head">MONTHLY FINANCIALS</div>
        <div class="thumb-mds-sub">Prepared by Camelot Property<br>Management Services Corp.</div>
        <div class="thumb-mds-toc">
          ${['Balance Sheet', 'Income Statement', 'Bank Rec — All Cash Accts', 'Cash Disbursements Journal', 'Charges & Collections'].map((l, i) => `<div><span>${l}</span><span>${i + 1}</span></div>`).join('')}
        </div>
      </div>
      <div class="thumb-cap">The MDS monthly package — what every owner receives</div>
    </div>
    <div class="thumb">
      <div class="thumb-doc thumb-dossier">
        <div class="thumb-dossier-mast">C A M E L O T</div>
        <div class="thumb-dossier-title">Property<br>Intelligence<br>Dossier</div>
        <div class="thumb-dossier-rule"></div>
        <div class="thumb-dossier-foot">Public records &middot; compliance &middot; market</div>
      </div>
      <div class="thumb-cap">The dossier — a building's full public record, in minutes</div>
    </div>
    <div class="thumb">
      <div class="thumb-doc thumb-agenda">
        <div class="thumb-agenda-eyebrow">PROSPECTIVE CLIENT</div>
        <div class="thumb-agenda-title">Interview<br>Agenda</div>
        <div class="thumb-agenda-lines">${[92, 78, 85, 64, 88].map(w => `<i style="width:${w}%"></i>`).join('')}</div>
      </div>
      <div class="thumb-cap">The interview agenda — built from real pre-call discovery</div>
    </div>
  </div>
  <div class="src">Actual Camelot deliverable formats, reproduced in miniature; full samples shared in person.</div>`;
}

/** Playbook-target chart: vendor-category savings ranges (labeled as targets). */
function savingsTargetChart(): string {
  const rows: Array<[string, number]> = [
    ['Plumbing', 30], ['HVAC', 28], ['Electrical', 25], ['Fire & Life Safety', 24],
    ['Boiler & Heating', 27], ['Energy Supply', 22], ['Elevator', 20], ['Waste & Recycling', 26],
  ];
  return `<div class="chart">
    <div class="chart-title">Portfolio Vendor Leverage &mdash; Negotiation Targets by Category</div>
    ${rows.map(([label, pct]) => `<div class="chart-row"><span class="chart-label">${label}</span><span class="chart-track"><i style="width:${(pct / 30) * 100}%"></i></span><span class="chart-val">to ${pct}%</span></div>`).join('')}
    <div class="src">Target reduction ranges from Camelot's vendor-negotiation playbook (15&ndash;30%); documented results formalized per engagement.</div>
  </div>`;
}

/** Editorial timeline — two decades in New York (facts, not invented figures). */
function historyTimeline(): string {
  const stops: Array<[string, string]> = [
    ['2006', 'Camelot founded — New Yorkers managing New York buildings'],
    ['2010s', 'Portfolio grows across co-op, condo, and rental — Manhattan to Brooklyn and Queens'],
    ['2020s', 'In-house accounting, brokerage arm, and compliance bench mature into one operating platform'],
    ['2026', 'Camelot OS: building intelligence, automation, and reporting under one roof at 57 W 57th'],
  ];
  return `<div class="timeline">${stops.map(([y, t]) => `<div class="tl-stop"><div class="tl-year">${y}</div><div class="tl-dot"></div><div class="tl-text">${t}</div></div>`).join('')}</div>`;
}

function hqMapEmbed(height: number): string {
  return `<div class="mapframe" style="height:${height}px"><iframe src="https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=57+West+57th+Street+Suite+410+New+York+NY+10019&zoom=15" style="width:100%;height:100%;border:0" loading="lazy" title="Camelot HQ — 57 West 57th Street"></iframe></div>`;
}

/** Real Camelot photography from the corporate brochure (Camelot-owned imagery). */
const ASSET_BASE = typeof window !== 'undefined' && window.location ? window.location.origin : '';
const camelotPhoto = (file: string) => `${ASSET_BASE}/images/camelot/${file}`;

const PORTFOLIO_PHOTOS: Array<{ file: string; caption: string }> = [
  { file: 'park-avenue.jpg', caption: 'Park Avenue — prewar white-glove' },
  { file: '301-east-50.jpg', caption: '301 East 50th Street' },
  { file: 'mott-street.jpg', caption: 'Mott Street — Chinatown portfolio' },
  { file: 'soho-loft.jpg', caption: 'SoHo cast-iron lofts' },
  { file: 'penelope-night.jpg', caption: 'New-development condominium' },
  { file: 'prewar-corner.jpg', caption: 'Prewar co-op, uptown' },
  { file: 'resident-app.jpg', caption: 'Residents on the Camelot app' },
  { file: 'modern-entry.jpg', caption: 'Full-service modern entry' },
];

/**
 * The real portfolio map: gold pins on a selection of Camelot-managed and
 * portfolio buildings (addresses from camelot.nyc and case studies).
 */
const PORTFOLIO_PINS = [
  '949 Park Ave, New York, NY', '301 E 50th St, New York, NY', '111 Mott St, New York, NY',
  '250 Bowery, New York, NY', '58 White St, New York, NY', '137 Franklin St, New York, NY',
  '39 Spring St, New York, NY', '201 E 15th St, New York, NY', '930 St Nicholas Ave, New York, NY',
  '22 E 22nd St, New York, NY', '748 E 9th St, New York, NY', '300 W 11th St, New York, NY',
];

function portfolioDotMap(height: number): string {
  const markers = `size:small%7Ccolor:0xC9A227%7C${PORTFOLIO_PINS.map(a => encodeURIComponent(a)).join('%7C')}`;
  const url = `https://maps.googleapis.com/maps/api/staticmap?size=640x${Math.round(height / 2)}&scale=2&maptype=roadmap&markers=${markers}&key=${GOOGLE_MAPS_KEY}`;
  return `<div class="mapframe" style="height:${height}px"><img src="${url}" alt="Camelot portfolio map — gold pins on managed and portfolio buildings" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none'"></div>`;
}

const PORTFOLIO_NEIGHBORHOODS = [
  'SoHo', 'Nolita', 'Chinatown', 'Tribeca', 'Bowery', 'Gramercy',
  'Flatiron', 'Midtown East', 'Park Avenue', 'West Village', 'East Village', 'Washington Heights',
  'Sunnyside', 'Long Island City', 'Jackson Heights', 'Brooklyn Heights', 'Riverdale', 'Westchester',
];

// ---------------------------------------------------------------------------
// The deck
// ---------------------------------------------------------------------------

export function generatePartnerPitchDeck(audience: PartnerAudience, firm?: PartnerFirmInfo): string {
  const copy = AUDIENCE_COPY[audience];
  const audienceLabel = partnerAudienceLabel(audience);
  const firmName = (firm?.firmName || '').trim();
  const contactName = (firm?.contactName || '').trim();
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const stem = buildPartnerPitchFilename(audience, 'pdf', firm).replace(/\.pdf$/, '');
  const caseStudies = caseStudiesFor(audience);

  const css = `
  * { margin:0; padding:0; box-sizing:border-box; min-width:0; }
  body { font-family:'Plus Jakarta Sans',-apple-system,sans-serif; background:#e9e5da; }
  .pslide { width:1280px; height:720px; margin:20px auto; position:relative; overflow:hidden; background:#FAF8F5; box-shadow:0 4px 20px rgba(0,0,0,.15); padding:54px 64px; page-break-after:always; }
  .pslide p, .pslide div, .pslide li { overflow-wrap:break-word; }
  .pslide.dark { background:#22303a; color:#fff; }
  .logo { position:absolute; top:0; right:64px; background:#C9A227; color:#fff; padding:14px 20px 12px; font-weight:800; letter-spacing:3px; font-size:13px; text-align:center; z-index:5; }
  .logo span { display:block; font-size:7px; letter-spacing:2px; font-weight:600; margin-top:2px; }
  h1 { font-family:'Cormorant Garamond',Georgia,serif; font-size:54px; font-style:italic; font-weight:600; color:#B8973A; line-height:1.04; }
  .dark h1 { color:#F4D26A; }
  h2 { font-family:'Cormorant Garamond',Georgia,serif; font-size:38px; font-style:italic; font-weight:600; color:#1a2130; margin-bottom:6px; }
  .kicker { font-size:11px; letter-spacing:3.2px; text-transform:uppercase; color:#B8973A; font-weight:800; margin-bottom:10px; }
  .rule { height:1px; background:rgba(184,151,58,.5); margin:14px 0 18px; }
  .dark .rule { background:rgba(244,210,106,.4); }
  .body { font-size:15px; line-height:1.62; color:#3d4756; max-width:980px; }
  .dark .body { color:rgba(255,255,255,.85); }
  .dropcap::first-letter { font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; float:left; font-size:58px; line-height:.85; padding:6px 10px 0 0; color:#B8973A; }
  .pullquote { font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:24px; line-height:1.35; color:#1a2130; border-left:3px solid #B8973A; padding-left:18px; margin:14px 0; }
  .card { background:#fff; border:1px solid rgba(184,151,58,.35); border-left:4px solid #B8973A; padding:14px 18px; margin-bottom:11px; font-size:13.5px; line-height:1.5; color:#3d4756; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
  .stat { text-align:center; background:#fff; border:1px solid rgba(184,151,58,.3); padding:16px 10px; }
  .stat b { display:block; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:30px; color:#1a2130; }
  .stat span { font-size:10px; text-transform:uppercase; letter-spacing:1.4px; color:#8a8174; font-weight:700; }
  .foot { position:absolute; left:64px; right:64px; bottom:14px; border-top:1px solid rgba(184,151,58,.3); padding-top:7px; font-size:9px; color:#8a8174; display:flex; justify-content:space-between; }
  .dark .foot { border-top-color:rgba(244,210,106,.3); color:rgba(255,255,255,.5); }
  .src { font-size:9.5px; color:#8a8174; margin-top:10px; }
  .mapframe { border:1px solid rgba(184,151,58,.45); overflow:hidden; background:#EDE9DF; }
  /* Cover art */
  .cover { padding:0; background:
      radial-gradient(1100px 500px at 85% -10%, rgba(201,162,39,.28), transparent 60%),
      radial-gradient(700px 700px at -10% 110%, rgba(201,162,39,.16), transparent 55%),
      linear-gradient(160deg, #1a2130 0%, #22303a 55%, #2b3d49 100%); color:#fff; }
  .cover-grid { position:absolute; inset:0; background-image:linear-gradient(rgba(244,210,106,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(244,210,106,.05) 1px, transparent 1px); background-size:64px 64px; }
  .cover-in { position:relative; z-index:2; height:100%; padding:44px 64px 60px; display:flex; flex-direction:column; }
  .cover-mast { font-family:'Cormorant Garamond',Georgia,serif; font-size:44px; letter-spacing:16px; text-align:center; color:#fff; }
  .cover-mastsub { text-align:center; font-size:9px; letter-spacing:5px; color:#F4D26A; text-transform:uppercase; margin-top:2px; }
  .cover-issue { display:flex; justify-content:space-between; font-size:10px; letter-spacing:2.4px; text-transform:uppercase; color:rgba(255,255,255,.65); border-top:1px solid rgba(244,210,106,.35); border-bottom:1px solid rgba(244,210,106,.35); padding:8px 0; margin-top:14px; }
  .cover-title { font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-weight:600; font-size:64px; line-height:1.02; color:#F4D26A; max-width:940px; margin-top:auto; }
  .cover-lines { display:flex; gap:26px; margin-top:26px; }
  .cover-line { font-size:11px; letter-spacing:1.6px; text-transform:uppercase; color:rgba(255,255,255,.78); border-left:2px solid #C9A227; padding-left:10px; }
  .cover-for { margin-top:24px; font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:20px; color:#fff; }
  /* Charts */
  .chart { background:#fff; border:1px solid rgba(184,151,58,.3); padding:16px 18px; }
  .chart-title { font-size:11px; letter-spacing:1.8px; text-transform:uppercase; font-weight:800; color:#1a2130; margin-bottom:12px; }
  .chart-row { display:grid; grid-template-columns:130px 1fr 58px; gap:10px; align-items:center; margin-bottom:8px; }
  .chart-label { font-size:11.5px; font-weight:700; color:#3d4756; }
  .chart-track { height:12px; background:#EDE9DF; position:relative; }
  .chart-track i { position:absolute; inset:0 auto 0 0; background:linear-gradient(90deg,#C9A227,#F4D26A); display:block; }
  .chart-val { font-size:11px; font-weight:800; color:#B8973A; text-align:right; }
  /* Timeline */
  .timeline { display:grid; grid-template-columns:repeat(4,1fr); gap:0; position:relative; margin-top:10px; }
  .timeline::before { content:''; position:absolute; left:0; right:0; top:44px; height:1px; background:rgba(184,151,58,.5); }
  .tl-stop { text-align:center; padding:0 14px; }
  .tl-year { font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:30px; color:#B8973A; }
  .tl-dot { width:9px; height:9px; border-radius:50%; background:#C9A227; margin:8px auto; position:relative; z-index:2; box-shadow:0 0 0 4px #FAF8F5; }
  .tl-text { font-size:11.5px; line-height:1.45; color:#3d4756; }
  /* Deliverable thumbnails */
  .thumb-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:18px; margin-top:6px; }
  .thumb-doc { height:210px; border:1px solid rgba(26,33,48,.2); box-shadow:0 14px 26px rgba(26,33,48,.14); padding:16px 14px; position:relative; overflow:hidden; }
  .thumb-cap { font-size:10.5px; color:#3d4756; margin-top:9px; line-height:1.4; }
  .thumb-mds { background:#fff; }
  .thumb-mds-head { font-size:11px; font-weight:900; letter-spacing:1.6px; color:#1a2130; border-bottom:2px solid #C9A227; padding-bottom:6px; }
  .thumb-mds-sub { font-size:8px; color:#8a8174; margin:8px 0 10px; line-height:1.5; }
  .thumb-mds-toc div { display:flex; justify-content:space-between; font-size:8.5px; color:#3d4756; border-bottom:1px dotted rgba(138,129,116,.5); padding:4px 0; }
  .thumb-dossier { background:linear-gradient(160deg,#1a2130,#22303a); color:#fff; display:flex; flex-direction:column; }
  .thumb-dossier-mast { font-size:9px; letter-spacing:4px; color:#fff; text-align:center; }
  .thumb-dossier-title { font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:24px; line-height:1.1; color:#F4D26A; margin:auto 0; }
  .thumb-dossier-rule { height:1px; background:rgba(244,210,106,.5); margin:8px 0; }
  .thumb-dossier-foot { font-size:7.5px; letter-spacing:1px; text-transform:uppercase; color:rgba(255,255,255,.6); }
  .thumb-agenda { background:#FAF8F5; }
  .thumb-agenda-eyebrow { font-size:8px; letter-spacing:2.4px; color:#B8973A; font-weight:800; }
  .thumb-agenda-title { font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:26px; color:#1a2130; line-height:1.05; margin:8px 0 12px; }
  .thumb-agenda-lines i { display:block; height:5px; background:#EDE4D2; margin-bottom:7px; }
  @media print { body{background:#fff} .pslide{margin:0;box-shadow:none} }`;

  const foot = `<div class="foot"><span>Camelot Property Management &middot; 57 West 57th Street, Suite 410, New York</span><span>(212) 206-9939 x701 &middot; info@camelot.nyc &middot; www.camelot.nyc</span></div>`;
  const logo = `<div class="logo">CAMELOT<span>PROPERTY MANAGEMENT</span></div>`;
  const sl = (inner: string, cls = '') => `<div class="pslide ${cls}">${inner}</div>`;

  const slides = [
    // 1 — MAGAZINE COVER (real Camelot skyline photography under the art)
    sl(`<div style="position:absolute;inset:0"><img src="${camelotPhoto('skyline-sunset.jpg')}" alt="New York skyline — Camelot photography" style="width:100%;height:100%;object-fit:cover;opacity:.38" onerror="this.style.display='none'"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(160deg,rgba(26,33,48,.92) 0%,rgba(34,48,58,.82) 55%,rgba(43,61,73,.7) 100%)"></div>
    <div class="cover-grid"></div><div class="cover-in">
      <div class="cover-mast">C A M E L O T</div>
      <div class="cover-mastsub">The Partnership Portfolio &middot; New York</div>
      <div class="cover-issue"><span>For ${esc(audienceLabel)}</span><span>${issueDate}</span><span>Est. 2006</span></div>
      <div class="cover-title">${esc(copy.title)}</div>
      <div class="cover-lines">${copy.coverLines.map(l => `<div class="cover-line">${esc(l)}</div>`).join('')}</div>
      ${firmName ? `<div class="cover-for">Prepared personally for ${contactName ? `${esc(contactName)} and the team at ` : ''}${esc(firmName)}</div>` : ''}
    </div>`, 'cover dark'),

    // 2 — THE THESIS (editorial opener with drop cap + pull quote)
    sl(`${logo}<div class="kicker">The Thesis</div><h2>${esc(copy.title)}</h2><div class="rule"></div>
      <p class="body dropcap" style="font-size:16.5px;max-width:760px">${esc(copy.hook)}</p>
      <div style="display:grid;grid-template-columns:1.15fr .85fr;gap:26px;margin-top:18px;align-items:start">
        <div class="pullquote">${audience === 'law' || audience === 'accounting'
          ? 'When your firm recommends Camelot, your firm stays on with the client. A commitment, not a courtesy.'
          : audience === 'brokerage'
            ? 'One building can’t move a vendor’s pricing. A portfolio of accounts can.'
            : audience === 'receivership'
              ? 'Take the keys, secure the cash, report like a fiduciary — within days of appointment.'
              : 'Audit quality depends on management quality. We build for your fieldwork.'}</div>
        <div class="grid3" style="grid-template-columns:1fr">
          <div class="stat"><b>41 Buildings</b><span>$240M under management</span></div>
          <div class="stat"><b>$1.5B</b><span>Estimated gross portfolio value &middot; 1M+ sq ft</span></div>
          <div class="stat"><b>48 hrs</b><span>Guaranteed response time</span></div>
        </div>
      </div>
      <div class="src">Portfolio figures published at camelot.nyc, July 2026.</div>${foot}`),

    // 3 — TWO DECADES (timeline + markets)
    sl(`${logo}<div class="kicker">Who We Are</div><h2>Two Decades of New York Buildings</h2><div class="rule"></div>
      <p class="body" style="max-width:900px">Camelot is an independently owned New York firm: senior property managers, in-house accounting, legal leadership, brokerage expertise, and practical automation — members of REBNY, NYARM, IREM, BOMA New York, and CNYC. <strong>Where we work:</strong> ${MARKETS}.</p>
      ${historyTimeline()}
      <p class="body" style="margin-top:16px;font-size:13.5px"><strong>Where we're going:</strong> disciplined growth — adding well-run buildings and association clients where our operating model raises the standard, backed by the Camelot OS platform that gives every client day-one visibility into their own building's public record.</p>${foot}`),

    // 4 — THE INTELLIGENCE + embedded deliverable thumbnails
    sl(`${logo}<div class="kicker">The Platform</div><h2>A Taste of the Camelot Intelligence</h2><div class="rule"></div>
      <p class="body" style="max-width:920px;margin-bottom:8px">Give us any New York address and, in minutes, Camelot OS assembles the building's full public record — violations, LL97 exposure, permits, energy, sales history, market data — source-checked and board-ready. These are the documents your clients would actually receive:</p>
      ${deliverableThumbnails()}
      <p class="body" style="margin-top:8px;font-size:12.5px;color:#8a8174">Ask us to run a live report on any building you or your clients care about — it takes minutes and it's free.</p>${foot}`),

    // 4B — THE PORTFOLIO, IN PICTURES (real Camelot photography)
    sl(`${logo}<div class="kicker">The Portfolio</div><h2>The Buildings We Answer For</h2><div class="rule"></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
        ${PORTFOLIO_PHOTOS.map(p => `<figure style="margin:0"><div style="height:196px;border:1px solid rgba(26,33,48,.18);overflow:hidden;background:#EDE9DF;box-shadow:0 10px 22px rgba(26,33,48,.1)"><img src="${camelotPhoto(p.file)}" alt="${esc(p.caption)}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.parentElement.style.display='none'"></div><figcaption style="font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:#8a8174;font-weight:700;margin-top:6px">${esc(p.caption)}</figcaption></figure>`).join('')}
      </div>
      <div class="src">Camelot-owned photography from the corporate portfolio; resident-app imagery from the Camelot resident platform.</div>${foot}`),

    // 5 — MAPS: the real portfolio dots + the office
    sl(`${logo}<div class="kicker">The Territory</div><h2>Where We Manage &mdash; and Where to Find Us</h2><div class="rule"></div>
      <div style="display:grid;grid-template-columns:1.1fr .9fr;gap:20px;align-items:start">
        <div>
          ${portfolioDotMap(320)}
          <div class="src">Gold pins: a selection of Camelot-managed and portfolio buildings (camelot.nyc case studies &amp; portfolio) — the full 41-building list lives at camelot.nyc/managed-buildings.</div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:10px">
            ${PORTFOLIO_NEIGHBORHOODS.map(a => `<div style="border:1px solid rgba(184,151,58,.4);background:#fff;padding:6px 5px;font-size:9.5px;font-weight:800;color:#1a2130;text-align:center">${a}</div>`).join('')}
          </div>
        </div>
        <div>
          ${hqMapEmbed(320)}
          <div class="src">Headquarters — 57 West 57th Street, Suite 410 (coffee is on us)</div>
          <p class="body" style="font-size:12.5px;margin-top:10px">The neighborhoods above are where the portfolio actually lives — from Chinatown walk-ups to Park Avenue prewars to Sunnyside condominiums. Boots on the ground in every one.</p>
        </div>
      </div>${foot}`),

    // 6 — CASE STUDIES (audience-matched, editorial)
    sl(`${logo}<div class="kicker">Track Record</div><h2>Engagements That Look Like Your Clients</h2><div class="rule"></div>
      ${caseStudies.map((cs, i) => `<div class="card" style="display:grid;grid-template-columns:44px 1fr;gap:14px;align-items:start"><div style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:34px;color:#B8973A;line-height:1">${String(i + 1).padStart(2, '0')}</div><div><strong style="color:#1a2130">${esc(cs.title)}.</strong> ${esc(cs.body)}</div></div>`).join('')}
      <div class="src">Engagement history supplied by Camelot leadership; client-specific references available under separate cover once permission is confirmed.</div>${foot}`),

    // 7 — HOW WE WORK WITH YOU (+ savings chart for deal-side audiences)
    sl(`${logo}<div class="kicker">Working Together</div><h2>How We Work With ${esc(firmName || audienceLabel)}</h2><div class="rule"></div>
      ${audience === 'brokerage' || audience === 'receivership'
        ? `<div style="display:grid;grid-template-columns:1.05fr .95fr;gap:20px;align-items:start"><div>${copy.howWeHelp.slice(0, 4).map(item => `<div class="card">${esc(item)}</div>`).join('')}</div><div>${savingsTargetChart()}</div></div>`
        : `<div style="display:grid;grid-template-columns:1.15fr .85fr;gap:20px;align-items:start"><div>${copy.howWeHelp.map(item => `<div class="card">${esc(item)}</div>`).join('')}</div><div><div class="chart"><div class="chart-title">The Numbers Don't Lie</div><div class="stat" style="margin-bottom:10px"><b>$45,000</b><span>Avg. first-90-day savings boards find</span></div><div class="stat" style="margin-bottom:10px"><b>48 hrs</b><span>Guaranteed response vs. weeks at large firms</span></div><div class="stat"><b>73%</b><span>Boards report better communication after switching</span></div><div class="src">Published at camelot.nyc, July 2026.</div></div><div style="height:130px;border:1px solid rgba(184,151,58,.3);overflow:hidden;margin-top:10px"><img src="${camelotPhoto('app-desk.jpg')}" alt="Camelot resident platform" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none'"></div></div></div>`}
      ${foot}`),

    // 8 — THE VALUE EXCHANGE
    sl(`${logo}<div class="kicker">The Value Exchange</div><h2>What We Bring &mdash; and What We Ask</h2><div class="rule"></div>
      <div class="grid2">
        <div>
          <p class="body" style="font-weight:700;margin-bottom:8px">We bring your practice:</p>
          ${audience === 'law' || audience === 'accounting' ? `<div class="card" style="border-left-color:#1a2130"><strong>Loyalty runs both ways.</strong> When your firm recommends Camelot, your firm stays on with the client after the switch — the relationship you brought stays yours. That is a commitment, not a courtesy.</div>` : ''}
          <div class="card">Clients whose buildings run properly — fewer emergencies landing on your desk, better records behind every engagement</div>
          <div class="card">A steady referral source: boards and landlords regularly ask us for ${audience === 'law' ? 'counsel' : audience === 'accounting' ? 'accountants' : audience === 'audit' ? 'auditors' : audience === 'brokerage' ? 'brokers when they buy, sell, or refinance' : 'workout and disposition professionals'} we trust</div>
          <div class="card">Co-marketing: board education events, newsletters, and introductions across our portfolio</div>
        </div>
        <div>
          <p class="body" style="font-weight:700;margin-bottom:8px">What we ask of you:</p>
          ${copy.whatWeAsk.map(item => `<div class="card">${esc(item)}</div>`).join('')}
          <div class="card" style="background:#22303a;color:rgba(255,255,255,.9);border-left-color:#F4D26A"><strong style="color:#F4D26A">We're also buyers.</strong> Camelot is actively scaling and always in the market to acquire well-run property management companies. If you represent one — or know an owner thinking about an exit — we'd like that conversation.</div>
        </div>
      </div>${foot}`),

    // 9 — COFFEE CLOSER (dark, with HQ map)
    sl(`<div style="position:relative;z-index:2;height:100%;display:grid;grid-template-columns:1.05fr .95fr;gap:34px;align-items:center;padding-bottom:20px">
      <div>
        <h1 style="font-size:54px">Let's Grab a Coffee${contactName ? `, ${esc(contactName.split(' ')[0])}` : ''}</h1>
        <div class="rule"></div>
        <p class="body" style="font-size:17px">Thirty minutes, near ${firmName ? `${esc(firmName)}'s office` : 'your office'} or ours at 57 West 57th Street. We'll compare notes on the boards and landlords we both serve and find the two or three ways we can make each other's work easier this year.</p>
        <p class="body" style="margin-top:22px;font-size:14px;line-height:1.85">${esc(DAVID_GOLDOFF_SIGNATURE_TEXT).replace(/\n/g, '<br>')}</p>
      </div>
      <div>${hqMapEmbed(420)}<div class="src" style="color:rgba(255,255,255,.55)">57 West 57th Street, Suite 410 &mdash; ${today}</div></div>
    </div>${foot}`, 'dark'),
  ].join('\n');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${stem}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${css}</style></head>
<body><div style="position:sticky;top:0;z-index:50;background:#34444f;color:#fff;padding:12px 24px;display:flex;justify-content:space-between;align-items:center">
<div style="font-size:13px;font-weight:900;color:#F4D26A">Camelot Partner Pitch — ${esc(firmName || audienceLabel)}</div>
<div><button style="background:#B8973A;color:#fff;border:0;border-radius:8px;padding:9px 14px;font-size:12px;font-weight:800;cursor:pointer" onclick="document.title='${stem}';setTimeout(function(){window.focus();window.print()},150)">Print / Save PDF</button></div>
</div>${slides}</body></html>`;
}
