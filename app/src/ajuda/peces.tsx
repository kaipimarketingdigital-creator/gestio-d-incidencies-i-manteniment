import type { ReactNode } from "react";

// Peces petites per escriure el manual (iguals en català i castellà).

export type Apartat = { id: string; titol: string; cos: ReactNode };

export const Nota = ({ children, tipus = "info" }: { children: ReactNode; tipus?: "info" | "consell" | "compte" }) => (
  <div className={`nota-ajuda ${tipus}`}>{children}</div>
);

// Nom d'un botó o d'un element que es veu a la pantalla.
export const B = ({ children }: { children: ReactNode }) => <span className="boto-text">{children}</span>;

// Un missatge d'exemple de Telegram.
export const Xat = ({ qui, children, bot = false }: { qui: string; children: ReactNode; bot?: boolean }) => (
  <div className={`xat-ex ${bot ? "bot" : ""}`}>
    <span className="qui">{qui}</span>
    <span className="text">{children}</span>
  </div>
);

export const Passos = ({ children }: { children: ReactNode }) => <ol className="passos-ajuda">{children}</ol>;

// Esquema de com circula una incidència.
export const Esquema = ({ passes }: { passes: [string, string][] }) => (
  <ol className="esquema-ajuda">
    {passes.map(([t, d], k) => (
      <li key={k}><strong>{t}</strong><span>{d}</span></li>
    ))}
  </ol>
);
