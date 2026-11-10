-- ═══════════════════════════════════════════════════════════════════════════
-- 360°-Fotos für die Fahrzeug-Kartei
--
-- • Neuer Kartei-Abschnitt 'fotos' für Fahrerfreigaben
-- • Tabelle vehicle_spins: eine 360°-Serie pro Fahrzeug
-- • Privater Storage-Bucket 'vehicle-media', Dateien unter
--     <vehicle_id>/<spin_id>/<nr>.(webp|jpg)
--   Lesen: wer die Kartei sehen darf · Schreiben: Besitzer oder Abschnitt 'fotos'
--
-- Voraussetzung: Migration 20261109120000_fahrzeug_kartei.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Abschnitt 'fotos' erlauben ───────────────────────────────────────────
alter table public.vehicle_members drop constraint if exists vehicle_members_editable_sections_check;
alter table public.vehicle_members add constraint vehicle_members_editable_sections_check
  check (editable_sections <@ array['reifen','wartung','notizen','fotos']::text[]);

-- ── 2. 360°-Serien ──────────────────────────────────────────────────────────
create table if not exists public.vehicle_spins (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null unique references public.vehicles(id) on delete cascade,
  frame_count  integer not null check (frame_count between 8 and 72),
  -- Dateinamen der Bilder in Aufnahme-Reihenfolge (relativ zum Ordner <vehicle_id>/<id>/)
  files        text[] not null check (cardinality(files) = frame_count),
  front_frame  integer not null default 0 check (front_frame >= 0 and front_frame < frame_count),
  reverse      boolean not null default false,
  aspect       numeric(5,3) not null default 1.333 check (aspect > 0.2 and aspect < 5),
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

alter table public.vehicle_spins enable row level security;

drop policy if exists "vehicle_spins_select" on public.vehicle_spins;
create policy "vehicle_spins_select" on public.vehicle_spins
  for select to authenticated using (public.can_view_vehicle(vehicle_id));
drop policy if exists "vehicle_spins_insert" on public.vehicle_spins;
create policy "vehicle_spins_insert" on public.vehicle_spins
  for insert to authenticated with check (public.can_edit_vehicle_section(vehicle_id, 'fotos'));
drop policy if exists "vehicle_spins_update" on public.vehicle_spins;
create policy "vehicle_spins_update" on public.vehicle_spins
  for update to authenticated
  using (public.can_edit_vehicle_section(vehicle_id, 'fotos'))
  with check (public.can_edit_vehicle_section(vehicle_id, 'fotos'));
drop policy if exists "vehicle_spins_delete" on public.vehicle_spins;
create policy "vehicle_spins_delete" on public.vehicle_spins
  for delete to authenticated using (public.can_edit_vehicle_section(vehicle_id, 'fotos'));

-- ── 3. Storage ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-media', 'vehicle-media', false, 3145728, array['image/webp','image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Fahrzeug-ID aus dem ersten Pfadteil; ungültige Pfade → null (CASE garantiert die Reihenfolge)
create or replace function public.vehicle_id_from_path(p_name text)
returns uuid language sql immutable set search_path = '' as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

drop policy if exists "vehicle_media_select" on storage.objects;
create policy "vehicle_media_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'vehicle-media' and public.can_view_vehicle(public.vehicle_id_from_path(name)));

drop policy if exists "vehicle_media_insert" on storage.objects;
create policy "vehicle_media_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicle-media' and public.can_edit_vehicle_section(public.vehicle_id_from_path(name), 'fotos'));

drop policy if exists "vehicle_media_update" on storage.objects;
create policy "vehicle_media_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'vehicle-media' and public.can_edit_vehicle_section(public.vehicle_id_from_path(name), 'fotos'))
  with check (bucket_id = 'vehicle-media' and public.can_edit_vehicle_section(public.vehicle_id_from_path(name), 'fotos'));

drop policy if exists "vehicle_media_delete" on storage.objects;
create policy "vehicle_media_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vehicle-media' and public.can_edit_vehicle_section(public.vehicle_id_from_path(name), 'fotos'));
