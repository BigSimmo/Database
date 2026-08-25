# Task 9b report — the stage-1 confirmations, recorded as an attestation

**Status:** implemented; every gate that could be run on this machine is green; the mutation ledger
is mostly unrun and that is the one real gap. Details in "Gates" and "Mutation ledger" below.

**Branch:** `claude/browser-test-gate-handoff-d5c1db`, worktree
`.claude/worktrees/browser-test-gate-handoff-d5c1db`. Nothing pushed, no pull request.

---

## What was built

An activated plan now carries evidence that a coordinator confirmed the stage-1 checks. It records
**that a check happened** — who confirmed, what they confirmed, when — and it does **not** record
that the patient consented. Agreement is held in the patient's hospital record, which this system is
not connected to; the coordinator is confirming they checked it.

That distinction is carried in four places rather than only in prose, because prose does not survive
an edit:

- the type name (`PlanAssuranceAttestation`) and both value names
  (`patient-agreement-confirmed`, `patient-controls-mobile-confirmed`) name the **act**;
- the module header of `src/lib/caring-contacts/assurances.ts` states what it is and what it is not;
- the migration's `comment on table` records the same thing on the schema itself, so it travels with
  the table rather than living only in a test;
- each of the wizard's wording sites keeps a **pin against the overshoot** — a screen claiming the
  plan records the patient's consent goes red.

### Files

| File                                                                           | What changed                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/caring-contacts/assurances.ts`                                        | **New.** The closed vocabulary, the attestation type, and a compile-time guard against a fourth field.                                                                                        |
| `src/lib/caring-contacts/repository.ts`                                        | `PlanRecord.assuranceAttestations`, `CreatePlanInput.assurances`, two named refusals, `admitPlanAssurances`, and the note beside `CLEARED_PATIENT_DETAIL` recording what it must never reach. |
| `src/lib/caring-contacts/in-memory-repository.ts`                              | Stamps actor and instant at creation; copies attestations out of storage rather than handing the live object out.                                                                             |
| `src/lib/caring-contacts/db/postgres-repository.ts`                            | Inserts the rows inside the create transaction; a third grouped read for `listPlans`; `readPlanRecord` widened so the compiler forced every `toPlanRecord` call site.                         |
| `caring-contacts/supabase/migrations/0006_caring_contacts_plan_assurances.sql` | **New.** The table, its closed check, its composite same-team foreign key, RLS, narrow grants, and the audit guard.                                                                           |
| `src/app/api/caring-contacts/plans/route.ts`                                   | The `.strict()` schema gains `assurances`, built **from** `PLAN_ASSURANCES` rather than restated.                                                                                             |
| `src/components/caring-contacts/workspace/plan-wizard/plan-activation.ts`      | `planAssurancesFrom`, `everyAssuranceConfirmed`, and the request body.                                                                                                                        |
| `src/components/caring-contacts/workspace/plan-wizard/plan-wizard.tsx`         | The four wording sites, plus stage 1's gate now calling the shared predicate.                                                                                                                 |
| `src/components/caring-contacts/workspace/plan-wizard/plan-draft.ts`           | The doc comment that said the confirmations are recorded nowhere.                                                                                                                             |
| `src/lib/caring-contacts/simulation.ts`                                        | Attests what a real sign-up attests.                                                                                                                                                          |
| `tests/helpers/caring-contacts-repository-contract.ts`                         | The new behaviour, in the shared suite both stores run.                                                                                                                                       |
| `tests/caring-contacts-domain-isolation.test.ts`                               | Two offline source scans (below).                                                                                                                                                             |
| `tests/caring-contacts-migrations.test.ts`                                     | Column shape, closed value set, cross-team refusal.                                                                                                                                           |
| `tests/caring-contacts-plan-wizard.dom.test.tsx`                               | The four screens, each with its overshoot pin.                                                                                                                                                |
| `tests/helpers/caring-contacts-postgres.ts`                                    | `plan_assurances` joins the truncate list.                                                                                                                                                    |
| Six other test files                                                           | `CreatePlanInput` / `PlanRecord` fixtures the compiler forced.                                                                                                                                |

---

## Ruling [122], as three decisions

### 1. On the PLAN, and specifically on `PlanRecord`

`PlanRecord`, not `StoredPlan`. That needs its own justification, because
`PLAN_RECORD_HOLDS_NO_FIRST_CONTACT_REASON` exists to keep something **off** that shape.

The reason that guard exists is what the first-contact reason **contains** — prose a clinician typed
about a patient, fetched for every patient in the team on every render of a caseload. Apply the same
test to an attestation and it comes out the other way: a closed enum value, an actor id and an
instant, no patient content at all. Judging by content rather than by category is the rule
Ruling [105] itself used, and it is the rule I used here.

The alternative — `StoredPlan` beside `patientDetail` — would have made it releasable only through
`getEpisode`, which returns `Episode`. That meant adding it to `Episode` **and** deciding what
`DeidentifiedEpisode` does with it: a wider change for a worse read.

**The cost is real and stated rather than buried:** the Postgres `listPlans` now runs a third grouped
query. One round trip per kind of row, not one per row — the same argument `listPatientNames` makes
for being a list.

### 2. A list over a closed vocabulary, not two fields

`CreatePlanInput.assurances` is `readonly PlanAssurance[]`. Adding a third confirmation is a value in
`PLAN_ASSURANCES`, a value in the migration's check constraint, and a checkbox — not a schema change.

Two named refusals guard it, and both refuse rather than silently repair:

- `plan-assurances-required` — an empty list. Refused rather than accepted-and-empty, because a plan
  holding an empty list is afterwards indistinguishable from one created before attestations existed,
  and `createPlan` is the write that decides which of those a new plan is.
- `plan-assurance-repeated` — the same assurance twice. Refused rather than de-duplicated, following
  Ruling [106]'s stance on the first-contact reason: a store that silently collapses a caller's list
  records something the caller did not send. It also keeps the two stores honest, since the Postgres
  table is keyed on `(plan_id, assurance)` and would have thrown where the map would have kept both.

`admitPlanAssurances` lives on the contract, not in either store, for the reason
`CLEARED_PATIENT_DETAIL` does: it is a rule about what a plan **means**.

**It deliberately does not decide WHICH assurances are required.** That belongs to the screen that
asks, and the design's assurance set is not frozen. The screen's rule is `everyAssuranceConfirmed`,
declared once in the wizard with two callers.

### 3. Retention must NOT clear it — pinned in both directions

`markRetentionCleared` does not touch the attestation in either store. The in-memory clearance
spreads `CLEARED_PATIENT_DETAIL` over `patientDetail` alone; the Postgres clearance names its columns
and the attestation lives in another table.

The shared contract suite holds **two cases, deliberately not one**:

- `survives a retention clearance, which must not remove evidence that a check happened`
- `does not stop that clearance removing what it is supposed to remove`

The second is the one the brief insisted on and it is not redundant: the first passes just as well
against a clearance that has stopped working entirely, because an attestation left alone by a write
that does nothing looks exactly like one left alone on purpose.

Two further offline guards hold the property where no database is available — the case in which its
absence would be silent:

- the Postgres store carries **no amend and no delete path** for an attestation;
- the migration's check constraint lists exactly the values `PLAN_ASSURANCES` declares.

---

## The four screens

Each was true when written and became false. Each now keeps a pin against the **opposite** error,
which is new: before this task there was no record at all, so "the plan records the patient's
consent" was not a sentence anyone could write. It is now.

| Site                         | Was                                                                                                     | Is                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stage 1 panel                | "nothing in this domain records either of them … the plan that is created carries no field for them"    | "What the plan records is that you confirmed each of these, and when — not that the patient consented. Agreement is held in the patient's hospital record; what you are confirming here is that you checked it." |
| Stage 1 status line          | "Neither is recorded on the plan; like everything else on this screen, they are kept on this computer…" | "Each is recorded on the plan when the plan is created — that you confirmed it, and when. Until then, like everything else on this screen, they are kept on this computer until you finish or discard."          |
| Stage 4 review (`because`)   | "…they are not recorded on the plan — nothing in the plan being created has a field for either."        | "Creating the plan records each of those on the plan as your confirmation, with who you are acting as and the time. What is recorded is that you confirmed the patient agreed — not the agreement itself…"       |
| Stage 4 review (`changedBy`) | "What the plan records is not changed by it either way."                                                | "…and so changes what the plan will record."                                                                                                                                                                     |

The status line keeps round 2's pin (`not.toMatch(/stored anywhere|kept anywhere/i)`) unchanged: this
task did not stop the ticks being held in the tab, and the shared-ward-computer argument for pointing
at Discard draft is untouched.

`plan-draft.ts`'s type comment said the same thing and was found by reading every doc comment in the
touched files rather than by grepping the screen phrase — the scope rule, and it found the fifth site
the brief's four did not name.

---

## A decision the brief did not name, which I took and am flagging

**Stage 4 now refuses to build a create body unless every stage-1 confirmation is made.**

Before this task, a draft restored from a tab's storage sitting at stage 4 with one tick missing
changed nothing about the plan — nothing was recorded either way. It does now: such a draft would
create a plan attesting one confirmation that had never passed stage 1's gate. The domain's own rule
stays "at least one, no repeats"; the screen's rule lives in `everyAssuranceConfirmed`, which stage
1's Continue control and stage 4's body builder both call.

Conservative — a plan that cannot honestly be created is not created — but it is a behaviour change
on a reachable path, so it is named here rather than folded in.

---

## What I did not conclude

**The attestation carries no free text, and I did not need it to.** The brief said to stop and report
if I concluded otherwise. I did not: what stage 1 collects is two tick-boxes, and the act, actor and
instant are the whole of what they support. The type guard
`PLAN_ASSURANCE_ATTESTATION_HOLDS_ONLY_ACT_ACTOR_AND_INSTANT` stops compiling when a fourth field is
added, so the next person adding one has to read the paragraph and take the decision rather than
inherit the answer — proved by mutation M7.

**No sixth mockup value arriving from a hospital record.** The agreement row's source label
("Imported source record—not legal or treatment consent") describes a record this system reads
nothing from, and the design does not show its content — only that a coordinator confirms it. Same
class as the five already filed, not a new one.

---

## Mutation ledger

Every attempt is itemised, including the ones that never got to run. No total.

| #   | Mutation                                                              | Predicted                                                       | Observed                                                                                                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M7  | `PlanAssuranceAttestation` gains a fourth field `checkedNote: string` | `tsc` red at the `SameUnion` guard                              | **RED**, exactly there: `src/lib/caring-contacts/assurances.ts(88,14): error TS2322: Type 'true' is not assignable to type 'never'`. That line is `PLAN_ASSURANCE_ATTESTATION_HOLDS_ONLY_ACT_ACTOR_AND_INSTANT`. Predicted line, predicted message.                                                                                                  |
| M1  | in-memory `createPlan` stamps `input.patientId` instead of `actor.id` | `records who confirmed, what they confirmed, and when` goes red | **RED.** Mutation present, read back in process rather than through `grep -c`; inner exit `1` on `tests/caring-contacts-repository.test.ts`. The driver was killed before its captured summary flushed, so I have the verdict and not the assertion text. A red proves presence by itself; the failure MESSAGE is unquoted and I am not claiming it. |

**M2, M3, M4, M5, M6, M8, M9, M10, M11 and M12 were written and anchored, and never ran.** They are
not reported as passing, failing, or inconclusive: they did not execute. Each anchor was verified
unique against the committed tree, so a later session can run them without re-deriving them.

| #   | Mutation                                                             | Suite            | Intended target assertion                                                                                                                                                                   |
| --- | -------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2  | `admitPlanAssurances`: `length === 0` becomes `length === -1`        | repository       | `refuses a plan that would carry no attestation, and stores no plan at all`                                                                                                                 |
| M3  | `admitPlanAssurances`: the duplicate branch becomes `if (false)`     | repository       | `refuses a repeated assurance by name, so one check cannot be recorded as two`                                                                                                              |
| M4  | the in-memory clearance also writes `assuranceAttestations: []`      | repository       | `survives a retention clearance, which must not remove evidence that a check happened`                                                                                                      |
| M5  | the in-memory clearance becomes `const cleared = stored`             | repository       | `does not stop that clearance removing what it is supposed to remove` **red** while `survives a retention clearance` stays **green** — the pair's non-redundancy, and the one I most wanted |
| M6  | in-memory `toPlanRecord` returns `assuranceAttestations: []`         | repository       | `reads back through getPlan and through the caseload list alike`                                                                                                                            |
| M8  | the migration's check drops `patient-controls-mobile-confirmed`      | domain-isolation | `keeps the attestation vocabulary identical in the domain and in its SQL check constraint`                                                                                                  |
| M9  | the Postgres clearance deletes from `plan_assurances`                | domain-isolation | `never amends or deletes an attestation from the Postgres store`                                                                                                                            |
| M10 | the stage-1 status line reverts to "Neither is recorded on the plan" | plan-wizard DOM  | `says what the plan will record about the confirmations, and what it will not`                                                                                                              |
| M11 | stage 4's `changedBy` reverts to "not changed by it either way"      | plan-wizard DOM  | `names the plan's record of the confirmations as a confirmation…`                                                                                                                           |
| M12 | `everyAssuranceConfirmed` uses a logical OR                          | plan-wizard DOM  | `will not go to the pathway stage until both confirmations are ticked, and says why`                                                                                                        |

**Why they did not run, stated plainly rather than as an excuse.** One heavy job runs at a time
across every worktree of this repository, and three others (`cc-schedule`, `cc-templates`,
`form-selection`) ran Playwright, lint and Vitest continuously through this session's mutation
window. `run-vitest.mjs` does not fail fast on a busy lease — it QUEUES, so each mutation's suite
blocked inside the child process rather than returning a refusal a retry loop can see. I confirmed my
own entry sat in the lock's `queue/` directory rather than assuming it. I never broke another
worktree's lease, and I stopped the driver and restored the tree rather than risk the session ending
with a mutated source file in place.

**What that means for confidence here, without softening.** The retention pair — requirement 3, the
thing the brief singled out — is written, is green, and is **unproven by mutation**. Green on both
halves is consistent with both being real AND with either being inert. The structural reassurance is
that M5 exists precisely to tell those apart, and M5 is the one I could not run. Treat requirement 3
as implemented and tested but not mutation-proved, and run M4 and M5 first when the machine is quiet.

---

## Gates

Every line below was read from the run's own output. No gate is reported from an exit code.

| Gate                                                         | Result                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p tsconfig.json`                          | Clean, no output, on the final tree and re-run after the last mutation was restored.                                                                                                                                                                        |
| `npx eslint --no-cache <every changed source and test file>` | Clean, no output. `--no-cache` deliberately: the per-file cache does not re-examine a file whose failure was caused by a different file's change.                                                                                                           |
| `npx prettier --check` over every changed file               | `All matched files use Prettier code style!` The `.sql` migration has no Prettier parser, which is a fact about the tool rather than an exemption I chose.                                                                                                  |
| `npm run test:cc-guards`                                     | `Test Files  18 passed (18)` / `Tests  393 passed (393)`, inner exit 0, `GATE_RECEIPTS=refresh`.                                                                                                                                                            |
| `npm run caring-contacts:db:test`                            | `Test Files  2 passed (2)` / `Tests  202 passed (202)` against a real Postgres 17 in Docker. The helper drops the schema and replays every migration, so **0006 is proved to replay from empty**, not merely to apply to an existing local database.        |
| `npm run test` (full offline suite)                          | Ran to completion with exactly one failure, mine, described below. The wrapper's `tail` truncated the summary, so I have the failure text and inner exit `1` but **no quotable `N passed` line for that run** — I am not reporting a number I did not read. |
| `tests/caring-contacts-api-handler.test.ts` after the fix    | `Test Files  1 passed (1)` / `Tests  37 passed (37)`, inner exit 0.                                                                                                                                                                                         |

### Two failures the gates caught that reading had not

Both were mine, and both are why the gates are worth their runtime.

**1. Migration 0006 re-granted on every table, restoring write access to the audit trail.** The first
draft copied 0003's `grant select, insert, update, delete on all tables in schema`. That is safe in
0003 _because 0003 sorts before 0004_, and 0004 then narrows `audit_events` back down with
`revoke update, delete` — its own comment says the replay order is what makes that work. 0006 sorts
AFTER 0004, so the same line silently undid the append-only guarantee and left only a trigger behind
it. Both of 0004's own controls in `caring-contacts-migrations.test.ts` went red. 0006 now grants on
the table it created and nothing else, and grants **SELECT and INSERT only** — the same move 0004
makes, for the same reason. The trap is written into the file so 0007 does not repeat it.

Nothing in typecheck, lint or the offline suite can see this. Only the database suite could.

**2. A POST body predating the schema change turned a 409 privacy assertion into a 400.** The
api-handler case that posts a duplicate plan and asserts the refusal body carries no patient data was
being refused by the schema before it reached the store — so it was asserting a privacy property
about a request the route never carried. Found by the full offline suite.

### Does this touch `tests/ui-caring-contacts-workspace.spec.ts`?

**Probably not, and here is the reasoning rather than a verdict.** That spec reaches no wizard stage —
Task 9's own finding, and the filed browser gap is exactly that the wizard has never been seen in a
browser at any width. Every screen this task changed is inside the wizard. The one way it could bite
is a caseload render, and the Postgres store, where the extra query lives, is not what the browser
gate runs against. **I did not run it and am not claiming it green.**

---

## Concerns, in the order I would want them read

1. **The retention pair is unproven by mutation.** See the ledger. This is the largest gap and it
   sits on the requirement the brief singled out. M4 and M5 are the first thing to run.

2. **`listPlans` grew a query, and Task 12 has just been pointed at it.** Ruling [124], committed to
   this branch while I was working, has Task 12 derive its schedule from `listPlans` rather than
   adding a repository method. That makes the third grouped query slightly more consequential than it
   was when I chose it. It is still the right home for the attestation; the fix if it ever matters is
   narrowing `PLAN_COLUMNS`, which already has its own filed concern, not moving the attestation off
   the record.

3. **The stage-4 gate change.** `createPlanRequestBody` now refuses unless EVERY stage-1 confirmation
   is made, not merely one. Conservative, but a behaviour change on a path a restored draft can
   reach, and not something the brief asked for.

4. **`plan-activation.ts` type-imports from `plan-draft.ts`, which value-imports from it.** A
   type-only cycle, erased at build; `tsc` and `eslint` are both clean on it. I chose it so the
   assurance shape has exactly one declaration. If the repo later adopts `import/no-cycle`, move the
   type rather than drop the import.

5. **Test-first was not followed for the store behaviour.** The types and both stores were written
   before the contract cases. I disclose it as a fact about how this was built rather than as an
   ordering detail — and the mitigation I would normally offer, the mutation ledger, is itself mostly
   unrun.
