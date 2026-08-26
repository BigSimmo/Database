# Task 19 report — Guidance and Reports, and the More-panel navigation

**Branch:** `claude/caring-contacts-demo-seed`. **Worktree:** `D:\Worktrees\Database\cc-templates`.
Nothing pushed, no pull request opened, no subagent dispatched.

---

## 1. The thing you most needed me to get right: the reach report

**I stopped, and I am reporting it. There is nowhere for the small-cell threshold to live, and I did
not invent one.**

I searched independently of your search and reached the same answer: no configuration surface for a
small-cell threshold exists anywhere in `src/lib/caring-contacts/**`, in
`caring-contacts/supabase/migrations/**`, or in the server seam. The only "suppress" in the domain
is the contact-suppression state, which is unrelated.

So `/caring-contacts/reports` performs **no read of `caring_contacts.cultural_identity_reports` at
all**, and its reach section states, in words:

- that this service does not record Aboriginal and Torres Strait Islander status, so there are no
  reach figures to report;
- that this is a statement about what is collected and **not** about who is in the programme —
  explicitly, "nobody has been asked, so a breakdown here would not be an empty one; there is
  nothing for it to be a breakdown of";
- that two things are needed before the report can exist, and neither has been decided: a bounded
  category set, and a minimum cell size set under governance.

It renders **no breakdown element**, so the "no Aboriginal or Torres Strait Islander patients"
reading is not available to a reader by any route. That is asserted structurally rather than by
wording (`queryByTestId(...breakdown)` is null, and the section contains no `Suppressed`), and
end-to-end in the browser block.

### The shape the configuration needs

Recording this because you asked what it would take, not because I am proposing it:

1. **A bounded category set, versioned.** Suppression presupposes it. The natural home is beside the
   other governed vocabularies in the sealed domain — a frozen list with a version identifier, so a
   report can say which set it was computed against and a later change does not silently restate an
   older report. Free text cannot be normalised into this without an unaudited step deciding who
   counts as Aboriginal, which is the decision the owner refused on 2026-08-25.
2. **A threshold that is a stored, attributable, auditable value — not a constant.** Minimally: which
   team or service it applies to, the integer, who set it, and when. A migration-backed row is the
   honest home, because it is a governance decision with an author; a constant in a module has no
   author and no date. Whatever holds it, `reachReportingThreshold()` in
   `src/lib/caring-contacts/reach-reporting.ts` is the one function that must start returning it, and
   nothing else in the tree needs to change to use it.
3. **A floor the code already enforces, so the governance decision cannot be a no-op.** A threshold
   below 3 is refused by name: at 2, "suppressed" means "exactly 1" and the marker announces the
   number it stands for; at 1, nothing is ever suppressed. That refusal is arithmetic, not policy,
   and it is tested.
4. **A new `AccessedObjectType` member, when the read is built.** A reach read over
   `cultural_identity_reports` is a genuinely different object from anything the trail names today.
   That is the member this screen would warrant, and it belongs to building that read — not to
   building this screen. See §4.

**Whether the screen ships as it stands, or waits for the threshold, is yours. It is honest either
way; it is simply smaller than §2.5 promises.**

---

## 2. Suppression, and the inference attempt

The rule lives in `src/lib/caring-contacts/reach-reporting.ts`. It takes the threshold as a
**required argument** — there is no default parameter, so a caller that forgets it cannot silently
acquire one — and it is fully built and fully tested even though no page currently calls it with a
number.

### What it does, and why

It assumes **the population total is knowable**. `discloseReach` prints no total and the reach
section renders none, but a reports screen publishes measures over the same team beside it, so a
reader who can count the team's plans has the total whether or not the reach section prints it.
Withholding the total is therefore belt-and-braces, not the mechanism. Stating that assumption is
the point: a rule whose safety rests on withholding a number that is published two sections above it
is not a rule.

Given that, a hidden cell is recoverable exactly when the arithmetic pins it to one value:

- nothing hidden — nothing to pin;
- **exactly one cell hidden — it IS the residual, by one subtraction.** This is naive suppression;
- **residual zero — every hidden cell is zero**, however many there are;
- otherwise, two or more non-negative integers summing to a positive residual admit more than one
  assignment, so no cell has a single feasible value.

So the rule hides the cells below the threshold, then **promotes further cells into the hidden set,
smallest first, until nothing is pinned** — and **withholds the breakdown whole** when no promotion
can achieve that. Promotion is what buys the ambiguity: a reader who knows the rule cannot tell a
cell hidden for being small from a cell hidden to protect it, so no per-cell upper bound survives to
narrow the assignments.

**What is deliberately not modelled:** differencing two reports that share a population but differ
by a filter. No per-report rule can prevent that. The reach section is therefore **unfiltered by
construction** — the screen offers no control that would produce a second, differently-scoped reach
report to difference against it. That is a property of the surface, and it is recorded in the module
where a reader will look for it.

### The test is an attack, and it carries its own positive control

`tests/helpers/caring-contacts-reach-inference.ts` holds the attack in one place, because it is used
twice and two copies of a safety check drift. It takes what a reader can see, computes the residual
from the published cells and the assumed-known total, enumerates **every** split of that residual
across the hidden cells, and returns the categories whose value is the same in every split.

- Against **naive** suppression of `{12, 2, 9}` at threshold 5, it recovers `Torres Strait Islander`.
  **That is the positive control**, and it is asserted first: an attack that could not recover a cell
  from naive suppression would prove nothing by failing to recover one from the real rule.
- Against the real disclosure of the same data, it recovers nothing.
- Both are run twice: once over `discloseReach`'s value, and once over the **rendered rows**, read
  back out of the DOM exactly as a reader reads them.

There is no assertion anywhere that the word "Suppressed" appears and stops there.

---

## 3. The shipped route no phone could reach

Confirmed as you described it, and fixed.

`MORE_DESTINATIONS` entries now carry an optional `href`; every entry without one still renders as an
`UnavailableDestination` stating its reason, and that is asserted as the full panel list rather than
as a count. Guidance and Reports carry hrefs under Ruling 89 — link and screen in the same change.

For Templates I did **not** displace anything from the phone bar. The More panel now also carries
`PHONE_OVERFLOW_DESTINATIONS`, **derived** as `PRIMARY_DESTINATIONS` minus `PHONE_DESTINATIONS`
rather than listed, inside a `md:hidden` row — so they appear exactly where the rail does not, and
dropping a fourth destination from the phone bar tomorrow routes it here without anyone remembering
to. A hand-written third list is how the defect arose in the first place.

### The assertion that can actually fail

You are right that the orphan-route gate proves nothing about a phone, and I did not rely on it.

`tests/caring-contacts-workspace-shell.dom.test.tsx` gains `rendersAt(element, width)`: it walks the
element's **real rendered ancestor chain**, resolves which Tailwind display utility wins at that
width from a **closed map of variants**, and **throws** on a variant it does not recognise rather
than guessing — because a silent "assume visible" would reproduce the exact failure mode the orphan
gate already has. Its positive controls are the rail and the phone dock, which are opposite by
construction: the rail must be absent at 375 and present at 900, the dock the reverse. The
reachability test then requires every built route to have **at least one link that renders at 375
and at least one that renders at 900**.

That is still a model of the CSS rather than the CSS, so the browser block sets a real 390px
viewport, asserts the rail is hidden and the dock visible, finds Templates, Guidance and Reports as
links in the More panel, and clicks through to Templates. The two halves fail for different reasons:
a stylesheet that did not ship the variant reddens only in the browser.

### What a general fix would need

This is repo-wide and not Caring Contacts' to close alone. `tests/route-reachability.test.ts` asks
"is this route referenced in source?" The question worth asking is "does some viewport render a link
to it?" Closing it generally needs a rendered-DOM reachability pass per breakpoint over the app's
real nav surfaces — which the general scan cannot do as a text match, because the answer depends on
CSS. The cheapest honest intermediate step is what this task did locally: for each nav-owning
component, a DOM test that resolves display variants over the rendered tree at the reviewed widths.
Worth an `/issues` row; I have not written one, since the ledger is serialized and this is not mine
to queue mid-task.

---

## 4. Decisions I took, with the reasoning rather than the ruling's letter

### No new `AccessedObjectType` member — and I read Task 15's finding first

**Guidance** reads only the service state. There is no guidance object; there is a page of text. A
`guidance` member would name a **screen**, and since the trail filters on `objectType` with no
`objectId` filter, a screen-named member splits one askable question in two. That is Task 15's
finding exactly, and it applies unchanged.

**Reports** reads plans and dispatch attempts, and records each against the object it read —
`{ search, plan, "all" }` matching `plans/route.ts`, `{ search, contact, "all" }` matching
`dispatches/route.ts`. I considered and rejected the declared-but-unused `"report"` member for the
plans read: **the read did release plan records to the server**, so recording it as a report read
would make "who read this team's plans, and when" miss it — the Ruling 46 harm arriving from the
other direction.

**The residual that leaves, stated rather than glossed:** this screen's plan read and the caseload's
are byte-identical records, so the trail cannot be asked which of the two a reader used. That is a
property of the trail, not of the screen, and minting a screen-named member to work around it would
make the trail worse. Recorded here; the fix is an `objectId` filter on the trail's query surface.

The member that Reports **would** genuinely warrant is the one for the read it does not make — see
§1.4.

### `READ_ACTIONS.dispatch`

`reconcileProviderDispatch` was written inline in **both** stores' `listDispatches`. A reporting
screen must ask the same question the store asked, because an empty dispatch list means "you may not
see these" and "there are none" alike. Rather than add a third copy in the page, I added
`dispatch: "reconcileProviderDispatch"` to `READ_ACTIONS` and pointed both stores and the page at it.
Three call sites, one source.

---

## 5. Findings — where the tree does not match what I was told

### 5.1 The Task 12 pin the brief tells me to use does not exist

The brief says the `z.enum` in `src/app/api/caring-contacts/access-trail/route.ts` is a hand-copy of
`AccessedObjectType` and that "Task 12 added a pin that keeps them in sync, so use it rather than
writing a second one."

**There is no such pin.** Only three files in the repository mention `trainingRecord`: the union in
`access-audit.ts`, the hand-copied `z.enum`, and the two store implementations that merely use the
type. No test compares them; no `satisfies` constrains them; `git log` on the route shows no pin
commit. The hand-copy is unguarded today.

I did **not** act on it, because I add no member and the files are shared with live branches — but
it is a live hazard and it will bite the first task that does add one. The cheapest durable fix is
not a pin at all: export the tuple from `access-audit.ts`, derive the union from it, and have the
route do `z.enum(ACCESSED_OBJECT_TYPES)`. Then there is no copy to keep in step.

### 5.2 "Nothing fills them" is very nearly true, and the exception matters

`src/lib/caring-contacts-server/demo-seed.ts` **does** write `culturalIdentity` — the literal string
`"Not stated"` — for every seeded patient, with a recorded rationale (a cultural identity attributed
to an invented person is an invention about culture). The wizard sends `null` unconditionally, so no
clinician can populate it; but the column is not untouched, and the API schema still accepts
`z.string().min(1).nullable()`.

It does not change the conclusion — a free-text sentinel is not a bounded category and cannot support
suppression — but it does change what the screen must not do. Had I rendered a breakdown, the demo
would have shown a single category "Not stated" with a count, presented as reach reporting. Worth
knowing before anyone reads "nothing fills them" as "the column is empty".

### 5.3 A sixth design value the types do not support — and two copy departures

The approved mockups' Guidance page carries `OneWayBoundary`, whose closing sentence is
"…never means the message was read **or the patient is safe**". That sentence **cannot be written in
this tree**: the interface-vocabulary scan refuses `safe` as a whole word, and the standing
constraints forbid exploiting the scan's known word-boundary inversion to slip it past. I rewrote it
to say the same thing without the word — what `Delivered` is, and the three things it is not — and
the test asserts the replacement's presence **beside** the word's absence, so a blank screen cannot
satisfy it.

Second, the design's language-rules table has a row reading "Use / Agreement", which is legible on a
design board beside its neighbours and not on its own. I wrote it out as the instruction it
abbreviates ("Say / Agreement — never consent."). Recorded rather than silently resolved.

**This is not a sixth instance of the five-values pattern.** I looked, and found no new value the
design shows arriving from a hospital record. The two items above are copy that a repo rule forbids
and copy that does not survive being read alone.

### 5.4 One approved-design measure I mapped rather than reproduced

The Reports design's four tiles are `Due / Dispatched / Named failures / Median resolution`. Three
map directly onto records this system holds and are built as such (day-scoped through the domain's
own AWST calendar day and its own sendability classification). **"Named failures — permanent
transport failures"** does not: the domain has no "permanent" classification of a contact state, and
inventing one would be a clinical-operational judgement. I built the measure the records do support —
dispatch **differences**: attempts examined, differences found, worked through, still open — which is
what `DispatchRecord`'s `expectedStatus`/`reportedStatus`/`discrepancyResolvedAt` actually describe,
and which is also where the median comes from. If "permanent failure" is meant to be a real category,
it needs deciding before a screen names one.

### 5.5 Never rank clinicians — checked, not assumed

Spec §4.2 forbids it. I checked the approved design for anything ordering people by output and found
nothing. `OperationalReport` carries no actor field to group by, so such a table cannot be assembled
from what the component is given; it would have to be written from scratch. Recorded in the
component's own note so the constraint and the design are recorded as having been checked against
each other rather than assumed to agree.

---

## 6. What I changed

| File | What |
| --- | --- |
| `src/lib/caring-contacts/reach-reporting.ts` | New. The §2.5 suppression rule; `reachReportingThreshold()` returns `null`. |
| `src/lib/caring-contacts/operational-reporting.ts` | New. Plan/contact rollups and dispatch-difference measures. |
| `src/lib/caring-contacts/repository.ts` | `READ_ACTIONS.dispatch`. |
| `src/lib/caring-contacts/in-memory-repository.ts`, `db/postgres-repository.ts` | Both `listDispatches` now name the capability through `READ_ACTIONS`. |
| `src/components/caring-contacts/workspace/programme-guidance.tsx` | New. The Guidance screen. |
| `src/components/caring-contacts/workspace/operational-reports.tsx` | New. The Reports screen, including the reach section's three states. |
| `src/components/caring-contacts/workspace/shell.tsx` | More-panel `href`; derived phone-overflow row; one `MorePanelDestination` renderer; the panel's intro sentence, which had become false. |
| `src/app/caring-contacts/guidance/page.tsx`, `src/app/caring-contacts/reports/page.tsx` | New routes. |
| `tests/caring-contacts-reporting.test.ts` | New. The domain half, centred on the inference attempt. |
| `tests/caring-contacts-guidance-reports-pages.dom.test.tsx` | New. Both pages, and the inference attempt over rendered rows. |
| `tests/helpers/caring-contacts-reach-inference.ts` | New. The attack, in one place. |
| `tests/caring-contacts-workspace-shell.dom.test.tsx` | `rendersAt`, its positive controls, and the phone-reachability assertion. |
| `tests/ui-caring-contacts-workspace.spec.ts` | Two `WORKSPACE_SCREENS` entries and the block that proves them. |
| `package.json` | The two new suites added to `test:cc-guards`. |
| `docs/codebase-index.md`, `docs/site-map.md` | The two routes, the More-panel capability, and why the reach section reads nothing. |

`docs/caring-contacts/phase-2b-build-record.md` was not touched.

---

## 7. What `tests/ui-caring-contacts-workspace.spec.ts` needs — you run that gate

I have written it; this is what it now contains, so you know what you are running.

Two entries in `WORKSPACE_SCREENS` (`Guidance`/`Guidance`, `Reports`/`Reports`) with `GUIDANCE_SCREEN`
and `REPORTS_SCREEN` beside the existing constants — required, because
`tests/caring-contacts-workspace-screens.test.ts` goes red offline the moment a production workspace
route has no entry. Each route constant carries its own note on what this server renders. The
`WORKSPACE_SCREENS` doc comment's list of which block proves which screen was extended (it had
already fallen behind — it did not name the templates block either).

One new block, `caring-contacts guidance and reports`, with seven tests:

1. Guidance serves 200, renders its `h1`, and states the one-way boundary.
2. Reports serves 200, renders its `h1`, and the reach section states the field is not collected —
   with `caring-contacts-reach-breakdown` at count 0 and no `Suppressed` anywhere in the section.
   **This is the end-to-end form of the assertion the task turns on.**
3. Reports is reached by clicking the More panel at 1024px.
4. **Templates, Guidance and Reports are all reachable at 390px**, with the rail hidden and the dock
   visible, and Templates is clicked through. This is the defect closed in a browser.
5. Both screens at 320px: no horizontal overflow, correct width state, dock visible.
6. Reports in dark: shell chrome plus the reach section's own surface and ink, compared against
   light, with no colour resolving to transparent.
7. Reports under forced colours at 390px: the statement still readable, the section's border still
   painted, no overflow.

**One risk to watch on your run.** Tests 3, 4 and 6 use `openWorkspace`, which asserts
`caring-contacts-rail` has count 1 before proceeding. At 390px the rail is `hidden` but still in the
DOM, so the count holds — that is the existing templates block's own pattern at 320px, so I expect
it to behave. If test 4 fails on that assertion rather than on a link, it is the helper and not the
navigation.

---

## 8. Verification

Gate: `npm run test:cc-guards` only, per the brief. Nothing else was run; the full suite is yours at
the merge point.

### The first attempt was UNRUN, and the exit code said 0

```
Error: Database focused-test capacity is full (current owner PID 60368, worktree
C:\Users\joshs\.codex\worktrees\document-viewer-workspace-20260826\Database, ...):
playwright --project=chromium --grep-invert @quarantine|@mockup
...
[exited with code 0]
```

A lock refusal arriving through a pipe left `$?` reading 0 with no summary line. Recorded as UNRUN,
retried on a delay, and never forced past another worktree's lease.

<!-- GATE-EVIDENCE -->

---

## 9. Concerns

1. **The reach report is smaller than spec §2.5 promises, and only you can close that.** The screen
   is honest, but "honest about a gap" is not the same as delivering the section. The threshold needs
   a governance home and the field needs a bounded category set; §1 says what shape both need.
2. **The unguarded `z.enum` hand-copy (§5.1) will bite the first task that adds an
   `AccessedObjectType` member.** I left it alone deliberately — I add no member, and the files are
   shared — but it should be closed before the reach read is built, because that read is exactly the
   change that will add one.
3. **`shell.tsx` will conflict.** It is shared with live branches and I changed both the
   `MORE_DESTINATIONS` shape and the panel's render. The `PHONE_OVERFLOW_DESTINATIONS` derivation is
   the part worth preserving through any merge; a hand-written list restores the defect.
4. **`package.json` will conflict too**, for the two `test:cc-guards` entries.
5. **The demo seed writes a free-text sentinel into the cultural-identity column (§5.2).** Nothing on
   my screens reads it. It is worth deciding whether the seed should stop writing it, now that the
   input is gone — a column written only by a seed is a column that will surprise someone.
6. **`rendersAt` is a model of the CSS.** It throws on any variant it does not know, which is the
   right failure direction, but it will need teaching if the shell adopts a `max-` variant or a
   container query. The browser block is the half that does not model anything.
