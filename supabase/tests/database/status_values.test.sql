-- Pins the status and interview format values to the ones the domain uses:
-- applicationStatuses in src/domain/application/model.ts. Which status may
-- follow which is not checked here: the database lists values only.
--
-- 23514 is check_violation. Rolled back at the end.

begin;
select plan(7);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-00000000000a', 'alice@example.test');

insert into public.application (id, user_id, company_name, position_title, status)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a',
        'Acme', 'Engineer', 'applied');

select lives_ok(
  $$ update public.application set status = 'assignment'
     where id = '00000000-0000-4000-8000-0000000000a1' $$,
  'an application may be at assignment'
);

select is(
  (select count(*) from public.status_event
   where application_id = '00000000-0000-4000-8000-0000000000a1' and status = 'assignment'),
  1::bigint,
  'the journal records assignment'
);

-- An unlikely move is stored like any other.
select lives_ok(
  $$ update public.application set status = 'offer'
     where id = '00000000-0000-4000-8000-0000000000a1';
     update public.application set status = 'draft'
     where id = '00000000-0000-4000-8000-0000000000a1' $$,
  'any status may follow any other'
);

select throws_ok(
  $$ update public.application set status = 'ghosted'
     where id = '00000000-0000-4000-8000-0000000000a1' $$,
  '23514', null, 'a status outside the list is refused'
);

select lives_ok(
  $$ insert into public.interview (user_id, application_id, format)
     values ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'video') $$,
  'an interview has a medium'
);

select throws_ok(
  $$ insert into public.interview (user_id, application_id, format)
     values ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'take_home') $$,
  '23514', null, 'take_home is not a medium: an assignment is a status, not an interview'
);

select throws_ok(
  $$ insert into public.interview (user_id, application_id, kind)
     values ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'assignment') $$,
  '23514', null, 'assignment is not a kind of interview either'
);

select * from finish();
rollback;
