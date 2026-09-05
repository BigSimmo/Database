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

import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * A SENTENCE THAT POINTS AT ANOTHER PART OF THE PAGE MUST POINT THE RIGHT WAY.
 *
 * The out-of-area board's provenance paragraph explains where an arriving emergency-department
 * patient goes: they *"raise the second figure … rather than joining the list of people far from
 * home."* It said **below**. The second figure has always been rendered **above** it — `git show
 * 74253c367:<the board>` puts `.counts` at line 105 and `.provenance` at 142 in the very commit
 * that introduced the sentence, so this was wrong on arrival rather than drift, and it survived
 * every review, every DOM assertion and every print sweep since.
 *
 * ⚠️ **A DIRECTION WORD IS THE ONE PART OF A GOVERNANCE SENTENCE NO PROOFREAD CATCHES.** It is
 * correct as English and wrong only against the layout, so reading the sentence — which is what a
 * reviewer does — cannot find it. Only reading the sentence *and* the render order together can.
 *
 * ⚠️ **AND THIS GUARD DELIBERATELY DOES NOT PIN THE WORD.** Pinning `"above"` would go green on
 * the day somebody moves the counts paragraph below this one and makes the sentence false again —
 * the failure mode where a fix's guard keeps asking the fix's question after the question has
 * changed. It compares the WORD against the rendered DOM order, so either half moving alone is a
 * failure and both moving together is not.
 */

function renderBoard() {
  // `initialNow`, pinned — the provider seeds itself and only takes a clock. An earlier draft
  // here passed `initialState`, which this component does not accept: every assertion below still
  // PASSED, because vitest runs no `tsc` and React drops an unknown prop silently. The suite was
  // green on a render configured by a prop that did nothing. Caught by the typecheck, which is not
  // part of any focused run.
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <OutOfAreaBoard />
    </WardFlowProvider>,
  );
}

describe("the out-of-area board's provenance sentence points at the counts paragraph correctly", () => {
  /**
   * ⚠️ ANTI-VACUITY, ON THE POPULATION WALKED. Every assertion below reads two elements and a
   * direction word out of the rendered page; if the board stopped rendering either element, or
   * stopped using a direction word at all, the checks would have nothing to contradict them. This
   * establishes that all three inputs are present before anything is concluded from them.
   */
  it("renders both paragraphs, and the provenance sentence really does contain a direction word", () => {
    renderBoard();
    const counts = screen.getByTestId("ward-out-of-area-count-not-banded");
    const provenance = screen.getByTestId("ward-out-of-area-provenance");
    expect(counts.textContent?.trim().length, "the second figure rendered nothing").toBeGreaterThan(0);
    const text = provenance.textContent ?? "";
    const directions = text.match(/\b(above|below)\b/gu) ?? [];
    expect(
      directions,
      "the provenance sentence names no direction at all, so the check below is about nothing — " +
        "if the pointer was deliberately removed, delete this suite in the same commit rather " +
        "than leaving it passing over an absence",
    ).toHaveLength(1);
  });

  it("says `above` exactly when the second figure is rendered above it, and `below` exactly when it is below", () => {
    renderBoard();
    const counts = screen.getByTestId("ward-out-of-area-count-not-banded");
    const provenance = screen.getByTestId("ward-out-of-area-provenance");

    // `DOCUMENT_POSITION_PRECEDING` is set on the argument when it comes EARLIER in the document
    // than the node the method is called on. Read from the DOM rather than from the source file,
    // so a conditional render or a reordered fragment is measured as the reader meets it.
    const countsComesFirst = Boolean(provenance.compareDocumentPosition(counts) & Node.DOCUMENT_POSITION_PRECEDING);
    const word = (provenance.textContent ?? "").match(/\b(above|below)\b/u)?.[0];

    expect(
      word,
      countsComesFirst
        ? 'the second figure is rendered ABOVE the provenance paragraph, so the sentence must say "above"'
        : 'the second figure is rendered BELOW the provenance paragraph, so the sentence must say "below"',
    ).toBe(countsComesFirst ? "above" : "below");
  });
});
