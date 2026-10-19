import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import * as ca from "../ajuda/ca";
import * as es from "../ajuda/es";

type Idioma = "ca" | "es";

// Quins apartats del manual corresponen a cada pantalla.
function apartatsDe(ruta: string): string[] {
  if (ruta === "/") return ["avui", "visio"];
  if (ruta.startsWith("/incidencies")) return ["avui", "estats"];
  if (ruta.startsWith("/mapa")) return ["mapa"];
  if (ruta.startsWith("/preventiu")) return ["preventiu", "resum"];
  if (ruta.startsWith("/informes")) return ["informes"];
  if (ruta.startsWith("/configuracio")) return ["configuracio", "entrar"];
  return ["visio"];
}

function idiomaDesat(): Idioma {
  try {
    return localStorage.getItem("ajuda-idioma") === "es" ? "es" : "ca";
  } catch {
    return "ca";
  }
}

// Botó fix a baix a la dreta que obre, en un panell lateral, l'ajuda de la pantalla on ets.
export default function AjudaContextual() {
  const { pathname } = useLocation();
  const [obert, setObert] = useState(false);
  const [idioma, setIdioma] = useState<Idioma>(idiomaDesat);
  const dialeg = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (obert) dialeg.current?.showModal();
    else dialeg.current?.close();
  }, [obert]);
  useEffect(() => { setObert(false); }, [pathname]);

  if (pathname.startsWith("/ajuda")) return null;
  const m = idioma === "es" ? es : ca;
  const ids = apartatsDe(pathname);
  const apartats = ids.map((id) => m.apartats.find((a) => a.id === id)).filter((a) => !!a);
  const t = idioma === "es"
    ? { boto: "Ayuda", titol: "Ayuda de esta pantalla", tot: "Abrir el manual completo" }
    : { boto: "Ajuda", titol: "Ajuda d'aquesta pantalla", tot: "Obrir el manual complet" };

  function canviar(nou: Idioma) {
    setIdioma(nou);
    try { localStorage.setItem("ajuda-idioma", nou); } catch { /* no passa res */ }
  }

  return (
    <>
      <button type="button" className="boto-ajuda no-imprimir" onClick={() => setObert(true)} aria-haspopup="dialog">
        <span aria-hidden="true">?</span> {t.boto}
      </button>
      <dialog ref={dialeg} className="panell-lateral" onClose={() => setObert(false)} aria-labelledby="t-ajuda-ctx"
        onClick={(e) => { if (e.target === e.currentTarget) setObert(false); }}>
        {obert && (
          <div className="panell-cos" lang={idioma}>
            <div className="panell-capcalera">
              <h2 id="t-ajuda-ctx">{t.titol}</h2>
              <button type="button" className="tancar" onClick={() => setObert(false)} aria-label="Tancar">✕</button>
            </div>
            <div className="idiomes" role="group" aria-label="Idioma" style={{ alignSelf: "flex-start" }}>
              <button type="button" aria-pressed={idioma === "ca"} onClick={() => canviar("ca")}>Català</button>
              <button type="button" aria-pressed={idioma === "es"} onClick={() => canviar("es")}>Castellano</button>
            </div>
            {apartats.map((a) => (
              <section key={a!.id} className="targeta apartat-ajuda" aria-label={a!.titol}>
                <h2>{a!.titol.replace(/^\d+\.\s*/, "")}</h2>
                {a!.cos}
              </section>
            ))}
            <p style={{ margin: "0 0 24px" }}>
              <Link to={`/ajuda?idioma=${idioma}&apartat=${ids[0]}`} onClick={() => setObert(false)}>{t.tot} →</Link>
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
