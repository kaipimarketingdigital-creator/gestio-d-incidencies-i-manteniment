import { useState, type FormEvent } from "react";
import { supabase, NOM_ROL } from "../lib/supabase";
import { useSessio } from "../lib/sessio";
import { dataHora } from "../lib/incidencies";

const QUE_POT_FER: Record<string, string> = {
  direccio: "Veus i configures tot el panell: incidències, mapa, preventiu, informes i configuració.",
  administracio: "Veus i gestiones les incidències, el mapa, el preventiu i els informes.",
  manteniment: "Veus i actualitzes les incidències i el mapa, i consultes el preventiu.",
};

// Les dades de qui ha entrat. El nom el pot canviar cadascú; la resta, Direcció.
export default function Perfil() {
  const { usuari, sessio, sortir, recarregar } = useSessio();
  const [nom, setNom] = useState(usuari?.nom ?? "");
  const [avis, setAvis] = useState<{ tipus: "ok" | "error"; text: string } | null>(null);
  const [desant, setDesant] = useState(false);
  if (!usuari) return null;

  async function desar(e: FormEvent) {
    e.preventDefault();
    setDesant(true);
    const { error } = await supabase.rpc("canviar_el_meu_nom", { nou: nom });
    setDesant(false);
    setAvis(error ? { tipus: "error", text: "No s'ha pogut desar el nom." } : { tipus: "ok", text: "Nom desat." });
    if (!error) await recarregar();
  }

  return (
    <>
      <div className="capcalera">
        <div>
          <h1>El meu perfil</h1>
          <span className="sub">Les teves dades al panell de manteniment</span>
        </div>
      </div>
      <form className="targeta" onSubmit={desar} style={{ maxWidth: 640 }}>
        <label className="camp">Nom
          <input value={nom} onChange={(e) => { setNom(e.target.value); setAvis(null); }} placeholder="Com vols que et vegin els altres" />
        </label>
        <dl className="dades-perfil">
          <dt>Correu</dt><dd>{usuari.email}</dd>
          <dt>Rol</dt><dd>{usuari.rol ? NOM_ROL[usuari.rol] : "—"}{usuari.rol && <span className="sota">{QUE_POT_FER[usuari.rol]}</span>}</dd>
          <dt>Darrer accés</dt><dd>{dataHora(usuari.darrer_acces ?? sessio?.user.last_sign_in_at ?? null)}</dd>
        </dl>
        <p className="buit">Per canviar el correu o el rol, parla amb Direcció. La sessió es tanca sola després de 12 hores sense fer servir el panell.</p>
        {avis && <p className={`avis ${avis.tipus}`} role={avis.tipus === "error" ? "alert" : "status"}>{avis.text}</p>}
        <div className="accions">
          <button className="boto" type="submit" disabled={desant || nom.trim() === (usuari.nom ?? "")}>{desant ? "Desant…" : "Desar"}</button>
          <button className="boto secundari" type="button" onClick={() => sortir()}>Sortir del panell</button>
        </div>
      </form>
    </>
  );
}
