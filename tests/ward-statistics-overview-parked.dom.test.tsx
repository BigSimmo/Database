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

import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * 🔴 **THE OVERVIEW IS PARKED, NOT ABANDONED — AND THIS IS THE TRIPWIRE THAT MAKES THE DIFFERENCE
 * CHECKABLE.**
 *
 * The owner ruled on 2026-09-05 that this page stays and will be filled in later. Today it renders
 * no figure and says so: *"No whole-of-prototype figure has been derived, so this page shows none —
 * not a nought, and not a dash standing where a number will go."*
 *
 * ⚠️ **THAT SENTENCE IS A CLAIM WITH AN EXPIRY DATE, AND NOTHING CONNECTED IT TO THE WORK THAT
 * EXPIRES IT.** The screen file says so in its own words, and names the remedy it never got:
 *
 * > A "not built yet" note is a claim with an expiry date, and nothing connects it to the work that
 * > expires it. A note of that shape belongs beside a test that goes red the day the gap closes —
 * > the pattern `tests/ward-community-index.dom.test.tsx` uses — or it does not belong in rendered
 * > prose at all.
 *
 * **This is that test.** The same file has already been caught once by exactly this shape: a
 * paragraph told readers the navigation they had just used did not exist, true the day it was
 * written and false within the session. And the comparisons screen carried "the comparison itself
 * is not built" for hours after its tables landed, found only because the owner asked a plain
 * question about which pages were finished.
 *
 * ⚠️ **IT IS A BICONDITIONAL, WHICH IS THE ONLY HONEST SHAPE FOR A TRIPWIRE.** Asserting "the note
 * is present" alone would fail on the day the page is legitimately built, which teaches whoever
 * fills it in to delete the test. Asserting "a figure is present" alone fails today for no reason.
 * **What must hold in both states is that the two agree:** the note is on the page exactly while
 * there is no figure. Fill the page in and forget the note, and this goes red naming both.
 */

function renderOverview() {
  return render(
    <WardFlowProvider>
      <StatisticsOverviewScreen />
    </WardFlowProvider>,
  );
}

/** The page's own body text, tags stripped, so a CSS Module class hash cannot pass as a figure. */
function bodyText(): string {
  return (document.body.textContent ?? "").replace(/\s+/gu, " ").trim();
}

describe("the statistics overview stays honest about being unbuilt", () => {
  /**
   * ⚠️ **THE FLOOR FIRST.** Everything below is a statement about what the page does and does not
   * contain. A page that threw, or rendered an empty shell, would satisfy the "no figure" half
   * perfectly and prove nothing at all.
   */
  it("renders a page with substantial content", () => {
    renderOverview();
    expect(bodyText().length, "the overview rendered almost nothing").toBeGreaterThan(400);
  });

  /**
   * 🔴 **THE TRIPWIRE.** Both directions in one assertion, because either alone rots.
   *
   * The "figure" test is deliberately crude — any digit in the rendered text. That is stricter than
   * it needs to be and the strictness is the point: **a page that says it derived nothing has no
   * business rendering a numeral of any kind**, and a stricter rule cannot be satisfied by rendering
   * a figure in a form the test did not anticipate.
   */
  it("carries the no-figure note exactly while it renders no figure", () => {
    renderOverview();
    const notBuilt = screen.queryByTestId("ward-statistics-overview-not-built");
    const text = bodyText();
    const digits = text.match(/\d+/gu) ?? [];

    if (notBuilt !== null) {
      expect(
        digits,
        `the overview still says no whole-of-prototype figure has been derived, and yet renders ` +
          `${digits.join(", ")}. If the page has been filled in, REMOVE THE NOTE — the sentence is a claim ` +
          `with an expiry date and this is the work that expires it`,
      ).toEqual([]);
      return;
    }

    expect(
      digits.length,
      "the no-figure note has been removed but the page renders no figure either, so a reader is " +
        "given a blank page with nothing saying why. Either restore the note or build the figures",
    ).toBeGreaterThan(0);
  });

  /**
   * The wording the note must not soften into, kept separate so its failure names the wording rather
   * than the tripwire. A nought and a dash are the two ways a page like this lies: both look
   * measured, and nobody re-checks a number that renders.
   */
  it("states the absence in words rather than as a nought or a dash", () => {
    renderOverview();
    const body = screen.queryByTestId("ward-statistics-overview-not-built-body");
    if (body === null) return; // the page has been built; the note is legitimately gone.
    const text = (body.textContent ?? "").trim();
    expect(text, "the overview's absence note carries a numeral").not.toMatch(/\d/u);
    expect(text, "the overview's absence note ends in a dash standing where a number will go").not.toMatch(
      /[—–-]\s*$/u,
    );
  });
});
