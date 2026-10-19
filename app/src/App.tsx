import { Navigate, Route, Routes } from "react-router-dom";
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

export default function App() {
  const { carregant, sessio, usuari } = useSessio();
  if (carregant) return <p style={{ padding: 32, color: "var(--muted)" }}>Carregant…</p>;
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
        <Route path="configuracio" element={usuari.rol === "direccio" ? <Navigate to="/configuracio/resum" replace /> : <Navigate to="/" replace />} />
        <Route path="configuracio/:pestanya" element={usuari.rol === "direccio" ? <Configuracio /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
