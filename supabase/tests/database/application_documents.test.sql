-- Proves that a link between an application and a document version reaches
-- neither another user's application nor another user's document, that adding
-- a version leaves a link as it is, and that the database refuses to delete a
-- document while one of its versions is attached.
--
-- Same impersonation and SQLSTATE matching as rls.test.sql.

begin;
select plan(30);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'alice@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'bob@example.test');

insert into public.application (id, user_id, company_name, position_title, archived_at)
values
  ('a0000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'Acme', 'Engineer', null),
  ('a0000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', 'Globex', 'Engineer', now()),
  ('a0000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b', 'Initech', 'Engineer', null);

insert into public.document (id, user_id, type, title)
values
  ('d0000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-00000000000a', 'cv', 'Alice''s CV'),
  ('d0000000-0000-4000-8000-0000000000ac', '00000000-0000-4000-8000-00000000000a', 'cover_letter', 'Alice''s letter'),
  ('d0000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-00000000000b', 'cv', 'Bob''s CV');

insert into public.document_version
  (id, user_id, document_id, storage_key, file_name, media_type, size_bytes, uploaded_at)
values
  ('e0000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a',
   'd0000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-00000000000a/cv-1',
   'cv-1.pdf', 'application/pdf', 1000, now() - interval '1 day'),
  ('e0000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000a',
   'd0000000-0000-4000-8000-0000000000ac', '00000000-0000-4000-8000-00000000000a/letter-1',
   'letter-1.pdf', 'application/pdf', 1000, now() - interval '1 day'),
  ('e0000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b',
   'd0000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-00000000000b/cv-1',
   'bob.pdf', 'application/pdf', 1000, now() - interval '1 day');

insert into public.application_document
  (user_id, application_id, document_id, document_version_id, position)
values
  ('00000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-0000000000b1',
   'd0000000-0000-4000-8000-0000000000bb', 'e0000000-0000-4000-8000-0000000000b1', 1);

-- Alice ----------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);

select lives_ok(
  $$ insert into public.application_document (user_id, application_id, document_id, document_version_id, position)
     values ('00000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1',
             'd0000000-0000-4000-8000-0000000000aa', 'e0000000-0000-4000-8000-0000000000a1', 1) $$,
  'alice can attach her version to her application'
);
select is(
  (select count(*) from public.application_document),
  1::bigint,
  'alice sees only her own link'
);

-- From her application to someone else's document.
select throws_ok(
  $$ insert into public.application_document (user_id, application_id, document_id, document_version_id, position)
     values ('00000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1',
             'd0000000-0000-4000-8000-0000000000bb', 'e0000000-0000-4000-8000-0000000000b1', 2) $$,
  '23503',
  null,
  'alice cannot attach bob''s version to her application'
);
-- From her document to someone else's application.
select throws_ok(
  $$ insert into public.application_document (user_id, application_id, document_id, document_version_id, position)
     values ('00000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000b1',
             'd0000000-0000-4000-8000-0000000000ac', 'e0000000-0000-4000-8000-0000000000c1', 1) $$,
  '23503',
  null,
  'alice cannot attach her version to bob''s application'
);
select throws_ok(
  $$ insert into public.application_document (user_id, application_id, document_id, document_version_id, position)
     values ('00000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-0000000000b1',
             'd0000000-0000-4000-8000-0000000000bb', 'e0000000-0000-4000-8000-0000000000b1', 2) $$,
  '42501',
  null,
  'alice cannot write a link as bob'
);
select throws_ok(
  $$ update public.application_document
     set document_id = 'd0000000-0000-4000-8000-0000000000bb',
         document_version_id = 'e0000000-0000-4000-8000-0000000000b1'
     where application_id = 'a0000000-0000-4000-8000-0000000000a1' $$,
  '23503',
  null,
  'alice cannot point her link at bob''s version'
);
select throws_ok(
  $$ insert into public.application_document (user_id, application_id, document_id, document_version_id, position)
     values ('00000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a2',
             'd0000000-0000-4000-8000-0000000000ac', 'e0000000-0000-4000-8000-0000000000a1', 1) $$,
  '23503',
  null,
  'a link names its version''s own document'
);

delete from public.application_document where application_id = 'a0000000-0000-4000-8000-0000000000b1';
update public.application_document set position = 9 where application_id = 'a0000000-0000-4000-8000-0000000000b1';

-- Adding a version --------------------------------------------------------------

insert into public.document_version
  (id, user_id, document_id, storage_key, file_name, media_type, size_bytes, label)
values
  ('e0000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a',
   'd0000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-00000000000a/cv-2',
   'cv-2.pdf', 'application/pdf', 1200, 'newer');

select is(
  (select document_version_id from public.application_document
   where application_id = 'a0000000-0000-4000-8000-0000000000a1'),
  'e0000000-0000-4000-8000-0000000000a1'::uuid,
  'adding a newer version leaves the attached version as it was'
);

select throws_ok(
  $$ insert into public.application_document (user_id, application_id, document_id, document_version_id, position)
     values ('00000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1',
             'd0000000-0000-4000-8000-0000000000aa', 'e0000000-0000-4000-8000-0000000000a2', 2) $$,
  '23505',
  null,
  'a document is attached to an application once'
);

-- Deleting an attached document -------------------------------------------------

select throws_ok(
  $$ select public.delete_document('00000000-0000-4000-8000-00000000000a',
                                   'd0000000-0000-4000-8000-0000000000aa') $$,
  '23503',
  null,
  'delete_document refuses a document with an attached version'
);
select throws_ok(
  $$ delete from public.document where id = 'd0000000-0000-4000-8000-0000000000aa' $$,
  '23503',
  null,
  'deleting the document row is refused while a version is attached'
);
select throws_ok(
  $$ delete from public.document_version where id = 'e0000000-0000-4000-8000-0000000000a1' $$,
  '23503',
  null,
  'deleting the attached version is refused'
);
select is(
  (select count(*) from public.document_version where document_id = 'd0000000-0000-4000-8000-0000000000aa'),
  2::bigint,
  'the refused deletions left both versions'
);

-- replace_application_documents -----------------------------------------------

select lives_ok(
  $$ select public.replace_application_documents(
       '00000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1',
       array['e0000000-0000-4000-8000-0000000000c1', 'e0000000-0000-4000-8000-0000000000a2']::uuid[]) $$,
  'alice can replace the versions attached to her application'
);
select results_eq(
  $$ select document_version_id, position from public.application_document
     where application_id = 'a0000000-0000-4000-8000-0000000000a1' order by position $$,
  $$ values ('e0000000-0000-4000-8000-0000000000c1'::uuid, 1::smallint),
            ('e0000000-0000-4000-8000-0000000000a2'::uuid, 2::smallint) $$,
  'the versions are attached in the order given, the CV now at its newer version'
);
select throws_ok(
  $$ select public.replace_application_documents(
       '00000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1',
       array['e0000000-0000-4000-8000-0000000000b1']::uuid[]) $$,
  '23503',
  null,
  'replacing refuses bob''s version'
);
select throws_ok(
  $$ select public.replace_application_documents(
       '00000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1',
       array['e0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-0000000000a2']::uuid[]) $$,
  '23505',
  null,
  'replacing refuses two versions of one document'
);
select is(
  (select count(*) from public.application_document
   where application_id = 'a0000000-0000-4000-8000-0000000000a1'),
  2::bigint,
  'a refused replacement leaves the links as they were'
);
select throws_ok(
  $$ select public.replace_application_documents(
       '00000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000b1',
       array[]::uuid[]) $$,
  '23503',
  null,
  'replacing refuses bob''s application'
);
select throws_ok(
  $$ select public.replace_application_documents(
       '00000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-0000000000b1',
       array['e0000000-0000-4000-8000-0000000000b1']::uuid[]) $$,
  '23503',
  null,
  'replacing as bob reaches none of bob''s rows'
);

-- An archived application holds the document as well.
select lives_ok(
  $$ select public.replace_application_documents(
       '00000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a2',
       array['e0000000-0000-4000-8000-0000000000a1']::uuid[]) $$,
  'alice can attach a version to her archived application'
);
select lives_ok(
  $$ select public.replace_application_documents(
       '00000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a1',
       array[]::uuid[]) $$,
  'alice can detach everything from an application'
);
select throws_ok(
  $$ select public.delete_document('00000000-0000-4000-8000-00000000000a',
                                   'd0000000-0000-4000-8000-0000000000aa') $$,
  '23503',
  null,
  'an archived application still holds the document'
);

-- Deleting an application removes its links, and the document can go.
delete from public.application where id = 'a0000000-0000-4000-8000-0000000000a2';
select is(
  (select count(*) from public.application_document),
  0::bigint,
  'deleting the application deleted its links'
);
select set_eq(
  $$ select public.delete_document('00000000-0000-4000-8000-00000000000a',
                                   'd0000000-0000-4000-8000-0000000000aa') $$,
  array['00000000-0000-4000-8000-00000000000a/cv-1', '00000000-0000-4000-8000-00000000000a/cv-2'],
  'a document attached nowhere is deleted'
);

-- Bob ------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}',
  true
);

select results_eq(
  $$ select application_id, document_version_id, position from public.application_document $$,
  $$ values ('a0000000-0000-4000-8000-0000000000b1'::uuid, 'e0000000-0000-4000-8000-0000000000b1'::uuid, 1::smallint) $$,
  'bob''s link survived alice''s attempts unchanged'
);

-- Anonymous ------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '', true);

select is((select count(*) from public.application_document), 0::bigint, 'anonymous sees no links');
select throws_ok(
  $$ select public.replace_application_documents(
       '00000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-0000000000b1',
       array[]::uuid[]) $$,
  '42501',
  null,
  'anonymous cannot call replace_application_documents'
);

-- Deleting a user ------------------------------------------------------------

reset role;

select lives_ok(
  $$ delete from auth.users where id = '00000000-0000-4000-8000-00000000000b' $$,
  'a user with attached versions can be deleted'
);
select is(
  (select count(*) from public.document_version where user_id = '00000000-0000-4000-8000-00000000000b'),
  0::bigint,
  'deleting a user deletes their versions with their links'
);

select * from finish();
rollback;
