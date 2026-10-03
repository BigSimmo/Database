import { describe, expect, it } from "vitest";

import { sortTodayItems } from "@/lib/today/today-order";
import type { TodayItem } from "@/lib/today/today-item";

function item(id: string, overrides: Partial<TodayItem> = {}): TodayItem {
  return { id, mode: "my-work", title: id, due: null, severity: "info", href: `/${id}`, ...overrides };
}

const ids = (items: readonly TodayItem[]) => items.map((entry) => entry.id);

describe("sortTodayItems", () => {
  it("orders overdue, then soon, then info regardless of due", () => {
    const sorted = sortTodayItems([
      item("i", { severity: "info", due: "2026-01-01" }),
      item("s", { severity: "soon", due: "2026-02-01" }),
      item("o", { severity: "overdue", due: "2026-12-01" }),
    ]);
    expect(ids(sorted)).toEqual(["o", "s", "i"]);
  });

  it("puts the earliest due first within a band and undated last", () => {
    const sorted = sortTodayItems([
      item("none"),
      item("late", { due: "2026-10-09" }),
      item("early", { due: "2026-10-05" }),
    ]);
    expect(ids(sorted)).toEqual(["early", "late", "none"]);
  });

  it("reads a date-only due as Perth midnight, before a timed item later that Perth day", () => {
    // 01:00 UTC is 09:00 in Perth on 5 Oct; the date-only item is 00:00 Perth on 5 Oct.
    const sorted = sortTodayItems([
      item("timed", { due: "2026-10-05T01:00:00Z" }),
      item("dateOnly", { due: "2026-10-05" }),
    ]);
    expect(ids(sorted)).toEqual(["dateOnly", "timed"]);
  });

  it("treats a timed item before Perth midnight as earlier than that date", () => {
    // 15:00 UTC on 4 Oct is 23:00 Perth, before midnight Perth on 5 Oct.
    const sorted = sortTodayItems([
      item("dateOnly", { due: "2026-10-05" }),
      item("timed", { due: "2026-10-04T15:00:00Z" }),
    ]);
    expect(ids(sorted)).toEqual(["timed", "dateOnly"]);
  });

  it("breaks ties by title then id, independent of input order", () => {
    const a = item("2", { title: "Same", due: "2026-10-05" });
    const b = item("1", { title: "Same", due: "2026-10-05" });
    const c = item("3", { title: "Alpha", due: "2026-10-05" });
    expect(ids(sortTodayItems([a, b, c]))).toEqual(["3", "1", "2"]);
    expect(ids(sortTodayItems([c, b, a]))).toEqual(["3", "1", "2"]);
  });

  it("does not mutate its input", () => {
    const input = [item("b", { severity: "info" }), item("a", { severity: "overdue" })];
    const snapshot = [...input];
    const sorted = sortTodayItems(input);
    expect(input).toEqual(snapshot);
    expect(sorted).not.toBe(input);
  });
});
