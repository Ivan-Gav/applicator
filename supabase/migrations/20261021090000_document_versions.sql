-- Applicator: documents with immutable versions, and the private bucket for their files
--
--   document          an identity: type, title, language ("CV, English")
--   document_version  one file of a document; never changed once stored
--
-- A document's current version is its newest.
--
-- storage_key is an opaque key in the documents bucket, never a URL. Its first
-- path segment is the owner's user id, which the storage policies key on.
--
-- Nothing has ever written to the previous document table or to
-- application_document; both are replaced. Applications will link to a version
-- in a later migration.

do $$
begin
  if exists (select 1 from public.document) or exists (select 1 from public.application_document) then
    raise exception 'public.document or public.application_document holds rows; they have no file metadata to migrate';
  end if;
end;
$$;

drop table public.application_document;
drop table public.document;

-- ---------------------------------------------------------------------------
-- document
-- ---------------------------------------------------------------------------

create table public.document (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  type        text not null
              check (type in ('cv', 'cover_letter', 'certificate', 'diploma',
                              'reference', 'portfolio', 'other')),
  title       text not null check (char_length(title) between 1 and 200),
  -- any ISO 639-1 code; the app offers a few
  language    text check (language ~ '^[a-z]{2}$'),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- target of document_version's owner-checked foreign key
  constraint document_id_user_key unique (id, user_id)
);

create index document_user_idx on public.document (user_id);

create trigger document_set_updated_at
  before update on public.document
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- document_version
-- ---------------------------------------------------------------------------

create table public.document_version (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  document_id  uuid not null,

  storage_key  text not null unique,
  file_name    text not null check (char_length(file_name) between 1 and 255),
  media_type   text not null
               check (media_type in (
                 'application/pdf',
                 'application/msword',
                 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                 'application/vnd.oasis.opendocument.text',
                 'application/rtf',
                 'text/plain',
                 'image/png',
                 'image/jpeg',
                 'image/webp'
               )),
  size_bytes   integer not null check (size_bytes between 1 and 4194304),
  label        text check (char_length(label) between 1 and 100),  -- "backend-heavy", "DE short"

  uploaded_at  timestamptz not null default now(),

  -- a version belongs to a document of the same user
  constraint document_version_document_fk
    foreign key (document_id, user_id) references public.document (id, user_id)
    on delete cascade
);

create index document_version_document_idx
  on public.document_version (document_id, uploaded_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- document_version has no update policy: a stored version cannot be changed.
-- ---------------------------------------------------------------------------

alter table public.document         enable row level security;
alter table public.document_version enable row level security;

create policy document_owner on public.document
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy document_version_select on public.document_version
  for select using ((select auth.uid()) = user_id);

create policy document_version_insert on public.document_version
  for insert with check ((select auth.uid()) = user_id);

create policy document_version_delete on public.document_version
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Writes spanning both tables, each in one transaction. Security invoker: RLS
-- applies as to any other query of the caller.
-- ---------------------------------------------------------------------------

-- A new document with its first version. Returns the document's id.
create function public.create_document(
  p_user_id     uuid,
  p_type        text,
  p_title       text,
  p_storage_key text,
  p_file_name   text,
  p_media_type  text,
  p_size_bytes  integer,
  p_language    text default null,
  p_label       text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_document_id uuid;
begin
  insert into public.document (user_id, type, title, language)
  values (p_user_id, p_type, p_title, p_language)
  returning id into v_document_id;

  insert into public.document_version
    (user_id, document_id, storage_key, file_name, media_type, size_bytes, label)
  values
    (p_user_id, v_document_id, p_storage_key, p_file_name, p_media_type, p_size_bytes, p_label);

  return v_document_id;
end;
$$;

-- Deletes a document with its versions. Returns the storage keys of their
-- files, which storage does not delete with the rows.
create function public.delete_document(p_user_id uuid, p_document_id uuid)
returns setof text
language plpgsql
set search_path = ''
as $$
begin
  return query
    delete from public.document_version
    where document_id = p_document_id and user_id = p_user_id
    returning storage_key;

  delete from public.document where id = p_document_id and user_id = p_user_id;
end;
$$;

revoke execute on function public.create_document(uuid, text, text, text, text, text, integer, text, text)
  from public, anon;
revoke execute on function public.delete_document(uuid, uuid)
  from public, anon;

grant execute on function public.create_document(uuid, text, text, text, text, text, integer, text, text)
  to authenticated;
grant execute on function public.delete_document(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: the private documents bucket
--
-- Policies on storage.objects are separate from the table policies above. A
-- file is reachable only by the user whose id is the first segment of its key.
-- There is no update policy: a stored file cannot be overwritten.
-- The bucket's limits repeat the ones the app checks.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  4194304,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
);

create policy document_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy document_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy document_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
