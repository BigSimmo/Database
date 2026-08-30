import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 `initialNow` WAS ACCEPTED AND ITS VALUE WAS NEVER USED.
 *
 * The prop was read three times — `!== undefined` in each — to choose the pinned path: offset zero,
 * no tick interval, no wall-clock read. **The number itself went nowhere.** So a caller pinning the
 * clock to any instant other than `NOW_ANCHOR` silently got `NOW_ANCHOR`, with nothing red.
 *
 * ⚠️ **NOTHING WAS WRONG THE DAY IT WAS FOUND, AND THAT IS THE POINT.** Every call site passes
 * `NOW_ANCHOR` or `WARD_ADMISSIONS_ANCHOR`, and those two constants are both `10*60+42` — so the
 * ignored value happened to equal the value used. **The seed-default class with the trigger not yet
 * pulled.** Reported by Ward Referrals as five test files.
 *
 * **Counted here, on `claude/ward-flow-phases-6-7-design`: 85 `initialNow=` call sites in 38 files;
 * 109 mentions of the identifier in 42 files; 5 of the call sites pass `WARD_ADMISSIONS_ANCHOR`.**
 * ⚠️ My first report of this said "roughly eighty-five across thirty-five files" — the 85 was right
 * and the 35 was not, and by the time a third session came to file it, the word "roughly" and my
 * name had both been dropped in one hop. **A relayed number arrives already believed, and the relay
 * erases the one thing that would prompt anyone to check it.** The exact figures are pinned here so
 * the next reader has a measurement rather than a memory of one.
 *
 * The fix treats the pinned and live paths the same way: the anchor offset is *the now we want*
 * minus `NOW_ANCHOR`, whether that now comes from the prop or from the wall clock. Passing exactly
 * `NOW_ANCHOR` is offset zero, which is byte-for-byte today's behaviour, which is why no existing
 * suite moves.
 */
function Clock() {
  const { now } = useWardFlow();
  return <span data-testid="now">{now}</span>;
}

function nowAt(initialNow: number): number {
  const { unmount } = render(
    <WardFlowProvider initialNow={initialNow}>
      <Clock />
    </WardFlowProvider>,
  );
  const value = Number(screen.getByTestId("now").textContent);
  unmount();
  return value;
}

describe("WardFlowProvider honours the instant it is pinned to", () => {
  it("keeps the frozen anchor when that is what it is given — the case 35 suites depend on", () => {
    // The canary for the fix itself: if this moved, every existing DOM suite would be asserting
    // against a different clock than the one it was written for.
    expect(nowAt(NOW_ANCHOR)).toBe(NOW_ANCHOR);
  });

  it("🔴 USES THE VALUE, rather than treating it as a flag meaning 'pinned'", () => {
    // Both directions, and far enough to cross a midnight in each, because the wall-clock helper
    // this replaces is a 0-1439 minute-of-day and the whole class of bug it had was rollover.
    expect(nowAt(NOW_ANCHOR + 500)).toBe(NOW_ANCHOR + 500);
    expect(nowAt(NOW_ANCHOR + 2_000)).toBe(NOW_ANCHOR + 2_000);
    expect(nowAt(NOW_ANCHOR - 700)).toBe(NOW_ANCHOR - 700);
  });

  it("⚠️ MOVES THE SEED WITH IT, so the world does not disagree with the clock", () => {
    // `initialNow` replaces the wall-clock read that positions the whole demo day, so pinning it
    // elsewhere moves the fixture too — the relative shape of the seed is preserved and every
    // instant on screen still moves together. A clock that moved while the data stayed would be
    // the two-clocks defect, introduced by the fix for a one-clock one.
    const shifted = nowAt(NOW_ANCHOR + 500) - nowAt(NOW_ANCHOR);
    expect(shifted, "the two renders must differ by exactly the shift, or the offset is not applied").toBe(500);
  });
});
