-- Proves that writes to public.application journal their status into
-- public.status_event, as the user who made them.
--
-- Runs as alice through RLS, the way PostgREST does, so the journal insert must
-- pass the status_event policy rather than a superuser bypass. Rolled back at
-- the end.

begin;
select plan(9);

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

insert into public.application (id, user_id, company_name, position_title, status)
values (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-00000000000a',
  'Acme',
  'Engineer',
  'applied'
);

select results_eq(
  $$ select user_id, status from public.status_event
     where application_id = '00000000-0000-4000-8000-0000000000a1' $$,
  $$ values ('00000000-0000-4000-8000-00000000000a'::uuid, 'applied'::text) $$,
  'an insert journals the initial status with the owner''s user_id'
);

insert into public.application (id, user_id, company_name, position_title)
values (
  '00000000-0000-4000-8000-0000000000a2',
  '00000000-0000-4000-8000-00000000000a',
  'Globex',
  'Engineer'
);

select results_eq(
  $$ select status from public.status_event
     where application_id = '00000000-0000-4000-8000-0000000000a2' $$,
  $$ values ('draft'::text) $$,
  'an insert relying on the column default journals that default'
);

update public.application
set status = 'screening'
where id = '00000000-0000-4000-8000-0000000000a1';

-- now() is fixed for the whole transaction, so the rows compare as a bag.
select bag_eq(
  $$ select status from public.status_event
     where application_id = '00000000-0000-4000-8000-0000000000a1' $$,
  $$ values ('applied'::text), ('screening'::text) $$,
  'a status change appends one row'
);

update public.application
set notes = 'Recruiter called'
where id = '00000000-0000-4000-8000-0000000000a1';

select is(
  (select count(*) from public.status_event
   where application_id = '00000000-0000-4000-8000-0000000000a1'),
  2::bigint,
  'an update that leaves status alone journals nothing'
);

update public.application
set status = 'screening'
where id = '00000000-0000-4000-8000-0000000000a1';

select is(
  (select count(*) from public.status_event
   where application_id = '00000000-0000-4000-8000-0000000000a1'),
  2::bigint,
  'setting status to its current value journals nothing'
);

-- Legality is the domain's call: the journal records even a move that
-- canTransition() would refuse.
update public.application
set status = 'draft'
where id = '00000000-0000-4000-8000-0000000000a1';

select is(
  (select count(*) from public.status_event
   where application_id = '00000000-0000-4000-8000-0000000000a1'),
  3::bigint,
  'the journal does not judge transitions'
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
  4::bigint,
  'all four journal rows exist'
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
