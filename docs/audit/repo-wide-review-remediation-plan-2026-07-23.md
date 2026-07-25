# Repository-wide review remediation completion plan — 2026-07-24

## Objective

Complete every outstanding finding from the 2026-07-19 repository-wide review sweep with the smallest safe patches, clear ownership boundaries, and local/offline proof before any provider-backed gate.

## Non-negotiables

- Keep unrelated work out of each patch.
- Use Node 24/npm 11 and the existing npm lockfile before trusting typecheck, lint, tests, build, or installed Next docs.
- Do not change prompts, retrieval ranking, source formatting, auth, RLS, deployment secrets, or provider configuration unless that batch explicitly requires it.
- Do not run Supabase/OpenAI/live eval/hosted CI/release commands without explicit approval.
- Keep the formatting drift as a separate final pass so behavior diffs stay reviewable.

## Issue map

| ID  | Finding                                                                                      | Primary risk                       | Fix batch | Done when                                                                                              |
| --- | -------------------------------------------------------------------------------------------- | ---------------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| F1  | Non-stream `/api/answer` accepts `summaryMode` but runs normal RAG                           | Clinical/source contract drift     | Batch 1   | Non-stream either uses governed document summary or rejects `summaryMode` with 4xx; focused tests pass |
| F2  | Stream `summaryMode` can validate one `documentIds` scope and summarize another `documentId` | Scope integrity mismatch           | Batch 1   | Summary mode accepts only exact selected document scope; mismatch test fails closed                    |
| F3  | PR Policy runs for `main` only while CI also runs for `release/**`                           | Release governance gap             | Batch 2   | PR Policy branch filter mirrors CI protected PR branches                                               |
| F4  | Action pin checker ignores composite action files                                            | Supply-chain guardrail gap         | Batch 2   | Checker scans `.github/actions/**/action.yml?` and self-test covers composite `uses:`                  |
| F5  | Local runtime/dependencies are not ready                                                     | Verification unreliable            | Batch 0   | Node 24/npm 11 active, `npm ci` complete, Next docs and local binaries present                         |
| F6  | 27-file Prettier drift                                                                       | Review noise                       | Batch 5   | Dedicated formatting-only diff; `format:check` and `git diff --check` pass                             |
| F7  | Href-less mockup anchor                                                                      | Accessibility affordance mismatch  | Batch 3   | Anchor is a real link or a non-interactive element                                                     |
| F8  | Favourites disabled controls are focusable `aria-disabled` buttons                           | Keyboard/AT confusion              | Batch 3   | Native disabled or explicit accessible disabled pattern is used                                        |
| F9  | Differential density controls rely on `title="Soon"`                                         | Unclear unavailable UI             | Batch 3   | Visible accessible explanation or controls removed until implemented                                   |
| F10 | `.npmrc allow-scripts=true` warns as unknown npm config                                      | Tooling noise/future npm fragility | Batch 4   | Intent documented or line removed after confirming no repo consumer                                    |

## Execution sequence

### Batch 0 — Verification prerequisites first

**Why first:** All later fixes need representative local checks.

**Patch scope:** Prefer no repo file changes. If environment docs are needed, keep them docs-only.

**Steps**

1. Switch to Node 24/npm 11 using `.nvmrc`, host tool manager, or the repo container image.
2. Run `node scripts/check-node-engine.cjs`.
3. Run `npm ci` without changing package manager or lockfile.
4. Confirm:
   - `node -v && npm -v`
   - `test -f node_modules/typescript/bin/tsc`
   - `test -f node_modules/next/dist/bin/next`
   - `test -d node_modules/next/dist/docs`
5. Before any Next/framework code change, read the relevant installed guide in `node_modules/next/dist/docs/`.

**Verification ladder**

1. `npm run check:runtime`
2. `npm run typecheck`
3. Stop and triage if either fails before touching product code.

**Regression guard:** No lockfile or dependency edits unless `npm ci` proves the manifest/lockfile is inconsistent.

### Batch 1 — Answer `summaryMode` contract and scope integrity

**Why second:** This is the highest clinical/source-governance risk.

**Patch scope**

- `src/lib/validation/answer-request.ts`
- `src/app/api/answer/route.ts`
- `src/app/api/answer/stream/route.ts`
- `tests/private-access-routes.test.ts`

**Smallest safe implementation**

1. Add a shared summary-mode validation invariant: `summaryMode: true` requires `documentId`; `documentIds` must be absent or exactly `[documentId]`; filters are rejected unless a product owner explicitly wants filtered summaries.
2. Prefer making non-stream `/api/answer` call the same governed `summarizeDocument(documentId, ownerId, { signal })` path as streaming. If wiring the response parity is unexpectedly large, choose the safer fallback: reject non-stream `summaryMode` with a clear 400.
3. In stream route, validate the summary invariant before calling `resolveSearchScope`, so conflicting `documentIds` cannot satisfy scoping for another document.
4. Keep all other answer behavior unchanged: no prompt changes, ranking changes, citation formatting changes, or telemetry schema expansion unless needed for the tests.

**Focused proof**

1. `npm run test -- tests/private-access-routes.test.ts -t "summaryMode"`
2. `npm run test -- tests/rag-answer-fallback.test.ts tests/answer-response.test.ts`
3. `npm run eval:rag:offline`

**Done criteria**

- Non-stream summary requests no longer silently run normal RAG.
- Stream mismatched `documentId`/`documentIds` requests fail closed.
- Existing normal answer tests still pass.
- Offline RAG fixtures remain clean.

### Batch 2 — CI governance and action-pin guardrails

**Why third:** These are high-leverage governance/supply-chain fixes with low product risk.

**Patch scope**

- `.github/workflows/pr-policy.yml`
- `scripts/check-github-action-pins.mjs`
- existing or new local self-test fixture for the checker

**Smallest safe implementation**

1. Add `"release/**"` to PR Policy `pull_request_target.branches`.
2. Extend checker discovery to include workflow YAML plus composite action definitions:
   - `.github/workflows/*.yml`
   - `.github/workflows/*.yaml`
   - `.github/actions/**/action.yml`
   - `.github/actions/**/action.yaml`
3. Add a self-test that would fail if an unpinned external `uses:` in a composite action is ignored.

**Focused proof**

1. Checker self-test or direct script test for composite action discovery.
2. `npm run check:github-actions`
3. `npm run check:pr-policy`

**Done criteria**

- Release PRs are covered by PR Policy.
- Composite action `uses:` lines are scanned.
- Existing pinned local actions still pass.

**Regression guard:** Do not change workflow permissions, token use, checkout refs, or hosted CI behavior beyond static coverage.

### Batch 3 — UI/accessibility remnants

**Why fourth:** User-facing polish, but lower clinical/governance risk than Batches 1-2.

**Patch scope**

- `src/components/master-document-flow-mockups.tsx`
- `src/components/clinical-dashboard/favourites-hub.tsx`
- `src/components/differentials/differential-presentation-workflow-page.tsx`

**Smallest safe implementation**

1. Convert the mockup `Table 3` anchor to a real in-page link only if a stable target exists; otherwise use a styled `span`.
2. Change favourites “Recent” and “Add favourite” to native `disabled` buttons, or replace them with non-button status pills if they are roadmap-only.
3. Replace `title="Soon"` on differential density controls with visible accessible “Coming soon” text, or remove the disabled toggle until the feature exists.

**Focused proof**

1. `npm run test:focused -- --files src/components/master-document-flow-mockups.tsx,src/components/clinical-dashboard/favourites-hub.tsx,src/components/differentials/differential-presentation-workflow-page.tsx`
2. If visual UI changes are material: `npm run ensure`, then `npm run verify:ui`.

**Done criteria**

- No href-less actionable-looking anchor remains in the touched mockup.
- Unavailable controls no longer create misleading keyboard/AT affordances.
- No new route/state behavior is introduced.

### Batch 4 — `.npmrc allow-scripts=true` decision

**Why fifth:** It is a tooling warning, not product behavior.

**Patch scope**

- `.npmrc`
- optional docs note only if keeping the setting intentionally

**Smallest safe implementation**

1. Search for repo consumers of `allowScripts` and `allow-scripts`.
2. If no repo consumer needs `.npmrc allow-scripts=true`, remove only that line.
3. If it is needed, keep it and document the exact consumer and expected npm warning.

**Focused proof**

1. `rg -n "allowScripts|allow-scripts" . --glob '!node_modules'`
2. `npm run check:runtime`
3. Any install check only after Node 24 is active.

**Done criteria**

- Either the npm warning source is removed, or the repo documents why it remains.
- No dependency versions, lockfile entries, or package-manager choices change.

### Batch 5 — Formatting-only cleanup

**Why last:** Keeps logic/security/clinical diffs reviewable.

**Patch scope**

- Only files changed by Prettier.

**Smallest safe implementation**

1. Start from a clean worktree after Batches 1-4 are complete or parked.
2. Run `npm run format`.
3. Review the diff for formatting-only changes.

**Focused proof**

1. `npm run format:check`
2. `git diff --check`
3. If Prettier touched behavior-sensitive test/source files, rerun the focused checks from the relevant earlier batch.

**Done criteria**

- `format:check` passes.
- The commit contains no semantic edits.

## Final local handoff gate

Run after all batches are complete under Node 24 with dependencies installed:

1. `npm run verify:cheap`
2. `npm run verify:pr-local`
3. `npm run eval:rag:offline` if Batch 1 changed answer behavior and it was not already run after final rebasing.
4. `npm run verify:ui` if Batch 3 changed visible UI behavior.

## Provider-backed approval gates

Do not run these without explicit confirmation:

- `npm run check:supabase-project`
- `npm run check:production-readiness`
- `npm run eval:retrieval:quality`
- `npm run eval:rag -- --limit 15`
- `npm run eval:quality -- --rag-only`
- `npm run verify:release`

## Recommended PR split

1. PR A: Batch 0 docs/prerequisite proof only if environment setup requires repo documentation; otherwise no PR.
2. PR B: Batch 1 answer `summaryMode` contract and tests.
3. PR C: Batch 2 CI governance/action-pin guardrails.
4. PR D: Batch 3 UI/accessibility remnants.
5. PR E: Batch 4 `.npmrc` warning decision.
6. PR F: Batch 5 formatting-only cleanup.

This split keeps clinical behavior, CI governance, UI polish, npm config, and formatting isolated so regressions are easier to detect and revert.
