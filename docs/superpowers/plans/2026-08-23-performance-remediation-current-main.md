# Current-main Performance Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Resolve the performance defects that remain evidenced on current main, strengthen the measurement and budget guardrails that failed to classify them, and publish a reviewable PR whose claims distinguish historical Linux Lighthouse evidence from current Windows diagnostics.
**Architecture:** Keep the shared search shell and namespaced-mode lazy boundaries intact. Move only the root dashboard's initial ownership into the root route so its public start-state HTML is present before the late dashboard chunk, make the documents request explicitly render its no-query child through the existing Suspense boundary, stabilize the known degraded-notice insertion, and improve non-failing budget diagnostics. Attribute responsive composer behavior before changing its geometry.
**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Vitest 4, Playwright Chromium 151, repository Lighthouse/bundle/CLS runners.

## Evidence boundary and global constraints

- Historical Cloud audit commit: `f3d1a3cce2c943ad3083425ed9c7c46dbef23087`. Its four untracked Cloud JSON files did not transfer to this local checkout; committed historical summaries remain evidence, not current measurements.
- Current retained diagnostic run: Windows Chrome 151 at pre-remediation HEAD `6c0e7598ba73e803f4a2ad4b155763f1ddd5b549`. The checker correctly classified it as `evidence incomplete` against the Linux Chrome 151 baseline, so none of its cells update or close the baseline.
- Current diagnostic metrics: desktop documents LCP 1017ms/TBT 79ms/CLS 0.027229; desktop root 1418ms/30ms/0.007020; mobile documents 2737.394ms/881.361ms/0.000816; mobile root 6794.509ms/61.193ms/0.
- Never update `lighthouse-budget.json` or `bundle-budget.json`, raise a performance budget, weaken CSP, bypass a repository test lease, or access live/provider/hosted data.
- Preserve one composer owner, unique `#main-content`, the wrong-project identity/setup safety gate, authenticated preference semantics, required non-passive zoom handlers, PWA `:has()` selectors, and the namespaced-mode dashboard lazy boundary.
- Treat retained Lighthouse reports as single-run diagnostics. Claims about improvement require same-host before/after evidence; Linux budget grading remains CI-owned.
- Every task receives an independent spec and quality review from its exact pre-task base to its exact head. Critical or Important findings must be fixed and re-reviewed before proceeding.
- Before Task 1 changes source, retain two more unchanged-input Lighthouse runs at exact HEAD `6c0e7598ba73e803f4a2ad4b155763f1ddd5b549`, in unique directories, so the existing run plus the two new runs form a three-run Windows pre-remediation distribution. Do not proceed from a different HEAD.
- Ship each Task 1 experiment independently only if the same-host pre/post distributions show a credible render-delay/LCP improvement on its target route without a material TBT, CLS, request, transfer, or enforced bundle regression. If the root gate fails, iterate or revert the root ownership portion. If the documents gate fails, iterate or revert the documents request-rendering portion. Retain only independently justified changes.

## Task 1: Put public start-state content on the request-rendered path

**Files**

- Modify: `src/app/(search-app)/home-page-client.tsx`
- Modify: `src/app/(search-app)/page.tsx`
- Modify: `src/app/(search-app)/documents/search/page.tsx`
- Modify: `src/components/clinical-dashboard/global-search-shell.tsx`
- Modify: focused source/DOM tests under `tests/`

**Interfaces**

- `HomePageClient` consumes the already-derived `initialMode`, `initialQuery`, `focusSearch`, and `autoRunSearch` inputs and owns the root-only `SettingsStateProvider` plus a static `ClinicalDashboard` import.
- `GlobalSearchShellDashboardGate` returns the root route child when `/` is dashboard-owned; it retains the dynamic `ClinicalDashboard` path for `/documents` and other dashboard-owned submitted routes.
- `DocumentsSearchRoute` explicitly calls `await connection()` before returning the existing static no-query content.

**Steps**

- [ ] Add RED contracts proving the root page passes all derived inputs to `HomePageClient`, the root client statically owns `ClinicalDashboard`, and the global gate renders `props.children` for the dashboard-owned root without creating a second dashboard or settings provider.
- [ ] Add a RED contract proving the documents no-query route awaits `connection()` while preserving its current accessible heading and copy.
- [ ] Run the smallest focused Vitest command covering the new contracts and confirm the intended failures.
- [ ] Implement the root-only ownership transfer. Do not statically import `ClinicalDashboard` into the shared shell; do not alter submitted-search routing or namespaced mode ownership.
- [ ] Make the documents route request-rendered with `connection()`; do not echo `props.children` in the generic Suspense fallback.
- [ ] Run focused route-ownership, shell-props, loading-boundary, client-performance-boundary, and new tests; inspect the root and documents server output/DOM for one `#main-content` and one dashboard/page tree.
- [ ] From a production build, capture raw response HTML and also load each route in a JavaScript-disabled browser. Require `#shared-home-empty-state-title` on `/` and the existing documents explanatory paragraph on `/documents/search` to be present before hydration, with one `#main-content`, one dashboard/page tree, and no duplicate provider-owned surface.
- [ ] Commit as `perf(search): render public start states on the request path`.

## Task 2: Make CLS attribution cover responsive composer and degraded transitions

**Files**

- Modify: `scripts/measure-cls-attribution.mjs`
- Modify: `tests/measure-cls-attribution-contract.test.ts`
- Optionally add: a small pure helper module under `scripts/lib/` plus its unit test if parsing/decision logic would otherwise be embedded in the runner.

**Interfaces**

- Add explicit named browser profiles rather than width-only inputs. The required profiles are Lighthouse-equivalent mobile `412x823` (DPR 1.75, mobile/touch true) and exact desktop `1350x940` (desktop DPR/device semantics); additional `800x900`, `1280x900`, and `1440x900` desktop profiles may be included.
- Record width, height, DPR, `isMobile`, and `hasTouch` in every output cell so a wide mobile-emulation context cannot be mistaken for desktop evidence.
- Add opt-in degraded-state exercises that (a) toggle browser offline and back online only after the page and assets load and (b) independently route the relevant existing API request to a deterministic unavailable response and exercise the existing UI action/retry that sets the dashboard unavailable state. Record healthy, offline, reconnecting, and API-unavailable phase markers and CLS entries.
- Record first-paint/settled geometry for the mode-home composer slot/header and DOM presence/visibility timing for the root/document LCP candidates.

**Steps**

- [ ] Add deterministic RED tests for full browser-profile parsing, exact mobile/desktop semantics, default backward compatibility, observer readiness, both degraded-state mechanisms, transition phase recording, and stable output keys.
- [ ] Implement the options without weakening the existing isolated build, local-project identity, heavy-run lock, offline-provider environment, browser selection, cleanup, or instrumentation fail-closed behavior.
- [ ] Keep the default command provider-free and DB-free. Browser offline toggling must occur only after the loopback document and its assets have loaded.
- [ ] Run focused runner contract/unit tests.
- [ ] Commit as `test(performance): attribute responsive and degraded layout shifts`.
- [ ] From the reviewed head, run one production attribution pass for `/` and `/documents/search` at all selected profiles with both degraded-state mechanisms enabled, retaining the JSON outside tracked source.
- [ ] Decision gate: if a composer slot/header shift above 0.01 is attributed at a wide viewport, implement the smallest stable-height rail or measured breakpoint band in Task 3. If it is not reproduced, leave `#308`/wide `#JVYQEM` unchanged and record that the residual cross-OS Lighthouse result is insufficient to justify a geometry change.

## Task 3: Stabilize degraded-state geometry and guard the hydration selector boundary

**Files**

- Modify: `src/components/ClinicalDashboard.tsx`
- Modify: `src/components/clinical-dashboard/dashboard-notices.tsx` only if the notice requires an explicit inert/hidden state contract
- Modify: `src/app/globals.css` only if Task 2 attributes a composer geometry defect
- Modify: `docs/search-chrome-behaviour.md`
- Modify: `tests/pwa-lifecycle.dom.test.tsx`
- Modify/add: focused dashboard notice and composer geometry tests under `tests/`

**Steps**

- [ ] Add a RED contract for an always-mounted, breakpoint-stable degraded-notice frame whose contents change without inserting a new flow sibling above the hero. Preserve alert semantics only while the notice is visible; the healthy state must not expose empty live-region content.
- [ ] Implement the frame with a stable geometry across offline, reconnecting, and API-unavailable states. Use the least visually disruptive existing drawer/frame primitive; do not create overlapping interactive content.
- [ ] Verify the healthy-state frame visually and geometrically at the required phone and desktop profiles. If it introduces an unacceptable blank band or materially moves the root LCP surface, replace it with a stable non-overlapping design rather than accepting the regression.
- [ ] Add documentation beside the search-chrome hydration invariant explaining why `:has(#main-content ...)` selectors must stay in the post-hydration PWA block.
- [ ] Add a static allowlist test that rejects any current or future `:has(#main-content...)` occurrence outside that explicit PWA block while retaining all existing selectors.
- [ ] If Task 2 crosses the composer decision threshold, add RED geometry/source contracts and split generic-page versus mode-home-wide reserve ownership; prefer the existing `layout="scroll"` one-line prompt rail at `sm+`, otherwise use measured viewport/container bands. Do not publish a reserve correction after paint.
- [ ] Run focused dashboard, search-route-ownership, header-scroll, PWA DOM, and CLS contract tests.
- [ ] Commit as `fix(search): stabilize deferred chrome geometry`.
- [ ] Re-run the same attribution command and require no offline, reconnecting, or API-unavailable transition shift above 0.01 at the required phone and desktop profiles. For any composer change, require the attributed shift to fall below 0.01 at every affected profile and preserve a zero reserve when the composer is hidden.

## Task 4: Remove unsolicited route prefetch and surface bundle-baseline uncertainty

**Files**

- Modify: `src/components/ClinicalDashboard.tsx`
- Modify: `tests/audit-navigation-auth-regressions.test.ts`
- Modify: `scripts/check-bundle-budget.mjs`
- Modify: `tests/bundle-budget.test.ts`
- Modify: `tests/client-performance-boundaries.test.ts` or `tests/mode-menu-prefetch.dom.test.tsx` if needed to pin intent-only prefetch.

**Steps**

- [ ] Add RED tests requiring the dashboard to omit the unconditional 250ms `prefetchApplications` effect while retaining pointer/focus intent prefetch through both sidebars.
- [ ] Remove only that timer/effect. Do not change route authorization, favourites eligibility, or the prefetch callback used on user intent.
- [ ] Add RED tests for a non-failing explicit warning when a configured 40-character `baselineSource` cannot resolve or cannot be compared with HEAD.
- [ ] Implement a pure warning decision where practical, and include remediation text. Do not silently treat an unresolvable source as fresh, auto-update it, or fail an otherwise-valid budget check.
- [ ] Add medication snapshot and medication interaction-index marker groups to the existing fixture leakage guard with positive and negative tests. Classify this as regression prevention, not measured speed improvement.
- [ ] Run focused navigation, prefetch, client-boundary, and bundle-budget tests plus the checker's self-test.
- [ ] Commit as `perf(shell): defer route prefetch to user intent` (or split the bundle guardrail into a second coherent commit if the final diff is clearer that way).

## Task 5: Analyze bundles, rerun measurements, and publish exact evidence

**Files**

- Add: `docs/evidence/performance-remediation-2026-08-23.md`
- Modify: `docs/outstanding-issues.md` only through the repository issue workflow and only when current deterministic evidence justifies a status change.
- Modify: `docs/branch-review-ledger.md` as required by the repository PR handoff workflow.

**Steps**

- [ ] Run a clean isolated `npm run build:analyze` and inspect `.next/analyze/*.html`. Treat `4411`, `8322`, `4bd1`, and `1566` as pre-remediation-only identifiers: map one only if its exact asset filename/hash is proven identical in the analyzed build. Otherwise correlate final Lighthouse asset identifiers with final analyzer route/module ownership and explicitly leave the old IDs unmapped. Do not edit modules from opaque IDs alone.
- [ ] Run `npm run check:bundle-budget` on a standard production build. Require existing size ceilings to pass and capture the new unresolvable-baseline warning; do not update the baseline.
- [ ] Run all focused tests from Tasks 1–4, scoped formatting, lint/typecheck/build as routed by repository scripts, and the full unit suite once. Classify any failure against the untouched-base evidence; the nine known Windows portability failures are baseline only if the exact signatures remain identical.
- [ ] Run three retained post-remediation Lighthouse measurements on Windows with unchanged inputs, each in a unique directory. Compare the three-run pre/post distributions, medians, and every run for LCP, render delay, TBT, CLS, unused JavaScript, request count, and transfer. Report every run; do not cherry-pick or grade against Linux. Apply the independent root and documents acceptance/rollback gates from the global constraints.
- [ ] Write the evidence document with the historical Cloud SHA and unavailable-artifact limitation, exact pre/post HEADs, all four current metrics, same-host comparisons, analyzer findings, issue dispositions, checks, baseline failures, Chrome cleanup `EPERM` caveat, and provider/physical-device/hosted checks not run.
- [ ] Include an explicit retained-finding matrix in both the evidence document and PR body. Classify authenticated preference GET/conditional PUT, identity/setup sequencing, initial dashboard fan-out, non-passive zoom handlers, fixture snapshot isolation, skeleton shimmer, scoped theme transitions, CSP nonce behavior, and unsolicited route prefetch as one of: fixed, already resolved/stale, prevention-only, measurement-deferred, or intentionally unchanged. For each, state the current evidence and stop rule.
- [ ] Update only issues proved resolved by current deterministic evidence. Keep `#308`/`#JVYQEM` open or explicitly narrowed if wide geometry is not proven fixed; mark `#2TAQDC` guardrail completion separately from its already-resolved live defect; do not close `#QSHHGK` unless the configured baseline source itself becomes valid.
- [ ] Commit Task 5's evidence, issue, and ledger updates as a coherent documentation/handoff commit after their scoped checks pass.
- [ ] Fetch and compare `origin/main`; merge a newer base only if required and conflict-safe, then rerun checkout-sensitive minimum gates and commit any required conflict-resolution/handoff adjustment.
- [ ] Only after synchronization and all final commits, compute the exact PR diff base with `git merge-base origin/main HEAD` and obtain a final independent branch review to the exact final head, recording both SHAs. Resolve all Critical/Important findings and rerun affected checks and review; any later change invalidates the reviewed head and requires the affected verification/review again.
- [ ] Push `codex/task-performance-remediation` and open the authorized PR. The PR body must include the full handoff context, exact commands/results, historical-versus-current evidence boundary, deferred items, and remaining Linux/CI verification. Do not enable or alter auto-merge.

## Completion proof

- [ ] Every implementation task has a retained task report/review package, a committed implementation, and an independent PASS review. SDD workspace reports may remain ignored when that is the repository convention.
- [ ] Tracked worktree is clean; retained raw reports are either preserved outside the commit or intentionally attached as artifacts, never silently deleted.
- [ ] PR head equals the unchanged reviewed and verified local head; if a commit, merge, or handoff edit changes HEAD after review, repeat the affected verification and review before pushing.
- [ ] PR is open with checks visible; no claim of merge, deployment, provider validation, physical iPhone Safari/PWA proof, or Linux Lighthouse grading is made without evidence.
