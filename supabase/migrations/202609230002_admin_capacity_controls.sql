-- Retire the activity widget; retain the existing internal audit records.
drop function if exists public.admin_recent_activity();
drop index if exists public.admin_audit_log_created_at_idx;

-- Zero closes an empty category without closing registration for the event.
alter table public.event_category_limits drop constraint event_category_limits_max_entries_check;
alter table public.event_category_limits add constraint event_category_limits_max_entries_check check (max_entries >= 0);

create or replace function public.admin_get_category_limits(p_event_slug text)
returns table(category text, total integer, occupied bigint, remaining bigint)
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  return query
  select l.category, l.max_entries, used.entries, greatest(0::bigint, l.max_entries - used.entries)
  from public.event_category_limits l join public.events e on e.id = l.event_id
  cross join lateral (
    select count(distinct r.id) as entries from public.registrations r
    join public.participants p on p.registration_id = r.id
    join public.participant_categories pc on pc.participant_id = p.id
    where r.event_id = l.event_id and r.status = 'confirmed' and pc.category = l.category
  ) used
  where e.slug = p_event_slug order by l.category;
end;
$$;

create or replace function public.admin_update_category_limit(
  p_event_slug text, p_category text, p_total integer, p_expected_total integer
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event_id uuid;
  v_previous integer;
  v_occupied bigint;
begin
  if not private.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_total is null or p_total < 0 then raise exception 'INVALID_CAPACITY'; end if;
  select id into v_event_id from public.events where slug = p_event_slug;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  -- Same lock as registration, reactivation and category changes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('registration-capacity'), pg_catalog.hashtext(v_event_id::text));
  select max_entries into v_previous from public.event_category_limits
  where event_id = v_event_id and category = p_category for update;
  if not found then raise exception 'CATEGORY_NOT_FOUND'; end if;
  if v_previous is distinct from p_expected_total then raise exception 'STALE_CAPACITY'; end if;
  select count(distinct r.id) into v_occupied from public.registrations r
  join public.participants p on p.registration_id = r.id
  join public.participant_categories pc on pc.participant_id = p.id
  where r.event_id = v_event_id and r.status = 'confirmed' and pc.category = p_category;
  if p_total < v_occupied then raise exception 'CAPACITY_BELOW_OCCUPIED:%', v_occupied; end if;
  if p_total = v_previous then return; end if;
  update public.event_category_limits set max_entries = p_total, updated_at = now()
  where event_id = v_event_id and category = p_category;
  insert into public.admin_audit_log(auth_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'update_category_limit', 'event', v_event_id,
    jsonb_build_object('category', p_category, 'previous_total', v_previous, 'next_total', p_total));
end;
$$;

revoke all on function public.admin_get_category_limits(text) from public, anon;
revoke all on function public.admin_update_category_limit(text, text, integer, integer) from public, anon;
grant execute on function public.admin_get_category_limits(text) to authenticated;
grant execute on function public.admin_update_category_limit(text, text, integer, integer) to authenticated;
-- All admin edits must pass the serialized occupancy check above.
revoke insert, update, delete on public.event_category_limits from authenticated;
