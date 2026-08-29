import { describe, expect, it } from "vitest";

import {
  MINUTES_PER_DAY,
  absoluteWallClockMinutes,
  calendarDateOf,
  clockState,
  dayOf,
  daysBetween,
  demoDayZero,
  elapsedMinutesSinceMount,
  formatElapsed,
  formatInstant,
  formatInstantWithDay,
  formatRemaining,
  minuteOfDay,
  minutesUntil,
  splitDuration,
  wallClockNow,
} from "../src/components/ward-management/ward-clock";

const NOW = 10 * 60 + 42; // 10:42 on the synthetic day

describe("ward clock", () => {
  it("counts minutes forward and backward from now", () => {
    expect(minutesUntil(NOW + 93, NOW)).toBe(93);
    expect(minutesUntil(NOW - 42, NOW)).toBe(-42);
  });

  it("classifies a deadline by how much time is left", () => {
    expect(clockState(NOW - 1, NOW)).toBe("breached");
    expect(clockState(NOW + 30, NOW)).toBe("critical");
    expect(clockState(NOW + 120, NOW)).toBe("due");
    expect(clockState(NOW + 400, NOW)).toBe("clear");
  });

  it("formats a remaining duration for a coordinator, not a machine", () => {
    expect(formatRemaining(93)).toBe("1h 33m left");
    expect(formatRemaining(45)).toBe("45m left");
    expect(formatRemaining(-42)).toBe("42m overdue");
    expect(formatRemaining(-93)).toBe("1h 33m overdue");
  });

  it("formats an instant as a wall-clock time", () => {
    expect(formatInstant(NOW)).toBe("10:42");
    expect(formatInstant(9 * 60 + 5)).toBe("09:05");
  });

  it("wraps a negative instant into a valid wall-clock time instead of printing -1:-14", () => {
    // A synthetic movement can be authored with openedAt before the day began; the audit
    // timeline must still render a real time, not a negative fragment.
    expect(formatInstant(-14)).toBe("23:46");
    expect(formatInstant(-1440)).toBe("00:00");
    expect(formatInstant(-310)).toBe("18:50");
  });

  it("formats an elapsed duration as a wait, never as a breach", () => {
    // A movement opened 95 minutes ago: minutesUntil(now, openedAt) = now - openedAt.
    expect(formatElapsed(minutesUntil(NOW, NOW - 95))).toBe("1h 35m waiting");
    expect(formatElapsed(45)).toBe("45m waiting");
    // formatRemaining would call this "overdue"; formatElapsed must not, and must not go
    // negative even if given a future instant by mistake.
    expect(formatElapsed(-10)).toBe("0m waiting");
  });

  it("measures elapsed minutes across two same-day readings without wrapping", () => {
    expect(elapsedMinutesSinceMount(NOW, NOW + 93)).toBe(93);
    // Mounted and read at the exact same minute: no elapsed time, not a wrap.
    expect(elapsedMinutesSinceMount(NOW, NOW)).toBe(0);
  });

  it("unwraps a midnight rollover instead of freezing the clock", () => {
    // Mounted late in the day (23:50) and read again after the wallClockNow() wrap to 0 at
    // midnight (00:10): a plain subtraction (10 - 1430) is negative, and clamping that at zero
    // — the pre-fix behaviour — makes every deadline on every screen look frozen at the
    // moment of the wrap. 20 real minutes passed; this must report 20, not 0.
    const mountedAt = 23 * 60 + 50; // 23:50
    const readAfterMidnight = 10; // 00:10 the next day
    expect(elapsedMinutesSinceMount(mountedAt, readAfterMidnight)).toBe(20);
  });

  it("unwraps the boundary case: mounted and read at exactly the same minute across the wrap", () => {
    // A session mounted at 23:59 and read one minute later, at 00:00, must report 1 minute
    // elapsed, not a full day.
    expect(elapsedMinutesSinceMount(23 * 60 + 59, 0)).toBe(1);
    // The wrap is exactly `MINUTES_PER_DAY` wide: mounted at minute 0, read at the last
    // minute of the day before rolling over, is the whole day minus one minute — no wrap
    // needed since `current` is still greater than `mountedAt`.
    expect(elapsedMinutesSinceMount(0, MINUTES_PER_DAY - 1)).toBe(MINUTES_PER_DAY - 1);
  });
});

describe("an instant carries a day as well as a clock face", () => {
  /*
   * WHY THESE EXIST. `Instant` was documented as a bare number and used as two different things:
   * `ward-admissions-seed.ts` writes `ANCHOR - stayDays * MINUTES_PER_DAY` for someone admitted days
   * ago, while `formatInstant` and `wallClockNow` treated every value as a minute of one day. The
   * two meanings never visibly collided, and that is the defect's mechanism rather than luck - a
   * WRAPPING formatter cannot fail on an out-of-range value, it silently produces an in-range one.
   * There is no reading of that system that shows a problem, which is why no test caught it and no
   * screen ever looked wrong.
   */
  it("splits an instant into the day it falls on and the time it shows", () => {
    expect(dayOf(10 * 60 + 42), "642 is 10:42 on the opening day").toBe(0);
    expect(dayOf(10 * 60 + 42 + MINUTES_PER_DAY), "the same clock face, the next day").toBe(1);
    expect(dayOf(10 * 60 + 42 - MINUTES_PER_DAY), "the same clock face, the day before").toBe(-1);
    expect(minuteOfDay(10 * 60 + 42 + 3 * MINUTES_PER_DAY), "three days on, still 10:42").toBe(10 * 60 + 42);
    expect(minuteOfDay(-798), "a negative instant is a real time on an earlier day, not a broken one").toBe(
      10 * 60 + 42,
    );
  });

  it("counts whole days between two instants, across any number of them", () => {
    const arrived = 642 - 4 * MINUTES_PER_DAY;
    expect(daysBetween(arrived, 642), "four days in a bed is four days, not 96 hours").toBe(4);
    expect(daysBetween(642, 642 + 209 * MINUTES_PER_DAY), "a long stay must not overflow into nonsense").toBe(209);
    expect(daysBetween(642, 642 + MINUTES_PER_DAY - 1), "part of a day is not a day").toBe(0);
  });

  it("says a long wait in days, because nobody reads a wait in hundreds of hours", () => {
    // The measured defect, not a hypothetical: seeded out-of-area stays of one to two hundred days
    // rendered through this function as `25h 30m` through `5041h 30m`. Every number correct, every
    // number unreadable, and the suite entirely green because no assertion was about the format.
    expect(splitDuration(45), "under an hour stays in minutes").toBe("45m");
    expect(splitDuration(185), "under a day stays in hours and minutes").toBe("3h 05m");
    expect(splitDuration(MINUTES_PER_DAY), "exactly one day is a day, not 24h 00m").toBe("1d");
    expect(splitDuration(MINUTES_PER_DAY + 90), "a day and a half").toBe("1d 1h");
    expect(splitDuration(30 * 60), "the 30-hour wait that used to read as six hours").toBe("1d 6h");
    expect(splitDuration(5041 * 60 + 30), "the measured 5041h 30m becomes readable").toBe("210d 1h");
  });

  it("leaves every duration below a day exactly as it was", () => {
    // The change must be invisible to the screens that never exceed a day - access targets, bed
    // holds, decision times. A formatter that quietly re-rendered short durations too would move
    // figures on screens nobody asked to change.
    for (const minutes of [0, 1, 59, 60, 61, 239, 240, MINUTES_PER_DAY - 1]) {
      const hours = Math.floor(minutes / 60);
      const remainder = minutes % 60;
      const expected = hours > 0 ? `${hours}h ${String(remainder).padStart(2, "0")}m` : `${remainder}m`;
      expect(splitDuration(minutes), `${minutes} minutes must render unchanged`).toBe(expected);
    }
  });
});

describe("the clock knows what day it is, not only what time it is", () => {
  it("agrees with the minute-of-day clock about the time of day", () => {
    /*
     * The two-clocks hazard, pinned. `wallClockNow()` and `absoluteWallClockMinutes()` are separate
     * readings of the same real clock, and a screen showing a stamp from one beside figures from the
     * other would assert a moment it is not displaying. They must never disagree about the minute.
     *
     * Read three times to tolerate a minute boundary falling between two of them: if the first pair
     * disagrees, the boundary moved and the second pair settles it. Without that this flakes roughly
     * once in every few thousand runs, which is worse than not testing it - a test that fails rarely
     * and for no reason teaches people to re-run rather than to look.
     */
    const first = minuteOfDay(absoluteWallClockMinutes());
    const second = wallClockNow();
    if (first !== second) {
      expect(
        minuteOfDay(absoluteWallClockMinutes()),
        "the absolute clock and the minute-of-day clock disagree about the time of day",
      ).toBe(wallClockNow());
    } else {
      expect(first).toBe(second);
    }
  });

  it("carries the date, which is the whole reason it exists", () => {
    // Dividing by a day must give a day index that moves. A minute-of-day reading is always under
    // 1440, so this is exactly the assertion a regression to the old clock fails.
    expect(
      Math.floor(absoluteWallClockMinutes() / MINUTES_PER_DAY),
      "absoluteWallClockMinutes returned a value inside a single day, so it is not carrying a date - " +
        "which is the missing concept the midnight workaround existed to paper over",
    ).toBeGreaterThan(0);
  });

  it("anchors day 0 to local midnight of the day the session opened", () => {
    const opened = new Date(2026, 7, 30, 14, 37, 12, 500);
    const zero = demoDayZero(opened);
    expect(zero.getFullYear()).toBe(2026);
    expect(zero.getMonth()).toBe(7);
    expect(zero.getDate()).toBe(30);
    expect([zero.getHours(), zero.getMinutes(), zero.getSeconds(), zero.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  });

  it("turns an instant plus day zero back into a real moment", () => {
    const zero = demoDayZero(new Date(2026, 7, 30, 14, 37));
    expect(calendarDateOf(10 * 60 + 42, zero).getHours()).toBe(10);
    expect(calendarDateOf(10 * 60 + 42, zero).getMinutes()).toBe(42);
    expect(calendarDateOf(10 * 60 + 42, zero).getDate(), "same day").toBe(30);
    expect(calendarDateOf(10 * 60 + 42 + MINUTES_PER_DAY, zero).getDate(), "the next day").toBe(31);
    expect(calendarDateOf(10 * 60 + 42 - MINUTES_PER_DAY, zero).getDate(), "the day before").toBe(29);
  });

  it("says the day out loud whenever an instant is not today", () => {
    // The defect this exists to stop: a bare clock face SILENTLY ASSERTS today. A patient who
    // arrived three days ago reading as "14:00" looks like this morning, and no test on the current
    // fixture can contradict it because nothing seeded is older than today.
    const now = 10 * 60 + 42;
    expect(formatInstantWithDay(9 * 60, now), "today needs no day said").toBe("09:00");
    expect(formatInstantWithDay(9 * 60 - MINUTES_PER_DAY, now)).toBe("09:00 yesterday");
    expect(formatInstantWithDay(9 * 60 + MINUTES_PER_DAY, now)).toBe("09:00 tomorrow");
    expect(formatInstantWithDay(9 * 60 - 3 * MINUTES_PER_DAY, now)).toBe("09:00, 3 days ago");
    expect(formatInstantWithDay(9 * 60 + 4 * MINUTES_PER_DAY, now)).toBe("09:00, in 4 days");
  });

  it("counts the day from the calendar day, not from the hours between", () => {
    // 23:50 today and 00:10 tomorrow are twenty minutes apart and are DIFFERENT DAYS. A rule based
    // on elapsed hours calls that "today" and is wrong on exactly the night shift this prototype is
    // about.
    const lateTonight = 23 * 60 + 50;
    const earlyTomorrow = MINUTES_PER_DAY + 10;
    expect(formatInstantWithDay(lateTonight, earlyTomorrow), "twenty minutes earlier, and yesterday").toBe(
      "23:50 yesterday",
    );
  });
});
