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
  });

  it("starts with the submit button disabled until confidence is chosen, then flags a release that raises potential by one", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // Baseline: one fixture-seeded release for this unit already shows as Potential 1.
    const bedsBefore = screen.getByTestId("ward-unit-beds");
    expect(within(bedsBefore).getByText("Potential 1")).toBeInTheDocument();

    const submit = screen.getByTestId("ward-flag-bed-release-submit");
    expect(submit).toBeDisabled();

    // Blocker is optional (Phase 5, spec D3: a flag with no blocker is a plain prediction, not a
    // held release) — so confidence alone is enough to enable the submit.
    fireEvent.change(screen.getByLabelText("Confidence"), { target: { value: "likely" } });
    expect(submit).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("Blocker"), { target: { value: "Awaiting clean" } });
    expect(submit).not.toBeDisabled();

    fireEvent.click(submit);

    // After a real FLAG_BED_RELEASE dispatch updates state.bedReleases, the screen must show the
    // new live count — resolving from the frozen fixture (as `unitCapacity` did before this task)
    // would keep showing Potential 1 forever.
    const bedsAfter = screen.getByTestId("ward-unit-beds");
    expect(within(bedsAfter).getByText("Potential 2")).toBeInTheDocument();

    // The form resets after a successful submit, ready for the next flag.
    expect(screen.getByTestId("ward-flag-bed-release-submit")).toBeDisabled();
  });

  it("never moves a sibling unit's own live potential count", () => {
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
    // here even though it could never show up in the frozen `bedReleases` array itself.
    const sjgmRowBefore = screen.getByTestId("ward-capacity-row-sjgm-adult-open");
    expect(sjgmRowBefore).toHaveTextContent("0Potential");

    fireEvent.change(screen.getByLabelText("Confidence"), { target: { value: "likely" } });
    fireEvent.change(screen.getByLabelText("Blocker"), { target: { value: "Awaiting pharmacy" } });
    fireEvent.click(screen.getByTestId("ward-flag-bed-release-submit"));

    // rph-adult-secure's own row moved to Potential 2 (the same figure proved on the ward screen
    // above) — the sibling must not.
    const rphRowAfter = screen.getByTestId("ward-capacity-row-rph-adult-secure");
    expect(rphRowAfter).toHaveTextContent("2Potential");
    const sjgmRowAfter = screen.getByTestId("ward-capacity-row-sjgm-adult-open");
    expect(sjgmRowAfter).toHaveTextContent("0Potential");
  });
});
