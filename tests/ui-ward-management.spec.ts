import { expect, test, type Page } from "playwright/test";

const PATH = "/ward-management";

async function gotoWardFlow(page: Page) {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="ward-management-console"]:visible')).toHaveCount(1, { timeout: 15_000 });
  // The console is visible from the first paint, but this dev environment settles the route
  // shortly after (a second same-URL navigation event follows the first). A click issued in
  // that window can be lost even though every element is already visible and stable, so wait
  // for network activity to quiesce — the one reliable, non-arbitrary signal available here —
  // before the first interaction.
  await page.waitForLoadState("networkidle");
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe("Ward Flow command view", () => {
  test.describe.configure({ timeout: 45_000 });

  test("supports role-aware queue review and human-confirmed destination choice", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await gotoWardFlow(page);

    const command = page.locator('[data-testid="ward-management-console"]:visible');
    await expect(command.getByRole("heading", { level: 1, name: "Ward Flow" })).toBeVisible();
    await expect(command.getByRole("complementary", { name: "Urgency queue" })).toBeVisible();
    await expect(command.getByLabel("Action inbox")).toBeVisible();
    await expect(command.getByLabel("Patient movement stages")).toBeVisible();
    // WF-001 is first in the default flow-role queue; it has no accepted or referred unit yet,
    // so the dock falls back to the top eligible destination, RPH Adult Secure.
    await expect(command.getByLabel("AI destination review for WF-001")).toContainText("RPH Adult Secure");
    await expect(command.getByLabel("AI destination review for WF-001")).toContainText("Eligibility 8/8");

    // Only WF-007 and WF-015 are owned by "Ward nurse in charge"; a stable sort brings the
    // first of them to the top of the queue when the ward role is selected.
    await command.getByLabel("Current role").selectOption("ward");
    await expect(
      command.getByRole("complementary", { name: "Urgency queue" }).locator('[data-testid^="ward-patient-"]').first(),
    ).toHaveAttribute("data-testid", "ward-patient-WF-007");

    await command.getByLabel("Current role").selectOption("flow");
    await command.getByTestId("ward-patient-WF-002").click();
    // WF-002 already carries a live referral to FSH Older Adult.
    const review = command.getByLabel("AI destination review for WF-002");
    await expect(review).toContainText("FSH Older Adult");
    await review.getByRole("button", { name: /RPH Older Adult/ }).click();
    await expect(review).toContainText("RPH Older Adult");
    await review.getByRole("button", { name: "Review & confirm" }).click();
    await expect(review.getByRole("button", { name: "Confirmed", exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
  });

  test("collapses the queue, opens the action inbox, and reaches the patient workspace", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await gotoWardFlow(page);

    await page.getByRole("button", { name: "Collapse queue" }).click();
    await expect(page.getByRole("complementary", { name: "Collapsed urgency queue" })).toBeVisible();
    await page.getByRole("button", { name: "Expand urgency queue" }).click();

    await page.getByRole("button", { name: /View inbox/ }).click();
    // The inbox is built entirely from real movement data: WF-001 has a breached legal-form
    // deadline, which is the first computed item.
    await expect(page.getByRole("dialog", { name: "Action inbox" })).toContainText("Legal timing breached");
    await page.getByRole("dialog", { name: "Action inbox" }).getByRole("button", { name: /Close/ }).click();

    await page.getByRole("link", { name: /Open full patient workspace/ }).click();
    await expect(page).toHaveURL(/\/ward-management\/patients\/WF-001$/);
    await expect(page.getByRole("heading", { level: 1, name: "WF-001 movement workspace" })).toBeVisible();
    await page.getByRole("button", { name: "Legal & forms" }).click();
    await expect(page.getByTestId("ward-patient-workspace")).toContainText("Referred for psychiatric examination");
    await page.getByRole("button", { name: "Transport" }).click();
    await expect(page.getByTestId("ward-patient-workspace")).toContainText("Transport chain");
  });

  test("opens every Ward Flow mode and supports a human-confirmed constellation match", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await gotoWardFlow(page);

    await page.getByRole("link", { name: "Constellation" }).click();
    await expect(page).toHaveURL(/\/ward-management\/constellation$/);
    await page.waitForLoadState("networkidle");
    const constellation = page.getByTestId("ward-constellation");
    await expect(constellation.getByRole("heading", { name: "Statewide mental health flow" })).toBeVisible();
    await constellation.getByRole("button", { name: /2\. WF-002/ }).click();
    const review = page.getByLabel("AI best-fit review for WF-002");
    await expect(review).toContainText("Voluntary");
    await review.getByRole("button", { name: "Review & confirm" }).click();
    await expect(review.getByRole("button", { name: "Match confirmed" })).toBeVisible();

    const modes = [
      ["Network", "ward-mode-network"],
      ["Priority queue", "ward-mode-queue"],
      ["Capacity", "ward-mode-capacity"],
      ["Movements", "ward-mode-movements"],
      ["Exceptions", "ward-mode-exceptions"],
      ["Transport", "ward-mode-transport"],
      ["Governance", "ward-mode-governance"],
    ] as const;
    for (const [linkName, testId] of modes) {
      await page.getByRole("link", { name: linkName }).click();
      await expect(page.getByTestId(testId)).toBeVisible();
      await expectNoPageOverflow(page);
    }
  });

  test("routes a selected movement across the network diagram and explains the shortlist", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto("/ward-management/network", { waitUntil: "domcontentloaded" });

    const network = page.getByTestId("ward-network-view");
    await expect(network).toBeVisible({ timeout: 15_000 });

    // Connector paths are drawn by a client layout effect, so their presence is the
    // hydration signal: before it fires, queue clicks would be swallowed.
    await expect(network.locator("svg path[marker-end]").first()).toBeAttached({ timeout: 15_000 });

    // Pipeline counts are derived from the movement records, so they must total the queue.
    await expect(network.getByRole("region", { name: "Movement pipeline" })).toContainText("Placement requested");

    // WF-001 is first in the queue; its eligible shortlist is RPH, SCGH and FSH Adult Secure/Open.
    const shortlist = network.getByRole("complementary", { name: "Explainable shortlist" });
    await expect(shortlist).toContainText("WF-001");
    await expect(shortlist.getByRole("columnheader", { name: /RPH Adult Secure/ })).toBeVisible();
    await expect(shortlist.getByRole("row", { name: /Eligibility/ })).toContainText("8/8");
    await expect(shortlist).toContainText("No automatic allocation");

    // Shortlisted services are marked as routed on the canvas; Armadale is not in WF-001's
    // eligible top three.
    await expect(network.getByTestId("ward-network-card-rph-adult-secure")).toHaveAttribute("data-routed", "true");
    await expect(network.getByTestId("ward-network-card-arm-adult-open")).not.toHaveAttribute("data-routed", "true");

    // Kununurra is one of the services with no available beds.
    await expect(network.getByTestId("ward-network-card-kun-adult-open")).toContainText("Kununurra");

    // Selecting another movement re-routes the diagram and swaps the shortlist. WF-002 is
    // South Metro; Fremantle Older Adult is its one same-service eligible candidate.
    await network.getByTestId("ward-network-queue-WF-002").click();
    await expect(shortlist).toContainText("WF-002");
    await expect(network.getByTestId("ward-network-card-fre-older-adult")).toHaveAttribute("data-routed", "true");
    await expect(shortlist.getByRole("row", { name: /Catchment fit/ })).toContainText("Escalation");

    // A service card opens its own detail block.
    await network.getByTestId("ward-network-card-fre-older-adult").click();
    await expect(shortlist.getByRole("region", { name: "Selected service detail" })).toContainText("FRE Older Adult");
    await expectNoPageOverflow(page);
  });

  test("provides a queue-first phone fallback without page overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 820 });
    await gotoWardFlow(page);

    const queue = page.getByRole("complementary", { name: "Urgency queue" });
    await expect(queue).toBeVisible();
    await expect(page.getByTestId("ward-patient-WF-001")).toBeVisible();
    await page.getByLabel("Current role").selectOption("ward");
    await expect(page.getByTestId("ward-patient-WF-007")).toBeVisible();
    await expectNoPageOverflow(page);
  });

  test("retains its operating structure in dark, forced-colours, and print modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoWardFlow(page);
    await expect(page.getByLabel("AI destination review for WF-001")).toBeVisible();

    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.getByRole("complementary", { name: "Urgency queue" })).toBeVisible();
    await expect(page.getByTestId("ward-unit-rph-adult-secure")).toBeVisible();

    await page.emulateMedia({ colorScheme: "light", forcedColors: "none", media: "print" });
    await expect(page.locator('section[aria-label="AI destination review for WF-001"]:visible')).toBeVisible();
  });
});
