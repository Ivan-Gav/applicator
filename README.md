# Applicator

A job application tracker. Keeps every application, its status and related
documents in one place, and shows how long each one has gone without a response.

Personal project with two equal goals: a tool used daily, and a portfolio piece
demonstrating engineering quality (clean architecture, test coverage, CI hygiene).

## Stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, Storage) behind a ports-and-adapters boundary
- Vitest + React Testing Library + MSW, Playwright for E2E
- next-intl (DE/EN), GitHub Actions, Vercel

## Running locally

```bash
npm install
cp .env.example .env.local   # already points at the local Supabase stack
npm run db:start             # local Supabase in Docker (Studio: http://127.0.0.1:54323)
npm run dev                  # http://localhost:3000
```

Database scripts:

| Script               | What it does                                                        |
| -------------------- | ------------------------------------------------------------------- |
| `npm run db:start`   | Start the local Supabase stack (needs Docker running)               |
| `npm run db:stop`    | Stop it                                                             |
| `npm run db:reset`   | Drop and recreate the local database from `supabase/migrations`     |
| `npm run db:migrate` | Apply migrations not yet applied locally                            |
| `npm run db:types`   | Regenerate `src/adapters/supabase/database.types.ts` from the schema |
| `npm run db:test`    | Run the pgTAP tests in `supabase/tests` (RLS isolation)             |

`npm run build` produces a production build; `npm start` serves it.

## Signing in locally

Sign-in is passwordless: enter an email address on `/sign-in` and open the link
from the mail. Locally nothing leaves the machine; the mail lands in Mailpit at
http://127.0.0.1:54324. Links work once and expire after an hour
(`otp_expiry` in `supabase/config.toml`). Open the link in the same browser
that requested it, otherwise the PKCE verifier cookie is missing.

The Playwright suite never reads a mailbox. Its setup project mints a link
through the Supabase admin API with `SUPABASE_SERVICE_ROLE_KEY` (already in
`.env.example` for the local stack) and stores the resulting session for the
specs that only need to be signed in.
