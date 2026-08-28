-- 021_neighborhood_leads.sql
-- Camelot OS — Neighborhood Leads Engine
--
-- Stores the ongoing, city-wide lead-generation pipeline: multifamily /
-- mixed-use / condo / co-op buildings with 10+ units, pulled from NYC PLUTO
-- + HPD (same pipeline methodology as the one-off "Neighbor Expansion"
-- campaign, generalized to run city-wide and repeatedly rather than only
-- around Camelot's current buildings).
--
-- Each lead carries ownership info, management company info, and (when
-- resolvable) the super's name or the condo/co-op board contact, plus the
-- full state machine for the outreach workflow: draft generated -> staff
-- approved -> sent -> pushed to HubSpot -> 4-day follow-up task created.
--
-- Safe to re-run (idempotent): every CREATE uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS neighborhood_leads (
  id                        BIGSERIAL PRIMARY KEY,
  bbl                       TEXT UNIQUE NOT NULL,
  address                   TEXT NOT NULL,
  borough                   TEXT,                 -- MN/BK/QN/BX/SI
  block                     TEXT,
  lot                       TEXT,
  zip_code                  TEXT,

  -- Property facts (from PLUTO)
  bldg_class                TEXT,
  land_use                  TEXT,
  units_total               INTEGER,
  num_floors                NUMERIC,
  year_built                INTEGER,
  building_category         TEXT,                 -- 'multifamily_walkup' | 'multifamily_elevator' | 'mixed_use' | 'condo' | 'coop' | 'boutique_office'

  -- Ownership / management / on-site contact info (from HPD + PLUTO)
  owner_name                TEXT,
  hpd_registration_id       TEXT,
  management_company        TEXT,
  management_contact_name   TEXT,
  management_contact_role   TEXT,                 -- 'Agent' | 'HeadOfficer' | 'CorporateOwner' | 'IndividualOwner' | 'SiteManager' etc.
  super_name                TEXT,
  board_contact_name         TEXT,                -- condo/co-op board contact, when resolvable
  mailing_address           TEXT,
  mailing_zip                TEXT,
  contact_email              TEXT,
  contact_phone               TEXT,
  contact_confidence         TEXT,                 -- 'hpd_agent' | 'hpd_owner' | 'owner_name_only' | 'none'

  -- Sourcing / relationship to Camelot's existing portfolio (nullable — city-wide leads may have no anchor)
  relationship               TEXT,                 -- 'same_block' | 'across_street' | NULL for pure city-wide search
  nearest_camelot_buildings  TEXT[],

  -- Lead-gen run tracking
  source_run_id              TEXT,
  discovered_at               TIMESTAMPTZ DEFAULT now(),

  -- Outreach workflow state machine
  status                      TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'draft_ready', 'pending_approval', 'approved', 'sent', 'hubspot_synced', 'follow_up_scheduled', 'responded', 'won', 'lost', 'do_not_contact')),
  draft_subject                TEXT,
  draft_body_html               TEXT,
  draft_generated_at            TIMESTAMPTZ,
  approved_by                   TEXT,               -- Camelot staff user id/email who approved the draft
  approved_at                   TIMESTAMPTZ,
  sent_at                       TIMESTAMPTZ,
  sent_by                       TEXT,
  resend_message_id             TEXT,

  -- HubSpot sync
  hubspot_company_id            TEXT,
  hubspot_contact_id            TEXT,
  hubspot_deal_id                TEXT,
  hubspot_task_id                TEXT,
  hubspot_synced_at              TIMESTAMPTZ,

  -- Follow-up
  follow_up_due_at               TIMESTAMPTZ,        -- sent_at + 4 days
  follow_up_completed_at          TIMESTAMPTZ,

  created_at                     TIMESTAMPTZ DEFAULT now(),
  updated_at                     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_neighborhood_leads_status ON neighborhood_leads(status);
CREATE INDEX IF NOT EXISTS idx_neighborhood_leads_borough ON neighborhood_leads(borough);
CREATE INDEX IF NOT EXISTS idx_neighborhood_leads_units ON neighborhood_leads(units_total);
CREATE INDEX IF NOT EXISTS idx_neighborhood_leads_follow_up ON neighborhood_leads(follow_up_due_at) WHERE follow_up_completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_neighborhood_leads_source_run ON neighborhood_leads(source_run_id);

-- Audit trail of every lead-gen run (so re-running the search is traceable and
-- doesn't silently re-fetch/duplicate work).
CREATE TABLE IF NOT EXISTS neighborhood_lead_runs (
  id                    TEXT PRIMARY KEY,           -- e.g. 'run_2026-08-28T14-00-00Z'
  started_at            TIMESTAMPTZ DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  status                TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  scope                 TEXT,                        -- e.g. 'citywide_10plus_units' | 'borough:MN' | 'block:1006:34'
  criteria               JSONB,                       -- filter definition used (unit threshold, landuse codes, etc.)
  leads_found            INTEGER DEFAULT 0,
  leads_new              INTEGER DEFAULT 0,
  leads_updated          INTEGER DEFAULT 0,
  error_message           TEXT,
  notes                   TEXT
);

-- One row per outreach touch, so a lead's full history (draft edits, sends,
-- HubSpot pushes, follow-ups) is auditable even as `neighborhood_leads`
-- itself reflects only current state.
CREATE TABLE IF NOT EXISTS neighborhood_lead_events (
  id                     BIGSERIAL PRIMARY KEY,
  lead_id                 BIGINT NOT NULL REFERENCES neighborhood_leads(id) ON DELETE CASCADE,
  event_type               TEXT NOT NULL,             -- 'draft_generated' | 'draft_edited' | 'approved' | 'sent' | 'hubspot_synced' | 'follow_up_created' | 'follow_up_completed' | 'status_changed'
  actor                     TEXT,                       -- staff user id/email, or 'system'
  detail                    JSONB,
  created_at                TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_neighborhood_lead_events_lead ON neighborhood_lead_events(lead_id);

-- updated_at trigger (matches convention used elsewhere in this schema)
CREATE OR REPLACE FUNCTION set_neighborhood_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_neighborhood_leads_updated_at ON neighborhood_leads;
CREATE TRIGGER trg_neighborhood_leads_updated_at
  BEFORE UPDATE ON neighborhood_leads
  FOR EACH ROW EXECUTE FUNCTION set_neighborhood_leads_updated_at();

-- RLS: readable/writable by any authenticated Camelot OS user (same pattern
-- as `buildings` / `scout_buildings` elsewhere in this schema — auth is
-- enforced at the API layer via requireApiUser, not per-row here).
ALTER TABLE neighborhood_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhood_lead_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhood_lead_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS neighborhood_leads_all ON neighborhood_leads;
CREATE POLICY neighborhood_leads_all ON neighborhood_leads FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS neighborhood_lead_runs_all ON neighborhood_lead_runs;
CREATE POLICY neighborhood_lead_runs_all ON neighborhood_lead_runs FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS neighborhood_lead_events_all ON neighborhood_lead_events;
CREATE POLICY neighborhood_lead_events_all ON neighborhood_lead_events FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
