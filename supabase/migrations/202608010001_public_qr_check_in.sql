alter table public.check_ins
alter column checked_in_by drop not null;

alter table public.check_ins
add column source text not null default 'admin'
check (source in ('admin', 'qr'));

comment on column public.check_ins.checked_in_by is
'Administrador que registró el ingreso manualmente. Es nulo cuando se usó el QR público.';

comment on column public.check_ins.source is
'Origen del check-in: admin para ingreso manual o qr para escaneo del token personal.';
