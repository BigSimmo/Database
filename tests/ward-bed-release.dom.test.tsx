import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors tests/ward-screen.dom.test.tsx: ClinicalRail renders next/link anchors and this suite
// never checks routing itself, so a plain <a> avoids requiring an App Router context jsdom cannot
// provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Task 11 (spec item 9). Before this task bed releases were static fixture data feeding the
 * `potential` capacity figure and no ward could flag one — this proves the control exists, is a
 * picker rather than free text (the binding spec §4 rule this task exists to satisfy), and that a
 * real dispatch actually moves the number shown on screen, the same "dispatch a real event and
 * read the target component again" technique `ward-screen.dom.test.tsx`'s own capacity suite uses.
 *
 * rph-adult-secure carries exactly one bed release in the fixture (WR-001) — asserted below
 * rather than assumed, so this suite fails loudly instead of silently under-covering if the
 * fixture ever changes underneath it.
 */
describe("ward bed release flag", () => {
  it("fixture assumption: rph-adult-secure starts with exactly one bed release", () => {
    expect(bedReleases.filter((release) => release.unitId === "rph-adult-secure")).toHaveLength(1);
  });

  it("renders confidence and blocker as pickers only — never a free-text field", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const form = screen.getByTestId("ward-flag-bed-release");
    // Structural proof the blocker (and confidence) is a picker, never free text: the form must
    // contain only <select> controls plus the submit button, no <input type="text"> or
    // <textarea> anywhere inside it.
    expect(within(form).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(form).getAllByRole("combobox")).toHaveLength(2);

    const confidenceSelect = screen.getByLabelText("Confidence");
    const blockerSelect = screen.getByLabelText("Blocker");
    expect(confidenceSelect.tagName).toBe("SELECT");
    expect(blockerSelect.tagName).toBe("SELECT");

    // Fix round 2 (P1): the ward's own estimate of when the bed will be free is a plain
    // `<input type="time">`, same as the leave-bed form's "Expected return" — not a picker, but
    // also never free text.
    const expectedAtInput = screen.getByLabelText("Expected free");
    expect(expectedAtInput.tagName).toBe("INPUT");
    expect(expectedAtInput).toHaveAttribute("type", "time");
  });

  it("starts with the submit button disabled until confidence is chosen, then flags a release that raises the predicted count by one", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // Baseline: the one fixture-seeded release for this unit (WR-001) is already `confirmed`, so
    // it shows as Confirmed 1, Predicted 0 — the two figures that replaced the raw, state-blind
    // "Potential 1" this screen used to show for the same release (unitCapacity()'s `potential`
    // counted every release regardless of state; capacityBreakdown() tells confirmed from
    // predicted apart).
    const bedsBefore = screen.getByTestId("ward-unit-beds");
    expect(within(bedsBefore).getByText("Confirmed 1")).toBeInTheDocument();
    expect(within(bedsBefore).getByText("Predicted 0")).toBeInTheDocument();

    const submit = screen.getByTestId("ward-flag-bed-release-submit");
    expect(submit).toBeDisabled();

    // Blocker is optional (Phase 5, spec D3: a flag with no blocker is a plain prediction, not a
    // held release) — so confidence alone is enough to enable the submit, and choosing then
    // clearing a blocker again must not leave it disabled either.
    fireEvent.change(screen.getByLabelText("Confidence"), { target: { value: "likely" } });
    expect(submit).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("Blocker"), { target: { value: "Awaiting clean" } });
    expect(submit).not.toBeDisabled();

    // The expected-free time is required for the dispatch to actually go through (the reducer's
    // own comment on `FLAG_BED_RELEASE` explains why an estimate matters), but is deliberately
    // NOT wired into the submit button's own `disabled` state — same precedent the leave-bed
    // form's "Expected return" already sets, where only `bedReleaseConfidence` gates the button.
    fireEvent.change(screen.getByLabelText("Expected free"), { target: { value: "16:30" } });

    // Clear the blocker back to "No blocker" before submitting. Spec D3 makes blocker and
    // confidence mutually exclusive on the produced record — a release flagged with a blocker is
    // written `blocked`, and `capacityBreakdown()` never counts a `blocked` release into Confirmed
    // or Predicted (see its own file-level comment). Submitting with a blocker still selected
    // would leave every figure on this screen unchanged, and this test could no longer tell a real
    // dispatch from a no-op. Confidence alone keeps the flagged release a plain prediction.
    fireEvent.change(screen.getByLabelText("Blocker"), { target: { value: "" } });

    fireEvent.click(submit);

    // After a real FLAG_BED_RELEASE dispatch updates state.bedReleases, the screen must show the
    // new live Predicted count — resolving from the frozen fixture (as `unitCapacity` did before
    // this task) would keep showing Predicted 0 forever. Confirmed is unchanged: the new release
    // is `predicted`, not `confirmed`.
    const bedsAfter = screen.getByTestId("ward-unit-beds");
    expect(within(bedsAfter).getByText("Confirmed 1")).toBeInTheDocument();
    expect(within(bedsAfter).getByText("Predicted 1")).toBeInTheDocument();

    // The form resets after a successful submit, ready for the next flag.
    expect(screen.getByTestId("ward-flag-bed-release-submit")).toBeDisabled();
  });

  it("never moves a sibling unit's own live capacity figures", () => {
    // Both surfaces share one provider instance, so a dispatch from the ward screen is read back
    // through the SAME live state the statewide capacity board reads — not a second, disconnected
    // copy that could never actually catch a unit-scoping bug.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
        <WardModeWorkspace mode="capacity" />
      </WardFlowProvider>,
    );

    // sjgm-adult-open carries no bed release in the fixture at all — asserted directly against
    // the live capacity row rather than the static fixture constant, so a scoping bug in the
    // reducer (writing the flagged release to every unit, or to the wrong one) would be caught
    // here even though it could never show up in the frozen `bedReleases` array itself. Both
    // Confirmed and Predicted are checked, not just one, since a scoping bug could leak into
    // either bucket.
    const sjgmRowBefore = screen.getByTestId("ward-capacity-row-sjgm-adult-open");
    expect(sjgmRowBefore).toHaveTextContent("0Confirmed");
    expect(sjgmRowBefore).toHaveTextContent("0Predicted");

    // No blocker: a release flagged with a blocker is written `blocked`, and capacityBreakdown()
    // never counts a `blocked` release into Confirmed or Predicted (see that file's own comment)
    // — leaving no figure on either row to move, and no way for this test to catch a scoping bug.
    // Confidence alone keeps the flagged release a plain prediction, which does move a real,
    // visible number.
    fireEvent.change(screen.getByLabelText("Confidence"), { target: { value: "likely" } });
    fireEvent.change(screen.getByLabelText("Expected free"), { target: { value: "16:30" } });
    fireEvent.click(screen.getByTestId("ward-flag-bed-release-submit"));

    // rph-adult-secure's own row moved from Predicted 0 to Predicted 1 (the same figure proved on
    // the ward screen above) — the sibling must not move at all.
    const rphRowAfter = screen.getByTestId("ward-capacity-row-rph-adult-secure");
    expect(rphRowAfter).toHaveTextContent("1Confirmed");
    expect(rphRowAfter).toHaveTextContent("1Predicted");
    const sjgmRowAfter = screen.getByTestId("ward-capacity-row-sjgm-adult-open");
    expect(sjgmRowAfter).toHaveTextContent("0Confirmed");
    expect(sjgmRowAfter).toHaveTextContent("0Predicted");
  });
});
