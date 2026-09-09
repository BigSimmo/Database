import { devices, expect, test, type Page } from "playwright/test";

/**
 * Covers the configuration that three consecutive "fixes" never reproduced: a
 * phone with OS Reduce Motion switched ON.
 *
 * The answer-progress panel was reported dead on a physical iPhone in both Safari
 * and the installed PWA. The cause was not a WebKit repaint bug — it was this
 * app's own reduced-motion CSS, which stopped every animation and additionally set
 * the then-current ECG trace to `opacity: 0`. Every existing gate missed it because
 * playwright.config.ts applies `reducedMotion: "reduce"` suite-wide and the one
 * spec asserting the animation opts out to "no-preference" first, so the default
 * user configuration was never exercised.
 *
 * Two contracts are pinned here, and they outlived the component that prompted
 * them: the ECG trace has since been replaced by a breathing dot on the quiet
 * progress line, so these tests now target `.answer-progress-dot`. The rules are
 * unchanged, and the dot was chosen partly because it makes the first one easy to
 * hold — a stopped dot is a bullet, where a stopped spinner is a broken circle.
 *   1. Reduce Motion suppresses motion but must never remove the indicator.
 *   2. The in-app Motion preference ("full") can opt back in over the OS request.
 *
 * Mobile-WebKit emulation is per-test rather than a whole Playwright project to
 * keep CI cost down. Note this is still Playwright's WebKit, not the iOS engine:
 * it does not close physical-device acceptance.
 */

const MOTION_STORAGE_KEY = "clinical-kb-preferences";

async function stubAnswerStream(page: Page) {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (new URL(rawUrl, window.location.href).pathname !== "/api/answer/stream") return originalFetch(input, init);

      const encoder = new TextEncoder();
      const frames = [
        { delay: 0, stage: "scoping", message: "Preparing scope." },
        { delay: 25, stage: "retrieving", message: "Searching documents." },
        { delay: 50, stage: "ranking", message: "Selecting evidence." },
      ];

      return new Response(
        new ReadableStream({
          start(controller) {
            const timers = frames.map((frame) =>
              window.setTimeout(() => {
                controller.enqueue(
                  encoder.encode(
                    `event: progress\ndata: ${JSON.stringify({ stage: frame.stage, message: frame.message })}\n\n`,
                  ),
                );
              }, frame.delay),
            );
            init?.signal?.addEventListener(
              "abort",
              () => {
                for (const timer of timers) window.clearTimeout(timer);
                controller.error(new DOMException("The operation was aborted.", "AbortError"));
              },
              { once: true },
            );
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } },
      );
    };
  });
}

async function seedMotionPreference(page: Page, motion: "system" | "reduced" | "full") {
  await page.addInitScript(
    ({ key, value }) => {
      // Written before first paint, the same window the layout.tsx bootstrap reads.
      window.localStorage.setItem(key, JSON.stringify({ motion: value }));
    },
    { key: MOTION_STORAGE_KEY, value: motion },
  );
}

/** The install/offline card overlays the composer and swallows the submit click. */
async function dismissBlockingPwaNotice(page: Page) {
  const dismiss = page.getByRole("button", { name: /Dismiss (?:offline notice|update notice|install)/ }).first();
  const appeared = await dismiss
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) await dismiss.click();
  await expect(page.locator(".pwa-notice-stack li")).toHaveCount(0, { timeout: 10_000 });
}

async function startAnswer(page: Page) {
  await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });
  await dismissBlockingPwaNotice(page);
  const input = page.locator('[aria-label^="Search indexed guidelines by question or keyword"]:visible');
  const submit = page.locator('[aria-label="Generate source-backed answer"]:visible');
  await expect(async () => {
    await expect(input).toHaveCount(1, { timeout: 30_000 });
    // Wait for React to attach handlers before typing; a pre-hydration fill is
    // silently discarded and the submit never enables.
    const form = input.locator("xpath=ancestor::form[1]");
    await expect
      .poll(() =>
        form.evaluate((element) => {
          const key = Object.keys(element).find((candidate) => candidate.startsWith("__reactProps$"));
          if (!key) return false;
          const props = (element as unknown as Record<string, Record<string, unknown>>)[key];
          return typeof props?.onSubmit === "function";
        }),
      )
      .toBe(true);
    await input.fill("Lithium dosing");
    await expect(input).toHaveValue("Lithium dosing");
    await expect(submit).toBeEnabled();
  }).toPass({ timeout: 30_000 });
  await submit.click();
  return page.getByTestId("answer-progress");
}

// The device fields are picked explicitly rather than spread: the descriptor's
// `defaultBrowserType` would pin this file to WebKit, and the point is to run the
// phone viewport/UA/DPR under whichever project is executing (Chromium on PRs,
// WebKit in the release matrix). This Playwright version exposes reducedMotion
// only through contextOptions, matching how playwright.config.ts sets it.
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 14"];
test.use({
  viewport,
  userAgent,
  deviceScaleFactor,
  isMobile,
  hasTouch,
  contextOptions: { reducedMotion: "reduce" },
});

test.describe("phone motion behaviour with OS Reduce Motion on", () => {
  const dotOf = (progress: ReturnType<Page["getByTestId"]>) => progress.locator('[data-slot="answer-progress-dot"]');

  /** Reads the computed state that decides whether an indicator is still there. */
  const indicatorState = (dot: ReturnType<Page["locator"]>) =>
    dot.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        animationName: style.animationName,
        opacity: Number.parseFloat(style.opacity),
        display: style.display,
        visibility: style.visibility,
      };
    });

  /** Proves the breath actually moves, rather than merely being declared. */
  const breathTravel = (dot: ReturnType<Page["locator"]>) =>
    dot.evaluate(async (node) => {
      const animation = node.getAnimations()[0];
      animation.pause();
      animation.currentTime = 0;
      await new Promise(requestAnimationFrame);
      const resting = getComputedStyle(node).opacity;
      animation.currentTime = 1_200;
      await new Promise(requestAnimationFrame);
      return { resting, mid: getComputedStyle(node).opacity };
    });

  test("suppresses motion without hiding the progress indicator", async ({ page }) => {
    await stubAnswerStream(page);
    await seedMotionPreference(page, "system");

    const progress = await startAnswer(page);
    await expect(progress).toBeVisible();

    const dot = dotOf(progress);
    await expect(dot).toBeVisible();

    const state = await indicatorState(dot);
    expect(state.animationName).toBe("none");
    // The whole point of a dot: its resting frame is the complete, correct mark.
    expect(state.opacity).toBe(1);
    expect(state.display).not.toBe("none");
    expect(state.visibility).not.toBe("hidden");

    // A stopped indicator still has to paint real ink, not an empty box.
    const box = await dot.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);

    // And the line it marks must still say what is happening.
    await expect(progress.getByTestId("answer-progress-line")).toContainText(/\w/);
  });

  test("motion:full opts back in over the OS setting", async ({ page }) => {
    await stubAnswerStream(page);
    await seedMotionPreference(page, "full");

    const progress = await startAnswer(page);
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");

    const dot = dotOf(progress);
    await expect(dot).toBeVisible();
    expect(await dot.evaluate((node) => getComputedStyle(node).animationName)).toBe("answer-progress-breath");

    const travel = await breathTravel(dot);
    expect(travel.mid).not.toBe(travel.resting);
  });

  test("motion:reduced still wins when the OS has no preference", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await stubAnswerStream(page);
    await seedMotionPreference(page, "reduced");

    const progress = await startAnswer(page);
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");

    const dot = dotOf(progress);
    await expect(dot).toBeVisible();
    const state = await indicatorState(dot);
    expect(state.animationName).toBe("none");
    expect(state.opacity).toBe(1);
  });

  test("runs active animations under OS default no-preference motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await stubAnswerStream(page);
    await seedMotionPreference(page, "system");

    const progress = await startAnswer(page);
    await expect(progress).toBeVisible();

    const dot = dotOf(progress);
    await expect(dot).toBeVisible();
    expect(await dot.evaluate((node) => getComputedStyle(node).animationName)).toBe("answer-progress-breath");

    const travel = await breathTravel(dot);
    expect(travel.mid).not.toBe(travel.resting);
  });

  test("contract: motion-sensitive components explicitly declare both reduce and no-preference behaviors", async ({
    page,
  }) => {
    await stubAnswerStream(page);

    // 1. Reduced motion: animation suppressed, indicator remains visible and legible
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedMotionPreference(page, "system");
    let progress = await startAnswer(page);
    await expect(progress).toBeVisible();
    let dot = dotOf(progress);
    await expect(dot).toBeVisible();
    const stateReduce = await indicatorState(dot);
    expect(stateReduce.animationName).toBe("none");
    expect(stateReduce.opacity).toBe(1);
    expect(stateReduce.display).not.toBe("none");
    expect(stateReduce.visibility).not.toBe("hidden");

    // 2. Full motion: animation active and actually changing
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await seedMotionPreference(page, "system");
    await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });
    await dismissBlockingPwaNotice(page);
    progress = await startAnswer(page);
    await expect(progress).toBeVisible();
    dot = dotOf(progress);
    await expect(dot).toBeVisible();
    const stateFull = await indicatorState(dot);
    expect(stateFull.animationName).toBe("answer-progress-breath");
    expect(stateFull.opacity).toBeGreaterThan(0);
  });
});
