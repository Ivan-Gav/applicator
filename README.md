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
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm run dev                  # http://localhost:3000
```

`npm run build` produces a production build; `npm start` serves it.
