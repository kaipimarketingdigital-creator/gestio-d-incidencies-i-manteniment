import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import * as ca from "../ajuda/ca";
import * as es from "../ajuda/es";

type Idioma = "ca" | "es";
const MANUALS = { ca, es } as const;

function idiomaDesat(): Idioma | null {
  try {
    const v = localStorage.getItem("ajuda-idioma");
    return v === "ca" || v === "es" ? v : null;
  } catch {
    return null;
  }
}

// Manual d'ús. Es pot obrir sense sessió (ajuda per a l'equip de Telegram): …/#/ajuda?idioma=es
export default function Ajuda({ publica = false }: { publica?: boolean }) {
  const [params, setParams] = useSearchParams();
  const idioma: Idioma = (params.get("idioma") as Idioma) || idiomaDesat() || "ca";
  const m = MANUALS[idioma] ?? ca;
  const apartat = params.get("apartat");

  function canviar(nou: Idioma) {
    try { localStorage.setItem("ajuda-idioma", nou); } catch { /* sense emmagatzematge: no passa res */ }
    const p = new URLSearchParams(params);
    p.set("idioma", nou);
    setParams(p, { replace: true });
  }
  function anar(id: string) {
    document.getElementById(`ajuda-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    const p = new URLSearchParams(params);
    p.set("apartat", id);
    setParams(p, { replace: true });
  }
  useEffect(() => {
    if (apartat) document.getElementById(`ajuda-${apartat}`)?.scrollIntoView({ block: "start" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const t = idioma === "es"
    ? { index: "Índice", imprimir: "Imprimir o PDF", enllac: "Copiar enlace", copiat: "Enlace copiado" }
    : { index: "Índex", imprimir: "Imprimir o PDF", enllac: "Copiar l'enllaç", copiat: "Enllaç copiat" };

  return (
    <div className={`ajuda ${publica ? "publica" : ""}`} lang={idioma}>
      <div className="capcalera">
        <div>
          <h1>{m.titol}</h1>
          <span className="sub">{m.subtitol}</span>
        </div>
        <div className="accions no-imprimir">
          <div className="idiomes" role="group" aria-label="Idioma / Language">
            <button type="button" aria-pressed={idioma === "ca"} onClick={() => canviar("ca")}>Català</button>
            <button type="button" aria-pressed={idioma === "es"} onClick={() => canviar("es")}>Castellano</button>
          </div>
          <button type="button" className="boto secundari" onClick={(e) => {
            const url = `${window.location.origin}${window.location.pathname}#/ajuda?idioma=${idioma}`;
            const boto = e.currentTarget;
            navigator.clipboard?.writeText(url).then(() => { boto.textContent = t.copiat; setTimeout(() => { boto.textContent = t.enllac; }, 2000); });
          }}>{t.enllac}</button>
          <button type="button" className="boto secundari" onClick={() => window.print()}>{t.imprimir}</button>
        </div>
      </div>

      <div className="ajuda-cos">
        <nav className="ajuda-index no-imprimir" aria-label={t.index}>
          <h2>{t.index}</h2>
          <ol>
            {m.apartats.map((a) => (
              <li key={a.id}>
                <button type="button" className={apartat === a.id ? "actiu" : undefined} onClick={() => anar(a.id)}>
                  {a.titol.replace(/^\d+\.\s*/, "")}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="ajuda-text">
          {m.apartats.map((a) => (
            <section key={a.id} id={`ajuda-${a.id}`} className="targeta apartat-ajuda" aria-labelledby={`t-ajuda-${a.id}`}>
              <h2 id={`t-ajuda-${a.id}`}>{a.titol}</h2>
              {a.cos}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
