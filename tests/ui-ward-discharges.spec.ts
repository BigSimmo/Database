import { expect, test, type Locator, type Page } from "playwright/test";

import { unitById } from "@/components/ward-management/ward-sites";

/**
 * Task 8 (Phase 5). One journey: a ward flags a bed coming free, confirms it, blocks it with a
 * reason from the fixed list, then releases it — and the coordinator's boards reflect each of
 * those four changes on the very next render, with no `page.goto()` anywhere after the first
 * navigation. Modelled on `tests/ui-ward-roles.spec.ts`'s "a ward confirming zero allocatable
 * beds updates its own screen, then the coordinator" journey — the same discipline applies here
 * for the same reason: a `goto` is a full page load that re-mounts `WardFlowProvider` and resets
 * every unit and bed release back to the seed fixture, which would make every assertion below
 * pass whether or not a ward's own bed-release action actually reaches the coordinator's boards.
 *
 * ⚠️ RETARGETED 2026-09-06. MERGE 02 (owner-approved 2026-09-05,
 * `docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md` §2) replaced the
 * `/mockups/ward-flow/capacity` route's content with `CapacityScreen`, a network-wide
 * bed-KIND-gap screen with no per-unit stage breakdown. The old `CapacityView` (`ward-capacity-view`
 * in `ward-management-modes.tsx`) that this journey used to read six figures off — Ready, Held,
 * Confirmed, Expected, Blocked, Occupied, per unit — is unreachable from any route today: nothing
 * passes `mode="capacity"` to `WardModeWorkspace` any more (measured by grep across `src/app` and
 * `src/components`), so it is orphaned code rather than a renamed testid. The per-release
 * lifecycle this journey exercises (expected → confirmed → blocked/unblocked → discharged) is
 * still live and reachable, on the **Discharges board** (`DischargeBoard` in
 * `discharge-board.tsx`, reachable at `/mockups/ward-flow/discharges`) — it groups every release
 * by exactly this lifecycle, reading the FLAG (blocked) before the STAGE (expected/confirmed) the
 * same way this journey's own step 3 comment already described, so it proves the same four
 * transitions without inventing behaviour the merged app does not have. The one figure the old
 * board read that the Discharges board does not carry — the physical "Ready" bed count — is
 * checked instead on the surviving, still-live **Capacity board** (`CapacityScreen`, same route,
 * new testid `ward-capacity-page`), whose network table carries a real per-unit Ready cell
 * (`ward-capacity-network-ready` inside `ward-capacity-network-row-<unitId>`).
 */

const UNIT_ID = "rph-adult-secure";
const UNIT_NAME = "RPH Adult Secure";

async function gotoWard(page: Page) {
  await page.goto(`/mockups/ward-flow/ward/${UNIT_ID}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  // The same streamed-content guard the containment test below already uses, and that
  // `tests/ui-ward-referrals.spec.ts` uses twice, applied here for the identical reason: React's
  // streaming leaves a hidden staging copy of the whole screen in the document for a moment, so
  // `ward-unit-screen` resolves to two elements and a strict-mode locator throws. This helper was
  // left behind when the containment test got the wait, so the journey below failed on its very
  // first navigation. Waiting the staging subtree out is the fix rather than relaxing the locator
  // to `.first()`, which would leave the journey asserting against whichever copy came first —
  // possibly the inert server-rendered one, which no click ever reaches.
  await expect(
    page.locator('div[hidden][id^="S:"]'),
    "React's streamed content is still staged, so the whole screen is duplicated in the document",
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });
}

/** Reaches the still-live Capacity board — used only for the physical Ready count, which the
 *  Discharges board does not carry. See this file's header for why this is no longer
 *  `ward-capacity-view`. */
async function goToCapacityBoard(page: Page) {
  await page.getByRole("link", { name: "Capacity", exact: true }).click();
  await expect(page.getByTestId("ward-capacity-page")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

/** Reaches the live Discharges board — the surviving home of the per-release lifecycle this
 *  journey exercises. "Discharges" is one of `WARD_NAV`'s `group: "board"` links, mounted on
 *  every Ward Flow route by `ClinicalRail` the same way "Capacity" and "Ward — <unit>" are. */
async function goToDischargesBoard(page: Page) {
  await page.getByRole("link", { name: "Discharges", exact: true }).click();
  await expect(page.getByTestId("ward-discharge-board")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

async function goBackToWard(page: Page) {
  await page.getByRole("link", { name: `Ward — ${UNIT_NAME}`, exact: true }).click();
  await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

/** This unit's Ready cell on the Capacity board's network table — the one figure from the old
 *  per-unit breakdown that survives on a still-reachable board. Read as a leading integer because
 *  the cell can also carry a "still being made ready" or "mid-update" note as sibling text
 *  (`capacity-screen.tsx`'s `NetworkRow`), and because a possible-zero cell renders the word
 *  "none" rather than the digit — a case this fixture never reaches (seeded allocatable=1). */
async function readyCountFor(page: Page, unitId: string): Promise<number> {
  const cellText = await page
    .getByTestId(`ward-capacity-network-row-${unitId}`)
    .getByTestId("ward-capacity-network-ready")
    .innerText();
  const match = /^\s*(\d+)/.exec(cellText);
  expect(match, `expected a leading integer in the Ready cell, got ${JSON.stringify(cellText)}`).not.toBeNull();
  return Number(match![1]);
}

/** This unit's row within one Discharges-board lifecycle group — `blocked`, `confirmed`,
 *  `expected` or `discharged-today` (`GroupKey` in `discharge-board.tsx`). A group with no
 *  releases renders no `ward-discharge-table-<group>` at all (only its own `-empty` note), so
 *  this resolves to zero matches rather than throwing when a group is empty — the same "absence
 *  is a fact, not a failure" reading the rest of this journey already relies on. */
function unitRowsInGroup(page: Page, groupKey: "blocked" | "confirmed" | "expected" | "discharged-today") {
  return page.getByTestId(`ward-discharge-table-${groupKey}`).locator("tbody tr").filter({ hasText: UNIT_NAME });
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

  test("a ward flags, confirms, blocks and releases a bed, and the coordinator's boards reflect every step without a reload", async ({
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
    // The Q1 axis change (2026-08-28): this picker asked for a confidence (`likely`) and now asks
    // what the discharge is waiting on. "Nothing outstanding" is the value for a prediction with
    // no obstacle — the closest thing to the old `likely`, and the right choice for a journey that
    // goes on to prove a plain prediction moves the release into the Discharges board's Expected
    // group.
    await page.locator("#ward-bed-release-waiting-on").selectOption("Nothing outstanding");
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
    await expect(releaseStateLabel(releaseRow)).toHaveText("Expected");

    // The physical Ready count before anything is actually released — read now, from the
    // still-live Capacity board, so the final step below can prove it moves by exactly one rather
    // than asserting a hardcoded "before" number that duplicates the fixture assumption above.
    await goToCapacityBoard(page);
    const readyBeforeRelease = await readyCountFor(page, UNIT_ID);

    // --- The Discharges board reflects the flag: this unit's new release sits in Expected,
    // and the seeded WR-001 confirmed release is untouched. ---
    await goToDischargesBoard(page);
    await expect(unitRowsInGroup(page, "expected")).toHaveCount(1);
    await expect(unitRowsInGroup(page, "confirmed")).toHaveCount(1); // WR-001, seeded confirmed
    await expect(unitRowsInGroup(page, "blocked")).toHaveCount(0);

    // --- Step 2: back to the ward, confirm the release. ---
    await goBackToWard(page);
    await page.getByTestId(`ward-bed-release-confirm-${releaseId}`).click();
    await expect(releaseStateLabel(releaseRow)).toHaveText("Confirmed");

    // --- The board reflects the confirm: this unit now has two Confirmed releases, none
    // Expected. ---
    await goToDischargesBoard(page);
    await expect(unitRowsInGroup(page, "confirmed")).toHaveCount(2);
    await expect(unitRowsInGroup(page, "expected")).toHaveCount(0);

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

    // --- The board reflects the block WITHOUT losing the confirmed discharge from view: the
    // release moves out of Confirmed (back to 1 — just WR-001) and into Blocked, where its own
    // Stage cell still reads "Confirmed" and its Blocker cell reads the chosen reason —
    // `discharge-board.tsx`'s own `groupDischarges` reads the flag before the stage for exactly
    // this reason (Ward Lead ruling E16), so a stuck discharge is never mistaken for an
    // undecided one. ---
    await goToDischargesBoard(page);
    await expect(unitRowsInGroup(page, "confirmed")).toHaveCount(1);
    const blockedRow = unitRowsInGroup(page, "blocked");
    await expect(blockedRow).toHaveCount(1);
    await expect(blockedRow).toContainText("Confirmed");
    await expect(blockedRow).toContainText("Awaiting clean");

    // --- Step 3b: the flag comes off again without touching the stage. A flag that can only ever
    // be set is not a flag, and under the four-stage model the only way out of "blocked" was a
    // state change — which is the conflation being undone. ---
    await goBackToWard(page);
    await page.getByTestId(`ward-bed-release-unblock-${releaseId}`).click();
    await expect(page.getByTestId(`ward-bed-release-blocked-flag-${releaseId}`)).toHaveCount(0);
    await expect(releaseStateLabel(releaseRow)).toHaveText("Confirmed");
    await goToDischargesBoard(page);
    await expect(unitRowsInGroup(page, "confirmed")).toHaveCount(2);
    await expect(unitRowsInGroup(page, "blocked")).toHaveCount(0);

    // --- Step 4: back to the ward, release the bed — the one transition in this lifecycle that
    // changes a real, physical bed count rather than just a record about one. ---
    await goBackToWard(page);
    await page.getByTestId(`ward-bed-release-release-${releaseId}`).click();
    // `discharged` is terminal and drops off the ward's own pending list (spec D10).
    await expect(releaseRow).toHaveCount(0);

    // --- The Discharges board reflects the release: back to one Confirmed row (WR-001 alone)
    // and this unit's release now sits in Discharged today. ---
    await goToDischargesBoard(page);
    await expect(unitRowsInGroup(page, "confirmed")).toHaveCount(1);
    await expect(unitRowsInGroup(page, "discharged-today")).toHaveCount(1);

    // --- The Capacity board reflects the release: Ready rises by one — the single number this
    // whole phase exists to protect, moving only once the bed is truly, physically free. ---
    await goToCapacityBoard(page);
    await expect
      .poll(() => readyCountFor(page, UNIT_ID), {
        message: "physical Ready count must rise by exactly one once the bed is actually released",
      })
      .toBe(readyBeforeRelease + 1);
  });

  /**
   * Phase 8, Task 10 fix round (F4). The discharges board's tables, across every width they are
   * narrower at than they want to be.
   *
   * The Task 10 review noticed that `discharges.module.css` carried the same `.tableScroll` /
   * `.table { min-width }` pattern that had just been found defective on the out-of-area ledger,
   * 96px wider (44rem against 38rem), and that the pass had not looked at it. Measured in a
   * browser before anything was changed, it reproduced on all four groups: `Freshness` — who
   * confirmed this discharge and when — sat outside its scroller at 641, 700, 760 and 820px, and
   * at 641px `Blocker` did too. Both were in the document at every one of those widths, which is
   * exactly why nothing already on this branch could see it.
   *
   * Asserted as geometric containment rather than as a stylesheet value, so it goes on holding
   * whatever the table's widths, the shell's padding or the icon rail become — and it is checked
   * at four widths rather than one because, unlike the ledger's, this table's defective band ran
   * well past the breakpoint where the card layout hands over.
   *
   * The floor first: every group must be rendering a table with cells in it. `toEqual([])` on a
   * list of escaping cells passes trivially against a board that renders nothing at all, and this
   * page renders its tables only when a group has entries.
   */
  test("no column of the discharges board's tables is off the screen at any width the table is used at", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 641, height: 900 });
    await page.goto("/mockups/ward-flow/discharges", { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    // The streamed-content guard `tests/ui-ward-referrals.spec.ts` uses, and for the same reason:
    // React's streaming leaves a hidden staging copy of the whole screen in the document for a
    // moment, so every testid on this page resolves to two elements and a strict-mode locator
    // throws. Measuring geometry against a staged duplicate would be meaningless even if it did
    // not throw, so this waits for the staging subtree to go rather than retrying through it.
    await expect(
      page.locator('div[hidden][id^="S:"]'),
      "React's streamed content is still staged, so the whole screen is duplicated in the document",
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("ward-discharge-board")).toBeVisible({ timeout: 15_000 });

    const scrollers = page.locator('[data-testid^="ward-discharge-table-"]');
    const scrollerCount = await scrollers.count();
    expect(
      scrollerCount,
      "the discharges board renders no table under `ward-discharge-table-`, so the containment assertion below would pass having measured nothing",
    ).toBeGreaterThan(0);

    /*
     * PRESENCE BEFORE CONTAINMENT — whole-branch review, W1.
     *
     * The geometric loop below measures whether a column ESCAPES its scroller. It says nothing
     * about whether the column is there at all, and two ways of removing one pass it silently:
     * delete the `th`/`td` pair and there is simply less to measure, or set `display: none` on it
     * and the cell keeps a zero-sized rect whose `right` is 0, which can never exceed the
     * scroller's. The `cells > 0` floor further down does not close either — five columns satisfy
     * it as happily as six. `Freshness` — who confirmed this discharge and when, and the very
     * column the containment check was built for — appeared in no assertion anywhere in `tests/`.
     *
     * `toHaveText` with an array pins the count, the order and the spelling in a single assertion.
     * It does NOT close the hiding case, and the per-header `toBeVisible` loop below is not
     * decoration: the review that raised this expected `toHaveText` to read only visible text, and
     * it does not — Playwright compares `textContent` unless told otherwise, so a `th` carrying
     * `display: none` still supplies its text. MEASURED, not assumed: with
     * `style={{ display: "none" }}` on this table's `Freshness` header, the array assertion alone
     * passed. `toBeVisible` is the matcher that fails for `display: none`, `visibility: hidden` and
     * a zero-size box alike, which is the whole class the geometric loop cannot see.
     *
     * ⚠️ **THIS WAS PINNED ON THE FIRST TABLE ONLY, AND THE REASON GIVEN STOPPED BEING TRUE ON
     * 2026-09-05.** The comment here read: *"every group renders the same `<thead>` from one
     * component, so one is the header contract and four would be the same assertion written four
     * times."* Ward Lead ruling E16 dropped the `Blocker` column from the three non-blocked groups
     * — `groupDischarges` routes every release with a blocker into `blocked`, so the cell said
     * "Not applicable" on every row elsewhere — and the four `<thead>`s stopped agreeing. **The
     * assertion would have gone on passing, still green, still measuring the blocked table, while
     * three tables it silently claimed to cover went unpinned.** A guard that keeps asking its
     * original question after the answer has changed shape is the failure this file's own W1 note
     * is about, one layer up.
     *
     * Both shapes are pinned now, and each is checked on the group it belongs to. Nothing below is
     * relaxed to make room for these.
     */
    const DISCHARGE_COLUMNS = ["Unit", "Health service", "Expected", "Stage", "Blocker", "Freshness"];
    const DISCHARGE_COLUMNS_NO_BLOCKER = ["Unit", "Health service", "Expected", "Stage", "Freshness"];
    const columnsByGroup: ReadonlyArray<readonly [string, readonly string[]]> = [
      ["blocked", DISCHARGE_COLUMNS],
      ["confirmed", DISCHARGE_COLUMNS_NO_BLOCKER],
      ["expected", DISCHARGE_COLUMNS_NO_BLOCKER],
      ["discharged-today", DISCHARGE_COLUMNS_NO_BLOCKER],
    ];
    for (const [groupKey, columns] of columnsByGroup) {
      const table = page.getByTestId(`ward-discharge-table-${groupKey}`);
      await expect(
        table,
        `the discharges board renders no table for \`${groupKey}\`, so its column contract went unchecked`,
      ).toBeVisible();
      const headers = table.locator("thead th");
      await expect(
        headers,
        `the \`${groupKey}\` group no longer carries exactly these columns, in this order`,
      ).toHaveText([...columns]);
      for (const [index, column] of columns.entries()) {
        await expect(
          headers.nth(index),
          `the \`${groupKey}\` group's \`${column}\` column is in the document but not on the screen`,
        ).toBeVisible();
      }
    }

    for (const width of [641, 700, 760, 820]) {
      await page.setViewportSize({ width, height: 900 });
      const measured = await scrollers.evaluateAll((nodes) =>
        nodes.map((scroll) => {
          const right = scroll.getBoundingClientRect().right;
          const cells = [...scroll.querySelectorAll("thead th, tbody tr:first-child td")];
          return {
            id: scroll.getAttribute("data-testid") ?? "(no testid)",
            cells: cells.length,
            clipped: cells
              .filter((cell) => cell.getBoundingClientRect().right > right + 1)
              .map(
                (cell) =>
                  `${(cell.textContent ?? "").trim()} (right edge ${Math.round(cell.getBoundingClientRect().right)} vs scroller ${Math.round(right)})`,
              ),
          };
        }),
      );
      for (const table of measured) {
        expect(table.cells, `${table.id} at ${width}px renders no cells to measure`).toBeGreaterThan(0);
        expect(
          table.clipped,
          `column(s) of ${table.id} are off the screen at ${width}px, reachable only by scrolling sideways inside the table`,
        ).toEqual([]);
      }
    }
  });
});
