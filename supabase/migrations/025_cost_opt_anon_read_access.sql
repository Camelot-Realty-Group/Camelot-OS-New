-- 025_cost_opt_anon_read_access.sql
-- Fix: Grant anon role SELECT access to cost optimization tables
-- (migration 015 revoked ALL access from anon, but Cost Optimization page needs to read this data)
--
-- Context:
-- - cost_opt_kpi_summary is a VIEW used by CostCuttingTool.tsx to show portfolio KPIs
-- - buildings table is referenced by CostCuttingTool.tsx for building dropdown
-- - Both need anon READ access (SELECT only, no INSERT/UPDATE/DELETE)

-- Enable RLS on buildings if not already enabled
ALTER TABLE IF EXISTS buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS buildings FORCE ROW LEVEL SECURITY;

-- Grant anon READ access to buildings (SELECT only)
DROP POLICY IF EXISTS "anon read buildings" ON buildings;
CREATE POLICY "anon read buildings" ON buildings FOR SELECT TO anon USING (true);
GRANT SELECT ON buildings TO anon;

-- Grant anon READ access to cost_opt_client_contracts
DROP POLICY IF EXISTS "anon read cost_opt_client_contracts" ON cost_opt_client_contracts;
CREATE POLICY "anon read cost_opt_client_contracts" ON cost_opt_client_contracts
  FOR SELECT TO anon USING (true);
GRANT SELECT ON cost_opt_client_contracts TO anon;

-- Grant anon READ access to cost_opt_vendors
DROP POLICY IF EXISTS "anon read cost_opt_vendors" ON cost_opt_vendors;
CREATE POLICY "anon read cost_opt_vendors" ON cost_opt_vendors
  FOR SELECT TO anon USING (true);
GRANT SELECT ON cost_opt_vendors TO anon;

-- Grant anon READ access to cost_opt_quarterly_verifications
DROP POLICY IF EXISTS "anon read cost_opt_quarterly_verifications" ON cost_opt_quarterly_verifications;
CREATE POLICY "anon read cost_opt_quarterly_verifications" ON cost_opt_quarterly_verifications
  FOR SELECT TO anon USING (true);
GRANT SELECT ON cost_opt_quarterly_verifications TO anon;

-- Grant anon READ access to cost_opt_kpi_summary VIEW
GRANT SELECT ON cost_opt_kpi_summary TO anon;

-- Grant anon READ access to cost_savings_analysis and savings_opportunities
-- (referenced by CostCuttingTool.tsx when running analysis)
DROP POLICY IF EXISTS "anon read cost_savings_analysis" ON cost_savings_analysis;
CREATE POLICY "anon read cost_savings_analysis" ON cost_savings_analysis
  FOR SELECT TO anon USING (true);
GRANT SELECT ON cost_savings_analysis TO anon;

DROP POLICY IF EXISTS "anon read savings_opportunities" ON savings_opportunities;
CREATE POLICY "anon read savings_opportunities" ON savings_opportunities
  FOR SELECT TO anon USING (true);
GRANT SELECT ON savings_opportunities TO anon;

COMMENT ON POLICY "anon read buildings" ON buildings IS
  'Allow anon (unauthenticated) users to read buildings for Cost Optimization dropdown';

COMMENT ON POLICY "anon read cost_opt_client_contracts" ON cost_opt_client_contracts IS
  'Allow anon users to read (not modify) cost optimization contracts for KPI dashboard';
