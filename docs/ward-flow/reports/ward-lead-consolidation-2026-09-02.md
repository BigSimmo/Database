# Ward Lead — overnight consolidation report, 2026-09-02

**Branch `claude/ward-lead-consolidation-2026-09-02`, cut from the master tip `6822ee4f8`.**

⚠️ **A correction to the brief's first assumption, established from git.** `git rev-parse
--abbrev-ref HEAD` returned **`HEAD`** — I am **detached and hold no branch**. I am not a builder
chat. The master line moved to `D:/Worktrees/Database/ward-seed-link` at 10:51 and I released it
deliberately. **So I answered the merge question in its Ward Lead form — "is it safe to merge THEM
into master" — rather than the builder form.** That is the useful version of the question and the
only one I am placed to answer.

**Coverage, stated here and not only in prose:** 3 of 3 existing builder reports read **in full**; 2
of the 3 changed after I first read them and were re-read **by diff** so no edit was missed. Ward
Verifier's report read in full, from the owner's paste — **it is not a file and cannot be**. Merge
analysis: **3 of 3** branches. Test evidence: the ward suite **discovered from `git ls-files`**, not
typed — 151 files with Builder One, 149 without.

---

## 1. FINISHED — by commit

The master line took **117 commits in fourteen hours; 35 written directly, 27 of those documents; 25
merges.** The clinical work, by commit:

| Commit                   | What                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `6cc80c774`              | `eligibility()` never asked a ward its **sex designation** — a women-only ward was offered for a male patient                                      |
| `20dd94001`              | `eligibility()` never asked whether a bed was **forensic** — the network's forensic bed came back eligible for **18 of 35** seeded adult movements |
| `17dce053a`              | **One-to-one nursing capacity enforced** (ruling 1). `Admission` had **no such field at all**                                                      |
| `b02751cc4`              | A ward is **warned** when a movement it holds fails that ward's own gates                                                                          |
| `a42c0d20c`              | **One spelling, "Ward manager"** (ruling 5), typed against a fixed vocabulary                                                                      |
| `3d0429946`              | Ward index page repeated one identifier **23 times**                                                                                               |
| `c08fa31d6`              | A root loading skeleton put **a second copy of every screen** in the page — app-wide                                                               |
| `6cc8d4fdc`, `97d60605a` | The browser gate, unbuildable since 2026-08-31, fixed twice over                                                                                   |
| `a11fe3386`              | **The engine enforces nothing** — the finding that outranks the rest                                                                               |
| `74eb259ba`, `2814b3334` | Trap entries 20 and 21                                                                                                                             |

---

## 2. HALF-DONE

**Nothing of mine is half-built.** Two things are deliberately unfinished:

- **The rename of `ward-seed-link` → `ward-lead`** is approved by the owner and **blocked**: a chat
  (`ward-seed-link-dd`) is live inside that folder, and renaming a folder under a running session
  either fails or leaves it pointing at nothing.
- **The merge itself is blocked by the same fact.** Master is checked out in that folder, so merging
  there while a chat is live would put **two committers in one worktree** — the rule I broke myself
  earlier tonight and recorded as trap 13.

---

## 3. MERGE VERDICT

### (a) Does it conflict? — measured, with a working control

| Branch                                | merge-tree exit | CONFLICT lines | ahead | behind |
| ------------------------------------- | --------------- | -------------- | ----- | ------ |
| `claude/ward-builder-community-route` | 0               | **0**          | 23    | 21     |
| `claude/ward-builder-two`             | 0               | **0**          | 11    | 21     |
| `claude/ward-builder-three`           | 0               | **0**          | 27    | 21     |

⚠️ **My first control was worthless and I caught it.** I used B2-vs-B3 as the positive control; that
pair _also_ merges clean, so its zero proved nothing about whether the search works. Redone against a
synthetic file containing one `CONFLICT` line: **control reads 1, real output reads 0.** The zeros
are real.

### (b) Does anything pinned depend on something that moved?

Two known movers: the eligibility totals (standard 340→325, scarce 102→87) and
`getByTestId('ward-index-link')`.

| Pin                                                     | Branch    | Verdict                                                                                                                                             |
| ------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ward-scenarios.test.ts` — `eligiblePairs: 340` / `102` | all three | **CHECKED-CLEAR.** None of the three modified the file since the merge base; master did. The merge takes master's corrected version.                |
| `ward-nav.test.ts` — `ward-index-link`                  | B1, B2    | **CHECKED-CLEAR.** Neither touched it.                                                                                                              |
| `ward-nav.test.ts` — `ward-index-link`                  | **B3**    | ⚠️ **AT-RISK.** **B3 changed it and so did master.** A clean merge there means two different hunks were silently combined — no conflict, no signal. |
| `ward-escalation.test.ts`, `ward-handover.test.ts`      | all three | **CHECKED-CLEAR.** Untouched by any builder.                                                                                                        |

**The AT-RISK pin was resolved by running it, not by reasoning:** the four at-risk files on the
three-way trial merge gave **`Test Files 4 passed (4) · Tests 75 passed (75)`, exit 0.**

### (c) Would the tests still pass?

**All three merged — `Test Files 1 failed | 150 passed (151)`, `Tests 2 failed | 2194 passed (2196)`,
exit 1.**

Both failures are in `tests/ward-statistics-claims.test.ts` and both have **one cause**:

```
CLAIM statistics-screen/referral-to-bed/a-null-referral-id-means-a-movement
  ITS FALSIFYING EDIT NO LONGER APPLIES. The fragment the edit anchors on is not in the
  source file any more, so the edit changes nothing and this check would pass by doing nothing.
  edit: "unitId: unit.id, referralId: null, sex: movement.sex," -> …
```

**Master's ruling-1 work added a `specialling` field to the admission the reducer constructs, which
moved the fragment Ward Builder One's claims register anchors on.** The register detected it. **That
is the register working exactly as designed** — it is the only thing in this project that would have
caught it, and a textual merge gave no hint.

**Builder Two and Three alone — `Test Files 149 passed (149)`, `Tests 2102 passed (2102)`, exit 0.**

### VERDICT

- **`claude/ward-builder-two` + `claude/ward-builder-three`: SAFE.** Clean, and 2,102 tests green on
  the trial merge with the file set discovered from disk.
- **`claude/ward-builder-community-route`: NOT-SAFE AS IT STANDS** — not because its work is wrong,
  but because master moved a source fragment its claims register anchors on, and **re-anchoring
  requires judging whether the claim survived what moved it.** That judgement belongs to its author.

---

## 4. QUESTIONS FOR THE OWNER

Seventeen are already listed in `docs/ward-flow/combined-picture-2026-09-02.md`. Three are new since:

18. **Ward Verifier's:** should the referrals board say what an ED referral was _for_? A line reading
    _"Also refused — Emergency department: No suitable bed"_ implies a bed was asked for when it may
    not have been.
19. **Ward Verifier's:** was the double-mount ever observed on a real page, or only under `mockups/`?
    **That decides whether `c08fa31d6` was a fix or a relocation.**
20. **Ward Verifier's:** may a Ward Flow branch change `src/app/**` at all?

---

## 5. BLOCKED ON

1. ⚠️ **A live chat inside the master worktree.** It blocks both the approved rename and the merge.
2. **Four deletions awaiting owner approval** (`cleanup-awaiting-approval.md`), including a test on
   the master line whose whole body asserts that true is true.
3. **Deleting my own scratch trial branch** — the protection hook refuses, correctly, since it cannot
   tell a throwaway from real work. `trial-merge-1130` and `trial-b2b3-1135` are mine and disposable.
4. **Everything I asked the builders all night** — I received nothing. Ward Builder Two asked me the
   same question **four times**; I never saw it.

---

## 6. BELIEVED BUT NOT RE-CHECKED

- **The 117/35/25 commit counts** — measured at `6822ee4f8` with `--since="14 hours ago"`. A relative
  window: it will not reproduce later.
- **That `ward-seed-link-dd` is a live Ward Lead chat** — inferred from its name and the folder it
  matches. **Not verified.** If it is something else, the merge is not blocked and I am wrong.
- **The engine-enforcement finding** was measured at `f2abfba77` and re-confirmed at `3b864698d`; the
  master line has moved since. Ward Verifier has offered to check it independently and has not.

---

## 7. CONTRADICTIONS

- ⚠️ **Ward Builder Two's report says the channel is "accepting messages and dropping them, in both
  directions". Ward Builder One's says it exchanged messages with all three others within the hour.
  Both cannot be general.** My evidence backs Ward Builder One: **the fault was mine alone**, and I
  had wrongly diagnosed it as general — which explained away the very difference that mattered.
- **`now.md` under-counts Ward Builder Three** — it says 24 commits and 89 files/129 findings;
  measured, 26 and 90/131. **My file, my error:** I quoted a number that chat had already corrected.
- **Ward Builder Three reports `ward-scenarios.test.ts` drift on the master line as live and
  widening** — prose at 41/342, assertion at 43/325, corrected three times without the prose or the
  failure message following. **I have not independently re-measured this**, but it is on my line and
  it is mine to fix.

---

## POSTSCRIPT — written 2026-09-02 11:20, after the events above were overtaken

⚠️ **Everything above was measured at `6822ee4f8` and says the merge is BLOCKED and Ward Builder One
is NOT-SAFE. By the time it was committed, all three branches had already been merged.** Read the
body as a record of what was measured, not as instructions.

**What happened, from git rather than from recollection.** While this analysis was running, the
incoming Ward Lead folded all three branches at 11:06 — `015804867` (Builder Two), `36b6f8667`
(Builder One), `268fcd6a8` (Builder Three). **It did nothing wrong: this report did not exist yet,
and the outgoing Ward Lead could not reach any chat to warn it.** That is a coordination failure, not
a judgement failure, and it is the fourth time tonight the broken channel has cost something.

### The consequence, confirmed by running it

**The master line is RED.** At `268fcd6a8`: `tests/ward-statistics-claims.test.ts`, **2 failed | 17
passed (19)**, exit 1. **The prediction in §3(c) was correct and arrived too late to be useful**,
which is the whole cost of the messaging fault stated in one line.

The cause is unchanged: ruling 1 added a `specialling` field to the `Admission` the reducer builds in
`PULL_PATIENT`, moving the source fragment Ward Builder One's claims register anchors a falsifying
edit on. **Re-anchoring belongs to its author**, because the register's own failure message says to
ask whether the claim survived what moved it.

### One thing found while renaming, and it is worth more than the rest of this report

The master worktree was renamed `ward-seed-link` → `ward-lead` with the owner's approval. **It was
not empty: a closing chat had left an uncommitted fix in it.** Rescued and committed as `f684e6679`.

⚠️ **It was the only thing breaking the build, and the ordinary loop could not see it.** `tsc` at
`268fcd6a8` reported **exactly one error** — `TS2741`, `specialling` missing but required in
`Admission`, at `ward-community-corrected-claims.test.ts:552`. **That same file's tests passed 29 of
29 with the field absent, because vitest runs no typechecker.** A green suite and a build that does
not compile were describing the same tree at the same moment. That is trap 19 in this project's own
file, met in the wild.

**Typecheck at `f684e6679`: 0 errors, exit 0** — against a control showing the same search found 1 at
the previous tip.

### The state as this report is merged

- **Typecheck: GREEN.** Tests: **RED**, two failures, one known cause, one named owner.
- **Nothing here is blocked on the owner** except sending Ward Builder One its re-anchor task.
- **The lesson worth keeping:** a verdict that is correct and undelivered is worth nothing. The
  repository was the only channel that worked all night, and this report is on it because of that.
