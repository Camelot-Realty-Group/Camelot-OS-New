-- 026_fix_cost_analysis_id_types.sql
-- Convert cost_savings_analysis.id and related IDs from BIGINT to TEXT
-- to match backend string-based IDs (analysis_XXXXXXXX format)

-- First, drop dependent foreign keys and constraints
ALTER TABLE savings_opportunities DROP CONSTRAINT IF EXISTS savings_opportunities_analysis_id_fkey;
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_analysis_id_fkey;
ALTER TABLE cost_cutting_invoices DROP CONSTRAINT IF EXISTS cost_cutting_invoices_analysis_id_fkey;
ALTER TABLE cost_analysis_audit_log DROP CONSTRAINT IF EXISTS cost_analysis_audit_log_analysis_id_fkey;

-- Convert cost_savings_analysis.id to TEXT
ALTER TABLE cost_savings_analysis DROP CONSTRAINT IF EXISTS cost_savings_analysis_pkey;
ALTER TABLE cost_savings_analysis ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE cost_savings_analysis ADD PRIMARY KEY (id);

-- Convert analysis_id references to TEXT in dependent tables
ALTER TABLE savings_opportunities ALTER COLUMN analysis_id TYPE TEXT USING analysis_id::TEXT;
ALTER TABLE proposals ALTER COLUMN analysis_id TYPE TEXT USING analysis_id::TEXT;
ALTER TABLE cost_cutting_invoices ALTER COLUMN analysis_id TYPE TEXT USING analysis_id::TEXT;
ALTER TABLE cost_analysis_audit_log ALTER COLUMN analysis_id TYPE TEXT USING analysis_id::TEXT;

-- Re-add foreign key constraints
ALTER TABLE savings_opportunities
  ADD CONSTRAINT savings_opportunities_analysis_id_fkey
  FOREIGN KEY (analysis_id) REFERENCES cost_savings_analysis(id) ON DELETE CASCADE;

ALTER TABLE proposals
  ADD CONSTRAINT proposals_analysis_id_fkey
  FOREIGN KEY (analysis_id) REFERENCES cost_savings_analysis(id) ON DELETE CASCADE;

ALTER TABLE cost_cutting_invoices
  ADD CONSTRAINT cost_cutting_invoices_analysis_id_fkey
  FOREIGN KEY (analysis_id) REFERENCES cost_savings_analysis(id) ON DELETE CASCADE;

ALTER TABLE cost_analysis_audit_log
  ADD CONSTRAINT cost_analysis_audit_log_analysis_id_fkey
  FOREIGN KEY (analysis_id) REFERENCES cost_savings_analysis(id) ON DELETE CASCADE;
