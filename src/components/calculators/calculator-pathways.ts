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
        "Interpret AUDIT-C with alcohol history and assessment of dependence or withdrawal where relevant. A completed score screens reported consumption and does not diagnose an alcohol use disorder.",
      sourceIds: ["source:auditc:validation", "source:auditc:thresholds"],
      claimIds: ["claim:auditc:interpretation"],
    },
    {
      label:
        "Read the total against a named screening convention. The registered convention is 4 or more for men and 3 or more for women, derived in United States primary care.",
      sourceIds: ["source:auditc:thresholds"],
      claimIds: ["claim:auditc:thresholds"],
    },
    {
      label:
        "An Australian standard drink is 10 g of alcohol, which is the unit the item wording assumes. This supports drink-size context only, not the screening threshold.",
      sourceIds: ["source:auditc"],
      claimIds: ["claim:auditc:units"],
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
