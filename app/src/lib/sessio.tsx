import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Usuari } from "./supabase";

type EstatSessio = {
  carregant: boolean;
  sessio: Session | null;
  usuari: Usuari | null; // la fila de usuaris_panell de qui ha entrat
  recarregar: () => Promise<void>;
  sortir: () => Promise<void>;
};

const Context = createContext<EstatSessio | null>(null);

// Tancar la sessió després de 12 hores sense fer servir el panell (ordinadors compartits).
const INACTIVITAT_MS = 12 * 3600e3;
const CLAU_ACTIVITAT = "panell-darrera-activitat";
let activitatMemoria = Date.now();
function llegirActivitat(): number {
  try {
    const v = Number(localStorage.getItem(CLAU_ACTIVITAT));
    return v > 0 ? v : activitatMemoria;
  } catch {
    return activitatMemoria;
  }
}
function apuntarActivitat() {
  activitatMemoria = Date.now();
  try { localStorage.setItem(CLAU_ACTIVITAT, String(activitatMemoria)); } catch { /* sense emmagatzematge */ }
}
// Un inici de sessió recent (p. ex. l'enllaç del correu d'ara mateix) també compta com a activitat.
const inactiuMassaTemps = (s: Session) =>
  Date.now() - Math.max(llegirActivitat(), Date.parse(s.user.last_sign_in_at ?? "") || 0) > INACTIVITAT_MS;

export function ProveidorSessio({ children }: { children: ReactNode }) {
  const [sessio, setSessio] = useState<Session | null>(null);
  const [usuari, setUsuari] = useState<Usuari | null>(null);
  const [carregant, setCarregant] = useState(true);

  const carregarUsuari = useCallback(async (s: Session | null) => {
    if (!s) {
      setUsuari(null);
      return;
    }
    const { data } = await supabase.from("usuaris_panell").select("*").eq("auth_id", s.user.id).maybeSingle();
    setUsuari((data as Usuari) ?? null);
  }, []);

  useEffect(() => {
    let viu = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!viu) return;
      if (data.session && inactiuMassaTemps(data.session)) {
        await supabase.auth.signOut();
        data = { session: null };
      }
      if (data.session) apuntarActivitat();
      setSessio(data.session);
      await carregarUsuari(data.session);
      if (data.session) supabase.rpc("registrar_acces").then(() => {});
      setCarregant(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSessio(s);
      // Fora del callback: Supabase recomana no esperar crides dins onAuthStateChange.
      setTimeout(async () => {
        await carregarUsuari(s);
        if (event === "SIGNED_IN") {
          apuntarActivitat();
          supabase.rpc("registrar_acces").then(() => {});
        }
      }, 0);
    });
    // Qualsevol clic o tecla compta com a activitat (com a molt un cop per minut).
    let darrer = 0;
    const activitat = () => { if (Date.now() - darrer > 60e3) { darrer = Date.now(); apuntarActivitat(); } };
    const esdeveniments = ["pointerdown", "keydown", "scroll", "focus"];
    esdeveniments.forEach((e) => window.addEventListener(e, activitat, { passive: true }));
    const rellotge = window.setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session && inactiuMassaTemps(data.session)) await supabase.auth.signOut();
    }, 5 * 60e3);
    return () => {
      viu = false;
      sub.subscription.unsubscribe();
      esdeveniments.forEach((e) => window.removeEventListener(e, activitat));
      window.clearInterval(rellotge);
    };
  }, [carregarUsuari]);

  const valor: EstatSessio = {
    carregant,
    sessio,
    usuari,
    recarregar: () => carregarUsuari(sessio),
    sortir: async () => {
      await supabase.auth.signOut();
      setUsuari(null);
    },
  };
  return <Context.Provider value={valor}>{children}</Context.Provider>;
}

export function useSessio(): EstatSessio {
  const c = useContext(Context);
  if (!c) throw new Error("useSessio fora de ProveidorSessio");
  return c;
}
