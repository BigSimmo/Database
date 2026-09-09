import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors the sibling network suite: the workspace renders next/link anchors and this file never
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
import { isOpen } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * A QUEUE FOR PLACEMENT COUNTS PEOPLE STILL WAITING FOR A PLACE.
 *
 * The network page's "Priority queue" panel rendered `movements.length` — every movement ever, with
 * arrived and closed patients counted among people waiting for a bed. The list under it did the
 * same, rendering arrived patients as rows in a queue for placement.
 *
 * ⚠️ **The correct number was computed in the same component, thirty-three lines earlier**, under a
 * comment saying in terms that the raw count "includes them and overstates live demand" — and then
 * shown only in a detail line that appears when a patient is selected. The component knew, said so,
 * and rendered the other number anyway.
 *
 * Phase 1's audit recorded this exact shape once already: "48 open movements counted six arrived and
 * one closed record". Same defect, different component, and no test caught either.
 *
 * Three screens disagreed on screen — transport said 43 open, search showed 43 movements, the
 * network said 50 — and the network is the one a coordinator looks at first.
 */
describe("the network's priority queue counts only people still waiting", () => {
  function renderNetwork() {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="network" />
      </WardFlowProvider>,
    );
  }

  const open = wardMovements.filter(isOpen);
  const notOpen = wardMovements.filter((movement) => !isOpen(movement));

  it("has movements that have LEFT the pathway, or this proves nothing", () => {
    // The canary. Every assertion below passes trivially against a fixture where every movement is
    // still open, and that is exactly the fixture this defect hid in for a whole phase.
    expect(open.length).toBeGreaterThan(0);
    expect(notOpen.length, "the fixture must contain arrived or closed movements").toBeGreaterThan(0);
    expect(wardMovements.length).toBeGreaterThan(open.length);
  });

  it("shows the OPEN count in the panel header, not every movement ever", () => {
    renderNetwork();
    const panel = screen.getByRole("region", { name: "Priority queue" });
    expect(
      within(panel).getByText(String(open.length)),
      `the panel must count the ${open.length} people still waiting, never all ${wardMovements.length} ` +
        `movements. Counting the ${notOpen.length} who have arrived or closed overstates live demand, ` +
        "which is the figure a coordinator reads first.",
    ).toBeInTheDocument();
    expect(
      within(panel).queryByText(String(wardMovements.length)),
      "the raw all-movements total must not appear in this panel at all",
    ).not.toBeInTheDocument();
  });

  it("does not list a patient who has already arrived as someone awaiting placement", () => {
    renderNetwork();
    const panel = screen.getByRole("region", { name: "Priority queue" });
    for (const movement of notOpen) {
      expect(
        within(panel).queryByText(movement.id),
        `${movement.id} has left the pathway (stage ${movement.stage}) and must not be a row in a ` +
          "queue for placement — the count and the list have to agree about who is waiting",
      ).not.toBeInTheDocument();
    }
  });

  it("still lists the people who ARE waiting, so the filter did not simply empty it", () => {
    renderNetwork();
    const panel = screen.getByRole("region", { name: "Priority queue" });
    // A filter that removed everything would satisfy both assertions above.
    const shown = open.filter((movement) => within(panel).queryByText(movement.id) !== null);
    expect(shown.length, "the queue must still show the people who are waiting").toBeGreaterThan(0);
  });
});
