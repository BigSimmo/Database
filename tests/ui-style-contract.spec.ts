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
      if (contract.viewport) await page.setViewportSize(contract.viewport);
      if (contract.bootstrap?.sessionStorage?.length) {
        await page.addInitScript(
          ({ sessionStorage }) => {
            for (const item of sessionStorage ?? []) {
              window.sessionStorage.setItem(item.key, JSON.stringify(item.value));
            }
          },
          { sessionStorage: contract.bootstrap?.sessionStorage },
        );
      }

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
      probe.style.height = tapToken || "3rem";
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

    // 48px since PR 5b: the knob is the design system's single tap floor
    // (SPEC §4.10) and no production target is ever reduced below it.
    expect(audit.tapFloor, "--spacing-tap must resolve to a real pixel floor").toBeGreaterThanOrEqual(48);
    expect(audit.measuredCount, "expected at least one rendered tap-sized control").toBeGreaterThan(0);
    expect(audit.inlineCarriers, "tap-sized min-height is inert on inline boxes").toEqual([]);
    expect(audit.undersized, "controls rendered below their declared min-height").toEqual([]);
  });

  /**
   * Gate 2 / ledger #293 finding 2 — the rendered-interactive enumeration.
   *
   * The test above only ever measures elements whose COMPUTED `min-height` is
   * already at or above the tap floor (`declared < tapFloor - 0.5` is
   * skipped), so a floor overridden down to 0 is invisible to it by
   * construction. A broader enumeration was written in session
   * (2026-08-09) to close that gap, found a genuine defect class in every
   * run, and was then reverted rather than landed: on
   * `/services?q=CMHT&run=1` six runs against one production build returned
   * 6, 5, 4, 3, 3 and 9 distinct sub-floor shapes, largely disjoint —
   * `waitForLoadState("networkidle")` plus shape deduplication did not
   * settle it, because that route drives the live search+ranking pipeline
   * and the audit raced its async render. Since this spec matches
   * `productionSpecPattern` (`playwright.config.ts`) and ships in the
   * required Production UI job, an intermittent version would have blocked
   * every merge in the repo — worse than the gap it closes. A later pass
   * (2026-08-12) also refuted the finding this gap was chasing on THAT
   * route: `services-navigator-page.tsx`'s zeroed carriers are an
   * intentional `sm:min-h-0` desktop release of the phone-only floor, not a
   * live defect (see the finding-1 correction in
   * `docs/outstanding-issues.md` #293) — so re-deriving it there would have
   * reported the wrong thing even if it were deterministic.
   *
   * This version closes finding 2 two ways at once, per #293's own revised
   * "Next": (1) it enumerates on `/forms`'s no-query home, which renders its
   * cards from a fixed array once its registry *summary* settles rather than
   * from ranked search results whose shape can legitimately vary run to run
   * — never re-land this enumeration on a live-search route; and (2) it
   * polls the enumeration itself until three consecutive reads agree before
   * trusting it, rather than a fixed wait or `networkidle` (which
   * `ui-specifiers.spec.ts` already found unusable here: persistent
   * background fetches keep it open past its timeout on this app's routes).
   * The explicit `.sort()` below is a second, independent determinism
   * safeguard: the shape list's order must never depend on `querySelectorAll`
   * traversal order or `classList` iteration order, only on content.
   *
   * It runs at a PHONE viewport deliberately: `min-h-tap`'s `sm:` release is
   * unreleased below that breakpoint, so a sub-floor carrier there is a
   * genuine violation rather than the intentional desktop-width finding-1
   * shape, and `#293`'s own "Next" calls a phone layout "the simpler, more
   * deterministic surface" for exactly this reason.
   */
  test("min-h-tap carriers render at or above the tap floor at a phone viewport (Gate 2, #293 finding 2)", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });

    const enumerateTapCarriers = () =>
      page.evaluate(() => {
        const describe = (element: Element) => {
          const rect = element.getBoundingClientRect();
          // Sorted class list: an unsorted `element.className` string would
          // make the shape depend on source/compiler class order rather than
          // on which classes are actually present.
          const classes = Array.from(element.classList).sort().join(".");
          return `${element.tagName.toLowerCase()}.${classes}@${Math.round(rect.height)}`;
        };
        return Array.from(document.querySelectorAll("*"))
          .filter((element) => element.classList.contains("min-h-tap"))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
          .map(describe)
          .sort(); // Explicit sort: output must never depend on DOM traversal order.
      });

    /**
     * Read the enumeration repeatedly until it stops changing. This is the
     * mechanism that survives whatever async settling remains on the route
     * (registry summary fetch, hydration, layout effects) instead of
     * guessing a fixed delay or trusting `networkidle`.
     */
    const waitForStableEnumeration = async (): Promise<string[]> => {
      let previousKey: string | null = null;
      let stableStreak = 0;
      let shapes: string[] = [];
      for (let attempt = 0; attempt < 20; attempt += 1) {
        shapes = await enumerateTapCarriers();
        const key = JSON.stringify(shapes);
        if (key === previousKey) {
          stableStreak += 1;
          if (stableStreak >= 3) return shapes;
        } else {
          stableStreak = 0;
        }
        previousKey = key;
        await page.waitForTimeout(150);
      }
      throw new Error(`tap-carrier enumeration did not stabilise after 20 polls; last read: ${JSON.stringify(shapes)}`);
    };

    // Forms results, not `/forms`: that path is a redirect onto the shared home
    // since consolidation, and the shared home carries no `min-h-tap` element at
    // all — the audit would enumerate an empty set and pass vacuously. The result
    // rows are where this repo's tap carriers actually live.
    const runAudit = async (): Promise<string[]> => {
      await page.goto("/forms/search?q=transport&run=1", { waitUntil: "domcontentloaded" });
      await page.getByTestId("form-search-mobile-results").waitFor({ state: "visible", timeout: 20_000 });
      return waitForStableEnumeration();
    };

    // Three independent full navigations — the same shape of reproduction as
    // #293's six-run evidence — must agree exactly. This is the assertion
    // that would have caught the original nondeterminism: it does not just
    // check the audit's *content*, it checks that repeating the whole
    // navigate-and-enumerate cycle is stable.
    const first = await runAudit();
    const second = await runAudit();
    const third = await runAudit();

    expect(second, "repeat navigation produced a different min-h-tap carrier enumeration").toEqual(first);
    expect(third, "repeat navigation produced a different min-h-tap carrier enumeration").toEqual(first);
    expect(first.length, "expected at least one rendered min-h-tap carrier on this route").toBeGreaterThan(0);

    const tapFloor = await page.evaluate(() => {
      const probe = document.createElement("div");
      // Keep the measurement out of the page's flex/grid flow so it reflects
      // only the token value, not ambient layout sizing.
      Object.assign(probe.style, {
        position: "fixed",
        left: "-9999px",
        top: "-9999px",
        display: "block",
        boxSizing: "border-box",
        width: "1px",
        minHeight: "0",
        margin: "0",
        padding: "0",
        border: "0",
      });
      probe.style.height =
        getComputedStyle(document.documentElement).getPropertyValue("--spacing-tap").trim() || "3rem";
      document.body.appendChild(probe);
      try {
        return probe.getBoundingClientRect().height;
      } finally {
        probe.remove();
      }
    });
    expect(tapFloor, "expected --spacing-tap to resolve to the documented 48px phone tap floor").toBeGreaterThanOrEqual(
      48,
    );

    const undersized = first.filter((shape) => {
      const height = Number(shape.slice(shape.lastIndexOf("@") + 1));
      // An unmeasurable shape is a failure, not a pass.
      return !Number.isFinite(height) || height < tapFloor - 0.5;
    });

    // At this viewport `min-h-tap`'s `sm:` release (finding 1) is not in
    // force, so every carrier is expected to render at or above the floor.
    expect(undersized, "min-h-tap carriers rendered below the tap floor at phone width").toEqual([]);
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
  "--danger-solid-hover": "Mark",
  "--danger-solid-active": "Mark",
  "--danger-solid-contrast": "MarkText",
  "--focus": "Highlight",
  "--disabled": "GrayText",
  "--success": "CanvasText",
  "--warning": "CanvasText",
  "--e2": "none",
  "--e4": "none",
  "--glow-primary": "none",
  "--glow-soft": "none",
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
