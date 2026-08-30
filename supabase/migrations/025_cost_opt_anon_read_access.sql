-- 025_cost_opt_anon_read_access.sql
-- Fix: Grant anon role SELECT access to cost optimization tables
-- IMPORTANT: This migration assumes migration 015 (cost_opt tables) has already run
-- If those tables don't exist yet, this will fail gracefully and you can run these GRANT statements manually

-- Grant anon SELECT on cost_savings_analysis (from migration 011)
GRANT SELECT ON cost_savings_analysis TO anon;

-- Grant anon SELECT on savings_opportunities (from migration 011)
GRANT SELECT ON savings_opportunities TO anon;

-- These tables are created by migration 015 and need anon access
-- If migration 015 hasn't run yet, comment these out and run manually after 015:
BEGIN;
  GRANT SELECT ON cost_opt_client_contracts TO anon;
  GRANT SELECT ON cost_opt_vendors TO anon;
  GRANT SELECT ON cost_opt_quarterly_verifications TO anon;
  GRANT SELECT ON cost_opt_kpi_summary TO anon;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Cost optimization tables not found yet - migration 015 may not have run';
END;
