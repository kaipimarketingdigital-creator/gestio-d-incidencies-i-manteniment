import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useSessio } from "../lib/sessio";
import { NOM_ROL } from "../lib/supabase";
import logo from "../assets/logo-rull-blanc.png";
import icones from "../assets/icones-delta.png";
import AjudaContextual from "./AjudaContextual";

// Menú lateral (fix a l'ordinador) o barra superior amb menú desplegable (al mòbil).
export default function Estructura() {
  const { usuari, sortir } = useSessio();
  const { pathname } = useLocation();
  const [obert, setObert] = useState(false);
  const esDireccio = usuari?.rol === "direccio";
  const veuInformes = usuari?.rol === "direccio" || usuari?.rol === "administracio";
  const classe = ({ isActive }: { isActive: boolean }) => (isActive ? "actiu" : undefined);

  // En canviar de pantalla es tanca el menú del mòbil.
  useEffect(() => { setObert(false); }, [pathname]);
  useEffect(() => {
    if (!obert) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setObert(false); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [obert]);

  return (
    <div className="app">
      <header className="barra-mobil">
        <img src={logo} alt="Hotel Rull · Manteniment" />
        <button type="button" className="hamburguesa" aria-expanded={obert} aria-controls="menu-principal"
          aria-label={obert ? "Tancar el menú" : "Obrir el menú"} onClick={() => setObert(!obert)}>
          <span aria-hidden="true">{obert ? "✕" : "☰"}</span>
        </button>
      </header>
      <aside id="menu-principal" className={`menu${obert ? " obert" : ""}`}>
        <div className="marca">
          <img src={logo} alt="Hotel Rull" />
          <span>Manteniment</span>
        </div>
        <nav aria-label="Menú principal">
          <NavLink to="/" end className={classe}>Avui</NavLink>
          <NavLink to="/incidencies" className={classe}>Incidències</NavLink>
          <NavLink to="/mapa" className={classe}>Mapa de l'hotel</NavLink>
          <NavLink to="/preventiu" className={classe}>Preventiu</NavLink>
          {veuInformes && <NavLink to="/informes" className={classe}>Informes</NavLink>}
          {esDireccio && <NavLink to="/configuracio" className={classe}>Configuració</NavLink>}
          <NavLink to="/ajuda" className={({ isActive }) => `ajuda-menu${isActive ? " actiu" : ""}`}>Ajuda</NavLink>
        </nav>
        <div className="peu-menu">
          <img src={icones} alt="" aria-hidden="true" />
          <NavLink to="/perfil" className={({ isActive }) => `qui${isActive ? " actiu" : ""}`} title="El meu perfil">
            {usuari?.nom || usuari?.email}
            {usuari?.rol ? ` · ${NOM_ROL[usuari.rol]}` : ""}
          </NavLink>
          <button type="button" onClick={() => sortir()}>Sortir</button>
        </div>
      </aside>
      {obert && <div className="vel-menu" onClick={() => setObert(false)} aria-hidden="true" />}
      <main className="contingut">
        <Outlet />
        <AjudaContextual />
      </main>
    </div>
  );
}
