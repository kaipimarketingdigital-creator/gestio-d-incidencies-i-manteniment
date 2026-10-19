-- Configuració del panell: resum diari per correu i per Telegram.
-- Una sola fila (id = 1). La contrasenya del correu NO es desa aquí: és el secret SMTP_PASSWORD de la funció.

create table if not exists public.ajustos (
  id smallint primary key default 1 check (id = 1),
  -- Resum al grup de Telegram
  resum_telegram_actiu boolean not null default true,
  resum_telegram_hora smallint not null default 8 check (resum_telegram_hora between 0 and 23),
  -- Resum per correu
  resum_correu_actiu boolean not null default false,
  resum_correu_hora smallint not null default 8 check (resum_correu_hora between 0 and 23),
  resum_correu_dies smallint[] not null default '{1,2,3,4,5,6,7}', -- 1 = dilluns … 7 = diumenge
  resum_correu_destinataris text[] not null default '{}',
  resum_correu_pendents boolean not null default true,
  resum_correu_resoltes_ahir boolean not null default true,
  resum_correu_preventiu boolean not null default true,
  resum_correu_darrer date, -- darrer dia enviat (per no repetir)
  -- Servidor de correu (sense contrasenya)
  smtp_host text not null default 'mail.hotelrull.com',
  smtp_port integer not null default 465,
  smtp_usuari text not null default 'manteniment@hotelrull.com',
  smtp_remitent text not null default 'Manteniment · Hotel Rull',
  actualitzat_el timestamptz not null default now(),
  actualitzat_per uuid references public.usuaris_panell(id) on delete set null
);
insert into public.ajustos (id) values (1) on conflict do nothing;

alter table public.ajustos enable row level security;
create policy ajustos_veure on public.ajustos for select to authenticated
  using ((select privat.te_rol('direccio')));
create policy ajustos_canviar on public.ajustos for update to authenticated
  using ((select privat.te_rol('direccio'))) with check ((select privat.te_rol('direccio')));

-- Qui i quan ha canviat la configuració.
create or replace function privat.ajustos_autor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then -- només canvis fets des del panell (el bot només apunta el darrer enviament)
    new.actualitzat_el := now();
    select u.id into new.actualitzat_per from public.usuaris_panell u where u.auth_id = auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists ajustos_autor on public.ajustos;
create trigger ajustos_autor before update on public.ajustos
  for each row execute function privat.ajustos_autor();
