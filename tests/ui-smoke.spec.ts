import { expect, test, type Page } from "playwright/test";

const dashboardViewports = [
  { name: "small-mobile", width: 320, height: 720 },
  { name: "standard-mobile", width: 375, height: 760 },
  { name: "large-mobile", width: 414, height: 820 },
  { name: "tablet", width: 768, height: 900 },
  { name: "laptop", width: 1280, height: 900 },
  { name: "mobile-landscape", width: 667, height: 375 },
] as const;

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    );
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe("Clinical KB UI smoke coverage", () => {
  for (const viewport of dashboardViewports) {
    test(`dashboard loads without page overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");

      await expect(page.getByText("Clinical Guide")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Answer" })).toBeVisible();
      await expect(page.getByLabel("Ask a question across indexed guidelines")).toBeVisible();
      await expectNoPageHorizontalOverflow(page);
    });
  }

  test("demo answer flow reaches a source-backed answer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await page.goto("/");

    const questionInput = page.getByLabel("Ask a question across indexed guidelines");
    await expect(questionInput).toBeEnabled();
    await questionInput.click();
    await questionInput.fill("What toxicity safety-net symptoms should be reviewed for lithium?");
    await expect(questionInput).toHaveValue("What toxicity safety-net symptoms should be reviewed for lithium?");
    await expect(page.getByRole("button", { name: "Ask" })).toBeEnabled();
    await page.getByRole("button", { name: "Ask" }).click();

    await expect(page.getByText("Source-backed")).toBeVisible();
    await expect(page.getByText(/Synthetic demo only/i)).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test("document viewer puts pinned evidence before the PDF preview on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );

    const evidence = page.locator('[data-testid="pinned-source-evidence"]:visible').first();
    const preview = page.getByTestId("pdf-preview");

    await expect(evidence).toBeVisible();
    await expect(preview).toBeVisible();

    const evidenceBox = await evidence.boundingBox();
    const previewBox = await preview.boundingBox();

    expect(evidenceBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(evidenceBox!.y).toBeLessThan(previewBox!.y);
    await expectNoPageHorizontalOverflow(page);
  });

  test("document viewer failed preview exposes retry recovery", async ({ page }) => {
    await page.route(/\/api\/documents\/[^/]+\/signed-url$/, async (route) => {
      await route.fulfill({
        status: 503,
        json: { error: "Mock signed URL failure" },
      });
    });
    await page.setViewportSize({ width: 390, height: 820 });
    await page.goto(
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );

    await expect(page.getByText("Mock signed URL failure")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry preview" })).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test("setup status endpoint returns non-secret checklist state", async ({ request }) => {
    const response = await request.get("/api/setup-status");
    expect(response.ok()).toBe(true);

    const payload = await response.json();
    expect(typeof payload.demoMode).toBe("boolean");
    expect(payload.checks).toHaveLength(4);
    expect(payload.checks.map((check: { id: string }) => check.id)).toEqual([
      "env",
      "schema",
      "openai",
      "worker",
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/sk-|service_role|eyJ/i);
  });

  test("upload drawer exposes setup checklist and explicit upload labels", async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 820 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Ask a question across indexed guidelines")).toBeEnabled();

    const uploadDrawer = page.locator("details").filter({ hasText: "Upload and indexing" }).first();
    await uploadDrawer.scrollIntoViewIfNeeded();
    await uploadDrawer.locator("summary").click();
    await expect(uploadDrawer).toHaveAttribute("open", "");

    await expect(uploadDrawer.getByText("First-run setup checklist")).toBeVisible();
    await expect(uploadDrawer.getByText(".env.local configured")).toBeVisible();
    await expect(uploadDrawer.getByText("supabase/schema.sql applied")).toBeVisible();
    await expect(uploadDrawer.getByText("OpenAI API key available")).toBeVisible();
    await expect(uploadDrawer.getByText("npm run worker running")).toBeVisible();
    await expect(uploadDrawer.getByText("Document title optional")).toBeVisible();
    await expect(uploadDrawer.getByText("Guideline file required")).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });
});
