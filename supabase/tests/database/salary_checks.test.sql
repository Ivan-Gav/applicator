-- Pins the salary CHECK constraints to the values createApplicationSchema
-- accepts and rejects; src/domain/application/schema.test.ts holds the mirror.
--
-- 23514 is check_violation, 22003 numeric_value_out_of_range, 23502
-- not_null_violation. Rolled back at the end.

begin;
select plan(14);

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-00000000000a', 'alice@example.test');

select lives_ok(
  $$ insert into public.application (user_id, company_name, position_title,
       salary_advertised_min, salary_advertised_max, salary_asked_min, salary_asked_max,
       salary_estimated_min, salary_estimated_max, salary_currency)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer',
       0, 2147483647, 70000, 70000, 60000, null, 'CHF') $$,
  'zero, the int4 maximum, an exact figure and an open range are accepted'
);
select lives_ok(
  $$ insert into public.application (user_id, company_name, position_title,
       salary_currency)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', null) $$,
  'every amount and the currency may be unknown'
);

select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title, salary_advertised_min)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', -1) $$,
  '23514', null, 'a negative advertised minimum is refused'
);
select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title, salary_asked_max)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', -1) $$,
  '23514', null, 'a negative asked maximum is refused'
);
select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title, salary_estimated_min)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', -1) $$,
  '23514', null, 'a negative estimated minimum is refused'
);
select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title,
       salary_advertised_min, salary_advertised_max)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', 80000, 70000) $$,
  '23514', null, 'an advertised minimum above its maximum is refused'
);
select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title,
       salary_asked_min, salary_asked_max)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', 80000, 70000) $$,
  '23514', null, 'an asked minimum above its maximum is refused'
);
select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title,
       salary_estimated_min, salary_estimated_max)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', 80000, 70000) $$,
  '23514', null, 'a estimated minimum above its maximum is refused'
);
select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title, salary_advertised_max)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', 2147483648) $$,
  '22003', null, 'an amount beyond int4 is refused'
);
select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title, salary_currency)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', 'eur') $$,
  '23514', null, 'a lower case currency is refused'
);
select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title, salary_currency)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', '€€€') $$,
  '23514', null, 'a currency that is not letters is refused'
);
select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title, salary_period)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', 'week') $$,
  '23514', null, 'a period outside the enumeration is refused'
);
select throws_ok(
  $$ insert into public.application (user_id, company_name, position_title, salary_period)
     values ('00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', null) $$,
  '23502', null, 'a missing period is refused'
);
select is(
  (select salary_period from public.application
    where user_id = '00000000-0000-4000-8000-00000000000a' and company_name = 'Acme'
    limit 1),
  'year',
  'a period left out is per year'
);

select * from finish();
rollback;
