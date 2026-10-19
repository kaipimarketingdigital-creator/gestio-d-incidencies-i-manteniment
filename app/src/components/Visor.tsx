import { useEffect, useRef, useState } from "react";

export type Element = { url: string; tipus: "foto" | "video"; titol?: string };

// Visor a pantalla completa per passar les fotos i vídeos d'una incidència sense sortir del panell.
// Fletxes ← →, Esc per tancar, i lliscar el dit al mòbil.
export default function Visor({ elements, inici, onTancar }: { elements: Element[]; inici: number; onTancar: () => void }) {
  const [i, setI] = useState(inici);
  const dialeg = useRef<HTMLDialogElement>(null);
  const toc = useRef<number | null>(null);
  const n = elements.length;
  const anar = (d: number) => setI((x) => (x + d + n) % n);

  useEffect(() => {
    const d = dialeg.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") anar(1);
      if (e.key === "ArrowLeft") anar(-1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const actual = elements[i];
  return (
    <dialog
      ref={dialeg}
      className="visor"
      aria-label="Fotos de la incidència"
      onClose={onTancar}
      onClick={(e) => { if (e.target === e.currentTarget) dialeg.current?.close(); }}
      onTouchStart={(e) => { toc.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toc.current === null) return;
        const dx = e.changedTouches[0].clientX - toc.current;
        if (Math.abs(dx) > 50) anar(dx < 0 ? 1 : -1);
        toc.current = null;
      }}
    >
      <div className="visor-barra">
        <span>{n > 1 ? `${i + 1} de ${n}` : ""}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={actual.url} target="_blank" rel="noreferrer" className="visor-boto">Obrir original</a>
          <button type="button" className="visor-boto" onClick={() => dialeg.current?.close()} aria-label="Tancar">✕</button>
        </div>
      </div>
      <div className="visor-escena" onClick={(e) => { if (e.target === e.currentTarget) dialeg.current?.close(); }}>
        {actual.tipus === "foto" ? (
          <img key={actual.url} src={actual.url} alt={actual.titol ?? `Foto ${i + 1} de ${n}`} />
        ) : (
          <video key={actual.url} src={actual.url} controls autoPlay playsInline />
        )}
        {n > 1 && (
          <>
            <button type="button" className="visor-fletxa esquerra" onClick={() => anar(-1)} aria-label="Anterior">‹</button>
            <button type="button" className="visor-fletxa dreta" onClick={() => anar(1)} aria-label="Següent">›</button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="visor-miniatures">
          {elements.map((el, k) => (
            <button key={el.url} type="button" className={k === i ? "actiu" : undefined} onClick={() => setI(k)} aria-label={`Veure ${k + 1}`}>
              {el.tipus === "foto" ? <img src={el.url} alt="" /> : <span>▶</span>}
            </button>
          ))}
        </div>
      )}
    </dialog>
  );
}
