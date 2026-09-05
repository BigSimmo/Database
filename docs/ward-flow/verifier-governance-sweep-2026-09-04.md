# Ward Verifier — governance-paragraph sweep, 2026-09-04

**Every measurement in this document is at ref `fffda3266`.** A figure without a SHA is expired.

**Question.** Every ward screen carries a paragraph telling a clinician what this software does and
does not do. For each one: is it true of the code behind it?

**Method.** Population = the union of two anchors, because neither is complete on its own:
testid-anchored (`*-governance`) finds **24** files, claim-anchored (`not a medical device`) finds
**15**, and **10 files are in the first and not the second** while **1** (`board/ward-board.tsx`) is
in the second and not the first. Union: **45 files, of which 25 are code.** That is the denominator.

**Verdicts were pre-registered before any implementing code was opened** and sealed as commit
`47d8b4cca`. Two pre-registrations were falsified by the code, which is the point of sealing them.

---

## 🔴 THE FINDING: THE DENIALS ARE TRUE PER-SCREEN AND FALSE PRODUCT-WIDE

Three screens tell a clinician the software **"never ranks units by suitability"**
(`escalation-board:50`, `referral-board:267`, `referral-match:331`).

**Each sentence is literally true.** Measured: those three screens build their unit lists with
`referralCandidates()` (`ward-referrals.ts:330-336`), a plain `.map` with **no `.sort` at all**.

**And the product ranks by suitability anyway.** `eligibleCandidatesAmong` (`ward-derivations.ts:696`)
is a two-pass sort — eligible-first, then _"a candidate matching the movement's own security
requirement is ranked ahead of one `restrictionNotice` flags as tighter than required"_, whose own
comment says the tighter unit _"should not be the one a coordinator is steered toward first."_ It
feeds the coordinator shortlist, the flow diagram, the network view, and the decision panel in
`ward-management-modes.tsx:203`.

⚠️ **A clinician who reads three screens saying "never ranks by suitability" forms a belief about the
product, not about a board.** The product ranks by suitability on a fourth screen. **This is the
distinction the TGA/SaMD question turns on — the regulator asks about the product.**

⚠️ **And the panel doing the ranking is labelled, to screen-reader users only,
`aria-label="AI best-fit review for …"` (`ward-management-modes.tsx:227`).** "best-fit review" is
honest. **"AI" is false** — this is deterministic rule-based sorting, no model, no inference. It is
heard by nobody reviewing the screen visually, which is how it survived.

### 🔴 AND THE SAME FUNCTION TELLS THE OPPOSITE LIE ONE SCREEN OVER

Found by Ward Builder One, verified here independently at `fffda3266`.

`ward-management-modes.tsx:395` renders a table column headed **"Top candidate"**, one row per
patient, filled at `:400` by `eligibleCandidatesAmong(patient, units, now, 1)[0]`.

**At `limit = 1` the suitability ranking never runs.** `eligibleCandidatesAmong` applies
`.slice(0, limit)` **before** its restrictiveness reorder (`ward-derivations.ts:707-716`), and
sorting a one-element array is a no-op. The only surviving key is eligibility, and
`Array.prototype.sort` is stable — **so the ward printed under "Top candidate" is the first
_eligible_ ward in the `units` array's own seed order.**

⚠️ **The screen is not misranking. It is printing a superlative for a comparison that did not
happen.** And this is a different class from every other finding here: the others overclaim
_restraint_ — the software promises to do less than it does. **This one overclaims _effort_.** The
word "Top" asserts that a comparison took place.

⚠️ **So one function produces two opposite false statements, and which one you get is decided by an
argument.** Elsewhere it ranks, and three banners deny it. Here it does not rank, and a column
heading asserts it. **Neither is reachable by reading the sentence; both need the call site.**

---

## THE REPEATING FAILURE: THE CODE CHANGES, THE COMMENTS CHANGE, THE SENTENCE DOES NOT

Three instances, and they are one defect in how this project changes its mind.

| #   | sentence                                                                             | what the code does                                                                               | verdict                |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------- |
| 1   | `escalation-board:48-52` "It **never ranks** a ward the patient does not fit"        | `R-2026-09-04-G` withdrew this rule; four comments were corrected, this sentence was not         | OVERCLAIMS (escalated) |
| 2   | `referral-intake:868` "records **only** the five permitted facts … plus the request" | also writes `patientId` (`:830`), added by the owner's own 2026-09-02 ruling                     | OVERCLAIMS             |
| 3   | `officer-screen:224` "shows **every** transport job not yet arrived"                 | filter is `transport !== undefined && arrivedAt === undefined && closure === undefined` (`:195`) | OVERCLAIMS             |

**In #2 every denial still holds** — all seven of that form's inputs are radio or checkbox, so there
is no text field at all and "never free text" is structurally true. **It is the word "only" that
failed**: an enumeration went stale by one field.

**In #3 the filter is right and the sentence is wrong.** A not-yet-arrived job on a closed movement
vanishes from the list with no explanation to the officer looking for it.

---

## 🔴 AND A FOURTH, WHICH IS A NUMBER RATHER THAN A PROMISE

`statistics-screen.tsx:379-382` tells a clinician, about the patients nobody has yet accepted:

> a movement can be live at only **3** wards at once, so a movement counted here has been put to at
> most that many wards out of the whole network, **and the rest have never been asked**.

**The inference is invalid and the last clause is a positive false statement.** Verified by me at
`fffda3266`: `REFER_TO_UNITS` rejects only `event.unitIds.length > PARALLEL_REFERRAL_CAP`
(`ward-flow-reducer.ts:1030`) — a **per-call** check on the array passed in, with no test of
`referredUnitIds` and no lifetime total. And `REFERRABLE_MOVEMENT_STAGES`
(`ward-flow-reducer.ts:71`) includes `destination_review`, the stage a movement sits in after its
units decline. **So a fully-declined movement may be referred to three more wards, repeatedly.**

A subagent established the other half — that the counted set ("nothing pending, at least one
decline") admits a multi-round movement, and that the same unexamined leap sits in
`statistics-derivations.ts:358-372`, one paragraph after that file's own comment saying re-referral
"is not merely unblocked, it is the ordinary next act."

⚠️ **This one is clinically material rather than presentational.** A patient who was refused by six
wards is described to the reader as having been put to three, with the other three counted among
wards that "have never been asked". **It understates how hard someone has been to place, on the
screen built to show exactly that.**

⚠️ **AND IT IS A DIFFERENT AND WORSE CLASS THAN THE OTHER THREE — Ward Builder Three's distinction,
and it is right.** The other three sentences were true when written and went stale against a change.
**This one was never true.** It infers a lifetime total from a per-call cap, and
`REFERRABLE_MOVEMENT_STAGES` including `destination_review` is what makes the bad inference
reachable rather than merely unsound. A stale enumeration is a maintenance failure; this is a false
clinical statement with a number attached, and it was false on the day it was written.

---

## AND A FIFTH, IN THE OTHER DIRECTION — AN UNDERCLAIM

`patient-search.tsx:99-102` enumerates what the box finds:

> It looks up **people** already known to this synthetic system by name or record number, and **open
> movements** by id, department, destination, stage and owner …

**It also finds referrals, and renders them as their own list, first on the page.** Verified at
`fffda3266`: `referralResults` is filtered at `:246` (`result.kind === "referral"`) and rendered at
`:264` under `data-testid="ward-patient-search-referrals"`.

⚠️ **The omitted category is the one the screen deliberately prioritises.** The file's own comment at
`:255` reads _"REFERRALS FIRST, and it is not cosmetic ordering. A referral is somebody still waiting
for a decision; a movement is somebody whose decision has been made."_

**Same mechanism as the `referral-intake` "only": an enumeration that was true when written and was
never updated when a category was added.** Found and handed to me by Ward Builder Three, verified
here independently. It is left unrepaired deliberately — the banner is marked `PLACEHOLDER WORDING
— owner has not chosen this`, and it is safety language.

⚠️ **An underclaim is safer than an overclaim and it is not harmless.** A clinician who reads that
list and believes referrals are not searchable here goes somewhere else to look for the people still
waiting for a decision.

---

⚠️ **The retirement template I wrote after D4 covers withdrawals only. That is too narrow.** It must
cover **any** change to what the software records, filters or ranks — #2 and #3 were additions, not
withdrawals, and neither would have been caught by it.

---

## ACCURATE — and two of these were pre-registered as at-risk

- **The three bed-arithmetic banners** (`discharge-board:151`, `morning-page:260`,
  `ward-management-modes:512`). **Structurally, not by convention:** `availableNow` is
  `Math.min(unit.allocatable.value, unit.empty.value)` (`ward-bed-availability.ts:166`) and reads
  neither `releases` nor `leave`; `FLAG_BED_RELEASE` and `CONFIRM_BED_RELEASE` touch neither field,
  only `RELEASE_BED` does (`ward-flow-reducer.ts:2335-2340`). **No path exists.**
- **"never assesses a patient's risk, acuity or treatment"** (`handover:61`, `patient-search:101`,
  `ward-management-modes:901`). `operationalScore` (`ward-priority.ts:110`) consumes waiting time,
  statutory deadline state and blocker state only, and is documented blind to `urgency` and
  `examination`. **This paragraph looked doubtful and the code cleared it.**
- **`add-patient:322` "links them to nothing"** — dispatches only `ADD_PATIENT` (`:293`).
  **PRE-REGISTERED AS THE ONE AT RISK, AND FALSIFIED**, because the owner ruled `patientId` onto
  referrals on 2026-09-02. The referral end carries the pointer; this form does not create it.
- **"The system never changes the human urgency tier"** — `CHANGE_URGENCY` is dispatched from exactly
  two human screens (`shortlist-panel:564`, `ed-screen:915`), each recording who and why. No
  automatic path exists.
- **`community-index:89`** one source — `S2015_CATCHMENT_ROWS`; the rival constant in `ward-teams.ts`
  is deliberately not read. **`out-of-area-board:92`** travel times are a hand-authored static table
  gated by `TRAVEL_BANDS_ARE_INVENTED = true`, never computed from coordinates.
  **`ward-management-modes:883`** police appear only as an arrival mode and a referral source; no
  `TransportJob` can represent one. **`ward-index:132`**, **`community-screen:183`**,
  **`person-screen:148`**.

---

## A SEPARATE DEFECT FOUND WHILE SWEEPING — NOT A GOVERNANCE ONE

`ward-flow-provider.tsx:134` — `const [dayZero] = useState<Date>(() => demoDayZero(new Date()));`

**`dayZero` reads the real system clock unconditionally and ignores `initialNow`**, while every other
clock read in the same file honours the pin (`:124`, `:154`, `:160`). So a pinned deterministic
render still takes today's real calendar date, and anything derived from it — the age on the person
screen, every `calendarDateOf` — moves with the wall clock inside a test that pinned time. The
comment at `:113` records this same class of bug being fixed for a different field on 2026-08-30.
**This site was missed.**

A subagent read this as making `person-screen:148` OVERCLAIMS. **I overruled that, and the downgrade
is judgement rather than measurement:** the person is invented, and an invented date of birth
measured against today does not make the sentence false to a clinician.

---

## COSMETIC, BUT ON THREE CLINICIAN-FACING SCREENS

"it never adds **a expected**" appears verbatim in `discharge-board:152`, `morning-page:261` and
`ward-management-modes:512`.

---

## WHAT IS NOT COVERED

Six of `statistics-screen.tsx`'s can/cannot-count claims were examined; **five are ACCURATE** — the
single shared `confirmedAt` that makes a preparation duration unmeasurable (`ward-model.ts:941-1000`);
the total absence of any `offer` field; the involuntary-bed criteria sitting on the destination and
never a unit; the decline vocabulary and its row count both derived from `DECLINE_REASONS` so a
removed reason cannot linger; and the negative-wait case, which is `continue`d past rather than
clamped to zero (`statistics-derivations.ts:161-203`). **The sixth is the OVERCLAIMS above.** Roughly
half a dozen further claims on that screen were not opened.

`ward-board.tsx`, `ward-screen.tsx` and `ed-screen.tsx` each carry narrower in-context claims that
this sweep did not open.

`patient-search.tsx`'s second clause — _"a movement that has already left the system (closed or
arrived) never appears here"_ — **was checked by Ward Builder Three and is ACCURATE**: `isOpen` is
`!movement.closure && movement.stage !== "arrived"` (`ward-derivations.ts:206`), covering both halves
of the parenthesis, and `searchMovements` applies `.filter(isOpen)` as its first operation
unconditionally (`:1100`). They also closed the two routes by which a second list could have leaked
past it. **The same reading found the UNDERCLAIM above** — which is the argument for checking a
completeness claim in both directions at once.

They further confirmed at screen level what I had cleared at claim level: neither `handover-page.tsx`
nor `patient-search.tsx` mentions `urgency`, `acuity`, `examination`, `risk` or `specialling`
anywhere outside the governance sentence itself, and `patient-search.tsx` contains no `.sort(` at
all. **So "never assesses risk, acuity or treatment" is now checked rather than assumed on both
screens.**

**A row's absence from this document means it was not examined, never that it was cleared.**
