# Ward Verifier — findings, 2026-09-03

Verified against integration tip `aeb889874` unless stated. Every literal below was read from
that ref, not recalled. Verifier model tier: Opus 5.

**Why this file exists.** A verifier that writes no file leaves its findings only in chat, and
chat is the thing that gets lost. Every row here was raised in conversation first; this is the
copy that survives.

## Calibration — read this before trusting the table

The verifier's own false-positive rate this cycle: **one manufactured defect**
(`ward-ed-screen.dom.test.tsx:442`, reported as verified, later REFUTED). Two guards in series
made a mutation misleading and "the mutant never ran" was misread as "the assertion is weak".
That is the dangerous direction — it generates work that looks justified. If that finding is
ever resurrected from a transcript, it is wrong.

## The seven leads, re-verified

| #   | Finding                                                                | Status                                | Evidence                                           |
| --- | ---------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------- |
| 1   | `URGENT_MARK_REASONS` has six entries; owner asked for more            | **CONFIRMED**                         | `ward-change-reasons.ts:317-324`, six members      |
| 2   | `referrer_withdrew` label asserts a motive the system never checked    | **CONFIRMED**                         | `ward-change-reasons.ts:224`                       |
| 3   | "Placed elsewhere" survives in the pull-release list                   | **CONFIRMED**                         | `ward-admissions.ts:241` in `PULL_RELEASE_REASONS` |
| 4   | `patientId` reaches state through an unvalidated cast                  | **CONFIRMED**                         | `referral-intake.tsx:697`, bare `as PatientId`     |
| 5   | `subscribeToNothing` never notifies, so the patient link cannot update | **CONFIRMED — fix NOT landed**        | `referral-intake.tsx:556`, used at `:678`          |
| 6   | `ACCEPT_REFERRAL` declares `overrideReason` with no consumer           | **REFUTED**                           | consumed at `ward-flow-reducer.ts:2559`            |
| 7   | Placeholder hospital and unit names                                    | **CLOSED — deferred by owner ruling** | ruling 7, 2026-09-03                               |

## 2 — the correction that matters most

Owner ruling 4 changes both withdrawal sentences to "Withdrawn by the referrer."

- `referrer_withdrew: "Withdrawn — the referrer no longer needs this bed."` — the ruling is
  correct here. The file's own comment four lines above states the discipline ("the recorded
  fact is that the referral was withdrawn, which is complete without saying why") and the
  literal fails it. The file disagrees with itself; the comment is right.
- `another_unit_accepted: "Withdrawn — another unit accepted this patient."` — **the ruling must
  NOT be applied here.** On this path the referrer withdrew nothing; the referral was superseded
  because another unit accepted. The replacement sentence would be untrue, and it collapses two
  events a ward needs to tell apart when deciding whether to keep holding a bed.

**Provenance of this split, stated precisely because it was once stated loosely.**

- Ward Lead recommended changing BOTH labels; the owner approved that recommendation.
- The verifier found that recommendation wrong for `another_unit_accepted`.
- **Ward Lead ruled the split on its own authority** and stopped the build on that half.
- The owner was then shown the verifier's reasoning in full and replied "Go ahead with any
  recommendations" (2026-09-03). That is a blanket approval of the verifier's recommendation,
  **not a separate considered ruling by him on the substance.**

Until he answers the correction specifically, `another_unit_accepted` stays as it is. Same
outcome either way; the distinction is recorded so the question "who decided this" has a true
answer later.

## The reason-to-gate gap — closed as a ruling, not a defect

All three override validation sites are membership-only (`ward-flow-reducer.ts:514`, `:608`,
`:978`); no reason-to-gate association exists anywhere in `src`. So any of the five reasons
unlocks any gate in `SUITABILITY_GATES`.

Owner declined to tie them (2026-09-03): coordinators sometimes must send patients to places
that do not meet criteria, and he wants that recorded as an override, "to make it simple".
**This is the intended shape. It is not a defect and should not be re-raised as one.**

Consequence worth carrying forward: because the reasons are unconstrained, a recorded reason may
be untrue of the gate it excused. An override record that also names the gate lets a later
reader see reason and gate together and judge the fit. That mitigation is Ward Lead's design
decision, not the owner's ruling — recorded here so the authorship does not drift.

## Two guard defects, recorded and deliberately not fixed

1. **`scripts/guard-push.mjs` cannot say what it found.** `runStaticCheck` sorts every non-busy
   failure into one bin, so a process that never launched reports in the same words as a tool
   that found real defects. On this branch the changed-file argument list was 56,570 bytes
   against a Windows limit of 32,767, so eslint never started and the guard said "lint failed".
   Shared-repo defect, not Ward Flow.
2. **A guard that only runs at push, on a branch that never pushes, never runs.** Lint gated
   this branch for the first time at 986 commits and found eleven problems — accumulated debt,
   not a regression. The never-push safety rule is what silently disabled the check. Ward Lead's
   finding; recorded here because it is the same defect class with the trigger missing rather
   than the assertion.

## Ward Builder One — `8728caf62` (Task A) and `7046bd7f7` (Task C)

Checked by Ward Verifier (Opus 5) against the commits themselves.

### 1. Ruling 9 wording — PASSES, with one weakness

`person-screen.tsx:121` renders `Refer Patient`, the owner's words exactly. The assertion reads
the RENDERED DOM (`getByTestId(...)` then `toHaveTextContent`), not a constant, so it is capable
of failing — the property Ward Lead required.

**Weakness:** `toHaveTextContent("Refer Patient")` is a SUBSTRING match. "Refer Patient Now" or
"Please Refer Patient" would pass it. For wording the owner chose personally, prefer
`toHaveTextContent(/^Refer Patient$/)`. Not a defect in what shipped; a gap in what the test can
detect.

### 2. Was the new test watched failing — NOT INDEPENDENTLY RUN

The verifier did **not** re-run the mutation. Its worktree is 38 commits behind the tip and does
not carry these commits, and mutating against a mismatched baseline is how this project produced
two manufactured findings already.

What was checked instead, and what it is worth:

- **The assertion genuinely discriminates.** `expect(href).toContain("patientId=PT-001")` cannot
  pass against `?patient=PT-001`. Unlike the reducer paths, there are no guards in series here,
  so the usual "the mutant never ran" ambiguity does not apply.
- **The restore succeeded.** The committed blob contains `patientId=`, not the mutant. The most
  dangerous outcome of a mutation run — leaving it in — did not happen.

**Status: the author's account is consistent and unfalsified, not independently reproduced.**

### 3. Contrast figures — VERDICT CONFIRMED, ONE COLUMN OF FIGURES NOT REPRODUCIBLE

Recomputed from committed tokens (WCAG 2.x relative luminance):

|                          | light canvas / raised | dark canvas / raised |
| ------------------------ | --------------------- | -------------------- |
| `--border` before        | 1.12 / 1.23           | 1.53 / 1.32          |
| `--border-strong` before | 1.39 / 1.53           | 2.03 / 1.74          |
| `--border` after         | 4.51 / 4.97           | 5.38 / 4.63          |
| `--border-strong` after  | 6.97 / 7.69           | 8.87 / 7.62          |

**Every before-value is below 3:1 and every after-value is above it, on every candidate surface
tested. The fix is correct and ruling 6 is satisfied.**

⚠️ **RETRACTED — THIS PARAGRAPH ORIGINALLY ACCUSED WARD BUILDER ONE OF READING COLOURS OFF A
SCREEN. IT WAS WRONG, AND THE ERROR WAS THE VERIFIER'S.**

The claim was that One's canvas column "matches no surface token in `globals.css`". It matches
`--surface` (`globals.css:357` `#fcfdfe` light, `:658` `#101315` dark) — the board's canvas, via
`--wb-band-base: var(--surface)` at `board.module.css:44`. Recomputed against it, all eight of
One's figures reproduce **exactly**: 1.21 / 1.50 / 4.88 / 7.55 light and 1.42 / 1.88 / 4.98 /
8.21 dark. **One's numbers were right the whole time.**

**How the verifier missed it, because the mechanism will recur.** The candidate list was built
with the pattern `--surface-[a-z]+:`, which requires a hyphen after `surface` and therefore
**cannot match the un-suffixed base name `--surface:` at all**. Seven variants were found; the
base token was excluded by construction. Every ratio computed off that list was arithmetically
correct and jointly about nothing, and the _spread_ between seven wrong backgrounds was then read
as evidence about One's method.

**This is the verifier's third wrong finding, and it is logged as one.** It is the same shape this
file criticises elsewhere — a measurement of something adjacent to the claim, reported as the
claim — with the aggravating feature that it impugned another agent's competence on the strength
of a broken search. A candidate set assembled by prefix match cannot report its own omissions:
nothing goes red, and seven confident numbers arrive about the wrong thing.

### 4. Scope of the `.screen` override — THE LEAK IS REAL, AND IT RUNS INWARD

Confirmed as claimed: `.screen` is the board root (`ward-board.tsx:747`, `:839`, both `<div>`),
nothing below it re-declares either token, and the `@media not (forced-colors: active)` guard is
present in the shipped CSS.

⚠️ **But "nothing else moves" is false.** Custom properties INHERIT, so the question was never
whether the selector matches anything outside `.screen` — it is what renders _inside_ it.

`<ClinicalRail />` is the **first child** of the board root (`ward-board.tsx:840`, and `:748` on
the not-found screen). It is shared chrome, also rendered by the community index and screen, the
coordinator screen, the discharge board, the ED screen, the escalation board and the ward-flow
error page — none of which are inside `.screen`.

**So the same navigation rail draws its borders at roughly 4.5:1 on the ward board and roughly
1.2:1 on every other ward screen.** Cosmetic, not a safety defect, and arguably better on the
board — but undeclared, invisible to every gate, and precisely the kind of difference a later
editor "fixes" without knowing why it exists.

## Lead 4 — CORRECTED: the cast is real, the consequence was not

Reported above as an unvalidated `as PatientId` at `referral-intake.tsx:697`, framed as an id
that could travel into a referral. **The observation stands; the consequence does not.**

`ward-flow-reducer.ts:2421` refuses it downstream:

```
if (event.patientId !== undefined && !state.patients.some((p) => p.id === event.patientId)) {
  ... `RECEIVE_REFERRAL patientId must name a patient this system already holds, and
       ${event.patientId} names none`
```

Absent ids pass by design; a present-but-fabricated id is refused with the id named. Verified at
`aeb889874`; the ancestry of Ward Builder Two's `a71355798` confirmed with a reverse-direction
control, so that test could have said no.

**Recorded as a scope limit rather than a wrong finding:** the cast is exactly where it was said
to be, and the reducer that closes it is not visible from that file. The workflow question that
survived — the clinician is told at submit rather than at load — is Ward Lead's ruling, not the
owner's.

## Ward Builder Two — `e2ac6382d` (Task B)

### What was asked, and what holds

- **Mutation 3's control is now permanent, which is better than the mutation.** The one-time run
  showed the guard still catches a plain unaliased import; the committed assertion
  `expect([...exportedAliasesOfSource("allOverrides", "function allOverrides() {}")])
.toEqual(["allOverrides"])` re-establishes it on every run. A one-time mutation proves a past
  moment; this proves it continuously.
- **The computed set is genuinely consumed**, not a dead constant: `FORBIDDEN_REGISTER_READS` is
  used at `:404` and `:425`. Worth checking, because a guard that computes a set and never applies
  it passes identically to one that works.
- **`GATE_RECEIPTS=off` is honoured by the code** — `gate-receipts.mjs:113-115` disables reuse for
  `off`/`0`/`false`, and `:560` self-tests exactly that. Whether the flag was set in that shell is
  a past event no one else can verify; the mechanism is real.

### ⚠️ Residual hole — the same shape, one syntax across

`exportedAliasesOfSource` only inspects `statement.specifiers`. So it tracks

```
export { allOverrides as networkOverrideRead };      // CAUGHT — this is what the commit closed
```

but not

```
export const networkOverrideRead = allOverrides;     // NOT CAUGHT — zero specifiers
```

The second is an `ExportNamedDeclaration` carrying a `declaration` and no specifiers, so the loop
body never runs. A ward screen importing `networkOverrideRead` would then hold the whole override
register with the guard green — **the identical failure the commit exists to prevent, reached by
the neighbouring syntax.**

Smallest proof: call `exportedAliasesOfSource("allOverrides", "function allOverrides() {}\nexport
const networkOverrideRead = allOverrides;\n")` and observe the returned set lacks
`networkOverrideRead`.

Not raised as a defect in what shipped — the commit closed what it set out to close, and its own
prose is precise about scope. Raised because the guard's value is that it cannot be renamed
around, and one rename form still gets around it.

## Ward Builder Three — `396b4e622` (Task A) and `894d5372d` (Task B)

### 1. The ED safety rule — CONFIRMED, and satisfied on every row

The rule is where Three said: `ward-referrals.ts:165-177`, in `referralPurposeLabel`'s own
docblock, stated as a safety rule rather than a preference — "a declinable row with no stated
purpose is indistinguishable from a bed request", with the FD-18 correction cited.

**Every row, not only the tested one.** `referralDestinationLabel` is the single composer and
`referralDestinationLabels` maps it over all destinations. Only two places call the bare
`referralDestinationKindLabel` outside that file, and neither renders a referral row:

- `ward-referral-visibility.ts:323` — a **comment** citing it as an example of the same
  exhaustive-switch discipline. Not a call.
- `referral-destination-options.ts:414` — the destination **picker**, building `{kind, label,
catchment, figures, reasons, suggested}` at referral-creation time, before any purpose exists.
  A chooser is not a row displaying an existing ED referral.

### 2. The mutation and its control — consistent, not independently reproduced

Not re-run, for the same reason as Ward Builder One's: this worktree does not carry the commits
and a mismatched baseline manufactures findings. The control is structurally sound on reading —
the ward arm returns `referralDestinationKindLabel(kind)` unchanged and is untouched by the ED
branch, so a fix that deleted bed language everywhere would break it. Reported as the author's
account, unfalsified.

### 3. ⚠️ The negative assertion IS unfalsifiable — but not for the reason suspected

`tests/ward-referral-screens.dom.test.tsx:2083`

```
expect(refusals.textContent).toBe(`Also refused — Community team: ${...}`);
expect(refusals.textContent, "...").not.toContain("Emergency department");
```

**Three's reasoning about the string is right.** The new label is `Emergency department (For
psychiatric review)`, which still _contains_ `Emergency department`, so the assertion would catch
a real leak; narrowing it to the full new label would have been the weaker form. That judgement
was correct and the instinct not to "update" it was correct.

⚠️ **But the assertion is inert regardless of the string, because of statement order.** It sits
_after_ an exact `.toBe` on the same `textContent`. If the `.toBe` passes, the text is exactly the
community sentence and `not.toContain` is trivially true; if the `.toBe` fails, execution stops
and this line never runs. **It cannot report anything, before or after this change.**

**The same file diagnoses this exact pattern fifteen lines below** — the finding I3 comment: _"It
used to sit after the exact `.toBe`, which meant it never ran: `.toBe` already throws on the exact
mutation this exists to catch, so this line was decoration, not coverage."_ Same defect, fixed
there, still present here.

**Fix: move it before the `.toBe`, exactly as I3 did.** Then its named message — "the cancelled
ED arm must never be listed among the refusals" — is the one that fires, instead of a bare string
diff.

### 4. The restored seventh urgency reason — VERBATIM, and the right one of four

`e6b7afb91` removed four keys. `396b4e622` restores exactly one, and both key and label match that
commit character for character:

```
"this_setting_cannot_continue_current_care"
this_setting_cannot_continue_current_care: "This setting cannot continue current care"
```

The other three removed (`one_to_one_observation_needed`,
`restrictive_measures_this_setting_cannot_sustain`, `earlier_placement_broke_down`) are each
narrower, so the broadest of the four is the one restored — the correct choice for the stated
purpose. The withdrawal split is applied to `referrer_withdrew` only, with `another_unit_accepted`
untouched, as ruled.

**One caveat for the owner, not a defect:** "This setting cannot continue current care" is the
broadest of the dropped options but is not literally an _other/none-of-these_ catch-all. If what
was wanted is somewhere to put a reason that fits none of the seven, this does not fully provide
it.

## Ward Builder One — `0d421b94a` and `bbe335ffe` (re-scoped fix)

### The inheritance leak is genuinely closed

`.screen` no longer declares `--border` or `--border-strong` at all — verified by searching for
the declarations, not for the old block. So `ClinicalRail` inherits the global tokens on the board
exactly as it does on the eight other screens that render it. **The finding recorded above is
closed, and by the better fix: board-local names rather than an override of shared ones.**

`--wb-border` / `--wb-border-strong` are defined at `:47-48`, 34 usages converted, and the
forced-colors branch is correctly INVERTED relative to the first attempt:

```
@media (forced-colors: active) { .screen { --wb-border: var(--border); ... } }
```

The first version excluded itself from forced-colors so the global mapping would win. Now that the
board reads its own names, that mapping no longer reaches it, so it is re-established explicitly.
Different construction, same protection, and the reasoning in the comment is correct.

`bbe335ffe` anchors the wording: `toHaveTextContent(/^Refer Patient$/)`, with the weaker
`/refer/i` deliberately kept alongside so a reword fails twice with different messages.

### ⚠️ The twelve-aliases claim — substance CONFIRMED, unit is wrong

Measured across **all 29** ward CSS modules, finding aliases **by their value** rather than by
name (a name-pattern search is what produced this file's third wrong finding):

| module                               | declarations aliasing `--border` / `--border-strong` |
| ------------------------------------ | ---------------------------------------------------- |
| `ward-management.module.css`         | 3                                                    |
| `ward-management-modes.module.css`   | 2                                                    |
| `ward-management-network.module.css` | 2                                                    |
| `board.module.css`                   | 2 — the deliberate forced-colors fallback            |
| `ward-sidebar.module.css`            | 1                                                    |
| `ward-role-switcher.module.css`      | 1                                                    |
| `ward-demo-controls.module.css`      | 1                                                    |

**Twelve is exactly right as a count of DECLARATIONS. It is not a count of modules — there are
seven, and six once the board's own intentional fallback is excluded.** So the remaining defect
population is **10 declarations across 6 files**, not twelve of anything.

**The qualitative claim holds and is the important half:** every one of those aliases still
resolves to the global token, so those files carry the shape of the fix with none of its effect.
And the hiding is real — the alias is declared once with `var(--border)`, while every _usage_ says
`var(--ward-border)`, so a grep for `var(--border)` finds one line per file and misses all the
places it actually reaches.

Not every border alias in those files points at `--border`: several resolve to
`--clinical-accent-border`, `--warning-border`, `--danger-border`. Those are semantic accent
colours, a different thing, and correctly not part of this population.

## Ward Builder One — `10829347f` (answered cap) and `645e0c0c8` (project isolation)

### 1. The replacement for the two tautologies — NOT circular

The tautology's shape was: filter on predicate P, then assert P. The replacement does not do that,
and the difference is structural rather than stylistic.

```
const overlap = specs.filter((s) => collects(production, s) && collects(mockup, s));
expect(overlap).toEqual(DOCUMENTED_OVERLAP);          // ["ui-tools.spec.ts"]
```

The filter uses the two patterns; the assertion compares the result against an **independent
hand-written literal**. A second spec matching both patterns adds a member and the assertion
fails. Likewise `requiredProjects` is filtered on `filter === "grepInvert"` and then asserted on
`pattern`, which is a _different_ field — so the assertion tests something the filter did not
establish.

### 4. Discovery — CONFIRMED, and its vacuity hole is closed

Projects are discovered by `matchAll` over `playwright.config.ts`, and required-versus-advisory is
derived from each project's own tag filter (`grepInvert: mockupTag` → required, `grep: mockupTag`
→ advisory). Neither is hand-listed.

**The failure this could have had is the one it exists to prevent, one level up:** a source-text
regex that stops matching returns _fewer_ projects and every loop below then covers a smaller set
silently. That is closed — the first test pins the discovered names against an expected list, the
required/advisory split at 5 and 1, and the spec count above 40.

**Note the apparent contradiction and why it is not one.** The guard says projects are "DISCOVERED,
never listed here" and then lists them. The two serve opposite purposes: discovery makes the loops
cover everything that exists; the literal makes a discovery _failure_ loud. Adding a seventh
project fails one test deliberately, instead of silently shrinking five others.

**Minor:** the anti-vacuity assertions sit in their own `it()`, so they fail _alongside_ the loops
rather than gating them. A red suite is a red suite, so this costs nothing today.

### 2. The wrong-end slice — claim TRUE, and the test is better than reported

Fixture: thirteen answered referrals, `RF-CAP-00` newest to `RF-CAP-12` oldest. A correct cap
keeps 00–09.

Slicing from the wrong end (`slice(-10)`) renders 03–12 — **exactly ten rows**, so
`toHaveLength(RULING_19_CAP)` passes. The claim that ten of the wrong ten is indistinguishable by
count is correct, and it is the substance.

**But two assertions catch it, not one.** The presence loop (00–09 must each be present) fails on
00, 01 and 02, and the absence loop (10–12 must not appear) fails on all three. Only the _count_
assertion is fooled. Recorded because the test is stronger than its report, and a report that
undersells coverage is still a report worth correcting.

Applying Ward Lead's new rule to this file: `toHaveLength` is not a tautology — it catches a wrong
cap _value_ (9 or 11), which is a different mutation from a wrong _end_. It has a mutation it
would be the catcher for.

### 3. The cap literal — CONFIRMED

```
/** Ruling 19, pinned as a hand-written literal on purpose. Asserting against an imported constant
 *  would let this test move with the code: raise the cap to fifty and every assertion below still
 *  [passes]. */
const RULING_19_CAP = 10;
```

A literal, with the reason stated. The fixture is thirteen rather than eleven, deliberately: eleven
would prove the eleventh is dropped without proving the twelfth is.

## The shape all three chats produced tonight

Ward Lead's framing, recorded here because it is the most useful thing in this file:

- **Verifier:** a prefix-derived token list that could not report its own omissions.
- **Ward Builder Three:** a negative assertion dead by statement order.
- **Ward Builder One:** a filter and an assertion over the same predicate.

**All three are constructions that cannot report their own emptiness, and in every case nothing
went red.** The operational rule that follows: _watching a suite go red is not enough — the
assertion you care about has to be the one that went red. Any assertion that never appears as a
catcher across a whole mutation set is a candidate tautology._

## Ward Builder Three — the dead-assertion scanner (`10f5c7af4`, `4f6937db0`, folded `6c9a16ffb`)

### 1 and 2. The scanner runs elsewhere, and the self-check REPRODUCES

Run independently: the committed scanner was extracted to a scratch directory outside the
repository, with each tree supplied by `git archive`, and executed there — a different directory,
a different worktree, a different session from the one that wrote it.

```
POST-FIX (6c9a16ffb)    files scanned: 168   files with candidates: 14   total candidates: 18
PRE-FIX  (4f6937db0^)   files scanned: 166   files with candidates: 15   total candidates: 21
CONTROL FAILURES: 0 in both runs
```

**Exactly the numbers reported: 21 in 15 before, 18 in 14 after.** The hardcoded-path repair is
real — the committed copy uses relative globs and runs from wherever it is invoked. And the
scanner carries its own sensitivity/specificity/parse-count controls, which passed in both runs, so
a scan that silently matched nothing would announce itself.

**This is the scan checking the fixes rather than the author checking them.**

### 3. The adjacency blind spot — MEASURED, not merely stated

The committed matcher pairs adjacent expects (`zip(ex, ex[1:])`), so a third consecutive dead
assertion is invisible. Re-running with the committed scanner's own helpers, but pairing every
expect with every later one in the same same-subject run:

```
adjacent-only (committed behaviour):  18
whole-run (blind spot removed)     :  24
UNDERCOUNT                          :   6
```

The six it cannot see:

| file:line                           | gap | subject                              |
| ----------------------------------- | --- | ------------------------------------ |
| `ward-add-patient.dom.test.tsx:319` | 2   | `checkState()`                       |
| `ward-governance.test.ts:65`        | 2   | `entries[0].detail`                  |
| `ward-screen.dom.test.tsx:309`      | 2   | `stateText`                          |
| `ward-statistics.test.ts:123`       | 2   | `statistics.averageEmptyBedMinutes`  |
| `ward-statistics.test.ts:124`       | 3   | `statistics.averageEmptyBedMinutes`  |
| `ward-statistics.test.ts:162`       | 2   | `statistics.averageLengthOfStayDays` |

**So "may undercount" can be sized, and the size is six.** Five are pure-looking property
accesses; one (`checkState()`) is a call and therefore falls into the Group 2 uncertainty already
recorded — a scanner cannot tell a pure call from an impure one. The `averageEmptyBedMinutes` pair
at gaps 2 and 3 is a run of four on one subject, which is exactly the case the limitation
describes.

### 4. The three fixes — sound, with one claim I could NOT verify

All three are reorderings that move the named or negative assertion **before** the exact `.toBe`,
each with the reason written at the site. The reasoning is correct: after an exact `.toBe` on the
same subject, a later negative on that subject is decided in both directions — trivially true if
the `.toBe` passed, unreachable if it did not.

The warnings restored are real clinical sentences: a finished span still reading as a live wait,
and — the sharpest — _a losing ward must never be told who won_.

⚠️ **UNVERIFIED: the claim that a source comment three lines above names the `0m` defect.** The
string `"Not in department yet"` appears in `tests/ward-ed-psychiatry-hub.dom.test.tsx` at `:1046`
and `:1427` and **nowhere in `src` at all** — searched across the whole of `src`, with a control
confirming the search works on that path. So the producing source could not be located from the
literal, and the claim about its comment could not be checked. Raised as a question for Three, not
as a finding: the line is presumably composed from parts, and knowing where would settle it.
