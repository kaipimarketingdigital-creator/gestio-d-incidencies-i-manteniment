# Hotel Rull · Incidencias por Telegram: arquitectura y plan

Actualizado: 6 de octubre de 2026. Este documento es la referencia vigente del proyecto y sustituye al plan de 10 días (app web con formulario en Lovable) y a la comparativa de tres arquitecturas con WhatsApp.

## Decisiones tomadas

El equipo reporta incidencias hablando con normalidad en un grupo de Telegram; un bot las convierte en incidencias estructuradas y un panel web sirve para el seguimiento.

| Tema | Decisión |
| --- | --- |
| Canal | Grupo de Telegram (el hotel acepta el cambio desde WhatsApp) |
| Participantes | 7 personas del hotel, más Kaipi como observadora durante el arranque |
| Idioma | Catalán, tanto lo que entiende el bot como lo que responde |
| Confirmación | El bot responde en el grupo a cada incidencia que registra |
| Formatos de entrada | Texto, audio, foto y vídeo, sin comandos ni menciones |
| Volumen | Alrededor de una incidencia al día en temporada (de marzo a finales de octubre); más con lluvias fuertes |
| WhatsApp | Descartado por ahora: la API oficial no permite un bot en el grupo existente y las alternativas no oficiales arriesgan el baneo del número |

## Cómo funciona

Una incidencia nace de un mensaje normal en el grupo y se cierra también desde el grupo; nadie del equipo operativo necesita abrir otra aplicación.

1. **Alguien escribe o habla en el grupo.** Por ejemplo, un audio diciendo que gotea el grifo de la 203, con o sin foto o vídeo.
2. **El sistema agrupa.** Espera unos 60 segundos para juntar los mensajes seguidos de la misma persona (foto y después audio) en un solo reporte.
3. **La IA interpreta.** Con la lista de incidencias abiertas como contexto, decide si el mensaje es una incidencia nueva, una actualización de una existente, el aviso de que algo ya está resuelto, o conversación normal, que ignora.
4. **Extrae los datos.** Zona o habitación, categoría, prioridad y una descripción corta. Guarda también la transcripción y los adjuntos originales.
5. **El bot confirma en el grupo.** Responde al mensaje original con un resumen y tres botones: asignármela, resuelta, corregir. Si falta la zona, la pregunta; es la única pregunta que hace.
6. **El técnico actúa.** Pulsa un botón o lo dice en el grupo ("lo de la 203 ya está"). El bot actualiza el estado y lo confirma.
7. **Dirección hace seguimiento.** El panel web muestra listado, filtros, costes e indicadores. Cada mañana el bot publica en el grupo el resumen de pendientes.

## Arquitectura

Seis piezas, con el bot en el centro: es lo único que habla con Telegram y con la IA, y todo lo que decide queda escrito en Supabase.

- **Grupo de Telegram:** 7 personas del hotel; texto, audio, foto y vídeo. Habla con el bot en ambos sentidos.
- **Bot de incidencias:** Supabase Edge Functions; agrupa, interpreta y confirma.
- **Modelo de IA multimodal:** entiende audio, vídeo e imagen y devuelve datos estructurados al bot.
- **Supabase:** incidencias y mensajes; fotos, audios y vídeos.
- **Tareas programadas:** despiertan al bot para el resumen diario de pendientes y los recordatorios de preventivo.
- **Panel web:** dirección y administración; listado, costes e indicadores. No pasa por el bot: lee y edita directamente la base de datos.

Añadir otro canal más adelante (por ejemplo WhatsApp en chat individual) sería una segunda entrada al mismo bot, sin tocar datos ni panel.

## Modelo de datos

Siete tablas en Supabase.

| Tabla | Qué guarda | Campos principales |
| --- | --- | --- |
| `persones` | Equipo del hotel | nombre, rol, identificador de Telegram |
| `zones` | Habitaciones y áreas | nombre, tipo (habitación, común, técnica), nombres alternativos que usa el equipo |
| `incidencies` | La incidencia | zona, categoría, descripción, prioridad, estado, quién la reportó, a quién está asignada, fechas de alta y resolución, coste, materiales, observaciones |
| `missatges` | Cada mensaje del grupo ligado a una incidencia | autor, texto o transcripción, identificador del mensaje en Telegram, incidencia |
| `adjunts` | Fotos, audios y vídeos | archivo en Storage, tipo, mensaje al que pertenece |
| `historial` | Cada cambio de estado o corrección | quién, cuándo, valor anterior y nuevo |
| `manteniment_preventiu` | Tareas periódicas | tarea, zona, periodicidad, próxima revisión, responsable, estado |

En `incidencies` se guarda también lo que propuso la IA (categoría y prioridad) aunque alguien lo corrija después; así se puede medir cuánto acierta.

## Comportamiento del bot en el grupo

El bot habla poco: solo interviene cuando registra o cambia algo, siempre respondiendo al mensaje original y en catalán.

Ejemplo de intercambio:

> **Operari (àudio):** A la 203 l'aixeta del lavabo degota, us passo foto.
>
> **Bot:** Incidència #48 registrada · Hab. 203 · Fontaneria · Prioritat mitjana · L'aixeta del lavabo degota.
> [ M'ho assigno ] [ Resolta ] [ Corregir ]
>
> **Tècnic (més tard):** Lo de la 203 ja està, he canviat la junta.
>
> **Bot:** Incidència #48 resolta. Anotat: junta canviada.

Reglas:

- **Ignora la conversación normal.** Saludos, coordinación y bromas no generan respuesta.
- **No inventa.** Si no entiende la zona o el problema, pregunta en lugar de suponer.
- **Acepta correcciones habladas.** "No, és la 204" corrige la incidencia sin tocar botones.
- **Detecta duplicados.** Si ya hay una incidencia abierta de la misma zona y problema, añade el mensaje a esa y lo dice.
- **Avisa de lo urgente.** Una prioridad urgente menciona al responsable que se defina.
- **Permite anular.** "Corregir" incluye anular una incidencia registrada por error.
- **Vídeos largos.** Telegram no deja a los bots descargar archivos de más de 20 MB; en ese caso pide un vídeo más corto o una foto.
- **Resumen diario.** Cada mañana publica las pendientes ordenadas por prioridad, y los recordatorios de preventivo que toquen.

## Con qué construirlo

El bot y toda la lógica con Claude Code sobre Supabase, y el panel web con Lovable conectado a la misma base de datos.

| Pieza | Herramienta | Por qué |
| --- | --- | --- |
| Canal | Telegram Bot API, con el modo privacidad desactivado | Gratis, oficial y el bot lee todo el grupo |
| Lógica del bot | Supabase Edge Functions, escritas con Claude Code | Sin servidor propio ni herramienta de orquestación aparte |
| Datos, archivos y usuarios | Supabase (base de datos, Storage, Auth) | Una sola plataforma; SQL conocido |
| IA | Un único modelo multimodal que acepte audio, vídeo, imagen y texto (familia Gemini Flash como primera candidata) | La API de Claude no acepta audio ni vídeo; un solo modelo evita encadenar transcripción y análisis |
| Tareas programadas | Cron de Supabase | Resumen diario y recordatorios de preventivo |
| Panel web | Lovable | Rápido para listados, fichas y gráficas |

La llamada a la IA va detrás de una función propia, para poder cambiar de modelo sin tocar el resto. n8n queda fuera.

## Plan de trabajo

El equipo real prueba el registro de incidencias del 19 al 30 de octubre de 2026, antes del cierre; el resto se construye en invierno y el sistema completo arranca con la reapertura de marzo de 2027.

| Fase | Fechas | Qué se hace | Resultado |
| --- | --- | --- | --- |
| 0. Preparación | 7 a 9 de octubre | Crear el bot y un grupo de pruebas, proyecto de Supabase, lista de zonas y personas, recoger 20 o 30 mensajes reales del grupo actual | Material de prueba y modelo de IA elegido con audios reales en catalán |
| 1. Núcleo | 13 a 16 de octubre | Recepción de mensajes, guardado de adjuntos, interpretación con IA, alta de incidencia, confirmación en catalán, corregir o anular, botón de resuelta | Un mensaje en el grupo de pruebas crea una incidencia correcta |
| 2. Piloto corto | 19 a 30 de octubre (de lunes a viernes) | Grupo real con las 7 personas; Kaipi observa y ajusta cada día; se miden aciertos y errores | Datos reales de uso y lista de ajustes antes del cierre |
| 3. Ciclo completo | Noviembre | Asignación, actualización y resolución por lenguaje natural, duplicados, resumen diario | Una incidencia se abre y se cierra sin salir del chat |
| 4. Panel | Diciembre y enero | Listado con filtros, ficha, indicadores, mantenimiento preventivo y sus recordatorios | Dirección puede hacer seguimiento desde la web |
| 5. Arranque de temporada | Reapertura de marzo | Guía de una página en catalán, traspaso del panel, Kaipi sale del grupo tras las primeras semanas | Sistema completo en manos del hotel |

La fase 0 decide el riesgo principal: si la IA no entiende bien los audios reales del equipo, se cambia de modelo antes de construir nada más.

**Decidido: piloto corto antes del cierre.**

- **Entra en el piloto:** registro por texto, audio, foto y vídeo, confirmación en catalán, corrección, anulación y botón para marcar como resuelta.
- **Queda para invierno:** asignación, resolución hablada, detección de duplicados, resumen diario, panel web y mantenimiento preventivo.

El margen es justo: el 12 de octubre es festivo y el hotel tiene que entregar esa semana la lista de zonas, las 7 personas y el permiso para usar mensajes reales. Durante el piloto las incidencias se consultan directamente en Supabase, porque el panel aún no existe.

## Costes mensuales

El coste de funcionamiento para el hotel debería quedar por debajo de 10 € al mes; con cerca de una incidencia al día el gasto en IA es mínimo, y fuera de temporada casi nulo. Son cifras aproximadas que el piloto confirmará.

| Concepto | Coste aproximado | Nota |
| --- | --- | --- |
| Telegram | 0 € | La API de bots no tiene coste |
| Supabase | 0 € | Plan gratuito; el vídeo es lo que antes puede llenar el almacenamiento |
| IA | Pocos euros | Se paga por uso; audio y vídeo cuestan más que texto y foto |
| Lovable | 0 € o un mes de plan de pago | Solo durante la construcción del panel, si el plan gratuito se queda corto |

## Riesgos y pendientes

| Riesgo | Cómo se reduce |
| --- | --- |
| La IA entiende mal los audios del equipo | Prueba con mensajes reales en la fase 0; el modelo se puede cambiar sin tocar el resto |
| El equipo vuelve a WhatsApp | El grupo de mantenimiento de WhatsApp se cierra al empezar el piloto |
| El bot registra conversación que no es incidencia | La confirmación es visible y cualquiera puede anular |
| Vídeos de más de 20 MB | El bot pide uno más corto o una foto |
| El almacenamiento se llena con vídeo | Política de conservación: borrar o comprimir adjuntos de incidencias cerradas hace meses |
| Voz e imágenes del personal pasan por una IA externa | Informar al equipo por escrito y evitar que aparezcan huéspedes en fotos y vídeos |

Pendiente de confirmar con el hotel:

- Lista de zonas y habitaciones, con los nombres que usa el equipo al hablar
- Nombres y roles de las 7 personas
- Categorías definitivas de incidencia
- Quién recibe el aviso de las urgentes
- Hora del resumen diario
- Si existe ya un listado de mantenimiento preventivo
- Permiso para usar mensajes reales del grupo actual como material de prueba

## Fuentes

- [WhatsApp Group API 2026 (Unipile)](https://www.unipile.com/whatsapp-group-api/): fuente secundaria; contrastar con la documentación de Meta si se replantea WhatsApp
- [Evolution API vs Cloud API](https://pasqualepillitteri.it/en/news/12969/integrate-whatsapp-evolution-api-vs-cloud-api)
- [Telegram Bot API: modo privacidad y grupos](https://docs.openclaw.ai/channels/telegram/index.html)
- [Límite de 20 MB para bots de Telegram](https://botize.com/en/method/telegrambot/webhook)
- [Modelos de la API de Gemini](https://claw.aguidetocloud.com/google/gemini-api/models/)
