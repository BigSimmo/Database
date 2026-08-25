# Task 8 report — stage 3, personalisation

**Branch:** `claude/browser-test-gate-handoff-d5c1db`. Committed locally; nothing pushed, no PR.

**Commits:**

| SHA         | What                                                                       |
| ----------- | -------------------------------------------------------------------------- |
| `9015ca0a5` | The pure half: `patient-detail.ts`, `SENDING_PREFERENCE_OPTIONS`, and their tests |
| `30a581c47` | Stage 3 itself, the draft's new fields, the page's two new props            |
| `5eb3df29a` | The stage comments Task 8 made stale, corrected at their own sites          |

---

## 1. What was built, file by file

| File                                                                     | What changed                                                                                                     |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `src/components/caring-contacts/workspace/plan-wizard/patient-detail.ts` | **New.** What stage 3 collects and whether it is enough to create a plan with. Pure — no React, no storage.       |
| `src/components/caring-contacts/workspace/plan-wizard/plan-wizard.tsx`   | `PersonalisationStage`, plus two small field components and two new props.                                        |
| `src/components/caring-contacts/workspace/plan-wizard/plan-draft.ts`     | `patientDetail` and `sendingPreference` added to `PlanDraft`, to `emptyPlanDraft` **and to `parseDraft`**.        |
| `src/components/caring-contacts/workspace/plan-wizard/stages.ts`         | `personalisation` flipped to `{ kind: "built" }`; its purpose line corrected (see §5).                            |
| `src/app/caring-contacts/plans/new/page.tsx`                             | Resolves the send-time wording and the reserved fictional numbers on the server and passes them in.               |
| `src/lib/caring-contacts/schedule.ts`                                    | `SENDING_PREFERENCE_OPTIONS` — the three preferences, their labels, and the send time **derived** from the hours. |
| `src/lib/caring-contacts/model.ts`                                       | `SENDING_PREFERENCES` published as a value; `SendingPreference` now derived from it.                              |
| `src/lib/caring-contacts/synthetic-contacts.ts`                          | `DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS` — the two reserved PATIENT mobiles, derived from the frozen record. |

Tests added: `tests/caring-contacts-plan-patient-detail.test.ts` (11 cases).
Tests extended: `tests/caring-contacts-plan-wizard.dom.test.tsx` (+10), `tests/caring-contacts-plan-draft.dom.test.tsx` (+3), `tests/caring-contacts-schedule.test.ts` (+3).
`package.json`: `test:cc-guards` now also carries this task's two suites.

Task 7 said Task 8 would change **exactly two things** — the `stages.ts` entry and the `stageBody()`
branch — and that the forward control would become a real Continue with no edit at its call site.
**That held.** No call site moved; the stepper, the forward control and the unbuilt-stage panel all
followed the table.

---

## 2. The rulings, and how each was implemented

### Ruling [114] — this is a DATA ENTRY stage, and the mockup has it backwards

`PersonalisationStage` in the mockup renders four read-only rows — preferred name, message variant,
team identity, coordinator signature — each with a green tick and the source line "Imported from the
synthetic referral". None of the four is reproducible. `createPlanSchema.patientDetail` requires the
clinician to **supply** `patientName` and `patientMobileNumber` (both `min(1)`), and a `Referral` is
five fields holding neither.

So stage 3 is four inputs and a radio group:

| Field                 | Control                       | Required                                   |
| --------------------- | ----------------------------- | ------------------------------------------ |
| `patientName`         | text                          | yes                                        |
| `patientMobileNumber` | text, `inputMode="tel"`       | yes                                        |
| `patientIdentifiers`  | textarea, **one per line**    | no — an empty box is `[]`, never `[""]`    |
| `culturalIdentity`    | text                          | no — reaches the plan as `null`            |
| `sendingPreference`   | three radios                  | yes                                        |

Nothing is ticked and nothing claims a source. A test asserts the phrases "imported from the
synthetic referral" and "governed value present" appear nowhere on the stage.

**On the identifiers textarea, because it is the one presentational convention I invented.** One
identifier per line, stated in place. It is a parsing convention owned by the screen, not a domain
rule, and `parsePatientIdentifiers` is where it lives so Task 9 uses the same split. The alternative
— a repeatable row list with add and remove controls — is more machinery for a field the domain
describes only as `z.array(z.string().min(1))`. Say if you would rather have the rows.

### Ruling [115] — the mobile number is required, and the design has no field for it

Collected here, not deferred to stage 4. **And I looked for the validator the ruling told me to look
for. There is none, and I have not invented one:**

- `createPlanSchema.patientMobileNumber` is `z.string().min(1)`. That is the whole rule.
- `message-policy.ts` takes `patientMobileNumber` only to check whether the number **leaked into**
  message text (`contains-patient-mobile`). It treats it as an opaque string and says nothing about
  its shape.
- `synthetic-contacts.ts` holds a closed list of reserved fictional numbers, and says nothing about
  the shape of any other number.

So the only refusal is the one the domain holds — the field must not be empty — with **trimming,
which is stricter than the schema on purpose**: `z.string().min(1)` accepts `" "`, and a plan whose
patient name is a single space passes the API and identifies nobody.

**What the screen says, and where.** A `StatedReason` group sits directly beneath the number field,
in the flow of the page, headed *"Nothing typed here is ever sent to any number"*, with spec §4.4's
`Why:` / `What changes it:` shape — never a `title` attribute, which has not been stated to anyone
who does not hover. Its reason names the reserved fictional numbers, **read from the sealed domain**
rather than written into the screen.

**The one judgement call in this task, stated so you can overrule it.** When the number entered is
not one of the reserved fictional ones, the screen **says so and still accepts it**:

> The number entered is not one of the reserved fictional numbers listed above. It is accepted — this
> prototype holds no rule about what a mobile number looks like — but a number belonging to a real
> person would be recorded on the plan.

I considered refusing anything outside that pair, which is the more conservative failure direction
and would make it impossible to type a real person's number into a prototype. I did not, for two
reasons: it is a rule that exists nowhere in the domain and would be enforced only by this screen
while `createPlanSchema` went on accepting any non-empty string — the exact "inventing the authority"
Ruling [115] warns against — and it would turn a stage the same ruling calls a data-entry stage into
a two-option picker. **If you want the refusal instead, it is one line in `personalisationIssues` and
one test, and I will make it.**

### Ruling [116] — cultural identity is optional, and the screen says why it is asked

Optional in all three senses: no issue is raised when it is blank, nothing on the stage waits for it,
and `createPlanPatientDetail` sends `null` rather than `""`. That last is not cosmetic — `Episode`
types the field `string | null` and `CLEARED_PATIENT_DETAIL` blanks it to `null` on a retention
clearance, so `""` would be a third state meaning neither "not given" nor "cleared", and nothing
reading the record afterwards could tell those two apart.

**A recorded purpose exists, and I did not have to invent one.** Spec §2.5, "Cultural identity is
imported for reach reporting only", is the authority: Aboriginal and Torres Strait Islander status is
used for **aggregate reporting on programme reach**, with a small-cell threshold and a non-inferable
`Suppressed` state, and it "never affects eligibility, ordering, timing, pathway assignment, message
content, or any ranking, and never appears on a worklist row." The screen states the purpose, the
equity reasoning behind it, and that list of nevers, in a `StatedReason` group beneath the field.
The Postgres store corroborates it in code: `culturalIdentity` goes to `cultural_identity_reports`
and, in its own words, "nowhere near the plan row".

**One thing §2.5 says that the screen deliberately does not reproduce: "imported from the source
record".** There is no import path in this domain. See finding 1.

### Rulings [94] and [98] — the count is not restated

The mockup's legend reads *"One preference applies to all 10 contacts."* The screen says:

> One choice applies to every contact in this plan.

A test asserts the invariant is present and that no `N contacts` count appears on the stage.

### Ruling [110] — the draft, and what stage 3 puts in it

Task 7's draft is used and no second storage mechanism exists. `patientDetail` and
`sendingPreference` were added to the type, to `emptyPlanDraft` **and to `parseDraft`** — Task 7
warned that a field added to the type and not to the parser is silently dropped on every reload, and
`parseDraft` refuses a draft it does not fully recognise, so a draft written before stage 3 existed
is discarded rather than half-read. Three cases cover that and mutation M8′ proves they fire.

**`sendingPreference` starts at `null`, not at `"morning"`.** The mockup default-checks the first
option. Nothing in this domain carries a sending preference, so a default would decide when a
discharged patient hears from the service and then present that decision as the coordinator's. Stage
2's pathway starts filled only because a referral genuinely carries one.

**Nothing patient-identifying is in a URL.** Stage 3 added no route, no query parameter and no
storage key; the draft key is unchanged.

**Task 7's notice is reachable from this stage and is still true — and I did not strengthen it.**
It is rendered by the wizard shell above every stage, so it is on screen while the name and number
are typed. Its "held" wording already says what is written, that it is not sent anywhere, that
closing the tab removes it, and that Discard draft removes it now — *"use it if you are stepping away
from a shared computer."* That was written knowing stage 3 was coming. What I did instead was make
the stage point at it rather than re-describe it: the panel intro says *"until you finish or discard
it is kept on this computer — the notice above this stage says exactly where"*, and the completion
line says *"None of it is recorded on a plan yet; like everything else on this screen it is kept on
this computer until you finish or discard."*

**On the wording rule.** "Name the destination, not the act." Both sentences above name a
destination — *on a plan*, *on this computer* — and neither uses a bare "stored". I read the comment
at the site in `AgreementStage` before writing them.

### Ruling [109] — the client boundary

Unchanged. The page is still a Server Component, the wizard is still the only client boundary, and
**the two new props are resolved on the server** — the send-time wording from
`SENDING_PREFERENCE_OPTIONS` and the reserved numbers from `synthetic-contacts.ts`. That is round 1
finding M-2's precedent applied: a screen must never re-derive a rule a module owns, and resolving
server-side keeps `schedule.ts` out of this route's client chunk.

One deliberate exception, and it is a value import: `plan-draft.ts` imports `SENDING_PREFERENCES`
from `model.ts`, because the parser has to decide at **runtime** whether a value read out of a
browser's storage is still one of the three. The alternative was a list written out in the component,
which is a second copy of the union free to go on accepting a preference the domain had dropped —
and the value being checked is exactly the kind that can be older than the code reading it. So the
array is now the source of the type in `model.ts`, the same shape `TERMINAL_PLAN_STATES` there
already uses. `model.ts` has one import (`./ids`, types only) and is side-effect-free, so
tree-shaking keeps a frozen three-string array rather than the state machine.

**The service state still does not cross.** No new prop is derived from it; the page test that stops
a service with a distinctive incident note and asserts the wizard's props hold neither it, the stop
reason, nor a key of that name is unchanged and green.

---

## 3. Findings I am reporting rather than fixing

**Finding 1 — the fourth field the design assumes an import for, and this one is a spec sentence
rather than a mockup row.** The brief asked me to say if I found one. I did, and it is
`culturalIdentity`. Spec §2.5's own title is "Cultural identity is **imported** for reach reporting
only" and its text says the status is "imported from the source record". There is no source record
and no import path: `createPlanSchema` requires the clinician to supply it, and `Referral` carries
nothing of the kind. It is Ruling [114] a fourth time, and the pattern the build record calls
"three-for-three" is now four-for-four.

There is a second half worth a decision. §2.5 scopes the field to **Aboriginal and Torres Strait
Islander status** — a categorical fact with a small-cell suppression threshold — while
`createPlanSchema` types it `z.string().min(1).nullable()`, free text. Aggregate reporting over free
text is not the same product as aggregate reporting over a category, and the difference decides
whether the equity report §2.5 promises can be built at all. I did not narrow the control to a
category, because that is a schema and a governance decision rather than a screen decision, and
because inventing the category list for a demographic field is exactly what Ruling [116] refuses.
The screen therefore asks an open question and states what the answer is used for.

**Finding 2 — `dischargeAt` is required to create a plan and NO stage collects it.** This is
Ruling [115]'s shape exactly, one field over, and it will land on Task 9 unless it is settled first.
`createPlanSchema.dischargeAt` is a required ISO instant; `buildApprovedSchedule` hangs the entire
twelve-month calendar off the AWST discharge day; and nothing in this domain holds a discharge
instant before a plan exists — `Referral` is five fields, `hospital-events.ts` has no discharge
event, and the only `dischargeAt` values anywhere are read back **out of** an already-created plan.

I did not build a control for it, and the reason is the briefs rather than convenience: Task 8's
constraints name "adjust schedule" as one of the four overlays **Task 11** owns, and Task 9's
Ruling [118] puts the first-contact-date control on **stage 4** on Ruling [96]'s authority. So the
scheduling controls are deliberately not mine. But Ruling [118] then talks throughout about "the
discharge day" as a known quantity — "default is discharge + 1 day", "movable within the discharge
day to discharge + 7" — and nothing says where it comes from. **A review screen that is also the only
place a required value can be entered is not a review**, which is Ruling [115]'s own sentence. Worth
a ruling before Task 9 starts.

**Finding 3 — the DOM test for the send times is tautological with respect to their values, and the
schedule test is what actually pins them.** Recorded because mutation M3 found it rather than review.
The wizard test asserts the fieldset renders `option.sendTime` for each option — but it reads
`SENDING_PREFERENCE_OPTIONS`, the same constant the screen renders, so hardcoding every send time to
10:00 leaves it **green**. What goes red is
`tests/caring-contacts-schedule.test.ts`'s case, which builds a real schedule and compares the
advertised wording against the hour the contact is actually sent at. Both tests are worth keeping and
they prove different things: the DOM one proves the screen renders what the domain published, the
schedule one proves what the domain publishes is true. It is the same trap as a check that cannot
fail, one layer up — an assertion that reads its subject's own source of truth.

**Finding 4 (carried forward, not mine to fix).** Task 7's finding 1 stands unchanged: the stage-1
assurances still cannot be recorded, and stage 3 does not change that. Task 9's Ruling [119] names it
too.

---

## 4. Seams left for Task 11 (overlays), and what Task 9 gets

**No overlay is wired.** The mockup opens four from this stage, plus a preview card:

| Overlay id                 | What the mockup opens it for                                | Note for Task 11                                                                                     |
| -------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `message-preview`          | The `MessagePreviewCard` on this stage                      | This is where patient-visible copy belongs. It must read the sealed domain's `message-copy`; the stage renders none. |
| `communication-preference` | A communication-preference sheet                            | `notification-preferences.ts` exists in the domain; whether this stage is where it belongs is a design question. |
| `adjust-date-time`         | "Adjust schedule" — the first-contact date                  | **Check against Task 9 first.** Ruling [118] puts the first-contact-date control on stage 4, so this overlay and that control may be the same thing built twice. |
| `discard-changes`          | A discard confirmation                                      | The wizard already has a real, unconfirmed "Discard draft" control beside the notice. If this becomes a confirmation step, it wraps that control rather than adding a second one. |
| `save-draft`               | "Save draft"                                                | There is nothing to wire. The draft saves on every keystroke and the notice says so; a Save-draft control would imply the opposite. Recommend it is dropped rather than built. |

**What Task 9 inherits from this task:**

- `createPlanPatientDetail(draft.patientDetail)` returns exactly the four-key `patientDetail` object
  `createPlanSchema` accepts, or `null` while anything required is missing. `.strict()` means a fifth
  key is refused outright rather than ignored, which is why that function returns those four and
  nothing else. **Use it; do not re-derive the trimming or the null.**
- `personalisationIssues(...)` is the same list stage 3 renders. If stage 4 needs to say why it
  cannot submit, that is where the words are.
- The draft now carries `patientDetail` and `sendingPreference`. Ruling [120]'s `planId` and
  `idempotencyKey` are additions to `PlanDraft` **and to `parseDraft`** — the parser refuses what it
  does not recognise, so a field added to one and not the other is dropped on every reload.
- `dischargeAt` is still nobody's. See finding 2.

---

## 5. A decision that goes slightly beyond the brief — please check it

**I changed `stages.ts`'s `personalisation` purpose line.** It read "The patient's details, the day of
the first contact, and when in the day messages go out." The stage does not collect the day of the
first contact — Ruling [118] puts that control on stage 4 — and that string is rendered to a
clinician by the stepper and by the unbuilt-stage panel. A purpose line naming something the stage
does not collect is a promise the screen breaks, so it now reads "The patient's details, and when in
the day messages go out."

---

## 6. Verification

### Test-first, honestly reported

**Test-first for three of the four pieces, and not for the fourth.**

- `patient-detail.ts` — test-first. `tests/caring-contacts-plan-patient-detail.test.ts` was written
  first and run first: `Error: Cannot find package '@/components/…/patient-detail'`, then
  `Tests 11 passed (11)` after the module existed.
- The draft's new fields — test-first. Three cases written first, run first, `3 failed | 12 passed
  (15)`, each failing for its stated reason (`expected { Object (referralId, stage, ...) } to be
  null`, and `undefined` where the new `patientDetail` should have been).
- Stage 3 itself — test-first. Ten cases plus five edits to existing ones, run first:
  `13 failed | 19 passed (32)`, all thirteen unable to reach a stage that did not exist.
- `SENDING_PREFERENCE_OPTIONS` — **implementation first. I am not claiming otherwise.** It is a small
  derived constant and I wrote it before its three cases. Falsifiability is proved by mutation M3
  rather than by having watched it fail first.

### Mutation log — every attempt, itemised, no aggregate

Each mutation was applied, its presence in the tree confirmed by a separate `grep -c` run as its own
command with `;` — never `&&`, because `grep -c` exits non-zero on a zero count and would
short-circuit the gate into printing no summary line at all — then the gate run, then reverted with
`git checkout --`. **Every mutated file was committed first**, so no revert could discard a fix; that
is round 1's process defect applied rather than re-learned.

| #    | Mutation                                                                    | Predicted                                                          | Observed                                                                                                                                                                                | Verdict                       |
| ---- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| M1   | `personalisationIssues` never reports `patient-mobile-required`             | 3 red: 2 in patient-detail, 1 in the wizard                        | Exactly 3. `expected [ 'patientName', 'sendingPreference' ] to deeply equal [ 'patientName', …(2) ]`; `expected [ 'patientName' ] to deeply equal [ Array(2) ]`; and `a required field states nothing about what is missing: expected '' to match /cannot be created without/i` | RED, prediction matched       |
| M2   | `createPlanPatientDetail` sends `""` for cultural identity instead of `null` | 2 red, one per file, both reading `expected '' to be null`         | Exactly 2, both `expected '' to be null`                                                                                                                                                | RED, prediction matched       |
| M3   | Every `sendTime` hardcoded to 10:00                                         | 1 red in the schedule suite; **green in the wizard suite**, because that assertion reads the same constant | `afternoon is advertised at the wrong time: expected '10:00 am AWST' to be '2:00 pm AWST'`, and the wizard suite green — see finding 3                                     | RED where predicted, and the predicted green is the finding |
| M4   | The mobile statement drops `fictionalPatientMobileNumbers.join(...)`        | 1 red, the reserved numbers not found in the group                 | 1 red: "states, where the number is entered, that nothing is ever sent to it"                                                                                                           | RED, prediction matched       |
| M5   | `mobileIsDesignatedFictional` always true                                   | 2 red: the near-miss case, and the wizard's caution                | Exactly 2. `expected true to be false`, and `expected 'Entered by youA referral carries no n…' to match /not one of the reserved fictional nu…/i`                                        | RED, prediction matched       |
| M6   | The cultural-identity purpose becomes "record keeping"                      | 1 red on `/reporting on programme reach/i`                         | 1 red: "states the recorded purpose from the spec, and what it never does"                                                                                                              | RED, prediction matched       |
| M7   | `min-h-tap` stripped from stage 3's radio labels                            | 1 red naming the row                                               | `Morning is not a production tap target: expected 'flex w-full min-w-0 cursor-pointer it…' to contain 'min-h-tap'`                                                                       | RED, prediction matched       |
| M8   | `parsePatientDetail` returns an empty detail instead of null                | 1 red, the pre-stage-3 draft accepted                              | **GREEN — and the mutation was the defective thing, not the test.** I mutated 2 of the 5 refusal branches; `patientIdentifiers` still returned null and caught both cases. The brief's own warning, met in practice: check first that the mutation changes a value some assertion reads | GREEN on an effectively unmutated path |
| M8′  | All five branches of `parsePatientDetail` return an empty detail             | 1 red, and on the SECOND sub-assertion (the first is caught by the `sendingPreference` check) | `a draft missing half its patient detail was accepted: expected { Object (referralId, stage, ...) } to be null` — the second sub-assertion, as predicted                | RED, prediction matched       |
| M9   | The completion status line's branch inverted                                | 1 red on `/nothing else is needed/i`                               | `expected 'Entered by youA referral carries no n…' to match /nothing else is needed/i`                                                                                                  | RED, prediction matched       |
| M10  | The identifiers field's `id` renamed                                        | **GREEN** — nothing asserts on it; the label is what the tests find | `Tests 32 passed (32)`                                                                                                                                                                  | GREEN, as intended            |

No anchor failed to match: every mutation was confirmed present by its own `grep -c` before its gate
ran, and `git status` was clean after the last revert.

**Where a prediction was wrong, and it is worth recording.** M8 is the one, and it is the more
useful direction to be wrong in than round 1's under-predicted blast radii: the mutation was
**green on a tree that was not meaningfully mutated**. Nothing about the summary line said so — it
read `Tests 47 passed (47)`, which is indistinguishable from a test that cannot fail. What caught it
was predicting *which assertion* would fail and then not finding it in the output, which is the whole
reason the brief asks for the prediction rather than "expect red". M10 is the deliberate control in
the other direction: a change that SHOULD leave the gate green, labelled as such, so a green line
somewhere in this log is not read as an oversight.

### Gates

**The guard set, `npm run test:cc-guards`** — run during iteration and after each fix, twice at the
end (before and after the comment refresh):

```
[cc-guards] exit=0 elapsed=118s        # first green, 17 files
 Test Files  17 passed (17)
      Tests  319 passed (319)
   Duration  107.85s

[cc-guards] exit=0 elapsed=67s         # after the comment refresh; warm caches
 Test Files  17 passed (17)
      Tests  319 passed (319)
   Duration  63.43s
```

Membership grew by two — `tests/caring-contacts-plan-patient-detail.test.ts` (this task's own) and
`tests/caring-contacts-schedule.test.ts` (this task edits `schedule.ts`, and it is the suite that
actually pins the send times — see finding 3). Both are `node`-project suites and cheap; the set went
from 15 files to 17 and the wall time did not rise.

**The full suite, once, at the end:**

```
FULL_SUITE_PLACEHOLDER
```

**Typecheck and lint:**

```
[typecheck] exit=0 elapsed=52s
[gate-receipts] recorded a pass for "typecheck:internal" (5325 input files).

[lint] exit=0 elapsed=46s
[gate-receipts] recorded a pass for "lint:internal" (5325 input files).
```

Neither was red at any point in this task, and neither hit a lease refusal. **Prettier was red once**
and it is worth recording because the brief warns about exactly its consequence: four files
(`plan-wizard.tsx` and three test files) failed `prettier --check` after the comment refresh. Fixed
with `--write` and committed in the same commit as the change, not after it — a push sends commits,
not a working tree.

### The timing question the brief asked me to answer

**The guard set is 67–118 s against the full suite's FULL_SUITE_ELAPSED.** Round 1 measured 53 s
against 590 s (about 11×) on 12 files; round 2 measured 133 s against 803 s (about 6×) on 15. This
task is 17 files and lands at FULL_SUITE_RATIO — so the saving is real and has held across three
measurements and two widenings, but **the ratio is not stable and should not be quoted as a
constant**: both numbers move with how many of the owner's worktrees are running, and the guard set's
own membership has grown by five files across three tasks. What is stable is the shape of the trade —
minutes rather than tens of minutes per fix round, at the cost of a selected set that the full suite
still has to confirm was selected correctly.

**And it earned its place on this task rather than passing by never looking.** It was red on its
first run of every piece: the draft cases, the thirteen stage-3 cases, and the five existing wizard
cases the flip invalidated (the stepper's unbuilt count, the forward control, the stage table, and
the stored-draft fixtures). No workspace-wide guard fired this time — `interface-vocabulary`,
`domain-isolation`, `route-reachability`, `design-system-adoption` and `explained-automation` were
green throughout, which I checked deliberately rather than assumed, because Task 7 was caught by two
of them and this task adds a new module to the same client boundary.

### The browser gate

**No, I do not believe this touches `tests/ui-caring-contacts-workspace.spec.ts`, and I did not
change it.** The reason is the one Task 7 recorded in that spec's own comment: its isolated
Playwright server seeds no referrals, so `/caring-contacts/plans/new` always renders "No referral
named" and **no Playwright case can reach any stage of this wizard**. Everything Task 8 built is
inside a stage. The six existing `caring contacts new plan` cases exercise the route's start state,
which is unchanged.

That is a real coverage gap rather than a clean bill of health, and it is the same one Task 7 filed
twice: the tap-target assertions here read the CLASS, not the rendered box, because jsdom has no
layout, and the 320px, dark, forced-colours and print behaviour of four new inputs and a radio group
has not been seen by anything. It cannot be closed until that server seeds a referral.

### Not run, and why

- `npm run verify:ui`, `verify:phone-chrome` — you run the browser gate, and see above for why it
  cannot reach this stage today.
- `npm run verify:cheap`, `verify:pr-local`, `verify:release` — not asked for; the last is
  provider-backed.
- Nothing provider-backed was run at all. No Supabase, no OpenAI, no GitHub, no CI.
