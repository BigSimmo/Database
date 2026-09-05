import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard, DischargeGroupSection } from "@/components/ward-management/discharges/discharge-board";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE ELEVATED PANEL ON THE DISCHARGES BOARD MARKS WORK, NOT A HEADING.
 *
 * The four groups render in a fixed scan order — blocked first, because those are the rows
 * somebody must act on — and until 2026-09-05 nothing but that order said so: measured at 1100px,
 * all four sections painted `rgb(251, 252, 253)` behind the same border, so the stuck releases and
 * the beds already free were the same object four times over.
 *
 * ⚠️ **AND THE LIFT IS CONDITIONAL ON THERE BEING ROWS, WHICH IS THE HALF THIS SUITE EXISTS FOR.**
 * Raising the Blocked heading unconditionally would make an EMPTY panel the loudest thing on a
 * board where nothing is stuck — an absence promoted to a headline, and the good morning would
 * look like the urgent one. The property is "there is work here", never "this heading matters".
 *
 * ⚠️ **THE EMPTY ARM IS UNREACHABLE THROUGH `DischargeBoard`.** The seeded state always contains
 * blocked releases, so a guard written only against the whole board would assert something true
 * and unfalsifiable — green today, green after somebody makes the lift unconditional, and red only
 * on a fixture nobody has. That is why `DischargeGroupSection` is exported and rendered directly
 * here with an empty list.
 */

const LIVE = "sectionLive";

/** The section element for one group, from a whole-board render. */
function groupSection(groupKey: string): HTMLElement {
  return screen.getByTestId(`ward-discharge-group-${groupKey}`);
}

/** CSS Modules hashes class names, so `toHaveClass` with a literal cannot work. Substring match on
 *  the rendered class list is the only thing available, and it is why `LIVE` is a distinctive name
 *  rather than something like `live` that would also match `.sectionLiveWhatever`. */
function isElevated(element: HTMLElement): boolean {
  return element.className.includes(LIVE);
}

describe("the discharges board raises the blocked group, and only while it has rows", () => {
  /**
   * ⚠️ ANTI-VACUITY, ON THE POPULATION WALKED. Every assertion below reads sections out of a
   * rendered board; if the board stopped rendering its four groups, or the class name were
   * renamed, the checks would have nothing to contradict them. This establishes the four sections
   * exist AND that the elevated class is really reaching the DOM, before anything is concluded.
   */
  it("renders all four groups, and one of them really is carrying the elevated class", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );
    const keys = ["blocked", "confirmed", "expected", "discharged-today"];
    for (const key of keys) expect(groupSection(key), `${key} did not render`).toBeTruthy();
    expect(
      keys.filter((key) => isElevated(groupSection(key))).length,
      "no section carries the elevated class — either the class was renamed, or the seeded state " +
        "has stopped containing a blocked release and every assertion below is about nothing",
    ).toBe(1);
  });

  it("raises the blocked group and no other, on the seeded board", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );
    expect(isElevated(groupSection("blocked")), "the blocked group is not raised").toBe(true);
    for (const key of ["confirmed", "expected", "discharged-today"]) {
      expect(
        isElevated(groupSection(key)),
        `${key} is raised too — the board must have exactly one elevated surface, or none is emphatic`,
      ).toBe(false);
    }
  });

  /**
   * The seed must really put releases in the blocked group, or the assertion above passes for the
   * wrong reason. Read from the same grouping function the board uses rather than from a count
   * written here, so it stays true whatever the fixture becomes.
   */
  it("is asserting against a blocked group that actually has rows", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );
    expect(
      screen.queryByTestId("ward-discharge-group-blocked-empty"),
      "the seeded blocked group is EMPTY, so the raised-when-populated case above never ran",
    ).toBeNull();
  });

  it("does NOT raise an empty blocked group — the direction a careless emphasis breaks", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeGroupSection groupKey="blocked" releases={[]} units={allUnits()} now={NOW_ANCHOR} />
      </WardFlowProvider>,
    );
    const section = container.querySelector('[data-testid="ward-discharge-group-blocked"]') as HTMLElement;
    expect(section, "the section did not render at all").toBeTruthy();
    expect(
      screen.getByTestId("ward-discharge-group-blocked-empty"),
      "this render was supposed to exercise the EMPTY arm and did not",
    ).toBeTruthy();
    expect(
      isElevated(section),
      "an empty blocked group is raised — a board where nothing is stuck now shouts an empty " +
        "panel at the coordinator, which is the good morning made to look like the urgent one",
    ).toBe(false);
  });

  it("raises a populated blocked group rendered on its own, so the lift is not an accident of the board", () => {
    const blocked = seedWardFlowState().bedReleases.filter((release) => release.blocker !== null);
    expect(blocked.length, "no seeded release carries a blocker, so this case is untested").toBeGreaterThan(0);
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeGroupSection groupKey="blocked" releases={blocked} units={allUnits()} now={NOW_ANCHOR} />
      </WardFlowProvider>,
    );
    const section = container.querySelector('[data-testid="ward-discharge-group-blocked"]') as HTMLElement;
    expect(isElevated(section), "a populated blocked group is not raised").toBe(true);
  });
});
