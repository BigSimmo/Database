/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { calculateYearWeeks, CmeYearInWeeks } from "@/components/cme/cme-year-in-weeks";
import type { CmeEntry } from "@/lib/cme/types";

describe("CmeYearInWeeks", () => {
  it("computes 53 weeks across the CPD year and identifies current week", () => {
    // 2026-10-03 is day 275 of 2026 -> week index 39
    const now = new Date("2026-10-03T10:00:00+08:00");
    const entries: CmeEntry[] = [
      {
        id: "e1",
        title: "Grand Round 1",
        date: "2026-01-05",
        allocations: [{ category: "educational", hours: 2.0 }],
        reflection: "",
        costCents: null,
        transcribed: false,
        routineId: null,
        documentId: null,
        buckets: [],
      },
    ];

    const result = calculateYearWeeks(entries, 2026, now);
    expect(result.weeks.length).toBe(53);
    expect(result.currentWeekIndex).toBe(39);
    expect(result.weeksToGo).toBe(13);
    expect(result.weeks[0].hours).toBe(2.0);
    expect(result.weeks[0].isPast).toBe(true);
    expect(result.weeks[39].isCurrent).toBe(true);
  });

  it("renders 53 micro-bars with accessible aria label", () => {
    const now = new Date("2026-10-03T10:00:00+08:00");
    render(<CmeYearInWeeks entries={[]} year={2026} now={now} />);

    const figure = screen.getByTestId("cme-year-in-weeks");
    expect(figure.getAttribute("aria-label")).toContain("13 weeks to go");
    expect(screen.getByText("Your year in weeks")).toBeTruthy();
    expect(screen.getByText("13 weeks to go")).toBeTruthy();

    const bar39 = screen.getByTestId("cme-year-in-weeks-bar-39");
    expect(bar39).toBeTruthy();
  });

  it("handles future and past years correctly without erroneous week highlighting", () => {
    const now = new Date("2026-10-03T10:00:00+08:00");

    // Upcoming year (2027 viewed from 2026) -> all future, 0 past, none current
    const futureResult = calculateYearWeeks([], 2027, now);
    expect(futureResult.currentWeekIndex).toBe(-1);
    expect(futureResult.weeksToGo).toBe(53);
    expect(futureResult.weeks.every((w) => w.isFuture && !w.isCurrent && !w.isPast)).toBe(true);

    // Past year (2025 viewed from 2026) -> all past, 0 future, none current
    const pastResult = calculateYearWeeks([], 2025, now);
    expect(pastResult.currentWeekIndex).toBe(53);
    expect(pastResult.weeksToGo).toBe(0);
    expect(pastResult.weeks.every((w) => w.isPast && !w.isCurrent && !w.isFuture)).toBe(true);
  });
});
