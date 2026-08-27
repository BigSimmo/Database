# Ward Flow Phase 7 — The front door

**Status:** design, written 2026-08-27. Implementation plan follows separately.

**One sentence:** referrals arrive from anywhere — a community team, a crisis service, police, an
ambulance, another hospital — carrying three facts about a person and nothing more, and a coordinator
decides where each one fits, or says no with a reason, or leaves it queued.

**Inputs, not outputs.** The bed-category model and the permitted referral fields in
`docs/ward-flow-phase-6-7-decisions.md` are the product owner's, are used verbatim, and are not
re-derived here. Four further questions were put to the owner on 2026-08-27 and answered; each answer
is recorded at the decision it settles (D3, D5, D7).

---

## Read this before anything below: the foundation is not validated

`predicted → confirmed → blocked → released` is **a software model of how a bed comes free, and no
ward clinician has checked it.** It is Phase 5's spec D14, it is still open, and
`docs/ward-flow-clinician-check.md` is the one-page summary waiting to go to a clinician.

Phase 7 depends on that model **only indirectly, and D15 is the decision that keeps it that way**:
matching reads a bed's category and its `availableNow` figure, and never reads a release state. If
the four states change, Phase 7 does not.

**If the product owner reports what a clinician said, that answer overrides this specification
immediately.**

---

## Why this phase

Ward Flow currently begins in an emergency department. Roadmap decision 1 says that is the wrong
place to begin: most patients are formed in the community, the ED is a waypoint rather than an
origin, and the community-to-ward pathway that never touches an ED cannot be expressed at all today.
`Movement.originEdId` is a required field, which is the shape of that gap in one line.

Phase 7 builds the front door: a referral that exists before any movement does, from any source, and
the decision a coordinator makes about it.

It also brings the first real matching against **what kind of bed a person needs**, which is where the
prototype earns or loses its credibility. Three things about the bed model make that easy to get
wrong in ways that look like a subtle bug rather than a modelling error, and D2, D3 and D4 exist to
stop each of them.

---

## What already exists — extend it, do not build beside it

Phase 5's binding lesson was that a parallel concept is worse than an awkward extension. Everything
below already exists and Phase 7 is largely a widening of it.

| Already built                                                                                      | Where                      | How Phase 7 uses it                                                       |
| -------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------- |
| `eligibility(movement, unit, now)` returning a `GateResult[]` — gate, pass, human detail           | `ward-eligibility.ts`      | **The matching engine.** Widened, never replaced                          |
| A **constraint-shaped** gate: `security` passes when the request is Open **or** the unit is Secure | `ward-eligibility.ts`      | The precedent every new dimension follows                                 |
| `Cohort = "Adult" \| "Older adult"` on both `Unit` and `Movement`                                  | `ward-model.ts`            | Widened with `"Youth"` — the age dimension                                |
| `unit.authorised: boolean`                                                                         | `ward-model.ts`            | **Is** the legal-status dimension. Not duplicated (D3)                    |
| `unit.security: "Open" \| "Secure"`                                                                | `ward-model.ts`            | Stays exactly as it is, and is **not** one of the four dimensions         |
| `unit.sexMix` — an occupancy fact                                                                  | `ward-model.ts`            | Untouched. A different question from sex designation (D4)                 |
| `DECLINE_REASONS` — a fixed list, never typed                                                      | `ward-model.ts`            | The pattern for `REFERRAL_DECLINE_REASONS`, which is a separate list (D8) |
| `Rejection` — the first-class visible refusal                                                      | `ward-model.ts`            | Every refused referral action surfaces as one                             |
| `EVENT_ROLE`, the acting-role gate on every event                                                  | `ward-flow-reducer.ts`     | Gates the new events, including the new `community` role                  |
| `capacityBreakdown().availableNow`                                                                 | `ward-bed-availability.ts` | The only availability figure matching reads (D15)                         |

**`eligibility()` is the important one.** It already produces exactly the artefact roadmap
"additional item 2" asks for — for one patient, every unit and the single reason it cannot take them
— and it already models one dimension correctly as a constraint rather than an equality. Phase 7's
matching is that function, widened.

---

## Scope

**In:**

1. A `Referral` record: three facts about a person, and the operational facts about the referral
   itself.
2. One referral type carrying a source label — community, crisis service, police, ambulance,
   inter-hospital transfer.
3. The four-dimension bed category, expressed on `Unit`.
4. Matching a referral to beds, as accepts-or-the-single-reason-not.
5. The coordinator's decision: accepted, declined with a reason from a fixed list, or queued.
6. The data-entry screens each contributor needs, and the coordinator's referral board.

**Out, and deliberately so:** distance, travel-time bands, closest-suitable-bed, the country and
remote pathway, air transport, and the out-of-area ledger (all Phase 8); escalation tiers,
waiting-time equity, ownership clocks and notifications (Phase 9); the statutory clock board (roadmap
16, blocked on figures the owner has not supplied); predictive community demand (roadmap 4); any
clinical reason for admission (roadmap 7); free text of any kind; automated allocation; **forensic
matching** (D7); and a referral becoming a `Movement` automatically — see D14.

---

## Decisions

### D1 — A referral is a new record that precedes a movement, and the existing `ReferralDraft` is a different thing

There is already a `RAISE_REFERRAL` event carrying a `ReferralDraft`. It means **"an emergency
department raises a movement"** — a different event, at a different point in the pipeline, with a
required `edId`. Phase 7's referral exists **before** any movement, may never involve an ED at all,
and carries far less.

Add `Referral` and `RECEIVE_REFERRAL`. Leave `ReferralDraft` and `RAISE_REFERRAL` under their existing
names, and put a doc comment on each type pointing at the other and naming the distinction in one
sentence.

**Alternative considered and rejected:** renaming the existing pair to something like
`MovementDraft` / `RAISE_MOVEMENT`. It would read better, and it was rejected because the rename
touches the exhaustive `switch` in `tests/ward-legal-figure-guard.test.ts`, the reducer, the ED
screen and a large number of tests, for no behavioural gain — churn on well-tested code in a phase
that has real modelling work to do. The cost of keeping the names is one doc comment each; the cost of
changing them is a day. If the confusion turns out to bite in practice, rename it then, on evidence.

**Expensive to change later:** the rename gets more expensive with every new consumer, so this is a
decision worth revisiting deliberately rather than drifting past.

### D2 — A bed is a combination across four independent dimensions, not one label from a list

This is the owner's model, used verbatim:

| Dimension        | Values                                           |
| ---------------- | ------------------------------------------------ |
| **Age**          | Older Adult · Adult · Youth                      |
| **Legal status** | Voluntary · Involuntary                          |
| **Sex**          | Undesignated (default) · Female only · Male only |
| **Forensic**     | Forensic · not forensic                          |

An "Adult, Involuntary, Male-only, Forensic" bed is expressible, and forensic combines with the other
three rather than replacing them. A bed is described by the combination; there is no flat list of
eight labels anywhere, and a `BedCategory` type must not collapse into one.

**How each dimension lands on `Unit`, which is the part that matters for not building a parallel
model:**

- **Age** — widen the existing `Cohort` with `"Youth"`. Keep the existing spelling `"Older adult"`
  rather than re-casing it to `"Older Adult"`; a casing migration across every fixture and test buys
  nothing. **User-facing copy says "Age"**, because that is the owner's word and the vocabulary rule
  from Phase 5 applies to what a reader sees, not to a type name. Record that mismatch in a doc
  comment so nobody "fixes" it in either direction without a decision.
- **Legal status** — **do not add a field.** `unit.authorised: boolean` already carries this fact.
  Derive the label from it. Two fields for one fact is precisely how a screen ends up giving two
  answers, which is the defect Phase 5 shipped and caught by screenshot.
- **Sex designation** — new. `"Undesignated" | "Female only" | "Male only"`, defaulting to
  `"Undesignated"`.
- **Forensic** — new. A boolean, defaulting to false.

**`security: "Open" | "Secure"` is not one of the four dimensions and is not merged into forensic.**
It is an existing, separate property of a unit and it stays that way. Someone will try to merge Secure
and Forensic because both sound like locked wards; they are different facts and the merge would offer
forensic beds to people who need only a locked ward.

**Expensive to change later:** the shape (four independent dimensions rather than one label) is the
expensive one — every screen, every gate and every fixture assumes it. The individual values are
cheap.

### D3 — Every dimension is "does this bed accept this person", never "does this bed's value equal this person's"

This is the decision the whole phase turns on. Written as four rules, in the same accepts-shape, with
the reason each is shaped that way:

1. **Age** — a bed accepts a referral whose age band matches the bed's. Equality happens to be correct
   here, and it is still written as an accepts-rule so the four read uniformly and so a future change
   ("this adult unit will take a 17-year-old") lands in one place.
2. **Legal status** — an **Involuntary** bed accepts **both** voluntary and involuntary referrals; a
   **Voluntary** bed accepts voluntary referrals only. _(Owner's answer, 2026-08-27.)_ The existing
   `requiresAuthorisedDestination()` already behaves exactly this way, so this is a rename of an
   existing correct rule rather than a new one.
3. **Sex** — **Undesignated accepts everyone.** Female only accepts female referrals. Male only
   accepts male referrals.
4. **Forensic** — a forensic bed accepts **no Phase 7 referral at all** (D7).

**Why rule 3 is called out three times in this specification.** Most beds are undesignated, and
undesignated is the default rather than an exception bolted on. A rule of the form
`bed.sexDesignation === referral.sex` therefore excludes **every referral from most of the hospital**,
and it does so while looking entirely reasonable in a code review. Nothing in a normal test suite
catches it if the fixtures all happen to carry designations.

**The guard that actually catches it**, and it must be written as its own named test with this reason
on it: construct an undesignated bed and one referral of each sex, and assert that both are accepted.
Mutation-test it by changing the rule to equality and watching it go red. That single test is worth
more than any amount of review attention.

**Sex designation is a property of the bed constraining who may occupy it. It is never a description
of an occupant.** It is also why sex is one of the three permitted referral fields: without it, a
referral cannot be tested against a designated bed at all.

**Expensive to change later:** no — but getting it wrong is expensive to _find_, which is why the
guard exists rather than the reasoning being left in a comment.

### D4 — Sex designation and sex mix are different questions and both stay

`unit.sexMix` is an occupancy fact — who is currently in the ward — and the existing `sex_mix` gate
uses it to answer "would this admission leave someone alone in a ward with no one of their own sex".
That is a real and different question from "is this bed designated".

Phase 7 adds a **`sex_designation`** gate alongside the existing **`sex_mix`** gate. Neither replaces
the other and neither is derived from the other. Both appear in the gate list with their own name and
their own human-readable detail.

**Why this is a numbered decision.** Two gates whose names begin with the same word, answering
different questions, is an invitation to collapse them into one during a tidy-up. The collapse would
be silent and would produce wrong matching in both directions.

### D5 — What a referral carries

**Facts about the person — exactly three, and no others, ever:**

- `ageBand` — Older adult · Adult · Youth
- `sex` — Female · Male
- `secureBedNeeded` — yes / no

No name, no date of birth, no record number, no address, no diagnosis, no narrative history, no
treatment, and **no free text anywhere**. Free text counts as data.

**Facts about the referral itself** _(owner's answer, 2026-08-27: the three-field rule governs facts
about the person; a referral still needs operational facts about itself or it is not a referral)_:

- `id`
- `source` — the label from D6
- `raisedAt`
- `urgency` — 1 | 2 | 3, matching the existing scale
- `originSiteCode` — a synthetic site code, **never an address**
- `transportNeeded` — yes / no
- `state` and `outcome` — from D7

**The referral decline carries no note.** The existing `Decline` type has an optional free-text
`note`; the referral decline deliberately does not get one, because free text is data and a decline
reason chosen from a fixed list is the whole mechanism for keeping a person's circumstances out of the
record. If a coordinator needs to say something a fixed reason cannot express, that is a signal the
list is missing a reason — which is a one-line addition and a recorded decision, not a text box.

**A structural privacy test, extended from Phase 4 and Phase 5's**, asserts `Referral`'s field set
against this list rather than against fixture content. A future field named `patientId`, `notes` or
`diagnosis` fails it at the type level.

**Expensive to change later:** narrowing this list later is cheap; widening it is a governance
decision, not an implementation one.

### D6 — One referral type carrying a source label, not five pathways

```
ReferralSource = community | crisis_service | police | ambulance | inter_hospital
```

One type, one form, one board. Split into separate pathways later only if a real behavioural
difference appears — building five up front means maintaining five before we know whether they differ.

**`Movement.arrivalMode` (`self | ambulance | police`) is a different fact and is not merged with
this.** `arrivalMode` is how a person physically reached an emergency department; `source` is who sent
the referral. An ambulance-sourced referral to a community bed never touches an ED, and an
ambulance-arriving patient may have been referred by a community team. Related, not the same.

### D7 — Forensic beds are described, and are never offered

_(Owner's answer, 2026-08-27.)_ A bed carries the forensic dimension so every board can describe the
network honestly, and **no Phase 7 referral is ever matched to a forensic bed.** The forensic gate
fails for every referral, with a detail that says so plainly rather than implying the person was
assessed and found unsuitable.

**Why.** The three permitted referral fields contain nothing that expresses needing a forensic bed. The
alternatives were to add a fourth referral field, or to let "secure bed needed" stand for both — the
first widens the permitted-field list the owner had just settled, and the second would offer forensic
beds to people who need only a locked ward. Describing without offering keeps the model honest and
adds nothing to a referral.

**Consequence to state on screen:** a forensic bed's availability is visible and is **not** counted in
any figure presented as beds this referral could use. The board must not show a person a bed it will
never offer them without saying why.

**Expensive to change later:** no — adding forensic matching later is a fourth referral field, a fourth
rule, and a seeded fixture.

### D8 — Three outcomes, a fixed reason list, and the coordinator holds the decision

A referral is **queued**, **accepted**, or **declined**.

- **Queued** is the resting state and is not a failure. A referral nobody has decided on yet is a
  normal thing and the board says how long it has been there.
- **Accepted** attaches the referral to a unit.
- **Declined** carries a reason from `REFERRAL_DECLINE_REASONS`, chosen from a list and never typed.

**Only the `coordinator` role may set an outcome.** Any other role attempting it produces a visible
`Rejection`, following Phase 5's D2 pattern in mirror image: there the ward owned its own beds and the
coordinator was read-only; here the coordinator owns the front-door decision.

**This is a different decision from a ward declining a bed.** The existing `DECLINE` event is a unit
declining a specific movement, downstream, and it keeps its own `DECLINE_REASONS` list. The two must
not be collapsed: one is "this service will not take this referral", the other is "this ward cannot
take this patient". Two lists, two events, two reasons to exist.

**`REFERRAL_DECLINE_REASONS` — every entry describes the service's answer or the network's state,
never the person:**

- `no_suitable_bed`
- `age_band_not_provided_here`
- `sex_designation_unavailable`
- `secure_bed_unavailable`
- `out_of_catchment`
- `referred_elsewhere`

**Deliberately excluded, and this is the same discipline that kept "Pending case review outcome" out
of the blocker list:** anything describing the person or a clinical judgement about them — not
appropriate for admission, not unwell enough, behaviour, engagement, risk. If the owner wants any of
them, that is a one-line addition and a recorded decision, not something an implementer adds because
it seemed useful.

### D9 — Matching extends `eligibility()` and produces the same gate list

Phase 7 adds a referral-side entry point that returns the same `GateResult[]` shape the existing
function already returns: for each unit, whether it accepts this referral, and for each gate a
human-readable detail.

That artefact is already the "why not here?" answer roadmap additional item 2 asks for — every unit,
and the single reason it cannot take this person — so it is produced as a by-product rather than built
separately.

Widening required, and each is a place a mistake would hide:

- The `cohort` gate goes from two values to three. It stays equality (D3 rule 1).
- A new `sex_designation` gate, constraint-shaped, alongside the untouched `sex_mix` gate (D4).
- A new `forensic` gate that never passes (D7).
- The `authorisation` gate becomes the legal-status dimension by renaming its detail text; its logic
  is already correct (D3 rule 2).
- The `security` gate is untouched — it is already the constraint-shaped precedent.

### D10 — Matching shows candidates; a human decides

The match view lists the beds that accept this referral, and for every bed that does not, the reason.
**It never allocates, never ranks by suitability, and never suggests which bed is best.**

Consistent with roadmap decision 10 (a human declares; the system does not trigger on a threshold),
with the escalation board's existing "records and shows, suggests nothing" rule, and with the standing
fact that this is not clinical decision support.

Ordering within the accepting list is by hospital, in the site table's order — the same fixed order the
morning page uses, and for the same reason. An ordering that looked like a recommendation would be a
recommendation.

### D11 — One intake form, one new role, and the coordinator's board

**Screens:**

1. **Referral intake** — one form, used by every source. Three person-fields, plus source, urgency,
   origin site and transport. Every control real; no advisory buttons.
2. **Referral board (coordinator)** — queued referrals first, then recently decided. Ordered by
   urgency, then by how long a referral has waited.
3. **Match view** — one referral, every unit, accepted or the single reason not (D9, D10).

**Roles:** `WardFlowRole` gains **`community`** — one role covering all five sources, with the source
recorded on the referral. Five roles would be five things to maintain before we know they differ,
which is the same reasoning that produced one referral type in D6.

**"Waiting since" is prominent on the board.** Roadmap additional item 5 records that the queue ranks
by urgency, which is right, but length of wait carries the moral weight and is currently secondary.
Ranking stays by urgency; the wait is displayed at the front rather than buried. It is free to do here
and expensive to retrofit into a board people have already learned to read.

### D12 — Phone first for the intake form

Police and ambulance officers are not at a desk. The intake form is designed for a phone and adapted
upward, not squeezed downward — cards rather than a table, one decision per screenful, and
`min-h-12` (48px) tap targets.

**Do not reduce tap targets to `min-h-11` for a generic accessibility rule.** The repository's
production targets are 48px deliberately; 44px reintroduces a known `ui-smoke` flake, and the
repository's own conventions override generic checklist guidance.

Ward Flow's tables are right at a desk and wrong in a corridor. The discharge board was the first
board built after that was noticed; this is the second, and it is the one with a genuinely mobile
audience.

### D13 — No Mental Health Act figure, anywhere, and a plain label is not one

Unchanged and absolute: no figure, timeframe, threshold or duration from the Mental Health Act may be
cited, paraphrased or inferred — not in code, copy, comment, test or fixture. A **Voluntary** or
**Involuntary** label saying which of the two applies is permitted and **is not a legal figure**. If an
actual figure is ever needed, stop and ask the product owner.

**Implementation note that saved Phase 5 and will save this one:** `tests/ward-legal-figure-guard.test.ts`
switches exhaustively over every event type, so adding new events without extending it **refuses to
compile** rather than letting them pass the sweep unchecked. Extend it in the same change, and prove
it non-vacuous by emptying a candidate list and watching the traversal assertion name the event that
stopped being reached.

### D14 — A referral does not silently become a movement

An accepted referral is recorded as accepted against a unit. It does **not** automatically create a
`Movement`, and this phase does not build the bridge between the two.

**Why hold it back.** `Movement` requires `originEdId`, carries a legal status and legal form, and
sits inside a stage machine with its own transitions and its own tests. Wiring an accepted referral
into it is a real piece of modelling — where the patient physically is, whether an ED is involved at
all, what legal status a community referral starts with — and every one of those questions is
entangled with Phase 8's geography work. Building it now would mean building it against guesses and
then again afterwards.

What Phase 7 delivers instead is honest: the front door works end to end, and the accepted referral
sits visibly waiting for a pipeline that does not yet reach back this far. The board says so rather
than implying the handover happened.

**Expensive to change later:** no — this is a deliberate seam, and naming it now is what keeps it one.

### D15 — Matching reads availability, never a release state

Matching asks two things of a unit: does its category accept this referral, and does it have a bed
available now. It reads `availableNow` and **never reads a `BedRelease`, a state, a band or a
confidence.**

This is the decision that keeps Phase 7 independent of the unvalidated four-state model. If a clinician
says a bed can be confirmed and blocked at once, or that "predicted" is three states, Phase 7's
matching is unaffected because it never looked.

It also inherits Phase 5's central promise for free: a referral is never matched against a bed that is
merely expected. A coordinator offered a bed is offered one that exists this minute.

**Expensive to change later:** deliberately so. Reversing it — letting matching consider predicted beds
— would couple the front door to the unvalidated model and would break the one rule Phase 5 exists to
hold. It should not be reversed without an explicit owner decision.

### D16 — Youth beds must exist, or the age dimension is a claim the network cannot honour

Adding `"Youth"` to the age dimension while no unit anywhere carries it means every youth referral
matches nothing, and the board would report "no suitable bed" for a structural reason rather than an
operational one. Seed at least one youth unit.

**Two honest caveats, both of which must reach the screen rather than staying in this document:**

1. **How many youth units a metro service has, and where, is a fact neither the specification author
   nor the prototype knows.** The seeded count and placement are invented. The prototype must not imply
   otherwise.
2. **The site table uses real WA hospital names.** Attaching a synthetic youth unit to a real hospital
   asserts something about that hospital that may be false. This is a pre-existing tension — roadmap
   decision 12 says sites stay synthetic and real names are for geography only, while the table names
   real hospitals — and it is not Phase 7's to resolve unilaterally. **It is an open question for the
   product owner** (below), and until it is answered the safer placement for a new synthetic unit is a
   site that is already clearly synthetic.

Failure behaviour follows in D17: an age band with no unit anywhere in the network says exactly that,
rather than reading as "all full".

---

## Data flow

A contributor raises a referral → it enters `queued` with its three person-facts and its operational
facts → the coordinator opens it → matching evaluates every unit against the four dimensions plus the
existing gates, reading `availableNow` and nothing else about beds → the coordinator accepts it
against a unit, declines it with a reason from the fixed list, or leaves it queued → the referral board
and the match view both read the same derivation. No screen computes its own version of who fits.

---

## Failure behaviour

Everything degrades toward saying less rather than guessing more:

- **A referral missing a required field, or carrying an unknown source or an unknown decline reason**
  → refused with a visible `Rejection`. Never silently queued, never defaulted.
- **No bed in the network accepts this referral** → the board says so explicitly and lists the reason
  per unit. It never shows an empty list, because an empty list reads as a rendering failure.
- **An age band with no unit anywhere in the network** → says that specifically ("no youth unit exists
  in this network"), never "no bed available", which would be an operational statement about a
  structural fact.
- **A forensic bed** → shown with its category, excluded from every accepting list, and excluded from
  any figure presented as beds this referral could use — with the reason stated (D7).
- **A unit whose capacity has never been confirmed** → "Never confirmed", never zero, inheriting Phase
  5's D7 rule. A never-confirmed unit is not offered as an accepting bed.
- **A role attempting an action it does not hold** → a visible `Rejection`, never a silent no-op.

---

## Verification

No gate skipped, no assertion deleted, no test loosened, no tolerance lowered. Every new test is
mutation-tested — break what it guards, watch it go red with the failure line quoted, restore.

**The four tests that matter most, each with its reasoning written on it:**

1. **Undesignated accepts everyone.** An undesignated bed and one referral of each sex; both accepted.
   Mutate the rule to equality and watch it go red. This is the guard for the phase's single most
   dangerous mistake (D3).
2. **An involuntary bed accepts a voluntary referral.** Mutate to strict equality and watch it go red
   (D3 rule 2).
3. **Sex designation and sex mix are independent.** A unit that passes one and fails the other, in each
   direction, so a future collapse of the two gates fails (D4).
4. **Matching never reads a release.** A contract test that no code path reaching a match verdict has
   read a `BedRelease`, a state, a band or a confidence (D15). This is Phase 5's structural protection
   applied to the front door, and it is stronger than asserting the numbers agree today.

**Also, each mutation-tested:** the referral lifecycle and its role gate; the fixed decline-reason list
as a membership check rather than a truthiness test (Phase 5 shipped that exact weakness and it was
found in review); the age-band widening including the youth-unit-absent branch; the intake form's
refusal branches.

**Structural privacy test**, extended from Phase 4's and Phase 5's: `Referral`'s field set asserted
against D5's list, not against fixture content, so a future `patientId` or `notes` field fails at the
type level.

**Legal-figure sweep** extended to every new event, and proven non-vacuous by emptying a candidate list
and watching the traversal assertion name the event that stopped being reached (D13).

**Seeded fixture must open on the awkward cases**, following Phase 5's D13: most units undesignated
and a minority designated — a seed where every bed carries a designation would let an equality bug pass
every test; at least one youth referral and at least one youth unit; at least one forensic bed; at least
one queued referral that no bed accepts; and at least one declined referral.

**Browser proof — spend it deliberately.** `scripts/run-playwright.mjs` builds a full isolated
production app per invocation. One Chromium journey: a referral is raised from a phone-width intake
form, appears on the coordinator's board, is matched, and is accepted — with the board reflecting each
step without a reload. Prove it can fail before trusting it. Read **both** the exit status and the
"N passed" line: `75` means blocked by the run coordinator and should be retried, any other non-zero
means red, and exit 0 with no result line means nothing ran.

**Screenshots at 390 / 820 / 1440, looked at rather than assumed** — with the intake form checked at
390 first rather than last, because that is its primary width (D12). Every defect found in Phase 4's
and Phase 5's sweeps was invisible to structural checks.

**Not run, and why:** `verify:release`, every `eval:*` script, `check:supabase-project` and `test:live`
are provider-backed and forbidden by the standing constraints.

---

## Success criteria

1. A referral can be raised from a phone, by any of the five sources, in under a minute.
2. An undesignated bed accepts a referral of either sex — proven by a test that fails if the rule
   becomes an equality.
3. A coordinator can see, for one referral, every unit and the single reason each cannot take them.
4. A coordinator can decline a referral, with a reason, and the reason describes the service or the
   network rather than the person.
5. No referral is ever matched against a bed that is only expected.
6. The record holds exactly three facts about any person, and no free text anywhere.
7. If the four bed states turn out to be wrong, nothing in this phase changes.

---

## Risks

- **The sex-designation equality mistake.** The phase's defining hazard: correct-looking, review-proof,
  and it silently excludes most of the hospital. D3 and its named guard test are the mitigation, and the
  guard is only as good as the seeded fixture keeping most beds undesignated.
- **Two gates whose names begin with "sex".** A future tidy-up collapsing `sex_designation` into
  `sex_mix` would produce wrong matching in both directions. D4 and its independence test are the
  mitigation.
- **Youth beds are invented, and may be attached to real hospital names.** D16 states both caveats; the
  second is an open question for the owner rather than a thing this phase should settle alone.
- **`Referral` and `ReferralDraft` will be confused.** D1 accepts that cost knowingly, with doc comments
  as the mitigation and a rename as the escape hatch if it bites.
- **The three-field limit will feel too tight the first time a coordinator wants context.** That is the
  constraint working, not failing. The pressure release is a new fixed decline reason, never a text box.
- **An accepted referral goes nowhere (D14).** Deliberate, and the board must say so rather than
  implying a handover happened.
- **A matching engine that shows candidates looks like one that recommends.** D10 forbids ranking by
  suitability; ordering is by the site table, which is the same fixed order the morning page uses.

---

## Assumptions, and what each would cost to reverse

| Decision                   | Status                                                                        | Reversal cost                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2 (four dimensions)       | **The owner's model, confirmed 2026-08-27**                                   | **Expensive** — every screen, gate and fixture assumes the shape                                                                                   |
| D2 (individual values)     | The owner's list, verbatim                                                    | Cheap                                                                                                                                              |
| D3 rule 1 (age equality)   | **Assumption.** No clinician has said an adult unit never takes a 17-year-old | Cheap — one rule, one place                                                                                                                        |
| D3 rule 2 (legal status)   | Owner's answer, 2026-08-27                                                    | Cheap — the existing function already behaves this way                                                                                             |
| D3 rule 3 (sex)            | The owner's model, and the phase's defining rule                              | Cheap to change, expensive to _find_ if wrong — hence the named guard                                                                              |
| D4                         | Design judgement                                                              | Cheap                                                                                                                                              |
| D5 (three person-facts)    | Settled constraint                                                            | Narrowing cheap; widening is a governance decision, not an implementation one                                                                      |
| D5 (operational facts)     | Owner's answer, 2026-08-27                                                    | Cheap                                                                                                                                              |
| D6                         | Owner's decision, verbatim                                                    | Splitting into five pathways later is moderate                                                                                                     |
| D7 (forensic not matched)  | Owner's answer, 2026-08-27                                                    | Cheap — a fourth field, a fourth rule, a fixture                                                                                                   |
| D8                         | Owner's decision, plus a reason list that is design judgement                 | Adding a reason is one line; removing one after use is a data question                                                                             |
| D9, D10                    | Design judgement, following existing precedent                                | Cheap                                                                                                                                              |
| D11 (one `community` role) | Design judgement, same reasoning as D6                                        | Moderate — role appears in the gate and on every screen                                                                                            |
| D12                        | Repository convention plus the audience                                       | Cheap                                                                                                                                              |
| D13                        | Absolute constraint                                                           | Not for reversal                                                                                                                                   |
| D14                        | Deliberate seam                                                               | Building the bridge is real work, and is Phase 8's to scope                                                                                        |
| D15                        | The decision that isolates this phase from the unvalidated model              | **Should not be reversed without an explicit owner decision** — it would couple the front door to the four states and break Phase 5's central rule |
| D16 (youth seeding)        | **Assumption.** Count and placement are invented                              | Cheap in code; the real-hospital-name question is the owner's                                                                                      |
| **The four bed states**    | **UNVALIDATED**                                                               | **Nothing in this phase changes, by construction (D15)**                                                                                           |

---

## Open questions for the product owner

Neither blocks the implementation of this phase, but the first shapes D16's seeding.

1. **The site table uses real WA hospital names beside invented units and bed numbers.** Phase 7 adds
   invented youth units to it. Should the sites become clearly synthetic first? (The same question is
   recorded in the Phase 6 specification, from the other direction.)
2. **Should an accepted referral eventually flow into a movement automatically (D14), or should it
   always be a second, human step?** The answer is entangled with Phase 8's geography work and does not
   need deciding yet.
