import type { CrossModeDifferentialCatalog } from "@/lib/cross-mode-links";
import { differentialRecords } from "@/lib/differentials";

const supplementalDiagnoses = [
  {
    slug: "acute-psychosis",
    title: "Acute Psychosis",
    clinicalHinge: "Acute psychotic symptoms require safety review and rapid medical exclusion.",
  },
  {
    slug: "aggression-violence-homicidal-ideation",
    title: "Aggression / Violence / Homicidal Ideation",
    clinicalHinge: "Acute aggression or homicidal intent threatens immediate safety and may signal delirium, intoxication or mania.",
  },
] as const;

// Load this module with a dynamic import only: it statically pulls the
// differentials catalog, which stays code-split out of the dashboard bundle.
export function crossModeDifferentialCatalog(): CrossModeDifferentialCatalog {
  const diagnoses = [
    ...differentialRecords.map((record) => ({
      slug: record.slug,
      title: record.title,
      clinicalHinge: record.clinicalHinge,
    })),
    ...supplementalDiagnoses.map((record) => ({ ...record })),
  ];

  return {
    diagnoses,
    presentations: [],
    aliases: {
      psychotic: ["psychosis", "schizophrenia"],
      psychosis: ["psychotic", "schizophrenia"],
      aggression: ["violence", "homicidal"],
      violence: ["aggression", "homicidal"],
      homicidal: ["aggression", "violence"],
    },
  };
}
