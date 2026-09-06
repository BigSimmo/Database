import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: the section frame renders next/link anchors and jsdom
// cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits } from "@/components/ward-management/ward-sites";
import { wardStatistics } from "@/components/ward-management/ward-statistics";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **A NULL MEASURE MUST NEVER REACH THE SCREEN AS A NUMBER, AND NOTHING ELSE CATCHES THIS.**
 *
 * Ward Lead's ruling, 2026-09-05, after this file's subject was named the highest-risk cell on the
 * four statistics screens. `ward-statistics.ts` had already said the same thing in its own words:
 *
 * > A COUNT OF ZERO IS A REAL ANSWER AND IS TYPED AS ONE. Every `number` field is a genuine count
 * > where `0` is true and correct; every `number | null` field is an average or an extreme where
 * > `null` means "nothing to measure". The two are separated in the TYPE so a screen cannot render
 * > one as the other by accident — **which is the single most likely way this page could lie**,
 * > because "no ward declined" and "declines cannot be counted" look identical once they have both
 * > been flattened to a dash.
 *
 * ⚠️ **A NULL FLATTENED TO ZERO PASSES EVERYTHING ELSE.** It type-checks, because `null ?? 0` is a
 * `number`. It passes any DOM test asserting a figure is present, because a figure IS present. And
 * it looks exactly like a measurement to a reader. "0 days average stay" on a ward page is the
 * claim that patients leave the same day they arrive — an invented clinical fact, produced by a
 * real derivation, with every gate green.
 *
 * ⚠️ **THE DASH IS OUT TOO**, and that is the module's own emphasis rather than a preference of
 * mine: flattening to a dash is the failure it names, because a dash cannot say which of the two
 * things it means.
 *
 * **THE FIXTURE IS THE ARGUMENT.** One ward, no admissions. That single state produces BOTH kinds
 * of answer at once — all three averages null, and every count a true and correct nought — so the
 * screen has to tell them apart in the same render or fail. A test using two fixtures could pass
 * while the screen used one word for both.
 */

const UNIT = allUnits().find((candidate) => candidate.id === "rph-adult-secure");
if (!UNIT) throw new Error("ward-sites.ts no longer defines rph-adult-secure");

/** The six measures `wardStatistics` returns, each with the element that must carry it. */
const NULLABLE = [
  ["ward-stat-length-of-stay", "averageLengthOfStayDays"],
  ["ward-stat-empty-bed-minutes", "averageEmptyBedMinutes"],
  ["ward-stat-waitlist-wait", "averageWaitlistWaitMinutes"],
] as const;

const COUNTS = [
  ["ward-stat-ready-blocked", "readyToLeaveCannot"],
  ["ward-stat-long-stays", "longStays"],
  ["ward-stat-discharge-outcomes", "dischargeDateOutcomes"],
] as const;

function renderWard() {
  return render(
    <WardFlowProvider>
      <StatisticsWardScreen unitId={UNIT!.id} units={[UNIT!]} admissions={[]} />
    </WardFlowProvider>,
  );
}

describe("a ward statistics page never renders an unmeasurable average as a number", () => {
  /**
   * ⚠️ **THE ANTI-VACUITY FLOOR, AND IT IS THE FIRST ASSERTION ON PURPOSE.**
   *
   * Every assertion below is of the form "this element does not contain a digit". A screen that
   * renders NONE of these elements satisfies all of them perfectly — which is the state this page
   * is in today, and would be the state it returned to if a measure were quietly dropped during a
   * redesign. So the population is asserted before anything is asserted about it.
   */
  it("renders all six measures, so an absent screen cannot satisfy the assertions below", () => {
    renderWard();
    for (const [testId, field] of [...NULLABLE, ...COUNTS]) {
      expect(screen.queryByTestId(testId), `${field} is not on the page — nothing below can fail`).not.toBeNull();
    }
  });

  /**
   * The premise, pinned rather than assumed: this fixture really does produce three nulls and three
   * genuine counts. If `wardStatistics` ever stopped returning null here, every assertion below
   * would pass for the wrong reason.
   */
  it("keeps the fixture producing what the assertions are about", () => {
    const stats = wardStatistics(UNIT!.id, [], NOW_ANCHOR);
    expect(stats.averageLengthOfStayDays, "fixture no longer yields a null length of stay").toBeNull();
    expect(stats.averageEmptyBedMinutes, "fixture no longer yields a null empty-bed figure").toBeNull();
    expect(stats.averageWaitlistWaitMinutes, "waitlist wait is no longer unconditionally null").toBeNull();
    expect(stats.readyToLeaveCannot, "readyToLeaveCannot is not a true nought here").toBe(0);
    expect(stats.longStays, "longStays is not a true nought here").toBe(0);
  });

  it.each(NULLABLE)("renders %s (%s) in words, with no digit anywhere in it", (testId, field) => {
    renderWard();
    const text = screen.getByTestId(testId).textContent ?? "";
    expect(text.trim().length, `${field} rendered empty — a blank says nothing`).toBeGreaterThan(0);
    // No digit at all, which is stricter than "no 0" and closes the whole family: a null shown as
    // 0, as 0.0, as 00:00, or rounded into any other number is caught by the same assertion.
    expect(text, `${field} put a digit on the page for a value that cannot be measured: ${text}`).not.toMatch(/\d/u);
    expect(text, `${field} flattened to a dash, which cannot say which absence it means: ${text}`).not.toMatch(
      /[—–-]\s*$/u,
    );
  });

  /**
   * 🔴 **THE DISTINCTION THIS WHOLE FILE EXISTS FOR.** Both kinds of answer are on the page at once
   * in this fixture, so if the screen uses one sentence for both, a reader cannot tell "nothing to
   * measure" from "measured, and the answer is none". This is the assertion that fails if a
   * redesign renders every empty thing with the same word.
   */
  it("does not word an unmeasurable average the same way as a true nought", () => {
    renderWard();
    const nullText = NULLABLE.map(([id]) => (screen.getByTestId(id).textContent ?? "").trim().toLowerCase());
    const countText = COUNTS.map(([id]) => (screen.getByTestId(id).textContent ?? "").trim().toLowerCase());
    for (const n of nullText) {
      for (const c of countText) {
        expect(n, `an unmeasurable average and a true nought render identically: "${n}"`).not.toBe(c);
      }
    }
  });

  /**
   * `averageWaitlistWaitMinutes` is a literal `null` in the return object — never computed, on any
   * ward, with any data, because no instant on `Admission` marks entry to `waitlisted` and the
   * module refuses to fabricate one. So its absence is permanent and must be worded as a property
   * of the record rather than as "not yet".
   */
  it("says the waitlist wait cannot be measured at all, not that it happens to be empty", () => {
    renderWard();
    const text = (screen.getByTestId("ward-stat-waitlist-wait").textContent ?? "").toLowerCase();
    expect(text, `the permanently unmeasurable figure reads as merely empty: ${text}`).toMatch(
      /cannot|no instant|not recorded|nothing marks/u,
    );
  });
});
