-- Lets a user wipe their own spaced-repetition progress for one course.
-- security invoker: runs under the caller's RLS, so it can only touch the caller's own rows.
create function public.reset_course_progress(p_course text) returns void
  language sql security invoker set search_path = public as
$$
  delete from card_state where user_id = auth.uid() and card_id in (select id from cards where course_id = p_course);
  delete from review_log where user_id = auth.uid() and card_id in (select id from cards where course_id = p_course);
$$;
revoke execute on function public.reset_course_progress(text) from public, anon;
grant execute on function public.reset_course_progress(text) to authenticated;
