create table public.guest_attendances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  first_name text not null check (char_length(btrim(first_name)) between 2 and 80),
  last_name text not null check (char_length(btrim(last_name)) between 2 and 80),
  organization text check (organization is null or char_length(btrim(organization)) between 2 and 120),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guest_attendances_event_confirmed_at_idx
  on public.guest_attendances (event_id, confirmed_at desc);

create index guest_attendances_event_name_idx
  on public.guest_attendances (event_id, lower(first_name), lower(last_name));

create trigger guest_attendances_touch_updated_at
before update on public.guest_attendances
for each row execute function public.touch_updated_at();

alter table public.guest_attendances enable row level security;

create policy guest_attendances_admin_all on public.guest_attendances
for all to authenticated
using (private.is_admin())
with check (private.is_admin());

revoke all on table public.guest_attendances from public, anon, authenticated;
grant select on table public.guest_attendances to authenticated;
