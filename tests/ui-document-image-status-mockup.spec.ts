import { expect, test, type Page } from "playwright/test";

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return documentWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

test("image-only document tables use a compact status without the redundant warning panel @mockup", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/mockups/document-image-status", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("document-image-status-fixture")).toBeVisible();

  const status = page.getByTestId("source-image-only-status");
  await expect(status).toBeVisible();
  await expect(status).toContainText("Source image only");
  await expect(page.getByText("Verify table formatting against the source.")).toHaveCount(0);
  await expect(page.getByText("No reliable generated table was available; use the source image.")).toHaveCount(0);
  const phoneStatusBox = await status.boundingBox();
  expect(phoneStatusBox).not.toBeNull();
  expect(phoneStatusBox!.height).toBeLessThanOrEqual(28);
  await expectNoPageHorizontalOverflow(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(status).toBeVisible();
  const desktopStatusBox = await status.boundingBox();
  expect(desktopStatusBox).not.toBeNull();
  expect(desktopStatusBox!.height).toBeLessThanOrEqual(28);
  await expectNoPageHorizontalOverflow(page);
});
