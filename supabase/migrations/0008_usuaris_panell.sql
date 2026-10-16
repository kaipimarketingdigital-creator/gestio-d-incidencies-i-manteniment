-- Panell web: usuaris, rols i permisos.
--
-- Com funciona l'accés:
--   1. Direcció convida una persona pel seu correu (fila amb estat 'convidat' i el seu rol).
--   2. La persona entra amb l'enllaç que rep per correu. En crear-se el compte, es vincula
--      a la invitació i queda 'actiu'.
--   3. Si algú entra sense invitació, es crea una fila 'pendent' sense rol: no veu res fins
--      que Direcció l'aprova i li assigna un rol.
--   4. 'desactivat' tanca l'accés sense esborrar l'historial.

create type rol_panell as enum ('direccio', 'administracio', 'manteniment');
create type estat_usuari as enum ('convidat', 'pendent', 'actiu', 'desactivat');

create table usuaris_panell (
  id            uuid primary key default gen_random_uuid(),
  auth_id       uuid unique references auth.users(id) on delete set null,
  email         text not null unique check (email = lower(email)),
  nom           text,
  rol           rol_panell,
  estat         estat_usuari not null default 'convidat',
  persona_id    uuid references persones(id) on delete set null,   -- la seva persona al grup de Telegram
  convidat_per  uuid references usuaris_panell(id) on delete set null,
  creat_el      timestamptz not null default now(),
  darrer_acces  timestamptz,
  constraint actiu_amb_rol check (estat not in ('actiu', 'convidat') or rol is not null)
);
create index on usuaris_panell (persona_id);
create index on usuaris_panell (convidat_per);
alter table usuaris_panell enable row level security;

-- ---------------------------------------------------------------- funcions d'ajuda per a les polítiques

create function rol_actual() returns rol_panell
language sql stable security definer set search_path = public
as $$
  select rol from usuaris_panell where auth_id = auth.uid() and estat = 'actiu'
$$;

create function te_rol(variadic rols rol_panell[]) returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(rol_actual() = any (rols), false)
$$;

create function es_usuari_actiu() returns boolean
language sql stable security definer set search_path = public
as $$
  select rol_actual() is not null
$$;

revoke execute on function rol_actual() from public, anon;
revoke execute on function te_rol(rol_panell[]) from public, anon;
revoke execute on function es_usuari_actiu() from public, anon;
grant execute on function rol_actual() to authenticated, service_role;
grant execute on function te_rol(rol_panell[]) to authenticated, service_role;
grant execute on function es_usuari_actiu() to authenticated, service_role;

-- Desa l'últim accés de qui entra (l'app la crida en obrir sessió).
create function registrar_acces() returns void
language sql volatile security definer set search_path = public
as $$
  update usuaris_panell set darrer_acces = now() where auth_id = auth.uid()
$$;
revoke execute on function registrar_acces() from public, anon;
grant execute on function registrar_acces() to authenticated;

-- ---------------------------------------------------------------- vincular el compte en entrar per primer cop

create function vincular_usuari() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update usuaris_panell
     set auth_id = new.id,
         estat = case when estat = 'convidat' then 'actiu'::estat_usuari else estat end
   where email = lower(new.email) and auth_id is null;
  if not found then
    insert into usuaris_panell (auth_id, email, estat)
    values (new.id, lower(new.email), 'pendent')
    on conflict (email) do nothing;
  end if;
  return new;
end
$$;
revoke execute on function vincular_usuari() from public, anon, authenticated;

create trigger vincular_usuari_panell
after insert on auth.users
for each row execute function vincular_usuari();

-- Sempre ha de quedar com a mínim una persona de Direcció activa.
create function mantenir_direccio() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.rol = 'direccio' and old.estat = 'actiu'
     and (tg_op = 'DELETE' or new.rol is distinct from 'direccio' or new.estat <> 'actiu')
     and not exists (select 1 from usuaris_panell
                      where id <> old.id and rol = 'direccio' and estat = 'actiu') then
    raise exception 'Ha de quedar com a mínim una persona de Direcció activa';
  end if;
  return coalesce(new, old);
end
$$;
revoke execute on function mantenir_direccio() from public, anon, authenticated;

create trigger mantenir_direccio
before update or delete on usuaris_panell
for each row execute function mantenir_direccio();

-- ---------------------------------------------------------------- polítiques

-- Usuaris: cadascú veu la seva fila; Direcció les veu i les gestiona totes.
create policy usuaris_veure on usuaris_panell for select to authenticated
  using (auth_id = (select auth.uid()) or (select te_rol('direccio')));
create policy usuaris_convidar on usuaris_panell for insert to authenticated
  with check ((select te_rol('direccio')));
create policy usuaris_canviar on usuaris_panell for update to authenticated
  using ((select te_rol('direccio'))) with check ((select te_rol('direccio')));
create policy usuaris_esborrar on usuaris_panell for delete to authenticated
  using ((select te_rol('direccio')) and auth_id is null);   -- només invitacions no usades

-- Incidències: tothom actiu les veu i les edita; crear-ne a mà, Direcció i Administració.
create policy incidencies_veure on incidencies for select to authenticated
  using ((select es_usuari_actiu()));
create policy incidencies_editar on incidencies for update to authenticated
  using ((select es_usuari_actiu())) with check ((select es_usuari_actiu()));
create policy incidencies_crear on incidencies for insert to authenticated
  with check ((select te_rol('direccio', 'administracio')));

create policy historial_veure on historial for select to authenticated
  using ((select es_usuari_actiu()));
create policy historial_afegir on historial for insert to authenticated
  with check ((select es_usuari_actiu()));

create policy missatges_veure on missatges for select to authenticated
  using ((select es_usuari_actiu()));
create policy missatges_bot_veure on missatges_bot for select to authenticated
  using ((select es_usuari_actiu()));
create policy adjunts_veure on adjunts for select to authenticated
  using ((select es_usuari_actiu()));

-- Zones i persones: tothom les veu; només Direcció les canvia.
create policy zones_veure on zones for select to authenticated
  using ((select es_usuari_actiu()));
create policy zones_crear on zones for insert to authenticated
  with check ((select te_rol('direccio')));
create policy zones_canviar on zones for update to authenticated
  using ((select te_rol('direccio'))) with check ((select te_rol('direccio')));
create policy zones_esborrar on zones for delete to authenticated
  using ((select te_rol('direccio')));
create policy persones_veure on persones for select to authenticated
  using ((select es_usuari_actiu()));
create policy persones_crear on persones for insert to authenticated
  with check ((select te_rol('direccio')));
create policy persones_canviar on persones for update to authenticated
  using ((select te_rol('direccio'))) with check ((select te_rol('direccio')));
create policy persones_esborrar on persones for delete to authenticated
  using ((select te_rol('direccio')));

-- Preventiu: tothom el veu; Direcció i Administració el gestionen.
create policy preventiu_veure on manteniment_preventiu for select to authenticated
  using ((select es_usuari_actiu()));
create policy preventiu_crear on manteniment_preventiu for insert to authenticated
  with check ((select te_rol('direccio', 'administracio')));
create policy preventiu_canviar on manteniment_preventiu for update to authenticated
  using ((select te_rol('direccio', 'administracio'))) with check ((select te_rol('direccio', 'administracio')));
create policy preventiu_esborrar on manteniment_preventiu for delete to authenticated
  using ((select te_rol('direccio', 'administracio')));

-- config i avaluacio_casos es queden sense polítiques: només el bot hi accedeix.

-- Fotos, àudios i vídeos: els usuaris actius poden demanar enllaços temporals.
create policy adjunts_fitxers_veure on storage.objects for select to authenticated
  using (bucket_id = 'adjunts' and (select public.es_usuari_actiu()));
