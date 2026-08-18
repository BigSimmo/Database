import { describe, expect, it } from "vitest";
import {
  buildRelatedInformationMenu,
  formatRelatedInformationMenuLine,
  relatedInformationMenuLine,
  type RelatedInformationMenuKey,
} from "@/lib/rag/answer-composition";
import type { AnswerSectionKind, ClinicalQueryIntent, RagQueryClass } from "@/lib/types";

// Packet S2 (A2): the composition menu is a total, deterministic function over every
// (RagQueryClass, ClinicalQueryIntent) cell. Class is authoritative; intent refines only the
// two clinical-fact classes, and only for the escalation_risk signal. These pins are the
// offline contract that keeps the prompt line stable between live canary pairs.

const queryClasses = [
  "document_lookup",
  "table_threshold",
  "medication_dose_risk",
  "comparison",
  "broad_summary",
  "unsupported_or_general",
] as const satisfies readonly RagQueryClass[];

const intents = [
  "definition",
  "protocol",
  "drug_dosing",
  "escalation_risk",
  "document_lookup",
  "comparison",
  "broad_summary",
  "general",
] as const satisfies readonly ClinicalQueryIntent[];

const answerSectionKinds = new Set<AnswerSectionKind>([
  "bottom_line",
  "required_actions",
  "monitoring_timing",
  "medication_dose",
  "thresholds",
  "escalation_risk",
  "contraindications_cautions",
  "comparison",
  "documentation",
  "source_gap",
  "visual_evidence",
  "quotes",
  "verification",
]);

function expectedKey(queryClass: RagQueryClass, intent: ClinicalQueryIntent): RelatedInformationMenuKey {
  switch (queryClass) {
    case "medication_dose_risk":
      return intent === "escalation_risk" ? "escalation" : "dosing";
    case "table_threshold":
      return intent === "escalation_risk" ? "escalation" : "threshold";
    case "comparison":
      return "comparison";
    case "broad_summary":
      return "management";
    case "document_lookup":
    case "unsupported_or_general":
      return "none";
  }
}

describe("answer composition menu (packet S2 / README A2)", () => {
  it("is total over the 6x8 class-by-intent matrix and keys each cell as designed", () => {
    for (const queryClass of queryClasses) {
      for (const intent of intents) {
        const menu = buildRelatedInformationMenu(queryClass, intent);
        expect(menu.key, `${queryClass} x ${intent}`).toBe(expectedKey(queryClass, intent));
        expect(menu.queryClass).toBe(queryClass);
        expect(menu.intent).toBe(intent);
      }
    }
  });

  it("only offers kinds that exist in the answerSections schema enum, with distinct focus phrases", () => {
    for (const queryClass of queryClasses) {
      for (const intent of intents) {
        const menu = buildRelatedInformationMenu(queryClass, intent);
        const focuses = menu.items.map((item) => item.focus);
        expect(new Set(focuses).size).toBe(focuses.length);
        for (const item of menu.items) {
          expect(answerSectionKinds.has(item.kind), `${item.kind} is not an AnswerSectionKind`).toBe(true);
          expect(item.focus.trim()).toBe(item.focus);
          expect(item.focus.length).toBeGreaterThan(0);
          // The prompt line uses ";" between items and " — " between kind and focus, so a
          // focus phrase must not smuggle either separator.
          expect(item.focus).not.toMatch(/[;—]/);
        }
      }
    }
  });

  it("carries the README A2 dosing menu for medication_dose_risk questions", () => {
    const menu = buildRelatedInformationMenu("medication_dose_risk", "drug_dosing");
    expect(menu.items.map((item) => item.kind)).toEqual([
      "monitoring_timing",
      "contraindications_cautions",
      "escalation_risk",
      "medication_dose",
    ]);
    // A noisy `definition` intent (the regex matches "long-term") must not silence the menu;
    // narrowness is the prompt's narrow-question rule, not a menu decision.
    for (const intent of ["definition", "protocol", "general", "comparison"] as const) {
      const refined = buildRelatedInformationMenu("medication_dose_risk", intent);
      expect(refined.key).toBe("dosing");
      expect(refined.items).toEqual(menu.items);
    }
  });

  it("switches the two clinical-fact classes to the escalation menu on an escalation_risk intent", () => {
    for (const queryClass of ["medication_dose_risk", "table_threshold"] as const) {
      const menu = buildRelatedInformationMenu(queryClass, "escalation_risk");
      expect(menu.key).toBe("escalation");
      expect(menu.items.map((item) => item.kind)).toEqual([
        "required_actions",
        "thresholds",
        "escalation_risk",
        "documentation",
      ]);
    }
  });

  it("keeps table_threshold on the band menu even when the question carries dose words", () => {
    const menu = buildRelatedInformationMenu("table_threshold", "drug_dosing");
    expect(menu.key).toBe("threshold");
    expect(menu.items.map((item) => item.kind)).toEqual(["thresholds", "required_actions", "escalation_risk"]);
  });

  it("gives comparison and broad_summary their own menus regardless of the heuristic intent", () => {
    for (const intent of intents) {
      expect(buildRelatedInformationMenu("comparison", intent).items.map((item) => item.kind)).toEqual([
        "comparison",
        "comparison",
        "required_actions",
      ]);
      expect(buildRelatedInformationMenu("broad_summary", intent).items.map((item) => item.kind)).toEqual([
        "required_actions",
        "documentation",
        "source_gap",
      ]);
    }
  });

  it("stays narrow for document_lookup and unsupported_or_general (README A2 row 6; simple-direct gate)", () => {
    for (const queryClass of ["document_lookup", "unsupported_or_general"] as const) {
      for (const intent of intents) {
        const menu = buildRelatedInformationMenu(queryClass, intent);
        expect(menu.key).toBe("none");
        expect(menu.items).toEqual([]);
        expect(relatedInformationMenuLine(queryClass, intent)).toBe(
          "related_information_menu: none — no related-information menu for this question type; apply the Answer sections rules as written",
        );
      }
    }
  });

  it("serialises one prompt line as `kind — focus` items joined by `; ` in menu order", () => {
    const line = relatedInformationMenuLine("medication_dose_risk", "general");
    expect(line).toBe(
      "related_information_menu: monitoring_timing — monitoring schedule and levels; contraindications_cautions — contraindications and cautions; escalation_risk — escalation and stop triggers; medication_dose — dose adjustment for renal or hepatic impairment and older adults",
    );
    expect(line).not.toContain("\n");
    expect(formatRelatedInformationMenuLine(buildRelatedInformationMenu("medication_dose_risk", "general"))).toBe(line);
  });

  it("is deterministic and returns frozen menus", () => {
    const first = buildRelatedInformationMenu("comparison", "comparison");
    const second = buildRelatedInformationMenu("comparison", "comparison");
    expect(first).toEqual(second);
    expect(Object.isFrozen(first.items)).toBe(true);
  });
});
