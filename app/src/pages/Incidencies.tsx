import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  CATEGORIES, ESTATS, ESTATS_OBERTS, NOM_CATEGORIA, NOM_ESTAT, NOM_PRIORITAT, ORDRE_PRIORITAT, PRIORITATS,
  dataCurta, lloc, type Incidencia,
} from "../lib/incidencies";

// Els filtres viuen a l'adreça (…/incidencies?estat=obertes&prio=urgent): es poden desar o compartir.
export default function Incidencies() {
  const [params, setParams] = useSearchParams();
  const [totes, setTotes] = useState<Incidencia[] | null>(null);
  const [error, setError] = useState("");

  const q = params.get("q") ?? "";
  const estat = params.get("estat") ?? "obertes";
  const prio = params.get("prio") ?? "";
  const cat = params.get("cat") ?? "";
  const ordre = params.get("ordre") ?? "prioritat";

  function posar(clau: string, valor: string) {
    const p = new URLSearchParams(params);
    if (valor) p.set(clau, valor);
    else p.delete(clau);
    setParams(p, { replace: true });
  }

  useEffect(() => {
    supabase
      .from("incidencies")
      .select("*, zones(nom, planta)")
      .order("creada_el", { ascending: false })
      .limit(2000)
      .then(({ data, error }) => {
        if (error) setError("No s'han pogut carregar les incidències.");
        else setTotes((data ?? []) as Incidencia[]);
      });
  }, []);

  const files = useMemo(() => {
    if (!totes) return [];
    const text = q.trim().toLowerCase().replace(/^#/, "");
    const r = totes.filter((i) => {
      if (estat === "obertes" && !ESTATS_OBERTS.includes(i.estat)) return false;
      if (estat === "tancades" && ESTATS_OBERTS.includes(i.estat)) return false;
      if (estat && !["obertes", "tancades", "totes"].includes(estat) && i.estat !== estat) return false;
      if (prio && i.prioritat !== prio) return false;
      if (cat && i.categoria !== cat) return false;
      if (text) {
        const on = `${i.id} ${i.descripcio} ${lloc(i)} ${i.observacions ?? ""} ${i.materials ?? ""}`.toLowerCase();
        if (!on.includes(text)) return false;
      }
      return true;
    });
    if (ordre === "prioritat") {
      r.sort((a, b) => ORDRE_PRIORITAT[a.prioritat] - ORDRE_PRIORITAT[b.prioritat] || b.creada_el.localeCompare(a.creada_el));
    } else if (ordre === "lloc") {
      r.sort((a, b) => lloc(a).localeCompare(lloc(b), "ca", { numeric: true }));
    } // per defecte ja venen de la més nova a la més antiga
    return r;
  }, [totes, q, estat, prio, cat, ordre]);

  const hiHaFiltres = q || estat !== "obertes" || prio || cat;

  return (
    <>
      <div className="capcalera">
        <div>
          <h1>Incidències</h1>
          <span className="sub">
            {totes ? `${files.length} de ${totes.length}` : "Carregant…"}
          </span>
        </div>
      </div>

      <section className="targeta filtres" aria-label="Filtres">
        <label className="camp cerca">Cerca
          <input type="search" value={q} onChange={(e) => posar("q", e.target.value)} placeholder="Habitació, número o paraula (p. ex. 214, aixeta)" />
        </label>
        <label className="camp">Estat
          <select value={estat} onChange={(e) => posar("estat", e.target.value === "obertes" ? "" : e.target.value)}>
            <option value="obertes">Obertes</option>
            <option value="tancades">Tancades</option>
            <option value="totes">Totes</option>
            <optgroup label="Un estat concret">
              {ESTATS.map((e) => <option key={e} value={e}>{NOM_ESTAT[e]}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="camp">Prioritat
          <select value={prio} onChange={(e) => posar("prio", e.target.value)}>
            <option value="">Totes</option>
            {PRIORITATS.map((p) => <option key={p} value={p}>{NOM_PRIORITAT[p]}</option>)}
          </select>
        </label>
        <label className="camp">Categoria
          <select value={cat} onChange={(e) => posar("cat", e.target.value)}>
            <option value="">Totes</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{NOM_CATEGORIA[c]}</option>)}
          </select>
        </label>
        <label className="camp">Ordre
          <select value={ordre} onChange={(e) => posar("ordre", e.target.value === "prioritat" ? "" : e.target.value)}>
            <option value="prioritat">Més urgents primer</option>
            <option value="recents">Més recents primer</option>
            <option value="lloc">Per lloc</option>
          </select>
        </label>
        {hiHaFiltres && (
          <button type="button" className="boto secundari" onClick={() => setParams({}, { replace: true })}>Treure filtres</button>
        )}
      </section>

      {error && <p className="avis error" role="alert">{error}</p>}

      {totes && files.length === 0 && (
        <div className="targeta"><p style={{ margin: 0 }}>Cap incidència compleix aquests filtres.</p></div>
      )}

      {files.length > 0 && (
        <div className="taula-caixa">
          <table className="taula-incidencies">
            <thead>
              <tr><th>#</th><th>Lloc</th><th>Descripció</th><th>Prioritat</th><th>Estat</th><th>Creada</th></tr>
            </thead>
            <tbody>
              {files.map((i) => (
                <tr key={i.id}>
                  <td className="xifra"><Link to={`/incidencies/${i.id}`}>{i.id}</Link></td>
                  <td style={{ whiteSpace: "nowrap" }}>{lloc(i)}</td>
                  <td>
                    <Link to={`/incidencies/${i.id}`} className="enllac-fila">{i.descripcio}</Link>
                    {i.cal_repassar && <span className="etiqueta pendent" style={{ marginLeft: 8 }}>Repassar</span>}
                    {i.preventiu_id && <span className="etiqueta convidat" style={{ marginLeft: 8 }}>Preventiu</span>}
                  </td>
                  <td><span className={`prio ${i.prioritat}`}>{NOM_PRIORITAT[i.prioritat]}</span></td>
                  <td><span className={`estat ${i.estat}`}>{NOM_ESTAT[i.estat]}</span></td>
                  <td className="xifra" style={{ whiteSpace: "nowrap" }}>{dataCurta(i.creada_el)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
