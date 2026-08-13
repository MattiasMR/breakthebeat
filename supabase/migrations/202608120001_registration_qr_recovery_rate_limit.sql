create table public.registration_recovery_attempts (
  id bigint generated always as identity primary key,
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index registration_recovery_attempts_key_time_idx
on public.registration_recovery_attempts(key_hash, created_at desc);

alter table public.registration_recovery_attempts enable row level security;

revoke all on table public.registration_recovery_attempts from public, anon, authenticated;
revoke all on sequence public.registration_recovery_attempts_id_seq from public, anon, authenticated;

grant select, insert, delete on table public.registration_recovery_attempts to service_role;
grant usage, select on sequence public.registration_recovery_attempts_id_seq to service_role;
