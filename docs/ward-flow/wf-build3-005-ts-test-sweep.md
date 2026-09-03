# WF-BUILD3-005 — the 89 `tests/ward-*.test.ts` files, read for checks that cannot fail

**Status: COMPLETE — 89 of 89 files read in full, 14 of 14 readers returned.** It was committed
three times while incomplete, deliberately: a sweep held back until it is finished is a sweep that is
lost when the session is, and the earlier DOM sweep survived only because it was written down before
it was complete.

**Method, unchanged from `wf-build3-004-dom-test-sweep.md` because that is what made it
trustworthy:** enumerated from disk with a sibling control, every file read in full rather than
sampled, a verdict for every file including the clean ones, and **a named falsifying production
change for every finding** — an edit somebody could plausibly make to `src/`, after which the test
still passes and the property in its title is false. Suspicions, where no such edit could be named,
are listed separately and are not counted as findings. **Nothing was fixed.** Fixing belongs to the
owning chat.

## The enumeration, and its control

```
ls tests/ward-*.test.ts            → 89 files, 32,824 lines
ls tests/ward-*.dom.test.tsx       → 56 files   (the sibling family, swept separately at de387bd1d)
tests/ward-*.test.ts matching .tsx → 0
```

**The third line is the control, and it is the one that matters.** A `.ts` glob silently capturing
or silently missing `.tsx` files is the exact hole that produced a wrong count earlier in this
programme. Proving the negative — that the glob captures no `.tsx` — is checkable; remembering to be
careful is not.

## ⚠️ THE SWEEP WAS TAKEN AGAINST THIS BRANCH, NOT AGAINST THE MASTER LINE — TWO KNOWN DEFECTS

**Read at `claude/ward-builder-three`, which was 33 commits behind
`codex/task-ward-flow-live-state-20260831` when this was measured.** The enumeration control above is
correct **for this branch** and the glob negative holds. But the denominator is a fact about a branch,
and I did not check it against the integration line until after the sweep was complete. Two things
fell out, both found by that check and neither by the sweep:

**1. The master line has 90 ward `.ts` test files, not 89.** `tests/ward-traps-numbering.test.ts`
exists there and not here, **so it was never swept.** The 89 was never wrong about this branch and was
never right about the repository. ✅ **CLOSED — swept at the master line, see Batch 15. Two findings.**

**2. `tests/ward-referral-visibility.test.ts` was read four master-line commits stale**, with 227
lines changed since. **Every finding in §14.1–14.2b against that file was therefore provisional.**
✅ **CLOSED — rechecked at the master line, see Batch 15. Two of the four survived unchanged, one was
corrected, and one is now a ruled-on limitation rather than a gap.**

_(`tests/ward-nav.test.ts` also differs, but in the other direction — the two commits are mine, the
master line has none. Its findings were read against this branch's version, which is the master line's
plus my own failure-message split. No staleness there.)_

⚠️ **The general form, because it will outlive these two instances: a sweep's coverage claim is
scoped to the ref it was taken on, and a builder branch is not the ref anybody integrates.** State the
SHA with the count, and diff the file list against the integration line **before** reporting, not
after. `git diff --name-only <master-line> HEAD -- '<glob>'` costs one command and is the difference
between a denominator and a guess.

### ⚠️ 3. AND THE STALENESS IS TEMPORAL, NOT ONLY POSITIONAL — THE FIRST CHECK MISSED THAT

The check above compares this branch against the integration line **as they stand now**. That is the
wrong question, and it let a second class through. **The right question is what has changed since the
readers actually read it**, because a file can be identical on both branches today and still have
been different when it was swept.

Ward Builder One found the instance: a governance finding I raised was **already fixed on
2026-09-01**, and the fix is recorded in that file's own comment in past tense. My analysis was
correct — _"a `NaN` passes"_ — **about a version that no longer exists.**

**Measured, at the two sweep commits:**

```
.ts sweep    read at b5205b45a   →   4 of 90 files have changed since
DOM sweep    read at de387bd1d   →   6 of 56 files have changed since
                                     ward-board-discharge · ward-board-people-panel
                                     ward-daily-sheet · ward-ed-screen
                                     ward-governance · ward-screen-fd23-leaks
plus                                 5 ward-management SOURCE files changed since
```

⚠️ **That last line matters as much as the other two: every falsifier in this document names a
production file and often a line number.** Five source files under `src/components/ward-management/`
have moved since the readers cited them, so **a line reference in a falsifier may now point at
different code.**

**So: 10 of the 146 swept files, and 5 of the cited source files, were read at a state that no longer
holds. Every finding on those is PROVISIONAL and must be re-read at the integration line before it is
acted on.** Ward Builder One's framing is the right one for the ledger: a finding overtaken by
somebody else's fix is **CLOSED-ALREADY, not NOT-A-FINDING.** The analysis reproduced, the defect was
real, and somebody got there first — that is not a false positive and must not be counted as one.

⚠️ **AND THE FILE-TYPE BIAS TRAVELS WITH ALL 131.** Every candidate guard found so far — six of six —
sits in a `.dom.test.tsx` or a `ui-*.spec.ts`. **This sweep read neither family.** So its findings are
**systematically biased toward mis-attribution**, because the guard that would exonerate them lives
in file families it never opened. That is not a flaw in the method; it is a scope fact, and it has to
travel with every finding rather than be rediscovered per triage chat.

## Running totals

|                                                   |                             |
| ------------------------------------------------- | --------------------------- |
| Files read in full                                | **89 of 89** (32,824 lines) |
| Files with findings                               | 71                          |
| Files clean                                       | 18                          |
| **Numbered findings across the fourteen reports** | **129**                     |
| Suspicions (no falsifier nameable)                | 62                          |

## ⚠️ READ THIS BEFORE USING ANY FINDING BELOW — TWO DIFFERENT THINGS ARE COUNTED AS ONE

**A test whose title claims a property its assertions cannot distinguish is NOT the same thing as an
unguarded property, and this document does not reliably tell them apart.** The distinction is Ward
Builder One's, established by measurement on 2026-09-02, and it changes the remedy:

|                         | What it is                                                                                                                       | What it needs                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Mis-attributed**      | The property IS guarded — by a static test, a sibling file, a type, another gate — but **not by the test whose title claims it** | **An honest rename.** Nothing is at risk. |
| **Genuinely unguarded** | No test anywhere goes red                                                                                                        | **A new test.** Something is at risk.     |

**The worked case.** `ward-statistics-sections.dom.test.tsx` claimed to prove a screen resolves its
ward from live provider state. It could not — no dispatchable event can make live state differ from
seed state in anything that screen renders, so the test was never able to prove its title. **But
pointing the screen at `allUnits()` directly — the exact defect the title claimed to guard — turned
`tests/ward-flow-single-source.test.ts` RED.** The property was guarded the whole time, by a static
single-source test. **The honest verdict was "the test was lying about its own job", not "nobody was
watching."**

⚠️ **Every finding in this document is of the first kind — a named edit after which THAT test passes
and ITS title is false. That is what was measured. Whether some OTHER test would go red was checked
opportunistically, not systematically.** Where a reader found a mitigation it is written in
(_"compensated by…"_, _"backstopped by…"_, _"cross-covered by…"_), and roughly a third of the
findings carry one. **The absence of such a note is NOT evidence that no guard exists** — in most
cases nobody looked.

**So: before writing any finding here up as a gap, run the mutation and see what else goes red.** It
costs one edit and it tells you whether anything is actually at risk. **A count of 129 "checks that
cannot fail" is an honest count of tests that cannot fail. It is NOT a count of unguarded
properties, and must never be quoted as one.**

⚠️ **The 129 is the count in the readers' reports; this document does not carry all 129 verbatim.**
Every file's verdict is here, and every finding whose falsifier is sharp or whose consequence reaches
a screen. Where a reader raised several instances of one shape in one file, they are consolidated.
**The reports themselves are the primary record** — if a number here is used to argue anything, go
back to them rather than to this summary. Sixty of these were reported to Ward Lead as they landed.

---

## Batch 1 — 7 files, 2,312 lines

| File                                  | Verdict                     |
| ------------------------------------- | --------------------------- |
| `ward-movement-blocker.test.ts`       | FINDINGS (1)                |
| `ward-statistics-derivations.test.ts` | FINDINGS (1)                |
| `ward-board-derivations.test.ts`      | CLEAN (1 suspicion)         |
| `ward-referral-suburb-pin.test.ts`    | FINDINGS (1)                |
| `ward-management.test.ts`             | FINDINGS (1) (2 suspicions) |
| `ward-sidebar-phone-contract.test.ts` | FINDINGS (1) (1 suspicion)  |
| `ward-restriction-notice.test.ts`     | FINDINGS (1)                |

### 1.1 — `ward-movement-blocker.test.ts` · "is restated at every transition, so it can never describe an earlier stage"

Every step compares against `STAGE_TRANSITION_BLOCKERS.<key>` — the same constant object the reducer
writes from. The walk therefore compares the reducer against itself **by key**, and the actual
sentences are never pinned.

**Falsifier:** in `ward-flow-reducer.ts:121` set `accepted: "Awaiting destination response"` —
byte-identical to `referred` on line 119. Every step still passes, because each compares to its own
key. A movement a ward has accepted and pulled then renders _"Awaiting destination response"_ on the
console's Response line — literally describing an earlier stage, which is the one thing the title
promises cannot happen. No test anywhere in `tests/` pins those two literals; the reader ran a
known-positive control first (`"None — in transit"`, 5 hits, same command shape and same em dash)
before concluding the absence was real.

### 1.2 — `ward-restriction-notice.test.ts` · "flags a voluntary patient on a locked ward" and "prefers the voluntary warning when both would apply"

`restrictionNotice` (`ward-derivations.ts:400`) returns `undefined` for any non-Secure unit **before**
reaching the voluntary branch. No test in the file passes a Voluntary movement with a non-Secure
unit — the only `toBeUndefined()` case uses a non-voluntary movement. The word _locked_, in both the
level name and the notice text, is unguarded.

**Falsifier:** hoist the voluntary branch above the security guard. All four tests stay green, and
every voluntary patient now carries _"Voluntary patient on a locked ward — review legal status
before admission"_ against **open** wards too. That is a false legal-status alarm on every open-ward
candidate and, through `eligibleCandidatesAmong`'s restrictedness tie-break
(`ward-derivations.ts:466`), it silently demotes the correct open wards in the coordinator's
shortlist.

### 1.3 — `ward-management.test.ts` · "labels the match and the mismatch by what was compared, and nothing more"

The test decides which pair is "matching" using `siteByCode(unit.siteCode)?.service` and
`movementHealthService(movement)` — character-for-character the expression inside `originServiceFit`
(`ward-management-network.ts:201`). The oracle is the implementation.

**Falsifier:** give `movementHealthService` a fallback of `"North Metro"`. Every movement with an
unresolvable origin ED is then declared to share a health service with every North Metro ward, on a
screen row headed _origin service fit_. Function and oracle move together; both named cases still
find a pair; green.

### 1.4 — `ward-sidebar-phone-contract.test.ts` · "gives the sidebar its own grid track" and "reserves the fixed phone bar's height in every shell it floats above"

Both assert `toEqual([])` over a **self-selected** file set: `shellFiles` is whatever contains the
literal `minmax(0, 1fr);`. The only guard is `toBeGreaterThanOrEqual(9)`, and the real set measures
**21** — so twelve shells can leave the scan with the sanity check still green.

**Falsifier:** in `board/board.module.css:94` change `grid-template-columns: auto minmax(0, 1fr);`
to `grid-template-columns: 4.5rem 1fr;`. That is **exactly the defect the first test names** — a
shell hard-coding the rail width — and the same edit removes the file from the scan set, so it is
also no longer checked for phone-bar padding. 20 ≥ 9; green.

### 1.5 — `ward-referral-suburb-pin.test.ts` · "the picker offers every honest 'not known' answer"

The expectation is read from `suburbUnknownLabels` — the same map the component renders from — and
the matcher is a substring.

**Falsifier:** set `not_known: ""`. React renders an option with an empty label; the probe string
becomes `"><"`, which **is** a substring of the option's closing tag. Green, while the picker offers
a blank unreadable option — which the assertion's own message calls "an answer they cannot choose".

### 1.6 — `ward-statistics-derivations.test.ts` · "finds seeded movement declines, so the withheld-not-absent claim describes a real world"

`expect(decline.unitId.length).toBeGreaterThan(0)` stands in for _"every decline names a unit"_. A
non-empty string is not a unit.

**Falsifier:** rename any unit id in `ward-sites.ts` without updating the declines in
`ward-movements.ts`. The declines point at no existing ward, the argument the test exists to defend
is false, and `.length > 0` stays true. The fix shape already exists in-repo: resolve through
`unitById`.

---

## Batch 2 — 5 files, 2,320 lines

| File                                        | Verdict                                       |
| ------------------------------------------- | --------------------------------------------- |
| `ward-flow-chat-control.test.ts`            | FINDINGS (3)                                  |
| `ward-away-at-emergency-department.test.ts` | FINDINGS (1) (1 suspicion)                    |
| `ward-withdrawal-reason-privacy.test.ts`    | FINDINGS (2) — **and it is the privacy file** |
| `ward-seed-reaches-every-branch.test.ts`    | CLEAN (1 suspicion)                           |
| `ward-flow-sandbox.test.ts`                 | FINDINGS (2)                                  |

### 2.1 — `ward-flow-chat-control.test.ts` · "validates the checked-in control plane without assuming it will stay empty"

Three assertions: a count at least zero, another count at least zero, and a sha256 being 64
characters long. A count is non-negative by construction; a hex sha256 is 64 characters by
construction. The title says _without assuming it will stay empty_ and then asserts nothing that
distinguishes empty from full — the live plane holds 2 handovers and 2 certificates, so a real
assertion was available.

**Falsifier:** break `listCertificatePaths` in `chat-control.mjs` so it matches the wrong suffix and
returns an empty list. Every committed reset certificate then goes unvalidated and all four
assertions pass. `missingCommittedHandovers` does not catch it — both of its inputs come from the
same broken lister.

### 2.2 — same file · "pins exactly three roles, one sole integrator and the activation gate the live state has reached"

Both expectations are read out of the same two production files as the actuals, **after**
`validateSystemState` has already reconciled them. The assertion agrees with production _data_, not
with production _logic_.

**Falsifier:** weaken the evidence check at `chat-control.mjs:773` from a JSON comparison to a length
comparison. Three copies of `recovery-bundle` then satisfy the Builder activation gate. The
`premature` control still throws its expected message, because its evidence array is empty and 0 ≠ 3,
so it does not notice.

### 2.3 — same file · "accepts only complete gate-runner receipts with a recomputed key"

The candidate's key is built with `receiptKey(...)` and the validator recomputes it with the same
`receiptKey`. Both sides move together; nothing pins the algorithm's inputs.

**Falsifier:** drop `environmentHash` from the hashed tuple in `gate-receipts.mjs:354`. A receipt
recorded under a different environment is then replayed as a pass. _Honest caveat, the reader's own:_
`tests/gate-receipts.test.ts:257` compares five keys pairwise and would likely go red — which is the
point, because this file's own check contributes nothing.

### 2.4 — `ward-away-at-emergency-department.test.ts` · "moves no capacity figure, in either direction"

Asserted entirely on `unitCapacity`, whose own doc comment (`ward-derivations.ts:355`) states that
**nothing renders it any more** and that every screen renders `capacityBreakdown()` instead — which
reads a fourth input, `state.leaveBeds`, that this test never compares. The comment above the test
claims it is _"asserted on the real derivation a coordinator reads"_. It is not.

**Falsifier:** have `RECORD_AWAY_AT_EMERGENCY_DEPARTMENT` also append a `LeaveBed` row — a natural
modelling choice, since the person is off the ward and `state.leaveBeds` already exists. Every figure
a screen renders through `capacityBreakdown` moves; the three things this test compares are
untouched; the invariant in the title is broken green.

### ⚠️ 2.5 — `ward-withdrawal-reason-privacy.test.ts` · the FD-23 guard — CORRECTED, and it survives only in its narrower half

⚠️ **I relayed this finding to Ward Lead in a stronger form than the reading supported, and a triage
pass falsified the stronger form. The correction is here rather than in a footnote because the
stronger form is the one that travelled.**

**What I said, and it is WRONG:** _"restore the interpolated withdrawal reason naming the receiving
unit and all three guards stay green."_ **That edit IS caught.** `ward-withdrawal-reason-privacy.test.ts`
lines 154–190 dispatch `REFER_TO_UNITS` then `ACCEPT_IN_PRINCIPLE` through the **real reducer** and
assert on live output:

```ts
expect(WITHDRAWAL_REASONS).toContain(entry.reason);
```

An interpolated string is not a member of that two-element enum, so the assertion **fails outright.**
That test exercises the exact code path, and I criticised a different test in the same file without
reading the one that does the work.

**What survives — the incomplete-forbidden-list half, and it is narrower than I made it sound.** The
label check at line 64 **is** live and **is** applied to every unit name:
`expect(withdrawalReasonLabels[reason]).not.toContain(unit.name)`. But `allUnits()` returns **units
only.** Nothing is checked against the **site name** ("Rockingham General Hospital"), the **site
code** ("RGH"), the **unit id**, or the **ED name**.

**Falsifier, and it is the one that still works:** add `accepted_elsewhere_in_network` to
`WITHDRAWAL_REASONS` with the label _"Withdrawn — a bed was confirmed at Rockingham General
Hospital."_ It **is** a real enum member, so the membership check passes. It contains no `unit.name`,
so line 64 passes. "confirmed" is not in the `assertsAMove` vocabulary, so that passes. **FD-23 is
violated by a SITE name where a unit name would have been caught.**

**The dead assertion is still dead** — `expect(reason).not.toContain(unit.name)` cannot fire, because
the file's own first test pins reasons to `/^[a-z_]+$/` and every unit name has spaces and capitals.
**But it is harmless**, because the live label check sits on the very next line. A dead assertion
beside a live one is a tidiness problem, not a hole.

**(a) An assertion that cannot fire.** `expect(reason).not.toContain(unit.name)` — the first test in
the file pins every reason to `/^[a-z_]+$/`, and every `unit.name` in `ward-sites.ts` contains spaces
and capitals ("RGH Adult Secure", "FSH Older Adult"). While the regex test passes, this assertion is
**provably incapable of failing**, in all three tests that make it, with no positive control anywhere
proving the probe can fire.

**(b) The forbidden list is incomplete.** `allUnits()` returns units only. Nothing is checked against
the **site name** ("Rockingham General Hospital"), the **site code** ("RGH"), the **unit id**
(`rph-adult-secure`) or the **ED name**. Control: grepping the test for `siteCode|wardSites|allSites`
returns nothing while the same pattern hits `ward-sites.ts` — the query works, the coverage is
absent.

**Falsifier:** add `accepted_elsewhere_in_network` to `WITHDRAWAL_REASONS` with the label _"Withdrawn
— a bed was confirmed at Rockingham General Hospital."_ and have `ACCEPT_IN_PRINCIPLE` write it when
the winning unit is at another site. Every assertion passes: the code matches the lowercase regex,
the label contains no `unit.name`, the label map stays complete, and the exact-wording pin covers
only the other reason. **FD-23 is violated exactly as originally — the losing ward reads where the
patient went.**

### 2.6 — same file · "has exactly one withdrawal writer, because the label is only conditionally true"

The scanner is mechanically correct — the global flag is present and the comment stripper has
both-direction controls — but its **scope is one file** while its claim is about the whole system.
`ward-movements.ts` contains 21 `withdrawnReferrals:` sites and at line 212 writes
`reason: "another_unit_accepted"`. A cause-writer already exists outside the counted file.

**Falsifier:** seed a second withdrawal whose real cause is a referrer retraction, tagged
`another_unit_accepted`. The reducer count stays 3, the test stays green, and a ward screen renders
_"another unit accepted this patient"_ over a withdrawal that no unit accepted — precisely the quiet
falsehood the test's own message says it exists to prevent.

### 2.7 — `ward-flow-sandbox.test.ts` · "no longer exists as a public app route"

Asserts that `src/app/ward-management` does not exist on disk. The `__dirname` anchoring defends
against working-directory drift, as its comment says; nothing defends against the path spelling being
the wrong place to look. **This repo already uses a Next.js route group** — `src/app/(search-app)` —
and route-group segments do not appear in the URL.

**Falsifier:** re-create the page at `src/app/(search-app)/ward-management/page.tsx`.
`/ward-management` is publicly reachable again as a clinical route, the `existsSync` is still false,
and the test is green.

### 2.8 — same file · "is on the developer-gated prefix list, so production reaches the admin gate not a 404"

Asserts membership in a constant. The behaviour the title claims lives in `src/proxy.ts`, which the
test never calls.

**Falsifier:** narrow `proxy.ts:133` to exempt `/mockups/ward-flow`, or remove `/mockups` from the
proxy matcher config. Ward Flow falls to the blanket production block — a 404, not the admin gate —
with the constant unchanged and this test green.

---

## Batch 3 — 6 files, 2,327 lines

| File                                       | Verdict                     |
| ------------------------------------------ | --------------------------- |
| `ward-nav.test.ts`                         | FINDINGS (3) (4 suspicions) |
| `ward-discharge-dates.test.ts`             | FINDINGS (1)                |
| `ward-bed-availability.test.ts`            | FINDINGS (3)                |
| `ward-urgent-flag.test.ts`                 | FINDINGS (1)                |
| `ward-transport-cancel-permission.test.ts` | CLEAN (1 suspicion)         |
| `ward-release-band-day-boundary.test.ts`   | FINDINGS (1)                |

### 3.1 — `ward-nav.test.ts` · "every dynamic Ward Flow route is referenced by at least one link in src/" — **the scanner's regexes match comments**

The quote character class includes the backtick. The file's only anti-prose defence is a leading
bracket exclusion, which stops a backticked _route pattern_ but **not** a backticked concrete path or
template literal inside a doc comment. This codebase writes backticked paths in comments constantly.

**Falsifier:** revert `patient-search.tsx`'s person rows to inert list items — the exact prior state
this file's own orphan record describes — and leave the house-style comment behind recording the href
that used to be there. Every test in the block stays green. `/people/[patientId]` becomes reachable
by typed URL only. **The same hole covers `movements/[movementId]`, `community/[teamId]` and both
`statistics/*` routes**, all of which rest entirely on the template-literal match.

⚠️ **This is NOT the documented "a nought means the scan cannot see it" behaviour.** That one is a
false negative by design, and it is correct. This is a **false positive** — the scan reporting a link
that does not exist.

### 3.2 — `ward-nav.test.ts` · the D11 clinical-exit source list is hand-maintained

`readFileSync` throws if a listed file disappears, but a **new** file rendering sidebar links is
never scanned — in contrast with the route scan two hundred lines above, which is enumerated from
disk precisely because a hand-written list is "the shape of the D8 defect". And the exit probe is two
literal substrings.

**Falsifier, either one alone:** extract the rail's bottom block into a new `ward-rail-footer.tsx`
and put the clinical link in it; **or** hold the href in a `const` and interpolate it, so neither
literal substring appears. Either breaks the sandbox rule the owner stated, and both D11 tests stay
green. The non-vacuity clause only proves the _legitimate_ exit is still present; it says nothing
about the probe's ability to see an illegitimate one.

### 3.3 — `ward-nav.test.ts` · instance ids are never resolved against the fixture

`routeToPattern` turns `[unitId]` into a wildcard, so `/ward/anything` "resolves". The three
example-only hrefs and the renderable-route props are literal strings, never compared against
`allUnits()` — unlike `wardPatients[0].id`, which is derived and therefore safe.

**Falsifier:** rename `rph-adult-secure` in `ward-sites.ts`. The rail's two seeded example links now
point at nothing, and everything stays green — **because `WardScreen` renders a not-found `<main>`
for an unknown unit** which still carries the expected landmark label exactly once. The render test
cannot tell _"this route renders its screen"_ from _"this route renders a not-found page"_.

### 3.4 — `ward-bed-availability.test.ts` · "ends the evening shift at 22:00, expressed once"

**Nothing in production reads `EVENING_SHIFT_END_MINUTES`.** `releaseBand` bands on midday, late
afternoon and the day length; everything after 16:00 falls through to _tonight_ with no upper bound
at all. The only other occurrences in `src/` are two prose mentions. A literal compared to a literal.

**Falsifier:** move the tonight cut-off in `releaseBand`, or give `discharge-board.tsx` its own inline
`1320`. The stated property — that the boundary is expressed once — is false and the test is green.
**It cannot go red for any change to when the evening shift ends, because no behaviour depends on the
number.**

### 3.5 — `ward-bed-availability.test.ts` · "counts an unusable leave bed in neither figure"

Only one of the two figures the title names is ever read.

**Falsifier:** add the unusable-leave-bed count into `availableNow`. Checked against every other case
in the file: the usable-leave test passes a usable bed so the added term is zero there, and every
other comparison passes an empty leave list. **An unusable leave bed is then offered as a bed you can
fill this minute**, which the module's own header calls a structural rule.

### 3.6 — `ward-bed-availability.test.ts` · "sweeping the whole owner-approved list"

A `for` loop over `BED_PREPARATION_NOTES` with no non-emptiness guard. Two members today.

**Falsifier:** empty the list. It is plausible precisely because the note vocabulary is an owner-owned
list, documented as having members arrive and be withdrawn. The test then sweeps nothing, keeps its
title, and stays green — and the only remaining preparation coverage is the boolean test above it, so
a figure keyed on the note text is thereafter unguarded.

### 3.7 — `ward-urgent-flag.test.ts` · "puts a flagged tier-3 patient ahead of an unflagged tier-1 patient"

Every assertion is `indexOf(a) < indexOf(b)`, and **`indexOf` returns −1 for an absent element, which
is less than every valid index.** `queueOrder` opens with a filter, so removal from the returned array
is a live possibility rather than a hypothetical.

**Falsifier:** hoist flagged movements out of the ordered queue for separate rendering — a natural
"escalated strip above the queue" refactor. The flagged patient's index becomes −1, the comparison
passes, and the test titled _"the assertion that makes the feature real rather than merely stored"_
goes green while a flagged patient has **disappeared from the queue entirely** — the opposite of
outranking everything.

### 3.8 — `ward-release-band-day-boundary.test.ts` · "still refuses to wrap a discharge a full day away into an earlier band"

The pair of negative assertions excludes 2 of `releaseBand`'s 6 possible returns. "Wrapped into an
earlier band" is satisfied just as well by the other two mid-range bands.

**Falsifier:** band tomorrow-afternoon as _tonight_. A handover then reads "this bed frees tonight"
for a bed that frees tomorrow at 15:00 — the precise harm the sibling file's comment describes.
Checked across the batch: the file's other two tests are same-day, and both of
`ward-bed-availability.test.ts`'s day-plus-one cases are **mornings**, so nothing goes red.

### 3.9 — `ward-discharge-dates.test.ts` · "counts a released bed for both units, but the statewide total only for the genuine discharge"

The assertion is a total of 1 over a two-admission list holding one genuine discharge and one
ward-to-ward transfer. **A total of 1 does not say which one was counted.** The test's own comment
argues that constructing both side by side is what stops it degenerating — but the assertion
collapses them into a scalar at the last step, throwing the discriminating information away.

**Falsifier:** invert the destination test at `ward-discharge-dates.ts:203`. The transfer counts and
the discharge does not; the total is still exactly 1; green. `grep -rn "statewideReleaseCount"
src/ tests/` returns the definition and this one test — **no second consumer and no other coverage**,
so the inversion ships silently. The fix shape the test needs is per-admission, which is exactly what
the two-sided construction was already set up for.

---

## Batch 5 — 6 files, 2,339 lines

| File                                   | Verdict                                                               |
| -------------------------------------- | --------------------------------------------------------------------- |
| `ward-referral-ed-destination.test.ts` | FINDINGS (1, three tests) — 3 of its 6 tests reach no production code |
| `ward-flow-data-boundary.test.ts`      | FINDINGS (1) (1 suspicion)                                            |
| `ward-statistics-sections.test.ts`     | FINDINGS (1)                                                          |
| `ward-priority.test.ts`                | FINDINGS (3)                                                          |
| `ward-travel-grouping.test.ts`         | FINDINGS (1) (2 suspicions)                                           |
| `ward-bed-availability-model.test.ts`  | CLEAN (1 declared limitation)                                         |

### 5.1 — `ward-referral-ed-destination.test.ts` · "separates the self-addressed inbox from the ward's medical notification — the FD-18 guard"

The header says the last test in the file **is** the guard against inferring the inbox from matching
site codes. It cannot be. The production inbox query is `edReferralsFor`
(`ward-referrals.ts:214`), and **nothing in this file imports it**. The test re-implements the
correct filter over two objects it built itself, and then verifies its own filter.

**Falsifier:** in `ward-referrals.ts`, replace the purpose test with the site-code inference. The
ward→ED medical notification lands in the psychiatry inbox — the exact conflation FD-18 names — and
every assertion in this file stays green.

_Mitigation, stated honestly by the reader:_ `tests/ward-ed-psychiatry-hub.dom.test.tsx` does call
`edReferralsFor`, so the property is guarded — **just not by the file that claims to guard it.** The
reader grepped that sibling rather than reading it, so the adequacy of that cover is asserted from a
filename match, not from a reading.

Two more tests in the same file are the same shape: one asserts a field equals the value the helper
just assigned to it, and one asserts that three literally-distinct constructed pairs produce three
distinct keys. Vitest does not typecheck, so even deleting the field from the union in `ward-model.ts`
leaves all three green.

### 5.2 — `ward-flow-data-boundary.test.ts` · "has no file outside the data layer stating a ward, site or department name"

The offender scan collects string literals and template literal fragments. **JSX text children are a
different node kind and are matched by none of those predicates.** So the single most natural way to
hardcode a hospital name into a screen is invisible to this test — and there is no positive control
anywhere proving the offender detector can fire.

**Falsifier:** in any of the 35 mockup screens, write the name as JSX text rather than as a lookup —
a heading reading _Royal Perth Hospital_, say. A second home for the fact now exists, the owner's
rename-safety property is broken, and the test stays green. Verified: all three of the obvious
hospital names are in the owned set and all are multi-word, so the multi-word filter does not exclude
them.

### 5.3 — `ward-statistics-sections.test.ts` · "finds no module under src importing ward-statistics"

The importer scan matches only the alias/deep-path import form. `ward-statistics.ts` sits in a
directory whose modules import each other **relatively** — confirmed live style at
`ward-nav-icons.ts:27`, `ward-sidebar-content.tsx:8`, `ward-management-navigation.tsx:12`. A relative
import matches neither probe string. There is also **no positive control**, so an absence is
indistinguishable from a wrong path.

**Falsifier:** add a relative import of `./ward-statistics` to any sibling in that directory and
render a ward figure. The sentence `statistics-ward-screen.tsx` puts in front of the reader — that
this function has no consumer in the app — is now false on screen, and the test that exists solely to
pin that sentence stays green.

Control run by the reader: the same probe shape against `ward-referrals` returns 5 files, so the
mechanism fires; against `ward-statistics` it returns empty, and the relative form returns empty.
Both exit 0 — real absences, not tooling failure.

### 5.4 — `ward-priority.test.ts` · "leads the real fixture with WF-018, which nothing but the flag could have put there"

The assertion is a disjunction whose right arm is _"or this movement is not flagged"_. Verified:
`flaggedUrgent: true` appears **exactly once** in `ward-movements.ts`. So the right arm is true for
every element and the predicate short-circuits to true regardless of any waiting time. **The wait
comparison never decides anything.**

**Falsifier:** change WF-018's opening time so it has the longest wait in the fixture. It would then
top the queue on waiting time alone, so "nothing but the flag could have put it there" is false —
and every neighbouring test stays green too, because WF-018 is tier 3 (so the tier-one pin is
untouched) and is filtered out of the unflagged-order test by construction.

### 5.5 — `ward-priority.test.ts` · "states the decline count without a self-contradictory fraction against the parallel cap"

A substring assertion where equality is needed. WF-009 has exactly 5 declines, and the points
calculation caps at 15.

**Falsifier:** interpolate the **points** rather than the count into the detail sentence. The
coordinator then reads _"15 destinations have declined"_ when 5 did. The string contains the expected
digit and does not contain the forbidden fraction, so both assertions pass. Green.

### 5.6 — `ward-priority.test.ts` · a duplicated test presenting as coverage

Two blocks with byte-identical bodies — same movement, same legal form, same single assertion — and
only reworded comments. Vitest registers both, so the suite reports two passes for one property. Not
vacuous on its own, but the second cannot fail for any reason the first does not.

### 5.7 — `ward-travel-grouping.test.ts` · "is the only place the match view decides what accepting means"

Two weaknesses in one check. The positive half is a substring match **satisfied by the import line
alone**, or by a comment. The negative half requires a literal dot, so the optional-chained form
evades it.

**Falsifier:** change one of the three call sites in `referral-match.tsx` to the inlined predicate,
leaving the other two. The heading count and the rows beneath it are then decided in two places and
can drift — the precise defect the test names — while the substring is still satisfied by the
remaining sites and the regex never fires.

**Worth recording: the rest of this file is the strongest in the sweep so far.** Its searches run off
the constant rather than off the function under test, its invariance sweeps carry non-collapse
floors, and its source scanner asserts a known-positive (`expect(readers).toContain(ALLOWED)`) before
trusting an absence. That is the pattern the two scanners above are missing.

---

## Suspicions — recorded, not counted as findings

Twenty-one so far. The ones worth carrying:

- **`ward-management.test.ts` "uses only synthetic identifiers and minimised fields"** — six
  `not.toHaveProperty` calls form a **denylist**, so adding a date of birth to `Movement` passes while
  the title's claim breaks. It can fail for the six named keys, so it is not a dead check — but the
  property it advertises is not the property it tests.
- **`ward-nav.test.ts` orphan-record staleness pin** — the figure it checks is interpolated from the
  same source it compares against, so the staleness it claims to prevent is impossible by
  construction. And the matcher is `toContain`: if the index ever linked exactly one ward, the probe
  would match the record's _leading_ figure and pass for the wrong reason.
- **`ward-flow-chat-control.test.ts`** — a platform-dependent expectation computed from the same
  platform predicate production reads, so only one arm is ever exercised on a given OS. And a
  published-bytes comparison against the same canonicaliser that wrote them.
- **`ward-withdrawal-reason-privacy.test.ts`** — the stripper control passes vacuously if the two
  FD-23 comments in the reducer are ever deleted. Degrades the canary rather than breaking a
  behaviour.
- **`ward-transport-cancel-permission.test.ts`** and **`ward-away-at-emergency-department.test.ts`** —
  a rejection count asserted without reading the reason, so a rejection thrown by the wrong arm
  satisfies it. Two edits to falsify, so below the bar.
- **`ward-flow-data-boundary.test.ts`** — the owned-name set filters to multi-word names. No
  single-word site or unit name exists today (all 48 checked, zero single-token), so this is latent
  rather than live; a unit named _Bentley_ or _Peel_ would silently exempt itself from the whole
  contract.
- **Redundancy that should not be mistaken for coverage** — several files follow an exact-list
  `toEqual` with strictly weaker `toContain` lines that cannot fail independently of it. No defect;
  the strong assertion is present. Recorded so a later reader does not count them twice.

## What is unswept

**65 of 89 files.** Ten readers are still working. Production files were opened only around the cited
functions; `ward-flow-reducer.ts` in particular is roughly 10,000 lines and has been read only at the
handful of cases named above. No vitest run was performed by any reader — every finding is settled by
source, and the only empirical confirmation available would have required editing production, which
none of them did. Nothing was created, modified or deleted outside this document.

---

## Batch 4 — 7 files, 2,327 lines

| File                                   | Verdict                                                             |
| -------------------------------------- | ------------------------------------------------------------------- |
| `ward-capacity-reconciliation.test.ts` | FINDINGS (2) — **both substantive tests cannot fail as advertised** |
| `ward-patient-search.test.ts`          | FINDINGS (2)                                                        |
| `ward-morning-print.test.ts`           | FINDINGS (2) (1 suspicion)                                          |
| `ward-output.test.ts`                  | FINDINGS (3) (1 suspicion)                                          |
| `ward-morning-rollup.test.ts`          | FINDINGS (1) (1 suspicion)                                          |
| `ward-withdraw-referral.test.ts`       | FINDINGS (1)                                                        |
| `ward-referral-wait-line.test.ts`      | CLEAN                                                               |

### 4.1 — `ward-capacity-reconciliation.test.ts` · "partitions each ward's beds exactly across available, held, blocked and occupied"

The sum is an **algebraic identity of `unitCapacity`'s own construction**, not a fact about the
fixture: available plus held collapses to the empty count for any allocatable value, and blocked plus
occupied collapses to beds-minus-empty for any blocked value. The sum equals the bed count whenever
the empty count lies between 0 and the bed count, **and for no other reason.** The doc comment's
claim that changing a unit's authored allocatable, held or blocked figure "must turn this test red"
is false for all three — and `unit.held` is not read by `unitCapacity` at all.

**Falsifier:** set `blocked` to a constant 0 inside `unitCapacity`. The identity still holds, the file
stays green, and **every ward's Blocked figure reads 0.** Equivalently, drop the allocatable cap on
`available`: Held goes to 0 everywhere and Available-now over-reports.

This identity and the negativity loop beneath it are also **duplicated verbatim** in
`ward-model.test.ts`, so this file adds no coverage over what already existed.

### 4.2 — same file · "never reports a negative figure in any of the five states"

Four of the five assertions cannot fail. Three figures are clamped by construction, and the fourth is
an array length — a non-negative integer by definition. Only `available`, an unclamped minimum of two
authored values, is capable of turning red.

**Falsifier:** strip the clamps. No unit authors a negative today, so the test stays green — and the
guard it names no longer exists. The first fixture or reducer path that produces a negative blocked
count prints it on a board.

### 4.3 — `ward-patient-search.test.ts` · "never returns a closed movement, even when the query is the closed movement's own id"

The file's spine — the expected open-id set — is computed with the same production `isOpen` the
function under test uses. The comment claims two fixture records pin closure and arrival
independently. They do not: `stage: "arrived"` appears **exactly once** in `ward-movements.ts`, and
that record also carries a closure. **No case in the file is arrived-without-closure.**

**Falsifier:** drop the arrival half of `isOpen`, keeping only the closure test. The expected set
moves with it, every measured literal id list is unchanged, and the entire file is green. An arrived
patient whose closure was never written **reappears in every open queue, board count and patient
search.**

### 4.4 — `ward-patient-search.test.ts` · "drops referrals entirely when a movement-shaped filter is set"

`[].every(...)` is `true`, and there is no non-emptiness guard — **notably the same describe block
does add one for the queued-referral fixture two tests earlier**, so the omission is inconsistent
within the file.

**Falsifier:** return an empty array when a movement filter is set. Both assertions green, and no
other test in the file passes a stage or department filter, so nothing else notices. **A coordinator
who picks a stage or a department gets an empty patient search.**

### 4.5 — `ward-morning-print.test.ts` · "never hides the headline row or the people-waiting card for print"

Two structural holes in one loop: a `continue` that treats a missing rule as a pass, and a
first-match-only regex, so only the earliest matching rule is ever inspected.

**Falsifier:** append a second rule hiding the card **after** the existing padding rule. The scan
reads the first, sees no hiding, passes; the CSS cascade hides the demand figure on the printed
sheet. Two more variants work: add the selector to an existing hiding group (the anchored pattern
never matches a selector followed by a comma, so the loop `continue`s), or use `visibility: hidden`.

### 4.6 — `ward-morning-print.test.ts` · the ink-colour selector list matches `border-color`

The selector filter tests for `color:` preceded by whitespace, which **also matches `border-color:`
and `border-top-color:`**. Read in full: several rules already enter the returned list on their
borders alone. Membership therefore does not mean "this selector gets ink colour".

**Falsifier:** move the people-waiting title, value and note out of the ink-colour group and into a
border-only rule. All six assertions pass, the non-vacuity control still holds, and **printed from
the dark theme those lines are white ink on a white sheet** — the exact defect the test was written
for.

### 4.7 — `ward-output.test.ts` · "formats copyable answer and quote text with citations"

Both assertions check **headings only**. Both headings are unconditional string literals in the
output array; nothing in the file asserts the content beneath either.

**Falsifier:** make the source-status line builder return an empty list, or empty the review
requirement string. Both tests stay green. The copied clinical artifact keeps its headings and loses
every source-provenance line — or loses _"Draft for clinician review only. Verify source text, local
policy, patient context, and medication details before use."_, **the sentence the whole artifact
exists to carry.**

### 4.8 — `ward-output.test.ts` · the demo-mode flag has one branch, exercised once

`formatWardNote(answer, true)` is the only call in the file, so the false branch is never exercised.
The assertion proves the string exists, not that it is conditional.

**Falsifier:** make the demo string unconditional. Test green; **every real ward note is now stamped
synthetic.**

### 4.9 — `ward-output.test.ts` · the low-confidence caveat has no negative control

A presence assertion with no sibling asserting its absence — the two confident-table tests never
check that the caveat is missing.

**Falsifier:** emit the caveat unconditionally. All three table tests green; every copied table now
claims its structure could not be reconstructed. **A caveat that fires on every table stops being
read**, which is the failure the finding was raised against, arrived at from the other end.

### 4.10 — `ward-morning-rollup.test.ts` · "counts waiting exactly as the referral board counts it"

The assertion compares `peopleWaitingCount(referrals)` against `referralQueueOrder(referrals).length`
— and `peopleWaitingCount` **is, in its entirety, that expression.** Both sides are the same code.

**Falsifier:** re-implement `peopleWaitingCount` as its own filter — _"the second filter of our own"_
that the function's own doc comment forbids. Identical number today, so this test and both hand-built
ones stay green; the coupling the test claims to pin is gone, and the two screens diverge the moment
the queue filter changes.

### 4.11 — `ward-withdraw-referral.test.ts` · "names no place in anything a ward can read"

Inspects **one field** of a multi-field record, and that field is a snake_case enum which can never
contain a display name. No positive control anywhere shows the probe can fire.

**Falsifier:** keep the enum reason and add an accountability field to the appended record carrying
the unit names as free text — the same reducer already writes free-text strings into a closure reason
on the very next lines. Green, and **the losing wards' names are back in the record.** The test's own
doc comment names this shape — _"carrying a forbidden value in a permitted field"_ — and then checks
only one field.

---

## Batch 6 — 7 files, 2,342 lines

| File                                | Verdict                                                         |
| ----------------------------------- | --------------------------------------------------------------- |
| `ward-eligibility.test.ts`          | FINDINGS (2) — **weakest file in the batch**                    |
| `ward-leaving-destinations.test.ts` | FINDINGS (2)                                                    |
| `ward-model-phase3.test.ts`         | FINDINGS (1) (2 suspicions)                                     |
| `ward-pressure.test.ts`             | FINDINGS (2) (1 suspicion, 1 duplicate)                         |
| `ward-governance.test.ts`           | CLEAN — **and the batch premise about it was wrong; see below** |
| `ward-derivations.test.ts`          | CLEAN (2 suspicions)                                            |
| `ward-referral-reducer.test.ts`     | FINDINGS (2) — **strongest file in the batch**                  |

### 6.1 — `ward-eligibility.test.ts` · ⚠️ a live hole, not a hypothetical one

The unit factory sets a sex designation, which reads as though designation is covered. It is not:
`eligibility()` builds eight gates and **`sexDesignation` is never read on the movement path.** Only
the referral path has that gate.

**No falsifying change is needed — the hole is live on today's fixture.** `fsh-adult-secure` is
Male-only, authorised, non-forensic, Adult, Secure, fresh, with allocatable beds. For a **Female**
Adult movement every gate passes (the sex-mix gate passes on allocatable count), so the verdict is
eligible and `eligibleCandidatesAmong` **shortlists a Male-only ward for a female patient.** The
Female-only mirror image is prevented today only by an occupancy accident — one allocatable bed —
which a single in-app capacity confirmation removes.

That unit's own source comment says the designation "actually excludes a Female referral here". It is
true of the referral path and false of the movement path, **which is how this survived.**

### 6.2 — `ward-eligibility.test.ts` · every gate test proves the flag, never the verdict

Five refusal tests assert only that a named gate reports `pass: false`. Only the authorisation tests
assert the overall verdict.

**Falsifier:** exempt one gate from the overall verdict — justified by the file's own prose calling a
stale-capacity failure "a staleness warning". The stale-capacity test still passes, because it only
reads the flag, **while a stale ward is now offered as a bed.** The title says the ward is _dropped_;
nothing in the test checks that it is dropped. Blast radius checked: no unit in the standard fixture
is simultaneously stale and allocatable, so the aggregate eligible-pair count is unchanged.

### 6.3 — `ward-pressure.test.ts` · two expectations recomputed with the production helper

The waiting total is compared against a filter using the same `isOpen` the function under test
filters with.

**Falsifier:** drop the arrival clause from `isOpen`. Both sides move together; the test stays green
while **every arrived patient is counted as still waiting in an ED.** The test title names precisely
the clause deleted.

### 6.4 — `ward-pressure.test.ts` · the department roster is derived from the same source on both sides

**Falsifier:** delete any one of the eight departments from `ward-sites.ts`. Both sides drop to seven
and both roster tests stay green, while **a department silently vanishes from the coordinator's card
row.** Only four department ids are named literally anywhere in the file, so removing any of the
other four is invisible.

### 6.5 — `ward-model-phase3.test.ts` · the privacy scanner reads two strings and claims every field

Two independent reasons it cannot fail on the property it names. First, one of the two accumulated
strings is a closed enum, so it can never carry an identifier — the non-emptiness floor is met almost
entirely by strings incapable of failing. Second, the regex matches the **words** "name", "dob",
"mrn", not identifiers: a personal name passes cleanly.

**Falsifier:** put a personal name in a movement's blocker sentence or owner field. **Neither field is
in the scanner's accumulation set**; the test stays green. The test's own comment says _"a guard that
checks properties and never reads strings is how the Phase 1 privacy defect survived"_ — and it then
reads two strings out of the fixture.

### 6.6 — `ward-leaving-destinations.test.ts` · the union-exhaustiveness test is a constant compared with itself

The final assertion is a value compared to itself, and the type annotation beside it is erased by
esbuild — **vitest does not typecheck** — and would assert nothing even under `tsc`. The floor is
"at least 8" where the union has exactly 8 members.

**Falsifier:** add a ninth member to the `LeavingDestination` union without adding its row. The length
stays 8, the floor holds, the self-comparison holds — green. **This is exactly the picker bug the
array's own doc comment says the runtime-array pattern exists to prevent.**

### 6.7 — `ward-leaving-destinations.test.ts` · "does NOT list absconding or any synonym, because a missing patient has not left"

A word list standing in for a concept.

**Falsifier:** add a destination labelled _"Bed released after unauthorised departure"_. It matches
none of the forbidden words; all three other tests stay green. **The bed of a patient nobody has
found is freed** — the exact outcome the file's twenty-line header says is the most important thing
it guards. The test's own comment argues the property is _the concept_, and then encodes a longer
word list.

### 6.8 — `ward-referral-reducer.test.ts` · "copies the referral fixture rather than aliasing it"

**Falsifier:** replace the deep clone in the seed with a shallow spread per referral. The top-level
objects are still distinct and the deep-equality assertion still holds — green — while **every nested
destinations array is shared with the module-level fixture and across every seeded state.** The title
claims the deep property; the assertion reaches one level.

### 6.9 — `ward-referral-reducer.test.ts` · a refusal asserted without the state check its sibling has

The duplicate-kind half asserts the referral list is unchanged; the empty-list half asserts only the
rejection message.

**Falsifier:** record the rejection and fall through to the append. The test stays green while **a
referral with zero destinations enters state** and reads as permanently queued.

### ⚠️ 6.10 — a batch-premise correction, recorded because it matters more than a finding

**`ward-governance.test.ts` contains no synthetic-data disclaimer guard and no "what this system is
not" assertion.** It tests the change audit and the effectiveness numbers only, and it tests them
**well** — literal oracles, ordered-pair tuples rather than piecemeal field checks, an explicit guard
against a zero standing in for an undefined, and positive controls for every negative.

The disclaimer guards live in `ward-governance.dom.test.tsx` and `ward-flow-data-boundary.test.ts`,
**neither of which was in this batch.** The claim that a governance test passes when the disclaimer is
absent is **neither confirmed nor refuted** by this reading. It is recorded here so that nobody
inherits it as established.

---

## Batch 7 — 7 files, 2,343 lines

| File                                     | Verdict                                                   |
| ---------------------------------------- | --------------------------------------------------------- |
| `ward-flow-seam.test.ts`                 | FINDINGS (2) — **one is false on today's tree and green** |
| `ward-referral-matching.test.ts`         | FINDINGS (2)                                              |
| `ward-landmarks.test.ts`                 | FINDINGS (2)                                              |
| `ward-statistics.test.ts`                | FINDINGS (1, eight assertions)                            |
| `ward-pull-readiness.test.ts`            | CLEAN                                                     |
| `ward-admissions-seed.test.ts`           | CLEAN — **best file in the batch**                        |
| `ward-statistics-incoherent-gap.test.ts` | CLEAN, scope wrong (2 suspicions)                         |

### ⚠️ 7.1 — `ward-flow-seam.test.ts` · "has its route hardcoded outside itself only in the four known places" — **the claim is false today and the test is green**

The scan never leaves `src/`. `scripts/generate-site-map.ts:83` hardcodes the Ward Flow route in
executable code, is not in the approved list, and **the suite passes** — confirmed empirically, the
one vitest run spent in this sweep: `npx vitest run tests/ward-flow-seam.test.ts` → **exit 0, 5
passed.** "The four known places" is five.

**Falsifier for the wider case:** move the constellation redirect from `src/proxy.ts` to a repo-root
`middleware.ts`, which Next supports. The seam widens, the approved list goes stale, the cardinality
pin still passes, and the sweep never opens the file.

### 7.2 — `ward-flow-seam.test.ts` · the import scan sees only static declarations

Dynamic `import()` call expressions and import-type nodes are never visited.

**Falsifier:** load a ward component through `next/dynamic`. The host now depends on the prototype —
the exact invariant the test calls "not a budget" — and it stays green. **This is not a hypothetical
shape:** the same idiom appears at five or more existing sites in this repo, so it is what a future
author would reach for.

### 7.3 — `ward-referral-matching.test.ts` · every refusal test but one asserts the gate, never the offer

Six refusal tests assert a named gate reports `pass: false` and stop. The overall verdict is asserted
`false` in exactly **one** place in the file — and the verdict is what decides the offer, at
`shortlist-panel.tsx:326` and the eligibility badge in `flow-diagram.tsx:563`.

**Falsifier:** exempt the forensic gate from the overall verdict, introduced as _"the forensic gate is
descriptive, not disqualifying"_ — which is exactly how that gate's own comment could be misread. **A
forensic bed is now offered on the shortlist and badged "Eligible now"**, the gate still reports
failure, and every test in the file stays green. The same edit works for legal status and sex
designation.

### 7.4 — `ward-referral-matching.test.ts` · the firewall regex is blind to re-exports and dynamic imports

The import-statement pattern requires whitespace after `import`, so it matches neither
`export { X } from "…"` nor `import("./y")`. **This breaks both halves at once:** the identifier check
does not see such a line, and the module-graph traversal does not follow it, so the graph narrows
silently — the precise failure the file's own comment calls _"the check-that-cannot-fail shape at the
one place this phase can least afford it."_ The sister file handles export declarations, so the repo
already knows the difference, and re-export is a live pattern here.

**Falsifier:** add a module that reads the unvalidated bed-release model and surface it through a
re-export. Matching now reads that model, the traversal never opens the new file, both floors still
hold, offenders stay empty. Green.

### 7.5 — `ward-landmarks.test.ts` · both structural contracts test a hand-written map, not the routes

The renderable-route table pairs a route string with a component **the author chose**. The coverage
test only checks the route strings against the filesystem; nothing reads `page.tsx` to confirm it
mounts that component. The doc comment's _"checked against every page.tsx file directly"_ describes a
manual check by the author, not code.

**Falsifier:** wrap the statistics page in the section frame used by its two siblings, for visual
consistency. The frame and the screen **each render their own `<main id="main-content">`**, so the
live route ships two identical landmark ids and two skip-link targets. The test renders the screen
alone, counts one, stays green. The heading contract breaks the same way.

### 7.6 — `ward-landmarks.test.ts` · a literal compared to the length of a literal

No edit to production can make it fail; only editing the test file can. Its stated purpose is already
discharged by the coverage test above it. **Contrast the neighbouring route count, which reads the
filesystem and can fail** — that one is a real guard.

### 7.7 — `ward-statistics.test.ts` · eight assertions that cannot fail because the assertion above already decided the value

Three clusters: a null check followed by two "not zero" checks; an equality followed by three "not
this other number" checks; another equality followed by two more. The comments claim a diagnostic
purpose — _"named individually so a red run says exactly which wrong clock pairing produced it"_ — but
**Vitest aborts the test at the first failed expectation**, so the equality above always fires first
and these lines can never appear in a red run.

**No falsifying change exists, which is the point:** they are decorative. The underlying properties
are genuinely covered by the equality assertions. The risk is a reader crediting the file with more
discrimination than it has.

---

## Batch 10 — 7 files

| File                                   | Verdict                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `ward-flow-contracts.test.ts`          | FINDINGS (2) — one serious                                                  |
| `ward-statistics-claims.test.ts`       | FINDINGS (1) (2 suspicions) — otherwise the most rigorous file in the batch |
| `ward-flow-service-coverage.test.ts`   | FINDINGS (2)                                                                |
| `ward-referral-producers.test.ts`      | FINDINGS (1)                                                                |
| `ward-escalation.test.ts`              | FINDINGS (1)                                                                |
| `ward-bed-release-lifecycle.test.ts`   | FINDINGS (1)                                                                |
| `ward-referral-decision-scope.test.ts` | CLEAN — **and a gap I reported earlier is closed; see below**               |

### ⚠️ 8.1 — `ward-flow-contracts.test.ts` · "keeps every rendered string free of anything identifying a person"

The probe matches the **words** "name", "address", "diagnosis" — not identifying content. **The
historical leak this same file celebrates fixing contains none of those words.** There is no positive
control anywhere proving the regex can fire on a string this loop inspects.

⚠️ **CORRECTED — the falsifier below does NOT work, and the correction is the same one as §2.5.**
Restoring the interpolated withdrawal reason **is** caught, by the live-reducer membership assertion
at `ward-withdrawal-reason-privacy.test.ts:184`. **This finding is MIS-ATTRIBUTED, not a gap:** this
file's regex genuinely cannot fire on identifying content — that reading stands — but the property it
names is guarded elsewhere. It needs an honest rename, not a new test. **The claim below is left
struck through rather than deleted, because it was relayed and the retraction has to be findable
where the claim was.**

~~**Falsifier:** restore the withdrawal reason to the interpolated form naming the receiving unit.~~
~~FD-23 is back on every withdrawal record and this test stays green. Honest note: this is the third
independent guard in this sweep that fails to catch the same FD-23 shape — the other two are 2.5 and
4.11. Together they are the clearest single pattern the sweep has produced.~~

⚠️ **THAT LAST SENTENCE WAS THE HEADLINE OF THIS SWEEP AND IT WAS FALSE. "Three independent guards
all miss the same FD-23 shape" is wrong: the reducer path is guarded, by the live-dispatch membership
assertion in the very file I called dead.** What is true and much smaller: three guards are
_individually_ weaker than they read, and the forbidden list in §2.5 omits site names — **a site-name
leak in a label is still uncaught** (§2.5 carries the working falsifier). The three files do share a
weakness. **They do not share a hole.**

**Why this one went furthest wrong:** it was the finding that composed. Three separate readers each
reported a weak FD-23 guard, and three independent reports of the same shape read as corroboration.
**They were three readings of three files, none of which had checked whether any OTHER file caught
it** — which is exactly the mis-attribution trap this document's opening section now warns about, and
I walked into it while writing that warning.

### 8.2 — `ward-flow-contracts.test.ts` · the parallel-cap assertion is inert twice over

The threshold is the same production constant the reducer reads, **and** no event in the walk
attempts to exceed it — the walk refers exactly three units and the cap is three.

**Falsifier:** delete the cap guard in the reducer; nothing in this file goes red. Or raise the
constant; the assertion moves with it. Compensated by `ward-flow-reducer.test.ts`, which does refer
four units — so the property is guarded, **just not here.**

### 8.3 — `ward-statistics-claims.test.ts` · a citation may witness itself

The cited source file is constrained only by existing on disk. **Nothing forbids it pointing at the
claims register itself**, where the evidence string literal lives. Verified empirically: collapsing
whitespace over the register and searching for one evidence literal yields **exactly one**
occurrence, so the citation would satisfy the exactly-once check forever. The register is not among
the registered surfaces, so no other check would notice.

**Falsifier:** delete the cited constant from production, watch the test go red naming the claim, and
"re-point" the source file at the register — **which the failure message explicitly invites.** The
claim now rests on nothing and the register reports green. The missing guard is a rule that evidence
must not live in the citation's own file.

### 8.4 — `ward-flow-service-coverage.test.ts` · a substring where "is used to build the list" is meant

A raw-source `includes`, comments and unused imports included.

**Falsifier:** replace the derivation in one screen with a hand-typed service array and leave a
`// was: …` comment above it, or leave the now-unused import. The file still contains the token, the
completeness assertion above now protects three screens instead of four, and the test is green.
**That is precisely the original hole, re-dug, with the guard watching.**

### 8.5 — `ward-flow-service-coverage.test.ts` · the register of surfaces is hand-maintained

The cardinality pin compares the test's own map to a literal — it proves nothing about production —
and **nothing detects a fifth surface** that groups by health service. The file's title is broader
than its mechanism.

**Falsifier:** add a service-grouped section to a statistics screen with its own hard-typed array. A
sixth health service is then invisible on that screen and all three tests stay green.

### 8.6 — `ward-referral-producers.test.ts` · a producer scan whose comments are not stripped

In pointed contrast to the sibling helper in the same file, which **does** strip them.

**Falsifier:** replace a field's write with a literal default and leave the old line as a trailing
comment. The field loses its producer, the substring survives inside the comment, green. Putting the
write behind a conditional spread works too. The file half-declares this limit and then buys the
end-to-end proof for one field only.

### 8.7 — `ward-escalation.test.ts` · the expectation is computed with the production predicate

**Falsifier:** narrow `isOpen` to exclude in-transit patients — a plausible _"a patient in transit has
left the open caseload"_ edit. **Six moving patients silently drop off the escalation board;**
expected and actual shrink identically and the test stays green. The two other tests in the file do
not catch it. And the resolution test beneath is a bare loop whose non-emptiness is inherited
entirely from the compromised test above.

### 8.8 — `ward-bed-release-lifecycle.test.ts` · a six-way rejection count with one leg double-refused

The count is asserted with no reason text on any leg, and one leg is refused for a **second, unrelated
reason** — the seeded release has no blocker to clear, so the reducer refuses it regardless of role.

**Falsifier:** grant the coordinator that permission. The spec is broken; the count is still six and
both releases still compare equal. Compensated by `ward-event-permissions.test.ts`, which pins the
table literally — so severity is low, **but this test's own title claims coverage it does not have.**

### ✅ 8.9 — a correction to my own earlier report

I recorded `ward-referral-decision-scope.test.ts` as leaving `ACCEPT_REFERRAL` uncovered when I cited
it in the third ED journey. **That gap is closed.** The file covers it at lines 186–230, and **both**
copies of the byte-identical scope guard in the reducer are exercised. My earlier citation was
correct about the two test titles and wrong about the gap; the file is sound.

---

## Batch 8 — 5 files, 2,670 lines

| File                                    | Verdict                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `ward-legal-figure-guard.test.ts`       | FINDINGS (2) (4 suspicions) — **the two are in the one case that guards what a clinician reads** |
| `ward-teams.test.ts`                    | FINDINGS (1)                                                                                     |
| `ward-change-reasons.test.ts`           | FINDINGS (2)                                                                                     |
| `ward-scenarios.test.ts`                | FINDINGS (1) + doc drift                                                                         |
| `ward-pull-admission-lifecycle.test.ts` | CLEAN (3 suspicions) — strongest of the five                                                     |

The 1,729-line legal guard has **7 cases, all assessed** (confirmed by running it: 7 passed, exit 0).
Parts 1, 2 and 3 are genuinely fail-closed and well guarded; the reader **could not find a way to
fabricate a form deadline past them.** Both findings are in the rendered-wording case.

### ⚠️ 8.1 — `ward-legal-figure-guard.test.ts` · "renders absence as 'no deadline recorded', never as a claim about the Act"

Two holes, both verified by running the probe. **(a) Case-sensitive** — the capitalised variant is
extracted and matches nothing, and that exact capitalisation **already exists in
`ward-management-console.tsx`'s own comment.** **(b) JSX text is invisible** — the literal collector
takes string literals and template fragments only, and JSX text is neither. The negative has **no
positive control**: nothing anywhere proves a rejected wording would be flagged.

**Falsifier:** leave the existing template intact so the positive assertion still passes, and add a
rendered explanation as a JSX child — _"There is no statutory deadline for this form."_ All seven
cases stay green **while the console asserts what the Mental Health Act requires.** The file's own
comment about a JSX text node being a claim is attached to the _sibling_ check, not this one.

### 8.2 — `ward-legal-figure-guard.test.ts` · the "form required" scan is a contiguous substring

Any intervening word defeats it, and there is no positive control.

**Falsifier:** change a fallback to _"No transport form is required"_. Verified: that string does not
contain the probe. That file is not on the expected-carriers list, so nothing forces it to keep the
corrected wording. Green, **with the Act-overreach the file's own comment says was already shipped
once from this exact file.**

### 8.3 — `ward-teams.test.ts` · the central mapping assertion is a tautology

`teamForRegion` is a membership test followed by a lookup in the very table the expectation reads.
Grepped: **the team constants appear in no other test file**, so no region is pinned to any name
anywhere in the repo.

**Falsifier:** swap two values in the table. All six cases stay green — keys still match the region
list, both strings non-empty, still ten distinct, still marked placeholder, still no site-name
collision. **A discharged Peel patient is shown returning to the Kimberley team.**

### 8.4 — `ward-change-reasons.test.ts` · label text guarded only by "is truthy"

Four cases assert a label is truthy and non-empty. **No test in the repo pins any label's text** — the
only other reference compares the map against itself.

**Falsifier:** reword one release-hold reason to another reason's wording. Truthy, non-empty, no
forbidden token, key set unchanged — green. **Two distinct reasons then render identical text in the
picker and in the governance ledger, and a coordinator cannot tell which was recorded.**

### 8.5 — `ward-change-reasons.test.ts` · one list has no order pin

The other four lists each get a dedicated ordered comparison. The urgent-mark list is only spread into
a loop that shrinks silently, and reached indirectly through a **sorted** key comparison on a
different object.

**Falsifier:** reorder it. Type-safe, no compiler error, whole file green — while the picker's order,
which this file's own discipline treats as load-bearing for every other list, has changed.

### 8.6 — `ward-scenarios.test.ts` · "changes operational numbers only — never a patient attribute"

Checks 5 of the unit type's ~17 fields. Unchecked: sex mix, **sex designation**, **forensic**, site
code, beds, empty, blocked, held. And `eligibility()` reads none of the three bolded ones, so they are
invisible to the pinned counts in the other cases too.

**Falsifier:** have the scarce scenario rewrite `sexDesignation` on every unit. All four cases green —
the eligibility counts are unchanged **because the function never reads that field** — while the
scarce night silently rewrites _who this bed may hold_, **which is precisely the patient attribute the
test is named for.**

### 8.7 — doc drift, recorded because the comments are now false

`ward-scenarios.test.ts` records "41 open movements, 342 eligible pairs" in prose above assertions
pinning **43** and **353**, and its failure message says "must match the standard night's 41 exactly"
beside a pin of 43. The comment two lines up instructs _"re-measure and re-date this; do not adjust a
number and leave the date"_ — **the numbers were adjusted and the prose was not.**
`ward-change-reasons.test.ts` says "exactly TWELVE unique keys, not thirteen" above a list of **18**.

---

## Batch 9 — 7 files

| File                               | Verdict                                                       |
| ---------------------------------- | ------------------------------------------------------------- |
| `ward-flow-single-source.test.ts`  | FINDINGS (4) — **one has already been falsified in the tree** |
| `ward-community-hub.test.ts`       | FINDINGS (3), all the same shape                              |
| `ward-instant-display.test.ts`     | FINDINGS (2)                                                  |
| `ward-admission-model.test.ts`     | FINDINGS (2) — strongest file in the batch otherwise          |
| `ward-referrals-print.test.ts`     | FINDINGS (1), structural, affecting all five tests            |
| `ward-patient-model.test.ts`       | FINDINGS (1) (3 suspicions)                                   |
| `ward-transport-page-name.test.ts` | FINDINGS (1)                                                  |

### ⚠️ 9.1 — `ward-flow-single-source.test.ts` · "keeps every allowlist entry pointing at a file that exists" — **already falsified**

The check tests existence only, **and the falsification has already happened.** Two component files
are on the admission-seed allowlist and contain no mention of that module at all — only the reducer
imports it. The constant's own comment says a stale entry _"is an exemption for nothing"_, and **the
test cannot detect that state.** Two component files carry a standing, unremarked permission to
re-import the frozen seed.

### 9.2 — `ward-flow-single-source.test.ts` · the dispatch check runs on a set that cannot contain a dispatcher

The pre-filter is the same import regex, so today's population is exactly one file — the reducer —
which contains no dispatch by construction.

**Falsifier:** an allow-listed component re-adds the seed import and calls a hook-provided action
creator rather than a literal `dispatch(`. Both tests green **while the provenance paragraph they
exist to protect is false.**

### 9.3 — `ward-flow-single-source.test.ts` · every rule is name-shaped, and one re-export defeats all three

**Falsifier:** add one line to an allow-listed file — `export function unitLookup(id) { return
unitById(id); }` — and have the screens call that instead. **No forbidden identifier appears in any
caller**, offenders is empty, and the whole-branch defect the rule exists to prevent is back. **The
same one-line re-export defeats the time-anchor rule and the fixture-import rule.**

### 9.4 — `ward-instant-display.test.ts` · the allowlist is keyed on the argument's spelling, with no file attached

Any bare call anywhere under the ward directory is pre-approved if its argument text already appears
on the list — and several common ones do.

**Falsifier:** render a historic escalation through a local named `confirmedAt`. The argument text is
approved (it was approved for a different file), the unapproved set stays empty, and **a three-day-old
escalation reads as this morning** — the exact defect the file's header names.

### 9.5 — `ward-instant-display.test.ts` · the sweep threshold is one call per file

**Falsifier:** revert three of one file's four day-aware calls to bare clock faces, hoisting each into
a local whose name the allowlist above already absorbs. Count is still 1, unapproved set still empty,
**three history surfaces silently assert today.**

### ⚠️ 9.6 — `ward-referrals-print.test.ts` · "inside `@media print`" is never actually established

The print block is sliced from its opening to **end of file** — the closing brace is never matched.
Verified: the block opens at line 1040 of 1251 and the file ends with its brace, **which is only a
fact about today.**

**Falsifier:** append a new top-level at-rule at the end of the stylesheet — where CSS is normally
added — and delete the rule from the print block. Every assertion green, and **the card prints as a
near-black island again.** This affects all five tests and all 49 selectors they check.

### 9.7 — `ward-community-hub.test.ts` · three assertions where production computes the expectation

The page list is built by mapping the option list; the test compares the mapped names to the option
list. The id check compares a slug to the slug that built it. The destination label check resolves
through the same map it compares against.

**Falsifier:** have the option builder start discarding clinic spellings seen only once, or cap at
twenty. Both sides move together; **the hub silently loses most of its ~65 pages**; green — the only
floor is "greater than one".

### 9.8 — `ward-admission-model.test.ts` · two vocabulary tests assert their own setup

One asserts a spread returned what the test put in; the other asserts five string literals are
strings. The contents are **pinned nowhere in the repo**, unlike every neighbouring vocabulary.

**Falsifier:** replace a pull-release reason with _"Other — describe"_. Still five, still strings,
still green; **the "no free text" claim in the title is now false.**

### 9.9 — `ward-patient-model.test.ts` · the field allowlist is hand-written, not compiler-forced

The contrast with the admission version — which **is** compiler-forced — is exactly what makes that
one bite and this one not.

**Falsifier:** add a home-address field to the patient type and populate it in the reducer without
touching the allowlist. **Vitest never typechecks**, so the annotation is never compiled, and the
record holds an address with the suite green.

### 9.10 — `ward-transport-page-name.test.ts` · the retired name is matched case-sensitively, in two of three places

**Falsifier (a):** title-case the old name in a heading or an aria-label — an ordinary edit. **The
screen-reader user meets the old name again.** **(b):** put it back as the nav label — **the third of
the three names the file's own header enumerates, and no assertion reads that file.**

---

## Batch 11 — 6 files, 2,251 lines

| File                                       | Verdict                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `ward-model.test.ts`                       | FINDINGS (5) — **worst in batch**                                          |
| `ward-board-consistency.test.ts`           | FINDINGS (1)                                                               |
| `ward-referral-model.test.ts`              | FINDINGS (2) in 1,217 lines — extraordinarily well guarded otherwise       |
| `ward-catchment.test.ts`                   | FINDINGS (1)                                                               |
| `ward-clock.test.ts`                       | CLEAN (2 suspicions) — literal expected strings a person chose, throughout |
| `ward-community-referral-survives.test.ts` | CLEAN                                                                      |

### ⚠️ 11.1 — `ward-model.test.ts` and `ward-board-consistency.test.ts` · the five-state bed grid is an algebraic identity

Available plus held **is** the empty count for any allocatable value; blocked plus occupied **is**
beds-minus-empty for any blocked value. The reader confirmed exhaustively: **246,016 unit shapes, 0
violations.** Three of the four non-negativity assertions read the output of a clamp and likewise
cannot fail.

**Falsifier:** **swap the two labels in the return object** — `return { available: held, held:
available, … }`. The sum is unchanged and **both files in this batch stay green.** That is precisely
the defect `ward-board-consistency.test.ts`'s own doc comment says the four-way split was introduced
to catch. Its occupied half **is** a real two-source cross-check; available and held only ever appear
inside a sum.

⚠️ **CORRECTED — MIS-ATTRIBUTED, NOT A GAP. A triage pass found the guard.**
`tests/ward-board-page.dom.test.tsx:146` pins the value independently against a hard-coded literal:

```ts
expect(unitCapacity(unit, []).held, `${BLOCKED_UNIT_ID} must have zero held beds …`).toBe(0);
```

On that fixture `allocatable === empty`, so `held` is 0 today. **After the label swap it returns 3
and this fails unconditionally.** The property is guarded — by a DOM test in another file, not by
either file that claims the partition.

**One thing the triage adds that sharpens rather than softens the reading:** the _other_ held-beds
test in that same DOM file, on a different fixture, would **not** catch the swap — there
`available === held === 1` coincidentally, and its comparisons run against DOM output computed by the
same swapped function, so it stays self-consistent. **The guard rests on one assertion, on one
fixture, whose own message explains it is there to make an equality hold.** Change that unit's
allocatable figure and the last real guard on the label pairing goes quiet with nothing red.

### 11.2 — `ward-model.test.ts` · "gives every movement an emergency department it is actually sitting in"

A truthiness check on an id. The file already imports the department list but uses it only for site
codes; the sibling test counts **distinct strings, not resolvable ones.**

**Falsifier:** rename a department id in `ward-sites.ts` without touching the movements. Still truthy,
still eight distinct, both tests green — **while every movement from that department points at one
that does not exist.**

### 11.3 — `ward-model.test.ts` · three more

A legal-form assertion inside an unguarded `continue` filter (**falsifier:** narrow the predicate so
two of the four legal statuses are skipped and may lose their form entirely); a stage-implication
loop whose three branches have no non-emptiness proof anywhere in the file; and a site-absence check
whose optional chain **makes a missing site indistinguishable from a site with no ED** — the
neighbouring lines are accidentally protected by a follow-up assertion, this one is the last statement
in the test.

### 11.4 — `ward-catchment.test.ts` · "every alias resolves to its canonical suburb"

The function returns **the very object the loop is iterating**. It can only fail on a key collision —
never on the alias table being wrong about where a person lives. **Six aliases** resolve to a real row
with a real clinic and have no human-chosen expected destination anywhere.

**Falsifier:** point one of those six rows at a different follow-up clinic. Row count unchanged,
distinct counts unchanged, every other assertion unchanged — **and a person from that suburb is routed
to the wrong community team with the whole file green.** Given that this module decides which service
area a person belongs to, this is the sharpest gap in the batch after 11.1.

### 11.5 — `ward-referral-model.test.ts` · "orders the real fixture's decided referrals most-recently-decided first"

The test re-runs **production's own key function through production's own comparator** and compares
the result to production's output. The comparator's _sign_ is pinned; the _key_ is not.

**Falsifier:** change the key from the latest decision time to the earliest. A referral with several
decided arms sorts by its **earliest** decision, the board's "most recently decided" panel reorders,
and both sides move together. Green.

---

## Batch 12 — 6 files

| File                                       | Verdict                                                               |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `ward-flow-reducer.test.ts`                | FINDINGS (6) — **but sound on the shape it was hunted for**           |
| `ward-reanchor.test.ts`                    | FINDINGS (2)                                                          |
| `ward-reanchor-single-application.test.ts` | FINDINGS (2)                                                          |
| `ward-book-transport.test.ts`              | FINDINGS (1)                                                          |
| `ward-referral-clocks.test.ts`             | FINDINGS (1) — **and it does NOT have its DOM sibling's dead branch** |
| `ward-travel-bands.test.ts`                | CLEAN (2 suspicions) — strongest file in the batch                    |

**The reducer file has 50 `it` blocks expanding to 60 cases, all assessed.** No expected state is
built by calling the reducer, and no expectation is derived by applying a helper the reducer applies —
**the shape it was hunted for is not there**, and its non-vacuity preconditions are unusually thorough.
Its six findings are other shapes.

### ⚠️ 12.1 — `ward-reanchor.test.ts` · the model-file list omits the reducer, whose state declares an instant

The reducer declares an inline instant property **on the reducer state itself**. **This is the file's
own documented defect recurring in a new file.**

**Falsifier:** rename that instant, or add a second beside it, and stamp it. The declared-field scan
never opens the file, the field list is untouched, the floor and the set-equality both stay green,
**and the refresh timestamp stays on the old anchor.** It is green today only by luck — the current
name happens to appear in the list because a different module declares it.

### 12.2 — `ward-reanchor.test.ts` · "preserves every relative offset, which is the whole property"

Measures **exactly one field name.** Nothing proves any of the other 22 moves at runtime — the
set-equality test proves two _lists_ agree, not that the shift applies them.

**Falsifier:** skip one field inside the shift. Every assertion stays green **while every referral's
raise time sticks to the old anchor** — producing exactly the "18h in department beside 40m since
referral" the set's own comment describes.

### 12.3 — `ward-reanchor-single-application.test.ts` · "is called from exactly ONE place in src, and that place is the safe door"

The list is of **files, not call sites.**

**Falsifier:** add a second call **inside the same file**. The list is unchanged, both this test and
its canary stay green, **and every instant is double-shifted** — the plausible-wrong-length-of-stay
this file exists to prevent. Secondary: the walk starts at `src`, so a caller in `scripts/`, `worker/`
or `eval/` is invisible, and the function is exported.

### 12.4 — same file · an identity comparison against a fresh object

The seed returns a new object literal on every call, so the comparison is unconditionally true.

**Falsifier:** memoise the seed. Every caller now shares one mutable state object; the test stays
green. Contrast the sibling file, which compares against a _held_ variable and is a real check.

### 12.5 — `ward-flow-reducer.test.ts` · six findings, the three sharpest

**An inequality where equality is needed** — the pull test asserts the bed count merely _decreased_.
**Falsifier:** make arrival decrement the allocation as well as the empty count, a plausible "arrival
should consume the allocation too" edit. **Beds drop by two per patient and every ward silently
under-reports capacity.**

**A role-refusal test whose "nothing was written" assertion is `1 === 1`** — the target's seeded
urgency already equals the urgency the event asks for, and the change log is never inspected.
**Falsifier:** drop the `return` from the role gate so the rejection is recorded _and_ the write
proceeds. **An ambulance officer can re-prioritise patients.** The sibling test twenty lines up
already picks a target whose value differs; this one does not.

**Two titles naming a case the body never dispatches** — a closed-movement test that exercises only
one of the two changes it names, and a release-refusal test that exercises only one of the two stages.
**Falsifier for the second:** narrow the guard to the stage that _is_ tested. **A movement whose
transport a provider has already accepted can have its bed released back**, double-counting it.

### 12.6 — `ward-book-transport.test.ts` · an assertion that is `true === true`

Both sides evaluate true on the current seed, so it cannot detect that the refused booking was
written. **Falsifier:** record the rejection without returning, so control falls through to the write.
The rejection count still holds and the pair is unmoved. Partially cross-covered: a _global_
fall-through is caught by the neighbouring officer test; a **role-specific** one is not.

### 12.7 — `ward-referral-clocks.test.ts` · the clock terms are pinned only negatively

Six assertions, all negative or structural — no term is pinned verbatim anywhere.

**Falsifier:** change the not-yet-arrived term to _"in department"_. No digit, no full stop, no
"arriv", non-empty, not a dash — **all green, and the term now says the opposite of what the ruling
requires.** Its sibling file pins its five labels verbatim for exactly this reason.

**✅ And the two problems this file was hunted for are both absent.** Its last test measures all three
clock shapes **through the production function itself** rather than inferring them, including the
stopped-clock arm; the reader confirmed the seed independently. **It is the one file in the batch that
already carries the defence its DOM sibling lacked.**

---

## Batch 13 — 7 files

| File                                    | Verdict                                                       |
| --------------------------------------- | ------------------------------------------------------------- |
| `ward-referral-screen-boundary.test.ts` | FINDINGS (3)                                                  |
| `ward-data-checker.test.ts`             | FINDINGS (2)                                                  |
| `ward-community-index.test.ts`          | FINDINGS (2)                                                  |
| `ward-governance-thin-sample.test.ts`   | FINDINGS (3)                                                  |
| `ward-handover-print.test.ts`           | FINDINGS (1)                                                  |
| `ward-event-permissions.test.ts`        | FINDINGS (1) — **role lists themselves are sound; see below** |
| `ward-override-register.test.ts`        | CLEAN (2 suspicions)                                          |

**On the role lists specifically:** they **cannot** pass while wrong. The comparison is exact and
order-sensitive and coverage is pinned by sorted-key equality. The reader checked the one silent-pass
route — a duplicate key in the object literal, which JS resolves to the last occurrence and which a
key-set comparison cannot see — and **there are none.**

### ⚠️ 13.1 — `ward-data-checker.test.ts` · the real-data assembly is never exercised

Every test feeds a hand-built fixture. The loader and the empty-run refusal are neither exported nor
imported.

**Falsifier:** rename `WARD_NAV` in production. The loader reads `undefined`, the reference lists
become empty, **two checks loop zero times forever**, the empty-run refusal inspects different fields
and never notices, **and the script prints "No problems found."** Every test stays green. An identical
shape empties a third check via the travel-band constant. This is exactly the failure the file's own
"facts that cannot be imported" block guards for the _text-parsed_ facts — **the imported facts have
no equivalent.**

### 13.2 — `ward-governance-thin-sample.test.ts` · three findings, one of which delegates to a test that also cannot catch it

The sibling-figure floor asserts a fact about the seed, not about any floor. **Falsifier:** stop
routing the sibling through the suppressing component and render it inline. This test is green — **and
so is the delegated DOM test, because it asserts the _absence_ of a suppression message.** A later thin
fixture then publishes an average of two beside a suppressed median, which is the outcome the title
forbids.

Beside it: two `toBeDefined()` calls standing in for the published number (**falsifier:** return the
mean instead of the median, or seconds, or `NaN` — the board publishes "NaN min"), and a sample-size
assertion of **"at least zero"**, which a count satisfies by construction. **The test that names the
basis rule tests nothing.**

### 13.3 — `ward-community-index.test.ts` · a pin that does not test its subject

The comment claims that if the field is removed from the model, the import stops resolving. **Verified
false** — the state list and the field are independent exports.

**Falsifier:** delete the field and its presence entry. The list still exports, the test is green,
**and the hub keeps rendering a sentence the same file pins as required.** The pin outlives its
subject, which is the one thing its title promises it cannot do.

### 13.4 — `ward-community-index.test.ts` · the declared size hole is confirmed open

The header delegates the size pin to a sibling. **Verified: that sibling's only size assertion is
"greater than one."** No exact-size pin exists anywhere.

**Falsifier:** filter the team-page derivation, taking ~65 teams to 3. Every assertion green on both
sides, **and 62 teams silently lose their way in.**

### 13.5 — `ward-referral-screen-boundary.test.ts` · three, and the middle one is the interesting one

**The module graph does not follow dynamic imports** — the import pattern requires whitespace after
the keyword, so a dynamic import matches nothing and its child is neither scanned nor traversed.
Verified as an established repo pattern. It misses re-exports the same way.

**A rest element defeats the provider guard.** The binding list is split on commas and checked for one
name. **Falsifier:** `const { movements, units, ...flow } = useWardFlow();` and read `flow.referrals`.
One call, one destructuring, counts agree, no forbidden name in the bindings — **both guards green
with the full referral record in ward code.** The comment beside it enumerates the shapes that must be
refused; **the rest element is not among them, and it is the one shape that survives both checks.**

**The exemption regex is one character class wide** — it demands a comma or a closing bracket
immediately after the type name, so a union, a destructured parameter, or a wrapped type all pass.
The file's own line reads _"an exemption whose reason nothing checks is how a guard rots."_

### 13.6 — `ward-handover-print.test.ts` · both tests are substring scans a wrong rule satisfies

**Falsifier (a):** re-declare the property later in the same rule — the slice still contains the first
declaration, CSS takes the last, **the dark band returns.** **(b):** widen the colour scheme to accept
both — the substring is present, and under print with a dark inherited scheme **every ink reference
becomes white on the white sheet the first test forces**, which the doc comment measured as strictly
worse than the original defect.

### 13.7 — `ward-event-permissions.test.ts` · "gives every role a decision label, so a decision can never be recorded against a blank"

A truthiness check. **Falsifier:** set a label to a single space — truthy, green, **and a decision is
recorded and rendered against a blank**, which is exactly the title's property. Nothing here asserts a
label is a _role_ rather than a person's name either, which is the premise every widening comment in
the file rests on.

---

## Batch 14 — 6 files, 2,351 lines

| File                                              | Verdict                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `ward-referral-visibility.test.ts`                | FINDINGS (3) — **and it guards a module nothing renders; see below** |
| `ward-handover.test.ts`                           | FINDINGS (2) — weakest of the six                                    |
| `ward-referral-suburb.test.ts`                    | FINDINGS (2)                                                         |
| `ward-movement-referral-link.test.ts`             | FINDINGS (2)                                                         |
| `ward-record-leaving.test.ts`                     | CLEAN (1 title over-claim, 2 suspicions)                             |
| `ward-referral-ed-destination-validation.test.ts` | CLEAN — **strongest of the six**                                     |

### ⚠️ 14.1 — NEITHER projection's field set is enforced by the test loop; both are enforced by `tsc`

**This section was first written as two findings and one of them was overstated. Ward Builder Two ran
the mutation and corrected it, and the corrected version is one finding, not two.** The original
claim — that `coordinatorScopedReferral` has _no_ field-set guard — is **true of the test suite and
false of the repository.**

**First, what was never new:** `ward-referral-visibility.ts` is unreachable — zero importers, every
mention a comment. **Already established, recorded in `ward-flow-reducer.ts:2220` as step B with a
control at `124376628`.** Verified independently before relaying; not a discovery.

**The measurement, run by the file's owner on its own file:** delete `originSiteCode` from
`coordinatorScopedReferral`, then

```
npx vitest run tests/ward-referral-visibility.test.ts   →  Tests 100 passed (100)
npx tsc -p tsconfig.typecheck.json --noEmit             →  rc 2
  ward-referral-visibility.ts(246,3): error TS2741:
  Property 'originSiteCode' is missing in type '{ … }' but required in type 'CoordinatorScopedReferral'
```

Restored by reversing the edit, byte-identity proved by hash, tree clean.

**So the finding is about WHICH GATE HOLDS THE CONTRACT, not about a missing one.** The three-level
allowlists in the test file cover the ward projection only, and the coordinator projection has no
test-side allowlist — but **`CoordinatorScopedReferral`'s own type is the allowlist**, and it does its
job. The same is true on the ward side: the fully-populated-projection block compares
`Object.keys(...)` against an array **both written in the test file**, and its real teeth are the
`Required<…>` annotation. **`vitest.config.mts` carries no `typecheck` block** (read in full), so
Vitest never evaluates either.

⚠️ **The exposure, stated at its true size rather than at the size it first looked.** `npm run
verify:cheap` runs typecheck and so does CI, **so a dropped field cannot merge.** What it survives is
the **fast local loop** — `test:focused` and a bare vitest run, which is what people actually iterate
on — until a broader gate catches it. That is worth knowing and worth writing at the site. **It is not
worth a duplicate runtime guard**: re-asserting in vitest what `tsc` already proves is buying the same
verdict twice, which this repository has an explicit rule against.

**What misleads is the presence, not the absence.** A reader asking _"is the field set pinned?"_ opens
the file, finds a block in exactly the shape of the pin they are looking for — a key comparison under a
`Required<…>` annotation — and stops. **The block answers their question with the wrong answer in the
right shape.** An absent guard would at least have left the question open. **The correction sharpens
this rather than softening it:** the block is not merely weak, it is a _copy_ of a guard that lives in
another gate entirely, so the reader is answered in the right shape by the wrong artefact and the real
answer was never in that file.

⚠️ **AND THE ROOM HAS SINCE EMPTIED, WHICH IS WHY THIS SECTION IS WRITTEN LONGER THAN ITS SEVERITY
WARRANTS.** These two were found the same morning the wiring was scheduled — a latent defect and the
person about to make it live in the same room, by accident. **Ward Lead has since blocked ruling 10**:
the projection guards `Referral`, while all three live disclosure routes travel
`Movement.referredUnitIds`, so wiring it would close none of them and would announce that the rule is
enforced. **The wiring is postponed indefinitely and both of these stay latent for however long that
takes.** The comment at the site (`2962efd9a`) is now the only thing carrying them to whoever comes
back. **That is the shape of decay this whole document catalogues, and it is the best available answer
rather than a good one.**

### ⚠️ 14.2b — `suburb` reaches neither projection, and this one no gate can catch

⚠️ **This is the finding that survives 14.1's correction, and it is a different class from it.**
`suburb` is not in either projection's **type**, so **there is nothing for `tsc` to enforce.** 14.1 is
an enforcement gap — the right guard in a gate the fast loop does not run. **This is a
type-completeness gap: no guard exists anywhere, because the contract itself does not mention the
field.** Ward Builder Two drew that distinction and it is the correct one.

**Neither projection carries `suburb` at all**, so the recorded fact `ward-referral-suburb.test.ts`
exists to protect reaches neither, and nothing in 1,397 lines notices. I flagged this to Ward Builder
Two as a question rather than a finding, offering the module's own comment as a possible settlement.
**It answered that the comment does not cover it — it is about importers, not field omission — and
told me not to record it as settled on its authority.** It then split the question, and the split is
what makes it worth recording:

- **For the WARD projection, omitting `suburb` is defensible and Ward Builder Two defends it.** The
  allowlist carries `homeRegion` and stops. A suburb is finer-grained and more identifying than a
  region, and a ward deciding on a bed does not need it. **Its absence there reads as the rule
  working.**
- ⚠️ **For the COORDINATOR projection it is a straight contradiction.** That function's own doc
  comment says _"Never filtered — the coordinator may see everything."_ It is a **hand-written field
  list** of eleven fields. It is filtered — **by omission rather than by rule**, and `suburb` is what
  fell out.

**So `suburb` is not a third field in the same family. It is the first observed consequence of 14.1**
— a projection documented as complete, implemented as a subset, with no allowlist to notice the gap.
Anything the model gains from here will fail to reach the coordinator the same silent way.

**The product question — whether a coordinator should see a patient's suburb — is not an
implementer's to answer**, and the module's own header says so. It goes to Ward Lead as a question
with the contradiction attached. **Recorded here as open, not as settled.**

### 14.3 — `ward-handover.test.ts` · the transport leg and the open population are both production's own

The leg expectation calls the same function the snapshot calls, on the same input; the "expected"
population is `filter(isOpen)`, and the snapshot computes its scope as `filter(isOpen)`.

**Falsifier (a):** reorder the transport-leg ladder so accepted-and-arrived jobs report _"Accepted"_.
Both sides move; **green**, and the count pin does not bite because the count is unchanged. A duplicate
of the same ladder in a second function would silently diverge from it. **(b):** drop the arrival clause
from `isOpen` — **arrived movements appear on the handover's longest-waits ranking and its
placement-gone-wrong list as if still in flight**, and the non-vacuity floor only rises.

### 14.4 — `ward-referral-suburb.test.ts` · the derivation ban has no probe, and the label pin is circular

The test named for _"does not derive the region from the suburb"_ asserts only that two seed fields are
non-empty side by side. **Nothing here probes derivation**, and there is no positive control showing
what a derived region would look like. **Falsifier:** derive it in the reducer — the exact
administrative fiction the comment forbids. The test reads the **seed**, which the reducer never
touches. Green.

And the unknown-answer labels are read from the same table the function reads. **Falsifier:** empty one
label. Both halves pass — **while every screen prints an empty cell for a patient of no fixed abode,
the exact cohort the red-flagged test twenty lines above exists to protect.**

### 14.5 — `ward-movement-referral-link.test.ts` · a comparison of an object with itself

The two operands resolve to **the same object reference**, because the event does not touch the
referral list.

**Falsifier:** mutate the resolved referral **in place** in that branch. _"Raising a journey answers
nothing on the referral"_ is now false; both operands are that one mutated object, so it passes.
**Only the immutable form of this bug would be caught.** Beside it, an assertion that reduces to two
literals compared, given the two lines above it.

### ⚠️ 14.6 — a naming hazard, recorded because it will mislead a reader rather than a machine

**`describe("a journey with no referral")` reads as "no seeded movement has been referred anywhere",
and that is false** — seeded movements carry parallel referrals, and a sibling file relies on it. The
assertion body is correct and its failure message is precise; **the title over-reads.** It should say
_"no front-door referral"_. Related: the event named `RAISE_REFERRAL` creates a **movement**, not a
referral, and two describes one line apart use "referral" for different nouns. The file handles this
well in its helper names — the risk is in the headings.

---

## Suspicions — the full count

**Sixty-two recorded across the sweep**, none counted as findings. The classes worth carrying, beyond
those already named above:

- **Assertions made unreachable by the assertion above them.** Vitest aborts a test at the first failed
  expectation, so a "not this other value" line after an equality **can never appear in a red run**.
  Two files carry clusters of these, presented in their comments as diagnostic aids. They are
  decorative; the underlying properties are genuinely covered by the equalities.
- **Redundancy that reads as coverage.** Several files follow an exact-list comparison with strictly
  weaker containment lines that cannot fail independently of it. No defect — recorded so a later reader
  does not count them twice.
- **Duplicated tests.** Three files carry a test twice, byte-identical in body and differing only in
  comments. Both run, so the suite reports two passes for one property, and failure attribution between
  them is ambiguous.
- **Cross-file non-emptiness.** A pattern rather than a fault: a loop's non-vacuity is frequently
  guaranteed by a _different_ test in the same file, sometimes in a different `describe`. Correct today,
  fragile to the deletion of a neighbour that does not look load-bearing.

## Closing note on what this sweep is and is not

**Every finding is a reading of source, not a test run.** Only three vitest runs were spent across
fourteen readers, each to settle a specific question, and the results are quoted where they were used.
**No reader edited production**, so no falsifier here has been executed — each is an argued claim about
what would happen, with the code paths named so it can be checked cheaply.

**The readers disagreed with their own briefs four times and said so** — a file described as weak was
found sound, a gap I had reported was found closed, a batch premise about a governance file was found
wrong, and a hazard hunted in one file was found absent there and present in its sibling. Those
corrections are in the text above rather than smoothed away, because a sweep that only ever confirms
its brief is the same failure it is looking for.

---

## Batch 15 — the file the sweep missed, plus the staleness recheck

**Both of the scope defects declared at the top of this document are now closed.** Read at
`codex/task-ward-flow-live-state-20260831`, not at this branch.

### `tests/ward-traps-numbering.test.ts` — 141 lines, never swept until now

It guards a **docs file** rather than `src/` — `docs/ward-flow/traps/silent-transforms.md` — and it is
inside the vitest include glob, so it does run.

⚠️ **Three of its four tests are genuinely load-bearing, which is well above this sweep's average.**
The non-vacuity floor is a real control on the heading parse, and the contiguity test compares the
parsed numbers **in file order** against `[1..N]`, so the primary defect the suite exists for — two
chats each appending a `## 21.` that merges cleanly — does turn it red. Two findings, both in the
scanner's **scope** rather than its logic.

**15.1 — the prose total is read once and never compared.** The regex has no global flag and `exec`
returns match #1 and stops, so nothing compares the copies. **Falsifier:** two chats each append a
closing summary carrying the sentence, in different regions of an append-only file — a textually clean
merge, which is the exact mechanism this suite's own header describes. One says _twenty_, the other
_nineteen_. `exec` reads the first, the count matches, **the test is green and the file states two
contradictory totals.** This is the file's own **entry 14** — _"a rule that exists twice, with nothing
comparing the copies"_ — applied to the check that guards it. Control: exactly one occurrence today,
so a second is invisible by construction rather than by luck.

**15.2 — the entry regex sees only `## <n>. ` headings.** The comment asserts nothing else in the file
uses that shape, which is true; **the converse is what matters.** The file already mixes depths — an
unnumbered `##` section and a `###` subsection both exist — so a numbered entry landing at `###` is
drift, not fantasy. **Falsifier:** append `### 14. …` beneath the existing dated section. The file now
has **two entry 14s**, the three cross-references reading _"entry 14"_ point at whichever the reader
reaches first, and both tests stay green. ⚠️ **The asymmetry that makes this survive: an entry the
regex cannot see does not shorten the list or break contiguity — it is simply absent, so neither test
notices.** Punctuation drift (`## 14: `, `## 14 — `) works identically.

### The staleness recheck on `tests/ward-referral-visibility.test.ts` — 1,428 lines at the master line

**§14.1 — CHANGED, and one clause of mine was wrong.** The tautology stands verbatim and there is
**still no coordinator-side allowlist** (control: 13 `ALLOWED_*` constants across the ref, **0**
coordinator ones; the three in this file are ward-only). **But "the only test touching the coordinator
projection" is false** — a second test at line 606 pins three fields against independently written
expectations. It does not pin the field _set_, so a new field passes it. **The accurate form: no test
pins the coordinator projection's field set, and the only assertion shaped like one is tautological.**

⚠️ **And the master line already documents the whole thing at the site**, in the doc comment on
`coordinatorScopedReferral`, **with the mutation run attached** — vitest 100 passed, `tsc` exit 2 with
`TS2741`, `originSiteCode` removed and restored byte-identically — and it **explicitly declines the
runtime fix** on the ground that `tsc` holds the contract and CI runs it. **So this is a known,
ruled-on limitation rather than an unnoticed gap. I am recording it as CLOSED**, and the reasoning is
this repository's own rule against buying the same verdict twice, which I had already agreed with
before knowing the ruling existed.

**§14.2 — STILL HOLDS, but softer than I wrote it.** The literal-vs-literal comparison and the absent
`typecheck` block are both confirmed. **The correction of emphasis: the sibling test at line 469 runs
real production output against the same allowlist**, so the _ward_ field set **is** genuinely pinned at
runtime. **The accurate form: the line-486 test adds nothing at runtime beyond its sibling** — not
that the ward field set is unpinned.

**§14.2b `suburb` — STILL ABSENT, and now documented at the site.** Neither projection type carries it
(control: 20+ `suburb` hits across `src/`, **2** in this module and both prose). **The module now names
the gap itself and attributes it**, which is the outcome that matters: the finding is carried by the
code rather than only by this document, so it survives the wiring being postponed.

**The dead loop (§14 B3) — STILL HOLDS, self-documented, and mitigated.** The rule it cannot test is
covered non-vacuously elsewhere by fixtures guarded inside the helper every leak assertion calls. **A
documented seed-coverage placeholder, not the only cover for the rule.**

## Final totals, at the master line rather than at this branch

|                                          |         |
| ---------------------------------------- | ------- |
| Ward `.ts` test files on the master line | **90**  |
| Read in full                             | **90**  |
| Numbered findings                        | **131** |

**Two of the three findings I promoted as reaching a screen were later triaged as mis-attributed**
(§2.5 and §11.1, both struck through in place). **One stands** — `sexDesignation` on the movement
path, and it is a production gap rather than a test gap. **That hit rate is the most useful single
number in this document**, and it applies to the 128 findings nobody has triaged.

---

# ⚠️ THE TYPE-CHANGE-FALSIFIER COUNT — assigned by Ward Lead, answered 2026-09-02

**The question: how many of my findings have a falsifier that a vitest-only mutation could not
decide, because the edit is a TYPE change and `tsc` — not the suite — is what would go red.**

## The answer: ONE clear instance, one undecidable from the document, and the rest are runtime edits

**It is a footnote, not a third of the sweep.**

|                                              |                                        |
| -------------------------------------------- | -------------------------------------- |
| Falsifiers carried verbatim in this document | **103**                                |
| Clear type-change falsifiers                 | **1** (§9.9, the home-address field)   |
| Undecidable without opening the source       | **1** (§5.x, the accountability field) |
| Runtime-edit falsifiers, decidable by vitest | **101**                                |

## ⚠️ AND THE POPULATION IS NOT 129, WHICH IS THE FIRST THING TO SAY

**This document carries 103 falsifiers. The readers' reports carry 129 findings.** So **the count
covers 80% of the register and 26 findings were never written down here at all.** ⚠️ **I have also
been saying "131" all night in messages and reports. The document says 129. That is my own
count-from-memory error for the third time today, and it is the number I quoted to four chats.**

## The one that counts, and why it is the shape Ward Lead predicted

**§9.9 — "add a home-address field to the patient type and populate it in the reducer without
touching the allowlist."** The document's own words: _**"Vitest never typechecks, so the annotation
is never compiled, and the record holds an address with the suite green."**_ **The guard here is a
type-level allowlist. A vitest-only mutation run would have shown green and I would have recorded it
as unguarded — when the thing that guards it is the compiler.** That is exactly the failure Ward
Lead described, and this finding names the mechanism itself without my having noticed what it
implied for my own protocol.

## The near-misses, recorded so nobody re-derives them

- **§6.6, the `LeavingDestination` union.** The EDIT is a type change — add a ninth union member —
  **but the consequence is runtime**: the parallel array stays at length 8 and vitest sees that
  perfectly well. **A union edit is not automatically a type-change falsifier**, and this is the
  case that shows why the two must not be conflated.
- **§13.3, "delete the field and its presence entry."** Deleting BOTH keeps the tree consistent, so
  `tsc` stays green too. **Deleting a field is only a type-change falsifier when something still
  reads it.**

## ⚠️ THE STANDING OF THIS COUNT, WHICH IS WEAKER THAN A NUMBER LOOKS

**This is a READING of 103 falsifier descriptions, not 103 `tsc` runs.** **I ran no compiler to
produce it.** Two scans were used — a keyword pass (`type`, `field`, `enum`, `union`, `required`,
with a nonsense control returning 0) and a structural-verb pass (`add`/`delete`/`drop`/`remove`) —
and every hit was then read in full rather than judged from the match. **The mechanical passes find
candidates; they do not classify.** **A falsifier that is a type change without using any of those
words would be missed, and I cannot bound how many that is.**

**The single decisive check nobody has run:** make the §9.9 edit and run
`npx tsc -p tsconfig.typecheck.json --noEmit` beside `vitest`. **If tsc goes red and vitest stays
green, the class is confirmed with one measurement instead of a hundred readings.** The harness at
`4f602c318` can do it.

## ✅ THE CLASS IS CONFIRMED BY MEASUREMENT — run 2026-09-02, on the owner's instruction

**One mutation, both gates, restore proved by hash. This converts the whole section above from a
reading into a result.**

**The edit:** add `homeAddress: string;` to `Patient` in
`src/components/ward-management/ward-patients.ts` — the §9.9 falsifier, made exactly as written.
Nothing else touched.

```
                       BASELINE                    MUTATED
vitest (verbose)       7 RAN · exit 0              7 RAN · exit 0      ← IDENTICAL. Invisible.
tsc --noEmit           0 errors · exit 0           10 errors · EXIT 2
CONTROL (vitest)       tests/does-not-exist-zqx → "No test files found, exiting with code 1"
```

**The compiler's own words:** `error TS2741: Property 'homeAddress' is missing in type '{ id: ...;
umrn: string; givenName: string; familyName: string; dateOfBirth: string; }' but required in type
'Patient'.` Ten of them, across **three** files — `ward-patients-seed.ts` (8),
`ward-flow-reducer.ts` (1), and **`tests/ward-patient-model.test.ts` itself** (1, on its
`Required<Patient>` fixture).

**Restore:** `sha256` back to `6bc33e47d95997db…`, byte-identical, `git ls-files --eol` reports
`i/lf w/lf`, working tree clean. **Verified by hash, never by `git diff`.**

### ⚠️ What this proves, stated narrowly

**The property IS guarded — by `tsc`, in three files — and a `vitest`-only mutation run sees
absolutely nothing.** Same test count, same exit code, before and after. **Had my triage protocol
run this mutation as designed, it would have reported the finding CLEAN and I would have filed a
guarded property as unguarded.** That is the mis-attribution direction, and it is the one that wastes
an owner's time rather than risking a patient's.

⚠️ **And the test was honest about it the whole time.** Its own doc comment says leg 1 _"catches a
field added to the type … a type-only check runs under `tsc` and is absent from a plain `vitest
run`."_ **The limitation was written above the code and my sweep still recorded the file as a check
that cannot fail.** The reader read the assertions and not the paragraph explaining them.

### The count stands, and it is now a measured one for its single member

**One confirmed type-change falsifier of 103 carried falsifiers.** **The other 102 remain readings.**
**One run settled the class; it did not settle the other 102, and nothing here should be quoted as
though it had.**

## ✅ ATTACK 3 IS NO LONGER INCONCLUSIVE — proved 2026-09-02, on the owner's instruction

**The last unproven assertion in this file's mutation table. It stood as INCONCLUSIVE since
`ed701752d` because the first attempt's replacement broke the file's parse and vitest reported
_"no tests"_ — the fork-failure shape, which is not a negative result.**

**What changed: the mutation was applied by a script that replaces the whole declaration with a
syntactically complete one**, and the parse was checked BEFORE the run rather than inferred from it:
`tsc` syntax errors (`TS1xxx`) on the mutated file = **0**.

```
                    BASELINE            EMPTIED MAP
vitest (verbose)    11 RAN · exit 0     11 RAN · 2 failed | 9 passed · EXIT 1
```

⚠️ **11 RAN in both. That is the number that makes this conclusive** — the first attempt ran zero,
and a zero is indistinguishable from a pass on a summary line.

**The guard fired in its own words:**

```
× LINKED_BUT_INVISIBLE_TO_THIS_SCAN has no entry for a route the scan can now see…
  → the map is empty, so the loop below asserts nothing: expected +0 to be 2
```

**So the arity guard moved into the looping body at `ed701752d` DOES fire.** The whole point of that
move was that _a non-vacuity guard is only a guard within its own test body_; that claim is now
measured rather than argued.

### ⚠️ And the second failure confirms the comment's own confession

The orphans test ALSO went red — _"no href of matching shape anywhere under src/:
/therapy-compass/[slug]/brief, /therapy-compass/[slug]/sheet"_. **That is the "old cross-cover" the
code comment calls luck rather than design**, and it is visible here: a different test failing for a
different reason, which would have read as coverage. **Both fired, and only one of them is a guard.**

**Restore:** `sha256` back to `eb937ea61d9fcd39…`, byte-identical, `i/lf w/lf`, tree clean, **and the
file re-run green at 11 passed** — the restore proved by measurement, not by the absence of a
complaint.

### Standing

**Ward Verifier's attacks 1 and 2 remain stated trades, not fixes. Attack 3 is now CLOSED by
measurement. Attack 4's diagnosis stands with its cure refuted (0.0009 discrimination). Attack 5's
observation was true and its named mechanism was wrong.**

### ⚠️ THE CLAUSE THIS RUN ADDED TO THE STANDARD — put above the closure, not below it

**Two tests went red and only one of them was a guard.** The orphans test failed for an entirely
different reason — the cross-cover its own comment calls luck rather than design. **Anyone checking
"did something go red" would have counted that as coverage.**

**Our standard all along has been _break it and watch it fail_. This run shows that watching
SOMETHING fail is compatible with the guard you are testing doing nothing at all.** Ward Verifier's
statement of the missing clause, which I adopt:

> **A mutation demonstrates a specific assertion fired, and only if you can name which one.**

**A RED IS NOT ATTRIBUTION.** The mutation proved the guard; the second failure proved the standard
needed the extra clause. **Both proofs came out of one run, and the second was not the one I set out
to make.**

### The restore standard, named because the shortcut is so tempting

**Three independent confirmations, all three required:**

1. **`sha256` byte-identical** to the pre-mutation copy.
2. **`git ls-files --eol` reports `i/lf w/lf`** — a scripted write can convert every line ending in a
   file and ⚠️ **`git diff` calls that clean**, which cost Ward Builder One 2,721 line endings this
   morning.
3. **A green re-run of the restored file.**

⚠️ **"`git diff` shows nothing" is none of these three.** It is the absence of a complaint, and this
document exists because an absence of complaint is not a result.

## ✅ THE COUNT IS NOW FULLY MEASURED — §4.11 settled 2026-09-02, and it is NOT a type-change falsifier

**The second and last undecidable from the count. Settled by running it rather than by reading the
source, which is what "undecidable from the document" was always going to require.**

**The edit:** in `ward-flow-reducer.ts`, add an `accountability` field to the withdrawal entry
carrying the approached wards' names as free text — §4.11's falsifier exactly as written. **The type
at `ward-model.ts:660` was NOT touched.**

```
                       BASELINE             MUTATED
vitest, that file      8 RAN · exit 0       8 RAN · exit 0
tsc --noEmit           0 errors · exit 0    0 errors · EXIT 0
WHOLE WARD SUITE       —                    146 files · 2,063 RAN · 0 failed · EXIT 0
```

### ⚠️ The result is stronger than "not in the subset": NOTHING CATCHES IT

**Prediction, made before the run and recorded here because it was right for a reason worth
keeping:** the literal is built inside `.map()` and lands in an intermediate `const` before being
spread, **so it is no longer a _fresh_ object literal by the time it reaches a typed target and
TypeScript's excess-property check never fires.** Confirmed: **`tsc` exit 0.**

**So `withdrawnReferrals` entries can carry the losing wards' names in free text, the test whose
title is _"names no place in anything a ward can read"_ stays green, the compiler stays green, and
2,063 tests across 146 files stay green.** ⚠️ **This is a GENUINELY UNGUARDED property, confirmed —
not a lead, not a mis-attribution.** It is the only finding in this document that has been carried
all the way to that verdict.

### The count, closed

|                                      |                                                                 |
| ------------------------------------ | --------------------------------------------------------------- |
| Type-change falsifiers, **measured** | **1 of 103** (§9.9, `tsc` red / `vitest` green)                 |
| §4.11 — the other candidate          | **NOT a type-change falsifier. Measured. Genuinely unguarded.** |
| Remaining falsifiers, still readings | 101                                                             |

### ⚠️ AND THE TRAP I DOCUMENTED CAUGHT ME, MID-RUN, IN THIS FILE

**My first whole-suite command used `--reporter=basic`.** It **died at startup, ran ZERO tests, and
exited 1**. ⚠️ **I wrote the entry warning about this reporter earlier tonight and then typed it
myself within the hour.**

**What saved it was not knowing the trap — I did know it. It was the habit of demanding a RAN count
instead of reading an exit code.** The exit code was `1`, which looks like ordinary test failure and
would have been reported as _"the mutation was caught"_ — **the exact opposite of the true result,
which is that nothing catches it.** **Knowing a trap does not defend against it; a check that would
have surfaced it anyway does.**

## ⚠️ THE COUNT'S CATEGORY WAS WRONG, AND THE CORRECTION MAKES IT MORE USEFUL

**Ward Builder Two's finding, from its mutation of §7.4 — ACCEPTED-FROM-ward-builder-two, measured
by it at `fbf152e1b`, NOT re-measured by me.**

**I asked "which falsifiers can `vitest` not see, because they are type changes?" ⚠️ That is the
wrong axis. The question that matters is: WHICH FALSIFIERS CAN NEITHER INSTRUMENT SEE?**

**Three categories, not two:**

|                              | `vitest`    | `tsc`       | What it means                                                                                                                             |
| ---------------------------- | ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary                     | **catches** | —           | The mutation decides it. 101 of my 103.                                                                                                   |
| Type-change (§9.9)           | **blind**   | **catches** | The property IS guarded — by the compiler. **A vitest-only run reports it CLEAN and I would have filed a guarded property as unguarded.** |
| ⚠️ **Neither** (§4.11, §7.4) | **blind**   | **blind**   | **Genuinely unguarded. Nothing anywhere goes red.**                                                                                       |

**§4.11 is mine, measured here: 8 RAN either way, `tsc` exit 0, and 146 files / 2,063 tests green
with ward names sitting in the withdrawal record.** **§7.4 is Ward Builder Two's, reported as 35
passed, `tsc` exit 0, and 151 files / 2,196 tests green with the module separation genuinely
broken.** **Two findings, two chats, two independent runs, same category.**

⚠️ **So pairing `tsc` with `vitest` — the remedy this document proposed an hour ago — is necessary
and NOT sufficient.** It converts "unknown" into "guarded by the compiler" or "guarded by neither",
and only the second is a defect. **The pair is a better instrument, not a complete one.**

### And the other half of Ward Builder Two's report, which is about my prose rather than my method

**It opened §7.4 EXPECTING TO CLOSE IT**, because my sweep described the guard as a _"regex-based
import scanner"_ when it in fact walks the module graph transitively from two entry points, strips
comments with a scanner that tracks regex literals, and carries its own non-vacuity floor.

⚠️ **My descriptions systematically UNDERSTATE what they describe, and that cuts both ways: it made a
real finding look dismissible.** A reader triaging from my summaries would drop findings for the
wrong reason. **The reports are the primary record; this document's descriptions are not safe to
triage from, and that is now measured rather than suspected.**
