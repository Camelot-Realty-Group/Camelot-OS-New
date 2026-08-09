-- Traded NY deal-flow tracker and CRM handoff queue.
-- Contact data is available only to authenticated Camelot users. The service
-- role retains its normal RLS bypass for server-side ingestion and automation.

CREATE TABLE IF NOT EXISTS traded_deals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address               text NOT NULL,
  borough               text NOT NULL,
  deal_type             text NOT NULL,
  price                 text,
  units                 integer NOT NULL DEFAULT 0 CHECK (units >= 0),
  sale_date             date,
  broker                text,
  source_url            text,
  notes                 text,
  score                 integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),

  buyer_name            text,
  buyer_company         text,
  buyer_email           text,
  buyer_phone           text,
  buyer_instagram       text,
  buyer_linkedin        text,
  seller_name           text,
  seller_company        text,
  seller_email          text,
  seller_phone          text,
  seller_instagram      text,
  seller_linkedin       text,

  enriched_at           timestamptz,
  enrichment_source     text,
  hubspot_synced_at     timestamptz,
  hubspot_contact_id    text,
  hubspot_company_id    text,
  hubspot_deal_id       text,
  hubspot_sync_error    text,

  campaign_status       text NOT NULL DEFAULT 'new'
    CHECK (campaign_status IN ('new', 'qualified', 'enriching', 'ready', 'synced', 'nurture', 'suppressed', 'converted')),
  outreach_eligible     boolean NOT NULL DEFAULT false,
  do_not_contact        boolean NOT NULL DEFAULT false,
  contact_source        text NOT NULL DEFAULT 'Traded NY (manual)',
  ingestion_source      text NOT NULL DEFAULT 'manual'
    CHECK (ingestion_source IN ('manual', 'traded_co_feed', 'csv_import')),
  created_by            uuid DEFAULT auth.uid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CHECK (NOT do_not_contact OR NOT outreach_eligible)
);

-- Upgrade safely if the earlier personal-branch version of this migration was
-- applied to a Supabase project before consolidation.
ALTER TABLE traded_deals ADD COLUMN IF NOT EXISTS hubspot_sync_error text;
ALTER TABLE traded_deals ADD COLUMN IF NOT EXISTS campaign_status text NOT NULL DEFAULT 'new'
  CHECK (campaign_status IN ('new', 'qualified', 'enriching', 'ready', 'synced', 'nurture', 'suppressed', 'converted'));
ALTER TABLE traded_deals ADD COLUMN IF NOT EXISTS outreach_eligible boolean NOT NULL DEFAULT false;
ALTER TABLE traded_deals ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false;
ALTER TABLE traded_deals ADD COLUMN IF NOT EXISTS contact_source text NOT NULL DEFAULT 'Traded NY (manual)';
ALTER TABLE traded_deals ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE traded_deals DROP CONSTRAINT IF EXISTS traded_deals_ingestion_source_check;
ALTER TABLE traded_deals ADD CONSTRAINT traded_deals_ingestion_source_check
  CHECK (ingestion_source IN ('manual', 'traded_co_feed', 'csv_import'));

CREATE INDEX IF NOT EXISTS idx_traded_deals_score ON traded_deals(score DESC);
CREATE INDEX IF NOT EXISTS idx_traded_deals_created_at ON traded_deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traded_deals_borough ON traded_deals(borough);
CREATE INDEX IF NOT EXISTS idx_traded_deals_campaign_status ON traded_deals(campaign_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_traded_deals_source_url
  ON traded_deals(source_url) WHERE source_url IS NOT NULL AND btrim(source_url) <> '';

CREATE OR REPLACE FUNCTION set_traded_deals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_traded_deals_updated_at ON traded_deals;
CREATE TRIGGER trg_traded_deals_updated_at
  BEFORE UPDATE ON traded_deals
  FOR EACH ROW EXECUTE FUNCTION set_traded_deals_updated_at();

ALTER TABLE traded_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE traded_deals FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE traded_deals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE traded_deals TO authenticated;

DROP POLICY IF EXISTS "App access traded_deals" ON traded_deals;
DROP POLICY IF EXISTS "Authenticated team reads traded deals" ON traded_deals;
DROP POLICY IF EXISTS "Authenticated team inserts traded deals" ON traded_deals;
DROP POLICY IF EXISTS "Authenticated team updates traded deals" ON traded_deals;
DROP POLICY IF EXISTS "Authenticated team deletes traded deals" ON traded_deals;

CREATE POLICY "Authenticated team reads traded deals"
  ON traded_deals FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated team inserts traded deals"
  ON traded_deals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());
CREATE POLICY "Authenticated team updates traded deals"
  ON traded_deals FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated team deletes traded deals"
  ON traded_deals FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE traded_deals IS
  'Authenticated Traded NY lead queue. HubSpot remains CRM system of record; this table stores source, enrichment, eligibility, and sync state.';
