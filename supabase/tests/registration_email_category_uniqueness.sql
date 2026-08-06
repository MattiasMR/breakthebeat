begin;

do $email_category_test$
declare
  v_event_id uuid;
  v_first_registration uuid;
  v_second_registration uuid;
  v_replacement_registration uuid;
  v_participant_id uuid;
  v_registration_count integer;
begin
  insert into public.events(slug, name, starts_at)
  values ('email-category-uniqueness-test', 'Email category uniqueness test', now())
  returning id into v_event_id;

  insert into public.registrations(event_id, public_code)
  values (v_event_id, 'EMAIL-CATEGORY-TEST-A')
  returning id into v_first_registration;

  insert into public.participants(
    event_id, registration_id, participant_code, role, display_name, social_url,
    age, country, city, phone, email, email_normalized
  ) values (
    v_event_id, v_first_registration, 'EMAIL-CATEGORY-TEST-A-1', 'captain',
    'First category', '', 18, '', '', '12345678',
    'repeat@example.test', 'repeat@example.test'
  ) returning id into v_participant_id;

  insert into public.participant_categories(participant_id, category)
  values (v_participant_id, '1v1');

  -- The same email is valid in a different category.
  insert into public.registrations(event_id, public_code)
  values (v_event_id, 'EMAIL-CATEGORY-TEST-B')
  returning id into v_second_registration;

  insert into public.participants(
    event_id, registration_id, participant_code, role, display_name, social_url,
    age, country, city, phone, email, email_normalized
  ) values (
    v_event_id, v_second_registration, 'EMAIL-CATEGORY-TEST-B-1', 'captain',
    'Second category', '', 18, '', '', '12345678',
    'repeat@example.test', 'repeat@example.test'
  ) returning id into v_participant_id;

  insert into public.participant_categories(participant_id, category)
  values (v_participant_id, 'bgirls');

  -- Repeating an active email/category pair rolls back the whole attempt.
  begin
    insert into public.registrations(event_id, public_code)
    values (v_event_id, 'EMAIL-CATEGORY-TEST-DUPLICATE');

    insert into public.participants(
      event_id, registration_id, participant_code, role, display_name, social_url,
      age, country, city, phone, email, email_normalized
    )
    select v_event_id, registration.id, 'EMAIL-CATEGORY-TEST-DUPLICATE-1', 'captain',
           'Duplicate category', '', 18, '', '', '12345678',
           'repeat@example.test', 'repeat@example.test'
    from public.registrations registration
    where registration.public_code = 'EMAIL-CATEGORY-TEST-DUPLICATE'
    returning id into v_participant_id;

    insert into public.participant_categories(participant_id, category)
    values (v_participant_id, '1v1');

    raise exception 'Expected DUPLICATE_PARTICIPANT_CATEGORY was not raised';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'DUPLICATE_PARTICIPANT_CATEGORY:1v1' then
        raise;
      end if;
  end;

  select count(*)
  into v_registration_count
  from public.registrations
  where event_id = v_event_id;

  if v_registration_count <> 2 then
    raise exception 'Duplicate attempt was not rolled back: registrations %', v_registration_count;
  end if;

  -- A cancelled registration no longer blocks that email/category pair.
  update public.registrations
  set status = 'cancelled'
  where id = v_first_registration;

  insert into public.registrations(event_id, public_code)
  values (v_event_id, 'EMAIL-CATEGORY-TEST-REPLACEMENT')
  returning id into v_replacement_registration;

  insert into public.participants(
    event_id, registration_id, participant_code, role, display_name, social_url,
    age, country, city, phone, email, email_normalized
  ) values (
    v_event_id, v_replacement_registration, 'EMAIL-CATEGORY-TEST-REPLACEMENT-1', 'captain',
    'Replacement category', '', 18, '', '', '12345678',
    'repeat@example.test', 'repeat@example.test'
  ) returning id into v_participant_id;

  insert into public.participant_categories(participant_id, category)
  values (v_participant_id, '1v1');

  -- Reactivating the cancelled duplicate must also be rejected.
  begin
    update public.registrations
    set status = 'confirmed'
    where id = v_first_registration;

    raise exception 'Expected duplicate reactivation to be rejected';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'DUPLICATE_PARTICIPANT_CATEGORY:1v1' then
        raise;
      end if;
  end;

  if (select status from public.registrations where id = v_first_registration) <> 'cancelled' then
    raise exception 'Rejected reactivation changed the registration status';
  end if;
end;
$email_category_test$;

rollback;
