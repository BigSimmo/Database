import { describe, expect, it } from "vitest";

import { parseCmeHours } from "@/lib/cme/hours-input";

describe("parseCmeHours", () => {
  it("reads hours with a decimal point or a decimal comma", () => {
    expect(parseCmeHours("1.5")).toBe(1.5);
    expect(parseCmeHours("1,5")).toBe(1.5);
    expect(parseCmeHours(".5")).toBe(0.5);
    expect(parseCmeHours(" 3 ")).toBe(3);
    expect(parseCmeHours("2 h")).toBe(2);
    expect(parseCmeHours("1.5 hours")).toBe(1.5);
    expect(parseCmeHours("1.25")).toBe(1.25);
  });

  it("reads minutes as hours, to the hundredth", () => {
    expect(parseCmeHours("90 min")).toBe(1.5);
    expect(parseCmeHours("90min")).toBe(1.5);
    expect(parseCmeHours("45 minutes")).toBe(0.75);
    expect(parseCmeHours("20 min")).toBe(0.33);
  });

  it("refuses anything that is not a positive amount", () => {
    for (const text of ["", "0", "0 min", "abc", "1e10", "-1", "+1", "1.5.5", "1,5,0", "1 h 30", "one"]) {
      expect(parseCmeHours(text), text).toBeNull();
    }
  });
});
