// Bot de manteniment de l'Hotel Rull.
//
// Rutes:
//   POST (Telegram)            rep missatges i botons. Desa el missatge i, si és un "fet" en resposta
//                              a una incidència o un botó, actua a l'instant.
//   GET  ?accio=processar      el crida pg_cron cada 30 s. Agrupa els missatges seguits de cada persona,
//                              els interpreta amb Gemini i registra o actualitza incidències.
//   GET  ?accio=configurar     registra el webhook a Telegram (una vegada).
//   GET  ?accio=models         llista els models de Gemini disponibles (diagnòstic).
//
// Secrets: TELEGRAM_BOT_TOKEN, GEMINI_API_KEY; opcionals TELEGRAM_GROUP_ID, GEMINI_MODEL.

import { createClient } from "npm:@supabase/supabase-js@2";
import { BOT_TOKEN, botons, descarregar, secretWebhook, tg } from "./telegram.ts";
import { type Accio, interpretar, llistarModels, MODEL, type Part } from "./gemini.ts";

const GROUP_ID = Deno.env.get("TELEGRAM_GROUP_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ESPERA_SEGONS = 30;

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

// ---------------------------------------------------------------- textos

const NOM_CATEGORIA: Record<string, string> = {
  fontaneria: "Fontaneria", electricitat: "Electricitat", climatitzacio: "Climatització",
  panys_i_portes: "Panys i portes", mobiliari: "Mobiliari", tv_i_electronica: "TV i electrònica",
  plagues: "Plagues", filtracions: "Filtracions", neteja: "Neteja", tasca: "Tasca", altres: "Altres",
};
const NOM_PRIORITAT: Record<string, string> = {
  baixa: "Prioritat baixa", mitjana: "Prioritat mitjana", alta: "Prioritat alta", urgent: "URGENT",
};
const FET = /^\s*(fet|feta|fets|arreglat|arreglada|ja est[àa]|ja esta|solucionat|resolt|repassar|repaseu|reparat)\b/i;

type Zona = { id: string; nom: string; tipus: string; alies: string[] };
// deno-lint-ignore no-explicit-any
type Inc = any;

function nomZona(z: Zona | undefined, text?: string | null): string {
  if (z) return z.tipus === "habitacio" && /^\d+$/.test(z.nom) ? `Hab. ${z.nom}` : z.nom;
  return text ? `${text} (zona no reconeguda)` : "Zona sense indicar";
}

function resum(inc: Inc, z: Zona | undefined): string {
  return `${nomZona(z, inc.zona_text)} · ${NOM_CATEGORIA[inc.categoria] ?? inc.categoria} · ` +
    `${NOM_PRIORITAT[inc.prioritat] ?? inc.prioritat}\n${inc.descripcio}`;
}

// ---------------------------------------------------------------- dades

async function zones(): Promise<Zona[]> {
  const { data } = await db.from("zones").select("id, nom, tipus, alies").eq("activa", true);
  return data ?? [];
}

function trobarZona(llista: Zona[], text?: string | null): Zona | undefined {
  if (!text) return undefined;
  const t = text.trim().toLowerCase().replace(/^hab(itaci[óo])?\.?\s*/, "");
  return llista.find((z) => z.nom.toLowerCase() === t) ??
    llista.find((z) => z.alies.some((a) => a.toLowerCase() === t));
}

async function persona(from: { id: number; first_name?: string; last_name?: string } | undefined) {
  if (!from) return null;
  const nom = [from.first_name, from.last_name].filter(Boolean).join(" ") || `Telegram ${from.id}`;
  const { data } = await db.from("persones").select("id, nom").eq("telegram_id", from.id).maybeSingle();
  if (data) return data;
  const { data: nova } = await db.from("persones").insert({ nom, telegram_id: from.id }).select("id, nom").single();
  return nova;
}

async function historial(incId: number, personaId: string | null, camp: string, abans: unknown, despres: unknown) {
  await db.from("historial").insert({
    incidencia_id: incId, persona_id: personaId, camp,
    valor_anterior: abans == null ? null : String(abans), valor_nou: despres == null ? null : String(despres),
  });
}

// Envia un missatge del bot i recorda a quina incidència es refereix.
async function enviar(
  xat: number, text: string, respostaA: number | null, incId: number | null, tipus: string,
  extra: Record<string, unknown> = {},
) {
  const r = await tg("sendMessage", {
    chat_id: xat, text,
    ...(respostaA ? { reply_parameters: { message_id: respostaA, allow_sending_without_reply: true } } : {}),
    ...extra,
  });
  if (r.ok) {
    await db.from("missatges_bot").insert({
      tg_xat_id: xat, tg_missatge_id: r.result.message_id, incidencia_id: incId, tipus, text,
    });
  }
  return r.ok ? r.result.message_id as number : null;
}

// Quina incidència hi ha darrere del missatge al qual es respon.
async function incidenciaDeResposta(xat: number, respostaA: number | null) {
  if (!respostaA) return null;
  const { data: b } = await db.from("missatges_bot").select("incidencia_id, tipus, text")
    .eq("tg_xat_id", xat).eq("tg_missatge_id", respostaA).maybeSingle();
  if (b) return { incId: b.incidencia_id as number | null, tipus: b.tipus as string, textBot: b.text as string };
  const { data: m } = await db.from("missatges").select("incidencia_id")
    .eq("tg_xat_id", xat).eq("tg_missatge_id", respostaA).maybeSingle();
  if (m?.incidencia_id) return { incId: m.incidencia_id as number, tipus: "avis", textBot: null };
  // Resposta a un company: passem el text original perquè la IA sàpiga de què parla.
  const { data: o } = await db.from("missatges").select("text")
    .eq("tg_xat_id", xat).eq("tg_missatge_id", respostaA).maybeSingle();
  if (o?.text) return { incId: null, tipus: "missatge", textBot: String(o.text).slice(0, 300) };
  return null;
}

async function resoldre(incId: number, personaId: string | null, nota: string | null, repassar: boolean) {
  const { data: inc } = await db.from("incidencies").select("*").eq("id", incId).maybeSingle();
  if (!inc || inc.estat === "resolta" || inc.estat === "anullada") return null;
  const obs = nota ? [inc.observacions, nota].filter(Boolean).join("\n") : inc.observacions;
  await db.from("incidencies").update({
    estat: "resolta", resolta_el: new Date().toISOString(), observacions: obs,
    cal_repassar: repassar || inc.cal_repassar,
  }).eq("id", incId);
  await historial(incId, personaId, "estat", inc.estat, "resolta");
  return inc;
}

// ---------------------------------------------------------------- webhook

type Adjunt = { tipus: "foto" | "audio" | "video" | "altre"; file_id: string; mida?: number; mime?: string };

// deno-lint-ignore no-explicit-any
function adjuntsDe(m: any): Adjunt[] {
  const out: Adjunt[] = [];
  if (m.photo?.length) {
    const g = m.photo[m.photo.length - 1];
    out.push({ tipus: "foto", file_id: g.file_id, mida: g.file_size, mime: "image/jpeg" });
  }
  if (m.voice) out.push({ tipus: "audio", file_id: m.voice.file_id, mida: m.voice.file_size, mime: m.voice.mime_type ?? "audio/ogg" });
  if (m.audio) out.push({ tipus: "audio", file_id: m.audio.file_id, mida: m.audio.file_size, mime: m.audio.mime_type ?? "audio/mpeg" });
  if (m.video) out.push({ tipus: "video", file_id: m.video.file_id, mida: m.video.file_size, mime: m.video.mime_type ?? "video/mp4" });
  if (m.video_note) out.push({ tipus: "video", file_id: m.video_note.file_id, mida: m.video_note.file_size, mime: "video/mp4" });
  if (m.document) out.push({ tipus: "altre", file_id: m.document.file_id, mida: m.document.file_size, mime: m.document.mime_type });
  return out;
}

// deno-lint-ignore no-explicit-any
async function rebreMissatge(m: any, update: unknown) {
  if (GROUP_ID && String(m.chat.id) !== GROUP_ID) return;
  if (m.from?.is_bot) return;
  const p = await persona(m.from);
  const text = m.text ?? m.caption ?? null;
  const respostaA = m.reply_to_message?.message_id ?? null;

  const { data: fila, error } = await db.from("missatges").upsert({
    autor_id: p?.id ?? null, tg_xat_id: m.chat.id, tg_missatge_id: m.message_id,
    tg_autor_id: m.from?.id ?? null, tg_resposta_a: respostaA, text, cru: update,
  }, { onConflict: "tg_xat_id,tg_missatge_id", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) throw error;
  if (!fila) return; // duplicat

  const adjunts = adjuntsDe(m);
  if (adjunts.length) {
    await db.from("adjunts").insert(adjunts.map((a) => ({
      missatge_id: fila.id, tipus: a.tipus, tg_file_id: a.file_id, mida_bytes: a.mida ?? null,
    })));
  }

  // Camí ràpid: "fet" en resposta a un avís o a una confirmació del bot.
  if (text && FET.test(text) && !adjunts.some((a) => a.tipus !== "foto")) {
    const ref = await incidenciaDeResposta(m.chat.id, respostaA);
    if (ref?.incId) {
      const repassar = /repass|repase/i.test(text);
      const nota = text.trim().split(/\s+/).length > 2 ? text.trim() : null;
      const inc = await resoldre(ref.incId, p?.id ?? null, nota, repassar);
      await db.from("missatges").update({ processat: true, incidencia_id: ref.incId }).eq("id", fila.id);
      if (inc) {
        await enviar(m.chat.id, `✔ Incidència #${ref.incId} resolta.${repassar ? " Cal repassar-la." : ""}`,
          m.message_id, ref.incId, "resolta");
      }
    }
  }
}

// deno-lint-ignore no-explicit-any
async function rebreBoto(q: any) {
  const [tipus, idText] = String(q.data ?? "").split(":");
  const incId = Number(idText);
  const xat = q.message?.chat?.id;
  const p = await persona(q.from);
  const qui = p?.nom ?? "algú";
  const { data: inc } = await db.from("incidencies").select("*").eq("id", incId).maybeSingle();
  if (!inc || !xat) {
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: "No trobo aquesta incidència." });
    return;
  }

  if (tipus === "r" || tipus === "a") {
    if (inc.estat === "resolta" || inc.estat === "anullada") {
      await tg("answerCallbackQuery", { callback_query_id: q.id, text: `Ja estava ${inc.estat === "resolta" ? "resolta" : "anul·lada"}.` });
      return;
    }
    if (tipus === "r") await resoldre(incId, p?.id ?? null, null, false);
    else {
      await db.from("incidencies").update({ estat: "anullada" }).eq("id", incId);
      await historial(incId, p?.id ?? null, "estat", inc.estat, "anullada");
    }
    const marca = tipus === "r" ? `✔ Resolta per ${qui}` : `✖ Anul·lada per ${qui}`;
    await tg("editMessageText", {
      chat_id: xat, message_id: q.message.message_id, text: `${q.message.text}\n\n${marca}`,
    });
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: tipus === "r" ? "Resolta" : "Anul·lada" });
    return;
  }

  if (tipus === "c") {
    await enviar(xat,
      `✏ Què cal corregir de la #${incId}? Respon a aquest missatge, per exemple: «és la 204», «és urgent» o «és l'aixeta, no la cisterna».`,
      q.message.message_id, incId, "correccio",
      { reply_markup: { force_reply: true, selective: true, input_field_placeholder: "Correcció" } });
    await tg("answerCallbackQuery", { callback_query_id: q.id });
  }
}

// ---------------------------------------------------------------- processament amb IA

// deno-lint-ignore no-explicit-any
type Msg = any;

async function processar(): Promise<Record<string, unknown>> {
  const { data: pendents, error } = await db.rpc("reclamar_pendents", { espera_segons: ESPERA_SEGONS });
  if (error) throw error;
  if (!pendents?.length) return { grups: 0 };

  const grups = new Map<string, Msg[]>();
  for (const m of pendents as Msg[]) {
    const k = `${m.tg_xat_id}:${m.tg_autor_id}`;
    grups.set(k, [...(grups.get(k) ?? []), m]);
  }
  const llistaZones = await zones();
  let fets = 0;
  for (const msgs of grups.values()) {
    msgs.sort((a: Msg, b: Msg) => a.tg_missatge_id - b.tg_missatge_id);
    try {
      await processarGrup(msgs, llistaZones);
      fets++;
    } catch (e) {
      console.error("grup", e);
      await db.from("missatges").update({ error: String(e).slice(0, 1000) }).in("id", msgs.map((m: Msg) => m.id));
      await enviar(msgs[0].tg_xat_id, "⚠ No he pogut llegir aquest avís. Torna-ho a enviar, si us plau.",
        msgs[msgs.length - 1].tg_missatge_id, null, "error");
    }
  }
  return { grups: grups.size, processats: fets };
}

function capcalera(llistaZones: Zona[], obertes: Inc[], autor: string, data?: string, conversa = ""): string {
  const zonaPerId = new Map(llistaZones.map((z) => [z.id, z]));
  const ara = data ?? new Date().toLocaleString("ca-ES", { timeZone: "Europe/Madrid" });
  return `Data i hora: ${ara}\n\nZONES (nom exacte; àlies entre parèntesis):\n` +
    llistaZones.map((z) => z.alies.length ? `${z.nom} (${z.alies.join(", ")})` : z.nom).join("; ") +
    `\n\nINCIDÈNCIES OBERTES:\n` +
    (obertes.map((i: Inc) =>
      `#${i.id} · ${nomZona(zonaPerId.get(i.zona_id), i.zona_text)} · ${i.categoria} · ${i.prioritat} · ${i.estat} · ${i.descripcio}`
    ).join("\n") || "(cap)") +
    `\n\nCONVERSA RECENT DEL GRUP (només context, ja processada; no en creïs incidències):\n${conversa || "(res)"}` +
    `\n\nMISSATGES NOUS de ${autor} (numerats):\n`;
}

// Darrers missatges del grup (3 hores), perquè la IA entengui "ja està", "i la de dalt?", etc.
async function conversaRecent(xat: number, excloure: number[]): Promise<string> {
  const desde = new Date(Date.now() - 3 * 3600e3).toISOString();
  const { data } = await db.from("missatges").select("id, text, incidencia_id, rebut_el, persones(nom)")
    .eq("tg_xat_id", xat).eq("processat", true).gte("rebut_el", desde)
    .order("rebut_el", { ascending: false }).limit(12);
  // deno-lint-ignore no-explicit-any
  return (data ?? []).filter((m: any) => !excloure.includes(m.id) && m.text).reverse().map((m: any) =>
    `- ${m.persones?.nom ?? "algú"}: ${String(m.text).slice(0, 200)}${m.incidencia_id ? ` (→ #${m.incidencia_id})` : ""}`
  ).join("\n");
}

// Quantes vegades ha fallat el mateix (zona i categoria) els últims 30 dies, sense comptar aquesta.
async function repeticions(inc: Inc): Promise<number> {
  if (!inc.zona_id) return 0;
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const { count } = await db.from("incidencies").select("id", { count: "exact", head: true })
    .eq("zona_id", inc.zona_id).eq("categoria", inc.categoria).neq("id", inc.id)
    .neq("estat", "anullada").gte("creada_el", desde);
  return count ?? 0;
}

async function processarGrup(msgs: Msg[], llistaZones: Zona[]) {
  const xat = msgs[0].tg_xat_id;
  const { data: autor } = await db.from("persones").select("id, nom").eq("id", msgs[0].autor_id).maybeSingle();

  const { data: obertes } = await db.from("incidencies")
    .select("id, zona_id, zona_text, categoria, prioritat, estat, descripcio, creada_el")
    .not("estat", "in", "(resolta,anullada)").order("creada_el", { ascending: false }).limit(80);
  const zonaPerId = new Map(llistaZones.map((z) => [z.id, z]));

  const conversa = await conversaRecent(xat, msgs.map((m: Msg) => m.id));
  let ctx = capcalera(llistaZones, obertes ?? [], autor?.nom ?? "algú", undefined, conversa);

  const parts: Part[] = [];
  for (let n = 0; n < msgs.length; n++) {
    const m = msgs[n];
    const ref = await incidenciaDeResposta(xat, m.tg_resposta_a);
    let linia = `[${n}] ${m.text ?? "(sense text)"}`;
    if (ref?.incId && ref.tipus === "correccio") {
      linia += `  ← CORRECCIÓ de la incidència #${ref.incId}: aplica-la amb "actualitzar" i omple només els camps que canvien.`;
    } else if (ref?.incId) {
      linia += `  ← respon a la incidència #${ref.incId}`;
    } else if (ref?.tipus === "pregunta") {
      linia += `  ← respon a la pregunta del bot: «${ref.textBot}»`;
    } else if (ref?.tipus === "missatge") {
      linia += `  ← respon al missatge: «${ref.textBot}»`;
    }
    const { data: adj } = await db.from("adjunts").select("*").eq("missatge_id", m.id);
    for (const a of adj ?? []) {
      linia += ` [adjunt: ${a.tipus}]`;
      if (a.tipus === "altre") continue;
      if ((a.mida_bytes ?? 0) > 14_000_000) { linia += " (massa gran per analitzar)"; continue; }
      const f = await descarregar(a.tg_file_id);
      if (!f) { linia += " (no s'ha pogut baixar)"; continue; }
      const ext = f.ruta.split(".").pop() ?? "bin";
      const mime = a.tipus === "foto" ? "image/jpeg" : a.tipus === "audio" ? "audio/ogg" : "video/mp4";
      const ruta = `${xat}/${m.tg_missatge_id}_${a.id}.${ext}`;
      await db.storage.from("adjunts").upload(ruta, f.bytes, { contentType: mime, upsert: true });
      await db.from("adjunts").update({ ruta_storage: ruta }).eq("id", a.id);
      parts.push({ text: `Adjunt del missatge [${n}]:` });
      parts.push({ inlineData: { mimeType: mime, data: b64(f.bytes) } });
    }
    ctx += linia + "\n";
  }

  const accions = await interpretar(ctx, parts);
  const darrer = msgs[msgs.length - 1].tg_missatge_id;
  const respostaPer = (a: Accio) => {
    const idx = (a.missatges ?? []).filter((i) => i >= 0 && i < msgs.length);
    return idx.length ? msgs[Math.max(...idx)].tg_missatge_id : darrer;
  };
  const vincular = async (a: Accio, incId: number) => {
    const idx = (a.missatges ?? []).filter((i) => i >= 0 && i < msgs.length);
    const ids = (idx.length ? idx.map((i) => msgs[i].id) : msgs.map((m: Msg) => m.id));
    await db.from("missatges").update({ incidencia_id: incId }).in("id", ids);
  };

  for (const a of accions) {
    if (a.accio === "nova") {
      const z = trobarZona(llistaZones, a.zona);
      const fila = {
        zona_id: z?.id ?? null, zona_text: z ? null : (a.zona ?? null),
        categoria: a.categoria ?? "altres", prioritat: a.prioritat ?? "mitjana",
        descripcio: a.descripcio ?? "(sense descripció)", observacions: a.nota ?? null,
        reportada_per: autor?.id ?? null, ia_categoria: a.categoria ?? null, ia_prioritat: a.prioritat ?? null,
        ia_model: MODEL, tg_xat_id: xat,
      };
      const { data: inc, error } = await db.from("incidencies").insert(fila).select("*").single();
      if (error) throw error;
      await historial(inc.id, autor?.id ?? null, "estat", null, "oberta");
      await vincular(a, inc.id);
      const abans = await repeticions(inc);
      const avisRepetida = abans > 0
        ? `\n🔁 ${abans + 1}a vegada en 30 dies: ${NOM_CATEGORIA[inc.categoria]?.toLowerCase() ?? inc.categoria} a ${nomZona(z)}`
        : "";
      const conf = await enviar(xat, `🆕 Incidència #${inc.id} registrada\n${resum(inc, z)}${avisRepetida}`, respostaPer(a), inc.id,
        "confirmacio", { reply_markup: botons(inc.id) });
      if (conf) await db.from("incidencies").update({ tg_confirmacio_id: conf }).eq("id", inc.id);
    } else if (a.accio === "actualitzar" && a.incidencia_id) {
      const { data: inc } = await db.from("incidencies").select("*").eq("id", a.incidencia_id).maybeSingle();
      if (!inc) continue;
      const canvis: Record<string, unknown> = {};
      const z = a.zona ? trobarZona(llistaZones, a.zona) : undefined;
      if (a.zona && (z?.id ?? null) !== inc.zona_id) { canvis.zona_id = z?.id ?? null; canvis.zona_text = z ? null : a.zona; }
      if (a.categoria && a.categoria !== inc.categoria) canvis.categoria = a.categoria;
      if (a.prioritat && a.prioritat !== inc.prioritat) canvis.prioritat = a.prioritat;
      if (a.descripcio && a.descripcio !== inc.descripcio) canvis.descripcio = a.descripcio;
      if (a.nota) canvis.observacions = [inc.observacions, a.nota].filter(Boolean).join("\n");
      if (Object.keys(canvis).length) {
        await db.from("incidencies").update(canvis).eq("id", inc.id);
        for (const [k, v] of Object.entries(canvis)) if (k !== "observacions") await historial(inc.id, autor?.id ?? null, k, inc[k], v);
      }
      await vincular(a, inc.id);
      const nou = { ...inc, ...canvis };
      const corregit = ["zona_id", "zona_text", "categoria", "prioritat", "descripcio"].some((k) => k in canvis);
      await enviar(xat,
        corregit ? `✏ Incidència #${inc.id} corregida\n${resum(nou, zonaPerId.get(nou.zona_id))}`
          : `📎 Afegit a la incidència #${inc.id}.`,
        respostaPer(a), inc.id, "actualitzacio", corregit ? { reply_markup: botons(inc.id) } : {});
    } else if (a.accio === "resoldre" && a.incidencia_id) {
      const repassar = /repass/i.test(a.nota ?? "");
      const inc = await resoldre(a.incidencia_id, autor?.id ?? null, a.nota ?? null, repassar);
      await vincular(a, a.incidencia_id);
      if (inc) {
        await enviar(xat, `✔ Incidència #${a.incidencia_id} resolta.${repassar ? " Cal repassar-la." : ""}`,
          respostaPer(a), a.incidencia_id, "resolta");
      }
    } else if (a.accio === "preguntar" && a.pregunta) {
      await enviar(xat, `❓ ${a.pregunta}`, respostaPer(a), a.incidencia_id ?? null, "pregunta");
    }
  }
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// ---------------------------------------------------------------- resum del matí

const HORA_RESUM = Number(Deno.env.get("RESUM_HORA") ?? "8");
const ORDRE_PRIORITAT: Record<string, number> = { urgent: 0, alta: 1, mitjana: 2, baixa: 3 };

async function resumDiari(forcar: boolean): Promise<Record<string, unknown>> {
  const hora = Number(new Date().toLocaleString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }));
  if (!forcar && hora !== HORA_RESUM) return { enviat: false, motiu: `no és l'hora (${hora} h)` };

  let xat = GROUP_ID ? Number(GROUP_ID) : null;
  if (!xat) {
    const { data } = await db.from("missatges").select("tg_xat_id").order("rebut_el", { ascending: false }).limit(1).maybeSingle();
    xat = data?.tg_xat_id ?? null;
  }
  if (!xat) return { enviat: false, motiu: "cap grup conegut" };
  // Com a molt un resum cada 50 minuts, encara que algú cridi la URL.
  const { count: recents } = await db.from("missatges_bot").select("id", { count: "exact", head: true })
    .eq("tipus", "resum").gte("creat_el", new Date(Date.now() - 50 * 60e3).toISOString());
  if (recents) return { enviat: false, motiu: "ja s'ha enviat fa poc" };

  const llistaZones = await zones();
  const zonaPerId = new Map(llistaZones.map((z) => [z.id, z]));
  const { data: obertes } = await db.from("incidencies").select("*")
    .not("estat", "in", "(resolta,anullada)").order("creada_el");
  const llista = (obertes ?? []).sort((a: Inc, b: Inc) =>
    (ORDRE_PRIORITAT[a.prioritat] ?? 9) - (ORDRE_PRIORITAT[b.prioritat] ?? 9));

  const dies = (d: string) => {
    const n = Math.floor((Date.now() - Date.parse(d)) / 864e5);
    return n === 0 ? "avui" : n === 1 ? "ahir" : `fa ${n} dies`;
  };
  const marca: Record<string, string> = { urgent: "🔴", alta: "🟠", mitjana: "🟡", baixa: "⚪" };
  const espera: Record<string, string> = { esperant_material: " · esperant material", proveidor_extern: " · proveïdor extern" };

  let text: string;
  if (!llista.length) {
    text = "☀ Bon dia! Cap incidència pendent. 👌";
  } else {
    text = `☀ Bon dia! Hi ha ${llista.length} ${llista.length === 1 ? "incidència pendent" : "incidències pendents"}:\n\n` +
      llista.slice(0, 30).map((i: Inc) =>
        `${marca[i.prioritat] ?? "•"} #${i.id} ${nomZona(zonaPerId.get(i.zona_id), i.zona_text)} · ${i.descripcio} (${dies(i.creada_el)})${espera[i.estat] ?? ""}`
      ).join("\n") +
      (llista.length > 30 ? `\n… i ${llista.length - 30} més.` : "");
  }
  await enviar(xat, text, null, null, "resum");
  return { enviat: true, pendents: llista.length };
}

// ---------------------------------------------------------------- examen amb casos reals (no publica res)

async function avaluar(): Promise<Record<string, unknown>> {
  const { data: casos, error } = await db.rpc("reclamar_avaluacio", { n: 8 });
  if (error) throw error;
  if (!casos?.length) return { fets: 0 };
  const llistaZones = await zones();
  await Promise.all((casos as Msg[]).map(async (c) => {
    const linies = String(c.text).split("\n").map((l, n) => `[${n}] ${l}`).join("\n");
    // Context: els casos anteriors de les 3 hores prèvies, com tindria el bot de veritat.
    const desde = new Date(new Date(c.data).getTime() - 3 * 3600e3).toISOString();
    const { data: abans } = await db.from("avaluacio_casos").select("rol, text")
      .lt("data", c.data).gte("data", desde).order("data", { ascending: false }).limit(6);
    const conversa = (abans ?? []).reverse()
      .map((a: { rol: string; text: string }) => `- ${a.rol}: ${String(a.text).replaceAll("\n", " / ").slice(0, 200)}`)
      .join("\n");
    const ctx = capcalera(llistaZones, [], c.rol, new Date(c.data).toLocaleString("ca-ES"), conversa) + linies;
    try {
      const accions = await interpretar(ctx, []);
      await db.from("avaluacio_casos").update({ accions, model: MODEL, fet_el: new Date().toISOString(), error: null }).eq("id", c.id);
    } catch (e) {
      await db.from("avaluacio_casos").update({ error: String(e).slice(0, 500), model: MODEL }).eq("id", c.id);
    }
  }));
  return { fets: casos.length };
}

// ---------------------------------------------------------------- configuració

async function configurar(): Promise<Response> {
  const res = await tg("setWebhook", {
    url: `${SUPABASE_URL}/functions/v1/telegram-webhook`,
    secret_token: await secretWebhook(),
    allowed_updates: ["message", "edited_message", "callback_query"],
  });
  const info = await tg("getWebhookInfo");
  const jo = await tg("getMe");
  return Response.json({
    setWebhook: { ok: res.ok, description: res.description },
    bot: jo.result ? { username: jo.result.username, llegeix_tot_el_grup: jo.result.can_read_all_group_messages } : jo,
    webhook: info.result
      ? { url: info.result.url, pendents: info.result.pending_update_count, ultim_error: info.result.last_error_message ?? null }
      : info,
  });
}

// ---------------------------------------------------------------- servidor

Deno.serve(async (req) => {
  if (!BOT_TOKEN) return new Response("falta TELEGRAM_BOT_TOKEN", { status: 500 });
  const url = new URL(req.url);
  const accio = url.searchParams.get("accio");

  if (accio === "configurar") return await configurar();
  if (accio === "models") return Response.json({ model_actual: MODEL, disponibles: await llistarModels() });
  const tasques: Record<string, () => Promise<Record<string, unknown>>> = {
    processar,
    resum: () => resumDiari(url.searchParams.get("forcar") === "1"),
    avaluar,
  };
  if (accio && tasques[accio]) {
    try {
      return Response.json(await tasques[accio]());
    } catch (e) {
      console.error(accio, e);
      return new Response("error", { status: 500 });
    }
  }
  if (req.method !== "POST") return new Response("ok");

  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== (await secretWebhook())) {
    return new Response("forbidden", { status: 403 });
  }
  const update = await req.json();
  try {
    if (update.callback_query) await rebreBoto(update.callback_query);
    else if (update.message) await rebreMissatge(update.message, update);
  } catch (e) {
    console.error("webhook", e);
    return new Response("error", { status: 500 }); // Telegram ho tornarà a enviar
  }
  return new Response("ok");
});
