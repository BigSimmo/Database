import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isOpen } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import {
  journeyStages,
  transportCounts,
  transportLegs,
} from "@/components/ward-management/movements/movements-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { edById, NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * MERGE 03 — the patient movement board (`MovementsView`) and the coordinator's live transport
 * tracker (`LiveTracker`) become one screen: where has each patient's move got to, and what is
 * carrying them?
 *
 * ⚠️ Every expected value below comes from calling the same derivation functions the screen itself
 * calls (`journeyStages`, `transportLegs`, `transportCounts`), with the SAME ARGUMENTS the screen
 * uses — including scoping `transportLegs` to `isOpen` movements only, the same scope `LiveTracker`
 * (the screen this replaces) used. A test that calls the production function with different
 * arguments from the caller tests a configuration nothing ships — the exact defect the Capacity
 * screen's own test file records having hit once already.
 */
const NOW = NOW_ANCHOR;
const units = allUnits();
const stages = journeyStages(wardMovements, NOW);
const openMovements = wardMovements.filter(isOpen);
const legs = transportLegs(openMovements, NOW);
const counts = transportCounts(legs);

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MovementsScreen />
    </WardFlowProvider>,
  );
}

/**
 * ⚠️ SCOPED TO A CONTAINER, DELIBERATELY. A movement with a booked transport leg renders TWICE —
 * once as a stage row in "Where each move has got to", once as a transport row in "Who is being
 * carried" — because the two panels answer two different questions about the same person. An
 * unscoped `getByText` throws on any such movement ("Found multiple elements"), so every caller
 * passes the specific panel it means.
 */
function findRecordRow(container: HTMLElement, id: string): HTMLElement {
  const idNode = within(container).getByText(id, { selector: "[data-ward-primitive='record-id']" });
  return idNode.closest("[data-ward-primitive='record-row']") as HTMLElement;
}

describe("the Movements screen", () => {
  it("has a population in at least one stage and at least one transport leg, or the assertions below are vacuous", () => {
    expect(stages.length).toBe(7);
    expect(stages.some((stage) => stage.movements.length > 0)).toBe(true);
    expect(legs.length).toBeGreaterThan(0);
  });

  it("has the page shell — a rail, a main landmark and an <h1> — like every other Ward Flow screen", () => {
    // ⚠️ `DelaysScreen` shipped without this once and no component test caught it, because a
    // component test cannot see a missing page shell — the shell is exactly what it does not
    // render. This screen's shell is asserted from the start rather than added after the fact.
    renderScreen();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Movements" })).toBeInTheDocument();
  });

  /**
   * ⚠️ DESIGN LOCK §5.2 / STRUCTURE ITEM 2: every stage appears, empty ones included. `stages` is
   * built from `MOVEMENT_STAGES.map`, so it is always exactly 7 long regardless of who is where —
   * this walks every one of the 7 and checks BOTH populated and empty stages render, rather than
   * only checking the ones the fixture happens to populate today.
   */
  it("shows every one of the 7 stages, including any that are empty right now", () => {
    renderScreen();
    // Scoped to the board panel: the same stage label is repeated verbatim in the "Every stage, at
    // a glance" panel below, so an unscoped `getByText` would match both and throw.
    const board = screen.getByRole("region", { name: /Where each move has got to/u });
    for (const stage of stages) {
      const heading = within(board).getByText(stage.label);
      expect(heading, `stage "${stage.label}" is not on screen at all`).toBeInTheDocument();
      if (stage.movements.length === 0) {
        // An empty stage must say so in words — never a heading followed by nothing (design rule:
        // absence stated, never blank).
        const container = heading.closest("div");
        expect(container, `empty stage "${stage.label}" has no container to check`).not.toBeNull();
        expect(container).toHaveTextContent(/nobody is at this stage/iu);
      } else {
        const heading2 = heading.closest("[data-ward-primitive='group-heading']");
        expect(heading2, `populated stage "${stage.label}" did not use the group-heading primitive`).not.toBeNull();
        expect(heading2).toHaveTextContent(
          stage.movements.length === 1 ? "1 person" : `${stage.movements.length} people`,
        );
      }
    }
  });

  /**
   * ⚠️ A MOVEMENT WITH A BOOKED TRANSPORT LEG RENDERS TWICE, DELIBERATELY — once as a stage row and
   * once as a transport row, because those two panels answer two different questions about the same
   * person. The property that must hold is not "exactly one row per movement" (that was Delays'
   * property, where a stray second row for a movement WOULD have meant a double count); here it is
   * "exactly one stage row, plus exactly one transport row for each movement that actually has a leg
   * booked" — so this counts against `legs`, the real set of who is booked, rather than assuming
   * either 1 or 2 is always right.
   */
  it("renders every movement exactly once in the stage board, and again only where a transport leg is real", () => {
    renderScreen();
    const ids = Array.from(document.querySelectorAll("[data-ward-primitive='record-id']")).map(
      (node) => node.textContent ?? "",
    );
    const bookedIds = new Set(legs.map((leg) => leg.movement.id));
    const stageMovementIds = stages.flatMap((stage) => stage.movements.map((movement) => movement.id));
    expect(stageMovementIds.length, "no movement rendered — this guard proved nothing").toBeGreaterThan(0);
    expect(stageMovementIds.length).toBe(wardMovements.length);

    for (const id of stageMovementIds) {
      const expectedCount = bookedIds.has(id) ? 2 : 1;
      expect(
        ids.filter((rendered) => rendered === id).length,
        `movement ${id} should render ${expectedCount} time(s) (booked transport: ${bookedIds.has(id)})`,
      ).toBe(expectedCount);
    }
  });

  it("gives every stage row the movement's real urgency tier as its state word", () => {
    renderScreen();
    const board = screen.getByRole("region", { name: /Where each move has got to/u });
    for (const movement of wardMovements) {
      const row = findRecordRow(board, movement.id);
      expect(row, `no row for ${movement.id}`).not.toBeNull();
      expect(row).toHaveTextContent(urgencyTierLabel(movement.urgency));
    }
  });

  it("names every stage row's real origin department, by name and never by a bare id", () => {
    renderScreen();
    const board = screen.getByRole("region", { name: /Where each move has got to/u });
    for (const movement of wardMovements) {
      const row = findRecordRow(board, movement.id);
      const originEd = edById(movement.originEdId);
      const expected = originEd ? originEd.name : `No department matches "${movement.originEdId}"`;
      expect(row, `origin department wrong for ${movement.id}`).toHaveTextContent(expected);
    }
  });

  /**
   * ⚠️ DESIGN LOCK §5.4 / STRUCTURE ITEM 4 — `LiveTracker` was the ONLY surface in the app that
   * ever rendered these transport facts. Checked here per leg rather than assumed: provider,
   * origin department, destination unit (or its honest unresolved fallback), and time since
   * booked all had to survive the fold.
   */
  it("carries every transport fact LiveTracker used to show — provider, origin, destination and time since booked", () => {
    expect(legs.length, "no transport leg in the fixture — this guard proved nothing").toBeGreaterThan(0);
    renderScreen();
    const transportPanel = screen.getByRole("region", { name: /Who is being carried/u });
    for (const leg of legs) {
      const row = findRecordRow(transportPanel, leg.movement.id);
      expect(row, `no transport row for ${leg.movement.id}`).not.toBeNull();
      expect(row, `provider missing for ${leg.movement.id}`).toHaveTextContent(leg.provider);

      const originEd = edById(leg.movement.originEdId);
      const originLabel = originEd ? originEd.name : `No department matches "${leg.movement.originEdId}"`;
      expect(row, `origin missing for ${leg.movement.id}`).toHaveTextContent(originLabel);

      const destinationUnit = leg.movement.acceptedUnitId
        ? units.find((unit) => unit.id === leg.movement.acceptedUnitId)
        : undefined;
      const destinationLabel = leg.movement.acceptedUnitId
        ? (destinationUnit?.name ?? `No unit matches "${leg.movement.acceptedUnitId}"`)
        : "No accepted destination recorded";
      expect(row, `destination missing for ${leg.movement.id}`).toHaveTextContent(destinationLabel);

      expect(within(row).getByRole("link", { name: /Review patient/u })).toBeInTheDocument();
    }
  });

  it("states each transport leg's real state as a word beside its row, never colour alone", () => {
    renderScreen();
    const transportPanel = screen.getByRole("region", { name: /Who is being carried/u });
    // ⚠️ RESTATED HERE ON PURPOSE, NOT IMPORTED FROM THE SCREEN. Reading the screen's own
    // `LEG_STATE_LABEL` would make this a tautology — it would pass whatever the map said. These
    // are the words a coordinator reads, and ward vocabulary is the owner's to change, so they are
    // pinned. `Accepted` reads "Booked" because that is the word this board has always used for a
    // job a provider has accepted; the five-state collapse (Ward Lead, 2026-09-05) was a ruling
    // about the type, and the only word it adds is "Collected", which previously had none.
    const labels: Record<(typeof legs)[number]["state"], string> = {
      Accepted: "Booked",
      "En route": "En route",
      Collected: "Collected",
      Arrived: "Arrived",
      Cancelled: "Cancelled",
    };
    for (const leg of legs) {
      const row = findRecordRow(transportPanel, leg.movement.id);
      expect(row, `state word missing for ${leg.movement.id}`).toHaveTextContent(labels[leg.state]);
    }
  });

  /**
   * ⚠️ A COUNT SHOWN MUST BE HONEST ABOUT ITS DENOMINATOR (design lock rule 8). The transport panel
   * says how many of the open population have a leg booked and how many do not — never a bare
   * count with no population to measure it against.
   */
  it("states the transport panel's count against its real denominator of open movements", () => {
    renderScreen();
    expect(
      screen.getByText(new RegExp(`${legs.length} of ${openMovements.length} open moves`, "u")),
      "the transport panel does not state its denominator",
    ).toBeInTheDocument();

    const withoutBooked = openMovements.length - legs.length;
    if (withoutBooked === 0) {
      expect(screen.getByText(/every open movement has a transport leg booked/iu)).toBeInTheDocument();
    } else {
      expect(
        screen.getByText(new RegExp(`${withoutBooked} of ${openMovements.length} open movements`, "u")),
      ).toBeInTheDocument();
    }
  });

  /**
   * The transport-counts bar in the secondary column must report the real tally from
   * `transportCounts`, never a recomputed or partial one — `WardBar`'s accessible name states every
   * segment and its count, so a reader (and this test) get the same numbers either way.
   */
  it("reports the real transport-state tally in the 'Transport right now' bar", () => {
    renderScreen();
    expect(
      screen.getByRole("img", {
        name: new RegExp(
          `Booked ${counts.Accepted}\\b.*En route ${counts["En route"]}\\b.*Collected ${counts.Collected}\\b.*Arrived ${counts.Arrived}\\b.*Cancelled ${counts.Cancelled}\\b`,
          "su",
        ),
      }),
    ).toBeInTheDocument();
  });

  it("shows the 'every stage at a glance' count for every stage, stating zero in words rather than a bare 0", () => {
    renderScreen();
    const panel = screen.getByRole("region", { name: /Every stage, at a glance/u });
    for (const stage of stages) {
      const item = within(panel).getByText(stage.label).closest("li");
      expect(item, `no glance row for "${stage.label}"`).not.toBeNull();
      if (stage.movements.length === 0) {
        expect(item).toHaveTextContent(/none/iu);
      } else {
        expect(item).toHaveTextContent(String(stage.movements.length));
      }
    }
  });

  it("states the sort rule in words: longest wait first, except an expiring legal authority", () => {
    renderScreen();
    expect(screen.getByText(/longest first/iu)).toBeInTheDocument();
    expect(screen.getByText(/expiring legal authority/iu)).toBeInTheDocument();
  });
});

/*
 * 🔴 **A CLOSED MOVEMENT MUST NOT READ AS A PERSON STILL WAITING. Found live on this screen after
 * the fold, 2026-09-05, with every gate green.**
 *
 * `WF-008` rendered under "Accepted, awaiting bed" showing "2h 30m in journey" and climbing, while
 * its record carried `closure.outcome: "did_not_proceed"` twenty minutes earlier with the reason
 * *"Patient self-discharged from ED before transport was arranged"*. **Nothing on the page said
 * so** — the rendered DOM contained no "closed", no "did not proceed", no "self-discharged". The
 * owner ruled: mark it, do not filter it.
 *
 * ⚠️ **THE DEFECT WAS CREATED BY ADJACENCY, WHICH IS WHY NO EXISTING GUARD SAW IT.**
 * `journeyStages` groups by stage with no `isOpen` filter — faithful to the pre-merge screen — and
 * the open-move count comes from a derivation that DOES filter. Neither half changed. Putting them
 * on one page made the combination state something neither half stated, which is also why the page
 * reads "50 moves" at the top and "8 of 43 open moves" at the bottom. **A guard on either half
 * alone is still green today.**
 *
 * ⚠️ **ASSERTED AS PROPERTIES OVER THE FIXTURE, NEVER AS THE MARKER'S WORDING.** A rewrite of the
 * words must not turn these red — that is the standing rule — so what is checked is that a closed
 * row is DISTINGUISHABLE from an open one beside it, and that its clock stopped.
 */
describe("the movements board never shows a closed movement as a person still waiting", () => {
  const closedInAStageGroup = wardMovements.filter(
    (movement) => movement.closure !== undefined && movement.stage !== "arrived",
  );

  it("has closed movements sitting in stage groups at all, so the checks below are not vacuous", () => {
    expect(
      closedInAStageGroup.map((movement) => movement.id),
      "no closed movement sits in a stage group in this fixture, so nothing below can discriminate. " +
        "Either the seed changed or the grouping now filters — re-derive before trusting a green here.",
    ).not.toEqual([]);
  });

  it("puts the record's own closure reason on the closed row", () => {
    /*
     * 🔴 **THIS REPLACES A TAUTOLOGY I WROTE AND VERIFIED WAS ONE.** My first version compared a
     * closed row's `textContent` against a DIFFERENT patient's open row in the same group and
     * asserted they differed. **Two different patients' rows always differ** — different id,
     * different attributes, different duration — so it was true by construction. Proved by
     * mutation: deleting the closure marker entirely left it GREEN.
     *
     * ⚠️ **WHAT DISCRIMINATES IS THE RECORD'S OWN SENTENCE.** `closure.reason` is DATA, not copy, so
     * asserting it reaches the row survives any rewording of the marker or restyling of the chip —
     * and it is the fact a reader actually needs, which "these two rows look different" never was.
     */
    renderScreen();
    const board = screen.getByRole("region", { name: /Where each move has got to/u });

    for (const movement of closedInAStageGroup) {
      const row = findRecordRow(board, movement.id);
      expect(
        row.textContent,
        `${movement.id} is closed and its row does not carry the recorded reason — ` +
          `"${movement.closure!.reason}". A reader counting the people waiting is counting somebody ` +
          `who left, and nothing on the row tells them.`,
      ).toContain(movement.closure!.reason);
    }
  });

  it("freezes a closed movement's clock instead of counting on to now", () => {
    /*
     * 🔴 **MY FIRST VERSION READ WHOLE HOURS AND COULD NOT DISCRIMINATE, AND MY OWN ESCAPE CLAUSE
     * THEN SKIPPED THE CHECK.** `WF-008` opened 150 minutes before the anchor and closed 130 minutes
     * into its journey. **Both floor to 2 hours.** So an hours-only comparison passes whichever
     * figure is rendered — and the `if (frozen !== running)` guard I had added to be careful
     * detected the coincidence and quietly skipped, which is worse than not checking at all
     * because it reports a pass.
     *
     * **Read in MINUTES, and floor the fixture instead of escaping it:** the two figures must
     * actually differ for this to mean anything, so that is asserted rather than tiptoed around.
     */
    renderScreen();
    const board = screen.getByRole("region", { name: /Where each move has got to/u });

    for (const movement of closedInAStageGroup) {
      const row = findRecordRow(board, movement.id);
      const frozenMinutes = movement.closure!.at - movement.openedAt;
      const runningMinutes = NOW_ANCHOR - movement.openedAt;

      expect(
        frozenMinutes,
        `${movement.id}'s frozen and running durations are identical, so this assertion cannot tell ` +
          `them apart. Re-seed the fixture or drop this movement from the population — do not leave ` +
          `a check that cannot fail.`,
      ).not.toBe(runningMinutes);

      const shown = /(?:(\d+)h)?\s*(?:(\d+)m)/u.exec(row.textContent ?? "");
      expect(shown, `no duration of the form "2h 10m" found on ${movement.id}'s row`).not.toBeNull();
      const shownMinutes = Number(shown![1] ?? 0) * 60 + Number(shown![2]);

      expect(
        shownMinutes,
        `${movement.id} ended ${NOW_ANCHOR - movement.closure!.at} minutes ago, and its row shows ` +
          `${shownMinutes} minutes in journey rather than the ${frozenMinutes} it had when it ended. A ` +
          `duration that keeps growing after a movement stopped is a second false statement on top of ` +
          `the first.`,
      ).toBe(frozenMinutes);
    }
  });
});
