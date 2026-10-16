import { Navigate, Route, Routes } from "react-router-dom";
import { useSessio } from "./lib/sessio";
import Entrar from "./pages/Entrar";
import SenseAcces from "./pages/SenseAcces";
import Estructura from "./components/Estructura";
import Avui from "./pages/Avui";
import Usuaris from "./pages/Usuaris";
import Incidencies from "./pages/Incidencies";
import Fitxa from "./pages/Fitxa";

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
        <Route
          path="configuracio/usuaris"
          element={usuari.rol === "direccio" ? <Usuaris /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
