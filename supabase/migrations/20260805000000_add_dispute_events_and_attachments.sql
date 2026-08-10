-- Closes the citizen feedback loop and stops evidence being smuggled
-- through the free-text description column.
--
-- Two problems this fixes:
--   1. Officer status updates used to overwrite disputes.description,
--      destroying whatever the citizen originally wrote. Status changes
--      now live in their own append-only table.
--   2. Photo/audio URLs were appended to description as
--      "[Photo Evidence: url, url]" and regex-parsed back out, which
--      broke on commas in URLs or citizens typing the marker themselves.
--
-- Still 100% fictional demo data — see README.

create table if not exists dispute_events (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes (id) on delete cascade,
  from_status text check (from_status in ('submitted', 'in_review', 'resolved')),
  to_status text not null check (to_status in ('submitted', 'in_review', 'resolved')),
  actor text not null default 'officer-demo',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists dispute_events_dispute_id_idx
  on dispute_events (dispute_id, created_at);

create table if not exists dispute_attachments (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes (id) on delete cascade,
  kind text not null check (kind in ('photo', 'audio')),
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists dispute_attachments_dispute_id_idx
  on dispute_attachments (dispute_id);

alter table dispute_events enable row level security;
alter table dispute_attachments enable row level security;

-- Same posture as the existing tables: public demo app, no auth.
create policy "public read dispute_events" on dispute_events for select using (true);
create policy "public insert dispute_events" on dispute_events for insert with check (true);
create policy "public read dispute_attachments" on dispute_attachments for select using (true);
create policy "public insert dispute_attachments" on dispute_attachments for insert with check (true);

-- The officer dashboard updates disputes.status, which previously had no
-- update policy at all — every officer action silently fell back to the
-- localStorage override path.
drop policy if exists "public update disputes" on disputes;
create policy "public update disputes" on disputes for update using (true) with check (true);

-- Every dispute gets a "submitted" event so the citizen timeline always
-- has a first entry, including for rows created before this migration.
create or replace function log_dispute_submitted()
returns trigger
language plpgsql
as $$
begin
  insert into dispute_events (dispute_id, from_status, to_status, actor, note)
  values (new.id, null, new.status, new.submitted_by, null);
  return new;
end;
$$;

drop trigger if exists disputes_log_submitted on disputes;
create trigger disputes_log_submitted
  after insert on disputes
  for each row execute function log_dispute_submitted();

insert into dispute_events (dispute_id, from_status, to_status, actor, created_at)
select d.id, null, 'submitted', d.submitted_by, d.created_at
from disputes d
where not exists (
  select 1 from dispute_events e where e.dispute_id = d.id
);
