import { useSessio } from "../lib/sessio";
import logo from "../assets/logo-rull-blanc.png";

// Per a qui ha entrat però encara no té accés (pendent d'aprovació o desactivat).
export default function SenseAcces() {
  const { sessio, usuari, sortir, recarregar } = useSessio();
  const desactivat = usuari?.estat === "desactivat";
  return (
    <div className="entrada">
      <header className="entrada-banda">
        <img src={logo} alt="Hotel Rull" />
        <span>Manteniment</span>
      </header>
      <div className="franja" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
      <main className="entrada-cos">
        <div className="targeta">
          <h1>{desactivat ? "Accés desactivat" : "Pendent d'aprovació"}</h1>
          <p style={{ margin: 0 }}>
            {desactivat
              ? "El teu accés al panell s'ha desactivat. Si creus que és un error, parla amb Direcció."
              : <>Has entrat com a <strong>{sessio?.user.email}</strong>. Direcció ha d'aprovar el teu accés; quan ho faci, torna a aquesta pàgina.</>}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!desactivat && <button type="button" className="boto" onClick={() => recarregar()}>Ja m'han aprovat</button>}
            <button type="button" className="boto secundari" onClick={() => sortir()}>Sortir</button>
          </div>
        </div>
      </main>
    </div>
  );
}
