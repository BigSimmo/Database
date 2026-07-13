# Agents Guide

Short onboarding pointer. The authoritative, always-current rules for agents
working in this repository live in the root [`AGENTS.md`](../AGENTS.md) —
verification gates, provider confirmation boundaries, Supabase project safety,
review routing, and workflow shortcuts. This page only orients you; it does not
duplicate those rules, so it cannot drift from them.

## Read in this order

1. [`AGENTS.md`](../AGENTS.md) — agent rules, verification gates, shortcuts
   (`upload`, `dependency`, `bug-hunter`), and safety boundaries.
2. [`docs/codebase-index.md`](codebase-index.md) — architecture and module map.
3. [`docs/README.md`](README.md) — index of all runbooks, governance docs, and
   plans, with maintained vs historical classification.
4. [`docs/site-map.md`](site-map.md) — generated route map.

## Human quickstart

- Node 24.x / npm 11.x are hard requirements (`engine-strict`); the app is
  Next.js 16 + Supabase + OpenAI.
- Copy `.env.example` to `.env.local` and fill in values (never commit
  secrets). Without Supabase/OpenAI values the app runs in demo mode on a
  synthetic corpus.
- `npm run ensure` starts or verifies the dev server on a stable
  project-specific port (never assume `localhost:3000`).
- `npm run worker` runs the local ingestion worker in a second terminal.
- When adding environment variables, update the schema in `src/lib/env.ts` and
  document them in `.env.example`.
- Before handing off changes: `npm run verify:cheap` first, then
  `npm run verify:pr-local` when the change is PR-ready (see
  [`docs/process-hardening.md`](process-hardening.md) for the full
  verification pyramid).
