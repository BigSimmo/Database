# Ward Flow roadmap and settled decisions

**What this file is for.** Ward Flow's direction was settled across a long conversation on
2026-08-26. Conversations end; this file does not. Anything here has been decided by the product
owner and should not be re-litigated by a later session without being told to. Where a decision
was a refusal, the reason is recorded with it, because a refusal with no reason attached gets
reversed by the next person who finds it inconvenient.

Companion documents: `docs/superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md`
is the binding spec for the next phase. `docs/ward-flow-phase-handoff.md` carries the state of work
in flight. `docs/ward-management-decisions.md` holds the earlier Phase 1–3 rulings.

---

## What Ward Flow is

A patient bed-flow hub coordinating psychiatric bed flow across Western Australia, from the
community mental health team's decision to admit, through the emergency department, to the ward —
and back out again through discharge.

It is a **synthetic, offline prototype**, and its real output is a clear shared understanding of
what such a system would have to do. It is not clinical decision support and is not connected to any
real service.

**Primary user: the statewide coordinator.** They are the only role that sees the whole picture, and
that view is the hub's entire value. But the ward, the emergency department, the community team and
the transport officer each need a real screen to contribute what only they know — a hub fed by
nobody is a wall chart.

## Standing constraints

These predate this roadmap and override anything in it:

- **Never invent a legal figure.** No figure or requirement from the Mental Health Act may be cited,
  paraphrased or inferred. If one is needed, ask the product owner.
- **Synthetic data only.** No name, date of birth, medical record number, address, diagnosis,
  narrative history or treatment. **Sex is the only permitted patient attribute.** Free text counts.
- **Local and offline checks only.** Nothing touching OpenAI, Supabase, hosted CI or a live database.
- **The prototype is a sandbox.** It is reachable only through the developer hub, and the developer
  hub is the only link out of it.

## Decisions settled 2026-08-26

**Scope of the hub**

1. The pipeline starts at the **community mental health team's decision to admit**, not at the
   emergency department. Most patients are formed in the community; the ED is a waypoint, not an
   origin. This is also the only version that could ever support community-to-ward without an ED.
2. The pipeline ends at **discharge**. Bed flow is a two-sided equation and only one side was built.
3. **Any front door** — community team, crisis service, police, ambulance, or transfer from another
   hospital. Same stages, different entry.
4. **Predictive community demand is out.** "This team requests a bed today" is concrete. "This team
   thinks someone might deteriorate" is a different product.

**Patients and privacy**

5. Cohort is expressed as a **requirement on the request** ("this request needs an adolescent bed"),
   never as a fact stored about a person. The word never attaches to a patient.
6. Neither a bed release nor a leave bed records **sex**, even though sex is the one permitted
   attribute and recording it would let the sex-mix column refresh sooner. Phase 4 wrote a
   structural privacy test against the type's own field set; that test is worth more than the column.
7. A community referral carries seven operational facts and **no reason for admission**: requesting
   team, urgency, kind of bed needed, where the person is now, where home is, transport needed, and
   whether they arrive via an ED or directly.

**Accountability and communication**

8. An **owner is always a role**, never a person — "Royal Perth emergency department", "Bunbury
   ward". It matches handover, survives shift changes with no reassignment, and keeps staff names
   out of the system. Accountability comes from the role carrying a visible clock.
9. **Notifications are in-app plus a simulated outbound log** showing exactly what would be sent,
   with nothing ever sending. Content limited to the movement identifier and what needs doing.
10. **Escalation tiers are declared by a human**, never triggered automatically by a threshold. The
    indicator numbers shown alongside are synthetic and labelled as such. A system that declares a
    statewide surge on an invented number is a system that gets quoted back at you in a meeting.

**Geography and data**

11. **Distance is travel-time bands plus kilometres** — under an hour, one to three hours, three
    hours or more, air transport only. "Three hours from home" is a fact a clinician can weigh;
    "247 km" is not, and "regional" says nothing about whether family can visit.
12. **Sites stay synthetic.** Real WA town names may be used for geography and distance only. A
    prototype that quietly asserts wrong facts about a real hospital is unrecoverable; swapping a
    synthetic site table for a real one later is a day's work.

**Presentation**

13. The morning **state-of-the-state page is fixed and not configurable** — one printable page, the
    same five figures everywhere. The moment two services can arrange it differently they quote
    different numbers at each other, which was the one thing the page existed to prevent.
14. **The network diagram stays.** It orients people and makes the prototype navigable. It earns its
    place by becoming functional: clickable navigation, line weight by flow, an overlay showing which
    sites can take the selected patient, roughly geographic layout, a time control, and country
    sites on it at all.
15. **Old Ward Flow links stay broken.** Nothing was bookmarked; every redirect kept alive is a route
    somebody has to maintain forever.

**Still unbuilt, deliberately**

16. The **statutory clock board** is not built and will not be until the product owner supplies the
    legal figures. Not a version with blanks — blanks invite someone to fill them in from memory.

## Phase order

**Phase 5 — Bed availability becomes real. BUILT and MERGED 2026-08-26** (PR #2390, squash
commit `ea5482b9`)**.** Ward discharge flagging and
confirmation, the discharge and egress board, predicted capacity for today in four bands, a
freshness signal on every screen, and the coordinator's one permitted action: marking a ward's count
as refresh-requested. Nothing else. Full spec:
`docs/superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md`. What was built,
what the screenshots caught, and what is still open: `docs/ward-flow-complete-ledger.md` §5d.

Everything below needs trustworthy availability numbers underneath it, which is why this phase has
no headline screen and still had to come first.

**Before Phase 6 builds on it, two things are owed to the product owner.** Neither blocks Phase 5.

1. **Spec D14 has still never been checked by a ward clinician.** Predicted → confirmed → blocked →
   released is a software model of how a bed comes free. A bed may be confirmed and blocked at once
   in reality, and "predicted" may compress several distinct real states. It is the single most
   valuable thing to check, it is cheap to change while everything is synthetic, and Phase 6 is
   built entirely from these numbers — so the cost of it being wrong rises the moment Phase 6 lands.
2. **Design Phases 6 and 7 in one conversation, and 8 and 9 in another.** Each design conversation
   carries a large fixed setup cost regardless of how much is designed, and Phase 6 is small and
   already three-quarters determined by Phase 5's numbers. Each phase still gets its own written
   specification — only the conversation is shared.

**Phase 6 — The morning page. DESIGNED 2026-08-27, not yet built.** Promoted from Phase 8 on
2026-08-26. Built entirely from Phase 5's numbers, small, and the artefact that can be put in front
of colleagues. Finding out whether any of this is right is worth more than the next feature.
Binding spec: `docs/superpowers/specs/2026-08-27-ward-flow-phase-6-morning-page-design.md`.

**Phase 7 — The front door. DESIGNED 2026-08-27, not yet built.** Community referral tracking,
intake from crisis services, police, ambulance and inter-hospital transfers, cohort and bed-type
matching, and the role data-entry screens each contributor needs.
Binding spec: `docs/superpowers/specs/2026-08-27-ward-flow-phase-7-front-door-design.md`.

Both were designed in one conversation, as instructed above. The owner's answers that preceded and
shaped them — including four given during the conversation itself — are in
`docs/ward-flow-phase-6-7-decisions.md`. **The clinician check is still owed and is still the single
most valuable validation available**; Phase 6 spec D1/D14 and Phase 7 spec D15 are the decisions that
keep the reversal cheap if the four-stage model turns out to be wrong.

**Phase 8 — Distance and the state.** Geography as a cost, the country and remote pathway, air
transport, closest-suitable-bed, the network diagram rework, and the out-of-area ledger.

**Phase 9 — Daily use and trust.** Waiting-time equity, ownership clocks, escalation tiers, the
retrospective view, handover continuity, notifications, and the navigation regrouping.

## Additional items agreed 2026-08-26

Each of these was proposed and accepted; none is yet assigned to a phase.

1. **Ward prediction track record.** Show how often each ward's predicted discharges actually
   happened. It is a ward-level statistic with no patient data in it, and it is the difference
   between a prediction a coordinator plans against and one they discount. It also gives wards a
   reason to keep the board accurate that no amount of nagging will.
2. **"Why not here?" across the whole state.** For one patient, every unit and the single reason it
   cannot take them. "There are no beds" is not what an escalation conversation needs; a list of
   specific obstacles is.
3. **A sixty-second guided tour.** Self-driving: a patient waiting, a coordinator finding a bed, a
   ward confirming, the board updating. For a prototype whose real output is shared understanding,
   this is likely the highest value per hour of anything on this page — it means handing someone a
   link instead of narrating over their shoulder.
4. **Out-of-area ledger.** How many people are currently in a bed far from home, and for how long.
   The equity measure with teeth. Needs Phase 8's distance work.
5. **"Waiting since" at the front of the priority queue.** The queue ranks by urgency, which is
   right, but length of wait carries the moral weight and is currently secondary.
6. **Named moments on the demo clock.** "Friday 4pm, everything jammed" is a scenario worth opening
   in front of colleagues. The scenario switcher exists; this is mostly naming.

## The assumption most likely to be wrong

`predicted → confirmed → blocked → released` is a software model of how a bed comes free. No ward
clinician has checked it. A bed may be confirmed and blocked at the same time in reality, and
"predicted" may compress several distinct states a charge nurse would separate.

It is built as specified because a working model beats an unbuilt one and this one is cheap to
change while everything is synthetic. **Checking it with a ward clinician is the single most
valuable validation available**, and it should happen before Phase 7 builds more on top of it.

## Working practice

- **One session per worktree folder, and no two sessions aimed at the same pull request.** On
  2026-08-26 two sessions worked the identical task in one folder: a merge with conflicts, and an
  edit to a test that broke it in a way only a browser run could find. Roughly forty minutes lost
  for nothing.
- Separate branches in separate folders are safe for files, but the heavyweight-check lock is
  machine-wide, so concurrent sessions still queue behind each other. That is a slowdown, not a
  hazard.
- Phase work runs as subagent-driven development shaped around that lock: the data-model change
  serial and first, then a genuine fan-out across file-disjoint tasks, each agent running only
  focused tests, with the expensive checks — full suite, lint, format, browser, screenshots — run
  once at the end rather than after every task.
