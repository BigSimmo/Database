# Ward Builder — plan, 2026-09-01

**Measured against `fd7adf110`.** Four tasks, all small, all in paths Ward Builder owns. Ward Lead
holds `coordinator/` and `ward/` for the override register and will not touch anything below.

> ⚠️ **THIS FILE IS DELIBERATELY NOT IN `docs/superpowers/plans/`.** Sixteen ward plans live there
> with every task box unchecked, including plans for screens that shipped days ago — and
> `AGENTS.md`'s dead-code rule treats "named in a plans/specs file with unchecked tasks" as evidence
> a symbol is alive. **Sixteen all-unchecked plans means that guard currently protects nearly every
> symbol in the feature and discriminates almost nothing.** Adding a seventeenth would make it worse.
> Found by Ward Builder while looking for a plan to execute.

## Global Constraints — hand these to reviewers verbatim

- **Never invent a clinical value, a reason code, a team name or a bed count.** If a fact is missing,
  hand it back.
- **A placeholder NAME is the owner's to replace and is not a defect** — team names, the ambulance
  service, synthetic-data labels, wording. **But a name that determines BEHAVIOUR is:** a route path,
  a parameter name, a field name, an event name, a reason code. He drew that line himself on
  2026-09-01.
- **Every interactive `<button>` does something** — a handler, a submit inside a form, or navigation.
  A control unavailable for a stated reason uses `aria-disabled` plus an inert handler plus a title,
  never native `disabled`.
- **Design tokens, never hex.** Production tap targets are `min-h-12` (48px).
- **Commit as you go**, never `git add -A`, never a bare `git stash`.
- **Read the artifact, not a comment about the artifact.** Three defects today were a comment
  asserting a state the code did not have.
- **A test that cannot fail is worse than no test.** If a check scans a set, assert the set is
  non-empty.

## Task 1 — Move the movement workspace off the `/patients/` address

**Why.** `/mockups/ward-flow/patients/[patientId]` renders `WardPatientWorkspace`, which looks up a
**movement**. Its own page title says "Patient movement workspace". Real people live at
`/mockups/ward-flow/people/[patientId]`. The address claims to be about patients and is not.

Since `b5147b9d0` the identifiers are distinct types — `MovementId` is `` `WF-${string}` ``,
`PatientId` is `` `PT-${string}` `` — so passing the wrong one no longer compiles. **This task fixes
the remaining half: the name a human reads.**

⚠️ **THE TARGET IS NOT `/movements/`.** That path already exists as a live mode page
(`src/app/mockups/ward-flow/movements`). Nest under it as `/mockups/ward-flow/movements/[movementId]`
if the router accepts a static page and a dynamic child in one segment. **If it does not, stop and
hand it back rather than choosing a third name** — the name is the whole point of the task and
picking one alone would be inventing the thing the task exists to fix.

**Files.**

- `src/app/mockups/ward-flow/patients/[patientId]/page.tsx` — the route to move.
- The inbound links. `grep -rn "ward-flow/patients/" src` finds them; the known ones are
  `search/patient-search.tsx`, `tracker/live-tracker.tsx` and three in `ward-management-modes.tsx`.
  **Count them yourself and report the number** — my count of seven is relayed, not measured.
- `tests/ward-nav.test.ts` and `tests/ward-landmarks.test.ts` — both hold route maps naming the old
  path, plus route counts. They will tell you exactly what to change; read their failure messages.

**Steps.** Move the route directory; update every inbound link; update both route-coverage maps;
rename the parameter and any local variable that says `patient` while holding a movement.

**Check.** `npx tsc -p tsconfig.typecheck.json --noEmit` reports zero errors, then
`npx vitest run tests/ward-nav.test.ts tests/ward-landmarks.test.ts tests/ward-patient-page.dom.test.tsx`
passes, then `grep -rn "ward-flow/patients/" src tests` returns nothing.

**Falsifier.** Any reference to the old path survives anywhere in `src` or `tests`; or the route
count assertions were changed without the route map entries being changed; or a third name was
invented because nesting looked awkward.

## Task 2 — The form name is written twice

**Why.** `"Form 1A"` is a literal at `ward-movements.ts:152` and `:479`. Revising what that form is
called is two edits. The owner's standing rule is one place per fact.

⚠️ **DO NOT TIGHTEN `TransportJob.formRequired`'s TYPE.** Deriving a union from
`SELECTABLE_LEGAL_FORMS` needs `as const` on that array, which is pinned in roughly fifteen places by
`tests/ward-legal-figure-guard.test.ts` — the Mental Health Act figure guard. **Widening the type is
a deliberate change with a clinical guard in front of it; de-duplicating a literal is not.** You
established this yourself; it stands.

**Steps.** Export one constant beside the two writes and reference it twice. Nothing else.

**Check.** Typecheck clean, and `grep -c '"Form 1A"' src/components/ward-management/ward-movements.ts`
returns 1.

## Task 3 — Mark the FD-23 projections DO NOT DELETE

**Why.** `ward-referral-visibility.ts` exports `wardScopedReferral`, `wardScopedReferrals`,
`coordinatorScopedReferral` and `coordinatorScopedReferrals`, and **every caller is a test.** No
production file imports the module — legitimately, because `Referral` carries no patient link so a
ward-facing screen could not show referrals even if it wanted to.

The boundary is enforced by a static contract test that tells the next author to route through those
functions. **Delete them and that test names a function which does not exist, and the FD-23
protection evaporates at the moment somebody finally builds a ward-facing referral surface.**

This repository has already walked back a sweep seven times for exactly this shape.

**Steps.** A comment at the top of the module: zero production importers is expected, why, what
breaks if they are removed, and `npm run check:dead-code-candidate` before removing any exported
symbol. Documentation only — change no code.

**Check.** Typecheck clean; no behaviour changed.

## Task 4 — Name the invariant holding transport's terminal states apart

**Why.** `ward-model.ts:356-358` declares `collectedAt`, `arrivedAt` and `cancelledAt` as three
independent optionals, so a hand-built object can carry a cancelled job that also arrived. **Nothing
in the reducer can produce one** — `closure` is doing the mutual exclusion, because both terminal
transitions set it and each refuses a movement that already has one.

You measured this and recommended a comment over a refactor. Agreed, and your own argument is why:
**`closure` is a load-bearing invariant that nothing states in the type**, so a future writer adding
a fourth terminal transition would not know to set it.

**Steps.** A comment at `ward-model.ts:356` naming `closure` as the invariant, the reducer lines that
enforce it, and what a fourth terminal transition must do. Documentation only.

**Check.** Typecheck clean.

## Already done — do NOT build these

- **The `ward-sites.ts` warning that the 23 authored `held` values are read by nothing** — landed at
  `30d2fda99`, at both the declaration and the authoring site. It is on your list of five; it is done.
  **This is the seventeenth item today that a plan claimed was outstanding and the code showed was
  finished.**

---

## Task 5 — The community hub has no door

**Why.** Nothing anywhere links to `/mockups/ward-flow/community`. Measured by Ward Builder: not one
reference outside `community-screen.tsx` itself, and that only links sibling teams — from a page you
cannot reach unless you already typed a URL. `communityTeamHref` has no caller in any other file.
**Sixty-five pages, no door.**

The shape the rest of the app already uses, read from `ward-nav.ts` rather than invented: a
many-instance thing gets an **index** (`/mockups/ward-flow/wards`) and the rail points at the index,
plus at most one concrete instance. Wards have that. **Community teams are 65 and have neither. It is
the only many-instance hub in the app with no index.**

**Files — all inside Ward Builder's owned path.**

- `src/app/mockups/ward-flow/community/page.tsx` — new. The index.
- `src/components/ward-management/community/` — the list component and its styles, if the page needs
  more than markup.
- A new test file beside the existing community tests.

⚠️ **ONE LINE IS WARD LEAD'S AND IS NOT IN THIS TASK:** the entry in `ward-nav.ts` pointing at the
index. Build the page; Ward Lead adds the nav entry after merging, because a nav link to a route that
does not yet exist would fail the orphan and reachability checks in the wrong direction.

### Two things this page must say, and both come from what is on the team pages already

1. **It must not read as a service directory.** Every team page carries the caution that these names
   come from one catchment document, that no team agreed to be represented, and that the page is not
   a picture of an area. **An index listing all 65 as a clean directory would quietly assert exactly
   what those three panels spend their length denying.** Say it once at the top, in the same weight.
2. **61 of 65 have nobody, and that must not read as broken.** State the reason rather than the
   count alone: a person appears on a team's page only because a referral named that team, which is
   rare and deliberate. An index of 65 rows where 61 are blank, with no explanation, reads as a
   failed load.

**Steps.** Read `community-derivations.ts` for `COMMUNITY_TEAM_PAGES` and `communityTeamHref` — the
list and the link builder both exist. Read the existing team page for the caution wording and match
its weight rather than restating it. Build the index. Test it.

**Check.** `npx tsc -p tsconfig.typecheck.json --noEmit` clean; the new test passes; the existing
`tests/ward-community-hub.test.ts` and `tests/ward-community-hub.dom.test.tsx` still pass; and
`npx vitest run tests/ward-nav.test.ts tests/ward-landmarks.test.ts` — **a new route will change both
route-coverage maps and both counts, and their failure messages name exactly what to add.**

**Falsifier.** The index presents the 65 as a directory without the caution; or it shows 61 empty
rows without stating why; or it invents a team, a grouping or a count; or the route-count assertions
were changed without the route-map entries.
