# Mixed locked/open wards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the whole-ward `Unit.security` flag with locked/open bed counts, so a ward that has both kinds of bed stops hiding its locked beds from every patient who needs one.

**Architecture:** `Unit` gains two stored numbers — `lockedBeds` (how many of the ward's beds are designated locked) and `allocatableLocked` (how many of the currently allocatable beds are locked). Their open counterparts are always **derived**, never stored, so there is exactly one source for each fact. `Unit.security` is removed. A new module `ward-bed-designation.ts` owns every question anyone asks about designations, so no screen re-derives them. The eligibility gate changes from "is this ward of the right type" to "does this ward have a free bed of the right type".

**Tech Stack:** TypeScript 6 (strict), React 19 / Next.js 16 App Router, Vitest, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-09-04-ward-flow-direction-and-delays-design.md` — §6 is the section this plan implements.

## ⚠️ How to run a test in this repository — read before any verification step

**`npm run test:focused -- --files tests/<anything>` CANNOT RUN. It is not flaky and it is not a lease
problem — it is structural.** `scripts/test-focused.mjs:9` classifies any path matching
`^(?:tests/|scripts/|\.github/|package(-lock)?\.json$|tsconfig|vitest\.config|next\.config|eslint)`
as an unsafe selection and fails closed at line 54, **before any lock is requested**. So every path under
`tests/` is refused, always.

🔴 **AND IT EXITS 2, WHICH IS THE DANGEROUS PART.** A caller checking only for a non-zero exit sees a
failure; a caller checking for the word "failed", or reading a summary line, sees neither passes nor
failures and may record "no failures found". **An exit-2 fail-closed is not a green run and must never be
reported as one.** This plan originally specified that exact command in five tasks; the discovery came
from Task 1's implementer, who read the script rather than retrying.

**Use instead**, which is what this repo's own `package.json` uses elsewhere and is lease-aware:

```bash
node scripts/run-vitest.mjs run --reporter=dot tests/<file>.test.ts
```

**Distinguishing a lease refusal from a failure:** a lease refusal exits 1 with "capacity is full" and
names the worktree holding it. **Judge it by the message, never by the exit code** — a refusal and a real
failure both exit 1. Retry a few times; if it stays held, **report the gate as UNRUN and stop.** A
blocked gate reported honestly is worth more than a long wait, and an unverified commit is recoverable.

## Global Constraints

Copied verbatim from the spec, except where marked. Every task's requirements implicitly include this section.

- **"Replace `Unit.security` with locked and open bed counts."** `(OWNER, 2026-09-04)` **"Not a flag _plus_ counts — two sources for one fact will disagree, which is this project's most reliable defect. A wholly-open ward simply has zero in one column."**
- **"The eligibility gate changes from 'is this ward of the right type' to 'does this ward have a free bed of the right type'."** `(OWNER, 2026-09-04)`
- **"A ward may change its own designations, as part of editing its bed numbers. No new screen, no new concept."** `(OWNER, 2026-09-04)`
- **"Splits are synthetic and clearly marked, replaceable in one place. Real bed designations must not be mixed into an invented fixture."** `(OWNER, 2026-09-04)`
- **"Keep two facts apart that the owner's phrasing merged. A _locked bed_ is a property of the ward; an _involuntary patient_ is a property of the person (`LegalStatus`). A voluntary patient can be nursed on a locked ward. Count beds by designation; check legal status against it as eligibility. Do not create a bed field called 'involuntary'."** (spec §6, author's note — not owner-tagged)
- **"Never, per the owner: show a bed that is not really there; lose a person; state something the record does not support; make a clinical decision on its own."** `(OWNER, 2026-09-04)`
- **"All synthetic data must be easy to go back and change later — one place per value, marked as invented, replaceable without touching logic."** `(OWNER, 2026-09-04)`
- **Design tokens, not hex.** Any CSS added here uses the Ward Flow token layer (`ward-tokens.module.css`); a raw hex fails `eslint-rules/no-hardcoded-hex.mjs`.

### Two decisions this plan makes that the spec does not settle

Both are marked in the code as the plan author's reasoning, not the owner's, per the spec's own tagging rule. Either is a one-line change if the owner rules otherwise.

1. **A patient needing an Open bed passes a ward with any free bed, locked or open.** Today's gate lets an Open patient pass every ward; making it stricter would newly _hide_ beds from a person who could use them, and the standing rule is never to lose a person. Where the only free bed is a locked one, the gate passes and the detail sentence says so, leaving the judgement with the coordinator. **A patient needing a Secure bed passes only where a locked bed is actually free** — that is the defect being fixed and it is not optional.
2. **`allocatableLocked` counts locked beds among the _allocatable_ figure, not the _empty_ figure.** `allocatable` is what the ward says it can actually fill; `empty` is what the feed thinks is physically vacant. The gate has always asked about allocatable beds, so the split belongs there.

### ⚠️ Two constraints on the new gate, from the people who own the surrounding code

Both arrived after this plan was first written. Neither is optional.

**1. One clause must survive the rewrite of `ward-eligibility.ts`, in whatever words fit the new gate:**

> **The guard that makes a lenient capacity gate safe is `PATIENT_ARRIVED`, not either gate here.**

Ward Builder One landed two comments at the `allocatable_bed` sites saying this, and has authorised
rewriting or moving them freely — **except that clause, which is the only reason the comments exist.**
It must not be left to live in commit `4653394f8` alone: a commit is found by somebody who already
suspects there is something to find, and **the person this comment has to reach is the one who thinks
the two gates are the same test and is about to make them so.** They will be reading the file, not the
log.

The context around it — the tidy-up hazard, the accept-in-principle explanation — may be cut or
reworded freely.

**DECIDED, so the implementer does not have to: the bed-kind rule is IDENTICAL on both paths, and the
`allocatable_bed` gates are not touched at all.**

**Reasoning (plan author, not an owner ruling).** Bed _kind_ is a **suitability** question — is this the
right sort of bed for this person — and suitability does not change between "can this ward take them in
principle" and "can this person come now". **Capacity** is the question that legitimately differs between
those two, and capacity is `allocatable_bed`'s job, not the security gate's. So the security gate asks
one question on both paths, keeps one name, and **nothing in this plan edits either `allocatable_bed`
gate or the leniency that `PATIENT_ARRIVED` makes safe.**

That is what keeps constraint 2 below satisfied without inventing a second gate name.

**2. If the two paths need different bed-kind rules, the gate NAMES must differ, loudly.**

`eligibility()` and `referralEligibility()` today both emit a gate called `allocatable_bed` with
**different pass conditions** — raw `allocatable.value > 0` on the movement path,
`min(allocatable, empty) > 0` on the referral path. That divergence is deliberate: a pull is a
reservation, an arrival is the physical act, and the safety comes from `PATIENT_ARRIVED` refusing when
`empty.value <= 0`, three events downstream in a different case block. **A tidy-up hoisting the empty
check earlier "for symmetry" would look like a strengthening and would break accept-in-principle.**

⚠️ **The two paths ask genuinely different questions** — "can this ward take them in principle" versus
"can this person come now" — so a single locked-bed rule serving both is more likely wrong than right.
**One name over two different tests is the defect that started this whole line of work, and nobody
noticed for weeks.** If the security gate ends up with two answers, give the two gates two names.

### ⚠️ The owner's three words, and the one place they must NOT be merged

**His words for the three kinds of ward:** _"some wards are locked, some are voluntary and some are
mixed"_ `(OWNER, 2026-09-04)`. The code says `Open | Secure` and every screen renders "Open".

**Decision (plan author's, and it splits the two levels deliberately):**

| Level        | Words                          | Why                                                                    |
| ------------ | ------------------------------ | ---------------------------------------------------------------------- |
| **The ward** | **locked · voluntary · mixed** | The owner's own three words. This is what a screen calls a whole ward. |
| **The beds** | **locked · open**              | A door is locked or open. A _patient_ is voluntary or involuntary.     |

⚠️ **Do not push "voluntary" down to the bed level, and do not push "open" up to the ward level.** A
voluntary patient can be nursed in a locked bed — the spec says so explicitly, and it is the reason
`lockedBeds` must never be named anything containing "involuntary". **The ward label describes who the
ward is for; the bed count describes what the bed physically is.** Collapsing them is the single most
likely way this change ends up giving a wrong clinical answer of its own.

**So `designationSummary` returns:** `"All locked"` · `"Voluntary"` · `"4 locked, 13 open"`. Nothing else
in this plan changes: `Security` (`Open | Secure`) stays exactly as it is, because `Movement.security` is
the patient's requirement and is out of scope.

**This is a wording change, not a migration** — the strings are being written for the first time in
Tasks 1 and 6, so it costs nothing now and gets more expensive every day the new fields spread.

### 🔴 A sentence I was about to write that would have been FALSE — corrected before building

**Approved recommendation 8 says: show the facts and state on screen that no automatic rule applies to
sex and gender identity.** I told Ward Lead I would build that sentence. **I must not write it as worded.**

⚠️ **A sex rule genuinely runs.** Bed allocation gates on the closed `Sex` enum via `sexDesignationAccepts`
in the eligibility path. **"No automatic rule applies here" would therefore be a false statement on a
clinical screen** — the precise defect this project has spent the day removing, and I would have added a
new one while implementing the recommendation meant to prevent them.

⚠️ **And the ambiguity is unresolved: "encode no rule" may have meant no rule connecting GENDER IDENTITY
to a bed, or no automatic SEX rule at all.** Those imply different software. The owner has not been asked
which. **Do not resolve it by choosing the reading that is easier to build.**

**What may be written now, because it is true under BOTH readings:** that bed matching uses recorded sex
only; that gender identity is recorded and is **not** consulted in matching; and that the judgement is the
clinician's. That is verifiable against the code — allocation reads `Movement.sex` and never reads the
free-text field — and it survives whichever way the owner rules.

⚠️ **Do NOT touch the free-text field itself.** Its own comment justifies free text on the grounds that
"bed allocation depends on this", **and allocation never reads it** — so the field's stated reason for
existing is untrue. That is a privacy-and-clinical question about a sensitive attribute and it belongs to
the owner, not to this plan. **Say in the code comment that the field is not consulted, so the next reader
does not have to re-derive it.**

### 🔴 EVERY NEW GUARD IN THIS PLAN MUST BE BROKEN ONCE BEFORE IT IS TRUSTED

**Four guards that could not fail were found in this codebase by three sessions in one night, and none of
them was found by reading.** A guard that cannot fail reads as a safeguard, so the next person stops
looking — which is worse than having no guard at all.

**So for each new test file here: break the thing it guards, watch it go red, restore, and confirm the
restore is byte-identical.** Task 2 has already done this (forcing the gate to `true` turned three
assertions red). The remaining guards have not:

- **The fixture test** — set one unit's `allocatableLocked` above its `allocatable`, confirm red; set
  `lockedBeds` above `beds`, confirm red; reduce the mixed-ward count below the floor, confirm red.
- **The divergence test below** — flip that ward's `authorised` to `true`, confirm red.

#### ⚠️ HOW TO RUN A MUTATION IN A WORKTREE OTHER SESSIONS INSPECT

**Three parts, and each covers a case the one before it does not.**

**1. Restore in a `finally`** — necessary, not sufficient. It covers the interpreter raising and nothing
else: not a killed process, not a stalled machine, not a cleanup elsewhere taking the folder away
mid-run, which has happened on this machine twice.

**2. Verify the restore by CONTENT** — hash it and compare against the pre-mutation hash. Not "the
`finally` ran". Not "the tests passed".

**3. Commit an untracked file before mutating it.** Every discussion of mutation assumes git is the
backstop. **For a new file it is not.** A checkout-based restore has no effect at all on an untracked
file — it leaves the mutation in place and returns an error most drivers never read. **And a brand-new
file is exactly what you mutate when you have just written a guard**, so the exposure concentrates on
precisely the case this habit exists for.

It happened tonight, not hypothetically: a harness crashed after writing a mutant into a file that was
minutes old and untracked. There was nothing to restore from, and recovery meant reversing the edit by
hand — which requires knowing the edit is there at all. It was caught by a reflex status check.

⚠️ **This rule is in this repository's own always-loaded instructions, and this plan was written
requiring mutations without it.** A rule being recorded is not the same as it reaching the place where it
would be applied.

**So `tests/ward-bed-designation-fixture.test.ts` and the divergence test must be COMMITTED before either
is broken to prove it can fail.**

🔴 **A mutation harness that dies mid-run leaves a deliberate falsehood in a shared working tree** —
and this repository's pre-commit hook inspects the whole tree, so another session's commit can be
blocked, or worse, carry it. Observed tonight: a mutation driver crashed after writing the mutant
because Windows decoded the test runner's UTF-8 output as cp1252 and the captured stream came back
empty. **The restore ran only because it happened to sit in a `finally`.** ⚠️ **A crash is exactly the
case where a person assumes the run never got that far.**

**A mutation split across several shell calls has the same window with none of the protection.** Verify
the restore explicitly — compare the file's hash to its pre-mutation hash — and never infer it from the
absence of an error message.

**And watch WHICH assertion goes red, not merely that one did.** Two reds from one cause hide which half
moved; the identity of the catcher is the result. In the age-guard case it was decisive: one test red on
_"expected 999 to be 36"_ proved the mutant executed, while the test that was supposed to be guarding
stayed green on _"999 years"_ — **same mutation, and only the pair of outcomes revealed anything.**

⚠️ **Note the two failure shapes are mirrors, and both apply here.** A guard that cannot fail hides a
defect. A mutation that erases its own evidence invents one — or leaves one behind. **The second matters
most for anything touching `openedAt`, which has 15 readers; a half-applied mutation there would be very
hard to see by eye.**

### 🔴 REQUIRED TEST: a locked ward that cannot lawfully detain

**`sjgs-adult-secure` is locked and carries `authorised: false`.** It is one of two unauthorised units in
a network of 23, and **it is currently the only artefact in the repository demonstrating that "has locked
beds" and "may lawfully hold an involuntary patient" are different facts.**

⚠️ **Why this is a test and not a comment.** The owner ruled three ward categories — Open, Locked, Mixed
— and the natural next simplification is to treat "locked" as meaning "takes involuntary patients". The
eligibility gate reads `!authorisationNeeded || unit.authorised`. **Merge them and that unit starts
passing the authorisation gate: the app would offer a bed for a detention it cannot lawfully hold.** If
somebody later tidies the fixture, the distinction vanishes and **nothing goes red.**

**The test:** an involuntary movement, otherwise eligible, evaluated against a unit that has locked beds
free and `authorised: false`, **must fail the `authorisation` gate** — and must fail it for that reason,
not because some other gate happened to block it first. ⚠️ **Assert the other gates pass**, or this is
another two-guards-in-series and proves nothing.

⚠️ **Floor it on the population:** if the fixture contains no unauthorised unit with locked beds, the test
must **fail loudly** rather than pass while walking an empty set. Otherwise the same tidy-up it exists to
survive silently makes it vacuous.

### What this plan deliberately does not touch

- `Unit.held` — measured as authored and read by nothing. It is not in scope and must not be deleted here; removal needs its own change with its own proof.
- `Unit.forensic` — independent of security by the model's own note, and unchanged.
- The clock/`openedAt` work — that belongs to the Delays plan, not this one.

---

### Task 1: The designation model and its helper module

**Files:**

- Modify: `src/components/ward-management/ward-model.ts` (the `Unit` type, around line 254-296)
- Create: `src/components/ward-management/ward-bed-designation.ts`
- Test: `tests/ward-bed-designation.test.ts`

**Interfaces:**

- Consumes: `Unit`, `CapacityFigure` from `ward-model.ts`.
- Produces:
  - `Unit.lockedBeds: number` and `Unit.allocatableLocked: number` (both required).
  - `Unit.security` **removed**.
  - `openBeds(unit: Unit): number`
  - `lockedBedsFree(unit: Unit): number`
  - `openBedsFree(unit: Unit): number`
  - `unitHasLockedBeds(unit: Unit): boolean`
  - `unitHasOpenBeds(unit: Unit): boolean`
  - `designationSummary(unit: Unit): string` — e.g. `"4 locked, 13 open"`, or `"All open"` / `"All locked"`.

- [ ] **Step 1: Write the failing test**

Create `tests/ward-bed-designation.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { Unit } from "@/components/ward-management/ward-model";
import {
  designationSummary,
  lockedBedsFree,
  openBeds,
  openBedsFree,
  unitHasLockedBeds,
  unitHasOpenBeds,
} from "@/components/ward-management/ward-bed-designation";

/** A mixed ward: 17 beds, 4 of them locked; 2 allocatable, 1 of those locked. */
function mixedUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "test-mixed",
    siteCode: "TST",
    name: "Test Mixed",
    cohort: "Adult",
    authorised: true,
    beds: 17,
    lockedBeds: 4,
    empty: { value: 3, source: "feed", confirmedAt: 0, staleAfterMinutes: 15 },
    allocatable: { value: 2, source: "ward", confirmedAt: 0, staleAfterMinutes: 60 },
    allocatableLocked: 1,
    held: 1,
    blocked: 1,
    sexMix: { Female: 7, Male: 6 },
    speciallingCapacity: 2,
    sexDesignation: "Undesignated",
    forensic: false,
    ...overrides,
  } as Unit;
}

describe("bed designation arithmetic", () => {
  it("derives open beds rather than storing them", () => {
    expect(openBeds(mixedUnit())).toBe(13);
  });

  it("splits the allocatable figure into locked and open", () => {
    const unit = mixedUnit();
    expect(lockedBedsFree(unit)).toBe(1);
    expect(openBedsFree(unit)).toBe(1);
    expect(lockedBedsFree(unit) + openBedsFree(unit)).toBe(unit.allocatable.value);
  });

  it("reports a wholly open ward as having no locked beds", () => {
    const unit = mixedUnit({ lockedBeds: 0, allocatableLocked: 0 });
    expect(unitHasLockedBeds(unit)).toBe(false);
    expect(unitHasOpenBeds(unit)).toBe(true);
    expect(designationSummary(unit)).toBe("All open");
  });

  it("reports a wholly locked ward as having no open beds", () => {
    const unit = mixedUnit({
      beds: 17,
      lockedBeds: 17,
      allocatable: { value: 2, source: "ward", confirmedAt: 0, staleAfterMinutes: 60 },
      allocatableLocked: 2,
    });
    expect(unitHasOpenBeds(unit)).toBe(false);
    expect(designationSummary(unit)).toBe("All locked");
  });

  it("names both figures on a mixed ward", () => {
    expect(designationSummary(mixedUnit())).toBe("4 locked, 13 open");
  });

  // ⚠️ The floor that stops these helpers reporting a plausible lie. A fixture whose
  // allocatableLocked exceeds its allocatable total is a data defect, and the helper must not
  // paper over it by returning a negative open count.
  it("never returns a negative free-bed count when the data disagrees with itself", () => {
    const broken = mixedUnit({ allocatableLocked: 5 }); // more locked free than free at all
    expect(openBedsFree(broken)).toBe(0);
    expect(lockedBedsFree(broken)).toBe(2); // clamped to the allocatable total
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/run-vitest.mjs run --reporter=dot tests/ward-bed-designation.test.ts`
Expected: FAIL — module `ward-bed-designation` not found.

- [ ] **Step 3: Change the `Unit` type**

In `src/components/ward-management/ward-model.ts`, **delete** the `security: Security;` field and its doc comment from `Unit` (around line 259-262), and add in its place:

```ts
/**
 * HOW MANY OF THIS WARD'S BEDS ARE DESIGNATED LOCKED. Replaced `security: Security` on
 * 2026-09-04 by owner ruling: "Ward 7 in Bentley is a locked/Open ward so some wards are a
 * combination with a number of designated locked beds and open beds." `(OWNER, 2026-09-04)`
 *
 * ⚠️ A whole-ward flag could not express that, and the failure was not cosmetic: the old
 * eligibility gate read `movement.security === "Open" || unit.security === "Secure"`, so a
 * mixed ward recorded as `Open` hid every one of its locked beds from every patient who
 * needed one.
 *
 * ⚠️ **OPEN BEDS ARE DERIVED, NEVER STORED** — `openBeds(unit)` in `ward-bed-designation.ts`
 * returns `beds - lockedBeds`. Storing both is two sources for one fact, which the owner
 * ruled against by name in the same decision. A wholly-open ward carries `0` here.
 *
 * ⚠️ **THIS IS A PROPERTY OF THE WARD, NOT OF A PATIENT.** An involuntary patient is a
 * property of the person (`LegalStatus`); a voluntary patient may be nursed on a locked
 * ward. Never rename this to anything containing "involuntary".
 */
lockedBeds: number;
beds: number;
/** Physically empty beds, per the feed. */
empty: CapacityFigure;
/** Beds the ward says it can actually allocate. Never greater than `empty` in practice. */
allocatable: CapacityFigure;
/**
 * HOW MANY OF THE `allocatable` BEDS ARE LOCKED ONES. The open half is derived
 * (`openBedsFree` in `ward-bed-designation.ts`), for the same one-source reason as
 * `lockedBeds` above.
 *
 * ⚠️ Splits the ALLOCATABLE figure, not the `empty` one. `allocatable` is what the ward says
 * it can actually fill; `empty` is what the feed believes is physically vacant. Every
 * eligibility gate has always asked about allocatable beds, so the split belongs there.
 * (Plan author's reasoning, 2026-09-04 — not an owner ruling.)
 */
allocatableLocked: number;
```

Delete the now-duplicated `beds`, `empty` and `allocatable` declarations that followed the old `authorised` field, so each appears exactly once.

**Do not** remove the `Security` type itself — `Movement.security` (line 639) still uses it for the patient's requirement, and that is a different fact.

- [ ] **Step 4: Write the helper module**

Create `src/components/ward-management/ward-bed-designation.ts`:

```ts
// src/components/ward-management/ward-bed-designation.ts
//
// Every question anyone asks about a ward's locked/open bed split, in one place.
//
// ⚠️ IT EXISTS SO THE ARITHMETIC IS WRITTEN ONCE. The old `Unit.security` flag was read in eight
// files; a two-number split invites each of them to do its own subtraction, and a subtraction
// repeated eight times is eight chances to get it the wrong way round. Every screen calls these.
//
// ⚠️ EVERY FUNCTION CLAMPS AT ZERO. A fixture can disagree with itself — more locked free beds
// than free beds — and the honest response to that is "none of the other kind", never a negative
// count rendered to a coordinator as though it meant something.
import type { Unit } from "@/components/ward-management/ward-model";

/** Beds designated open. Derived — never stored, per the owner's one-source ruling. */
export function openBeds(unit: Unit): number {
  return Math.max(0, unit.beds - unit.lockedBeds);
}

/** Allocatable locked beds, clamped to the allocatable total it is a part of. */
export function lockedBedsFree(unit: Unit): number {
  return Math.max(0, Math.min(unit.allocatableLocked, unit.allocatable.value));
}

/** Allocatable open beds. Derived from the total and the locked part. */
export function openBedsFree(unit: Unit): number {
  return Math.max(0, unit.allocatable.value - lockedBedsFree(unit));
}

export function unitHasLockedBeds(unit: Unit): boolean {
  return unit.lockedBeds > 0;
}

export function unitHasOpenBeds(unit: Unit): boolean {
  return openBeds(unit) > 0;
}

/**
 * The ward's designation split as a sentence, for any screen that needs to say it.
 *
 * Deliberately says "All open" / "All locked" rather than "0 locked, 17 open": a zero rendered
 * beside a real number reads as a measurement, and a ward with no locked beds has a kind of bed
 * it does not have, not zero of them.
 */
export function designationSummary(unit: Unit): string {
  if (!unitHasLockedBeds(unit)) return "All open";
  if (!unitHasOpenBeds(unit)) return "All locked";
  return `${unit.lockedBeds} locked, ${openBeds(unit)} open`;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node scripts/run-vitest.mjs run --reporter=dot tests/ward-bed-designation.test.ts`
Expected: PASS, 6 tests.

The rest of the repository will not typecheck yet — `Unit.security` is gone and eight files still read it. That is expected and Task 2 fixes it. Do **not** run `npm run typecheck` at this step and do not try to fix those files here.

- [ ] **Step 6: Commit**

```bash
git add src/components/ward-management/ward-model.ts src/components/ward-management/ward-bed-designation.ts tests/ward-bed-designation.test.ts
git commit -m "feat(ward-flow): locked/open bed counts replace the whole-ward security flag

Unit.security could not express a mixed ward, so a locked/open ward recorded
as Open hid every locked bed from every patient who needed one. Open counts
are derived, never stored — one source per fact, per the owner's ruling.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The eligibility gate asks about a free bed, not a ward type

**Files:**

- Modify: `src/components/ward-management/ward-eligibility.ts` (the `security` gate, around line 122-129)
- Test: `tests/ward-eligibility.test.ts`

**Interfaces:**

- Consumes: `lockedBedsFree`, `unitHasLockedBeds`, `designationSummary` from Task 1.
- Produces: no new exports. The `security` gate keeps its name and its `GateResult` shape, so every caller is unchanged.

- [ ] **Step 1: Write the failing test**

Add to `tests/ward-eligibility.test.ts`. Read the file's existing helpers first and reuse whatever it already has for building a `Unit` and a `Movement`; the block below names the properties it needs so it can be adapted to those helpers rather than duplicating them.

```ts
describe("security gate — a mixed ward's locked beds are reachable", () => {
  // ⚠️ THE DEFECT THIS FIXES. Before 2026-09-04 the gate read
  //   `movement.security === "Open" || unit.security === "Secure"`
  // so a ward with locked beds but recorded as Open failed every Secure patient.
  it("passes a Secure movement at a mixed ward with a free locked bed", () => {
    const unit = unitFixture({ beds: 17, lockedBeds: 4, allocatable: capacity(2), allocatableLocked: 1 });
    const movement = movementFixture({ security: "Secure" });
    const gate = gateNamed(evaluate(movement, unit), "security");
    expect(gate.pass).toBe(true);
    expect(gate.detail).toContain("1 locked bed");
  });

  it("fails a Secure movement at a mixed ward whose locked beds are all full", () => {
    const unit = unitFixture({ beds: 17, lockedBeds: 4, allocatable: capacity(2), allocatableLocked: 0 });
    const movement = movementFixture({ security: "Secure" });
    const gate = gateNamed(evaluate(movement, unit), "security");
    expect(gate.pass).toBe(false);
    expect(gate.detail).toContain("no locked bed is free");
  });

  it("fails a Secure movement at a wholly open ward", () => {
    const unit = unitFixture({ beds: 17, lockedBeds: 0, allocatable: capacity(3), allocatableLocked: 0 });
    const movement = movementFixture({ security: "Secure" });
    expect(gateNamed(evaluate(movement, unit), "security").pass).toBe(false);
  });

  // Plan-author decision, not an owner ruling: an Open movement is not newly restricted.
  it("passes an Open movement wherever any bed is free, and says when only a locked one is", () => {
    const unit = unitFixture({ beds: 17, lockedBeds: 17, allocatable: capacity(2), allocatableLocked: 2 });
    const movement = movementFixture({ security: "Open" });
    const gate = gateNamed(evaluate(movement, unit), "security");
    expect(gate.pass).toBe(true);
    expect(gate.detail).toContain("only locked");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/run-vitest.mjs run --reporter=dot tests/ward-eligibility.test.ts`
Expected: FAIL — the fixtures pass `lockedBeds`/`allocatableLocked` which the old gate ignores, and the detail strings do not match.

- [ ] **Step 3: Replace the gate**

In `src/components/ward-management/ward-eligibility.ts`, replace the whole `security` gate object with:

```ts
    {
      gate: "security",
      /*
       * ⚠️ WAS `movement.security === "Open" || unit.security === "Secure"` UNTIL 2026-09-04.
       * That asked "is this ward of the right type"; a mixed locked/open ward has no single type,
       * so its locked beds were invisible to every patient who needed one. The question is now
       * "does this ward have a free bed of the right type" `(OWNER, 2026-09-04)`.
       *
       * An Open movement is deliberately NOT newly restricted — it passes wherever any bed is
       * free, and the detail says so when the only free bed is a locked one. Narrowing it would
       * hide beds from someone who could use them, against the standing rule never to lose a
       * person. (Plan author's reasoning, 2026-09-04 — not an owner ruling.)
       */
      pass: movement.security === "Open" ? unit.allocatable.value > 0 : lockedBedsFree(unit) > 0,
      detail: securityGateDetail(movement, unit),
    },
```

And add, near the file's other detail helpers:

```ts
/**
 * The sentence beside the security gate's verdict. Always names the real figures, because a
 * coordinator reading "does not meet the requirement" needs to know whether the ward has no
 * locked beds at all or simply none free right now — they are different problems with different
 * next actions (look elsewhere, versus wait or ask).
 */
function securityGateDetail(movement: Movement, unit: Unit): string {
  const free = lockedBedsFree(unit);
  if (movement.security === "Secure") {
    if (free > 0) {
      return `${unit.name} has ${free} locked bed${free === 1 ? "" : "s"} free (${designationSummary(unit)})`;
    }
    return unitHasLockedBeds(unit)
      ? `${unit.name} has locked beds but no locked bed is free (${designationSummary(unit)})`
      : `${unit.name} has no locked beds (${designationSummary(unit)})`;
  }
  if (unit.allocatable.value <= 0) return `${unit.name} has no free bed`;
  return openBedsFree(unit) > 0
    ? `${unit.name} has ${openBedsFree(unit)} open bed${openBedsFree(unit) === 1 ? "" : "s"} free`
    : `${unit.name}'s only free beds are locked ones — open admission is possible but not usual`;
}
```

Add the import: `import { designationSummary, lockedBedsFree, openBedsFree, unitHasLockedBeds } from "@/components/ward-management/ward-bed-designation";`

- [ ] **Step 4: Run the test to verify it passes**

Run: `node scripts/run-vitest.mjs run --reporter=dot tests/ward-eligibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Prove the gate actually discriminates**

This is the step that catches a gate which passes everything. Temporarily change the `pass` line to `pass: true`, re-run the test above, and confirm the three failing-case tests go **red**. Then restore the real line and confirm green again.

Record in the commit message that this mutation was run and which assertions caught it. **If any failing-case test stays green with `pass: true`, the test is not testing the gate — fix the test before continuing.**

- [ ] **Step 6: Commit**

```bash
git add src/components/ward-management/ward-eligibility.ts tests/ward-eligibility.test.ts
git commit -m "fix(ward-flow): eligibility asks for a free bed of the right kind, not a ward type

A mixed locked/open ward has no single type, so the old gate hid its locked
beds from every Secure patient. Mutation-proved: forcing pass:true turns the
three failing-case assertions red.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The fixture gains designations, clearly marked as invented

**Files:**

- Modify: `src/components/ward-management/ward-sites.ts` (23 units)
- Test: `tests/ward-bed-designation-fixture.test.ts` (create)

**Interfaces:**

- Consumes: the `Unit` shape from Task 1.
- Produces: `WARD_LOCKED_BED_SPLITS` — one exported constant mapping unit id to its invented locked-bed count, so every invented split lives in one place and can be replaced without touching a unit literal.

- [ ] **Step 1: Write the failing test**

Create `tests/ward-bed-designation-fixture.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { WARD_LOCKED_BED_SPLITS, sites } from "@/components/ward-management/ward-sites";
import { openBeds } from "@/components/ward-management/ward-bed-designation";

const units = sites.flatMap((site) => site.units);

describe("invented bed designations", () => {
  it("covers every unit, so no ward silently defaults to zero locked beds", () => {
    const missing = units.filter((unit) => !(unit.id in WARD_LOCKED_BED_SPLITS)).map((unit) => unit.id);
    expect(missing, `units with no recorded split: ${missing.join(", ")}`).toEqual([]);
  });

  it("never designates more locked beds than the ward has", () => {
    const over = units.filter((unit) => unit.lockedBeds > unit.beds).map((unit) => unit.id);
    expect(over, `units whose locked beds exceed their total: ${over.join(", ")}`).toEqual([]);
  });

  it("never frees more locked beds than it has allocatable", () => {
    const over = units.filter((unit) => unit.allocatableLocked > unit.allocatable.value).map((unit) => unit.id);
    expect(over).toEqual([]);
  });

  // ⚠️ Anti-vacuity: floor the population, never the violation count. If the network ever has no
  // mixed ward at all, this suite is examining nothing and must say so rather than pass.
  it("includes at least one genuinely mixed ward, or the whole change is untested by the fixture", () => {
    const mixed = units.filter((unit) => unit.lockedBeds > 0 && openBeds(unit) > 0).map((unit) => unit.id);
    expect(mixed.length, `mixed wards found: ${mixed.join(", ") || "none"}`).toBeGreaterThan(0);
  });

  it("keeps Bentley adult as a mixed ward — the owner's own worked example", () => {
    const bentley = units.find((unit) => unit.id === "bty-adult-secure");
    expect(bentley).toBeDefined();
    expect(bentley!.lockedBeds).toBeGreaterThan(0);
    expect(openBeds(bentley!)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/run-vitest.mjs run --reporter=dot tests/ward-bed-designation-fixture.test.ts`
Expected: FAIL — `WARD_LOCKED_BED_SPLITS` is not exported.

- [ ] **Step 3: Add the splits constant and apply it**

At the top of `src/components/ward-management/ward-sites.ts`, above the site literals:

```ts
/**
 * ⚠️ EVERY NUMBER BELOW IS INVENTED. No real ward's bed designations are recorded here.
 *
 * The owner's ruling of 2026-09-04 requires the splits to be "synthetic and clearly marked,
 * replaceable in one place. Real bed designations must not be mixed into an invented fixture."
 * This map IS that one place: to replace a ward's real split, change its number here and nothing
 * else. `tests/ward-bed-designation-fixture.test.ts` fails if a unit is missing.
 *
 * The one worked example the owner gave is `bty-adult-secure` — "Ward 7 in Bentley is a
 * locked/Open ward" — so that unit is genuinely mixed rather than flattened.
 *
 * Wholly-open wards carry 0. Wholly-locked wards carry their full bed count.
 */
export const WARD_LOCKED_BED_SPLITS: Readonly<Record<string, number>> = {
  // ... one entry per unit id, filled in from the unit's former `security` value:
  //   security "Open"   -> 0, except the mixed wards named below
  //   security "Secure" -> the unit's full `beds` count
};
```

Then, for every unit literal: delete its `security: "Open" | "Secure"` line and add `lockedBeds: WARD_LOCKED_BED_SPLITS["<unit id>"]` and an `allocatableLocked` value. Set `allocatableLocked` to `0` for wholly-open wards, to the unit's `allocatable.value` for wholly-locked wards, and to a number no greater than `allocatable.value` for mixed ones.

⚠️ **MEASURED, AND IT CHANGES THIS STEP.** A census of `ward-sites.ts` (23 units, all still declaring
`security`) shows the naive rule produces **6 wholly locked, 16 wholly open, and exactly ONE genuinely
mixed ward.** No unit has `allocatable > empty`; no unit is missing a field; `bty-adult-secure` is
confirmed at 17 beds and 2 allocatable.

🔴 **One mixed ward is not enough, for two separate reasons.** It leaves the entire mixed-ward code path
— the whole point of this change — exercised by a single fixture row, so a regression in it would show up
in one place or nowhere. **And it misrepresents the network:** the owner said _"some wards are locked,
some are voluntary and some are mixed"_ `(OWNER, 2026-09-04)`, describing mixed as a **category**, not as
one exceptional ward.

**So make three or four units genuinely mixed, not one.** Choose adult units with enough beds and at
least 2 allocatable to make a split meaningful. This is invented data under the owner's own rule that
splits are _"synthetic and clearly marked, replaceable in one place"_, so widening it costs nothing and
every value stays replaceable by editing `WARD_LOCKED_BED_SPLITS` alone. **Raise the fixture test's
floor from `> 0` to `>= 3` to lock it in.**

Make **at least** `bty-adult-secure` genuinely mixed: it has 17 beds and 2 allocatable, so `lockedBeds: 4, allocatableLocked: 1` matches the owner's example and gives the fixture a real mixed case.

- [ ] **Step 4: Run the fixture test to verify it passes**

Run: `node scripts/run-vitest.mjs run --reporter=dot tests/ward-bed-designation-fixture.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ward-management/ward-sites.ts tests/ward-bed-designation-fixture.test.ts
git commit -m "feat(ward-flow): invented locked/open splits, in one replaceable place

Bentley adult is mixed, matching the owner's worked example. Every split is
in WARD_LOCKED_BED_SPLITS so a real designation replaces one number and
touches no logic.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

> ⚠️ **MEASURED BLAST RADIUS FOR TASK 4 — replaces the earlier "20 test files mention security" upper
> bound, which was never a breakage count.**
>
> **13 test files genuinely break** (every occurrence traced back to whether the enclosing variable is a
> `Unit` or a `Movement`, so nothing is unclassified): `ward-board-derivations`, `ward-data-checker`,
> `ui-ward-coordinator.spec`, `ward-eligibility`, `ward-morning-rollup`, `ward-referral-model`,
> `ward-referral-matching`, `ward-screen.dom`, `ward-specialling-capacity`, `ward-travel-grouping`,
> `ward-statistics-sections.dom`, `ward-nav`, `ward-scenarios`.
>
> 🔴 **DO TASK 3 BEFORE TASK 4, AND MOST OF THIS LIST WILL FIX ITSELF.** There are **no shared exported
> unit fixtures in `tests/`** — six local duplicate builders, each used only by its own file — and the
> real shared source of units is **`ward-sites.ts` itself**, reached through `allUnits()`, `unitById()`
> and `scenarioUnits()`. **That single file drives most of the 13.** Repairing the fixture first turns a
> 13-file job into a much smaller one, and the residue is then genuinely per-file.
>
> ⚠️ **`ui-ward-coordinator.spec.ts` IS A PLAYWRIGHT SPEC AND WILL NOT BE RUN BY `npm run test`.** It is
> on the breakage list and the offline suite cannot see it. **A green unit run is not evidence this file
> is fixed.** Ward E2E specs have previously fallen through both loops — neither the focused runner nor
> the browser gate selects them — so this one needs checking by opening it, not by watching a colour.
>
> ⚠️ **And the six local duplicate builders are the compiler's blind spot.** A builder that spreads a base
> object acquires whatever the base now has without the word `security` appearing at the call site, so
> `typecheck` proves every REMOVED reader is gone and proves nothing about a builder that merely still
> compiles. Open all six.

### Task 4: The seven remaining readers of `unit.security`

**Files:**

- Modify: `src/components/ward-management/ward-derivations.ts`
- Modify: `src/components/ward-management/ed/ed-screen.tsx`
- Modify: `src/components/ward-management/coordinator/flow-diagram.tsx`
- Modify: `src/components/ward-management/wards/ward-index.tsx`
- Modify: `src/components/ward-management/ward/ward-screen.tsx`
- Modify: `src/components/ward-management/ward-movements.ts`
- Test: whichever existing suites cover those files

**Interfaces:**

- Consumes: `designationSummary`, `unitHasLockedBeds`, `lockedBedsFree` from Task 1.
- Produces: nothing new.

This is a batch of small same-shape edits. Do them in one pass, not one per file.

- [ ] **Step 1: Find every remaining reference**

```bash
grep -rn "unit.security\|\.security ===" src/components/ward-management/ --include=*.ts --include=*.tsx
```

Expected before this task: 16 references across 8 files, two of which (`ward-eligibility.ts`, `ward-model.ts`) are already done. Every remaining one that reads a **unit's** security must change; every one that reads a **movement's** security must not.

- [ ] **Step 2: Replace each unit-side read**

- A read that asked "is this ward secure" becomes `unitHasLockedBeds(unit)`.
- A read that displayed the word "Secure" or "Open" as a ward property becomes `designationSummary(unit)`.
- A read that counted secure wards becomes a count of `unitHasLockedBeds`.

⚠️ **Do not change any `movement.security` read.** That is the patient's requirement and is unaffected.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS. This is the step that proves no reader was missed — `Unit.security` no longer exists, so any survivor is a compile error.

- [ ] **Step 4: Run the ward suites**

Run: `node scripts/run-vitest.mjs run --reporter=dot tests/ward-eligibility.test.ts tests/ward-board-derivations.test.ts tests/ward-referral-matching.test.ts tests/ward-screen-eligibility-warning.test.ts tests/ward-scenarios.test.ts tests/ward-data-checker.test.ts`
Expected: PASS. Fix any fixture in those suites that still builds a `Unit` with `security`.

- [ ] **Step 5: Run the full offline suite**

Run: `npm run test`
Expected: PASS. Twenty test files mention security; the focused list above will not have covered all of them, and a `readFileSync`-style contract test cannot be selected by a focused run at all.

- [ ] **Step 6: Commit**

```bash
git add -u src tests
git commit -m "refactor(ward-flow): every unit-side security read moves to bed designations

typecheck is the proof of completeness here: Unit.security no longer exists,
so a missed reader cannot compile. movement.security is untouched — it is the
patient's requirement, a different fact.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: A ward edits its own designations

**Files:**

- Modify: `src/components/ward-management/ward-flow-reducer.ts` (the event that updates bed numbers)
- Modify: `src/components/ward-management/ward-flow-events.ts`
- Modify: `src/components/ward-management/ward/ward-screen.tsx` (the existing bed-number editing surface)
- Test: `tests/ward-flow-reducer.test.ts`

**Interfaces:**

- Consumes: the existing bed-number update event.
- Produces: that same event gains optional `lockedBeds` and `allocatableLocked` fields. **No new event and no new screen** — the owner ruled "as part of editing its bed numbers. No new screen, no new concept."

- [ ] **Step 1: Read the existing update event first**

```bash
grep -n "CONFIRM_CAPACITY\|UPDATE_BEDS\|allocatable" src/components/ward-management/ward-flow-events.ts
```

Use whatever that event is actually called. Do not invent a name.

- [ ] **Step 2: Write the failing test**

In `tests/ward-flow-reducer.test.ts`, add a case that dispatches the existing bed-update event carrying a new `lockedBeds` value and asserts the unit's designation changed and its other fields did not. Assert also that an update setting `allocatableLocked` above `allocatable` is **rejected** by the reducer rather than stored — the helper clamps for display, but the record itself must never hold an impossible number.

- [ ] **Step 3: Run to verify it fails.** `node scripts/run-vitest.mjs run --reporter=dot tests/ward-flow-reducer.test.ts`

- [ ] **Step 4: Extend the event and the reducer case.** Both new fields optional, so every existing dispatch still compiles and behaves identically.

- [ ] **Step 5: Add the two inputs to the ward screen's existing bed-number form.** Same form, two more fields, labelled "Locked beds" and "Locked beds free". No new route.

- [ ] **Step 6: Run the reducer and ward-screen suites, then commit.**

```bash
git commit -m "feat(ward-flow): a ward sets its own locked-bed designations while editing beds

Same event, same form, two more fields — no new screen and no new concept,
per the owner's ruling. The reducer refuses an impossible split rather than
storing one and clamping it at render.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

> ⚠️ **VOCABULARY CONSTRAINT FOR TASK 6, from Ward Builder Three's bed-figure census.**
>
> **Do not invent a word for a bed figure.** The screens already say "ready", "held", "blocked",
> "occupied", "empty", "out of service" and "beds you can fill today", and those distinctions are
> deliberate — `ward-board.tsx`'s "Empty" (fillable) versus "Held" (empty, not offered) versus "Out of
> service" is the most careful wording in the codebase, and **the locked/open split has to fit inside
> it rather than beside it.** `ward-screen.tsx` says "ready" for `min(allocatable, empty)`; match that.
>
> ⚠️ **One pre-existing defect to avoid propagating, NOT to fix here.**
> `ward-management-network.tsx:324` renders "N ready" from `min(allocatable, empty)` while **`:1023`
> renders "N ready" from a raw sum of `unit.allocatable.value`** — same word, two arithmetics, in one
> file, with the cluster header sitting directly above the cards it sums. It is another chat's row and
> is not in this plan's scope. **But a locked/open breakdown added to either site would inherit
> whichever arithmetic is local to it, and the two would then disagree about locked beds as well as
> total ones.** If Task 6 touches that file at all, read both sites first.
>
> ⚠️ **And treat the rest of that census as evidence about the sites it names, nothing more.** The
> read-only sweep that produced half of it reported zero mismatches across 23 files while silently
> skipping `:1023` — the one real mismatch in a file it had already opened and written up twice. **A
> clean sweep is not a clean bill.** Open the file.

### Task 6: Show the split where a coordinator decides

**Files:**

- Modify: `src/components/ward-management/wards/ward-index.tsx`
- Modify: `src/components/ward-management/ward/ward-screen.tsx`
- Modify: `src/components/ward-management/referrals/referral-match.tsx`
- Test: `tests/ward-bed-designation-surfaces.dom.test.tsx` (create)

- [ ] **Step 1: Write the failing DOM test** asserting each of the three screens renders the designation summary for a mixed ward, and that a wholly-open ward renders "All open" rather than "0 locked".

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Render `designationSummary(unit)` on each**, using the Ward Flow token layer for any new styling. No raw hex, no new colour.

- [ ] **Step 4: Run the DOM test and the phone-chrome gate.**

Run: `node scripts/run-vitest.mjs run --reporter=dot tests/ward-bed-designation-surfaces.dom.test.tsx`
Then: `npm run verify:phone-chrome`

- [ ] **Step 5: Commit.**

---

### Task 7: Whole-change verification

- [ ] **Step 1:** `npm run format` and commit the result. Formatting is in neither test, typecheck nor lint, and an uncommitted format leaves the pushed commit red.
- [ ] **Step 2:** `npm run verify:cheap` — the broad local gate. This change crosses modules, which is exactly what that gate is for.
- [ ] **Step 3:** Paste the decisive line of its output into the final report. Not "it passed" — the line.
- [ ] **Step 4:** Do **not** run `npm run verify:release` or any provider-backed check without asking the owner first.

---

## Self-review of this plan

**Spec coverage.** §6's four numbered changes map to tasks: (1) replace the flag with counts → Task 1; (2) the gate asks about a free bed → Task 2; (3) a ward may change its own designations, no new screen → Task 5; (4) splits synthetic and marked, replaceable in one place → Task 3. The §6 warning about not conflating locked beds with involuntary patients is carried into the `Unit.lockedBeds` doc comment and the Global Constraints.

**Gaps I know about and have deliberately left out of this plan:** the Delays view (§7), the matcher (§8), the bed picture (§9), the location/identity work, and the clock defect that appears once community-raised journeys exist. Each needs its own plan. The clock one is noted here only so it is not lost.

**Placeholders:** none. Task 5 deliberately instructs the implementer to read the real event name rather than guessing one, which is a lookup, not a placeholder.

**Type consistency:** `lockedBeds` and `allocatableLocked` are the only two new stored fields and are spelled identically in Tasks 1, 3, 4, 5 and 6. `openBeds`, `lockedBedsFree`, `openBedsFree`, `unitHasLockedBeds`, `unitHasOpenBeds` and `designationSummary` are defined in Task 1 and used with those exact names thereafter.
