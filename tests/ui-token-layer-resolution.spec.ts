import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Browser } from "playwright/test";

/**
 * Pins what every doubly-declared token role RESOLVES TO, so a token-layer collapse can
 * be proved to change nothing.
 *
 * Why this exists alongside the pixel baseline. `globals.css` and `ckb-v2-tokens.css`
 * both declare ~220 role/mode combinations; `.ckb-v2.ckb-v2` (0,2,0) beats `:root`
 * (0,1,0) on the same `<html>`, so the v2 value paints and the globals.css one is dead.
 * Only ~54 of those pairs currently hold DIFFERENT values — the rest are dead too, they
 * merely agree today, which is worse rather than better: editing one changes nothing and
 * nothing says so. Collapsing the layers must keep every resolved value byte-identical,
 * so this pin covers the whole overlap and not just the disagreeing part of it.
 *
 * A screenshot cannot discharge that. Many of these roles never appear on the six
 * baseline screens — `--e3`/`--e4` live on Ward Management, Dictionary and Tools,
 * `--overlay-backdrop` needs an open sheet, and `--clinical-chat-document` has no
 * consumer anywhere in `src/**`, so no picture of any screen can catch a mistake in it.
 * Reading the computed value covers all of them exactly.
 *
 * What is pinned, and why only this. `getPropertyValue` on a custom property returns the
 * value AFTER `var()` substitution (`--text: var(--neutral-900)` reads back as the
 * resolved `#1b2533`), so one string per role captures the whole resolution chain. It is
 * a token stream rather than a rasterised colour, so it is stable across Chromium builds.
 * Painted `rgb()` values deliberately are NOT pinned: `color-mix()` rounding and
 * forced-colors system keywords are build-dependent (this container's Chromium resolves
 * `GrayText` to `rgb(96, 0, 0)`), which would make the pin fail on a browser bump for a
 * reason unrelated to the tokens.
 *
 * Stable across Chromium BUILDS is not stable across ENGINES, and this spec is matched by
 * `productionSpecPattern`, so it is offered to firefox, webkit and the two mobile projects
 * as well. See the `test.skip` below for why it takes only Chromium.
 *
 * Regenerate with `UPDATE_TOKEN_RESOLUTION_PIN=1`. Do that ONLY to record a deliberate,
 * reviewed change — regenerating to clear a failure is how this stops proving anything.
 */

// `process.cwd()` rather than `import.meta.url`: specs are transpiled to CommonJS here, so
// `import.meta` is a syntax error at collection time and the file silently stops being a test.
// This matches the idiom in `tests/ui-style-contract.spec.ts`.
const PIN_PATH = join(process.cwd(), "docs", "design-system", "token-resolved-values.json");
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

type LayerPair = { compat: Map<string, string>; v2: Map<string, string> };

/**
 * Every role BOTH layers declare, in any mode — the set whose globals.css declaration is
 * dead because `.ckb-v2.ckb-v2` (0,2,0) outranks `:root` (0,1,0) on the same <html>.
 *
 * Deliberately wider than `token-layer-divergences.json`, which lists only the ~54
 * combinations that currently DISAGREE. The remaining ~166 are overridden just as
 * completely; they merely happen to carry the same value today, so editing one changes
 * nothing and nothing says so. The collapse removes all of them, so the proof has to
 * cover all of them.
 *
 * Parsed by the repo's own `readLayers()` rather than re-implemented here. A second
 * parser with its own idea of which blocks belong to which mode is precisely how these
 * two layers drifted apart unnoticed; there must be exactly one.
 */
async function overlappingRoles(): Promise<string[]> {
  const { readLayers } = (await import("../scripts/token-layer-divergences.mjs")) as {
    readLayers: () => Record<string, LayerPair>;
  };
  const overlap = new Set<string>();
  for (const { compat, v2 } of Object.values(readLayers())) {
    for (const name of compat.keys()) if (v2.has(name)) overlap.add(name);
  }
  return [...overlap].sort();
}

/**
 * Roles come from the committed pin once it exists, NOT recomputed from the stylesheets.
 * The overlap above empties by construction the moment the collapse lands — sourcing the
 * list from it would silently shrink this proof to nothing at the exact moment it matters.
 * The overlap seeds the very first capture, and afterwards is used only to detect roles
 * the pin does not yet cover (see the coverage cross-check in the test itself).
 */
async function rolesToCheck(pin: Pin | null): Promise<string[]> {
  // Regeneration always re-derives the list. Otherwise a widened overlap could never be
  // adopted: the pin would keep seeding itself with its own (narrower) roles forever.
  if (UPDATE || !pin) return await overlappingRoles();
  return pin.roles;
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
  /**
   * Chromium only, for two independent reasons — neither of them convenience.
   *
   * 1. Half the captured states need forced-colors emulation, which is Chromium-only in
   *    Playwright (this repo says so in a dozen places, e.g.
   *    `tests/ui-caring-contacts-workspace.spec.ts:484`). On another engine the
   *    `forced-colors` states would silently capture ordinary values and could never
   *    match a pin taken under forced colours.
   * 2. Engines serialise a substituted custom property differently. Chromium rewrites
   *    `rgb(13 40 71 / 4%)` to `#0d28470a` and `cubic-bezier(0.4, 0, 0.2, 1)` to
   *    `cubic-bezier(.4,0,.2,1)`; other engines keep their own spacing and colour
   *    notation. Ten pinned roles carry such values, so one pin cannot describe all five
   *    projects, and normalising whitespace alone would not be enough — the colour
   *    notation differs too.
   *
   * Nothing is lost. This proves how the CASCADE resolves, which is spec-defined rather
   * than engine-defined; per-engine pins would record serialisation trivia, not tokens.
   */
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "token serialisation and forced-colors emulation are Chromium-specific",
  );

  test("every divergent role resolves to its pinned value", async ({ browser, baseURL }) => {
    test.slow();
    expect(baseURL, "baseURL must be configured").toBeTruthy();

    const pin = readPin();
    const roles = await rolesToCheck(pin);
    expect(roles.length, "there must be roles to check").toBeGreaterThan(0);

    // The pin is authoritative for WHICH roles get checked (see `rolesToCheck` above), but
    // that means a token change adding a NEW declaration to globals.css for a role the v2
    // layer already owns would go unnoticed: the new declaration is dead on arrival, and
    // this spec would stay green having never looked at it. Cross-check coverage against
    // the live overlap without letting the overlap drive the list.
    if (pin && !UPDATE) {
      const uncovered = (await overlappingRoles()).filter((role) => !pin.roles.includes(role));
      expect(
        uncovered,
        `globals.css declares role(s) the v2 layer overrides that this pin does not cover — ` +
          `a dead declaration nothing is measuring. Regenerate with ` +
          `UPDATE_TOKEN_RESOLUTION_PIN=1 after reviewing: ${uncovered.join(", ")}`,
      ).toEqual([]);
    }

    const resolved: Record<string, Record<string, string>> = {};
    for (const state of STATES) {
      resolved[state.id] = await resolveRoles(browser, baseURL as string, state, roles);
    }

    if (UPDATE) {
      const next: Pin = {
        $comment:
          "Resolved value of every token role that ckb-v2-tokens.css overrides in globals.css — the whole " +
          "overlap, not only the roles whose values differ. Captured per colour scheme and forced-colors " +
          "state. The token-layer collapse must leave this file byte-identical. Regenerate only via " +
          "UPDATE_TOKEN_RESOLUTION_PIN=1 for a reviewed change.",
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
