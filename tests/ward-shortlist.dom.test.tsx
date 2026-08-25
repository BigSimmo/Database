import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ESCALATION_CONTACTS } from "@/components/ward-management/ward-change-reasons";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Task 6 (spec item 11). WF-308 is the real fixture's own second "nowhere eligible" movement at
 * NOW_ANCHOR (WF-009 is the first, and WF-009 already carries a recorded escalation — see
 * tests/ward-escalation.test.ts and tests/ward-escalation.dom.test.tsx), so it renders the
 * escalation form's "Record escalation" path rather than "Update escalation".
 */
const TARGET_MOVEMENT_ID = "WF-308";

/**
 * Mirrors `ClockAdvancer` in ward-escalation.dom.test.tsx and `ReferFirstMovement` in
 * ward-flow-queue-selection.dom.test.tsx: a thin sibling that reads the real provider state and
 * hands it to the component under test, so the suite exercises the real reducer and the real
 * fixture rather than a hand-built movement that could silently drift from what the reducer can
 * actually produce.
 */
function ShortlistHarness() {
  const { movements, units, now, dispatch } = useWardFlow();
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  const movement = movements.find((candidate) => candidate.id === TARGET_MOVEMENT_ID);
  return (
    <ShortlistPanel
      movement={movement}
      now={now}
      units={units}
      selectedUnitId={selectedUnitId}
      onSelectUnit={setSelectedUnitId}
      dispatch={dispatch}
    />
  );
}

function renderShortlist() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ShortlistHarness />
    </WardFlowProvider>,
  );
}

/** Scopes a query to the escalation `<section>` alone, never the whole document — the override
 *  form a few sections down also carries a `<textarea>`, and this suite must never mistake that
 *  unrelated control for evidence about the escalation form specifically. */
function escalationSection(container: HTMLElement): HTMLElement {
  const section = container.querySelector('section[aria-label="Escalation"]');
  if (!(section instanceof HTMLElement)) {
    throw new Error("Escalation section not found");
  }
  return section;
}

describe("ShortlistPanel escalation contact", () => {
  it("opens a fixed picker whose options are exactly ESCALATION_CONTACTS, in order", () => {
    const { container } = renderShortlist();

    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-toggle"));

    const select = screen.getByTestId("ward-shortlist-escalation-contact");
    expect(select.tagName).toBe("SELECT");
    expect(select).toBeInstanceOf(HTMLSelectElement);

    const optionValues = Array.from((select as HTMLSelectElement).options).map((option) => option.value);
    expect(optionValues).toEqual([...ESCALATION_CONTACTS]);
    const optionText = Array.from((select as HTMLSelectElement).options).map((option) => option.textContent);
    expect(optionText).toEqual([...ESCALATION_CONTACTS]);

    // The decisive proof this task exists for: no textarea and no free-text input anywhere in
    // the escalation form, scoped so the unrelated override-reason textarea elsewhere on this
    // same panel can never satisfy this assertion by accident.
    const section = escalationSection(container);
    expect(section.querySelectorAll("textarea")).toHaveLength(0);
    expect(section.querySelectorAll('input:not([type="hidden"])')).toHaveLength(0);
  });

  it("keeps the label wording and the existing test-id on the picker", () => {
    renderShortlist();
    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-toggle"));

    const select = screen.getByLabelText(
      "Role or service being contacted next — a role or service only, never a person's name (synthetic data only)",
    );
    expect(select).toHaveAttribute("id", "ward-shortlist-escalation-contact");
    expect(select.getAttribute("data-testid")).toBe("ward-shortlist-escalation-contact");
  });

  it("dispatches RECORD_ESCALATION with one of the listed contacts, chosen from the picker", () => {
    renderShortlist();
    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-toggle"));

    const select = screen.getByTestId("ward-shortlist-escalation-contact") as HTMLSelectElement;
    const chosen = "Duty psychiatrist";
    expect(ESCALATION_CONTACTS).toContain(chosen);
    fireEvent.change(select, { target: { value: chosen } });
    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-submit"));

    // Read the real post-dispatch fact back from the movement, the same discipline every other
    // "did this really happen" assertion in this panel already holds to (`overrideSucceeded`,
    // the referral badges) — never a captured local flag.
    const record = screen.getByTestId("ward-shortlist-escalation-record");
    expect(record.textContent).toContain(`contact: "${chosen}"`);
    // The submit button re-opens as "Update escalation" once a record exists — proof the
    // dispatch actually reached the reducer and stuck, not merely that the form closed.
    expect(screen.getByTestId("ward-shortlist-escalation-toggle").textContent).toBe("Update escalation");
  });

  it("defaults the picker to the first ESCALATION_CONTACTS entry and never submits an empty value", () => {
    renderShortlist();
    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-toggle"));

    const select = screen.getByTestId("ward-shortlist-escalation-contact") as HTMLSelectElement;
    expect(select.value).toBe(ESCALATION_CONTACTS[0]);

    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-submit"));
    const record = screen.getByTestId("ward-shortlist-escalation-record");
    expect(record.textContent).toContain(`contact: "${ESCALATION_CONTACTS[0]}"`);
  });
});
