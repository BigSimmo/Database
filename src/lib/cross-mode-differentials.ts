import type { CrossModeDifferentialCatalog } from "@/lib/cross-mode-links";
<<<<<<< HEAD
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
=======
import { differentialPresentations, differentialRecords, differentialSearchAliases } from "@/lib/differentials";

// Load this module with a dynamic import only: it statically pulls the 1.2 MB
// differentials snapshot, which stays code-split out of the dashboard bundle.
export function crossModeDifferentialCatalog(): CrossModeDifferentialCatalog {
  return {
    diagnoses: differentialRecords.map((record) => ({
>>>>>>> origin/main
      slug: record.slug,
      title: record.title,
      clinicalHinge: record.clinicalHinge,
    })),
<<<<<<< HEAD
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
=======
    presentations: differentialPresentations().map((presentation) => ({
      id: presentation.id,
      title: presentation.title,
      subtitle: presentation.subtitle,
    })),
    aliases: differentialSearchAliases(),
>>>>>>> origin/main
  };
}
