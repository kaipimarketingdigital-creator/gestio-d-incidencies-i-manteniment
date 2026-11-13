# Gestió d'incidències i manteniment · Hotel Rull

Sistema de manteniment de l'Hotel Rull (Delta de l'Ebre). L'equip avisa de les avaries parlant
amb naturalitat en un grup de Telegram (text, foto, àudio o vídeo, en català col·loquial); un bot
les converteix en incidències registrades a Supabase i les confirma al mateix grup. Un panell web
serveix a Direcció per al seguiment, el manteniment preventiu i la configuració.
Projecte de Kaipi Marketing per a Hotel Rull.

Les regles del projecte (producte, tècniques i forma de treballar) són a [`CLAUDE.md`](CLAUDE.md).
Les tasques i el seu estat són a les issues d'aquest repositori.

## Què fa

**Al grup de Telegram**

- Registra incidències a partir de text, àudio, foto i vídeo, i les confirma en català responent al
  missatge original, amb botons.
- Entén la resolució parlada («lo de la 203 ja està») i els estats intermedis: en curs, esperant
  material, proveïdor extern.
- Si a un avís nou li falta la zona, la pregunta; la resta de la conversa l'ignora.
- Publica cada dia un resum de pendents al grup i l'envia per correu.
- Avisa una sola vegada quan venç una tasca de manteniment preventiu (Telegram i correu).

**Al panell web** (`https://manteniment.hotelrull.com`)

- Pàgines: Avui, Incidències (llistat i fitxa), Preventiu, Mapa, Informes, Perfil, Ajuda,
  Configuració i Importar.
- Rols: `direccio`, `administracio` i `manteniment`. Manteniment no veu Informes; només Direcció
  entra a Configuració i Importar.
- Accés sense contrasenyes: només correus convidats, amb enllaç d'accés; la sessió es tanca
  després de 12 hores d'inactivitat.

## Peces

| Peça | Amb què |
| --- | --- |
| Canal | Telegram Bot API, amb el mode privacitat desactivat perquè el bot llegeixi tot el grup |
| Bot i lògica | Supabase Edge Functions (`telegram-webhook`) |
| IA | Gemini, tot concentrat a `supabase/functions/telegram-webhook/gemini.ts` per poder canviar de model |
| Dades, fitxers i usuaris | Supabase (Postgres, Storage, Auth) |
| Tasques programades | `pg_cron` de Supabase: processament dels missatges cada 30 s i resum diari, que també genera i avisa el preventiu |
| Correu | SMTP del domini de l'hotel |
| Panell | React + Vite + TypeScript amb `supabase-js`, a la carpeta `app/` |

## Estructura

```
app/                         Panell web
  src/pages/                 Una pàgina per ruta
  src/lib/                   Client de Supabase, sessió, consultes
supabase/
  migrations/NNNN_*.sql      Esquema, en ordre. Font de veritat de la base de dades
  functions/
    telegram-webhook/        El bot: index.ts, telegram.ts, gemini.ts (IA), correu.ts (resums)
    importar-whatsapp/       Importació única de l'historial de WhatsApp (només Direcció)
  seed.sql                   Zones inicials
docs/
  vocabulari.md              Com parla l'equip. Base del prompt de la IA
  arquitectura-y-plan.md     Arquitectura del 6 d'octubre de 2026 (històric; vegeu la nota inicial)
  panell/                    Maqueta estàtica del panell (referència de disseny)
.github/
  workflows/publicar-panell.yml   Publicació automàtica del panell
  ISSUE_TEMPLATE/, pull_request_template.md
```

## Panell: desenvolupament i publicació

```
cd app && npm ci
npm run dev                  # http://localhost:5173
npm run lint && npm run build
```

Cada push a `main` que toqui `app/` (o el mateix flux) executa el flux `publicar-panell.yml`: compila el panell i
puja `app/dist/` per FTPS a l'allotjament de l'hotel. Necessita els secrets de GitHub
`FTP_SERVIDOR`, `FTP_USUARI` i `FTP_CONTRASENYA`; si no hi són, només compila. També es pot
llançar a mà des de la pestanya Actions.

## Base de dades i bot

Les migracions i les funcions es despleguen des de Claude amb el connector de Supabase, no amb la
CLI (no hi ha `supabase/config.toml`). Res no s'aplica a producció sense l'OK explícit de Kaipi;
vegeu [`CLAUDE.md`](CLAUDE.md) per als secrets, les regles de migració i el desplegament.

## Dades personals

El xat exportat del grup, les fotos i els àudios contenen dades del personal i dels clients.
Es guarden fora del repositori (`material-hotel/` és al `.gitignore`) i no s'han de pujar mai.
Tampoc noms, telèfons ni missatges reals a issues, pull requests o commits.
