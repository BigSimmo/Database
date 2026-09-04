import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardDailySheet, type WardDailySheetProps } from "@/components/ward-management/board/ward-daily-sheet";

/**
 * THE OWNER'S RULING, PINNED AS A RENDERED-DOM ASSERTION.
 *
 * Owner, 2026-08-30: the "off the ward" line sits LAST on the daily sheet, after the current
 * occupants — those people are not on the ward right now. `ward-daily-sheet.tsx` renders five
 * group sections (who came in, who is going, who is stuck, who is overdue, no date given) inside
 * one wrapper `<div>`, and the away line is a separate `<p>` placed physically after that wrapper
 * closes.
 *
 * **The ruling is about GROUPS, not headings.** A version of this file once asserted only that the
 * away line came after every group HEADING. A refactor can satisfy that while nesting the away
 * line INSIDE the last group's own body — one level below its heading, still after it — which
 * violates the ruling while every heading-relative comparison keeps passing. Nesting one level too
 * deep is exactly what an ordinary refactor does, so this version checks the away line against
 * each group's CONTAINER (the `<section data-testid="ward-daily-sheet-…">` element that IS the
 * group), and asks two separate questions of each one: does the away line come after this
 * container, and is the away line a descendant of it. See `assertAfterAndNotNestedIn` below for
 * why both questions are needed — a single bitmask check cannot tell them apart.
 *
 * Before this file, nothing asserted the away line's placement at all: `dailySheetGroups()`'s
 * object field order is inert — its fields are read by name, never iterated — so it cannot enforce
 * anything, and `tests/ward-daily-sheet.dom.test.tsx` pins the group HEADINGS with the away group
 * deliberately excluded, never the away line's position. This file is that guard.
 */
function minimalSheetProps(): WardDailySheetProps {
  return {
    movement: { discharged: 0, pulled: 0, datesMoved: 0 },
    incomingPulled: 0,
    incomingWaitlisted: 0,
    outgoingCount: 0,
    outgoingBasisLabel: "Expected",
    destinations: [],
    people: [],
  };
}

/**
 * `Node.compareDocumentPosition` is a bitmask, and DOCUMENT_POSITION_FOLLOWING (4) is set for BOTH
 * "comes after" and "is a descendant of" — a node contained inside `container` gets back
 * FOLLOWING | CONTAINED_BY (4 | 16 = 20), because a descendant's start tag is, in tree order,
 * after its ancestor's start tag. A bare `position & FOLLOWING` check is therefore truthy for a
 * node the ruling actually forbids (nested inside the last group), which is not an ordering test —
 * it is an ordering-or-containment test standing in for one. Every call site here checks both bits
 * so containment cannot masquerade as order.
 */
function assertAfterAndNotNestedIn(container: Element, node: Element) {
  const position = container.compareDocumentPosition(node);
  expect.soft(Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  expect.soft(Boolean(position & Node.DOCUMENT_POSITION_CONTAINED_BY)).toBe(false);
}

describe("the daily sheet's away line renders after every group, not merely after every heading", () => {
  it("places the away line after every group container, and never nested inside one", () => {
    render(<WardDailySheet {...minimalSheetProps()} />);
    const sheet = screen.getByTestId("ward-daily-sheet");
    const awayLine = within(sheet).getByTestId("ward-daily-sheet-away");

    // Load-bearing: getAllByRole throws on zero matches, which is what makes this a guard rather
    // than an ordinary query. Do not weaken it to queryAllByRole — that swallows the zero-heading
    // case this file exists to catch (see the third mutation proof in the placement-repair report).
    const headings = within(sheet).getAllByRole("heading", { level: 3 });
    // Pinned EXACTLY, never as a floor: a floor of "at least one" cannot see the sheet degrade from
    // five group headings to one, because the loop below would then just make fewer comparisons —
    // fewer checks — and still report green. The count IS the coverage.
    expect(headings.length).toBe(5);

    // Also load-bearing (throws on zero matches): these are the elements the ordering/containment
    // check below is actually run against, per the doc comment above — containers, not headings.
    const groupContainers = within(sheet).getAllByTestId(/^ward-daily-sheet-(in|out|stuck|overdue|no-date)$/);
    // Non-vacuity guard for the loop immediately below, asserted in the SAME test as the loop it
    // protects — not in a sibling `it` block with its own separate render(), which guards nothing.
    expect(groupContainers.length).toBe(5);

    for (const container of groupContainers) {
      assertAfterAndNotNestedIn(container, awayLine);
    }
  });
});
