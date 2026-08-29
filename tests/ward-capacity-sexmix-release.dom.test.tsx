import { fireEvent, render, screen, within } from "@testing-library/react";
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

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Dispatches a real RELEASE_BED for WR-001 (rph-adult-secure, seeded confirmed), mirroring
 * `ReferFirstMovement` in tests/ward-flow-queue-selection.dom.test.tsx. */
function ReleaseWr001() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "RELEASE_BED",
          role: "ward",
          now,
          releaseId: "WR-001",
          actingUnitId: "rph-adult-secure",
        })
      }
    >
      release WR-001
    </button>
  );
}

/**
 * Review Finding 2: `RELEASE_BED` moves `unit.empty` (and so derived `occupied`) but never
 * touches `unit.sexMix` — `PATIENT_ARRIVED` is the only other occupancy-changing event and it
 * updates both together. rph-adult-secure is the review's own worked example: seeded beds 20,
 * empty 2, allocatable 1, sexMix 9 Female + 9 Male = 18 = occupied (18) before any dispatch.
 * Releasing WR-001 (seeded confirmed at this unit) lowers occupied to 17 while sexMix stays
 * 9+9=18, breaking the identity the fixture otherwise holds for all 23 units at seed. The model
 * cannot know which sex left, so the fix is not to guess a decrement — it is to say, in visible
 * text, that the figure may no longer be current.
 */
describe("capacity board sex-mix cell after RELEASE_BED", () => {
  it("shows no staleness marker before the release, when sexMix still matches occupied", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="capacity" />
      </WardFlowProvider>,
    );

    const row = screen.getByTestId("ward-capacity-row-rph-adult-secure");
    expect(within(row).getByTestId("ward-capacity-sexmix-rph-adult-secure")).toHaveTextContent("Female 9 · Male 9");
    expect(screen.queryByTestId("ward-capacity-sexmix-stale-rph-adult-secure")).not.toBeInTheDocument();
  });

  it("adds a visible qualification once RELEASE_BED breaks the occupied/sex-mix identity, rather than presenting a stale number as current (review Finding 2)", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="capacity" />
        <ReleaseWr001 />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "release WR-001" }));

    const row = screen.getByTestId("ward-capacity-row-rph-adult-secure");
    // The sex-mix figure itself is untouched — never decremented for a guessed sex.
    expect(within(row).getByTestId("ward-capacity-sexmix-rph-adult-secure")).toHaveTextContent("Female 9 · Male 9");
    // Occupied has moved to 17 (18 - 1), so the sex-mix total (18) no longer matches it.
    expect(within(row).getByTestId("ward-capacity-bed-states-rph-adult-secure")).toHaveTextContent("17Occupied");
    // The qualification is real visible text inside the cell, not only a title attribute.
    const staleMark = within(row).getByTestId("ward-capacity-sexmix-stale-rph-adult-secure");
    expect(staleMark).toHaveTextContent(/may not match current occupancy/i);
  });
});
