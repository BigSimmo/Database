import { expect, test, type Locator, type Page } from "playwright/test";

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test Supabase project ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search schema ready." },
  { id: "openai", label: "OpenAI API key available", status: "ready", detail: "Test OpenAI ready." },
  { id: "worker", label: "npm run worker running", status: "unknown", detail: "Worker not required for UI smoke." },
];

async function waitForReactEventHandler(locator: Locator, eventName: "onClick") {
  await expect
    .poll(
      async () =>
        locator.evaluate((element, reactEventName) => {
          const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
          if (!propsKey) return false;
          const props = (element as unknown as Record<string, Record<string, unknown>>)[propsKey];
          return typeof props?.[reactEventName] === "function";
        }, eventName),
      { timeout: 15_000 },
    )
    .toBe(true);
}

async function mockGuideShell(page: Page) {
  await page.route(/\/api\/local-project-id$/, async (route) => {
    await route.fulfill({
      json: {
        appName: "Clinical KB",
        projectId: "test-project",
        identityPath: "/api/local-project-id",
        localServer: {
          currentUrl: "http://localhost:4298",
          currentPort: 4298,
          projectPortStart: 4298,
          projectPortEnd: 53210,
          safeLocalOrigin: true,
          requestOrigin: null,
          requestReferer: null,
          unsafeLocalCaller: null,
        },
      },
    });
  });
  await page.route("**/api/setup-status**", async (route) => {
    await route.fulfill({ json: { demoMode: false, checks: readySetupChecks } });
  });
}

async function openGuide(page: Page) {
  const menuTrigger = page.getByRole("button", { name: "Open Clinical Guide menu" });
  await expect(menuTrigger).toBeVisible({ timeout: 15_000 });
  await waitForReactEventHandler(menuTrigger, "onClick");
  await menuTrigger.click();

  const menu = page.getByRole("dialog", { name: "Clinical Guide" });
  await expect(menu).toBeVisible();
  const settingsTrigger = menu.getByRole("button", { name: "Settings", exact: true });
  await waitForReactEventHandler(settingsTrigger, "onClick");
  await settingsTrigger.click();

  const settings = page.getByRole("dialog", { name: "Account & app" });
  await expect(settings).toBeVisible();
  const guideTrigger = settings.getByRole("button", { name: "Guide & help", exact: true });
  await waitForReactEventHandler(guideTrigger, "onClick");
  await guideTrigger.click();

  const dialog = page.getByRole("dialog", { name: "Clinical KB guide" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "How to verify an answer" })).toBeVisible();
  return dialog;
}

test.describe("Clinical KB Guide Centre chrome", () => {
  test("the bottom dock hides and leaves the tab order while the header stays pinned", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockGuideShell(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });

    const dialog = await openGuide(page);
    const scrollBody = dialog.locator(".polished-scroll");
    const footer = dialog.locator("[data-guide-mobile-footer]");
    const header = dialog.locator('[data-sheet-header="true"]');

    await expect(footer.locator("[data-guide-tour-action-row]")).toBeVisible();
    // No composer: the dock is the tour action and nothing else.
    await expect(footer.locator("[data-guide-universal-search]")).toHaveCount(0);
    await expect(footer.locator("input")).toHaveCount(0);

    await scrollBody.evaluate((element) => {
      element.scrollTop = 140;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(footer).toHaveAttribute("aria-hidden", "true");
    await expect(footer).toHaveAttribute("inert", "");
    // Pinned: "Close guide" and the view tabs must stay reachable while scrolled.
    await expect(header).toHaveAttribute("aria-hidden", "false");
    await expect(header).not.toHaveAttribute("inert");
    await expect(dialog.getByRole("button", { name: "Close guide" })).toBeVisible();

    /**
     * The invariant is that a HIDDEN dock is not keyboard-reachable, and the way
     * to test it is to try to focus it directly. The old tab sweep could not:
     * tabbing scrolls the container, and a scroll back up legitimately reveals
     * the dock. Measured 2026-08-19 at 390x820, the very first Tab already put
     * `scrollTop` at 0 and `aria-hidden` at "false", so the sweep asserted
     * against a dock that was correctly visible and focusable every time — it
     * failed CI while testing nothing. (It is also why pinning `tabIndex={-1}`
     * on the dock buttons could not fix it.)
     */
    const dockWhileHidden = await footer.evaluate((element) => {
      const button = element.querySelector("button");
      const before = document.activeElement;
      button?.focus({ preventScroll: true });
      return {
        hidden: element.getAttribute("aria-hidden") === "true",
        inert: element.hasAttribute("inert"),
        focusMovedIntoDock: element.contains(document.activeElement),
        focusMovedAtAll: document.activeElement !== before,
      };
    });
    // Guard the guard: a dock that was not hidden would make the rest vacuous.
    expect(dockWhileHidden.hidden).toBe(true);
    expect(dockWhileHidden.inert).toBe(true);
    expect(dockWhileHidden.focusMovedIntoDock).toBe(false);
    expect(dockWhileHidden.focusMovedAtAll).toBe(false);

    await scrollBody.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(footer).toHaveAttribute("aria-hidden", "false");
    await expect(footer).not.toHaveAttribute("inert");
    await expect(header).toHaveAttribute("aria-hidden", "false");
  });

  /**
   * RENDERED EFFECT, not class presence.
   *
   * `tests/guide-centre-design-contract.dom.test.tsx` asserts the footer carries
   * the dock classes, which is the *cause*. jsdom cannot evaluate a media query
   * or a cascade layer, so it would pass just as happily with the styles inert —
   * the failure mode `tests/helpers/style-contracts.ts` was written about.
   *
   * Two things here are only provable in a browser:
   *
   * 1. The band really paints as glass. `Sheet` always wraps its footer slot in
   *    `border-t border-[color:var(--border)] p-3`, so a transparent, borderless,
   *    flush-to-the-edge band means the unlayered dock rules actually beat those
   *    utilities at phone width.
   * 2. The tour action really renders as the single filled primary pill. The
   *    phone framing is `max-sm:` variants layered over `primaryControl`'s own
   *    `bg-`/`text-` utilities; tailwind-merge keeps BOTH (different variant
   *    keys), so which one wins is decided by generated stylesheet order.
   *    Nothing but a real browser at a real width can prove the retired
   *    translucent addon treatment did not come back.
   * 3. The scrim really resolves to the COMPACT height. `data-footer-variant`
   *    only redefines a custom property; jsdom would report the attribute
   *    present and the height unchanged.
   */
  test("the phone footer paints as a flush glass dock, not a Sheet footer band", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await mockGuideShell(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content").first()).toBeVisible({ timeout: 15_000 });

    const dialog = await openGuide(page);
    const band = dialog.locator(".answer-footer-search-dock");
    await expect(band).toBeVisible();

    const painted = await band.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const scrim = element.querySelector(".answer-footer-search-backdrop");
      const scrimStyle = scrim ? window.getComputedStyle(scrim) : null;
      return {
        background: style.backgroundColor,
        borderTopWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
        left: Math.round(rect.left),
        right: Math.round(window.innerWidth - rect.right),
        bottom: Math.round(window.innerHeight - rect.bottom),
        scrimDisplay: scrimStyle ? scrimStyle.display : null,
        scrimHeight: scrimStyle ? Math.round(Number.parseFloat(scrimStyle.height)) : 0,
      };
    });

    // Glass, not a band: fully transparent, no rule, no elevation.
    expect(painted.background).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(painted.borderTopWidth).toBe("0px");
    expect(painted.boxShadow === "none" || /rgba\(0, 0, 0, 0\)/.test(painted.boxShadow)).toBe(true);

    // Edge to edge, flush to the physical bottom — never a floating inset.
    expect(painted.left).toBe(0);
    expect(painted.right).toBe(0);
    expect(painted.bottom).toBe(0);

    // The scrim is what tints around the pill; without it the band is bare.
    expect(painted.scrimDisplay).toBe("block");
    expect(painted.scrimHeight).toBeGreaterThan(0);

    // The compact variant is `max(7rem, safe-area + 5.5rem)`; the default it
    // replaced is `max(10rem, safe-area + 8.5rem)`. At 390x820 with no inset that
    // is 112px against 160px, so the bound below cannot pass on the default.
    expect(painted.scrimHeight).toBeLessThan(160);
    expect(painted.scrimHeight).toBeGreaterThan(80);

    const actions = dialog.locator("[data-guide-tour-action-row] button");
    await expect(actions).toHaveCount(1);
    const pill = await actions.evaluate((element) => {
      const style = window.getComputedStyle(element);
      // Resolve `--command` through a probe rather than hard-coding a hex, so a
      // token change moves the expectation with it instead of failing the gate.
      const probe = document.createElement("div");
      probe.style.backgroundColor = "var(--command)";
      element.parentElement?.append(probe);
      const commandFill = window.getComputedStyle(probe).backgroundColor;
      probe.remove();
      return {
        background: style.backgroundColor,
        commandFill,
        borderRadius: Number.parseFloat(style.borderTopLeftRadius),
        minHeight: Number.parseFloat(style.minHeight),
      };
    });

    // The dock's single call to action: pill-radius, tap-floor, and a FILLED
    // `--command` background — an opaque colour, never the retired addon's
    // `color-mix(in srgb, var(--surface) 92%, transparent)` alpha.
    expect(pill.borderRadius).toBeGreaterThan(100);
    expect(pill.minHeight).toBeGreaterThanOrEqual(48);
    expect(pill.background).not.toMatch(/rgba\([^)]+,\s*0?\.\d/);
    expect(pill.background).toBe(pill.commandFill);
  });
});
