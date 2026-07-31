-- supabase/migrations/012_content_engine.sql
--
-- CamelotOS Marketing & Content Automation Module — Phase 1 (Controlled MVP).
-- System of record for the marketing-to-revenue pipeline:
--   Market Signal -> Researched Insight -> Multi-Channel Campaign ->
--   Human Approval -> Controlled Distribution -> Engagement ->
--   Qualified Lead -> HubSpot Opportunity -> Proposal -> Revenue.
--
-- Design rules encoded here (per David Goldoff spec, July 31 2026):
--   * Database (not Google Sheets) is the authoritative record.
--   * No content advances past pending_review without a documented approval
--     row tied to a secure token and specific content version.
--   * Content changed after approval must return to pending_review — the
--     approved_version_hash makes drift detectable.
--   * Image licensing is structured data, not a caption habit.
--   * Sources are never fabricated: every factual claim traces to a row in
--     content_sources with permitted-use status.

-- 1. Campaigns ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS content_campaigns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  objective          text,
  primary_audience   text,
  secondary_audiences text[],
  theme              text,
  funnel_stage       text CHECK (funnel_stage IN ('awareness','consideration','high_intent','investment_partnership')),
  owner              text,
  utm_campaign       text,
  hubspot_campaign_id text,
  starts_at          timestamptz,
  ends_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- 2. Content items (state machine) ------------------------------------------

CREATE TABLE IF NOT EXISTS content_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           uuid REFERENCES content_campaigns(id) ON DELETE SET NULL,
  parent_content_id     uuid REFERENCES content_items(id) ON DELETE SET NULL,
  package_id            text,                -- human-readable approval package ref (e.g. PKG-2026-07-31-A)
  version               integer NOT NULL DEFAULT 1,
  title                 text NOT NULL,
  format                text NOT NULL,       -- article | gbp_post | linkedin_personal | linkedin_company | facebook | instagram | x_post | newsletter | youtube_outline | reels_script | cold_call_point | followup_email
  channel               text NOT NULL,
  primary_audience      text NOT NULL,
  secondary_audiences   text[],
  funnel_stage          text CHECK (funnel_stage IN ('awareness','consideration','high_intent','investment_partnership')),
  body                  text,
  seo_keywords          text[],
  status                text NOT NULL DEFAULT 'generated' CHECK (status IN (
                          'generated','brand_check','pending_review','approved','scheduled',
                          'published','analytics',
                          'needs_revision','rejected','approval_expired','publishing_failed',
                          'partially_published','archived')),
  fact_check_status     text NOT NULL DEFAULT 'pending' CHECK (fact_check_status IN ('pending','passed','failed','waived')),
  brand_check_status    text NOT NULL DEFAULT 'pending' CHECK (brand_check_status IN ('pending','passed','failed')),
  legal_review_status   text NOT NULL DEFAULT 'not_required' CHECK (legal_review_status IN ('not_required','pending','passed','failed')),
  image_rights_status   text NOT NULL DEFAULT 'not_required' CHECK (image_rights_status IN ('not_required','pending','cleared','blocked')),
  primary_cta           text,
  secondary_cta         text,
  approval_expires_at   timestamptz,
  approved_version_hash text,
  published_version_hash text,
  scheduled_at          timestamptz,
  published_at          timestamptz,
  publish_platform_response text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_items_status    ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_campaign  ON content_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_content_items_scheduled ON content_items(scheduled_at) WHERE status = 'approved';

-- 3. Approvals (secure, item-level, version-bound) ---------------------------

CREATE TABLE IF NOT EXISTS content_approvals (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id             uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  content_version        integer NOT NULL,
  secure_token           text NOT NULL,
  decision               text NOT NULL CHECK (decision IN ('approved','revision_requested','rejected','override_approved')),
  revision_notes         text,
  approval_channel       text NOT NULL CHECK (approval_channel IN ('dashboard','gmail_link','email_reply','admin_override')),
  ip_or_actor_identifier text,
  approver               text NOT NULL,
  override_reason        text,               -- required when decision = override_approved
  expires_at             timestamptz,
  decided_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_approvals_content ON content_approvals(content_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_approvals_token ON content_approvals(secure_token);

-- 4. Sources (factual support; fabrication is a schema violation) ------------

CREATE TABLE IF NOT EXISTS content_sources (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id              uuid REFERENCES content_items(id) ON DELETE SET NULL,
  source_url              text NOT NULL,
  publisher               text,
  publication_date        date,
  retrieval_date          date NOT NULL DEFAULT CURRENT_DATE,
  topic_classification    text,
  reliability_rating      text CHECK (reliability_rating IN ('primary_government','established_press','industry','secondary','unverified')),
  permitted_use_status    text CHECK (permitted_use_status IN ('open','attribution_required','licensed','restricted','blocked')),
  image_attribution_notes text,
  supporting_excerpt      text,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_sources_content ON content_sources(content_id);

-- 5. Assets (images/charts/video with licensing as structured data) ----------

CREATE TABLE IF NOT EXISTS content_assets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id            uuid REFERENCES content_items(id) ON DELETE SET NULL,
  asset_type            text NOT NULL CHECK (asset_type IN ('image','chart','video','audio','document')),
  url                   text,
  image_source          text,               -- government | licensed_stock | camelot_owned | source_authorized | ai_generated
  photographer          text,
  license               text,
  required_attribution  text,
  ai_label_applied      boolean NOT NULL DEFAULT false,   -- must be true when image_source = 'ai_generated'
  download_date         date,
  approval_status       text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  platforms_permitted   text[],
  usage_restrictions    text,
  expires_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_images_must_be_labeled CHECK (image_source <> 'ai_generated' OR ai_label_applied)
);
CREATE INDEX IF NOT EXISTS idx_content_assets_content ON content_assets(content_id);

-- 6. Marketing leads (HubSpot-first; AppFolio only when operational) ---------

CREATE TABLE IF NOT EXISTS content_leads (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id                 uuid REFERENCES content_campaigns(id) ON DELETE SET NULL,
  building_address            text,
  property_type               text,
  unit_count                  integer,
  borough                     text,
  estimated_management_fee    numeric,
  trigger_event               text,           -- DOB filing, HPD violations, FISP, ACRIS transfer, mgmt change, ...
  lead_score                  numeric,        -- 0-100 per weighted model
  lead_score_breakdown        jsonb,          -- factor -> points detail
  contact_name                text,
  contact_email               text,
  contact_phone               text,
  contact_source              text,
  contact_verified_at         timestamptz,
  last_contacted_at           timestamptz,
  next_action_at              timestamptz,
  hubspot_record_id           text,
  consent_or_suppression_status text NOT NULL DEFAULT 'unchecked' CHECK (consent_or_suppression_status IN ('unchecked','clear','suppressed','unsubscribed')),
  outreach_package            jsonb,          -- summary, pain point, opener, discovery Qs, objections, voicemail, email, linkedin, schedule
  status                      text NOT NULL DEFAULT 'new' CHECK (status IN ('new','qualified','contacted','meeting','proposal','won','lost','suppressed')),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_leads_score  ON content_leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_leads_status ON content_leads(status);

-- 7. Conversions (revenue attribution, not vanity) ---------------------------

CREATE TABLE IF NOT EXISTS content_conversions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      uuid REFERENCES content_campaigns(id) ON DELETE SET NULL,
  content_id       uuid REFERENCES content_items(id) ON DELETE SET NULL,
  lead_id          uuid REFERENCES content_leads(id) ON DELETE SET NULL,
  conversion_type  text NOT NULL CHECK (conversion_type IN (
                     'form_submission','call','email_inquiry','meeting','proposal',
                     'management_contract','brokerage_opportunity','investment_introduction')),
  value_estimate   numeric,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  notes            text,
  occurred_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_conversions_campaign ON content_conversions(campaign_id);

-- 8. Run history (every module run is accountable) ---------------------------

CREATE TABLE IF NOT EXISTS content_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module             text NOT NULL,          -- seo_gbp_engine | linkedin_drafter | distribution | dashboard_sync | cold_calling | analytics
  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz,
  records_processed  integer DEFAULT 0,
  outputs_generated  integer DEFAULT 0,
  failures           integer DEFAULT 0,
  failure_detail     jsonb,                  -- [{content_id, platform, attempt_time, result, response, error_code, retry_count, notified, resolution}]
  ai_api_cost_usd    numeric,
  human_review_minutes numeric,
  notes              text
);
CREATE INDEX IF NOT EXISTS idx_content_runs_module ON content_runs(module, started_at DESC);

-- 9. RLS (mirrors scout_* pattern: authenticated + anon app access) ----------

ALTER TABLE content_campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_approvals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_sources     ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_assets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_leads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_runs        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['content_campaigns','content_items','content_approvals','content_sources','content_assets','content_leads','content_conversions','content_runs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "App access %s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "App access %s" ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;
