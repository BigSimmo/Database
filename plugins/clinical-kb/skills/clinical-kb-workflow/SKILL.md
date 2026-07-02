---
name: clinical-kb-workflow
description: Use when working in the C:\Dev\Apps\Database Clinical KB repo, especially for local run, UI/browser QA, Supabase/OpenAI/RAG changes, clinical governance, dependency/upload shortcuts, or choosing verification.
---

# Clinical KB Workflow

Use this skill for `C:\Dev\Apps\Database`, the Clinical KB Next.js clinical reference RAG app.
Root `AGENTS.md` remains authoritative. If these notes drift, inspect the repo before acting.

## Repo Basics

- App: Next.js 16, React 19, npm 11, Node 24.
- Package manager: npm with `package-lock.json`.
- Main app routes live under `src/app`; shared RAG, OpenAI, Supabase, safety, and validation logic live under `src/lib`.
- This project targets the live Supabase project `Clinical KB Database` with project ref `sjrfecxgysukkwxsowpy`.
- Treat the older Supabase ref `qjgitjyhxrwxsrydablr` as stale.

## Local Server Safety

- For a terse `run` request, run `npm run ensure` and return the printed URL.
- For UI, browser, screenshot, mobile, routing, or styling work, run `npm run ensure` before browser checks.
- Never assume `localhost:3000`, `localhost:3001`, or `localhost:3002`.
- Before attaching to an existing server, rely on the repo's local project identity guard, especially `/api/local-project-id` as used by `npm run ensure`.
- Do not kill another project's server.

## OpenAI And API Cost Safety

- Do not run OpenAI API-backed tasks, live evals, ingestion enrichment, embeddings, image captioning, or provider-backed answer generation unless the user explicitly asks for API usage.
- Prefer local/static/mocked checks. When a no-API guard is needed, clear `OPENAI_API_KEY`, `OPENAI_ORG_ID`, and `OPENAI_PROJECT_ID` for that command.
- Safe local server checks such as `npm run ensure` do not require provider calls.
- Broad browser aggregates can be slower or flaky in no-API mode; prefer focused Vitest or focused Chromium specs first.

## Next.js Changes

- This repo explicitly warns that its Next.js version has breaking changes.
- Before changing Next.js routes, server components, middleware, config, or build/runtime conventions, read the relevant guide under `node_modules/next/dist/docs/`.
- Do not rely on older Next.js assumptions when the local docs disagree.

## Verification

- For non-trivial source/config/test changes, prefer `npm run verify:cheap` as the first broad gate.
- For UI, frontend, browser, routing, styling, reduced-motion, or forced-colors changes, run `npm run ensure` first and use `npm run verify:ui` as the Chromium gate.
- For release or handoff confidence, use `npm run verify:release`.
- For clinical ingestion, answer generation, source governance, privacy, production-readiness, or environment changes, run the smallest relevant domain check plus `npm run check:production-readiness`.
- After Supabase env/config changes, run `npm run check:supabase-project`.
- Start from the smallest failing check and widen only after the focused failure is resolved.

## Git And Worktree Safety

- Preserve unrelated staged, unstaged, and untracked work.
- If starting from `main`, `master`, `develop`, or `release/*`, create a `codex/...` feature branch before editing when safe.
- Do not commit, push, force-push, reset, clean, merge into protected branches, or delete branches unless the user explicitly asks for that workflow.

## Clinical Safety

- This is a clinical reference prototype, not validated clinical decision support.
- Preserve source-backed answers, citations, document access controls, privacy boundaries, and fail-closed behavior on weak or unavailable evidence.
- For PRs touching ingestion, answer generation, search/ranking, source rendering, document access, privacy, production env, or clinical output, complete the clinical governance preflight in `.github/pull_request_template.md`.
