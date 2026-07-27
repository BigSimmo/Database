import { describe, expect, it } from "vitest";
import { phoneChromePlan } from "../scripts/phone-chrome-plan.mjs";

const ids = (files: string[], fullMode: "auto" | "always" | "never" = "auto") =>
  phoneChromePlan(files, { fullMode }).stages.map((stage) => stage.id);

describe("phoneChromePlan", () => {
  it("keeps documentation-only work out of browser suites", () => {
    expect(ids(["docs/phone-chrome-physical-acceptance.md"])).toEqual(["docs-index", "docs-links"]);
  });

  it("runs focused browser/PWA ownership before the full UI suite for shared chrome", () => {
    const selected = ids(["src/components/ClinicalDashboard.tsx"]);
    expect(selected).toEqual(["lock-parity", "runtime", "contracts", "focused-browser", "full-ui"]);
    expect(selected.indexOf("focused-browser")).toBeLessThan(selected.indexOf("full-ui"));
  });

  it("uses focused document ownership without escalating page-local work to the full suite", () => {
    expect(ids(["src/components/DocumentViewer.tsx"])).toEqual([
      "lock-parity",
      "runtime",
      "contracts",
      "focused-browser",
    ]);
  });

  it("honours an explicit full-suite override while retaining focused stages first", () => {
    const selected = ids(["tests/playwright-scroll.ts"], "always");
    expect(selected.at(-1)).toBe("full-ui");
    expect(selected).toContain("focused-browser");
  });

  it("reports but does not silently re-enable an explicitly disabled recommended suite", () => {
    const plan = phoneChromePlan(["src/components/clinical-dashboard/use-hide-on-scroll.ts"], { fullMode: "never" });
    expect(plan.fullRecommended).toBe(true);
    expect(plan.fullSelected).toBe(false);
    expect(plan.notes.join(" ")).toContain("recommended");
  });
});
