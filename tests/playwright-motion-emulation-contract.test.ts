import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contract #75JA0P:
 * Playwright runs with `reducedMotion: "reduce"` suite-wide as a baseline to prevent
 * animation races in generic tests (ui-smoke/ui-stress).
 *
 * To guarantee animation regressions on physical phones and assistive setups are
 * caught offline, motion-sensitive components and specs must explicitly declare
 * their motion configuration (testing both `no-preference` and `reduce`).
 */

const MOTION_SENSITIVE_SPECS = [
  "tests/ui-phone-motion.spec.ts",
  "tests/ui-phone-scroll.spec.ts",
  "tests/ui-phone-scroll-routes.spec.ts",
  "tests/ui-phone-scroll-page-owned.spec.ts",
  "tests/answer-progress-ui-smoke.spec.ts",
  "tests/ui-accessibility.spec.ts",
  "tests/ui-formulation-result-cards.spec.ts",
] as const;

describe("playwright motion emulation contract (#75JA0P)", () => {
  it("declares the dual-mode motion validation strategy in playwright.config.ts", () => {
    const configSource = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");

    expect(configSource).toContain('contextOptions: { reducedMotion: "reduce" }');
    expect(configSource).toContain("Dual-mode motion validation strategy (#75JA0P)");
    expect(configSource).toContain('reducedMotion: "no-preference"');
    expect(configSource).toContain('reducedMotion: "reduce"');
  });

  it("ensures every motion-sensitive Playwright spec explicitly declares its motion configuration", () => {
    for (const specPath of MOTION_SENSITIVE_SPECS) {
      const source = readFileSync(resolve(process.cwd(), specPath), "utf8");
      const hasReduce =
        /emulateMedia\(\s*\{[^}]*reducedMotion\s*:\s*["']reduce["']/m.test(source) ||
        /test\.use\(\s*\{[\s\S]*reducedMotion\s*:\s*["']reduce["']/m.test(source) ||
        /reducedMotion\s*:\s*["']reduce["']/m.test(source);
      const hasNoPreference =
        /emulateMedia\(\s*\{[^}]*reducedMotion\s*:\s*["']no-preference["']/m.test(source) ||
        /test\.use\(\s*\{[\s\S]*reducedMotion\s*:\s*["']no-preference["']/m.test(source) ||
        /reducedMotion\s*:\s*["']no-preference["']/m.test(source);

      expect(
        hasReduce && hasNoPreference,
        `${specPath} is motion-sensitive and must explicitly declare both "reduce" and "no-preference" reducedMotion configurations`,
      ).toBe(true);
    }
  });

  it("ensures globals.css reduced-motion rules suppress animations without deleting visual ink (opacity: 0)", () => {
    const globalsCss = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(globalsCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalsCss).toContain('html:not([data-motion="full"])');
    expect(globalsCss).toContain('html[data-motion="reduced"]');

    // ECG trace sweep suppression must not delete the ink
    const sweepRules = [...globalsCss.matchAll(/\.answer-activity-trace__sweep\s*\{([^}]*)\}/g)].map(
      (match) => match[1] ?? "",
    );
    const stoppedRules = sweepRules.filter((body) => /animation:\s*none/.test(body));
    expect(stoppedRules.length).toBeGreaterThanOrEqual(2);
    for (const rule of stoppedRules) {
      expect(rule).not.toMatch(/opacity:\s*0\s*;/);
      expect(rule).toMatch(/opacity:\s*0\.\d+;/);
    }
  });
});
