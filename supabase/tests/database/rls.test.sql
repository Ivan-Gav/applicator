-- Proves that row level security isolates users on public.application.
--
-- Runs inside one transaction that is rolled back at the end, so nothing it
-- inserts survives. The test connection is a superuser, which bypasses RLS the
-- same way the service role does; that is what makes the setup inserts possible.
-- Impersonation works the way PostgREST does it: switch to the `authenticated`
-- role and put the user's claims into request.jwt.claims, which auth.uid() reads.
--
-- Refused writes are matched on SQLSTATE only, never on the message text. 42501
-- (insufficient_privilege) is also what a missing table grant would raise, so
-- alice first proves she can insert her own row: after that, 42501 on a foreign
-- user_id can only come from the policy.

begin;
select plan(13);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'alice@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'bob@example.test');

insert into public.application (user_id, company_name, position_title)
values
  ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Alice''s application'),
  ('00000000-0000-4000-8000-00000000000b', 'Acme', 'Bob''s application');

select is(
  (select count(*) from public.application),
  2::bigint,
  'service role (RLS bypass) sees both rows'
);

-- Alice ----------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);

select is(auth.uid(), '00000000-0000-4000-8000-00000000000a'::uuid, 'auth.uid() resolves to alice');
select is((select count(*) from public.application), 1::bigint, 'alice sees exactly one row');
select is(
  (select position_title from public.application),
  'Alice''s application',
  'the row alice sees is her own'
);
select lives_ok(
  $$ insert into public.application (user_id, company_name, position_title)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Alice''s second') $$,
  'alice can insert a row she owns'
);
select is((select count(*) from public.application), 2::bigint, 'alice sees her new row');
select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title)
     values ('00000000-0000-4000-8000-00000000000b', 'Acme', 'forged') $$,
  '42501',
  null,
  'alice cannot insert a row owned by bob'
);

-- Bob ------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}',
  true
);

select is(auth.uid(), '00000000-0000-4000-8000-00000000000b'::uuid, 'auth.uid() resolves to bob');
select is((select count(*) from public.application), 1::bigint, 'bob sees exactly one row');
select is(
  (select position_title from public.application),
  'Bob''s application',
  'the row bob sees is his own'
);

-- Anonymous ------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '', true);

select is(auth.uid(), null, 'auth.uid() is null for an anonymous request');
select is((select count(*) from public.application), 0::bigint, 'anonymous sees no rows');
select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'anonymous write') $$,
  '42501',
  null,
  'anonymous cannot insert'
);

reset role;

select * from finish();
rollback;
