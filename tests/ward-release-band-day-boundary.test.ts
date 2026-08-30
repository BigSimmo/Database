import { describe, expect, it } from "vitest";

import { releaseBand, RELEASE_BANDS } from "../src/components/ward-management/ward-bed-availability";
import { MINUTES_PER_DAY } from "../src/components/ward-management/ward-clock";
import type { BedRelease } from "../src/components/ward-management/ward-model";

/**
 * WHICH BAND A DISCHARGE FALLS IN, ONCE THE CLOCK HAS RUN PAST MIDNIGHT.
 *
 * `releaseBand` compares a raw `Instant` against three constants — 720, 960 and 1320 — that are
 * minutes from the start of DAY ZERO. That was correct while the whole demonstration lived on one
 * synthetic day, and the function's own doc comment defends it for a real reason: a release a full
 * day out must not wrap back into an earlier band.
 *
 * The demo clock now starts at the real time of page load and runs, `ward-clock.ts` carries
 * `dayOf`, and the fixture holds people who have waited longer than a day. So the assumption those
 * three constants rest on — that every instant is a minute-of-day-zero — no longer holds, and
 * these tests are what say so out loud rather than leaving it to be discovered on a screen.
 *
 * Every case below is CONSTRUCTED at a stated instant rather than found in a fixture: the whole
 * subject is what happens at a particular hour on a particular day, and a fixture search would
 * quietly pass by finding a different case.
 */
function aRelease(expectedAt: number): BedRelease {
  return {
    id: "BR-BAND",
    unitId: "rph-adult-secure",
    state: "predicted",
    expectedAt,
    confirmedAt: 0,
    blocked: false,
    blockReason: null,
    basis: "predicted",
  } as unknown as BedRelease;
}

describe("releaseBand across a day boundary", () => {
  it("bands a morning discharge on day zero the way it always has", () => {
    // The behaviour that must not change. 09:00 on the opening day, read at 08:00.
    const now = 8 * 60;
    expect(releaseBand(aRelease(9 * 60), now)).toBe("by-midday");
    expect(releaseBand(aRelease(15 * 60), now)).toBe("by-1600");
    expect(releaseBand(aRelease(20 * 60), now)).toBe("tonight");
  });

  it("bands the SAME clock times the same way on day one", () => {
    /*
     * The defect, if it is one. A discharge at 09:00 tomorrow, read at 08:00 tomorrow, is
     * "by midday" to any ward — the day it happens on changes nothing about which part of the day
     * it is in. If these come back "beyond-today", the three constants are being read as
     * minutes-of-day-zero and the band system has collapsed to a single value.
     */
    const now = MINUTES_PER_DAY + 8 * 60;
    expect(releaseBand(aRelease(MINUTES_PER_DAY + 9 * 60), now)).toBe("by-midday");
    expect(releaseBand(aRelease(MINUTES_PER_DAY + 15 * 60), now)).toBe("by-1600");
    expect(releaseBand(aRelease(MINUTES_PER_DAY + 20 * 60), now)).toBe("tonight");
  });

  it("still refuses to wrap a discharge a full day away into an earlier band", () => {
    // The rule the original comment exists to protect, and it must survive the fix: `now + 1440`
    // falls at the same clock time as `now` and is emphatically not "now".
    const now = 10 * 60;
    expect(releaseBand(aRelease(now + MINUTES_PER_DAY), now)).not.toBe("now");
    expect(releaseBand(aRelease(now + MINUTES_PER_DAY), now)).not.toBe("by-midday");
  });
});

describe("the tomorrow band was an open decision and is now a settled one", () => {
  /*
   * THIS BLOCK USED TO ANNOUNCE AN OPEN DECISION, and it did its job exactly as designed.
   *
   * It held the provisional answer where a reader would meet it, asserted that RELEASE_BANDS had
   * four members, and carried a list of everything that must move when the owner answered - "a
   * search cannot prove it found everything; this can."
   *
   * He answered on 2026-08-30: a rolling twenty-four hours, with tomorrow shown as its own band.
   * Every item on that list was done in `900538328`, and the list is what made checking possible
   * rather than hopeful:
   *
   *   add the member                              RELEASE_BANDS now has five
   *   a label on every screen that renders one     ward-board.tsx and discharge-board.tsx, both
   *                                                caught as compile errors by the total Record
   *   stop short-circuiting on a later day         releaseBand bands by day first, then time of day
   *   carry DB-7's notice on the morning page      the dated definition-change sentence
   *
   * `TOMORROW_BAND_UNRESOLVED` is deleted rather than merged. A constant announcing an open
   * decision that has closed is the provisional-values rule failing in reverse: the next reader
   * would find a marker saying the question is live, and treat a settled answer as provisional.
   */
  it("has five bands, with tomorrow named rather than folded into tonight", () => {
    expect(
      RELEASE_BANDS,
      "the tomorrow band has gone. A discharge expected tomorrow morning then falls through every " +
        "time-of-day comparison and lands in 'tonight' - correct arithmetic, wrong day, and a ward " +
        "reading at handover that a bed frees tonight when it frees tomorrow.",
    ).toEqual(["now", "by-midday", "by-1600", "tonight", "tomorrow"]);
  });
});
