-- 019_portfolio_benchmark_bands.sql
-- Camelot OS — Portfolio Benchmark Engine tables
--
-- APPLIED 2026-08-16 via Supabase MCP directly against boxnwmqolmynfsprvihk.
--
-- RENAMED from the original 019_portfolio_benchmarks.sql draft. Live Supabase
-- already had portfolio_benchmarks and savings_audit as ad hoc tables (created
-- 2026-08-04/08-15, outside this repo) with a different, flat schema — one
-- row per building+category (annual_cost/monthly_cost, no percentile bands,
-- no building_type/size_band grouping, no comparability guard). Rather than
-- alter those in place (unknown what else may already read/write them — the
-- user chose this option explicitly when asked), this migration creates NEW
-- tables under new names for the percentile-band benchmark design from
-- REVENUE-STRATEGY-AND-PRICE-FIX-FORMULA.md:
--   portfolio_benchmarks  -> portfolio_benchmark_bands
--   savings_audit         -> savings_verifications
-- Nothing live was touched. benchmark-engine.mjs writes to
-- portfolio_benchmark_bands.
--
-- Safe to re-run (idempotent): every CREATE uses IF NOT EXISTS.
--
-- ⚠️ RUN 018_portfolio_sync.sql FIRST — this migration's FK on buildings.id
-- and cost_opt_client_contracts (from 015) both assume those already exist.

-- 1. portfolio_benchmark_bands ----------------------------------------------------
-- One row per (category, building_type, size_band, year) cell — the p25/p50/p75
-- cost-per-unit bands that Cost-Beat reports and pitch demos read from.

CREATE TABLE IF NOT EXISTS portfolio_benchmark_bands (
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
  -- this exact cell. Below that threshold callers should fall back to a
  -- generic 'market_referenced' estimate instead.
  total_spend       numeric,                 -- sum of addressable spend in the cell, for transparency
  computed_at       timestamptz NOT NULL DEFAULT now(),
  computed_from     text DEFAULT 'ap_actuals'
                      CHECK (computed_from IN ('ap_actuals', 'gl_budget', 'blended')),
  notes             text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_benchmark_bands_cell
  ON portfolio_benchmark_bands(category, building_type, size_band, year);
CREATE INDEX IF NOT EXISTS idx_portfolio_benchmark_bands_category ON portfolio_benchmark_bands(category);
CREATE INDEX IF NOT EXISTS idx_portfolio_benchmark_bands_computed_at ON portfolio_benchmark_bands(computed_at DESC);

COMMENT ON TABLE portfolio_benchmark_bands IS
  'p25/p50/p75 cost-per-unit bands per operating category, building type, and size band. Only addressable operating expense (see vendor-category-map.mjs) may populate this table. sample_confidence=portfolio_referenced requires building_count >= 4. Distinct from the older portfolio_benchmarks table (flat, per-building, created 2026-08-15 ad hoc) which this does not replace.';
COMMENT ON COLUMN portfolio_benchmark_bands.p25_cost_per_unit IS
  'Target price for a savings pitch: Target(b,c) = p25(c,peer) x Units(b).';
COMMENT ON COLUMN portfolio_benchmark_bands.building_count IS
  'Number of distinct Camelot buildings in this cell. Comparability guard: cells with building_count < 4 must not be marked portfolio_referenced.';

-- 2. savings_verifications -----------------------------------------------------------
-- The evidence layer behind every quarterly savings verification and 35% fee
-- calculation. One row per (building, category, quarter) verification event.

CREATE TABLE IF NOT EXISTS savings_verifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id         bigint REFERENCES buildings(id),
  category            text NOT NULL,
  quarter             text NOT NULL,          -- e.g. '2026-Q3'
  baseline_cost       numeric NOT NULL,        -- what the building was paying before Camelot intervened
  benchmark_id        uuid REFERENCES portfolio_benchmark_bands(id),
  target_cost         numeric,                 -- benchmark p25 x units at time of verification
  actual_cost         numeric NOT NULL,        -- verified actual spend this quarter, post-intervention
  verified_savings    numeric NOT NULL,        -- baseline_cost - actual_cost, floored at 0
  fee_pct             numeric NOT NULL DEFAULT 0.35,
  fee_amount          numeric NOT NULL,        -- verified_savings x fee_pct
  verification_method text,                    -- 'ap_actuals' | 'invoice_review' | 'vendor_confirmation'
  verified_by         text,
  verified_at         timestamptz NOT NULL DEFAULT now(),
  contract_id         uuid REFERENCES cost_opt_client_contracts(id),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_savings_verifications_building  ON savings_verifications(building_id);
CREATE INDEX IF NOT EXISTS idx_savings_verifications_quarter   ON savings_verifications(quarter);
CREATE INDEX IF NOT EXISTS idx_savings_verifications_contract  ON savings_verifications(contract_id);

COMMENT ON TABLE savings_verifications IS
  'Evidence layer for quarterly, recurring 35%-of-verified-savings billing. One row per building/category/quarter verification. Referenced by cost_opt_quarterly_verifications.savings_audit_id (see 015_cost_optimization_contracts_kpis.sql) — that column stays a soft link for now since it predates this table; promote to a real FK once code is wired up. Distinct from the older savings_audit table (created 2026-08-04 ad hoc, different schema: source_bot/property_name/fee_model) which this does not replace.';
COMMENT ON COLUMN savings_verifications.verified_savings IS
  'baseline_cost - actual_cost, floored at 0. Never negative — a building that got more expensive shows 0 savings, not a negative fee.';

-- 3. Convenience view for the pitch-demo / Cost-Beat report builder ----------------

CREATE OR REPLACE VIEW portfolio_benchmark_bands_latest AS
SELECT DISTINCT ON (category, building_type, size_band)
  id, category, building_type, size_band, year,
  p25_cost_per_unit, p50_cost_per_unit, p75_cost_per_unit,
  building_count, sample_confidence, total_spend, computed_at, computed_from, notes
FROM portfolio_benchmark_bands
ORDER BY category, building_type, size_band, year DESC, computed_at DESC;

-- security_invoker so the view enforces the querying user's RLS rather than
-- the view owner's (flagged by the Supabase security advisor when omitted —
-- see the same fix applied to portfolio_overview / cost_opt_kpi_summary /
-- cost_savings_analysis_recurring_estimate in this same deploy).
ALTER VIEW public.portfolio_benchmark_bands_latest SET (security_invoker = true);

COMMENT ON VIEW portfolio_benchmark_bands_latest IS
  'Most recent benchmark row per (category, building_type, size_band) cell, collapsing year-over-year history to what Cost-Beat reports should cite today.';

-- 4. Grants / RLS -------------------------------------------------------------------

ALTER TABLE portfolio_benchmark_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_verifications     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE portfolio_benchmark_bands FROM anon;
REVOKE ALL ON TABLE savings_verifications     FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE portfolio_benchmark_bands TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE savings_verifications     TO authenticated;

DROP POLICY IF EXISTS "Authenticated team access portfolio_benchmark_bands" ON portfolio_benchmark_bands;
CREATE POLICY "Authenticated team access portfolio_benchmark_bands" ON portfolio_benchmark_bands
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated team access savings_verifications" ON savings_verifications;
CREATE POLICY "Authenticated team access savings_verifications" ON savings_verifications
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- NOTE: benchmark computation runs server-side with SUPABASE_SERVICE_ROLE_KEY,
-- same as portfolio_sync_log in 018. If only an anon key is configured on the
-- server, writes here will fail — verify SUPABASE_SERVICE_ROLE_KEY is set in
-- Render before relying on this table.
