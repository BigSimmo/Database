import { expect, test, type Page } from "playwright/test";
import { clickWhenHydrated } from "./playwright-settlement";

for (const width of [390, 1280]) {
  test(`Roster maker reviewed editing and conflict recovery at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme: width === 390 ? "dark" : "light", reducedMotion: "reduce" });
    await syntheticTeam(page);
    const draftId = "5e000000-0000-4000-8000-000000000020";
    let version = 1;
    let shiftCode = "D";
    let conflict = true;
    let agreed = false;
    let published = 0;
    const proposalId = "5e000000-0000-4000-8000-000000000030";
    const commands: Record<string, unknown>[] = [];
    const snapshot = () => ({
      draft: {
        id: draftId,
        periodStart: "2026-10-01",
        periodEnd: "2026-10-02",
        basedOnPublicationId: publicationId,
        version,
      },
      assignments: [
        {
          id: "5e000000-0000-4000-8000-000000000010",
          userId: actorId,
          rosterName: "Alex Example",
          siteId: null,
          startsAt: shiftCode === "D" ? "2026-10-01T00:00:00Z" : "2026-10-01T13:30:00Z",
          endsAt: shiftCode === "D" ? "2026-10-01T08:30:00Z" : "2026-10-02T00:00:00Z",
          shiftCode,
          kind: shiftCode === "D" ? "day" : "night",
          grade: "registrar",
        },
      ],
      changes: [],
    });
    const baseRows = snapshot().assignments;
    const proposal = () => ({
      id: proposalId,
      draftId,
      draftVersion: version,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-02",
      scope: "full",
      changeId: null,
      createdAt: "2026-09-27T00:00:00Z",
      status: "pending",
      before: baseRows,
      after: snapshot().assignments,
      affected: [
        {
          userId: actorId,
          displayName: "Alex Example",
          before: baseRows,
          after: snapshot().assignments,
          agreedAt: agreed ? "2026-09-27T01:00:00Z" : null,
        },
      ],
      blockers: [],
      protectedChanges: [],
      canPublish: agreed,
    });
    const makerState = () => ({
      settingsToken: "test-token",
      needs: [],
      rules: { minBreakHours: null, maxHours7d: null, source: null, reviewedOn: null },
      proposals: [proposal()],
      reconciliation: null,
    });
    await page.route("**/api/roster/team/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/maker")) {
        if (route.request().method() !== "POST") return route.fulfill({ json: makerState() });
        const body = route.request().postDataJSON();
        if (body.action === "proposal.create") return route.fulfill({ json: { proposal: proposal() } });
        if (body.action === "proposal.publish" && agreed && body.proposalId === proposalId) {
          published++;
          return route.fulfill({
            json: {
              publicationId,
              version: 3,
              draftVersion: version,
              changedUserIds: [actorId],
              swapsCancelled: [],
              replayed: false,
            },
          });
        }
        return route.fulfill({ status: 409, json: { code: "roster_conflict" } });
      }
      if (url.pathname.endsWith("/agreements")) {
        if (route.request().method() === "POST") {
          expect(route.request().postDataJSON()).toEqual({ action: "agree", proposalId });
          agreed = true;
        }
        return route.fulfill({
          json: {
            proposals: [
              {
                ...proposal(),
                before: baseRows,
                after: snapshot().assignments,
                agreedAt: agreed ? "2026-09-27T01:00:00Z" : null,
              },
            ],
          },
        });
      }
      if (url.searchParams.get("what") === "maker")
        return route.fulfill({
          json: {
            codes: [
              { code: "D", kind: "day", starts: "08:00", ends: "16:30", label: "Day" },
              { code: "N", kind: "night", starts: "21:30", ends: "08:00", label: "Night" },
            ],
            needs: [],
            drafts: [],
          },
        });
      if (!url.pathname.endsWith("/draft")) return route.fallback();
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        commands.push(body);
        if (body.action === "draft.change") {
          if (conflict) {
            conflict = false;
            version = 2;
            return route.fulfill({ status: 409, json: { code: "roster_conflict", message: "Draft changed" } });
          }
          expect(body.expectedVersion).toBe(2);
          expect(body.ops).toHaveLength(1);
          shiftCode = body.ops[0].row.shiftCode;
          version = 3;
        }
      }
      return route.fulfill({ json: snapshot() });
    });
    await page.goto("/roster/manage");
    await clickWhenHydrated(page.getByTestId("roster-manage-section-trigger"));
    await clickWhenHydrated(page.getByRole("button", { name: "Maker", exact: true }));
    await page.getByLabel("Period starts").fill("2026-10-01");
    await page.getByLabel("Period ends").fill("2026-10-02");
    await page.getByRole("button", { name: "Open draft", exact: true }).click();
    await expect(page.getByText("Draft v1", { exact: false })).toBeVisible();
    const cell = page.getByRole("button", { name: /Edit Alex Example.*1 Oct/ });
    if (width === 1280) {
      await cell.focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("button", { name: /Edit Alex Example.*2 Oct/ })).toBeFocused();
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Enter");
    } else await cell.click();
    await page.getByLabel("Shift code", { exact: true }).selectOption("N");
    await page.getByRole("button", { name: "Review change", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Review draft change" })).toBeVisible();
    expect(commands).toHaveLength(1);
    await page.getByRole("button", { name: "Apply to draft", exact: true }).click();
    await expect(page.getByText(/Draft changed.*review/i)).toBeVisible();
    expect(commands).toHaveLength(2);
    await page.getByRole("button", { name: "Review against current draft" }).click();
    await expect(page.getByRole("dialog", { name: "Review draft change" })).toBeVisible();
    await page.getByRole("button", { name: "Apply to draft", exact: true }).click();
    await expect(page.getByText("Draft v3", { exact: false })).toBeVisible();
    expect(commands.map((command) => command.action)).toEqual(["draft.open", "draft.change", "draft.change"]);
    await page.getByRole("button", { name: "Review whole draft", exact: true }).click();
    await expect(page.getByText("Alex Example: Waiting for agreement in Requests")).toBeVisible();
    await page.getByLabel("I reviewed the before and after duties, including removals.").check();
    await expect(page.getByRole("button", { name: "Publish reviewed duties" })).toBeDisabled();
    await page.goto("/roster/requests");
    await page.getByLabel("Duty change to review").selectOption(proposalId);
    await page.getByLabel("I have reviewed and agree to these changes to my duties.").check();
    await page.getByRole("button", { name: "Record my agreement" }).click();
    await expect(page.getByText(/Your agreement is recorded/)).toBeVisible();
    expect(published).toBe(0);
    await page.goto("/roster/manage");
    await clickWhenHydrated(page.getByTestId("roster-manage-section-trigger"));
    await clickWhenHydrated(page.getByRole("button", { name: "Maker", exact: true }));
    await page.getByRole("button", { name: "Open draft", exact: true }).click();
    await page.getByRole("button", { name: "Review whole draft", exact: true }).click();
    await expect(page.getByText("Alex Example: Agreed to this review")).toBeVisible();
    await page.getByLabel("I reviewed the before and after duties, including removals.").check();
    await page.getByRole("button", { name: "Publish reviewed duties" }).click();
    await expect.poll(() => published).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`roster-maker-${width}.png`), fullPage: true });
  });
}

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
    if (url.pathname.endsWith("/agreements")) return route.fulfill({ json: { proposals: [] } });
    if (url.pathname.endsWith("/maker"))
      return route.fulfill({
        json: {
          settingsToken: "test-token",
          needs: [],
          rules: { minBreakHours: null, maxHours7d: null, source: null, reviewedOn: null },
          proposals: [],
          reconciliation: null,
        },
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
    await page.goto("/roster/team");
    await expect(page.getByText("Sam Example", { exact: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: "With me", exact: true })).toBeVisible();
    await clickWhenHydrated(page.getByRole("radio", { name: "With me", exact: true }));
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
    await expect(page.getByText("Waiting 0", { exact: true })).toBeVisible();
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
  await expect(page.getByText("Sam Example", { exact: true })).toBeVisible();
});
