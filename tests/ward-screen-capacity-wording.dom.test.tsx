import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as the sibling ward-screen dom suites.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE WARD SCREEN MUST NOT CALL `capacity.available` "FREE".
 *
 * ⚠️ THE DEFECT. `unitCapacity()` computes `available = min(allocatable, empty)` — beds that are
 * empty AND that the ward is offering — and on the very next line `held = empty - available`, which
 * is the count of beds that ARE empty and are NOT in that figure. The hero called `available`
 * "free bed(s) on this ward right now". Whenever `held > 0` that states fewer free beds than the
 * ward has empty, and the contradiction was already on the page: the breakdown below renders
 * `Ready {available}` beside `Held {held}` as two different things.
 *
 * ⚠️ WHY THE FLOOR IS `held > 0` AND NOT "a unit exists". On a unit with `held === 0` the words
 * "free" and "ready" describe the same set, so such a unit cannot tell the defect from the repair
 * and a test walking only those would pass against the wording it exists to reject.
 *
 * ⚠️ WHAT THIS DELIBERATELY DOES NOT DECIDE. Whether the product's word for this quantity should be
 * "ready", "free", or the board's "beds you can fill today" is an open question with the owner —
 * `board/ward-board.tsx` renders the comparable figure as "beds you can fill today". This file pins
 * only that ONE SCREEN uses ONE WORD for ONE VALUE, which is repairable without pre-empting that
 * answer. If the owner picks a different word, the right change is the word here and in the
 * breakdown together, and this test will say so by failing on the mismatch rather than on the term.
 */

/** Units where "empty" and "offered" genuinely differ — the only ones that discriminate. */
const discriminating = allUnits().filter((unit) => unitCapacity(unit, []).held > 0);

function renderWard(unitId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
}

describe("the ward screen's word for min(allocatable, empty)", () => {
  it("has a seeded unit holding empty beds it is not offering", () => {
    expect(
      discriminating.length,
      "no seeded unit has held > 0, so 'free' and 'ready' describe the same beds everywhere and " +
        "every assertion below would pass against the wording this file rejects",
    ).toBeGreaterThan(0);
  });

  it("states a figure that is genuinely smaller than the ward's empty beds", () => {
    // The premise of the whole repair, asserted rather than assumed: on these units the hero's
    // number is NOT the count of empty beds, so calling it "free" was a false statement and not
    // merely an inelegant one.
    for (const unit of discriminating) {
      const capacity = unitCapacity(unit, []);
      expect(
        capacity.available,
        `${unit.name}: available must be strictly below empty for this unit to discriminate`,
      ).toBeLessThan(unit.empty.value);
      expect(capacity.available + capacity.held).toBe(unit.empty.value);
    }
  });

  /*
   * ⚠️ SCOPED TO THE LABEL, NOT THE HERO, AND MUTATION IS WHY. This assertion first read the whole
   * `ward-hero` section, which CONTAINS the call-to-action — so mutating the CTA's word turned this
   * test red as well as the CTA's own test. Two tests going red for one edit is not a stronger
   * signal; it hides which site broke, and the name of this test claimed a precision it did not
   * have. Each of the two sites now has an assertion that names it, and the catch-all below is
   * labelled as a catch-all rather than passing for one of them.
   */
  it("does not call the figure 'free' in the headline label", () => {
    const unit = discriminating[0];
    renderWard(unit.id);

    const label = document.getElementById("ward-hero-title");
    expect(label, "the headline label is the element the figure is read with").not.toBeNull();
    expect(
      label?.textContent?.toLowerCase(),
      `${unit.name} is offering ${unitCapacity(unit, []).available} of its ${unit.empty.value} empty ` +
        `beds, so "free" names a larger set than the figure beside it`,
    ).not.toContain("free");
  });

  it("CATCH-ALL: no part of the hero calls the figure 'free'", () => {
    // Deliberately broad, and named so. The two assertions above own the label and the CTA; this
    // exists for a third site nobody has added yet, and it is expected to go red alongside one of
    // them rather than instead of one.
    const unit = discriminating[0];
    renderWard(unit.id);
    expect(screen.getByTestId("ward-hero").textContent?.toLowerCase()).not.toContain("free");
  });

  it("uses the same word for the figure as the breakdown that itemises it", () => {
    const unit = discriminating[0];
    const capacity = unitCapacity(unit, []);
    renderWard(unit.id);

    // The breakdown is the screen's own vocabulary for this exact value.
    const breakdown = screen.getByTestId("ward-unit-beds");
    expect(breakdown).toHaveTextContent(`Ready ${capacity.available}`);
    expect(breakdown).toHaveTextContent(`Held ${capacity.held}`);

    // The hero must agree with it — same value, same word, one screen.
    const heroLabel = screen.getByTestId("ward-hero").textContent?.toLowerCase() ?? "";
    expect(
      heroLabel,
      "the hero and the breakdown render the same number; a reader who sees two words for it has " +
        "to decide which one is the real quantity",
    ).toContain("ready");
    expect(screen.getByTestId("ward-hero-ready")).toHaveTextContent(String(capacity.available));
  });

  it("does not offer the figure as a ratio of the ward's whole bed stock", () => {
    const unit = discriminating[0];
    const capacity = unitCapacity(unit, []);
    renderWard(unit.id);

    // "N beds · M free" invited the reader to take the remainder as occupied. It is
    // held + blocked + occupied, which this screen itemises separately.
    //
    // ⚠️ AN ASSERTION WAS REMOVED FROM HERE, AND SAYING SO IS THE POINT. It read
    // `expect(capacity.occupied).not.toBe(unit.beds - capacity.available)`. That cannot fail: the
    // suite is floored on `held > 0`, and `beds - available === held + blocked + occupied`, so the
    // inequality is entailed by the filter that selected the unit. A filter and an assertion over
    // the same predicate is a tautology wearing the clothes of a guard.
    const cta = screen.getByTestId("ward-hero-open-bed-list");
    expect(cta.textContent?.toLowerCase()).not.toContain("free");
    expect(cta).toHaveTextContent(`${unit.beds} beds`);
    expect(cta).toHaveTextContent(`${capacity.available} ready`);
  });
});
