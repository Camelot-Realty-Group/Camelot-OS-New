/**
 * Portfolio Benchmark Engine
 *
 * Computes p25/p50/p75 cost-per-unit bands per (category, building_type,
 * size_band, year) cell from categorized AP actuals, and upserts them into
 * `portfolio_benchmarks` (see 019_portfolio_benchmarks.sql).
 *
 * -----------------------------------------------------------------------
 * WHY COST-PER-UNIT
 * Raw dollars are not comparable across buildings of different sizes. A 12-unit
 * building spending $8,000/yr on elevator maintenance and a 120-unit building
 * spending $80,000/yr may both be perfectly priced — the comparison that
 * matters is dollars per unit. CPU(b,c) = AnnualCost(b,c) / Units(b).
 *
 * WHY PERCENTILE BANDS
 * p25 = target price (what the cheaper quarter of comparable buildings pay —
 *       the number a savings pitch should aim a building toward).
 * p50 = market / median.
 * p75 = overpayment line (a building above this is a strong pitch candidate).
 *
 * WHY THE COMPARABILITY GUARD
 * A "benchmark" computed from 2 buildings is not a benchmark, it's an anecdote.
 * Every cell requires >= MIN_COMPARABLE_BUILDINGS distinct buildings before it
 * is marked sample_confidence='portfolio_referenced'. Below that, the engine
 * still computes the numbers (useful for internal review) but flags the cell
 * 'market_referenced' so no report layer cites it as portfolio evidence.
 *
 * WHY ONLY ADDRESSABLE SPEND
 * This module trusts vendor-category-map.mjs's `addressable` flag completely.
 * Non-addressable spend (debt service, taxes, capital projects, management
 * fees, inter-entity transfers, individual labor, unmapped) must never reach
 * a benchmark cell — see ADDRESSABLE-SPEND-FINDING.md for why that distinction
 * exists and what happens commercially if it's ignored.
 * -----------------------------------------------------------------------
 */

import { categorizeVendor } from './vendor-category-map.mjs';

/* global console */

export const MIN_COMPARABLE_BUILDINGS = 4;

/** Size bands, in ascending order. Matches REVENUE-STRATEGY-AND-PRICE-FIX-FORMULA.md. */
const SIZE_BANDS = [
  { label: '<10', min: 0, max: 9 },
  { label: '10-25', min: 10, max: 25 },
  { label: '26-50', min: 26, max: 50 },
  { label: '51-100', min: 51, max: 100 },
  { label: '100+', min: 101, max: Infinity },
];

export function sizeBandFor(unitsTotal) {
  const n = Number(unitsTotal);
  if (!Number.isFinite(n) || n <= 0) return 'unknown';
  const band = SIZE_BANDS.find((b) => n >= b.min && n <= b.max);
  return band ? band.label : 'unknown';
}

/** Normalize a building's raw type string into the three buckets the taxonomy uses. */
export function normalizeBuildingType(raw) {
  const s = String(raw || '').toLowerCase();
  if (/coop|co-op|condo/.test(s)) return 'coop_condo';
  if (/rental|rent/.test(s)) return 'rental';
  if (/mixed/.test(s)) return 'mixed';
  return 'unknown';
}

/**
 * Percentile via linear interpolation (same convention as numpy's default
 * 'linear' method), so results are reproducible against a spot-check in Excel
 * or Python without surprises.
 *
 * @param {number[]} sortedValues  MUST already be sorted ascending — this
 *   function does not sort for you (computeBenchmarks always sorts before
 *   calling this; call it directly with unsorted input and you'll get a
 *   silently wrong answer, not an error).
 */
export function percentile(sortedValues, p) {
  if (!sortedValues.length) return null;
  if (sortedValues.length === 1) return sortedValues[0];
  const idx = (p / 100) * (sortedValues.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  const frac = idx - lo;
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * frac;
}

/**
 * Build cost-per-unit observations from voucher-level AP data + a building
 * lookup, one observation per (building, category, year).
 *
 * @param {Array} vouchers        rows from spireClient.getApVouchers()
 * @param {Map|object} buildingsByCompanyRcd  CompanyRcd -> {unitsTotal, buildingType, buildingName}
 * @returns {Array<{category, buildingType, sizeBand, year, buildingKey, costPerUnit, amount, units}>}
 */
export function buildCpuObservations(vouchers, buildingsByCompanyRcd) {
  const lookup = buildingsByCompanyRcd instanceof Map
    ? buildingsByCompanyRcd
    : new Map(Object.entries(buildingsByCompanyRcd || {}));

  // Accumulate raw spend per (building, category, year) first, same grain as
  // rollUpByCategory in vendor-category-map.mjs, then divide by units once.
  const cells = new Map();
  const catCache = new Map();
  const cat = (name) => {
    if (!catCache.has(name)) catCache.set(name, categorizeVendor(name));
    return catCache.get(name);
  };

  for (const v of vouchers) {
    const amount = Math.abs(Number(v.InvoiceAmount) || 0);
    if (!amount) continue;
    const c = cat(v.VendorName);
    if (!c.addressable) continue; // the load-bearing guard

    const companyRcd = v.CompanyRcd;
    const building = lookup.get(companyRcd) ?? lookup.get(String(companyRcd));
    if (!building || !building.unitsTotal) continue; // can't compute CPU without units

    const year = String(v.InvoiceDate || '').slice(0, 4) || 'unknown';
    const key = `${companyRcd}|${c.category}|${year}`;
    if (!cells.has(key)) {
      cells.set(key, {
        category: c.category,
        buildingType: normalizeBuildingType(building.buildingType),
        sizeBand: sizeBandFor(building.unitsTotal),
        year,
        buildingKey: companyRcd,
        buildingName: building.buildingName,
        amount: 0,
        units: building.unitsTotal,
      });
    }
    cells.get(key).amount += amount;
  }

  return [...cells.values()].map((c) => ({
    ...c,
    amount: Math.round(c.amount),
    costPerUnit: Math.round((c.amount / c.units) * 100) / 100,
  }));
}

/**
 * Compute p25/p50/p75 benchmark cells from CPU observations, grouped by
 * (category, buildingType, sizeBand, year).
 *
 * @param {Array} observations  output of buildCpuObservations()
 * @returns {Array<{category, buildingType, sizeBand, year, p25CostPerUnit, p50CostPerUnit, p75CostPerUnit, buildingCount, sampleConfidence, totalSpend}>}
 */
export function computeBenchmarks(observations) {
  const groups = new Map();
  for (const o of observations) {
    const key = `${o.category}|${o.buildingType}|${o.sizeBand}|${o.year}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }

  const results = [];
  for (const [key, obs] of groups) {
    const [category, buildingType, sizeBand, year] = key.split('|');
    // One value per distinct building — if a building has multiple entries
    // somehow, that would be a bug upstream, but guard anyway by keying on
    // buildingKey and taking the max (shouldn't happen given the grain above).
    const byBuilding = new Map();
    for (const o of obs) byBuilding.set(o.buildingKey, o);
    const values = [...byBuilding.values()].map((o) => o.costPerUnit).sort((a, b) => a - b);
    const buildingCount = values.length;
    const totalSpend = obs.reduce((s, o) => s + o.amount, 0);

    results.push({
      category,
      buildingType,
      sizeBand,
      year: Number(year) || year,
      p25CostPerUnit: percentile(values, 25),
      p50CostPerUnit: percentile(values, 50),
      p75CostPerUnit: percentile(values, 75),
      buildingCount,
      sampleConfidence: buildingCount >= MIN_COMPARABLE_BUILDINGS ? 'portfolio_referenced' : 'market_referenced',
      totalSpend: Math.round(totalSpend),
    });
  }

  return results.sort((a, b) =>
    a.category.localeCompare(b.category) ||
    a.buildingType.localeCompare(b.buildingType) ||
    a.sizeBand.localeCompare(b.sizeBand) ||
    String(b.year).localeCompare(String(a.year))
  );
}

/**
 * Full pipeline: vouchers + building metadata -> benchmark rows ready to
 * upsert into portfolio_benchmarks.
 */
export function buildPortfolioBenchmarks(vouchers, buildingsByCompanyRcd) {
  const observations = buildCpuObservations(vouchers, buildingsByCompanyRcd);
  return computeBenchmarks(observations);
}

/**
 * Upsert benchmark rows into Supabase. Server-only — requires a Supabase
 * client configured with SUPABASE_SERVICE_ROLE_KEY (RLS on portfolio_benchmarks
 * blocks anon writes; see 019_portfolio_benchmarks.sql section 4).
 *
 * @param {object} supabase  a Supabase JS client
 * @param {Array} benchmarkRows  output of buildPortfolioBenchmarks()
 * @returns {Promise<{inserted:number, errors:Array}>}
 */
export async function upsertBenchmarks(supabase, benchmarkRows) {
  const errors = [];
  let inserted = 0;

  for (const row of benchmarkRows) {
    const { error } = await supabase
      .from('portfolio_benchmarks')
      .upsert(
        {
          category: row.category,
          building_type: row.buildingType,
          size_band: row.sizeBand,
          year: row.year,
          p25_cost_per_unit: row.p25CostPerUnit,
          p50_cost_per_unit: row.p50CostPerUnit,
          p75_cost_per_unit: row.p75CostPerUnit,
          building_count: row.buildingCount,
          sample_confidence: row.sampleConfidence,
          total_spend: row.totalSpend,
          computed_at: new Date().toISOString(),
          computed_from: 'ap_actuals',
        },
        { onConflict: 'category,building_type,size_band,year' }
      );

    if (error) {
      errors.push({ row: `${row.category}/${row.buildingType}/${row.sizeBand}/${row.year}`, error: error.message });
    } else {
      inserted += 1;
    }
  }

  if (errors.length) {
    console.error(`upsertBenchmarks: ${errors.length} cell(s) failed`, errors);
  }

  return { inserted, errors };
}
