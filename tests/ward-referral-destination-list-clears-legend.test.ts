// tests/ward-referral-destination-list-clears-legend.test.ts
//
// 🔴 THE DEFECT. `referrals.module.css` floats the question-card legend —
// `.choiceCard > .fieldLegend { float: left; width: 100% }` — so any block sibling that follows it
// without `clear` is laid out BESIDE a float occupying the entire line. `.destinationList` had no
// `clear`, computed to ZERO width, and its three destination cards were pushed 93px past the right
// edge of a 1440px viewport. The page does not scroll horizontally, so they could not be reached.
//
// ⚠️ THAT CONTROL IS "Where to refer — choose up to 3, in one act". It is the control that decides
// where the patient goes. A clinician could complete every field on the form and never reach it, so
// the referral form could be filled in and not completed. `.choiceRow` already carried `clear: both`
// for exactly this reason, which is why the Yes/No cards were fine and the fault read as cosmetic.
//
// ⚠️ WHAT THIS TEST CAN AND CANNOT SEE, STATED RATHER THAN IMPLIED. It reads the CSS source. It
// CANNOT measure layout — jsdom performs none, so a DOM test would have reported both the broken and
// the fixed page as identical, and would have passed against the defect. The real measurement was
// taken in a browser against the running app (0px -> 1283px). This file exists to stop the rule
// being deleted again, not to re-measure the layout; a Playwright assertion on the rendered width
// would be the stronger guard and belongs with the ward journey specs.
//
// ⚠️ AND IT IS FLOORED ON THE PRECONDITION, which is the half that keeps it honest. The `clear` is
// only required BECAUSE the legend floats. If somebody stops floating the legend, this guard is
// asserting something that no longer matters — so it checks the float first and fails with that
// explanation rather than silently guarding a dead invariant.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const CSS = readFileSync("src/components/ward-management/referrals/referrals.module.css", "utf8");

/** The declarations inside one rule, by selector, with comments stripped so prose cannot satisfy a check. */
function bodyOf(selector: string): string {
  const withoutComments = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = withoutComments.match(new RegExp(`(^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "m"));
  return match ? match[2] : "";
}

describe("the referral form's destination list clears the floated legend", () => {
  it("PRECONDITION: the question-card legend is still floated", () => {
    const legend = bodyOf(".choiceCard > .fieldLegend");
    expect(legend, "the `.choiceCard > .fieldLegend` rule has gone — this guard's premise with it").not.toBe("");
    expect(
      legend,
      "the legend no longer floats, so `clear` is no longer load-bearing and this file is guarding " +
        "an invariant that has stopped existing. Delete it, or re-derive what the layout now needs.",
    ).toMatch(/float\s*:\s*left/);
  });

  it("the destination list clears it, so it is not squeezed to zero width beside the float", () => {
    expect(
      bodyOf(".destinationList"),
      'without `clear`, "Where to refer" computes to zero width and its options render off the right ' +
        "edge of the viewport, unreachable — the control that sends the referral",
    ).toMatch(/clear\s*:\s*both/);
  });

  it("so does the sibling that always did, so the two cannot drift apart", () => {
    // `.choiceRow` is the Yes/No row. It was correct all along; pinning it is what makes the pair a
    // rule about floated-legend siblings rather than a one-off patch on the list that broke.
    expect(bodyOf(".choiceRow")).toMatch(/clear\s*:\s*both/);
  });
});
