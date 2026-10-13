// Entrada de missatges de Telegram.
//
// Fase 0: valida l'origen, desa el missatge i els adjunts tal com arriben, i respon 200.
// La interpretació amb IA i la confirmació al grup s'afegeixen a la fase 1.
//
// Secrets (Edge Functions > Secrets):
//   TELEGRAM_BOT_TOKEN   obligatori
//   TELEGRAM_GROUP_ID    opcional; si hi és, només s'accepten missatges d'aquest grup
//
// Configuració del webhook: cridar una vegada
//   GET <url de la funció>?accio=configurar
// La funció registra la seva pròpia URL a Telegram amb un secret derivat del token,
// de manera que cap clau ha de passar per cap persona.

import { createClient } from "jsr:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const GROUP_ID = Deno.env.get("TELEGRAM_GROUP_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function clauServei(): string {
  const noves = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (noves) {
    try {
      const k = JSON.parse(noves)["default"];
      if (k) return k;
    } catch { /* continua amb la clau antiga */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

const supabase = createClient(SUPABASE_URL, clauServei(), {
  auth: { persistSession: false },
});

// Secret del webhook derivat del token: Telegram l'envia a cada petició.
async function secretWebhook(): Promise<string> {
  const dades = new TextEncoder().encode(`${BOT_TOKEN}:webhook-hotel-rull`);
  const hash = await crypto.subtle.digest("SHA-256", dades);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function telegram(metode: string, cos: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${metode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cos),
  });
  return await r.json();
}

async function configurar(): Promise<Response> {
  const url = `${SUPABASE_URL}/functions/v1/telegram-webhook`;
  const res = await telegram("setWebhook", {
    url,
    secret_token: await secretWebhook(),
    allowed_updates: ["message", "edited_message", "callback_query"],
    drop_pending_updates: false,
  });
  const info = await telegram("getWebhookInfo", {});
  const jo = await telegram("getMe", {});
  // No es retorna cap secret: només l'estat.
  return Response.json({
    setWebhook: { ok: res.ok, description: res.description },
    bot: jo.result ? { username: jo.result.username, llegeix_tot_el_grup: jo.result.can_read_all_group_messages } : jo,
    webhook: info.result
      ? { url: info.result.url, pendents: info.result.pending_update_count, ultim_error: info.result.last_error_message ?? null }
      : info,
  });
}

type Adjunt = { tipus: "foto" | "audio" | "video" | "altre"; file_id: string; mida?: number };

// deno-lint-ignore no-explicit-any
function adjuntsDe(m: any): Adjunt[] {
  const out: Adjunt[] = [];
  if (m.photo?.length) {
    const gran = m.photo[m.photo.length - 1]; // la mida més gran
    out.push({ tipus: "foto", file_id: gran.file_id, mida: gran.file_size });
  }
  if (m.voice) out.push({ tipus: "audio", file_id: m.voice.file_id, mida: m.voice.file_size });
  if (m.audio) out.push({ tipus: "audio", file_id: m.audio.file_id, mida: m.audio.file_size });
  if (m.video) out.push({ tipus: "video", file_id: m.video.file_id, mida: m.video.file_size });
  if (m.video_note) out.push({ tipus: "video", file_id: m.video_note.file_id, mida: m.video_note.file_size });
  if (m.document) out.push({ tipus: "altre", file_id: m.document.file_id, mida: m.document.file_size });
  return out;
}

Deno.serve(async (req) => {
  if (!BOT_TOKEN) return new Response("falta TELEGRAM_BOT_TOKEN", { status: 500 });

  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("accio") === "configurar") {
    return await configurar();
  }
  if (req.method !== "POST") return new Response("ok");

  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== (await secretWebhook())) {
    return new Response("forbidden", { status: 403 });
  }

  const update = await req.json();
  const m = update.message ?? update.edited_message;
  if (!m) return new Response("ok"); // els botons (callback_query) arriben a la fase 1
  if (GROUP_ID && String(m.chat.id) !== GROUP_ID) return new Response("ok");

  const { data: fila, error } = await supabase
    .from("missatges")
    .upsert(
      {
        tg_xat_id: m.chat.id,
        tg_missatge_id: m.message_id,
        tg_autor_id: m.from?.id ?? null,
        tg_resposta_a: m.reply_to_message?.message_id ?? null,
        text: m.text ?? m.caption ?? null,
        cru: update,
      },
      { onConflict: "tg_xat_id,tg_missatge_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("missatges", error);
    // 500 perquè Telegram torni a enviar l'actualització.
    return new Response("error", { status: 500 });
  }

  const adjunts = adjuntsDe(m);
  if (fila && adjunts.length) {
    const { error: e2 } = await supabase.from("adjunts").insert(
      adjunts.map((a) => ({
        missatge_id: fila.id,
        tipus: a.tipus,
        tg_file_id: a.file_id,
        mida_bytes: a.mida ?? null,
      })),
    );
    if (e2) console.error("adjunts", e2);
  }

  return new Response("ok");
});
