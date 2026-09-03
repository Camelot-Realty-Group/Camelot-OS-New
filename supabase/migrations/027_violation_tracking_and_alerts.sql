-- 027_violation_tracking_and_alerts.sql
-- Camelot OS — Violation & Resolution Center: internal workflow tracking
-- (status/notes/attachments) + portfolio-wide monitoring & alert subscriptions.
--
-- Every violation row from NYC Open Data (HPD/DOB/ECB, see src/lib/nyc-violations.ts)
-- is addressed by a stable natural key: source + violation_id + normalized address.
-- We never store the underlying violation data itself here (NYC Open Data remains
-- the source of truth, fetched live) — only Camelot's internal workflow state and
-- watch/alert bookkeeping layered on top of it.
--
-- Safe to re-run (idempotent): every CREATE uses IF NOT EXISTS.

-- 1. Internal tracking state for a single violation ---------------------------

CREATE TABLE IF NOT EXISTS violation_tracking (
  id                BIGSERIAL PRIMARY KEY,
  violation_key     TEXT UNIQUE NOT NULL, -- `${source}|${violationId}|${normalizedAddress}`
  building_id       BIGINT REFERENCES buildings(id) ON DELETE SET NULL,
  address           TEXT NOT NULL,
  borough           TEXT,
  source            TEXT NOT NULL CHECK (source IN ('HPD', 'DOB', 'ECB', 'FDNY', 'DOH')),
  violation_id      TEXT NOT NULL,
  internal_status   TEXT NOT NULL DEFAULT 'new'
                    CHECK (internal_status IN (
                      'new', 'assigned', 'vendor_scheduled', 'fix_in_progress',
                      'certified_pending_city', 'dismissal_filed', 'resolved', 'not_me'
                    )),
  assigned_to       TEXT,
  assigned_to_email TEXT,
  due_date          DATE,
  hearing_outcome   TEXT CHECK (hearing_outcome IN ('won', 'settled', 'adjourned', 'default', 'pending', NULL)),
  hearing_outcome_notes TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  updated_by        TEXT
);

CREATE INDEX IF NOT EXISTS idx_violation_tracking_building ON violation_tracking(building_id);
CREATE INDEX IF NOT EXISTS idx_violation_tracking_address  ON violation_tracking(address);
CREATE INDEX IF NOT EXISTS idx_violation_tracking_status   ON violation_tracking(internal_status);

-- 2. Notes thread ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS violation_notes (
  id             BIGSERIAL PRIMARY KEY,
  violation_key  TEXT NOT NULL,
  author         TEXT NOT NULL,
  body           TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_violation_notes_key ON violation_notes(violation_key);

-- 3. Document / photo attachments -----------------------------------------------
-- Files themselves live in the Supabase Storage bucket 'violation-documents'
-- (created below); this table indexes them by violation_key for easy lookup.

CREATE TABLE IF NOT EXISTS violation_documents (
  id             BIGSERIAL PRIMARY KEY,
  violation_key  TEXT NOT NULL,
  filename       TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  content_type   TEXT,
  size_bytes     INTEGER,
  doc_type       TEXT DEFAULT 'other' CHECK (doc_type IN (
                   'violation_notice', 'proof_of_correction', 'dismissal_request',
                   'permit', 'inspection_report', 'photo', 'other'
                 )),
  uploaded_by    TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_violation_documents_key ON violation_documents(violation_key);

INSERT INTO storage.buckets (id, name, public)
  VALUES ('violation-documents', 'violation-documents', false)
  ON CONFLICT (id) DO NOTHING;

-- 4. Portfolio-wide watch snapshot (change detection for the monitor job) ------

CREATE TABLE IF NOT EXISTS violation_watch_snapshot (
  id                 BIGSERIAL PRIMARY KEY,
  building_id        BIGINT REFERENCES buildings(id) ON DELETE CASCADE,
  address            TEXT NOT NULL,
  source             TEXT NOT NULL,
  violation_id       TEXT NOT NULL,
  first_seen_at      TIMESTAMPTZ DEFAULT now(),
  last_status        TEXT,
  last_seen_at       TIMESTAMPTZ DEFAULT now(),
  hearing_date       DATE,
  hearing_alerted_at TIMESTAMPTZ,
  UNIQUE (address, source, violation_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_snapshot_building ON violation_watch_snapshot(building_id);

-- 5. Alert subscriptions ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS violation_alert_subscriptions (
  id                       BIGSERIAL PRIMARY KEY,
  email                    TEXT NOT NULL,
  name                     TEXT,
  scope                    TEXT NOT NULL DEFAULT 'portfolio' CHECK (scope IN ('portfolio', 'building')),
  building_id              BIGINT REFERENCES buildings(id) ON DELETE CASCADE,
  notify_new_violations    BOOLEAN DEFAULT true,
  notify_status_changes    BOOLEAN DEFAULT true,
  notify_hearings_days_before INTEGER DEFAULT 7,
  is_active                BOOLEAN DEFAULT true,
  created_at               TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_subs_active ON violation_alert_subscriptions(is_active);

-- 6. Monitor run log ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS violation_alert_log (
  id                    BIGSERIAL PRIMARY KEY,
  run_at                TIMESTAMPTZ DEFAULT now(),
  buildings_scanned     INTEGER DEFAULT 0,
  new_violations_found  INTEGER DEFAULT 0,
  status_changes_found  INTEGER DEFAULT 0,
  hearings_flagged      INTEGER DEFAULT 0,
  emails_sent           INTEGER DEFAULT 0,
  duration_ms           INTEGER,
  error                 TEXT
);

-- 7. RLS — consistent with the hardened pattern in 014/018: authenticated only ---

ALTER TABLE violation_tracking             ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_notes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_watch_snapshot       ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_alert_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_alert_log            ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE violation_tracking             FROM anon;
REVOKE ALL ON TABLE violation_notes                FROM anon;
REVOKE ALL ON TABLE violation_documents            FROM anon;
REVOKE ALL ON TABLE violation_watch_snapshot       FROM anon;
REVOKE ALL ON TABLE violation_alert_subscriptions  FROM anon;
REVOKE ALL ON TABLE violation_alert_log            FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE violation_tracking            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE violation_notes               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE violation_documents           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE violation_watch_snapshot      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE violation_alert_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE violation_alert_log          TO authenticated;

DROP POLICY IF EXISTS "Authenticated team access violation_tracking" ON violation_tracking;
CREATE POLICY "Authenticated team access violation_tracking" ON violation_tracking
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated team access violation_notes" ON violation_notes;
CREATE POLICY "Authenticated team access violation_notes" ON violation_notes
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated team access violation_documents" ON violation_documents;
CREATE POLICY "Authenticated team access violation_documents" ON violation_documents
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated team access violation_watch_snapshot" ON violation_watch_snapshot;
CREATE POLICY "Authenticated team access violation_watch_snapshot" ON violation_watch_snapshot
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated team access violation_alert_subscriptions" ON violation_alert_subscriptions;
CREATE POLICY "Authenticated team access violation_alert_subscriptions" ON violation_alert_subscriptions
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated team access violation_alert_log" ON violation_alert_log;
CREATE POLICY "Authenticated team access violation_alert_log" ON violation_alert_log
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Storage policies for the violation-documents bucket: authenticated users only.
DROP POLICY IF EXISTS "Authenticated read violation-documents" ON storage.objects;
CREATE POLICY "Authenticated read violation-documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'violation-documents');

DROP POLICY IF EXISTS "Authenticated write violation-documents" ON storage.objects;
CREATE POLICY "Authenticated write violation-documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'violation-documents');

DROP POLICY IF EXISTS "Authenticated delete violation-documents" ON storage.objects;
CREATE POLICY "Authenticated delete violation-documents" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'violation-documents');

COMMENT ON TABLE violation_tracking IS
  'Camelot-internal workflow state layered on top of live NYC Open Data violations — status, assignment, due date, hearing outcome. Keyed by violation_key = source|violationId|normalizedAddress.';
COMMENT ON TABLE violation_watch_snapshot IS
  'Change-detection snapshot used by the portfolio-wide monitor job (server.js violation-monitor) to find new violations and status changes since the last scan.';
COMMENT ON TABLE violation_alert_subscriptions IS
  'Who gets notified by the portfolio-wide violation monitor, and for which building(s) / event types.';
