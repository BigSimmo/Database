# Task — the owner's four figures. THREE are buildable; ONE is not, and that is a finding.

Reconnaissance has measured all four against the model. **Read this whole brief before writing
anything: two of the four are not the figure their name suggests, and one must not be built at all.**

## ⚠️ FIGURE 2 — "empty but not offered beds". DO NOT BUILD IT. Report it.

**There is no `offered` field anywhere.** No instant, no boolean, nothing recording that a ward
offered a bed. Verified by exact grep: zero matches.

The nearest signal is `unitCapacity()`'s derived `held` (`ward-derivations.ts:320-328`):
`held = empty.value − min(allocatable.value, empty.value)` — arithmetic over **two aggregate
counts**, `Unit.empty` ("physically empty beds, per the feed", `ward-model.ts:220`) and
`Unit.allocatable` ("beds the ward says it can actually allocate", `:222`).

**The codebase already makes this rhetorical move and already concedes it in the same breath.**
`ward-board.tsx:164-165` says the on-screen claim is "this many are empty but not yet offered,
which is exactly what the data supports"; `ward-board.tsx:160-163` says "the model holds no per-bed
record". So `held` is a **ward-side readiness gap** — the ward has not yet said an empty bed is
allocatable — and not a record of any offer made or withheld to any specific movement.

**The owner calls this the most politically sensitive figure in the set.** A proxy published under
that name would be quoted outside the room it was computed in. So: **render the ABSENCE**, in the
voice this screen already uses for the three figures it withholds — name `Unit.empty` and
`Unit.allocatable`, say what `held` actually measures, and say that recording an offer needs the
model to gain a per-bed or per-offer record, which is a model change and not a change to this page.

Do NOT also render `held`. A figure beside its own disclaimer is read as the figure.

## FIGURE 1 — "referrals where every ward that was asked said no"

Buildable, **but it is not the figure its name suggests and the page must say so.**

- Asked set: `Movement.referredUnitIds: string[]` (`ward-model.ts:481`), "never longer than
  `PARALLEL_REFERRAL_CAP`" which is **3** (`:115`, enforced `ward-flow-reducer.ts:575-579`).
- Refusing set: `Movement.declines: Decline[]`, `Decline = { unitId, at, reason }` (`:267-271`).

**⚠️ THE MODEL CANNOT TELL "EXHAUSTED" FROM "BETWEEN ROUNDS".** There is no closure, exhaustion
flag or cap-reached marker on `Movement`. `case "DECLINE"` (`ward-flow-reducer.ts:826-845`) removes
the unit from `referredUnitIds`, appends to `declines`, leaves `stage: "destination_review"`, and
**nothing stops a fresh `REFER_TO_UNITS` immediately afterwards**.

`ward-derivations.ts:694-697` already computes the closest thing — `declinedByAll` as
`referredUnitIds.length === 0 && declines.length > 0` — and its own comment calls it true "about the
current instant". **Reuse that derivation; do not write a second one.** One place per fact, and it is
already the definition the handover screen uses.

**So the honest name is what it measures: movements with at least one refusal on record and nothing
currently pending.** Say on the page that this includes movements a coordinator is about to refer
onward again, that `PARALLEL_REFERRAL_CAP` is 3 so a movement declined by three wards has usually
not been offered to the other twenty, and that the model records no "nobody left to ask" state.
**Never head it "referrals nobody would take."**

`Movement.escalation` (`ward-model.ts:511`) is the nearest human judgement and is **manual and
unvalidated** — `RECORD_ESCALATION` (`:1817-1828`) checks only that the movement is not closed. It is
a recorded opinion, not a derived fact. Do not use it as a terminal marker.

## FIGURE 3 — "blocked discharges, by blocker"

**⚠️ MY EARLIER PREMISE WAS WRONG AND SO WAS THE HOLD I PUT ON THIS. There are THREE blocker fields
and `Movement.blocker` is the wrong one.**

- `Movement.blocker: string` (`ward-model.ts:492`) — **required free STRING**, whole hand-written
  sentences in the fixture. `hasActiveBlocker()` (`ward-priority.ts:73-78`) regex-matches sentinels
  like `"No blocker"` because absence has no structural expression. **Not tabulable. Not this figure.**
- **`BedRelease.blocker: BedReleaseBlocker | null` (`ward-model.ts:618`) — THIS IS THE FIGURE.** A
  `BedRelease` _is_ the discharge record. True enum, `null` when not blocked. Vocabulary
  `BED_RELEASE_BLOCKERS` (`ward-change-reasons.ts:75-104`), **8 members**, and
  "THERE IS NEVER AN 'OTHER, PLEASE SPECIFY'" (`:145-147`).
- `Admission.blockReason: BedReleaseBlocker | null` (`ward-admissions.ts:395`) — a third location,
  same vocabulary, on the occupant rather than the release. **Say which one you counted.**

**GENERATE THE TABLE FROM `BED_RELEASE_BLOCKERS`, never hand-write it** — a hand-written table
checked by a hand-written test proves only that one author was consistent with themselves.

`ward-statistics.ts:170` already computes `readyToLeaveCannot` as a single total over
`Admission.blockReason`. **Your figure is the breakdown it never had.** If you count `BedRelease` and
it counts `Admission`, the two totals may differ — say so rather than letting a reader assume they
must agree.

## FIGURE 4 — "declines by reason"

Buildable. `DECLINE_REASONS` (`ward-model.ts:103-111`), **7 members**, reached via
`Movement.declines[].reason`. **Generate the table from the vocabulary.**

**⚠️ THERE IS A SECOND, DIFFERENT LIST — do not merge them.** `REFERRAL_DECLINE_REASONS`
(`ward-model.ts:699-706`), 6 members, on `ReferralAddressing.declineReason?` (`:915`).

**And the referral side has no per-ward decline at all.** A referral can carry at most one
addressing per destination _kind_ (`ward-flow-reducer.ts:1493-1498`), the `psychiatric_ward` arm has
no unit id (`:780-799`), and `DECLINE_REFERRAL` matches by destination kind, not unit (`:1749-1751`).
So the referral model **has no concept of "which ward" until one accepts** — there is no front-door
half to disclose. **Say on the page that this counts wards approached through the coordinator's
matching, not referrals refused at the front door.**

## Global constraints

1. **Null is never zero.** A ward with no discharges has no average, not an average of nought.
   Note the documented exception: `ward-statistics.ts:17-18` exempts genuine COUNTS, where 0 is a
   true answer. A blocker category with no discharges is **absent from the list**, never a nought.
2. **Ward-level figures are coordinator-only; anything published is pooled.** No league table.
3. **Capture broadly, display narrowly.** Thirty numbers on one page is a page nobody reads.
4. **Files:** `src/components/ward-management/statistics/**` and `tests/ward-statistics*` only.
   Everything else is READ ONLY — other chats own it.
5. **Update `statistics-claims-register.ts`** for every new model claim your prose makes.

## Gate

```
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run $(ls tests/ward-statistics*.test.ts tests/ward-statistics*.test.tsx tests/ward-community*.test.ts tests/ward-community*.test.tsx | tr '\n' ' ')
```

Echo the discovered list, refuse an empty discovery, and **report the RAN count, not the passed
count** — a run that dies at startup reports "0 failed", which is indistinguishable from a pass.

## One stale comment found in passing — REPORT, do not fix

`ward-model.ts:939-940` says `Decline` has "an optional `note`". `ward-model.ts:256-271` says
"THERE IS NO `note` FIELD, and its absence is the point", and the type has none. Two comments
contradict each other about the type Figure 1 depends on. Another chat's file.

---

# AMENDMENT after the merge — read this before starting

Base is now `aeff0635b`, 0 behind the integration line.

## ⚠️ FIGURE 3 IS HELD. DO NOT BUILD IT IN THIS TASK.

`Movement.blocker` reached this branch in the merge, but the field it depends on has a live defect:
**`hasActiveBlocker` is case-sensitive while the writer accepts free prose**, so a human typing
`"none — resolved"` in lower case still scores as blocked. A figure counting blocked discharges
built against that **reads high, and would look right** — which is the whole failure mode this
screen exists to avoid.

The repair is in flight on the integration line. Build figures 1, 2 and 4 only. Say in your report
that 3 was held and why.

(Its groundwork stands: `BedRelease.blocker` is the enumerable field, `BED_RELEASE_BLOCKERS` has 8
members, and the table must be generated from the vocabulary. That is for the next task.)

## FIGURE 2 — write it up as a FINDING, with the derivation shown

Not a paragraph saying "not built". **Show the reader exactly what the model would need before it
could answer**, so the decision to add it is the owner's and informed:

- Name `Unit.empty` ("physically empty beds, per the feed", `ward-model.ts:220`) and
  `Unit.allocatable` ("beds the ward says it can actually allocate", `:222`).
- **Show the arithmetic**: `held = empty.value − min(allocatable.value, empty.value)`
  (`ward-derivations.ts:320-328`).
- Say what that actually measures — a **ward-side readiness gap**, aggregate over all the ward's
  beds, not a record of any offer made or withheld to any particular request.
- Say what would be needed: a per-bed or per-offer record. **That is a model change, not a change
  to this page.**

**Do NOT render `held` beside the explanation.** A figure next to its own disclaimer is read as the
figure, and this is the one the owner called the most politically sensitive in the set — a proxy
carrying that name would be quoted as the thing it is not.
