# Gestió d'incidències i manteniment · Hotel Rull

Bot de Telegram que converteix els avisos de manteniment que l'equip escriu al grup
(text, foto, àudio o vídeo, en català col·loquial) en incidències registrades a Supabase,
amb confirmació al mateix grup. Projecte de Kaipi Marketing per a Hotel Rull.

## Estat

Fase 0 (preparació). El codi és una estructura inicial: l'esquema de dades i l'esquelet
del webhook encara no s'han executat contra un projecte real de Supabase.

| Fase | Dates | Contingut |
| --- | --- | --- |
| 0. Preparació | 7 a 9 d'octubre de 2026 | Bot, grup de proves, Supabase, prova de la IA amb avisos reals |
| 1. Nucli | 13 a 16 d'octubre | Registre d'incidències amb confirmació, corregir, anul·lar, resolta |
| 2. Pilot curt | 19 a 30 d'octubre | Grup real amb l'equip |
| 3 a 5 | Novembre a març de 2027 | Cicle complet al xat, panell web, preventiu, arrencada |

## Estructura

```
docs/
  arquitectura-y-plan.md   Arquitectura i pla (referència vigent)
  vocabulari.md            Com parla l'equip: senyals de prioritat, tancaments, zones
supabase/
  migrations/              Esquema de la base de dades
  seed.sql                 Zones inicials (esborrany pendent de validar)
  functions/
    telegram-webhook/      Entrada de missatges de Telegram
```

## Peces

- **Canal:** Telegram Bot API, amb el mode privacitat desactivat perquè el bot llegeixi tot el grup.
- **Lògica:** Supabase Edge Functions.
- **Dades:** Supabase (Postgres, Storage, Auth).
- **IA:** un model multimodal darrere d'una funció pròpia, per poder canviar-lo.
- **Panell web:** fase 4.

## Dades personals

El xat exportat del grup, les fotos i els àudios contenen dades del personal i dels clients.
Es guarden fora del repositori (`material-hotel/` està al `.gitignore`) i no s'han de pujar mai.
