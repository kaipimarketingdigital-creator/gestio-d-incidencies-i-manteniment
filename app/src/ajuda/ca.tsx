import { B, Esquema, Nota, Passos, Xat, type Apartat } from "./peces";

export const titol = "Manual del sistema de manteniment";
export const subtitol = "Hotel Rull · Grup de Telegram i panell web";

export const apartats: Apartat[] = [
  {
    id: "visio",
    titol: "1. Com funciona, en un minut",
    cos: (
      <>
        <p>
          El sistema té dues parts que treballen juntes: el <strong>grup de Telegram</strong>, on l'equip avisa de les avaries
          com sempre, i el <strong>panell web</strong> (manteniment.hotelrull.com), on Direcció, Administració i Manteniment
          les consulten, les gestionen i en treuen informes.
        </p>
        <Esquema passes={[
          ["1. Algú avisa", "Escriu al grup, amb foto o àudio si cal: «309 tapa del vàter solta»."],
          ["2. El bot ho entén", "En menys d'un minut crea la incidència, amb número, lloc, tipus i prioritat."],
          ["3. Es confirma al grup", "El bot respon «🆕 Incidència #14 registrada» amb tres botons."],
          ["4. Es fa la feina", "Qui ho arregla respon «fet» o prem «Resolta». Pot dir també «esperant material»."],
          ["5. Queda tot apuntat", "Al panell es veu l'historial, les fotos, el cost i els informes."],
        ]} />
        <p>
          Cada matí el bot envia al grup la llista de pendents i, si està activat, un resum per correu.
          Les tasques de <strong>manteniment preventiu</strong> (netejar filtres, revisar extintors…) es converteixen soles
          en incidències el dia que toquen.
        </p>
        <Nota>Ningú ha d'aprendre res nou per avisar: es continua escrivint al grup com fins ara. El bot fa la feina d'apuntar.</Nota>
      </>
    ),
  },
  {
    id: "avisar",
    titol: "2. Telegram: avisar d'una avaria",
    cos: (
      <>
        <p>Escriu al grup de manteniment el que passa i <strong>on</strong> passa. Pots fer-ho amb text, foto, àudio o vídeo, en català o en castellà.</p>
        <Xat qui="Pisos">309 tapa del vàter solta</Xat>
        <Xat qui="Recepció">La 214 diu que no funciona l'aire, és manteniment</Xat>
        <Xat qui="Cuina">📷 (foto) Gotera al magatzem de begudes</Xat>
        <h3>Bones pràctiques</h3>
        <ul>
          <li><strong>Digues sempre el lloc</strong>: el número d'habitació o el nom de la zona (Restaurant nou, Piscina, Cuina…). Si no hi és, el bot ho preguntarà.</li>
          <li><strong>Una avaria per missatge</strong> és el més clar. Si en dius dues alhora («322 i 221 no obre el pany»), el bot en crea dues.</li>
          <li>Pots enviar <strong>diversos missatges seguits</strong> (una foto i després el text): el bot espera uns segons i els llegeix junts.</li>
          <li>Si el client continua a l'habitació, digues <strong>«és manteniment»</strong>; si avui entra algú, <strong>«avui és entrada»</strong>. El bot hi posarà més prioritat.</li>
          <li>Els àudios s'entenen bé. Els vídeos molt llargs (més de ~14 MB) es guarden però el bot no els pot analitzar.</li>
        </ul>
        <h3>Prioritats que posa el bot</h3>
        <ul>
          <li><span className="prio urgent">Urgent</span> — sense aigua, inundació o aigua que cau, el client no pot entrar, risc per a la seguretat.</li>
          <li><span className="prio alta">Alta</span> — habitació ocupada («és manteniment»), entrada avui, queixa del client o habitació inutilitzable.</li>
          <li><span className="prio mitjana">Mitjana</span> — la resta.</li>
          <li><span className="prio baixa">Baixa</span> — estètic o que pot esperar (pintar, «està molt feo»).</li>
        </ul>
        <Nota tipus="consell">Les salutacions, bromes i converses entre companys («ho has mirat?») el bot les ignora: no cal deixar d'usar el grup amb normalitat.</Nota>
      </>
    ),
  },
  {
    id: "respostes",
    titol: "3. Telegram: què respon el bot i com corregir-lo",
    cos: (
      <>
        <p>Quan registra una avaria, el bot respon al missatge original:</p>
        <Xat qui="Bot" bot>🆕 Incidència #14 registrada{"\n"}Hab. 309 · Fontaneria · Prioritat mitjana{"\n"}Tapa del vàter solta</Xat>
        <p>A sota hi ha tres botons:</p>
        <ul>
          <li><B>✔ Resolta</B> — la tanca (ja està arreglada).</li>
          <li><B>✏ Corregir</B> — el bot pregunta què cal canviar. Respon al seu missatge, per exemple «és la 204», «és urgent» o «és l'aixeta, no la cisterna». Si contestes sense fer «Respondre», també ho entén durant els 10 minuts següents.</li>
          <li><B>✖ Anul·lar</B> — si no era una avaria, era un duplicat o un error.</li>
        </ul>
        <p>Si l'avaria ja havia passat al mateix lloc fa poc, el bot ho avisa: <em>«🔁 2a vegada en 30 dies: fontaneria a Hab. 309»</em>. És útil per detectar problemes que es repeteixen.</p>
        <h3>Afegir informació a una incidència</h3>
        <p>Respon (mantén premut el missatge → <B>Respondre</B>) a l'avís o a la confirmació del bot amb el que vulguis afegir: una foto nova, «ja he trucat al tècnic», etc. El bot respon <em>«📎 Afegit a la incidència #14»</em>.</p>
        <h3>Quan el bot pregunta</h3>
        <p>Només pregunta quan falta el lloc o quan un «fet» podria ser de diverses incidències. Respon al seu missatge amb la dada que falta («la 112»).</p>
      </>
    ),
  },
  {
    id: "estats",
    titol: "4. Telegram: estats i tancar incidències",
    cos: (
      <>
        <h3>Estats mentre s'hi treballa</h3>
        <p>No cal fer res especial: el bot entén frases normals i canvia l'estat.</p>
        <ul>
          <li><strong>🔧 En curs</strong> — «hi vaig», «ara ho miro», «a mig dia la canvio».</li>
          <li><strong>⏳ Esperant material</strong> — «està demanada», «no hi ha stock», «s'ha de comprar el recanvi».</li>
          <li><strong>🏢 Proveïdor extern</strong> — «ja he trucat al lampista», «han de venir els dels ascensors».</li>
          <li><strong>Pendent</strong> — torna a estar per fer (per exemple, ha arribat la peça però encara no s'ha posat).</li>
        </ul>
        <h3>Tancar una incidència</h3>
        <Passos>
          <li><strong>Respon «fet»</strong> (o «arreglat», «ja està», «solucionat») al missatge de l'avís o al del bot. Es tanca a l'instant.</li>
          <li>O prem <B>✔ Resolta</B> a la confirmació del bot.</li>
          <li>Si després pisos ha de tornar a netejar, escriu <strong>«repassar»</strong> («202 i 305 repassar»): es tanca i queda marcada com <em>Cal repassar</em>.</li>
        </Passos>
        <Nota tipus="compte">Un «fet» sense respondre a cap missatge el bot l'intenta lligar amb la incidència correcta; si n'hi ha diverses possibles, preguntarà quina. Respondre el missatge és sempre el més segur.</Nota>
      </>
    ),
  },
  {
    id: "resum",
    titol: "5. Resum del matí i manteniment preventiu",
    cos: (
      <>
        <p>Cada matí (per defecte a les 8:30) el bot publica al grup:</p>
        <Xat qui="Bot" bot>☀ Bon dia! Hi ha 18 incidències pendents:{"\n"}🔴 #12 Hab. 303 · Cau aigua de la safata de l'aire (fa 5 dies){"\n"}🟠 #10 Hab. 213 · No funciona l'aire (fa 5 dies) · 🔧 en curs{"\n"}🟡 #14 Hab. 309 · Tapa del vàter solta · ⏳ esperant material</Xat>
        <p>A la mateixa hora, les tasques de <strong>manteniment preventiu</strong> que toquen es publiquen com a incidències noves:</p>
        <Xat qui="Bot" bot>🗓 Manteniment preventiu · Incidència #15{"\n"}Hab. 101 · Tasca · Prioritat mitjana{"\n"}Netejar els filtres de l'aire condicionat{"\n"}Cada 90 dies.</Xat>
        <p>Es tanquen igual que qualsevol altra («fet» o <B>✔ Resolta</B>). En tancar-la, el sistema programa sol la propera vegada (en aquest exemple, d'aquí a 90 dies).</p>
        <p>Si està activat, Direcció rep també un <strong>resum per correu</strong> des de manteniment@hotelrull.com amb els pendents (urgents a dalt), les resoltes del dia anterior amb el cost i el preventiu dels propers 7 dies.</p>
      </>
    ),
  },
  {
    id: "entrar",
    titol: "6. Panell web: entrar i rols",
    cos: (
      <>
        <p>Adreça: <strong>https://manteniment.hotelrull.com</strong>. Funciona a l'ordinador, la tauleta i el mòbil.</p>
        <Passos>
          <li>Escriu el teu correu i prem <B>Envia'm l'enllaç</B>. No hi ha contrasenya.</li>
          <li>Obre el correu «Entra al panell de manteniment» i prem <B>Entrar al panell</B>. <strong>Fes-ho al mateix navegador</strong> on l'has demanat.</li>
          <li>L'enllaç funciona una sola vegada i caduca en una hora. La sessió queda oberta en aquell dispositiu fins que premis <B>Sortir</B>.</li>
        </Passos>
        <p>Només hi poden entrar les persones que Direcció ha convidat. Si algú entra amb un correu no convidat, queda <em>Pendent d'aprovació</em> i no veu cap dada fins que Direcció l'aprova.</p>
        <h3>Què pot fer cada rol</h3>
        <div className="taula-caixa">
          <table>
            <thead><tr><th></th><th>Direcció</th><th>Administració</th><th>Manteniment</th></tr></thead>
            <tbody>
              <tr><td>Veure incidències, mapa i informes</td><td>✔</td><td>✔</td><td>✔</td></tr>
              <tr><td>Canviar estat, prioritat, cost i notes</td><td>✔</td><td>✔</td><td>✔</td></tr>
              <tr><td>Gestionar el manteniment preventiu</td><td>✔</td><td>✔</td><td>Només consultar</td></tr>
              <tr><td>Configuració (resum, zones, equip, usuaris)</td><td>✔</td><td>—</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "avui",
    titol: "7. Panell: Avui i Incidències",
    cos: (
      <>
        <h3>Avui</h3>
        <p>La pantalla d'inici: quantes incidències hi ha obertes, quantes són urgents o altes, i la llista ordenada de més a menys urgent. Prem el número o la descripció per obrir-ne la fitxa.</p>
        <h3>Incidències</h3>
        <p>Totes les incidències, amb filtres:</p>
        <ul>
          <li><strong>Cerca</strong> per habitació, número o paraula («214», «aixeta»).</li>
          <li><strong>Estat</strong> (obertes, tancades, totes o un estat concret), <strong>prioritat</strong> i <strong>categoria</strong>.</li>
          <li><strong>Ordre</strong>: més urgents, més recents o per lloc.</li>
        </ul>
        <Nota tipus="consell">Els filtres es guarden a l'adreça de la pàgina: si la copies i l'envies, l'altra persona veu la mateixa llista.</Nota>
        <h3>La fitxa d'una incidència</h3>
        <ul>
          <li><strong>Què passa</strong> i qui ho va avisar.</li>
          <li><strong>Fotos i àudios</strong> del grup. Prem una foto per veure-la gran; passa d'una a l'altra amb les fletxes (o lliscant el dit al mòbil). Esc o ✕ per tancar.</li>
          <li><strong>Missatges del grup</strong> relacionats, amb la transcripció dels àudios.</li>
          <li><strong>Historial de canvis</strong>: qui va canviar què i quan (des de Telegram o des del panell).</li>
          <li><strong>Gestió</strong> (a la dreta): estat, prioritat, categoria, a qui està assignada, cost, materials, observacions i «Cal repassar-la». Prem <B>Desar canvis</B>; cada canvi queda a l'historial.</li>
          <li><strong>Altres a aquest lloc</strong>: les altres incidències de la mateixa habitació o zona, i l'enllaç <B>Veure al mapa</B>.</li>
        </ul>
        <Nota>Apuntar el <strong>cost i els materials</strong> en tancar una incidència fa que els informes i el control del pressupost preventiu siguin útils.</Nota>
      </>
    ),
  },
  {
    id: "mapa",
    titol: "8. Panell: Mapa de l'hotel",
    cos: (
      <>
        <p>Les plantes amb totes les habitacions, i a sota les zones comunes i tècniques. Cada casella es pinta segons el que hi ha obert:</p>
        <ul>
          <li><span className="mostra-ajuda urgent" /> <strong>Vermell</strong>: alguna incidència urgent o alta.</li>
          <li><span className="mostra-ajuda pendent" /> <strong>Sorra</strong>: alguna de pendent.</li>
          <li><span className="mostra-ajuda net" /> <strong>Blanc</strong>: res obert.</li>
        </ul>
        <p>El número petit («3×») és quantes incidències ha tingut aquell lloc en el període triat a dalt a la dreta (aquesta temporada, els últims 12 mesos o tot l'historial). Serveix per veure quines habitacions fallen una vegada i una altra.</p>
        <p>Prem una habitació per veure'n el resum, les últimes fotos, les obertes i l'historial. El botó <B>Exportar l'historial (Excel)</B> en descarrega la llista.</p>
      </>
    ),
  },
  {
    id: "preventiu",
    titol: "9. Panell: Manteniment preventiu",
    cos: (
      <>
        <p>Les tasques que s'han de fer cada cert temps. La llista les agrupa en <strong>Toca ara</strong>, <strong>Properes 30 dies</strong>, <strong>Més endavant</strong> i <strong>Pausades</strong>. Si una tasca ja ha generat l'avís i encara no s'ha fet, hi diu «Avisat: #15».</p>
        <h3>Crear o editar una tasca</h3>
        <Passos>
          <li>Prem <B>Nova tasca</B> (o <B>Obrir</B> en una d'existent).</li>
          <li>Omple què cal fer, el lloc (o «Tot l'hotel»), la categoria, la <strong>freqüència</strong> (setmanal, mensual, trimestral… o un nombre de dies) i la <strong>propera vegada</strong>.</li>
          <li>Opcional: <strong>responsable</strong> (se li assignarà la incidència), <strong>pressupost per vegada</strong>, instruccions i <strong>materials previstos</strong> (nom, quantitat, unitat i cost; el total es calcula sol).</li>
          <li>Prem <B>Desar canvis</B>. Si hi ha algun camp per revisar, surt marcat en vermell amb l'explicació a sota.</li>
        </Passos>
        <h3>Accions</h3>
        <ul>
          <li><B>Duplicar</B> — crea una còpia per fer-ne una de semblant (p. ex. la mateixa tasca en una altra planta).</li>
          <li><B>Pausar</B> / <B>Reactivar</B> — deixa de generar avisos temporalment (tasques de temporada).</li>
          <li><B>Esborrar</B> — només surt si la tasca <strong>no ha generat mai cap incidència</strong> (creada per error).</li>
          <li><B>Arxivar</B> — per a les que ja tenen historial: deixen d'avisar i surten de la llista, però es conserva tot el que s'ha fet. Es poden recuperar amb <B>Veure arxivades</B>.</li>
        </ul>
        <p>A <strong>Historial</strong> hi ha cada vegada que s'ha fet, el que s'hi va gastar i si va superar el pressupost. El que s'ha gastat de veritat s'apunta a la fitxa de cada incidència en tancar-la.</p>
      </>
    ),
  },
  {
    id: "informes",
    titol: "10. Panell: Informes",
    cos: (
      <>
        <p>Tria el període (aquesta temporada des de l'1 de març, últims 30 o 90 dies, aquest any o unes dates concretes) i veuràs:</p>
        <ul>
          <li><strong>Xifres clau</strong>: incidències noves, resoltes, pendents ara, temps habitual fins resoldre i cost apuntat.</li>
          <li><strong>Evolució</strong> per setmanes o mesos (passa el ratolí per sobre d'una columna per veure'n el valor; «Veure les dades» mostra la taula).</li>
          <li><strong>Per tipus d'avaria</strong>.</li>
          <li><strong>Llocs amb més incidències</strong>, amb l'avís «Es repeteix» quan n'hi ha 3 o més.</li>
          <li><strong>Temps fins resoldre per prioritat</strong>. «Temps habitual» és la mediana: la meitat es resolen abans i la meitat després.</li>
          <li><strong>Preventiu</strong>: vegades fetes, gastat i pressupost.</li>
        </ul>
        <p><B>Exportar (Excel)</B> descarrega totes les incidències del període. <B>Imprimir o PDF</B> treu l'informe net, sense menú; per desar-lo en PDF, tria «Desa com a PDF» a la finestra d'impressió.</p>
        <Nota>Les incidències anul·lades no compten als informes.</Nota>
      </>
    ),
  },
  {
    id: "configuracio",
    titol: "11. Panell: Configuració (Direcció)",
    cos: (
      <>
        <h3>Resum diari</h3>
        <ul>
          <li><strong>Telegram</strong>: activar o no el resum del matí i l'hora.</li>
          <li><strong>Correu</strong>: activar-lo, l'hora, els dies de la setmana, qui el rep (afegeix els correus un a un) i què inclou.</li>
          <li><B>Enviar-me una prova ara</B> envia el resum amb les dades d'avui al teu correu, per comprovar que arriba bé.</li>
          <li><em>Servidor de correu</em>: les dades de manteniment@hotelrull.com. La contrasenya no es guarda al panell.</li>
        </ul>
        <h3>Zones de l'hotel</h3>
        <p>Habitacions, zones comunes i tècniques. Pots afegir-ne, canviar-ne el nom o la planta i posar-hi <strong>altres noms que fa servir l'equip</strong> («rest nou», «el de dalt»): el bot els entendrà de seguida. Les zones amb incidències no s'esborren, es <B>Desactiven</B>.</p>
        <h3>Equip de Telegram</h3>
        <p>Les persones apareixen soles quan escriuen al grup per primera vegada. Aquí els pots posar el nom com el coneixeu, el rol (Manteniment, Pisos, Recepció…) i desactivar qui ja no hi és.</p>
        <h3>Usuaris del panell</h3>
        <Passos>
          <li>A <strong>Convidar una persona</strong>, escriu el correu, el nom i el rol, i prem <B>Convidar</B>.</li>
          <li>Prem <B>Copiar</B> per copiar l'adreça del panell i envia-la a la persona.</li>
          <li>Quan entri amb aquell correu tindrà accés directament.</li>
        </Passos>
        <p>Des de la mateixa llista pots canviar el rol, <B>Desactivar</B> o <B>Reactivar</B> l'accés, esborrar una invitació no usada i <B>Aprovar</B> o <B>Rebutjar</B> qui hagi entrat sense invitació. Sempre ha de quedar com a mínim una persona de Direcció.</p>
      </>
    ),
  },
  {
    id: "problemes",
    titol: "12. Preguntes freqüents i problemes",
    cos: (
      <>
        <dl className="faq-ajuda">
          <dt>No m'arriba l'enllaç per entrar al panell.</dt>
          <dd>Mira la carpeta de correu brossa i espera un minut. Comprova que has escrit el correu amb què et van convidar. Si demanes molts enllaços seguits, cal esperar uns minuts.</dd>
          <dt>Diu «Pendent d'aprovació».</dt>
          <dd>Has entrat amb un correu que no estava convidat. Demana a Direcció que t'aprovi a Configuració → Usuaris del panell i després prem «Ja m'han aprovat».</dd>
          <dt>El bot no ha respost al meu avís.</dt>
          <dd>Espera un minut: llegeix els missatges en grups cada 30 segons. Si era una conversa o no deia quina avaria era, l'haurà ignorat. Torna-ho a escriure amb el lloc i què passa.</dd>
          <dt>El bot ha posat una habitació o una prioritat equivocada.</dt>
          <dd>Prem «✏ Corregir» i respon amb la correcció («és la 204», «és urgent»). També es pot canviar a la fitxa del panell.</dd>
          <dt>Surt «zona no reconeguda».</dt>
          <dd>El lloc no és a la llista de zones. Direcció el pot afegir a Configuració → Zones, o afegir-lo com a «altre nom» d'una zona existent.</dd>
          <dt>Hi ha una incidència repetida.</dt>
          <dd>Anul·la la que sobra amb «✖ Anul·lar» (o canvia-li l'estat a Anul·lada al panell). No compta als informes.</dd>
          <dt>He tancat una incidència per error.</dt>
          <dd>Obre-la al panell i torna-li a posar l'estat «Oberta» o «En curs». Queda a l'historial.</dd>
        </dl>
      </>
    ),
  },
  {
    id: "dades",
    titol: "13. Dades i privadesa",
    cos: (
      <>
        <ul>
          <li>Les dades es guarden en un servidor a Europa i només hi accedeixen les persones convidades al panell.</li>
          <li>Per entendre els avisos, els missatges, fotos i àudios del grup s'analitzen amb un servei d'intel·ligència artificial de Google (Gemini).</li>
          <li>El bot només llegeix el grup de manteniment. Els missatges que no són avisos no generen res.</li>
          <li>Les fotos i àudios només es poden veure des del panell amb sessió iniciada; els enllaços caduquen al cap d'una hora.</li>
          <li>No escriviu al grup dades personals dels clients (noms, telèfons, documents): no calen per arreglar res.</li>
        </ul>
        <p>Dubtes o problemes amb el sistema: Kaipi Marketing.</p>
      </>
    ),
  },
];
