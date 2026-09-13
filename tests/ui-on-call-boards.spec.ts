import { expect, test, type Locator, type Page } from "playwright/test";

/**
 * The eleven artboards, checked against the screen the app actually renders.
 *
 * `tests/on-call-mockup-conformance.test.ts` holds the written record of which
 * drawn element is built, deliberately different, or waiting on the database —
 * but it can only prove that a testid EXISTS IN SOURCE. That is a real ceiling,
 * and it was named in review: a `built` claim could cite a testid that lives
 * only in dead code, or in a branch that never renders, and the offline gate
 * would pass. This spec is the other half. Every element the ledger calls
 * `built` is asserted here, in a browser, on the page a reader would open.
 *
 * The width is 390px because that is the width every board was drawn at. The
 * other widths are the SITE's, not the drawing's — 320px is this repository's
 * blocking narrow breakpoint, and the tablet and desktop points are where the
 * shared chrome changes owner. A hub that matches the drawing at 390px and
 * breaks at 320px has not matched anything worth having.
 *
 * The assertions deliberately go beyond the drawing where the site's own system
 * is stricter than it: measured 48px tap targets rather than the drawing's
 * smaller pills, no horizontal overflow at any width, and the mode's own
 * contract that no search composer appears on any of these routes. Those are
 * the places the built screen should be BETTER than the mockup, and the only
 * way to keep it that way is to assert it.
 *
 * Data comes from the demo corpus (`src/lib/on-call/demo-entries.ts`), which
 * exists so that every drawn module has something to draw. A module with no
 * data renders nothing, and an assertion against an empty page proves nothing.
 */

/** The width every artboard was drawn at. */
const BOARD_WIDTH = 390;
const BOARD_HEIGHT = 844;

/** The site's own widths, which the drawing says nothing about. */
const NARROW = 320;
const TABLET = 768;
const DESKTOP = 1280;

/** This repository's production tap floor, in CSS pixels. */
const TAP_FLOOR = 48;

const ROUTES = {
  home: "/on-call",
  contacts: "/on-call/contacts",
  playbook: "/on-call/playbook",
  referrals: "/on-call/referrals",
  orientation: "/on-call/orientation",
  teaching: "/on-call/education",
  logistics: "/on-call/logistics",
  whoIsWho: "/on-call/who-is-who",
} as const;

/** The list each section route renders once its entries have arrived. */
const SECTION_LIST_TEST_IDS: Record<string, string> = {
  [ROUTES.contacts]: "on-call-contacts-section",
  [ROUTES.playbook]: "on-call-playbook-section",
  [ROUTES.referrals]: "on-call-referrals-section",
  [ROUTES.orientation]: "on-call-orientation-section",
  [ROUTES.teaching]: "on-call-education-section",
  [ROUTES.logistics]: "on-call-logistics-section",
  [ROUTES.whoIsWho]: "on-call-who-is-who-section",
};

async function openBoard(page: Page, route: string, width = BOARD_WIDTH) {
  await page.setViewportSize({ width, height: BOARD_HEIGHT });
  await page.goto(route, { waitUntil: "domcontentloaded" });
  // The entry store fetches on the client, so every board below waits on data
  // rather than on the shell. The hub has no page header, so the two wait on
  // different things: the hub on its tile grid, a section page on its header.
  if (route === ROUTES.home) {
    await expect(page.getByTestId("on-call-home-sections")).toBeVisible({ timeout: 20_000 });
    return;
  }
  // `.first()`, and a settle on the count, because a client-side route change
  // keeps the outgoing page's tree mounted until the incoming one is ready —
  // so for a moment two headers exist and a strict locator fails on the pair
  // rather than on anything being wrong.
  await expect(page.getByTestId("on-call-section-detail-header").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("on-call-section-detail-header")).toHaveCount(1, { timeout: 20_000 });
  // The header renders before the fetch resolves, so waiting on it alone would
  // measure the loading state. The list component mounts only once entries have
  // arrived, which is the signal that the page is actually the page.
  const listTestId = SECTION_LIST_TEST_IDS[route];
  if (listTestId) await expect(page.getByTestId(listTestId)).toBeVisible({ timeout: 20_000 });
}

/**
 * Fails when anything reaches past the right edge — the site's rule, not the
 * drawing's.
 *
 * Two checks, because the obvious one is not enough. `scrollWidth` catches a
 * page that can be dragged sideways, but a container with `overflow: hidden`
 * absorbs the excess and the page stays exactly as wide as the viewport while
 * the words at the right are simply gone. That is the worse failure — nothing
 * looks broken, the text has just been cut — so the second check walks the
 * rendered boxes and names the element that crossed the edge.
 *
 * Elements that scroll on purpose are excluded by their own container: the
 * ward strip and the chip rows carry `overflow-x: auto`, so their children are
 * meant to sit outside the viewport.
 */
async function expectNoHorizontalOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const limit = doc.clientWidth + 1;
    const scrollsOnPurpose = (node: Element) => {
      let current: Element | null = node;
      while (current) {
        const overflowX = getComputedStyle(current).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") return true;
        current = current.parentElement;
      }
      return false;
    };
    let offender: { tag: string; text: string; right: number } | null = null;
    for (const element of Array.from(doc.querySelectorAll("*"))) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.right <= limit) continue;
      // Only the narrowest offender is worth naming; its ancestors are stretched by it.
      if (element.querySelector("*")) continue;
      if (scrollsOnPurpose(element)) continue;
      offender = { tag: element.tagName, text: (element.textContent ?? "").slice(0, 50), right: Math.round(box.right) };
      break;
    }
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, offender };
  });
  expect(result.scrollWidth, `${label} scrolls sideways`).toBeLessThanOrEqual(result.clientWidth + 1);
  expect(
    result.offender,
    `${label}: <${result.offender?.tag}> "${result.offender?.text}" reaches ${result.offender?.right}px, past the ${result.clientWidth}px edge`,
  ).toBeNull();
}

/** Measures the rendered box, not the class name. */
async function expectTapFloor(target: Locator, label: string) {
  const box = await target.boundingBox();
  expect(box, `${label} has no box`).not.toBeNull();
  expect(box!.height, `${label} is ${box!.height}px tall, under the ${TAP_FLOOR}px floor`).toBeGreaterThanOrEqual(
    TAP_FLOOR - 0.5,
  );
}

test.describe("01 Home", () => {
  test("draws every module the board draws, in the order it draws them", async ({ page }) => {
    await openBoard(page, ROUTES.home);

    const modules = [
      "on-call-home-call-first",
      "on-call-home-wards",
      "on-call-home-pinned-module",
      "on-call-home-upcoming",
      "on-call-home-sections",
    ];
    for (const id of modules) {
      await expect(page.getByTestId(id), `${id} is drawn on board 01 but does not render`).toBeVisible();
    }

    // Top to bottom in the drawn order. A module that renders in the wrong
    // place still passes a presence check, and the order is the board.
    const tops = await Promise.all(
      modules.map(async (id) => (await page.getByTestId(id).boundingBox())?.y ?? Number.NaN),
    );
    for (let index = 1; index < tops.length; index += 1) {
      expect(tops[index], `${modules[index]} is above ${modules[index - 1]}`).toBeGreaterThan(tops[index - 1]!);
    }
  });

  test("puts two call cards and the switchboard row under Call first", async ({ page }) => {
    await openBoard(page, ROUTES.home);
    const callFirst = page.getByTestId("on-call-home-call-first");
    const cards = callFirst.locator('[data-testid^="on-call-home-call-"]').filter({ hasNot: page.locator("nothing") });
    await expect(cards.first()).toBeVisible();
    await expect(page.getByTestId("on-call-home-switchboard")).toBeVisible();
    // The drawing's whole argument for this module: one tap rings it.
    await expect(page.getByTestId("on-call-home-switchboard")).toHaveAttribute("href", /^tel:/);
    await expectTapFloor(page.getByTestId("on-call-home-switchboard"), "switchboard row");
  });

  test("scrolls the ward strip inside itself rather than the page", async ({ page }) => {
    await openBoard(page, ROUTES.home);
    const wards = page.getByTestId("on-call-home-wards");
    await expect(wards.locator('[data-testid^="on-call-home-ward-"]').first()).toBeVisible();
    await expectNoHorizontalOverflow(page, "the home with a ward strip on it");
  });

  test("paints the pinned reminder in the mode's own colour, with an icon and words too", async ({ page }) => {
    await openBoard(page, ROUTES.home);
    const pinned = page.getByTestId("on-call-home-pinned");
    await expect(pinned).toBeVisible();
    // Colour is never the only signal: the row carries a heading and a glyph.
    await expect(pinned.locator("svg")).toHaveCount(2);
    const painted = await pinned.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(painted).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("dates the next teaching session with a weekday, as drawn", async ({ page }) => {
    await openBoard(page, ROUTES.home);
    const row = page.getByTestId("on-call-home-upcoming").locator('[data-testid^="on-call-home-upcoming-"]').first();
    await expect(row).toBeVisible();
    await expect(row).toContainText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
  });

  test("gives every section a tile, and gives Who's who no count", async ({ page }) => {
    await openBoard(page, ROUTES.home);
    const tiles = page.getByTestId("on-call-home-sections").locator('[data-testid^="on-call-home-tile-"]');
    await expect(tiles).toHaveCount(7);
    // Board 01 draws this one differently and without a number: the others
    // count things to read, this one explains the ladder.
    await expect(page.getByTestId("on-call-home-tile-who-is-who")).not.toContainText(/\d/);
  });

  test("puts the page menu in the universal header, and offers no chat there", async ({ page }) => {
    await openBoard(page, ROUTES.home);
    const trigger = page.getByTestId("on-call-page-menu-trigger");
    await expect(trigger).toBeVisible();
    await expectTapFloor(trigger, "hub page menu trigger");

    // On Call answers nothing, so there is no conversation to start. The
    // button used to be stood down only while a page filled the header's
    // trailing slot, which meant it came back the moment a page put its own
    // controls somewhere else.
    await expect(page.getByRole("button", { name: "Start a new chat" })).toHaveCount(0);
  });

  test("holds together at the site's narrow width, which the drawing never shows", async ({ page }) => {
    await openBoard(page, ROUTES.home, NARROW);
    await expect(page.getByTestId("on-call-home-sections")).toBeVisible();
    await expectNoHorizontalOverflow(page, "the home at 320px");
  });
});

test.describe("02 More, 03 All modes — the pill owns page switching", () => {
  test("opens this mode's own sections from the pill, with one tap back to all modes", async ({ page }) => {
    await openBoard(page, ROUTES.contacts, DESKTOP);
    await page.getByRole("button", { name: /Mode/ }).first().click();

    // In a mode that owns its own pages the pill opens THOSE, drawn like the
    // switcher everywhere else, rather than making a reader step in from the
    // full mode list every time they want another section.
    const sections = page.locator("#app-mode-menu");
    await expect(sections).toBeVisible();
    await expect(sections).toHaveAttribute("aria-label", /On Call pages/);
    await expect(sections.getByRole("link", { name: "Tonight" })).toBeVisible();

    // And never a dead end: the level above is one control away.
    await page.getByTestId("app-mode-popover-back").click();
    await expect(page.locator("#app-mode-menu")).toHaveAttribute("aria-label", /Choose app mode/);
  });

  test("carries no second bar repeating those same destinations", async ({ page }) => {
    // The whole point of the change. The pill above already opens the nine
    // pages; a rail underneath listing the same nine was two controls doing
    // one job, and it hid five of them behind "More" while doing it.
    for (const route of [ROUTES.home, ROUTES.contacts, ROUTES.playbook, ROUTES.logistics]) {
      await openBoard(page, route);
      await expect(page.getByTestId("mode-nav")).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "On Call pages" })).toHaveCount(0);
    }
  });
});

test.describe("02 More — the second row is about the page you are on", () => {
  test("names the page and the group you are in, with a way back to the hub", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    const header = page.getByTestId("on-call-section-detail-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("Contacts");
    await expect(header.getByRole("link", { name: /back to on call/i })).toHaveAttribute("href", "/on-call");
  });

  test("opens this page's own groups, not the mode's nine sections", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    await page.getByTestId("on-call-section-section-trigger").click();

    // The areas Contacts files its rows under. This is the assertion jsdom
    // cannot make: section resolution tests visibility with getClientRects,
    // which jsdom reports empty for everything.
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("button", { name: /Wards/ })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Services/ })).toBeVisible();
    // Not the routes — those belong to the pill.
    await expect(sheet.getByRole("button", { name: /^Playbook/ })).toHaveCount(0);
  });

  test("jumps to a group and says so afterwards", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    await page.getByTestId("on-call-section-section-trigger").click();
    await page.getByRole("dialog").getByRole("button", { name: /Wards/ }).click();

    const wards = page.locator("#on-call-group-wards");
    await expect(wards).toBeInViewport({ timeout: 5_000 });
    // The header's second line follows the reader down the page.
    await expect(page.getByTestId("on-call-section-section-trigger")).toContainText("Wards");
  });

  test("says the page's name once, and still offers no chat", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    // The header, the hero and the entries heading all painted "Contacts", one
    // under the other, on a 390px screen — and both headings are now named for
    // a screen reader only.
    //
    // Measured, not counted by role: the `<h1>` names the page and the `<h2>`
    // labels the list region, so both are still in the accessibility tree; each
    // is clipped to a pixel. The name is painted once, by the sticky header,
    // which is a navigation control rather than a heading.
    const titles = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("h1, h2, h3")).filter(
        (node) => node.textContent?.trim() === "Contacts",
      );
      return {
        headings: headings.length,
        painted: headings.filter((node) => node.getBoundingClientRect().height > 16).length,
      };
    });
    expect(titles.headings, "the page must still be named for a screen reader").toBeGreaterThanOrEqual(1);
    expect(titles.painted, "a heading repeats the name the header already shows").toBe(0);
    await expect(page.getByTestId("on-call-section-detail-header")).toContainText("Contacts");

    // And the header is the only thing above the list: no eyebrow repeating
    // the mode, no display-size title, no paragraph explaining how the section
    // is filed. The first thing under the header is the page's own content.
    await expect(page.getByText("ON CALL", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Filed by role first/)).toHaveCount(0);
    // Nor a chip row, which named the same groups the header's jump list
    // names. The first thing under the header is the first group.
    await expect(page.getByTestId("on-call-contacts-filters")).toHaveCount(0);
    const firstGroup = page.getByTestId("on-call-contacts-group-needs-checking");
    const header = page.getByTestId("on-call-section-detail-header");
    const [groupBox, headerBox] = [await firstGroup.boundingBox(), await header.boundingBox()];
    // The threshold is the height of a control band, not a design opinion: a
    // chip row or a toolbar is a 48px control plus its gaps, so anything that
    // reappears between the header and the list pushes this well past 72. The
    // shell's own top padding accounts for the ~48 that is there.
    expect(
      groupBox!.y - (headerBox!.y + headerBox!.height),
      "a band of controls has reappeared between the header and the list",
    ).toBeLessThan(72);
    await expect(page.getByRole("button", { name: "Start a new chat" })).toHaveCount(0);
  });

  test("drops back to a plain title on a page with nothing to jump between", async ({ page }) => {
    // Teaching is the one page with no facet to file by — its sessions are
    // dated, not tagged — so it stays one flat list. A jump list of one row is
    // furniture, and the header is simply a title.
    //
    // Referrals used to be this test's subject. It gained groups when its chip
    // row went, which is the point: removing the chips would otherwise have
    // left that page with no way to move around it at all.
    await openBoard(page, ROUTES.teaching);
    await expect(page.getByTestId("on-call-section-detail-header")).toBeVisible();
    await expect(page.getByTestId("on-call-section-section-trigger")).toHaveCount(0);
  });

  test("gives a page that lost its chips real groups instead", async ({ page }) => {
    await openBoard(page, ROUTES.referrals);
    await expect(page.getByTestId("on-call-referrals-filters")).toHaveCount(0);
    const groups = page.locator('[data-testid^="on-call-referrals-group-"]');
    expect(await groups.count()).toBeGreaterThan(1);

    // And the header can now move between them, which the flat list could not.
    await page.getByTestId("on-call-section-section-trigger").click();
    await expect(page.getByRole("dialog").getByRole("button", { name: /Community/ })).toBeVisible();
  });

  test("gives the orientation shelf its groups too", async ({ page }) => {
    await openBoard(page, ROUTES.orientation);
    await expect(page.getByTestId("on-call-orientation-filters")).toHaveCount(0);
    expect(await page.locator('[data-testid^="on-call-orientation-group-"]').count()).toBeGreaterThan(1);
  });

  test("declares no anchor the page does not render", async ({ page }) => {
    await openBoard(page, ROUTES.logistics);
    await page.getByTestId("on-call-section-section-trigger").click();
    const labels = await page.getByRole("dialog").getByRole("button").allInnerTexts();
    for (const label of labels) {
      const slug = label
        .split("\n")[0]!
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!slug || slug === "close") continue;
      await expect(page.locator(`#on-call-group-${slug}`), `${label} is offered but absent`).toHaveCount(1);
    }
  });
});

test.describe("05 Page menu", () => {
  test("opens from the header's own control, not from the page body", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    const trigger = page.getByTestId("on-call-section-actions-trigger");
    await expect(trigger).toBeVisible();
    await expectTapFloor(trigger, "page menu trigger");
    // The actions live on the page's own header now, not in a second portal
    // into the universal header — one header row owns the whole page.
  });

  test("carries the order control, the pocket card, and the privacy explanation", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    await page.getByTestId("on-call-section-actions-trigger").click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("on-call-page-menu-order")).toBeVisible();
    await expect(page.getByTestId("on-call-page-menu-card")).toBeVisible();
    await expect(page.getByTestId("on-call-page-menu-privacy")).toBeVisible();
    // Board 05 puts the order control inside the sheet at phone width rather
    // than letting it claim a band of its own above the list.
    const orderBox = await page.getByTestId("on-call-page-menu-order").boundingBox();
    const sheetBox = await sheet.boundingBox();
    expect(orderBox!.y).toBeGreaterThanOrEqual(sheetBox!.y - 1);
  });

  test("reorders the list from the sheet", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    await expect(page.getByTestId("on-call-contacts-group-tonight")).toBeVisible();
    await page.getByTestId("on-call-section-actions-trigger").click();
    await page.getByRole("radio", { name: "By role" }).click();
    await expect(page.getByTestId("on-call-contacts-group-role")).toBeVisible();
    await expect(page.getByTestId("on-call-contacts-group-tonight")).toHaveCount(0);
  });
});

test.describe("06 Contacts", () => {
  test("puts the overdue group at the top, above the area groups, and no chip row", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    await expect(page.getByTestId("on-call-contacts-filters")).toHaveCount(0);
    const needsChecking = page.getByTestId("on-call-contacts-group-needs-checking");
    await expect(needsChecking).toBeVisible();

    // Board 06's rule: overdue rows collect at the TOP rather than hiding in
    // place among the good ones.
    const overdueTop = (await needsChecking.boundingBox())!.y;
    const firstAreaTop = (await page.getByTestId("on-call-contacts-group-tonight").boundingBox())!.y;
    expect(overdueTop).toBeLessThan(firstAreaTop);
  });

  test("reaches a group without hiding the others", async ({ page }) => {
    // What the chip row used to do, and the reason it went: tapping "Wards"
    // REMOVED Tonight and Services from the page, so a mistap cost the reader
    // the list rather than their place. The jump list moves them instead.
    await openBoard(page, ROUTES.contacts);
    const trigger = page.getByTestId("on-call-section-section-trigger");
    await expectTapFloor(trigger, "section pill");
    await trigger.click();
    await page.getByRole("dialog").getByRole("button", { name: /Wards/ }).click();

    await expect(page.locator("#on-call-group-wards")).toBeInViewport({ timeout: 5_000 });
    await expect(page.getByTestId("on-call-contact-row-demo-ward-one")).toBeVisible();
    // Still on the page, which is the whole difference from a filter.
    await expect(page.getByTestId("on-call-contact-row-demo-interpreter-line")).toHaveCount(1);
  });

  test("rings the number from anywhere on the row, and shows the call disc", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    const row = page.getByTestId("on-call-contact-row-demo-nurse-manager");
    await expect(row).toHaveAttribute("href", /^tel:/);
    await expectTapFloor(row, "contact row");
    // The disc is decoration inside the link: one target for one action.
    await expect(row.locator("button")).toHaveCount(0);
  });

  test("shows a private row's rule and withholds its digits", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    const row = page.getByTestId("on-call-contact-row-demo-private-line");
    await expect(row).toBeVisible();
    await expect(row.getByTestId("on-call-private-flag")).toContainText("Private");
    await expect(row).not.toContainText(/0000 000 0\d\d/);
    // Board 06 draws no call control on it either.
    expect(await row.getAttribute("href")).toBeNull();
  });

  test("stays inside the viewport at the site's narrow width", async ({ page }) => {
    await openBoard(page, ROUTES.contacts, NARROW);
    await expect(page.getByTestId("on-call-contacts-group-needs-checking")).toBeVisible();
    await expectNoHorizontalOverflow(page, "contacts at 320px");
  });
});

test.describe("07 Playbook", () => {
  test("numbers the escalation ladder and keeps the consultant sentence in full ink", async ({ page }) => {
    await openBoard(page, ROUTES.playbook);
    const steps = page.locator('[data-testid^="on-call-playbook-step-"]');
    expect(await steps.count()).toBeGreaterThanOrEqual(3);
    await expect(steps.first()).toContainText("1.");
    await expect(page.getByText("You are expected to make this call")).toBeVisible();
  });

  test("collects the scenarios with no linked guideline into their own group", async ({ page }) => {
    await openBoard(page, ROUTES.playbook);
    await expect(page.getByTestId("on-call-playbook-group-no-guideline")).toBeVisible();
    // The designed empty state, not an absent one: it names what is missing and
    // offers a document search rather than inventing advice.
    await expect(page.locator('[data-testid^="on-call-playbook-no-guideline-"]').first()).toContainText(
      /No local guideline/i,
    );
  });
});

test.describe("08 Referrals", () => {
  test("expands a service in place rather than routing away", async ({ page }) => {
    await openBoard(page, ROUTES.referrals);
    const before = page.url();
    await page.getByRole("button", { name: /Demo community mental health team/ }).click();
    await expect(page.getByTestId("on-call-referral-panel-demo-community-team")).toBeVisible();
    expect(page.url()).toBe(before);
  });

  test("labels what a service accepts and does not accept, never colour alone", async ({ page }) => {
    await openBoard(page, ROUTES.referrals);
    await page.getByRole("button", { name: /Demo community mental health team/ }).click();
    const panel = page.getByTestId("on-call-referral-panel-demo-community-team");
    await expect(panel).toContainText("Accepts");
    await expect(panel).toContainText("Does not accept");
  });
});

test.describe("08 Referrals — freshness says something or says nothing", () => {
  test("keeps a current service's checked date out of the collapsed row", async ({ page }) => {
    await openBoard(page, ROUTES.referrals);
    const row = page.getByRole("button", { name: /Demo community/ }).first();
    await expect(row).toBeVisible();
    // "Checked <date>" on a row where nothing is wrong is a pill wider than
    // the service's own name; the name truncated to make room for it.
    await expect(row.getByTestId("on-call-freshness-badge")).toHaveCount(0);

    await row.click();
    await expect(page.getByTestId("on-call-freshness-badge").first()).toBeVisible();
  });
});

test.describe("10 Orientation", () => {
  test("draws both checklists, and a tick greys the step it belongs to", async ({ page }) => {
    await openBoard(page, ROUTES.orientation);
    const checklists = page.locator('[data-testid^="on-call-orientation-checklist-"]');
    expect(await checklists.count()).toBeGreaterThanOrEqual(2);

    const step = page.getByRole("button", { name: /Collect the on-call phone/ });
    await expectTapFloor(step, "checklist step");
    await expect(step).toHaveAttribute("aria-pressed", "false");
    await step.click();
    await expect(page.getByRole("button", { name: /Collect the on-call phone/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Board 10: done items grey and strike through, so what remains stands out.
    const decoration = await page
      .getByRole("button", { name: /Collect the on-call phone/ })
      .locator("span", { hasText: "Collect the on-call phone" })
      .last()
      .evaluate((node) => getComputedStyle(node).textDecorationLine);
    expect(decoration).toContain("line-through");
  });

  test("badges the owner's note as the owner's words", async ({ page }) => {
    await openBoard(page, ROUTES.orientation);
    await expect(page.locator('[data-testid^="on-call-orientation-note-"]').first()).toContainText("Your note");
  });
});

test.describe("11 Logistics", () => {
  test("explains a wholly private group inside the card", async ({ page }) => {
    await openBoard(page, ROUTES.logistics);
    const note = page.getByTestId("on-call-logistics-private-note");
    await expect(note).toBeVisible();
    await expect(note).toContainText(/Only you can see this group/i);
  });

  test("groups the plain rows and keeps the authorise group", async ({ page }) => {
    await openBoard(page, ROUTES.logistics);
    await expect(page.getByTestId("on-call-logistics-group-where")).toBeVisible();
    await expect(page.getByTestId("on-call-logistics-group-what-you-can-authorise")).toBeVisible();
  });
});

test.describe("The mode's own chrome, across the site's widths", () => {
  for (const [name, route] of Object.entries(ROUTES)) {
    test(`keeps ${name} free of a search composer and free of sideways scroll`, async ({ page }) => {
      await openBoard(page, route);
      // The mode declares no results surface, so no route in it may grow a
      // composer or a second dock — the one-composer rule, checked where it
      // would actually be visible rather than in a class name.
      await expect(page.locator('[data-testid="global-search-composer"]')).toHaveCount(0);
      await expectNoHorizontalOverflow(page, `${name} at ${BOARD_WIDTH}px`);
    });
  }

  test("keeps the page header intact at the tablet width the drawing never shows", async ({ page }) => {
    await openBoard(page, ROUTES.contacts, TABLET);
    await expect(page.getByTestId("on-call-section-detail-header")).toBeVisible();
    await expectNoHorizontalOverflow(page, "contacts at 768px");
  });

  test("re-resolves the hub in dark rather than leaking a light value", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await openBoard(page, ROUTES.home);
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = background.match(/\d+/g)!.map(Number);
    expect(r + g + b, `body background ${background} is not a dark value`).toBeLessThan(360);
  });

  test("keeps the private marker legible once forced colours drop every tint", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openBoard(page, ROUTES.contacts);
    // The words survive the tint, which is the whole reason the flag says
    // "Private" rather than only showing a lock.
    await expect(page.getByTestId("on-call-private-flag").first()).toContainText("Private");
  });
});
