# Ward Flow Phase 6 — The morning page

**Status:** design, written 2026-08-27. Implementation plan follows separately.

**One sentence:** one page a bed coordinator opens at the start of a shift that answers "how many
beds are there right now, and where" — built entirely from figures Phase 5 already produces, holding
still so it can be printed and argued over, and able to demonstrate itself in sixty seconds.

**Inputs, not outputs.** The product owner's answers in `docs/ward-flow-phase-6-7-decisions.md`
(questions 1, 2, 3, 4 and 12) and `docs/ward-flow-roadmap.md` decision 13 are settled and are not
re-derived here. A further answer given on 2026-08-27 — that the prototype stays inside the
administrator-gated sandbox and the shareable artefact is the printed page and the live
demonstration, not a public link — is recorded in D9.

---

## Read this before anything below: the foundation is not validated

`predicted → confirmed → blocked → released` is **a software model of how a bed comes free, and no
ward clinician has checked it.** It is Phase 5's spec D14, it is still open, and
`docs/ward-flow-clinician-check.md` is the one-page summary waiting to go to a clinician.

Every figure on the morning page is derived from those four words. That makes this page the point at
which a wrong model starts becoming expensive, which is exactly why the roadmap put the clinician
check ahead of it.

Two decisions below exist solely to keep the reversal cheap:

- **D1** forbids this page from computing any figure of its own, so a change to the states changes
  Phase 5's derivation and this page inherits it.
- **D14** names, exactly, the three places the four words appear as text on this page — and there is
  nothing else.

**If the product owner reports what a clinician said, that answer overrides this specification
immediately** and D14 is the change list.

---

## Why this phase, and why it is small

Ward Flow has eleven boards and no front page. A bed coordinator starting a shift currently has to
open the capacity board, read it unit by unit, and hold the arithmetic in their head to answer the
only question they actually have: is there a bed, and where.

The phase is small on purpose, and the reason is not economy. **Its real output is an artefact that
can be put in front of a colleague** — a page that holds still, prints, and explains itself without
anyone narrating over a shoulder. Finding out whether any of this is right is worth more than the
next feature, and nothing else in the backlog produces that.

It is also the cheapest phase available, because Phase 5 already produced every number it needs.
Phase 6 adds a _view_, one derivation that rolls existing figures up, and a demonstration.

---

## What already exists — extend it, do not rebuild it

Phase 5's own worst near-miss was two vocabularies for the same beds on one screen. The single
largest risk in a roll-up page is repeating that, so this section is binding rather than
informational.

| Already built                                                                               | Where                                         | How Phase 6 uses it                               |
| ------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| `capacityBreakdown(unit, releases, leave, now)` — the five figures                          | `ward-bed-availability.ts`                    | The **only** source of a per-unit figure          |
| `releaseBand()` and the four bands ending at `EVENING_SHIFT_END_MINUTES`                    | `ward-bed-availability.ts`                    | Untouched; the exclusion count comes from it      |
| `WardFreshness` — `Confirmed HH:MM · Role` / `As at HH:MM` / `Never confirmed`              | `ward-freshness.tsx`                          | Rendered on every figure, with D4's roll-up rule  |
| A **frozen point-in-time page** that closes over one `now` read in a `useState` initialiser | `handover/handover-page.tsx`                  | The freeze mechanism, reused exactly              |
| A **print stylesheet** with the forced-colors and global-print-reset traps already solved   | `handover/handover.module.css` `@media print` | The print approach, reused rather than re-derived |
| The "not a medical device" prose banner                                                     | five screens, including `handover-page.tsx`   | Same pattern, same placement                      |
| `SET_SCENARIO`, `RESET_SCENARIO`, `ADVANCE_CLOCK`, and the role gate                        | `ward-flow-events.ts`, `ward-flow-reducer.ts` | The guided tour dispatches these and nothing new  |
| `Rejection` — the first-class visible refusal                                               | `ward-model.ts`                               | Any refused tour step surfaces as one             |

**The frozen-handover page is the important one.** `HandoverPage` already solves "a page that stops
moving": it reads `now` once inside a `useState` initialiser, and no section below it reads the live
clock again. That mechanism is proven, is documented in its own doc comment, and Phase 6 reuses it
rather than inventing a second way to freeze a page.

---

## Scope

**In:**

1. A morning bed-state page, whole service, grouped by hospital, roll-up first.
2. One new derivation: the service-wide and per-site roll-up of Phase 5's five figures.
3. The fixed/live pair — fixed by default, live one click away.
4. Printing, treated as a requirement with a check, not as a nicety.
5. A sixty-second self-driving guided tour.

**Out, and deliberately so:** anything requiring a figure Phase 5 does not already produce; demand
(how many people are waiting — see below); trend, history or yesterday's comparison; any
configurability at all; distance, out-of-area and the country pathway (Phase 8); escalation tiers,
waiting-time equity and notifications (Phase 9); named moments on the demo clock (deferred by the
owner in the decisions document); a route a colleague without an administrator account could open
(owner's decision, 2026-08-27 — see D9).

**On leaving demand out**, since a supply-only morning page is arguably half a page: the owner's
headline decision is beds available, and Phase 7 is where the referral queue becomes a real number
rather than a count of movements that happen to be open in an emergency department. Adding a demand
figure now would mean building it twice. If the page reads thin when it is on screen, this is the
first thing to add and it belongs to Phase 7's data, not Phase 6's.

---

## Decisions

### D1 — This page computes no figure of its own

Every number it shows is either a value returned by `capacityBreakdown()` for a single unit, or a
sum of those values produced by the one new derivation this phase adds. The page itself performs no
arithmetic and reads no release, leave bed or band directly.

**Why this is a decision and not a style preference.** Phase 5's screenshot sweep found a capacity
board that contradicted its own headline: the headline separated confirmed from predicted and
excluded beyond-tonight, while a per-unit column three inches away still showed the raw
undifferentiated count. That defect was invisible to more than ten thousand passing tests. A roll-up
page is the highest-risk possible place for that class of error, because a sum and its parts are on
the same screen by definition.

It is also the mechanism that makes the unvalidated four-state model cheap to change: a page with no
arithmetic of its own has nothing to update when the arithmetic changes.

**Expensive to change later:** no. This constrains Phase 6 only.

### D2 — The headline is one number, and nothing is ever added to it

**Beds available right now, across the whole service** — the sum of `availableNow` over every unit in
the network, and nothing else, ever.

This is Phase 5's D6 rule carried forward unweakened, and it is the rule Phase 6 must not break.
Nothing predicted, nothing confirmed-but-unreleased, and nothing on leave may reach this figure by
any path.

The roll-up derivation must inherit Phase 5's _structural_ protection rather than merely agreeing
with it arithmetically: `availableNow` is computed from `unit.allocatable` and `unit.empty` before
any release or leave bed is examined, so a prediction is incapable of inflating it. The roll-up sums
that field and never re-derives it, and the contract test in Verification asserts that no code path
reaching the headline has ever read a `BedRelease`.

**Expensive to change later:** irrelevant — it will not change. It is the promise the whole hub rests
on.

### D3 — Five figures, one vocabulary, and the exclusion count stated aloud

The page shows the same five figures as the capacity board, in the same order, with the same words:

> **Available now · Confirmed today · Predicted today · Held · Leave (usable)**

Never summed, never combined, never relabelled. At service level, at hospital level and at unit
level, identical vocabulary.

Beneath them, the count of releases excluded for falling beyond tonight — **stated even when it is
zero**, exactly as the discharge board states it. Silent truncation reads as "we counted everything"
when we did not.

**Why the vocabulary rule is explicit.** Phase 5's fourth screenshot defect was a ward screen saying
"Potential 1" for the same unit the capacity board described as "Confirmed 1, Predicted 0" — two
vocabularies for the same beds. A page whose entire job is to be the number everyone quotes cannot
introduce a third.

### D4 — A roll-up is only as fresh as its stalest part, and "never confirmed" beats any number

This is the one genuinely new derivation in the phase, and it is where a bug would hide.

- The freshness stamp on a **sum** is the **oldest** contributing confirmation — not the newest, not
  the average. A total confirmed at 06:10 by one ward and 10:22 by eight others is a 06:10 total.
- If **any** contributing unit has never confirmed, the roll-up does **not** present a total as
  though it were complete. It shows the figure it can compute and says, in words, how many units are
  unconfirmed: _"14 of 15 wards confirmed · 1 never confirmed"_.
- A unit that has never confirmed reads **"Never confirmed"**, never zero. Zero is a claim.

**Why.** Phase 5's D7 gave every screen a freshness stamp because a board that looks authoritative
and cannot say how old it is invites the reader to assume it is current. A roll-up makes that worse,
not better: aggregation hides the stale contributor completely, and a newest-wins stamp would
actively assert freshness the data does not have. This page is designed to be printed and quoted,
which is precisely the circumstance in which an over-confident timestamp does damage.

**Expensive to change later:** no — but it is the decision most likely to be implemented wrongly by
someone who reads "freshness" and reaches for the most recent value.

### D5 — "Fixed at the morning handover" means frozen to a named instant, not frozen to page-open

The demo clock advances in real time (`now = NOW_ANCHOR + elapsed + clockOffsetMinutes`), so "fixed"
has to be given a precise meaning. There were two candidates and they behave differently:

- **Frozen at page open** — the existing `HandoverPage` mechanism. The page stops moving, but two
  coordinators opening it eleven minutes apart see two different sets of numbers.
- **Frozen to the morning handover instant** — the page computes at a named time of day and holds it,
  so everyone who opens it that day sees the identical page.

**Chosen: the second, using the first's mechanism.** Introduce one named constant:

```
MORNING_HANDOVER_MINUTES = 8 * 60   // 08:00
```

and freeze to it inside the same single-read `useState` initialiser the handover page already uses.

**Why.** Roadmap decision 13 exists because "the moment two services can arrange it differently they
quote different numbers at each other, which was the one thing the page existed to prevent."
Page-open freezing reintroduces exactly that, one clock tick at a time. The owner's stated reason for
wanting the page fixed — that a page which stops moving can be printed, pinned up and argued over —
is satisfied by both, but only the named instant survives two people arguing over it.

**08:00 is a synthetic convenience, not a claim about how any service runs its shifts.** It is one
named constant for the same reason 22:00 is: Phase 5's D5 wrote the day-end boundary down "so it can
be changed in one place", and when the owner asked for midnight and then reverted, one constant and
one assertion moved and no code ever shipped at the wrong value. If a clinician says the metro
handover is 07:30, this is a one-line change.

**Failure behaviour, which matters here.** If the demo clock is _before_ 08:00 on the current
operating day, there is no morning handover for that day yet. The page says so — _"The 08:00 handover
has not been taken for this day"_ — and offers the live view. It does **not** show yesterday's
snapshot, and it does **not** silently fall back to `now`. Both would produce a page that looks
authoritative while describing a different day.

**Expensive to change later:** the time itself, no — one constant. The choice of _named instant over
page-open_, moderately: it changes the freeze call site and the failure branch above, and nothing
else, because D1 keeps the arithmetic elsewhere.

### D6 — The live view is one click away, and cannot be mistaken for the fixed one

One control, two states, same five figures, same layout, same order — only the instant changes:

> **Handover 08:00** | Live 11:42

The two views must be **visibly different at a glance**, not merely labelled differently, and each
carries its own instant next to every figure group. The live view is never the default, and it never
prints without saying which view it is.

**Why.** The danger is not that someone opens the live view; it is that someone screenshots it and
calls it the morning number. The label is the mitigation and it has to be unmissable rather than
tidy. Design-system note: distinguish the two with tokens already in `@theme` — never a hardcoded
hex, and never colour alone, since colour alone fails under forced-colors and in print.

### D7 — Grouped by hospital, fixed order, and no controls whatsoever

Service roll-up first. Then one block per hospital, each showing its own five figures, with its units
underneath. Order is derived from the site table and is stable across every opening of the page.

**There is no sort control, no filter, no column chooser, no collapsed section, no "hide empty sites",
and no saved preference.** Roadmap decision 13 is explicit that the page is fixed and not
configurable — one page, the same five figures everywhere — and the reason is recorded with it.

A consequence worth stating so nobody treats it as an oversight: a coordinator who only covers the
south metro still sees the whole state. That is deliberate. Their view of the whole picture is the
hub's entire value, and a filtered page is a page two people can arrange differently.

**Expensive to change later:** adding configurability later would be cheap in code and would undo the
decision the page exists to hold. Treat any request for it as a product question for the owner, not
an implementation detail.

### D8 — It prints on one sheet, and printing is checked rather than assumed

Portrait, one page, at a real paper size. No fixed chrome, no scroll-hidden content, no dark
background, no control that prints as an empty box, and no content that exists only on hover or
behind an interaction.

Reuse `handover.module.css`'s `@media print` block as the starting point — it already solves two
traps this repo has hit, both documented in its own comments: the global print reset forces a white
page, and `CanvasText` is used so ink colour follows the print medium rather than inheriting a screen
theme that renders nearly invisible on paper.

**Why this is a decision and not decoration.** The owner's stated reason for wanting the page fixed
is that it can be _printed, pinned up and argued over_. A page that holds still but prints as three
ragged sheets with a black background has not delivered the thing that was asked for. The
verification section carries a print check for exactly this reason.

### D9 — This is a second page, not a change to the existing shift handover

There is already a `/mockups/ward-flow/handover` page: a frozen, printable, point-in-time shift
handover built on `handoverSnapshot()`. Phase 6's page is **not** that page and must not be merged
into it.

- The existing handover answers **"what is happening to the people in flight"** — longest waits, held
  beds, in transit, placements gone wrong. Its audience is a shift handing over.
- The morning page answers **"how many beds are there, and where"**. Its audience is one bed
  coordinator starting a shift.

New route: `/mockups/ward-flow/morning`, titled **Morning bed state** so the two stay distinguishable
in the sidebar, in a browser tab and in conversation. Each page carries a one-line link to the other,
naming the question it answers.

**Registration is fail-closed in five places** and all five travel in the same change, as Phase 5's
did: sidebar nav, the two route-contract maps in tests, `scripts/ci-change-scope.mjs`, and the
generated `data/repo-awareness-snapshot.json` (regenerate with the repo's own tool, never by hand).
The repository's no-orphan-routes gate fails the build otherwise, which is the gate working.

**Reachability, and who can open it.** The prototype stays a sandbox reachable only through the
administrator-gated developer hub (owner's decision, 2026-08-27). The shareable artefact is the
printed page and the guided tour shown live, not a public URL. Whether a colleague should eventually
open a link themselves is recorded in Open questions rather than designed here.

**Alternative considered and rejected:** folding the bed figures into the existing handover page.
Rejected because the two have different audiences and different content, and because roadmap 13
requires the bed page to be fixed and non-configurable in a way the handover page is not. Worth
revisiting once both are visible — but as an owner decision, not an implementer's tidy-up.

### D10 — The guided tour drives the real reducer through the real role gate

Four beats, sixty seconds, self-driving: **a patient waiting → a coordinator finding a bed → a ward
confirming → the board updating.**

Each beat dispatches a real `WardFlowEvent` into the real reducer with the real acting role, through
the same `EVENT_ROLE` gate every screen uses. No parallel fake state, no pre-recorded frames, no
screenshots stitched together, and no privileged path.

**Why this is the whole point.** A tour built from a separate script would drift from the product the
moment either changed, and would demonstrate a thing that does not exist. A tour that had to bypass
the role gate to work would be evidence that the role model is wrong — which is information worth
having, not something to route around.

If a beat is refused, the refusal surfaces as a visible `Rejection` like any other, and the tour stops
there rather than skipping ahead.

**Expensive to change later:** no. The tour is a script over existing events; if the events change,
the script changes.

### D11 — The tour resets before and after, and stops at any beat

- It begins with `RESET_SCENARIO` so it always starts from the same place, and says so on screen.
- It ends by resetting, so it never leaves the demo half-finished for whoever opens the app next.
- A **Stop** control is visible for the tour's whole duration, is a real control with a real handler,
  and takes effect at the current beat rather than at the end of the run.
- Tour progress lives in local component state and **never enters the reducer's shared state.**

**Why the last point.** Shared state is the expensive thing to change. Keeping the tour's own progress
out of it means that when the four bed states are revised, the tour's script is edited and nothing
else is.

### D12 — The tour never auto-advances under reduced motion

Under `prefers-reduced-motion: reduce`, the tour does not drive itself. It becomes the same four
beats, advanced by a **Next** control, with no timed transitions and no animation.

This is not an accessibility box-tick: a self-advancing page a reader cannot keep up with is unusable
for the exact audience the page exists to persuade. Follow the repository's existing reduced-motion
handling in the ward-flow CSS modules rather than introducing a new approach, and use `min-h-12` tap
targets for the controls — **do not** reduce them to `min-h-11` for a generic accessibility rule,
which reintroduces a known `ui-smoke` flake.

### D13 — Every beat says it is synthetic, and so does the page

- The page carries the "not a medical device" prose banner, matching the five screens that already do.
- The tour carries a caption strip that **stays visible for its whole duration**, states that every
  figure is invented, and describes what the screen is doing rather than what is clinically correct.

**Why this is stated as a decision.** A self-driving demonstration is the single most persuasive
artefact this prototype will ever produce, and persuasiveness is the hazard. The page is designed to
be shown to colleagues, printed, and quoted later by someone who was in the room for sixty seconds. A
caption that appears only at the start will not be on the screenshot.

**No caption may make a clinical claim, and none may cite, paraphrase or imply any figure from the
Mental Health Act.** A plain Voluntary or Involuntary label is permitted and is not a legal figure.

### D14 — What changes if the four states turn out to be wrong

The complete list. There is nothing else, and that is the deliverable of D1:

1. The words **"Confirmed today"** in the five-figure strip.
2. The words **"Predicted today"** in the same strip, and in each per-hospital and per-unit block,
   which render the identical labels from one source.
3. The **caption for beat 3** of the guided tour ("a ward confirming").

Everything else on the page is a sum of whatever Phase 5 produces, under whatever names Phase 5 gives
them. If a clinician says a bed can be confirmed and blocked at once, or that "predicted" is really
three states, or that a confirmed discharge can go backwards, the change lands in Phase 5's model and
derivation and Phase 6 inherits it with these three strings updated.

**The implementation requirement that makes this true rather than aspirational:** the five labels are
defined once, next to the derivation, and every block renders them from that one definition. A
hardcoded label anywhere on the page breaks this decision even though every test will still pass —
which is why Verification carries an assertion for it.

---

## Data flow

Phase 5's per-unit `capacityBreakdown()` → one new roll-up derivation that sums those breakdowns by
site and then service-wide, and computes D4's oldest-contributor freshness and unconfirmed count →
the page renders service, then hospital, then unit, from that single result.

The frozen and live views call the same derivation with a different instant. Nothing else differs
between them.

The guided tour dispatches existing events; the state change flows through the reducer and the page
re-renders from the same derivation, which is what makes beat 4 ("the board updating") a real
demonstration rather than an animation.

---

## Failure behaviour

Consistent with the rest of Ward Flow, everything degrades toward saying less rather than guessing
more:

- **No morning handover yet for this operating day** → the page says so and offers the live view. It
  never shows another day's snapshot and never silently substitutes `now` (D5).
- **A unit that has never confirmed** → "Never confirmed", and the roll-up states how many units are
  in that condition rather than presenting a complete-looking total (D4).
- **The roll-up derivation cannot produce a breakdown** → the page shows **Available now** alone and
  states that the prediction is unavailable. The conservative figure survives; the optimistic one does
  not. This is Phase 5's failure rule, inherited deliberately.
- **A release outside today** → already excluded by Phase 5, and the exclusion count is stated even at
  zero (D3).
- **A tour beat refused by the role gate** → a visible `Rejection`, and the tour stops at that beat.
- **A site with no units** → shown with "No units recorded", never omitted. An omitted hospital reads
  as a hospital with no beds.

---

## Verification

The repository's rule holds throughout: no gate skipped, no assertion deleted, no test loosened, no
tolerance lowered. Every new test is mutation-tested — break what it guards, watch it go red with the
failure line quoted, restore.

**Unit tests, each mutation-tested:**

- The roll-up sums per-unit `availableNow` and nothing else.
- D4's oldest-contributor freshness. Mutate it to take the most recent value instead and watch it
  fail — this is the single most likely implementation slip in the phase.
- D4's unconfirmed-unit count, including the case where every unit has confirmed.
- D5's instant selection, including the before-08:00 branch, which must assert the _message_, not
  merely that no number was shown.
- Label single-sourcing (D14): an assertion that the five figure labels come from one definition, so a
  future hardcoded label fails rather than silently costing the cheap reversal.

**Contract test:** no code path reaching the headline figure has read a `BedRelease` or a `LeaveBed`.
This is Phase 5's structural protection extended to the roll-up, and it is stronger than asserting the
arithmetic happens to agree today.

**Browser proof — spend it deliberately.** `scripts/run-playwright.mjs` builds a full isolated
production app per invocation, so this is the expensive gate. One Chromium journey covering: the fixed
page renders with its instant stated; the live toggle changes the instant and the two views are
distinguishable; the tour runs to completion and the board visibly changes at beat 4; **Stop** halts
the tour at the current beat.

Prove the journey can fail before trusting it. Read **both** the exit status and the "N passed" line:
`75` means blocked by the run coordinator and should be retried, any other non-zero means red, and
exit 0 with no result line means nothing ran.

**Print check:** the page is captured at print width and looked at. A print stylesheet that has never
been rendered is not evidence, and D8 is a requirement rather than a nicety.

**Screenshots at 390 / 820 / 1440, looked at rather than assumed.** Phase 5 found four real defects
this way that more than ten thousand passing tests missed, and the roll-up page is the same class of
surface. Capture the fixed view, the live view, and at least one mid-tour beat.

**Not run, and why:** `verify:release`, every `eval:*` script, `check:supabase-project` and `test:live`
are provider-backed and forbidden by the standing constraints.

---

## Success criteria

1. A bed coordinator can answer "is there a bed, and where" from one screen without arithmetic.
2. The headline figure has never been touched by anything predicted, confirmed-but-unreleased, or on
   leave.
3. Two people opening the page on the same day see the identical page.
4. It prints on one sheet and is legible on paper.
5. The tour runs unattended, is stoppable, and leaves the demo where it found it.
6. Not one new fact about any patient has entered the system.
7. If the four-state model is wrong, the fix to this page is three strings.

---

## Risks

- **The four-state model is unvalidated (Phase 5 D14).** This page is built entirely on it. D1 and D14
  are the mitigation; the clinician check is the actual answer, and it is still owed.
- **Real hospital names carry synthetic figures.** The site table uses real WA hospital names (Royal
  Perth, Sir Charles Gairdner, Fiona Stanley, Armadale, St John of God Midland, Rockingham, Joondalup,
  Peel) while every bed number beside them is invented. That is pre-existing and not Phase 6's to
  change — but Phase 6 is the first page _designed to be shown to colleagues and printed_, which is
  the circumstance in which a synthetic figure next to a real hospital's name gets quoted out of
  context. The banner (D13) is a mitigation, not a fix. **Whether the site table should become clearly
  synthetic before this page is shown widely is a question for the product owner**, recorded below.
- **A roll-up is the easiest place to contradict yourself.** D1 and D3 exist because Phase 5 already
  produced that exact defect on a smaller screen, and it was invisible to every automated check.
- **The tour is the most persuasive thing here, which makes it the most dangerous.** D13's standing
  caption is the mitigation.
- **08:00 is invented.** So is 22:00. Both are named constants precisely so a clinician can correct
  them cheaply, and the page must never imply either is a standard.
- **A page designed to hold still invites staleness.** D4's oldest-contributor rule and D6's
  unmissable live toggle are the answers; neither removes the risk that a printed page outlives its
  numbers on a pinboard.

---

## Assumptions, and what each would cost to reverse

| Decision                        | Status                                                                         | Reversal cost                                                            |
| ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| D1, D2                          | Settled policy, inherited from Phase 5                                         | Not for reversal — D2 is the promise the hub rests on                    |
| D3                              | Follows from Phase 5 D6                                                        | Cheap; labels are single-sourced by D14                                  |
| D4                              | **Assumption.** No coordinator has said an oldest-wins stamp is what they want | Cheap — one derivation, one test                                         |
| D5 (08:00)                      | **Assumption.** Invented; no clinician has been asked when metro handover is   | One constant, one assertion                                              |
| D5 (named instant vs page-open) | Design judgement, reasoned from roadmap 13                                     | Moderate — the freeze call site and one failure branch                   |
| D6, D7                          | Settled by owner decisions 3 and 13                                            | D7 reversal is cheap in code and undoes the decision — owner's call only |
| D8                              | Follows from the owner's stated reason for a fixed page                        | Cheap                                                                    |
| D9                              | Design judgement, plus the owner's answer on reachability                      | Merging the two pages later is moderate; changing reachability is larger |
| D10–D13                         | Design judgement                                                               | Cheap — the tour is a script over existing events                        |
| D14                             | The mechanism that keeps the foundation cheap                                  | Reversing it is what makes everything else expensive                     |
| **The four bed states**         | **UNVALIDATED — the assumption most likely to be wrong**                       | **Three strings on this page, by construction (D1, D14)**                |

---

## Open questions for the product owner

Neither blocks the implementation of this phase.

1. **The site table uses real hospital names beside invented bed numbers.** Phase 6 is the first page
   built to be shown around and printed. Should the sites become clearly synthetic before that
   happens, or is the banner enough?
2. **Should the morning page and the existing shift handover eventually be one page?** They answer
   different questions today (D9). That may look different once both are on screen together.
