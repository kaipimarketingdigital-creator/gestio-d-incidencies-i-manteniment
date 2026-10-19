-- Pantalla Preventiu del panell: pressupost, materials previstos, arxivar, i noms de qui fa canvis.

-- 1) Tasques preventives: pressupost per cada vegada que es fa, i arxivar (sense perdre l'historial).
--    Pausar = activa false. Arxivar = activa false + arxivada_el (surt de la llista principal).
alter table public.manteniment_preventiu
  add column if not exists pressupost numeric(10,2) check (pressupost is null or pressupost >= 0),
  add column if not exists arxivada_el timestamptz;

-- 2) Materials previstos per a cada tasca (el que s'ha gastat de veritat es desa a cada incidència: cost i materials).
create table if not exists public.preventiu_materials (
  id bigint generated always as identity primary key,
  preventiu_id uuid not null references public.manteniment_preventiu(id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  quantitat numeric(10,2) not null default 1 check (quantitat > 0),
  unitat text,
  cost_estimat numeric(10,2) check (cost_estimat is null or cost_estimat >= 0),
  creat_el timestamptz not null default now()
);
create index if not exists preventiu_materials_preventiu_idx on public.preventiu_materials (preventiu_id);
alter table public.preventiu_materials enable row level security;

create policy preventiu_materials_veure on public.preventiu_materials for select to authenticated
  using ((select privat.es_usuari_actiu()));
create policy preventiu_materials_crear on public.preventiu_materials for insert to authenticated
  with check ((select privat.te_rol('direccio', 'administracio')));
create policy preventiu_materials_canviar on public.preventiu_materials for update to authenticated
  using ((select privat.te_rol('direccio', 'administracio')))
  with check ((select privat.te_rol('direccio', 'administracio')));
create policy preventiu_materials_esborrar on public.preventiu_materials for delete to authenticated
  using ((select privat.te_rol('direccio', 'administracio')));

-- 3) Esborrar una tasca només si no ha generat mai cap incidència (si en té, s'arxiva).
drop policy if exists preventiu_esborrar on public.manteniment_preventiu;
create policy preventiu_esborrar on public.manteniment_preventiu for delete to authenticated
  using (
    (select privat.te_rol('direccio', 'administracio'))
    and not exists (select 1 from public.incidencies i where i.preventiu_id = manteniment_preventiu.id)
  );

-- 4) Noms dels usuaris del panell per a l'historial, visibles per a tots els usuaris actius
--    (la taula usuaris_panell sencera només la veu Direcció).
create or replace function public.noms_usuaris_panell()
returns table (id uuid, nom text)
language sql stable security definer set search_path = '' as $$
  select u.id, coalesce(nullif(u.nom, ''), split_part(u.email, '@', 1))
    from public.usuaris_panell u
   where (select privat.es_usuari_actiu());
$$;
revoke execute on function public.noms_usuaris_panell() from public, anon;
grant execute on function public.noms_usuaris_panell() to authenticated;
