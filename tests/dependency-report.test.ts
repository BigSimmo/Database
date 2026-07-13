import { describe, expect, it } from "vitest";
import { highestSeverity, renderDependencyReport } from "../scripts/dependency-report.mjs";

describe("renderDependencyReport", () => {
  it("reports 'none' when nothing is outdated", () => {
    const md = renderDependencyReport({}, { metadata: { vulnerabilities: { total: 0 } } });
    expect(md).toContain("none 🎉");
    expect(md).toContain("Vulnerabilities:** 0 total");
  });

  it("tables outdated deps and flags major bumps", () => {
    const md = renderDependencyReport(
      {
        next: { current: "16.2.10", wanted: "16.2.10", latest: "16.3.0" },
        zod: { current: "3.24.0", wanted: "3.24.1", latest: "4.4.3" },
      },
      { metadata: { vulnerabilities: { moderate: 2, total: 2 } } },
    );
    expect(md).toContain("2 (1 major)");
    // zod 3 → 4 is a major bump
    expect(md).toMatch(/\| zod \|.*⚠ yes \|/);
    // next 16 → 16 is not
    expect(md).toMatch(/\| next \|.*— \|/);
    expect(md).toContain("moderate 2");
  });

  it("handles missing audit data gracefully", () => {
    const md = renderDependencyReport({}, {});
    expect(md).toContain("audit data unavailable");
  });
});

describe("highestSeverity", () => {
  it("returns the most severe non-zero level", () => {
    expect(highestSeverity({ metadata: { vulnerabilities: { high: 1, low: 3 } } })).toBe("high");
    expect(highestSeverity({ metadata: { vulnerabilities: { low: 3 } } })).toBe("low");
    expect(highestSeverity({ metadata: { vulnerabilities: {} } })).toBe("none");
    expect(highestSeverity({})).toBe("none");
  });
});
