-- Què pot canviar el panell d'una incidència, i qui consta com a autor a l'historial.

-- 1) Incidències: des del panell només es poden canviar els camps de la fitxa.
--    Els camps interns (IA, Telegram, preventiu, autor, dates de creació) només els toca el bot.
--    resolta_el i cost els recalculen els disparadors; resolta_el el panell també l'envia en tancar o reobrir.
revoke update on public.incidencies from anon, authenticated;
grant update (estat, prioritat, categoria, assignada_a, observacions, cal_repassar, resolta_el, altres_costos)
  on public.incidencies to authenticated;

-- 2) Historial: si el canvi ve del panell, l'autor és sempre qui té la sessió oberta
--    (abans només s'omplia si venia buit, i es podia posar un altre autor).
create or replace function privat.historial_autor()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  u record;
begin
  if auth.uid() is not null then
    select x.id, x.persona_id into u from public.usuaris_panell x where x.auth_id = auth.uid();
    new.usuari_id := u.id;
    new.persona_id := u.persona_id;
    new.canviat_el := now();
  end if;
  return new;
end $$;
