# Care Plan — SDD ledger

**Plan:** `docs/superpowers/plans/2026-08-20-care-plan-implementation.md`
**Spec (binding):** `docs/superpowers/specs/2026-08-20-care-plan-design.md`
**Glossary (binding):** `docs/care-plan-context.md`
**Branch:** `claude/ed-care-plans-impl-7f44cd`
**Worktree:** `D:\Worktrees\Database\care-plan` (relocated 21 Aug 2026 — see Environment hazard)
**Tasks:** 11. Stage A = 1–5 then a mandatory user checkpoint; Stage B = 6–11.

> **Why this file is tracked rather than git-ignored scratch.** The
> `superpowers:subagent-driven-development` skill puts its ledger at
> `.superpowers/sdd/<plan>/progress.md`, git-ignored. That directory was destroyed
> along with the whole worktree on 21 August 2026, taking every ruling, brief,
> report and review package with it. The commits survived because they live in
> the object store. This ledger is therefore committed: the recovery map must not
> live somewhere a cleanup can delete. Reconstructed from the controlling
> session's context and the commit history, both of which agree.

---

## Environment hazard — read before doing anything

`D:\Repos\Database\.claude\worktrees\**` destroyed this task's worktree **three
times on 21 August 2026**, the third time through an explicit `git worktree lock`
and while a task was running. Deletion order observed on the third occasion: the
`.git` pointer file first (making git resolve to the main checkout on the wrong
branch), then a mass delete of 1,420 → 2,388 → 3,836 tracked files over three
minutes.

- **Nothing committed was ever lost.** Git objects live in `D:\Repos\Database\.git\objects`,
  outside any worktree. Every recovery was `git worktree add <path> <branch>`.
- **What was lost each time was uncommitted work and git-ignored scratch** —
  including, on the third occasion, the entire SDD workspace.
- **The work has been relocated to `D:\Worktrees\Database\care-plan`.** That
  parent directory has been untouched all day; a sibling worktree there survived
  all three events.
- The only repo mechanism that removes worktrees is `scripts/clean-worktree.mjs`,
  which is chained into `npm run verify:preflight`. It protects "the current
  worktree", meaning the one it runs in — not this one. It states it never passes
  `--force`, so it does not explain the third deletion through a lock. **The cause
  is not conclusively identified.** Treat the old location as unsafe and do not
  return to it.
- **Commit at the end of every task, without exception.** That rule is what made
  all three recoveries cheap.

---

## Progress

| Task                            | State                      | Commits                | Evidence                                                              |
| ------------------------------- | -------------------------- | ---------------------- | --------------------------------------------------------------------- |
| 1. Domain, fixtures, selectors  | **complete, review clean** | `8a2e6a6d1..8652e73ff` | 58/58 passing, typecheck clean                                        |
| 2. Reducer, provider, lifecycle | **complete, review clean** | `8652e73ff..def541e6a` | 121/121 passing, typecheck + lint clean, 32 mutations / 32 red suites |
| 3. Routes, gate, shell          | **not started**            | —                      | blocked by worktree destruction; no partial work exists               |
| 4–11                            | not started                | —                      | —                                                                     |

Stage A is Tasks 1–5. **Task 5 ends with a mandatory stop for user review** before
Task 6 begins.

### Task 1 — complete

- Dispatched opus. Returned `DONE_WITH_CONCERNS`; three pre-review fix rounds, then
  task review (opus) returned Spec ❌ / Changes needed, then two review fix rounds.
- Final: 58/58 passing, typecheck clean.
- Worktree destroyed twice during this task; implementer recovered it once itself.
  `task-1-brief.md` was destroyed and restored from transcript; the controller
  regenerated it with `scripts/task-brief` and diffed — the restoration matched exactly.

### Task 2 — complete

- Dispatched opus. Returned `DONE_WITH_CONCERNS`; one pre-review fix round, then
  task review (opus) returned Spec ❌ / Changes needed, then one review fix round.
- Final: 121/121 passing across both test files, typecheck exit 0, lint exit 0.
- Implementer proved every refusal guard with deliberate mutations: 32 mutations,
  32 red suites, including both-directions proof for the participation trigger and
  three-way proof (too wide / too narrow / wrong guard) for the print exemption.

### Task 3 — not started

Blocked by the third worktree destruction. No partial work exists; nothing to
reconcile. Restart from the brief unchanged.

---

## Rulings

Every decision taken on the user's behalf. Each says what was decided, why, and
what it costs if wrong.

### Pre-flight scan (before Task 1)

The scan compared every pair of tasks sharing a file or interface, and each task's
text against itself. Six conflicts found, six ruled.

1. **Task 1 creates every type in the Canonical Interfaces block, including the
   patient-plan entities.** Both Task 1 and Task 9 were told to create them; the
   block's own sentence assigns them to Task 1, and two tasks editing the same
   symbols is how parallel definitions get born. _Cost if wrong:_ Task 1's diff is
   larger than its checklist implies.
2. **Task 9 owns all patient-plan fixture data**, including `syntheticResources`.
   Task 1 creates the types only; Task 2 seeds `patientPlans: []`,
   `patientPlanVersions: []`, `patientResources: []`. Authoring that clinical
   content in Task 1 would bury it in a task nobody reads for it. _Cost if wrong:_
   Task 9 carries fixture authoring as well as logic.
3. **Each action joins `CarePlanPrototypeAction` in the task that implements it.**
   Task 2 defines only its own; Task 5 adds `record-management-plan-print-intent`,
   Task 6 adds `record-plan-shared-with-patient`, Task 9 adds the four patient-plan
   actions. The exhaustive switch stays exhaustive at every commit. _Cost if wrong:_
   three later tasks touch two shared files.
4. **Task 1 creates `BANNED_ADMISSION_CONSTRUCTIONS` in `domain.ts`** plus the
   fixture scan. It is a fixture-language rule and Task 1 owns fixture language;
   Task 6 imports it for form validation. _Cost if wrong:_ the constant exists one
   task before its first UI consumer.
5. **Task 4 creates `CurrentPlanSummary` and `PinnedSafetyBoundary` in
   `prototype-ui.tsx`; Task 5 consumes them.** The spec requires the pinned safety
   boundary above all plan content wherever plan content appears, which includes
   the Clinical Snapshot, so one shared component is the only way both surfaces stay
   correct. _Cost if wrong:_ a component is built one task early, against two
   drifting copies of a safety-critical element.
6. **Task 5 may extend `src/components/ui/print-output.tsx` only additively and
   default-off**, must not change rendering for any existing consumer, must carry a
   focused test per capability, and must run the Therapy Compass print tests before
   committing. _Cost if wrong:_ a shared primitive regresses two Therapy Compass
   screens; the required test run is the guard.

### Task 1

7. **The mailto subject kept the old product name — plan defect, fixed.** The
   `ED Care Plans` → `Care Plan` rename replaced the spaced and hyphenated forms but
   not the URL-encoded `ED+Care+Plans`, so the brief pinned a stale string in a
   verbatim test and the implementer correctly followed it. _Cost if wrong:_ none.
8. **`PresentationAmendment.field` widens to `AmendableField` — spec is binding.**
   The grilling round widened the amendable set to disposition, assessment outcome,
   the one-line account and the three plan-use answers, but the canonical type still
   allowed only the first two, so the plan contradicted its own spec. Six values;
   `originalValue`/`replacementValue` stay `string`; the reducer validates that a
   disposition replacement parses. The plan-use answers group in the UI but each
   changed answer records its own attributed amendment. _Cost if wrong:_ Task 7's
   amendment sheet is richer than needed.
9. **Fixture source URLs use organisation roots where no official deep link
   exists — accepted, not a defect.** The implementer declined to invent slugs
   offline, which was right. The controller supplied the verified MHERL and
   Rurallink deep links; `000` stays an organisation root. _Cost if wrong:_ a reader
   navigates one extra step.
10. **The `0491 570 006`–`156` block is the ACMA range reserved for fiction and must
    not be "fixed".** Recorded in the plan so no later task changes it to a
    real-looking but allocatable number. _Cost if wrong:_ none identified.
11. **The rename over-reached and rewrote real identifiers — corrected.** It also
    rewrote the worktree path, this branch name, the Codex planning worktree path
    and `codex/ed-care-plans`, so the plan's first Global Constraint pointed a future
    implementer at a directory that does not exist. Restored, and every `src/`,
    `tests/` and `scripts/` path named in the plan and spec was swept against the
    filesystem — all present except the two SDD skill scripts, which correctly live
    in the skill directory. _Cost if wrong:_ none — verified against the filesystem.
12. **Ruling 10 was right about the range and wrong to assume the fixtures were
    inside it — renumbered.** The implementer checked and found `0491 570 210`–`222`,
    which sit **above** the reserved span and are ordinary allocatable numbers. These
    print onto a patient-facing safety plan. Reallocated to `101/102`, `111/112`,
    `121/122`. _Cost if wrong:_ none — the range is conservative either way.
13. **The fixture also contradicted a value the plan pins three tasks ahead.**
    Task 4's example test pins North River CMHT at `tel:+61491570101`; the fixture had
    `0491 570 210`, so Task 4 would have failed against Task 1's data. The renumbering
    resolved both defects at once. Required a numeric range assertion rather than a
    literal list, so a seventh number added at Task 8 or 9 cannot sit outside the span
    unnoticed. _Cost if wrong:_ none identified.
14. **The renumbering table was wrong to cover the after-hours numbers — reversing
    my own instruction.** The implementer flagged that swapping fictional mobiles into
    `afterHours*` while keeping real crisis-service names would print a fictional
    number under MHERL's name. Its reasoning was right; the instruction was the defect.
    A duty line belongs to a fictional team and must be fictional; the after-hours
    pathway **is** the real public crisis service, and it prints on the patient-facing
    safety plan under "who to call at 2am", so a demo reader who dials it must reach a
    real service. Restored MHERL Perth `1300 555 788` (North River), MHERL Peel
    `1800 676 822` (Coastal Plains), Rurallink `1800 552 002` (Wandoo), keeping the
    not-an-emergency-service caveats and Rurallink's hours. Range test became a numeric
    check for fictional mobiles plus an explicit four-entry allowlist for the public
    lines. _Cost if wrong:_ a fictional directory contains four real public numbers,
    which the spec explicitly permits as the only intentional non-fictional fixtures.
15. **Stored `reviewState` removed from both version types; review state is always
    derived.** `ManagementPlanVersion.reviewState` and
    `PersonalSafetyPlanVersion.reviewState` restated what
    `deriveReviewState(reviewDueAt, now)` computes and could drift, and the
    consistency test covered only Management Plan current versions. Removed the class
    rather than adding the missing test, since nothing consumed the field yet. _Cost
    if wrong:_ Tasks 5 and 8 call `deriveReviewState` at render — a trivial call,
    against a stored indicator that could tell a clinician a plan is current when its
    date says otherwise.
16. **`deriveReviewState` must fail conservatively.** It returned `within_review` for
    an unparseable date because both comparisons were false — a malformed value
    silently producing the most reassuring state on a clinical currency indicator.
    This repo's standing rule is that failure degrades conservatively rather than
    guessing, so it returns `overdue`. _Cost if wrong:_ a plan shows as overdue when
    it is not, which is the safe direction.
17. **The numeric review trigger is compliant but reworded anyway.** "Two or more
    presentations where the plan was recorded as not helpful" prompts review of an
    existing plan rather than creating eligibility, so it does not breach the
    identification-threshold ban — but it was the only number a reader could misread
    as a rule, and fixtures are written to be imitated. _Cost if wrong:_ none.
18. **Fix Evelyn's referral by moving it, not rewording again.** Verified against
    `PROTOTYPE_NOW`: withdrawal 4 July, referral 11 July, only post-withdrawal
    presentation 4 August — 24 days after the referral claimed it happened. Moving
    `referredAt` to `daysAgo(14)` makes the claim true and gives the referral a
    triggering event instead of leaving it floating free. Also required a chronology
    guard, since the count sweep checks how many and never when. _Cost if wrong:_ the
    identification queue's ordering shifts by one position.

### Task 2

19. **`ReviewTrigger.source` gains `"participation"` — the type could not express a
    constraint the spec requires.** Approving at `declined`/`patient_unavailable`
    must raise an open trigger, but the canonical union had no value for it and
    redefining canonical types is forbidden, so the implementer correctly stopped.
    The on-screen marker is not a substitute: a marker is read only by whoever opens
    that plan, whereas a trigger reaches the Reviews queue where somebody owns it.
    _Cost if wrong:_ one extra queue item per such approval, which is the intent.
20. **Remove the online/offline listener — plan-mandated, spec-contradicted, spec
    wins.** The spec says the offline state exists "only in the dedicated specimen
    scenario". Nothing in a memory-only prototype depends on the network, and the
    implementer's route through `apply-scenario` reconstructs fixtures, discarding a
    user's in-session draft because their wifi blipped. _Cost if wrong:_ a genuinely
    offline browser shows no degraded state — correct, because nothing here is
    degraded by being offline.
21. **The plan's stale Task 2 snippet is corrected to match Task 1's shipped names,
    not the reverse.** Verified against the fixtures: `SYN-MGMT-PLAN-002`,
    `getOpenManagementDraft(versions, planId)`, and Mira's former Current genuinely is
    version 1 with the awaiting version at 2. Task 1 is committed and reviewed;
    churning identifiers would cost more than a stale example. _Cost if wrong:_ none.
22. **Review Triggers reach anyone who has ever had a version, not only those with a
    live Current one.** The reducer gated on a Current version, so a person whose plan
    was withdrawn who then presents and is admitted produced nothing for the Reviews
    queue — the cohort that queue most exists for. Only a patient who has never had
    any version raises none, because their pathway is Identification Review. _Cost if
    wrong:_ a queue item for a plan with no current version, which is the signal wanted.
23. **Approval requires a non-empty `revisionReason`.** A version must not become the
    Current Plan with no stated reason for existing, and the reducer is the final guard
    rather than the form. _Cost if wrong:_ Task 6's form must supply a reason, which it
    already collects.
24. **Printing the Personal Safety Plan is exempt from the offline/connectivity block.**
    It is the single action you most want when systems are down, and it appends an audit
    event rather than changing a record. Identity uncertainty still blocks it — printing
    the wrong person's safety plan is a real harm — so the exemption is from the
    connectivity block only, not the funnel. _Cost if wrong:_ an intent audit event is
    recorded in a specimen scenario where other mutations are unavailable.
25. **The default participation wording must not assert an unrecorded fact.** A new
    draft defaults to `patient_unavailable`, so the trigger reason asserted "this person
    was not available to take part" when nobody had recorded anything. Keep the
    conservative default and the trigger; word the reason to say only what is known.
    Same family as the non-stigmatising-language rule. _Cost if wrong:_ none.

---

## Deferred minors — for the whole-branch review to triage

Recorded, not fixed. None blocks a later task.

**Task 1**

- `awaitingApproval` queue ordering is asserted on a single element, so its sort is unproven.
- `CmhtContact.verifiedAt` is non-nullable, so "never verified" cannot be expressed, while `SYN-CMHT-003` is `unverified` with a date.
- The telephone sweep cannot see a bracketed `(08) 5550 1234` landline.
- `addIsoDays`/`addIsoMonths` are calendar helpers in a file declaring itself pure selectors.
- A copied `Optional detail` doc comment sits on the required `cmhtContactAttempt`.
- `it.each` emits four identically-named tests (brief-pinned, not the implementer's choice).
- `fixtures.ts` is ~1,420 lines before Tasks 8 and 9 add more — Task 9's patient-plan fixtures should get their own module.
- The count guard matches spelled numbers only, so a digit-form claim evades it.
- `once|twice` must sit immediately adjacent to the verb, so "left before assessment twice" evades it.
- Ruling 17's reword is now load-bearing rather than cosmetic: a legitimately-phrased future review trigger can trip a count guard that has nothing to say about it.
- `BLAMING_TERM` includes "difficult"/"refuses"/"agitated", which have legitimate service-facing uses — fails closed, so the safe direction, but expect false positives.
- `CONCRETE_FINDING` is curve-fit to the present fixtures.
- `SYN-PRESENTATION-019` breaks identifier ordering in the array (cosmetic; consumers sort).

**Task 2**

- The reducer is a single ~945-line switch. Extract per-case functions before Task 9 adds six more actions.
- `assertSingleCurrentVersion` throws with no React error boundary — **an input to Task 3**, which must mount one.
- `nextSyntheticId` interpolates its prefix into a `RegExp`.
- `reset` always returns the `normal` world, so a displayed specimen scenario silently persists.
- The `AMENDABLE_FIELDS.includes` runtime check is unreachable under the typed action.
- `save-management-draft` does not validate that `ownerId` names a clinical role, so the non-clinical `plan_coordinator` can be recorded as Plan Owner.

---

## Systemic lessons — carry into every later dispatch

1. **Writing source through a shell layer corrupts it.** Three occurrences: twice `\b`
   regex escapes became literal backspace bytes, once 1,240 newlines became CRLF, which
   `.gitattributes` forbids. Write source with the editor tools, not Python or shell
   heredocs, and scan every touched file for CR and control bytes before committing.
2. **Guards that cannot fail.** Two shipped before being caught, both silently matching
   nothing. Any test whose job is to reject something needs a positive control proving it
   rejects a known-bad input, and should be proved by making the code wrongly permit the
   thing and watching the test go red. Task 2 adopted this and ran 32 mutations against
   32 red suites — that is the standard.
3. **Inaccurate reports cost a review round.** Task 1 reported a typecheck without its
   output; Task 2 claimed coverage that did not exist and miscounted its own tests. The
   report is the evidence a reviewer works from. Count from the run output, paste the
   decisive lines, and never claim coverage not written.
4. **Commit at the end of every task.** Three worktree destructions cost nothing
   committed and everything uncommitted.
