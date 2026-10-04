-- Applicator: every salary has a period, per year unless chosen otherwise

update public.application
   set salary_period = 'year'
 where salary_period is null;

alter table public.application
  alter column salary_period set default 'year',
  alter column salary_period set not null;
