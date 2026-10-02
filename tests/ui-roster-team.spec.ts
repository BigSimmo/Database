import { expect, test, type Page } from "playwright/test";
import { clickWhenHydrated } from "./playwright-settlement";

const teamId = "5e000000-0000-4000-8000-000000000001";
const actorId = "5e000000-0000-4000-8000-000000000002";
const peerId = "5e000000-0000-4000-8000-000000000003";
const publicationId = "5e000000-0000-4000-8000-000000000004";
async function syntheticTeam(page: Page, manager = true) {
  const date = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
  await page.clock.setFixedTime(new Date(`${date}T02:00:00Z`));
  const role = manager ? "manager" : "member";
  const overview = {
    service: { id: teamId, name: "Example team" },
    me: { role, grade: "registrar", rotationEndsOn: null },
    latestPublication: {
      id: publicationId,
      version: 2,
      publishedAt: `${date}T00:00:00Z`,
      periodStart: date,
      periodEnd: date,
    },
    seenLatest: true,
    settings: { swapApproval: "manager", rules: {}, rulesSource: null, payFortnightAnchor: null },
    sites: [],
    managers: [{ userId: actorId, name: "Alex Example" }],
  };
  const assignments = [actorId, peerId].map((userId, index) => ({
    id: `5e000000-0000-4000-8000-00000000001${index}`,
    userId,
    name: index ? "Sam Example" : "Alex Example",
    grade: "registrar",
    siteId: null,
    siteName: "Example Hospital",
    startsAt: `${date}T00:00:00Z`,
    endsAt: `${date}T09:00:00Z`,
    shiftCode: "D",
    kind: "day",
  }));
  await page.route("**/api/roster/team**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/roster/team")
      return route.fulfill({
        json: {
          actorId,
          teams: [{ serviceId: teamId, name: "Example team", enabled: true, role, grade: "registrar" }],
        },
      });
    if (url.pathname.endsWith("/publish"))
      return route.fulfill({
        status: 409,
        json: { code: "roster_publish_requires_update", message: "Publishing needs a database safety update first." },
      });
    if (request.method() === "POST") return route.fulfill({ json: { result: { ok: true } } });
    const what = url.searchParams.get("what");
    const data =
      what === "overview"
        ? overview
        : what === "assignments"
          ? { assignments }
          : what === "requests"
            ? { swaps: [], openShifts: [] }
            : what === "manage"
              ? {
                  swaps: [],
                  openShifts: [],
                  seen: { publicationId, version: 2, seen: 1, members: 2, notSeen: [peerId] },
                }
              : what === "people"
                ? {
                    people: [
                      {
                        userId: actorId,
                        displayName: "Alex Example",
                        joinedAt: `${date}T00:00:00Z`,
                        serviceRole: "admin",
                        role: "manager",
                        grade: "registrar",
                        rosterName: "Alex Example",
                        rotationEndsOn: null,
                      },
                    ],
                  }
                : what === "maker"
                  ? { codes: [], needs: [], drafts: [] }
                  : what === "unavailability"
                    ? { unavailability: [] }
                    : what === "leave_overlap"
                      ? { alreadyOff: 0 }
                      : what === "team_leave"
                        ? { leave: [] }
                        : { before: [], after: [] };
    return route.fulfill({ json: data });
  });
  await page.route("**/api/roster/leave", (route) => route.fulfill({ json: { leave: [] } }));
  await page.route("**/api/roster/alerts", (route) => route.fulfill({ json: { configured: false, publicKey: null } }));
}

for (const width of [390, 1280]) {
  test(`Roster team and manager journeys at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme: width === 390 ? "dark" : "light", reducedMotion: "reduce" });
    await syntheticTeam(page);
    await page.goto("/roster/team?view=day");
    await expect(page.getByRole("button", { name: /Sam Example/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Filter/ })).toBeVisible();
    const axis = await page.getByTestId("roster-timeline-axis").boundingBox();
    const bars = page.getByTestId("roster-timeline-bar");
    await expect(bars).toHaveCount(2);
    for (const bar of await bars.all()) {
      const bounds = await bar.boundingBox();
      expect(Math.abs(bounds!.x - axis!.x)).toBeLessThan(2);
      expect(bounds!.width).toBe(axis!.width);
      const marker = await bar.locator("line").evaluate((line) => {
        const style = getComputedStyle(line);
        return {
          height: line.getBoundingClientRect().height,
          stroke: style.stroke,
          width: style.strokeWidth,
          vector: style.vectorEffect,
        };
      });
      expect(marker.height).toBeGreaterThanOrEqual(10);
      expect(marker.stroke).not.toBe("none");
      expect(marker.width).toBe("2px");
      expect(marker.vector).toBe("non-scaling-stroke");
    }
    await clickWhenHydrated(page.getByRole("button", { name: /^Filter/ }));
    await clickWhenHydrated(page.getByRole("radio", { name: "Just me", exact: true }));
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Filter" })).toHaveCount(0);
    await expect(bars).toHaveCount(1);
    expect(
      await page
        .locator("main")
        .last()
        .evaluate((el) => el.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/roster-team-${width}.png`, fullPage: true });
    await page.goto("/roster/requests");
    await expect(page.getByRole("heading", { name: "Requests", exact: true })).toBeVisible();
    await page.goto("/roster/manage");
    await expect(page.getByTestId("roster-stat-waiting")).toHaveText(/Waiting\s*0/);
    await page.getByTestId("roster-manage-section-trigger").focus();
    await page.keyboard.press("Enter");
    await clickWhenHydrated(page.getByRole("button", { name: "Cover", exact: true }));
    await expect(page.getByRole("heading", { name: "Next two weeks" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download Excel" })).toBeVisible();
    await clickWhenHydrated(page.getByTestId("roster-manage-section-trigger"));
    await clickWhenHydrated(page.getByRole("button", { name: "Roster", exact: true }));
    await expect(page.getByRole("button", { name: "Choose file", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Team settings" })).toBeVisible();
    expect(
      await page
        .locator("main")
        .last()
        .evaluate((el) => el.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/roster-manage-${width}.png`, fullPage: true });
  });
}

test("Roster Requests keeps the phone New pill clear of the last row", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await syntheticTeam(page);
  await page.goto("/roster/requests");

  const shell = page.getByTestId("roster-requests-page");
  await expect(page.getByTestId("roster-new")).toBeVisible();
  await expect.poll(() => shell.evaluate((el) => getComputedStyle(el).paddingBottom)).toBe("80px");
});

test("Roster manager route refuses ordinary members", async ({ page }) => {
  await syntheticTeam(page, false);
  await page.goto("/roster/manage");
  await expect(page.getByText("Only your team's roster manager can see this page.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
});

test("Roster team recovers after an offline read", async ({ page }) => {
  await syntheticTeam(page);
  await page.route("**/api/roster/team", (route) => route.abort("internetdisconnected"), { times: 1 });
  await page.goto("/roster/team");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: /Sam Example/ }).first()).toBeVisible();
});
