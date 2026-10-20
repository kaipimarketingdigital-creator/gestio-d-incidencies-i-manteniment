import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

// Importació única de l'històric del WhatsApp. Només Direcció.
// Es tria la carpeta del xat exportat (amb importacio-whatsapp.json, que hi ha deixat Kaipi) i es carrega tot.

type Msg = { linia: number; autor: string; data: string; text: string; fitxers: string[] };
type Inc = { clau: string; descripcio: string; zona_text: string | null; estat: string; missatges: Msg[] };
type Recompte = { incidencies: number; importades: number; missatges: number; adjunts: number; historial: number };
type Fila = { clau: string; estat: "pendent" | "fent" | "feta" | "ja" | "error"; detall?: string };

const FUNCIO = "importar-whatsapp";

async function cridar<T>(body: FormData | Record<string, unknown>, reintent = true): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCIO, { body });
  // Si la sessió havia caducat, es renova i es torna a provar una vegada
  // deno-lint-ignore no-explicit-any
  if (error && reintent && [401, 403].includes((error as any).context?.status)) {
    await supabase.auth.refreshSession();
    return cridar<T>(body, false);
  }
  if (error) {
    // deno-lint-ignore no-explicit-any
    const ctx = (error as any).context;
    const msg = ctx?.json ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg ?? error.message);
  }
  return data as T;
}

export default function Importar() {
  const [recompte, setRecompte] = useState<Recompte | null>(null);
  const [incs, setIncs] = useState<Inc[] | null>(null);
  const [fitxers, setFitxers] = useState<Map<string, File>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [confirma, setConfirma] = useState("");
  const [esborrant, setEsborrant] = useState(false);
  const [files, setFiles] = useState<Fila[]>([]);
  const [important, setImportant] = useState(false);
  const atura = useRef(false);

  const refrescar = () => cridar<Recompte>({ accio: "estat" }).then(setRecompte).catch((e) => setError(e.message));
  useEffect(() => { refrescar(); }, []);

  async function triarCarpeta(llista: FileList | null) {
    setError(null);
    if (!llista?.length) return;
    const mapa = new Map<string, File>();
    for (const f of Array.from(llista)) mapa.set(f.name, f);
    const j = mapa.get("importacio-whatsapp.json");
    if (!j) { setError("A la carpeta triada no hi ha el fitxer importacio-whatsapp.json."); return; }
    try {
      const dades = JSON.parse(await j.text());
      setIncs(dades.incidencies as Inc[]);
      setFitxers(mapa);
      setFiles((dades.incidencies as Inc[]).map((i) => ({ clau: i.clau, estat: "pendent" })));
    } catch {
      setError("No s'ha pogut llegir importacio-whatsapp.json.");
    }
  }

  const necessaris = incs ? [...new Set(incs.flatMap((i) => i.missatges.flatMap((m) => m.fitxers)))] : [];
  const falten = necessaris.filter((n) => !fitxers.has(n));

  async function esborrar() {
    setError(null); setEsborrant(true);
    try {
      const r = await cridar<Recompte & { fitxers: number }>({ accio: "buidar", confirmacio: confirma });
      setRecompte(r); setConfirma("");
    } catch (e) {
      setError(`No s'ha pogut esborrar: ${(e as Error).message}`);
    }
    setEsborrant(false);
  }

  async function carregar() {
    if (!incs) return;
    setError(null); setImportant(true); atura.current = false;
    const posar = (clau: string, f: Partial<Fila>) => setFiles((ff) => ff.map((x) => (x.clau === clau ? { ...x, ...f } : x)));
    let idx = 0;
    const treballador = async () => {
      while (!atura.current && idx < incs.length) {
        const inc = incs[idx++];
        const fila = files.find((x) => x.clau === inc.clau);
        if (fila?.estat === "feta" || fila?.estat === "ja") continue;
        posar(inc.clau, { estat: "fent", detall: undefined });
        const form = new FormData();
        form.append("accio", "importar");
        form.append("dades", JSON.stringify(inc));
        for (const m of inc.missatges) for (const n of m.fitxers) { const f = fitxers.get(n); if (f) form.append(n, f, n); }
        let intent = 0;
        for (;;) {
          try {
            const r = await cridar<{ ja?: boolean; pujats?: number; transcrits?: number }>(form);
            posar(inc.clau, { estat: r.ja ? "ja" : "feta", detall: r.ja ? "ja hi era" : `${r.pujats ?? 0} fitxers${r.transcrits ? `, ${r.transcrits} àudios transcrits` : ""}` });
            break;
          } catch (e) {
            if (++intent < 3) { await new Promise((ok) => setTimeout(ok, 2000 * intent)); continue; }
            posar(inc.clau, { estat: "error", detall: (e as Error).message });
            break;
          }
        }
      }
    };
    await Promise.all([treballador(), treballador(), treballador()]);
    setImportant(false);
    refrescar();
  }

  const fetes = files.filter((f) => f.estat === "feta" || f.estat === "ja").length;
  const errors = files.filter((f) => f.estat === "error");

  return (
    <>
      <div className="capcalera">
        <div>
          <h1>Importar l'històric del WhatsApp</h1>
          <span className="sub">Missatges originals, fotos, vídeos i àudios (transcrits). Es pot repetir: el que ja hi és no es duplica.</span>
        </div>
      </div>
      {error && <p className="error-camp" role="alert">{error}</p>}

      <section className="targeta" style={{ marginBottom: 16 }} aria-labelledby="t-ara">
        <h2 id="t-ara">Ara mateix al panell</h2>
        {recompte ? (
          <p>{recompte.incidencies} incidències · {recompte.missatges} missatges · {recompte.adjunts} fitxers
            {recompte.importades > 0 && ` · ${recompte.importades} missatges ja venen del WhatsApp`}</p>
        ) : <p className="buit">Carregant…</p>}
      </section>

      <section className="targeta" style={{ marginBottom: 16 }} aria-labelledby="t-1">
        <h2 id="t-1">1. Tria la carpeta del xat</h2>
        <p>La carpeta «Chat de WhatsApp con Manteniment Hotel 2025» del projecte, amb el fitxer importacio-whatsapp.json a dins.</p>
        {/* @ts-expect-error webkitdirectory no és a la definició estàndard */}
        <input type="file" webkitdirectory="" directory="" multiple onChange={(e) => triarCarpeta(e.target.files)} />
        {incs && (
          <p style={{ marginTop: 12 }}>
            <strong>{incs.length} incidències</strong> · {necessaris.length - falten.length} de {necessaris.length} fitxers trobats
            {falten.length > 0 && <span className="error-camp" style={{ display: "block" }}>Falten: {falten.slice(0, 8).join(", ")}{falten.length > 8 ? "…" : ""} (es carregaran sense aquests fitxers)</span>}
          </p>
        )}
      </section>

      <section className="targeta" style={{ marginBottom: 16 }} aria-labelledby="t-2">
        <h2 id="t-2">2. Esborrar les dades de prova</h2>
        <p>Esborra <strong>totes</strong> les incidències, missatges, fitxers i historial que hi ha ara. No toca les persones, les zones, el preventiu, els usuaris ni els ajustos. No es pot desfer.</p>
        <label htmlFor="confirma">Escriu ESBORRAR per confirmar</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <input id="confirma" value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="off" style={{ maxWidth: 200 }} />
          <button type="button" className="boto secundari" disabled={confirma !== "ESBORRAR" || esborrant || important} onClick={esborrar}>
            {esborrant ? "Esborrant…" : "Esborrar dades de prova"}
          </button>
        </div>
      </section>

      <section className="targeta" style={{ marginBottom: 16 }} aria-labelledby="t-3">
        <h2 id="t-3">3. Carregar l'històric</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="boto" disabled={!incs || important || esborrant} onClick={carregar}>
            {important ? `Carregant… ${fetes} de ${files.length}` : fetes && fetes === files.length ? "Tot carregat" : fetes ? "Continuar" : "Carregar"}
          </button>
          {important && <button type="button" className="boto secundari" onClick={() => { atura.current = true; }}>Aturar</button>}
        </div>
        {files.length > 0 && (
          <>
            <progress max={files.length} value={fetes} style={{ width: "100%", marginTop: 12 }} aria-label="Progrés" />
            <p>{fetes} de {files.length} carregades{errors.length ? ` · ${errors.length} amb error (torna a prémer «Continuar»)` : ""}</p>
            {errors.length > 0 && (
              <ul>{errors.slice(0, 20).map((e) => <li key={e.clau}><strong>{e.clau}</strong>: {e.detall}</li>)}</ul>
            )}
          </>
        )}
        {!important && fetes > 0 && fetes === files.length && (
          <p>Fet! Ja ho pots veure a <Link to="/incidencies">Incidències</Link>.</p>
        )}
      </section>
    </>
  );
}
