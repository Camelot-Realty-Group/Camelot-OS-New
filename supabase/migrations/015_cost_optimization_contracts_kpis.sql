-- 015_cost_optimization_contracts_kpis.sql
-- Camelot OS — Cost Optimization: client contracts, vendor certification/commission
-- tracking, quarterly verification, and a KPI rollup view for the dashboard.
--
-- RENUMBERED from 012 -> 015: 012 (content_engine), 013 (traded_ny), and 014
-- (harden_content_rls) already exist on feature/spire-realtymx-clients / main.
-- This migration was never run in Supabase, so renumbering is safe.
--
-- FK FIX: earlier draft referenced scout_buildings(id) (uuid) — wrong table.
-- The actual cost-cutting pipeline (011_cost_cutting_analysis.sql) keys off
-- buildings(id) (bigserial, matched by mds_code) and cost_savings_analysis(id).
-- This migration now hard-FKs to those tables so a contract is provably tied
-- to the same building/analysis record the savings were identified against —
-- required for the quarterly fee to be defensible, not just self-reported.
--
-- RLS FIX: earlier draft used permissive "authenticated USING (true)" policies.
-- These are money/billing tables (they determine what a client owes every
-- quarter), so they follow the stricter pattern the team already applied in
-- 014_harden_content_rls.sql: FORCE RLS, revoke anon entirely, and require
-- auth.uid() IS NOT NULL rather than blanket authenticated access.

-- 1. Client service contracts ------------------------------------------------

CREATE TABLE IF NOT EXISTS cost_opt_client_contracts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number       text NOT NULL UNIQUE,
  building_id           bigint REFERENCES buildings(id) ON DELETE SET NULL,
  building_address      text NOT NULL,
  building_name         text,
  client_org_name       text,
  client_signer_name    text,
  client_signer_email   text,
  cost_analysis_id      bigint REFERENCES cost_savings_analysis(id) ON DELETE SET NULL,
  identified_savings    numeric DEFAULT 0,        -- annual $ identified in the initial analysis (baseline estimate, not a fee)
  savings_fee_pct       numeric NOT NULL DEFAULT 0.35,  -- recurring: % of savings billed EVERY quarter with proof, not a one-time fee
  term_years            integer NOT NULL DEFAULT 3,
  effective_date        date,
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','sent_for_signature','signed','active','terminated','expired')),
  docusign_envelope_id  text,
  signed_at             timestamptz,
  terminated_at         timestamptz,
  pdf_url               text,                     -- generated proposal/contract PDF
  google_drive_url      text,                      -- shared folder / file for client + Camelot team
  notes                 text,
  created_by            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_opt_contracts_building   ON cost_opt_client_contracts(building_id);
CREATE INDEX IF NOT EXISTS idx_cost_opt_contracts_analysis   ON cost_opt_client_contracts(cost_analysis_id);
CREATE INDEX IF NOT EXISTS idx_cost_opt_contracts_status     ON cost_opt_client_contracts(status);
CREATE INDEX IF NOT EXISTS idx_cost_opt_contracts_effective  ON cost_opt_client_contracts(effective_date);

-- 2. Vendor master + certification -------------------------------------------

CREATE TABLE IF NOT EXISTS cost_opt_vendors (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name               text NOT NULL,
  service_category          text NOT NULL,       -- 'Sprinkler','Elevator','Boiler','Cleaning', etc.
  years_in_business         integer,
  operating_capital         numeric,
  credit_report_score       integer,
  general_liability_amount  numeric,
  insured_camelot_additional boolean DEFAULT false,
  insurance_cert_expiry     date,
  insurance_claims_3yr      integer DEFAULT 0,
  active_lawsuits           boolean DEFAULT false,
  judgments_or_liens        boolean DEFAULT false,
  bankruptcy_10yr           boolean DEFAULT false,
  references_called         integer DEFAULT 0,
  reference_avg_score       numeric,
  screening_status          text DEFAULT 'pending'
                              CHECK (screening_status IN ('pending','pass','fail')),
  certification_tier        text NOT NULL DEFAULT 'uncertified'
                              CHECK (certification_tier IN ('gold','silver','bronze','uncertified')),
  current_commission_pct    numeric NOT NULL DEFAULT 0,
  w9_on_file                boolean DEFAULT false,
  vetted_by                 text,
  vetted_at                 timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_opt_vendors_category ON cost_opt_vendors(service_category);
CREATE INDEX IF NOT EXISTS idx_cost_opt_vendors_tier     ON cost_opt_vendors(certification_tier);

-- 3. Quarterly vendor performance scoring history -----------------------------

CREATE TABLE IF NOT EXISTS cost_opt_vendor_scores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         uuid NOT NULL REFERENCES cost_opt_vendors(id) ON DELETE CASCADE,
  quarter_label     text NOT NULL,               -- 'Q1-2027'
  pct_on_time       numeric,                      -- 0-1
  response_pts      numeric,
  defect_rate_pct   numeric,
  quality_pts       numeric,
  price_vs_market   numeric,                      -- e.g. -0.02 = 2% below market
  pricing_pts       numeric,
  satisfaction_score numeric,                     -- /10
  satisfaction_pts  numeric,
  total_score       numeric,                      -- /100
  rating            numeric,                      -- /10
  resulting_tier    text CHECK (resulting_tier IN ('gold','silver','bronze','uncertified')),
  resulting_commission_pct numeric,
  reviewed_by       text,
  reviewed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, quarter_label)
);

CREATE INDEX IF NOT EXISTS idx_cost_opt_vendor_scores_vendor ON cost_opt_vendor_scores(vendor_id);

-- 4. Vendor commission agreements (per client engagement) --------------------

CREATE TABLE IF NOT EXISTS cost_opt_vendor_commission_agreements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_number      text NOT NULL UNIQUE,
  vendor_id             uuid NOT NULL REFERENCES cost_opt_vendors(id) ON DELETE CASCADE,
  contract_id           uuid REFERENCES cost_opt_client_contracts(id) ON DELETE SET NULL,
  building_id           bigint REFERENCES buildings(id) ON DELETE SET NULL,
  annual_contract_value numeric DEFAULT 0,        -- vendor <-> client contract value
  commission_pct        numeric NOT NULL DEFAULT 0,
  performance_bonus_amount numeric DEFAULT 0,
  client_rebate_pct     numeric NOT NULL DEFAULT 0.50,  -- share of bonus passed back to client
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','sent_for_signature','signed','active','terminated')),
  docusign_envelope_id  text,
  signed_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_opt_vca_vendor   ON cost_opt_vendor_commission_agreements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cost_opt_vca_contract ON cost_opt_vendor_commission_agreements(contract_id);
CREATE INDEX IF NOT EXISTS idx_cost_opt_vca_status   ON cost_opt_vendor_commission_agreements(status);

-- 5. Quarterly verification records (recurring for the full contract term) ---
-- One row per quarter, per contract. This is the billing record: every quarter
-- Camelot proves that quarter's savings and bills savings_fee_pct of the
-- verified amount. Not a one-time fee — recurs for as long as the contract
-- is active. savings_audit_id is a soft link (no FK — that table lives in a
-- separate, currently unmigrated branch of work; see note at bottom of file)
-- to the tamper-resistant audit record backing this quarter's number, once
-- that table is available in every environment.

CREATE TABLE IF NOT EXISTS cost_opt_quarterly_verifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id           uuid NOT NULL REFERENCES cost_opt_client_contracts(id) ON DELETE CASCADE,
  quarter_label         text NOT NULL,             -- 'Q1-2027'
  savings_target_amount numeric DEFAULT 0,          -- baseline expectation for the quarter
  savings_verified_amount numeric DEFAULT 0,        -- actual proven savings vs. baseline
  quarterly_fee_amount  numeric DEFAULT 0,          -- savings_verified_amount * contract.savings_fee_pct — THIS quarter's bill
  vendor_commission_total numeric DEFAULT 0,        -- sum of vendor commission this quarter
  savings_audit_id      uuid,                       -- soft link to savings_audit.id (not FK'd yet — see reconciliation note)
  report_pdf_url        text,
  report_google_drive_url text,
  sent_to_client_at     timestamptz,
  sent_to_client_email  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, quarter_label)
);

CREATE INDEX IF NOT EXISTS idx_cost_opt_qv_contract ON cost_opt_quarterly_verifications(contract_id);

-- 6. updated_at trigger --------------------------------------------------------

CREATE OR REPLACE FUNCTION update_cost_opt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cost_opt_contracts_updated_at ON cost_opt_client_contracts;
CREATE TRIGGER trg_cost_opt_contracts_updated_at
  BEFORE UPDATE ON cost_opt_client_contracts
  FOR EACH ROW EXECUTE FUNCTION update_cost_opt_updated_at();

DROP TRIGGER IF EXISTS trg_cost_opt_vendors_updated_at ON cost_opt_vendors;
CREATE TRIGGER trg_cost_opt_vendors_updated_at
  BEFORE UPDATE ON cost_opt_vendors
  FOR EACH ROW EXECUTE FUNCTION update_cost_opt_updated_at();

DROP TRIGGER IF EXISTS trg_cost_opt_vca_updated_at ON cost_opt_vendor_commission_agreements;
CREATE TRIGGER trg_cost_opt_vca_updated_at
  BEFORE UPDATE ON cost_opt_vendor_commission_agreements
  FOR EACH ROW EXECUTE FUNCTION update_cost_opt_updated_at();

-- 7. KPI rollup view for the dashboard ----------------------------------------
-- Single row of portfolio-wide KPIs — the Cost Optimization dashboard reads this
-- directly rather than aggregating client-side.

CREATE OR REPLACE VIEW cost_opt_kpi_summary AS
SELECT
  (SELECT COUNT(*) FROM cost_opt_client_contracts) AS total_contracts,
  (SELECT COUNT(*) FROM cost_opt_client_contracts WHERE status IN ('signed','active')) AS active_contracts,
  (SELECT COALESCE(SUM(identified_savings), 0) FROM cost_opt_client_contracts) AS total_identified_savings,
  (SELECT COALESCE(SUM(savings_verified_amount), 0) FROM cost_opt_quarterly_verifications) AS total_savings_verified,
  -- Recurring quarterly fee revenue (35% of verified savings, billed every quarter — not a one-time fee).
  (SELECT COALESCE(SUM(qv.quarterly_fee_amount), 0)
     FROM cost_opt_quarterly_verifications qv
     JOIN cost_opt_client_contracts c ON c.id = qv.contract_id
     WHERE c.status IN ('signed','active')) AS total_quarterly_fees_earned,
  (SELECT COALESCE(SUM(vendor_commission_total), 0) FROM cost_opt_quarterly_verifications) AS total_vendor_commission,
  (SELECT COUNT(*) FROM cost_opt_vendors WHERE screening_status = 'pass') AS vendors_certified,
  (SELECT COUNT(*) FROM cost_opt_vendors WHERE certification_tier = 'gold') AS vendors_gold,
  (SELECT COUNT(*) FROM cost_opt_vendors WHERE certification_tier = 'silver') AS vendors_silver,
  (SELECT COUNT(*) FROM cost_opt_vendors WHERE certification_tier = 'bronze') AS vendors_bronze,
  (SELECT ROUND(AVG(rating), 2) FROM cost_opt_vendor_scores) AS avg_vendor_rating;

-- 8. RLS ------------------------------------------------------------------------
-- These are billing tables — they determine what a client owes every quarter —
-- so they get the stricter pattern from 014_harden_content_rls.sql rather than
-- blanket "authenticated USING (true)": FORCE RLS, revoke anon outright, and
-- require a real authenticated session (auth.uid() IS NOT NULL).

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'cost_opt_client_contracts', 'cost_opt_vendors', 'cost_opt_vendor_scores',
    'cost_opt_vendor_commission_agreements', 'cost_opt_quarterly_verifications'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO authenticated', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated manage %s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated team access %s" ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Authenticated team access %s" ON %I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      tbl, tbl
    );
  END LOOP;
END $$;

COMMENT ON TABLE cost_opt_client_contracts IS
  'Signed CamelotOS Cost Optimization Service Agreements — one row per client building engagement. See Camelot-Client-Service-Agreement.docx. Fee is 35% of savings billed every quarter (savings_fee_pct), not a one-time fee.';
COMMENT ON TABLE cost_opt_vendors IS
  'Vendor master + certification status. See Camelot-Vendor-Vetting-Checklist.xlsx and Camelot-Vendor-Performance-Certification-Agreement.docx.';
COMMENT ON VIEW cost_opt_kpi_summary IS
  'Single-row portfolio KPI rollup for the Cost Optimization dashboard UI.';

-- 9. Reconciliation note ---------------------------------------------------------
-- portfolio_benchmarks and savings_audit (referenced in the Phase 2 Onward doc as
-- the evidence/audit layer backing quarterly savings claims) do NOT exist as a
-- migration file anywhere on main or feature/spire-realtymx-clients as of this
-- migration's authoring — they were created ad hoc directly in the Supabase SQL
-- editor. That means they are NOT reproducible from this repo (a real gap: a
-- fresh clone of this Supabase project would not have them). Whoever owns that
-- work should commit their DDL as a migration; once that lands, promote
-- cost_opt_quarterly_verifications.savings_audit_id to a real foreign key.
