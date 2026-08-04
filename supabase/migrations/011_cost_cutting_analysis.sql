-- 011_cost_cutting_analysis.sql
-- Cost-Cutting Analysis System
-- Tracks building analysis, opportunities identified, and proposal workflow

-- Buildings table (if not already created)
CREATE TABLE IF NOT EXISTS buildings (
  id BIGSERIAL PRIMARY KEY,
  mds_code TEXT UNIQUE NOT NULL,
  building_name TEXT NOT NULL,
  address TEXT,
  units_residential INTEGER,
  units_commercial INTEGER,
  units_total INTEGER,
  property_manager TEXT,
  property_manager_email TEXT,
  building_type TEXT, -- "Condo", "Co-op", "Mixed", "Rental"
  year_built INTEGER,
  block TEXT,
  lot TEXT,
  google_drive_folder_id TEXT, -- Link to Google Drive folder for this building
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Expenses table (historical expense data)
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  building_id BIGINT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- "Payroll", "Utilities", "HVAC", "Cleaning", etc.
  amount DECIMAL(12, 2) NOT NULL, -- Annual amount
  fiscal_year INTEGER NOT NULL, -- 2022, 2023, 2024, etc.
  source TEXT, -- "MDS Report", "Manual Entry", "Building Statement", etc.
  verified_at TIMESTAMP,
  verified_by TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(building_id, category, fiscal_year)
);

-- Market benchmarks (cost per unit by building type and category)
CREATE TABLE IF NOT EXISTS market_benchmarks (
  id BIGSERIAL PRIMARY KEY,
  building_type TEXT NOT NULL, -- "Condo", "Co-op", "Mixed", "Rental"
  borough TEXT NOT NULL, -- "Manhattan", "Brooklyn", etc.
  category TEXT NOT NULL, -- "Payroll", "Utilities", etc.
  cost_per_unit_annual DECIMAL(10, 2) NOT NULL,
  source TEXT, -- "RealtyMX", "NYC MLS", "Manual Research", etc.
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(building_type, borough, category)
);

-- Cost-cutting analysis (main records)
CREATE TABLE IF NOT EXISTS cost_savings_analysis (
  id BIGSERIAL PRIMARY KEY,
  building_id BIGINT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  analysis_date TIMESTAMP NOT NULL,

  -- Summary metrics
  identified_savings DECIMAL(12, 2), -- Total annual savings identified
  savings_percentage DECIMAL(5, 2), -- % of current expenses

  -- Fee calculations
  fee_one_time DECIMAL(12, 2), -- 35% of first-year savings
  fee_annual_3yr DECIMAL(12, 2), -- 35% spread over 3 years

  -- Quality metrics
  confidence_score DECIMAL(3, 1), -- 0-100
  verification_status TEXT DEFAULT 'pending', -- "pending", "verified", "rejected"
  proposal_status TEXT DEFAULT 'generated', -- "generated", "sent", "accepted", "closed", "rejected"

  -- File references
  proposal_file_id TEXT, -- Google Drive file ID
  proposal_url TEXT, -- Google Drive shareable link

  -- Claude analysis
  claude_reasoning TEXT, -- Full reasoning from Claude Opus

  -- Metadata
  analyzed_by TEXT DEFAULT 'claude-opus', -- AI system name
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Individual savings opportunities (detailed breakdown)
CREATE TABLE IF NOT EXISTS savings_opportunities (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES cost_savings_analysis(id) ON DELETE CASCADE,

  category TEXT NOT NULL, -- "Payroll", "Utilities", "HVAC", etc.
  current_annual_cost DECIMAL(12, 2),
  benchmark_annual_cost DECIMAL(12, 2),
  potential_annual_savings DECIMAL(12, 2),
  savings_pct DECIMAL(5, 2),

  reasoning TEXT, -- Claude's explanation for this opportunity
  difficulty TEXT, -- "Easy", "Medium", "Hard"
  timeline_months INTEGER,

  implementation_notes TEXT,
  status TEXT DEFAULT 'identified', -- "identified", "proposed", "implemented", "rejected"

  created_at TIMESTAMP DEFAULT now()
);

-- Proposal history (track all versions)
CREATE TABLE IF NOT EXISTS proposals (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES cost_savings_analysis(id) ON DELETE CASCADE,

  version INTEGER DEFAULT 1,
  proposal_file_id TEXT NOT NULL, -- Google Drive file ID
  proposal_url TEXT,

  -- Email tracking
  sent_to TEXT, -- Email address of recipient
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,

  -- Response
  response_status TEXT, -- "pending", "accepted", "rejected", "negotiate"
  response_notes TEXT,
  responded_at TIMESTAMP,

  -- Follow-up
  follow_up_scheduled TIMESTAMP,
  follow_up_completed TIMESTAMP,

  created_at TIMESTAMP DEFAULT now()
);

-- QB Integration: Invoice tracking
CREATE TABLE IF NOT EXISTS cost_cutting_invoices (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES cost_savings_analysis(id) ON DELETE CASCADE,

  qb_invoice_id TEXT, -- QuickBooks invoice ID
  qb_customer_id TEXT, -- QB customer reference

  invoice_amount DECIMAL(12, 2), -- Fee amount
  invoice_date DATE,
  due_date DATE,

  payment_status TEXT DEFAULT 'draft', -- "draft", "sent", "paid", "overdue"
  payment_received_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT now()
);

-- Analysis audit log (track all changes)
CREATE TABLE IF NOT EXISTS cost_analysis_audit_log (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES cost_savings_analysis(id) ON DELETE CASCADE,

  action TEXT, -- "created", "verified", "sent", "accepted", "rejected"
  changed_by TEXT, -- User or system name
  change_details TEXT,

  created_at TIMESTAMP DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_cost_savings_analysis_building_id ON cost_savings_analysis(building_id);
CREATE INDEX idx_cost_savings_analysis_analysis_date ON cost_savings_analysis(analysis_date);
CREATE INDEX idx_cost_savings_analysis_proposal_status ON cost_savings_analysis(proposal_status);
CREATE INDEX idx_savings_opportunities_analysis_id ON savings_opportunities(analysis_id);
CREATE INDEX idx_expenses_building_id ON expenses(building_id);
CREATE INDEX idx_expenses_fiscal_year ON expenses(fiscal_year);
CREATE INDEX idx_proposals_analysis_id ON proposals(analysis_id);
CREATE INDEX idx_proposals_sent_at ON proposals(sent_at);

-- Row Level Security (RLS) Policies
ALTER TABLE cost_savings_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_cutting_invoices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all analyses
CREATE POLICY "Enable read access to cost analyses for authenticated users"
  ON cost_savings_analysis FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert new analyses
CREATE POLICY "Enable insert access for cost analyses"
  ON cost_savings_analysis FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow updates to proposal_status and verification_status
CREATE POLICY "Enable update to analysis results"
  ON cost_savings_analysis FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Similar policies for other tables
CREATE POLICY "Enable read access to opportunities"
  ON savings_opportunities FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access to proposals"
  ON proposals FOR SELECT
  USING (auth.role() = 'authenticated');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cost_savings_analysis_timestamp BEFORE UPDATE ON cost_savings_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_timestamp BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buildings_timestamp BEFORE UPDATE ON buildings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
