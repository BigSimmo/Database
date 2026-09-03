# Ward Builder Three — closing report, 2026-09-02

**Identity from git:** `git rev-parse --abbrev-ref HEAD` → **`claude/ward-builder-three`**.
**Measured at my HEAD `e118b7bc3`; master tip `9043e852a`; my tree is 72 behind. Working tree clean.**

---

## ⚠️ 0. ONE CORRECTION TO THE CLOSING BRIEF, MEASURED

**The brief says all four branches are folded and that `git log <master>..HEAD` printing nothing means
fully merged. It printed seven commits.**

```
git log --oneline codex/task-ward-flow-live-state-20260831..HEAD   →  7 commits
git diff --name-only <master>...HEAD                               →  ONE file:
    docs/ward-flow/reports/ward-builder-three-2026-09-02.md
```

**All five of my CODE commits ARE folded** — `ed701752d`, `22d92e318`, `cdaaa7e88`, `9af65681f`,
`6ce0af276`, each confirmed with `git merge-base --is-ancestor`. **What is unmerged is my report file
and nothing else**, written after the fold. **Nothing of mine is code and nothing needs merging for
the build.**

## 1. Since my last report — by commit

| Commit      | What                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `1feac9452` | Consolidation: merge verdict SAFE-WITH-CAVEATS, four contradictions.                                                                                                                       |
| `321b3cdd4` | The fold landed; **Ward Verifier found my own §7 bias in my own file** — two helpers keyed on one retired literal, so the cross-check written to catch a stopped pattern passes `0 === 0`. |
| `78c0fae43` | The 32% aggregate is **10 observed and 27 reasoned**.                                                                                                                                      |
| `196656e81` | I pooled a number its owner asked to be excluded, **from a stale report**.                                                                                                                 |
| `3983e0ab5` | **All 131 of my findings are observations with unconfirmed mechanisms.**                                                                                                                   |
| `538932fac` | **The "ten observed" I handed back contained my own three reasoned findings.**                                                                                                             |
| `e118b7bc3` | **My sweep never mentions casts — zero hits — in a file it read in full.**                                                                                                                 |

## 2. Uncommitted or half-done

**Working tree clean. Nothing uncommitted.**

⚠️ **BUT: `.superpowers/sdd/wf-build3-006-triage/progress.md` is git-ignored and holds EIGHT rulings
that will not survive.** Their substance, preserved here because that is the only place it persists:

1. **Mutation agents run strictly serial**, against an instruction to parallelise — two agents mutating
   one checkout cannot attribute a red; the coordinator serialises full runs anyway; and a reused
   build root has previously made mutations fabricate identical failure lists.
2. **Parallelism goes into read-only prep instead**, which never produces a verdict.
3. **Batch mutations by production file**, not one dispatch per finding.
4. **Prep agents search the DOM tests and Playwright specs** — the families the sweep never read.
5. **The bed-grid retraction stands** against Ward Verifier's challenge (`empty 3, allocatable 3` →
   `held 0`; the label swap returns 3 against a pinned 0, so it fails).
6. **Fix the ED journey with `click({ force: true })`**, not by weakening the assertion — the house
   pattern, verified against `ui-caring-contact-mockup.spec.ts:276`.
7. **Ward Verifier's attack-4 cure does not work**, measured: `0.0009` discrimination on hrefs,
   `0.00025` on characters.
8. **Verifier's attack-5 mechanism was wrong** — the braces are 2-against-1 both before and after the
   split; the cause was the extractor truncating at a nested backtick.

**WF-BUILD3-006 — 126 findings, NO mutation run for any of them.** Six candidate guards found by
static search only. **Leads, not verdicts.**

**Two ED Playwright journeys** fixed at `ed701752d` (folded) — **never once run since the fix.**

## 3. Questions for the owner

1. ⚠️ **Should a bed coordinator see a patient's suburb?** It is in **neither projection's type**, so
   **no gate can catch it either way.** Ward Builder Two asks this independently.
2. **The DOM sweep lost 53 of its 61 findings.** Ward Builder One's answer — **retire and re-run, not
   recover** — is the one I accept, but the call is yours.
3. **Are the 131 worth triaging at all**, given §4's bias?
4. **`tests/scratch_debug_elig.test.ts`** is on the master line (`b02751cc4`) and reads as scratch.
   **Meant to be there?**
5. **Two ED journeys have never passed.** Worth a Playwright window, or drop them?

## 4. Believed but NOT re-checked

- **All four mutation results on the reachability guard and both on the numbering guard** — measured at
  **`ed701752d`** and **`22d92e318`**, on a tree now 72 behind. ⚠️ **One of them was INCONCLUSIVE and
  remains so:** emptying the exception map broke the file's parse and vitest reported _"no tests"_ —
  the fork-failure shape, not a negative. **That assertion has never been proved.**
- **The stripper measurements** (`0.0009`, `0.00025`, 5 order-sensitive files of 1,283, 93.4% vs
  60.7%) — all at **`ed701752d`**.
- **The staleness figures** (4 of 90 `.ts`, 6 of 56 DOM, 5 source files) — at **`97a090ed8`**.
- **The nine-discrepancy cast count** — computed by me at **`e118b7bc3`**; three chats agree, one of
  them wrong first.
- **53 of the 61 DOM findings have no record at all**, so they cannot be re-checked by anyone.

## 5. ⚠️ THE THREE REMAINING FAILURES — ALL THREE: **NOT MINE**

**Reproduced on my tree first, at `e118b7bc3`, 72 behind:**
`Tests 3 failed | 87 passed (90 RAN)`, **real exit 1**, read directly and not after a pipe.

| Failure                                                                                                                      | Verdict                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `tests/design-token-contract.test.ts` — undeclared CSS custom properties in `board.module.css`, `ward-management.module.css` | ⚠️ **NOT MINE.** Board/shell CSS. I create no source files.                               |
| `tests/stale-resume-instructions.test.ts` — `ward-flow-coordination-rules.md`, `ward-flow-fold-manifest-2026-08-31.md`       | ⚠️ **NOT MINE.** I did not create either document.                                        |
| `tests/test-runner-safety.test.ts` — unbounded recursive delete in `tests/ward-flow-chat-control.test.ts`                    | ⚠️ **NOT MINE.** My sweep READ that file (batch 2, three findings); it did not create it. |

**I own exactly:** `production-dynamic-route-reachability.test.ts`, `ward-traps-numbering.test.ts`, my
two ED journeys inside `ui-ward-roles.spec.ts`, my two sweep documents, my two reports, and my own row
in `control/now.md`. ⚠️ **`git log --diff-filter=A` cannot settle ownership — every chat commits under
one identity.** By elimination all three sit with Ward Lead.

**If told to take one, the design-token one first:** an undeclared custom property with no fallback
**renders as nothing — a missing border or invisible text on a clinical board, with every test green.**

## 6. Evidence for this report

```
npx tsc -p tsconfig.typecheck.json --noEmit    REAL EXIT: 0, error lines: 0
npx vitest run --reporter=verbose <my 3 files>
    individual tests RAN: 73        ← counted from verbose output, not the summary
    Test Files 3 passed (3) · Tests 73 passed (73)      REAL EXIT: 0
CONTROL: npx vitest run tests/does-not-exist.test.ts
    "No test files found, exiting with code 1"          exit 1
```

**The control is what makes the 73 mean something: a silent zero is visible on this runner.** Every
exit code above was read directly, never after a pipe. **All at `e118b7bc3`, on a tree 72 behind
master — not evidence about master.**

## 7. Two corrections I am NOT carrying forward

- **`trial-merge-1130` is NOT checked out anywhere** — `git worktree list` says so. I had recorded the
  opposite from a handover. ⚠️ **I relayed a hazard's REASON without checking it, and the reason was
  the wrong part.** Seven scratch branches exist, none checked out. **Still do not sweep them while
  chats are live.**
- **The protected-delete override DOES work as a command prefix** — used to rename the master worktree
  at 11:15. I had recorded it as non-functional, from a handover. **Also not checked by me.**

**Both were things I passed on rather than measured. That is the single habit from tonight I would
most want to leave behind.**
