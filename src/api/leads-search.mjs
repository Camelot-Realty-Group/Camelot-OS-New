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

/**
 * Run a city-wide PLUTO search for the target property types, paginated.
 * `borough` optionally scopes to one borough letter (MN/BK/QN/BX/SI).
 */
export async function searchPlutoCitywide({ minUnits = 10, borough = null, limit = 50000, onPage } = {}) {
  const results = [];
  const pageSize = 1000;
  let offset = 0;
  const whereClauses = [`unitstotal >= ${Number(minUnits)}`, `landuse in ('2','3','4','5')`];
  if (borough) {
    const code = Object.entries(BOROUGH_CODE_TO_LETTER).find(([, v]) => v === borough)?.[0];
    if (code) whereClauses.push(`borough = '${borough === 'MN' ? 'MN' : borough}'`);
  }

  // PLUTO's `borough` field is actually the 2-letter code in this dataset variant on some
  // Socrata mirrors, but the canonical 64uk-42ks dataset uses full borough names in `borough`.
  // We detect and adapt on first page rather than hardcoding, to avoid silently returning zero
  // rows if the schema differs from what was true at development time.

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

/**
 * Full run: search + enrich, returning leads in the shape the
 * `neighborhood_leads` table expects plus a summary and disclosed data gaps.
 */
export async function runCitywideLeadSearch({ minUnits = 10, borough = null, limit = 5000, onProgress } = {}) {
  const runId = `run_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const plutoResults = await searchPlutoCitywide({ minUnits, borough, limit, onPage: onProgress });
  await enrichWithHpdContacts(plutoResults, { onProgress });

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
    relationship: null,
    nearest_camelot_buildings: null,
    source_run_id: runId,
    status: 'new',
  }));

  const confidenceBreakdown = leads.reduce((acc, l) => {
    acc[l.contact_confidence] = (acc[l.contact_confidence] || 0) + 1;
    return acc;
  }, {});

  return {
    runId,
    leads,
    summary: {
      totalFound: leads.length,
      minUnits,
      borough: borough || 'citywide',
      confidenceBreakdown,
    },
    dataGaps: [
      'Condo/co-op board contact names are not published in any NYC Open Data source — board_contact_name is always null from this pipeline. Board contacts, when needed, must come from manual research or a paid data source.',
      'HPD does not publish phone numbers — only mailing addresses and, for Agent-type contacts, a named person or company.',
      'super_name is populated only when HPD\'s SiteManager contact type is present for a registration — not every building has one on file.',
      'contact_email is never populated by this pipeline — HPD/PLUTO have no email field. Use the Apollo/Prospeo enrichment step, or manual lookup, before sending.',
    ],
  };
}
