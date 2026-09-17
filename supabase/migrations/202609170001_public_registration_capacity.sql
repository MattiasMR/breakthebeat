-- Public aggregate only: never expose participant or registration details.
create or replace function public.get_registration_capacity(p_event_slug text)
returns table(category text, remaining bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select categories.category,
    case when limits.max_entries is null then null
      else greatest(0::bigint, limits.max_entries - (
        select count(distinct r.id)
        from public.registrations r
        join public.participants p on p.registration_id = r.id
        join public.participant_categories pc on pc.participant_id = p.id
        where r.event_id = e.id and r.status = 'confirmed'
          and pc.category = categories.category
      )) end as remaining
  from public.events e
  cross join (values ('1v1'), ('2v2'), ('bgirls')) categories(category)
  left join public.event_category_limits limits
    on limits.event_id = e.id and limits.category = categories.category
  where e.slug = p_event_slug
    and e.slug = 'break-the-beat-2026';
$$;

revoke all on function public.get_registration_capacity(text) from public;
grant execute on function public.get_registration_capacity(text) to anon, authenticated;
