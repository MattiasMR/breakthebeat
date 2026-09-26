-- Separate settings prevent existing event update grants from bypassing validation.
create table public.event_livestreams (
  event_id uuid primary key references public.events(id) on delete cascade,
  enabled boolean not null default false,
  video_id text check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  check (not enabled or video_id is not null)
);
alter table public.event_livestreams enable row level security;
revoke all on public.event_livestreams from public, anon, authenticated;

create function public.get_public_livestream(p_event_slug text)
returns table(enabled boolean, video_id text)
language sql stable security definer set search_path = ''
as $$
  select coalesce(l.enabled, false), case when l.enabled then l.video_id else null end
  from public.events e left join public.event_livestreams l on l.event_id = e.id
  where e.slug = p_event_slug;
$$;

create function public.admin_get_livestream(p_event_slug text)
returns table(enabled boolean, video_id text, revision integer)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  return query select coalesce(l.enabled, false), l.video_id, coalesce(l.revision, 0)
  from public.events e left join public.event_livestreams l on l.event_id = e.id
  where e.slug = p_event_slug;
end;
$$;

create function public.admin_update_livestream(
  p_event_slug text, p_enabled boolean, p_video_id text, p_expected_revision integer
)
returns table(enabled boolean, video_id text, revision integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_event_id uuid;
  v_previous public.event_livestreams%rowtype;
begin
  if not private.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_enabled is null or (p_video_id is not null and p_video_id !~ '^[A-Za-z0-9_-]{11}$')
    or (p_enabled and p_video_id is null) then raise exception 'INVALID_LIVESTREAM'; end if;
  -- Lock even the initial absent settings row through its parent event.
  select id into v_event_id from public.events where slug = p_event_slug for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  insert into public.event_livestreams(event_id) values (v_event_id) on conflict (event_id) do nothing;
  select * into v_previous from public.event_livestreams where event_id = v_event_id for update;
  if p_expected_revision is distinct from v_previous.revision then raise exception 'STALE_LIVESTREAM'; end if;
  if p_enabled is distinct from v_previous.enabled or p_video_id is distinct from v_previous.video_id then
    update public.event_livestreams set enabled = p_enabled, video_id = p_video_id,
      revision = v_previous.revision + 1, updated_at = now() where event_id = v_event_id;
    insert into public.admin_audit_log(auth_user_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'update_livestream', 'event', v_event_id,
      jsonb_build_object('previous_enabled', v_previous.enabled, 'enabled', p_enabled,
        'previous_video_id', v_previous.video_id, 'video_id', p_video_id));
  end if;
  return query select l.enabled, l.video_id, l.revision from public.event_livestreams l where l.event_id = v_event_id;
end;
$$;

revoke all on function public.get_public_livestream(text) from public;
revoke all on function public.admin_get_livestream(text) from public, anon;
revoke all on function public.admin_update_livestream(text, boolean, text, integer) from public, anon;
grant execute on function public.get_public_livestream(text) to anon, authenticated;
grant execute on function public.admin_get_livestream(text) to authenticated;
grant execute on function public.admin_update_livestream(text, boolean, text, integer) to authenticated;
