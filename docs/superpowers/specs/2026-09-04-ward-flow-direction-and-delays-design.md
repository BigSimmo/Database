# Ward Flow — direction, the ward model defect, and the Delays view

**Date:** 2026-09-04
**Status:** agreed with the product owner in a single session and confirmed by him at the end
**Supersedes:** any earlier statement of Ward Flow's purpose, and several named rulings below

> **Every decision in this document was given by the product owner on 2026-09-04**, in answer to a
> question that set out the options and their consequences. Each is tagged `(OWNER, 2026-09-04)`.
> Anything not so tagged is my reasoning and carries no authority.
>
> ⚠️ **That tagging is deliberate and it is the fix for a defect this project found in itself.** An
> audit on the same day established that the codebase cites decisions in a form that cannot be told
> apart from decisions nobody made — roughly 43 of 76 sampled rules cite no authority at all, and
> citation status turned out to be wrong in both directions. A rule with no visible owner is a rule
> the next reader will obey anyway. **Do not copy any statement out of this document into code
> without carrying its tag.**

---

## 1. What Ward Flow is

A **lightweight, fast, statewide psychiatric bed-flow tool** that a coordinator opens instead of
making a phone round. `(OWNER, 2026-09-04)`

It is intended to be **used**, by real people, on real patients — not a demonstration, not a
specification exercise, and not a private aid to thinking. `(OWNER, 2026-09-04)` Three lighter
destinations were offered and rejected.

**Where the record lives.** Ward Flow owns the search for a bed and everything around it — who needs
one, who was asked, who declined, who accepted, who is in transit — **and the communication of those
decisions.** The hospital's bulky record keeps its own copy of the same facts. `(OWNER, 2026-09-04)`

> ⚠️ **Duplicate entry into the hospital record is accepted, not a defect to design away.** The owner
> has priced it. Do not propose integration as though double entry were the problem.

**Lightweight and rapid is the reason it exists.** It is being built because the hospital software is
bulky. Anything that makes it slower to fill in attacks its own justification. `(OWNER, 2026-09-04)`

## 2. The two jobs it must do better than a phone

1. **Show the whole state at a glance** — where every bed is.
2. **Show why each person is stuck.** `(OWNER, 2026-09-04)`

Both, not one. They are different objects: the first is about **beds**, the second about **delays**.

**How "good enough" will be judged:** the owner uses it for a week against his own service and stops
reaching for anything else. `(OWNER, 2026-09-04)` He is currently the only person who can run that
test, and it outranks any checklist.

## 3. What it may and may not do

🔴 **It recommends. It never decides.**

> _"It can never make a clinical decision on its own. It can guide and give recommendations that the
> final acceptance comes from the users."_ `(OWNER, 2026-09-04)`

**This reverses `spec D4` — "the board records and shows, it suggests nothing".** That rule was
never the owner's; it was inferred by the build team, written into four files in capitals, enforced
by a test, and obeyed by everyone. It is formally withdrawn as `R-2026-09-04-G`.

The owner's actual intent is stronger than merely permitting a hint:

> _"I want it to use all the information it has to make accurate suggestions about what patients best
> fit the wards and the most effective and efficient way to match all patients with beds."_
> `(OWNER, 2026-09-04)`

**Never, per the owner:** show a bed that is not really there; lose a person; state something the
record does not support; make a clinical decision on its own. `(OWNER, 2026-09-04)`

## 4. Scope

|                    |                                                                                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Patients**       | **Primarily adults**, plus older adult, forensic/secure, and youth. `(OWNER, 2026-09-04)`                                                                                                                                               |
| **Youth**          | 16–24 (units such as EMYU). **Under-16 paediatrics goes to Ward 5A at Perth Children's and is OUT of scope.** Youth follows the **same pathway** as adults — different unit eligibility, not a different journey. `(OWNER, 2026-09-04)` |
| **Primary screen** | **Desktop** — coordinator desks and ward workstations, down to 1280×800. Phone must work; it is secondary and no longer sets the shape of new screens. `(OWNER, 2026-09-04)`                                                            |
| **Also read**      | At a nurses' station, on a phone, and **on paper** — printing is a first-class output. `(OWNER, 2026-09-04)`                                                                                                                            |

**Journeys may now start from a community team directly**, bypassing an emergency department —
reversing _"every journey begins at an emergency department"_. Direct admission comes **only from a
community team**, not from a psychiatrist generally, and the receiving ward still accepts.
`(OWNER, 2026-09-04)`

**Crisis and short-stay units (MHEC at RPH, MHOA at SCGH) are modelled as wards**, not as a third
kind of place. Admission to one is a real placement. A patient there who needs a longer stay is
referred onward **by that ward** — ward-to-ward referral, which the reducer already permits
(`RAISE_REFERRAL: ["ed", "community", "ward"]`) and which is itself an owner ruling from 2026-09-01.
`(OWNER, 2026-09-04)`

⚠️ **But they stay visible.** A patient placed short-term who still needs a longer-stay bed remains
on the Delays view in their own group. Losing them is how a 72-hour unit quietly becomes a holding
pen. `(OWNER, 2026-09-04)`

## 5. The staging principle — the most useful line in this document

> **Build the lightweight version now; design so the heavy version can be added without rework.**

The owner gave this answer five separate times in different words, and never once asked for the heavy
thing to be built now:

| Now                                               | Later                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| One statewide coordinator                         | Several area coordinators — **design the login to accept area scoping**  |
| Wards type their bed numbers, **staleness shown** | A feed from the hospital system — _he has asked what that would require_ |
| History from this app only                        | Import of past admissions — **the infrastructure must be there**         |
| Advisory matcher, on request                      | Automatic suggestion, and whole-board allocation as a switchable mode    |
| Shared per-location logins                        | Per-person login, Microsoft health-service SSO                           |
| —                                                 | **AI capabilities, once the infrastructure exists**                      |

⚠️ **Do not start authentication, integration or AI.** None of them makes the tool better at the two
jobs, and the owner's chosen path is _"build until it is undeniably better, then approach"_ — no
pilot and no executive pitch yet. `(OWNER, 2026-09-04)`

## 6. Immediate work, item 1 — a mixed locked/open ward cannot be represented

🔴 **This is the only place the app currently gives a _wrong_ clinical answer rather than an
incomplete one, and it goes first.** `(OWNER, 2026-09-04)`

**The defect.** `Unit.security` is `"Open" | "Secure"` for a whole ward — 16 Open, 7 Secure across 23
units. The eligibility gate (`ward-eligibility.ts:123`) reads:

```ts
pass: movement.security === "Open" || unit.security === "Secure";
```

The owner:

> _"Yes they do. For example **Ward 7 in Bentley is a locked/Open ward** so some wards are a
> combination with a number of designated locked beds and open beds."_ `(OWNER, 2026-09-04)`

⚠️ **So a mixed ward recorded as `Open` hides every one of its locked beds from every patient who
needs one.** The gate is asymmetric: an Open patient passes everywhere; a patient needing a locked
bed passes only a wholly-Secure ward. The fixture already flattens Bentley into "BTY Adult Secure".

**The model cannot express "four locked beds, sixteen open, two of the locked are free"** — the
sentence a coordinator actually needs.

### The change

1. **Replace `Unit.security` with locked and open bed counts.** `(OWNER, 2026-09-04)` Not a flag
   _plus_ counts — two sources for one fact will disagree, which is this project's most reliable
   defect. A wholly-open ward simply has zero in one column.
2. **The eligibility gate changes from "is this ward of the right type" to "does this ward have a
   free bed of the right type"** — which is what it should always have asked.
3. **A ward may change its own designations**, as part of editing its bed numbers. No new screen, no
   new concept. `(OWNER, 2026-09-04)`
4. **Splits are synthetic and clearly marked**, replaceable in one place. Real bed designations must
   not be mixed into an invented fixture. `(OWNER, 2026-09-04)`

⚠️ **Keep two facts apart that the owner's phrasing merged.** A _locked bed_ is a property of the
ward; an _involuntary patient_ is a property of the person (`LegalStatus`). A voluntary patient can
be nursed on a locked ward. Count beds by designation; check legal status against it as eligibility.
**Do not create a bed field called "involuntary".**

## 7. Immediate work, item 2 — the Delays view

**Renaming first.** The patient side becomes a **delay**; **blocker** stays for the bed side. Two
different fields are currently both called `blocker` and the code comments flag the confusion twice
as a known hazard. **"Access block" is reserved for its exact ACEM meaning** and never used loosely.
`(OWNER, 2026-09-04)`

### What a delay is

A patient may have **several at once** `(OWNER, 2026-09-04)`, each carrying:

- **A kind, required, from a fixed list** `(OWNER, 2026-09-04)`. ⚠️ **THE NINE BELOW ARE MINE, NOT HIS —
  corrected 2026-09-04 after an audit of this file's own tagging.** He ruled that a fixed list exists and
  that it must be easy to change and extend; **he has never ruled on its membership.** I derived these
  nine from his fixture and from published delay taxonomies, put all nine to him, and **he has asked to
  see them and not yet answered.** So this is an OPEN QUESTION, and until he answers it must not be
  quoted as his:
  no suitable bed in the network · awaiting a ward's answer · awaiting the bed to be ready ·
  awaiting staffing (specialling) · awaiting transport · awaiting medical clearance · awaiting a
  legal form or authority · awaiting funding or an external service · patient or family factors
- **A free-text note, optional.** ⚠️ If the note could stand alone, everyone would use it and nothing
  would ever be countable.
- **Who recorded it** — anyone may record one on any patient, attributed to them. Delay is often
  known by whoever is _not_ holding the patient. `(OWNER, 2026-09-04)`
- **When it started and, once resolved, when it ended.** Cleared delays are kept.
  `(OWNER, 2026-09-04)`

**The kinds must be easy to change and extend** — one named constant, one place, everything derived
from it. `(OWNER, 2026-09-04)`

**System-derived and human-recorded delays coexist and are both shown.** `(OWNER, 2026-09-04)` The
existing `STAGE_TRANSITION_BLOCKERS` sentences become notes on a derived delay carrying one of the
nine kinds. **The system clears only what the system set** — a human's delay is never auto-cleared,
because the app cannot know the interpreter arrived. `(OWNER, 2026-09-04)`

**One entry per kind per journey**; a second occurrence updates the first, so a heading counting
people cannot silently double-count. `(OWNER, 2026-09-04)`

**Author or coordinator may remove one, and removal is recorded, never erased.** `(OWNER, 2026-09-04)`

### The clock

⚠️ **SETTLED 2026-09-04, LATER THE SAME DAY, AND IT REPLACES WHAT THIS SECTION SAID FIRST.** The
owner was explicit that this matters:

> _"There is two wait times. When a patient is referred, and how long a patient is waiting in ED.
> The main one used is WAITING IN ED. The time waiting in ED for a bed is the main one. This only
> begins when they arrive in ED or are referred in ED. When a community patient is referred to ED,
> the wait for a bed only begins when they arrive in ED. This is because many times it takes days
> for patients to arrive."_ `(OWNER, 2026-09-04)`

**So there are two clocks and they are not interchangeable:**

| Clock                       | Starts                                                                                                           | Standing                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Waiting in ED for a bed** | When the patient **physically arrives** in the emergency department — or at referral, if they were already in it | **The headline number.** `(OWNER, 2026-09-04)` |
| Time since referred         | When the referral was raised                                                                                     | Secondary, shown beside it                     |

⚠️ **A community referral to an ED does NOT start the ED clock.** Days may pass between the referral
and the arrival, and counting them as an ED wait would overstate it by days — on the headline number
of the main view, in the direction that causes harm, because it makes a person look more urgent than
they are and pushes a genuinely urgent one down the list. `(OWNER, 2026-09-04)`

**What the code already holds, verified 2026-09-04 rather than recalled.** The model keeps these two
clocks apart already: `Movement.openedAt` is the department clock (`ED_ACCESS_TARGET_MINUTES`'s own
comment calls it "how long the patient has been in the department"), `Movement.referredAt` is when
units were referred, and `Movement.formedAt` carries a note saying "the legal clock and the
department clock are different clocks". So this ruling confirms an existing distinction rather than
introducing one.

🔴 **But there is a defect waiting, and it arrives with this spec's own community pathway.**
`RAISE_REFERRAL` stamps `openedAt: event.now` at the moment the journey is raised. Today that equals
arrival, because a journey can only be raised at a department the patient is already in. **Once a
community team can raise a journey directly, `openedAt` stops meaning arrival** — and the ED wait
would read from the referral instead. **The Delays view must read an arrival instant, not
`openedAt`,** and the community pathway must supply one.

⚠️ **PARKED, SEPARATELY: when the ACEM access-block clock starts.** I proposed medical clearance. The owner rejected
the premise:

> _"sometimes ED doctors refer patients prior to medical clearance."_ `(OWNER, 2026-09-04)`

Referral and clearance have **no fixed order**, so no single event reliably marks "ready for the next
step". **Until this is settled: show total wait, and do not label anything "access block".** Quoting
a published standard against the wrong start time is worse than not quoting it. **Design the clock
start as changeable.**

### The view

- **Two sections on one page, ward names linked across both** — people waiting for a bed above,
  wards whose beds are not freeing below. Seeing the same ward in both halves is where cause and
  effect become visible, and it is what makes this a _bed-flow_ view rather than a referral view.
  `(OWNER, 2026-09-04)`
- **A list of people**, grouped by their longest-running delay, others shown on the row. ⚠️ **Group
  headings count people and must say so.** `(OWNER, 2026-09-04)`
- **Sorted by total wait, longest first — except an expiring legal authority, pulled to the top and
  marked.** A Form 1A running out in two hours outranks a longer wait with no clock, because one
  becomes unlawful. `(OWNER, 2026-09-04)`
- **No invented threshold.** Sort and shade by duration. The ACEM eight-hour access-block point may
  be marked, named as ACEM's, once the clock start is settled. `(OWNER, 2026-09-04)`
- **Live journeys only**, with finished ones reachable separately. `(OWNER, 2026-09-04)`
- **Its own route, and it prints.** `(OWNER, 2026-09-04)`
- **The note is visible to the coordinator and its author; wards see the kind only.**
  `(OWNER, 2026-09-04)` The kind is operationally necessary; the note is where clinical and
  identifying detail will land, and privacy cannot be retrofitted onto free text.

**First cut:** the nine kinds, the clock, the two-section view, print. The resolved-delay trail and
the cross-links follow. `(OWNER, 2026-09-04)`

## 8. The matcher — designed here, built after the two items above

**Factors, all four:** clinical fit and legal authority; distance from home and family; how long they
have waited plus the legal clock; continuity — known to that service. `(OWNER, 2026-09-04)`

🔴 **It shows the tension rather than resolving it.** Best-for-this-patient and best-for-the-board are
computed separately and shown **side by side, with the reason, only when they differ**; one answer
when they agree. `(OWNER, 2026-09-04)` A single ranked list cannot express this.

**Every suggestion:** shows its reasoning in clinical terms, sits beside alternatives, and takes a
deliberate act to accept — never pre-filled. `(OWNER, 2026-09-04)`

> ⚠️ **"Show the reasoning" constrains what the matcher may use.** Every factor must be explainable
> in one sentence. A weighting nobody can articulate is not permitted — **even in the later AI
> phase**. The explanation is not a feature; it is the safeguard against a tired coordinator
> accepting at 3am.

**On request now; automatic later, always with the option to select another or search for others.**
**The top few are shown**, with every other ward reachable by search — which is how this sits with
the owner's standing ruling that no ward may be filtered from view without a verdict.
`(OWNER, 2026-09-04)`

**Per patient now; whole-board allocation later**, as a switchable mode. `(OWNER, 2026-09-04)`

**Overrides are recorded and used to improve the matcher.** `(OWNER, 2026-09-04)` This is the concrete
answer to _"what infrastructure must exist before AI"_ — start collecting human corrections now,
because it is cheap today and impossible to backfill.

**Distance is a weighting plus a visible warning, never a refusal.** When there is one bed in the
state, distance is not a choice anyone has, and a gate that is overridden every time trains people to
override.

## 9. The bed picture — designed, built after Delays

- Wards type their own numbers, **inline**, on the board they already look at.
- **Staleness is displayed age, never withdrawal** — "Karri: 2 free, updated 4 hours ago". No
  cut-off; a cut-off is an invented threshold.
- **A ward that has not updated shows its last number, greyed, with the time it last updated — plus
  an affordance for the coordinator to request an update**, which flags on that ward.
  `(OWNER, 2026-09-04)`
- **A bed figure means "you can fill today", everywhere.** The empty count is context, never the
  headline. Two screens currently disagree on this for the same number. `(OWNER, 2026-09-04)`
- **A coordinator may correct a ward's number, attributed** — visibly not the ward's own claim.
- **Counts break down by sex and by locked/open** (see §6). Cohort, sex mix, specialling capacity and
  authorised-hospital status already exist on the model.

**Each ward page gains a notifications section**, easy to see, carrying everything that ward must
respond to — and **it clears by acting, never by dismissing.** `(OWNER, 2026-09-04)` A ward sees what
needs its answer before its own beds.

## 10. Standing rules

- 🔴 **Simple must not mean reduced.** _"ensure the actual functionality is not reduced and the
  design and style is not impacted. It still must be visually appealing and very functional."_
  `(OWNER, 2026-09-04)` The target is a dense, capable, good-looking tool that happens to be obvious.
  **"Design for a stranger" must never become "design for a beginner".**
- **A ward's three routine acts — answer a referral, update beds, record a delay — must work cold,
  with no training, at 3am.** The coordinator's actions may assume familiarity. `(OWNER, 2026-09-04)`
- **All synthetic data must be easy to go back and change later** — one place per value, marked as
  invented, replaceable without touching logic. `(OWNER, 2026-09-04)`
- **Statistics is for tracking performance loosely and seeing where the deficits are**, as well as
  for the coordinator asking whether today is unusual. `(OWNER, 2026-09-04)` It is not a formal
  reporting product, and no number on it should imply an audited figure.
- **History is kept seven years**, longer for under-18s, and a past state must be reconstructable —
  that is what answers a coroner. Coordinator-only at first. `(OWNER, 2026-09-04)`

## 11. Open, and who owns each

| Item                                           | Owner                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| When the access-block clock starts             | Product owner — parked, see §7                                                                           |
| **Sex versus gender identity in bed matching** | **A clinician with specific expertise. Not a design task.** `(OWNER, 2026-09-04)`                        |
| **Aboriginal cultural safety review**          | **Aboriginal health practitioners. A hard gate before any real-patient use.**                            |
| Hosting, and therefore single sign-on          | Undecided; **must remain possible** — flag any choice that would prevent hosting inside a health network |
| Retention, if a host has its own policy        | Whoever holds the data                                                                                   |
| Three rendered "not a medical device" claims   | Product owner — a governance decision, see below                                                         |
| What a webPAS feed would require               | **Owed by me**                                                                                           |
| When the app is hardest to use                 | **Owed by me** — the owner was unsure and asked me to work it out                                        |

### The rendered "not a medical device" claims

Three screens tell a clinician the app is not a medical device **and support that claim with a
promise about what it will never do** — never allocates, never ranks units by suitability, never
ranks a ward the patient does not fit. The withdrawal of `spec D4` reached four code comments and
**none of the rendered copy**.

⚠️ **This is a governance decision, not a wording defect.** A statement of regulatory status,
addressed to a psychiatrist, resting on a universal about future behaviour that is about to stop
being true. The other twelve such claims in the app rest on facts anyone can check.

**One of the three reads differently to me** — `ward-management-modes.tsx:901` says the app _"never
assesses a patient's risk, acuity or treatment. A human coordinator confirms or overrides every
suggestion."_ Both halves survive everything decided here, and it already acknowledges suggestions.
**Worth checking before changing three things when two are wrong.**

---

## What I got wrong in this session, recorded because the pattern matters more than the errors

- I told the owner blockers existed only on discharges. **They exist on every movement**, are derived
  at each stage transition, and are guarded by a test. The work was finishing an idea, not having one.
- I told him a stylesheet was unused and its retention was his call. **Three files reference it**,
  including the component whose layout was built from it, and a test refuses its removal. Ward Lead
  made the same error independently and recommended deletion; the owner agreed. **"Does anything
  import this" answers a narrower question than "is it safe to delete".**
- I advised against any time threshold as "a target in disguise" — **while Australia already had one**
  (ACEM's eight-hour access block, published and clinician-owned). An inferred house rule had become
  my own assumption.
- I classified the rules register by whether a rule cites an owner decision. **That test is wrong in
  both directions** and the counts derived from it are unreliable; the eleven individual findings
  stand on positive evidence, the totals do not.
