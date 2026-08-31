# Design sweep fix: readable durations on the Team screen

**Date:** 2026-08-29
**File touched:** `src/components/caring-contacts/workspace/team-roster.tsx`
**New file:** `src/lib/caring-contacts/duration-display.ts` (+ `tests/caring-contacts-duration-display.test.ts`)
**Also touched (test-only):** `tests/caring-contacts-team-roster.dom.test.tsx`

## The defect

On `/caring-contacts/team`, an overdue exception rendered as:

```
Oldest 44575 minutes since its scheduled send
```

That is 30.955 days, shown as a raw minute count a coordinator has to do arithmetic on to read as
"about a month." The same call site's short-duration sibling ("waiting 13 minutes" on a fresh
unclaimed plan) already read correctly, so the defect only appeared once a wait grew past an hour.

## What changed

Presentation only. Added `formatMinutesDuration(totalMinutes: number): string` in
`src/lib/caring-contacts/duration-display.ts` and used it at every place `team-roster.tsx` renders
a minute count as a wait:

1. `unclaimedAgeSentence` (~line 148) — the escalation's screen-reader announcement and the
   non-escalated "N plans have no coordinator" sentence both read from this one function.
2. `unclaimedBacklogSentence` (~line 237, now the AT-facing escalation text) — the oldest backlog
   age since scheduled send.
3. `Backlog` (~line 357) — the same figure in the visible desktop-table / mobile-card cell.

All three previously called the file's own `plural(count, "minute", "minutes")` directly on a raw
minute count with no upper-unit conversion. **No computed value changed.** The 60-minute escalation
threshold (`thresholdMinutes`, wired from `UNCLAIMED_ESCALATION_MINUTES`) is still compared against
the exact minute count and is still _worded_ as "60 minutes" verbatim wherever it appears — that is
a rule statement, not a wait, and stays untouched. `oldestMinutesUnclaimed` and
`oldestMinutesSinceScheduledSend` themselves are unchanged in the domain layer; only how they are
said in the two renderings changed.

I checked the unclaimed-work figure (spec 4.4's escalation age) for the same problem, per the task
brief — it had it too (same raw `plural(minutes, …)` call), so it now goes through the same helper
and is fixed the same way. Both the visible cell and the screen-reader announcement continue to read
identically, because both still read from the same `view` object through the same formatting
function; nothing here can let them drift from each other.

## The rounding rule, and why

- **Below 60 minutes:** shown exactly, in minutes. This is already the coordinator's native unit
  and the common case (most waits are short) — the existing "13 minutes" / "3 minutes" behaviour is
  untouched.
- **60 minutes and above:** rounded to the **nearest** whole unit (never floored, never ceiled).
  90 minutes → "2 hours"; 44575 minutes → "31 days" (44575 / 1440 = 30.955 days).
- **Why nearest, not floor:** flooring would make the screen understate how long an exception has
  actually been waiting — the wrong direction to be wrong in, on a screen whose whole job is telling
  a coordinator something is overdue. Nearest-rounding is honest on average and never off by more
  than half a unit either way.
- **The hour→day handoff is cascaded, not cut at a fixed minute boundary.** Rounding a count just
  under a day (e.g. 1439 minutes = 23h59m) straight to hours would round _up_ to "24 hours" — true,
  but not something anyone says. So the day figure is computed, and shown, only once the hour figure
  would itself reach 24 (`hours >= 24`), and it is rounded from the **original minute count**, not
  from the already-rounded hour count, so the two roundings can't compound. This means 1439, 1440,
  and 1441 minutes — 23h59m, exactly one day, and one day plus a minute — all read as "1 day",
  which is what a coordinator would actually call all three.
- Singular/plural flips at exactly 1 in every unit ("1 minute", "1 hour", "1 day"), matching this
  file's existing `plural` convention.

## Before / after, at several magnitudes

| Minutes | Before          | After                                    |
| ------- | --------------- | ---------------------------------------- |
| 0       | "0 minutes"     | "0 minutes" (unchanged)                  |
| 1       | "1 minute"      | "1 minute" (unchanged)                   |
| 13      | "13 minutes"    | "13 minutes" (unchanged, confirmed live) |
| 59      | "59 minutes"    | "59 minutes" (unchanged)                 |
| 60      | "60 minutes"    | "1 hour"                                 |
| 90      | "90 minutes"    | "2 hours"                                |
| 145     | "145 minutes"   | "2 hours"                                |
| 1439    | "1439 minutes"  | "1 day"                                  |
| 1440    | "1440 minutes"  | "1 day"                                  |
| 44575   | "44575 minutes" | "31 days"                                |

## Existing tests I had to change, and why

`tests/caring-contacts-team-roster.dom.test.tsx` fixtures use `oldestMinutesUnclaimed: 145` in
several cases and asserted the literal string `"145 minutes"` (four assertions: the escalation
group's text, a negative-control absence check, the "oldest has been waiting" sentence, and the
combined-both-ages sentence). Fixing the display necessarily changes what those fixtures render —
145 minutes now reads "2 hours" — so I updated each assertion to the new rendered string and left a
short comment at each site explaining why the number changed. `oldestMinutesSinceScheduledSend: 45`
in the same file stayed under an hour and needed no change; I left it and the assertion on it
("45 minutes since its scheduled send") untouched, and used it in one comment as the paired example
of the short-duration path still being exact.

No assertion in `tests/caring-contacts-team-page.dom.test.tsx`, `tests/caring-contacts-team-route.test.ts`,
or `tests/caring-contacts-team-workload.test.ts` checks rendered minute text — the workload test
asserts the raw domain numbers (`.toBe(90)`, `.toBe(UNCLAIMED_ESCALATION_MINUTES)`, etc.), which are
untouched by a presentation-only change, so none of those needed edits.

## Deliberately left alone

- The escalation threshold's own wording ("... escalates at 60 minutes") is still a raw minute
  count, on purpose — it names a rule, not a wait, and the task brief was explicit that the
  60-minute threshold itself must not change or be reworded.
- `formatMinutesDuration` takes a plain `number`, not `number | null`. All three call sites in
  `team-roster.tsx` already null-check the underlying field (`oldestMinutesUnclaimed` /
  `oldestMinutesSinceScheduledSend` can be `null` when there's nothing to report) before calling
  it, so a `null` branch inside the helper would be dead code the type system can already rule out
  at the call sites. I did not add a null test case to the helper's suite for the same reason.
- No new unit conversion beyond minutes → hours → days (no weeks/months). A month-scale duration
  ("31 days") was judged precise enough for a coordinator to act on; a coarser "about a month" would
  have been the vague wording the design voice explicitly rules out.

## Verification run

Unit tests for the helper, all boundaries requested (0, 1, 59, 60, 61, 90, 1439, 1440, 1441, 44575):

```
 Test Files  2 passed (2)
      Tests  37 passed (37)
```

(`npx vitest run --reporter=dot tests/caring-contacts-duration-display.test.ts tests/caring-contacts-team-roster.dom.test.tsx`)

Every existing Team-screen test file discovered from disk, plus every file mentioning the touched
fields (all four resolved to the same set):

```
 Test Files  4 passed (4)
      Tests  77 passed (77)
```

(`npx vitest run --reporter=dot tests/caring-contacts-team-page.dom.test.tsx tests/caring-contacts-team-roster.dom.test.tsx tests/caring-contacts-team-route.test.ts tests/caring-contacts-team-workload.test.ts`)

Lint, changed files only, zero warnings tolerated:

```
npx eslint src/components/caring-contacts/workspace/team-roster.tsx src/lib/caring-contacts/duration-display.ts tests/caring-contacts-duration-display.test.ts tests/caring-contacts-team-roster.dom.test.tsx --max-warnings 0
```

No output — clean.

Live screen, `http://localhost:3350/caring-contacts/team` (this worktree's running dev server, port
3350, confirmed via `/api/local-project-id`), read with the browser tools:

```
Oldest 31 days since its scheduled send
```

and, on the same page, the unclaimed-work sentence:

```
The oldest has been waiting 13 minutes.
```

confirming the short-duration path is still exact and the long-duration path now reads as a
duration instead of a raw minute count.
