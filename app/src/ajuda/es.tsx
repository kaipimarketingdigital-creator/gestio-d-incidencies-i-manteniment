import { B, Esquema, Nota, Passos, Xat, type Apartat } from "./peces";

// Los nombres de botones y pantallas se dejan en catalán, tal como aparecen en el panel y en el bot.
export const titol = "Manual del sistema de mantenimiento";
export const subtitol = "Hotel Rull · Grupo de Telegram y panel web";

export const apartats: Apartat[] = [
  {
    id: "visio",
    titol: "1. Cómo funciona, en un minuto",
    cos: (
      <>
        <p>
          El sistema tiene dos partes que trabajan juntas: el <strong>grupo de Telegram</strong>, donde el equipo avisa de las averías
          como siempre, y el <strong>panel web</strong> (manteniment.hotelrull.com), donde Dirección, Administración y Mantenimiento
          las consultan, las gestionan y sacan informes.
        </p>
        <Esquema passes={[
          ["1. Alguien avisa", "Escribe en el grupo, con foto o audio si hace falta: «309 tapa del váter suelta»."],
          ["2. El bot lo entiende", "En menos de un minuto crea la incidencia, con número, lugar, tipo y prioridad."],
          ["3. Se confirma en el grupo", "El bot responde «🆕 Incidència #14 registrada» con tres botones."],
          ["4. Se hace el trabajo", "Quien lo arregla responde «fet» o pulsa «Resolta». También puede decir «esperando material»."],
          ["5. Todo queda registrado", "En el panel se ven el historial, las fotos, el coste y los informes."],
        ]} />
        <p>
          Cada mañana el bot envía al grupo la lista de pendientes y, si está activado, un resumen por correo.
          Las tareas de <strong>mantenimiento preventivo</strong> (limpiar filtros, revisar extintores…) se convierten solas
          en incidencias el día que tocan.
        </p>
        <Nota>Nadie tiene que aprender nada nuevo para avisar: se sigue escribiendo en el grupo como hasta ahora. El bot se encarga de apuntar.</Nota>
        <Nota tipus="consell">El panel y los mensajes del bot están en catalán. En este manual los nombres de botones y pantallas aparecen tal cual los verás (por ejemplo <B>Desar canvis</B> = Guardar cambios).</Nota>
      </>
    ),
  },
  {
    id: "avisar",
    titol: "2. Telegram: avisar de una avería",
    cos: (
      <>
        <p>Escribe en el grupo de mantenimiento qué pasa y <strong>dónde</strong>. Puedes hacerlo con texto, foto, audio o vídeo, en catalán o en castellano.</p>
        <Xat qui="Pisos">309 tapa del váter suelta</Xat>
        <Xat qui="Recepción">La 214 dice que no funciona el aire, es mantenimiento</Xat>
        <Xat qui="Cocina">📷 (foto) Gotera en el almacén de bebidas</Xat>
        <h3>Buenas prácticas</h3>
        <ul>
          <li><strong>Di siempre el lugar</strong>: el número de habitación o el nombre de la zona (Restaurant nou, Piscina, Cocina…). Si falta, el bot lo preguntará.</li>
          <li><strong>Una avería por mensaje</strong> es lo más claro. Si dices dos a la vez («322 y 221 no abre la cerradura»), el bot crea dos.</li>
          <li>Puedes enviar <strong>varios mensajes seguidos</strong> (una foto y luego el texto): el bot espera unos segundos y los lee juntos.</li>
          <li>Si el cliente sigue en la habitación, di <strong>«es mantenimiento»</strong>; si hoy entra alguien, <strong>«hoy es entrada»</strong>. El bot le dará más prioridad.</li>
          <li>Los audios se entienden bien. Los vídeos muy largos (más de ~14 MB) se guardan, pero el bot no los puede analizar.</li>
        </ul>
        <h3>Prioridades que asigna el bot</h3>
        <ul>
          <li><span className="prio urgent">Urgent</span> — sin agua, inundación o agua que cae, el cliente no puede entrar, riesgo para la seguridad.</li>
          <li><span className="prio alta">Alta</span> — habitación ocupada («es mantenimiento»), entrada hoy, queja del cliente o habitación inutilizable.</li>
          <li><span className="prio mitjana">Mitjana</span> (media) — el resto.</li>
          <li><span className="prio baixa">Baixa</span> (baja) — estético o que puede esperar (pintar, «está muy feo»).</li>
        </ul>
        <Nota tipus="consell">Los saludos, bromas y conversaciones entre compañeros («¿lo has mirado?») el bot los ignora: se puede seguir usando el grupo con normalidad.</Nota>
      </>
    ),
  },
  {
    id: "respostes",
    titol: "3. Telegram: qué responde el bot y cómo corregirlo",
    cos: (
      <>
        <p>Cuando registra una avería, el bot responde al mensaje original:</p>
        <Xat qui="Bot" bot>🆕 Incidència #14 registrada{"\n"}Hab. 309 · Fontaneria · Prioritat mitjana{"\n"}Tapa del vàter solta</Xat>
        <p>Debajo hay tres botones:</p>
        <ul>
          <li><B>✔ Resolta</B> (resuelta) — la cierra porque ya está arreglada.</li>
          <li><B>✏ Corregir</B> — el bot pregunta qué hay que cambiar. Responde a su mensaje, por ejemplo «es la 204», «es urgente» o «es el grifo, no la cisterna». Si contestas sin usar «Responder», también lo entiende durante los 10 minutos siguientes.</li>
          <li><B>✖ Anul·lar</B> (anular) — si no era una avería, era un duplicado o un error.</li>
        </ul>
        <p>Si la avería ya había ocurrido en el mismo lugar hace poco, el bot avisa: <em>«🔁 2a vegada en 30 dies: fontaneria a Hab. 309»</em>. Sirve para detectar problemas que se repiten.</p>
        <h3>Añadir información a una incidencia</h3>
        <p>Responde (mantén pulsado el mensaje → <B>Responder</B>) al aviso o a la confirmación del bot con lo que quieras añadir: una foto nueva, «ya he llamado al técnico», etc. El bot contesta <em>«📎 Afegit a la incidència #14»</em> (añadido a la incidencia).</p>
        <h3>Cuando el bot pregunta</h3>
        <p>Solo pregunta cuando falta el lugar o cuando un «fet» podría referirse a varias incidencias. Responde a su mensaje con el dato que falta («la 112»).</p>
      </>
    ),
  },
  {
    id: "estats",
    titol: "4. Telegram: estados y cerrar incidencias",
    cos: (
      <>
        <h3>Estados mientras se trabaja</h3>
        <p>No hace falta nada especial: el bot entiende frases normales y cambia el estado.</p>
        <ul>
          <li><strong>🔧 En curso</strong> — «voy», «ahora lo miro», «a mediodía la cambio».</li>
          <li><strong>⏳ Esperando material</strong> — «está pedida», «no hay stock», «hay que comprar el recambio».</li>
          <li><strong>🏢 Proveedor externo</strong> — «ya he llamado al fontanero», «tienen que venir los de los ascensores».</li>
          <li><strong>Pendiente</strong> — vuelve a estar por hacer (por ejemplo, ha llegado la pieza pero aún no se ha puesto).</li>
        </ul>
        <h3>Cerrar una incidencia</h3>
        <Passos>
          <li><strong>Responde «fet»</strong> (o «arreglado», «ya está», «solucionado») al mensaje del aviso o al del bot. Se cierra al instante.</li>
          <li>O pulsa <B>✔ Resolta</B> en la confirmación del bot.</li>
          <li>Si después Pisos tiene que volver a limpiar, escribe <strong>«repassar»</strong> («202 y 305 repassar»): se cierra y queda marcada como <em>Cal repassar</em> (hay que repasar).</li>
        </Passos>
        <Nota tipus="compte">Un «fet» sin responder a ningún mensaje, el bot intenta asociarlo a la incidencia correcta; si hay varias posibles, preguntará cuál. Responder al mensaje es siempre lo más seguro.</Nota>
      </>
    ),
  },
  {
    id: "resum",
    titol: "5. Resumen de la mañana y mantenimiento preventivo",
    cos: (
      <>
        <p>Cada mañana (por defecto a las 8:30) el bot publica en el grupo:</p>
        <Xat qui="Bot" bot>☀ Bon dia! Hi ha 18 incidències pendents:{"\n"}🔴 #12 Hab. 303 · Cau aigua de la safata de l'aire (fa 5 dies){"\n"}🟠 #10 Hab. 213 · No funciona l'aire (fa 5 dies) · 🔧 en curs{"\n"}🟡 #14 Hab. 309 · Tapa del vàter solta · ⏳ esperant material</Xat>
        <p>A la misma hora, las tareas de <strong>mantenimiento preventivo</strong> que tocan se publican como incidencias nuevas:</p>
        <Xat qui="Bot" bot>🗓 Manteniment preventiu · Incidència #15{"\n"}Hab. 101 · Tasca · Prioritat mitjana{"\n"}Netejar els filtres de l'aire condicionat{"\n"}Cada 90 dies.</Xat>
        <p>Se cierran igual que cualquier otra («fet» o <B>✔ Resolta</B>). Al cerrarla, el sistema programa solo la próxima vez (en este ejemplo, dentro de 90 días).</p>
        <p>Si está activado, Dirección recibe también un <strong>resumen por correo</strong> desde manteniment@hotelrull.com con los pendientes (urgentes arriba), las resueltas del día anterior con su coste y el preventivo de los próximos 7 días.</p>
      </>
    ),
  },
  {
    id: "entrar",
    titol: "6. Panel web: entrar y roles",
    cos: (
      <>
        <p>Dirección: <strong>https://manteniment.hotelrull.com</strong>. Funciona en ordenador, tableta y móvil.</p>
        <Passos>
          <li>Escribe tu correo y pulsa <B>Envia'm l'enllaç</B> (envíame el enlace). No hay contraseña.</li>
          <li>Abre el correo «Entra al panell de manteniment» y pulsa <B>Entrar al panell</B>. <strong>Hazlo en el mismo navegador</strong> donde lo pediste.</li>
          <li>El enlace funciona una sola vez y caduca en una hora. La sesión queda abierta en ese dispositivo hasta que pulses <B>Sortir</B> (salir).</li>
        </Passos>
        <p>Solo pueden entrar las personas que Dirección ha invitado. Si alguien entra con un correo no invitado, queda <em>Pendent d'aprovació</em> (pendiente de aprobación) y no ve ningún dato hasta que Dirección lo aprueba.</p>
        <Nota tipus="consell">En cada pantalla, el botón <B>? Ajuda</B> de abajo a la derecha abre la ayuda de esa pantalla sin salir de ella.</Nota>
        <h3>Qué puede hacer cada rol</h3>
        <div className="taula-caixa">
          <table>
            <thead><tr><th></th><th>Dirección</th><th>Administración</th><th>Mantenimiento</th></tr></thead>
            <tbody>
              <tr><td>Ver incidencias, mapa e informes</td><td>✔</td><td>✔</td><td>✔</td></tr>
              <tr><td>Cambiar estado, prioridad, coste y notas</td><td>✔</td><td>✔</td><td>✔</td></tr>
              <tr><td>Gestionar el mantenimiento preventivo</td><td>✔</td><td>✔</td><td>Solo consultar</td></tr>
              <tr><td>Configuración (resumen, zonas, equipo, usuarios)</td><td>✔</td><td>—</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "avui",
    titol: "7. Panel: Avui e Incidències",
    cos: (
      <>
        <h3>Avui (hoy)</h3>
        <p>La pantalla de inicio: cuántas incidencias hay abiertas, cuántas son urgentes o altas, y la lista ordenada de más a menos urgente. Pulsa el número o la descripción para abrir su ficha.</p>
        <h3>Incidències</h3>
        <p>Todas las incidencias, con filtros:</p>
        <ul>
          <li><strong>Cerca</strong> (buscar) por habitación, número o palabra («214», «grifo»).</li>
          <li><strong>Estat</strong> (abiertas, cerradas, todas o un estado concreto), <strong>prioridad</strong> y <strong>categoría</strong>.</li>
          <li><strong>Ordre</strong>: más urgentes, más recientes o por lugar.</li>
        </ul>
        <Nota tipus="consell">Los filtros se guardan en la dirección de la página: si la copias y la envías, la otra persona ve la misma lista.</Nota>
        <h3>La ficha de una incidencia</h3>
        <ul>
          <li><strong>Què passa</strong> (qué pasa) y quién lo avisó.</li>
          <li><strong>Fotos y audios</strong> del grupo. Pulsa una foto para verla en grande; pasa de una a otra con las flechas (o deslizando el dedo en el móvil). Esc o ✕ para cerrar.</li>
          <li><strong>Mensajes del grupo</strong> relacionados, con la transcripción de los audios.</li>
          <li><strong>Historial de cambios</strong>: quién cambió qué y cuándo (desde Telegram o desde el panel).</li>
          <li><strong>Gestió</strong> (a la derecha): estado, prioridad, categoría, a quién está asignada, coste, materiales, observaciones y «Cal repassar-la». Pulsa <B>Desar canvis</B> (guardar); cada cambio queda en el historial.</li>
          <li><strong>Altres a…</strong>: las demás incidencias de la misma habitación o zona, y el enlace <B>Veure al mapa</B>.</li>
        </ul>
        <Nota>Apuntar el <strong>coste y los materiales</strong> al cerrar una incidencia hace que los informes y el control del presupuesto preventivo sean útiles.</Nota>
      </>
    ),
  },
  {
    id: "mapa",
    titol: "8. Panel: Mapa de l'hotel",
    cos: (
      <>
        <p>Las plantas con todas las habitaciones y, debajo, las zonas comunes y técnicas. Cada casilla se colorea según lo que tiene abierto:</p>
        <ul>
          <li><span className="mostra-ajuda urgent" /> <strong>Rojo</strong>: alguna incidencia urgente o alta.</li>
          <li><span className="mostra-ajuda pendent" /> <strong>Arena</strong>: alguna pendiente.</li>
          <li><span className="mostra-ajuda net" /> <strong>Blanco</strong>: nada abierto.</li>
        </ul>
        <p>El número pequeño («3×») es cuántas incidencias ha tenido ese lugar en el periodo elegido arriba a la derecha (esta temporada, los últimos 12 meses o todo el historial). Sirve para ver qué habitaciones fallan una y otra vez.</p>
        <p>Pulsa una habitación para ver su resumen, las últimas fotos, las abiertas y el historial. El botón <B>Exportar l'historial (Excel)</B> descarga la lista.</p>
      </>
    ),
  },
  {
    id: "preventiu",
    titol: "9. Panel: Mantenimiento preventivo",
    cos: (
      <>
        <p>Las tareas que hay que hacer cada cierto tiempo. La lista las agrupa en <strong>Toca ara</strong> (toca ahora), <strong>Properes 30 dies</strong>, <strong>Més endavant</strong> (más adelante) y <strong>Pausades</strong>. Si una tarea ya ha generado el aviso y aún no se ha hecho, pone «Avisat: #15».</p>
        <h3>Crear o editar una tarea</h3>
        <Passos>
          <li>Pulsa <B>Nova tasca</B> (o <B>Obrir</B> en una existente).</li>
          <li>Rellena qué hay que hacer, el lugar (o «Tot l'hotel»), la categoría, la <strong>frecuencia</strong> (semanal, mensual, trimestral… o un número de días) y la <strong>próxima vez</strong>.</li>
          <li>Opcional: <strong>responsable</strong> (se le asignará la incidencia), <strong>presupuesto por vez</strong>, instrucciones y <strong>materiales previstos</strong> (nombre, cantidad, unidad y coste; el total se calcula solo).</li>
          <li>Pulsa <B>Desar canvis</B>. Si hay algún campo por revisar, aparece marcado en rojo con la explicación debajo.</li>
        </Passos>
        <h3>Acciones</h3>
        <ul>
          <li><B>Duplicar</B> — crea una copia para hacer otra parecida (p. ej. la misma tarea en otra planta).</li>
          <li><B>Pausar</B> / <B>Reactivar</B> — deja de generar avisos temporalmente (tareas de temporada).</li>
          <li><B>Esborrar</B> (borrar) — solo aparece si la tarea <strong>nunca ha generado ninguna incidencia</strong> (creada por error).</li>
          <li><B>Arxivar</B> (archivar) — para las que ya tienen historial: dejan de avisar y salen de la lista, pero se conserva todo lo hecho. Se pueden recuperar con <B>Veure arxivades</B>.</li>
        </ul>
        <p>En <strong>Historial</strong> aparece cada vez que se ha hecho, lo que se gastó y si superó el presupuesto. Lo gastado de verdad se apunta en la ficha de cada incidencia al cerrarla.</p>
      </>
    ),
  },
  {
    id: "informes",
    titol: "10. Panel: Informes",
    cos: (
      <>
        <p>Elige el periodo (esta temporada desde el 1 de marzo, últimos 30 o 90 días, este año o unas fechas concretas) y verás:</p>
        <ul>
          <li><strong>Cifras clave</strong>: incidencias nuevas, resueltas, pendientes ahora, tiempo habitual hasta resolver y coste apuntado.</li>
          <li><strong>Evolución</strong> por semanas o meses (pasa el ratón por encima de una columna para ver su valor; «Veure les dades» muestra la tabla).</li>
          <li><strong>Por tipo de avería</strong>.</li>
          <li><strong>Lugares con más incidencias</strong>, con el aviso «Es repeteix» (se repite) cuando hay 3 o más.</li>
          <li><strong>Tiempo hasta resolver por prioridad</strong>. «Temps habitual» es la mediana: la mitad se resuelven antes y la mitad después.</li>
          <li><strong>Preventivo</strong>: veces hecho, gastado y presupuesto.</li>
        </ul>
        <p><B>Exportar (Excel)</B> descarga todas las incidencias del periodo. <B>Imprimir o PDF</B> saca el informe limpio, sin menú; para guardarlo en PDF, elige «Guardar como PDF» en la ventana de impresión.</p>
        <Nota>Las incidencias anuladas no cuentan en los informes.</Nota>
      </>
    ),
  },
  {
    id: "configuracio",
    titol: "11. Panel: Configuració (Dirección)",
    cos: (
      <>
        <h3>Resum diari (resumen diario)</h3>
        <ul>
          <li><strong>Telegram</strong>: activar o no el resumen de la mañana y la hora.</li>
          <li><strong>Correo</strong>: activarlo, la hora, los días de la semana, quién lo recibe (añade los correos uno a uno) y qué incluye.</li>
          <li><B>Enviar-me una prova ara</B> envía el resumen con los datos de hoy a tu correo, para comprobar que llega bien.</li>
          <li><em>Servidor de correu</em>: los datos de manteniment@hotelrull.com. La contraseña no se guarda en el panel.</li>
        </ul>
        <h3>Zones de l'hotel</h3>
        <p>Habitaciones, zonas comunes y técnicas. Puedes añadir, cambiar el nombre o la planta y poner <strong>otros nombres que usa el equipo</strong> («rest nou», «el de arriba»): el bot los entenderá enseguida. Las zonas con incidencias no se borran, se <B>Desactiven</B>.</p>
        <h3>Equip de Telegram</h3>
        <p>Las personas aparecen solas cuando escriben en el grupo por primera vez. Aquí puedes ponerles el nombre con el que las conocéis, el rol (Mantenimiento, Pisos, Recepción…) y desactivar a quien ya no esté.</p>
        <h3>Usuaris del panell</h3>
        <Passos>
          <li>En <strong>Convidar una persona</strong>, escribe el correo, el nombre y el rol, y pulsa <B>Convidar</B> (invitar).</li>
          <li>Pulsa <B>Copiar</B> para copiar la dirección del panel y envíasela a la persona.</li>
          <li>Cuando entre con ese correo tendrá acceso directamente.</li>
        </Passos>
        <p>Desde la misma lista puedes cambiar el rol, <B>Desactivar</B> o <B>Reactivar</B> el acceso, borrar una invitación no usada y <B>Aprovar</B> o <B>Rebutjar</B> (aprobar o rechazar) a quien haya entrado sin invitación. Siempre debe quedar al menos una persona de Dirección.</p>
      </>
    ),
  },
  {
    id: "problemes",
    titol: "12. Preguntas frecuentes y problemas",
    cos: (
      <>
        <dl className="faq-ajuda">
          <dt>No me llega el enlace para entrar al panel.</dt>
          <dd>Mira la carpeta de spam y espera un minuto. Comprueba que has escrito el correo con el que te invitaron. Si pides muchos enlaces seguidos, hay que esperar unos minutos.</dd>
          <dt>Pone «Pendent d'aprovació».</dt>
          <dd>Has entrado con un correo que no estaba invitado. Pide a Dirección que te apruebe en Configuració → Usuaris del panell y después pulsa «Ja m'han aprovat».</dd>
          <dt>El bot no ha respondido a mi aviso.</dt>
          <dd>Espera un minuto: lee los mensajes en grupos cada 30 segundos. Si era una conversación o no decía qué avería era, lo habrá ignorado. Vuelve a escribirlo con el lugar y qué pasa.</dd>
          <dt>El bot ha puesto una habitación o una prioridad equivocada.</dt>
          <dd>Pulsa «✏ Corregir» y responde con la corrección («es la 204», «es urgente»). También se puede cambiar en la ficha del panel.</dd>
          <dt>Aparece «zona no reconeguda» (zona no reconocida).</dt>
          <dd>El lugar no está en la lista de zonas. Dirección lo puede añadir en Configuració → Zones, o añadirlo como «otro nombre» de una zona existente.</dd>
          <dt>Hay una incidencia repetida.</dt>
          <dd>Anula la que sobra con «✖ Anul·lar» (o cámbiale el estado a Anul·lada en el panel). No cuenta en los informes.</dd>
          <dt>He cerrado una incidencia por error.</dt>
          <dd>Ábrela en el panel y vuelve a ponerle el estado «Oberta» o «En curs». Queda en el historial.</dd>
        </dl>
      </>
    ),
  },
  {
    id: "dades",
    titol: "13. Datos y privacidad",
    cos: (
      <>
        <ul>
          <li>Los datos se guardan en un servidor en Europa y solo acceden las personas invitadas al panel.</li>
          <li>Para entender los avisos, los mensajes, fotos y audios del grupo se analizan con un servicio de inteligencia artificial de Google (Gemini).</li>
          <li>El bot solo lee el grupo de mantenimiento. Los mensajes que no son avisos no generan nada.</li>
          <li>Las fotos y audios solo se pueden ver desde el panel con sesión iniciada; los enlaces caducan al cabo de una hora.</li>
          <li>No escribáis en el grupo datos personales de los clientes (nombres, teléfonos, documentos): no hacen falta para arreglar nada.</li>
        </ul>
        <p>Dudas o problemas con el sistema: Kaipi Marketing.</p>
      </>
    ),
  },
];
