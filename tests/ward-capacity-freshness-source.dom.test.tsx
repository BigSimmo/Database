import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors tests/ward-flow-queue-selection.dom.test.tsx: WardModeWorkspace renders next/link
// anchors and this suite never checks routing itself, so a plain <a> avoids requiring an App
// Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * Review Finding 6: no seeded or dispatch-reachable state gives any unit's
 * `allocatable.source` a value other than `"ward"` today (`CONFIRM_CAPACITY` only ever writes
 * `source: "ward"`, and every fixture in `ward-sites.ts` seeds `"ward"`), so the capacity
 * board's own bug — an unconditional `confirmedByRole`, no `derived` — cannot be reached
 * through a real dispatch. The provider's `useWardFlow()` is mocked here to construct the one
 * state that DOES reach it: a feed-sourced unit, the shape the review says the fix protects
 * against, mirroring how `ward-flow-reducer.ts`'s own doc comment describes `CapacitySource`.
 */
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlow: () => mockContext,
  };
});

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seeded = seedWardFlowState();
const FEED_UNIT_ID = seeded.units[0]!.id;
const mockContext = {
  movements: seeded.movements,
  units: seeded.units.map((unit) =>
    unit.id === FEED_UNIT_ID ? { ...unit, allocatable: { ...unit.allocatable, source: "feed" as const } } : unit,
  ),
  rejections: seeded.rejections,
  bedReleases: seeded.bedReleases,
  leaveBeds: seeded.leaveBeds,
  refreshRequests: seeded.refreshRequests,
  now: NOW_ANCHOR,
  scenario: seeded.scenario,
  dispatch: vi.fn(),
  focusMovementId: undefined,
  setFocusMovementId: vi.fn(),
};

describe("capacity board freshness stamp reflects allocatable.source, not an unconditional ward confirmation", () => {
  it("renders 'As at HH:MM', never a false ward attribution, for a feed-sourced unit (review Finding 6)", () => {
    render(<WardModeWorkspace mode="capacity" />);

    const row = screen.getByTestId(`ward-capacity-row-${FEED_UNIT_ID}`);

    // The defect this suite exists to catch: before the fix, `confirmedByRole` was passed
    // unconditionally, so this row always rendered "Confirmed HH:MM · NUM <ward>" even though
    // this unit's own allocatable count was never confirmed by that ward.
    expect(within(row).queryByText(/^Confirmed /)).not.toBeInTheDocument();
    expect(within(row).getByText(/^As at /)).toBeInTheDocument();
  });

  it("still renders the ward-confirmed stamp for every ward-sourced unit, unchanged", () => {
    render(<WardModeWorkspace mode="capacity" />);

    const wardSourcedUnit = seeded.units.find((unit) => unit.id !== FEED_UNIT_ID)!;
    const row = screen.getByTestId(`ward-capacity-row-${wardSourcedUnit.id}`);

    expect(within(row).getByText(new RegExp(`^Confirmed .* NUM ${wardSourcedUnit.name}$`))).toBeInTheDocument();
  });
});
