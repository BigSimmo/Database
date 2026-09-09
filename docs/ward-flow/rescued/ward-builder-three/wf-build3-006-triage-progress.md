# SDD ledger — plan: WF-BUILD3-006 (allocated by Ward Lead; no plan file, assignment text in chat)

## Adaptation, stated because this skill assumes a plan file and there is none

The "plan" is Ward Lead's allocation: triage the 126 untriaged findings in
`docs/ward-flow/wf-build3-005-ts-test-sweep.md`. Each finding is a task. **The catcher is a red
suite, not a reviewer's opinion.** Ward Lead's standing constraint: **DO NOT FIX ANYTHING IN THIS
PASS.**

## Global constraints (Ward Lead + AGENTS.md + the ownership table)

- **One mutation per assertion, not per test file** (trap 20).
- Mutate → run → restore → hash-check. **Never `git checkout --`** (unreliable here; discards
  uncommitted work in the same file and does nothing at all to an untracked one). Commit before
  mutating so restore is hash-checkable.
- **Never `git add -A`** — other chats may share this checkout.
- Read-only agents: unlimited parallel. Mutation agents: see Ruling 2.
- Verdicts: **MIS-ATTRIBUTED / GENUINELY UNGUARDED / PARTIALLY GUARDED.**
- Report each batch to Ward Lead as it lands.
- My range only: slices A and B below. Statistics/community are Builder One's; clinical surfaces are
  Builder Two's.

## Pre-flight scan

A conflict table for 126 near-identical units is one row per **shared resource** rather than per task
pair, because every task shares the same three and no task pair shares anything else.

| Shared resource                         | Task A produces        | Task B consumes        | Finding                                                                                                          |
| --------------------------------------- | ---------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| The working tree under `src/`           | a mutation applied     | a mutation applied     | ⚠️ **COLLIDES** — two concurrent mutations are indistinguishable; neither agent can tell whose edit caused a red |
| The vitest heavy lock                   | an exclusive suite run | an exclusive suite run | ⚠️ **SERIALISES** — the run coordinator makes a full vitest run exclusive, so parallel agents queue anyway       |
| The Playwright build root               | a reused build dir     | a reused build dir     | ⚠️ **FABRICATES** — a kept build root has previously made mutations invent identical failure lists               |
| `docs/…/wf-build3-005-ts-test-sweep.md` | read only              | read only              | clean                                                                                                            |
| Per-batch report files                  | one per batch          | one per batch          | clean                                                                                                            |

**Self-consistency, per task:** each task is one named production edit plus one suite run. No task
creates a file another touches; no task's tests contradict its own code. **Clean.**

## Rulings

**Ruling 1:** Adapt the skill to an allocation that has no plan file, using Ward Lead's assignment as
the task list. — Its value is the ledger, the fresh-subagent-per-unit discipline and the review loop,
none of which need a file on disk. — **If wrong:** bookkeeping overhead on work that did not need it;
nothing is lost.

**Ruling 2:** ⚠️ **MUTATION AGENTS RUN STRICTLY SERIAL, one at a time — against the instruction to
spawn many.** — Three independent reasons, any one sufficient: two agents mutating `src/` in one
checkout cannot attribute a red; the coordinator makes a full vitest run exclusive so parallel agents
queue with no speedup; and a reused build root has previously made mutations fabricate identical
failure lists. **A parallel mutation run does not go faster, it goes wrong.** — **If wrong:** the
triage takes longer in wall-clock than it needed to. This is the cheap direction to be wrong in.

**Ruling 3:** The parallelism goes into **read-only prep instead, unlimited.** — Agents identify the
exact edit and the CANDIDATE guards by static search, so each serial mutation run is a confirmation
rather than a discovery. **Prep never produces a verdict; the run does.** — **If wrong:** prep tokens
spent on findings whose mutation would have been quick anyway.

**Ruling 4:** Batch mutations by production file, not one dispatch per finding. — The skill's own
"batch small same-shape work" rule; findings touching one file share a mutate/restore cycle and one
suite run. — **If wrong:** failures within a batch are harder to attribute; mitigated by keeping one
mutation per assertion inside the batch.

**Ruling 5:** Prep agents are told to search the **DOM tests and the Playwright specs** as candidate
guards, which the original sweep read neither of. — Both of my retracted findings were caught by
tests outside the swept set. That is not a coincidence and it predicts where the remaining
mis-attributions are. — **If wrong:** wasted search breadth.

## Progress

- **Setup: complete.** Two read-only prep agents dispatched (slice A scanners/infra 14 files, slice B
  derivations/model 18 files).
- **Blocked:** all mutation work is behind the Playwright run holding the heavy lock
  (`ui-ward-roles.spec.ts -g rph-ed`), per Ruling 2's third reason.
- **Verifier returned the retraction check** (see Task 0 below).

### Task 0 — the retraction check (not mine; Ward Verifier's, recorded because it gates the rest)

**Ruling 6:** The bed-grid retraction **stands**, against Ward Verifier's challenge. — It asked
whether my original finding was about `held` or `empty`, since the guard's own precondition
(`held === 0`) makes the held category unobservable. **Checked the arithmetic rather than recalled
it:** `fsh-adult-secure` has `empty 3, allocatable 3`, so `available = min(3,3) = 3` and
`held = max(3−3,0) = 0`. My named mutation swaps the two labels, so `held` returns **3** against a
pinned **0** — **it fails.** The retraction holds. — **If wrong:** a live finding stays retracted;
mitigated by the arithmetic being reproducible in one line.

⚠️ **Verifier's observation is nonetheless a NEW and separate finding, and a new trap shape:** _a
non-vacuity guard that guarantees a different vacuity._ `expect(held).toBe(0)` is written to make the
neighbouring equality meaningful, and the same line removes the test's power to observe the held
category rendering at all. **A precondition guard and a degenerate fixture can be the same
statement**, and the guard's presence reads as rigour. Not trap 20, not vacuity as this programme has
been finding it. **Belongs in the traps file; it is Ward Lead's to add.**

### Playwright window — the two ED journeys at 9af65681f, first ever run

**Result: 2 failed.** Both had been committed UNRUN since the duplicate-mount defect blocked them.
Ward Lead predicted they would now fail for their own reasons, and they did — this is a result, not
a setback.

⚠️ **THE EXIT CODE IS MEANINGLESS AND IT WAS MY OWN DOING.** The wrapper reported
`[exited with code 0]` next to `2 failed`, because I piped the command through `tail`, so the
pipeline returned tail's status and not the suite's. **That is the gate-wrapper exit-code trap I
already hold a memory entry about, walked into in the same session.** Second run captured to a file
with `echo "REAL EXIT CODE: $?"` instead.

**Journey 2 — diagnosed, and the diagnosis vindicates the repo convention.**
`ui-ward-roles.spec.ts:552` calls `confirm.click()` on a button carrying `aria-disabled="true"`.
Playwright's actionability check treats `aria-disabled` as not-enabled and refuses, timing out at
45s with `element is not enabled` ×87.

**Ruling 7:** Fix with `click({ force: true })` rather than by weakening the assertion or switching
the button to native `disabled`. — The test's stated property is _"pressing it while unavailable must
change nothing — the handler is inert, not merely styled"_, and that property is only observable if
the click is actually dispatched. `force` skips actionability and dispatches; the button is not
natively disabled, so the inert handler runs and does nothing, which is exactly the thing under
test. **Switching to native `disabled` would make the click impossible and delete the property** —
and would also violate the repo's wiring convention, which uses `aria-disabled` precisely so the
control keeps its tab stop and its stated reason. — **If wrong:** the forced click bypasses a
real actionability problem the test should have caught; mitigated because the aria-disabled
attribute is separately asserted two lines above.

**Journey 1 — failure detail lost to the same `tail` truncation. Re-running alone to capture it.**
Each Playwright invocation rebuilds production (~117 s), so runs are backgrounded, not piped.

**Ruling 7 — UPGRADED FROM REASONING TO PRECEDENT.** Searched for an existing repo pattern rather
than trusting my own argument, and found an exact one. `tests/ui-caring-contact-mockup.spec.ts:272-281`
is the same shape byte for byte:

```
await expect(action).toHaveAttribute("aria-disabled", "true");
await action.click({ force: true });                    // forced click while unavailable
await expect(dialog).toBeVisible();                     // proves nothing happened
await expect(action).not.toHaveAttribute("aria-disabled");
await action.click();                                   // ordinary click once available
await expect(...).toBeVisible();                        // proves it worked
```

`tests/ui-ward-coordinator.spec.ts` uses `click({ force: true })` at five sites for the same reason.
**So the fix is the house pattern, not an invention, and Ruling 7 no longer rests on my argument
about what `force` does.**

### Task 1 — Ward Verifier's five attacks on my own reachability guard (unplanned; took priority)

**Four of five land. Fixed at `ed701752d`. Mutation proof per assertion:**

| Mutation                                        | Result                                                                                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stripComments` order swapped to block-first    | **2 failed** — new equality guard fires and NAMES all five damaged files                                                                                                                                   |
| `hrefsIn` reverted to the nested-backtick regex | **1 failed** — the new whole-template test                                                                                                                                                                 |
| naive `split("?")` restored                     | **2 failed** — both new href tests                                                                                                                                                                         |
| exception map emptied                           | ⚠️ **INCONCLUSIVE — "no tests" ran.** The replacement broke the file's parse, so this proves nothing. **The moved arity guard is NOT mutation-proved** and is recorded as unproven rather than as passing. |

⚠️ **Ruling 8: Ward Verifier's attack 4 is right and its proposed fix does not work. Measured, not argued.**

```
hrefs      correct order 0.7207   broken order 0.7198   discrimination 0.0009
characters correct order 0.79409  broken order 0.79384  discrimination 0.00025
```

The damage is 3,613 characters inside 14.2 million. **No aggregate ratio separates the healthy tree
from the damaged one**, and a bound tuned finely enough to try would flake. A **per-file** bound
fails in the opposite direction: legitimate comment-heavy files lose up to **93.4%** of their
characters, where the worst-damaged file loses **60.7%** — the damaged and the healthy are not
separable by any quantity.

**What is exact: only 5 files of 1,283 are order-sensitive at all.** So the guard compares the two
strip orders directly — no threshold, and it names the file. — **If wrong:** the comparison is
brittle to a new comment style that makes many files order-sensitive, in which case it fails loudly
rather than silently, which is the correct direction.

⚠️ **Ruling 9: Verifier's MECHANISM for attack 5 was wrong and the distinction changed the fix.** It
named `split("?")` as the cause of the false rejection. **Measured: braces are 2-vs-1 both before and
after the split**, so the split changes nothing — the whole cause is the extractor truncating at a
nested backtick. Fixing only what was named would have left the defect in place. **The depth-aware
split went in as a SECOND defect that only became reachable once the scanner captured whole
templates.** — **If wrong:** an unnecessary helper; harmless.

### Task 2 — triage prep returned for both slices (32 files, read-only, no verdicts)

**Slice B (derivations/model) named three CANDIDATE guards the sweep missed**, all in files the sweep
never read: an exact-array pin in a sibling unit test, a DOM test asserting literal counts through
the real search wiring, and a DOM test pinning a department count of 8. **Slice A named three more**,
including one where a Playwright spec running against a production build is the only thing standing
between a proxy change and a 404.

**This is the predicted pattern holding:** every candidate guard found so far sits in a `.dom.test.tsx`
or a `ui-*.spec.ts` — **neither of which the original sweep read.**

⚠️ **Both prep agents flagged findings back rather than guessing, which is what the briefs asked
for:** several sweep findings describe states already true on this branch rather than edits (so the
mutation framing does not apply), and two describe architectural additions rather than line edits.
**Those are defects in my sweep's write-up, not in the code**, and they are the reason a mutation
pass is worth more than a re-read.
