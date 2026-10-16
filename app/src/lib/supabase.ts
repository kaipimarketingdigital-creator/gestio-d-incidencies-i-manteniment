import { createClient } from "@supabase/supabase-js";

// La clau publicable és pública per disseny: la seguretat la posen les polítiques de la base de dades.
const URL = import.meta.env.VITE_SUPABASE_URL ?? "https://emgwjhypuxgbrajjnnsj.supabase.co";
const CLAU = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_cFsnTeJMawPyYuPD-etU1A_e0ZJBXxi";

export const supabase = createClient(URL, CLAU, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
});

export type Rol = "direccio" | "administracio" | "manteniment";
export type EstatUsuari = "convidat" | "pendent" | "actiu" | "desactivat";

export type Usuari = {
  id: string;
  auth_id: string | null;
  email: string;
  nom: string | null;
  rol: Rol | null;
  estat: EstatUsuari;
  creat_el: string;
  darrer_acces: string | null;
};

export const NOM_ROL: Record<Rol, string> = {
  direccio: "Direcció",
  administracio: "Administració",
  manteniment: "Manteniment",
};

export const NOM_ESTAT: Record<EstatUsuari, string> = {
  convidat: "Convidat",
  pendent: "Pendent d'aprovació",
  actiu: "Actiu",
  desactivat: "Desactivat",
};
