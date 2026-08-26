# Ward Flow Phase 5 — session handover

**Written 2026-08-26.** This file exists so a session with no memory of the work can pick it up
exactly where it stopped. It records what was built, what is proven and by what evidence, what is
still broken, and the one decision waiting for a human. It is deliberately blunt about the things
that are unfinished — a handover that reads as though everything is fine is worse than none.

Companion documents, none of which this file duplicates:

| For                                              | Read                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| The binding specification (14 decisions, D1–D14) | `docs/superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md` |
| Direction, phase order, settled refusals         | `docs/ward-flow-roadmap.md`                                                      |
| What was built and what screenshots caught       | `docs/ward-flow-complete-ledger.md` §5d                                          |
| Earlier Phase 1–3 rulings                        | `docs/ward-management-decisions.md`                                              |

---

## 1. Resume in sixty seconds

```bash
git fetch origin claude/ward-flow-phase-5-p8rwcm
git checkout claude/ward-flow-phase-5-p8rwcm
```

- **Branch:** `claude/ward-flow-phase-5-p8rwcm`
- **Pull request:** [#2390](https://github.com/BigSimmo/Database/pull/2390), open, not draft
- **Last commit that changed code:** `400cedd9` — 20 commits ahead of `main`, 52 files,
  +4052 / −166. Anything after it on this branch is this handover document; check the branch tip
  rather than assuming that SHA is still the head.
- **Phase 5 is functionally complete.** Every task in the plan is built, reviewed and pushed.
- **One check is still red and is this branch's to fix:** `Build`, on the mockups bundle budget.
  Section 6 has the full diagnosis and the decision it needs. Nothing else is known-red.

---

## 2. What Ward Flow is, in one paragraph

A synthetic, offline prototype of a psychiatric bed-flow hub for Western Australia, built for a
practising psychiatrist in Perth. It is reachable only through the administrator-gated developer
hub at `/mockups/ward-flow`, holds no real data, and is **not clinical decision support**. Its real
output is a shared understanding of what such a system would have to do.

---

## 3. Constraints that override everything below

These are not preferences. A change that violates one is wrong even if every test passes.

1. **Never invent a legal figure.** No figure or requirement from the Mental Health Act may be
   cited, paraphrased or inferred — not in code, copy, comment, test or fixture. If one is needed,
   stop and ask the product owner. `tests/ward-legal-figure-guard.test.ts` sweeps every reachable
   state for exactly this, and its `switch` is exhaustive, so a new event cannot pass unswept.
2. **Synthetic data only.** No name, date of birth, medical record number, address, diagnosis,
   narrative history or treatment. Sex is the only permitted patient attribute, and spec D11
   excludes even that from bed releases and leave beds. Free text counts as data.
3. **Local and offline checks only.** Never run `verify:release`, any `eval:*` script,
   `check:supabase-project`, `test:live`, or anything touching OpenAI, Supabase, hosted CI or a
   live database.
4. **The one rule this phase exists to hold:** nothing predicted, confirmed-but-unreleased, or on
   leave is ever added into "available now". A coordinator must be able to point at one number and
   say "that is a bed I can fill this minute".

---

## 4. What was built

Phase 5 **extends** Phase 4's `BedRelease`, its fixed blocker list and its ward-only flag event. It
never builds a parallel concept beside them.

### 4.1 The bed-release lifecycle

`predicted → confirmed → blocked → released`, and only a ward may move it.

- `confidence` narrowed to `likely | possible`, and means something only while a release is
  predicted — a confirmed release has no confidence, because it is no longer a belief.
- `blocker` is state-dependent and typed: legal only while blocked.
- The invariant holds **by construction**. Each transition builds its own object literal, so no
  code path can produce both fields non-null. It is not merely tested against.
- Files: `ward-model.ts` (types and `BED_RELEASE_STATES`), `ward-flow-events.ts` (six new events),
  `ward-flow-reducer.ts` (six new cases).

### 4.2 Leave beds are their own type

`LeaveBed` carries nothing about the person on leave. A usable leave bed is never merged into
availability — it is its own figure. It has the two-state life the spec describes: recorded, then
ended on return (`END_LEAVE_BED` is wired to a real control, not dead code).

### 4.3 Five capacity figures, never a sum

`Available now · Confirmed today · Predicted today · Held · Leave (usable)`.

`src/components/ward-management/ward-bed-availability.ts` is the single place these are derived.
`availableNow` and `held` are copied verbatim from `unitCapacity()` so the number a coordinator
acts on cannot drift, and both are computed **before** any release or leave bed is examined — a
prediction is structurally incapable of inflating availability.

Bands are derived by comparing the raw instant against named minute constants:

```
MIDDAY_MINUTES            = 12 * 60   // 720
LATE_AFTERNOON_MINUTES    = 16 * 60   // 960
EVENING_SHIFT_END_MINUTES = 22 * 60   // 1320  ← "tonight" ends here
```

`released → "now"`; beyond `EVENING_SHIFT_END_MINUTES` → `"beyond-today"`; then `now`, `by-midday`,
`by-1600`, `tonight`.

### 4.4 The discharge and egress board

New route `/mockups/ward-flow/discharges`. Blocked rows first, because those are the ones somebody
must act on. Cards rather than a squeezed table below 40rem. The beyond-tonight exclusion count is
stated at the foot **even when it is zero** — silent truncation reads as "we counted everything".

### 4.5 A shared freshness stamp

`WardFreshness` renders on every board: `Confirmed HH:MM · Role`, or `As at HH:MM` for a derived
figure, or `Never confirmed`. Never a blank and never a dash, because a blank invites a guess.

### 4.6 The coordinator's one permitted action

Marking a ward's count refresh-requested. It changes no number, nothing leaves the sandbox, and no
message is sent.

### 4.7 Supporting changes

- Blocker list grown to seven, all operational. Guardianship, financial arrangements and family
  availability stay **excluded** — each describes the person rather than the bed.
- The new route is registered in five places, each of which fails closed: sidebar nav, two
  route-contract maps in tests, CI's change-scope map (`scripts/ci-change-scope.mjs`), and the
  generated `data/repo-awareness-snapshot.json`.
- Documentation travelled with the code in the same pull request, never its own.

---

## 5. Verification — what is actually proven, and how

Reported honestly rather than favourably. "Proven by a screenshot" means a human-equivalent look at
the rendered screen, not that a test rendered it.

| Item                                   | Proven by                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Lifecycle transitions and their guards | Tests, every one mutation-tested                                           |
| The five capacity figures              | Tests, mutation-tested                                                     |
| Freshness stamp, all three branches    | Tests, mutation-tested                                                     |
| Legal-figure sweep                     | Test, proven non-vacuous by emptying a candidate list and watching it fail |
| Ward controls                          | Tests **and** screenshots at 390 / 820 / 1440                              |
| Discharge board                        | Tests, screenshots, **and** a Chromium journey proven able to fail         |
| Capacity headline                      | Tests **and** screenshots — screenshots caught what tests missed           |
| Coordinator refresh request            | Tests only; never looked at on a rendered screen                           |

### Gate results on the final tree

- `npm run test` — `Tests 3 failed | 10559 passed | 1 skipped (10563)`
- `npm run typecheck` — clean
- `npm run lint` — clean, **after clearing `node_modules/.cache/eslint`** (see §8)
- `npx prettier --check` on all changed files — clean
- `tests/ui-ward-discharges.spec.ts` — `1 passed (3.6s)`, and proven able to fail: mutating
  `CONFIRM_BED_RELEASE` to coordinator-only turns it red with the release stuck at "Predicted"
- Every `static-pr` sub-check run individually — all pass at `400cedd9`

### The three failing unit tests are NOT this branch's

`clinical-hazard-controls`, `privacy-readiness-contract` and `rag-plan-package-parity` fail
identically on clean `origin/main`, verified by running them in a worktree at that ref. They are
untouched here. **Do not "fix" them inside this branch.**

### Gates deliberately not run

- `verify:release`, `eval:*`, `check:supabase-project`, `test:live` — provider-backed, forbidden.
- `verify:ui` as a wrapper — the one new journey was run directly and the three changed screens
  were captured at three widths. CI's Production UI lane is the authoritative full-matrix run.
- `verify:pr-local` as a wrapper — its constituent gates were run individually instead.

---

## 6. THE ONE THING STILL BROKEN — read this before anything else

**`Build` fails on `check:bundle-budget`.** Reproduced locally at `400cedd9` after
`rm -rf .next && npm run build`:

```
production (what users download, 134 routes): 1661.2 KiB gzip — baseline 1656.0 KiB, within tolerance.
mockups (design scratch, 141 routes):          613.1 KiB gzip — baseline  487.6 KiB, +25.7% (tolerance 25%).
FAIL — mockups scratch +25.7% vs baseline (tolerance 25%).
```

### What this does and does not mean

- **No user-facing regression exists.** The `production` bucket — every chunk a real route reaches
  — is within tolerance. The failing bucket is chunks reachable **only** from `/mockups/**`, which
  404 in production. `AGENTS.md` describes it as "a repo-hygiene ceiling for unbounded
  accumulation, not a per-mockup gate".
- It is over by **0.7 percentage points**.
- The growth is **not all Phase 5's**. `main` gained the entire Care Plan synthetic prototype
  during this branch's life. A comparison build on clean `origin/main` was started to apportion it
  **has since been completed, and it settles the question** — see the apportionment below.
- The check also warns that baseline commit `0764fb581356` does not resolve locally (shallow
  clone). `git fetch --deepen=2000` before trusting any ancestry claim.

### Apportionment — measured, not estimated

Both numbers come from a clean `rm -rf .next && npm run build` at the named ref, read from the
per-route client-reference manifests:

| Ref                      | mockups bucket | vs baseline 487.6 KiB |
| ------------------------ | -------------- | --------------------- |
| clean `origin/main`      | 608.1 KiB      | **+24.7%**            |
| this branch (`400cedd9`) | 613.1 KiB      | **+25.7%**            |
| ceiling                  | —              | 25%                   |

**`main` is already at +24.7%, three-tenths of a point under the ceiling and already inside the
check's own 15% drift-warning band.** Phase 5 adds 5.0 KiB, which is **one percentage point** — so
roughly **96% of the overage was on `main` before this branch existed**, and Phase 5 is merely the
point that tips it over. That is `#QSHHGK` happening, word for word.

Production tells the same story: `main` 1660.7 KiB, this branch 1661.2 KiB. Phase 5 adds 0.5 KiB —
0.03% — and both sit just above the 1656.0 KiB production baseline, so `main` carries production
drift of its own too.

- This is already a known, recorded problem: outstanding issue **`#QSHHGK`** — "Nothing schedules a
  bundle-budget baseline refresh, so accumulated growth fails whichever unrelated PR lands last."
  Phase 5 is simply the PR that happened to land last.

### The decision, which is the product owner's

`AGENTS.md` allows exactly two resolutions for the **mockups** bucket, and forbids a third:

1. **Prune stale mockups** so the bucket comes back under the ceiling.
2. **Refresh the baseline deliberately** with `npm run check:bundle-budget -- --update`, and say
   why in the pull-request body.
3. **Not permitted:** refreshing the _production_ baseline to clear a _production_ failure. That is
   not the situation here, but do not let the two get conflated.

**Recommended, now that the apportionment is measured: option 2, with one important caveat.**
Pruning is not available to this branch — the growth is `main`'s, not Phase 5's, and pruning other
people's mockups is well outside this change.

**The caveat matters.** `--update` rewrites **every** baseline in `bundle-budget.json` —
production, per-route, and mockups alike (`scripts/check-bundle-budget.mjs`, "refresh every
baseline"). Running it here would silently re-baseline production's own 4.7 KiB of accumulated
drift as the new normal, which is precisely the hiding-a-regression failure the production bucket's
"do not refresh the baseline to clear it" rule exists to prevent. So either:

- run `--update` and state in the PR body that the production baseline moved too, and by how much;
  or
- refresh **only** `mockups.gzipBytes`, leaving production and per-route baselines untouched. This
  is the more conservative option and the one to prefer, because it changes exactly the number the
  evidence justifies changing and nothing else.

Either way, **this is the owner's call, not an agent's** — it is a repo-wide config change that
governs every future pull request, and no measurement makes that decision automatic.

### Reproducing it

```bash
rm -rf .next          # MANDATORY — a cached .next makes this check report stale numbers
npm run build
npm run check:bundle-budget
```

---

## 7. Defects found and fixed during the phase

Recorded because the _class_ of each one is more useful than the fix.

### 7.1 Four defects that 10,000+ passing tests missed and screenshots caught

The project's recorded recurring failure, caught mid-phase this time rather than after later work
was built on top. Each fix carries an assertion that would catch its return.

1. The discharge board printed each confirming ward twice per row.
2. **The capacity board contradicted its own headline** — the headline separated confirmed from
   predicted and excluded beyond-tonight, while the per-unit row three columns away still showed
   the raw undifferentiated count.
3. A raw union value rendered as user-facing text — a release read `confirmed`, lowercase.
4. Fixing (2) exposed a fourth: the ward screen still said "Potential 1" for a unit the capacity
   board now described as "Confirmed 1, Predicted 0".

### 7.2 One Critical defect found by task review

`RELEASE_BED` was unclamped and could push a unit past its own bed total — with `beds=5`,
`empty=5`, `allocatable=5`, four figures summed to 6. Fixed with `Math.min(unit.beds, …+1)` plus a
regression test that forces full vacancy. Mutation gave `expected 21 to be 20`.

### 7.3 One hollow test, strengthened rather than accepted

The "Confirmed" freshness test asserted only the role, so swapping `formatInstant(confirmedAt)` for
`formatInstant(now)` would have survived it. Rewritten to assert the exact time.

### 7.4 Four automated code-review findings, all fixed (commits `86705157`, `47b51405`)

1. **P1 — every ward-entered prediction landed in the wrong band.** `FLAG_BED_RELEASE` carried no
   expected time, so the reducer stamped `expectedAt: event.now` — the instant the ward _reported_
   the release, not when the bed comes free. `releaseBand()` then always returned `"now"`, so the
   four bands only ever worked for hand-authored fixtures. Fixed by adding a required
   `expectedAt: Instant` to the event and collecting it on the ward screen's flag form, using the
   same parser the leave-bed form already uses.
2. **P2** — leave-bed id collision.
3. **P2** — `confirmedAt` not refreshed on transitions.
4. **P2** — released beds banding "now" across the day boundary. Initially fixed, then **reverted
   on the controller's ruling** after review of the in-flight diff. Reasoning is in
   `.superpowers/sdd/…/review-fix-report.md`.

### 7.5 One reversal worth recording

The day-end boundary went 22:00 → 24:00 → 22:00 at the owner's direction. The spec is byte-identical
to `main`. Worth recording because D5 had written the boundary down "so it can be changed in one
place", and that is exactly how it behaved: one named constant, one assertion, and no code ever
shipped at the wrong value.

---

## 8. Process lessons — two gates that hide, and one that lies

These cost real time and will cost it again.

1. **Formatting is in none of `test`, `typecheck` or `lint`.** After all three passed,
   `npx prettier --check` found five unformatted files. This is the exact failure `AGENTS.md`
   records three CI reds for. Run `npm run format` **and commit the result** before pushing.
2. **`npm run lint` uses a per-file cache.** A warning caused by a _different_ file's change stays
   invisible. Clear `node_modules/.cache/eslint` first. Doing so surfaced a real `--max-warnings 0`
   failure that had been hiding.
3. **Generated files drift silently when a commit hook is skipped.** `Static PR checks` went red
   because `data/outstanding-issues-snapshot.json` was behind after two `issues:add` requests.
   Regenerate with the repo's own tool (`node scripts/generate-outstanding-issues-snapshot.mjs`);
   never hand-edit.
4. **`scripts/run-playwright.mjs` exits 0 when tests fail and when it refuses to run.** Read the
   "N passed" line. An exit code is not evidence.
5. **Never run tests while a helper agent is editing source.** The dev server rebuilds on change,
   and a run against a half-swapped page produces failures that are not real. This happened twice.

### Verification-waste audit (requested, completed)

Nothing was skipped, no assertion deleted, no test loosened, no tolerance lowered, and every
deliberate-breakage check still ran. Findings:

- **Broad selection for narrow proof:** implementer dispatches used `npx vitest` directly, which
  bypasses `scripts/run-vitest.mjs` and so took _no_ lease rather than the shared one. Harmless in
  an isolated container, wrong as a habit. Corrected.
- **Queueing behind other sessions:** zero lock refusals; nothing was recorded UNRUN.
- **Re-deriving an existing verdict:** none found. The arbiter returned `RUN` for lint, typecheck
  and test (UI scope never defers), so no receipt was available to reuse and none was claimed.
- **Reviewing what cannot have changed:** one genuine saving — Tasks 5, 6, 7 and both visual-fix
  rounds were folded into the single final whole-branch review instead of five separate seats.
  Coverage is unchanged; only latency on findings was traded.

---

## 9. Known unknown: the intermittent `Advisory UI` failure

`tests/ui-ward-roles.spec.ts` has failed with `getByTestId('ward-unit-screen') resolved to 2
elements`, on a failure that **moves between tests across runs**.

What is established:

- Only one `WardScreen` render site exists (`src/app/mockups/ward-flow/ward/[unitId]/page.tsx`).
- The two `data-testid="ward-unit-screen"` divs in `ward-screen.tsx` are mutually exclusive — the
  not-found branch is an early `return`.
- No `Suspense`, no `loading.tsx`, no `template.tsx` anywhere in the ward-flow tree.
- The accessibility snapshot shows one complete screen with one `h1`, so the second element is
  empty or hidden.
- One run on clean `origin/main` gave `19 passed`; one run on the branch gave `1 failed / 18
passed`. **A single run each is not enough to attribute this.**

Current best hypothesis, **not established**: the failing runs happened while a helper agent was
editing source, and Next's development server rebuilt the page mid-run. The honest next step is to
run `node scripts/run-playwright.mjs tests/ui-ward-roles.spec.ts --project=chromium-mockups` three
times on a completely quiet tree, and three times on `origin/main` in a worktree.

**If it proves to be this branch's regression, fix the product, not the assertion.** If it proves
pre-existing or genuinely flaky, leave one comment on the pull request saying so and do not weaken
the test. The repo's flake policy requires three reproductions on the same SHA before any
quarantine.

---

## 10. Owed before Phase 6 builds on this

Both are already written into `docs/ward-flow-roadmap.md`. Neither blocks Phase 5.

1. **Spec D14 has still never been checked by a ward clinician.** `predicted → confirmed → blocked
→ released` is a software model of how a bed comes free. A bed may be confirmed and blocked at
   once in reality, and "predicted" may compress several distinct real states. It is cheap to
   change while everything is synthetic, and Phase 6 is built entirely from these numbers — so the
   cost of it being wrong rises the moment Phase 6 lands. Nothing else in Phase 5 depends on there
   being exactly four states.
2. **Design Phases 6 and 7 in one conversation, and 8 and 9 in another.** Each design conversation
   carries a large fixed setup cost, and Phase 6 is small and already largely determined by Phase
   5's numbers. Each phase still gets its own written specification — only the conversation is
   shared.

---

## 11. Automated review coverage on this pull request

- **CodeRabbit** reported "Review limit reached" repeatedly (1 included review per hour against a
  much higher merge rate), and its one real attempt aborted because the head changed mid-review.
  Per the owner decision recorded in `AGENTS.md`, this is accepted and the spending cap stays as it
  is. Do not raise it.
- **The Cursor approval agent approved twice**, both times stating it skipped the bug-finding
  signal because that bot had not reported when it polled. **That is a policy approval, not a
  defect review.**
- The four findings in §7.4 came from the Codex connector, which did review the diff.
- The deterministic gates carried the load. Do not weaken any of them to compensate.

---

## 12. Working state left behind

Git-ignored, so a fresh clone will not have them; they are named here so a resuming session knows
what existed rather than recreating it blindly.

- `.superpowers/sdd/2026-08-26-ward-flow-phase-5-bed-availability/` — the subagent-driven-development
  workspace: `progress.md` (the ledger, with rulings C1–C19), per-task briefs and reports, review
  packages, and `review-fix-report.md` for the four code-review findings.
- `.tmp-visual/capture-ward-flow.mjs` — the screenshot sweep (3 screens × 3 widths). It verifies the
  dev server's project identity before attaching, reports HTTP status, body overflow, `h1` and
  console errors.
- A worktree at `/tmp/main-baseline` pinned to clean `origin/main`, used to prove the three failing
  unit tests are pre-existing and to start the bundle comparison in §6.

Never assume `localhost:3000`. Use `npm run ensure` and the URL it prints.
