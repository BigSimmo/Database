# Coordinator hub — design

**Status:** design complete, nothing built. **Spine:** `FD-23` (inverted), `FD-27`, and the owner's
ruling that the coordinator is not a gate. **Register of record:** `docs/ward-flow-ledger.md` on
`claude/Ward-design`.

## The problem this screen has, before any layout

**The coordinator does not decide anything.** The owner, directly: *"No referrals are blocked or
gated by the coordinator… the system should run autonomously as much as possible."*

⚠️ **So the obvious design is a trap.** A hub listing *referrals awaiting the coordinator* would
quietly rebuild the gate he removed — and it would look like helpfulness, because every other role's
screen is a worklist. **A worklist for a person who does not decide is a gate with the label filed
off.**

**And "show everything" is not an answer, it is the absence of one.** A screen showing everything
shows nothing in particular, and the coordinator already reaches the world through the board and the
shortlist.

## What the screen is actually for

> **An autonomous system's failure mode is silence.**

If nothing is gated, nothing queues. If nothing queues, **nothing arrives demanding attention** —
and the things that go wrong go wrong by *not happening*. A referral nobody accepted does not raise
its hand. A patient referred to four wards is four rows on four boards and **one patient nobody is
looking at.**

**So: the coordinator hub is the only surface in Ward Flow where an ABSENCE is visible.** Every
other screen answers *what is in front of me*. This one answers *what is not happening that should
be.*

That also settles the emptiness question for every list below — **these lists are empty when the
service is working**, which is the opposite of every other board in the system, and it is the
property that makes the screen readable at a glance.

## The four sections

### 1. NOBODY HAS ACCEPTED

Patients with referrals out and no acceptance.

**This is the core of the screen and the reason it exists.** The autonomous system's one failure
mode is that it runs and produces nothing. **Nothing else in Ward Flow shows this** — each ward sees
its own inbox and correctly ignores what it has not accepted.

Shows the two clocks already defined for the ED hub (`P9-D2`): time since referral, and time in
department where the patient is in one. **Raw durations, no threshold, no colouring** (`P9-D3`) —
no figure is invented, and this is the single most tempting place in the prototype for a
"breaching" flag.

**Empty means: every patient referred has somewhere to go.**

### 2. ONE PATIENT, EVERY DESTINATION

A patient referred to several places, shown as **one patient**.

⚠️ **This is `FD-23` inverted and it is the hub's whole reason to exist.** A ward sees exactly one
destination — its own — deliberately, so it does not spend its time on a patient going elsewhere.
**The coordinator is the only role that sees them all**, which means **this view exists nowhere else
and cannot be assembled from any other screen.**

**Empty means: nobody is currently referred to more than one place.**

### 🔴 Read `destinations`, never `referredUnitIds`

**`referredUnitIds: string[]` is declared *"Units currently holding a live referral"* — WARDS ONLY.**
**`destinations: ReferralAddressing[]` is the field that carries every kind** (ward, ED psychiatry
team, community team), built for `FD-21` and `FD-15`.

⚠️ **A hub built on `referredUnitIds` would silently omit every ED and community referral — and it
would LOOK COMPLETE.** **No screen could disagree with it**, because `FD-23` forbids the ward pages
from showing other destinations, so **there is no second view anywhere in the system that could
contradict the wrong number.** That is the `R46` shape at the level of a data source: **not wrong in
a way anything can observe.**

⚠️ **The ward page correctly stays on `referredUnitIds`** — Ward Core has ruled that and is right.
**So two screens read two fields for what sounds like one fact, and both are correct.** **A later
reader who "harmonises" them breaks this hub, silently, and will believe they were tidying up.**

⚠️ **A race is possible and belongs here.** `FD-22` says the first acceptance cancels every other
referral automatically. **Two wards accepting near-simultaneously is therefore a real event**, and
the coordinator is the only person positioned to see it happen. **Show the cancellation and which
acceptance won** — not as an alert, as a fact on the row.

### 3. OVERRIDES

The register from `FD-27`: **what was overridden, whose decision it was, when, and why.**

🔴 **Visible to the party overridden.** ⚠️ **This clause is invisible in a data-model review, because
an audit trail and an accountability record store identical data** — the difference is entirely who
may read it, which is a permission and not a schema. **A reviewer looking at the table will see
nothing missing.** It must be carried as a stated requirement or it is lost silently, producing a
system that faithfully logs every override and tells nobody.

**Empty means: the coordinator has not overridden anything.**

### 4. WHAT ONLY THIS SCREEN CAN SEE — **owner decision required, not built**

⚠️ **Recorded as a question, deliberately not designed.** A coordinator with a whole-service view can
be shown patterns no ward can see: a ward declining everything, one ED consistently waiting longest,
declines clustering on one reason.

**That is a different product.** It turns oversight into **performance monitoring of named
services**, which carries consequences in a real organisation that have nothing to do with bed flow.
**Nothing may rank a person** is already a standing refusal; **whether a service may be ranked is
not ruled on, and must not be inferred from it.**

**Build nothing here until the owner rules.**

## What this screen must NOT have

- ⚠️ **No queue of items awaiting the coordinator.** That is the gate he removed, rebuilt.
- **No accept, decline, or approve action on a referral.** The coordinator may act on the system;
  they do not stand between a referrer and a ward.
- **No invented threshold** — no "overdue", no breach colouring, no target time (`P9-D3`).
- **No free-typed values** except where `FD-13` already permits one story field on a referral; an
  override reason is a **chosen** reason plus the existing structured fields, and `PD-6` removed the
  free-text note from a decline for exactly this reason.
- **No second place transport lives** — the coordinator sees transport jobs, as a view over the
  same jobs (`TR-D1`).

## Open, and not to be closed by building

- **Section 4** — whether service-level patterns are shown at all. **Owner.**
- **Who may cancel a transport** (`TR-D1` leaves it open) — the coordinator is the obvious candidate
  and *obvious* is not *ruled*.
- **Whether the coordinator may see a ward's decline reason on another ward's referral.** `P9-D9`
  gives ED psychiatry its own declines; **`FD-23` gives the coordinator every destination, and
  whether that includes every decline REASON is not stated.**
