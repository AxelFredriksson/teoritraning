-- Idempotent review_log writes (client-generated id)
alter table review_log add column client_id uuid unique;

-- Atomic grading reservation: serialises per user, counts, and inserts a pending log row.
-- Returns {"id": <log id>} or {"reason": "hour" | "day" | "image_day"}.
create function public.reserve_grading(p_user uuid, p_kind text, p_hour_max int, p_day_max int, p_image_max int)
  returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  n_hour int; n_day int; n_img int; new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  select count(*) filter (where created_at > now() - interval '1 hour'),
         count(*),
         count(*) filter (where kind = 'image')
    into n_hour, n_day, n_img
    from grading_log where user_id = p_user and created_at > now() - interval '1 day';
  if n_hour >= p_hour_max then return jsonb_build_object('reason', 'hour'); end if;
  if n_day >= p_day_max then return jsonb_build_object('reason', 'day'); end if;
  if p_kind = 'image' and n_img >= p_image_max then return jsonb_build_object('reason', 'image_day'); end if;
  insert into grading_log (user_id, provider, model, kind, ok, est_cost_sek)
    values (p_user, 'pending', 'pending', p_kind, false, 0) returning id into new_id;
  return jsonb_build_object('id', new_id);
end
$$;
revoke execute on function public.reserve_grading(uuid, text, int, int, int) from public, anon, authenticated;
grant execute on function public.reserve_grading(uuid, text, int, int, int) to service_role;
