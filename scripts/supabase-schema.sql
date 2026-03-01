-- ============================================================
-- GPS Bus Tracker – Supabase Schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor)
-- ============================================================

-- ── Custom Types ────────────────────────────────────────────
create type public.user_role as enum ('student', 'driver', 'admin', 'transport_head');
create type public.alert_type as enum ('sos_driver', 'sos_student', 'device_failure', 'low_battery', 'delay', 'geofence', 'info');
create type public.alert_severity as enum ('info', 'warning', 'critical');

-- ── profiles (extends auth.users) ───────────────────────────
create table public.profiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  name      text not null,
  role      public.user_role not null default 'student',
  route_id  bigint,
  phone     text,
  created_at timestamptz default now()
);

-- ── routes ──────────────────────────────────────────────────
create table public.routes (
  id          bigserial primary key,
  name        text not null,
  description text,
  color       text default '#f59e0b',
  created_at  timestamptz default now()
);

-- Add FK from profiles to routes (after routes table exists)
alter table public.profiles
  add constraint profiles_route_id_fkey
  foreign key (route_id) references public.routes (id) on delete set null;

-- ── stops ───────────────────────────────────────────────────
create table public.stops (
  id         bigserial primary key,
  route_id   bigint references public.routes (id) on delete cascade,
  name       text not null,
  lat        real not null,
  lng        real not null,
  radius     integer default 100,
  stop_order integer default 0
);

-- ── buses ───────────────────────────────────────────────────
create table public.buses (
  id        bigserial primary key,
  number    text unique not null,
  driver_id uuid references public.profiles (id) on delete set null,
  route_id  bigint references public.routes (id) on delete set null,
  capacity  integer default 50,
  model     text default 'Standard Bus',
  status    text default 'active' check (status in ('active', 'inactive', 'maintenance'))
);

-- ── trips ───────────────────────────────────────────────────
create table public.trips (
  id              bigserial primary key,
  bus_id          bigint references public.buses (id) on delete cascade,
  driver_id       uuid references public.profiles (id) on delete set null,
  route_id        bigint references public.routes (id) on delete set null,
  start_time      timestamptz default now(),
  end_time        timestamptz,
  status          text default 'active' check (status in ('active', 'completed', 'disconnected')),
  tracking_status text default 'connected' check (tracking_status in ('connected', 'disconnected')),
  last_seen       timestamptz default now(),
  current_lat     real,
  current_lng     real,
  current_speed   real default 0,
  battery_level   integer default 100
);

-- ── locations ───────────────────────────────────────────────
create table public.locations (
  id            bigserial primary key,
  trip_id       bigint references public.trips (id) on delete cascade,
  lat           real not null,
  lng           real not null,
  speed         real default 0,
  battery_level integer default 100,
  timestamp     timestamptz default now()
);

-- ── attendance ──────────────────────────────────────────────
create table public.attendance (
  id           bigserial primary key,
  student_id   uuid references public.profiles (id) on delete cascade,
  trip_id      bigint references public.trips (id) on delete cascade,
  stop_id      bigint references public.stops (id) on delete set null,
  boarding_time timestamptz default now()
);

-- ── alerts ──────────────────────────────────────────────────
create table public.alerts (
  id           bigserial primary key,
  type         public.alert_type not null,
  title        text not null,
  message      text not null,
  bus_id       bigint references public.buses (id) on delete set null,
  trip_id      bigint references public.trips (id) on delete set null,
  triggered_by uuid references public.profiles (id) on delete set null,
  severity     public.alert_severity default 'info',
  is_read      boolean default false,
  created_at   timestamptz default now()
);

-- ── Trigger: auto-create profile on signup ──────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, route_id, phone, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'student'),
    (new.raw_user_meta_data ->> 'route_id')::bigint,
    new.raw_user_meta_data ->> 'phone',
    now()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Row Level Security (optional – enable per table as needed) ──
-- alter table public.profiles enable row level security;
-- create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
