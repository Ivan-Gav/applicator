-- Applicator: the document versions sent with an application
--
--   application_document  one document attached to one application, naming
--                         the version that was sent
--
-- A document is attached to an application once; changing the version sent
-- changes document_version_id on that row. The version is stored explicitly:
-- nothing moves a link when a newer version is added.
--
-- A version that is attached cannot be deleted, and so neither can its
-- document: the foreign key to document_version restricts.

-- Targets of the owner-checked foreign keys below.
alter table public.application
  add constraint application_id_user_key unique (id, user_id);
alter table public.document_version
  add constraint document_version_id_document_user_key unique (id, document_id, user_id);

create table public.application_document (
  user_id              uuid not null references auth.users (id) on delete cascade,
  application_id       uuid not null,
  document_id          uuid not null,
  document_version_id  uuid not null,

  -- the order the attachments are listed in, from 1
  position             smallint not null check (position > 0),

  primary key (application_id, document_id),

  -- the application belongs to the same user
  constraint application_document_application_fk
    foreign key (application_id, user_id) references public.application (id, user_id)
    on delete cascade,
  -- the version belongs to the same user and to document_id
  constraint application_document_version_fk
    foreign key (document_version_id, document_id, user_id)
    references public.document_version (id, document_id, user_id)
    on delete restrict
);

create index application_document_version_idx
  on public.application_document (document_version_id, document_id, user_id);
create index application_document_user_idx
  on public.application_document (user_id);

alter table public.application_document enable row level security;

create policy application_document_owner on public.application_document
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Makes p_version_ids, in their order, the versions attached to the
-- application, replacing its rows in one transaction. Raises
-- foreign_key_violation (23503) for a version or an application the caller
-- does not own, and unique_violation (23505) for two versions of one
-- document. Security invoker: RLS applies as to any other query of the caller.
-- ---------------------------------------------------------------------------

create function public.replace_application_documents(
  p_user_id         uuid,
  p_application_id  uuid,
  p_version_ids     uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_attached integer;
begin
  if not exists (
    select 1 from public.application where id = p_application_id and user_id = p_user_id
  ) then
    raise exception 'the application does not exist'
      using errcode = 'foreign_key_violation';
  end if;

  delete from public.application_document
  where application_id = p_application_id and user_id = p_user_id;

  insert into public.application_document
    (user_id, application_id, document_id, document_version_id, position)
  select p_user_id, p_application_id, version.document_id, version.id, listed.position
  from unnest(p_version_ids) with ordinality as listed (version_id, position)
  join public.document_version version
    on version.id = listed.version_id and version.user_id = p_user_id;

  get diagnostics v_attached = row_count;
  if v_attached <> coalesce(cardinality(p_version_ids), 0) then
    raise exception 'a document version to attach does not exist'
      using errcode = 'foreign_key_violation';
  end if;
end;
$$;

revoke execute on function public.replace_application_documents(uuid, uuid, uuid[])
  from public, anon;
grant execute on function public.replace_application_documents(uuid, uuid, uuid[])
  to authenticated;
