-- 022_neighborhood_leads_send_limits.sql
--
-- Neighborhood Leads Engine — daily send cap + manual-contact queue + daily
-- report log. Built per David's Aug 2026 direction:
--   - cap outbound intro emails at a conservative daily volume so a young
--     sending domain doesn't get flagged for spam;
--   - leads with no email on file go to a queue for a human to fill in
--     (name/title/phone/company/email), rather than blocking or guessing;
--   - once a day, email info@camelot.nyc a report of what went out (and to
--     whom) plus an attachment of leads still waiting on a human.
--
-- Audit note (Aug 29, 2026): of 5,602 leads in neighborhood_leads at the
-- time this migration was written, only 8 had contact_email populated.
-- 4,991 have a contact name + role, 4,008 have a management company name,
-- 0 have a phone number. The "Needs Email" queue is therefore the primary
-- day-to-day surface for this table, not an edge case.

-- ---------------------------------------------------------------------------
-- 1. Daily send counter. One row per calendar date (UTC), incremented
--    atomically by the send route. Kept separate from neighborhood_leads so
--    the cap check is a single indexed row read, not a COUNT(*) scan.
-- ---------------------------------------------------------------------------
create table if not exists neighborhood_send_daily_counter (
  send_date date primary key,
  sent_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table neighborhood_send_daily_counter enable row level security;

drop policy if exists "service role full access" on neighborhood_send_daily_counter;
create policy "service role full access" on neighborhood_send_daily_counter
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 2. Manual contact fields for the "Needs Email" queue. contact_email
--    already exists on neighborhood_leads (used as the send target); these
--    add the rest of what a human fills in when enriching a lead by hand,
--    plus who/when it was entered, so the daily report and UI can show it.
-- ---------------------------------------------------------------------------
alter table neighborhood_leads
  add column if not exists contact_title text,
  add column if not exists contact_name_manual text,
  add column if not exists contact_phone_manual text,
  add column if not exists contact_company_manual text,
  add column if not exists contact_entered_by text,
  add column if not exists contact_entered_at timestamptz;

comment on column neighborhood_leads.contact_title is 'Manually-entered job title for the send-to contact (queue page). management_contact_role is the HPD/PLUTO-sourced title; this is the human-verified one.';
comment on column neighborhood_leads.contact_name_manual is 'Manually-entered contact name from the Needs Email queue, when it differs from or fills in for management_contact_name.';
comment on column neighborhood_leads.contact_phone_manual is 'Manually-entered phone number — contact_phone is not populated by any current automated source (0/5602 as of Aug 2026).';
comment on column neighborhood_leads.contact_company_manual is 'Manually-entered company name from the queue, when management_company is blank or wrong.';

-- ---------------------------------------------------------------------------
-- 3. Daily report log — one row per day the report job runs, so the job is
--    idempotent (won't double-send if the server restarts mid-day) and so
--    there's a visible history of what was reported.
-- ---------------------------------------------------------------------------
create table if not exists neighborhood_daily_reports (
  id bigint generated always as identity primary key,
  report_date date not null unique,
  sent_count integer not null default 0,
  needs_email_count integer not null default 0,
  recipient text not null default 'info@camelot.nyc',
  resend_message_id text,
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped_no_activity')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table neighborhood_daily_reports enable row level security;

drop policy if exists "service role full access" on neighborhood_daily_reports;
create policy "service role full access" on neighborhood_daily_reports
  for all using (true) with check (true);

-- Helpful index for the "Needs Email" queue page (contact_email IS NULL).
create index if not exists idx_neighborhood_leads_needs_email
  on neighborhood_leads (discovered_at desc)
  where contact_email is null or contact_email = '';
