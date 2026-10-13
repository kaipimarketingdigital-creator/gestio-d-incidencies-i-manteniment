-- Esquema inicial. Aplicat al projecte hotel-rull-incidencies el 13 d'octubre de 2026.

create type rol_persona as enum ('manteniment', 'pisos', 'recepcio', 'cuina', 'direccio', 'kaipi');
create type tipus_zona as enum ('habitacio', 'comuna', 'tecnica');
create type categoria_incidencia as enum (
  'fontaneria', 'electricitat', 'climatitzacio', 'panys_i_portes', 'mobiliari',
  'tv_i_electronica', 'plagues', 'filtracions', 'neteja', 'tasca', 'altres'
);
create type prioritat_incidencia as enum ('baixa', 'mitjana', 'alta', 'urgent');
create type estat_incidencia as enum (
  'oberta', 'en_curs', 'esperant_material', 'proveidor_extern', 'resolta', 'anullada'
);
create type tipus_adjunt as enum ('foto', 'audio', 'video', 'altre');

create table persones (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  rol           rol_persona not null,
  telegram_id   bigint unique,
  compartit     boolean not null default false,  -- mòbil compartit (recepció)
  rep_urgents   boolean not null default false,
  actiu         boolean not null default true,
  creat_el      timestamptz not null default now()
);

create table zones (
  id        uuid primary key default gen_random_uuid(),
  nom       text not null unique,
  tipus     tipus_zona not null,
  planta    smallint,
  part      text check (part in ('nova', 'vella')),
  alies     text[] not null default '{}',   -- com l'anomena l'equip
  bloquejada boolean not null default false,
  activa    boolean not null default true
);

create table incidencies (
  id              bigint generated always as identity primary key,
  zona_id         uuid references zones(id),
  zona_text       text,                      -- el que es va dir, si no encaixa amb cap zona
  categoria       categoria_incidencia not null default 'altres',
  descripcio      text not null,
  prioritat       prioritat_incidencia not null default 'mitjana',
  estat           estat_incidencia not null default 'oberta',
  reportada_per   uuid references persones(id),
  assignada_a     uuid references persones(id),
  cal_repassar    boolean not null default false,
  cost            numeric(10,2),
  materials       text,
  observacions    text,
  -- el que va proposar la IA, encara que després es corregeixi
  ia_categoria    categoria_incidencia,
  ia_prioritat    prioritat_incidencia,
  ia_model        text,
  creada_el       timestamptz not null default now(),
  resolta_el      timestamptz,
  -- missatge de confirmació del bot, per reconèixer les respostes ("Fet")
  tg_xat_id       bigint,
  tg_confirmacio_id bigint
);
create index on incidencies (estat);
create index on incidencies (zona_id, creada_el desc);
create index on incidencies (tg_xat_id, tg_confirmacio_id);
create index on incidencies (reportada_per);
create index on incidencies (assignada_a);

create table missatges (
  id              bigint generated always as identity primary key,
  incidencia_id   bigint references incidencies(id) on delete set null,
  autor_id        uuid references persones(id),
  tg_xat_id       bigint not null,
  tg_missatge_id  bigint not null,
  tg_autor_id     bigint,
  tg_resposta_a   bigint,                    -- missatge al qual respon
  text            text,
  transcripcio    text,
  cru             jsonb not null,            -- actualització original de Telegram
  processat       boolean not null default false,
  rebut_el        timestamptz not null default now(),
  unique (tg_xat_id, tg_missatge_id)
);
create index on missatges (processat, rebut_el);
create index on missatges (incidencia_id);
create index on missatges (autor_id);

create table adjunts (
  id            bigint generated always as identity primary key,
  missatge_id   bigint not null references missatges(id) on delete cascade,
  tipus         tipus_adjunt not null,
  tg_file_id    text not null,
  ruta_storage  text,
  mida_bytes    bigint,
  creat_el      timestamptz not null default now()
);
create index on adjunts (missatge_id);

create table historial (
  id              bigint generated always as identity primary key,
  incidencia_id   bigint not null references incidencies(id) on delete cascade,
  persona_id      uuid references persones(id),
  camp            text not null,
  valor_anterior  text,
  valor_nou       text,
  canviat_el      timestamptz not null default now()
);
create index on historial (incidencia_id, canviat_el);
create index on historial (persona_id);

create table manteniment_preventiu (
  id                uuid primary key default gen_random_uuid(),
  tasca             text not null,
  zona_id           uuid references zones(id),
  periodicitat_dies integer not null check (periodicitat_dies > 0),
  propera_revisio   date not null,
  responsable_id    uuid references persones(id),
  activa            boolean not null default true,
  observacions      text
);
create index on manteniment_preventiu (zona_id);
create index on manteniment_preventiu (responsable_id);

-- Tot tancat per defecte: només hi accedeix el bot amb la clau de servei.
-- Les polítiques per al panell web s'afegiran a la fase 4.
alter table persones enable row level security;
alter table zones enable row level security;
alter table incidencies enable row level security;
alter table missatges enable row level security;
alter table adjunts enable row level security;
alter table historial enable row level security;
alter table manteniment_preventiu enable row level security;
