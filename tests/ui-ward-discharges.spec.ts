import { expect, test, type Locator, type Page } from "playwright/test";

import { unitById } from "@/components/ward-management/ward-sites";

/**
 * Task 8 (Phase 5). One journey: a ward flags a bed coming free, confirms it, blocks it with a
 * reason from the fixed list, then releases it — and the coordinator's capacity board
 * (`CapacityView` in `ward-management-modes.tsx`, reachable at `/mockups/ward-flow/capacity`)
 * reflects each of those four changes on the very next render, with no `page.goto()` anywhere
 * after the first navigation. Modelled on `tests/ui-ward-roles.spec.ts`'s "a ward confirming
 * zero allocatable beds updates its own screen, then the coordinator" journey — the same
 * discipline applies here for the same reason: a `goto` is a full page load that re-mounts
 * `WardFlowProvider` and resets every unit and bed release back to the seed fixture, which would
 * make every assertion below pass whether or not a ward's own bed-release action actually reaches
 * the coordinator's board.
 *
 * The round trip between the ward screen and the capacity board uses the icon rail's own
 * `<Link>`s (`ClinicalRail` in `ward-management-navigation.tsx`, sourced from `ward-nav.ts`),
 * which are mounted on every Ward Flow route rather than only the coordinator's — "Capacity" is
 * one of the eight `WARD_VIEWS`, and "Ward — RPH Adult Secure" is `WARD_NAV`'s one named,
 * always-present entry point back into this unit's own screen (`exampleOnly: true`). Neither is
 * the `WardRoleSwitcher` this file's model test uses, because that control's own "Ward" menu
 * group is driven by `focusMovementId` (a selected coordinator movement) and stays disabled with
 * no movement selected — this journey never selects one, so the rail's static links are the real
 * way back, not a substitute for one.
 */

const UNIT_ID = "rph-adult-secure";
const UNIT_NAME = "RPH Adult Secure";

async function gotoWard(page: Page) {
  await page.goto(`/mockups/ward-flow/ward/${UNIT_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

async function goToCapacityBoard(page: Page) {
  await page.getByRole("link", { name: "Capacity", exact: true }).click();
  await expect(page.getByTestId("ward-capacity-view")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

async function goBackToWard(page: Page) {
  await page.getByRole("link", { name: `Ward — ${UNIT_NAME}`, exact: true }).click();
  await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

/** The capacity board's per-unit row renders six `<span>`s in this fixed order — Now, Held,
 *  Confirmed, Predicted, Blocked, Occupied (`CapacityView`'s own JSX in
 *  `ward-management-modes.tsx`) — each rendering as e.g. `"1Now"` with no space between the
 *  number and its label, so `toHaveText` matches the literal concatenation. */
function bedStateCells(page: Page) {
  return page.getByTestId(`ward-capacity-bed-states-${UNIT_ID}`).locator("span");
}

/**
 * A release row's own STAGE label — the first `<strong>{bedReleaseStateLabels[release.state]}</strong>`
 * in its `cardHeader` (`ward-screen.tsx`). Every row also carries a `WardFreshness` stamp that
 * literally reads "Confirmed HH:MM · NUM <ward>" for EVERY stage, not only `confirmed` — the
 * reducer sets `confirmedAt`/`confirmedBy` on every bed-release write regardless of the resulting
 * `state`, because those fields mean "last reported", not "currently in the confirmed stage". A
 * plain `toContainText("Confirmed")` on the row is therefore true at every step and asserts
 * nothing — this reads the stage label alone.
 *
 * `.first()` matters more since the bed-model rework of 2026-08-28: a blocked row renders a
 * SECOND `<strong>` for the flag, right after the stage. That is the change made visible — the
 * stage and the flag are two facts shown together, where the four-stage model showed one word
 * that erased the other.
 */
function releaseStateLabel(row: Locator) {
  return row.locator("strong").first();
}

test.describe("@mockup Ward discharges — a bed release's whole lifecycle reaches the coordinator live", () => {
  test.describe.configure({ timeout: 60_000 });

  test("a ward flags, confirms, blocks and releases a bed, and the coordinator's capacity board reflects every step without a reload", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });

    // Fixture assumptions, checked against the real data rather than assumed — if either ever
    // stops holding, this test should fail loudly here rather than several steps later against a
    // confusing downstream number.
    const seedUnit = unitById(UNIT_ID);
    expect(seedUnit?.allocatable.value, "fixture assumption: RPH Adult Secure seeds allocatable=1").toBe(1);
    expect(seedUnit?.empty.value, "fixture assumption: RPH Adult Secure seeds empty=2").toBe(2);

    await gotoWard(page);

    // This unit already seeds one bed release (WR-001, confirmed) — never assumed empty. The
    // release this journey creates is identified by set difference before/after flagging, never
    // by a hardcoded id or `.first()`/`.last()` — the exact discipline `ui-ward-roles.spec.ts`'s
    // own comments (ruling R24) hold every other journey in this phase to.
    const releaseRows = page.locator('li[data-testid^="ward-bed-release-"]');
    const idsBefore = new Set(
      (await releaseRows.evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid")))).filter(
        (id): id is string => id !== null,
      ),
    );

    // --- Step 1: flag a bed coming free. No blocker chosen — a plain prediction. ---
    await page.locator("#ward-bed-release-confidence").selectOption("likely");
    await page.locator("#ward-bed-release-expected-at").fill("16:30");
    await page.getByTestId("ward-flag-bed-release-submit").click();

    await expect(releaseRows).toHaveCount(idsBefore.size + 1);
    const idsAfter = (
      await releaseRows.evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid")))
    ).filter((id): id is string => id !== null);
    const newRowTestId = idsAfter.find((id) => !idsBefore.has(id));
    expect(newRowTestId, "a new bed-release row must appear after flagging").toBeDefined();
    const releaseId = newRowTestId!.replace("ward-bed-release-", "");
    const releaseRow = page.getByTestId(newRowTestId!);
    await expect(releaseStateLabel(releaseRow)).toHaveText("Predicted");

    // --- The coordinator's capacity board reflects the flag: Predicted +1, Confirmed unmoved. ---
    await goToCapacityBoard(page);
    const cells = bedStateCells(page);
    await expect(cells.nth(0)).toHaveText("1Now");
    await expect(cells.nth(2)).toHaveText("1Confirmed"); // WR-001, seeded confirmed
    await expect(cells.nth(3)).toHaveText("1Predicted"); // the release just flagged

    // --- Step 2: back to the ward, confirm the release. ---
    await goBackToWard(page);
    await page.getByTestId(`ward-bed-release-confirm-${releaseId}`).click();
    await expect(releaseStateLabel(releaseRow)).toHaveText("Confirmed");

    // --- The board reflects the confirm: Confirmed +1, Predicted back to 0. ---
    await goToCapacityBoard(page);
    await expect(cells.nth(2)).toHaveText("2Confirmed");
    await expect(cells.nth(3)).toHaveText("0Predicted");

    // --- Step 3: back to the ward, block the release with a reason from the fixed list —
    // never free text (binding spec §4). ---
    await goBackToWard(page);
    await page.getByTestId(`ward-bed-release-block-toggle-${releaseId}`).click();
    await page.getByTestId(`ward-bed-release-blocker-${releaseId}`).selectOption("Awaiting clean");
    await page.getByTestId(`ward-bed-release-block-submit-${releaseId}`).click();
    // Bed-model rework (2026-08-28). Blocking is a FLAG, so the stage does not move: this row
    // still reads "Confirmed", AND it now also reads "Blocked". Before the rework the stage label
    // flipped to "Blocked" and the fact that the ward had already decided this discharge was
    // gone from the screen entirely.
    await expect(releaseStateLabel(releaseRow)).toHaveText("Confirmed");
    await expect(page.getByTestId(`ward-bed-release-blocked-flag-${releaseId}`)).toHaveText("Blocked");
    await expect(releaseRow).toContainText("Awaiting clean");

    // --- The board reflects the block WITHOUT losing the confirmed discharge. This assertion
    // used to read "1Confirmed" and was the browser-level statement of the defect the rework
    // exists to close: marking a confirmed discharge blocked dropped the ward's confirmed count
    // by one, so the figures improved at the exact moment the ward got stuck. The bed is still a
    // confirmed discharge — it is simply also stuck, and the stuck-ness is now its own figure. ---
    await goToCapacityBoard(page);
    await expect(cells.nth(2)).toHaveText("2Confirmed");
    await expect(cells.nth(3)).toHaveText("0Predicted");
    await expect(page.getByTestId("ward-capacity-headline-blocked-releases")).toContainText("Blocked releases");

    // --- Step 3b: the flag comes off again without touching the stage. A flag that can only ever
    // be set is not a flag, and under the four-stage model the only way out of "blocked" was a
    // state change — which is the conflation being undone. ---
    await goBackToWard(page);
    await page.getByTestId(`ward-bed-release-unblock-${releaseId}`).click();
    await expect(page.getByTestId(`ward-bed-release-blocked-flag-${releaseId}`)).toHaveCount(0);
    await expect(releaseStateLabel(releaseRow)).toHaveText("Confirmed");
    await goToCapacityBoard(page);
    await expect(cells.nth(2)).toHaveText("2Confirmed");

    // --- Step 4: back to the ward, release the bed — the one transition in this lifecycle that
    // changes a real, physical bed count rather than just a record about one. ---
    await goBackToWard(page);
    await page.getByTestId(`ward-bed-release-release-${releaseId}`).click();
    // `released` is terminal and drops off the ward's own pending list (spec D10).
    await expect(releaseRow).toHaveCount(0);

    // --- The board reflects the release: Now (`availableNow`) rises by one — the single number
    // this whole phase exists to protect, moving only once the bed is truly, physically free. ---
    await goToCapacityBoard(page);
    await expect(cells.nth(0)).toHaveText("2Now");
    await expect(cells.nth(2)).toHaveText("1Confirmed");
    await expect(cells.nth(3)).toHaveText("0Predicted");
  });
});
