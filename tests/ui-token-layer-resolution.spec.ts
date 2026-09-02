import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Browser } from "playwright/test";

/**
 * Pins what every divergent token role RESOLVES TO, so a token-layer collapse can be
 * proved to change nothing.
 *
 * Why this exists alongside the pixel baseline. `globals.css` and `ckb-v2-tokens.css`
 * both declare 54 role/mode combinations with different values; `.ckb-v2.ckb-v2` (0,2,0)
 * beats `:root` (0,1,0) on the same `<html>`, so the v2 value paints and the globals.css
 * one is dead. Collapsing the layers must keep every resolved value byte-identical.
 *
 * A screenshot cannot discharge that. About ten of these roles never appear on the six
 * baseline screens — `--e3`/`--e4` live on Ward Management, Dictionary and Tools,
 * `--overlay-backdrop` needs an open sheet, and `--clinical-chat-document` has no
 * consumer anywhere in `src/**`, so no picture of any screen can catch a mistake in it.
 * Reading the computed value covers all of them exactly.
 *
 * What is pinned, and why only this. `getPropertyValue` on a custom property returns the
 * value AFTER `var()` substitution (`--text: var(--neutral-900)` reads back as the
 * resolved `#1b2533`), so one string per role captures the whole resolution chain. It is
 * also a plain token stream rather than a rasterised or numerically-resolved colour, so
 * it does not move with the Chromium build. Painted `rgb()` values deliberately are NOT
 * pinned: `color-mix()` rounding and forced-colors system keywords are build-dependent
 * (this container's Chromium resolves `GrayText` to `rgb(96, 0, 0)`), which would make
 * the pin fail on a browser bump for a reason unrelated to the tokens.
 *
 * Regenerate with `UPDATE_TOKEN_RESOLUTION_PIN=1`. Do that ONLY to record a deliberate,
 * reviewed change — regenerating to clear a failure is how this stops proving anything.
 */

// `process.cwd()` rather than `import.meta.url`: specs are transpiled to CommonJS here, so
// `import.meta` is a syntax error at collection time and the file silently stops being a test.
// This matches the idiom in `tests/ui-style-contract.spec.ts`.
const PIN_PATH = join(process.cwd(), "docs", "design-system", "token-resolved-values.json");
const DIVERGENCES_PATH = join(process.cwd(), "docs", "design-system", "token-layer-divergences.json");
const UPDATE = process.env.UPDATE_TOKEN_RESOLUTION_PIN === "1";

/**
 * Forced-colors is captured in BOTH schemes on purpose. `ckb-v2-tokens.css:422-425`
 * records that its forced-colors block must carry the dark selector forms too, or a
 * forced-colors user in dark mode silently keeps the dark palette instead of system
 * colours. That is a combination a light-only capture would never notice.
 */
const STATES = [
  { id: "light", theme: "light", forcedColors: "none" },
  { id: "dark", theme: "dark", forcedColors: "none" },
  { id: "forced-colors-light", theme: "light", forcedColors: "active" },
  { id: "forced-colors-dark", theme: "dark", forcedColors: "active" },
] as const;

type Pin = {
  $comment: string;
  generatedBy: string;
  capturedFrom: { route: string; states: string[] };
  roles: string[];
  resolved: Record<string, Record<string, string>>;
};

function readPin(): Pin | null {
  try {
    return JSON.parse(readFileSync(PIN_PATH, "utf8")) as Pin;
  } catch {
    return null;
  }
}

/**
 * Roles come from the committed pin once it exists, NOT from the divergence report.
 * The report is derived from the two layers still disagreeing, so the collapse empties
 * it by construction — sourcing the list from it would silently shrink this proof to
 * nothing at the exact moment it matters. The divergence report seeds the very first
 * capture and is never consulted again.
 */
function rolesToCheck(pin: Pin | null): string[] {
  if (pin) return pin.roles;
  const report = JSON.parse(readFileSync(DIVERGENCES_PATH, "utf8")) as {
    divergences: Record<string, Record<string, unknown>>;
  };
  return [...new Set(Object.values(report.divergences).flatMap((mode) => Object.keys(mode)))].sort();
}

async function resolveRoles(
  browser: Browser,
  baseURL: string,
  state: (typeof STATES)[number],
  roles: string[],
): Promise<Record<string, string>> {
  const context = await browser.newContext({
    colorScheme: state.theme,
    forcedColors: state.forcedColors,
  });
  try {
    // Seed the cookie AND localStorage before the first navigation so the server itself
    // renders the right `<html>` class. Emulating the media query alone would leave the
    // scheme to the client bootstrap script, which toggles the class after paint and
    // briefly adds `theme-transitioning` — a race with nothing to gain here.
    await context.addCookies([{ name: "clinical-theme", value: state.theme, url: new URL("/", baseURL).toString() }]);
    const page = await context.newPage();
    await page.addInitScript((theme) => {
      try {
        window.localStorage.setItem("clinical-kb-theme", theme);
      } catch {
        // Storage can be unavailable; the cookie already carries the decision.
      }
    }, state.theme);

    const response = await page.goto("/");
    expect(response?.ok(), `GET / must succeed for state "${state.id}"`).toBe(true);

    // Without this the capture is worthless rather than merely wrong: if the theme never
    // applied, the light values would be recorded under the dark key and every later
    // comparison would pass while proving nothing.
    const applied = await page.evaluate(() => ({
      v2: document.documentElement.classList.contains("ckb-v2"),
      dark: document.documentElement.classList.contains("dark"),
    }));
    expect(applied.v2, `"${state.id}": <html> must carry .ckb-v2, or the v2 layer is not under test`).toBe(true);
    expect(applied.dark, `"${state.id}": <html>.dark must match the requested scheme`).toBe(state.theme === "dark");

    return await page.evaluate((names) => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]));
    }, roles);
  } finally {
    await context.close();
  }
}

test.describe("token layer resolution", () => {
  test("every divergent role resolves to its pinned value", async ({ browser, baseURL }) => {
    test.slow();
    expect(baseURL, "baseURL must be configured").toBeTruthy();

    const pin = readPin();
    const roles = rolesToCheck(pin);
    expect(roles.length, "there must be roles to check").toBeGreaterThan(0);

    const resolved: Record<string, Record<string, string>> = {};
    for (const state of STATES) {
      resolved[state.id] = await resolveRoles(browser, baseURL as string, state, roles);
    }

    if (UPDATE) {
      const next: Pin = {
        $comment:
          "Resolved value of every token role that diverges between globals.css and ckb-v2-tokens.css, " +
          "captured per colour scheme and forced-colors state. The token-layer collapse must leave this " +
          "file byte-identical. Regenerate only via UPDATE_TOKEN_RESOLUTION_PIN=1 for a reviewed change.",
        generatedBy: "tests/ui-token-layer-resolution.spec.ts",
        capturedFrom: { route: "/", states: STATES.map((state) => state.id) },
        roles,
        resolved,
      };
      writeFileSync(PIN_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      return;
    }

    expect(pin, "no committed pin — regenerate with UPDATE_TOKEN_RESOLUTION_PIN=1").not.toBeNull();
    for (const state of STATES) {
      expect(resolved[state.id], `resolved token values changed in "${state.id}"`).toEqual(pin?.resolved[state.id]);
    }
  });
});
