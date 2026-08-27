import { expect, test, type Page } from "playwright/test";

import { edById, unitById } from "@/components/ward-management/ward-sites";

async function gotoWard(page: Page, unitId: string) {
  await page.goto(`/mockups/ward-flow/ward/${unitId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

test.describe("@mockup Ward screen", () => {
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

    await page.goto(`/mockups/ward-flow/ward/${bogusUnitId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });

    // Names the id, in real visible text — never a generic "not found" with the id swallowed.
    await expect(page.getByTestId("ward-unit-screen")).toContainText(bogusUnitId);
    // And never a substituted unit: no unit card is rendered at all for this route.
    await expect(page.locator('[data-testid^="ward-unit-card-"]')).toHaveCount(0);
    await expect(page.getByTestId("ward-unit-beds")).toHaveCount(0);
  });

  /**
   * Whole-branch review I3. Spec §2 decision 5 ("Does the clock move? Yes, with a jump-forward
   * control") and §5 ("+15 min, +1 hour … so a held bed can be watched expiring in seconds
   * rather than in an hour") — `ADVANCE_CLOCK` was implemented and tested in the reducer from
   * Task 3 onward but dispatched only from test-harness buttons; no product surface ever raised
   * it. WF-003 is fixture-pinned `accepted_awaiting_bed` at `rph-adult-secure`
   * (`ward-movements.ts`), so Hold needs no prior referral/accept steps here.
   */
  test("the demo clock control advances a held bed toward expiry, and reads as demo scaffolding", async ({ page }) => {
    // The countdown floors wall-clock minutes. Pin the browser clock so crossing a minute
    // boundary between the hold action and the assertion cannot turn 1h 00m into 59m.
    await page.clock.install({ time: new Date("2026-08-26T10:00:00Z") });
    await gotoWard(page, "rph-adult-secure");

    const card = page.getByTestId("ward-accepted-WF-003");
    await expect(card).toBeVisible();
    await card.getByTestId("ward-hold-WF-003").click();
    await expect(card).toContainText("Bed hold 1h 00m left");

    // The trigger must never be mistaken for a clinical action — checked in words, not merely by
    // colour: its accessible name and title both say so explicitly.
    const trigger = page.getByTestId("ward-demo-controls-trigger");
    await expect(trigger).toHaveAttribute("aria-label", /not a clinical action/i);
    await expect(trigger).toHaveAttribute("title", /never a clinical action/i);

    await trigger.click();
    const menu = page.locator("#ward-demo-controls-menu");
    await expect(menu).toBeVisible();
    await expect(menu).toContainText(/demo tool, not part of the clinical record/i);

    await page.getByTestId("ward-demo-advance-15").click();
    await page.getByTestId("ward-demo-advance-15").click();
    await page.getByTestId("ward-demo-advance-15").click();

    // The one thing spec §5 says the control exists to demonstrate: a held bed watched
    // expiring in seconds. 45 minutes advanced against a 60-minute hold leaves 15.
    await expect(card).toContainText("Bed hold 15m left");
    await expect(card).not.toContainText("Bed hold 1h 00m left");
  });

  /**
   * Deferred item 1. `tests/ui-ward-management.spec.ts`'s "retains its operating structure in
   * dark, forced-colours, and print modes" already proves this for the coordinator command view;
   * the four role screens had none of it. This copies that established `emulateMedia` sequence
   * exactly — dark, then forced-colours, then print — and asserts the same class of thing it
   * does: that the screen's *operating structure* survives each mode. It deliberately makes no
   * assertion about colour, contrast or appearance, because nothing here measures those.
   */
  test("retains its operating structure in dark, forced-colours, and print modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoWard(page, "bty-adult-secure");
    await expect(page.getByTestId("ward-unit-governance")).toBeVisible();
    await expect(page.getByTestId("ward-unit-beds")).toBeVisible();
    await expect(page.getByRole("region", { name: "Bed capacity" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Incoming referrals" })).toBeVisible();

    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.getByTestId("ward-unit-governance")).toBeVisible();
    await expect(page.getByTestId("ward-unit-beds")).toBeVisible();
    await expect(page.getByRole("region", { name: "Bed capacity" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Incoming referrals" })).toBeVisible();

    await page.emulateMedia({ colorScheme: "light", forcedColors: "none", media: "print" });
    await expect(page.locator('[data-testid="ward-unit-beds"]:visible')).toBeVisible();
    await expect(page.locator('[data-testid="ward-unit-governance"]:visible')).toBeVisible();
  });
});

test.describe("@mockup Transport officer screen", () => {
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
    await page.goto("/mockups/ward-flow/transport/officer", { waitUntil: "domcontentloaded" });
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
    await page.goto("/mockups/ward-flow/transport/officer", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-officer-screen")).toBeVisible({ timeout: 15_000 });

    await expect(page.getByTestId("ward-officer-governance")).toContainText(/every/i);
    // All eight seed jobs not yet arrived are on screen — never filtered to an inferred "mine".
    await expect(page.locator('[data-testid^="ward-officer-job-"]')).toHaveCount(8);
  });

  /**
   * Deferred item 1, same pattern as the ward screen's copy of it above. The officer screen is
   * the one role screen tested at phone width, so it is emulated at phone width here too — the
   * structure that has to survive is the job list and its governance banner, not a desktop
   * layout the officer never sees.
   */
  test("retains its operating structure in dark, forced-colours, and print modes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/mockups/ward-flow/transport/officer", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-officer-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("ward-officer-governance")).toBeVisible();
    await expect(page.getByTestId("ward-officer-joblist")).toBeVisible();
    await expect(page.getByTestId("ward-officer-job-WF-005")).toBeVisible();

    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.getByTestId("ward-officer-governance")).toBeVisible();
    await expect(page.getByTestId("ward-officer-joblist")).toBeVisible();
    await expect(page.getByTestId("ward-officer-job-WF-005")).toBeVisible();

    await page.emulateMedia({ colorScheme: "light", forcedColors: "none", media: "print" });
    await expect(page.locator('[data-testid="ward-officer-joblist"]:visible')).toBeVisible();
    await expect(page.locator('[data-testid="ward-officer-governance"]:visible')).toBeVisible();
  });
});

test.describe("@mockup Live tracker", () => {
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
    await page.goto("/mockups/ward-flow/transport", { waitUntil: "domcontentloaded" });
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
    await page.goto("/mockups/ward-flow/transport", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-live-tracker")).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('[data-testid^="ward-tracker-row-"]')).toHaveCount(8);
    await expect(page.getByTestId("ward-tracker-governance")).toContainText(/33 of 41/);
  });

  /**
   * Deferred item 1, same pattern as the two screens above. The tracker's operating structure is
   * its row list and the governance banner that states the excluded movements; both must still
   * be there in each mode. The leg badges deliberately are not asserted on here — their visual
   * distinction is a separate, separately tested concern (deferred item 3), and this test makes
   * no claim about how anything looks.
   */
  test("retains its operating structure in dark, forced-colours, and print modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/mockups/ward-flow/transport", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-live-tracker")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("ward-tracker-governance")).toBeVisible();
    await expect(page.getByTestId("ward-tracker-list")).toBeVisible();

    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.getByTestId("ward-tracker-governance")).toBeVisible();
    await expect(page.getByTestId("ward-tracker-list")).toBeVisible();

    await page.emulateMedia({ colorScheme: "light", forcedColors: "none", media: "print" });
    await expect(page.locator('[data-testid="ward-tracker-list"]:visible')).toBeVisible();
    await expect(page.locator('[data-testid="ward-tracker-governance"]:visible')).toBeVisible();
  });
});

test.describe("@mockup Emergency department screen", () => {
  test.describe.configure({ timeout: 45_000 });

  /**
   * Task 11 brief, Step 1 — appended verbatim.
   */
  test("shows a department its own patients, both clocks, and one outstanding item each", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
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

    await page.goto(`/mockups/ward-flow/ed/${bogusEdId}`, { waitUntil: "domcontentloaded" });
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
    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
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
    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
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
    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
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
    // `transport` object at all — reachable in the reducer's own type, `movement.transport` being
    // optional, though ruling R64 established that no fixture record actually reaches
    // "handover_ready" without one: HANDOVER_READY is the only producer of that stage and it
    // always creates the job in the same update. WF-319 used to be exactly that unreachable
    // state — a fixture defect this ruling corrected — so it is no longer this case's example).
    // Re-measured directly against the live app (see the task report) rather than assumed, after
    // an earlier version of this assertion got it wrong.
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
    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("ward-ed-police-WF-009")).toBeVisible();
    await expect(page.locator('[data-testid^="ward-ed-police-"]')).toHaveCount(1);
  });

  /**
   * Deferred item 1, completing the four role screens. The ED screen's operating structure is its
   * two working sections — raising a referral, and the department's own patient list — plus the
   * governance banner; each must still be present in dark, forced-colours and print.
   */
  test("retains its operating structure in dark, forced-colours, and print modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("ward-ed-governance")).toBeVisible();
    await expect(page.getByRole("region", { name: "Raise a referral" })).toBeVisible();
    await expect(page.getByRole("region", { name: "This department's patients" })).toBeVisible();

    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.getByTestId("ward-ed-governance")).toBeVisible();
    await expect(page.getByRole("region", { name: "Raise a referral" })).toBeVisible();
    await expect(page.getByRole("region", { name: "This department's patients" })).toBeVisible();

    await page.emulateMedia({ colorScheme: "light", forcedColors: "none", media: "print" });
    await expect(page.locator('[data-testid="ward-ed-governance"]:visible')).toBeVisible();
    await expect(page.locator('[data-testid="ward-ed-patient-WF-005"]:visible')).toBeVisible();
  });
});

test.describe("@mockup Role switcher — the loop", () => {
  test.describe.configure({ timeout: 60_000 });

  /**
   * Task 12 (addendum R41/R42/R48/R52/R67). One patient, WF-315, walked through all four roles
   * in a single browser window — the journey that proves Ward Flow Phase 3 actually works, not
   * just that eleven screens each work in isolation.
   *
   * WF-315 was chosen and verified against the real fixture and reducer, not assumed (see the
   * task report): seed stage `placement_requested`, `originEdId: "arm-ed"`, a 1A form with no
   * examination recorded yet, and exactly three eligible candidates
   * (`rph-adult-secure`/`fsh-adult-secure`/`rgh-adult-secure`). The whole ten-dispatch chain
   * below was driven through `wardFlowReducer` directly from a fresh seed before this test was
   * written, with `state.rejections` staying empty at every step.
   *
   * THE ONE RULE THAT MATTERS MORE THAN ANY SINGLE ASSERTION HERE: this journey navigates by
   * CLICKING the role switcher, never by `page.goto()`. A `goto` is a full page load — it
   * re-mounts `WardFlowProvider` and resets every movement back to the seed fixture, so the
   * journey would pass or fail for reasons entirely unrelated to the code while still looking
   * like it proved the loop. The one permitted `goto` below is the very first navigation, which
   * opens the ED screen the journey starts from (R67: a patient is reviewed before a bed is
   * sought).
   */
  test("walks WF-315 through all four roles in one browser window without ever reloading", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });

    // Fixture assumptions, checked against the real data rather than assumed — if either ever
    // stops resolving, this test should fail loudly here rather than several steps later against
    // a confusing downstream symptom.
    const originEd = edById("arm-ed");
    const destinationUnit = unitById("rph-adult-secure");
    expect(originEd, "fixture assumption: arm-ed resolves to a real department").toBeDefined();
    expect(destinationUnit, "fixture assumption: rph-adult-secure resolves to a real unit").toBeDefined();

    function switcherTrigger() {
      return page.getByRole("button", { name: "Switch role" });
    }

    /**
     * Opens the switcher and clicks the named menu item — never a rank (ruling R41 retired
     * `.first()` for the whole phase). Each name passed below is checked, immediately below this
     * function, to be a substring of exactly one menu item's accessible name, so a Playwright
     * substring match here can never silently resolve to the wrong destination.
     */
    async function switchTo(menuItemName: string) {
      await switcherTrigger().click();
      const matches = page.getByRole("menuitem", { name: menuItemName });
      await expect(matches, `"${menuItemName}" must resolve to exactly one menu item`).toHaveCount(1);
      await matches.click();
    }

    // --- Step 1: ED — record the examination (R67). The one permitted `goto`. ---
    await page.goto("/mockups/ward-flow/ed/arm-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await page.getByTestId("ward-ed-examine-toggle-WF-315").click();
    const examineForm = page.getByTestId("ward-ed-examine-form-WF-315");
    await expect(examineForm).toBeVisible();
    await examineForm.getByRole("radio", { name: "Inpatient treatment order" }).check();
    await examineForm.getByRole("button", { name: "Confirm examination outcome" }).click();
    // Since 2026-08-24 the examination does NOT change the form — WF-315 stays on its 1A — and
    // the movement remains referable. What changes is that the examination is now recorded, so
    // the outstanding item for WF-315 must no longer read "Examination" once this submits. The
    // assertion below is unchanged; only the reason it holds is different.
    await expect(page.getByTestId("ward-ed-outstanding-WF-315")).not.toHaveAttribute("data-kind", "examination");

    // --- Step 2: Coordinator — select WF-315, refer to all three candidates. ---
    await switchTo("Coordinator");
    await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    await queue.getByTestId("ward-queue-row-WF-315").click();
    await shortlist.getByTestId("ward-shortlist-candidate-rph-adult-secure").click();
    await shortlist.getByTestId("ward-shortlist-candidate-fsh-adult-secure").click();
    await shortlist.getByTestId("ward-shortlist-candidate-rgh-adult-secure").click();
    await shortlist.getByTestId("ward-shortlist-refer").click();
    // Three live referrals — exactly why the ward hop below cannot be inferred and must use the
    // picker (addendum R52). Whole-branch review M3: the old regex-based `toContainText` assertion
    // was satisfied by a single "Parallel referral" badge, so it never actually checked the claim
    // this comment makes. `toHaveCount(3)` on the real badge locator checks the stated claim.
    await expect(shortlist.getByTestId("ward-shortlist-referred-badge")).toHaveCount(3);

    // --- Step 3: Ward, reached via the picker (three live referrals — R52). ---
    await switchTo("RPH Adult Secure");
    await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const incoming = page.getByTestId("ward-incoming-WF-315");
    await expect(incoming).toBeVisible();
    await incoming.getByRole("button", { name: "Accept in principle" }).click();

    // --- Step 4: Ward — hold a bed. ---
    const accepted = page.getByTestId("ward-accepted-WF-315");
    await expect(accepted).toBeVisible();
    await accepted.getByRole("button", { name: "Hold a bed" }).click();

    // --- Step 5 (recommended): Coordinator — confirm the acceptance is visible from another
    // role. The shared `focusMovementId` (ward-flow-provider.tsx) re-selects WF-315 on this
    // remount without another click — proving the selection itself, not just the movement data,
    // survived the two role switches so far. ---
    await switchTo("Coordinator");
    await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("complementary", { name: "Explainable shortlist" })).toContainText(
      "Accepted destination: RPH Adult Secure",
    );

    // --- Step 6: ED — mark handover ready. The only producer of the transport job; without it
    // every officer action below would be refused (addendum R42). ---
    await switchTo("Armadale Hospital Emergency Department");
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await page.getByTestId("ward-ed-handover-WF-315").click();
    await expect(page.getByTestId("ward-ed-outstanding-WF-315")).toHaveAttribute("data-kind", "transport");

    // --- Steps 7-10: Officer — Accepted, En route, Collected, Arrived. ---
    await switchTo("Officer");
    await expect(page.getByTestId("ward-officer-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const job = page.getByTestId("ward-officer-job-WF-315");
    const selectJob = page.getByTestId("ward-officer-select-WF-315");
    // WF-315's transport job was only just created (step 6), so it is very unlikely to already
    // be the screen's default-selected job — the default is the first job in fixture array
    // order among the seed jobs (`ui-ward-roles.spec.ts`'s own "gives the officer four actions"
    // test pins that default to WF-005). Checked rather than assumed, so this journey does not
    // silently depend on an ordering coincidence either way.
    if (await selectJob.count()) {
      await selectJob.click();
    }
    await expect(job.getByRole("button")).toHaveCount(4);
    for (const label of ["Accepted", "En route", "Collected", "Arrived"]) {
      await job.getByRole("button", { name: label }).click();
    }

    // --- Step 11: Coordinator — the patient has left the system. ---
    await switchTo("Coordinator");
    await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("region", { name: "Priority queue" }).getByTestId("ward-queue-row-WF-315")).toHaveCount(
      0,
    );
  });
});

/**
 * Whole-branch review Critical 1, permanent regression coverage. Reproduces the reviewer's own
 * decisive live proof, verbatim in shape: a ward drops its own confirmed capacity to zero, and
 * every screen that reads that unit's capacity — starting with the ward's own — must reflect it
 * on the very next render, with no `page.goto()` anywhere in the sequence. A `goto` would
 * re-mount `WardFlowProvider` and re-seed `state.units` from the frozen fixture, which would
 * make every assertion below pass whether or not the fix actually threads live `units` through —
 * exactly the class of test that could not have caught C1 in the first place.
 *
 * This is added as a permanent test, not a one-off manual probe: C1 was spec §4's own
 * predicted "correction that most changes the phase", so its rule (a ward's own bed grid, its
 * own Hold control, and the coordinator's own diagram/shortlist must never disagree about the
 * same unit at the same instant) is exactly the kind of property that regresses silently — the
 * whole-branch review found it was wrong for the entirety of Phase 3's development without a
 * single existing test noticing.
 */
test.describe("@mockup Live capacity — a ward's own action reaches every screen that reads it", () => {
  test.describe.configure({ timeout: 45_000 });

  test("a ward confirming zero allocatable beds updates its own screen, then the coordinator, without ever reloading", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });

    function switcherTrigger() {
      return page.getByRole("button", { name: "Switch role" });
    }
    async function switchTo(menuItemName: string) {
      await switcherTrigger().click();
      const matches = page.getByRole("menuitem", { name: menuItemName });
      await expect(matches, `"${menuItemName}" must resolve to exactly one menu item`).toHaveCount(1);
      await matches.click();
    }

    // --- Step 1: the ward's own screen, before the drop. RPH Adult Secure seeds with
    // allocatable = 1 (Ready 1 · Held 1) and carries WF-003 accepted-awaiting-bed, whose Hold
    // control is therefore fully live: no `aria-disabled`, no `title`. ---
    await gotoWard(page, "rph-adult-secure");

    const bedGrid = page.getByTestId("ward-unit-beds");
    await expect(bedGrid).toContainText("Ready 1");
    await expect(bedGrid).toContainText("Held 1");

    const holdButton = page.getByTestId("ward-hold-WF-003");
    await expect(holdButton).toBeVisible();
    await expect(holdButton).not.toHaveAttribute("aria-disabled");
    await expect(holdButton).not.toHaveAttribute("title");

    // --- Step 2: confirm zero allocatable beds, on this same page, no reload. ---
    await page.getByTestId("ward-capacity-input").fill("0");
    await page.getByTestId("ward-capacity-submit").click();

    // --- Step 3: the ward's own screen must move. This is the exact proof the reviewer
    // performed and found failing: "typing 0 into Confirm allocatable beds ... beds: Ready 2
    // ... Currently confirmed 2" — the screen that raised the event never moved. ---
    await expect(bedGrid).toContainText("Ready 0");
    await expect(bedGrid).toContainText("Held 2"); // the physically-empty pool is unchanged; it is now unconfirmed rather than ready
    await expect(page.getByText(/Currently confirmed 0 at/)).toBeVisible();

    // --- Step 4: the Hold control must stop advertising an action the reducer would now
    // refuse — the reviewer's Proof 2 ("hold button ... aria-disabled = null ... nothing
    // happened"). It must carry BOTH aria-disabled and a stated reason naming this ward. ---
    await expect(holdButton).toHaveAttribute("aria-disabled", "true");
    await expect(holdButton).toHaveAttribute("title", /No allocatable bed remains at RPH Adult Secure/);

    // --- Step 5: click through to the coordinator — the role switcher's real <Link>, never a
    // goto. Coordinator is never ambiguous (spec §9: "Statewide — no ward or department"). ---
    await switchTo("Coordinator");
    await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // --- Step 6: the reviewer's Proof 3. Select any open movement (the diagram renders every
    // one of the 22 units' own capacity regardless of which movement is selected, so which
    // movement is picked here does not matter to this proof), then select RPH Adult Secure's
    // own node in the statewide flow diagram. ---
    const diagram = page.getByRole("region", { name: "Statewide flow" });
    await expect(diagram.locator("svg path[marker-end]").first()).toBeAttached({ timeout: 15_000 });

    await page
      .getByRole("region", { name: "Priority queue" })
      .locator('[data-testid^="ward-queue-row-"]')
      .first()
      .click();

    const rphNode = diagram.getByTestId("ward-diagram-unit-rph-adult-secure");
    // The diagram's own unit node reads the unit's live capacity directly (Critical 1 also named
    // `flow-diagram.tsx`'s `serviceGroups`/`unplacedUnits`, which used to be grouped from the
    // frozen `allUnits()` rather than the live `units` this diagram now receives as a prop).
    await expect(rphNode).toContainText("Ready 0");
    await rphNode.click();

    // --- Step 7: the shortlist's own explainable gate row for this exact unit — the reviewer's
    // literal proof text: "Allocatable bed / Met / 1 allocatable" while the ward had just said
    // zero. It must now read the opposite: Not met, 0 allocatable. `ward-eligibility.ts` is a
    // protected surface — this is not a change to what the gate judges, only to which unit's
    // live data it is judging. ---
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    await expect(shortlist).toContainText("RPH Adult Secure");
    const allocatableGate = shortlist.getByTestId("ward-gate-allocatable_bed");
    await expect(allocatableGate).toHaveAttribute("data-pass", "false");
    await expect(allocatableGate).toContainText("0 allocatable");
  });
});
