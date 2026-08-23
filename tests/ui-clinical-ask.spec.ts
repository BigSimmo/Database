import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "playwright/test";

const modes = [
  [
    "services",
    "Services",
    ["potential_matches", "fit_reasons", "eligibility", "access_pathway", "missing_information"],
  ],
  [
    "forms",
    "Forms",
    ["potential_forms", "jurisdiction_stage", "purpose", "prerequisites", "responsibility", "submission_pathway"],
  ],
  [
    "differentials",
    "Differentials",
    [
      "candidate_possibilities",
      "supporting_clues",
      "contradicting_clues",
      "discriminators",
      "must_not_miss",
      "missing_assessment",
    ],
  ],
  [
    "formulation",
    "Formulation",
    [
      "mechanism_hypotheses",
      "predisposing",
      "precipitating",
      "perpetuating",
      "protective",
      "evidence_against",
      "questions_to_test",
    ],
  ],
  [
    "dsm",
    "DSM-5 Diagnosis",
    ["candidate_mapping", "apparently_supported", "duration", "impairment", "exclusions", "differential_gaps"],
  ],
  [
    "specifiers",
    "Specifiers",
    [
      "potential_specifiers",
      "base_diagnosis_applicability",
      "features_for",
      "features_against",
      "missing_criteria",
      "incompatibilities",
    ],
  ],
  [
    "therapy-compass",
    "Therapy",
    ["potential_options", "rationale", "population_setting_fit", "cautions", "practical_requirements", "alternatives"],
  ],
] as const;

const syntheticQuestion = "Synthetic presentation with low mood and reduced sleep";
const forbiddenOutcomes = /final diagnosis|referral accepted|submit(?:ted)? form|treatment plan/i;

function frame(event: unknown) {
  const type = (event as { type: string }).type;
  return `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function answered(mode: (typeof modes)[number][0], sections: readonly string[]) {
  return {
    state: "answered" as const,
    mode,
    lead: { id: "lead", text: "A bounded clinician-reference summary.", evidenceIds: ["catalogue-1"] },
    sections: sections.map((id) => ({
      id,
      title: id,
      claims: [
        { id: `claim-${id}`, text: `Synthetic ${id.replaceAll("_", " ")} evidence.`, evidenceIds: ["catalogue-1"] },
      ],
    })),
    evidence: [
      {
        id: "catalogue-1",
        tier: "catalogue",
        title: "Synthetic catalogue source",
        publisher: "Database catalogue",
        jurisdiction: "AU",
        href: "/services",
        extract: "Synthetic non-person evidence.",
        reviewState: "needs_review",
        publishedAt: null,
        updatedAt: null,
        retrievedAt: "2026-08-22T00:00:00.000Z",
      },
    ],
    conflicts: [{ id: "conflict", text: "Synthetic sources differ on applicability.", evidenceIds: ["catalogue-1"] }],
    missingInformation: ["Synthetic duration remains unconfirmed."],
    followUps: ["What synthetic detail should be checked next?"],
    handoffs: [
      {
        targetMode: mode === "services" ? "forms" : "services",
        label: "Continue with a related mode",
        acceptedContext: { careSetting: "community" },
      },
    ],
  };
}

async function mockClinicalAsk(page: Page) {
  let requests = 0;
  await page.route("**/api/clinical-ask/stream", async (route: Route) => {
    requests += 1;
    const request = route.request().postDataJSON() as { mode: (typeof modes)[number][0] };
    const sections = modes.find(([id]) => id === request.mode)![2];
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body:
        frame({ type: "progress", stage: "catalogue", elapsedMs: 1 }) +
        frame({
          type: "context_suggestions",
          suggestions: [{ id: "setting", field: "careSetting", value: "community", status: "suggested" }],
        }) +
        frame({ type: "final", payload: { response: answered(request.mode, sections), feedback: null } }),
    });
  });
  return () => requests;
}

async function composer(page: Page) {
  return page.getByTestId("global-search-input").filter({ visible: true }).first();
}

async function openSubmittedModeDock(page: Page, mode: string) {
  await page.goto(`/?mode=${mode}&q=probe&run=1`);
}

async function clickClinicalAsk(page: Page, label: string) {
  const ask = page.getByRole("button", { name: `Ask ${label}`, exact: true });
  await expect(ask).toBeVisible();
  await expect(ask).toBeEnabled();
  await ask.click();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      ["http:", "https:"].includes(url.protocol) &&
      !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
    ) {
      await route.abort("blockedbyclient");
    } else await route.fallback();
  });
});

test("@critical hides Ask and Dictate on empty mode homes", async ({ page }) => {
  await page.goto("/?mode=differentials");
  await expect(page.getByTestId("global-search-input").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask Differentials", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dictate question for Differentials" })).toHaveCount(0);
});

test("@critical renders governed answers for all seven Clinical Ask modes without leaking input", async ({ page }) => {
  test.setTimeout(180_000);
  const requestCount = await mockClinicalAsk(page);
  for (const [mode, label, sections] of modes) {
    await page.goto(`/?mode=${mode}`);
    await expect(page.getByRole("button", { name: `Ask ${label}`, exact: true })).toHaveCount(0);
    await openSubmittedModeDock(page, mode);
    const input = await composer(page);
    await input.fill(syntheticQuestion);
    await clickClinicalAsk(page, label);
    const answer = page.getByLabel(`${label} answer`);
    await expect(answer).toBeVisible();
    const headings = await answer.locator("h3").evaluateAll((nodes) => nodes.map((node) => node.textContent));
    expect(headings.slice(0, sections.length)).toEqual([...sections]);
    await answer.getByText("Evidence and sources", { exact: true }).click();
    await expect(answer.getByRole("link", { name: /Synthetic catalogue source/ })).toHaveAttribute("href", "/services");
    await expect(answer.getByText(/needs review/i)).toBeVisible();
    await expect(answer.getByText("Missing information", { exact: true })).toBeVisible();
    await expect(answer.getByText("Conflicting evidence", { exact: true })).toBeVisible();
    await expect(answer).not.toContainText(forbiddenOutcomes);
    expect(page.url()).not.toContain(encodeURIComponent(syntheticQuestion));
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(
      syntheticQuestion,
    );
    await page.getByRole("button", { name: "Clear case" }).click();
  }
  expect(requestCount()).toBe(7);
});

test("@critical keeps dictated text reviewable and requires explicit Ask", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });
    class Recorder {
      static isTypeSupported() {
        return true;
      }
      state = "inactive";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { value: Recorder });
  });
  let transcriptionRequests = 0;
  await page.route("**/api/speech/transcribe", async (route) => {
    transcriptionRequests += 1;
    await route.fulfill({ json: { transcript: "Synthetic dictated presentation" } });
  });
  const askCount = await mockClinicalAsk(page);
  await page.goto("/?mode=services");
  await expect(page.getByRole("button", { name: "Dictate question for Services" })).toHaveCount(0);
  await openSubmittedModeDock(page, "services");
  await page.getByRole("button", { name: "Dictate question for Services" }).click();
  await page.getByRole("button", { name: "Stop recording" }).click();
  const input = await composer(page);
  await expect(input).toHaveValue("Synthetic dictated presentation");
  expect(askCount()).toBe(0);
  await input.fill("Synthetic dictated presentation, edited after review");
  await clickClinicalAsk(page, "Services");
  await expect(page.getByLabel("Services answer")).toBeVisible();
  expect(transcriptionRequests).toBe(1);
  expect(askCount()).toBe(1);
});

test("@critical remains accessible and within the viewport at required widths and preferences", async ({
  page,
}, testInfo) => {
  await mockClinicalAsk(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.emulateMedia({
      colorScheme: "dark",
      reducedMotion: "reduce",
      forcedColors: width === 320 ? "active" : "none",
    });
    await page.goto("/?mode=differentials");
    const homeInput = await composer(page);
    await homeInput.fill("Synthetic comparison presentation");
    await expect(page.getByRole("button", { name: "Ask Differentials", exact: true })).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    await openSubmittedModeDock(page, "differentials");
    const input = await composer(page);
    await input.fill("Synthetic comparison presentation");
    await clickClinicalAsk(page, "Differentials");
    await expect(page.getByLabel("Differentials answer")).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    await testInfo.attach(`axe-${width}`, { body: JSON.stringify(axe.violations), contentType: "application/json" });
    expect(axe.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
    await page.getByRole("button", { name: "Clear case" }).click();
  }
});
