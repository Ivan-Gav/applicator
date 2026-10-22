-- Proves that the storage policies isolate users' files in the documents bucket.
--
-- Storage policies live on storage.objects, apart from the table policies:
-- this file checks them the way rls.test.sql checks the tables, through the
-- same impersonation. The Storage API runs these same queries as the
-- requesting user, so what holds here holds for uploads, downloads, signed
-- links and deletions.
--
-- storage.protect_delete() refuses a DELETE unless storage.allow_delete_query
-- is set, as the Storage API sets it; the deletions below set it too.
--
-- Counts made without RLS look at alice's and bob's folders only: the local
-- bucket may hold real users' files.

begin;
select plan(18);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'alice@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'bob@example.test');

insert into storage.objects (bucket_id, name, owner_id)
values
  ('documents', '00000000-0000-4000-8000-00000000000a/10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a'),
  ('documents', '00000000-0000-4000-8000-00000000000b/20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000b');

select is(
  (select public from storage.buckets where id = 'documents'),
  false,
  'the documents bucket is private'
);
select is(
  (select count(*) from storage.objects
   where bucket_id = 'documents'
     and (storage.foldername(name))[1] in ('00000000-0000-4000-8000-00000000000a',
                                           '00000000-0000-4000-8000-00000000000b')),
  2::bigint,
  'service role (RLS bypass) sees both files'
);

-- Alice ----------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);
select set_config('storage.allow_delete_query', 'true', true);

select is(
  (select count(*) from storage.objects where bucket_id = 'documents'),
  1::bigint,
  'alice sees exactly one file'
);
select is(
  (select name from storage.objects where bucket_id = 'documents'),
  '00000000-0000-4000-8000-00000000000a/10000000-0000-4000-8000-000000000001',
  'the file alice sees is in her own folder'
);
select is(
  (select count(*) from storage.objects
   where name = '00000000-0000-4000-8000-00000000000b/20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'alice cannot find bob''s file by its key'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('documents', '00000000-0000-4000-8000-00000000000a/10000000-0000-4000-8000-000000000002',
             '00000000-0000-4000-8000-00000000000a') $$,
  'alice can store a file in her own folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('documents', '00000000-0000-4000-8000-00000000000b/10000000-0000-4000-8000-000000000003',
             '00000000-0000-4000-8000-00000000000a') $$,
  '42501',
  null,
  'alice cannot store a file in bob''s folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('documents', '10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000000a') $$,
  '42501',
  null,
  'alice cannot store a file outside any folder'
);

-- No update policy: the update finds no row to change.
update storage.objects
   set name = '00000000-0000-4000-8000-00000000000a/replaced'
 where name = '00000000-0000-4000-8000-00000000000a/10000000-0000-4000-8000-000000000001';
select is(
  (select count(*) from storage.objects
   where name = '00000000-0000-4000-8000-00000000000a/10000000-0000-4000-8000-000000000001'),
  1::bigint,
  'alice cannot change a stored file'
);

delete from storage.objects
 where name = '00000000-0000-4000-8000-00000000000b/20000000-0000-4000-8000-000000000001';
delete from storage.objects
 where name = '00000000-0000-4000-8000-00000000000a/10000000-0000-4000-8000-000000000002';
select is(
  (select count(*) from storage.objects where bucket_id = 'documents'),
  1::bigint,
  'alice can delete her own file'
);

-- Bob ------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}',
  true
);

select is(
  (select count(*) from storage.objects where bucket_id = 'documents'),
  1::bigint,
  'bob sees exactly one file'
);
select is(
  (select name from storage.objects where bucket_id = 'documents'),
  '00000000-0000-4000-8000-00000000000b/20000000-0000-4000-8000-000000000001',
  'the file bob sees is his own, which alice''s delete did not reach'
);

delete from storage.objects
 where name = '00000000-0000-4000-8000-00000000000a/10000000-0000-4000-8000-000000000001';

-- Anonymous ------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*) from storage.objects where bucket_id = 'documents'),
  0::bigint,
  'anonymous sees no file'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('documents', '00000000-0000-4000-8000-00000000000a/30000000-0000-4000-8000-000000000001') $$,
  '42501',
  null,
  'anonymous cannot store a file'
);

delete from storage.objects where bucket_id = 'documents';

-- After all of it ------------------------------------------------------------

reset role;

select is(
  (select count(*) from storage.objects
   where name = '00000000-0000-4000-8000-00000000000a/10000000-0000-4000-8000-000000000001'),
  1::bigint,
  'alice''s file survived bob''s and the anonymous deletes'
);
select is(
  (select count(*) from storage.objects
   where name = '00000000-0000-4000-8000-00000000000b/20000000-0000-4000-8000-000000000001'),
  1::bigint,
  'bob''s file survived alice''s and the anonymous deletes'
);
select is(
  (select count(*) from storage.objects where name like '%/replaced'),
  0::bigint,
  'no file was renamed over'
);
select is(
  (select count(*) from storage.objects
   where bucket_id = 'documents'
     and (storage.foldername(name))[1] in ('00000000-0000-4000-8000-00000000000a',
                                           '00000000-0000-4000-8000-00000000000b')),
  2::bigint,
  'exactly the two original files remain'
);

select * from finish();
rollback;
