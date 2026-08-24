# Task 6b report — the reason a first contact date was moved is now kept

**Status:** DONE_WITH_CONCERNS (three concerns, none blocking; all in "Concerns" below)
**Branch:** `claude/browser-test-gate-handoff-d5c1db`, worktree
`.claude/worktrees/browser-test-gate-handoff-d5c1db`. Not pushed, no PR.
**Base:** `286e1ec13` ("record Task 6b BASE"). Five commits sit on top of it.

| Commit       | Subject                                                                |
| ------------ | ---------------------------------------------------------------------- |
| `c07dea064`  | feat(caring-contacts): keep the reason a first contact date was moved  |
| `3436eaf39`  | test(caring-contacts): pin the stored reason in the shared contract    |
| `32c369f33`  | test(caring-contacts): prove migration 0005's column shape in Postgres |
| `4f33d0940`  | test(caring-contacts): pin the reason out of `PLAN_COLUMNS`            |
| `3be680990`  | style(caring-contacts): npm run format                                 |
| _(this one)_ | docs(caring-contacts): this report — a commit cannot name its own SHA  |

---

## 1. What was built

The gap the brief describes was exactly as stated: `buildApprovedSchedule` refused any
first-contact date other than discharge + 1 without a non-blank reason, and then discarded the
string. It reached no field of `StoredPlan` and no column of `caring_contacts.plans`.

### The shape decision, and why (Ruling [105])

The reason is held **inside the patient detail**, as a fifth field:

```ts
export type StoredPatientDetail = EpisodePatientDetail & Pick<Episode, "firstContactReason">;
export type StoredPlan = PlanRecord & { patientDetail: StoredPatientDetail };
```

`EpisodePatientDetail` — the four identifying fields a caller supplies — is unchanged, so
`CreatePlanInput.patientDetail`, the API's strict `patientDetail` object, `simulation.ts` and every
existing fixture still typecheck untouched. The reason arrives where it always did, at the top level
of `CreatePlanInput` (Ruling [107]: no second write path).

The reason is **not** a fact about the person the way a name is; it is a fact about a scheduling
decision. It is filed with the identifying fields because of what it **contains** rather than what it
is about — prose a clinician typed, which in a real one names relatives, places and living
arrangements. That placement is not presentational. It buys the two guarantees the ruling asks for:

1. **It cannot reach a list read.** `StoredPlan` is `PlanRecord & { patientDetail }`, and
   `PlanRecord` is what `listPlans` returns and what the caseload renders for every patient in the
   team.
2. **A clearance cannot forget it.** `CLEARED_PATIENT_DETAIL` is declared as `StoredPatientDetail`,
   so adding a field to that type and not to that constant stops `repository.ts` compiling. Proved
   as mutation **M6** below.

Guarantee 2's compile error covers the **constant**, not the two stores' writes: the Postgres store
names its columns in SQL, which no type can check. That half is pinned by the shared contract suite
(mutation **M1**).

### The three constraints of Ruling [105], answered

| Constraint                       | How it is held                                                                                                   | Proof      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| Never on `PlanRecord`            | New compile guard `PLAN_RECORD_HOLDS_NO_FIRST_CONTACT_REASON`                                                    | M7, M8     |
| `markRetentionCleared` clears it | `CLEARED_PATIENT_DETAIL` typed as the stored shape; both stores' clearance asserted in the shared contract suite | M1, M2, M6 |
| Names projection cannot gain it  | Checked; **it still holds and needs no sibling**                                                                 | see below  |

**On the names projection.** `PATIENT_NAME_PROJECTION_RELEASES_ONLY_THE_NAME` held unchanged and
required no edit, because `PatientNameProjection` is declared field by field rather than derived
from the patient detail: a fifth stored field reaches it only if someone writes it into that type,
and writing it there breaks the existing guard. Its "or anything else" clause already covers the new
field.

**A sibling guard WAS needed, for a different shape.** `PlanRecord` is derived by intersection
(`StoredPlan = PlanRecord & …`), so it is the shape that could have gained the field silently — and
it is the caseload's read. `PLAN_RECORD_HOLDS_NO_FIRST_CONTACT_REASON` closes that:

```ts
type LacksKey<T, K extends string> = K extends keyof T ? never : true;
export const PLAN_RECORD_HOLDS_NO_FIRST_CONTACT_REASON: LacksKey<PlanRecord, "firstContactReason"> = true;
```

Mutation **M8** is the one that matters here: adding the field as **optional** leaves both stores
compiling and every behavioural test green. This guard is the only thing that fails.

### The schedule publishes what it accepted (Ruling [107])

`ScheduleResult`'s ok branch gained `firstContactReason: string | null`. The stores write
`schedule.firstContactReason`, never `input.firstContactReason`.

The reason for that indirection is the rule, not tidiness: **whether a reason is required is
`schedule.ts`'s rule and nowhere else's.** A store writing the raw input would either persist a
string the domain refused, or persist one it never looked at — and each store would have needed its
own copy of "did the date move?", free to disagree. Mutations **M3** (in-memory) and **M11**
(Postgres) both go red on exactly that substitution, and they fail different assertions in the same
shared suite.

A reason supplied alongside an **unmoved** date is deliberately not kept. It explains nothing, and
free text about a patient that no surface accounts for should not be stored.

### The length cap (Ruling [106])

`FIRST_CONTACT_REASON_MAX_LENGTH = 500`, exported from `schedule.ts`, measured **after trimming**.

- **500** is a few sentences: enough for a coordinator to say what the ward agreed with the patient
  and why, short enough that the field stays a reason rather than becoming an unreviewed clinical
  note. It is deliberately generous, so hitting it signals that the wrong thing is being written
  here.
- Over-long is **refused by its own name**, `first-contact-reason-too-long`, matching
  `first-contact-reason-required`. Never truncated: "not because the family objected" cut off after
  "not" says the opposite, and nothing in the record would show it happened. Mutation **M4**
  replaces the refusal with a `slice` and two tests go red.
- Enforced where the input is validated. The column carries a matching `check` as a backstop only —
  the same relationship `isAwstCalendarDay` has to the schema's calendar-day pattern.

### The migration

`caring-contacts/supabase/migrations/0005_caring_contacts_first_contact_reason.sql`. In **that**
directory, never the repository root's `supabase/migrations/`.

- `alter table … add column if not exists first_contact_reason text` — nullable, **no default, no
  backfill**. A plan created before this migration genuinely holds no reason, and that is a fact the
  screen states as its own. A placeholder string would be a fabricated sentence on a clinical record,
  indistinguishable from one a clinician typed.
- A guarded `check` constraint refusing blank and over-500 (guarded by a `pg_constraint` lookup,
  because Postgres has no `add constraint if not exists`).
- Transactional, no `CREATE INDEX CONCURRENTLY`, replay-safe.
- No RLS work: `plans` already has row-level security enabled and forced, policies are per row not
  per column, and 0002's grants are table-wide.

**Replays from empty, proved rather than assumed.** Both database suites call
`dropCaringContactsSchema` then `applyCaringContactsMigrations` in `beforeAll`, so every run applies
0001–0005 to an empty schema; `caring-contacts-migrations.test.ts` additionally applies the whole set
a second time for replay-safety. The new column's shape is asserted directly against the live schema
(`information_schema.columns`: nullable, no default) rather than inferred from the store passing.

### The screen (Ruling [108])

`FirstContact` now takes the episode — which is the shape decision showing through: `record` cannot
answer this question and `episode` can. A new `FirstContactReason` component holds four branches, one
per fact:

| Case                                      | What the screen says                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Date is the usual day                     | "the day after discharge, which is this programme's usual first contact" — unchanged                                 |
| Reason held                               | The reason verbatim in quotation marks, attributed to the coordinator who created the plan, in place beside the date |
| Episode not released to this role         | The reason is part of a record this role may not read; its absence says nothing about whether one is held            |
| Episode released, no reason, name blank   | A retention clearance removed it with the name, number, identifiers and cultural identity                            |
| Episode released, no reason, name present | The plan was created before reasons were kept — **"Nobody failed to give one."**                                     |

The fourth case exists because a cleared episode also holds no reason, and telling a clinician "this
plan predates the field" about a de-identified record would be a false statement. The screen
distinguishes it from the blank name, exactly as `NoNameHeldNotice` already does and for the same
stated reason: an actor who may not read an episode receives no episode at all, so a blank name on a
**released** episode can only be the clearance.

The old sentence — "the reason is not kept with the plan, so this screen has nothing to show you" —
is gone, and a DOM test asserts it is gone.

**Also done, from Task 6's review:** the `cancelled` contact on a plan that has not ended now carries
a comment saying the branch is **defensive** and naming why it is unreachable (every
`{ type: "cancel" }` travels with a plan transition to `cancelled`/`withdrawn`, and
`applyDeathCorrection` deliberately leaves the plan cancelled), ending "Do not go hunting for the
path: there isn't one."

### Files changed

```
src/lib/caring-contacts/episode.ts                     Episode.firstContactReason
src/lib/caring-contacts/schedule.ts                    cap, refusal, published accepted reason
src/lib/caring-contacts/repository.ts                  StoredPatientDetail, the two guards, clearance
src/lib/caring-contacts/in-memory-repository.ts        store, release
src/lib/caring-contacts/db/postgres-repository.ts      insert, narrow select, clearance
src/components/caring-contacts/workspace/patient-overview.tsx   four cases + defensive comment
caring-contacts/supabase/migrations/0005_…sql          new
tests/helpers/caring-contacts-repository-contract.ts   8 new shared cases
tests/caring-contacts-schedule.test.ts                 4 new cases
tests/caring-contacts-retention.test.ts                fixture + de-identification assertion
tests/caring-contacts-migrations.test.ts               column shape against live Postgres
tests/caring-contacts-postgres-repository.test.ts      PLAN_COLUMNS source scan
tests/caring-contacts-patient-overview.dom.test.tsx    3 cases (1 rewritten, 2 new)
```

---

## 2. Mutation testing — every attempt, itemised

Method, following the brief's two named traps: each mutation was applied with an **exact anchor
assertion** (a Python `assert old in s` that fails loudly if Prettier had reflowed the line), then
its presence in the tree was proved by a **separate `grep -c` step joined with `;`, never `&&`**, and
only then was the gate run. Every gate result below was read from a `Test Files` / `Tests` summary
line or a `tsc` diagnostic — never from an exit code. Every mutation was reverted with
`git checkout --` and the revert confirmed by a second `grep -c`.

| #              | Mutation                                                                                                                                    | Anchor matched? | Gate                                              | Result                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **M1**         | Postgres `markRetentionCleared`: drop `first_contact_reason = $5` and its parameter                                                         | yes             | `caring-contacts:db:test`                         | **RED** — `1 failed \| 191 passed (192)`; the failure is the shared contract's "clears the reason a first contact was moved, which is free text a clinician wrote" |
| **M2**         | In-memory clearance: replace `{ ...CLEARED_PATIENT_DETAIL }` with an explicit four-field object carrying the stored reason forward          | yes             | `vitest tests/caring-contacts-repository.test.ts` | **RED** — `1 failed \| 121 passed (122)`; same shared contract case, other store                                                                                   |
| **M3**         | In-memory `createPlan`: write `input.firstContactReason ?? null` instead of `schedule.firstContactReason`                                   | yes             | same                                              | **RED** — `2 failed \| 120 passed (122)`: "holds no reason for a plan whose first contact is on the programme's usual day" and "stores the reason trimmed"         |
| **M4**         | `schedule.ts`: truncate with `slice(0, MAX)` instead of refusing                                                                            | yes             | `vitest schedule + repository`                    | **RED** — `2 failed \| 140 passed (142)`: the schedule's cap case and the contract's cap case                                                                      |
| **M5**         | `deidentifyEpisode`: carry `firstContactReason` into the de-identified projection                                                           | yes             | `vitest tests/caring-contacts-retention.test.ts`  | **RED** — `1 failed \| 31 passed (32)`: "removes patient name, mobile, identifiers, and cultural identity"                                                         |
| **M6**         | Remove `firstContactReason: null` from `CLEARED_PATIENT_DETAIL`                                                                             | yes             | `tsc --noEmit`                                    | **RED** — `repository.ts(298,14) TS2322: Property 'firstContactReason' is missing … but required in type 'Pick<Episode, "firstContactReason">'`                    |
| **M7**         | Add `firstContactReason: string \| null` (required) to `PlanRecord`                                                                         | yes             | `tsc --noEmit`                                    | **RED** — 4 errors, including `repository.ts(382,14) TS2322: Type 'true' is not assignable to type 'never'`, which is `PLAN_RECORD_HOLDS_NO_FIRST_CONTACT_REASON`  |
| **M8**         | Add `firstContactReason?: string \| null` (**optional**) to `PlanRecord` — the subtle version both stores still satisfy                     | yes             | `tsc --noEmit`                                    | **RED** — **exactly one** error, the guard line. Nothing else in the tree notices. This is the decisive proof the guard earns its place                            |
| **M9**         | Screen: collapse the cleared branch (`if (episode.patientName === "")` → `if (false)`) so a de-identified record is reported as an old plan | yes             | `vitest …patient-overview.dom.test.tsx`           | **RED** — `1 failed \| 26 passed (27)`: "names the retention clearance when a cleared episode holds no reason"                                                     |
| **M10**        | Screen: never render a held reason (`if (reason !== null)` → `if (false)`)                                                                  | yes             | same                                              | **RED** — `1 failed \| 26 passed (27)`: "shows a moved first contact's recorded reason IN PLACE, in the clinician's own words"                                     |
| **M11**        | Postgres `createPlan`: write `input.firstContactReason ?? null` instead of `schedule.firstContactReason` (M3 on the other store)            | yes             | `caring-contacts:db:test`                         | **RED** — `2 failed \| 190 passed (192)`, the same two shared cases M3 failed                                                                                      |
| **M12**        | Add `first_contact_reason` to `PLAN_COLUMNS`, so every list read fetches the clinical note for the whole caseload                           | yes             | `caring-contacts:db:test`                         | **SURVIVED** on the first run — `2 passed (2)`, `192 passed (192)`. See below.                                                                                     |
| **M12 re-run** | The same mutation, after adding the guard it exposed                                                                                        | yes             | `caring-contacts:db:test`                         | **RED** — `1 failed \| 192 passed (193)`: "does not fetch the first-contact reason for a list read"                                                                |

**M12 is the finding of this task's verification.** Adding the column to `PLAN_COLUMNS` makes
`readPlanRecord` and `listPlans` pull a patient's clinical note into the process for every plan in
the team — and **nothing observable through the repository can see it**, because `toPlanRecord` maps
field by field and so still releases nothing. Every behavioural test stayed green. The narrowing
lives in the query, so only a source scan can hold it, and the comment claiming it was
aspirational until commit `4f33d0940`. The new scan carries a positive control (it asserts the
constant was found and really is the plan column list) so it cannot pass by matching nothing.

**No mutation failed to apply**, and no anchor went unmatched: each was guarded by an assertion that
would have raised rather than silently producing an unmutated tree. Every gate above printed a real
summary line; none was inferred from `$?`.

**Re-run after `npm run format`, because the brief's first trap nearly landed.** M1–M12 were run
before formatting, and `npm run format` then reflowed three lines — a JSX sentence in
`patient-overview.tsx`, the `ScheduleResult` union in `schedule.ts`, and one assertion in the
schedule test. None of them is a mutation anchor, so no result above was invalidated. But
"none of them is an anchor" is a claim, and the trap is precisely that a stale anchor prints a green
summary on an unmutated tree — so it was checked rather than asserted. **M4** and **M10**, the two
mutations in the two source files Prettier touched, were re-applied at the formatted tip `3be680990`:
both anchor assertions matched, both presence checks returned 1, and the gate went
`3 failed | 166 passed (169)` with exactly the three expected cases red. Reverted, the same three
files run `169 passed (169)`.

**I also got this wrong once and am recording it.** I read `git status` while `npm run format` was
still running in the background, saw a clean tree, and wrote into an earlier draft of this report
that formatting had changed nothing. It had changed three files. The claim was corrected before this
report was finished, but the lesson is the brief's own: evidence read before the command finished is
not evidence.

Not attempted, and stated rather than left implicit: the RLS-preamble mutation of Task 5b's M1
(bypassing `runRead`/`runWrite`). Nothing in this change adds a method — the new Postgres select
sits **inside** `getEpisode`'s existing `runRead` callback, so there is no new method that could omit
the preamble. The existing contract case that caught M1 still runs.

---

## 3. Gates

Run with every mutation reverted (confirmed by a `grep -c` returning 0 and by `git status`). The
full suite, lint, typecheck and the database suite ran at `4f33d0940`; `npm run format` then produced
`3be680990`, whose only delta from `4f33d0940` is three reflowed lines of whitespace. The focused
re-run at that tip is in the mutation section above.

| Gate                                                    | Result                                              |
| ------------------------------------------------------- | --------------------------------------------------- |
| `npm run typecheck` (`tsc --noEmit -p tsconfig.json`)   | clean, no diagnostics                               |
| `npm run test` (full offline Vitest)                    | see the line pasted below                           |
| `npm run lint`                                          | see below                                           |
| `npm run format`                                        | changed 3 lines; committed as `3be680990`           |
| `caring-contacts:db:test` (Docker Postgres 17 on 54329) | `Test Files 2 passed (2)`, `Tests 193 passed (193)` |

The decisive lines, pasted rather than summarised:

```
# npm run test  (GATE_RECEIPTS=refresh, so this is a fresh run, not a reused receipt)
 Test Files  830 passed | 3 skipped (833)
      Tests  10034 passed | 74 skipped (10108)
   Duration  536.39s
[exited with code 0]

# npm run caring-contacts:db:test  (Docker Postgres 17, local, offline)
 Test Files  2 passed (2)
      Tests  193 passed (193)
   Duration  25.76s

# npm run lint
[gate-receipts] recorded a pass for "lint:internal" (5301 input files).

# npm run typecheck
[gate-receipts] recorded a pass for "typecheck:internal" (5301 input files).

# npm run format
whole-tree Prettier write, exit code 0. It reflowed THREE tracked lines (see the
mutation section's post-format note); they are committed as `3be680990`, and
`git status --short` afterwards shows only this untracked report.
```

`lint` and `typecheck` print no count line of their own — the receipt line is the run's own
terminal output, recorded because both were forced fresh with `GATE_RECEIPTS=refresh` rather than
reusing an earlier receipt. Neither is being reported from an exit code alone.

The offline suite's growth reconciles exactly, which is the property worth stating: every case this
task added is accounted for, and none of the previously passing ones changed status. The offline
delta over Task 6's recorded tip is the nine shared contract cases (the Postgres project is a
separate run, so the shared suite is counted once here), the four schedule cases, and the two net-new
DOM cases — the third DOM case replaced the old "no reason is kept" assertion rather than adding to
it. The skip count is unchanged, so nothing was quietly skipped to reach green.

The database project's count is not a delta I can report honestly: I did not run it before making
changes, so I have no pre-task baseline for it. What I can say is that its final run passed with the
new shared cases, the migration column-shape case, and the `PLAN_COLUMNS` scan all included, and that
each of those was independently shown to fail under its own mutation.

**Not run, and why:** `npm run verify:ui` / `npm run verify:phone-chrome`. This change touches one
Server Component's prose and adds no route, control, layout, or client boundary; the DOM suite covers
the rendered text. **`tests/ui-caring-contacts-workspace.spec.ts`: I do not believe this touches it.**
That spec's journeys assert navigation, chrome and accessibility modes, not the first-contact note's
wording, and the new branches change no element structure other than the paragraphs inside an
existing `role="note"`. You run that gate; my expectation is that it stays at its current count, and
I would treat any change in it as a real finding rather than noise.

No provider-backed command was run. The Postgres container is local and offline (the one the brief
names); no Supabase, OpenAI, GitHub or CI surface was touched.

---

## 4. Concerns

1. **A cleared episode is identified by its blank name, which is an inference.** The screen decides
   "this reason was removed by a retention clearance" from `episode.patientName === ""`. That
   inference is sound today and is the one the module already makes for the name itself
   (`NoNameHeldNotice`) — the API requires a non-blank name, and the clearance is the only writer of
   `""`. But it is an inference, not a stored fact, and it is now load-bearing for a second
   statement. If the workspace ever gains a plan whose name is legitimately blank, two notices go
   wrong together. The durable fix is for the episode to carry the clearance instant it already has
   in `retention_state`; that is a wider change than this task and I did not make it.

2. **The 500-character cap is duplicated as a literal in the SQL.** `FIRST_CONTACT_REASON_MAX_LENGTH`
   is the enforcement and the column check is the backstop, so they must agree, and nothing checks
   that they do. It follows the existing `isAwstCalendarDay` precedent, so it is consistent rather
   than novel — but a future edit to the constant would silently leave the column stricter or looser.
   A cheap guard (scan the migration for the number, compare with the export) would close it; I left
   it out rather than widen the diff without a ruling.

3. **`listPlans` still fetches the mobile number and identifier list for the whole caseload.** The
   new field is now guarded out of `PLAN_COLUMNS`, but the two fields the store's own
   `listPatientNames` comment already names as a tracked residual are not. My guard is narrow to my
   field, which is arguably inconsistent — the same scan could cover all three. I did not widen it
   because narrowing `listPlans`'s column list is tracked separately and was explicitly said to
   deserve its own review.

Two smaller observations, not concerns:

- `patient-overview.tsx` keeps its own `DEFAULT_FIRST_CONTACT_OFFSET_DAYS = 1`, a second copy of the
  schedule's `FIRST_CONTACT_DEFAULT_OFFSET_DAYS`. That constant decides which of the four sentences a
  clinician reads. Exporting the schedule's and importing it would remove the duplication; it is
  Task 6's code and outside this brief, so I left it and am naming it instead.
- The API schema and the store did **not** disagree (Ruling [107]'s reporting clause): the plans POST
  already accepts `firstContactReason: z.string().min(1).optional()` and passes it straight through.
  No third path was invented and nothing needed reconciling. The one thing worth noting is that the
  API's `min(1)` and the domain's trim-then-refuse are two different checks of the same rule; a body
  of `"   "` passes Zod and is refused by the domain, by name, which is the correct order.
