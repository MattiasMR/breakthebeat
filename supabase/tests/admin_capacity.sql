begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_event uuid;
  v_registration uuid;
  v_person uuid;
  v_audits bigint;
begin
  insert into auth.users(id) values (v_admin);
  insert into public.admin_users(auth_user_id, username, auth_email) values (v_admin, 'capacity-test-admin', 'capacity@example.test');
  insert into public.events(slug, name, starts_at) values ('admin-capacity-test', 'Test capacity', now()) returning id into v_event;
  insert into public.event_category_limits(event_id, category, max_entries) values (v_event, '1v1', 2), (v_event, '2v2', 2), (v_event, 'bgirls', 2);
  insert into public.registrations(event_id, public_code) values (v_event, 'CAPACITY-ADMIN-TEST') returning id into v_registration;
  insert into public.participants(event_id, registration_id, participant_code, role, display_name, social_url, age, country, city, phone, email, email_normalized)
  values (v_event, v_registration, 'CAPACITY-ADMIN-A', 'captain', 'Test Ana', '', 18, '', '', '12345678', 'capacity-a@example.test', 'capacity-a@example.test') returning id into v_person;
  insert into public.participant_categories values (v_person, '2v2');
  insert into public.participants(event_id, registration_id, participant_code, role, display_name, social_url, age, country, city, phone, email, email_normalized)
  values (v_event, v_registration, 'CAPACITY-ADMIN-B', 'partner', 'Test Bea', '', 18, '', '', '12345678', 'capacity-b@example.test', 'capacity-b@example.test') returning id into v_person;
  insert into public.participant_categories values (v_person, '2v2');
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.admin_update_category_limit('admin-capacity-test', '2v2', 3, 2);
    raise exception 'TEST: non-admin update accepted';
  exception when raise_exception then if sqlerrm <> 'NOT_AUTHORIZED' then raise; end if; end;
  begin
    perform public.admin_get_category_limits('admin-capacity-test');
    raise exception 'TEST: non-admin read accepted';
  exception when raise_exception then if sqlerrm <> 'NOT_AUTHORIZED' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  if not exists (select 1 from public.admin_get_category_limits('admin-capacity-test') where category = '2v2' and total = 2 and occupied = 1 and remaining = 1) then raise exception 'TEST: duo count wrong'; end if;
  perform public.admin_update_category_limit('admin-capacity-test', '2v2', 5, 2);
  if not exists (select 1 from public.admin_get_category_limits('admin-capacity-test') where category = '2v2' and total = 5 and remaining = 4) then raise exception 'TEST: increase failed'; end if;
  perform public.admin_update_category_limit('admin-capacity-test', '2v2', 1, 5);
  if not exists (select 1 from public.admin_get_category_limits('admin-capacity-test') where category = '2v2' and total = 1 and remaining = 0) then raise exception 'TEST: decrease to occupied failed'; end if;
  select count(*) into v_audits from public.admin_audit_log where action = 'update_category_limit' and target_id = v_event;
  perform public.admin_update_category_limit('admin-capacity-test', '2v2', 1, 1);
  if (select count(*) from public.admin_audit_log where action = 'update_category_limit' and target_id = v_event) <> v_audits then raise exception 'TEST: no-op audited'; end if;
  begin
    perform public.admin_update_category_limit('admin-capacity-test', '2v2', 0, 1);
    raise exception 'TEST: limit below occupied accepted';
  exception when raise_exception then if sqlerrm <> 'CAPACITY_BELOW_OCCUPIED:1' then raise; end if; end;
  begin
    perform public.admin_update_category_limit('admin-capacity-test', '2v2', 10, 5);
    raise exception 'TEST: stale update accepted';
  exception when raise_exception then if sqlerrm <> 'STALE_CAPACITY' then raise; end if; end;
  begin
    perform public.admin_update_category_limit('admin-capacity-test', '2v2', -1, 1);
    raise exception 'TEST: negative total accepted';
  exception when raise_exception then if sqlerrm <> 'INVALID_CAPACITY' then raise; end if; end;
  begin
    perform public.admin_update_category_limit('admin-capacity-test', '2v2', null, 1);
    raise exception 'TEST: null total accepted';
  exception when raise_exception then if sqlerrm <> 'INVALID_CAPACITY' then raise; end if; end;
  begin
    perform public.admin_update_category_limit('admin-capacity-test', 'invalid', 5, 1);
    raise exception 'TEST: invalid category accepted';
  exception when raise_exception then if sqlerrm <> 'CATEGORY_NOT_FOUND' then raise; end if; end;
  begin
    perform public.admin_update_category_limit('missing-event', '1v1', 5, 1);
    raise exception 'TEST: invalid event accepted';
  exception when raise_exception then if sqlerrm <> 'EVENT_NOT_FOUND' then raise; end if; end;
  if (select max_entries from public.event_category_limits where event_id = v_event and category = '2v2') <> 1 then raise exception 'TEST: failed write changed capacity'; end if;
  perform public.admin_update_category_limit('admin-capacity-test', 'bgirls', 0, 2);
  if not exists (select 1 from public.admin_get_category_limits('admin-capacity-test') where category = 'bgirls' and total = 0 and remaining = 0) then raise exception 'TEST: zero failed'; end if;
  begin
    insert into public.participant_categories values (v_person, 'bgirls');
    raise exception 'TEST: zero capacity allowed registration';
  exception when raise_exception then if sqlerrm <> 'CATEGORY_FULL:bgirls' then raise; end if; end;
  perform public.admin_update_category_limit('admin-capacity-test', 'bgirls', 1, 0);
  insert into public.participant_categories values (v_person, 'bgirls');
  if not exists (select 1 from public.admin_get_category_limits('admin-capacity-test') where category = 'bgirls' and occupied = 1 and remaining = 0) then raise exception 'TEST: reopening failed'; end if;
  update public.registrations set status = 'cancelled' where id = v_registration;
  perform public.admin_update_category_limit('admin-capacity-test', '2v2', 0, 1);
  if not exists (select 1 from public.admin_get_category_limits('admin-capacity-test') where category = '2v2' and occupied = 0 and total = 0) then raise exception 'TEST: cancelled registration counted'; end if;
  if has_table_privilege('authenticated', 'public.event_category_limits', 'UPDATE') then raise exception 'TEST: direct update bypass'; end if;
  if has_function_privilege('anon', 'public.admin_update_category_limit(text,text,integer,integer)', 'EXECUTE') then raise exception 'TEST: anonymous update grant'; end if;
  if to_regprocedure('public.admin_recent_activity()') is not null then raise exception 'TEST: activity RPC still exists'; end if;
end;
$$;
rollback;
