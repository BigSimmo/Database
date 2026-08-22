# Developer hub Phase 1 — completion record

Companion to `-HANDOFF.md` (how to resume) and `-WORKLOG.md` (the full history through Task 2).
This file closes the plan: what shipped, what was decided on the owner's behalf, and what is left.

**Committed to the branch on purpose.** Every decision below was recorded in the session's
git-ignored SDD workspace, which this plan has now lost four times. The workspace is deleted; this
is the record.

Branch: `claude/developer-hub-phase-1-tasks-3-10` (cut at `f50440ad8`, the tip of
`claude/developer-button-settings-fb9b51`). Session: 2026-08-22.

---

## 1. Status — all ten tasks complete

| Task | What                                     | Commit(s)                                          |
| ---- | ---------------------------------------- | -------------------------------------------------- |
| 1–2  | Generator, parser, staleness gate        | shipped previously                                 |
| 3    | Typed reader + freshness                 | `4cf8ae0d3`                                        |
| 4    | Panel registry                           | `807d78c47`, fixed `edcbfc11b`                     |
| 5    | Nav-header sibling                       | `1f18de398`                                        |
| 6    | Freshness stamp, environment strip, card | `e52198827`, `13902267f`                           |
| 7    | Hub page                                 | `4d9e0cc82`, `ae369c087`, `952826e55`              |
| 8    | Ledger page                              | `443c504ab`, `8321a3544`, `80e674fcb`              |
| 9    | Settings rename to "Developer"           | `1f98e4483`                                        |
| 10   | Documentation                            | `3c5fa3629`                                        |
| —    | Addon-slot registration                  | `ce4b1cb72`                                        |
| —    | Final-review fix wave                    | `a834dca73`, `e354c4b55`, `22fd81ccc`, `e30135bf5` |

Every task had its own scoped review. The whole-branch review returned **0 Critical, 4 Important,
~7 Minor**; all four Importants were fixed and the Minors triaged.

## 2. Verification evidence

`npm run verify:pr-local` — **19 checks completed, none failed, none skipped, exit 0**:

```
Test Files  696 passed | 2 skipped (698)
     Tests  7584 passed | 57 skipped (7641)
✓ Compiled successfully
Client bundle secret surface check passed.
Offline RAG fixture and manifest validation passed (36 golden cases, 26 suites).
```

`npm run verify:phone-chrome` — exit 0, 133 contract tests across 9 files. **Its selector routed to
focused coverage and did not run a browser stage**, judging the scope page-local. No Chromium proof
of these pages exists, and none is claimed.

**Controller render proof** against a live dev server: `/mockups/development` → HTTP 200, 90 KB;
`/mockups/development/ledger` → HTTP 200, 507 KB rendering **67 ledger items, exactly the snapshot's
open count**, zero RSC errors, zero raw `\|` escapes.

## 3. The two defects that only a real environment caught

Both were Server/Client boundary violations, and both are worth knowing because **typecheck does not
model that boundary and Vitest has none at all**.

**3.1 `PanelCard` threw on every render.** It rendered `<button onClick={…}>` with no `"use client"`.
Because the hub page is a Server Component, React serialised the handler into the flight stream and
the route threw _"Event handlers cannot be passed to Client Component props"_ — 17 times on one page
load, proven by fetching the route from a dev server. **`next build` does not catch this either**:
these routes are Dynamic, so the build compiles them and never renders them. Only a live request
surfaces it.

**3.2 The page could not read data from a client module.** A later fix derived the hub's section
headings from `developerHubNavSections`, which lives in a `"use client"` module. Next replaces such
an export with a client-reference proxy, so `.flatMap` did not exist and the build failed with
_"Failed to collect configuration"_. Lint, typecheck and 7,583 tests all passed. This one **only**
`npm run build` catches.

Both are captured in the `/issues` inbox as a P2 request: no gate in this repo can see either class.

## 4. Rulings made on the owner's behalf

Recorded so they can be reviewed and undone. Prefixes: **S** setup, **P** pre-flight/plan defect,
**W** warning adjudication, **F** finding/fix.

| #   | Ruling                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Work continued on a **new branch** cut at the old tip, because the old branch was checked out in a worktree this session could not remove. All 11 prior commits are ancestors.           |
| S2  | Worktree placed on `D:/Worktrees`, not `.claude/worktrees`, which has been wiped repeatedly.                                                                                             |
| S3  | Implementers run **filtered** tests (a shared lease); the controller runs the exclusive full suite. This is the mechanism behind the prior session's R11/R12.                            |
| P1  | Task 3's `expect(grouped.P1).not.toHaveProperty("acuity")` asserts nothing — an Array can never carry that key. Replaced with a per-item assertion that actually verifies the invariant. |
| P2  | Where a step's prose states a test count that disagrees with its own test code, the code wins.                                                                                           |
| P3  | The plan's full-suite commands replaced with filtered runs per S3.                                                                                                                       |
| P4  | The plan's redundant `afterEach(cleanup)` kept rather than deviating; the shared jsdom setup already cleans up and a second call is a no-op.                                             |
| P5  | **Task 7's code block dropped the synthetic-data warning its own prose required.** The prose won: it is a clinical-safety statement on a page linking to synthetic patient prototypes.   |
| P6  | One snapshot cell leaked a markdown escape (`\|`) into the UI. Fixed in the generator, **not** in the shared `splitCells`, which must keep the escape so `issues:reconcile` round-trips. |
| P7  | Task 8's `<ul>` became a `<div>` wrapping a `<section>`+`<ul>` per priority group: a heading between `<li>` siblings is invalid markup. Testid and order preserved.                      |
| P8  | The "Other" bucket for unrecognised priorities approved as beyond-brief but spec-correct — §7 forbids silent row-dropping.                                                               |
| P9  | Task 10 split: the implementer took documentation; the controller took the long exclusive gates.                                                                                         |
| W1  | `ledger-snapshot.ts` does **not** get `import "server-only"`: it belongs to the `data/*.json` reader family, not the auth/env family.                                                    |
| W2  | Nothing consuming `hub-panels.ts` in its own diff is not a gap; Task 7 consumes it.                                                                                                      |
| W3  | `PageSection["icon"]` compatibility confirmed by the pinned template plus a clean typecheck.                                                                                             |
| F1  | Both Task 6 Importants entered the fix loop despite being plan-mandated: the placeholder test pinned 2 of 4 wiring properties, and `EnvironmentStrip` had no test at all.                |
| F2  | Two Minors promoted into that round because they touched lines already being amended.                                                                                                    |
| F3  | **`demoMode={false}` claimed "Live data" the page never read** — the one strip value that could be actively wrong. Widened to `boolean \| null` with an "environment unknown" state.     |
| F4  | Task 7's Critical plus both Importants fixed, and one Minor promoted (an empty group would have rendered a live anchor above an empty grid).                                             |
| F5  | _Superseded._ I ruled that `npm run build` was the gate that catches §3.1. It is not — see §3. The dev-server render proof replaced it.                                                  |
| F6  | A derived assertion with no non-empty guard was closed rather than deferred: an assertion that can stop asserting is the defect class this branch caught four times.                     |
| F7  | The plan told Task 4 to import a mockup route into `src/lib`, which lint forbids. Fixed with a literal **plus a test** — tests are outside `src/**` — so drift still fails a check.      |
| F8  | The new nav header had to be registered in `isHeaderAddonSlotOwnedRoute`, not merely appended to a test list. `/mockups/development` renders in production for an administrator.         |
| F9  | One fix wave for the final review's findings, then one scoped re-review.                                                                                                                 |
| F10 | Only the **build SHA** wired into the environment strip; `isDemoMode()` and email stay Phase 2. _The reason I first gave was wrong_ — see §5.                                            |
| F11 | Deferred-minor triage accepted as the final reviewer proposed: 8 ship, 3 fixed.                                                                                                          |
| F12 | The section-label derivation reverted after it broke the build (§3.2); the label **assertion** kept, and is now the only binding between the page's headings and the nav sheet.          |

## 5. Where I was wrong

Recorded because a wrong reason in a committed comment is worse than no reason.

- **F10's stated rationale was false.** I claimed `src/lib/env.ts`'s `import "server-only"` throws
  under jsdom. It does not: `vitest.config.mts` aliases `server-only` to a stub whose entire content
  is `export {}`. The _decision_ stands on other grounds; the reason was checkable and wrong, and it
  had been copied into a source comment before it was caught.
- **F5 was superseded.** I asserted a production build would catch the handler-serialisation defect.
  It cannot — the routes are Dynamic and never render at build time.
- **Reserving lint for the controller cost nine tasks of feedback latency.** Right for throughput,
  wrong for latency: F7 would have surfaced at Task 4 instead of after Task 10.
- **A controller gate wrapper ended in `tail`**, so a failing gate reported exit 0 — the exact trap
  this plan warns every implementer about.

## 6. What is left

1. **No phone-viewport proof.** These pages have server-render and jsdom proof only. The owner chose
   desktop-first; the gap is real and stated.
2. **`issues:reconcile` regeneration has no end-to-end test.** The call is one guarded line outside
   the transaction; the first real reconcile is its exercise. Watch for `[snapshot] wrote …`.
3. **Two `/issues` records queued** in the inbox, needing `npm run issues:reconcile` after merge: the
   RSC-boundary gate gap (P2) and a settings-dialog assertion that can never run (P3).
4. **The environment strip is three-quarters unwired** — deliberate, Phase 2.
5. **Phase 2 is specced** (`docs/superpowers/specs/2026-08-22-developer-hub-phase-2-design.md`) with
   one open question that changes the shape of the phase. It has no implementation plan yet, by design.
