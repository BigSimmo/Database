# Task 13b — stopped before building: the read this design needs does not exist

**Status: STOPPED, no code written.** The brief instructed me to establish which name-reading surfaces
exist before building anything, and to say so before building if neither fits. Neither fits, and the gap
is wider than one repository method. Nothing under `src/`, `tests/` or `package.json` was touched; this
report is the only file this task added.

## The one-line answer

> **One deliberate act → one trail row → one patient** is buildable and I know exactly how to build it.
> It needs a read that releases **one** patient's name, a request surface that carries it, and a client
> boundary on a screen that deliberately has none. None of those three exists, all three are contract
> decisions rather than screen decisions, and one of them re-opens a design choice
> `src/lib/caring-contacts/repository.ts` argues for in writing.

## What exists, established by tracing call sites rather than by reading a summary

Every read in this workspace that releases a patient's name:

| Surface                     | What it releases                                                                                  | Where it is called                                                                   | Why it does not fit                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `listPatientNames(context)` | `{ planId, patientName }` for **every** plan the actor can list                                   | `caring-contacts/patients/page.tsx`, `caring-contacts/patients/[patientId]/page.tsx` | A collection read. The brief forbids it by name, and it is the ambient-shape read the owner's decision exists to avoid.                                                                                                                                                                                                                                                                                                        |
| `getEpisode(planId, ctx)`   | Name, mobile number, identifiers, cultural identity, first-contact reason, plan dates, pathway id | `caring-contacts/patients/[patientId]/page.tsx` only                                 | Single-patient, but releases far more than a name, and is gated on `READ_ACTIONS.episode` = `generateClinicalRecordSummary` — a different capability from the one a name travels on. `patient-overview.tsx` states the confinement directly: "This screen may see the number because it already made the read that releases it; nothing else in the workspace may … Do not add a read for it elsewhere, and do not widen one." |

There is no third. `GET /api/caring-contacts/plans/[planId]` releases a `PlanRecord`, which
`PLAN_RECORD_HOLDS_NO_FIRST_CONTACT_REASON` and each store's `toPlanRecord` make structurally incapable
of carrying patient detail. **No HTTP surface in this workspace releases a patient's name at all** —
both name-reading call sites are server-rendered pages.

## The three things that would have to be built, and why each is a contract decision

### 1. A repository method — and it contradicts a decision the module records

The method itself is small and obvious in both stores:

```ts
getPatientName(planId: PlanId, context: ReadContext): Promise<PatientNameProjection | null>;
```

Postgres: the `mayReadAllOwnTeam(context, PATIENT_NAME_READ_ACTIONS)` guard `listPatientNames` already
uses, then `runRead` — which is what emits the team preamble and lets row-level security decide whether
the row is this actor's to read at all. In-memory: `visiblePlan` narrowed to the same conjunction. It
would need its own case in `tests/helpers/caring-contacts-repository-contract.ts` so both stores are
held to the same answer, including the same answer for a cross-team plan and for one that does not
exist.

**What stops me writing it is not difficulty.** `PatientNameProjection`'s doc comment in `repository.ts`
argues the opposite choice under the heading _"WHY A LIST, NOT A LOOKUP PER PLAN"_, and its reason is
that a per-plan lookup has to answer for a plan id the caller supplied, where a list never takes one.
Adding the lookup is therefore not filling a gap somebody forgot — it is reversing a recorded decision
about the workspace's most sensitive read.

**My assessment, offered so the owner can decide in one line rather than re-derive it:** the objection is
answerable, and this codebase has already answered it once. `getEpisode` is a per-plan lookup that
releases a name, and it defuses the oracle by giving `null` for a plan that does not exist, for another
team's plan, and for a plan the role may not read — three causes, one answer. A `getPatientName` written
the same way is not an oracle either. The list's other virtue, one round trip for a whole caseload, is
irrelevant here: this reveal wants one round trip for one patient, which is the design.
**I think the method should be added. I am not adding it unasked.**

The capability should stay the existing `PATIENT_NAME_READ_ACTIONS` conjunction rather than
`READ_ACTIONS.patientName` alone, for the reason that constant records: `viewPatientRecord` is granted
more widely than plan visibility is, so gating a name release on it alone widens access through a change
whose whole purpose is to narrow.

### 2. A request surface that releases a name — the first one in this workspace

The name must not be in the page payload before the control is pressed, so it has to arrive on a request
the press causes. Two shapes, and I prefer the second:

- **`GET /api/caring-contacts/plans/[planId]/patient-name`**, following the `readHandler` pattern the
  sibling routes use. It fits the existing furniture exactly. Its cost is that it mints the workspace's
  first HTTP endpoint whose response body is a patient's name — a durable widening that outlives this
  screen and is reachable by anything holding the capability.
- **A Server Action.** No new addressable endpoint; the name travels in a POST response body and never
  in an address; one submit is one invocation is one row, which is the brief's sentence almost literally.
  **There is no Server Action anywhere in this repository today**, so this is a new pattern rather than a
  new instance of one, and Next 16's rules for it need reading in `node_modules/next/dist/docs/` before
  anyone writes one.

Either way the access record is `{ kind: "view", objectType: "patientName", objectId: <planId> }`.

### 3. A client boundary on a screen that deliberately has none

`schedule-screen.tsx` states its own property: _"A Server Component with no hooks and no client boundary
(Ruling 13) … nothing on this screen needs JavaScript to work."_ `patients-directory.tsx` holds the same
property and says so twice. A reveal that swaps a name in without a page navigation needs state, so that
property breaks on this screen.

It cannot be dodged by putting the reveal in the address. Ruling [111] forbids a revealed name reaching
the URL or the history, and `overlayUrl()` copies every existing query parameter into each history entry
it pushes, so anything that reaches the address is multiplied. A `<form method="GET">` reveal is
therefore out. A Server Action reveal keeps the name out of the address but still needs a client
component to render the result.

**The honest shape is a small client component owning one row's reveal**, imported by the server screen,
so the page stays server-rendered and only the control ships JavaScript. That is a real change to a
stated property of this screen, and it belongs in the owner's decision rather than in mine.

## The decisions the brief asked me to make, made

### `AccessedObjectType`: reuse `patientName`, do not add a member

**Decided against a new member**, on Task 15's reasoning rather than on Ruling [46]'s letter. I read Task
15's report on `claude/caring-contacts-demo-seed` rather than relying on a summary of it.

Task 15 declined a member and was upheld because a member naming a **screen** rather than an **object**
splits one askable question in two, and the trail's query surface filters on `objectType` with no
`objectId` filter, so the two halves can never be unioned back. That is the test to apply, and this read
passes it in the direction that means _reuse_: `patientName` already means "a read of patients' NAMES and
nothing else", and a per-patient reveal is exactly that — same object, same sensitivity, same capability.
A `scheduleNameReveal` member would name the screen the press happened on, which is the harm Task 15
avoided.

The `objectId` carries the plan id, which is what makes the row name **that patient**. It is
identifier-shaped, so `ACCESS_OBJECT_ID_PATTERN` accepts it and no name can reach `objectId`.

**What is genuinely lost by reusing, stated rather than glossed:** a caseload's whole-team name read and
a schedule's one-patient reveal become the same `objectType`, and with no `objectId` filter they can only
be told apart by eye. **This is still the right trade, because the distinction being given up is the
wrong axis anyway** — what is wanted here is _which screen_, and the brief itself says screen attribution
needs a `surface`/`context` dimension rather than a second `objectType`, and that this is not that task.
Splitting the enum now would make that eventual dimension arrive on top of an enum already damaged to
approximate it.

### `NamesNotShownNotice`: leave it where it is, for now

The brief expects this to be its second use and instructs a move rather than a copy. **With no reveal
built there is no second use**, and moving a component into `workspace/` while it still has one call site
would make its own comment ("one use is not a pattern") false. It moves in the same change that builds
the reveal.

**One finding for when it does move.** Its heading is "Names are not shown in this role", which is a
statement about the **role**. On the schedule the same slot has to cover two different facts: the role
may not see names at all, and the role may see names but has pressed nothing yet. The second is not a
restriction and must not be worded as one — a coordinator who reads "names are not shown in this role" on
a screen where a press would show them has been told something false about their own access. So the
schedule needs a **second** statement rather than a reworded first one, and the shared component should
carry the role restriction only. That is the different-wording case the brief asked me to report rather
than silently resolve into two components.

### `tests/ui-caring-contacts-workspace.spec.ts`: what I think it needs

I did not run it and I did not edit it. Task 13's `SCHEDULE_SCREEN` block would need, in the same style:

- **The control is present and the name is not**, before any press — asserted against the served HTML
  rather than the rendered DOM, because the payload is where "not in the page payload" is a property at
  all.
- **A press reveals one name**, with the assertion naming the patient the fixture holds.
- **The address is unchanged across the press** — URL, query string and history length. That is where
  Ruling [111] is load-bearing; a DOM query cannot see it.
- **320px**: the control at or above the 48px production tap floor, measured on the element containing
  it, on a row that already carries a link and a synthetic identifier. This is the tightest row in the
  workspace and I would expect it to be the assertion that fails first.
- **Forced colours**: the revealed name and the control both legible once the accent is dropped.

**The isolated Playwright server seeds no plans**, so a reveal cannot be exercised there without seeding
— the same limitation Task 13 recorded for its populated-day cases, which it proved in the DOM suite
instead. Unless that server gains a seeded plan, the browser block can prove the control's presence, size
and forced-colors treatment but **not the reveal itself**, and the reveal's proof has to live in the DOM
suite. Worth deciding before the block is written: a browser test that presses a control on an empty
schedule proves the control exists and nothing else.

## Verification

**No gate was run, and that is not an omission.** No file under `src/`, `tests/`, `package.json` or any
generated document changed, so there is no tree for `npm run test:cc-guards`, `typecheck` or `lint` to
form a verdict about that the tree they last saw did not already cover. Running a suite in order to
report a green that belongs to the previous commit would be the "mechanism you have not seen run,
reported as coverage" failure aimed at my own work.

`prettier --check` **was** run against this report, because a Markdown file is exactly the kind of change
that is in none of `test`, `typecheck` or `lint`. Its line is quoted in the commit that adds this file.

`git status --porcelain` was empty before this report was written, and the branch tip it was written
against is `5c500b84a`.

## What I recommend

Approve the three changes above as one unit, or reject the design. **They do not decompose**: the
repository method with no request surface releases nothing to a screen, the request surface without the
method has nothing to read, and either one without the client boundary cannot be pressed. A partial
approval produces a half-built name-release path, which is worse than none.

If the answer is yes, the smallest correct sequence is: the contract method and its case in the shared
contract suite first, so both stores are held to it before anything can call it; then the request surface
with its `{ view, patientName, <planId> }` record; then the control — with the trail assertions written
before the control, because the audit row is the deliverable.

If the answer is no, Task 13's screen is already correct as it stands and needs nothing.
