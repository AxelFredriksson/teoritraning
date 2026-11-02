-- Lets a user wipe their own spaced-repetition progress for one lecture of a course.
-- security invoker: runs under the caller's RLS, so it can only touch the caller's own rows.
create function public.reset_lecture_progress(p_course text, p_lecture int) returns void
  language sql security invoker set search_path = public as
$$
  delete from card_state where user_id = auth.uid() and card_id in (
    select c.id from cards c join concepts k on k.id = c.concept_id
    where c.course_id = p_course and k.lecture = p_lecture);
  delete from review_log where user_id = auth.uid() and card_id in (
    select c.id from cards c join concepts k on k.id = c.concept_id
    where c.course_id = p_course and k.lecture = p_lecture);
$$;
revoke execute on function public.reset_lecture_progress(text, int) from public, anon;
grant execute on function public.reset_lecture_progress(text, int) to authenticated;
