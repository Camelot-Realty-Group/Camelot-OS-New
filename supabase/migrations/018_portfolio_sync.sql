-- 018_portfolio_sync.sql
-- Camelot OS — Unified Portfolio Sync (Spire MDS -> Supabase, RealtyMX enrichment)
--
-- Extends the `buildings` table created in 011_cost_cutting_analysis.sql so it can
-- hold the full Camelot managed portfolio pulled live from Spire MDS, plus a
-- sync audit log.
--
-- VERIFIED against the live Spire API on 2026-08-15:
--   POST /Authorize            -> 200, JWT
--   GET  /RM/BuildingsList     -> 200, 41 buildings
-- Field names below map 1:1 to the Spire BuildingListQueryResult payload.
--
-- Safe to re-run (idempotent): every ADD COLUMN uses IF NOT EXISTS.
--
-- ⚠️ RUN THIS MIGRATION FIRST — before 015/016/017.
-- Verified in the live Supabase project on 2026-08-15: the `buildings` table
-- DOES NOT EXIST. Only `scout_buildings` (the CRM/lead table) and
-- `scout_folder_buildings` are present, even though the dependent tables from
-- migration 011 (expenses, cost_savings_analysis, savings_opportunities,
-- market_benchmarks, proposals, cost_cutting_invoices, cost_analysis_audit_log)
-- all exist. Migration 011 was therefore only partially applied.
--
-- That missing table is the direct cause of the "Failed to load buildings"
-- error on the live /cost-cutting page, and it would also have made this
-- migration fail on its first ALTER. Section 0 below recreates it from the
-- canonical 011 definition so this migration is standalone.

-- 0. Base buildings table (from 011_cost_cutting_analysis.sql) -----------------
-- Recreated here because 011 never fully applied in production. Harmless if it
-- already exists elsewhere.

CREATE TABLE IF NOT EXISTS buildings (
  id                     BIGSERIAL PRIMARY KEY,
  mds_code               TEXT UNIQUE NOT NULL,
  building_name          TEXT NOT NULL,
  address                TEXT,
  units_residential      INTEGER,
  units_commercial       INTEGER,
  units_total            INTEGER,
  property_manager       TEXT,
  property_manager_email TEXT,
  building_type          TEXT,           -- 'Condo', 'Co-op', 'Mixed', 'Rental'
  year_built             INTEGER,
  block                  TEXT,
  lot                    TEXT,
  google_drive_folder_id TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- 1. Extend buildings with Spire linkage + location + sync metadata ------------

ALTER TABLE buildings ADD COLUMN IF NOT EXISTS spire_building_rcd  bigint;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS spire_company_rcd   bigint;
-- spire_company_rcd is REQUIRED to query GL/Budgets and GL/GLSummary for this
-- building (Spire keys financials by CompanyRcd, not BuildingRcd). Resolved from
-- RentalCompanyRcd or CoopCondoCompanyRcd, whichever is non-zero.
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS spire_company_kind  text
  CHECK (spire_company_kind IN ('rental', 'coop_condo', 'unknown'));
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS company_name        text;

ALTER TABLE buildings ADD COLUMN IF NOT EXISTS city                text;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS state               text;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS zip_code            text;

ALTER TABLE buildings ADD COLUMN IF NOT EXISTS superintendent_name  text;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS superintendent_email text;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS superintendent_phone text;

ALTER TABLE buildings ADD COLUMN IF NOT EXISTS occupant_count      integer;

-- RealtyMX enrichment (read-only market data; NEVER expense data — Spire is the
-- sole source of truth for anything financial).
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS realtymx_building_id bigint;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS realtymx_synced_at   timestamptz;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS latitude             numeric;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS longitude            numeric;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS neighborhood         text;

-- Sync bookkeeping
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS sync_source     text DEFAULT 'manual';
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS spire_synced_at timestamptz;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS is_active       boolean DEFAULT true;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS raw_spire       jsonb;

-- spire_building_rcd is the natural key for upserts from Spire.
CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_spire_rcd
  ON buildings(spire_building_rcd) WHERE spire_building_rcd IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buildings_company_rcd ON buildings(spire_company_rcd);
CREATE INDEX IF NOT EXISTS idx_buildings_zip         ON buildings(zip_code);
CREATE INDEX IF NOT EXISTS idx_buildings_active      ON buildings(is_active);

COMMENT ON COLUMN buildings.spire_company_rcd IS
  'Spire CompanyRcd — required for GL/Budgets and GL/GLSummary lookups. Without this, no financial data can be pulled for the building.';
COMMENT ON COLUMN buildings.realtymx_building_id IS
  'RealtyMX building ID when a confident address match exists. Market/listing data only — RealtyMX never supplies expense data.';

-- 2. Sync audit log -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portfolio_sync_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz,
  source              text NOT NULL DEFAULT 'spire'
                        CHECK (source IN ('spire', 'realtymx', 'combined')),
  status              text NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'success', 'partial', 'failed')),
  buildings_fetched   integer DEFAULT 0,
  buildings_inserted  integer DEFAULT 0,
  buildings_updated   integer DEFAULT 0,
  buildings_unchanged integer DEFAULT 0,
  realtymx_matched    integer DEFAULT 0,
  errors              jsonb DEFAULT '[]'::jsonb,
  notes               text,
  triggered_by        text
);

CREATE INDEX IF NOT EXISTS idx_portfolio_sync_log_started ON portfolio_sync_log(started_at DESC);

COMMENT ON TABLE portfolio_sync_log IS
  'One row per portfolio sync run. Gives an auditable history of when Camelot portfolio data was last pulled from Spire and what changed.';

-- 3. Convenience view for the Portfolio UI ---------------------------------------

CREATE OR REPLACE VIEW portfolio_overview AS
SELECT
  b.id,
  b.mds_code,
  b.spire_building_rcd,
  b.spire_company_rcd,
  b.building_name,
  b.company_name,
  b.address,
  b.city,
  b.state,
  b.zip_code,
  b.building_type,
  b.units_residential,
  b.units_commercial,
  b.units_total,
  b.occupant_count,
  b.property_manager,
  b.property_manager_email,
  b.superintendent_name,
  b.realtymx_building_id,
  b.latitude,
  b.longitude,
  b.neighborhood,
  b.spire_synced_at,
  b.is_active,
  -- Has this building ever had a cost analysis run against it?
  (SELECT COUNT(*) FROM cost_savings_analysis a WHERE a.building_id = b.id) AS analysis_count,
  (SELECT MAX(a.analysis_date) FROM cost_savings_analysis a WHERE a.building_id = b.id) AS last_analysis_date,
  (SELECT COALESCE(SUM(a.identified_savings), 0) FROM cost_savings_analysis a WHERE a.building_id = b.id) AS total_identified_savings
FROM buildings b;

COMMENT ON VIEW portfolio_overview IS
  'Portfolio page data source: every Camelot building with Spire linkage, location, and cost-analysis coverage so gaps (buildings never analyzed) are immediately visible.';

-- 4. Grants / RLS ----------------------------------------------------------------
-- buildings had no RLS in 011. Keep it consistent with the hardened pattern used
-- by 014_harden_content_rls.sql: authenticated users only, no anon access.

ALTER TABLE buildings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_sync_log  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE buildings          FROM anon;
REVOKE ALL ON TABLE portfolio_sync_log FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE buildings          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE portfolio_sync_log TO authenticated;

DROP POLICY IF EXISTS "Authenticated team access buildings" ON buildings;
CREATE POLICY "Authenticated team access buildings" ON buildings
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated team access portfolio_sync_log" ON portfolio_sync_log;
CREATE POLICY "Authenticated team access portfolio_sync_log" ON portfolio_sync_log
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- NOTE: the sync itself runs server-side with SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses RLS. If only an anon key is configured on the server, the sync will
-- fail to write — set SUPABASE_SERVICE_ROLE_KEY in Render.
