# Task 9b report — the stage-1 confirmations, recorded as an attestation

**Status:** implemented, gates partially run (the shared heavy-run lease was held by another
worktree for most of this session; see "Gates" below for exactly what ran and what did not).

**Branch:** `claude/browser-test-gate-handoff-d5c1db`, worktree
`.claude/worktrees/browser-test-gate-handoff-d5c1db`. Nothing pushed, no pull request.

---

## What was built

An activated plan now carries evidence that a coordinator confirmed the stage-1 checks. It records
**that a check happened** — who confirmed, what they confirmed, when — and it does **not** record
that the patient consented. Agreement is held in the patient's hospital record, which this system
is not connected to; the coordinator is confirming they checked it.

That distinction is carried in four places rather than only in prose, because prose does not
survive an edit:

- the type name (`PlanAssuranceAttestation`) and the value names
  (`patient-agreement-confirmed`, `patient-controls-mobile-confirmed`) both name the **act**;
- the module header of `src/lib/caring-contacts/assurances.ts` states what it is and what it is not;
- the migration's `comment on table` records the same thing on the schema itself;
- the wizard's four wording sites each keep a **pin against the overshoot** — a screen claiming the
  plan records the patient's consent goes red.

### Files

| File | What changed |
| --- | --- |
| `src/lib/caring-contacts/assurances.ts` | **New.** The closed vocabulary, the attestation type, and a compile-time guard against a fourth field. |
| `src/lib/caring-contacts/repository.ts` | `PlanRecord.assuranceAttestations`, `CreatePlanInput.assurances`, two named refusals, `admitPlanAssurances`, and the note beside `CLEARED_PATIENT_DETAIL` recording what it must never reach. |
| `src/lib/caring-contacts/in-memory-repository.ts` | Stamps actor and instant at creation; copies attestations out of storage rather than handing the live object out. |
| `src/lib/caring-contacts/db/postgres-repository.ts` | Inserts the rows inside the create transaction; a third grouped read for `listPlans`; `readPlanRecord` widened so every `toPlanRecord` call site had to be updated by the compiler. |
| `caring-contacts/supabase/migrations/0006_caring_contacts_plan_assurances.sql` | **New.** The table, its closed check, its composite same-team foreign key, RLS, grants, and the audit guard. |
| `src/app/api/caring-contacts/plans/route.ts` | The `.strict()` schema gains `assurances`, built **from** `PLAN_ASSURANCES` rather than restated. |
| `src/components/caring-contacts/workspace/plan-wizard/plan-activation.ts` | `planAssurancesFrom`, `everyAssuranceConfirmed`, and the request body. |
| `src/components/caring-contacts/workspace/plan-wizard/plan-wizard.tsx` | The four wording sites, plus stage 1's gate now calling the shared predicate. |
| `src/components/caring-contacts/workspace/plan-wizard/plan-draft.ts` | The doc comment that said the confirmations are recorded nowhere. |
| `src/lib/caring-contacts/simulation.ts` | Attests what a real sign-up attests. |
| `tests/helpers/caring-contacts-repository-contract.ts` | The new behaviour, in the shared suite both stores run. |
| `tests/caring-contacts-domain-isolation.test.ts` | Two offline source scans (below). |
| `tests/caring-contacts-migrations.test.ts` | Column shape, closed value set, cross-team refusal. |
| `tests/caring-contacts-plan-wizard.dom.test.tsx` | The four screens, each with its overshoot pin. |
| Six other test files | `CreatePlanInput` / `PlanRecord` fixtures the compiler forced. |

---

## Ruling [122], as three decisions

### 1. On the PLAN, and specifically on `PlanRecord`

`PlanRecord`, not `StoredPlan`. That needs its own justification, because
`PLAN_RECORD_HOLDS_NO_FIRST_CONTACT_REASON` exists to keep something **off** that shape.

The reason that guard exists is what the first-contact reason **contains** — prose a clinician typed
about a patient, fetched for every patient in the team on every render of a caseload. Apply the same
test to an attestation and it comes out the other way: a closed enum value, an actor id and an
instant, with no patient content at all. Judging by content rather than by category is the rule
Ruling [105] itself used, and it is the rule I used here.

The alternative — putting it on `StoredPlan` beside `patientDetail` — would have made it releasable
only through `getEpisode`, which returns `Episode`. That would have meant adding it to `Episode`
**and** deciding what `DeidentifiedEpisode` does with it, a wider change for a worse read.

**The cost is real and is stated rather than buried:** the Postgres `listPlans` now runs a third
grouped query. One round trip per kind of row, not one per row — the same argument `listPatientNames`
makes for being a list.

### 2. A list over a closed vocabulary, not two fields

`CreatePlanInput.assurances` is `readonly PlanAssurance[]`. Adding a third confirmation is a value in
`PLAN_ASSURANCES`, a value in the migration's check constraint, and a checkbox — not a schema change.

Two named refusals guard it, and both are refusals rather than silent repairs:

- `plan-assurances-required` — an empty list. Refused rather than accepted-and-empty, because a plan
  holding an empty list is afterwards indistinguishable from one created before attestations
  existed, and `createPlan` is the write that decides which of those a new plan is.
- `plan-assurance-repeated` — the same assurance twice. Refused rather than de-duplicated, following
  Ruling [106]'s stance on the first-contact reason: a store that silently collapses a caller's list
  records something the caller did not send. It also keeps the two stores honest, since the Postgres
  table is keyed on `(plan_id, assurance)` and would have thrown where the map would have kept both.

`admitPlanAssurances` lives on the contract, not in either store, for the reason
`CLEARED_PATIENT_DETAIL` does: it is a rule about what a plan **means**.

**It deliberately does not decide WHICH assurances are required.** That belongs to the screen that
asks, and the design's assurance set is not frozen. The screen's rule ("every confirmation this
sign-up asks for") is `everyAssuranceConfirmed`, in the wizard, with one declaration and two callers.

### 3. Retention must NOT clear it — and it is pinned in both directions

`markRetentionCleared` does not touch the attestation in either store. The in-memory clearance
spreads `CLEARED_PATIENT_DETAIL` over `patientDetail` alone; the Postgres clearance names its
columns and the attestation lives in another table.

The shared contract suite holds **two cases, deliberately not one**:

- `survives a retention clearance, which must not remove evidence that a check happened`
- `does not stop that clearance removing what it is supposed to remove`

The second is the one the brief insisted on and it is not redundant. The first passes just as well
against a clearance that has stopped working entirely — an attestation left alone by a write that
does nothing looks exactly like one left alone on purpose. Mutation **M5** below demonstrates that
directly: a no-op clearance leaves the first case green and the second red.

Two further offline guards hold the property when no database is available, which is the case where
its absence would be silent:

- the Postgres store carries **no amend and no delete path** for an attestation
  (`never amends or deletes an attestation from the Postgres store`);
- the migration's check constraint lists exactly the values `PLAN_ASSURANCES` declares.

---

## The four screens

Each was true when written and became false. Each now keeps a pin against the **opposite** error,
which is new: before this task there was no record at all, so "the plan records the patient's
consent" was not a sentence anyone could write. It is now.

| Site | Was | Is |
| --- | --- | --- |
| Stage 1 panel | "nothing in this domain records either of them … the plan that is created carries no field for them" | "What the plan records is that you confirmed each of these, and when — not that the patient consented. Agreement is held in the patient's hospital record; what you are confirming here is that you checked it." |
| Stage 1 status line | "Neither is recorded on the plan; like everything else on this screen, they are kept on this computer…" | "Each is recorded on the plan when the plan is created — that you confirmed it, and when. Until then, like everything else on this screen, they are kept on this computer until you finish or discard." |
| Stage 4 review (`because`) | "…they are not recorded on the plan — nothing in the plan being created has a field for either." | "Creating the plan records each of those on the plan as your confirmation, with who you are acting as and the time. What is recorded is that you confirmed the patient agreed — not the agreement itself…" |
| Stage 4 review (`changedBy`) | "What the plan records is not changed by it either way." | "…and so changes what the plan will record." |

The status line keeps round 2's pin (`not.toMatch(/stored anywhere\|kept anywhere/i)`) unchanged:
Task 9b did not stop the ticks being held in the tab, and the shared-ward-computer argument for
pointing at Discard draft is untouched.

`plan-draft.ts`'s type comment said the same thing and was found by reading every doc comment in the
touched files rather than by grepping the screen phrase — the scope rule, and it found the fifth site
the brief's four did not name.

---

## A decision the brief did not name, which I took and am flagging

**Stage 4 now refuses to build a create body unless every stage-1 confirmation is made.**

Before this task, a draft restored from a tab's storage sitting at stage 4 with one tick missing
changed nothing about the plan — nothing was recorded either way. It does now: such a draft would
have created a plan attesting one confirmation that had never passed stage 1's gate. The domain's own
rule stays "at least one and no repeats"; the screen's rule ("all of them") lives in
`everyAssuranceConfirmed` and is what stage 1's Continue control and stage 4's body builder both call.

This is a behaviour change to a path only a restored draft can reach. It is the conservative
direction — a plan that cannot honestly be created is not created — but it is a change, and it is
named here rather than folded in.

---

## What I did not conclude

**The attestation carries no free text, and I did not need it to.** The brief said to stop and report
if I concluded otherwise. I did not: what was collected on screen is two tick-boxes, and the act,
actor and instant are the whole of what they support. The type guard
`PLAN_ASSURANCE_ATTESTATION_HOLDS_ONLY_ACT_ACTOR_AND_INSTANT` stops compiling when a fourth field is
added, so the next person adding one has to read the paragraph and take the decision rather than
inherit the answer — proved by mutation **M7**.

**No sixth mockup value arriving from a hospital record.** The agreement row's source label
("Imported source record—not legal or treatment consent") describes a record this system reads
nothing from, and the design does not show its content — only that a coordinator confirms it. That is
the same class as the five already filed, not a new one.

---

## Mutation ledger

Every attempt is itemised, greens included. No total.

| # | Mutation | Predicted | Observed |
| --- | --- | --- | --- |
| M7 | `PlanAssuranceAttestation` gains `checkedNote: string` | `tsc` red at the `SameUnion` guard | **RED** — `src/lib/caring-contacts/assurances.ts(88,14): error TS2322: Type 'true' is not assignable to type 'never'`. Predicted line and message. |

_Remaining mutations (M1–M6, M8–M12) were planned and are listed below; they need the shared
heavy-run lease, which was held by another worktree for the whole of this session's gate window. They
are NOT reported as run._

| # | Mutation | Intended target assertion |
| --- | --- | --- |
| M1 | in-memory `createPlan` stamps a fixed actor instead of `actor.id` | contract: `records who confirmed, what they confirmed, and when` |
| M2 | `admitPlanAssurances` accepts an empty list | contract: `refuses a plan that would carry no attestation` |
| M3 | `admitPlanAssurances` drops the duplicate check | contract: `refuses a repeated assurance by name` |
| M4 | in-memory `markRetentionCleared` also empties the attestations | contract: `survives a retention clearance` |
| M5 | in-memory `markRetentionCleared` becomes a no-op | contract: `does not stop that clearance removing what it is supposed to remove` **red**, `survives a retention clearance` **green** — the pair's non-redundancy |
| M6 | in-memory `toPlanRecord` returns an empty attestation list | contract: `reads back through getPlan and through the caseload list alike` |
| M8 | the migration's check drops one value | isolation scan: `keeps the attestation vocabulary identical…` |
| M9 | the Postgres store gains `delete from caring_contacts.plan_assurances` | isolation scan: `never amends or deletes an attestation…` |
| M10 | the stage-1 status line reverts to "Neither is recorded on the plan" | wizard DOM: `says what the plan will record…` |
| M11 | stage 4's `changedBy` reverts | wizard DOM: `names the plan's record of the confirmations…` |
| M12 | `everyAssuranceConfirmed` uses `\|\|` | wizard DOM: `will not go to the pathway stage until both confirmations are ticked` |

---

## Gates

- `npx tsc --noEmit -p tsconfig.json` — **clean**, no output, run repeatedly through the change and
  once on the final tree.
- `npx eslint --no-cache <every changed source and test file>` — **clean**, no output. Run with
  `--no-cache` deliberately: the per-file cache would not have re-examined a file whose failure was
  caused by a different file's change.
- `npx prettier --write` over every changed file — applied and committed.
- `npm run test:cc-guards` — **NOT RUN.** Blocked on the shared heavy-run lease, held throughout by
  `D:\Worktrees\Database\form-selection` running `playwright tests/ui-ward-visual-sweep.spec.ts`. A
  polite retry loop is waiting on it; the lease was never broken.
- `npm run test` (full offline suite) — **NOT RUN**, same lease. The first attempt exited with the
  lock's own `EPERM … rename owner.json` while the wrapper printed `[exited with code 0]` — a live
  instance of the trap the standing discipline names, and the reason no gate here is reported from an
  exit code.
- `npm run caring-contacts:db:test` — **NOT RUN.** Needs a local Postgres container. Starting one is
  a local Docker action rather than a provider call, but it was not reachable inside this session's
  window; the migration is therefore **not** yet proved to replay from empty against a real database.
  That is the largest outstanding item and it is a real gap, not a formality: the suite drops the
  schema and replays every migration, so it is the only thing that would catch a syntax error, a
  constraint-name mismatch with the tests, or an RLS/grant omission in 0006.

**No gate is reported as passing here from an exit code, and no `N passed` line is quoted, because
none was produced.**

### Does this touch `tests/ui-caring-contacts-workspace.spec.ts`?

**Probably not, and here is the reasoning rather than a verdict.** That spec reaches no wizard stage —
that was Task 9's own finding, and the filed browser gap is precisely that the wizard has never been
seen in a browser. Every screen this task changed is inside the wizard. The one way it could bite is
if the spec renders a caseload that now issues a third query in the Postgres store; that store is not
what the browser gate runs against. I did not run it and am not claiming it green.

---

## Concerns, in the order I would want them read

1. **The Postgres half is unproven against a real database.** Typecheck and lint cannot see a SQL
   syntax error, a constraint name my tests grep for that Postgres names differently, or a missing
   grant. `plan_assurances_assurance_check` and `plan_assurances_pkey` are Postgres's own default
   names for an inline column check and a composite primary key — I am confident, not certain, and
   confidence is not evidence.

2. **`listPlans` grew a query.** Correct, stated in the code, and the caseload's cost. If it matters
   it should be a decision about `PLAN_COLUMNS`-style narrowing, which already has its own filed
   concern, rather than a reason to move the attestation off the record.

3. **The stage-4 gate change** described above. Conservative, but a change to a reachable path.

4. **`plan-activation.ts` now type-imports from `plan-draft.ts`, which value-imports from it.** That
   is a type-only cycle, erased at build; `tsc` and `eslint` are both clean on it. I chose it so the
   assurance shape has exactly one declaration. If the repo later adopts `import/no-cycle` it will
   need the type moved rather than the import removed.

5. **Test-first was not followed for the store behaviour.** The types and both stores were written
   before the contract cases. I disclose it rather than describe it as an ordering detail: the
   mitigation is the mutation ledger, and the mutation ledger is mostly unrun.
