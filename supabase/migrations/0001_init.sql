-- Teoriträning: schema, RLS, helpers

create table courses (
  id text primary key,
  name text not null,
  archived boolean not null default false
);

create table concepts (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  kind text not null check (kind in ('sats','definition','metod','begrepp')),
  title text not null,
  statement_md text not null,
  source_ref text not null,
  lecture int not null,
  exam_count int not null default 0,
  exam_refs text[] not null default '{}'
);

create table cards (
  id text primary key,
  concept_id text not null references concepts(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  type text not null check (type in ('content','conditions','recognition','find_error')),
  answer_mode text not null check (answer_mode in ('mc','open')),
  prompt_md text not null,
  choices jsonb,
  correct jsonb,
  reference_answer_md text not null,
  rubric_md text,
  steps jsonb,
  error_step int,
  source_ref text not null,
  exam_ref text,
  status text not null default 'active' check (status in ('active','flagged','rejected')),
  verify_note text
);
create index cards_course_idx on cards(course_id);

create table allowed_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false
);

create table card_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null references cards(id) on delete cascade,
  fsrs jsonb not null,
  due timestamptz not null,
  primary key (user_id, card_id)
);

create table review_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null references cards(id) on delete cascade,
  verdict text not null check (verdict in ('correct','partial','incorrect')),
  source text not null check (source in ('ai','mc','self')),
  created_at timestamptz not null default now()
);

create table grading_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  model text not null,
  kind text not null check (kind in ('text','image')),
  ok boolean not null,
  est_cost_sek numeric not null default 0,
  created_at timestamptz not null default now()
);
create index grading_log_user_time_idx on grading_log(user_id, created_at);

create table card_reports (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null references cards(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create table user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points int not null default 0,
  streak int not null default 0,
  last_active date
);

create table settings (
  key text primary key,
  value jsonb
);
insert into settings (key, value) values
  ('provider', '"claude"'),
  ('claude_text_model', '"claude-haiku-5-5"'),
  ('claude_image_model', '"claude-sonnet-5-5"'),
  ('gemini_model', 'null');

-- helpers
create function is_allowed() returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from allowed_users where user_id = auth.uid()) $$;

create function is_admin() returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from allowed_users where user_id = auth.uid() and is_admin) $$;

-- a report takes the card out of rotation
create function flag_reported_card() returns trigger
  language plpgsql security definer set search_path = public as
  $$ begin
    update cards set status = 'flagged' where id = new.card_id and status = 'active';
    return new;
  end $$;
create trigger card_reports_flag after insert on card_reports
  for each row execute function flag_reported_card();

-- RLS
alter table courses enable row level security;
alter table concepts enable row level security;
alter table cards enable row level security;
alter table allowed_users enable row level security;
alter table card_state enable row level security;
alter table review_log enable row level security;
alter table grading_log enable row level security;
alter table card_reports enable row level security;
alter table user_stats enable row level security;
alter table settings enable row level security;

create policy courses_read on courses for select to authenticated using (is_allowed());
create policy concepts_read on concepts for select to authenticated using (is_allowed());
create policy cards_read on cards for select to authenticated using (is_allowed());
create policy cards_admin_update on cards for update to authenticated using (is_admin()) with check (is_admin());

create policy allowed_users_self on allowed_users for select to authenticated using (user_id = auth.uid());

create policy card_state_own on card_state for all to authenticated
  using (user_id = auth.uid() and is_allowed()) with check (user_id = auth.uid() and is_allowed());
create policy review_log_own on review_log for all to authenticated
  using (user_id = auth.uid() and is_allowed()) with check (user_id = auth.uid() and is_allowed());
create policy card_reports_own on card_reports for all to authenticated
  using (user_id = auth.uid() and is_allowed()) with check (user_id = auth.uid() and is_allowed());
create policy card_reports_admin_read on card_reports for select to authenticated using (is_admin());
create policy user_stats_own on user_stats for all to authenticated
  using (user_id = auth.uid() and is_allowed()) with check (user_id = auth.uid() and is_allowed());

-- grading_log is written only by the Edge Function (service role bypasses RLS)
create policy grading_log_read on grading_log for select to authenticated
  using ((user_id = auth.uid() and is_allowed()) or is_admin());

create policy settings_read on settings for select to authenticated using (is_allowed());
create policy settings_admin_update on settings for update to authenticated using (is_admin()) with check (is_admin());

revoke execute on function flag_reported_card() from public, anon, authenticated;
