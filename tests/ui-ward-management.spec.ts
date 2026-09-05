import { expect, test, type Page } from "playwright/test";

import { WARD_VIEWS } from "@/components/ward-management/ward-nav";

const PATH = "/mockups/ward-flow";

async function gotoWardFlow(page: Page) {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="ward-coordinator"]:visible')).toHaveCount(1, { timeout: 15_000 });
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

/**
 * `document.documentElement` can never report an overflow on the coordinator route — `.screen`
 * sets `overflow: hidden` — so `expectNoPageOverflow` alone cannot catch a track inside the
 * region grid running wider than its box (Task 3 review Important 1). Only meaningful on
 * /mockups/ward-flow itself, where the region grid testid exists.
 */
async function expectNoRegionGridOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="ward-coordinator-region-grid"]');
    if (!grid) return null;
    return grid.scrollWidth - grid.clientWidth;
  });
  expect(overflow).not.toBeNull();
  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe("@mockup Ward Flow command view", () => {
  test.describe.configure({ timeout: 45_000 });

  // "supports role-aware queue review and human-confirmed destination choice" and "collapses
  // the queue, opens the action inbox, and reaches the patient workspace" asserted against
  // WardManagementConsole, which Task 3 stopped rendering at /mockups/ward-flow. That component is
  // unreferenced and Task 9 deletes it; the equivalent coverage on the coordinator screen has no
  // home yet. See the fixme placeholders in tests/ui-ward-coordinator.spec.ts.
  //
  // Task 9 retires Constellation into the coordinator screen. Its own behaviour (the
  // ward-constellation gate check, the WF-002 confirm journey) already has a home: the confirm
  // journey and the failing-gate icon guard both live in tests/ui-ward-coordinator.spec.ts
  // ("shows a failing gate as a failure and never auto-allocates"), so the Constellation step is
  // removed here rather than repointed — leaving it would assert a route that no longer exists.

  /**
   * This test performs one page load plus seven sequential route navigations. Against a dev
   * server, which compiles each route on demand, that costs ~3.8 s warm and ~15.2 s cold,
   * measured at HEAD `12f17b13a`. The failures previously recorded here as a flake are
   * consistent with budget exhaustion on a machine running the same gate ~6x slower — that
   * surfaces at whichever mode link the clock happens to expire on, and it is not a weakening
   * of any assertion here. CI runs this spec against a production build, which
   * scripts/run-playwright.mjs builds and serves, so no on-demand compilation happens there and
   * the larger allowance below costs CI nothing.
   *
   * What the larger allowance does cost: playwright.config.ts sets no actionTimeout or
   * navigationTimeout, so a genuinely hung navigation in this one test now burns 120 s rather
   * than 45 s before failing — worst case about +75 s on a Chromium-only PR shard and about
   * +225 s across the three browsers of verify:release, both well inside those jobs' budgets.
   */
  test("opens every Ward Flow mode", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1024 });
    await gotoWardFlow(page);

    // This only proves every remaining mode link still opens its route; per-mode behaviour is
    // covered by each mode's own tests elsewhere.
    //
    // MERGE 01 (2026-09-05): "Priority queue" and "Exceptions" both used to answer "why is this
    // person still waiting?" from two different lenses. `DelaysScreen` now answers that question
    // once, at `/delays`, and the `queue`/`exceptions` mode links collapsed into a single "Delays"
    // link (see WARD_VIEWS in ward-nav.ts). `/delays` is a standalone route rather than a
    // WardModeWorkspace mode, so it carries its own `data-testid="ward-delays-page"` rather than a
    // `ward-mode-*` id.
    // ⚠️ LABELS COME FROM `WARD_VIEWS`, NOT FROM THIS FILE. A hand-listed label is a page-design
    // literal, and these screens are redesigned repeatedly — MERGE 01 alone broke eight assertions
    // across the suite, every one of them a count, a label or a route somebody had typed into a
    // test. Deriving the labels means a rename carries this test with it, while it still catches
    // the thing that matters: the rail rendering something other than what `ward-nav.ts` declares.
    //
    // Only the id-to-testid mapping stays local, because a test hook is a test concern and is
    // genuinely not navigation data. `queue` maps to `ward-delays-page` because MERGE 01 pointed
    // that entry at `/delays`, a standalone route rather than a WardModeWorkspace mode.
    const testIdByView: Record<string, string> = {
      network: "ward-mode-network",
      queue: "ward-delays-page",
      capacity: "ward-mode-capacity",
      movements: "ward-mode-movements",
      transport: "ward-mode-transport",
      governance: "ward-mode-governance",
    };
    // "command" is the page this test already starts on, so it has no link to click here.
    const navigable = WARD_VIEWS.filter((view) => view.id !== "command");
    // Anti-vacuity, and it fails LOUDLY on the one change that would otherwise skip a screen: add a
    // view to WARD_VIEWS and forget its testid, and this names it rather than quietly walking a
    // shorter list.
    const unmapped = navigable.filter((view) => testIdByView[view.id] === undefined).map((view) => view.id);
    expect(unmapped, `WARD_VIEWS gained a destination with no testid mapping: ${unmapped.join(", ")}`).toEqual([]);
    expect(navigable.length, "no navigable views — the loop below would prove nothing").toBeGreaterThan(3);
    const modes = navigable.map((view) => [view.label, testIdByView[view.id]] as const);
    for (const [linkName, testId] of modes) {
      await page.getByRole("link", { name: linkName }).click();
      await expect(page.getByTestId(testId)).toBeVisible({ timeout: 15_000 });
      await expectNoPageOverflow(page);
    }
  });

  /**
   * Task 9 review Critical 1: the eight mode links must retain the 3rem/48px tap-target floor on
   * the shortest supported phone viewport. The phone sidebar now lives in a drawer, so open the
   * owning menu before measuring the same shared links.
   *
   * MERGE 01 (2026-09-05): down to seven links. "Priority queue" and "Exceptions" collapsed into
   * one "Delays" link when the three screens behind them (queue, exceptions, escalation) folded
   * into `/delays` — see WARD_VIEWS in ward-nav.ts. The count below moved from 8 to 7 with it.
   */
  test("keeps every rail mode link at the 3rem tap-target floor on a short, narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await gotoWardFlow(page);
    await page.getByRole("button", { name: "Open Ward Flow menu" }).click();

    const nav = page.getByRole("navigation", { name: "Ward Flow views" });
    const links = await nav.getByRole("link").all();
    // Derived, not typed: this asserts the rail renders what ward-nav.ts declares, which stays
    // true through any rename or reorder. A literal here breaks on every redesign.
    expect(links.length).toBe(WARD_VIEWS.length);
    for (const link of links) {
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(48);
      expect(box!.width).toBeGreaterThanOrEqual(48);
    }
  });

  test("routes a selected movement across the network diagram and explains the shortlist", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto("/mockups/ward-flow/network", { waitUntil: "domcontentloaded" });

    const network = page.getByTestId("ward-network-view");
    await expect(network).toBeVisible({ timeout: 15_000 });

    // Connector paths are drawn by a client layout effect, so their presence is the
    // hydration signal: before it fires, queue clicks would be swallowed.
    await expect(network.locator("svg path[marker-end]").first()).toBeAttached({ timeout: 15_000 });

    // Pipeline counts are derived from the movement records, so they must total the queue.
    await expect(network.getByRole("region", { name: "Movement pipeline" })).toContainText("Placement requested");

    // WF-001 is first in the queue; its eligible shortlist is RPH Adult Secure, SCGH Adult Open
    // and ARM Adult Open. FSH Adult Secure is no longer in it: WF-001 is a Female Adult movement
    // and FSH Adult Secure is Male only, so the sex_designation gate added in 6cc80c774 excludes
    // it and ARM Adult Open (next in unit order) takes the freed slot.
    const shortlist = network.getByRole("complementary", { name: "Explainable shortlist" });
    await expect(shortlist).toContainText("WF-001");
    await expect(shortlist.getByRole("columnheader", { name: /RPH Adult Secure/ })).toBeVisible();
    // Eligibility is a binary verdict, not a score: gates are not commensurable, so no row
    // ever renders a "N of M passed" fraction.
    await expect(shortlist.getByRole("row", { name: /Eligibility/ })).toContainText("Eligible");
    // WF-001 has no recorded destination, so none of its three candidates — including the
    // first-ranked one — may inherit its (nonexistent) transport job.
    await expect(shortlist.getByRole("row", { name: /Transport state/ })).toContainText("Not yet booked");
    await expect(shortlist.getByRole("row", { name: /Transport state/ })).not.toContainText("Not yet requested");
    await expect(shortlist).toContainText("No automatic allocation");

    // Shortlisted services are marked as routed on the canvas. Armadale IS in WF-001's eligible
    // top three and FSH Adult Secure is NOT: FSH Adult Secure is a Male-only ward, WF-001 is a
    // Female patient, and the sex_designation eligibility gate (6cc80c774) correctly excludes it
    // — this assertion is proving a clinical-safety gate works, not tolerating a broken one.
    await expect(network.getByTestId("ward-network-card-rph-adult-secure")).toHaveAttribute("data-routed", "true");
    await expect(network.getByTestId("ward-network-card-arm-adult-open")).toHaveAttribute("data-routed", "true");
    await expect(network.getByTestId("ward-network-card-fsh-adult-secure")).not.toHaveAttribute("data-routed", "true");

    // Kununurra is one of the services with no available beds.
    await expect(network.getByTestId("ward-network-card-kun-adult-open")).toContainText("Kununurra");

    // Selecting another movement re-routes the diagram and swaps the shortlist. WF-002 is
    // South Metro; Fremantle Older Adult is its one same-service eligible candidate.
    await network.getByTestId("ward-network-queue-WF-002").click();
    await expect(shortlist).toContainText("WF-002");
    await expect(network.getByTestId("ward-network-card-fre-older-adult")).toHaveAttribute("data-routed", "true");
    // This row compares health services against the *origin* ED, not the patient's catchment
    // (catchment is where a patient lives, not where they presented) — named for what it
    // actually measures rather than implying a judgement the model cannot make yet.
    //
    // Phase 8 Task 6 renamed the cells from "Best"/"Escalation" to "Same health service"/
    // "Different health service", because "Best" read as the system's opinion about which bed
    // this person should have. "Different health service" is asserted rather than "Same health
    // service" deliberately: the row header already contains the words "Same health service", so
    // asserting those would pass against the header alone and prove nothing about any cell.
    await expect(shortlist.getByRole("row", { name: /Same health service as origin/ })).toContainText(
      "Different health service",
    );

    // A service card opens its own detail block.
    await network.getByTestId("ward-network-card-fre-older-adult").click();
    await expect(shortlist.getByRole("region", { name: "Selected service detail" })).toContainText("FRE Older Adult");
    await expectNoPageOverflow(page);
  });

  test("provides a queue-first phone fallback without page overflow", async ({ page }) => {
    // The coordinator shell's own responsibility is not overflowing and keeping the priority
    // queue reachable at the narrowest supported width (320px, not the 390px this test used
    // against WardManagementConsole). The full phone composition — hiding the diagram column,
    // one-tap confirm — belongs to Task 8; this only proves the frame itself does not break.
    await page.setViewportSize({ width: 320, height: 820 });
    await gotoWardFlow(page);

    await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
    await expectNoPageOverflow(page);
    await expectNoRegionGridOverflow(page);
  });

  // MERGE 01 (2026-09-05): this test is about the shared WardModeWorkspace chrome (sidebar hidden,
  // brand still visible) at tablet width, not about any one mode's content. It used to load
  // /mockups/ward-flow/queue for that chrome, but /queue now redirects to /delays, which is a
  // standalone route with none of this chrome (no WardModeWorkspace, no header, no sidebar) — so
  // this test is retargeted to a mode that still has it. /capacity survives the fold and its
  // <h1> reads "Capacity" (modeCopy.capacity.title in ward-management-modes.tsx), so it stands in
  // for "Priority queue" here.
  test("keeps the header brand visible at tablet width when the remembered panel is hidden", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 900 });
    await page.addInitScript(() => {
      window.localStorage.setItem("ward-flow-sidebar-collapsed", "0");
    });
    await page.goto("/mockups/ward-flow/capacity", { waitUntil: "domcontentloaded" });

    const header = page.locator("header").filter({ has: page.getByRole("heading", { name: "Capacity" }) });
    const sidebar = page.getByRole("complementary", { name: "Ward Flow sidebar", includeHidden: true });
    await expect(sidebar).toBeAttached({ timeout: 15_000 });
    await expect(sidebar).toBeHidden();
    await expect(header.getByText("Ward Flow", { exact: true })).toBeVisible();
  });

  // MERGE 01 (2026-09-05): /queue now redirects to /delays. Left unchanged deliberately — the
  // fixed-bar link it checks lives in the shared ClinicalRail, which DelaysScreen still mounts, so
  // that assertion holds; the "Priority queue" heading filter below now matches no header on this
  // page, which is why the header-hidden assertion still passes too. Noted so the path isn't
  // misread as still exercising the queue mode.
  test("uses its fixed bar as the sole Ward Flow brand on phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 820 });
    await page.goto("/mockups/ward-flow/queue", { waitUntil: "domcontentloaded" });

    const header = page.locator("header").filter({ has: page.getByRole("heading", { name: "Priority queue" }) });
    await expect(page.getByRole("link", { name: "Ward Flow", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(header.getByText("Ward Flow", { exact: true })).toBeHidden();
  });

  test("retains its operating structure in dark, forced-colours, and print modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoWardFlow(page);
    await expect(page.getByRole("region", { name: "Emergency department pressure" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
    await expect(page.getByTestId("ward-coordinator-governance")).toBeVisible();

    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.getByRole("region", { name: "Emergency department pressure" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
    await expect(page.getByTestId("ward-coordinator-governance")).toBeVisible();

    await page.emulateMedia({ colorScheme: "light", forcedColors: "none", media: "print" });
    await expect(page.locator('[data-testid="ward-coordinator-governance"]:visible')).toBeVisible();
  });
});
