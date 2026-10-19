-- Materials a les incidències, zones generals per plantes, perfil propi i accés només per a convidats.

-- 1) Part vella / part nova de cada habitació, i zones generals per planta.
update public.zones set part = 'vella'
 where tipus = 'habitacio' and nom ~ '^\d+$'
   and ((nom::int between 101 and 112) or (nom::int between 201 and 213) or (nom::int between 301 and 313));
update public.zones set part = 'nova'
 where tipus = 'habitacio' and nom ~ '^\d+$'
   and ((nom::int between 221 and 225) or (nom::int between 321 and 324));

insert into public.zones (nom, tipus, planta, part, alies, activa)
select v.nom, 'comuna', v.planta, v.part, v.alies, true
  from (values
    ('Planta 1 · part vella', 1, 'vella', array['planta 1 part vella', 'part vella planta 1', 'planta 1 vella']),
    ('Planta 2 · part vella', 2, 'vella', array['planta 2 part vella', 'part vella planta 2', 'planta 2 vella']),
    ('Planta 3 · part vella', 3, 'vella', array['planta 3 part vella', 'part vella planta 3', 'planta 3 vella']),
    ('Planta 1 · part nova', 1, 'nova', array['planta 1 part nova', 'part nova planta 1', 'planta 1 nova']),
    ('Planta 2 · part nova', 2, 'nova', array['planta 2 part nova', 'part nova planta 2', 'planta 2 nova']),
    ('Planta 3 · part nova', 3, 'nova', array['planta 3 part nova', 'part nova planta 3', 'planta 3 nova'])
  ) as v(nom, planta, part, alies)
 where not exists (select 1 from public.zones z where lower(z.nom) = lower(v.nom));

-- 2) Materials de cada incidència (com al preventiu) i cost total automàtic.
alter table public.incidencies
  add column if not exists altres_costos numeric(10,2) check (altres_costos is null or altres_costos >= 0);

create table if not exists public.incidencia_materials (
  id bigint generated always as identity primary key,
  incidencia_id bigint not null references public.incidencies(id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  quantitat numeric(10,2) not null default 1 check (quantitat > 0),
  unitat text,
  cost_unitari numeric(10,2) check (cost_unitari is null or cost_unitari >= 0),
  creat_el timestamptz not null default now()
);
create index if not exists incidencia_materials_incidencia_idx on public.incidencia_materials (incidencia_id);
alter table public.incidencia_materials enable row level security;
create policy incidencia_materials_veure on public.incidencia_materials for select to authenticated
  using ((select privat.es_usuari_actiu()));
create policy incidencia_materials_crear on public.incidencia_materials for insert to authenticated
  with check ((select privat.es_usuari_actiu()));
create policy incidencia_materials_canviar on public.incidencia_materials for update to authenticated
  using ((select privat.es_usuari_actiu())) with check ((select privat.es_usuari_actiu()));
create policy incidencia_materials_esborrar on public.incidencia_materials for delete to authenticated
  using ((select privat.es_usuari_actiu()));

-- Els costos que ja hi havia passen a "altres costos"; el text de materials, a la llista (sense preu).
update public.incidencies set altres_costos = cost where cost is not null and altres_costos is null;
insert into public.incidencia_materials (incidencia_id, nom)
select i.id, trim(m)
  from public.incidencies i, regexp_split_to_table(i.materials, E'[\\n;]+') as m
 where i.materials is not null and trim(m) <> ''
   and not exists (select 1 from public.incidencia_materials x where x.incidencia_id = i.id);

-- cost = altres costos + total dels materials (sempre al dia, el faci qui el faci).
create or replace function privat.recalcular_cost(p_inc bigint)
returns void language sql security definer set search_path = '' as $$
  update public.incidencies i
     set cost = nullif(coalesce(i.altres_costos, 0) + coalesce((
           select sum(m.quantitat * coalesce(m.cost_unitari, 0)) from public.incidencia_materials m where m.incidencia_id = i.id), 0), 0)
   where i.id = p_inc;
$$;

create or replace function privat.materials_canvi()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform privat.recalcular_cost(coalesce(new.incidencia_id, old.incidencia_id));
  return null;
end $$;
drop trigger if exists materials_canvi on public.incidencia_materials;
create trigger materials_canvi after insert or update or delete on public.incidencia_materials
  for each row execute function privat.materials_canvi();

create or replace function privat.altres_costos_canvi()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform privat.recalcular_cost(new.id);
  return null;
end $$;
drop trigger if exists altres_costos_canvi on public.incidencies;
create trigger altres_costos_canvi after update of altres_costos on public.incidencies
  for each row when (old.altres_costos is distinct from new.altres_costos)
  execute function privat.altres_costos_canvi();

-- 3) Cadascú pot canviar el seu propi nom (la resta de dades, només Direcció).
create or replace function public.canviar_el_meu_nom(nou text)
returns void language sql security definer set search_path = '' as $$
  update public.usuaris_panell set nom = nullif(trim(nou), '')
   where auth_id = (select auth.uid()) and estat = 'actiu';
$$;
revoke execute on function public.canviar_el_meu_nom(text) from public, anon;
grant execute on function public.canviar_el_meu_nom(text) to authenticated;

-- 4) Només poden crear compte els correus convidats per Direcció.
--    S'activa a Supabase: Authentication → Hooks → "Before User Created" → Postgres → public.hook_nomes_convidats
create or replace function public.hook_nomes_convidats(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.usuaris_panell u
     where u.email = lower(event->'user'->>'email') and u.estat in ('convidat', 'actiu')
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Aquest correu no té accés al panell. Demana a Direcció que et convidi.'));
end $$;
grant execute on function public.hook_nomes_convidats(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_nomes_convidats(jsonb) from public, anon, authenticated;
