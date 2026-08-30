import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors tests/ward-flow-queue-selection.dom.test.tsx: the network view renders next/link
// anchors and this suite never checks routing itself, so a plain <a> avoids requiring an App
// Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { FlowDiagram } from "@/components/ward-management/coordinator/flow-diagram";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Review Finding 4: the network view and the coordinator flow diagram both used to render a
 * `Potential` chip sourced from `unitCapacity()`'s raw release count — every release for the
 * unit regardless of state or timing, including one already `discharged` and one expected beyond
 * tonight, neither of which spec D5/D6 permit in any count. Both surfaces now read
 * `capacityBreakdown()` instead, the same figures the capacity board and the ward screen already
 * show (`tests/ward-capacity-view.dom.test.tsx`, `tests/ward-screen.dom.test.tsx`).
 *
 * WR-008 is seeded `state: "discharged"` at `arm-adult-open` — the review's own "zero clicks,
 * seeded data" trigger: the old figure showed `Potential 1` for a bed that had already come
 * free. The fixed figure must show Confirmed 0 / Expected 0 for that unit instead, and the
 * word "Potential" must never appear on either surface again.
 *
 * WR-001 is seeded `state: "confirmed"` at `rph-adult-secure`, expected well inside today (the
 * same unit and figure `ward-screen.dom.test.tsx` pins as `Confirmed 1`), giving a non-zero
 * control case alongside the zero case above.
 */
describe("network view and coordinator flow diagram never show the raw potential figure", () => {
  it("network view shows Confirmed/Expected from capacityBreakdown(), not unitCapacity()'s potential", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="network" />
      </WardFlowProvider>,
    );

    // The defect this suite exists to catch: the word this view (and its legend) used to show
    // for a figure that is no longer computed anywhere on this branch.
    expect(screen.queryByText("Potential")).not.toBeInTheDocument();

    // The network card's chips carry no visible label text of their own (only a `data-state`
    // attribute and a `title` tooltip — see `BedStateChips`), so the figure is read from the
    // chip matching each state rather than from a rendered word.
    const dischargedUnitCard = screen.getByTestId("ward-network-card-arm-adult-open");
    expect(dischargedUnitCard.querySelector('[data-state="confirmed"]')).toHaveTextContent("0");
    expect(dischargedUnitCard.querySelector('[data-state="expected"]')).toHaveTextContent("0");
    expect(dischargedUnitCard.getAttribute("aria-label")).not.toMatch(/potential/i);
    expect(dischargedUnitCard.getAttribute("aria-label")).toMatch(/0 confirmed, 0 expected/);

    const confirmedUnitCard = screen.getByTestId("ward-network-card-rph-adult-secure");
    expect(confirmedUnitCard.querySelector('[data-state="confirmed"]')).toHaveTextContent("1");
    expect(confirmedUnitCard.querySelector('[data-state="expected"]')).toHaveTextContent("0");
  });

  it("coordinator flow diagram shows Confirmed/Expected from capacityBreakdown(), not unitCapacity()'s potential", () => {
    render(
      <FlowDiagram
        movement={undefined}
        /* Named rather than defaulted. `FlowDiagram` used to reach the seed through `edPressure`'s
           old default parameter, so its ED figures were the fixture's whatever the caller meant.
           The argument is required now and every caller says which movements it means. */
        movements={wardMovements}
        now={NOW_ANCHOR}
        units={allUnits()}
        bedReleases={bedReleases}
        leaveBeds={leaveBeds}
        selectedUnitId={undefined}
        onSelectUnit={() => {}}
      />,
    );

    expect(screen.queryByText(/^Potential/)).not.toBeInTheDocument();

    const dischargedUnitNode = screen.getByTestId("ward-diagram-unit-arm-adult-open");
    expect(within(dischargedUnitNode).queryByText(/^Potential/)).not.toBeInTheDocument();
    expect(dischargedUnitNode).toHaveTextContent("Confirmed 0");
    expect(dischargedUnitNode).toHaveTextContent("Expected 0");

    const confirmedUnitNode = screen.getByTestId("ward-diagram-unit-rph-adult-secure");
    expect(confirmedUnitNode).toHaveTextContent("Confirmed 1");
    expect(confirmedUnitNode).toHaveTextContent("Expected 0");
  });
});
