-- 023_owner_contacts_calls_sms.sql
--
-- Three additions, all per David's Aug 2026 direction:
--
--   1. Owner-vs-agent distinction: neighborhood_leads gets an
--      is_owner_contact flag plus DOB Permit Issuance owner-section fields,
--      matching the corrected priority logic in leads-search.mjs
--      (enrichWithHpdContacts / enrichWithDobPermitOwner). Outbound email
--      must only ever target is_owner_contact = true leads.
--
--   2. Call tracking: a call log table backing the new Call Queue page —
--      supports both human-rep calls and AI-voice-agent calls, records
--      outcome, and enforces (at the application layer, logged here) that
--      calls only ever fire Mon-Fri 9am-5pm.
--
--   3. SMS consent tracking: per the TCPA research done Aug 2026, a text
--      may only be sent to a number that has affirmatively opted in first
--      (reply YES / text START to the number named in the intro email).
--      No cold texting. This table is the system of record for that
--      consent, checked before any text send.

-- ---------------------------------------------------------------------------
-- 1. Owner-vs-agent + DOB permit owner fields on neighborhood_leads.
-- ---------------------------------------------------------------------------
alter table neighborhood_leads
  add column if not exists is_owner_contact boolean not null default false,
  add column if not exists agent_contact_name text,
  add column if not exists dob_owner_name text,
  add column if not exists dob_owner_business_name text,
  add column if not exists dob_owner_business_type text,
  add column if not exists dob_filer_phone text;

comment on column neighborhood_leads.is_owner_contact is 'True only when management_contact_name was sourced from an owner-side HPD type (HeadOfficer/CorporateOwner/IndividualOwner) or a DOB permit owner-section match. Email/call/text MUST only target leads where this is true — never an Agent-type (management company) contact.';
comment on column neighborhood_leads.agent_contact_name is 'HPD Agent-type contact (a management company''s registered contact) — reference/CC only, NEVER an email/call/text send target. Distinct from management_contact_name, which is owner-side when is_owner_contact is true.';
comment on column neighborhood_leads.dob_owner_name is 'Owner first+last name from DOB Permit Issuance owner section (owner_s_first_name/owner_s_last_name) — corroborating signal alongside HPD.';
comment on column neighborhood_leads.dob_owner_business_name is 'Owner business/entity name from DOB Permit Issuance (owner_s_business_name).';
comment on column neighborhood_leads.dob_owner_business_type is 'Owner business type from DOB Permit Issuance (owner_s_business_type) — e.g. Individual, Corporation, LLC.';
comment on column neighborhood_leads.dob_filer_phone is 'Filing agent/expediter''s phone number from DOB Permit Issuance (permittee_s_phone__). NOT a confirmed direct line to the owner — a lead to verify, not a ready-to-call number. Never presented to a recipient as "the owner''s phone."';

create index if not exists idx_neighborhood_leads_owner_contact
  on neighborhood_leads (is_owner_contact)
  where is_owner_contact = true;

-- ---------------------------------------------------------------------------
-- 2. Call log — backs the Call Queue page. One row per call attempt
--    (human or AI), so a lead can have multiple attempts over time.
-- ---------------------------------------------------------------------------
create table if not exists neighborhood_lead_calls (
  id bigint generated always as identity primary key,
  lead_id bigint not null references neighborhood_leads(id) on delete cascade,
  call_type text not null check (call_type in ('human', 'ai_voice')),
  caller text, -- staff email for human calls; agent/system name for AI calls
  scheduled_for timestamptz, -- when an AI call is queued to fire
  called_at timestamptz, -- when the call actually happened
  outcome text check (outcome in (
    'pending', 'no_answer', 'voicemail', 'wrong_number',
    'confirmed_owner_meeting_requested', 'confirmed_owner_not_interested',
    'confirmed_owner_callback_requested', 'not_owner_or_board',
    'declined_to_verify', 'do_not_call_requested'
  )),
  notes text,
  hubspot_task_id text,
  hubspot_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table neighborhood_lead_calls enable row level security;

drop policy if exists "service role full access" on neighborhood_lead_calls;
create policy "service role full access" on neighborhood_lead_calls
  for all using (true) with check (true);

create index if not exists idx_neighborhood_lead_calls_lead
  on neighborhood_lead_calls (lead_id, created_at desc);

create index if not exists idx_neighborhood_lead_calls_pending
  on neighborhood_lead_calls (scheduled_for)
  where outcome = 'pending';

comment on table neighborhood_lead_calls is 'Call attempts (human or AI-voice) for the Call Queue page. call_type=ai_voice calls must only be scheduled/fired Mon-Fri 9am-5pm (enforced in application code — see leads-routes.mjs isWithinCallingHours); this table records what happened, it does not itself gate timing.';
comment on column neighborhood_lead_calls.outcome is 'do_not_call_requested must immediately stop all future calls/texts to this lead — checked by the Call Queue and any scheduling code before firing a new attempt.';

-- ---------------------------------------------------------------------------
-- 3. SMS consent — system of record for opt-in before any text is sent.
--    Per TCPA research (Aug 2026): consent must exist BEFORE the first
--    marketing/informational text, not just an opt-out offered afterward.
-- ---------------------------------------------------------------------------
create table if not exists neighborhood_lead_sms_consent (
  id bigint generated always as identity primary key,
  lead_id bigint not null references neighborhood_leads(id) on delete cascade,
  phone text not null,
  consent_status text not null default 'not_requested' check (consent_status in (
    'not_requested', 'requested', 'opted_in', 'opted_out', 'declined'
  )),
  consent_source text, -- e.g. 'email_reply_yes', 'sms_keyword_start', 'verbal_on_call'
  requested_at timestamptz,
  consented_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, phone)
);

alter table neighborhood_lead_sms_consent enable row level security;

drop policy if exists "service role full access" on neighborhood_lead_sms_consent;
create policy "service role full access" on neighborhood_lead_sms_consent
  for all using (true) with check (true);

comment on table neighborhood_lead_sms_consent is 'System of record for SMS opt-in. A text may only be sent to a (lead_id, phone) row where consent_status = opted_in. No cold texting — this is checked server-side before any SMS send, not just in the UI.';

create index if not exists idx_sms_consent_opted_in
  on neighborhood_lead_sms_consent (lead_id)
  where consent_status = 'opted_in';
