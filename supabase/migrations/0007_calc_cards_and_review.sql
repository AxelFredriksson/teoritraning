-- Part 2: calc and reasoning cards, retired status, review tracking.
alter table public.cards drop constraint cards_type_check;
alter table public.cards add constraint cards_type_check
  check (type = any (array['content','conditions','recognition','find_error','calc','reasoning']));

alter table public.cards drop constraint cards_answer_mode_check;
alter table public.cards add constraint cards_answer_mode_check
  check (answer_mode = any (array['mc','open','numeric']));

alter table public.cards drop constraint cards_status_check;
alter table public.cards add constraint cards_status_check
  check (status = any (array['active','flagged','rejected','retired']));

alter table public.cards
  add column answer_value double precision,
  add column answer_tolerance double precision,
  add column answer_unit text,
  add column content_hash text,
  add column reviewed_at timestamptz;
