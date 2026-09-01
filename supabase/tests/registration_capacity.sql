begin;

do $capacity_test$
declare
  v_event_id uuid;
  v_first_registration uuid;
  v_second_registration uuid;
  v_participant_id uuid;
  v_partner_id uuid;
  v_confirmed_entries integer;
  v_confirmed_people integer;
begin
  insert into public.events(slug, name, starts_at)
  values ('capacity-trigger-rollback-test', 'Capacity trigger rollback test', now())
  returning id into v_event_id;

  insert into public.event_category_limits(event_id, category, max_entries)
  values (v_event_id, '2v2', 1);

  insert into public.registrations(event_id, public_code)
  values (v_event_id, 'CAPACITY-TEST-A')
  returning id into v_first_registration;

  insert into public.participants(
    event_id, registration_id, participant_code, role, display_name, social_url,
    age, country, city, phone, email, email_normalized
  ) values (
    v_event_id, v_first_registration, 'CAPACITY-TEST-A-1', 'captain',
    'Test captain', '', 18, '', '', '12345678',
    'capacity-a1@example.test', 'capacity-a1@example.test'
  ) returning id into v_participant_id;

  insert into public.participants(
    event_id, registration_id, participant_code, role, display_name, social_url,
    age, country, city, phone, email, email_normalized
  ) values (
    v_event_id, v_first_registration, 'CAPACITY-TEST-A-2', 'partner',
    'Test partner', '', 18, '', '', '12345678',
    'capacity-a2@example.test', 'capacity-a2@example.test'
  ) returning id into v_partner_id;

  insert into public.participant_categories(participant_id, category)
  values (v_participant_id, '2v2'), (v_partner_id, '2v2');

  select count(distinct registration.id), count(distinct participant.id)
  into v_confirmed_entries, v_confirmed_people
  from public.registrations registration
  join public.participants participant
    on participant.registration_id = registration.id
  join public.participant_categories category
    on category.participant_id = participant.id
  where registration.event_id = v_event_id
    and registration.status = 'confirmed'
    and category.category = '2v2';

  if v_confirmed_entries <> 1 or v_confirmed_people <> 2 then
    raise exception
      '2v2 accounting failed: entries %, people %',
      v_confirmed_entries,
      v_confirmed_people;
  end if;

  update public.registrations
  set status = 'cancelled'
  where id = v_first_registration;

  insert into public.registrations(event_id, public_code)
  values (v_event_id, 'CAPACITY-TEST-B')
  returning id into v_second_registration;

  insert into public.participants(
    event_id, registration_id, participant_code, role, display_name, social_url,
    age, country, city, phone, email, email_normalized
  ) values (
    v_event_id, v_second_registration, 'CAPACITY-TEST-B-1', 'captain',
    'Replacement captain', '', 18, '', '', '12345678',
    'capacity-b1@example.test', 'capacity-b1@example.test'
  ) returning id into v_participant_id;

  insert into public.participant_categories(participant_id, category)
  values (v_participant_id, '2v2');

  begin
    update public.registrations
    set status = 'confirmed'
    where id = v_first_registration;

    raise exception 'Expected CATEGORY_FULL was not raised on reactivation';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'CATEGORY_FULL:2v2' then
        raise;
      end if;
  end;

  if (select status from public.registrations where id = v_first_registration) <> 'cancelled' then
    raise exception 'Failed reactivation must leave the registration deactivated';
  end if;

  delete from public.registrations
  where id = v_first_registration;

  if exists (
    select 1
    from public.participants
    where registration_id = v_first_registration
  ) then
    raise exception 'Registration cascade cleanup failed';
  end if;

  delete from public.registrations
  where id = v_second_registration;
end;
$capacity_test$;

rollback;
