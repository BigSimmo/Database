import { expect, test, type Locator, type Page } from "playwright/test";

import { candidateReason, eligibleCandidates } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import { PARALLEL_REFERRAL_CAP } from "@/components/ward-management/ward-model";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

async function gotoCoordinator(page: Page) {
  await page.goto("/ward-management", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
  // The console is visible from the first paint, but this dev environment settles the route
  // shortly after (a second same-URL navigation event follows the first). A click issued in
  // that window can be lost even though every element is already visible and stable, so wait
  // for network activity to quiesce — the one reliable, non-arbitrary signal available here —
  // before the first interaction. Mirrors `gotoWardFlow` in ui-ward-management.spec.ts (Task 4
  // review Important 6: a retry loop around the click was masking this instead of fixing it).
  await page.waitForLoadState("networkidle");
}

/**
 * Resolves a movement id off a real, currently-rendered queue row rather than trusting whatever
 * the test author expected to be there — the same reasoning `movementById` itself documents
 * (never fall back to a different record on a miss).
 */
function requireMovement(movementId: string | undefined | null): Movement {
  const movement = movementId ? movementById(movementId) : undefined;
  if (!movement) throw new Error(`Fixture is missing movement ${String(movementId)}`);
  return movement;
}

/**
 * Pins the diagram's routed set to the SELECTED MOVEMENT'S OWN shortlist identity — not merely
 * its size. `eligibleCandidates` is computed independently here, against the same real fixture
 * the app renders against, so a hard-coded routed set of the wrong units (or the brief's own
 * tautological `toHaveCount(await routed.count())`, which compares a value to itself and passes
 * at any count including zero) both fail this. Called for two different movements with two
 * different shortlists in the main diagram test (review Important 3 — a single-movement proof
 * only rules out a hard-coded set that happens to match that one movement).
 *
 * Also asserts route connectors are counted and distinguished from demand connectors via
 * `data-connector-kind` (review Important 4) — deleting every route connector while leaving the
 * demand connectors alone must turn this red, proven manually against the pre-fix component
 * before this assertion was accepted (see the task report).
 */
async function assertRoutedMatchesShortlist(diagram: Locator, movementId: string) {
  const movement = requireMovement(movementId);
  const shortlist = eligibleCandidates(movement, NOW_ANCHOR, PARALLEL_REFERRAL_CAP);
  const expectedUnitIds = shortlist.map((candidate) => candidate.unit.id).sort();

  const routed = diagram.locator('[data-routed="true"]');
  const routedCount = await routed.count();
  expect(routedCount, `${movementId}: routed count`).toBeGreaterThan(0);
  expect(routedCount, `${movementId}: routed count vs PARALLEL_REFERRAL_CAP`).toBeLessThanOrEqual(
    PARALLEL_REFERRAL_CAP,
  );
  const routedUnitIds = (await routed.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid"))))
    .map((testId) => String(testId).replace("ward-diagram-unit-", ""))
    .sort();
  expect(routedUnitIds, `${movementId}: routed unit identity`).toEqual(expectedUnitIds);

  const routeConnectors = diagram.locator('svg path[data-connector-kind="route"]');
  await expect(routeConnectors, `${movementId}: route connector count`).toHaveCount(routedCount);

  return { movement, shortlist };
}

/**
 * `.screen` sets `overflow: hidden`, so `document.documentElement` can never report an
 * overflow regardless of what breaks inside it — measuring the document was a test that could
 * not fail (Task 3 review Important 1). The region grid is the element whose track widths
 * actually constrain the five-region layout, so it is the element whose scroll box has to stay
 * within its client box.
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

test.describe("Ward Flow coordinator screen", () => {
  test.describe.configure({ timeout: 45_000 });

  test("presents the five coordination regions", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    await expect(page.getByRole("region", { name: "Emergency department pressure" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Statewide flow" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Explainable shortlist" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Exceptions/ })).toBeVisible();

    await expectNoRegionGridOverflow(page);
  });

  // The equivalent coverage for these two lived on WardManagementConsole, which Task 3 stopped
  // rendering at /ward-management. Task 9 deletes that component; until then the behaviour has
  // no home on the coordinator screen and these stay fixme so the gap is visible in the runner
  // (not just in a ledger row) rather than silently dropped.

  // The shortlist region is still a placeholder (Task 7 builds the real explainable shortlist),
  // but its placeholder text already names the selected movement, so the wiring this test is
  // actually about — a queue click driving `selectedMovementId` through to that region, and a
  // second click moving the selection rather than adding to it — is real Task 5 behaviour with
  // a real home, not a gap. Task 7 replaces the shortlist body without touching this contract.
  test("queue selection drives the explainable shortlist", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    await expect(shortlist).toContainText("Select a movement");

    const rows = queue.locator('[data-testid^="ward-queue-row-"]');
    const firstRow = rows.first();
    const firstId = (await firstRow.getAttribute("data-testid"))?.replace("ward-queue-row-", "");
    await firstRow.click();
    await expect(firstRow).toHaveAttribute("aria-pressed", "true");
    await expect(shortlist).toContainText(String(firstId));

    // A second selection replaces the first rather than accumulating.
    const secondRow = rows.nth(1);
    const secondId = (await secondRow.getAttribute("data-testid"))?.replace("ward-queue-row-", "");
    await secondRow.click();
    await expect(secondRow).toHaveAttribute("aria-pressed", "true");
    await expect(firstRow).toHaveAttribute("aria-pressed", "false");
    await expect(shortlist).toContainText(String(secondId));
  });

  // Implemented when the exceptions drawer is built out — Task 8.
  test.fixme("the exceptions drawer drives movement selection", () => {});

  test("orders by clinical tier first and labels the score as operational, not clinical", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const rows = queue.locator('[data-testid^="ward-queue-row-"]');
    const rowCount = await rows.count();

    // A queue that renders zero rows must not be able to satisfy the ordering assertion below
    // by absence — `expect([]).toEqual([])` would otherwise pass silently if the tier badge
    // were ever removed from the row (Task 5 review Important 1). Pin the collected tier list
    // to the same length as the rendered rows, and require at least one row to exist.
    const tiers = await rows
      .locator("[data-tier]")
      .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-tier"))));
    expect(rowCount).toBeGreaterThan(0);
    expect(tiers).toHaveLength(rowCount);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));

    // Within a tier, the operational score must be non-increasing — the queue's core claim
    // (Task 5 review Important 2). This reads the property off `data-score`, not a hard-coded
    // fixture value, so it still holds if the fixture data changes; inverting the tiebreak
    // comparator in `queueOrder` must turn this red.
    const rowKeys = await rows.evaluateAll((nodes) =>
      nodes.map((node) => ({
        tier: Number(node.querySelector("[data-tier]")?.getAttribute("data-tier")),
        score: Number(node.getAttribute("data-score")),
      })),
    );
    for (let i = 1; i < rowKeys.length; i++) {
      const prev = rowKeys[i - 1];
      const curr = rowKeys[i];
      if (curr.tier === prev.tier) {
        expect(
          curr.score,
          `row ${i} (tier ${curr.tier}, score ${curr.score}) must not outrank row ${i - 1} (score ${prev.score})`,
        ).toBeLessThanOrEqual(prev.score);
      }
    }

    // The score must never read as clinical severity.
    await expect(queue).toContainText("Operational");
    await expect(queue).not.toContainText("Severity");
    await expect(queue).not.toContainText("Acuity");

    // The rendered score is the derived one, not a constant or a stale placeholder (Task 5
    // review Important 3) — compare the first row against itself rather than importing the
    // derivation into this spec.
    const firstRow = rows.first();
    const firstRowScore = await firstRow.getAttribute("data-score");
    await expect(firstRow).toContainText(`Operational ${firstRowScore}`);

    // The breach line is the row a coordinator must not miss, and it must be able to vanish
    // silently for neither direction (Task 5 review Important 3): WF-017 (first row) has a
    // passed Form 2A deadline and must show the breach line; WF-009 (second row) has an
    // unbreached deadline and must not.
    await expect(firstRow).toContainText("passed its deadline");
    const secondRow = rows.nth(1);
    await expect(secondRow).not.toContainText("passed its deadline");

    // Selecting a movement drives the rest of the screen.
    await firstRow.click();
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    const selectedId = await queue.locator('[aria-pressed="true"]').getAttribute("data-testid");
    await expect(shortlist).toContainText(String(selectedId).replace("ward-queue-row-", ""));
  });

  test("ranks emergency departments worst first and filters the queue when one is chosen", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const strip = page.getByRole("region", { name: "Emergency department pressure" });
    const cards = strip.locator('[data-testid^="ward-ed-"]');
    await expect(cards).toHaveCount(8);

    // The worst department leads, and says why it is worst.
    const worst = cards.first();
    await expect(worst).toContainText("waiting");
    await expect(worst).toContainText("longest");

    // The rendered sequence itself is non-increasing on the two keys `edPressure` ranks by.
    // Asserting only that card 1 "contains some text" (above) stays true even if the rows were
    // reversed — this pins the ordering property instead (Task 4 review Important 1). It reads
    // the actual numeric sort keys off `data-breaching`/`data-longest-minutes` rather than
    // hard-coding "PEEL is first", so it keeps validating the rule if the fixture data changes.
    const sortKeys = await cards.evaluateAll((nodes) =>
      nodes.map((node) => ({
        breaching: Number(node.getAttribute("data-breaching")),
        longestMinutes: Number(node.getAttribute("data-longest-minutes")),
      })),
    );
    for (let i = 1; i < sortKeys.length; i++) {
      const prev = sortKeys[i - 1];
      const curr = sortKeys[i];
      const doesNotOutrankPrevious =
        curr.breaching < prev.breaching ||
        (curr.breaching === prev.breaching && curr.longestMinutes <= prev.longestMinutes);
      expect(
        doesNotOutrankPrevious,
        `card ${i} ${JSON.stringify(curr)} must not rank above card ${i - 1} ${JSON.stringify(prev)}`,
      ).toBe(true);
    }

    // Choosing one filters the queue to that department and says so — and to exactly that
    // department's own movements, not merely to some smaller set of the same rough size. A
    // filter that names the clicked department while quietly showing a different one's patients
    // is worse than no filter, and `after < before` alone cannot tell the two apart (Task 4
    // review Important 2).
    const worstEdId = (await worst.getAttribute("data-testid"))?.replace("ward-ed-", "");
    const worstWaiting = Number(await worst.getAttribute("data-waiting"));
    const queue = page.getByRole("region", { name: "Priority queue" });
    const before = await queue.locator('[data-testid^="ward-queue-row-"]').count();
    await worst.click();
    await expect(queue).toContainText("Filtered to");
    const rows = queue.locator('[data-testid^="ward-queue-row-"]');
    await expect(rows).toHaveCount(worstWaiting);
    const originIds = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-origin-ed")));
    for (const originId of originIds) {
      expect(originId).toBe(worstEdId);
    }
    expect(worstWaiting).toBeLessThan(before);

    // And clearing restores it.
    await queue.getByRole("button", { name: /Clear filter/ }).click();
    await expect(queue.locator('[data-testid^="ward-queue-row-"]')).toHaveCount(before);
  });

  test("draws the selected movement's routes from its department to its shortlisted units", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const diagram = page.getByRole("region", { name: "Statewide flow" });

    // Connector paths are drawn by a client layout effect — this is the hydration signal.
    await expect(diagram.locator("svg path[marker-end]").first()).toBeAttached({ timeout: 15_000 });

    // Every one of the 22 fixture units renders as its own node regardless of selection — a unit
    // whose service-group lookup silently fails must not just vanish from the count (review
    // Minor 6; `flow-diagram.tsx` renders an explicit "Unresolved health service" anomaly card
    // for exactly that case rather than dropping the unit).
    await expect(diagram.locator('[data-testid^="ward-diagram-unit-"]')).toHaveCount(22);

    // Demand connectors (department → hub) exist regardless of selection, always eight. No
    // movement is selected yet, so there must be zero route connectors — proving the two kinds
    // are distinguished by `data-connector-kind`, not merely by an incidental class name (review
    // Important 4).
    await expect(diagram.locator('svg path[data-connector-kind="demand"]')).toHaveCount(8);
    await expect(diagram.locator('svg path[data-connector-kind="route"]')).toHaveCount(0);

    const firstRow = page
      .getByRole("region", { name: "Priority queue" })
      .locator('[data-testid^="ward-queue-row-"]')
      .first();
    const movementId = (await firstRow.getAttribute("data-testid"))?.replace("ward-queue-row-", "");
    expect(movementId, "the first queue row must carry a real movement id").toBeTruthy();
    await firstRow.click();

    const { movement } = await assertRoutedMatchesShortlist(diagram, String(movementId));

    // The origin department is marked, and it is the selected movement's own — not merely
    // some department, which a hard-coded card would also satisfy.
    const origin = diagram.locator('[data-origin="true"]');
    await expect(origin).toHaveCount(1);
    await expect(origin).toHaveAttribute("data-testid", `ward-diagram-ed-${movement.originEdId}`);

    // Review Important 3: the identity assertion above must hold for more than the one movement
    // that happens to be queue row 1. WF-009 has an entirely different shortlist (proven
    // separately, in the ineligible-routes test below, to also be an entirely different
    // eligibility outcome) — a hard-coded routed set that coincidentally matched row 1's
    // shortlist would fail here instead of passing by coincidence.
    await page.getByRole("region", { name: "Priority queue" }).locator('[data-testid="ward-queue-row-WF-009"]').click();
    await assertRoutedMatchesShortlist(diagram, "WF-009");
  });

  test("marks an ineligible shortlisted unit as not currently placeable, not as a routed destination", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const diagram = page.getByRole("region", { name: "Statewide flow" });
    await expect(diagram.locator("svg path[marker-end]").first()).toBeAttached({ timeout: 15_000 });

    const movement = requireMovement("WF-009");
    const shortlist = eligibleCandidates(movement, NOW_ANCHOR, PARALLEL_REFERRAL_CAP);
    // This test's whole premise is a shortlist with ZERO eligible candidates — WF-009 has been
    // declined by five units, and its nearest three (by cohort, since `eligibleCandidates` sorts
    // eligible-first but never filters) are all ineligible: two already declined it, one fails
    // the security gate. If the fixture ever changes so this stops being true, the assertions
    // below must fail loudly here rather than vacuously pass on an empty or partially-eligible
    // set.
    expect(shortlist.length).toBeGreaterThan(0);
    expect(shortlist.every((candidate) => !candidate.verdict.eligible)).toBe(true);

    await page.getByRole("region", { name: "Priority queue" }).locator('[data-testid="ward-queue-row-WF-009"]').click();

    // Every routed node is marked not-eligible on the node itself...
    const routed = diagram.locator('[data-routed="true"]');
    await expect(routed).toHaveCount(shortlist.length);
    const eligibleFlags = await routed.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-eligible")));
    for (const flag of eligibleFlags) {
      expect(flag).toBe("false");
    }

    // ...and states its own specific reason as real text (never colour alone — must survive
    // forced-colors — and never a generic "not eligible", proving `candidateReason(verdict)`
    // actually reaches the DOM for each unit, not just a shared placeholder).
    for (const candidate of shortlist) {
      const node = diagram.locator(`[data-testid="ward-diagram-unit-${candidate.unit.id}"]`);
      await expect(node).toContainText(candidateReason(candidate.verdict));
    }

    // The connector lines themselves are marked ineligible too, so the arrow cannot read as an
    // endorsement the node's own text denies.
    const routeConnectors = diagram.locator('svg path[data-connector-kind="route"]');
    await expect(routeConnectors).toHaveCount(shortlist.length);
    const connectorFlags = await routeConnectors.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-eligible")),
    );
    for (const flag of connectorFlags) {
      expect(flag).toBe("false");
    }

    // The hub states the true eligible count — zero — never the shortlist size framed as routes.
    await expect(diagram).toContainText(`no eligible destination; ${shortlist.length} nearest, all excluded`);
  });

  test("distinguishes an accepted destination from an outstanding referral, and shows every parallel referral", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const diagram = page.getByRole("region", { name: "Statewide flow" });
    await expect(diagram.locator("svg path[marker-end]").first()).toBeAttached({ timeout: 15_000 });
    const queue = page.getByRole("region", { name: "Priority queue" });

    // WF-017 has an outstanding referral to BTY Adult Secure and no acceptance yet —
    // `destinationUnit`'s single conflated field (`acceptedUnitId ?? referredUnitIds[0]`) used
    // to badge this "Current recorded destination", which reads as an acceptance that has not
    // happened (review Important 2).
    await queue.locator('[data-testid="ward-queue-row-WF-017"]').click();
    const bty = diagram.locator('[data-testid="ward-diagram-unit-bty-adult-secure"]');
    await expect(bty).toHaveAttribute("data-referred", "true");
    await expect(bty).not.toHaveAttribute("data-accepted", "true");
    await expect(bty).toContainText("Outstanding referral");
    await expect(bty).not.toContainText("Accepted destination");

    // WF-013 carries two parallel referrals — both must be visible, not only
    // `referredUnitIds[0]`.
    await queue.locator('[data-testid="ward-queue-row-WF-013"]').click();
    await expect(diagram.locator('[data-testid="ward-diagram-unit-bty-older-adult"]')).toHaveAttribute(
      "data-referred",
      "true",
    );
    await expect(diagram.locator('[data-testid="ward-diagram-unit-gry-older-adult"]')).toHaveAttribute(
      "data-referred",
      "true",
    );

    // WF-003 has an actual acceptance — a different fact, with a different badge.
    await queue.locator('[data-testid="ward-queue-row-WF-003"]').click();
    const accepted = diagram.locator('[data-testid="ward-diagram-unit-rph-adult-secure"]');
    await expect(accepted).toHaveAttribute("data-accepted", "true");
    await expect(accepted).toContainText("Accepted destination");
    await expect(accepted).not.toContainText("Outstanding referral");
  });

  /**
   * Task 7's own controller finding: the whole-branch review found a green tick rendered beside
   * "SJGS Adult Open is not authorised under the Mental Health Act". This test pins the fix at the
   * DOM level, not just at the derivation level (`ward-eligibility.test.ts` already proves the
   * gate logic itself).
   *
   * The brief's own draft of this test clicks queue row 1 (WF-017) and only conditionally checks
   * a failing gate's icon (`if (await failing.count())`) — but WF-017's default candidate
   * (`rph-adult-secure`) passes all eight gates, so that conditional block would silently skip on
   * this fixture, exactly the "test that cannot fail" shape Phase 1 shipped once already. WF-009
   * (queue row 2, declined by five units, whose own nearest three candidates are all ineligible —
   * see `ward-derivations.ts`) is used instead to guarantee a failing gate is actually on screen
   * (Ruling 3), and the confirm journey is walked end to end rather than merely checking a button
   * is visible (Ruling 4).
   */
  test("shows a failing gate as a failure and never auto-allocates", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

    // WF-017 (queue row 1): every gate row states its own verdict in text, not only by icon, and
    // all eight gates are rendered — never a `.slice()`.
    await queue.locator('[data-testid^="ward-queue-row-"]').first().click();
    const wf017Gates = shortlist.locator('[data-testid^="ward-gate-"]');
    await expect(wf017Gates).toHaveCount(8);
    for (const gate of await wf017Gates.all()) {
      const pass = await gate.getAttribute("data-pass");
      await expect(gate).toContainText(pass === "true" ? "Met" : "Not met");
    }

    // Nothing is allocated until a human confirms — before any candidate selection or click.
    await expect(shortlist).toContainText("No automatic allocation");
    await expect(shortlist).not.toContainText("Confirmed by a human coordinator");
    await expect(shortlist).not.toContainText("Overridden by a human coordinator");
    await expect(shortlist.getByRole("button", { name: /Confirm/ })).toBeVisible();

    // WF-009 (queue row 2): guaranteed to surface a failing gate on its default candidate, unlike
    // WF-017 above — this is the unconditional proof the brief's own guarded assertion could skip.
    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();
    const wf009Gates = shortlist.locator('[data-testid^="ward-gate-"]');
    await expect(wf009Gates).toHaveCount(8);
    for (const gate of await wf009Gates.all()) {
      const pass = await gate.getAttribute("data-pass");
      await expect(gate).toContainText(pass === "true" ? "Met" : "Not met");
    }

    // A failing gate never renders the success icon. Note the selector: lucide-react emits
    // `lucide-circle-check` for `CheckCircle2`, not `lucide-check-circle-2` — the class Phase 1
    // asserted on, which could never fail regardless of what the icon actually was. Paired with a
    // present-icon assertion on the same row so this cannot pass merely because both icons are
    // absent (Ruling 3).
    const failing = shortlist.locator('[data-testid^="ward-gate-"][data-pass="false"]');
    await expect(failing.first()).toBeVisible();
    await expect(failing.first().locator("svg.lucide-circle-check")).toHaveCount(0);
    await expect(failing.first().locator("svg.lucide-circle-alert")).toHaveCount(1);

    // Selecting an ineligible candidate (WF-009's default) leaves confirming unavailable, with
    // the reason stated rather than the control silently vanishing.
    const confirmButton = shortlist.getByRole("button", { name: /Confirm/ });
    await expect(confirmButton).toHaveAttribute("aria-disabled", "true");
    await expect(shortlist).not.toContainText("Confirmed by a human coordinator");

    // Selecting WF-017's own eligible candidate makes confirming available, and confirming
    // records a real human confirmation on screen — never an automatic allocation triggered by
    // merely selecting a row.
    await queue.locator('[data-testid="ward-queue-row-WF-017"]').click();
    await shortlist.locator('[data-testid="ward-shortlist-candidate-rph-adult-secure"]').click();
    await expect(confirmButton).not.toHaveAttribute("aria-disabled", "true");
    await expect(shortlist).not.toContainText("Confirmed by a human coordinator");
    await confirmButton.click();
    await expect(shortlist).toContainText("Confirmed by a human coordinator");
    await expect(shortlist).toContainText("RPH Adult Secure");
  });

  /**
   * Task 7 review Important 1: reversing the gate-list comparator to put failures LAST left the
   * rest of the suite green, because every other assertion checks text/icon correctness per row,
   * not the row ORDER. This pins the order itself, independent of gate count or wording, so a
   * future edit that buries a failing gate anywhere but first is caught regardless of exactly how
   * many gates fail.
   */
  test("keeps failing gates ordered before passing gates", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

    // WF-009's default candidate (RPH Adult Secure) fails exactly one of the eight gates
    // (prior_decline) — enough to prove ordering without depending on how many gates fail.
    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();
    const passFlags = await shortlist
      .locator('[data-testid^="ward-gate-"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-pass")));
    expect(passFlags).toHaveLength(8);
    const lastFalseIndex = passFlags.lastIndexOf("false");
    const firstTrueIndex = passFlags.indexOf("true");
    expect(
      lastFalseIndex,
      "at least one failing gate must be present for this assertion to mean anything",
    ).toBeGreaterThanOrEqual(0);
    expect(
      firstTrueIndex,
      "at least one passing gate must be present for this assertion to mean anything",
    ).toBeGreaterThanOrEqual(0);
    expect(lastFalseIndex, "every failing gate must render before every passing gate").toBeLessThan(firstTrueIndex);
  });

  /**
   * Task 7 review Important 2: adding `.slice(0, 3)` to the declines list silently dropped two of
   * WF-009's five recorded declines and the suite stayed green, because nothing previously counted
   * the rendered rows against the movement's own real decline count.
   */
  test("renders every recorded decline, never a truncated subset", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

    const movement = requireMovement("WF-009");
    expect(movement.declines.length, "fixture assumption: WF-009 carries five declines").toBe(5);

    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();
    await expect(shortlist.locator('[data-testid="ward-decline-row"]')).toHaveCount(movement.declines.length);
  });

  /**
   * Task 7 review Important 3: replacing the eligible-only lookup with the shortlist's raw first
   * entry labels an INELIGIBLE unit "Suggested destination" on a movement like WF-009 (all three
   * nearest candidates ineligible) — precisely what ruling 5 forbids, since it would recommend a
   * ward that already refused the patient. The suite stayed green under that mutation because
   * nothing previously asserted the label's absence on an all-ineligible movement.
   */
  test("never labels an ineligible candidate as the suggested destination", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

    // WF-009: every one of its three nearest candidates is ineligible, so there is no unit this
    // panel may honestly suggest.
    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();
    await expect(shortlist).not.toContainText("Suggested destination");
    await expect(shortlist).toContainText("No eligible destination found yet.");

    // WF-017: carries a recorded outstanding referral (a fact, never a computed suggestion), so
    // "Suggested destination" must not appear here either. That referral — BTY Adult Secure,
    // selectable via the diagram's shared selection state — passes every gate, so presenting it
    // as fact carries no hidden risk of recommending a failing unit.
    await queue.locator('[data-testid="ward-queue-row-WF-017"]').click();
    await expect(shortlist).toContainText("Outstanding referral: BTY Adult Secure");
    await expect(shortlist).not.toContainText("Suggested destination");

    const diagram = page.getByRole("region", { name: "Statewide flow" });
    await diagram.locator('[data-testid="ward-diagram-unit-bty-adult-secure"]').click();
    const btyGates = shortlist.locator('[data-testid^="ward-gate-"]');
    await expect(btyGates).toHaveCount(8);
    await expect(shortlist.locator('[data-testid^="ward-gate-"][data-pass="false"]')).toHaveCount(0);
  });

  /**
   * Task 7 review Important 4: override is half of the phase's central governance claim ("a human
   * confirms OR overrides, always, with the reason recorded"), and previously had zero test
   * coverage in either ward spec — proven only by reading the source. This walks it end to end:
   * reachable, reason-gated (an empty submission records nothing), and the recorded reason is
   * visible on screen afterwards.
   */
  test("the override path is a real, reason-gated confirmation path", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

    // WF-009: every nearest candidate is ineligible, so override is the only human path that can
    // place a patient here — exactly the scenario the control exists for.
    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();

    const overrideToggle = shortlist.getByTestId("ward-shortlist-override-toggle");
    await expect(overrideToggle).toBeVisible();
    await expect(overrideToggle).not.toHaveAttribute("aria-disabled", "true");
    await overrideToggle.click();

    const reasonField = shortlist.getByLabel(/Reason for overriding/);
    const submitButton = shortlist.getByRole("button", { name: "Record override" });
    await expect(reasonField).toBeVisible();

    // A reason is required — submitting empty must record nothing.
    await submitButton.click();
    await expect(shortlist).not.toContainText("Overridden by a human coordinator");

    // A real reason produces a real, human-attributed record, visible on screen.
    const reasonText = "Duty psychiatrist directs placement despite the prior decline; bed confirmed by phone.";
    await reasonField.fill(reasonText);
    await submitButton.click();
    await expect(shortlist).toContainText("Overridden by a human coordinator");
    await expect(shortlist).toContainText(reasonText);
    await expect(shortlist).toContainText("RPH Adult Secure");
  });
});
