-- Use the same categories as attendance confirmation and the admin filter.
-- Keep historical free-text categories intact; enforce the list for new writes.
begin;

alter table public.guest_attendances
  drop constraint guest_attendances_organization_guest_type_check;

alter table public.guest_attendances
  add constraint guest_attendances_organization_guest_type_check
  check (
    organization is not null
    and organization in ('Sponsor', 'Bailarín', 'Invitado', 'Casa Grande')
  ) not valid;

comment on constraint guest_attendances_organization_guest_type_check
  on public.guest_attendances
  is 'Requires Sponsor, Bailarín, Invitado or Casa Grande for new confirmations while preserving legacy rows.';

commit;
