-- Resum del matí: cada hora a i 30; la funció només l'envia quan a Madrid són les RESUM_HORA (8 h per defecte).
select cron.schedule(
  'resum-diari',
  '30 * * * *',
  $$ select net.http_get(url := 'https://emgwjhypuxgbrajjnnsj.supabase.co/functions/v1/telegram-webhook?accio=resum') $$
);
