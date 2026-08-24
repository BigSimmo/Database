# Task 5b report — the names-only patient projection

**Branch** `claude/browser-test-gate-handoff-d5c1db`, base `e3d1fa6f3`.
**Commits** `85fb6db90` (storage contract + both stores + shared contract suite),
`3450ebcb8` (the Patients directory and its page consuming it),
`897a49fa0` (one test assertion tightened after mutation M7 exposed it — see the ledger).

Status: **complete**. Both stores implement the read, the shared contract holds them to it, the
directory names its rows from it, and `getEpisode` is still never called from this screen with its
spy untouched.

---

## What was built

### `listPatientNames`, on the shared storage contract

`src/lib/caring-contacts/repository.ts` declares:

```ts
export type PatientNameProjection = { planId: PlanId; patientName: string };
listPatientNames(context: ReadContext): Promise<PatientNameProjection[]>;
```

**The shape, and why it is this one.** The brief named three defensible options. This is a plan-keyed
list, chosen for three separate reasons rather than one:

- **Two fields, declared as their own type.** Not a `Pick` of `Episode`, not a `PlanRecord` with the
  other fields blanked. A shape that _could_ hold a mobile number, an identifier list or a cultural
  identity is one edit away from doing so, and it would typecheck, pass every existing test, and
  still be called a names projection. `PATIENT_NAME_PROJECTION_RELEASES_ONLY_THE_NAME` pins the key
  set at compile time, so widening it stops the build rather than passing review.
- **Keyed by plan, not by patient.** The patient detail is held per plan and `markRetentionCleared`
  clears it per plan, so one patient's two episodes can honestly differ — one cleared, one not. A
  patient-keyed map would need an invented rule for which wins. Plan-keyed joins 1:1 onto `listPlans`,
  which is what a caseload renders.
- **A list, not a per-plan lookup.** A caseload costs one round trip rather than one per row, and —
  the part that matters — **this read never takes a plan id at all**, so it cannot become the oracle
  that distinguishes "no such plan" from "another team's plan". A per-plan lookup would have had to
  answer for an id the caller supplied; `getPlan` returns `null` for both cases deliberately, and
  nothing added here weakens that.

**The capability.** Ruling 95 as written: `READ_ACTIONS.patientName` is the **existing**
`viewPatientRecord`. No new action was minted, so `permissions.ts`'s exhaustiveness guard is
untouched and no role's grant had to be decided.

**One thing the ruling did not settle, decided here and flagged for you.**
`PATIENT_NAME_READ_ACTIONS` requires **both** `viewPatientRecord` and `READ_ACTIONS.plan`
(`viewReferral`). Gating on `viewPatientRecord` alone would have been a **widening**, not a
narrowing: the **auditor** role holds `viewPatientRecord` but not `viewReferral`, so today it gets
`[]` from `listPlans` and `null` from `getEpisode` and can obtain no patient's name by any route at
all. A names read on the name capability alone would have handed that role every name the team holds
— from the one change whose whole purpose is to release less. The extra requirement decides the
read's **scope** (it enumerates plans, so it releases a name only for a plan the actor could have
listed — the same "scoped through the plan" rule `listContacts` already follows), not its capability.
No action was minted and the name still travels on `viewPatientRecord` exactly as ruled. **If you
read Ruling 95 as forbidding this too, say so and it comes out in one line** — the contract test that
pins it names the auditor explicitly.

### Both stores

- `in-memory-repository.ts` filters by the same predicate `listPlans` uses, plus the name capability,
  and **builds** the two-field objects rather than deriving them from the stored plan, so no widening
  can ride along in a spread.
- `db/postgres-repository.ts` goes through **`runRead`**, which is what emits
  `set_config('caring_contacts.team_id', …)` and `set local role caring_contacts_app`. Mutation M1
  below removed exactly that and the contract went red on a cross-team read — a `TEAM-SOUTH`
  coordinator saw `TEAM-NORTH`'s patient name. The query names two columns rather than reusing
  `PLAN_COLUMNS`, so the mobile number and the identifier list are never fetched into the process at
  all; the narrowing is in the SQL, not only in the mapping afterwards.

New behaviour lives in `tests/helpers/caring-contacts-repository-contract.ts` — the shared suite both
stores run — not in either store's own file.

### The Patients directory

- Rows are headed by the patient's **name**, with the synthetic identifier kept **beside** it on its
  own line. Two patients can share a name, and the row's detail control is still named
  `The patient record for <synthetic id>`, so its accessible name is unchanged and one row's control
  is still distinguishable from the next.
- When no name comes back — a de-identified episode, or a role that may list plans without holding
  `viewPatientRecord` — the row falls back to the synthetic identifier **and the label above the
  heading says which of the two it is**. The row never presents an identifier as a name. It
  deliberately does not guess _which_ cause applies; the screen is not told.
- An empty name (what both stores write for a cleared one) is treated as "no name held", never as a
  name, and never as a blank heading.
- **Search matches the name as well as the three identifiers**, and stays entirely server-side: still
  an ordinary `method="get"` form, still no client state, still a URL. The screen adds no client
  component. Ruling 13 is untouched.
- The page performs a **third audited read** with its own access identity,
  `{ search, patientDirectory, "names" }`, deliberately not folded into the plans read: this is the
  one read on the page that releases patient identity, and a trail that recorded it as part of a plan
  search could not later answer _who read patients' names, and when_. It fails closed exactly as the
  other two reads do.
- `getEpisode` is still never called, and the spy pinning its absence was not weakened — a new test
  asserts the name renders **and** `getEpisode` was not called, in the same test.

---

## Mutation ledger

Every attempt, including the one that did not go red. Each mutation was applied with an editor,
**proved present with `git diff` before the test was run**, and the test was run as its **own
command** — never chained to the presence check, so a zero grep count could not short-circuit the
run. Reverted after each.

| #   | Mutation                                                                                                                                                       | File                        | Covering test                                                                                                               | Result                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | `runRead(...)` → `pool.withConnection(...)` — removes the RLS preamble                                                                                         | `db/postgres-repository.ts` | contract: _"gives an actor from another team the same empty answer an empty store gives"_                                   | **RED** — `expected [ { planId: 'PLAN-1', … } ] to deeply equal []`. A `TEAM-SOUTH` coordinator read `TEAM-NORTH`'s name.                                                                                                                                   |
| M2  | capability guard made unfireable (`!x` → `x === undefined`)                                                                                                    | `db/postgres-repository.ts` | contract: _"is empty, never a refusal, for a role that may not list plans"_                                                 | **RED** — same assertion shape, auditor received the row.                                                                                                                                                                                                   |
| M3  | `PATIENT_NAME_READ_ACTIONS` reduced to the name capability alone                                                                                               | `repository.ts`             | contract, same test                                                                                                         | **RED** — but on the _constant_ assertion (`expected [ 'viewPatientRecord' ] to include 'viewReferral'`), which aborts the test before the behavioural line. M4 is what proves the behavioural path. Recorded rather than presented as stronger than it is. |
| M4  | `mayReadAll` → `mayReadAny`                                                                                                                                    | `in-memory-repository.ts`   | contract, same test                                                                                                         | **RED** on the behavioural assertion — auditor received the row.                                                                                                                                                                                            |
| M5  | projection maps `patientMobileNumber` into `patientName`                                                                                                       | `in-memory-repository.ts`   | contract: _"releases the patient's name…"_ and _"holds no name for a plan a retention clearance has already de-identified"_ | **RED** ×2 — `expected '+61 491 570 156' to be 'Jordan Nguyen'`.                                                                                                                                                                                            |
| M6  | drop the `patientName !== ""` filter                                                                                                                           | `patients-directory.tsx`    | DOM: _"treats a de-identified plan's empty name as no name held"_                                                           | **RED** — no heading named `patient-plan-1`; the row headed itself with nothing.                                                                                                                                                                            |
| M7  | delete the row's synthetic-identifier line                                                                                                                     | `patients-directory.tsx`    | DOM: _"heads the row with the patient's name, and keeps the synthetic identifier beside it"_                                | **NOT RED.** 28 passed. The assertion read the **row's whole `textContent`**, which the detail control's own label (`Patient record — patient-plan-1`) satisfies on its own — so the line could be deleted entirely and nothing noticed.                    |
| M7b | same mutation, after the assertion was rewritten to read the line itself (`within(row).getByText(/Synthetic identifier: patient-plan-1/)`, commit `897a49fa0`) | `patients-directory.tsx`    | DOM, same test                                                                                                              | **RED** — `Unable to find an element with the text: /Synthetic identifier: patient-plan-1/`.                                                                                                                                                                |
| M8  | remove `name` from the search haystack                                                                                                                         | `patients-directory.tsx`    | DOM: _"matches the search against the name as well as the identifiers"_                                                     | **RED** — no `listitem`; the name search found nothing.                                                                                                                                                                                                     |
| M9  | names read recorded as `{ search, plan, "all" }` — folded into the plans read                                                                                  | `patients/page.tsx`         | page DOM: _"reads the names through their OWN access identity"_ and the failed-attempt test                                 | **RED** ×2.                                                                                                                                                                                                                                                 |
| M10 | `?? []` instead of throwing on a null release                                                                                                                  | `patients/page.tsx`         | page DOM: _"throws rather than rendering a caseload from a names answer that was never given"_                              | **RED** — `promise resolved … instead of rejecting`.                                                                                                                                                                                                        |
| M11 | add `patientMobileNumber: string` to `PatientNameProjection`                                                                                                   | `repository.ts`             | `typecheck`                                                                                                                 | **RED** at the structural guard — `repository.ts(309,14): error TS2322: Type 'true' is not assignable to type 'never'`, plus both store implementations.                                                                                                    |

**No attempt had an anchor that failed to match**; every mutation above was confirmed in the tree by
`git diff` before its test ran. M7 is the one that did not go red, and it is recorded as a finding
rather than smoothed over: it is exactly the failure the brief named — a mutation that changes the
rendered output but no value any assertion reads.

---

## Gates

Pasted lines, not exit codes.

| Gate                                                            | Evidence                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run test`                                                  | `Test Files  828 passed \| 3 skipped (831)` / `Tests  9985 passed \| 74 skipped (10059)`    |
| `npm run typecheck`                                             | `[gate-receipts] recorded a pass for "typecheck:internal" (5289 input files)`               |
| `npm run lint`                                                  | `[gate-receipts] recorded a pass for "lint:internal" (5289 input files)`                    |
| `npm run caring-contacts:db:test` (Postgres, docker on `54329`) | `Test Files  2 passed (2)` / `Tests  182 passed (182)`                                      |
| focused: repository contract (in-memory)                        | `Tests  113 passed (113)`, of which `5 passed \| 108 skipped` under `-t "listPatientNames"` |
| focused: directory DOM                                          | `Tests  28 passed (28)`                                                                     |
| focused: page DOM                                               | `Tests  16 passed (16)`                                                                     |

**`tests/gate-receipts.test.ts` did NOT fail here.** The brief predicted exactly 2 environmental
failures in it (file modes, `chmodSync`); the full run came back with zero failures across 831 files.
Reported as observed rather than as expected.

**One lock refusal, retried rather than reported as red.** A `typecheck` during the mutation pass
returned `DATABASE_HEAVY_RUN_ADMISSION_BUSY` (owner: another worktree running Playwright). That is an
acquisition failure, not a result. The M11 typecheck evidence above was then taken from a direct
`npx tsc -p tsconfig.typecheck.json --noEmit`, a read-only check, and the coordinator-mediated
`npm run typecheck` is the row in the table.

---

## Concerns

1. **The extra `viewReferral` requirement is a judgement call inside Ruling 95's territory** (see
   above). It is the one decision in this task that could reasonably be sent back. It is narrow, it
   is documented at the constant, and reversing it is a one-line change — but it would then hand the
   auditor role an enumeration of every patient name in the team, which I do not believe is what the
   ruling bought.
2. **The row cannot say _why_ it has no name.** "This episode was de-identified" and "your role may
   not see names" arrive at the screen identically — an absent entry. Saying which would require the
   page to compare `listPlans`'s length against `listPatientNames`'s and infer, which is a claim the
   data does not support per row. The row therefore states which kind of thing the heading is and
   nothing more. If a clinician ever needs the distinction, it needs a deliberate answer rather than
   an inference.
3. **`patientDirectory` as the access-trail object type is now used by two different reads** — this
   one and `api/caring-contacts/referrals`'s `GET`, which uses the same type with `objectId: "all"`.
   They are distinguishable by `objectId` (`"names"` vs `"all"`) but not by action name. If the trail
   is ever queried by action name alone, that will read as one surface.
4. **Search now matches a name, and the search term still never reaches the audit trail** — the
   `objectId` is the literal `"names"`, and `ACCESS_OBJECT_ID_PATTERN` would reject a name anyway.
   Worth restating because the search box's reach grew this round while the recorded identifier did
   not, and that is the correct relationship rather than an oversight.
5. **`markRetentionCleared` empties the name and the row falls back silently.** That is right, and it
   means a de-identified episode's row looks exactly like Task 5's row did. Nothing regressed; it is
   simply not visible on the screen that anything was cleared.

## `tests/ui-caring-contacts-workspace.spec.ts` — yes, this could affect it, in two specific places

I did not run it (you own that gate). Where I would look:

- **Any assertion counting or naming rows on `/caring-contacts/patients`.** The visible heading text
  of every row changes from the synthetic identifier to the patient's name whenever the demo store
  holds one, and each row gains one extra `<p>`. A locator matching a row **by its heading text**
  will need the name. Locators keyed on the **detail control** are safe — its accessible name and its
  visible text are byte-identical to before.
- **The search box.** Its `sr-only` label changed from _"Search by synthetic patient, plan or referral
  identifier"_ to _"Search by name, or by synthetic patient, plan or referral identifier"_, and the
  placeholder from `"Synthetic identifier"` to `"Name or synthetic ID"`. A `getByLabel`/
  `getByPlaceholder` locator on either will miss.

Also relevant: the C-1 finding from the Task 5 review — that this spec has never visited
`/caring-contacts/patients` at all. If that is still true at the head you run, the spec will pass
without exercising any of the above, and a green result should not be read as coverage of this
change.
