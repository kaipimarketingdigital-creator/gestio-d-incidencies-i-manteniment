import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  ESTATS_OBERTS, NOM_CATEGORIA, NOM_ESTAT, NOM_PRIORITAT, PRIORITATS, dataCurta,
  type Categoria, type Estat, type Prioritat,
} from "../lib/incidencies";

type Inc = {
  id: number; zona_id: string | null; zona_text: string | null; categoria: Categoria | null; prioritat: Prioritat; estat: Estat;
  descripcio: string; creada_el: string; resolta_el: string | null; cost: number | null; preventiu_id: string | null;
};
type Zona = { id: string; nom: string; tipus: string };
type Tasca = { id: string; tasca: string; pressupost: number | null; arxivada_el: string | null };
type Periode = "temporada" | "30" | "90" | "any" | "mida";

const avuiISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
function rang(p: Periode, des: string, fins: string): [string, string] {
  const avui = avuiISO();
  const d = new Date(`${avui}T12:00:00Z`);
  if (p === "30" || p === "90") return [new Date(d.getTime() - (Number(p) - 1) * 864e5).toISOString().slice(0, 10), avui];
  if (p === "any") return [`${d.getUTCFullYear()}-01-01`, avui];
  if (p === "mida") return [des || avui, fins || avui];
  const any = d.getUTCMonth() >= 2 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; // la temporada comença l'1 de març
  return [`${any}-03-01`, avui];
}
const diaLocal = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const euros = (n: number) => n.toLocaleString("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: n >= 1000 ? 0 : 2 });
function mediana(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function durada(hores: number | null) {
  if (hores === null) return "—";
  if (hores < 1) return "menys d'1 h";
  if (hores < 48) return `${Math.round(hores)} h`;
  return `${Math.round(hores / 24)} dies`;
}

export default function Informes() {
  const [periode, setPeriode] = useState<Periode>("temporada");
  const [des, setDes] = useState("");
  const [fins, setFins] = useState("");
  const [incs, setIncs] = useState<Inc[] | null>(null);
  const [zones, setZones] = useState<Zona[]>([]);
  const [tasques, setTasques] = useState<Tasca[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("incidencies").select("id, zona_id, zona_text, categoria, prioritat, estat, descripcio, creada_el, resolta_el, cost, preventiu_id")
        .order("creada_el").limit(10000),
      supabase.from("zones").select("id, nom, tipus"),
      supabase.from("manteniment_preventiu").select("id, tasca, pressupost, arxivada_el"),
    ]).then(([i, z, t]) => {
      if (i.error) setError("No s'han pogut carregar les dades.");
      setIncs((i.data ?? []) as Inc[]);
      setZones((z.data ?? []) as Zona[]);
      setTasques((t.data ?? []) as Tasca[]);
    });
  }, []);

  const [inici, final] = rang(periode, des, fins);
  const nomZona = (i: Inc) => zones.find((z) => z.id === i.zona_id)?.nom ?? i.zona_text ?? "Sense lloc";

  const d = useMemo(() => {
    const totes = incs ?? [];
    const creades = totes.filter((i) => { const x = diaLocal(i.creada_el); return x >= inici && x <= final && i.estat !== "anullada"; });
    const resoltes = totes.filter((i) => i.estat === "resolta" && i.resolta_el && diaLocal(i.resolta_el) >= inici && diaLocal(i.resolta_el) <= final);
    const obertesAra = totes.filter((i) => ESTATS_OBERTS.includes(i.estat));
    const hores = (i: Inc) => (Date.parse(i.resolta_el!) - Date.parse(i.creada_el)) / 36e5;
    const cost = resoltes.reduce((s, i) => s + (i.cost ?? 0), 0);

    // Evolució: per setmanes si el període és curt, per mesos si és llarg.
    const dies = (Date.parse(final) - Date.parse(inici)) / 864e5 + 1;
    const perSetmana = dies <= 100;
    const clau = (iso: string) => {
      const x = new Date(`${diaLocal(iso)}T12:00:00Z`);
      if (!perSetmana) return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
      const dl = new Date(x.getTime() - ((x.getUTCDay() + 6) % 7) * 864e5); // dilluns
      return dl.toISOString().slice(0, 10);
    };
    const cubs: string[] = [];
    for (let t = Date.parse(`${inici}T12:00:00Z`); t <= Date.parse(`${final}T12:00:00Z`); t += 864e5) {
      const k = clau(new Date(t).toISOString());
      if (cubs[cubs.length - 1] !== k) cubs.push(k);
    }
    const evolucio = cubs.map((k) => ({
      k,
      etiqueta: perSetmana
        ? new Date(`${k}T12:00:00Z`).toLocaleDateString("ca-ES", { day: "numeric", month: "short" })
        : new Date(`${k}-15T12:00:00Z`).toLocaleDateString("ca-ES", inici.slice(0, 4) === final.slice(0, 4) ? { month: "short" } : { month: "short", year: "2-digit" }),
      n: creades.filter((i) => clau(i.creada_el) === k).length,
    }));

    const perCat = Object.entries(creades.reduce<Record<string, number>>((m, i) => {
      const c = i.categoria ?? "altres"; m[c] = (m[c] ?? 0) + 1; return m;
    }, {})).map(([c, n]) => ({ c: c as Categoria, n })).sort((a, b) => b.n - a.n);

    const perLloc = new Map<string, { nom: string; zona: string | null; n: number; obertes: number; cost: number; cats: Record<string, number> }>();
    creades.forEach((i) => {
      const k = i.zona_id ?? `t:${i.zona_text ?? ""}`;
      const e = perLloc.get(k) ?? { nom: nomZona(i), zona: i.zona_id, n: 0, obertes: 0, cost: 0, cats: {} };
      e.n++;
      if (ESTATS_OBERTS.includes(i.estat)) e.obertes++;
      e.cost += i.cost ?? 0;
      const c = i.categoria ?? "altres";
      e.cats[c] = (e.cats[c] ?? 0) + 1;
      perLloc.set(k, e);
    });
    const llocs = [...perLloc.values()].sort((a, b) => b.n - a.n || b.cost - a.cost).slice(0, 10);

    const perPrio = PRIORITATS.map((p) => {
      const c = creades.filter((i) => i.prioritat === p);
      const r = c.filter((i) => i.estat === "resolta" && i.resolta_el);
      return { p, n: c.length, resoltes: r.length, mediana: mediana(r.map(hores)) };
    });

    const prev = tasques.map((t) => {
      const fetes = resoltes.filter((i) => i.preventiu_id === t.id);
      const gastat = fetes.reduce((s, i) => s + (i.cost ?? 0), 0);
      return { t, fetes: fetes.length, gastat, previst: t.pressupost === null ? null : t.pressupost * fetes.length };
    }).filter((x) => x.fetes > 0 || !x.t.arxivada_el);

    return {
      creades, resoltes, obertesAra, cost, evolucio, perSetmana, perCat, llocs, perPrio, prev,
      medianaTotal: mediana(resoltes.map(hores)),
      urgents: creades.filter((i) => i.prioritat === "urgent" || i.prioritat === "alta").length,
    };
  }, [incs, zones, tasques, inici, final]); // eslint-disable-line react-hooks/exhaustive-deps

  function exportar() {
    const f = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const cap = ["Número", "Lloc", "Descripció", "Categoria", "Prioritat", "Estat", "Creada", "Resolta", "Hores fins resoldre", "Cost (€)", "Preventiu"];
    const files = d.creades.map((i) => [
      i.id, nomZona(i), i.descripcio, i.categoria ? NOM_CATEGORIA[i.categoria] : "", NOM_PRIORITAT[i.prioritat], NOM_ESTAT[i.estat],
      dataCurta(i.creada_el), i.resolta_el ? dataCurta(i.resolta_el) : "",
      i.resolta_el ? String(Math.round((Date.parse(i.resolta_el) - Date.parse(i.creada_el)) / 36e5)) : "",
      i.cost === null ? "" : String(i.cost).replace(".", ","), i.preventiu_id ? "Sí" : "",
    ].map(f).join(";"));
    const blob = new Blob(["﻿" + [cap.map(f).join(";"), ...files].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `incidencies-${inici}-${final}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const maxEvo = Math.max(1, ...d.evolucio.map((x) => x.n));
  const maxCat = Math.max(1, ...d.perCat.map((x) => x.n));
  const idxMax = d.evolucio.findIndex((x) => x.n === maxEvo && maxEvo > 0);

  return (
    <div className="informes">
      <div className="capcalera">
        <div>
          <h1>Informes</h1>
          <span className="sub">Del {dataCurta(`${inici}T12:00:00`)} al {dataCurta(`${final}T12:00:00`)} · les anul·lades no compten</span>
        </div>
        <div className="accions no-imprimir">
          <button type="button" className="boto secundari" onClick={exportar} disabled={!d.creades.length}>Exportar (Excel)</button>
          <button type="button" className="boto secundari" onClick={() => window.print()}>Imprimir o PDF</button>
        </div>
      </div>

      <div className="fila-camps no-imprimir" style={{ alignItems: "end" }}>
        <label className="camp" style={{ maxWidth: 340 }}>Període
          <select value={periode} onChange={(e) => setPeriode(e.target.value as Periode)}>
            <option value="temporada">Aquesta temporada (des de l'1 de març)</option>
            <option value="30">Últims 30 dies</option>
            <option value="90">Últims 90 dies</option>
            <option value="any">Aquest any</option>
            <option value="mida">Unes dates concretes…</option>
          </select>
        </label>
        {periode === "mida" && (
          <>
            <label className="camp" style={{ maxWidth: 200 }}>Des de
              <input type="date" value={des} max={fins || undefined} onChange={(e) => setDes(e.target.value)} />
            </label>
            <label className="camp" style={{ maxWidth: 200 }}>Fins a
              <input type="date" value={fins} min={des || undefined} onChange={(e) => setFins(e.target.value)} />
            </label>
          </>
        )}
      </div>

      {error && <p className="avis error" role="alert">{error}</p>}
      {incs === null ? <p style={{ color: "var(--muted)" }}>Carregant…</p> : (
        <>
          <div className="resum">
            <div className="xifra-gran"><strong className="xifra">{d.creades.length}</strong><span>Incidències noves</span></div>
            <div className="xifra-gran"><strong className="xifra">{d.resoltes.length}</strong><span>Resoltes</span></div>
            <div className="xifra-gran alta"><strong className="xifra">{d.obertesAra.length}</strong><span>Pendents ara</span></div>
            <div className="xifra-gran"><strong className="xifra">{durada(d.medianaTotal)}</strong><span>Temps habitual fins resoldre</span></div>
            <div className="xifra-gran"><strong className="xifra">{euros(d.cost)}</strong><span>Cost apuntat</span></div>
          </div>

          <div className="graella-informes">
            <section className="targeta" aria-labelledby="t-evo">
              <h2 id="t-evo">Incidències noves per {d.perSetmana ? "setmana" : "mes"}</h2>
              <div className="columnes" role="img" aria-label={`Gràfic de columnes: incidències noves per ${d.perSetmana ? "setmana" : "mes"}. El màxim és ${maxEvo}.`}>
                <div className="eix-y" aria-hidden="true"><span>{maxEvo}</span><span>{Math.round(maxEvo / 2)}</span><span>0</span></div>
                <div className="zona-columnes">
                  {d.evolucio.map((x, k) => (
                    <div key={x.k} className="col" tabIndex={0} data-tip={`${d.perSetmana ? "Setmana del " : ""}${x.etiqueta}: ${x.n} ${x.n === 1 ? "incidència" : "incidències"}`}>
                      <div className="barra-col" style={{ height: `${(x.n / maxEvo) * 100}%` }}>
                        {k === idxMax && <span className="valor-cap">{x.n}</span>}
                      </div>
                      <span className="etiqueta-x">{x.etiqueta}</span>
                    </div>
                  ))}
                </div>
              </div>
              <details className="dades">
                <summary>Veure les dades</summary>
                <table><thead><tr><th>{d.perSetmana ? "Setmana" : "Mes"}</th><th>Incidències</th></tr></thead>
                  <tbody>{d.evolucio.map((x) => <tr key={x.k}><td>{x.etiqueta}</td><td className="xifra">{x.n}</td></tr>)}</tbody></table>
              </details>
            </section>

            <section className="targeta" aria-labelledby="t-cat">
              <h2 id="t-cat">Per tipus d'avaria</h2>
              {d.perCat.length === 0 ? <p className="buit">Cap incidència en aquest període.</p> : (
                <ul className="barres">
                  {d.perCat.map((x) => (
                    <li key={x.c} tabIndex={0} data-tip={`${NOM_CATEGORIA[x.c] ?? x.c}: ${x.n} (${Math.round((x.n / d.creades.length) * 100)}%)`}>
                      <span className="nom">{NOM_CATEGORIA[x.c] ?? x.c}</span>
                      <span className="pista"><span className="barra" style={{ width: `${(x.n / maxCat) * 100}%` }} /></span>
                      <span className="valor xifra">{x.n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="targeta" aria-labelledby="t-llocs">
            <h2 id="t-llocs">Llocs amb més incidències</h2>
            {d.llocs.length === 0 ? <p className="buit">Cap incidència en aquest període.</p> : (
              <div className="taula-caixa">
                <table>
                  <thead><tr><th>Lloc</th><th>Incidències</th><th>Obertes ara</th><th>Tipus més freqüent</th><th>Cost</th></tr></thead>
                  <tbody>
                    {d.llocs.map((l) => {
                      const [cat, n] = Object.entries(l.cats).sort((a, b) => b[1] - a[1])[0];
                      return (
                        <tr key={l.nom}>
                          <td><strong>{l.zona ? <Link to={`/mapa?zona=${l.zona}`}>{l.nom}</Link> : l.nom}</strong></td>
                          <td className="xifra">{l.n}{l.n >= 3 && <span className="etiqueta pendent" style={{ marginLeft: 8 }}>Es repeteix</span>}</td>
                          <td className="xifra">{l.obertes || "—"}</td>
                          <td>{NOM_CATEGORIA[cat as Categoria] ?? cat}{n > 1 && ` (${n})`}</td>
                          <td className="xifra">{l.cost ? euros(l.cost) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="graella-informes">
            <section className="targeta" aria-labelledby="t-temps">
              <h2 id="t-temps">Temps fins resoldre, per prioritat</h2>
              <div className="taula-caixa">
                <table>
                  <thead><tr><th>Prioritat</th><th>Noves</th><th>Resoltes</th><th>Temps habitual</th></tr></thead>
                  <tbody>
                    {d.perPrio.map((x) => (
                      <tr key={x.p}>
                        <td><span className={`prio ${x.p}`}>{NOM_PRIORITAT[x.p]}</span></td>
                        <td className="xifra">{x.n}</td>
                        <td className="xifra">{x.n ? `${x.resoltes} (${Math.round((x.resoltes / x.n) * 100)}%)` : "—"}</td>
                        <td className="xifra">{durada(x.mediana)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="buit">«Temps habitual» és la mediana: la meitat es resolen abans i la meitat després.</p>
            </section>

            <section className="targeta" aria-labelledby="t-prev">
              <h2 id="t-prev">Manteniment preventiu</h2>
              {d.prev.length === 0 ? <p className="buit">No hi ha tasques preventives.</p> : (
                <div className="taula-caixa">
                  <table>
                    <thead><tr><th>Tasca</th><th>Fetes</th><th>Gastat</th><th>Pressupost</th></tr></thead>
                    <tbody>
                      {d.prev.map((x) => (
                        <tr key={x.t.id}>
                          <td>{x.t.tasca}</td>
                          <td className="xifra">{x.fetes}</td>
                          <td className="xifra">{x.fetes ? euros(x.gastat) : "—"}</td>
                          <td className="xifra">
                            {x.previst === null || !x.fetes ? "—" : euros(x.previst)}
                            {x.previst !== null && x.fetes > 0 && x.gastat > x.previst && <span className="etiqueta pendent" style={{ marginLeft: 8 }}>Per sobre</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
