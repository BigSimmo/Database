# Front-door boards — the build plan

**Builds:** the design locked in [`FRONT-DOOR-BOARDS-DECISION.md`](FRONT-DOOR-BOARDS-DECISION.md),
whose canonical source is `prototypes/mockup-front-doors-v5.html`.

**Written 2026-09-05.** Every claim below about the existing code was measured on
`claude/ward-builder-community-route` at that date, and each is cited. Where something was not
measured it says so. A plan whose premises are recalled rather than checked is how three days get
spent building the wrong thing.

---

## The finding that shapes the whole plan

**The three screens already exist.** This is not a greenfield build; it is an extension and a
restyle of live components, and that is much cheaper — and much easier to break.

| Board                | Route                                   | Component                                                                               |
| -------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| Ward                 | `/mockups/ward-flow/board/[unitId]`     | `WardBoard` — `src/components/ward-management/board/ward-board.tsx:649`                 |
| Emergency department | `/mockups/ward-flow/ed/[edId]`          | `EdScreen` — `src/components/ward-management/ed/ed-screen.tsx:664`                      |
| Community team       | `/mockups/ward-flow/community/[teamId]` | `CommunityScreen` — `src/components/ward-management/community/community-screen.tsx:141` |

⚠️ **`CommunityHome` and `CommunityTeamHub` exist and are wired to no route.** Verified by
`grep -rn "community-home" src/app/` and `grep -rn "community-team-hub" src/app/` — zero hits
both times. `CommunityTeamHub` is exercised only by a direct-render test
(`tests/ward-community-team-hub.dom.test.tsx`). They are a separate, deliberately un-routed pair
from the routed `CommunityIndex` / `CommunityScreen`; `community-home.tsx:53` says the two "must
never share a component or a data type". **Do not assume they are the community board and do not
route them as part of this work** — deciding what they are for is its own task.

### The second finding: the design already fits

The prototype is written in ckb-v2 tokens; the ward components are written in
`ward-tokens.module.css`. That looked like a design-system migration and is not one — **the ward
tokens are aliases of the ckb-v2 tokens.** Measured at `ward-tokens.module.css:22-64`:

```
--ward-ground: var(--surface-inset);   --ward-text:    var(--text);
--ward-canvas: var(--surface);         --ward-heading: var(--text-heading);
--ward-chrome: var(--surface-chrome);  --ward-muted:   var(--text-muted);
--ward-subtle: var(--surface-subtle);
```

And the radii are consumed from ckb-v2 directly, with no ward alias at all: across the ward
`*.module.css` files, `--radius-md` appears 109 times, `--radius-sm` 67, `--radius-lg` 65.

**So the two systems are one system with two names for the colours.** The build is a styling and
markup job inside components that already resolve every token the design uses.

⚠️ **I originally inferred the opposite** — that the ward screens had no radius scale — from the
fact that `ward-tokens.module.css` declares only `--ward-radius-pixel`. That inference was wrong
and I caught it only by grepping the CSS that actually ships. **A token file is not the set of
tokens a component uses.** Anyone re-checking this plan should re-run the grep, not re-read the
token file.

---

## The token map — the one thing to settle before any component is touched

Twenty-two ckb-v2 tokens appear in the prototype. Nineteen have a ward alias or are consumed
directly by ward CSS today. Three do not, and each is a decision, not a hex to invent (rule 1 of
the design language, still in force):

| Prototype token    | Status in ward code                                                                                         | What to do                                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--danger-solid`   | Ward has `--ward-danger: var(--danger-text)`, which is a **different role** — text danger, not a solid fill | Decide whether the ward layer gains a solid-danger alias, or the boards use `--danger-solid` directly. Do not reuse `--ward-danger` for a fill: it was chosen to be legible as text, not as a ground.                                      |
| `--e3` (elevation) | Not found in the ward token layer                                                                           | The design uses it only for the form menu's float. Either add a ward alias or drop the shadow and let `--ring-hairline` own the edge — which is what the design language's "borders own the edge, shadows own the lift" rule would prefer. |
| `--ring-hairline`  | Not found in the ward token layer                                                                           | Same decision, same place.                                                                                                                                                                                                                 |

**Task 0, and nothing starts before it: write the map, add the missing aliases to
`ward-tokens.module.css`, and add a test that fails if a front-door stylesheet contains a raw hex.**
An assertion that the file contains no `#` is enough and cannot be satisfied by a comment if it
strips comments first.

---

## What the model can and cannot produce — the survey

**This is the plan's most important section.** A column whose field exists on a type but that
**nothing can ever write** will type-check, render, and appear on screen as a legitimate empty
state — and no gate in this repository fails on it.

A producer survey was run over all eight columns (subagent, Sonnet, extraction). **Three of its
eight verdicts I then re-measured myself and corrected**, and every correction happened to make the
board _more_ buildable — which is exactly when a correction deserves the most scepticism, so each
one below carries the line it was read from rather than an assertion.

| Column                 | Verdict                                              | Evidence                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UMRN                   | **Has producer**                                     | `Patient.umrn`, `ward-patients-seed.ts`, reducer `:737`                                                                                                  |
| Name, date of birth    | **Has producer**                                     | `Patient.givenName / familyName / preferredName / dateOfBirth`                                                                                           |
| Bed — the _unit_       | **Reachable, but only via the referral** (corrected) | see below                                                                                                                                                |
| Bed — the _bed itself_ | **Not in the model at all** (survey stands)          | grepped `bedNumber\|bedLabel\|roomNumber`; the only hits are comments calling prototype bed numbers invented                                             |
| Form status            | **Has producer** (corrected)                         | `Movement.legalForm?: LegalForm` (`ward-model.ts` Movement:94); assigned at runtime by `ward-flow-reducer.ts:855`, and seeded across `ward-movements.ts` |
| Story / HPC            | **Not in the model at all**                          | nothing holds free presenting-complaint text                                                                                                             |
| Review status          | **Not in the model at all**                          | no field records that a clinician reviewed a patient, when, or who                                                                                       |
| Plan                   | **Not in the model at all** as free text             | the nearest are `Admission.expectedDischargeAt`, `dischargeConfirmedBy`, `followUp` — a discharge date is not a plan                                     |
| Referrals in / out     | **Derivable, not stored** (corrected)                | `Referral.patientId` exists, so referrals can be counted per patient. This is a weaker claim than "has a producer" and must not be written up as one.    |

### ⚠️ The finding that constrains the whole board

**`Admission` carries no `patientId`, no name and no UMRN.** Measured directly: the type has
twenty-one fields — `arrivedAt, awayAtEmergencyDepartmentSince, blockReason, dischargeConfirmedAt,
dischargeConfirmedBy, dischargeDateMoves, dischargeDateSetAt, dischargeDateSetBy,
expectedDischargeAt, followUp, homeRegion, id, leavingDestination, leftAt, pulledAt, referralId,
sex, specialling, state, tentativeDiagnosis, unitId` — and none of them names a person.

The join to a person therefore runs **Admission → `referralId` → Referral → `patientId` →
Patient**, and `Referral.patientId` is **optional on purpose**. The reducer's own comment at
`ward-flow-reducer.ts:2540` says why, and it is the sentence that should govern this board:

> a referral raised without a person on file is a real case, not a gap to be filled — inventing an
> id to avoid an empty field is how a referral comes to point at the wrong human being.

**Consequence: some occupied beds have no linked person, permanently and by design.** A patient
board built by walking admissions and expecting names will render blanks for those beds, and a
blank in a name column on a clinical board reads as a missing patient rather than as an
unlinked record.

**So the board is built the other way round: it walks patients, not beds**, and a patient with no
admission shows a stated "no bed recorded" rather than an empty cell. A bed whose occupant is not
linked to a patient record is its own line in the absence copy, not a silent omission.

### What this means for the four missing columns

Story, review status, plan, and per-bed location are **not deferrable presentation details — they
are the four things a ward round actually needs**, and none of them exists. Two honest routes:

- **Route A — build the board from what exists.** UMRN, name, unit, form, referral counts, and the
  discharge-date fields recast honestly as "expected out". Ships quickly, is completely truthful,
  and is a thinner board than the design.
- **Route B — add the missing records first.** A review record (who, when), a presenting-complaint
  text, a plan text, and a bed identifier. That is four new model fields with events, reducer cases,
  guards and tests — a phase of its own, and every one of them is a clinical-record decision the
  owner has to take, not a builder.

**Recommendation: Route A first, and show the design's remaining columns to nobody until Route B
is decided.** A board that shows six true columns is worth more than one that shows eight of which
four are always empty. ⚠️ **Do not build the four columns as empty ones.** An empty cell on a
clinical board is read as "nothing to report about this patient" — a clinical claim nobody made.

**The form expiry is a fifth gap.** `SELECTABLE_LEGAL_FORMS` entries carry a code and no meaning,
and **no entry carries an expiry**. The prototype's most clinically useful line — "Form 4C expires
today, a decision is needed before 18:00" — is not expressible today. It is the single highest-value
addition on this list and it belongs in Route B.

---

## Phases

Each phase names the gate that catches it failing. **A phase with no named catcher is a defect in
this plan, not a reason to be careful.**

### Phase 0 — the token map

Write the map above into `ward-tokens.module.css`, resolve the three gaps, add the no-raw-hex test.
**Catcher:** the new test, plus `npm run lint` (the repo already runs `eslint-rules/no-hardcoded-hex.mjs`).
**Size:** small. **Model tier:** Sonnet — the output is a state anyone can check.

### Phase 1 — the shared board frame

Build the `.module` shape, the top bar, the segmented board switcher, and the timer as real
components under `src/components/ward-management/`, with their own CSS module. Nothing else
changes yet. The timer takes a target and an elapsed and renders one block per unit, with blocks
past the target additional and marked.
**Catcher:** a DOM test that renders the timer with elapsed > target and asserts the block count
equals the elapsed, not the target — the exact arithmetic the 26h-against-24h case gets wrong.
Name it `*.dom.test.tsx`, never `*.test.tsx`: **a file named `*.test.tsx` matches neither vitest
include pattern and is collected by no runner.** That has already happened here once.
**Size:** medium. **Model tier:** Sonnet.

### Phase 2 — the patient board, Route A only

The table, the filter chips, the sort, the form control, the stated-absence states. **Six columns:
UMRN, patient, unit, form, expected out, referrals.** Story, review status, plan and bed number are
not built in this phase and are not rendered as empty columns — they wait on the owner's Route B
decision. **The board walks patients, never beds** (see the join finding above), and a patient with
no admission renders "no bed recorded" as words.
**Catchers, and they must be property tests, not rendering tests:**

- The filter chip counts are **derived from the rows**, never literals. Assert by setting a form
  and checking the "under a form" count moves. A test that asserts the rendered number matches a
  fixture passes whether or not the count is live.
- Filtering to empty shows the stated-absence text. Assert the text, not the absence of rows.
- A zero referral count renders the word "none". Assert the string.
  ⚠️ **59 DOM tests in this repository once passed before and after six false-statement fixes.**
  Assert the property over the fixture, and watch the test go red before you trust it.
  **Size:** large. **Model tier:** Sonnet to build, Opus to review — the review is a judgement about
  whether a clinical board states something it should not.

### Phase 3 — coming in / going out

Two lanes, each with its own axis. The axes are separate because "since referral" and "owed a
move" are different clocks.
**Catcher:** a test asserting the two lanes do not share a scale — give one lane a value that
would dominate the other's axis and assert the other lane's bar widths are unchanged.
**Size:** medium. **Model tier:** Sonnet.

### Phase 4 — seen in the last 24 hours

The work-done list.
**Catcher:** a test that every entry's timestamp is within the window the heading claims, and that
the heading's count equals the number of entries. The last version of the prototype shipped a
24-hour list disagreeing with the review times on the board beside it; only reading the screen
caught it.
**Size:** small. **Model tier:** Sonnet.

### Phase 5 — routing and navigation

Wire whatever new routes exist into `ward-nav.ts`.
**Catcher:** `tests/ward-nav.test.ts` already enforces this **two-way** — every nav href must
resolve to a real route, and every static route must appear in the nav or be recorded as
intentionally unlisted with a stated reason (`ward-nav.ts:1-17`). A one-way check is exactly what
let three boards ship with no rail entry.
**Size:** small. **Model tier:** Sonnet.

### Phase 6 — proof on the running screen

`npm run ensure`, then look at all three boards in a browser, in light and dark, at desktop and
phone widths.
⚠️ **The ward E2E specs run in neither loop.** Measured previously: `verify:ui` skips every ward
spec, and `test:focused` cannot select the `readFileSync`-based contract guards. So a green local
run is not evidence these screens work. **Look at the screen.**
**Catcher:** human eyes, plus `npm run verify:phone-chrome` if any phone chrome is touched.
**Model tier:** not delegable.

---

## What must not happen

- **No `git add -A`.** Other agents share this worktree.
- **Nothing merges to the master line from here.** Ward Lead is the sole integrator.
- **`escalation/escalation-board.tsx` is off limits** — it is an open governance question with the owner.
- **Do not restyle the other eleven prototypes** to this language. Separate owner decision.
- **Do not invent a patient name, record number, address or phone number.** The seeded patients and
  the five real form codes are what exists; anything else is a finding to report.
- **Do not delete `wards/ward-overview.module.css`** — the owner's standing decision.

## Open questions for the owner

1. **Route A or Route B?** Six true columns now, or four new clinical records first. This is the
   one that decides how long the build takes and it is not a builder's call — a review record, a
   presenting-complaint text and a plan text are each a decision about what this system claims to
   hold about a patient.
2. **Should a legal form carry an expiry?** The prototype's best line — a form lapsing at 18:00 —
   is not expressible today. Highest-value single addition on the list.
3. Does this design govern only these three boards, or every Ward Flow screen? The plan assumes
   the three.
4. Arrows (`←` / `→`) or up-down (`↓` / `↑`) for direction? Two languages currently disagree.
