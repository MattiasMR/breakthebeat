# Break The Beat Site

La guía completa de configuración y despliegue está en [`../README.md`](../README.md).

Sitio estático en Astro para Break The Beat 2026, con inscripción, confirmaciones QR, administración y check-in respaldados por Supabase.

## Desarrollo del frontend

```bash
npm install
copy .env.example .env
npm run dev
```

Validación completa:

```bash
npm run test
npm run check
npm run build
```

El output estático queda en `dist/` y se publica con GitHub Pages bajo `/breakthebeat/`.

## Arquitectura

- GitHub Pages: HTML, CSS y JavaScript públicos.
- Supabase São Paulo: Postgres, Auth y Edge Functions.
- Cloudflare Turnstile: validación humana del formulario y el login.
- Resend: correos transaccionales opcionales durante la demostración; el guardado y los QR no dependen del proveedor.
- Ningún secreto se compila dentro de `dist/`. Las variables `PUBLIC_*` son identificadores públicos; las claves privadas viven en Supabase o GitHub Actions.

## Preparación de Supabase

1. Crear un proyecto en la región `South America (São Paulo)`.
2. Ejecutar la migración de `../supabase/migrations/` mediante el workflow `Deploy Supabase backend` o la CLI.
3. Configurar en GitHub las variables y secretos indicados abajo.
4. La segunda migración habilita el modo demo con documentos temporales. Sustituirlos antes de recibir datos reales.

Para desarrollo local de Edge Functions se necesita Docker y la CLI de Supabase:

```bash
npx supabase start
npx supabase functions serve
```

El bypass de Turnstile solo funciona cuando la función tiene `ALLOW_TEST_TURNSTILE=true` y el frontend usa `PUBLIC_ENABLE_TEST_MODE=true`. Nunca configurar esas variables en producción.

## Primer administrador

No hay registro público de administradores.

1. En Supabase Auth crear manualmente un usuario confirmado con una dirección interna, por ejemplo `mattias@admin.breakthebeat.invalid`, y una contraseña de al menos 12 caracteres.
2. Ejecutar en el SQL Editor, cambiando usuario y dirección:

```sql
insert into public.admin_users(auth_user_id, username, auth_email)
select id, 'mattias', 'mattias@admin.breakthebeat.invalid'
from auth.users
where email = 'mattias@admin.breakthebeat.invalid';
```

El panel usa el nombre `mattias`; la dirección interna no se muestra ni permite recuperación automática. El cambio de contraseña se hace desde Supabase Auth. Configura también en Auth una longitud mínima de 12 caracteres y una política que exija letras, números y símbolos.

El login aplica Turnstile y bloquea cada combinación de usuario e IP después de cinco intentos fallidos durante 15 minutos. `LOGIN_RATE_LIMIT_SALT` debe ser un valor aleatorio largo, distinto de las demás claves.

## Documentos legales y apertura

La migración base crea cinco documentos inactivos y la migración de demo activa versiones temporales para que el flujo pueda mostrarse. Antes de una prueba con datos reales deben reemplazarse por textos revisados, URL pública y versión definitiva:

```sql
update public.legal_documents
set version = '2026-01', public_url = 'https://DOMINIO/documentos/archivo.pdf', active = true
where kind = 'terms';
```

Repetir para `privacy`, `health`, `image` y `captain_authority`. Cuando los cinco estén revisados:

```sql
update public.events
set legal_ready = true
where slug = 'break-the-beat-2026';
```

Después, un administrador puede abrir o cerrar inscripciones desde el panel.

## Turnstile y Resend

- Crear widgets Turnstile separados para desarrollo y producción; autorizar el dominio real y `mattiasmr.github.io` mientras se use GitHub Pages.
- Verificar en Resend un subdominio como `updates.DOMINIO` mediante SPF y DKIM.
- Configurar `RESEND_FROM` con un remitente de ese subdominio, por ejemplo `Break The Beat <inscripciones@updates.DOMINIO>`.
- `RESEND_REPLY_TO` puede ser `breakthebeat@casagrande.edu.ec`.
- Resend puede quedar mal configurado durante la demo: la inscripción se guarda, los QR aparecen en pantalla y el fallo queda disponible para reenvío en `/admin/`.

## GitHub Actions

Variables del repositorio:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `PUBLIC_TURNSTILE_SITE_KEY`
- `SUPABASE_PROJECT_ID`
- `RESEND_FROM`
- `RESEND_REPLY_TO`
- `ALLOWED_ORIGINS` (lista separada por comas, solo orígenes; ejemplo `https://mattiasmr.github.io,https://dominio.com`)

Secretos del repositorio:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `TURNSTILE_SECRET_KEY`
- `LOGIN_RATE_LIMIT_SALT` (valor aleatorio de al menos 32 bytes)
- `RESEND_API_KEY`

El frontend se despliega automáticamente al hacer push a `main`. El backend usa un workflow manual para evitar aplicar migraciones productivas accidentalmente.

## Operación y privacidad

- Los QR contienen un UUID aleatorio, nunca datos personales.
- El CSV operativo excluye salud y emergencia.
- El CSV de emergencia requiere confirmación y deja auditoría.
- El borrado es manual y permanente desde el panel; las condiciones de conservación deben figurar en el aviso legal definitivo.
- La información médica no aparece en correos, estadísticas ni QR.

El contenido editorial principal sigue en `src/data/site.ts`. Los canales de pago permanecen desactivados hasta confirmar responsable, enlaces y políticas.
