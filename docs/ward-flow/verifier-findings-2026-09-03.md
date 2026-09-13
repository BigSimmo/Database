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

⚠️ **CORRECTED — THE HEADLINE "SIX" WAS WRONG, AND SO WAS PART OF THE CORRECTION TO IT.**

Checked against the actual lines at `6c9a16ffb`:

- **`ward-add-patient.dom.test.tsx:319` — WITHDRAWN, but it is not a phantom.** Line 319 is a real
  assertion: `expect(checkState(), "at the matcher's own floor…").not.toBe("unchecked")`. It is
  **live**, because a `fireEvent.change` between it and the `.toBe` at :316 changes the DOM that
  `checkState()` re-reads. So it is a false positive of the wider matcher on an impure call — the
  Group 2 class — and does not belong in a list of things the scanner "cannot see".
- **The other five ARE distinct dead assertion sites, not merely extra pairs.**
  `ward-statistics.test.ts:120` is `.toBe(30)`; `:122`, `:123` and `:124` are three separate
  `.not.toBe(...)` lines on the same subject. Once `.toBe(30)` passes the value IS 30, so all
  three are determined. The adjacent matcher reports only `:122`; `:123` and `:124` are separate
  lines, each individually dead, each invisible to it.

**So the corrected figure is five additional dead sites, not six and not zero** — and all five sit
in the `.toBe(30)` / `.not.toBe(1030)` restatement class that was already ruled to stay. They are
therefore _known and accepted_, not new work.

**The unit error was real and is the lesson worth keeping:** "18" counts sites, my "24" counted
pairs, and I reported their difference as though it were sites. A number without its unit is not
yet a fact — which is the third time in one night that establishing the unit would have prevented
the finding, and the second time it was mine. Five are pure-looking property
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

## Two chats, one line number, two correct answers

```
tests/ward-add-patient.dom.test.tsx line 319
  at 6c9a16ffb  expect(checkState(), "…").not.toBe("unchecked");
  at f226ce816  });
```

Verified by printing line 319 at both refs. Two sessions read the same file, at the same line, on
different trees, and reported flatly contradictory facts — **both honestly, both correctly.**
Neither sentence named its tree.

**Every observation of a moving file needs its ref attached, or it is not yet a fact.** This is the
first instance tonight to put two chats in direct disagreement about a file both had open, and
neither of them was wrong.

## ⚠️ A comment that asserts a property the code does not have

`tests/ward-statistics.test.ts:120-124`

```
120:  expect(statistics.averageEmptyBedMinutes).toBe(30);
121:  // Named individually so a red run says exactly which wrong clock pairing produced it.
122:  expect(statistics.averageEmptyBedMinutes).not.toBe(1030); // pulledAt -> now
123:  expect(statistics.averageEmptyBedMinutes).not.toBe(500);  // arrivedAt -> leftAt
124:  expect(statistics.averageEmptyBedMinutes).not.toBe(1000); // arrivedAt -> now
```

**The comment at :121 is false.** If `.toBe(30)` fails, execution stops and the three negatives
never run. If it passes, the value is exactly 30 and all three are trivially true. **So no red run
has ever said which wrong clock pairing produced anything, and none ever can.**

This is a step beyond the dead assertions catalogued above. Those were checks that could not fire.
This is a **written claim about what a failure will tell you, sitting on top of three assertions
incapable of delivering it** — so a reader is not merely unwarned, they are actively told a
diagnostic exists. Found by Ward Lead while checking the verifier's own correction.

## The caveat that did not travel with the number

The `checkState()` row reached a numbered list even though the verifier had already recorded, in
prose, that the wider matcher could not distinguish pure calls from impure ones. **The caveat
stayed in the paragraph and the number went out alone** — and a number without its caveat is
received as a fact.

That is the same shape as the scanner's own unstated limitation, one layer up: not a wrong
measurement, but a correct one separated from the condition that bounds it. Recorded against the
verifier, because the list was the verifier's.

## Pre-pull-request pass on `f1916e09d`

### 1a. `ward-flow-provider.tsx` — taking OURS was right, and the premise for worrying was inverted

```
ours  2026-08-30  "initialNow was accepted and its value was never used"
main  2026-08-28  "Make WardFlowProvider's pinned clock read the instant it was given (#2436)"
```

**Ours is the NEWER file by two days**, so main's checkpoint clock is not a newer design that was
declined — it is the older one that ours supersedes.

Nothing was lost. The behaviour main's checkpoint provided is present by a different mechanism:

- 30-second tick — `setInterval(… 30_000)` at `:155`.
- Pinned clocks never tick in a test — `if (initialNow !== undefined) return;` at `:154`.
- Midnight rollover — main folded per-tick deltas to work around `wallClockNow()` wrapping at
  0–1439. Ours reads `absoluteWallClockMinutes()` (epoch-minutes, local-adjusted), so elapsed time
  is plain subtraction and **the wrap cannot arise at all**. Strictly the better solution, not a
  workaround declined.
- `wallClockNow` still has ten importers, so nothing was orphaned by the resolution.

### 1b. `ward-management-modes.tsx` — the rename survived, checked tree-wide

The rename at risk was **hold → pull**. Main still carries `hold_released: "Hold released"`,
`"bed-hold-"`, "holds"; ours carries `pull_released`, `"bed-pull-"`, "pulls". Taking main's
structure with this line's vocabulary preserved the owner's rename.

Scanned the whole tip for main's pre-rename vocabulary, with a control proving the search works.
Every remaining `hold` is legitimate: an unrelated care-plan mockup, a reducer **comment** quoting
the owner's own phrase, two GitHub PR _labels_ named "hold", and
`tests/ward-pull-vocabulary.dom.test.tsx` — the standing guard, which asserts on **rendered text**
precisely because "a label can be renamed perfectly while a screen still says hold to a clinician".

### 2. A third type-invisible conflict — checked for the likeliest class, none found

The modes conflict _was_ an instance of the class: `hold_released` and `pull_released` both
compile, and a reverted string literal would have shipped silently. So the search above is the
direct answer for vocabulary reversals, and it is clean.

**Honest limit: that is one class, not all classes.** A reverted default value, a flipped boolean,
or an argument-order swap between same-typed parameters would also compile either way and none of
those was swept.

### 3. The backspace fix — PROVEN, not merely present

Zero `0x08` bytes in `tests/ward-daily-sheet.dom.test.tsx` at the tip, and none anywhere in `src`
or `tests`. The assertion is demonstrably alive:

```
sample stamp        : Tuesday 2 September 2026
BROKEN  /\x08(19|20)\d{2}\x08/  matches: False  -> not.toMatch passed, assertion dead
FIXED   /\b(19|20)\d{2}\b/      matches: True   -> not.toMatch FAILS, assertion alive
```

### 4. The seven-to-eight seam — NOT IDENTIFIED, asked rather than guessed

The only `MissingValue` registry found is `tests/design-sync-visual-exports.test.ts`, a ~55-entry
list pinned by exact set equality (`toEqual([...visualExports].sort())`) rather than by count —
which is the stronger pin, since adding a component must be typed here deliberately. **That is not
a seven-to-eight seam**, so it is probably not what was meant. Reported unanswered.

### 4. The seam, seven to eight — YES it earns the line item; the pin has one weakness

`tests/ward-flow-seam.test.ts`

**It earns it.** `MissingValue` has two real consumers inside Ward Flow —
`discharges/discharge-board.tsx:3` and `ward-management-console.tsx:22` — so the entry is not
speculative allowlisting of something the merge happened to bring in. And the reason recorded
beside it is the right _kind_: distinguishing a field that CANNOT apply from one nobody filled in
is a clinical-meaning distinction, and duplicating that renderer inside Ward Flow would let two
copies of that meaning drift apart.

**The pin holds.** `expect(APPROVED_SHARED_MODULES.size).toBe(8)` is a hand-written literal, so a
ninth entry fails until somebody edits this line deliberately. It is backed by real anti-vacuity —
`wardFiles.length > 50`, `allSourceFiles.length > wardFiles.length` — and by a canary comment that
names the failure mode this whole file catalogues: _"A test asserting only 'no violations' passes
exactly as cleanly when its allowlists have been deleted, or when it scanned nothing at all."_

⚠️ **The weakness: `.size` pins the COUNT, not the MEMBERSHIP.** Remove one approved module and
add another and the pin still reads 8 — the seam changes composition and nothing fires. A swap is
not a widening, but it is still a change to what Ward Flow depends on, which is what the list
exists to control.

**The file already states the better principle, twelve lines above, about its sibling list:**
_"Named individually rather than counted, because a count of four tells the next reader nothing
about which four are legitimate."_ That reasoning applies to `APPROVED_SHARED_MODULES` exactly as
well, and the pin counts anyway. `expect([...APPROVED_SHARED_MODULES.keys()].sort()).toEqual([…])`
would make a swap visible while still failing on a ninth entry.

## Adversarial review — `991d0d6c1`, the Tier B safety-gate change

Four findings, each proven by running the committed functions, not by reading them.

### ⚠️ 1. A row recording NOTHING clears Tier B — single hyphen

The blank-cell guard is `blank = (cell) => !cell || /^-{2,}$/u.test(cell)`. **Two or more hyphens.**
A single `-` — the conventional markdown way to write "nothing here" — is neither empty nor a
separator, so it counts as a recorded value:

```
every other cell = "   "    -> approved routes: (none)      caught
every other cell = "---"    -> approved routes: (none)      caught
every other cell = "-"      -> approved routes: ['/mockups/development/foo']   NOT CAUGHT
```

**This matters more than its size.** The whole justification for this tier is that it converts
"never" into "only with a recorded owner decision". A row of single hyphens is a row that exists
and records nothing — which collapses the distinction the tier was created to hold. One character
fixes it: `/^-+$/u`.

### ⚠️ 2. `stripRegistryEntries` discounts a REAL one-member-Set dependency

**The control that was asked for PASSES.** A file containing both a registry entry and a genuine
import of the same path is still caught:

```
new Set(["<path>"]) + import X from "<path>"   -> still references after strip: true
```

**But the suspected hole is real.** The shape is matched anywhere, in any file, so a genuine
dependency whose _only_ expression is a one-member Set literal is silently discounted:

```
export const GATED_ROUTES = new Set(["<path>"]);   -> still references after strip: false
```

That is an idiomatic route allowlist, not a contrived case. The strip is keyed to a syntax rather
than to `check-docs-links.mjs`, so any file can take it.

### ⚠️ 3. `sectionBody` swallows `###` subsections

`end = rest.findIndex((line) => /^##\s/u.test(line))` terminates only on `##`. An `###` heading
does not match, so its rows are read as part of the preceding `##` section's table:

```
owner heading as "##"   -> swallowed by "## Retired mockups": false
owner heading as "###"  -> swallowed by "## Retired mockups": true
```

Latent today — both registers are `##`. It becomes live the moment anyone demotes a heading or
adds an `###` subsection under either register.

### ⚠️ 4. `sectionBody` matches a heading inside a fenced code block

`start = lines.findIndex((line) => line.trim() === heading)` has no fence awareness, so a README
that _documents its own register format_ inside a code fence redirects the entire check to that
example:

```
fenced "## Retired mockups" before the real one -> picks the FENCED section: true
```

Plausible for exactly this file, whose purpose is to explain a table format to future editors.

### What held

- Whitespace-only cells, `---` separator rows, and a route placed in the wrong column are all
  correctly refused.
- The header check pins column order in both registers, so reordering throws rather than silently
  inverting the record.
- Duplicate rows collapse into a Set — harmless.
- The two `##` registers cannot read each other's tables as currently written.

## `bf05b807e` — refusing a bed and a community team on one referral

### ⚠️ 1. A wrong formulation that passes EVERY test in the suite

The requested attack succeeds. This refusal:

```js
kinds.includes("psychiatric_ward") && kinds.length > 1;
```

- refuses `{ward, community}` — the refusal test at `:416` passes
- allows `{ED, community}` — the opposite-direction test at `:442` passes
- allows `{ward}` alone — the control at `:335` passes
- **and wrongly refuses `{ward, emergency_department}`**

Asking a ward for a bed while asking an ED to see the patient is the ordinary parallel referral
`PARALLEL_REFERRAL_CAP` exists to permit. **No test in the file ever ticks those two together** —
the checkbox-clicking tests are ward alone (`:335`), ED+community (`:356`, `:442`), ward+community
(`:416`), and community alone (`:468`, `:550`, `:567`). The ward+ED pair at `:199` is a catchment
assertion, not a send.

**Fix: pin `{ward, emergency_department}` as sendable.** One test closes the whole family — every
over-broad formulation that survives the existing three fails it.

**Credit where due:** the first attack tried — `kinds.includes("psychiatric_ward")` alone — IS
caught, by the ward-only control at `:335`. The suite is stronger than the two tests cited for it.

### 3. Not user-reachable today; the premise is one dispatch site away

`referral-intake.tsx:824` is the **only** `RECEIVE_REFERRAL` dispatch in `src`, and the reducer
carries no refusal for the pair (confirmed by search). So the combination cannot be created by a
user today, and the seeded `RF-007` is the only instance.

⚠️ **But the shape that made this bug is intact one layer down.** `ward-referral-visibility.ts`
reasons about what _the product_ can create; what is enforced is what _the form_ can create. A
second dispatch site — an import path, a bulk tool, another screen — restores the exact condition,
and nothing goes red, which is how the original defect survived.

The codebase already states the principle, in `ward-flow-reducer.ts`'s own comment about physical
facts: _"A screen guard is the wrong last line: it is one component away from being bypassed, and
every path goes through here."_ That argument applies here unchanged.

### 4. The "Not yet answered" path is not unreachable, but it is sequenced

`answered ? undefined : refusedCombination ? REFUSED_COMBINATION_ID : UNAVAILABLE_REASON_ID`, with
`{answered || refusedCombination ? null : …}` hiding the unavailable block.

So a clinician with both problems sees only the combination message; the outstanding-fields list
returns once they untick. Nothing is unreachable and Send is never dead-without-reason. Worth
knowing that the two messages are sequential rather than simultaneous.

### 2. The on-screen wording is a clinical question, referred rather than answered

_"A psychiatric bed and a community team cannot be asked for on the same referral. Send them as
two referrals."_ Whether that reads correctly to a clinician is not a question a verifier can
settle by reading code. Referred to the owner, who is one.

## `ROUTE_ENTRY_SUFFIX` — the last open question, run at `origin/main` `b401b65cc`

Driven through the real `auditDeletions` with injected `runGit`/`fileSystem`, reading the Tier B
message specifically (a Tier A "not recorded" message fires in all three from the stub index and is
noise, not signal).

| scenario                                                                | Tier B                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------- |
| delete `foo/page.tsx`, register `/mockups/development/foo`              | **CLEARED** — the intended pass, control holds |
| delete `foo/widget.tsx`, register `/mockups/development/foo`            | **REFUSED**                                    |
| delete `foo/widget.tsx`, register `/mockups/development/foo/widget.tsx` | **CLEARED**                                    |

### The open question is CLEAN

A non-route file under a gated prefix does **not** clear on a sibling route's record. `foo/widget.tsx`
does not end `/page.tsx`, so it is never normalised, and its full path is not in the register.
Ward Lead's reasoning was right — now run rather than reasoned.

### ⚠️ But a FILE PATH in the Route column grants a pass nothing counter-checks

Writing `` `src/app/mockups/development/foo/widget.tsx` `` — or any path — into the Route column
clears Tier B for exactly that file, and **the symmetry guard cannot see it**: that guard probes
`route + "/page.tsx"`, i.e. `…/widget.tsx/page.tsx`, which never exists, so it stays silent.

Nothing validates that the Route column contains a route. A row that reads as a decision about a
route is, in that shape, a blanket pass for one file with the "recorded but still live" check
disabled by construction.

**Narrow** — it needs a deliberate, fully-filled five-column row, which is a recorded decision by
somebody. **But it is the same family as the single-hyphen finding:** the tier's protection is that
a row must _mean_ something, and nothing checks that this cell means what the column says.

**Fix:** require the Route cell to start with `/mockups/` and carry no file extension, or make the
symmetry guard fail closed when a registered route does not resolve to a `page.tsx` path at all.

## Design review of the ten Ward Flow mockups (2026-09-04)

Scope taken: misleading claims, unreachable/missing states, cross-screen disagreement, the
eligibility panel, the two sensitive fields. Colour arithmetic and class divergence deliberately
not audited — covered elsewhere.

### ⚠️ 1. `mockup-statistics.html` — one sentence calls three different quantities "wait for a bed"

> "How long people wait, **from referral to a bed** … Across wards, community teams and emergency
> departments, the longest median wait **for a bed** is 62 hours … at **Bunbury community team**;
> the shortest is 12 hours, at **St John of God Midland Public Hospital ED**."

A community team has no beds — and the page's own chart labels that same 62h column _"waiting for
first contact"_. An ED wait is not a wait for a bed either: the ED purpose axis exists precisely
because a referral to an ED may be for psychiatric review or medical assessment, and
`ward-referrals.ts:165-177` states that as a **safety** rule.

So the sentence merges time-to-a-bed, time-to-first-community-contact and time-in-ED under one
label, then ranks them to produce a "longest" and a "shortest". **"The shortest wait for a bed is
12 hours, at an ED" is not true of anything the system measures.** Every figure is correctly
footnoted; the defect is the label, not the data.

### ⚠️ 2. `mockup-referral.html` — "nobody declines it" contradicts shipped behaviour

> Royal Perth Hospital ED — "**A notification, not a bed request — nobody declines it**"

`ward-referrals.ts:168-173`: _"The spec's FD-18 correction (2026-08-30) is explicit … **every
referral is declinable, the ward's medical notification included**."_ The screen tells a clinician
this one cannot come back declined. It can.

### ⚠️ 3. `mockup-referral.html` — a destination under "Also possible" that the form will refuse

Group heading **"Also possible — a department rather than a bed"** contains:

> "Inner City team — Her own community team — **but not on this referral, see step 4**"

It is filed under _possible_ and its own text says it is not. The refusal that shipped on
2026-09-03 will reject exactly this pairing. A clinician skimming group headings ticks it and is
then refused — which is the confusion the refusal exists to prevent, reintroduced by the grouping.
It belongs with "Cannot take her, and why", or in a group of its own.

### 4. The eligibility panel and the recommend line — the ordering does carry a judgement

The panel says: _"This ranks nothing and recommends nothing — the order is distance … Choosing is
yours."_ The grouping (fits / also possible / cannot) is categorisation, not ranking, and is fine.

**But choosing distance as the single sort IS a clinical judgement about what matters most**, made
by the design and then disclaimed in the same sentence. Within "meets all four requirements" it
puts RPH Adult Secure (**1 free**, 11 km) above FSH Adult Secure (**3 free**, 22 km). First
position reads as the answer whatever the caption says, and for a detained patient needing escorted
transport, one free bed 11 km away versus three 22 km away is precisely the trade-off a clinician
should be making rather than inheriting.

**It does not cross the line into recommending a destination. It does pre-weight the decision while
saying it has not.** Either drop to a neutral order (alphabetical) or let the clinician choose the
sort — then "choosing is yours" is true of the ordering as well as the click.

### 5. `mockup-referral.html` — "6 of 9" does not reconcile with the list

The header reads "Where she can go — **6 of 9**". The panel lists **ten** named destinations: three
secure wards, two EDs, one community team, four wards that cannot take her. The count is declared
invented in the footnote, so it is not undeclared data — but a count that contradicts the list
beneath it on the same screen is still a figure claiming more than it knows.

### ⚠️ 6. The ten screens disagree about what day it is

```
Thursday 3 September : community-home, transport, statistics, ward-home
Friday 4 September   : ward-entry, ed-home, ed-hub
(no date)            : referral, patient, search
```

Not cosmetic. These screens carry claims measured _from now_: "Stale — 14h old", "Confirmed 14
hours ago", "no contact 3 days", "4 days until legal status expires". With two "now"s in one
product, the same "14 hours ago" denotes two different wall-clock times depending on which tab is
open.

### What was checked and found clean

- **Decline vocabulary is consistent.** "Declined" on all six screens that use it; zero instances
  of "refused" or "turned down" as a user-facing synonym.
- **Direction words do not diverge.** "Coming in"/"going out" appear only on `community-home`, and
  "incoming"/"outgoing" appear nowhere — so there is no second vocabulary to collide with.
- **`free` / `empty` / `allocatable` are three deliberate concepts, defined identically on both
  ward screens.** `ward-entry`: _"2 beds empty, 1 allocatable, 1 free — the same source. The free
  figure … is the smaller of empty and allocatable, exactly as the model defines it."_ `ward-home`
  states the same rule. This is the item most likely to have diverged and it has not.
- **The statistics footnote is complete** for the figures rendered: every median wait, the 27h
  median, the 3d 2h longest, 102 declines and all six reason counts and shares, 86 blockers and all
  six causes, every breakdown and league-table count, the "Live" marker and RF-140. Chart axis
  scales are unlabelled framing, not data.

### 7. The two sensitive fields on `mockup-patient.html`

Rendered sequence: `… GP · **Interpreter / preferred language** English — no interpreter required ·
**Aboriginal or Torres Strait Islander status** Aboriginal, not Torres Strait Islander · **Past
psychiatric history** 3 admissions …`

**What is right, and it is most of it.** No icon, no colour, no badge, same weight as every
neighbouring field — as intended. The labels are neutral and complete. And the value phrasing
**"Aboriginal, not Torres Strait Islander"** keeps two distinct peoples distinct rather than
collapsing them into one label, which is the thing most often got wrong.

⚠️ **Two placement observations, both about adjacency rather than styling.**

1. **The two sensitive fields are immediately next to each other, at the end of the block.**
   Individually neither is singled out. Side by side they form a de facto cultural-identity
   cluster that neither field creates alone — a reader scanning the column sees a grouping the
   design did not intend to make. Separating them (language beside GP/communication, status
   elsewhere in the demographic list) removes that reading at no cost.
2. ⚠️ **Aboriginal status sits directly above "Past psychiatric history".** In a clinical record,
   that ordering can read as context offered for the history that follows. Almost certainly
   unintended — and it is exactly the inference a record should not invite. Moving either field
   breaks the adjacency.

⚠️ **The limit of this review, stated rather than glossed.** Whether the field belongs on this
screen at all, whether the label is the right one, and whether the value phrasing reads correctly
to an Aboriginal patient or clinician are **not judgements available from markup**. This project
already carries an Aboriginal health review as an open item elsewhere; these two fields belong in
that review, not in a verifier's design pass. Everything above is about layout only.

### 8. Missing-state sweep across the ten

⚠️ **`mockup-patient.html` has no zero-admissions state.** The record shows "Past psychiatric
history — 3 admissions … most recent first". **A first presentation — no previous admissions — has
no rendering anywhere in the set.** That is not a rare edge: it is a large share of psychiatric
admissions and the one where the absence of history is itself the clinically significant fact. An
empty list here must say _"No previous admission to a WA mental health ward"_ and not simply render
nothing, because nothing is indistinguishable from "not loaded".

**Plural guards are largely absent.** "3 admissions", "3 declined", "8 days ago" are all written
plural-only; at one they read "1 admissions". Two screens do guard it (`ward-entry`, `ed-hub`
carry singular forms), so the convention exists and is unevenly applied.

**Clean, and better than asked for:** `mockup-search.html` carries an explicitly enumerated
**"State 3 — No matches"** whose text names both the query and the active filter: _"Nobody matches
'Zhivkova' with the Community filter applied. No name or record number in Ward Flow contains what
you typed…"_. That is the strong version of an empty state — it distinguishes "nothing exists" from
"your filter excluded it", which is the distinction a user needs to act. It also carries a singular
guard ("Movements — 1 match"). This screen is the model the others should follow.

Overflow handling (`text-overflow`/`ellipsis`/`line-clamp`) is present on all ten, so longest-text
is at least considered everywhere.

## Pre-flight review of the design-foundation plan (`ade5cfaa7`)

### ⚠️ 1. Task 1 — two interpolated regexes cannot match, so the contrast test is red before any mutation

```js
const alias = new RegExp(`${token}:\s*var\((--[\w-]+)\)`, "u").exec(TOKENS)?.[1];
const hex = new RegExp(`${alias}:\s*(#[0-9a-fA-F]{3,8})`, "u").exec(V2)?.[1];
```

Template literals, and `String.raw` appears nowhere in the plan (grep: 0). `\s`→`s`, `\w`→`w`,
`\(`→`(`. Proven by running it:

```
pattern the plan actually builds : "--ward-ground:s*var((--[w-]+))"
match against real CSS           : null
with String.raw                  : matches, returns "--surface"
regex-LITERAL form elsewhere     : works fine
```

`expect(alias).toBeTruthy()` then fails **loudly but for the wrong reason**, and its message —
_"--ward-ground must alias a PsychSift token, not carry a literal"_ — sends the implementer to edit
correct CSS to satisfy a broken matcher.

⚠️ **And it invalidates Step 6a.** That step mutates a token and confirms the contrast test goes
red. **The test is already red.** A red baseline makes every mutation look successful, which is the
contaminated-baseline defect this project has hit before, pre-installed in the plan.

**Fix:** `String.raw` on both, and Step 6a must record the pre-mutation run as _green_ before the
red counts as proof. The task's other regexes are literals (`/--ward-ground:\s*([^;]+);/u`) and are
fine — it is only the two constructed ones.

### ⚠️ 2. Task 5 Step 3 — the ratchet baseline is measured from the thing being tested

The task opens with _"THIS GATE COMPARES AGAINST THE CANONICAL DECLARATION, NEVER AGAINST WHAT A
ROUTE ALREADY CARRIES"_. Step 3 then says _"assert the offender count is less than or equal to
today's measured number"_ — a number obtained by running the check over the files under test.
**The warning is written and then contradicted three steps later.**

A `<=` count ratchet also survives two mutations: moving a violation between files (count
unchanged), and a walk that breaks and returns fewer files (offenders drop, `<=` passes).

**Fix:** record the offender **list**, sorted, and assert no _new_ member.

### ⚠️ 3. Task 5's walk has no anchor; Task 4b's identical walk does

Task 4b: `expect(CSS).toContain(PRIMITIVES)` **and** `expect(CSS.length).toBeGreaterThan(15)`.
Task 5: only the count. Same walk, two tasks, one properly guarded. A walk returning sixteen wrong
files passes Task 5 and fails Task 4b. **Copy 4b's `toContain` into 5.**

### ⚠️ 4. Task 4b's class-redeclaration check misses selector lists and pseudo-selectors

```js
if (css.includes(`.${c} {`) || css.includes(`.${c}{`)) offenders.push(...)
```

Surviving mutations: `.wardCard, .other { … }`, `.wardCard:hover { … }`, `.wardCard::before { … }`,
or a newline before the brace. Each redeclares the hoisted class; none is caught.

### ⚠️ 5. Task 3b's disjointness rests on a set nothing in that file pins

`WARD_KIND_CHIP_KINDS` **is** pinned exactly, so the empty-kinds case is covered.
`WARD_CHIP_LEVELS` is not pinned there at all — empty levels, or a broken import, makes `overlap`
`[]` and the test green while proving nothing.

### Categories named, answered explicitly

- **Possibly-empty set:** found — items 2, 3, 5.
- **Filter and assertion over the same predicate: NOTHING FOUND.** Task 3b's overlap is not that
  shape — it filters on one predicate and compares the result against an external `[]`, which can
  fail. Its weakness is the unpinned set, a different defect.
- **Baseline from the thing tested:** found — item 2.
- **Regex matching other than its name:** found — item 1.
- **A reviewer-visible defect:** found — Step 6a's mutation proof against an already-red baseline.
- **Cross-task conflicts: partially examined, NOT cleared.** Compared Task 4b against Task 5, and
  Task 3b's dependency on Task 3's `WARD_CHIP_LEVELS`. A full produces/consumes matrix across all
  five tasks touching `ward-primitives.module.css` was not done — unexamined, not clean.

## Produces/consumes matrix after the four-module split (`1a0a75780`)

Read from the plan at `codex/task-ward-flow-live-state-20260831` HEAD. All 20 ordered pairs.

| from → to           | what the first produces                                                     | what the second consumes                | verdict                                                         |
| ------------------- | --------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| 2 → 3               | `WardPanel`, `.panel`                                                       | `.wardTokens`, `ward-chip.module.css`   | no interface                                                    |
| 2 → 3b              | `WardPanel`, `.panel`                                                       | `WardChip`, `WARD_CHIP_LEVELS`          | no interface                                                    |
| 2 → 4               | `WardPanel`, `.panel`                                                       | `.wardTokens`, `ward-figure.module.css` | no interface                                                    |
| 2 → 4b              | `WardPanel` _(declared)_, `.panel` _(undeclared)_                           | `.panel`                                | ⚠️ **gap — consumed, not declared produced**                    |
| 3 → 2               | `WardChip`, `WardChipLevel`, `.chip`                                        | `.wardTokens`                           | no interface                                                    |
| 3 → 3b              | `WardChip`, `WardChipLevel` _(declared)_; `WARD_CHIP_LEVELS` _(undeclared)_ | `WardChip`, `WARD_CHIP_LEVELS`          | ⚠️ **gap — `WARD_CHIP_LEVELS` consumed, not declared produced** |
| 3 → 4               | as above                                                                    | `.wardTokens`, `ward-figure.module.css` | no interface                                                    |
| 3 → 4b              | `.chip` _(undeclared)_                                                      | `.chip`                                 | ⚠️ **gap — consumed, not declared produced**                    |
| 3b → 2 / 3 / 4 / 4b | `WardKindChip`, `WardKindChipKind`                                          | —                                       | no interface (nothing consumes 3b)                              |
| 4 → 2 / 3 / 3b / 4b | `WardFigure`, `WardFigureStrip`                                             | —                                       | no interface                                                    |
| 4b → 2 / 3 / 3b / 4 | seven classes + breakpoint scale                                            | —                                       | no interface (4b is terminal)                                   |
| 3b → 3              | `WardKindChip`                                                              | —                                       | reverse of a real edge; none                                    |
| 4b → 3              | seven classes                                                               | —                                       | reverse of a real edge; none                                    |

**Only three ordered pairs carry a real edge, and all three have the same defect:** the consuming
task names an artefact the producing task's _Produces_ line does not list. The artefacts probably
exist in code; the **declared** interfaces are what the plan reasons about, and they are incomplete
in exactly the direction the split made invisible.

### ⚠️ 1. `--ward-panel` and `--ward-sunken` are still in the plan

```js
plan:152   const SURFACES = ["--ward-ground", "--ward-canvas", "--ward-panel", "--ward-sunken"];
```

Those two tokens do not exist; the real surfaces are `--ward-ground`, `--ward-canvas`,
`--ward-chrome`, `--ward-subtle`. **The correction has not landed in the plan text.**

⚠️ **This compounds with the earlier finding.** Even after `String.raw` fixes the regex,
`resolve("--ward-panel")` finds no alias, `expect(alias).toBeTruthy()` fails, **and Task 1's
contrast test is still red before any mutation** — so the mutation proof is still invalid. Both
fixes are needed; either alone leaves the step a ritual.

### ⚠️ 2. Task 4b declares consuming `.panel` and `.chip`, but its CSS composes nothing

The seven classes (`.field`, `.hint`, `.pending`, `.step`, `.wardName`, `.hero`, `.heroFigures`)
carry no `composes` at all. So either the _Consumes_ line is inaccurate, or the intended
composition is unimplemented. **This is the one place a cross-file `composes …from` would have been
required, and it is absent — resolve which was meant before 4b lands.**

### 3. Naming residue

`tests/ward-primitives-shared.test.ts` tests `ward-shared.module.css`. Not a broken reference, but
the test's name points at a module that no longer exists.

### Nulls, named explicitly

- **Cross-module `composes`: NOTHING FOUND.** The single bare `composes: chip` (plan:722) sits in a
  block headed _"appended to ward-chip.module.css"_, and `.chip` is declared at plan:544 in a block
  headed the same — **same file, so it resolves.** The three `composes: wardTokens` all carry
  `from "./ward-tokens.module.css"`. The thing predicted most likely to have broken did not.
- **Dangling `ward-primitives.module.css`: NONE as a stylesheet target.** The remaining mentions are
  the test filename above and one prose line recording the history.
- **Task 5's module names: EXACT.** `["ward-panel","ward-chip","ward-figure","ward-shared"]` matches
  the four created modules character for character, with `ward-tokens.module.css` named separately.
- **Spacing absurdity: NONE.** Every usage is sensible at 1 unit = 1px: panels 16px and 12/16px,
  chips 2/6px, gaps 2–12px. Two values are _tight_ (2px vertical chip padding, a 2px gap) and worth
  looking at on screen, but none is wrong. Note the diagnostic: at 1 unit = 1rem, `--ward-space-16`
  would be **256px** of panel padding — visibly absurd. The values were in fact written for a pixel
  scale whatever the belief was.

## Adversarial review of the landed foundation (`6c7f830f4..5071b76c4`)

### ⚠️ 1. A token "declared" only in a comment satisfies the phantom-token check

`tests/ward-design-language-contract.test.ts:163`

```js
const declared = new Set([...tokens.matchAll(/(--ward-[\w-]+)\s*:/gu)].map((m) => m[1]));
```

Run, not read:

```
"/* --ward-ghost: never really declared */"  ->  declared includes "--ward-ghost" : true
```

**Surviving mutation:** use `var(--ward-ghost)` in a primitive module and put
`/* --ward-ghost: 1px */` anywhere in the token file. The subset check passes, the token does not
exist, and the property renders empty — **the exact defect this assertion was added to catch,
walking through it.** The same hole exists in the local-declaration escape at `:173`.

**Fix:** strip `/* … */` before both matchAll passes.

### ⚠️ 2. `.kindChip { composes: chip }` is unowned, and unassertable as the tests are built

`ward-chip.module.css:29`. Nothing in `tests/` asserts the composition exists or resolves — the
only `composes` assertions in the suite belong to unrelated files.

⚠️ **And a DOM test cannot own it.** Composition is resolved by the CSS-module compiler; in jsdom
the imported style object is a proxy, so `toHaveClass` sees a fabricated name whether or not any
composition happened. **Split the two classes into separate modules without adding
`from "./ward-chip.module.css"`, and every test still passes** — only a real build would notice.

**Cheapest guard, and the only level at which it is observable:** a text assertion that
`ward-chip.module.css` contains `composes: chip;` **and** declares `.chip` in the same file, so
separating them fails loudly.

### ⚠️ 3. The one DOM assertion that leans on the proxy

`tests/ward-figure.dom.test.tsx:16`

```js
expect(screen.getByText("12")).toHaveClass(/figureValue/u);
```

`.figureValue` does exist (`ward-figure.module.css:22`) and the component uses it. **But the proxy
fabricates a scoped name for any property**, so:

- **delete `.figureValue` from the CSS entirely** → `styles.figureValue` still yields a name
  containing "figureValue" → **still passes**
- **rename the component's reference to `styles.figureValueTypo`** → still matches `/figureValue/`
  → **still passes**

The assertion proves the component references _a_ class whose name contains that substring. It
cannot prove the class exists or carries any style.

### ⚠️ 4. `KNOWN_BREAKPOINTS` is values-only, and its comment claims otherwise

```js
const KNOWN_BREAKPOINTS = ["40", "40.0625", "52", "60", "64", "76", "84", "90"];
const surprises = bp.filter((v) => !KNOWN_BREAKPOINTS.includes(v));
```

The comment beside it says it is _"the same shape as KNOWN_BACKLOG above: a count would stay green
if a breakpoint moved between files, or if the walk silently narrowed."_ **KNOWN_BACKLOG entries are
`file: .class`; these are bare numbers.** So `40` moving from `ward-panel` to `ward-chip` is
invisible, and a narrowed walk shrinks `bp` leaving `surprises` empty. The stated protection is not
the one implemented.

### 5. The hex detector, minor

`/#[0-9a-fA-F]{3,8}\b/gu`, all confirmed by running it:

- **false positives:** a hex inside a comment, and a CSS id selector `#abc { }`
- **false negative:** a 9-or-more-character hex (`#1234567890`) matches nothing — `\b` fails and it
  backtracks off the end

`rgb()`/`hsl()` literals are also unflagged, but the assertion is named "no raw hex", so that is
honest scope rather than a defect.

### Nulls, named

- **`KNOWN_BACKLOG` tolerating a whole file: NOTHING FOUND.** Entries are `file: .class` compared by
  exact string equality, so a _different_ class in a pinned file is a surprise and fails. The
  specific worry does not apply. (It does not detect a _fixed_ backlog item — the entry goes stale
  and stays tolerated — but that hides no violation.)
- **The `font-family` regex: NOTHING FOUND.** `/font-family:\s*(?!var\()\S/u` is correct in both
  directions and also handles a newline between the colon and the value.
- **Other DOM tests leaning on the proxy: NOTHING FOUND.** `ward-panel.dom.test.tsx` and
  `ward-primitives-shared.test.ts` contain no `toHaveClass`, `styles.` or `className` assertion at
  all; `ward-chip.dom.test.tsx` documents the proxy hazard in a comment and avoids it. Item 3 is the
  only instance in the four files.

## Review of the two screen plans (community/ED, patient/ward)

Two findings were sent mid-build and are recorded above in summary: the sensitive-fields placement
guarantee had two halves and only one was asserted; and the community plan's premise — _"there is no
community-scoped projection"_ — is false at the same commit (`ward-referral-visibility.ts:246`,
`:381`, `:412`, whose own comment at `:64` calls it a THIRD projection).

### ⚠️ 3. The statistics mockup's "What is real" section says six EDs. There are eight.

The plan states _"the repository holds **eight** emergency departments, and the prototype's 'of 8' is
correct"_. **The plan is right.** Counted from `ward-sites.ts`:

```
rph-ed · SCGH · fsh-ed · arm-ed · SJG Midland · Rockingham · Joondalup · peel-ed   = 8
```

`mockup-statistics.html`'s footnote lists, under **What is real**: _"9 wards across 6 hospitals …
and their **6 named emergency departments**, from this repository's ward model."_

⚠️ **A wrong number in the "what is real" list is worse than a wrong number in the invented list.**
The invented list is a disclaimer; the real list is a claim of provenance, and it is the half a
reader trusts. Two of the eight departments are missing from a sentence asserting they come from the
model.

⚠️ **And this is a gap in my own earlier review of that footnote.** I checked that every figure
_rendered_ was _listed_ — completeness of the disclosure — and never checked whether the items listed
as REAL were true. Same shape as the `--ward-panel` miss: I verified the mechanism and not the data
it carried.

### Nulls, named

- **ED visibility assumed decided: NOTHING FOUND.** Tasks 4, 5 and 6 make no reference to
  `wardScopedReferral`, an ED-scoped projection, or visibility at all — they concern a figure strip,
  two colliding "2 of N" figures, and a hero with service bands. Verified with a control (the task
  headings list) so the empty result is not a broken search. The ED plan does not assume ED
  visibility is settled because it does not touch visibility.
- **`*.test.tsx` outside the collected globs: NOTHING FOUND.** All eight test files named across both
  plans are `*.dom.test.tsx` or `*.test.ts`.
- **`toHaveClass(styles.x)`: NOTHING FOUND.** Zero occurrences in either plan.
- **`RegExp` from a template literal without `String.raw`: NOTHING FOUND.** Zero in either plan.

### Worth copying, not a finding

The community plan's Task 3 mutation step carries: _"⚠️ **Report the collection count** — a red with
`Tests no tests` is a parse error, not a catch."_ That is anti-vacuity applied to the _mutation_
rather than to the assertion, and it closes the exact hole that made two mutation reports
unreliable earlier in this project. It belongs in every mutation step, not just this one.

## The leading-scale mapping table (2026-09-04)

Measured at `bc5e13c78`. **The single most consequential artefact of the adoption programme:** a
name-based mapping of local leading tokens onto the shared scale is wrong in **8 of 17 cases,
across 6 of the 11 files**, and every wrong one renders plausibly.

```
SHARED  compact 1.1 · tight 1.15 · dense 1.25 · ui 1.3 · copy 1.35 · body 1.4 · relaxed 1.45 · prose 1.55

CORRECT by name (8)
  --{wb,dc,es,ho,mp,of,tr,co}-leading-body  1.4  -> body      ✅
  --co-leading-compact                      1.1  -> compact   ✅

WRONG by name — same name, different value (5 live, 1 dead)
  --oa-leading-body    1.45 -> body 1.4     must be RELAXED   (4 selectors)
  --ss-leading-body    1.45 -> body 1.4     must be RELAXED   (6 selectors)
  --co-leading-tight   1.2  -> tight 1.15   nothing at 1.2 — keep local
  --co-leading-prose   1.5  -> prose 1.55   nothing at 1.5
  --of-leading-prose   1.5  -> prose 1.55   nothing at 1.5
  --tr-leading-prose   1.5  DEAD, no consumer — delete, do not map

NO SHARED EQUIVALENT (2)
  --wb-leading-figure    1  nearest compact 1.1 — 10% taller
  --mp-leading-headline  1  nearest compact 1.1 — 10% taller
```

⚠️ **The three shared names that LOOK safe — `body`, `tight`, `prose` — are exactly the three where
a name-match is wrong somewhere.** Ward Builder Three's sharpening is the mechanism rather than the
statistic: _it is worse than a coin flip, because those three are the names an adopter is least
likely to stop and check._ An unusual name invites a look at the value; an obvious one does not.

**Both tokens at `1` carry committed comments explaining the value** (a figure that "sits alone on
its line"; a bare `line-height: 1` that turned a contract gate red). **A committed comment
explaining a value is the strongest possible signal not to map it, and no value-matching script can
read one.** The rule is therefore: map by value, then check the role, and a comment beats both.

## The fold-pairing rule

Each adoption group produces **two** commits: the stylesheets stop painting, and the shared pin
loses their rows. `COVERING_THE_GROUND` asserts in **both** directions.

- **stylesheets first** → files stop painting while still named → `freed` goes red
- **pin first** → rows leave while files still paint → `added` goes red

**There is no safe order. Each group folds as one unit, with no other group's commits between** —
and because the pin is a shared file, the pairs cannot interleave across groups either. Three groups
in the wrong interleaving is four red states, none of them a real defect, and _a red that is not a
defect is how a real one gets waved through._

⚠️ **The two-sided pin — the thing that has caught three stale-row failures — is precisely what
makes these commits inseparable.**

## ⚠️ Expired observations: the asymmetry that decides which to date-stamp

Ward Builder Three's formulation, recorded because it names the verifier's own failure mode:

> _An expired observation that says "this is broken" gets checked, because acting on it means doing
> work and somebody looks first. An expired observation that says "your evidence does not count"
> gets believed, because acting on it means NOT trusting something, and nobody audits a decision to
> be careful._

All three of this session's expired observations were of the second kind — "the detector cannot see
this", "the pin is stale", "they diverge under forced colours". **A claim that REDUCES someone's
confidence needs its ref stamped harder than one that raises an alarm, precisely because nobody will
challenge it — challenging a caution looks like carelessness.** That inverts the natural instinct.
