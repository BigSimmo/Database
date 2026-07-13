import { expect, test, type Page } from "playwright/test";
import { demoAnswer, demoDocuments } from "../src/lib/demo-data";

const readySetupChecks = [
  { id: "env", label: ".env.local configured", status: "ready", detail: "Test environment ready." },
  { id: "project", label: "Clinical KB Database target", status: "ready", detail: "Test project ready." },
  { id: "schema", label: "supabase/schema.sql applied", status: "ready", detail: "Test schema ready." },
  { id: "search", label: "Search RPC and vector indexes", status: "ready", detail: "Test search ready." },
  { id: "openai", label: "Answer provider", status: "ready", detail: "Mock stream ready." },
];

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
          { delay: 2_400, event: "revising", data: { reason: "private-provider-reason-marker" } },
          { delay: 2_450, event: "progress", data: { stage: "fallback", message: "private-fallback-marker" } },
          { delay: 3_100, event: "progress", data: { stage: "verifying", message: "private-check-marker" } },
          {
            delay: 3_700,
            event: "progress",
            data: { stage: "complete", message: "private-ready-marker", elapsedMs: 3_700 },
          },
          { delay: 3_800, event: "final", data: answer },
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

test("answer progress remains user-safe through fallback and keeps a compact completed state", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboardApis(page);
  await installTimedAnswerStream(page);
  await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });

  const input = page.locator('[aria-label^="Search indexed guidelines by question or keyword"]:visible').first();
  const submit = page.locator('[aria-label="Generate source-backed answer"]:visible').first();
  await expect(input).toBeEditable({ timeout: 30_000 });
  await input.fill("Lithium dosing");
  await submit.click();

  const progress = page.getByTestId("answer-progress-stepper");
  await expect(progress).toBeVisible();
  for (const label of ["Prepare scope", "Search sources", "Select evidence", "Draft answer", "Check answer"]) {
    await expect(progress.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(progress).toContainText("Prioritising 4 Australian source passages, including 4 WA", {
    timeout: 3_000,
  });

  await expect(progress).toContainText("Building a source-backed answer", { timeout: 5_000 });
  // Rolling deployments may still route a new client to an older server that
  // emits provisional token/revising frames. The client must ignore both so
  // unvalidated clinical prose never reaches the page before the final event.
  await expect(page.getByTestId("answer-streaming")).toHaveCount(0);
  await expect(page.getByTestId("answer-streaming-revising")).toHaveCount(0);
  await expect(page.getByText("Provisional lithium draft")).toHaveCount(0);

  await expect(progress).toHaveAttribute("data-progress-state", "complete", { timeout: 6_000 });
  await expect(progress).toContainText("Answer ready in 3s");
  await expect(progress.getByText("Processing details", { exact: true })).toBeVisible();
  await expect(page.getByTestId("stop-answer")).toHaveCount(0);
  await expect(page.getByText(/In the synthetic lithium document/i)).toBeVisible({ timeout: 8_000 });
  await expect(page.locator("body")).not.toContainText(
    /private-(?:model|route|provider-reason|fallback|draft|check|ready)-marker/i,
  );
});

test("a completion frame cannot mark a previous answer complete when final is invalid", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboardApis(page);
  await installSuccessfulThenInvalidAnswerStreams(page);
  await page.goto("/?mode=answer", { waitUntil: "domcontentloaded" });

  const input = page.locator('[aria-label^="Search indexed guidelines by question or keyword"]:visible').first();
  const submit = page.locator('[aria-label="Generate source-backed answer"]:visible').first();
  await expect(input).toBeEditable({ timeout: 30_000 });
  await input.fill("Lithium dosing");
  await submit.click();

  await expect(page.getByText(/In the synthetic lithium document/i)).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId("answer-progress-stepper")).toHaveAttribute("data-progress-state", "complete");

  await input.fill("What about monitoring?");
  await submit.click();

  await expect(page.getByTestId("answer-error")).toContainText("Answer stream returned an invalid final payload", {
    timeout: 10_000,
  });
  await expect(page.locator('[data-progress-state="complete"]')).toHaveCount(0);
  await expect(page.getByText(/Answer ready in/)).toHaveCount(0);
  await expect(page.getByText(/In the synthetic lithium document/i)).toBeVisible();
});
