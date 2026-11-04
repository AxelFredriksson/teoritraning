-- Remembers the verdict of each card's latest answer, so practice can put wrong answers first
-- and a concept counts as finished once every card's latest answer was correct.
alter table card_state add column last_verdict text check (last_verdict in ('correct','partial','incorrect'));

update card_state s set last_verdict = (
  select r.verdict from review_log r
  where r.user_id = s.user_id and r.card_id = s.card_id
  order by r.created_at desc, r.id desc
  limit 1);

-- Lets a user wipe their own spaced-repetition progress for one concept.
-- security invoker: runs under the caller's RLS, so it can only touch the caller's own rows.
create function public.reset_concept_progress(p_concept text) returns void
  language sql security invoker set search_path = public as
$$
  delete from card_state where user_id = auth.uid() and card_id in (
    select c.id from cards c where c.concept_id = p_concept);
  delete from review_log where user_id = auth.uid() and card_id in (
    select c.id from cards c where c.concept_id = p_concept);
$$;
revoke execute on function public.reset_concept_progress(text) from public, anon;
grant execute on function public.reset_concept_progress(text) to authenticated;
