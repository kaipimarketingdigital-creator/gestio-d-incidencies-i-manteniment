import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Visor, { type Element } from "../components/Visor";
import {
  ESTATS_OBERTS, NOM_CATEGORIA, NOM_ESTAT, NOM_PRIORITAT, ORDRE_PRIORITAT, dataCurta,
  type Categoria, type Estat, type Prioritat,
} from "../lib/incidencies";

type ZonaMapa = { id: string; nom: string; tipus: "habitacio" | "comuna" | "tecnica" | string; planta: number | null };
type Inc = {
  id: number; zona_id: string | null; descripcio: string; prioritat: Prioritat; estat: Estat;
  categoria: Categoria | null; creada_el: string; resolta_el: string | null; cost: number | null; preventiu_id: string | null;
};
type Periode = "temporada" | "12mesos" | "tot";

// La temporada de l'hotel comença l'1 de març.
function iniciPeriode(p: Periode): string | null {
  const ara = new Date();
  if (p === "tot") return null;
  if (p === "12mesos") return new Date(ara.getFullYear() - 1, ara.getMonth(), ara.getDate()).toISOString();
  const any = ara.getMonth() >= 2 ? ara.getFullYear() : ara.getFullYear() - 1;
  return new Date(any, 2, 1).toISOString();
}
const NOM_PERIODE: Record<Periode, string> = { temporada: "Aquesta temporada", "12mesos": "Últims 12 mesos", tot: "Tot l'historial" };

type Nivell = "urgent" | "pendent" | "net";
function nivell(obertes: Inc[]): Nivell {
  if (!obertes.length) return "net";
  return obertes.some((i) => i.prioritat === "urgent" || i.prioritat === "alta") ? "urgent" : "pendent";
}
const ordreNum = (a: ZonaMapa, b: ZonaMapa) => a.nom.localeCompare(b.nom, "ca", { numeric: true });

export default function Mapa() {
  const [params, setParams] = useSearchParams();
  const sel = params.get("zona");
  const periode = (params.get("periode") as Periode) || "temporada";
  const [zones, setZones] = useState<ZonaMapa[]>([]);
  const [incs, setIncs] = useState<Inc[] | null>(null);
  const [error, setError] = useState("");

  function posar(clau: string, valor: string | null) {
    const p = new URLSearchParams(params);
    if (valor) p.set(clau, valor);
    else p.delete(clau);
    setParams(p, { replace: true });
  }

  useEffect(() => {
    Promise.all([
      supabase.from("zones").select("id, nom, tipus, planta").eq("activa", true),
      supabase.from("incidencies").select("id, zona_id, descripcio, prioritat, estat, categoria, creada_el, resolta_el, cost, preventiu_id")
        .order("creada_el", { ascending: false }).limit(5000),
    ]).then(([z, i]) => {
      if (z.error || i.error) setError("No s'ha pogut carregar el mapa.");
      setZones((z.data ?? []) as ZonaMapa[]);
      setIncs((i.data ?? []) as Inc[]);
    });
  }, []);

  const desde = iniciPeriode(periode);
  const perZona = useMemo(() => {
    const m = new Map<string, { obertes: Inc[]; periode: Inc[] }>();
    (incs ?? []).forEach((i) => {
      if (!i.zona_id) return;
      const e = m.get(i.zona_id) ?? { obertes: [], periode: [] };
      if (ESTATS_OBERTS.includes(i.estat)) e.obertes.push(i);
      if (i.estat !== "anullada" && (!desde || i.creada_el >= desde)) e.periode.push(i);
      m.set(i.zona_id, e);
    });
    return m;
  }, [incs, desde]);

  const plantes = useMemo(() => {
    const hab = zones.filter((z) => z.tipus === "habitacio" && z.planta !== null);
    const nums = [...new Set(hab.map((z) => z.planta!))].sort((a, b) => a - b);
    // Cada planta en files: el passadís principal (x01–x19) i l'ala (x21 en endavant).
    const fila = (z: ZonaMapa) => (Number(z.nom) % 100 >= 20 ? 1 : 0);
    return nums.map((n) => {
      const zs = hab.filter((z) => z.planta === n).sort(ordreNum);
      return { nom: n === 0 ? "Planta baixa" : `Planta ${n}`, files: [0, 1].map((f) => zs.filter((z) => fila(z) === f)).filter((f) => f.length) };
    });
  }, [zones]);
  const altres = useMemo(() => zones.filter((z) => !(z.tipus === "habitacio" && z.planta !== null)).sort((a, b) =>
    (a.tipus === "habitacio" ? 0 : a.tipus === "comuna" ? 1 : 2) - (b.tipus === "habitacio" ? 0 : b.tipus === "comuna" ? 1 : 2) || ordreNum(a, b)), [zones]);

  const totalObertes = (incs ?? []).filter((i) => ESTATS_OBERTS.includes(i.estat)).length;
  const senseLloc = (incs ?? []).filter((i) => !i.zona_id && ESTATS_OBERTS.includes(i.estat)).length;
  const zonaSel = zones.find((z) => z.id === sel) ?? null;

  const Casella = ({ z, xip }: { z: ZonaMapa; xip?: boolean }) => {
    const d = perZona.get(z.id);
    const nv = nivell(d?.obertes ?? []);
    const n = d?.periode.length ?? 0;
    const desc = `${z.nom}: ${d?.obertes.length ? `${d.obertes.length} oberta${d.obertes.length > 1 ? "es" : ""}` : "sense incidències obertes"}${n ? `, ${n} en el període` : ""}`;
    return (
      <button type="button" className={`${xip ? "xip-zona" : "cela"} ${nv}${sel === z.id ? " seleccionada" : ""}`}
        onClick={() => posar("zona", sel === z.id ? null : z.id)} aria-pressed={sel === z.id} aria-label={desc} title={desc}>
        <span className="nom">{z.nom}</span>
        {n > 0 && <span className="compte">{n}×</span>}
      </button>
    );
  };

  return (
    <>
      <div className="capcalera">
        <div>
          <h1>Mapa de l'hotel</h1>
          <span className="sub">Toca una habitació o zona per veure'n l'historial complet</span>
        </div>
        <label className="camp" style={{ minWidth: 200 }}>Comptar incidències de
          <select value={periode} onChange={(e) => posar("periode", e.target.value === "temporada" ? null : e.target.value)}>
            {(Object.keys(NOM_PERIODE) as Periode[]).map((p) => <option key={p} value={p}>{NOM_PERIODE[p]}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="avis error" role="alert">{error}</p>}

      <div className="llegenda" aria-label="Llegenda">
        <span><i className="mostra urgent" /> Urgent o alta</span>
        <span><i className="mostra pendent" /> Pendent</span>
        <span><i className="mostra net" /> Sense incidències obertes</span>
        <span><b>3×</b> Incidències en el període</span>
        <span className="sub">{totalObertes} obertes en total{senseLloc > 0 && <> · <Link to="/incidencies">{senseLloc} sense lloc reconegut</Link></>}</span>
      </div>

      <div className="mapa">
        <div className="mapa-plantes">
          {incs === null && <p style={{ color: "var(--muted)" }}>Carregant…</p>}
          {plantes.map((p) => (
            <section key={p.nom} className="targeta" aria-label={p.nom}>
              <h2>{p.nom}</h2>
              {p.files.map((f, k) => <div key={k} className="graella">{f.map((z) => <Casella key={z.id} z={z} />)}</div>)}
            </section>
          ))}
          {altres.length > 0 && (
            <section className="targeta" aria-label="Zones comunes i tècniques">
              <h2>Zones comunes i tècniques</h2>
              <div className="xips">{altres.map((z) => <Casella key={z.id} z={z} xip />)}</div>
            </section>
          )}
        </div>

        {zonaSel && (
          <DetallZona key={zonaSel.id} zona={zonaSel} incs={(incs ?? []).filter((i) => i.zona_id === zonaSel.id)} desde={desde}
            nomPeriode={NOM_PERIODE[periode].toLowerCase()} onTancar={() => posar("zona", null)} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- historial d'una zona

function DetallZona({ zona, incs, desde, nomPeriode, onTancar }: {
  zona: ZonaMapa; incs: Inc[]; desde: string | null; nomPeriode: string; onTancar: () => void;
}) {
  const [fotos, setFotos] = useState<Element[]>([]);
  const [visor, setVisor] = useState<number | null>(null);
  const caixa = useRef<HTMLElement>(null);
  // Al mòbil el detall queda sota el mapa: hi baixem en seleccionar.
  useEffect(() => {
    if (window.matchMedia("(max-width: 900px)").matches) caixa.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const obertes = incs.filter((i) => ESTATS_OBERTS.includes(i.estat))
    .sort((a, b) => ORDRE_PRIORITAT[a.prioritat] - ORDRE_PRIORITAT[b.prioritat]);
  const tancades = incs.filter((i) => !ESTATS_OBERTS.includes(i.estat));
  const enPeriode = incs.filter((i) => i.estat !== "anullada" && (!desde || i.creada_el >= desde));
  const cost = enPeriode.reduce((s, i) => s + (i.cost ?? 0), 0);
  const perCategoria = Object.entries(enPeriode.reduce<Record<string, number>>((m, i) => {
    const c = i.categoria ?? "altres";
    m[c] = (m[c] ?? 0) + 1;
    return m;
  }, {})).sort((a, b) => b[1] - a[1]);

  // Les darreres fotos de la zona (enllaços temporals d'1 hora).
  useEffect(() => {
    const ids = incs.slice(0, 30).map((i) => i.id);
    if (!ids.length) return;
    supabase.from("missatges").select("rebut_el, adjunts(tipus, ruta_storage)").in("incidencia_id", ids)
      .order("rebut_el", { ascending: false }).limit(40)
      .then(async ({ data }) => {
        const rutes = (data ?? []).flatMap((m) => (m.adjunts as { tipus: string; ruta_storage: string | null }[])
          .filter((a) => a.tipus === "foto" && a.ruta_storage).map((a) => a.ruta_storage!)).slice(0, 12);
        if (!rutes.length) return;
        const { data: s } = await supabase.storage.from("adjunts").createSignedUrls(rutes, 3600);
        setFotos((s ?? []).filter((x) => x.signedUrl).map((x) => ({ url: x.signedUrl as string, tipus: "foto" as const })));
      });
  }, [incs]);

  function exportar() {
    const fila = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const cap = ["Número", "Creada", "Tancada", "Estat", "Prioritat", "Categoria", "Descripció", "Cost (€)", "Preventiu"];
    const linies = incs.map((i) => [
      i.id, dataCurta(i.creada_el), i.resolta_el ? dataCurta(i.resolta_el) : "", NOM_ESTAT[i.estat], NOM_PRIORITAT[i.prioritat],
      i.categoria ? NOM_CATEGORIA[i.categoria] : "", i.descripcio, i.cost === null ? "" : String(i.cost).replace(".", ","), i.preventiu_id ? "Sí" : "",
    ].map(fila).join(";"));
    // Punt i coma i BOM perquè l'Excel en català/castellà l'obri bé amb accents.
    const blob = new Blob(["﻿" + [cap.map(fila).join(";"), ...linies].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `historial-${zona.nom.replace(/[^\w-]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const esHab = zona.tipus === "habitacio";
  return (
    <aside ref={caixa} className="targeta detall-zona" aria-labelledby="t-zona">
      <div className="panell-capcalera">
        <div>
          <span className="sota">{esHab ? "Habitació" : zona.tipus === "comuna" ? "Zona comuna" : "Zona tècnica"}</span>
          <h2 id="t-zona" className="nom-zona">{zona.nom}</h2>
        </div>
        <button type="button" className="tancar" onClick={onTancar} aria-label="Tancar">✕</button>
      </div>

      <p className="resum-zona">
        {enPeriode.length === 0 ? `Sense incidències (${nomPeriode}).` : <>
          <strong>{enPeriode.length}</strong> {enPeriode.length === 1 ? "incidència" : "incidències"} ({nomPeriode})
          {perCategoria.length > 0 && <> · {perCategoria.slice(0, 3).map(([c, n]) => `${NOM_CATEGORIA[c as Categoria] ?? c} ${n}`).join(", ")}</>}
          {cost > 0 && <> · {cost.toLocaleString("ca-ES", { style: "currency", currency: "EUR" })}</>}
        </>}
      </p>

      {fotos.length > 0 && (
        <div className="galeria petita">
          {fotos.map((f, k) => (
            <button key={f.url} type="button" className="miniatura" onClick={() => setVisor(k)} aria-label={`Obrir foto ${k + 1} de ${fotos.length}`}>
              <img src={f.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {obertes.length > 0 && (
        <>
          <h3 className="subtitol">Obertes ara</h3>
          <ul className="llista-zona">
            {obertes.map((i) => (
              <li key={i.id} className={`vora-${i.prioritat}`}>
                <Link to={`/incidencies/${i.id}`}>#{i.id} {i.descripcio}</Link>
                <span>{NOM_PRIORITAT[i.prioritat]} · {NOM_ESTAT[i.estat]} · des del {dataCurta(i.creada_el)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {tancades.length > 0 && (
        <>
          <h3 className="subtitol">Historial</h3>
          <ul className="llista-zona">
            {tancades.map((i) => (
              <li key={i.id} className="vora-tancada">
                <Link to={`/incidencies/${i.id}`}>#{i.id} {i.descripcio}</Link>
                <span>{dataCurta(i.creada_el)} · {NOM_ESTAT[i.estat]}{i.cost ? ` · ${i.cost.toLocaleString("ca-ES", { style: "currency", currency: "EUR" })}` : ""}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {incs.length > 0 && (
        <button type="button" className="boto secundari" onClick={exportar}>Exportar l'historial (Excel)</button>
      )}
      {visor !== null && <Visor elements={fotos} inici={visor} onTancar={() => setVisor(null)} />}
    </aside>
  );
}
