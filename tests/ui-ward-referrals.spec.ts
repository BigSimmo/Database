import { expect, test, type Page } from "playwright/test";

import {
  INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE,
  OUT_OF_AREA_BANDS,
  travelBand,
} from "@/components/ward-management/ward-distance";
import { HOME_REGIONS, type UrgencyLevel } from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { allUnits, unitById } from "@/components/ward-management/ward-sites";

/**
 * Task 7 (Phase 7, "The front door"). One journey: a referral is raised from the PHONE-WIDTH
 * intake form (`/mockups/ward-flow/referrals/new`), appears on the coordinator's board
 * (`/mockups/ward-flow/referrals`), is matched against the whole network, and is accepted — and
 * the board reflects every one of those steps on the very next render, with **no `page.goto()`
 * anywhere after the first navigation**.
 *
 * The no-reload rule is the whole point, and it is the same one `ui-ward-discharges.spec.ts`
 * states for its own journey: a `goto` is a full page load that re-mounts `WardFlowProvider`
 * (mounted once in `src/app/mockups/ward-flow/layout.tsx`, above every ward route) and resets
 * every referral back to the seed fixture. Every assertion below would then pass whether or not
 * the intake form's `RECEIVE_REFERRAL` ever reached the coordinator's board at all. Because
 * "I did not call `goto`" is a claim about the test rather than about the browser, the journey
 * also plants `__wardFlowJourneySentinel` on `window` immediately after the single navigation and
 * re-checks it after each route change: a full document load clears it, so an accidentally
 * reintroduced reload fails loudly here rather than silently making the journey vacuous.
 *
 * Navigation is the app's own, never a typed URL — the board's "New referral" `<Link>`
 * (`referral-board.tsx`, the intake form's only entry point, see `WARD_NAV_INTENTIONALLY_UNLISTED`
 * in `ward-nav.ts`) on the way in, and the coordinator's own navigation rail on the way back. At
 * phone width that rail is the phone bar's "Open Ward Flow menu" button and the drawer it opens
 * (`ClinicalRail` in `ward-management-navigation.tsx`); the desktop icon rail and the expanded
 * sidebar panel are both still in the DOM at 375px, CSS-hidden, which is why every rail assertion
 * below is scoped to the open drawer's `role="dialog"` rather than to the page.
 *
 * Phone width throughout, deliberately (spec D12): a police or ambulance officer raising a
 * referral is standing in someone's living room, not sitting at a desk. At 375px the board's two
 * sections render their card lists and hide their tables (`referrals.module.css`'s
 * `@media (max-width: 40rem)` swap), so this journey drives the CARD controls — the ones a phone
 * user can actually touch — never the table rows, which are `display: none` here.
 */

/** The referral this journey raises. Adult / Male, needing neither a secure bed nor one that can
 *  hold someone involuntarily, at the most urgent tier. Chosen so the two dimensions that decide
 *  the outcome below are the interesting ones — sex designation and forensic — rather than
 *  security or legal status, which would exclude most of the network before those were reached. */
const RAISED = {
  ageBand: "Adult",
  sex: "Male",
  homeRegion: "Perth Metropolitan",
  source: "police",
  urgency: "1",
} as const;

/** Phase 8: the four travel bands plus the not-recorded group. Written out here rather than
 *  derived, for the same reason `tests/ward-travel-grouping.test.ts` writes its own copy out: a
 *  count derived from `TRAVEL_BANDS` moves with it and could not fail, so adding or removing a
 *  band stays a decision somebody takes in a test. It counts groups on a screen. */
const BAND_GROUP_COUNT = 5;

/** The unit this journey accepts at: the first unit in the site table's own order, and the order
 *  the match view lists every unit in (D10 — it never sorts, ranks or truncates). */
const ACCEPT_UNIT_ID = "rph-adult-secure";
const ACCEPT_UNIT_NAME = "RPH Adult Secure";

/** Three units that must NOT accept this referral, one per reason, named individually so a rule
 *  that quietly stopped excluding anything cannot pass this journey. */
const FORENSIC_UNIT_ID = "brm-adult-secure";
const FORENSIC_UNIT_NAME = "Broome Adult Secure";
const FEMALE_ONLY_UNIT_ID = "ger-adult-open";
const FEMALE_ONLY_UNIT_NAME = "Geraldton Adult Open";
const WRONG_AGE_UNIT_ID = "rph-older-adult";

/** The seed's own queued/decided split (`referrals` in `ward-movements.ts`): RF-001 and RF-005 are
 *  queued; RF-002, RF-003, RF-004, RF-006, RF-007 and RF-008 are decided. RF-008 is Phase 8
 *  Task 2's added accepted-and-arrived seed — see that fixture's own doc comment. */
const SEEDED_QUEUED = 2;
const SEEDED_DECIDED = 6;

/** Every unit in the network, and how many of them accept the referral raised above. Both are
 *  hardcoded rather than recomputed from `referralEligibility`: re-deriving the expected number
 *  with the very function under test would make this assertion true by construction whatever the
 *  matching rules did. The fixture assumptions guarded at the top of the test are what keep a
 *  hardcoded number honest — if the network changes, this fails at the assumption, by name. */
const NETWORK_UNITS = 23;
const ACCEPTING_UNITS = 13;

/** The seeded queued ids, so a referral this spec raises can be told apart from them without
 *  depending on how the reducer mints an id. */
const SEEDED_QUEUED_IDS = new Set(["RF-001", "RF-005"]);

/**
 * Phase 8, Task 10. A (home region, unit) pair the synthetic table puts OUT OF AREA, searched out
 * of the fixture rather than named.
 *
 * Naming one would be a test asserting that a particular real hospital is a particular distance
 * from a particular real region — the exact thing D8-8 rule 2 forbids, because every value in
 * `SYNTHETIC_TRAVEL_BANDS` is an invented placeholder chosen mechanically by list position and the
 * owner must be able to replace them without a test going red. Searching means this either keeps
 * working across that replacement or fails loudly, by name, at the assertion in the journey.
 *
 * Forensic beds, sex-designated beds and wards with nothing allocatable are skipped, because each
 * would decline the referral for a reason that has nothing to do with distance. Everything past
 * that is read off the SCREEN rather than predicted here: the journey takes whichever accept
 * control the far group actually offers and names the unit from that control's own label, so the
 * matching rules under test are never used to compute the expectation they are being checked
 * against. All this search fixes is which home region and age band get typed into the form.
 */
const FAR_PLACEMENT = (() => {
  for (const homeRegion of HOME_REGIONS) {
    for (const unit of allUnits()) {
      const band = travelBand(homeRegion, unit.siteCode);
      if (!band || !OUT_OF_AREA_BANDS.includes(band)) continue;
      if (unit.forensic || unit.sexDesignation !== "Undesignated") continue;
      if (unit.allocatable.value <= 0) continue;
      return { homeRegion, unit, band };
    }
  }
  return undefined;
})();

const SENTINEL = "ward-flow-task-7-journey";

async function plantSentinel(page: Page) {
  await page.evaluate((value) => {
    (window as unknown as Record<string, string>).__wardFlowJourneySentinel = value;
  }, SENTINEL);
}

/**
 * Proves the last route change was a client-side navigation rather than a document load. A
 * `page.goto()`, a `location.assign`, a native form submit or any other full load discards the
 * `window` this was planted on, and with it every referral the reducer is holding.
 */
async function expectNoReloadSince(page: Page, step: string) {
  const survived = await page.evaluate(
    () => (window as unknown as Record<string, string | undefined>).__wardFlowJourneySentinel,
  );
  expect(survived, `the page reloaded during "${step}" — the reducer's referrals were reset`).toBe(SENTINEL);
}

/** The board's queued card list, in the order the board renders it (`referralQueueOrder`). */
function queuedCardIds(page: Page): Promise<string[]> {
  return page
    .getByTestId("ward-referral-board-queued-cards")
    .locator("button[data-testid^='ward-referral-board-card-select-']")
    .evaluateAll((buttons) =>
      buttons.map((button) =>
        (button.getAttribute("data-testid") ?? "").replace("ward-referral-board-card-select-", ""),
      ),
    );
}

/** Back to the board through the coordinator's own rail, as a phone user reaches it: the phone
 *  bar's menu button, then the drawer's "Referral board" link. Scoped to the open dialog because
 *  the CSS-hidden desktop rail and sidebar carry that destination too. */
async function goToBoardViaPhoneRail(page: Page) {
  await page.getByRole("button", { name: "Open Ward Flow menu" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Referral board", exact: true }).click();
  await expect(page.getByTestId("ward-referral-board-screen")).toBeVisible({ timeout: 15_000 });
}

test.describe("@mockup Ward referrals — the front door, phone to board to accepted", () => {
  test.describe.configure({ timeout: 60_000 });

  test("a referral raised on the phone-width intake form reaches the coordinator's board, matches against the network, and is accepted — with the board reflecting every step without a reload", async ({
    page,
  }) => {
    // D12: the intake form is designed for a phone and adapted upward. The whole journey runs at
    // phone width, including the coordinator's half — the board must be usable there too.
    await page.setViewportSize({ width: 375, height: 812 });

    // Fixture assumptions, checked against the real data rather than assumed, so a fixture change
    // fails here by name instead of several steps later against a confusing downstream number.
    expect(allUnits(), "fixture assumption: the synthetic network holds 23 units").toHaveLength(NETWORK_UNITS);
    const acceptUnit = unitById(ACCEPT_UNIT_ID);
    expect(acceptUnit?.cohort, `fixture assumption: ${ACCEPT_UNIT_NAME} is an Adult unit`).toBe("Adult");
    expect(acceptUnit?.sexDesignation, `fixture assumption: ${ACCEPT_UNIT_NAME} is undesignated`).toBe("Undesignated");
    expect(acceptUnit?.forensic, `fixture assumption: ${ACCEPT_UNIT_NAME} is not a forensic bed`).toBe(false);
    expect(unitById(FORENSIC_UNIT_ID)?.forensic, `fixture assumption: ${FORENSIC_UNIT_NAME} is forensic`).toBe(true);
    expect(
      unitById(FEMALE_ONLY_UNIT_ID)?.sexDesignation,
      `fixture assumption: ${FEMALE_ONLY_UNIT_NAME} is female only`,
    ).toBe("Female only");

    // --- The one and only navigation in this journey. ---
    //
    // The ward layout's `DeveloperAreaGate` is an async Server Component, so Next streams this
    // subtree: the server sends the whole screen inside a staging container `<div hidden id="S:0">`
    // and the client swaps it into the Suspense boundary afterwards. React 19 defers that reveal
    // (`$RC` schedules `$RV` on a frame/timer), so the swap outlives BOTH `load` and `networkidle`
    // — measured here, not assumed: this spec's first two runs failed at `domcontentloaded` and
    // then again after `networkidle`, each time on a strict-mode violation, because the board's
    // testid genuinely resolved to two elements while the staging copy was still in the document.
    //
    // Waiting for that container to go is therefore the correct wait, and it is asserted rather
    // than slept on. Relaxing every locator below to `.first()`/`.last()` would have made the
    // journey pass, and would have left it silently asserting against whichever copy came first —
    // possibly the inert server-rendered one, which no click ever reaches.
    await page.goto("/mockups/ward-flow/referrals", { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await expect(
      page.locator('div[hidden][id^="S:"]'),
      "React's streamed content is still staged, so the whole screen is duplicated in the document",
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("ward-referral-board-screen")).toBeVisible({ timeout: 15_000 });
    await plantSentinel(page);

    // The seed, before anything is raised. Asserted so the counts below are a real change rather
    // than a number that happened to be right.
    await expect(page.getByTestId("ward-referral-board-queued")).toContainText(`Queued (${SEEDED_QUEUED})`);
    await expect(page.getByTestId("ward-referral-board-decided")).toContainText(`Recently decided (${SEEDED_DECIDED})`);
    const queuedBefore = await queuedCardIds(page);
    expect(queuedBefore).toHaveLength(SEEDED_QUEUED);

    // --- Step 1: into the intake form, through the board's own "New referral" <Link>. ---
    await page.getByTestId("ward-referral-board-new").click();
    await expect(page.getByTestId("ward-referral-intake-screen")).toBeVisible({ timeout: 15_000 });
    await expectNoReloadSince(page, "board -> intake form");

    // --- Step 2: raise the referral. Every control is a picker or a toggle; there is no free-text
    // input on this screen and there must never be one (binding constraint: no free text
    // anywhere, and no fact about the person beyond the permitted few). ---
    await page.getByTestId("ward-referral-intake-ageBand").selectOption(RAISED.ageBand);
    await page.getByTestId("ward-referral-intake-sex").selectOption(RAISED.sex);
    await page.getByTestId("ward-referral-intake-homeRegion").selectOption(RAISED.homeRegion);
    await page.getByTestId("ward-referral-intake-source").selectOption(RAISED.source);
    await page.getByTestId("ward-referral-intake-urgency").selectOption(RAISED.urgency);
    await page.getByTestId("ward-referral-intake-transportNeeded").check();

    await page.getByTestId("ward-referral-intake-submit").click();
    await expect(page.getByTestId("ward-referral-intake-confirmation")).toBeVisible();
    // A refusal renders its own `role="alert"` instead (`ward-referral-intake-rejection`). The
    // confirmation and the rejection are separate elements, so asserting only the first would
    // pass on a screen showing both.
    await expect(page.getByTestId("ward-referral-intake-rejection")).toHaveCount(0);
    await expectNoReloadSince(page, "submitting the intake form");

    // --- Step 3: back to the board through the rail, and the referral is there. ---
    await goToBoardViaPhoneRail(page);
    await expectNoReloadSince(page, "intake form -> board via the phone rail");

    await expect(page.getByTestId("ward-referral-board-queued")).toContainText(`Queued (${SEEDED_QUEUED + 1})`);
    const queuedAfter = await queuedCardIds(page);
    expect(queuedAfter).toHaveLength(SEEDED_QUEUED + 1);

    // Identified by set difference, never by a hardcoded id or `.first()`/`.last()` — the same
    // discipline `ui-ward-roles.spec.ts` (ruling R24) holds every journey in this prototype to.
    const seen = new Set(queuedBefore);
    const raisedIds = queuedAfter.filter((id) => !seen.has(id));
    expect(raisedIds, "exactly one new referral must appear on the board").toHaveLength(1);
    const referralId = raisedIds[0];

    // The queue ranks by urgency tier first (`referralQueueOrder`), and this referral was raised
    // at the most urgent tier while both seeded queued referrals sit at tier 2 — so it leads the
    // queue. Ordering, not merely membership: a board that appended it at the bottom would still
    // "contain" it.
    expect(queuedAfter[0], "the most urgent referral leads the queue").toBe(referralId);

    const raisedCard = page.getByTestId(`ward-referral-board-card-select-${referralId}`);
    await expect(raisedCard).toContainText("Tier 1");
    await expect(raisedCard).toContainText(`${RAISED.ageBand} · ${RAISED.sex} · ${RAISED.homeRegion}`);
    // Length of wait is rendered on the card in its own right (D11) — the queue ranks by urgency,
    // but the wait is what carries the moral weight, so it is never left implicit.
    await expect(page.getByTestId(`ward-referral-board-card-wait-${referralId}`)).toContainText("waiting");

    // --- Step 4: match it against the network. ---
    await raisedCard.click();
    const matchPanel = page.getByTestId("ward-referral-match-panel");
    await expect(matchPanel).toBeVisible();
    // Review finding I1 / Task 8 finding B: the tier is its OWN element here, and the summary
    // line carries no tier at all. `toHaveText` is exact both times, so a component that put the
    // tier back inside the dot-separated run — the shape that printed a bare "Tier 2" directly
    // beneath the board's "Tier 2 · urgent" — fails on the summary assertion rather than passing
    // unnoticed. The tier text is `urgencyTierLabel`'s own output, never a second spelling of it
    // written out here.
    await expect(page.getByTestId("ward-referral-match-summary")).toHaveText(
      `${RAISED.ageBand} · ${RAISED.sex} · ${RAISED.homeRegion}`,
    );
    await expect(page.getByTestId("ward-referral-match-tier")).toHaveText(
      // `RAISED.urgency` is the `<select>` OPTION VALUE the form is driven with, so it is the
      // string "1"; `urgencyTierLabel` takes the tier itself.
      urgencyTierLabel(Number(RAISED.urgency) as UrgencyLevel),
    );
    await expect(page.getByTestId("ward-referral-match-accepting-count")).toHaveText(
      `${ACCEPTING_UNITS} of ${NETWORK_UNITS} units accept this referral right now.`,
    );
    // Every unit in the network is listed, never a shortlist (D10). Phase 8 groups those rows by
    // travel band, so they are spread across five `<details>` groups rather than one flat list —
    // the count is unchanged, which is the property this line has always pinned.
    await expect(page.getByTestId("ward-referral-match-list").locator("li")).toHaveCount(NETWORK_UNITS);

    // Phase 8, Task 4 (owner decision, 2026-08-29): the band groups are SHUT by default at phone
    // width, and this journey is phone width throughout. Nothing is hidden by that — every heading
    // and both of its counts are on the screen while shut, asserted here before anything is opened,
    // so "there is nothing available within an hour" is answerable without expanding a thing.
    const bandGroups = page.getByTestId("ward-referral-match-list").locator("details");
    await expect(bandGroups).toHaveCount(BAND_GROUP_COUNT);
    let unitsAcrossBands = 0;
    for (let index = 0; index < BAND_GROUP_COUNT; index += 1) {
      const summary = bandGroups.nth(index).locator("summary");
      await expect(summary).toBeVisible();
      // Scoped to the SUMMARY and reading its TEXT, both deliberately. A closed `<details>` paints
      // only its summary, so counts rendered one line below it would still be in the DOM, still
      // pass a document-wide query, and still leave a coordinator on a phone looking at five bare
      // bars. Asserting the box is visible does not catch that; asserting the numbers are inside
      // that box does.
      await expect(summary).toContainText(/[0-9]+ units? in this band/);
      await expect(summary).toContainText(/[0-9]+ accepts? this referral/);
      // A heading states composition, never operational temporality — "right now" belongs to the
      // accepting-count line above and must never migrate into a band heading.
      await expect(summary).not.toContainText(/right now/i);
      const text = (await summary.textContent()) ?? "";
      const units = Number(/([0-9]+) units? in this band/.exec(text)?.[1]);
      expect(Number.isNaN(units), `band heading ${index} states no unit count: ${text}`).toBe(false);
      unitsAcrossBands += units;
    }
    // The five shut headings between them account for the whole network, so nothing is hidden by
    // the fold: every bed is answered for before anything is opened.
    expect(unitsAcrossBands).toBe(NETWORK_UNITS);
    // The invented-travel-times sentence is on this screen, once, wherever a band is shown.
    await expect(page.getByTestId("ward-referral-match-synthetic-notice")).toBeVisible();
    // A coordinator on a phone opens the groups to reach the rows. Every group is expanded here so
    // the assertions below see the whole network exactly as they did before the grouping existed.
    for (let index = 0; index < BAND_GROUP_COUNT; index += 1) {
      await bandGroups.nth(index).locator("summary").click();
    }

    // The bed accepted below, and one unit per reason it is not offered — each named, so a rule
    // that stopped excluding anything cannot pass unnoticed.
    await expect(page.getByTestId(`ward-referral-match-accepts-${ACCEPT_UNIT_ID}`)).toBeVisible();
    // D7: a forensic bed is never offered, and the board says so plainly rather than leaving the
    // unit silently absent from the accepting list.
    await expect(page.getByTestId(`ward-referral-match-reason-${FORENSIC_UNIT_ID}`)).toHaveText(
      `${FORENSIC_UNIT_NAME} is a forensic bed and is never offered as a destination`,
    );
    // D3 rule 3: a designated bed constrains who may occupy it. This is the one dimension whose
    // failure mode is invisible in review — written as an equality it would exclude every
    // referral from the network's many UNDESIGNATED beds while still excluding this one, so the
    // accepting count above and this line have to hold together to mean anything.
    await expect(page.getByTestId(`ward-referral-match-reason-${FEMALE_ONLY_UNIT_ID}`)).toHaveText(
      `${FEMALE_ONLY_UNIT_NAME} is female only and does not accept this referral's sex`,
    );
    await expect(page.getByTestId(`ward-referral-match-reason-${WRONG_AGE_UNIT_ID}`)).toHaveText(
      "Older adult unit does not match an adult referral",
    );
    // A unit that does not accept offers no accept control at all — the refusal is not merely
    // described, it is enforced in the UI.
    await expect(page.getByTestId(`ward-referral-match-accept-${FORENSIC_UNIT_ID}`)).toHaveCount(0);

    // --- Step 5: accept it. A human decides; nothing here allocated on its own (D10). ---
    await page.getByTestId(`ward-referral-match-accept-${ACCEPT_UNIT_ID}`).click();
    await expect(page.getByTestId("ward-referral-match-rejection")).toHaveCount(0);
    await expect(page.getByTestId("ward-referral-match-decided")).toHaveText(`Accepted at ${ACCEPT_UNIT_NAME}.`);
    await expectNoReloadSince(page, "accepting the referral");

    // --- The board reflects the decision on the very next render: out of the queue, into
    // recently decided, with the outcome named. ---
    await expect(page.getByTestId("ward-referral-board-queued")).toContainText(`Queued (${SEEDED_QUEUED})`);
    await expect(page.getByTestId("ward-referral-board-decided")).toContainText(
      `Recently decided (${SEEDED_DECIDED + 1})`,
    );
    expect(await queuedCardIds(page)).not.toContain(referralId);
    const decidedCard = page.getByTestId(`ward-referral-board-decided-card-${referralId}`);
    await expect(decidedCard).toBeVisible();
    await expect(decidedCard).toContainText("Accepted");

    // D14, asserted rather than claimed (review finding M8). This comment used to say "no
    // handover is implied" above a lone `expectNoReloadSince`, which establishes nothing of the
    // sort — the structural property (ACCEPT_REFERRAL creates no `Movement`) is owned by
    // `tests/ward-referral-reducer.test.ts`, and what a BROWSER can check is what the board tells
    // the reader. So: the decided card names the unit the referral was accepted at, and the
    // board states plainly that nothing was held or moved.
    await expect(decidedCard).toContainText(ACCEPT_UNIT_NAME);
    await expect(page.getByTestId("ward-referral-board-decided-note")).toContainText("No bed is held");
    await expect(page.getByTestId("ward-referral-board-decided-note")).toContainText("no movement is created");

    await expectNoReloadSince(page, "the whole journey");
  });

  /**
   * Phase 8, Task 10. The one Chromium journey for the distance work, added to this spec rather
   * than to a new `ui-ward-*.spec.ts` file: a new ward spec has to be added by name to BOTH
   * hand-maintained alternations in `playwright.config.ts` AND to `scripts/ci-change-scope.mjs`,
   * and a spec absent from any of them silently never runs.
   *
   * WHERE THIS DEPARTS FROM THE BRIEF, and why. The brief asked for "accept at a far unit, record
   * its arrival, and see it on the out-of-area ledger". The middle and last steps are impossible
   * BY DESIGN, and asking for them predates the screens: `ACCEPT_REFERRAL` creates no `Movement`
   * and no `Admission` (the board says exactly that in its own words, asserted in the journey
   * above), and `OutOfAreaBoard` reads `wardAdmissions` — a seed no `WardFlowEvent` writes to. So
   * there is no arrival to record for a referral, and nothing done on these screens can add anyone
   * to that ledger. Rather than skip the step or fake it, this journey PINS that: the referral it
   * accepts at a far unit must NOT appear on the ledger afterwards, and the ledger must say why in
   * its own provenance sentence. An impossible step becomes a guarded property (D8-9).
   *
   * NOTHING HERE PINS A BAND TO A PLACE. D8-8 rule 2 forbids a test asserting that some named
   * hospital is three hours from some named region: every value in `SYNTHETIC_TRAVEL_BANDS` is an
   * invented placeholder, and a test pinning one would turn the owner's future correction into a
   * test failure. The far region and the far unit are therefore SEARCHED out of the fixture at
   * module scope and named nowhere. That search is SETUP, not assertion — the assertions it feeds
   * are absolute — and if the fixture ever holds no such pair this fails loudly by name instead of
   * quietly testing a near unit.
   */
  test("a referral accepted at a unit the fixture puts out of area does not reach the out-of-area ledger, which says why", async ({
    page,
  }) => {
    expect(
      FAR_PLACEMENT,
      "fixture assumption: no (home region, acceptable unit) pair in the synthetic table is out of area, so this journey cannot test a far acceptance at all",
    ).toBeDefined();
    const { homeRegion, unit, band } = FAR_PLACEMENT!;
    expect(OUT_OF_AREA_BANDS, `fixture assumption: ${band} is one of this prototype's out-of-area bands`).toContain(
      band,
    );

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/mockups/ward-flow/referrals", { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await expect(
      page.locator('div[hidden][id^="S:"]'),
      "React's streamed content is still staged, so the whole screen is duplicated in the document",
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("ward-referral-board-screen")).toBeVisible({ timeout: 15_000 });
    await plantSentinel(page);

    // Raise a referral from the far home region, through the board's own "New referral" link.
    await page.getByTestId("ward-referral-board-new").click();
    await expect(page.getByTestId("ward-referral-intake-screen")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("ward-referral-intake-ageBand").selectOption(unit.cohort);
    await page.getByTestId("ward-referral-intake-homeRegion").selectOption(homeRegion);
    await page.getByTestId("ward-referral-intake-submit").click();
    await expect(page.getByTestId("ward-referral-intake-confirmation")).toBeVisible();
    await expect(page.getByTestId("ward-referral-intake-rejection")).toHaveCount(0);

    await goToBoardViaPhoneRail(page);
    await expectNoReloadSince(page, "back to the board after raising the far referral");

    const raisedId = (await queuedCardIds(page)).find((id) => !SEEDED_QUEUED_IDS.has(id));
    expect(raisedId, "the referral raised on the intake form never reached the board").toBeDefined();
    await page.getByTestId(`ward-referral-board-card-select-${raisedId}`).click();

    // The five groups, and the sentence saying the times are invented, on the screen where the
    // acceptance is actually taken.
    await expect(page.getByTestId("ward-referral-match-list").locator("details")).toHaveCount(BAND_GROUP_COUNT);
    await expect(page.getByTestId("ward-referral-match-synthetic-notice")).toBeVisible();

    // Open the far group by CLICK, the way a coordinator does. At 375px the groups mount shut, so
    // the accept control really is behind the disclosure here rather than already on screen — which
    // is the whole reason this step is worth doing in a browser. Its counts are visible while it is
    // still shut, which jsdom cannot show, because jsdom does not hide closed disclosure content.
    const farGroup = page.getByTestId(`ward-referral-match-band-group-${band}`);
    await expect(farGroup).toHaveJSProperty("open", false);
    await expect(page.getByTestId(`ward-referral-match-band-counts-${band}`)).toBeVisible();
    await farGroup.locator("summary").click();
    await expect(farGroup).toHaveJSProperty("open", true);

    // The accept control is taken from INSIDE the far group, so "far" is a property of where the
    // button was found rather than a claim this test makes about a named hospital. The unit's name
    // then comes off that control's own label, so the acceptance message below is checked against
    // what the screen offered rather than against anything recomputed here.
    const farAccept = farGroup.locator("[data-testid^='ward-referral-match-accept-']").first();
    await expect(
      farAccept,
      `the ${band} group offers no unit that accepts this referral, so there is no far acceptance to make`,
    ).toBeVisible();
    const acceptLabel = ((await farAccept.textContent()) ?? "").trim();
    expect(acceptLabel, "the accept control's label no longer names the unit").toMatch(/^Accept at .+/);
    const acceptedUnitName = acceptLabel.replace(/^Accept at /, "");

    await farAccept.click();
    await expect(page.getByTestId("ward-referral-match-rejection")).toHaveCount(0);
    await expect(page.getByTestId("ward-referral-match-decided")).toHaveText(`Accepted at ${acceptedUnitName}.`);
    await expectNoReloadSince(page, "accepting at the far unit");

    // On to the ledger, through the coordinator's own rail rather than a typed URL.
    await page.getByRole("button", { name: "Open Ward Flow menu" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: "Out of area", exact: true }).click();
    await expect(page.getByTestId("ward-out-of-area-board")).toBeVisible({ timeout: 15_000 });
    await expectNoReloadSince(page, "navigating to the out-of-area ledger");

    // The invented-threshold sentence, WHOLE and on screen — not truncated, not behind a tooltip,
    // not a fragment. Compared against the exported constant rather than a retyped copy, so a
    // reworded notice cannot pass here by matching a stale substring.
    const threshold = page.getByTestId("ward-out-of-area-threshold-notice");
    await expect(threshold).toBeVisible();
    await expect(threshold).toHaveText(INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE);

    // D8-9, and the reason the brief's "record its arrival" step does not exist: nothing done on
    // these screens reaches this ledger, and the ledger says so in its own words.
    await expect(page.getByTestId(`ward-out-of-area-row-${raisedId}`)).toHaveCount(0);
    await expect(page.getByTestId(`ward-out-of-area-card-${raisedId}`)).toHaveCount(0);
    await expect(page.getByTestId("ward-out-of-area-provenance")).toContainText(
      "Nothing done on these screens adds anyone to this list or takes anyone off it",
    );

    /*
     * Phase 8, Task 10. The ledger's table, at the narrowest width it is ever used at.
     *
     * Found by looking, and invisible to every other check on this branch. Just above the 40rem
     * card/table swap, the table's own `min-width` was wider than the space the shell leaves it,
     * so `Since arrival` — this screen's second headline fact, and the one Task 5 reformatted from
     * an unreadable `5041h 30m` into days — sat entirely outside its `overflow-x: auto` scroller
     * with nothing on screen saying so. Measured before the fix at a 641px viewport: scroller
     * client width 499px against a table 608px wide, the last column's right edge at 715px against
     * the scroller's at 606px. Every DOM assertion passed throughout, because the cell was in the
     * document the whole time; it was simply not on the screen.
     *
     * A real browser is the only place this can be checked — jsdom has no layout, so no Vitest
     * suite here can tell a column that is off-screen from one that is not. Asserted as geometric
     * containment rather than as a stylesheet value, so it goes on holding whatever the table's
     * widths, the shell's padding or the icon rail become.
     */
    await page.setViewportSize({ width: 641, height: 900 });
    const tableScroll = page.getByTestId("ward-out-of-area-table");
    await expect(tableScroll, "the ledger is not showing its table at 641px").toBeVisible();
    const clipped = await tableScroll.evaluate((scroll) => {
      const right = scroll.getBoundingClientRect().right;
      return [...scroll.querySelectorAll("thead th, tbody tr:first-child td")]
        .filter((cell) => cell.getBoundingClientRect().right > right + 1)
        .map(
          (cell) =>
            `${(cell.textContent ?? "").trim()} (right edge ${Math.round(cell.getBoundingClientRect().right)} vs scroller ${Math.round(right)})`,
        );
    });
    expect(
      clipped,
      "column(s) of the out-of-area table are off the screen at 641px, reachable only by scrolling sideways inside the table",
    ).toEqual([]);
  });
});
