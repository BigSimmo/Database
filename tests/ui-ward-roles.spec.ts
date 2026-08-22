import { expect, test, type Page } from "playwright/test";

import { edById, unitById } from "@/components/ward-management/ward-sites";

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

test.describe("Emergency department screen", () => {
  test.describe.configure({ timeout: 45_000 });

  /**
   * Task 11 brief, Step 1 — appended verbatim.
   */
  test("shows a department its own patients, both clocks, and one outstanding item each", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/ward-management/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const rows = page.locator('[data-testid^="ward-ed-patient-"]');
    expect(await rows.count()).toBeGreaterThan(0);

    // Its own patients only.
    for (const row of await rows.all()) {
      await expect(row).toHaveAttribute("data-origin-ed", "peel-ed");
    }

    // The legal clock and the department clock are shown as different things.
    await expect(page.getByTestId("ward-ed-screen")).toContainText(/in department/i);
    await expect(page.getByTestId("ward-ed-screen")).toContainText(/legal clock|since form/i);

    // At least one community-formed patient shows a legal clock older than its time in department.
    const communityFormed = page.locator('[data-testid^="ward-ed-patient-"][data-community-formed="true"]');
    expect(await communityFormed.count()).toBeGreaterThan(0);

    // A department can raise a referral.
    await expect(page.getByRole("button", { name: /Raise referral/ })).toBeVisible();
  });

  /**
   * Addendum R40 (Global Constraint), the same rule `ward-screen.tsx`'s unresolved-unit test
   * proves: an id `edById` cannot resolve must render an explicit empty state naming the id —
   * never a substituted department. Checked against the real fixture first so this test cannot
   * silently start passing against a real department if one is ever added with this id.
   */
  test("names an unresolved emergency department id rather than substituting a different one", async ({ page }) => {
    const bogusEdId = "nonexistent-ed-does-not-exist";
    expect(edById(bogusEdId), "fixture assumption: this id resolves to no real department").toBeUndefined();

    await page.goto(`/ward-management/ed/${bogusEdId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("ward-ed-screen")).toContainText(bogusEdId);
    await expect(page.locator('[data-testid^="ward-ed-card-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="ward-ed-patient-"]')).toHaveCount(0);
  });

  /**
   * Re-measured against this branch's fixture (see the task report): `peel-ed` carries exactly
   * one community-formed movement, WF-005 — `formedAt` 150 minutes before `openedAt` — pinned by
   * id rather than `.first()` (ruling R24). Its legal clock must read as strictly OLDER than its
   * time in department, and by exactly 150 minutes; a non-community-formed row (WF-009, `peel-ed`'s
   * one police arrival) must read the two clocks as EQUAL. The numeric `data-*` attributes are
   * asserted directly rather than parsed out of prose text, the same discipline
   * `pressure-strip.tsx`'s `data-breaching`/`data-longest-minutes` document.
   */
  test("never renders a community-formed patient's legal clock as shorter than their time in department", async ({
    page,
  }) => {
    await page.goto("/ward-management/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const communityRow = page.getByTestId("ward-ed-patient-WF-005");
    await expect(communityRow).toHaveAttribute("data-community-formed", "true");
    await expect(communityRow).toHaveAttribute("data-minutes-in-department", "330");
    await expect(communityRow).toHaveAttribute("data-minutes-legal-clock", "480");

    const plainRow = page.getByTestId("ward-ed-patient-WF-009");
    await expect(plainRow).not.toHaveAttribute("data-community-formed", "true");
    const inDept = Number(await plainRow.getAttribute("data-minutes-in-department"));
    const legalClock = Number(await plainRow.getAttribute("data-minutes-legal-clock"));
    expect(legalClock).toBe(inDept);
  });

  /**
   * WF-005 (task report finding): carries an un-examined Form 1A AND an already-accepted
   * transport job at the same time. The honest single outstanding item is the transport that is
   * actually in motion — not the older, non-blocking examination gap — because stage governs
   * `outstandingItem`'s priority before the examination check ever runs (see that function's own
   * comment in `ed-screen.tsx`). Pinned by id, per the task's own warning not to assume.
   */
  test("names transport, not examination, as WF-005's honest outstanding item", async ({ page }) => {
    await page.goto("/ward-management/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const outstanding = page.getByTestId("ward-ed-outstanding-WF-005");
    await expect(outstanding).toHaveAttribute("data-kind", "transport");
    await expect(outstanding).toContainText(/Accepted/);
  });

  /**
   * `HANDOVER_READY` requires stage `bed_held` and nothing else (`ward-flow-reducer.ts`'s own
   * `case "HANDOVER_READY"`). WF-016 (`peel-ed`, `bed_held`) proves the control is live and that
   * dispatching it actually changes the outstanding item to transport; WF-303 (`peel-ed`,
   * `accepted_awaiting_bed`) proves the control never advertises an action the reducer would
   * refuse — `aria-disabled`, never native `disabled`, naming the movement's real stage.
   */
  test("marks handover ready only once a bed is held, mirroring the reducer's own precondition", async ({ page }) => {
    await page.goto("/ward-management/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    // Interacting (the click below) before hydration completes silently no-ops — a plain DOM
    // click with no React listener attached yet throws nothing and changes nothing. Every other
    // interactive test in this file waits for `networkidle` before its first click (see
    // `gotoWard`'s own such wait above); this test originally omitted it and the click reliably
    // did nothing as a result — diagnosed directly against the live app (see the task report),
    // not assumed. The other four tests in this describe block are read-only against static
    // server-rendered attributes and do not need it, but this is the one that clicks.
    await page.waitForLoadState("networkidle");

    const blockedHandover = page.getByTestId("ward-ed-handover-WF-303");
    await expect(blockedHandover).toHaveAttribute("aria-disabled", "true");
    await expect(blockedHandover).toHaveAttribute("title", /accepted, awaiting bed/i);

    const readyHandover = page.getByTestId("ward-ed-handover-WF-016");
    await expect(readyHandover).not.toHaveAttribute("aria-disabled", "true");
    await readyHandover.click();

    // `HANDOVER_READY` writes a brand-new `transport` object with no timestamps at all
    // (`ward-flow-reducer.ts`'s own `case "HANDOVER_READY"`), so `transportLeg` resolves it to
    // the "Requested" leg — never `undefined` (that value is reserved for a movement with no
    // `transport` object at all, e.g. WF-319's fixture-authored `handover_ready` with no
    // transport). Re-measured directly against the live app (see the task report) rather than
    // assumed, after an earlier version of this assertion got it wrong.
    const outstanding = page.getByTestId("ward-ed-outstanding-WF-016");
    await expect(outstanding).toHaveAttribute("data-kind", "transport");
    await expect(outstanding).toContainText(/Requested/);
  });

  /**
   * Exactly one police arrival exists in the whole 48-movement fixture, and it is WF-009 at
   * `peel-ed` (re-measured against this branch's fixture — see the task report). Pinned by id so
   * a fixture change that removes it fails loudly rather than this count silently reading zero.
   */
  test("flags exactly the one police arrival at peel-ed, and no other patient", async ({ page }) => {
    await page.goto("/ward-management/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("ward-ed-police-WF-009")).toBeVisible();
    await expect(page.locator('[data-testid^="ward-ed-police-"]')).toHaveCount(1);
  });
});
