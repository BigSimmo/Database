# Repository-wide review sweep — 2026-07-19

## Scope

This was a broad static repository sweep of `/workspace/Database` on branch `work`, combining the repo workflow guidance, local static commands, and six parallel specialist review passes. The goal was to identify high-confidence issues and pragmatic improvement opportunities without touching provider-backed services.

This sweep was not a literal proof that every repository line is defect-free. The practical coverage was broad static inspection plus targeted high-risk passes across security/auth/privacy, RAG/clinical answers, database/RLS, UI/accessibility, CI/release automation, dependencies/build/runtime, and local verification hygiene.

## Review passes used

1. Repository instructions and review protocol preflight.
2. `database-flightplan` risk/verification planning.
3. Security/auth/privacy API boundary review.
4. RAG/retrieval/answer/source-governance review.
5. Database/migrations/RLS/Postgres-function review.
6. Frontend/UI/accessibility/routing review.
7. CI/workflow/release automation review.
8. Dependency/build/runtime/Next.js config review.
9. Local format hygiene check.
10. Local dependency/tool availability check.
11. Local runtime/typecheck/lint feasibility check.
12. Broad static pattern scan for risky markers, auth/env usage, disabled controls, anchors, and provider-sensitive surfaces.

## High-confidence findings

### P1 — Non-stream `/api/answer` accepts `summaryMode` but silently runs normal answer generation

- **Files:** `src/lib/validation/answer-request.ts`, `src/app/api/answer/route.ts`, `src/app/api/answer/stream/route.ts`, `src/lib/rag.ts`.
- **Trigger:** Send `POST /api/answer` with `summaryMode: true` and a valid `documentId`.
- **Expected:** The route should either call the governed full-document summary path or reject `summaryMode` as unsupported for the non-stream endpoint.
- **Actual risk:** The non-stream route parses a schema that accepts `summaryMode`, but the route has no summary branch and always calls normal answer generation. This can omit later document sections, produce different clinical/source behavior than the streaming summary route, and create API contract drift.
- **Smallest proof/check:** Add a focused route test that mocks `summarizeDocument` and `answerQuestionWithScope`, posts `summaryMode: true` to `/api/answer`, and asserts the summary path is used or the request is rejected with 4xx.
- **Suggested fix:** Make the non-stream endpoint share the streaming summary behavior, or reject `summaryMode` explicitly on `/api/answer`.

### P1 — PR metadata policy does not run for `release/**` pull requests

- **Files:** `.github/workflows/pr-policy.yml`, `.github/workflows/ci.yml`, `.github/pull_request_template.md`.
- **Trigger:** Open, synchronize, or mark ready a PR targeting `release/<anything>`.
- **Expected:** Release-targeted PRs should receive the same trusted PR metadata/evidence policy as main-targeted PRs, unless an equivalent release gate exists.
- **Actual risk:** CI runs on PRs targeting `main` and `release/**`, but the PR policy workflow only runs for `main`. Release PRs can therefore appear CI-covered while skipping evidence, verification, rollback, and high-risk governance metadata checks.
- **Smallest proof/check:** Inspect workflow trigger branches: CI includes `release/**`; PR policy does not.
- **Suggested fix:** Add `release/**` to the PR policy workflow branch trigger, or document and enforce an equivalent release-specific policy.

### P2 — Streaming `summaryMode` can validate one document scope but summarize a different `documentId`

- **Files:** `src/lib/validation/answer-request.ts`, `src/app/api/answer/stream/route.ts`, `tests/private-access-routes.test.ts`.
- **Trigger:** Send `/api/answer/stream` with `summaryMode: true`, `documentId: A`, and `documentIds: [B]`.
- **Expected:** Summary-mode scope validation should be tied to exactly the document being summarized, or mismatched fields should be rejected.
- **Actual risk:** Scope resolution prefers `documentIds` when present, but the summary branch later summarizes `documentId` directly. This can pass selected-scope validation using one document set while generating a clinical summary for another document.
- **Smallest proof/check:** Add a route test asserting `summaryMode` rejects mismatched `documentId`/`documentIds`, or only summarizes when `documentIds` is absent or exactly `[documentId]`.
- **Suggested fix:** Tighten summary-mode validation to require exactly one `documentId` and no conflicting `documentIds` or filters unless explicitly supported.

### P2 — GitHub Actions pin guard does not scan composite action files

- **Files:** `scripts/check-github-action-pins.mjs`, `.github/actions/setup-node-cached/action.yml`, `.github/actions/setup-ui-e2e/action.yml`, `.github/workflows/ci.yml`.
- **Trigger:** A future change introduces a mutable external `uses:` reference inside `.github/actions/**/action.yml`.
- **Expected:** The action pin guard should scan both workflow files and reusable local composite action definitions.
- **Actual risk:** The current pin checker discovers only `.github/workflows` files, while CI executes local composite actions that can contain third-party `uses:` entries. Future unpinned composite-action dependencies could bypass the guard.
- **Smallest proof/check:** Add a fixture/self-test with an unpinned `uses:` inside a composite action and assert `npm run check:github-actions` fails.
- **Suggested fix:** Extend discovery to `.github/actions/**/action.yml` and `.github/actions/**/action.yaml`.

### P2 — Current shell runtime is Node 20 while the repo requires Node 24

- **Files:** `package.json`, `.nvmrc`, `scripts/check-node-engine.cjs`, `Dockerfile`, `Dockerfile.worker`.
- **Trigger:** Run install, runtime, build, typecheck, lint, or Next.js checks in the current shell.
- **Expected:** Local verification should run under Node 24 and npm 11 as declared by the project.
- **Actual risk:** Verification under Node 20 is not representative and fails the repo's own runtime guard. CI/production Docker images are aligned to Node 24, so Node 20 results are environment-limited.
- **Smallest proof/check:** `node scripts/check-node-engine.cjs` fails in the current shell with Node 20.20.2.
- **Suggested fix:** Use Node 24 for local validation, or add a plain-Node preflight that reports the mismatch before deeper checks.

### P2 — `node_modules` is absent, blocking local dependency/build/Next.js validation

- **Files:** `package.json`, `scripts/deployment-boot-smoke.mjs`, `AGENTS.md`.
- **Trigger:** Run build, lint, typecheck, runtime checks, or attempt to read Next.js docs under `node_modules/next/dist/docs/` in this checkout.
- **Expected:** Installed dependencies should be present before relying on local dependency/build/Next.js conclusions.
- **Actual risk:** The required Next.js docs and local binaries are absent, causing checks to fail before application logic is reached.
- **Smallest proof/check:** `test -d node_modules` reports absent; `npm run typecheck` fails because `node_modules/typescript/bin/tsc` is missing.
- **Suggested fix:** Run `npm ci` under Node 24 before deep local validation, or add friendlier prerequisite diagnostics.

### P2 — Formatting drift across 27 files

- **Files:** 27 files reported by `npm run format:check`, including docs, scripts, app routes, components, libraries, and tests.
- **Trigger:** Run `npm run format:check`.
- **Expected:** Prettier should pass cleanly or formatting drift should be intentionally documented.
- **Actual risk:** Formatting drift creates noisy diffs and weakens review signal, especially during broad clinical/retrieval changes.
- **Smallest proof/check:** `npm run format:check` exits 1 and reports 27 files with style issues.
- **Suggested fix:** Run `npm run format` in a dedicated formatting-only change after confirming the drift is not intentional.

### P3 — Href-less anchor in document-search mockup is styled as actionable but has no `href`

- **File:** `src/components/master-document-flow-mockups.tsx`.
- **Trigger:** Open the document-search/source mockup and try to interact with the styled `Table 3` inline reference.
- **Expected:** If actionable, it should be a real link/button; if not, it should not be an anchor.
- **Actual risk:** Sighted users see link styling while keyboard and assistive-tech users do not receive a real link target.
- **Smallest proof/check:** Static search for `<a>` tags without `href` identifies this inline anchor.
- **Suggested fix:** Replace with `href="#table-3"` or a non-interactive `<span>`.

### P3 — “Coming soon” favourites controls are keyboard-focusable despite `aria-disabled`

- **File:** `src/components/clinical-dashboard/favourites-hub.tsx`.
- **Trigger:** Keyboard navigate through `/favourites` toolbar controls.
- **Expected:** Unavailable actions should use native `disabled` or provide a clear focusable explanatory pattern.
- **Actual risk:** Keyboard users encounter controls that look/feel operable but cannot perform an action.
- **Smallest proof/check:** Static inspection shows `aria-disabled="true"` without native `disabled` on the relevant buttons.
- **Suggested fix:** Use native `disabled`, a non-button status/pill, or a fully documented focusable disabled pattern with visible explanation and activation guards.

### P3 — Differential density controls are disabled UI relying on `title="Soon"`

- **File:** `src/components/differentials/differential-presentation-workflow-page.tsx`.
- **Trigger:** Open a differential presentation workflow and inspect the `Compact`/`Detailed` toolbar controls.
- **Expected:** Unimplemented toolbar controls should either be hidden, clearly marked as coming soon, or exposed with an accessible explanation.
- **Actual risk:** The only explanation is `title="Soon"`, which is unreliable for keyboard, touch, and assistive technology users.
- **Smallest proof/check:** Static inspection shows native disabled controls with `aria-disabled` and `title="Soon"`.
- **Suggested fix:** Add visible accessible explanation, remove until implemented, or present current density as static state.

### P3 — `.npmrc` contains npm-unknown `allow-scripts=true`

- **Files:** `.npmrc`, `package.json`.
- **Trigger:** Run npm scripts in this checkout.
- **Expected:** npm project config should be recognized or documented if intentionally consumed elsewhere.
- **Actual risk:** npm prints warnings that `allow-scripts` is unknown and may stop working in the next major npm version, creating noisy logs and possible future install friction.
- **Smallest proof/check:** npm commands print `Unknown project config "allow-scripts"`.
- **Suggested fix:** Confirm whether repo tooling consumes it; remove or document it accordingly.

## Areas with no high-confidence defect found in this sweep

- Database/RLS/Postgres functions: no high-confidence issue found in static review. Tables appear to have RLS enabled, broad privileges are revoked before service-role grants, sensitive functions use explicit `search_path`, and storage policy shape is owner-scoped.
- Security/auth/privacy API boundaries: no high-confidence issue found in static review. High-risk mutation routes generally require authenticated/admin context or use intentional public access with rate limiting and owner/public scope guards.
- Server actions: no server-action marker was found in the searched source set.

## Improvement backlog

1. Add a static service-role API boundary check for mutation routes.
2. Add focused anonymous signed-url privacy tests for document and image URLs.
3. Add a health/readiness disclosure matrix for anonymous, invalid-token, valid-token, and admin callers.
4. Maintain a checked-in allowlist of intentional public API surfaces.
5. Add a no-server-actions guard if server actions remain intentionally unused.
6. Add a static table/RLS parity check.
7. Add a SECURITY DEFINER `search_path` static check.
8. Add storage policy shape assertions for owner-scoped paths.
9. Generate or maintain an RLS/ACL privilege manifest for review diffs.
10. Make summary-mode answer validation a discriminated contract.
11. Extract shared answer request execution between stream and non-stream routes.
12. Add explicit route parity tests for summary mode.
13. Include summary-mode scope used for generation in telemetry/client payloads.
14. Mirror PR policy branch coverage with CI branch coverage.
15. Scan composite actions in the GitHub action pin guard.
16. Add CI-scope self-test coverage for release-branch governance.
17. Add composite-action pin guard fixtures.
18. Add a plain-Node environment prerequisite check for Node/npm/dependency presence.
19. Clarify how agents should locate Next.js version docs when `node_modules` is not installed.
20. Add container-level runtime boot smoke coverage for final Docker image layout.
21. Standardize unavailable UI action semantics.
22. Avoid `title` as the only explanation for disabled/coming-soon clinical workflow controls.
23. Prefer SPA navigation over `window.location.assign` for internal dashboard actions where practical.
24. Add a lightweight static accessibility guard for href-less anchors and disabled-control patterns.
25. Run a dedicated formatting-only pass after approval.

## Checks run in the main audit session

- `pwd && find .. -name AGENTS.md -print && git status --short --branch && git rev-parse --abbrev-ref HEAD && git log --oneline -5`
- `cat .agents/skills/workflows/SKILL.md && cat .agents/skills/database-flightplan/SKILL.md && cat .agents/skills/session-lifecycle/SKILL.md`
- `cat AGENTS.md | sed -n '1,220p' && sed -n '1,220p' docs/codex-review-protocol.md && cat package.json`
- `npm run workflow:flightplan -- --write-evidence`
- `git status --short && git diff --name-only && find . -maxdepth 3 -name AGENTS.md -print && rg -n "TODO|FIXME|HACK|XXX|SECURITY|BUG|throw new Error\(|console\.log|any\b|@ts-ignore|eslint-disable|dangerouslySetInnerHTML|innerHTML|eval\(|process\.env\.|SERVICE_ROLE|SUPABASE_SERVICE|OPENAI_API_KEY|TODO" src scripts worker supabase tests .github docs --glob '!node_modules' --glob '!package-lock.json'`
- `npm run check:knip`
- `npm run format:check`
- `npm run typecheck`
- `npm run lint`
- `npm run check:runtime`

## Check results and limitations

- `npm run workflow:flightplan -- --write-evidence` passed and wrote ignored local evidence under `.local/workflow-evidence/`.
- `npm run format:check` failed with formatting drift in 27 files.
- `npm run check:knip` failed because `knip` was not found; `node_modules` is absent.
- `npm run typecheck` failed because `node_modules/typescript/bin/tsc` is missing.
- `npm run lint` failed because the concurrent heavy-run lock was held by the typecheck command. This is an agent execution error caused by launching two heavy repo commands in parallel.
- `npm run check:runtime` failed because `tsx` could not be resolved from missing `node_modules`.
- Provider-backed/live checks were not run: `npm run check:supabase-project`, `npm run check:production-readiness`, live retrieval/answer evals, hosted CI, and GitHub API actions remain confirmation-required by repository policy.

## Follow-up priority

1. Fix summary-mode route contract issues first because they can affect clinical answer/source behavior.
2. Fix release PR policy coverage and composite action pin scanning because they affect governance and supply-chain protection.
3. Restore a correct local verification environment: Node 24, npm 11, installed dependencies.
4. Run a dedicated formatting pass or decide whether existing drift should remain.
5. Then run `npm run verify:cheap` and risk-selected PR-local checks under the correct environment.
