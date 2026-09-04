# Ward Flow — build plan: the community hub and the ED home

**Written by Ward Builder Two, 2026-09-04. Read against `codex/task-ward-flow-live-state-20260831`.**
Nothing here was measured in a working tree; every fact below came from `git show <ref>:<path>`.

These two screens go first because between them they exercise nearly every primitive. **If the design
language is wrong anywhere, it fails here rather than eight screens later.**

---

## The two decisions this plan was asked to settle

### Decision 1 — TWO components. ⚠️ REVERSED 2026-09-04, and the reversal is the point

🔴 **SUPERSEDED. The first version of this section concluded ONE component with a scope prop, and it
was correct under the answer that held at the time.** It was written as a condition with a test rather
than a conclusion, and **the condition fired within the hour**: the owner has ruled that **community
becomes its own page and its own first-class role**, alongside ED, Coordinator and Wards — and that a
**community team may NOT see that the patient was referred anywhere else. Same restriction as a ward.**

**The superseded reasoning is kept below the line, because a plan that silently rewrites its own
conclusion hides that the conclusion was ever different.**

#### What is true now

**There are three views, not two, and two of them look identical:**

| View                   | Viewer        | Entitlement                                                   |
| ---------------------- | ------------- | ------------------------------------------------------------- |
| All community teams    | Coordinator   | Everything                                                    |
| One team, drilled into | Coordinator   | Everything                                                    |
| One team, its own hub  | **Community** | ⚠️ **Restricted — never where else the patient was referred** |

🔴 **THE COORDINATOR'S DRILL-DOWN AND THE COMMUNITY'S OWN HUB SHOW THE SAME TEAM AND ARE NOT THE SAME
SCREEN.** They differ only in what may appear on them. **That visual identity is exactly what makes a
shared component tempting, and it is the reason there must not be one.**

#### Can a shared component still be right? No, and the reason is structural rather than stylistic

The two views now read **different types with different entitlements** — `CoordinatorScopedReferral`
and the `CommunityScopedReferral` being built now. A single component would have to accept either,
which is a union or a generic, **which is a converter with the seams painted over** — and FD-23
forbids a converter and a viewer argument by name.

⚠️ **AND THE FAILURE IS WORSE THAN A WRONG RENDER. A component reached by both roles falls OUT of the
FD-23 guarded set by construction** — _"a module both roles reach is shared infrastructure by
construction"_. **So the shared component would be the one place the guard cannot see, holding the one
distinction it exists to enforce.** That was a latent hazard this morning. **It is a live one now.**

**So: two components. `CommunityTeamHub` (community's own) and the coordinator's team view are
separate files, separate tests, no shared data type.**

#### 🔴 What MAY be shared, and the trap inside it

**Presentation may be shared. Data shape may not.** Otherwise the two views drift apart and the
community hub becomes a second-class copy nobody maintains.

**But a shared presentational component is ALSO reached by both roles, so it is ALSO outside the
guarded set.** The guard will not protect it either. **Therefore a shared presentational component
must:**

- take **already-projected primitives** — strings, numbers, an array of rows — never a referral object;
- name **no** member of `FULL_REFERRAL_VOCABULARY`;
- and have **that pinned by its own test**, because FD-23 will not do it.

⚠️ **This is the rule most likely to be broken six months from now by someone being helpful**, because
passing the whole record is easier than passing eight fields, and nothing will stop them.

---

<details>
<summary>⚠️ SUPERSEDED — the original Decision 1, correct until 2026-09-04, kept so the change is visible</summary>

The prototype describes both scopes as the **same viewer**: _"All teams is the coordinator's landing"_,
_"'Open hub' switches the whole screen to that team"_. One coordinator, filtering. So FD-23 did not
bind: its mechanism needs two roles with different entitlements, and there was one role with two
filters.

**The condition recorded as reversing it, which then did:** `"community"` was already a first-class
role recording decisions; there was no community-scoped projection; and the FD-23 guard did not contain
the word. **So a community screen built that day would have been exempt from the guard before anyone
wrote a line of it — "a leak with the alarm already disconnected".**

</details>

### Decision 2 — the ED home carries no false aggregate, but two figures collide

> ⚠️ **SUPERSEDED IN PART, 2026-09-04.** Any figure, chip, banner or sentence claiming that
> somebody **is or is not being looked for** is banned from this screen, including the
> "declined by every ward asked" tile this decision wanted kept.
>
> **The ban is broader than the defect and that is deliberate.** That tile rested on recorded
> declines, which are observable; the defect it resembles rested on a MISSING referral link,
> which is not. The two are not the same mistake.
>
> It is banned for sequencing: owner ruling R-2026-09-04-D is rebuilding the movement-to-referral
> link so that _"nobody is looking for a bed for this patient"_ becomes a state the system can
> **assert** rather than infer. Standing up an inference days before the assertable version lands
> would leave two mechanisms answering one question, and the weaker one would be the one already
> on screen. **Revisit when D lands — do not reintroduce it before then.**

**Checked every tile individually rather than scanning for the shape I already knew.**

✅ **No aggregate across unlike quantities.** Unlike the statistics screen's _"Median wait, referral
to a bed — 27h"_ (one number averaging ward, community and ED waits), every ED-home figure counts one
population. The three "of N" tiles all share their denominator with their numerator: _14 of 34_,
_6 of 9_, _2 of 9_ are subsets of the stated total.

✅ **And one thing worth keeping deliberately:** _"Past 24 hours — 2 of 9 — **The department's own
access measure, not a legal deadline**"_. That distinction is exactly the kind that usually gets lost.

🔴 **BUT TWO TILES RENDER AS "2 of N" AND COUNT DIFFERENT THINGS.**

| Tile                                                     | Reads      | Actually counts |
| -------------------------------------------------------- | ---------- | --------------- |
| `.totals` — "Departments past the 24-hour access target" | **2 of 8** | **departments** |
| `.hero-figures` — "Past 24 hours"                        | **2 of 9** | **patients**    |

**Both are on the same screen, both are "2 of N", and one sits in a strip whose other four tiles all
count people.** A reader scanning `34 · 1d 6h · 14 of 34 · 7 · 2 of 8` reads the last as people
unless they read the label. **This is the statistics-screen conflation in miniature — not a wrong
number, a unit change that looks like a continuation.**

**Task 5 fixes it by wording, not by dropping either figure:** the departments tile becomes
**"Departments past their access target — 2 of 8 departments"**, and the hero tile keeps "of 9" but
names the population. **Do not "fix" this by removing one — both are real and both are wanted.**

---

## Global Constraints

**Every constraint in `docs/superpowers/plans/2026-09-04-ward-flow-design-foundation.md` applies
unchanged and is not restated here.** The four that will actually bite on these two screens:

- ⚠️ **`--ward-space-N` is N PIXELS.** `--ward-space-4` = 4px, `--ward-space-16` = 1rem. Not a scale step.
- ⚠️ **The surfaces are `--ward-ground`, `--ward-canvas`, `--ward-chrome`, `--ward-subtle`.** There is
  no `--ward-panel` and no `--ward-sunken`. The prototypes' own `:root` uses `--panel` and `--sunken`;
  **those are prototype-local names and must not be carried across.**
- ⚠️ **The only radius/stroke token is `--ward-radius-pixel` (1px).** There is no `--ward-radius-round`,
  no `--ward-stroke-thin`, no `--ward-stroke-accent` in the shared layer — those are declared locally in
  `ward-management-modes.module.css` and are not yours. Panels use the app-level `var(--radius-sm)`.
- ⚠️ **An undeclared `--ward-*` is not an error.** It renders invisible, or at full text contrast if it
  carries a `currentColor` fallback. The complete declared set is the one in `ward-tokens.module.css`;
  **check a name against that file before using it, not against this plan.**

**And one that is easy to get backwards:** contrast is a property of a _pair_. `--ward-ground` is a new
pairing for every text token, not a colour with a known ratio. The foundation plan records the quiet
text value passing 4.63:1 on white and **failing at 4.04:1 on the ground**. **Compute each pair on the
surface it actually sits on.**

---

## What this plan depends on from the navigation shell — all provisional

**`docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md` is being built right now. These are
its stated interfaces, and every one may move.**

| Depended on                                                  | Stated shape                                                      | What breaks here if it moves                                                                                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WardShell({ children, place, role })`                       | Paints the ground, renders the header region                      | Every task below assumes the ground is already painted                                                                                               |
| **`WardShell` renders NO `<h1>` and NO `<main>`**            | Stated explicitly in that plan                                    | ⚠️ **Both screens must supply their own `<h1>` and `<main>`.** If the shell later adds one, both screens gain a second and the landmark tests go red |
| `.shell` is **the only** stylesheet painting `--ward-ground` | Stated as the intent                                              | 🔴 **No stylesheet in this plan may paint `--ward-ground`.** Two painters and the token stops being a single decision                                |
| `wardPlaceFor(pathname)`                                     | `{ kind, name } \| undefined`; **`undefined` is the common case** | The ED home is an all-sites view with no single place — it must render nothing, never "—"                                                            |

⚠️ **Two shell questions are open and both touch these screens:**

1. **Whether the shell covers ten screens or all 31 routes.** Unresolved in that plan, marked _"a scope
   decision for Ward Lead or the owner"_. Both screens here are in the ten either way.
2. **Whether a screen keeps its own `<h1>` once the shell shows the place.** Marked _"a design call, not
   a technical one"_. ⚠️ **The ED home's `<h1>` is "Emergency departments — every site", which is not a
   place and cannot come from `wardPlaceFor`.** So this screen needs its own heading regardless of how
   that question lands; the community single-team scope is the one genuinely affected.

**If the shell has not landed when these tasks start, build against a local `<div>` that composes
`.wardTokens` and swap it for `WardShell` in a separate commit.** Do not block.

---

## Task 1: The community all-teams figure strip

**Files:**

- Create: `src/components/ward-management/community/community-figures.tsx`
- Test: `tests/ward-community-figures.dom.test.tsx`

**Interfaces:**

- Consumes: `WardFigure`, `WardFigureStrip` from `../ward-figure`.
- Produces: `CommunityFigures({ scope })` where `scope` is `{ kind: "all" } | { kind: "team"; teamId: string }`,
  rendering five `WardFigure` tiles inside one `WardFigureStrip`.

⚠️ **COORDINATOR-ONLY since the 2026-09-04 reversal.** Both scopes here are the coordinator's. **The
community's own hub does NOT use this component** — see Task 3b. If you find yourself adding a
`viewer` or `role` argument to this, stop: that is the converter FD-23 forbids, arriving by the back
door.

⚠️ **No figure value is hardcoded in the component.** Every number is derived from ward-flow state.
The prototype's figures (61, 38, 5d 2h, 7, 3 of 16) are **invented** and appear only as fixture values
in the test, named as such.

- [ ] **Step 1: Write the failing test**

Assert: five tiles render; **exactly two carry `flagged`**; each tile's label, value and sub are the
values the fixture supplies, not constants.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-community-figures.dom.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ward-community-figures.dom.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Prove the emphasis rule is real here, not just in the primitive**

Add `flagged` to a third tile. Re-run.
Expected: the render **throws**, with `WardFigureStrip`'s own message —
`A figure strip may flag at most two tiles; this one flags 3. Amber means "look here" and stops meaning anything when everything carries it.`
⚠️ **Confirm the test that reddens is the one asserting two flagged, by name** — not merely that
something threw. Restore.

- [ ] **Step 6: Commit**

---

## Task 2: The all-16-teams table, which is the filter

**Files:**

- Create: `src/components/ward-management/community/community-teams-table.tsx`
- Test: `tests/ward-community-teams-table.dom.test.tsx`

**Interfaces:**

- Consumes: `WardPanel`, the catchment data in `ward-catchment.ts`.
- Produces: `CommunityTeamsTable({ onOpenTeam })` — a `<table>` with a `<caption>`, one row per team,
  and an "Open hub" control per row.

⚠️ **Team names and suburb counts come from `ward-catchment.ts`, which is real repository data**
(16 teams, 537 suburbs, built from five WA Health documents). **Do not retype them into the component.**
The counts (coming in / going out / longest wait / in hospital) are per-team state.

- [ ] **Step 1: Write the failing test**

Assert: sixteen rows; **the team names come from the catchment module** (import it in the test and
compare, so a divergence fails); every row's "Open hub" control calls `onOpenTeam` with that team's id.

⚠️ **And assert the empty state is worded:** the prototype shows three teams with **"none"** rather
than `0`. _"A nought reads as a measurement; 'none' reads as a state."_ Pin the word.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-community-teams-table.dom.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS, 4 tests.

- [ ] **Step 5: Prove the "none" wording is pinned and not incidental**

Change `"none"` to `"0"`. Re-run.
Expected: **"renders an idle team as a worded state, not a nought"** reddens by name.
Restore.

- [ ] **Step 6: Commit**

---

## Task 3: The scope switch — one component, and the assumption pinned

**Files:**

- Create: `src/components/ward-management/community/community-home.tsx`
- Test: `tests/ward-community-scope.dom.test.tsx`

**Interfaces:**

- Consumes: `CommunityFigures`, `CommunityTeamsTable`, `WardPanel`.
- Produces: `CommunityHome()` holding `scope` state, defaulting to `{ kind: "all" }`.

- [ ] **Step 1: Write the failing test**

Assert: default scope is all-teams; the "All teams" button is `aria-pressed="true"`; choosing a team
from the select switches scope; **"Open hub" on a table row switches to that same team** — one code
path, asserted from both entry points.

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS, 5 tests.

- [ ] **Step 5: 🔴 THE ASSUMPTION TEST INVERTS — it is NOT deleted**

**The original Step 5 asserted the ABSENCE of a community projection. That absence has been filled by
the owner's ruling, so the test becomes its opposite rather than being removed.** ⚠️ **A guard deleted
because reality changed leaves nothing behind; a guard inverted keeps watching the same seam from the
other side.**

**`tests/ward-community-viewer-assumption.test.ts` now asserts:**

- `CommunityScopedReferral` **exists** in `ward-referral-visibility.ts`;
- it carries **no `destinations` field** — the whole point of the ruling;
- **no converter exists** between it and either other projection, and no exported function takes a
  role, viewer or scope argument and returns a referral projection;
- `WARD_FACING` in the boundary test **now contains the community screen**, so FD-23 covers it.

**With the reasoning in a comment**, including the sentence that made it necessary: _a component
reached by both a coordinator and a community user is outside the FD-23 guarded set by construction,
so the guard cannot be what protects this distinction._

- [ ] **Step 6: Watch it fail for the right reason, in BOTH directions**

**(a)** Add a `destinations` field to `CommunityScopedReferral` in a scratch edit. Re-run.
Expected: **"the community projection carries no destinations"** reddens by name.

**(b)** Add an exported `scopedReferralFor(role, referral)` helper. Re-run.
Expected: **"no converter takes a role and returns a projection"** reddens by name.

⚠️ **Both, separately — (a) passing while (b) is broken is exactly how a converter arrives without a
`destinations` field and leaks anyway.** ⚠️ **Report the collection count on each; a red with
`Tests no tests` is a parse error, not a catch.** Restore both.

- [ ] **Step 7: Commit**

---

## Task 3b: 🔴 The community team's OWN hub — a separate component, added 2026-09-04

**Files:**

- Create: `src/components/ward-management/community/community-team-hub.tsx`
- Test: `tests/ward-community-team-hub.dom.test.tsx`

**Interfaces:**

- Consumes: `CommunityScopedReferral` (being built now), `WardPanel`, `WardChip`.
- Produces: `CommunityTeamHub({ teamId })` — the community role's own landing.

⚠️ **THIS EXISTS BECAUSE OF THE OWNER'S RULING, AND IT IS NOT A VARIANT OF TASK 3.** It renders the
same team as the coordinator's drill-down and is a different screen: **a community team may not see
that the patient was referred anywhere else.** Its own addressing may read "cancelled" — so it can
infer THAT the patient went somewhere, **never where, never to whom, never how many places were
tried.**

🔴 **It must import `CommunityScopedReferral` and nothing else referral-shaped.** No
`CoordinatorScopedReferral`, no `Referral`, no converter, no role argument.

- [ ] **Step 1: Write the failing test**

Assert: a referral whose own addressing is answered renders its state; **a referral with other
destinations renders NOTHING about them** — not a count, not "referred elsewhere", not a placeholder.
⚠️ **Assert the absence positively**: build a fixture referral with three destinations, render, and
assert the other two teams' names and the word "elsewhere" appear nowhere in the output.

⚠️ **And assert what a cancelled arm DOES say**, because "shows nothing" and "shows nothing useful"
are different: the ruling permits the team to see its own arm read cancelled.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-community-team-hub.dom.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS, 4 tests.

- [ ] **Step 5: Prove the absence assertion is not vacuous**

⚠️ **An assertion that a name does not appear passes trivially if the fixture never had that name.**
So: render the coordinator's team view with the SAME fixture and assert the other destinations DO
appear there. **If they do not, the fixture is empty and the community test proves nothing.**

- [ ] **Step 6: Mutation — make the hub leak, and watch it caught**

Change the component to render the referral's full destination list. Re-run.
Expected: **"shows no other destination for a patient referred to three places"** reddens by name,
and the message names the leaked team. Restore.

- [ ] **Step 7: Commit**

---

## Task 4: The ED home's model-limit note and figure strip

**Files:**

- Create: `src/components/ward-management/ed/ed-home.tsx`
- Test: `tests/ward-ed-home.dom.test.tsx`

**Interfaces:**

- Consumes: `WardFigure`, `WardFigureStrip`, `WardPanel`.
- Produces: `EdHome()` — the model-limit note, then a five-tile strip, then the hero (Task 5), then the
  service bands (Task 6).

⚠️ **THE MODEL-LIMIT NOTE IS NOT DECORATION AND MUST NOT BE DROPPED AS BOILERPLATE.** The prototype
states: _"The model's `EmergencyDepartment` type carries only an id, a site code and a name — no bed
count, no waiting count, no capacity figure. Every number on this screen is counted from referrals
whose destination is an emergency department and from movements recording where a patient currently
is, not from anything the department itself records."_

**That sentence is what stops a reader treating these as the department's own returns.** Pin it.

- [ ] **Step 1: Write the failing test**

Assert: the model-limit note renders and says the department record holds no counts; five tiles;
**exactly two flagged**; the eight department names come from `ward-sites.ts` (import and compare —
the repository holds **eight** emergency departments, and the prototype's "of 8" is correct).

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS, 4 tests.

- [ ] **Step 5: Prove the model-limit note is pinned**

Delete the note. Re-run.
Expected: **"says plainly that these figures are counted from referrals and movements, not from the department's own record"** reddens by name. Restore.

- [ ] **Step 6: Commit**

---

## Task 5: 🔴 The two "2 of N" figures, disambiguated

**Files:**

- Modify: `src/components/ward-management/ed/ed-home.tsx`
- Modify: `tests/ward-ed-home.dom.test.tsx`

**This task exists because of Decision 2 and should not be folded into Task 4** — it is a correction
with its own guard, and it must stay separately revertible.

- [ ] **Step 1: Write the failing test**

Assert: **no two figures on the screen render the same "N of M" form while counting different
populations.** Concretely: the departments tile's unit says **departments**, and the hero's says
**patients** (or names the nine). ⚠️ **Assert the property — that each "of N" states its population —
not the two specific strings**, or the test pins today's wording rather than the rule.

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — the departments tile currently reads "2 of 8" with no population named.

- [ ] **Step 3: Word both tiles so each states its own population**

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS.

- [ ] **Step 5: Prove the guard catches a regression, not just today's text**

Change the departments tile's unit back to a bare `of 8`. Re-run.
Expected: **"every 'of N' figure names the population it counts"** reddens by name.
⚠️ **Then change the HERO tile instead** and confirm the same test reddens — **a guard that only
watches one of the two tiles is half a guard.** Restore both.

- [ ] **Step 6: Commit**

---

## Task 6: The hero and the three service bands

**Files:**

- Modify: `src/components/ward-management/ed/ed-home.tsx`
- Create: `src/components/ward-management/ed/ed-service-bands.tsx`
- Test: `tests/ward-ed-service-bands.dom.test.tsx`

**Interfaces:**

- Consumes: `WardPanel`, `.hero` and `.heroFigures` from `ward-shared.module.css`.
- Produces: `EdServiceBands()` — three panels (East Metro, North Metro, South Metro) listing that
  service's departments.

⚠️ **`.heroFigures` is a 2-column grid becoming 4-column at `min-width: 60rem`. The hero carries FIVE
tiles.** Five into two columns leaves one alone on the last row; five into four leaves one alone.
**Either accept it deliberately or drop to four — do not discover it in a browser.** This plan does
not decide it: **it is a design call and belongs to whoever owns the prototype.**

⚠️ **And the hero's "of N" qualifiers are inline `<span>`s inside `<dd>` in the prototype, not
`WardFigure`'s `unit` prop.** Mapping them onto the real component changes the markup. **Use the
`unit` prop** — the prototype's inline span exists because the prototype has no component.

- [ ] **Step 1: Write the failing test**

Assert: three bands; the East Metro band carries the note that Royal Perth Hospital is shown above
rather than silently omitting it; every department in `ward-sites.ts` appears exactly once **across
the hero and the three bands combined** — ⚠️ **assert against the union, or a department can be
dropped from a band and nothing notices because it is in the hero.**

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS, 3 tests.

- [ ] **Step 5: Prove the union assertion is not vacuous**

Remove one department from a band. Re-run.
Expected: **"every emergency department appears exactly once across the hero and the bands"** reddens
by name, and the message names the missing department. Restore.

- [ ] **Step 6: Commit**

---

## Left open, deliberately

1. ✅ **ANSWERED 2026-09-04, and it reversed Decision 1.** The owner ruled that community becomes its
   own page and its own first-class role, and that a community team **may not see that the patient was
   referred anywhere else — the same restriction as a ward.** Recorded here rather than edited away,
   because the question and its answer are what make Decision 1's reversal legible.
   ⚠️ **Still undecided: whether the same rule binds ED.** `ward-referral-visibility.ts` says in its own
   header that whether the rule binds the other destination kinds "is not in the ruling". It is decided
   for community now. **It is not decided for ED, and Task 4 must not assume it either way.**
2. **The hero's five tiles in a 2/4-column grid.** A design call. Named, not resolved.
3. **Whether the ED home keeps its own `<h1>`** once the shell shows the place — inherited from the
   shell plan's open question 2, and unavoidable here because "Emergency departments — every site" is
   not a place `wardPlaceFor` can return.
4. **Every figure on both screens is invented** and must come from state, never a literal in a
   component. The prototypes' numbers appear in this plan only as fixture values. ⚠️ **The prototypes'
   README is explicit that they are "not a target for further editing" and that fixes belong in the
   real components — so a number that looks wrong on screen is fixed here, not there.**
5. ⚠️ **The prototypes' README records an unsettled cultural-safety question** — whether Aboriginal or
   Torres Strait Islander status and interpreter needs belong on the patient screen at all remains
   open with the Aboriginal health review, and the layout fix "must not be cited as if it had" settled
   it. **Neither screen in this plan shows those fields, and neither should acquire them here.**
