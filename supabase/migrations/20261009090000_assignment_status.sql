-- Applicator: the assignment status, and take_home leaves interview.format
--
-- assignment is a take-home task. It is recorded by the status alone and dated
-- by the status history; the interview table records conversations only, so
-- take_home, which has no medium, leaves interview.format. A table of its own
-- for assignments (given, due, submitted, outcome) is deferred.
--
-- Which status may follow which is not the database's concern: the CHECKs list
-- the values only.

alter table public.application drop constraint application_status_check;
alter table public.application add constraint application_status_check
  check (status in ('draft', 'applied', 'screening', 'assignment', 'interview',
                    'offer', 'rejected', 'withdrawn'));

alter table public.status_event drop constraint status_event_status_check;
alter table public.status_event add constraint status_event_status_check
  check (status in ('draft', 'applied', 'screening', 'assignment', 'interview',
                    'offer', 'rejected', 'withdrawn'));

-- Cleared first, or the narrower CHECK below fails on a database that holds such rows.
update public.interview set format = null where format = 'take_home';

alter table public.interview drop constraint interview_format_check;
alter table public.interview add constraint interview_format_check
  check (format in ('phone', 'video', 'on_site', 'other'));
