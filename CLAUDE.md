@AGENTS.md

# PsychSift — orientation for AI assistants

Private, local-first medical guideline RAG knowledge base for a psychiatrist in Perth,
Australia. Clinical reference documents are uploaded to private Supabase Storage, indexed
(text + OCR + image captions) into pgvector, and answered with citations that link back to
the original PDF.

This is a **clinical reference prototype, not validated clinical decision support**. Answers
must be verifiable against linked sources, and failure behaviour must always degrade
conservatively rather than guess.

## How the instruction files divide up

`AGENTS.md` is the single source of truth for **rules** and is imported above, so everything
in it is already in force. This file is the **orientation layer** — what the system is, how
it is laid out, how work flows through it. It deliberately does not restate AGENTS.md policy;
where the two ever disagree, **AGENTS.md wins**.

| Need                                        | Read                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Rules, gates, shortcuts, safety boundaries  | `AGENTS.md` (auto-loaded)                                                                                    |
| Architecture, modules, schema, domain flows | `docs/codebase-index.md` — the deep map; start there for any real task                                       |
| Design-system rules before any UI building  | `docs/design-system/README.md` — the system of record: tokens, component contracts, gates, adoption playbook |
| Routes and modes                            | `docs/site-map.md` (generated — `npm run sitemap:update`)                                                    |
| Which gate to run for a change              | `docs/process-hardening.md`, or the `gates` skill                                                            |
| Test execution, focused/live, flake policy  | `docs/testing.md`                                                                                            |
| Every maintained doc, categorised           | `docs/README.md`                                                                                             |
| Outstanding work across sessions            | `docs/outstanding-issues.md` (`/issues`)                                                                     |

When adding to this file, add **orientation**. Policy belongs in `AGENTS.md`; deep structure
belongs in `docs/codebase-index.md`. Keeping those three non-overlapping is what stops five
AI systems (Claude Code, Codex, Cursor, CodeRabbit, `.agents/`) from drifting apart —
see the AI tooling map in `docs/agents-guide.md`.

## Highest-consequence rules

Full text and rationale in `AGENTS.md`. These are the ones most easily violated by accident:

- **Providers need explicit confirmation.** Never touch OpenAI, Supabase, GitHub/GitLab,
  hosted CI, or any provider-backed workflow — including indirectly, via scripts, tests, or
  release gates — without the user saying so. Prefer local/offline/mocked checks; report the
  command and ask.
- **This is not the Next.js you know.** Next 16 has breaking changes versus most training
  data. Read `node_modules/next/dist/docs/` before writing framework code.
- **RAG ranking surfaces are protected.** Flag the task _before_ editing anything under
  `src/lib/rag/**`, clinical-search, retrieval-selection, ranking-config, answer-ranking,
  the eval harness, or the golden fixture — even for a rename or a comment. Behaviour
  changes need a live eval-canary pair. Read `docs/rag-behaviour/` first.
- **Supabase target is pinned.** Live project `Clinical KB Database`, ref
  `sjrfecxgysukkwxsowpy`. The ref `qjgitjyhxrwxsrydablr` is stale — never use it. Migrations
  target role `postgres`.
- **Check the review ledger before reviewing a branch or PR:**
  `npm run ledger:lookup -- <ref> --scope "<scope>"`. Never scan or hand-write
  `docs/branch-review-ledger.md`; it is a frozen historical table and new reviews use immutable records.
- **Never assume `localhost:3000`.** Use `npm run ensure` and the URL it prints.
- **Evidence is never compressed.** Paste the decisive line from a gate. Exit code 0 alone
  is not proof — `verify:ui` can exit non-zero on lock-contention timeout rather than
  soft-skipping green.

## Stack and runtime

| Layer     | Choice                                                                                     |
| --------- | ------------------------------------------------------------------------------------------ |
| Runtime   | Node **24.x** / npm **11.x**, `engine-strict` (dev server exits on any other major)        |
| Framework | Next.js 16 (App Router), React 19                                                          |
| Language  | TypeScript 6, strict; Zod 4 for env and request validation                                 |
| Styling   | Tailwind 4 (`@theme` tokens in `src/app/globals.css`), unlayered component CSS by design   |
| Data      | Supabase — Postgres + pgvector (HNSW), Storage, Auth; Edge Functions on Deno 2             |
| AI        | OpenAI (embeddings, image captions, grounded generation)                                   |
| Ingestion | Node worker + Python OCR (PyMuPDF / Tesseract)                                             |
| Tests     | Vitest (unit, `tests/**/*.test.ts`), Playwright (E2E, `tests/ui-*.spec.ts`)                |
| Deploy    | Railway project `Database` — `Database` (app) + `worker` services, auto-deploy from `main` |

Install with `npm ci --include=dev`. Use `npm install` only when deliberately changing
dependencies. `npm install` also installs the repo's git hooks.

**Demo mode:** with Supabase/OpenAI env absent, dev falls back to the synthetic corpus
(`src/lib/demo-data.ts`, `public/demo-documents/`) via `isDemoMode()` in `src/lib/env.ts`.
Production never silently falls back — missing config fails loudly.

## Repository layout

```
src/app/          Next.js App Router — (search-app) route group, api/, auth/, mockups/
src/components/   UI; clinical-dashboard/ is the shell, *-mockups.tsx are design scratch
src/lib/          ~200 modules — rag/, supabase/, validation/, observability/,
                  extractors/, webhooks/ are the extracted subdirectories
src/data/         Static clinical content (DSM, formulation, therapies indexes)
data/             Generated clinical snapshot exports loaded at runtime — regenerate, never hand-edit
supabase/         migrations/ (source of truth), schema.sql (mirror), functions/
worker/           Ingestion worker; worker/python/ is the OCR stack
scripts/          gates, eval, reindex, governance, dev — counted and mapped in docs/scripts-index.md
tests/            Vitest unit + Playwright E2E, side by side
docs/             Runbooks, governance, plans; docs/README.md categorises them
eslint-rules/     Repo-specific lint rules (see Conventions below)
mockups/          Notes for the design-scratch routes under src/app/mockups/
plugins/          plugins/clinical-kb/ Codex plugin manifest and workflow skill
.claude/          Claude Code agents, skills, hooks, settings
.agents/          Single-word skill catalogue (`npm run skills`)
.cursor/          Cursor project rules and local-agent configuration
.design-sync/     Generated design-system package metadata and validation notes
.githooks/        Installed by `npm install`; pre-push runs scripts/guard-push.mjs
.vscode/          Shared VS Code workspace recommendations and settings
```

Never commit: `.next/`, `node_modules/`, `coverage/`, `.env*`, `sample-documents/`, logs.

The product surface is **15 app modes** (`src/lib/app-modes.ts`) sharing one search shell:
answer, documents, services, forms, favourites, differentials, dsm, specifiers, formulation,
prescribing, tools, calculators, therapy-compass, factsheets, dictionary.

## The two flows that matter

**Answer (read path).** `/api/answer` → `src/lib/rag/rag.ts` orchestrates: hybrid retrieval
via Postgres RPCs (pgvector HNSW + tsvector/trigram) → `retrieval-selection` →
`answer-ranking` → routed OpenAI generation (fast vs strong) → `answer-verification` and
render policy → cited answer. If generation fails the quality gates it degrades to a
deterministic **source-only** answer that still cites real documents — that is expected
behaviour, not a bug. Responses cache in `rag_response_cache`.

**Ingestion (write path).** `/api/upload` → private `clinical-documents` bucket + a row in
`ingestion_jobs` → `worker/main.ts` (or the `indexing-v3-agent` Edge Function) claims the
job → extract (PDF/DOCX/XLSX/TXT) → OCR fallback → image captioning → chunking → OpenAI
embeddings → chunks, pages, images, embedding fields, index units, table facts → quality
gates in `document_index_quality`. Reindex commits atomically per generation
(`reindex-pipeline.ts`). Lifecycle detail: `docs/ingestion-state-machine.md`.

Both paths are owner-scoped: `owner-scope.ts`, `query-privacy.ts`, `authorization.ts`.

## Development workflow

```bash
npm run ensure     # start/verify THIS project's dev server, prints the URL — never assume a port
npm run worker     # local ingestion worker (second terminal)
npm run dev        # direct dev server on the project-stable port
```

Verification pyramid — run the **smallest gate that covers the change**, then widen:

| Gate                                      | What it is                                                                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:focused -- --files <paths>` | Source-only iteration. Fails closed for deleted files and test infrastructure — then run `npm run test`.                                                                                     |
| `npm run verify:cheap`                    | The broad local gate: 34 static/consistency gates + `lint` + `typecheck` + full offline unit suite; use for cross-module risk, not automatically                                             |
| `npm run verify:pr-local`                 | Risk-routed PR mirror: focused docs/workflow contracts for recognised light scope, fail-closed heavy checks for executable or unknown scope. `-- --dry-run --files <paths>` shows selection. |
| `npm run verify:ui`                       | Chromium production journeys. Run `npm run ensure` first.                                                                                                                                    |
| `npm run verify:phone-chrome`             | Phone-chrome changes; selects affected owners/journeys before escalating to `verify:ui`                                                                                                      |
| `npm run verify:release`                  | Full build + all browsers + readiness. **Provider-backed — needs approval.**                                                                                                                 |

`verify:cheap` deliberately does **not** run formatting, which is why changed-file CI and the
installed pre-push hook (`.githooks/pre-push` → `scripts/guard-push.mjs`) block on unformatted files.
It also guards user-owned auto-merge state on every PR branch, drift-manifest staleness, and a
static gate (lint + source typecheck; override `SKIP_STATIC_GUARD=1`). The auto-merge guard has no
automation override; the other guards retain their documented override env vars.

Domain changes (auth, Supabase, ingestion, answer generation, search/ranking, clinical
output, source governance) additionally want the smallest relevant domain check plus
`npm run check:production-readiness`.

CI (`.github/workflows/ci.yml`) is risk-scoped: a `changes` job classifies paths, `static-pr`
always runs a small baseline and conditionally selects docs/workflow or heavy static checks,
and `pr-required` is the single always-reporting required aggregate. Coverage, safety/RAG,
build, Chromium, Supabase migration replay, and Docker builds run only when their file scope
applies; unknown non-document paths fail closed to heavy scope.

## Conventions the gates enforce

These fail builds, so they are worth knowing before you write code:

- **Button wiring.** Every `<button>` does something — handler, submit inside a form, or
  navigation. A control unavailable for a stated reason uses `aria-disabled="true"` + an inert
  handler + `title="… — coming soon"` + `sr-only` note; native `disabled` is for transient
  inertness only, and the two attributes together fail lint. Enforced by
  `eslint-rules/require-button-wiring.mjs`. Never blanket-disable the rule.
- **No orphan routes.** A new production page route needs an inbound link from real nav,
  then `npm run sitemap:update`, a `docs/codebase-index.md` entry, and a reachability
  assertion. Enforced by `tests/route-reachability.test.ts`.
- **Internal navigation** uses `<Link>` / `router.push` / server `redirect()` — never a raw
  `<a href="/…">`. Build hrefs from `app-modes.ts`, `tools-catalog.ts`, `universal-search.ts`.
- **One search composer per page.** A page uses the shell/dashboard composer, an in-flow hero
  composer, or the document-viewer composer — never two. Phone composers are edge-to-edge;
  hidden chrome means zero reserve. Read `docs/search-chrome-behaviour.md` first.
- **Design tokens, not hex.** `eslint-rules/no-hardcoded-hex.mjs`, plus type-scale,
  icon-scale, z-index-ladder, and lucide-icon-aria rules. Production tap targets are
  `min-h-12` (48 px) — do **not** "fix" them down to `min-h-11` for a generic WCAG rule; that
  reintroduces a known `ui-smoke` flake.
- **PR bodies are parsed input.** `scripts/pr-policy.mjs` hard-blocks merges when a
  clinical-risk diff lacks a complete `## Clinical Governance Preflight` or a RAG-surface
  diff lacks a satisfying `RAG impact:` line. Write those in full prose from
  `.github/pull_request_template.md`, structure verbatim — paraphrasing silently fails.
- **Mockups are exempt from two gates, not all of them.** `src/app/mockups/**` and `*-mockups.tsx`
  are design scratch and 404 in production, so they sit outside the **wiring** and **reachability**
  gates — and nothing else. They are still compiled: they are typechecked like any source, and their
  client chunks are still weighed by `check:bundle-budget` — but since 2026-08-09 against a separate
  `mockups` scratch baseline (tolerance 25%), not the `production` one (tolerance 10%). That split
  reconciled `/issues` `#013` and `#252`: the old single total charged design scratch against a
  ceiling named as though it were production weight, which is how PR #1580 blocked at `+10.1%` for
  chunks no user can load. See the "Bundle budget" section in `AGENTS.md`; a mockup-only PR can still
  fail `Build`, just only on genuine runaway growth.

## Repo-specific tooling

Prefer these over improvising — they encode traps this repo has already hit:

- **Claude skills** (`.claude/skills/`): `newtask` (fresh worktree off latest `main`),
  `gates` (pick and prove the right gate), `handoff` (commit → verify → push → PR → ledger),
  `prlanded` (verify a squash-merge actually landed), `issues` (`/issues` cross-session
  memory), `run-pr` (open-PR sweep), `prompt`.
- **Review subagents** (`.claude/agents/`): `rag-retrieval-reviewer`,
  `supabase-schema-guardian`, `ingestion-worker-reviewer`, `clinical-governance-reviewer`,
  `frontend-ui-reviewer`, `verification-router`, `repo-auditor`, `pr-ci-fixer`.
- **Skill catalogue** (`.agents/skills/`): `npm run skills` lists the canonical single-word
  skills; `npm run check:skills` validates every repository skill surface. Planners in
  `docs/productivity-workflows.md` run without side effects unless given `-- --run`, and
  never execute `approvalRequired` commands.
- **Session memory:** a `SessionStart` hook surfaces the recommended queue from
  `docs/outstanding-issues.md`. Offer `/issues capture` for loose ends before context is lost.
