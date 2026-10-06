// Entrada de missatges de Telegram.
// Fase 0: valida l'origen, desa el missatge i els adjunts tal com arriben, i respon 200.
// La interpretació amb IA i la confirmació al grup s'afegeixen a la fase 1.
// Pendent de provar contra un projecte real.

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")!;
const GROUP_ID = Deno.env.get("TELEGRAM_GROUP_ID");

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
  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const update = await req.json();
  const m = update.message;
  // Només missatges nous del grup configurat; la resta s'ignora.
  if (!m || (GROUP_ID && String(m.chat.id) !== GROUP_ID)) {
    return new Response("ok");
  }

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
