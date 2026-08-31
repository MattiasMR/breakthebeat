alter table public.guest_attendances
  add constraint guest_attendances_organization_guest_type_check
  check (
    organization is not null
    and organization in ('Influencer', 'Bailarín', 'Sponsor', 'Invitado')
  ) not valid;

comment on constraint guest_attendances_organization_guest_type_check
  on public.guest_attendances
  is 'Requires new guest confirmations to use one of the four supported guest types while preserving legacy rows.';
