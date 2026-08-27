import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installMatchMediaStub } from "./setup/jsdom.setup";

import type { Therapy } from "@/components/therapy-compass/data/types";
import { therapyCompareAddonSlotId } from "@/lib/mode-home-composer";
import { THERAPY_MAX_COMPARE } from "@/lib/therapy-compass-navigation";

const tc = vi.hoisted(() => ({
  compareSlugs: [] as string[],
  compareTherapies: [] as Therapy[],
  removeCompare: vi.fn(),
  clearCompare: vi.fn(),
  goCompare: vi.fn(),
}));

vi.mock("@/components/therapy-compass/bindings", () => ({
  useTcBindings: () => ({
    compareSlugs: tc.compareSlugs,
    compareTherapies: tc.compareTherapies,
    removeCompare: tc.removeCompare,
    clearCompare: tc.clearCompare,
    goCompare: tc.goCompare,
  }),
}));

import { TherapyCompareTray } from "@/components/therapy-compass/therapy-compare-tray";

function therapy(slug: string, name: string, aliases: string[] = []): Therapy {
  return { slug, name, aliases, tags: [], category: "Behavioural" } as unknown as Therapy;
}

const CBT = therapy("cbt", "Cognitive behavioural therapy", ["CBT"]);
const ACT = therapy("act", "Acceptance and commitment therapy", ["ACT"]);

function select(...items: Therapy[]) {
  tc.compareTherapies = items;
  tc.compareSlugs = items.map((item) => item.slug);
}

/** The dock renders the addon slot inside its own form; stand one in for it. */
function mountDockSlot() {
  const slot = document.createElement("div");
  slot.id = therapyCompareAddonSlotId;
  document.body.append(slot);
  return slot;
}

beforeEach(() => {
  // The tray gates on the phone breakpoint the dock itself uses (639px).
  installMatchMediaStub(true);
  select();
});

afterEach(() => {
  document.getElementById(therapyCompareAddonSlotId)?.remove();
  tc.removeCompare.mockReset();
  tc.clearCompare.mockReset();
  tc.goCompare.mockReset();
});

describe("Therapy compare tray", () => {
  it("does not exist until something is in it", () => {
    mountDockSlot();
    render(<TherapyCompareTray />);

    expect(screen.queryByTestId("therapy-compare-tray")).toBeNull();
  });

  it("renders nothing above the phone breakpoint, where there is no dock to sit in", () => {
    installMatchMediaStub(false);
    mountDockSlot();
    select(CBT, ACT);
    render(<TherapyCompareTray />);

    expect(screen.queryByTestId("therapy-compare-tray")).toBeNull();
  });

  it("docks inside the composer's addon slot rather than positioning itself", async () => {
    const slot = mountDockSlot();
    select(CBT);
    render(<TherapyCompareTray />);

    const tray = await screen.findByTestId("therapy-compare-tray");
    // Inheriting the dock's fixed position, z-index, safe-area and scroll-hide
    // transform is the entire reason this is a portal and not new chrome.
    expect(slot.contains(tray)).toBe(true);
  });

  it("holds Compare back until there are two, and says why", async () => {
    mountDockSlot();
    select(CBT);
    render(<TherapyCompareTray />);

    const compare = await screen.findByTestId("therapy-compare-tray-compare");
    expect(compare).toHaveAttribute("aria-disabled", "true");
    expect(compare).not.toBeDisabled();
    expect(compare).toHaveAttribute("title", "Add one more therapy to compare");

    await userEvent.click(compare);
    expect(tc.goCompare).not.toHaveBeenCalled();
  });

  it("opens the comparison once two are selected", async () => {
    mountDockSlot();
    select(CBT, ACT);
    render(<TherapyCompareTray />);

    const compare = await screen.findByTestId("therapy-compare-tray-compare");
    expect(compare).not.toHaveAttribute("aria-disabled");
    await userEvent.click(compare);

    expect(tc.goCompare).toHaveBeenCalledTimes(1);
  });

  it("shows the record's abbreviation where it has one, and counts the set", async () => {
    mountDockSlot();
    select(CBT, ACT);
    render(<TherapyCompareTray />);

    const tray = await screen.findByTestId("therapy-compare-tray");
    expect(tray).toHaveTextContent("CBT · ACT");
    expect(tray).toHaveTextContent(`2 of ${THERAPY_MAX_COMPARE} selected`);
    expect(screen.getByTestId("therapy-compare-tray-open")).toHaveAttribute(
      "aria-label",
      `Compare tray, 2 of ${THERAPY_MAX_COMPARE} selected`,
    );
  });

  it("removes and empties from the sheet, not from the one-row bar", async () => {
    mountDockSlot();
    select(CBT, ACT);
    render(<TherapyCompareTray />);

    await userEvent.click(await screen.findByTestId("therapy-compare-tray-open"));
    await screen.findByTestId("therapy-compare-tray-sheet");

    await userEvent.click(await screen.findByRole("button", { name: `Remove ${CBT.name} from the comparison` }));
    expect(tc.removeCompare).toHaveBeenCalledWith(CBT.slug);
    // Two were selected, so one removal leaves a tray — the sheet stays put.
    expect(screen.getByTestId("therapy-compare-tray-sheet")).toBeInTheDocument();

    // Emptying does not: the sheet belongs to a tray that is about to stop
    // existing, so leaving it open would be a dialog over nothing.
    await userEvent.click(await screen.findByRole("button", { name: "Empty the tray" }));
    expect(tc.clearCompare).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId("therapy-compare-tray-sheet")).toBeNull());
  });

  it("closes the sheet when the tray it belongs to stops existing", async () => {
    mountDockSlot();
    select(CBT, ACT);
    const { rerender } = render(<TherapyCompareTray />);

    await userEvent.click(await screen.findByTestId("therapy-compare-tray-open"));
    expect(await screen.findByTestId("therapy-compare-tray-sheet")).toBeInTheDocument();

    select();
    rerender(<TherapyCompareTray />);

    await waitFor(() => expect(screen.queryByTestId("therapy-compare-tray-sheet")).toBeNull());
  });
});
