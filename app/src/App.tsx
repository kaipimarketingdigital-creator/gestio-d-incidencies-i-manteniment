import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useSessio } from "./lib/sessio";
import Entrar from "./pages/Entrar";
import SenseAcces from "./pages/SenseAcces";
import Estructura from "./components/Estructura";
import Avui from "./pages/Avui";
import Configuracio from "./pages/Configuracio";
import Incidencies from "./pages/Incidencies";
import Fitxa from "./pages/Fitxa";
import Preventiu from "./pages/Preventiu";
import Mapa from "./pages/Mapa";
import Informes from "./pages/Informes";
import Ajuda from "./pages/Ajuda";
import Perfil from "./pages/Perfil";
import Importar from "./pages/Importar";
import logo from "./assets/logo-rull-blanc.png";

export default function App() {
  const { carregant, sessio, usuari } = useSessio();
  const location = useLocation();
  if (carregant) return <p style={{ padding: 32, color: "var(--muted)" }}>Carregant…</p>;
  // El manual es pot consultar sense entrar (per a tot l'equip del grup de Telegram).
  if (location.pathname.startsWith("/ajuda") && (!sessio || usuari?.estat !== "actiu")) {
    return (
      <div className="entrada">
        <header className="entrada-banda" style={{ paddingBottom: 24 }}>
          <img src={logo} alt="Hotel Rull" />
          <span>Manteniment</span>
        </header>
        <div className="franja" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
        <main className="contingut" style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          <Ajuda publica />
          <p className="no-imprimir" style={{ textAlign: "center" }}><Link to="/">Entrar al panell</Link></p>
        </main>
      </div>
    );
  }
  if (!sessio) return <Entrar />;
  if (!usuari || usuari.estat !== "actiu") return <SenseAcces />;
  return (
    <Routes>
      <Route element={<Estructura />}>
        <Route index element={<Avui />} />
        <Route path="incidencies" element={<Incidencies />} />
        <Route path="incidencies/:id" element={<Fitxa />} />
        <Route path="preventiu" element={<Preventiu />} />
        <Route path="mapa" element={<Mapa />} />
        <Route path="informes" element={usuari.rol === "manteniment" ? <Navigate to="/" replace /> : <Informes />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="importar" element={usuari.rol === "direccio" ? <Importar /> : <Navigate to="/" replace />} />
        <Route path="ajuda" element={<Ajuda />} />
        <Route path="configuracio" element={usuari.rol === "direccio" ? <Navigate to="/configuracio/resum" replace /> : <Navigate to="/" replace />} />
        <Route path="configuracio/:pestanya" element={usuari.rol === "direccio" ? <Configuracio /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
