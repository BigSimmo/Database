import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardGroupHeading, WardRecordList, WardRecordRow } from "@/components/ward-management/ward-record-row";

/**
 * The single shape all three merged screens repeat: an id, state words, a clock, attributes, an
 * optional reason, and actions. Counted 2026-09-05 across the 41 Ward Flow stylesheets: 53 distinct
 * `*Row` classes and 26 distinct `*Note` classes. This is one of each, for these three screens
 * only — nothing outside them is migrated here.
 *
 * Two of the tests below are about REFUSALS, and both refuse a shape that renders perfectly well
 * and says something untrue:
 *
 *   1. **A toned row with no state word.** `tone` draws a coloured left edge and nothing else, so
 *      such a row is a coloured stripe carrying meaning on its own — the exact defect `WardChip`
 *      already refuses one level down. An UNTONED row with no states is fine, because it makes no
 *      claim; that case is asserted too, so the guard cannot be satisfied by banning both.
 *   2. **A group heading of nought.** This is the "absence is stated, never blank" rule's failure
 *      case: a heading over an empty group reads as a category that exists and is fine, when in
 *      fact nothing was measured.
 */
describe("WardRecordRow", () => {
  it("shows the id, every state word, the clock and its attributes", () => {
    render(
      <WardRecordList>
        <WardRecordRow
          id="WF-009"
          tone="danger"
          states={[
            { level: "urgent", text: "5 declined" },
            { level: "stalled", text: "Escalated" },
          ]}
          clock={{ value: "7h 00m", sub: "in ED", urgent: true }}
          attributes={["Adult", "Male", "Involuntary", "Needs a locked bed"]}
        />
      </WardRecordList>,
    );
    expect(screen.getByText("WF-009")).toBeInTheDocument();
    expect(screen.getByText("5 declined")).toBeInTheDocument();
    expect(screen.getByText("Escalated")).toBeInTheDocument();
    expect(screen.getByText("7h 00m")).toBeInTheDocument();
    expect(screen.getByText(/Needs a locked bed/u)).toBeInTheDocument();
  });

  it("refuses a toned row that carries no state word", () => {
    expect(() =>
      render(
        <WardRecordList>
          <WardRecordRow id="WF-001" tone="danger" states={[]} attributes={["Adult"]} />
        </WardRecordList>,
      ),
    ).toThrow(/colour alone cannot carry a state/u);
  });

  it("allows an untoned row with no state word, because that row makes no claim", () => {
    render(
      <WardRecordList>
        <WardRecordRow id="WF-001" states={[]} attributes={["Adult"]} />
      </WardRecordList>,
    );
    expect(screen.getByText("WF-001")).toBeInTheDocument();
  });

  it("renders the reason as its own block so it cannot be mistaken for an attribute", () => {
    render(
      <WardRecordList>
        <WardRecordRow
          id="WF-019"
          states={[{ level: "urgent", text: "Longest wait" }]}
          attributes={["Adult"]}
          reason={{ level: "warning", text: "Voluntary, but assessed as needing a locked bed." }}
        />
      </WardRecordList>,
    );
    expect(
      screen.getByText(/Voluntary, but assessed/u).closest("[data-ward-primitive='record-reason']"),
    ).not.toBeNull();
  });
});

describe("WardGroupHeading", () => {
  it("counts people and says so, because a patient carries several delays at once", () => {
    render(<WardGroupHeading title="No suitable bed anywhere" people={2} />);
    expect(screen.getByText("2 people")).toBeInTheDocument();
  });

  it("says '1 person', not '1 people'", () => {
    render(<WardGroupHeading title="Legal authority running out" people={1} />);
    expect(screen.getByText("1 person")).toBeInTheDocument();
  });

  it("refuses a group heading of nought — an empty group is stated in words, not headed", () => {
    expect(() => render(<WardGroupHeading title="Awaiting transport" people={0} />)).toThrow(/nought/u);
  });
});
