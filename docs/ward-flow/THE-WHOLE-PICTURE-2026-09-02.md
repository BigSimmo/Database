# WARD FLOW — THE WHOLE PICTURE, 2026-09-02

**Assembled by Ward Lead at `86a24f2f2` from all five chats, once the message channel was repaired.**

Every figure is attributed. **VERIFIED-BY-ME** means Ward Lead ran it. **ACCEPTED FROM** names the
chat that measured it and records that Ward Lead did **not** re-measure. Nothing appears without one
of those two labels, because the most expensive habit of the last twenty-four hours was a true number
arriving with its attribution stripped off.

Shape adopted from Ward Builder Three's handover; the five-heading discipline is Ward Builder Two's.
Both are credited because both are better than what Ward Lead was using.

---

## 1. IS THE BUILD GREEN? — yes, and here is exactly what that does and does not cover

**VERIFIED-BY-ME at `efc2d33dd`, re-confirmed at `7c8b8c26c`:**

```
ward suite + the three repository gates   154 files passed, 2,286 tests passed, exit 0
tsc -p tsconfig.typecheck.json --noEmit   exit 0, 6,089 files, a fresh pass not a reused receipt
the three formerly-red gates alone        3 files passed, 90 tests passed, exit 0
```

The 151-file ward set was **discovered from disk, not named by hand**, and a silent zero is refused —
a control confirms the runner reports an empty selection as a failure rather than a pass.

**Independently confirmed by two chats, and the way each did it matters.** Ward Builder Two was 130
commits behind and recognised that running there would produce a false red, so it trial-merged onto a
scratch branch and got `3 passed / 90 passed / exit 0`, then verified all three fix commits touch the
named files and are ancestors of master, with a fabricated sha as the control. Ward Builder One,
49 behind, first reported two of them **still red** — and its own account of how is more useful than
the error: it counted _mentions of a branch name_ and reported _a test_ as failing, never running the
test. **A real measurement, correctly performed, against the wrong object — and the wrong property.**

### ⚠️ WHAT THAT DOES NOT COVER — the part a summary usually drops

- **No Playwright has run today. Not by anyone, all day.** Six `tests/ui-ward-*.spec.ts` journeys are
  unproven, including two ED journeys repaired at `ed701752d` and **never once run since the repair**.
  A coordinator-facing regression in any of them is invisible to everything above.
- **Nobody has opened the rendered board.** The CSS repair is proved to make tokens resolve. It is
  **not** proved to look right. Ward Builder One is opening it now, under instruction to change
  nothing and report.
- **A type-only requirement is invisible to the suite.** Proved today: delete a required field and
  `tsc` gives `TS2741` exit 2 while `vitest` reports 4 passed, exit 0, both ways.

### ⚠️ A CLAIM OF WARD LEAD'S THAT DIED TODAY, and it is the one to read

`tests/ui-ward-referrals.spec.ts` was recorded as red because `SEEDED_QUEUED = 2` where the board
renders 3. **The file says `const SEEDED_QUEUED = 3;` at line 144**, and `SEEDED_QUEUED_IDS` names
RF-001, RF-009 and RF-005 — three ids, matching the seed's three queued referrals exactly. On the axis
believed red, **it agrees**.

Ward Lead inherited "= 2" from a handover and repeated it three times today, twice to the owner,
without once opening the file. Falsified by Ward Verifier, then confirmed by Ward Lead reading it.

⚠️ **What is NOT established is that the spec passes** — it could be red for a testid, a timing, or
the `+1` assertion at line 355, and no Playwright has run. **Ward Verifier stated that boundary
itself rather than letting a falsification read as a clearance.** That is the house rule now: _state
what your check did not cover._

---

## 2. BUILD DEFECTS STILL PRESENT — what a clinician or coordinator actually sees

### D1 — ⚠️ THE ENGINE ENFORCES NOTHING. The largest open item in the project.

Driving the real reducer over real seeded data placed a detained, secure, involuntary adult male into
the network's forensic bed **with zero rejections at every step**. Placement appears to be enforced by
screens, not by the engine. **Any screen text implying the system prevents an unsuitable placement is
currently false.**

_ACCEPTED FROM `database-53` (the outgoing Ward Lead). Never independently verified by anyone._

⚠️ **Ward Verifier is verifying it now and has already sharpened it.** Measured at `7c8b8c26c`: the
2,721-line reducer holds exactly two textual eligibility references and only one is a call.

```
REFER_TO_UNITS       0 direct eligibility calls
ACCEPT_IN_PRINCIPLE  0
PULL_PATIENT         0
ACCEPT_REFERRAL      1   -> referralEligibility() at line 2207
CONTROL whole-file    2   so the zeros are not the pattern failing
```

⚠️ **Ward Verifier explicitly refuses to call this a verdict yet, and it is right to.** Presence is
not a code path, and the helpers those three events call have not been traced. **The honest statement
today is "no DIRECT call", not "reaches nothing".** It also caught its own near-miss: a first pass
scored `PULL_PATIENT` as 1, and the hit was a **doc comment** inside the range — reporting it would
have contradicted a true finding with a comment. The helper trace is running, and Ward Verifier has
adopted Ward Builder Two's condition for it: **validate the traversal against `ACCEPT_REFERRAL`
first, because a method that cannot surface the call already proved at line 2207 produces worthless
negatives.**

### D2 — a typo correction is filed as a fresh clinical report

`ed-screen.tsx:630`, `:848`, `shortlist-panel.tsx:257`, `:285`. The legal-status provenance reason is
pre-selected, required, with no blank option. A clinician correcting a mistyped legal status who never
touches the control records the correction as a fresh report from the treating team.

**This is an audit-trail defect, NOT a liberty defect.** Its first framing — "software choosing a
reason for a liberty decision" — was false and would have cost the owner a Mental Health Act
stop-and-check on a problem that does not exist. _ACCEPTED FROM ward-builder-two and ward-verifier;
the false framing was withdrawn by its own author._

### D3 — the board says a bed was refused that was never asked for

`ward-referrals.ts:110`: `referralDestinationLabel` receives the whole destination, `purpose` included,
and returns the kind alone. The board reads _"Also refused — Emergency department: No suitable bed"_
for a referral that never requested a bed. _ACCEPTED FROM ward-builder-two, corroborated independently
by ward-verifier, which calls the underlying rule a safety rule admitting no exception._

### D4 — `specialling` cannot be set on the ED referral form

Since ruling 1 landed it feeds a capacity **gate**, not a display, so referrals now assert "no
one-to-one nursing" that nobody stated. _ACCEPTED FROM ward-builder-two._

### D5 — the "recently answered" list is uncapped, so "recently" decays with use

_ACCEPTED FROM ward-builder-two._

### D6 — the demo seed cannot exercise ruling 6 at all, and this is now MEASURED

All ten seeded referrals carry exactly one destination, so a multi-destination referral is invisible
on the running app. **Ward Verifier confirmed this independently rather than relaying it:** ten state
declarations across ten referrals, with the count itself as the control that the parse drops none —
RF-001/005/009 queued, RF-004 declined, the rest accepted. _Originally ward-builder-two's; now
measured. The constructor for the two-armed shape already exists at
`ward-community-referral-survives.test.ts:40` and is test-local._

---

## 3. WHAT WAS CLOSED TODAY — so nobody is sent to fix it again

| What                                                                                                                                                                      | Commit                             | Evidence                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| Ten `var()` references naming six custom properties nothing declares — two 3rem tap targets on the board had lost background and border and stopped looking like controls | `1bbe02d75`                        | VERIFIED-BY-ME: 45 passed, isolating mutation reddens it, byte-identical restore       |
| Two documents sending a session onto a branch without saying whether it was live                                                                                          | `365ba8462`                        | VERIFIED-BY-ME: both branches confirmed UNMERGED against a control                     |
| An unbounded recursive delete in a test cleanup                                                                                                                           | `0b6942f55`                        | VERIFIED-BY-ME: the gate's own self-test held under the mutation                       |
| `ward-release-band-day-boundary.test.ts:34` — a cast hid 6 absent and 3 phantom fields, the pair lining up on `blocker`                                                   | `ed904f8d2`                        | VERIFIED-BY-ME, counts re-measured; the proof is `tsc`, the only thing that can see it |
| Ward Verifier's report, which existed only inside a 20MB transcript                                                                                                       | `e0cb8f0fe`, annotated `86a24f2f2` | Verbatim, 6,331 chars, extracted as JSON not by grep                                   |
| Three builder branches folded, twice, including 81 rescued files                                                                                                          | `e38adb2f8`, `556037802`           | merge-tree against a control reporting 12 conflicts                                    |
| The messaging fault                                                                                                                                                       | `7c8b8c26c`                        | A stale session name. Not permissions.                                                 |

⚠️ **Five chats independently declined the first three as "not mine", and every one of those
disclaimers was correct. They stayed open anyway.** Ward Builder One's lesson is now a rule: **an
unowned file needs an owner NAMED, not disclaimers COLLECTED.**

---

## 4. TASKS REMAINING, WITH AN OWNER AGAINST EACH

| Task                                                                                                                                                                           | Owner                                                                                               | State                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Judge the engine claim — overstated, understated, or right                                                                                                                     | **Ward Verifier**                                                                                   | in progress; no judgement until the helper trace is done                                       |
| Open the rendered board and report what is on screen                                                                                                                           | **Ward Builder One**                                                                                | in progress, change-nothing instruction                                                        |
| `tests/ward-screen-fd23-leaks.dom.test.tsx`                                                                                                                                    | **Ward Builder One** (Ward Lead accountable)                                                        | assigned, after nine asks                                                                      |
| Run the §9.9 edit with `tsc` beside `vitest` to confirm the type-change class in one run                                                                                       | **Ward Builder Three**                                                                              | offered, awaiting Ward Lead's word                                                             |
| Re-run attack 3 — permanently INCONCLUSIVE because a broken parse produced "no tests", the fork-failure shape rather than a negative. The harness at `4f602c318` can settle it | **unowned**                                                                                         | nobody has run it                                                                              |
| Fold the outstanding builder commits (all documentation)                                                                                                                       | **Ward Lead**                                                                                       | —                                                                                              |
| `npm run issues:reconcile` for the queued inbox requests                                                                                                                       | **Ward Lead**                                                                                       | separate from merging                                                                          |
| ⚠️ **Playwright over all six ward journeys**                                                                                                                                   | **Ward Lead** — the only tree at master; Ward Verifier's is 376 behind with no Playwright installed | ⚠️ **AWAITING THE OWNER IN PERSON.** A peer relayed his authorisation; a peer cannot carry it. |

---

## 5. QUESTIONS NEEDING THE OWNER — 27, and the order matters

**Full text: `docs/ward-flow/outstanding/ward-lead-2026-09-02.md`.** The two that unlock the most:

**A1 — Should the engine refuse a placement nobody explicitly overrode?** Today it refuses nothing.
⚠️ **Do not answer until Ward Verifier reports.** The premise is one chat's word and is being checked.

**A2 — Should the app have any notion of who is looking?** There is none anywhere. **Answering this
settles A3, A4, A5 and A6 at once** — the sidebar naming other wards, the workspace showing which
wards accepted, the coordinator seeing a suburb, and cross-page inference across 65 community pages.

Then, with Ward Lead's recommendation against each:

- **A5 suburb on the coordinator view** — RECOMMEND remove. Raised independently by three chats, and
  in **neither projection's type**, so no gate catches it either way.
- **A14 should the board say what an ED referral was FOR** — RECOMMEND yes. Ward Verifier's.
- **A8 `specialling` unset-able on the ED form** — RECOMMEND make it settable; it now feeds a gate.
- **A9 the four pre-selected provenance controls** — RECOMMEND add a blank option.
- **A11 two ED journeys never passed** — RECOMMEND one Playwright window covering all six.
- **A16 the seed cannot exercise ruling 6** — RECOMMEND add a multi-destination referral; the
  constructor exists and is test-local. Now measured rather than asserted.
- **A18 the DOM sweep lost 53 of 61 findings** — RECOMMEND retire and re-run rather than recover.
- **A19 are the 131 — in fact 129 — findings worth triaging** — RECOMMEND yes, but after the subset
  work, and read §6 before allocating anyone.
- **A26 / A27 deletions and scratch branches** — RECOMMEND delete, but **nothing here is deleted
  without the owner**, and that stays true.

**Two are withdrawn today and should not reach him:**

- **A22 who owns `tests/ward-screen-fd23-leaks.dom.test.tsx`** — ANSWERED. Ward Lead accountable,
  Ward Builder One doing it.
- **A17 `--clinical-border-subtle` needs an invented value** — ⚠️ **IT NEVER DID.** Nine sibling
  dividers in the same file already used `var(--wb-hairline) solid var(--border)`. Withdrawn by Ward
  Builder One: _"I asked the owner to invent a colour when the answer was nine lines away in the same
  file. I searched for a declaration and found none; I never looked at what its siblings did."_

---

## 6. HOW MUCH OF THIS IS MEASURED — read before allocating anybody

**SEVEN findings network-wide have had a mutation run. Seven, out of roughly 180.** All seven come
from one chat, three were mis-attributed, one is caveated. **Allocating against ~180 findings is
allocating against a number that is about 96% reasoning.**

⚠️ **Every hit-rate published today has been withdrawn — by three chats, in three forms.** The only
surviving formulation: _a meaningful fraction are not gaps, so triage before allocating._ **Do not
publish a rate. Do not accept one.**

### The type-change question, answered: a footnote, not a third

Ward Builder Three found its own sweep protocol ran `vitest` and never `tsc`, so any finding whose
falsifying edit is a **type** change was undecidable by the planned method — **and would have
reported clean.** Counted at `a2435bdd2`: of **103 falsifiers**, **one** is a clear type-change
falsifier and **one** undecidable without opening the source. 101 are runtime edits `vitest` decides
perfectly well.

The one that counts is §9.9 — _add a home-address field to the patient type and populate it in the
reducer without touching the allowlist_ — where **the guard is a type-level allowlist**, so a
vitest-only mutation shows green and the finding would have been filed as unguarded when the compiler
is what guards it.

⚠️ **Two caveats from its author, both weakening the number:**

1. **The population is 103, not 129.** The register carries 129 findings; **26 were never written
   down and cannot now be counted by anyone.**
2. **It is a READING of 103 falsifier descriptions, not 103 `tsc` runs.** A type-change falsifier
   phrased outside the searched vocabulary would be missed, and that miss cannot be bounded.

⚠️ ~~**A correction that reached every chat and the owner: Ward Builder Three has been saying "131"
all night. The document says 129. Its third count-from-memory error today.**~~ **WITHDRAWN — THE
CORRECTION WAS WRONG AND WARD BUILDER THREE MADE NO ERROR.**

**Both numbers are in the document and they count different populations.** Line 102: _"Numbered
findings across the fourteen reports — 129"_, over **89 files**. Line 1786: _"Numbered findings —
131"_, over **90 files**. Ward Builder Three swept its own branch, which held one file fewer than the
integration line, found the discrepancy itself, and corrected **upward**. **129 is the count over 89;
131 is the count over 90, the later and correct population.** A third figure is also true: **95**
entries are physically written down here, and line 136 says so in the document's own words.

⚠️ **So three chats were each right about a different thing, and two of us then apologised for it.**
Ward Builder Three self-diagnosed a memory error it had not made; Ward Lead amplified that to every
chat and to the owner; Ward Verifier counted instead of adjudicating and found all three figures.

⚠️ **The defect was an UNSTATED DENOMINATOR — not a wrong number and not a bad memory.** It is the
same shape as Ward Verifier's truncated type read, its three-of-six token check, and Ward Builder
One's session-scoped commit count: **every one a correct count of something nobody had named.** The
house rule extends accordingly — _state what your check did not cover_, and **for a count, name the
denominator every time.**

---

## 7. THE ERROR THAT RAN THROUGH ALL FIVE CHATS

⚠️ **`success: true` means ACCEPTED FOR DELIVERY. It has never meant read.**

Four chats sent Ward Lead nine messages, all accepted, none delivered, and counted the successes.
Ward Lead then wrote in the shared control file that receiving was **PROVED**, on the strength of the
owner pasting those same reports into its window — reading the owner's relaying as peer delivery.
**One true instance and four misread ones.** Retracted at `08baa8503`.

Ward Verifier had written the correct rule hours before anyone acted on it. Ward Builder Three said
it best: **we changed what the result meant by counting it.** The tool never lied — it reported
acceptance, accurately, and five sessions inferred readership.

**The cause was a stale session name, not permissions.** Four wrong explanations died today — the
drive letter, a permission class, an owner grant, and symmetry — two withdrawn by their own authors.

⚠️ **Ward Builder One's asymmetry, worth keeping:** the sender knows what it typed in `to:`, the
receiver knows what arrived, **and neither half is sufficient.** Only a token carried in the message
body joins them — which is what settled it after nine plain messages had not.

**And the loss it exposed was never a delivery failure.** Ward Builder Two established that Ward
Verifier's report was addressed to the PREVIOUS Ward Lead throughout. **It reached its recipient; its
recipient's session ended.** The exposure is that a chat which writes no file kept its only copy
inside somebody else's session — the direction its no-write rule does not guard.

**The rule that came out of it, and it is cheap: state what your check did NOT cover.**
