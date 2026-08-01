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

      const properties = [
        ...new Set([
          ...Object.keys(contract.computed),
          ...(contract.nonInert ?? []),
          ...(contract.distinct?.flat() ?? []),
          ...(contract.colorToken ? [contract.colorToken.property] : []),
        ]),
      ];
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

      if (contract.colorToken) {
        const tokenColor = await target.evaluate((node, token) => {
          // Reading the custom property itself can return another `var(...)`.
          // Resolve it through a real colour property for a comparable value.
          const probe = document.createElement("span");
          probe.style.color = `var(${token})`;
          node.appendChild(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        }, contract.colorToken.token);
        expect(computed[contract.colorToken.property], `${contract.className} token colour`).toBe(tokenColor);
      }

      for (const [property, comparison] of contract.distinct ?? []) {
        expect(computed[property], `${contract.className} ${property} must differ from ${comparison}`).not.toBe(
          computed[comparison],
        );
      }

      if (contract.forcedColors) {
        await page.emulateMedia({ forcedColors: "active" });
        for (const [property, expected] of Object.entries(contract.forcedColors)) {
          await expect
            .poll(() =>
              target.evaluate(
                (node, key) => getComputedStyle(node)[key as keyof CSSStyleDeclaration] as string,
                property,
              ),
            )
            .toBe(expected);
        }
        await page.emulateMedia({ forcedColors: null });
      }
    });
  }

  test("tap-sized minimum heights survive the rendered cascade", async ({ page }) => {
    await page.goto("/services?q=CMHT&run=1", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="search-query-ribbon"]:visible').first()).toBeVisible({ timeout: 20_000 });

    const audit = await page.evaluate(() => {
      const describe = (element: Element) =>
        `${element.tagName.toLowerCase()}.${(element.className || "").toString().split(/\s+/).slice(0, 3).join(".")}`;
      const tapToken = getComputedStyle(document.documentElement).getPropertyValue("--spacing-tap").trim();
      const probe = document.createElement("div");
      probe.style.height = tapToken || "2.75rem";
      document.body.appendChild(probe);
      const tapFloor = probe.getBoundingClientRect().height;
      probe.remove();

      const inlineCarriers: string[] = [];
      const undersized: string[] = [];
      let measuredCount = 0;
      for (const element of document.querySelectorAll("*")) {
        const style = getComputedStyle(element);
        const declared = Number.parseFloat(style.minHeight);
        if (!Number.isFinite(declared) || declared < tapFloor - 0.5) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        measuredCount += 1;
        if (style.display === "inline") {
          if (inlineCarriers.length < 10) inlineCarriers.push(`${describe(element)} (min-height ${style.minHeight})`);
          continue;
        }
        if (rect.height < declared - 0.5 && undersized.length < 10) {
          undersized.push(
            `${describe(element)} declared ${style.minHeight}, rendered ${Math.round(rect.height * 10) / 10}px`,
          );
        }
      }
      return { tapFloor, measuredCount, inlineCarriers, undersized };
    });

    expect(audit.tapFloor, "--spacing-tap must resolve to a real pixel floor").toBeGreaterThanOrEqual(44);
    expect(audit.measuredCount, "expected at least one rendered tap-sized control").toBeGreaterThan(0);
    expect(audit.inlineCarriers, "tap-sized min-height is inert on inline boxes").toEqual([]);
    expect(audit.undersized, "controls rendered below their declared min-height").toEqual([]);
  });
});

/**
 * PR 2 — computed HCM proofs for the opt-in `.ckb-v2` layer under all three
 * cascade selectors. Class-string checks are not accepted (GATES.md).
 *
 * Chromium-only: WebKit has no forced-colors implementation (same skip as
 * ui-accessibility solid-button glyph lock).
 */
const CKB_V2_HCM_SELECTORS = [".ckb-v2", ".dark .ckb-v2", ".ckb-v2.dark"] as const;

const CKB_V2_HCM_EXPECTED: Record<string, string> = {
  "--command": "ButtonFace",
  "--command-contrast": "ButtonText",
  "--danger-solid": "Mark",
  "--danger-solid-contrast": "MarkText",
  "--focus": "Highlight",
  "--disabled": "GrayText",
  "--success": "CanvasText",
  "--warning": "CanvasText",
  "--e2": "none",
  "--e4": "none",
  "--glow-primary": "none",
  "--shadow-well": "none",
  "--overlay-backdrop": "transparent",
};

test.describe("ckb-v2 forced-colours computed tokens", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "forced-colors remaps are Chromium-only under Playwright");

  for (const selector of CKB_V2_HCM_SELECTORS) {
    test(`${selector} remaps command/danger/focus/disabled and flattens elevation`, async ({ page }) => {
      // Load the real app stylesheet (imports ckb-v2-tokens.css), then inject probes.
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.emulateMedia({ forcedColors: "active" });

      const values = await page.evaluate(
        ({ sel, keys }) => {
          document.documentElement.classList.remove("dark");
          const root = document.createElement("div");
          if (sel === ".ckb-v2") {
            root.className = "ckb-v2";
          } else if (sel === ".dark .ckb-v2") {
            document.documentElement.classList.add("dark");
            root.className = "ckb-v2";
          } else {
            root.className = "ckb-v2 dark";
          }
          document.body.append(root);
          const style = getComputedStyle(root);
          const out: Record<string, string> = {};
          for (const key of keys) {
            out[key] = style.getPropertyValue(key).trim();
          }
          return out;
        },
        { sel: selector, keys: Object.keys(CKB_V2_HCM_EXPECTED) },
      );

      for (const [token, expected] of Object.entries(CKB_V2_HCM_EXPECTED)) {
        expect(values[token], `${selector} ${token}`).toBe(expected);
      }
    });
  }
});
