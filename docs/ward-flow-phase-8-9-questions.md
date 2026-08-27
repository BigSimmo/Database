# Ward Flow Phases 8 and 9 — what is settled, and what still needs an answer

**Written 2026-08-28**, while Phase 7 is still being built. This is the document that has to exist
before Phases 8 and 9 can be specified: it separates what the product owner has already decided
from what genuinely still needs him, so that nothing settled gets re-argued and nothing unsettled
gets quietly guessed.

It is **not a specification and not a plan**. It carries no design of its own. Every question below
is written to be answerable by someone who knows how psychiatric bed flow works and nothing about
how software is built. If a question cannot be answered without learning a technical idea first,
that is a fault in the question and it should be rewritten, not answered.

Same reason as its predecessor, `docs/ward-flow-phase-6-7-decisions.md`: the recurring failure in
this project is a decision that lived only in a conversation and was then re-derived, or
contradicted, by a later session.

---

## Read this first: the foundation underneath both phases is still unchecked

`predicted → confirmed → blocked → released` — the four stages a bed passes through as it comes
free — has still never been put to a ward clinician. The one-page summary that asks him is written
and waiting to go out (`docs/ward-flow-clinician-check.md`). Phases 6 and 7 are built on top of it.
Phases 8 and 9 build further.

**How much would have to change if it is wrong:**

- **Phase 8 — almost nothing, if it is designed the way Phase 7 was.** Phase 7 protected itself by
  never once asking what stage a bed is in; it asks only "is there a bed free in this unit right
  now". Every Phase 8 feature — closest suitable bed, the country pathway, the out-of-area ledger,
  the network diagram — can be built on that same question. **This should be written into the Phase
  8 specification as a rule, not left as a hope**, because it is what keeps the model cheap to
  correct.
- **Phase 9 — one feature is badly exposed, and the rest are not.** The **ward prediction track
  record** ("how often does what this ward predicted actually happen") only makes sense because
  "predicted" exists as a stage. If it turns out that "predicted" is really three different things a
  charge nurse would keep apart, that feature is redesigned, not relabelled. Waiting-time equity,
  ownership clocks, escalation tiers, handover continuity, notifications and the navigation
  regrouping are all untouched by the answer.

**Recommendation:** the ward prediction track record is scheduled last in Phase 9, or held until the
clinician check comes back. Everything else in both phases proceeds regardless.

---

## The distance trap — the hazard specific to Phase 8

Roadmap decision 11 settled that distance is **travel-time bands plus kilometres** — under an hour,
one to three hours, three hours or more, air transport only — because "three hours from home" is a
fact a clinician can weigh and "247 km" is not.

Phase 8 is full of chances to reintroduce a raw number, or a raw ranking, as the thing people
actually act on. **This has already happened once, before any distance work existed.** A whole-branch
review found a screen headed "Nearest candidates" offering a patient sitting in Sir Charles
Gairdner's own emergency department a Royal Perth bed first and their own hospital's bed second. The
list was in no order at all — it was simply the order the hospitals appear in the table — and
nothing in the system knew where anything was. The word "nearest" was doing work the software could
not back.

Two more traces of the same pressure are on screen today: a bed can be declined for being "out of
catchment" when the system holds no catchment for anyone, and a candidate bed carries a label
reading "Best" that is really about which health service the patient's emergency department belongs
to.

**The rule Phase 8 needs:** any word implying proximity — nearest, closest, local, far, best — must
be backed by a fact the system actually holds, and the thing on screen should be the band, not the
number. A kilometre figure may sit beside a band; it may never be the thing that orders a list or
labels a bed.

---

## 1. What is already settled

Decided by the product owner on 2026-08-26 and 2026-08-27. **These are closed. Record them and move
on.** The reason travels with each one, because a refusal with no reason attached gets reversed by
the next person who finds it inconvenient.

| #                  | Settled                                                                                                                                                                                                                                          | Why                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roadmap 11         | **Distance is travel-time bands plus kilometres** — under an hour · one to three hours · three or more · air transport only                                                                                                                      | "Three hours from home" is weighable; "247 km" is not, and "regional" says nothing about whether family can visit                                         |
| Roadmap 10         | **Escalation tiers are declared by a human**, never triggered automatically by a threshold. Any indicator numbers shown alongside are synthetic and labelled as such                                                                             | A system that declares a statewide surge off an invented number is one that gets quoted back at you in a meeting                                          |
| Roadmap 9          | **Notifications are in-app plus a simulated outbound log** showing exactly what would be sent, with nothing ever sending. Content limited to the movement identifier and what needs doing                                                        | Shows the mechanism without any possibility of a real message reaching a real person                                                                      |
| Roadmap 12         | **Sites stay synthetic.** Real WA town names may be used for geography and distance only                                                                                                                                                         | A prototype that quietly asserts wrong facts about a real hospital is unrecoverable; swapping a synthetic site table for a real one later is a day's work |
| _(narrowed 08-27)_ | A **real unit name supplied by the owner** is a fact he holds, not one the prototype invented — the youth unit at Bentley is used verbatim                                                                                                       | Describing a real service correctly beats inventing a fictional one; the bed numbers in it stay invented like every other number                          |
| Roadmap 14         | **The network diagram stays**, and earns its place by becoming functional: clickable navigation, line weight by flow, an overlay of which sites can take this patient, roughly geographic layout, a time control, and country sites on it at all | It orients people and makes the prototype navigable                                                                                                       |
| Roadmap 16         | **The statutory clock board is not built** and will not be until the owner supplies the legal figures — and not a version with blanks                                                                                                            | Blanks invite someone to fill them in from memory                                                                                                         |
| Roadmap 8          | **An owner is always a role, never a person** — "Royal Perth emergency department", "Bunbury ward"                                                                                                                                               | Matches handover, survives shift changes with no reassignment, keeps staff names out. Accountability comes from the role carrying a visible clock         |
| Roadmap 5          | Cohort is a **requirement on the request** ("this request needs an adolescent bed"), never a fact stored about a person                                                                                                                          | The word never attaches to a patient                                                                                                                      |
| Roadmap 13         | The morning page is **fixed and not configurable** — one printable page, the same figures everywhere                                                                                                                                             | The moment two services can arrange it differently they quote different numbers at each other                                                             |
| Roadmap 4          | **Predictive community demand is out**                                                                                                                                                                                                           | "This team requests a bed today" is concrete; "this team thinks someone might deteriorate" is a different product                                         |
| Phase 7 spec       | **Matching shows candidates; a human decides.** No suitability ranking, no single recommended bed                                                                                                                                                | A tool that shows candidates and one that recommends are different products, and the second one needs to be right                                         |
| Phase 7 spec       | **Matching never asks what stage a bed is in** — only whether a bed is free now                                                                                                                                                                  | It is what keeps the front door independent of the unvalidated four-stage model                                                                           |
| Phase 7 spec       | **A referral carries four facts about a person and nothing else, ever** — age band, sex, whether a secure bed is needed, whether a bed that can hold someone involuntarily is needed                                                             | No name, date of birth, record number, address, diagnosis, history, treatment, or free text anywhere                                                      |
| Sixty-second tour  | **Built** in Phase 6. Not outstanding                                                                                                                                                                                                            | —                                                                                                                                                         |

### Where the six "additional items agreed" belong

| Item                                         | Phase                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1. Ward prediction track record              | **Phase 9**, scheduled last — the one item exposed to the unvalidated four-stage model                                 |
| 2. "Why not here?" across the whole state    | **Phase 8** — it needs every site including the country ones, and "too far" is often the reason                        |
| 3. A sixty-second guided tour                | **Already done** (Phase 6)                                                                                             |
| 4. Out-of-area ledger                        | **Phase 8** — the roadmap already places it there                                                                      |
| 5. "Waiting since" at the front of the queue | **Phase 9** — it is question P9-1 below, and it is not as small as it looks                                            |
| 6. Named moments on the demo clock           | **Phase 9**, beside the retrospective view — both are "show me a particular moment". Mostly naming what already exists |

---

## 2. Phase 8 — Distance and the state

Six questions, hardest first.

### P8-1. Distance from where? Does the system need to know where a person comes from?

Everything in Phase 8 measures a distance from something. Right now the system knows only which
hospital a person is physically sitting in. It does not know where they live, and it has never held
anything of that kind about anybody.

This is the largest question in either phase, because "far from home" is the whole point of the
out-of-area ledger, and because saying yes means one more fact about a person enters a system that
has spent five phases keeping them out.

**It must be answered before design, not during**, for two reasons. If the answer is yes, the
referral being built this week has to carry it, and that is far cheaper to add now than to retrofit.
And if the answer is no, the out-of-area ledger has to be renamed, because it would be measuring
distance from a hospital rather than from home.

| Option                                                                                  | What it means in practice                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Don't record home at all.** Measure from the hospital the referral came from       | Nothing new is held about anyone. But for someone brought into a city emergency department from four hours away, the system would call a city bed "close" — and the out-of-area ledger becomes a count of people far from the hospital they passed through, which is a weaker and slightly dishonest measure |
| **B. Record home as a broad region** — North Metro, East Metro, South Metro, or country | The same coarse grouping already shown on every screen. Too broad to point at any individual. "Out of area" then means placed outside their own region, and the ledger is honest                                                                                                                             |
| **C. Record home as the nearest hospital in the table** — "closest to Broome"           | More precise, more useful for travel time, and still not an address. But it is noticeably closer to identifying someone in a small town                                                                                                                                                                      |
| **D. Record home as a town name**                                                       | The most useful and the most identifying. In a town of 1,200, a town plus an age band plus a sex is close to a person                                                                                                                                                                                        |

**Recommendation: B.** It is the coarsest thing that makes "far from home" an honest phrase, it uses
a grouping already on every screen, and it never narrows to a place small enough to point at a
person. It is worth saying plainly that this **widens the permitted list of facts about a person for
the first time** — that is a decision only you can take, not one the design should make on your
behalf.

_(Related and worth knowing: a bed can already be declined today for being "out of catchment", which
is a reason referring to something the system does not hold. Whichever way this is answered, that
inconsistency gets fixed in Phase 8.)_

### P8-2. When the only bed is three hours away, does distance change the order of the list?

The list of beds that could take a person is currently shown in a fixed hospital order and
deliberately not ranked by how good a match each one is — a decision already taken, so that the
screen offers candidates rather than a recommendation.

Distance is the first thing that will push against that.

| Option                                                                                                      | What it means in practice                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Show the travel-time band beside each bed; change no ordering at all**                                 | The coordinator does the comparing. Honest, and completely consistent with the existing rule. On a long list it makes them work harder than they should have to |
| **B. Group the list by travel-time band** — everything under an hour, then one to three hours, then further | Distance shapes the list without ever naming a single "best" bed. A far bed is never hidden, only further down                                                  |
| **C. Sort strictly by travel time, nearest first**                                                          | Closest to what people expect. It also quietly turns a distance into a ranking, which is exactly how "Nearest candidates" went wrong once already               |

**Recommendation: B.** Grouping says what a coordinator needs to know — how many options are close,
how many are not — without producing a single recommended answer or a number people start quoting.
A far bed stays visible and stays choosable.

### P8-3. What counts as "out of area", and when does that clock start?

The out-of-area ledger is "how many people are currently in a bed far from home, and for how long".
Both halves need a definition.

**Where the line sits:**

| Option                                                 | What it means in practice                                                                                                                                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Placed outside their own health service region**  | Matches the administrative boundaries a service is actually answerable for. Weak in the country, where a single region covers most of the state — Kununurra to Broome would not count as out of area |
| **B. Three hours or more away, or air transport only** | One rule that behaves the same everywhere in the state. It does not depend on region boundaries meaning different things in the city and the country                                                 |
| **C. Both, counted as two separate figures**           | More informative and directly against the standing decision that this prototype produces one agreed number rather than several people can arrange differently                                        |

**Recommendation: B.**

**When the clock starts:** from the moment the person arrives in the far bed, not from when they
first started waiting. The ledger is about how long someone has been away from home, not how long
their admission took.

### P8-4. Air transport — how much of it does the prototype model?

Roadmap decision 11 already names "air transport only" as a travel-time band, so the concept is in.
The question is whether it goes further.

| Option                                                                                    | What it means in practice                                                                                                      |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **A. A band and nothing more.** A bed is marked as reachable only by air, and that is all | Cheapest. The screen tells the truth and stops there. Says nothing about how anyone actually gets there                        |
| **B. A band, plus road-or-air recorded on the transport job**                             | The transport officer's screen can show an air job differently from a road one. Still no claim about who flies or who approves |
| **C. A full air pathway** — who requests it, who authorises it, what waits on what        | Needs facts we do not have. See section 3                                                                                      |

**Recommendation: B** — but only if section 3's question about how patients actually move around
Western Australia comes back with enough to make an air job look different from a road one in a way
that is true. If it does not, **A**, and no more.

### P8-5. The network diagram — what is its main job when the six things it must do compete?

Roadmap decision 14 already committed to six additions: clickable navigation, line weight by flow,
an overlay showing which sites can take the selected patient, a roughly geographic layout, a time
control, and country sites present at all. That is settled and not reopened.

What is not settled is which of them wins when they fight for the same picture. A map laid out
roughly like Western Australia puts five country sites around the edge of a very large empty middle
and squashes eleven metro sites into one corner — that is what the state looks like, and it is not
what a pressure map wants to look like.

| Option                                                                                                                       | What it means in practice                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **A. It is a map first.** Geography wins; pressure and flow are drawn on top of it                                           | Distance is instantly readable. The metro corner gets crowded, and probably needs its own zoomed panel                          |
| **B. It is a pressure picture first.** Sites are arranged for legibility, distance is labelled                               | Every site gets equal room. "Roughly geographic" becomes "grouped by region", which is less than the roadmap promised           |
| **C. It is a placement tool first.** Pick a patient, see which sites can take them, how far each is, and why the rest cannot | Directly useful, and it is also the "why not here across the state" item. The whole-network overview becomes the secondary mode |

**Recommendation: C, with A's geography inside it.** The diagram's most defensible reason to exist
is answering "where can this person go, and what would it cost them" — which is also the answer to
"why not here?". A picture that only orients is a wall chart; a picture that answers a real question
gets used.

### P8-6. Does a country referral follow the same path, or a different one?

Today every referral follows the same stages regardless of where it comes from. Phase 8 adds five
country hospitals to that.

| Option                                                                                                                           | What it means in practice                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **A. Same path, distance shown.** A country referral is a metro referral with further to travel                                  | Simplest, and consistent. Assumes nothing extra actually happens                                          |
| **B. Same path, with one extra recorded decision** — that a local bed was sought and none was suitable, before the search widens | Makes visible the thing the out-of-area ledger is really about: whether someone had to leave their region |
| **C. A genuinely different path**                                                                                                | Only worth building if it is true. See section 3                                                          |

**Recommendation: B**, subject to section 3. It costs one recorded step and it is the difference
between a ledger that counts distance and one that shows whether a nearer option was ever available.

---

## 3. Questions that need a fact neither of us has

**These must not be answered by guessing.** Each one is either a real-world fact about how Western
Australia works, or a clinical or legal fact. Where the answer is unknown, the honest move is to
build the smaller version that asserts nothing, not to invent a plausible-looking answer.

1. **How do psychiatric patients actually move around Western Australia by air?** Who flies them,
   who decides, what the alternatives are, roughly how long it takes, and whether it is routine or
   exceptional. Phase 8's air transport work (P8-4) and the country pathway (P8-6) both sit on top
   of this. **Nothing about air transport beyond a travel-time band should be designed until this is
   answered.**
2. **Does a country service look for a local bed first, or is a bed sought across the state from the
   start?** And is there any expectation that a person placed away from their region is brought back
   when a nearer bed frees up? P8-6 and the out-of-area ledger both change shape depending on the
   answer.
3. **Are there named escalation levels in use for mental health bed pressure in WA?** This matters
   twice over. If real named levels exist, using their names is asserting something real about a
   real system, which roadmap decision 12's reasoning says we do not do without your say-so. If they
   do not exist, whatever we call them must be visibly invented. Question P9-2 cannot be answered
   without this.
4. **Is "out of area" already a defined term with a defined threshold in WA mental health?** If it
   is, P8-3 is not ours to choose — we adopt it. If it is not, we are inventing a threshold and the
   screen must say so.
5. **The four-stage model of a bed coming free** — the clinician check that is still owed. See the
   top of this document.
6. **Which travel-time band each country hospital falls into.** These are real-world geography facts
   that will be read as facts, because real town names are permitted for exactly this purpose. They
   should be checked rather than estimated from a map by whoever writes the specification.

None of these is answered anywhere in this document, and none should be answered by inference from
the options offered in section 2. If a question in section 2 appears to assume one of these, that is
a defect in the question.

---

## 4. Phase 9 — Daily use and trust

Seven questions, hardest first.

### P9-1. Does a long wait ever move someone ahead of a more urgent person?

Today the queue is ordered by urgency first. Within a single urgency level, how long someone has
been waiting is the main thing that moves them up, and it stops counting after about ten hours — a
twenty-hour wait and a ten-hour wait score the same.

The roadmap item says "waiting since" carries the moral weight and is currently secondary. That is a
real observation, and there are three quite different things it could mean.

| Option                                                                                                       | What it means in practice                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Show the wait far more prominently, change no ordering**                                                | The queue is unchanged; the length of wait is the first thing on every row instead of a detail. Costs nothing and changes no clinical judgement |
| **B. Also remove the ceiling**, so a very long wait keeps climbing — but still only within its urgency level | Someone waiting twenty hours outranks someone waiting ten. A more urgent person is still always ahead                                           |
| **C. Let a long enough wait lift someone above a more urgent person who has only just arrived**              | The software starts overriding a clinician's urgency judgement. It is the only option that genuinely changes who gets the next bed              |

**Recommendation: A and B together.** A wait that stops mattering after ten hours is the actual
defect, and removing the ceiling fixes it without the software ever second-guessing an urgency
rating. **C is yours alone to authorise** — it is a different product, and it should not be built
because it seemed like the natural next step.

### P9-2. What are the escalation tiers, and what does declaring one actually do?

It is settled that a human declares escalation and that the numbers shown beside it are synthetic
and labelled as such. What is not settled is what the levels are, and what changes on screen when
one is declared.

**The first half of this cannot be answered until section 3 question 3 is answered.** The second
half can:

| Option                                                                                   | What it means in practice                                                                                                  |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **A. Declaring escalation records it and marks the screens, and nothing else changes**   | Honest and small. Everyone can see the state was declared, by which role and when                                          |
| **B. It also relaxes something** — for example, beds normally kept back become offerable | Makes the declaration mean something operationally. Requires knowing what a real service actually relaxes, which we do not |
| **C. It also opens a checklist** of what should now be happening                         | Useful, and it is a claim about correct practice that would need to come from you rather than from us                      |

**Recommendation: A** until section 3 comes back. It is the version that asserts nothing.

Whether escalation is declared **per site or once for the whole state** is part of this question, and
the answer to that one can come from you directly — it is an operational fact, not a design choice.

### P9-3. What should the retrospective view show?

"The retrospective view" is one line in the roadmap and could be four different screens.

| Option                                                                            | What it means in practice                                                                                                                                                                          |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Yesterday's morning page**, beside today's                                   | Direct comparison, and the thing most people mean by "how are we doing". It also produces the trend figures that the fixed morning page was deliberately kept free of                              |
| **B. One person's whole journey, replayed** — every step and how long each took   | Answers the question a coordinator actually asks after something has gone badly. Contains no new facts about anyone                                                                                |
| **C. Service-level statistics for the week**                                      | Closest to performance reporting on invented numbers, which is the exact thing the escalation decision warns against                                                                               |
| **D. Ward prediction track record** — how often each ward's predictions came true | Has the clearest purpose of the four, and gives wards a reason to keep the board accurate that no amount of nagging will. It is also the one item that depends on the unvalidated four-stage model |

**Recommendation: B and D.** B is what people actually reach for; D is the item you already agreed
to and is worth its own slot. **A** is worth having eventually and should be its own decision,
because it puts a trend next to a page whose whole purpose is holding still. **C** should not be
built.

**One thing to know:** the prototype has no memory. The demo clock can be moved forward and reset,
but nothing is stored from one run to the next. Any retrospective view needs that memory built
first, and that is real work rather than a screen.

### P9-4. What does an owner's clock measure, and what happens when it runs long?

It is settled that every movement is owned by a role, never a person, and that accountability comes
from the role carrying a visible clock. The clock could be counting three different things.

| Option                                                                         | What it means in practice                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **A. Time since this role took it on**                                         | Simple, and it answers "how long has this sat with them"                                                      |
| **B. Time since anything at all happened**                                     | Catches a movement everyone has forgotten, including one nobody ever took on                                  |
| **C. Time since this role was asked to do something specific and has not yet** | The most meaningful and the only one that says what is actually owed. Needs the asking to be a recorded thing |

**Recommendation: C where there is a specific ask, falling back to A.** A clock that measures "time
since something was asked and not done" is the one that makes a handover conversation shorter.

**And an absolute limit on it:** if a clock changes colour when it runs long, the point at which it
does is invented and must never be presented as a standard, a target, or anything with legal weight.
This is the screen most likely to accidentally look like a statutory deadline board, which is
precisely the thing not being built.

### P9-5. Which events send a notification?

The mechanism is settled: in-app plus a simulated outbound log showing exactly what would be sent,
with nothing ever sending, and content limited to the movement identifier and what needs doing. What
is open is when one fires.

| Option                                                                                                                                        | What it means in practice                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **A. Only where someone is waiting on someone else** — a bed offered, a bed accepted or declined, a held bed about to lapse, transport booked | Four or five a shift. Each one has a person on the other end who needs to act |
| **B. Every change of state**                                                                                                                  | Complete, and ignored within a day                                            |
| **C. Only when a role is explicitly asked for something**                                                                                     | The tightest version, and it depends on P9-4 option C being taken             |

**Recommendation: A.** A notification list nobody reads is worse than no list, because it looks like
communication happened.

### P9-6. What should carry across a shift change?

The handover page currently freezes a picture of the moment. Continuity means deciding what survives
into the next shift.

| Option                                                                      | What it means in practice                                                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **A. Nothing carries.** Each shift takes a fresh picture                    | What happens today. Something raised at the morning handover can be silently gone by the evening one with nobody noticing |
| **B. Anything flagged at a handover stays flagged until someone clears it** | The thing raised at 08:00 is still on the list at 20:00 unless it was actually dealt with                                 |
| **C. The last handover shown side by side with what is true now**           | The most informative, and it needs the stored memory that P9-3 also needs                                                 |

**Recommendation: B.** It is the smallest change that makes "continuity" mean something, and it does
not depend on new machinery.

### P9-7. How should the screens be grouped?

There are seventeen screens today and there will be more than twenty after Phases 7 and 8. The
current grouping — the coordinator's own boards, then role screens, then shared boards — was never
designed, it accumulated.

| Option                                                                                                    | What it means in practice                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. By who you are** — coordinator, ward, emergency department, transport, community team                | Matches how the hub is described: each contributor needs a real screen. Anyone arriving only ever wears one hat, except the coordinator, whose section stays large |
| **B. By what you are asking** — "where is there a bed", "who is stuck", "what happened", "what is coming" | Matches how a coordinator thinks during a shift rather than what their job title is                                                                                |
| **C. Leave it and just tidy the labels**                                                                  | Cheapest, and it does not solve the problem that arrives with twenty-plus screens                                                                                  |

**Recommendation: A.** The hub's own description is that each role needs a real screen to contribute
what only they know; grouping the navigation the same way makes the product explain itself. **B** is
the better fit for the coordinator alone, which is an argument for their section being organised that
way inside **A**.

---

## 5. What each phase depends on

**Phase 8 depends on:**

- **P8-1, and it depends on it early.** If home is recorded, the referral record being built this
  week gains a field and the structural privacy check that guards that record widens with it. That
  is cheap now and awkward later.
- **Section 3 questions 1, 2, 4 and 6** for the air transport, country pathway, out-of-area
  threshold and travel-band work respectively. Each has a smaller version that asserts nothing and
  can be built while waiting.
- **Nothing in the unvalidated four-stage model** — provided the Phase 8 specification carries the
  same rule Phase 7 did: ask only whether a bed is free now, never what stage it is in.

**Phase 9 depends on Phase 7, which is being built right now and has already changed shape twice.**
This is worth stating plainly rather than discovering later. Phase 7 gained a fourth referral field
mid-build once the matching was written, and picked up a demand figure on the morning page as a late
addition. Both were right calls. Both also mean the referral queue's final shape is not yet fixed —
and waiting-time equity, ownership clocks, notifications and the escalation board all attach to that
queue.

**Recommendation: do not write Phase 9's specification in detail until Phase 7's referral board and
its list of outcomes are finished.** Design the conversation now; commit the detail after.

**Phase 9 also needs something the prototype does not have.** Both the retrospective view (P9-3) and
the fuller version of handover continuity (P9-6) require the prototype to remember anything at all
across a reset. It currently does not. That is a distinct piece of work and should be scoped as its
own item, not assumed into a screen.

**Phase 9 touches Phase 8 in one place.** If the out-of-area ledger is where geographic fairness
lives, and waiting-time equity is where time-based fairness lives, those are two halves of one idea
and should at least be designed knowing about each other — even if they ship in different phases.

---

## 6. The standing constraints that bind both phases

Restated in full, because they are the ones most easily forgotten in a phase about geography and a
phase about daily operational use.

- **Never invent a legal figure.** No figure, timeframe, threshold or duration from the Mental Health
  Act may appear anywhere — not in code, copy, comment, test or example data. A plain
  Voluntary/Involuntary label **is permitted and is not a legal figure**. If a figure is needed, stop
  and ask. Phase 9's ownership clocks are the highest-risk surface either phase contains: a red
  countdown at an invented threshold, on a screen full of legal-sounding language, is exactly the
  thing the unbuilt statutory clock board exists to refuse.
- **Synthetic data only.** No name, date of birth, medical record number, address, diagnosis,
  narrative history or treatment. Free text counts as data.
- **A referral carries four facts about a person and no others** — age band, sex, whether a secure
  bed is needed, whether a bed that can hold someone involuntarily is needed. Widening that list is a
  governance decision the product owner takes, never an implementation convenience. **P8-1 is
  precisely such a decision** and is put to him as one.
- **Local and offline checks only.** Nothing touching a live service, a hosted system or a real
  database.
- **The prototype is a sandbox.** It is reachable only through the developer hub, and the developer
  hub is the only link out of it. Anything shown to a colleague is shown live or printed, never as a
  link they can open themselves.

---

## Where this goes next

When these questions are answered, the answers belong in a decisions document of the same shape as
`docs/ward-flow-phase-6-7-decisions.md` — recorded with who decided and when — and then each phase
gets its own written specification, with the two designed in one conversation as the roadmap
instructs.

Anything answered in conversation and not written down will be re-derived or contradicted. That is
the whole reason this file exists.
