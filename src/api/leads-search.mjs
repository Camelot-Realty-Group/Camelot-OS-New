/**
 * Neighborhood Leads — city-wide search engine.
 *
 * Server-only. Queries NYC Open Data (PLUTO + HPD) directly — this runs on
 * Render, which has full outbound network access (unlike the dev sandbox
 * this was designed in, which only had a ~200-char URL-length-capped fetch
 * tool; that constraint doesn't apply here, so this uses normal batched
 * Socrata queries).
 *
 * Criteria (per David, Aug 2026): multifamily or mixed-use rental, condo,
 * or co-op buildings, and boutique office buildings, 10+ units. Same
 * landuse-based filter logic validated in the one-off "Neighbor Expansion"
 * campaign (see camelot_neighbor_summary.json / neighbor-prospect-report.ts),
 * generalized to run city-wide and repeatedly instead of only around
 * Camelot's current buildings.
 *
 * Data sources:
 *   PLUTO (property facts)                 — 64uk-42ks
 *   HPD Multiple Dwelling Registrations     — tesw-yqqr
 *   HPD Registration Contacts               — feu5-w2e2
 *
 * No fabrication: every field either comes directly from a live NYC Open
 * Data response, or is left null. Contact-priority order matches the
 * Neighbor Expansion campaign: Agent > HeadOfficer/CorporateOwner >
 * IndividualOwner. SiteManager-type HPD contacts (closest public-data proxy
 * for a building super) are captured separately into `super_name` when
 * present; condo/co-op board contacts are not published anywhere in NYC
 * Open Data, so `board_contact_name` stays null unless a later enrichment
 * step (Apollo/Prospeo/manual) fills it in — this is disclosed to the UI via
 * the `dataGaps` field on each run result, not silently hidden.
 */

/* global fetch, console */

const SOCRATA_BASE = 'https://data.cityofnewyork.us/resource';
const PLUTO_DATASET = '64uk-42ks';
const HPD_REG_DATASET = 'tesw-yqqr';
const HPD_CONTACTS_DATASET = 'feu5-w2e2';

const BOROUGH_CODE_TO_LETTER = { 1: 'MN', 2: 'BX', 3: 'BK', 4: 'QN', 5: 'SI' };
const BOROUGH_NAME_TO_CODE = { MANHATTAN: 1, BRONX: 2, BROOKLYN: 3, QUEENS: 4, 'STATEN ISLAND': 5 };

async function socrataGet(dataset, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${SOCRATA_BASE}/${dataset}.json?${qs}`;
  const headers = {};
  if (process.env.NYC_OPEN_DATA_APP_TOKEN) headers['X-App-Token'] = process.env.NYC_OPEN_DATA_APP_TOKEN;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Socrata ${dataset} request failed: ${resp.status} ${text.slice(0, 300)}`);
  }
  return resp.json();
}

/**
 * Classify a PLUTO row against Camelot's target-property-type criteria.
 * Mirrors the filter validated in the Neighbor Expansion campaign, with the
 * unit-count floor raised to 10+ per this request.
 */
function classifyAndFilter(row, minUnits) {
  const landuse = String(row.landuse || '').trim();
  const bldgclass = String(row.bldgclass || '').trim().toUpperCase();
  const numFloors = Number(row.numfloors || 0);
  const unitsTotal = Number(row.unitstotal || 0);

  if (bldgclass.startsWith('H')) return null; // hotel — excluded regardless of landuse
  if (unitsTotal < minUnits) return null;

  let category = null;
  if (landuse === '2') category = 'multifamily_walkup';
  else if (landuse === '3') category = 'multifamily_elevator';
  else if (landuse === '4') category = 'mixed_use';
  else if (landuse === '5' && numFloors > 0 && numFloors <= 12) category = 'boutique_office';
  else return null; // 1,6,7,8,9,10,11 excluded; landuse 5 >12 floors excluded

  // Condo/co-op refinement from bldgclass first letter (R = condo, C/D co-op-coded in many cases;
  // kept as a label refinement only — inclusion is governed by landuse above, not this).
  if (bldgclass.startsWith('R')) category = 'condo';
  else if (bldgclass === 'C6' || bldgclass === 'D4' || bldgclass === 'D0') category = 'coop';

  return category;
}

const VALID_BOROUGH_LETTERS = new Set(['MN', 'BX', 'BK', 'QN', 'SI']);

/**
 * Run a city-wide PLUTO search for the target property types, paginated.
 * `borough` optionally scopes to one borough letter (MN/BK/QN/BX/SI).
 */
export async function searchPlutoCitywide({ minUnits = 10, borough = null, limit = 50000, onPage } = {}) {
  const results = [];
  const pageSize = 1000;
  let offset = 0;
  const whereClauses = [`unitstotal >= ${Number(minUnits)}`, `landuse in ('2','3','4','5')`];
  if (borough && VALID_BOROUGH_LETTERS.has(borough)) {
    // Live-verified against the 64uk-42ks dataset (Aug 2026): the `borough` field
    // stores the 2-letter code directly (e.g. "MN"), matching the code used
    // everywhere else in this app/table — no translation needed. (A prior pass
    // assumed full names like "MANHATTAN" here; that returned zero rows for any
    // borough-scoped search — confirmed live and reverted.)
    whereClauses.push(`borough = '${borough}'`);
  }

  while (true) {
    const page = await socrataGet(PLUTO_DATASET, {
      $select: 'bbl,address,borough,block,lot,zipcode,bldgclass,landuse,unitstotal,numfloors,yearbuilt,ownername',
      $where: whereClauses.join(' AND '),
      $limit: String(pageSize),
      $offset: String(offset),
      $order: 'bbl',
    });
    if (!Array.isArray(page) || page.length === 0) break;
    for (const row of page) {
      const category = classifyAndFilter(row, minUnits);
      if (!category) continue;
      results.push({
        bbl: row.bbl,
        address: row.address,
        borough: row.borough,
        block: row.block,
        lot: row.lot,
        zipcode: row.zipcode,
        bldgclass: row.bldgclass,
        landuse: row.landuse,
        unitstotal: Number(row.unitstotal) || null,
        numfloors: row.numfloors ? Number(row.numfloors) : null,
        yearbuilt: row.yearbuilt ? Number(row.yearbuilt) : null,
        ownername: row.ownername || null,
        building_category: category,
      });
    }
    if (onPage) onPage({ offset, pageRows: page.length, matched: results.length });
    offset += pageSize;
    if (page.length < pageSize) break;
    if (results.length >= limit) break;
  }
  return results;
}

/**
 * Resolve HPD registration id + contacts for a batch of leads, keyed by
 * borough+block+lot (HPD registrations are looked up by BBL components, not
 * by BBL string directly, in this dataset).
 *
 * Priority: Agent > HeadOfficer > CorporateOwner > IndividualOwner.
 * SiteManager-type contacts are captured into `super_name` as the closest
 * public-data proxy for an on-site super (NYC Open Data does not publish a
 * dedicated "superintendent" field).
 */
export async function enrichWithHpdContacts(leads, { batchSize = 25, onProgress } = {}) {
  const boroCodeMap = { MN: 1, BX: 2, BK: 3, QN: 4, SI: 5 };

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    // Group by borough so each query can filter boroid + block IN (...) together.
    const byBorough = new Map();
    for (const lead of batch) {
      const boroCode = boroCodeMap[lead.borough] || null;
      if (!boroCode || !lead.block) continue;
      if (!byBorough.has(boroCode)) byBorough.set(boroCode, new Set());
      byBorough.get(boroCode).add(String(Number(lead.block)));
    }

    for (const [boroCode, blockSet] of byBorough) {
      const blocks = Array.from(blockSet);
      let regRows = [];
      try {
        regRows = await socrataGet(HPD_REG_DATASET, {
          $select: 'registrationid,boroid,block,lot,lastregistrationdate',
          $where: `boroid=${boroCode} AND block in(${blocks.join(',')})`,
          $limit: '5000',
        });
      } catch (err) {
        console.error('[LeadsSearch] HPD registration lookup failed:', err.message);
        continue;
      }

      // Keep most recent registration per lot.
      const byLotKey = new Map();
      for (const r of regRows) {
        const key = `${r.block}:${r.lot}`;
        const existing = byLotKey.get(key);
        if (!existing || String(r.lastregistrationdate) > String(existing.lastregistrationdate)) {
          byLotKey.set(key, r);
        }
      }

      const matchedLeads = batch.filter((l) => (boroCodeMap[l.borough] || null) === boroCode);
      const regIds = [];
      for (const lead of matchedLeads) {
        const key = `${Number(lead.block)}:${Number(lead.lot)}`;
        const reg = byLotKey.get(key);
        if (reg) {
          lead.hpd_registration_id = String(reg.registrationid);
          regIds.push(reg.registrationid);
        }
      }

      if (regIds.length === 0) continue;

      let contactRows = [];
      try {
        // Numeric IDs — no quoting needed (raises safe batch size, per Neighbor
        // Expansion campaign findings).
        contactRows = await socrataGet(HPD_CONTACTS_DATASET, {
          $select: 'registrationid,type,firstname,lastname,corporationname,businesshousenumber,businessstreetname,businessapartment,businesscity,businessstate,businesszip',
          $where: `registrationid in(${regIds.join(',')})`,
          $limit: '5000',
        });
      } catch (err) {
        console.error('[LeadsSearch] HPD contacts lookup failed:', err.message);
        continue;
      }

      const contactsByReg = new Map();
      for (const c of contactRows) {
        const key = String(c.registrationid);
        if (!contactsByReg.has(key)) contactsByReg.set(key, []);
        contactsByReg.get(key).push(c);
      }

      for (const lead of matchedLeads) {
        if (!lead.hpd_registration_id) continue;
        const contacts = contactsByReg.get(lead.hpd_registration_id) || [];
        const agent = contacts.find((c) => c.type === 'Agent');
        const headOfficer = contacts.find((c) => c.type === 'HeadOfficer');
        const corpOwner = contacts.find((c) => c.type === 'CorporateOwner');
        const indivOwner = contacts.find((c) => c.type === 'IndividualOwner');
        const siteManager = contacts.find((c) => c.type === 'SiteManager');

        const best = agent || headOfficer || corpOwner || indivOwner || null;
        if (best) {
          const personName = [best.firstname, best.lastname].filter(Boolean).join(' ').trim();
          lead.management_company = best.corporationname || null;
          lead.management_contact_name = personName || best.corporationname || null;
          lead.management_contact_role = best.type;
          lead.contact_confidence = agent ? 'hpd_agent' : 'hpd_owner';
          const mailingParts = [best.businesshousenumber, best.businessstreetname].filter(Boolean).join(' ');
          lead.mailing_address = [mailingParts, best.businessapartment].filter(Boolean).join(', ') || null;
          lead.mailing_zip = best.businesszip || null;
        } else {
          lead.contact_confidence = 'owner_name_only';
        }

        if (siteManager) {
          lead.super_name = [siteManager.firstname, siteManager.lastname].filter(Boolean).join(' ').trim() || siteManager.corporationname || null;
        }
      }
    }

    if (onProgress) onProgress({ processed: Math.min(i + batchSize, leads.length), total: leads.length });
  }

  // Any lead never touched above (no HPD registration match at all).
  for (const lead of leads) {
    if (!lead.contact_confidence) lead.contact_confidence = 'owner_name_only';
  }

  return leads;
}

const STREET_ABBREV = {
  street: 'st', avenue: 'ave', av: 'ave', road: 'rd', place: 'pl', boulevard: 'blvd',
  drive: 'dr', lane: 'ln', court: 'ct', terrace: 'ter', parkway: 'pkwy', square: 'sq',
  east: 'e', west: 'w', north: 'n', south: 's',
};
const ORDINAL_WORDS = {
  first: '1', second: '2', third: '3', fourth: '4', fifth: '5', sixth: '6',
  seventh: '7', eighth: '8', ninth: '9', tenth: '10', eleventh: '11', twelfth: '12',
};

/** Normalize a street name for matching (drop house number, strip ordinal suffixes/words). */
function normalizeStreetName(address) {
  if (!address) return '';
  let s = String(address).toLowerCase().trim();
  s = s.replace(/^[\d-]+\s+/, ''); // drop leading house number (incl. Queens-style "43-33 ")
  s = s.replace(/(\d+)(st|nd|rd|th)\b/g, '$1'); // "9th" -> "9"
  s = s.replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.split(' ').map((w) => ORDINAL_WORDS[w] || STREET_ABBREV[w] || w).join(' ');
}

/** Parse the leading house number off a PLUTO-style address (Queens "43-33" -> 43). */
function parseHouseNumber(address) {
  const m = String(address || '').trim().match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

/** PLUTO-style address normalizer for the anchor side of the match (Spire addresses
 * use ordinal words/suffixes PLUTO doesn't — "788 Ninth Avenue" needs to become
 * "788 9 AVENUE" to have any chance of matching). This mirrors the normalizer
 * validated address-by-address in the one-off Neighbor Expansion campaign. */
const ANCHOR_ORDINAL_WORDS = {
  first: '1', second: '2', third: '3', fourth: '4', fifth: '5', sixth: '6',
  seventh: '7', eighth: '8', ninth: '9', tenth: '10', eleventh: '11', twelfth: '12',
  thirteenth: '13', fourteenth: '14', fifteenth: '15',
};
function plutoStyleAddress(rawAddress) {
  if (!rawAddress) return null;
  let s = String(rawAddress).toUpperCase().trim();
  s = s.split(',')[0]; // drop city/state/zip if present
  s = s.replace(/\s+to\s+\S+/i, ' '); // "61-05 To 61-09 39th Avenue" -> "61-05 39th Avenue"
  s = s.replace(/(\d+)(ST|ND|RD|TH)\b/g, '$1'); // "9TH" -> "9"
  s = s.replace(/[.#]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.split(' ').map((w) => ANCHOR_ORDINAL_WORDS[w.toLowerCase()] || w).join(' ');
}

/** City hints -> likely PLUTO borough 2-letter code, used to scope the geocoding query
 * per anchor. Live-verified against the 64uk-42ks dataset (Aug 2026): `borough` stores
 * the 2-letter code (e.g. "MN") directly — no full-name translation needed or accepted. */
function guessBoroughFromCity(city) {
  const c = String(city || '').toUpperCase().trim();
  if (!c) return null;
  if (c === 'BROOKLYN') return 'BK';
  if (['LONG ISLAND CITY', 'WOODSIDE', 'FLUSHING', 'KEW GARDENS', 'ASTORIA', 'JACKSON HEIGHTS'].some((n) => c.includes(n))) return 'QN';
  if (c.includes('BRONX')) return 'BX';
  if (c.includes('STATEN')) return 'SI';
  if (['NEW YORK', 'NY', 'MANHATTAN'].includes(c)) return 'MN';
  return null; // unknown — geocode will fall back to a citywide (unscoped) lookup
}

/**
 * Resolve Camelot's managed-portfolio anchors (from the `buildings` table,
 * itself synced from Spire MDS + RealtyMX — see portfolio-sync.mjs) to
 * PLUTO borough/block/lot, since Spire doesn't carry BBL data. Best-effort:
 * an anchor that can't be confidently geocoded is dropped from the anchor
 * set (not fabricated), same approach used in the one-off campaign, where
 * 9 of 40 anchors didn't resolve.
 */
export async function geocodeAnchorsToPluto(anchorBuildings) {
  const resolved = [];
  const unresolved = [];
  for (const b of anchorBuildings) {
    const plutoAddr = plutoStyleAddress(b.address);
    if (!plutoAddr) { unresolved.push({ ...b, reason: 'no address on file' }); continue; }
    const boroughGuess = guessBoroughFromCity(b.city);
    const whereClauses = [`address = '${plutoAddr.replace(/'/g, "''")}'`];
    if (boroughGuess) whereClauses.push(`borough = '${boroughGuess}'`);
    try {
      let rows = await socrataGet(PLUTO_DATASET, {
        $select: 'bbl,borough,block,lot,address',
        $where: whereClauses.join(' AND '),
        $limit: '5',
      });
      if ((!rows || rows.length === 0) && boroughGuess) {
        // Retry without the borough guess in case the city field was misleading.
        rows = await socrataGet(PLUTO_DATASET, {
          $select: 'bbl,borough,block,lot,address',
          $where: `address = '${plutoAddr.replace(/'/g, "''")}'`,
          $limit: '5',
        });
      }
      if (rows && rows.length === 1) {
        resolved.push({
          name: b.building_name || b.address,
          address: b.address,
          // PLUTO's `borough` field is already the 2-letter code (e.g. "MN") —
          // used directly, matching the same convention as searchPlutoCitywide().
          borough: rows[0].borough || null,
          block: rows[0].block,
          lot: rows[0].lot,
          bbl: rows[0].bbl,
        });
      } else if (rows && rows.length > 1) {
        unresolved.push({ ...b, reason: `ambiguous — ${rows.length} PLUTO matches for "${plutoAddr}"` });
      } else {
        unresolved.push({ ...b, reason: `no PLUTO match for "${plutoAddr}"` });
      }
    } catch (err) {
      unresolved.push({ ...b, reason: `PLUTO lookup failed: ${err.message}` });
    }
  }
  return { resolved, unresolved };
}

/**
 * Given city-wide PLUTO leads and Camelot's live managed-portfolio anchors
 * (already geocoded via geocodeAnchorsToPluto), tag each lead as
 * 'same_block' or 'across_street' relative to the nearest anchor(s), same
 * heuristic validated in the one-off Neighbor Expansion campaign: same
 * block = same borough+block; across-street = same normalized street name,
 * opposite odd/even house-number parity, block within +/-2, excluding the
 * anchor's own block. Leads matching no anchor are left untagged
 * (relationship null) — they still pass the property-type/unit filter,
 * just aren't "neighbors" of a specific Camelot building.
 */
export function tagNeighborRelationships(leads, anchors) {
  const anchorsByBoroughBlock = new Map();
  for (const a of anchors) {
    if (!a.borough || !a.block) continue;
    const key = `${a.borough}:${Number(a.block)}`;
    if (!anchorsByBoroughBlock.has(key)) anchorsByBoroughBlock.set(key, []);
    anchorsByBoroughBlock.get(key).push(a);
  }

  for (const lead of leads) {
    if (!lead.borough || !lead.block) continue;
    const leadBlock = Number(lead.block);
    const sameBlockKey = `${lead.borough}:${leadBlock}`;
    const sameBlockAnchors = anchorsByBoroughBlock.get(sameBlockKey) || [];

    if (sameBlockAnchors.length > 0) {
      lead.relationship = 'same_block';
      lead.nearest_camelot_buildings = [...new Set(sameBlockAnchors.map((a) => a.name || a.address))];
      continue;
    }

    // Across-street: same normalized street name, opposite parity, block +/-2.
    const leadStreet = normalizeStreetName(lead.address);
    const leadHouseNum = parseHouseNumber(lead.address);
    if (!leadStreet || leadHouseNum === null) continue;

    const matches = [];
    for (let db = -2; db <= 2; db++) {
      if (db === 0) continue;
      const key = `${lead.borough}:${leadBlock + db}`;
      const candidates = anchorsByBoroughBlock.get(key) || [];
      for (const a of candidates) {
        const aStreet = normalizeStreetName(a.address);
        const aHouseNum = parseHouseNumber(a.address);
        if (aStreet !== leadStreet || aHouseNum === null) continue;
        if (leadHouseNum % 2 === aHouseNum % 2) continue; // need opposite parity
        matches.push(a);
      }
    }
    if (matches.length > 0) {
      lead.relationship = 'across_street';
      lead.nearest_camelot_buildings = [...new Set(matches.map((a) => a.name || a.address))];
    }
  }
  return leads;
}

/**
 * Full run: search + enrich, returning leads in the shape the
 * `neighborhood_leads` table expects plus a summary and disclosed data gaps.
 *
 * When `anchorBuildings` is supplied (raw rows from Camelot's `buildings`
 * table, itself synced from Spire MDS + RealtyMX), they are first geocoded
 * to PLUTO borough/block/lot (Spire has no BBL data), then leads are tagged
 * with their relationship ('same_block' | 'across_street') to the nearest
 * anchor building(s) — this is what makes the search "neighborhood" leads
 * rather than a bare city-wide property list. Leads that don't neighbor any
 * anchor are still returned (still real, still filtered to the target
 * property types) but with relationship left null; the citywide search is
 * still useful in its own right when the caller isn't scoping to anchors.
 */
export async function runCitywideLeadSearch({ minUnits = 10, borough = null, limit = 5000, anchorBuildings = [], onProgress } = {}) {
  const runId = `run_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const plutoResults = await searchPlutoCitywide({ minUnits, borough, limit, onPage: onProgress });
  await enrichWithHpdContacts(plutoResults, { onProgress });

  let anchorResolution = null;
  if (anchorBuildings.length > 0) {
    const { resolved, unresolved } = await geocodeAnchorsToPluto(anchorBuildings);
    anchorResolution = { attempted: anchorBuildings.length, resolved: resolved.length, unresolved: unresolved.map((u) => ({ name: u.building_name || u.address, reason: u.reason })) };
    if (resolved.length > 0) tagNeighborRelationships(plutoResults, resolved);
  }

  const leads = plutoResults.map((r) => ({
    bbl: r.bbl,
    address: r.address,
    borough: r.borough,
    block: r.block,
    lot: r.lot,
    zip_code: r.zipcode,
    bldg_class: r.bldgclass,
    land_use: r.landuse,
    units_total: r.unitstotal,
    num_floors: r.numfloors,
    year_built: r.yearbuilt,
    building_category: r.building_category,
    owner_name: r.ownername,
    hpd_registration_id: r.hpd_registration_id || null,
    management_company: r.management_company || null,
    management_contact_name: r.management_contact_name || null,
    management_contact_role: r.management_contact_role || null,
    super_name: r.super_name || null,
    board_contact_name: null, // not published in NYC Open Data — see dataGaps
    mailing_address: r.mailing_address || null,
    mailing_zip: r.mailing_zip || null,
    contact_confidence: r.contact_confidence || 'owner_name_only',
    relationship: r.relationship || null,
    nearest_camelot_buildings: r.nearest_camelot_buildings || null,
    source_run_id: runId,
    status: 'new',
  }));

  const confidenceBreakdown = leads.reduce((acc, l) => {
    acc[l.contact_confidence] = (acc[l.contact_confidence] || 0) + 1;
    return acc;
  }, {});
  const relationshipBreakdown = leads.reduce((acc, l) => {
    const key = l.relationship || 'unrelated_to_anchor';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const dataGaps = [
    'Condo/co-op board contact names are not published in any NYC Open Data source — board_contact_name is always null from this pipeline. Board contacts, when needed, must come from manual research or a paid data source.',
    'HPD does not publish phone numbers — only mailing addresses and, for Agent-type contacts, a named person or company.',
    'super_name is populated only when HPD\'s SiteManager contact type is present for a registration — not every building has one on file.',
    'contact_email is never populated by this pipeline — HPD/PLUTO have no email field. Use the Apollo/Prospeo enrichment step, or manual lookup, before sending.',
  ];
  if (anchorResolution) {
    dataGaps.push(`Anchor geocoding: ${anchorResolution.resolved}/${anchorResolution.attempted} Camelot-managed buildings resolved to a PLUTO BBL for neighbor matching (Spire has no BBL data, so this is address-matched each run). ${anchorResolution.unresolved.length} could not be geocoded confidently — see anchorResolution.unresolved for reasons.`);
  }

  return {
    runId,
    leads,
    summary: {
      totalFound: leads.length,
      minUnits,
      borough: borough || 'citywide',
      confidenceBreakdown,
      relationshipBreakdown,
    },
    anchorResolution,
    dataGaps,
  };
}
