import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_JUNIT,
  classifyVisualBaselineOutcome,
  failureBodiesFromJunit,
  isPixelDriftFailure,
} from "../scripts/classify-visual-baseline-outcome.mjs";

describe("classify-visual-baseline-outcome", () => {
  /**
   * The classifier reads the report the visual suite writes. Those are two constants in
   * two files with nothing tying them together, and they drifted: the classifier shipped
   * `test-results/playwright-junit.xml`, copied from `playwright.config.ts` (the
   * production-UI suite), while `playwright.visual.config.ts` writes `visual-junit.xml`.
   *
   * The failure mode is silent and inverted. Every real pixel drift landed on the
   * "no report at all" branch and was reported as `infrastructure`, so the advisory
   * warning path was dead code and the job went hard red for a reason that had nothing
   * to do with pixels. Observed on main at 686ce37 (run 33600022960):
   * `Visual baseline outcome: infrastructure — No Playwright JUnit or JSON report after
   * visual comparison failure.` while the suite had in fact reported 4 clean mismatches.
   *
   * Parse the config rather than restating the path, so a future rename of the reporter
   * output breaks here instead of quietly disarming the gate again.
   */
  it("reads the report the visual config actually writes", () => {
    const config = readFileSync(new URL("../playwright.visual.config.ts", import.meta.url), "utf8");
    const configured = config.match(/\["junit",\s*\{\s*outputFile:\s*"([^"]+)"/)?.[1];

    expect(configured, "playwright.visual.config.ts must configure a junit outputFile").toBeTruthy();
    expect(DEFAULT_JUNIT).toBe(configured);
  });

  it("treats toHaveScreenshot mismatches as pixel drift", () => {
    expect(
      isPixelDriftFailure(
        "Error: expect(locator).toHaveScreenshot(expected) failed\n\nExpected: baseline.png\nReceived: actual.png",
      ),
    ).toBe(true);
  });

  it("keeps missing baselines and other assertions as non-drift", () => {
    expect(isPixelDriftFailure(`A snapshot doesn't exist at tests/__screenshots__/linux/x.png.`)).toBe(false);
    expect(isPixelDriftFailure("Expected heading to be visible")).toBe(false);
    expect(isPixelDriftFailure("AWAITING_BASELINE still lists dashboard-shell")).toBe(false);
  });

  it("parses junit failure bodies for classification", () => {
    const bodies = failureBodiesFromJunit(`<?xml version="1.0"?>
      <testsuites><testsuite>
        <testcase classname="tests/ui-visual-baseline.spec.ts" name="dashboard matches">
          <failure message="expect(locator).toHaveScreenshot(expected) failed">pixels differ</failure>
        </testcase>
        <testcase classname="tests/ui-visual-baseline.spec.ts" name="missing">
          <failure message="A snapshot doesn't exist at x.png.">missing</failure>
        </testcase>
      </testsuite></testsuites>`);
    expect(bodies).toHaveLength(2);
    expect(isPixelDriftFailure(`${bodies[0].message}\n${bodies[0].body}`)).toBe(true);
    expect(isPixelDriftFailure(`${bodies[1].message}\n${bodies[1].body}`)).toBe(false);
  });

  /**
   * The shape of the real regression, replayed: run 33600022960 on main at 686ce37 had
   * four ordinary `toHaveScreenshot` mismatches and nothing else, which is precisely the
   * advisory case. Because the junit path was wrong it was reported as `infrastructure`
   * and the job failed hard. With the report where the classifier can find it, the same
   * input must come back `pixel-drift` and exit 0.
   */
  it("calls a report of pure screenshot mismatches pixel drift", () => {
    const junitPath = join(mkdtempSync(join(tmpdir(), "visual-junit-")), "visual-junit.xml");
    writeFileSync(
      junitPath,
      `<?xml version="1.0"?>
      <testsuites><testsuite>
        ${["dashboard-shell", "dashboard-shell-phone", "document-viewer", "therapy-compass-home"]
          .map(
            (name) => `<testcase classname="tests/ui-visual-baseline.spec.ts" name="${name} matches its baseline">
          <failure message="expect(locator).toHaveScreenshot(expected) failed">Expected an image 1196px by 868px, received 1196px by 828px. 14370 pixels (ratio 0.02 of all image pixels) are different.</failure>
        </testcase>`,
          )
          .join("\n")}
      </testsuite></testsuites>`,
      "utf8",
    );

    const outcome = classifyVisualBaselineOutcome({ junitPath, testResultsDir: "/tmp/does-not-exist-results-dir" });
    expect(outcome.kind).toBe("pixel-drift");
  });

  /** The visual suite writes no JSON report, so the empty default must not throw. */
  it("tolerates the absent JSON report the visual suite never writes", () => {
    expect(() =>
      classifyVisualBaselineOutcome({ junitPath: "", testResultsDir: "/tmp/does-not-exist-results-dir" }),
    ).not.toThrow();
  });

  it("fails closed when no report exists after a comparison failure", () => {
    const outcome = classifyVisualBaselineOutcome({
      junitPath: "/tmp/does-not-exist-junit.xml",
      resultsPath: "/tmp/does-not-exist-results.json",
      testResultsDir: "/tmp/does-not-exist-results-dir",
    });
    expect(outcome.kind).toBe("infrastructure");
  });
});
