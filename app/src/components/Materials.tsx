import { supabase } from "../lib/supabase";

// Llista de materials (nom, quantitat, unitat, cost per unitat) compartida entre incidències i preventiu.

export type Material = { id?: number; nom: string; quantitat: string; unitat: string; cost: string };

export const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
export const euros = (n: number) => n.toLocaleString("ca-ES", { style: "currency", currency: "EUR" });
const text = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

export const totalMaterials = (ms: Material[]) =>
  ms.reduce((s, m) => s + (num(m.cost) ?? 0) * (num(m.quantitat) ?? 1), 0);

const buida = (m: Material) => !m.nom.trim() && !m.cost.trim() && !m.unitat.trim() && (!m.quantitat.trim() || m.quantitat.trim() === "1");

// Errors per camp: "mat-<fila>-nom|quantitat|cost". Les files buides es descarten sense avisar.
export function validarMaterials(ms: Material[]): Record<string, string> {
  const e: Record<string, string> = {};
  ms.forEach((m, k) => {
    if (buida(m)) return;
    if (!m.nom.trim()) e[`mat-${k}-nom`] = "Falta el nom del material (o treu la fila amb ✕).";
    const q = num(m.quantitat), c = num(m.cost);
    if (q === null || Number.isNaN(q) || q <= 0) e[`mat-${k}-quantitat`] = "La quantitat ha de ser més gran que 0.";
    if (c !== null && (Number.isNaN(c) || c < 0)) e[`mat-${k}-cost`] = "El cost ha de ser un import, per exemple 12,50.";
  });
  return e;
}

type Taula = { taula: "incidencia_materials" | "preventiu_materials"; clau: "incidencia_id" | "preventiu_id"; camp: "cost_unitari" | "cost_estimat" };
export const MATERIALS_INCIDENCIA: Taula = { taula: "incidencia_materials", clau: "incidencia_id", camp: "cost_unitari" };
export const MATERIALS_PREVENTIU: Taula = { taula: "preventiu_materials", clau: "preventiu_id", camp: "cost_estimat" };

export async function carregarMaterials(t: Taula, id: string | number, copia = false): Promise<Material[]> {
  const { data } = await supabase.from(t.taula).select("*").eq(t.clau, id).order("id");
  return (data ?? []).map((m: Record<string, unknown>) => ({
    id: copia ? undefined : (m.id as number), nom: m.nom as string, quantitat: text(m.quantitat as number),
    unitat: (m.unitat as string) ?? "", cost: text(m[t.camp] as number | null),
  }));
}

export async function desarMaterials(t: Taula, id: string | number, ms: Material[], esborrats: number[]): Promise<boolean> {
  let ok = true;
  if (esborrats.length) ok = !(await supabase.from(t.taula).delete().in("id", esborrats)).error && ok;
  for (const m of ms.filter((x) => x.nom.trim())) {
    const dades = { [t.clau]: id, nom: m.nom.trim(), quantitat: num(m.quantitat) ?? 1, unitat: m.unitat.trim() || null, [t.camp]: num(m.cost) };
    const r = m.id ? await supabase.from(t.taula).update(dades).eq("id", m.id) : await supabase.from(t.taula).insert(dades);
    ok = !r.error && ok;
  }
  return ok;
}

export default function EditorMaterials({ materials, onChange, onTreure, errors, onNetejarError, nomesLectura = false }: {
  materials: Material[];
  onChange: (ms: Material[]) => void;
  onTreure: (m: Material) => void;
  errors: Record<string, string>;
  onNetejarError: (clau: string) => void;
  nomesLectura?: boolean;
}) {
  const err = (k: string) => errors[k];
  const posar = (k: number, camp: keyof Material, v: string) => {
    onChange(materials.map((x, j) => (j === k ? { ...x, [camp]: v } : x)));
    onNetejarError(`mat-${k}-${camp === "cost" ? "cost" : camp}`);
  };
  return (
    <>
      {materials.length === 0 && <p className="buit">Cap material.</p>}
      {materials.length > 0 && (
        <div className="material capcal-materials" aria-hidden="true">
          <span>Material</span><span className="curt">Quantitat</span><span className="curt">Unitat</span><span className="curt">€ / unitat</span>
          {!nomesLectura && <span className="treure-espai" />}
        </div>
      )}
      {materials.map((m, k) => (
        <div key={m.id ?? `n${k}`} className="material-fila">
          <div className="material">
            <input aria-label="Nom del material" placeholder="Nom (p. ex. filtre G4)" value={m.nom} disabled={nomesLectura}
              aria-invalid={!!err(`mat-${k}-nom`)} aria-describedby={`e-mat-${k}`} onChange={(e) => posar(k, "nom", e.target.value)} />
            <input aria-label="Quantitat" inputMode="decimal" className="curt" value={m.quantitat} disabled={nomesLectura}
              aria-invalid={!!err(`mat-${k}-quantitat`)} aria-describedby={`e-mat-${k}`} onChange={(e) => posar(k, "quantitat", e.target.value)} />
            <input aria-label="Unitat" placeholder="u." className="curt" value={m.unitat} disabled={nomesLectura}
              onChange={(e) => posar(k, "unitat", e.target.value)} />
            <input aria-label="Cost per unitat (€)" placeholder="0,00" inputMode="decimal" className="curt" value={m.cost} disabled={nomesLectura}
              aria-invalid={!!err(`mat-${k}-cost`)} aria-describedby={`e-mat-${k}`} onChange={(e) => posar(k, "cost", e.target.value)} />
            {!nomesLectura && (
              <button type="button" className="treure" aria-label={`Treure ${m.nom || "material"}`} onClick={() => onTreure(m)}>✕</button>
            )}
          </div>
          {(err(`mat-${k}-nom`) || err(`mat-${k}-quantitat`) || err(`mat-${k}-cost`)) && (
            <span id={`e-mat-${k}`} className="error-camp">
              {[err(`mat-${k}-nom`), err(`mat-${k}-quantitat`), err(`mat-${k}-cost`)].filter(Boolean).join(" ")}
            </span>
          )}
        </div>
      ))}
      {!nomesLectura && (
        <button type="button" className="boto secundari petit" style={{ alignSelf: "flex-start" }}
          onClick={() => onChange([...materials, { nom: "", quantitat: "1", unitat: "", cost: "" }])}>+ Afegir material</button>
      )}
    </>
  );
}
