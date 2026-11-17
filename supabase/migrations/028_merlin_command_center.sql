-- Merlin command center.
-- Tasks, reusable templates, marketing campaigns, and an activity log an
-- external agent can read and write through /api/merlin/* (service role).
-- This file is not applied automatically. Do not seed sample buildings,
-- people, or campaigns.

create or replace function merlin_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  building_label text,
  assignee text,
  due_at timestamptz,
  source text not null default 'manual',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_status_priority on tasks (status, priority);
create index if not exists idx_tasks_assignee on tasks (assignee);
create index if not exists idx_tasks_building_label on tasks (building_label);
create index if not exists idx_tasks_updated_at on tasks (updated_at desc);

drop trigger if exists trg_tasks_updated_at on tasks;
create trigger trg_tasks_updated_at
  before update on tasks
  for each row execute function merlin_set_updated_at();

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text not null,
  category text not null default 'General',
  kind text not null default 'letter' check (kind in ('proposal', 'letter', 'notice', 'board_report', 'email', 'other')),
  body text not null default '',
  description text,
  source text not null default 'library',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_templates_kind_category on templates (kind, category);
create index if not exists idx_templates_title on templates (title);

drop trigger if exists trg_templates_updated_at on templates;
create trigger trg_templates_updated_at
  before update on templates
  for each row execute function merlin_set_updated_at();

create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  audience text,
  summary text,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketing_campaigns_status on marketing_campaigns (status);
create index if not exists idx_marketing_campaigns_updated_at on marketing_campaigns (updated_at desc);

drop trigger if exists trg_marketing_campaigns_updated_at on marketing_campaigns;
create trigger trg_marketing_campaigns_updated_at
  before update on marketing_campaigns
  for each row execute function merlin_set_updated_at();

create table if not exists merlin_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'merlin',
  action text not null,
  module text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_merlin_activity_created on merlin_activity_log (created_at desc);
create index if not exists idx_merlin_activity_module on merlin_activity_log (module);

drop trigger if exists trg_merlin_activity_updated_at on merlin_activity_log;
create trigger trg_merlin_activity_updated_at
  before update on merlin_activity_log
  for each row execute function merlin_set_updated_at();

alter table tasks enable row level security;
alter table templates enable row level security;
alter table marketing_campaigns enable row level security;
alter table merlin_activity_log enable row level security;

revoke all on table tasks from anon, public;
revoke all on table templates from anon, public;
revoke all on table marketing_campaigns from anon, public;
revoke all on table merlin_activity_log from anon, public;

grant select, insert, update, delete on tasks to authenticated, service_role;
grant select, insert, update, delete on templates to authenticated, service_role;
grant select, insert, update, delete on marketing_campaigns to authenticated, service_role;
grant select, insert, update, delete on merlin_activity_log to authenticated, service_role;

drop policy if exists "Authenticated team manages tasks" on tasks;
create policy "Authenticated team manages tasks"
  on tasks for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Authenticated team manages templates" on templates;
create policy "Authenticated team manages templates"
  on templates for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Authenticated team manages marketing campaigns" on marketing_campaigns;
create policy "Authenticated team manages marketing campaigns"
  on marketing_campaigns for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Authenticated team reads merlin activity" on merlin_activity_log;
create policy "Authenticated team reads merlin activity"
  on merlin_activity_log for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "Authenticated team writes merlin activity" on merlin_activity_log;
create policy "Authenticated team writes merlin activity"
  on merlin_activity_log for insert to authenticated
  with check (auth.uid() is not null);
