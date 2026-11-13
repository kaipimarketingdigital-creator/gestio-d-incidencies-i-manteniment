-- La clau de les tasques del bot passa de l'URL (?clau=) a la capçalera x-clau-tasques,
-- perquè a l'URL quedava escrita als registres de pg_net i de les funcions.
-- Com que la clau antiga ja ha passat pels registres, es genera una clau nova.
--
-- Ordre de desplegament: aplicar aquesta migració i, just després, desplegar telegram-webhook.
-- Entre les dues passes el cron rep 403 (un o dos cicles); els missatges esperen i es processen després.

update public.config
   set valor = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
 where clau = 'tasques';

select cron.unschedule('processar-missatges');
select cron.unschedule('resum-diari');

select cron.schedule(
  'processar-missatges',
  '30 seconds',
  $$ select net.http_get(
       url := 'https://emgwjhypuxgbrajjnnsj.supabase.co/functions/v1/telegram-webhook?accio=processar',
       headers := jsonb_build_object('x-clau-tasques', (select valor from public.config where clau = 'tasques'))
     ) $$
);
select cron.schedule(
  'resum-diari',
  '30 * * * *',
  $$ select net.http_get(
       url := 'https://emgwjhypuxgbrajjnnsj.supabase.co/functions/v1/telegram-webhook?accio=resum',
       headers := jsonb_build_object('x-clau-tasques', (select valor from public.config where clau = 'tasques'))
     ) $$
);
