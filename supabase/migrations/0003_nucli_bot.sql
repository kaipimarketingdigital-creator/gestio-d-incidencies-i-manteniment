-- Fase 1: el que necessita el nucli del bot.

-- Les persones es donen d'alta soles amb el primer missatge; el rol s'assigna després.
alter table persones alter column rol drop not null;

-- Missatges que envia el bot, per saber a quina incidència es refereix una resposta.
create table missatges_bot (
  id              bigint generated always as identity primary key,
  tg_xat_id       bigint not null,
  tg_missatge_id  bigint not null,
  incidencia_id   bigint references incidencies(id) on delete set null,
  tipus           text not null,   -- confirmacio, correccio, pregunta, resolta, actualitzacio, error
  text            text,
  creat_el        timestamptz not null default now(),
  unique (tg_xat_id, tg_missatge_id)
);
create index on missatges_bot (incidencia_id);
alter table missatges_bot enable row level security;

alter table missatges add column error text;

-- Reclama, de forma atòmica, els missatges pendents de les persones que fa una estona que no escriuen.
-- Així una foto i l'àudio que l'acompanya es processen junts, i dues execucions no agafen el mateix.
create function reclamar_pendents(espera_segons int default 30)
returns setof missatges
language sql
set search_path = public
as $$
  with llestos as (
    select tg_xat_id, tg_autor_id
    from missatges
    where not processat
    group by tg_xat_id, tg_autor_id
    having max(rebut_el) < now() - make_interval(secs => espera_segons)
  )
  update missatges m
     set processat = true
    from llestos l
   where not m.processat
     and m.tg_xat_id = l.tg_xat_id
     and m.tg_autor_id is not distinct from l.tg_autor_id
  returning m.*;
$$;
revoke execute on function reclamar_pendents(int) from public, anon, authenticated;
grant execute on function reclamar_pendents(int) to service_role;

-- Fotos, àudios i vídeos. Privat: només hi accedeix el bot.
insert into storage.buckets (id, name, public) values ('adjunts', 'adjunts', false)
on conflict (id) do nothing;

-- Cada 30 segons, processar els missatges pendents.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'processar-missatges',
  '30 seconds',
  $$ select net.http_get(url := 'https://emgwjhypuxgbrajjnnsj.supabase.co/functions/v1/telegram-webhook?accio=processar') $$
);
