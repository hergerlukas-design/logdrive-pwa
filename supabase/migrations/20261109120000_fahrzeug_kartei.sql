-- ═══════════════════════════════════════════════════════════════════════════
-- Fahrzeug-Kartei: Stammdaten, Reifen, Wartung, Notizen, Fahrerfreigaben
--
-- Rechte:
--   • Besitzer (vehicles.user_id) darf alles.
--   • Freigegebene Fahrer (vehicle_members) dürfen die Kartei lesen und nur die
--     Abschnitte bearbeiten, die in editable_sections stehen:
--       'reifen'  → vehicle_tires
--       'wartung' → vehicle_service_log
--       'notizen' → vehicle_notes
--   • Stammdaten (Spalten in vehicles) bearbeitet nur der Besitzer.
--
-- Bestehende Policies auf vehicles bleiben unverändert; es wird nur eine
-- zusätzliche SELECT-Policy für freigegebene Fahrer ergänzt.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Stammdaten am Fahrzeug ───────────────────────────────────────────────
alter table public.vehicles
  add column if not exists body_type            text not null default 'limousine'
    check (body_type in ('kleinwagen','limousine','kombi','suv','transporter')),
  add column if not exists color                text not null default '#bc0120',
  add column if not exists vin                  text,
  add column if not exists first_registration   date,
  add column if not exists fuel_type            text
    check (fuel_type is null or fuel_type in ('benzin','diesel','elektro','hybrid','plugin_hybrid','gas','wasserstoff')),
  add column if not exists power_ps             integer check (power_ps is null or power_ps >= 0),
  add column if not exists displacement_ccm     integer check (displacement_ccm is null or displacement_ccm >= 0),
  add column if not exists top_speed_kmh        integer check (top_speed_kmh is null or top_speed_kmh >= 0),
  add column if not exists empty_weight_kg      integer check (empty_weight_kg is null or empty_weight_kg >= 0),
  add column if not exists consumption          numeric(5,2) check (consumption is null or consumption >= 0),
  add column if not exists hu_due               date,
  add column if not exists insurance            text,
  add column if not exists insurance_number     text,
  add column if not exists oil_type             text,
  add column if not exists service_interval_km  integer check (service_interval_km is null or service_interval_km > 0),
  add column if not exists next_service_km      integer check (next_service_km is null or next_service_km >= 0),
  add column if not exists next_service_date    date;

-- ── 2. Fahrerfreigaben ──────────────────────────────────────────────────────
create table if not exists public.vehicle_members (
  vehicle_id         uuid not null references public.vehicles(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  email              text not null,
  editable_sections  text[] not null default '{}'
    check (editable_sections <@ array['reifen','wartung','notizen']::text[]),
  created_at         timestamptz not null default now(),
  primary key (vehicle_id, user_id)
);
create index if not exists vehicle_members_user_id_idx on public.vehicle_members (user_id);

-- ── 3. Reifensätze ──────────────────────────────────────────────────────────
create table if not exists public.vehicle_tires (
  id                        uuid primary key default gen_random_uuid(),
  vehicle_id                uuid not null references public.vehicles(id) on delete cascade,
  season                    text not null default 'sommer' check (season in ('sommer','winter','ganzjahr')),
  brand                     text,
  model                     text,
  size                      text,               -- z. B. 225/45 R17
  load_speed_index          text,               -- z. B. 94W
  dot                       text,               -- z. B. 2323 (KW 23 / 2023)
  rim                       text,               -- z. B. Alu 7,5x17 ET45
  tread_depth_mm            numeric(3,1) check (tread_depth_mm is null or tread_depth_mm >= 0),
  pressure_front_bar        numeric(3,1) check (pressure_front_bar is null or pressure_front_bar between 0 and 10),
  pressure_rear_bar         numeric(3,1) check (pressure_rear_bar is null or pressure_rear_bar between 0 and 10),
  pressure_front_loaded_bar numeric(3,1) check (pressure_front_loaded_bar is null or pressure_front_loaded_bar between 0 and 10),
  pressure_rear_loaded_bar  numeric(3,1) check (pressure_rear_loaded_bar is null or pressure_rear_loaded_bar between 0 and 10),
  storage_location          text,
  is_mounted                boolean not null default false,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users(id) on delete set null default auth.uid()
);
create index if not exists vehicle_tires_vehicle_id_idx on public.vehicle_tires (vehicle_id);
-- Pro Fahrzeug höchstens ein montierter Satz
create unique index if not exists vehicle_tires_one_mounted_idx
  on public.vehicle_tires (vehicle_id) where is_mounted;

-- ── 4. Wartungsprotokoll ────────────────────────────────────────────────────
create table if not exists public.vehicle_service_log (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null references public.vehicles(id) on delete cascade,
  type         text not null check (type in ('oelwechsel','inspektion','reifenwechsel','hu','reparatur','sonstiges')),
  date         date not null default current_date,
  mileage      integer check (mileage is null or mileage >= 0),
  cost         numeric(10,2) check (cost is null or cost >= 0),
  workshop     text,
  description  text,
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists vehicle_service_log_vehicle_idx on public.vehicle_service_log (vehicle_id, date desc);

-- ── 5. Notizen ──────────────────────────────────────────────────────────────
create table if not exists public.vehicle_notes (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null references public.vehicles(id) on delete cascade,
  body         text not null check (length(trim(body)) > 0),
  author_email text,
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists vehicle_notes_vehicle_idx on public.vehicle_notes (vehicle_id, created_at desc);

-- ── 6. Hilfsfunktionen für RLS ──────────────────────────────────────────────
-- security definer, damit sich die Policies von vehicles und vehicle_members
-- nicht gegenseitig rekursiv auswerten.
create or replace function public.is_vehicle_owner(p_vehicle_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_view_vehicle(p_vehicle_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_vehicle_owner(p_vehicle_id) or exists (
    select 1 from public.vehicle_members m
    where m.vehicle_id = p_vehicle_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_edit_vehicle_section(p_vehicle_id uuid, p_section text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_vehicle_owner(p_vehicle_id) or exists (
    select 1 from public.vehicle_members m
    where m.vehicle_id = p_vehicle_id
      and m.user_id = (select auth.uid())
      and p_section = any (m.editable_sections)
  );
$$;

revoke all on function public.is_vehicle_owner(uuid)                 from public, anon;
revoke all on function public.can_view_vehicle(uuid)                 from public, anon;
revoke all on function public.can_edit_vehicle_section(uuid, text)   from public, anon;
grant execute on function public.is_vehicle_owner(uuid)               to authenticated;
grant execute on function public.can_view_vehicle(uuid)               to authenticated;
grant execute on function public.can_edit_vehicle_section(uuid, text) to authenticated;

-- ── 7. Fahrer per E-Mail freigeben (nur Besitzer) ───────────────────────────
create or replace function public.add_vehicle_member(
  p_vehicle_id uuid, p_email text, p_sections text[] default '{}'
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
  v_email   text := lower(trim(p_email));
begin
  if not public.is_vehicle_owner(p_vehicle_id) then
    raise exception 'Nur der Besitzer kann Fahrer freigeben.' using errcode = '42501';
  end if;

  select u.id into v_user_id from auth.users u where lower(u.email) = v_email;
  if v_user_id is null then
    raise exception 'Kein Konto mit dieser E-Mail gefunden. Der Fahrer muss sich zuerst registrieren.'
      using errcode = 'P0002';
  end if;
  if v_user_id = (select auth.uid()) then
    raise exception 'Du bist bereits Besitzer dieses Fahrzeugs.' using errcode = '22023';
  end if;

  insert into public.vehicle_members (vehicle_id, user_id, email, editable_sections)
  values (p_vehicle_id, v_user_id, v_email, coalesce(p_sections, '{}'))
  on conflict (vehicle_id, user_id) do update set editable_sections = excluded.editable_sections;
end;
$$;
revoke all on function public.add_vehicle_member(uuid, text, text[]) from public, anon;
grant execute on function public.add_vehicle_member(uuid, text, text[]) to authenticated;

-- ── 8. updated_at für Reifen ────────────────────────────────────────────────
create or replace function public.touch_vehicle_tires()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
drop trigger if exists vehicle_tires_touch on public.vehicle_tires;
create trigger vehicle_tires_touch before update on public.vehicle_tires
  for each row execute function public.touch_vehicle_tires();

-- ── 9. Row Level Security ───────────────────────────────────────────────────
alter table public.vehicle_members     enable row level security;
alter table public.vehicle_tires       enable row level security;
alter table public.vehicle_service_log enable row level security;
alter table public.vehicle_notes       enable row level security;

-- vehicles: freigegebene Fahrer dürfen lesen (zusätzlich zu den bestehenden Policies)
drop policy if exists "vehicles_select_members" on public.vehicles;
create policy "vehicles_select_members" on public.vehicles
  for select to authenticated
  using (exists (
    select 1 from public.vehicle_members m
    where m.vehicle_id = vehicles.id and m.user_id = (select auth.uid())
  ));

-- vehicle_members: Besitzer verwaltet, Fahrer sieht den eigenen Eintrag
drop policy if exists "members_select" on public.vehicle_members;
create policy "members_select" on public.vehicle_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_vehicle_owner(vehicle_id));

drop policy if exists "members_update_owner" on public.vehicle_members;
create policy "members_update_owner" on public.vehicle_members
  for update to authenticated
  using (public.is_vehicle_owner(vehicle_id))
  with check (public.is_vehicle_owner(vehicle_id));

drop policy if exists "members_delete" on public.vehicle_members;
create policy "members_delete" on public.vehicle_members
  for delete to authenticated
  using (public.is_vehicle_owner(vehicle_id) or user_id = (select auth.uid()));
-- INSERT läuft ausschließlich über add_vehicle_member()

-- Abschnitts-Tabellen: lesen = Freigabe, schreiben = Abschnittsrecht
do $$
declare
  t record;
begin
  for t in select * from (values
    ('vehicle_tires',       'reifen'),
    ('vehicle_service_log', 'wartung'),
    ('vehicle_notes',       'notizen')
  ) as x(tbl, section)
  loop
    execute format('drop policy if exists %I on public.%I', t.tbl || '_select', t.tbl);
    execute format('drop policy if exists %I on public.%I', t.tbl || '_insert', t.tbl);
    execute format('drop policy if exists %I on public.%I', t.tbl || '_update', t.tbl);
    execute format('drop policy if exists %I on public.%I', t.tbl || '_delete', t.tbl);

    execute format($p$create policy %I on public.%I for select to authenticated
      using (public.can_view_vehicle(vehicle_id))$p$, t.tbl || '_select', t.tbl);
    execute format($p$create policy %I on public.%I for insert to authenticated
      with check (public.can_edit_vehicle_section(vehicle_id, %L))$p$, t.tbl || '_insert', t.tbl, t.section);
    execute format($p$create policy %I on public.%I for update to authenticated
      using (public.can_edit_vehicle_section(vehicle_id, %L))
      with check (public.can_edit_vehicle_section(vehicle_id, %L))$p$, t.tbl || '_update', t.tbl, t.section, t.section);
    execute format($p$create policy %I on public.%I for delete to authenticated
      using (public.can_edit_vehicle_section(vehicle_id, %L))$p$, t.tbl || '_delete', t.tbl, t.section);
  end loop;
end $$;
