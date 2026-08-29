# Ward Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One page per inpatient unit showing every bed as a bed — who is in it, how long, when they leave and where to — with a one-minute daily update that keeps it honest.

**Architecture:** A new `Admission` record (the first person _inside_ a bed) drives everything. The ward sets one expected discharge date per admission; the bed's predicted release, the discharge board, the arrows, the tile colours and the morning page's forward figures are all derived from it. The board reuses Phase 7's matching so the ward and the coordinator can never give different answers about the same person.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, CSS modules, Vitest (unit + DOM), Playwright (journeys). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-28-ward-flow-ward-board-design.md` — read it in full before Task 1. Every `D<n>` reference below points into it.

---

## Global Constraints

Copied verbatim from the spec and from `AGENTS.md`. **Every task's requirements implicitly include this section.**

- **Never invent a legal figure.** No figure, timeframe, threshold or duration from the Mental Health Act, anywhere — code, copy, comment, test or fixture. A plain Voluntary/Involuntary label is permitted and is not a legal figure.
- **No free text, anywhere.** Every reason, destination and category comes from a fixed runtime array with a membership check. No `notes`, no `comment`, no `<textarea>`, no free `<input type="text">` on any new surface.
- **No diagnosis.** Owner decision, 2026-08-28 (D5). The layout leaves space; adding it later costs one field and needs a recorded owner decision.
- **Synthetic data only.** No name, date of birth, record number, address, or narrative history.
- **Local and offline only.** Never `verify:release`, any `eval:*`, `check:supabase-project`, `test:live`, or anything touching OpenAI, Supabase, hosted CI or a live database.
- **Never push, never open a pull request.** Every commit stays local on `claude/ward-flow-phases-6-7-design`.
- **Never `git stash`.** The stack is shared across every worktree on this machine.
- **No gate skipped, no assertion deleted, no test loosened.** If a change would reduce what can honestly be claimed, do not make it — record it instead.
- **Every bed dimension is "does this bed accept this person", never an equality.** `bed.sexDesignation === referral.sex` excludes every undesignated bed — most of the network — and looks entirely reasonable in review.
- **Owner's stay bands, verbatim:** under 1 week · 1–4 weeks · 1–3 months · over 3 months.
- **Colour never carries a fact alone.** Every colour has the same fact beside it in words or numbers.
- **One owner-pending list must not be invented** (D15). D9's list was ANSWERED on 2026-08-28 — reuse `BED_RELEASE_BLOCKERS`, never define a second vocabulary for the same fact.
- **The bed model is THREE stages plus a flag** — `predicted | confirmed | released`, with `blocked` a flag (`blocker` + `blockedBy`) sitting on a predicted or confirmed release. `blocked` is never a state. A blocked-but-confirmed bed KEEPS counting as confirmed.
- **`BedRelease.confidence` no longer exists.** It is `waitingOn`, from `BED_RELEASE_WAITING_ON`.
- **A bed carrying a preparation note is still available** — still offered, still in `availableNow`, still in every figure.
- **Prefix every shell command with `cd /d/Worktrees/Database/pr-2390-fix &&`.** The working directory silently reverts otherwise.

## Hard gate before Task 1

**REVISED 2026-08-28.** Phase 7 is now COMPLETE. **Phase 8 is what is in flight**, in this same
worktree, and the gate is unchanged in substance: no task may begin while another session is
building here. The pre-commit hook inspects the **whole working tree**, not the staged set, so two
implementers cannot commit independently even with disjoint files.

Verify before starting: `git status --short` is clean and no Phase 8 task is mid-flight.

**Thirty commits landed between this plan being written and being revised.** Five changed things it
depends on — the three-stage bed model, `waitingOn` replacing `confidence`, the owner-approved
`BED_RELEASE_BLOCKERS`, the filled `BED_PREPARATION_NOTES`, and Phase 8's travel bands. Every one is
reflected below. **Before writing code, re-read those four arrays in the source rather than trusting
the quotations in this plan** — it has been overtaken once already and may have been again.

## Owner-pending — must not be filled in by an agent

| Item                                 | Spec | State                                                                                                                                                                    |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~Blocked-discharge reason list~~    | D9   | **ANSWERED 2026-08-28.** The owner approved it separately; it shipped as the eight-entry `BED_RELEASE_BLOCKERS`. This board REUSES that list and defines none of its own |
| Receiving-window options at the pull | D15  | Not drafted. **The field is not built** until he supplies them. Task 3 leaves the event shape ready; no UI                                                               |
| `sex` on an admission                | D5   | Flagged as a small governance widening with the fallback named. Silence read as acceptance                                                                               |

---

---

## ADDENDUM, 2026-08-29 — parallel execution, four owner decisions, and three lessons from Phase 8

### Branch and scope

This work now runs **simultaneously with Phase 8**, on branch `claude/ward-flow-ward-board`, cut
from Phase 8's tip `15bdddda1`, in the pre-installed worktree
`D:\Repos\Database\.claude\worktrees
ostalgic-vaughan-7ee231`. No new worktree was created.

**Only the logic layer runs in parallel.** Six tasks — 1, 3, 4, 5, 6, 7 — every one creating files
that do not exist on Phase 8's branch. Everything else waits.

| Runs now                                                                                          | Waits for Phase 8                                                                                  |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1 (occupancy record), 3 (seed), 4 (discharge dates), 5 (board figures), 6 (teams), 7 (statistics) | 2 (events/reducer/provider), 8–18 (components, page, nav, retiring the ward screen, journey, gate) |

**The rule that makes it safe: never edit a file that already exists on Phase 8's branch.** Read
from `ward-model.ts`, `ward-sites.ts`, `ward-bed-availability.ts` and `ward-distance.ts` as much as
needed; write to none of them. Task 1 therefore puts the occupancy record **in its own new file**,
not in `ward-model.ts` — which is also better structure, since that file is already large.

**Merge Phase 8's branch into this one at every task boundary**, not at the end. Phase 8 has changed
the shared model twice this week; drift is caught cheaply at each step and expensively at the end.

### The four owner decisions, 2026-08-29

1. **ONE record, not two.** The occupancy record is the single answer to "who is in this bed, since
   when, and how far from home". It serves the ward board **and** Phase 8's out-of-area ledger.
   Phase 8's `Referral.arrivedAt` (added in its Task 2, `ef4af1c85`) is superseded by it — one commit
   old, cheap to unwind. **Phase 8 must be told**; until it is, do not assume its Tasks 3 and 5 read
   from this record.
2. **Ten WA regions stay.** Not the coarser metro/country grouping. Unchanged from what is built.
3. **`sex` goes on the occupancy record** — confirmed, not merely unopposed. The ward's typed
   male/female counts become derived, which is the point.
4. **Parallel work approved**, on its own branch, logic layer only.

Still outstanding: **the receiving-time options at the pull (D15).** Task 15 is not in this parallel
set, so nothing is blocked.

### Three lessons from Phase 8's ledger — all BINDING here

**1. `mutate.sh` cannot fail, and this plan told you to use it.**

`.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/mutate.sh` lines 29–30 copy the backup
over the source and then `diff` the backup against that copy — comparing a file with itself. Its
"restore verified byte-identical" line proves only that `cp` succeeded. **A check that cannot fail,
inside the tool every task uses to prove its checks can fail.** Its line-27 "sed matched nothing"
guard is sound and unaffected.

**Every mutation in this plan must instead:** record `git hash-object` for the file before mutating,
restore, re-record, compare the two blob ids, **and** confirm `git status --porcelain` is empty.
That last part is not belt-and-braces: a single-file comparison cannot catch a `sed` that also
matched in a second file, which happened on this branch once and broke 33 tests nobody had
considered. Ignore every `mutate.sh` invocation written in Tasks 1 and 2 above.

**2. An assertion that searches for a satisfying example is not an invariant.**

Phase 8's most valuable finding: its "distance is not a gate" test **survived a real distance gate**,
because it searched the fixture for an out-of-area bed that accepts a referral and simply found a
different pair the mutant still allowed. It passed as soon as _any_ example existed — including one
the defect itself permitted. It is now stated as verdict invariance under home region, which no
distance gate survives under any name.

**Restate the behavioural tests in this plan as invariants**, not searches. Specifically:

- **The preparation-note trap (Task 8):** assert that a unit's available count is **invariant** under
  adding a preparation note to one of its beds. Do not search for a bed that is still offered — that
  passes the moment any bed is.
- **The blocked cross-cut (Task 4):** assert the confirmed count is **invariant** under blocking a
  confirmed release, and that the blocked count rises. Not "find a blocked release that is still
  counted".
- **The sex constraint (Task 5):** assert the accepting-bed count is **invariant** under changing the
  referral's sex when every bed is undesignated. Not "find an undesignated bed that accepts a man".
- **Fixture-coverage assertions in Task 3 are exempt** — `some(...)` is correct there, because the
  claim genuinely is "the fixture contains such a case".

**3. One exported function, never two components agreeing** (Phase 8 ruling 20).

"How many of these beds accept this person" is a **verdict, not arithmetic**. Two surfaces will show
it — the ward board's headline and its bed grid — and two components each deciding what "accepts"
means is how this project ended up with three screens holding one label and two of them disagreeing.
`headlineAvailable` and `constraintSentence` (Task 5) must be the single source for both, and the
count must derive from the **same verdict the tiles render**, structurally rather than
coincidentally. It counts what is present, never what is missing; empty groups return zero and are
still rendered.

## Speed model — how this phase runs fast without weakening anything

The single biggest cost here is not thinking, it is **lock contention**. Lint, typecheck, full Vitest, build and Playwright serialise across every one of the 221 worktrees on this machine. A task that runs `npm run lint` costs the whole phase twenty minutes and proves nothing a focused run did not.

**Rules for every implementer:**

1. **Run only `npm run test:focused -- --files <your test paths>`.** Never `lint`, never `typecheck`, never `npm run test`, never `build`, never Playwright. The controller runs those once, at the end.
2. **A refusal saying "capacity is full", or exit 75, means BLOCKED — retry.** It is never a failure. Do not "fix" anything in response to it.
3. **`GATE_RECEIPTS=refresh` only when fresh evidence is the point.** Results are memoised; a plain re-run can exit 0 having printed no test-count line at all, which proves nothing ran. Always quote the `N passed` line, never the exit code alone.
4. **Test and implementation live in the same task.** Splitting them doubles the handoff cost and the context re-read.
5. **Never `git add -A`.** Another agent may share this worktree. Stage the exact paths listed in your task and nothing else.
6. **Reuse the Phase 7 tooling** rather than rebuilding it — all in `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/`:
   - `mutate.sh` — apply a mutation, run the test, restore, verify byte-identical. Refuses a mutation that matched nothing.
   - `capture.mjs` — a route at 390/820/1440 plus print, reporting overflow, console errors, duplicate test ids and A4 page count.

**Controller parallelism.** Implementers write to disjoint files concurrently; **the controller commits them one at a time with explicit paths.** Read-only reviewers run fully concurrently and are free — dispatch them in fan-out, never serially.

| Wave            | Tasks      | Shape                                                    |
| --------------- | ---------- | -------------------------------------------------------- |
| A — the spine   | 1, 2, 3    | **Serial.** Same four core files. Nothing else can start |
| B — derivations | 4, 5, 6, 7 | **Parallel.** Four new files, no overlap                 |
| C — components  | 8, 9, 10   | **Parallel.** Three new files, no overlap                |
| D — assembly    | 11, 12, 13 | **Serial.** Each consumes the last                       |
| E — reach       | 14, 15, 16 | **Parallel.** Route/nav, retirement, print+phone         |
| F — proof       | 17, 18     | **Serial.** Journey, then the one reliability gate       |

**Review:** two-stage per task — a fresh reviewer reads the diff against the task brief, then a second reads it against the spec. Both read-only, both concurrent, both cheap.

---

## File structure

**Create:**

| File                                                              | Responsibility                                                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/components/ward-management/ward-admissions.ts`               | The `Admission` type, its states, stay banding, day counts, tile state                          |
| `src/components/ward-management/ward-admissions-seed.ts`          | The synthetic seed, separate for the same reason `ward-movements.ts` is separate from the model |
| `src/components/ward-management/ward-discharge-dates.ts`          | Date → `BedRelease` derivation, slippage, the statewide netting rule                            |
| `src/components/ward-management/ward-teams.ts`                    | Region → synthetic community team                                                               |
| `src/components/ward-management/ward-board-derivations.ts`        | Headline figure, the constraint sentence, since-yesterday, arrow selection                      |
| `src/components/ward-management/ward-statistics.ts`               | The six ward-level figures                                                                      |
| `src/components/ward-management/board/bed-grid.tsx`               | The beds, and only the beds                                                                     |
| `src/components/ward-management/board/board-left-column.tsx`      | Referrals ⇄ discharges toggle                                                                   |
| `src/components/ward-management/board/board-patient-panel.tsx`    | The right panel, never blank                                                                    |
| `src/components/ward-management/board/ward-board.tsx`             | Assembles the three, owns selection                                                             |
| `src/components/ward-management/board/daily-sheet.tsx`            | The one-minute update                                                                           |
| `src/components/ward-management/board/board.module.css`           | All board styling                                                                               |
| `src/components/ward-management/statistics/statistics-page.tsx`   | The statewide comparison                                                                        |
| `src/components/ward-management/statistics/statistics.module.css` | Its styling                                                                                     |
| `src/app/mockups/ward-flow/statistics/page.tsx`                   | Route                                                                                           |

**Modify:**

| File                                               | Change                                                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ward-model.ts`                                    | `Admission`, `ADMISSION_STATES`, `STAY_BANDS`, `LEAVING_DESTINATIONS`, `BED_RELEASE_BLOCKERS`, `PULL_RELEASE_REASONS`, plus `SEXES` and `URGENCY_LEVELS` (Phase 7 Task 4 flagged both as missing) |
| `ward-flow-events.ts`                              | Eight new events                                                                                                                                                                                  |
| `ward-flow-reducer.ts`                             | Their handlers, and admission creation on `PATIENT_ARRIVED`                                                                                                                                       |
| `ward-flow-provider.tsx`                           | Expose `admissions`                                                                                                                                                                               |
| `ward-nav.ts`                                      | The statistics route                                                                                                                                                                              |
| `src/app/mockups/ward-flow/ward/[unitId]/page.tsx` | Render `WardBoard`                                                                                                                                                                                |
| `ward-screen.tsx`                                  | Retired into the board (Task 15)                                                                                                                                                                  |

---

## Wave A — the spine (serial)

### Task 1: The admission record

**Files:**

- Modify: `src/components/ward-management/ward-model.ts`
- Create: `src/components/ward-management/ward-admissions.ts`
- Test: `tests/ward-admission-model.test.ts`

**Interfaces:**

- Produces: `Admission`, `ADMISSION_STATES`, `AdmissionState`, `STAY_BANDS`, `StayBand`, `LEAVING_DESTINATIONS`, `LeavingDestination`, `BED_RELEASE_BLOCKERS`, `DischargeBlockReason`, `PULL_RELEASE_REASONS`, `PullReleaseReason`, `SEXES`, `URGENCY_LEVELS`; and from `ward-admissions.ts`: `stayBand(admission, now)`, `daysInBed(admission, now)`, `bedIsOccupied(admission)`, `isPastExpectedDischarge(admission, now)`, `admissionsForUnit(admissions, unitId)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ward-admission-model.test.ts
import { describe, expect, it } from "vitest";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { ADMISSION_STATES, STAY_BANDS, type Admission } from "@/components/ward-management/ward-model";
import {
  bedIsOccupied,
  daysInBed,
  isPastExpectedDischarge,
  stayBand,
} from "@/components/ward-management/ward-admissions";

const base: Admission = {
  id: "AD-001",
  unitId: "bty-adult-secure",
  referralId: "RF-001",
  sex: "Female",
  homeRegion: "Peel",
  state: "occupied",
  pulledAt: 0,
  arrivedAt: 120,
  expectedDischargeAt: 30 * MINUTES_PER_DAY,
  dischargeDateMoves: 0,
  dischargeDateSetAt: 120,
  dischargeDateSetBy: "BTY Adult Secure",
  blockReason: null,
  leavingDestination: null,
  leftAt: null,
};

describe("admission model", () => {
  it("lists exactly the four states, in lifecycle order", () => {
    expect(ADMISSION_STATES).toEqual(["waitlisted", "pulled", "occupied", "left"]);
  });

  it("uses the owner's four stay bands verbatim", () => {
    expect(STAY_BANDS.map((band) => band.id)).toEqual(["under-1-week", "1-4-weeks", "1-3-months", "over-3-months"]);
  });

  // The bed is lost at the PULL, not the arrival (spec D2). This is the rule the whole
  // board rests on and it is the one an unfamiliar reviewer is most likely to "correct".
  it("counts a pulled bed as occupied even though nobody has arrived", () => {
    expect(bedIsOccupied({ ...base, state: "pulled", arrivedAt: null })).toBe(true);
  });

  it("does not count a waitlisted person against a bed", () => {
    expect(bedIsOccupied({ ...base, state: "waitlisted", pulledAt: null, arrivedAt: null })).toBe(false);
  });

  it("does not count a departed person against a bed", () => {
    expect(bedIsOccupied({ ...base, state: "left" })).toBe(false);
  });

  // Two different clocks: the bed has been gone since the pull, the PERSON's stay runs
  // from arrival. Conflating them overstates every length of stay by the transport delay.
  it("counts the person's days from arrival, not from the pull", () => {
    expect(daysInBed({ ...base, pulledAt: 0, arrivedAt: MINUTES_PER_DAY }, 6 * MINUTES_PER_DAY)).toBe(5);
  });

  it("bands a five-day stay as under a week", () => {
    expect(stayBand({ ...base, arrivedAt: 0 }, 5 * MINUTES_PER_DAY)).toBe("under-1-week");
  });

  it("bands a seven-day stay as one to four weeks, not under a week", () => {
    expect(stayBand({ ...base, arrivedAt: 0 }, 7 * MINUTES_PER_DAY)).toBe("1-4-weeks");
  });

  it("bands a hundred-day stay as over three months", () => {
    expect(stayBand({ ...base, arrivedAt: 0 }, 100 * MINUTES_PER_DAY)).toBe("over-3-months");
  });

  it("reports no band for someone who has not arrived", () => {
    expect(stayBand({ ...base, state: "pulled", arrivedAt: null }, 5 * MINUTES_PER_DAY)).toBeNull();
  });

  it("marks someone past their own expected discharge date", () => {
    expect(isPastExpectedDischarge(base, 31 * MINUTES_PER_DAY)).toBe(true);
  });

  // An absent date must never read as "not yet due" — the same discipline LegalForm.dueAt holds.
  it("never treats a missing discharge date as not yet due", () => {
    expect(isPastExpectedDischarge({ ...base, expectedDischargeAt: null }, 999 * MINUTES_PER_DAY)).toBe(false);
  });

  it("carries no free-text or clinical field, ever", () => {
    const permitted = [
      "id",
      "unitId",
      "referralId",
      "sex",
      "homeRegion",
      "state",
      "pulledAt",
      "arrivedAt",
      "expectedDischargeAt",
      "dischargeDateMoves",
      "dischargeDateSetAt",
      "dischargeDateSetBy",
      "blockReason",
      "leavingDestination",
      "leftAt",
    ].sort();
    expect(Object.keys(base).sort()).toEqual(permitted);
    for (const banned of ["notes", "note", "comment", "diagnosis", "name", "dob", "patientId", "address"]) {
      expect(permitted).not.toContain(banned);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd /d/Worktrees/Database/pr-2390-fix && npm run test:focused -- --files tests/ward-admission-model.test.ts
```

Expected: FAIL — `ward-admissions` does not exist, `ADMISSION_STATES` is not exported.

- [ ] **Step 3: Add the types to `ward-model.ts`**

Append near `Referral`. Every runtime array gets the doc comment discipline the neighbouring unions already carry — a union with no runtime array is this repository's most reliable silent failure (four shipped occurrences).

```ts
/** The four states an occupancy passes through. Hand-listed, never derived: a UI picker needs a
 *  runtime list, not just a type — the same reason DECLINE_REASONS and COHORTS carry one. */
export const ADMISSION_STATES = ["waitlisted", "pulled", "occupied", "left"] as const;
export type AdmissionState = (typeof ADMISSION_STATES)[number];

/**
 * The product owner's four length-of-stay bands, supplied verbatim on 2026-08-28. These are HIS
 * bands, not a derived or clinical threshold, and every surface rendering them must say so. Never
 * add a band, retune a boundary, or introduce a "target" band — a threshold nobody agreed to,
 * used to judge people, is explicitly refused (spec D20).
 */
export const STAY_BANDS = [
  { id: "under-1-week", label: "Under 1 week", upToDays: 7 },
  { id: "1-4-weeks", label: "1–4 weeks", upToDays: 28 },
  { id: "1-3-months", label: "1–3 months", upToDays: 90 },
  { id: "over-3-months", label: "Over 3 months", upToDays: null },
] as const;
export type StayBand = (typeof STAY_BANDS)[number]["id"];

/**
 * Where a person goes when they leave a bed. `countsAsStatewideRelease` is the whole point of this
 * list (spec D8): a transfer to another psychiatric ward frees the SENDING ward's bed but gives the
 * state no bed at all. Netting that to zero is a correctness rule, not a refinement — the first
 * draft of this design would have counted one.
 */
export const LEAVING_DESTINATIONS = [
  { id: "community", label: "Discharged to the community", countsAsStatewideRelease: true },
  { id: "another_psychiatric_ward", label: "Transferred to another psychiatric ward", countsAsStatewideRelease: false },
  { id: "general_hospital", label: "Transferred to a general hospital", countsAsStatewideRelease: true },
  { id: "residential_care", label: "Moved to residential care", countsAsStatewideRelease: true },
  { id: "left_against_advice", label: "Left against advice", countsAsStatewideRelease: true },
] as const;
export type LeavingDestination = (typeof LEAVING_DESTINATIONS)[number]["id"];

/**
 * NO NEW LIST HERE. Spec D9 originally proposed a ten-item draft; it is WITHDRAWN. The owner
 * approved the blocked-discharge vocabulary separately on 2026-08-28 and it shipped as
 * `BED_RELEASE_BLOCKERS` in `ward-change-reasons.ts` — eight entries, including the
 * "Awaiting family or carer arrangement" addition that deliberately overturned a Phase 5 exclusion.
 *
 * Import it. Do not define a second vocabulary for the same fact: a ward and a coordinator naming
 * the same obstacle two different ways is the defect class this repository produces most reliably,
 * and it is exactly what the withdrawn draft would have caused.
 */
// import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";

/** Why a pull was released. Same discipline: about the network or the journey, never the person.
 *  A pull never expires on a timer — that would need an invented number, and a bed could reappear
 *  while the patient is genuinely still on their way (spec D2). */
export const PULL_RELEASE_REASONS = [
  "clinical_condition_changed",
  "transport_unavailable",
  "placed_elsewhere",
  "admission_declined_by_patient",
  "pulled_in_error",
] as const;
export type PullReleaseReason = (typeof PULL_RELEASE_REASONS)[number];

/** Runtime members for two unions that had none. Phase 7 Task 4 shipped hand-written literals in
 *  the intake form's Sex and urgency pickers and flagged it: that is the SAME defect class that has
 *  produced four silent failures here. Every picker derives from these. */
export const SEXES = ["Female", "Male"] as const;
export const URGENCY_LEVELS = [1, 2, 3] as const;

/**
 * A person occupying, or committed to, ONE bed in ONE unit — the first record in this prototype of
 * a person INSIDE a bed rather than travelling toward one. Carries exactly two facts about the
 * person (`sex`, `homeRegion`) and nothing else: no name, date of birth, record number, address,
 * DIAGNOSIS (owner decision, 2026-08-28), narrative history, treatment, or free text of any kind.
 * `tests/ward-admission-model.test.ts` asserts this against the type's own field set, so a future
 * field named `notes` or `diagnosis` fails a test rather than being discouraged by convention.
 *
 * `sex` is a small, deliberate widening: a unit already records `sexMix` as counts, so the system
 * already knows this in aggregate. Carrying it per-admission makes that count derived rather than
 * hand-maintained — this repository's single most reliable source of silent failure — and powers
 * the "only 1 will take a man" line, the commonest real reason a bed is not a bed. The owner was
 * offered the ward-level-count-only fallback and did not take it.
 */
export type Admission = {
  id: string;
  unitId: string;
  /** The referral this occupancy came from. A role-free link, never a patient identifier. */
  referralId: string;
  sex: Sex;
  homeRegion: HomeRegion;
  state: AdmissionState;
  /** When the ward pulled them. THE BED IS GONE FROM THIS MOMENT — not from `arrivedAt`. */
  pulledAt: Instant | null;
  arrivedAt: Instant | null;
  /** The ward's own expected discharge date, and the single fact every forward-looking figure on
   *  the board is derived from (spec D4). Null means no date set — never "not yet due". */
  expectedDischargeAt: Instant | null;
  /** How many times that date has been moved. A ward-level fact with nothing about the person in
   *  it, and the difference between a prediction a coordinator plans against and one they discount. */
  dischargeDateMoves: number;
  dischargeDateSetAt: Instant | null;
  /** A role — a unit or service label. Never a personal name. */
  dischargeDateSetBy: string | null;
  /** Non-null only while this person is ready to leave and cannot (spec D9). */
  blockReason: DischargeBlockReason | null;
  leavingDestination: LeavingDestination | null;
  leftAt: Instant | null;
};
```

- [ ] **Step 4: Write `ward-admissions.ts`**

```ts
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { STAY_BANDS, type Admission, type StayBand } from "@/components/ward-management/ward-model";

/**
 * Whether this admission is consuming a bed right now. `"pulled"` counts (spec D2): the ward has
 * given the bed away and it is unavailable to anyone else, even though the person is still sitting
 * in an emergency department. Do NOT "correct" this to require `arrivedAt` — that reads as the
 * obvious fix and silently returns a bed to the statewide supply that no longer exists.
 */
export function bedIsOccupied(admission: Admission): boolean {
  return admission.state === "pulled" || admission.state === "occupied";
}

/** The PERSON's stay, counted from arrival. The bed has been gone since the pull; these are two
 *  different clocks and conflating them overstates every length of stay by the transport delay. */
export function daysInBed(admission: Admission, now: Instant): number | null {
  if (admission.arrivedAt === null || !Number.isFinite(admission.arrivedAt)) return null;
  const end = admission.leftAt ?? now;
  return Math.floor((end - admission.arrivedAt) / MINUTES_PER_DAY);
}

/** Null for anyone who has not arrived — a pulled-but-empty bed has no length of stay, and
 *  substituting a zero would band it as a fresh admission. */
export function stayBand(admission: Admission, now: Instant): StayBand | null {
  const days = daysInBed(admission, now);
  if (days === null) return null;
  for (const band of STAY_BANDS) {
    if (band.upToDays === null || days < band.upToDays) return band.id;
  }
  return STAY_BANDS[STAY_BANDS.length - 1].id;
}

/** A missing date is never "not yet due" — the same discipline `LegalForm.dueAt` holds. It renders
 *  as "no date set" and returns false here, so an undated admission can never be styled as on time. */
export function isPastExpectedDischarge(admission: Admission, now: Instant): boolean {
  if (admission.expectedDischargeAt === null || !Number.isFinite(admission.expectedDischargeAt)) return false;
  if (admission.state === "left") return false;
  return now > admission.expectedDischargeAt;
}

export function admissionsForUnit(admissions: Admission[], unitId: string): Admission[] {
  return admissions.filter((admission) => admission.unitId === unitId && admission.state !== "left");
}
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
cd /d/Worktrees/Database/pr-2390-fix && npm run test:focused -- --files tests/ward-admission-model.test.ts
```

Expected: PASS. **Quote the `N passed` line.** Exit 0 alone is not proof — receipts are memoised.

- [ ] **Step 6: Mutation-test the three rules that matter**

For each mutation: apply, run, watch it go RED, quote the failure line, restore byte-identically.

```bash
cd /d/Worktrees/Database/pr-2390-fix && bash .superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/mutate.sh \
  src/components/ward-management/ward-admissions.ts \
  'admission.state === "pulled" || admission.state === "occupied"' \
  'admission.state === "occupied"' \
  tests/ward-admission-model.test.ts
```

Expected RED on `counts a pulled bed as occupied even though nobody has arrived`. Then repeat for `daysInBed` reading `pulledAt` instead of `arrivedAt` (expect RED on the two-clocks test), and for `isPastExpectedDischarge` returning `true` on a null date (expect RED on the never-not-yet-due test).

- [ ] **Step 7: Commit**

```bash
cd /d/Worktrees/Database/pr-2390-fix && git add src/components/ward-management/ward-model.ts src/components/ward-management/ward-admissions.ts tests/ward-admission-model.test.ts && git commit -m "feat(ward-flow): the admission record — a person inside a bed"
```

---

### Task 2: The events and the reducer

**Files:**

- Modify: `src/components/ward-management/ward-flow-events.ts`, `ward-flow-reducer.ts`, `ward-flow-provider.tsx`
- Test: `tests/ward-admission-reducer.test.ts`

**Interfaces:**

- Consumes: everything Task 1 produced.
- Produces: events `WAITLIST_REFERRAL`, `REORDER_WAITLIST`, `PULL_PATIENT`, `RELEASE_PULL`, `SET_DISCHARGE_DATE`, `BLOCK_DISCHARGE`, `RECORD_LEAVING`, `CONFIRM_WARD_DAY`; reducer state gains `admissions: Admission[]` and `waitlists: Record<string, string[]>` (unit id → ordered referral ids); provider context gains `admissions` and `waitlists`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ward-admission-reducer.test.ts — the eight rules the board rests on.
import { describe, expect, it } from "vitest";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { wardFlowReducer, initialWardFlowState } from "@/components/ward-management/ward-flow-reducer";

const ward = { role: "ward" as const, now: 600 };

describe("admission reducer", () => {
  it("a waitlisted referral does not consume a bed", () => {
    const before = initialWardFlowState();
    const after = wardFlowReducer(before, {
      type: "WAITLIST_REFERRAL",
      ...ward,
      unitId: "bty-adult-secure",
      referralId: "RF-001",
    });
    expect(after.waitlists["bty-adult-secure"]).toContain("RF-001");
    expect(after.admissions.filter((a) => a.state === "pulled" || a.state === "occupied")).toHaveLength(
      before.admissions.filter((a) => a.state === "pulled" || a.state === "occupied").length,
    );
  });

  it("pulling removes an available bed immediately, before anyone arrives", () => {
    const waitlisted = wardFlowReducer(initialWardFlowState(), {
      type: "WAITLIST_REFERRAL",
      ...ward,
      unitId: "bty-adult-secure",
      referralId: "RF-001",
    });
    const pulled = wardFlowReducer(waitlisted, {
      type: "PULL_PATIENT",
      ...ward,
      unitId: "bty-adult-secure",
      referralId: "RF-001",
    });
    const admission = pulled.admissions.find((a) => a.referralId === "RF-001");
    expect(admission?.state).toBe("pulled");
    expect(admission?.pulledAt).toBe(600);
    expect(admission?.arrivedAt).toBeNull();
  });

  it("pulling withdraws the person from every other ward's waitlist", () => {
    let state = initialWardFlowState();
    state = wardFlowReducer(state, {
      type: "WAITLIST_REFERRAL",
      ...ward,
      unitId: "bty-adult-secure",
      referralId: "RF-001",
    });
    state = wardFlowReducer(state, {
      type: "WAITLIST_REFERRAL",
      ...ward,
      unitId: "rph-adult-secure",
      referralId: "RF-001",
    });
    state = wardFlowReducer(state, { type: "PULL_PATIENT", ...ward, unitId: "bty-adult-secure", referralId: "RF-001" });
    expect(state.waitlists["rph-adult-secure"] ?? []).not.toContain("RF-001");
  });

  it("releasing a pull returns the bed and records the reason", () => {
    let state = wardFlowReducer(initialWardFlowState(), {
      type: "WAITLIST_REFERRAL",
      ...ward,
      unitId: "bty-adult-secure",
      referralId: "RF-001",
    });
    state = wardFlowReducer(state, { type: "PULL_PATIENT", ...ward, unitId: "bty-adult-secure", referralId: "RF-001" });
    state = wardFlowReducer(state, {
      type: "RELEASE_PULL",
      ...ward,
      admissionId: state.admissions.at(-1)!.id,
      reason: "transport_unavailable",
    });
    expect(state.admissions.at(-1)?.state).toBe("left");
    expect(state.unwinds.some((u) => u.kind === "pull_released")).toBe(true);
  });

  it("refuses a pull-release reason outside the fixed list, by membership not truthiness", () => {
    let state = wardFlowReducer(initialWardFlowState(), {
      type: "WAITLIST_REFERRAL",
      ...ward,
      unitId: "bty-adult-secure",
      referralId: "RF-001",
    });
    state = wardFlowReducer(state, { type: "PULL_PATIENT", ...ward, unitId: "bty-adult-secure", referralId: "RF-001" });
    const id = state.admissions.at(-1)!.id;
    const after = wardFlowReducer(state, {
      type: "RELEASE_PULL",
      ...ward,
      admissionId: id,
      reason: "ran_out_of_beds" as never,
    });
    expect(after.admissions.find((a) => a.id === id)?.state).toBe("pulled");
    expect(after.rejections.at(-1)?.reason).toMatch(/reason/i);
  });

  it("setting a discharge date a second time counts as a move", () => {
    let state = wardFlowReducer(initialWardFlowState(), {
      type: "WAITLIST_REFERRAL",
      ...ward,
      unitId: "bty-adult-secure",
      referralId: "RF-001",
    });
    state = wardFlowReducer(state, { type: "PULL_PATIENT", ...ward, unitId: "bty-adult-secure", referralId: "RF-001" });
    const id = state.admissions.at(-1)!.id;
    state = wardFlowReducer(state, {
      type: "SET_DISCHARGE_DATE",
      ...ward,
      admissionId: id,
      expectedDischargeAt: 5 * MINUTES_PER_DAY,
    });
    expect(state.admissions.find((a) => a.id === id)?.dischargeDateMoves).toBe(0);
    state = wardFlowReducer(state, {
      type: "SET_DISCHARGE_DATE",
      ...ward,
      admissionId: id,
      expectedDischargeAt: 9 * MINUTES_PER_DAY,
    });
    expect(state.admissions.find((a) => a.id === id)?.dischargeDateMoves).toBe(1);
  });

  it("refuses to confirm the ward day while a discharge date sits in the past", () => {
    let state = wardFlowReducer(initialWardFlowState(), {
      type: "WAITLIST_REFERRAL",
      ...ward,
      unitId: "bty-adult-secure",
      referralId: "RF-001",
    });
    state = wardFlowReducer(state, { type: "PULL_PATIENT", ...ward, unitId: "bty-adult-secure", referralId: "RF-001" });
    const id = state.admissions.at(-1)!.id;
    state = wardFlowReducer(state, {
      type: "SET_DISCHARGE_DATE",
      ...ward,
      admissionId: id,
      expectedDischargeAt: 1 * MINUTES_PER_DAY,
    });
    const later = { role: "ward" as const, now: 10 * MINUTES_PER_DAY };
    const after = wardFlowReducer(state, { type: "CONFIRM_WARD_DAY", ...later, unitId: "bty-adult-secure" });
    expect(after.wardDayConfirmedAt["bty-adult-secure"]).toBeUndefined();
    expect(after.rejections.at(-1)?.reason).toMatch(/past/i);
  });

  it("confirms the ward day when no date has been left in the past", () => {
    const state = wardFlowReducer(initialWardFlowState(), {
      type: "CONFIRM_WARD_DAY",
      ...ward,
      unitId: "bty-adult-secure",
    });
    expect(state.wardDayConfirmedAt["bty-adult-secure"]).toBe(600);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd /d/Worktrees/Database/pr-2390-fix && npm run test:focused -- --files tests/ward-admission-reducer.test.ts
```

Expected: FAIL — the event types do not exist.

- [ ] **Step 3: Add the eight events to `ward-flow-events.ts`**

Follow the shape of the existing events exactly — every one carries `role`, `now`, and validates its reason against the runtime array by membership, never truthiness (the pattern `RECEIVE_REFERRAL` established in Phase 7).

```ts
  | { type: "WAITLIST_REFERRAL"; role: WardFlowRole; now: Instant; unitId: string; referralId: string }
  | { type: "REORDER_WAITLIST"; role: WardFlowRole; now: Instant; unitId: string; referralId: string; toIndex: number }
  | { type: "PULL_PATIENT"; role: WardFlowRole; now: Instant; unitId: string; referralId: string }
  | { type: "RELEASE_PULL"; role: WardFlowRole; now: Instant; admissionId: string; reason: PullReleaseReason }
  | { type: "SET_DISCHARGE_DATE"; role: WardFlowRole; now: Instant; admissionId: string; expectedDischargeAt: Instant }
  | { type: "BLOCK_DISCHARGE"; role: WardFlowRole; now: Instant; admissionId: string; reason: DischargeBlockReason }
  | { type: "RECORD_LEAVING"; role: WardFlowRole; now: Instant; admissionId: string; destination: LeavingDestination }
  | { type: "CONFIRM_WARD_DAY"; role: WardFlowRole; now: Instant; unitId: string }
```

- [ ] **Step 4: Implement the handlers in `ward-flow-reducer.ts`**

State gains `admissions: Admission[]`, `waitlists: Record<string, string[]>`, `wardDayConfirmedAt: Record<string, Instant>`. `UnwindRecord["kind"]` gains `"pull_released"`.

Rules, each one load-bearing:

1. **`PULL_PATIENT`** creates an admission in state `pulled` with `pulledAt: now`, `arrivedAt: null`, and removes the referral id from **every** unit's waitlist.
2. **`PATIENT_ARRIVED`** (existing event) additionally sets the matching admission to `occupied` with `arrivedAt: now`. If no admission matches, do nothing and record a rejection — never create one silently.
3. **`RELEASE_PULL`** refuses unless the admission is `pulled` and the reason is in `PULL_RELEASE_REASONS` by membership. Sets `left`, appends an `UnwindRecord`.
4. **`SET_DISCHARGE_DATE`** increments `dischargeDateMoves` only when a date was already set and the new value differs.
5. **`BLOCK_DISCHARGE`** refuses a reason outside `BED_RELEASE_BLOCKERS` by membership.
6. **`RECORD_LEAVING`** refuses a destination outside `LEAVING_DESTINATIONS` by membership; sets `left`, `leftAt: now`.
7. **`CONFIRM_WARD_DAY`** refuses while any live admission in that unit has `expectedDischargeAt` in the past (spec D10 — the one deliberate friction). Otherwise stamps `wardDayConfirmedAt[unitId] = now`.
8. **`REORDER_WAITLIST`** clamps `toIndex` into range rather than throwing.

Every refusal appends to `rejections` with a reason a human can read, matching the existing reducer's discipline.

- [ ] **Step 5: Expose it on the provider**

In `ward-flow-provider.tsx`, add `admissions`, `waitlists` and `wardDayConfirmedAt` to `WardFlowContextValue` and to the memoised value, beside `bedReleases`. Also add `referrals` if Phase 7 Task 5 has not already — its ledger records that as owed.

- [ ] **Step 6: Run the test and watch it pass**

```bash
cd /d/Worktrees/Database/pr-2390-fix && npm run test:focused -- --files tests/ward-admission-reducer.test.ts tests/ward-flow-reducer.test.ts
```

Expected: PASS, and **the existing reducer suite must still be green** — quote both `N passed` lines.

- [ ] **Step 7: Mutation-test the two rules most likely to be "corrected" later**

```bash
cd /d/Worktrees/Database/pr-2390-fix && bash .superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/mutate.sh \
  src/components/ward-management/ward-flow-reducer.ts \
  'PULL_RELEASE_REASONS.includes' 'Boolean' tests/ward-admission-reducer.test.ts
```

Expected RED on the membership test. Then mutate the `CONFIRM_WARD_DAY` past-date guard away and expect RED on the refusal test.

- [ ] **Step 8: Commit**

```bash
cd /d/Worktrees/Database/pr-2390-fix && git add src/components/ward-management/ward-flow-events.ts src/components/ward-management/ward-flow-reducer.ts src/components/ward-management/ward-flow-provider.tsx tests/ward-admission-reducer.test.ts && git commit -m "feat(ward-flow): pull, waitlist, discharge date and the daily confirm"
```

---

### Task 3: The seed fixture

**Files:**

- Create: `src/components/ward-management/ward-admissions-seed.ts`
- Modify: `src/components/ward-management/ward-flow-reducer.ts` (load the seed in `initialWardFlowState`)
- Test: `tests/ward-admissions-seed.test.ts`

**Interfaces:**

- Produces: `wardAdmissions: Admission[]`, `wardWaitlists: Record<string, string[]>`.

The seed must make every rule testable and no rule vacuous — a fixture that makes a rule vacuous is a named defect class in this project.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ward-admissions-seed.test.ts
import { describe, expect, it } from "vitest";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { bedIsOccupied, stayBand } from "@/components/ward-management/ward-admissions";
import { allUnits } from "@/components/ward-management/ward-sites";
import { NOW_ANCHOR } from "@/components/ward-management/ward-clock";

describe("admission seed", () => {
  it("never puts more people in a unit than it has beds", () => {
    for (const unit of allUnits()) {
      const occupied = wardAdmissions.filter((a) => a.unitId === unit.id && bedIsOccupied(a)).length;
      expect(occupied, `${unit.id} is over-occupied`).toBeLessThanOrEqual(unit.beds);
    }
  });

  it("every admission names a unit that exists", () => {
    const ids = new Set(allUnits().map((unit) => unit.id));
    for (const admission of wardAdmissions) expect(ids).toContain(admission.unitId);
  });

  it("covers all four stay bands, so no band is untested", () => {
    const bands = new Set(wardAdmissions.map((a) => stayBand(a, NOW_ANCHOR)).filter(Boolean));
    expect(bands).toContain("under-1-week");
    expect(bands).toContain("1-4-weeks");
    expect(bands).toContain("1-3-months");
    expect(bands).toContain("over-3-months");
  });

  it("contains at least one pulled-but-empty bed, or the bed-lost-at-pull rule is untestable", () => {
    expect(wardAdmissions.some((a) => a.state === "pulled" && a.arrivedAt === null)).toBe(true);
  });

  it("contains at least one person past their own discharge date", () => {
    expect(
      wardAdmissions.some(
        (a) => a.expectedDischargeAt !== null && a.expectedDischargeAt < NOW_ANCHOR && a.state === "occupied",
      ),
    ).toBe(true);
  });

  it("contains at least one blocked discharge, or the headline figure is untestable", () => {
    expect(wardAdmissions.some((a) => a.blockReason !== null)).toBe(true);
  });

  it("contains at least one admission with no discharge date set", () => {
    expect(wardAdmissions.some((a) => a.expectedDischargeAt === null)).toBe(true);
  });

  it("the sex mix derived from admissions matches every unit's recorded sexMix", () => {
    for (const unit of allUnits()) {
      const here = wardAdmissions.filter((a) => a.unitId === unit.id && bedIsOccupied(a));
      expect(here.filter((a) => a.sex === "Female").length, `${unit.id} female`).toBe(unit.sexMix.Female);
      expect(here.filter((a) => a.sex === "Male").length, `${unit.id} male`).toBe(unit.sexMix.Male);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail.** Expected: FAIL — the seed does not exist.

- [ ] **Step 3: Author the seed.** Work unit by unit from `ward-sites.ts`, generating admissions until each unit's occupied count and sex split match its existing `empty`/`sexMix` figures exactly. The last test above is the one that forces this; it is also what makes `sexMix` derivable in Task 5.

- [ ] **Step 4: Run and watch it pass.** Quote the `N passed` line.

- [ ] **Step 5: Commit**

```bash
cd /d/Worktrees/Database/pr-2390-fix && git add src/components/ward-management/ward-admissions-seed.ts src/components/ward-management/ward-flow-reducer.ts tests/ward-admissions-seed.test.ts && git commit -m "feat(ward-flow): seed the wards with occupancies that make every rule testable"
```

---

## Wave B — derivations (parallel: 4, 5, 6, 7)

Four new files, no shared edits. Dispatch all four at once.

### Task 4: Discharge dates drive bed releases

**Files:** Create `src/components/ward-management/ward-discharge-dates.ts`; Test `tests/ward-discharge-dates.test.ts`

**Interfaces:**

- Consumes: `Admission`, `bedIsOccupied`, `isPastExpectedDischarge` (Task 1).
- Produces: `derivedBedReleases(admissions, now): BedRelease[]`, `statewideReleaseCount(admissions, now): number`, `dischargeDateAccuracy(admissions): { met: number; moved: number; total: number }`.

Required behaviours, each with its own test:

- A date set → a `predicted` release at that instant, carrying a `waitingOn` from `BED_RELEASE_WAITING_ON`. **There is no `confidence` field any more** — it was replaced on 2026-08-28 because two wards' "likely" do not mean the same thing, so a coordinator can neither compare nor add them.
- Confirmed as going → `confirmed`, still carrying its `waitingOn`.
- **A blocked admission keeps its stage and gains a `blocker` flag.** `blocked` is NOT a state. Assert both halves in one test: a confirmed release that gains a blocker is still counted as confirmed, AND it appears in the blocked cross-cut. This is the exact defect the three-stage rework closed — sorting by state left a blocked release counted nowhere, so a ward's figures improved at the moment it got stuck. Reintroducing it here is the single most likely way this task ships a silent regression.
- The blocked figure is a **cross-cut, never a bucket subtracted** from confirmed or predicted.
- No date set → **no release at all**, never a release at `now` and never a fallback instant.
- **A transfer to another psychiatric ward frees the sending unit's bed but adds nothing to `statewideReleaseCount`** (spec D8). Assert both halves in one test — the sending ward's count rises AND the statewide count does not.
- The output is fed to the existing `capacityBreakdown()`; this module computes **no bed arithmetic of its own**.

Mutation-test TWO rules here, not one. (a) Make `countsAsStatewideRelease` always true; expect RED on the transfer-netting test. (b) Make the blocked cross-cut a subtraction — exclude blocked releases from the confirmed count; expect RED on the blocked-but-confirmed test. (b) is the more important of the two: it is a re-run of the exact defect the three-stage rework closed, and it went red in six tests across four files when the other session mutated it.

Commit: `feat(ward-flow): derive bed releases from the ward's own discharge dates`

### Task 5: The board's figures

**Files:** Create `src/components/ward-management/ward-board-derivations.ts`; Test `tests/ward-board-derivations.test.ts`

**Interfaces:**

- Produces: `headlineAvailable(unit, admissions, now): number`, `constraintSentence(unit, admissions): string`, `sinceYesterday(admissions, now): { discharged: number; pulled: number; datesMoved: number }`, `arrowTargets(admissions, now): { region: HomeRegion; count: number; nearestDays: number }[]`, `derivedSexMix(admissions, unitId): Record<Sex, number>`.

Required behaviours:

- `headlineAvailable` = beds minus occupied-or-pulled, floored at zero, and it **must** come from `capacityBreakdown()` rather than recomputing. A unit whose figures cannot be resolved returns zero, never a guess.
- `constraintSentence` produces the page's most valuable line: _"Only 1 will take a man. Only 1 can be watched one-to-one."_ It reads `sexDesignation` as an **accepts** rule (an `Undesignated` bed accepts everyone) and `speciallingCapacity` directly. Test the trap explicitly: a unit that is entirely `Undesignated` must report that every free bed takes a man **and** a woman — an equality check would report zero.
- `arrowTargets` returns only admissions with a date within 7 days, grouped by region, ordered nearest first (spec D12).
- `derivedSexMix` replaces the hand-maintained `Unit.sexMix`.

Mutation-test `constraintSentence` by changing the accepts-rule to an equality; expect RED on the all-undesignated test.

Commit: `feat(ward-flow): the ward board's headline figure and its constraint sentence`

### Task 6: Community teams

**Files:** Create `src/components/ward-management/ward-teams.ts`; Test `tests/ward-teams.test.ts`

**Interfaces:** Produces `COMMUNITY_TEAMS: Record<HomeRegion, string>`, `teamForRegion(region): string | null`.

- One clearly synthetic team name per entry in `HOME_REGIONS`. A doc comment recording that these are invented (spec D14), that the system holds no real region-to-service map, and that swapping in owner-supplied names is under an hour — the same shape as the youth unit at Bentley.
- Test: every `HOME_REGIONS` member has a team; an unrecognised region returns `null`, never a guess.
- Test: no team name matches a real WA health service name from `ward-sites.ts`, so a synthetic name can never be mistaken for a real one.

Commit: `feat(ward-flow): synthetic community teams, one per region`

### Task 7: Ward statistics

**Files:** Create `src/components/ward-management/ward-statistics.ts`; Test `tests/ward-statistics.test.ts`

**Interfaces:** Produces `wardStatistics(unitId, admissions, now): WardStatistics` with the six spec D16 figures, and `allWardStatistics(units, admissions, now)`.

| Figure                 | From                                                       |
| ---------------------- | ---------------------------------------------------------- |
| Average length of stay | `arrivedAt` → `leftAt`                                     |
| **Empty-bed time**     | `pulledAt` → `arrivedAt` — the number nobody currently has |
| Discharge dates met    | Task 4's `dischargeDateAccuracy`                           |
| Waitlist wait          | waitlisted → pulled                                        |
| Ready to leave, cannot | admissions with `blockReason`                              |
| Long stays             | `stayBand === "over-3-months"`                             |

Every figure returns `null` — never zero — when there is nothing to average. Zero and "no data" are different claims and this is the module where they get confused. Test that explicitly.

Commit: `feat(ward-flow): the six ward-level flow figures`

---

## Wave C — components (parallel: 8, 9, 10)

Three new files plus one shared stylesheet created in Task 8 and only appended to by 9 and 10.

### Task 8: The bed grid

**Files:** Create `board/bed-grid.tsx`, `board/board.module.css`; Test `tests/ward-bed-grid.dom.test.tsx`

Renders one tile per bed. Three signals on three channels (spec D7): fill = stay band, outline = past own date, number = days. Tile states: ready, occupied, pulled-but-empty (with its own "empty 3 hours" clock), on leave, and **being made ready**.

**Two traps, both from changes that landed after this plan was written.** A bed carrying a `BED_PREPARATION_NOTES` entry ("Being cleaned", "Awaiting maintenance or repair") is **still available** — still offered, still in `availableNow`, still in every figure. The obvious implementation, a distinct state that reads as unavailable, silently removes beds from the state's supply; the note is a caption on a READY bed. And **blocked is not a tile state**: the person is still in the bed, so the tile shows occupied AND carries the blocker, never blocked instead of occupied. Write a test for each, and mutate both.

Tests: the right number of tiles for a unit; a pulled bed renders as unavailable with its clock; **every colour has its fact in text** (assert the day number is present on every occupied tile, and that removing colour loses no information); an admission with no date renders "no date set".

Accessibility: no `aria-label` on a tile — it would override the accessible name and hide every figure from a screen reader, the exact defect the pressure strip shipped. Every fact is visible text. Tap targets `min-h-12`.

Commit: `feat(ward-flow): the bed grid`

### Task 9: The left column

**Files:** Create `board/board-left-column.tsx`; Test `tests/ward-board-left-column.dom.test.tsx`

Toggles referrals ⇄ discharges, remembering the last side used. Referrals: awaiting this ward's answer, plus the ordered waitlist with positions and reorder controls. Discharges: everyone leaving soon, soonest first, anyone past their date at the top.

Tests: the toggle switches lists; the waitlist shows positions; **a referral shows every other waitlist it is on** (spec D3 — without this a waitlist loses people); an empty side reads "No one waiting for this ward", never an empty box.

Commit: `feat(ward-flow): the referrals and discharges column`

### Task 10: The patient panel

**Files:** Create `board/board-patient-panel.tsx`; Test `tests/ward-board-patient-panel.dom.test.tsx`

Discharge-focused: days in bed, expected date and how far past it, times moved, home region, community team, and the three actions — **going today · date changed · stuck**. No free text; the blocked reason is a picker driven by `BED_RELEASE_BLOCKERS`.

**Never blank.** With nothing selected it renders the next bed, when, and who is top of the waitlist.

Tests: each of the three actions dispatches; the panel with no selection renders the next-bed answer; the blocked picker offers exactly the array's members and nothing else.

Commit: `feat(ward-flow): the discharge-focused patient panel`

---

## Wave D — assembly (serial: 11, 12, 13)

### Task 11: The board page

**Files:** Create `board/ward-board.tsx`; Modify `src/app/mockups/ward-flow/ward/[unitId]/page.tsx`; Test `tests/ward-board.dom.test.tsx`

Assembles the three regions in the home page's grid, owns selection, renders the header: one headline number, the constraint sentence, the since-yesterday line, and the confirmed-today state. Statistics strip at the foot.

**Selecting a referral lights the beds** (spec D13) via Phase 7's `eligibility()` — no new matching. Test that a bed that cannot take the selected person states which gate it failed, and that the reason string is identical to the one the coordinator's shortlist shows for the same pair.

A ward sees editable controls on its own unit and read-only on every other (spec D20).

Commit: `feat(ward-flow): the ward board`

### Task 12: The daily sheet

**Files:** Create `board/daily-sheet.tsx`; Test `tests/ward-daily-sheet.dom.test.tsx`

One row per live admission, yesterday's date prefilled, keyboard-only, shorthand dates (`+7`, `fri`, `next tue`), one **nothing has changed** button.

Tests: tabbing reaches every row in order without a mouse; `+7` sets a date seven days out; **the confirm button is refused while any date sits in the past, and says which rows need touching**; confirming stamps freshness; a ward that has not confirmed shows as not confirmed on the board — never blank, never confirmed.

Commit: `feat(ward-flow): the one-minute daily update`

### Task 13: Undo

**Files:** Modify `board/ward-board.tsx`, `board/board-patient-panel.tsx`; Test `tests/ward-board-undo.dom.test.tsx`

One-click undo on pull, discharge-date change and leaving, using `UnwindRecord`. **No confirmation dialogs anywhere on this page** — assert there is no `role="alertdialog"` and no confirm control in the rendered tree.

Commit: `feat(ward-flow): undo, and no confirmation dialogs`

---

## Wave E — reach (parallel: 14, 15, 16)

### Task 14: The statistics page

**Files:** Create `statistics/statistics-page.tsx`, `statistics/statistics.module.css`, `src/app/mockups/ward-flow/statistics/page.tsx`; Modify `ward-nav.ts`; Test `tests/ward-statistics-page.dom.test.tsx`, and update `tests/ward-nav.test.ts`.

Compares every ward on the six figures. **`ward-nav.ts` enforces a two-way property**: every href resolves to a real route, and every static route appears in a nav array or in `WARD_NAV_INTENTIONALLY_UNLISTED` with a reason. Add the entry to `WARD_NAV` under `group: "board"`; do not add it to both.

Commit: `feat(ward-flow): the statewide flow statistics page`

### Task 15: Retire the old ward screen

**Files:** Modify/delete `ward/ward-screen.tsx`, `ward/ward.module.css`; Test: update `tests/ward-screen.dom.test.tsx`

**Before deleting anything, enumerate every control on the existing screen and name where it went.** Write that table into the commit message. Then run the repository's dead-code gate, which fails closed on a symbol pinned by a test, named in a plan with unchecked tasks, or referenced as a string literal:

```bash
cd /d/Worktrees/Database/pr-2390-fix && npm run check:dead-code-candidate -- --diff origin/main
```

Do not tune its thresholds or refusal list to make this diff pass.

Commit: `refactor(ward-flow): the board replaces the ward screen`

### Task 16: Print and phone

**Files:** Modify `board/board.module.css`, `board/ward-board.tsx`; Test `tests/ward-board-print.dom.test.tsx`

Print: one A4 sheet, designed as the handover sheet — who came in, who is going, who is stuck, who is overdue. Phone (≤48rem): the grid becomes one list ordered by longest stay first; the heavy grid must **not mount** below the breakpoint, the fix `coordinator-screen.tsx` already carries.

Verify page count with the capture tool, not by eye:

```bash
cd /d/Worktrees/Database/pr-2390-fix && node .superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/capture.mjs /mockups/ward-flow/ward/bty-adult-secure
```

Commit: `feat(ward-flow): the board prints as the ward handover sheet`

---

## Wave F — proof (serial: 17, 18)

### Task 17: The browser journey

**Files:** Create `tests/ui-ward-board.spec.ts`

One journey, end to end: referral arrives → ward waitlists it → ward pulls → **the bed shows pulled-and-empty and the ward's available count has dropped** → arrival → date set → date moves → discharge → bed returns.

Beware the Playwright spec-name regex that once made a browser spec silently never run: after writing it, confirm the run reports this spec by name and a non-zero test count.

Commit: `test(ward-flow): the ward board journey`

### Task 18: The reliability gate

Run once, at the end of the phase, by the controller — never per task.

- [ ] `npm run format` **and commit the result** — formatting is in neither `test`, `typecheck` nor `lint`, and the changed-file check will fail on the pushed blob otherwise.
- [ ] `npm run verify:cheap` — quote the decisive line, not the exit code.
- [ ] `npm run build` — a wrong Server/Client boundary and a missing nav icon entry are invisible to every test and visible only here.
- [ ] `npm run ensure`, then capture `/mockups/ward-flow/ward/bty-adult-secure`, `/mockups/ward-flow/statistics` and the daily sheet at 390/820/1440 plus print. **Look at every screenshot.** Every defect that actually reached the screen in this project was found this way, never by a test.
- [ ] Write the phase summary: what was proven by a test watched to fail, what was proven by looking at the screen, and what is neither.

A refusal citing capacity, or exit 75, is BLOCKED — retry. It is never a pass and never a failure.

---

## Self-review against the spec

| Spec                                                         | Task                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| D1 admission record                                          | 1                                                     |
| D2 four states, bed lost at pull, failed pull                | 1, 2                                                  |
| D3 ordered waitlist, cross-waitlist withdrawal               | 2, 9                                                  |
| D4 one date drives releases, moves counted                   | 1, 2, 4                                               |
| D5 permitted fields, no diagnosis, structural test           | 1                                                     |
| D6 anonymous tiles                                           | 8                                                     |
| D7 three signals, owner's bands, colour never alone          | 1, 8                                                  |
| D8 leaving destination, statewide netting                    | 1, 4                                                  |
| D9 blocked figure, owner-pending list                        | 1, 10, 11                                             |
| D10 daily confirm, staleness, past-date refusal              | 2, 12                                                 |
| D11 layout, headline, constraint sentence, never-blank panel | 5, 10, 11                                             |
| D12 arrows near discharge only                               | 5, 11                                                 |
| D13 select a referral, beds answer                           | 11                                                    |
| D14 synthetic teams                                          | 6                                                     |
| D15 receiving window                                         | **Not built — owner-pending.** Event shape ready in 2 |
| D16 statistics strip and page                                | 7, 11, 14                                             |
| D17 undo, no dialogs                                         | 13                                                    |
| D18 phone list                                               | 16                                                    |
| D19 print as handover sheet                                  | 16                                                    |
| D20 board replaces ward screen, both roles                   | 11, 15                                                |

**Gap accepted deliberately:** D15 is unbuilt pending the owner's options. Recorded here rather than guessed.
