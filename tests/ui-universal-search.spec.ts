import { expect, test, type Page } from "playwright/test";

// Cross-entity universal typeahead in the command surface. The universal endpoint is
// mocked so this spec exercises the UI contract (grouped sections, navigation,
// mode-search preservation) deterministically in demo mode without live retrieval.

const universalPayload = {
  query: "acamprosate",
  tookMs: 12,
  demoMode: true,
  groups: [
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
          title: "Delirium / Acute Confusion / Encephalopathy",
          subtitle: "Delirium and its encephalopathic mimics are acute medical emergencies",
          href: "/differentials/presentations/acute-confusion-encephalopathy",
          score: 18,
          badge: "Emergent",
          meta: "7 differentials",
        },
      ],
    },
  ],
};

async function mockUniversalSearch(page: Page) {
  await page.route(/\/api\/search\/universal(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: universalPayload });
  });
}

async function openComposer(page: Page) {
  await page.goto("/?mode=documents&focus=1", { waitUntil: "domcontentloaded" });
  const input = page.getByTestId("global-search-input").first();
  await input.click();
  return input;
}

test.describe("universal search typeahead", () => {
  test("shows grouped cross-entity results while typing", async ({ page }) => {
    await mockUniversalSearch(page);
    const input = await openComposer(page);
    await input.fill("acamprosate");

    await expect(page.getByText("Medications · 1")).toBeVisible();
    await expect(page.getByRole("option", { name: /Acamprosate/ })).toBeVisible();
    await expect(page.getByText("Forms · 1")).toBeVisible();
    await expect(page.getByRole("option", { name: /View all in Medication/ })).toBeVisible();
    // Presentations render as their own group borrowing the differentials mode target.
    await expect(page.getByText("Presentations · 1")).toBeVisible();
    await expect(page.getByRole("option", { name: /Acute Confusion/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /View all in Differentials/ })).toBeVisible();
  });

  test("selecting a presentation result navigates to the workflow page", async ({ page }) => {
    await mockUniversalSearch(page);
    const input = await openComposer(page);
    await input.fill("acute confusion");

    const option = page.getByRole("option", { name: /Acute Confusion/ });
    await expect(option).toBeVisible();
    await option.click();
    await expect(page).toHaveURL(/\/differentials\/presentations\/acute-confusion-encephalopathy/);
  });

  test("selecting a grouped result navigates to the record", async ({ page }) => {
    await mockUniversalSearch(page);
    const input = await openComposer(page);
    await input.fill("acamprosate");

    const option = page.getByRole("option", { name: /Acamprosate/ });
    await expect(option).toBeVisible();
    await option.click();
    await expect(page).toHaveURL(/\/medications\/acamprosate/);
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
  async function mockSmartSearch(page: Page) {
    await page.route(/\/api\/search\/universal(?:\?.*)?$/, async (route) => {
      await route.fulfill({ json: smartPayload });
    });
    await page.route(/\/api\/answer(?:\/stream)?(?:\?.*)?$/, async (route) => {
      const answer = {
        answer: "Synthetic answer for the universal-search navigation check.",
        grounded: false,
        confidence: "unsupported",
        citations: [],
        sources: [],
        demoMode: true,
      };
      if (new URL(route.request().url()).pathname.endsWith("/stream")) {
        await route.fulfill({
          body: `event: final\ndata: ${JSON.stringify(answer)}\n\n`,
          contentType: "text/event-stream; charset=utf-8",
        });
        return;
      }
      await route.fulfill({ json: answer });
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
});
