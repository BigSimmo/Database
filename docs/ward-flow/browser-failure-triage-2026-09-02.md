# The 18 browser failures, triaged — 2026-09-02

**Run at `b42b7e922`: 56 tests RAN, 38 passed, 18 FAILED, exit 1 read directly, reporter `list`.**
Triaged at `03e237361`. ⚠️ **Which tree: only two files changed between the run and the triage and
both are under `docs/`, so both describe the same code.** That check is here because a chat was
caught today measuring a tree 136 commits behind, with perfect method, and nothing in its report
would have said so.

---

## THE RESULT: 18 STALE TESTS. ZERO REAL DEFECTS.

⚠️ **This is the conclusion that flatters us, so treat it accordingly.** The triage flagged its own
result as unusual and showed its work: **for every failure it found the specific commit or code
comment that changed the behaviour ON PURPOSE — an owner ruling, a named clinical-safety fix, or a
rename its own author flagged as unverified. Not merely an absence of a bug.**

**Two of the causes were then verified independently by Ward Lead, not taken:**

- **`ward-hold-*` appears in ZERO production source files; `ward-pull-*` appears in one.** The four
  failing tests still click `ward-hold-WF-003` and a button labelled "Hold a bed". **The testid they
  reach for does not exist.**
- **Commit `6960464c6` says so itself, in its own message:** _"RECOVERED, NOT FULLY VERIFIED …
  the full test suite has NOT been run on this commit."_ **The author wrote down the exact risk that
  then materialised.** Nobody ran the suite, and four browser journeys have been red since.

---

## THE SIX CAUSES

| Cause                                                   | Failures | What changed, and when                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Eligibility gate count grew**                         | **5**    | The movement path now checks `forensic` and `sex_designation`. Tests hardcode `toHaveCount(8)`. ⚠️ **That growth closed a real clinical defect — a female patient was being shown as eligible for a male-only bed.** The tests are red _because the software got safer._ |
| **Incomplete `hold`→`pull` rename**                     | **4**    | `6960464c6`, self-flagged as unverified. Stale testids and one stale title regex.                                                                                                                                                                                        |
| **Override reason box became a fixed list**             | **2**    | Owner decision OD-3 removed free text. Two `.fill()` calls survive against what is now a `<select>`. ⚠️ **Predicted by Ward Verifier before this triage ran, including which line each would fail on, from a comment nine lines away recording a partial migration.**    |
| **Morning toggle and guided tour deliberately removed** | **2**    | WB-DB-11, an owner decision, plus a second dated instruction. The feature is gone; the tests still drive it.                                                                                                                                                             |
| **The referral intake's "suburb" question**             | **2**    | Required since CM-4 (2026-08-30) and never wired into the shared test helper. ⚠️ **The third time this exact helper has been missed — its own comments already record two earlier instances.**                                                                           |
| **Two standalone rule changes**                         | **2**    | The urgent-flag ordering rule, and a new "transport must be booked" precondition on handover. Both deliberate, both dated.                                                                                                                                               |

**Lowest-confidence call, named by the triage itself:** the live-tracker count at
`ui-ward-roles.spec.ts:246`. It inferred fixture drift from a source comment that itself carries two
stale numbers. **Settled by one run, not by more reading.**

---

## ⚠️ WHAT THIS ACTUALLY MEANS, WHICH IS NOT "NOTHING IS WRONG"

**Nothing on any screen is showing a clinician wrong information.** That is the clinical answer and
it is the important one.

**But the browser suite has been red for days and nobody knew, because nobody ran it.** Eighteen
journeys cannot catch a regression while they are failing for other reasons. **The safety net over
the only surface that tests what a duty doctor actually sees has been down, and its being down is
invisible to every other gate we run** — typecheck, the 2,289-test unit suite, and every static gate
were all green throughout.

⚠️ **And the causes are almost all the same shape: a deliberate, correct, well-documented change
whose test did not travel with it.** Five separate decisions, each individually right, each leaving a
red behind. **The failure is not in any one change. It is that nothing ran the browser suite after
any of them.**

**The work: update eighteen tests to the behaviour their own code comments already describe. None of
it is a product decision. All of it is owed before the suite can protect anything again.**

---

## ⚠️ RE-RUN AT `342a81bc0` — THE VERDICTS HOLD, AND THIS PARAGRAPH EXISTS BECAUSE THEY MIGHT NOT HAVE

**Ward Verifier asked whether the tree had moved under the triage. It had.** Between the triage at
`03e237361` and master, **five source and test files changed — including `shortlist-panel.tsx`
(+41/-6) and `ed-screen.tsx` (+45/-6), the two components the failing tests exercise.** The verdicts
were sound about the tree they were taken on and were **not** a statement about master.

**Re-run through the repo runner at `342a81bc0`, server confirmed at the port `ensure` printed:**

```
56 RAN · 38 passed · 18 FAILED · exit 1 read directly · reporter list · 6.2m
```

**The failing set is IDENTICAL — the same eighteen tests, compared by file:line, with a control
proving the comparison can detect a planted difference.** So the triage's six causes stand at master.

⚠️ **The point is not that nothing changed. It is that nobody could have known without re-running,
and the first answer to "has the tree moved" was true when given and false forty minutes later.**
A tree check has a shelf life measured in folds.
