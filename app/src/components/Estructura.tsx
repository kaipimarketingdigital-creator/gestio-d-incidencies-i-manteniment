import { NavLink, Outlet } from "react-router-dom";
import { useSessio } from "../lib/sessio";
import { NOM_ROL } from "../lib/supabase";
import logo from "../assets/logo-rull-blanc.png";
import icones from "../assets/icones-delta.png";

// Menú lateral i espai de contingut, com a les maquetes.
export default function Estructura() {
  const { usuari, sortir } = useSessio();
  const esDireccio = usuari?.rol === "direccio";
  const classe = ({ isActive }: { isActive: boolean }) => (isActive ? "actiu" : undefined);
  return (
    <div className="app">
      <aside className="menu">
        <div className="marca">
          <img src={logo} alt="Hotel Rull" />
          <span>Manteniment</span>
        </div>
        <nav aria-label="Menú principal">
          <NavLink to="/" end className={classe}>Avui</NavLink>
          <NavLink to="/incidencies" className={classe}>Incidències</NavLink>
          <NavLink to="/mapa" className={classe}>Mapa de l'hotel</NavLink>
          <NavLink to="/preventiu" className={classe}>Preventiu</NavLink>
          <NavLink to="/informes" className={classe}>Informes</NavLink>
          {esDireccio && <NavLink to="/configuracio" className={classe}>Configuració</NavLink>}
          <NavLink to="/ajuda" className={({ isActive }) => `ajuda-menu${isActive ? " actiu" : ""}`}>Ajuda</NavLink>
        </nav>
        <div className="peu-menu">
          <img src={icones} alt="" aria-hidden="true" />
          <span className="qui">
            {usuari?.nom || usuari?.email}
            {usuari?.rol ? ` · ${NOM_ROL[usuari.rol]}` : ""}
          </span>
          <button type="button" onClick={() => sortir()}>Sortir</button>
        </div>
      </aside>
      <main className="contingut">
        <Outlet />
      </main>
    </div>
  );
}
