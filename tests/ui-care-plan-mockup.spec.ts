import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Locator, type Page } from "playwright/test";

/**
 * The Care Plan prototype's only browser proof.
 *
 * Tasks 1–10 verified this route family with Vitest under `css: false` in
 * jsdom, plus static parsing of the stylesheet as text. That combination cannot
 * see a rendered page at all: not a viewport, not a computed colour, not a page
 * break, not a focus ring. Everything asserted here is therefore something no
 * committed test could previously observe, and nothing here re-proves a
 * behaviour a reducer or DOM test already pins.
 *
 * Three things this file exists for above the rest:
 *
 * 1. **The pinned safety boundary.** `whatWouldMakeThisDifferent` is the single
 *    most safety-critical element in the product. It must sit above all plan
 *    content, never collapsed, truncated or clipped, at every width, in dark
 *    mode, in forced colours, and on paper.
 * 2. **Print.** Three print surfaces exist and none had ever been printed. The
 *    monochrome rule, the cascade against Tailwind utilities, page-break
 *    control, and — twice removed by accident on this project — the marker that
 *    tells a reader the document is fictional.
 * 3. **Ruling 57's replacement.** A static guard reading declarations as text
 *    was beaten four times by nine spellings of "paints nothing". It is frozen
 *    as a tripwire; `expectLooksLikeALink` is the spelling-immune successor,
 *    because a computed style has already resolved `var()`, alpha, shorthands,
 *    `all: unset` and every other spelling into one final value.
 *
 * Chromium evidence only. Nothing here is acceptance for physical iPhone
 * Safari or for an installed PWA.
 */

const CARE_PLAN_BASE = "/mockups/care-plan";

/**
 * The stable, directly reconstructable address of every route in the family,
 * built from `CARE_PLAN_BASE` and the two synthetic example identifiers the
 * route registry itself publishes. No record content ever appears in a URL.
 */
const EXAMPLE_PATIENT = "SYN-PATIENT-001";
const EXAMPLE_PRESENTATION = "SYN-PRESENTATION-001";
const patientPath = (patientId: string) => `${CARE_PLAN_BASE}/patients/${patientId}`;

const routes = {
  home: CARE_PLAN_BASE,
  patients: `${CARE_PLAN_BASE}/patients`,
  patient: patientPath(EXAMPLE_PATIENT),
  managementPlan: `${patientPath(EXAMPLE_PATIENT)}/management-plan`,
  managementPlanEdit: `${patientPath(EXAMPLE_PATIENT)}/management-plan/edit`,
  managementPlanReview: `${patientPath(EXAMPLE_PATIENT)}/management-plan/review`,
  managementPlanPrint: `${patientPath(EXAMPLE_PATIENT)}/management-plan/print`,
  patientPlan: `${patientPath(EXAMPLE_PATIENT)}/patient-plan`,
  patientPlanEdit: `${patientPath(EXAMPLE_PATIENT)}/patient-plan/edit`,
  patientPlanPrint: `${patientPath(EXAMPLE_PATIENT)}/patient-plan/print`,
  safetyPlan: `${patientPath(EXAMPLE_PATIENT)}/safety-plan`,
  safetyPlanEdit: `${patientPath(EXAMPLE_PATIENT)}/safety-plan/edit`,
  safetyPlanPrint: `${patientPath(EXAMPLE_PATIENT)}/safety-plan/print`,
  presentations: `${patientPath(EXAMPLE_PATIENT)}/presentations`,
  newPresentation: `${patientPath(EXAMPLE_PATIENT)}/presentations/new`,
  presentation: `${patientPath(EXAMPLE_PATIENT)}/presentations/${EXAMPLE_PRESENTATION}`,
  history: `${patientPath(EXAMPLE_PATIENT)}/history`,
  reviews: `${CARE_PLAN_BASE}/reviews`,
  team: `${CARE_PLAN_BASE}/team`,
  governance: `${CARE_PLAN_BASE}/governance`,
  systemStates: `${CARE_PLAN_BASE}/system-states`,
} as const;

/** The approved heading of every route, in the order the route table declares them. */
const ROUTE_HEADINGS: readonly (readonly [string, string])[] = [
  [routes.home, "Home"],
  [routes.patients, "Patients"],
  [routes.patient, "Patient overview"],
  [routes.managementPlan, "Management Plan"],
  [routes.managementPlanEdit, "Draft Management Plan Version"],
  [routes.managementPlanReview, "Review submitted version"],
  [routes.managementPlanPrint, "Print Management Plan"],
  [routes.patientPlan, "Patient Plan"],
  [routes.patientPlanEdit, "Draft Patient Plan"],
  [routes.patientPlanPrint, "Print Patient Plan"],
  [routes.safetyPlan, "Personal Safety Plan"],
  [routes.safetyPlanEdit, "Draft Personal Safety Plan Version"],
  [routes.safetyPlanPrint, "Print Personal Safety Plan"],
  [routes.presentations, "ED Presentations"],
  [routes.newPresentation, "Record ED Presentation"],
  [routes.presentation, "ED Presentation"],
  [routes.history, "History"],
  [routes.reviews, "Reviews"],
  [routes.team, "Team"],
  [routes.governance, "Governance"],
  [routes.systemStates, "System states"],
];

/** Every deterministic specimen the address bar may name. */
const SCENARIOS = [
  "empty",
  "no-current-plan",
  "overdue-plan",
  "withdrawn-plan",
  "unverified-contact",
  "identity-uncertain",
  "version-conflict",
  "offline",
  "permission-unavailable",
  "launch-failure",
  "print-failure",
] as const;

const REQUIRED_WIDTHS = [320, 390, 768, 1024, 1440] as const;

const SYNTHETIC_MARKER = "Synthetic prototype — fictional data only";
const MEMORY_NOTICE = "Nothing is saved. Reloading this page starts over.";
const PINNED_BOUNDARY_SENTENCE = "Do not rely on this plan if today is different";

const captureEvidence = process.env.CARE_PLAN_CAPTURE_EVIDENCE === "1";
const captureDirectory = resolve(process.cwd(), ".local", "care-plan", "atlas");

const phoneDock = (page: Page) => page.getByRole("navigation", { name: "Care Plan phone navigation" });
const desktopRail = (page: Page) => page.getByRole("navigation", { name: "Care Plan sections" });
const pinnedBoundary = (page: Page) => page.getByTestId("care-plan-pinned-safety-boundary");
const printPaper = (page: Page) => page.locator("[data-print-output]");

// --- Helpers ----------------------------------------------------------------

async function gotoRoute(page: Page, route: string, heading?: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  // The shell's synthetic marker is the first thing every route paints, so it
  // doubles as the "this route actually rendered" signal. A dev-server route
  // compiles on first visit, hence the generous ceiling.
  await expect(page.getByTestId("care-plan-synthetic-marker")).toHaveText(SYNTHETIC_MARKER, { timeout: 45_000 });
  if (heading !== undefined) {
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth,
  );
  expect(overflow, `the page scrolls sideways at ${page.viewportSize()?.width}px`).toBeLessThanOrEqual(2);
}

/**
 * The standing statement that this is fictional and holds nothing. Both halves
 * are asserted: the synthetic-data label alone does not warn somebody
 * demonstrating the tool that a reload discards what they are showing.
 */
async function expectSyntheticBoundary(page: Page) {
  await expect(page.getByTestId("care-plan-synthetic-marker")).toHaveText(SYNTHETIC_MARKER);
  await expect(page.getByText(MEMORY_NOTICE, { exact: true })).toBeVisible();
}

/** No control may sit underneath the phone dock, where a thumb cannot reach it. */
async function expectPhoneDockClearance(page: Page, control: Locator) {
  const width = page.viewportSize()?.width ?? 0;
  if (width >= 768) return;
  await control.scrollIntoViewIfNeeded();
  const [controlBox, dockBox] = await Promise.all([control.boundingBox(), phoneDock(page).boundingBox()]);
  expect(controlBox, "the control has no box to measure").not.toBeNull();
  expect(dockBox, "the phone dock has no box to measure").not.toBeNull();
  expect(controlBox!.y + controlBox!.height).toBeLessThanOrEqual(dockBox!.y + 1);
}

/** One first-level heading per route, and it is the route's own. */
async function expectSinglePageHeading(page: Page, heading: string) {
  const headings = page.getByRole("heading", { level: 1 });
  await expect(headings).toHaveCount(1);
  await expect(headings).toHaveText(heading);
}

type Rgba = { r: number; g: number; b: number; a: number };

function parseColour(value: string): Rgba | null {
  const match = /rgba?\(([^)]+)\)/.exec(value);
  if (match === null) return null;
  const parts = match[1]
    .split(/[\s,/]+/)
    .filter((part) => part.length > 0)
    .map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 && !Number.isNaN(parts[3]) ? parts[3] : 1 };
}

const sameColour = (a: Rgba, b: Rgba) => a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;

/**
 * Resolve a CSS-module class to the exact hashed token the build produced.
 *
 * Deliberately not `[class*="queueAction"]`: that substring also matches the
 * `queueActions` wrapper, and a guard that silently measures the wrong element
 * is the failure mode this whole file exists to replace. Matching a class token
 * that *ends* with `__<name>` can only hit the intended class, and the helper
 * throws rather than degrading when the class is absent from the page.
 */
async function moduleClassSelector(page: Page, name: string): Promise<string> {
  const token = await page.evaluate((wanted) => {
    for (const element of document.querySelectorAll<HTMLElement>("[class]")) {
      for (const candidate of element.classList) {
        if (candidate.endsWith(`__${wanted}`)) return candidate;
      }
    }
    return null;
  }, name);
  expect(token, `no element on ${page.url()} carries the CSS-module class \`${name}\``).not.toBeNull();
  return `.${token!}`;
}

type Affordance = {
  /** A real underline, drawn in ink that is not transparent. */
  underline: boolean;
  /** A visible border, drawn in ink that is not transparent. */
  border: boolean;
};

/**
 * Ruling 57's replacement, and the whole reason this file is a browser test.
 *
 * The frozen static guard reads declarations as text, so `transparent`,
 * `rgb(0 0 0 / 0.0%)`, a `var()` fallback, a colour behind one level of
 * indirection, `all: unset`, and `:is(.x)` are nine different problems to it. A
 * computed style is the value the pixel is painted from: every one of those
 * spellings has already collapsed into the same resolved answer by the time it
 * is read here, so this assertion cannot be beaten by a tenth spelling.
 *
 * What it decides: this control is distinguishable from the prose around it
 * without relying on colour alone. The reference is not a hard-coded token but
 * a throwaway span inserted at the control's own position in the tree, so it
 * measures the colour this text would have had if it were ordinary body copy.
 */
async function expectLooksLikeALink(page: Page, name: string, affordance: Affordance) {
  const selector = await moduleClassSelector(page, name);
  const control = page.locator(selector).first();
  await expect(control, `\`${name}\` does not render on ${page.url()}`).toBeVisible();

  const measured = await control.evaluate((element) => {
    const probe = document.createElement("span");
    probe.textContent = "reference";
    element.parentElement?.insertBefore(probe, element);
    const surroundingColour = getComputedStyle(probe).color;
    probe.remove();

    let background = "rgba(0, 0, 0, 0)";
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      const candidate = getComputedStyle(node).backgroundColor;
      if (!/rgba\([^)]*,\s*0\)$/.test(candidate) && candidate !== "transparent") {
        background = candidate;
        break;
      }
    }

    const style = getComputedStyle(element);
    const sides = ["Top", "Right", "Bottom", "Left"] as const;
    const borders = sides.map((side) => ({
      width: Number.parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)),
      colour: style.getPropertyValue(`border-${side.toLowerCase()}-color`),
      style: style.getPropertyValue(`border-${side.toLowerCase()}-style`),
    }));

    return {
      colour: style.color,
      surroundingColour,
      background,
      decorationLine: style.textDecorationLine,
      decorationColour: style.textDecorationColor,
      decorationThickness: style.textDecorationThickness,
      fontWeight: style.fontWeight,
      borders,
    };
  });

  const colour = parseColour(measured.colour);
  const surrounding = parseColour(measured.surroundingColour);
  const background = parseColour(measured.background);
  expect(colour, `\`${name}\` has an unreadable computed colour: ${measured.colour}`).not.toBeNull();
  expect(surrounding, "the reference span has an unreadable computed colour").not.toBeNull();

  // It paints at all. Every one of Ruling 57's nine spellings ended here.
  expect(
    colour!.a,
    `\`${name}\` paints its text in ink that is effectively invisible (${measured.colour})`,
  ).toBeGreaterThanOrEqual(0.5);
  if (background !== null) {
    expect(
      sameColour({ ...colour!, a: 1 }, { ...background, a: 1 }),
      `\`${name}\` paints its text the same colour as its own background (${measured.colour})`,
    ).toBe(false);
  }

  // It is not the same as the prose it sits in.
  expect(
    sameColour(colour!, surrounding!),
    `\`${name}\` is exactly the colour of the text around it (${measured.colour}), so colour distinguishes it from nothing`,
  ).toBe(false);

  if (affordance.underline) {
    expect(
      measured.decorationLine,
      `\`${name}\` carries no underline, so it is distinguished from body text by colour alone`,
    ).toContain("underline");
    const decoration = parseColour(measured.decorationColour);
    expect(decoration, `\`${name}\` has an unreadable decoration colour: ${measured.decorationColour}`).not.toBeNull();
    expect(
      decoration!.a,
      `\`${name}\` draws its underline in ink that is effectively invisible (${measured.decorationColour})`,
    ).toBeGreaterThanOrEqual(0.5);
    expect(
      Number.parseFloat(measured.decorationThickness) || 1,
      `\`${name}\` draws a zero-thickness underline`,
    ).toBeGreaterThan(0);
  }

  if (affordance.border) {
    const painted = measured.borders.filter((border) => {
      const ink = parseColour(border.colour);
      return border.width > 0 && border.style !== "none" && ink !== null && ink.a >= 0.5;
    });
    expect(
      painted.length,
      `\`${name}\` draws no visible border on any side (${JSON.stringify(measured.borders)})`,
    ).toBeGreaterThan(0);
  }
}

/**
 * The pinned safety boundary sits above every other piece of plan content.
 * Asserted geometrically, from painted boxes — document order was already
 * proved in jsdom, and a `grid-row` or `order` rule could invert it visually
 * with every one of those assertions still green.
 */
async function expectPinnedBoundaryAbovePlanContent(page: Page) {
  const boundary = pinnedBoundary(page).first();
  await expect(boundary).toBeVisible();
  await expect(boundary).toContainText(PINNED_BOUNDARY_SENTENCE);

  const boundaryBox = await boundary.boundingBox();
  expect(boundaryBox, "the pinned safety boundary has no painted box").not.toBeNull();
  expect(boundaryBox!.height, "the pinned safety boundary is collapsed to nothing").toBeGreaterThan(8);

  const sections = page.getByTestId("care-plan-first-minute-sections").first();
  await expect(sections).toBeVisible();
  const sectionsBox = await sections.boundingBox();
  expect(sectionsBox, "the first-minute sections have no painted box").not.toBeNull();
  expect(
    boundaryBox!.y + boundaryBox!.height,
    "the pinned safety boundary is not above the plan content it guards",
  ).toBeLessThanOrEqual(sectionsBox!.y + 1);

  // Never collapsed, truncated, or clipped: the painted box must hold the text.
  const clipping = await boundary.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      maxHeight: style.maxHeight,
      overflow: style.overflow,
      webkitLineClamp: style.getPropertyValue("-webkit-line-clamp"),
      textOverflow: style.textOverflow,
      display: style.display,
      visibility: style.visibility,
    };
  });
  expect(clipping.display, "the pinned safety boundary is not displayed").not.toBe("none");
  expect(clipping.visibility, "the pinned safety boundary is hidden").not.toBe("hidden");
  expect(clipping.webkitLineClamp, "the pinned safety boundary is line-clamped").toMatch(/^(none|)$/);
  expect(
    clipping.scrollHeight - clipping.clientHeight,
    "the pinned safety boundary's content is taller than the box painting it, so it is clipped",
  ).toBeLessThanOrEqual(1);
}

// --- Journeys ---------------------------------------------------------------

test.describe("@mockup Care Plan synthetic prototype", () => {
  test("every route in the family is directly reconstructable from its address", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const [route, heading] of ROUTE_HEADINGS) {
      await gotoRoute(page, route, heading);
      await expectSinglePageHeading(page, heading);
      await expectSyntheticBoundary(page);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("the pinned safety boundary is above the plan at every supported width", async ({ page }) => {
    test.setTimeout(180_000);
    for (const width of REQUIRED_WIDTHS) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await gotoRoute(page, routes.managementPlan, "Management Plan");
      await expectPinnedBoundaryAbovePlanContent(page);
      await expectNoHorizontalOverflow(page);

      // The full fifth section is still there in full, never replaced by the
      // pinned line and never behind a disclosure.
      const fifth = page.getByRole("heading", { name: "5. What would make this presentation different" });
      await expect(fifth).toBeVisible();
      await expect(page.locator("details")).toHaveCount(0);
    }
  });

  test("the pinned safety boundary survives dark mode and forced colours", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.emulateMedia({ colorScheme: "dark" });
    await gotoRoute(page, routes.managementPlan, "Management Plan");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectPinnedBoundaryAbovePlanContent(page);

    await page.emulateMedia({ colorScheme: "light", forcedColors: "active" });
    await gotoRoute(page, routes.managementPlan, "Management Plan");
    await expectPinnedBoundaryAbovePlanContent(page);
    // Forced colours flattens tint, so the border is what still carries the box.
    const border = await pinnedBoundary(page)
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { width: Number.parseFloat(style.borderTopWidth), colour: style.borderTopColor };
      });
    expect(border.width, "the pinned boundary loses its outline in forced colours").toBeGreaterThan(0);
    const ink = parseColour(border.colour);
    expect(ink, `unreadable forced-colours border: ${border.colour}`).not.toBeNull();
    expect(ink!.a, "the pinned boundary's forced-colours border is transparent").toBeGreaterThanOrEqual(0.5);

    await page.emulateMedia({ forcedColors: "none" });
  });

  /**
   * Ruling 57's replacement. Each entry names the affordance that class is
   * meant to carry: the four text links must draw a real underline, and the two
   * pill controls must draw a real border. Every one must also paint in ink that
   * differs from the prose it sits in.
   */
  test("every named link affordance still looks like a control in a real browser", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1000 });

    const affordances: readonly (readonly [string, string, string, Affordance])[] = [
      [routes.patient, "Patient overview", "pinnedBoundaryLink", { underline: true, border: false }],
      [routes.patient, "Patient overview", "patientNavSecondary", { underline: false, border: true }],
      [routes.history, "History", "inlineLink", { underline: true, border: false }],
      [routes.presentations, "ED Presentations", "timelineLink", { underline: true, border: false }],
      [routes.reviews, "Reviews", "queueAction", { underline: true, border: true }],
      [routes.systemStates, "System states", "specimenLink", { underline: true, border: false }],
    ];

    for (const [route, heading, name, affordance] of affordances) {
      await gotoRoute(page, route, heading);
      await expectLooksLikeALink(page, name, affordance);
    }
  });

  test("the clinician Management Plan reaches paper whole", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoRoute(page, routes.managementPlanPrint, "Print Management Plan");
    await page.emulateMedia({ media: "print" });

    const paper = printPaper(page);
    await expect(paper).toBeVisible();

    // The one line that says the document is fictional. Removed by accident
    // twice on this project; it is inside the printed subtree, because the
    // shared rule hides everything outside it.
    await expect(paper.getByText("Synthetic prototype — fictional people, teams, and hospitals")).toBeVisible();
    await expect(paper.getByText(/Printed on \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
    await expect(paper.getByText(/Confidential clinical document/)).toBeVisible();
    await expect(paper.getByTestId("care-plan-print-record-warning")).toBeVisible();

    // The pinned boundary prints, above the plan, in full.
    await expectPinnedBoundaryAbovePlanContent(page);

    // Screen chrome does not.
    await expect(desktopRail(page)).toBeHidden();
    await expect(phoneDock(page)).toBeHidden();
    await expect(page.getByRole("button", { name: "Print this plan" })).toBeHidden();

    // The monochrome contract actually wins the cascade against every Tailwind
    // utility and CSS-module rule in the subtree, rather than merely being
    // declared. Asserted on resolved ink, not on a class name.
    const ink = await paper.evaluate((element) => {
      const samples = [element, ...element.querySelectorAll("h2, h3, p, li, dd")].slice(0, 40);
      return samples.map((node) => {
        const style = getComputedStyle(node as Element);
        return { colour: style.color, background: style.backgroundColor };
      });
    });
    for (const sample of ink) {
      const colour = parseColour(sample.colour);
      expect(colour, `unreadable printed colour: ${sample.colour}`).not.toBeNull();
      expect(
        colour!.r + colour!.g + colour!.b,
        `printed text is not black on paper (${sample.colour}), so a greyscale printer decides its contrast`,
      ).toBe(0);
      const background = parseColour(sample.background);
      if (background !== null && background.a > 0) {
        expect(
          background.r + background.g + background.b,
          `printed background is tinted (${sample.background}), so a state carried by tint is lost on greyscale`,
        ).toBe(765);
      }
    }

    // Page-break control is asked for, per block, rather than left to chance.
    const breaks = await paper.evaluate((element) =>
      [...element.querySelectorAll("[data-print-break-inside='avoid']")].map(
        (node) => getComputedStyle(node).breakInside,
      ),
    );
    expect(breaks.length, "no printed block asks to be kept whole").toBeGreaterThan(0);
    for (const value of breaks) expect(value).toBe("avoid");

    await page.emulateMedia({ media: "screen" });
  });

  test("the Personal Safety Plan prints as the person's own document", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoRoute(page, routes.safetyPlanPrint, "Print Personal Safety Plan");
    await page.emulateMedia({ media: "print" });

    const paper = printPaper(page);
    await expect(paper).toBeVisible();
    await expect(paper.getByText("Synthetic prototype — fictional people, teams, and hospitals")).toBeVisible();
    await expect(paper.getByRole("heading", { name: "My Personal Safety Plan" })).toBeVisible();

    // Every one of the person's own headings reaches the paper. A section
    // silently dropped from somebody's own safety plan is the worst defect this
    // surface can carry.
    for (const heading of [
      "My warning signs",
      "Making my surroundings safer",
      "My reasons for living",
      "Things I can do myself",
      "People and places that help me feel connected",
      "Family, friends, and supports I can contact",
      "Professional and emergency support",
    ]) {
      await expect(paper.getByRole("heading", { name: heading })).toBeVisible();
    }

    // Nothing in the person's own words is empty on paper, and nothing on it
    // says a part of their life was "Not recorded".
    await expect(paper).not.toContainText("Not recorded");

    // The crisis line and the sentence that says it is not an emergency service
    // are never separated by a page break.
    const crisisBreaks = await paper.evaluate((element) =>
      [...element.querySelectorAll("[data-print-break-inside='avoid']")].map(
        (node) => getComputedStyle(node).breakInside,
      ),
    );
    expect(crisisBreaks.length).toBeGreaterThan(0);
    for (const value of crisisBreaks) expect(value).toBe("avoid");

    await expect(paper.getByText(/000/).first()).toBeVisible();
    await expect(paper.getByText(/not an emergency service/i).first()).toBeVisible();

    await page.emulateMedia({ media: "screen" });
  });

  test("a clinician can search a name and reach the Current Plan", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await gotoRoute(page, routes.home, "Home");

    await page.getByRole("searchbox", { name: "Search synthetic patients" }).fill("Rowan");
    await page.getByRole("link", { name: "Open the full record for Rowan Sample" }).click();
    await expect(page).toHaveURL(new RegExp(`${routes.patient}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Patient overview" })).toBeFocused();

    await page
      .getByRole("navigation", { name: "Patient sections" })
      .getByRole("link", { name: "Management Plan" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Management Plan" })).toBeVisible();
    await expectPinnedBoundaryAbovePlanContent(page);
    await expect(page.getByTestId("care-plan-current-plan-metadata")).toBeVisible();
  });

  test("a version awaiting approval never displaces the Current Plan", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await gotoRoute(page, `${patientPath("SYN-PATIENT-002")}/management-plan`, "Management Plan");

    const current = page.getByRole("region", { name: "Current Plan" });
    const draft = page.getByRole("region", { name: "Version in progress" });
    await expect(current).toBeVisible();
    await expect(draft).toBeVisible();

    const [currentBox, draftBox] = await Promise.all([current.boundingBox(), draft.boundingBox()]);
    expect(currentBox).not.toBeNull();
    expect(draftBox).not.toBeNull();
    expect(currentBox!.y, "the version awaiting approval is painted above the plan actually in use").toBeLessThan(
      draftBox!.y,
    );
  });

  test("the whole authoring lifecycle runs in the browser without losing the Current Plan", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoRoute(page, routes.reviews, "Reviews");

    // The named senior clinician is the only role that may decide.
    await page.getByLabel("Prototype role").selectOption({ label: "Dr Taylor Fiction — Named senior clinician" });
    await page.getByRole("link", { name: "Compare and decide on Mira Example's version 2" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Review submitted version" })).toBeVisible();

    // Return for changes, then approve on the second pass.
    await page.getByRole("button", { name: /^Return version 2 for changes/ }).click();
    await page.getByLabel("What needs to change").fill("Add the after-hours arrangement the team agreed on Tuesday.");
    await page.getByRole("button", { name: "Return for changes" }).click();
    await expect(page.getByTestId("care-plan-review-outcome")).toContainText(/returned/i);

    await gotoRoute(page, `${patientPath("SYN-PATIENT-002")}/management-plan`, "Management Plan");
    await expect(page.getByRole("region", { name: "Current Plan" })).toBeVisible();
  });

  /**
   * The person's own copy, end to end and in a browser: the conversion refuses
   * to guess, the refusals block approval with a stated reason, a clinician
   * fills them, any clinical role may approve, and the result reaches paper.
   */
  test("a Patient Plan shows its gaps, blocks approval until they are filled, and prints", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoRoute(page, routes.patientPlan, "Patient Plan");

    // The default synthetic user is an emergency physician, not a named senior
    // clinician: any clinical role may approve a patient copy, deliberately.
    await expect(page.getByTestId("care-plan-active-user")).toContainText("Dr Casey Example");
    await expect(page.getByTestId("care-plan-patient-plan-no-current")).toContainText(/no approved Patient Plan/i);

    await page.getByRole("button", { name: "Create the patient copy" }).click();
    await expect(page.getByTestId("care-plan-patient-plan-draft-notice")).toContainText(/sections still to write/i);

    await page.getByRole("link", { name: /Continue draft version|Write a new copy with this person/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Draft Patient Plan" })).toBeVisible();

    // Section 4 is never auto-converted, under any circumstances.
    const agreed = page.getByTestId("care-plan-patient-plan-form-gap-whatWeAgreedWillHappen");
    await expect(agreed).toBeVisible();
    await expect(agreed).toContainText(/never converted automatically/i);

    const approve = page.getByRole("button", { name: "Approve patient copy" });
    await expect(approve).toHaveAttribute("aria-disabled", "true");
    await expect(approve).not.toHaveAttribute("disabled", /.*/);
    const reason = page.getByTestId("care-plan-patient-plan-approve-unavailable");
    await expect(reason).toContainText(/cannot be approved while/i);

    for (const field of await page.locator("form textarea").all()) {
      await field.fill("We wrote this together at the bedside, in your words.");
    }
    await expect(page.getByRole("button", { name: "Approve patient copy" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.getByRole("button", { name: "Approve patient copy" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Patient Plan" })).toBeVisible();
    await expect(page.getByTestId("care-plan-patient-plan-version")).toContainText("Dr Casey Example");

    await page.getByRole("link", { name: "Print this copy" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Print Patient Plan" })).toBeVisible();
    await page.emulateMedia({ media: "print" });

    const paper = printPaper(page);
    await expect(paper).toBeVisible();
    await expect(paper.getByText("Synthetic prototype — fictional people, teams, and hospitals")).toBeVisible();
    await expect(paper).not.toContainText("Not recorded");
    // Nothing clinical, and nothing from the internal record, reaches the person.
    await expect(paper).not.toContainText(/Management Plan Version|Awaiting Approval|audit|Disposition/i);
    await page.emulateMedia({ media: "screen" });
  });

  test("a Patient Plan is marked as needing updating when a newer version becomes Current", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 1200 });
    const patient = "SYN-PATIENT-002";
    await gotoRoute(page, `${patientPath(patient)}/patient-plan`, "Patient Plan");

    await page.getByRole("button", { name: "Create the patient copy" }).click();
    await page.getByRole("link", { name: /Continue draft version|Write a new copy with this person/ }).click();
    for (const field of await page.locator("form textarea").all()) {
      await field.fill("We wrote this together at the bedside, in your words.");
    }
    await page.getByRole("button", { name: "Approve patient copy" }).click();
    await expect(page.getByTestId("care-plan-patient-plan-version")).toBeVisible();
    await expect(page.getByTestId("care-plan-patient-plan-stale")).toHaveCount(0);

    // Approve the version already awaiting approval, as the named senior
    // clinician. Every step from here is a client-side navigation: a full
    // reload would reset the prototype, which is the documented boundary.
    await page.getByLabel("Prototype role").selectOption({ label: "Dr Taylor Fiction — Named senior clinician" });
    await desktopRail(page).getByRole("link", { name: "Reviews" }).click();
    await page.getByRole("link", { name: "Compare and decide on Mira Example's version 2" }).click();
    await page.getByRole("button", { name: "Approve version 2" }).click();
    await page
      .getByRole("dialog", { name: "Approve Management Plan version 2" })
      .getByRole("button", { name: "Approve and make Current" })
      .click();

    await page.getByRole("link", { name: "Back to the Management Plan" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Management Plan" })).toBeVisible();
    await page.getByRole("link", { name: /^Current Patient Plan version/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Patient Plan" })).toBeVisible();

    // Marked, fully readable, not regenerated, not hidden, not withdrawn.
    await expect(page.getByTestId("care-plan-patient-plan-stale")).toContainText(/needs updating/i);
    await expect(page.getByTestId("care-plan-patient-plan-content")).toBeVisible();
    await expect(page.getByTestId("care-plan-patient-plan-version")).toContainText("Version 1");
  });

  test("a Personal Safety Plan is written, made current, and printed without touching the clinical plan", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoRoute(page, routes.safetyPlanEdit, "Draft Personal Safety Plan Version");

    await page.getByRole("button", { name: "Start a new version" }).click();
    await expect(page.getByTestId("care-plan-safety-form-surface")).toBeVisible();
    await page.getByRole("button", { name: "Make current Personal Safety Plan" }).click();

    const confirm = page.getByRole("dialog", { name: /Make version \d+ the current Personal Safety Plan/ });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Make it the current plan" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Personal Safety Plan" })).toBeVisible();
    await expect(page.getByTestId("care-plan-safety-sections")).toBeVisible();

    await page.getByRole("link", { name: "Print this plan" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Print Personal Safety Plan" })).toBeVisible();
    await expect(printPaper(page)).toBeVisible();
  });

  test("a Review Trigger is resolved without the plan changing by itself", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoRoute(page, routes.reviews, "Reviews");
    await page.getByRole("tab", { name: /^Review Suggested/ }).click();

    const resolve = page.getByRole("button", { name: /^Record what was decided for / }).first();
    await expect(resolve).toBeVisible();
    await resolve.click();
    const sheet = page.getByRole("dialog", { name: "Record what was decided" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(/never changes a plan|A trigger never changes a plan/i);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(resolve).toBeFocused();
  });

  test("a team's contact details are confirmed as checked, never as available", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoRoute(page, routes.reviews, "Reviews");
    await page.getByRole("tab", { name: /^Contact Verification/ }).click();

    await expect(page.getByText(/not a guarantee that the service is available/i).first()).toBeVisible();
    const record = page.getByRole("button", { name: /^Record that .* details were checked$/ }).first();
    await expect(record).toBeVisible();
    await record.click();
    await expect(page.getByTestId("care-plan-reviews-outcome")).toBeVisible();
    await expect(page.getByTestId("care-plan-reviews-outcome")).not.toContainText(/available|reachable|answered/i);
  });

  test("recording an ED Presentation writes an episode and can raise a Review Trigger", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoRoute(page, routes.newPresentation, "Record ED Presentation");

    await page.getByLabel("Emergency department").selectOption({ index: 1 });
    await page.getByLabel("Disposition").selectOption({ label: "Discharged home" });
    await page
      .getByLabel("In one line: why they came and what happened")
      .fill("Came in distressed after a bad night; settled in the quiet room.");
    await page.getByLabel("Was the Current Plan available?").selectOption({ label: "Available" });
    await page.getByLabel("Was the Current Plan used?").selectOption({ label: "Used" });
    await page.getByLabel("Was the plan helpful?").selectOption({ label: "Did not help" });
    await page.getByLabel("Suggest a plan review").check();
    await page
      .getByLabel("Why is review suggested?")
      .fill("The quiet room was not available and the agreed approach did not fit.");

    const submit = page.getByRole("button", { name: "Record ED presentation" });
    await expectPhoneDockClearance(page, submit);
    await submit.click();

    await expect(page.getByTestId("care-plan-presentation-outcome")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "ED Presentation" })).toBeVisible();
  });

  test("a recorded outcome is corrected by amendment rather than overwritten", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await gotoRoute(page, routes.presentation, "ED Presentation");

    const trigger = page.getByRole("button", { name: "Amend recorded outcome" });
    await trigger.click();
    const sheet = page.getByRole("dialog", { name: "Correct this ED Presentation" });
    await expect(sheet).toBeVisible();

    // `portal={false}` keeps this sheet inside the Care Plan subtree so its
    // fields inherit the prototype's stylesheet. Task 7 deferred the question of
    // what that does to the overlay and the focus trap; this is the first look.
    const inTree = await sheet.evaluate((element) => element.closest("[class*='appRoot']") !== null);
    expect(inTree, "the in-tree sheet escaped the Care Plan subtree, so its fields lose the prototype stylesheet").toBe(
      true,
    );
    const textareaHeight = await sheet
      .locator("textarea")
      .first()
      .evaluate((element) => element.getBoundingClientRect().height);
    expect(textareaHeight, "the in-tree sheet's multi-line field collapsed to a single-line height").toBeGreaterThan(
      48,
    );

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the phone More sheet traps focus, closes on Escape, and gives focus back", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoRoute(page, routes.home, "Home");

    const trigger = phoneDock(page).getByRole("button", { name: "More" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link", { name: /Governance/ })).toBeVisible();

    // Focus is inside the sheet, and Tab keeps it there.
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press("Tab");
      const inside = await sheet.evaluate((element) => element.contains(document.activeElement));
      expect(inside, "focus escaped the open sheet").toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a confirmation dialog closes on Escape and returns focus to what opened it", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoRoute(page, routes.managementPlan, "Management Plan");

    const trigger = page.getByRole("button", { name: "Record a formal review" });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const sheet = page.getByRole("dialog", { name: "Record a formal review" });
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the CMHT contact controls carry no patient detail", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await gotoRoute(page, routes.patient, "Patient overview");

    const email = page.getByRole("link", { name: "Email North River CMHT" });
    const href = await email.getAttribute("href");
    expect(href, "the email control has no address at all").not.toBeNull();
    expect(href!.startsWith("mailto:north-river.cmht@example.org")).toBe(true);
    for (const forbidden of ["Rowan", "Sample", "SYN-MRN-0001", "1986", "12/04", "distress"]) {
      expect(href!.toLowerCase(), `the mailto carries \`${forbidden}\``).not.toContain(forbidden.toLowerCase());
    }

    const call = page.getByRole("link", { name: "Call North River CMHT" });
    expect((await call.getAttribute("href"))?.startsWith("tel:")).toBe(true);
    await expect(page.getByText(/holds no evidence of delivery, readership, or reply/i)).toBeVisible();
  });

  test("a manual Identification Review is recorded without creating a plan", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await gotoRoute(page, patientPath("SYN-PATIENT-005"), "Patient overview");

    await page.getByRole("button", { name: "Refer Alex Fiction for Identification Review" }).click();
    const sheet = page.getByRole("dialog", { name: "Refer for Identification Review" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(/creates no plan/i);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    // The screen says out loud that attendance counts decide nothing.
    await expect(page.getByText(/do not determine eligibility|decide nothing/i).first()).toBeVisible();
  });

  test("the Reviews worklists open, resolve, and stay operable on a 320px phone", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 320, height: 844 });
    await gotoRoute(page, routes.reviews, "Reviews");

    // The four-tab queue strip at the narrowest supported width — Task 10 left
    // this as its own first look.
    for (const label of ["Awaiting Approval", "Review Suggested", "Contact Verification", "Identification Review"]) {
      const tab = page.getByRole("tab", { name: new RegExp(`^${label}`) });
      await expect(tab).toBeVisible();
      const box = await tab.boundingBox();
      expect(box, `the ${label} tab has no painted box at 320px`).not.toBeNull();
      expect(box!.height, `the ${label} tab is below the 48px tap convention at 320px`).toBeGreaterThanOrEqual(44);
      await tab.click();
      await expect(page.getByTestId("care-plan-review-queue")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("the audit chronology reads as one record", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await gotoRoute(page, routes.history, "History");
    await expect(page.getByTestId("care-plan-history-list")).toBeVisible();
    await expect(page.getByTestId("care-plan-history-filter-note")).toBeVisible();
    // An intent is never rendered as a delivery.
    await expect(page.getByTestId("care-plan-history-list")).not.toContainText(/\b(delivered|read by|replied)\b/i);
  });

  test("every degraded specimen renders its stated reason rather than a blank screen", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const scenario of SCENARIOS) {
      await gotoRoute(page, `${routes.patient}?scenario=${scenario}`, "Patient overview");
      await expectSyntheticBoundary(page);
      await expectNoHorizontalOverflow(page);
      const main = page.locator("main").last();
      const text = (await main.innerText()).trim();
      expect(text.length, `the \`${scenario}\` specimen renders an empty page`).toBeGreaterThan(80);
    }

    await gotoRoute(page, `${routes.patient}?scenario=identity-uncertain`, "Patient overview");
    await expect(page.getByTestId("care-plan-identity-uncertain")).toContainText(/Return to search/i);
    await expect(page.getByTestId("care-plan-first-minute-sections")).toHaveCount(0);
  });

  test("the whole family reflows at every required width without sideways scrolling", async ({ page }) => {
    test.setTimeout(300_000);
    const sample = [routes.home, routes.patient, routes.managementPlan, routes.safetyPlan, routes.reviews] as const;
    for (const width of REQUIRED_WIDTHS) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      for (const route of sample) {
        await gotoRoute(page, route);
        await expectNoHorizontalOverflow(page);
        if (width < 768) {
          await expect(phoneDock(page)).toBeVisible();
          await expect(desktopRail(page)).toBeHidden();
          for (const item of await phoneDock(page).getByRole("link").all()) {
            const box = await item.boundingBox();
            expect(box, "a phone dock destination has no painted box").not.toBeNull();
            expect(box!.height, "a phone dock destination is below the 48px tap convention").toBeGreaterThanOrEqual(44);
          }
        } else {
          await expect(desktopRail(page)).toBeVisible();
          await expect(phoneDock(page)).toBeHidden();
        }
      }
    }
  });

  test("content reflows at 200% zoom equivalent without sideways scrolling", async ({ page }) => {
    test.setTimeout(180_000);
    // 1280x1024 at 200% is 640x512 CSS pixels, the WCAG 1.4.10 measurement.
    await page.setViewportSize({ width: 640, height: 512 });
    for (const route of [routes.managementPlan, routes.safetyPlan, routes.patientPlan, routes.governance]) {
      await gotoRoute(page, route);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("reduced motion removes decoration without hiding a state change", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoRoute(page, routes.home, "Home");
    await phoneDock(page).getByRole("button", { name: "More" }).click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet).toBeVisible();
    const duration = await sheet.evaluate((element) => getComputedStyle(element).animationDuration);
    expect(Number.parseFloat(duration) || 0, "the sheet still animates under reduced motion").toBeLessThanOrEqual(0.05);
    await page.keyboard.press("Escape");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await gotoRoute(page, routes.home, "Home");
    await phoneDock(page).getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("dialog", { name: "More" })).toBeVisible();
  });

  test("keyboard traversal reaches the plan without a mouse, with a visible focus ring", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await gotoRoute(page, routes.patient, "Patient overview");

    // Walk the tab order and record what is reachable, and whether whatever
    // holds focus is actually drawn with a ring. A focus ring that resolves to
    // nothing is invisible to a keyboard reader and to `css: false` alike.
    const reached: string[] = [];
    let ringless: string | null = null;
    for (let step = 0; step < 40; step += 1) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (active === null || active === document.body) return null;
        const style = getComputedStyle(active);
        return {
          name: (active.getAttribute("aria-label") ?? active.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 60),
          outlineWidth: Number.parseFloat(style.outlineWidth) || 0,
          outlineStyle: style.outlineStyle,
          outlineColour: style.outlineColor,
          boxShadow: style.boxShadow,
        };
      });
      if (focused === null) continue;
      reached.push(focused.name);
      const outlineInk = parseColour(focused.outlineColour);
      const hasRing =
        (focused.outlineWidth > 0 && focused.outlineStyle !== "none" && (outlineInk?.a ?? 0) >= 0.5) ||
        (focused.boxShadow !== "none" && focused.boxShadow.length > 0);
      if (!hasRing && ringless === null) ringless = focused.name || "(an unnamed control)";
    }
    expect(reached.length, "tabbing reached no control at all").toBeGreaterThan(5);
    expect(ringless, `\`${ringless}\` takes focus with no visible ring`).toBeNull();

    // The plan's own jump link is reachable and moves the reader to the section.
    await page.getByRole("link", { name: /What would make this presentation different/ }).click();
    await expect(page.getByRole("heading", { name: "5. What would make this presentation different" })).toBeVisible();
  });

  test("forced colours keeps Current, Draft, Review and Withdrawn distinguishable", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ forcedColors: "active" });

    await gotoRoute(page, `${patientPath("SYN-PATIENT-002")}/management-plan`, "Management Plan");
    await expect(page.getByRole("region", { name: "Current Plan" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Version in progress" })).toBeVisible();
    // The state is carried by a word, not only by a tint.
    await expect(page.getByText("Awaiting Approval").first()).toBeVisible();

    await gotoRoute(page, `${routes.patient}?scenario=withdrawn-plan`, "Patient overview");
    await expect(page.getByText(/withdraw/i).first()).toBeVisible();

    await page.emulateMedia({ forcedColors: "none" });
  });

  test("dark mode paints the whole prototype, not a half-themed page", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoRoute(page, routes.managementPlan, "Management Plan");
    await expect(page.locator("html")).toHaveClass(/dark/);

    const contrast = await page.evaluate(() => {
      const sample = document.querySelector("main [class*='pageTitle']") ?? document.body;
      const style = getComputedStyle(sample);
      const body = getComputedStyle(document.body);
      return { text: style.color, background: body.backgroundColor };
    });
    const text = parseColour(contrast.text);
    const background = parseColour(contrast.background);
    expect(text, `unreadable dark-mode text colour: ${contrast.text}`).not.toBeNull();
    if (background !== null && background.a > 0) {
      const luminance = (c: Rgba) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      expect(
        Math.abs(luminance(text!) - luminance(background)),
        "dark-mode heading text is the same brightness as the page behind it",
      ).toBeGreaterThan(60);
    }
    await page.emulateMedia({ colorScheme: "light" });
  });

  // --- Optional evidence capture ---------------------------------------------

  test("captures the Care Plan handoff atlas", async ({ page }) => {
    test.skip(!captureEvidence, "Set CARE_PLAN_CAPTURE_EVIDENCE=1 to refresh the Care Plan evidence atlas.");
    test.setTimeout(600_000);
    rmSync(captureDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    mkdirSync(captureDirectory, { recursive: true });
    const manifest: object[] = [];

    const surfaces: readonly (readonly [string, string, string])[] = [
      ["home", routes.home, "Home"],
      ["patient", routes.patient, "Patient overview"],
      ["management-plan", routes.managementPlan, "Management Plan"],
      ["management-plan-review", routes.managementPlanReview, "Review submitted version"],
      ["presentations", routes.presentations, "ED Presentations"],
      ["safety-plan-print", routes.safetyPlanPrint, "Print Personal Safety Plan"],
      ["reviews", routes.reviews, "Reviews"],
      ["system-states", routes.systemStates, "System states"],
    ];

    async function capture(name: string, route: string, note: string) {
      const target = page.locator("main").last();
      await expect(target).toBeVisible();
      await target.screenshot({ path: resolve(captureDirectory, `${name}.png`), animations: "disabled" });
      manifest.push({ file: `${name}.png`, route, viewport: page.viewportSize(), note });
    }

    for (const [device, width, height] of [
      ["320", 320, 844],
      ["390", 390, 844],
      ["1440", 1440, 1200],
    ] as const) {
      await page.setViewportSize({ width, height });
      for (const [name, route, heading] of surfaces) {
        await gotoRoute(page, route, heading);
        await capture(`${device}-${name}`, route, "normal");
      }
    }

    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoRoute(page, routes.managementPlan, "Management Plan");
    await capture("dark-management-plan", routes.managementPlan, "dark");
    await page.emulateMedia({ colorScheme: "light", forcedColors: "active" });
    await gotoRoute(page, routes.managementPlan, "Management Plan");
    await capture("forced-colours-management-plan", routes.managementPlan, "forced-colours");
    await page.emulateMedia({ forcedColors: "none" });

    const images = readdirSync(captureDirectory).filter((name) => name.endsWith(".png"));
    expect(images.length).toBe(surfaces.length * 3 + 2);
    writeFileSync(
      resolve(captureDirectory, "manifest.json"),
      `${JSON.stringify(
        {
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          generatedAt: new Date().toISOString(),
          captures: manifest,
        },
        null,
        2,
      )}\n`,
    );
  });
});
