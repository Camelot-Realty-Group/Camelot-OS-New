-- 028_sublet_renewals.sql
-- Camelot OS — Sublet Renewal Tracker
--
-- Work queue of co-op/condo sublet leases expiring soon, pulled from Spire MDS
-- by src/api/sublet-renewal-routes.mjs. Snapshot columns are refreshed by each
-- scan; workflow columns (status, fee_*, assigned_to, notes, sublease_rent,
-- next_follow_up) are only ever changed by people.
--
-- Contains tenant PII. RLS is enabled with NO anon/authenticated policies:
-- only the server (service role) can read or write. Safe to re-run.

CREATE TABLE IF NOT EXISTS sublet_renewals (
  id                     BIGSERIAL PRIMARY KEY,
  renewal_key            TEXT UNIQUE NOT NULL,   -- buildingRcd:unitRcd:leaseEndDate

  -- Spire linkage
  spire_building_rcd     BIGINT,
  spire_unit_rcd         BIGINT,
  spire_occupancy_rcd    BIGINT,

  -- Building / unit
  building_number        TEXT,
  building_name          TEXT,
  building_address       TEXT,
  building_type          TEXT,                   -- coop_condo | rental
  unit_number            TEXT,
  bedrooms               NUMERIC,
  bathrooms              NUMERIC,
  square_feet            INTEGER,
  property_manager       TEXT,
  property_manager_email TEXT,

  -- Parties
  owner_name             TEXT,
  owner_email            TEXT,
  owner_phone            TEXT,
  owner_mailing_address  TEXT,
  subtenant_name         TEXT,
  subtenant_email        TEXT,
  subtenant_phone        TEXT,
  additional_subtenants  JSONB DEFAULT '[]'::jsonb,

  -- Lease
  lease_start_date       DATE,
  lease_end_date         DATE,
  move_in_date           DATE,
  days_to_expiry         INTEGER,
  urgency                TEXT,                   -- expired | critical | urgent | notice_window | upcoming
  recorded_rent          NUMERIC,                -- MDS BaseRent as recorded
  sublease_rent          NUMERIC,                -- confirmed sublease rent (entered by team)
  monthly_charges        NUMERIC,
  security_deposit       NUMERIC,
  balance_due            NUMERIC,
  in_legal               BOOLEAN DEFAULT false,

  -- Detection
  detection_confidence   TEXT,                   -- confirmed | likely
  detection_signals      JSONB DEFAULT '[]'::jsonb,
  still_in_mds           BOOLEAN DEFAULT true,

  -- Workflow (people only)
  status                 TEXT NOT NULL DEFAULT 'identified' CHECK (status IN (
                           'identified','owner_notified','renewal_received','filed','fee_billed',
                           'closed_renewed','not_renewing','brokerage_opportunity','brokerage_listed',
                           'brokerage_leased','no_response','dismissed')),
  fee_amount             NUMERIC NOT NULL DEFAULT 150,
  fee_status             TEXT NOT NULL DEFAULT 'not_billed' CHECK (fee_status IN ('not_billed','billed','paid','waived')),
  brokerage_interest     BOOLEAN,
  assigned_to            TEXT,
  notes                  TEXT,
  next_follow_up         DATE,
  owner_notified_at      TIMESTAMPTZ,

  -- Bookkeeping
  first_seen_at          TIMESTAMPTZ DEFAULT now(),
  last_seen_at           TIMESTAMPTZ DEFAULT now(),
  entered_window_at      TIMESTAMPTZ,            -- first scan that saw it at 60–90 days
  digest_sent_at         TIMESTAMPTZ,            -- first team digest that included it
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sublet_renewals_days_idx     ON sublet_renewals (days_to_expiry);
CREATE INDEX IF NOT EXISTS sublet_renewals_status_idx   ON sublet_renewals (status);
CREATE INDEX IF NOT EXISTS sublet_renewals_building_idx ON sublet_renewals (spire_building_rcd);

CREATE TABLE IF NOT EXISTS sublet_renewal_activity (
  id          BIGSERIAL PRIMARY KEY,
  renewal_id  BIGINT REFERENCES sublet_renewals(id) ON DELETE CASCADE,
  actor       TEXT,
  action      TEXT NOT NULL,                      -- identified | updated | owner_notice_sent
  detail      JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sublet_renewal_activity_renewal_idx ON sublet_renewal_activity (renewal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sublet_renewal_scans (
  id                BIGSERIAL PRIMARY KEY,
  trigger           TEXT,                          -- scheduled | manual
  buildings_scanned INTEGER,
  units_returned    INTEGER,
  sublets_found     INTEGER,
  inserted          INTEGER,
  updated           INTEGER,
  entered_window    INTEGER,
  errors            JSONB DEFAULT '[]'::jsonb,
  duration_ms       INTEGER,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sublet_renewals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sublet_renewal_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE sublet_renewal_scans    ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service role bypasses RLS; browsers get nothing.
