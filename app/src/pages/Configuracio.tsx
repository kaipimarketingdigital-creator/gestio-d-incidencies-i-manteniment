import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { NavLink, Navigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSessio } from "../lib/sessio";
import { dataCurta, dataHora } from "../lib/incidencies";
import Usuaris from "./Usuaris";

const PESTANYES = [
  ["resum", "Resum diari"],
  ["zones", "Zones de l'hotel"],
  ["equip", "Equip de Telegram"],
  ["usuaris", "Usuaris del panell"],
] as const;

export default function Configuracio() {
  const { pestanya } = useParams();
  if (!PESTANYES.some(([k]) => k === pestanya)) return <Navigate to="/configuracio/resum" replace />;
  return (
    <>
      <div className="capcalera">
        <div>
          <h1>Configuració</h1>
          <span className="sub">Només la veu Direcció</span>
        </div>
      </div>
      <nav className="pestanyes" aria-label="Apartats de configuració">
        {PESTANYES.map(([k, nom]) => (
          <NavLink key={k} to={`/configuracio/${k}`} className={({ isActive }) => (isActive ? "activa" : undefined)}>{nom}</NavLink>
        ))}
      </nav>
      {pestanya === "resum" && <Resum />}
      {pestanya === "zones" && <Zones />}
      {pestanya === "equip" && <Equip />}
      {pestanya === "usuaris" && <Usuaris incrustat />}
    </>
  );
}

type Avis = { tipus: "ok" | "error" | "info"; text: string } | null;
const AvisCaixa = ({ avis }: { avis: Avis }) =>
  avis ? <p className={`avis ${avis.tipus}`} role={avis.tipus === "error" ? "alert" : "status"}>{avis.text}</p> : null;

// ---------------------------------------------------------------- resum diari (Telegram i correu)

type Ajustos = {
  resum_telegram_actiu: boolean; resum_telegram_hora: number;
  resum_correu_actiu: boolean; resum_correu_hora: number; resum_correu_dies: number[]; resum_correu_destinataris: string[];
  resum_correu_pendents: boolean; resum_correu_resoltes_ahir: boolean; resum_correu_preventiu: boolean;
  resum_correu_darrer: string | null;
  smtp_host: string; smtp_port: number; smtp_usuari: string; smtp_remitent: string;
  actualitzat_el: string; actualitzat_per: string | null;
};
const DIES: [number, string][] = [[1, "Dl"], [2, "Dt"], [3, "Dc"], [4, "Dj"], [5, "Dv"], [6, "Ds"], [7, "Dg"]];
const HORES = Array.from({ length: 18 }, (_, k) => k + 6); // 6:30 … 23:30
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function Resum() {
  const { usuari } = useSessio();
  const [a, setA] = useState<Ajustos | null>(null);
  const [nou, setNou] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avis, setAvis] = useState<Avis>(null);
  const [desant, setDesant] = useState(false);
  const [provant, setProvant] = useState(false);
  const [falta, setFalta] = useState(false);

  useEffect(() => {
    supabase.from("ajustos").select("*").eq("id", 1).maybeSingle().then(({ data, error }) => {
      if (error || !data) setFalta(true);
      else setA(data as Ajustos);
    });
  }, []);

  if (falta) return <p className="avis error">Falta crear la taula de configuració a la base de dades (fitxer 0012_ajustos.sql).</p>;
  if (!a) return <p style={{ color: "var(--muted)" }}>Carregant…</p>;
  const posar = <K extends keyof Ajustos>(k: K, v: Ajustos[K]) => { setA({ ...a, [k]: v }); setAvis(null); };

  function afegir() {
    const e = nou.trim().toLowerCase();
    if (!e) return;
    if (!EMAIL.test(e)) return setErrors({ ...errors, nou: "Aquest correu no sembla vàlid." });
    if (a!.resum_correu_destinataris.includes(e)) return setErrors({ ...errors, nou: "Ja és a la llista." });
    posar("resum_correu_destinataris", [...a!.resum_correu_destinataris, e]);
    setNou("");
    setErrors({});
  }

  async function desar(ev: FormEvent) {
    ev.preventDefault();
    const e2: Record<string, string> = {};
    if (a!.resum_correu_actiu && a!.resum_correu_destinataris.length === 0) e2.nou = "Afegeix almenys un destinatari o desactiva el resum per correu.";
    if (a!.resum_correu_actiu && a!.resum_correu_dies.length === 0) e2.dies = "Tria almenys un dia.";
    if (!(a!.smtp_port > 0 && a!.smtp_port < 65536)) e2.port = "Port no vàlid (normalment 465).";
    setErrors(e2);
    if (Object.keys(e2).length) return;
    setDesant(true);
    const { actualitzat_el: _a, actualitzat_per: _b, resum_correu_darrer: _c, ...canvis } = a!;
    void _a; void _b; void _c;
    const { error } = await supabase.from("ajustos").update(canvis).eq("id", 1);
    setDesant(false);
    setAvis(error ? { tipus: "error", text: "No s'ha pogut desar. Torna-ho a provar." } : { tipus: "ok", text: "Configuració desada." });
  }

  async function prova() {
    setProvant(true);
    setAvis({ tipus: "info", text: "Enviant…" });
    const { data, error } = await supabase.functions.invoke("telegram-webhook", { body: { accio: "prova_correu", a: [usuari?.email] } });
    setProvant(false);
    if (error || data?.error) {
      let detall = data?.error as string | undefined;
      if (!detall && error && "context" in error) detall = (await (error.context as Response).json().catch(() => ({})))?.error;
      setAvis({ tipus: "error", text: `No s'ha pogut enviar la prova: ${detall ?? "error desconegut"}` });
    } else {
      setAvis({ tipus: "ok", text: `Prova enviada a ${usuari?.email}. Mira la safata d'entrada (i el correu brossa).` });
    }
  }

  return (
    <form className="config" onSubmit={desar}>
      <section className="targeta" aria-labelledby="t-tg">
        <h2 id="t-tg">Resum al grup de Telegram</h2>
        <label className="casella">
          <input type="checkbox" checked={a.resum_telegram_actiu} onChange={(e) => posar("resum_telegram_actiu", e.target.checked)} />
          Enviar cada matí la llista de pendents al grup
        </label>
        <label className="camp" style={{ maxWidth: 220 }}>Hora
          <select value={a.resum_telegram_hora} onChange={(e) => posar("resum_telegram_hora", Number(e.target.value))}>
            {HORES.map((h) => <option key={h} value={h}>{h}:30</option>)}
          </select>
        </label>
        <p className="buit">A aquesta mateixa hora es creen els avisos del manteniment preventiu que toquen, encara que el resum estigui desactivat.</p>
      </section>

      <section className="targeta" aria-labelledby="t-correu">
        <h2 id="t-correu">Resum per correu</h2>
        <label className="casella">
          <input type="checkbox" checked={a.resum_correu_actiu} onChange={(e) => posar("resum_correu_actiu", e.target.checked)} />
          Enviar un resum per correu
        </label>
        <fieldset className="camps" disabled={!a.resum_correu_actiu}>
          <div className="fila-camps">
            <label className="camp" style={{ maxWidth: 220 }}>Hora
              <select value={a.resum_correu_hora} onChange={(e) => posar("resum_correu_hora", Number(e.target.value))}>
                {HORES.map((h) => <option key={h} value={h}>{h}:30</option>)}
              </select>
            </label>
            <div className="camp">
              <span>Dies</span>
              <div className="dies" role="group" aria-label="Dies de la setmana" aria-describedby="e-dies">
                {DIES.map(([d, nom]) => (
                  <label key={d} className={a.resum_correu_dies.includes(d) ? "activa" : undefined}>
                    <input type="checkbox" checked={a.resum_correu_dies.includes(d)} onChange={(e) => {
                      posar("resum_correu_dies", e.target.checked ? [...a.resum_correu_dies, d].sort() : a.resum_correu_dies.filter((x) => x !== d));
                      setErrors({ ...errors, dies: "" });
                    }} />
                    {nom}
                  </label>
                ))}
              </div>
              {errors.dies && <span id="e-dies" className="error-camp">{errors.dies}</span>}
            </div>
          </div>

          <div className="camp">
            <span>Qui el rep</span>
            {a.resum_correu_destinataris.length > 0 && (
              <ul className="destinataris">
                {a.resum_correu_destinataris.map((d) => (
                  <li key={d}>{d}
                    <button type="button" aria-label={`Treure ${d}`} onClick={() => posar("resum_correu_destinataris", a.resum_correu_destinataris.filter((x) => x !== d))}>✕</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="fila-camps" style={{ alignItems: "flex-start" }}>
              <div className="camp" style={{ flex: "3 1 240px" }}>
                <input type="email" aria-label="Afegir un correu" placeholder="josep@hotelrull.com" value={nou}
                  aria-invalid={!!errors.nou} aria-describedby="e-nou"
                  onChange={(e) => { setNou(e.target.value); setErrors({ ...errors, nou: "" }); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); afegir(); } }} />
                {errors.nou && <span id="e-nou" className="error-camp">{errors.nou}</span>}
              </div>
              <button type="button" className="boto secundari" onClick={afegir}>Afegir</button>
            </div>
          </div>

          <div className="camp">
            <span>Què inclou</span>
            <label className="casella"><input type="checkbox" checked={a.resum_correu_pendents} onChange={(e) => posar("resum_correu_pendents", e.target.checked)} /> Incidències pendents (urgents i altes a dalt)</label>
            <label className="casella"><input type="checkbox" checked={a.resum_correu_resoltes_ahir} onChange={(e) => posar("resum_correu_resoltes_ahir", e.target.checked)} /> Resoltes ahir, amb el cost</label>
            <label className="casella"><input type="checkbox" checked={a.resum_correu_preventiu} onChange={(e) => posar("resum_correu_preventiu", e.target.checked)} /> Manteniment preventiu dels propers 7 dies</label>
          </div>
        </fieldset>

        <details className="plegable">
          <summary>Servidor de correu</summary>
          <div className="fila-camps">
            <label className="camp">Servidor
              <input value={a.smtp_host} onChange={(e) => posar("smtp_host", e.target.value.trim())} />
            </label>
            <label className="camp" style={{ maxWidth: 140 }}>Port
              <input inputMode="numeric" value={a.smtp_port} aria-invalid={!!errors.port}
                onChange={(e) => posar("smtp_port", Number(e.target.value.replace(/\D/g, "")))} />
              {errors.port && <span className="error-camp">{errors.port}</span>}
            </label>
          </div>
          <div className="fila-camps">
            <label className="camp">Compte (remitent)
              <input type="email" value={a.smtp_usuari} onChange={(e) => posar("smtp_usuari", e.target.value.trim())} />
            </label>
            <label className="camp">Nom que es veu
              <input value={a.smtp_remitent} onChange={(e) => posar("smtp_remitent", e.target.value)} />
            </label>
          </div>
          <p className="buit">La contrasenya no es desa aquí: és el secret <code>SMTP_PASSWORD</code> de Supabase (Edge Functions → Secrets).</p>
        </details>
      </section>

      <AvisCaixa avis={avis} />
      <div className="accions-peu">
        <button type="submit" className="boto" disabled={desant}>{desant ? "Desant…" : "Desar"}</button>
        <button type="button" className="boto secundari" disabled={provant} onClick={prova}>Enviar-me una prova ara</button>
        <span className="buit">
          {a.resum_correu_darrer && `Darrer resum per correu: ${dataCurta(a.resum_correu_darrer)}. `}
          Darrer canvi: {dataHora(a.actualitzat_el)}
        </span>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- zones

type ZonaC = { id: string; nom: string; tipus: "habitacio" | "comuna" | "tecnica"; planta: number | null; alies: string[]; activa: boolean };
const NOM_TIPUS = { habitacio: "Habitacions", comuna: "Zones comunes", tecnica: "Zones tècniques" } as const;

function Zones() {
  const [zones, setZones] = useState<ZonaC[] | null>(null);
  const [usos, setUsos] = useState<Map<string, number>>(new Map());
  const [editant, setEditant] = useState<Partial<ZonaC> & { aliesText?: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avis, setAvis] = useState<Avis>(null);
  const [filtre, setFiltre] = useState("");

  const carregar = useCallback(async () => {
    const [z, i, p] = await Promise.all([
      supabase.from("zones").select("id, nom, tipus, planta, alies, activa").order("nom"),
      supabase.from("incidencies").select("zona_id").not("zona_id", "is", null).limit(10000),
      supabase.from("manteniment_preventiu").select("zona_id").not("zona_id", "is", null),
    ]);
    setZones((z.data ?? []) as ZonaC[]);
    const m = new Map<string, number>();
    [...(i.data ?? []), ...(p.data ?? [])].forEach((x: { zona_id: string }) => m.set(x.zona_id, (m.get(x.zona_id) ?? 0) + 1));
    setUsos(m);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const grups = useMemo(() => {
    const t = filtre.trim().toLowerCase();
    const zs = (zones ?? []).filter((z) => !t || z.nom.toLowerCase().includes(t) || z.alies.some((x) => x.toLowerCase().includes(t)))
      .sort((a, b) => (a.planta ?? 99) - (b.planta ?? 99) || a.nom.localeCompare(b.nom, "ca", { numeric: true }));
    return (Object.keys(NOM_TIPUS) as ZonaC["tipus"][]).map((k) => [k, zs.filter((z) => z.tipus === k)] as const);
  }, [zones, filtre]);

  async function desar(ev: FormEvent) {
    ev.preventDefault();
    if (!editant) return;
    const nom = (editant.nom ?? "").trim();
    const e2: Record<string, string> = {};
    if (!nom) e2.nom = "Escriu el nom (per exemple 214 o Terrassa).";
    else if ((zones ?? []).some((z) => z.id !== editant.id && z.nom.toLowerCase() === nom.toLowerCase())) e2.nom = "Ja hi ha una zona amb aquest nom.";
    setErrors(e2);
    if (Object.keys(e2).length) return;
    const alies = (editant.aliesText ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const fila = { nom, tipus: editant.tipus ?? "habitacio", planta: editant.planta ?? null, alies };
    const { error } = editant.id
      ? await supabase.from("zones").update(fila).eq("id", editant.id)
      : await supabase.from("zones").insert({ ...fila, activa: true });
    setAvis(error ? { tipus: "error", text: "No s'ha pogut desar la zona." } : { tipus: "ok", text: editant.id ? `Zona «${nom}» desada.` : `Zona «${nom}» afegida.` });
    if (!error) setEditant(null);
    await carregar();
  }

  async function canviarActiva(z: ZonaC) {
    const { error } = await supabase.from("zones").update({ activa: !z.activa }).eq("id", z.id);
    setAvis(error ? { tipus: "error", text: "No s'ha pogut canviar." } : { tipus: "ok", text: z.activa ? `«${z.nom}» desactivada: el bot ja no la proposarà.` : `«${z.nom}» reactivada.` });
    await carregar();
  }
  async function esborrar(z: ZonaC) {
    if (!window.confirm(`Esborrar la zona «${z.nom}»?`)) return;
    const { error } = await supabase.from("zones").delete().eq("id", z.id);
    setAvis(error ? { tipus: "error", text: "No s'ha pogut esborrar (té incidències o tasques). Desactiva-la." } : { tipus: "ok", text: `Zona «${z.nom}» esborrada.` });
    await carregar();
  }

  const formulari = editant && (
    <form className="targeta formulari-zona" onSubmit={desar} aria-label={editant.id ? "Editar zona" : "Nova zona"}>
      <h2>{editant.id ? `Editar «${editant.nom}»` : "Nova zona"}</h2>
      <div className="fila-camps">
        <label className="camp">Nom
          <input value={editant.nom ?? ""} aria-invalid={!!errors.nom} aria-describedby="e-zona-nom" autoFocus
            onChange={(e) => { setEditant({ ...editant, nom: e.target.value }); setErrors({}); }} placeholder="214" />
          {errors.nom && <span id="e-zona-nom" className="error-camp">{errors.nom}</span>}
        </label>
        <label className="camp">Tipus
          <select value={editant.tipus ?? "habitacio"} onChange={(e) => setEditant({ ...editant, tipus: e.target.value as ZonaC["tipus"] })}>
            <option value="habitacio">Habitació</option>
            <option value="comuna">Zona comuna</option>
            <option value="tecnica">Zona tècnica</option>
          </select>
        </label>
        <label className="camp" style={{ maxWidth: 160 }}>Planta
          <select value={editant.planta ?? ""} onChange={(e) => setEditant({ ...editant, planta: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">—</option>
            {[0, 1, 2, 3, 4].map((p) => <option key={p} value={p}>{p === 0 ? "Baixa" : p}</option>)}
          </select>
        </label>
      </div>
      <label className="camp">Altres noms que fa servir l'equip (separats per comes)
        <input value={editant.aliesText ?? ""} onChange={(e) => setEditant({ ...editant, aliesText: e.target.value })} placeholder="rest nou, restaurant de dalt" />
      </label>
      <p className="buit">El bot reconeix la zona pel nom o per qualsevol d'aquests altres noms.</p>
      <div className="accions">
        <button type="submit" className="boto">{editant.id ? "Desar" : "Afegir zona"}</button>
        <button type="button" className="boto secundari" onClick={() => { setEditant(null); setErrors({}); }}>Cancel·lar</button>
      </div>
    </form>
  );

  return (
    <>
      <AvisCaixa avis={avis} />
      <div className="fila-camps" style={{ alignItems: "end" }}>
        <label className="camp" style={{ flex: "1 1 260px" }}>Cerca
          <input type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Nom o altre nom" />
        </label>
        <button type="button" className="boto" onClick={() => { setEditant({ tipus: "habitacio", aliesText: "" }); setErrors({}); }}>Nova zona</button>
      </div>
      {editant && !editant.id && formulari}
      {zones === null && <p style={{ color: "var(--muted)" }}>Carregant…</p>}
      {grups.map(([k, zs]) => zs.length > 0 && (
        <section key={k} className="targeta" aria-labelledby={`t-${k}`}>
          <h2 id={`t-${k}`}>{NOM_TIPUS[k]} <span className="comptador">{zs.length}</span></h2>
          <div className="taula-caixa">
            <table>
              <thead><tr><th>Nom</th><th>Planta</th><th>Altres noms</th><th>Estat</th><th></th></tr></thead>
              <tbody>
                {zs.map((z) => editant?.id === z.id ? (
                  <tr key={z.id}><td colSpan={5}>{formulari}</td></tr>
                ) : (
                  <tr key={z.id} className={z.activa ? undefined : "apagada"}>
                    <td><strong>{z.nom}</strong></td>
                    <td>{z.planta === null ? "—" : z.planta === 0 ? "Baixa" : z.planta}</td>
                    <td>{z.alies.length ? z.alies.join(", ") : <span className="buit">—</span>}</td>
                    <td><span className={`etiqueta ${z.activa ? "actiu" : "desactivat"}`}>{z.activa ? "Activa" : "Desactivada"}</span></td>
                    <td>
                      <div className="accions">
                        <button type="button" className="boto secundari petit" onClick={() => { setEditant({ ...z, aliesText: z.alies.join(", ") }); setErrors({}); }}>Editar</button>
                        {usos.get(z.id)
                          ? <button type="button" className="boto perill petit" onClick={() => canviarActiva(z)}>{z.activa ? "Desactivar" : "Reactivar"}</button>
                          : <button type="button" className="boto perill petit" onClick={() => esborrar(z)}>Esborrar</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- equip de Telegram

type PersonaC = { id: string; nom: string; rol: string | null; telegram_id: number | null; actiu: boolean; creat_el: string };
const ROLS_PERSONA: [string, string][] = [
  ["manteniment", "Manteniment"], ["pisos", "Pisos"], ["recepcio", "Recepció"], ["cuina", "Cuina"], ["direccio", "Direcció"], ["kaipi", "Kaipi (suport)"],
];

function Equip() {
  const [persones, setPersones] = useState<PersonaC[] | null>(null);
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [avis, setAvis] = useState<Avis>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("persones").select("id, nom, rol, telegram_id, actiu, creat_el").order("nom");
    setPersones((data ?? []) as PersonaC[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function canviar(p: PersonaC, canvis: Partial<PersonaC>, ok: string) {
    const { error } = await supabase.from("persones").update(canvis).eq("id", p.id);
    setAvis(error ? { tipus: "error", text: "No s'ha pogut desar." } : { tipus: "ok", text: ok });
    await carregar();
  }

  return (
    <>
      <p className="avis info">Les persones s'afegeixen soles el primer cop que escriuen al grup de Telegram. Aquí pots posar-los el nom com el coneixeu, el rol, i desactivar qui ja no hi és.</p>
      <AvisCaixa avis={avis} />
      <div className="taula-caixa targeta">
        <table>
          <thead><tr><th>Nom</th><th>Rol</th><th>Al grup des de</th><th>Estat</th><th></th></tr></thead>
          <tbody>
            {(persones ?? []).map((p) => {
              const nom = noms[p.id] ?? p.nom;
              return (
                <tr key={p.id} className={p.actiu ? undefined : "apagada"}>
                  <td>
                    <input className="input-taula" aria-label={`Nom de ${p.nom}`} value={nom}
                      onChange={(e) => setNoms({ ...noms, [p.id]: e.target.value })}
                      onBlur={() => { if (nom.trim() && nom.trim() !== p.nom) canviar(p, { nom: nom.trim() }, `Nom canviat a «${nom.trim()}».`); }} />
                  </td>
                  <td>
                    <select aria-label={`Rol de ${p.nom}`} value={p.rol ?? ""} onChange={(e) => canviar(p, { rol: e.target.value || null }, `Rol de ${p.nom} desat.`)}>
                      <option value="">Sense rol</option>
                      {ROLS_PERSONA.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                    </select>
                  </td>
                  <td className="xifra">{dataCurta(p.creat_el)}</td>
                  <td><span className={`etiqueta ${p.actiu ? "actiu" : "desactivat"}`}>{p.actiu ? "Actiu" : "Desactivat"}</span></td>
                  <td>
                    <button type="button" className="boto secundari petit" onClick={() => canviar(p, { actiu: !p.actiu }, p.actiu ? `${p.nom} desactivat: ja no surt per assignar tasques.` : `${p.nom} reactivat.`)}>
                      {p.actiu ? "Desactivar" : "Reactivar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
