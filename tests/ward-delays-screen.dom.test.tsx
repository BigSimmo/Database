import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { isOpen, stageCopy } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { BLOCKERS_MEANING_NOTHING_IS_BLOCKING } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { edById, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * MERGE 01 — the priority queue, the exceptions inbox and the escalation board become one screen
 * answering one question: why is this person still waiting?
 *
 * ⚠️ The counts below are DERIVED from the fixture rather than written in. A hand-written total is
 * the thing that goes stale the day the fixture changes, and it goes stale by passing.
 */
const OPEN_COUNT = wardMovements.filter(isOpen).length;

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DelaysScreen />
    </WardFlowProvider>,
  );
}

describe("the Delays screen", () => {
  /*
   * 🔴 **CARRIED ACROSS FROM `ward-pull-vocabulary.dom.test.tsx` ON 2026-09-05, BECAUSE MERGE 01
   * MOVED THE SCREEN THIS CLINICAL RULE GUARDS AND LEFT THE GUARD BEHIND.**
   *
   * That file pins "a lapsed bed reservation is called a **pull**, never a **hold**" against
   * `<WardModeWorkspace mode="exceptions" />`. MERGE 01 folded the exceptions inbox into this
   * screen and turned `/mockups/ward-flow/exceptions` into a redirect — so the pin still runs,
   * still passes, and **now stands over a surface no coordinator can reach.**
   *
   * ⚠️ **THE HOLE WAS REAL AND THIS CLOSES IT.** Measured before writing this: the live string
   * `"Bed pull expired"` reaches this screen from `ORDER` in `delays-derivations.ts`, and NOTHING
   * in this file asserted anything about pull-or-hold wording. Changing the live label to "Bed hold
   * expired" would have left every test in the repository green while the screen a coordinator
   * actually reads broke the vocabulary rule. **The word was correct here by inheritance, not by
   * guard** — which is the state that looks identical to being protected right up until it isn't.
   *
   * ⚠️ **DELIBERATELY NOT A BLANKET BAN ON THE WORD "hold".** The same catalogue entry carries the
   * note *"the hold lapsed before the bed was used"*, which is honest copy about a BED reservation
   * rather than about detaining a person. A repository-wide ban would go red on it, and the
   * dishonest repair would then be to weaken this guard. **Whether that note should also say "pull"
   * is a vocabulary question for the owner, recorded in the handover rather than decided here.**
   */
  it("calls a lapsed bed reservation a pull, never a hold — the rule ward-pull-vocabulary pins against the screen this one replaced", () => {
    renderScreen();
    const text = document.body.textContent ?? "";

    /*
     * The positive claim is also the anti-vacuity floor: if the fixture stops producing a lapsed
     * pull, this goes red rather than letting the negative pin below pass over an absent group.
     */
    expect(
      text,
      "the Delays screen renders no lapsed-bed-pull group at all, so the vocabulary pin below has " +
        "nothing to stand over. Re-seed the fixture or retire this pair — do not leave it passing.",
    ).toContain("Bed pull expired");

    expect(text, "a lapsed bed reservation is called a hold; the ward vocabulary rule is pull").not.toContain(
      "Bed hold expired",
    );
  });

  it("has a waiting population to render, or every assertion below is vacuous", () => {
    expect(OPEN_COUNT).toBeGreaterThan(8);
  });

  it("says how many of the waiting population it is showing, and does not imply it shows them all", () => {
    renderScreen();
    // ⚠️ `\\b`, NOT `\b`. In a TEMPLATE LITERAL `\b` is the backspace character U+0008, so this
    // regex was /of 43<BACKSPACE>/ - a literal 0x08 byte where a word-boundary escape was meant -
    // and could never match anything. The honest-looking repair is to
    // weaken the assertion until it passes; the real one is the second backslash. This exact
    // substitution has bitten this repository before and it leaves every gate green.
    expect(screen.getByText(new RegExp(`of ${OPEN_COUNT}\\b`, "u"))).toBeInTheDocument();
  });

  it("carries the panels the three old screens each carried alone", () => {
    renderScreen();
    expect(screen.getByRole("region", { name: /How long/u })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Who is waiting/u })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Worth your attention/u })).toBeInTheDocument();
  });

  /**
   * ⚠️ THE WHOLE POINT OF THE MERGE. The three old screens listed the same person up to three times
   * — WF-009 stood on all three at once, as a long wait, as "five wards have declined", and as a
   * recorded escalation. Three rows, one man, one problem.
   */
  it("lists every patient at most once across every group", () => {
    renderScreen();
    const ids = Array.from(document.querySelectorAll("[data-ward-primitive='record-id']")).map(
      (node) => node.textContent ?? "",
    );
    expect(ids.length, "no rows rendered — the assertion below would be vacuous").toBeGreaterThan(0);
    expect(new Set(ids).size, `duplicated: ${ids.join(", ")}`).toBe(ids.length);
  });

  /**
   * ⚠️ **NO ELIGIBILITY RULE IS ABSOLUTE IN THIS PRODUCT.** A refusal is a decision to be recorded,
   * never a block — so wherever this screen shows one, it must also offer the override. A screen
   * that displays a refusal with no way past it has quietly turned a coordinator's judgement into
   * the software's.
   */
  /*
   * ⚠️ **UPDATED 2026-09-06, AND THE OLD VERSION WOULD HAVE PASSED ON A DEAD CONTROL.** It required
   * `getByRole("button", { name: /Override/ })` — and the button it was finding had no `onClick`, no
   * `aria-disabled` and no note. It looked live, did nothing when pressed, and this guard called
   * that "an override is offered".
   *
   * **The claim is that a refusal is never presented as a dead end. The role is not the claim.**
   * An override is not its own event — it is an `overrideReason` carried on `REFER_TO_UNITS`, raised
   * from the coordinator's shortlist panel — so on this screen the honest affordance is a route to
   * that screen, and the assertion now requires the affordance to actually GO somewhere.
   */
  it("never presents a refusal as a block — an override is offered wherever one is refused", () => {
    renderScreen();
    const refusals = screen.queryAllByText(/declined/iu);
    expect(refusals.length, "no refusal rendered — this guard proved nothing").toBeGreaterThan(0);
    for (const refusal of refusals) {
      const row = refusal.closest("[data-ward-primitive='record-row']");
      expect(row, "a refusal rendered outside a record row").not.toBeNull();
      const offer = within(row as HTMLElement).getByRole("link", { name: /Override/u });
      expect(
        offer.getAttribute("href"),
        "the override affordance leads nowhere — a control that looks actionable and is not is worse " +
          "than none, because a coordinator presses it and believes something happened",
      ).toBeTruthy();
    }
  });

  /*
   * 🔴 **A LAPSED BED PULL MUST OFFER ITS NEXT STEP — owner-approved 2026-09-06.** The exceptions
   * inbox this screen replaced offered "reconfirm or release bed pull"; this screen named the delay
   * and stopped, so a bed could stay held for somebody who may never arrive with nothing on screen
   * suggesting otherwise.
   *
   * The route is asserted, not the wording: it must lead to the ward actually holding the bed,
   * because that is where `RELEASE_PULL`'s control and the owner's four-reason picker live.
   */
  it("offers a route to release a bed pull that has expired, pointing at the ward holding the bed", () => {
    const expired = wardMovements.filter(
      (movement) =>
        isOpen(movement) &&
        movement.stage === "pulled" &&
        movement.pullExpiresAt !== undefined &&
        movement.pullExpiresAt < NOW_ANCHOR,
    );
    expect(
      expired.map((movement) => movement.id),
      "no movement has an expired bed pull in this fixture, so this guard would prove nothing",
    ).not.toEqual([]);

    renderScreen();
    for (const movement of expired) {
      const link = screen.getByTestId(`delays-release-pull-${movement.id}`);
      expect(
        link.getAttribute("href"),
        `${movement.id}'s lapsed pull links nowhere, or to a ward other than the one holding its bed`,
      ).toBe(`/mockups/ward-flow/ward/${movement.acceptedUnitId}`);
    }
  });

  /**
   * ⚠️ **AN ABSENCE IS STATED, NEVER BLANK** — rule five of the design language. An empty panel that
   * merely renders nothing reads as a bug, and on THIS screen it reads as "nothing is wrong in that
   * category", which is the same falsehood an empty group heading tells one level up.
   */
  it("states its two absences in words rather than rendering an empty panel", () => {
    renderScreen();
    const noPerson = screen.getByRole("region", { name: /Delays with no named person/u });
    expect(noPerson).toHaveTextContent(/would appear here rather than being spread across/u);

    const resolved = screen.getByRole("region", { name: /Resolved today/u });
    expect(resolved).toHaveTextContent(/kept for the rest of the day/u);
  });

  /**
   * ⚠️ **THE SCREEN MUST NOT SAY "waiting waiting", AND NOTHING ELSE HERE WOULD CATCH IT.** Every
   * other assertion on this screen checks a duration is PRESENT. `elapsedLabel` already ends in the
   * word, so composing it with a following word or a sub-label produced "7h 00m waiting waiting."
   * and a clock reading "7h 00m waiting" above a label reading "in ED". Both shipped green.
   */
  it("never doubles the word a duration already carries", () => {
    const { container } = renderScreen();
    const text = (container.textContent ?? "").replace(/\s+/gu, " ");
    expect(text, "a duration is composed with a word it already contains").not.toMatch(/waiting waiting/u);
    expect(text, "the clock carries the word its own sub-label supplies").not.toMatch(/waitingin ED/u);
  });

  /**
   * 🔴 **THE THREE FIELDS THE FOLD WOULD OTHERWISE HAVE DELETED.** `movement.escalation` carries
   * `at`, `triedUnitIds` and `contact`, and the escalation board is the ONLY surface in the app
   * that has ever rendered them — neither the priority queue nor `buildActionInbox` reads
   * `movement.escalation` at all. Folding that board in without carrying these three removes them
   * from the product while every test stays green, which is why this assertion exists at all.
   */
  it("carries all three escalation facts onto the row: when, who to, and which wards were tried", () => {
    renderScreen();
    const escalated = wardMovements.filter((movement) => isOpen(movement) && movement.escalation !== undefined);
    expect(escalated.length, "no escalated movement in the fixture — this guard proved nothing").toBeGreaterThan(0);

    for (const movement of escalated) {
      const id = screen.getByText(movement.id, { selector: "[data-ward-primitive='record-id']" });
      const row = id.closest("[data-ward-primitive='record-row']") as HTMLElement;
      const note = within(row).getByTestId("delays-escalation");

      expect(note, "the escalation time is missing").toHaveTextContent(/Escalated/u);
      expect(note, "who it was escalated to is missing").toHaveTextContent(movement.escalation?.contact ?? "");
      // Every ward tried, by NAME rather than by id — an id is not a fact a coordinator can use.
      expect(within(note).getAllByTestId("delays-tried-unit")).toHaveLength(
        movement.escalation?.triedUnitIds.length ?? 0,
      );
    }
  });

  /**
   * 🔴 AUDIT RESTORE 1. `movement.blocker` is the single most useful sentence the old priority
   * queue showed and this screen dropped entirely. It is a REQUIRED string on every movement and
   * is never actually `""` — a movement with nothing holding it up carries one of
   * `BLOCKERS_MEANING_NOTHING_IS_BLOCKING` ("No blocker", "None — in transit", …) instead, so this
   * asserts against that closed set rather than against a literal empty string, the same
   * distinction `ward-priority.ts`'s own `hasActiveBlocker` and `ward-flow-reducer.ts` both draw.
   */
  it("restores the blocker sentence onto the row, but only when something actually names an obstruction", () => {
    renderScreen();
    const openMovements = wardMovements.filter(isOpen);
    const withActiveBlocker = openMovements.filter((movement) => {
      const trimmed = movement.blocker.trim();
      return trimmed !== "" && !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === trimmed);
    });
    expect(
      withActiveBlocker.length,
      "no open movement carries an active blocker — this guard proved nothing",
    ).toBeGreaterThan(0);

    for (const movement of withActiveBlocker) {
      const id = screen.getByText(movement.id, { selector: "[data-ward-primitive='record-id']" });
      const row = id.closest("[data-ward-primitive='record-row']") as HTMLElement;
      expect(within(row).getByTestId("delays-blocker")).toHaveTextContent(movement.blocker.trim());
    }

    const withoutActiveBlocker = openMovements.filter((movement) => !withActiveBlocker.includes(movement));
    expect(
      withoutActiveBlocker.length,
      "no open movement lacks an active blocker — this half of the guard proved nothing",
    ).toBeGreaterThan(0);
    for (const movement of withoutActiveBlocker) {
      const id = screen.getByText(movement.id, { selector: "[data-ward-primitive='record-id']" });
      const row = id.closest("[data-ward-primitive='record-row']") as HTMLElement;
      expect(within(row).queryByTestId("delays-blocker")).toBeNull();
    }
  });

  /** 🔴 AUDIT RESTORE 2 and 3. Who is responsible for the delay, and the clinician's own urgency
   * tier — both on `Movement` already, both dropped by the fold, neither needing a new derivation.
   * The urgency text is the app's one shared spelling (`urgencyTierLabel`), never a bare digit or
   * an invented "P1"/"P2"/"P3" badge, so a coordinator reading this row and the referral board
   * read the same words for the same tier. */
  it("restores who owns the delay and the clinician's urgency tier onto every row", () => {
    renderScreen();
    const openMovements = wardMovements.filter(isOpen);
    expect(openMovements.length, "no open movement to walk — this guard proved nothing").toBeGreaterThan(0);

    for (const movement of openMovements) {
      const id = screen.getByText(movement.id, { selector: "[data-ward-primitive='record-id']" });
      const row = id.closest("[data-ward-primitive='record-row']") as HTMLElement;
      expect(row, `Owner missing for ${movement.id}`).toHaveTextContent(`Owner: ${movement.owner}`);
      expect(row, `urgency tier missing for ${movement.id}`).toHaveTextContent(urgencyTierLabel(movement.urgency));
    }
  });

  /** 🔴 AUDIT RESTORE 4. The movement's own stage, in the one label every other screen already uses
   * (`stageCopy`) rather than a second copy of the same mapping. */
  it("restores the movement's stage onto every row, using the existing stageCopy label", () => {
    renderScreen();
    const openMovements = wardMovements.filter(isOpen);
    expect(openMovements.length, "no open movement to walk — this guard proved nothing").toBeGreaterThan(0);

    for (const movement of openMovements) {
      const id = screen.getByText(movement.id, { selector: "[data-ward-primitive='record-id']" });
      const row = id.closest("[data-ward-primitive='record-row']") as HTMLElement;
      expect(row, `stage missing for ${movement.id}`).toHaveTextContent(stageCopy[movement.stage].label);
    }
  });

  /**
   * 🔴 AUDIT RESTORE 5. The origin department's NAME, resolved via the same `edById` lookup every
   * other ward surface uses — never the raw id, and an unresolved id states its own absence rather
   * than rendering a blank (the same discipline `escalation-board.tsx`'s `departmentLabel` holds
   * to for this exact lookup).
   */
  it("restores the origin department's name onto every row, by name and never by id", () => {
    renderScreen();
    const openMovements = wardMovements.filter(isOpen);
    expect(openMovements.length, "no open movement to walk — this guard proved nothing").toBeGreaterThan(0);

    for (const movement of openMovements) {
      const id = screen.getByText(movement.id, { selector: "[data-ward-primitive='record-id']" });
      const row = id.closest("[data-ward-primitive='record-row']") as HTMLElement;
      const originEd = edById(movement.originEdId);
      const expected = originEd ? originEd.name : `No department matches "${movement.originEdId}"`;
      expect(row, `origin department missing or wrong for ${movement.id}`).toHaveTextContent(expected);
    }
  });

  /**
   * 🔴 AUDIT RESTORE 6. The escalation board showed WHEN an escalation happened both ways —
   * relative ("2h ago") and absolute (`formatInstantWithDay`) — and the merge kept only the
   * relative half, which loses the moment it actually happened.
   */
  it("restores the absolute escalation time alongside the relative age", () => {
    renderScreen();
    const escalated = wardMovements.filter((movement) => isOpen(movement) && movement.escalation !== undefined);
    expect(escalated.length, "no escalated movement in the fixture — this guard proved nothing").toBeGreaterThan(0);

    for (const movement of escalated) {
      const id = screen.getByText(movement.id, { selector: "[data-ward-primitive='record-id']" });
      const row = id.closest("[data-ward-primitive='record-row']") as HTMLElement;
      const note = within(row).getByTestId("delays-escalation");
      const absolute = formatInstantWithDay(movement.escalation!.at, NOW_ANCHOR);
      expect(note, `absolute escalation time missing for ${movement.id}`).toHaveTextContent(absolute);
    }
  });

  /**
   * 🔴 AUDIT RESTORE 7 — NOT COVERABLE AGAINST THE SHARED FIXTURE, RECORDED RATHER THAN FAKED.
   *
   * "An absence is stated, never blank" (this screen's own fifth design rule) means an escalation
   * with zero tried units must say "No units recorded" instead of rendering nothing after "tried".
   * The code path exists (`delays-screen.tsx`'s `DelayRow`, mirroring `escalation-board.tsx`'s own
   * `triedUnitsLabel`), but `wardMovements` (ward-movements.ts) carries exactly one `escalation`
   * record and it has non-empty `triedUnitIds` — grepped, not assumed. `WardFlowProvider` has no
   * seam to inject a different movement list, and `ward-movements.ts` belongs to another owner in
   * this task's scope. A test asserting `escalatedNoUnitsTried.length > 0` against today's fixture
   * is not a weak assertion to strengthen; the population is genuinely zero, so the honest report is
   * "unverified", not a test manufactured to pass. Left here as a note rather than a green test that
   * would prove nothing (the same failure this file's own floor-the-population rule exists to catch).
   */
});
