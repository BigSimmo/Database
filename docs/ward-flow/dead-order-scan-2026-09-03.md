# Dead-by-order assertions in the ward test suite — a scan and its own three failures

**Ward Builder Three, 2026-09-03.** A located, controlled list of assertions that cannot report
anything, plus the scanner that found them and an account of the two wrong answers it gave first.

## The shape

An assertion placed **after** an exact `.toBe` on the **same value** cannot report anything:

- if the `.toBe` passes, the value is exactly the expected string and the negative is trivially true;
- if the `.toBe` fails, execution stops and the negative never runs.

⚠️ **It is dead in both directions, so nothing has ever gone red to tell anyone it is there.**

## Why this was looked for at all

`tests/ward-referral-screens.dom.test.tsx` contained **three** instances. One had already been found,
fixed and explained at length by an earlier finding (I3). A second sat **three lines below that
explanation**, and a third a few lines above it. ⚠️ **A written diagnosis does not sweep the block it
is written in** — a comment explaining a defect is evidence somebody understood it once, and no
evidence at all about how far they looked.

## The four controls, and what each one catches

Run **per file**, not once per run. A parser that silently stops early is not hypothetical — see the
failures below.

| Control        | Injected                                            | Requirement                                     | Catches                                                      |
| -------------- | --------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| Parse count    | nothing                                             | parsed `expect(` count equals a raw regex count | a parser that truncates or skips                             |
| Sensitivity    | a bad-order pair, at the **end** of the file        | finds exactly **one more**                      | a parser that stops early; a matcher that recognises nothing |
| Specificity    | a **good**-order pair (negative first)              | finds exactly the **same**                      | a matcher that flags everything                              |
| Block boundary | a bad-order pair **split across two `it()` blocks** | finds exactly the **same**                      | pairing two assertions that are not in the same test         |

⚠️ **The injected canary goes at the END of the file on purpose.** A parser that stops early cannot
reach it, so the control fails rather than passing on a file it never read.

## The numbers

- **Files scanned:** 166 (`tests/ward-*.test.ts` and `tests/ward-*.test.tsx`, discovered from disk)
- **Files with candidates:** 15
- **Total candidates:** 21 — 12 in Group 1, 9 in Group 2
- **Per-file control failures:** 0

| File                                  | `expect(` parsed | same-subject adjacent pairs | candidates |
| ------------------------------------- | ---------------: | --------------------------: | ---------: |
| `ward-add-patient.dom.test.tsx`       |               58 |                           8 |          1 |
| `ward-admission-model.test.ts`        |               60 |                           3 |          1 |
| `ward-bed-release-lifecycle.test.ts`  |              101 |                           1 |          1 |
| `ward-ed-psychiatry-hub.dom.test.tsx` |              167 |                          33 |          2 |
| `ward-flow-reducer.test.ts`           |              194 |                           5 |          2 |
| `ward-governance.test.ts`             |               25 |                           3 |          2 |
| `ward-movement-blocker.test.ts`       |               72 |                           4 |          2 |
| `ward-movement-referral-link.test.ts` |               34 |                           1 |          1 |
| `ward-referral-model.test.ts`         |              113 |                           5 |          1 |
| `ward-referral-suburb.test.ts`        |               27 |                           1 |          1 |
| `ward-referral-wait-line.test.ts`     |               10 |                           3 |          1 |
| `ward-screen.dom.test.tsx`            |               53 |                          13 |          1 |
| `ward-statistics.test.ts`             |               41 |                           5 |          2 |
| `ward-travel-bands.test.ts`           |               33 |                           1 |          1 |
| `ward-travel-grouping.test.ts`        |              116 |                           8 |          2 |

## Group 1 — captured value (12)

Subject is a plain identifier or property chain, so both statements read the **same value**.
If the `.toBe` passes the negative is trivially true; if it fails, execution stops and the
negative never runs. **Dead in both directions.**

**`ward-ed-psychiatry-hub.dom.test.tsx:1396`** — subject `stopped.referral.value`

```
A: expect(stopped.referral.value).toBe("3h 00m, stopped at triage");
B: expect(stopped.referral.value, "a span that ended reads as a wait still being served").not.toContain("waiting");
```

**`ward-ed-psychiatry-hub.dom.test.tsx:1415`** — subject `lines.department.value`

```
A: expect(lines.department.value).toBe("Not in department yet");
B: expect(lines.department.value, "a zero for an absent clock reads as just triaged").not.toMatch(/\d/);
```

**`ward-flow-reducer.test.ts:129`** — subject `withdrawn.reason`

```
A: expect(withdrawn.reason).toBe("another_unit_accepted");
B: expect(withdrawn.reason, "the losing ward must not be told who won").not.toContain("RPH Adult Secure");
```

**`ward-governance.test.ts:46`** — subject `audit[0].detail`

```
A: expect(audit[0].detail).toBe("Voluntary → Detained awaiting examination · Recorded by treating team");
B: expect(audit[0].detail).not.toMatch(/recorded_by_treating_team/);
```

**`ward-governance.test.ts:65`** — subject `entries[0].detail`

```
A: expect(entries[0].detail).toBe("Bed needed elsewhere");
B: expect(entries[0].detail).not.toMatch(/bed_needed_for_another_patient/);
```

**`ward-movement-referral-link.test.ts:141`** — subject `movement.referralId`

```
A: expect(movement.referralId).toBe("RF-902");
B: expect(movement.referralId).not.toBe(movement.id.replace(/^WF-/, "RF-"));
```

**`ward-referral-model.test.ts:242`** — subject `DECLINE_REASON_LABELS.belongs_to_another_service`

```
A: expect(DECLINE_REASON_LABELS.belongs_to_another_service).toBe("Belongs to another service");
B: expect(DECLINE_REASON_LABELS.belongs_to_another_service).not.toBe(DECLINE_REASON_LABELS.referred_elsewhere);
```

**`ward-screen.dom.test.tsx:308`** — subject `stateText`

```
A: expect(stateText).toBe("Expected");
B: expect(stateText).not.toBe("expected");
```

**`ward-statistics.test.ts:122`** — subject `statistics.averageEmptyBedMinutes`

```
A: expect(statistics.averageEmptyBedMinutes).toBe(30);
B: expect(statistics.averageEmptyBedMinutes).not.toBe(1030);
```

**`ward-statistics.test.ts:161`** — subject `statistics.averageLengthOfStayDays`

```
A: expect(statistics.averageLengthOfStayDays).toBe(4);
B: expect(statistics.averageLengthOfStayDays).not.toBe(6);
```

**`ward-travel-grouping.test.ts:647`** — subject `entries[0].sinceArrival`

```
A: expect(entries[0].sinceArrival).toBe(NOW - arrivedAt);
B: expect(entries[0].sinceArrival).not.toBe(NOW - pulledAt);
```

**`ward-travel-grouping.test.ts:989`** — subject `accepting`

```
A: expect(accepting).toBe(real.length - trulyAccepting);
B: expect(accepting).not.toBe(trulyAccepting);
```

## Group 2 — re-evaluated call (9)

Subject contains a call, so the value **can legitimately differ** between the two statements and
the negative may be live. ⚠️ **A scanner cannot tell a pure call from an impure one. These need a
human and are recorded as candidates, not findings.**

**`ward-add-patient.dom.test.tsx:285`** — subject `checkState()`

```
A: expect(checkState(), "a three-letter name claims a clear result the matcher never produced").toBe("unchecked");
B: expect(checkState(), "at the matcher's own floor the check still refuses to report").not.toBe("unchecked");
```

**`ward-admission-model.test.ts:311`** — subject `daysInBed(pulledADayBeforeArriving, now)`

```
A: expect(daysInBed(pulledADayBeforeArriving, now)).toBe(3);
B: expect(daysInBed(pulledADayBeforeArriving, now)).not.toBe(4);
```

**`ward-bed-release-lifecycle.test.ts:65`** — subject `release(next, "WR-002").confirmedAt`

```
A: expect(release(next, "WR-002").confirmedAt).toBe(laterInstant);
B: expect(release(next, "WR-002").confirmedAt).not.toBe(originalConfirmedAt);
```

**`ward-flow-reducer.test.ts:1299`** — subject `releaseBand(flagged, NOW)`

```
A: expect(releaseBand(flagged, NOW)).toBe("by-1600");
B: expect(releaseBand(flagged, NOW)).not.toBe("now");
```

**`ward-movement-blocker.test.ts:266`** — subject `movement(referred, movementId).blocker`

```
A: expect(movement(referred, movementId).blocker).toBe(STAGE_TRANSITION_BLOCKERS.referred);
B: expect(movement(referred, movementId).blocker).not.toBe("Awaiting coordinator referral");
```

**`ward-movement-blocker.test.ts:604`** — subject `movement(cleared, target.id).blocker`

```
A: expect(movement(cleared, target.id).blocker).toBe("None — cleared");
B: expect(movement(cleared, target.id).blocker).not.toBe("No blocker");
```

**`ward-referral-suburb.test.ts:131`** — subject `referralSuburbLabel({ kind: "unknown", reason })`

```
A: expect(referralSuburbLabel({ kind: "unknown", reason })).toBe(suburbUnknownLabels[reason]);
B: expect(referralSuburbLabel({ kind: "unknown", reason }), "a label is a sentence, not the code").not.toBe(reason);
```

**`ward-referral-wait-line.test.ts:109`** — subject `referralWaitLine(future, NOW)`

```
A: expect(referralWaitLine(future, NOW)).toBe("0m waiting");
B: expect(referralWaitLine(future, NOW)).not.toContain("-");
```

**`ward-travel-bands.test.ts:143`** — subject `unitTravelBand(referral, divergent.unit)`

```
A: expect(unitTravelBand(referral, divergent.unit)).toBe(travelBand(divergent.region, divergent.unit.siteCode));
B: expect(unitTravelBand(referral, divergent.unit)).not.toBe(travelBand(divergent.region, divergent.originSiteCode));
```

## ⚠️ The scanner gave two wrong answers before this one, and both were controlled

### Run 1 — 39 candidates, every control green, mostly noise

**The control tested only SENSITIVITY** — that the scanner _finds_ an injected bad pair — and never
**specificity**, that it _rejects_ a good one. ⚠️ **A control that can only say yes.** A scanner that
flagged every adjacent pair in the repository would have passed it identically.

Two matcher defects it could not see:

- **`.not.toBe(` contains the substring `.toBe(`**, so a negative assertion was read as an exact one.
- **The subject was truncated at the first parenthesis**, so `asAtStamp(15 * 60 + 22).time` and
  `asAtStamp(8 * 60 + 14).time` compared equal — different arguments, same "subject".

### Run 2 — the boundary control failed on all 166 files, and that is why it was caught

The block-boundary regex was written into the script through a heredoc. The doubled backslash halved,
and `\b` became the byte `0x08` — **a literal BACKSPACE character**. The regex matched nothing, and it
did so **silently**.

```
line 32 raw bytes: "BOUNDARY=re.compile(r'\x08(it|test|describe)\s*\(')"
```

⚠️ **That trap is already written down in this project's notes, and it caught the person who had
written it down.** Writing a trap down does not prevent it.

⚠️ **What actually saved it was the control failing EVERYWHERE AT ONCE.** A control that fails on one
file gets debugged; a control that fails on all 166 gets believed — the difference is that 166
identical failures are obviously about the instrument rather than the subject. **The margin here was
luck about the failure's breadth, not diligence.**

## ⚠️ Known limit of the committed scanner, MEASURED — it undercounts by six

**The scanner pairs each `expect` with the one IMMEDIATELY after it.** A run of three or more
assertions on one subject therefore hides its later members: the pair (negative, negative) has no
exact `.toBe` in first position, so it is never flagged.

⚠️ **This limit was originally written as "may undercount", which is a hedge that cannot be acted
on. Ward Verifier sized it, re-running the committed helpers and changing ONLY the pairing —
every `expect` against every LATER one in the same same-subject run:**

```
adjacent-only (the committed behaviour):  18
whole-run     (blind spot removed)     :  24
UNDERCOUNT                              :   6   <- five real, one (checkState) LIVE
```

**The six, so the limit is a list rather than a number:**

| Location                       | gap | subject                              |
| ------------------------------ | --: | ------------------------------------ |
| `ward-governance.test.ts:65`   |   2 | `entries[0].detail`                  |
| `ward-screen.dom.test.tsx:309` |   2 | `stateText`                          |
| `ward-statistics.test.ts:123`  |   2 | `statistics.averageEmptyBedMinutes`  |
| `ward-statistics.test.ts:124`  |   3 | `statistics.averageEmptyBedMinutes`  |
| `ward-statistics.test.ts:162`  |   2 | `statistics.averageLengthOfStayDays` |

⚠️ **THE NUMBER IS FIVE, NOT SIX. `ward-add-patient.dom.test.tsx:319` was in the original list and
is LIVE**, so it is struck from the table above rather than left to be "fixed": a `fireEvent.change`
immediately before it alters the DOM that `checkState()` re-reads, so the two calls return different
values and the negative genuinely fires. **Recorded as live, not as absent.**

⚠️ **AND TWO CHATS GAVE FLATLY CONTRADICTORY ACCOUNTS OF THAT LINE, BOTH CORRECTLY.** Ward Lead
measured it rather than believe either:

```
tests/ward-add-patient.dom.test.tsx line 319
  at 6c9a16ffb   expect(checkState(), "...").not.toBe("unchecked");
  at f226ce816   });
  at HEAD        expect(checkState(), "...").not.toBe("unchecked");
```

**One chat read its own tree, where line 319 really is a closing brace. The other read the folded
tree, where it really is an assertion. Same line number, two trees, two right answers.**
⚠️ **A line number is not an address unless the tree is named with it** — the third time that
arrived tonight, and the first time it produced a direct contradiction between two chats each of
whom was looking at the file.

---

## ⚠️ A comment claiming a property its assertions cannot deliver

**Found by Ward Lead while checking the count, and it is worth more than the correction.**
In `tests/ward-statistics.test.ts`:

```
120  expect(statistics.averageEmptyBedMinutes).toBe(30);
121  // Named individually so a red run says exactly which wrong clock pairing produced it.
122  expect(statistics.averageEmptyBedMinutes).not.toBe(1030); // pulledAt -> now
123  expect(statistics.averageEmptyBedMinutes).not.toBe(500);  // arrivedAt -> leftAt
124  expect(statistics.averageEmptyBedMinutes).not.toBe(1000); // arrivedAt -> now
```

**Once `.toBe(30)` passes the value IS 30, so all three negatives are determined and none can ever
fire.** ⚠️ **So the comment at `:121` is FALSE: no red run has ever said which wrong clock pairing
produced anything, and none can.** A comment asserting a property the code does not have, sitting
directly above three assertions that cannot deliver it.

**They are three separate dead assertions at three line numbers, each individually dead — not one
finding counted three times.** The adjacent-pair matcher sees only the first, which is exactly the
undercount measured above.

---

**One qualification, against the number:**

- **`averageEmptyBedMinutes` appears at gaps 2 AND 3 — a run of FOUR assertions on one subject.**
  That is the case this limitation describes, found in the wild rather than imagined.

**A stated limit that cannot be sized is better than no limit and worse than a measured one.**

---

## ⚠️ Why a literal search could not find one of these strings

**Recorded because it cost a verification pass.** The line `Not in department yet` appears in the
TEST file and **nowhere in `src`** — a literal search across the whole of `src`, with a control
proving the search reached the right paths, returns nothing.

**It is composed, and twice over:**

- `ward-referrals.ts:463` defines `notInDepartment: "not in department yet"` — **lower case**;
- `ed-screen.tsx:134` renders it through `asLineHeading(...)`, which supplies the capital.

⚠️ **So the rendered string exists at no point in the source as typed.** Neither the exact case nor
the whole phrase is greppable. **An absence returned by a literal search over composed UI text is
not evidence of absence** — and it is exactly the confirming answer nobody re-checks.

---

## After Task F — re-run from the committed scanner

**The tables above are the scan AS FOUND: 21 candidates in 15 files.** Three were then fixed
(Task F). Re-running `docs/ward-flow/scripts/scan-dead-order.py` from its committed location:

```
files scanned: 166
files with candidates: 14
total candidates: 18
CONTROL FAILURES (sensitivity or specificity or parse-count): 0
```

⚠️ **Exactly three fewer, in exactly one fewer file — an independent confirmation that the three
fixes were the three the scan had named, and that the scanner still runs from the repository
rather than only from the session that wrote it.**

---

## What was fixed, and what deliberately was not

**Fixed (Task F):** the three Group 1 rows whose named messages could never be shown —
`"the losing ward must not be told who won"`, `"a span that ended reads as a wait still being
served"`, `"a zero for an absent clock reads as just triaged"`. Somebody wrote the sentence a
clinician would need and it could not fire.

**Left, on Ward Lead's ruling:**

- **The other nine in Group 1.** `.toBe(30)` followed by `.not.toBe(1030)` is a restatement, not a
  misleading claim: nothing is asserted that a reader would believe is being checked. Deleting the
  negative may be better than promoting it, and that is a judgement to make deliberately rather than
  as a side effect of a scan.
- **All nine in Group 2.** They need a human to say whether the call is pure.

## Rebuilding the scanner

The working version is committed alongside this document at
`docs/ward-flow/scripts/scan-dead-order.py`. ⚠️ **Do not re-type the regexes by hand into a heredoc.**
