import { describe, expect, it } from "vitest";

import { getMedicationRecord } from "@/lib/medication-snapshot";
import {
  composeMedicationVerdict,
  evaluateMedicationInteractions,
  interactionNoteBody,
  interactionRowCount,
  isUnreachableCounterparty,
  severityLabel,
  medicationDisplayName,
  SEVERITY_TONE,
} from "@/lib/medication-interactions";

describe("evaluateMedicationInteractions", () => {
  it("matches a drug named outright in the counterparty sentence", () => {
    const result = evaluateMedicationInteractions("sertraline", ["tramadol-ir"]);
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
    const result = evaluateMedicationInteractions("sertraline", ["ibuprofen"], record);
    expect(result.interactions[0]?.note).toContain("NSAIDs");
  });

  it("evaluates a clinically material reverse-only edge", () => {
    const result = evaluateMedicationInteractions("buprenorphine-naloxone", ["naltrexone"]);
    expect(result.interactions.some((item) => item.counterpartySlug === "naltrexone")).toBe(true);
    expect(result.highestTone).toBe("danger");
  });

  it("does not reintroduce loperamide's excluded opioid term through a reverse row", () => {
    const result = evaluateMedicationInteractions("morphine-ir-iv", ["loperamide"]);
    expect(result.interactions.some((item) => item.counterpartySlug === "loperamide")).toBe(false);
  });

  it("warns on lithium plus an NSAID or a thiazide", () => {
    // Both are textbook lithium-toxicity interactions and both were silent: the
    // catalogue record is "Lithium carbonate (IR/SR)", so no name-derived
    // surface matched the bare "Lithium" every row writes. End-to-end through
    // the evaluator, not just the index, because the index can carry a
    // counterparty the evaluator never surfaces.
    for (const drug of ["ibuprofen", "hydrochlorothiazide", "indapamide", "frusemide"]) {
      const result = evaluateMedicationInteractions(drug, ["lithium-carbonate-ir-sr"]);
      expect(
        result.interactions.some((item) => item.counterpartySlug === "lithium-carbonate-ir-sr"),
        `${drug} + lithium should warn`,
      ).toBe(true);
      expect(result.highestTone).toBe("danger");
    }
  });

  it("never shows green when an entered medication is outside the resolved interaction graph", () => {
    // The mirror of the missing-data guard, and the half that was missing. A
    // patient on a drug the corpus never mentions produced zero interactions,
    // zero unresolved rows, and a confident green — silence presented as an
    // all-clear. Zolpidem is one of 20 such drugs.
    const result = evaluateMedicationInteractions("sertraline", ["zolpidem"]);
    expect(result.interactions).toHaveLength(0);
    expect(result.unreachableCounterparties).toEqual(["zolpidem"]);

    const verdict = composeMedicationVerdict({
      considerationTone: null,
      considerationCount: 0,
      unassessedCount: 0,
      interactionTone: result.highestTone,
      interactionCount: result.interactions.length,
      unresolvedRowCount: 0,
      unreachableCounterpartyCount: result.unreachableCounterparties.length,
    });
    expect(verdict.tone).not.toBe("success");
    expect(verdict.incomplete).toBe(true);
  });

  it("does not call a reachable medication unreachable", () => {
    // The guard has to stay narrow, or it degrades every verdict to grey and
    // stops meaning anything. Ibuprofen is named by many rows.
    const result = evaluateMedicationInteractions("sertraline", ["ibuprofen"]);
    expect(result.unreachableCounterparties).toEqual([]);
    expect(isUnreachableCounterparty("ibuprofen")).toBe(false);
    expect(isUnreachableCounterparty("zolpidem")).toBe(true);
  });

  it("counts a source-only medication as a reachable interaction endpoint", () => {
    // Celecoxib is not named by another medication's row, but its own source row
    // names fluconazole. The evaluator scans both directions, so the reachability
    // graph must include the source endpoint as well as its counterparty.
    expect(isUnreachableCounterparty("celecoxib")).toBe(false);
    const result = evaluateMedicationInteractions("fluconazole", ["celecoxib"]);
    expect(result.interactions.some((item) => item.counterpartySlug === "celecoxib")).toBe(true);
    expect(result.unreachableCounterparties).toEqual([]);
  });

  it("gives a reverse-only match its wording, not just a name and a severity", () => {
    // Buprenorphine/naloxone's own rows never name naltrexone; naltrexone's row
    // names it. The caller holds only the viewed drug's record, so this text can
    // come from nowhere but the index — and it used to be passed as "", leaving a
    // CRITICAL alert with nothing underneath explaining it.
    const result = evaluateMedicationInteractions("buprenorphine-naloxone", ["naltrexone"]);
    const reverse = result.interactions.find((item) => item.counterpartySlug === "naltrexone");
    expect(reverse?.severity).toBe("critical");
    expect(reverse?.note).toMatch(/Opioid analgesia is antagonised/i);
  });

  it("prefers the live record's wording over the indexed copy when both exist", () => {
    const record = getMedicationRecord("sertraline");
    const withRecord = evaluateMedicationInteractions("sertraline", ["ibuprofen"], record);
    const withoutRecord = evaluateMedicationInteractions("sertraline", ["ibuprofen"]);
    // Same text either way while the artefact is fresh — `check:medication-interactions`
    // is what keeps that true — but the record is the authority when supplied.
    expect(withRecord.interactions[0]?.note).toBe(withoutRecord.interactions[0]?.note);
    expect(withoutRecord.interactions[0]?.note).toContain("NSAIDs");
  });

  it("keeps missing interaction data incomplete instead of green", () => {
    const result = evaluateMedicationInteractions("not-a-real-drug", ["sertraline"]);
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
    expect(result.interactions.every((item) => item.counterpartySlug !== "ibuprofen")).toBe(true);
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
    expect(composeMedicationVerdict({ ...base, unresolvedRowCount: 1 })).toMatchObject({
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
    expect(interactionNoteBody("CRITICAL — MAOIs, Tramadol. Massive risk of Serotonin Syndrome.")).toBe(
      "MAOIs, Tramadol. Massive risk of Serotonin Syndrome.",
    );
  });

  it("handles the hyphen and en-dash the catalogue also uses", () => {
    expect(interactionNoteBody("HIGH - Benzodiazepines/Alcohol.")).toBe("Benzodiazepines/Alcohol.");
    expect(interactionNoteBody("MODERATE – Antacids bind the drug.")).toBe("Antacids bind the drug.");
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
    expect(interactionNoteBody("Blocks the cardioprotective effect of low-dose Aspirin.")).toBe(
      "Blocks the cardioprotective effect of low-dose Aspirin.",
    );
  });

  it("does not strip unknown uppercase clinical wording before a dash", () => {
    expect(interactionNoteBody("NSAID-induced renal injury")).toBe("NSAID-induced renal injury");
    expect(interactionNoteBody("NEVER-combine with MAOIs")).toBe("NEVER-combine with MAOIs");
  });

  it("does not eat an all-caps word that is part of the sentence", () => {
    // No dash, so nothing is a prefix.
    expect(interactionNoteBody("NEVER combine with MAOIs")).toBe("NEVER combine with MAOIs");
  });

  it("labels severity for display", () => {
    expect(severityLabel("critical")).toBe("Critical");
    expect(severityLabel("unknown")).toBe("Unknown");
  });
});
