import { describe, expect, it } from "vitest";

import {
  releaseBand,
  RELEASE_BANDS,
  TOMORROW_BAND_UNRESOLVED,
} from "../src/components/ward-management/ward-bed-availability";
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

describe("the tomorrow band is an OPEN owner decision, not a settled one", () => {
  it("holds the provisional answer where a reader will meet it, and says it is provisional", () => {
    /*
     * The provisional-values rule: a chosen value and a provisional value look identical in code —
     * both are a literal sitting in a field — and the only difference is whether anybody can find
     * it again. This is the finding-it-again.
     *
     * Asserted against the constant rather than against a comment, because a comment cannot fail.
     */
    expect(TOMORROW_BAND_UNRESOLVED).toMatch(/deferred/i);
    expect(TOMORROW_BAND_UNRESOLVED).toMatch(/tomorrow/i);
  });

  it("names every place the answer lands, so deciding it is not a search", () => {
    /*
     * This test goes red the moment somebody adds the band, and that is its whole purpose: it is
     * the list of what else must move in the same change. A search cannot prove it found
     * everything; this can.
     *
     * When he answers: add the member here, give it a label on every screen that renders one, stop
     * `releaseBand` short-circuiting on a later day, and carry DB-7's notice on the morning page —
     * whose predicted count RISES because the window grew, not because any ward improved.
     */
    expect(RELEASE_BANDS).toEqual(["now", "by-midday", "by-1600", "tonight"]);
    expect(RELEASE_BANDS, "a band was added — see this test's body for what else must move").not.toContain("tomorrow");
  });
});
