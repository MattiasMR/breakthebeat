create extension if not exists pgcrypto;

create schema if not exists private;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  starts_at timestamptz not null,
  registration_open boolean not null default false,
  legal_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null check (kind in ('terms', 'privacy', 'health', 'image', 'captain_authority')),
  version text not null,
  title text not null,
  public_url text,
  content text not null default '',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, kind, version)
);

create table public.admin_users (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username = lower(username) and username ~ '^[a-z0-9._-]{3,40}$'),
  auth_email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index admin_users_username_unique on public.admin_users (lower(username));

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  public_code text not null unique,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  captain_authority boolean not null default false,
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'partial', 'failed')),
  email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  participant_code text not null unique,
  qr_token uuid not null default gen_random_uuid() unique,
  role text not null check (role in ('captain', 'partner')),
  display_name text not null check (char_length(display_name) between 2 and 120),
  social_url text not null,
  shirt_size text not null check (shirt_size in ('S', 'M', 'L')),
  age smallint not null check (age between 18 and 100),
  country text not null,
  city text not null,
  phone text not null,
  email text not null,
  email_normalized text not null,
  created_at timestamptz not null default now(),
  unique (event_id, email_normalized),
  unique (registration_id, role)
);

create index participants_registration_idx on public.participants(registration_id);
create index participants_event_idx on public.participants(event_id);

create table public.participant_categories (
  participant_id uuid not null references public.participants(id) on delete cascade,
  category text not null check (category in ('1v1', '2v2', 'bgirls')),
  primary key (participant_id, category)
);

create table public.medical_profiles (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  has_condition boolean not null,
  condition_detail text not null default '',
  has_allergies boolean not null,
  medication_allergy_detail text not null default '',
  food_allergy_detail text not null default '',
  takes_medication boolean not null,
  medication_detail text not null default '',
  created_at timestamptz not null default now(),
  check (not has_condition or char_length(trim(condition_detail)) > 0),
  check (not has_allergies or char_length(trim(medication_allergy_detail || food_allergy_detail)) > 0),
  check (not takes_medication or char_length(trim(medication_detail)) > 0)
);

create table public.emergency_contacts (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  relationship text not null,
  full_name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  represented_participant_id uuid not null references public.participants(id) on delete cascade,
  accepted_by_participant_id uuid not null references public.participants(id) on delete cascade,
  document_kind text not null check (document_kind in ('terms', 'privacy', 'health', 'image', 'captain_authority')),
  document_version text not null,
  accepted_at timestamptz not null default now(),
  unique (represented_participant_id, document_kind, document_version)
);

create table public.check_ins (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid not null references auth.users(id) on delete restrict
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.admin_login_attempts (
  id bigint generated always as identity primary key,
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index admin_login_attempts_key_time_idx
on public.admin_login_attempts(key_hash, created_at desc);

create unique index legal_documents_one_active_kind
on public.legal_documents(event_id, kind)
where active = true;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where auth_user_id = (select auth.uid())
      and active = true
  );
$$;

revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_touch_updated_at
before update on public.events
for each row execute function public.touch_updated_at();

create trigger registrations_touch_updated_at
before update on public.registrations
for each row execute function public.touch_updated_at();

create or replace function private.audit_registration_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.admin_audit_log(auth_user_id, action, target_type, target_id, metadata)
    values (
      (select auth.uid()),
      'delete_registration',
      'registration',
      old.id,
      jsonb_build_object('public_code', old.public_code, 'previous_status', old.status)
    );
    return old;
  end if;

  insert into public.admin_audit_log(auth_user_id, action, target_type, target_id, metadata)
  values (
    (select auth.uid()),
    'update_registration',
    'registration',
    new.id,
    jsonb_build_object(
      'public_code', new.public_code,
      'previous_status', old.status,
      'next_status', new.status
    )
  );
  return new;
end;
$$;

create trigger registrations_audit_update
after update on public.registrations
for each row execute function private.audit_registration_change();

create trigger registrations_audit_delete
before delete on public.registrations
for each row execute function private.audit_registration_change();

create or replace function public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not authorized';
  end if;

  insert into public.admin_audit_log(auth_user_id, action, target_type, target_id, metadata)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.log_admin_action(text, text, uuid, jsonb) from public;
grant execute on function public.log_admin_action(text, text, uuid, jsonb) to authenticated;

create or replace function public.create_registration(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_registration_id uuid;
  v_registration_code text;
  v_participant jsonb;
  v_participant_id uuid;
  v_captain_id uuid;
  v_role text;
  v_email text;
  v_category text;
  v_index integer := 0;
  v_count integer;
  v_duo_count integer := 0;
  v_document record;
  v_document_count integer;
  v_result jsonb;
  v_constraint_name text;
begin
  select * into v_event
  from public.events
  where slug = trim(p_payload->>'eventSlug');

  if v_event.id is null or not v_event.registration_open or not v_event.legal_ready then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_CLOSED';
  end if;

  if jsonb_typeof(p_payload->'participants') <> 'array' then
    raise exception using errcode = 'P0001', message = 'INVALID_PARTICIPANTS';
  end if;

  v_count := jsonb_array_length(p_payload->'participants');
  if v_count not in (1, 2) then
    raise exception using errcode = 'P0001', message = 'INVALID_PARTICIPANT_COUNT';
  end if;

  select count(distinct kind) into v_document_count
  from public.legal_documents
  where event_id = v_event.id and active = true;

  if v_document_count <> 5 then
    raise exception using errcode = 'P0001', message = 'LEGAL_DOCUMENTS_NOT_READY';
  end if;

  for v_participant in select value from jsonb_array_elements(p_payload->'participants') loop
    if coalesce((v_participant->>'age')::integer, 0) not between 18 and 100 then
      raise exception using errcode = 'P0001', message = 'INVALID_AGE';
    end if;
    if jsonb_array_length(coalesce(v_participant->'categories', '[]'::jsonb)) = 0 then
      raise exception using errcode = 'P0001', message = 'CATEGORY_REQUIRED';
    end if;
    if (v_participant->'categories') ? '2v2' then
      v_duo_count := v_duo_count + 1;
    end if;
  end loop;

  if (v_count = 1 and v_duo_count <> 0) or (v_count = 2 and v_duo_count <> 2) then
    raise exception using errcode = 'P0001', message = 'INVALID_DUO';
  end if;

  if v_count = 2 and coalesce((p_payload#>>'{consents,captainAuthority}')::boolean, false) is not true then
    raise exception using errcode = 'P0001', message = 'CAPTAIN_AUTHORITY_REQUIRED';
  end if;

  v_registration_code := 'BTB26-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.registrations(event_id, public_code, captain_authority)
  values (v_event.id, v_registration_code, coalesce((p_payload#>>'{consents,captainAuthority}')::boolean, false))
  returning id into v_registration_id;

  for v_participant in select value from jsonb_array_elements(p_payload->'participants') loop
    v_index := v_index + 1;
    v_role := trim(v_participant->>'role');
    v_email := lower(trim(v_participant->>'email'));

    if v_role not in ('captain', 'partner') then
      raise exception using errcode = 'P0001', message = 'INVALID_ROLE';
    end if;

    insert into public.participants(
      event_id,
      registration_id,
      participant_code,
      role,
      display_name,
      social_url,
      shirt_size,
      age,
      country,
      city,
      phone,
      email,
      email_normalized
    ) values (
      v_event.id,
      v_registration_id,
      v_registration_code || '-' || case when v_index = 1 then 'A' else 'B' end,
      v_role,
      trim(v_participant->>'displayName'),
      trim(v_participant->>'socialUrl'),
      trim(v_participant->>'shirtSize'),
      (v_participant->>'age')::smallint,
      trim(v_participant->>'country'),
      trim(v_participant->>'city'),
      trim(v_participant->>'phone'),
      v_email,
      v_email
    ) returning id into v_participant_id;

    if v_role = 'captain' then
      v_captain_id := v_participant_id;
    end if;

    for v_category in select value from jsonb_array_elements_text(v_participant->'categories') loop
      insert into public.participant_categories(participant_id, category)
      values (v_participant_id, v_category);
    end loop;

    insert into public.medical_profiles(
      participant_id,
      has_condition,
      condition_detail,
      has_allergies,
      medication_allergy_detail,
      food_allergy_detail,
      takes_medication,
      medication_detail
    ) values (
      v_participant_id,
      (v_participant#>>'{medical,hasCondition}')::boolean,
      coalesce(trim(v_participant#>>'{medical,conditionDetail}'), ''),
      (v_participant#>>'{medical,hasAllergies}')::boolean,
      coalesce(trim(v_participant#>>'{medical,medicationAllergyDetail}'), ''),
      coalesce(trim(v_participant#>>'{medical,foodAllergyDetail}'), ''),
      (v_participant#>>'{medical,takesMedication}')::boolean,
      coalesce(trim(v_participant#>>'{medical,medicationDetail}'), '')
    );

    insert into public.emergency_contacts(participant_id, relationship, full_name, phone)
    values (
      v_participant_id,
      trim(v_participant#>>'{medical,emergencyRelationship}'),
      trim(v_participant#>>'{medical,emergencyName}'),
      trim(v_participant#>>'{medical,emergencyPhone}')
    );
  end loop;

  if v_captain_id is null then
    raise exception using errcode = 'P0001', message = 'CAPTAIN_REQUIRED';
  end if;

  for v_participant_id in select id from public.participants where registration_id = v_registration_id loop
    for v_document in
      select kind, version
      from public.legal_documents
      where event_id = v_event.id and active = true
    loop
      if v_document.kind <> 'captain_authority' or v_count = 2 then
        insert into public.consents(
          registration_id,
          represented_participant_id,
          accepted_by_participant_id,
          document_kind,
          document_version
        ) values (
          v_registration_id,
          v_participant_id,
          v_captain_id,
          v_document.kind,
          v_document.version
        );
      end if;
    end loop;
  end loop;

  select jsonb_build_object(
    'registrationId', r.id,
    'registrationCode', r.public_code,
    'emailStatus', r.email_status,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'displayName', p.display_name,
        'email', p.email,
        'participantCode', p.participant_code,
        'qrToken', p.qr_token,
        'categories', (
          select jsonb_agg(pc.category order by pc.category)
          from public.participant_categories pc
          where pc.participant_id = p.id
        )
      ) order by p.role)
      from public.participants p
      where p.registration_id = r.id
    ), '[]'::jsonb)
  ) into v_result
  from public.registrations r
  where r.id = v_registration_id;

  return v_result;
exception
  when unique_violation then
    get stacked diagnostics v_constraint_name = constraint_name;
    if v_constraint_name = 'participants_event_id_email_normalized_key' then
      raise exception using errcode = 'P0001', message = 'DUPLICATE_PARTICIPANT';
    end if;
    raise;
end;
$$;

revoke all on function public.create_registration(jsonb) from public, anon, authenticated;
grant execute on function public.create_registration(jsonb) to service_role;

alter table public.events enable row level security;
alter table public.legal_documents enable row level security;
alter table public.admin_users enable row level security;
alter table public.registrations enable row level security;
alter table public.participants enable row level security;
alter table public.participant_categories enable row level security;
alter table public.medical_profiles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.consents enable row level security;
alter table public.check_ins enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.admin_login_attempts enable row level security;

create policy events_public_read on public.events
for select to anon, authenticated
using (slug = 'break-the-beat-2026');

create policy events_admin_update on public.events
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy legal_documents_public_read on public.legal_documents
for select to anon, authenticated
using (active = true and exists (
  select 1 from public.events e where e.id = event_id and e.legal_ready = true
));

create policy legal_documents_admin_all on public.legal_documents
for all to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy admin_users_admin_read on public.admin_users
for select to authenticated
using (private.is_admin());

create policy registrations_admin_all on public.registrations
for all to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy participants_admin_all on public.participants
for all to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy participant_categories_admin_all on public.participant_categories
for all to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy medical_profiles_admin_all on public.medical_profiles
for all to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy emergency_contacts_admin_all on public.emergency_contacts
for all to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy consents_admin_all on public.consents
for all to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy check_ins_admin_all on public.check_ins
for all to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy audit_log_admin_read on public.admin_audit_log
for select to authenticated
using (private.is_admin());

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.events, public.legal_documents to anon;

grant select, update on public.events to authenticated;
grant select on public.legal_documents to authenticated;
grant select on public.admin_users to authenticated;
grant select, update, delete on public.registrations to authenticated;
grant select on public.participants to authenticated;
grant select on public.participant_categories to authenticated;
grant select on public.medical_profiles to authenticated;
grant select on public.emergency_contacts to authenticated;
grant select on public.consents to authenticated;
grant select on public.check_ins to authenticated;
grant select on public.admin_audit_log to authenticated;

insert into public.events(slug, name, starts_at, registration_open, legal_ready)
values ('break-the-beat-2026', 'Break The Beat 2026', '2026-09-27 00:00:00-05', false, false)
on conflict (slug) do nothing;

insert into public.legal_documents(event_id, kind, version, title, content, active)
select e.id, document.kind, 'pending', document.title, 'Documento pendiente de revisión legal.', false
from public.events e
cross join (values
  ('terms', 'Términos y reglas del evento'),
  ('privacy', 'Aviso de privacidad'),
  ('health', 'Tratamiento de información médica'),
  ('image', 'Autorización de imagen y voz'),
  ('captain_authority', 'Declaración de autorización del compañero')
) as document(kind, title)
where e.slug = 'break-the-beat-2026'
on conflict (event_id, kind, version) do nothing;
