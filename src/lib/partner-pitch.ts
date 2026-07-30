/**
 * partner-pitch.ts — Professional Partner Pitch Decks
 *
 * Firm-level decks (not building-specific) aimed at the professionals who
 * serve condo/co-op boards and rental landlords: law firms, accounting
 * firms, and audit practices. Goal: open a referral relationship — "let's
 * grab a coffee and figure out how we work together."
 *
 * Content is drawn from Camelot's existing approved marketing copy
 * (since-2006 history, senior bench, in-house accounting, compliance
 * discipline). Case studies are framed from real engagement patterns in
 * the portfolio without disclosing confidential client specifics.
 */
import { DAVID_GOLDOFF_SIGNATURE_TEXT } from './camelot-signature';

export type PartnerAudience = 'law' | 'accounting' | 'audit';

export const PARTNER_AUDIENCES: Array<{ key: PartnerAudience; label: string; description: string }> = [
  { key: 'law', label: 'Law Firms', description: 'Real estate, co-op/condo, and landlord-tenant practices' },
  { key: 'accounting', label: 'Accounting Firms', description: 'Firms preparing financials and taxes for boards and landlords' },
  { key: 'audit', label: 'Audit Practices', description: 'Auditors of condo, co-op, and HOA financial statements' },
];

const AUDIENCE_COPY: Record<PartnerAudience, {
  title: string;
  hook: string;
  howWeHelp: string[];
  whatWeAsk: string[];
}> = {
  law: {
    title: 'A Management Partner Your Clients Will Thank You For',
    hook: 'When boards and landlords call you about violations, arrears, governance disputes, or a manager who has stopped responding — the underlying problem is usually management, not law. Camelot is the operator you can put behind your advice.',
    howWeHelp: [
      'Litigation support done right: organized records, responsive staff, and clean financial exhibits when your matters need them',
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
    hook: 'Every accountant who serves boards knows the pain: late records, unreconciled accounts, missing invoices, and a manager who goes quiet in March. Camelot was built by people who refuse to run buildings that way.',
    howWeHelp: [
      'Controller-level in-house accounting: monthly closes, AP with board approval workflows, and reconciliations your staff can rely on',
      'Year-end packages delivered complete and on time — general ledger, bank statements, invoices, arrears schedules — before you ask',
      'Budget-to-actual discipline boards can read, so your advisory conversations start from real numbers',
      'A single accountable contact for every request, with response-time standards in writing',
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
};

const CASE_STUDIES: Array<{ title: string; body: string }> = [
  {
    title: 'Pre-war co-op, Queens — stabilization',
    body: 'A historic-district walk-up co-op with fractured record-keeping and an absent manager. Camelot ran a 30-day intake: banking rebuilt, vendor contracts re-papered, arrears workflow live, and the board’s first clean monthly package delivered in week five.',
  },
  {
    title: 'Suburban HOA — recovery engagement',
    body: 'An association in operational distress: claims outstanding, governance stalled, homeowners disengaged. Camelot delivered executive management with claims oversight and a board calendar that put decisions back on schedule.',
  },
  {
    title: 'New-construction condominium — sponsor-to-board rollout',
    body: 'From pre-closing budgets through first-board handoff: offering-plan budget discipline, punch-list vendor management, and financial controls in place before unit owners ever sat at the table.',
  },
];

const MARKETS = 'New York City’s five boroughs, Westchester, Long Island, New Jersey, and Connecticut';

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slide(inner: string, cls = ''): string {
  return `<div class="pslide ${cls}"><div class="logo">CAMELOT<span>PROPERTY MANAGEMENT</span></div>${inner}</div>`;
}

export function buildPartnerPitchFilename(audience: PartnerAudience, extension = 'pdf'): string {
  const label = audience === 'law' ? 'Law-Firms' : audience === 'accounting' ? 'Accounting-Firms' : 'Audit-Practices';
  const date = new Date().toISOString().slice(0, 10);
  return `Camelot-Partner-Pitch-${label}_${date}.${extension}`;
}

export function partnerAudienceLabel(audience: PartnerAudience): string {
  return PARTNER_AUDIENCES.find(a => a.key === audience)?.label || 'Professional Partners';
}

export function generatePartnerPitchDeck(audience: PartnerAudience): string {
  const copy = AUDIENCE_COPY[audience];
  const audienceLabel = partnerAudienceLabel(audience);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const stem = buildPartnerPitchFilename(audience, 'pdf').replace(/\.pdf$/, '');

  const css = `
  * { margin:0; padding:0; box-sizing:border-box; min-width:0; }
  body { font-family:'Plus Jakarta Sans',-apple-system,sans-serif; background:#e9e5da; }
  .pslide { width:1280px; height:720px; margin:20px auto; position:relative; overflow:hidden; background:#FAF8F5; box-shadow:0 4px 20px rgba(0,0,0,.15); padding:56px 64px; page-break-after:always; }
  .pslide p, .pslide div, .pslide li { overflow-wrap:break-word; }
  .pslide.dark { background:#22303a; color:#fff; }
  .logo { position:absolute; top:0; right:0; background:#C9A227; color:#fff; padding:14px 22px; font-weight:800; letter-spacing:3px; font-size:14px; text-align:center; }
  .logo span { display:block; font-size:7px; letter-spacing:2px; font-weight:600; margin-top:2px; }
  h1 { font-family:'Cormorant Garamond',Georgia,serif; font-size:54px; font-style:italic; color:#B8973A; line-height:1.05; }
  .dark h1 { color:#F4D26A; }
  h2 { font-family:'Cormorant Garamond',Georgia,serif; font-size:36px; font-style:italic; color:#B8973A; margin-bottom:18px; }
  .eyebrow { font-size:12px; letter-spacing:2.5px; text-transform:uppercase; color:#B8973A; font-weight:800; margin-bottom:10px; }
  .body { font-size:16px; line-height:1.65; color:#3d4756; max-width:980px; }
  .dark .body { color:rgba(255,255,255,.85); }
  .card { background:#fff; border:1px solid rgba(184,151,58,.35); border-left:4px solid #B8973A; border-radius:6px; padding:16px 20px; margin-bottom:12px; font-size:14px; line-height:1.5; color:#3d4756; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
  .stat { text-align:center; background:#fff; border:1px solid rgba(184,151,58,.3); border-radius:8px; padding:18px 10px; }
  .stat b { display:block; font-size:30px; color:#1a2744; }
  .stat span { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#8a8174; }
  .foot { position:absolute; left:64px; right:64px; bottom:16px; border-top:1px solid rgba(184,151,58,.3); padding-top:8px; font-size:9px; color:#8a8174; }
  @media print { body{background:#fff} .pslide{margin:0;box-shadow:none} }`;

  const foot = `<div class="foot">Camelot Property Management | 57 West 57th Street, Suite 410, New York, NY 10019 | (212) 206-9939 x701 | info@camelot.nyc | www.camelot.nyc</div>`;

  const slides = [
    // 1 — Cover
    slide(`<div style="height:100%;display:flex;flex-direction:column;justify-content:center">
      <div class="eyebrow">For ${esc(audienceLabel)} Serving Boards & Landlords</div>
      <h1 style="font-size:64px;max-width:1000px">${esc(copy.title)}</h1>
      <p class="body" style="margin-top:22px;font-size:19px;max-width:900px">${esc(copy.hook)}</p>
      <p class="body" style="margin-top:28px;font-size:13px;color:#8a8174">Camelot Property Management Services Corp. &middot; ${today}</p>
    </div>${foot}`, 'dark'),

    // 2 — Who we are / history
    slide(`<div class="eyebrow">Who We Are</div><h2>New Yorkers Managing New York Buildings Since 2006</h2>
      <p class="body">Camelot is an independently owned, New York-based property management firm. Our bench combines senior property managers with in-house accounting professionals who navigate New York City compliance, local law, and the daily realities of running buildings here — supported by serious automation that speeds the work, protects the property, and controls costs. We are members of the city's industry organizations, including REBNY, NYARM, IREM, BOMA New York, and CNYC.</p>
      <div class="grid3" style="margin-top:26px">
        <div class="stat"><b>2006</b><span>Founded</span></div>
        <div class="stat"><b>Co-op &middot; Condo &middot; Rental</b><span>Full portfolio coverage</span></div>
        <div class="stat"><b>In-House</b><span>Accounting &amp; compliance</span></div>
      </div>
      <p class="body" style="margin-top:24px"><strong>Where we work:</strong> ${MARKETS}.</p>
      <p class="body" style="margin-top:12px"><strong>Where we're going:</strong> disciplined growth — adding well-run buildings and association clients where our operating model raises the standard, backed by the Camelot OS platform that gives every client day-one visibility into their own building's public record.</p>${foot}`),

    // 3 — Track record / case studies
    slide(`<div class="eyebrow">Track Record</div><h2>Engagements That Look Like Your Clients</h2>
      ${CASE_STUDIES.map(cs => `<div class="card"><strong>${esc(cs.title)}.</strong> ${esc(cs.body)}</div>`).join('')}
      <p class="body" style="font-size:12px;color:#8a8174;margin-top:10px">Client-specific references available under separate cover once permission is confirmed.</p>${foot}`),

    // 4 — How we work with your team
    slide(`<div class="eyebrow">Working Together</div><h2>How We Work With ${esc(audienceLabel)}</h2>
      <div class="grid2">${copy.howWeHelp.map(item => `<div class="card">${esc(item)}</div>`).join('')}</div>${foot}`),

    // 5 — The value exchange
    slide(`<div class="eyebrow">The Value Exchange</div><h2>What We Bring &mdash; and What We Ask</h2>
      <div class="grid2">
        <div>
          <p class="body" style="font-weight:700;margin-bottom:10px">We bring your practice:</p>
          <div class="card">Clients whose buildings run properly — fewer emergencies landing on your desk, better records behind every engagement</div>
          <div class="card">A steady referral source: boards and landlords regularly ask us for ${audience === 'law' ? 'counsel' : audience === 'accounting' ? 'accountants' : 'auditors'} we trust</div>
          <div class="card">Co-marketing: board education events, newsletters, and introductions across our portfolio</div>
        </div>
        <div>
          <p class="body" style="font-weight:700;margin-bottom:10px">What we ask of you:</p>
          ${copy.whatWeAsk.map(item => `<div class="card">${esc(item)}</div>`).join('')}
        </div>
      </div>${foot}`),

    // 6 — Coffee CTA
    slide(`<div style="height:100%;display:flex;flex-direction:column;justify-content:center;text-align:center">
      <h1 style="font-size:56px">Let's Grab a Coffee</h1>
      <p class="body" style="margin:22px auto 0;max-width:760px;font-size:18px">Thirty minutes, near your office or ours at 57 West 57th Street. We'll compare notes on the boards and landlords we both serve and find the two or three ways we can make each other's work easier this year.</p>
      <p class="body" style="margin:30px auto 0;font-size:15px;line-height:1.9">${esc(DAVID_GOLDOFF_SIGNATURE_TEXT).replace(/\n/g, '<br>')}</p>
    </div>${foot}`, 'dark'),
  ].join('\n');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${stem}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${css}</style></head>
<body><div style="position:sticky;top:0;z-index:50;background:#34444f;color:#fff;padding:12px 24px;display:flex;justify-content:space-between;align-items:center">
<div style="font-size:13px;font-weight:900;color:#F4D26A">Camelot Partner Pitch — ${esc(audienceLabel)}</div>
<div><button style="background:#B8973A;color:#fff;border:0;border-radius:8px;padding:9px 14px;font-size:12px;font-weight:800;cursor:pointer" onclick="document.title='${stem}';setTimeout(function(){window.focus();window.print()},150)">Print / Save PDF</button></div>
</div>${slides}</body></html>`;
}
