import { expect, test, type Locator, type Page, type Route } from "playwright/test";
import { demoAnswer } from "../src/lib/demo-data";
import { stubZeroTouchPoints } from "./helpers/zero-touch";
import { expectSingleSettledOwner } from "./playwright-settlement";

// Cross-entity universal typeahead in the command surface. The universal endpoint is
// mocked so this spec exercises the UI contract (grouped sections, navigation,
// mode-search preservation) deterministically in demo mode without live retrieval.

const universalPayload = {
  query: "acamprosate",
  tookMs: 12,
  demoMode: true,
  groups: [
    {
      kind: "documents",
      total: 1,
      latencyMs: 2,
      items: [
        {
          id: "acamprosate-guideline",
          kind: "documents",
          title: "Acamprosate prescribing guideline",
          subtitle: "Alcohol dependence",
          href: "/documents/acamprosate-guideline",
          score: 0.86,
        },
      ],
    },
    {
      kind: "medications",
      total: 1,
      latencyMs: 4,
      items: [
        {
          id: "acamprosate",
          kind: "medications",
          title: "Acamprosate",
          subtitle: "Alcohol dependence — maintenance of abstinence",
          href: "/medications/acamprosate",
          score: 22,
          badge: "S4",
        },
      ],
    },
    {
      kind: "forms",
      total: 1,
      latencyMs: 3,
      items: [
        {
          id: "transfer-form",
          kind: "forms",
          title: "Transfer order form",
          href: "/forms/transfer-form",
          score: 9,
        },
      ],
    },
    {
      kind: "presentations",
      total: 1,
      latencyMs: 3,
      items: [
        {
          id: "acute-confusion-encephalopathy",
          kind: "presentations",
          title: "Acute confusion and delirium",
          subtitle: "Covers delirium, acute confusion, toxic-metabolic encephalopathy, and post-ictal confusion.",
          href: "/differentials/presentations/acute-confusion-encephalopathy",
          score: 18,
          badge: "Emergent",
          meta: "7 differentials",
        },
      ],
    },
  ],
};

async function fulfillUniversalSearch(route: Route, response: typeof universalPayload & Record<string, unknown>) {
  const query = response.query;
  const events = [...response.groups.map((group) => ({ type: "group", query, group })), { type: "complete", response }];
  await route.fulfill({
    body: `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    contentType: "application/x-ndjson; charset=utf-8",
  });
}

async function mockUniversalSearch(page: Page) {
  await page.route(/\/api\/search\/universal(?:\?.*)?$/, async (route) => {
    const requestUrl = new URL(route.request().url());
    const mode = requestUrl.searchParams.get("mode") ?? "documents";
    const query = requestUrl.searchParams.get("q") ?? "";
    const preferredByMode: Record<string, string[]> = {
      answer: ["documents"],
      documents: ["documents"],
      prescribing: ["medications", "documents"],
      services: ["services"],
      forms: ["forms"],
      favourites: [],
      differentials: ["differentials", "presentations"],
      formulation: ["specifiers"],
      tools: ["tools"],
    };
    const preferredDomains = preferredByMode[mode] ?? [];
    const responseOrder = universalPayload.groups.map((group) => group.kind);
    await fulfillUniversalSearch(route, {
      ...universalPayload,
      query,
      contextMode: mode,
      preferredDomains,
      domainOrder: [...preferredDomains, ...responseOrder.filter((domain) => !preferredDomains.includes(domain))],
    });
  });
}

async function waitForReactChangeHandler(locator: Locator) {
  await expect
    .poll(
      async () =>
        locator.evaluate((element) => {
          const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
          if (!propsKey) return false;
          const props = (element as unknown as Record<string, Record<string, unknown>>)[propsKey];
          return typeof props?.onChange === "function";
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
}

async function openComposer(page: Page, href = "/?mode=documents&focus=1") {
  await page.goto(href, { waitUntil: "domcontentloaded" });
  // Production hydration can briefly overlap server and client composers. Poll
  // until exactly one settled owner exists — never mask that with `.first()`.
  const input = await expectSingleSettledOwner(page.getByTestId("global-search-input"), {
    message: "documents composer owner",
  });
  await expect(input).toBeEnabled();
  await waitForReactChangeHandler(input);
  await input.click();
  await expect(input).toBeFocused();
  return input;
}

test.beforeEach(stubZeroTouchPoints);

test.describe("universal search typeahead", () => {
  test("keeps calculator command suggestions local", async ({ page }) => {
    let universalRequestCount = 0;
    await page.route(/\/api\/search\/universal(?:\?.*)?$/, async (route) => {
      universalRequestCount += 1;
      await route.fulfill({ status: 204 });
    });

    const input = await openComposer(page, "/calculators?focus=1");
    await input.fill("depression");
    await expect(page.getByRole("option", { name: /depression severity.*PHQ-9/i })).toBeVisible();
    await page.waitForTimeout(500);

    expect(universalRequestCount).toBe(0);
  });

  test("shows grouped cross-entity results while typing", async ({ page }) => {
    await mockUniversalSearch(page);
    const input = await openComposer(page);
    await input.fill("acamprosate");

    await expect(page.getByText("Medications · 1")).toBeVisible();
    await expect(page.getByText(/Current mode · Documents · 1/)).toBeVisible();
    await expect(page.getByRole("option", { name: /^Acamprosate Alcohol/ })).toBeVisible();
    await expect(page.getByText("Forms · 1")).toBeVisible();
    await expect(page.getByRole("option", { name: /View all in Medication/ })).toBeVisible();
    // Presentations render as their own group borrowing the differentials mode target.
    await expect(page.getByText("Presentations · 1")).toBeVisible();
    await expect(page.getByRole("option", { name: /Acute Confusion/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /View all in Differentials/ })).toBeVisible();
  });

  test("exposes the keyboard-highlighted option from the focused combobox", async ({ page }) => {
    await mockUniversalSearch(page);
    const input = await openComposer(page);
    await input.fill("acamprosate");

    const listbox = page.getByRole("listbox", { name: "Documents search suggestions" });
    await expect(listbox).toBeVisible();
    await expect(page.getByText("Medications · 1")).toBeVisible();
    expect(await input.getAttribute("aria-activedescendant")).toBeNull();

    await input.press("ArrowDown");
    const firstSelectedOption = listbox.getByRole("option", { selected: true });
    await expect(firstSelectedOption).toHaveCount(1);
    const firstActiveId = await firstSelectedOption.getAttribute("id");
    expect(firstActiveId).toBeTruthy();
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("aria-activedescendant", firstActiveId!);

    await input.press("ArrowDown");
    const secondSelectedOption = listbox.getByRole("option", { selected: true });
    await expect(secondSelectedOption).toHaveCount(1);
    const secondActiveId = await secondSelectedOption.getAttribute("id");
    expect(secondActiveId).toBeTruthy();
    expect(secondActiveId).not.toBe(firstActiveId);
    await expect(input).toHaveAttribute("aria-activedescendant", secondActiveId!);

    await input.press("Escape");
    await expect(listbox).toBeHidden();
    expect(await input.getAttribute("aria-activedescendant")).toBeNull();
  });

  test("Escape dismisses the dropdown without erasing the typed query", async ({ page }) => {
    // The composer input is `type="search"`, whose native Chromium Escape gesture
    // clears the field. Escape must only dismiss the dropdown; the query stays put
    // so a reader can reopen or edit it instead of retyping from scratch.
    await mockUniversalSearch(page);
    const input = await openComposer(page);
    await input.fill("acamprosate");

    const listbox = page.getByRole("listbox", { name: "Documents search suggestions" });
    await expect(listbox).toBeVisible();

    await input.press("Escape");
    await expect(listbox).toBeHidden();
    await expect(input).toHaveValue("acamprosate");
  });

  test("does not count document-only hits as visible Medication rows", async ({ page }) => {
    await page.route(/\/api\/search\/universal(?:\?.*)?$/, async (route) => {
      await fulfillUniversalSearch(route, {
        ...universalPayload,
        query: "prescribing policy",
        contextMode: "documents",
        preferredDomains: ["documents"],
        domainOrder: ["documents"],
        groups: [universalPayload.groups[0]],
      });
    });
    const input = await openComposer(page);
    await input.fill("prescribing policy");

    await expect(page.getByRole("option", { name: "Medication", exact: true })).toHaveText("Medication");
  });

  test("selecting a presentation result navigates to the workflow page", async ({ page }) => {
    await mockUniversalSearch(page);
    const input = await openComposer(page);
    await input.fill("acute confusion");

    const option = page.getByRole("option", { name: /Acute Confusion/ });
    await expect(option).toBeVisible();
    await option.click();
    await expect(page).toHaveURL(/\/differentials\/presentations\/acute-confusion-encephalopathy/, {
      timeout: 30_000,
    });
  });

  test("selecting a grouped result navigates to the record", async ({ page }) => {
    await mockUniversalSearch(page);
    const input = await openComposer(page);
    await input.fill("acamprosate");

    const option = page.getByRole("option", { name: /^Acamprosate Alcohol/ });
    await expect(option).toBeVisible();
    // Scroll the command list itself before clicking. Playwright's generic
    // actionability scroll can move the document when this lower grouped item
    // is clipped, which intentionally closes the floating command surface.
    // A user reaches the item by scrolling this listbox, not the page.
    await option.evaluate((element) => {
      const listbox = element.closest<HTMLElement>('[role="listbox"]');
      if (!listbox) throw new Error("Universal-search option is not owned by a listbox.");
      listbox.scrollTop = Math.max(0, (element as HTMLElement).offsetTop - listbox.clientHeight / 2);
    });
    await expect(option).toBeVisible();
    await expect(option).toBeInViewport();
    await option.click();
    await expect(page).toHaveURL(/\/medications\/acamprosate/, { timeout: 30_000 });
  });

  test("Enter with nothing highlighted still runs the mode-scoped search", async ({ page }) => {
    await mockUniversalSearch(page);
    const input = await openComposer(page);
    await input.fill("clozapine monitoring");
    await expect(page.getByText("Medications · 1")).toBeVisible();
    await input.press("Enter");

    // Documents mode routes an Enter submit to the document search flow; the dropdown
    // closes and the app stays on a documents surface rather than a registry page.
    await expect(page.getByText("Medications · 1")).toBeHidden();
    await expect(page).not.toHaveURL(/\/medications\//);
  });

  test("shows local saved content first in Favourites without uploading it", async ({ page }) => {
    await mockUniversalSearch(page);
    const input = await openComposer(page, "/favourites?focus=1");
    await input.fill("ward round");

    await expect(page.getByText(/Current mode · \d+/)).toBeVisible();
    await expect(page.getByRole("option", { name: /Ward round/ })).toBeVisible();
    await expect(page.getByText("Saved").first()).toBeVisible();
  });

  test("keeps cross-mode typeahead hidden on a landscape touch phone", async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      ...(baseURL ? { baseURL } : {}),
      hasTouch: true,
      viewport: { width: 844, height: 390 },
    });
    const page = await context.newPage();

    try {
      await mockUniversalSearch(page);
      const input = await openComposer(page);
      await input.fill("acamprosate");

      await expect(page.locator(".universal-command-dropdown:visible")).toHaveCount(0);
      await expect(page.getByText(/Current mode · Documents · 1/)).toHaveCount(0);
      await expect(page.getByText("Also in Medication · Medications · 1")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("keeps submitted cross-mode matches off the unsubmitted shared home", async ({ page }) => {
    await mockUniversalSearch(page);
    await page.goto("/?mode=therapy-compass&q=acamprosate&run=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("universal-also-matches")).toBeVisible();

    const input = await openComposer(page, "/?mode=therapy-compass&focus=1");
    await input.fill("acamprosate");

    await expect(page.getByTestId("universal-also-matches")).toHaveCount(0);
  });
  test("keeps compact cross-mode matches visible after submission", async ({ page }) => {
    await mockUniversalSearch(page);
    const universalRequest = page.waitForRequest(/\/api\/search\/universal(?:\?.*)?$/);
    await page.goto("/services?q=13YARN&run=1", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("universal-also-matches")).toBeVisible();
    await expect(page.getByText("Also matches in other modes")).toBeVisible();
    await expect(page.getByRole("link", { name: "Acamprosate", exact: true })).toBeVisible();
    expect(new URL((await universalRequest).url()).searchParams.get("domains")?.split(",")).not.toContain("services");
  });

  test("places submitted cross-mode matches after the owning mode results", async ({ page }) => {
    // "13YARN" matches the demo service fixture so service-search-results renders.
    // Use an inline mock that echoes back the same query so universal-also-matches renders.
    await page.route(/\/api\/search\/universal(?:\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const mode = url.searchParams.get("mode") ?? "services";
      const q = url.searchParams.get("q") ?? "13YARN";
      await fulfillUniversalSearch(route, {
        ...universalPayload,
        query: q,
        contextMode: mode,
        preferredDomains: [],
        domainOrder: universalPayload.groups.map((g) => g.kind),
      });
    });
    await page.goto("/services?q=13YARN&run=1", { waitUntil: "domcontentloaded" });

    const results = page.getByTestId("service-search-results");
    const alsoMatches = page.getByTestId("universal-also-matches");
    await expect(results).toBeVisible();
    await expect(alsoMatches).toBeVisible();
    expect(
      await alsoMatches.evaluate((node) => {
        const resultNode = document.querySelector('[data-testid="service-search-results"]');
        return Boolean((resultNode?.compareDocumentPosition(node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING);
      }),
      "universal-also-matches panel must appear after primary results in the DOM",
    ).toBe(true);
  });

  test("loads submitted cross-mode matches on phones only after expansion", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const universalRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/search/universal") universalRequests.push(request.url());
    });
    await mockUniversalSearch(page);
    await page.goto("/forms?q=acamprosate&run=1", { waitUntil: "domcontentloaded" });

    const alsoMatches = page.getByTestId("universal-also-matches");
    await expect(alsoMatches).toBeVisible();
    await expect(alsoMatches).toHaveCount(1);
    expect(universalRequests).toHaveLength(0);

    await alsoMatches.getByRole("button", { name: /Also matches in other modes/ }).click();
    await expect.poll(() => universalRequests.length).toBe(1);
    await expect(alsoMatches.getByRole("link", { name: "Acamprosate", exact: true })).toBeVisible();
  });

  test("shows submitted cross-mode matches once for Favourites and after a Tools search", async ({ page }) => {
    await mockUniversalSearch(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/favourites?q=acamprosate&run=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("universal-also-matches")).toHaveCount(1);

    const input = await openComposer(page, "/tools?focus=1");
    await input.fill("acamprosate");
    await input.press("Enter");
    await expect(page.getByTestId("universal-also-matches")).toBeVisible();
  });
});

// Smart affordances: query interpretation banner, pinned best-bet, and the Answer-mode bridge.
// The endpoint is mocked with the enriched response fields runUniversalSearch now returns.
const smartPayload = {
  ...universalPayload,
  interpretation: {
    correctedQuery: "acamprosate",
    typoCorrections: [{ from: "acamprosat", to: "acamprosate" }],
    queryClass: "medication_dose_risk",
    intent: "drug_dosing",
  },
  domainOrder: ["medications", "forms"],
  topHit: {
    id: "acamprosate",
    kind: "medications",
    title: "Acamprosate",
    subtitle: "Alcohol dependence — maintenance of abstinence",
    href: "/medications/acamprosate",
    score: 22,
    badge: "S4",
    confident: true,
    reason: "Best match in medications",
  },
  answerAction: { href: "/?mode=answer&q=acamprosat&run=1", label: "Ask this question" },
};

test.describe("universal search smart affordances", () => {
  const syntheticAnswer = { ...demoAnswer("lithium dosing"), demoMode: true };

  async function mockSmartSearch(page: Page) {
    await page.route(/\/api\/search\/universal(?:\?.*)?$/, async (route) => {
      await fulfillUniversalSearch(route, smartPayload);
    });
    await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route) => {
      if (new URL(route.request().url()).pathname.endsWith("/stream")) {
        await route.fulfill({
          body: [
            `event: progress\ndata: ${JSON.stringify({ stage: "complete", message: "Answer ready.", elapsedMs: 40 })}`,
            `event: final\ndata: ${JSON.stringify(syntheticAnswer)}`,
            "",
          ].join("\n\n"),
          contentType: "text/event-stream; charset=utf-8",
        });
        return;
      }
      await route.fulfill({ json: syntheticAnswer });
    });
  }

  test("shows the interpretation banner, a Best match, and an Ask-this bridge", async ({ page }) => {
    await mockSmartSearch(page);
    const input = await openComposer(page);
    await input.fill("acamprosat");

    await expect(page.getByText(/Showing results for/)).toBeVisible();
    await expect(page.getByText("Best match")).toBeVisible();
    await expect(page.getByRole("option", { name: /Ask this question/ })).toBeVisible();
  });

  test("the Ask-this bridge navigates into Answer mode", async ({ page }) => {
    await mockSmartSearch(page);
    const input = await openComposer(page);
    await input.fill("acamprosat");

    const ask = page.getByRole("option", { name: /Ask this question/ });
    await expect(ask).toBeVisible();
    const answerRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === "/api/answer/stream" && request.method() === "POST",
    );
    await ask.click();
    expect((await answerRequest).postDataJSON()).toMatchObject({ query: "acamprosat" });
    await expect(page.getByRole("main").getByRole("heading", { name: "Answer", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/mode=answer/);
  });

  test("keeps a completed Answer query eligible for submitted cross-mode matches", async ({ page }) => {
    await mockSmartSearch(page);
    const input = await openComposer(page, "/?mode=answer&focus=1");
    await input.fill("acamprosat");
    await page.getByRole("button", { name: "Generate source-backed answer" }).click();

    await expect(page.getByTestId("universal-also-matches")).toBeVisible();
  });

  test("hides Answer-mode also-matches while drafting and shows them after the final answer", async ({ page }) => {
    await page.route(/\/api\/search\/universal(?:\?.*)?$/, async (route) => {
      await fulfillUniversalSearch(route, smartPayload);
    });

    await page.addInitScript(
      ({ payload }) => {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const rawUrl = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
          const pathname = new URL(rawUrl, window.location.href).pathname;
          if (pathname !== "/api/answer/stream") return originalFetch(input, init);

          const encoder = new TextEncoder();
          const events: Array<{ delay: number; event: string; data: unknown }> = [
            { delay: 0, event: "progress", data: { stage: "scoping", message: "Preparing scope." } },
            { delay: 80, event: "progress", data: { stage: "retrieving", message: "Searching documents." } },
            { delay: 160, event: "progress", data: { stage: "ranking", message: "Selecting governed sources." } },
            {
              delay: 240,
              event: "progress",
              data: { stage: "generating", message: "Drafting a cited answer from the selected passages." },
            },
            {
              delay: 1_800,
              event: "progress",
              data: { stage: "complete", message: "Answer ready.", elapsedMs: 1_800 },
            },
            { delay: 1_900, event: "final", data: payload },
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
      { payload: syntheticAnswer },
    );

    const input = await openComposer(page, "/?mode=answer&focus=1");
    await input.fill("acamprosat");
    await page.getByRole("button", { name: "Generate source-backed answer" }).click();

    const progress = page.getByTestId("answer-progress-stepper");
    await expect(progress).toBeVisible();
    await expect(progress).toContainText("Drafting a cited answer from the selected passages.");
    await expect(page.getByTestId("universal-also-matches")).toHaveCount(0);

    await expect(page.getByTestId("universal-also-matches")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Also matches in other modes")).toBeVisible();
  });

  test("keeps a saved exact match first in Favourites", async ({ page }) => {
    await mockSmartSearch(page);
    const input = await openComposer(page, "/favourites?focus=1");
    await input.fill("acamprosate");

    await expect(page.getByText("Best match")).toBeHidden();
    await expect(page.getByRole("option").first()).toContainText("Acamprosate renal screen");
    await expect(page.getByRole("option").first()).toContainText("Saved");
  });
});
