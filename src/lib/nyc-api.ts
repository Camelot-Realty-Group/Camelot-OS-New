/**
 * NYC Open Data API Integration
 * All endpoints are free and require no API key.
 */

import type { HPDViolation, DOFProperty, DOBPermit, LL97Energy, ACRISRecord, ACRISParty, ACRISData } from '@/types';
import { detectBuildingOperations } from '@/lib/building-ops';
import { lookupSpireManagedBuilding } from '@/lib/spire';
import {
  fetchECBViolations, fetchHousingLitigation, fetchRentStabilization,
  totalECBPenaltyBalance, hasActiveLitigation, isRentStabilized,
  type ECBViolation, type HousingLitigation, type RentStabilization,
} from '@/lib/gov-apis';

const NYC_BASE = 'https://data.cityofnewyork.us/resource';

// Endpoints
const ENDPOINTS = {
  hpdViolations: `${NYC_BASE}/wvxf-dwi5.json`,
  hpdRegistration: `${NYC_BASE}/tesw-yqqr.json`,
  hpdRegistrationContacts: `${NYC_BASE}/feu5-w2e2.json`,
  dobPermits: `${NYC_BASE}/ic3t-wcy2.json`,
  dofProperty: `${NYC_BASE}/64uk-42ks.json`,
  ll97Energy: `${NYC_BASE}/7x5e-2fxh.json`,
  acrisLegals: `${NYC_BASE}/8h5j-fqxa.json`,
  acrisMaster: `${NYC_BASE}/bnx9-e6tj.json`,
  acrisParties: `${NYC_BASE}/636b-3b5g.json`,
  facadeFilings: `${NYC_BASE}/xubg-57si.json`,
};

function socrataUrl(endpoint: string, params: Record<string, string | number>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }
  return `${endpoint}?${search.toString()}`;
}

function escapeSoql(value: string): string {
  return value.replace(/'/g, "''");
}

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 9000): Promise<T> {
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

function isHPDViolationOpen(v: HPDViolation): boolean {
  const status = `${v.violationstatus || ''} ${v.currentstatus || ''}`.toUpperCase();
  return !/\bCLOSE\b|DISMISSED|COMPLIED|RESCINDED|CANCELLED/.test(status);
}

// Borough name → code mapping for NYC APIs
const BOROUGH_CODES: Record<string, string> = {
  manhattan: '1',
  bronx: '2',
  brooklyn: '3',
  queens: '4',
  'staten island': '5',
};

// PLUTO/DOF borough abbreviations (different from HPD numeric codes)
const PLUTO_BOROUGH_CODES: Record<string, string> = {
  manhattan: 'MN',
  bronx: 'BX',
  brooklyn: 'BK',
  queens: 'QN',
  'staten island': 'SI',
  mn: 'MN',
  bx: 'BX',
  bk: 'BK',
  qn: 'QN',
  si: 'SI',
  '1': 'MN',
  '2': 'BX',
  '3': 'BK',
  '4': 'QN',
  '5': 'SI',
};

// ---- Named-number avenue mapping ----
const NAMED_AVENUE_MAP: Record<string, string> = {
  FIRST: '1',
  SECOND: '2',
  THIRD: '3',
  FOURTH: '4',
  FIFTH: '5',
  SIXTH: '6',
  SEVENTH: '7',
  EIGHTH: '8',
  NINTH: '9',
  TENTH: '10',
  ELEVENTH: '11',
  TWELFTH: '12',
};

/**
 * Strip ordinal suffixes: "79TH" → "79", "1ST" → "1", "2ND" → "2", "3RD" → "3", "21ST" → "21"
 */
function stripOrdinal(word: string): string {
  return word.replace(/(\d+)\s*(ST|ND|RD|TH)\b/gi, '$1');
}

/**
 * Normalize an address for API queries.
 *
 * NYC Open Data stores addresses in various formats:
 *   HPD:  "EAST  79 STREET" (no ordinal, sometimes double-spaces)
 *   DOF:  "301 EAST 79 STREET" or composite address field
 *   DOB:  "EAST 79 STREET" in street_name, house number separate
 *
 * This function produces a normalized form suitable for building
 * flexible LIKE queries rather than exact matches.
 */
function normalizeAddress(address: string): string {
  let norm = address.toUpperCase().trim();

  // Keep the street address only. User-entered addresses often arrive as
  // "1280 Fifth Avenue, New York, NY"; if the city remains in the street
  // token, HPD/DOB/DOF queries return empty.
  norm = norm.split(',')[0].trim();

  // Expand common abbreviations
  norm = norm.replace(/\bAVE\b/g, 'AVENUE');
  norm = norm.replace(/\bST\b/g, 'STREET');
  norm = norm.replace(/\bBLVD\b/g, 'BOULEVARD');
  norm = norm.replace(/\bPL\b/g, 'PLACE');
  norm = norm.replace(/\bDR\b/g, 'DRIVE');
  norm = norm.replace(/\bRD\b/g, 'ROAD');
  norm = norm.replace(/\bCT\b/g, 'COURT');
  norm = norm.replace(/\bLN\b/g, 'LANE');

  // Convert named avenues: "FIFTH AVENUE" → "5 AVENUE"
  for (const [word, num] of Object.entries(NAMED_AVENUE_MAP)) {
    norm = norm.replace(new RegExp(`\\b${word}\\s+(AVENUE|AVE)\\b`, 'g'), `${num} AVENUE`);
  }

  // Strip ordinal suffixes: "79TH" → "79", "1ST" → "1" etc.
  norm = stripOrdinal(norm);

  // Strip city/state/zip suffixes that users commonly append without commas.
  norm = norm.replace(/\s+\d{5}(-\d{4})?\s*$/g, '');
  for (let i = 0; i < 3; i += 1) {
    norm = norm.replace(/\s+(NEW YORK CITY|NEW YORK|NYC|NY|MANHATTAN|BROOKLYN|QUEENS|BRONX|STATEN ISLAND)\s*$/g, '');
  }

  // Remove street type suffixes — we'll search without them for broader matching
  // Keep them in the normalized form but they'll be stripped when building search keys
  // Collapse multiple spaces
  norm = norm.replace(/\s{2,}/g, ' ').trim();

  return norm;
}

/**
 * Parse an address into number and street components.
 * The street portion has ordinals stripped and named avenues converted.
 */
function parseAddress(address: string): { number: string; street: string } {
  const normalized = normalizeAddress(address);
  const match = normalized.match(/^(\d+[-\d]*)\s+(.+?)(?:\s*,.*)?$/);
  if (match) {
    return { number: match[1], street: match[2] };
  }
  return { number: '', street: normalized };
}

/**
 * Build the key search tokens from a street name for LIKE queries.
 * Strips street-type suffixes (STREET, AVENUE, etc.) and returns
 * the essential words that NYC databases are most likely to contain.
 *
 * "EAST 79 STREET" → ["EAST", "79"]
 * "5 AVENUE"       → ["5", "AVENUE"]   (keep AVENUE for numbered avenues)
 * "PARK AVENUE"    → ["PARK", "AVENUE"]
 */
function streetSearchTokens(street: string): string[] {
  const STREET_SUFFIXES = ['STREET', 'BOULEVARD', 'PLACE', 'DRIVE', 'ROAD', 'COURT', 'LANE', 'TERRACE', 'WAY'];
  const words = street.split(/\s+/).filter(Boolean);

  // For numbered avenues like "5 AVENUE", keep AVENUE since it's meaningful
  // For directional + number + STREET patterns, drop STREET
  const isNumberedAvenue = words.length === 2 && /^\d+$/.test(words[0]) && words[1] === 'AVENUE';
  if (isNumberedAvenue) return words;

  // Drop trailing street-type suffix
  const filtered = words.filter((w) => !STREET_SUFFIXES.includes(w));
  return filtered.length > 0 ? filtered : words;
}

/**
 * Build a flexible LIKE pattern from tokens for Socrata $where queries.
 * Joins tokens with '%' wildcards so "EAST 79" becomes "%EAST%79%".
 * This handles double spaces and varied formatting in NYC data.
 */
function buildLikePattern(tokens: string[]): string {
  return '%' + tokens.join('%') + '%';
}

export async function fetchHPDViolationsByBBL(bbl: string): Promise<HPDViolation[]> {
  const clean = bbl.replace(/\D/g, '').slice(0, 10);
  if (clean.length !== 10) return [];
  try {
    const url = socrataUrl(ENDPOINTS.hpdViolations, {
      $limit: 500,
      $order: 'inspectiondate DESC',
      $where: `bbl='${clean}'`,
    });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HPD BBL API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('HPD Violations by BBL fetch error:', err);
    return [];
  }
}

/**
 * Fetch HPD Violations for an address.
 * Uses flexible LIKE matching to handle HPD's formatting (double spaces, no ordinals).
 */
export async function fetchHPDViolations(address: string, borough?: string): Promise<HPDViolation[]> {
  try {
    const { number, street } = parseAddress(address);
    const tokens = streetSearchTokens(street);
    const pattern = buildLikePattern(tokens);

    let where = `upper(streetname) like '${escapeSoql(pattern)}'`;
    if (number) {
      where += ` AND housenumber='${escapeSoql(number)}'`;
    }
    if (borough) {
      const code = BOROUGH_CODES[borough.toLowerCase()];
      if (code) where += ` AND boroid='${code}'`;
    }

    let url = socrataUrl(ENDPOINTS.hpdViolations, {
      $limit: 500,
      $order: 'inspectiondate DESC',
      $where: where,
    });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HPD API error: ${res.status}`);
    const results: HPDViolation[] = await res.json();

    // Fallback: if no results and we have a number, try broader match with just the number
    if (results.length === 0 && number && tokens.length > 1) {
      const fallbackWhere = `housenumber='${escapeSoql(number)}' AND upper(streetname) like '%${escapeSoql(tokens[tokens.length - 1])}%'`;
      const fallbackUrl = socrataUrl(ENDPOINTS.hpdViolations, {
        $limit: 500,
        $order: 'inspectiondate DESC',
        $where: fallbackWhere,
      });
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) return await fallbackRes.json();
    }

    return results;
  } catch (err) {
    console.error('HPD Violations fetch error:', err);
    return [];
  }
}

/**
 * Batch-fetch HPD violation counts (total + open) for many BBLs at once.
 * Uses SoQL group-by so a 100-building region scan costs ~6 requests
 * instead of 200. Returns a map of bbl -> {total, open}; BBLs with no
 * violations are simply absent (treat as zero).
 */
export async function fetchViolationCountsByBBLs(
  bbls: string[],
): Promise<Record<string, { total: number; open: number }>> {
  const counts: Record<string, { total: number; open: number }> = {};
  const clean = Array.from(new Set(
    bbls.map((b) => String(b || '').replace(/\D/g, '').slice(0, 10)).filter((b) => b.length === 10)
  ));
  const CHUNK = 40;
  for (let i = 0; i < clean.length; i += CHUNK) {
    const chunk = clean.slice(i, i + CHUNK);
    const inList = chunk.map((b) => `'${b}'`).join(',');
    try {
      const [totalRes, openRes] = await Promise.all([
        fetch(socrataUrl(ENDPOINTS.hpdViolations, {
          $select: 'bbl,count(violationid) AS n',
          $where: `bbl in(${inList})`,
          $group: 'bbl',
          $limit: CHUNK,
        })),
        fetch(socrataUrl(ENDPOINTS.hpdViolations, {
          $select: 'bbl,count(violationid) AS n',
          $where: `bbl in(${inList}) AND violationstatus='Open'`,
          $group: 'bbl',
          $limit: CHUNK,
        })),
      ]);
      if (totalRes.ok) {
        for (const row of await totalRes.json()) {
          counts[row.bbl] = { total: parseInt(row.n) || 0, open: 0 };
        }
      }
      if (openRes.ok) {
        for (const row of await openRes.json()) {
          if (!counts[row.bbl]) counts[row.bbl] = { total: parseInt(row.n) || 0, open: 0 };
          counts[row.bbl].open = parseInt(row.n) || 0;
        }
      }
    } catch (err) {
      console.error('Batch violation counts error (chunk skipped):', err);
    }
  }
  return counts;
}

/**
 * Fetch HPD Building Registration (owner, management company)
 */
export async function fetchHPDRegistration(address: string, borough?: string): Promise<any[]> {
  try {
    const { number, street } = parseAddress(address);
    const tokens = streetSearchTokens(street);
    const pattern = buildLikePattern(tokens);

    let where = `upper(streetname) like '${escapeSoql(pattern)}'`;
    if (number) {
      where += ` AND housenumber='${escapeSoql(number)}'`;
    }
    if (borough) {
      const code = BOROUGH_CODES[borough.toLowerCase()];
      if (code) where += ` AND boroid='${code}'`;
    }

    let url = socrataUrl(ENDPOINTS.hpdRegistration, { $limit: 50, $where: where });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HPD Registration API error: ${res.status}`);
    const results = await res.json();

    // Fallback with just the number + last token
    if (results.length === 0 && number && tokens.length > 1) {
      const fallbackWhere = `housenumber='${escapeSoql(number)}' AND upper(streetname) like '%${escapeSoql(tokens[tokens.length - 1])}%'`;
      const fallbackUrl = socrataUrl(ENDPOINTS.hpdRegistration, { $limit: 50, $where: fallbackWhere });
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) return await fallbackRes.json();
    }

    return results;
  } catch (err) {
    console.error('HPD Registration fetch error:', err);
    return [];
  }
}

/**
 * Fetch HPD Registration Contacts (the actual people) for a registration id.
 *
 * NYC Open Data `feu5-w2e2` lists, per registered building: CorporateOwner,
 * IndividualOwner, HeadOfficer, Officer, Agent (managing agent), and
 * SiteManager — with corporation names and, for individuals, first/last
 * names. Free, no API key. This is the authoritative public record of who
 * is responsible for a building (emails/phones are NOT published by HPD).
 */
export async function fetchHPDRegistrationContacts(registrationId: string): Promise<any[]> {
  try {
    const url = socrataUrl(ENDPOINTS.hpdRegistrationContacts, {
      $limit: 50,
      $where: `registrationid='${escapeSoql(registrationId)}'`,
    });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HPD Registration Contacts API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('HPD Registration Contacts fetch error:', err);
    return [];
  }
}

const HPD_CONTACT_ROLE_LABELS: Record<string, string> = {
  CorporateOwner: 'Corporate Owner (HPD registered)',
  IndividualOwner: 'Owner (HPD registered)',
  HeadOfficer: 'Head Officer (HPD registered)',
  Officer: 'Officer (HPD registered)',
  Agent: 'Managing Agent (HPD registered)',
  SiteManager: 'Site Manager (HPD registered)',
  Lessee: 'Lessee (HPD registered)',
  Shareholder: 'Shareholder (HPD registered)',
};

/**
 * Convert raw HPD registration-contact rows into the app's Contact shape.
 * Dedupes by (name, role); note HPD publishes no emails or phone numbers,
 * so `email` is intentionally absent — enrichment services or manual
 * research (ACRIS parties, StreetEasy, DOS corporation search) fill those.
 */
export function hpdContactsToBuildingContacts(rows: any[]): Array<{
  name: string; role: string; company?: string; notes?: string; source: string;
}> {
  const seen = new Set<string>();
  const contacts: Array<{ name: string; role: string; company?: string; notes?: string; source: string }> = [];
  for (const row of rows || []) {
    const personName = [row.firstname, row.lastname].filter(Boolean).join(' ').trim();
    const corpName = (row.corporationname || '').trim();
    const name = personName || corpName;
    if (!name) continue;
    const role = HPD_CONTACT_ROLE_LABELS[row.type] || `${row.type || 'Contact'} (HPD registered)`;
    const key = `${name.toLowerCase()}|${role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bizAddress = [
      row.businesshousenumber, row.businessstreetname, row.businessapartment,
      row.businesscity, row.businessstate, row.businesszip,
    ].filter(Boolean).join(' ');
    contacts.push({
      name,
      role,
      company: personName && corpName ? corpName : undefined,
      notes: bizAddress ? `Business address on file: ${bizAddress}` : undefined,
      source: 'HPD Registration',
    });
  }
  return contacts;
}

/**
 * Fetch DOF Property Assessment (PLUTO data).
 * DOF/PLUTO stores addresses in a single "address" field with varying formats.
 * We try multiple strategies: full pattern, then number + key tokens, then just number.
 */
export async function fetchDOFProperty(address: string, borough?: string): Promise<DOFProperty[]> {
  try {
    const { number, street } = parseAddress(address);
    const tokens = streetSearchTokens(street);

    // Strategy 1: broad LIKE with number + key tokens → "%301%EAST%79%"
    let pattern: string;
    if (number) {
      pattern = buildLikePattern([number, ...tokens]);
    } else {
      pattern = buildLikePattern(tokens);
    }

    let where = `upper(address) like '${escapeSoql(pattern)}'`;
    if (borough) {
      // PLUTO uses abbreviated borough codes: MN, BK, QN, BX, SI
      const plutoCode = PLUTO_BOROUGH_CODES[borough.toLowerCase()] || borough.toUpperCase();
      where += ` AND borough='${plutoCode}'`;
    }

    let url = socrataUrl(ENDPOINTS.dofProperty, { $limit: 10, $where: where });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DOF API error: ${res.status}`);
    const results: DOFProperty[] = await res.json();

    if (results.length > 0) return results;

    // Strategy 2: just number + street number (for "301 ... 79 ...")
    if (number && tokens.length > 0) {
      // Find numeric tokens in the street part (e.g. "79" from "EAST 79")
      const numericTokens = tokens.filter((t) => /^\d+$/.test(t));
      if (numericTokens.length > 0) {
        const fallbackPattern = buildLikePattern([number, ...numericTokens]);
        let fallbackWhere = `upper(address) like '${escapeSoql(fallbackPattern)}'`;
        if (borough) {
          const plutoCode = PLUTO_BOROUGH_CODES[borough.toLowerCase()] || borough.toUpperCase();
          fallbackWhere += ` AND borough='${plutoCode}'`;
        }
        const fb = await fetch(socrataUrl(ENDPOINTS.dofProperty, { $limit: 10, $where: fallbackWhere }));
        if (fb.ok) {
          const fbResults: DOFProperty[] = await fb.json();
          if (fbResults.length > 0) return fbResults;
        }
      }
    }

    return results;
  } catch (err) {
    console.error('DOF Property fetch error:', err);
    return [];
  }
}

/**
 * Fetch DOB Permits.
 * DOB stores house number in "house__" and street name in "street_name".
 */
export async function fetchDOBPermits(address: string, borough?: string): Promise<DOBPermit[]> {
  try {
    const { number, street } = parseAddress(address);
    const tokens = streetSearchTokens(street);
    const pattern = buildLikePattern(tokens);

    let where = '';
    if (number) {
      where = `upper(house__) like '%${escapeSoql(number)}%'`;
      where += ` AND upper(street_name) like '${escapeSoql(pattern)}'`;
    } else {
      where = `upper(street_name) like '${escapeSoql(pattern)}'`;
    }

    let url = socrataUrl(ENDPOINTS.dobPermits, { $limit: 50, $order: 'pre__filing_date DESC', $where: where });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DOB API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('DOB Permits fetch error:', err);
    return [];
  }
}

/**
 * Fetch LL97 Energy Benchmarking Data
 */
export async function fetchLL97Energy(address: string): Promise<LL97Energy[]> {
  try {
    const { number, street } = parseAddress(address);
    const tokens = streetSearchTokens(street);

    let pattern: string;
    if (number) {
      pattern = buildLikePattern([number, ...tokens]);
    } else {
      pattern = buildLikePattern(tokens);
    }

    let url = socrataUrl(ENDPOINTS.ll97Energy, { $limit: 10, $where: `upper(address_1) like '${escapeSoql(pattern)}'` });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`LL97 API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('LL97 Energy fetch error:', err);
    return [];
  }
}

// ---- ACRIS helpers ----

const ACRIS_DOC_TYPES: Record<string, string> = {
  DEED: 'Deed Transfer',
  MTGE: 'Mortgage',
  AGMT: 'Agreement',
  ASST: 'Assignment of Mortgage',
  SAT: 'Satisfaction of Mortgage',
  RPTT: 'Real Property Transfer Tax',
  'AL&R': 'Assignment of Lease & Rents',
  CORRM: 'Correction Mortgage',
  CORRD: 'Correction Deed',
};

const ACRIS_RELEVANT_TYPES = ['DEED', 'MTGE', 'AGMT', 'ASST', 'SAT'];

/**
 * Parse a BBL string into borough, block, lot components
 */
export function parseBBL(bbl: string): { borough: string; block: string; lot: string } | null {
  if (!bbl || bbl.length < 10) return null;
  const clean = bbl.replace(/\D/g, '');
  if (clean.length < 10) return null;
  return {
    borough: clean.substring(0, 1),
    block: clean.substring(1, 6),
    lot: clean.substring(6, 10),
  };
}

/**
 * Fetch ACRIS deed/transfer/mortgage records for a BBL.
 * 1. Query Legals by BBL → get document_ids
 * 2. Query Master for those document_ids (filtered to relevant types)
 * 3. Query Parties for those document_ids
 * 4. Combine into clean ACRISRecord[]
 */
export async function fetchACRISRecords(borough: string, block: string, lot: string): Promise<ACRISData> {
  const acrisUrl = `https://a836-acris.nyc.gov/DS/DocumentSearch/BBLResult?Borough=${borough}&Block=${block.padStart(5, '0')}&Lot=${lot.padStart(4, '0')}`;

  try {
    // 10-year lookback
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const dateStr = tenYearsAgo.toISOString().split('T')[0];

    // Step 1: Query Legals by BBL
    const legalsWhere = `borough='${borough}' AND block='${block}' AND lot='${lot}'`;
    const legalsUrl = `${ENDPOINTS.acrisLegals}?$limit=500&$where=${encodeURIComponent(legalsWhere)}`;
    const legalsRes = await fetch(legalsUrl);
    if (!legalsRes.ok) throw new Error(`ACRIS Legals API error: ${legalsRes.status}`);
    let legals: any[] = await legalsRes.json();

    // For condos: parent lot (e.g., 7501) often has no ACRIS records.
    // Sales/mortgages are on individual unit lots (1001, 1002, etc.).
    // Try the first few unit lots as fallback.
    if (legals.length === 0 && parseInt(lot) > 7000) {
      const unitLots = ['1001', '1002', '1003'];
      for (const uLot of unitLots) {
        const fallbackWhere = `borough='${borough}' AND block='${block}' AND lot='${uLot}'`;
        const fbRes = await fetch(`${ENDPOINTS.acrisLegals}?$limit=100&$where=${encodeURIComponent(fallbackWhere)}`);
        if (fbRes.ok) {
          const fbLegals: any[] = await fbRes.json();
          if (fbLegals.length > 0) {
            legals = fbLegals;
            break;
          }
        }
      }
    }

    if (legals.length === 0) {
      return { records: [], deeds: [], mortgages: [], acrisUrl, borough, block, lot };
    }

    // Get unique document_ids
    const docIds = [...new Set(legals.map((l: any) => l.document_id).filter(Boolean))];
    if (docIds.length === 0) {
      return { records: [], deeds: [], mortgages: [], acrisUrl, borough, block, lot };
    }

    // Step 2 & 3: Query Master + Parties in parallel, batching document IDs
    // Socrata has URL length limits, so batch in groups of 30
    const batchSize = 30;
    const batches: string[][] = [];
    for (let i = 0; i < docIds.length; i += batchSize) {
      batches.push(docIds.slice(i, i + batchSize));
    }

    const allMaster: any[] = [];
    const allParties: any[] = [];

    // Process batches (parallelize master + parties within each batch)
    for (const batch of batches) {
      const docIdFilter = batch.map((id) => `document_id='${id}'`).join(' OR ');
      const typeFilter = ACRIS_RELEVANT_TYPES.map((t) => `doc_type='${t}'`).join(' OR ');
      const masterWhere = `(${docIdFilter}) AND (${typeFilter}) AND document_date >= '${dateStr}'`;
      const partiesWhere = docIdFilter;

      const [masterRes, partiesRes] = await Promise.all([
        fetch(`${ENDPOINTS.acrisMaster}?$limit=500&$where=${encodeURIComponent(masterWhere)}`).then((r) =>
          r.ok ? r.json() : []
        ).catch(() => []),
        fetch(`${ENDPOINTS.acrisParties}?$limit=1000&$where=${encodeURIComponent(partiesWhere)}`).then((r) =>
          r.ok ? r.json() : []
        ).catch(() => []),
      ]);

      allMaster.push(...masterRes);
      allParties.push(...partiesRes);
    }

    // Step 4: Build party map (document_id → parties)
    const partyMap = new Map<string, ACRISParty[]>();
    for (const p of allParties) {
      const docId = p.document_id;
      if (!partyMap.has(docId)) partyMap.set(docId, []);
      const partyType: 'buyer' | 'seller' = p.party_type === '1' ? 'buyer' : 'seller';
      const addr = [p.address_1, p.city, p.state, p.zip].filter(Boolean).join(', ') || undefined;
      partyMap.get(docId)!.push({
        type: partyType,
        name: p.name || 'Unknown',
        address: addr,
      });
    }

    // Step 5: Combine master + parties into ACRISRecord[]
    const records: ACRISRecord[] = allMaster
      .map((m: any) => ({
        documentId: m.document_id,
        documentType: m.doc_type,
        documentTypeLabel: ACRIS_DOC_TYPES[m.doc_type] || m.doc_type,
        date: m.document_date || '',
        amount: parseFloat(m.document_amt) || 0,
        recordedDate: m.recorded_datetime || undefined,
        parties: partyMap.get(m.document_id) || [],
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Separate deeds and mortgages
    const deeds = records.filter((r) => r.documentType === 'DEED');
    const mortgages = records.filter((r) => ['MTGE', 'ASST', 'SAT'].includes(r.documentType));

    // Last sale info
    const lastDeed = deeds[0];
    const lastSaleDate = lastDeed?.date;
    const lastSalePrice = lastDeed?.amount || 0;
    const lastSaleBuyer = lastDeed?.parties.find((p) => p.type === 'buyer')?.name;
    const lastSaleSeller = lastDeed?.parties.find((p) => p.type === 'seller')?.name;

    return {
      records,
      deeds,
      mortgages,
      lastSaleDate,
      lastSalePrice,
      lastSaleBuyer,
      lastSaleSeller,
      acrisUrl,
      borough,
      block,
      lot,
    };
  } catch (err) {
    console.error('ACRIS fetch error:', err);
    return { records: [], deeds: [], mortgages: [], acrisUrl, borough, block, lot };
  }
}

// ============================================================
// DOF Property Exemptions / Abatement
// ============================================================

const DOF_EXEMPTIONS_ENDPOINT = `${NYC_BASE}/8y4t-faws.json`;
const DOF_TAX_LIEN_ENDPOINT = `${NYC_BASE}/9rz4-mjek.json`;

export interface DOFAbatementData {
  hasAbatement: boolean;
  currentExemption: number;     // current year exempt amount
  abatementType: string;        // "421-a", "J-51", "Condo/Co-op Abatement", "None"
  taxClass: string;
  coopApts: number;
  yearBuilt: number;
  ownerName: string;
  condoNumber: string;
  sourceStatus: string;
  sourceQuery: string;
  matchedLot: string;
  matchedParid: string;
  matchedAddress: string;
  taxYear: string;
  marketValue: number;
  assessedValue: number;
  exemptAssessedValue: number;
  buildingClass: string;
  raw: any;
}

/**
 * Fetch DOB NOW Safety Facade / FISP compliance filings.
 * Source: DOB NOW: Safety - Facades Compliance Filings (NYC Open Data xubg-57si).
 */
export async function fetchFacadeFilings(address: string, borough?: string, bbl?: string): Promise<any[]> {
  try {
    const { number, street } = parseAddress(address);
    const tokens = streetSearchTokens(street);
    const boroughName = borough?.toUpperCase() === 'MN' || borough?.toLowerCase() === 'manhattan' ? 'MANHATTAN' : borough?.toUpperCase();
    const clauses: string[] = [];
    if (bbl) {
      const parts = parseBBL(bbl);
      if (parts) clauses.push(`(block='${String(parseInt(parts.block, 10))}' AND lot='${String(parseInt(parts.lot, 10))}')`);
    }
    if (number && tokens.length) {
      const streetClause = tokens
        .filter(token => token !== 'STREET' && token !== 'AVENUE')
        .map(token => `upper(street_name) like '%${escapeSoql(token)}%'`)
        .join(' AND ');
      clauses.push(`(house_no='${escapeSoql(number)}'${streetClause ? ` AND ${streetClause}` : ''}${boroughName ? ` AND borough='${escapeSoql(boroughName)}'` : ''})`);
    }
    if (clauses.length === 0) return [];
    const where = clauses.join(' OR ');
    const res = await fetch(socrataUrl(ENDPOINTS.facadeFilings, {
      $limit: 50,
      $order: 'cycle DESC',
      $where: where,
    }));
    if (!res.ok) throw new Error(`Facade filings API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Facade filings fetch error:', err);
    return [];
  }
}

export interface TaxLienData {
  hasLien: boolean;
  sourceStatus: string;
  sourceQuery: string;
  recordCount: number;
  matchedLots: string[];
  liens: Array<{
    cycle: string;
    date: string;
    waterDebtOnly: boolean;
    lot: string;
    houseNumber: string;
    streetName: string;
    zip: string;
    taxClass: string;
    buildingClass: string;
  }>;
}

function isCondoParentLot(lot: string): boolean {
  const n = parseInt(lot, 10);
  return Number.isFinite(n) && n >= 7500;
}

function rowAddress(row: any): string {
  return [row.housenum_lo || row.house_number, row.street_name, row.zip_code || row.zip].filter(Boolean).join(' ').trim();
}

function streetWhere(field: string, street: string): string {
  const tokens = streetSearchTokens(street);
  if (tokens.length === 0) return '';
  return tokens.map(token => `upper(${field}) like '%${escapeSoql(token)}%'`).join(' AND ');
}

function dofAbatementFromRow(row: any, sourceStatus: string, sourceQuery: string): DOFAbatementData {
  const exemption = parseFloat(row.curactextot) || 0;
  const taxFlagIndicatesAbatement = (row.curtaxflag === 'A' || row.cbntaxflag === 'A' || row.fintaxflag === 'A');
  return {
    hasAbatement: exemption > 0 || taxFlagIndicatesAbatement,
    currentExemption: exemption,
    abatementType: taxFlagIndicatesAbatement ? (row.cbntaxflag === 'A' ? 'Condo/Co-op Abatement (421-a or similar)' : 'Tax Abatement Active') : 'None indicated',
    taxClass: row.curtaxclass || '',
    coopApts: parseInt(row.coop_apts) || 0,
    yearBuilt: parseInt(row.yrbuilt) || 0,
    ownerName: row.owner || '',
    condoNumber: row.condo_number || row.coop_num || '',
    sourceStatus,
    sourceQuery,
    matchedLot: row.lot || '',
    matchedParid: row.parid || '',
    matchedAddress: rowAddress(row),
    taxYear: row.year || '',
    marketValue: parseFloat(row.curmkttot) || 0,
    assessedValue: parseFloat(row.curacttot) || 0,
    exemptAssessedValue: exemption,
    buildingClass: row.bldg_class || '',
    raw: row,
  };
}

/**
 * Fetch DOF Property Exemptions (co-op/condo abatement data, tax class details)
 */
export async function fetchDOFExemptions(borough: string, block: string, lot: string, address?: string): Promise<DOFAbatementData | null> {
  try {
    const exactWhere = `boro='${escapeSoql(borough)}' AND block='${escapeSoql(block)}' AND lot='${escapeSoql(lot)}'`;
    const url = socrataUrl(DOF_EXEMPTIONS_ENDPOINT, {
      $limit: 1,
      $order: 'year DESC',
      $where: exactWhere,
    });
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.length > 0 && !isCondoParentLot(lot)) return dofAbatementFromRow(data[0], 'DOF exemptions matched exact BBL lot', exactWhere);

    const exactParentRow = data?.[0];
    const parsed = address ? parseAddress(address) : { number: '', street: '' };
    const streetClause = parsed.street ? streetWhere('street_name', parsed.street) : '';
    if (parsed.number && streetClause) {
      const addressWhere = `boro='${escapeSoql(borough)}' AND block='${escapeSoql(block)}' AND housenum_lo='${escapeSoql(parsed.number)}' AND ${streetClause}`;
      const addressUrl = socrataUrl(DOF_EXEMPTIONS_ENDPOINT, {
        $limit: 20,
        $order: 'year DESC',
        $where: addressWhere,
      });
      const addressRes = await fetch(addressUrl);
      if (addressRes.ok) {
        const addressRows = await addressRes.json();
        if (addressRows?.length > 0) {
          const rowWithAbatement = addressRows.find((row: any) => (parseFloat(row.curactextot) || 0) > 0 || row.curtaxflag === 'A' || row.cbntaxflag === 'A' || row.fintaxflag === 'A');
          return dofAbatementFromRow(rowWithAbatement || addressRows[0], 'DOF exemptions matched block/address; condo unit lots checked', addressWhere);
        }
      }
    }

    if (exactParentRow) return dofAbatementFromRow(exactParentRow, 'DOF exemptions matched condo parent lot only; unit-lot abatement check returned no address rows', exactWhere);
    return null;
  } catch (err) {
    console.error('DOF Exemptions fetch error:', err);
    return null;
  }
}

/**
 * Fetch DOF Tax Lien Sale data — checks if property has any outstanding tax liens
 */
export async function fetchTaxLiens(borough: string, block: string, lot: string, address?: string): Promise<TaxLienData> {
  const empty = (sourceStatus = 'DOF tax lien endpoint searched: no rows returned', sourceQuery = ''): TaxLienData => ({
    hasLien: false,
    sourceStatus,
    sourceQuery,
    recordCount: 0,
    matchedLots: [],
    liens: [],
  });
  const fromRows = (rows: any[], sourceStatus: string, sourceQuery: string): TaxLienData => {
    const liens = rows.map((d: any) => ({
      cycle: d.cycle || '',
      date: d.month || '',
      waterDebtOnly: d.water_debt_only === 'YES',
      lot: d.lot || '',
      houseNumber: d.house_number || '',
      streetName: d.street_name || '',
      zip: d.zip_code || d.zip || '',
      taxClass: d.tax_class_code || d.tax_class || '',
      buildingClass: d.building_class || '',
    }));
    return {
      hasLien: liens.length > 0,
      sourceStatus,
      sourceQuery,
      recordCount: liens.length,
      matchedLots: Array.from(new Set(liens.map(l => l.lot).filter(Boolean))),
      liens,
    };
  };

  try {
    const exactWhere = `borough='${escapeSoql(borough)}' AND block='${escapeSoql(block)}' AND lot='${escapeSoql(lot)}'`;
    const url = socrataUrl(DOF_TAX_LIEN_ENDPOINT, {
      $limit: 25,
      $order: 'month DESC',
      $where: exactWhere,
    });
    const res = await fetch(url);
    if (!res.ok) return empty('DOF tax lien endpoint failed', exactWhere);
    const data = await res.json();
    if (data?.length > 0 && !isCondoParentLot(lot)) return fromRows(data, 'DOF tax lien matched exact BBL lot', exactWhere);

    const parsed = address ? parseAddress(address) : { number: '', street: '' };
    const streetClause = parsed.street ? streetWhere('street_name', parsed.street) : '';
    if (parsed.number && streetClause) {
      const addressWhere = `borough='${escapeSoql(borough)}' AND block='${escapeSoql(block)}' AND house_number='${escapeSoql(parsed.number)}' AND ${streetClause}`;
      const addressUrl = socrataUrl(DOF_TAX_LIEN_ENDPOINT, {
        $limit: 50,
        $order: 'month DESC',
        $where: addressWhere,
      });
      const addressRes = await fetch(addressUrl);
      if (addressRes.ok) {
        const addressRows = await addressRes.json();
        if (addressRows?.length > 0) return fromRows(addressRows, 'DOF tax lien matched block/address; condo unit lots checked', addressWhere);
      }
    }

    if (data?.length > 0) return fromRows(data, 'DOF tax lien matched condo parent lot only', exactWhere);
    return empty('DOF tax lien endpoint searched exact lot and address fallback: no rows returned', exactWhere);
  } catch (err) {
    console.error('Tax Lien fetch error:', err);
    return empty('DOF tax lien fetch error');
  }
}

// ============================================================
// DOB Permit Professional Extraction
// ============================================================

export interface DOBProfessional {
  name: string;
  title: string;   // 'RA' (Registered Architect), 'PE' (Professional Engineer), 'Filing Rep', etc.
  license: string;
  role: 'architect' | 'engineer' | 'filing_rep';
}

export interface DOBOwnerInfo {
  name: string;
  businessName: string;
  phone: string;
  type: string;  // INDIVIDUAL, CORPORATION, etc.
}

/**
 * Extract architect/engineer contacts and owner info from DOB permit records
 */
export function extractDOBProfessionals(permits: DOBPermit[]): { professionals: DOBProfessional[]; owners: DOBOwnerInfo[] } {
  const profMap = new Map<string, DOBProfessional>();
  const ownerMap = new Map<string, DOBOwnerInfo>();

  for (const p of permits) {
    // Extract applicant (architect/engineer)
    const firstName = (p as any).applicant_s_first_name || '';
    const lastName = (p as any).applicant_s_last_name || '';
    const profTitle = (p as any).applicant_professional_title || '';
    const license = (p as any).applicant_license__ || '';

    if (firstName || lastName) {
      const fullName = `${firstName} ${lastName}`.trim();
      const key = fullName.toUpperCase();
      if (!profMap.has(key)) {
        let role: DOBProfessional['role'] = 'filing_rep';
        if (profTitle === 'RA') role = 'architect';
        else if (profTitle === 'PE') role = 'engineer';

        profMap.set(key, {
          name: fullName,
          title: profTitle === 'RA' ? 'Registered Architect' : profTitle === 'PE' ? 'Professional Engineer' : profTitle || 'Filing Representative',
          license: license,
          role,
        });
      }
    }

    // Extract owner
    const ownerFirst = (p as any).owner_s_first_name || '';
    const ownerLast = (p as any).owner_s_last_name || '';
    const ownerBiz = (p as any).owner_s_business_name || '';
    const ownerPhone = (p as any).owner_sphone__ || '';
    const ownerType = (p as any).owner_type || '';

    if (ownerFirst || ownerLast || ownerBiz) {
      const ownerName = `${ownerFirst} ${ownerLast}`.trim() || ownerBiz;
      const oKey = ownerName.toUpperCase();
      if (!ownerMap.has(oKey)) {
        ownerMap.set(oKey, {
          name: ownerName,
          businessName: ownerBiz && ownerBiz !== 'N/A' ? ownerBiz : '',
          phone: ownerPhone,
          type: ownerType,
        });
      }
    }
  }

  return {
    professionals: Array.from(profMap.values()),
    owners: Array.from(ownerMap.values()),
  };
}

/**
 * Resolve a borough (and BBL when available) from the free NYC Planning
 * GeoSearch API. Used as a fallback when the caller couldn't auto-detect the
 * borough — without it, DOF/PLUTO lookups often fail on ambiguous street
 * names (e.g. "1133 Park Avenue" exists in Manhattan AND the Bronx), which
 * left Market Value at $0 in reports.
 */
export async function resolveBoroughFromGeoSearch(address: string): Promise<{ borough?: string; bbl?: string; neighbourhood?: string; postalcode?: string; lat?: number; lng?: number } | null> {
  try {
    const res = await fetch(
      `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(`${address}, New York, NY`)}&size=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const props = data?.features?.[0]?.properties;
    if (!props) return null;
    const coords = data?.features?.[0]?.geometry?.coordinates;
    return {
      borough: props.borough || undefined,
      bbl: props.addendum?.pad?.bbl || props.pad_bbl || undefined,
      neighbourhood: props.neighbourhood || undefined,
      postalcode: props.postalcode || undefined,
      lat: Array.isArray(coords) ? Number(coords[1]) : undefined,
      lng: Array.isArray(coords) ? Number(coords[0]) : undefined,
    };
  } catch {
    return null;
  }
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Nearest subway stations from the MTA stations dataset (real names + routes),
 * computed by straight-line distance from the property.
 */
export async function fetchNearbySubways(lat: number, lng: number, limit = 3): Promise<Array<{ name: string; routes: string; miles: number }>> {
  try {
    // MTA Subway Stations lives on the NY State portal (data.ny.gov), not the
    // NYC portal — the city host returns 404 for this dataset.
    const res = await fetch(`https://data.ny.gov/resource/39hk-dx4f.json?$select=stop_name,daytime_routes,gtfs_latitude,gtfs_longitude&$limit=600`);
    if (!res.ok) return [];
    const rows = await res.json();
    const seen = new Set<string>();
    return rows
      .map((r: any) => ({
        name: String(r.stop_name || '').trim(),
        routes: String(r.daytime_routes || '').trim(),
        miles: haversineMiles(lat, lng, parseFloat(r.gtfs_latitude), parseFloat(r.gtfs_longitude)),
      }))
      .filter((s: any) => s.name && Number.isFinite(s.miles))
      .sort((a: any, b: any) => a.miles - b.miles)
      .filter((s: any) => { const k = `${s.name}|${s.routes}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Resolve a property address from Borough + Block + Lot via PLUTO.
 * Lets users who work off tax records search without a street address.
 */
export async function fetchAddressByBBL(borough: string, block: string, lot: string): Promise<{ address: string; borough: string } | null> {
  const boroDigit = BOROUGH_CODES[borough.toLowerCase()];
  const blockClean = String(parseInt(String(block).replace(/\D/g, ''), 10) || '');
  const lotClean = String(parseInt(String(lot).replace(/\D/g, ''), 10) || '');
  if (!boroDigit || !blockClean || !lotClean) return null;
  const bbl = `${boroDigit}${blockClean.padStart(5, '0')}${lotClean.padStart(4, '0')}`;
  try {
    const res = await fetch(`${ENDPOINTS.dofProperty}?$select=address,borough&bbl=${bbl}`);
    if (!res.ok) return null;
    const rows = await res.json();
    const row = rows?.[0];
    if (!row?.address) return null;
    return { address: String(row.address).trim(), borough };
  } catch {
    return null;
  }
}

/**
 * Fetch ALL NYC data for a building (combined)
 */
export async function fetchFullBuildingReport(address: string, borough?: string) {
  // Resolve the address via NYC GeoSearch: authoritative borough (backfilled
  // when the caller couldn't detect it), plus the real neighborhood and ZIP
  // for report headers (keyword guessing mislabeled e.g. Walker St as Midtown).
  let resolvedBbl: string | undefined;
  let resolvedNeighborhood: string | undefined;
  let resolvedZip: string | undefined;
  let nearbySubways: Array<{ name: string; routes: string; miles: number }> = [];
  let resolvedLat: number | undefined;
  let resolvedLng: number | undefined;
  {
    const geo = await withTimeout(resolveBoroughFromGeoSearch(address), null, 5000);
    if (!borough && geo?.borough) borough = geo.borough;
    if (geo?.bbl) resolvedBbl = geo.bbl;
    if (geo?.neighbourhood) resolvedNeighborhood = geo.neighbourhood;
    if (geo?.postalcode) resolvedZip = geo.postalcode;
    if (geo?.lat && geo?.lng) {
      resolvedLat = geo.lat;
      resolvedLng = geo.lng;
      nearbySubways = await withTimeout(fetchNearbySubways(geo.lat, geo.lng, 3), [], 6000);
    }
  }

  let [violations, registration, dofData, permits, energy, spireMatch] = await Promise.all([
    withTimeout(fetchHPDViolations(address, borough), [] as HPDViolation[]),
    withTimeout(fetchHPDRegistration(address, borough), [] as any[]),
    withTimeout(fetchDOFProperty(address, borough), [] as DOFProperty[]),
    withTimeout(fetchDOBPermits(address, borough), [] as DOBPermit[]),
    withTimeout(fetchLL97Energy(address), [] as LL97Energy[]),
    // Camelot's own managed-portfolio unit counts (Spire MDS), when this
    // address is a building Camelot already manages — takes priority over
    // the DOF/PLUTO estimate below since it's the actual rent roll.
    withTimeout(lookupSpireManagedBuilding(address), null, 5000),
  ]);

  // Extract key data from DOF
  const dof = dofData[0];
  const bestBbl = dof?.bbl || resolvedBbl;
  const facadeFilings = await withTimeout(fetchFacadeFilings(address, borough, bestBbl), [] as any[]).catch((err) => {
    console.error('Facade filings fetch in report failed:', err);
    return [] as any[];
  });

  // Address matching can miss condo parent lots when users include city/state
  // variations. If DOF or GeoSearch found the BBL, use it as the
  // authoritative HPD fallback.
  if (violations.length === 0 && bestBbl) {
    violations = await withTimeout(fetchHPDViolationsByBBL(bestBbl), [] as HPDViolation[]);
  }

  // Extract registration info
  const reg = registration[0];

  // Calculate violation stats
  const openViolations = violations.filter(isHPDViolationOpen);

  // Fetch ACRIS + new gov APIs if we have a BBL
  let acris: ACRISData | null = null;
  let ecbViolations: ECBViolation[] = [];
  let housingLitigation: HousingLitigation[] = [];
  let rentStabilization: RentStabilization[] = [];
  let dofAbatement: DOFAbatementData | null = null;
  let taxLiens: TaxLienData = { hasLien: false, sourceStatus: 'Not searched', sourceQuery: '', recordCount: 0, matchedLots: [], liens: [] };

  if (dof?.bbl) {
    const bblParts = parseBBL(dof.bbl);
    if (bblParts) {
      // Parse address for litigation query
      const parsedAddr = parseAddress(address);
      const boroCode = bblParts.borough;

      // Fetch ACRIS, ECB, Litigation, Rent Stabilization, Abatements, and Tax Liens in parallel
      const [acrisResult, ecbResult, litigationResult, rentStabResult, abatementResult, lienResult] = await Promise.all([
        withTimeout(fetchACRISRecords(bblParts.borough, bblParts.block, bblParts.lot), null).catch((err) => {
          console.error('ACRIS fetch in report failed:', err);
          return null;
        }),
        withTimeout(fetchECBViolations(bblParts.borough, bblParts.block, bblParts.lot), [] as ECBViolation[]).catch((err) => {
          console.error('ECB fetch in report failed:', err);
          return [] as ECBViolation[];
        }),
        parsedAddr.number
          ? withTimeout(fetchHousingLitigation(boroCode, parsedAddr.number, parsedAddr.street), [] as HousingLitigation[]).catch((err) => {
              console.error('Litigation fetch in report failed:', err);
              return [] as HousingLitigation[];
            })
          : Promise.resolve([] as HousingLitigation[]),
        withTimeout(fetchRentStabilization(bblParts.borough, bblParts.block, bblParts.lot), [] as RentStabilization[]).catch((err) => {
          console.error('Rent stabilization fetch in report failed:', err);
          return [] as RentStabilization[];
        }),
        withTimeout(fetchDOFExemptions(bblParts.borough, bblParts.block, bblParts.lot, address), null).catch((err) => {
          console.error('DOF Abatement fetch in report failed:', err);
          return null;
        }),
        withTimeout(fetchTaxLiens(bblParts.borough, bblParts.block, bblParts.lot, address), { hasLien: false, sourceStatus: 'DOF tax lien timed out', sourceQuery: '', recordCount: 0, matchedLots: [], liens: [] } as TaxLienData).catch((err) => {
          console.error('Tax Lien fetch in report failed:', err);
          return { hasLien: false, sourceStatus: 'DOF tax lien fetch failed', sourceQuery: '', recordCount: 0, matchedLots: [], liens: [] } as TaxLienData;
        }),
      ]);

      acris = acrisResult;
      ecbViolations = ecbResult;
      housingLitigation = litigationResult;
      rentStabilization = rentStabResult;
      dofAbatement = abatementResult;
      taxLiens = lienResult;
    }
  }

  // Fetch HPD MDR Contacts (Multiple Dwelling Registration — key building contacts)
  let hpdContacts: Array<{ type: string; description: string; name: string; corp: string; title: string; address: string }> = [];
  const regId = registration[0]?.registrationid;
  if (regId) {
    try {
      const contactsEndpoint = `${NYC_BASE}/feu5-w2e2.json`;
      const contactsRes = await fetch(`${contactsEndpoint}?$limit=20&$where=registrationid='${regId}'`);
      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        hpdContacts = contactsData.map((c: any) => ({
          type: c.type || '',
          description: c.contactdescription || '',
          name: `${c.firstname || ''} ${c.lastname || ''}`.trim() || c.corporationname || '',
          corp: c.corporationname || '',
          title: c.title || '',
          address: [c.businesshousenumber, c.businessstreetname, c.businesscity, c.businessstate, c.businesszip].filter(Boolean).join(' '),
        }));
      }
    } catch (err) {
      console.error('HPD Contacts fetch error:', err);
    }
  }

  // Extract management company from HPD contacts if not found in registration
  const agentContact = hpdContacts.find(c => c.type === 'Agent');
  const headOfficer = hpdContacts.find(c => c.type === 'HeadOfficer');
  const siteManager = hpdContacts.find(c => c.type === 'SiteManager');
  const corpOwner = hpdContacts.find(c => c.type === 'CorporateOwner');

  // Extract DOB professional contacts (architect, engineer, owner)
  const dobExtracted = extractDOBProfessionals(permits);

  // Extract unit count from DOB permits as fallback
  let dobUnits = 0;
  let dobStories = 0;
  for (const p of permits) {
    const eu = parseInt((p as any).existing_dwelling_units) || 0;
    const pu = parseInt((p as any).proposed_dwelling_units) || 0;
    const es = parseInt((p as any).existingno_of_stories) || 0;
    if (eu > dobUnits) dobUnits = eu;
    if (pu > dobUnits) dobUnits = pu;
    if (es > dobStories) dobStories = es;
  }

  return {
    // Location as resolved for this lookup (caller-provided or GeoSearch)
    // so report builders can backfill when auto-detect failed.
    resolvedBorough: borough || null,
    resolvedNeighborhood: resolvedNeighborhood || null,
    resolvedZip: resolvedZip || null,
    resolvedLat: resolvedLat ?? null,
    resolvedLng: resolvedLng ?? null,
    nearbySubways,
    violations: {
      total: violations.length,
      open: openViolations.length,
      items: violations.slice(0, 50), // Limit for display
      lastDate: violations[0]?.inspectiondate,
    },
    registration: {
      owner: reg?.ownerfirstname
        ? `${reg.ownerfirstname} ${reg.ownerlastname}`
        : reg?.corporationname || corpOwner?.name || corpOwner?.corp || null,
      managementCompany: reg?.managementcompany || agentContact?.corp || agentContact?.name || null,
      registrationId: reg?.registrationid || null,
      buildingId: reg?.buildingid || null,
    },
    hpdContacts,
    dof: dof
      ? {
          bbl: dof.bbl,
          owner: (dof as any).owner || (dof as any).ownername || '',
          // PLUTO has no market-value field (only assessed values), so fall
          // back to the DOF assessment roll's current market total
          // (curmkttot via fetchDOFExemptions). Sanity guard: a whole-building
          // market value can never be below its assessed value — if it is,
          // the roll matched a single condo unit lot, so discard it.
          marketValue: (() => {
            const assessed = parseFloat((dof as any).avtot || (dof as any).assesstot) || 0;
            const mv = parseFloat((dof as any).fullval || (dof as any).fullvaltot || (dof as any).marketvalue) || dofAbatement?.marketValue || 0;
            return mv >= assessed * 0.8 ? mv : 0;
          })(),
          assessedValue: parseFloat((dof as any).avtot || (dof as any).assesstot) || 0,
          landValue: parseFloat((dof as any).avland || (dof as any).assessland) || 0,
          yearBuilt: parseInt(dof.yearbuilt) || 0,
          units: spireMatch?.unitsTotal || parseInt(dof.unitsres) || parseInt(dof.unitstotal) || 0,
          // Spire (Camelot's own rent roll) beats the DOF/PLUTO estimate
          // whenever this is a building Camelot actively manages.
          unitsResidential: spireMatch?.unitsResidential || parseInt(dof.unitsres) || 0,
          unitsTotalAll: spireMatch?.unitsTotal || parseInt(dof.unitstotal) || 0,
          lotArea: parseFloat(dof.lotarea) || 0,
          buildingArea: parseFloat((dof as any).bldgarea || (dof as any).resarea) || 0,
          stories: parseInt(dof.numfloors) || 0,
          buildingClass: (dof as any).bldgcl || (dof as any).bldgclass || '',
          taxClass: dof.taxclass,
        }
      : null,
    permits: {
      count: permits.length,
      items: permits.slice(0, 20),
      hasRecent: permits.some((p) => {
        const date = new Date((p as any).pre__filing_date || p.filing_date || (p as any).latest_action_date || '');
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        return date > twoYearsAgo;
      }),
    },
    facade: {
      filings: facadeFilings,
      count: facadeFilings.length,
      issueCount: facadeFilings.filter((f: any) => /unsafe|swarmp|no report|late|failure/i.test(`${f.current_status || ''} ${f.filing_status || ''}`)).length,
      latestStatus: facadeFilings[0]?.current_status || facadeFilings[0]?.filing_status || '',
    },
    energy: energy[0]
      ? {
          energyStarScore: parseInt(energy[0].energy_star_score) || null,
          siteEUI: parseFloat(energy[0].site_eui_kbtu_ft) || null,
          ghgEmissions: parseFloat(energy[0].total_ghg_emissions_metric_tons_co2e) || null,
          occupancy: energy[0].occupancy,
          propertyName: energy[0].property_name,
        }
      : null,
    acris,
    ecb: {
      violations: ecbViolations,
      count: ecbViolations.length,
      totalPenaltyBalance: totalECBPenaltyBalance(ecbViolations),
    },
    litigation: {
      cases: housingLitigation,
      count: housingLitigation.length,
      hasActive: hasActiveLitigation(housingLitigation),
    },
    rentStabilization: {
      data: rentStabilization,
      isStabilized: isRentStabilized(rentStabilization),
    },
    buildingOps: detectBuildingOperations(
      dof?.bldgcl,
      parseInt(dof?.unitsres || dof?.unitstotal || '0') || 0,
    ),
    dobProfessionals: dobExtracted.professionals,
    dobOwners: dobExtracted.owners,
    dobUnits,
    dobStories,
    dofAbatement,
    taxLiens,
  };
}

/**
 * Search HPD Building Registration by owner name
 */
export async function searchByOwnerName(name: string): Promise<any[]> {
  try {
    const upperName = name.toUpperCase().replace(/'/g, "''");
    const parts = upperName.split(/\s+/).filter(Boolean);
    
    // Use HPD Registration Contacts dataset (has owner/agent names)
    const contactsEndpoint = `${NYC_BASE}/feu5-w2e2.json`;
    
    // Build query — search firstname, lastname, and corporationname
    let whereClause: string;
    if (parts.length >= 2) {
      // "David Goldoff" → search first AND last, OR as corporation
      whereClause = `(upper(firstname) like '%25${encodeURIComponent(parts[0])}%25' AND upper(lastname) like '%25${encodeURIComponent(parts[1])}%25') OR upper(corporationname) like '%25${encodeURIComponent(upperName)}%25'`;
    } else {
      // Single word — search last name and corporation
      whereClause = `upper(lastname) like '%25${encodeURIComponent(parts[0])}%25' OR upper(corporationname) like '%25${encodeURIComponent(parts[0])}%25'`;
    }
    
    const url = `${contactsEndpoint}?$limit=200&$where=${whereClause}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HPD Contacts API error: ${res.status}`);
    const contacts = await res.json();
    
    if (contacts.length === 0) return [];
    
    // Get unique registration IDs
    const regIds = [...new Set(contacts.map((c: any) => c.registrationid))] as string[];
    const limitedRegIds = regIds.slice(0, 50);
    
    // Fetch building info for each registration
    const regQuery = limitedRegIds.map((id) => `registrationid='${id}'`).join(' OR ');
    const buildingsUrl = `${ENDPOINTS.hpdRegistration}?$limit=200&$where=${encodeURIComponent(regQuery)}`;
    const buildingsRes = await fetch(buildingsUrl);
    const buildings = buildingsRes.ok ? await buildingsRes.json() : [];
    
    // Map registration IDs to contact info
    const contactMap = new Map<string, any>();
    for (const c of contacts) {
      if (!contactMap.has(c.registrationid)) {
        contactMap.set(c.registrationid, c);
      }
    }
    
    // Merge building + contact data, deduplicate by address
    const seen = new Set<string>();
    const results: any[] = [];
    for (const b of buildings) {
      const addr = `${b.housenumber} ${b.streetname}`.trim();
      if (seen.has(addr)) continue;
      seen.add(addr);
      const contact = contactMap.get(b.registrationid);
      results.push({
        ...b,
        address: addr,
        ownerName: contact ? `${contact.firstname || ''} ${contact.lastname || ''}`.trim() : '',
        corporationName: contact?.corporationname || '',
        contactType: contact?.type || '',
        managementCompany: contact?.corporationname || '',
      });
    }
    
    return results;
  } catch (err) {
    console.error('Owner name search error:', err);
    return [];
  }
}

/**
 * Search by address + unit number for unit-specific data
 * Returns enriched building context alongside unit-specific violations
 */
export async function searchByUnit(address: string, unit: string): Promise<any> {
  try {
    const { number, street } = parseAddress(address);
    const upperUnit = unit.toUpperCase().replace(/'/g, "''");

    // HPD Violations for this specific unit
    const tokens = streetSearchTokens(street);
    const pattern = buildLikePattern(tokens);
    let violationsUrl = `${ENDPOINTS.hpdViolations}?$limit=200`;
    if (number) {
      violationsUrl += `&$where=upper(apartment)='${encodeURIComponent(upperUnit)}'`;
      violationsUrl += ` AND housenumber='${number}'`;
      violationsUrl += ` AND upper(streetname) like '${encodeURIComponent(pattern)}'`;
    }

    // Fetch unit violations, building DOF data, and registration in parallel
    const [violationsRes, dofData, regData] = await Promise.all([
      fetch(violationsUrl).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetchDOFProperty(address),
      fetchHPDRegistration(address),
    ]);

    const violations: HPDViolation[] = violationsRes;
    const openViolations = violations.filter(
      (v) => v.currentstatus !== 'CLOSE' && v.violationstatus !== 'Close'
    );

    const dof = dofData[0];
    const reg = regData[0];

    // Determine building type from building class
    const bldgClass = dof?.bldgcl || '';
    const isCondo = bldgClass.startsWith('R') || bldgClass === 'R4' || bldgClass === 'R9';
    const isCoop = bldgClass === 'D4' || bldgClass === 'D0' || bldgClass.startsWith('D');

    return {
      unit: upperUnit,
      address,
      violations: {
        total: violations.length,
        open: openViolations.length,
        items: violations.slice(0, 50),
        lastDate: violations[0]?.inspectiondate,
      },
      dof: dof
        ? {
            bbl: dof.bbl,
            owner: dof.owner,
            marketValue: parseFloat(dof.fullval) || 0,
            assessedValue: parseFloat(dof.avtot) || 0,
            landValue: parseFloat(dof.avland) || 0,
            yearBuilt: parseInt(dof.yearbuilt) || 0,
            units: parseInt(dof.unitsres) || parseInt(dof.unitstotal) || 0,
            stories: parseInt(dof.numfloors) || 0,
            lotArea: parseFloat(dof.lotarea) || 0,
            buildingArea: parseFloat(dof.bldgarea) || 0,
            buildingClass: dof.bldgcl,
            taxClass: dof.taxclass,
          }
        : null,
      registration: reg
        ? {
            owner: reg.corporationname
              || `${reg.ownerfirstname || ''} ${reg.ownerlastname || ''}`.trim()
              || null,
            managementCompany: reg.managementcompany || null,
          }
        : null,
      buildingType: isCondo ? 'condo' : isCoop ? 'co-op' : 'rental',
      isCondo,
      isCoop,
    };
  } catch (err) {
    console.error('Unit search error:', err);
    return {
      unit, address,
      violations: { total: 0, open: 0, items: [] },
      dof: null, registration: null,
      buildingType: 'unknown', isCondo: false, isCoop: false,
    };
  }
}

/**
 * Search buildings by region using NYC Open Data
 * This searches PLUTO for buildings matching criteria
 */
export async function searchBuildingsByRegion(params: {
  borough?: string;
  minUnits?: number;
  maxUnits?: number;
  yearBuiltMin?: number;
  yearBuiltMax?: number;
  buildingClass?: string;
  limit?: number;
}): Promise<DOFProperty[]> {
  try {
    const limit = params.limit || 100;
    const where: string[] = [];

    if (params.borough) {
      // PLUTO uses 2-letter borough codes: MN, BK, BX, QN, SI
      const boroCodes: Record<string, string> = {
        MANHATTAN: 'MN', BROOKLYN: 'BK', QUEENS: 'QN', BRONX: 'BX', 'STATEN ISLAND': 'SI',
      };
      const code = boroCodes[params.borough.toUpperCase()] || params.borough;
      where.push(`borough='${code}'`);
    }
    if (params.minUnits) {
      where.push(`unitsres >= ${params.minUnits}`);
    }
    if (params.maxUnits) {
      where.push(`unitsres <= ${params.maxUnits}`);
    }
    if (params.yearBuiltMin) {
      where.push(`yearbuilt >= '${params.yearBuiltMin}'`);
    }
    if (params.yearBuiltMax) {
      where.push(`yearbuilt <= '${params.yearBuiltMax}'`);
    }
    // Exclude empty lots and buildings with 0 units
    where.push(`unitsres > 0`);

    // PLUTO dataset uses assesstot (not fullval) and ownername (not owner)
    let url = `${ENDPOINTS.dofProperty}?$limit=${limit}&$order=assesstot DESC`;
    if (where.length) {
      url += `&$where=${where.join(' AND ')}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Search API error: ${res.status}`);
    const raw: any[] = await res.json();

    // Map PLUTO column names to our DOFProperty interface
    return raw.map((r) => ({
      bbl: r.bbl || '',
      borough: r.borough || '',
      block: r.block || '',
      lot: r.lot || '',
      address: r.address || '',
      owner: r.ownername || '',
      bldgcl: r.bldgclass || '',
      taxclass: r.taxclass || '',
      fullval: r.assesstot || '0',
      avland: r.assessland || '0',
      avtot: r.assesstot || '0',
      yearbuilt: r.yearbuilt || '',
      unitsres: r.unitsres || '0',
      unitstotal: r.unitstotal || '0',
      lotarea: r.lotarea || '0',
      bldgarea: r.bldgarea || '0',
      numfloors: r.numfloors || '0',
      numbldgs: r.numbldgs || '1',
    }));
  } catch (err) {
    console.error('Building search error:', err);
    return [];
  }
}