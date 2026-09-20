import { describe, expect, it } from "vitest";

import { COMPLIANCE_KIND } from "@/lib/on-call/compliance";
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

describe("mergeOnCallEditorDetails — the Compliance discriminator", () => {
  it("writes the discriminator when the owner marks a logistics row as a requirement", () => {
    const merged = mergeOnCallEditorDetails({
      section: "logistics",
      formDetails: { category: "Registration" },
      complianceRequirement: true,
    });
    expect(merged.kind).toBe(COMPLIANCE_KIND);
  });

  it("strips the discriminator when the owner unmarks a requirement", () => {
    const merged = mergeOnCallEditorDetails({
      section: "logistics",
      formDetails: { category: "Forms" },
      existingDetails: { category: "Registration", kind: COMPLIANCE_KIND },
      complianceRequirement: false,
    });
    expect("kind" in merged).toBe(false);
  });

  it("keeps a requirement's kind on an edit that does not speak for the tick box", () => {
    const merged = mergeOnCallEditorDetails({
      section: "logistics",
      formDetails: { category: "Registration" },
      existingDetails: { category: "Registration", kind: COMPLIANCE_KIND, expiresOn: "2027-03-12" },
    });
    expect(merged.kind).toBe(COMPLIANCE_KIND);
    expect(merged.expiresOn).toBe("2027-03-12");
  });

  it("does not invent a kind on an ordinary admin row", () => {
    const merged = mergeOnCallEditorDetails({
      section: "logistics",
      formDetails: { category: "Pay" },
      complianceRequirement: false,
    });
    expect(merged.kind).toBeUndefined();
  });

  // The two flags write the same `kind` key and must not reach across sections:
  // a contacts form saying "not a requirement" must never strip a compliance
  // row's discriminator, and vice versa.
  it("leaves a role explainer's kind alone when asked about compliance", () => {
    const merged = mergeOnCallEditorDetails({
      section: "contacts",
      formDetails: { role: "Registrar" },
      existingDetails: { role: "Registrar", kind: ROLE_EXPLAINER_KIND },
      complianceRequirement: false,
    });
    expect(merged.kind).toBe(ROLE_EXPLAINER_KIND);
  });

  it("leaves a requirement's kind alone when asked about role explainers", () => {
    const merged = mergeOnCallEditorDetails({
      section: "logistics",
      formDetails: { category: "Registration" },
      existingDetails: { category: "Registration", kind: COMPLIANCE_KIND },
      roleExplainer: false,
    });
    expect(merged.kind).toBe(COMPLIANCE_KIND);
  });
});

describe("mergeOnCallEditorDetails — the taxonomy sweep", () => {
  it("clears the departing taxonomy's keys while leaving category and url alone", () => {
    const merged = mergeOnCallEditorDetails({
      section: "logistics",
      formDetails: { category: "Forms" },
      existingDetails: {
        category: "Registration",
        kind: COMPLIANCE_KIND,
        consequence: "stops-work",
        expiresOn: "2027-03-12",
        leadTimeDays: 90,
        issuingBody: "Ahpra",
        evidenceUrl: "https://example.org/certificate",
        provenance: "confirmed",
        url: "https://example.org/renew",
      },
      complianceRequirement: false,
      clearedKeys: ["consequence", "expiresOn", "leadTimeDays", "issuingBody", "evidenceUrl", "provenance"],
    });

    expect(merged).toEqual({ category: "Forms", url: "https://example.org/renew" });
  });

  it("clears the admin keys in the other direction, again leaving category and url alone", () => {
    const merged = mergeOnCallEditorDetails({
      section: "logistics",
      formDetails: { category: "Registration", consequence: "stops-work" },
      existingDetails: {
        category: "Pay",
        location: "Level 2, Block B",
        hours: "0800-1600",
        phone: "x2201",
        url: "https://example.org/payroll",
      },
      complianceRequirement: true,
      clearedKeys: ["location", "hours", "phone"],
    });

    expect(merged).toEqual({
      category: "Registration",
      consequence: "stops-work",
      kind: COMPLIANCE_KIND,
      url: "https://example.org/payroll",
    });
  });

  it("never deletes a key the form actually sent", () => {
    const merged = mergeOnCallEditorDetails({
      section: "logistics",
      formDetails: { category: "Pay", location: "Level 2, Block B" },
      existingDetails: { category: "Pay", location: "Level 1" },
      complianceRequirement: false,
      clearedKeys: ["hours", "phone"],
    });
    expect(merged.location).toBe("Level 2, Block B");
  });
});

describe("salvageExistingDetails — through the merge, for a stored object the schema refuses", () => {
  // Not reachable from the app today (see the function's own comment), so this
  // exercises it directly: the merge is the only caller, and a stored object
  // that fails the whole-object parse must lose only the keys the schema
  // actually rejects.
  it("keeps every stored key the schema accepts and drops only the rejected one", () => {
    const merged = mergeOnCallEditorDetails({
      section: "logistics",
      formDetails: { category: "Registration" },
      existingDetails: {
        category: "Registration",
        kind: COMPLIANCE_KIND,
        expiresOn: "2027-03-12",
        issuingBody: "Ahpra",
        // Refused by the field's own validator, which fails the whole-object
        // parse and would otherwise take the four good keys down with it.
        leadTimeDays: -1,
      },
    });

    expect(merged.expiresOn).toBe("2027-03-12");
    expect(merged.issuingBody).toBe("Ahpra");
    expect(merged.kind).toBe(COMPLIANCE_KIND);
    expect("leadTimeDays" in merged).toBe(false);
  });

  it("returns nothing salvageable for stored details that are not an object", () => {
    const merged = mergeOnCallEditorDetails({
      section: "logistics",
      formDetails: { category: "Pay" },
      existingDetails: null,
    });
    expect(merged).toEqual({ category: "Pay" });
  });
});
