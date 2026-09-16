import { describe, expect, it } from "vitest";

import { mergeOnCallEditorDetails } from "@/lib/on-call/editor-details";
import { ROLE_EXPLAINER_KIND } from "@/lib/on-call/who-is-who";

describe("mergeOnCallEditorDetails", () => {
  it("keeps a role explainer's kind when the form only sent the fields it owns", () => {
    const merged = mergeOnCallEditorDetails({
      section: "contacts",
      formDetails: { role: "Registrar", phone: "0412 000 000" },
      existingDetails: { role: "Registrar", kind: ROLE_EXPLAINER_KIND },
    });
    expect(merged.kind).toBe(ROLE_EXPLAINER_KIND);
    expect(merged.role).toBe("Registrar");
    expect(merged.phone).toBe("0412 000 000");
  });

  it("writes the discriminator when creating from Who's who", () => {
    const merged = mergeOnCallEditorDetails({
      section: "contacts",
      formDetails: { role: "Consultant" },
      roleExplainer: true,
    });
    expect(merged.kind).toBe(ROLE_EXPLAINER_KIND);
  });

  it("strips the discriminator when the owner unmarks a role explainer", () => {
    const merged = mergeOnCallEditorDetails({
      section: "contacts",
      formDetails: { role: "Registrar" },
      existingDetails: { role: "Registrar", kind: ROLE_EXPLAINER_KIND },
      roleExplainer: false,
    });
    expect(merged.kind).toBeUndefined();
  });

  it("does not invent a kind on an ordinary contact create", () => {
    const merged = mergeOnCallEditorDetails({
      section: "contacts",
      formDetails: { role: "Switchboard" },
    });
    expect(merged.kind).toBeUndefined();
  });

  it("keeps an orientation checklist the form has no input for", () => {
    const checklist = [{ text: "Collect the phone" }, { text: "Hand back the keycard" }];
    const merged = mergeOnCallEditorDetails({
      section: "orientation",
      formDetails: { pinnedSummaryIsOwnerNote: true },
      existingDetails: { pinnedSummaryIsOwnerNote: true, checklist },
    });
    expect(merged.checklist).toEqual(checklist);
    expect(merged.pinnedSummaryIsOwnerNote).toBe(true);
  });

  it("keeps a teaching date the form did not send", () => {
    const merged = mergeOnCallEditorDetails({
      section: "education",
      formDetails: { nextOccurrence: "Thursday 1pm", presenter: "Dr Example" },
      existingDetails: { nextOccurrence: "Thursday 1pm", nextOccurrenceDate: "2026-09-16" },
    });
    expect(merged.nextOccurrenceDate).toBe("2026-09-16");
    expect(merged.presenter).toBe("Dr Example");
  });

  it("lets a newly entered teaching date overlay the stored one", () => {
    const merged = mergeOnCallEditorDetails({
      section: "education",
      formDetails: { nextOccurrenceDate: "2026-10-01" },
      existingDetails: { nextOccurrenceDate: "2026-09-16" },
    });
    expect(merged.nextOccurrenceDate).toBe("2026-10-01");
  });

  it("drops unrecognised existing keys rather than smuggling them into a strict schema", () => {
    const merged = mergeOnCallEditorDetails({
      section: "contacts",
      formDetails: { role: "Ward 4B" },
      existingDetails: { role: "Ward 4B", phne: "9999" },
    });
    expect(merged).toEqual({ role: "Ward 4B" });
  });
});

describe("mergeOnCallEditorDetails — clearing a key the form turned off", () => {
  it("removes a stored recurrence rule when the form reports none", () => {
    const merged = mergeOnCallEditorDetails({
      section: "education",
      formDetails: { nextOccurrence: "Thursday 1pm" },
      existingDetails: { nextOccurrence: "Thursday 1pm", recurrenceRule: { frequency: "weekly" }, topics: [] },
      clearedKeys: ["recurrenceRule"],
    });

    expect(merged.recurrenceRule).toBeUndefined();
    expect("recurrenceRule" in merged).toBe(false);
    // Everything the form did not speak for survives.
    expect(merged.topics).toEqual([]);
  });

  it("leaves a stored rule alone when the form does not clear it", () => {
    const merged = mergeOnCallEditorDetails({
      section: "education",
      formDetails: { nextOccurrence: "Thursday 1pm" },
      existingDetails: { nextOccurrence: "Wednesday", recurrenceRule: { frequency: "weekly" }, topics: [] },
    });

    expect(merged.recurrenceRule).toEqual({ frequency: "weekly" });
  });
});
