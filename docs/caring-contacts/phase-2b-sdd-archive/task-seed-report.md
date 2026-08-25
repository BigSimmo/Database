# Task SEED report — make the demo drivable

**Status: DONE_WITH_CONCERNS.** The population exists, the prototype can be driven, and nothing
patient-visible was authored. Three things need an owner decision rather than an implementer's, and
they are in "Findings" below. The largest is that the isolated Playwright server is deliberately
**not** seeded by default, because seeding it would have deleted a contract that is currently
observed end to end.

## What was built

`src/lib/caring-contacts-server/demo-seed.ts`, reached from exactly one place: the in-memory branch
of `caringContactsStore()`.

The population is one approved and published pathway version, a referral for every seeded patient,
and a plan in each of the three states a coordinator has to be able to tell apart. Every record was
written through the repository's own methods, with a demo actor from `session.ts` and a fixed
idempotency key. Nothing was written into a Map.

The shape is chosen so that each built screen has something on it **and** a sign-up can be
completed:

| What                         | Why it is there                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| One approved pathway version | Without one, `createPlan` has nothing to name and stage 2 of the wizard has nothing to choose.                                                       |
| Accepted referrals           | One of them has **no plan**, which is what the wizard needs — a patient with a live plan is refused a second.                                        |
| One awaiting handover        | So the two referral states are distinguishable on a screen rather than inferred.                                                                     |
| A running plan               | The ordinary caseload row.                                                                                                                           |
| A paused plan                | The state a coordinator has to be able to tell apart from a stopped one.                                                                             |
| A withdrawn plan             | Task 9 found the screen once told a coordinator a stopped plan would still send. A demo that cannot show a stopped plan cannot demonstrate that fix. |

## The safety boundary

**1. It cannot run against a database — structurally, not by a flag.**

`createDemoWorkspaceStore(clock)` **constructs** the in-memory repository itself. There is no store
parameter, so a Postgres repository has nothing to arrive through. The module imports
`createInMemoryRepository` and nothing under `caring-contacts/db/**`. `applyDemoSeed` is exported so
its idempotency can be tested against a real store, and that export is closed off by a module-private
`WeakSet` of the stores this module built: handed anything else it throws `DemoSeedForeignStoreError`
before reading or writing anything.

Store selection is unchanged. `buildStore()` reaches the seed only inside `if (!url)`; when
`CARING_CONTACTS_DATABASE_URL` is set, `createPostgresRepository` is chosen and the seed module is
never called. `tests/caring-contacts-demo-seed.test.ts` spies on the real seed and fails if the
Postgres branch ever calls it.

**2. It is not a privileged back door.** Every write goes through the contract. The consequence is
the point rather than a formality: the pathway version's dual approval is a governance record the
**domain** produced. `applyPathwayVersionTransition` checked that two distinct roles were recorded by
two distinct people, neither of them the author, and refused anything else. A version written
straight into the Map would have had the same shape and none of that meaning.

A refused write is treated as a finding, not an obstacle: `DemoSeedRefusedError` names the step and
the domain's own machine-readable reason and stops the seed. A partly-populated store that looked
whole would be the worse outcome. Nothing was refused in practice — see "Findings".

**3. It authors no patient-visible wording.** `messageTextByType.standard` is
`EXACT_PATIENT_VISIBLE_MESSAGE` from the sealed domain's `message-copy`, the one provisional message
that exists and the only one reviewed. `first` and `closing` are **empty strings**, and nothing
anywhere refused them — not the store, not the wizard, not any schema. An empty entry is the truthful
representation of "not yet written".

The closing slot was deliberately left empty rather than filled with the standard message.
`message-rules` requires a final message to say that it is the final message in the programme, so a
closing message that did not say so would tell someone in a suicide-prevention programme that contact
continues when it has ended. The owner deferred that wording to the lived-experience representative.

**Idempotency** has two independent guards. `applyDemoSeed` returns without writing when the store
already holds a pathway version; and every key is fixed (`demo-seed-plan-create-rowan`, and so on)
rather than derived, so a racing second call replays through the store's own contract and performs no
second change. Above both of those, `caringContactsStore()` memoises on `globalThis`, so under
`next dev` the seed runs once per process however many times the store is asked for.

**Names and numbers.** Every mobile number is one of the two reserved fictional numbers that stand
for a patient's own mobile (`DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS`). There are fewer reserved
patient numbers than there are seeded plans, so one is used more than once — reusing a reserved
non-connecting number is the safe outcome, and inventing a number-shaped string would not have
been. Every name follows the fixtures already
in this tree (`Rowan Example`, `Rowan Sample`): the surname is what makes it unmistakably invented.

## Findings

**F1 — The isolated Playwright server is not seeded by default, and this is the one decision here
that the brief and the existing browser gate pull in opposite directions on.**

The brief asks the seed to make it possible for a browser test to reach a wizard stage. The isolated
Playwright server is a production build with `PLAYWRIGHT_OFFLINE_MODE=true` and
`NEXT_PUBLIC_DEMO_MODE=true` (`scripts/run-playwright.mjs`), which is the one place
`isCaringContactsDemoEnabled()` is true inside a production build — so seeding on that predicate alone
would have populated it.

That would have broken a contract that is currently proven rather than assumed.
`tests/ui-caring-contacts-workspace.spec.ts` observes, end to end, that an empty caseload is served as
a **page** rather than as a missing resource, and that the empty state says in words which of the
three facts it is. A seeded server never renders "No patients yet" again, and the observation is
simply gone.

So the seed is excluded there unless asked, by `CARING_CONTACTS_DEMO_SEED=on`. Development is seeded;
the browser gate is unchanged and still green on its own terms.

**This is a real trade and the owner may want it the other way.** The switch is process-wide, not
per-test, so a future wizard journey cannot simply turn it on for one spec: it needs either a second
server or a decision about what the empty-caseload spec should assert once the workspace is normally
populated. That decision is not an implementer's to make, which is why it is here rather than in the
diff.

**F2 — No screen lists referrals, so the wizard's entry point is a URL a person has to know.**

`plans/new` takes `?referral=<id>` and validates it against the referrals the actor can list. Nothing
links to it with an id. The seed therefore publishes a stable one,
`DEMO_SEED_UNSTARTED_REFERRAL_ID` (`demo-seed-referral-wren`), and the wizard is reachable at
`/caring-contacts/plans/new?referral=demo-seed-referral-wren`. That is a workaround for a missing
screen, not a substitute for one: a coordinator with no referral list still cannot find their way in.

**F3 — The seed records a governance approval that no person gave.**

The pathway version is approved by `demo-clinicalProgrammeLead` and
`demo-livedExperienceRepresentative`. Those are demo role-switcher identities, not people, and the
approval is real as a record while being fictional as an act of governance. This is unavoidable if
the demo is to have a pathway at all, and it is the same fiction the role switcher already is — but
when the templates library later shows "approved by the clinical programme lead and the
lived-experience representative", it will be showing this. Every actor id is `demo-` prefixed,
so the record says what it is. so the record is self-identifying.

**F4 — `culturalIdentity` is recorded as "Not stated" for every seeded patient.** A cultural identity
attributed to an invented person is an invention about culture. "Not stated" is a value already used
in this tree and is what the record honestly holds. If a demo needs to exercise that field with
content, that content should come from the owner.

**F5 — Every seeded plan discharges at the instant the seed runs**, so every contact on it is still
in the future and none is a past-dated message that was never sent. Dispatch is not simulated: nothing in the
demo has been sent, which is true of this prototype generally.

**F6 — `npm run lint` is already red on this branch, for something outside this task.**

`tests/caring-contacts-empty-state.dom.test.tsx` raises two
`@next/next/no-html-link-for-pages` errors (lines 32 and 93: `<a href>` to `/caring-contacts/patients/new/`
and `/caring-contacts/patients/`). That file is byte-identical to my branch base and my diff touches
no route, so this is pre-existing rather than caused here. I have deliberately not fixed it — it
belongs to another task's file and fixing it unasked would put an unrelated change in this diff — but
it will block CI on the branch, so somebody has to.

## What a browser test would now need to do to reach stage 4

Assuming F1 is resolved so the server is populated (`CARING_CONTACTS_DEMO_SEED=on`, or whatever the
owner decides):

1. Go to `/caring-contacts/plans/new?referral=demo-seed-referral-wren`. The referral is accepted and
   has no plan, so the page renders the wizard rather than a `PlanStartStateNotice`.
2. **Stage 1, Agreement.** Tick both checkboxes inside the "Assurances you are confirming" fieldset —
   the patient agreed, and the mobile is the patient's own. The primary control
   ("Continue to pathway") is `disabled` until both are ticked.
3. **Stage 2, Pathway.** Choose the one option. This is the stage that was impossible before: the
   page offers only versions whose state is `approved`, and there were none. There is now exactly
   one, published, showing its cadence and both approving roles. Then "Continue to personalisation".
4. **Stage 3, Personalisation.** Fill the patient's name, the mobile number
   (`+61 491 570 006` or `+61 491 570 156` — the wizard states these in place and refuses neither),
   and any other identifiers, then choose a send time from the "When in the day messages go out"
   radio group. Then "Continue to review and activation".
5. **Stage 4, Review and activation.** Supply the discharge day the stage collects, then use the
   activation control. It POSTs `/api/caring-contacts/plans` and then activates the created plan.

Note for whoever writes it: the wizard is this workspace's only Client Component and keeps its draft
in tab storage, so a test that re-enters the route mid-flow resumes rather than restarts. And the new
plan is created for `demo-seed-patient-wren`, who has no other plan — running the journey twice
against one server will be refused by `duplicateActivePlan` the second time, correctly.

## Effect on existing tests

Checked rather than assumed. Every other suite that touches `caringContactsStore()`
(`caring-contacts-api-handler`, `-plan-activation`, `-page-access-audit`, `-new-plan-page.dom`,
`-patient-overview.dom`, `-patients-page.dom`) replaces it with `vi.mock`, so none of them sees the
seed at all. The one suite that exercises the real function,
`tests/caring-contacts-server-store.test.ts`, asserts store selection, memoisation and a service stop
— all unaffected by the store having content.

The offline suites are therefore unaffected, and the browser gate is unaffected because of F1.

## Files

- `src/lib/caring-contacts-server/demo-seed.ts` — new.
- `src/lib/caring-contacts-server/store.ts` — the in-memory branch builds the seeded store.
- `tests/caring-contacts-demo-seed.test.ts` — new.

## Gate evidence

### Mutation proofs

Nine mutations, applied one at a time in process (never through a shell — the MSYS2 runtime
re-parses argv and a `grep -c` presence check silently returns 0 for a mutation that is
demonstrably present, `-F` included; each mutation was read back by reading the file in process).
The tree was committed before each, and restored from git after. **Every mutation produced
`1 failed | 13 passed`** — so each one isolates a single assertion rather than making a whole case
red — and every failure matched its prediction.

They were run before two assertions in unrelated cases were strengthened from literal counts to
invariants. None of the assertions a mutation actually landed on was touched by that change, so the
evidence below still describes the file as it stands — but it was gathered from the earlier one, and
that is worth knowing rather than glossing.

| Mutation                                                | Predicted                                                        | Observed                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| M1 the Postgres branch calls the seed                   | the "never reached from the Postgres branch" spy assertion fails | `AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times`       |
| M2 the `WeakSet` guard is removed                       | no `DemoSeedForeignStoreError`                                   | `expected TypeError: store.listPathwayVersions is n… to be an instance of DemoSeedForeignStoreError` |
| M3 the standard message is copied into the closing slot | closing is no longer empty                                       | `expected 'Hi Rowan, Alex from Example Aftercare…' to be ''`                                         |
| M8 the standard message is blanked                      | standard is empty                                                | `expected '' to be 'Hi Rowan, Alex from Example Aftercare…'`                                         |
| M4a the already-seeded return reports a population      | `populated` is true on the second call                           | `expected true to be false`                                                                          |
| M4b the already-seeded guard is removed entirely        | the second call re-writes and is refused                         | the idempotency case fails (the seed throws `DemoSeedRefusedError`)                                  |
| M5 a seeded mobile number is not a reserved one         | an unreserved number is present                                  | `expected [ Array(2) ] to include '+61 400 000 000'`                                                 |
| M6 the isolated Playwright exclusion is removed         | that server holds 3 plans unasked                                | `expected [ … ] to have a length of +0 but got 3`                                                    |
| M9 the cadence labels are typed out instead of derived  | the lists differ                                                 | `expected [ 'Day 1' ] to deeply equal [ 'Day 1', 'Week 1', 'Month 1', …(7) ]`                        |

**One assertion is not mutation-proven, and it should be read as weaker for it.** "approved by two
different people" cannot be falsified by mutating the seed, because the domain refuses the mutation:
recording both approvals under one actor is `pathway-approval-actor-already-recorded` and the seed
stops. The assertion is therefore held up by `applyPathwayVersionTransition`'s own refusal rather
than by this suite, which is the right place for it but is not the same as a proof here.

### Gates

Every line below is from a run made with `GATE_RECEIPTS=refresh`, so none is a restored-tree receipt
exiting 0 with no summary. A lease refusal was hit repeatedly — one exclusive heavy job runs at a
time across every worktree and another implementer was active — and every one was retried, never
forced past.

- `npm run typecheck` — clean.
  `[gate-receipts] recorded a pass for "typecheck:internal" (5338 input files).`
- `npm run lint` — **`2 problems (2 errors, 0 warnings)`**, both pre-existing and both in
  `tests/caring-contacts-empty-state.dom.test.tsx`. See F6. No error anywhere in the files this task
  added or changed, which is what that run establishes for this diff.
- `npm run test`, the full offline suite, once:
  `Test Files  836 passed | 3 skipped (839)` / `Tests  10201 passed | 74 skipped (10275)`,
  `Duration 620.80s`. (The `check:function-grants: FAIL` lines in that output are printed by the
  guard-under-test exercising its own failure path, not by a failing case — the counts above are the
  verdict.)
- `node scripts/run-vitest.mjs run --reporter=dot tests/caring-contacts-demo-seed.test.ts`, re-run
  last against the final tree because formatting landed close to the full suite's start:
  `Test Files  1 passed (1)` / `Tests  14 passed (14)`.

**Not run, and why.** `npm run format` whole-tree — Prettier was run over the four changed files and
they are clean, but the repository-wide check the pre-push guard performs was not, and this task does
not push. `npm run verify:ui` — no component, route, style or chrome change here; the browser gate's
inputs are untouched, which F1 exists to keep true. No provider-backed gate was run or needed.
