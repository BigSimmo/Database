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
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function gotoApp(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

async function waitForDemoDashboardReady(page: Page) {
  await expect(page.getByLabel("Ask a question across indexed guidelines")).toBeEnabled();
  await expect(page.getByText("3 documents")).toBeAttached({ timeout: 30000 });
}

async function scrollDashboardToBottom(page: Page) {
  await page
    .locator("main")
    .first()
    .evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
}

async function expectMobileNavTarget(page: Page, label: string, hash: string, sectionText: string) {
  await page.getByRole("link", { name: label }).click();
  await expect(page.locator(`nav a[href="${hash}"]`)).toHaveAttribute("aria-current", "page");
  await expect(page.locator(hash)).toBeVisible();
  await expect(page.locator(hash)).toContainText(sectionText);
  await expectNoPageHorizontalOverflow(page);
}

async function openGuide(page: Page) {
  await scrollDashboardToBottom(page);
  const trigger = page.getByTestId("dashboard-guide-trigger");
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeVisible();
  await trigger.click({ force: true });

  const dialog = page.getByRole("dialog", { name: "Clinical KB guide" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Ask and verify")).toBeVisible();
  await expect(dialog.getByText("Top source and citations")).toBeVisible();
  await expect(dialog.getByText("Upload and indexing")).toBeVisible();
  await expect(dialog.getByText("Copying text")).toBeVisible();
  await expectNoPageHorizontalOverflow(page);
  return dialog;
}

test.describe("Clinical KB UI smoke coverage", () => {
  test.describe.configure({ timeout: 60000 });

  for (const viewport of dashboardViewports) {
    test(`dashboard loads without page overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoApp(page, "/");

      await expect(page.getByText("Clinical Guide")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Answer" })).toBeVisible();
      await expect(page.getByLabel("Ask a question across indexed guidelines")).toBeVisible();
      await expectNoPageHorizontalOverflow(page);
    });
  }

  test("demo answer flow reaches a source-backed answer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 820 });
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);

    const questionInput = page.getByLabel("Ask a question across indexed guidelines");
    await expect(questionInput).toBeEnabled();
    await expect(page.getByLabel("Open document scope and prompt controls")).toBeVisible();
    const question = "What toxicity safety-net symptoms should be reviewed for lithium?";
    await questionInput.click();
    await questionInput.pressSequentially(question);
    await expect(questionInput).toHaveValue(question);
    await expect(page.getByRole("button", { name: "Ask" })).toBeEnabled();
    await page.getByRole("button", { name: "Ask" }).click();

    await expect(page.getByLabel("Source-backed answer")).toBeVisible();
    await expect(page.getByTestId("answer-top-source-chip")).toBeVisible();
    await expect(page.getByTestId("answer-grounding-chip")).toBeVisible();
    await expect(page.getByText(/Synthetic demo only/i)).toBeVisible();
    await expect(
      page.getByText("Draft only; verify source first before pasting into the medical record.").first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Quotes, \d+ items?/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Images, \d+ items?/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sources, \d+ items?/ })).toBeVisible();

    const hierarchy = await page.evaluate(() => {
      const safety = document.querySelector('[data-testid="safety-findings-panel"]');
      const verify = document.querySelector('[data-testid="verify-source-strip"]');
      const copy = document.querySelector('[data-testid="copy-governance-strip"]');
      return {
        safetyTop: safety?.getBoundingClientRect().top ?? 9999,
        verifyTop: verify?.getBoundingClientRect().top ?? 9999,
        copyTop: copy?.getBoundingClientRect().top ?? 9999,
      };
    });
    expect(hierarchy.safetyTop).toBeLessThan(hierarchy.verifyTop);
    expect(hierarchy.verifyTop).toBeLessThan(hierarchy.copyTop);

    const headingMetrics = await page.getByTestId("answer-section-heading").evaluate((element) => {
      const icon = element.querySelector("[data-section-heading-icon]");
      const title = element.querySelector("h2");
      const actions = element.querySelector('[data-testid="answer-header-actions"]');
      const iconRect = icon?.getBoundingClientRect();
      const titleRect = title?.getBoundingClientRect();
      const actionsRect = actions?.getBoundingClientRect();
      return {
        iconTitleCenterDelta:
          iconRect && titleRect
            ? Math.abs(iconRect.top + iconRect.height / 2 - (titleRect.top + titleRect.height / 2))
            : 999,
        actionHeight: actionsRect?.height ?? 999,
      };
    });
    expect(headingMetrics.iconTitleCenterDelta).toBeLessThanOrEqual(3);
    expect(headingMetrics.actionHeight).toBeLessThanOrEqual(34);

    await expectMobileNavTarget(page, "Quotes", "#quotes", "Source quotes");
    await expectMobileNavTarget(page, "Images", "#images", "Source diagrams");
    await expectMobileNavTarget(page, "Sources", "#sources", "Source passages");

    await page.getByLabel("Open document scope and prompt controls").click();
    const mobileScopePopover = page.getByTestId("mobile-scope-popover");
    await expect(mobileScopePopover).toBeVisible();
    const popoverMetrics = await mobileScopePopover.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        maxHeight: style.maxHeight,
        overflowY: style.overflowY,
        viewportHeight: window.innerHeight,
      };
    });
    expect(popoverMetrics.overflowY).toBe("auto");
    expect(popoverMetrics.maxHeight).not.toBe("none");
    expect(popoverMetrics.height).toBeLessThanOrEqual(Math.ceil(popoverMetrics.viewportHeight * 0.72));
    await expectNoPageHorizontalOverflow(page);
  });

  test("document viewer puts pinned evidence before the PDF preview on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await gotoApp(
      page,
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );

    const evidence = page.locator('[data-testid="pinned-source-evidence"]:visible').first();
    const preview = page.getByTestId("pdf-preview");
    const toolbar = page.getByTestId("pdf-toolbar");
    const pdfScroller = page.getByTestId("pdf-canvas-scroll");

    await expect(evidence).toBeVisible();
    await expect(preview).toBeVisible();
    await expect(toolbar).toBeVisible({ timeout: 30000 });

    const evidenceBox = await evidence.boundingBox();
    const previewBox = await preview.boundingBox();
    const indexedTextBox = await page.getByText("Indexed page text").boundingBox();
    const imagesBox = await page.getByText("Images and captions").boundingBox();

    expect(evidenceBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(indexedTextBox).not.toBeNull();
    expect(imagesBox).not.toBeNull();
    expect(evidenceBox!.y).toBeLessThan(previewBox!.y);
    expect(indexedTextBox!.y).toBeLessThan(previewBox!.y);
    expect(indexedTextBox!.y).toBeLessThan(imagesBox!.y);

    const mobilePdfStyles = await toolbar.evaluate((element) => ({
      position: window.getComputedStyle(element).position,
    }));
    expect(mobilePdfStyles.position).toBe("static");

    await expect(pdfScroller).toBeVisible();
    const fitWidthScrollStyles = await pdfScroller.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        overflowX: style.overflowX,
        touchAction: style.touchAction,
      };
    });
    expect(fitWidthScrollStyles.overflowX).toBe("hidden");
    expect(fitWidthScrollStyles.touchAction).toContain("pan-y");
    await expectNoPageHorizontalOverflow(page);
  });

  test("document viewer failed preview exposes retry recovery", async ({ page }) => {
    await page.route(/\/api\/documents\/[^/]+\/signed-url(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 503,
        json: { error: "Source preview could not be loaded." },
      });
    });
    await page.setViewportSize({ width: 390, height: 820 });
    await gotoApp(
      page,
      "/documents/11111111-1111-4111-8111-111111111111?page=1&chunk=44444444-4444-4444-8444-444444444442",
    );

    await expect(page.getByText("Source preview could not be loaded.")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Retry preview" })).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test("setup status endpoint returns non-secret checklist state", async ({ request }) => {
    const response = await request.get("/api/setup-status");
    expect(response.ok()).toBe(true);

    const payload = await response.json();
    expect(typeof payload.demoMode).toBe("boolean");
    expect(payload.checks).toHaveLength(4);
    expect(payload.checks.map((check: { id: string }) => check.id)).toEqual(["env", "schema", "openai", "worker"]);
    expect(JSON.stringify(payload)).not.toMatch(/sk-|service_role|eyJ/i);
  });

  test("upload drawer exposes setup checklist and explicit upload labels", async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 820 });
    await gotoApp(page, "/");
    await waitForDemoDashboardReady(page);
    await expect(page.getByLabel("Ask a question across indexed guidelines")).toBeEnabled();

    const uploadDrawer = page.locator("details").filter({ hasText: "Upload and indexing" }).first();
    await scrollDashboardToBottom(page);
    await uploadDrawer.scrollIntoViewIfNeeded();
    await uploadDrawer.locator("summary").click({ force: true });

    await expect(uploadDrawer.getByText("First-run setup checklist")).toBeVisible();
    await expect(uploadDrawer.getByText(".env.local configured")).toBeVisible();
    await expect(uploadDrawer.getByText("supabase/schema.sql applied")).toBeVisible();
    await expect(uploadDrawer.getByText("OpenAI API key available")).toBeVisible();
    await expect(uploadDrawer.getByText("npm run worker running")).toBeVisible();
    await expect(uploadDrawer.getByText("Document title optional")).toBeVisible();
    await expect(uploadDrawer.getByText("Guideline file required")).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  for (const viewport of [
    { name: "mobile", width: 390, height: 820 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    test(`guide opens and dismisses at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoApp(page, "/");
      await waitForDemoDashboardReady(page);

      const dialog = await openGuide(page);
      await dialog.getByRole("button", { name: "Close guide" }).click();
      await expect(dialog).toBeHidden();

      const reopenedDialog = await openGuide(page);
      await page.keyboard.press("Escape");
      await expect(reopenedDialog).toBeHidden();
      await expectNoPageHorizontalOverflow(page);
    });
  }
});
