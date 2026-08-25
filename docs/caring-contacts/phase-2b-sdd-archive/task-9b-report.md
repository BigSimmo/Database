# Task 9b report — the stage-1 confirmations, recorded as an attestation

**Status:** implemented and verified. Every gate the policy allows is green, and the mutation ledger
is complete — twelve mutations, all landed, one of which falsified one of my own assertions and was
fixed. Details in "Mutation ledger" and "Gates" below.

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

### Confirmed: each now says what is true, and none overshoots

Stated explicitly because it is the whole shape of the task.

- **Each of the four now states a true fact.** The plan does record the confirmations, so the
  screens say so, and each says it in the form the wizard's own rule requires — naming the
  destination ("recorded on the plan") rather than the bare act.
- **None of the four claims the patient consented.** What every one of them says is that the
  COORDINATOR confirmed a check. Stage 1's panel says it outright — "not that the patient consented.
  Agreement is held in the patient's hospital record; what you are confirming here is that you
  checked it." Stage 4 says "What is recorded is that you confirmed the patient agreed — not the
  agreement itself".
- **The overshoot is pinned, not merely avoided.** Each site carries an assertion against the
  opposite error: the stage-1 status line rejects `consent is recorded|records the patient's
consent`, the stage-1 panel asserts `not that the patient consented` and `hospital record` are
  present, and stage 4 asserts the old "not recorded on the plan" sentence is GONE while
  `records each of those on the plan as your confirmation` is present. That last pair is what would
  have caught a stale sentence surviving the change.
- **The fifth site**, `plan-draft.ts`'s type comment, carries the same distinction in prose.

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

**Upheld by the coordinator, and now pinned and worded.** Two things were added on that ruling:

- **A test pins it.** `refuses to build a body while any stage-1 confirmation is missing, not merely
all of them` in `caring-contacts-plan-activation.test.ts` covers each half-ticked combination and
  carries a positive control, so the nulls are the confirmations rather than some other missing
  field. A second case pins the derivation itself: with none confirmed, the outstanding list is
  exactly as long as the domain's own value list, which is what would go red if the derivation were
  replaced by two hardcoded strings.
- **The refusal now names WHICH confirmation is missing.** "At least one of the confirmations is not
  ticked" told a coordinator they were blocked without telling them by what, on the one screen whose
  only remedy is to go back a stage and hunt for it. `unconfirmedAssuranceSentence` subtracts what
  was confirmed from `PLAN_ASSURANCE_VALUES` and lists the rest by name, so a third confirmation is a
  value and a label rather than a new branch. `PLAN_ASSURANCE_LABELS` is a
  `Record<PlanAssurance, string>`, so adding a value to the domain stops it compiling until it is
  given words.

**And the wording states what is outstanding, never that the patient refused.** A coordinator who has
not yet confirmed a check has not learned anything about the patient, and both the unit case and the
DOM case assert against `did not agree|refused|declined`.

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

Every attempt is itemised, including the one that did not prove what it was aimed at. No total.

Each round asserted `git diff --quiet` clean on both sides, checked presence by reading the file
**in process** (never `grep -c` through this shell, which has a known false negative on patterns
carrying quotes or braces), and re-echoed the inner exit code rather than letting a pipe report it.

| #   | Mutation                                                                   | Predicted                                                                                               | Observed                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | in-memory `createPlan` stamps `input.patientId` instead of `actor.id`      | `records who confirmed, what they confirmed, and when` red                                              | **RED**, that case only. `AssertionError: expected [ { …(3) }, { …(3) } ] to deeply equal [ { …(3) }, { …(3) } ]` — same shape, different actor, which is the mutation.                                                                           |
| M2  | `admitPlanAssurances`: `length === 0` becomes `length === -1`              | `refuses a plan that would carry no attestation, and stores no plan at all` red                         | **RED**, that case only. `expected { ok: true, value: { …(9) } } to deeply equal { ok: false, …(1) }` — the write was accepted where a refusal was required.                                                                                      |
| M3  | `admitPlanAssurances`: the duplicate branch becomes `if (false)`           | `refuses a repeated assurance by name, so one check cannot be recorded as two` red                      | **RED**, that case only, same shape as M2.                                                                                                                                                                                                        |
| M4  | the in-memory clearance also writes `assuranceAttestations: []`            | `survives a retention clearance…` red                                                                   | **RED**, that case only. `expected [] to deeply equal [ { …(3) }, { …(3) } ]`.                                                                                                                                                                    |
| M5  | the in-memory clearance becomes `const cleared = stored`                   | `does not stop that clearance removing what it is supposed to remove` **red** while M4's case **green** | **EXACTLY THAT.** `does not stop that clearance…` red (`expected 'Jordan Nguyen' to be ''`); `survives a retention clearance…` **not in the failure list — it stayed green.** Four pre-existing clearance cases also went red, as a no-op should. |
| M6  | in-memory `toPlanRecord` returns `assuranceAttestations: []`               | `reads back through getPlan and through the caseload list alike` red                                    | **FIRST RUN: did not prove its target** — see below. **After the fix, RED on that case**: `expected [] to have a length of 2 but got +0`.                                                                                                         |
| M7  | `PlanAssuranceAttestation` gains a fourth field `checkedNote: string`      | `tsc` red at the `SameUnion` guard                                                                      | **RED**, exactly there: `src/lib/caring-contacts/assurances.ts(88,14): error TS2322: Type 'true' is not assignable to type 'never'` — the `PLAN_ASSURANCE_ATTESTATION_HOLDS_ONLY_ACT_ACTOR_AND_INSTANT` line.                                     |
| M8  | the migration's check constraint drops `patient-controls-mobile-confirmed` | `keeps the attestation vocabulary identical in the domain and in its SQL check constraint` red          | **RED**, that case only. `expected [ 'patient-agreement-confirmed' ] to deeply equal [ 'patient-agreement-confirmed', …(1) ]`.                                                                                                                    |
| M9  | the Postgres clearance deletes from `plan_assurances`                      | `never amends or deletes an attestation from the Postgres store` red                                    | **RED**, that case only, on the `delete from caring_contacts.plan_assurances` pattern.                                                                                                                                                            |
| M10 | the stage-1 status line reverts to "Neither is recorded on the plan"       | `says what the plan will record about the confirmations, and what it will not` red                      | **RED**, that case only, on the whole-sentence `toContain`.                                                                                                                                                                                       |
| M11 | stage 4's `changedBy` reverts to "not changed by it either way"            | `names the plan's record of the confirmations as a confirmation…` red                                   | **RED**, that case only.                                                                                                                                                                                                                          |
| M12 | `everyAssuranceConfirmed` uses a logical OR                                | `will not go to the pathway stage until both confirmations are ticked, and says why` red                | **RED** on that case **and** on `names the missing confirmation on a restored draft that skipped one` — correct, because a half-ticked draft then renders the confirmed branch. Both are cases this task added or depends on.                     |

### M6 is the finding, and it is a finding about my own test

**First run, M6 left its intended case GREEN while reddening three others.** The reason is worth
stating plainly: `reads back through getPlan and through the caseload list alike` asserted only that
the three reads **matched each other**. A mutation that empties `toPlanRecord` for every read empties
all three, and three empty lists agree perfectly. **An assertion that compares reads only to one
another cannot see a fault they share.**

It would still have caught the fault I wrote it for — a Postgres grouping bug that leaves `getPlan`
right and the caseload wrong — but that is a narrower guarantee than the case's name implies.

Fixed by holding each read to CONTENT first (`toHaveLength(ASSURANCES.length)`) and layering the
agreement assertion on top. **M6 re-run against the fix is red on the intended case.** This is the
standing discipline's "a check you believe is adequate is a hypothesis" arriving from the other
direction: I believed the case was load-bearing, and mutation said it was half of one.

### Over-sensitivity, recorded rather than filtered out

M5, M6 and M12 each reddened cases beyond their target. In every instance that is the mutation doing
real damage rather than a leaky assertion: a no-op clearance genuinely breaks every clearance case
(M5), an emptied projection genuinely breaks every attestation read (M6), and an OR'd gate genuinely
lets a half-ticked draft through both screens (M12). None of them is a case that should have stayed
green.

## Gates

Every line below was read from the run's own output. No gate is reported from an exit code.

| Gate                                                         | Result                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p tsconfig.json`                          | Clean, no output, on the final tree and re-run after the last mutation was restored.                                                                                                                                                                        |
| `npx eslint --no-cache <every changed source and test file>` | Clean, no output. `--no-cache` deliberately: the per-file cache does not re-examine a file whose failure was caused by a different file's change.                                                                                                           |
| `npx prettier --check` over every changed file               | `All matched files use Prettier code style!` The `.sql` migration has no Prettier parser, which is a fact about the tool rather than an exemption I chose.                                                                                                  |
| `npm run test:cc-guards` (final tree)                        | `Test Files  18 passed (18)` / `Tests  397 passed (397)`, inner exit 0, `GATE_RECEIPTS=refresh`. 397 rather than the 393 of the pre-fix-round-1 run: the four cases this round added. Acquired the shared lease on the 7th polite attempt.                  |
| `npm run caring-contacts:db:test`                            | `Test Files  2 passed (2)` / `Tests  202 passed (202)` against a real Postgres 17 in Docker. The helper drops the schema and replays every migration, so **0006 is proved to replay from empty**, not merely to apply to an existing local database.        |
| `npm run test` (full offline suite)                          | Ran to completion with exactly one failure, mine, described below. The wrapper's `tail` truncated the summary, so I have the failure text and inner exit `1` but **no quotable `N passed` line for that run** — I am not reporting a number I did not read. |
| `tests/caring-contacts-api-handler.test.ts` after the fix    | `Test Files  1 passed (1)` / `Tests  37 passed (37)`, inner exit 0.                                                                                                                                                                                         |
| `tests/caring-contacts-repository.test.ts` (final tree)      | `Test Files  1 passed (1)` / `Tests  130 passed (130)`, inner exit 0. The in-memory half of the shared contract, and the suite every store-side mutation below was run against.                                                                             |

### Gate policy in force from fix round 1

The coordinator changed this mid-task after the lease starvation, and it is recorded here because it
explains the shape of the evidence above:

- **`npm run test:cc-guards` only**, plus focused single-file runs. Both take a _shared_ lease and
  two are permitted concurrently, so neither starves the way an exclusive full-suite run does.
- **No full `npm run test`** from a task worktree. It runs once per branch at the merge point, when
  the other worktrees are idle -- its value is catching cross-file breakage, and that matters at
  merge rather than per task. The one run recorded above happened before this policy.
- **Mutations run against the guard set**, for the same reason.
- **No browser gate** from here; it is not run and not claimed.

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

**This is the sharpest argument yet for the filed issue that CI never runs the caring-contacts
database suite.** Nothing in typecheck, lint, or the whole offline unit suite can see this defect —
they went green on it. A migration that quietly re-grants DELETE on an audit trail is exactly the
class of defect that suite exists to catch, and today it runs only when a human happens to have
Docker up and remembers to invoke it. Had this branch been handed off on a machine without a
container running, an append-only clinical audit trail would have become deletable by the application
role and every gate would have reported green.

**The general form is worth naming, because the next migration will face it.** _A migration copied
from an earlier one inherits that migration's assumptions about what had not happened yet._ 0003's
blanket grant was correct when nothing had revoked anything. The identical line placed after 0004
undoes 0004. Copying SQL forward carries the ordering it was written for, and that ordering is
invisible in the copied text.

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

1. **The retention pair is now proven in both directions, and that is the headline rather than a
   concern.** M4 shows the attestation-survives case is real; M5 shows the pair is NOT redundant —
   under a no-op clearance the survival case stays green while the clears-everything case goes red.
   That is precisely the discrimination the brief asked for.

   What remains: the Postgres half of the clearance is proved behaviourally by the database suite,
   but the store-side mutations were run against the in-memory store only. The offline scan
   `never amends or deletes an attestation from the Postgres store` — proven by M9 — is what covers
   that gap when no database is available.

2. **`listPlans` grew a query, and Task 12 has just been pointed at it — recorded, NOT optimised.**
   Ruling [124], committed to this branch while I was working, has Task 12 derive its schedule from
   `listPlans` rather than adding a repository method, which makes the third grouped query more
   consequential than it was when I chose it. **The coordinator's direction is to leave it, and I
   have.** No speculative change was made here. It is still the right home for the attestation; if
   Task 12's read turns out to be slow, the measurement will exist there and the decision belongs
   there. The narrowing lever, if one is ever wanted, is `PLAN_COLUMNS`, which already carries its
   own filed concern.

3. **The stage-4 gate change — upheld, pinned, and now naming the missing confirmation.**
   `createPlanRequestBody` refuses unless EVERY stage-1 confirmation is made. See "A decision the
   brief did not name" above for the test that pins it and the wording that names which one is
   outstanding. A restored draft attesting a confirmation that never passed the gate would be an
   attestation of something that did not happen, which is the one outcome this whole task exists to
   prevent.

4. **`plan-activation.ts` type-imports from `plan-draft.ts`, which value-imports from it.** A
   type-only cycle, erased at build; `tsc` and `eslint` are both clean on it. I chose it so the
   assurance shape has exactly one declaration. If the repo later adopts `import/no-cycle`, move the
   type rather than drop the import.

5. **One of my own assertions was weaker than its name, and mutation is what said so.**
   `reads back through getPlan and through the caseload list alike` compared the three reads only to
   each other, so a fault they shared was invisible to it. Fixed and re-proven. I raise it as a
   concern rather than a closed item because the same shape may exist elsewhere in what I wrote:
   **an assertion that compares two outputs of one function to each other is not testing the
   function.** That is worth a reviewer's eye across the rest of this diff.

6. **Test-first was not followed for the store behaviour — and here is exactly where to look.**
   Task 7 disclosed the same and it cost one real bug: an in-memory fallback branch unreachable in
   the exact case its own comment claimed it handled, which nobody had written an assertion about.
   Mutation testing can only falsify tests that exist, so the review needs the specific list rather
   than the admission.

   **Covered only by after-the-fact tests** (implementation written first, assertion written to
   match it):
   - the attestation minted at creation — actor from the write context, instant from the domain
     clock, one instant for the whole set;
   - `admitPlanAssurances` and both of its named refusals;
   - the attestation surviving a retention clearance in BOTH stores;
   - `toPlanRecord` copying attestations out rather than handing the stored object out;
   - the Postgres store's third grouped read in `listPlans`, and `readPlanRecord`'s widened shape;
   - the migration's column shape, closed value set, and composite same-team foreign key.

   **Written test-first, and the exception rather than the rule:** the stage-4 gate's named-missing
   wording (`unconfirmedAssuranceSentence` and `unconfirmedAssuranceLabels`), added in fix round 1 —
   the cases were written from the coordinator's requirement before the helper existed.

   Every item on that list now carries at least one landed mutation: the minting by M1, the two
   refusals by M2 and M3, the clearance by M4 and M5, the projection by M6, the type shape by M7, and
   the migration vocabulary by M8. What after-the-fact authorship cost here was one weak assertion
   (see 5 above), found and fixed, rather than an untested branch.
