import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardBar } from "@/components/ward-management/ward-bar";

/**
 * ⚠️ A BAR IS THE EASIEST PLACE IN THIS APP TO SAY SOMETHING FALSE, which is why this primitive
 * exists at all and why most of the tests below are about what it REFUSES rather than what it
 * renders. Three screens draw the same stacked bar — the wait-time split on Delays, the locked
 * share on Capacity, the transport lifecycle on Movements — and today none of them shares a line
 * of code with the others.
 *
 * (This sentence read "two of the five tests" until 2026-09-06, when it became four of nine. **A
 * count of its own tests, typed into prose, is stale the moment anyone adds one** — the exact
 * failure this repository has recorded against commit messages, handover documents and guard
 * headers on three separate surfaces. It is now stated without a number.)
 *
 * The lies a stacked bar tells for free — the first two were guarded from the start, the second
 * two were added on 2026-09-06 after Capacity was opened in a browser:
 *
 *   1. **A band with no word.** State is worded as well as coloured everywhere in this app
 *      (`DESIGN-LANGUAGE.md` rule 2, gated in CI). A coloured band carrying meaning on its own is
 *      unreadable to anybody who cannot separate the hues, and there is no way to notice that from
 *      a screenshot.
 *   2. **An all-zero bar.** It renders as an empty grey rail, which a reader takes for a loading
 *      state rather than for "nothing is in any of these categories". The absence has to be
 *      written in words instead, so the component refuses rather than drawing it.
 *
 * Both refusals throw rather than warn: a warning in a browser console is not read by the person
 * this protects.
 */
const SPLIT = [
  { label: "Under 4 hours", value: 16, tone: "good" as const },
  { label: "4 to 12 hours", value: 19, tone: "warning" as const },
  { label: "Over 12 hours", value: 8, tone: "danger" as const },
];

describe("WardBar", () => {
  it("names every segment in words, so the bar never carries meaning in colour alone", () => {
    render(<WardBar segments={SPLIT} caption="43 people waiting" />);
    for (const segment of SPLIT) expect(screen.getByText(segment.label)).toBeInTheDocument();
  });

  it("states a zero rather than dropping it, so an absence is readable", () => {
    render(
      <WardBar segments={[...SPLIT, { label: "Over 24 hours", value: 0, tone: "danger" as const }]} caption="x" />,
    );
    expect(screen.getByText("Over 24 hours").closest("li")).toHaveTextContent("none");
  });

  it("gives the bar itself an accessible description naming every segment and its count", () => {
    render(<WardBar segments={SPLIT} caption="43 people waiting" />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "43 people waiting: Under 4 hours 16, 4 to 12 hours 19, Over 12 hours 8.",
    );
  });

  it("refuses a segment with no label, because a coloured band with no word says nothing", () => {
    expect(() => render(<WardBar segments={[{ label: "  ", value: 3, tone: "good" as const }]} caption="x" />)).toThrow(
      /needs a label/u,
    );
  });

  it("refuses a bar whose segments are all zero, which renders as an empty grey rail", () => {
    expect(() =>
      render(<WardBar segments={[{ label: "None", value: 0, tone: "rest" as const }]} caption="x" />),
    ).toThrow(/every segment is zero/u);
  });

  /*
   * 🔴 THE THIRD AND FOURTH REFUSALS, ADDED 2026-09-06, AND THEY ARE THE MIRROR OF THE ALL-ZERO ONE.
   *
   * An empty rail reads as "still loading" and this component always refused it. **A FULL rail reads
   * as "everything", and nothing refused that** — even though every stacked bar is full by
   * construction, because the segments are shares of their own sum. The fill measures nothing; only
   * the caption says what the whole rail is.
   *
   * Found by opening Capacity, not by reasoning: it drew `27 of 303 beds ready` as a full-width bar.
   * The rail divided the 27, the caption named the 303, and nine per cent availability was drawn as
   * complete on the screen whose subject is whether there are enough beds. Every test was green.
   */
  it("refuses a caption naming a total the bar does not draw, because a full rail reads as that total", () => {
    expect(() => render(<WardBar segments={SPLIT} caption="43 of 303 people waiting" />)).toThrow(
      /caption names 303, and this bar draws 43/u,
    );
  });

  it("accepts a caption naming only what it draws, so the fix for the above is not to drop the caption", () => {
    // The other half of the pair. A guard that objects to the corrected copy is one somebody deletes,
    // and "caption the bar with what it draws" has to remain expressible.
    expect(() => render(<WardBar segments={SPLIT} caption="43 people waiting" />)).not.toThrow();
  });

  it("refuses a one-segment bar, which fills the rail whatever its value", () => {
    expect(() =>
      render(
        <WardBar segments={[{ label: "Freeing today", value: 8, tone: "accent" as const }]} caption="8 beds freeing" />,
      ),
    ).toThrow(/at least two segments/u);
  });

  it("still accepts a multi-category bar where only one category is occupied today", () => {
    /*
     * ⚠️ THE DISCRIMINATION THAT MATTERS, AND THE REASON THE CHECK COUNTS SEGMENTS DECLARED RATHER
     * THAN SEGMENTS DRAWN. "Everything is in one category today" is a real and useful thing for a bar
     * to say — Movements draws exactly that shape when every transport leg is booked. A guard counting
     * drawn segments would refuse it, and refusing a true statement is how a guard gets deleted.
     */
    expect(() =>
      render(
        <WardBar
          segments={[
            { label: "Booked", value: 8, tone: "accent" as const },
            { label: "En route", value: 0, tone: "warning" as const },
            { label: "Arrived", value: 0, tone: "good" as const },
          ]}
          caption="8 transport legs booked or moving"
        />,
      ),
    ).not.toThrow();
  });
});
