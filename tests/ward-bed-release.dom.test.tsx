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
import { BED_PREPARATION_NOTES, BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { BED_RELEASE_WAITING_ON } from "@/components/ward-management/ward-model";
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

  it("renders waiting-on and blocker as pickers only — never a free-text field", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const form = screen.getByTestId("ward-flag-bed-release");
    // Structural proof the blocker (and the waiting-on value) is a picker, never free text: the form must
    // contain only <select> controls plus the submit button, no <input type="text"> or
    // <textarea> anywhere inside it.
    expect(within(form).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(form).getAllByRole("combobox")).toHaveLength(2);

    // The Q1 axis change (2026-08-28): this control asked "Confidence" and now asks "Waiting on".
    // Both the old label and the old values are asserted GONE, so a half-finished migration that
    // relabelled the picker while still offering `likely`/`possible` fails here.
    const waitingOnSelect = screen.getByLabelText("Waiting on");
    const blockerSelect = screen.getByLabelText("Blocker");
    expect(waitingOnSelect.tagName).toBe("SELECT");
    expect(blockerSelect.tagName).toBe("SELECT");
    expect(screen.queryByLabelText("Confidence")).toBeNull();

    // Every offered option is a member of the owner-approved list, in its exact words — and
    // "Nothing outstanding" is asserted present by name, because it is the one that lets a ward
    // record a prediction with no obstacle instead of naming one that does not exist.
    const waitingOnOptions = within(waitingOnSelect)
      .getAllByRole("option")
      .map((option) => option.textContent)
      .filter((text): text is string => text !== null && text !== "Choose what it is waiting on");
    expect(waitingOnOptions).toEqual([...BED_RELEASE_WAITING_ON]);
    expect(waitingOnOptions).toContain("Nothing outstanding");

    // List 1 (2026-08-28) added an eighth blocker. The picker offers the whole list verbatim —
    // an entry present in the constant but missing from the screen is a ward unable to record the
    // real reason, which is the failure the addition exists to prevent.
    const blockerOptions = within(blockerSelect)
      .getAllByRole("option")
      .map((option) => option.textContent)
      .filter((text): text is string => text !== null && text !== "No blocker");
    expect(blockerOptions).toEqual([...BED_RELEASE_BLOCKERS]);
    expect(blockerOptions).toContain("Awaiting family or carer arrangement");

    // Fix round 2 (P1): the ward's own estimate of when the bed will be free is a plain
    // `<input type="time">`, same as the leave-bed form's "Expected return" — not a picker, but
    // also never free text.
    const expectedAtInput = screen.getByLabelText("Expected free");
    expect(expectedAtInput.tagName).toBe("INPUT");
    expect(expectedAtInput).toHaveAttribute("type", "time");
  });

  it("starts with the submit button disabled until a waiting-on value is chosen, then flags a release that raises the predicted count by one", () => {
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
    // held release) — so the waiting-on value alone is enough to enable the submit, and choosing
    // then clearing a blocker again must not leave it disabled either.
    fireEvent.change(screen.getByLabelText("Waiting on"), { target: { value: "Nothing outstanding" } });
    expect(submit).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("Blocker"), { target: { value: "Awaiting clean" } });
    expect(submit).not.toBeDisabled();

    // The expected-free time is required for the dispatch to actually go through (the reducer's
    // own comment on `FLAG_BED_RELEASE` explains why an estimate matters), but is deliberately
    // NOT wired into the submit button's own `disabled` state — same precedent the leave-bed
    // form's "Expected return" already sets, where only `bedReleaseWaitingOn` gates the button.
    fireEvent.change(screen.getByLabelText("Expected free"), { target: { value: "16:30" } });

    // Clear the blocker back to "No blocker" before submitting. This dates from spec D3, when a
    // blocker made the produced record `blocked` and `capacityBreakdown()` counted it into
    // neither Confirmed nor Predicted — submitting with a blocker selected would then have left
    // every figure unchanged and this test could not tell a real dispatch from a no-op. The
    // 2026-08-28 rework made the flag a cross-cut, so a blocked prediction now DOES move
    // Predicted; the clear is kept anyway so the figure this test reads has exactly one cause.
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

    // No blocker, for the reason the previous test's own comment gives: it keeps the moved figure
    // attributable to exactly one cause. A plain prediction moves a real, visible number.
    fireEvent.change(screen.getByLabelText("Waiting on"), { target: { value: "Awaiting ward round" } });
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

/**
 * List 3 (2026-08-28): what a RELEASED bed is being made ready for. Until the owner supplied
 * `BED_PREPARATION_NOTES` this array was empty, so no picker shipped and nothing here could be
 * tested — the note existed as a field nobody could set.
 *
 * The second test in this block is the one that matters. **A bed being made ready must stay
 * offered, stay counted, and stay allocatable**, which is the owner's own clinical answer to Q4:
 * pulling the next patient takes hours anyway, so withholding the bed would invent a delay that
 * does not exist. It is proved through the LIVE screen rather than by calling `capacityBreakdown`
 * directly, because a gate added in the rendering layer would pass a pure-function test.
 */
describe("ward bed preparation note", () => {
  it("fixture assumption: arm-adult-open starts with exactly one released bed, already being made ready", () => {
    const released = bedReleases.filter(
      (release) => release.unitId === "arm-adult-open" && release.state === "released",
    );
    expect(released).toHaveLength(1);
    expect(released[0]?.preparing).toBe(true);
  });

  it("offers the owner-approved notes as a picker only — never free text — and shows the one already recorded", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="arm-adult-open" />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-bed-preparation-note-WR-008")).toHaveTextContent("Being cleaned");

    fireEvent.click(screen.getByTestId("ward-bed-preparation-toggle-WR-008"));
    const form = screen.getByTestId("ward-bed-preparation-form-WR-008");
    // Chosen, never typed — the same structural proof the flag form above uses.
    expect(within(form).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(form).queryAllByRole("combobox")).toHaveLength(1);

    const select = screen.getByLabelText("What this bed is waiting on");
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent)
      .filter((text): text is string => text !== null && text !== "Choose what it is waiting on");
    // Verbatim, in the owner's own order. A length check would pass a silently reworded entry.
    expect(options).toEqual([...BED_PREPARATION_NOTES]);
  });

  it("never lets a preparation note change a bed figure — the bed stays offered on the ward screen AND on the capacity board", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="arm-adult-open" />
        <WardModeWorkspace mode="capacity" />
      </WardFlowProvider>,
    );

    // Clear the flag first so `before` and `after` genuinely differ in the field under test. The
    // fixture already marks WR-008 as being made ready, and comparing "preparing" against
    // "preparing" would subtract the same bed from both sides of a gating implementation and pass
    // while proving nothing — the exact near-miss recorded in the bed-model rework report.
    fireEvent.click(screen.getByTestId("ward-bed-preparation-finish-WR-008"));
    const wardBefore = screen.getByTestId("ward-unit-beds").textContent;
    const boardBefore = screen.getByTestId("ward-capacity-bed-states-arm-adult-open").textContent;
    // Non-vacuity: this unit really does have a bed to withhold, so a gating implementation had
    // somewhere to go wrong.
    expect(wardBefore).toMatch(/Ready [1-9]/);

    fireEvent.click(screen.getByTestId("ward-bed-preparation-toggle-WR-008"));
    fireEvent.change(screen.getByLabelText("What this bed is waiting on"), {
      target: { value: "Awaiting maintenance or repair" },
    });
    fireEvent.click(screen.getByTestId("ward-bed-preparation-submit-WR-008"));

    // The note really was recorded — otherwise the comparison below would be comparing a screen
    // against itself and would pass however the figures were computed.
    expect(screen.getByTestId("ward-bed-preparation-note-WR-008")).toHaveTextContent("Awaiting maintenance or repair");
    expect(screen.getByTestId("ward-unit-beds").textContent).toBe(wardBefore);
    expect(screen.getByTestId("ward-capacity-bed-states-arm-adult-open").textContent).toBe(boardBefore);
  });
});
