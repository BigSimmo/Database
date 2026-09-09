# Ward Flow Phase 7 — The front door

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** referrals arrive from any source carrying three facts about a person and nothing more, are
matched against beds described by four independent dimensions, and a coordinator accepts one, declines
it with a reason from a fixed list, or leaves it queued.

**Architecture:** widen what already exists rather than building beside it. `Unit` gains two new
category fields and a widened `Cohort`; `eligibility()` gains accepts-shaped gates for the new
dimensions; a new `Referral` record and three new events join the existing reducer under the existing
role gate. The matching engine stays the one function that already returns a `GateResult[]`.

**Tech Stack:** TypeScript 6 strict, React 19, Next.js 16 App Router, CSS modules with `@theme`
tokens, Vitest, Playwright (project `chromium-mockups`).

**Spec:** `docs/superpowers/specs/2026-08-27-ward-flow-phase-7-front-door-design.md`
**Direction and settled decisions:** `docs/ward-flow-roadmap.md`,
`docs/ward-flow-phase-6-7-decisions.md`

---

## Global Constraints

Every task's requirements implicitly include all of these.

- **Run every command from the plan's worktree.** Prefix each one with
  `cd /d/Worktrees/Database/pr-2390-fix &&`. The shell's working directory does not reliably persist
  and silently reverts to a different checkout.
- **Never invent a legal figure.** No figure, timeframe, threshold or duration from the Mental Health
  Act may be cited, paraphrased or inferred anywhere in code, copy, comment, test or fixture. **A
  plain `Voluntary` / `Involuntary` label is permitted and is not a legal figure.** If a figure seems
  needed, stop and report it — do not author one.
  `tests/ward-legal-figure-guard.test.ts` switches exhaustively over every event type, so adding an
  event without extending it **refuses to compile**. Extend it in the same change, and prove it
  non-vacuous by emptying one candidate list and watching the traversal assertion name the event that
  stopped being reached.
- **A referral carries exactly three facts about a person: `ageBand`, `sex`, `secureBedNeeded`.**
  No name, date of birth, record number, address, diagnosis, narrative history or treatment. **No free
  text anywhere, including no note on a decline.** Free text counts as data.
- **Every dimension is "does this bed accept this person", never "does this bed's value equal this
  person's".** Most beds are undesignated for sex; a rule of the form
  `bed.sexDesignation === referral.sex` excludes every referral from most of the network while looking
  entirely reasonable in review. This is the phase's defining hazard.
- **Matching reads `availableNow` and never reads a `BedRelease`, a state, a band or a confidence**
  (spec D15). This is what keeps Phase 7 independent of the unvalidated four-stage bed model.
- **Nothing predicted, confirmed-but-unreleased, or on leave ever reaches an availability figure.**
- **Local and offline checks only.** Never run `verify:release`, any `eval:*` script,
  `check:supabase-project`, `test:live`, or anything touching OpenAI, Supabase, hosted CI or a live
  database. Never push and never open a pull request.
- **Take the shared test lease.** Run Vitest through `node scripts/run-vitest.mjs run <files>`, never
  bare `npx vitest`. A refusal reading "capacity is full" or "heavyweight command is active" means
  **BLOCKED, retry** — never a test failure. A shared (focused) lease waits only 30 seconds for
  admission, so retry from a **background** job with `sleep` between attempts; foreground `sleep` is
  blocked. Never delete, clear or bypass coordinator state.
- **Read the exit status AND the decisive output line.** Exit 0 alone is not proof; a run can exit 0
  having printed no result line at all. Never pipe a long run through a bare `tail`.
- **Every `<button>` must do something** — a handler, a submit inside a form, or navigation.
  `eslint-rules/require-button-wiring.mjs` fails the build otherwise. Never blanket-disable it.
- **Design tokens, not hex.** Production tap targets are `min-h-12` / `3rem`; never reduce them to
  `min-h-11`, which reintroduces a known `ui-smoke` flake.
- **Ward Flow is a sandbox.** No new link may point anywhere in the clinical application.
- **Mutation-test every new test.** Break what it guards, run it, watch it go red, quote the failure
  line, restore. A test never watched to fail is not evidence.
- **Stage explicit paths.** `git add <path> <path>`, never `git add -A` — other work shares this
  worktree.

---

## File structure

| File                                                               | Responsibility                                                                                                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ward-management/ward-model.ts`                     | `Cohort` widened with `Youth`; `SexDesignation` and `forensic` on `Unit`; new `Referral`, `ReferralSource`, `ReferralState`, `REFERRAL_DECLINE_REASONS`. |
| `src/components/ward-management/ward-sites.ts`                     | Sex designations and forensic flags seeded across units; at least one youth unit added.                                                                  |
| `src/components/ward-management/ward-movements.ts`                 | A seeded `referrals` fixture opening on the awkward cases.                                                                                               |
| `src/components/ward-management/ward-eligibility.ts`               | The four accepts-shaped gates, alongside the untouched `sex_mix` gate.                                                                                   |
| `src/components/ward-management/ward-referrals.ts`                 | **New.** Pure derivations: referral queue order, match verdicts per unit. No React.                                                                      |
| `src/components/ward-management/ward-flow-events.ts`               | Three new events, the `community` role, and their `EVENT_ROLE` entries.                                                                                  |
| `src/components/ward-management/ward-flow-reducer.ts`              | The three transitions, their role guards, their `Rejection`s, and `referrals` on `WardFlowState`.                                                        |
| `src/components/ward-management/referrals/referral-intake.tsx`     | **New.** The phone-first intake form.                                                                                                                    |
| `src/components/ward-management/referrals/referral-board.tsx`      | **New.** The coordinator's board.                                                                                                                        |
| `src/components/ward-management/referrals/referral-match.tsx`      | **New.** One referral, every unit, accepted or the single reason not.                                                                                    |
| `src/components/ward-management/referrals/referrals.module.css`    | **New.** Their styles, phone-first.                                                                                                                      |
| `src/app/mockups/ward-flow/referrals/page.tsx`                     | **New.** The board's route.                                                                                                                              |
| `src/app/mockups/ward-flow/referrals/new/page.tsx`                 | **New.** The intake form's route.                                                                                                                        |
| `src/components/ward-management/ward-nav.ts`                       | Their nav entries.                                                                                                                                       |
| `scripts/ci-change-scope.mjs`, `data/repo-awareness-snapshot.json` | Registration. The snapshot is regenerated with `npm run snapshot:repo-awareness`, never hand-edited.                                                     |
| `tests/ward-referral-model.test.ts`                                | **New.** Model, fixtures, and the structural privacy test.                                                                                               |
| `tests/ward-referral-matching.test.ts`                             | **New.** The four accepts-rules, including the named undesignated guard.                                                                                 |
| `tests/ward-referral-reducer.test.ts`                              | **New.** The three transitions and their role gates.                                                                                                     |
| `tests/ward-referral-screens.dom.test.tsx`                         | **New.** Intake, board and match view.                                                                                                                   |
| `tests/ui-ward-referrals.spec.ts`                                  | **New.** The Chromium journey.                                                                                                                           |

---

## Task 1: The bed category, the referral record, and the fixtures

**Files:**

- Modify: `src/components/ward-management/ward-model.ts`
- Modify: `src/components/ward-management/ward-sites.ts`
- Modify: `src/components/ward-management/ward-movements.ts`
- Test: `tests/ward-referral-model.test.ts` (create)

**Interfaces produced — later tasks consume these exact names:**

```ts
export type Cohort = "Adult" | "Older adult" | "Youth"; // widened; keep the existing spelling

export const SEX_DESIGNATIONS = ["Undesignated", "Female only", "Male only"] as const;
export type SexDesignation = (typeof SEX_DESIGNATIONS)[number];

// on Unit, both new:
//   sexDesignation: SexDesignation;   // "Undesignated" is the default and the majority case
//   forensic: boolean;

export const REFERRAL_SOURCES = ["community", "crisis_service", "police", "ambulance", "inter_hospital"] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

export const REFERRAL_STATES = ["queued", "accepted", "declined"] as const;
export type ReferralState = (typeof REFERRAL_STATES)[number];

export const REFERRAL_DECLINE_REASONS = [
  "no_suitable_bed",
  "age_band_not_provided_here",
  "sex_designation_unavailable",
  "secure_bed_unavailable",
  "out_of_catchment",
  "referred_elsewhere",
] as const;
export type ReferralDeclineReason = (typeof REFERRAL_DECLINE_REASONS)[number];

export type Referral = {
  id: string;
  // The only three facts about a person. Nothing else may ever be added here.
  ageBand: Cohort;
  sex: Sex;
  secureBedNeeded: boolean;
  // Facts about the referral itself.
  source: ReferralSource;
  raisedAt: Instant;
  urgency: 1 | 2 | 3;
  originSiteCode: string; // a synthetic site code, never an address
  transportNeeded: boolean;
  state: ReferralState;
  acceptedUnitId?: string;
  declineReason?: ReferralDeclineReason;
  decidedAt?: Instant;
  decidedBy?: string; // a role, never a person
};
```

**`legalStatus` is NOT a field on `Unit`.** The bed's legal-status dimension is the existing
`unit.authorised` boolean, relabelled at the point of display. Do not add a second field for the same
fact — two fields for one fact is how a screen ends up giving two answers.

**`unit.security` (`Open` / `Secure`) stays exactly as it is and is NOT one of the four dimensions.**
Do not merge it with `forensic`.

**Seeding rules, each of which gets a test:**

1. **Most units are `"Undesignated"`.** Seed a clear majority undesignated, and at least one
   `"Female only"` and one `"Male only"`. A fixture where every bed carries a designation would let an
   equality bug pass every test.
2. At least one unit has `forensic: true`.
3. **The Youth unit is the East Metropolitan Youth Unit (EMyU) at Bentley Health Service**, which is
   already in the site table (`ward-sites.ts`, **`code: "BTY"`** — verified by reading the file and by the rendered page, which emits `ward-morning-site-BTY`). Use that name verbatim, capitalisation
   included — it is a real unit supplied by the product owner on 2026-08-27, not an invention, so do
   not rename it, abbreviate it differently, or move it. Add a comment recording that its **bed
   numbers** are invented like every other number here, while its name and placement are real.
   Without it every youth referral matches nothing for a structural reason.
4. The `referrals` fixture opens on the awkward cases: at least one queued referral that no bed
   accepts, at least one declined referral, at least one youth referral, and at least one referral
   whose sex would be excluded by a designated bed but accepted by an undesignated one.

**Structural privacy test**, extended from the Phase 4/5 pattern: assert `Referral`'s field set
against the list above, **not** against fixture content, so a future field named `patientId`, `notes`,
`diagnosis` or `dob` fails at the type level.

- [ ] **Step 1: Write the failing tests** (seeding rules 1–4, the privacy test, and that
      `REFERRAL_DECLINE_REASONS` contains no entry describing a person)
- [ ] **Step 2: Run and watch fail** (background retry job, per the global constraints)
- [ ] **Step 3: Implement the model, the seeds and the fixture**
- [ ] **Step 4: Mutation-test** — at minimum, make every seeded unit designated and watch rule 1's
      test go red; add a `notes: string` field to `Referral` and watch the privacy test go red. Quote
      both failure lines, restore.
- [ ] **Step 5: Run, watch pass, commit**

---

## Task 2: Matching, and the rule that must not become an equality

**Files:**

- Modify: `src/components/ward-management/ward-eligibility.ts`
- Create: `src/components/ward-management/ward-referrals.ts`
- Test: `tests/ward-referral-matching.test.ts` (create)

**Interfaces:**

- Produces: `export function referralEligibility(referral: Referral, unit: Unit, now: Instant): EligibilityVerdict`
  — the same `EligibilityVerdict` / `GateResult[]` shape `eligibility()` already returns, so the
  "why not here?" artefact comes out for free.
- Produces: `export function referralCandidates(referral: Referral, units: Unit[], now: Instant): { unit: Unit; verdict: EligibilityVerdict }[]`
  — **every** unit, never a truncated list, ordered by the site table's order.

**The four accepts-rules. Write each as an accepts-rule even where equality happens to be correct, so
the four read uniformly and a future change lands in one place:**

| Gate              | Passes when                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ |
| `age`             | `unit.cohort === referral.ageBand`                                                   |
| `legal_status`    | `unit.authorised === true`, **or** the referral needs no authorised destination      |
| `sex_designation` | `unit.sexDesignation === "Undesignated"`, **or** it matches the referral's sex       |
| `forensic`        | `unit.forensic === false` — **a forensic bed never accepts a Phase 7 referral (D7)** |

Plus the existing gates, unchanged: `security`, `sex_mix`, `specialling`, `capacity_freshness`,
`allocatable_bed`.

**`sex_designation` and `sex_mix` are different questions and BOTH stay.** `sex_mix` is an occupancy
fact — would this admission leave someone alone in a ward with nobody of their own sex. Neither is
derived from the other; neither replaces the other. Do not collapse them.

**Matching reads `availableNow` only.** Never a `BedRelease`, never a state, band or confidence.

**The named guard test — write it with its reasoning as a comment, exactly this shape:**

```ts
// Most beds are undesignated, so a rule of the form `bed.sexDesignation === referral.sex` would
// exclude every referral from most of the network while looking entirely reasonable in review.
// This test exists to make that mistake impossible to ship.
it("an undesignated bed accepts a referral of either sex", () => {
  const bed = { ...someUnit, sexDesignation: "Undesignated" as const };
  for (const sex of ["Female", "Male"] as const) {
    const verdict = referralEligibility({ ...someReferral, sex }, bed, NOW_ANCHOR);
    const gate = verdict.gates.find((g) => g.gate === "sex_designation");
    expect(gate?.pass).toBe(true);
  }
});
```

- [ ] **Step 1: Write the failing tests** — the four accepts-rules in both directions, the named
      undesignated guard, the `sex_designation` / `sex_mix` independence test (a unit that passes one
      and fails the other, in each direction), and the contract test that matching reads no release.
- [ ] **Step 2: Run and watch fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Mutation-test** — change `sex_designation` to `unit.sexDesignation === referral.sex`
      and watch the named guard go red; make `legal_status` strict equality and watch a voluntary
      referral test go red; collapse `sex_designation` into `sex_mix` and watch the independence test
      go red. Quote all three failure lines, restore.
- [ ] **Step 5: Run, watch pass, commit**

---

## Task 3: The events, the role gate, and the coordinator's decision

**Files:**

- Modify: `src/components/ward-management/ward-flow-events.ts`
- Modify: `src/components/ward-management/ward-flow-reducer.ts`
- Modify: `tests/ward-legal-figure-guard.test.ts`
- Test: `tests/ward-referral-reducer.test.ts` (create)

**Three new events, and no more:**

| Event              | Role          | Effect                                                           |
| ------------------ | ------------- | ---------------------------------------------------------------- |
| `RECEIVE_REFERRAL` | `community`   | Appends a queued `Referral`.                                     |
| `ACCEPT_REFERRAL`  | `coordinator` | `state: "accepted"`, `acceptedUnitId`, `decidedAt`, `decidedBy`. |
| `DECLINE_REFERRAL` | `coordinator` | `state: "declined"`, `declineReason`, `decidedAt`, `decidedBy`.  |

`WardFlowRole` gains **`community`** — one role covering all five sources, with the source recorded on
the referral. Five roles would be five things to maintain before we know they differ.

**`WardFlowState` gains `referrals: Referral[]` and `referralSequence: number`** — a monotonic id
source that only ever increases, mirroring the existing `leaveBedSequence`. Do **not** derive an id
from `referrals.length`: Phase 5 shipped exactly that bug for leave beds and it collided as soon as an
entry was removed.

**Guards, each of which gets a test:**

- A role other than the event's own produces a visible `Rejection`, never a silent no-op.
- `DECLINE_REFERRAL` with a reason outside `REFERRAL_DECLINE_REASONS` is refused by a **membership
  check**, not a truthiness test. Phase 5 shipped a truthiness test here and review caught it.
- `ACCEPT_REFERRAL` against a unit that does not accept the referral is refused, with the failing gate
  named in the `Rejection`.
- A decision on an already-decided referral is refused.
- **An accepted referral does not create a `Movement`** (spec D14). Assert this explicitly, so a
  future change has to argue with a test rather than slip past.

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run and watch fail**
- [ ] **Step 3: Implement, and extend `tests/ward-legal-figure-guard.test.ts`** so the three new
      events are swept. It will refuse to compile until you do.
- [ ] **Step 4: Mutation-test** — make the decline-reason guard a truthiness test and watch it go red;
      empty one candidate list in the legal-figure guard and watch the traversal assertion name the
      event that stopped being reached. Quote both, restore.
- [ ] **Step 5: Run, watch pass, commit**

---

## Task 4: The intake form, phone first

**Files:**

- Create: `src/components/ward-management/referrals/referral-intake.tsx`
- Create: `src/components/ward-management/referrals/referrals.module.css`
- Create: `src/app/mockups/ward-flow/referrals/new/page.tsx`
- Test: `tests/ward-referral-screens.dom.test.tsx` (create)

**One form, used by every source.** Fields: source, age band, sex, secure bed needed, urgency, origin
site, transport needed. **Nothing else, and no free-text input of any kind.**

Designed for a phone and adapted upward — police and ambulance officers are not at a desk. Cards
rather than a table, one decision per screenful, `min-h-12` tap targets, real controls with real
handlers.

**Test harness:** wrap in `<WardFlowProvider initialNow={NOW_ANCHOR}>` and mock `next/link`, following
`tests/ward-discharge-board.dom.test.tsx` verbatim.

**Stable selectors:** `ward-referral-intake-<field>`, `ward-referral-intake-submit`.

- [ ] Steps 1–5 as in Task 1 (failing test, watch fail, implement, mutation-test, commit)

---

## Task 5: The referral board and the match view

**Files:**

- Create: `src/components/ward-management/referrals/referral-board.tsx`
- Create: `src/components/ward-management/referrals/referral-match.tsx`
- Create: `src/app/mockups/ward-flow/referrals/page.tsx`
- Modify: `src/components/ward-management/referrals/referrals.module.css`
- Modify: `tests/ward-referral-screens.dom.test.tsx`

**The board:** queued referrals first, then recently decided. Ordered by urgency, then by how long a
referral has waited. **"Waiting since" is displayed prominently** — the queue ranks by urgency, which
is right, but length of wait carries the moral weight.

**The match view:** one referral, **every** unit, each either accepting or carrying the single reason
it does not. It **never allocates, never ranks by suitability, and never suggests which bed is best.**
Ordering is the site table's order, the same fixed order the morning page uses — an ordering that
looked like a recommendation would be one.

**Failure branches, each of which gets a test:**

- No bed accepts → say so explicitly and list the reason per unit. **Never an empty list**, which
  reads as a rendering failure.
- An age band with no unit anywhere → say that specifically ("no youth unit exists in this network"),
  never "no bed available", which is an operational statement about a structural fact.
- A forensic bed → shown with its category, excluded from every accepting list, and **excluded from
  any figure presented as beds this referral could use**, with the reason stated.
- A unit that has never confirmed its capacity → "Never confirmed", never zero, and not offered.

Both screens carry the "not a medical device" prose banner, matching the five screens that already do.

- [ ] Steps 1–5 as above

---

## Task 6: Registration, so the routes are not orphans

**Files:** `ward-nav.ts`, `scripts/ci-change-scope.mjs`, the two route-contract maps in `tests/`,
`data/repo-awareness-snapshot.json`.

Find every site with
`grep -rn "ward-flow/discharges" --include=*.ts --include=*.tsx --include=*.mjs --include=*.json src tests scripts data`
and register both new routes alongside. Internal navigation uses `<Link>`, never a raw `<a href="/…">`.

Regenerate the snapshot with `npm run snapshot:repo-awareness` — never hand-edit it.

- [ ] Register, regenerate, prove with `route-reachability`, `sitemap:check` and
      `check:repo-awareness-snapshot`, quoting the decisive line from each, then commit.

---

## Task 7: The Chromium journey

**Files:** `tests/ui-ward-referrals.spec.ts` (create)

One journey in project `chromium-mockups`: a referral is raised from a **phone-width** intake form,
appears on the coordinator's board, is matched, and is accepted — with the board reflecting each step
without a reload.

Prove it can fail before trusting it: mutate the page, run, quote the red line, restore, quote green.

Read the exit status **and** the "N passed" line. `75` with a `DATABASE_HEAVY_RUN_ADMISSION_BUSY`
marker means blocked — retry later. Any other non-zero is red. Exit 0 with no result line means
nothing ran.

---

## Task 9: The morning page gains a demand figure

> **Task 9 runs BEFORE Task 8, deliberately, and the numbers are not a mistake to be tidied.**
> Task 8 is the verification sweep and the screenshot pass; it is last because it proves the
> phase, and a sweep run before the last change proves the wrong tree. Task 9 was added after the
> numbering was fixed and slotted where it had to execute. **Noted rather than renumbered
> 2026-08-30 (process audit P3-24):** this plan is a record of work already done, and renumbering
> a record back-dates it — see the fact-versus-record rule in
> `docs/ward-flow-changeable-data-rule.md`. Read the ORDER ON THE PAGE as the execution order;
> the number is an identifier, not a position.

**Files:**

- Modify: `src/components/ward-management/ward-morning-rollup.ts` (the derivation)
- Modify: `src/components/ward-management/morning/morning-page.tsx` (render it)
- Modify: `tests/ward-morning-rollup.test.ts`, `tests/ward-morning-page.dom.test.tsx`

Spec D17. Phase 6's morning page shows beds available and nothing about who is waiting. Now that the
referral queue is real, it gains **one figure for people waiting**.

**Every Phase 6 rule about that page still binds, and two of them are the whole point:**

- **The page computes no figure of its own** (Phase 6 D1). The count is derived in
  `ward-morning-rollup.ts` alongside the bed roll-up, and the page renders it.
- **It is never summed into any bed figure**, least of all the headline. It sits beside them as its own
  count, in its own words, exactly as `Leave (usable)` does. **Nothing predicted, confirmed-but-
  unreleased, on leave, or waiting may ever reach "Available now".**
- It carries the same freshness discipline as every other figure (Phase 6 D4).
- Its label is defined once, next to the derivation, with the five bed labels (Phase 6 D14).

**Count only queued referrals** — accepted and declined ones are decided and are not waiting.

- [ ] **Step 1: Write the failing tests** — the derivation's count, the rendered figure, and a contract
      test that the headline is unchanged by the presence of queued referrals.
- [ ] **Step 2: Run and watch fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Mutation-test** — add the waiting count into the headline and watch the contract test go
      red; quote the line; restore. This is the same guard Phase 6 needed three attempts to get right,
      so do not assume a test covers it until you have watched it fail.
- [ ] **Step 5: Run, watch pass, commit**

---

## Task 8: Verification sweep and the screenshots

**This is the task that has historically found the real defects.** Phase 4 and Phase 5 each shipped
defects invisible to more than ten thousand passing tests, caught only by looking at the screen.

- [ ] `npm run ensure`, use the URL it prints, verify project identity at `/api/local-project-id`.
      **Never assume `localhost:3000`.**
- [ ] Capture and **look at** the intake form, the board and the match view at 390, 820 and 1440.
      Report body overflow, `h1` count and console errors for each. **390 first** — it is the intake
      form's primary width.
- [ ] Read every bed description on one screen at once and confirm no two places describe the same
      beds with different words.
- [ ] Confirm by eye that an undesignated bed is offered to referrals of both sexes in the seeded
      data. This is the phase's defining hazard and a screenshot is the last line of defence.
- [ ] Report honestly per item: proven by test, proven by screenshot, or not proven.

---

## Self-review

Before reporting DONE, each implementer confirms in its report:

- Every new test was mutation-tested, with the quoted failure line.
- `Referral` carries exactly the three person-facts and no free text anywhere.
- No Mental Health Act figure appears in code, copy, comment, test or fixture.
- No dimension is implemented as an equality where the spec says accepts.
- Matching read no `BedRelease`, state, band or confidence.
- Every `<button>` has a handler, a submit, or navigation; no hex; tap targets `min-h-12`.
- Every command ran from `/d/Worktrees/Database/pr-2390-fix`, through the proper wrappers, with both
  the exit status and the decisive output line read and quoted.

## Parallelism

Tasks 1 → 2 → 3 are serial: each consumes what the previous produced. Tasks 4 and 5 both depend on
Task 3 and share `referrals.module.css` and the screens test file, so they are serial with each other
too. Task 6 depends on Tasks 4 and 5. Task 7 depends on Task 6. Task 8 is last.

Task 9 depends on Task 3 (referrals must exist in state) and is run after Task 8's sweep, since it
touches Phase 6's page and wants that page's screenshots taken again afterwards.

Dispatch one implementer at a time. The pre-commit doc-sync hook inspects the whole working tree, not
the staged set, so two agents sharing this worktree cannot commit independently even when their edited
files are disjoint — the first to finish is blocked by the second's in-progress work. A read-only
reviewer may run concurrently, because it never commits. The expensive checks — full unit suite, lint, format, build,
browser, screenshots — run **once at the end**, because the heavyweight lock is machine-wide and other
sessions queue behind it.
