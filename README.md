# Break The Beat 2026 — configuración completa

Esta guía deja operativo el formulario nativo, los correos con QR, el panel administrativo y el check-in, manteniendo el frontend en GitHub Pages y el backend en Supabase.

La migración `202607160001_enable_demo_registrations.sql` deja habilitado un modo de demostración: abre el formulario y activa versiones temporales claramente identificadas de los cinco documentos. No existen administradores por defecto.

El guardado no depende de Resend. Primero se confirma la inscripción y se muestran los QR en pantalla; el correo se intenta en segundo plano. Si Resend no está configurado o falla, la inscripción permanece en la base con estado de correo `failed` y puede reenviarse más adelante.

El modo demo sirve para mostrar y probar el sistema. No abras inscripciones reales hasta sustituir los textos temporales y completar la lista de lanzamiento al final de esta guía.

## 1. Arquitectura

| Componente | Responsabilidad |
| --- | --- |
| GitHub Pages | HTML, CSS y JavaScript públicos de Astro |
| Supabase Postgres | Inscripciones, participantes, salud, consentimientos, check-ins y auditoría |
| Supabase Auth | Sesiones de administradores |
| Supabase Edge Functions | Inscripción, login, correos y check-in |
| Cloudflare Turnstile | Protección del formulario y login |
| Resend | Envío de confirmaciones y QR individuales |

Rutas públicas generadas:

- `/breakthebeat/inscripcion/`
- `/breakthebeat/confirmacion/`
- `/breakthebeat/admin/`
- `/breakthebeat/admin/check-in/`

### Dónde ver las inscripciones

Entra en `https://mattiasmr.github.io/breakthebeat/admin/` con el administrador creado en Supabase Auth. Ese panel muestra los totales, categorías, tallas, países, ciudades, check-ins y la tabla de participantes. También permite buscar, filtrar, agrupar duplas, abrir detalles y exportar CSV.

La tabla fuente está en Supabase → `Table Editor` → `participants`; cada participante se relaciona con `registrations`. Para operar normalmente usa `/admin/`, porque allí los conteos y relaciones ya están resueltos.

Archivos principales:

- Frontend: [`site/`](site/)
- Migraciones: [`supabase/migrations/`](supabase/migrations/) (plataforma base y habilitación demo)
- Edge Functions: [`supabase/functions/`](supabase/functions/)
- Deploy de GitHub Pages: [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
- Deploy de Supabase: [`.github/workflows/deploy-supabase.yml`](.github/workflows/deploy-supabase.yml)

## 2. Requisitos

Necesitas:

- Acceso administrativo al repositorio `MattiasMR/breakthebeat`.
- Una cuenta de Supabase.
- Una cuenta de Cloudflare con acceso a Turnstile.
- Para la demostración: Resend y dominio son opcionales.
- Para el lanzamiento real: una cuenta de Resend, un dominio con acceso DNS y los cinco documentos legales definitivos revisados.
- Node.js 24 y npm para desarrollo local.

Para usar Supabase desde la terminal también necesitas la CLI, que el proyecto ejecuta mediante `npx`.

## 3. Ejecutar el frontend localmente

Desde la raíz del repositorio:

```powershell
cd site
Copy-Item .env.example .env
npm ci
npm run dev
```

La web estará disponible normalmente en `http://localhost:4321`.

El archivo `site/.env` debe contener únicamente valores públicos:

```dotenv
PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REEMPLAZAR
PUBLIC_TURNSTILE_SITE_KEY=0x_REEMPLAZAR
PUBLIC_ENABLE_TEST_MODE=false
```

`site/.env` no se debe subir a Git. Nunca coloques allí la clave secreta de Supabase, la clave de Resend o el secreto de Turnstile.

### Configurar ediciones, marcas y transmisión

La portada y la ruta `/evento/` usan una única fuente de contenido:

- [`site/src/data/editions.ts`](site/src/data/editions.ts): fechas, sedes, estado, hero, impacto, highlights, historia, categorías, premios, transmisión y sponsors de las ediciones 1, 2 y 3.
- [`site/public/assets/editions/`](site/public/assets/editions/): fotografías que pertenecen a una edición concreta.
- [`site/public/assets/brands/`](site/public/assets/brands/): logos de marcas ya documentadas.

El selector conserva la edición en la URL. Por ejemplo:

```text
/?edicion=1
/?edicion=2
/?edicion=3
/evento/?edicion=3
```

Para cambiar una fecha, sede, categoría o premio, edita únicamente el objeto de esa edición. No copies marcas o métricas de una edición anterior dentro de la tercera si todavía no existe confirmación oficial.

Cada edición tiene un bloque `stream`:

```ts
stream: {
  eyebrow: "En vivo",
  title: "Transmisión del evento",
  description: "Texto que se muestra antes de confirmar el canal.",
  cta: "Seguir novedades",
  href: "https://www.instagram.com/breakthebeat.ucg/",
  embedUrl: ""
}
```

- Mientras `embedUrl` esté vacío, la web muestra un estado “por confirmar” y el enlace de novedades.
- Cuando exista un canal oficial, coloca en `embedUrl` la URL de inserción entregada por la plataforma, no la URL normal del perfil o del video.
- Prueba la transmisión en el dominio real antes de publicar: algunos proveedores exigen autorizar el dominio donde se inserta el reproductor.
- El workshop no se muestra como pestaña hasta que la organización confirme que se realizará y entregue horario, lugar y descripción.

Para agregar un sponsor confirmado:

1. Guarda su logo optimizado en `site/public/assets/brands/`.
2. Agrega `{ name: "Marca", logo: "/assets/brands/marca.png" }` dentro de `sponsors.items` de la edición correcta.
3. Verifica que exista autorización para usar el logo.
4. Ejecuta `npm run check` y `npm run build` desde `site/`.

## 4. Crear el proyecto de Supabase

1. Crea un proyecto nuevo en Supabase.
2. Selecciona la región de Sudamérica/São Paulo.
3. Guarda la contraseña de la base de datos en un gestor de contraseñas.
4. Anota el `Project Ref`.
5. En la configuración API del proyecto copia:
   - Project URL.
   - Publishable key con formato `sb_publishable_...`.

La publishable key está diseñada para el navegador y funciona junto con RLS. La clave `sb_secret_...` o la clave heredada `service_role` evita RLS y debe permanecer exclusivamente en entornos de servidor.

### Aplicar la migración manualmente

Desde la raíz del repositorio:

```powershell
npx supabase@latest login
npx supabase@latest link --project-ref PROJECT_REF
npx supabase@latest db push
```

La migración crea:

- Evento y configuración de apertura.
- Inscripciones y participantes.
- Categorías.
- Perfiles médicos separados.
- Contactos de emergencia.
- Documentos y consentimientos versionados.
- Administradores.
- Check-ins.
- Límites de intentos de login.
- Auditoría y políticas RLS.

También puedes aplicar la migración con el workflow manual descrito en la sección 9.

### Verificar el resultado

En Supabase SQL Editor ejecuta:

```sql
select slug, registration_open, legal_ready
from public.events;
```

El resultado inicial correcto es `false` para ambos estados.

## 5. Configurar Supabase Auth y el primer administrador

No existe registro público de administradores.

### Seguridad de Auth

En la configuración de Authentication:

1. Mantén habilitado el inicio de sesión por email y contraseña.
2. Deshabilita el registro público de usuarios nuevos.
3. Configura una longitud mínima de contraseña de 12 caracteres.
4. Exige una combinación de mayúsculas, minúsculas, números y símbolos.
5. No habilites recuperación pública de contraseña; el restablecimiento será administrativo.

### Crear el usuario

1. Ve a `Authentication` → `Users`.
2. Crea manualmente un usuario confirmado.
3. Usa una dirección interna no publicada, por ejemplo `mattias@admin.breakthebeat.invalid`.
4. Asigna una contraseña fuerte y única.
5. Copia el UUID del usuario.

Después ejecuta en SQL Editor, ajustando email y nombre de usuario:

```sql
insert into public.admin_users(auth_user_id, username, auth_email)
select id, 'mattias', 'mattias@admin.breakthebeat.invalid'
from auth.users
where email = 'mattias@admin.breakthebeat.invalid';
```

El nombre de usuario debe estar en minúsculas, tener entre 3 y 40 caracteres y usar solamente letras, números, punto, guion o guion bajo.

Comprueba el registro:

```sql
select username, active, created_at
from public.admin_users;
```

El acceso será por `mattias` y la contraseña asignada en Auth. La sesión se guarda en `sessionStorage` y se cierra después de 30 minutos sin actividad.

## 6. Configurar Cloudflare Turnstile

La aplicación usa el mismo widget en dos acciones distintas:

- `registration`: inscripción pública.
- `admin_login`: login administrativo.

### Widget de producción

1. En Cloudflare abre `Turnstile` y selecciona `Add widget`.
2. Agrega el hostname `mattiasmr.github.io`.
3. No incluyas `https://`, puertos ni `/breakthebeat/`.
4. Copia el site key público y el secret key privado.

El frontend envía el token a las Edge Functions. El backend valida el token mediante Siteverify y además comprueba el `action` y el hostname. El secret key nunca debe estar en GitHub Pages.

### Desarrollo local

El proyecto incluye un bypass explícito para pruebas, pero solo debe usarse contra un proyecto de Supabase de desarrollo:

```dotenv
PUBLIC_ENABLE_TEST_MODE=true
```

Y en las Edge Functions de ese proyecto de desarrollo:

```powershell
npx supabase@latest secrets set --project-ref PROJECT_REF_DEV ALLOW_TEST_TURNSTILE=true
```

Nunca configures `ALLOW_TEST_TURNSTILE=true` en producción.

## 7. Configurar Resend y DNS

Esta sección puede dejarse para el final. El formulario, el panel, los QR y el check-in funcionan sin Resend; la pantalla de confirmación avisará que el correo se está procesando y conservará los QR visibles. Cuando el intento falle, el panel permitirá reenviarlo después de completar esta configuración.

Usa un subdominio dedicado, por ejemplo:

```text
updates.tudominio.com
```

1. En Resend abre `Domains` y agrega el subdominio.
2. Copia exactamente los registros DNS entregados por Resend.
3. Crea los registros SPF y DKIM en tu proveedor DNS.
4. Espera hasta que Resend muestre el dominio como `Verified`.
5. Opcionalmente configura DMARC para reforzar la reputación del dominio.
6. Crea una API key restringida al envío de correos.

Valores recomendados:

```text
RESEND_FROM=Break The Beat <inscripciones@updates.tudominio.com>
RESEND_REPLY_TO=breakthebeat@casagrande.edu.ec
```

No uses el remitente definitivo hasta que el dominio esté verificado. Antes del lanzamiento realiza una prueba real hacia Gmail, Outlook y al menos una dirección institucional.

## 8. Configurar secretos de las Edge Functions

Genera primero un salt aleatorio para el límite de intentos del login. En PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Guarda el resultado como `LOGIN_RATE_LIMIT_SALT` y no lo reutilices como otra contraseña.

Configura los secretos directamente en Supabase si haces un despliegue manual:

```powershell
npx supabase@latest secrets set --project-ref PROJECT_REF TURNSTILE_SECRET_KEY="SECRET_TURNSTILE" LOGIN_RATE_LIMIT_SALT="SALT_ALEATORIO" RESEND_API_KEY="re_REEMPLAZAR" RESEND_FROM="Break The Beat <inscripciones@updates.tudominio.com>" RESEND_REPLY_TO="breakthebeat@casagrande.edu.ec" ALLOWED_ORIGINS="https://mattiasmr.github.io"
```

`ALLOWED_ORIGINS` contiene orígenes separados por comas, sin rutas ni `/` final:

```text
https://mattiasmr.github.io,https://breakthebeat.tudominio.com
```

Supabase proporciona automáticamente a sus Edge Functions las variables internas `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. No copies la service role key al frontend ni a una variable `PUBLIC_*`.

Para desplegar las funciones manualmente:

```powershell
npx supabase@latest functions deploy --project-ref PROJECT_REF --use-api
```

## 9. Configurar GitHub Actions

En GitHub abre:

`Settings` → `Secrets and variables` → `Actions`

### Variables del repositorio

| Nombre | Ejemplo |
| --- | --- |
| `PUBLIC_SUPABASE_URL` | `https://PROJECT_REF.supabase.co` |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `PUBLIC_TURNSTILE_SITE_KEY` | Site key público de Turnstile |
| `SUPABASE_PROJECT_ID` | Project Ref de Supabase |
| `RESEND_FROM` | `Break The Beat <inscripciones@updates.tudominio.com>` |
| `RESEND_REPLY_TO` | Correo oficial del evento |
| `ALLOWED_ORIGINS` | `https://mattiasmr.github.io` |

### Secretos del repositorio

| Nombre | Procedencia |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Token personal creado en la configuración de cuenta de Supabase |
| `SUPABASE_DB_PASSWORD` | Contraseña del proyecto de Supabase |
| `TURNSTILE_SECRET_KEY` | Secret key privado del widget |
| `LOGIN_RATE_LIMIT_SALT` | Valor aleatorio generado en la sección anterior |
| `RESEND_API_KEY` | API key de Resend |

No guardes información sensible como variable normal. Los secretos son leídos por GitHub Actions y se entregan a Supabase; no forman parte de la build pública.

### Orden de despliegue

1. Configura las variables y secretos del frontend, Supabase y Turnstile. Los valores de Resend pueden ser provisionales durante la demostración.
2. Ve a `Actions` → `Deploy Supabase backend`.
3. Selecciona `Run workflow`.
4. Verifica que pasen los pasos de migración, secretos y funciones. Este paso aplica también la migración que habilita el formulario demo.
5. Ejecuta manualmente `Deploy site to GitHub Pages` o haz push a `main`.
6. Comprueba que carguen `/breakthebeat/inscripcion/` y `/breakthebeat/admin/`.

El backend se despliega manualmente para evitar migraciones accidentales. El frontend se despliega automáticamente con cada push a `main`.

## 10. Incorporar los documentos legales

Se requieren exactamente estos cinco tipos:

| `kind` | Documento |
| --- | --- |
| `terms` | Términos y reglas del evento |
| `privacy` | Aviso de privacidad |
| `health` | Consentimiento explícito de salud |
| `image` | Autorización de imagen y voz |
| `captain_authority` | Declaración de autorización del compañero |

No copies los términos de Red Bull. Usa documentos propios revisados para el evento.

Para reemplazar un marcador, actualiza su versión, contenido o URL y actívalo. Ejemplo:

```sql
update public.legal_documents
set
  version = '2026-01',
  title = 'Términos y reglas de Break The Beat 2026',
  content = 'TEXTO LEGAL DEFINITIVO',
  public_url = 'https://tudominio.com/documentos/terminos-2026.pdf',
  active = true
where event_id = (
  select id from public.events where slug = 'break-the-beat-2026'
)
and kind = 'terms'
and version = 'pending';
```

Repite el proceso para los otros cuatro tipos. Verifica:

```sql
select kind, version, title, public_url, active
from public.legal_documents
where event_id = (
  select id from public.events where slug = 'break-the-beat-2026'
)
order by kind;
```

Solo cuando los cinco documentos estén revisados y activos:

```sql
update public.events
set legal_ready = true
where slug = 'break-the-beat-2026';
```

Los contratos deben definir antes del lanzamiento:

- Responsable del tratamiento.
- Finalidades de uso.
- Proveedores y transferencias internacionales.
- Plazo o criterio concreto de conservación.
- Procedimiento para ejercer derechos.
- Base legal para datos de salud.
- Validez de la declaración del capitán por el otro adulto.

Si la revisión legal concluye que el capitán no puede consentir por el compañero, no abras inscripciones: el flujo deberá cambiar a validación individual.

## 11. Prueba cerrada

La opción más segura es usar un segundo proyecto Supabase de desarrollo y ejecutar allí la misma migración.

1. Activa documentos ficticios claramente marcados como prueba.
2. Configura `legal_ready = true` solo en el proyecto de desarrollo.
3. Abre temporalmente las inscripciones desde el panel.
4. Prueba:
   - Inscripción individual.
   - Varias categorías.
   - Dupla 2v2.
   - Correos duplicados.
   - Edad menor de 18.
   - Teléfonos sin código internacional.
   - Condiciones médicas y campos condicionales.
   - Fallo de correo.
   - QR individual y check-in separado de la dupla.
   - Reescaneo y código manual.
   - CSV operativo y CSV de emergencia.
5. Comprueba el diseño y la cámara en un teléfono real.

Para borrar las inscripciones de prueba de un evento:

```sql
delete from public.registrations
where event_id = (
  select id from public.events where slug = 'break-the-beat-2026'
);
```

La eliminación se propaga a participantes, salud, contactos, consentimientos y check-ins. La auditoría de la eliminación permanece intencionalmente.

## 12. Abrir las inscripciones reales

Antes de abrir:

- [ ] Dominio de Resend verificado con SPF y DKIM.
- [ ] Prueba real de entrega aprobada.
- [ ] Widget Turnstile limitado al hostname correcto.
- [ ] Secretos y variables configurados.
- [ ] Migración y cuatro Edge Functions desplegadas.
- [ ] Administrador creado y login probado.
- [ ] Cinco documentos definitivos activos.
- [ ] `legal_ready = true` únicamente después de revisión legal.
- [ ] Pruebas ficticias eliminadas.
- [ ] `npm ci`, `npm run test`, `npm run check` y `npm run build` aprobados.
- [ ] Ninguna clave privada aparece en `site/dist`.
- [ ] QR y cámara probados en HTTPS desde un teléfono real.
- [ ] Criterio de conservación aprobado y documentado.

Después inicia sesión en `/breakthebeat/admin/` y usa `Abrir inscripciones`. No es necesario ejecutar SQL para abrir o cerrar el formulario durante la operación normal.

## 13. Verificación local antes de cada despliegue

```powershell
cd site
npm ci
npm run test
npm run check
$env:BASE_PATH='/breakthebeat'
$env:SITE_URL='https://mattiasmr.github.io'
npm run build
```

Resultado esperado:

- Pruebas automatizadas aprobadas.
- Cero errores y advertencias de Astro.
- Diez páginas estáticas generadas.
- Enlaces y assets bajo `/breakthebeat/`.

## 14. Problemas frecuentes

### “Falta conectar el proyecto de Supabase”

Faltan `PUBLIC_SUPABASE_URL` o `PUBLIC_SUPABASE_PUBLISHABLE_KEY` en GitHub. Agrégalas y vuelve a desplegar GitHub Pages.

### “Los documentos legales están en revisión”

Comprueba que existan cinco documentos activos y que `events.legal_ready` sea `true`.

### Turnstile falla

Comprueba:

- Site key y secret key pertenecen al mismo widget.
- El hostname es `mattiasmr.github.io`, sin protocolo ni ruta.
- `ALLOWED_ORIGINS` usa el origen completo `https://mattiasmr.github.io`.
- El reloj y la red del dispositivo son correctos.
- No se intenta reutilizar un token ya validado.

### El correo queda en `failed` o `partial`

Comprueba el estado del dominio en Resend, los registros SPF/DKIM, `RESEND_FROM`, la API key y los logs de la función. La inscripción se conserva y puede reenviarse desde el panel.

### El administrador no puede entrar

Comprueba que:

- El usuario existe y está confirmado en Supabase Auth.
- Existe una fila correspondiente en `public.admin_users`.
- `active = true`.
- El username está en minúsculas.
- No se superaron cinco intentos fallidos en 15 minutos.

Los errores de usuario inexistente, contraseña incorrecta y límite de intentos se muestran deliberadamente con el mismo mensaje.

### La cámara no abre

La cámara requiere HTTPS y permiso del navegador. Prueba desde la URL real de GitHub Pages, habilita el permiso y usa el código manual como respaldo.

### Aparece un correo duplicado

El participante ya existe dentro del evento. Búscalo en el panel y decide si corresponde conservar, cancelar o eliminar permanentemente la inscripción anterior.

## 15. Dominio personalizado futuro

Si la web deja de usar `mattiasmr.github.io/breakthebeat`:

1. Cambia `SITE_URL` en el workflow de Pages.
2. Usa `BASE_PATH: ""` si el sitio queda en la raíz del dominio.
3. Agrega el nuevo hostname al widget Turnstile.
4. Agrega el nuevo origen a `ALLOWED_ORIGINS`.
5. Vuelve a desplegar frontend y Edge Functions.
6. Prueba formulario, login y cámara desde el nuevo dominio.

## Referencias oficiales

- [Supabase: migraciones de base de datos](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Edge Functions](https://supabase.com/docs/guides/functions)
- [Cloudflare Turnstile: validación en servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Cloudflare Turnstile: hostnames](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/)
- [Resend: verificación de dominios](https://resend.com/docs/dashboard/domains/introduction)
- [GitHub Actions: secretos](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
