# CLAUDE.md · Gestió d'incidències i manteniment · Hotel Rull

Instrucciones para cualquier sesión de Claude que trabaje en este repositorio. Léelas enteras antes de tocar nada.

## Qué es

El equipo de mantenimiento del Hotel Rull (Delta de l'Ebre) avisa de averías hablando con normalidad en un grupo de Telegram: texto, foto, audio o vídeo, en catalán coloquial. Un bot las convierte en incidencias en Supabase y las confirma en el grupo. Un panel web (`manteniment.hotelrull.com`) sirve a Dirección para el seguimiento, el mantenimiento preventivo y la configuración.

Proyecto de Kaipi Marketing para Hotel Rull. Contacto en el hotel: Josep (validación), Nuria (zonas e infraestructura).

## Estado (13 de noviembre de 2026)

- Bot, panel, preventivo, resumen diario por Telegram y por correo: funcionando con el grupo de pruebas.
- Historial del WhatsApp del hotel cargado en producción como registro.
- Hotel cerrado hasta la reapertura de marzo de 2027.
- Próximos hitos: migración a cuentas del hotel (diciembre), entorno de pruebas y batería de evaluación con respuestas esperadas (enero), panel y preventivo (enero y febrero), reapertura (marzo).
- El plan completo y las decisiones están en el proyecto de Claude «Hotel Rull - App de gestión de incidencias», documento `Hotel Rull - Estado, plan y decisiones`.

## Estructura

```
app/                       Panel web (React 19 + Vite + TypeScript + supabase-js)
  src/pages/               Una página por ruta (Avui, Incidencies, Fitxa, Preventiu, Mapa, Informes, Configuracio…)
  src/lib/                 Cliente de Supabase, sesión, consultas
supabase/
  migrations/NNNN_*.sql    Esquema, en orden. Fuente de verdad de la base de datos
  functions/
    telegram-webhook/      El bot: index.ts (rutas y lógica), telegram.ts, gemini.ts (toda la IA), correu.ts (resúmenes)
    importar-whatsapp/     Importación única del historial de WhatsApp (solo Dirección)
  seed.sql                 Zonas iniciales
docs/
  vocabulari.md            Cómo habla el equipo. Base del prompt de la IA
  arquitectura-y-plan.md   Arquitectura del 6 de octubre (parcialmente superada; ver estado arriba)
.github/workflows/
  publicar-panell.yml      Cada push a main que toque app/ compila y publica el panel por FTPS en el hosting del hotel
```

## Reglas de producto (no negociables)

- **Catalán** en todo lo que ve el hotel: bot, panel, correos. Código, tablas y comentarios también en catalán, como el resto del repo. Las conversaciones con Kaipi, en castellano.
- **El bot habla poco.** Solo responde cuando registra o cambia algo, siempre en respuesta al mensaje original. Ignora la conversación normal. Si duda entre preguntar e ignorar un comentario, ignora.
- **No inventar.** Si falta la zona de un aviso nuevo, pregunta. Nunca supone.
- **Vocabulario del equipo:** `docs/vocabulari.md`. «És manteniment» dicho de una habitación significa que el cliente sigue alojado (prioridad alta), no una categoría. «Repassar» cierra la incidencia y pide que pisos repase. «Productora» son clientes normales.
- **Habitaciones:** parte vieja 101–112, 201–213, 301–313; parte nueva 221–225, 321–324. Gimnasio en la planta 1 de la parte nueva.
- **Roles del panel:** `direccio`, `administracio`, `manteniment`. Manteniment no ve Informes. Solo Direcció entra en Configuració e Importar.
- **Acceso al panel sin contraseñas:** solo correos invitados con enlace de acceso; cierre de sesión tras 12 h de inactividad.
- **Marca Rull:** azul `#004B85`; «MANTENIMENT» bajo el logo, centrado, en `#E88766`.
- **Preventivo:** calendario fijo; cada vez que toca crea una ejecución con plazo de gracia; un solo aviso al vencer (Telegram y correo a los destinatarios del resumen); si no se hizo, sigue abierta junto a la siguiente; se puede cerrar como «no realitzada». Estados intermedios: en curs, esperant material, proveïdor extern.
- **No añadas funciones que nadie ha pedido.** El panel tiene que ser simple para gente que no es técnica.

## Reglas técnicas

- **Toda la IA vive en `supabase/functions/telegram-webhook/gemini.ts`.** Cambiar de modelo o de proveedor solo toca ese archivo.
- **Cualquier cambio en el prompt, el esquema de respuesta o el modelo** se valida con la evaluación (`?accio=avaluar` sobre `avaluacio_casos`) antes y después, y el resultado va en la pull request.
- **Migraciones:** nunca edites una migración ya aplicada; crea la siguiente (`00NN_nom_en_catala.sql`). Toda tabla nueva lleva RLS. Las funciones con privilegios van en el esquema `privat`.
- **Secretos solo en Supabase** (Edge Functions → Secrets): `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`, `SMTP_PASSWORD`; opcionales `TELEGRAM_GROUP_ID`, `GEMINI_MODEL`, `RESUM_HORA`, `PANELL_URL`. Nunca en el código ni en `app/`. El panel solo usa la clave publicable.
- **`TELEGRAM_GROUP_ID` debe estar fijado en producción.** Si falta, el resumen se publica en el último chat que escribió al bot.
- Las rutas `?accio=` del bot exigen la clave `tasques` de la tabla `config` (la usa pg_cron).
- Telegram no deja a los bots descargar archivos de más de 20 MB; el bot no analiza adjuntos de más de 14 MB.
- Antes de desplegar una función, comprueba que el código del repo coincide con lo desplegado.

## Datos personales y producción

- **`material-hotel/` no se sube nunca** (chat exportado, fotos, audios). Tampoco nombres, teléfonos ni mensajes reales en issues, pull requests o commits.
- **Producción** es el proyecto de Supabase `hotel-rull-incidencies` (`emgwjhypuxgbrajjnnsj`). Sin el OK explícito de Raquel en la conversación, no hagas en producción: desplegar funciones, aplicar migraciones, ejecutar SQL que escriba o borre, ni usar `importar-whatsapp` con `buidar`.
- Para probar, usa el grupo de pruebas de Telegram y, cuando exista, el proyecto de pruebas de Supabase.

## Cómo se trabaja

1. **Cada tarea es una issue** con cuatro apartados: *Tarea* (qué y para quién), *Método* (cómo trabajar), *Listón* (criterios comprobables de terminado) y *Restricciones*. Más una lista de *Decisiones a consultar*.
2. **Una rama por issue**, una pull request por rama.
3. **Trabaja en bucle** (planifica, construye, prueba, revisa, corrige) hasta cumplir el listón, con un máximo de 3 rondas. Si no lo consigues, para y explica qué falla.
4. **Decisiones de producto, no las tomes tú:** anótalas en la pull request para que las decida Raquel o el hotel.
5. **Revisión:** antes de dar la pull request por buena, que la revise un agente distinto del que la escribió, con esta lista: reglas de producto, seguridad, RLS, catalán, sin datos personales, evaluación si toca la IA.
6. **La última prueba la hace una persona** en el grupo de pruebas y en el panel.

## Comandos

```
# Panel
cd app && npm ci
npm run dev                 # http://localhost:5173
npm run lint && npm run build
```

**Supabase:** las migraciones y las funciones se despliegan desde Claude con el conector de Supabase (aplicar migración, desplegar función), siempre con el OK explícito de Raquel si es producción. El repositorio no tiene configurada la CLI de Supabase (no hay `supabase/config.toml`). `telegram-webhook` se despliega sin verificación de JWT, porque la llama Telegram; `importar-whatsapp`, con verificación.

El panel se publica solo al hacer push a `main` con cambios en `app/` (necesita los secretos `FTP_SERVIDOR`, `FTP_USUARI` y `FTP_CONTRASENYA` en GitHub).

## Pendiente conocido

- La sección «Estat» del `README.md` y `docs/arquitectura-y-plan.md` están desactualizadas.
- `avaluacio_casos` guarda lo que responde la IA, pero no la respuesta correcta esperada: no puntúa sola.
- No hay entorno de pruebas separado de producción (previsto para después de la migración de diciembre).
