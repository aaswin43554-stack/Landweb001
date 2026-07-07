-- M1: core schema for the GIZ Land Use Transparency Prototype.
-- Every row this schema holds is fictional demo data (see README).
-- Human-facing IDs/reference codes use a DEMO- prefix so no export or
-- screenshot could ever be mistaken for a real cadastral record.

create table if not exists villages (
  id text primary key,
  name text not null,
  province text not null,
  languages_supported text[] not null default array['lo'],
  created_at timestamptz not null default now()
);

create table if not exists parcels (
  id text primary key,
  village_id text not null references villages (id) on delete cascade,
  demo_village_name text not null,
  status text not null check (status in ('registered', 'pending', 'disputed')),
  zone_type text not null check (zone_type in ('forest', 'agricultural', 'residential', 'disputed')),
  geo_coords jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists parcels_village_id_idx on parcels (village_id);

create sequence if not exists disputes_ref_seq;

create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  parcel_id text not null references parcels (id) on delete cascade,
  submitted_by text not null,
  description text,
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'resolved')),
  fake_reference_number text not null unique
    default ('DEMO-DSP-' || lpad(nextval('disputes_ref_seq')::text, 4, '0')),
  created_at timestamptz not null default now()
);

create index if not exists disputes_parcel_id_idx on disputes (parcel_id);

create table if not exists translations (
  key text primary key,
  lao_text text not null,
  sample_minority_language_text text not null
);

-- RLS: this is a public demo app with no auth. Anon key gets read access
-- to reference data, plus insert/read on disputes so the (future) M5
-- submission flow and M6 dashboard work without a login system.
alter table villages enable row level security;
alter table parcels enable row level security;
alter table disputes enable row level security;
alter table translations enable row level security;

create policy "public read villages" on villages for select using (true);
create policy "public read parcels" on parcels for select using (true);
create policy "public read translations" on translations for select using (true);
create policy "public read disputes" on disputes for select using (true);
create policy "public insert disputes" on disputes for insert with check (true);
