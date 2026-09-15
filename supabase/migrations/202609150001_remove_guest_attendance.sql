-- Keep guest deletion and its audit entry in one admin-only transaction.
create or replace function public.remove_guest_attendance(p_event_id uuid, p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.guest_attendances
  where id = p_guest_id and event_id = p_event_id;

  if not found then
    raise exception 'guest not found';
  end if;

  perform public.log_admin_action(
    'remove_guest_attendance', 'guest_attendance', p_guest_id,
    jsonb_build_object('event_id', p_event_id)
  );
end;
$$;

revoke all on function public.remove_guest_attendance(uuid, uuid) from public, anon;
grant execute on function public.remove_guest_attendance(uuid, uuid) to authenticated;
