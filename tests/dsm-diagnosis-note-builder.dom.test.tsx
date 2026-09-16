import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { DsmDiagnosisNoteBuilder } from "@/components/dsm/dsm-diagnosis-note-builder";
import { dsmDiagnoses } from "@/lib/dsm";
import { dsmNoteBuilderRecord } from "@/lib/dsm-note";

afterEach(cleanup);

const panic = dsmNoteBuilderRecord(dsmDiagnoses.find((diagnosis) => diagnosis.slug === "panic-disorder")!);
// Panic disorder supplies no `criteria_display`, as 145 of the 146 records do
// not, so every row here is the record's key-feature summary and the builder
// says so. `bipolarTwo` is the one record that really carries criteria.
const bipolarTwo = dsmNoteBuilderRecord(dsmDiagnoses.find((diagnosis) => diagnosis.slug === "bipolar-ii-disorder")!);

function markCriterion(label: string, choice: string, noun = "Key feature") {
  const group = screen.getByRole("radiogroup", { name: `${noun} ${label}` });
  return within(group).getByRole("radio", { name: choice });
}

describe("DsmDiagnosisNoteBuilder", () => {
  it("offers nothing to copy until a criterion is recorded", () => {
    render(<DsmDiagnosisNoteBuilder record={panic} />);
    expect(screen.getByText("Mark at least one key feature to build the note.")).toBeTruthy();
    expect(screen.queryByTestId("dsm-note-output")).toBeNull();
  });

  it("builds a note from the rows marked and names the rest as not assessed", async () => {
    const user = userEvent.setup();
    render(<DsmDiagnosisNoteBuilder record={panic} />);

    await user.click(markCriterion("A", "Met"));
    await user.click(markCriterion("B", "Met"));

    const note = screen.getByTestId("dsm-note-output").textContent ?? "";
    expect(note).toContain("Panic disorder (F41.0)");
    expect(note).toContain("Key features present (A, B):");
    expect(note).toContain("Not assessed (C, D):");
    // The wall-of-prose template asserted every symptom; the built note must not.
    expect(note).not.toContain("palpitations");
  });

  it("writes threshold characters in a form a record system can display", async () => {
    const user = userEvent.setup();
    render(<DsmDiagnosisNoteBuilder record={panic} />);
    await user.click(markCriterion("A", "Met"));

    const note = screen.getByTestId("dsm-note-output").textContent ?? "";
    expect(note).toContain("at least 4 of 13 symptoms");
    expect(note).not.toContain("≥");
    expect(note).not.toContain(";");
  });

  it("records a row the clinician actively ruled out", async () => {
    const user = userEvent.setup();
    render(<DsmDiagnosisNoteBuilder record={panic} />);
    await user.click(markCriterion("A", "Met"));
    await user.click(markCriterion("C", "Not met"));

    const note = screen.getByTestId("dsm-note-output").textContent ?? "";
    expect(note).toContain("Key features absent (C):");
  });

  it("adds only the differentials that were ticked", async () => {
    const user = userEvent.setup();
    render(<DsmDiagnosisNoteBuilder record={panic} />);
    await user.click(markCriterion("A", "Met"));
    await user.click(screen.getByRole("checkbox", { name: /^GAD/ }));

    const note = screen.getByTestId("dsm-note-output").textContent ?? "";
    expect(note).toContain("Differentials considered and excluded: GAD");
    expect(note).not.toContain("Agoraphobia");
  });

  it("names the rows criteria, and the basis DSM-5-TR, only where the record supplies criteria", async () => {
    const user = userEvent.setup();
    render(<DsmDiagnosisNoteBuilder record={bipolarTwo} />);
    await user.click(markCriterion("A", "Met", "Criterion"));

    const note = screen.getByTestId("dsm-note-output").textContent ?? "";
    expect(note).toContain("Criteria met (A):");
    expect(note).toContain("Recorded against DSM-5-TR criteria.");
    expect(note).not.toContain("key feature summary");
  });

  it("states a key-feature basis in the note built from a record without criteria", async () => {
    const user = userEvent.setup();
    render(<DsmDiagnosisNoteBuilder record={panic} />);
    await user.click(markCriterion("A", "Met"));

    const note = screen.getByTestId("dsm-note-output").textContent ?? "";
    expect(note).toContain("not the full DSM-5-TR criteria");
    expect(note).not.toContain("Criteria met");
  });

  it("offers no specifier tick box for a record that has none", () => {
    render(<DsmDiagnosisNoteBuilder record={panic} />);
    expect(screen.getByText("No single-value specifiers in this record. Type any that apply below.")).toBeTruthy();
  });

  it("clears every recorded answer on start over", async () => {
    const user = userEvent.setup();
    render(<DsmDiagnosisNoteBuilder record={panic} />);
    await user.click(markCriterion("A", "Met"));
    expect(screen.getByTestId("dsm-note-output")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.queryByTestId("dsm-note-output")).toBeNull();
    expect(markCriterion("A", "Met").getAttribute("aria-checked")).toBe("false");
  });
});
