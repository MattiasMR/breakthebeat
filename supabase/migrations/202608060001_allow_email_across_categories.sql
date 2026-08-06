alter table public.participants
drop constraint if exists participants_event_id_email_normalized_key;

create index if not exists participants_event_email_normalized_idx
on public.participants(event_id, email_normalized);

comment on index public.participants_event_email_normalized_idx is
'Supports category-scoped duplicate checks while allowing the same email in different categories.';

create or replace function private.enforce_participant_category_email_uniqueness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_id uuid;
  v_category text;
  v_event_id uuid;
  v_registration_status text;
  v_email_normalized text;
begin
  v_participant_id := new.participant_id;
  v_category := new.category;

  select participant.event_id,
         registration.status,
         participant.email_normalized
  into v_event_id,
       v_registration_status,
       v_email_normalized
  from public.participants participant
  join public.registrations registration
    on registration.id = participant.registration_id
  where participant.id = v_participant_id;

  if v_event_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_PARTICIPANT';
  end if;

  -- Use the same event lock as the capacity rules so concurrent submissions
  -- cannot register the same email and category at the same time.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('registration-capacity'),
    pg_catalog.hashtext(v_event_id::text)
  );

  if v_registration_status <> 'confirmed' then
    return new;
  end if;

  if exists (
    select 1
    from public.participants existing_participant
    join public.registrations existing_registration
      on existing_registration.id = existing_participant.registration_id
    join public.participant_categories existing_category
      on existing_category.participant_id = existing_participant.id
    where existing_participant.event_id = v_event_id
      and existing_participant.email_normalized = v_email_normalized
      and existing_participant.id <> v_participant_id
      and existing_registration.status = 'confirmed'
      and existing_category.category = v_category
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'DUPLICATE_PARTICIPANT_CATEGORY:' || v_category;
  end if;

  return new;
end;
$$;

create trigger participant_categories_active_email_category_unique
before insert or update on public.participant_categories
for each row execute function private.enforce_participant_category_email_uniqueness();

create or replace function private.enforce_registration_category_email_uniqueness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duplicate_category text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('registration-capacity'),
    pg_catalog.hashtext(new.event_id::text)
  );

  if old.status = 'confirmed' or new.status <> 'confirmed' then
    return new;
  end if;

  select candidate_category.category
  into v_duplicate_category
  from public.participants candidate
  join public.participant_categories candidate_category
    on candidate_category.participant_id = candidate.id
  join public.participants existing_participant
    on existing_participant.event_id = candidate.event_id
   and existing_participant.email_normalized = candidate.email_normalized
   and existing_participant.registration_id <> candidate.registration_id
  join public.registrations existing_registration
    on existing_registration.id = existing_participant.registration_id
   and existing_registration.status = 'confirmed'
  join public.participant_categories existing_category
    on existing_category.participant_id = existing_participant.id
   and existing_category.category = candidate_category.category
  where candidate.registration_id = new.id
  order by candidate_category.category
  limit 1;

  if v_duplicate_category is not null then
    raise exception using
      errcode = 'P0001',
      message = 'DUPLICATE_PARTICIPANT_CATEGORY:' || v_duplicate_category;
  end if;

  return new;
end;
$$;

create trigger registrations_active_email_category_unique
before update of status on public.registrations
for each row execute function private.enforce_registration_category_email_uniqueness();
