begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_event uuid;
  v_audits bigint;
begin
  insert into auth.users(id) values(v_admin);
  insert into public.admin_users(auth_user_id, username, auth_email) values(v_admin, 'livestream-test', 'live@example.test');
  insert into public.events(slug, name, starts_at) values('livestream-test', 'Livestream test', now()) returning id into v_event;
  if not exists(select 1 from public.get_public_livestream('livestream-test') where not enabled and video_id is null) then raise exception 'TEST: default must be off'; end if;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.admin_get_livestream('livestream-test');
    raise exception 'TEST: non-admin read accepted';
  exception when raise_exception then if sqlerrm <> 'NOT_AUTHORIZED' then raise; end if; end;
  begin
    perform public.admin_update_livestream('livestream-test', true, 'M7lc1UVf-VE', 0);
    raise exception 'TEST: non-admin write accepted';
  exception when raise_exception then if sqlerrm <> 'NOT_AUTHORIZED' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.admin_update_livestream('livestream-test', false, 'M7lc1UVf-VE', 0);
  if not exists(select 1 from public.admin_get_livestream('livestream-test') where not enabled and video_id = 'M7lc1UVf-VE' and revision = 1) then raise exception 'TEST: draft not saved'; end if;
  if not exists(select 1 from public.get_public_livestream('livestream-test') where not enabled and video_id is null) then raise exception 'TEST: draft link leaked'; end if;
  perform public.admin_update_livestream('livestream-test', true, 'M7lc1UVf-VE', 1);
  if not exists(select 1 from public.get_public_livestream('livestream-test') where enabled and video_id = 'M7lc1UVf-VE') then raise exception 'TEST: enable failed'; end if;
  begin
    perform public.admin_update_livestream('livestream-test', false, 'M7lc1UVf-VE', 1);
    raise exception 'TEST: stale update accepted';
  exception when raise_exception then if sqlerrm <> 'STALE_LIVESTREAM' then raise; end if; end;
  begin
    perform public.admin_update_livestream('livestream-test', false, 'M7lc1UVf-VE', null);
    raise exception 'TEST: missing version accepted';
  exception when raise_exception then if sqlerrm <> 'STALE_LIVESTREAM' then raise; end if; end;
  begin
    perform public.admin_update_livestream('livestream-test', true, null, 2);
    raise exception 'TEST: enabled without video';
  exception when raise_exception then if sqlerrm <> 'INVALID_LIVESTREAM' then raise; end if; end;
  begin
    perform public.admin_update_livestream('livestream-test', false, '<iframe>', 2);
    raise exception 'TEST: invalid video accepted';
  exception when raise_exception then if sqlerrm <> 'INVALID_LIVESTREAM' then raise; end if; end;
  begin
    perform public.admin_update_livestream('livestream-test', null, null, 2);
    raise exception 'TEST: null toggle accepted';
  exception when raise_exception then if sqlerrm <> 'INVALID_LIVESTREAM' then raise; end if; end;
  begin
    perform public.admin_update_livestream('unknown-event', false, null, 0);
    raise exception 'TEST: unknown event accepted';
  exception when raise_exception then if sqlerrm <> 'EVENT_NOT_FOUND' then raise; end if; end;
  select count(*) into v_audits from public.admin_audit_log where target_id = v_event;
  perform public.admin_update_livestream('livestream-test', true, 'M7lc1UVf-VE', 2);
  if (select count(*) from public.admin_audit_log where target_id = v_event) <> v_audits then raise exception 'TEST: no-op audited'; end if;
  perform public.admin_update_livestream('livestream-test', false, 'M7lc1UVf-VE', 2);
  if not exists(select 1 from public.get_public_livestream('livestream-test') where not enabled and video_id is null) then raise exception 'TEST: disable failed'; end if;
  perform public.admin_update_livestream('livestream-test', false, null, 3);
  if not exists(select 1 from public.admin_get_livestream('livestream-test') where not enabled and video_id is null and revision = 4) then raise exception 'TEST: clear failed'; end if;
  update public.admin_users set active = false where auth_user_id = v_admin;
  begin
    perform public.admin_update_livestream('livestream-test', true, 'M7lc1UVf-VE', 4);
    raise exception 'TEST: inactive admin write accepted';
  exception when raise_exception then if sqlerrm <> 'NOT_AUTHORIZED' then raise; end if; end;
  if has_table_privilege('anon', 'public.event_livestreams', 'SELECT') or has_table_privilege('authenticated', 'public.event_livestreams', 'UPDATE') then raise exception 'TEST: direct table access'; end if;
  if has_function_privilege('anon', 'public.admin_get_livestream(text)', 'EXECUTE') or has_function_privilege('anon', 'public.admin_update_livestream(text,boolean,text,integer)', 'EXECUTE') then raise exception 'TEST: anonymous admin grant'; end if;
  if not has_function_privilege('anon', 'public.get_public_livestream(text)', 'EXECUTE') then raise exception 'TEST: public read missing'; end if;
end;
$$;
rollback;
