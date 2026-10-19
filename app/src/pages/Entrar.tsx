import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import logo from "../assets/logo-rull-blanc.png";
import icones from "../assets/icones-delta.png";

// Entrada sense contrasenya: la persona escriu el seu correu i rep un enllaç.
export default function Entrar() {
  const [email, setEmail] = useState("");
  const [estat, setEstat] = useState<"inici" | "enviant" | "enviat" | "error">("inici");
  const [error, setError] = useState("");

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEstat("enviant");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      setError(
        /no té accés|not allowed|signups not allowed|403/i.test(`${error.message} ${error.status}`)
          ? "Aquest correu no té accés al panell. Si l'has de fer servir, demana a Direcció que et convidi."
          : error.status === 429
          ? "S'han demanat massa enllaços seguits. Espera uns minuts i torna-ho a provar."
          : "No s'ha pogut enviar l'enllaç. Revisa el correu i torna-ho a provar.",
      );
      setEstat("error");
    } else {
      setEstat("enviat");
    }
  }

  return (
    <div className="entrada">
      <header className="entrada-banda">
        <img src={logo} alt="Hotel Rull" />
        <span>Manteniment</span>
      </header>
      <div className="franja" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
      <main className="entrada-cos">
        {estat === "enviat" ? (
          <div className="targeta" role="status">
            <h1>Revisa el teu correu</h1>
            <p style={{ margin: 0 }}>
              Hem enviat un enllaç a <strong>{email}</strong>. Obre'l en aquest mateix navegador per entrar al panell.
            </p>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
              No el trobes? Mira la carpeta de correu brossa o espera un minut.
            </p>
            <button type="button" className="boto secundari" onClick={() => setEstat("inici")}>Fer servir un altre correu</button>
          </div>
        ) : (
          <form className="targeta" onSubmit={enviar}>
            <h1>Entrar al panell</h1>
            <p style={{ margin: 0, color: "var(--muted)" }}>Escriu el teu correu i et enviarem un enllaç per entrar. No cal contrasenya.</p>
            <label className="camp" htmlFor="email">Correu electrònic
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@hotelrull.com" />
            </label>
            {estat === "error" && <p className="avis error" role="alert">{error}</p>}
            <button className="boto" type="submit" disabled={estat === "enviant"}>
              {estat === "enviant" ? "Enviant…" : "Envia'm l'enllaç"}
            </button>
          </form>
        )}
      </main>
      <p style={{ textAlign: "center", margin: 0 }}><a href="#/ajuda">Com funciona? Manual d'ús</a> · <a href="#/ajuda?idioma=es">Manual en castellano</a></p>
      <footer className="entrada-peu"><img src={icones} alt="" aria-hidden="true" /></footer>
    </div>
  );
}
