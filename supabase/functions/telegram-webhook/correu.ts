// Resum de manteniment per correu (SMTP del hosting de l'hotel).
// La contrasenya és el secret SMTP_PASSWORD; la resta de dades són a la taula "ajustos" (editable des del panell).

import nodemailer from "npm:nodemailer@6.9.16";

export const PANELL_URL = Deno.env.get("PANELL_URL") ?? "https://manteniment.hotelrull.com/";

export type Ajustos = {
  resum_telegram_actiu: boolean;
  resum_telegram_hora: number;
  resum_correu_actiu: boolean;
  resum_correu_hora: number;
  resum_correu_dies: number[];
  resum_correu_destinataris: string[];
  resum_correu_pendents: boolean;
  resum_correu_resoltes_ahir: boolean;
  resum_correu_preventiu: boolean;
  resum_correu_darrer: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_usuari: string;
  smtp_remitent: string;
};

export type FilaResum = { id: number; lloc: string; descripcio: string; prioritat: string; estat: string; dies: string; cost?: number | null };
export type TascaResum = { tasca: string; lloc: string; quan: string; responsable: string | null };

const PRIO: Record<string, { nom: string; color: string }> = {
  urgent: { nom: "Urgent", color: "#B3261E" },
  alta: { nom: "Alta", color: "#C0532E" },
  mitjana: { nom: "Mitjana", color: "#94702F" },
  baixa: { nom: "Baixa", color: "#7A8794" },
};
const ESTAT: Record<string, string> = {
  oberta: "Pendent", en_curs: "En curs", esperant_material: "Esperant material", proveidor_extern: "Proveïdor extern",
  resolta: "Resolta", anullada: "Anul·lada",
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function taula(files: FilaResum[], ambCost = false): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
${files.map((f) => `<tr>
  <td width="48" style="padding:8px 8px 8px 0;border-bottom:1px solid #E6DED4;white-space:nowrap;vertical-align:top"><a href="${PANELL_URL}#/incidencies/${f.id}" style="color:#004B85">#${f.id}</a></td>
  <td width="130" style="padding:8px;border-bottom:1px solid #E6DED4;vertical-align:top;font-weight:600">${esc(f.lloc)}</td>
  <td style="padding:8px;border-bottom:1px solid #E6DED4;vertical-align:top">${esc(f.descripcio)}
    <div style="font-size:12px;color:#5A6878">${ambCost
      ? (f.cost ? `${Number(f.cost).toLocaleString("ca-ES", { style: "currency", currency: "EUR" })}` : "")
      : `<span style="color:${PRIO[f.prioritat]?.color ?? "#5A6878"};font-weight:700">${PRIO[f.prioritat]?.nom ?? f.prioritat}</span> · ${ESTAT[f.estat] ?? f.estat} · ${esc(f.dies)}`}</div></td>
</tr>`).join("")}
</table>`;
}

function seccio(titol: string, cos: string): string {
  return `<h2 style="font-size:13px;letter-spacing:.07em;text-transform:uppercase;color:#004B85;margin:28px 0 8px">${titol}</h2>${cos}`;
}

export function construirResum(dades: {
  data: string; pendents: FilaResum[]; resoltesAhir: FilaResum[]; preventiu: TascaResum[]; a: Ajustos;
}): { assumpte: string; html: string; text: string } {
  const { data, pendents, resoltesAhir, preventiu, a } = dades;
  const urgents = pendents.filter((p) => p.prioritat === "urgent" || p.prioritat === "alta");
  const resta = pendents.filter((p) => !(p.prioritat === "urgent" || p.prioritat === "alta"));
  const assumpte = `Manteniment · ${data} · ${pendents.length} ${pendents.length === 1 ? "pendent" : "pendents"}` +
    (urgents.length ? ` (${urgents.length} ${urgents.length === 1 ? "urgent o alta" : "urgents o altes"})` : "");

  let cos = `<p style="margin:0 0 4px;font-size:15px">Bon dia! Aquest és el resum de manteniment de ${esc(data)}.</p>`;
  if (a.resum_correu_pendents) {
    cos += pendents.length === 0
      ? seccio("Pendents", `<p style="margin:0">Cap incidència pendent. 👌</p>`)
      : (urgents.length ? seccio(`Urgents i altes · ${urgents.length}`, taula(urgents)) : "") +
        (resta.length ? seccio(`Altres pendents · ${resta.length}`, taula(resta)) : "");
  }
  if (a.resum_correu_resoltes_ahir) {
    cos += seccio(`Resoltes ahir · ${resoltesAhir.length}`,
      resoltesAhir.length ? taula(resoltesAhir, true) : `<p style="margin:0;color:#5A6878">Cap.</p>`);
  }
  if (a.resum_correu_preventiu && preventiu.length) {
    cos += seccio(`Preventiu dels propers 7 dies · ${preventiu.length}`,
      `<ul style="margin:0;padding-left:18px;font-size:14px">${preventiu.map((t) =>
        `<li style="margin:4px 0"><strong>${esc(t.tasca)}</strong> · ${esc(t.lloc)} · ${esc(t.quan)}${t.responsable ? ` · ${esc(t.responsable)}` : ""}</li>`).join("")}</ul>`);
  }

  const html = `<!doctype html><html lang="ca"><body style="margin:0;background:#F8F4EF;font-family:'Open Sans',Arial,sans-serif;color:#1C2B3A">
<div style="max-width:640px;margin:0 auto;background:#fff">
  <div style="background:#004B85;padding:22px;text-align:center;color:#E88766;font-weight:800;letter-spacing:.3em;font-size:13px">HOTEL RULL · MANTENIMENT</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr style="height:5px">
    <td width="60%" style="background:#004B85;font-size:0;line-height:0">&nbsp;</td><td width="10%" style="background:#E88766;font-size:0">&nbsp;</td>
    <td width="10%" style="background:#B8C8AE;font-size:0">&nbsp;</td><td width="10%" style="background:#F0C5B5;font-size:0">&nbsp;</td>
    <td width="10%" style="background:#E2C49E;font-size:0">&nbsp;</td></tr></table>
  <div style="padding:24px">${cos}
    <p style="text-align:center;margin:32px 0 8px"><a href="${PANELL_URL}" style="background:#004B85;color:#fff;text-decoration:none;padding:12px 24px;border-radius:4px;font-weight:600;display:inline-block">Obrir el panell</a></p>
    <p style="font-size:12px;color:#5A6878;text-align:center;margin:16px 0 0">Ho rebeu perquè sou a la llista del resum diari. Es canvia a Configuració del panell.</p>
  </div>
</div></body></html>`;

  const linia = (f: FilaResum) => `#${f.id} ${f.lloc} · ${f.descripcio} (${PRIO[f.prioritat]?.nom ?? f.prioritat}, ${ESTAT[f.estat] ?? f.estat}, ${f.dies})`;
  const text = [
    `Resum de manteniment · ${data}`, "",
    ...(a.resum_correu_pendents ? [`PENDENTS (${pendents.length})`, ...pendents.map(linia), ""] : []),
    ...(a.resum_correu_resoltes_ahir ? [`RESOLTES AHIR (${resoltesAhir.length})`, ...resoltesAhir.map((f) => `#${f.id} ${f.lloc} · ${f.descripcio}`), ""] : []),
    ...(a.resum_correu_preventiu && preventiu.length ? ["PREVENTIU (7 DIES)", ...preventiu.map((t) => `${t.tasca} · ${t.lloc} · ${t.quan}`), ""] : []),
    `Panell: ${PANELL_URL}`,
  ].join("\n");
  return { assumpte, html, text };
}

export async function enviarCorreu(a: Ajustos, a_qui: string[], assumpte: string, html: string, text: string) {
  const contrasenya = Deno.env.get("SMTP_PASSWORD");
  if (!contrasenya) throw new Error("Falta el secret SMTP_PASSWORD a Supabase (Edge Functions → Secrets).");
  if (!a_qui.length) throw new Error("No hi ha cap destinatari.");
  const transport = nodemailer.createTransport({
    host: a.smtp_host, port: a.smtp_port, secure: a.smtp_port === 465,
    auth: { user: a.smtp_usuari, pass: contrasenya },
  });
  await transport.sendMail({
    from: { name: a.smtp_remitent, address: a.smtp_usuari },
    to: a_qui.join(", "),
    subject: assumpte, html, text,
  });
}
