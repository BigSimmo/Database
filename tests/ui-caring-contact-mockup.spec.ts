import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Locator, type Page } from "playwright/test";

const mockupPath = "/mockups/caring-contacts";
const requiredWidths = [320, 390, 430, 768, 1024, 1440] as const;
const captureMajorPages = process.env.CARING_CONTACT_CAPTURE_MAJOR_PAGES === "1";
const captureDirectory = resolve(process.cwd(), ".local", "caring-contact-product-redesign", "2026-08-15");

async function gotoMockup(page: Page) {
  await page.goto(mockupPath, { waitUntil: "domcontentloaded" });
  const marker = page.getByTestId("caring-contact-synthetic-marker").first();
  await expect(marker).toHaveAttribute("title", "Synthetic prototype — fictional data only", { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

function activeNavigation(page: Page) {
  return page.getByRole("navigation", {
    name: page.viewportSize()!.width < 768 ? "Phone workspace" : "Desktop workspace",
  });
}

async function chooseDestination(page: Page, destination: "Today" | "Patients" | "Schedule") {
  await activeNavigation(page).getByRole("button", { name: destination, exact: true }).click();
}

async function chooseSupportingDestination(page: Page, destination: "Templates" | "Team" | "Guidance" | "Reports") {
  const compact = page.viewportSize()!.width < 768;
  if (!compact && destination === "Templates") {
    await activeNavigation(page).getByRole("button", { name: destination, exact: true }).click();
    return;
  }

  await activeNavigation(page).getByRole("button", { name: "More", exact: true }).click();
  await page
    .getByRole("dialog", { name: "More" })
    .getByRole("button", { name: new RegExp(`^${destination}`) })
    .click();
}

async function expectPhoneDockClearance(page: Page, control: Locator) {
  if (page.viewportSize()!.width >= 768) return;

  await control.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const [controlBox, dockBox] = await Promise.all([
    control.boundingBox(),
    page.getByRole("navigation", { name: "Phone workspace" }).boundingBox(),
  ]);
  expect(controlBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(controlBox!.y + controlBox!.height).toBeLessThanOrEqual(dockBox!.y);
}

async function continueWorkflow(page: Page, buttonName: string, nextHeading: string) {
  const button = page.getByRole("button", { name: buttonName, exact: true });
  await expectPhoneDockClearance(page, button);
  await button.click();
  await expect(page.getByRole("heading", { level: 1, name: nextHeading, exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);
}

async function reachPlan(page: Page) {
  await chooseDestination(page, "Patients");
  await page.getByRole("button", { name: "View patient", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Patient overview" })).toBeFocused();
  await page.getByRole("button", { name: "View active plan", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Plan and contact detail" })).toBeFocused();
}

test.describe("@mockup Caring Contact product redesign", () => {
  test("product shell is responsive at every required handoff width", async ({ page }) => {
    for (const width of requiredWidths) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await gotoMockup(page);
      await expectNoHorizontalOverflow(page);

      const desktopRail = page.locator("aside").first();
      const phoneDock = page.getByRole("navigation", { name: "Phone workspace" });
      if (width < 768) {
        await expect(desktopRail).toBeHidden();
        await expect(phoneDock).toBeVisible();
        await expect(phoneDock.getByRole("button")).toHaveCount(4);
        await expectPhoneDockClearance(page, page.getByRole("button", { name: "Review Rowan Sample plan setup" }));
      } else {
        await expect(desktopRail).toBeVisible();
        await expect(phoneDock).toBeHidden();
        const [railBox, mainBox] = await Promise.all([desktopRail.boundingBox(), page.locator("main").boundingBox()]);
        expect(railBox).not.toBeNull();
        expect(mainBox).not.toBeNull();
        expect(mainBox!.x).toBeGreaterThanOrEqual(railBox!.x + railBox!.width - 1);
        expect(railBox!.width).toBeGreaterThanOrEqual(78);
        expect(railBox!.width).toBeLessThanOrEqual(82);
      }
    }
  });

  for (const width of [390, 1440] as const) {
    test(`governed activation is coherent and focus-safe at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await gotoMockup(page);

      await page.getByRole("button", { name: "Review Rowan Sample plan setup" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Patient and agreement" })).toBeFocused();
      await expect(page.getByText("Agreement confirmed: Yes").first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);

      await continueWorkflow(page, "Continue to pathway selection", "Pathway selection");
      const previewTrigger = page.getByRole("button", { name: "Preview pathway", exact: true });
      await previewTrigger.click();
      const preview = page.getByRole("dialog", { name: "Preview governed pathway" });
      await expect(preview).toBeVisible();
      await expect(preview.getByRole("listitem")).toHaveCount(10);
      const previewBox = await preview.boundingBox();
      expect(previewBox).not.toBeNull();
      if (width < 768) {
        expect(previewBox!.x).toBeLessThanOrEqual(1);
        expect(previewBox!.width).toBeGreaterThanOrEqual(width - 2);
      } else {
        expect(previewBox!.width).toBeLessThanOrEqual(640);
        expect(previewBox!.x + previewBox!.width).toBeGreaterThanOrEqual(width - 2);
      }
      await page.keyboard.press("Escape");
      await expect(previewTrigger).toBeFocused();

      await continueWorkflow(page, "Continue to personalisation", "Personalisation");
      await expect(page.getByRole("radio", { name: /Morning/ })).toBeChecked();
      await expect(page.getByText(/Hi Rowan, Alex from Example Aftercare Team is thinking of you/)).toBeVisible();

      await continueWorkflow(page, "Continue to review and activation", "Review and activation");
      const schedule = page.getByRole("list", { name: "Caring-contact schedule" });
      await expect(schedule.getByRole("listitem")).toHaveCount(10);
      await expect(schedule).toContainText("Morning 10:00 am AWST");

      const activate = page.getByRole("button", { name: "Activate 10-contact plan", exact: true });
      await expectPhoneDockClearance(page, activate);
      await activate.click();
      const confirmation = page.getByRole("dialog", { name: "Final activation assurance" });
      await expect(confirmation).toContainText("creates no plan and sends no message");
      await confirmation.getByRole("button", { name: "Confirm activation review" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Patient overview" })).toBeFocused();
      await expect(page.getByText("1 delivered · 9 scheduled")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("patient overview, plan actions and delivery exception work at phone and desktop widths", async ({ page }) => {
    for (const width of [390, 1440] as const) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await gotoMockup(page);
      await reachPlan(page);

      const pauseTrigger = page.getByRole("button", { name: "Pause plan", exact: true });
      await expectPhoneDockClearance(page, pauseTrigger);
      await pauseTrigger.click();
      await expect(page.getByRole("dialog", { name: "Pause caring-contact plan" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(pauseTrigger).toBeFocused();

      const exceptionTrigger = page.getByRole("button", { name: "Open delivery exception", exact: true });
      await expectPhoneDockClearance(page, exceptionTrigger);
      await exceptionTrigger.click();
      const exception = page.getByRole("dialog", { name: "Permanent delivery exception" });
      await expect(exception).toContainText("does not indicate patient safety, receipt, wellbeing or response");
      const box = await exception.boundingBox();
      expect(box).not.toBeNull();
      if (width < 768) expect(box!.width).toBeGreaterThanOrEqual(width - 2);
      else {
        expect(box!.width).toBeLessThanOrEqual(560);
        expect(box!.x + box!.width).toBeGreaterThanOrEqual(width - 2);
      }
      await exception.getByRole("button", { name: "Record operational review" }).click();
      await expect(exception.getByRole("status")).toContainText("synthetic contact and plan remain unchanged");
      await exception.getByRole("button", { name: "Close transport detail" }).click();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("Schedule changes date and week state without conflating named exceptions", async ({ page }) => {
    for (const width of [390, 1440] as const) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await gotoMockup(page);
      await chooseDestination(page, "Schedule");

      const weekDays = page.locator('button[aria-label$="scheduled contacts"]');
      await expect(weekDays).toHaveCount(7);
      const weekDayBoxes = await weekDays.evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, top: box.top, width: box.width };
        }),
      );
      expect(
        Math.max(...weekDayBoxes.map(({ top }) => top)) - Math.min(...weekDayBoxes.map(({ top }) => top)),
      ).toBeLessThanOrEqual(2);
      expect(weekDayBoxes.every(({ width: dayWidth }) => dayWidth >= 40)).toBe(true);
      expect(weekDayBoxes.every(({ left }, index) => index === 0 || left > weekDayBoxes[index - 1]!.left)).toBe(true);

      await page.getByRole("button", { name: "Sun 16 Aug, 3 scheduled contacts" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Sunday 16 August 2026" })).toBeVisible();
      await expect(page.getByText("No named exceptions for this day")).toBeVisible();
      await page.getByRole("button", { name: "Next week" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Saturday 22 August 2026" })).toBeVisible();
      await page.getByRole("button", { name: "Previous week" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Saturday 15 August 2026" })).toBeVisible();

      const exceptionTrigger = page.getByRole("button", { name: /Sam Wilson.*Transport status unavailable/ });
      await expectPhoneDockClearance(page, exceptionTrigger);
      await exceptionTrigger.click();
      await expect(page.getByRole("dialog", { name: "Permanent delivery exception" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expectNoHorizontalOverflow(page);
    }
  });

  test("supporting destinations remain focused, governed product pages", async ({ page }) => {
    for (const width of [390, 1440] as const) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await gotoMockup(page);

      await chooseSupportingDestination(page, "Templates");
      await expect(page.getByRole("heading", { level: 1, name: "Governed templates" })).toBeFocused();
      await page.getByRole("button", { name: /Example retired twelve-month pathway/ }).click();
      await expect(page.getByText("Unavailable for new activation")).toBeVisible();

      for (const destination of ["Team", "Guidance", "Reports"] as const) {
        await chooseSupportingDestination(page, destination);
        await expect(page.getByRole("heading", { level: 1, name: destination })).toBeFocused();
        if (destination === "Team") {
          if (width < 768) {
            await expect(page.getByTestId("team-mobile-roster")).toBeVisible();
            await expect(page.getByTestId("team-desktop-table")).toBeHidden();
          } else {
            await expect(page.getByTestId("team-mobile-roster")).toBeHidden();
            await expect(page.getByTestId("team-desktop-table")).toBeVisible();
          }
        }
        await expectNoHorizontalOverflow(page);
      }
      await expect(page.getByText(/No clinical outcome, response or engagement inference/i)).toBeVisible();
    }
  });

  test("reduced motion and forced colours retain visible focus and usable navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
    await gotoMockup(page);
    const review = page.getByRole("button", { name: "Review Rowan Sample plan setup" });
    await review.focus();
    await expect(review).toBeFocused();
    const outlineStyle = await review.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outlineStyle).not.toBe("none");
    await expectNoHorizontalOverflow(page);
  });

  async function captureSurface(page: Page, name: string, target: Locator = page.locator("main")) {
    await page.evaluate(() => document.documentElement.setAttribute("data-caring-contact-capture", "true"));
    await target.screenshot({ path: resolve(captureDirectory, name), animations: "disabled" });
    await page.evaluate(() => document.documentElement.removeAttribute("data-caring-contact-capture"));
  }

  test("capture the complete major-page atlas", async ({ page }) => {
    test.skip(!captureMajorPages, "Set CARING_CONTACT_CAPTURE_MAJOR_PAGES=1 to refresh the product atlas.");
    test.setTimeout(300_000);
    rmSync(captureDirectory, { recursive: true, force: true });
    mkdirSync(captureDirectory, { recursive: true });

    for (const [device, width, height] of [
      ["phone", 390, 844],
      ["desktop", 1440, 1000],
    ] as const) {
      await page.setViewportSize({ width, height });
      await gotoMockup(page);
      await page.addStyleTag({
        content:
          'html[data-caring-contact-capture="true"] nav[aria-label="Phone workspace"] { display: none !important; }',
      });
      await captureSurface(page, `${device}-01-today.png`);

      await chooseDestination(page, "Patients");
      await captureSurface(page, `${device}-02-patients.png`);
      await page.getByRole("button", { name: "Continue referral", exact: true }).click();
      await captureSurface(page, `${device}-03-patient-agreement.png`);
      await continueWorkflow(page, "Continue to pathway selection", "Pathway selection");
      await captureSurface(page, `${device}-04-pathway-selection.png`);
      await continueWorkflow(page, "Continue to personalisation", "Personalisation");
      await captureSurface(page, `${device}-05-personalisation.png`);
      await continueWorkflow(page, "Continue to review and activation", "Review and activation");
      await captureSurface(page, `${device}-06-review-activation.png`);
      await page.getByRole("button", { name: "Activate 10-contact plan" }).click();
      await page
        .getByRole("dialog", { name: "Final activation assurance" })
        .getByRole("button", { name: "Confirm activation review" })
        .click();
      await captureSurface(page, `${device}-07-patient-overview.png`);
      await page.getByRole("button", { name: "View active plan" }).click();
      await captureSurface(page, `${device}-08-plan-contact-detail.png`);

      await chooseDestination(page, "Schedule");
      await captureSurface(page, `${device}-09-schedule.png`);
      await page.getByRole("button", { name: /Sam Wilson.*Transport status unavailable/ }).click();
      await captureSurface(
        page,
        `${device}-10-delivery-exception.png`,
        page.getByRole("dialog", { name: "Permanent delivery exception" }),
      );
      await page.keyboard.press("Escape");

      await chooseSupportingDestination(page, "Templates");
      await captureSurface(page, `${device}-11-templates.png`);
      await chooseSupportingDestination(page, "Team");
      await captureSurface(page, `${device}-12-team.png`);
      await chooseSupportingDestination(page, "Guidance");
      await captureSurface(page, `${device}-13-guidance.png`);
      await chooseSupportingDestination(page, "Reports");
      await captureSurface(page, `${device}-14-reports.png`);
    }

    expect(readdirSync(captureDirectory).filter((name) => name.endsWith(".png"))).toHaveLength(28);
  });
});
