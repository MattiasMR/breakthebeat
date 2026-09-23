-- Run in an isolated database or in a transaction: no test records are retained.
begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_event uuid;
  v_registration uuid;
  v_other_registration uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_expected jsonb;
  v_changes jsonb;
  v_audit_count integer;
begin
  insert into auth.users(id) values (v_admin);
  insert into public.admin_users(auth_user_id, username, auth_email) values (v_admin, 'category-test-admin', 'test@example.test');
  insert into public.events(slug, name, starts_at) values ('admin-categories-test', 'Test', now()) returning id into v_event;
  insert into public.event_category_limits(event_id, category, max_entries)
  values (v_event, '1v1', 1), (v_event, '2v2', 1), (v_event, 'bgirls', 2);
  insert into public.registrations(event_id, public_code) values (v_event, 'ADMIN-TEST-DUO') returning id into v_registration;
  insert into public.registrations(event_id, public_code) values (v_event, 'ADMIN-TEST-OTHER') returning id into v_other_registration;
  insert into public.participants(event_id, registration_id, participant_code, role, display_name, social_url, age, country, city, phone, email, email_normalized)
  values (v_event, v_registration, 'ADMIN-TEST-A', 'captain', 'Test Ana', '', 18, '', '', '12345678', 'a@example.test', 'a@example.test') returning id into v_a;
  insert into public.participants(event_id, registration_id, participant_code, role, display_name, social_url, age, country, city, phone, email, email_normalized)
  values (v_event, v_registration, 'ADMIN-TEST-B', 'partner', 'Test Bea', '', 18, '', '', '12345678', 'b@example.test', 'b@example.test') returning id into v_b;
  insert into public.participants(event_id, registration_id, participant_code, role, display_name, social_url, age, country, city, phone, email, email_normalized)
  values (v_event, v_other_registration, 'ADMIN-TEST-C', 'captain', 'Test Ceci', '', 18, '', '', '12345678', 'c@example.test', 'c@example.test') returning id into v_c;
  insert into public.participant_categories values (v_a, '2v2'), (v_b, '2v2'), (v_c, '1v1');
  v_expected := jsonb_build_array(jsonb_build_object('id', v_a, 'categories', jsonb_build_array('2v2')), jsonb_build_object('id', v_b, 'categories', jsonb_build_array('2v2')));

  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.admin_update_categories(v_registration, v_expected, v_expected, 'confirmed');
    raise exception 'TEST: non-admin edit accepted';
  exception when raise_exception then if sqlerrm <> 'NOT_AUTHORIZED' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  v_changes := jsonb_set(v_expected, '{0,categories}', '["2v2", "bgirls"]');
  perform public.admin_update_categories(v_registration, v_expected, v_changes, 'confirmed');
  if not exists (select 1 from public.participant_categories where participant_id = v_a and category = 'bgirls') then raise exception 'TEST: category missing'; end if;
  if not exists (select 1 from public.admin_audit_log where action = 'update_participant_categories' and target_id = v_registration
    and metadata->'before' @> v_expected and metadata->'after' @> v_changes
    and metadata->'participants'->v_a::text->>'name' = 'Test Ana') then raise exception 'TEST: audit incomplete'; end if;
  select count(*) into v_audit_count from public.admin_audit_log where target_id = v_registration;
  perform public.admin_update_categories(v_registration, v_changes, v_changes, 'confirmed');
  if (select count(*) from public.admin_audit_log where target_id = v_registration) <> v_audit_count then raise exception 'TEST: no-op logged'; end if;
  begin
    perform public.admin_update_categories(v_registration, v_expected, v_changes, 'confirmed');
    raise exception 'TEST: stale edit accepted';
  exception when raise_exception then if sqlerrm <> 'STALE_CATEGORIES' then raise; end if; end;
  v_expected := v_changes;
  begin
    perform public.admin_update_categories(v_registration, v_expected, v_changes, 'cancelled');
    raise exception 'TEST: stale status accepted';
  exception when raise_exception then if sqlerrm <> 'STALE_CATEGORIES' then raise; end if; end;
  begin
    perform public.admin_update_categories(v_registration, v_expected, jsonb_set(v_expected, '{0,categories}', '[]'), 'confirmed');
    raise exception 'TEST: empty categories accepted';
  exception when raise_exception then if sqlerrm <> 'INVALID_CATEGORIES' then raise; end if; end;
  begin
    perform public.admin_update_categories(v_registration, v_expected, jsonb_set(v_expected, '{0,categories}', '["invalid"]'), 'confirmed');
    raise exception 'TEST: invalid category accepted';
  exception when raise_exception then if sqlerrm <> 'INVALID_CATEGORIES' then raise; end if; end;
  begin
    perform public.admin_update_categories(v_registration, v_expected, jsonb_set(v_expected, '{0,categories}', '["bgirls"]'), 'confirmed');
    raise exception 'TEST: orphan duo accepted';
  exception when raise_exception then if sqlerrm <> 'DUO_REQUIRES_TWO' then raise; end if; end;
  begin
    perform public.admin_update_categories(v_registration, v_expected, jsonb_set(v_expected, '{1,categories}', '["2v2", "bgirls"]'), 'confirmed');
    raise exception 'TEST: shared individual category accepted';
  exception when raise_exception then if sqlerrm <> 'INDIVIDUAL_CATEGORY_SHARED' then raise; end if; end;
  begin
    perform public.admin_update_categories(v_registration, v_expected, jsonb_set(v_expected, '{0,id}', to_jsonb(v_c::text)), 'confirmed');
    raise exception 'TEST: foreign participant accepted';
  exception when raise_exception then if sqlerrm <> 'INVALID_CATEGORIES' then raise; end if; end;
  begin
    perform public.admin_update_categories(v_registration, v_expected, jsonb_set(v_expected, '{0,categories}', '["2v2", "1v1"]'), 'confirmed');
    raise exception 'TEST: capacity bypassed';
  exception when raise_exception then if sqlerrm <> 'CATEGORY_FULL:1v1' then raise; end if; end;
  if not exists (select 1 from public.participant_categories where participant_id = v_a and category = 'bgirls') then raise exception 'TEST: failed change lost original category'; end if;
  if (select count(*) from public.admin_audit_log where target_id = v_registration) <> v_audit_count then raise exception 'TEST: failed change audited'; end if;

  -- Another registration with the same email/category must still be rejected.
  update public.participants set email_normalized = 'a@example.test' where id = v_c;
  update public.event_category_limits set max_entries = 2 where event_id = v_event and category = '1v1';
  begin
    perform public.admin_update_categories(v_registration, v_expected, jsonb_set(v_expected, '{0,categories}', '["2v2", "1v1"]'), 'confirmed');
    raise exception 'TEST: duplicate email/category accepted';
  exception when raise_exception then if sqlerrm <> 'DUPLICATE_PARTICIPANT_CATEGORY:1v1' then raise; end if; end;
  update public.participants set email_normalized = 'c@example.test' where id = v_c;
  v_changes := jsonb_build_array(jsonb_build_object('id', v_a, 'categories', jsonb_build_array('bgirls')), jsonb_build_object('id', v_b, 'categories', jsonb_build_array('1v1')));
  perform public.admin_update_categories(v_registration, v_expected, v_changes, 'confirmed');
  if exists (select 1 from public.participant_categories where participant_id in (v_a, v_b) and category = '2v2') then raise exception 'TEST: duo not removed from both'; end if;
  v_expected := v_changes;
  v_changes := jsonb_set(jsonb_set(v_expected, '{0,categories}', '["bgirls", "2v2"]'), '{1,categories}', '["1v1", "2v2"]');
  perform public.admin_update_categories(v_registration, v_expected, v_changes, 'confirmed');
  if (select count(*) from public.participant_categories where participant_id in (v_a, v_b) and category = '2v2') <> 2 then raise exception 'TEST: duo not restored'; end if;
  begin
    perform public.admin_update_categories(v_other_registration,
      jsonb_build_array(jsonb_build_object('id', v_c, 'categories', jsonb_build_array('1v1'))),
      jsonb_build_array(jsonb_build_object('id', v_c, 'categories', jsonb_build_array('2v2'))), 'confirmed');
    raise exception 'TEST: solo duo accepted';
  exception when raise_exception then if sqlerrm <> 'DUO_REQUIRES_TWO' then raise; end if; end;
  update public.registrations set status = 'cancelled' where id = v_registration;
  perform public.admin_update_categories(v_registration, v_changes, v_expected, 'cancelled');
  if (select status from public.registrations where id = v_registration) <> 'cancelled' then raise exception 'TEST: category edit reactivated registration'; end if;
  if has_function_privilege('anon', 'public.admin_update_categories(uuid,jsonb,jsonb,text)', 'EXECUTE')
    then raise exception 'TEST: anonymous grant'; end if;
end;
$$;
rollback;
