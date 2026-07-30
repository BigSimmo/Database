import { expect, test } from "playwright/test";

import { STYLE_EFFECT_CONTRACTS } from "./helpers/style-contracts";

/**
 * Rendered-effect contracts for the unlayered classes in `globals.css` (ledger #094).
 *
 * A real browser is the only thing that can prove these rules are live. jsdom does
 * not implement cascade layers, and `check:design-system-contract` reads source text
 * — so PR #1316's accent rail passed both while painting nothing. The inventory this
 * spec draws from is kept closed by `tests/style-contract-registry.test.ts`.
 *
 * Chromium only: computed-style serialisation differs between engines (colour
 * function output in particular), so the same assertions would be comparing
 * different string shapes on Firefox and WebKit. The rules under test are
 * engine-independent cascade behaviour, so one engine is sufficient proof.
 */
test.describe("unlayered style rules render their effect", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "computed-style serialisation is engine-specific");

  /** Values a property falls back to when its rule lost the cascade. */
  const inertValues = new Set(["", "none", "rgba(0, 0, 0, 0)", "transparent", "0px", "auto"]);

  for (const contract of STYLE_EFFECT_CONTRACTS) {
    test(contract.description, async ({ page }) => {
      await page.goto(contract.route, { waitUntil: "domcontentloaded" });

      const target = page.locator(contract.selector).first();
      await expect(target).toBeVisible({ timeout: 20_000 });

      // The class must be present AND its declarations must have won. Asserting
      // presence alone is the exact defect this spec exists to catch, so it is
      // only ever the first half of the check.
      await expect(target).toHaveClass(new RegExp(`(^|\\s)${contract.className}(\\s|$)`));

      const properties = [...Object.keys(contract.computed), ...(contract.nonInert ?? [])];
      const computed = await target.evaluate((node, keys) => {
        const style = getComputedStyle(node);
        return Object.fromEntries(keys.map((key) => [key, style[key as keyof CSSStyleDeclaration] as string]));
      }, properties);

      for (const [property, expected] of Object.entries(contract.computed)) {
        expect(computed[property], `${contract.className} computed ${property}`).toBe(expected);
      }

      for (const property of contract.nonInert ?? []) {
        // Token values are theme-dependent, so this asserts visibility rather than
        // a specific colour — which also keeps hex out of the test (design-system rule).
        expect(inertValues.has(computed[property]), `${contract.className} ${property} is inert`).toBe(false);
      }
    });
  }
});
