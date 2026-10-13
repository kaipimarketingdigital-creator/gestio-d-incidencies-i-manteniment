// Interpretació dels missatges amb un model multimodal de Gemini.
// Tota la lògica d'IA és aquí: canviar de model o de proveïdor només toca aquest fitxer.

const API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
export const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";

export const CATEGORIES = [
  "fontaneria", "electricitat", "climatitzacio", "panys_i_portes", "mobiliari",
  "tv_i_electronica", "plagues", "filtracions", "neteja", "tasca", "altres",
] as const;
export const PRIORITATS = ["baixa", "mitjana", "alta", "urgent"] as const;

export type Accio = {
  accio: "nova" | "actualitzar" | "resoldre" | "ignorar" | "preguntar";
  incidencia_id?: number | null;
  zona?: string | null;
  categoria?: string | null;
  prioritat?: string | null;
  descripcio?: string | null;
  nota?: string | null;
  pregunta?: string | null;
  missatges?: number[] | null; // índexs dels missatges als quals es refereix
};

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

const INSTRUCCIONS = `Ets l'assistent de manteniment de l'Hotel Rull (Delta de l'Ebre). Llegeixes els missatges del grup
de manteniment de l'equip i decideixes què fer amb cadascun. L'equip escriu en català col·loquial de les
Terres de l'Ebre, a vegades en castellà, amb faltes, molt breu, i sovint amb una foto, un àudio o un vídeo.

Per a cada grup de missatges retorna una llista d'accions:
- "nova": un avís d'avaria o d'una cosa que cal fer. Una incidència per avaria i habitació:
  "322 i 221 no obre el pany" són DUES incidències.
- "actualitzar": informació nova sobre una incidència oberta (indica incidencia_id i posa-ho a "nota").
- "resoldre": algú diu que una incidència oberta ja està feta ("fet", "arreglat", "ja està", "repassar").
  Indica incidencia_id. Si diu "repassar", posa nota "cal repassar".
  Si és un "fet" solt i hi encaixen diverses incidències obertes, "preguntar"; si no n'hi encaixa cap, "ignorar".
- "ignorar": salutacions, bromes, preguntes on és una cosa, coordinació, comentaris i seguiments entre
  companys ("ho has mirat?", "jo diria que ja està", "vaig tancar-la jo"), missatges equivocats de grup.
- "preguntar": només quan el missatge és clarament un AVÍS NOU d'avaria o d'encàrrec i falta la zona, o un
  "fet" és ambigu entre diverses incidències obertes. Abans de preguntar, mira la CONVERSA RECENT i el
  missatge al qual respon: si la zona hi surt, fes-la servir. No preguntis per un comentari, un seguiment
  o un "fet"/"arreglat" quan no hi ha cap incidència oberta que hi encaixi: llavors "ignorar".
  Cada pregunta molesta l'equip; si dubtes entre preguntar i ignorar un comentari, ignora.
  La pregunta ha de ser curta, en català.

Regles:
- "zona": el nom EXACTE d'una zona de la llista. Les habitacions són números ("207"). Si no encaixa amb cap
  zona, escriu el que va dir l'equip. Si una foto sense text no deixa clara la zona, pregunta.
- "descripcio": màxim 12 paraules, en català correcte, què passa (no qui ho diu). Ex: "Tap de la banyera trencat".
- No inventis. Si un missatge només té una foto, descriu el que es veu només si és evident.
- Prioritat:
  - "urgent": sense aigua, inundació o aigua caient, client que no pot entrar a l'habitació, risc per a la seguretat.
  - "alta": "és manteniment" (l'habitació està ocupada i el client hi continua allotjat), "avui és entrada",
    el client s'ha queixat, o impedeix fer servir l'habitació.
  - "baixa": estètic o que pot esperar ("està molt feo", pintar, canviar per estètica).
  - "mitjana": la resta.
- "manteniment" també vol dir reparar coses; només "és manteniment" dit d'una habitació indica que està ocupada.
- "productora" són clients com els altres.
- Encàrrecs que no són avaries ("pujar les hamaques", "preparar el projector") són categoria "tasca".
- Si una avaria nova és clarament la mateixa que una incidència oberta de la mateixa zona, fes "actualitzar".
- "Repassar" (p. ex. "202 i 305 repassar") el diu manteniment quan ha acabat i pisos ha de tornar a netejar
  l'habitació: és "resoldre" la incidència oberta d'aquella zona amb nota "cal repassar". Mai és una incidència
  nova; si no hi ha cap incidència oberta en aquella zona, "ignorar".
- Quan es canvia una cosa d'habitació ("agafo el comandament de la 204 per a la 213", "la tele de la 112
  la poso a la 209"), la incidència és a l'habitació que es queda sense o on segueix l'avaria, no a l'altra.
- La CONVERSA RECENT és només context: no hi facis accions, encara que hi hagi avisos.`;

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    accions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          accio: { type: "STRING", enum: ["nova", "actualitzar", "resoldre", "ignorar", "preguntar"] },
          incidencia_id: { type: "INTEGER", nullable: true },
          zona: { type: "STRING", nullable: true },
          categoria: { type: "STRING", enum: [...CATEGORIES], nullable: true },
          prioritat: { type: "STRING", enum: [...PRIORITATS], nullable: true },
          descripcio: { type: "STRING", nullable: true },
          nota: { type: "STRING", nullable: true },
          pregunta: { type: "STRING", nullable: true },
          missatges: { type: "ARRAY", items: { type: "INTEGER" }, nullable: true },
        },
        required: ["accio"],
      },
    },
  },
  required: ["accions"],
};

export async function interpretar(context: string, parts: Part[]): Promise<Accio[]> {
  const cos = {
    systemInstruction: { parts: [{ text: INSTRUCCIONS }] },
    contents: [{ role: "user", parts: [{ text: context }, ...parts] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: ESQUEMA,
    },
  };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify(cos),
    },
  );
  const j = await r.json();
  if (!r.ok) throw new Error(`gemini ${r.status}: ${JSON.stringify(j).slice(0, 500)}`);
  const text = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const dades = JSON.parse(text);
  return Array.isArray(dades.accions) ? dades.accions : [];
}

export async function llistarModels(): Promise<string[]> {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
    headers: { "x-goog-api-key": API_KEY },
  });
  const j = await r.json();
  if (!r.ok) return [`error ${r.status}: ${j.error?.message ?? ""}`];
  // deno-lint-ignore no-explicit-any
  return (j.models ?? []).map((m: any) => m.name.replace("models/", ""))
    .filter((n: string) => n.includes("flash") || n.includes("pro"));
}
