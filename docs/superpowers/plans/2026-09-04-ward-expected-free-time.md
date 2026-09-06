# "Expected free" time — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Stop a ward's honest entry of when a bed will be free from being filed as "free now".

**Architecture:** The defect is in the INPUT, not in the classifier. `parseTimeInputToInstant` returns a bare time-of-day; the classifier then correctly decides that a time already past means "act on this now". The fix resolves the typed time against the current instant and shows the ward what it resolved to.

**Tech Stack:** TypeScript 6 strict, React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-ward-flow-direction-and-delays-design.md` §9 (the bed picture) and §10 (a ward's three routine acts must work cold at 3am).

## What was actually measured, at `da9931e00`

- `ward-screen.tsx:116` — `parseTimeInputToInstant` returns `hours * 60 + minutes`, a value in **0–1439**. It is a **time of day**, carrying no day.
- `ward-clock.ts:9` — an `Instant` is minutes counted from **midnight at the start of the day the demo begins**, so `now` is 642 at the 10:42 anchor and **keeps growing past 1440 as the session ages**.
- `ward-bed-availability.ts` — `if (release.expectedAt <= now) return "now";`
- The input at `ward-screen.tsx:1032` is `<input type="time" required>` — no date, no "don't know".

**So: a ward typing 09:00 at 22:00 produces 540 against a `now` of 1320, which is in the past, which is
classified as a bed to act on now.** The same happens to any value once a long-lived session's `now`
passes 1440 — a browser left open at a nurses' station overnight, which is the normal case for this app.

🔴 **DO NOT "FIX" THE CLASSIFIER.** Its own comment records the case it was built for: _"A release whose
expected time has simply passed is not a mistake — it is a ward that has not yet confirmed — and it
belongs in front of somebody rather than in an excluded count."_ That is correct and must keep working.
**Changing it would break a real behaviour to paper over an input defect.**

## Global Constraints

- **A ward's three routine acts — answer a referral, update beds, record a delay — must work cold, with no training, at 3am.** `(OWNER, 2026-09-04)`
- **Never show a bed that is not really there.** `(OWNER, 2026-09-04)`
- **It recommends, it never decides** — so the resolved day is **shown for confirmation, never silently assumed.**
- `ward-clock.ts` is the only module permitted to read the wall clock. This plan does not change that: `now` is passed in, as it already is everywhere else.
- Design tokens, not hex.

---

### Task 1: Resolve a typed time to the next occurrence at or after `now`

**Files:**

- Modify: `src/components/ward-management/ward/ward-screen.tsx` (`parseTimeInputToInstant`, ~line 116, and its two call sites at ~546 and ~678)
- Test: `tests/ward-expected-free-time.test.ts` (create)

**Interfaces:**

- Produces: `parseTimeInputToInstant(value: string, now: Instant): Instant | undefined` — **signature gains `now`**. Both existing call sites already have `now` in scope.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { resolveTimeOfDayAtOrAfter } from "@/components/ward-management/ward/ward-screen";

const MINUTES_PER_DAY = 1440;

describe("a typed time of day resolves to the next time it actually occurs", () => {
  it("keeps a time later today as today", () => {
    // now = 10:42 on day 0. "16:00" today is still ahead.
    expect(resolveTimeOfDayAtOrAfter(16 * 60, 642)).toBe(16 * 60);
  });

  it("rolls a time already past today to the same time tomorrow", () => {
    // now = 22:00 on day 0. A ward typing "09:00" means tomorrow morning.
    expect(resolveTimeOfDayAtOrAfter(9 * 60, 22 * 60)).toBe(MINUTES_PER_DAY + 9 * 60);
  });

  it("works on a session whose clock has already passed midnight", () => {
    // now = 02:00 on day 1 (1440 + 120). "09:00" is later that same day.
    expect(resolveTimeOfDayAtOrAfter(9 * 60, MINUTES_PER_DAY + 120)).toBe(MINUTES_PER_DAY + 9 * 60);
  });

  it("rolls to day 2 when the time has passed on day 1", () => {
    // now = 22:00 on day 1. "09:00" means day 2.
    expect(resolveTimeOfDayAtOrAfter(9 * 60, MINUTES_PER_DAY + 22 * 60)).toBe(2 * MINUTES_PER_DAY + 9 * 60);
  });

  it("treats a time exactly equal to now as now, not as tomorrow", () => {
    expect(resolveTimeOfDayAtOrAfter(642, 642)).toBe(642);
  });

  // ⚠️ The property that makes the whole fix true, stated once rather than per case: the result is
  // always the SAME TIME OF DAY the ward typed, and never earlier than now.
  it("never returns an instant before now, and never changes the time of day", () => {
    for (const typed of [0, 9 * 60, 642, 16 * 60, 23 * 60 + 59]) {
      for (const now of [0, 642, 1320, MINUTES_PER_DAY + 120, 3 * MINUTES_PER_DAY + 900]) {
        const resolved = resolveTimeOfDayAtOrAfter(typed, now);
        expect(resolved).toBeGreaterThanOrEqual(now);
        expect(resolved % MINUTES_PER_DAY).toBe(typed);
      }
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

`node scripts/run-vitest.mjs run --reporter=dot tests/ward-expected-free-time.test.ts`
Expected: FAIL — `resolveTimeOfDayAtOrAfter` is not exported.

⚠️ `npm run test:focused -- --files tests/...` CANNOT run — any path under `tests/` is refused as an unsafe selection and **exits 2**, which is neither a pass nor a failure. Do not use it.

- [ ] **Step 3: Implement**

```ts
/**
 * Resolves a bare time of day to the next instant at which that time actually occurs, at or after
 * `now`.
 *
 * ⚠️ WHY THIS EXISTS. `parseTimeInputToInstant` used to return `hours * 60 + minutes` — a value in
 * 0–1439 carrying no day — while an `Instant` counts minutes from midnight of the demo's first day
 * and keeps growing. So a ward typing "09:00" at 22:00 produced 540 against a `now` of 1320: an
 * instant in the PAST. `ward-bed-availability.ts` then classified it "now", correctly by its own
 * rule, and the ward's honest estimate was filed as a bed that is free this minute.
 *
 * ⚠️ THE CLASSIFIER IS NOT THE DEFECT AND MUST NOT BE CHANGED. Its comment records the case it was
 * built for: a release whose expected time has simply passed is a ward that has not yet confirmed,
 * and it belongs in front of somebody. That stays true.
 *
 * ⚠️ AND THIS IS NOT A GUESS THE APP KEEPS TO ITSELF. The caller renders the resolved day back to
 * the ward before submit, because "it recommends, it never decides" applies to a date the software
 * inferred just as much as to a bed it suggested.
 */
export function resolveTimeOfDayAtOrAfter(timeOfDay: Instant, now: Instant): Instant {
  const startOfToday = Math.floor(now / MINUTES_PER_DAY) * MINUTES_PER_DAY;
  const todayAtThatTime = startOfToday + timeOfDay;
  return todayAtThatTime >= now ? todayAtThatTime : todayAtThatTime + MINUTES_PER_DAY;
}
```

Then change `parseTimeInputToInstant` to take `now` and return `resolveTimeOfDayAtOrAfter(hours * 60 + minutes, now)`, and pass `now` at both call sites (~546, ~678). Keep the `undefined` return for empty or malformed input — refusing is still better than guessing.

- [ ] **Step 4: Run the test — expect PASS**

- [ ] **Step 5: Mutation, and it is mandatory**

Change the final line to `return todayAtThatTime;` (the old, broken behaviour). Re-run. **The "rolls a time already past" and "never returns an instant before now" assertions must go RED.** If either stays green it is not testing the fix. Restore, re-run green, and record which assertions caught it.

- [ ] **Step 6: Commit**

```bash
git add src/components/ward-management/ward/ward-screen.tsx tests/ward-expected-free-time.test.ts
git commit -m "fix(ward-flow): a ward's expected-free time is no longer filed as free now

parseTimeInputToInstant returned a bare time of day against an Instant that
counts from the demo's first midnight and keeps growing, so 09:00 typed at
22:00 landed in the past and was classified as a bed free this minute. Same
for any value once a long-lived nurses'-station session passes midnight.

The classifier is untouched: treating an already-passed release as one a ward
has not yet confirmed is deliberate and correct.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Show the ward which day it resolved to, and allow "don't know"

**Files:**

- Modify: `src/components/ward-management/ward/ward-screen.tsx` (the bed-release form, ~line 1025-1042)
- Test: `tests/ward-expected-free-time.dom.test.tsx` (create)

- [ ] **Step 1: Write the failing DOM test** asserting that (a) entering a time earlier than the current time renders a visible confirmation naming tomorrow, (b) entering a later time names today, and (c) the field is no longer `required` and can be left empty without blocking submit.

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Implement.**
  - Render the resolved day beside the input — "Tomorrow, 09:00" / "Today, 16:00". **Plain words, not a date format.**
  - Remove `required` and accept an empty value, which records the release with **no expected time** rather than a guessed one. ⚠️ A required field with no honest answer forces a wrong one, and this form is used at 3am by someone who may genuinely not know.
  - The empty case must render as a real statement — "No expected time given" — never a dash or a blank.

- [ ] **Step 4: Run the DOM test — expect PASS.**

- [ ] **Step 5: Check nothing downstream assumed `expectedAt` is always present.** `grep -rn "expectedAt" src/components/ward-management/` and open every reader. **A field that was always set and now may be absent is exactly the shape that renders as a plausible empty state instead of an error.**

- [ ] **Step 6: Commit.**

---

### Task 3: Verification

- [ ] `npm run typecheck`
- [ ] `npm run test` — the full offline suite. `ward-bed-availability` has existing tests; they must still pass, because the classifier did not change.
- [ ] `npm run format` and commit the result.
- [ ] Paste the decisive gate line into the report — not "it passed".

## Self-review

**Spec coverage:** §10's "must work cold at 3am" is what Task 2's "don't know" option serves; §9's "never show a bed that is not really there" is what Task 1 fixes.

**Scope check:** deliberately small. It does **not** touch the classifier, the bed-availability model, or any other screen.

**Ambiguity:** the one real decision — roll forward versus ask — is settled explicitly: **roll forward AND show it**, because a silent roll-forward is the same class of error as the bug, just quieter.
