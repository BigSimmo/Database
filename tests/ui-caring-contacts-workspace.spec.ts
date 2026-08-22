import { expect, test, type Page } from "playwright/test";

import { WORKSPACE_WIDTH_BREAKPOINTS, widthStateFor } from "../src/components/caring-contacts/workspace/width-state";

/**
 * The production Caring Contacts workspace shell, proved in a browser.
 *
 * This spec is what `docs/design-system/adoption-contract.json` cites for all
 * five proof categories of the `caring-contacts-workspace` surface. Every
 * declaration there points here, and nowhere else, because a proof pointer at a
 * suite that never visits this route is a red gate that has been silenced.
 *
 * Ruling 51 splits the workspace's browser proof in two. This file owns the
 * *shell* half — the four width states, the dock/rail exchange, dark, forced
 * colours and print. Task 19 extends this same file with the overlay half (all
 * 24 overlays deep-linked) and 400% zoom. A Task 19 implementer will therefore
 * find its Step 1 registration guard already green; that is expected.
 *
 * The width assertions compare against `widthStateFor()` itself rather than a
 * second copy of the frozen numbers, so a breakpoint edited in the shell's
 * Tailwind classes without editing the module — or the reverse — fails here.
 */

const WORKSPACE_ROUTE = "/caring-contacts";

/** 320/390/430 are the three compact review widths; the rest are the state boundaries. */
const REVIEW_WIDTHS = [320, 390, 430, 768, 1024, 1440] as const;

const VIEWPORT_HEIGHT = 900;

async function openWorkspace(page: Page, width: number) {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.goto(WORKSPACE_ROUTE, { waitUntil: "load" });
  // React streams the segment under `loading.tsx`'s Suspense boundary into a
  // hidden holder before moving it into place, so a production page sampled too
  // early carries a second, inert copy of the whole shell. Settle on exactly one
  // before measuring anything — and assert it, because a shell that genuinely
  // mounted twice would double every landmark on the page.
  await expect(page.getByTestId("caring-contacts-rail")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
}

/** Horizontal overflow of the document against the viewport, in CSS pixels. */
function documentOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/**
 * The width-state markers the shell displays one at a time. Reading the
 * *displayed* one is how the CSS media classes become checkable at all.
 */
function displayedWidthStates(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-workspace-width-state]")]
      // `getClientRects()` is empty for anything an ancestor has hidden, which a
      // bare `display` read on the element itself would miss entirely.
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => node.getAttribute("data-workspace-width-state")),
  );
}

/**
 * What the marker looks like once forced colours have had their way with it.
 *
 * Only the border is reported, because only the border turned out to be
 * falsifiable — see the test below.
 */
function markerBorder(page: Page) {
  return page.evaluate(() => {
    const marker = document.querySelector("[data-synthetic-marker]");
    if (!marker) throw new Error("the synthetic marker is missing");
    const style = getComputedStyle(marker);
    return { width: style.borderTopWidth, colour: style.borderTopColor };
  });
}

function shellColours(page: Page) {
  return page.evaluate(() => {
    const chrome = document.querySelector("[data-testid='caring-contacts-rail']");
    const heading = document.querySelector("h1");
    const marker = document.querySelector("[data-testid='caring-contacts-synthetic-marker']");
    if (!chrome || !heading || !marker) throw new Error("caring-contacts shell landmarks are missing");
    return {
      chrome: getComputedStyle(chrome).backgroundColor,
      ink: getComputedStyle(heading).color,
      marker: getComputedStyle(marker).color,
    };
  });
}

test.describe("caring-contacts workspace shell", () => {
  for (const width of REVIEW_WIDTHS) {
    test(`holds the frozen layout at ${width}px`, async ({ page }) => {
      await openWorkspace(page, width);

      // (1) nothing spills sideways — the failure that makes a phone screen unusable.
      expect(await documentOverflow(page), `horizontal document overflow at ${width}px`).toBeLessThanOrEqual(2);

      // (4) exactly one width state is displayed, and it is the one the frozen
      // module names. Two displayed markers means overlapping media classes.
      expect(await displayedWidthStates(page), `width state at ${width}px`).toEqual([widthStateFor(width)]);

      const rail = page.getByTestId("caring-contacts-rail");
      const dock = page.getByTestId("caring-contacts-phone-dock");

      // (2) below the rail boundary the phone dock owns navigation; at and above
      // it the rail does, and the dock is gone.
      if (width < WORKSPACE_WIDTH_BREAKPOINTS.rail) {
        await expect(dock).toBeVisible();
        await expect(rail).toBeHidden();

        // (3) the fixed dock must not cover the workspace's primary control.
        const dockBox = await dock.boundingBox();
        const primaryBox = await page.getByTestId("caring-contacts-primary-control").boundingBox();
        expect(dockBox, "phone dock has no box").not.toBeNull();
        expect(primaryBox, "primary control has no box").not.toBeNull();
        expect(
          primaryBox!.y + primaryBox!.height,
          `primary control is under the dock at ${width}px`,
        ).toBeLessThanOrEqual(dockBox!.y);

        // …nor the last control in the flow, which is where a missing bottom
        // reserve actually shows up. The primary control alone sits near the top
        // of the page and would pass a broken reserve untouched.
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const lastControl = page.getByRole("button", { name: "Coverage" });
        const lastBox = await lastControl.boundingBox();
        const dockBoxAfterScroll = await dock.boundingBox();
        expect(lastBox, "last More destination has no box").not.toBeNull();
        expect(
          lastBox!.y + lastBox!.height,
          `the last destination is under the dock at ${width}px — the bottom reserve is too small`,
        ).toBeLessThanOrEqual(dockBoxAfterScroll!.y);
      } else {
        await expect(rail).toBeVisible();
        await expect(dock).toBeHidden();
      }
    });
  }

  test("re-resolves its surfaces and ink in dark rather than leaking a light value", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openWorkspace(page, 1024);
    const light = await shellColours(page);

    await page.emulateMedia({ colorScheme: "dark" });
    await openWorkspace(page, 1024);
    const dark = await shellColours(page);

    // A hardcoded colour anywhere in the shell would leave one of these identical
    // across the two schemes.
    expect(dark.chrome, "rail surface did not change in dark").not.toBe(light.chrome);
    expect(dark.ink, "heading ink did not change in dark").not.toBe(light.ink);
    expect(dark.marker, "synthetic marker ink did not change in dark").not.toBe(light.marker);
    for (const value of Object.values(dark)) {
      expect(value, "a dark colour resolved to nothing").not.toBe("rgba(0, 0, 0, 0)");
    }
    await expect(page.getByTestId("caring-contacts-synthetic-marker")).toBeVisible();
  });

  test("keeps the synthetic marker delimited once forced colours drop its tint", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "forced-colors emulation is Chromium-only");

    await page.emulateMedia({ forcedColors: "active" });
    await openWorkspace(page, 390);

    await expect(page.getByTestId("caring-contacts-synthetic-marker")).toBeVisible();

    // Forced colours drop an author background, so the badge's tint goes and the
    // border is the only thing left delimiting the one safeguard that says these
    // patients are invented.
    //
    // This is the only assertion here that was shown to be able to fail:
    // removing the marker's `border` class reddens it. Three other candidates
    // were tried and discarded because nothing could make them fail on a v2
    // surface — the marker's ink and surface are forced to system colours by the
    // user agent whatever the CSS says, and `--clinical-accent-soft` already maps
    // to `Canvas`, so "the tint was dropped" and "the tint was kept" look
    // identical. Details in the task report; decoration is not left here to look
    // thorough.
    const border = await markerBorder(page);
    expect(Number.parseFloat(border.width), "the marker has no border under forced colours").toBeGreaterThan(0);
    expect(border.colour, "the marker border is transparent under forced colours").not.toBe("rgba(0, 0, 0, 0)");

    await expect(page.getByTestId("caring-contacts-phone-dock")).toBeVisible();
    expect(await documentOverflow(page), "horizontal overflow under forced colours").toBeLessThanOrEqual(2);
  });

  test("prints with the synthetic marker still on the page", async ({ page }) => {
    await openWorkspace(page, 1024);
    await page.emulateMedia({ media: "print" });

    // A printed page of invented patients that has lost its marker is the exact
    // artefact this workspace must never produce.
    await expect(page.getByTestId("caring-contacts-synthetic-marker")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    expect(await documentOverflow(page), "horizontal overflow in print").toBeLessThanOrEqual(2);
  });
});
