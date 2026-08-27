import { expect, test, type Locator, type Page } from "playwright/test";
import { demoAnswer, demoDocuments } from "../src/lib/demo-data";

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test project ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search ready." },
  { id: "openai", label: "Answer provider", status: "ready", detail: "Mock stream ready." },
];

async function waitForReactEventHandler(locator: Locator, eventName: "onChange" | "onSubmit") {
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

async function fillHydratedAnswerQuestion(page: Page, value: string) {
  const input = page.locator('[aria-label^="Search indexed guidelines by question or keyword"]:visible');
  const submit = page.locator('[aria-label="Generate source-backed answer"]:visible');

  await expect(async () => {
    await expect(input).toHaveCount(1, { timeout: 30_000 });
    await expect(submit).toHaveCount(1, { timeout: 30_000 });
    const form = input.locator("xpath=ancestor::form[1]");
    await waitForReactEventHandler(input, "onChange");
    await waitForReactEventHandler(form, "onSubmit");
    await input.fill(value);
    await expect(input).toHaveValue(value);
    await expect(submit).toBeEnabled();
  }).toPass({ timeout: 30_000 });

  return submit;
}

async function dismissBlockingPwaNotice(page: Page) {
  const dismiss = page.getByRole("button", { name: /Dismiss (?:offline notice|update notice|install)/ }).first();
  const noticeAppeared = await dismiss
    .waitFor({ state: "visible", timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
  if (noticeAppeared) await dismiss.click();
}

async function mockDashboardApis(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    ) {
      await route.abort("blockedbyclient");
      return;
    }
    if (!url.pathname.startsWith("/api/")) {
      await route.fallback();
      return;
    }
    if (url.pathname === "/api/local-project-id") {
      await route.fulfill({
        json: {
          appName: "Clinical KB",
          projectId: "test-project",
          identityPath: "/api/local-project-id",
          localServer: { safeLocalOrigin: true },
        },
      });
      return;
    }
    if (url.pathname === "/api/setup-status") {
      await route.fulfill({ json: { demoMode: true, checks: readySetupChecks } });
      return;
    }
    if (url.pathname === "/api/documents") {
      await route.fulfill({
        json: {
          documents: demoDocuments,
          demoMode: true,
          pagination: {
            limit: 150,
            offset: 0,
            total: demoDocuments.length,
            nextOffset: demoDocuments.length,
            hasMore: false,
          },
        },
      });
      return;
    }
    if (url.pathname === "/api/ingestion/jobs") {
      await route.fulfill({ json: { jobs: [], demoMode: true } });
      return;
    }
    if (url.pathname === "/api/ingestion/batches") {
      await route.fulfill({ json: { batches: [], demoMode: true } });
      return;
    }
    if (url.pathname === "/api/ingestion/quality") {
      await route.fulfill({ json: { items: [], demoMode: true } });
      return;
    }
    await route.fulfill({ json: { demoMode: true } });
  });
}

async function installTimedAnswerStream(page: Page) {
  const finalAnswer = { ...demoAnswer("Lithium dosing"), demoMode: true };
  await page.addInitScript(
    ({ answer }) => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const rawUrl = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        const pathname = new URL(rawUrl, window.location.href).pathname;
        if (pathname !== "/api/answer/stream") return originalFetch(input, init);

        const encoder = new TextEncoder();
        const events: Array<{ delay: number; event: string; data: unknown }> = [
          { delay: 0, event: "progress", data: { stage: "scoping", message: "Preparing scope." } },
          { delay: 250, event: "progress", data: { stage: "retrieving", message: "Searching documents." } },
          {
            delay: 600,
            event: "progress",
            data: { stage: "retrieved", message: "Retrieved candidates.", resultCount: 12 },
          },
          {
            delay: 900,
            event: "progress",
            data: {
              stage: "ranking",
              message: "private-model-marker private-route-marker",
              selectedContextCount: 4,
              australianSourceCount: 4,
              waSourceCount: 4,
              usedSupplementaryFallback: true,
            },
          },
          { delay: 1_600, event: "progress", data: { stage: "generating", message: "private-draft-marker" } },
          { delay: 2_000, event: "token", data: { delta: "Provisional lithium draft" } },
          // Keep the provisional state observable for more than one browser
          // assertion polling interval. Firefox/WebKit can spend long enough
          // painting the progress stepper to miss a sub-second token window.
          { delay: 3_400, event: "revising", data: { reason: "private-provider-reason-marker" } },
          { delay: 3_450, event: "progress", data: { stage: "fallback", message: "private-fallback-marker" } },
          { delay: 4_000, event: "progress", data: { stage: "verifying", message: "private-check-marker" } },
          {
            delay: 4_600,
            event: "progress",
            data: { stage: "complete", message: "private-ready-marker", elapsedMs: 3_700 },
          },
          { delay: 4_800, event: "final", data: answer },
        ];

        return new Response(
          new ReadableStream({
            start(controller) {
              for (const item of events) {
                window.setTimeout(() => {
                  controller.enqueue(encoder.encode(`event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`));
                  if (item.event === "final") controller.close();
                }, item.delay);
              }
            },
          }),
          { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } },
        );
      };
    },
    { answer: finalAnswer },
  );
}

async function installHoldingAnswerStream(page: Page) {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      const pathname = new URL(rawUrl, window.location.href).pathname;
      if (pathname !== "/api/answer/stream") return originalFetch(input, init);

      const encoder = new TextEncoder();
      const events = [
        { delay: 0, stage: "scoping", message: "Preparing scope." },
        { delay: 25, stage: "retrieving", message: "Searching documents." },
        { delay: 50, stage: "ranking", message: "Selecting evidence." },
        { delay: 75, stage: "generating", message: "Drafting answer." },
      ];

      return new Response(
        new ReadableStream({
          start(controller) {
            const timers = events.map((event) =>
              window.setTimeout(() => {
                controller.enqueue(
                  encoder.encode(
                    `event: progress\ndata: ${JSON.stringify({ stage: event.stage, message: event.message })}\n\n`,
                  ),
                );
              }, event.delay),
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

async function installSuccessfulThenInvalidAnswerStreams(page: Page) {
  const firstAnswer = { ...demoAnswer("Lithium dosing"), demoMode: true };
  await page.addInitScript(
    ({ answer }) => {
      const originalFetch = window.fetch.bind(window);
      let answerRequestCount = 0;
      window.fetch = async (input, init) => {
        const rawUrl = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        const pathname = new URL(rawUrl, window.location.href).pathname;
        if (pathname !== "/api/answer/stream") return originalFetch(input, init);

        answerRequestCount += 1;
        const encoder = new TextEncoder();
        const events =
          answerRequestCount === 1
            ? [
                { delay: 0, event: "progress", data: { stage: "scoping", message: "Preparing scope." } },
                {
                  delay: 40,
                  event: "progress",
                  data: { stage: "complete", message: "Answer ready.", elapsedMs: 40 },
                },
                { delay: 80, event: "final", data: answer },
              ]
            : [
                { delay: 0, event: "progress", data: { stage: "retrieving", message: "Searching." } },
                {
                  delay: 40,
                  event: "progress",
                  data: { stage: "complete", message: "Answer ready.", elapsedMs: 40 },
                },
                { delay: 80, event: "final", data: { answer: 42 } },
              ];

        return new Response(
          new ReadableStream({
            start(controller) {
              for (const item of events) {
                window.setTimeout(() => {
                  controller.enqueue(encoder.encode(`event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`));
                  if (item.event === "final") controller.close();
                }, item.delay);
              }
            },
          }),
          { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } },
        );
      };
    },
    { answer: firstAnswer },
  );
}

async function installSuccessfulThenHoldingAnswerStreams(page: Page) {
  const firstAnswer = { ...demoAnswer("Lithium dosing"), demoMode: true };
  await page.addInitScript(
    ({ answer }) => {
      const originalFetch = window.fetch.bind(window);
      let answerRequestCount = 0;
      window.fetch = async (input, init) => {
        const rawUrl = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        const pathname = new URL(rawUrl, window.location.href).pathname;
        if (pathname !== "/api/answer/stream") return originalFetch(input, init);

        answerRequestCount += 1;
        const encoder = new TextEncoder();
        if (answerRequestCount === 1) {
          const events = [
            { delay: 0, event: "progress", data: { stage: "scoping", message: "Preparing scope." } },
            {
              delay: 40,
              event: "progress",
              data: { stage: "complete", message: "Answer ready.", elapsedMs: 40 },
            },
            { delay: 80, event: "final", data: answer },
          ];

          return new Response(
            new ReadableStream({
              start(controller) {
                for (const item of events) {
                  window.setTimeout(() => {
                    controller.enqueue(encoder.encode(`event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`));
                    if (item.event === "final") controller.close();
                  }, item.delay);
                }
              },
            }),
            { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } },
          );
        }

        const events = [
          { delay: 0, stage: "scoping", message: "Preparing follow-up scope." },
          { delay: 25, stage: "retrieving", message: "Searching follow-up sources." },
          { delay: 50, stage: "ranking", message: "Selecting follow-up evidence." },
          { delay: 75, stage: "generating", message: "Drafting follow-up answer." },
        ];

        return new Response(
          new ReadableStream({
            start(controller) {
              const timers = events.map((event) =>
                window.setTimeout(() => {
                  controller.enqueue(
                    encoder.encode(
                      `event: progress\ndata: ${JSON.stringify({ stage: event.stage, message: event.message })}\n\n`,
                    ),
                  );
                }, event.delay),
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
    },
    { answer: firstAnswer },
  );
}

test("answer progress remains user-safe through fallback and discloses the unusual route", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await mockDashboardApis(page);
  await installTimedAnswerStream(page);
  await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });

  const submit = await fillHydratedAnswerQuestion(page, "Lithium dosing");
  await submit.click();

  const progress = page.getByTestId("answer-progress");
  const line = progress.getByTestId("answer-progress-line");
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute("aria-busy", "true");
  // The line is the live region, because it is the element that persists while
  // its text is replaced.
  await expect(line).toHaveAttribute("aria-live", "polite");
  await expect(progress.locator('[data-slot="answer-progress-dot"]')).toBeVisible();

  // The retired panel narrated five orchestrator stages the reader is not
  // operating. None of that vocabulary may come back.
  for (const retired of [
    "Prepare scope",
    "Search sources",
    "Select evidence",
    "Draft answer",
    "Check answer",
    "Processing details",
  ]) {
    await expect(progress.getByText(retired, { exact: true })).toHaveCount(0);
  }
  await expect(progress.getByLabel("Answer generation stages")).toHaveCount(0);

  const stop = progress.getByRole("button", { name: "Stop generating answer" });
  await expect(stop).toBeVisible();
  expect((await stop.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);

  // Retrieval counts passages; selection counts sources. The two nouns must not
  // be interchangeable — see tests/answer-progress.test.ts for the rule.
  await expect(line).toContainText("12 passages found", { timeout: 3_000 });
  await expect(line).toContainText("Prioritising 4 Australian sources, 4 from WA", { timeout: 3_000 });
  await expect(line).toContainText("Writing the answer", { timeout: 4_000 });

  // The wait is where the reader learns the model was not used, rather than
  // meeting a source-only answer that then has to defend itself.
  await expect(line).toContainText("Assembling the answer from the sources directly", { timeout: 5_000 });

  // Rolling deployments may still route a new client to an older server that
  // emits provisional token/revising frames. The client must ignore both so
  // unvalidated clinical prose never reaches the page before the final event.
  await expect(page.getByTestId("answer-streaming")).toHaveCount(0);
  await expect(page.getByTestId("answer-streaming-revising")).toHaveCount(0);
  await expect(page.getByText("Provisional lithium draft")).toHaveCount(0);

  await expect(progress).toHaveAttribute("data-progress-state", "complete", { timeout: 6_000 });
  await expect(line).toContainText("Answer ready in 3s");
  await expect(page.getByTestId("stop-answer")).toHaveCount(0);

  // This run went through `fallback`, so the build disclosure is offered. On an
  // ordinary run it is not — pinned in the follow-up test below.
  const disclosure = progress.getByText("How this answer was built", { exact: true });
  await expect(disclosure).toBeVisible();
  await disclosure.click();
  await expect(progress).toContainText("Assembling the answer from the sources directly");

  await expect(page.getByText(/In the synthetic lithium document/i)).toBeVisible({ timeout: 8_000 });
  await expect(page.locator("body")).not.toContainText(
    /private-(?:model|route|provider-reason|fallback|draft|check|ready)-marker/i,
  );
});

test("follow-up answer generation stays one line above the previous answer", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mockDashboardApis(page);
  await installSuccessfulThenHoldingAnswerStreams(page);
  await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });
  await dismissBlockingPwaNotice(page);

  const submit = await fillHydratedAnswerQuestion(page, "Lithium dosing");
  await submit.click();

  const previousAnswer = page.getByText(/In the synthetic lithium document/i);
  await expect(previousAnswer).toBeVisible({ timeout: 8_000 });

  const progress = page.getByTestId("answer-progress");
  // The first answer took the ordinary route, so nothing is disclosed about it.
  await expect(progress.getByText("How this answer was built", { exact: true })).toHaveCount(0);

  const followUpSubmit = await fillHydratedAnswerQuestion(page, "What monitoring is needed?");
  await followUpSubmit.click();

  await expect(progress.getByTestId("answer-progress-line")).toContainText("Writing the answer");
  await expect(previousAnswer).toBeVisible();
  await expect(progress.getByLabel("Answer generation stages")).toHaveCount(0);

  const dot = progress.locator('[data-slot="answer-progress-dot"]');
  expect(
    await dot.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        name: style.animationName,
        duration: style.animationDuration,
        iterationCount: style.animationIterationCount,
      };
    }),
  ).toEqual({ name: "answer-progress-breath", duration: "2.4s", iterationCount: "infinite" });

  const stop = progress.getByRole("button", { name: "Stop generating answer" });
  expect((await stop.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);

  // The wait must not introduce a horizontal scrollbar at any supported width,
  // and it must stay inside its own column. The retired panel was ~210px tall;
  // the line is a fraction of that, which is the point — assert it stays small
  // so a future addition cannot quietly grow a panel back.
  for (const width of [320, 390, 639, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    const geometry = await progress.evaluate((section) => {
      const sectionRect = section.getBoundingClientRect();
      const lineRect = section
        .querySelector<HTMLElement>('[data-testid="answer-progress-line"]')
        ?.getBoundingClientRect();
      return {
        bodyClientWidth: document.body.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        sectionLeft: sectionRect.left,
        sectionRight: sectionRect.right,
        sectionHeight: sectionRect.height,
        lineLeft: lineRect?.left ?? 0,
        lineRight: lineRect?.right ?? 0,
      };
    });
    expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.bodyClientWidth + 1);
    expect(geometry.lineLeft).toBeGreaterThanOrEqual(geometry.sectionLeft - 1);
    expect(geometry.lineRight).toBeLessThanOrEqual(geometry.sectionRight + 1);
    expect(geometry.sectionHeight).toBeLessThanOrEqual(96);
  }

  await stop.press("Enter");
  await expect(page.getByTestId("answer-cancelled")).toBeVisible();
  await expect(previousAnswer).toBeVisible();
});

test("a completion frame cannot mark a previous answer complete when final is invalid", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboardApis(page);
  await installSuccessfulThenInvalidAnswerStreams(page);
  await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });

  const submit = await fillHydratedAnswerQuestion(page, "Lithium dosing");
  await submit.click();

  await expect(page.getByText(/In the synthetic lithium document/i)).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId("answer-progress")).toHaveAttribute("data-progress-state", "complete");

  const followUpSubmit = await fillHydratedAnswerQuestion(page, "What about monitoring?");
  await followUpSubmit.click();

  await expect(page.getByTestId("answer-error")).toContainText("Answer stream returned an invalid final payload", {
    timeout: 10_000,
  });
  await expect(page.locator('[data-progress-state="complete"]')).toHaveCount(0);
  await expect(page.getByText(/Answer ready in/)).toHaveCount(0);
  await expect(page.getByText(/In the synthetic lithium document/i)).toBeVisible();
});

test("answer progress keeps focus, reduced-motion, and forced-colour behavior intact", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockDashboardApis(page);
  await installHoldingAnswerStream(page);
  await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });
  await dismissBlockingPwaNotice(page);

  const submit = await fillHydratedAnswerQuestion(page, "Lithium dosing");
  await submit.click();

  const progress = page.getByTestId("answer-progress");
  const line = progress.getByTestId("answer-progress-line");
  const dot = progress.locator('[data-slot="answer-progress-dot"]');
  await expect(line).toContainText("Writing the answer");
  await expect(dot).toBeVisible();

  // Suppressing motion must not delete the indicator. The retired ECG sweep
  // resolved to opacity 0 here, which left everyone with OS Reduce Motion
  // staring at a blank, frozen panel on a physical iPhone. A dot has a correct
  // resting frame, so the guarantee is simply full opacity.
  expect(await dot.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  expect(await dot.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  const restingBox = await dot.boundingBox();
  expect(restingBox?.width ?? 0).toBeGreaterThan(0);
  expect(restingBox?.height ?? 0).toBeGreaterThan(0);

  // Stop is the only control in the running state, and it is reachable and
  // operable from the keyboard.
  const stop = progress.getByRole("button", { name: "Stop generating answer" });
  await stop.focus();
  await expect(stop).toBeFocused();

  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(
    await dot.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        name: style.animationName,
        duration: style.animationDuration,
        iterationCount: style.animationIterationCount,
      };
    }),
  ).toEqual({ name: "answer-progress-breath", duration: "2.4s", iterationCount: "infinite" });

  const restingOpacity = await dot.evaluate(async (node) => {
    const animation = node.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    await new Promise(requestAnimationFrame);
    return getComputedStyle(node).opacity;
  });
  const restingPixels = await dot.screenshot();
  const midOpacity = await dot.evaluate(async (node) => {
    const animation = node.getAnimations()[0];
    animation.currentTime = 1_200;
    await new Promise(requestAnimationFrame);
    return getComputedStyle(node).opacity;
  });
  const midPixels = await dot.screenshot();
  // The breath actually breathes: a different computed opacity AND a raster that
  // genuinely differs. Computed style alone was never enough — the animation this
  // replaced satisfied every computed-style assertion while reading as static.
  expect(restingOpacity).toBe("1");
  expect(midOpacity).not.toBe(restingOpacity);
  expect(Number.parseFloat(midOpacity)).toBeGreaterThan(0.2);
  expect(restingPixels.equals(midPixels), "the WebKit raster must visibly change as the dot breathes").toBe(false);

  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  // Forced colours paint neither the token background nor the animation, so the
  // dot declares a system colour of its own. Without it the only indicator on the
  // surface disappears for high-contrast users.
  await expect(dot).toBeVisible();
  await expect(line).toContainText("Writing the answer");
  expect(await dot.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");

  await stop.press("Enter");
  await expect(page.getByTestId("answer-cancelled")).toBeVisible();
});
