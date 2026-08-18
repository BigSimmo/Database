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

test("answer progress remains user-safe through fallback and keeps a compact completed state", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await mockDashboardApis(page);
  await installTimedAnswerStream(page);
  await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });

  const submit = await fillHydratedAnswerQuestion(page, "Lithium dosing");
  await submit.click();

  const progress = page.getByTestId("answer-progress-stepper");
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute("aria-busy", "true");
  await expect(progress).toHaveAttribute("data-density", "expanded");
  const activityTrace = progress.getByTestId("answer-activity-trace");
  await expect(activityTrace).toHaveAttribute("data-density", "expanded");
  await expect(activityTrace.locator('[data-slot="answer-activity-trace-sweep"]')).toHaveCount(1);
  await expect(progress.getByText("Creating your cited answer", { exact: true })).toBeVisible();
  for (const label of ["Prepare scope", "Search sources", "Select evidence", "Draft answer", "Check answer"]) {
    await expect(progress.getByText(label, { exact: true })).toBeVisible();
  }
  for (const description of [
    "Interpreting your question",
    "Scanning indexed clinical documents",
    "Prioritising relevant passages",
    "Synthesising the response and citations",
    "Checking citations and clinical details",
  ]) {
    await expect(progress.getByText(description, { exact: true })).toBeVisible();
  }
  const stop = progress.getByRole("button", { name: "Stop generating answer" });
  await expect(stop).toBeVisible();
  expect((await stop.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  await expect(progress).toContainText("Prioritising 4 Australian source passages, including 4 WA", {
    timeout: 3_000,
  });

  await expect(progress).toContainText("Drafting a cited answer from the selected passages", { timeout: 4_000 });
  const stageRail = progress.getByLabel("Answer generation stages");
  const currentStage = stageRail.locator('li[data-state="current"]');
  await expect(currentStage).toContainText("Draft answer");
  const compactStageGeometry = await stageRail.evaluate((rail) => {
    const railRect = rail.getBoundingClientRect();
    const stageRects = [...rail.querySelectorAll<HTMLElement>("li")].map((stage) => stage.getBoundingClientRect());
    return {
      clientWidth: rail.clientWidth,
      scrollWidth: rail.scrollWidth,
      railLeft: railRect.left,
      railRight: railRect.right,
      stageLefts: stageRects.map((stage) => stage.left),
      stageRights: stageRects.map((stage) => stage.right),
    };
  });
  expect(compactStageGeometry.scrollWidth).toBeLessThanOrEqual(compactStageGeometry.clientWidth + 1);
  expect(Math.min(...compactStageGeometry.stageLefts)).toBeGreaterThanOrEqual(compactStageGeometry.railLeft - 1);
  expect(Math.max(...compactStageGeometry.stageRights)).toBeLessThanOrEqual(compactStageGeometry.railRight + 1);

  await page.setViewportSize({ width: 1440, height: 1000 });
  const wideStageGeometry = await stageRail.evaluate((rail) => {
    const stageRects = [...rail.querySelectorAll<HTMLElement>("li")].map((stage) => stage.getBoundingClientRect());
    return {
      clientWidth: rail.clientWidth,
      scrollWidth: rail.scrollWidth,
      stageTops: stageRects.map((stage) => stage.top),
    };
  });
  expect(wideStageGeometry.scrollWidth).toBeLessThanOrEqual(wideStageGeometry.clientWidth + 1);
  expect(Math.max(...wideStageGeometry.stageTops) - Math.min(...wideStageGeometry.stageTops)).toBeLessThanOrEqual(1);
  await expect(progress).toContainText("Building a source-backed answer", { timeout: 5_000 });
  // Rolling deployments may still route a new client to an older server that
  // emits provisional token/revising frames. The client must ignore both so
  // unvalidated clinical prose never reaches the page before the final event.
  await expect(page.getByTestId("answer-streaming")).toHaveCount(0);
  await expect(page.getByTestId("answer-streaming-revising")).toHaveCount(0);
  await expect(page.getByText("Provisional lithium draft")).toHaveCount(0);

  await expect(progress).toHaveAttribute("data-progress-state", "complete", { timeout: 6_000 });
  await expect(progress).toHaveAttribute("data-density", "complete");
  await expect(activityTrace).toHaveCount(0);
  await expect(progress).toContainText("Answer ready in 3s");
  await expect(progress.getByText("Processing details", { exact: true })).toBeVisible();
  await expect(page.getByTestId("stop-answer")).toHaveCount(0);
  await expect(page.getByText(/In the synthetic lithium document/i)).toBeVisible({ timeout: 8_000 });
  await expect(page.locator("body")).not.toContainText(
    /private-(?:model|route|provider-reason|fallback|draft|check|ready)-marker/i,
  );
});

test("follow-up answer generation stays compact above the previous answer", async ({ page }) => {
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

  const followUpSubmit = await fillHydratedAnswerQuestion(page, "What monitoring is needed?");
  await followUpSubmit.click();

  const progress = page.getByTestId("answer-progress-stepper");
  await expect(progress).toHaveAttribute("data-density", "compact");
  await expect(progress.getByText("Creating cited answer", { exact: true })).toBeVisible();
  await expect(progress).toContainText("Step 4 of 5 · Draft answer");
  await expect(previousAnswer).toBeVisible();
  await expect(progress.getByLabel("Answer generation stages")).toHaveCount(0);
  await expect(progress.getByText("Processing details", { exact: true })).toHaveCount(0);

  const activityTrace = progress.getByTestId("answer-activity-trace");
  await expect(activityTrace).toHaveAttribute("data-density", "compact");
  const compactSweep = activityTrace.locator('[data-slot="answer-activity-trace-sweep"]');
  await expect(compactSweep).toHaveCount(1);
  expect(
    await compactSweep.evaluate((trace) => {
      const style = getComputedStyle(trace);
      return {
        duration: style.animationDuration,
        iterationCount: style.animationIterationCount,
        timingFunction: style.animationTimingFunction,
      };
    }),
  ).toEqual({ duration: "2.6s", iterationCount: "infinite", timingFunction: "linear" });
  const stop = progress.getByRole("button", { name: "Stop generating answer" });
  expect((await stop.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);

  for (const width of [320, 390, 639, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    const geometry = await progress.evaluate((section) => {
      const trace = section.querySelector<HTMLElement>('[data-testid="answer-activity-trace"]');
      const sectionRect = section.getBoundingClientRect();
      const traceRect = trace?.getBoundingClientRect();
      return {
        bodyClientWidth: document.body.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        sectionLeft: sectionRect.left,
        sectionRight: sectionRect.right,
        traceLeft: traceRect?.left ?? 0,
        traceRight: traceRect?.right ?? 0,
        traceHeight: traceRect?.height ?? 0,
      };
    });
    expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.bodyClientWidth + 1);
    expect(geometry.traceLeft).toBeGreaterThanOrEqual(geometry.sectionLeft - 1);
    expect(geometry.traceRight).toBeLessThanOrEqual(geometry.sectionRight + 1);
    expect(geometry.traceHeight).toBeLessThanOrEqual(21);
  }

  await stop.press("Enter");
  await expect(page.getByTestId("answer-cancelled")).toBeVisible();
  await expect(previousAnswer).toBeVisible();
  await expect(activityTrace).toHaveCount(0);
});

test("a completion frame cannot mark a previous answer complete when final is invalid", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboardApis(page);
  await installSuccessfulThenInvalidAnswerStreams(page);
  await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });

  const submit = await fillHydratedAnswerQuestion(page, "Lithium dosing");
  await submit.click();

  await expect(page.getByText(/In the synthetic lithium document/i)).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId("answer-progress-stepper")).toHaveAttribute("data-progress-state", "complete");

  const followUpSubmit = await fillHydratedAnswerQuestion(page, "What about monitoring?");
  await followUpSubmit.click();

  await expect(page.getByTestId("answer-error")).toContainText("Answer stream returned an invalid final payload", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("answer-activity-trace")).toHaveCount(0);
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

  const progress = page.getByTestId("answer-progress-stepper");
  const currentStage = progress.getByLabel("Answer generation stages").locator('li[data-state="current"]');
  await expect(currentStage).toContainText("Draft answer");

  const activeSpinner = currentStage.locator("svg");
  const activityTraceSweep = progress.locator('[data-slot="answer-activity-trace-sweep"]');
  const activityTraceBase = progress.locator('[data-slot="answer-activity-trace-base"]');
  await expect(activeSpinner).toBeVisible();
  await expect(activityTraceSweep).toBeVisible();
  await expect(activityTraceBase).toBeVisible();
  expect(await activeSpinner.evaluate((spinner) => getComputedStyle(spinner).animationName)).toBe("none");
  expect(await activityTraceSweep.evaluate((trace) => getComputedStyle(trace).animationName)).toBe("none");
  // Suppressing motion must not delete the indicator. This previously resolved to
  // "0", which left everyone with OS Reduce Motion staring at a blank, frozen panel.
  expect(await activityTraceSweep.evaluate((trace) => getComputedStyle(trace).opacity)).toBe("0.55");

  const stop = progress.getByRole("button", { name: "Stop generating answer" });
  const details = progress.getByText("Processing details", { exact: true });
  await stop.focus();
  await page.keyboard.press("Tab");
  await expect(details).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(stop).toBeFocused();

  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await activeSpinner.evaluate((spinner) => getComputedStyle(spinner).animationName)).not.toBe("none");
  expect(
    await activityTraceSweep.evaluate((trace) => {
      const style = getComputedStyle(trace);
      return {
        name: style.animationName,
        duration: style.animationDuration,
        iterationCount: style.animationIterationCount,
        timingFunction: style.animationTimingFunction,
      };
    }),
  ).toEqual({
    name: "answer-ecg-scroll",
    duration: "3.2s",
    iterationCount: "infinite",
    timingFunction: "linear",
  });
  const restingTransform = await activityTraceSweep.evaluate(async (trace) => {
    const animation = trace.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    await new Promise(requestAnimationFrame);
    return getComputedStyle(trace).transform;
  });
  const restingPixels = await activityTraceSweep.screenshot();
  const midTransform = await activityTraceSweep.evaluate(async (trace) => {
    const animation = trace.getAnimations()[0];
    animation.currentTime = 1_600;
    await new Promise(requestAnimationFrame);
    return getComputedStyle(trace).transform;
  });
  const midPixels = await activityTraceSweep.screenshot();
  // The strip actually moves: a matrix translate, not the identity, and a raster
  // that genuinely differs. Computed style alone was never enough — the previous
  // animation satisfied every computed-style assertion while reading as static.
  expect(restingTransform).toBe("matrix(1, 0, 0, 1, 0, 0)");
  expect(midTransform).not.toBe(restingTransform);
  expect(midTransform).toMatch(/^matrix\(1, 0, 0, 1, -\d/);
  expect(restingPixels.equals(midPixels), "the WebKit raster must visibly change as the strip travels").toBe(false);

  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await expect(currentStage.locator('[data-slot="answer-progress-stage-marker"]')).toBeVisible();
  await expect(currentStage.getByText("Draft answer", { exact: true })).toBeVisible();
  await expect(progress.getByTestId("answer-activity-trace")).toBeVisible();
  expect(await activeSpinner.evaluate((spinner) => getComputedStyle(spinner).animationName)).toBe("none");
  expect(await activityTraceSweep.evaluate((trace) => getComputedStyle(trace).animationName)).toBe("none");

  await stop.press("Enter");
  await expect(page.getByTestId("answer-cancelled")).toBeVisible();
});
