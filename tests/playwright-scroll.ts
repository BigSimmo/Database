import type { Locator, Page } from "playwright/test";

export type PrimaryScrollOwner = "main" | "document";

export type PrimaryScrollGeometry = {
  owner: PrimaryScrollOwner;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  maxScrollTop: number;
  viewportTop: number;
  viewportBottom: number;
};

/**
 * Phone dock clearance in CSS pixels for #main-content.
 * GlobalSearchShell applies the reserve on an inner pad (so it contributes to
 * scrollHeight); ClinicalDashboard still pads #main-content directly.
 */
export async function readMobileComposerReservePx(main: Locator): Promise<number> {
  return main.evaluate((node) => {
    const pad = node.querySelector<HTMLElement>('[data-testid="mobile-composer-reserve-pad"]');
    if (pad) return Number.parseFloat(window.getComputedStyle(pad).paddingBottom);
    return Number.parseFloat(window.getComputedStyle(node).paddingBottom);
  });
}

/**
 * Read the scroll owner that is active in the rendered layout.
 *
 * Browser-mode phones intentionally leave #main-content in normal flow so the
 * document owns vertical scrolling and Safari can minimize its browser chrome.
 * Standalone phones and wider layouts keep the bounded inner surface. Merely
 * finding #main-content is therefore insufficient: it is the owner only when
 * its computed overflow permits scrolling and its content actually overflows.
 */
export async function readPrimaryScrollGeometry(page: Page): Promise<PrimaryScrollGeometry> {
  return page.evaluate(() => {
    const main = document.getElementById("main-content");
    const mainOverflowY = main ? window.getComputedStyle(main).overflowY : "";
    const mainOwnsScroll =
      main !== null && ["auto", "scroll", "overlay"].includes(mainOverflowY) && main.scrollHeight > main.clientHeight;
    const documentScroller = document.scrollingElement ?? document.documentElement;
    const owner = mainOwnsScroll ? main : documentScroller;
    const ownerRect = mainOwnsScroll ? main.getBoundingClientRect() : null;

    return {
      owner: mainOwnsScroll ? "main" : "document",
      scrollTop: mainOwnsScroll ? main.scrollTop : window.scrollY,
      scrollHeight: owner.scrollHeight,
      clientHeight: mainOwnsScroll ? main.clientHeight : window.innerHeight,
      maxScrollTop: Math.max(0, owner.scrollHeight - (mainOwnsScroll ? main.clientHeight : window.innerHeight)),
      viewportTop: ownerRect?.top ?? 0,
      viewportBottom: ownerRect?.bottom ?? window.innerHeight,
    } satisfies PrimaryScrollGeometry;
  });
}

/** Add deterministic runway inside app content without assuming who scrolls it. */
export async function appendPrimaryScrollSpacer(
  page: Page,
  { heightPx, testId }: { heightPx: number; testId?: string },
) {
  await page.evaluate(
    ({ spacerHeight, spacerTestId }) => {
      const spacer = document.createElement("div");
      if (spacerTestId) spacer.dataset.testid = spacerTestId;
      spacer.style.height = `${spacerHeight}px`;
      (document.getElementById("main-content") ?? document.body).appendChild(spacer);
    },
    { spacerHeight: heightPx, spacerTestId: testId },
  );
}

/** Scroll whichever surface currently owns app scrolling, or its endpoint. */
export async function scrollPrimarySurface(page: Page, top: number | "end") {
  await page.evaluate(async (requestedTop) => {
    const main = document.getElementById("main-content");
    const mainOverflowY = main ? window.getComputedStyle(main).overflowY : "";
    const mainOwnsScroll =
      main !== null && ["auto", "scroll", "overlay"].includes(mainOverflowY) && main.scrollHeight > main.clientHeight;
    const documentScroller = document.scrollingElement ?? document.documentElement;
    const owner = mainOwnsScroll ? main : documentScroller;
    const clientHeight = mainOwnsScroll ? main.clientHeight : window.innerHeight;
    const scrollTop =
      requestedTop === "end" ? Math.max(0, owner.scrollHeight - clientHeight) : Math.max(0, requestedTop);

    if (mainOwnsScroll) {
      main.scrollTo({ top: scrollTop, behavior: "auto" });
      // WebKit doesn't reliably emit a native scroll event for programmatic scrollTo.
      main.dispatchEvent(new Event("scroll"));
    } else {
      window.scrollTo({ top: scrollTop, behavior: "auto" });
      window.dispatchEvent(new Event("scroll"));
    }

    // Give React's scroll handler and the browser's layout/paint pipeline a
    // frame each before the next scripted step. Firefox can otherwise coalesce
    // a tight sequence of programmatic scrolls into one event, which does not
    // model the deliberate directional movement these checks exercise.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    // React may schedule the state commit after the paint callbacks above in
    // Firefox. Yield one browser task so callers assert the committed UI state
    // rather than racing the scroll event's concurrent update.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }, top);
}
