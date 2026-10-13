-- Examen del bot amb missatges reals (anonimitzats) del xat de WhatsApp.
-- Els casos es carreguen a part (no són al repositori: contenen dades del personal).
create table avaluacio_casos (
  id          integer primary key,
  rol         text,                 -- rol de qui escriu (Recepció, Pisos A, Manteniment...), mai el nom
  data        timestamp,
  text        text,
  ronda       integer default 1,
  reclamat    boolean default false,
  accions     jsonb,                -- resposta del model a la ronda actual
  accions_r1  jsonb,                -- resposta de la ronda 1, per comparar
  error       text,
  model       text,
  fet_el      timestamptz
);
alter table avaluacio_casos enable row level security;

create function reclamar_avaluacio(n integer default 8)
returns setof avaluacio_casos
language sql
set search_path = public
as $$
  update avaluacio_casos set reclamat = true
   where id in (select id from avaluacio_casos where not reclamat order by id limit n for update skip locked)
  returning *;
$$;
revoke execute on function reclamar_avaluacio(integer) from public, anon, authenticated;
grant execute on function reclamar_avaluacio(integer) to service_role;
