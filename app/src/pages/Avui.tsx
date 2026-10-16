import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSessio } from "../lib/sessio";

type Fila = {
  id: number;
  descripcio: string;
  prioritat: "baixa" | "mitjana" | "alta" | "urgent";
  estat: string;
  creada_el: string;
  zona_text: string | null;
  zones: { nom: string } | null;
};

const OBERTES = ["oberta", "en_curs", "esperant_material", "proveidor_extern"];
const NOM_ESTAT: Record<string, string> = {
  oberta: "Oberta",
  en_curs: "En curs",
  esperant_material: "Esperant material",
  proveidor_extern: "Proveïdor extern",
};
const ORDRE = { urgent: 0, alta: 1, mitjana: 2, baixa: 3 } as const;

// Primera versió de «Avui»: què hi ha obert ara mateix, de més a menys urgent.
export default function Avui() {
  const { usuari } = useSessio();
  const [files, setFiles] = useState<Fila[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("incidencies")
      .select("id, descripcio, prioritat, estat, creada_el, zona_text, zones(nom)")
      .in("estat", OBERTES)
      .order("creada_el", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) setError("No s'han pogut carregar les incidències.");
        else setFiles(((data ?? []) as unknown as Fila[]).sort((a, b) => ORDRE[a.prioritat] - ORDRE[b.prioritat]));
      });
  }, []);

  const compte = (p: Fila["prioritat"]) => files?.filter((f) => f.prioritat === p).length ?? 0;
  const avui = new Date().toLocaleDateString("ca-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <div className="capcalera">
        <div>
          <h1>Bon dia{usuari?.nom ? `, ${usuari.nom}` : ""}</h1>
          <span className="sub">{avui.charAt(0).toUpperCase() + avui.slice(1)}</span>
        </div>
      </div>
      {error && <p className="avis error" role="alert">{error}</p>}
      <div className="resum">
        <div className="xifra-gran"><strong className="xifra">{files?.length ?? "–"}</strong><span>Obertes</span></div>
        <div className="xifra-gran urgent"><strong className="xifra">{compte("urgent")}</strong><span>Urgents</span></div>
        <div className="xifra-gran alta"><strong className="xifra">{compte("alta")}</strong><span>Alta</span></div>
        <div className="xifra-gran"><strong className="xifra">{compte("mitjana") + compte("baixa")}</strong><span>Mitjana i baixa</span></div>
      </div>
      <section className="targeta" aria-labelledby="t-obertes">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><h2 id="t-obertes">Incidències obertes</h2><Link to="/incidencies">Veure totes i filtrar</Link></div>
        {files === null && !error && <p style={{ margin: 0, color: "var(--muted)" }}>Carregant…</p>}
        {files?.length === 0 && <p style={{ margin: 0 }}>No hi ha cap incidència oberta.</p>}
        {files && files.length > 0 && (
          <div className="taula-caixa">
            <table>
              <thead><tr><th>#</th><th>Lloc</th><th>Descripció</th><th>Prioritat</th><th>Estat</th><th>Data</th></tr></thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td className="xifra"><Link to={`/incidencies/${f.id}`}>{f.id}</Link></td>
                    <td>{f.zones?.nom ?? f.zona_text ?? "—"}</td>
                    <td><Link to={`/incidencies/${f.id}`} className="enllac-fila">{f.descripcio}</Link></td>
                    <td><span className={`prio ${f.prioritat}`}>{f.prioritat}</span></td>
                    <td>{NOM_ESTAT[f.estat] ?? f.estat}</td>
                    <td className="xifra" style={{ whiteSpace: "nowrap" }}>{new Date(f.creada_el).toLocaleDateString("ca-ES", { day: "2-digit", month: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
