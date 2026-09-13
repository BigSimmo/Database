# Where a referral reaches the coordinator — every surface, measured

**Task:** `WF-BUILD2-001` half one. **Measured by:** Ward Builder Two, 2026-09-01, on
`claude/ward-builder-two`, first at `6df4f86fd`. **Nothing in the app was changed** — half one is a
measurement, and that remains true.

> ⚠️ **The pin above describes the first pass, not this document.** It has been revised six times
> since `6df4f86fd` — four surfaces added, a 26th found by falsification, two decayed claims
> corrected, and a batch of citations converted from bare line numbers to symbol names. Re-verified
> in full against `9368ead7c` on 2026-09-01 by an independent falsification pass, which found no
> 27th surface and no surviving false negative.
>
> **This correction is the document's own trap 3** (`traps/silent-transforms.md`): a sha is a claim
> about a tree, and a header that keeps its original pin through six revisions goes on looking
> authoritative while describing a version nobody can read any more. It was found by the
> falsification pass, not by anyone re-reading the header.

**The ruling being implemented**, owner, 2026-09-01, verbatim:

> "Any referrals to community Do NOT need to be flagged in the coordinators screen."

Half one exists because the question put to the owner was about the **bed-matching queue** and the
answer was about **the coordinator's screen**. This document establishes what that phrase can
mean, so the owner can rule on scope precisely rather than in the abstract.

---

## The finding that changes the question

**Two different things in this codebase are called a referral, and the coordinator's main screen
shows only one of them — the one that can never be a community referral.**

|                                   | **`Referral`**                                                                                                        | **`movement.referredUnitIds`**                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| What it is                        | The front-door record: somebody asking, on a patient's behalf, for a ward bed / an ED review / a community team       | A bed request already in flight: this movement has been offered to these wards |
| Where it lives                    | `ward-referrals.ts`, `ward-model.ts`                                                                                  | `Movement`, in `ward-model.ts`                                                 |
| Can it be addressed to community? | **Yes** — `community_team` is one of three destination kinds (`REFERRAL_DESTINATION_KINDS`, `ward-model.ts`, ~`:891`) | **No.** These are ward unit ids, rendered as "Parallel referral: _unit name_"  |
| Rendered on the Command screen?   | **Never**                                                                                                             | Yes, on the flow diagram and the shortlist                                     |

The owner's ruling is about the first. The Command screen renders the second. They are not the
same record and one never becomes the other.

**Evidence, three independent ways:**

1. `CoordinatorScreen`'s destructuring (`coordinator-screen.tsx`, ~`:47`) pulls `movements, units,
bedReleases, leaveBeds, rejections, now, dispatch, focusMovementId, setFocusMovementId` from the
   provider. It does **not** destructure `referrals`, though it is offered as a field of
   `WardFlowContextValue` (`ward-flow-provider.tsx`, ~`:56`).
2. A sweep of every screen that reads `referrals` from the provider returns **eight** files
   (`community-screen`, `ed-screen`, `morning-page`, `referral-board`, `referral-intake`,
   `patient-search`, `statistics-screen`, `ward-management-network`).
   `coordinator/coordinator-screen.tsx` is not among them.
3. No child receives referrals either: `PressureStrip(movements)`, `PriorityQueue(movements)`,
   `FlowDiagram(movement, movements, units, …)`, `ShortlistPanel(movement, units, …)`,
   `OverrideRegister(entries)`, `ExceptionDrawer(items, rejections)`.

`ward-referrals.ts` _is_ in the Command screen's 67-module import closure, which looks like a
counter-example and is not. It arrives via `ward-derivations.ts`, whose only referral call is
`referralState` inside `searchPatients` (`searchPatients`, `ward-derivations.ts`, ~`:892`) — a
function the Command screen never calls. It belongs to the Patient search board.

**A referral is never converted into a movement.** `ACCEPT_REFERRAL`
(`ward-flow-reducer.ts`, ~`:1989`) does not touch `state.movements` at all. The one branch that
creates a movement is `RAISE_REFERRAL`'s movement-creating case (`ward-flow-reducer.ts`, ~`:503`),
which requires an `edId` and refuses without one — a different act, named confusingly alike. So a
community referral cannot reach the Command screen indirectly either.

> ⚠️ `searchPatients`'s own doc comment says "An accepted referral has a movement". Measured
> against the reducer, nothing creates one. Either the comment is stale or a fixture supplies the
> pairing by hand. Flagged, not fixed — it is outside this task.

---

## Surface list 1 — the Command screen (`/mockups/ward-flow`, `coordinator/**`)

Every place a referral or a referral-derived count reaches the reader. **All eleven are
movement-derived; none can carry a community referral today.**

| #   | File · line                        | What the reader sees                                                                                            | Community referral possible?       |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | `pressure-strip.tsx:42`            | "_N_ departments"                                                                                               | No — `edPressure(now, movements)`  |
| 2   | `pressure-strip.tsx:90`            | "_N_ waiting · longest _H_h _M_m" per department                                                                | No — movements                     |
| 3   | `pressure-strip.tsx:95`            | "_N_ breaching"                                                                                                 | No — movements                     |
| 4   | `priority-queue.tsx:55`            | "_N_ open movements"                                                                                            | No — `queueOrder(movements)`       |
| 5   | `priority-queue.tsx:104`–`129`     | One row per movement: id, urgent flag, tier, wait, cohort, security, origin ED, operational score, legal breach | No — movements                     |
| 6   | `coordinator-screen.tsx:250`       | "_N_ overrides"                                                                                                 | No — `allOverrides(movements)`     |
| 7   | `exception-drawer.tsx:50`          | Exceptions toggle count                                                                                         | No — `buildActionInbox(movements)` |
| 8   | `exception-drawer.tsx:71`          | "_N_ refused"                                                                                                   | No — reducer `Rejection`s          |
| 9   | `exception-drawer.tsx:97`–`99`     | Exception rows, one category of which is _exhausted parallel referrals_                                         | No — `movement.referredUnitIds`    |
| 10  | `flow-diagram.tsx:115`, `:568`     | "_WF-nnn_ — outstanding referral**s**: …" and an "Outstanding referral" badge                                   | No — ward unit ids                 |
| 11  | `shortlist-panel.tsx:566`, `:1063` | "Parallel referral: _unit name_" badges; "up to _N_ parallel referrals at once"                                 | No — ward unit ids                 |

**On the narrow reading of "the coordinator's screen", the ruling is already satisfied and half
two is a no-op.** That is a real possible answer, and the owner should be told so plainly rather
than have a change built to look like compliance.

---

## Surface list 2 — the coordinator's other screens, where it _can_ appear

The Command screen is one of eight modes on the coordinator's own rail (`WARD_VIEWS`, `ward-nav.ts`, ~`:43`),
plus the boards below it. A **queued** community referral reaches the reader on each of these.

The **Derives from** column is the one that decides how much work half two is. `QUEUE` means the
surface calls `referralQueueOrder`, so one change there reaches it. `FULL LIST` means it walks
`referrals` itself and a fix to `referralQueueOrder` will **not** reach it.

| #   | Screen · route                     | File · line                             | Derives from  | What the reader sees                                                                                                                                                   |
| --- | ---------------------------------- | --------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | **Network** · `/network`           | `ward-management-network.tsx:873`       | **QUEUE**     | "Referral queue" panel count                                                                                                                                           |
| 13  | Network                            | `ward-management-network.tsx:876`–`903` | **QUEUE**     | One row per queued referral: id, wait clock, tier, person facts; clicking makes it the diagram's subject                                                               |
| 14  | **Referral board** · `/referrals`  | `referral-board.tsx:197`                | **QUEUE**     | "Queued (_N_)"                                                                                                                                                         |
| 15  | Referral board                     | `referral-board.tsx:227`, `:258`        | **QUEUE**     | Queued referral cards and table rows                                                                                                                                   |
| 16  | Referral board                     | `referral-board.tsx:293`                | **FULL LIST** | "Recently decided (_N_)" — `recentlyDecidedReferrals`. **RF-007, the one seeded community referral, is here today**                                                    |
| 17  | Referral board                     | `referral-board.tsx:327`, `:347`        | **FULL LIST** | Recently-decided cards and rows                                                                                                                                        |
| 18  | **Morning bed state** · `/morning` | `morning-page.tsx:373`                  | **QUEUE**     | The "people waiting" headline number — `peopleWaitingCount` is exactly `referralQueueOrder(referrals).length` (`peopleWaitingCount`, `ward-morning-rollup.ts`, ~`:72`) |
| 19  | **Patient search** · `/search`     | `patient-search.tsx:218`                | **FULL LIST** | "_N_ matches", counting queued referrals and movements together                                                                                                        |
| 20  | Patient search                     | `patient-search.tsx:238`                | **FULL LIST** | "Referral from _SITE_ · _band_ · _region_ — waiting for a decision"                                                                                                    |
| 21  | **Statistics** · `/statistics`     | `statistics/statistics-screen.tsx:450`  | **FULL LIST** | "From a referral being raised to a bed being taken" — `referralToBedJoin` (`statistics/statistics-derivations.ts`, ~`:260`) over all referrals                         |

### ⚠️ The queue is not one gate, and this is the trap in half two

Only **five** of these ten surfaces (12, 13, 14, 15, 18) go through `referralQueueOrder`
(`ward-referrals.ts`, ~`:277`), which filters on `referralState === "queued"` **and nothing else** — no
destination kind is consulted anywhere in it.

The other five do not, and two of them are the dangerous ones:

- **Patient search spells the queued filter a second time.** `searchPatients` does its own
  `.filter((referral) => referralState(referral) === "queued")` (`searchPatients`, `ward-derivations.ts`, ~`:892`) rather
  than calling `referralQueueOrder`. **A fix applied only to `referralQueueOrder` leaves surfaces
  19 and 20 still showing community referrals**, and they would look correct everywhere a
  reviewer thought to check.
- **"Recently decided" is the inverse filter** (`referralState(referral) !== "queued"`), so
  suppressing a referral from the queue does not suppress it here — it can move it _into_ here.
  RF-007 sits in this section today.

So half two touches at least three independent gates, not one. Doing it in a single place is the
shape of fix that would pass review and still be wrong.

⚠️ **Surface 21 is on `statistics/`, which Ward Builder Two must not edit.** It is listed because
the owner is deciding scope and needs it in view; if his ruling reaches it, the work belongs to
whoever owns that path.

**Checked and found NOT to be surfaces**, so nobody re-checks them: the ED, ward, board, person and
community screens render referrals but are other roles' screens, not the coordinator's.

## Surface list 3 — four found by a second, independent audit (2026-09-01)

The list above was re-derived from scratch by an independent audit that was told to find what the
first pass missed rather than to confirm it. **It found four more, and one of them defeats the
planned fix.** All four verified by reading the cited lines directly.

| #   | Screen · route                         | File · line                                                                                                                                                 | Derives from                     | What the reader sees                                      |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------- |
| 22  | **Referral board** → match view        | `referrals/referral-match.tsx:174`–`176`                                                                                                                    | **FULL LIST**                    | A community referral **names its own destination**        |
| 23  | **Referral intake** · `/referrals/new` | rendered at `referral-intake.tsx:1110`; computed by `waitFigure` (`referral-destination-options.ts`, ~`:302`)                                               | **ADDRESSING-LEVEL — see below** | A live count of queued community referrals + longest wait |
| 24  | ED screen · `/ed/peel-ed`              | `ward-ed-inbox` section (`ed/ed-screen.tsx`, ~`:816`), rows ~`:835`                                                                                         | FULL LIST                        | "Psychiatry inbox · _N_ referrals" and rows               |
| 25  | Community hub · `/community/[teamId]`  | `CommunityScreen`'s list panels (`community/community-screen.tsx`, ~`:207`), all fed by `communityHubLists` (`community/community-derivations.ts`, ~`:210`) | FULL LIST                        | Every list on the page is referral-derived                |

### Ruled by Ward Lead, 2026-09-01 — CONSIDERED AND EXCLUDED, not overlooked

An omission and a decision look identical to a later reader, so each exclusion is recorded with the
reason rather than left off the list.

- **Surface 23 — excluded, deliberately.** The rule exists so a coordinator's bed-flow work is not
  cluttered with discharge referrals. A wait figure beside a checkbox on the form for raising a
  **new** referral is not work — it is context for the person filling the form in, and it is an
  aggregate count, not a named patient flagged to action. Nothing on that form says "here is a
  community referral for you to deal with." **This exclusion is a judgement, and the projection
  genuinely cannot reach the surface anyway** — so if it is ever overturned, it needs its own fix at
  `waitFigure` (`referral-destination-options.ts`, ~`:302`), not a wider projection.
- **Surface 24 — excluded.** The ED's psychiatry inbox is the emergency department's own screen, not
  the coordinator's, and it never prints the community destination — only `edId` and `purpose`.
- **Surface 25 — excluded.** The community hub is the community team's own screen, and the owner's
  ruling explicitly says nothing about the community hub. Community referrals still exist and are
  still the community side's business; this suppresses them on the coordinator's screen only.

### Surface 22 is closed TRANSITIVELY by the projection — and that needs its own test

`ReferralMatchView` renders only for `selectedReferral` (`referral-board.tsx:170`), and
`selectedReferral` is drawn from the board's own queued and decided lists. **If the projection
removes community-only referrals from both lists, no community-only referral can ever be selected**,
so the `:171` early return — the branch that prints the destination kinds by name — becomes
unreachable for exactly the referrals the ruling is about. Neither file needs editing.

⚠️ **"Unreachable by construction" is true until somebody adds a second way to select a referral.**
So this needs an assertion on the **selection path**, not on the render: a community-only referral
cannot be selected on the board. That is the cheap test that keeps surface 22 closed as the board
grows, and without it the closure is an argument rather than a guard.

### Surface 22 — a community referral introduces itself by name

`referral-match.tsx` is mounted by `referral-board.tsx:170` for whichever referral is selected. When
the referral has **no ward addressing** — which is exactly the community-only case — it takes an
early return at `:171` and renders:

> _"{referral.id} was sent to {referralDestinationLabels(referral).join(", ").toLowerCase()} — none
> of which is answered by matching a bed. There is no bed shortlist for this referral."_

So the branch a community referral takes is the branch that prints its destination kinds verbatim.

### ⚠️ Surface 23 — the addressing-level filter, and the reason a referral-level rule is not enough

`waitFigure` (`referral-destination-options.ts`, ~`:302`) does **not** filter on `referralState`. It
filters one level down, on the individual addressing:

```ts
inputs.referrals.filter((referral) =>
  referral.destinations.some((addressing) => addressing.destination.kind === kind && addressing.state === "queued"),
);
```

`kind` iterates **every** `ReferralDestinationKind`, `community_team` included, and the result
renders on the intake form as _"N referral(s) to this kind of destination are waiting for an answer
now; the longest has waited X."_ — beside a checkbox the user has not ticked. The intake form is
linked from the referral board's own header (`referral-board.tsx:161`), so it is reachable from the
coordinator's work.

**This is a different axis from every other surface in this document.** Surfaces 12–21 ask _what
state is this referral in_; this one asks _what state is this one destination in_. A rule expressed
over `Referral` — including the projection being built in `ward-referral-visibility.ts` — reads
`referralState` or the destination kinds of the whole record, and **cannot reach a filter that
never consults either.**

**So the projection will not fix surface 23, and nothing about the finished build will look
incomplete.** That is the same failure shape as the `searchPatients` second spelling, one level
further down: the fix lands, the reviewer checks the places a fix would naturally go, and the
missed surface is not one of them. Predicted as a category by Ward Verifier before this audit ran;
this is the confirmed instance.

Whoever wires the call sites needs to decide surface 23 deliberately — it is not covered, and
"the projection covers every queued filter" must not be assumed.

## ⚠️ Surface 26 — found by trying to FALSIFY this document, and it breaks an argument above

**`ward-management-network.tsx` — `ReferralPlacementSummary`, defined `:479`–`:505`, mounted at
`:1084`–`:1085`** inside an `<aside>` labelled "Referral placement". Verified at HEAD.

Selecting any referral in the Network queue renders its id, urgency tier,
`referralPersonFacts(...)` — **age band, sex and home region** — both clocks, and the sentence
_"Every unit in the network carries its own verdict for this referral on the diagram…"_

**Derives from: FULL LIST**, via `selectedReferral`.

### Why this document missed it, which is the point

Entries 12 and 13 are the only two places `referralQueueOrder`'s result reaches JSX in that file.
**That is exactly what a filter-first derivation produces.** This aside is reached through component
state resolved back out of the queue two hundred lines away — **nothing about the filter leads you
there; only following the render does.** The assignment's falsifier named this precise failure, and
the first pass committed it.

### ⚠️ It is live, and it is worse than an omission

A community-only referral **reaches it today**: `referralQueueOrder` gates on
`referralState === "queued"` and nothing else, so such a referral is selectable — and its
`placements` are empty, because `referralCandidates` only runs when a ward addressing exists. **So
the panel prints a patient's identity and clocks beneath a sentence promising per-unit verdicts,
while the diagram shows nothing.**

### ⚠️ And it falsifies the hedge this document makes about surface 22

Above, this document says _"'unreachable by construction' is true until somebody adds a second way
to select a referral."_ **A second selection path already exists — `setSelectedReferralId` (`ward-management-network.tsx`,
~`:881`) — and this document did not know it.** So the "closed
transitively" argument for surface 22 holds for the referral board and **does not hold for the
Network screen.** The selection-path assertion recommended there is scoped to a door that is not the
only one.

### ⚠️ The Out of area board is NOT a referral surface, and a grep says it is

`out-of-area-board.tsx` calls `outOfAreaLedger` (`out-of-area/out-of-area-board.tsx`, ~`:83`),
which iterates **admissions**, not referrals, despite living in `ward-referrals.ts`
(`outOfAreaLedger`, `ward-referrals.ts`, ~`:788`). It imports nothing else from that
module (`:12`).

A search for `recentlyDecidedReferrals` **does** match this file — at ~`:30`, inside a doc comment
whose sentence is _"it answers a different question and must never be reached for here."_ **The
grep hit is the prohibition, not a call.** Verified 2026-09-01 after Ward Verifier reported the
opposite from a filename-level match; the disagreement is resolved in favour of "not a surface",
and the evidence is the comment's own text.

This matters beyond the bookkeeping: it removes a constraint from half two. Nothing outside the
coordinator's screens consumes `recentlyDecidedReferrals`, so changing that function's behaviour
has no third-party casualty.

---

## Three things that will decide whether any rule written next is correct

### 1. A referral can be addressed to community **and** to a ward at the same time

`RF-007` (`ward-movements.ts:1301`, its community destination at `:1332`) holds two destinations:
`community_team` ("Inner City Clinic", queued) **and** `psychiatric_ward` (accepted at
`bty-youth`). Independently confirmed by Ward Builder One. This is not an oddity of the seed —
the intake form's `destinationKinds` is a multi-select array (`referral-intake.tsx:247`,
`:636`–`:640`), so a clinician can raise exactly this at runtime, with **both** destinations
queued.

**So "a referral to community" is not a category a referral is in or out of.** A rule written as
_"the referral's destination is community"_ has no answer for RF-007, and the plausible-looking
implementations disagree:

- `destinations.some(d => d.kind === "community_team")` → hides a patient who is **also** waiting
  for a ward bed. That is a live bed request disappearing from the coordinator's queue.
- `destinations.every(d => d.kind === "community_team")` → keeps RF-007 visible, and takes out only
  referrals that are _purely_ community.

The second matches the owner's reasoning — a community-only referral is discharge planning; a
referral that also asks for a bed is still arriving at the bed question.

`RF-007` is `accepted` today (any accepted destination makes the whole referral accepted,
`referralState`'s accepted branch, `ward-referrals.ts`, ~`:59`) — its **ward arm is the accepted
one**, so it renders on Recently decided and never in the queue. It is not "a patient waiting for
both".

### RULED, 2026-09-01 — and the ruling does not close the case

The owner, asked directly: _"No... i already noted that a community referral is never going to
happen when a ward needs a referral."_

So `{psychiatric_ward, community_team}` **does not occur clinically**. But it is **freely creatable
in the product today**: the intake form builds destinations from one independent checkbox per kind
(the checkbox markup is at `referral-intake.tsx:1085`–`1099`; `destinationsFor`
(`referral-intake.tsx`, ~`:183`) is the derivation, not the form), and neither the form nor the
reducer forbids ticking both. Two
clicks. And the seed contains one — which makes **`RF-007` a data defect** rather than an awkward
fixture, now raised with the chat that owns that file.

The honest statement is therefore neither "this happens" nor "this cannot happen". It is: **the
owner says it should not arise, and nothing stops it arising.** So the rule must still decide — it
is deciding about a data defect rather than a supported clinical shape. The right place to prevent
it is the intake form, not a visibility rule; every downstream reader otherwise has to decide what
a meaningless combination means, and this document is only the first.

### `{emergency_department, community_team}` — RULED visible, 2026-09-01

Asked whether a coordinator should still see someone waiting for a psychiatric review in an
emergency department who also has a community team asked to pick them up, the owner answered:
**"yes keep them visible"**.

The reasoning that matches it: an ED arm means somebody is sitting in a department awaiting a
psychiatry decision — upstream of the bed question, exactly like `RF-009`. The community arm is
planning for an outcome that has not happened yet.

**That closes the whole space.** With `{ward, community}` refused at the intake form and this one
ruled visible, every reachable combination is decided:

| Destinations            | Coordinator's screen   | Authority                                         |
| ----------------------- | ---------------------- | ------------------------------------------------- |
| `{ward}`                | visible                | unchanged                                         |
| `{ED}`                  | **visible**            | RF-009, ruled                                     |
| `{community}`           | **hidden**             | the ruling this document serves                   |
| `{ward, ED}`            | visible                | both arms upstream                                |
| `{ward, community}`     | ⚠️ **still creatable** | **ruled refused at intake — NOT YET IMPLEMENTED** |
| `{ED, community}`       | **visible**            | ruled 2026-09-01                                  |
| `{ward, ED, community}` | **cannot occur**       | contains `{ward, community}`                      |

⚠️ **RE-VERIFIED 2026-09-01, and the table above overstated one row.** `toggleDestination` in
`referral-intake.tsx` was read directly: **there is no cross-kind exclusion logic of any kind.** Both
boxes can still be ticked together today. The refusal is _ruled_ and _not yet built_, and this
document previously stated it as settled — which is the same failure it documents elsewhere, a
ruling recorded as though it were code. The rule below therefore still has to handle the
combination, and will until the intake change lands.

"Cannot occur" means _cannot be created from now on_. It does not mean _does not exist_: `RF-007`
carries `{ward, community}` today, and referrals raised before the intake refusal keep whatever
shape they were given. **Data that predates a rule is an ordinary and permanent category**, which
is why the rule still has to handle a combination the product will no longer produce.

⚠️ **The rule is correct on every reachable combination, and that is not luck — the reachable space
was narrowed to where it is right.** Which is precisely why the predicate must still classify
direction over an **exhaustive `switch` with no `default` arm**: this table is complete today, and
a fourth destination kind would silently invalidate it with nothing going red. A compile error is
worth more against a complete table, not less.

### 2. `RF-009` confirms the criterion is direction, not "asks for no bed"

`RF-009` (`ward-movements.ts`, last entry) is a single `emergency_department` destination,
`purpose: "psychiatric_review"`, queued, and asks for **no ward bed at all**. The owner has ruled
it **stays**. So any rule keyed on "asks for no bed" gives the wrong answer here. The criterion is
direction: arriving at the bed question stays, already left it goes.

### 3. `ward-referral-visibility.ts` is a plausible home that is currently wired to nothing

The assignment asked whether the rule belongs there rather than becoming a second mechanism. The
answer is a genuine yes-but: `coordinatorScopedReferral` and `coordinatorScopedReferrals` exist,
are typed, and are covered by tests — but **no production file calls either one.** The module's
only production consumer is `ward/ward-screen.tsx`, which uses the _ward_ projection.

So it is the right shape and the wrong wire. Putting the rule there today changes no pixel on any
of surfaces 12–21, because nothing renders through it. Adopting it means wiring the coordinator
surfaces to the projection first — a larger change than a filter, and a better one, but Ward Lead
should choose it deliberately.

> This is not dead code. It is a contract whose consumer has not been written yet, and the repo's
> own dead-code rule exists because that is indistinguishable from debris under a reachability
> scan.

---

## Scope: RULED, 2026-09-01 — the wider reading

Put to the owner as a closed question — _"just the bed waiting list, or the whole screen?"_ — and
answered: **"the whole screen."**

So the rule is not about what enters the bed-matching queue. It is about what the coordinator's
screen renders **at all**: not a queue, not a recently-decided list, not a count, not a pressure
figure. **Surfaces 12–21 are therefore the work list for half two, not background information.**

Two limits on that ruling, so the wider reading does not travel further than it was sent:

- **It says nothing about the community hub.** Community referrals still exist and are still the
  community side's business. This suppresses them on the coordinator's screen; it does not
  suppress them.
- **It does not touch `RF-009`.** An emergency-department referral is not a community referral.

### Still open, and half two cannot be finished without it

**Mixed referrals.** When one referral asks a community team **and** a ward, does it stay or go?
The scope ruling does not answer this, because the question is not about which surface — it is
about which records the word "community referral" covers. My recommendation is **stays**: it is
still arriving at the bed question, which is the owner's own direction criterion. Section 1 above
has the evidence. Until it is answered, implement `every` (community-only), which is the reading
that cannot hide a live bed request, and leave the `some` variant unwritten.

### The invariant every candidate rule must satisfy

Keep `RF-009` in and take a community-only referral out, **proved by a test that exercises both**.
Either half alone passes against a wrong rule: "asks for no bed" also removes community, and
"is a referral" also keeps RF-009. Only the pair separates direction from the alternatives.
