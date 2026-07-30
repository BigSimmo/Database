import { describe, expect, it } from "vitest";
import { phoneChromePlan } from "../scripts/phone-chrome-plan.mjs";

const ids = (files: string[], fullMode: "auto" | "always" | "never" = "auto") =>
  phoneChromePlan(files, { fullMode }).stages.map((stage) => stage.id);

const stage = (files: string[], id: string) => phoneChromePlan(files).stages.find((candidate) => candidate.id === id);

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
    const plan = phoneChromePlan(["src/components/DocumentViewer.tsx"]);
    expect(plan.stages.map((candidate) => candidate.id)).toEqual([
      "lock-parity",
      "runtime",
      "contracts",
      "focused-browser",
    ]);
    const focusedBrowser = plan.stages.find((candidate) => candidate.id === "focused-browser");
    expect(
      focusedBrowser?.command.args.some((argument: string) =>
        argument.includes("document detail header overlay and footer follow"),
      ),
    ).toBe(true);
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

  it("treats the phone overlay reserve hook as shared chrome foundation", () => {
    const selected = ids(["src/components/clinical-dashboard/use-phone-overlay-chrome-reserve.ts"]);
    expect(selected).toEqual(["lock-parity", "runtime", "contracts", "focused-browser", "full-ui"]);
  });

  it.each([
    "tests/ui-phone-scroll.spec.ts",
    "tests/ui-phone-scroll-routes.spec.ts",
    "tests/ui-phone-scroll-page-owned.spec.ts",
    "tests/ui-tools.spec.ts",
  ])("runs every journey in changed browser spec %s", (file) => {
    const changedBrowser = stage([file], "changed-browser");
    expect(changedBrowser?.command.args).toContain(file);
    expect(changedBrowser?.command.args).not.toContain("--grep");
  });
});
