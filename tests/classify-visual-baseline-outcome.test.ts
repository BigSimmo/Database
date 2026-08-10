import { describe, expect, it } from "vitest";

import {
  classifyVisualBaselineOutcome,
  failureBodiesFromJunit,
  isPixelDriftFailure,
} from "../scripts/classify-visual-baseline-outcome.mjs";

describe("classify-visual-baseline-outcome", () => {
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

  it("fails closed when no report exists after a comparison failure", () => {
    const outcome = classifyVisualBaselineOutcome({
      junitPath: "/tmp/does-not-exist-junit.xml",
      resultsPath: "/tmp/does-not-exist-results.json",
      testResultsDir: "/tmp/does-not-exist-results-dir",
    });
    expect(outcome.kind).toBe("infrastructure");
  });
});
