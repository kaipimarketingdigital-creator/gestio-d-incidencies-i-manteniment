// Crides a l'API de bots de Telegram.

export const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

// deno-lint-ignore no-explicit-any
export async function tg(metode: string, cos: Record<string, unknown> = {}): Promise<any> {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${metode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cos),
  });
  const j = await r.json();
  if (!j.ok) console.error(`telegram ${metode}`, j.description);
  return j;
}

// Descarrega un fitxer de Telegram. Els bots no poden baixar fitxers de més de 20 MB.
export async function descarregar(fileId: string): Promise<{ bytes: Uint8Array; ruta: string } | null> {
  const info = await tg("getFile", { file_id: fileId });
  if (!info.ok || !info.result?.file_path) return null;
  const r = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${info.result.file_path}`);
  if (!r.ok) return null;
  return { bytes: new Uint8Array(await r.arrayBuffer()), ruta: info.result.file_path };
}

// Secret del webhook derivat del token: Telegram l'envia a cada petició.
export async function secretWebhook(): Promise<string> {
  const dades = new TextEncoder().encode(`${BOT_TOKEN}:webhook-hotel-rull`);
  const hash = await crypto.subtle.digest("SHA-256", dades);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function botons(id: number) {
  return {
    inline_keyboard: [[
      { text: "✔ Resolta", callback_data: `r:${id}` },
      { text: "✏ Corregir", callback_data: `c:${id}` },
      { text: "✖ Anul·lar", callback_data: `a:${id}` },
    ]],
  };
}
