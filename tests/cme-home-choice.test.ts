import { describe, expect, it } from "vitest";

import { cmeReportingCloseDate } from "@/lib/cme/calendar-events";
import { confirmedSourceForHome, isRanzcpHome, readCpdHome, requirementsForCpdHome } from "@/lib/cme/home-choice";
import { createAustralianRanzcpPreset } from "@/lib/cme/presets";

describe("CPD home choice", () => {
  it("keeps the checked source and home name through a save and read", () => {
    const national = { kind: "national" as const, name: "", guide: "National guide, 2026" };
    const other = { kind: "other" as const, name: "Specialist programme", guide: "Programme guide, 2026" };
    expect(readCpdHome(confirmedSourceForHome(national))).toEqual(national);
    expect(readCpdHome(confirmedSourceForHome(other))).toEqual(other);
    expect(readCpdHome("Legacy guide title")).toEqual({ kind: "other", name: "", guide: "Legacy guide title" });
  });

  it("starts national and Other from the national requirements, while RANZCP keeps its college extra", () => {
    const national = requirementsForCpdHome("national", 2026, "2026-01-01");
    const other = requirementsForCpdHome("other", 2026, "2026-01-01");
    const ranzcp = requirementsForCpdHome("ranzcp", 2026, "2026-01-01");
    expect(national.requirements.every((requirement) => requirement.source === "national")).toBe(true);
    expect(other.requirements).toEqual(national.requirements);
    expect(ranzcp.requirements.some((requirement) => requirement.id === "peer-review")).toBe(true);
  });

  it("shows the March reporting date only for an explicit RANZCP preset", () => {
    const preset = createAustralianRanzcpPreset(2026, "2026-01-01");
    const other = confirmedSourceForHome({ kind: "other", name: "RANZCP adjacent", guide: "Local RANZCP note" });
    expect(isRanzcpHome(preset.confirmedSource)).toBe(true);
    expect(cmeReportingCloseDate(preset)).toBe("2027-03-01");
    expect(isRanzcpHome(other)).toBe(false);
    expect(cmeReportingCloseDate({ ...preset, confirmedSource: other })).toBeNull();
  });
});
