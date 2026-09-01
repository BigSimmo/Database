/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  allCalculatorFixtures,
  calculators,
  calculatorEvidence,
  quarantinedCalculators,
  type CalculatorFixture,
} from "@/components/calculators/calculator-fixtures";
import { actionsForBand } from "@/components/calculators/calculator-pathways";
import { CopyResultButton, deriveCalculator, type AnswerMap } from "@/components/calculators/calculator-ui";
import { sharedHomePresentation } from "@/lib/ui-copy";

function fixture(id: string): CalculatorFixture {
  const found = allCalculatorFixtures.find((calculator) => calculator.id === id);
  if (!found) throw new Error(`Missing calculator fixture: ${id}`);
  return found;
}

function explicitAnswers(calc: CalculatorFixture, value = 0): AnswerMap {
  return Object.fromEntries(calc.items.map((item) => [item.id, value]));
}

describe("calculator clinical catalogue", () => {
  it("fails closed for unsafe or rights-blocked instruments", () => {
    const activeIds = calculators.map((calculator) => calculator.id);
    expect(activeIds).toEqual(["phq9", "gad7", "k10", "cage", "auditc"]);
    expect(activeIds).not.toContain("sadpersons");
    expect(activeIds).not.toContain("ybocs");
    expect(activeIds).not.toContain("mdq");

    expect(quarantinedCalculators.map((calculator) => calculator.id)).toEqual(
      expect.arrayContaining(["mdq", "sadpersons", "ybocs"]),
    );
  });

  it("requires evidence, rights and review metadata for every active instrument", () => {
    for (const calc of calculators) {
      expect(calc.instrumentVersion).toBeTruthy();
      expect(calc.sourceIds.length).toBeGreaterThan(0);
      expect(calc.claimIds.length).toBeGreaterThan(0);
      expect(calc.rights.status).not.toBe("permission_review_required");
      expect(calc.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(calc.nextReview).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(calc.releaseStatus).toBe("available");
    }
  });

  it("resolves every source and claim reference", () => {
    const sourceIds = new Set(calculatorEvidence.sources.map((source) => source.id));
    const claimIds = new Set(calculatorEvidence.claims.map((claim) => claim.id));

    for (const calc of allCalculatorFixtures) {
      for (const sourceId of calc.sourceIds) expect(sourceIds.has(sourceId)).toBe(true);
      for (const claimId of calc.claimIds) expect(claimIds.has(claimId)).toBe(true);
    }

    for (const claim of calculatorEvidence.claims) {
      expect(claim.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of claim.sourceIds) expect(sourceIds.has(sourceId)).toBe(true);
    }
  });

  it("keeps deterministic treatment and disposition language out of score bands", () => {
    const forbidden =
      /\b(pharmacotherapy|start an? ssri|initiate|ect|admission|discharge|specialist referral|augmentation|treatment warranted)\b/i;

    for (const calc of allCalculatorFixtures) {
      for (const band of calc.bands) expect(band.interpretation).not.toMatch(forbidden);
    }
  });
});

describe("completion is not inferred from a partial score", () => {
  it("withholds a PHQ-9 band and considerations until all nine items are answered", () => {
    const calc = fixture("phq9");
    const partial = deriveCalculator(calc, { p1: 1 });

    expect(partial.started).toBe(true);
    expect(partial.complete).toBe(false);
    expect(partial.band).toBeUndefined();
    expect(partial.result.label).toBe("Incomplete");
    expect(actionsForBand(calc, partial)).toEqual([]);
  });

  it("surfaces the PHQ-9 item 9 safety alert before completion", () => {
    const calc = fixture("phq9");
    const partial = deriveCalculator(calc, { p9: 1 });

    expect(partial.complete).toBe(false);
    expect(partial.flags).toContain(
      "Item 9 endorsed — directly assess suicidal thoughts, self-harm thoughts and immediate safety now.",
    );
  });

  it("does not publish a final GAD-7 band from six answers", () => {
    const calc = fixture("gad7");
    const answers = Object.fromEntries(calc.items.slice(0, 6).map((item) => [item.id, 0]));
    const partial = deriveCalculator(calc, answers);

    expect(partial.complete).toBe(false);
    expect(partial.band).toBeUndefined();
    expect(partial.result.label).toBe("Incomplete");
  });

  it("does not turn an impairment-only MDQ into a completed negative screen", () => {
    const calc = fixture("mdq");
    const partial = deriveCalculator(calc, { mimp: 0 });

    expect(partial.complete).toBe(false);
    expect(partial.result.label).toBe("Incomplete");
  });

  it("allows a completed explicit-negative MDQ result in the quarantined fixture", () => {
    const calc = fixture("mdq");
    const answers = explicitAnswers(calc, 0);
    const complete = deriveCalculator(calc, answers);

    expect(complete.complete).toBe(true);
    expect(complete.result.label).toBe("Negative screen");
  });

  it("disables copying a result until the instrument is complete", () => {
    const calc = fixture("phq9");
    const partial = deriveCalculator(calc, { p1: 1 });
    render(<CopyResultButton calc={calc} state={partial} />);

    expect(screen.getByRole("button", { name: "Copy result" })).toBeDisabled();
  });
});

describe("calculator mode copy", () => {
  it("describes assessment, limitations and source-linked considerations without claiming all tools are validated", () => {
    expect(sharedHomePresentation.calculators.subtitle).toBe(
      "Psychiatry assessment and monitoring tools with scoring guidance, limitations, safety prompts, and source-linked clinical considerations.",
    );
  });
});
