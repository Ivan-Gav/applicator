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
| `npm run db:test`    | Run the pgTAP tests in `supabase/tests` (RLS and storage isolation) |

`npm run build` produces a production build; `npm start` serves it.

## Document files

Uploaded files live in the private `documents` storage bucket, under
`<user id>/<random id>`; the database holds that key, never a URL. The browser
gets a file only through `/api/document-files/<version id>`, which checks the
session. To save a file it redirects to a signed link valid for a minute; to
open one (`?open`: PDF, text and images) it passes the bytes on itself, so the
browser shows the file under its original name. Accepted: PDF, DOC,
DOCX, ODT, RTF, TXT, PNG, JPEG and WebP, up to 4 MiB each (Vercel refuses
request bodies over 4.5 MB, and uploads pass through the app).

Deleting a document deletes its rows first, then its files, retrying the files
once. **If both attempts fail, the files stay in storage** with nothing naming
them; the server log lists their keys. Nothing removes them automatically.
Deleting a user in the database likewise leaves their files behind.

Both are cleared by hand with the maintenance script. It needs
`SUPABASE_SERVICE_ROLE_KEY`, runs on a developer's machine only and is never
deployed. It acts on the project in `NEXT_PUBLIC_SUPABASE_URL`, from the
environment or `.env.local`, prints what it would remove, and removes nothing
until `yes` is typed:

```bash
npm run maintenance -- remove-unreferenced-files  # files no document version names, older than an hour
npm run maintenance -- delete-user <email>        # the user's files, then the user and all their rows
```

Delete users with the script, not from the Supabase dashboard: the dashboard
deletes the rows but cannot reach the files.

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
