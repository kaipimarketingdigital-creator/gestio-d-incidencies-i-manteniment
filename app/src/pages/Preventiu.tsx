import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSessio } from "../lib/sessio";
import EditorMaterials, { MATERIALS_PREVENTIU, carregarMaterials, desarMaterials, totalMaterials, validarMaterials, type Material } from "../components/Materials";
import {
  CATEGORIES, ESTATS_OBERTS, NOM_CATEGORIA, NOM_ESTAT, dataCurta,
  type Categoria, type Estat, type Persona, type Zona,
} from "../lib/incidencies";

type Tasca = {
  id: string;
  tasca: string;
  zona_id: string | null;
  categoria: Categoria;
  periodicitat_dies: number;
  propera_revisio: string;
  responsable_id: string | null;
  activa: boolean;
  observacions: string | null;
  ultima_feta: string | null;
  pressupost: number | null;
  arxivada_el: string | null;
};
type Execucio = { id: number; preventiu_id: string; estat: Estat; cost: number | null; materials: string | null; creada_el: string; resolta_el: string | null };

const PERIODES: [number, string][] = [[7, "Setmanal"], [15, "Quinzenal"], [30, "Mensual"], [90, "Trimestral"], [180, "Semestral"], [365, "Anual"]];

function avuiISO() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }); // AAAA-MM-DD
}
function diesFins(data: string) {
  return Math.round((Date.parse(data) - Date.parse(avuiISO())) / 864e5);
}
function quan(data: string) {
  const d = diesFins(data);
  if (d === 0) return "Avui";
  if (d === 1) return "Demà";
  if (d < 0) return `Fa ${-d} ${d === -1 ? "dia" : "dies"}`;
  return `D'aquí a ${d} dies`;
}
function periode(dies: number) {
  return PERIODES.find(([d]) => d === dies)?.[1] ?? `Cada ${dies} dies`;
}
const vegades = (n: number) => (n === 0 ? "Encara no s'ha fet" : n === 1 ? "Feta 1 vegada" : `Feta ${n} vegades`);
const euros = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString("ca-ES", { style: "currency", currency: "EUR" });
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

type Grup = "vencudes" | "aviat" | "endavant" | "pausades" | "arxivades";
function grupDe(t: Tasca): Grup {
  if (t.arxivada_el) return "arxivades";
  if (!t.activa) return "pausades";
  const d = diesFins(t.propera_revisio);
  if (d <= 0) return "vencudes";
  if (d <= 30) return "aviat";
  return "endavant";
}
const NOM_GRUP: Record<Grup, string> = {
  vencudes: "Toca ara",
  aviat: "Properes 30 dies",
  endavant: "Més endavant",
  pausades: "Pausades",
  arxivades: "Arxivades",
};

export default function Preventiu() {
  const { usuari } = useSessio();
  const potGestionar = usuari?.rol === "direccio" || usuari?.rol === "administracio";
  const [tasques, setTasques] = useState<Tasca[] | null>(null);
  const [zones, setZones] = useState<Zona[]>([]);
  const [persones, setPersones] = useState<Persona[]>([]);
  const [execucions, setExecucions] = useState<Execucio[]>([]);
  const [veureArxivades, setVeureArxivades] = useState(false);
  const [editant, setEditant] = useState<{ tasca: Tasca | null; copia?: boolean } | null>(null);
  const [avis, setAvis] = useState<{ tipus: "ok" | "error"; text: string } | null>(null);

  const carregar = useCallback(async () => {
    const [t, z, p, e] = await Promise.all([
      supabase.from("manteniment_preventiu").select("*").order("propera_revisio"),
      supabase.from("zones").select("id, nom, tipus, planta").eq("activa", true).order("planta").order("nom"),
      supabase.from("persones").select("id, nom, actiu").order("nom"),
      supabase.from("incidencies").select("id, preventiu_id, estat, cost, materials, creada_el, resolta_el").not("preventiu_id", "is", null).order("creada_el", { ascending: false }),
    ]);
    if (t.error) setAvis({ tipus: "error", text: "No s'han pogut carregar les tasques." });
    setTasques((t.data ?? []) as Tasca[]);
    setZones((z.data ?? []) as Zona[]);
    setPersones((p.data ?? []) as Persona[]);
    setExecucions((e.data ?? []) as Execucio[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const nomZona = (id: string | null) => zones.find((z) => z.id === id)?.nom ?? "Tot l'hotel";
  const nomPersona = (id: string | null) => persones.find((p) => p.id === id)?.nom ?? "—";
  const execDe = (id: string) => execucions.filter((x) => x.preventiu_id === id);

  const grups = useMemo(() => {
    const g: Record<Grup, Tasca[]> = { vencudes: [], aviat: [], endavant: [], pausades: [], arxivades: [] };
    (tasques ?? []).forEach((t) => g[grupDe(t)].push(t));
    return g;
  }, [tasques]);

  async function accio(t: Tasca, canvis: Partial<Tasca>, ok: string) {
    const { error } = await supabase.from("manteniment_preventiu").update(canvis).eq("id", t.id);
    setAvis(error ? { tipus: "error", text: "No s'ha pogut desar. Torna-ho a provar." } : { tipus: "ok", text: ok });
    setEditant(null);
    await carregar();
  }
  async function esborrar(t: Tasca) {
    if (!window.confirm(`Esborrar definitivament «${t.tasca}»?`)) return;
    const { error, count } = await supabase.from("manteniment_preventiu").delete({ count: "exact" }).eq("id", t.id);
    setAvis(error || !count
      ? { tipus: "error", text: "No s'ha pogut esborrar. Si ja ha generat incidències, arxiva-la." }
      : { tipus: "ok", text: "Tasca esborrada." });
    setEditant(null);
    await carregar();
  }

  const ordreGrups: Grup[] = ["vencudes", "aviat", "endavant", "pausades", ...(veureArxivades ? ["arxivades" as Grup] : [])];

  return (
    <>
      <div className="capcalera">
        <div>
          <h1>Manteniment preventiu</h1>
          <span className="sub">Cada tasca crea una incidència al grup quan toca; en tancar-la es programa la següent.</span>
        </div>
        {potGestionar && <button type="button" className="boto" onClick={() => setEditant({ tasca: null })}>Nova tasca</button>}
      </div>

      {avis && <p className={`avis ${avis.tipus}`} role={avis.tipus === "error" ? "alert" : "status"}>{avis.text}</p>}

      <div className="resum">
        <div className="xifra-gran urgent"><strong className="xifra">{grups.vencudes.length}</strong><span>Toca ara</span></div>
        <div className="xifra-gran alta"><strong className="xifra">{grups.aviat.length}</strong><span>Properes 30 dies</span></div>
        <div className="xifra-gran"><strong className="xifra">{grups.endavant.length}</strong><span>Més endavant</span></div>
        <div className="xifra-gran"><strong className="xifra">{grups.pausades.length}</strong><span>Pausades</span></div>
      </div>

      {tasques === null && <p style={{ color: "var(--muted)" }}>Carregant…</p>}
      {tasques?.length === 0 && (
        <div className="targeta"><p style={{ margin: 0 }}>Encara no hi ha cap tasca preventiva.{potGestionar && " Crea la primera amb «Nova tasca»."}</p></div>
      )}

      {ordreGrups.map((g) => grups[g].length > 0 && (
        <section key={g} className="targeta" aria-labelledby={`g-${g}`}>
          <h2 id={`g-${g}`}>{NOM_GRUP[g]} <span className="comptador">{grups[g].length}</span></h2>
          <div className="taula-caixa">
            <table>
              <thead>
                <tr><th>Tasca</th><th>Lloc</th><th>Freqüència</th><th>Propera</th><th>Responsable</th><th>Pressupost</th><th></th></tr>
              </thead>
              <tbody>
                {grups[g].map((t) => {
                  const d = diesFins(t.propera_revisio);
                  const oberta = execDe(t.id).find((x) => ESTATS_OBERTS.includes(x.estat));
                  return (
                    <tr key={t.id}>
                      <td><button type="button" className="enllac-boto" onClick={() => setEditant({ tasca: t })}>{t.tasca}</button>
                        <span className="sota">{NOM_CATEGORIA[t.categoria]} · {vegades(execDe(t.id).filter((x) => x.estat === "resolta").length)}</span></td>
                      <td>{nomZona(t.zona_id)}</td>
                      <td>{periode(t.periodicitat_dies)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {oberta ? (
                          <>
                            <Link to={`/incidencies/${oberta.id}`}>Avisat: #{oberta.id}</Link>
                            <span className="sota">{NOM_ESTAT[oberta.estat]} des del {dataCurta(oberta.creada_el)}</span>
                          </>
                        ) : (
                          <>
                            <span className={g === "vencudes" ? "prio urgent" : d <= 7 && g === "aviat" ? "prio alta" : undefined}>{quan(t.propera_revisio)}</span>
                            <span className="sota">{dataCurta(t.propera_revisio)}</span>
                          </>
                        )}
                      </td>
                      <td>{nomPersona(t.responsable_id)}</td>
                      <td className="xifra">{euros(t.pressupost)}</td>
                      <td><button type="button" className="boto secundari petit" onClick={() => setEditant({ tasca: t })}>{potGestionar ? "Obrir" : "Veure"}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {(tasques?.some((t) => t.arxivada_el)) && (
        <button type="button" className="boto secundari" style={{ alignSelf: "flex-start" }} onClick={() => setVeureArxivades(!veureArxivades)}>
          {veureArxivades ? "Amagar arxivades" : `Veure arxivades (${grups.arxivades.length})`}
        </button>
      )}

      {editant && (
        <Editor
          tasca={editant.tasca}
          copia={!!editant.copia}
          potGestionar={potGestionar}
          zones={zones}
          persones={persones}
          execucions={editant.tasca && !editant.copia ? execDe(editant.tasca.id) : []}
          onTancar={() => setEditant(null)}
          onDesat={async (text) => { setAvis({ tipus: "ok", text }); setEditant(null); await carregar(); }}
          onDuplicar={(t) => setEditant({ tasca: t, copia: true })}
          onPausar={(t) => accio(t, { activa: !t.activa }, t.activa ? "Tasca pausada: no generarà avisos." : "Tasca reactivada.")}
          onArxivar={(t) => accio(t, t.arxivada_el ? { arxivada_el: null } : { activa: false, arxivada_el: new Date().toISOString() },
            t.arxivada_el ? "Tasca recuperada (queda pausada; reactiva-la quan vulguis)." : "Tasca arxivada. El seu historial es conserva.")}
          onEsborrar={esborrar}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- fitxa / formulari d'una tasca

type PropsEditor = {
  tasca: Tasca | null; copia: boolean; potGestionar: boolean;
  zones: Zona[]; persones: Persona[]; execucions: Execucio[];
  onTancar: () => void; onDesat: (text: string) => void;
  onDuplicar: (t: Tasca) => void; onPausar: (t: Tasca) => void; onArxivar: (t: Tasca) => void; onEsborrar: (t: Tasca) => void;
};

function Editor(p: PropsEditor) {
  const { tasca, copia, potGestionar } = p;
  const nova = !tasca || copia;
  const dialeg = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState(() => ({
    tasca: tasca ? (copia ? `${tasca.tasca} (còpia)` : tasca.tasca) : "",
    zona_id: tasca?.zona_id ?? "",
    categoria: (tasca?.categoria ?? "tasca") as Categoria,
    periodicitat_dies: String(tasca?.periodicitat_dies ?? 30),
    propera_revisio: tasca && !copia ? tasca.propera_revisio : avuiISO(),
    responsable_id: tasca?.responsable_id ?? "",
    pressupost: tasca?.pressupost == null ? "" : String(tasca.pressupost).replace(".", ","),
    observacions: tasca?.observacions ?? "",
  }));
  const [materials, setMaterials] = useState<Material[]>([]);
  const [esborrats, setEsborrats] = useState<number[]>([]);
  const [desant, setDesant] = useState(false);
  // Errors al costat de cada camp (clau = camp, o "mat-<fila>-<camp>"); "general" surt dins el panell.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const err = (k: string) => errors[k];
  const treureError = (k: string) => {
    if (!errors[k] && !errors.general) return;
    const r = { ...errors };
    delete r[k];
    delete r.general;
    setErrors(r);
  };

  useEffect(() => {
    dialeg.current?.showModal();
    if (tasca) {
      carregarMaterials(MATERIALS_PREVENTIU, tasca.id, copia).then(setMaterials);
    }
  }, [tasca, copia]);

  const posar = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });
  const totalPrevist = totalMaterials(materials);
  const tancades = p.execucions.filter((x) => x.estat === "resolta");
  const gastMitja = tancades.length ? tancades.reduce((s, x) => s + (x.cost ?? 0), 0) / tancades.length : null;
  const zonesPerPlanta = useMemo(() => {
    const m = new Map<string, Zona[]>();
    p.zones.forEach((z) => {
      const k = z.planta === null ? "Altres" : z.planta === 0 ? "Planta baixa" : `Planta ${z.planta}`;
      m.set(k, [...(m.get(k) ?? []), z]);
    });
    return [...m.entries()];
  }, [p.zones]);

  async function desar(e: FormEvent) {
    e.preventDefault();
    const dies = Number(f.periodicitat_dies);
    const pressupost = num(f.pressupost);
    const e2: Record<string, string> = {};
    if (!Number.isInteger(dies) || dies < 1) e2.periodicitat = "Ha de ser un nombre de dies sencer (1 o més).";
    if (pressupost !== null && (Number.isNaN(pressupost) || pressupost < 0)) e2.pressupost = "Escriu un import, per exemple 45,00.";
    Object.assign(e2, validarMaterials(materials));
    setErrors(e2);
    if (Object.keys(e2).length) {
      // Porta la persona al primer camp amb error.
      setTimeout(() => (dialeg.current?.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus(), 0);
      return;
    }
    setDesant(true);
    const fila = {
      tasca: f.tasca.trim(), zona_id: f.zona_id || null, categoria: f.categoria, periodicitat_dies: dies,
      propera_revisio: f.propera_revisio, responsable_id: f.responsable_id || null, pressupost,
      observacions: f.observacions.trim() || null,
    };
    const r = nova
      ? await supabase.from("manteniment_preventiu").insert(fila).select("id").single()
      : await supabase.from("manteniment_preventiu").update(fila).eq("id", tasca!.id).select("id").single();
    if (r.error || !r.data) {
      setDesant(false);
      setErrors({ general: "No s'ha pogut desar la tasca. Revisa la connexió i torna-ho a provar." });
      return;
    }
    const id = r.data.id as string;
    await desarMaterials(MATERIALS_PREVENTIU, id, materials, esborrats);
    setDesant(false);
    p.onDesat(nova ? "Tasca creada." : "Canvis desats.");
  }

  const nomesLectura = !potGestionar;
  return (
    <dialog ref={dialeg} className="panell-lateral" onClose={p.onTancar} aria-labelledby="t-editor">
      <form onSubmit={desar} className="panell-cos">
        <div className="panell-capcalera">
          <h2 id="t-editor">{nova ? (copia ? "Duplicar tasca" : "Nova tasca") : "Tasca preventiva"}</h2>
          <button type="button" className="tancar" onClick={() => dialeg.current?.close()} aria-label="Tancar">✕</button>
        </div>

        {tasca?.arxivada_el && !copia && <p className="avis info">Arxivada el {dataCurta(tasca.arxivada_el)}. No genera avisos.</p>}
        {tasca && !tasca.activa && !tasca.arxivada_el && !copia && <p className="avis info">Pausada: no genera avisos fins que la reactivis.</p>}

        <fieldset disabled={nomesLectura} className="camps">
          <label className="camp">Què cal fer
            <input required value={f.tasca} onChange={(e) => posar("tasca", e.target.value)} placeholder="Netejar els filtres de l'aire condicionat" />
          </label>
          <div className="fila-camps">
            <label className="camp">Lloc
              <select value={f.zona_id} onChange={(e) => posar("zona_id", e.target.value)}>
                <option value="">Tot l'hotel / general</option>
                {zonesPerPlanta.map(([planta, zs]) => (
                  <optgroup key={planta} label={planta}>{zs.map((z) => <option key={z.id} value={z.id}>{z.nom}</option>)}</optgroup>
                ))}
              </select>
            </label>
            <label className="camp">Categoria
              <select value={f.categoria} onChange={(e) => posar("categoria", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{NOM_CATEGORIA[c]}</option>)}
              </select>
            </label>
          </div>
          <div className="fila-camps">
            <label className="camp">Freqüència
              <select value={PERIODES.some(([d]) => String(d) === f.periodicitat_dies) ? f.periodicitat_dies : "altre"}
                onChange={(e) => posar("periodicitat_dies", e.target.value === "altre" ? "60" : e.target.value)}>
                {PERIODES.map(([d, n]) => <option key={d} value={d}>{n} ({d} dies)</option>)}
                <option value="altre">Un altre nombre de dies…</option>
              </select>
            </label>
            {!PERIODES.some(([d]) => String(d) === f.periodicitat_dies) && (
              <label className="camp">Cada quants dies
                <input type="number" min={1} required value={f.periodicitat_dies} aria-invalid={!!err("periodicitat")} aria-describedby="e-periodicitat"
                  onChange={(e) => { posar("periodicitat_dies", e.target.value); treureError("periodicitat"); }} />
                {err("periodicitat") && <span id="e-periodicitat" className="error-camp">{err("periodicitat")}</span>}
              </label>
            )}
            <label className="camp">Propera vegada
              <input type="date" required value={f.propera_revisio} onChange={(e) => posar("propera_revisio", e.target.value)} />
            </label>
          </div>
          <div className="fila-camps">
            <label className="camp">Responsable
              <select value={f.responsable_id} onChange={(e) => posar("responsable_id", e.target.value)}>
                <option value="">Sense assignar</option>
                {p.persones.filter((x) => x.actiu || x.id === f.responsable_id).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
              </select>
            </label>
            <label className="camp">Pressupost per vegada (€)
              <input inputMode="decimal" value={f.pressupost} placeholder="0,00" aria-invalid={!!err("pressupost")} aria-describedby="e-pressupost"
                onChange={(e) => { posar("pressupost", e.target.value); treureError("pressupost"); }} />
              {err("pressupost") && <span id="e-pressupost" className="error-camp">{err("pressupost")}</span>}
            </label>
          </div>
          <label className="camp">Instruccions o observacions
            <textarea rows={2} value={f.observacions} onChange={(e) => posar("observacions", e.target.value)} />
          </label>

          <div className="materials">
            <div className="materials-cap">
              <h3>Costos</h3>
              {materials.length > 0 && <span className="xifra">Total: {euros(totalPrevist)}</span>}
            </div>
            <EditorMaterials materials={materials} onChange={setMaterials} errors={errors} onNetejarError={treureError} nomesLectura={nomesLectura}
              onTreure={(m) => { if (m.id) setEsborrats([...esborrats, m.id]); setMaterials(materials.filter((x) => x !== m)); setErrors({}); }} />
          </div>
        </fieldset>

        {tasca && !copia && (
          <div className="materials">
            <div className="materials-cap">
              <h3>Historial · {vegades(tancades.length).toLowerCase()}</h3>
              {gastMitja !== null && (
                <span className="xifra">Gast mitjà {euros(gastMitja)}{tasca.pressupost != null && ` · pressupost ${euros(tasca.pressupost)}`}</span>
              )}
            </div>
            {p.execucions.length === 0 ? (
              <p className="buit">Encara no ha generat cap avís.</p>
            ) : (
              <ul className="llista-altres">
                {p.execucions.map((x) => (
                  <li key={x.id}>
                    <Link to={`/incidencies/${x.id}`}>#{x.id} · {dataCurta(x.creada_el)} · {NOM_ESTAT[x.estat]}</Link>
                    <span>
                      {ESTATS_OBERTS.includes(x.estat) ? "Pendent de fer" : <>Gastat: {euros(x.cost)}</>}
                      {tasca.pressupost != null && x.cost != null && x.cost > tasca.pressupost && " (per sobre del pressupost)"}
                      {x.materials && ` · ${x.materials}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="buit">El que s'ha gastat de veritat s'apunta a cada incidència (cost i materials) en tancar-la.</p>
          </div>
        )}

        {errors.general && <p className="avis error" role="alert">{errors.general}</p>}
        {Object.keys(errors).some((k) => k !== "general") && (
          <p className="avis error" role="alert">Hi ha camps per revisar (marcats en vermell).</p>
        )}
        {potGestionar && (
          <div className="panell-peu">
            <button type="submit" className="boto" disabled={desant}>{desant ? "Desant…" : nova ? "Crear tasca" : "Desar canvis"}</button>
            {tasca && !copia && (
              <>
                <button type="button" className="boto secundari" onClick={() => p.onDuplicar(tasca)}>Duplicar</button>
                {!tasca.arxivada_el && (
                  <button type="button" className="boto secundari" onClick={() => p.onPausar(tasca)}>{tasca.activa ? "Pausar" : "Reactivar"}</button>
                )}
                {p.execucions.length === 0 ? (
                  <button type="button" className="boto perill" onClick={() => p.onEsborrar(tasca)}>Esborrar</button>
                ) : (
                  <button type="button" className="boto perill" onClick={() => p.onArxivar(tasca)}>{tasca.arxivada_el ? "Recuperar" : "Arxivar"}</button>
                )}
              </>
            )}
          </div>
        )}
      </form>
    </dialog>
  );
}
