# Ward Builder Two — report, 2026-09-02

**Branch `claude/ward-builder-two`, HEAD `c60a26d03`, tree clean.** 11 ahead of
`codex/task-ward-flow-live-state-20260831`, **21 behind**. Merge-base `f2abfba77`.

---

## ⚠️ AMENDMENT — THE MERGE ALREADY HAPPENED, TEN MINUTES AFTER I DECLARED IT SAFE

**Measured at master tip `268fcd6a8`, 2026-09-02 11:2x.** Ward Verifier told me and **I re-measured
rather than taking it**: `git merge-base --is-ancestor c60a26d03 codex/task-ward-flow-live-state-20260831`
returns **true**. **I am folded.** My work landed at **`015804867`** — _"fold Ward Builder Two —
rulings 6, 7 and 8"_, 11:06. All three builders were folded in the same window (`36b6f8667` One,
`268fcd6a8` Three).

**So every position number below is history.** Current: **1 ahead** (this report file alone) /
**74 behind**. The verdict in §3 was correct and is now moot: **the fold it was assessing has already
been performed and the master line is green.** ⚠️ **The evidence in §3 stands as a record of what was
checked; the counts do not.** Ward Verifier's method note applies to me first: _state a position as a
tip SHA plus a timestamp, never as a bare count_ — mine went stale inside ten minutes.

⚠️ **I restarted mid-session and lost all memory of my own work.** Everything here is read back from
`git log` / `git show`, or measured today. Section 6 is what I could not re-derive that way.

⚠️ **`now.md` says Ward Builder Two has 8 unmerged commits. It has 11** — `5c1dc6080` landed after
that stamp, and two report commits after it.

**The full fourteen-hour history — 38 commits attributed by fold, +3,699 / −725 across 25 files, and
every error I made — is in `ward-builder-two-session-review-2026-09-02.md` beside this file. It is
not repeated here.** This report is the merge decision and the open items.

---

## 1. FINISHED — by commit

| Commit                    | One line                                                                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1e06b9304`               | A ward-facing module could import the coordinator's every-destination projection and the FD-23 import guard stayed green: `\bReferral\b` does not match `Referrals`. Both work-list exports now pinned; namespace-import evasion closed.                          |
| `b21a24f12`               | Four comments describing behaviour deleted 2026-08-31 as live — including one for a routine that invented a transport escort requirement from legal status.                                                                                                       |
| `1b86cee6e` / `13b80a07d` | An accepted community arm hid a still-queued bed request, dropping a waiting patient off the coordinator's work list. Test-first: 5 of 99 rows red before the predicate moved.                                                                                    |
| `26228864a`               | The ED raise-referral form pre-recorded **sex, legal status, cohort, security and urgency** for every referral. All five now start unanswered; submit gated with a stated reason; Enter-key bypass guarded.                                                       |
| `f95c687fe` / `22ce9f4ee` | Split a privacy fixture so an incoming reducer change cannot turn it red and block itself; retired a seeded-pair guard that a non-vacuity check proved could not fail.                                                                                            |
| `324bb502a` / `74eb259ba` | `ward-traps-numbering.test.ts` — the shared traps document's entry numbers collided twice in one night through textually-clean merges. Now mechanically guarded.                                                                                                  |
| `eab1b7c7f`               | `GATE_LABELS` held 8 of 12 eligibility gates behind a raw-name fallback, so four rendered as `sex_mix`, `prior_decline`… The union is exhaustive and **the fallback is deleted**; a new gate is now a compile error.                                              |
| `c78ffbbbe` / `8a4fb14c2` | **Owner ruling 7** — a clinician can see a referral they refused. New `edAnsweredReferralsFor` selector (a second function, not a parameter — the worklist's `queued` scoping is a stated contract) and a "Recently answered" section with its own testid prefix. |
| `41d1a80c0` / `c5f697b6b` | **Owner ruling 8** — "refused" and "cancelled because somewhere else said yes" are now worded apart, from one exhaustive state-to-label map. A fifth state would be a compile error.                                                                              |
| `663b74fb9` / `2d075bcf0` | **Owner ruling 6** — a refusal shows on the queued board the moment it is given. Table and phone card.                                                                                                                                                            |
| `e8a5bdd06`               | The whole-branch review's three accepted findings.                                                                                                                                                                                                                |
| `5c1dc6080`               | A raw addressing-state token reached a clinical heading: **"RF-006 — cancelled"**. Also removed developer prose ("no synthetic unit matches…") from a clinical screen. Found by Ward Verifier walking screens; **no gate caught either**.                         |
| `2c425fc64` / `c60a26d03` | The restart report, and two corrections to it from evidence.                                                                                                                                                                                                      |

Nine of the 38 commits in the window exist only to correct something I had previously asserted. They
are listed and named in the session-review file.

---

## 2. HALF-DONE

**WF-BUILD2-006 — mutation triage of 24 findings in my slice of Ward Builder Three's `.ts` sweep.
NOT STARTED. No mutation run.**

Preparation only, all of it in git-ignored scratch (`.superpowers/sdd/`), so **none of it survives a
clean**: the sweep copied locally, the 24 enumerated, and three read-only analyses that reached a
verdict on all 24 by reading the cited code at HEAD. Their headline results are recorded in
`c60a26d03`. **Nothing else is part-built. The tree is clean.**

### The tally, committed here because a number in a message does not survive

⚠️ **Landed at Ward Builder Three's prompting — it was right that this existed only in chat.**

```
GENUINELY UNGUARDED   15
MIS-ATTRIBUTED         5
PARTIALLY GUARDED      2
STALE-CLOSED           2   (6.1, and one half of 8.1/legal-figure)
                      ---
                        24
```

⚠️ **NONE OF THESE IS OBSERVED. Not one of the 24 has had a mutation run against it.** Every
classification is reasoned from reading the cited code at HEAD and tracing execution paths. By the
rule in §7.4 they are **leads, not verdicts**.

**A figure of "5 of 24" for my slice has been circulating in a pooled hit-rate.** Two things about it,
the second correcting my own first objection:

1. **It must not be pooled with observed triage at all.** Mine and Ward Builder Three's are
   reasoning; pooling them with observed results yields a number with no method behind it.

   ⚠️ **CORRECTED. This paragraph originally said "Ward Builder One's is the only mutation-observed
   sample in the network — ten findings."** That is wrong, and **I took the ten from a relay and
   committed it in the very commit that stated the rule against doing so.** Ward Builder One's own
   report withdraws it — I have now read that report rather than anyone's summary of it, at
   `claude/ward-builder-community-route`, second amendment: its 5-of-10 headline **already pooled its
   own observed seven with Ward Builder Three's reasoned three**, and it did not notice while
   correcting everyone else's pooling.

   **The only defensible statement, which I adopt verbatim rather than re-derive:** _one chat ran
   mutations on seven findings; three were mis-attributed, one of those with a stated caveat.
   Everything else in the network is reasoning._

   ⚠️ **No rate survives — not mine, not the aggregate, not any version.** What survives is
   Ward Builder One's reformulation, which never depended on one: **triage before allocating, because
   a meaningful fraction are not gaps.**

   **And the mechanism is the point, not the number.** I wrote _"an unchecked premise that three
   chats hold looks exactly like a corroborated one, and the corroboration is an artefact of the
   relay"_ — and then relayed a withdrawn figure one message later, in the same commit. Ward Verifier
   caught it by opening Ward Builder One's report instead of accepting my summary of it. **Writing
   the rule down does not make it hold; opening the source does.**

2. ⚠️ **I first said pooling 5/24 inverted the direction. Ward Builder Three has shown that is too
   strong and I accept the correction.** If the column holds _not-a-gap_, then 5 is the wrong cell
   either way, because PARTIALLY GUARDED and STALE-CLOSED are also not gaps. **The real defect is
   that the column was never defined**, so the same number was readable as either quantity.

   ⚠️ **This paragraph originally computed the alternative cell and gave it as a percentage. Ward
   Verifier flagged that and it is right, so the figure is gone.** It was a rate derived entirely
   from reading — **not one of the 24 has had a mutation run** — published inside the report that
   adopts _"everything else in the network is reasoning."_ Having a defined denominator this time
   made it **more citable, not more observed**, and citable is exactly what made the previous three
   rates travel. **What the block above states is what I have: 24 findings classified by reading,
   none mutation-observed, and the breakdown. A tally carrying its method cannot be quoted as a
   rate; a percentage always can.**

---

## 3. MERGE VERDICT

### (a) Does it conflict? — **NO**

```
git merge-tree --write-tree codex/task-ward-flow-live-state-20260831 HEAD
  exit 0, output = one tree oid (b022b0ba69…), CONFLICT lines: 0
behind: 21    ahead: 11
```

⚠️ **A nought needs a control, and this one has an end-to-end one:** the same command,
`HEAD` against `origin/main`, returns **exit 1 with 10 `CONFLICT` lines**. The check can report a
conflict; it did not report one here.

### (b) Does anything I pinned depend on something that moved?

Every pin in my six test files, by name:

| Pin                                                                                                                                                      | Verdict                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eligibility totals `340/325/102/87/353/342/41/43`                                                                                                        | **CHECKED-CLEAR** — zero occurrences in any of my six files. Control: the same numeric grep returns 125/47/51/230/147/38 matching lines per file, so it can find a number.                                                                                                          |
| `getByTestId('ward-index-link')`                                                                                                                         | **CHECKED-CLEAR** — zero occurrences in my six files.                                                                                                                                                                                                                               |
| `WARD_FACING.length === 3` and `SEES_EVERYTHING.length === 23` (`ward-referral-screen-boundary.test.ts:455,471`) — hand-maintained lists of source files | **CHECKED-CLEAR** — the file set under `src/components/ward-management` is **identical** between my branch and the master line, in both directions. Control: the same comparison against `origin/main` returns 54 differences. Every listed path still resolves on the master line. |
| ED clock figures `185 / 20 / 165` and `245 / 35 / 210` (seeded arrival times)                                                                            | **CHECKED-CLEAR empirically** — exercised and passing in the trial merge below.                                                                                                                                                                                                     |
| Every other pin (testids, `toHaveLength`, destination counts)                                                                                            | **CHECKED-CLEAR empirically** — same run.                                                                                                                                                                                                                                           |

### (c) Would my tests still pass? — **YES, and the typecheck matters more than the tests**

Trialled on scratch branch `trial-merge-1120`; my own branch untouched, still at `c60a26d03`.

```
git merge --no-edit codex/task-ward-flow-live-state-20260831   → clean, no conflicts
file discovery: 6 of 6 expected files present (refusal check passed)
npx vitest run <the six>       exit 0
  Test Files  6 passed (6)
       Tests  267 passed (267)
```

**Non-vacuity check on that run:** a hand count of `it(` / `test(` sites across the six files gives
**191**. 267 ≥ 191 is consistent with `.each` tables expanding, so the run did not silently execute a
subset. **RAN = 6 files.**

⚠️ **The load-bearing check is the typecheck, not the suite.** `eab1b7c7f` makes an unknown
eligibility gate a **compile error**, and vitest never typechecks — a green suite says nothing about
it. On the merged tree:

```
npx tsc -p tsconfig.typecheck.json --noEmit   exit 0, 0 lines matching "error TS"
```

Control: the grep matches a synthetic `error TS2741` line. Independently, both branches emit exactly
the same twelve gate names (`age, allocatable_bed, authorisation, capacity_freshness, cohort,
forensic, legal_status, prior_decline, security, sex_designation, sex_mix, specialling`).

⚠️ **The scratch branch `trial-merge-1120` still exists.** `git branch -D` was **denied by the
protection hook**, which pattern-matches branch deletion. **I did not bypass it.** It holds nothing
unique — it is my tip merged with the master line — but somebody with authority should remove it.

### **VERDICT: SAFE.**

Clean merge tree with a working conflict detector, every named pin cleared, and the merged tree
passes both my full suite (6 files, 267 tests) and the typecheck that my one type-enforced change
depends on.

---

## 4. QUESTIONS FOR THE OWNER

1. **The ED form still pre-selects `specialling: false`.** I fixed the five clinical fields at
   `26228864a` and deliberately left this one, because your one-to-one nursing ruling was open then.
   **It has since come back, and the reducer now enforces one-to-one nursing capacity — so by the split
   in §7.2 this default has moved from the display row into the computation-input row: it now feeds a
   capacity decision. Should it also start unanswered?** (Raised back to me by Ward Builder One; I
   have not re-read the reducer myself.)
2. ⚠️ **CORRECTED BEFORE YOU READ IT. The observation is real; my first framing of it was wrong and
   would have alarmed you for the wrong reason.**

   **What I first wrote:** that the software chooses "a reason for a liberty decision".
   **That is false**, and I have now read the code rather than the variable name.
   `LEGAL_STATUS_CHANGE_REASONS` (`ward-change-reasons.ts:15`) has exactly two members —
   `recorded_by_treating_team` and `correcting_an_error`. Neither says anything about why anyone's
   legal status changed. They record **where the data entry came from**. The list's own doc comment
   forbids exactly what I described it as doing: _"NONE of them describes a patient, a diagnosis, a
   clinical judgement or a legal requirement… one reading 'order made' would be a claim about the
   Mental Health Act. Both are forbidden."_ **Caught by Ward Verifier; verified by me at
   `ward-change-reasons.ts:1-16` before accepting.**

   **What actually survives, and it is worth fixing.** The default is `recorded_by_treating_team`,
   the field is required, and there is no unset option — so **a clinician correcting a mistyped legal
   status, who never touches that control, records the correction as a fresh report from the treating
   team. The record then says the treating team stated something they never stated.** That is the
   same shape as the five defaults above — the software asserting a fact nobody chose — but it is an
   **audit-trail** defect, not a liberty one.

   ⚠️ **And it is four sites, not the one I cited:** `ed-screen.tsx:630` and `:848`,
   `coordinator/shortlist-panel.tsx:257` and `:285`. One fix — an unset first option, the same
   treatment I gave `sex` and `legalStatus`. **Not fixed; I was told not to start new work.**

3. **Should a coordinator see a patient's suburb?** Ward Builder Three raises the same question; I
   agree the contradiction is real and that it is not an implementer's to settle.
4. **Should the referral board show what an ED referral is asking for?** Today it does not, and
   Ward Verifier argues this is structural rather than cosmetic. ⚠️ **I said I would not repeat that
   as mine until I had looked, so I have looked:** `referralDestinationLabel`
   (`ward-referrals.ts:110`) takes the whole destination — `purpose` included — and returns
   `referralDestinationKindLabel(destination.kind)`, the kind alone. So the board's refusal line
   reads _"Also refused — Emergency department: No suitable bed"_ even where no bed was requested.
   **The purpose is available at the call site and discarded.** Confirmed by my own read, not
   relayed.
5. **The demo data cannot exercise ruling 6 at all.** All ten seeded referrals go to exactly one
   destination, so "still queued, one service already refused" cannot occur on the running app. The
   behaviour is proved through the real reducer in the DOM harness, but **it is invisible on screen.**
   Add a multi-destination referral to the seed? That is a fixture decision in Ward Lead's file and I
   deliberately did not take it. ⚠️ **Ward Builder One has pointed out that the shape is already
   written**, and I verified it myself rather than relaying: `referralWithBothArmsQueued()` at
   `tests/ward-community-referral-survives.test.ts:40` builds exactly this — one community arm and one
   ward arm, both queued — and is appended in memory at line 63, so it is **test-local and does not
   contradict the hand count** (`ward-movements.ts` holds 10 `id: "RF-` entries). **If you say yes, the
   constructor exists and is already proved non-vacuous.**
6. **The "recently answered" list is uncapped**, so "recently" decays with use. **How many rows, or
   how far back?**
7. **Can an emergency department ever _accept_ a referral?** Nothing in the app produces that today,
   so one branch of the new wording has no reachable input and no test.

---

## 5. BLOCKED ON

1. **`tests/ward-screen-fd23-leaks.dom.test.tsx` is still unassigned.** I asked four times overnight
   and never got an answer. ⚠️ **I re-checked it myself just now rather than relaying:** it imports
   `ward-flow-provider`, `ward-change-reasons`, `ward-movements`, `ward-sites` and
   `ward/ward-screen` — **nothing I own**, and its only mention of my modules is a comment at line 41
   citing a ruling. Ward Builder One's by-elimination conclusion that it is Ward Lead's is therefore
   supported by evidence I have now seen for myself.
2. ~~**The merge itself.**~~ **RESOLVED BY EVENTS at `015804867`, 11:06.** I am folded. This
   blocker existed for about twenty minutes after I wrote it.
3. **Deleting the scratch branch `trial-merge-1120`** — hook-denied, not bypassed.

---

## 6. BELIEVED BUT NOT RE-CHECKED

- **The pre-restart suite figures** `Test Files 146 passed (146)` / `Tests 2073 passed (2073)`, taken
  at `5c1dc6080`'s tree. **Superseded in part:** today's trial run measured 6 files / 267 tests on the
  merged tree. The 146/2073 whole-ward figure has **not** been re-run.
- **The WF-BUILD2-006 preparation.** Only finding 6.1 was re-verified by me by reading code; the rest
  is bookkeeping. Two of my own figures in it were already found wrong (`c60a26d03`): a staleness
  count computed across divergent branches rather than along a line of history — **void** — and the
  wrong commit credited for a fix (it is `6cc80c774`, not `f2abfba77`).
- **That ruling 10 is blocked** because my projection holds zero references to `Movement` /
  `referredUnitIds`. Measured before the restart at `5c1dc6080`. **Not re-measured.**
- **The pre-selected-default sweep's coverage** (115 controls enumerated, 9 read in full, ~106
  pattern-matched, 39 uncovered by two of four idiom searches). Measured before the restart. ⚠️ **By
  Ward Lead's own rule a pattern scan is not a sweep, so those ~106 must be treated as unswept.**
- **The changed proof standard.** Two of my guards were explicitly rebuilt for it (`c5f697b6b`,
  `2d075bcf0`). **I have not audited the rest of my branch against it.**

---

## 7. CONTRADICTIONS

### 7.1 ⚠️ I withdraw the "messages are being silently dropped in both directions" claim, which I repeated in `2c425fc64`

Ward Builder One's report states it did **not** restart, that its sends returned success and were
plainly acted on, and specifically that **Ward Builder Two opened a file at its request and reported
the imports back within the hour.** I have no memory of that — I restarted — but I have **no evidence
for the dropped-channel claim either.** I repeated it because I was told it, and I stated it in a
committed report as though established. **Ward Builder One has positive evidence against it and I
have none for it, so its version wins.**

The narrower statement I can support is the one Ward Builder One makes: **Ward Lead specifically has
not replied.** That is a one-directional gap between two chats, and diagnosing it as a general failure
explains away a difference that may matter.

⚠️ **Corroborated twice more since, both with evidence about me specifically, and both arriving by the
channel in question.** Ward Builder Three: I ran a mutation it described and returned its output
(`Tests 100 passed`, `tsc` exit 2, `TS2741`) and it adopted my conclusion. Ward Verifier: its wording
verdict on `e8a5bdd06` reached me and **became `5c1dc6080`** — that commit's own message credits Ward
Verifier and implements both defects it raised. Ward Verifier adds that it relayed the general version
itself without checking it, so the correction lands on three of us. **The master line's `now.md`
already records the general claim as a previous Ward Lead's mistake: "False as stated — it was broken
for that one chat."** The withdrawal above is therefore not a concession to one peer; it is the
settled finding.

### 7.2 The pre-selected defaults are not "tidying" — for these five fields it is a safety matter

Ward Builder One §3.3 records its softened position: _"worth fixing, as tidying rather than as a
safety matter,"_ on the grounds that a wrongly-defaulted value is displayed elsewhere and so is
detectable. **That reasoning does not hold for the five ED fields I fixed at `26228864a`, and here is
the evidence:** `referralEligibility` reads `ward.sex` at `ward-eligibility.ts:247-248` for both the
`sex_designation` and `sex_mix` gates, and `requiresAuthorisedDestination(movement.legalStatus)`
drives `authorisation`. **A sex nobody chose changes which wards come back as eligible for that
patient.** The wrong value is not merely displayed somewhere — it silently changes the answer the
system gives. I agree with the softened reading for the three controls Ward Builder One examined; I
disagree that it generalises to these five.

### 7.3 Ward Builder Three's under-count of itself, confirmed against `now.md`

Ward Builder Three reports 25 commits and 90 files / 131 findings, against `now.md`'s 24 and
89 / 129. **`now.md` also under-counts me** (8 against 11). Two independent under-counts in one file
suggests the file is quoting pre-correction numbers generally, not that either chat is wrong.

### 7.4 Nothing else in either report contradicts what I hold

Ward Builder Three's suburb question, its structural-bias warning about the `.ts` sweep, and Ward
Builder One's holding-the-merge position all match my own position. **I confirm the structural bias
from my own side:** all three of my triage analyses found mitigating guards in `.dom.test.tsx` and
`ui-*.spec.ts` — file types the `.ts` sweep never opened — and two findings turned up a _second_ test
that looked like a mitigation and was defeated by the same falsifier for an independent reason.
**"A sibling test exists" is not coverage.**
