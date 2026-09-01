-- Only 1 vs 1 increases to 32 registrations for Break The Beat 2026.
-- The 2 vs 2 and BGirls category limits remain unchanged.
do $increase_1v1_capacity$
declare
  v_updated integer;
begin
  update public.event_category_limits
  set max_entries = 32,
      updated_at = now()
  where category = '1v1'
    and event_id = (
      select id
      from public.events
      where slug = 'break-the-beat-2026'
    );

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Expected exactly one 1v1 category limit, updated % rows', v_updated;
  end if;
end;
$increase_1v1_capacity$;
