-- Les rutes GET del bot (processar, resum, avaluar, models, configurar) només responen amb aquesta clau.
-- La clau es genera aquí dins i no surt de la base de dades: la llegeixen el cron i la funció.
create table config (
  clau  text primary key,
  valor text not null
);
alter table config enable row level security;  -- sense polítiques: només el service role

insert into config (clau, valor)
values ('tasques', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (clau) do nothing;

select cron.unschedule('processar-missatges');
select cron.unschedule('resum-diari');

select cron.schedule(
  'processar-missatges',
  '30 seconds',
  $$ select net.http_get(url := 'https://emgwjhypuxgbrajjnnsj.supabase.co/functions/v1/telegram-webhook?accio=processar&clau='
       || (select valor from public.config where clau = 'tasques')) $$
);
select cron.schedule(
  'resum-diari',
  '30 * * * *',
  $$ select net.http_get(url := 'https://emgwjhypuxgbrajjnnsj.supabase.co/functions/v1/telegram-webhook?accio=resum&clau='
       || (select valor from public.config where clau = 'tasques')) $$
);
