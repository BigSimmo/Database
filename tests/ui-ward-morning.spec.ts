import { expect, test, type Page } from "playwright/test";

/**
 * MERGE 02 (owner-approved 2026-09-05,
 * `docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md` §2) folded the morning
 * bed-state board into `CapacityScreen` and turned `/mockups/ward-flow/morning` into a redirect
 * (see that route's own doc comment in `src/app/mockups/ward-flow/morning/page.tsx`). The rail's
 * "Morning bed state" entry was removed at the same time — `ward-nav.ts` records the route as
 * `WARD_NAV_INTENTIONALLY_UNLISTED`, "a deliberate redirect to /capacity, not a destination in
 * its own right" — so nothing in the running app can reach `MorningPage` any more: it is real,
 * unmounted code, not deleted code.
 *
 * ⚠️ THIS FILE COVERED THE MORNING PAGE'S OWN RENDER, RAIL RETURN AND PRINT OUTPUT, AND MOST OF
 * THAT SUBJECT IS NOW UNREACHABLE, NOT MERELY RENAMED. The redirect is a real HTTP redirect
 * (`next/navigation`'s `redirect()`), so `page.goto("/mockups/ward-flow/morning")` always lands on
 * `CapacityScreen` — there is no way for a Playwright journey to mount `MorningPage` at all any
 * more, whatever testid it looks for. Two different things happened to the two tests this file
 * used to carry, and they are recorded separately because they are not the same kind of change:
 *
 *   - The RENDER-AND-RAIL test is RETARGETED, not retired: the redirect itself, and the rail
 *     handing back to the same URL, are real current behaviour of the merged route, so this test
 *     now proves those instead of proving a headline and a link label that no longer exist.
 *   - The PRINT test is RETIRED. `CapacityScreen` carries no print media rule and no per-site
 *     print testid at all (`capacity.module.css` has none) — MERGE 02 did not carry the morning
 *     page's "printed sheet states its own instant, one A4 page" contract forward, and inventing
 *     print assertions for a screen that renders no print output would be fabricating coverage
 *     rather than describing it. `MorningPage`'s own print behaviour is still guarded at the
 *     component level by `tests/ward-morning-page.dom.test.tsx` (rendered directly, not via a
 *     route — the doc comment at the top of `morning-page.tsx` names it as still passing all 20
 *     cases) and its CSS text by `tests/ward-morning-print.test.ts`, so the underlying contract is
 *     not unguarded if the tour and the printed sheet are ever un-paused and re-routed — only the
 *     real-Chromium, real-PDF proof this browser test gave is lost, and it is recorded as a
 *     reviewed reduction in `diff-integrity.json` rather than silently dropped.
 */

async function gotoMorning(page: Page) {
  await page.goto("/mockups/ward-flow/morning", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-capacity-page")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

test.describe("@mockup Ward morning bed state — the retired route redirects, and the rail returns to it", () => {
  test.describe.configure({ timeout: 60_000 });

  // ⚠️ RENAMED 2026-09-06, following this file's own precedent from 2026-09-02: a test whose name
  // describes work it no longer does is the next reader's stale finding. This proves the redirect
  // fires and lands on the real Capacity page, then that the rail can leave and come back to the
  // same URL — the two facts that survive of "the morning page renders its headline, and the rail
  // navigates away and back" now that the headline it read is gone with the page that carried it.
  test("the retired /morning route redirects to Capacity, and the rail navigates away and back", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await gotoMorning(page);

    // The merged screen's own headline (`capacity-screen.tsx`, `<h1>Capacity</h1>`) — what
    // survives of "the page renders its headline" is that the redirect's destination actually
    // renders one, rather than landing on a blank or erroring route.
    await expect(page.getByRole("heading", { name: "Capacity", level: 1 })).toBeVisible();

    // The rail's real `<Link>`s — `ClinicalRail` is rendered by `CapacityScreen` itself, so it
    // mounts and unmounts with the page. Never `page.goto()` here: a full navigation would remount
    // `WardFlowProvider` and reseed shared state, which would make a client-side routing failure
    // indistinguishable from a pass.
    // MERGE 01 (2026-09-05): the fold at e31c9c462 combined "Priority queue" and "Exceptions"
    // into one rail entry. The id is still `queue`, but the label it renders is now "Delays" and
    // it leads to the `DelaysScreen` route, whose root carries `data-testid="ward-delays-page"` —
    // there is no more `ward-queue-view` testid anywhere for this link to land on.
    await page.getByRole("link", { name: "Delays", exact: true }).click();
    await expect(page.getByTestId("ward-delays-page")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // MERGE 02 (2026-09-05): the rail's "Morning bed state" entry is gone with the page it led
    // to. The one rail entry that returns to this merged screen is "Capacity" — the same link
    // `tests/ui-ward-discharges.spec.ts` uses to reach it from the ward side.
    await page.getByRole("link", { name: "Capacity", exact: true }).click();
    await expect(page.getByTestId("ward-capacity-page")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // The third click is not a repeat of the first. `ClinicalRail` was unmounted by the navigation
    // away and mounted fresh by the navigation back, so this exercises a newly-mounted rail after
    // a client-side return — a different condition from the first click, which was on the rail
    // that came with the server-rendered page.
    await page.getByRole("link", { name: "Delays", exact: true }).click();
    await expect(page.getByTestId("ward-delays-page")).toBeVisible({ timeout: 15_000 });
  });
});
