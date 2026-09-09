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
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { BED_PREPARATION_NOTES, BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { BED_RELEASE_WAITING_ON } from "@/components/ward-management/ward-model";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** The Freeing cell of one ward's row on the live Capacity board. */
function freeingCell(unitId: string): HTMLElement {
  const table = screen.getByTestId("ward-capacity-network-table");
  const row = within(table).getByTestId(`ward-capacity-network-row-${unitId}`);
  return within(row).getByTestId("ward-capacity-network-freeing");
}

/**
 * The Ready FIGURE alone, with the "N still being made ready" note beside it removed.
 *
 * ⚠️ Owner ruling 2026-09-05: the cleaning count sits BESIDE the figure and the figure itself does
 * not move. Reading the cell's whole `textContent` would conflate the two, so a test meaning "the
 * number did not move" would go red the moment that note legitimately appeared or disappeared.
 */
function readyFigure(unitId: string): string {
  const table = screen.getByTestId("ward-capacity-network-table");
  const row = within(table).getByTestId(`ward-capacity-network-row-${unitId}`);
  const cell = within(row).getByTestId("ward-capacity-network-ready");
  const pending = within(cell).queryByTestId("ward-capacity-network-pending");
  const whole = cell.textContent ?? "";
  return pending ? whole.replace(pending.textContent ?? "", "") : whole;
}

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

  it("starts with the submit button disabled until a waiting-on value is chosen, then flags a release that raises the expected count by one", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // Baseline: the one fixture-seeded release for this unit (WR-001) is already `confirmed`, so
    // it shows as Confirmed 1, Expected 0 — the two figures that replaced the raw, state-blind
    // "Potential 1" this screen used to show for the same release (unitCapacity()'s `potential`
    // counted every release regardless of state; capacityBreakdown() tells confirmed from
    // expected apart).
    const bedsBefore = screen.getByTestId("ward-unit-beds");
    expect(within(bedsBefore).getByText("Confirmed 1")).toBeInTheDocument();
    expect(within(bedsBefore).getByText("Expected 0")).toBeInTheDocument();

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
    // neither Confirmed nor Expected — submitting with a blocker selected would then have left
    // every figure unchanged and this test could not tell a real dispatch from a no-op. The
    // 2026-08-28 rework made the flag a cross-cut, so a blocked prediction now DOES move
    // Expected; the clear is kept anyway so the figure this test reads has exactly one cause.
    fireEvent.change(screen.getByLabelText("Blocker"), { target: { value: "" } });

    fireEvent.click(submit);

    // After a real FLAG_BED_RELEASE dispatch updates state.bedReleases, the screen must show the
    // new live Expected count — resolving from the frozen fixture (as `unitCapacity` did before
    // this task) would keep showing Expected 0 forever. Confirmed is unchanged: the new release
    // is `expected`, not `confirmed`.
    const bedsAfter = screen.getByTestId("ward-unit-beds");
    expect(within(bedsAfter).getByText("Confirmed 1")).toBeInTheDocument();
    expect(within(bedsAfter).getByText("Expected 1")).toBeInTheDocument();

    // The form resets after a successful submit, ready for the next flag.
    expect(screen.getByTestId("ward-flag-bed-release-submit")).toBeDisabled();
  });

  /*
   * 🔴 **RE-POINTED AT `CapacityScreen` ON 2026-09-05.** This case rendered `<WardModeWorkspace
   * mode="capacity" />`, a mode MERGE 02 replaced and no route reaches any more, so it passed
   * forever over a screen no coordinator can open.
   *
   * **The clinical property is unit scoping and it is unchanged:** a bed release flagged by ONE
   * ward must move that ward own expected-to-free figure and no other ward. A reducer writing the
   * release to every unit, or to the wrong one, is the defect — and on a statewide board it reads
   * as a promise about a bed that does not exist.
   *
   * ⚠️ **THE COLUMN CHANGED AND THE ASSERTIONS FOLLOW IT.** The old board carried a per-row
   * Confirmed/Expected release breakdown; `CapacityScreen` carries a single "Freeing" cell, fed by
   * `networkWardRows(units, now, bedReleases)`. That cell renders `undefined` as the words "Not
   * tracked here" rather than a digit, so the sibling zero below is asserted as the honest `0` the
   * derivation actually returns — never as an absence, which would pass with the column dead.
   */
  /*
   * 🔴 **CARRIED HERE FROM `ward-capacity-view.dom.test.tsx` ON 2026-09-05, AND THE HOLE IT CLOSES
   * IS THE MOST SERIOUS FOUND IN THIS PASS.**
   *
   * That file pins what its own comment calls *"THE single most important rule in the phase: a
   * expected release must never soften Available now — a coordinator must always be able to point
   * at that number and say 'that is a bed I can fill this minute'."* It pinned it against
   * `<WardModeWorkspace mode="capacity" />`, which MERGE 02 replaced, so it has been passing over a
   * screen no coordinator can open.
   *
   * ⚠️ **MEASURED 2026-09-05: NOTHING IN THE REPOSITORY GUARDED THAT RULE ON ANY LIVE SCREEN.**
   * Mutating `ward-screen.tsx` to render `Ready {capacity.available - breakdown.expectedToday}` —
   * an expected discharge silently reducing the ward's ready-bed count — was run against all 41
   * test files that render `WardScreen` or touch `unitCapacity`/`capacityBreakdown`:
   * **714 passed, 1 expected fail, nothing red.** Source hash `d86f1549` before and after.
   *
   * ⚠️ **AND THE MUTATION WAS LIVE, WHICH IS THE HALF THAT IS EASY TO SKIP.** A mutation that
   * changes no rendered output is indistinguishable from one the assertions cannot detect, and it
   * invents a defect rather than missing one. Probed against the fixture: of the five units these
   * suites render, `bty-adult-secure` and `scgh-adult-open` both carry `ready=2, expectedToday=1`,
   * so both rendered `Ready 1` where they should read `Ready 2`. The figure moved on two screens
   * and not one assertion anywhere noticed.
   *
   * This is the ward's own screen, with the ward's own flagging control, so the whole rule is
   * exercised end to end: a real `FLAG_BED_RELEASE` from the form a ward actually uses.
   */
  it("never lets a expected release soften the Ready figure, while Expected itself moves by one", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    const readBedFigure = (label: string) => {
      const beds = screen.getByTestId("ward-unit-beds");
      // ⚠️ The Ready chip may carry an "N still being made ready" note beside its figure (owner
      // ruling 2026-09-05). Matched on the figure prefix rather than an exact-tail regex so the
      // note's presence or absence cannot decide whether this helper finds the chip at all.
      const chip = within(beds)
        .getAllByText(new RegExp(`^${label} \\d+`, "u"))
        .at(0);
      expect(chip, `no "${label} <n>" chip in this ward's bed grid`).toBeDefined();
      const pending = within(chip as HTMLElement).queryByTestId("ward-unit-beds-pending");
      const whole = (chip!.textContent ?? "").replace(pending?.textContent ?? "\u0000", "");
      const parsed = Number(whole.replace(`${label} `, "").trim());
      expect(Number.isNaN(parsed), `"${chip!.textContent}" did not parse`).toBe(false);
      return parsed;
    };

    const readyBefore = readBedFigure("Ready");
    const expectedBefore = readBedFigure("Expected");
    /*
     * ⚠️ Floored, not assumed. If this ward had no ready bed, subtracting from the figure could
     * not change it and the assertion below would pass on the very defect it exists for.
     */
    expect(readyBefore, "this ward shows no ready bed, so nothing could be softened away").toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Waiting on"), { target: { value: "Awaiting ward round" } });
    fireEvent.change(screen.getByLabelText("Expected free"), { target: { value: "16:30" } });
    fireEvent.click(screen.getByTestId("ward-flag-bed-release-submit"));

    /*
     * The dispatch really landed — Expected rose by exactly one — so the Ready assertion below
     * proves real separation between the two figures rather than merely that the click did nothing.
     */
    expect(readBedFigure("Expected"), "the flag did not reach the reducer at all").toBe(expectedBefore + 1);

    expect(
      readBedFigure("Ready"),
      "a bed predicted to free later today has been subtracted from the beds this ward can fill NOW. " +
        "Ready is the number a coordinator commits a patient against; a discharge that has not happened " +
        "must never move it.",
    ).toBe(readyBefore);
  });

  it("never moves a sibling unit's own live capacity figures", () => {
    // Both surfaces share one provider instance, so a dispatch from the ward screen is read back
    // through the SAME live state the statewide capacity board reads — not a second, disconnected
    // copy that could never actually catch a unit-scoping bug.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
        <CapacityScreen />
      </WardFlowProvider>,
    );

    // sjgm-adult-open carries no bed release in the fixture at all — asserted directly against the
    // live capacity row rather than the static fixture constant, so a scoping bug in the reducer
    // (writing the flagged release to every unit, or to the wrong one) would be caught here even
    // though it could never show up in the frozen `bedReleases` array itself.
    expect(freeingCell("sjgm-adult-open")).toHaveTextContent("0");
    const rphBefore = freeingCell("rph-adult-secure").textContent;

    // No blocker, for the reason the previous test's own comment gives: it keeps the moved figure
    // attributable to exactly one cause. A plain prediction moves a real, visible number.
    fireEvent.change(screen.getByLabelText("Waiting on"), { target: { value: "Awaiting ward round" } });
    fireEvent.change(screen.getByLabelText("Expected free"), { target: { value: "16:30" } });
    fireEvent.click(screen.getByTestId("ward-flag-bed-release-submit"));

    /*
     * ⚠️ The acting ward's own figure MUST have moved, and that is asserted BEFORE the sibling is
     * checked. Without it, a change that killed the whole Freeing column would leave the sibling
     * reading 0 and this case green — proving scoping by proving nothing happened anywhere.
     */
    const rphAfter = freeingCell("rph-adult-secure").textContent;
    expect(rphAfter, "the flagging ward's own expected-to-free figure did not move at all").not.toBe(rphBefore);

    expect(
      freeingCell("sjgm-adult-open"),
      "sjgm-adult-open flagged nothing; a release raised at another ward must not appear on its row",
    ).toHaveTextContent("0");
  });
});

/**
 * List 3 (2026-08-28): what a DISCHARGED bed is being made ready for. Until the owner supplied
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
      (release) => release.unitId === "arm-adult-open" && release.state === "discharged",
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

  /*
   * 🔴 **RE-POINTED AT `CapacityScreen` ON 2026-09-05**, for the same reason as the sibling-scoping
   * case above: the mode this rendered is unreachable.
   *
   * **The owner's clinical answer to Q4 is what is guarded, and it is unchanged:** a bed being made
   * ready must stay offered, stay counted and stay allocatable, because pulling the next patient
   * takes hours anyway and withholding the bed would invent a delay that does not exist.
   *
   * ⚠️ **THE ASSERTION IS NOW SHARPER THAN A `textContent` COMPARISON, AND IT HAD TO BE.** On this
   * screen the Ready cell carries the ruling of 2026-09-05 — the figure, and BESIDE it the count
   * still being made ready. Comparing the cell's whole text would go red when that cleaning count
   * legitimately changed, which is the ruling working rather than a defect. So the READY FIGURE is
   * read apart from the note beside it, because the figure is what the owner ruled must not move.
   */
  it("never lets a preparation note change a bed figure — the bed stays offered on the ward screen AND on the capacity board", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="arm-adult-open" />
        <CapacityScreen />
      </WardFlowProvider>,
    );

    // Clear the flag first so `before` and `after` genuinely differ in the field under test. The
    // fixture already marks WR-008 as being made ready, and comparing "preparing" against
    // "preparing" would subtract the same bed from both sides of a gating implementation and pass
    // while proving nothing — the exact near-miss recorded in the bed-model rework report.
    fireEvent.click(screen.getByTestId("ward-bed-preparation-finish-WR-008"));
    /*
     * ⚠️ **THE READY FIGURE, NOT THE WHOLE GRID.** This compared `ward-unit-beds`.textContent before
     * and after, and went red on 2026-09-06 the moment the Ready chip began carrying the owner's
     * "N still being made ready" note beside its figure — because recording a preparation note is
     * exactly what makes that note appear. **The test was pinning the rendering; the claim is that
     * the FIGURE does not move.** A whole-grid comparison cannot tell the ruling working from the
     * defect it forbids, and the tempting repair — deleting the assertion — would have dropped the
     * owner's Q4 answer entirely.
     */
    const wardReadyFigure = () => {
      const beds = screen.getByTestId("ward-unit-beds");
      const chip = within(beds)
        .getAllByText(/^Ready \d+/u)
        .at(0) as HTMLElement;
      const pending = within(chip).queryByTestId("ward-unit-beds-pending");
      return (chip.textContent ?? "").replace(pending?.textContent ?? "\u0000", "").trim();
    };
    const wardBefore = wardReadyFigure();
    const readyBefore = readyFigure("arm-adult-open");
    // Non-vacuity: this unit really does have a bed to withhold, so a gating implementation had
    // somewhere to go wrong.
    expect(wardBefore, "this ward shows no ready bed, so a gating implementation had nowhere to go wrong").toMatch(
      /^Ready [1-9]/u,
    );
    expect(readyBefore, "arm-adult-open shows no ready bed on the board, so nothing could be withheld").toMatch(
      /^[1-9]/u,
    );

    fireEvent.click(screen.getByTestId("ward-bed-preparation-toggle-WR-008"));
    fireEvent.change(screen.getByLabelText("What this bed is waiting on"), {
      target: { value: "Awaiting maintenance or repair" },
    });
    fireEvent.click(screen.getByTestId("ward-bed-preparation-submit-WR-008"));

    // The note really was recorded — otherwise the comparison below would be comparing a screen
    // against itself and would pass however the figures were computed.
    expect(screen.getByTestId("ward-bed-preparation-note-WR-008")).toHaveTextContent("Awaiting maintenance or repair");
    expect(
      wardReadyFigure(),
      "recording a preparation note moved this ward's Ready figure. The owner ruled the bed stays " +
        "offered, stays counted and stays allocatable — the cleaning count sits BESIDE the number.",
    ).toBe(wardBefore);
    /*
     * And the other half of that ruling, which is new: the note must actually APPEAR. Without this,
     * a change that silently stopped rendering the cleaning count would leave the figure unmoved and
     * pass — proving the ruling's first half by discarding its second.
     */
    expect(
      screen.getByTestId("ward-unit-beds-pending"),
      "the ward recorded a preparation note and nothing on its own screen says a bed is being made ready",
    ).toBeInTheDocument();
    expect(
      readyFigure("arm-adult-open"),
      "a preparation note moved the board's Ready figure; the owner ruled that the number does not move",
    ).toBe(readyBefore);
  });
});
