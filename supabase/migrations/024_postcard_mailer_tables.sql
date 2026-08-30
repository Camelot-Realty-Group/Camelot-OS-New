-- Postcard Mailer system tables (Aug 2026)
--
-- outreach_campaigns: orchestrates multi-channel campaigns (email → call → mailer)
-- postcard_quote_responses: captures responses from QR code landing pages

create table if not exists outreach_campaigns (
  id bigserial primary key,
  lead_ids bigint[] not null,
  source_tool text not null, -- results, pipeline, factory-engine, etc.
  campaign_type text not null, -- postcard_only, email_first, call_first
  template_id text,
  scheduled_email timestamp,
  scheduled_call timestamp,
  scheduled_mailer timestamp not null,
  status text not null default 'pending_mailer', -- pending_mailer, in_progress, sent, completed, failed
  cost_estimate numeric(10,2),
  approver_note text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  hubspot_sync_at timestamp with time zone,
  updated_at timestamp with time zone default now()
);

create index idx_outreach_campaigns_status_date
  on outreach_campaigns(status, scheduled_mailer)
  where status in ('pending_mailer', 'pending_call', 'pending_email');

create table if not exists postcard_quote_responses (
  id bigserial primary key,
  lead_id bigint not null references neighborhood_leads(id) on delete cascade,
  respondent_name text,
  respondent_email text,
  respondent_phone text,
  message text,
  consent_given boolean default false,
  response_received_at timestamp with time zone not null,
  created_at timestamp with time zone default now(),
  hubspot_synced_at timestamp with time zone
);

create index idx_postcard_responses_lead
  on postcard_quote_responses(lead_id);

create index idx_postcard_responses_email
  on postcard_quote_responses(respondent_email);

create index idx_postcard_responses_timestamp
  on postcard_quote_responses(response_received_at desc);

-- RLS: service role can read/write all
alter table outreach_campaigns enable row level security;
alter table postcard_quote_responses enable row level security;

create policy outreach_campaigns_service_role
  on outreach_campaigns
  for all
  using (true)
  with check (true);

create policy postcard_responses_service_role
  on postcard_quote_responses
  for all
  using (true)
  with check (true);

grant all on outreach_campaigns to service_role;
grant all on postcard_quote_responses to service_role;
grant all on table outreach_campaigns to authenticated;
grant select on table postcard_quote_responses to authenticated;
