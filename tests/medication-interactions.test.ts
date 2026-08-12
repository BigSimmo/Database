import { describe, expect, it } from "vitest";

import { getMedicationRecord } from "@/lib/medication-snapshot";
import {
  composeMedicationVerdict,
  evaluateMedicationInteractions,
  interactionRowCount,
  medicationDisplayName,
  SEVERITY_TONE,
} from "@/lib/medication-interactions";

describe("evaluateMedicationInteractions", () => {
  it("matches a drug named outright in the counterparty sentence", () => {
    // Sertraline's CRITICAL row: "MAOIs, Tramadol, Tapentadol, St John's Wort."
    const result = evaluateMedicationInteractions("sertraline", ["tramadol-ir"]);
    expect(result.interactions).toHaveLength(1);
    expect(result.interactions[0]?.counterpartySlug).toBe("tramadol-ir");
    expect(result.interactions[0]?.severity).toBe("critical");
    expect(result.interactions[0]?.tone).toBe("danger");
    expect(result.highestTone).toBe("danger");
  });

  it("matches through a resolved class term", () => {
    // The same row names "MAOIs"; phenelzine is reached via the class, not by name.
    const result = evaluateMedicationInteractions("sertraline", ["phenelzine"]);
    expect(result.interactions[0]?.counterpartySlug).toBe("phenelzine");
    expect(result.interactions[0]?.counterpartyName).toBe("Phenelzine");
    expect(result.interactions[0]?.matchedTerms).toContain("maois");
    expect(result.interactions[0]?.tone).toBe("danger");
  });

  it("renders the verbatim catalogue row text when given the record", () => {
    const record = getMedicationRecord("sertraline");
    const result = evaluateMedicationInteractions("sertraline", ["ibuprofen"], record);
    expect(result.interactions[0]?.note).toContain("NSAIDs");
    expect(result.interactions[0]?.note).toMatch(/^(HIGH|CRITICAL)/);
  });

  it("still reports the interaction without a record, just with no note text", () => {
    const result = evaluateMedicationInteractions("sertraline", ["ibuprofen"]);
    expect(result.interactions).toHaveLength(1);
    expect(result.interactions[0]?.note).toBe("");
  });

  it("returns no matches for a patient list with nothing in common", () => {
    const result = evaluateMedicationInteractions("sertraline", ["paracetamol"]);
    expect(result.interactions).toHaveLength(0);
    expect(result.highestTone).toBeNull();
  });

  it("never reports a medication as interacting with itself", () => {
    const result = evaluateMedicationInteractions("ibuprofen", ["ibuprofen"]);
    expect(result.interactions.every((item) => item.counterpartySlug !== "ibuprofen")).toBe(true);
  });

  it("sorts the most severe interaction first", () => {
    const result = evaluateMedicationInteractions("sertraline", ["ibuprofen", "tramadol-ir"]);
    expect(result.interactions.length).toBeGreaterThanOrEqual(2);
    expect(result.interactions[0]?.severity).toBe("critical");
  });

  it("carries the unresolved row count for a medication the parser could not fully read", () => {
    // Bupropion's CYP2D6-substrate row has no enumerable counterparty.
    const result = evaluateMedicationInteractions("bupropion-sr", []);
    expect(result.unresolvedRowCount).toBeGreaterThan(0);
    expect(result.totalRowCount).toBeGreaterThanOrEqual(result.unresolvedRowCount);
  });

  it("returns an empty result for an unknown slug rather than throwing", () => {
    const result = evaluateMedicationInteractions("not-a-real-drug", ["sertraline"]);
    expect(result.interactions).toHaveLength(0);
    expect(result.totalRowCount).toBe(0);
    expect(interactionRowCount("not-a-real-drug")).toBe(0);
  });

  it("names counterparties from the index, falling back to the slug", () => {
    expect(medicationDisplayName("tramadol-ir")).toBe("Tramadol IR");
    expect(medicationDisplayName("not-a-real-drug")).toBe("not-a-real-drug");
  });

  it("maps every severity to a tone, and never maps an unknown severity to success", () => {
    expect(SEVERITY_TONE.critical).toBe("danger");
    expect(SEVERITY_TONE.moderate).toBe("warning");
    expect(SEVERITY_TONE.low).toBe("success");
    expect(SEVERITY_TONE.unknown).toBe("neutral");
  });
});

describe("composeMedicationVerdict", () => {
  const base = {
    considerationTone: null,
    considerationCount: 0,
    unassessedCount: 0,
    interactionTone: null,
    interactionCount: 0,
    unresolvedRowCount: 0,
  };

  it("is green when both engines ran clean", () => {
    expect(composeMedicationVerdict(base).tone).toBe("success");
    expect(composeMedicationVerdict(base).incomplete).toBe(false);
  });

  it("degrades green to grey when an interaction row could not be resolved", () => {
    const verdict = composeMedicationVerdict({ ...base, unresolvedRowCount: 2 });
    expect(verdict.tone).toBe("neutral");
    expect(verdict.incomplete).toBe(true);
  });

  it("degrades green to grey when a physiology gate was unassessed", () => {
    expect(composeMedicationVerdict({ ...base, unassessedCount: 1 }).tone).toBe("neutral");
  });

  it("keeps danger even when data is incomplete — a real finding outranks the caveat", () => {
    const verdict = composeMedicationVerdict({
      ...base,
      interactionTone: "danger",
      interactionCount: 1,
      unresolvedRowCount: 3,
    });
    expect(verdict.tone).toBe("danger");
    expect(verdict.incomplete).toBe(true);
  });

  it("takes the highest tone across both engines", () => {
    expect(composeMedicationVerdict({ ...base, considerationTone: "warning", interactionTone: "danger" }).tone).toBe(
      "danger",
    );
    expect(composeMedicationVerdict({ ...base, considerationTone: "danger", interactionTone: "warning" }).tone).toBe(
      "danger",
    );
  });
});
