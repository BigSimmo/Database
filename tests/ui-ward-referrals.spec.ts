import { expect, test, type Page } from "playwright/test";

import type { UrgencyLevel } from "@/components/ward-management/ward-model";
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
    // Every unit in the network is listed, never a shortlist (D10).
    await expect(page.getByTestId("ward-referral-match-list").locator("li")).toHaveCount(NETWORK_UNITS);

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
});
