-- Edit a complete registration atomically; existing capacity/email triggers remain authoritative.
create or replace function public.admin_update_categories(
  p_registration_id uuid,
  p_expected jsonb,
  p_changes jsonb,
  p_expected_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_status text;
  v_before jsonb;
  v_after jsonb;
  v_names jsonb;
  v_code text;
  v_count integer;
  v_duos integer;
begin
  if not private.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select event_id into v_event_id from public.registrations where id = p_registration_id;
  if not found then raise exception 'REGISTRATION_NOT_FOUND'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('registration-capacity'), pg_catalog.hashtext(v_event_id::text));
  select status, public_code into v_status, v_code from public.registrations where id = p_registration_id for update;
  if not found then raise exception 'REGISTRATION_NOT_FOUND'; end if;
  perform 1 from public.participants where registration_id = p_registration_id order by id for update;

  select jsonb_agg(jsonb_build_object('id', p.id, 'categories', coalesce((
    select jsonb_agg(pc.category order by pc.category) from public.participant_categories pc where pc.participant_id = p.id
  ), '[]'::jsonb)) order by p.id),
  jsonb_object_agg(p.id::text, jsonb_build_object('name', p.display_name, 'code', p.participant_code)), count(*)
  into v_before, v_names, v_count
  from public.participants p where p.registration_id = p_registration_id;

  if v_status is distinct from p_expected_status or p_expected is null
     or not (v_before @> p_expected and p_expected @> v_before) then
    raise exception 'STALE_CATEGORIES';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then raise exception 'INVALID_CATEGORIES'; end if;
  if jsonb_array_length(p_changes) <> v_count or v_count not between 1 and 2 then raise exception 'INVALID_CATEGORIES'; end if;
  if (select count(distinct item->>'id') from jsonb_array_elements(p_changes) item) <> v_count then raise exception 'INVALID_CATEGORIES'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_changes) item
    where not exists (select 1 from public.participants p where p.id::text = item->>'id' and p.registration_id = p_registration_id)
       or jsonb_typeof(item->'categories') is distinct from 'array'
  ) then raise exception 'INVALID_CATEGORIES'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_changes) item
    where jsonb_array_length(item->'categories') not between 1 and 3
       or exists (select 1 from jsonb_array_elements_text(item->'categories') c where c is null or c not in ('1v1', '2v2', 'bgirls'))
       or (select count(distinct c) from jsonb_array_elements_text(item->'categories') c) <> jsonb_array_length(item->'categories')
  ) then raise exception 'INVALID_CATEGORIES'; end if;
  select count(*) into v_duos from jsonb_array_elements(p_changes) item where item->'categories' ? '2v2';
  if v_duos <> 0 and (v_count <> 2 or v_duos <> 2) then raise exception 'DUO_REQUIRES_TWO'; end if;
  -- Each individual category represents a single competitor in a registration.
  if exists (
    select c from jsonb_array_elements(p_changes) item, jsonb_array_elements_text(item->'categories') c
    where c <> '2v2' group by c having count(*) > 1
  ) then raise exception 'INDIVIDUAL_CATEGORY_SHARED'; end if;
  if v_before @> p_changes and p_changes @> v_before then return; end if;

  delete from public.participant_categories pc using public.participants p
  where pc.participant_id = p.id and p.registration_id = p_registration_id
    and not exists (select 1 from jsonb_array_elements(p_changes) item where item->>'id' = p.id::text and item->'categories' ? pc.category);
  insert into public.participant_categories(participant_id, category)
  select (item->>'id')::uuid, c from jsonb_array_elements(p_changes) item, jsonb_array_elements_text(item->'categories') c
  where not exists (select 1 from public.participant_categories pc where pc.participant_id = (item->>'id')::uuid and pc.category = c)
  order by item->>'id', c;
  select jsonb_agg(jsonb_build_object('id', item->>'id', 'categories', item->'categories') order by item->>'id') into v_after
  from jsonb_array_elements(p_changes) item;
  insert into public.admin_audit_log(auth_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'update_participant_categories', 'registration', p_registration_id,
    jsonb_build_object('public_code', v_code, 'participants', v_names, 'before', v_before, 'after', v_after));
end;
$$;
revoke all on function public.admin_update_categories(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.admin_update_categories(uuid, jsonb, jsonb, text) to authenticated;

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc, id desc);

create or replace function public.admin_recent_activity()
returns table(id uuid, action text, target_type text, target_id uuid, metadata jsonb, created_at timestamptz, username text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  return query select l.id, l.action, l.target_type, l.target_id, l.metadata, l.created_at,
    coalesce(a.username, case when l.auth_user_id is null then 'Sistema / QR' else 'Administrador anterior' end)
  from public.admin_audit_log l left join public.admin_users a on a.auth_user_id = l.auth_user_id
  order by l.created_at desc, l.id desc limit 60;
end;
$$;
revoke all on function public.admin_recent_activity() from public, anon;
grant execute on function public.admin_recent_activity() to authenticated;
