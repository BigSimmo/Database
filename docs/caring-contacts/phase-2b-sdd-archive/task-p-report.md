# Task P report — the patient-visible message uses the patient's first name

**Branch** `claude/caring-contacts-message-name`, worktree `D:\Worktrees\Database\cc-message-name`.
Base `1f7be1673`. Nothing pushed, no pull request opened, no subagent dispatched.

## What was built

**The message gained a slot, and the system asks for what goes in it.** Nothing anywhere splits the
stored `patientName`, and every place a later editor might reach for one carries the reason it must
not: a split greets a person with one name by their only name, a person whose family name is written
first by their surname, `Mr John Smith` as "Mr", and a person with two given names by half of them.

| Where                                                        | What changed                                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/caring-contacts/message-policy.ts`                   | New `maxSeptetsWithin(segments)`, so a caller can derive a ceiling from the GSM-7 thresholds instead of writing one down            |
| `src/lib/caring-contacts/message-copy.ts`                     | The template, its specimen, the computed cap, and `resolvePatientVisibleMessage`                                                    |
| `src/lib/caring-contacts/episode.ts`                          | `Episode.preferredName: string \| null`                                                                                            |
| `src/lib/caring-contacts/repository.ts`                       | `EpisodePatientDetail` widened; `CLEARED_PATIENT_DETAIL.preferredName = ""`                                                        |
| `src/lib/caring-contacts/retention.ts`                        | Contract prose corrected; `deidentifyEpisode` drops it by construction                                                             |
| `src/lib/caring-contacts/audit.ts`                            | `preferredName` added to the audit-event denylist                                                                                  |
| `src/lib/caring-contacts/in-memory-repository.ts`             | Written at create, projected by `getEpisode`, cleared by the whole-constant spread                                                 |
| `src/lib/caring-contacts/db/postgres-repository.ts`           | Written at create, read by `getEpisode` only, cleared by name — all inside `runWrite`/`runRead`                                     |
| `caring-contacts/supabase/migrations/0007_…preferred_name.sql` | Nullable, undefaulted, unbackfilled column with a character-length backstop                                                        |
| `src/app/api/caring-contacts/plans/route.ts`                  | `preferredName: z.string().min(1).nullable()` inside the `.strict()` object                                                        |
| `plan-wizard/patient-detail.ts`                               | Draft field, three named refusals, and the submit-boundary guard                                                                   |
| `plan-wizard/plan-draft.ts`                                   | Required on read-back; an older draft is discarded rather than defaulted                                                           |
| `plan-wizard/plan-activation.ts`                              | `CreatePlanRequestBody.patientDetail.preferredName`                                                                                |
| `plan-wizard/plan-wizard.tsx`                                 | The stage-3 field with a persistent hint, and the review-stage read-back row                                                       |
| `workspace/patient-overview.tsx`                              | Renders the three states apart — recorded, never held, removed by a clearance                                                      |

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
substring, and not reachable by any split**. Had the two overlapped, an implementation that *did*
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
   accepted; drift can only make it redundant. And the domain cap is *derived* from provisional
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

## Verification

Gates run on the final tree. Every lock refusal is recorded as UNRUN and retried; nothing was forced.

<!-- GATE EVIDENCE -->

## Concerns and follow-ups

<!-- CONCERNS -->
