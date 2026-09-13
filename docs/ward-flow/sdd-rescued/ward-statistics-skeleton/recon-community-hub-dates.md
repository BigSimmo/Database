# Recon: community hub withheld dates

Scope: read-only reconnaissance for the approved change (show the two withheld community-hub
dates as elapsed time, e.g. "left 5 weeks ago", instead of a calendar date). No files under
`src/`, `tests/`, `scripts/` or `docs/` were edited.

## 1. Which two dates are withheld, and where

`src/components/ward-management/community/community-screen.tsx`:

- **Expected-back row** — `expectedBackLabel()` (lines 532–538):

  ```tsx
  function expectedBackLabel(admission: Admission): string {
    if (admission.expectedDischargeAt === null) return "No discharge date recorded";
    return "The ward has written down an expected discharge date";
  }
  ```

  Rendered at `data-testid="ward-community-expected-{admission.id}"` (line 392–395), inside the
  "Expected back" section (`data-testid="ward-community-expected"`). The caveat paragraph above it
  carries `data-testid="ward-community-expected-caveat"` (line 378) and states: **"The date itself
  is not shown"**.

- **Departure row** — `departureLabel()` (lines 542–545):
  ```tsx
  function departureLabel(admission: Admission): string {
    if (admission.leftAt === null) return "Left this ward; the departure time was not recorded";
    return "Left this ward";
  }
  ```
  Rendered at `data-testid="ward-community-discharged-{admission.id}"` (line 272–276), inside
  "Discharged to the community" (`data-testid="ward-community-discharged"`). The explanatory
  footnote carries `data-testid="ward-community-departure-dates-absent"` (line 289) and states:
  **"No row above says when somebody left."**

`community-derivations.ts` does not itself withhold anything — it only builds the `expectedBack`
and `dischargedIntoTheArea` arrays; the withholding is entirely in the two render functions above.

## 2. Underlying fields on `Admission` (`ward-admissions.ts`)

- `expectedDischargeAt: Instant | null` (line 383) — "When the ward currently expects this person
  to leave. A WARD'S OWN PLAN, revisable at will and carrying no legal or contractual weight of any
  kind... `null` means nobody has set one."
- `leftAt: Instant | null` (line 434) — "When they went. `null` until then."

Both nullable. `Instant` is `number` (minutes since midnight of demo day 0; see `ward-clock.ts`).
`dischargeDateSetAt: Instant | null` (388) and `dischargeConfirmedAt: Instant | null` (416) also
exist on `Admission` but are **not** the fields the screen withholds — they are not read by
`community-screen.tsx` at all.

## 3. Current time source, and whether the reanchor covers both fields

"Now" comes from `useWardFlow()` (`ward-flow-provider.tsx` line 144: `const { admissions, referrals,
units, now } = useWardFlow();`). The provider computes it at line 162:

```ts
const now = NOW_ANCHOR + anchorOffsetMinutes + elapsed + state.clockOffsetMinutes;
```

where `anchorOffsetMinutes` (line 123–125) is `(initialNow ?? wallClockNow()) - NOW_ANCHOR`.

The same `anchorOffsetMinutes` is the offset the seed is shifted by: `ward-flow-reducer.ts`
line 314–315:

```ts
export function seedWardFlowStateAt(offsetMinutes: number, scenario: WardScenario = "standard"): WardFlowState {
  return shiftInstants(seedWardFlowState(scenario), offsetMinutes);
}
```

called as `seedWardFlowStateAt(anchorOffsetMinutes)` (`ward-flow-provider.tsx` line 127).

`ward-reanchor.ts`'s `INSTANT_FIELDS` set (lines 56–90) is:

```
acceptedAt, arrivedAt, at, pullExpiresAt, cancelledAt, collectedAt, confirmedAt, decidedAt,
dueAt, enRouteAt, expectedAt, expectedReturn, formedAt, openedAt, raisedAt,
pulledAt, awayAtEmergencyDepartmentSince, expectedDischargeAt, dischargeDateSetAt,
dischargeConfirmedAt, leftAt, recordedAt, triagedAt
```

**Both `expectedDischargeAt` and `leftAt` are named**, and were added in `44ca08839` per the
comment. This is load-bearing and confirmed true: `now` and both withheld fields are shifted by the
identical `anchorOffsetMinutes`, so they are on one clock — an elapsed-time computation
(`now - field`) is currently sound for both.

## 4. Existing elapsed-time/duration helpers

No existing helper produces "N weeks/days ago" phrasing. Candidates found in `ward-clock.ts`:

- `export function splitDuration(totalMinutes: number)` (line 176) — returns a unit string like
  `"5d 3h"` or `"25m"` (days+hours ≥1 day, else hours+minutes, else minutes). Closest reusable
  primitive; produces no "ago"/"left"/word suffix itself.
- `export function formatRemaining(minutes: number)` (line 187) — `${splitDuration}... overdue` /
  `... left`, a **countdown** formatter. `community-screen.tsx`'s own header comment (lines 89–93)
  states this is "deliberately never called here" because it implies a deadline/threshold.
- `export function formatElapsed(minutes: number)` (line 197) — `${splitDuration(...)} waiting`,
  reused for "time since a movement opened" (e.g. queue wait), not phrased as "ago".
- `export function daysInBed(admission: Admission, now: Instant): number | null`
  (`ward-admissions.ts` line 522) — the one existing whole-days-since-instant computation pattern
  this project uses (`Math.floor((now - arrivedAt) / MINUTES_PER_DAY)`), already used by this same
  screen's `stayLabel()`.

None of these emit "week" units or "ago" suffix wording. A new formatter is needed; `splitDuration`/
`daysInBed`'s day-math is the reusable primitive, and `formatRemaining`'s "overdue"/"left" idiom is
explicitly barred from this screen by its own doc comment.

## 5. Existing test pins that would go RED

**`tests/ward-community-hub.dom.test.tsx`**, describe block "community hub — no date is rendered,
whatever the clock does" (lines 366–404), explicitly built as this tripwire ("a rendered instant
appearing here should still fail, and should fail as a decision nobody took"):

```ts
expect(screen.getByTestId("ward-community-expected-caveat").textContent).toContain("The date itself is not shown");
expect(screen.getByTestId("ward-community-departure-dates-absent").textContent).toContain(
  "No row above says when somebody left",
);
expect(screen.getByTestId("ward-community-expected-AD-DATED").textContent).toContain(
  "The ward has written down an expected discharge date",
);
expect(screen.getByTestId("ward-community-discharged-AD-HOME").textContent).toContain("Left this ward");
```

Also in the same block:

```ts
for (const relative of ["yesterday", "tomorrow", "days ago", "in 2 days"]) {
  expect(page.toLowerCase(), `the community hub renders "${relative}"`).not.toContain(relative);
}
```

This loop only fires if the new copy literally contains one of those four strings — "weeks ago"
would not match "days ago" verbatim, so this specific assertion is not guaranteed to fire and
depends on exact wording chosen.

**`tests/ward-community-corrected-claims.test.ts`**, describe "claims 1 and 2..." (lines 174–195),
a second, independent pin on the same phrases, explicit in its own comment ("The render is
deliberately unchanged... this pin is what makes a silent change to it visible"):

```ts
expect(pageText).toContain("No row above says when somebody left");
expect(pageText).toContain("The date itself is not shown");
expect(pageText).toContain("every date in this prototype is invented");
expect(pageText).toContain("Every date in this prototype is invented");
expect(pageText).toContain("open question for the product owner");
```

**Total: at least 8 assertions across 2 test files/2 blocks would go RED** the moment either
caveat/footnote paragraph or either row label changes to show elapsed time, because all 8 pin
exact current wording that states the date is withheld. These are confirmed-deliberate tripwires,
not incidental collateral — both blocks say so in their own comments.

`tests/ward-community-hub.test.ts` (non-DOM) and `tests/ward-community-index.*` were checked and
carry no assertions on the withheld-date wording (they test `communityHubLists`/`communityTeamById`
data shape, not this screen's rendered copy).

## 6. Current prose explaining the withholding

`community-screen.tsx`'s file-header doc comment (lines 123–128), written **now** (post the
2026-09-01 correction), is unambiguous that the clock defect is no longer the reason:

> "The two lists still state THAT a date exists rather than what it is — and that is now a product
> decision, not a limitation... Whether these dates should now be SHOWN is the owner's question and
> is deliberately not answered here; this change corrects what the screen says about itself and
> leaves what it renders exactly as it was."

The two in-JSX footnotes (`ward-community-departure-dates-absent`, `ward-community-expected-caveat`)
and the big doc block above `expectedBackLabel`/`departureLabel` (lines 504–531) all say the same
thing in different words: every date in the fixture is _invented_, not that the clock is broken.
**No comment or rendered sentence in this file still cites the clock defect as a live reason** —
every occurrence of the old clock-based justification is explicitly marked corrected/struck, and
`tests/ward-community-corrected-claims.test.ts` (§ "claims 1 and 2") pins that the old phrases
("do not move with it", "could be out by that difference", "true on either clock", "a limitation of
this prototype rather than of the record") are **absent** from the rendered page text.

## 7. Is `expectedDischargeAt` necessarily future?

**No — it can be either past or future, or null.** `ward-admissions.ts` line 376–382 states
explicitly: "A WARD'S OWN PLAN, revisable at will... `null` means nobody has set one, which is a
real and ordinary state: see `isPastExpectedDischarge` for why that must never read as 'not yet
due' OR as 'overdue'." The existence of `isPastExpectedDischarge(admission, now)` (line 556–560,
`return now > expected;`) is itself proof the codebase treats this field as sometimes-past,
sometimes-future — there would be no need for a past/future check on a field guaranteed to be one
or the other. An elapsed-time render of `expectedDischargeAt` ("left −3 days ago") is a real risk
the implementer must handle (e.g. branch on sign, or render "in N days" for future — noting
`tests/ward-community-hub.dom.test.tsx` line 391 currently pins the literal string `"in 2 days"` as
**absent**, so that exact phrasing cannot be reused without touching that pin too).

`leftAt` is set only when `state === "departed"`, i.e. recorded at the moment a departure actually
happened; nothing in the type system enforces `leftAt <= now`, but no code path sets it to a future
instant — it is established by application/reducer logic (a departure is recorded as it occurs), not
by a type constraint. Practically treat it as always ≤ now.
