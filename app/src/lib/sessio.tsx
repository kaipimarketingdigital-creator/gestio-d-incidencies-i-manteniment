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
        if (event === "SIGNED_IN") supabase.rpc("registrar_acces").then(() => {});
      }, 0);
    });
    return () => {
      viu = false;
      sub.subscription.unsubscribe();
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
