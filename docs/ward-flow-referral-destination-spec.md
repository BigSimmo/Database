# Spec — the referral destination type, and the guard widening it requires

Written 2026-08-30 by 🟣 WARD Referrals. **A specification, not an edit.** `ward-model.ts` and
`ward-flow-reducer.ts` belong to the untangle session while Task 17 is in flight; this is handed
over so the widening is done deliberately by whoever compiles against it.

---

# Part 1 — `ReferralDestination`

## Why a tagged union rather than widening `referredUnitIds`

`Movement.referredUnitIds: string[]` holds unit ids. Three decided facts each independently
break it:

- **`FD-15`** — a destination may be a **team inside a department**. "ED psychiatry at this
  hospital" is not a unit and has no unit id.
- **Community hubs are peers** of wards and EDs, one shape, not a special case bolted on.
- **`FD-16`** — psychiatry raise a referral **addressed to themselves**. A self-addressed
  referral is only expressible if a destination can name a team.

Widening a `string[]` to carry three kinds means encoding the kind in the string, which is the
stringly-typed defect this codebase already carries in `LEAVING_DESTINATIONS` and has already been
bitten by once in a rename.

## The type

```ts
export type ReferralDestination =
  | { kind: "ward"; unitId: string }
  | { kind: "ed_psychiatry"; edId: string }
  | { kind: "community_team"; teamId: string };
```

`ed_psychiatry` rather than `ed`, deliberately: **ED medical staff are not users of this system.**
The addressee is the psychiatry team at that ED, never the department. Naming it `ed` invites a
later reader to address the department, which has no meaning here.

**Three kinds, not four. A medical ward is NOT a destination** — owner, 2026-08-30: _"defer the
medical ward for now and just route to ED which also includes medical ward."_ So a psychiatric ward
sending someone for a medical problem addresses the **ED**, and the ED covers what a medical ward
would. **This is a deferral with a stated reason, not an oversight** — the arm exists in the model
as `ed_psychiatry` + `medical_assessment`.

## Purpose is a separate axis and must not be folded into `kind`

```ts
export type ReferralPurpose = "bed" | "psychiatric_review" | "medical_assessment";
```

Three flows share the `ed_psychiatry` kind and mean different things:

| flow                  | kind            | purpose              |
| --------------------- | --------------- | -------------------- |
| community → ED        | `ed_psychiatry` | `bed`                |
| ED psych → themselves | `ed_psychiatry` | `psychiatric_review` |
| ward → ED             | `ed_psychiatry` | `medical_assessment` |

**A bed request and a review request answered by the same affordance is how one becomes the
other by accident.** Keeping purpose separate is what makes that checkable rather than a naming
convention.

## EVERY referral is declinable. There is no notification kind.

**Owner, 2026-08-30. This REPLACES `FD-3` and everything built on it.** An earlier version of this
spec had a referral to an ED as a notification nobody could decline, and a ward→ED medical referral
as _"actionable by nobody, at all"_. **Both are wrong.**

- **Every referral, of every kind and purpose, can be declined.** Community→ED can be declined —
  rarely, but the affordance exists and the lifecycle is identical.
- **The "expect" is a referral that is almost always accepted, not a notification.** That is a fact
  about how often it is declined, never about whether it can be.
- **One verb, one lifecycle, several sets of criteria.** A psychiatric ward weighs capacity, sex
  mix, security and authorisation; a community team is accepted by a **team** rather than a bed.
  The criteria differ; the act does not.

**So no code path may render a referral with no decline affordance**, and no branch may treat a kind
or purpose as unrefusable. Where an earlier build produced one, it is removed rather than hidden.
**A notification is a referral somebody forgot to let anyone answer.**

## The referrer addresses it, and picks several destinations at once

The survey line this spec originally rested on — _"a referral has never been addressed by the person
raising it"_ — **described the old code, not the intent.** Corrected by the owner: **the referrer
selects the destinations, several in one act.**

Which restores the point of `PARALLEL_REFERRAL_CAP`: not a coordinator's throttle inherited by a new
surface, but a limit on **one clinician's single act of referring**.

## The lifecycle, settled

- **First acceptance cancels every other referral for that patient, automatically.** Not only the
  parallel ward ones.
- **A referral ends at acceptance.**
- **Nothing is ever locked out.** Out-of-catchment options are **greyed, not removed**; a unit with
  no beds is still offered; and **a decline does not lock a ward out — an option to clarify
  remains.** This retires the older decision that a declining ward drops out of suggestions.
- **A referral may exist for a patient who already has a bed.**
- **`Decline.note` is REMOVED** (`ward-model.ts:246`). A controlled vocabulary with an escape hatch
  beside it is not a controlled vocabulary.

## Breadth

`PARALLEL_REFERRAL_CAP = 3` is a **ward concept**. Its own comment reasons about spamming wards
and eroding trust between services, and that reasoning does not transfer: you do not refer a
patient to three emergency departments — they are physically in one — and a patient has one home
region and therefore one community team.

```ts
destinations: ReferralDestination[];
```

with two invariants, both enforced and both mutation-proved:

1. **Any destination whose `kind` is not `"ward"` implies `destinations.length === 1`.**
2. **Ward destinations beyond `PARALLEL_REFERRAL_CAP` require a recorded reason** (see Part 1's
   reasons section). Three remains the courtesy figure; it becomes soft, not absent.

`tests/ward-legal-figure-guard.test.ts` stays **intact and unweakened** — it is what proves 3 is a
service-courtesy number and not a Mental Health Act figure, which is a standing refusal.

## Derivation, not free choice

The catchment documents map **postcode → suburb → approved hospital → follow-up clinic**. So the
referrer chooses the **kind** of destination and the specific place largely falls out of the table.

That is a smaller and more honest design than a free choice of destination, and it has a property
free choice does not: **out-of-catchment becomes an explicit deviation from a computed default,
rather than one option among many that happens to need a justification.** The reason the owner
asked for attaches to a deviation that the system can identify by itself.

## Reasons — recorded, fixed-list, in the event

Two new reasons, plus one existing one that is currently theatre.

```ts
export const BEYOND_CAP_REASONS = [...] as const;      // referring to more than three wards
export const OUT_OF_CATCHMENT_REASONS = [...] as const; // a ward outside the catchment table
```

**Fixed lists, never typed text**, per the owner's typed rule. Values to be drafted with him — do
not invent clinical justifications.

**And the existing override reason must be fixed first.** `shortlist-panel.tsx:373-381` trims the
coordinator's typed reason, refuses an empty one, and dispatches `REFER_TO_UNITS`, **which has no
reason field**. The reason lives in component state and dies on refresh, while
`ward-management-modes.tsx:861` tells the reader it is recorded. `DB-15` already decided the four
replacement values — agreed mismatch (more restrictive), clinical urgency, out-of-date bed
information, closer to home — and is unbuilt.

**Any new reason built before that fix inherits a pattern that pretends to record.** Owner has
approved fixing it first.

## Catchment needs a fact the model does not have

`HOME_REGIONS` is ten broad values; `suburb` appears **zero times** under `ward-management`. Every
Perth suburb is "Perth Metropolitan" while Armadale and Joondalup are opposite ends of the city
with different services. **Region cannot produce the answer the catchment documents contain.**

So the referral carries **suburb or postcode**, and region becomes derived. This is a correction to
which fact is primary, not an addition.

---

# Part 2 — widening the referral guard

## The guard is not stale. It is working correctly against decisions taken after it was written.

`ward-model.ts` declares the referral carries **exactly five facts** and **no free text of any
kind**, and `tests/ward-referral-model.test.ts` pins it by exact set equality against a
`Required<Referral>` literal, so a future field named `notes`, `diagnosis`, `dob` or `patientId` is
caught rather than discouraged.

Four decided changes add precisely those shapes:

| change                    | decision          | the guard's objection      |
| ------------------------- | ----------------- | -------------------------- |
| one story field           | `FD-13`           | "no free text of any kind" |
| tentative diagnosis block | `FD-7` / `FD-10`  | a field named `diagnosis`  |
| destination               | `FD-11` / `FD-15` | not in the allowlist       |
| patient link              | owner, 2026-08-30 | a field named `patientId`  |

**That distinction changes the remedy.** A stale guard gets deleted. A correct guard opposing a
later decision gets **widened deliberately, in the same change that needs it, with the decision id
beside each entry** — and deleting it would be the loudest possible version of the defect class
this branch has spent two days cataloguing.

## The replacement rule, which is what resolves it

The owner retired "exactly five" himself: _"that was an old early rule. Update it to ensure it
aligns with current referral requirement which will likely have future additions added."_

**It counted. A count is checkable and brittle: the moment the thing legitimately grows, the rule
is either broken or abandoned and there is no third option.** The replacement types rather than
counts, which is why it survives at twenty fields and at forty:

1. Every field is a chosen option from a fixed list. No typed values, no hand-entered numbers or
   dates. **This is what makes the privacy claim checkable rather than promised, and why a longer
   field list costs nothing.**
2. Exactly one story field. Labelled, optional, last. Never feeds eligibility, matching, ranking
   or ordering.
3. Never a name, date of birth, address or record number, or any free-typed value outside the
   story field.
4. Fields may determine which beds are **eligible**. Nothing may rank a person or recommend one.
5. A new field is allowed when it meets 1–4 and is recorded as a decision. **Adding one silently
   is the breach; adding one is not.**

## The widening, item by item

**Prose.** Rewrite the "exactly five facts" paragraph in `ward-model.ts` **in the body**. Do not
prepend a correction — a stale section under a fresh note stays quotable, and the wrong text sits
where a reader expects the answer.

**Allowlist.** Widen `ALLOWED_REFERRAL_FIELDS` by exactly the four entries, **each carrying the
decision id that authorised it**:

```ts
"storyNote",              // FD-13
"tentativeDiagnosisBlock",// FD-7
"destinations",           // FD-11 / FD-15
"patientId",              // owner 2026-08-30
```

**And clause 5 needs a way to fail.** A comment id is a promise wearing the costume of a
reference. **Add a check that every id in the allowlist resolves to a real decision record, and
mutation-prove it with an invented id.** Without that, "adding one silently is the breach"
describes a breach nothing can detect.

**The free-text DOM guard.** `tests/ward-referral-screens.dom.test.tsx:149` — "has no free-text
input of any kind anywhere on the form" — becomes **"exactly one free-text input, and it is the
story field"**. Widened by one, never loosened: it must still fail for a second story box, and for
any input named `patientId`, `dob` or `homeAddress`.

**A guard widened by one is exactly where a widening by two hides.** Mutation-prove that it still
catches each forbidden shape, rather than asserting it.

## The one that needs its own sentence: a link is not a copy

`patientId` is the most delicate entry, because identity arrives in this system for the first time.

**The referral may carry a REFERENCE to a patient. It may never carry an identifying VALUE.** A
name, date of birth, address or UMRN on a `Referral` stays forbidden and the guard must still catch
it. Identity lives on the patient record and nowhere else.

That keeps the strongest true claim available — _a referral cannot contain a person's name_ — while
making the owner's search work. And the claim that must be corrected everywhere it appears is the
old one: **this system no longer holds no patient identity. It holds synthetic identities, and a
referral never carries one.** Correct those documents in the same commit, in the body.

## Verification

Every widening above is mutation-proved: apply the forbidden shape, watch the named guard redden,
quote the failure line, restore, and `git diff` to prove the restore. Predict the failure message
before running. An unexpected number or an unexpected failing test is a second finding.

`GATE_RECEIPTS=refresh`; suite discovered from disk; absolute counts, never the exit code and never
a ratio.

---

# Part 3 — the `Patient` entity, and the guard that must be born with it

## There is nothing to widen. There is something to write.

**Verified: no `Patient` type exists under `src/components/ward-management/`.** The only `Patient` in
`src/` is `care-plan/mockups/types.ts:117`, a different feature. So `PD-1` — the owner's ruling that
identity may be held — is a **creation**, not a modification.

**And the natural way to comply is precisely wrong.** The only place a name-shaped field is guarded
today is `Admission` (`tests/ward-admission-model.test.ts`, ten forbidden stems: `diagnos`, `notes`,
`note`, `comment`, `name`, `dob`, `patient`, `address`, `text`, `history`). Someone told "a name is
now permitted" will reach for the guard they can find, widen it, and put the name on `Admission`.

> **`PD-1` authorises identity on a PATIENT record. It authorises nothing on `Admission` or
> `Referral`. Both keep all ten stems closed.**

A referral carries a **reference** to a patient. **A link is not a copy.** That single sentence is
what keeps three guards meaningful at once, and it belongs in the code beside each of them.

## The gap, which is worse than a conflict

**A brand-new type is born with no guard at all.** The existing test reads admission fields; it
cannot see a type that did not exist when it was written. So `Patient` will quietly accumulate
`address`, `history` and free text — **the two stems the owner explicitly did not rule on, plus
everything nobody has thought of yet** — and nothing will fail.

**The guard ships in the same commit as the type. Not as a follow-up task.** A follow-up guard is
written against whatever the type has become by then, which is the definition of a check that
cannot fail.

## The shape, copying a mechanism that already exists and is better than inventing one

`tests/ward-admission-model.test.ts:561` holds `AUTHORISED_PERSON_FACTS` — a by-name allowlist whose
every entry carries **owner, date and reason**. The test calls it _"a governance record, not a
convenience"_. It holds exactly one entry today (`tentativeDiagnosis`, citing the 2026-08-29
ruling), and it **self-checks: an entry left behind after its field is removed fails**, so it cannot
silently re-open a hole. That is "widened, never deleted" already built, by someone who anticipated
this argument.

`Patient`'s guard copies it, with three legs:

1. **Exact set equality** between an allowlist and the keys of a fully-populated `Required<Patient>`
   literal. Catches ANY field the type gains, authorised or not. This is the leg that does the work.
2. **Every allowlist entry carries the decision id that authorised it**, and **a check that each id
   resolves to a real decision record**, mutation-proved with an invented id. Without that, "adding
   one silently is the breach" describes a breach nothing can detect — an id that is only a comment
   is a promise wearing the costume of a reference.
3. **The unruled stems stay denied over the allowlist itself** — `address`, `history`, `note`,
   `notes`, `comment`, `text`, `diagnos`. So adding `homeAddress` requires editing the denylist as a
   second deliberate act, even with a plausible id beside it.

### Authorised today, and nothing else

```
"id"          // structural
"umrn"        // PD-1, owner 2026-08-30
"name"        // PD-1, owner 2026-08-30
"dob"         // PD-1, owner 2026-08-30
"ageBand"     // pre-existing person-fact
"sex"         // pre-existing person-fact
"homeRegion"  // pre-existing; DERIVED from suburb, see below
"suburb"      // catchment; the primary geographic fact
```

**`address` and narrative history are NOT ruled on and the guard stays closed on both.** A suburb is
not an address: it is the coarsest fact that answers catchment, and the catchment documents are
keyed on it. If anyone proposes a street address, that is a new ruling.

## The test that decides whether the lifecycle is right

**A patient with no movement, no referral and no admission, created, searched for, and found.**

If that test cannot be written, the entity is being created by the wrong event — which is the exact
error caught when the entity was proposed as part of arrival. It looks correct on every screen
showing admitted people and fails only at _"if nobody comes up, they can be added"_, which is the
one moment the whole flow exists for.

## Seed data

**Name-shaped and clearly fictional.** Fuzzy related-name matching is a stated requirement, so the
names must resemble one another — "Test Patient One" cannot demonstrate it. But no common Australian
surnames and nothing that could collide with a person in the room.

**The worst case is not that somebody mistakes a fabricated patient for a real one. It is that
somebody finds themselves, or a patient they know, in it by coincidence.**

**And a visible on-screen marker that the data is synthetic** — on the screen, where the person in
the room sees it, not in a comment or a document. Same reasoning as the "tentative" qualifier on a
diagnosis: the screen says what it is rather than relying on everyone present already knowing.

---

# Part 4 — the catchment lookup, and the two ways it fails silently

## Key it on SUBURB, not postcode

Postcode is the tempting key: numeric, no spelling variants, unambiguous. **It is also missing for
about 42 suburbs across the sources** — including ordinary ones like Willetton and Ridgewood — and
present in only one of the five documents. **Suburb is the only field every source carries.**

So: **suburb is the key**, normalised for case and whitespace, with postcode used to corroborate
where both exist and to disambiguate the handful of duplicate suburb names. The known spelling
variants (`Anketel`/`Anketell`, `Paulis`/`Paulls Valley`, `Florea!`/`Floreat`, `Salter Pointer`,
and four cases of a lower-case L standing in for a capital I) are handled by a **recorded alias
table**, never by fuzzy matching — an alias somebody wrote down can be reviewed; a fuzzy match
cannot.

## "No catchment found" must be a visible outcome, never a fallback

This is the failure the design session named, arriving in the data rather than in the mapping:
**every suburb in the 2015 table gets a hospital, nothing is blank, nothing fails — so a mapping
built from it looks complete.** A lookup keyed on a field that is missing for 42 suburbs, with a
fallback, produces exactly the same appearance and is wrong for those 42.

So the lookup returns one of three outcomes, and **all three are rendered**:

1. **a catchment team**, from the table;
2. **no catchment for this suburb** — said on screen, in those words, with the suburb named;
3. **the suburb is not recognised at all**.

**Never a default, never the nearest match, never an empty string that renders as blank.** A
referral whose catchment is unknown is a referral the clinician must route deliberately — which is
the honest outcome and, under the out-of-catchment rule, one that already has somewhere to record
why.

## The three internal inconsistencies stay unresolved in the data

`Bentley` vs `Mills Street` for one place; `Kwinana` on exactly 2 rows where every neighbour says
`Rockingham`; `Swan Valley` on exactly 2 rows where every neighbour says `Midland`. **A value on
two rows out of five hundred is either a real exception or a typo, and nothing in the document
distinguishes them.** They are with the owner. Until he answers, the rows carry both readings and
the lookup treats them as outcome 2 rather than guessing.

## And the hospital column is not seeded at all

Only the 2015 document carries an approved-hospital column; every newer source names clinics. **A
newer document cannot disagree with a column it does not contain**, so the staleness cannot be
resolved from what exists. Build routing on the **clinic** column, which three sources corroborate,
and leave admitting-hospital routing out until the owner supplies a source that names hospitals.

---

# Part 5 — how an unreviewed or contested catchment renders, and how it routes

The owner has deferred every open catchment question: _"Do your best for now to build what's there
knowing that it is liable to change and also ensuring any change is easy to do in the future."_

So the disagreements **ship**. They are not resolved first. Which means the screen has to carry
them, because **a chosen value and a provisional value look identical in code — the difference is
only whether anybody can find it again.**

## Three review states, and every one of them is visible

Each catchment row carries a state, and none of them renders as a bare value:

| state        | what it means                                                                          | how it renders                                   |
| ------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `reviewed`   | one source, no disagreement                                                            | the team name, plainly                           |
| `unreviewed` | a value the source gives, that nothing corroborates and that its neighbours contradict | the team name **with "not reviewed" beside it**  |
| `contested`  | two sources give different answers                                                     | **both, each attributed to its source and date** |

`unreviewed` covers the three internal 2015 inconsistencies: `Bentley` vs `Mills Street` for one
place, `Kwinana` on exactly 2 rows where every neighbour says `Rockingham`, `Swan Valley` on
exactly 2 rows where every neighbour says `Midland`.

`contested` covers the five cross-document contradictions: Halls Head, Mandurah, Furnissdale,
Birchmont, Calista.

**A clinician seeing `Kwinana` where every neighbour says `Rockingham` must be able to tell nobody
has reviewed it, rather than reading it as fact.** Same reasoning as the `tentative` qualifier on a
diagnosis and the synthetic-data marker: **the screen says what it is.**

## The edge that matters more than the rendering: contested does not route

**A contested suburb must not silently pick one answer for routing purposes. It routes like
`no catchment found` — the clinician chooses.**

This follows directly from "never resolved by recency". If the lookup renders both answers and then
quietly routes on the newer one, the screen is honest and the behaviour is not, which is worse than
either being wrong on its own: the display invites trust in a decision made somewhere the reader
cannot see.

`unreviewed` **does** route — it is one source's answer with nothing contradicting it, just nothing
corroborating it either — and it routes with its marker attached, so the clinician can override it
with the out-of-catchment reason that already exists.

## Provisional values must be findable

**Every provisional carries an open id in the ledger, and a test that names the deferred
decision.** When the owner answers: find the id, change one place, watch the named test go green.

**If a provisional cannot be found from the ledger, it is not provisional — it is a decision nobody
made.** Pick one and move on and it is indistinguishable from a decided value within a week, which
is how a placeholder becomes a requirement.

## Why the suburb key belongs in this section

Keying the lookup on postcode would not merely have needed changing later. **It assumes a
completeness the data does not have** — 42 suburbs carry no postcode in any source — and fails
silently for exactly those. Keying on suburb is the same amount of work and survives the answer
either way.

**A shape that assumes the answer, versus a value that is merely wrong: that is the difference
between a rebuild and an edit.** The hospital-column derivation is the same test and fails it —
which is why nothing derives an admitting hospital, and why a derivation must not be built and left
switched off. **A decision hiding as dead code is still a decision.**

---

# Part 6 — a catchment yields a SET, and the evidence was already in the data

**Owner, 2026-08-30:** _"If the patient is within the FSH catchment they go to either Fiona Stanley
hospital psychiatric ward or Fremantle hospital psychiatric ward."_

**One catchment, two admitting wards.** So a catchment's destination is a **set**, not a site — and
that is a shape fact, settled by one example, which is all a cardinality question ever needs.

```ts
// WRONG — the obvious model, identical work to build, wrong at the first catchment checked
catchmentHospital: string;

// RIGHT
admittingWards: readonly string[];   // one entry is a set of one, never a special case
```

**This is the shape-versus-value rule proving itself on the first real fact received.** A
`suburb → hospital` field would not have been a wrong value needing an edit; it would have been a
wrong shape needing a rebuild, and nothing about writing it would have felt like a guess.

## The same fact was already in the clinic column and we read it as untidiness

The follow-up-clinic column contains **five slash-hedged values** — `Peel /Rockingham` and four
like it. Those were catalogued as data-quality noise, alongside `Midalnd` and `Florea!`.

**They are not typos. They are sets, written by someone who had no field for a set.** A misspelling
and a slash look equally like mess in a variants table, and only one of them is telling you the
model is wrong.

So **the clinic column is set-valued too**, and the five hedged rows are the evidence rather than
the exception. Model both columns as sets; parse the slashes as multiple entries rather than
normalising them to one.

**And treat this as a general warning about the variants list**: it groups by _looks irregular_,
which mixes together spelling errors, sets, and genuine exceptions. Each needs a different remedy
and only one of them is a correction. Re-read that list asking _"is this mess, or is this a fact I
have no field for?"_

## Fremantle still admits, and the natural inference is backwards

**Both Fiona Stanley and Fremantle have live psychiatric wards, and neither covers the other.**
Fiona Stanley took most acute services from Fremantle, so the obvious assumption is that Fremantle
stopped admitting. It did not.

The standing refusal — _nobody assumes `Fremantle` covers what Fiona Stanley would cover_ — was
written against an inference that turns out to be **the opposite of the truth**. The refusal held
anyway, which is the point: it was never a guess about which way the fact went.

## What is settled and what is not

**Settled:** the eight placeholder admitting sites — `Midland`, `Rockingham`, `RPH`, `SCGH`,
`Joondalup`, `Mandurah`, `Fremantle`, `Fiona Stanley`. And that a catchment maps to a set of them.

**Confirmed stale:** the 2015 approved-hospital column. It omits a hospital that does admit. This is
no longer a suspicion, and **the shared-cause reading was right** — his recollection and the 2015
document traced to the same out-of-date picture, so their agreement was never corroboration.

**Still deferred:** which suburbs are in which catchment. He gave one catchment's destinations, not
the mapping. **Nothing derives a hospital from a suburb**, and that is now on firmer ground rather
than weaker: the only column that could have supplied it is confirmed wrong.

---

# Part 7 — what a ward may see, and what the referrer is shown

## The visibility rule, which must be a guard and not a comment

**Owner, 2026-08-30: a ward cannot see where else a patient has been referred. The coordinator may
see everything.** His reason: so a ward does not spend its time on a patient who is being placed
elsewhere.

**This spec previously specified the violating behaviour in as many words** — the patient screen was
to show _"open referrals and who has answered"_. That is exactly what a ward must not see.

It is **ward-facing only, deliberate, and behavioural rather than cosmetic**, which makes it the
single most likely rule in this document to be undone by somebody being helpful. Every instinct says
a patient's screen shows everything known about that patient.

**So it is encoded, not noted:**

- A ward-scoped view is built from a **ward-scoped projection** of the patient, not from the full
  record with fields hidden at render time. A field that reaches the component can be displayed by
  the next person who edits it.
- **A test that fails if a ward-scoped view can reach another destination's referral.**
  Mutation-proved: expose one, watch it redden.
- The coordinator's view is a **different projection**, not the same one with a flag.

**Hiding at render is the version that decays.** A projection that never carries the data cannot be
made to show it by a styling change, a new column, or a debug panel.

## What the referrer IS shown, at the moment of choosing

**Owner, 2026-08-30: _"add all relevant catchment and referral info for the referrer to aid the
process."_** This moves the catchment work's audience: it was designed to help a coordinator route,
and it helps the **clinician**, while they choose. That fits 537 suburbs far better than a
network-level view did.

Per option, at the point of selection:

- **In catchment or not**, from the patient's suburb. Out-of-catchment options are **greyed, never
  removed** — the owner's rule — and choosing one asks for the recorded reason that already exists.
- **Estimated wait**, and the other figures that bear on the choice.
- **Why this option is suggested**, in words a clinician can disagree with: serves this suburb; has
  an available bed that can hold someone involuntarily. **A rule you can read is a rule you can
  argue with; a score is not.**
- **Where the catchment is unknown or contested, that is said** — Part 5's three review states apply
  here, and a contested suburb does not silently route.

**And what the referrer is NOT shown: anything that ranks the patient.** Options are ordered by
facts about beds and services. Nothing on this screen scores a person.
