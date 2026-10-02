import { describe, expect, it } from "vitest";

import { recentRepeatableActivities } from "@/lib/cme/recent-activities";
import type { CmeEntry } from "@/lib/cme/types";

function entry(id: string, title: string, date: string, hours: number[], archivedAt: string | null = null): CmeEntry {
  return {
    id,
    title,
    date,
    archivedAt,
    allocations: hours.map((h) => ({ category: "educational", hours: h })),
  } as unknown as CmeEntry;
}

describe("recentRepeatableActivities", () => {
  it("lists distinct titles newest first, each at its latest occasion", () => {
    const result = recentRepeatableActivities([
      entry("a", "Peer review group", "2026-06-10", [1]),
      entry("b", "Journal club", "2026-08-01", [1]),
      entry("c", "  peer  review GROUP ", "2026-09-12", [0.5, 0.5]),
      entry("d", "Grand round", "2026-07-20", [1.5]),
    ]);
    expect(result.map((item) => item.id)).toEqual(["c", "b", "d"]);
    expect(result[0]).toMatchObject({ title: "peer  review GROUP", hours: 1 });
  });

  it("skips archived and untitled entries", () => {
    const result = recentRepeatableActivities([
      entry("a", "Webinar", "2026-09-01", [1], "2026-09-02"),
      entry("b", "   ", "2026-09-03", [1]),
      entry("c", "Reading", "2026-08-01", [0.5]),
    ]);
    expect(result.map((item) => item.id)).toEqual(["c"]);
  });

  it("stops at the limit and returns nothing for an empty log", () => {
    const many = Array.from({ length: 8 }, (_, i) => entry(`e${i}`, `Activity ${i}`, `2026-0${(i % 9) + 1}-01`, [1]));
    expect(recentRepeatableActivities(many)).toHaveLength(5);
    expect(recentRepeatableActivities(many, 2)).toHaveLength(2);
    expect(recentRepeatableActivities([])).toEqual([]);
  });

  it("does not reorder the caller's list", () => {
    const list = [entry("a", "A", "2026-01-01", [1]), entry("b", "B", "2026-02-01", [1])];
    recentRepeatableActivities(list);
    expect(list.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
