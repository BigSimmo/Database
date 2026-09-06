# Ward Verifier — Ward Builder Two's decisions, checked against the code

**Subject:** `docs/ward-flow/ward-builder-two-session-record-2026-09-04.md` at `3f82671bb`.
**Code measured at `fffda3266`.** Every figure below carries that ref.

**What I can check and what I cannot.** I have no access to the owner conversation, so I cannot
verify that a decision tagged `(OWNER, 2026-09-04)` was said. **What I can check is whether each
decision is consistent with the code, with the other decisions, and with itself.** Six of the
decisions carry a direct owner quote; roughly sixteen are paraphrase under an OWNER tag. That is not
evidence against them — my own audit established that citation status is not provenance — but it is
what a later reader will have.

---

## ⛔ RETRACTED — SECTION 1 AS ORIGINALLY WRITTEN WAS WRONG, AND SECTION 2 WAS STALE

**Added after Ward Lead challenged both. I verified their correction rather than accepting it, and
they are right on both counts.**

**Section 1 claimed `escalation-board:48-52` had "fallen out of the list the owner is shown". It has
not — it is ROW ONE.** Verified by me at `bbc09d536`, opening
`docs/ward-flow/owner-decision-pending-device-copy-2026-09-04.md:24`. **There are two different
lists of three in circulation** — Ward Builder Two's §3.6, and the owner escalation — overlapping in
two members. **I read §3.6's description of the owner escalation instead of opening the owner
escalation.** That is the exact failure this whole night has been cataloguing, committed by the
person cataloguing it.

**Ward Lead has since DERIVED the list rather than asserting it** (`bbc09d536`): every rendered
denial of ranking, suggesting or allocating across `src/components/ward-management` returns exactly
three — `escalation-board:50`, `referral-board:267-268`, `referral-match:331`. **The list was
correct and uncheckable; it is now correct and checkable.** That derivation is the real improvement
and it belongs to them.

⚠️ **My criticism was still worth making and it landed on the right target by accident.** "Corrected
for the wrong MEMBER, never checked for the wrong LENGTH" was true of the owner document, which had
never had its length derived. **The conclusion I drew from it was false; the property I named was
real.** Both halves belong in the record.

**Section 2 was measured at `fffda3266`, which was roughly twenty commits stale.** Both aria-labels
were fixed at `394e6309e` and now read **"Eligibility review"**. Verified at `bbc09d536`: the only
remaining "AI" strings in the ward tree are comments explaining the change. **My own rule about
unlabelled numbers expiring bit me rather than anybody else.**

**What survives of my six: points 3, 4, 5 and 6 stand as written. Point 4 is the strongest and I
led with the weakest.**

---

## ~~1. THE DEVICE-CLAIM DECISION WAS MADE ON AN INCOMPLETE LIST~~ — RETRACTED, see above

§2.6 rec 12: _"Two of the three 'not a medical device' claims change; the third stays."_ §3.6 names
the three: `referral-board`, `referral-match`, and `NotAMedicalDeviceStatement` in
`ward-management-modes`.

**My governance sweep found six false statements of this kind. At most two are on that list.**

| finding                                                           | on the owner's list of three? |
| ----------------------------------------------------------------- | ----------------------------- |
| `referral-board` "never ranks units by suitability"               | **yes**                       |
| `referral-match` same denial                                      | **yes**                       |
| `escalation-board:48` "It **never ranks** a ward the patient…"    | **NO**                        |
| `referral-intake:868` "records **only** the five permitted facts" | **NO**                        |
| `officer-screen:224` "**every** transport job not yet arrived"    | **NO**                        |
| `statistics-screen:379` "put to **at most** three wards"          | **NO**                        |
| `patient-search:99` enumeration omits referrals (UNDERCLAIM)      | **NO**                        |
| `ward-management-modes:395` "Top candidate" over no comparison    | **NO**                        |

⚠️ **`escalation-board:48-52` is the sharpest omission.** It carries the withdrawn INSTRUCTION form
of `spec D4` verbatim — _"It never ranks a ward the patient does not fit, and it never states what
would need to change for one to work"_ — in the same paragraph as "not a medical device". **It is the
sentence most directly falsified by the owner's own withdrawal, and it is not among the three he is
being asked to rule on.**

§3.6 records that the escalated set was already corrected once because _"one of the three was the
wrong file"_. **The correction fixed a wrong member. It did not establish that three is the right
number.** Both are true at once and only the first was checked.

**The decision is sound on its own terms. Its list is incomplete, and nothing in the record says the
list was ever derived rather than collected.**

---

## ~~2. THE APP ALREADY PRESENTS ITSELF AS AI~~ — STALE, FIXED AT `394e6309e`

§2.1: _"Do not start authentication, integration or AI."_ `(OWNER, 2026-09-04)`

Measured at `fffda3266` in `ward-management-modes.tsx`:

- `:227` `aria-label="AI best-fit review for ${patient.id}"` and `:442`
  `aria-label="AI best-fit review unavailable"` — **spoken to screen-reader users.**
- `:230` a `styles.aiBadge` span carrying a `Sparkles` icon — the conventional AI marker.
- `Sparkles` also renders at `:1011`, and at `ward-management-network.tsx:496` and `:1102`.

**What sits behind it is `eligibleCandidatesAmong` — deterministic rule-based sorting, no model, no
inference.** So the interface announces a capability the owner instructed nobody to start, for
machinery that is not that capability.

⚠️ **And it is the least visible kind of claim.** The word "AI" reaches only screen-reader users; a
sighted reviewer sees a sparkles badge and reads it as decoration. **Nobody reviewing these screens
visually has ever seen the sentence.**

---

## 🔴 3. REC 8 IS APPROVED, NOT IMPLEMENTED — AND THE MODEL'S REASONING IS INVERTED

§2.6 rec 8: _"Sex versus gender identity: encode no rule, show the facts, say on screen that no
automatic rule applies."_

**Measured, three separate problems:**

**(a) A rule is encoded.** `ward-eligibility.ts:225-228`:

```ts
function sexDesignationAccepts(designation: SexDesignation, sex: Sex): boolean {
  if (designation === "Undesignated") return true;
  return designation === "Female only" ? sex === "Female" : sex === "Male";
}
```

It is a live eligibility gate (`:100`, `:268`). Whether rec 8 forbids this depends on whether it
means "no rule mapping gender identity to a bed" or "no automatic sex rule at all". **The two
readings have opposite verdicts and only the owner can settle which he meant.** I am not resolving
it; I am recording that the code does not currently satisfy the stricter reading.

**(b) Nothing on any screen says no automatic rule applies.** Rec 8 requires that sentence. Searched
every `.tsx` under `ward-management` for it: **zero.**

**(c) ⚠️ The careful decision protects the field that decides nothing.** `ward-patients.ts:85`:

> `/** Free text rather than a fixed enum, deliberately: bed allocation depends on this, and a closed
list picked without clinical input would be a second decision riding on this one's back. */`
> `sexOrGender?: string;`

**Bed allocation does not depend on it.** `sexOrGender` appears only in the seed, the type, a field
list, and one render as "Sex / gender" on the person screen. It reaches neither the reducer nor
`ward-eligibility`. **The gate uses `Movement.sex`, typed as the closed enum `Sex`.**

**So the closed list that was deliberately refused already exists — on the field that actually
decides — while the free-text field it was refused for decides nothing.** The reasoning is sound and
it is attached to the wrong field.

---

## 4. THE WAIT CLOCK: DECIDED, NOT YET IMPLEMENTED — AND ITS BLAST RADIUS IS 15 SURFACES

§2.3 settles that the headline clock starts at **arrival**, and that a community referral to an ED
does **not** start it, because _"many times it takes days for patients to arrive."_

Ward Builder Two found the mechanism (§3.2) and I confirm it: `ward-priority.ts:113` computes
`waitedMinutes = Math.max(0, now - movement.openedAt)`, and `openedAt` is set once at
`ward-flow-reducer.ts:824` when the journey is raised. **Today that coincides with arrival only
because a journey cannot yet be raised anywhere but the department the patient is already in — which
§2.2 authorises changing.**

**They explicitly flagged that they had not traced every reader of `openedAt`**, and asked for that
to be treated as the shape of the problem rather than an inventory. **The inventory is now done.**

### THE BLAST RADIUS — 15 production readers, and one of them is everywhere

**`elapsedLabel` (`ward-derivations.ts:194`) is the whole problem in one function.** Verified by me
line by line:

```ts
export function elapsedLabel(movement: Movement, now: Instant) {
  return formatElapsed(minutesUntil(now, movement.openedAt));
}
```

**It is rendered at 15 call sites across 11 files** — `priority-queue:118`,
`shortlist-panel:203`, `ed-screen:1723`, `escalation-board:98` and `:132`, `handover-page:115` and
`:241`, `officer-screen:300`, `patient-search:409`, `ward-management-modes:256`, `:409`, `:691`,
`ward-management-network:856`, `:1127`, `ward-screen:1521`. **It is the widest-reach duration label
in the application, and every one of those numbers silently becomes a different quantity.**

Fourteen further production readers, all clinician-visible, all of which change meaning:

- **ED access-target badges** — `ed-home-derivations.ts:88` (`longestWaitMinutes`,
  `pastAccessTarget`, `detainedAndPastAccessTarget`) and `ed-screen.tsx:1677`
  (`minutesInDepartment`, and the over/under access-target badge).
- ⚠️ **The legal clock** — `ed-screen.tsx:613` `isCommunityFormed` is
  `movement.formedAt !== undefined && movement.formedAt < movement.openedAt`, and `:621` falls back
  to `openedAt` as the legal-clock reference. **A referral-time `openedAt` days before `formedAt`
  would misclassify a hospital-formed patient as community-formed and switch the rendered legal-clock
  label.** This is the one to watch: it is a statutory surface, and the defect flips a category
  rather than inflating a number.
- **The handover "longest waits" table sort key** — `ward-derivations.ts:955`.
- **Two audit timelines** labelled "Movement opened" — `ward-derivations.ts:1192`,
  `ward-management-console.tsx:740`.
- **Statistics** — `acceptanceDurationMinutes` (`ward-derivations.ts:1333`) feeding
  `medianMinutesToAcceptance`.
- **Console figures** — `ward-management-console.tsx:151`, `:667` ("How long this movement ran"),
  `:1135` ("Opened …").
- **ED pressure cards** — `ward-pressure.ts:41`.
- **The coordinator queue** — `ward-priority.ts:113`. ⚠️ **Split verdict:** the wait score is capped
  at 40 points past ten hours, so a multi-day referral time may not move the _ranking_ once already
  capped — **but the rendered detail text would read "6 days since the placement request"**, which
  mislabels a referral as a placement request.
- **Not affected:** `ward-reanchor.ts:71` shifts every instant uniformly and never interprets what
  `openedAt` means.

⚠️ **AND NO TEST WOULD CATCH ANY OF IT.** `tests/ward-movement-stage-changes.test.ts:379-424` pins
that the creation `stageChange.at` equals `movement.openedAt` — **internal self-consistency, which
stays true under the redefinition.** The remaining ~80 test occurrences operate on synthetic numbers,
not on what the instant means. **The redefinition is invisible to the entire suite.**

**Their own framing is right and should be kept: the fix is a separate arrival instant, never a
reinterpretation of `openedAt`.** The model already agrees — `referredAt`'s own comment says a row
without one "says so rather than falling back to `openedAt`", because _"substituting arrival time
under a 'referred' label answers a different question while reading as plausible."_ **That comment
forbids, in advance, exactly the substitution this change would create in reverse.**

---

## 5. "NO INVENTED THRESHOLD" MEETS A SCORE MADE ENTIRELY OF INVENTED THRESHOLDS

§2.4: Delays is _"sorted by total wait, longest first — except an expiring legal authority, pulled to
the top. **No invented threshold.**"_

The existing queue sorts differently and on invented numbers. `ward-priority.ts` `queueOrder` keys on
`isFlaggedUrgent`, then `movement.urgency`, then `operationalScore` — and inside that score,
`:138`: `const points = state === "breached" ? 30 : state === "critical" ? 20 : state === "due" ? 10 : 0;`

⚠️ **This is not a contradiction today** — Delays does not exist. **It is a trap for the day it is
built.** Reusing `queueOrder` would put the urgency tier above total wait and import three invented
constants, breaking the decision on the first commit, with no test that would notice.

---

## 6. AN INTERNAL INCONSISTENCY IN THE RECORD ITSELF

§2.6 lists rec 8 among _"the thirteen recommendations, **all approved**"_. §5 lists **"Sex versus
gender identity in bed matching"** under _"Still open — **nobody has answered these**"_, owned by
_"a clinician with specific expertise."_

**Both are defensible if one is the interim handling and the other the substantive clinical
question — but the record does not say that**, and a later reader meets the same topic marked
"approved" in one section and "unanswered" in another.

---

## WHAT I DID NOT CHECK

The scope, direction, delay-kind, retention and standing-rule decisions in §2.1, §2.2, §2.4 and §2.5
are product statements with no current implementation to contradict. **They are unchecked, not
cleared.** `§2.5`'s "one place per value" rule looked broadly honoured for bed data — three files
match a bed-count search and two of them are a type and a consumer — but I checked that shallowly and
would not report it as verified.
