// Noms en català i tipus compartits per les pantalles d'incidències.

export type Prioritat = "baixa" | "mitjana" | "alta" | "urgent";
export type Estat = "oberta" | "en_curs" | "esperant_material" | "proveidor_extern" | "resolta" | "anullada";
export type Categoria =
  | "fontaneria" | "electricitat" | "climatitzacio" | "panys_i_portes" | "mobiliari"
  | "tv_i_electronica" | "plagues" | "filtracions" | "neteja" | "tasca" | "altres";

export type Incidencia = {
  id: number;
  zona_id: string | null;
  zona_text: string | null;
  categoria: Categoria | null;
  descripcio: string;
  prioritat: Prioritat;
  estat: Estat;
  reportada_per: string | null;
  assignada_a: string | null;
  cal_repassar: boolean;
  cost: number | null;
  materials: string | null;
  observacions: string | null;
  creada_el: string;
  resolta_el: string | null;
  preventiu_id: string | null;
  zones?: { nom: string; planta: number | null } | null;
};

export type Persona = { id: string; nom: string; actiu: boolean };
export type Zona = { id: string; nom: string; tipus: string; planta: number | null };

export const ESTATS: Estat[] = ["oberta", "en_curs", "esperant_material", "proveidor_extern", "resolta", "anullada"];
export const ESTATS_OBERTS: Estat[] = ["oberta", "en_curs", "esperant_material", "proveidor_extern"];
export const PRIORITATS: Prioritat[] = ["urgent", "alta", "mitjana", "baixa"];
export const CATEGORIES: Categoria[] = [
  "fontaneria", "electricitat", "climatitzacio", "panys_i_portes", "mobiliari",
  "tv_i_electronica", "plagues", "filtracions", "neteja", "tasca", "altres",
];

export const NOM_ESTAT: Record<Estat, string> = {
  oberta: "Oberta",
  en_curs: "En curs",
  esperant_material: "Esperant material",
  proveidor_extern: "Proveïdor extern",
  resolta: "Resolta",
  anullada: "Anul·lada",
};

export const NOM_PRIORITAT: Record<Prioritat, string> = {
  urgent: "Urgent",
  alta: "Alta",
  mitjana: "Mitjana",
  baixa: "Baixa",
};

export const NOM_CATEGORIA: Record<Categoria, string> = {
  fontaneria: "Fontaneria",
  electricitat: "Electricitat",
  climatitzacio: "Climatització",
  panys_i_portes: "Panys i portes",
  mobiliari: "Mobiliari",
  tv_i_electronica: "TV i electrònica",
  plagues: "Plagues",
  filtracions: "Filtracions",
  neteja: "Neteja",
  tasca: "Tasca",
  altres: "Altres",
};

export const ORDRE_PRIORITAT: Record<Prioritat, number> = { urgent: 0, alta: 1, mitjana: 2, baixa: 3 };

export function lloc(i: Pick<Incidencia, "zones" | "zona_text">): string {
  return i.zones?.nom ?? i.zona_text ?? "Sense lloc";
}

export function dataCurta(d: string | null): string {
  return d ? new Date(d).toLocaleDateString("ca-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
}

export function dataHora(d: string | null): string {
  return d
    ? new Date(d).toLocaleString("ca-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";
}

// Valor llegible per a l'historial (el bot hi desa els codis interns).
export function valorLlegible(camp: string, v: string | null): string {
  if (v === null || v === "") return "—";
  if (camp === "estat" && v in NOM_ESTAT) return NOM_ESTAT[v as Estat];
  if (camp === "prioritat" && v in NOM_PRIORITAT) return NOM_PRIORITAT[v as Prioritat];
  if (camp === "categoria" && v in NOM_CATEGORIA) return NOM_CATEGORIA[v as Categoria];
  return v;
}

export const NOM_CAMP: Record<string, string> = {
  estat: "Estat",
  prioritat: "Prioritat",
  categoria: "Categoria",
  assignada_a: "Assignada a",
  cost: "Cost",
  materials: "Materials",
  observacions: "Observacions",
  cal_repassar: "Cal repassar",
  zona_id: "Lloc",
  descripcio: "Descripció",
};
