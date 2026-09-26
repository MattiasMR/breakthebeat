# Transmisión de Break The Beat con OBS y YouTube

La transmisión sigue este recorrido: cámara/audio → OBS → YouTube Live → portada de Break The Beat. La web usa el enlace del video; no necesita la contraseña del canal, una API key ni la clave de transmisión de OBS.

## Preparar y probar

1. En YouTube Studio, crea una emisión de prueba **No listada**, con **Permitir inserción** habilitado. Un video privado puede impedir la reproducción a los visitantes.
2. Conecta OBS al canal de YouTube o configura el servidor y la clave de transmisión dentro de OBS. Mantén esa clave privada; no la pegues en el panel de la web.
3. Comprueba las fuentes de cámara y audio, inicia la transmisión en OBS y verifica la señal en YouTube Studio. Según la configuración de inicio automático, también tendrás que pulsar **Emitir en directo** en YouTube.
4. Copia el enlace de **Compartir** de esa emisión, por ejemplo un enlace `youtube.com/watch?v=…`, `youtube.com/live/…` o `youtu.be/…`. Un enlace al canal no identifica una emisión concreta.
5. En el administrador de Break The Beat, abre **Transmisión de YouTube**, pega el enlace y pulsa **Probar video**. Esta vista previa no publica nada en la portada.
6. Pulsa **Guardar enlace**. Deja apagado **Mostrar transmisión en la portada** mientras haces las pruebas internas.
7. Para probar la portada con público, activa el toggle. Comprueba imagen y sonido en otro dispositivo. Apágalo al terminar la prueba.

## El domingo

1. Configura el enlace de la emisión definitiva y guárdalo. Si creaste otra emisión, tendrá otro enlace.
2. Verifica la señal en YouTube y en la vista previa del panel.
3. Activa el toggle cuando quieras mostrar el reproductor en la portada. El título pasa a la izquierda, el video a la derecha y el contador se oculta; en móvil se apilan.
4. Los visitantes con la página abierta reciben el cambio en unos 30 segundos, si tienen conexión. El video no se reinicia durante las consultas del mismo enlace. El visitante pulsa play; no se fuerza reproducción con sonido.
5. Al terminar, detén la emisión en YouTube/OBS y apaga el toggle si quieres retirar el reproductor. Si lo dejas activado, YouTube podría mostrar la grabación en ese mismo enlace. El toggle no detecta por sí solo si la emisión está al aire, programada o finalizada.

Haz la prueba de conexión desde la ubicación real de la cámara y graba también en OBS como respaldo. El ancho de banda disponible y los permisos de música pueden afectar la emisión independientemente de la web.

## Si el video no se reproduce

- Prueba **Ver en YouTube**: ayuda a distinguir un problema de la emisión de uno de inserción.
- Comprueba el enlace, la visibilidad, **Permitir inserción** y las restricciones que muestre YouTube Studio.
- Para error 153, revisa que ningún proxy o extensión elimine el encabezado Referer. El iframe usa `strict-origin-when-cross-origin`.
- Una caída temporal de la consulta de configuración mantiene un video que ya estaba cargado; los cambios del toggle llegarán cuando vuelva la conexión.

## Implementación y publicación

- Aplicar únicamente `supabase/migrations/202609260001_event_livestream.sql` y publicar el frontend con los cambios de esta funcionalidad. No usar `db push` si hay otras migraciones pendientes fuera del alcance.
- Inicialmente no hay video configurado y el estado público es apagado. Guardar un enlace apagado no lo expone en el RPC público.
- La escritura exige un administrador activo, valida el ID de YouTube, registra auditoría y rechaza ediciones basadas en una revisión antigua.
- Sin backend configurado, sin migración o ante un fallo inicial de carga, la portada conserva su aspecto habitual.

Fuentes oficiales: [emisión con codificador](https://support.google.com/youtube/answer/2907883?hl=es), [configuración del directo](https://support.google.com/youtube/answer/9854503?hl=es), [reproductor insertado](https://developers.google.com/youtube/player_parameters), [errores del reproductor](https://developers.google.com/youtube/iframe_api_reference).
