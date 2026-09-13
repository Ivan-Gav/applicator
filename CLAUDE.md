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

### Deliberately denormalised

Company, source and contact are plain text columns on `application`, not
tables. Recurrence is real but rare; autocomplete over distinct existing values
(`ApplicationRepository.distinctValues`) covers it without lookup UI, duplicate
merging or joins on every read. Do not reintroduce lookup tables for them.

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
- No comments explaining what the code does; only why, and only when non-obvious.
