import type { CalculatorFixture } from "./calculator-fixtures";
import type { DerivedCalculator } from "./calculator-ui";

export type PathwayAction = {
  label: string;
  sourceIds: string[];
  claimIds: string[];
};

type ClinicalConsideration = PathwayAction & {
  sourceIds: string[];
  claimIds: string[];
};

const considerationsByCalculator: Record<string, ClinicalConsideration[]> = {
  phq9: [
    {
      label:
        "Interpret the completed score alongside diagnostic assessment, impairment, history and current safety assessment.",
      sourceIds: ["source:phq9"],
      claimIds: ["claim:phq9:interpretation"],
    },
  ],
  gad7: [
    {
      label:
        "Use the completed score as one part of anxiety assessment, including differential diagnosis and functional impact.",
      sourceIds: ["source:gad7"],
      claimIds: ["claim:gad7:interpretation"],
    },
  ],
  k10: [
    {
      label: "K10 describes psychological distress and is not a diagnostic or disposition category.",
      sourceIds: ["source:k10"],
      claimIds: ["claim:k10:interpretation"],
    },
  ],
  cage: [
    {
      label:
        "CAGE is a lifetime problem-drinking screen. Interpret it with alcohol history, current use and withdrawal assessment.",
      sourceIds: ["source:cage"],
      claimIds: ["claim:cage:interpretation"],
    },
  ],
  auditc: [
    {
      label:
        "Interpret AUDIT-C with Australian standard-drink context, alcohol history and assessment of dependence or withdrawal where relevant.",
      sourceIds: ["source:auditc"],
      claimIds: ["claim:auditc:interpretation"],
    },
  ],
};

/** Clinical considerations are source-linked and unavailable until completion. */
export function actionsForBand(calc: CalculatorFixture, derived: DerivedCalculator): PathwayAction[] {
  if (!derived.complete) return [];
  return (considerationsByCalculator[calc.id] ?? []).map(({ label, sourceIds, claimIds }) => ({
    label,
    sourceIds,
    claimIds,
  }));
}
