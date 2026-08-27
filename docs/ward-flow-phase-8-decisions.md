# Ward Flow Phase 8 — decisions taken during the autonomous session

**Written 2026-08-28**, while the product owner was away and had authorised decisions to be made on
his behalf, "grounded in the current repository". This file records what was decided, by whom, on
what grounds, and what it costs to reverse. It is the companion to
`docs/ward-flow-phase-8-9-questions.md`, which states the questions; this states the answers.

**Only the owner's own answers are marked OWNER.** Everything marked SESSION was decided by the
autonomous session from that document's own recommendations, and is reversible — each entry says
what reversing it would cost.

---

## The rule this phase is built to

Phase 8 is about distance, and distance is where a prototype most easily starts asserting things it
cannot back. The failure has already happened here once: a whole-branch review found a screen headed
"Nearest candidates" offering a patient sitting in Sir Charles Gairdner's own emergency department a
Royal Perth bed first — the list was in the hospital table's own order, and nothing in the system
knew where anything was.

So the standing rule for every decision below:

> **Any word implying proximity — nearest, closest, local, far, best — must be backed by a fact the
> system actually holds, and the thing on screen is the band, not the number. A kilometre figure may
> sit beside a band; it may never order a list or label a bed.**

---

## D8-1 — Home region (OWNER, 2026-08-28)

A referral records the broad area a person is from, chosen from a fixed list, never an address.
Answered by the owner, who named it for what it is: a governance decision widening the permitted
facts about a person for the first time in five phases. Built in Phase 7's fix round B, not
deferred, because the referral record was still open when the question was asked.

**Already shipped.** `HOME_REGIONS` and `Referral.homeRegion` exist and are membership-checked.

## D8-2 — Distance groups the list; it never sorts it (SESSION)

The bed list is grouped by travel-time band — everything under an hour, then one to three hours,
then three or more, then air transport only. Inside a band, the site table's own fixed order, exactly
as today. No bed is ever hidden and no bed is ever labelled best.

**Why.** Grouping answers what a coordinator needs — how many options are close, how many are not —
without producing a single recommended answer or a number anyone starts quoting. Sorting strictly by
travel time would turn a distance into a ranking, which is precisely how "Nearest candidates" went
wrong. Phase 7's settled rule ("matching shows candidates; a human decides") is not weakened by a
grouping, because every candidate remains visible and choosable.

**Cost to reverse:** one function and one wrapper element. The match view already renders every unit
in a flat list from `referralCandidates`, which never truncates or sorts; grouping wraps that list
rather than replacing it.

## D8-3 — "Out of area" means three hours or more, or air transport only (SESSION, with a caveat that must ship on screen)

One rule, the same everywhere in the state, rather than "outside your own health service region" —
which behaves differently in the city and the country, where a single region covers most of WA and
Kununurra to Broome would not count as out of area at all.

The clock starts when the person **arrives** in the far bed, not when they first started waiting.
The ledger is about how long someone has been away from home, not how long their admission took.

**The caveat, and it is not optional.** Nobody has established whether "out of area" is already a
defined term with a defined threshold in WA mental health (section 3, question 4). If it is, this
threshold is not ours to choose and we adopt theirs instead. Until that is answered, **the screen
must say the threshold is one the prototype invented.** A threshold that looks official and is not
is the same defect class as the escalation numbers roadmap decision 10 already forbids.

**Cost to reverse:** one constant and one line of screen copy.

## D8-4 — Air transport is a band and nothing more (SESSION)

A bed is marked reachable only by air. That is all. No air pathway, no road-or-air field on the
transport job, nothing about who flies, who decides, or what waits on what.

**Why.** The questions document's own recommendation was "B, but only if section 3 comes back with
enough to make an air job look different from a road one **in a way that is true**". It has not come
back. Section 3's first question — how psychiatric patients actually move around WA by air — is
unanswered, and its own instruction is explicit: nothing about air transport beyond a travel-time
band should be designed until it is. So: **A**.

**Cost to reverse:** nothing is built that would have to be unbuilt. Adding the transport-job field
later is additive.

## D8-5 — The network diagram is a placement tool first (SESSION)

Pick a patient; see which sites can take them, what each would cost them in travel, and why the rest
cannot. Geography inside that, not instead of it. The whole-network overview becomes the secondary
mode.

**Why.** It is also the answer to "why not here?" across the state, which is a separate roadmap item,
so one picture does two jobs. A diagram that only orients is a wall chart; one that answers a real
question gets used. Roadmap decision 14's six commitments are unchanged — this decides only which
one wins when they compete for the same picture.

**Cost to reverse:** the layout, not the data. Every fact the diagram draws comes from the site table
and `referralCandidates`, both of which are unchanged by how it is drawn.

## D8-6 — The country pathway records an optional step, and asserts nothing (SESSION — a third option, not one of the three offered)

The questions document offered: same path with distance shown (A); same path plus **a required
recorded decision** that a local bed was sought and none was suitable (B); or a genuinely different
path (C). Its recommendation was B, "subject to section 3".

Section 3's second question — whether a country service looks locally first, or a bed is sought
across the state from the start — is unanswered. **B as written asserts that the local-first step
exists in practice.** That is exactly the kind of quiet claim this project has committed to not
making.

So: the step exists as something a coordinator **may record if it happened**, never as a stage the
pathway requires or a box the screen implies should be ticked. A country referral that never had a
local option looks no different from a metro one, and the ledger can still show whether a nearer
option was ever available where somebody recorded that it was.

**Why this rather than A.** A gives up the one thing the out-of-area ledger is actually about. The
optional form keeps it and asserts nothing, which is the standard the charter sets: state the gap,
keep it cheap to fill.

**Cost to reverse:** if the answer comes back "yes, country services always look locally first", the
step is promoted from optional to required — one validation and one screen state. If it comes back
"no", the field is dropped.

## D8-7 — Travel-time bands are synthetic fixture data, labelled as such (SESSION — this is the load-bearing one)

**The problem.** Section 3's sixth question says which travel-time band each country hospital falls
into is a real-world geography fact "that will be read as facts, because real town names are
permitted for exactly this purpose", and that it "should be checked rather than estimated from a map
by whoever writes the specification". The site table does not use town names — it uses **real
hospital names**: Royal Perth, Sir Charles Gairdner, Fiona Stanley, Broome, Kununurra. Anything this
prototype prints beside one of those names will be read as a claim about that hospital.

I do not have that fact checked, and estimating it is the thing I was told not to do.

**The decision.** The travel-time band is a **property of the synthetic site table**, recorded in the
fixture exactly like every bed number already is, and the screen says so. It is not presented as a
measured or checked figure, and no screen wording implies it was. This is the identical treatment
roadmap decision 10 already requires for escalation indicator numbers — synthetic, and labelled
synthetic — and the identical treatment every bed count in this prototype has had since Phase 1.

**Why this is honest and estimating would not be.** The prototype already says, everywhere, that its
numbers are invented. A band that arrives the same way as the bed counts inherits that statement. A
band presented as geography does not: it would be the first figure in the system claiming to
describe the real world, sitting next to a real hospital's real name, with nothing behind it.

**What this costs.** The grouping in D8-2 and the ledger in D8-3 both work on synthetic bands with no
change at all — they group and count, they do not measure. When the real bands are checked, they
replace the fixture values and nothing else moves.

**What must never happen:** a kilometre figure derived from these bands, or a band presented without
the synthetic label. Either would convert an invented number into an apparent measurement.

---

## What I did not decide, and will not

These need a fact neither of us has. Each is listed in `docs/ward-flow-phase-8-9-questions.md`
section 3, and none is answerable by inference from the options that document offers.

1. **How psychiatric patients actually move around WA by air.** Blocks anything beyond D8-4's band.
2. **Whether a country service looks for a local bed first**, and whether someone placed away from
   their region is brought back when a nearer bed frees. D8-6 is designed around this gap rather
   than across it.
3. **Whether named escalation levels are in real use for WA mental health bed pressure.** Phase 9,
   not Phase 8, but it blocks P9-2 and the answer is the owner's.
4. **Whether "out of area" is already a defined term with a defined threshold.** D8-3 ships with an
   explicit on-screen statement that its threshold is invented, precisely because of this.
5. **The four-stage bed model**, still never put to a ward clinician. Phase 8 is designed the way
   Phase 7 was — it never asks what stage a bed is in, only whether a bed is free now — so being
   wrong costs Phase 8 nothing. `docs/ward-flow-clinician-check.md` is the page that asks him.
6. **The real travel-time band for each country hospital.** D8-7 is the decision that lets Phase 8
   be built without it, and states what replacing it later costs: the fixture values, and nothing
   else.

**No Mental Health Act figure appears anywhere in Phase 8, and none will.** Nothing in this phase
needs one.

---

## Where these decisions did not reach

Found while writing the Phase 8 specification against them. All three are recorded rather than
patched over, and the first is the one that needs the owner.

### 1. D8-3's clock has nothing to start from

D8-3 rules that the out-of-area clock starts **when the person arrives in the far bed**. Nothing in
the system records a referral arriving anywhere.

A `Referral` carries `homeRegion` but never arrives — Phase 7's own D14 deliberately stops short of
turning an accepted referral into a movement. A `Movement` arrives, but carries no home region. So
the two halves of "how long has this person been away from home" sit in two records that do not
meet, and the ledger as D8-3 describes it cannot be built on what exists today.

The specification takes the cheapest of the three closures: an optional `Referral.arrivedAt` and a
`REFERRAL_ARRIVED` event. That adds **no new fact about a person** — an arrival time is a fact about
a bed — and it does not build the referral-to-movement bridge Phase 7 deliberately held back.

**The alternative the owner may prefer — putting a home region on a `Movement` — is a governance
decision of the same class as P8-1, and it is not the specification's to take.** It is recorded here
so the choice is visible.

A smaller consequence of the same gap: the prototype records nobody ever **leaving** a bed, so
during a demo run nobody ever leaves the out-of-area ledger either. The screen is specified to say
so plainly. Whether a departure record should exist is a separate question, and it is the owner's.

### 2. Roadmap 11 and D8-7 contradict each other

Roadmap decision 11 settled distance as "travel-time bands **plus kilometres**". D8-7 forbids any
kilometre figure derived from the bands, and nobody has a checked distance for any site.

**Phase 8 can therefore ship only half of roadmap 11.** That is a deliberate, stated deferral, not
an omission — the bands ship, the kilometres do not, and they become available the day real
distances are checked. Recorded so nobody later reads the missing half as an oversight and fills it
in from a map.

### 3. Roadmap 14's "roughly geographic layout" needs exactly the fact that is missing

A picture laid out like Western Australia, with real hospital names positioned on it, asserts
considerably more than a band does — **a picture is read as a map whatever its caption says.** That
is precisely section 3's sixth question.

The specification substitutes a band-relative arrangement, states plainly that this is less than the
roadmap promised, and names what would unblock the real thing: checked geography from the owner, not
more design work.

### Also flagged, not fixed

The referral fixture carries a comment describing a seeded referral as "hundreds of kilometres from
home" and calling its shape "a real shape for WA's rural mental health system". Both are unchecked
real-world claims of exactly the kind this phase's own governing rule forbids, and a comment
asserting a fact is how the deleted Form 1A figure entered this codebase in the first place. It is
queued for correction in Phase 7's fix round C.
