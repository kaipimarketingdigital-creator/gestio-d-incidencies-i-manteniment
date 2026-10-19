import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Visor, { type Element } from "../components/Visor";
import EditorMaterials, { MATERIALS_INCIDENCIA, carregarMaterials, desarMaterials, euros, num as numero, totalMaterials, validarMaterials, type Material } from "../components/Materials";
import { useSessio } from "../lib/sessio";
import {
  CATEGORIES, ESTATS, ESTATS_OBERTS, NOM_CAMP, NOM_CATEGORIA, NOM_ESTAT, NOM_PRIORITAT, PRIORITATS,
  dataCurta, dataHora, lloc, valorLlegible,
  type Categoria, type Estat, type Incidencia, type Persona, type Prioritat,
} from "../lib/incidencies";

type Adjunt = { id: number; tipus: "foto" | "audio" | "video" | "altre"; ruta_storage: string | null; url?: string };
type Missatge = { id: number; text: string | null; transcripcio: string | null; rebut_el: string; autor_id: string | null; adjunts: Adjunt[] };
type CanviHistorial = { id: number; camp: string; valor_anterior: string | null; valor_nou: string | null; canviat_el: string; persona_id: string | null; usuari_id: string | null };
type Formulari = {
  estat: Estat; prioritat: Prioritat; categoria: Categoria | ""; assignada_a: string;
  observacions: string; cal_repassar: boolean;
};

function formulariDe(i: Incidencia): Formulari {
  return {
    estat: i.estat, prioritat: i.prioritat, categoria: i.categoria ?? "", assignada_a: i.assignada_a ?? "",
    observacions: i.observacions ?? "",
    cal_repassar: i.cal_repassar,
  };
}

// Text curt per a l'historial: "Filtre G4 ×2; Silicona ×1".
const resumMaterials = (ms: Material[]) =>
  ms.filter((m) => m.nom.trim()).map((m) => `${m.nom.trim()} ×${m.quantitat.trim() || "1"}${m.cost.trim() ? ` (${m.cost.trim()} €)` : ""}`).join("; ");

export default function Fitxa() {
  const { id } = useParams();
  const num = Number(id);
  const { usuari } = useSessio();
  const [inc, setInc] = useState<Incidencia | null>(null);
  const [form, setForm] = useState<Formulari | null>(null);
  const [persones, setPersones] = useState<Persona[]>([]);
  const [nomsUsuaris, setNomsUsuaris] = useState<Map<string, string>>(new Map());
  const [missatges, setMissatges] = useState<Missatge[]>([]);
  const [historial, setHistorial] = useState<CanviHistorial[]>([]);
  const [altres, setAltres] = useState<Incidencia[]>([]);
  const [avis, setAvis] = useState<{ tipus: "ok" | "error"; text: string } | null>(null);
  const [desant, setDesant] = useState(false);
  const [errorCost, setErrorCost] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsAbans, setMaterialsAbans] = useState("");
  const [esborrats, setEsborrats] = useState<number[]>([]);
  const [errorsMat, setErrorsMat] = useState<Record<string, string>>({});
  const [altresCostos, setAltresCostos] = useState("");
  const [desantMat, setDesantMat] = useState(false);
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
    setAltresCostos(i.altres_costos == null ? "" : String(i.altres_costos).replace(".", ","));
    carregarMaterials(MATERIALS_INCIDENCIA, num).then((ms) => { setMaterials(ms); setMaterialsAbans(resumMaterials(ms)); setEsborrats([]); });

    supabase.rpc("noms_usuaris_panell").then(({ data }) => {
      setNomsUsuaris(new Map(((data ?? []) as { id: string; nom: string }[]).map((u) => [u.id, u.nom])));
    });
    const [p, m, h, a] = await Promise.all([
      supabase.from("persones").select("id, nom, actiu").order("nom"),
      supabase.from("missatges").select("id, text, transcripcio, rebut_el, autor_id, adjunts(id, tipus, ruta_storage)").eq("incidencia_id", num).order("rebut_el"),
      supabase.from("historial").select("id, camp, valor_anterior, valor_nou, canviat_el, persona_id, usuari_id").eq("incidencia_id", num).order("canviat_el", { ascending: false }),
      i.zona_id
        ? supabase.from("incidencies").select("*, zones(nom, planta)").eq("zona_id", i.zona_id).neq("id", num).order("creada_el", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] }),
    ]);
    setPersones((p.data ?? []) as Persona[]);
    setHistorial((h.data ?? []) as unknown as CanviHistorial[]);
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
  // Qui ha fet el canvi: un usuari del panell o una persona del grup de Telegram (via bot).
  const autor = (h: CanviHistorial) =>
    (h.usuari_id ? nomsUsuaris.get(h.usuari_id) ?? "Panell" : nomPersona(h.persona_id) ? `${nomPersona(h.persona_id)} (Telegram)` : "Telegram");

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

  async function desarMats() {
    if (!inc) return;
    const e2 = validarMaterials(materials);
    const altres = numero(altresCostos);
    if (altres !== null && (Number.isNaN(altres) || altres < 0)) e2.altres = "Escriu un import, per exemple 45,00.";
    setErrorsMat(e2);
    if (Object.keys(e2).length) {
      setTimeout(() => (document.querySelector('.targeta-materials [aria-invalid="true"]') as HTMLElement | null)?.focus(), 0);
      return;
    }
    setDesantMat(true);
    const files: { camp: string; valor_anterior: string | null; valor_nou: string | null }[] = [];
    let ok = true;
    if ((inc.altres_costos ?? null) !== altres) {
      ok = !(await supabase.from("incidencies").update({ altres_costos: altres }).eq("id", inc.id)).error;
      files.push({ camp: "altres_costos", valor_anterior: inc.altres_costos == null ? null : euros(inc.altres_costos), valor_nou: altres == null ? null : euros(altres) });
    }
    const nous = resumMaterials(materials);
    if (nous !== materialsAbans) {
      ok = (await desarMaterials(MATERIALS_INCIDENCIA, inc.id, materials, esborrats)) && ok;
      files.push({ camp: "materials", valor_anterior: materialsAbans || null, valor_nou: nous || null });
    }
    if (files.length) await supabase.from("historial").insert(files.map((f) => ({ ...f, incidencia_id: inc.id, persona_id: usuari?.persona_id ?? null })));
    setDesantMat(false);
    setAvis(!files.length ? { tipus: "ok", text: "No hi ha canvis per desar." }
      : ok ? { tipus: "ok", text: "Materials i costos desats." } : { tipus: "error", text: "No s'han pogut desar tots els materials. Torna-ho a provar." });
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

          <section className="targeta targeta-materials" aria-labelledby="t-mats">
            <div className="materials-cap">
              <h2 id="t-mats">Materials i costos</h2>
              <span className="xifra">Cost total: <strong>{euros(totalMaterials(materials) + (numero(altresCostos) || 0))}</strong></span>
            </div>
            <EditorMaterials materials={materials} onChange={setMaterials} errors={errorsMat}
              onNetejarError={(k) => { if (errorsMat[k]) { const r = { ...errorsMat }; delete r[k]; setErrorsMat(r); } }}
              onTreure={(m) => { if (m.id) setEsborrats([...esborrats, m.id]); setMaterials(materials.filter((x) => x !== m)); setErrorsMat({}); }} />
            <div className="fila-camps" style={{ alignItems: "flex-end" }}>
              <label className="camp" style={{ maxWidth: 320 }}>Altres costos (mà d'obra, proveïdor…) €
                <input inputMode="decimal" value={altresCostos} placeholder="0,00" aria-invalid={!!errorsMat.altres} aria-describedby="e-altres"
                  onChange={(e) => { setAltresCostos(e.target.value); setErrorCost(""); if (errorsMat.altres) setErrorsMat({}); }} />
                {errorsMat.altres && <span id="e-altres" className="error-camp">{errorsMat.altres}</span>}
              </label>
              <span className="buit" style={{ flex: "1 1 200px" }}>
                Materials {euros(totalMaterials(materials))}{numero(altresCostos) ? ` + altres ${euros(numero(altresCostos)!)}` : ""}
              </span>
              <button type="button" className="boto" disabled={desantMat} onClick={desarMats}>{desantMat ? "Desant…" : "Desar materials i costos"}</button>
            </div>
            {errorCost && <span className="error-camp">{errorCost}</span>}
          </section>

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
                    <span className="quan">{dataHora(h.canviat_el)} · {autor(h)}</span>
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
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <h2 id="t-altres">Altres a {lloc(inc)}</h2>
                <Link to={`/mapa?zona=${inc.zona_id}`} style={{ fontSize: 14 }}>Veure al mapa</Link>
              </div>
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
