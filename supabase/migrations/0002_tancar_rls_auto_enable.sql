-- La funció rls_auto_enable() la crea Supabase en activar "Enable automatic RLS".
-- No l'ha de poder executar ningú des de l'API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
