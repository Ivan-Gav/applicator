-- Applicator: the instant the current status was entered
--
-- application.status_changed_at is written together with status. The journal
-- copies it verbatim as occurred_at; it is the only source of that instant.
--
-- A repeated status with a new instant (another interview round) is a change
-- of its own and is journalled too.

alter table public.application add column status_changed_at timestamptz;

alter table public.application disable trigger application_set_updated_at;

update public.application as a
set status_changed_at = coalesce(
  (select max(e.occurred_at) from public.status_event as e where e.application_id = a.id),
  a.created_at
);

alter table public.application enable trigger application_set_updated_at;

alter table public.application
  alter column status_changed_at set default now(),
  alter column status_changed_at set not null;

create or replace function public.record_status_event()
returns trigger
language plpgsql
-- security invoker (the default): the insert below passes the status_event
-- RLS policy on its own merits, as the user who wrote the application.
as $$
begin
  insert into public.status_event (user_id, application_id, status, occurred_at)
  values (new.user_id, new.id, new.status, new.status_changed_at);
  return null;
end;
$$;

drop trigger application_record_status_change on public.application;

create trigger application_record_status_change
  after update of status, status_changed_at on public.application
  for each row
  when (
    old.status is distinct from new.status
    or old.status_changed_at is distinct from new.status_changed_at
  )
  execute function public.record_status_event();
