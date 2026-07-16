-- Habilita el flujo de demostración mientras los documentos definitivos y Resend
-- se terminan de configurar. Reemplazar estas versiones antes del lanzamiento real.

update public.legal_documents
set
  version = 'demo-2026-07',
  content = case kind
    when 'terms' then 'Versión temporal para pruebas cerradas. El participante declara que la información entregada es correcta y acepta las reglas operativas del evento.'
    when 'privacy' then 'Versión temporal para pruebas cerradas. Los datos se usarán para gestionar la inscripción, acreditación, seguridad y comunicaciones del evento.'
    when 'health' then 'Versión temporal para pruebas cerradas. El participante autoriza el tratamiento restringido de datos de salud únicamente para prevención y atención de emergencias.'
    when 'image' then 'Versión temporal para pruebas cerradas. El participante autoriza el registro y uso de su imagen y voz en la cobertura del evento.'
    when 'captain_authority' then 'Versión temporal para pruebas cerradas. El capitán declara contar con autorización de su compañero adulto para proporcionar sus datos.'
    else content
  end,
  active = true
where event_id = (
  select id from public.events where slug = 'break-the-beat-2026'
)
and version = 'pending';

update public.events
set
  registration_open = true,
  legal_ready = true,
  updated_at = now()
where slug = 'break-the-beat-2026';
