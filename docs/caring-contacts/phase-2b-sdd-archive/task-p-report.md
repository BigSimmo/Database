# Task P report — the patient-visible message uses the patient's first name

**Branch** `claude/caring-contacts-message-name`, worktree `D:\Worktrees\Database\cc-message-name`.
Base `1f7be1673`. Nothing pushed, no pull request opened, no subagent dispatched.

## What was built

**The message gained a slot, and the system asks for what goes in it.** Nothing anywhere splits the
stored `patientName`, and every place a later editor might reach for one carries the reason it must
not: a split greets a person with one name by their only name, a person whose family name is written
first by their surname, `Mr John Smith` as "Mr", and a person with two given names by half of them.

| Where                                                          | What changed                                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/caring-contacts/message-policy.ts`                    | New `maxSeptetsWithin(segments)`, so a caller can derive a ceiling from the GSM-7 thresholds instead of writing one down |
| `src/lib/caring-contacts/message-copy.ts`                      | The template, its specimen, the computed cap, and `resolvePatientVisibleMessage`                                         |
| `src/lib/caring-contacts/episode.ts`                           | `Episode.preferredName: string \| null`                                                                                  |
| `src/lib/caring-contacts/repository.ts`                        | `EpisodePatientDetail` widened; `CLEARED_PATIENT_DETAIL.preferredName = ""`                                              |
| `src/lib/caring-contacts/retention.ts`                         | Contract prose corrected; `deidentifyEpisode` drops it by construction                                                   |
| `src/lib/caring-contacts/audit.ts`                             | `preferredName` added to the audit-event denylist                                                                        |
| `src/lib/caring-contacts/in-memory-repository.ts`              | Written at create, projected by `getEpisode`, cleared by the whole-constant spread                                       |
| `src/lib/caring-contacts/db/postgres-repository.ts`            | Written at create, read by `getEpisode` only, cleared by name — all inside `runWrite`/`runRead`                          |
| `caring-contacts/supabase/migrations/0007_…preferred_name.sql` | Nullable, undefaulted, unbackfilled column with a character-length backstop                                              |
| `src/app/api/caring-contacts/plans/route.ts`                   | `preferredName: z.string().min(1).nullable()` inside the `.strict()` object                                              |
| `plan-wizard/patient-detail.ts`                                | Draft field, three named refusals, and the submit-boundary guard                                                         |
| `plan-wizard/plan-draft.ts`                                    | Required on read-back; an older draft is discarded rather than defaulted                                                 |
| `plan-wizard/plan-activation.ts`                               | `CreatePlanRequestBody.patientDetail.preferredName`                                                                      |
| `plan-wizard/plan-wizard.tsx`                                  | The stage-3 field with a persistent hint, and the review-stage read-back row                                             |
| `workspace/patient-overview.tsx`                               | Renders the three states apart — recorded, never held, removed by a clearance                                            |

`EXACT_PATIENT_VISIBLE_MESSAGE` is now `personalisedPatientVisibleMessage(SPECIMEN_PREFERRED_NAME)`
and is byte-identical to the constant that stood there before. Every mockup that renders it is
untouched.

## The length contract

`PREFERRED_NAME_MAX_SEPTETS` is **computed, never a literal**:

```
maxSeptetsWithin(PROVISIONAL_MESSAGE_RULES.maxSegments) - PATIENT_VISIBLE_MESSAGE_BASE_SEPTETS
```

The base is `calculateGsm7(personalisedPatientVisibleMessage("")).septets` — the message with the
slot empty — so the cap moves with the wording. It evaluates to **59 septets** today (the message
with `Rowan` is 252, the empty-slot base is 247, the two-segment ceiling is 306).

`maxSeptetsWithin` deliberately returns `160` for one segment rather than `153 * 1`: the
concatenation header costing the other seven septets exists only once a message is split, and
`153 * segments` would have understated a one-segment budget — quietly, in the safe direction.

**The exact `septets: 252` pin was not deleted; it was superseded by a stronger statement.** 252 was
true of one string. The message is a template now, so the interesting property is not "this string is
252 septets" but "no name this domain accepts can push this message past its ceiling". The
replacement quantifies over every accepted length, and it is tested at both ends: the longest
accepted name lands **exactly on** the 306-septet ceiling (so the cap is maximal, not merely safe),
and one character past it is refused by name. A third case pins that the cap counts **septets rather
than characters**, using the two-septet extension character `€`.

The specimen's own `septets: 252` evidence is still pinned, in
`tests/caring-contact-mockups.dom.test.tsx`, where the claim belongs — that is the string the mockups
render, and it is the surviving evidence that the wording did not change.

## Retention

`preferredName` is Ruling [105]'s class, not Ruling [122]'s: the attestation is preserved because it
holds no patient content, and a name is nothing but patient content. It clears to `""`, matching
`patientName`, and both directions are pinned in the shared contract suite:

- **it is removed** — `tests/helpers/caring-contacts-repository-contract.ts`, "actually removes the
  identifying detail", with a positive control that the name was held right up to the clearance;
- **the clearance still removes everything else** — the existing "does not stop that clearance
  removing what it is supposed to remove" case, which is the half that would catch a clearance that
  had stopped working entirely.

The fixture's preferred name is `"Jordy"` against a patient name of `"Jordan Nguyen"` — **not a
substring, and not reachable by any split**. Had the two overlapped, an implementation that _did_
split would satisfy every assertion about the field, and the `JSON.stringify` absence checks could
not tell the two apart.

**Cleared and never-held stay distinguishable.** `null` means no preferred name is held (a plan that
predates the column, or a caller that supplied none); `""` is the clearance's own value. The Postgres
projection preserves null as null rather than collapsing it, and `patient-overview.tsx` gives each
state its own sentence. Neither sentence names a cause the record cannot support.

## The migration

`caring-contacts/supabase/migrations/0007_caring_contacts_preferred_name.sql`, following `0005`:
`if not exists`, a named check constraint added only when absent, one `begin`/`commit`, no
`CREATE INDEX CONCURRENTLY`, and a `comment on` recording the obligation. **No backfill and no
default** — plans created before this hold no preferred name, and a placeholder (least of all one
derived from `patient_name`) would fabricate a clinical record.

**It is in `caring-contacts/supabase/migrations/`, never the repository root's `supabase/migrations/`.**

Two deliberate differences from `0005`, both stated in the file:

1. **`''` is accepted rather than refused.** In `0005` null means absent and `''` can only be a
   caller's bug. Here `''` is what `markRetentionCleared` writes, exactly as it already does for
   `patient_name`; a constraint refusing it would break de-identification against a real database.
2. **The domain cap is pinned `<=` the SQL literal, not `=`.** `0005` expresses one rule twice in one
   unit, so equality is right there. Here the units differ — the domain caps GSM-7 septets, Postgres
   counts characters — and every character costs at least one septet, so a septet cap of N implies a
   character length of at most N. The constraint can therefore never refuse a name the domain
   accepted; drift can only make it redundant. And the domain cap is _derived_ from provisional
   wording the clinical approval gate is expected to change, so pinning equality would make a wording
   review produce a schema migration. The dangerous direction is still caught: a domain cap above the
   literal would turn a named refusal into a raw constraint violation on a clinical write.

## One decision beyond the brief, recorded so it can be overturned

`resolvePatientVisibleMessage` has a **third** refusal, `preferred-name-not-sendable`, for a name
containing a character outside the GSM-7 alphabet (`Zoë`, `Aroha-Lī`).

I added it because the alternative is worse and silent. Such a name makes the **whole message**
unencodable: `calculateGsm7` reports `valid: false`, and `validateGovernedMessage` checks the segment
ceiling only `if (gsm7.valid)` — so an accepted `Zoë` would produce a message that passes every check
this domain has and still reaches a sender mangled. Refusing at entry, with plain words and the
offending characters named, is the conservative failure; the character set is a fixed telecom
specification, so nothing in the refusal decides anything about the patient.

**It is still a refusal a clinician meets when typing a real person's name, and that is a product
decision, not mine.** If the owner would rather accept the name and fix the encoding path instead,
the change is local: delete the `!nameEvidence.valid` branch in `message-copy.ts` and the two cases
that cover it. I would then recommend `validateGovernedMessage` gain an `invalid-characters` issue
code, because the hole it leaves is real either way.

## The slot's shape, and the Server/Client boundary

The coordinator relayed a constraint from the task wiring the message preview: a Server Component
cannot pass a **function** across the boundary, so the resolved message must be a serialisable value
by the time it reaches a Client Component.

**The shape here already satisfies that, and it was not changed to.** `resolvePatientVisibleMessage`
lives in the sealed domain and is called for its VALUE; what comes back is a plain object holding a
string, or a plain object holding a refusal code. Nothing in this diff passes a function as a prop,
and `EXACT_PATIENT_VISIBLE_MESSAGE` is still a plain string constant, so every screen already
rendering it is untouched.

`message-copy.ts` stays importable from client code — it is pure, with no server-only dependency —
which is what lets `patient-detail.ts` ask it in the browser the same question the submit boundary
asks. That is the one rule not being duplicated, rather than a boundary being crossed.

**What I did NOT do: run a build.** The brief's gate list is `test:cc-guards`, typecheck, uncached
lint and Prettier, and a build is none of them. This diff adds no prop of function type and no value
crossing a boundary that was not already crossing it (`Episode` already reaches
`patient-overview.tsx` carrying `Date`s), so I judge the added boundary risk to be nil — but that is
an assessment, not a check, and this repository has twice shipped Server/Client defects that passed
typecheck and the full unit suite. **The build at the merge point is where that gets confirmed.**

## What a screen must do differently now the slot exists

Nothing renders a personalised message yet, and that is a state the next task inherits rather than a
gap in this one. The rule the slot creates:

- A screen showing the message **in the context of a specific plan or patient** must call
  `resolvePatientVisibleMessage(episode.preferredName)` and render either the resolved text or the
  named refusal. It must never render `EXACT_PATIENT_VISIBLE_MESSAGE` there: that string carries the
  fictional name `Rowan`, and a clinician reading it beside a patient's record would reasonably take
  it for that patient's message.
- A screen showing the wording **as a specimen** — the design-scratch mockups, the review pack —
  keeps rendering `EXACT_PATIENT_VISIBLE_MESSAGE`, and should say the name in it is a fictional
  specimen rather than this patient's.

Today the three mockup screens (`personalisation-screen.tsx`, `product-ui.tsx`,
`review-activation-screen.tsx`) render it under the heading **"Exact patient-visible message"** and
say nothing about the name being a specimen. That was harmless while no plan held a preferred name.
It is still not wrong — those routes 404 in production — but it is exactly the sentence the preview
task must not carry onto a real screen. I have not changed them: they are design scratch, and that
task owns them.

## The cap and the demo seed

The coordinator noted that the demo seed writes the current message into `messageTextByType.standard`
on another branch, and that the bound has to hold for whatever the seed stores too.

`PREFERRED_NAME_MAX_SEPTETS` bounds **this module's template and nothing else** — a cap derived from
one string says nothing about a different one. So the rule is now exported as well as its answer:

```ts
preferredNameMaxSeptets(unpersonalisedText: string): number;
```

`PREFERRED_NAME_MAX_SEPTETS` is that function applied to this template, pinned by a test, so the
general rule and the specific number cannot disagree. At merge, if the seed's stored text gains the
same slot, ask `preferredNameMaxSeptets` for ITS cap rather than reusing this one — and where two
texts of different lengths are both substituted from one field, the effective cap is the smaller,
because one accepted name has to fit both.

## Mutation ledger

Every row is one mutation, applied to a committed tree, presence checked by byte equality read
in-process (never through a shell), the worktree asserted clean on both sides, and reverted with
`git checkout --` before the next ran. `present` is that byte-equality check; `attempt` is which
lease attempt actually ran, so a queued row is visible rather than averaged away. The driver refuses
above all file I/O: a containment allowlist of explicit paths, id uniqueness checked before any row
runs, and a no-op check that the replacement really changes the file. Both lock-refusal shapes are
detected — the one that prints `DATABASE_HEAVY_RUN_ADMISSION_BUSY` and the one that throws with no
marker — and a run with no `Test Files` summary line is recorded UNRUN whatever its exit code.

| id     | mutation                                                         | predicted | observed  | present | attempt | summary                    |
| ------ | ---------------------------------------------------------------- | --------- | --------- | ------- | ------- | -------------------------- |
| `M1`   | widen `PREFERRED_NAME_MAX_SEPTETS` by one septet                 | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M2`   | stop refusing an over-long preferred name                        | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M3`   | template ignores the slot and hardcodes the specimen name        | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M4`   | break the one-segment branch of `maxSeptetsWithin`               | **GREEN** | **GREEN** | true    | 1       | `Test Files  1 passed (1)` |
| `M5`   | clearance leaves the preferred name in place                     | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M6`   | Postgres clearance keeps a preferred name it already holds       | RED       | **RED**   | true    | 10      | `Test Files  1 failed (1)` |
| `M7`   | add `preferred_name` to the list read's column set               | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M8`   | drop the SQL backstop below the domain cap                       | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M9`   | accept a stored draft with no preferred name                     | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M10`  | submit boundary stops refusing an unusable name                  | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M11`  | stage 3 stops reporting the preferred name's refusals            | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M12`  | prefill the preferred-name field from the patient's name         | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M13`  | collapse a cleared preferred name into the never-held wording    | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M14`  | drop the preferred name from the audit-event denylist            | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M15`  | derive the preferred name by splitting the stored patient name   | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M16`  | stop refusing a name outside the GSM-7 alphabet                  | RED       | **RED**   | true    | 1       | `Test Files  2 failed (2)` |
| `M18`  | create writes an empty preferred name instead of the caller's    | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M19`  | Postgres create never writes the preferred name                  | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M20`  | Postgres read collapses a never-held name onto the cleared value | RED       | **GREEN** | true    | 1       | `Test Files  1 passed (1)` |
| `M20b` | the same mutation, re-run against the case `M20` forced          | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |
| `M21`  | cap rule ignores the text it is given                            | RED       | **RED**   | true    | 1       | `Test Files  1 failed (1)` |

Four rows are worth reading rather than counting.

**`M4` is an over-sensitivity control, and it went GREEN as predicted.** `maxSeptetsWithin` returns
160 for one segment rather than `153 * 1`, and nothing calls it with 1 today, so breaking that branch
changes no value any assertion reads. It is in the ledger because a mutation that SHOULD leave a gate
green is evidence too — and because that branch is therefore honestly unproven, held by its own
reasoning and not by a test.

**`M20` is the one prediction that was wrong, and it found a real gap.** I predicted RED; it went
GREEN. Collapsing the Postgres read's `null` onto the cleared `""` left every suite passing, because
no fixture anywhere builds a plan row without a preferred name — that row is a plan created BEFORE
migration 0007, which deliberately backfilled nothing, so it exists in a live database and in no
test. The distinction the whole "cleared versus never held" requirement rests on was unproven at the
one layer that reads it out of a real column. A case was added that makes the row directly, and
`M20b` is the same mutation re-run against it: RED.

**`M11` is coarser than one assertion.** It disables the whole preferred-name reporting block in
`personalisationIssues`, so it reddens the field-order case and both cap cases together. The three
refusals underneath are separately mutated at their source — `M2` for too-long, `M16` for
not-sendable, and the not-recorded case at the submit boundary by `M10` — so the coarse row is not
the only evidence for any of them.

**One driver defect, found and corrected rather than worked around.** The first run threw
`spawnSync git ENOENT`, and the obvious reading — "this process does not inherit the shell's PATH" —
was false; a bare `git` resolves fine. The real cause was the driver's `ROOT`, written as
`"D:\Worktrees\..."` into a heredoc that collapsed the doubled backslashes, so JavaScript read `\W`,
`\D` and `\c` as their bare letters and the working directory became
`D:WorktreesDatabasecc-message-name`. `spawnSync` reports a missing cwd as ENOENT **on the file**,
which is what sent the first diagnosis the wrong way. It threw at the cleanliness check, before
touching any file — the intended order. The wrong explanation is recorded in the driver beside the
fix, because the next reader would otherwise inherit it.

## Verification

Gates run on the final tree. Every lock refusal is recorded as UNRUN and retried; nothing was forced.

<!-- GATE EVIDENCE -->

## Concerns and follow-ups

1. **The non-sendable refusal is a product decision I made.** See the section above. A clinician
   typing `Zoë` is told the channel cannot carry it. I believe refusing beats emitting a message that
   arrives damaged, and the alternative leaves `validateGovernedMessage` unable to see the problem at
   all — but the owner should confirm it, and the reversal is two files.

2. **The preferred name is REQUIRED at stage 3, and that is also mine.** The domain allows `null`
   (a caller may hold no preferred name, and every pre-0007 plan does); the wizard does not, because
   a plan created there exists to send messages and the message opens with this name. If the owner
   wants a clinician able to proceed without it, `createPlanPatientDetail` and `personalisationIssues`
   are the two places, and the message resolver then refuses at send time instead — which is later
   and less useful, but not unsafe.

3. **`parseDraft` now discards a draft written before this field existed**, taking the patient's name
   and mobile number with it. That follows the module's own stated rule, and the alternative is a
   silently defaulted blank that is indistinguishable from a clinician who deliberately left it empty.
   The cost is a clinician retyping three fields once, in a tab open across a redeploy.

4. **The demo seed reconciliation is not done and is not mine** (brief). `messageTextByType.standard`
   on the seed branch holds a copy of the current message; once the wording gains a slot there, its
   cap must come from `preferredNameMaxSeptets` applied to that text.

5. **`maxSeptetsWithin`'s one-segment branch is unproven** (`M4`). Nothing calls it with 1 today. It
   is right, and it is held by reasoning rather than by a test.

6. **A build has not been run.** Assessed as nil added Server/Client boundary risk, not checked. See
   the boundary section.

7. **The mockup preview screens now need the specimen said out loud.** Not a defect today, and not
   mine to change; written up above so the preview task inherits it rather than guessing.
