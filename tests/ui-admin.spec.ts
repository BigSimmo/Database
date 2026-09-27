import { expect, test, type Page } from "playwright/test";

import { visibleByTestId } from "./playwright-settlement";

/**
 * Admin's own short browser journey (Task 10, integration): the two retired
 * paths, the pill's identity, Help's phone layout, and the one-composer
 * contract every Admin page keeps.
 *
 * Case 2 checks the Checklist tab's real grouped headings rather than the
 * "Blocking / Partial / Chased / Unrecorded" bands task-10-brief.md names.
 * Those bands belonged to the original compliance-section design; Josh's
 * 18:48Z approval (see `.superpowers/sdd/plan-update-1/lane-rules.md`'s
 * "Efficiency" note and lane-b-ui-report.md) rebuilt Renewals as the
 * final-design Requirements checklist before this spec was written, and that
 * page groups its rows by state ("Soonest first", "No end date", "Not
 * recorded yet"), never by the old band words — nothing in the shipped app
 * renders them (`git grep` confirms). This spec asserts what actually ships.
 */

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

/** Admin's mode identity, `--type-form` in light mode (spec, AGENTS.md). */
const ADMIN_IDENTITY_LIGHT_RGB = "rgb(125, 90, 44)";

async function gotoPhone(page: Page, path: string) {
  await page.setViewportSize({ width: PHONE_WIDTH, height: PHONE_HEIGHT });
  await page.goto(path);
}

/** Every visible `position: fixed` element's bounding box, for overlap checks. */
async function fixedElementBoxes(page: Page) {
  return page.evaluate(() => {
    const boxes: { label: string; top: number; left: number; right: number; bottom: number }[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
      if (getComputedStyle(element).position !== "fixed") continue;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      boxes.push({
        label: element.getAttribute("data-testid") ?? element.tagName,
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
      });
    }
    return boxes;
  });
}

test.describe("Admin mode — redirects, pill identity and shared chrome", () => {
  test("/my-work lands on /admin, and the pill names Admin's Today page", async ({ page }) => {
    await page.goto("/my-work");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("button", { name: "Mode Admin, page Today" })).toBeVisible();
  });

  test("/on-call/compliance lands on /admin/renewals, keeping the checklist's own groups", async ({ page }) => {
    await page.goto("/on-call/compliance");
    await expect(page).toHaveURL(/\/admin\/renewals$/);
    await expect(page.getByRole("heading", { level: 1, name: "Renewals" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Checklist" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Personal" })).toBeVisible();
    // CI runs this in demo mode. The demo corpus links three rows to catalogue
    // items (`src/lib/on-call/demo-entries.ts`), so "Soonest first" holds them
    // and the rest of the catalogue waits under "Not recorded yet".
    // `tests/admin-requirements.test.ts` pins that corpus property offline.
    await expect(page.getByRole("heading", { name: "Soonest first" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Not recorded yet" })).toBeVisible();
    await expect(visibleByTestId(page, "admin-renewals-checklist-row-medical-registration-renewal")).toBeVisible();
  });

  test("at 390px, Help puts its crisis lines ahead of every content tab, and the active tab underlines in Admin's identity colour with no brown button anywhere", async ({
    page,
  }) => {
    await gotoPhone(page, "/admin/help");

    const crisis = visibleByTestId(page, "admin-help-crisis");
    await expect(crisis).toBeVisible();

    const rail = visibleByTestId(page, "admin-section-header-section-rail");
    await expect(rail).toBeVisible();

    // Crisis lines are the page's first real content — above every one of the
    // four content tabs' own sections — even though the tab rail is chrome
    // that sits above all of it, including crisis lines (see the file header).
    const crisisTop = (await crisis.boundingBox())?.y ?? Number.POSITIVE_INFINITY;
    for (const label of ["Support", "Guides", "Contacts", "On site"]) {
      const section = page.locator(`section:has(> h2:text-is("${label}"))`);
      const sectionTop = (await section.boundingBox())?.y ?? Number.NEGATIVE_INFINITY;
      expect(sectionTop, `${label}'s section should sit below the crisis lines`).toBeGreaterThan(crisisTop);
    }

    // Whichever tab settled active, its underline resolves through the rail's
    // own `data-mode-identity="my-work"` remap to Admin's brown, not the
    // product accent.
    await expect
      .poll(async () => rail.locator('button[aria-current="true"] .mode-nav__rule').count())
      .toBeGreaterThan(0);
    const activeUnderline = rail.locator('button[aria-current="true"] .mode-nav__rule').first();
    await expect(activeUnderline).toHaveCSS("background-color", ADMIN_IDENTITY_LIGHT_RGB);

    // Brown is identity only (standard §3): never on a button, anywhere on
    // this page, including the rail's own buttons.
    const buttonBackgrounds = await page
      .locator("button")
      .evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).backgroundColor));
    expect(buttonBackgrounds).not.toContain(ADMIN_IDENTITY_LIGHT_RGB);
  });

  test("at 390px, no Admin page renders the shared search composer or a microphone, and Renewals' floating Add sits clear of every other fixed control", async ({
    page,
  }) => {
    for (const path of ["/admin", "/admin/renewals", "/admin/new-job", "/admin/help"]) {
      await gotoPhone(page, path);
      // The mode declares no results surface (`resultsSurface: "none"`), so no
      // Admin page may grow the shared composer — the same one-composer
      // contract `tests/ui-on-call-boards.spec.ts` holds On Call to.
      await expect(page.locator('[data-testid="global-search-composer"]')).toHaveCount(0);
      await expect(page.getByRole("button", { name: /microphone/i })).toHaveCount(0);
    }

    await gotoPhone(page, "/admin/renewals");
    const add = visibleByTestId(page, "admin-renewals-add");
    await expect(add).toBeVisible();
    const addBox = await add.boundingBox();
    expect(addBox).not.toBeNull();

    const otherFixed = (await fixedElementBoxes(page)).filter((box) => box.label !== "admin-renewals-add");
    for (const other of otherFixed) {
      const xOverlap = Math.min(addBox!.x + addBox!.width, other.right) - Math.max(addBox!.x, other.left);
      const yOverlap = Math.min(addBox!.y + addBox!.height, other.bottom) - Math.max(addBox!.y, other.top);
      // 4px tolerance for subpixel rounding, matching tests/ui-overlap.spec.ts.
      expect(xOverlap > 4 && yOverlap > 4, `"admin-renewals-add" overlaps fixed control "${other.label}"`).toBe(false);
    }
  });
});
