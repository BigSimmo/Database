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

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { GovernanceView, auditKindLabels } from "@/components/ward-management/ward-management-modes";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE CHANGE-AUDIT PANEL MUST NAME EVERY KIND OF CHANGE IT CAN SHOW.
 *
 * 🔴 THE DEFECT. Both of its sentences listed four kinds while `auditKindLabels` held six.
 * `stage_corrected` and `acceptance_withdrawn` were added on 2026-09-04; the heading and the empty
 * state were not touched. **The empty state could therefore say "None — no ... has been recorded
 * yet" on a movement whose stage HAD been corrected** — a false statement of fact about a patient's
 * record, not merely an undercounted summary.
 *
 * ⚠️ WHY IT HAPPENED, AND IT IS THE GENERAL MECHANISM. `auditKindLabels` is a TOTAL `Record` over
 * the union, so the compiler forced whoever added the two kinds to add their labels. Nothing forced
 * the paragraph three hundred lines below it. **The compiler is inside the definition of "the code"
 * and the rendered sentence is not**, which is why a codebase this heavily guarded keeps producing
 * this class: the guards are all on the side the compiler can see.
 *
 * ⚠️ SO THE REPAIR DERIVED THE SENTENCE FROM THE MAP, AND THIS FILE GUARDS THE DERIVATION RATHER
 * THAN THE WORDS. A test pinning the new sentence would go green the moment somebody rephrased it
 * and red the moment somebody improved it, and — worse — would say nothing at all if a seventh kind
 * were added. This walks the map, so a new kind that does not reach the screen fails here.
 */

function renderGovernance() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <GovernanceView />
    </WardFlowProvider>,
  );
}

/** The labels as the sentence renders them — de-capitalised, otherwise verbatim. */
const kindWords = Object.values(auditKindLabels).map((label) => label.charAt(0).toLowerCase() + label.slice(1));

describe("the change-audit panel's description of itself", () => {
  it("walks more kinds than the broken sentence listed, or it cannot discriminate", () => {
    // THE DISCRIMINATING FLOOR. The old sentence named four. A map of four or fewer would make
    // every assertion below pass against the exact defect this file exists to reject.
    expect(
      kindWords.length,
      "the audit can produce four or fewer kinds, so a four-item sentence would be complete and " +
        "this guard proves nothing",
    ).toBeGreaterThan(4);
  });

  it("names every kind of change it can show, in the heading", () => {
    renderGovernance();
    const panel = screen.getByTestId("ward-governance-change-audit").textContent ?? "";
    for (const word of kindWords) {
      expect(
        panel,
        `the audit can record "${word}" and the panel does not say so. A reader takes this list as ` +
          "the set of things the panel would have told them about",
      ).toContain(word);
    }
  });

  it("names every kind in whichever state it is in — including the empty one", () => {
    renderGovernance();
    const panel = screen.getByTestId("ward-governance-change-audit");
    const empty = screen.queryByTestId("ward-governance-change-audit-empty");

    // The empty state is the worse of the two: a heading that undercounts is a bad summary, while
    // "nothing has been recorded yet" against a kind it does not list is a false statement.
    const text = (empty ?? panel).textContent ?? "";
    for (const word of kindWords) {
      expect(text, `the ${empty ? "empty state" : "panel"} omits "${word}"`).toContain(word);
    }
  });
});
