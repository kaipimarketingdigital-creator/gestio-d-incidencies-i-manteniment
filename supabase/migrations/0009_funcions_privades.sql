-- Les funcions que fan servir les polítiques no cal que siguin cridables des de l'API:
-- es mouen a un esquema que no s'exposa. Les polítiques continuen apuntant-hi (per identificador).
create schema if not exists privat;
revoke all on schema privat from public, anon;
grant usage on schema privat to authenticated, service_role;

alter function public.rol_actual() set schema privat;
alter function public.te_rol(rol_panell[]) set schema privat;
alter function public.es_usuari_actiu() set schema privat;

alter function privat.rol_actual() set search_path = public;
alter function privat.te_rol(rol_panell[]) set search_path = public, privat;
alter function privat.es_usuari_actiu() set search_path = public, privat;
