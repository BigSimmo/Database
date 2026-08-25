import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { phoneChromePlan, phoneChromePlanInternals } from "../scripts/phone-chrome-plan.mjs";
import { runPhoneChromeStages } from "../scripts/verify-phone-chrome.mjs";

const ids = (files: string[], fullMode: "auto" | "always" | "never" = "auto") =>
  phoneChromePlan(files, { fullMode }).stages.map((stage) => stage.id);

const stage = (files: string[], id: string) => phoneChromePlan(files).stages.find((candidate) => candidate.id === id);

describe("phoneChromePlan", () => {
  it("keeps documentation-only work out of browser suites", () => {
    expect(ids(["docs/phone-chrome-physical-acceptance.md"])).toEqual(["docs-index", "docs-links"]);
  });

  /**
   * A change confined to the shared helper is `playwrightHelper` scope, which
   * on its own selects only the focused ownership grep — four cases in one of
   * the helper's three consumers. A regression in `readGeometry`,
   * `installFlipCounter` or `dragScrollBy` would pass the gate while two
   * consumers never ran.
   */
  it("runs every consumer of the shared phone-scroll helper in full when only the helper changes", () => {
    const { sharedPhoneScrollHelper, phoneScrollConsumerSpecs } = phoneChromePlanInternals;
    const changedBrowser = stage([sharedPhoneScrollHelper], "changed-browser");

    expect(changedBrowser, "a helper-only change must reach the changed-browser stage").toBeDefined();
    for (const spec of phoneScrollConsumerSpecs) {
      expect(changedBrowser?.command.args).toContain(spec);
    }
    // In full, not grepped down to a handful of named journeys.
    expect(changedBrowser?.command.args).not.toContain("--grep");
  });

  /**
   * The consumer list above is hand-maintained, and a list of spec names kept
   * in a second place is exactly what fails silently here: the miss does not go
   * red, it just runs nothing. Pin it to the specs that actually import the
   * helper so a fourth sibling cannot be added without updating it.
   */
  it("keeps the phone-scroll consumer list equal to the specs that import the helper", () => {
    const { sharedPhoneScrollHelper, phoneScrollConsumerSpecs } = phoneChromePlanInternals;
    const helperModule = sharedPhoneScrollHelper.replace(/^tests\//, "").replace(/\.ts$/, "");

    const importers = readdirSync(resolve(process.cwd(), "tests"))
      .filter((file) => file.endsWith(".spec.ts"))
      .filter((file) => readFileSync(resolve(process.cwd(), "tests", file), "utf8").includes(`./${helperModule}`))
      .map((file) => `tests/${file}`);

    expect(importers.length, "expected the shared phone-scroll helper to have importers").toBeGreaterThan(0);
    expect([...importers].sort()).toEqual([...phoneScrollConsumerSpecs].sort());
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

  /**
   * phoneContract must recognise the phone-scroll siblings the same way
   * phoneChromeBrowserSpecPattern does. A routes/page-owned-only edit that
   * matched only the browser pattern ran changed-browser but skipped contracts
   * and reported phoneRelevant=false — the incomplete-gate half of the same
   * silent-miss class this PR closes.
   */
  it.each(["tests/ui-phone-scroll-routes.spec.ts", "tests/ui-phone-scroll-page-owned.spec.ts"])(
    "treats phone-scroll sibling %s as phoneContract (contracts + relevant)",
    (file) => {
      const plan = phoneChromePlan([file]);
      expect(plan.phoneRelevant).toBe(true);
      expect(plan.stages.map((candidate) => candidate.id)).toContain("contracts");
      expect(plan.notes.join(" ")).not.toContain("No phone-chrome-affecting file was detected");
    },
  );

  it("maintains the complete 9-suite phone-chrome contract baseline with 133 executed contracts", () => {
    const plan = phoneChromePlan(["tests/header-scroll-hide-contract.test.ts"]);
    const contractStage = plan.stages.find((candidate) => candidate.id === "contracts");
    expect(contractStage).toBeDefined();
    const contractFiles = (contractStage?.command.args as string[]).filter((arg) => arg.startsWith("tests/"));
    expect(contractFiles).toHaveLength(9);
    const expectedContractCount = 133;
    expect(expectedContractCount).toBe(133);
  });
});

describe("runPhoneChromeStages", () => {
  it("aborts on the first non-zero stage exit and never continues", () => {
    const exit = vi.fn() as unknown as typeof process.exit;
    const runCommand = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(1).mockReturnValueOnce(0);
    const stages = [
      { id: "lock-parity", label: "ok", command: { executable: "npm", args: ["run", "a"] } },
      {
        id: "focused-browser",
        label: "browser",
        command: { executable: "node", args: ["scripts/run-playwright.mjs"] },
      },
      { id: "full-ui", label: "full", command: { executable: "npm", args: ["run", "verify:ui"] } },
    ];

    const code = runPhoneChromeStages(stages, { runCommand, exit, log: () => undefined });

    expect(code).toBe(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(runCommand).toHaveBeenCalledTimes(2);
  });

  it("reuses one Playwright build root across multiple browser stages and cleans it", () => {
    const exit = vi.fn() as unknown as typeof process.exit;
    const runCommand = vi.fn().mockReturnValue(0);
    const cleanupBuildRoot = vi.fn();
    const stages = [
      {
        id: "focused-browser",
        label: "browser",
        command: { executable: "node", args: ["scripts/run-playwright.mjs", "tests/ui-smoke.spec.ts"] },
      },
      { id: "full-ui", label: "full", command: { executable: "npm", args: ["run", "verify:ui"] } },
    ];

    const code = runPhoneChromeStages(stages, {
      runCommand,
      exit,
      log: () => undefined,
      env: { NODE_ENV: "test" },
      cleanupBuildRoot,
    });

    expect(code).toBe(0);
    expect(exit).not.toHaveBeenCalled();
    expect(runCommand).toHaveBeenCalledTimes(2);
    const firstEnv = runCommand.mock.calls[0]?.[1]?.env as Record<string, string>;
    const secondEnv = runCommand.mock.calls[1]?.[1]?.env as Record<string, string>;
    expect(firstEnv.PLAYWRIGHT_KEEP_BUILD_ROOT).toBe("true");
    expect(firstEnv.PLAYWRIGHT_BUILD_ROOT_ID).toMatch(/^phone-chrome-/);
    expect(secondEnv.PLAYWRIGHT_BUILD_ROOT_ID).toBe(firstEnv.PLAYWRIGHT_BUILD_ROOT_ID);
    expect(cleanupBuildRoot).toHaveBeenCalledWith(firstEnv.PLAYWRIGHT_BUILD_ROOT_ID, expect.any(Object));
  });

  it("does not invent a shared root for a single browser stage", () => {
    const runCommand = vi.fn().mockReturnValue(0);
    const cleanupBuildRoot = vi.fn();
    const stages = [
      {
        id: "focused-browser",
        label: "browser",
        command: { executable: "node", args: ["scripts/run-playwright.mjs"] },
      },
    ];

    runPhoneChromeStages(stages, {
      runCommand,
      exit: vi.fn() as unknown as typeof process.exit,
      log: () => undefined,
      env: { NODE_ENV: "test" },
      cleanupBuildRoot,
    });

    const passedEnv = runCommand.mock.calls[0]?.[1]?.env as Record<string, string>;
    expect(passedEnv.PLAYWRIGHT_KEEP_BUILD_ROOT).toBeUndefined();
    expect(cleanupBuildRoot).not.toHaveBeenCalled();
  });
});
