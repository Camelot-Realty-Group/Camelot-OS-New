/**
 * Neighbor Prospect One-Pager — HTML generator.
 *
 * Part of the "Neighboring Buildings" expansion campaign: for every
 * building identified as sitting on the same tax block or directly across
 * the street from a Camelot-managed property, this produces a single-page,
 * branded HTML report combining (a) public facts about their building
 * pulled from NYC Open Data (PLUTO/HPD), (b) which specific Camelot-managed
 * building(s) sit nearest to them, and (c) Camelot's track record/services/
 * technology pitch — the same "why us" content used in partner-pitch.ts,
 * condensed to one page.
 *
 * Uses the same .page / letterhead / typography contract as
 * rental-agreement-v3.ts so it renders and downloads through the existing
 * downloadAsPDF() / downloadAsHTML() pipeline in pdf-generator.ts unchanged.
 */

import { RENTAL_AGREEMENT_LOGO_B64 } from '@/lib/agreement-brand';

const COVER_TITLE_COLOR = '#2F5597';
const HEADING_FONT = "Georgia,'Times New Roman',serif";
const DARK_GOLD = '#8B6F47';
const GOLD_RULE = '#B8960F';
const BODY_FONT = "Arial,Helvetica,sans-serif";
const BODY_BLACK = '#000000';

const CAMELOT_OFFICE = {
  address: '57 West 57th Street, Suite 410, New York, NY 10019',
  phone: '(212) 206-9939',
  email: 'info@camelot.nyc',
  web: 'www.camelot.nyc',
};

const CAMELOT_FACTS = {
  founded: '2006',
  portfolioCount: '42+',
  aum: '$240M+',
  units: '5,351+',
};

export interface NeighborProspectInput {
  /** Prospect building being pitched */
  prospectAddress: string;
  prospectBorough: string; // 2-letter code MN/BK/QN/BX/SI
  prospectBbl?: string;
  prospectBlock?: string;
  prospectLot?: string;
  bldgClass?: string;
  landUse?: string;
  unitsTotal?: number | string;
  numFloors?: number | string;
  yearBuilt?: number | string;
  zipCode?: string;
  ownerName?: string;
  relationship: 'same_block' | 'across_street';
  /** Names of the Camelot-managed buildings nearest to this prospect */
  nearestCamelotBuildings: string[];
  /** Contact to address the letter to, if resolved */
  contactName?: string;
  contactCompany?: string;
  mailingAddress?: string;
  mailingZip?: string;
  /** Filename-friendly campaign version/date stamp */
  version?: string;
  date?: string;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

const BOROUGH_NAMES: Record<string, string> = {
  MN: 'Manhattan', BK: 'Brooklyn', QN: 'Queens', BX: 'Bronx', SI: 'Staten Island',
};

function relationshipLabel(rel: 'same_block' | 'across_street'): string {
  return rel === 'same_block' ? 'on your block' : 'directly across the street';
}

export function generateNeighborProspectReport(input: NeighborProspectInput): string {
  const boroName = BOROUGH_NAMES[input.prospectBorough] || input.prospectBorough;
  const nearest = input.nearestCamelotBuildings.slice(0, 4);
  const version = input.version || 'v2026.08';
  const date = input.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const salutation = input.contactName ? `${esc(input.contactName)}` : 'Property Owner';

  const factRows: Array<[string, string]> = [];
  if (input.unitsTotal) factRows.push(['Units', esc(input.unitsTotal)]);
  if (input.numFloors) factRows.push(['Floors', esc(input.numFloors)]);
  if (input.yearBuilt) factRows.push(['Year Built', esc(input.yearBuilt)]);
  if (input.bldgClass) factRows.push(['Building Class', esc(input.bldgClass)]);
  if (input.prospectBlock && input.prospectLot) factRows.push(['Block / Lot', `${esc(input.prospectBlock)} / ${esc(input.prospectLot)}`]);
  if (input.zipCode) factRows.push(['ZIP', esc(input.zipCode)]);

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Camelot Realty Group — ${esc(input.prospectAddress)}</title>
<style>
@page{size:letter;margin:0}
*{box-sizing:border-box}
body{font-family:${BODY_FONT};color:${BODY_BLACK};font-size:9.5pt;line-height:1.5;background:#f5f0e5;margin:0}
.page{width:8.5in;min-height:11in;margin:0 auto;background:#fff;padding:0.6in 0.65in 0.7in;position:relative}
.letterhead{display:flex;align-items:center;justify-content:space-between;border-bottom:2pt solid ${GOLD_RULE};padding-bottom:10pt;margin-bottom:18pt}
.letterhead img{height:44px}
.letterhead .office{text-align:right;font-size:8pt;color:#444}
h1.title{font-family:${HEADING_FONT};font-size:20pt;color:${COVER_TITLE_COLOR};margin:0 0 2pt;font-weight:700}
p.subtitle{font-family:${BODY_FONT};font-size:11pt;color:#555;margin:0 0 16pt}
.badge{display:inline-block;background:${DARK_GOLD};color:#fff;font-size:8pt;letter-spacing:0.5px;text-transform:uppercase;padding:3pt 9pt;border-radius:3px;margin-bottom:14pt}
h2.section{font-family:${HEADING_FONT};font-size:12pt;font-weight:700;color:${DARK_GOLD};text-transform:uppercase;letter-spacing:1px;border-bottom:1pt solid ${GOLD_RULE};padding:10pt 0 4pt;margin:18pt 0 8pt}
p.body-text{margin:0 0 10pt;font-size:9.5pt}
table.facts{width:100%;border-collapse:collapse;margin:6pt 0 4pt}
table.facts td{padding:4pt 8pt;font-size:9pt;border-bottom:0.5pt solid #ddd}
table.facts td.k{color:#666;width:35%}
table.facts td.v{font-weight:700}
.nearby-list{margin:4pt 0 0;padding-left:16pt}
.nearby-list li{margin-bottom:3pt;font-size:9.5pt}
.stat-row{display:flex;gap:10pt;margin:8pt 0 4pt}
.stat{flex:1;background:#faf7f0;border:0.5pt solid ${GOLD_RULE};border-radius:4px;padding:8pt;text-align:center}
.stat b{display:block;font-family:${HEADING_FONT};font-size:13pt;color:${DARK_GOLD}}
.stat span{font-size:7.5pt;color:#666;text-transform:uppercase;letter-spacing:0.5px}
.cta-box{margin-top:16pt;background:#faf7f0;border:1pt solid ${GOLD_RULE};border-radius:6px;padding:14pt 16pt}
.cta-box h3{font-family:${HEADING_FONT};font-size:11pt;color:${DARK_GOLD};margin:0 0 6pt}
.footer{position:absolute;bottom:0.4in;left:0.65in;right:0.65in;border-top:0.5pt solid #ccc;padding-top:6pt;font-size:7.5pt;color:#666;display:flex;justify-content:space-between}
</style></head>
<body>
<div class="page">
  <div class="letterhead">
    <img src="${RENTAL_AGREEMENT_LOGO_B64}" alt="Camelot Realty Group"/>
    <div class="office">
      Camelot Realty Group<br/>${esc(CAMELOT_OFFICE.address)}<br/>${esc(CAMELOT_OFFICE.phone)} &middot; ${esc(CAMELOT_OFFICE.web)}
    </div>
  </div>

  <div class="badge">We manage ${nearest.length > 1 ? 'buildings' : 'a building'} ${relationshipLabel(input.relationship)}</div>
  <h1 class="title">${esc(input.prospectAddress)}</h1>
  <p class="subtitle">${boroName}, New York &middot; Prepared for ${salutation}${input.contactCompany ? `, ${esc(input.contactCompany)}` : ''}</p>

  <p class="body-text">
    We're Camelot Realty Group — New Yorkers managing New York buildings since ${CAMELOT_FACTS.founded}. We wanted to introduce
    ourselves because we currently manage ${nearest.length > 1 ? 'the following buildings' : 'a building'} ${relationshipLabel(input.relationship)}
    at ${esc(input.prospectAddress)}:
  </p>
  <ul class="nearby-list">
    ${nearest.map((b) => `<li><b>${esc(b)}</b></li>`).join('\n    ')}
  </ul>
  <p class="body-text">
    That means our team is already on this block regularly — for inspections, vendor coordination, and day-to-day
    building operations. We thought it was worth a short introduction, on the chance your building's ownership or
    board is ever evaluating management.
  </p>

  <h2 class="section">Your Building</h2>
  <table class="facts">
    ${factRows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${v}</td></tr>`).join('\n    ')}
  </table>

  <h2 class="section">Camelot, By the Numbers</h2>
  <div class="stat-row">
    <div class="stat"><b>${CAMELOT_FACTS.portfolioCount}</b><span>Buildings Managed</span></div>
    <div class="stat"><b>${CAMELOT_FACTS.aum}</b><span>Under Management</span></div>
    <div class="stat"><b>${CAMELOT_FACTS.units}</b><span>Units Tracked</span></div>
    <div class="stat"><b>${new Date().getFullYear() - Number(CAMELOT_FACTS.founded)}+</b><span>Years in NYC</span></div>
  </div>

  <h2 class="section">How We're Different</h2>
  <p class="body-text">
    <b>Local, hands-on management.</b> No call centers, no regional managers three boroughs away — the person who
    answers the phone knows your building.<br/>
    <b>Camelot OS technology platform.</b> Owners and boards get a live portal: real-time financials, compliance
    tracking (DOB/HPD/ECB), vendor bids, and building performance benchmarked against comparable NYC properties —
    not a monthly PDF.<br/>
    <b>Transparent, market-tested pricing.</b> Management fees and vendor contracts are benchmarked against our own
    live portfolio data, so owners can see exactly how their costs compare to similar buildings nearby.
  </p>

  <div class="cta-box">
    <h3>Worth 20 Minutes?</h3>
    <p class="body-text" style="margin:0">
      We're glad to walk through what a management transition would look like for ${esc(input.prospectAddress)} —
      in person, since we're already in the neighborhood, or by Zoom. No pressure, no obligation.
      Reach us at ${esc(CAMELOT_OFFICE.phone)} or ${esc(CAMELOT_OFFICE.email)}.
    </p>
  </div>

  <div class="footer">
    <span>${esc(CAMELOT_OFFICE.address)} &middot; ${esc(CAMELOT_OFFICE.phone)}</span>
    <span>CONFIDENTIAL &middot; ${esc(version)} &middot; ${esc(date)}</span>
  </div>
</div>
</body></html>`;
}
