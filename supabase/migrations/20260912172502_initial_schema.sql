-- Applicator: initial schema
--
-- Deliberately flat. This project is about testing, CI and the frontend; the
-- database is supporting infrastructure, not the subject. Company, contact and
-- source are plain text columns rather than tables -- recurrence is real but
-- rare, and autocomplete over existing values solves it without the joins, the
-- lookup UI and the duplicate merging that normalisation would drag in.
--
-- Conventions:
--   * every table carries user_id, even where a join could derive it.
--     RLS policies stay simple and fast that way.
--   * enumerations are text + CHECK, not native Postgres enum types, so values
--     can be renamed or removed in a later migration without pain.
--   * every point in time is timestamptz. Postgres stores UTC, converts on read.
--   * deleting a user cascades everything they own.

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- application
-- ---------------------------------------------------------------------------

create table public.application (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,

  company_name       text not null,
  position_title     text not null,
  seniority          text check (seniority in ('junior', 'mid', 'senior', 'lead')),

  city               text,
  country            text,
  work_mode          text check (work_mode in ('on_site', 'hybrid', 'remote')),

  -- how the application was routed, independent of how it is going
  channel            text not null default 'direct'
                     check (channel in ('direct', 'agency', 'referral')),
  -- free text on purpose: a new job board must not require a migration.
  -- Normalised on write, offered via autocomplete over distinct existing values.
  source             text,
  source_url         text,   -- where the vacancy was found
  application_url    text,   -- where the application was actually submitted

  -- denormalised current status. status_event is the source of truth; this
  -- column exists so list views need no subquery per row. Only the domain
  -- transition function writes to both.
  status             text not null default 'draft'
                     check (status in ('draft', 'applied', 'screening',
                                       'interview', 'offer', 'rejected', 'withdrawn')),

  applied_at         timestamptz,
  last_contact_at    timestamptz,

  -- Three amounts, each a range. Encoding convention, so no extra flags:
  --   exact figure -> min = max         range       -> both set
  --   "from 60k"   -> min set only      "up to 80k" -> max set only
  --   unknown      -> both null
  salary_posted_min  integer,  -- what the vacancy advertised
  salary_posted_max  integer,
  salary_asked_min   integer,  -- what was stated in the application
  salary_asked_max   integer,
  salary_target_min  integer,  -- researched target for this role
  salary_target_max  integer,
  salary_currency    char(3) default 'EUR',
  salary_period      text check (salary_period in ('year', 'month', 'day', 'hour')),

  -- one contact per application is enough in practice; further people go in
  -- notes until that proves insufficient
  contact_name       text,
  contact_role       text,
  contact_email      text,
  contact_phone      text,
  contact_url        text,

  notes              text,

  -- visibility, orthogonal to status: an application can be rejected and not
  -- archived, or archived while still open
  archived_at        timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint salary_posted_range_valid
    check (salary_posted_min is null or salary_posted_max is null
        or salary_posted_min <= salary_posted_max),
  constraint salary_asked_range_valid
    check (salary_asked_min is null or salary_asked_max is null
        or salary_asked_min <= salary_asked_max),
  constraint salary_target_range_valid
    check (salary_target_min is null or salary_target_max is null
        or salary_target_min <= salary_target_max)
);

create index application_user_status_idx  on public.application (user_id, status);
create index application_user_applied_idx on public.application (user_id, applied_at desc);
create index application_user_source_idx  on public.application (user_id, source);

-- backs company autocomplete and "every application to this company"
create index application_user_company_idx on public.application (user_id, lower(company_name));

create trigger application_set_updated_at
  before update on public.application
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- status_event: append-only history behind application.status
-- ---------------------------------------------------------------------------

create table public.status_event (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  application_id  uuid not null references public.application (id) on delete cascade,

  status          text not null
                  check (status in ('draft', 'applied', 'screening',
                                    'interview', 'offer', 'rejected', 'withdrawn')),
  occurred_at     timestamptz not null default now(),
  note            text,

  created_at      timestamptz not null default now()
);

create index status_event_application_idx
  on public.status_event (application_id, occurred_at);

-- ---------------------------------------------------------------------------
-- interview
-- ---------------------------------------------------------------------------

create table public.interview (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  application_id    uuid not null references public.application (id) on delete cascade,

  -- ordering is always meaningful; the label is not always meaningful
  round_number      smallint not null default 1 check (round_number > 0),
  kind              text check (kind in ('screening', 'technical', 'team',
                                         'manager', 'final', 'other')),
  format            text check (format in ('phone', 'video', 'on_site',
                                           'take_home', 'other')),

  scheduled_at      timestamptz,
  timezone          text,  -- IANA name, e.g. Europe/Berlin: "10:00 local" survives relocation
  duration_minutes  smallint,

  participants      text,  -- free text: roles and names vary too much to model
  notes             text,
  outcome           text not null default 'pending'
                    check (outcome in ('pending', 'passed', 'failed', 'cancelled')),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index interview_application_idx    on public.interview (application_id, round_number);
create index interview_user_scheduled_idx on public.interview (user_id, scheduled_at);

create trigger interview_set_updated_at
  before update on public.interview
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- document
--
-- The one thing a spreadsheet genuinely cannot do: remember which CV version
-- went out with which application.
-- ---------------------------------------------------------------------------

create table public.document (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,

  kind          text not null
                check (kind in ('cv', 'cover_letter', 'certificate',
                                'reference', 'portfolio', 'other')),
  title         text not null,
  version_label text,          -- free text: "v3 backend-heavy", "DE short"
  storage_path  text not null, -- key in Supabase Storage, not a public URL
  language      text,          -- ISO 639-1: de, en

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index document_user_kind_idx on public.document (user_id, kind);

create trigger document_set_updated_at
  before update on public.document
  for each row execute function public.set_updated_at();

-- many-to-many: one CV version goes out with dozens of applications
create table public.application_document (
  application_id uuid not null references public.application (id) on delete cascade,
  document_id    uuid not null references public.document (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),

  primary key (application_id, document_id)
);

create index application_document_document_idx
  on public.application_document (document_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Enabled on every table. Without a matching policy a table is simply invisible,
-- which is the safe default. Each policy says: you may touch a row only if it
-- carries your user id.
--
-- These policies only apply to requests made with a user's access token. The
-- service role key bypasses RLS entirely and must never serve a user request --
-- seed scripts and tests only.
-- ---------------------------------------------------------------------------

alter table public.application          enable row level security;
alter table public.status_event         enable row level security;
alter table public.interview            enable row level security;
alter table public.document             enable row level security;
alter table public.application_document enable row level security;

create policy application_owner on public.application
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy status_event_owner on public.status_event
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy interview_owner on public.interview
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy document_owner on public.document
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy application_document_owner on public.application_document
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
