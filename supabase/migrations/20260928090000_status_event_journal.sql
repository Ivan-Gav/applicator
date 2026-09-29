-- Applicator: status_event becomes a journal written by a trigger
--
-- application.status is the current status; status_event records every value
-- it has held. This supersedes the initial schema's note that status_event is
-- the source of truth.
--
-- The trigger runs in the transaction of the write that fired it, so an
-- application and its journal entry exist together or not at all.
--
-- It records what happened and never decides whether a move is legal: that is
-- canTransition() in src/domain/application/rules.ts.

create function public.record_status_event()
returns trigger
language plpgsql
-- security invoker (the default): the insert below passes the status_event
-- RLS policy on its own merits, as the user who wrote the application.
as $$
begin
  insert into public.status_event (user_id, application_id, status)
  values (new.user_id, new.id, new.status);
  return null;
end;
$$;

create trigger application_record_initial_status
  after insert on public.application
  for each row execute function public.record_status_event();

create trigger application_record_status_change
  after update of status on public.application
  for each row
  when (old.status is distinct from new.status)
  execute function public.record_status_event();
