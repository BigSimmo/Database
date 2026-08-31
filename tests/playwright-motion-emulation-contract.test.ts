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
  // Phase 2B Task 21. The Caring Contacts workspace asserts BOTH sides of the
  // preference, per screen, and it has to: the suite-wide baseline is already
  // `reduce`, so a screen probed only at the default would be asserting the
  // absence of motion on a page where motion had never been switched on. Naming
  // the spec here is what stops that declaration being deleted later and leaving
  // a block that still reads as a reduced-motion proof.
  "tests/ui-caring-contacts-workspace.spec.ts",
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
      const hasEmulateMedia = /emulateMedia\(\s*\{[^}]*reducedMotion\s*:/m.test(source);
      const hasTestUseReducedMotion = /test\.use\(\s*\{[\s\S]*reducedMotion\s*:/m.test(source);

      expect(
        hasEmulateMedia || hasTestUseReducedMotion,
        `${specPath} is motion-sensitive and must explicitly declare its reducedMotion configuration`,
      ).toBe(true);
    }
  });

  it("ensures globals.css reduced-motion rules suppress animations without deleting visual ink (opacity: 0)", () => {
    const globalsCss = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    expect(globalsCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalsCss).toContain('html:not([data-motion="full"])');
    expect(globalsCss).toContain('html[data-motion="reduced"]');

    // Answer-progress indicator suppression must not delete the ink. The
    // indicator used to be a scrolling ECG strip that reduced motion faded to
    // 0.55; it is now a breathing dot that simply stops at full opacity. Either
    // way the rule this asserts is the same one: stopping the animation must
    // leave something painted.
    const dotRules = [...globalsCss.matchAll(/\.answer-progress-dot\s*\{([^}]*)\}/g)].map((match) => match[1] ?? "");
    const stoppedRules = dotRules.filter((body) => /animation:\s*none/.test(body));
    expect(stoppedRules.length).toBeGreaterThanOrEqual(2);
    for (const rule of stoppedRules) {
      expect(rule).not.toMatch(/opacity:\s*0\s*;/);
      expect(rule).toMatch(/opacity:\s*(?:1|0\.\d+)\s*;/);
    }
  });
});
