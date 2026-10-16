import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase, NOM_ROL, NOM_ESTAT, type Rol, type Usuari } from "../lib/supabase";
import { useSessio } from "../lib/sessio";

const ROLS: Rol[] = ["direccio", "administracio", "manteniment"];
const ADRECA_PANELL = window.location.origin + window.location.pathname;

// Explica els errors de la base de dades amb paraules entenedores.
function explicar(missatge: string): string {
  if (/direcci/i.test(missatge)) return "Ha de quedar com a mínim una persona activa amb rol de Direcció.";
  if (/duplicate|unique/i.test(missatge)) return "Aquest correu ja és a la llista.";
  if (/check/i.test(missatge)) return "Cal triar un rol abans d'activar aquesta persona.";
  return "No s'ha pogut desar el canvi. Torna-ho a provar.";
}

function data(d: string | null) {
  return d ? new Date(d).toLocaleString("ca-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Mai";
}

export default function Usuaris() {
  const { usuari: jo } = useSessio();
  const [llista, setLlista] = useState<Usuari[]>([]);
  const [avis, setAvis] = useState<{ tipus: "ok" | "error"; text: string } | null>(null);
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [rol, setRol] = useState<Rol>("manteniment");
  const [desant, setDesant] = useState(false);
  const [rolAprovar, setRolAprovar] = useState<Record<string, Rol>>({});

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("usuaris_panell").select("*").order("creat_el");
    if (error) setAvis({ tipus: "error", text: "No s'ha pogut carregar la llista d'usuaris." });
    else setLlista((data ?? []) as Usuari[]);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function canviar(u: Usuari, canvis: Partial<Usuari>, ok: string) {
    const { error } = await supabase.from("usuaris_panell").update(canvis).eq("id", u.id);
    setAvis(error ? { tipus: "error", text: explicar(error.message) } : { tipus: "ok", text: ok });
    await carregar();
  }

  async function convidar(e: FormEvent) {
    e.preventDefault();
    setDesant(true);
    const correu = email.trim().toLowerCase();
    const { error } = await supabase.from("usuaris_panell").insert({
      email: correu, nom: nom.trim() || null, rol, estat: "convidat", convidat_per: jo?.id ?? null,
    });
    setDesant(false);
    if (error) {
      setAvis({ tipus: "error", text: explicar(error.message) });
      return;
    }
    setAvis({ tipus: "ok", text: `Invitació creada per a ${correu}. Envia-li l'adreça del panell: quan entri amb aquest correu, tindrà accés directament.` });
    setEmail(""); setNom(""); setRol("manteniment");
    await carregar();
  }

  async function esborrar(u: Usuari) {
    if (!window.confirm(`Esborrar la invitació de ${u.email}?`)) return;
    const { error } = await supabase.from("usuaris_panell").delete().eq("id", u.id);
    setAvis(error ? { tipus: "error", text: "No s'ha pogut esborrar." } : { tipus: "ok", text: "Invitació esborrada." });
    await carregar();
  }

  const pendents = llista.filter((u) => u.estat === "pendent");
  const resta = llista.filter((u) => u.estat !== "pendent");

  return (
    <>
      <div className="capcalera">
        <div>
          <h1>Usuaris</h1>
          <span className="sub">Qui pot entrar al panell i què hi pot fer</span>
        </div>
      </div>

      {avis && <p className={`avis ${avis.tipus}`} role={avis.tipus === "error" ? "alert" : "status"}>{avis.text}</p>}

      <section className="targeta" aria-labelledby="t-convidar">
        <h2 id="t-convidar">Convidar una persona</h2>
        <form className="formulari" onSubmit={convidar}>
          <label className="camp">Correu electrònic
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@hotelrull.com" />
          </label>
          <label className="camp">Nom
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nuria" />
          </label>
          <label className="camp">Rol
            <select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
              {ROLS.map((r) => <option key={r} value={r}>{NOM_ROL[r]}</option>)}
            </select>
          </label>
          <button className="boto" type="submit" disabled={desant}>{desant ? "Desant…" : "Convidar"}</button>
        </form>
        <div className="enllac-panell">
          <span style={{ fontSize: 14, color: "var(--muted)" }}>Adreça del panell per enviar:</span>
          <code>{ADRECA_PANELL}</code>
          <button type="button" className="boto secundari petit" onClick={() => {
            navigator.clipboard?.writeText(ADRECA_PANELL).then(() => setAvis({ tipus: "ok", text: "Adreça copiada." }));
          }}>Copiar</button>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Direcció ho veu i ho configura tot. Administració gestiona incidències i preventiu. Manteniment consulta i actualitza incidències.
        </p>
      </section>

      {pendents.length > 0 && (
        <section className="targeta" aria-labelledby="t-pendents">
          <h2 id="t-pendents">Pendents d'aprovació</h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>Han entrat amb un correu que no estava convidat. Tria'ls un rol per donar-los accés.</p>
          <div className="taula-caixa">
            <table>
              <thead><tr><th>Correu</th><th>Ha entrat</th><th>Rol</th><th></th></tr></thead>
              <tbody>
                {pendents.map((u) => {
                  const r = rolAprovar[u.id] ?? "manteniment";
                  return (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td className="xifra">{data(u.creat_el)}</td>
                      <td>
                        <select aria-label={`Rol per a ${u.email}`} value={r} onChange={(e) => setRolAprovar({ ...rolAprovar, [u.id]: e.target.value as Rol })}>
                          {ROLS.map((x) => <option key={x} value={x}>{NOM_ROL[x]}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className="accions">
                          <button className="boto petit" onClick={() => canviar(u, { estat: "actiu", rol: r }, `${u.email} ja té accés.`)}>Aprovar</button>
                          <button className="boto perill petit" onClick={() => canviar(u, { estat: "desactivat" }, `${u.email} no tindrà accés.`)}>Rebutjar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="targeta" aria-labelledby="t-equip">
        <h2 id="t-equip">Equip</h2>
        <div className="taula-caixa">
          <table>
            <thead><tr><th>Nom</th><th>Correu</th><th>Rol</th><th>Estat</th><th>Darrer accés</th><th></th></tr></thead>
            <tbody>
              {resta.map((u) => {
                const socJo = u.id === jo?.id;
                return (
                  <tr key={u.id}>
                    <td>{u.nom ?? "—"}{socJo && " (tu)"}</td>
                    <td>{u.email}</td>
                    <td>
                      <select aria-label={`Rol de ${u.email}`} value={u.rol ?? ""} disabled={u.estat === "desactivat"}
                        onChange={(e) => canviar(u, { rol: e.target.value as Rol }, `Rol de ${u.email} canviat a ${NOM_ROL[e.target.value as Rol]}.`)}>
                        {!u.rol && <option value="">—</option>}
                        {ROLS.map((x) => <option key={x} value={x}>{NOM_ROL[x]}</option>)}
                      </select>
                    </td>
                    <td><span className={`etiqueta ${u.estat}`}>{NOM_ESTAT[u.estat]}</span></td>
                    <td className="xifra">{data(u.darrer_acces)}</td>
                    <td>
                      <div className="accions">
                        {u.estat === "convidat" && !u.auth_id && (
                          <button className="boto perill petit" onClick={() => esborrar(u)}>Esborrar invitació</button>
                        )}
                        {u.estat === "actiu" && !socJo && (
                          <button className="boto perill petit" onClick={() => canviar(u, { estat: "desactivat" }, `S'ha desactivat l'accés de ${u.email}.`)}>Desactivar</button>
                        )}
                        {u.estat === "desactivat" && (
                          <button className="boto secundari petit" onClick={() => canviar(u, { estat: u.auth_id ? "actiu" : "convidat", rol: u.rol ?? "manteniment" }, `S'ha reactivat ${u.email}.`)}>Reactivar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
