# WARD FLOW TASK LEDGER — 2026-09-02

**The single tracked record of who holds what. Written by Ward Lead, committed rather than kept in a
chat, because a chat's memory of an allocation is the thing this project has lost most often.**

**Every row carries a TREE.** `MEASURED AT` is the commit a claim was taken on; a claim without one
is a lead. Ward Builder Three's rule, adopted after it measured the ward board correctly on a tree
136 commits stale and was minutes from contradicting two chats with it.

⚠️ **`ahead` is what you have given. `behind` is what you are missing, and it is the one that decides
whether anything you measure is real.** Run
`git log --oneline HEAD..codex/task-ward-flow-live-state-20260831 | wc -l` before measuring anything.

---

## POSITIONS at master `27b29b164`, 14:12

| Chat               | ahead | behind                                      | Holding                                                                        |
| ------------------ | ----- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| Ward Builder One   | 0     | 3                                           | the 18 stale browser tests                                                     |
| Ward Builder Two   | 6     | 4                                           | `ward-model.ts`, `ward-flow-events.ts`, `ward-flow-reducer.ts` — **exclusive** |
| Ward Builder Three | 3     | 14                                          | nothing. **Blocked on Two releasing the reducer.**                             |
| Ward Verifier      | —     | pin 445 behind, **declared and deliberate** | reviewing the route-scan change                                                |

---

## OPEN TASKS

| #   | Task                                                                               | Owner                  | State                |
| --- | ---------------------------------------------------------------------------------- | ---------------------- | -------------------- |
| T1  | The 18 stale browser tests, six causes                                             | **Ward Builder One**   | in progress          |
| T2  | `Movement.referredAt` + three-state medical clearance + `RECORD_MEDICAL_CLEARANCE` | **Ward Builder Two**   | in progress          |
| T3  | The engine refuses an ineligible placement unless a reason is recorded             | **Ward Builder Three** | ⚠️ **blocked on T2** |
| T4  | Review the route-scan change                                                       | **Ward Verifier**      | in progress          |
| T5  | Verify T3's flip — **not by its author**                                           | **Ward Verifier**      | queued behind T3     |
| T6  | `npm run issues:reconcile` for the queued inbox requests                           | **Ward Lead**          | queued               |
| T7  | Fold, full suite, browser suite, final merge                                       | **Ward Lead**          | queued behind T1–T3  |

## OWNER DECISIONS OUTSTANDING

- ⚠️ **T3's shape, and it is genuinely clinical:** referring to four wards where one is ineligible —
  refuse the whole referral, refuse that one ward only, or permit with the override covering the
  mismatch? **Ward Lead recommends refusing the ineligible unit only.** Evidence pointing the other
  way, recorded because it is evidence and not an answer: the existing override record stores
  `unitIds: [...event.unitIds]`, the whole list, which suggests an override was designed to cover a
  referral rather than a ward.
- **Should a withdrawal record be able to name the wards that refused a patient?** `§4.11`, proven
  unguarded. Under R2 this is now a defect rather than a question, but the remedy is a design choice.

## STANDING RULES FOR EVERY CHAT

1. **Merge master before measuring anything.** Report `behind`, not `ahead`.
2. **Fan out with subagents — read-only work parallelises, edits do not.** Sonnet for extraction,
   measurement, enumeration. ⚠️ **Mutations stay serial and in the owner's own hands:** two agents
   mutating one checkout cannot attribute a red.
3. **End every subagent brief with:** _if you reach a decision this brief does not cover, stop and
   hand it back._
4. ⚠️ **Do not brief a subagent from your own summary of a file.** Ward Builder Three's descriptions
   systematically understated what they described, and a subagent inherits that with confidence.
   State the question and the file, never your reading of the file.
5. **Report the RAN count AND the discovery method.** _"153 files from disk with a refusal below
   100"_ is checkable; _"the full ward suite"_ is not. Ward Builder One's addition, and it is
   precisely how a targeted run passes for a full one.
6. **Name the reporter, or use none.** `--reporter=basic` does not exist here, dies at startup, runs
   nothing and reports no failures. It has caught three chats today, one within an hour of writing
   the warning about it.
7. **Pair `tsc` with `vitest` on every mutation.** A test-only run cannot see a type-change
   falsifier. ⚠️ **Necessary and not sufficient** — the only real defects found today were invisible
   to both.
8. **Progress reports to Ward Lead as you go, not at the end.** A finished task reported late is a
   task nobody could schedule against.
9. ⚠️ **A number that disagrees with a scan is not automatically the wrong side of the comparison.**
   Establish what the scan measures first. **A number changed to match a miscount ratifies the
   miscount** — Ward Builder One's, after catching Ward Lead doing exactly that on a reachability
   guard.
10. **Verify the fold of your own work.** Ward Lead reported a partial fold as complete today and
    that stopped the only person who would have checked. Nobody else notices a fold's absence.

---

# MASTER IS GREEN AT A STABLE HEAD — `cf9d87e1f`, 2026-09-02

**Re-proved because the previous green described `3f47a43c8`, four commits back, and included a fix
I later reverted.** ⚠️ **A green that names an old tree is not a green.**

| What                                                    | Result                                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| HEAD before and after                                   | `cf9d87e1f6f75cc4a0c84c19a2b6c0ef70b0f606` — **identical**, so no concurrent commit landed mid-run |
| Control (`vitest run tests/does-not-exist-zzz.test.ts`) | `No test files found, exiting with code 1` — **exit 1**, so the harness fails closed               |
| Discovery                                               | `find tests -maxdepth 1 -name 'ward-*.test.ts*'` → **153 files**, refusal floor 100                |
| Ran                                                     | **156 test files** (153 + 3 named contract/safety files), **2306 tests**                           |
| Passed                                                  | **156 / 156 files · 2306 / 2306 tests · exit 0**                                                   |
| Typecheck                                               | `npx tsc -p tsconfig.typecheck.json --noEmit` → no diagnostics, **exit 0**                         |
| Reporter                                                | **default** — no `--reporter` flag, and `vitest.config.mts` carries no `test.reporters` override   |

⚠️ **NOT COVERED, and stated because a green with an unstated boundary is the thing that misleads:**
Playwright browser journeys, `verify:cheap`, `verify:pr-local`, lint, every non-ward unit file, and
every provider-backed check. Nothing was edited or committed by the proof.

---

# THE OWNER RULED ON EIGHT ITEMS DIRECT TO WARD BUILDER THREE — read from git, not from the relay

**Verbatim at `git show claude/ward-builder-three:docs/ward-flow/owner-rulings-2026-09-02-batch.md`.**
Ward Builder Three flagged its own reading separately from his words throughout, which is the
correct shape and is why this could be acted on at all.

**Ward Lead's allocation of the six that were not already placed:**

| #   | Ruling                                                                                                     | Owner                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | A withdrawal is **withdrawn, not rejected** — no ward names, and the vocabulary must stop implying refusal | Ward Builder Three, blocked behind Two                                                    |
| 2   | The refuted test is turned around — refusal unless a reason is recorded                                    | **Ward Lead — and it may DIVERGE from my layout ruling, see below**                       |
| 3   | Community-team count check that **survives him changing the number**                                       | Ward Builder One — it owns the community route                                            |
| 4   | Fix the false-sentence import scan (Ward Builder One's 5.3)                                                | **Ward Builder Three** — One is loaded with the 18 stale tests, Three is blocked and idle |
| 5   | Fix both contradictory comments                                                                            | Ward Builder Three, inside the reducer change                                             |
| 6   | He opens the rendered board himself                                                                        | **Nobody.** No chat re-attempts a screenshot                                              |
| 7   | Dark mode treated as unchecked                                                                             | Ward Builder Three                                                                        |
| 8   | Compile the register of ~180 findings                                                                      | **All five chats, in parallel, one schema**                                               |

## ⚠️ ITEM 2 MAY BE A REAL DIVERGENCE, NOT A COMPATIBLE PAIR

Ward Builder Three read the owner's ruling and my file-layout ruling as compatible — _he ruled the
outcome, Ward Lead ruled the layout_. **That reading was reasonable when it was made and my own
measurement since has undermined it.**

`ward-screen.tsx` calls `eligibilityWarning` and renders it, and the comment beside the control says
in terms that the control **"still dispatches exactly as before whether or not this renders"**. The
screen shows the warning and ignores it, by design, in writing. So a test asserting _the warning is
information at the screen level_ would, once the reducer refuses, **document a screen that claims a
placement happened when it did not** — the precise defect this codebase was already bitten by.

**So the two rulings are compatible only if the surface work lands with the reducer work.** That is
now a definition-of-done line, not a follow-up. **Escalated to the owner rather than reconciled
silently** — Ward Builder Three was right to say this needed a line back to him.

## THE REGISTER — one schema, five parallel files, no chat waiting on another

⚠️ **Nobody compiles other chats' findings.** Each chat writes **its own** entries to
`docs/ward-flow/register/<chat>-findings.md` **on its own branch**; Ward Lead concatenates at fold.
That is the same one-place-per-fact rule the owner applied to the team count, and it means the
register cannot become a five-way merge conflict on one file.

**Per finding, exactly these columns:**

1. **ID** — chat prefix + number (`WB3-001`), stable, never renumbered
2. **Claim** — one sentence, what is wrong
3. **Found by** — the chat, and the person if the owner raised it
4. ⚠️ **TESTED / REASONED / OBSERVED** — _tested_ means a check was run that **would have failed if
   the claim were false**; _reasoned_ means code was read and a conclusion drawn; _observed_ means
   somebody looked at the screen. **This column is the point of the register.**
5. **Evidence** — the exact command, or `file:line`
6. **Tree** — the SHA or branch it was measured on

⚠️ **NO "is it still live" column, deliberately.** He asked for the list so he can decide what is
real; a liveness column is a triage by the back door, and it would mean re-verifying 180 findings
before he sees any of them. **The tree column carries the staleness instead** — a finding measured
four days ago says so, and he can weigh that himself.
