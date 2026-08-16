-- 019_portfolio_benchmarks.sql
-- Camelot OS — Portfolio Benchmark Engine tables
--
-- Formalizes portfolio_benchmarks and savings_audit as real, reproducible
-- migrations. Per the reconciliation note in 015_cost_optimization_contracts_kpis.sql
-- (section 9), these two tables were referenced in strategy docs and created ad
-- hoc directly in the Supabase SQL editor at some point, with no DDL committed
-- to the repo. That means a fresh clone of this Supabase project would not have
-- them. This migration is the authoritative, idempotent definition going
-- forward — CREATE TABLE IF NOT EXISTS, so it is safe to run even if the ad hoc
-- versions already exist (it will not touch their data, only add anything
-- missing).
--
-- ⚠️ RUN 018_portfolio_sync.sql FIRST — this migration's FK on buildings.id and
-- the category taxonomy comment both assume it already ran.
--
-- Populated by portfolio/api/benchmark-engine.mjs, which consumes
-- vendor-category-map.mjs's rollUpByCategory() output. Only `addressable`
-- categories (see vendor-category-map.mjs's ADDRESSABLE set) may ever produce
-- a row here — non-addressable spend (debt service, taxes, capital projects,
-- management fees, inter-entity transfers, individual labor) must never enter
-- a savings benchmark.

-- 1. portfolio_benchmarks --------------------------------------------------------
-- One row per (category, building_type, size_band, year) cell — the p25/p50/p75
-- cost-per-unit bands that Cost-Beat reports and pitch demos read from.

CREATE TABLE IF NOT EXISTS portfolio_benchmarks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category          text NOT NULL,
  -- Mirrors vendor-category-map.mjs OPERATING_CATEGORIES. Only addressable
  -- categories should ever appear here — enforced in application code, not a
  -- DB constraint, so the taxonomy can evolve without a migration each time.
  building_type     text NOT NULL,          -- 'rental' | 'coop_condo' | 'mixed' | 'unknown'
  size_band         text NOT NULL,          -- '<10' | '10-25' | '26-50' | '51-100' | '100+'
  year              integer NOT NULL,
  p25_cost_per_unit numeric NOT NULL,        -- target price for a savings pitch
  p50_cost_per_unit numeric NOT NULL,        -- market / median
  p75_cost_per_unit numeric NOT NULL,        -- overpayment line
  building_count    integer NOT NULL,        -- comparability guard: must be >= 4
  sample_confidence text NOT NULL DEFAULT 'portfolio_referenced'
                      CHECK (sample_confidence IN ('portfolio_referenced', 'market_referenced')),
  -- 'portfolio_referenced' = computed from >= 4 Camelot-managed buildings in
  -- this exact cell (category + building_type + size_band). Below that
  -- threshold the cell must not be published; callers should fall back to a
  -- generic 'market_referenced' estimate instead (sourced outside this table).
  total_spend       numeric,                 -- sum of addressable spend in the cell, for transparency
  computed_at       timestamptz NOT NULL DEFAULT now(),
  computed_from     text DEFAULT 'ap_actuals'
                      CHECK (computed_from IN ('ap_actuals', 'gl_budget', 'blended')),
  notes             text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_benchmarks_cell
  ON portfolio_benchmarks(category, building_type, size_band, year);
CREATE INDEX IF NOT EXISTS idx_portfolio_benchmarks_category ON portfolio_benchmarks(category);
CREATE INDEX IF NOT EXISTS idx_portfolio_benchmarks_computed_at ON portfolio_benchmarks(computed_at DESC);

COMMENT ON TABLE portfolio_benchmarks IS
  'p25/p50/p75 cost-per-unit bands per operating category, building type, and size band. Only addressable operating expense (see vendor-category-map.mjs) may populate this table. sample_confidence=portfolio_referenced requires building_count >= 4; below that, do not cite this row in a client-facing report.';
COMMENT ON COLUMN portfolio_benchmarks.p25_cost_per_unit IS
  'Target price for a savings pitch: Target(b,c) = p25(c,peer) x Units(b).';
COMMENT ON COLUMN portfolio_benchmarks.building_count IS
  'Number of distinct Camelot buildings in this cell. Comparability guard: cells with building_count < 4 must not be marked portfolio_referenced.';

-- 2. savings_audit -----------------------------------------------------------------
-- The evidence layer behind every quarterly savings verification and 35% fee
-- calculation. One row per (building, category, quarter) verification event.

CREATE TABLE IF NOT EXISTS savings_audit (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id         bigint REFERENCES buildings(id),
  category            text NOT NULL,
  quarter             text NOT NULL,          -- e.g. '2026-Q3'
  baseline_cost       numeric NOT NULL,        -- what the building was paying before Camelot intervened
  benchmark_id        uuid REFERENCES portfolio_benchmarks(id),
  target_cost         numeric,                 -- benchmark p25 x units at time of verification
  actual_cost         numeric NOT NULL,        -- verified actual spend this quarter, post-intervention
  verified_savings    numeric NOT NULL,        -- baseline_cost - actual_cost, floored at 0
  fee_pct             numeric NOT NULL DEFAULT 0.35,
  fee_amount          numeric NOT NULL,        -- verified_savings x fee_pct
  verification_method text,                    -- 'ap_actuals' | 'invoice_review' | 'vendor_confirmation'
  verified_by         text,
  verified_at         timestamptz NOT NULL DEFAULT now(),
  contract_id         bigint,                  -- FK to cost_opt_client_contracts once that table's PK type is confirmed
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_savings_audit_building  ON savings_audit(building_id);
CREATE INDEX IF NOT EXISTS idx_savings_audit_quarter   ON savings_audit(quarter);
CREATE INDEX IF NOT EXISTS idx_savings_audit_contract  ON savings_audit(contract_id);

COMMENT ON TABLE savings_audit IS
  'Evidence layer for quarterly, recurring 35%-of-verified-savings billing. One row per building/category/quarter verification. Referenced by cost_opt_quarterly_verifications.savings_audit_id (see 015_cost_optimization_contracts_kpis.sql) — promote that column to a real FK now that this table exists.';
COMMENT ON COLUMN savings_audit.verified_savings IS
  'baseline_cost - actual_cost, floored at 0. Never negative — a building that got more expensive shows 0 savings, not a negative fee.';

-- 3. Convenience view for the pitch-demo / Cost-Beat report builder ----------------

CREATE OR REPLACE VIEW portfolio_benchmarks_latest AS
SELECT DISTINCT ON (category, building_type, size_band)
  id, category, building_type, size_band, year,
  p25_cost_per_unit, p50_cost_per_unit, p75_cost_per_unit,
  building_count, sample_confidence, total_spend, computed_at, computed_from, notes
FROM portfolio_benchmarks
ORDER BY category, building_type, size_band, year DESC, computed_at DESC;

COMMENT ON VIEW portfolio_benchmarks_latest IS
  'Most recent benchmark row per (category, building_type, size_band) cell, collapsing year-over-year history to what Cost-Beat reports should cite today.';

-- 4. Grants / RLS -------------------------------------------------------------------

ALTER TABLE portfolio_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_audit        ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE portfolio_benchmarks FROM anon;
REVOKE ALL ON TABLE savings_audit        FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE portfolio_benchmarks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE savings_audit        TO authenticated;

DROP POLICY IF EXISTS "Authenticated team access portfolio_benchmarks" ON portfolio_benchmarks;
CREATE POLICY "Authenticated team access portfolio_benchmarks" ON portfolio_benchmarks
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated team access savings_audit" ON savings_audit;
CREATE POLICY "Authenticated team access savings_audit" ON savings_audit
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- NOTE: benchmark computation runs server-side with SUPABASE_SERVICE_ROLE_KEY,
-- same as portfolio_sync_log in 018. If only an anon key is configured on the
-- server, writes here will fail — verify SUPABASE_SERVICE_ROLE_KEY is set in
-- Render before relying on this table.
