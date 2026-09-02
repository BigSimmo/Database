/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompareSlotStrip } from "@/components/compare/compare-slot-strip";
import type { CompareSlot } from "@/components/compare/types";
import { installMatchMediaStub } from "./setup/jsdom.setup";

const fourEmptySlots: CompareSlot[] = [
  { id: null, label: "A", title: "Choose therapy" },
  { id: null, label: "B", title: "Choose therapy" },
  { id: null, label: "C", title: "Choose therapy" },
  { id: null, label: "D", title: "Choose therapy" },
];

const oneFilledSlots: CompareSlot[] = [
  { id: "cbt", label: "A", title: "CBT", subtitle: "Skills based" },
  { id: null, label: "B", title: "Choose therapy" },
  { id: null, label: "C", title: "Choose therapy" },
  { id: null, label: "D", title: "Choose therapy" },
];

afterEach(() => {
  cleanup();
});

describe("CompareSlotStrip hybrid phone layout", () => {
  beforeEach(() => {
    installMatchMediaStub(true);
  });

  it("shows the pip summary instead of four tall cards when all empty", () => {
    render(
      <CompareSlotStrip
        slots={fourEmptySlots}
        onSelectSlot={() => {}}
        phoneLayout="hybrid"
        actionLabel="Add therapies"
        slotSummaryLabel="Up to 4 therapies"
        onPrimaryAction={vi.fn()}
      />,
    );

    expect(screen.getByTestId("compare-slot-strip-pip-summary")).toBeInTheDocument();
    expect(screen.queryByTestId("compare-slot-tile")).toBeNull();
    expect(screen.queryByTestId("compare-slot-tile-compact")).toBeNull();
    expect(screen.getByRole("button", { name: "Add therapies" })).toBeInTheDocument();
    expect(screen.getByText("Up to 4 therapies")).toBeInTheDocument();
  });

  it("opens the primary action from the pip summary", async () => {
    const user = userEvent.setup();
    const onPrimaryAction = vi.fn();

    render(
      <CompareSlotStrip
        slots={fourEmptySlots}
        onSelectSlot={() => {}}
        phoneLayout="hybrid"
        actionLabel="Add therapies"
        onPrimaryAction={onPrimaryAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add therapies" }));
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it("uses a 2×2 compact grid once any slot is filled", () => {
    render(<CompareSlotStrip slots={oneFilledSlots} onSelectSlot={() => {}} phoneLayout="hybrid" minCount={2} />);

    expect(screen.queryByTestId("compare-slot-strip-pip-summary")).toBeNull();
    expect(screen.getByTestId("compare-slot-strip-hybrid-grid")).toBeInTheDocument();
    expect(screen.getAllByTestId("compare-slot-tile-compact")).toHaveLength(4);
    expect(screen.getByTestId("compare-slot-strip-one-more-hint")).toHaveTextContent(/one more/i);
  });

  it("keeps the default stacked layout on desktop widths", () => {
    installMatchMediaStub(false);

    render(
      <CompareSlotStrip
        slots={fourEmptySlots}
        onSelectSlot={() => {}}
        phoneLayout="hybrid"
        actionLabel="Add therapies"
        onPrimaryAction={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("compare-slot-strip-pip-summary")).toBeNull();
    expect(screen.getAllByTestId("compare-slot-tile")).toHaveLength(4);
  });
});
