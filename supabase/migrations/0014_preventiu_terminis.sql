-- Preventiu amb termini, avís de «fora de termini», estat «No realitzada» i calendari fix.

-- 1) Estat nou per a les execucions que no s'han fet (és un estat tancat, com «anul·lada»).
alter type public.estat_incidencia add value if not exists 'no_realitzada';

-- 2) Termini de cada tasca: dies que hi ha per fer-la des que s'avisa.
alter table public.manteniment_preventiu
  add column if not exists termini_dies smallint not null default 7 check (termini_dies between 0 and 365);

-- 3) Cada execució guarda per a quin dia tocava, fins quan hi ha temps i quan es va avisar que anava tard.
alter table public.incidencies
  add column if not exists data_prevista date,
  add column if not exists data_limit date,
  add column if not exists avis_fora_termini_el timestamptz;
create index if not exists incidencies_preventiu_obertes on public.incidencies (preventiu_id, data_limit)
  where preventiu_id is not null;

-- 4) Calendari fix: en tancar una execució només s'anota quan es va fer; la propera data ja la porta el calendari.
create or replace function privat.incidencia_data_tancament()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.estat::text in ('resolta', 'anullada', 'no_realitzada') and old.estat::text not in ('resolta', 'anullada', 'no_realitzada') and new.resolta_el is null then
    new.resolta_el := now();
  elsif new.estat::text not in ('resolta', 'anullada', 'no_realitzada') and old.estat::text in ('resolta', 'anullada', 'no_realitzada') then
    new.resolta_el := null;
  end if;
  return new;
end $$;

create or replace function privat.preventiu_programar_seguent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.preventiu_id is not null and new.estat::text = 'resolta' and old.estat::text <> 'resolta' then
    update public.manteniment_preventiu p
       set ultima_feta = (now() at time zone 'Europe/Madrid')::date
     where p.id = new.preventiu_id;
  end if;
  return null;
end $$;

-- 5) Grup de Telegram on publica el bot (abans es deduïa de l'últim missatge rebut).
insert into public.config (clau, valor) values ('grup_telegram', '-5411993751')
on conflict (clau) do nothing;
