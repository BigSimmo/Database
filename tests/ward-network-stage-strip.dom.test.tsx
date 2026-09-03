import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors the sibling network suites: the workspace renders next/link anchors and this file never
// checks routing, so a plain anchor avoids needing an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { isOpen, queueStageSummaries } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE STAGE STRIP HAS TO RECONCILE WITH THE QUEUE BESIDE IT.
 *
 * The strip is seven numbered cells above a panel headed "Priority queue". Until 2026-08-30 every
 * cell counted movements AT that stage regardless of whether the person was still waiting, so the
 * seven cells summed to 50 while the queue beneath them said 43, with nothing on screen to explain
 * the gap.
 *
 * ⚠️ **THE OBVIOUS REMEDY IS WRONG BY ONE, AND WRONG IN THE DIRECTION THAT HIDES ITSELF.** Both
 * reviewers who found this recommended putting stage 7 "Arrived" outside the queue total. That
 * gives 44, not 43 — because `isOpen` is TWO conditions, `!closure && stage !== "arrived"`, and a
 * movement that does not proceed closes at whatever stage it had reached. This fixture holds
 * exactly one such record, sitting inside stages 1 to 6.
 *
 * So the arrived-only remedy produces a strip that LOOKS like it adds up and does not. That is
 * worse than the original defect: 50 beside 43 is visibly unreconciled and invites the question,
 * whereas 44 beside 43 invites the arithmetic and then fails it, once, silently, for a reader who
 * has no way to see which cell is lying.
 *
 * The assertions below therefore check the WHOLE reconciliation — the waiting cells sum to the
 * queue count, the left-the-pathway cell holds the remainder, and the two together account for
 * every movement. A test that only checked "arrived is outside" would pass the wrong fix.
 */
describe("the network stage strip reconciles with the queue", () => {
  const open = wardMovements.filter(isOpen);
  const left = wardMovements.filter((movement) => !isOpen(movement));
  const closedBeforeArriving = wardMovements.filter((movement) => movement.closure && movement.stage !== "arrived");

  function renderNetwork() {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="network" />
      </WardFlowProvider>,
    );
  }

  it("has a movement that CLOSED BEFORE ARRIVING, or this whole file proves nothing", () => {
    // ⚠️ The canary, and it guards the specific wrong fix rather than the absence of any fix.
    // Every assertion below passes against a fixture where the only non-open movements are the
    // arrived ones — which is exactly the fixture in which "put Arrived outside the total" is
    // correct. Without a did-not-proceed record present, this file would wave through the remedy
    // it exists to reject.
    expect(
      closedBeforeArriving.length,
      "the fixture must hold a movement that closed at a stage other than `arrived`, or the " +
        "off-by-one this file is about cannot occur and nothing here is being tested",
    ).toBeGreaterThan(0);
    expect(left.length).toBeGreaterThan(closedBeforeArriving.length);
    expect(open.length).toBeGreaterThan(0);
  });

  describe("the derivation", () => {
    const summary = queueStageSummaries(wardMovements);

    it("counts only people still waiting in the waiting cells", () => {
      const summed = summary.waiting.reduce((total, stage) => total + stage.count, 0);
      expect(
        summed,
        "the waiting cells must sum to the number of people still waiting for a place. If this is " +
          `${open.length + closedBeforeArriving.length} rather than ${open.length}, the cells are ` +
          "counting movements at a stage instead of people at it, and the did-not-proceed record " +
          "is being counted among people waiting for a bed.",
      ).toBe(open.length);
    });

    it("never offers an `arrived` waiting cell, because arrival is not a way of waiting", () => {
      expect(summary.waiting.map((stage) => stage.id)).not.toContain("arrived");
    });

    it("puts everyone who has left the pathway in one cell, arrived and did-not-proceed alike", () => {
      expect(summary.left.total).toBe(left.length);
      expect(
        summary.left.didNotProceed,
        "a movement that closed before arriving has left the pathway just as completely as one " +
          "that arrived, and it must be accounted for here rather than left inside a waiting cell",
      ).toBe(closedBeforeArriving.length);
      expect(summary.left.arrived).toBe(left.length - closedBeforeArriving.length);
    });

    it("ACCOUNTS FOR EVERY MOVEMENT — the reconciliation the screen is asked to survive", () => {
      const summed = summary.waiting.reduce((total, stage) => total + stage.count, 0);
      expect(
        summed + summary.left.total,
        "waiting plus left must equal every movement. Any other total means a person is either " +
          "missing from the screen or counted on it twice.",
      ).toBe(wardMovements.length);
      expect(summary.left.arrived + summary.left.didNotProceed).toBe(summary.left.total);
    });
  });

  describe("the screen", () => {
    it("shows the waiting cells summing to the number in the queue header", () => {
      renderNetwork();
      const strip = screen.getByRole("region", { name: "Movement pipeline" });
      const cells = within(strip).getAllByTestId(/^ward-pipeline-waiting-/);
      expect(cells.length, "the waiting cells must be on screen").toBeGreaterThan(0);

      const shown = cells.reduce((total, cell) => {
        const figure = within(cell).getByTestId("ward-pipeline-count").textContent ?? "";
        return total + Number(figure);
      }, 0);
      expect(
        shown,
        "the strip and the queue header are two renderings of one fact and a coordinator will read " +
          "them together. They must agree.",
      ).toBe(open.length);
    });

    it("shows those who have left the pathway OUTSIDE the waiting cells, counted and explained", () => {
      renderNetwork();
      const strip = screen.getByRole("region", { name: "Movement pipeline" });
      const departed = within(strip).getByTestId("ward-pipeline-left-pathway");

      expect(departed).toHaveTextContent(String(left.length));
      // ⚠️ Not merely "arrived". The cell must name the did-not-proceed group too, because that is
      // the group whose absence makes the arrived-only remedy wrong by one.
      expect(
        departed,
        "the cell must say WHAT left the pathway, or it becomes an unexplained number that reads " +
          "as a queue stage with an odd name",
      ).toHaveTextContent(/arrived/i);
      expect(departed).toHaveTextContent(/did not proceed/i);

      // And it must not be one of the waiting cells, or the split is cosmetic.
      expect(departed).not.toHaveAttribute("data-waiting-stage");
    });

    it("does not count the did-not-proceed record in any waiting cell", () => {
      renderNetwork();
      const strip = screen.getByRole("region", { name: "Movement pipeline" });
      for (const movement of closedBeforeArriving) {
        const cell = within(strip).getByTestId(`ward-pipeline-waiting-${movement.stage}`);
        const shown = Number(within(cell).getByTestId("ward-pipeline-count").textContent);
        const stillWaitingHere = wardMovements.filter(
          (candidate) => candidate.stage === movement.stage && isOpen(candidate),
        ).length;
        expect(
          shown,
          `${movement.id} closed at stage ${movement.stage} without proceeding, and is still being ` +
            "counted in that stage's cell as though somebody were waiting there",
        ).toBe(stillWaitingHere);
      }
    });
  });
});
