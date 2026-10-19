-- Canvis fets des del panell web: saber qui els ha fet i tancar bé les incidències.

-- 1) Historial: quin usuari del panell ha fet el canvi (el bot continua omplint persona_id).
alter table public.historial
  add column if not exists usuari_id uuid references public.usuaris_panell(id) on delete set null;

create or replace function privat.historial_autor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.usuari_id is null and auth.uid() is not null then
    select u.id into new.usuari_id from public.usuaris_panell u where u.auth_id = auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists historial_autor on public.historial;
create trigger historial_autor before insert on public.historial
  for each row execute function privat.historial_autor();

-- 2) Data de tancament coherent sigui qui sigui qui canviï l'estat (bot o panell).
create or replace function privat.incidencia_data_tancament()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.estat in ('resolta', 'anullada') and old.estat not in ('resolta', 'anullada') and new.resolta_el is null then
    new.resolta_el := now();
  elsif new.estat not in ('resolta', 'anullada') and old.estat in ('resolta', 'anullada') then
    new.resolta_el := null;
  end if;
  return new;
end $$;

drop trigger if exists incidencia_data_tancament on public.incidencies;
create trigger incidencia_data_tancament before update of estat on public.incidencies
  for each row execute function privat.incidencia_data_tancament();

-- 3) Preventiu: en tancar (resoldre o anul·lar) una incidència preventiva, programar la següent revisió,
--    tant si es tanca des de Telegram com des del panell. Fa el mateix càlcul que el bot, així que és idempotent.
create or replace function privat.preventiu_programar_seguent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  avui date := (now() at time zone 'Europe/Madrid')::date;
begin
  if new.preventiu_id is not null
     and new.estat in ('resolta', 'anullada')
     and old.estat not in ('resolta', 'anullada') then
    update public.manteniment_preventiu p
       set ultima_feta = avui,
           propera_revisio = avui + p.periodicitat_dies
     where p.id = new.preventiu_id;
  end if;
  return null;
end $$;

drop trigger if exists preventiu_programar_seguent on public.incidencies;
create trigger preventiu_programar_seguent after update of estat on public.incidencies
  for each row execute function privat.preventiu_programar_seguent();
