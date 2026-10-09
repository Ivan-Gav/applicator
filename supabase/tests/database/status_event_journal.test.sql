-- Proves that writes to public.application journal their status into
-- public.status_event, as the user who made them, at status_changed_at.
--
-- Runs as alice through RLS, the way PostgREST does, so the journal insert must
-- pass the status_event policy rather than a superuser bypass. Rolled back at
-- the end.

begin;
select plan(12);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'alice@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'bob@example.test');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);

insert into public.application (id, user_id, company_name, position_title, status, status_changed_at)
values (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000000a',
  'Acme',
  'Engineer',
  'applied',
  '2026-09-01 08:00+00'
);

select results_eq(
  $$ select user_id, status, occurred_at from public.status_event
     where application_id = '00000000-0000-4000-8000-0000000000a1' $$,
  $$ values ('00000000-0000-4000-8000-00000000000a'::uuid, 'applied'::text,
             '2026-09-01 08:00+00'::timestamptz) $$,
  'an insert journals the initial status at its status_changed_at, with the owner''s user_id'
);

insert into public.application (id, user_id, company_name, position_title)
values (
  '00000000-0000-4000-8000-0000000000a2',
  '00000000-0000-4000-8000-00000000000a',
  'Globex',
  'Engineer'
);

select results_eq(
  $$ select status, occurred_at from public.status_event
     where application_id = '00000000-0000-4000-8000-0000000000a2' $$,
  $$ values ('draft'::text, now()) $$,
  'an insert relying on the column defaults journals those defaults'
);

-- An instant in the past, as when a reply is recorded days after it arrived.
update public.application
set status = 'screening', status_changed_at = '2026-09-05 22:00+00'
where id = '00000000-0000-4000-8000-0000000000a1';

select results_eq(
  $$ select status, occurred_at from public.status_event
     where application_id = '00000000-0000-4000-8000-0000000000a1'
     order by occurred_at $$,
  $$ values ('applied'::text, '2026-09-01 08:00+00'::timestamptz),
            ('screening'::text, '2026-09-05 22:00+00'::timestamptz) $$,
  'a status change appends one row at its status_changed_at, copied verbatim'
);

update public.application
set notes = 'Recruiter called', last_contact_at = '2026-09-07 10:00+00'
where id = '00000000-0000-4000-8000-0000000000a1';

select is(
  (select count(*) from public.status_event
   where application_id = '00000000-0000-4000-8000-0000000000a1'),
  2::bigint,
  'an update that leaves status and status_changed_at alone journals nothing'
);

select is(
  (select occurred_at from public.status_event
   where application_id = '00000000-0000-4000-8000-0000000000a1' and status = 'screening'),
  '2026-09-05 22:00+00'::timestamptz,
  'last_contact_at does not reach the journal'
);

update public.application
set status = 'screening'
where id = '00000000-0000-4000-8000-0000000000a1';

select is(
  (select count(*) from public.status_event
   where application_id = '00000000-0000-4000-8000-0000000000a1'),
  2::bigint,
  'setting status to its current value at the same instant journals nothing'
);

update public.application
set status = 'interview', status_changed_at = '2026-09-10 08:00+00'
where id = '00000000-0000-4000-8000-0000000000a1';
update public.application
set status_changed_at = '2026-09-17 08:00+00'
where id = '00000000-0000-4000-8000-0000000000a1';

select results_eq(
  $$ select status, occurred_at from public.status_event
     where application_id = '00000000-0000-4000-8000-0000000000a1' and status = 'interview'
     order by occurred_at $$,
  $$ values ('interview'::text, '2026-09-10 08:00+00'::timestamptz),
            ('interview'::text, '2026-09-17 08:00+00'::timestamptz) $$,
  'the same status at a new instant is journalled as a new round'
);

-- The journal records any move, an unlikely one included.
update public.application
set status = 'draft'
where id = '00000000-0000-4000-8000-0000000000a1';

select is(
  (select count(*) from public.status_event
   where application_id = '00000000-0000-4000-8000-0000000000a1'),
  5::bigint,
  'the journal does not judge transitions'
);

select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'status_event' and column_name = 'note'),
  0::bigint,
  'the journal carries no note'
);

-- Another user sees none of it.

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}',
  true
);

select is((select count(*) from public.status_event), 0::bigint, 'bob sees none of alice''s journal');

reset role;

-- As superuser, bypassing RLS: nothing was hidden from alice's view above.
-- Scoped to this test's rows; the database may hold others.
select is(
  (select count(*) from public.status_event
   where application_id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2')),
  6::bigint,
  'all six journal rows exist'
);
select is(
  (select count(*) from public.status_event
   where application_id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2')
     and user_id <> '00000000-0000-4000-8000-00000000000a'),
  0::bigint,
  'every journal row carries the owner''s user_id'
);

select * from finish();
rollback;
