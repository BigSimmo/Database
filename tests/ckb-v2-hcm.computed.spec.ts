import { expect, test } from "playwright/test";

/**
 * PR 2 — computed HCM proofs for the opt-in `.ckb-v2` layer under all three
 * cascade selectors. Class-string checks are not accepted (GATES.md).
 *
 * Chromium-only: WebKit has no forced-colors implementation (same skip as
 * ui-accessibility solid-button glyph lock).
 */

const SELECTORS = [".ckb-v2", ".dark .ckb-v2", ".ckb-v2.dark"] as const;

const EXPECTED: Record<string, string> = {
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

  for (const selector of SELECTORS) {
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
        { sel: selector, keys: Object.keys(EXPECTED) },
      );

      for (const [token, expected] of Object.entries(EXPECTED)) {
        expect(values[token], `${selector} ${token}`).toBe(expected);
      }
    });
  }
});
