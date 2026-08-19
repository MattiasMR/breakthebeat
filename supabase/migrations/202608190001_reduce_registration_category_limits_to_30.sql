-- Existing production databases received the original 50-entry limit.
-- Keep the limit at 30 for the active Break The Beat 2026 event.
update public.event_category_limits
set max_entries = 30,
    updated_at = now()
where event_id = (
  select id
  from public.events
  where slug = 'break-the-beat-2026'
);
