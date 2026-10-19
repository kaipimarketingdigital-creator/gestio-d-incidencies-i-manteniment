import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Visor, { type Element } from "../components/Visor";
import { useSessio } from "../lib/sessio";
import {
  CATEGORIES, ESTATS, ESTATS_OBERTS, NOM_CAMP, NOM_CATEGORIA, NOM_ESTAT, NOM_PRIORITAT, PRIORITATS,
  dataCurta, dataHora, lloc, valorLlegible,
  type Categoria, type Estat, type Incidencia, type Persona, type Prioritat,
} from "../lib/incidencies";

type Adjunt = { id: number; tipus: "foto" | "audio" | "video" | "altre"; ruta_storage: string | null; url?: string };
type Missatge = { id: number; text: string | null; transcripcio: string | null; rebut_el: string; autor_id: string | null; adjunts: Adjunt[] };
type CanviHistorial = { id: number; camp: string; valor_anterior: string | null; valor_nou: string | null; canviat_el: string; persona_id: string | null };
type Formulari = {
  estat: Estat; prioritat: Prioritat; categoria: Categoria | ""; assignada_a: string;
  cost: string; materials: string; observacions: string; cal_repassar: boolean;
};

function formulariDe(i: Incidencia): Formulari {
  return {
    estat: i.estat, prioritat: i.prioritat, categoria: i.categoria ?? "", assignada_a: i.assignada_a ?? "",
    cost: i.cost === null ? "" : String(i.cost), materials: i.materials ?? "", observacions: i.observacions ?? "",
    cal_repassar: i.cal_repassar,
  };
}

export default function Fitxa() {
  const { id } = useParams();
  const num = Number(id);
  const { usuari } = useSessio();
  const [inc, setInc] = useState<Incidencia | null>(null);
  const [form, setForm] = useState<Formulari | null>(null);
  const [persones, setPersones] = useState<Persona[]>([]);
  const [missatges, setMissatges] = useState<Missatge[]>([]);
  const [historial, setHistorial] = useState<CanviHistorial[]>([]);
  const [altres, setAltres] = useState<Incidencia[]>([]);
  const [avis, setAvis] = useState<{ tipus: "ok" | "error"; text: string } | null>(null);
  const [desant, setDesant] = useState(false);
  const [noTrobada, setNoTrobada] = useState(false);
  const [visor, setVisor] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("incidencies").select("*, zones(nom, planta)").eq("id", num).maybeSingle();
    if (error || !data) {
      setNoTrobada(true);
      return;
    }
    const i = data as Incidencia;
    setInc(i);
    setForm(formulariDe(i));

    const [p, m, h, a] = await Promise.all([
      supabase.from("persones").select("id, nom, actiu").order("nom"),
      supabase.from("missatges").select("id, text, transcripcio, rebut_el, autor_id, adjunts(id, tipus, ruta_storage)").eq("incidencia_id", num).order("rebut_el"),
      supabase.from("historial").select("id, camp, valor_anterior, valor_nou, canviat_el, persona_id").eq("incidencia_id", num).order("canviat_el", { ascending: false }),
      i.zona_id
        ? supabase.from("incidencies").select("*, zones(nom, planta)").eq("zona_id", i.zona_id).neq("id", num).order("creada_el", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] }),
    ]);
    setPersones((p.data ?? []) as Persona[]);
    setHistorial((h.data ?? []) as CanviHistorial[]);
    setAltres((a.data ?? []) as Incidencia[]);

    // Les fotos i àudios són privats: es demanen enllaços temporals (1 hora).
    const msgs = (m.data ?? []) as Missatge[];
    const rutes = msgs.flatMap((x) => x.adjunts.map((ad) => ad.ruta_storage).filter((r): r is string => !!r));
    if (rutes.length) {
      const { data: signats } = await supabase.storage.from("adjunts").createSignedUrls(rutes, 3600);
      const perRuta = new Map((signats ?? []).map((s) => [s.path, s.signedUrl]));
      msgs.forEach((x) => x.adjunts.forEach((ad) => { if (ad.ruta_storage) ad.url = perRuta.get(ad.ruta_storage) ?? undefined; }));
    }
    setMissatges(msgs);
  }, [num]);

  useEffect(() => { carregar(); }, [carregar]);

  const nomPersona = (pid: string | null) => persones.find((x) => x.id === pid)?.nom ?? null;

  async function desar(e: FormEvent) {
    e.preventDefault();
    if (!inc || !form) return;
    const abans = formulariDe(inc);
    const canvis: Record<string, unknown> = {};
    const files: { camp: string; valor_anterior: string | null; valor_nou: string | null }[] = [];
    const comparar = (camp: keyof Formulari, valor: unknown, text: (v: Formulari[keyof Formulari]) => string | null) => {
      if (abans[camp] !== form[camp]) {
        canvis[camp] = valor;
        files.push({ camp, valor_anterior: text(abans[camp]), valor_nou: text(form[camp]) });
      }
    };
    const t = (v: unknown) => (v === "" || v === null ? null : String(v));
    comparar("estat", form.estat, t);
    comparar("prioritat", form.prioritat, t);
    comparar("categoria", form.categoria || null, t);
    comparar("assignada_a", form.assignada_a || null, (v) => nomPersona((v as string) || null));
    if (abans.cost !== form.cost) {
      const n = form.cost.trim() === "" ? null : Number(form.cost.replace(",", "."));
      if (n !== null && (Number.isNaN(n) || n < 0)) {
        setAvis({ tipus: "error", text: "El cost ha de ser un número (per exemple 12,50)." });
        return;
      }
      canvis.cost = n;
      files.push({ camp: "cost", valor_anterior: t(abans.cost), valor_nou: n === null ? null : String(n) });
    }
    comparar("materials", form.materials.trim() || null, t);
    comparar("observacions", form.observacions.trim() || null, t);
    comparar("cal_repassar", form.cal_repassar, (v) => (v ? "Sí" : "No"));

    if (!files.length) {
      setAvis({ tipus: "ok", text: "No hi ha canvis per desar." });
      return;
    }
    if ("estat" in canvis) {
      const tancada = !ESTATS_OBERTS.includes(form.estat);
      const eraTancada = !ESTATS_OBERTS.includes(inc.estat);
      if (tancada && !eraTancada) canvis.resolta_el = new Date().toISOString();
      if (!tancada && eraTancada) canvis.resolta_el = null;
    }

    setDesant(true);
    const { error } = await supabase.from("incidencies").update(canvis).eq("id", inc.id);
    if (!error) {
      await supabase.from("historial").insert(
        files.map((f) => ({ ...f, incidencia_id: inc.id, persona_id: usuari?.persona_id ?? null })),
      );
    }
    setDesant(false);
    setAvis(error ? { tipus: "error", text: "No s'han pogut desar els canvis. Torna-ho a provar." } : { tipus: "ok", text: "Canvis desats." });
    await carregar();
  }

  if (noTrobada) {
    return (
      <div className="targeta">
        <h1>No s'ha trobat la incidència #{id}</h1>
        <Link to="/incidencies">Tornar a les incidències</Link>
      </div>
    );
  }
  if (!inc || !form) return <p style={{ color: "var(--muted)" }}>Carregant…</p>;

  const visuals: Element[] = missatges.flatMap((m) =>
    m.adjunts.filter((a) => (a.tipus === "foto" || a.tipus === "video") && a.url).map((a) => ({ url: a.url!, tipus: a.tipus as "foto" | "video" })),
  );
  const altresAdjunts = missatges.flatMap((m) => m.adjunts.filter((a) => (a.tipus === "audio" || a.tipus === "altre") && a.url));
  const posar = <K extends keyof Formulari>(k: K, v: Formulari[K]) => setForm({ ...form, [k]: v });

  return (
    <>
      <nav className="molla" aria-label="Ruta"><Link to="/incidencies">Incidències</Link> › #{inc.id}</nav>
      <div className="capcalera">
        <div>
          <h1>#{inc.id} · {lloc(inc)}</h1>
          <span className="sub">
            Creada el {dataHora(inc.creada_el)}
            {inc.resolta_el && ` · Tancada el ${dataHora(inc.resolta_el)}`}
            {inc.reportada_per && nomPersona(inc.reportada_per) && ` · Avisada per ${nomPersona(inc.reportada_per)}`}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`prio ${inc.prioritat}`}>{NOM_PRIORITAT[inc.prioritat]}</span>
          <span className={`estat ${inc.estat}`}>{NOM_ESTAT[inc.estat]}</span>
        </div>
      </div>

      {avis && <p className={`avis ${avis.tipus}`} role={avis.tipus === "error" ? "alert" : "status"}>{avis.text}</p>}

      <div className="fitxa">
        <div className="fitxa-principal">
          <section className="targeta" aria-labelledby="t-desc">
            <h2 id="t-desc">Què passa</h2>
            <p className="descripcio">{inc.descripcio}</p>
            {inc.preventiu_id && <p className="avis info">Generada pel manteniment preventiu.</p>}
          </section>

          {(visuals.length > 0 || altresAdjunts.length > 0) && (
            <section className="targeta" aria-labelledby="t-fotos">
              <h2 id="t-fotos">Fotos i àudios</h2>
              {visuals.length > 0 && (
                <div className="galeria">
                  {visuals.map((v, k) => (
                    <button key={v.url} type="button" className="miniatura" onClick={() => setVisor(k)} aria-label={`Obrir ${v.tipus === "foto" ? "foto" : "vídeo"} ${k + 1} de ${visuals.length}`}>
                      {v.tipus === "foto" ? <img src={v.url} alt="" loading="lazy" /> : <video src={v.url} preload="metadata" muted />}
                      {v.tipus === "video" && <span className="play" aria-hidden="true">▶</span>}
                    </button>
                  ))}
                </div>
              )}
              {altresAdjunts.map((a) =>
                a.tipus === "audio" ? (
                  <audio key={a.id} controls preload="none" src={a.url} style={{ width: "100%" }} />
                ) : (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer">Fitxer adjunt</a>
                ),
              )}
            </section>
          )}

          {missatges.length > 0 && (
            <section className="targeta" aria-labelledby="t-xat">
              <h2 id="t-xat">Missatges del grup</h2>
              <ol className="cronologia">
                {missatges.map((m) => (
                  <li key={m.id}>
                    <span className="quan">{dataHora(m.rebut_el)}{nomPersona(m.autor_id) && ` · ${nomPersona(m.autor_id)}`}</span>
                    {m.text && <p>{m.text}</p>}
                    {m.transcripcio && <p><em>Àudio: </em>{m.transcripcio}</p>}
                    {!m.text && !m.transcripcio && <p style={{ color: "var(--muted)" }}>{m.adjunts.length ? "Foto o fitxer sense text" : "—"}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="targeta" aria-labelledby="t-hist">
            <h2 id="t-hist">Historial de canvis</h2>
            {historial.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>Encara no hi ha cap canvi.</p>
            ) : (
              <ol className="cronologia">
                {historial.map((h) => (
                  <li key={h.id}>
                    <span className="quan">{dataHora(h.canviat_el)}{nomPersona(h.persona_id) && ` · ${nomPersona(h.persona_id)}`}</span>
                    <p>
                      <strong>{NOM_CAMP[h.camp] ?? h.camp}:</strong> {valorLlegible(h.camp, h.valor_anterior)} → {valorLlegible(h.camp, h.valor_nou)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="fitxa-lateral">
          <form className="targeta" onSubmit={desar} aria-labelledby="t-gestio">
            <h2 id="t-gestio">Gestió</h2>
            <label className="camp">Estat
              <select value={form.estat} onChange={(e) => posar("estat", e.target.value as Estat)}>
                {ESTATS.map((x) => <option key={x} value={x}>{NOM_ESTAT[x]}</option>)}
              </select>
            </label>
            <label className="camp">Prioritat
              <select value={form.prioritat} onChange={(e) => posar("prioritat", e.target.value as Prioritat)}>
                {PRIORITATS.map((x) => <option key={x} value={x}>{NOM_PRIORITAT[x]}</option>)}
              </select>
            </label>
            <label className="camp">Categoria
              <select value={form.categoria} onChange={(e) => posar("categoria", e.target.value as Categoria | "")}>
                <option value="">Sense categoria</option>
                {CATEGORIES.map((x) => <option key={x} value={x}>{NOM_CATEGORIA[x]}</option>)}
              </select>
            </label>
            <label className="camp">Assignada a
              <select value={form.assignada_a} onChange={(e) => posar("assignada_a", e.target.value)}>
                <option value="">Ningú</option>
                {persones.filter((p) => p.actiu || p.id === form.assignada_a).map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </label>
            <label className="camp">Cost (€)
              <input inputMode="decimal" value={form.cost} onChange={(e) => posar("cost", e.target.value)} placeholder="0,00" />
            </label>
            <label className="camp">Materials
              <textarea rows={2} value={form.materials} onChange={(e) => posar("materials", e.target.value)} placeholder="Peces o material utilitzat" />
            </label>
            <label className="camp">Observacions
              <textarea rows={3} value={form.observacions} onChange={(e) => posar("observacions", e.target.value)} />
            </label>
            <label className="casella">
              <input type="checkbox" checked={form.cal_repassar} onChange={(e) => posar("cal_repassar", e.target.checked)} />
              Cal repassar-la
            </label>
            <button className="boto" type="submit" disabled={desant}>{desant ? "Desant…" : "Desar canvis"}</button>
          </form>

          {inc.zona_id && (
            <section className="targeta" aria-labelledby="t-altres">
              <h2 id="t-altres">Altres a {lloc(inc)}</h2>
              {altres.length === 0 ? (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>És la primera incidència d'aquest lloc.</p>
              ) : (
                <ul className="llista-altres">
                  {altres.map((a) => (
                    <li key={a.id}>
                      <Link to={`/incidencies/${a.id}`}>#{a.id} {a.descripcio}</Link>
                      <span>{dataCurta(a.creada_el)} · {NOM_ESTAT[a.estat]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </aside>
      </div>
      {visor !== null && <Visor elements={visuals} inici={visor} onTancar={() => setVisor(null)} />}
    </>
  );
}
