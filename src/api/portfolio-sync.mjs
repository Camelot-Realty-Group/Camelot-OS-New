/**
 * Portfolio Sync Engine — Spire MDS -> Supabase, with optional RealtyMX enrichment.
 *
 * Server-only. Pulls Camelot's full managed portfolio from Spire and upserts it
 * into the `buildings` table so every other part of Camelot OS (Cost
 * Optimization, Cost-Beat reports, proposals) reads from one canonical list
 * instead of hand-entered data.
 *
 * Verified against live Spire on 2026-08-15: 41 buildings returned.
 *
 * Requires migration 018_portfolio_sync.sql.
 */

import { createSpireClient } from './spire-client.mjs';
import { createRealtyMxClient, realtyMxStreetLine } from './realtymx-client.mjs';

/* global console, process */

// ---------------------------------------------------------------------------
// Address normalization — used to match Spire buildings against RealtyMX rows.
// Deliberately conservative: we would rather fail to match than mis-match a
// building and attach the wrong market data to a client's cost report.
//
// Tuned against the real data on 2026-08-15 (41 Spire buildings vs 200 RealtyMX
// buildings). Exact-only matching hit 33/41; adding ordinal-word normalization
// ("788 Ninth Avenue" == "788 9th Ave") and suffix-insensitive core matching
// ("68 Thomas Street" == "68 Thomas") took it to 37/41.
// ---------------------------------------------------------------------------

const STREET_ABBREV = {
  street: 'st', st: 'st',
  avenue: 'ave', ave: 'ave', av: 'ave',
  road: 'rd', rd: 'rd',
  place: 'pl', pl: 'pl',
  boulevard: 'blvd', blvd: 'blvd',
  drive: 'dr', dr: 'dr',
  lane: 'ln', ln: 'ln',
  court: 'ct', ct: 'ct',
  terrace: 'ter', ter: 'ter',
  parkway: 'pkwy', pkwy: 'pkwy',
  square: 'sq', sq: 'sq',
  east: 'e', e: 'e',
  west: 'w', w: 'w',
  north: 'n', n: 'n',
  south: 's', s: 's',
};

/** Spelled-out ordinals -> numeric. Spire writes "Ninth Avenue", RealtyMX "9th Ave". */
const ORDINAL_WORDS = {
  first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th',
  sixth: '6th', seventh: '7th', eighth: '8th', ninth: '9th', tenth: '10th',
  eleventh: '11th', twelfth: '12th',
};

const STREET_SUFFIXES = new Set(['st', 'ave', 'rd', 'pl', 'blvd', 'dr', 'ln', 'ct', 'ter', 'pkwy', 'sq']);

export function normalizeAddress(raw) {
  if (!raw) return '';
  let s = String(raw).toLowerCase().trim();
  // Drop anything after a comma (city/state/zip) — we compare street lines only.
  s = s.split(',')[0];
  // "61-05 To 61-09 39th Avenue" -> take the first address in a range.
  s = s.replace(/\s+to\s+\S+/i, ' ');
  s = s.replace(/[.#]/g, ' ');
  s = s.replace(/[^a-z0-9\- ]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s
    .split(' ')
    .map((word) => ORDINAL_WORDS[word] || STREET_ABBREV[word] || word)
    .join(' ')
    .trim();
}

/** Extract the leading house number ("43-33", "105") for a cheap pre-filter. */
function houseNumber(normalized) {
  const m = normalized.match(/^([0-9]+(?:-[0-9]+)?)/);
  return m ? m[1] : '';
}

/**
 * House number + street name with the street-type suffix removed, so
 * "68 thomas st" and "68 thomas" collapse to the same key. Still anchored on the
 * house number, so this cannot collapse two different buildings on one street.
 */
export function addressCore(normalized) {
  if (!normalized) return '';
  const parts = normalized.split(' ');
  const hn = houseNumber(normalized);
  const rest = parts.slice(hn ? 1 : 0).filter((w) => !STREET_SUFFIXES.has(w));
  return `${hn} ${rest.join(' ')}`.trim();
}

/**
 * Buildings whose address genuinely differs between Spire and RealtyMX, verified
 * by hand on 2026-08-15. Without these, the sync would report them as "missing
 * from RealtyMX" forever. Keyed by normalized Spire address -> RealtyMX id.
 *
 *  • East of East Condo Corp — Spire "13-10 Jackson Avenue",
 *    RealtyMX #1240 "13-14 Jackson Avenue" ("East of East Lofts"), both 13 units.
 *  • Park Manhattan Condominium — Spire "411-417-421 Manhattan Avenue",
 *    RealtyMX #1229 "417 Manhattan Avenue".
 */
export const REALTYMX_ID_OVERRIDES = {
  '13-10 jackson ave': 1240,
  '411-417-421 manhattan ave': 1229,
};

// ---------------------------------------------------------------------------
// Spire row -> buildings row
// ---------------------------------------------------------------------------

function toIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function nonEmpty(...values) {
  for (const v of values) {
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

/**
 * Resolve which Spire "company" a building belongs to. This matters more than it
 * looks: GL/Budgets and GL/GLSummary are keyed by CompanyRcd, so a building
 * without one cannot have any financial data pulled for it.
 */
function resolveCompany(row) {
  const rental = toIntOrNull(row.RentalCompanyRcd);
  const coopCondo = toIntOrNull(row.CoopCondoCompanyRcd);
  if (rental && rental > 0) {
    return { rcd: rental, kind: 'rental', name: nonEmpty(row.RentalCompanyName) };
  }
  if (coopCondo && coopCondo > 0) {
    return { rcd: coopCondo, kind: 'coop_condo', name: nonEmpty(row.CoopCondoCompanyName) };
  }
  return { rcd: null, kind: 'unknown', name: null };
}

export function mapSpireBuilding(row) {
  const company = resolveCompany(row);
  const buildingRcd = toIntOrNull(row.BuildingRcd ?? row.ID);

  // mds_code is NOT NULL UNIQUE in the schema. BuildingNumber is the human MDS
  // code (e.g. "048"); fall back to the record id so the row is never rejected.
  const mdsCode = nonEmpty(row.BuildingNumber) || (buildingRcd ? `SPIRE-${buildingRcd}` : null);

  const resUnits = toIntOrNull(row.NumberOfResidentialUnits);
  const comUnits = toIntOrNull(row.NumberOfCommercialUnits);
  const totalUnits = toIntOrNull(row.TotalUnits ?? row.NumberOfUnits ?? row.Units);

  return {
    mds_code: mdsCode,
    spire_building_rcd: buildingRcd,
    spire_company_rcd: company.rcd,
    spire_company_kind: company.kind,
    company_name: company.name,
    building_name:
      nonEmpty(row.RentalBuildingName, row.CoopCondoCompanyName, row.BuildingNumber) || 'Unnamed building',
    address: nonEmpty(row.Address, row.Address1),
    city: nonEmpty(row.City),
    state: nonEmpty(row.State),
    zip_code: nonEmpty(row.ZipCode),
    building_type: company.kind === 'coop_condo' ? 'Condo/Co-op' : company.kind === 'rental' ? 'Rental' : 'Unknown',
    units_residential: resUnits,
    units_commercial: comUnits,
    units_total: totalUnits ?? (((resUnits || 0) + (comUnits || 0)) || null),
    occupant_count: toIntOrNull(row.NumberOfOccupants ?? row.Occupants),
    property_manager: nonEmpty(row.PropertyManagerName),
    property_manager_email: nonEmpty(row.PropertyManagerEmail),
    superintendent_name: nonEmpty(row.SuperintendentName),
    superintendent_email: nonEmpty(row.SuperintendentEmail),
    superintendent_phone: nonEmpty(row.SuperintendentCellPhone, row.SuperintendentDayPhone),
    sync_source: 'spire',
    is_active: true,
    raw_spire: row,
  };
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

/**
 * @param {object} deps
 * @param {import('@supabase/supabase-js').SupabaseClient} deps.supabase
 * @param {object} [deps.env]
 * @param {string} [deps.triggeredBy]
 * @param {boolean} [deps.enrichWithRealtyMx]
 * @param {Function} [deps.fetchImpl] Injectable purely so this function can be
 *   unit-tested without real network access. Production callers omit it.
 */
export async function runPortfolioSync({
  supabase,
  env = process.env,
  triggeredBy = 'api',
  enrichWithRealtyMx = true,
  fetchImpl = undefined,
} = {}) {
  if (!supabase) throw new Error('runPortfolioSync requires a Supabase client.');

  const startedAt = new Date().toISOString();
  const errors = [];
  const counts = {
    fetched: 0, inserted: 0, updated: 0, unchanged: 0,
    realtymxMatched: 0, realtymxMatchKinds: {},
  };
  /** Camelot buildings with no RealtyMX counterpart — the real sync gap. */
  const missingFromRealtyMx = [];
  /** Buildings where Spire and RealtyMX disagree on unit count. */
  const unitDiscrepancies = [];

  // Open a log row up front so an interrupted run is still visible.
  let logId = null;
  try {
    const { data: logRow, error: logErr } = await supabase
      .from('portfolio_sync_log')
      .insert({ started_at: startedAt, source: 'spire', status: 'running', triggered_by: triggeredBy })
      .select('id')
      .single();
    if (logErr) throw logErr;
    logId = logRow?.id ?? null;
  } catch (err) {
    // A missing log table shouldn't block the actual sync.
    console.warn('[portfolio-sync] Could not open sync log:', err.message);
  }

  async function closeLog(status, notes) {
    if (!logId) return;
    try {
      await supabase.from('portfolio_sync_log').update({
        finished_at: new Date().toISOString(),
        status,
        buildings_fetched: counts.fetched,
        buildings_inserted: counts.inserted,
        buildings_updated: counts.updated,
        buildings_unchanged: counts.unchanged,
        realtymx_matched: counts.realtymxMatched,
        errors,
        notes,
      }).eq('id', logId);
    } catch (err) {
      console.warn('[portfolio-sync] Could not close sync log:', err.message);
    }
  }

  // --- 1. Pull from Spire ---------------------------------------------------
  const spire = createSpireClient({ env, ...(fetchImpl ? { fetchImpl } : {}) });
  if (!spire.isConfigured) {
    const msg = 'Spire is not configured. Set SPIRE_API_KEY and SPIRE_CLIENT_SECRET on the server.';
    errors.push({ stage: 'spire_config', message: msg });
    await closeLog('failed', msg);
    return { ok: false, error: { code: 'SPIRE_NOT_CONFIGURED', message: msg }, counts };
  }

  const spireResult = await spire.listBuildingsRaw();
  if (!spireResult.ok) {
    errors.push({ stage: 'spire_fetch', ...spireResult.error });
    await closeLog('failed', spireResult.error.message);
    return { ok: false, error: spireResult.error, counts };
  }

  const spireRows = spireResult.data.items;
  counts.fetched = spireRows.length;
  if (spireRows.length === 0) {
    await closeLog('success', 'Spire returned zero buildings.');
    return { ok: true, counts, warnings: ['Spire returned zero buildings.'] };
  }

  // --- 2. Optional RealtyMX enrichment -------------------------------------
  // Skipped on the retired sandbox key: those rows are an unrelated demo dataset
  // and matching against them would attach wrong data to real buildings.
  let rmxExact = null;   // normalized full address -> building
  let rmxCore = null;    // suffix-stripped core     -> building
  let rmxById = null;    // id -> building (for the manual overrides)
  let realtyMxNote = null;

  if (enrichWithRealtyMx) {
    const realtymx = createRealtyMxClient({ env, ...(fetchImpl ? { fetchImpl } : {}) });
    if (!realtymx.isConfigured) {
      realtyMxNote = 'RealtyMX enrichment skipped: REALTYMX_API_KEY is not set on the server.';
      console.warn(`[portfolio-sync] ${realtyMxNote}`);
    } else if (realtymx.isDemoMode) {
      realtyMxNote =
        'RealtyMX enrichment skipped: the configured key is the retired public sandbox key, which returns an unrelated demo dataset. Use the production Website API key.';
      console.warn(`[portfolio-sync] ${realtyMxNote}`);
    } else {
      try {
        const rmx = await realtymx.listBuildings({ fetchAll: true });
        if (rmx.ok) {
          rmxExact = new Map();
          rmxCore = new Map();
          rmxById = new Map();
          for (const b of rmx.data.items) {
            if (b?.id !== undefined && b?.id !== null) rmxById.set(Number(b.id), b);
            // RealtyMX splits the street line across house + address.
            const norm = normalizeAddress(realtyMxStreetLine(b));
            if (!norm) continue;
            if (!rmxExact.has(norm)) rmxExact.set(norm, b);
            const core = addressCore(norm);
            if (core && !rmxCore.has(core)) rmxCore.set(core, b);
          }
          console.log(
            `[portfolio-sync] Indexed ${rmxExact.size} RealtyMX buildings `
            + `(${rmx.data.totalCount ?? '?'} reported) for matching.`
          );
        } else {
          realtyMxNote = `RealtyMX fetch failed: ${rmx.error.message}`;
          errors.push({ stage: 'realtymx_fetch', ...rmx.error });
        }
      } catch (err) {
        realtyMxNote = `RealtyMX fetch threw: ${err.message}`;
        errors.push({ stage: 'realtymx_fetch', message: err.message });
      }
    }
  }

  // --- 3. Load existing rows so we can classify insert vs update ------------
  const existingByRcd = new Map();
  try {
    const { data: existing, error: exErr } = await supabase
      .from('buildings')
      .select('id, spire_building_rcd, mds_code, building_name, address, units_total, property_manager');
    if (exErr) throw exErr;
    for (const row of existing || []) {
      if (row.spire_building_rcd !== null && row.spire_building_rcd !== undefined) {
        existingByRcd.set(String(row.spire_building_rcd), row);
      }
    }
  } catch (err) {
    errors.push({ stage: 'load_existing', message: err.message });
    await closeLog('failed', `Could not read existing buildings: ${err.message}`);
    return { ok: false, error: { code: 'DB_READ_FAILED', message: err.message }, counts };
  }

  // --- 4. Map + enrich + upsert --------------------------------------------
  const nowIso = new Date().toISOString();
  const payload = [];

  for (const row of spireRows) {
    let mapped;
    try {
      mapped = mapSpireBuilding(row);
    } catch (err) {
      errors.push({ stage: 'map', buildingRcd: row?.BuildingRcd, message: err.message });
      continue;
    }
    if (!mapped.mds_code) {
      errors.push({ stage: 'map', message: 'Skipped a Spire row with no BuildingNumber or BuildingRcd.' });
      continue;
    }

    mapped.spire_synced_at = nowIso;
    mapped.updated_at = nowIso;

    if (rmxExact && mapped.address) {
      const norm = normalizeAddress(mapped.address);
      let match = null;
      let matchKind = null;

      // Tier 0 — hand-verified override for buildings whose address genuinely
      // differs between the two systems.
      const overrideId = REALTYMX_ID_OVERRIDES[norm];
      if (overrideId && rmxById?.has(overrideId)) {
        match = rmxById.get(overrideId);
        matchKind = 'override';
      }
      // Tier 1 — exact normalized street line.
      if (!match) {
        match = rmxExact.get(norm) || null;
        if (match) matchKind = 'exact';
      }
      // Tier 2 — suffix-insensitive core, still anchored on the house number.
      if (!match) {
        const core = addressCore(norm);
        if (core) {
          match = rmxCore.get(core) || null;
          if (match) matchKind = 'core';
        }
      }

      if (match) {
        mapped.realtymx_building_id = toIntOrNull(match.id);
        mapped.realtymx_synced_at = nowIso;
        mapped.neighborhood = nonEmpty(match.location, match.city);
        // Only fill year_built from RealtyMX when Spire didn't supply one.
        const built = toIntOrNull(match.built);
        if (built && built > 1700 && !mapped.year_built) mapped.year_built = built;
        counts.realtymxMatched += 1;
        counts.realtymxMatchKinds[matchKind] = (counts.realtymxMatchKinds[matchKind] || 0) + 1;

        // Surface unit-count disagreements rather than silently trusting either
        // side — a wrong unit count silently corrupts every per-unit benchmark.
        const rmxUnits = toIntOrNull(match.units);
        if (rmxUnits && mapped.units_total && rmxUnits !== mapped.units_total) {
          unitDiscrepancies.push({
            mds_code: mapped.mds_code,
            building: mapped.building_name,
            address: mapped.address,
            spireUnits: mapped.units_total,
            realtyMxUnits: rmxUnits,
            realtyMxId: mapped.realtymx_building_id,
          });
        }
      } else {
        missingFromRealtyMx.push({
          mds_code: mapped.mds_code,
          building: mapped.building_name,
          address: mapped.address || '(no address in Spire)',
        });
      }
    }

    if (existingByRcd.has(String(mapped.spire_building_rcd))) counts.updated += 1;
    else counts.inserted += 1;

    payload.push(mapped);
  }

  if (payload.length === 0) {
    await closeLog('failed', 'No Spire rows could be mapped.');
    return { ok: false, error: { code: 'NO_ROWS_MAPPED', message: 'No Spire rows could be mapped.' }, counts };
  }

  // Upsert on spire_building_rcd (unique index from migration 018). Chunked so a
  // large portfolio never blows the request size.
  const CHUNK = 100;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { error: upErr } = await supabase
      .from('buildings')
      .upsert(chunk, { onConflict: 'spire_building_rcd' });
    if (upErr) {
      errors.push({ stage: 'upsert', chunkStart: i, message: upErr.message });
      await closeLog('partial', `Upsert failed at chunk ${i}: ${upErr.message}`);
      return { ok: false, error: { code: 'DB_UPSERT_FAILED', message: upErr.message }, counts, errors };
    }
  }

  const status = errors.length > 0 ? 'partial' : 'success';

  const noteParts = [];
  if (realtyMxNote) noteParts.push(realtyMxNote);
  if (missingFromRealtyMx.length) {
    noteParts.push(`${missingFromRealtyMx.length} building(s) have no RealtyMX match.`);
  }
  if (unitDiscrepancies.length) {
    noteParts.push(`${unitDiscrepancies.length} unit-count disagreement(s) between Spire and RealtyMX.`);
  }
  await closeLog(status, noteParts.join(' ') || null);

  const warnings = [];
  if (realtyMxNote) warnings.push(realtyMxNote);
  if (unitDiscrepancies.length) {
    warnings.push(
      `Spire and RealtyMX disagree on unit count for ${unitDiscrepancies.length} building(s). `
      + 'Spire is treated as authoritative; review before using per-unit benchmarks.'
    );
  }

  return {
    ok: true,
    counts,
    status,
    errors,
    warnings,
    missingFromRealtyMx,
    unitDiscrepancies,
    syncedAt: nowIso,
  };
}
