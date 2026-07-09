# Codex Prompt Playbook

This playbook contains copy/paste prompts for common Clinical KB work. The
prompts are written for this repository, not for a generic Next.js project.

Before using any prompt, keep these project defaults in mind:

- Start from `AGENTS.md`, `README.md`, `package.json`, and current `git status`.
- Preserve unrelated staged, unstaged, and untracked work.
- Use Node 24.x and npm 11.x. Do not switch package managers.
- For Next.js source changes, read the relevant guide under
  `node_modules/next/dist/docs/` before editing.
- Use `npm run ensure` before browser/UI work and use the URL it prints.
- Do not assume ports `3000`, `3001`, or `3002`.
- Do not attach to a local server unless `/api/local-project-id` confirms this
  project.
- Treat the live Supabase project as `Clinical KB Database`
  (`sjrfecxgysukkwxsowpy`). Do not use the stale `qjgitjyhxrwxsrydablr` ref.
- Ask before running live provider/API work, OpenAI calls, Supabase mutations,
  production data operations, deploys, commits, pushes, or destructive cleanup.
- For source/config/test changes, prefer `npm run verify:cheap` as the first
  broad gate after focused checks.
- For UI/routing/styling/browser changes, run `npm run ensure` before browser
  QA and use `npm run verify:ui` as the Chromium gate.
- For clinical ingestion, answer generation, source governance, privacy,
  production-readiness, or environment changes, run the smallest relevant
  domain check plus `npm run check:production-readiness`.

## 1. First Repo Orientation

Use this when starting a fresh session or handing the repo to another agent.

```text
Review this repository from the current checkout before making changes.

Start read-only. Inspect AGENTS.md, README.md, package.json scripts, git branch,
git status, recent commits, docs/process-hardening.md,
.github/pull_request_template.md, and the main source layout under src, scripts,
tests, worker, and supabase.

Summarize:
- what this app does
- runtime/package manager requirements
- local server workflow
- verification gates
- clinical governance constraints
- Supabase project safety rules
- high-risk areas of the codebase
- current dirty/untracked work that must be preserved

Do not install, test, build, run APIs, commit, push, or edit files yet.
```

## 2. Safe Local Setup Check

Use this when you want setup validated without changing dependencies or data.

```text
Check whether this repo is ready for local development.

Start read-only. Inspect Node/npm versions, package manager, lockfile, .nvmrc,
.node-version, .npmrc, package scripts, .env.example, README setup steps, and
existing local env files without printing secret values.

Report:
- installed Node/npm versions versus required versions
- package manager and lockfile detected
- whether node_modules appears present and healthy enough to run scripts
- required local tools, including Deno and optional Python/OCR prerequisites
- missing or suspicious setup items
- exact next commands I should run, separating safe local checks from commands
  that would contact OpenAI, Supabase, or production-like services

Do not run install, dependency update, provider-backed checks, API calls, tests,
builds, commits, pushes, or cleanup unless I explicitly approve.
```

## 3. Run The App Safely

Use this instead of asking for a guessed localhost URL.

```text
Run the Clinical KB app safely.

Follow AGENTS.md local-server safety. Execute npm run ensure, let it choose the
project-specific URL, verify the server identity through the repo helper, and
return the printed URL plus the log path if one is provided.

Do not assume localhost:3000, 3001, or 3002. Do not kill or modify other local
servers. Do not start a permanent watcher beyond what npm run ensure manages.
```

## 4. Implement A Focused Bug Fix

Use this for most backend, library, or component bugs.

```text
Fix this bug in the smallest safe way:

[describe the bug, observed behavior, expected behavior, and any route/file/test
names here]

Before editing:
- inspect AGENTS.md and relevant docs
- check branch and git status
- preserve unrelated dirty/untracked work
- read the relevant source and tests
- if touching Next.js APIs, read the matching guide in node_modules/next/dist/docs/

During implementation:
- identify the root cause from code or tests, not a guess
- keep changes scoped to the affected module
- add or adjust focused tests only where they prove the fixed behavior
- avoid unrelated refactors, dependency changes, API calls, commits, pushes, and
  cleanup

Verification:
- run the smallest relevant focused test first
- then run npm run verify:cheap if the change is non-trivial
- if clinical output, source governance, ingestion, privacy, Supabase, or env
  behavior changed, also run npm run check:production-readiness

Final response: summarize files changed, root cause, fix, checks run, checks not
run, and any residual risk.
```

## 5. UI Or Frontend Change

Use this for dashboard, document viewer, routes, styling, accessibility, or
responsive work.

```text
Implement this UI/frontend change:

[describe the user-facing change, target route, viewport requirements, and any
must-preserve behavior]

Before editing:
- inspect AGENTS.md, README.md, package scripts, and current git status
- run npm run ensure before browser work and use the printed URL
- read the relevant Next.js docs under node_modules/next/dist/docs/ before
  changing route/layout/app APIs
- inspect existing components, tokens, tests, and docs for this UI area

Implementation constraints:
- preserve current mode-aware behavior, source/citation/document workflows, and
  data-testid/aria contracts
- keep layout practical and dense enough for repeated clinical work
- avoid landing-page or marketing-style redesign unless specifically requested
- do not change RAG ranking, answer generation, ingestion, Supabase behavior, or
  API shapes unless the UI change cannot work without it
- avoid adding dependencies unless there is a strong reason and I approve

Verification:
- run focused tests for touched UI behavior where available
- run browser QA at desktop and mobile widths using the npm run ensure URL
- run npm run verify:ui for the Chromium UI gate
- run npm run verify:cheap before handoff if source behavior changed
- run npm run check:production-readiness if source rendering, clinical output,
  privacy, or governance behavior changed

Final response: include screenshots or paths if captured, files changed, checks
run, browser states verified, and known limitations.
```

## 6. Browser QA And Screenshot Review

Use this when you want visual proof rather than code-only review.

```text
Run browser QA for these routes/states:

[list routes, states, and desktop/mobile viewport sizes]

Follow local-server safety:
- run npm run ensure
- use only the printed URL
- verify /api/local-project-id before attaching
- do not kill unrelated servers

Check:
- desktop and mobile layout
- no incoherent text overlap or horizontal overflow
- keyboard/focus behavior for interactive controls
- forced-colors and reduced-motion behavior when relevant
- source/document/image panels if touched

Capture screenshots to a repo-ignored or temp location. Do not commit generated
screenshots unless I explicitly ask. Summarize findings with file paths for any
screenshots and exact routes/viewports tested.
```

## 7. RAG Answer Quality Fix

Use this when answers, citations, source trust, or synthesis behavior regress.

```text
Investigate and fix this RAG answer quality issue:

[include query, observed answer, expected answer, source/citation problem, and
whether live provider calls are allowed]

Default to no live API/provider calls unless I explicitly approve. Start from
local code, fixtures, tests, eval cases, cached/demo behavior, and logs.

Inspect:
- src/lib/rag.ts
- src/lib/rag-answer-text.ts
- src/lib/rag-routing.ts
- src/lib/retrieval-selection.ts
- src/lib/answer-render-policy.ts
- src/lib/source-governance.ts
- relevant API routes and tests
- docs/search-rag-* context where applicable

Fix constraints:
- preserve conservative behavior for unknown/outdated sources
- keep citations/source links verifiable
- do not weaken privacy, owner scoping, or source-governance rules
- bump cache/version keys only when behavior changes require it

Verification:
- run the focused RAG/citation/source tests that cover the changed behavior
- run relevant evals only if they are local-safe or I approve provider usage
- run npm run verify:cheap for non-trivial changes
- run npm run check:production-readiness for answer generation, source
  governance, privacy, or clinical output changes

Final response: explain root cause, changed files, behavior before/after, checks,
and any cases still needing live evaluation.
```

## 8. Retrieval Or Search Diagnostics

Use this when search misses documents, ranks poorly, or returns confusing source
sets.

```text
Diagnose this retrieval/search issue:

[include query, missing expected source, wrong source, document title/page/chunk
if known, and whether live Supabase/API checks are approved]

Start with local/static analysis unless I approve live Supabase/API calls.

Inspect:
- src/lib/clinical-search.ts
- src/lib/retrieval-selection.ts
- src/lib/search-scope.ts
- src/lib/rag-routing.ts
- src/lib/document-index-units.ts
- src/lib/indexed-source-formatting.ts
- scripts/eval-search.ts
- scripts/eval-retrieval.ts
- relevant tests and fixtures

Look for:
- query normalization or clinical vocabulary issues
- source scope/filter mismatch
- hybrid/vector/text ranking imbalance
- cache invalidation/version drift
- document label or generated metadata gaps
- owner scoping or private-access behavior

Verification:
- run focused tests first
- run local-safe eval/search checks where possible
- if ingestion, generated labels, or live indexed data are involved, ask before
  live Supabase calls and include npm run check:document-label-coverage if run
- run npm run check:production-readiness when clinical source behavior changes
```

## 9. Upload, Ingestion, OCR, Or Worker Fix

Use this for document upload, queue, parsing, OCR, image extraction, or indexing
work.

```text
Fix this upload/ingestion/worker issue:

[describe failing upload, job state, worker log snippet, document type, and
whether live Supabase/OpenAI work is approved]

Start from local evidence. Do not run live Supabase mutations, OpenAI calls,
worker jobs, or data cleanup unless I approve.

Inspect:
- src/app/api/upload
- src/app/api/ingestion
- src/app/api/jobs
- src/lib/ingestion*.ts
- src/lib/extractors
- worker/main.ts and worker/index.ts
- worker/python prerequisites when OCR/PDF extraction is involved
- supabase migrations/RPCs tied to job state
- tests for ingestion, worker, indexing, private access, and file signatures

Fix constraints:
- preserve owner scoping and private bucket access
- keep service-role usage server-only
- avoid patient-identifiable workflow expansion
- avoid broad cleanup of storage/database data unless explicitly approved

Verification:
- run focused unit/route tests
- run npm run check:indexing only if local OCR prerequisites are expected to be
  present
- run npm run check:production-readiness for ingestion, privacy, source
  governance, or environment changes
- run npm run check:supabase-project after Supabase env/config changes
```

## 10. Supabase Schema Or Migration Change

Use this before touching SQL, RLS, RPCs, policies, buckets, or project env.

```text
Plan and implement this Supabase/schema change safely:

[describe the desired schema/RLS/RPC/policy/env change and whether live Supabase
commands are approved]

Start read-only:
- inspect AGENTS.md Supabase project safety
- inspect supabase/schema.sql, relevant migrations, generated types/usages,
  scripts/check-supabase-project.ts, and tests
- confirm expected project ref is sjrfecxgysukkwxsowpy
- do not use qjgitjyhxrwxsrydablr

Before live commands or mutations, stop and ask for explicit approval.

Implementation:
- create the smallest migration needed
- preserve RLS and owner scoping
- keep service-role policies limited to server/worker contexts
- update tests and app code that depend on changed DB shape
- document rollback or compatibility concerns for risky changes

Verification:
- run focused schema/RPC tests
- run npm run check:supabase-project after env/config changes
- run npm run check:production-readiness for source governance, privacy, or
  clinical workflow impact
- run npm run verify:cheap for non-trivial source/config/test changes
```

## 11. API Route Contract Hardening

Use this for validation, auth, owner scoping, and error-shape improvements.

```text
Harden these API routes:

[list route families, e.g. documents/jobs/ingestion/upload/search/answer]

Before editing:
- inspect relevant route files, src/lib/validation helpers, auth helpers,
  Supabase client/admin usage, and route tests
- read relevant Next.js route-handler docs under node_modules/next/dist/docs/
- preserve current response contracts unless a contract change is required

Check for:
- missing schema validation
- unsafe route param/query/body parsing
- service-role use outside server-only boundaries
- owner scoping gaps
- inconsistent errors/status codes
- private document/image URL exposure
- rate-limit or audit logging regressions

Verification:
- add or update focused route contract tests
- run the specific route tests first
- run npm run verify:cheap for broad local confidence
- run npm run check:production-readiness if privacy, source governance, or
  clinical output behavior changed
```

## 12. Security And Privacy Review

Use this for an actual security pass with concrete findings.

```text
Review this repo for security and privacy issues, then fix high-confidence
findings that are safe and scoped.

Focus on:
- secrets and env handling without printing secret values
- service-role key confinement
- private Supabase bucket access
- owner scoping across API routes and RAG/search paths
- RLS assumptions and policy coverage
- patient-identifiable data risks
- audit logging and query retention
- dependency vulnerabilities without forced audit fixes

Start read-only. Preserve unrelated work. Do not contact live providers, mutate
Supabase, run OpenAI calls, deploy, commit, push, or run destructive cleanup
without explicit approval.

For each finding, provide file/line evidence, impact, and a minimal fix. Fix only
high-confidence issues that are clearly in scope. Run focused tests, then
npm run verify:cheap where appropriate, and npm run check:production-readiness
for privacy/governance changes.
```

## 13. Repo Audit For Dead Code, Broken Imports, Duplication

Use this for repo-auditor style cleanup.

```text
Run a repo-auditor style pass and fix only high-confidence issues.

Start read-only:
- inspect branch, git status, package scripts, tsconfig, next config, tests, and
  source layout
- map src/app, src/components, src/lib, scripts, worker, supabase, and tests
- preserve unrelated dirty/untracked work

Look for:
- broken imports
- files that are truly unused and not route entries, scripts, fixtures, mockups,
  migrations, generated-type dependencies, or test assets
- duplicate helpers/config/styles that can be safely consolidated
- oversized modules with existing decomposition plans

Use tools such as rg, TypeScript/lint output, knip, or jscpd only as triage.
Verify every candidate with source search and repo context before deleting or
moving anything.

If fixes are small and safe, make them. If cleanup is risky or architectural,
stop with a concrete plan instead.

Verification: run focused tests for touched areas and npm run verify:cheap for
non-trivial changes.
```

## 14. Dependency Maintenance

Use the repository shortcut when you want the full workflow.

```text
dependency
```

If you want to spell it out instead:

```text
Perform safe dependency maintenance for this repo.

Follow the dependency shortcut in AGENTS.md exactly. Start read-only, preserve
all user work, use npm and the existing package-lock.json, avoid prereleases,
avoid forced/legacy resolver flags, inspect release notes for major/core updates,
make only required compatibility changes, regenerate the existing lockfile, and
verify with the repo's relevant gates.

Do not commit, push, deploy, switch package managers, discard work, or run forced
audit fixes without explicit confirmation.
```

## 15. Release Readiness Review

Use this before claiming the branch is ready.

```text
Review this branch for release readiness.

Start read-only:
- inspect branch/upstream/status and recent commits
- preserve unrelated work
- inspect package scripts, CI workflows, PR template, docs/process-hardening.md,
  docs/clinical-governance.md, and relevant changed files

Check:
- tests/lint/type/build coverage appropriate to the diff
- UI/browser coverage for frontend changes
- production-readiness implications
- clinical governance preflight items
- Supabase target safety
- dependency/audit concerns
- generated artifacts or secret-like files accidentally present

Run the smallest relevant verification first. Use npm run verify:release only
when release-confidence verification is requested or clearly appropriate.

Final response: findings first, then checks run, checks not run, residual risk,
and exact next steps to reach release confidence.
```

## 16. Pull Request Prep

Use this to get a branch ready for review without pushing unless requested.

```text
Prepare this branch for a pull request, but do not commit or push unless I
explicitly ask.

Inspect:
- current branch/upstream/status
- staged, unstaged, and untracked work
- changed files and diff
- recent branch commits
- PR template requirements
- relevant verification gates

Produce:
- a concise PR summary
- test plan with exact commands actually run
- clinical governance preflight answers if applicable
- risks/follow-up items
- list of generated/untracked files that should not be included

If the diff has unrelated or WIP changes, separate them into groups and ask what
belongs in the PR.
```

## 17. Safe Upload/Handoff

Use the repository shortcut when completed work should be committed and pushed
where safe.

```text
upload
```

If you want a more explicit version:

```text
Safely hand off completed work on this branch.

Follow the upload shortcut in AGENTS.md exactly. Start with read-only git and
repo inspection. Preserve unrelated work. Stage only coherent completed changes.
Do not commit suspicious files such as env files, secrets, logs, caches, build
outputs, generated screenshots, or temporary artifacts.

Run the smallest relevant verification available. Commit and push only when the
repo state makes that clearly safe under AGENTS.md. Do not force-push, rebase a
shared branch, delete branches, merge to main, deploy, or discard work without
explicit confirmation.

Final response must include branch/worktree state, commit hash/message if
created, pushed branch if pushed, checks run, skipped/risky actions, and any
confirmation needed.
```

## 18. Production Readiness Or Clinical Governance Change

Use this when changing clinical behavior, source policy, privacy, deployment, or
environment assumptions.

```text
Implement this production-readiness/clinical-governance change:

[describe the policy, source, privacy, environment, deployment, or clinical
behavior change]

Before editing:
- inspect docs/clinical-governance.md
- inspect docs/production-readiness-checklist.md
- inspect .github/pull_request_template.md
- inspect scripts/production-readiness.ts and relevant tests
- confirm Supabase target safety rules

Do not run live OpenAI/Supabase/provider operations, mutate production-like
state, deploy, commit, or push unless I approve.

Implementation:
- keep unknown/outdated source behavior conservative
- keep service-role and private document access server-only
- keep demo/synthetic content separated from real clinical sources
- update docs/tests when behavior or policy changes

Verification:
- run focused tests
- run npm run check:production-readiness
- run npm run check:supabase-project if Supabase env/config changed
- run npm run verify:cheap for non-trivial source/config/test changes
```

## 19. Test Failure Or Flake Diagnosis

Use this when a check fails or times out.

```text
Diagnose this failing check efficiently:

[paste command, failure output, timeout, and what changed recently]

Start from concrete evidence:
- inspect current git status
- identify whether the failure is from install health, runtime version, stale
  local server, actual assertion failure, or timeout
- inspect the exact failing test and source under test
- rerun only the smallest failing test first

Do not keep rerunning broad gates until the failure mode is understood. If the
failure is environment/install/server state, prove that with a targeted command
before changing source.

After fixing, rerun the smallest failing check, then widen to the appropriate
repo gate only if needed.
```

## 20. Codebase Appraisal Export

Use this when you want a clean archive for external review.

```text
Create a reviewable codebase export ZIP for this repo.

Inspect the repo first. Include source, config, tests, docs, package manifests,
lockfiles, CI config, and an EXPORT_MANIFEST.md. Exclude .git, node_modules,
.next, caches, logs, test artifacts, generated screenshots, local state, real
.env files, secrets, credentials, and dependency/build outputs.

Stage the archive outside source when possible. Verify the ZIP can be opened,
contains EXPORT_MANIFEST.md, and does not contain forbidden paths. Do not commit,
push, deploy, install, test, or modify source behavior.
```

## 21. Large Feature Planning Before Code

Use this when the change could sprawl across UI, API, DB, worker, and tests.

```text
Create an implementation plan for this feature before coding:

[describe feature, users, constraints, target routes, data model impact, and
whether provider/API work is allowed]

Inspect current repo state and relevant docs/source. Produce a plan that
includes:
- current architecture touched
- proposed file-level changes
- risky assumptions
- data/schema/API implications
- clinical governance implications
- test plan
- verification commands
- steps that require explicit approval, such as live API calls, Supabase
  mutations, dependency changes, deploys, commits, or pushes

Do not edit files yet.
```

## 22. Review A Proposed Diff

Use this when you want strict code-review output.

```text
Review the current diff as a senior engineer.

Prioritize bugs, regressions, missing tests, privacy/security issues, clinical
governance risk, and verification gaps. Start with findings ordered by severity,
with file/line references. Keep summary secondary.

Inspect AGENTS.md, current git status, changed files, and relevant tests/docs.
Do not modify files unless I explicitly ask for fixes after the review.
```

## 23. OpenAI Cookbook Review For This Repo

Use this when you want a fresh pass over current OpenAI Cookbook patterns before
changing the Clinical KB RAG, answer, ingestion, eval, or prompt stack.

```text
Review the current OpenAI Cookbook and recommend what should be adopted in this
repo.

Use only official OpenAI sources. Treat archived Cookbook recipes as historical
unless the pattern is still supported by current docs or already matches this
repo's architecture.

Map recommendations to this repo's existing surfaces:
- src/lib/rag.ts
- src/lib/rag-routing.ts
- src/lib/rag-provider.ts
- src/lib/answer-verification.ts
- src/lib/retrieval-selection.ts
- scripts/eval-*.ts
- scripts/fixtures/rag-retrieval-golden.json
- docs/retrieval-quality-runbook.md
- docs/search-rag-master-context.md

Do not run OpenAI API calls, live Supabase checks, evals, installs, dependency
updates, commits, pushes, or deploys unless I explicitly approve.

Return:
- Cookbook patterns that are already covered here
- Cookbook patterns worth adding
- Cookbook patterns to avoid or defer
- file-level implementation plan
- local/offline verification plan
- any steps that require explicit API/provider approval
```

## 24. Structured Output Contract Hardening

Use this when answer generation, extraction, tool calls, or eval capture needs a
stricter response shape.

```text
Audit and harden structured output contracts for this repo.

Focus on places where model or model-like output is parsed, displayed, stored,
or graded:
- src/lib/rag.ts
- src/lib/answer-stream-extractor.ts
- src/lib/answer-verification.ts
- src/lib/answer-render-policy.ts
- src/app/api/answer/route.ts
- src/app/api/answer/stream/route.ts
- src/app/api/eval-cases/route.ts
- tests/answer-*.test.ts
- tests/rag-*.test.ts

Look for JSON parsing, optional fields, schema drift, permissive unknown fields,
missing refusal/source-gap states, missing citation IDs, and UI display paths
that trust raw model text.

Prefer strict schema validation at the boundary, then deterministic verification
before display. Preserve source-only fallback behavior and conservative clinical
gating. Do not change models, API providers, env values, or live workflows
without approval.

If implementation is safe and scoped, make the minimal changes and add focused
tests. Otherwise return a concrete migration plan with affected files and
verification commands.
```

## 25. Eval-Driven Prompt And Answer Improvement

Use this before changing prompts, routing, answer formatting, source governance,
or clinical synthesis behavior.

```text
Improve this RAG/answer behavior using an eval-driven loop:

[include query, observed answer, expected answer, citations/sources, and whether
provider-backed evals are approved]

Start offline unless I approve OpenAI/Supabase provider use.

Process:
- inspect current answer/routing/retrieval code and relevant tests
- add or update a small deterministic fixture or unit test that captures the
  failure before changing behavior
- only then adjust prompt text, schema, routing, verification, or render policy
- keep the source-governance and privacy rules conservative
- avoid broad prompt rewrites that change unrelated answer classes

Verification:
- run the focused test or local-safe eval that proves the behavior
- do not run provider-backed evals unless approved
- for non-trivial source changes, run npm run verify:cheap
- for clinical output/source-governance changes, run npm run check:production-readiness

Final response: include baseline failure, fix, files changed, focused result,
and whether live eval confirmation is still needed.
```

## 26. RAG Document Preparation And Metadata Audit

Use this when retrieval quality might be limited by chunking, metadata, visual
content, or source formatting rather than model prompting.

```text
Audit the RAG document preparation pipeline for Cookbook-style retrieval
improvements without running live ingestion or OpenAI calls.

Inspect:
- worker/main.ts
- worker/embedding-fields.ts
- worker/table-facts.ts
- src/lib/chunking.ts
- src/lib/document-index-units.ts
- src/lib/document-enrichment.ts
- src/lib/visual-intelligence.ts
- src/lib/source-metadata.ts
- scripts/eval-retrieval.ts
- docs/retrieval-quality-runbook.md

Evaluate whether indexed units include the right searchable text and metadata:
document title, source status, jurisdiction, clinical topic, page/section
labels, tables, figures, abbreviations, synonyms, and user-searchable clinical
phrasing.

Look for opportunities to improve retrieval by changing document preparation,
metadata augmentation, query rewriting, or chunk linking before changing answer
generation prompts.

Do not run ingestion, worker jobs, OpenAI embeddings, visual model calls, live
Supabase commands, or backfills unless I approve. Return a safe implementation
plan and the local/offline tests that should be added first.
```

## 27. Multimodal Evidence And Visual RAG Review

Use this for image-heavy PDFs, tables, forms, diagrams, medication charts, or
source pages where text-only retrieval may miss important evidence.

```text
Review multimodal/visual evidence support for this Clinical KB workflow.

Start read-only and offline. Inspect:
- src/lib/visual-intelligence.ts
- src/lib/image-filtering.ts
- src/lib/document-index-units.ts
- src/lib/rag-source-block.ts
- src/components/clinical-dashboard/visual-evidence.tsx
- src/app/api/images/[id]/signed-url/route.ts
- tests related to document images, visual evidence, and answer citations

Check whether table/image/diagram evidence is:
- extracted into searchable text or metadata
- linked back to document/page/image IDs
- cited safely in answer output
- gated by source quality and access control
- rendered with useful source review affordances

Recommend the smallest improvements. Do not run OCR, image model calls, live
Supabase, OpenAI, reindexing, or browser QA unless I approve. If code changes
are safe and local-only, add focused tests and explain what still needs live
corpus validation.
```

## 28. Clinical RAG Guardrails Review

Use this when prompt injection, off-topic questions, unsafe clinical confidence,
or unsupported output could reach users.

```text
Review and harden Clinical KB RAG guardrails.

Focus on both input and output guardrails:
- prompt injection and jailbreak attempts inside user queries or retrieved text
- off-topic or non-clinical requests
- weak retrieval or conflicting evidence
- unsupported numbers, doses, thresholds, and recommendations
- stale, unverified, review-due, or poor-extraction sources
- private document access and owner scoping
- raw provider/internal error leakage

Inspect:
- src/lib/rag.ts
- src/lib/rag-injection*
- src/lib/answer-verification.ts
- src/lib/source-governance.ts
- src/lib/answer-render-policy.ts
- src/app/api/answer
- src/app/api/search
- tests/rag-injection.test.ts
- tests/answer-verification.test.ts
- docs/rag-injection-threat-model.md
- docs/clinical-hazard-analysis.md

Make only scoped fixes with focused tests. Preserve useful source-gap behavior
instead of making unsupported answers look confident. Do not run provider-backed
generation or live Supabase checks unless approved.
```

## 29. Prompt Caching And Cost/Latency Review

Use this before changing prompt assembly, tool/schema definitions, context
ordering, or answer-generation latency behavior.

```text
Review prompt assembly for cost and latency efficiency.

Inspect:
- src/lib/rag.ts
- src/lib/openai.ts
- src/lib/rag-provider.ts
- src/lib/rag-context-selection.ts
- src/lib/env.ts
- tests for answer latency, provider routing, and fallback behavior
- docs/observability-slos.md

Check whether static prompt content, schemas, examples, and stable instructions
are kept before variable user/query/retrieval context so provider prompt caching
can help when API calls are approved. Check whether tool/schema ordering is
stable, prompt/cache versioning is explicit, and telemetry captures cached input
tokens where available.

Do not optimize by weakening source grounding, shortening clinical safety
instructions, or hiding source-gap behavior. Do not run OpenAI calls or live
evals unless approved. Return local code/test changes if safe, plus the live
metrics that would need provider-backed confirmation.
```

## 30. Responses API Or Tool-Orchestration Migration Plan

Use this only for planning a future migration. Do not perform the migration
unless it is explicitly requested and API/provider work is approved.

```text
Create a conservative migration plan for whether this repo should adopt
Responses API/tool orchestration patterns for RAG.

Compare current implementation to a Responses-style flow:
- current retrieval and answer orchestration in src/lib/rag.ts
- current OpenAI wrapper in src/lib/openai.ts
- current route contracts in src/app/api/answer
- current eval scripts and fixtures
- current source-governance and privacy rules

Identify:
- what would improve, such as stateful tool calls, structured outputs, or
  cleaner orchestration
- what would get riskier, such as provider coupling, cost, tracing, streaming,
  schema drift, or clinical safety validation
- exact files and tests that would change
- rollout plan with feature flag and fallback
- API/provider calls that require approval

Do not edit files unless I explicitly ask for implementation after the plan.
```

## 31. Schema Change Impact And Eval Harness

Use this before SQL/RPC/schema changes that affect ingestion, retrieval, source
governance, or clinical output.

```text
Build a schema-change impact plan and eval harness for this database/RAG change:

[describe the intended SQL/RPC/schema/policy change]

Start read-only. Inspect:
- supabase/schema.sql
- relevant supabase/migrations/*.sql
- src/lib/supabase/database.types.ts
- affected src/app/api routes
- affected src/lib retrieval/ingestion modules
- tests/supabase-schema.test.ts
- scripts/check-drift.ts
- scripts/eval-retrieval.ts

Produce:
- impact analysis by table/RPC/function/policy
- code paths and tests affected
- deterministic preflight checks that do not need model calls
- parse-only or local-only eval cases where possible
- live Supabase/OpenAI checks that require explicit approval
- rollback or compatibility notes

If the change is safe and scoped and I asked for implementation, add the
smallest migration plus focused tests. Otherwise stop at the plan.
```
