-- Manteniment preventiu: cada tasca genera una incidència quan toca, i en tancar-la es programa la següent.
alter table manteniment_preventiu
  add column categoria categoria_incidencia not null default 'tasca',
  add column ultima_feta date,
  add column creat_el timestamptz not null default now();

alter table incidencies
  add column preventiu_id uuid references manteniment_preventiu(id) on delete set null;
create index on incidencies (preventiu_id);
