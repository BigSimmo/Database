import { expect, test, type Page } from "playwright/test";

import { unitById } from "@/components/ward-management/ward-sites";

async function gotoWard(page: Page, unitId: string) {
  await page.goto(`/ward-management/ward/${unitId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

test.describe("Ward screen", () => {
  test.describe.configure({ timeout: 45_000 });

  test("shows one unit's own capacity and answers an incoming referral", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await gotoWard(page, "bty-adult-secure");

    // One unit, not twenty-two.
    await expect(page.getByTestId("ward-unit-screen")).toContainText("BTY Adult Secure");
    await expect(page.locator('[data-testid^="ward-unit-card-"]')).toHaveCount(1);

    // Its beds reconcile on screen.
    const beds = page.getByTestId("ward-unit-beds");
    await expect(beds).toContainText("Ready");
    await expect(beds).toContainText("Occupied");

    // A decline requires a reason from the fixed list, and out-of-catchment is offered.
    // Unconditional: bty-adult-secure holds a live referral at seed (WF-017, verified against
    // the real fixture — see the task report), so this must not hide behind an `if (count())`
    // that can silently never run.
    const incoming = page.locator('[data-testid^="ward-incoming-"]');
    await expect(incoming).not.toHaveCount(0);
    await incoming
      .first()
      .getByRole("button", { name: /Decline/ })
      .click();
    const reasons = page.getByRole("group", { name: /Decline reason/ });
    await expect(reasons).toContainText(/out of catchment/i);
  });

  /**
   * Addendum R40 (Global Constraint): an id `unitById` cannot resolve must render an explicit
   * empty state naming the id — never a substituted unit, never `?? allUnits()[0]`. This id is
   * checked against the real fixture below to prove it genuinely resolves to nothing, so the test
   * cannot silently start passing against a real unit if the fixture ever grows an id like this.
   */
  test("names an unresolved unit id rather than substituting a different ward", async ({ page }) => {
    const bogusUnitId = "nonexistent-unit-does-not-exist";
    expect(unitById(bogusUnitId), "fixture assumption: this id resolves to no real unit").toBeUndefined();

    await page.goto(`/ward-management/ward/${bogusUnitId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });

    // Names the id, in real visible text — never a generic "not found" with the id swallowed.
    await expect(page.getByTestId("ward-unit-screen")).toContainText(bogusUnitId);
    // And never a substituted unit: no unit card is rendered at all for this route.
    await expect(page.locator('[data-testid^="ward-unit-card-"]')).toHaveCount(0);
    await expect(page.getByTestId("ward-unit-beds")).toHaveCount(0);
  });
});

test.describe("Transport officer screen", () => {
  test.describe.configure({ timeout: 45_000 });

  /**
   * Task 9-12 preflight, Task 9 section: the brief's own test takes `.first()` of the job
   * locator, and ruling R24 already found `.first()` breaks the moment fixture order shifts.
   * WF-005 is pinned deliberately instead — verified against the real fixture (see the task
   * report's re-measurement) to carry `escortRequired: true` and to be the screen's own default
   * selection (first in `movements` array order among the eight jobs not yet arrived), so no
   * click is needed before this locator resolves.
   */
  test("gives the officer four actions and nothing else", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ward-management/transport/officer", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-officer-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const job = page.getByTestId("ward-officer-job-WF-005");
    await expect(job).toContainText(/escort/i);

    // Exactly four actions, pinned and reachable without scrolling.
    const actions = job.getByRole("button");
    await expect(actions).toHaveCount(4);
    for (const action of await actions.all()) {
      const box = await action.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });

  /**
   * Spec §7: the model carries no officer identity, so this screen must say — on screen, in
   * real text — that it shows every job rather than a filtered "yours". Global Constraint:
   * display less rather than something plausible.
   */
  test("states it is showing every job rather than inventing an officer to own them", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ward-management/transport/officer", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-officer-screen")).toBeVisible({ timeout: 15_000 });

    await expect(page.getByTestId("ward-officer-governance")).toContainText(/every/i);
    // All eight seed jobs not yet arrived are on screen — never filtered to an inferred "mine".
    await expect(page.locator('[data-testid^="ward-officer-job-"]')).toHaveCount(8);
  });
});

test.describe("Live tracker", () => {
  test.describe.configure({ timeout: 45_000 });

  /**
   * Task 10 brief, Step 1 — appended verbatim. On its own this only proves that the two legs
   * ("Accepted", "Collected") the seed fixture happens to contain today render correctly; the
   * task-10 preflight's LATE ADDITION section flags that a passing version of this exact
   * assertion cannot tell a tracker that renders all five legs correctly apart from one that
   * renders only the legs the fixture happens to contain. `tests/tracker-derivations.test.ts`
   * (node environment) closes that gap by unit-testing the tracker's own leg/stamp helper across
   * all five legs plus cancelled plus absence, none of which the seed fixture currently exercises
   * end to end. The next test in this file strengthens the browser-level assertion further, by
   * pinning the exact row count instead of `> 0`.
   */
  test("tracks every vehicle by leg and by how long since the last stamp", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/ward-management/transport", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-live-tracker")).toBeVisible({ timeout: 15_000 });

    const rows = page.locator('[data-testid^="ward-tracker-row-"]');
    expect(await rows.count()).toBeGreaterThan(0);

    // Every row names its leg and its age, and no row claims a leg it has not reached.
    for (const row of await rows.all()) {
      await expect(row).toContainText(/Requested|Accepted|En route|Collected|Arrived/);
      await expect(row).toContainText(/ago|since/i);
    }
  });

  /**
   * Re-measured directly against this branch's fixture (see the task report, not the earlier
   * preflight numbers — those predate a fixture fix that gave six "en route" jobs a
   * `collectedAt`): 41 open movements, 8 of which carry a transport job. Pinning the row count
   * at exactly 8 (never `> 0`) catches a filter regression that silently widens or narrows which
   * movements count as "a vehicle" — the brief's own wording is "no row may claim a leg it has
   * not reached", and a screen that also renders the 33 transport-less movements would either
   * fabricate a leg for them or need a sixth, non-leg cell that this exact-count assertion would
   * catch drifting either way. The governance banner states the excluded count in real text
   * instead — that is the "explicit absence" the Global Constraint asks for on this screen.
   */
  test("lists exactly the movements that carry a transport job, and states the rest explicitly", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/ward-management/transport", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-live-tracker")).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('[data-testid^="ward-tracker-row-"]')).toHaveCount(8);
    await expect(page.getByTestId("ward-tracker-governance")).toContainText(/33 of 41/);
  });
});
