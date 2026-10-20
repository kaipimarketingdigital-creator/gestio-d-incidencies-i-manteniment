import { type ReactNode, useEffect, useMemo, useState } from "react";

// Paginació de llistes ja carregades. Cada llista recorda (en aquest navegador) quantes files vol veure l'usuari.
const MIDES = [10, 25, 50, 100, 0]; // 0 = totes

function midaDesada(clau: string, defecte: number): number {
  try {
    const v = Number(localStorage.getItem(`pagina-${clau}`));
    return MIDES.includes(v) && localStorage.getItem(`pagina-${clau}`) !== null ? v : defecte;
  } catch {
    return defecte;
  }
}

export function usePaginacio<T>(items: T[], clau: string, defecte = 25) {
  const [mida, setMidaEstat] = useState(() => midaDesada(clau, defecte));
  const [pagina, setPagina] = useState(1);
  const total = items.length;
  const pagines = mida ? Math.max(1, Math.ceil(total / mida)) : 1;

  // Quan canvia la llista (filtres, cerca…), es torna a la primera pàgina
  useEffect(() => { setPagina(1); }, [items]);
  useEffect(() => { if (pagina > pagines) setPagina(pagines); }, [pagina, pagines]);

  const visibles = useMemo(() => (mida ? items.slice((pagina - 1) * mida, pagina * mida) : items), [items, mida, pagina]);

  function setMida(n: number) {
    setMidaEstat(n);
    setPagina(1);
    try { localStorage.setItem(`pagina-${clau}`, String(n)); } catch { /* no passa res */ }
  }

  const controls = total > MIDES[0] ? (
    <Paginacio total={total} mida={mida} pagina={pagina} pagines={pagines} onPagina={setPagina} onMida={setMida} />
  ) : null;
  return { visibles, controls };
}

function Paginacio({ total, mida, pagina, pagines, onPagina, onMida }: {
  total: number; mida: number; pagina: number; pagines: number; onPagina: (p: number) => void; onMida: (n: number) => void;
}) {
  const des = mida ? (pagina - 1) * mida + 1 : 1;
  const fins = mida ? Math.min(pagina * mida, total) : total;
  return (
    <nav className="paginacio" aria-label="Paginació">
      <span className="paginacio-info">{des}–{fins} de {total}</span>
      {pagines > 1 && (
        <span className="paginacio-botons">
          <button type="button" className="boto secundari petit" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)} aria-label="Pàgina anterior">‹ Anterior</button>
          <span aria-live="polite">Pàgina {pagina} de {pagines}</span>
          <button type="button" className="boto secundari petit" disabled={pagina >= pagines} onClick={() => onPagina(pagina + 1)} aria-label="Pàgina següent">Següent ›</button>
        </span>
      )}
      <label className="paginacio-mida">Files per pàgina
        <select value={mida} onChange={(e) => onMida(Number(e.target.value))}>
          {MIDES.map((n) => <option key={n} value={n}>{n || "Totes"}</option>)}
        </select>
      </label>
    </nav>
  );
}

// Per a llistes dins d'un bucle (on no es pot cridar el hook directament).
export function LlistaPaginada<T>({ items, clau, defecte = 10, children }: {
  items: T[]; clau: string; defecte?: number; children: (visibles: T[]) => ReactNode;
}) {
  const { visibles, controls } = usePaginacio(items, clau, defecte);
  return <>{children(visibles)}{controls}</>;
}
