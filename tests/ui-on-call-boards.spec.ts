import { expect, test, type Locator, type Page } from "playwright/test";

import { visibleByTestId } from "./playwright-settlement";

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
 *
 * One block at the end covers a page the drawing does not contain. Compliance
 * was cut out of Admin after the boards were drawn, and a page with no
 * artboard is exactly the page that would otherwise have no browser proof at
 * all — the ledger's gate only asks for a block per drawn board.
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

test("search opens and focuses the exact contact on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/on-call");
  const result = page.getByTestId("on-call-search-row-demo-ward-one");
  // Text typed before hydration is dropped (mobile WebKit, release matrix 2026-09-25).
  await expect(async () => {
    await page.getByRole("searchbox", { name: "Search On Call" }).fill("Demo Ward One");
    await expect(result).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  const destination = await result.getAttribute("href");
  expect(destination).toMatch(/^\/on-call\/contacts#on-call-entry-/);
  await result.click();
  await expect(page).toHaveURL(new RegExp(`${destination!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  const target = page.locator(`[id="${destination!.split("#")[1]}"]`);
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport();
  await expect(target).toContainText("Demo Ward One");
});

const ROUTES = {
  home: "/on-call",
  contacts: "/on-call/contacts",
  playbook: "/on-call/playbook",
  referrals: "/on-call/referrals",
  orientation: "/on-call/orientation",
  teaching: "/on-call/education",
  logistics: "/on-call/logistics",
  // A route of its own over rows that are not a section of their own.
  // Compliance is the `logistics` rows carrying `details.kind: "compliance"`,
  // split out because `section` is a database CHECK constraint and a seventh
  // value costs a migration against the live clinical database. It belongs in
  // this list all the same: the chrome loop at the foot of the file opens
  // every entry here, and a page left out of it is a page nothing checks.
  compliance: "/on-call/compliance",
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
  [ROUTES.compliance]: "on-call-compliance-section",
  [ROUTES.whoIsWho]: "on-call-who-is-who-section",
};

async function openBoard(page: Page, route: string, width = BOARD_WIDTH) {
  await page.setViewportSize({ width, height: BOARD_HEIGHT });
  await page.goto(route, { waitUntil: "domcontentloaded" });
  // Every On Call route streams through the `(search-app)` group's `loading.tsx`
  // Suspense boundary, so React parks a second, hidden copy of the page in a
  // `<div hidden id="S:n">` staging container at the end of `<body>` until its
  // deferred reveal (`$RC` -> `$RV`, scheduled on a frame) removes it. Until
  // then every testid below resolves to two elements — the live one and the
  // staged orphan — and a strict locator fails on the pair rather than on
  // anything being wrong with the board. CI caught exactly that on the hub:
  // `on-call-home-sections` once inside `mobile-composer-reserve-pad`, once in
  // the staging copy. Wait for the document to settle to ONE copy, as the ward
  // journeys do, rather than relaxing the locators to `.first()` — that would
  // leave them free to assert against the inert staged copy.
  await expect(
    page.locator('div[hidden][id^="S:"]'),
    "React's streamed content is still staged, so the whole page is duplicated in the document",
  ).toHaveCount(0, { timeout: 20_000 });
  // The entry store fetches on the client, so every board below waits on data
  // rather than on the shell. The hub has no page header, so the two wait on
  // different things: the hub on its tile grid, a section page on its header.
  if (route === ROUTES.home) {
    // Visible owner only: a full load can briefly leave Next's hidden streamed
    // copy of the page in the DOM, which a bare testid counts twice (#093).
    await expect(visibleByTestId(page, "on-call-home-sections")).toBeVisible({ timeout: 20_000 });
    return;
  }
  // The list, not the header: a section page renders a header only when it has
  // two or more groups to move between, and Playbook, Who's who and Teaching
  // have one or none in the demo corpus. The list is also the better signal
  // either way — the header used to render before the fetch resolved, so
  // waiting on it measured the loading state.
  const listTestId = SECTION_LIST_TEST_IDS[route];
  if (listTestId) await expect(visibleByTestId(page, listTestId)).toBeVisible({ timeout: 20_000 });
}

/**
 * The bar of this page's own groups, once it has settled to exactly one.
 *
 * `.first()` and a count settle, because a client-side route change keeps the
 * outgoing page's tree mounted until the incoming one is ready — so for a
 * moment two headers exist and a strict locator fails on the pair rather than
 * on anything being wrong.
 */
async function sectionBar(page: Page) {
  await expect(page.getByTestId("on-call-section-detail-header").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("on-call-section-detail-header")).toHaveCount(1, { timeout: 20_000 });
  return page.getByTestId("on-call-section-section-rail");
}

/** The words the bar is currently showing, in order, excluding More. */
async function barWords(page: Page) {
  const bar = await sectionBar(page);
  return bar.evaluate((nav) =>
    Array.from(nav.querySelectorAll("li"))
      .filter((slot) => getComputedStyle(slot).display !== "none" && !slot.classList.contains("mode-nav__more"))
      .map((slot) => slot.textContent?.trim() ?? ""),
  );
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

/**
 * The number a home tile is currently showing.
 *
 * Read off the tile rather than out of the demo corpus, because the corpus is
 * the one thing a wrong count agrees with. The figure is the only one in a
 * tile and sits in its own `.nums` span beside the glyph; a tile drawn without
 * a count (Who's who) has no such span at all, so this fails by name instead
 * of quietly returning NaN for it.
 */
async function tileCount(page: Page, key: string) {
  const badge = visibleByTestId(page, `on-call-home-tile-${key}`).locator("span.nums");
  await expect(badge, `the ${key} tile carries no count`).toHaveCount(1);
  const text = ((await badge.textContent()) ?? "").trim();
  expect(text, `the ${key} tile's count reads "${text}", which is not a number`).toMatch(/^\d+$/);
  return Number(text);
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
      await expect(visibleByTestId(page, id), `${id} is drawn on board 01 but does not render`).toBeVisible();
    }

    // Top to bottom in the drawn order. A module that renders in the wrong
    // place still passes a presence check, and the order is the board.
    const tops = await Promise.all(
      modules.map(async (id) => (await visibleByTestId(page, id).boundingBox())?.y ?? Number.NaN),
    );
    for (let index = 1; index < tops.length; index += 1) {
      expect(tops[index], `${modules[index]} is above ${modules[index - 1]}`).toBeGreaterThan(tops[index - 1]!);
    }
  });

  test("leads with Who do I call now, which opens the escalation steps with call buttons", async ({ page }) => {
    await openBoard(page, ROUTES.home);
    await visibleByTestId(page, "on-call-home-call-now").click();
    await expect(page).toHaveURL(/\/on-call\/now$/);
    await expect(page.getByTestId("on-call-now-ladder")).toBeVisible();
    await expect(page.getByTestId("on-call-now-steps").getByRole("listitem").first()).toBeVisible();
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
    // The row became a date-card strip when recurring sessions landed, so the
    // card test id moved from `on-call-home-upcoming-` to `on-call-home-teaching-`.
    // The module id around it is unchanged, and so is what this test is really
    // asserting: a date a reader can check against a roster, never a countdown.
    const card = page.getByTestId("on-call-home-upcoming").locator('[data-testid^="on-call-home-teaching-"]').first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
  });

  test("gives every section a tile, and gives Who's who no count", async ({ page }) => {
    await openBoard(page, ROUTES.home);
    const tiles = visibleByTestId(page, "on-call-home-sections").locator('[data-testid^="on-call-home-tile-"]');
    // Eight, and the list underneath is the reason rather than the number.
    // The grid draws the six STORED sections, then Compliance, then Who's who.
    // Compliance earned its place by being wired: a tile pointing at
    // `/on-call/compliance` and carrying a live count of the rows that page
    // draws. It had neither for a while — it is a view over `logistics`, so
    // the mode had the page before it had an honest number to put beside it,
    // and the pill was the only way in.
    //
    // THE NUMBER IS NOT THE ASSERTION, and that is the whole point of this
    // block. Raising a count to match a page nobody wired up is the failure
    // guarded here, and a bare `toHaveCount` cannot tell that apart from real
    // work — so the order below names every tile, and a new page has to earn a
    // name here before the count moves. Adding a name for a route that does
    // not exist fails the chrome loop at the foot of this file instead.
    await expect(tiles).toHaveCount(8);
    expect(
      await tiles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid"))),
      "the tile grid is not the pages it should be, in the order it should draw them",
    ).toEqual([
      "on-call-home-tile-contacts",
      "on-call-home-tile-playbook",
      "on-call-home-tile-referrals",
      "on-call-home-tile-orientation",
      "on-call-home-tile-education",
      "on-call-home-tile-logistics",
      // After the stored sections and before Who's who, which is where it
      // belongs: like the six above it these are things to go and deal with,
      // and unlike the one below it they are a list rather than an
      // explanation.
      "on-call-home-tile-compliance",
      "on-call-home-tile-who-is-who",
    ]);

    // Real rather than merely counted: it goes somewhere, it is named, and it
    // carries a figure. `href` against the route table, so a tile pointing at
    // a page this file does not know about fails here.
    const compliance = page.getByTestId("on-call-home-tile-compliance");
    await expect(compliance).toHaveAttribute("href", ROUTES.compliance);
    await expect(compliance).toContainText("Compliance");
    await expect(compliance.locator("span.nums")).toHaveText(/^\d+$/);
    await expectTapFloor(compliance, "compliance tile");

    // Board 01 draws this one differently and without a number: the others
    // count things to read, this one explains the ladder.
    await expect(page.getByTestId("on-call-home-tile-who-is-who")).not.toContainText(/\d/);
  });

  test("counts Admin and Compliance from the rows each page draws, never from the stored section", async ({ page }) => {
    // The bug the Compliance tile was worth adding for. Admin and Compliance
    // are ONE stored section, told apart by `details.kind`, so a count taken
    // BY SECTION reports the pair's total under `logistics`: an Admin tile
    // promising rows that live on another page, and no figure at all for the
    // page they are actually on.
    //
    // Both numbers are therefore read off the pages themselves. Literals here
    // — 18 and 8 in today's demo corpus — would pass again the first time the
    // two are reconfused, because the same mistake moves the rows and the
    // tile together. Comparing the tile to what its page renders cannot.
    await openBoard(page, ROUTES.home);
    const adminTile = await tileCount(page, "logistics");
    const complianceTile = await tileCount(page, "compliance");

    await openBoard(page, ROUTES.logistics);
    const adminRows = await page.locator('[data-testid^="on-call-logistics-row-"]').count();
    await openBoard(page, ROUTES.compliance);
    const complianceRows = await page.locator('[data-testid^="on-call-compliance-row-"]').count();

    // An empty page would make every comparison below 0 = 0, which is the one
    // way this test could pass while proving nothing.
    expect(adminRows, "the demo corpus draws no Admin rows, so the counts below prove nothing").toBeGreaterThan(0);
    expect(
      complianceRows,
      "the demo corpus draws no Compliance rows, so the counts below prove nothing",
    ).toBeGreaterThan(0);

    expect(adminTile, "the Admin tile promises a number of rows the Admin page does not draw").toBe(adminRows);
    expect(complianceTile, "the Compliance tile promises a number of rows the Compliance page does not draw").toBe(
      complianceRows,
    );
    // Stated separately because it is the exact shape of the old defect: the
    // Admin tile carrying the whole stored section, compliance rows included.
    expect(adminTile, "the Admin tile is counting the whole `logistics` section again").not.toBe(
      adminRows + complianceRows,
    );
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
    await expect(visibleByTestId(page, "on-call-home-sections")).toBeVisible();
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
    // The whole point of the change. The pill above already opens the mode's
    // pages — nine when this was written, ten since Compliance; a rail
    // underneath listing the same ten was two controls doing one job, and it
    // hid five of them behind "More" while doing it.
    for (const route of [ROUTES.home, ROUTES.contacts, ROUTES.playbook, ROUTES.logistics, ROUTES.compliance]) {
      await openBoard(page, route);
      await expect(page.getByTestId("mode-nav")).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "On Call pages" })).toHaveCount(0);
    }
  });
});

test.describe("02 More — the second row is about the page you are on", () => {
  test("is a bar of this page's own groups, with the current one marked", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    const bar = await sectionBar(page);
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute("aria-label", "Sections of this page");

    // The areas Contacts files its rows under, as plain words. This is the
    // assertion jsdom cannot make: section resolution tests visibility with
    // getClientRects, which jsdom reports empty for everything.
    expect(await barWords(page)).toEqual(["Services", "Tonight", "Wards"]);

    // Not the mode's routes — those belong to the pill above.
    await expect(bar.getByRole("button", { name: /^Playbook$/ })).toHaveCount(0);

    // Exactly one slot is current, and it is marked by more than colour: the
    // rule under it is drawn, and `aria-current` names it.
    await expect(bar.locator('button[aria-current="true"]')).toHaveCount(1);
  });

  test("carries no title, no back arrow and no actions of its own", async ({ page }) => {
    // Everything this row used to hold moved up one level, to the pill and the
    // universal header's trailing slot. What is left is navigation inside the
    // page, which is the only thing this row was ever meant to be.
    await openBoard(page, ROUTES.contacts);
    const header = page.getByTestId("on-call-section-detail-header");
    await expect(header).not.toContainText("Contacts");
    await expect(header.getByRole("link", { name: /back to on call/i })).toHaveCount(0);
    await expect(page.getByTestId("on-call-section-actions-trigger")).toHaveCount(0);
    await expect(page.getByTestId("on-call-section-section-trigger")).toHaveCount(0);
  });

  test("names the page once, in the pill, with the mode beneath it", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    // The pill's accessible name still opens `Mode …` — twelve test files and
    // the shared helper find this control by that prefix — and now says the
    // page as well.
    const pill = page.getByRole("button", { name: "Mode On Call, page Contacts" });
    await expect(pill).toBeVisible();
    await expect(pill).toContainText("Contacts");
    await expect(pill).toContainText("On Call");

    // And nothing else on the page paints the name. Measured, not counted by
    // role: the `<h1>` names the page and the `<h2>` labels the list region, so
    // both are still in the accessibility tree; each is clipped to a pixel.
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
    expect(titles.painted, "a heading repeats the name the pill already shows").toBe(0);
  });

  test("carries the mode's own colour on the pill and the bar, and only there", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    const identity = await page.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).getPropertyValue("--clinical-accent").trim() : null;
      };
      return {
        pill: read('[data-mode-identity="on-call"].universal-header-mode-button'),
        bar: read('[data-testid="on-call-section-section-rail"]'),
        page: getComputedStyle(document.body).getPropertyValue("--clinical-accent").trim(),
      };
    });
    // One token, two elements, so the filled circle and the active underline
    // cannot end up different greens.
    expect(identity.pill).toBe(identity.bar);
    expect(identity.pill).toBeTruthy();
    // And the rest of the page keeps the product accent: the hue is scoped to
    // the mode's own chrome, not sprayed over its content.
    expect(identity.page).not.toBe(identity.pill);
  });

  test("fits its words without truncating at the site's narrow width", async ({ page }) => {
    // The failure this profile exists to prevent, and the one a screenshot
    // catches only if someone looks: "Servi…" in a 48px bar. Measured on the
    // rendered label box rather than inferred from the band.
    //
    // Four routes, not one. The one-word convention this mode is built on came
    // from a measurement recorded at board 11 below — a drawn phrase came to
    // 165px in this row against a 288px phone, and three such slots needed
    // 372px — and the three pages RE-CUT because of it were the three this
    // guard did not follow: Admin (Leave / Rosters / Pay / Forms / Access /
    // Facilities), Orientation (Induction / Manuals / Policies / Departure /
    // Unfiled) and Compliance (Blocking / Partial / Chased / Unrecorded).
    // Until this list grew, no test in the suite had measured a single one of
    // those words; four source files cite the measurement and nothing proved
    // the pages still obeyed it.
    //
    // Compliance is also the one page where the bar word and the page heading
    // differ on purpose — "Blocking" in the bar over a group headed "Stops you
    // working". The bar word is what has to fit, and the bar is what this
    // measures, so the two stay independent.
    //
    // What this reaches, and what it does not. Only the slots the band
    // actually renders can be measured: the tail of a longer list is
    // `display: none` behind More at these widths and is filtered out above.
    // So Admin contributes Access and Facilities at 320px and Forms as well at
    // 390px — Leave first appears at the five-slot band and Pay and Rosters
    // never reach the bar at all — and Orientation's Departure and Unfiled
    // likewise wait for that band. That is the right boundary rather than a
    // hole: a word folded into the sheet is not in the 48px row and cannot be
    // clipped by it, and the bands that do reveal it are wider ones, with more
    // room per slot rather than less. Compliance shows all four at 390px.
    for (const route of [ROUTES.contacts, ROUTES.logistics, ROUTES.orientation, ROUTES.compliance]) {
      for (const width of [NARROW, BOARD_WIDTH]) {
        await openBoard(page, route, width);
        const clipped = await (
          await sectionBar(page)
        ).evaluate((nav) =>
          Array.from(nav.querySelectorAll("li"))
            .filter((slot) => getComputedStyle(slot).display !== "none")
            .flatMap((slot) => Array.from(slot.querySelectorAll("span")))
            .filter((span) => span.scrollWidth > span.clientWidth + 1)
            .map((span) => span.textContent ?? ""),
        );
        expect(clipped, `a label is truncated on ${route} at ${width}px`).toEqual([]);
      }
    }
  });

  test("keeps every slot on the production tap floor", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    const bar = await sectionBar(page);
    const slots = bar.getByRole("button");
    for (let index = 0; index < (await slots.count()); index += 1) {
      await expectTapFloor(slots.nth(index), `bar slot ${index}`);
    }
  });

  test("jumps to a group and follows the reader back down the page", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    const bar = await sectionBar(page);
    await bar.getByRole("button", { name: /^Wards$/ }).click();

    const wards = page.locator("#on-call-group-wards");
    await expect(wards).toBeInViewport({ timeout: 5_000 });
    // Still on the page, which is the whole difference from the chip row this
    // replaced: tapping "Wards" used to DELETE Tonight and Services.
    await expect(page.getByTestId("on-call-contact-row-demo-interpreter-line")).toHaveCount(1);
    await expect(bar.locator('button[aria-current="true"]')).toContainText("Wards");
  });

  test("says nothing else above the list", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    // No eyebrow repeating the mode, no display-size title, no paragraph
    // explaining how the section is filed, and no chip row naming the same
    // groups the bar names.
    await expect(page.getByText(/Filed by role first/)).toHaveCount(0);
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

  test("renders no header at all on a page with nothing to move between", async ({ page }) => {
    // Teaching has no facet to file by — its sessions are dated, not tagged —
    // so it is one flat list. One group is a heading, not navigation, and with
    // the title and the actions both gone there is nothing left for a header
    // to hold. It is absent rather than drawn as an empty 48px band.
    await openBoard(page, ROUTES.teaching);
    await expect(page.getByTestId("on-call-section-detail-header")).toHaveCount(0);
    // The page is still named, and still has its actions — both one level up.
    await expect(page.getByRole("button", { name: "Mode On Call, page Teaching" })).toBeVisible();
    await expect(page.getByTestId("on-call-page-menu-trigger")).toBeVisible();
  });

  test("gives a page that lost its chips real groups instead", async ({ page }) => {
    await openBoard(page, ROUTES.referrals);
    await expect(page.getByTestId("on-call-referrals-filters")).toHaveCount(0);
    const groups = page.locator('[data-testid^="on-call-referrals-group-"]');
    expect(await groups.count()).toBeGreaterThan(1);

    // And the bar can now move between them, which the flat list could not.
    expect(await barWords(page)).toContain("Community");
  });

  test("gives the orientation shelf its groups too", async ({ page }) => {
    await openBoard(page, ROUTES.orientation);
    await expect(page.getByTestId("on-call-orientation-filters")).toHaveCount(0);
    expect(await page.locator('[data-testid^="on-call-orientation-group-"]').count()).toBeGreaterThan(1);
  });

  test("declares no anchor the page does not render", async ({ page }) => {
    // Admin, and deliberately only Admin. This re-derives the slug from the
    // word in the bar, which holds wherever the bar's label and the page's
    // heading are the same string — every page in the mode except Compliance,
    // whose bar says "Blocking" over a group anchored at
    // `stops-you-working`. Pointing this loop at that page would fail on the
    // one design decision it is meant to protect.
    await openBoard(page, ROUTES.logistics);
    for (const label of await barWords(page)) {
      const slug = label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!slug) continue;
      await expect(page.locator(`#on-call-group-${slug}`), `${label} is offered but absent`).toHaveCount(1);
    }
  });
});

test.describe("05 Page menu", () => {
  test("opens from the universal header, the same control the mode home uses", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    const trigger = page.getByTestId("on-call-page-menu-trigger");
    await expect(trigger).toBeVisible();
    await expectTapFloor(trigger, "page menu trigger");
    // One menu for the whole mode, in the slot the new-chat button would
    // otherwise hold — a mode with no results surface has nowhere for a new
    // conversation to land. A second ellipsis on the page's own row would have
    // cost 48px to duplicate this one.
  });

  test("carries the order control, the pocket card, and the privacy explanation", async ({ page }) => {
    await openBoard(page, ROUTES.contacts);
    await page.getByTestId("on-call-page-menu-trigger").click();
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
    await page.getByTestId("on-call-page-menu-trigger").click();
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
    // the list rather than their place. The bar moves them instead.
    await openBoard(page, ROUTES.contacts);
    const bar = await sectionBar(page);
    await bar.getByRole("button", { name: /^Wards$/ }).click();

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

/**
 * Open one referral row. The row's button is in the page before React has attached its click
 * handler, and a click in that gap is swallowed: a Firefox CI run clicked the right button (its
 * id unchanged, so nothing remounted) and the row stayed collapsed. Wait for the handler first.
 */
async function expandReferral(page: Page, name: string) {
  const trigger = page.getByRole("button", { name, exact: true });
  await expect
    .poll(
      () =>
        trigger.evaluate((element) => {
          const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
          const props = propsKey ? (element as unknown as Record<string, Record<string, unknown>>)[propsKey] : null;
          return typeof props?.onClick === "function";
        }),
      { message: "referral row click handler attached", timeout: 15_000 },
    )
    .toBe(true);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

test.describe("08 Referrals", () => {
  test("expands a service in place rather than routing away", async ({ page }) => {
    await openBoard(page, ROUTES.referrals);
    const before = page.url();
    await expandReferral(page, "Demo community mental health team");
    await expect(page.getByTestId("on-call-referral-panel-demo-community-team")).toBeVisible();
    expect(page.url()).toBe(before);
  });

  test("labels what a service accepts and does not accept, never colour alone", async ({ page }) => {
    await openBoard(page, ROUTES.referrals);
    await expandReferral(page, "Demo community mental health team");
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

/**
 * Board 11 is drawn as "Logistics" and the drawing keeps that name. Only the
 * label moved: the page is Admin now, and what it holds moved with the word —
 * leave, rosters, pay, forms and access, with Facilities keeping the parking,
 * food and call-room notes the page was first built for. The section id, the
 * route segment and the database CHECK constraint all still read `logistics`,
 * which is why every testid below does too; renaming them would be a
 * migration against the live clinical database for no functional gain.
 */
test.describe("11 Admin", () => {
  test("explains a wholly private group inside the card", async ({ page }) => {
    await openBoard(page, ROUTES.logistics);
    const note = page.getByTestId("on-call-logistics-private-note");
    // Exactly one, because the rule is narrower than "somewhere on Admin": a
    // note on a MIXED group would claim the visible rows beside it are
    // withheld too, so only a folder with nothing visible in it gets one.
    await expect(note).toHaveCount(1);
    await expect(note).toBeVisible();
    await expect(note).toContainText(/Only you can see this group/i);

    // And Access is that folder — after-hours entry, locked wards, logins,
    // every row of it personal. Located through the group rather than trusted
    // to be the only note on the page, so a note that ends up over the wrong
    // folder fails here instead of passing on a count of one.
    const access = page.locator('section:has([data-testid="on-call-logistics-group-access"])');
    await expect(access.getByTestId("on-call-logistics-private-note")).toBeVisible();
  });

  test("groups the plain rows under their folder headings", async ({ page }) => {
    await openBoard(page, ROUTES.logistics);
    // ONE WORD PER CATEGORY, and this block is the record of the measurement
    // that decided it. `category` is both the page's heading and a slot in a
    // 48px bar of bare words that truncate rather than fold: "What you can
    // authorise" measured 165px in that row against a 288px phone and was cut
    // to "Authorise".
    //
    // The folders were then re-cut when Logistics became Admin, and the
    // measurement is what survived — "Rosters and hours" is Rosters, "Pay and
    // claims" is Pay, "IT and access" is Access, so "Authorise" itself is no
    // longer one of them. A phrase reads fine in review and truncates on the
    // phone this mode is opened on at 3am; if a folder seems to need one, the
    // answer is a better word, not a wider bar.
    for (const folder of ["leave", "rosters", "pay", "forms", "access", "facilities"]) {
      await expect(
        page.getByTestId(`on-call-logistics-group-${folder}`),
        `the ${folder} folder has rows in the demo corpus but no heading on the page`,
      ).toBeVisible();
    }
  });
});

/**
 * Compliance — a page the eleven boards never drew.
 *
 * It was cut out of Admin after the drawing: the same stored `logistics` rows,
 * told apart by `details.kind`, filed by what happens when one lapses rather
 * than by which folder it lives in. A registration whose expiry can stop
 * someone working had no business sitting among forms and rosters, where
 * nothing is expected to run out.
 *
 * With no artboard to check it against, this block checks it against the two
 * things its own source says it must be: bands in worst-first order, and no
 * verdict anywhere on the page.
 */
test.describe("Compliance — the view the boards never drew", () => {
  test("files the requirements under consequence bands, worst first", async ({ page }) => {
    await openBoard(page, ROUTES.compliance);

    // Slugs from the rendered HEADING, never from the short word the bar
    // carries: both sides derive them from `heading`, so shortening a bar slot
    // can never move an anchor. The last one is a band in its own right and
    // never folded upwards — no recorded consequence is unknown, not
    // harmless, and guessing it a band would be the app forming exactly the
    // judgement this page refuses to form.
    const bands = [
      "on-call-compliance-group-stops-you-working",
      "on-call-compliance-group-stops-part-of-your-work",
      "on-call-compliance-group-someone-chases-you",
      "on-call-compliance-group-no-consequence-recorded",
    ];
    for (const id of bands) {
      await expect(page.getByTestId(id), `${id} has rows in the demo corpus but does not render`).toBeVisible();
    }

    // The order is the page's whole argument, so presence alone would pass
    // with the bands reversed. Every compliance tracker ever built sorts by
    // date, which puts a lapsed fire-safety module level with a lapsed
    // registration when only one of them stops you working.
    const tops = await Promise.all(
      bands.map(async (id) => (await page.getByTestId(id).boundingBox())?.y ?? Number.NaN),
    );
    for (let index = 1; index < tops.length; index += 1) {
      expect(tops[index], `${bands[index]} is above ${bands[index - 1]}`).toBeGreaterThan(tops[index - 1]!);
    }
  });

  test("says on the page that nothing here is checked with the issuing body", async ({ page }) => {
    await openBoard(page, ROUTES.compliance);
    const note = page.getByTestId("on-call-compliance-scope-note");
    await expect(note).toBeVisible();
    await expect(note).toContainText(/Nothing here is checked with the issuing body/i);

    // Above the first band, not at the foot of the list. A reader who meets
    // this sentence after scrolling past their own registration has already
    // read every date on the way down and believed them. A clinical-governance
    // review rejected an earlier design for implying the app had checked these
    // dates, and this sentence in this position is the control that keeps it
    // rejected — a source-only test cannot tell it from a footnote.
    const [noteBox, firstBand] = [
      await note.boundingBox(),
      await page.getByTestId("on-call-compliance-group-stops-you-working").boundingBox(),
    ];
    expect(noteBox!.y, "the scope note has slipped below the first band").toBeLessThan(firstBand!.y);
  });

  test("gives the bar one word per band while the page keeps the phrase", async ({ page }) => {
    await openBoard(page, ROUTES.compliance);
    // Four bands and no More at 390px: the bar's four-slot band fires from
    // 22rem and this container is 358px here. The words are the short bar
    // labels, cut to one each by the same 165px-against-288px measurement that
    // cut the Admin folders (board 11 above).
    expect(await barWords(page)).toEqual(["Blocking", "Partial", "Chased", "Unrecorded"]);

    // What the bar may not do is drop the sentence. "Blocking" over a
    // registration renewal does not say what is blocked, so the heading keeps
    // the phrase and only the navigation slot is shortened — and the anchor
    // stays with the phrase, which is why the two can differ safely.
    await expect(page.getByRole("heading", { name: "Stops you working" })).toBeVisible();
    await expect(page.locator("#on-call-group-stops-you-working")).toHaveCount(1);
    await expect(page.locator("#on-call-group-blocking")).toHaveCount(0);
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
    // From `sm` the bar is a bordered card rather than a rule under the phone
    // header, and every group still fits: no overflow slot at any width the
    // demo corpus produces.
    expect(await barWords(page)).toEqual(["Services", "Tonight", "Wards"]);
    await expectNoHorizontalOverflow(page, "contacts at 768px");
  });

  test("re-resolves the hub in dark rather than leaking a light value", async ({ page }) => {
    // Switch schemes BETWEEN navigations, never before the first one.
    //
    // This test failed on Firefox in every release-browser-matrix run, reading
    // rgb(255, 255, 255) where it wanted a dark value, and the cause is the
    // ordering rather than the app: it set the override while the page was
    // still on about:blank, and Playwright's Firefox build does not carry that
    // into the very first navigation. The theme is resolved once, pre-paint, by
    // the inline bootstrap in `src/lib/theme.ts` reading
    // `matchMedia("(prefers-color-scheme: dark)")` — so a preference that
    // arrives late has already been missed, and the page stays light forever.
    //
    // Firefox itself resolves dark correctly on this app: the twelve dark
    // assertions in `ui-caring-contacts-workspace.spec.ts` pass on Firefox in
    // the same runs where this one fails, and every one of them navigates
    // first and switches afterwards. That is the pattern copied here, in
    // preference to `test.use({ colorScheme })`, which nothing in this
    // repository has yet proved against Firefox.
    const hubBackground = async () => {
      await openBoard(page, ROUTES.home);
      return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    };

    await page.emulateMedia({ colorScheme: "light" });
    const light = await hubBackground();

    await page.emulateMedia({ colorScheme: "dark" });
    const dark = await hubBackground();

    const [r, g, b] = dark.match(/\d+/g)!.map(Number);
    expect(r + g + b, `body background ${dark} is not a dark value`).toBeLessThan(360);
    // The title's actual claim. A hardcoded light background would satisfy
    // neither this nor the threshold above, but only this one names the defect.
    expect(dark, `the hub painted ${dark} in both schemes`).not.toBe(light);
  });

  test("keeps the private marker legible once forced colours drop every tint", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openBoard(page, ROUTES.contacts);
    // The words survive the tint, which is the whole reason the flag says
    // "Private" rather than only showing a lock.
    await expect(page.getByTestId("on-call-private-flag").first()).toContainText("Private");
  });
});
