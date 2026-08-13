import { describe, expect, it } from "vitest";

import { getMedicationRecord } from "@/lib/medication-snapshot";
import {
  composeMedicationVerdict,
  evaluateMedicationInteractions,
  interactionNoteBody,
  interactionRowCount,
  severityLabel,
  medicationDisplayName,
  SEVERITY_TONE,
} from "@/lib/medication-interactions";

describe("evaluateMedicationInteractions", () => {
  it("matches a drug named outright in the counterparty sentence", () => {
    const result = evaluateMedicationInteractions("sertraline", [
      "tramadol-ir",
    ]);
    expect(result.interactions).toHaveLength(1);
    expect(result.interactions[0]?.counterpartySlug).toBe("tramadol-ir");
    expect(result.interactions[0]?.severity).toBe("critical");
    expect(result.highestTone).toBe("danger");
  });

  it("matches through a resolved class term", () => {
    const result = evaluateMedicationInteractions("sertraline", ["phenelzine"]);
    expect(result.interactions[0]?.counterpartySlug).toBe("phenelzine");
    expect(result.interactions[0]?.matchedTerms).toContain("maois");
  });

  it("renders verbatim catalogue text for a forward interaction", () => {
    const record = getMedicationRecord("sertraline");
    const result = evaluateMedicationInteractions(
      "sertraline",
      ["ibuprofen"],
      record,
    );
    expect(result.interactions[0]?.note).toContain("NSAIDs");
  });

  it("evaluates a clinically material reverse-only edge", () => {
    const result = evaluateMedicationInteractions("buprenorphine-naloxone", [
      "naltrexone",
    ]);
    expect(
      result.interactions.some(
        (item) => item.counterpartySlug === "naltrexone",
      ),
    ).toBe(true);
    expect(result.highestTone).toBe("danger");
  });

  it("keeps missing interaction data incomplete instead of green", () => {
    const result = evaluateMedicationInteractions("not-a-real-drug", [
      "sertraline",
    ]);
    expect(result.dataAvailable).toBe(false);
    expect(result.unresolvedRowCount).toBeGreaterThan(0);
    const verdict = composeMedicationVerdict({
      considerationTone: null,
      considerationCount: 0,
      unassessedCount: 0,
      interactionTone: result.highestTone,
      interactionCount: result.interactions.length,
      unresolvedRowCount: result.unresolvedRowCount,
    });
    expect(verdict.tone).toBe("neutral");
    expect(verdict.incomplete).toBe(true);
  });

  it("never reports a medication as interacting with itself", () => {
    const result = evaluateMedicationInteractions("ibuprofen", ["ibuprofen"]);
    expect(
      result.interactions.every(
        (item) => item.counterpartySlug !== "ibuprofen",
      ),
    ).toBe(true);
  });

  it("carries unresolved rows for incomplete parser coverage", () => {
    const result = evaluateMedicationInteractions("bupropion-sr", []);
    expect(result.unresolvedRowCount).toBeGreaterThan(0);
  });

  it("names counterparties from the index, falling back to the slug", () => {
    expect(medicationDisplayName("tramadol-ir")).toBe("Tramadol IR");
    expect(medicationDisplayName("not-a-real-drug")).toBe("not-a-real-drug");
    expect(interactionRowCount("not-a-real-drug")).toBe(0);
  });

  it("maps unknown severity conservatively", () => {
    expect(SEVERITY_TONE.critical).toBe("danger");
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

  it("is green only when both engines ran clean", () => {
    expect(composeMedicationVerdict(base)).toMatchObject({
      tone: "success",
      incomplete: false,
    });
  });

  it("degrades green to grey when interaction data is incomplete", () => {
    expect(
      composeMedicationVerdict({ ...base, unresolvedRowCount: 1 }),
    ).toMatchObject({
      tone: "neutral",
      incomplete: true,
    });
  });

  it("keeps danger even when data is incomplete", () => {
    expect(
      composeMedicationVerdict({
        ...base,
        interactionTone: "danger",
        interactionCount: 1,
        unresolvedRowCount: 1,
      }),
    ).toMatchObject({ tone: "danger", incomplete: true });
  });
});

describe("interactionNoteBody", () => {
  it("drops the redundant severity prefix the badge already states", () => {
    expect(
      interactionNoteBody(
        "CRITICAL — MAOIs, Tramadol. Massive risk of Serotonin Syndrome.",
      ),
    ).toBe("MAOIs, Tramadol. Massive risk of Serotonin Syndrome.");
  });

  it("handles the hyphen and en-dash the catalogue also uses", () => {
    expect(interactionNoteBody("HIGH - Benzodiazepines/Alcohol.")).toBe(
      "Benzodiazepines/Alcohol.",
    );
    expect(interactionNoteBody("MODERATE – Antacids bind the drug.")).toBe(
      "Antacids bind the drug.",
    );
  });

  it("removes nothing else — every sentence of the clinical claim survives", () => {
    const note =
      "CRITICAL — NSAID + ACEi/ARB + Diuretic. Will virtually guarantee acute renal failure. NEVER prescribe this combination.";
    const body = interactionNoteBody(note);
    expect(body).toContain("Will virtually guarantee acute renal failure.");
    expect(body).toContain("NEVER prescribe this combination.");
    // Only the prefix is gone; the rest is byte-identical.
    expect(note.endsWith(body)).toBe(true);
  });

  it("leaves a row with no severity prefix untouched", () => {
    expect(
      interactionNoteBody(
        "Blocks the cardioprotective effect of low-dose Aspirin.",
      ),
    ).toBe("Blocks the cardioprotective effect of low-dose Aspirin.");
  });

  it("does not strip unknown uppercase clinical wording before a dash", () => {
    expect(interactionNoteBody("NSAID-induced renal injury")).toBe(
      "NSAID-induced renal injury",
    );
    expect(interactionNoteBody("NEVER-combine with MAOIs")).toBe(
      "NEVER-combine with MAOIs",
    );
  });

  it("does not eat an all-caps word that is part of the sentence", () => {
    // No dash, so nothing is a prefix.
    expect(interactionNoteBody("NEVER combine with MAOIs")).toBe(
      "NEVER combine with MAOIs",
    );
  });

  it("labels severity for display", () => {
    expect(severityLabel("critical")).toBe("Critical");
    expect(severityLabel("unknown")).toBe("Unknown");
  });
});
