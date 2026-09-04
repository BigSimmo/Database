# The detailed handover, assessed against the current tip — 2026-09-02

**Assessed by Ward Lead at `03e237361`.** Every verdict is either MEASURED HERE (with the evidence),
or SETTLED BY A RULING (with the ruling), or STANDS. Nothing is marked stale on the strength of it
feeling done.

**Headline: of 61 items, 24 are now closed. 6 of those closed today by measurement rather than by
decision.**

---

## CLOSED SINCE THE HANDOVER WAS WRITTEN

### By the owner's rulings this afternoon — 8 items

| Item                                                  | Verdict                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A1** engine refuses a placement?                    | **SETTLED — R1, "keep advising and let the clinician decide".** The engine stays advisory. ⚠️ Not a defect any more; a recorded design decision.                                                                                                                   |
| **A2** should the app know who is looking?            | **SETTLED — R2, "NO".** And reframed: information is scoped by SCREEN, not by VIEWER.                                                                                                                                                                              |
| **A3** sidebar naming other wards                     | **DECIDED, NOT BUILT.** R2 says it must not. Code still does at `shortlist-panel.tsx:584`.                                                                                                                                                                         |
| **A4** workspace showing the count and accepting ward | **DECIDED, NOT BUILT.** Still live at `ward-management-console.tsx:313`, `:346-354`. Reachable only via a `/mockups/**` route, which changes urgency and not the verdict.                                                                                          |
| **A5** coordinator seeing the suburb                  | **DECIDED.** ⚠️ And already absent — measured 0 hits in `coordinator/`, control 76 in `referrals/`. **The job is the GUARD, not a removal.**                                                                                                                       |
| **A8** `specialling` pre-selected                     | **SETTLED — R4, yes make it settable.**                                                                                                                                                                                                                            |
| **A9** four provenance controls                       | **SETTLED — R5, yes add a blank option.** ⚠️ And the remedy is already in the codebase: `shortlist-panel.tsx:1153` renders `<option value="">Choose a reason</option>` on a different form in the same panel. Five lines matching a sibling, not a new convention. |
| **A14** board saying what an ED referral was FOR      | **SETTLED — R3, yes**, plus status, wait time, and medically-cleared on the inbox.                                                                                                                                                                                 |
| **A16** seed cannot exercise ruling 6                 | **SETTLED — R6, yes add one.** ⚠️ An audit reported this still open because I had left the ruling in a chat window. Now recorded.                                                                                                                                  |

### By measurement today — 6 items, and these are the ones a reader would have got wrong

| Item                                                       | Verdict                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A11 / C8** two ED journeys never once passed             | ✅ **BOTH PASSED. FIRST TIME EVER.** They are `ui-ward-roles.spec.ts:471` and `:524`; the run's five failures in that file are `:69`, `:246`, `:384`, `:612`, `:756` — none is either journey. **The Playwright window the handover asks for has now been opened and this is its single clearest result.** |
| **A17** `--clinical-border-subtle` needs an invented value | ✅ **IT NEVER DID.** Nine sibling `border-top` dividers in the same file already used `var(--wb-hairline) solid var(--border)`. Withdrawn by its own author.                                                                                                                                               |
| **A22 / B8** who owns the leak test — asked eight times    | ✅ **ANSWERED.** Ward Lead accountable, Ward Builder One doing it, work landed at `5621a6704`. ⚠️ **And it found the blind spot was WIDER than "the same as line 214"** — a hospital name, a hospital code or an ED name could all have reached a ward screen. Latent, not live.                           |
| **C10** engine finding never independently verified        | ✅ **VERIFIED TODAY.** Ward Verifier traced it as a RELATION, not a presence: 84 files, 419 functions, depth 8, with a control that failed first and was caught on an `opened: 0` line. Verdict: right on the mechanism, understated in one respect, **overstated in one clause**.                         |
| **C13 / E1** the messaging isolation                       | ✅ **CAUSE FOUND — a stale session name.** The handover records it as unexplained; it is now explained. Four wrong theories died, two withdrawn by their own authors.                                                                                                                                      |
| **A26** leftover files                                     | ✅ Closed, as the handover says.                                                                                                                                                                                                                                                                           |

### Closed by the incoming Ward Lead earlier — 4 defects

**B1** `1bbe02d75` · **B2** `365ba8462` · **B3** `0b6942f55` · **B4** `ed904f8d2`. All four
mutation-proved with byte-identical restores. **B7** resolved.

---

## ⚠️ WHAT REMAINS, AND THE THREE THAT ARE WORSE THAN THE HANDOVER SAYS

### Worse than recorded

**B6 — `ward-scenarios.test.ts` drift is live and I measured all three numbers.**
Line 27 prose: _"41 open movements, 342 eligible movement/unit pairs"_. Line 115 asserts
`{ openMovements: 43, eligiblePairs: 325 }`. Line 132's failure message: _"openMovements must match
the standard night's 41 exactly"_. ⚠️ **So the failure message instructs a future reader to match 41
while the assertion beside it requires 43.** The file's own comment says re-measure rather than
adjust a number, and **the number nobody re-measured is the one inside that instruction.**

**G1 — `ledger-inbox.mjs` ignores `--dry-run` on `add`, confirmed.** `dryRun` appears four times in
the file and every one is inside the `reconcile` path (`:781`, `:801`, `:839`, `:841`). **The `add`
subcommand never reads it.** So the documented way to learn its contract still writes a live entry
containing your placeholder text.

**⚠️ NEW, not in the handover: 18 of 56 browser journeys FAIL.** 38 passed, exit 1 read directly.
Coordinator 8, ward-roles 5, morning 2, referrals 2, command view 1. **This is the largest single
thing found today and nothing else we run could see it.** At least one is a STALE TEST rather than a
defect — `ui-ward-coordinator.spec.ts:973` does `fill()` with a sentence against what is now a
`<select>` of five fixed options, because the owner removed the free-text box. **A test named "the
override path is a real, reason-gated confirmation path" is failing because the gate got STRONGER.**
Triage running.

**⚠️ NEW: the patient screen exists and its referral button navigates — but a referral raised from it
is NOT joined to the person**, because `Referral` carries no patient link. The owner described
"click a patient, press refer", which implies the referral knows who it is about. It does not.

**⚠️ NEW: `§4.11` and `§7.4` are the only two findings in the whole programme proved GENUINELY
UNGUARDED** — neither the suite nor the compiler sees them. `§4.11`: a withdrawal record can carry
the refusing wards' names in free text, and 2,063 tests plus `tsc` stay green. **Under R2 that is now
a defect, not a question.** `§7.4`: a re-export walks straight through the module-graph walker,
because `export … from` is not an import.

### Standing, unchanged

**A6** cross-page inference across 65 community team pages — ⚠️ **R2 does NOT settle it**, those are
not ward screens. **A7** shortlist gate reading `allocatable` alone — measured impact today zero.
**A10** can an ED ever accept. **A12** the fourth spelling, pinned by a search test.
**A13** the past-tense discharge wording. **A15** the uncapped list. **A18/C4** the 53 lost findings.
**A19/A20** triage worth and counting convention. **A21** the register's missing figure.
**A23/A24/A25** the `loading.tsx` move — ⚠️ **and A24 has already happened without a ruling**:
`c08fa31d6` changed `src/app/**` on this branch, leaving five production routes with no loading
skeleton and nothing re-checking since. **A27** nine scratch branches, none checked out.
**B5** = `§7.4`, now CONFIRMED by mutation rather than a lead.

### Confidence items — the section the handover says to read first, and it is right

**C1, C2, C3, C5, C6, C7, C9, C11, C12** all stand. The single number that governs how any of it
should be used:

⚠️ **SEVEN findings network-wide have had a mutation run, out of roughly 180. Three of the seven were
mis-attributed. Every published hit-rate has been withdrawn by three separate chats.** Allocating
against the list is allocating against a number that is about 96% reasoning.

⚠️ **And one correction to the handover's own C-section framing.** Ward Builder Three's axis was
wrong and it corrected it: ordinary edits `vitest` catches (101 of 103); type-change edits `tsc`
catches — **guarded by the compiler, not a defect**; and the real defects are the ones NEITHER sees.
**Pairing `tsc` with `vitest` is necessary and not sufficient.**

### Environment — all six stand, and D6 bit twice more today

**D6** is the one to keep: `--reporter=basic` dies at startup, runs nothing, reports no failures.
⚠️ **Ward Builder Three typed it again within an hour of writing the warning, and was saved by
demanding a RAN count rather than reading an exit code. Knowing a trap does not defend against it; a
check that surfaces it anyway does.** ⚠️ **And Ward Lead produced the same species: a failure grep
matching `failed` and `✘` against a reporter writing bare `x` returned zero against eighteen real
failures, and that zero was published to the owner twice.**

**D3** — a fourth false positive found today: the hook refuses `.entry21.tmp` at the repo root.
