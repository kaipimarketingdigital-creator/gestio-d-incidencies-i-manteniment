import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSessio } from "../lib/sessio";
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
type Material = { id?: number; nom: string; quantitat: string; unitat: string; cost_estimat: string };
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
          onError={(text) => setAvis({ tipus: "error", text })}
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
  onTancar: () => void; onDesat: (text: string) => void; onError: (text: string) => void;
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

  useEffect(() => {
    dialeg.current?.showModal();
    if (tasca) {
      supabase.from("preventiu_materials").select("*").eq("preventiu_id", tasca.id).order("id").then(({ data }) => {
        setMaterials((data ?? []).map((m) => ({
          id: copia ? undefined : m.id, nom: m.nom, quantitat: String(m.quantitat).replace(".", ","),
          unitat: m.unitat ?? "", cost_estimat: m.cost_estimat == null ? "" : String(m.cost_estimat).replace(".", ","),
        })));
      });
    }
  }, [tasca, copia]);

  const posar = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });
  const totalPrevist = materials.reduce((s, m) => s + (num(m.cost_estimat) ?? 0) * (num(m.quantitat) ?? 1), 0);
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
    if (!Number.isInteger(dies) || dies < 1) return p.onError("La freqüència ha de ser un nombre de dies (1 o més).");
    if (pressupost !== null && (Number.isNaN(pressupost) || pressupost < 0)) return p.onError("El pressupost ha de ser un import (per exemple 45,00).");
    const senseNom = materials.find((m) => !m.nom.trim() && (m.cost_estimat.trim() || (m.quantitat.trim() && m.quantitat.trim() !== "1")));
    if (senseNom) return p.onError("Hi ha un material sense nom. Escriu-lo o treu la fila amb ✕.");
    const mats = materials.filter((m) => m.nom.trim());
    for (const m of mats) {
      const q = num(m.quantitat), c = num(m.cost_estimat);
      if (q === null || Number.isNaN(q) || q <= 0 || (c !== null && (Number.isNaN(c) || c < 0))) {
        return p.onError(`Revisa la quantitat o el cost de «${m.nom}».`);
      }
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
      return p.onError("No s'ha pogut desar la tasca. Torna-ho a provar.");
    }
    const id = r.data.id as string;
    if (esborrats.length) await supabase.from("preventiu_materials").delete().in("id", esborrats);
    for (const m of mats) {
      const dades = { preventiu_id: id, nom: m.nom.trim(), quantitat: num(m.quantitat)!, unitat: m.unitat.trim() || null, cost_estimat: num(m.cost_estimat) };
      if (m.id) await supabase.from("preventiu_materials").update(dades).eq("id", m.id);
      else await supabase.from("preventiu_materials").insert(dades);
    }
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
                <input type="number" min={1} required value={f.periodicitat_dies} onChange={(e) => posar("periodicitat_dies", e.target.value)} />
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
              <input inputMode="decimal" value={f.pressupost} onChange={(e) => posar("pressupost", e.target.value)} placeholder="0,00" />
            </label>
          </div>
          <label className="camp">Instruccions o observacions
            <textarea rows={2} value={f.observacions} onChange={(e) => posar("observacions", e.target.value)} />
          </label>

          <div className="materials">
            <div className="materials-cap">
              <h3>Materials previstos</h3>
              {materials.length > 0 && <span className="xifra">Total previst: {euros(totalPrevist)}</span>}
            </div>
            {materials.length === 0 && <p className="buit">Cap material previst.</p>}
            {materials.map((m, k) => (
              <div key={m.id ?? `n${k}`} className="material">
                <input aria-label="Material" placeholder="Filtre G4" value={m.nom} onChange={(e) => setMaterials(materials.map((x, j) => j === k ? { ...x, nom: e.target.value } : x))} />
                <input aria-label="Quantitat" inputMode="decimal" className="curt" value={m.quantitat} onChange={(e) => setMaterials(materials.map((x, j) => j === k ? { ...x, quantitat: e.target.value } : x))} />
                <input aria-label="Unitat" placeholder="u." className="curt" value={m.unitat} onChange={(e) => setMaterials(materials.map((x, j) => j === k ? { ...x, unitat: e.target.value } : x))} />
                <input aria-label="Cost per unitat (€)" placeholder="€/u." inputMode="decimal" className="curt" value={m.cost_estimat} onChange={(e) => setMaterials(materials.map((x, j) => j === k ? { ...x, cost_estimat: e.target.value } : x))} />
                {!nomesLectura && (
                  <button type="button" className="treure" aria-label={`Treure ${m.nom || "material"}`} onClick={() => {
                    if (m.id) setEsborrats([...esborrats, m.id]);
                    setMaterials(materials.filter((_, j) => j !== k));
                  }}>✕</button>
                )}
              </div>
            ))}
            {!nomesLectura && (
              <button type="button" className="boto secundari petit" style={{ alignSelf: "flex-start" }}
                onClick={() => setMaterials([...materials, { nom: "", quantitat: "1", unitat: "", cost_estimat: "" }])}>+ Afegir material</button>
            )}
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
