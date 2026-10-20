// Importació única de l'històric del grup de WhatsApp «Manteniment Hotel 2025».
// Només per a Direcció, amb la seva sessió del panell (POST amb Authorization: Bearer <token>).
//
//   {accio:"estat"}                          recomptes actuals
//   {accio:"buidar", confirmacio:"ESBORRAR"} esborra incidències, missatges, adjunts (i els fitxers) i historial
//   multipart accio=importar, dades=<json d'una incidència>, + un camp per fitxer (nom = nom del fitxer)
//                                            crea la incidència amb els seus missatges i fitxers; si ja hi és, no fa res
//
// No toca persones, zones, preventiu, ajustos ni usuaris (només hi afegeix les persones del WhatsApp que falten).

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";
const BUCKET = "adjunts";

function clauServei(): string {
  const noves = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (noves) {
    try {
      const k = JSON.parse(noves)["default"];
      if (k) return k;
    } catch { /* clau antiga */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
const db = createClient(SUPABASE_URL, clauServei(), { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) => Response.json(d, { status, headers: CORS });

// Rol de cada persona del grup (les que no existeixen es creen sense Telegram).
const ROLS: Record<string, { rol: string; compartit?: boolean }> = {
  "Manolo": { rol: "manteniment" }, "Ionela": { rol: "pisos" }, "Davinia": { rol: "pisos" },
  "Maru": { rol: "cuina" }, "Nuria Ralda": { rol: "direccio" }, "Recepció (mòbil)": { rol: "recepcio", compartit: true },
  "Josep Callau": { rol: "direccio" },
};

type Msg = { linia: number; autor: string; data: string; text: string; fitxers: string[] };
type Inc = {
  clau: string; zona: string | null; zona_text: string | null; categoria: string; prioritat: string; descripcio: string;
  estat: string; creada_el: string; reportada_per: string; resolta_el: string | null; tancada_per: string | null;
  tancament_deduit: boolean; cal_repassar: boolean; observacions: string; missatges: Msg[];
};

async function usuariDireccio(req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data: u, error } = await db.auth.getUser(token);
  if (!u?.user) { console.error("sessió no vàlida", error?.message); return false; }
  const { data: f } = await db.from("usuaris_panell").select("rol, estat").eq("auth_id", u.user.id).maybeSingle();
  if (f?.rol !== "direccio" || f?.estat !== "actiu") { console.error("no és Direcció", u.user.email, f); return false; }
  return true;
}

async function compte(taula: string, filtre?: (q: any) => any): Promise<number> {
  // deno-lint-ignore no-explicit-any
  let q: any = db.from(taula).select("id", { count: "exact", head: true });
  if (filtre) q = filtre(q);
  const { count } = await q;
  return count ?? 0;
}

async function estat() {
  return {
    incidencies: await compte("incidencies"),
    importades: await compte("missatges", (q) => q.eq("cru->>origen", "whatsapp")),
    missatges: await compte("missatges"),
    adjunts: await compte("adjunts"),
    historial: await compte("historial"),
  };
}

async function buidar() {
  // 1) fitxers de l'emmagatzematge que pengen dels adjunts
  const rutes: string[] = [];
  for (let des = 0; ; des += 1000) {
    const { data } = await db.from("adjunts").select("ruta_storage").not("ruta_storage", "is", null).range(des, des + 999);
    if (!data?.length) break;
    rutes.push(...data.map((a: { ruta_storage: string }) => a.ruta_storage));
    if (data.length < 1000) break;
  }
  let fitxers = 0;
  for (let i = 0; i < rutes.length; i += 100) {
    const { data, error } = await db.storage.from(BUCKET).remove(rutes.slice(i, i + 100));
    if (error) throw new Error(`storage: ${error.message}`);
    fitxers += data?.length ?? 0;
  }
  // 2) files (adjunts cau en cascada amb els missatges; historial i costos, amb les incidències)
  const tot = (q: any) => q.gte("id", 0);
  const e1 = await tot(db.from("missatges").delete());
  if (e1.error) throw new Error(`missatges: ${e1.error.message}`);
  const e2 = await tot(db.from("missatges_bot").delete());
  if (e2.error) throw new Error(`missatges_bot: ${e2.error.message}`);
  const e3 = await tot(db.from("incidencies").delete());
  if (e3.error) throw new Error(`incidencies: ${e3.error.message}`);
  return { esborrat: true, fitxers, ...(await estat()) };
}

let cachePersones: Map<string, string> | null = null;
async function persona(nom: string): Promise<string> {
  if (!cachePersones) {
    const { data } = await db.from("persones").select("id, nom");
    cachePersones = new Map((data ?? []).map((p: { id: string; nom: string }) => [p.nom.toLowerCase(), p.id]));
  }
  const ja = cachePersones.get(nom.toLowerCase());
  if (ja) return ja;
  const r = ROLS[nom] ?? { rol: "pisos" };
  const { data, error } = await db.from("persones")
    .insert({ nom, rol: r.rol, compartit: !!r.compartit, actiu: true }).select("id").single();
  if (error) throw new Error(`persona ${nom}: ${error.message}`);
  cachePersones.set(nom.toLowerCase(), data.id);
  return data.id;
}

let cacheZones: Map<string, string> | null = null;
async function zona(nom: string | null): Promise<string | null> {
  if (!nom) return null;
  if (!cacheZones) {
    const { data } = await db.from("zones").select("id, nom");
    cacheZones = new Map((data ?? []).map((z: { id: string; nom: string }) => [z.nom.toLowerCase(), z.id]));
  }
  return cacheZones.get(nom.toLowerCase()) ?? null;
}

function tipusDe(nom: string): { tipus: string; mime: string } {
  const ext = nom.split(".").pop()!.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return { tipus: "foto", mime: "image/jpeg" };
  if (ext === "webp") return { tipus: "foto", mime: "image/webp" };
  if (ext === "png") return { tipus: "foto", mime: "image/png" };
  if (ext === "opus" || ext === "ogg") return { tipus: "audio", mime: "audio/ogg" };
  if (ext === "mp4") return { tipus: "video", mime: "video/mp4" };
  return { tipus: "altre", mime: "application/octet-stream" };
}

function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function transcriure(bytes: Uint8Array): Promise<string | null> {
  if (!GEMINI_KEY) return null;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [
        { text: "Transcriu literalment aquest missatge de veu d'un grup de manteniment d'un hotel, en la llengua en què es parla (català o castellà). Torna només el text, sense comentaris." },
        { inlineData: { mimeType: "audio/ogg", data: base64(bytes) } },
      ] }],
      generationConfig: { temperature: 0 },
    }),
  });
  if (!r.ok) { console.error("gemini", r.status, (await r.text()).slice(0, 300)); return null; }
  const j = await r.json();
  const t = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").trim();
  return t || null;
}

async function importar(form: FormData) {
  const inc = JSON.parse(String(form.get("dades"))) as Inc;
  const { count } = await db.from("missatges").select("id", { count: "exact", head: true })
    .eq("cru->>origen", "whatsapp").eq("cru->>incidencia", inc.clau);
  if (count) return { clau: inc.clau, ja: true };

  const manolo = await persona("Manolo");
  const { data: fila, error } = await db.from("incidencies").insert({
    zona_id: await zona(inc.zona), zona_text: inc.zona_text, categoria: inc.categoria, prioritat: inc.prioritat,
    descripcio: inc.descripcio, estat: inc.estat, reportada_per: await persona(inc.reportada_per), assignada_a: manolo,
    cal_repassar: inc.cal_repassar, observacions: inc.observacions, creada_el: inc.creada_el, resolta_el: inc.resolta_el,
  }).select("id").single();
  if (error) throw new Error(`incidència: ${error.message}`);
  const id = fila.id as number;

  let pujats = 0, transcrits = 0;
  try {
    for (const m of inc.missatges) {
      const { data: msg, error: em } = await db.from("missatges").insert({
        // Xat 0 = WhatsApp (no és cap xat de Telegram); id únic per incidència i línia del xat exportat
        tg_xat_id: 0, tg_missatge_id: Number(inc.clau.replace(/\D/g, "")) * 10000 + m.linia,
        incidencia_id: id, autor_id: await persona(m.autor), text: m.text || null, rebut_el: m.data, processat: true,
        cru: { origen: "whatsapp", incidencia: inc.clau, linia: m.linia, fitxers: m.fitxers },
      }).select("id").single();
      if (em) throw new Error(`missatge: ${em.message}`);
      for (const nom of m.fitxers) {
        const f = form.get(nom);
        if (!(f instanceof File)) continue; // fitxer que no ha arribat: queda anotat a cru.fitxers
        const bytes = new Uint8Array(await f.arrayBuffer());
        const { tipus, mime } = tipusDe(nom);
        const ruta = `whatsapp/${nom}`;
        const { error: es } = await db.storage.from(BUCKET).upload(ruta, bytes, { contentType: mime, upsert: true });
        if (es) throw new Error(`fitxer ${nom}: ${es.message}`);
        const { error: ea } = await db.from("adjunts").insert({ missatge_id: msg.id, tipus, tg_file_id: `whatsapp:${nom}`, ruta_storage: ruta, mida_bytes: bytes.length });
        if (ea) throw new Error(`adjunt ${nom}: ${ea.message}`);
        pujats++;
        if (tipus === "audio") {
          const t = await transcriure(bytes);
          if (t) { await db.from("missatges").update({ transcripcio: t }).eq("id", msg.id); transcrits++; }
        }
      }
    }
    // Historial: com es va obrir i, si cal, com es va tancar
    const hist: Record<string, unknown>[] = [{ incidencia_id: id, persona_id: await persona(inc.reportada_per), camp: "estat", valor_anterior: null, valor_nou: "oberta", canviat_el: inc.creada_el }];
    if (inc.estat !== "oberta") {
      const darrer = inc.missatges[inc.missatges.length - 1]?.data ?? inc.creada_el;
      hist.push({
        incidencia_id: id, persona_id: inc.tancada_per ? await persona(inc.tancada_per) : manolo, camp: "estat",
        valor_anterior: "oberta", valor_nou: inc.estat, canviat_el: inc.resolta_el ?? darrer,
      });
    }
    const { error: eh } = await db.from("historial").insert(hist);
    if (eh) throw new Error(`historial: ${eh.message}`);
  } catch (e) {
    // Si falla a mitges, es desfà perquè es pugui tornar a provar
    await db.from("missatges").delete().eq("incidencia_id", id);
    await db.from("incidencies").delete().eq("id", id);
    throw e;
  }
  return { clau: inc.clau, id, pujats, transcrits };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "només POST" }, 405);
  if (!(await usuariDireccio(req))) return json({ error: "només Direcció" }, 403);
  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      if (form.get("accio") !== "importar") return json({ error: "acció desconeguda" }, 400);
      return json(await importar(form));
    }
    const cos = await req.json().catch(() => ({}));
    if (cos.accio === "estat") return json(await estat());
    if (cos.accio === "buidar") {
      if (cos.confirmacio !== "ESBORRAR") return json({ error: "cal escriure ESBORRAR" }, 400);
      return json(await buidar());
    }
    return json({ error: "acció desconeguda" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e).slice(0, 400) }, 500);
  }
});
