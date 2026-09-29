# Applicator

Job application tracker. Personal project with two goals of equal weight: a working
tool the author uses daily, and a portfolio artifact demonstrating engineering
quality. Code quality, test coverage and CI hygiene are the point, not a nice-to-have.

## Stack

- Next.js (App Router) + TypeScript, strict mode
- Tailwind + shadcn/ui
- Supabase (Postgres, Auth, Storage) — accessed only through adapters, see below
- Vitest + React Testing Library + MSW — unit and integration
- Playwright — E2E, visual regression, `@axe-core/playwright`
- ESLint for rules, Biome for formatting
- next-intl (DE/EN)
- GitHub Actions, deploy to Vercel

Always verify package versions before installing (`npm view <pkg> version`).
Do not assume versions from memory.

## Architecture: ports and adapters

The browser never talks to Supabase directly. Data flows:

```
UI  →  route handlers / server actions  →  repository interface  →  adapter  →  Supabase
```

The adapter depends on the interface, never the reverse. The domain layer must
remain free of any knowledge about how data is stored.

### Directory layout

Vocabulary is hexagonal throughout. Do not introduce FSD terms (`entities`,
`features`, `widgets`, `shared`) — mixing the two vocabularies is what this
layout exists to avoid.

```
src/
  domain/                  the core: knows nothing about Next.js or Supabase
    application/           grouped by entity, not by file kind
      model.ts             Application, ApplicationStatus
      schema.ts            zod schemas
      rules.ts             pure functions: status transitions, calculations
      repository.ts        interface ApplicationRepository
    document/
    user/

  adapters/                the outside world
    supabase/              the ONLY place allowed to import the Supabase SDK
      client.ts
      application.repository.ts
      application.mapper.ts
      storage.ts

  app/                     Next.js routing, route handlers, server actions
    auth/_utils/           non-route code of a segment: a private folder (`_`),
                           which Next.js keeps out of routing

  ui/                      everything React
    kit/                   shadcn primitives (configure the shadcn alias to @/ui/kit)
    applications/
    dashboard/

  lib/                     domain-free utilities: date formatting, cn()
```

A function belongs in `domain/` the moment it knows what an application is.
`formatDate` stays in `lib/`; `daysWithoutResponse(application)` moves to
`domain/application/rules.ts`.

### Hard rules

1. `@supabase/*` may be imported **only** inside `src/adapters/supabase/`.
   Enforced by ESLint `no-restricted-imports`. Never weaken or disable this rule.
2. Every adapter has a mapper converting storage shape to domain shape. Domain
   types never contain `snake_case` fields, `created_at`, or other storage artifacts.
3. Repository methods are named in domain language (`findRejectedSince`), never in
   query language (`executeQuery`, `selectWhere`).
4. Interfaces live in the domain layer. Implementations live in adapters.
5. Business logic goes in pure functions under `domain/`, not inside React
   components and not inside adapters. Anything that would survive a full stack
   rewrite belongs there.

Do not introduce a DI container, use-case classes, aggregates or domain events.
The domain is small; keep the structure proportional to it.

### Authentication

Passwordless magic link (PKCE). There is no Supabase browser client: requesting
a link is a server action, the callback is a route handler, sign-out is a server
action. The only browser-to-Supabase hop is the user clicking the emailed link.

1. **Pages are protected by placement inside the `(protected)` route group.**
   Its layout calls `requireUser()` once; pages carry no check of their own. A
   page that needs the user *reads* it with `currentUser()` (cached per request,
   so layout and page share one call); the layout *decides* on access. The
   mirror is the `(guest)` group (sign-in), whose layout calls
   `requireAnonymous()`. `/auth/callback` stays outside both: it must also run
   when a session already exists.
2. **Every route handler and server action begins with `requireUser()`**, since
   no layout runs for them: they are independent HTTP entry points. The only
   exceptions are the sign-in entry points (`requestMagicLink` and
   `/auth/callback`), which exist to create a session.
3. **The proxy handles token refresh only** and is never an authorisation
   check. It keeps no list of public or protected paths and never redirects: a
   request without a session passes through, and the layout or `requireUser()`
   redirects it. When Supabase refuses to renew a session, the proxy tags the
   request (`signInReasonHeader`) so `requireUser()` can tell the user why. It
   also records the requested path (`requestedPathHeader`), which layouts
   cannot read otherwise.
4. **`redirectTo` is untrusted everywhere.** It carries the destination
   through sign-in, and every place that reads it passes it through
   `sameSitePath()` (`src/lib/same-site-path.ts`), including the callback,
   where it returns from an email round trip.
5. **RLS in the database is the last line of defence.** Every query runs with
   the user's access token through the request-bound server client; policies in
   the migrations isolate users even if a check is forgotten.

`requireUser()` and `currentUser()` (`src/app/auth/_utils/`) call `getUser()`, which
verifies the token with Supabase. Never use `getSession()` for identity on the
server: it decodes the cookie without verifying the signature, and a cookie can
be forged. (The proxy calls it so the SDK decides when to refresh, and checks
the result for presence only; the comment there explains why.)

An unreachable Supabase is not a signed-out user. `authenticate()` reports it
as `Unavailable`, `requireUser()` throws `AuthUnavailableError`, and
`app/error.tsx` recognises it by its digest. Session cookies are never cleared
because of a network error.

Deliberate exception to ports and adapters: auth is **not** behind a repository
interface. It is genuinely coupled to the framework's request lifecycle (cookies,
redirects), and a port would be ceremony without benefit. Do not "fix" this.
`src/adapters/supabase/auth.ts` is the whole surface.

The service role key is read only by `src/adapters/supabase/service-role.client.ts`,
which only `e2e/` may import (ESLint `no-restricted-imports`). It bypasses RLS and
must never serve a user request.

### Deliberately denormalised

Company, source and contact are plain text columns on `application`, not
tables. Recurrence is real but rare; autocomplete over distinct existing values
(`ApplicationRepository.distinctValues`) covers it without lookup UI, duplicate
merging or joins on every read. Do not reintroduce lookup tables for them.

### Status history

`application.status` holds the current status. A trigger on `application`
journals it into `status_event`: one row after insert, one after each update
that changes it, inside the same transaction and carrying the row's `user_id`
so RLS covers the journal. Code writes `status` only; it never inserts into
`status_event` itself.

**Transition rules stay in the domain.** Whether a move from one status to
another is legal is decided by `canTransition` in
`src/domain/application/rules.ts`. The trigger only journals what happened.
Never move rule logic into the database.

### Dates and time zones

One rule for every date: it is an **instant** (`timestamptz` in the database,
`Date` in the domain), stored in UTC and shown in the viewer's time zone.

- **Input.** A day picked in a form becomes the start of that day in the
  browser's time zone, converted in the browser (`startOfLocalDay`). The server
  never interprets a bare `YYYY-MM-DD`; the schema accepts only a `Date`.
- **Display.** Pages render on the server, which cannot see the browser's
  zone. `TimeZoneSync` (in the root layout) reports it in the `tz` cookie and
  refreshes the page when it changes; `requestTimeZone()` reads it and dates
  are formatted with `formatDay(instant, timeZone)`. Until the cookie exists
  (a browser's very first page), dates render in UTC.

**Trade-off, accepted deliberately:** a day entered by hand is pinned to the
zone it was entered in. "1 September" entered in Berlin is 31 August 22:00 UTC,
and a viewer in New York sees 31 August. Moving or travelling west shifts such
dates back by a day; travelling east never does. The alternative, a separate
calendar-day type (Postgres `date`), would split dates into two kinds with
different rules, while transitions record real instants anyway.

## No magic strings

- **Routes and our query parameters** live in `src/app/routes.ts`. Build URLs
  with its helpers (`signInPath(reason)`), never by hand.
- **Values with meaning** (failure reasons, request statuses) are `as const`
  objects in the domain, with a same-named type:
  `SignInFailureReason.LinkExpired`, not `"link_expired"`.
- **Supabase's own vocabulary** (callback parameters, error codes, cookie names)
  lives in `src/adapters/supabase/auth.constants.ts`, and only adapters read it.
- **Every user-facing string** lives in `src/ui/messages.ts`, grouped by screen.
  The domain carries no display text. This file becomes the next-intl catalogue.
- Tests read texts, routes and codes from the same places, so a wording change
  touches exactly one file.

Literals stay where they are standard vocabulary rather than ours: HTTP header
names, arguments typed by an SDK union (`scope: "local"`), DOM ids, and the
proxy matcher, which Next.js requires as a static literal.

## Naming conventions

- Use `type` everywhere. Reserve `interface` for repository contracts only — the
  keyword itself signals a system boundary.
- No `I` or `T` prefixes. `ApplicationRepository`, not `IApplicationRepository`.
- Distinguish by role suffix, not by declaration syntax:
  `Application` (domain) / `ApplicationRow` (DB shape) / `ApplicationDto` (API shape) /
  `ApplicationProps` (component props).
- Implementations name what makes them different: `SupabaseApplicationRepository`,
  `InMemoryApplicationRepository`.

## Testing

- Pure domain logic and mappers: Vitest, no mocks, no DB.
- Components: React Testing Library, query by role and accessible name, never by
  test id unless there is no alternative.
- API boundaries in tests: MSW.
- Repositories in unit tests: substitute an in-memory implementation of the interface.
- E2E: Playwright with `storageState` for auth and a seeded database.
- **E2E is for what breaks at the seams**: cookies arriving, redirects
  happening, data surviving a reload. Everything else belongs in faster tests
  one level down. Needing a server is not needing a browser: a route handler
  is a function from a request to a response, so call `GET`/`POST` with a
  constructed `Request` and assert on the response. Fake Supabase at the
  network with MSW, so the adapter and the SDK still run and every shape
  matches what the real client produces.
- Every new feature ships with tests in the same commit. Do not defer tests.

## Git

**Never perform git operations autonomously.** Do not create or delete branches,
do not stage, do not commit, do not push, do not rebase, do not stash.
Report what changed and let the author handle version control.
This applies even when a task seems to imply a commit.

## Working style

- One task at a time. Do not scaffold unrelated features because they seem next.
- When a decision is ambiguous, ask instead of guessing.
- Explain non-obvious choices briefly — the author is reviewing everything to learn,
  not just accepting output.
- No placeholder or mock data left in source files.
- Comments state only the minimal current fact the code cannot show: a
  constraint, a contract or an external quirk. No restating the code, no
  history, no argued motives.
