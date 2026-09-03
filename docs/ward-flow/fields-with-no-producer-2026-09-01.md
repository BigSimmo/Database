> ⚠️ **Committed in `b21a24f12` alongside unrelated ED-screen work**, because two writers shared
> one git index. A wholesale `git revert b21a24f12` therefore deletes this file as a side effect.
> **Revert paths, not that commit.**
>
> ⚠️ **That commit also touched four files outside Ward Builder Two's assignment** —
> `ward-flow-events.ts`, `tracker/live-tracker.tsx`, `tracker/tracker-derivations.ts` and
> `ward-management-modes.tsx`. Every edit is comment-or-string-only with no logic change (audited
> 2026-09-01). Its commit message asserts the integration chat granted the exception.
>
> **That grant is UNCONFIRMED — not granted, and not denied.** Ward Lead's session context was reset
> and it can find no record of giving it; it declined to confirm merely because confirming was the
> easier reply. So the only witness to the permission is the commit that needed it. **A commit
> message is not evidence of a grant; it is a claim by the party who required one.** Ward Lead holds
> all four files, is reading the diffs itself before the next fold, and will rule on the content —
> the outcome and the provenance are separate findings and only the second is open.
>
> Recorded this way deliberately: "granted" would be a false statement and so would "violation".

# Fifteen fields the app can never fill in honestly

**Audit date:** 2026-09-01, at `54b49663b`. **Read-only** — nothing was changed.

## Why this exists

`Admission.referralId` is documented as _"the join back to the front door"_. It joins to nothing: the
seed manufactures its values from the admission's own id by string substitution, and the one runtime
writer honestly writes `null`. The field exists, is typed, is populated, compiles, renders, and means
nothing. **No typecheck and no test can see that**, because a field nobody writes is indistinguishable
from a field nobody added.

This audit asked: **where else is that true?** It found fifteen more, ranked below by what a person
reading the screen would wrongly conclude — not by count.

**Method, for every finding:** grep the field across `src/`; grep it in `ward-flow-reducer.ts`; then
read the reducer case that constructs the owning object. The three constructors are `PULL_PATIENT`
(the only runtime `Admission`), `RAISE_REFERRAL` (the only runtime `Movement`) and `RECEIVE_REFERRAL`.

**Stated limits.** Nothing was executed, so every "no writer" claim rests on static reading. The
Playwright journeys and `tests/` were not audited for writers, and page components under
`src/app/mockups/ward-flow/**` were not checked for local state writing outside the reducer.

---

## The findings, worst first

**1. `Admission.awayAtEmergencyDepartmentSince` — `ward-admissions.ts:375`.** No event sets it and **no
event clears it**. The board renders _"At an emergency department for N hours — the bed is still
theirs"_, and the seeded ones can never be marked as returned, so their hour count grows without
bound as the demo clock advances. **A reader concludes that everyone without the badge is physically
in their bed — the exact failure this field's own comment says it was added to prevent.**

**2. `Movement.blocker` — `ward-model.ts:492`.** Written once at creation as the hardcoded string
`"Awaiting coordinator referral"` and never updated by any stage transition. The console renders it
as **"Response"** and **"Current blocker"**. **A reader concludes the patient at the top of the console
is still waiting for a coordinator, when transport is already en route — so they chase the wrong
patient.**

**3. `Movement.flaggedUrgent` — `ward-model.ts:463`.** Written as the literal `false` and nothing else;
there is no flagging event among the 39 event types. It is load-bearing: `ward-priority.ts` puts it
**above** all three urgency tiers, and the queue renders a "Flagged urgent" badge. Exactly one seeded
movement carries `true`. **The mechanism the owner asked for — patients can be marked urgent, which
outranks everything — cannot be used at all.**

**4. `BedRelease.blockedBy`, as derived — `ward-discharge-dates.ts:104`.** `Admission` has no field
recording who blocked anything, so this substitutes the role that set the _discharge date_. The board
renders _"Held up by: X — recorded by Y."_ The same pattern recurs for `confirmedBy` on a departed
admission. **A reader concludes a named role examined this bed and recorded the obstacle — a ward
finding nobody made, attributed to a job title.**

**5. `Admission.blockReason` — `ward-admissions.ts:430`.** `null` at runtime, seed only. No event sets
one and no event clears one. `BLOCK_BED_RELEASE` writes `BedRelease.blocker`, a **different record**.
**A reader concludes the transport blocking bed 4 is still outstanding after the ward has cleared it.**

**6. `Admission.dischargeConfirmedAt` / `dischargeConfirmedBy` — `ward-admissions.ts:416`, `:422`.** No
`CONFIRM_DISCHARGE` event exists. This is the **sole** route to the `"confirmed"` release stage, which
feeds the ward screen, the network map and the morning rollup. **A reader concludes the confirmed-beds
figure is a live tally of ward decisions; nothing a ward does in the session can move it.**

**7. `Admission.expectedDischargeAt` and its three companions — `ward-admissions.ts:383-392`.** No event
sets or revises a discharge date. Read in seven places. **A reader concludes the newly admitted
patients are the ones nobody has planned a discharge for — a ward-performance reading of a missing
event.**

**8. `Unit.speciallingCapacity` — `ward-model.ts:237`.** Never decremented on pull or arrival, and
`Admission` carries no `specialling` field at all, so the fact is lost the moment a patient reaches a
bed. It **gates placement** in `ward-eligibility.ts`. **A ward with one slot will accept an unbounded
number of one-to-one patients and keep reporting "1 specialling slots available".**

**9. `Admission.followUp` — `ward-admissions.ts:452`.** No runtime writer, and **no reader anywhere**.
Worse, two screens actively contradict its existence in bold: _"Whether follow-up has been arranged is
not recorded anywhere in this prototype"_ and _"There is no follow-up concept anywhere in this model —
not a field, not an event, not a vocabulary"_. The field, its vocabulary and its seed data all exist.
**Those two sentences are now false.**

**10. `Unit.blocked` — `ward-model.ts:233`.** No event takes a bed out of service or brings one back.
**A bed repaired during the shift is still shown as unusable and is silently subtracted from capacity
all night.**

**11. `Movement.arrivalMode` — `ward-model.ts:498`.** Set on three seeded movements and by nothing else.
The ED screen renders a "Police in attendance" badge. **No patient raised tonight can ever carry
one — which the field's own comment calls "a real and invisible pressure".**

**12. `LegalForm.dueAt` — `ward-model.ts:159`.** No selectable form carries one. Read in five places
that drive escalation, including breach scoring. **A reader concludes no live patient is approaching a
statutory limit, when the system simply has no due time for any of them.**

**13. `Admission.tentativeDiagnosis` — `ward-admissions.ts:344`.** Its comment says the value is _"what
a referral said on the way in"_ — but `Referral` holds no diagnosis field, and its guard explicitly
forbids one. **The stated provenance cannot exist for any value, seeded or otherwise.**

**14. `TransportJob.formRequired` — `ward-model.ts:362`.** `BOOK_TRANSPORT` sets `id`, `provider` and
`escortRequired` only. The officer screen falls back to "No transport form recorded". **A reader
concludes no transport form is required for the transfer they are about to carry out, rather than that
the system never asked.**

**15. `Unit.held` — `ward-model.ts:232`.** No runtime writer and, unlike the rest, **no reader either**:
every "Held N" on every screen comes from `unitCapacity()`'s own derivation. The hazard is on the
maintenance side — `ward-management-network.tsx:69` documents it as though it were live, **so a future
implementer editing that number will change nothing and believe they have.**

---

## What was checked and cleared

Kept because a short report is otherwise indistinguishable from a shallow one.

Genuinely live, with real writers and readers: `Admission`'s `id`, `unitId`, `sex`, `state`,
`pulledAt`, `arrivedAt`, `leftAt`, `leavingDestination`; every `Patient` field; every `Referral` field
written by `RECEIVE_REFERRAL`; `Referral.localBedSought`; all five `ReferralAddressing` decision
fields; the ward-arm, ED-arm and community-arm `ReferralDestination` fields; twenty-one `Movement`
fields including `stage`, `urgency`, `legalStatus`, `admissionId` and `transport`; every `TransportJob`
timestamp; all nine `BedRelease` fields; all four `LeaveBed` fields; `Unit.empty`, `allocatable` and
`sexMix`; and the static ward properties that are correctly seed-only.

**Honest seams, deliberately blank and said so on screen** — not defects: `Admission.homeRegion` (an
open owner ruling, and every consumer says "home region not recorded" in words);
`Movement.formedAt` (the status-derived form was deleted and the screen says which clock it used);
`Movement.owner`; `BedRelease.waitingOn` on derived releases (blank means "nobody looked", and the
old `"Nothing outstanding"` default was removed for exactly that reason);
`WardStatistics.averageWaitlistWaitMinutes`.

**Inert rather than misleading:** `LegalForm.kind` has no reader and says so in its own file. A
tidy-up item, not a finding.

`WardFlowEvent`'s optional `HANDOVER_READY.provider` (`ward-flow-events.ts`) is the same shape and
one step further: **no producer and no consumer.** No dispatch site sets it — the only one is the
"Mark handover ready" control in `ed/ed-screen.tsx`, which passes `type`, `role`, `now` and
`movementId` — and no test passes one; the reducer's `HANDOVER_READY` case never reads it, doing
nothing but require an existing transport job and set the stage. Applying this audit's own severity
question: **nothing computes with the field, it is not even carried**, so no screen can render a
value derived from it and no reader can conclude anything wrong from it. That is what makes it a
tidy-up rather than a finding. The provider a booking actually uses is chosen on the booking control
and written by `BOOK_TRANSPORT`, the only event that creates a `TransportJob`.

It is outside the frame of the fifteen above in two ways worth stating rather than glossing: it is a
field on an **event payload**, not on a stored record, and the method above walked the three reducer
record constructors (`PULL_PATIENT`, `RAISE_REFERRAL`, `RECEIVE_REFERRAL`) rather than the event
union, so an event-payload field could not have been found by it.

**One structural observation, not a field defect:** `Admission` carries no `patientId`, so the "link
between them rather than a copy" that `ward-patients.ts` describes does not exist yet.

---

# Addendum — the calibration case is not confined to a statistic. It empties 65 screens.

**Found by Ward Verifier, verified independently by Ward Lead at `80d76c478`, 2026-09-01.**

`Admission.referralId` is finding zero of this audit — the calibration case, the field documented as
_"the join back to the front door"_ that joins to nothing. It was recorded as a statistics problem:
`referralToBedJoin` returns nought, and a paragraph on the statistics screen explains why.

**It is not a statistics problem. It is the reason every community team page in the prototype is
empty, and will stay empty however much is seeded.**

```
community-derivations.ts:124-129   admissionBelongsToTeam
  if (admission.referralId === null) return false;
  const referral = referrals.find((c) => c.id === admission.referralId);
  if (referral === undefined) return false;              ← ALWAYS taken
```

Same `find`, same two arrays as `referralToBedJoin`. **Measured rather than reasoned:** the real
referral ids are `RF-001`…`RF-009`; every seeded `referralId` is manufactured from the admission's
own id (`ward-admissions-seed.ts:227, :259, :313, :349` — `RF-${suffix}`, and
`id.replace(/^AD-/, "RF-")`). **Overlap: zero.** So the lookup cannot succeed for any admission, and
`admissionBelongsToTeam` returns `false` for every admission against every one of the 65 teams.

## Three consequences

**1. `Admission.followUp` is a field with no producer AND no reader.** It is seeded, and
`admissionBelongsToTeam` returns false before anything reads it. Finding 9 of this audit recorded
half of that; this is the other half.

**2. The community hub's empty state is unfalsifiable.** Its screen says an empty list means nobody
referred to that team has a recorded discharge to the community — currently true of all 65
unconditionally. **A test asserting a team page renders correctly when empty is the only assertion
that can pass today**, and it would pass with the whole derivation deleted.

**3. ⚠️ It changes what the RF-007 split buys.** Splitting out a community-only referral gives the
coordinator-visibility rule the fixture it needs — that still holds. **It will not populate a single
team page**, because the admissions still cannot reach it. Anyone expecting the split to make the
hub show something will read a correct split as a failed one.

## ⚠️ And two tests are now coupled, with neither saying so

The minimum fix for a populated team page is **one seeded admission whose `referralId` is the id of a
real community referral** — which is also the smallest change that makes `referralToBedJoin` return
non-zero. **So it turns the newly-rewritten nought in `ward-statistics-derivations.test.ts` red, and
the matching figure in `ward-statistics.dom.test.tsx` with it.**

That red would be **correct** — it is the front door starting to work, which those tests' own comments
now say is the good news. But a coupling nothing states is a coupling somebody trips over. **Both
tests need one sentence pointing at the other, and at this note, before either is changed.**

## RULED: fix it — owner, 2026-09-01, _"tell ward lead to fix it"_

The goal is approved. **Mechanism and timing are Ward Lead's**, sequenced against the live
implementer rather than against anyone's recommendation.

### ⚠️ The fix must NOT be the naming coincidence again

The cheap fix is to re-add referrals named `RF-RPHS-01`, `RF-SCGA-13` and so on, because those
already match the ids the admissions manufacture. **That is exactly what made nine team pages
populate on `claude/ward-builder-community-route`, and it is not a link — it is the same accidental
collision wearing a fix.**

It would restore the precise defect the `joinedCount` comment describes: pairs where the person
arrived in the bed **weeks before the referral was raised**, carrying no duration and meaning
nothing. And this time it would be believed, **because it would arrive as the repair to a known
problem.**

**A defect reintroduced as a repair is the hardest kind to find later, because everything about its
provenance says it was checked.** This sentence goes in the commit message.

**The requirement:** the `referralId` on a seeded admission must be **the id of the referral that
actually brought that person in**, with the chronology to match — raised _before_ they arrived.
Anything else re-manufactures noise in the shape of data.

### It composes with the RF-007 split — do it as one pass

The split produces a community-only referral, which is the natural thing to point a seeded admission
at. **One change, three purposes:** the coordinator-visibility rule gets the fixture it currently
lacks, a team page gets real content, and the impossible `{ward, community}` shape goes.

### ⚠️ It turns two tests red, and that is the fix working

The smallest change that populates a team page is also the smallest change that makes
`referralToBedJoin` return non-zero. So `joinedCount === 0` in `ward-statistics-derivations.test.ts`
and the matching DOM assertion in `ward-statistics.dom.test.tsx` **both go red — expected, not
breakage.**

**Put the pointer in both tests BEFORE making the change, not after.** Those tests and the community
hub are coupled and neither says so; whoever meets that red without knowing will read it as a
regression and restore the nought — undoing the fix while believing they are protecting it.

---

# ⚠️ A SEVERITY DISTINCTION THIS LIST DOES NOT MAKE, AND SHOULD

**Added 2026-09-01 after fixing finding 2, which turned out to be a different KIND of defect from the
other fourteen.**

Every finding above is ranked by _what a person reading the screen would wrongly conclude_. That
ranking assumes the defect reaches a **human reader**, who can disbelieve it, cross-check it, or
simply not look.

**`Movement.blocker` was not only read. It was COUNTED.** `operationalScore` awards ten points for an
active blocker, and because the field was stamped once at creation and never cleared, **every
movement raised at runtime carried those ten points for its entire life — arrival included.** So the
stale sentence was not merely misinforming a coordinator; it was silently distorting the order
patients appeared in.

**A wrong sentence is read by a person who can disbelieve it. A wrong score is acted on by a system
that cannot.**

**So anyone triaging the remaining twelve findings must ask a second question of each, beyond "what
would a reader conclude":**

> **Does anything COMPUTE with this field — a score, a sort, a threshold, an eligibility gate?**

Where the answer is yes, the finding outranks its position in the list above, because the defect
executes rather than merely displays. On the current list, at least these three compute:

- **`Unit.speciallingCapacity`** — gates placement in `ward-eligibility.ts`.
- **`LegalForm.dueAt`** — drives breach scoring in `ward-priority.ts` and the escalation surfaces.
- **`Admission.dischargeConfirmedAt`** — the sole route to the `"confirmed"` release stage, which
  feeds the ward screen, the network map and the morning rollup.

**Credit: Ward Builder One made this distinction after reading the fix**, and it is the correction
that stops the remaining twelve being weighed as documentation defects.
