import { GOOGLE_MAPS_KEY } from '@/lib/maps-key';
import { generateRentalAgreementV3 } from './rental-agreement-v3';
/**
 * @deprecated v2026.05.31 — Excalibur will be replaced by an Edge Function
 * (`agreements-generate`) backed by the same Fact Packet store as Jackie. The
 * 800-line client-side generator ships brand-fragile output and bakes the
 * AI prompt into the browser bundle. Migrate `src/pages/Agreements.tsx` to
 * call the new function, then delete this file.
 *
 * Tracking: see Camelot_OS_v2026.05.31_Diagnostic_and_Rebuild.md § Cleanup.
 *
 * ORIGINAL HEADER:
 * Excalibur — Camelot Agreement Engine
 * Generates branded property management agreements by asset class.
 * Pulls building data from Jackie/SCOUT to auto-populate where possible.
 */

import type { MasterReportData, TieredPricing } from './camelot-report';

// ============================================================
// Types
// ============================================================

export type AssetClass = 'rental' | 'condo' | 'coop' | 'new-construction' | 'office' | 'retail' | 'single-tenant';

export interface AgreementInput {
  // Asset class
  assetClass: AssetClass;
  // Parties
  clientName: string;
  clientEntityName: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  // Building details
  units: number;
  blockLot: string;  // e.g., "Block 1234, Lot 56"
  isRentStabilized: boolean;
  isUnion: boolean;
  buildingType: string;  // e.g., "45 Residential Units · All Rent Stabilized"
  // Agreement terms
  effectiveDate: string;  // YYYY-MM-DD
  initialTermYears: number;  // default 2
  renewalTermYears: number;  // default 1
  terminationNoticeDays: number;  // default 90
  annualIncrease: number;  // default 4 (percent)
  // Pricing
  selectedTier: 'classic' | 'intelligence' | 'premier';
  customMonthlyFee: number | null;  // override calculated fee
  startupFee: number;  // default 0
  // Special terms
  specialTerms: string;
  // Property photographs uploaded on the Agreements page (data URIs).
  // First image is the cover; empty array = no image block in the output.
  propertyImages?: string[];
  // Key facts parsed from uploaded supporting documents (PropertyShark
  // PDFs, rent rolls, Word docs) — rendered as a Property Overview list.
  propertyIntel?: string[];
  // Jackie data (auto-populated if available)
  jackieData: MasterReportData | null;
  tieredPricing: TieredPricing | null;
}

export const DEFAULT_INPUT: AgreementInput = {
  assetClass: 'rental',
  clientName: '',
  clientEntityName: '',
  clientAddress: '',
  clientPhone: '',
  clientEmail: '',
  propertyAddress: '',
  propertyCity: 'New York',
  propertyState: 'NY',
  propertyZip: '',
  units: 0,
  blockLot: '',
  isRentStabilized: false,
  isUnion: false,
  buildingType: '',
  effectiveDate: new Date().toISOString().slice(0, 10),
  initialTermYears: 2,
  renewalTermYears: 1,
  terminationNoticeDays: 90,
  annualIncrease: 4,
  selectedTier: 'intelligence',
  customMonthlyFee: null,
  startupFee: 0,
  specialTerms: '',
  propertyImages: [],
  propertyIntel: [],
  jackieData: null,
  tieredPricing: null,
};

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  'rental': 'Residential Rental Building',
  'condo': 'Condominium',
  'coop': 'Cooperative (Co-op)',
  'new-construction': 'New Construction Condominium',
  'office': 'Office Building',
  'retail': 'Retail Property',
  'single-tenant': 'Single Tenant / Individual Unit',
};

// ============================================================
// Constants
// ============================================================

const CAMELOT = {
  name: 'CAMELOT PROPERTY MANAGEMENT SERVICES CORP.',
  shortName: 'Camelot Property Management Services Corp.',
  address: '57 West 57th Street, Suite 410, New York, NY 10019',
  phone: '(212) 206-9939 x 701',
  mobile: '(212) 206-9939 ext. 701',
  email: 'info@camelot.nyc',
  web: 'www.camelot.nyc',
  principal: 'David A. Goldoff',
  title: 'President',
};

// ============================================================
// Fee Calculator
// ============================================================

function getMonthlyFee(input: AgreementInput): number {
  if (input.customMonthlyFee) return input.customMonthlyFee;
  if (input.tieredPricing) {
    const tier = input.tieredPricing[input.selectedTier];
    return tier.monthly;
  }
  // Fallback: calculate from units
  let perUnit: number;
  const u = input.units || 1;
  switch (input.selectedTier) {
    case 'classic': perUnit = u < 30 ? 50 : u <= 75 ? 45 : u <= 150 ? 40 : 38; break;
    case 'intelligence': perUnit = u < 30 ? 65 : u <= 75 ? 55 : u <= 150 ? 50 : 45; break;
    case 'premier': perUnit = u < 30 ? 85 : u <= 75 ? 75 : u <= 150 ? 70 : 65; break;
  }
  return perUnit * u;
}

function getPerUnit(input: AgreementInput): number {
  const monthly = getMonthlyFee(input);
  return Math.round(monthly / (input.units || 1));
}

// ============================================================
// HTML Agreement Generator
// ============================================================

export function generateRentalAgreement(input: AgreementInput): string {
  const fee = getMonthlyFee(input);
  const perUnit = getPerUnit(input);
  const fullAddr = `${input.propertyAddress}, ${input.propertyCity}, ${input.propertyState} ${input.propertyZip}`.trim();
  const tierLabel = input.selectedTier === 'classic' ? 'Camelot Classic' : input.selectedTier === 'intelligence' ? 'Camelot Intelligence' : 'Camelot Premier';
  const year = new Date(input.effectiveDate || Date.now()).getFullYear();

    const version = `v${new Date().getFullYear()}.${(new Date().getMonth()+1).toString().padStart(2,'0')}.1`;
  const timestamp = new Date().toISOString();
  const encodedAddr = encodeURIComponent(fullAddr);

  const css = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;color:#2C3240;font-size:12px;line-height:1.7;background:#fff}
@media print{@page{margin:0.6in 0.75in;size:letter}body{font-size:11px}}
.page{max-width:750px;margin:0 auto;padding:40px 0;counter-reset:page-num}
h1,h2,h3{font-family:'Plus Jakarta Sans',sans-serif}
.article,.cover{counter-increment:page-num;position:relative}
.page-footer{text-align:center;font-size:8px;color:#bbb;padding-top:8px;border-top:1px solid #E5E3DE;margin-top:16px;display:flex;justify-content:space-between;align-items:center}
.page-footer::after{content:counter(page-num);font-weight:500;font-size:9px;color:#999}
.cover{background:#3A4B5B;color:#fff;padding:60px;text-align:center;min-height:700px;display:flex;flex-direction:column;justify-content:center;align-items:center;page-break-after:always;border:3px solid #A89035}
.cover .wordmark{font-family:'Plus Jakarta Sans',sans-serif;font-size:18px;letter-spacing:12px;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:4px}
.cover h1{font-family:'Plus Jakarta Sans',sans-serif;font-size:28px;color:#A89035;font-weight:700;margin:20px 0 8px}
.cover .subtitle{font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:4px}
.cover .meta{font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px}
.cover .prepared{margin-top:40px;font-size:12px;color:#A89035;font-style:italic}
.article{page-break-inside:avoid;margin-bottom:20px}
.article-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;color:#A89035;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #A89035}
.article-sub{font-size:13px;font-weight:600;color:#3A4B5B;margin:12px 0 6px}
.article p{margin-bottom:8px;text-align:justify}
.footer{text-align:center;font-size:9px;color:#999;padding-top:10px;border-top:1px solid #E5E3DE;margin-top:20px}
.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
.sig-box{padding-top:20px}
.sig-line{border-bottom:1px solid #2C3240;height:40px;margin-bottom:4px}
.sig-label{font-size:10px;color:#888}
table.schedule{width:100%;border-collapse:collapse;margin:12px 0;font-size:11px}
table.schedule th{background:#A89035;color:#fff;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px}
table.schedule td{padding:8px 12px;border-bottom:1px solid #E5E3DE}
table.schedule tr:nth-child(even){background:#F5F0E5}
.free{color:#16a34a;font-weight:700}
.included{color:#A89035;font-weight:600}
.tier-badge{display:inline-block;background:#A89035;color:#fff;padding:2px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
</style>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Property Management Agreement — ${input.clientName || 'Client'} | ${CAMELOT.shortName}</title>
${css}
</head>
<body>
<div class="page">

<!-- COVER PAGE -->
<div class="cover">
<img src="./images/camelot-logo-white.png" alt="Camelot" style="width:140px;margin-bottom:32px;opacity:0.95" onerror="this.parentElement.querySelector('.wordmark').style.marginTop='40px';this.style.display='none'">

<h1 style="font-size:26px;margin-bottom:4px">Property Management Agreement</h1>
<div class="subtitle">For ${ASSET_CLASS_LABELS[input.assetClass]}</div>

<div style="width:60px;height:2px;background:#A89035;margin:24px auto"></div>

<!-- PREPARED FOR — large and bold -->
<div style="margin:20px 0;max-width:600px">
<div style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.4);margin-bottom:8px">Prepared For</div>
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:28px;font-weight:800;color:#A89035;line-height:1.3;margin-bottom:8px">${input.clientName || '[Client Name]'}</div>
${input.clientEntityName && input.clientEntityName !== input.clientName ? `<div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:12px">${input.clientEntityName}</div>` : ''}
</div>

<!-- PROPERTY DETAILS — bold and prominent -->
<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(168,144,53,0.3);border-radius:8px;padding:20px 28px;margin:16px 0;max-width:500px;text-align:left">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:18px;font-weight:700;color:#fff;margin-bottom:6px">${fullAddr}</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin-top:10px">
${input.blockLot ? `<div><span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4)">Block & Lot</span><div style="font-size:13px;font-weight:700;color:#A89035">${input.blockLot}</div></div>` : ''}
${input.units ? `<div><span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4)">Units</span><div style="font-size:13px;font-weight:700;color:#A89035">${input.units}</div></div>` : ''}
${input.jackieData?.stories ? `<div><span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4)">Stories</span><div style="font-size:13px;font-weight:700;color:#A89035">${input.jackieData.stories}</div></div>` : ''}
<div><span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4)">Asset Class</span><div style="font-size:13px;font-weight:700;color:#A89035">${ASSET_CLASS_LABELS[input.assetClass]}</div></div>
</div>
</div>

<!-- METADATA -->
<div style="margin-top:20px;font-size:11px;color:rgba(255,255,255,0.5);line-height:2">
<div><strong style="color:rgba(255,255,255,0.7)">Date:</strong> ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
<div><strong style="color:rgba(255,255,255,0.7)">Prepared By:</strong> ${CAMELOT.principal}, ${CAMELOT.title} — ${CAMELOT.shortName}</div>
<div><strong style="color:rgba(255,255,255,0.7)">Valid Until:</strong> ${(() => { const d = new Date(); let biz = 0; while (biz < 10) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) biz++; } return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); })()} (10 business days)</div>
</div>

<div style="margin-top:16px"><span class="tier-badge">${tierLabel} Package</span></div>

<div style="position:absolute;bottom:20px;left:0;right:0;text-align:center">
<div style="font-size:10px;color:rgba(255,255,255,0.3)">${CAMELOT.name}</div>
<div style="font-size:9px;color:rgba(255,255,255,0.2)">${CAMELOT.address} · ${CAMELOT.phone} · ${CAMELOT.web}</div>
<div style="font-size:8px;color:rgba(255,255,255,0.15);margin-top:4px">Confidential · ${version}</div>
</div>
</div>

<!-- PROPERTY VISUAL & MAP -->
<div class="article" style="page-break-before:always">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:18px;color:#A89035;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #A89035">The Property</div>

<!-- Street View Photo -->
${input.jackieData?.latitude && input.jackieData?.longitude ? `
<div style="border-radius:8px;overflow:hidden;border:1px solid #D5D0C6;height:250px;margin-bottom:12px;position:relative">
<iframe src="https://www.google.com/maps/embed/v1/streetview?key=${GOOGLE_MAPS_KEY}&location=${input.jackieData.latitude},${input.jackieData.longitude}&heading=0&pitch=5&fov=80" width="100%" height="250" style="border:0" allowfullscreen loading="lazy"></iframe>
<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(58,75,91,0.9));padding:12px 16px 8px;color:#fff">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;font-weight:700">${fullAddr}</div>
<div style="font-size:10px;opacity:0.7">${input.units || ''} Units ${input.blockLot ? '· ' + input.blockLot : ''}</div>
</div>
</div>
` : `
<div style="border-radius:8px;overflow:hidden;border:1px solid #D5D0C6;height:250px;margin-bottom:12px">
<iframe src="https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${encodedAddr}&zoom=18&maptype=satellite" width="100%" height="250" style="border:0" allowfullscreen loading="lazy"></iframe>
</div>
`}

<!-- Two maps: Street + Directions to Camelot -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
<div style="border-radius:6px;overflow:hidden;border:1px solid #D5D0C6">
<iframe src="https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${encodedAddr}&zoom=16" width="100%" height="160" style="border:0" allowfullscreen loading="lazy"></iframe>
<div style="text-align:center;font-size:8px;color:#999;padding:3px">📍 Property Location</div>
</div>
<div style="border-radius:6px;overflow:hidden;border:1px solid #D5D0C6">
<iframe src="https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_KEY}&origin=57+West+57th+Street+Suite+410+New+York+NY+10019&destination=${encodedAddr}&mode=driving" width="100%" height="160" style="border:0" allowfullscreen loading="lazy"></iframe>
<div style="text-align:center;font-size:8px;color:#999;padding:3px">🚗 From Camelot HQ — 57 West 57th Street</div>
</div>
</div>

<!-- Property Details Grid -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px">
<div style="background:#EDE9DF;border-radius:6px;padding:10px;text-align:center">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;font-weight:800;color:#A89035">${input.units || '—'}</div>
<div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px">Units</div>
</div>
<div style="background:#EDE9DF;border-radius:6px;padding:10px;text-align:center">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;color:#3A4B5B">${input.blockLot || '—'}</div>
<div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px">Block/Lot</div>
</div>
<div style="background:#EDE9DF;border-radius:6px;padding:10px;text-align:center">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;color:#3A4B5B">${input.isRentStabilized ? 'Yes' : 'No'}</div>
<div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px">Rent Stabilized</div>
</div>
<div style="background:#EDE9DF;border-radius:6px;padding:10px;text-align:center">
<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;color:#3A4B5B">${input.isUnion ? '32BJ' : 'Non-Union'}</div>
<div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:1px">Labor Status</div>
</div>
</div>

<div class="page-footer">
<span>${CAMELOT.shortName} · ${CAMELOT.address}</span>
<span>${version} · ${timestamp.split('T')[0]} · Generated by Excalibur AI</span>
</div>
</div>

<!-- PREAMBLE -->
<div class="article">
<p>THIS PROPERTY MANAGEMENT AGREEMENT (the "Agreement") is made as of ${input.effectiveDate ? new Date(input.effectiveDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '________________, ' + year} (the "Effective Date"), by and between:</p>

<p><strong>CLIENT ("Owner"):</strong> ${input.clientEntityName || input.clientName || '[Client Entity Name]'} ("Client")<br>
Property Address: ${fullAddr}<br>
Portfolio: ${input.units || '[___]'} ${input.buildingType || 'Residential Units'}${input.isRentStabilized ? ' · All Rent Stabilized' : ''}${input.blockLot ? '<br>Block/Lot: ' + input.blockLot : ''}</p>

<p><strong>AGENT ("Manager"):</strong> ${CAMELOT.name}, a New York corporation ("Agent"), ${CAMELOT.address} · ${CAMELOT.principal}, ${CAMELOT.title} · ${CAMELOT.mobile} · ${CAMELOT.email}</p>

<p>WHEREAS the Client owns real property known as and located at: ${fullAddr} (the "Property"), consisting of ${input.units || '[___]'} ${
  input.assetClass === 'condo' ? 'condominium units governed by a Declaration and By-Laws filed with the New York State Attorney General\'s office pursuant to Article 9-B of the New York Real Property Law (the "Condominium Act")' :
  input.assetClass === 'coop' ? 'cooperative apartment units, ownership of which is evidenced by shares of stock in the cooperative corporation and a proprietary lease' :
  input.assetClass === 'office' ? 'office/commercial units subject to commercial lease agreements' :
  input.assetClass === 'single-tenant' ? 'residential unit(s)' :
  `${input.isRentStabilized ? 'rent-stabilized ' : ''}residential rental units`
}; and</p>
<p>WHEREAS the Client desires to engage the Agent to perform property management services as set forth herein, and the Agent desires to accept such engagement;</p>
<p>NOW, THEREFORE, for good and valuable consideration, the sufficiency of which is hereby acknowledged, the Parties agree as follows:</p>
</div>

<!-- ARTICLE I — DEFINITIONS -->
<div class="article">
<div class="article-title">Article I — Definitions</div>
<ul style="list-style:none;margin:0;padding:0">
<li style="margin-bottom:8px"><strong>"Additional Services"</strong> shall mean Lease Services, Transfer Services, Financing Services, Hearing Services, Audit Services, Pre-Occupation Services, and Emergency Services, as each are defined in Article VII.</li>
<li style="margin-bottom:8px"><strong>"Client Account"</strong> shall mean a bank account, held at an FDIC-insured institution, maintained by the Agent on behalf of and for the benefit of the Client, to receive rent collections and disburse approved operating expenses.</li>
<li style="margin-bottom:8px"><strong>"Emergency Services"</strong> shall mean any Additional Services that, by reasonable determination of the Agent, must be performed on an emergency basis to protect the safety of persons or to prevent imminent damage to the Property and cannot await prior written approval.</li>
<li style="margin-bottom:8px"><strong>"Employees"</strong> shall mean all persons necessary to be employed or otherwise engaged (including superintendents, porters, handymen, and other building staff) to properly maintain and operate the Property.</li>
<li style="margin-bottom:8px"><strong>"Effective Date"</strong> shall mean the date first written above on which this Agreement becomes operative.</li>
<li style="margin-bottom:8px"><strong>"Lease Rate"</strong> shall mean the annual or monthly rate of rent charged to a tenant under a lease agreement.</li>
<li style="margin-bottom:8px"><strong>"Reimbursable Expenses"</strong> shall mean all reasonable, documented out-of-pocket expenses incurred by the Agent in connection with the Services and Additional Services, to be paid from Client Accounts.</li>
<li style="margin-bottom:8px"><strong>"Residential Unit"</strong> shall mean any and all residential dwelling units at the Property subject to this Agreement, including any preferential, market-rate, or rent-stabilized units.</li>
<li style="margin-bottom:8px"><strong>"Services"</strong> shall mean the property management duties of the Agent set forth in Article VI of this Agreement, not including the Additional Services.</li>
<li style="margin-bottom:8px"><strong>"Term"</strong> shall mean the Initial Period and any renewal period(s) as described in Article II.</li>
<li style="margin-bottom:8px"><strong>"Union Contract"</strong> shall mean any collective bargaining agreement or contract with a labor union representing Employees at the Property.</li>
</ul>
${input.assetClass === 'condo' ? `
<p>"Board of Managers" shall mean the governing body of the Condominium as established by the Declaration and By-Laws.</p>
<p>"Common Charges" shall mean the monthly charges assessed to each unit owner for the maintenance, repair, and operation of the common elements of the Condominium.</p>
<p>"Common Elements" shall mean the portions of the Condominium property designated for common use by all unit owners as defined in the Declaration.</p>
<p>"Declaration" shall mean the Declaration of Condominium establishing the Property as a condominium under the New York Condominium Act (RPL Article 9-B).</p>
<p>"Offering Plan" shall mean the plan filed with the New York State Attorney General's office pursuant to the Martin Act and General Business Law Article 23-A.</p>
<p>"Alteration Agreement" shall mean the agreement required for any unit owner renovation, establishing insurance, indemnification, and construction management requirements.</p>
` : ''}
${input.assetClass === 'coop' ? `
<p>"Board of Directors" shall mean the governing body of the Cooperative Corporation.</p>
<p>"Maintenance" shall mean the monthly charges assessed to each shareholder based on share allocation for the operation, maintenance, and underlying mortgage obligations of the Cooperative.</p>
<p>"Proprietary Lease" shall mean the lease agreement between the Cooperative Corporation and each shareholder granting occupancy rights to a specific apartment.</p>
<p>"Share Certificate" shall mean the stock certificate evidencing a shareholder's ownership interest in the Cooperative Corporation.</p>
<p>"Flip Tax" shall mean the transfer fee payable to the Cooperative Corporation upon the sale or transfer of shares, as set forth in the Proprietary Lease or House Rules.</p>
<p>"Sublet Policy" shall mean the Cooperative's rules governing subletting of apartments by shareholders, including any sublet fees, duration limits, and board approval requirements.</p>
<p>"Recognition Agreement" shall mean the agreement between the Cooperative Corporation and a shareholder's lender acknowledging the lender's security interest in the shares and proprietary lease.</p>
` : ''}
${input.assetClass === 'office' ? `
<p>"CAM Charges" shall mean Common Area Maintenance charges allocated to tenants on a pro rata basis based on their proportionate share of rentable square footage.</p>
<p>"Tenant Improvement Allowance" (TI) shall mean any landlord contribution toward the build-out or improvement of a commercial tenant's space.</p>
<p>"NNN" or "Triple Net" shall mean a lease structure in which the tenant pays base rent plus its proportionate share of real estate taxes, insurance, and CAM charges.</p>
<p>"Lease Escalation" shall mean contractual rent increases, whether fixed, indexed to CPI, or based on operating expense pass-throughs.</p>
<p>"Certificate of Occupancy" (CO) shall mean the document issued by the NYC Department of Buildings certifying that the premises comply with applicable building codes and are authorized for the intended use.</p>
` : ''}
${input.assetClass === 'single-tenant' ? `
<p>"Unit" shall mean the individual residential dwelling unit that is the subject of this Agreement.</p>
<p>"Tenant" shall mean the current or future occupant of the Unit under a residential lease agreement.</p>
` : ''}
</div>

<!-- ARTICLE II — TERM -->
<div class="article">
<div class="article-title">Article II — Term</div>
<p>The initial period of this Agreement (the "Initial Period") shall commence on the Effective Date and conclude on the ${input.initialTermYears === 1 ? 'one (1) year' : input.initialTermYears === 2 ? 'two (2) year' : input.initialTermYears + ' (' + input.initialTermYears + ') year'} anniversary of the Effective Date, unless sooner terminated in accordance with Article IV hereof.</p>
<p>Upon expiration of the Initial Period, this Agreement shall automatically renew for successive ${input.renewalTermYears === 1 ? 'one (1) year' : input.renewalTermYears + ' (' + input.renewalTermYears + ') year'} terms (each, a "Renewal Term"), unless either Party provides written notice of non-renewal at least ${input.terminationNoticeDays} (${input.terminationNoticeDays}) days prior to the end of the then-current term. The Initial Period and any Renewal Term(s) are collectively referred to herein as the "Term."</p>
<p>The management fee set forth in Article V shall be subject to an annual increase of ${input.annualIncrease} percent (${input.annualIncrease}%) on each anniversary of the Effective Date during the Term.</p>
</div>

<!-- ARTICLE III — EXCLUSIVE AGENCY -->
<div class="article">
<div class="article-title">Article III — Exclusive Agency</div>
<p>During the Term, and absent prior written consent of the Agent, no party other than the Agent shall perform any of the Services at the Property. The Client acknowledges and agrees that the Agent shall serve as the sole and exclusive managing agent for the Property during the Term.</p>
<p>The Agent shall have the authority to act on behalf of the Client in all matters relating to the day-to-day operation and management of the Property, subject to the limitations and requirements set forth in this Agreement.</p>
</div>

<!-- ARTICLE IV — TERMINATION -->
<div class="article">
<div class="article-title">Article IV — Termination</div>
<div class="article-sub">4.1 Termination for Cause.</div>
<p>If either Party is in material breach of this Agreement, the non-breaching Party shall provide written notice of such breach. The breaching Party shall have fifteen (15) business days from receipt of such notice to cure the breach. If the breach is not cured within such period, the non-breaching Party may terminate this Agreement immediately upon written notice.</p>
<div class="article-sub">4.2 Termination for Insolvency.</div>
<p>Either Party may terminate this Agreement immediately upon written notice if the other Party: (i) becomes insolvent or makes a general assignment for the benefit of creditors; (ii) files a voluntary petition in bankruptcy; (iii) has an involuntary petition in bankruptcy filed against it that is not dismissed within sixty (60) days; (iv) has a receiver or trustee appointed for its property; (v) is dissolved or liquidated; or (vi) takes any corporate action for the purposes of any of the foregoing.</p>
<div class="article-sub">4.3 Termination Without Cause.</div>
<p>Either Party may terminate this Agreement without cause upon not less than (i) ${input.terminationNoticeDays} (${input.terminationNoticeDays}) days' written notice during the Initial Period, or (ii) sixty (60) days' written notice during any Renewal Term.</p>
<div class="article-sub">4.4 Obligations Upon Termination.</div>
<p>Upon termination of this Agreement, the Parties shall account to each other with respect to all uncompleted business, and the Agent shall: (a) deliver to the Client all books, records, rent rolls, lease files, and keys relating to the Property; (b) transfer all Client Account funds to an account designated by the Client; (c) provide written notice of termination to all tenants and vendors as directed by the Client; and (d) cooperate fully in transitioning management responsibilities to the Client or a successor manager.</p>
<div class="article-sub">4.5 Termination Fee.</div>
<p>In the event of early termination by the Client without cause during the Initial Period, the Client shall pay the Agent a termination fee equal to three (3) months' management fee at the then-current rate, as liquidated damages and not as a penalty. No termination fee shall apply if termination is for cause by the Client, or upon expiration of the Initial Period or any Renewal Term.</p>
</div>

<!-- ARTICLE V — COMPENSATION -->
<div class="article">
<div class="article-title">Article V — Compensation</div>
<div class="article-sub">5.1 Management Fee.</div>
<p>As consideration for the performance of the Services, the Client shall pay to the Agent a monthly management fee equal to the <strong>greater</strong> of the following two options, whichever produces the higher amount:</p>
<ul style="margin:8px 0 8px 24px;list-style:disc">
<li style="margin-bottom:6px"><strong>Option A — Fixed Monthly Fee:</strong> ${fee > 0 ? '<strong>$' + fee.toLocaleString() + '/month</strong>' : 'The Fixed Monthly Fee set forth in Schedule A'} ${perUnit > 0 ? '(<strong>$' + perUnit + '</strong>/unit × <strong>' + input.units + '</strong> units)' : ''}</li>
<li style="margin-bottom:6px"><strong>Option B — Percentage of Rent:</strong> <strong>Five percent (5%)</strong> of gross monthly rent collected from the Property during such month</li>
</ul>
<p>The management fee shall be deducted directly from the Client Account on the first business day of each month.</p>
<div class="article-sub">5.2 Accounting & Reporting Fee.</div>
<p>Baseline monthly accounting coordination and board-facing reporting are included in the selected management package. Tax returns, audits, historical cleanup, litigation support, agency proceedings, and special financial projects are separately scoped or billed under Schedule A.</p>
<ul style="margin:6px 0 8px 24px;list-style:disc">
<li style="margin-bottom:4px">Property or financial <strong>audits</strong> of the Property</li>
<li style="margin-bottom:4px">Tenant <strong>rent disputes</strong>, rent overcharge proceedings, or arrears litigation</li>
<li style="margin-bottom:4px">City agency proceedings involving <strong>rent treble charge</strong> calculations or DHCR overcharge investigations</li>
</ul>
<div class="article-sub">5.3 Technology Fee.</div>
<p>The selected Camelot Intelligence package includes the planned technology workflow in the management pricing shown in Schedule A. Third-party licensing, implementation, customization, resident portal modules, payment processor charges, and expanded automation beyond the agreed package are separately scoped or passed through at cost with board approval.</p>
<ul style="margin:6px 0 8px 24px;list-style:disc">
<li style="margin-bottom:4px"><strong>Merlin AI</strong> portfolio intelligence platform</li>
<li style="margin-bottom:4px"><strong>ConciergePlus</strong> resident portal (26 modules)</li>
<li style="margin-bottom:4px">Owner reporting dashboard</li>
<li style="margin-bottom:4px">Digital work order system</li>
<li style="margin-bottom:4px">Electronic rent collection infrastructure</li>
</ul>
${input.startupFee > 0 ? `<div class="article-sub">5.4 Startup/Onboarding Fee.</div>
<p>The Client shall pay a one-time onboarding fee of $${input.startupFee.toLocaleString()} upon execution of this Agreement, covering initial property audit, file migration, technology setup, vendor onboarding, and transition coordination.</p>` : ''}
<div class="article-sub">5.${input.startupFee > 0 ? '5' : '4'} Payment for Additional Services.</div>
<p>As consideration for Additional Services rendered, the Client shall pay the Agent the fees set forth in Schedule A (Ancillary Fee Schedule) and Article VII of this Agreement. All such fees shall become due and payable within five (5) business days of the Agent's invoice.</p>
<div class="article-sub">5.${input.startupFee > 0 ? '6' : '5'} Annual Fee Adjustment.</div>
<p>The management fee and all recurring monthly fees shall increase by ${input.annualIncrease} percent (${input.annualIncrease}%) per year, effective on each anniversary of the Effective Date.</p>
<div class="article-sub">5.${input.startupFee > 0 ? '7' : '6'} Interest on Late Payments.</div>
<p>Any invoice or fee that remains unpaid for more than thirty (30) days from the due date shall accrue interest at the rate of one and one-half percent (1.5%) per month (18% per annum), or the maximum rate permitted by law, whichever is less.</p>
</div>

<!-- ARTICLE VI — AGENT'S DUTIES -->
<div class="article">
<div class="article-title">Article VI — Agent's Duties (the "Services")</div>
<p>As consideration for the Compensation, during the Term the Agent shall perform the following Services:</p>
<div class="article-sub">6.1 Regular Repairs and Maintenance.</div>
<p>Agent shall cause the Property to be maintained in such condition as may be deemed advisable, including but not limited to arranging for routine repairs, preventive maintenance, cleaning, and upkeep of the building's common areas, mechanical systems, and exterior. Agent shall use commercially reasonable efforts to obtain competitive pricing from qualified vendors.</p>
<div class="article-sub">6.2 Inspection Visits.</div>
<p>Agent shall make regular visits to and inspections of the Property not less than bi-weekly, and shall provide the Client with written reports of any material conditions observed during such inspections. Agent shall maintain a log of all inspection visits.</p>
<div class="article-sub">6.3 Violations & Regulatory Compliance.</div>
<p>Agent shall monitor, recommend, and with the approval of the Client, cause all necessary acts and things to be done in order to comply with any statute, ordinance, law, order, rule, or regulation affecting the Property, including but not limited to: HPD registration and violation clearance; ${input.isRentStabilized ? 'DHCR rent-stabilization filings and annual registrations; ' : ''}DOB permit management; FDNY inspection coordination; ECB hearing representation; window guard compliance; lead paint disclosure and abatement notices; CO detector notices; Local Law 97 energy compliance monitoring; and any other applicable NYC administrative code requirements.</p>
<div class="article-sub">6.4 Utilities and Service Contracts.</div>
<p>Agent shall enter into, maintain, or renew contracts for electricity, gas, steam, fuel oil, water, telephone, internet, extermination, janitorial, elevator, boiler, and other services necessary for the operation of the Property, at prevailing market rates.</p>
<div class="article-sub">6.5 Rent Collection and Legal Proceedings.</div>
<p>Agent shall bill or cause to be billed all tenants for monthly rent and any additional charges. Agent shall pursue collection of all arrears through written notices, demand letters, and, with Client's authorization, the commencement of non-payment and holdover proceedings in Housing Court.</p>
${input.isRentStabilized ? `<div class="article-sub">6.6 Rent-Stabilization Compliance.</div>
<p>For rent-stabilized buildings, Agent shall: prepare and file annual DHCR Rent Registration statements; prepare and serve all required lease renewal notices (RTP-8) within required timeframes; process tenant lease renewals at the applicable DHCR guidelines rate; maintain complete rent history files for each unit; coordinate Major Capital Improvement (MCI) and Individual Apartment Improvement (IAI) applications as directed; and advise the Client on compliance with applicable rent-stabilization regulations.</p>` : ''}
<div class="article-sub">6.${input.isRentStabilized ? '7' : '6'} Reports and Financial Statements.</div>
<p>Agent shall, on a monthly basis, render a comprehensive operating report including: (a) income and expense statement; (b) bank reconciliation; (c) accounts payable/receivable aging report; (d) rent roll with arrears summary; (e) open violation report; and (f) any other reports reasonably requested by the Client. Annual reports shall include a year-end summary and budget variance analysis.</p>
<div class="article-sub">6.${input.isRentStabilized ? '8' : '7'} Insurance Administration.</div>
<p>Agent shall, at the Client's expense, procure and maintain in full force and effect on behalf of the Client: (a) commercial general liability insurance with limits of not less than $2,000,000 per occurrence and $5,000,000 aggregate; (b) property insurance covering the building for full replacement cost; (c) umbrella/excess liability insurance with limits of not less than $10,000,000; (d) workers' compensation and employer's liability insurance as required by New York law; (e) boiler and machinery coverage; and (f) such other insurance as the Client may reasonably require.</p>
<div class="article-sub">6.${input.isRentStabilized ? '9' : '8'} Emergency Contact.</div>
<p>Agent shall maintain a 24-hour, seven-day-a-week telephone emergency hotline for reporting of and prompt response to emergency conditions at the Property.</p>
<div class="article-sub">6.${input.isRentStabilized ? '10' : '9'} Capital Improvements.</div>
<p>Agent shall assist the Client in identifying, bidding, and supervising capital improvement projects at the Property. Agent shall obtain not less than three (3) competitive bids for any capital project exceeding $5,000 in cost. For projects totaling $25,000 or more, Agent shall be entitled to a construction supervision fee equal to ten percent (10%) of the total project cost. Construction oversight for projects under $25,000 is included in the base management fee.</p>

${input.assetClass === 'condo' ? `
<div class="article-sub">6.${input.isRentStabilized ? '11' : '10'} Board of Managers Support.</div>
<p>Agent shall attend and prepare agendas for all regular and special meetings of the Board of Managers, prepare and distribute meeting minutes, maintain the Condominium's corporate records, coordinate annual unit owner meetings, and assist in the preparation and distribution of the annual budget and common charge statements in compliance with RPL Article 9-B.</p>
<div class="article-sub">6.${input.isRentStabilized ? '12' : '11'} Common Charge Administration.</div>
<p>Agent shall calculate, bill, and collect monthly common charges from all unit owners. Agent shall maintain individual unit owner ledgers, pursue arrears through written notices and, with Board authorization, initiate lien filings per RPL §339-z. Agent shall prepare and distribute annual financial statements and operating budgets in compliance with the By-Laws and Condominium Act.</p>
<div class="article-sub">6.${input.isRentStabilized ? '13' : '12'} Alteration Agreement Administration.</div>
<p>Agent shall process all unit owner alteration applications, verify insurance requirements (including contractor general liability, workers' compensation, and excess coverage naming the Condominium as additional insured), coordinate Board review and approval, monitor construction progress, and ensure compliance with DOB permit requirements and the building's alteration policy.</p>
<div class="article-sub">6.${input.isRentStabilized ? '14' : '13'} Offering Plan & Regulatory Compliance.</div>
<p>Agent shall maintain awareness of the building's Offering Plan and any amendments, ensure compliance with the Martin Act and General Business Law Article 23-A, coordinate with the AG's office on required filings, and advise the Board on sponsor obligations, reserve fund requirements per RPL §339-mm, and common element maintenance responsibilities.</p>
<div class="article-sub">6.${input.isRentStabilized ? '15' : '14'} Resale & Transfer Processing.</div>
<p>Agent shall process unit resale applications, coordinate board waiver of right of first refusal (if applicable), prepare closing documentation, calculate and collect any transfer fees, and ensure compliance with the By-Laws and Offering Plan provisions governing unit transfers. Agent shall collect an application processing fee per Schedule A.</p>
` : ''}

${input.assetClass === 'coop' ? `
<div class="article-sub">6.${input.isRentStabilized ? '11' : '10'} Board of Directors Support.</div>
<p>Agent shall attend and prepare agendas for all regular and special meetings of the Board of Directors, prepare and distribute meeting minutes, maintain the Cooperative Corporation's corporate records, coordinate annual shareholder meetings, assist in proxy solicitation, and prepare and distribute the annual budget and maintenance schedule.</p>
<div class="article-sub">6.${input.isRentStabilized ? '12' : '11'} Maintenance Administration.</div>
<p>Agent shall calculate, bill, and collect monthly maintenance charges from all shareholders based on their share allocation. Agent shall maintain individual shareholder ledgers, pursue arrears through written notices and, with Board authorization, initiate holdover proceedings. Agent shall prepare and distribute annual financial statements, operating budgets, and Form 1098 statements to shareholders.</p>
<div class="article-sub">6.${input.isRentStabilized ? '13' : '12'} Stock Transfer & Proprietary Lease Administration.</div>
<p>Agent shall process all applications for the purchase, sale, or transfer of shares and proprietary leases, including: credit and background checks; financial statement review; board interview coordination; preparation of stock transfer documents; collection of flip tax; issuance of new share certificates; and execution of amended proprietary leases. Agent shall maintain the stock ledger and ensure compliance with the Certificate of Incorporation, By-Laws, and applicable securities exemptions.</p>
<div class="article-sub">6.${input.isRentStabilized ? '14' : '13'} Sublet & Alteration Administration.</div>
<p>Agent shall process all sublet applications in accordance with the Cooperative's Sublet Policy, including: applicant screening; collection of sublet fees (typically 20-30% of monthly maintenance as set by the Board); monitoring sublet duration limits; and ensuring compliance with the Proprietary Lease. Agent shall also process alteration applications, verify insurance requirements, and monitor construction per the building's alteration policy.</p>
<div class="article-sub">6.${input.isRentStabilized ? '15' : '14'} Recognition Agreement Processing.</div>
<p>Agent shall coordinate the preparation and execution of recognition agreements (Aztech forms or equivalent) for shareholder financing, liaise with lenders and their counsel, and collect the recognition agreement processing fee per Schedule A.</p>
<div class="article-sub">6.${input.isRentStabilized ? '16' : '15'} Underlying Mortgage & Tax Coordination.</div>
<p>Agent shall monitor the Cooperative Corporation's underlying mortgage obligations, coordinate refinancing as directed by the Board, prepare RPIE filings, monitor real estate tax assessments, and advise the Board on J-51 or other applicable tax abatement programs. Agent shall also coordinate tax certiorari proceedings as authorized by the Board.</p>
` : ''}

${input.assetClass === 'office' ? `
<div class="article-sub">6.${input.isRentStabilized ? '11' : '10'} Commercial Lease Administration.</div>
<p>Agent shall administer all commercial lease agreements, including: rent billing and collection; CAM charge calculation and reconciliation; operating expense pass-through computation; lease escalation tracking; tenant improvement coordination; and compliance with lease covenants. Agent shall maintain a lease abstract for each tenant and provide the Client with quarterly lease expiration reports.</p>
<div class="article-sub">6.${input.isRentStabilized ? '12' : '11'} CAM Charge Administration.</div>
<p>Agent shall calculate each tenant's proportionate share of Common Area Maintenance charges, prepare and distribute annual CAM estimates and year-end reconciliations, maintain supporting documentation, and handle tenant disputes regarding CAM allocations in compliance with applicable lease provisions.</p>
<div class="article-sub">6.${input.isRentStabilized ? '13' : '12'} Tenant Improvement Coordination.</div>
<p>Agent shall coordinate tenant improvement (TI) build-outs, including: contractor selection and oversight; TI allowance tracking and disbursement; DOB permit coordination; certificate of occupancy verification; and punch list management. TI coordination fees are set forth in Schedule A.</p>
<div class="article-sub">6.${input.isRentStabilized ? '14' : '13'} Commercial Insurance & Compliance.</div>
<p>Agent shall procure and maintain commercial property insurance, commercial general liability, umbrella, terrorism (TRIA), and environmental liability coverage as appropriate. Agent shall ensure compliance with all commercial building codes, fire safety regulations, ADA accessibility requirements, commercial Certificate of Occupancy, and Local Laws including LL11/FISP, LL26 (elevator), LL152 (gas piping), and LL97 (carbon emissions) as applicable to commercial buildings.</p>
<div class="article-sub">6.${input.isRentStabilized ? '15' : '14'} Retail & Office Leasing Support.</div>
<p>Agent shall support the Client's leasing efforts by: preparing vacant space for showing; coordinating with leasing brokers; reviewing prospective tenant financials; negotiating lease terms as authorized; and managing the lease execution process. Leasing commissions are set forth in Schedule A.</p>
` : ''}

${input.assetClass === 'single-tenant' ? `
<div class="article-sub">6.${input.isRentStabilized ? '11' : '10'} Tenant Placement.</div>
<p>Agent shall market the Unit for rent, screen prospective tenants (including credit, background, income, and reference verification), prepare lease agreements, coordinate move-in inspections, and collect first month's rent and security deposit. Tenant placement fees are set forth in Schedule A.</p>
<div class="article-sub">6.${input.isRentStabilized ? '12' : '11'} Lease Administration.</div>
<p>Agent shall administer the lease agreement, handle tenant communications, process maintenance requests, coordinate repairs and maintenance through vetted vendors, and ensure compliance with NYC housing code requirements including lead paint disclosure (Local Law 1), window guard regulations, and heat/hot water requirements.</p>
<div class="article-sub">6.${input.isRentStabilized ? '13' : '12'} Financial Management.</div>
<p>Agent shall collect monthly rent, pursue arrears, manage security deposit in compliance with NYS Real Property Law §7-103, pay approved expenses from the Client Account, and provide monthly financial statements including income/expense reports and bank reconciliations.</p>
<div class="article-sub">6.${input.isRentStabilized ? '14' : '13'} Vacancy Management.</div>
<p>Agent shall manage unit turnover, including: move-out inspection; security deposit reconciliation within 14 days per NYS law; unit preparation for re-rental; and marketing for new tenants. During vacancy, Agent shall conduct regular property checks and maintain the Unit in showing condition.</p>
` : ''}
</div>

<!-- ARTICLES VII-XVII (condensed for all asset classes) -->
<div class="article">
<div class="article-title">Article VII — Additional Services</div>
<p>The following Additional Services are outside the scope of the base Services and shall be billed separately pursuant to Schedule A: Lease Services (exclusive leasing for vacant units), Transfer Services (assignment/transfer processing), Financing Services (mortgage creation at 1% of loan amount, refinancing at 1% of amount refinanced), Hearing Services ($150/hour for non-routine proceedings), Audit Services ($150/hour), Pre-Occupation Services ($150/hour for unit preparation), and Emergency Services ($200/hour for after-hours Agent personnel).</p>
</div>

<div class="article">
<div class="article-title">Article VIII — Additional Fees</div>
<p>Application review fees shall be collected from applicants per applicable law. Regulatory filing fees (1098/1099, RPIE, DHCR registration) shall be billed per Schedule A. Payroll service fees shall be paid from Client Accounts. All brokerage commissions shall be payable to ${CAMELOT.name}.</p>
</div>

<div class="article">
<div class="article-title">Article IX — Protection of the Property Management Company</div>
<p>Agent shall hire, pay, and supervise all Employees. The Client shall not directly hire, terminate, or supervise building Employees or contract with vendors for covered services without the Agent's prior written consent. The Agent shall be entitled to rely upon all information provided by the Client.</p>
</div>

<div class="article">
<div class="article-title">Article X — Indemnification</div>
<p>Client will indemnify the Agent against any liability, damages, costs, or claims arising out of the condition of the Property, acts of the Client or Employees, or third-party claims (other than those arising from the Agent's gross negligence or willful misconduct). The Agent shall indemnify the Client from claims arising from the Agent's gross negligence or willful misconduct.</p>
</div>

<div class="article">
<div class="article-title">Article XI — Authority</div>
<p>Client authorizes the Agent to perform any act reasonably necessary to carry out the Services. Any single expenditure in excess of $2,500 shall require Client's prior written approval, except for Emergency Services or recurring approved expenses.</p>
</div>

<div class="article">
<div class="article-title">Article XII — Bank Accounts</div>
<p>Agent shall establish and maintain separate Client Accounts at an FDIC-insured bank. Transfers exceeding $10,000 require Client approval (except approved recurring expenses and Agent compensation). Agent shall maintain a separate security deposit escrow account per New York State Real Property Law §7-103.</p>
</div>

<div class="article">
<div class="article-title">Articles XIII–XVII</div>
<p><strong>XIII. Licenses:</strong> Agent is duly licensed by the New York State Department of State as a real estate broker and holds all required licenses.</p>
<p><strong>XIV. Miscellaneous:</strong> All notices shall be in writing via certified mail or overnight courier. If any provision is held invalid, remaining provisions continue in full force.</p>
<p><strong>XV. Governing Law:</strong> This Agreement shall be governed by the laws of the State of New York. Venue: New York County.</p>
<p><strong>XVI. Entire Agreement:</strong> This Agreement and all Schedules constitute the entire agreement and supersede all prior understandings.</p>
<p><strong>XVII. Independent Contractor:</strong> The Agent is an independent contractor, not an employee, partner, or joint venturer of the Client.</p>
</div>

${input.specialTerms ? `
<div class="article">
<div class="article-title">Special Terms & Conditions</div>
<p>${input.specialTerms.replace(/\n/g, '</p><p>')}</p>
</div>` : ''}

<!-- SIGNATURE PAGE -->
<div class="article" style="page-break-before:always">
<div class="article-title">Execution</div>
<p>IN WITNESS WHEREOF, the Parties hereto have executed this Agreement as of the day and year first written above.</p>

<div class="sig-grid">
<div class="sig-box">
<p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:700;margin-bottom:12px">CLIENT (OWNER)</p>
<div style="margin-bottom:10px">
<label style="font-size:9px;color:#888;display:block;margin-bottom:2px">Organization / Entity Name:</label>
<input type="text" value="${input.clientEntityName || input.clientName || ''}" style="width:100%;border:none;border-bottom:1.5px solid #3A4B5B;padding:6px 2px;font-size:12px;font-family:'DM Sans',sans-serif;color:#2C3240;background:transparent;outline:none" placeholder="Entity name">
</div>
<div style="margin-bottom:10px">
<label style="font-size:9px;color:#888;display:block;margin-bottom:2px">Signature:</label>
<div style="border-bottom:1.5px solid #3A4B5B;height:40px"></div>
</div>
<div style="margin-bottom:10px">
<label style="font-size:9px;color:#888;display:block;margin-bottom:2px">Print Name:</label>
<input type="text" value="${input.clientName || ''}" style="width:100%;border:none;border-bottom:1.5px solid #3A4B5B;padding:6px 2px;font-size:12px;font-family:'DM Sans',sans-serif;color:#2C3240;background:transparent;outline:none" placeholder="Full name">
</div>
<div style="margin-bottom:10px">
<label style="font-size:9px;color:#888;display:block;margin-bottom:2px">Title:</label>
<input type="text" style="width:100%;border:none;border-bottom:1.5px solid #3A4B5B;padding:6px 2px;font-size:12px;font-family:'DM Sans',sans-serif;color:#2C3240;background:transparent;outline:none" placeholder="Title / Position">
</div>
<div>
<label style="font-size:9px;color:#888;display:block;margin-bottom:2px">Date:</label>
<input type="date" style="width:100%;border:none;border-bottom:1.5px solid #3A4B5B;padding:6px 2px;font-size:12px;font-family:'DM Sans',sans-serif;color:#2C3240;background:transparent;outline:none">
</div>
</div>

<div class="sig-box">
<p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#A89035;font-weight:700;margin-bottom:12px">AGENT</p>
<div style="margin-bottom:10px">
<label style="font-size:9px;color:#888;display:block;margin-bottom:2px">Organization:</label>
<input type="text" value="${CAMELOT.name}" style="width:100%;border:none;border-bottom:1.5px solid #3A4B5B;padding:6px 2px;font-size:12px;font-family:'DM Sans',sans-serif;color:#2C3240;background:transparent;outline:none" readonly>
</div>
<div style="margin-bottom:10px">
<label style="font-size:9px;color:#888;display:block;margin-bottom:2px">Signature:</label>
<div style="border-bottom:1.5px solid #3A4B5B;height:40px"></div>
</div>
<div style="margin-bottom:10px">
<label style="font-size:9px;color:#888;display:block;margin-bottom:2px">Print Name:</label>
<input type="text" value="${CAMELOT.principal}" style="width:100%;border:none;border-bottom:1.5px solid #3A4B5B;padding:6px 2px;font-size:12px;font-family:'DM Sans',sans-serif;color:#2C3240;background:transparent;outline:none" readonly>
</div>
<div style="margin-bottom:10px">
<label style="font-size:9px;color:#888;display:block;margin-bottom:2px">Title:</label>
<input type="text" value="${CAMELOT.title}" style="width:100%;border:none;border-bottom:1.5px solid #3A4B5B;padding:6px 2px;font-size:12px;font-family:'DM Sans',sans-serif;color:#2C3240;background:transparent;outline:none" readonly>
</div>
<div>
<label style="font-size:9px;color:#888;display:block;margin-bottom:2px">Date:</label>
<input type="date" style="width:100%;border:none;border-bottom:1.5px solid #3A4B5B;padding:6px 2px;font-size:12px;font-family:'DM Sans',sans-serif;color:#2C3240;background:transparent;outline:none">
</div>
</div>
</div>

<div style="margin-top:20px;background:#EDE9DF;border-radius:6px;padding:12px 16px;text-align:center;font-size:11px;color:#555">
<strong>Digital Signature Option:</strong> This agreement can be executed electronically via DocuSign. Upon generation, a copy will be sent to <strong>info@camelot.nyc</strong> for processing. To request a DocuSign link, contact Camelot at ${CAMELOT.phone}.
</div>
</div>

<!-- SCHEDULE A -->
<div class="article" style="page-break-before:always">
<div class="article-title">Schedule A — Ancillary Fee Schedule (${tierLabel})</div>
<p style="font-size:11px;color:#555;margin-bottom:12px">These fees are charged on an as-needed basis in addition to the monthly management, accounting, and technology fees. All fees subject to annual ${input.annualIncrease}% adjustment.</p>

<table class="schedule">
<thead><tr><th colspan="3">Base Monthly Fees</th></tr></thead>
<tbody>
<tr><td><strong>Management Fee</strong></td><td><strong>$${fee.toLocaleString()}/month</strong> ($${perUnit}/unit × ${input.units} units)</td><td>Greater of fixed fee or 5% of gross rent</td></tr>
<tr><td>Accounting & Reporting</td><td>Included in selected package</td><td>Tax returns, audits, cleanup, litigation, and special projects separately scoped</td></tr>
<tr><td>Technology Platform</td><td>Included in Intelligence pricing</td><td>Third-party licensing, customization, and expanded workflows by board approval</td></tr>
${input.startupFee > 0 ? `<tr><td>Onboarding Fee</td><td><strong>$${input.startupFee.toLocaleString()}</strong></td><td>One-time startup/transition</td></tr>` : ''}
</tbody>
</table>

<table class="schedule">
<thead><tr><th colspan="3">Regulatory Filings</th></tr></thead>
<tbody>
${input.isRentStabilized ? '<tr><td>DHCR Annual Rent Registration</td><td>$50/unit</td><td>Per filing year</td></tr>' : ''}
<tr><td>RPIE / RPIE-Exception Filing</td><td>$400 flat</td><td>Real Property Income & Expense</td></tr>
<tr><td>1098 / 1099 Tax Forms</td><td>$25/form</td><td>Per form processed</td></tr>
<tr><td>Client Account Establishment</td><td>$250/account</td><td>One-time per account</td></tr>
<tr><td>HPD Registration (Annual)</td><td class="included">Included</td><td>In base management fee</td></tr>
</tbody>
</table>

<table class="schedule">
<thead><tr><th colspan="3">Tenant Administration</th></tr></thead>
<tbody>
<tr><td>Lease Application Processing</td><td>$200/application</td><td>Background, credit, verification</td></tr>
<tr><td>Move-In Administration</td><td>$150/unit</td><td>Inspection, key coordination</td></tr>
<tr><td>Move-Out Administration</td><td>$150/unit</td><td>Inspection, deposit reconciliation</td></tr>
<tr><td>Lease Renewal Processing</td><td>$350/unit</td><td>${input.isRentStabilized ? 'DHCR renewal prep, RTP-8 service' : 'Renewal prep and execution'}</td></tr>
<tr><td>Sub-Lease / Assignment Review</td><td>$500/transaction</td><td>Application and approval coordination</td></tr>
</tbody>
</table>

<table class="schedule">
<thead><tr><th colspan="3">Violations & Legal</th></tr></thead>
<tbody>
<tr><td>Violation Research & Filing</td><td>$95/violation</td><td>HPD, DOB, ECB</td></tr>
<tr><td>Housing Court Preparation</td><td>$150/proceeding</td><td>Non-payment / holdover coordination</td></tr>
<tr><td>Administrative Hearing</td><td>$150/hour</td><td>ECB, DHCR, etc.</td></tr>
</tbody>
</table>

<table class="schedule">
<thead><tr><th colspan="3">Construction & Capital</th></tr></thead>
<tbody>
<tr><td>Construction Supervision</td><td>10% of project cost</td><td>Projects $25,000+; under $25K included</td></tr>
<tr><td>Pre-Occupation Services</td><td>$150/hour</td><td>Unit prep prior to new tenancy</td></tr>
</tbody>
</table>

<table class="schedule">
<thead><tr><th colspan="3">Financing & Insurance</th></tr></thead>
<tbody>
<tr><td>Mortgage Creation Fee</td><td>1% of loan amount</td><td>At closing</td></tr>
<tr><td>Refinancing Fee</td><td>1% of amount refinanced</td><td>Or 1% of total new loan</td></tr>
<tr><td>Lender Coordination</td><td>$150–$200/hour</td><td>Separate from creation/refi fee</td></tr>
<tr><td>Insurance Administration</td><td>$450/year</td><td>Professional liability cost-share</td></tr>
</tbody>
</table>

<table class="schedule">
<thead><tr><th colspan="3">Technology & Emergency</th></tr></thead>
<tbody>
<tr><td>Merlin AI Analytics</td><td class="included">Included in Tech Fee</td><td>FREE first 6 months</td></tr>
<tr><td>ConciergePlus Portal</td><td class="included">Included</td><td>Resident portal</td></tr>
<tr><td>Energy Benchmarking (LL84/97)</td><td>$250/year</td><td>Annual filing</td></tr>
<tr><td>Emergency Personnel</td><td>$200/hour</td><td>After-hours Agent staff</td></tr>
<tr><td>Emergency Contractor</td><td>At cost + 15%</td><td>Coordination fee</td></tr>
</tbody>
</table>

${input.assetClass === 'condo' ? `
<table class="schedule">
<thead><tr><th colspan="3">Condominium-Specific Services</th></tr></thead>
<tbody>
<tr><td>Unit Resale Application Processing</td><td>$500/application</td><td>Credit check, board review, closing coordination</td></tr>
<tr><td>Alteration Application Processing</td><td>$500/application</td><td>Insurance review, board approval, DOB coordination</td></tr>
<tr><td>Estoppel Certificate</td><td>$250/certificate</td><td>Financial status letter for unit sales</td></tr>
<tr><td>Annual Budget Preparation</td><td class="included">Included</td><td>Budget draft and board presentation</td></tr>
<tr><td>Reserve Fund Study Coordination</td><td>$1,500 flat</td><td>Engineer engagement and report review</td></tr>
<tr><td>Offering Plan Amendment Coordination</td><td>$150/hour</td><td>Attorney coordination for plan amendments</td></tr>
</tbody>
</table>` : ''}

${input.assetClass === 'coop' ? `
<table class="schedule">
<thead><tr><th colspan="3">Cooperative-Specific Services</th></tr></thead>
<tbody>
<tr><td>Share Transfer / Sale Application</td><td>$500/application</td><td>Credit check, financials, board interview, stock transfer</td></tr>
<tr><td>Sublet Application Processing</td><td>$350/application</td><td>Screening, board review, sublet agreement</td></tr>
<tr><td>Recognition Agreement (Aztech)</td><td>$300/agreement</td><td>Lender coordination and execution</td></tr>
<tr><td>Flip Tax Administration</td><td class="included">Included</td><td>Calculation and collection at closing</td></tr>
<tr><td>Stock Certificate Issuance</td><td>$200/certificate</td><td>New certificate preparation and ledger update</td></tr>
<tr><td>Proprietary Lease Amendment</td><td>$150/hour</td><td>Attorney coordination</td></tr>
<tr><td>Annual Shareholder Meeting</td><td class="included">Included</td><td>Preparation, proxy solicitation, attendance</td></tr>
<tr><td>J-51 / Tax Abatement Administration</td><td>$500/filing</td><td>Application and annual compliance</td></tr>
<tr><td>Underlying Mortgage Refinancing</td><td>Negotiated</td><td>Board coordination, lender engagement</td></tr>
</tbody>
</table>` : ''}

${input.assetClass === 'office' ? `
<table class="schedule">
<thead><tr><th colspan="3">Commercial / Office-Specific Services</th></tr></thead>
<tbody>
<tr><td>Commercial Lease Negotiation</td><td>$250/hour</td><td>Term sheet, LOI, lease review with counsel</td></tr>
<tr><td>Leasing Commission (New Tenant)</td><td>Per lease terms</td><td>Typically 4-6% of aggregate rent</td></tr>
<tr><td>Leasing Commission (Renewal)</td><td>Per lease terms</td><td>Typically 2-3% of aggregate rent</td></tr>
<tr><td>CAM Reconciliation</td><td class="included">Included</td><td>Annual calculation and tenant notification</td></tr>
<tr><td>Tenant Improvement Coordination</td><td>5% of TI cost</td><td>Build-out oversight, contractor management</td></tr>
<tr><td>Environmental Compliance</td><td>$150/hour</td><td>Phase I coordination, remediation oversight</td></tr>
<tr><td>ADA Compliance Review</td><td>$150/hour</td><td>Assessment and remediation coordination</td></tr>
<tr><td>Commercial Insurance Administration</td><td>$750/year</td><td>Coverage review, broker coordination, claims</td></tr>
</tbody>
</table>` : ''}

${input.assetClass === 'single-tenant' ? `
<table class="schedule">
<thead><tr><th colspan="3">Individual Unit-Specific Services</th></tr></thead>
<tbody>
<tr><td>Tenant Placement Fee</td><td>1 month's rent</td><td>Marketing, screening, lease execution</td></tr>
<tr><td>Lease Renewal</td><td>$200/renewal</td><td>Market analysis, negotiation, execution</td></tr>
<tr><td>Vacancy Preparation</td><td>At cost + 15%</td><td>Cleaning, painting, minor repairs</td></tr>
<tr><td>Eviction Coordination</td><td>$350/proceeding</td><td>Notice service, attorney coordination, court</td></tr>
<tr><td>Property Inspection</td><td class="included">Included</td><td>Monthly drive-by + quarterly interior</td></tr>
<tr><td>Year-End Tax Package</td><td>$150/year</td><td>Income/expense statement for tax filing</td></tr>
</tbody>
</table>` : ''}

<p style="font-size:10px;color:#888;margin-top:12px;text-align:center">All fees subject to annual adjustment of ${input.annualIncrease}% per year on each anniversary of the Effective Date.</p>
</div>

<div class="footer">
${CAMELOT.shortName} · ${CAMELOT.address}<br>
Confidential · © ${year} · All Rights Reserved<br>
<span style="font-size:7px;color:#bbb">${version} · Generated ${timestamp.split('T')[0]} · Created by Excalibur AI · Camelot OS</span>
</div>

</div>
</body>
</html>`;
}

// ============================================================
// Asset-Class Specific: CONDOMINIUM
// ============================================================

export function generateCondoAgreement(input: AgreementInput): string {
  // Use rental as base, override key sections for condo
  const modified = { ...input, assetClass: 'condo' as AssetClass };
  // The rental generator handles the full structure; for condo we modify specific articles
  // Key condo differences are handled via the assetClass flag in the shared template
  return generateRentalAgreement(modified);
}

// ============================================================
// Asset-Class Specific: CO-OP
// ============================================================

export function generateCoopAgreement(input: AgreementInput): string {
  const modified = { ...input, assetClass: 'coop' as AssetClass };
  return generateRentalAgreement(modified);
}

// ============================================================
// Asset-Class Specific: OFFICE
// ============================================================

export function generateOfficeAgreement(input: AgreementInput): string {
  const modified = { ...input, assetClass: 'office' as AssetClass };
  return generateRentalAgreement(modified);
}

// ============================================================
// Asset-Class Specific: RETAIL
// ============================================================

export function generateRetailAgreement(input: AgreementInput): string {
  const modified = { ...input, assetClass: 'office' as AssetClass }; // retail uses office base
  return generateRentalAgreement(modified);
}

// ============================================================
// Asset-Class Specific: INDIVIDUAL UNIT
// ============================================================

export function generateSingleUnitAgreement(input: AgreementInput): string {
  const modified = { ...input, assetClass: 'single-tenant' as AssetClass };
  return generateRentalAgreement(modified);
}

// ============================================================
// Export: Generate agreement by asset class
// ============================================================

export function generateAgreement(input: AgreementInput): string {
  switch (input.assetClass) {
    // Rental (and individual-unit rentals) use the new generator that
    // mirrors the Word master template exactly — the Camelot Rental
    // Management Agreement house design. See src/lib/rental-agreement-v3.ts.
    case 'rental': return generateRentalAgreementV3(input);
    case 'single-tenant': return generateRentalAgreementV3(input);
    case 'condo': return generateCondoAgreement(input);
    case 'coop': return generateCoopAgreement(input);
    case 'new-construction': return generateCondoAgreement(input); // new construction uses condo base
    case 'office': return generateOfficeAgreement(input);
    case 'retail': return generateRetailAgreement(input);
    default: return generateRentalAgreementV3(input);
  }
}

