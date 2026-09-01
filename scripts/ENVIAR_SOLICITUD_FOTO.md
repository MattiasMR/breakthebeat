# Enviar solicitud de fotografía

El script lee el Excel operativo descargado desde el panel, conserva solo filas con estado `Confirmado`, elimina correos repetidos y, cuando existe la columna `Foto`, excluye a quienes ya aparecen como `Cargada`.

El modo normal es una simulación: no envía correos hasta agregar `--send`.

## 1. Preparar Python

```powershell
python -m pip install -r .\scripts\requirements-email-photo.txt
```

## 2. Revisar el total sin enviar

```powershell
python .\scripts\email_photo_request.py "C:\ruta\break-the-beat-participantes-2026-09-01.xlsx"
```

## 3. Abrir Gmail sin credenciales SMTP

```powershell
python .\scripts\email_photo_request.py "C:\ruta\break-the-beat-participantes-2026-09-01.xlsx" --open-gmail
```

El script abre Gmail en el navegador con el asunto y el mensaje preparados. Los correos de los participantes quedan copiados en el portapapeles, pero no se incluyen en la URL. En Gmail:

1. Abre el campo `CCO`.
2. Pega con `Ctrl+V`.
3. Revisa el total y el mensaje.
4. Pulsa `Enviar` manualmente.

Debes tener una sesión de Gmail iniciada en el navegador. El script no conoce ni guarda tu contraseña.

Para abrir la aplicación de correo predeterminada de Windows en vez de Gmail:

```powershell
python .\scripts\email_photo_request.py "C:\ruta\break-the-beat-participantes-2026-09-01.xlsx" --open-mail-app
```

## 4. Envío automático opcional por SMTP

Usa las credenciales SMTP del correo oficial. No guardes la contraseña en archivos del proyecto.

```powershell
$env:BTB_SMTP_HOST="smtp.proveedor.com"
$env:BTB_SMTP_PORT="587"
$env:BTB_SMTP_SECURITY="starttls"
$env:BTB_SMTP_USER="correo@dominio.com"
$env:BTB_SMTP_PASSWORD="contraseña-o-clave-de-aplicación"
$env:BTB_MAIL_FROM="Break The Beat <correo@dominio.com>"
$env:BTB_MAIL_TO="correo@dominio.com"
$env:BTB_MAIL_REPLY_TO="correo@dominio.com"
```

## 5. Enviar automáticamente una sola vez con CCO

```powershell
python .\scripts\email_photo_request.py "C:\ruta\break-the-beat-participantes-2026-09-01.xlsx" --send
```

La dirección visible en `Para` es `BTB_MAIL_TO`. Los participantes se entregan directamente al servidor SMTP como destinatarios ocultos y no aparecen en el encabezado del mensaje.

El script se detiene si encuentra más de 450 destinatarios. Ajusta `--max-recipients` únicamente después de confirmar el límite del proveedor de correo.
