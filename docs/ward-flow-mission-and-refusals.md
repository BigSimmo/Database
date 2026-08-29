# Ward Flow — what it is, and what it deliberately does not do

**Draft, 2026-08-29.** The mission statement below is written for the owner to correct, not to be
adopted as written. The refusal register beneath it is a reorganisation of decisions he has already
made — no refusal here is new, and none has been strengthened or weakened in the move.

**Why this exists now.** The owner has a route into the Western Australian health service's
psychiatric bed flow, and the three-month goal is a completed, functional demonstration on mock data.
Both facts change what these documents have to be. A health service reading this needs to know which
constraints are safety commitments that would survive into a real system, and which are true only
because this is a prototype. Mixed together, they will either build something the owner would object
to, or leave out something he always intended.

---

## Mission statement — APPROVED FRAME, 2026-08-29

The owner chose the argument (the current state, stated plainly) and the register: **"working
demonstration, but prototype flexibility"** — take it seriously, and nothing in it is settled.

> **There is no system. There is a telephone, an inbox, and goodwill.**
>
> A patient waits in an emergency department while referrals go out by email. Wards answer one at a
> time, or not at all. Nobody can see where anyone is, how long they have waited, or which beds are
> about to come free. Each service makes its own plan and none of them can see the others. The
> patient sits, the department fills, and the delay belongs to nobody.
>
> **Ward Flow is a working demonstration of what could replace it** — a statewide hub for psychiatric
> bed flow in Western Australia. **Its one job is getting a person from an emergency department to a
> ward.** It follows them from a community team's decision to admit, through the department, to the
> ward, and out again through discharge — giving every role along that path one shared picture
> instead of an inbox, because the wait belongs to all of them and the picture belongs to none.
>
> **It runs, and nothing in it is settled.** Every rule it applies, every list it offers and every
> figure it shows is a proposal, recorded with the reasoning behind it so it can be argued with and
> changed. It is built to be told it is wrong.
>
> It runs on synthetic data, holds no patient information, and is not clinical decision support. It
> decides nothing and recommends nobody. It shows what people have entered, and when.

**The one-line version**, for an email or an introduction:

> *A working demonstration of a statewide hub for psychiatric bed flow — following one person from the
> decision to admit through to their bed being free again, on entirely synthetic data. Nothing in it
> is settled.*

### Why each paragraph is there, so nobody edits one out by accident

1. **The opening is the argument, and it is the owner's own.** *"There is a telephone, an inbox, and
   goodwill"* does three things at once: it is concrete, it pre-empts the "we do have processes"
   pushback by naming what is actually there, and it is generous to the people doing the work — the
   failure is the absence of a system, not the absence of effort. It ends on *"the delay belongs to
   nobody"*, which makes the accountability point without accusing anyone. That is the sentence
   people will repeat back to you.
2. **The second names the job and then the pathway, in that order.** "Its one job is getting a person
   from an emergency department to a ward" is the owner's foundation stated in the mission itself,
   and it must not be edited out for concision — without it the paragraph describes a system without
   saying what it is *for*, and a reader supplies their own answer. The rest of the pathway follows so
   nobody reads it as an emergency-department tool or a ward tool.
3. **The third is the flexibility clause and it is load-bearing.** "Working demonstration" invites a
   health service to take it seriously; without this paragraph it also invites them to treat the
   decisions inside as fixed. Every one is provisional and recorded with its reasoning. Removing this
   paragraph turns an open proposal into a finished product nobody agreed to.
4. **The fourth is the governance boundary** and appears on the screens too, not only here.

### Two lines deliberately NOT included, and why

- **"Wards pick and choose patients."** Probably true, and the one line that loses the room, because
  a ward representative will be in it. The honest version, if the point must be made:
  *"a ward answering an email cannot see what else is being asked of the network."* Same fact, and it
  blames the absence of information rather than the people — which is also the actual cause.
- **Any figure for how long patients wait, how many beds are blocked, or what any of it costs.** No
  such figure exists that this project can source, and an invented one is how a demonstration gets
  quoted in a meeting and then disbelieved.

---

## The foundation

**Owner, 2026-08-29:** *the core principle is patient flow from the emergency department to the
wards. That is the foundation. Everything is built on it.*

Every refusal, every principle and every scope decision below is subordinate to that. Where any of
them would obstruct a person getting from an emergency department to a ward, or obstruct someone
seeing why that is not happening, the refusal is the thing to re-examine — not the flow.

Discharge is in scope because it is what makes the forward flow **repeatable**, not because it is a
second subject: someone leaves, a bed appears, the next person moves into it. A demonstration in
which the bed never comes back can only ever show one patient moving once.

## The refusals, split three ways

The owner's instruction, 2026-08-29: *"be careful about refusals and don't take them as law."* So each
entry below records **how firmly it is held** and **what reversing it would cost** — because a
refusal with no reason attached gets reversed by the next person who finds it inconvenient, and a
refusal treated as scripture stops the project from learning.

### A. Principles — these should survive into any real system

Safety, privacy and honesty commitments. A team building from this blueprint should treat these as
the design, not as prototype limitations.

| Refusal | Why | Reversing it |
| --- | --- | --- |
| **Never invent a figure, timeframe or threshold from the Mental Health Act** — anywhere, including comments and fixtures | A system that states a statutory deadline it cannot source will be believed, and acted on | Not reversible. Real figures require a legal source and a named owner |
| **Nothing predicts, scores, ranks or recommends a person** | The moment a screen ranks patients, the ranking becomes the decision and the clinician becomes its auditor | Reversible only as an explicit product decision, with a named accountable clinician |
| **Escalation tiers are declared by a human, never triggered by a threshold** | A system that declares a statewide surge on an invented number gets quoted in a meeting and then disbelieved | Firmly held. Would need real, sourced indicators first |
| **An owner is always a role, never a person** | Survives shift changes with no reassignment, and keeps staff names out of the system entirely | Firmly held. Accountability comes from the role carrying a visible clock |
| **No diagnosis** | Not needed for bed flow, and its presence changes what the record is | Owner decision. Costs one field; needs a recorded decision, not a drift |
| **Cohort is a requirement on the request, never a fact stored about a person** | "This request needs an adolescent bed" is operational. The same word attached to a patient is not | Firmly held |
| **Sex is the only permitted patient attribute** | Data minimisation. It is load-bearing for bed matching; nothing else is | Held, and already tested at the boundary once |
| **No free text anywhere** | Free text is unbounded clinical data by another name, and it is where identifiable information arrives | Held as a principle. A real system would need a governed alternative, not a textarea |
| **Every bed dimension asks "does this bed accept this person", never an equality** | An equality excludes every undesignated bed — most of the network — and looks entirely reasonable in review | Not a preference. It is a correctness rule |
| **Conservative failure everywhere** — an unresolvable record is **shown, and labelled unresolvable**; a missing date reads "no date set"; an unconfirmed ward reads unconfirmed | Guessing is worse than a gap, and a gap is only useful if you can see it | Not reversible without changing what the system is for |

### B. Prototype scope — true only because this is a prototype

**These are not principles.** A real build reverses most of them, and a health service should read
them as "not yet", never as "never".

| Refusal | Would a real system reverse it? |
| --- | --- |
| **Synthetic data only; no real patient information** | Yes, necessarily — with the governance, ethics and information-security work that implies |
| **Local and offline; no live database, no hosted service** | Yes |
| **Notifications are simulated; nothing ever sends** | Yes. The simulated outbound log exists to show exactly what would be sent |
| **The prototype is reachable only through a developer gate** | Yes |
| **The wards, bed numbers and travel times are invented** | Yes — and this one needs confirming with the real network before any demonstration to people who know it |
| **Accepting a referral creates no movement and arranges no transfer** | Almost certainly. It was a deliberate seam while the two halves were built separately |

### C. Open design choices — the owner's preference today, cheap to revisit

Recorded so nobody treats them as settled law, and so nobody reverses them by accident either.

| Choice | What reversing it costs |
| --- | --- |
| Beds are anonymous tiles; no bed numbers or ward geography | Moderate — touches placement. Reason it was refused: a stale bed number on a board is worse than none |
| Distance is travel-time bands plus kilometres, not a map | Small. Bands are what a clinician can weigh |
| Ten WA regions, not a coarser metro/country split | Small |
| The four stay bands, as the owner worded them | Four numbers |
| The blocked-discharge figure stays off the morning page | One figure. Declined for now, not refused |
| Predictive community demand is out of scope | Larger — it is arguably a different product, not a feature |

---

## What the route into a real health service changes

The owner has a possible adopter, and it is the actual WA psychiatric bed-flow service. Three
consequences follow, and none of them is optional:

1. **The invented network becomes the biggest credibility risk in the project.** People in that
   service know the real wards, the real bed numbers, and the real travel times. A wrong number they
   recognise costs the room in seconds, and no amount of correct design recovers it. Every screen
   showing network data must say on its face that the network is synthetic — not only a document.
   One example already loaded in the fixture: a Perth Metropolitan person recorded as reachable from
   Armadale only by air.
2. **The unvalidated bed model stops being a design risk and becomes a demonstration risk.** Eight
   phases rest on `predicted → confirmed → released`, and no ward clinician has read it. Showing that
   model to the service that would adopt it, before one of its own clinicians has checked it, is the
   most expensive possible order to do this in.
3. **"Not clinical decision support" has to be said on the screens, not just in the repository.** It
   already is in places. It needs to be everywhere a figure could be mistaken for advice.

## The concrete shape of "conservative failure everywhere" — not a new principle

**This is Group A's conservative-failure row above, made concrete. It is deliberately NOT a new
rule with a new number**, and the reason is itself the finding: three sessions rediscovered it today
because the row stated it abstractly, and the ledger session caught me about to mint a fresh
namespace for a principle the project already held.

**And the row's old wording is why it was rediscoverable.** It said an unresolvable record *"renders
as absent"* — which reads two ways. *Shown, and marked absent* is the rule. *Disappears from the
screen* is the bug. **The sentence licensed the failure it was written to prevent**, and I have
sharpened it above rather than adding a rule beside it.

**The concrete form:** when a screen cannot place, match or resolve an item, it **shows the item and
says it could not be placed.** It never omits it, and never quietly substitutes a default.

**Three sessions built it independently on the same day**, none having read the others: the ward board's tile framing, the ward index's *"not placed in a health
service"* group, and the flow diagram's `unplacedUnits` computed at `flow-diagram.tsx:188` and
rendered as an explicit anomaly at `:433`. A fourth instance is being built for the sixth-service
hole. **Three independent inventions of one rule is a rule that wants writing down once.**

**The rule:** when a screen cannot place, match or resolve an item, it **shows the item and says it
could not be placed.** It never omits it, and it never quietly substitutes a default.

**Why the concrete form is worth the words, when the abstract one already existed.** The mission says this system
*"shows what people have entered, and when"* and that it *"decides nothing and recommends nobody"*.
**An item that vanishes because the software could not place it is the system deciding something** —
that this person or bed does not count — and hiding the decision in the same motion. It is the
mission's failure mode expressed in a layout.

**And it is the governing failure mode of this whole project in visual form:** an absent signal reads
exactly like a passing one. A ward that is not on the board looks identical to a ward with nothing to
report. **The anomaly is the signal.** Removing it does not remove the problem; it removes the only
evidence of it.

**Practical test for any new surface:** construct an item the surface cannot handle — a unit in no
health service, a referral matching no unit, a bed with no ward. **If it disappears, the surface is
wrong**, however correct its computation is for everything else.

