-- Proves that row level security isolates users on document and
-- document_version, that versions cannot change, and that the functions
-- writing both tables act only for their caller.
--
-- Same impersonation and SQLSTATE matching as rls.test.sql.

begin;
select plan(17);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'alice@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'bob@example.test');

insert into public.document (id, user_id, type, title)
values
  ('d0000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'cv', 'Alice''s CV'),
  ('d0000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 'cv', 'Bob''s CV');

insert into public.document_version
  (id, user_id, document_id, storage_key, file_name, media_type, size_bytes)
values
  ('e0000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a',
   'd0000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a/alice-1',
   'alice.pdf', 'application/pdf', 1000),
  ('e0000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b',
   'd0000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b/bob-1',
   'bob.pdf', 'application/pdf', 1000);

-- Alice ----------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);

select is((select count(*) from public.document), 1::bigint, 'alice sees exactly one document');
select is((select title from public.document), 'Alice''s CV', 'the document alice sees is her own');
select is(
  (select storage_key from public.document_version),
  '00000000-0000-4000-8000-00000000000a/alice-1',
  'alice sees only her own version'
);

update public.document_version set file_name = 'changed.pdf';
select is(
  (select file_name from public.document_version),
  'alice.pdf',
  'alice cannot change a stored version'
);

select lives_ok(
  $$ insert into public.document_version (user_id, document_id, storage_key, file_name, media_type, size_bytes, label)
     values ('00000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-00000000000a',
             '00000000-0000-4000-8000-00000000000a/alice-2', 'alice-2.pdf', 'application/pdf', 1200, 'short') $$,
  'alice can add a version to her document'
);
select throws_ok(
  $$ insert into public.document_version (user_id, document_id, storage_key, file_name, media_type, size_bytes)
     values ('00000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-00000000000b',
             '00000000-0000-4000-8000-00000000000a/sneaky', 'sneaky.pdf', 'application/pdf', 1) $$,
  '23503',
  null,
  'alice cannot add a version to bob''s document'
);

select isnt(
  public.create_document(
    '00000000-0000-4000-8000-00000000000a', 'diploma', 'MSc',
    '00000000-0000-4000-8000-00000000000a/msc-1', 'msc.pdf', 'application/pdf', 2000, 'en'
  ),
  null,
  'alice can create a document with its first version'
);
select is(
  (select count(*) from public.document_version v join public.document d on d.id = v.document_id
   where d.title = 'MSc'),
  1::bigint,
  'the new document has its first version'
);
select throws_ok(
  $$ select public.create_document(
       '00000000-0000-4000-8000-00000000000b', 'cv', 'Forged', '00000000-0000-4000-8000-00000000000b/forged',
       'forged.pdf', 'application/pdf', 1) $$,
  '42501',
  null,
  'alice cannot create a document for bob'
);
select throws_ok(
  $$ select public.create_document(
       '00000000-0000-4000-8000-00000000000a', 'passport', 'Passport', '00000000-0000-4000-8000-00000000000a/passport',
       'passport.pdf', 'application/pdf', 1) $$,
  '23514',
  null,
  'a document type outside the list is refused'
);

select is_empty(
  $$ select public.delete_document('00000000-0000-4000-8000-00000000000a',
                                   'd0000000-0000-4000-8000-00000000000b') $$,
  'deleting bob''s document returns no file'
);
select set_eq(
  $$ select public.delete_document('00000000-0000-4000-8000-00000000000a',
                                   'd0000000-0000-4000-8000-00000000000a') $$,
  array['00000000-0000-4000-8000-00000000000a/alice-1', '00000000-0000-4000-8000-00000000000a/alice-2'],
  'deleting her document returns the keys of all its files'
);
select is(
  (select count(*) from public.document_version where document_id = 'd0000000-0000-4000-8000-00000000000a'),
  0::bigint,
  'the deleted document''s versions are gone'
);

-- Bob ------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.document_version),
  1::bigint,
  'bob''s version survived alice''s attempts'
);

-- Anonymous ------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '', true);

select is((select count(*) from public.document), 0::bigint, 'anonymous sees no documents');
select throws_ok(
  $$ select public.create_document(
       '00000000-0000-4000-8000-00000000000a', 'cv', 'Anonymous', '00000000-0000-4000-8000-00000000000a/anon',
       'anon.pdf', 'application/pdf', 1) $$,
  '42501',
  null,
  'anonymous cannot call create_document'
);

-- Deleting a user ------------------------------------------------------------

reset role;
delete from auth.users where id = '00000000-0000-4000-8000-00000000000b';

select is(
  (select count(*) from public.document_version where user_id = '00000000-0000-4000-8000-00000000000b'),
  0::bigint,
  'deleting a user deletes their versions'
);

select * from finish();
rollback;
