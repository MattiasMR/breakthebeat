create table public.event_category_limits (
  event_id uuid not null references public.events(id) on delete cascade,
  category text not null check (category in ('1v1', '2v2', 'bgirls')),
  max_entries integer not null check (max_entries > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, category)
);

comment on table public.event_category_limits is
'Maximum number of confirmed registration entries allowed per event category. A 2v2 registration counts as one entry even though it contains two people.';

insert into public.event_category_limits(event_id, category, max_entries)
select e.id, category.name, 50
from public.events e
cross join (values ('1v1'), ('2v2'), ('bgirls')) as category(name)
where e.slug = 'break-the-beat-2026'
on conflict (event_id, category) do update
set max_entries = excluded.max_entries,
    updated_at = now();

create index participant_categories_category_participant_idx
on public.participant_categories(category, participant_id);

create index registrations_event_status_idx
on public.registrations(event_id, status, id);

create or replace function private.enforce_participant_category_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_id uuid;
  v_category text;
  v_event_id uuid;
  v_registration_id uuid;
  v_registration_status text;
  v_max_entries integer;
  v_occupied_entries integer;
begin
  v_participant_id := case when tg_op = 'DELETE' then old.participant_id else new.participant_id end;
  v_category := case when tg_op = 'DELETE' then old.category else new.category end;

  select p.event_id, p.registration_id, r.status
  into v_event_id, v_registration_id, v_registration_status
  from public.participants p
  join public.registrations r on r.id = p.registration_id
  where p.id = v_participant_id;

  if v_event_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_PARTICIPANT';
  end if;

  -- One event-level transaction lock serializes all capacity changes and avoids
  -- deadlocks when the same registration selects more than one category.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('registration-capacity'),
    pg_catalog.hashtext(v_event_id::text)
  );

  if tg_op = 'DELETE' or v_registration_status <> 'confirmed' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select limit_row.max_entries
  into v_max_entries
  from public.event_category_limits limit_row
  where limit_row.event_id = v_event_id
    and limit_row.category = v_category;

  if v_max_entries is null then
    return new;
  end if;

  -- The partner row in 2v2 belongs to the same registration and therefore does
  -- not consume a second entry.
  if exists (
    select 1
    from public.participants existing_participant
    join public.participant_categories existing_category
      on existing_category.participant_id = existing_participant.id
    where existing_participant.registration_id = v_registration_id
      and existing_category.category = v_category
  ) then
    return new;
  end if;

  select count(distinct registration.id)
  into v_occupied_entries
  from public.registrations registration
  join public.participants participant
    on participant.registration_id = registration.id
  join public.participant_categories participant_category
    on participant_category.participant_id = participant.id
  where registration.event_id = v_event_id
    and registration.status = 'confirmed'
    and participant_category.category = v_category;

  if v_occupied_entries >= v_max_entries then
    raise exception using
      errcode = 'P0001',
      message = 'CATEGORY_FULL:' || v_category;
  end if;

  return new;
end;
$$;

create trigger participant_categories_capacity_insert
before insert on public.participant_categories
for each row execute function private.enforce_participant_category_capacity();

create trigger participant_categories_capacity_delete
before delete on public.participant_categories
for each row execute function private.enforce_participant_category_capacity();

create or replace function private.enforce_registration_status_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_category text;
  v_max_entries integer;
  v_occupied_entries integer;
begin
  v_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('registration-capacity'),
    pg_catalog.hashtext(v_event_id::text)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  if old.status = 'confirmed' or new.status <> 'confirmed' then
    return new;
  end if;

  for v_category in
    select distinct participant_category.category
    from public.participants participant
    join public.participant_categories participant_category
      on participant_category.participant_id = participant.id
    where participant.registration_id = new.id
    order by participant_category.category
  loop
    select limit_row.max_entries
    into v_max_entries
    from public.event_category_limits limit_row
    where limit_row.event_id = v_event_id
      and limit_row.category = v_category;

    if v_max_entries is null then
      continue;
    end if;

    select count(distinct registration.id)
    into v_occupied_entries
    from public.registrations registration
    join public.participants participant
      on participant.registration_id = registration.id
    join public.participant_categories participant_category
      on participant_category.participant_id = participant.id
    where registration.event_id = v_event_id
      and registration.status = 'confirmed'
      and registration.id <> new.id
      and participant_category.category = v_category;

    if v_occupied_entries >= v_max_entries then
      raise exception using
        errcode = 'P0001',
        message = 'CATEGORY_FULL:' || v_category;
    end if;
  end loop;

  return new;
end;
$$;

create trigger registrations_capacity_status_update
before update of status on public.registrations
for each row execute function private.enforce_registration_status_capacity();

create trigger registrations_capacity_delete
before delete on public.registrations
for each row execute function private.enforce_registration_status_capacity();

alter table public.event_category_limits enable row level security;

create policy event_category_limits_public_read
on public.event_category_limits
for select to anon, authenticated
using (exists (
  select 1
  from public.events event
  where event.id = event_id
    and event.slug = 'break-the-beat-2026'
));

create policy event_category_limits_admin_all
on public.event_category_limits
for all to authenticated
using (private.is_admin())
with check (private.is_admin());

revoke all on public.event_category_limits from public, anon, authenticated;
grant select on public.event_category_limits to anon, authenticated;
grant insert, update, delete on public.event_category_limits to authenticated;

