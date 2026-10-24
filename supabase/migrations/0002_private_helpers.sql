-- Move security-definer helpers out of the exposed API schema
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_allowed() set schema private;
alter function public.is_admin() set schema private;
alter function public.flag_reported_card() set schema private;
alter function private.is_allowed() set search_path = public;
alter function private.is_admin() set search_path = public;
revoke execute on function private.is_allowed() from public, anon;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_allowed() to authenticated;
grant execute on function private.is_admin() to authenticated;
